/**
 * SGMO — Tequeños Costa
 * Persistence Adapter: HybridStorageAdapter
 *
 * Coordina de forma inteligente el almacenamiento local y la persistencia central (PostgreSQL).
 * - Mantiene el funcionamiento 100% offline y en dispositivos sin backend conectado.
 * - Sincroniza ventas y turnos con PostgreSQL cuando el backend está disponible.
 * - Nunca destruye datos locales de localStorage sin confirmación explícita.
 */

import { storageService, SaleSyncResult } from '../../services/storageService';
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
import { authenticatedFetch } from '../../services/apiClient';

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
      const res = await authenticatedFetch('/api/db/status');
      if (res.ok) {
        const data = await res.json();
        this.dbConfigured = data.configured === true;
        this.providerName = data.provider || 'PostgreSQL';
        return {
          isServerConnected: true,
          isDbConfigured: this.dbConfigured,
          provider: this.providerName,
          pendingOfflineSales: storageService.getOfflineQueueCount()
        };
      }
    } catch {
      // Servidor no disponible o modo offline
    }

    return {
      isServerConnected: false,
      isDbConfigured: this.dbConfigured,
      provider: 'Operación central no disponible; caché conservada',
      pendingOfflineSales: storageService.getOfflineQueueCount()
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

  updateCart(cartId: string, updates: Partial<SellingCart>): Promise<void> {
    return this.local.updateCart(cartId, updates);
  }

  getVarieties(): ProductVariety[] {
    return this.local.getVarieties();
  }

  updateVariety(id: string, updates: Partial<ProductVariety>): Promise<void> {
    return this.local.updateVariety(id, updates);
  }

  getActiveShiftForUser(userId: string): DailyShift | undefined {
    return this.local.getActiveShiftForUser(userId);
  }

  getShifts(): DailyShift[] {
    return this.local.getShifts();
  }

  startShift(cartId: string, sellerId: string, initialStock: { varietyId: string; quantity: number }[]): Promise<DailyShift> {
    return this.local.startShift(cartId, sellerId, initialStock);
  }

  closeShift(shiftId: string, closingData: any): Promise<void> {
    return this.local.closeShift(shiftId, closingData);
  }

  recordSale(sale: any): SaleTransaction {
    return this.local.recordSale(sale);
  }

  getSalesForShift(shiftId: string): SaleTransaction[] {
    return this.local.getSalesForShift(shiftId);
  }

  getSales(): SaleTransaction[] {
    return this.local.getSales();
  }

  recordWaste(params: { shiftId: string; varietyId: string; units: number; reason: string; notes?: string }): Promise<ShiftWasteRecord | undefined> {
    return this.local.recordWaste(params);
  }

  getWasteRecords(shiftId?: string): ShiftWasteRecord[] {
    return this.local.getWasteRecords(shiftId);
  }

  recordRestock(data: { shiftId: string; items: { varietyId: string; quantity: number }[]; notes?: string }): Promise<ShiftRestockRecord[]> {
    return this.local.recordRestock(data);
  }

  getCommissionTiers(): CommissionTier[] {
    return this.local.getCommissionTiers();
  }

  getSystemConfig() { return this.local.getSystemConfig(); }

  updateCommissionTiers(tiers: CommissionTier[]): Promise<void> {
    return this.local.updateCommissionTiers(tiers);
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
  async syncLocalSalesToCentralDb(): Promise<SaleSyncResult> {
    return storageService.flushOfflineQueue();
  }
}

export const hybridStorageAdapter = new HybridStorageAdapter();
