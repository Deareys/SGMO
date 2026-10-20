import { test,beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { verifyMercadoPagoPayment,createMercadoPagoPreference } from '../../src/services/aiValidationService';
import { resetCsrfToken } from '../../src/services/apiClient';
beforeEach(()=>resetCsrfToken());
test('client bank flag requires live approved matching real amount, never simulation',async()=>{
  const valid={success:true,verified:true,status:'approved',isLiveApi:true,amountMatches:true,amount:1500,operationId:'123456789'};
  for(const patch of [{status:'pending'},{isLiveApi:false},{isSimulated:true},{amountMatches:false},{amount:undefined},{amount:0},{amount:null},{}]){
    globalThis.fetch=async(url)=>url==='/api/auth/csrf'?Response.json({csrfToken:'a'.repeat(64)}):Response.json({...valid,...patch});
    const response=await verifyMercadoPagoPayment({saleId:'SALE-1',operationId:'123456789',expectedAmount:1});
    assert.equal(response.verified,Object.keys(patch).length===0);
  }
});
test('frontend sends only canonical sale identity and bank ID, never client financial proof',async()=>{
  const requests:Array<Record<string,unknown>>=[];
  globalThis.fetch=async(url,options)=>{
    if(url==='/api/auth/csrf')return Response.json({csrfToken:'a'.repeat(64)});
    requests.push(JSON.parse(String(options?.body)));return Response.json({success:true,verified:false,isLiveApi:false});
  };
  await verifyMercadoPagoPayment({saleId:'SALE-1',operationId:'123456789',expectedAmount:1,existingOperationIds:['another']});
  await createMercadoPagoPreference({saleId:'SALE-1',amount:1,quantity:999,title:'untrusted'});
  assert.deepEqual(requests,[{saleId:'SALE-1',operationId:'123456789'},{saleId:'SALE-1'}]);
});
