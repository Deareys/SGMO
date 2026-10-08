/**
 * SGMO — Tequeños Costa
 * Core Domain: Reglas de Liquidación y Arqueo Salarial
 *
 * Módulo puro de dominio.
 * Define la fórmula maestra para el cobro final del vendedor al cierre de jornada
 * e implementa la política escalonada de penalización por merma / faltante injustificado.
 */

export interface WastePenaltyTiers {
  thresholdUnits: number; // x: cantidad máxima tolerada / justificada (ej: 3 tequeños)
  rateBelowOrEqual: number; // $xxxxx: costo unitario si <= x (ej: 500 o 0)
  rateAbove: number; // $yyyyy: costo unitario si > x (precio combo / penalización completa, ej: 2500)
}

export interface WasteDeductionBreakdown {
  totalUnits: number;
  toleratedUnits: number;
  toleratedRate: number;
  toleratedAmount: number;
  excessUnits: number;
  excessRate: number;
  excessAmount: number;
  totalDeduction: number;
}

export interface SettlementCalculationInput {
  totalSalesAmount: number;
  grossCommission: number;
  housingDeductionOverride?: number;
  isHousingExempt?: boolean;
  missingUnitsCount: number;
  missingUnitPenaltyRate?: number; // Tarifa plana por defecto si no hay tramos (ej: $1.500)
  wastePenaltyTiers?: WastePenaltyTiers; // Política escalonada configurada por Administrador
  cashExpected: number;
  cashHandedIn: number;
}

export interface SettlementCalculationResult {
  totalSalesAmount: number;
  grossCommission: number;
  housingDeduction: number;
  missingUnitsPenalty: number;
  missingUnitsCount: number;
  wasteDeductionBreakdown?: WasteDeductionBreakdown;
  cashShortfall: number;
  totalDeductions: number;
  finalPayoutAmount: number;
}

export const DEFAULT_HOUSING_DAILY_DEDUCTION = 8000;
export const DEFAULT_MISSING_UNIT_PENALTY = 1500;

/**
 * Calcula el desglose escalonado de deducción por merma y faltante de tequeños:
 * - Unidades <= x (toleradas / justificadas): tarifa $xxxxx
 * - Unidades > x (injustificadas / exceso): tarifa $yyyyy (precio combo)
 */
export function calculateWasteDeduction(
  missingOrWasteUnits: number,
  tiers?: WastePenaltyTiers,
  fallbackRate: number = DEFAULT_MISSING_UNIT_PENALTY
): WasteDeductionBreakdown {
  const total = Math.max(0, missingOrWasteUnits || 0);

  if (!tiers || tiers.thresholdUnits === undefined) {
    const flatDeduction = total * fallbackRate;
    return {
      totalUnits: total,
      toleratedUnits: total,
      toleratedRate: fallbackRate,
      toleratedAmount: flatDeduction,
      excessUnits: 0,
      excessRate: 0,
      excessAmount: 0,
      totalDeduction: flatDeduction
    };
  }

  const threshold = Math.max(0, tiers.thresholdUnits);
  const rateBelow = Math.max(0, tiers.rateBelowOrEqual ?? fallbackRate);
  const rateAbove = Math.max(0, tiers.rateAbove ?? fallbackRate);

  if (total <= threshold) {
    const toleratedAmount = total * rateBelow;
    return {
      totalUnits: total,
      toleratedUnits: total,
      toleratedRate: rateBelow,
      toleratedAmount,
      excessUnits: 0,
      excessRate: rateAbove,
      excessAmount: 0,
      totalDeduction: toleratedAmount
    };
  } else {
    const toleratedUnits = threshold;
    const toleratedAmount = toleratedUnits * rateBelow;
    const excessUnits = total - threshold;
    const excessAmount = excessUnits * rateAbove;
    return {
      totalUnits: total,
      toleratedUnits,
      toleratedRate: rateBelow,
      toleratedAmount,
      excessUnits,
      excessRate: rateAbove,
      excessAmount,
      totalDeduction: toleratedAmount + excessAmount
    };
  }
}

/**
 * Calcula la liquidación final que cobra el vendedor en mano.
 *
 * Fórmula:
 * Pago Final = Comisión Bruta - Deducción Vivienda - Penalización Faltantes/Merma - Faltante de Caja
 */
export function calculateSettlement(
  input: SettlementCalculationInput
): SettlementCalculationResult {
  const {
    totalSalesAmount,
    grossCommission,
    housingDeductionOverride,
    isHousingExempt,
    missingUnitsCount,
    missingUnitPenaltyRate = DEFAULT_MISSING_UNIT_PENALTY,
    wastePenaltyTiers,
    cashExpected,
    cashHandedIn
  } = input;

  // 1. Deducción de vivienda
  let housingDeduction = 0;
  if (!isHousingExempt) {
    housingDeduction =
      typeof housingDeductionOverride === 'number'
        ? housingDeductionOverride
        : DEFAULT_HOUSING_DAILY_DEDUCTION;
  }

  // 2. Penalización por tequeños faltantes / merma injustificada (escalonada o plana)
  let missingUnitsPenalty = 0;
  let wasteBreakdown: WasteDeductionBreakdown | undefined;

  if (wastePenaltyTiers && wastePenaltyTiers.thresholdUnits !== undefined) {
    wasteBreakdown = calculateWasteDeduction(missingUnitsCount, wastePenaltyTiers, missingUnitPenaltyRate);
    missingUnitsPenalty = wasteBreakdown.totalDeduction;
  } else {
    missingUnitsPenalty = Math.max(0, missingUnitsCount) * missingUnitPenaltyRate;
  }

  // 3. Faltante de efectivo en riñonera
  const cashDifference = cashHandedIn - cashExpected;
  const cashShortfall = cashDifference < 0 ? Math.abs(cashDifference) : 0;

  // 4. Total de deducciones
  const totalDeductions = housingDeduction + missingUnitsPenalty + cashShortfall;

  // 5. Pago neto final (no puede ser inferior a 0 en el comprobante diario)
  const finalPayoutAmount = Math.max(0, grossCommission - totalDeductions);

  return {
    totalSalesAmount,
    grossCommission,
    housingDeduction,
    missingUnitsPenalty,
    missingUnitsCount,
    wasteDeductionBreakdown: wasteBreakdown,
    cashShortfall,
    totalDeductions,
    finalPayoutAmount
  };
}
