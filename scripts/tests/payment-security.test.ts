/** HTTP/transaction contract tests with simulated PostgreSQL/provider, never remote payment calls. */
import { test,after,beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import { Pool } from 'pg';
import { once } from 'node:events';
Object.assign(process.env,{ NODE_ENV:'test',DATABASE_URL:'postgresql://fixture:fixture@127.0.0.1:1/bank_test',SGMO_ENABLE_API_TOKENS:'true',
  MERCADOPAGO_ACCESS_TOKEN:crypto.randomBytes(32).toString('hex'),MERCADOPAGO_COLLECTOR_ID:'987654',MERCADOPAGO_WEBHOOK_SECRET:crypto.randomBytes(32).toString('hex'),SGMO_PUBLIC_ORIGIN:'https://sgmo.example' });
let sale:any,payment:any,account:any,claims:any[]=[],events:any[]=[],statements:string[]=[],providerCalls=0,providerFailure=false,dbFailure:string|null=null;
const originalQuery=Pool.prototype.query,originalConnect=Pool.prototype.connect;
const execute=async(sql:string,params:any[]=[])=>{
  statements.push(sql);if(dbFailure&&sql.includes(dbFailure))throw new Error('Private internal failure');
  if(sql.includes('FROM sales s JOIN daily_shifts')||sql.includes('FROM sales WHERE id=$1 FOR UPDATE'))return{rows:[{...sale}],rowCount:1};
  if(sql.includes('FROM bank_payment_claims')&&sql.includes(' OR sale_id='))return{rows:claims.filter(claim=>claim.payment_id===params[0]||claim.sale_id===params[1]),rowCount:claims.length};
  if(sql.includes('INSERT INTO bank_payment_claims')){claims=[{payment_id:params[0],sale_id:params[1],bank_updated_at:params[5]}];return{rows:[],rowCount:1};}
  if(sql.includes('UPDATE sales SET validation_status')){sale.validation_status=params[1];sale.mp_api_verification=JSON.parse(params[2]);return{rows:[],rowCount:1};}
  if(sql.includes('FROM bank_payment_claims WHERE payment_id='))return{rows:claims,rowCount:claims.length};
  if(sql.includes('SELECT id FROM sales WHERE id='))return{rows:params[0]===sale.id?[{id:sale.id}]:[],rowCount:1};
  if(sql.includes('INSERT INTO bank_webhook_events')){if(!events.some(event=>event.id===params[0]))events.push({id:params[0],payment_id:params[1],state:'received'});return{rows:[],rowCount:1};}
  if(sql.includes('UPDATE bank_webhook_events')){events.filter(event=>event.id===params[0]).forEach(event=>event.state=params[1]);return{rows:[],rowCount:1};}
  if(sql.includes('FROM bank_webhook_events'))return{rows:events,rowCount:events.length};
  return{rows:[],rowCount:1};
};
Pool.prototype.query=execute as any;Pool.prototype.connect=(async()=>({query:execute,release(){}})) as any;
const { sessionManager }=await import('../../src/server/auth/sessionManager');const originalValidate=sessionManager.validateToken;sessionManager.validateToken=async()=>account;
const { paymentRouter,normalizeBankPayment,validateWebhookSignature }=await import('../../src/server/routes/paymentRoutes');
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
  if(!String(input).startsWith('https://api.mercadopago.com/'))return originalFetch(input,options);
  providerCalls++;if(providerFailure)throw new Error('Private provider failure');
  if(String(input).includes('/checkout/preferences')){const payload=JSON.parse(String(options?.body));assert.equal(payload.items[0].unit_price,sale.amount);assert.equal(payload.external_reference,sale.id);assert.equal('payer'in payload,false);return Response.json({id:'PREFERENCE',init_point:'https://www.mercadopago.com.ar/checkout/official'});}
  if(String(input).includes('/payments/search'))return Response.json({results:[{...payment,payer:{email:'private@buyer.example'}}]});
  return Response.json(payment);
};
const app=express();app.use(express.json());app.use('/api/mercadopago',paymentRouter);
const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as any).port}/api/mercadopago`;
const request=async(path:string,body?:unknown,headers:Record<string,string>={})=>{const response=await originalFetch(`${base}${path}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-SGMO-Client':'api',Authorization:`Bearer ${'a'.repeat(64)}`,...headers},body:body===undefined?undefined:JSON.stringify(body)});return{status:response.status,body:await response.json()};};
after(async()=>{globalThis.fetch=originalFetch;sessionManager.validateToken=originalValidate;Pool.prototype.query=originalQuery;Pool.prototype.connect=originalConnect;await new Promise<void>(resolve=>server.close(()=>resolve()));});
beforeEach(()=>{const now=new Date().toISOString();sale={id:'SALE-1',shift_id:'SHIFT-1',seller_id:'SELLER-1',coordinator_id:'COORD-1',amount:1500,payment_method:'mercado_pago',validation_status:'pendiente_revision',shift_date:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires'}).format(new Date()),shift_start:new Date(Date.now()-60000).toISOString()};payment={id:'123456789',collector_id:987654,transaction_amount:1500,currency_id:'ARS',status:'approved',live_mode:true,transaction_amount_refunded:0,external_reference:sale.id,date_created:now,date_last_updated:now};account={userId:'SELLER-1',role:'seller'};claims=[];events=[];statements=[];providerCalls=0;providerFailure=false;dbFailure=null;});

test('live bank approval ignores client price/duplicate list and persists unique evidence',async()=>{const response=await request('/verify-payment',{saleId:sale.id,operationId:payment.id,expectedAmount:1,existingOperationIds:[payment.id]});assert.equal(response.status,200);assert.equal(response.body.verified,true);assert.equal(response.body.expectedAmount,1500);assert.equal(claims.length,1);assert.equal(sale.validation_status,'validada');assert.equal(JSON.stringify(response.body).includes('payer'),false);});

test('seller/coordinator ownership is required before any bank call',async()=>{for(const profile of[{userId:'OTHER',role:'seller'},{userId:'OTHER',role:'coordinator'},{userId:'FACTORY',role:'factory_worker'}]){account=profile;assert.equal((await request('/verify-payment',{saleId:sale.id,operationId:payment.id})).status,403);}assert.equal(providerCalls,0);});

test('currency/recipient/amount/refund/sandbox/status/reference/date mismatches cannot credit',async()=>{for(const patch of[{currency_id:'BRL'},{collector_id:333},{transaction_amount:1499.99},{transaction_amount_refunded:1},{live_mode:false},{status:'rejected'},{external_reference:'OTHER-SALE'},{date_created:new Date(Date.now()-86400000).toISOString()}]){const initial={...payment};Object.assign(payment,patch);const response=await request('/verify-payment',{saleId:sale.id,operationId:payment.id});assert.equal(response.status,200);assert.equal(response.body.verified,false);assert.equal(claims.length,0);payment=initial;}});

test('duplicate claims and stale approvals cannot overwrite newer banking evidence',async()=>{claims=[{payment_id:payment.id,sale_id:'OTHER-SALE',bank_updated_at:payment.date_last_updated}];assert.equal((await request('/verify-payment',{saleId:sale.id,operationId:payment.id})).status,409);claims=[{payment_id:payment.id,sale_id:sale.id,bank_updated_at:new Date(Date.now()+60000).toISOString()}];const stale=await request('/verify-payment',{saleId:sale.id,operationId:payment.id});assert.equal(stale.status,409);assert.equal(stale.body.code,'STALE_BANK_RESPONSE');});

test('missing sale, SIM/TEST and provider/database failure cannot invent approval',async()=>{assert.equal((await request('/verify-payment',{operationId:'SIM-OK-12345'})).status,400);assert.equal((await request('/verify-payment',{saleId:sale.id,operationId:'SIM-OK-12345'})).status,400);providerFailure=true;assert.equal((await request('/verify-payment',{saleId:sale.id,operationId:payment.id})).status,503);providerFailure=false;dbFailure='INSERT INTO bank_payment_claims';assert.equal((await request('/verify-payment',{saleId:sale.id,operationId:payment.id})).status,503);assert.ok(statements.includes('ROLLBACK'));});

test('preferences use central sale totals, status/history omit payer data and token prefix',async()=>{assert.equal((await request('/create-preference',{saleId:sale.id,amount:1,quantity:999,payerEmail:'private@buyer.example'})).status,200);account={userId:'ADMIN',role:'admin'};for(const path of['/status','/recent-payments']){const response=await request(path);assert.equal(response.status,200);assert.equal(JSON.stringify(response.body).includes('private@buyer'),false);assert.equal(JSON.stringify(response.body).includes('tokenPrefix'),false);}});

test('signed webhook stores durably before 200, deduplicates and retries after failure',async()=>{const timestamp=String(Date.now()),requestId='webhook-request';const manifest=`id:${payment.id};request-id:${requestId};ts:${timestamp};`;const signature=crypto.createHmac('sha256',process.env.MERCADOPAGO_WEBHOOK_SECRET!).update(manifest).digest('hex');const headers={'x-request-id':requestId,'x-signature':`ts=${timestamp},v1=${signature}`};const body={type:'payment',data:{id:payment.id},status:'body-must-not-authorize'};assert.equal((await request('/webhook',body,headers)).status,401);assert.equal((await request(`/webhook?data.id=${payment.id}`,body,{'x-request-id':requestId,'x-signature':`ts=${timestamp},v1=${'b'.repeat(64)}`})).status,401);for(let index=0;index<2;index++)assert.equal((await request(`/webhook?data.id=${payment.id}`,body,headers)).status,200);assert.equal(events.length,1);assert.equal(claims.length,1);assert.ok(statements.findIndex(sql=>sql.includes('INSERT INTO bank_webhook_events'))<statements.findIndex(sql=>sql.includes('INSERT INTO bank_payment_claims')));providerFailure=true;assert.equal((await request(`/webhook?data.id=${payment.id}`,body,headers)).status,503);assert.equal(events[0].state,'failed');providerFailure=false;assert.equal((await request(`/webhook?data.id=${payment.id}`,body,headers)).status,200);dbFailure='INSERT INTO bank_webhook_events';assert.equal((await request(`/webhook?data.id=${payment.id}`,body,headers)).status,503);});

test('strict parsers reject invalid money and ambiguous signature fields',()=>{for(const amount of[null,false,{},'1500.001','NaN',NaN,1500.001])assert.throws(()=>normalizeBankPayment({...payment,transaction_amount:amount},payment.id));assert.equal(validateWebhookSignature({query:{'data.id':payment.id},headers:{'x-request-id':'request','x-signature':`ts=${Date.now()},ts=${Date.now()},v1=${'a'.repeat(64)}`}} as never,'secret'),null);});
