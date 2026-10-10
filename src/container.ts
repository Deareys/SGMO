/**
 * SGMO — Tequeños Costa
 * Dependency Injection Container & Service Registry
 *
 * Conecta los Puertos de la Arquitectura Hexagonal con sus Adaptadores concretos
 * e instancia los Casos de Uso listos para ser consumidos por la capa de Presentación.
 */

import {
  localStorageAdapter,
  httpStorageAdapter,
  hybridStorageAdapter,
  mercadoPagoAdapter,
  geminiOcrAdapter,
  jsPdfAdapter,
  webAudioAdapter
} from './adapters';

import {
  RecordSaleUseCase,
  CalculateSettlementUseCase,
  CloseShiftUseCase,
  ValidateVoucherUseCase
} from './core/use-cases';

export class AppContainer {
  // Adaptadores (Infraestructura)
  readonly storageRepository = hybridStorageAdapter;
  readonly localStorageRepository = localStorageAdapter;
  readonly httpStorageRepository = httpStorageAdapter;
  readonly paymentGateway = mercadoPagoAdapter;
  readonly voucherAnalyzer = geminiOcrAdapter;
  readonly pdfGenerator = jsPdfAdapter;
  readonly soundNotifier = webAudioAdapter;

  // Casos de Uso (Aplicación)
  readonly recordSaleUseCase = new RecordSaleUseCase(
    this.storageRepository,
    this.soundNotifier
  );

  readonly calculateSettlementUseCase = new CalculateSettlementUseCase(
    this.storageRepository
  );

  readonly closeShiftUseCase = new CloseShiftUseCase(
    this.storageRepository,
    this.pdfGenerator
  );

  readonly validateVoucherUseCase = new ValidateVoucherUseCase(
    this.voucherAnalyzer,
    this.storageRepository
  );
}

export const container = new AppContainer();
