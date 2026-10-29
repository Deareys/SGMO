import { test,after } from 'node:test';
import assert from 'node:assert/strict';
import { GeminiOcrAdapter } from '../../src/adapters/ai/GeminiOcrAdapter';
import { analyzeVoucherWithAI } from '../../src/services/aiValidationService';
import { resetCsrfToken } from '../../src/services/apiClient';
const originalFetch=globalThis.fetch;after(()=>{globalThis.fetch=originalFetch;resetCsrfToken();});
const adapter=new GeminiOcrAdapter();
const expectedAmount=30;
const receipt={extractionSucceeded:true,validationStatus:'pendiente_revision',extractedData:{operationId:'OP-TEST',amount:30,date:'2026-10-13',senderName:'Titular leído',destinationAccount:'Cuenta leída',confidenceScore:0.82},matchResults:{amountMatches:true,isDuplicateOperationId:false,mpApiMatched:false}};
let capturedBody:any;
function stub(body:unknown,status=200,fail=false){resetCsrfToken();globalThis.fetch=async(input,init)=>{if(String(input)==='/api/auth/csrf')return new Response(JSON.stringify({csrfToken:'a'.repeat(64)}));capturedBody=JSON.parse(String(init?.body||'{}'));if(fail)throw new Error('Network unavailable');return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});};}
function unknown(result:any){assert.equal(result.operationId,'');assert.equal(result.amount,0);assert.equal(result.date,'');assert.equal(result.confidence,0);assert.equal(result.amountMatches,false);assert.equal(result.isSimulated,true);}
test('OCR envía saleAmount y lee nested extractedData; no afirma acreditación',async()=>{
 stub(receipt);const result=await adapter.analyzeVoucher({base64Image:'image',expectedAmount});assert.equal(capturedBody.saleAmount,30);assert.equal(Object.hasOwn(capturedBody,'expectedAmount'),false);assert.equal(result.operationId,'OP-TEST');assert.equal(result.amount,30);assert.equal(result.payerName,'Titular leído');assert.equal(result.amountMatches,true);assert.equal(result.isSimulated,false);assert.ok(result.visualAlerts?.some(alert=>alert.includes('no confirma')));
});
test('HTTPfallido, redcaída, bodyflat legado y extracción no confirmada mantienen datos desconocidos',async()=>{
 for(const candidate of [{body:receipt,status:503},{body:receipt,fail:true},{body:{operationId:'FORGED',amount:30,confidence:0.9}},{body:{...receipt,extractionSucceeded:false}},{body:{...receipt,extractedData:{...receipt.extractedData,amount:'30'}}}]){stub(candidate.body,candidate.status||200,candidate.fail);unknown(await adapter.analyzeVoucher({base64Image:'image',expectedAmount}));}
});
test('OCR detecta repetición de ID real sin fabricar identificador cuando falta',async()=>{
 stub(receipt);assert.equal((await adapter.analyzeVoucher({base64Image:'image',expectedAmount,existingOperationIds:['OP-TEST']})).isDuplicate,true);
 stub({...receipt,extractedData:{...receipt.extractedData,operationId:'',date:'',confidenceScore:0}});const result=await adapter.analyzeVoucher({base64Image:'image',expectedAmount});assert.equal(result.operationId,'');assert.equal(result.date,'');assert.equal(result.confidence,0);assert.equal(result.isDuplicate,false);
});
test('importe inesperado o ausente no coincide aunque backend diga true',async()=>{
 stub({...receipt,extractedData:{...receipt.extractedData,amount:15}});assert.equal((await adapter.analyzeVoucher({base64Image:'image',expectedAmount})).amountMatches,false);
 stub(receipt);assert.equal((await adapter.analyzeVoucher({base64Image:'image'})).amountMatches,false);
});
test('servicio heredado fallback deja OCR y estado bancario pendientes sin datos sintéticos',async()=>{
 stub({},503);const result=await analyzeVoucherWithAI({imageBase64:'image',saleAmount:30,saleVariety:'Variedad',sellerName:'Usuario',saleTimestamp:'2026-10-13',existingOperationIds:[]});assert.equal(result.extractedData.operationId,'');assert.equal(result.extractedData.amount,0);assert.equal(result.extractedData.date,'');assert.equal(result.extractedData.confidenceScore,0);assert.equal(result.validationStatus,'pendiente_revision');assert.equal(result.matchResults.amountMatches,false);assert.equal(result.matchResults.mpApiMatched,false);
});
