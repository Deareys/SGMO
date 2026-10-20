/** Validación de configuración, autorización HTTP y rollback con cliente simulado.
 * No certifica SQL ni concurrencia real (se verifica en integración PostgreSQL).
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { ConfigurationRepository, ConfigurationValidationError, validateCommissionTiers, validateSystemConfig, validateZones } from '../../src/server/db/repositories/ConfigurationRepository';
import { getDbPool } from '../../src/server/db/connection';
import { configRouter } from '../../src/server/routes/configRoutes';
import { sessionManager } from '../../src/server/auth/sessionManager';
const config={systemName:'Operación de prueba',housingCostPerPersonDaily:100,defaultCommissionRate:0.2,commissionTiers:[{id:'TIER-A',name:'Base',minSales:0,maxSales:100,rate:0.1,isActive:true},{id:'TIER-B',name:'Superior',minSales:100,maxSales:null,rate:0.2,isActive:true}],deductionRatePerMissingUnit:5,lowStockAlertThreshold:10};
test('configuración rechaza secretos, NaN, importes negativos y precisión económica excesiva',()=>{
  assert.deepEqual(validateSystemConfig(config),config);
  for(const invalid of [{...config,apiKey:'exposed'},{...config,housingCostPerPersonDaily:-1},{...config,housingCostPerPersonDaily:0.001},{...config,defaultCommissionRate:2},{...config,lowStockAlertThreshold:NaN},{...config,mercadoPagoConfig:{alias:'',accountHolder:'',accessToken:'secret'}}]) assert.throws(()=>validateSystemConfig(invalid),ConfigurationValidationError);
});
test('tramos: sin ids repetidos o superposición, tasas limitadas, infinito sólo al final',()=>{
  assert.equal(validateCommissionTiers(config.commissionTiers).length,2);
  for(const invalid of [[config.commissionTiers[0],config.commissionTiers[0]],[{...config.commissionTiers[0],maxSales:null},config.commissionTiers[1]],[config.commissionTiers[0],{...config.commissionTiers[1],minSales:90}],[{...config.commissionTiers[0],rate:1.01}]]) assert.throws(()=>validateCommissionTiers(invalid));
});
test('zonas: ids reales únicos y cantidades enteras',()=>{
  const zone={id:'ZONA-TEST',name:'Playa de prueba',description:'',touristAffluence:'media',avgDailySalesUnits:0,recommendedStartUnits:0};
  assert.deepEqual(validateZones([zone]),[zone]);
  assert.throws(()=>validateZones([zone,zone]));assert.throws(()=>validateZones([{...zone,recommendedStartUnits:0.5}]));assert.throws(()=>validateZones([{...zone,id:'../private'}]));
});
process.env.DATABASE_URL='postgresql://configuration-test@127.0.0.1:1/configuration-test';
const pool=getDbPool()!;const originalConnect=pool.connect;const originalQuery=pool.query;
const statements:Array<{sql:string;parameters:unknown[]}>=[];let rejectAudit=false;
const fakeQuery=async(sql:string,parameters:unknown[]=[])=>{
 statements.push({sql,parameters});if(rejectAudit&&sql.includes('INSERT INTO audit_logs')) throw new Error('Audit unavailable');
 let rows:any[]=[];
 if(sql.includes("SELECT config_value FROM system_configs")) rows=[{config_value:config}];
 if(sql.includes('SELECT id,freezer_capacity_units')) rows=[{id:'HOUSE-TEST',freezer_capacity_units:1000}];
 if(sql.includes('SELECT 1 FROM product_varieties')) rows=[{exists:1}];
 if(sql.includes('SELECT units FROM house_stock')) rows=[{units:5}];
 if(sql.includes('SUM(units)')) rows=[{units:10}];
 return {rows,rowCount:rows.length,command:'',oid:0,fields:[]};
};
pool.connect=(async()=>({query:fakeQuery,release(){}})) as any;pool.query=fakeQuery as any;
after(async()=>{pool.connect=originalConnect;pool.query=originalQuery;await pool.end();});
const repository=new ConfigurationRepository();
test('stock exige conteo válido y razón; rollback deja saldo intacto si falla auditoría',async()=>{
 statements.length=0;await assert.rejects(repository.adjustHouseStock('HOUSE-TEST',{varietyId:'VAR-TEST',quantity:-1,reason:'Conteo'},'ADMIN'));assert.equal(statements.length,0);
 await assert.rejects(repository.adjustHouseStock('HOUSE-TEST',{varietyId:'VAR-TEST',quantity:1,reason:''},'ADMIN'));assert.equal(statements.length,0);
 rejectAudit=true;await assert.rejects(repository.adjustHouseStock('HOUSE-TEST',{varietyId:'VAR-TEST',quantity:12,reason:'Inventario contado'},'ADMIN'));
 assert.deepEqual(statements.filter(statement=>/^(BEGIN|COMMIT|ROLLBACK)$/.test(statement.sql)).map(statement=>statement.sql),['BEGIN','ROLLBACK']);
 assert.ok(statements.find(statement=>statement.sql.includes('operational_houses')&&statement.sql.includes('FOR UPDATE')));
 rejectAudit=false;
});
test('conteo sobre capacidad no escribe stock',async()=>{
 statements.length=0;await assert.rejects(repository.adjustHouseStock('HOUSE-TEST',{varietyId:'VAR-TEST',quantity:1000,reason:'Conteo'},'ADMIN'),ConfigurationValidationError);
 assert.equal(statements.some(statement=>statement.sql.includes('INSERT INTO house_stock(')),false);
});
test('configuración y tramos se confirman juntos; no DELETE de histórico',async()=>{
 statements.length=0;await repository.saveSettings(config,'ADMIN');
 assert.deepEqual(statements.filter(statement=>/^(BEGIN|COMMIT|ROLLBACK)$/.test(statement.sql)).map(statement=>statement.sql),['BEGIN','COMMIT']);
 assert.ok(statements.some(statement=>statement.sql==='UPDATE commission_tiers SET is_active=FALSE'));
 assert.equal(statements.some(statement=>/DELETE/.test(statement.sql)),false);
});
test('todas las mutaciones administrativas rechazan trabajadores antes de persistir',async()=>{
 const originalValidation=sessionManager.validateToken;sessionManager.validateToken=async()=>({userId:'WORKER',role:'seller',user:{id:'WORKER',role:'seller'},expiresAt:'2099-01-01T00:00:00Z'} as any);
 const app=express();app.use(express.json());app.use('/api',configRouter);app.get('/api/health',(_req,res)=>res.json({ready:true}));const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.on('listening',()=>resolve()));
 try {
   const address=server.address() as any;const cookieName=process.env.NODE_ENV==='production'?'__Host-sgmo-session':'sgmo-session';
   const health=await fetch(`http://127.0.0.1:${address.port}/api/health`);assert.equal(health.status,200);
   for(const [method,path] of [['PUT','settings'],['PUT','zones'],['POST','houses'],['PATCH','carts/CART-TEST'],['PUT','houses/HOUSE-TEST/stock']]) {
    const response=await fetch(`http://127.0.0.1:${address.port}/api/${path}`,{method,headers:{Cookie:`${cookieName}=${'a'.repeat(64)}`,'Content-Type':'application/json'},body:JSON.stringify({})});
    assert.equal(response.status,403);
   }
 } finally {sessionManager.validateToken=originalValidation;await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
