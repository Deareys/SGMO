/**
 * SGMO — Tequeños Costa
 * Presentation Hook: useCore
 *
 * Expone los Casos de Uso y Adaptadores de la Arquitectura Hexagonal a los componentes React.
 */

import { useSyncExternalStore } from 'react';
import { container } from '../../container';
import { UserProfile, DailyShift, ProductVariety, SellingCart } from '../../core/domain/types';

export function useCore() {
  // Suscripción reactiva al repositorio de almacenamiento usando useSyncExternalStore
  const currentUser = useSyncExternalStore(
    (onStoreChange) => container.storageRepository.subscribe(onStoreChange),
    () => container.storageRepository.getCurrentUser()
  );

  return {
    // Casos de uso
    recordSaleUseCase: container.recordSaleUseCase,
    calculateSettlementUseCase: container.calculateSettlementUseCase,
    closeShiftUseCase: container.closeShiftUseCase,
    validateVoucherUseCase: container.validateVoucherUseCase,

    // Adaptadores
    storageRepository: container.storageRepository,
    paymentGateway: container.paymentGateway,
    voucherAnalyzer: container.voucherAnalyzer,
    pdfGenerator: container.pdfGenerator,
    soundNotifier: container.soundNotifier,

    // Estado reactivo básico
    currentUser,
    getActiveShift: (userId: string): DailyShift | undefined =>
      container.storageRepository.getActiveShiftForUser(userId),
    getCarts: (): SellingCart[] => container.storageRepository.getCarts(),
    getVarieties: (): ProductVariety[] => container.storageRepository.getVarieties()
  };
}
