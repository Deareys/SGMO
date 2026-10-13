/** Catálogo central confirmado, parámetros administrativos e inventario físico auditado.
 * No autentica usuarios, no elimina historial y nunca toma stock desde semillas del cliente.
 */
import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import { query, withTransaction } from '../connection';
import type { BeachZone, CommissionTier, OperationalHouse, ProductVariety, SellingCart, SystemConfig } from '../../../types';
export class ConfigurationValidationError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const reject = (message: string): never => { throw new ConfigurationValidationError(message); };
function text(value: unknown, label: string, max = 120, optional = false): string {
  if (value === undefined && optional) return '';
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim())) reject(`${label} inválido.`);
  return (value as string).trim();
}
function number(value: unknown, label: string, max = 9999999999.99, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isSafeInteger(value))) reject(`${label} inválido.`);
  return value as number;
}
function money(value: unknown, label: string): number {
  const result = number(value, label);
  if (Math.abs(result * 100 - Math.round(result * 100)) > 0.00001) reject(`${label} admite hasta dos decimales.`);
  return result;
}
function boolean(value: unknown, label: string): boolean { if(typeof value !== 'boolean') reject(`${label} inválido.`); return value as boolean; }
function record(value: unknown): Record<string, any> { if (!value || typeof value !== 'object' || Array.isArray(value)) reject('Objeto de configuración inválido.'); return value as Record<string, any>; }
export function validateResourceId(value: unknown): string {
  if(typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) reject('Identificador inválido.');
  return value as string;
}
function keys(value: Record<string, any>, allowed: string[]) { if(Object.keys(value).some(key => !allowed.includes(key))) reject('Campo de configuración no admitido.'); }
export function validateCommissionTiers(value: unknown): CommissionTier[] {
  if(!Array.isArray(value) || value.length > 100) reject('Tramos inválidos.');
  const tiers = (value as unknown[]).map(candidate => {
    const tier = record(candidate); keys(tier,['id','name','minSales','maxSales','rate','isActive']);
    const result = {id:validateResourceId(tier.id),name:text(tier.name,'Nombre de tramo'),minSales:money(tier.minSales,'Venta mínima'),maxSales:tier.maxSales === null ? null:money(tier.maxSales,'Venta máxima'),rate:number(tier.rate,'Comisión',1),isActive:boolean(tier.isActive,'Estado')};
    if(Math.abs(result.rate*10000-Math.round(result.rate*10000))>0.00001) reject('La tasa admite hasta cuatro decimales.');
    if(result.maxSales !== null && result.maxSales <= result.minSales) reject('Tope de tramo inválido.');
    return result;
  });
  if(new Set(tiers.map(tier=>tier.id)).size !== tiers.length) reject('Tramos duplicados.');
  const active = tiers.filter(tier=>tier.isActive).sort((left,right)=>left.minSales-right.minSales);
  for(let index=1;index<active.length;index++) {
    const previous=active[index-1]; if(previous.maxSales===null || active[index].minSales < previous.maxSales) reject('Los tramos activos se superponen.');
  }
  return tiers;
}
export function validateSystemConfig(candidate: unknown): SystemConfig {
  const config=record(candidate);
  keys(config,['systemName','housingCostPerPersonDaily','defaultCommissionRate','commissionTiers','deductionRatePerMissingUnit','wasteToleranceThreshold','wastePenaltyRateBelowOrEqual','wastePenaltyRateAbove','lowStockAlertThreshold','mercadoPagoConfig','updatedAt','updatedBy']);
  const result: SystemConfig={systemName:text(config.systemName,'Nombre'),housingCostPerPersonDaily:money(config.housingCostPerPersonDaily,'Vivienda'),defaultCommissionRate:number(config.defaultCommissionRate,'Comisión',1),commissionTiers:validateCommissionTiers(config.commissionTiers),deductionRatePerMissingUnit:money(config.deductionRatePerMissingUnit,'Faltantes'),lowStockAlertThreshold:number(config.lowStockAlertThreshold,'Umbral',1000000,true)};
  for(const field of ['wasteToleranceThreshold','wastePenaltyRateBelowOrEqual','wastePenaltyRateAbove'] as const) if(config[field] !== undefined) result[field]=field==='wasteToleranceThreshold'?number(config[field],field,1000000,true):money(config[field],field);
  if(config.mercadoPagoConfig !== undefined) {
    const account=record(config.mercadoPagoConfig); keys(account,['alias','cvu','accountHolder']);
    result.mercadoPagoConfig={alias:text(account.alias,'Alias',100,true),accountHolder:text(account.accountHolder,'Titular',120,true)};
    if(account.cvu) { if(typeof account.cvu!=='string'||!/^\d{22}$/.test(account.cvu)) reject('CVU inválido.'); result.mercadoPagoConfig.cvu=account.cvu; }
  }
  return result;
}
export function validateZones(candidate: unknown): BeachZone[] {
  if(!Array.isArray(candidate)||candidate.length>100) reject('Zonas inválidas.');
  const zones=(candidate as unknown[]).map(value=>{const zone=record(value); keys(zone,['id','name','description','touristAffluence','avgDailySalesUnits','recommendedStartUnits']); if(!['alta','media','baja'].includes(zone.touristAffluence)) reject('Afluencia inválida.'); return {id:validateResourceId(zone.id),name:text(zone.name,'Zona'),description:text(zone.description,'Descripción',2000,true),touristAffluence:zone.touristAffluence,avgDailySalesUnits:number(zone.avgDailySalesUnits,'Promedio',1000000,true),recommendedStartUnits:number(zone.recommendedStartUnits,'Stock sugerido',1000000,true)} as BeachZone;});
  if(new Set(zones.map(zone=>zone.id)).size!==zones.length) reject('Zonas duplicadas.'); return zones;
}
export class ConfigurationRepository {
  /** Datos oficiales para hidratar clientes. Sin credenciales ni cantidades demo. */
  async getBootstrapCatalog(): Promise<{houses:OperationalHouse[];carts:SellingCart[];varieties:ProductVariety[];zones:BeachZone[];systemConfig:SystemConfig}> {
    const [houses,carts,varieties,tiers,configs,stock,assignments]=await Promise.all([
      query('SELECT * FROM operational_houses ORDER BY name'),query('SELECT * FROM selling_carts ORDER BY code'),query('SELECT * FROM product_varieties ORDER BY name'),query('SELECT * FROM commission_tiers ORDER BY sort_order,min_sales'),query("SELECT * FROM system_configs WHERE config_key IN ('GLOBAL_PARAMS','beach_zones')"),query('SELECT s.*, v.name AS variety_name FROM house_stock s JOIN product_varieties v ON v.id=s.variety_id'),query('SELECT id,role,assigned_house_id FROM users')
    ]);
    const configRow=configs.rows.find(row=>row.config_key==='GLOBAL_PARAMS');
    if(!configRow) throw new Error('Falta GLOBAL_PARAMS: completar configuración central.');
    const commissionTiers=tiers.rows.map(row=>({id:row.id,name:row.name,minSales:Number(row.min_sales),maxSales:row.max_sales===null?null:Number(row.max_sales),rate:Number(row.rate),isActive:row.is_active}));
    return {
      houses:houses.rows.map(row=>({id:row.id,name:row.name,address:row.address,freezerCapacityUnits:row.freezer_capacity_units,fixedCostDaily:Number(row.fixed_cost_daily),isActive:row.is_active,consumablesStock:row.consumables_stock,coordinatorIds:assignments.rows.filter(user=>user.assigned_house_id===row.id&&user.role==='coordinator').map(user=>user.id),residentUserIds:assignments.rows.filter(user=>user.assigned_house_id===row.id).map(user=>user.id),currentStock:stock.rows.filter(entry=>entry.house_id===row.id).map(entry=>({varietyId:entry.variety_id,varietyName:entry.variety_name,quantity:entry.units}))})),
      carts:carts.rows.map(row=>({id:row.id,code:row.code,model:row.model||'',houseId:row.house_id||'',status:row.status,currentSellerId:row.current_seller_id||undefined,gasLevelPercent:Number(row.gas_level_percent),suppliesLevel:row.supplies_level,lastMaintenanceDate:row.last_maintenance_date instanceof Date?row.last_maintenance_date.toISOString().slice(0,10):row.last_maintenance_date||'',totalDaysInUse:row.total_days_in_use,notes:row.notes||'',locationNotes:row.location_notes||'',isActive:row.is_active})),
      varieties:varieties.rows.map(row=>({id:row.id,name:row.name,category:row.category,description:row.description||'',isAvailable:row.is_available,isActive:row.is_active,basePriceIndividual:Number(row.base_price_individual),comboPrices:row.combo_prices,customCombos:row.custom_combos})),
      zones:configs.rows.find(row=>row.config_key==='beach_zones')?.config_value||[],
      systemConfig:{...configRow.config_value,commissionTiers,updatedBy:configRow.updated_by,updatedAt:configRow.updated_at instanceof Date?configRow.updated_at.toISOString():configRow.updated_at}
    };
  }
  private async audit(client:PoolClient,actorId:string,entity:string,details:string,previous:unknown,next:unknown) {
    await client.query(`INSERT INTO audit_logs(id,user_id,user_name,user_role,action,entity_type,entity_id,details,previous_value,new_value) SELECT $1,id,name,role,'ADMIN_CONFIG','configuracion',$3,$4,$5,$6 FROM users WHERE id=$2`,[crypto.randomUUID(),actorId,entity,details,JSON.stringify(previous),JSON.stringify(next)]);
  }
  /** Despacho y configuración toman este bloqueo primero. Impide cambiar la
   * economía entre la verificación de jornadas abiertas y una apertura concurrente. */
  private async lockFinancialConfiguration(client: PoolClient): Promise<void> {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('sgmo_financial_configuration'))");
  }
  private async requireNoOpenShifts(client: PoolClient): Promise<void> {
    const open = await client.query("SELECT 1 FROM daily_shifts WHERE status IN ('planificada','en_curso','esperando_cierre') LIMIT 1");
    if (open.rowCount) throw new ConfigurationValidationError('Hay jornadas abiertas. Sincronizá las ventas pendientes y cerrá las jornadas antes de cambiar precios, comisiones o costos.', 409);
  }
  /** Reemplaza tramos atómicamente mediante soft-deactivation: liquidaciones archivadas intactas. */
  async saveSettings(candidate:unknown,actorId:string):Promise<void> {
    const config=validateSystemConfig(candidate);
    await withTransaction(async client=>{
      await this.lockFinancialConfiguration(client);
      const previous=await client.query("SELECT config_value FROM system_configs WHERE config_key='GLOBAL_PARAMS' FOR UPDATE");
      if(!previous.rowCount) reject('Falta configuración inicial.');
      const previousTiers=await client.query('SELECT id,min_sales,max_sales,rate,is_active FROM commission_tiers ORDER BY id');
      const economicTiers=(tiers: CommissionTier[]) => tiers.map(tier=>({id:tier.id,minSales:tier.minSales,maxSales:tier.maxSales,rate:tier.rate,isActive:tier.isActive})).sort((left,right)=>left.id.localeCompare(right.id));
      const oldTiers=economicTiers(previousTiers.rows.map(tier=>({id:tier.id,name:'',minSales:Number(tier.min_sales),maxSales:tier.max_sales===null?null:Number(tier.max_sales),rate:Number(tier.rate),isActive:tier.is_active})));
      const financialFields=['housingCostPerPersonDaily','defaultCommissionRate','deductionRatePerMissingUnit','wasteToleranceThreshold','wastePenaltyRateBelowOrEqual','wastePenaltyRateAbove'] as const;
      if(financialFields.some(field=>config[field]!==previous.rows[0].config_value[field]) || JSON.stringify(economicTiers(config.commissionTiers))!==JSON.stringify(oldTiers)) await this.requireNoOpenShifts(client);
      await client.query('UPDATE commission_tiers SET is_active=FALSE');
      for(const [sortOrder,tier] of config.commissionTiers.entries()) await client.query(`INSERT INTO commission_tiers(id,name,min_sales,max_sales,rate,is_active,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET name=$2,min_sales=$3,max_sales=$4,rate=$5,is_active=$6,sort_order=$7`,[tier.id,tier.name,tier.minSales,tier.maxSales,tier.rate,tier.isActive,sortOrder]);
      const {commissionTiers,...globalParams}=config;
      await client.query("UPDATE system_configs SET config_value=$1,updated_at=NOW(),updated_by=$2 WHERE config_key='GLOBAL_PARAMS'",[JSON.stringify(globalParams),actorId]);
      await this.audit(client,actorId,'GLOBAL_PARAMS','Parámetros y tramos confirmados',previous.rows[0].config_value,config);
    });
  }
  async saveZones(candidate:unknown,actorId:string):Promise<void> {
    const zones=validateZones(candidate);
    await withTransaction(async client=>{
      await client.query("SELECT pg_advisory_xact_lock(hashtext('sgmo_beach_zones'))");
      const previous=await client.query("SELECT config_value FROM system_configs WHERE config_key='beach_zones'");
      await client.query("INSERT INTO system_configs(config_key,config_value,updated_by) VALUES('beach_zones',$1,$2) ON CONFLICT(config_key) DO UPDATE SET config_value=$1,updated_by=$2,updated_at=NOW()",[JSON.stringify(zones),actorId]);
      await this.audit(client,actorId,'beach_zones','Zonas confirmadas',previous.rows[0]?.config_value||[],zones);
    });
  }
  /** Alta/edición administrativa por allowlist. Inventario y asignación del vendedor no vienen del carrito enviado. */
  async saveEntity(kind:'varieties'|'houses'|'carts',id:string,candidate:unknown,actorId:string,create=false):Promise<void> {
    validateResourceId(id); const incoming=record(candidate); const table={varieties:'product_varieties',houses:'operational_houses',carts:'selling_carts'}[kind];
    await withTransaction(async client=>{
      await this.lockFinancialConfiguration(client);
      const previous=await client.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`,[id]);
      if(create && previous.rowCount) throw new ConfigurationValidationError('Identificador existente.',409);
      if(!create && !previous.rowCount) throw new ConfigurationValidationError('Recurso no encontrado.',404);
      const existing=previous.rows[0];
      if(kind==='varieties') {
        keys(incoming,['name','category','description','isAvailable','isActive','basePriceIndividual','comboPrices','customCombos']);
        const variety={name:existing?.name,category:existing?.category||'tequeno',description:existing?.description||'',isAvailable:existing?.is_available??true,isActive:existing?.is_active??true,basePriceIndividual:existing?.base_price_individual===undefined?undefined:Number(existing.base_price_individual),comboPrices:existing?.combo_prices,customCombos:existing?.custom_combos||[],...incoming};
        if(existing) {
          const comboShape=(combos:Record<string,number>)=>['combo3','combo6','combo12'].map(key=>combos[key]);
          if(Number(existing.base_price_individual)!==variety.basePriceIndividual || JSON.stringify(comboShape(existing.combo_prices))!==JSON.stringify(comboShape(record(variety.comboPrices))) || JSON.stringify(existing.custom_combos||[])!==JSON.stringify(variety.customCombos) || existing.category!==variety.category || existing.is_active!==variety.isActive || existing.is_available!==variety.isAvailable) await this.requireNoOpenShifts(client);
        }
        if(!['tequeno','aderezo','otro'].includes(variety.category)) reject('Categoría inválida.');
        const combos=record(variety.comboPrices); keys(combos,['combo3','combo6','combo12']); for(const key of ['combo3','combo6','combo12']) money(combos[key],key);
        if(!Array.isArray(variety.customCombos)||variety.customCombos.length>50) reject('Combos inválidos.');
        const custom=variety.customCombos.map((candidate:unknown)=>{const combo=record(candidate); keys(combo,['id','name','unitsEquivalent','price','isDefault']);return {id:validateResourceId(combo.id),name:text(combo.name,'Combo'),unitsEquivalent:number(combo.unitsEquivalent,'Unidades',1000000,true),price:money(combo.price,'Precio'),...(combo.isDefault===undefined?{}:{isDefault:boolean(combo.isDefault,'Combo predeterminado')})};});
        if(custom.some(combo=>combo.unitsEquivalent<1)||new Set(custom.map(combo=>combo.id)).size!==custom.length) reject('Combos duplicados o sin unidades.');
        await client.query(`INSERT INTO product_varieties(id,name,category,description,is_available,is_active,base_price_individual,combo_prices,custom_combos) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET name=$2,category=$3,description=$4,is_available=$5,is_active=$6,base_price_individual=$7,combo_prices=$8,custom_combos=$9,updated_at=NOW()`,[id,text(variety.name,'Producto'),variety.category,text(variety.description,'Descripción',2000,true),boolean(variety.isAvailable,'Disponible'),boolean(variety.isActive,'Activo'),money(variety.basePriceIndividual,'Precio'),JSON.stringify(combos),JSON.stringify(custom)]);
      } else if(kind==='houses') {
        keys(incoming,['name','address','freezerCapacityUnits','fixedCostDaily','isActive','residentUserIds','coordinatorIds']);
        const house={name:existing?.name,address:existing?.address,freezerCapacityUnits:existing?.freezer_capacity_units,fixedCostDaily:Number(existing?.fixed_cost_daily||0),isActive:existing?.is_active??true,...incoming};
        if(existing && Number(existing.fixed_cost_daily)!==house.fixedCostDaily) await this.requireNoOpenShifts(client);
        if(house.isActive===false && (await client.query("SELECT 1 FROM daily_shifts WHERE house_id=$1 AND status IN ('planificada','en_curso','esperando_cierre') LIMIT 1",[id])).rowCount) throw new ConfigurationValidationError('La casa tiene jornadas abiertas.',409);
        const heldStock=await client.query('SELECT COALESCE(SUM(units),0) AS units FROM house_stock WHERE house_id=$1',[id]);
        if(Number(heldStock.rows[0].units)>number(house.freezerCapacityUnits,'Capacidad',10000000,true)) reject('La capacidad no puede ser menor que el stock almacenado.');
        await client.query(`INSERT INTO operational_houses(id,name,address,freezer_capacity_units,fixed_cost_daily,is_active) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET name=$2,address=$3,freezer_capacity_units=$4,fixed_cost_daily=$5,is_active=$6,updated_at=NOW()`,[id,text(house.name,'Casa'),text(house.address,'Dirección',2000),number(house.freezerCapacityUnits,'Capacidad',10000000,true),money(house.fixedCostDaily,'Costo'),boolean(house.isActive,'Activo')]);
        if(incoming.residentUserIds!==undefined) {
          if(!Array.isArray(incoming.residentUserIds)||incoming.residentUserIds.length>500) reject('Residentes inválidos.');
          const residents=incoming.residentUserIds.map(validateResourceId);
          if(new Set(residents).size!==residents.length) reject('Residentes duplicados.');
          const users=await client.query('SELECT id FROM users WHERE id=ANY($1::varchar[]) ORDER BY id FOR UPDATE',[residents]);
          if(users.rows.length!==residents.length) reject('Residente no encontrado.');
          const affected=await client.query('SELECT id,assigned_house_id FROM users WHERE assigned_house_id=$1 OR id=ANY($2::varchar[]) ORDER BY id FOR UPDATE',[id,residents]);
          const changed=affected.rows.filter(user=>user.assigned_house_id !== (residents.includes(user.id)?id:null));
          const changedIds=changed.map(user=>user.id);
          if(changedIds.length) {
            if((await client.query("SELECT 1 FROM daily_shifts WHERE (seller_id=ANY($1::varchar[]) OR coordinator_id=ANY($1::varchar[])) AND status IN ('planificada','en_curso','esperando_cierre') LIMIT 1",[changedIds])).rowCount) throw new ConfigurationValidationError('No reasignar personas con jornadas abiertas.',409);
            await client.query('UPDATE users SET assigned_house_id=NULL WHERE assigned_house_id=$1 AND id=ANY($2::varchar[])',[id,changedIds]);
            await client.query('UPDATE users SET assigned_house_id=$1 WHERE id=ANY($2::varchar[])',[id,changed.filter(user=>residents.includes(user.id)).map(user=>user.id)]);
            await client.query('UPDATE auth_sessions SET is_revoked=TRUE WHERE user_id=ANY($1::varchar[])',[changedIds]);
          }
        }
      } else {
        keys(incoming,['code','model','houseId','status','gasLevelPercent','suppliesLevel','lastMaintenanceDate','totalDaysInUse','notes','locationNotes','isActive']);
        const cart={code:existing?.code,model:existing?.model||'',houseId:existing?.house_id,status:existing?.status||'operativo',gasLevelPercent:Number(existing?.gas_level_percent||0),suppliesLevel:existing?.supplies_level||{napkins:'agotado',cones:'agotado',trays:'agotado',sauces:'agotado'},lastMaintenanceDate:existing?.last_maintenance_date||null,totalDaysInUse:existing?.total_days_in_use||0,notes:existing?.notes||'',locationNotes:existing?.location_notes||'',isActive:existing?.is_active??true,...incoming};
        if(!['operativo','en_revision','en_reparacion','fuera_de_servicio'].includes(cart.status)) reject('Estado de carrito inválido.');
        validateResourceId(cart.houseId);
        if(!(await client.query('SELECT 1 FROM operational_houses WHERE id=$1 AND is_active=TRUE',[cart.houseId])).rowCount) reject('Base no disponible.');
        if((await client.query("SELECT 1 FROM daily_shifts WHERE cart_id=$1 AND status IN ('planificada','en_curso','esperando_cierre') LIMIT 1",[id])).rowCount) throw new ConfigurationValidationError('No editar un carrito con jornada abierta.',409);
        const supplies=record(cart.suppliesLevel); keys(supplies,['napkins','cones','trays','sauces']);for(const key of ['napkins','cones','trays','sauces']) if(!['alto','medio','bajo','agotado'].includes(supplies[key])) reject('Nivel de insumos inválido.');
        const maintenance=cart.lastMaintenanceDate instanceof Date?cart.lastMaintenanceDate.toISOString().slice(0,10):cart.lastMaintenanceDate;
        if(maintenance && (typeof maintenance!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(maintenance))) reject('Fecha inválida.');
        await client.query(`INSERT INTO selling_carts(id,code,model,house_id,status,gas_level_percent,supplies_level,last_maintenance_date,total_days_in_use,notes,location_notes,is_active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO UPDATE SET code=$2,model=$3,house_id=$4,status=$5,gas_level_percent=$6,supplies_level=$7,last_maintenance_date=$8,total_days_in_use=$9,notes=$10,location_notes=$11,is_active=$12,updated_at=NOW()`,[id,text(cart.code,'Código'),text(cart.model,'Modelo',100,true),cart.houseId,cart.status,number(cart.gasLevelPercent,'Gas',100),JSON.stringify(supplies),maintenance||null,number(cart.totalDaysInUse,'Días',1000000,true),text(cart.notes,'Notas',2000,true),text(cart.locationNotes,'Recorrido',2000,true),boolean(cart.isActive,'Activo')]);
      }
      await this.audit(client,actorId,id,`${create?'Alta':'Edición'} de ${kind}`,existing||null,incoming);
    });
  }
  /** Conteo absoluto con razón; bloqueo de casa compartido con despacho/reposición evita carreras. */
  async adjustHouseStock(houseId:string,candidate:unknown,actorId:string):Promise<void> {
    validateResourceId(houseId);const adjustment=record(candidate);keys(adjustment,['varietyId','quantity','reason']);const varietyId=validateResourceId(adjustment.varietyId); const units=number(adjustment.quantity,'Cantidad',10000000,true);const reason=text(adjustment.reason,'Motivo',2000);
    await withTransaction(async client=>{
      const house=await client.query('SELECT id,freezer_capacity_units FROM operational_houses WHERE id=$1 AND is_active=TRUE FOR UPDATE',[houseId]); if(!house.rowCount) reject('Casa no disponible.');
      if(!(await client.query('SELECT 1 FROM product_varieties WHERE id=$1 AND is_active=TRUE',[varietyId])).rowCount) reject('Variedad no disponible.');
      const previous=await client.query('SELECT units FROM house_stock WHERE house_id=$1 AND variety_id=$2 FOR UPDATE',[houseId,varietyId]);const previousUnits=previous.rows[0]?.units||0;
      const sum=await client.query('SELECT COALESCE(SUM(units),0) AS units FROM house_stock WHERE house_id=$1 AND variety_id<>$2',[houseId,varietyId]); if(Number(sum.rows[0].units)+units>house.rows[0].freezer_capacity_units) reject('El stock supera la capacidad de la casa.');
      await client.query('INSERT INTO house_stock(house_id,variety_id,units) VALUES($1,$2,$3) ON CONFLICT(house_id,variety_id) DO UPDATE SET units=$3,updated_at=NOW()',[houseId,varietyId,units]);
      await client.query('INSERT INTO house_stock_adjustments(id,house_id,variety_id,previous_units,new_units,reason,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[crypto.randomUUID(),houseId,varietyId,previousUnits,units,reason,actorId]);
      await this.audit(client,actorId,houseId,`Conteo físico: ${reason}`,{varietyId,units:previousUnits},{varietyId,units});
    });
  }
}
export const configurationRepository=new ConfigurationRepository();
