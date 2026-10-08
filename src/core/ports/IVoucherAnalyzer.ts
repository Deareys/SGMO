/**
 * SGMO — Tequeños Costa
 * Core Port: Analizador de Comprobantes de Pago (OCR / Computer Vision)
 *
 * Contrato abstracto para extraer datos de transferencias bancarias y comprobantes
 * sin acoplarse directamente a la API de Google Gemini o librerías locales de OCR.
 */

export interface VoucherAnalysisInput {
  base64Image: string;
  expectedAmount?: number;
  existingOperationIds?: string[];
}

export interface VoucherAnalysisResult {
  operationId: string;
  amount: number;
  date: string;
  destinationAccount?: string;
  bank?: string;
  payerName?: string;
  confidence: number;
  isDuplicate: boolean;
  amountMatches: boolean;
  visualAlerts?: string[];
  isSimulated?: boolean;
}

export interface IVoucherAnalyzer {
  analyzeVoucher(input: VoucherAnalysisInput): Promise<VoucherAnalysisResult>;
}
