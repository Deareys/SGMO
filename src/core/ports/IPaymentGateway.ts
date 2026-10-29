/**
 * SGMO — Tequeños Costa
 * Core Port: Pasarela de Pagos (Payment Gateway)
 *
 * Contrato abstracto para creación y verificación de pagos digitales
 * independientemente de si se usa Mercado Pago, MODO, Cuenta DNI o pasarelas mock.
 */

export interface CreatePaymentPreferenceInput {
  saleId: string;
  title: string;
  quantity: number;
  unitPrice: number;
  externalReference: string;
}

export interface CreatePaymentPreferenceResult {
  preferenceId: string;
  initPoint: string;
  sandboxInitPoint: string;
}

export interface VerifyPaymentInput {
  saleId: string;
  paymentId: string;
  expectedAmount: number;
  expectedReference?: string;
}

export interface VerifyPaymentResult {
  verified: boolean;
  status: 'approved' | 'pending' | 'rejected' | 'not_found' | 'error';
  amount?: number;
  amountMatches?: boolean;
  isLiveApi?: boolean;
  operationId: string;
  dateCreated?: string;
  payerEmail?: string;
  paymentMethodId?: string;
  isSimulated?: boolean;
  message?: string;
}

export interface PaymentGatewayStatus {
  isConfigured: boolean;
  hasAccessToken: boolean;
  tokenPrefix?: string;
  mode: 'sandbox' | 'production' | 'demo' | 'unconfigured' | 'unavailable';
  publicKey?: string;
}

export interface IPaymentGateway {
  getStatus(): Promise<PaymentGatewayStatus>;
  createPreference(input: CreatePaymentPreferenceInput): Promise<CreatePaymentPreferenceResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
}
