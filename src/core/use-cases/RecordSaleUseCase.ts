/**
 * SGMO — Tequeños Costa
 * Core Use Case: Registrar Venta en Carrito
 *
 * Orquesta la validación de stock, cálculo de unidades equivalentes y persistencia de la venta.
 */

import { IStorageRepository, ISoundNotifier } from '../ports';
import { getUnitsEquivalentForCombo } from '../domain/inventoryRules';
import { SaleTransaction, PaymentMethod } from '../domain/types';

export interface RecordSaleRequest {
  shiftId: string;
  itemType: 'unidad' | 'combo3' | 'combo6' | 'combo12' | 'adicional';
  varietyId: string;
  quantityUnitsEquivalent?: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  locationName?: string;
  beachSector?: string;
  voucherPhotoUrl?: string;
}

export class RecordSaleUseCase {
  constructor(
    private storageRepo: IStorageRepository,
    private soundNotifier?: ISoundNotifier
  ) {}

  execute(request: RecordSaleRequest): SaleTransaction {
    const {
      shiftId,
      itemType,
      varietyId,
      quantityUnitsEquivalent,
      totalAmount,
      paymentMethod,
      locationName,
      beachSector,
      voucherPhotoUrl
    } = request;

    const unitsEquivalent =
      quantityUnitsEquivalent || getUnitsEquivalentForCombo(itemType);

    // 1. Registrar la venta mediante el repositorio
    const newSale = this.storageRepo.recordSale({
      shiftId,
      itemType,
      varietyId,
      quantityUnitsEquivalent: unitsEquivalent,
      totalAmount,
      paymentMethod,
      locationName,
      beachSector,
      voucherPhotoUrl
    });

    // 2. Notificación acústica de venta registrada
    if (this.soundNotifier) {
      this.soundNotifier.playCashRegister();
      this.soundNotifier.triggerHapticFeedback([40, 30, 40]);
    }

    return newSale;
  }
}
