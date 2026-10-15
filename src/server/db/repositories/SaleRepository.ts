/**
 * SGMO — Tequeños Costa
 * PostgreSQL Repository: Sales Transactions & Batch Sync
 */

import { query, withTransaction } from '../connection.js';
import { SaleTransaction } from '../../../types';
import type { PoolClient } from 'pg';
import { assertOperationId, assertShiftMutationAccess, CANONICAL_BANK_SALE_SQL, DataIntegrityError, validateSaleIntegrity, type OperationActor } from '../salesValidation.js';

export class SaleRepository {
  async getAll(): Promise<SaleTransaction[]> {
    const res = await query(`
      SELECT 
        id, shift_id as "shiftId", seller_id as "sellerId", seller_name as "sellerName",
        timestamp, item_type as "itemType", variety_id as "varietyId", variety_name as "varietyName",
        quantity_units_equivalent as "quantityUnitsEquivalent",
        total_amount::float as "totalAmount",
        payment_method as "paymentMethod",
        location_name as "locationName", beach_sector as "beachSector",
        voucher_photo_url as "voucherPhotoUrl",
        voucher_extracted_data as "voucherExtractedData",
        CASE WHEN payment_method != 'efectivo' AND validation_status='validada'
          AND NOT COALESCE((${CANONICAL_BANK_SALE_SQL}),FALSE) THEN 'pendiente_revision'
          ELSE validation_status END AS "validationStatus",
        CASE WHEN payment_method != 'efectivo' AND mp_api_verification IS NOT NULL
          AND NOT COALESCE((${CANONICAL_BANK_SALE_SQL}),FALSE) THEN mp_api_verification ||
          '{"matchedInApi":false,"isLiveApi":false,"amountMatches":false,"message":"Evidencia no confirmada por el registro bancario central."}'::jsonb
          ELSE mp_api_verification END AS "mpApiVerification",
        (payment_method != 'efectivo' AND mp_api_verification IS NOT NULL
          AND NOT COALESCE((${CANONICAL_BANK_SALE_SQL}),FALSE)) AS "legacyClientEvidence",
        gps_location as "gpsLocation",
        is_offline_created as "isOfflineCreated"
      FROM sales
      ORDER BY timestamp DESC
    `);
    return res.rows;
  }

  async getByShiftId(shiftId: string, client?: PoolClient): Promise<SaleTransaction[]> {
    const execute = client ? client.query.bind(client) : query;
    const res = await execute(`
      SELECT 
        id, shift_id as "shiftId", seller_id as "sellerId", seller_name as "sellerName",
        timestamp, item_type as "itemType", variety_id as "varietyId", variety_name as "varietyName",
        quantity_units_equivalent as "quantityUnitsEquivalent",
        total_amount::float as "totalAmount",
        payment_method as "paymentMethod",
        location_name as "locationName", beach_sector as "beachSector",
        voucher_photo_url as "voucherPhotoUrl",
        voucher_extracted_data as "voucherExtractedData",
        CASE WHEN payment_method != 'efectivo' AND validation_status='validada'
          AND NOT COALESCE((${CANONICAL_BANK_SALE_SQL}),FALSE) THEN 'pendiente_revision'
          ELSE validation_status END AS "validationStatus",
        CASE WHEN payment_method != 'efectivo' AND mp_api_verification IS NOT NULL
          AND NOT COALESCE((${CANONICAL_BANK_SALE_SQL}),FALSE) THEN mp_api_verification ||
          '{"matchedInApi":false,"isLiveApi":false,"amountMatches":false,"message":"Evidencia no confirmada por el registro bancario central."}'::jsonb
          ELSE mp_api_verification END AS "mpApiVerification",
        (payment_method != 'efectivo' AND mp_api_verification IS NOT NULL
          AND NOT COALESCE((${CANONICAL_BANK_SALE_SQL}),FALSE)) AS "legacyClientEvidence",
        gps_location as "gpsLocation",
        is_offline_created as "isOfflineCreated"
      FROM sales
      WHERE shift_id = $1
      ORDER BY timestamp ASC
    `, [shiftId]);
    return res.rows;
  }

  /** El ID es una clave de reintento, nunca una autorización para modificar ventas. */
  async createSale(sale: SaleTransaction, actor?: OperationActor): Promise<SaleTransaction> {
    return withTransaction(async (client) => {
      const shifts = await this.lockShifts(client, [sale], actor);
      return (await this.persistSale(client, sale, shifts.get(sale.shiftId)!)).sale;
    });
  }

  /** Lote indivisible: un conflicto o stock insuficiente deshace TODAS sus escrituras. */
  async syncBatch(sales: SaleTransaction[], actor?: OperationActor): Promise<{ inserted: number; updated: number; acknowledgedIds: string[] }> {
    if (!Array.isArray(sales) || sales.length > 500) throw new DataIntegrityError('INVALID_BATCH', 'El lote debe contener hasta 500 ventas.');
    if (!sales.length) return { inserted: 0, updated: 0, acknowledgedIds: [] };
    return withTransaction(async (client) => {
      const shifts = await this.lockShifts(client, sales, actor);
      let inserted = 0;
      const acknowledgedIds: string[] = [];
      // Orden estable reduce deadlocks entre lotes concurrentes con los mismos IDs.
      for (const sale of [...sales].sort((left, right) => left.id.localeCompare(right.id))) {
        const result = await this.persistSale(client, sale, shifts.get(sale.shiftId)!);
        if (result.inserted) inserted++;
        acknowledgedIds.push(sale.id);
      }
      return { inserted, updated: 0, acknowledgedIds: [...new Set(acknowledgedIds)] };
    });
  }

  /** Todos los caminos de stock/cierre usan el mismo lock de jornada. */
  private async lockShifts(client: PoolClient, sales: SaleTransaction[], actor?: OperationActor): Promise<Map<string, any>> {
    for (const sale of sales) {
      if (!sale || typeof sale !== 'object' || Array.isArray(sale)) throw new DataIntegrityError('INVALID_SALE_DATA', 'Venta inválida.');
      assertOperationId(sale.id, 'ID de venta');
      assertOperationId(sale.shiftId, 'Jornada');
      if (typeof sale.timestamp !== 'string' || !Number.isFinite(Date.parse(sale.timestamp))) {
        throw new DataIntegrityError('INVALID_TIMESTAMP', 'La venta necesita fecha y hora válidas.');
      }
    }
    const shifts = new Map<string, any>();
    for (const shiftId of [...new Set(sales.map((sale) => sale.shiftId))].sort()) {
      const result = await client.query('SELECT * FROM daily_shifts WHERE id = $1 FOR UPDATE', [shiftId]);
      if (!result.rows.length) throw new DataIntegrityError('SHIFT_NOT_FOUND', 'Jornada no encontrada.', 404);
      assertShiftMutationAccess(result.rows[0], actor);
      shifts.set(shiftId, result.rows[0]);
    }
    return shifts;
  }

  private async persistSale(client: PoolClient, input: SaleTransaction, shift: any): Promise<{ sale: SaleTransaction; inserted: boolean }> {
    // El advisory lock también serializa un mismo ID que todavía no tiene fila.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('sgmo.sale.' || $1))", [input.id]);
    const existing = await client.query(`
      SELECT id, shift_id AS "shiftId", seller_id AS "sellerId", seller_name AS "sellerName",
        timestamp, item_type AS "itemType", variety_id AS "varietyId", variety_name AS "varietyName",
        quantity_units_equivalent AS "quantityUnitsEquivalent", total_amount::float AS "totalAmount",
        payment_method AS "paymentMethod", location_name AS "locationName", beach_sector AS "beachSector",
        voucher_photo_url AS "voucherPhotoUrl", voucher_extracted_data AS "voucherExtractedData",
        CASE WHEN payment_method != 'efectivo' AND validation_status='validada'
          AND NOT COALESCE((${CANONICAL_BANK_SALE_SQL}),FALSE) THEN 'pendiente_revision'
          ELSE validation_status END AS "validationStatus", CASE WHEN payment_method != 'efectivo' AND mp_api_verification IS NOT NULL
          AND NOT COALESCE((${CANONICAL_BANK_SALE_SQL}),FALSE) THEN mp_api_verification ||
          '{"matchedInApi":false,"isLiveApi":false,"amountMatches":false,"message":"Evidencia no confirmada por el registro bancario central."}'::jsonb
          ELSE mp_api_verification END AS "mpApiVerification",
        (payment_method != 'efectivo' AND mp_api_verification IS NOT NULL
          AND NOT COALESCE((${CANONICAL_BANK_SALE_SQL}),FALSE)) AS "legacyClientEvidence",
        gps_location AS "gpsLocation", is_offline_created AS "isOfflineCreated"
      FROM sales WHERE id = $1
    `, [input.id]);
    if (input.sellerId && input.sellerId !== shift.seller_id) {
      throw new DataIntegrityError('SELLER_MISMATCH', 'El vendedor no corresponde a la jornada.', 403);
    }
    if (existing.rows.length) {
      const stored = existing.rows[0] as SaleTransaction;
      if (this.identity(stored) !== this.identity({ ...input, sellerId: shift.seller_id })) {
        throw new DataIntegrityError('IDEMPOTENCY_CONFLICT', 'El ID de venta ya existe con un contenido diferente.', 409);
      }
      // ACK también para replay de jornada cerrada o precio ya cambiado; no modifica evidencia.
      return { sale: stored, inserted: false };
    }
    if (shift.status !== 'en_curso') throw new DataIntegrityError('SHIFT_NOT_ACTIVE', 'La jornada ya no admite ventas.', 409);
    const validation = await validateSaleIntegrity(input, client);
    if (!validation.isValid) throw new DataIntegrityError(validation.code ?? 'INVALID_SALE_DATA', validation.error ?? 'Venta inválida.');
    const stock = await client.query(`
      SELECT delivered_units, resupplied_units, returned_units, waste_units,
        (SELECT COALESCE(SUM(quantity_units_equivalent), 0)::int FROM sales WHERE shift_id = $1 AND variety_id = $2) AS sold
      FROM shift_stock_items WHERE shift_id = $1 AND variety_id = $2
    `, [input.shiftId, input.varietyId]);
    if (!stock.rows.length) throw new DataIntegrityError('STOCK_NOT_ASSIGNED', 'La variedad no está asignada al carrito.');
    const available = stock.rows[0].delivered_units + stock.rows[0].resupplied_units
      - stock.rows[0].sold - stock.rows[0].returned_units - stock.rows[0].waste_units;
    if (input.quantityUnitsEquivalent > available) throw new DataIntegrityError('INSUFFICIENT_SHIFT_STOCK', 'La venta supera el stock disponible del turno.', 409);

    const sale: SaleTransaction = {
      id: input.id, shiftId: input.shiftId, sellerId: shift.seller_id, sellerName: shift.seller_name,
      timestamp: new Date(input.timestamp).toISOString(), itemType: input.itemType,
      varietyId: input.varietyId, varietyName: validation.varietyName!,
      quantityUnitsEquivalent: input.quantityUnitsEquivalent, totalAmount: input.totalAmount,
      paymentMethod: input.paymentMethod, locationName: input.locationName, beachSector: input.beachSector,
      voucherPhotoUrl: input.voucherPhotoUrl, voucherExtractedData: input.voucherExtractedData,
      gpsLocation: input.gpsLocation, isOfflineCreated: input.isOfflineCreated === true,
      // Sólo un flujo bancario del servidor puede cambiar una venta digital a validada.
      validationStatus: input.paymentMethod === 'efectivo' ? 'validada' : 'pendiente_revision'
    };
    await client.query(`
      INSERT INTO sales (id, shift_id, seller_id, seller_name, timestamp, item_type,
        variety_id, variety_name, quantity_units_equivalent, total_amount,
        payment_method, location_name, beach_sector, voucher_photo_url, voucher_extracted_data,
        validation_status, mp_api_verification, gps_location, is_offline_created)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NULL,$17,$18)
    `, [sale.id, sale.shiftId, sale.sellerId, sale.sellerName, sale.timestamp, sale.itemType,
      sale.varietyId, sale.varietyName, sale.quantityUnitsEquivalent, sale.totalAmount,
      sale.paymentMethod, sale.locationName ?? null, sale.beachSector ?? null,
      sale.voucherPhotoUrl ?? null, JSON.stringify(sale.voucherExtractedData ?? null),
      sale.validationStatus, JSON.stringify(sale.gpsLocation ?? null), sale.isOfflineCreated]);
    await client.query(`UPDATE shift_stock_items SET sold_units = $3,
      difference_units = delivered_units + resupplied_units - $3 - returned_units - waste_units
      WHERE shift_id = $1 AND variety_id = $2`, [sale.shiftId, sale.varietyId, stock.rows[0].sold + sale.quantityUnitsEquivalent]);
    await client.query(`UPDATE daily_shifts SET
      total_gross_sales = total_gross_sales + $2, total_units_sold = total_units_sold + $3,
      total_cash_sales = total_cash_sales + CASE WHEN $4 = 'efectivo' THEN $2 ELSE 0 END,
      cash_expected = cash_expected + CASE WHEN $4 = 'efectivo' THEN $2 ELSE 0 END,
      total_mp_sales = total_mp_sales + CASE WHEN $4 = 'mercado_pago' THEN $2 ELSE 0 END,
      total_transfer_sales = total_transfer_sales + CASE WHEN $4 = 'transferencia' THEN $2 ELSE 0 END,
      mp_pending_or_suspicious_amount = mp_pending_or_suspicious_amount + CASE WHEN $4 != 'efectivo' THEN $2 ELSE 0 END,
      updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [sale.shiftId, sale.totalAmount, sale.quantityUnitsEquivalent, sale.paymentMethod]);
    return { sale, inserted: true };
  }

  /** Evidencia bancaria y nombres derivados no forman parte del payload que el cliente controla. */
  private identity(sale: SaleTransaction): string {
    return JSON.stringify([sale.id, sale.shiftId, sale.sellerId,
      new Date(sale.timestamp).toISOString(), sale.itemType, sale.varietyId,
      sale.quantityUnitsEquivalent, sale.totalAmount, sale.paymentMethod,
      sale.locationName ?? null, sale.beachSector ?? null, sale.voucherPhotoUrl ?? null,
      this.canonicalJson(sale.voucherExtractedData ?? null), this.canonicalJson(sale.gpsLocation ?? null),
      sale.isOfflineCreated === true]);
  }

  private canonicalJson(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((entry) => this.canonicalJson(entry));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, this.canonicalJson(entry)]));
    }
    return value;
  }
}

export const saleRepository = new SaleRepository();
