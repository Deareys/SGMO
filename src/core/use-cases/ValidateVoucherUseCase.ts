/**
 * SGMO — Tequeños Costa
 * Core Use Case: Validar Comprobante de Transferencia / OCR
 *
 * Utiliza el analizador de comprobantes para extraer datos y previene fraudes de doble gasto.
 */

import { IVoucherAnalyzer, VoucherAnalysisResult } from '../ports';
import { IStorageRepository } from '../ports';
import { SaleTransaction } from '../domain/types';

export interface ValidateVoucherRequest {
  base64Image: string;
  expectedAmount?: number;
}

export class ValidateVoucherUseCase {
  constructor(
    private voucherAnalyzer: IVoucherAnalyzer,
    private storageRepo: IStorageRepository
  ) {}

  async execute(request: ValidateVoucherRequest): Promise<VoucherAnalysisResult> {
    const { base64Image, expectedAmount } = request;

    // 1. Recolectar números de operación existentes en las ventas registradas para evitar doble gasto
    const existingSales: SaleTransaction[] = this.storageRepo.getSales();
    const existingOperationIds: string[] = [];

    for (const sale of existingSales) {
      if (sale.voucherExtractedData?.operationId) {
        existingOperationIds.push(sale.voucherExtractedData.operationId);
      }
      if (sale.mpApiVerification?.mpTransactionId) {
        existingOperationIds.push(sale.mpApiVerification.mpTransactionId);
      }
    }

    // 2. Invocar el puerto de análisis
    const result = await this.voucherAnalyzer.analyzeVoucher({
      base64Image,
      expectedAmount,
      existingOperationIds
    });

    return result;
  }
}
