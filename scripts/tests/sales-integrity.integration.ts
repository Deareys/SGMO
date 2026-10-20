/** SQL real en PostgreSQL WASM efímero. No conecta red, no carga .env, no prueba multiinstancia. */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';
import type { DailyShift, SaleTransaction, ShiftRestockRecord, ShiftWasteRecord } from '../../src/types';
import { DataIntegrityError } from '../../src/server/db/salesValidation';

const mode = process.argv[2] ?? '--wasm';
if (!['--postgres','--wasm'].includes(mode)) throw new Error('Seleccionar --postgres o --wasm.');
const ownSchema = `sgmo_sales_test_${randomBytes(6).toString('hex')}`;
const localRaw = process.env.SGMO_SALES_TEST_DATABASE_URL ?? process.env.SGMO_AUTH_TEST_DATABASE_URL;
const runtime = process.env.SGMO_PGLITE_ROOT;
for (const key of ['DATABASE_URL','POSTGRES_URL','PGHOST','PGDATABASE','PGUSER','PGPASSWORD','PGPORT','PGOPTIONS','PGSERVICE','PGSERVICEFILE','DATABASE_SSL']) delete process.env[key];
process.env.NODE_ENV = 'test';
process.env.DATABASE_SSL = 'false';
const originalQuery = Pool.prototype.query;
const originalConnect = Pool.prototype.connect;
let database: any;
let setupPool: Pool;
if (mode === '--wasm') {
  if (!runtime) throw new Error('Configurar SGMO_PGLITE_ROOT con dependencia opcional externa PGlite.');
  const { PGlite } = await import(pathToFileURL(resolve(runtime,'dist/index.js')).href);
  const { uuid_ossp } = await import(pathToFileURL(resolve(runtime,'dist/contrib/uuid_ossp.js')).href);
  database = new PGlite({ extensions: { uuid_ossp } });
  await database.waitReady;
  let tail = Promise.resolve();
  async function acquire() {
    let unlock!: () => void;
    const next = new Promise<void>((complete) => { unlock = complete; });
    const before = tail; tail = next; await before; return unlock;
  }
  const execute = async (sql: string, parameters?: unknown[]) => {
    const result = parameters?.length ? await database.query(sql,parameters) : (await database.exec(sql)).at(-1);
    return { ...result, rows: result?.rows ?? [], rowCount: result?.affectedRows ?? 0 };
  };
  Pool.prototype.query = (async function(sql: string, parameters?: unknown[]) {
    const unlock = await acquire(); try { return await execute(sql,parameters); } finally { unlock(); }
  }) as typeof Pool.prototype.query;
  Pool.prototype.connect = (async function() {
    const unlock = await acquire(); return { query: execute, release: unlock };
  }) as typeof Pool.prototype.connect;
  process.env.DATABASE_URL = 'postgresql://test@127.0.0.1:1/sgmo_sales_test_wasm';
  setupPool = new Pool();
} else {
  if (!localRaw) throw new Error('Falta SGMO_SALES_TEST_DATABASE_URL o SGMO_AUTH_TEST_DATABASE_URL.');
  const url = new URL(localRaw);
  if (!['postgres:','postgresql:'].includes(url.protocol) || !['127.0.0.1','[::1]'].includes(url.hostname)
      || !/^\/sgmo_(?:sales|auth)_test[a-z0-9_]*$/.test(url.pathname) || url.search || url.hash) {
    throw new Error('Sólo se acepta PostgreSQL loopback en base exclusiva sgmo_sales_test* o sgmo_auth_test*, sin parámetros.');
  }
  url.searchParams.set('options',`-c search_path=${ownSchema}`);
  process.env.DATABASE_URL = url.href;
  setupPool = new Pool({ connectionString:url.href,ssl:false });
}
let passed = 0;
async function check(name: string, action: () => Promise<void>) {
  await action(); passed++; console.log(`PASS ${name}`);
}
const actor = { userId: 'USR-ADMIN-01', userName: 'Admin test', role: 'admin' as const };
const shiftDraft = (id: string, sellerId='USR-VEND-01',cartId='CART-01') => ({
  id,houseId:'HOUSE-NORTE',sellerId,cartId,zoneId:'ZONE-TEST',zoneName:'Zona prueba',
  coordinatorId:'fake',sellerName:'fake',commissionRate:1,totalUnitsDelivered:99999,status:'liquidada',
  finalPayoutAmount:999999,startTime:'10:00',stockItems:[{ varietyId:'VAR-CLASICO',deliveredUnits:30,soldUnits:999,wasteUnits:999 }],
  suppliesProvided:{ gasPercentStart:100,napkinsDelivered:10,conesDelivered:10,saucesProvided:[] }
} as unknown as DailyShift);
const sale = (id: string, overrides: Partial<SaleTransaction> = {}) => ({
  id,shiftId:'SHIFT-TEST',sellerId:'USR-VEND-01',sellerName:'fake',timestamp:'2026-10-13T12:00:00.000Z',
  itemType:'unidad',varietyId:'VAR-CLASICO',varietyName:'fake',quantityUnitsEquivalent:1,totalAmount:1500,
  paymentMethod:'efectivo',validationStatus:'validada',...overrides
} as SaleTransaction);
const conflict = (code: string) => (error: unknown) => error instanceof DataIntegrityError && error.code === code;
let applicationPool: Pool | null = null;
try {
  await setupPool.query(`CREATE SCHEMA ${ownSchema}`);
  if (mode === '--wasm') await database.exec(`SET search_path TO ${ownSchema}`);
  for (const filename of (await readdir('migrations')).filter((name) => name.endsWith('.sql')).sort()) {
    await setupPool.query(await readFile(resolve('migrations',filename),'utf8'));
  }
  const { query,getDbPool } = await import('../../src/server/db/connection');
  const { shiftRepository } = await import('../../src/server/db/repositories/ShiftRepository');
  const { saleRepository } = await import('../../src/server/db/repositories/SaleRepository');
  const { stockRepository } = await import('../../src/server/db/repositories/StockRepository');
  applicationPool = getDbPool();
  // El negocio fija sus precios en el catálogo; la fixture declara explícitamente sus importes.
  await query("UPDATE product_varieties SET base_price_individual=1500,combo_prices='{\"combo3\":4000,\"combo6\":7500,\"combo12\":14000}'::jsonb WHERE id IN ('VAR-CLASICO','VAR-AHUMADO')");
  await query("INSERT INTO house_stock(house_id,variety_id,units) VALUES ('HOUSE-NORTE','VAR-CLASICO',500),('HOUSE-NORTE','VAR-AHUMADO',500)");
  await check('Despacho deriva identidad, stock cero vendido y métricas financieras; debita stock casa', async () => {
    const shift = await shiftRepository.createShift(shiftDraft('SHIFT-TEST'),actor);
    await shiftRepository.createShift(shiftDraft('SHIFT-TEST'),actor);
    await assert.rejects(shiftRepository.createShift({ ...shiftDraft('SHIFT-TEST'),stockItems:[{ varietyId:'VAR-CLASICO',deliveredUnits:31 } as any] },actor),conflict('SHIFT_ALREADY_EXISTS'));
    assert.equal(shift.status,'en_curso'); assert.equal(shift.totalUnitsDelivered,30);
    assert.equal(shift.totalGrossSales,0); assert.equal(shift.finalPayoutAmount,0);
    assert.notEqual(shift.sellerName,'fake'); assert.notEqual(shift.coordinatorId,'fake');
    assert.equal(shift.stockItems[0].soldUnits,0); assert.equal(shift.stockItems[0].wasteUnits,0);
    assert.equal((await query("SELECT units FROM house_stock WHERE house_id='HOUSE-NORTE' AND variety_id='VAR-CLASICO'")).rows[0].units,470);
  });
  await check('Precio oficial de catálogo excluye precio fijo anterior y diferencias de un centavo', async () => {
    await query("UPDATE product_varieties SET base_price_individual=1600 WHERE id='VAR-CLASICO'");
    await assert.rejects(saleRepository.createSale(sale('SALE-OLD-PRICE'),actor),conflict('INVALID_SALE_PRICE'));
    await assert.rejects(saleRepository.createSale(sale('SALE-PRICE-CENT',{ totalAmount:1600.01 }),actor),conflict('INVALID_SALE_PRICE'));
    assert.equal((await query("SELECT count(*)::int AS total FROM sales WHERE id IN ('SALE-OLD-PRICE','SALE-PRICE-CENT')")).rows[0].total,0);
    await query("UPDATE product_varieties SET base_price_individual=1500 WHERE id='VAR-CLASICO'");
  });
  await check('No permite despachar mismo vendedor/carrito ni inventar saldo disponible', async () => {
    await assert.rejects(shiftRepository.createShift(shiftDraft('SHIFT-DUPLICATE'),actor),conflict('ACTIVE_SHIFT_CONFLICT'));
    await assert.rejects(shiftRepository.createShift({ ...shiftDraft('SHIFT-TOOMUCH','USR-VEND-02','CART-02'),stockItems:[{ varietyId:'VAR-CLASICO',deliveredUnits:1000 } as any] },actor),conflict('INSUFFICIENT_HOUSE_STOCK'));
    assert.equal((await query("SELECT count(*)::int AS total FROM daily_shifts")).rows[0].total,1);
  });
  await check('Venta digital no acepta validación bancaria afirmada por cliente', async () => {
    const created = await saleRepository.createSale(sale('SALE-DIGITAL',{ paymentMethod:'mercado_pago',mpApiVerification:{ matchedInApi:true,isLiveApi:true,amountMatches:true,apiStatus:'approved',mpTransactionId:'FAKE' } }),actor);
    assert.equal(created.validationStatus,'pendiente_revision'); assert.equal(created.mpApiVerification,undefined);
    const stored = (await query("SELECT validation_status,mp_api_verification FROM sales WHERE id='SALE-DIGITAL'")).rows[0];
    assert.equal(stored.validation_status,'pendiente_revision'); assert.equal(stored.mp_api_verification,null);
  });
  await check('Reintento idéntico no duplica unidades ni importe; IDs con contenido distinto dan409', async () => {
    await saleRepository.createSale(sale('SALE-CASH'),actor);
    await saleRepository.createSale(sale('SALE-CASH'),actor);
    await assert.rejects(saleRepository.createSale(sale('SALE-CASH',{ quantityUnitsEquivalent:2,totalAmount:3000 }),actor),conflict('IDEMPOTENCY_CONFLICT'));
    const shift = await shiftRepository.getById('SHIFT-TEST');
    assert.equal(shift!.totalGrossSales,3000); assert.equal(shift!.stockItems[0].soldUnits,2);
    assert.equal((await query("SELECT count(*)::int AS total FROM sales")).rows[0].total,2);
  });
  await check('Lote con conflicto tardío revierte ventas nuevas y contadores completos', async () => {
    await assert.rejects(saleRepository.syncBatch([sale('SALE-AA'),sale('SALE-CASH',{ totalAmount:3000,quantityUnitsEquivalent:2 })],actor),conflict('IDEMPOTENCY_CONFLICT'));
    assert.equal((await query("SELECT count(*)::int AS total FROM sales WHERE id='SALE-AA'")).rows[0].total,0);
    assert.equal((await shiftRepository.getById('SHIFT-TEST'))!.totalGrossSales,3000);
  });
  await check('ACK de lote enumera únicamente IDs confirmados y no altera evidencia en replay', async () => {
    const result = await saleRepository.syncBatch([sale('SALE-CASH'),sale('SALE-BATCH')],actor);
    assert.equal(result.inserted,1); assert.equal(result.updated,0);
    assert.deepEqual(new Set(result.acknowledgedIds),new Set(['SALE-CASH','SALE-BATCH']));
  });
  await check('Pertenencia de recursos, precios y números se validan dentro de transacción', async () => {
    await assert.rejects(saleRepository.createSale(sale('SALE-FOREIGN'),{ userId:'USR-VEND-02',userName:'Otro',role:'seller' }),conflict('FORBIDDEN'));
    await assert.rejects(saleRepository.createSale(sale('SALE-FALSEOWNER',{ sellerId:'USR-VEND-02' }),actor),conflict('SELLER_MISMATCH'));
    for (const amount of [-1,Infinity,NaN,'1500',1500.001]) await assert.rejects(saleRepository.createSale(sale('SALE-MALFORMED',{ totalAmount:amount as number }),actor),conflict('INVALID_TOTAL_AMOUNT'));
    await assert.rejects(saleRepository.createSale(sale('SALE-PRICE',{ totalAmount:1 }),actor),conflict('INVALID_SALE_PRICE'));
    await assert.rejects(saleRepository.createSale(sale('SALE-COMBO',{ itemType:'combo6',quantityUnitsEquivalent:5,totalAmount:7500 }),actor),conflict('UNITS_MISMATCH'));
    await assert.rejects(saleRepository.createSale(sale('SALE-PAYMENT',{ paymentMethod:'bitcoin' as any }),actor),conflict('INVALID_PAYMENT_METHOD'));
    await assert.rejects(saleRepository.syncBatch([sale('SALE-AA-PRICE'),sale('SALE-ZZ-PRICE',{ totalAmount:1 })],actor),conflict('INVALID_SALE_PRICE'));
    assert.equal((await query("SELECT count(*)::int AS total FROM sales WHERE id='SALE-AA-PRICE'")).rows[0].total,0);
    assert.equal((await shiftRepository.getById('SHIFT-TEST'))!.totalGrossSales,4500);
    await assert.rejects(saleRepository.createSale(sale('SALE-STOCK',{ quantityUnitsEquivalent:100,totalAmount:150000 }),actor),conflict('INSUFFICIENT_SHIFT_STOCK'));
  });
  await check('Banco: importe incorrecto no reclama pago; asignación única y devolución invalidan evidencia', async () => {
    const { bankPaymentRepository,PaymentError } = await import('../../src/server/db/repositories/BankPaymentRepository');
    await shiftRepository.createShift({ ...shiftDraft('SHIFT-BANK','USR-VEND-02','CART-02'),stockItems:[{ varietyId:'VAR-AHUMADO',deliveredUnits:30 } as any] },actor);
    const created = await shiftRepository.getById('SHIFT-BANK');
    const timestamp = new Date(created!.startTime).toISOString();
    await saleRepository.createSale(sale('SALE-BANK-A',{ shiftId:'SHIFT-BANK',sellerId:'USR-VEND-02',varietyId:'VAR-AHUMADO',paymentMethod:'mercado_pago',timestamp }),actor);
    await saleRepository.createSale(sale('SALE-BANK-B',{ shiftId:'SHIFT-BANK',sellerId:'USR-VEND-02',varietyId:'VAR-AHUMADO',paymentMethod:'mercado_pago',timestamp }),actor);
    const payment = { id:'123456789',collectorId:'BANK-TEST',amount:1500,currency:'ARS',status:'approved',live:true,refunded:0,dateCreated:timestamp,dateUpdated:timestamp };
    assert.equal((await bankPaymentRepository.applyPayment('SALE-BANK-A',{ ...payment,amount:1 },'BANK-TEST',actor)).verified,false);
    assert.equal((await query('SELECT count(*)::int AS total FROM bank_payment_claims')).rows[0].total,0);
    assert.equal((await bankPaymentRepository.applyPayment('SALE-BANK-A',payment,'BANK-TEST',actor)).verified,true);
    assert.equal((await bankPaymentRepository.applyPayment('SALE-BANK-A',payment,'BANK-TEST',actor)).verified,true);
    assert.equal((await query('SELECT count(*)::int AS total FROM bank_payment_claims')).rows[0].total,1);
    await assert.rejects(bankPaymentRepository.applyPayment('SALE-BANK-B',payment,'BANK-TEST',actor),
      (error: unknown) => error instanceof PaymentError && error.code === 'PAYMENT_ALREADY_CLAIMED');
    const refund = { ...payment,status:'refunded',refunded:1500,dateUpdated:new Date(Date.parse(timestamp)+1000).toISOString() };
    assert.equal((await bankPaymentRepository.applyPayment('SALE-BANK-A',refund,'BANK-TEST',actor)).verified,false);
    assert.equal((await query("SELECT validation_status FROM sales WHERE id='SALE-BANK-A'")).rows[0].validation_status,'pendiente_revision');
    await assert.rejects(bankPaymentRepository.applyPayment('SALE-BANK-A',payment,'BANK-TEST',actor),
      (error: unknown) => error instanceof PaymentError && error.code === 'STALE_BANK_RESPONSE');
  });
  if (mode === '--postgres') await check('PostgreSQL: dos conexiones concurrentes con mismo ID producen una única venta', async () => {
    const duplicate = sale('SALE-PG-CONCURRENT',{ shiftId:'SHIFT-BANK',sellerId:'USR-VEND-02',varietyId:'VAR-AHUMADO' });
    await Promise.all([saleRepository.createSale(duplicate,actor),saleRepository.createSale(duplicate,actor)]);
    assert.equal((await query("SELECT count(*)::int AS total FROM sales WHERE id='SALE-PG-CONCURRENT'")).rows[0].total,1);
  });
  await check('Evidencia histórica del cliente sin claim no se presenta como validada en ventas ni jornada', async () => {
    await query(`UPDATE sales SET validation_status='validada',mp_api_verification=$2 WHERE id=$1`,['SALE-DIGITAL',JSON.stringify({ matchedInApi:true,isLiveApi:true,amountMatches:true,apiStatus:'approved',mpTransactionId:'FAKE' })]);
    const display = (await saleRepository.getByShiftId('SHIFT-TEST')).find((entry) => entry.id==='SALE-DIGITAL')!;
    assert.equal(display.validationStatus,'pendiente_revision'); assert.equal(display.mpApiVerification?.matchedInApi,false);
    assert.equal((display as any).legacyClientEvidence,true);
    assert.equal((await shiftRepository.getById('SHIFT-TEST'))!.mpValidatedAmount,0);
    // Datos originales permanecen disponibles para auditoría: no borrado SQL.
    assert.equal((await query("SELECT mp_api_verification FROM sales WHERE id='SALE-DIGITAL'")).rows[0].mp_api_verification.matchedInApi,true);
  });
  const restock = { id:'RESTOCK-TEST',shiftId:'SHIFT-TEST',timestamp:'2026-10-13T13:00:00.000Z',varietyId:'VAR-CLASICO',quantity:10 } as ShiftRestockRecord;
  await check('Reposición idempotente debita casa y suma turno exactamente una vez', async () => {
    await stockRepository.recordRestock(restock,actor); await stockRepository.recordRestock(restock,actor);
    assert.equal((await shiftRepository.getById('SHIFT-TEST'))!.stockItems[0].reSuppliedUnits,10);
    assert.equal((await query("SELECT units FROM house_stock WHERE house_id='HOUSE-NORTE' AND variety_id='VAR-CLASICO'")).rows[0].units,460);
    await assert.rejects(stockRepository.recordRestock({ ...restock,quantity:11 },actor),conflict('IDEMPOTENCY_CONFLICT'));
  });
  await check('Lote de reposición sin saldo revierte íntegro, incluidos saldos casa', async () => {
    await assert.rejects(stockRepository.recordRestockBatch([{ ...restock,id:'RESTOCK-AA',quantity:1 },{ ...restock,id:'RESTOCK-ZZ',varietyId:'VAR-AHUMADO',quantity:501 }],actor),conflict('INSUFFICIENT_HOUSE_STOCK'));
    assert.equal((await query("SELECT count(*)::int AS total FROM shift_restock_records")).rows[0].total,1);
    assert.equal((await query("SELECT units FROM house_stock WHERE house_id='HOUSE-NORTE' AND variety_id='VAR-CLASICO'")).rows[0].units,460);
  });
  const waste = { id:'WASTE-TEST',shiftId:'SHIFT-TEST',timestamp:'2026-10-13T13:00:00.000Z',varietyId:'VAR-CLASICO',quantity:2,reason:'producto_caido' } as ShiftWasteRecord;
  await check('Merma idempotente y rechazo de cantidades negativas no duplican contadores', async () => {
    await stockRepository.recordWaste(waste,actor); await stockRepository.recordWaste(waste,actor);
    assert.equal((await shiftRepository.getById('SHIFT-TEST'))!.stockItems[0].wasteUnits,2);
    await assert.rejects(stockRepository.recordWaste({ ...waste,id:'WASTE-BAD',quantity:-1 },actor),conflict('INVALID_QUANTITY'));
    await assert.rejects(stockRepository.recordWaste({ ...waste,quantity:3 },actor),conflict('IDEMPOTENCY_CONFLICT'));
  });
  const closing = { cashDeclared:3000,returnedItems:[{ varietyId:'VAR-CLASICO',count:30,wasteCount:2 }],bonusIncentive:500,
    finalPayoutAmount:999999,totalGrossSales:999999,grossCommission:999999,housingCostDeduction:0 };
  await check('Declaración de sobrantes sólo propietario; espera cierre y no devuelve stock a casa', async () => {
    await assert.rejects(shiftRepository.declareLeftovers('SHIFT-TEST',closing,{ userId:'USR-VEND-02',userName:'Otro',role:'seller' }),conflict('FORBIDDEN'));
    const owner = { userId:'USR-VEND-01',userName:'Vendedor',role:'seller' as const };
    await shiftRepository.declareLeftovers('SHIFT-TEST',closing,owner);
    await shiftRepository.declareLeftovers('SHIFT-TEST',closing,owner);
    await assert.rejects(shiftRepository.declareLeftovers('SHIFT-TEST',{ returnedItems:[{ varietyId:'VAR-CLASICO',count:29,wasteCount:2 }] },owner),conflict('LEFTOVERS_CONFLICT'));
    assert.equal((await shiftRepository.getById('SHIFT-TEST'))!.status,'esperando_cierre');
    assert.equal((await query("SELECT units FROM house_stock WHERE house_id='HOUSE-NORTE' AND variety_id='VAR-CLASICO'")).rows[0].units,460);
    await assert.rejects(saleRepository.createSale(sale('SALE-TOOLATE'),actor),conflict('SHIFT_NOT_ACTIVE'));
  });
  await check('Cierre calcula políticas servidor, congela snapshot y retorna stock una única vez', async () => {
    const shift = await shiftRepository.closeAndReconcileShift('SHIFT-TEST',closing,actor);
    assert.equal(shift.totalGrossSales,4500); assert.equal(shift.totalCashSales,3000); assert.equal(shift.totalMpSales,1500);
    assert.equal(shift.totalUnitsSold,3); assert.equal(shift.totalUnitsDifference,5); assert.equal(shift.totalUnitsReturned,30);
    assert.equal(shift.grossCommission,450); assert.equal(shift.housingCostDeduction,8000);
    assert.equal(shift.deductionsForMissingUnits,6500); assert.equal(shift.finalPayoutAmount,0);
    assert.equal(shift.mpValidatedAmount,0); assert.equal(shift.mpPendingOrSuspiciousAmount,1500);
    const row = (await query("SELECT settlement_snapshot FROM daily_shifts WHERE id='SHIFT-TEST'")).rows[0];
    assert.equal(row.settlement_snapshot.formula,'commission+bonus-missing-housing');
    assert.equal((await query("SELECT units FROM house_stock WHERE house_id='HOUSE-NORTE' AND variety_id='VAR-CLASICO'")).rows[0].units,490);
    await shiftRepository.closeAndReconcileShift('SHIFT-TEST',closing,actor);
    assert.equal((await query("SELECT units FROM house_stock WHERE house_id='HOUSE-NORTE' AND variety_id='VAR-CLASICO'")).rows[0].units,490);
    await assert.rejects(shiftRepository.closeAndReconcileShift('SHIFT-TEST',{ ...closing,cashDeclared:55555 },actor),conflict('SHIFT_ALREADY_CLOSED'));
  });
  await check('Replays de venta cerrada reciben ACK; nuevas ventas/mermas/reposiciones se rechazan', async () => {
    assert.equal((await saleRepository.syncBatch([sale('SALE-CASH')],actor)).acknowledgedIds[0],'SALE-CASH');
    await assert.rejects(stockRepository.recordWaste({ ...waste,id:'WASTE-LATE' },actor),conflict('SHIFT_NOT_ACTIVE'));
    await assert.rejects(stockRepository.recordRestock({ ...restock,id:'RESTOCK-LATE' },actor),conflict('SHIFT_NOT_ACTIVE'));
  });
  await check('Pago idempotente toma importe del cierre y rechaza reemplazo de comprobante', async () => {
    const paid = await shiftRepository.markPayout('SHIFT-TEST','comprobante-operativo',actor);
    assert.equal(paid.status,'liquidada'); assert.equal(paid.payoutStatus,'pagado'); assert.equal(paid.finalPayoutAmount,0);
    assert.equal((await shiftRepository.markPayout('SHIFT-TEST','comprobante-operativo',actor)).payoutStatus,'pagado');
    await assert.rejects(shiftRepository.markPayout('SHIFT-TEST','otro-comprobante',actor),conflict('PAYOUT_CONFLICT'));
  });
  const baselineConfig = (await query("SELECT config_value FROM system_configs WHERE config_key='GLOBAL_PARAMS'")).rows[0].config_value;
  const zeroConfig = { ...baselineConfig, housingCostPerPersonDaily:0, deductionRatePerMissingUnit:0 };
  delete zeroConfig.wasteToleranceThreshold;
  delete zeroConfig.wastePenaltyRateBelowOrEqual;
  delete zeroConfig.wastePenaltyRateAbove;
  await query('UPDATE commission_tiers SET is_active=FALSE');
  const economicCases = [
    { name:'vivienda cero',housing:0,override:null,exempt:false,rate:0.2,missing:0,cash:1500,expectedHousing:0,expectedCommission:300 },
    { name:'tarifa plana cero con faltante',housing:0,override:null,exempt:false,rate:0.2,missing:1,cash:1500,expectedHousing:0,expectedCommission:300 },
    { name:'excepción individual cero',housing:8000,override:0,exempt:false,rate:0.2,missing:0,cash:1500,expectedHousing:0,expectedCommission:300 },
    { name:'excepción individual positiva',housing:8000,override:125,exempt:false,rate:0.2,missing:0,cash:1500,expectedHousing:125,expectedCommission:300 },
    { name:'exención prioritaria',housing:8000,override:125,exempt:true,rate:0.2,missing:0,cash:1500,expectedHousing:0,expectedCommission:300 },
    { name:'comisión cero',housing:0,override:null,exempt:false,rate:0,missing:0,cash:1500,expectedHousing:0,expectedCommission:0 },
    { name:'efectivo faltante informado sin descuento nuevo',housing:0,override:null,exempt:false,rate:0.2,missing:0,cash:0,expectedHousing:0,expectedCommission:300 }
  ];
  for (const [index,economicCase] of economicCases.entries()) {
    await check(`Liquidación conserva ${economicCase.name} y snapshot histórico`, async () => {
      const shiftId=`SHIFT-ECONOMIC-${index}`;
      await query("UPDATE system_configs SET config_value=$1 WHERE config_key='GLOBAL_PARAMS'",[JSON.stringify({ ...zeroConfig,housingCostPerPersonDaily:economicCase.housing })]);
      await query('UPDATE users SET commission_rate=$2,housing_cost_override=$3,housing_cost_exempt=$4 WHERE id=$1',['USR-VEND-01',economicCase.rate,economicCase.override,economicCase.exempt]);
      await shiftRepository.createShift(shiftDraft(shiftId),actor);
      await saleRepository.createSale(sale(`SALE-ECONOMIC-${index}`,{ shiftId }),actor);
      const counts={ cashDeclared:economicCase.cash,returnedItems:[{ varietyId:'VAR-CLASICO',count:29-economicCase.missing,wasteCount:0 }] };
      const closed=await shiftRepository.closeAndReconcileShift(shiftId,counts,actor);
      assert.equal(closed.housingCostDeduction,economicCase.expectedHousing);
      assert.equal(closed.grossCommission,economicCase.expectedCommission);
      assert.equal(closed.commissionRate,economicCase.rate);
      assert.equal(closed.deductionsForMissingUnits,0);
      assert.equal(closed.cashDifference,economicCase.cash-1500);
      assert.equal(closed.finalPayoutAmount,Math.max(0,economicCase.expectedCommission-economicCase.expectedHousing));
      const historical=(await query('SELECT settlement_snapshot FROM daily_shifts WHERE id=$1',[shiftId])).rows[0].settlement_snapshot;
      await query("UPDATE system_configs SET config_value=jsonb_set(config_value,'{housingCostPerPersonDaily}','99999') WHERE config_key='GLOBAL_PARAMS'");
      await query("UPDATE users SET housing_cost_override=77777 WHERE id='USR-VEND-01'");
      const replay=await shiftRepository.closeAndReconcileShift(shiftId,counts,actor);
      assert.equal(replay.housingCostDeduction,closed.housingCostDeduction);
      assert.equal(replay.finalPayoutAmount,closed.finalPayoutAmount);
      assert.deepEqual((await query('SELECT settlement_snapshot FROM daily_shifts WHERE id=$1',[shiftId])).rows[0].settlement_snapshot,historical);
    });
  }
  console.log(`RESULTADO: ${passed} pruebas SQL reales aprobadas sobre ${mode === '--wasm' ? 'WASM (concurrencia distribuida no demostrada)' : 'PostgreSQL local aislado'}.`);
} finally {
  Pool.prototype.query = originalQuery; Pool.prototype.connect = originalConnect;
  if (applicationPool) await applicationPool.end();
  if (mode === '--postgres') {
    try { await setupPool.query(`DROP SCHEMA IF EXISTS ${ownSchema} CASCADE`); } finally { await setupPool.end(); }
  } else { await setupPool.end(); await database.close(); }
}
