/**
 * SGMO — Tequeños Costa
 * Persistence Adapter: HttpStorageAdapter (PostgreSQL API Client)
 *
 * Implementa el puerto IStorageRepository para comunicarse con los endpoints REST
 * de persistencia central en PostgreSQL. Si la base central no está configurada
 * o la red falla, delega ordenadamente en el almacenamiento local sin interrumpir la UI.
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
import { storageService } from '../../services/storageService';

export class HttpStorageAdapter implements IStorageRepository {
  private localFallback = storageService;
  private isServerDbConfigured: boolean | null = null;

  constructor() {
    this.checkServerDbStatus();
  }

  async checkServerDbStatus(): Promise<boolean> {
    try {
      const res = await fetch('/api/db/status');
      if (res.ok) {
        const data = await res.json();
        this.isServerDbConfigured = data.configured === true;
        return this.isServerDbConfigured;
      }
    } catch {
      // Sin conexión o servidor apagado
    }
    this.isServerDbConfigured = false;
    return false;
  }

  getDbConfiguredSync(): boolean {
    return this.isServerDbConfigured === true;
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = this.localFallback.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  subscribe(listener: () => void): () => void {
    return this.localFallback.subscribe(listener);
  }

  getCurrentUser(): UserProfile | null {
    return this.localFallback.getState().currentUser;
  }

  setCurrentUser(user: UserProfile | null): void {
    this.localFallback.setCurrentUser(user);
  }

  getUsers(): UserProfile[] {
    return this.localFallback.getState().users;
  }

  updateUser(id: string, updates: Partial<UserProfile>): Promise<void> {
    // El servicio realiza una única escritura autenticada y confirma antes de actualizar la caché.
    return this.localFallback.updateUser(id, updates);
  }

  getCarts(): SellingCart[] {
    return this.localFallback.getState().carts;
  }

  getCartById(cartId: string): SellingCart | undefined {
    return this.localFallback.getState().carts.find((c) => c.id === cartId);
  }

  updateCart(cartId: string, updates: Partial<SellingCart>): void {
    this.localFallback.updateCart(cartId, updates);
  }

  getVarieties(): ProductVariety[] {
    return this.localFallback.getState().varieties;
  }

  updateVariety(id: string, updates: Partial<ProductVariety>): void {
    this.localFallback.updateVariety(id, updates);
  }

  getActiveShiftForUser(userId: string): DailyShift | undefined {
    return this.localFallback.getState().shifts.find(
      (s) => s.sellerId === userId && (s.status === 'en_curso' || s.status === 'planificada')
    );
  }

  getShifts(): DailyShift[] {
    return this.localFallback.getState().shifts;
  }

  startShift(
    cartId: string,
    sellerId: string,
    initialStock: { varietyId: string; quantity: number }[]
  ): DailyShift {
    const shift = this.localFallback.dispatchSellerShift({
      houseId: this.localFallback.getState().selectedHouseId || 'HOUSE-NORTE',
      sellerId,
      cartId,
      zoneId: 'ZONE-STA-TERESITA-CENTRO',
      stockToDeliver: initialStock,
      gasPercentStart: 100,
      napkinsDelivered: 5,
      conesDelivered: 50,
      saucesProvided: []
    });

    if (this.isServerDbConfigured) {
      fetch('/api/shifts', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(shift)
      }).catch((err) => console.warn('Sync POST /api/shifts error:', err));
    }

    return shift;
  }

  closeShift(shiftId: string, closingData: any): void {
    this.localFallback.closeAndReconcileShift({
      shiftId,
      cashDeclared: closingData.cashDeclared || 0,
      gasPercentEnd: closingData.gasPercentEnd || 80,
      returnedItems: closingData.returnedItems || [],
      deductionMissingRatePerUnit: closingData.deductionMissingRatePerUnit,
      bonusIncentive: closingData.bonusIncentive,
      notes: closingData.notes,
      coordinatorSignature: closingData.coordinatorSignature || 'Firma Coordinación'
    });

    if (this.isServerDbConfigured) {
      fetch(`/api/shifts/${shiftId}/close`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(closingData)
      }).catch((err) => console.warn('Sync PUT /api/shifts/close error:', err));
    }
  }

  recordSale(sale: any): SaleTransaction {
    const recorded = this.localFallback.registerSale(sale);

    if (this.isServerDbConfigured) {
      fetch('/api/sales', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(recorded)
      }).catch((err) => {
        console.warn('Sync POST /api/sales error, encolada en local:', err);
      });
    }

    return recorded;
  }

  getSalesForShift(shiftId: string): SaleTransaction[] {
    return this.localFallback.getState().sales.filter((s) => s.shiftId === shiftId);
  }

  getSales(): SaleTransaction[] {
    return this.localFallback.getState().sales;
  }

  recordWaste(params: {
    shiftId: string;
    varietyId: string;
    units: number;
    reason: string;
    notes?: string;
  }): ShiftWasteRecord | undefined {
    const record = this.localFallback.recordShiftWaste(
      params.shiftId,
      params.varietyId,
      params.units,
      params.reason,
      params.notes
    );

    if (record && this.isServerDbConfigured) {
      fetch(`/api/shifts/${params.shiftId}/waste`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(record)
      }).catch((err) => console.warn('Sync POST /api/shifts/waste error:', err));
    }

    return record;
  }

  getWasteRecords(shiftId?: string): ShiftWasteRecord[] {
    const shifts = this.localFallback.getState().shifts;
    const allWastes: ShiftWasteRecord[] = [];
    shifts.forEach((s) => {
      if (!shiftId || s.id === shiftId) {
        if (s.wasteRecords) {
          allWastes.push(...s.wasteRecords);
        }
      }
    });
    return allWastes;
  }

  recordRestock(data: {
    shiftId: string;
    items: { varietyId: string; quantity: number }[];
    notes?: string;
  }): ShiftRestockRecord[] {
    const result = this.localFallback.addShiftRestock(data);

    if (this.isServerDbConfigured && result.restockRecords.length > 0) {
      for (const rec of result.restockRecords) {
        fetch(`/api/shifts/${data.shiftId}/restock`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(rec)
        }).catch((err) => console.warn('Sync POST /api/shifts/restock error:', err));
      }
    }

    return result.restockRecords;
  }

  getCommissionTiers(): CommissionTier[] {
    return this.localFallback.getCommissionTiers();
  }

  updateCommissionTiers(tiers: CommissionTier[]): void {
    this.localFallback.saveCommissionTiers(tiers);
  }

  getOperatingCosts(): OperationalExpense[] {
    return this.localFallback.getState().expenses || [];
  }

  getProductionOrders(): ProductionOrder[] {
    return this.localFallback.getState().productionOrders || [];
  }

  getIncidents(): CartIncident[] {
    return this.localFallback.getState().incidents || [];
  }

  resetToFactorySeed(): void {
    this.localFallback.resetToFactorySeed();
  }
}

export const httpStorageAdapter = new HttpStorageAdapter();
