/**
 * SGMO — Tequeños Costa
 * PostgreSQL Repository: Sales Transactions & Batch Sync
 */

import { query, withTransaction } from '../connection';
import { SaleTransaction } from '../../../types';

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
        validation_status as "validationStatus",
        mp_api_verification as "mpApiVerification",
        gps_location as "gpsLocation",
        is_offline_created as "isOfflineCreated"
      FROM sales
      ORDER BY timestamp DESC
    `);
    return res.rows;
  }

  async getByShiftId(shiftId: string): Promise<SaleTransaction[]> {
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
        validation_status as "validationStatus",
        mp_api_verification as "mpApiVerification",
        gps_location as "gpsLocation",
        is_offline_created as "isOfflineCreated"
      FROM sales
      WHERE shift_id = $1
      ORDER BY timestamp ASC
    `, [shiftId]);
    return res.rows;
  }

  async createSale(sale: SaleTransaction): Promise<SaleTransaction> {
    await query(`
      INSERT INTO sales (
        id, shift_id, seller_id, seller_name, timestamp, item_type,
        variety_id, variety_name, quantity_units_equivalent, total_amount,
        payment_method, location_name, beach_sector, voucher_photo_url,
        voucher_extracted_data, validation_status, mp_api_verification,
        gps_location, is_offline_created
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
      ON CONFLICT (id) DO UPDATE SET
        validation_status = EXCLUDED.validation_status,
        mp_api_verification = EXCLUDED.mp_api_verification,
        voucher_extracted_data = EXCLUDED.voucher_extracted_data
    `, [
      sale.id,
      sale.shiftId,
      sale.sellerId,
      sale.sellerName,
      sale.timestamp,
      sale.itemType,
      sale.varietyId,
      sale.varietyName,
      sale.quantityUnitsEquivalent,
      sale.totalAmount,
      sale.paymentMethod,
      sale.locationName || null,
      sale.beachSector || null,
      sale.voucherPhotoUrl || null,
      JSON.stringify(sale.voucherExtractedData || null),
      sale.validationStatus,
      JSON.stringify(sale.mpApiVerification || null),
      JSON.stringify(sale.gpsLocation || null),
      sale.isOfflineCreated || false
    ]);

    return sale;
  }

  /**
   * Sincroniza un lote de ventas de forma idempotente y atómica.
   * Si una venta ya existe por ID, actualiza su estado de validación si corresponde.
   */
  async syncBatch(sales: SaleTransaction[]): Promise<{ inserted: number; updated: number }> {
    if (!sales || sales.length === 0) {
      return { inserted: 0, updated: 0 };
    }

    return withTransaction(async (client) => {
      let inserted = 0;
      let updated = 0;

      for (const sale of sales) {
        const checkRes = await client.query('SELECT id FROM sales WHERE id = $1', [sale.id]);
        if (checkRes.rows.length === 0) {
          await client.query(`
            INSERT INTO sales (
              id, shift_id, seller_id, seller_name, timestamp, item_type,
              variety_id, variety_name, quantity_units_equivalent, total_amount,
              payment_method, location_name, beach_sector, voucher_photo_url,
              voucher_extracted_data, validation_status, mp_api_verification,
              gps_location, is_offline_created
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
            )
          `, [
            sale.id,
            sale.shiftId,
            sale.sellerId,
            sale.sellerName,
            sale.timestamp,
            sale.itemType,
            sale.varietyId,
            sale.varietyName,
            sale.quantityUnitsEquivalent,
            sale.totalAmount,
            sale.paymentMethod,
            sale.locationName || null,
            sale.beachSector || null,
            sale.voucherPhotoUrl || null,
            JSON.stringify(sale.voucherExtractedData || null),
            sale.validationStatus,
            JSON.stringify(sale.mpApiVerification || null),
            JSON.stringify(sale.gpsLocation || null),
            sale.isOfflineCreated || false
          ]);
          inserted++;
        } else {
          await client.query(`
            UPDATE sales
            SET 
              validation_status = $2,
              mp_api_verification = $3
            WHERE id = $1
          `, [
            sale.id,
            sale.validationStatus,
            JSON.stringify(sale.mpApiVerification || null)
          ]);
          updated++;
        }
      }

      return { inserted, updated };
    });
  }
}

export const saleRepository = new SaleRepository();
