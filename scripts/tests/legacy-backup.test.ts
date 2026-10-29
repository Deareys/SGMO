import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeLegacyValue,legacyCounts,canonicalLegacyJson} from '../../src/shared/legacyBackup';
test('respaldo conserva comprobantes e historial y retira credenciales anidadas y prototipo',()=>{
  const input=JSON.parse('{"users":[{"id":"u","pin":"123","passwordHash":"private","passwordSalt":"private"}],"sales":[{"id":"v","voucherImage":"data:image/jpeg;base64,abc","totalAmount":0}],"nested":{"token":"private","apiKey":"private"},"currentUser":{"id":"u"},"__proto__":{"admin":true}}');
  const safe=sanitizeLegacyValue(input) as any;
  assert.deepEqual(safe.users,[{id:'u'}]);assert.deepEqual(safe.nested,{});
  assert.equal(safe.sales[0].totalAmount,0);assert.equal(safe.sales[0].voucherImage,input.sales[0].voucherImage);
  assert.equal(Object.hasOwn(safe,'currentUser'),false);assert.equal(Object.hasOwn(safe,'__proto__'),false);
  assert.deepEqual(legacyCounts(safe),{users:1,sales:1});
});
test('un respaldo no acepta estructuras recursivas ilimitadas',()=>{
  let nested:any={};const root=nested;for(let index=0;index<40;index++){nested.child={};nested=nested.child;}
  assert.throws(()=>sanitizeLegacyValue(root));
});
test('la identidad del respaldo no cambia si JSONB reordena claves; conserva orden de ventas',()=>{
 assert.equal(canonicalLegacyJson({users:[{id:'u',name:'Nombre'}],sales:[]}),canonicalLegacyJson({sales:[],users:[{name:'Nombre',id:'u'}]}));
 assert.notEqual(canonicalLegacyJson({sales:['primera','segunda']}),canonicalLegacyJson({sales:['segunda','primera']}));
});
