/**
 * SGMO — Tequeños Costa
 * Core Port: Repositorio de Almacenamiento y Persistencia
 *
 * Define el contrato abstracto para consultar y mutar el estado del sistema,
 * utilizando las entidades oficiales del dominio.
 */

import {
  UserProfile,
  SellingCart,
  ProductVariety,
  DailyShift,
  SaleTransaction,
  ShiftWasteRecord,
  ShiftRestockRecord,
  CommissionTier,
  OperationalExpense,
  ProductionOrder,
  CartIncident
} from '../domain/types';

export interface IStorageRepository {
  // Suscripción reactiva (Observer pattern)
  subscribe(listener: () => void): () => void;

  // Usuarios
  getCurrentUser(): UserProfile | null;
  setCurrentUser(user: UserProfile | null): void;
  getUsers(): UserProfile[];
  updateUser(id: string, updates: Partial<UserProfile>): void;

  // Carritos y Flota
  getCarts(): SellingCart[];
  getCartById(cartId: string): SellingCart | undefined;
  updateCart(cartId: string, updates: Partial<SellingCart>): void;

  // Variedades de Producto
  getVarieties(): ProductVariety[];
  updateVariety(id: string, updates: Partial<ProductVariety>): void;

  // Jornadas (Shifts)
  getActiveShiftForUser(userId: string): DailyShift | undefined;
  getShifts(): DailyShift[];
  startShift(cartId: string, sellerId: string, initialStock: { varietyId: string; quantity: number }[]): DailyShift;
  closeShift(shiftId: string, closingData: any): void;

  // Ventas
  recordSale(sale: any): SaleTransaction;
  getSalesForShift(shiftId: string): SaleTransaction[];
  getSales(): SaleTransaction[];

  // Mermas y Reposiciones
  recordWaste(params: {
    shiftId: string;
    varietyId: string;
    units: number;
    reason: string;
    notes?: string;
  }): ShiftWasteRecord | undefined;
  getWasteRecords(shiftId?: string): ShiftWasteRecord[];
  recordRestock(data: {
    shiftId: string;
    items: { varietyId: string; quantity: number }[];
    notes?: string;
  }): ShiftRestockRecord[];

  // Tramos de Comisión y Costos
  getCommissionTiers(): CommissionTier[];
  updateCommissionTiers(tiers: CommissionTier[]): void;
  getOperatingCosts(): OperationalExpense[];

  // Fábrica e Incidencias
  getProductionOrders(): ProductionOrder[];
  getIncidents(): CartIncident[];

  // Diagnóstico y Reseteo
  resetToFactorySeed(): void;
}
