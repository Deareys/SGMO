/**
 * SGMO — Tequeños Costa
 * Módulo de Integridad y Validación de Ventas y Precios Oficiales (Fase 3.2)
 *
 * Responsabilidad:
 * - Validar que cada transacción de venta enviada al backend cumpla con:
 *   1. Catálogo oficial de productos y variedades existentes y activas.
 *   2. Tipos de ítem válidos ('unidad', 'combo3', 'combo6', 'combo12', 'adicional').
 *   3. Unidades equivalentes concordantes con la composición del combo.
 *   4. Precios oficiales vigentes (previniendo adulteración de importes o fraude).
 *   5. Medios de pago válidos ('efectivo', 'mercado_pago', 'transferencia').
 */

import { isDbConfigured, query } from './connection';
import type { PoolClient } from 'pg';
import { ProductVariety, PaymentMethod } from '../../types';
import { INITIAL_VARIETIES } from '../../mockData';

export const VALID_PAYMENT_METHODS: PaymentMethod[] = ['efectivo', 'mercado_pago', 'transferencia'];
export const VALID_ITEM_TYPES = ['unidad', 'combo3', 'combo6', 'combo12', 'adicional'] as const;

export type ValidItemType = typeof VALID_ITEM_TYPES[number];

// Unidades base por tipo de presentación
export const ITEM_UNITS_MAP: Record<ValidItemType, number> = {
  unidad: 1,
  combo3: 3,
  combo6: 6,
  combo12: 12,
  adicional: 1
};

// Precios de promoción estándar de referencia de la terminal
export const STANDARD_PROMO_PRICES: Record<ValidItemType, number> = {
  unidad: 1500,
  combo3: 4000,
  combo6: 7500,
  combo12: 14000,
  adicional: 800
};

export interface SaleValidationResult {
  isValid: boolean;
  code?: string;
  error?: string;
  varietyName?: string;
  expectedUnits?: number;
  expectedTotal?: number;
}

/**
 * Resuelve una variedad de producto consultando exclusivamente PostgreSQL si está configurada la base,
 * o recurriendo al catálogo de contingencia en modo local sin base central.
 */
export async function resolveVariety(varietyId: string, client?: PoolClient): Promise<ProductVariety | null> {
  if (isDbConfigured()) {
    try {
      const execute = client ? client.query.bind(client) : query;
      const res = await execute(`
        SELECT 
          id, name, category, description,
          is_available as "isAvailable", is_active as "isActive",
          base_price_individual::float as "basePriceIndividual",
          combo_prices as "comboPrices",
          custom_combos as "customCombos"
        FROM product_varieties
        WHERE id = $1
        ${client ? 'FOR SHARE' : ''}
      `, [varietyId]);

      if (res.rows.length === 0) return null;
      return res.rows[0];
    } catch (err: any) {
      throw new Error(`Error al consultar el catálogo central de productos: ${err.message}`);
    }
  }

  // Modo contingencia local (sin DATABASE_URL)
  const fallback = INITIAL_VARIETIES.find((v) => v.id === varietyId);
  return fallback || null;
}

/**
 * Valida la integridad estructural, las reglas de negocio de unidades y los precios oficiales de una venta.
 */
export async function validateSaleIntegrity(sale: any, client?: PoolClient): Promise<SaleValidationResult> {
  if (!sale || typeof sale !== 'object' || Array.isArray(sale)) {
    return {
      isValid: false,
      code: 'INVALID_PAYLOAD',
      error: 'El cuerpo de la venta debe ser un objeto válido.'
    };
  }

  // 1. Identificador de jornada obligatorio
  if (!sale.shiftId || typeof sale.shiftId !== 'string' || sale.shiftId.trim() === '') {
    return {
      isValid: false,
      code: 'MISSING_SHIFT_ID',
      error: 'La venta debe especificar un identificador de jornada (shiftId) válido.'
    };
  }

  // 2. Medio de pago
  if (!sale.paymentMethod || !VALID_PAYMENT_METHODS.includes(sale.paymentMethod)) {
    return {
      isValid: false,
      code: 'INVALID_PAYMENT_METHOD',
      error: `Medio de pago no autorizado: "${sale.paymentMethod}". Medios aceptados: ${VALID_PAYMENT_METHODS.join(', ')}.`
    };
  }

  // 3. Tipo de producto / combo
  if (!sale.itemType || !VALID_ITEM_TYPES.includes(sale.itemType)) {
    return {
      isValid: false,
      code: 'INVALID_ITEM_TYPE',
      error: `Tipo de producto no autorizado: "${sale.itemType}". Tipos válidos: ${VALID_ITEM_TYPES.join(', ')}.`
    };
  }

  const itemType = sale.itemType as ValidItemType;
  const baseUnitsPerPackage = ITEM_UNITS_MAP[itemType];

  // 4. Unidades equivalentes
  const units = sale.quantityUnitsEquivalent;
  if (!Number.isSafeInteger(units) || units <= 0 || units > 1000000) {
    return {
      isValid: false,
      code: 'INVALID_UNITS_EQUIVALENT',
      error: `Las unidades equivalentes deben ser un número entero mayor a cero (recibido: ${sale.quantityUnitsEquivalent}).`
    };
  }

  if (units % baseUnitsPerPackage !== 0) {
    return {
      isValid: false,
      code: 'UNITS_MISMATCH',
      error: `Inconsistencia de unidades: ${units} unidades equivalentes no corresponden a un múltiplo exacto de ${itemType} (debe ser múltiplo de ${baseUnitsPerPackage}).`
    };
  }

  const packagesCount = Math.floor(units / baseUnitsPerPackage);

  // 5. Total monetario
  const totalAmount = sale.totalAmount;
  if (typeof totalAmount !== 'number' || !Number.isFinite(totalAmount) || totalAmount <= 0 || totalAmount > 9999999999.99 || Math.abs(Math.round(totalAmount * 100) - totalAmount * 100) > 0.0001) {
    return {
      isValid: false,
      code: 'INVALID_TOTAL_AMOUNT',
      error: `El importe total debe ser un número positivo mayor a cero (recibido: ${sale.totalAmount}).`
    };
  }

  // 6. Variedad en el catálogo oficial
  if (!sale.varietyId || typeof sale.varietyId !== 'string') {
    return {
      isValid: false,
      code: 'MISSING_VARIETY_ID',
      error: 'La venta debe especificar una variedad de producto (varietyId).'
    };
  }

  const variety = await resolveVariety(sale.varietyId, client);
  if (!variety) {
    return {
      isValid: false,
      code: 'UNKNOWN_VARIETY',
      error: `La variedad de producto "${sale.varietyId}" no existe en el catálogo oficial de productos.`
    };
  }

  if (variety.isActive === false || variety.isAvailable === false) {
    return {
      isValid: false,
      code: 'INACTIVE_VARIETY',
      error: `La variedad de producto "${variety.name}" está dada de baja y no puede comercializarse.`
    };
  }

  // 7. Validación de Precios Oficiales (Detección de importes adulterados)
  // Obtenemos los precios oficiales permitidos para este tipo de ítem en esta variedad:
  // - Precio específico de la variedad (si está configurado)
  // - Las referencias históricas se admiten sólo en pruebas/demo sin base.
  // En producción el catálogo configurado es la única autoridad de precios.
  const allowedPackagePrices: number[] = [];

  switch (itemType) {
    case 'unidad':
      if (typeof variety.basePriceIndividual === 'number' && variety.basePriceIndividual > 0) {
        allowedPackagePrices.push(variety.basePriceIndividual);
      }
      if (!isDbConfigured() && variety.category === 'tequeno') {
        allowedPackagePrices.push(STANDARD_PROMO_PRICES.unidad);
      }
      break;

    case 'combo3':
      if (variety.comboPrices?.combo3 && Number(variety.comboPrices.combo3) > 0) {
        allowedPackagePrices.push(Number(variety.comboPrices.combo3));
      }
      if (!isDbConfigured() && variety.category === 'tequeno') {
        allowedPackagePrices.push(STANDARD_PROMO_PRICES.combo3);
      }
      break;

    case 'combo6':
      if (variety.comboPrices?.combo6 && Number(variety.comboPrices.combo6) > 0) {
        allowedPackagePrices.push(Number(variety.comboPrices.combo6));
      }
      if (!isDbConfigured() && variety.category === 'tequeno') {
        allowedPackagePrices.push(STANDARD_PROMO_PRICES.combo6);
      }
      break;

    case 'combo12':
      if (variety.comboPrices?.combo12 && Number(variety.comboPrices.combo12) > 0) {
        allowedPackagePrices.push(Number(variety.comboPrices.combo12));
      }
      if (!isDbConfigured() && variety.category === 'tequeno') {
        allowedPackagePrices.push(STANDARD_PROMO_PRICES.combo12);
      }
      break;

    case 'adicional':
      if (typeof variety.basePriceIndividual === 'number' && variety.basePriceIndividual > 0) {
        allowedPackagePrices.push(variety.basePriceIndividual);
      }
      if (!isDbConfigured()) allowedPackagePrices.push(STANDARD_PROMO_PRICES.adicional);
      break;
  }

  // Verificar si el total recibido coincide con alguno de los precios oficiales para el multiplicador
  const expectedTotals = allowedPackagePrices.map((p) => p * packagesCount);
  const matchesOfficialPrice = expectedTotals.some((expected) => Math.round(expected * 100) === Math.round(totalAmount * 100));

  if (!matchesOfficialPrice) {
    const formattedExpected = expectedTotals.map((e) => `$${e.toLocaleString('es-AR')}`).join(' o ');
    return {
      isValid: false,
      code: 'INVALID_SALE_PRICE',
      error: `Importe adulterado detectado: El total enviado ($${totalAmount.toLocaleString('es-AR')}) no coincide con el precio oficial de ${itemType} para "${variety.name}" (esperado: ${formattedExpected} para ${units}u equivalentes).`,
      expectedTotal: expectedTotals[0]
    };
  }

  return {
    isValid: true,
    varietyName: variety.name,
    expectedUnits: units,
    expectedTotal: totalAmount
  };
}

/** Errores del contrato operativo; nunca devolver errores SQL/credenciales al cliente. */
export class DataIntegrityError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
    this.name = 'DataIntegrityError';
  }
}

export interface OperationActor {
  userId: string;
  userName: string;
  role: 'admin' | 'coordinator' | 'seller' | 'factory_worker';
}

export function assertOperationId(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
    throw new DataIntegrityError('INVALID_IDENTIFIER', `${label} inválido.`);
  }
}

export function assertOperationQuantity(value: unknown, label: string, allowZero = false): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value > 1000000) {
    throw new DataIntegrityError('INVALID_QUANTITY', `${label} debe ser una cantidad entera válida.`);
  }
}

export function assertOperationMoney(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 9999999999.99
    || Math.abs(Math.round(value * 100) - value * 100) > 0.0001) {
    throw new DataIntegrityError('INVALID_AMOUNT', `${label} debe ser un importe válido con hasta dos decimales.`);
  }
}

/** Coordina sólo recursos asignados; un administrador puede supervisar otras jornadas. */
export function assertShiftMutationAccess(shift: { seller_id?: string; coordinator_id?: string }, actor?: OperationActor): void {
  if (!actor) return; // Uso interno/repositorio; las rutas siempre entregan actor autenticado.
  if (actor.role === 'factory_worker'
      || (actor.role === 'seller' && shift.seller_id !== actor.userId)
      || (actor.role === 'coordinator' && shift.coordinator_id !== actor.userId && shift.seller_id !== actor.userId)) {
    throw new DataIntegrityError('FORBIDDEN', 'La jornada no pertenece a tu ámbito operativo.', 403);
  }
}

/** Fragmento SQL interno fijo: sólo claims del servidor otorgan autoridad bancaria. */
export const CANONICAL_BANK_SALE_SQL = `sales.payment_method != 'efectivo'
  AND sales.validation_status = 'validada'
  AND sales.mp_api_verification->>'matchedInApi' = 'true'
  AND sales.mp_api_verification->>'isLiveApi' = 'true'
  AND sales.mp_api_verification->>'apiStatus' = 'approved'
  AND sales.mp_api_verification->>'amountMatches' = 'true'
  AND sales.mp_api_verification->>'recipientMatches' = 'true'
  AND sales.mp_api_verification->>'dateMatches' = 'true'
  AND sales.mp_api_verification->>'currencyMatches' = 'true'
  AND EXISTS (SELECT 1 FROM bank_payment_claims claim WHERE claim.sale_id=sales.id
    AND claim.payment_id=sales.mp_api_verification->>'mpTransactionId'
    AND claim.status='approved' AND claim.amount=sales.total_amount AND claim.currency_id='ARS')`;
