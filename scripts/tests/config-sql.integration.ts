/** SQL real en PGlite WASM, destino efímero; sin .env ni sockets remotos.
 * No representa concurrencia distribuida. Ejecutar desde raíz con SGMO_PGLITE_ROOT.
 */
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';
const runtimeRoot=process.env.SGMO_PGLITE_ROOT;
if(!runtimeRoot) throw new Error('Falta SGMO_PGLITE_ROOT: PGlite opcional externo.');
for(const key of ['DATABASE_URL','POSTGRES_URL','PGHOST','PGDATABASE','PGUSER','PGPASSWORD','PGPORT','PGOPTIONS','PGSERVICE','PGSERVICEFILE']) delete process.env[key];
process.env.DATABASE_URL='postgresql://config-wasm@127.0.0.1:1/sgmo_auth_test_configuration';process.env.DATABASE_SSL='false';
const {PGlite}=await import(pathToFileURL(resolve(runtimeRoot,'dist/index.js')).href);
const {uuid_ossp}=await import(pathToFileURL(resolve(runtimeRoot,'dist/contrib/uuid_ossp.js')).href);
let engine=new PGlite({extensions:{uuid_ossp}});await engine.waitReady;
const originalQuery=Pool.prototype.query;const originalConnect=Pool.prototype.connect;
let previous=Promise.resolve();
const acquire=async()=>{let release!:()=>void;const next=new Promise<void>(resolveNext=>{release=resolveNext;});const ready=previous;previous=next;await ready;return release;};
const execute=async(statement:string,parameters?:unknown[])=>{const result=parameters?.length?await engine.query(statement,parameters):(await engine.exec(statement)).at(-1);return {...result,rows:result?.rows||[],rowCount:result?.rows?.length||result?.affectedRows||0};};
Pool.prototype.query=(async function(statement:string,parameters?:unknown[]){const release=await acquire();try{return await execute(statement,parameters);}finally{release();}})as any;
Pool.prototype.connect=(async()=>{const release=await acquire();return {query:execute,release};}) as any;
let applicationPool:Pool|null=null;let passed=0;
async function check(title:string,operation:()=>Promise<void>){await operation();passed++;console.log(`PASS ${title}`);}
try {
 const {getDbPool,query}=await import('../../src/server/db/connection');applicationPool=getDbPool();
 const {configurationRepository:configuration}=await import('../../src/server/db/repositories/ConfigurationRepository');
 for(const filename of (await readdir(resolve('migrations'))).filter(filename=>filename.endsWith('.sql')).sort()) await engine.exec(await readFile(resolve('migrations',filename),'utf8'));
 const actor='USR-ADMIN-01';
 await check('Catálogo oficial mapea precios, usuarios residentes y stock inicialmente vacío',async()=>{
  const snapshot=await configuration.getBootstrapCatalog();assert.equal(snapshot.houses.length,2);assert.equal(snapshot.varieties[0].basePriceIndividual>0,true);assert.equal(snapshot.houses.every(house=>house.currentStock.length===0),true);assert.deepEqual(snapshot.zones,[]);assert.equal(snapshot.systemConfig.commissionTiers.length,3);assert.ok(snapshot.houses[0].residentUserIds?.length);
 });
 await check('Catálogo, casa, carrito y zonas persisten después de lectura nueva',async()=>{
  await configuration.saveEntity('varieties','VAR-CONFIG',{name:'Variedad efímera',description:'Prueba',basePriceIndividual:10,comboPrices:{combo3:25,combo6:45,combo12:85}},actor,true);
  await configuration.saveEntity('houses','HOUSE-CONFIG',{name:'Casa efímera',address:'Destino de prueba',freezerCapacityUnits:100,fixedCostDaily:5,residentUserIds:[]},actor,true);
  await configuration.saveEntity('carts','CART-CONFIG',{code:'Carrito efímero',houseId:'HOUSE-CONFIG'},actor,true);
  await configuration.saveZones([{id:'ZONE-CONFIG',name:'Zona efímera',description:'',touristAffluence:'baja',avgDailySalesUnits:0,recommendedStartUnits:0}],actor);
  const snapshot=await configuration.getBootstrapCatalog();assert.ok(snapshot.carts.some(cart=>cart.id==='CART-CONFIG'&&cart.houseId==='HOUSE-CONFIG'));assert.equal(snapshot.zones[0].id,'ZONE-CONFIG');assert.equal(snapshot.varieties.find(variety=>variety.id==='VAR-CONFIG')?.basePriceIndividual,10);
 });
 await check('Conteo absoluto auditado, capacidad y rollback preservan stock',async()=>{
  await configuration.adjustHouseStock('HOUSE-CONFIG',{varietyId:'VAR-CONFIG',quantity:30,reason:'Conteo real de prueba'},actor);
  await configuration.adjustHouseStock('HOUSE-CONFIG',{varietyId:'VAR-CONFIG',quantity:20,reason:'Segundo conteo'},actor);
  await assert.rejects(configuration.adjustHouseStock('HOUSE-CONFIG',{varietyId:'VAR-CONFIG',quantity:101,reason:'Exceso'},actor));
  const stock=await query('SELECT units FROM house_stock WHERE house_id=$1',['HOUSE-CONFIG']);assert.equal(stock.rows[0].units,20);
  const audit=await query('SELECT previous_units,new_units FROM house_stock_adjustments WHERE house_id=$1 ORDER BY created_at',['HOUSE-CONFIG']);assert.deepEqual(audit.rows,[{previous_units:0,new_units:30},{previous_units:30,new_units:20}]);
  await assert.rejects(configuration.saveEntity('houses','HOUSE-CONFIG',{freezerCapacityUnits:10},actor));
 });
 await check('Configuración y tramos centralizados; validación rechaza payload y deja valores anteriores',async()=>{
  const snapshot=await configuration.getBootstrapCatalog();await configuration.saveSettings({...snapshot.systemConfig,housingCostPerPersonDaily:321,commissionTiers:[{id:'TIER-CONFIG',name:'Prueba',minSales:0,maxSales:null,rate:0.15,isActive:true}]},actor);
  await assert.rejects(configuration.saveSettings({...snapshot.systemConfig,defaultCommissionRate:7},actor));
  const confirmed=await configuration.getBootstrapCatalog();assert.equal(confirmed.systemConfig.housingCostPerPersonDaily,321);assert.equal(confirmed.systemConfig.commissionTiers.find(tier=>tier.id==='TIER-CONFIG')?.rate,0.15);assert.equal(confirmed.systemConfig.commissionTiers.filter(tier=>tier.id!=='TIER-CONFIG').every(tier=>!tier.isActive),true);
 });
 await check('Desactivación conserva catálogo y stock histórico; asignación guarda residencia',async()=>{
  await configuration.saveEntity('varieties','VAR-CONFIG',{isActive:false},actor);const snapshot=await configuration.getBootstrapCatalog();assert.equal(snapshot.varieties.find(variety=>variety.id==='VAR-CONFIG')?.isActive,false);assert.equal(snapshot.houses.find(house=>house.id==='HOUSE-CONFIG')?.currentStock[0].quantity,20);
  await configuration.saveEntity('houses','HOUSE-CONFIG',{residentUserIds:['USR-VEND-01']},actor);const updated=await configuration.getBootstrapCatalog();assert.deepEqual(updated.houses.find(house=>house.id==='HOUSE-CONFIG')?.residentUserIds,['USR-VEND-01']);
 });
 await check('Jornadas abiertas congelan precios y política económica; nombres siguen editables',async()=>{
  await query(`INSERT INTO daily_shifts(id,date,house_id,house_name,coordinator_name,seller_id,seller_name,cart_id,cart_code,zone_id,zone_name) VALUES('SHIFT-POLICY',CURRENT_DATE,'HOUSE-CONFIG','Casa efímera','Coordinador de prueba','USR-VEND-01','Vendedor de prueba','CART-CONFIG','Carrito efímero','ZONE-CONFIG','Zona efímera')`);
  const blocked=(error:any)=>error.status===409;
  const snapshot=await configuration.getBootstrapCatalog();
  await assert.rejects(configuration.saveEntity('varieties','VAR-CONFIG',{basePriceIndividual:11},actor),blocked);
  await assert.rejects(configuration.saveEntity('varieties','VAR-CONFIG',{isActive:true},actor),blocked);
  await assert.rejects(configuration.saveEntity('houses','HOUSE-CONFIG',{fixedCostDaily:7},actor),blocked);
  await assert.rejects(configuration.saveSettings({...snapshot.systemConfig,housingCostPerPersonDaily:555},actor),blocked);
  await assert.rejects(configuration.saveSettings({...snapshot.systemConfig,commissionTiers:snapshot.systemConfig.commissionTiers.map(tier=>tier.id==='TIER-CONFIG'?{...tier,rate:0.25}:tier)},actor),blocked);
  const {userRepository}=await import('../../src/server/db/repositories/UserRepository');
  await assert.rejects(userRepository.update('USR-VEND-01',{commissionRate:0.3}),blocked);
  await assert.rejects(userRepository.update('USR-VEND-01',{housingCostExempt:true}),blocked);
  await assert.rejects(userRepository.update('USR-VEND-01',{housingCostOverride:7}),blocked);
  await configuration.saveEntity('varieties','VAR-CONFIG',{name:'Nombre corregido'},actor);
  await configuration.saveSettings({...snapshot.systemConfig,systemName:'Nombre corregido'},actor);
  await userRepository.update('USR-VEND-01',{commissionRate:0.2});
  await query("UPDATE daily_shifts SET status='liquidada' WHERE id='SHIFT-POLICY'");
  await configuration.saveEntity('varieties','VAR-CONFIG',{basePriceIndividual:11},actor);
  await userRepository.update('USR-VEND-01',{commissionRate:0.3,housingCostExempt:true,housingCostOverride:7});
  const updated=await query("SELECT commission_rate,housing_cost_exempt,housing_cost_override FROM users WHERE id='USR-VEND-01'");
  assert.equal(Number(updated.rows[0].commission_rate),0.3);assert.equal(updated.rows[0].housing_cost_exempt,true);assert.equal(Number(updated.rows[0].housing_cost_override),7);
 });
 await check('Inicialización productiva no inserta personas/ventas ficticias y el runner no reintroduce la semilla demo',async()=>{
  await engine.close();engine=new PGlite({extensions:{uuid_ossp}});await engine.waitReady;
  for(const filename of (await readdir(resolve('migrations'))).filter(filename=>filename.endsWith('.sql')).sort()) await engine.exec(await readFile(filename==='002_seed_initial_data.sql'?resolve('scripts/sql/production-baseline.sql'):resolve('migrations',filename),'utf8'));
  const {runMigrations}=await import('../../src/server/db/migrator');
  const result=await runMigrations();assert.equal(result.success,true);
  assert.match(result.results.find(step=>step.version==='002_seed_initial_data')!.message,/Omitida/);
  const profiles=await query('SELECT name,is_provisioned FROM users');assert.equal(profiles.rows.length,1);assert.equal(profiles.rows[0].is_provisioned,false);assert.match(profiles.rows[0].name,/Dueño/);
  assert.equal((await query('SELECT id FROM sales')).rows.length,0);assert.equal((await query('SELECT id FROM operational_houses')).rows.length,0);
 });
 console.log(`RESULTADO: ${passed} grupos SQL de configuración aprobados en WASM; concurrencia real pendiente.`);
} finally {
 if(applicationPool) await applicationPool.end();Pool.prototype.query=originalQuery;Pool.prototype.connect=originalConnect;await engine.close();
}
