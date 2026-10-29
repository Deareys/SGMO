/** Recuperación del prototipo: archivo inmutable primero, catálogo después.
 * Sólo administrador autenticado + CSRF. El historial financiero queda como
 * evidencia anterior, separado de pagos/verificaciones y liquidaciones centrales.
 */
import { Router } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { authenticateToken, requireRole } from '../auth/authMiddleware.js';
import { query, isDbConfigured } from '../db/connection.js';
import { configurationRepository, ConfigurationValidationError, validateResourceId } from '../db/repositories/ConfigurationRepository.js';
import { userRepository, UserCredentialValidationError } from '../db/repositories/UserRepository.js';
import { legacyCounts, sanitizeLegacyValue, canonicalLegacyJson, type LegacyBackup } from '../../shared/legacyBackup.js';
import type { UserProfile } from '../../types';

export const legacyRouter = Router();
legacyRouter.use('/legacy-imports', authenticateToken, requireRole('admin'), (_req, res, next) => {
  if (!isDbConfigured()) { res.status(503).json({success:false,message:'La recuperación requiere la base central.'}); return; }
  next();
});
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
function invalid(message: string): never { throw new ConfigurationValidationError(message); }
function fail(res: any, error: unknown): void {
  const known = error instanceof ConfigurationValidationError || error instanceof UserCredentialValidationError;
  res.status(known ? (error instanceof ConfigurationValidationError ? error.status : 400) : 503)
    .json({success:false,message:known ? (error as Error).message : 'No se pudo confirmar la recuperación. El original permanece en el dispositivo.'});
}
const receiptColumns = 'id,source_id AS "sourceId",source_origin AS "sourceOrigin",content_hash AS "contentHash",record_counts AS counts,catalog_result AS "catalogResult",created_at AS "createdAt"';
legacyRouter.get('/legacy-imports', async (_req, res) => {
  try { res.json({success:true,receipts:(await query(`SELECT ${receiptColumns} FROM legacy_imports ORDER BY created_at DESC LIMIT 50`)).rows}); }
  catch (error) { fail(res,error); }
});
legacyRouter.post('/legacy-imports', async (req, res) => {
  try {
    const incoming = req.body as LegacyBackup;
    if (incoming?.format !== 'sgmo-legacy-v1' || !uuid(incoming.sourceId) || !incoming.state || typeof incoming.state !== 'object' || Array.isArray(incoming.state)) invalid('Formato de respaldo inválido.');
    if (typeof incoming.sourceOrigin !== 'string' || incoming.sourceOrigin.length > 300 || !Number.isFinite(Date.parse(incoming.capturedAt))) invalid('Origen o fecha del respaldo inválidos.');
    const payload = {format:'sgmo-legacy-v1',sourceId:incoming.sourceId,sourceOrigin:incoming.sourceOrigin,
      capturedAt:incoming.capturedAt,state:sanitizeLegacyValue(incoming.state) as Record<string,unknown>};
    // Mantener margen respecto del límite de la plataforma. Nunca eliminar el original ante 413.
    const serialized = JSON.stringify(payload);
    if (Buffer.byteLength(serialized) > 3_500_000) { res.status(413).json({success:false,message:'Este respaldo supera 3,5 MB. Descargalo y conservá el archivo; requiere importación por el operador.'}); return; }
    const digest = createHash('sha256').update(canonicalLegacyJson(payload)).digest('hex');
    await query(`INSERT INTO legacy_imports(id,source_id,source_origin,content_hash,captured_at,imported_by,payload,record_counts)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(source_id) DO NOTHING`,
      [randomUUID(),incoming.sourceId,incoming.sourceOrigin,digest,incoming.capturedAt,req.userSession!.userId,serialized,JSON.stringify(legacyCounts(payload.state))]);
    const stored = (await query(`SELECT ${receiptColumns} FROM legacy_imports WHERE source_id=$1`,[incoming.sourceId])).rows[0];
    if (stored.contentHash !== digest) { res.status(409).json({success:false,message:'Ese respaldo ya existe con otro contenido. No fue reemplazado.'}); return; }
    res.json({success:true,receipt:stored});
  } catch (error) { fail(res,error); }
});
legacyRouter.get('/legacy-imports/:id', async (req,res) => {
  try {
    if (!uuid(req.params.id)) invalid('Identificador de respaldo inválido.');
    const row = (await query('SELECT payload FROM legacy_imports WHERE id=$1',[req.params.id])).rows[0];
    if (!row) { res.status(404).json({success:false,message:'Respaldo no encontrado.'}); return; }
    res.setHeader('Content-Disposition',`attachment; filename="sgmo-respaldo-${req.params.id}.json"`);
    res.json(row.payload);
  } catch (error) { fail(res,error); }
});

/** Incorporación reanudable, con ACK por registro y reglas normales de repositorio.
 * No pisa cuentas aprovisionadas, no importa contraseñas, sesiones ni roles admin.
 * Un fallo parcial se informa y conserva el archivo completo; nunca se declara
 * el historial antiguo como operación bancaria verificada.
 */
legacyRouter.post('/legacy-imports/:id/catalog', async (req,res) => {
  try {
    if (!uuid(req.params.id) || req.body?.confirm !== true) invalid('Confirmá la incorporación del catálogo.');
    const row = (await query('SELECT payload,catalog_result FROM legacy_imports WHERE id=$1',[req.params.id])).rows[0];
    if (!row) { res.status(404).json({success:false,message:'Respaldo no encontrado.'}); return; }
    if (row.catalog_result?.complete) { res.json({success:true,result:row.catalog_result}); return; }
    const state = row.payload.state as Record<string, any>;
    if (Array.isArray(state.users) && state.users.length > 2000) invalid('El respaldo supera 2000 usuarios; requiere revisión del operador.');
    const actor = req.userSession!.userId;
    const result = {saved:[] as string[],skipped:[] as string[],errors:[] as string[],complete:false,
      historyStatus:'Historial anterior respaldado; no convertido en pagos o liquidaciones centrales.'};
    const pick = (entry:any, fields:string[]) => Object.fromEntries(fields.filter(key=>entry[key]!==undefined).map(key=>[key,entry[key]]));
    const attempt = async (label:string,action:()=>Promise<void>) => {
      try { await action(); result.saved.push(label); }
      catch(error:any) { result.errors.push(`${label}: ${error instanceof ConfigurationValidationError || error instanceof UserCredentialValidationError ? error.message : error.code==='23505' ? 'Código o correo duplicado.' : 'No se confirmó. Revisar formato y referencias.'}`); }
    };
    const current = await configurationRepository.getBootstrapCatalog();
    for (const [kind,fields] of [
      ['houses',['name','address','freezerCapacityUnits','fixedCostDaily','isActive']],
      ['varieties',['name','category','description','isAvailable','isActive','basePriceIndividual','comboPrices','customCombos']],
      ['carts',['code','model','houseId','status','gasLevelPercent','suppliesLevel','lastMaintenanceDate','totalDaysInUse','notes','locationNotes','isActive']]
    ] as const) {
      const entries = Array.isArray(state[kind]) ? state[kind] : [];
      if (entries.length > 2000) invalid('El catálogo supera la cantidad admitida.');
      for (const entry of entries) await attempt(`${kind}/${String(entry?.id).slice(0,64)}`,async()=>{
        validateResourceId(entry?.id);
        await configurationRepository.saveEntity(kind,entry.id,pick(entry,[...fields]),actor,!current[kind].some(existing=>existing.id===entry.id));
      });
    }
    for (const entry of Array.isArray(state.users) ? state.users.slice(0,2000) : []) {
      const label = `users/${String(entry?.id).slice(0,64)}`;
      if (entry?.id===actor || entry?.role==='admin') { result.skipped.push(label); continue; }
      await attempt(label,async()=>{
        validateResourceId(entry?.id);
        const existing = await userRepository.getById(entry.id);
        if (existing?.isProvisioned) { result.skipped.push(label); return; }
        const profile = pick(entry,['userCode','name','email','role','phone','assignedHouseId','commissionRate','housingCostExempt','housingCostOverride','isActive','notes']);
        if (existing) await userRepository.update(entry.id,profile);
        else await userRepository.create({...profile,id:entry.id,isActive:entry.isActive!==false,commissionRate:entry.commissionRate??current.systemConfig.defaultCommissionRate} as UserProfile);
      });
    }
    if (state.systemConfig) await attempt('systemConfig',()=>configurationRepository.saveSettings(state.systemConfig,actor));
    if (Array.isArray(state.zones)) await attempt('zones',()=>configurationRepository.saveZones(state.zones,actor));
    result.complete = result.errors.length===0;
    await query('UPDATE legacy_imports SET catalog_result=$1 WHERE id=$2',[JSON.stringify(result),req.params.id]);
    res.json({success:true,result});
  } catch (error) { fail(res,error); }
});
