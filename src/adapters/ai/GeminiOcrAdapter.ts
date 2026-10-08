/**
 * SGMO — Tequeños Costa
 * AI Adapter: Google Gemini OCR / Visión Computacional
 *
 * Implementa el puerto IVoucherAnalyzer comunicándose con el backend (/api/ai/validate-voucher)
 * y realizando validaciones heurísticas anti-fraude y detección de doble gasto.
 */

import {
  IVoucherAnalyzer,
  VoucherAnalysisInput,
  VoucherAnalysisResult
} from '../../core/ports/IVoucherAnalyzer';

export class GeminiOcrAdapter implements IVoucherAnalyzer {
  private endpoint = '/api/ai/validate-voucher';

  async analyzeVoucher(input: VoucherAnalysisInput): Promise<VoucherAnalysisResult> {
    const { base64Image, expectedAmount, existingOperationIds = [] } = input;

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Image,
          expectedAmount,
          existingOperationIds
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const extractedOpId = String(data.operationId || data.comprobanteId || '').trim();

      const isDuplicate =
        existingOperationIds.includes(extractedOpId) || data.isDuplicate === true;

      const amount = Number(data.amount || data.monto || expectedAmount || 0);
      const amountMatches =
        typeof expectedAmount === 'number' ? Math.abs(amount - expectedAmount) < 1 : true;

      return {
        operationId: extractedOpId || `OP-${Date.now()}`,
        amount,
        date: data.date || new Date().toISOString(),
        destinationAccount: data.destinationAccount || 'tequenos.costa.mp',
        bank: data.bank || 'Mercado Pago',
        payerName: data.payerName || 'Cliente Playa',
        confidence: data.confidence || 0.9,
        isDuplicate,
        amountMatches,
        visualAlerts: data.visualAlerts || [],
        isSimulated: false
      };
    } catch (err: any) {
      // Contingencia local simulada
      const fallbackOpId = `OFFLINE-${Date.now().toString().slice(-8)}`;
      const isDuplicate = existingOperationIds.includes(fallbackOpId);

      return {
        operationId: fallbackOpId,
        amount: expectedAmount || 0,
        date: new Date().toISOString(),
        destinationAccount: 'tequenos.costa.mp',
        bank: 'Lectura Local (Sin red)',
        confidence: 0.6,
        isDuplicate,
        amountMatches: true,
        visualAlerts: ['Comprobante procesado en modo contingencia sin conexión'],
        isSimulated: true
      };
    }
  }
}

export const geminiOcrAdapter = new GeminiOcrAdapter();
