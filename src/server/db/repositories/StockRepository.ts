/**
 * SGMO — Tequeños Costa
 * PostgreSQL Repository: Stock, Waste & Restocks
 */

import { query, withTransaction } from '../connection.js';
import { ShiftWasteRecord, ShiftRestockRecord, ShiftStockItem } from '../../../types';
import type { PoolClient } from 'pg';
import { randomUUID } from 'crypto';
import { assertOperationId, assertOperationQuantity, assertShiftMutationAccess, DataIntegrityError, type OperationActor } from '../salesValidation.js';

export class StockRepository {
  /** Idempotencia incluye el registro y sus contadores; reintentar no suma merma dos veces. */
  async recordWaste(input: ShiftWasteRecord, actor?: OperationActor): Promise<ShiftWasteRecord> {
    this.validateRecord(input);
    const labels: Record<string, string> = { producto_danado: 'Producto dañado', producto_caido: 'Producto caído',
      producto_quemado: 'Producto quemado', producto_descongelado: 'Producto descongelado', producto_descartado: 'Producto descartado', otro: 'Otro motivo' };
    if (!Object.hasOwn(labels, input.reason)) throw new DataIntegrityError('INVALID_WASTE_REASON', 'Motivo de merma inválido.');
    return withTransaction(async (client) => {
      const shift = await this.lockShift(client,input.shiftId,actor);
      await client.query("SELECT pg_advisory_xact_lock(hashtext('sgmo.waste.' || $1))", [input.id]);
      const existing = await client.query('SELECT * FROM shift_waste_records WHERE id=$1', [input.id]);
      if (existing.rows.length) {
        const stored = existing.rows[0];
        if (stored.shift_id !== input.shiftId || stored.variety_id !== input.varietyId || stored.quantity !== input.quantity
            || stored.reason !== input.reason || (stored.notes ?? null) !== (input.notes ?? null)
            || new Date(stored.timestamp).toISOString() !== new Date(input.timestamp).toISOString()) {
          throw new DataIntegrityError('IDEMPOTENCY_CONFLICT', 'El ID de merma ya tiene otro contenido.', 409);
        }
        return this.wasteRecord(stored);
      }
      if (shift.status !== 'en_curso') throw new DataIntegrityError('SHIFT_NOT_ACTIVE', 'La jornada ya no admite nuevas mermas.', 409);
      const stock = await this.stockForMutation(client,input.shiftId,input.varietyId);
      const available = stock.delivered_units + stock.resupplied_units - stock.sold - stock.returned_units - stock.waste_units;
      if (input.quantity > available) throw new DataIntegrityError('INSUFFICIENT_SHIFT_STOCK', 'La merma supera el stock disponible.', 409);
      const record: ShiftWasteRecord = { id:input.id,shiftId:input.shiftId,timestamp:new Date(input.timestamp).toISOString(),
        sellerId:shift.seller_id,sellerName:shift.seller_name,varietyId:input.varietyId,varietyName:stock.variety_name,
        quantity:input.quantity,reason:input.reason,reasonLabel:labels[input.reason],notes:input.notes };
      await client.query(`INSERT INTO shift_waste_records
        (id,shift_id,timestamp,seller_id,seller_name,variety_id,variety_name,quantity,reason,reason_label,notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [record.id,record.shiftId,record.timestamp,record.sellerId,
        record.sellerName,record.varietyId,record.varietyName,record.quantity,record.reason,record.reasonLabel,record.notes ?? null]);
      await client.query(`UPDATE shift_stock_items SET waste_units=waste_units+$3,
        difference_units=delivered_units+resupplied_units-$4-returned_units-waste_units-$3
        WHERE shift_id=$1 AND variety_id=$2`, [record.shiftId,record.varietyId,record.quantity,stock.sold]);
      await client.query('UPDATE daily_shifts SET total_units_waste=total_units_waste+$2 WHERE id=$1', [record.shiftId,record.quantity]);
      return record;
    });
  }

  async recordRestock(record: ShiftRestockRecord, actor?: OperationActor): Promise<ShiftRestockRecord> {
    return (await this.recordRestockBatch([record],actor))[0];
  }

  /** Varias variedades se despachan juntas o ninguna; saldo de casa se debita sólo una vez. */
  async recordRestockBatch(records: ShiftRestockRecord[], actor?: OperationActor): Promise<ShiftRestockRecord[]> {
    if (!Array.isArray(records) || !records.length || records.length > 100) throw new DataIntegrityError('INVALID_RESTOCK_BATCH', 'Reposición inválida.');
    for (const record of records) this.validateRecord(record);
    if (new Set(records.map((record) => record.shiftId)).size !== 1) throw new DataIntegrityError('INVALID_RESTOCK_BATCH', 'Una reposición corresponde a una única jornada.');
    return withTransaction(async (client) => {
      const shift = await this.lockShift(client,records[0].shiftId,actor);
      await client.query('SELECT id FROM operational_houses WHERE id=$1 FOR UPDATE', [shift.house_id]);
      const result: ShiftRestockRecord[] = [];
      for (const input of [...records].sort((left,right) => left.id.localeCompare(right.id))) {
        await client.query("SELECT pg_advisory_xact_lock(hashtext('sgmo.restock.' || $1))", [input.id]);
        const existing = await client.query('SELECT * FROM shift_restock_records WHERE id=$1', [input.id]);
        if (existing.rows.length) {
          const stored = existing.rows[0];
          if (stored.shift_id !== input.shiftId || stored.variety_id !== input.varietyId || stored.quantity !== input.quantity
              || (stored.notes ?? null) !== (input.notes ?? null)
              || new Date(stored.timestamp).toISOString() !== new Date(input.timestamp).toISOString()) {
            throw new DataIntegrityError('IDEMPOTENCY_CONFLICT', 'El ID de reposición ya tiene otro contenido.', 409);
          }
          result.push(this.restockRecord(stored)); continue;
        }
        if (shift.status !== 'en_curso') throw new DataIntegrityError('SHIFT_NOT_ACTIVE', 'La jornada ya no admite reposiciones.', 409);
        const variety = await client.query('SELECT name,is_active FROM product_varieties WHERE id=$1 FOR SHARE', [input.varietyId]);
        if (!variety.rows[0]?.is_active) throw new DataIntegrityError('INVALID_VARIETY', 'Variedad no disponible.');
        const houseStock = await client.query(`UPDATE house_stock SET units=units-$3
          WHERE house_id=$1 AND variety_id=$2 AND units>=$3 RETURNING units`, [shift.house_id,input.varietyId,input.quantity]);
        if (!houseStock.rows.length) throw new DataIntegrityError('INSUFFICIENT_HOUSE_STOCK', 'La casa no tiene stock suficiente para reponer.', 409);
        const record: ShiftRestockRecord = { id:input.id,shiftId:input.shiftId,timestamp:new Date(input.timestamp).toISOString(),
          varietyId:input.varietyId,quantity:input.quantity,notes:input.notes,sellerId: shift.seller_id, sellerName: shift.seller_name,
          coordinatorId: actor?.userId ?? shift.coordinator_id, coordinatorName: actor?.userName ?? shift.coordinator_name,
          varietyName: variety.rows[0].name, originLocation: shift.house_name, destinationLocation: shift.cart_code };
        await client.query(`INSERT INTO shift_restock_records
          (id,shift_id,timestamp,seller_id,seller_name,coordinator_id,coordinator_name,variety_id,variety_name,quantity,origin_location,destination_location,notes)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [record.id,record.shiftId,record.timestamp,
          record.sellerId,record.sellerName,record.coordinatorId,record.coordinatorName,record.varietyId,record.varietyName,
          record.quantity,record.originLocation,record.destinationLocation,record.notes ?? null]);
        await client.query(`INSERT INTO shift_stock_items (id,shift_id,variety_id,variety_name,resupplied_units,difference_units)
          VALUES ($1,$2,$3,$4,$5,$5) ON CONFLICT (shift_id,variety_id) DO UPDATE SET
          resupplied_units=shift_stock_items.resupplied_units+$5,difference_units=shift_stock_items.difference_units+$5`,
          [`STK-${randomUUID()}`,record.shiftId,record.varietyId,record.varietyName,record.quantity]);
        await client.query('UPDATE daily_shifts SET total_units_restocked=total_units_restocked+$2 WHERE id=$1', [record.shiftId,record.quantity]);
        result.push(record);
      }
      return result;
    });
  }

  private validateRecord(record: ShiftWasteRecord | ShiftRestockRecord): void {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new DataIntegrityError('INVALID_STOCK_RECORD', 'Registro de stock inválido.');
    assertOperationId(record.id, 'ID de registro'); assertOperationId(record.shiftId,'Jornada'); assertOperationId(record.varietyId,'Variedad');
    assertOperationQuantity(record.quantity,'Cantidad');
    if (typeof record.timestamp !== 'string' || !Number.isFinite(Date.parse(record.timestamp))) throw new DataIntegrityError('INVALID_TIMESTAMP','Fecha de registro inválida.');
    if (record.notes !== undefined && (typeof record.notes !== 'string' || record.notes.length > 2000)) throw new DataIntegrityError('INVALID_NOTES','Notas inválidas.');
  }

  private async lockShift(client: PoolClient,id: string,actor?: OperationActor): Promise<any> {
    const result = await client.query('SELECT * FROM daily_shifts WHERE id=$1 FOR UPDATE',[id]);
    if (!result.rows.length) throw new DataIntegrityError('SHIFT_NOT_FOUND','Jornada no encontrada.',404);
    assertShiftMutationAccess(result.rows[0],actor);
    if (actor && !['admin','coordinator'].includes(actor.role)) throw new DataIntegrityError('FORBIDDEN','Rol no autorizado para stock.',403);
    return result.rows[0];
  }

  private async stockForMutation(client: PoolClient,shiftId: string,varietyId: string): Promise<any> {
    const result = await client.query(`SELECT *, (SELECT COALESCE(SUM(quantity_units_equivalent),0)::int FROM sales
      WHERE shift_id=$1 AND variety_id=$2) AS sold FROM shift_stock_items WHERE shift_id=$1 AND variety_id=$2`,[shiftId,varietyId]);
    if (!result.rows.length) throw new DataIntegrityError('STOCK_NOT_ASSIGNED','Variedad no asignada al turno.');
    return result.rows[0];
  }

  private wasteRecord(row: any): ShiftWasteRecord {
    return { id: row.id,shiftId: row.shift_id,timestamp: new Date(row.timestamp).toISOString(),sellerId: row.seller_id,sellerName: row.seller_name,
      varietyId: row.variety_id,varietyName: row.variety_name,quantity: row.quantity,reason: row.reason,reasonLabel: row.reason_label,notes: row.notes ?? undefined };
  }
  private restockRecord(row: any): ShiftRestockRecord {
    return { id: row.id,shiftId: row.shift_id,timestamp: new Date(row.timestamp).toISOString(),sellerId: row.seller_id,sellerName: row.seller_name,
      coordinatorId: row.coordinator_id,coordinatorName: row.coordinator_name,varietyId: row.variety_id,varietyName: row.variety_name,
      quantity: row.quantity,originLocation: row.origin_location,destinationLocation: row.destination_location,notes: row.notes ?? undefined };
  }

  async getStockItemsForShift(shiftId: string): Promise<ShiftStockItem[]> {
    const res = await query(`
      SELECT 
        variety_id as "varietyId", variety_name as "varietyName",
        delivered_units as "deliveredUnits", resupplied_units as "reSuppliedUnits",
        sold_units as "soldUnits", returned_units as "returnedUnits",
        waste_units as "wasteUnits", difference_units as "differenceUnits"
      FROM shift_stock_items
      WHERE shift_id = $1
      ORDER BY variety_name ASC
    `, [shiftId]);

    return res.rows;
  }
}

export const stockRepository = new StockRepository();
