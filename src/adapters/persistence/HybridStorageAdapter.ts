/**
 * SGMO — Tequeños Costa
 * Persistence Adapter: HybridStorageAdapter
 *
 * Coordina de forma inteligente el almacenamiento local y la persistencia central (PostgreSQL).
 * - Mantiene el funcionamiento 100% offline y en dispositivos sin backend conectado.
 * - Sincroniza ventas y turnos con PostgreSQL cuando el backend está disponible.
 * - Nunca destruye datos locales de localStorage sin confirmación explícita.
 */

import { IStorageRepository } from '../../core/ports/IStorageRepository';
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
} from '../../core/domain/types';
import { localStorageAdapter, LocalStorageAdapter } from './LocalStorageAdapter';
import { httpStorageAdapter, HttpStorageAdapter } from './HttpStorageAdapter';

export interface SyncStatus {
  isServerConnected: boolean;
  isDbConfigured: boolean;
  provider: string;
  lastSyncTime?: string;
  pendingOfflineSales: number;
}

export class HybridStorageAdapter implements IStorageRepository {
  private local: LocalStorageAdapter = localStorageAdapter;
  private remote: HttpStorageAdapter = httpStorageAdapter;
  private dbConfigured: boolean = false;
  private providerName: string = 'Sin conexión central';

  constructor() {
    this.refreshStatus();
  }

  async refreshStatus(): Promise<SyncStatus> {
    try {
      const res = await fetch('/api/db/status');
      if (res.ok) {
        const data = await res.json();
        this.dbConfigured = data.configured === true;
        this.providerName = data.provider || 'PostgreSQL';
        return {
          isServerConnected: true,
          isDbConfigured: this.dbConfigured,
          provider: this.providerName,
          pendingOfflineSales: this.local.getSales().filter((s) => s.isOfflineCreated).length
        };
      }
    } catch {
      // Servidor no disponible o modo offline
    }

    this.dbConfigured = false;
    return {
      isServerConnected: false,
      isDbConfigured: false,
      provider: 'Modo Local (localStorage)',
      pendingOfflineSales: this.local.getSales().filter((s) => s.isOfflineCreated).length
    };
  }

  getDbConfigured(): boolean {
    return this.dbConfigured;
  }

  getProvider(): string {
    return this.providerName;
  }

  // Delegación del contrato IStorageRepository
  subscribe(listener: () => void): () => void {
    return this.local.subscribe(listener);
  }

  getCurrentUser(): UserProfile | null {
    return this.local.getCurrentUser();
  }

  setCurrentUser(user: UserProfile | null): void {
    this.local.setCurrentUser(user);
    if (this.dbConfigured && user) {
      this.remote.setCurrentUser(user);
    }
  }

  getUsers(): UserProfile[] {
    return this.local.getUsers();
  }

  updateUser(id: string, updates: Partial<UserProfile>): Promise<void> {
    // No duplicar el alta/restablecimiento de credenciales a través de dos adaptadores.
    return this.local.updateUser(id, updates);
  }

  getCarts(): SellingCart[] {
    return this.local.getCarts();
  }

  getCartById(cartId: string): SellingCart | undefined {
    return this.local.getCartById(cartId);
  }

  updateCart(cartId: string, updates: Partial<SellingCart>): void {
    this.local.updateCart(cartId, updates);
    if (this.dbConfigured) {
      this.remote.updateCart(cartId, updates);
    }
  }

  getVarieties(): ProductVariety[] {
    return this.local.getVarieties();
  }

  updateVariety(id: string, updates: Partial<ProductVariety>): void {
    this.local.updateVariety(id, updates);
    if (this.dbConfigured) {
      this.remote.updateVariety(id, updates);
    }
  }

  getActiveShiftForUser(userId: string): DailyShift | undefined {
    return this.local.getActiveShiftForUser(userId);
  }

  getShifts(): DailyShift[] {
    return this.local.getShifts();
  }

  startShift(
    cartId: string,
    sellerId: string,
    initialStock: { varietyId: string; quantity: number }[]
  ): DailyShift {
    const shift = this.local.startShift(cartId, sellerId, initialStock);
    if (this.dbConfigured) {
      this.remote.startShift(cartId, sellerId, initialStock);
    }
    return shift;
  }

  closeShift(shiftId: string, closingData: any): void {
    this.local.closeShift(shiftId, closingData);
    if (this.dbConfigured) {
      this.remote.closeShift(shiftId, closingData);
    }
  }

  recordSale(sale: any): SaleTransaction {
    const recorded = this.local.recordSale(sale);
    if (this.dbConfigured) {
      this.remote.recordSale(sale);
    }
    return recorded;
  }

  getSalesForShift(shiftId: string): SaleTransaction[] {
    return this.local.getSalesForShift(shiftId);
  }

  getSales(): SaleTransaction[] {
    return this.local.getSales();
  }

  recordWaste(params: {
    shiftId: string;
    varietyId: string;
    units: number;
    reason: string;
    notes?: string;
  }): ShiftWasteRecord | undefined {
    const rec = this.local.recordWaste(params);
    if (this.dbConfigured) {
      this.remote.recordWaste(params);
    }
    return rec;
  }

  getWasteRecords(shiftId?: string): ShiftWasteRecord[] {
    return this.local.getWasteRecords(shiftId);
  }

  recordRestock(data: {
    shiftId: string;
    items: { varietyId: string; quantity: number }[];
    notes?: string;
  }): ShiftRestockRecord[] {
    const records = this.local.recordRestock(data);
    if (this.dbConfigured) {
      this.remote.recordRestock(data);
    }
    return records;
  }

  getCommissionTiers(): CommissionTier[] {
    return this.local.getCommissionTiers();
  }

  updateCommissionTiers(tiers: CommissionTier[]): void {
    this.local.updateCommissionTiers(tiers);
  }

  getOperatingCosts(): OperationalExpense[] {
    return this.local.getOperatingCosts();
  }

  getProductionOrders(): ProductionOrder[] {
    return this.local.getProductionOrders();
  }

  getIncidents(): CartIncident[] {
    return this.local.getIncidents();
  }

  resetToFactorySeed(): void {
    this.local.resetToFactorySeed();
  }

  /**
   * Sincronización masiva de ventas locales hacia PostgreSQL central.
   */
  async syncLocalSalesToCentralDb(): Promise<{ success: boolean; inserted: number; updated: number }> {
    if (!this.dbConfigured) {
      return { success: false, inserted: 0, updated: 0 };
    }

    const localSales = this.local.getSales();
    if (localSales.length === 0) {
      return { success: true, inserted: 0, updated: 0 };
    }

    try {
      const res = await fetch('/api/sales/sync-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sales: localSales })
      });

      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          inserted: data.inserted || 0,
          updated: data.updated || 0
        };
      }
    } catch (e: any) {
      console.warn('Error sincronizando lote con base central:', e);
    }

    return { success: false, inserted: 0, updated: 0 };
  }
}

export const hybridStorageAdapter = new HybridStorageAdapter();
