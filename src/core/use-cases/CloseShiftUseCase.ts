/**
 * SGMO — Tequeños Costa
 * Core Use Case: Cerrar Jornada Operativa
 *
 * Finaliza el turno, persiste el arqueo y opcionalmente emite el comprobante de liquidación en PDF.
 */

import { IStorageRepository, IPdfGenerator } from '../ports';
import { DailyShift } from '../domain/types';

export interface CloseShiftRequest {
  shiftId: string;
  closingData: any;
  generatePdf?: boolean;
}

export class CloseShiftUseCase {
  constructor(
    private storageRepo: IStorageRepository,
    private pdfGenerator?: IPdfGenerator
  ) {}

  async execute(request: CloseShiftRequest): Promise<void> {
    const { shiftId, closingData, generatePdf } = request;

    // 1. Persistir el cierre de jornada en el repositorio
    await this.storageRepo.closeShift(shiftId, closingData);

    // 2. Si se solicita y hay generador de PDF disponible, emitir el documento
    if (generatePdf && this.pdfGenerator) {
      const shift = this.storageRepo.getShifts().find((s: DailyShift) => s.id === shiftId);
      if (shift) {
        try {
          await this.pdfGenerator.generateLiquidationPdf(shift);
        } catch (err) {
          console.error('Error al generar PDF de liquidación durante el cierre:', err);
        }
      }
    }
  }
}
