/**
 * Utilidades para el Sistema de Tramos de Comisión y Recompensas
 * Cálculo automático, trazabilidad y liquidación según ventas de jornada
 */

import { CommissionTier } from '../types';

export interface CommissionCalculationResult {
  rate: number;
  tier: CommissionTier | null;
  tierName: string;
  grossCommission: number;
  nextTier: CommissionTier | null;
  salesToNextTier: number | null;
}

/**
 * Calcula el porcentaje de comisión y el tramo alcanzado para un total de ventas.
 * El porcentaje alcanzado se aplica de forma íntegra sobre el total de ventas brutas de la jornada.
 *
 * Tramos por defecto:
 * - Hasta $110.000: 10%
 * - Más de $110.000 y hasta $220.000: 20%
 * - Más de $220.000 y hasta $330.000: 30%
 * - Más de $330.000: 30%
 */
export function calculateCommissionForSales(
  salesAmount: number,
  tiers: CommissionTier[] = [],
  fallbackRate: number = 0.20
): CommissionCalculationResult {
  const safeSales = Math.max(0, Number(salesAmount) || 0);

  // Filtrar tramos activos y ordenar ascendentemente por ventas mínimas y máximas
  const activeTiers = (tiers || [])
    .filter((t) => t.isActive !== false)
    .sort((a, b) => {
      if (a.minSales !== b.minSales) return a.minSales - b.minSales;
      const aMax = a.maxSales ?? Infinity;
      const bMax = b.maxSales ?? Infinity;
      return aMax - bMax;
    });

  if (activeTiers.length === 0) {
    return {
      rate: fallbackRate,
      tier: null,
      tierName: `Comisión Base (${Math.round(fallbackRate * 100)}%)`,
      grossCommission: Math.round(safeSales * fallbackRate),
      nextTier: null,
      salesToNextTier: null
    };
  }

  let matchedTier: CommissionTier | null = null;
  let matchedIndex = -1;

  for (let i = 0; i < activeTiers.length; i++) {
    const t = activeTiers[i];
    const isFirst = i === 0;
    const max = t.maxSales ?? Infinity;

    if (isFirst) {
      // El primer tramo aplica para ventas menores o iguales a su límite superior
      if (safeSales <= max) {
        matchedTier = t;
        matchedIndex = i;
        break;
      }
    } else {
      // Tramos intermedios y superiores: más de t.minSales y hasta t.maxSales
      if (safeSales > t.minSales && safeSales <= max) {
        matchedTier = t;
        matchedIndex = i;
        break;
      }
    }
  }

  // Si superó todos los topes y no hubo tramo abierto, se aplica el último tramo superior
  if (!matchedTier) {
    matchedIndex = activeTiers.length - 1;
    matchedTier = activeTiers[matchedIndex];
  }

  const rate = matchedTier ? matchedTier.rate : fallbackRate;
  const grossCommission = Math.round(safeSales * rate);

  // Calcular siguiente escalafón para motivar al vendedor
  const nextTier =
    matchedIndex >= 0 && matchedIndex < activeTiers.length - 1
      ? activeTiers[matchedIndex + 1]
      : null;

  // Monto que falta vender para subir al siguiente tramo
  const salesToNextTier = nextTier
    ? Math.max(0, nextTier.minSales - safeSales + 1)
    : null;

  return {
    rate,
    tier: matchedTier,
    tierName: matchedTier ? matchedTier.name : `Comisión (${Math.round(rate * 100)}%)`,
    grossCommission,
    nextTier,
    salesToNextTier
  };
}

/**
 * Formatea un tramo en texto legible para interfaces y comprobantes
 */
export function formatTierRange(tier: CommissionTier): string {
  const percentStr = `${Math.round(tier.rate * 100)}%`;
  if (tier.minSales === 0 && tier.maxSales !== null) {
    return `Hasta $${tier.maxSales.toLocaleString('es-AR')} ➔ ${percentStr}`;
  }
  if (tier.maxSales === null) {
    return `Más de $${tier.minSales.toLocaleString('es-AR')} ➔ ${percentStr}`;
  }
  return `De $${tier.minSales.toLocaleString('es-AR')} a $${tier.maxSales.toLocaleString('es-AR')} ➔ ${percentStr}`;
}
