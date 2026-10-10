/**
 * SGMO — Tequeños Costa
 * PostgreSQL Repository: Stock, Waste & Restocks
 */

import { query, withTransaction } from '../connection';
import { ShiftWasteRecord, ShiftRestockRecord, ShiftStockItem } from '../../../types';

export class StockRepository {
  async recordWaste(record: ShiftWasteRecord): Promise<ShiftWasteRecord> {
    return withTransaction(async (client) => {
      await client.query(`
        INSERT INTO shift_waste_records (
          id, shift_id, timestamp, seller_id, seller_name,
          variety_id, variety_name, quantity, reason, reason_label, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        )
      `, [
        record.id,
        record.shiftId,
        record.timestamp,
        record.sellerId,
        record.sellerName,
        record.varietyId,
        record.varietyName,
        record.quantity,
        record.reason,
        record.reasonLabel,
        record.notes || null
      ]);

      // Actualizar el conteo de merma en el stock del turno
      await client.query(`
        UPDATE shift_stock_items
        SET 
          waste_units = waste_units + $3,
          difference_units = (delivered_units + resupplied_units) - sold_units - returned_units - (waste_units + $3)
        WHERE shift_id = $1 AND variety_id = $2
      `, [record.shiftId, record.varietyId, record.quantity]);

      // Actualizar total de merma en la jornada
      await client.query(`
        UPDATE daily_shifts
        SET total_units_waste = total_units_waste + $2
        WHERE id = $1
      `, [record.shiftId, record.quantity]);

      return record;
    });
  }

  async recordRestock(record: ShiftRestockRecord): Promise<ShiftRestockRecord> {
    return withTransaction(async (client) => {
      await client.query(`
        INSERT INTO shift_restock_records (
          id, shift_id, timestamp, seller_id, seller_name,
          coordinator_id, coordinator_name, variety_id, variety_name,
          quantity, origin_location, destination_location, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        )
      `, [
        record.id,
        record.shiftId,
        record.timestamp,
        record.sellerId,
        record.sellerName,
        record.coordinatorId,
        record.coordinatorName,
        record.varietyId,
        record.varietyName,
        record.quantity,
        record.originLocation,
        record.destinationLocation,
        record.notes || null
      ]);

      // Actualizar resupplied_units en shift_stock_items
      await client.query(`
        UPDATE shift_stock_items
        SET 
          resupplied_units = resupplied_units + $3,
          difference_units = (delivered_units + (resupplied_units + $3)) - sold_units - returned_units - waste_units
        WHERE shift_id = $1 AND variety_id = $2
      `, [record.shiftId, record.varietyId, record.quantity]);

      // Actualizar total en daily_shifts
      await client.query(`
        UPDATE daily_shifts
        SET total_units_restocked = total_units_restocked + $2
        WHERE id = $1
      `, [record.shiftId, record.quantity]);

      return record;
    });
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
