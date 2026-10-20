import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertOperationId, assertOperationMoney, assertOperationQuantity, DataIntegrityError, validateSaleIntegrity } from '../../src/server/db/salesValidation';

for (const key of ['DATABASE_URL','POSTGRES_URL','PGHOST','PGDATABASE','PGUSER']) delete process.env[key];
const sale = { shiftId:'SHIFT-UNIT',paymentMethod:'efectivo',itemType:'combo6',varietyId:'VAR-CLASICO',quantityUnitsEquivalent:6,totalAmount:7500 };

test('múltiplos exactos de combo y centavos válidos conservan reglas promocionales vigentes', async () => {
  assert.equal((await validateSaleIntegrity(sale)).isValid,true);
  assert.equal((await validateSaleIntegrity({ ...sale,quantityUnitsEquivalent:12,totalAmount:15000 })).isValid,true);
  assert.equal((await validateSaleIntegrity({ ...sale,quantityUnitsEquivalent:5 })).code,'UNITS_MISMATCH');
  assert.equal((await validateSaleIntegrity({ ...sale,totalAmount:1 })).code,'INVALID_SALE_PRICE');
  assert.equal((await validateSaleIntegrity({ ...sale,totalAmount:7500.01 })).code,'INVALID_SALE_PRICE');
});

test('no convierte strings, booleans o no finitos a importes/unidades confiables', async () => {
  for (const amount of ['7500',null,false,NaN,Infinity,-1,7500.001]) {
    assert.equal((await validateSaleIntegrity({ ...sale,totalAmount:amount })).code,'INVALID_TOTAL_AMOUNT');
  }
  for (const units of ['6',null,false,NaN,Infinity,-1,6.5,1000001]) {
    assert.equal((await validateSaleIntegrity({ ...sale,quantityUnitsEquivalent:units })).code,'INVALID_UNITS_EQUIVALENT');
  }
});

test('validaciones comunes rechazan IDs ajenos a contrato y cantidades fuera de rango', () => {
  for (const id of ['',null,[],"../path",'A'.repeat(65)]) assert.throws(() => assertOperationId(id,'ID'),DataIntegrityError);
  for (const quantity of ['1',0,-1,1.1,Infinity,1000001]) assert.throws(() => assertOperationQuantity(quantity,'Cantidad'),DataIntegrityError);
  assert.doesNotThrow(() => assertOperationQuantity(0,'Devueltos',true));
  for (const amount of ['1',-1,Infinity,NaN,1.001]) assert.throws(() => assertOperationMoney(amount,'Monto'),DataIntegrityError);
  assert.doesNotThrow(() => assertOperationMoney(0,'Monto'));
});
