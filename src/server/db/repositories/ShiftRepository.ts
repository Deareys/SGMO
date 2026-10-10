/**
 * SGMO — Tequeños Costa
 * PostgreSQL Repository: Daily Shifts & Shift Stock Items
 */

import { query, withTransaction } from '../connection';
import { DailyShift, ShiftStockItem, ShiftStatus } from '../../../types';

export class ShiftRepository {
  async getAll(): Promise<DailyShift[]> {
    const shiftsRes = await query(`
      SELECT 
        s.id, s.date::text, s.house_id as "houseId", s.house_name as "houseName",
        s.coordinator_id as "coordinatorId", s.coordinator_name as "coordinatorName",
        s.seller_id as "sellerId", s.seller_name as "sellerName",
        s.cart_id as "cartId", s.cart_code as "cartCode",
        s.zone_id as "zoneId", s.zone_name as "zoneName",
        s.status, s.supplies_provided as "suppliesProvided",
        s.start_time as "startTime", s.end_time as "endTime",
        s.total_gross_sales::float as "totalGrossSales",
        s.total_cash_sales::float as "totalCashSales",
        s.total_mp_sales::float as "totalMpSales",
        s.total_transfer_sales::float as "totalTransferSales",
        s.season,
        s.cash_expected::float as "cashExpected",
        s.cash_declared::float as "cashDeclared",
        s.cash_difference::float as "cashDifference",
        s.mp_validated_amount::float as "mpValidatedAmount",
        s.mp_pending_or_suspicious_amount::float as "mpPendingOrSuspiciousAmount",
        s.total_units_delivered as "totalUnitsDelivered",
        s.total_units_restocked as "totalUnitsRestocked",
        s.total_units_sold as "totalUnitsSold",
        s.total_units_returned as "totalUnitsReturned",
        s.total_units_waste as "totalUnitsWaste",
        s.total_units_difference as "totalUnitsDifference",
        s.commission_rate::float as "commissionRate",
        s.applied_commission_tier_id as "appliedCommissionTierId",
        s.applied_commission_tier_name as "appliedCommissionTierName",
        s.gross_commission::float as "grossCommission",
        s.housing_cost_deduction::float as "housingCostDeduction",
        s.housing_cost_exempt as "housingCostExempt",
        s.deductions_for_missing_units::float as "deductionsForMissingUnits",
        s.waste_deduction_breakdown as "wasteDeductionBreakdown",
        s.incentives_or_bonuses::float as "incentivesOrBonuses",
        s.final_payout_amount::float as "finalPayoutAmount",
        s.payout_status as "payoutStatus",
        s.payout_timestamp as "payoutTimestamp",
        s.payout_payment_proof as "payoutPaymentProof",
        s.notes, s.coordinator_signature as "coordinatorSignature"
      FROM daily_shifts s
      ORDER BY s.date DESC, s.start_time DESC
    `);

    const shifts: DailyShift[] = [];
    for (const row of shiftsRes.rows) {
      const stockRes = await query(`
        SELECT 
          variety_id as "varietyId", variety_name as "varietyName",
          delivered_units as "deliveredUnits", resupplied_units as "reSuppliedUnits",
          sold_units as "soldUnits", returned_units as "returnedUnits",
          waste_units as "wasteUnits", difference_units as "differenceUnits"
        FROM shift_stock_items
        WHERE shift_id = $1
      `, [row.id]);

      shifts.push({
        ...row,
        stockItems: stockRes.rows
      });
    }

    return shifts;
  }

  async getActiveForUser(userId: string): Promise<DailyShift | null> {
    const res = await query(`
      SELECT id FROM daily_shifts
      WHERE seller_id = $1 AND status IN ('en_curso', 'planificada')
      ORDER BY start_time DESC
      LIMIT 1
    `, [userId]);

    if (res.rows.length === 0) return null;
    return this.getById(res.rows[0].id);
  }

  async getById(id: string): Promise<DailyShift | null> {
    const shiftRes = await query(`
      SELECT 
        s.id, s.date::text, s.house_id as "houseId", s.house_name as "houseName",
        s.coordinator_id as "coordinatorId", s.coordinator_name as "coordinatorName",
        s.seller_id as "sellerId", s.seller_name as "sellerName",
        s.cart_id as "cartId", s.cart_code as "cartCode",
        s.zone_id as "zoneId", s.zone_name as "zoneName",
        s.status, s.supplies_provided as "suppliesProvided",
        s.start_time as "startTime", s.end_time as "endTime",
        s.total_gross_sales::float as "totalGrossSales",
        s.total_cash_sales::float as "totalCashSales",
        s.total_mp_sales::float as "totalMpSales",
        s.total_transfer_sales::float as "totalTransferSales",
        s.season,
        s.cash_expected::float as "cashExpected",
        s.cash_declared::float as "cashDeclared",
        s.cash_difference::float as "cashDifference",
        s.mp_validated_amount::float as "mpValidatedAmount",
        s.mp_pending_or_suspicious_amount::float as "mpPendingOrSuspiciousAmount",
        s.total_units_delivered as "totalUnitsDelivered",
        s.total_units_restocked as "totalUnitsRestocked",
        s.total_units_sold as "totalUnitsSold",
        s.total_units_returned as "totalUnitsReturned",
        s.total_units_waste as "totalUnitsWaste",
        s.total_units_difference as "totalUnitsDifference",
        s.commission_rate::float as "commissionRate",
        s.applied_commission_tier_id as "appliedCommissionTierId",
        s.applied_commission_tier_name as "appliedCommissionTierName",
        s.gross_commission::float as "grossCommission",
        s.housing_cost_deduction::float as "housingCostDeduction",
        s.housing_cost_exempt as "housingCostExempt",
        s.deductions_for_missing_units::float as "deductionsForMissingUnits",
        s.waste_deduction_breakdown as "wasteDeductionBreakdown",
        s.incentives_or_bonuses::float as "incentivesOrBonuses",
        s.final_payout_amount::float as "finalPayoutAmount",
        s.payout_status as "payoutStatus",
        s.payout_timestamp as "payoutTimestamp",
        s.payout_payment_proof as "payoutPaymentProof",
        s.notes, s.coordinator_signature as "coordinatorSignature"
      FROM daily_shifts s
      WHERE s.id = $1
    `, [id]);

    if (shiftRes.rows.length === 0) return null;
    const shift = shiftRes.rows[0];

    const stockRes = await query(`
      SELECT 
        variety_id as "varietyId", variety_name as "varietyName",
        delivered_units as "deliveredUnits", resupplied_units as "reSuppliedUnits",
        sold_units as "soldUnits", returned_units as "returnedUnits",
        waste_units as "wasteUnits", difference_units as "differenceUnits"
      FROM shift_stock_items
      WHERE shift_id = $1
    `, [id]);

    return {
      ...shift,
      stockItems: stockRes.rows
    };
  }

  async createShift(shift: DailyShift): Promise<DailyShift> {
    return withTransaction(async (client) => {
      await client.query(`
        INSERT INTO daily_shifts (
          id, date, house_id, house_name, coordinator_id, coordinator_name,
          seller_id, seller_name, cart_id, cart_code, zone_id, zone_name,
          status, supplies_provided, start_time,
          total_units_delivered, commission_rate
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        )
      `, [
        shift.id,
        shift.date,
        shift.houseId,
        shift.houseName,
        shift.coordinatorId,
        shift.coordinatorName,
        shift.sellerId,
        shift.sellerName,
        shift.cartId,
        shift.cartCode,
        shift.zoneId,
        shift.zoneName,
        shift.status,
        JSON.stringify(shift.suppliesProvided || {}),
        shift.startTime,
        shift.totalUnitsDelivered,
        shift.commissionRate
      ]);

      if (Array.isArray(shift.stockItems)) {
        for (const item of shift.stockItems) {
          await client.query(`
            INSERT INTO shift_stock_items (
              id, shift_id, variety_id, variety_name,
              delivered_units, resupplied_units, sold_units,
              returned_units, waste_units, difference_units
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
            )
            ON CONFLICT (shift_id, variety_id) DO UPDATE SET
              delivered_units = EXCLUDED.delivered_units
          `, [
            `STK-${shift.id}-${item.varietyId}`,
            shift.id,
            item.varietyId,
            item.varietyName,
            item.deliveredUnits,
            item.reSuppliedUnits || 0,
            item.soldUnits || 0,
            item.returnedUnits || 0,
            item.wasteUnits || 0,
            item.differenceUnits || 0
          ]);
        }
      }

      return shift;
    });
  }

  async closeAndReconcileShift(shiftId: string, closingData: Partial<DailyShift>): Promise<void> {
    await withTransaction(async (client) => {
      await client.query(`
        UPDATE daily_shifts
        SET 
          status = 'conciliada',
          end_time = $2,
          cash_declared = $3,
          cash_difference = $4,
          cash_expected = $5,
          total_gross_sales = $6,
          total_cash_sales = $7,
          total_mp_sales = $8,
          mp_validated_amount = $9,
          mp_pending_or_suspicious_amount = $10,
          total_units_sold = $11,
          total_units_returned = $12,
          total_units_waste = $13,
          total_units_difference = $14,
          gross_commission = $15,
          housing_cost_deduction = $16,
          deductions_for_missing_units = $17,
          waste_deduction_breakdown = $18,
          incentives_or_bonuses = $19,
          final_payout_amount = $20,
          notes = $21,
          coordinator_signature = $22,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [
        shiftId,
        closingData.endTime || new Date().toISOString(),
        closingData.cashDeclared || 0,
        closingData.cashDifference || 0,
        closingData.cashExpected || 0,
        closingData.totalGrossSales || 0,
        closingData.totalCashSales || 0,
        closingData.totalMpSales || 0,
        closingData.mpValidatedAmount || 0,
        closingData.mpPendingOrSuspiciousAmount || 0,
        closingData.totalUnitsSold || 0,
        closingData.totalUnitsReturned || 0,
        closingData.totalUnitsWaste || 0,
        closingData.totalUnitsDifference || 0,
        closingData.grossCommission || 0,
        closingData.housingCostDeduction || 0,
        closingData.deductionsForMissingUnits || 0,
        JSON.stringify(closingData.wasteDeductionBreakdown || null),
        closingData.incentivesOrBonuses || 0,
        closingData.finalPayoutAmount || 0,
        closingData.notes || null,
        closingData.coordinatorSignature || null
      ]);

      if (Array.isArray(closingData.stockItems)) {
        for (const item of closingData.stockItems) {
          await client.query(`
            UPDATE shift_stock_items
            SET 
              sold_units = $3,
              returned_units = $4,
              waste_units = $5,
              difference_units = $6
            WHERE shift_id = $1 AND variety_id = $2
          `, [
            shiftId,
            item.varietyId,
            item.soldUnits,
            item.returnedUnits,
            item.wasteUnits,
            item.differenceUnits
          ]);
        }
      }
    });
  }
}

export const shiftRepository = new ShiftRepository();
