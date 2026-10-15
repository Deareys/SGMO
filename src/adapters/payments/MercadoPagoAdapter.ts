/**
 * SGMO — Tequeños Costa
 * Payment Adapter: Mercado Pago Oficial
 *
 * Implementa el puerto IPaymentGateway para comunicarse de forma segura
 * con el backend Express (/api/mercadopago/*) y manejar contingencias en playa.
 */

import {
  IPaymentGateway,
  CreatePaymentPreferenceInput,
  CreatePaymentPreferenceResult,
  VerifyPaymentInput,
  VerifyPaymentResult,
  PaymentGatewayStatus
} from '../../core/ports/IPaymentGateway';
import { authenticatedFetch } from '../../services/apiClient';

export class MercadoPagoAdapter implements IPaymentGateway {
  private baseUrl = '/api/mercadopago';

  async getStatus(): Promise<PaymentGatewayStatus> {
    try {
      const response = await authenticatedFetch(`${this.baseUrl}/status`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      return {
        isConfigured: !!data.isConfigured,
        hasAccessToken: !!data.hasAccessToken,
        tokenPrefix: data.tokenPrefix,
        mode: data.mode || 'unconfigured',
        publicKey: data.publicKey
      };
    } catch {
      return {
        isConfigured: false,
        hasAccessToken: false,
        mode: 'unavailable'
      };
    }
  }

  async createPreference(input: CreatePaymentPreferenceInput): Promise<CreatePaymentPreferenceResult> {
    if (!input.saleId) throw new Error('Primero debe confirmar una venta central.');
    const response = await authenticatedFetch(`${this.baseUrl}/create-preference`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saleId: input.saleId })
    });
    if (!response.ok) throw new Error('No se pudo generar un enlace oficial de pago.');
    const result = await response.json();
    if (result.success !== true || typeof result.preferenceId !== 'string' || !result.preferenceId
        || typeof result.initPoint !== 'string' || !/^https:\/\/([a-z0-9-]+\.)*mercadopago\.(com|com\.ar)\//i.test(result.initPoint)) {
      throw new Error('El servidor no confirmó un enlace oficial de pago.');
    }
    return { preferenceId: result.preferenceId, initPoint: result.initPoint,
      sandboxInitPoint: typeof result.sandboxInitPoint === 'string' ? result.sandboxInitPoint : '' };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    if (!input.saleId) throw new Error('Primero debe confirmar una venta central.');
    try {
      const response = await authenticatedFetch(`${this.baseUrl}/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleId: input.saleId, operationId: input.paymentId })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        verified: data.verified === true && data.status === 'approved' && data.isLiveApi === true
          && data.amountMatches === true && data.isSimulated !== true
          && typeof data.amount === 'number' && Number.isFinite(data.amount) && data.amount > 0,
        status: data.status || 'pending',
        amount: typeof data.amount === 'number' && Number.isFinite(data.amount) ? data.amount : undefined,
        amountMatches: data.amountMatches === true,
        isLiveApi: data.isLiveApi === true,
        operationId: String(data.operationId || input.paymentId),
        dateCreated: data.dateCreated,
        payerEmail: data.payerEmail,
        paymentMethodId: data.paymentMethodId,
        isSimulated: data.isSimulated === true || data.isLiveApi !== true,
        message: data.message
      };
    } catch (err: any) {
      // Fallback contingente para evitar bloqueo en la arena
      return {
        verified: false,
        status: 'pending',
        amount: undefined,
        amountMatches: false,
        isLiveApi: false,
        operationId: input.paymentId,
        isSimulated: true,
        message: 'No se pudo contactar con la API oficial de Mercado Pago (Modo sin conexión).'
      };
    }
  }
}

export const mercadoPagoAdapter = new MercadoPagoAdapter();
