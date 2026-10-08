/**
 * SGMO — Tequeños Costa
 * Core Domain: Reglas de Comisión Escalonada
 *
 * Módulo puro de dominio. NO depende de React, DOM ni infraestructura.
 * Aplica el cálculo de comisiones escalonadas dinámicas sobre la facturación bruta.
 */

import { CommissionTier } from './types';

export interface CommissionCalculationResult {
  rate: number;
  tier: CommissionTier | null;
  tierName: string;
  grossCommission: number;
  nextTier: CommissionTier | null;
  salesToNextTier: number | null;
}

/**
 * Calcula la comisión correspondiente según el volumen total de ventas y los tramos activos.
 * 
 * Regla de Negocio:
 * - Tramo 1 (Base): Hasta $110.000 -> 10%
 * - Tramo 2 (Medio): De $110.001 a $220.000 -> 20%
 * - Tramo 3 (Estrella): Más de $220.000 -> 30%
 *
 * @param salesAmount Monto total bruto facturado en la jornada
 * @param tiers Lista de tramos configurados
 * @param fallbackRate Tasa de comisión por defecto (0.20 = 20%)
 */
export function calculateCommissionForSales(
  salesAmount: number,
  tiers: CommissionTier[] = [],
  fallbackRate: number = 0.20
): CommissionCalculationResult {
  const safeSales = Math.max(0, Number(salesAmount) || 0);

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
      if (safeSales <= max) {
        matchedTier = t;
        matchedIndex = i;
        break;
      }
    } else {
      if (safeSales > t.minSales && safeSales <= max) {
        matchedTier = t;
        matchedIndex = i;
        break;
      }
    }
  }

  if (!matchedTier) {
    matchedIndex = activeTiers.length - 1;
    matchedTier = activeTiers[matchedIndex];
  }

  const rate = matchedTier ? matchedTier.rate : fallbackRate;
  const grossCommission = Math.round(safeSales * rate);

  const nextTier =
    matchedIndex >= 0 && matchedIndex < activeTiers.length - 1
      ? activeTiers[matchedIndex + 1]
      : null;

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

