/**
 * SGMO — Tequeños Costa
 * Core Domain: Reglas de Inventario y Equivalencia de Stock
 *
 * Módulo puro de dominio.
 * Define la matemática de arqueo de carritos, cálculo de mermas y balance físico.
 */

export interface InventoryBalanceResult {
  initialStock: number;
  restockedUnits: number;
  totalDelivered: number;
  recordedSoldUnits: number;
  returnedUnits: number;
  wasteUnits: number;
  accountedUnits: number;
  differenceUnits: number;
  hasMissingUnits: boolean;
  missingUnitsCount: number;
}

/**
 * Calcula la equivalencia en unidades físicas para un tipo de combo.
 */
export function getUnitsEquivalentForCombo(comboType: string): number {
  switch (comboType) {
    case 'combo12':
      return 12;
    case 'combo6':
      return 6;
    case 'combo3':
      return 3;
    case 'unidad':
    default:
      return 1;
  }
}

/**
 * Realiza el balance físico de stock de tequeños para un turno.
 *
 * Fórmula:
 * Total Entregado = Stock Inicial + Reposiciones
 * Unidades Justificadas = Vendidas + Devueltas a Base + Mermas Declaradas
 * Diferencia = Unidades Justificadas - Total Entregado
 *
 * Si Diferencia < 0: Hay faltante de unidades físicas no declaradas.
 */
export function calculateInventoryBalance(params: {
  initialStock: number;
  restockedUnits: number;
  recordedSoldUnits: number;
  returnedUnits: number;
  wasteUnits: number;
}): InventoryBalanceResult {
  const initialStock = Math.max(0, params.initialStock || 0);
  const restockedUnits = Math.max(0, params.restockedUnits || 0);
  const recordedSoldUnits = Math.max(0, params.recordedSoldUnits || 0);
  const returnedUnits = Math.max(0, params.returnedUnits || 0);
  const wasteUnits = Math.max(0, params.wasteUnits || 0);

  const totalDelivered = initialStock + restockedUnits;
  const accountedUnits = recordedSoldUnits + returnedUnits + wasteUnits;
  const differenceUnits = accountedUnits - totalDelivered;

  const hasMissingUnits = differenceUnits < 0;
  const missingUnitsCount = hasMissingUnits ? Math.abs(differenceUnits) : 0;

  return {
    initialStock,
    restockedUnits,
    totalDelivered,
    recordedSoldUnits,
    returnedUnits,
    wasteUnits,
    accountedUnits,
    differenceUnits,
    hasMissingUnits,
    missingUnitsCount
  };
}
