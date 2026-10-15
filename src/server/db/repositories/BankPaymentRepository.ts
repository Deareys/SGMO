/** Only official bank responses reach this repository; OCR/client proof is never an input. */
import { query, withTransaction } from '../connection.js';
import type { UserRole } from '../../../types';

export class PaymentError extends Error {
  constructor(public code: string, public status: number, message: string) { super(message); }
}
export interface BankPayment {
  id: string; collectorId: string; amount: number; currency: string; status: string;
  live: boolean; refunded: number; externalReference?: string; dateCreated: string; dateUpdated: string;
}
export interface BankActor { userId: string; role: UserRole }

export class BankPaymentRepository {
  async readSale(saleId: string, actor?: BankActor): Promise<any> {
    const result = await query(`SELECT s.id, s.shift_id, s.seller_id, s.total_amount::float AS amount,
      s.payment_method, s.validation_status, s.mp_api_verification, d.status AS shift_status,
      d.coordinator_id,d.date::text AS shift_date,d.start_time AS shift_start
      FROM sales s JOIN daily_shifts d ON d.id=s.shift_id WHERE s.id=$1`, [saleId]);
    const sale = result.rows[0];
    if (!sale) throw new PaymentError('SALE_NOT_FOUND', 404, 'Venta central no encontrada.');
    if (actor && actor.role!=='admin' && !(actor.role==='coordinator' && (actor.userId===sale.coordinator_id || actor.userId===sale.seller_id))
        && !(actor.role==='seller' && actor.userId===sale.seller_id)) {
      throw new PaymentError('FORBIDDEN', 403, 'Venta ajena a esta cuenta.');
    }
    if (!['mercado_pago','transferencia'].includes(sale.payment_method)) throw new PaymentError('INVALID_PAYMENT_METHOD', 400, 'La venta no usa pago digital.');
    return sale;
  }

  /** Serialize with sales/close under the same shift lock and enforce unique payment/sale claims. */
  async applyPayment(saleId: string, payment: BankPayment, expectedCollector: string, actor?: BankActor): Promise<any> {
    const initial = await this.readSale(saleId, actor);
    return withTransaction(async (client) => {
      await client.query('SELECT id FROM daily_shifts WHERE id=$1 FOR UPDATE', [initial.shift_id]);
      const result = await client.query(`SELECT id,shift_id,seller_id,total_amount::float AS amount,payment_method,mp_api_verification FROM sales WHERE id=$1 FOR UPDATE`, [saleId]);
      const sale = result.rows[0];
      if (!sale || sale.shift_id !== initial.shift_id || sale.seller_id !== initial.seller_id || sale.amount !== initial.amount) {
        throw new PaymentError('SALE_CHANGED', 409, 'La venta cambió durante la verificación.');
      }
      await client.query("SELECT pg_advisory_xact_lock(hashtext('sgmo.bank.' || $1))", [payment.id]);
      const claims = await client.query('SELECT payment_id,sale_id,bank_updated_at FROM bank_payment_claims WHERE payment_id=$1 OR sale_id=$2', [payment.id, saleId]);
      if (claims.rows.some((claim) => claim.sale_id !== saleId || claim.payment_id !== payment.id)) {
        throw new PaymentError('PAYMENT_ALREADY_CLAIMED', 409, 'El pago o la venta ya tienen otra asignación bancaria.');
      }
      const amountMatches = Math.round(payment.amount * 100) === Math.round(sale.amount * 100);
      const recipientMatches = payment.collectorId === expectedCollector;
      const referenceMatches = !payment.externalReference || payment.externalReference === saleId;
      const paymentDay = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires'}).format(new Date(payment.dateCreated));
      const dateMatches = paymentDay===initial.shift_date && Date.parse(payment.dateCreated)>=new Date(initial.shift_start).getTime()-5*60*1000;
      // Network requests can finish out of order; an old approval cannot overwrite a later refund.
      const previousUpdated = claims.rows[0]?.bank_updated_at
        || (sale.mp_api_verification?.mpTransactionId===payment.id ? sale.mp_api_verification?.bankUpdatedAt : undefined);
      if (previousUpdated && new Date(previousUpdated).getTime()>Date.parse(payment.dateUpdated)) {
        throw new PaymentError('STALE_BANK_RESPONSE',409,'Existe evidencia bancaria más reciente. Volvé a consultar.');
      }
      const verified = payment.status === 'approved' && payment.live && payment.refunded === 0
        && payment.currency === 'ARS' && recipientMatches && amountMatches && referenceMatches && dateMatches;
      const evidence = { matchedInApi: verified, mpTransactionId: payment.id, apiStatus: payment.status,
        verifiedAt: new Date().toISOString(), amount: payment.amount, amountMatches,
        recipientMatches, dateMatches,bankUpdatedAt:payment.dateUpdated,currencyMatches: payment.currency === 'ARS', isDuplicate: false, isLiveApi: payment.live,
        message: verified ? 'Pago acreditado y asignado a esta venta.' : 'Pago sin acreditación válida para esta venta.' };
      if (verified) {
        await client.query(`INSERT INTO bank_payment_claims(payment_id,sale_id,collector_id,amount,currency_id,status,bank_updated_at)
          VALUES($1,$2,$3,$4,'ARS',$5,$6) ON CONFLICT(payment_id) DO UPDATE SET status=EXCLUDED.status,bank_updated_at=EXCLUDED.bank_updated_at,verified_at=CURRENT_TIMESTAMP`,
        [payment.id,saleId,payment.collectorId,payment.amount,payment.status,payment.dateUpdated]);
      } else if (claims.rows.length) {
        // A refund/cancellation must invalidate the existing claim's financial evidence.
        await client.query('UPDATE bank_payment_claims SET status=$2,bank_updated_at=$3,verified_at=CURRENT_TIMESTAMP WHERE payment_id=$1', [payment.id,payment.status,payment.dateUpdated]);
      }
      await client.query(`UPDATE sales SET validation_status=$2,mp_api_verification=$3::jsonb WHERE id=$1`,
        [saleId,verified ? 'validada' : 'pendiente_revision',JSON.stringify(evidence)]);
      await client.query(`UPDATE daily_shifts SET
        mp_validated_amount=(SELECT COALESCE(SUM(total_amount),0) FROM sales WHERE shift_id=$1 AND payment_method!='efectivo'
          AND validation_status='validada' AND mp_api_verification->>'matchedInApi'='true' AND mp_api_verification->>'isLiveApi'='true'),
        mp_pending_or_suspicious_amount=(SELECT COALESCE(SUM(total_amount),0) FROM sales WHERE shift_id=$1 AND payment_method!='efectivo'
          AND NOT(validation_status='validada' AND COALESCE(mp_api_verification->>'matchedInApi','false')='true' AND COALESCE(mp_api_verification->>'isLiveApi','false')='true')),
        updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status IN ('planificada','en_curso','esperando_cierre')`, [sale.shift_id]);
      return { verified, amountMatches, expectedAmount: sale.amount, evidence };
    });
  }

  async findSaleForPayment(payment: BankPayment): Promise<string | null> {
    const claims = await query('SELECT sale_id FROM bank_payment_claims WHERE payment_id=$1', [payment.id]);
    if (claims.rows[0]) return claims.rows[0].sale_id;
    if (!payment.externalReference || !/^[A-Za-z0-9_-]{1,64}$/.test(payment.externalReference)) return null;
    const sale = await query('SELECT id FROM sales WHERE id=$1', [payment.externalReference]);
    return sale.rows[0]?.id || null;
  }

  async storeWebhook(event: { id: string; paymentId: string; requestId: string; timestamp: string }): Promise<void> {
    await query(`INSERT INTO bank_webhook_events(id,payment_id,request_id,signature_timestamp) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING`,
      [event.id,event.paymentId,event.requestId,event.timestamp]);
  }
  async webhookOutcome(id: string, state: 'processed' | 'unmatched' | 'failed', summary?: unknown): Promise<void> {
    await query(`UPDATE bank_webhook_events SET state=$2,attempts=attempts+1,summary=$3::jsonb,processed_at=CURRENT_TIMESTAMP WHERE id=$1`, [id,state,JSON.stringify(summary ?? null)]);
  }
}
export const bankPaymentRepository = new BankPaymentRepository();
