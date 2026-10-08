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

export class MercadoPagoAdapter implements IPaymentGateway {
  private baseUrl = '/api/mercadopago';

  async getStatus(): Promise<PaymentGatewayStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/status`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      return {
        isConfigured: !!data.isConfigured,
        hasAccessToken: !!data.hasAccessToken,
        tokenPrefix: data.tokenPrefix,
        mode: data.mode || 'sandbox',
        publicKey: data.publicKey
      };
    } catch {
      return {
        isConfigured: false,
        hasAccessToken: false,
        mode: 'mock'
      };
    }
  }

  async createPreference(
    input: CreatePaymentPreferenceInput
  ): Promise<CreatePaymentPreferenceResult> {
    try {
      const response = await fetch(`${this.baseUrl}/create-preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        preferenceId: data.preferenceId || data.id,
        initPoint: data.initPoint || '',
        sandboxInitPoint: data.sandboxInitPoint || data.initPoint || ''
      };
    } catch (err: any) {
      // Contingencia local si el backend no responde
      const fakeId = `pref_mock_${Date.now()}`;
      return {
        preferenceId: fakeId,
        initPoint: `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${fakeId}`,
        sandboxInitPoint: `https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=${fakeId}`
      };
    }
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    try {
      const response = await fetch(`${this.baseUrl}/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        verified: data.verified === true,
        status: data.status || (data.verified ? 'approved' : 'pending'),
        amount: Number(data.amount) || input.expectedAmount,
        operationId: String(data.operationId || input.paymentId),
        dateCreated: data.dateCreated,
        payerEmail: data.payerEmail,
        paymentMethodId: data.paymentMethodId,
        isSimulated: false,
        message: data.message
      };
    } catch (err: any) {
      // Fallback contingente para evitar bloqueo en la arena
      return {
        verified: false,
        status: 'pending',
        amount: input.expectedAmount,
        operationId: input.paymentId,
        isSimulated: true,
        message: 'No se pudo contactar con la API oficial de Mercado Pago (Modo sin conexión).'
      };
    }
  }
}

export const mercadoPagoAdapter = new MercadoPagoAdapter();
