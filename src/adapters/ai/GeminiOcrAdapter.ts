/** OCR assists reading a receipt; it never proves payment crediting.
 * Uses the backend's nested extractedData/matchResults contract. Unknown readings
 * stay unknown: network errors never fabricate IDs, amounts, dates or confidence.
 */
import type { IVoucherAnalyzer, VoucherAnalysisInput, VoucherAnalysisResult } from '../../core/ports/IVoucherAnalyzer';
import { authenticatedFetch } from '../../services/apiClient';
const unknownReading = (): VoucherAnalysisResult => ({
  operationId: '', amount: 0, date: '', destinationAccount: '', bank: '', payerName: '',
  confidence: 0, isDuplicate: false, amountMatches: false,
  visualAlerts: ['Sin lectura OCR confirmada. Revisar el comprobante y verificar el pago en la cuenta receptora.'],
  isSimulated: true
});
const readable = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
export class GeminiOcrAdapter implements IVoucherAnalyzer {
  private endpoint = '/api/ai/validate-voucher';
  async analyzeVoucher(input: VoucherAnalysisInput): Promise<VoucherAnalysisResult> {
    const { base64Image, expectedAmount, existingOperationIds = [] } = input;
    try {
      const response = await authenticatedFetch(this.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64Image, saleAmount: expectedAmount, existingOperationIds })
      });
      if (!response.ok) return unknownReading();
      const result = await response.json();
      const extracted = result?.extractedData;
      const matches = result?.matchResults;
      // Older success-shaped fallbacks had positive confidence and random IDs.
      // Require the explicit extraction proof added to the backend contract.
      if (result?.extractionSucceeded !== true || !extracted || !matches
          || typeof extracted.amount !== 'number' || !Number.isFinite(extracted.amount) || extracted.amount < 0
          || typeof extracted.confidenceScore !== 'number' || !Number.isFinite(extracted.confidenceScore)
          || extracted.confidenceScore < 0 || extracted.confidenceScore > 1) return unknownReading();
      const operationId = readable(extracted.operationId);
      const alerts: string[] = [];
      if (extracted.isVisualAnomalyDetected === true) alerts.push('Posibles alteraciones visuales: requiere revisión.');
      if (!operationId) alerts.push('Número de operación ilegible: requiere revisión.');
      if (typeof matches.mismatchReason === 'string' && matches.mismatchReason.trim()) alerts.push(matches.mismatchReason.trim());
      alerts.push('OCR no confirma acreditación bancaria.');
      return {
        operationId, amount: extracted.amount, date: readable(extracted.date),
        destinationAccount: readable(extracted.destinationAccount), bank: readable(extracted.bank),
        payerName: readable(extracted.senderName), confidence: extracted.confidenceScore,
        isDuplicate: (operationId !== '' && existingOperationIds.includes(operationId)) || matches.isDuplicateOperationId === true,
        amountMatches: matches.amountMatches === true && typeof expectedAmount === 'number' && Number.isFinite(expectedAmount)
          && Math.abs(extracted.amount - expectedAmount) < 1,
        visualAlerts: alerts, isSimulated: false
      };
    } catch { return unknownReading(); }
  }
}
export const geminiOcrAdapter = new GeminiOcrAdapter();
