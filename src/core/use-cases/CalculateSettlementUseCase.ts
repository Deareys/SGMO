/**
 * SGMO — Tequeños Costa
 * Core Use Case: Calcular Liquidación y Cierre Económico de Jornada
 *
 * Aplica las reglas del dominio de comisiones y deducciones sobre las ventas y arqueo físico.
 */

import { IStorageRepository } from '../ports';
import { calculateCommissionForSales } from '../domain/commissionRules';
import { calculateInventoryBalance } from '../domain/inventoryRules';
import {
  calculateSettlement,
  SettlementCalculationResult
} from '../domain/settlementRules';
import { DailyShift } from '../domain/types';

export interface CalculateSettlementRequest {
  shiftId: string;
  sellerId: string;
  cashHandedIn: number;
  returnedUnits: Record<string, number>;
}

export interface DetailedSettlementResult extends SettlementCalculationResult {
  totalSalesUnits: number;
  totalCashSales: number;
  totalDigitalSales: number;
  commissionRate: number;
  commissionTierName: string;
  inventoryDifference: number;
  hasMissingUnits: boolean;
}

export class CalculateSettlementUseCase {
  constructor(private storageRepo: IStorageRepository) {}

  execute(request: CalculateSettlementRequest): DetailedSettlementResult {
    const { shiftId, sellerId, cashHandedIn, returnedUnits } = request;

    // 1. Obtener jornada, ventas y mermas
    const shifts: DailyShift[] = this.storageRepo.getShifts();
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) {
      throw new Error(`Jornada no encontrada con ID: ${shiftId}`);
    }

    const user = this.storageRepo.getUsers().find((u) => u.id === sellerId);
    const sales = this.storageRepo.getSalesForShift(shiftId);
    const wastes = this.storageRepo.getWasteRecords(shiftId);
    const tiers = this.storageRepo.getCommissionTiers();
    const config = this.storageRepo.getSystemConfig();

    // 2. Acumuladores de venta
    let totalSalesAmount = 0;
    let totalCashSales = 0;
    let totalDigitalSales = 0;
    let totalSalesUnits = 0;

    for (const sale of sales) {
      totalSalesAmount += sale.totalAmount;
      totalSalesUnits += sale.quantityUnitsEquivalent;
      if (sale.paymentMethod === 'efectivo') {
        totalCashSales += sale.totalAmount;
      } else {
        totalDigitalSales += sale.totalAmount;
      }
    }

    // 3. Balance de inventario
    let initialUnitsTotal = 0;
    if (shift.stockItems && Array.isArray(shift.stockItems)) {
      for (const item of shift.stockItems) {
        initialUnitsTotal += (item.deliveredUnits || 0) + (item.reSuppliedUnits || 0);
      }
    }

    let returnedUnitsTotal = 0;
    for (const count of Object.values(returnedUnits || {})) {
      returnedUnitsTotal += Number(count) || 0;
    }

    let wasteUnitsTotal = 0;
    for (const w of wastes) {
      wasteUnitsTotal += Number(w.quantity) || 0;
    }

    const inventoryBalance = calculateInventoryBalance({
      initialStock: initialUnitsTotal,
      restockedUnits: 0,
      recordedSoldUnits: totalSalesUnits,
      returnedUnits: returnedUnitsTotal,
      wasteUnits: wasteUnitsTotal
    });

    // 4. Cálculo de comisión escalonada
    const commissionCalc = calculateCommissionForSales(
      totalSalesAmount,
      tiers,
      user?.commissionRate ?? config.defaultCommissionRate ?? 0.20
    );

    // 5. Liquidación económica final
    const settlement = calculateSettlement({
      totalSalesAmount,
      grossCommission: commissionCalc.grossCommission,
      housingDeductionOverride: user?.housingCostOverride,
      housingCostPerPersonDaily: config.housingCostPerPersonDaily,
      isHousingExempt: user?.housingCostExempt,
      incentivesOrBonuses: shift.incentivesOrBonuses ?? 0,
      missingUnitsCount: inventoryBalance.missingUnitsCount,
      missingUnitPenaltyRate: config.deductionRatePerMissingUnit,
      wastePenaltyTiers: config.wasteToleranceThreshold === undefined ? undefined : {
        thresholdUnits:config.wasteToleranceThreshold,rateBelowOrEqual:config.wastePenaltyRateBelowOrEqual ?? 500,
        rateAbove:config.wastePenaltyRateAbove ?? 2500 },
      cashExpected: totalCashSales,
      cashHandedIn
    });

    return {
      ...settlement,
      totalSalesUnits,
      totalCashSales,
      totalDigitalSales,
      commissionRate: commissionCalc.rate,
      commissionTierName: commissionCalc.tierName,
      inventoryDifference: inventoryBalance.differenceUnits,
      hasMissingUnits: inventoryBalance.hasMissingUnits
    };
  }
}
