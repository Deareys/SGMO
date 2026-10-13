/**
 * SGMO — Tequeños Costa
 * Persistence Adapter: LocalStorage
 *
 * Implementa el puerto IStorageRepository de la Arquitectura Hexagonal
 * utilizando el servicio de almacenamiento local con patrón reactivo (Observer).
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

export class LocalStorageAdapter implements IStorageRepository {
  private service = storageService;

  subscribe(listener: () => void): () => void {
    return this.service.subscribe(listener);
  }

  getCurrentUser(): UserProfile | null {
    return this.service.getState().currentUser;
  }

  setCurrentUser(user: UserProfile | null): void {
    this.service.setCurrentUser(user);
  }

  getUsers(): UserProfile[] {
    return this.service.getState().users;
  }

  updateUser(id: string, updates: Partial<UserProfile>): Promise<void> {
    return this.service.updateUser(id, updates);
  }

  getCarts(): SellingCart[] {
    return this.service.getState().carts;
  }

  getCartById(cartId: string): SellingCart | undefined {
    return this.service.getState().carts.find((c) => c.id === cartId);
  }

  updateCart(cartId: string, updates: Partial<SellingCart>): Promise<void> {
    return this.service.updateCart(cartId, updates);
  }

  getVarieties(): ProductVariety[] {
    return this.service.getState().varieties;
  }

  updateVariety(id: string, updates: Partial<ProductVariety>): Promise<void> {
    return this.service.updateVariety(id, updates);
  }

  getActiveShiftForUser(userId: string): DailyShift | undefined {
    return this.service.getState().shifts.find(
      (s) => s.sellerId === userId && (s.status === 'en_curso' || s.status === 'planificada')
    );
  }

  getShifts(): DailyShift[] {
    return this.service.getState().shifts;
  }

  startShift(
    cartId: string,
    sellerId: string,
    initialStock: { varietyId: string; quantity: number }[]
  ): Promise<DailyShift> {
    return this.service.dispatchSellerShift({
      houseId: this.service.getState().selectedHouseId,
      sellerId,
      cartId,
      zoneId: this.service.getState().zones[0]?.id || '',
      stockToDeliver: initialStock,
      gasPercentStart: 100,
      napkinsDelivered: 5,
      conesDelivered: 50,
      saucesProvided: []
    });
  }

  async closeShift(shiftId: string, closingData: any): Promise<void> {
    await this.service.closeAndReconcileShift({
      shiftId,
      cashDeclared: closingData.cashDeclared || 0,
      gasPercentEnd: closingData.gasPercentEnd || 80,
      returnedItems: closingData.returnedItems || [],
      deductionMissingRatePerUnit: closingData.deductionMissingRatePerUnit,
      bonusIncentive: closingData.bonusIncentive,
      notes: closingData.notes,
      coordinatorSignature: closingData.coordinatorSignature || 'Firma Coordinación'
    });
  }

  recordSale(sale: any): SaleTransaction {
    return this.service.registerSale(sale);
  }

  getSalesForShift(shiftId: string): SaleTransaction[] {
    return this.service.getState().sales.filter((s) => s.shiftId === shiftId);
  }

  getSales(): SaleTransaction[] {
    return this.service.getState().sales;
  }

  recordWaste(params: {
    shiftId: string;
    varietyId: string;
    units: number;
    reason: string;
    notes?: string;
  }): Promise<ShiftWasteRecord | undefined> {
    return this.service.recordShiftWaste(
      params.shiftId,
      params.varietyId,
      params.units,
      params.reason,
      params.notes
    );
  }

  getWasteRecords(shiftId?: string): ShiftWasteRecord[] {
    const shifts = this.service.getState().shifts;
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

  async recordRestock(data: {
    shiftId: string;
    items: { varietyId: string; quantity: number }[];
    notes?: string;
  }): Promise<ShiftRestockRecord[]> {
    const result = await this.service.addShiftRestock(data);
    return result.restockRecords;
  }

  getCommissionTiers(): CommissionTier[] {
    return this.service.getCommissionTiers();
  }

  updateCommissionTiers(tiers: CommissionTier[]): Promise<void> {
    return this.service.saveCommissionTiers(tiers);
  }

  getOperatingCosts(): OperationalExpense[] {
    return this.service.getState().expenses || [];
  }

  getProductionOrders(): ProductionOrder[] {
    return this.service.getState().productionOrders || [];
  }

  getIncidents(): CartIncident[] {
    return this.service.getState().incidents || [];
  }

  resetToFactorySeed(): void {
    this.service.resetToFactorySeed();
  }
}

export const localStorageAdapter = new LocalStorageAdapter();
