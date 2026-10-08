/**
 * Utilidades para el Sistema de Tramos de Comisión y Recompensas
 * Delegado a src/core/domain/commissionRules.ts (Arquitectura Hexagonal)
 */

export {
  calculateCommissionForSales,
  formatTierRange,
  type CommissionCalculationResult
} from '../core/domain/commissionRules';
