/** Mercado Pago: official verification + PostgreSQL claims + authenticated durable webhook inbox.
 * A receipt/OCR result or client amount never constitutes bank evidence.
 */
import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { authenticateToken, requireRole } from '../auth/authMiddleware';
import { isIsolatedDemoEnabled } from '../auth/authPolicy';
import { isDbConfigured, query } from '../db/connection';
import { bankPaymentRepository, PaymentError, type BankPayment } from '../db/repositories/BankPaymentRepository';

export const paymentRouter = Router();
const accessToken = () => process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN;
const actor = (req: Request) => ({ userId: req.userSession!.userId, role: req.userSession!.role });
const unavailable = (res: Response) => res.status(503).json({ success:false,verified:false,status:'pending',code:'PAYMENT_SERVICE_UNAVAILABLE',message:'La verificación bancaria no está disponible. El pago permanece pendiente.' });
const saleIdFrom = (req: Request) => typeof req.body?.saleId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(req.body.saleId) ? req.body.saleId : null;
const fail = (res: Response, error: unknown) => error instanceof PaymentError
  ? res.status(error.status).json({ success:false,verified:false,isDuplicate:error.code==='PAYMENT_ALREADY_CLAIMED',code:error.code,status:error.code==='PAYMENT_ALREADY_CLAIMED'?'duplicate_flagged':'pending',message:error.message }) : unavailable(res);

async function officialRequest(path: string, init: RequestInit = {}): Promise<globalThis.Response> {
  const token = accessToken();
  if (!token) throw new Error('Payment service unavailable');
  return fetch(`https://api.mercadopago.com${path}`, { ...init, redirect:'error', signal:AbortSignal.timeout(5000),
    headers:{ 'Content-Type':'application/json', ...init.headers, Authorization:`Bearer ${token}` } });
}

async function expectedCollector(): Promise<string> {
  const configured = process.env.MERCADOPAGO_COLLECTOR_ID;
  if (configured && /^\d{1,32}$/.test(configured)) return configured;
  if (configured) throw new Error('Invalid collector configuration');
  const response = await officialRequest('/users/me');
  if (!response.ok) throw new Error('Collector unavailable');
  const user = await response.json();
  if (!/^\d{1,32}$/.test(String(user.id))) throw new Error('Collector unavailable');
  return String(user.id);
}

export function normalizeBankPayment(value: any, requestedId: string): BankPayment {
  const money = (amount: unknown) => (typeof amount==='number' || (typeof amount==='string' && /^\d+(\.\d{1,2})?$/.test(amount)))
    && Number.isFinite(Number(amount)) && Number(amount)<1e10
    && Math.abs(Number(amount)*100-Math.round(Number(amount)*100))<0.000001;
  if (!value || String(value.id) !== requestedId || !/^\d{1,32}$/.test(String(value.collector_id))
      || !money(value.transaction_amount) || Number(value.transaction_amount)<=0
      || !money(value.transaction_amount_refunded) || Number(value.transaction_amount_refunded)<0
      || typeof value.date_created!=='string' || !Number.isFinite(Date.parse(value.date_created))
      || typeof value.date_last_updated!=='string' || !Number.isFinite(Date.parse(value.date_last_updated))
      || typeof value.status !== 'string' || typeof value.currency_id !== 'string') throw new Error('Invalid bank response');
  return { id:requestedId,collectorId:String(value.collector_id),amount:Number(value.transaction_amount),
    currency:value.currency_id,status:value.status,live:value.live_mode===true,refunded:Number(value.transaction_amount_refunded),
    externalReference:typeof value.external_reference==='string'?value.external_reference:undefined,
    dateCreated:value.date_created,dateUpdated:value.date_last_updated };
}

async function obtainPayment(paymentId: string): Promise<BankPayment> {
  const response = await officialRequest(`/v1/payments/${paymentId}`);
  if (response.status===404) throw new PaymentError('PAYMENT_NOT_FOUND',404,'Pago no encontrado en la API oficial.');
  if (!response.ok) throw new Error('Bank unavailable');
  return normalizeBankPayment(await response.json(),paymentId);
}

paymentRouter.get('/status',authenticateToken,requireRole('admin','coordinator','seller'),(_req,res) => {
  const configured = Boolean(accessToken());
  res.json({ configured,isConfigured:configured,hasAccessToken:configured,
    mode:configured?(accessToken()!.startsWith('TEST-')?'sandbox':'production'):isIsolatedDemoEnabled()?'demo':'unconfigured',demo:isIsolatedDemoEnabled(),
    message:configured?'Credenciales bancarias configuradas; cada pago requiere verificación oficial.':'La verificación bancaria requiere configuración del servidor.' });
});

paymentRouter.post('/verify-payment',authenticateToken,requireRole('admin','coordinator','seller'),async(req,res) => {
  const saleId = saleIdFrom(req);
  if (!saleId) return res.status(400).json({ success:false,verified:false,code:'SALE_REQUIRED',message:'Debe identificar una venta central.' });
  const supplied = req.body?.operationId ?? req.body?.paymentId;
  if (typeof supplied!=='string') return res.status(400).json({ success:false,verified:false,code:'INVALID_PAYMENT_ID' });
  if (isIsolatedDemoEnabled() && /^(TEST|SIM)-/.test(supplied)) {
    return res.json({ success:true,verified:false,status:'pending',operationId:supplied,isLiveApi:false,isSimulated:true,amountMatches:false,message:'Simulación sin validez bancaria. No acredita ni asigna dinero.' });
  }
  if (!/^\d{1,32}$/.test(supplied)) return res.status(400).json({ success:false,verified:false,code:'INVALID_PAYMENT_ID' });
  if (!isDbConfigured() || !accessToken()) return unavailable(res);
  try {
    await bankPaymentRepository.readSale(saleId,actor(req));
    const collector = await expectedCollector();
    const payment = await obtainPayment(supplied);
    const applied = await bankPaymentRepository.applyPayment(saleId,payment,collector,actor(req));
    return res.json({ success:true,verified:applied.verified,status:payment.status,operationId:payment.id,
      amount:payment.amount,expectedAmount:applied.expectedAmount,amountMatches:applied.amountMatches,
      isDuplicate:false,isLiveApi:payment.live,isSimulated:!payment.live,dateCreated:payment.dateCreated,message:applied.evidence.message });
  } catch(error) { return fail(res,error); }
});

paymentRouter.post('/create-preference',authenticateToken,requireRole('admin','coordinator','seller'),async(req,res) => {
  const saleId = saleIdFrom(req);
  if (!saleId) return res.status(400).json({ success:false,code:'SALE_REQUIRED',message:'Guardá y sincronizá la venta antes de generar el cobro.' });
  if (!isDbConfigured() || !accessToken()) return unavailable(res);
  try {
    const sale = await bankPaymentRepository.readSale(saleId,actor(req));
    if (sale.validation_status==='validada') throw new PaymentError('SALE_ALREADY_PAID',409,'La venta ya tiene pago validado.');
    const origin = process.env.SGMO_PUBLIC_ORIGIN || (process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:undefined);
    if (!origin || new URL(origin).origin!==origin || !origin.startsWith('https://')) return unavailable(res);
    const response = await officialRequest('/checkout/preferences',{ method:'POST',body:JSON.stringify({
      items:[{ id:saleId,title:'Venta Tequeños Costa',quantity:1,unit_price:sale.amount,currency_id:'ARS' }],
      external_reference:saleId,notification_url:`${origin}/api/mercadopago/webhook`,
      back_urls:{ success:`${origin}/?mp_status=returned`,failure:`${origin}/?mp_status=failure`,pending:`${origin}/?mp_status=pending` }
    }) });
    if (!response.ok) return unavailable(res);
    const preference = await response.json();
    const allowedCheckout = (link: unknown) => typeof link==='string' && /^https:\/\/(www\.|sandbox\.)?mercadopago\.com\.ar\//.test(link);
    if (typeof preference.id!=='string' || !allowedCheckout(preference.init_point)) return unavailable(res);
    return res.json({ success:true,preferenceId:preference.id,initPoint:preference.init_point,
      sandboxInitPoint:allowedCheckout(preference.sandbox_init_point)?preference.sandbox_init_point:undefined,amount:sale.amount,quantity:1 });
  } catch(error) { return fail(res,error); }
});

paymentRouter.get('/recent-payments',authenticateToken,requireRole('admin','coordinator'),async(_req,res) => {
  try {
    const collector = await expectedCollector();
    const response = await officialRequest('/v1/payments/search?sort=date_created&criteria=desc&limit=15');
    if (!response.ok) return unavailable(res);
    const body = await response.json();
    const payments = (Array.isArray(body.results)?body.results:[]).filter((payment:any) => String(payment.collector_id)===collector)
      .map((payment:any) => ({ id:String(payment.id),status:payment.status,amount:Number(payment.transaction_amount),
        currencyId:payment.currency_id,dateCreated:payment.date_created,dateApproved:payment.date_approved }));
    return res.json({ success:true,total:payments.length,payments });
  } catch { return unavailable(res); }
});

/** Official manifest uses data.id from QUERY, request-id and the original ts string, not body IDs. */
export function validateWebhookSignature(req: Request, secret: string): { id:string;paymentId:string;requestId:string;timestamp:string } | null {
  const paymentId = req.query?.['data.id'];
  const requestId = req.headers['x-request-id'];
  const signature = req.headers['x-signature'];
  if (typeof paymentId!=='string' || !/^\d{1,32}$/.test(paymentId) || typeof requestId!=='string'
      || !/^[A-Za-z0-9_-]{1,128}$/.test(requestId) || typeof signature!=='string' || signature.length>256) return null;
  const parts = signature.split(',').map((part)=>part.trim().split('='));
  if (parts.length!==2 || parts.some((part)=>part.length!==2) || new Set(parts.map((part)=>part[0])).size!==2) return null;
  const timestamp = parts.find((part)=>part[0]==='ts')?.[1];
  const hash = parts.find((part)=>part[0]==='v1')?.[1];
  if (!timestamp || !/^\d{10,13}$/.test(timestamp) || !hash || !/^[a-f0-9]{64}$/i.test(hash)) return null;
  const manifest = `id:${paymentId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
  const expected = crypto.createHmac('sha256',secret).update(manifest).digest();
  if (!crypto.timingSafeEqual(expected,Buffer.from(hash,'hex'))) return null;
  return { id:crypto.createHash('sha256').update(manifest).digest('hex'),paymentId,requestId,timestamp };
}

async function processWebhook(id:string,paymentId:string): Promise<'processed'|'unmatched'> {
  const collector = await expectedCollector();
  const payment = await obtainPayment(paymentId);
  const saleId = await bankPaymentRepository.findSaleForPayment(payment);
  if (saleId) await bankPaymentRepository.applyPayment(saleId,payment,collector);
  const state = saleId?'processed':'unmatched';
  await bankPaymentRepository.webhookOutcome(id,state,{ status:payment.status,amount:payment.amount,currency:payment.currency,assigned:Boolean(saleId) });
  return state;
}

export async function handleMercadoPagoWebhook(req:Request,res:Response): Promise<void> {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret || !isDbConfigured()) { unavailable(res); return; }
  const signed = validateWebhookSignature(req,secret);
  if (!signed) { res.status(401).json({ received:false,code:'INVALID_WEBHOOK_SIGNATURE' }); return; }
  if (req.body?.type!=='payment' || String(req.body?.data?.id)!==signed.paymentId) {
    res.status(400).json({ received:false,code:'INVALID_WEBHOOK_RESOURCE' }); return;
  }
  try {
    await bankPaymentRepository.storeWebhook(signed); // Never acknowledge before a durable inbox exists.
    const state = await processWebhook(signed.id,signed.paymentId);
    res.status(200).json({ received:true,state });
  } catch {
    try { await bankPaymentRepository.webhookOutcome(signed.id,'failed'); } catch { /* No success response on a failed durable write. */ }
    unavailable(res);
  }
}
paymentRouter.post('/webhook',handleMercadoPagoWebhook);
paymentRouter.get('/webhooks',authenticateToken,requireRole('admin'),async(_req,res) => {
  try { const result = await query('SELECT id,payment_id,state,attempts,received_at,processed_at,summary FROM bank_webhook_events ORDER BY received_at DESC LIMIT 100'); res.json({ success:true,events:result.rows }); }
  catch { unavailable(res); }
});
paymentRouter.post('/webhooks/:eventId/retry',authenticateToken,requireRole('admin'),async(req,res) => {
  if (!/^[a-f0-9]{64}$/.test(req.params.eventId)) { res.status(400).json({ success:false }); return; }
  try {
    const event = await query('SELECT id,payment_id FROM bank_webhook_events WHERE id=$1',[req.params.eventId]);
    if (!event.rows[0]) { res.status(404).json({ success:false }); return; }
    const state = await processWebhook(event.rows[0].id,event.rows[0].payment_id);
    res.json({ success:true,state });
  } catch { unavailable(res); }
});
paymentRouter.post('/verify',authenticateToken,(_req,res)=>{ res.status(410).json({ success:false,verified:false,code:'LEGACY_PAYMENT_ENDPOINT_REMOVED' }); });
