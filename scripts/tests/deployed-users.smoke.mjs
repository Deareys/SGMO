/** QA mutativa y explícita sobre deployment/base AISLADOS. Nunca usar contra cuentas reales.
 * Configuración privada fuera de Git; credenciales sólo en memoria/archivo 0600.
 * El operador verifica rama/variables de Vercel y rama Neon antes de habilitarla.
 * No llama a pagos ni OCR. Retira sólo las cuentas sintéticas que este ensayo creó.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const configPath = process.env.SGMO_REMOTE_AUTH_QA_CONFIG;
if (process.env.SGMO_REMOTE_AUTH_QA_ENABLE !== 'true' || !configPath || !path.isAbsolute(configPath)
    || !process.argv.includes('--apply')) throw new Error('QA remota deshabilitada. Requiere --apply, entorno QA explícito y archivo privado absoluto.');
const actualConfigPath = await fs.realpath(configPath);
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
if (actualConfigPath.startsWith(projectRoot) || ((await fs.stat(actualConfigPath)).mode & 0o077) !== 0) {
  throw new Error('La configuración con secretos debe estar fuera del repositorio y tener permisos 0600.');
}
const config = JSON.parse(await fs.readFile(actualConfigPath, 'utf8'));
const origin = new URL(config.origin);
if (origin.protocol !== 'https:' || origin.origin !== config.origin || !origin.hostname.endsWith('.vercel.app')
    || origin.hostname === 'sgmo-rose.vercel.app' || origin.username || origin.password
    || config.isolatedDatabaseVerified !== true || config.expectedGitBranch !== 'qa/login-20261029'
    || !/^[a-f0-9]{40}$/.test(config.expectedRevision || '') || !/^[a-f0-9]{64}$/.test(config.bootstrapSecret || '')
    || !config.databaseBranchId || !config.shareToken) throw new Error('Destino QA no verificado; no se envían credenciales.');
const previous = process.env.SGMO_REMOTE_AUTH_QA_RESUME === 'true' ? config.qaRun : null;
if (process.env.SGMO_REMOTE_AUTH_QA_RESUME === 'true' && !previous) throw new Error('No hay una ejecución QA privada para reanudar.');
if (previous && (!/^[a-f0-9]{12}$/.test(previous.runId || '') || previous.accountId !== `QA-LOGIN-${previous.runId}`
    || !/^[a-f0-9]{24}$/.test(previous.ownerPassword || '') || !/^[a-f0-9]{12}$/.test(previous.initialPassword || '')
    || !/^[a-f0-9]{12}$/.test(previous.replacementPassword || ''))) throw new Error('Estado privado QA inválido.');
const runId = previous?.runId || crypto.randomBytes(6).toString('hex');
const accountId = `QA-LOGIN-${runId}`;
const initialPassword = previous?.initialPassword || crypto.randomBytes(6).toString('hex');
const replacementPassword = previous?.replacementPassword || crypto.randomBytes(6).toString('hex');
const ownerPassword = previous?.ownerPassword || crypto.randomBytes(12).toString('hex');
const initialEmail = `qa-login-${runId}@example.invalid`;
const changedEmail = `qa-edit-${runId}@example.invalid`;
const userCode = `00${runId}`;
const secrets = [config.bootstrapSecret,config.shareToken,initialPassword,replacementPassword,ownerPassword];
// Guardar antes de escribir permite retirar la cuenta sintética incluso si se pierde una respuesta.
await fs.writeFile(configPath, JSON.stringify({ ...config, qaRun: { runId,accountId,ownerPassword,initialPassword,replacementPassword } }), {mode:0o600});
const checks = [];
let currentStep = 'Preparación HTTPS';
let administratorAuthenticated = false, workerCreated = false, adminRetired = false;

class BrowserSession {
  cookies = new Map();
  csrf = '';
  sessionCookieFlags = [];
  async request(endpoint, body, method = body === undefined ? 'GET' : 'POST') {
    const headers = { Origin: config.origin, 'Content-Type':'application/json' };
    if (this.cookies.size) headers.Cookie = [...this.cookies].map(([key,value]) => `${key}=${value}`).join('; ');
    if (this.csrf && method !== 'GET') headers['X-CSRF-Token'] = this.csrf;
    const response = await fetch(new URL(endpoint, origin), {method,headers,redirect:'manual',signal:AbortSignal.timeout(25000),
      body:body === undefined ? undefined : JSON.stringify(body)});
    for (const header of response.headers.getSetCookie()) {
      const [pair,...flags] = header.split(';'); const separator = pair.indexOf('=');
      const key = pair.slice(0,separator), value = pair.slice(separator+1);
      if (value) this.cookies.set(key,value); else this.cookies.delete(key);
      if (key === '__Host-sgmo-session' && value) this.sessionCookieFlags = flags.map(flag => flag.trim().toLowerCase());
    }
    const text = await response.text(); let result; try { result = JSON.parse(text); } catch {}
    if (endpoint === '/api/auth/csrf' && response.ok) this.csrf = result?.csrfToken;
    // La respuesta de protección de Vercel puede repetir su propio enlace;
    // la comprobación de secretos corresponde a las respuestas de la aplicación.
    if (result && endpoint.startsWith('/api/')) {
      const serialized = JSON.stringify(result);
      for (const secret of secrets) assert.equal(serialized.includes(secret),false,'Respuesta contiene un secreto de QA');
      const records = [result.user,...(Array.isArray(result.users)?result.users:[])].filter(Boolean);
      for (const profile of records) for (const key of ['pin','password','pinHash','pinSalt','passwordHash','passwordSalt','credentialVersion']) {
        assert.equal(Object.hasOwn(profile,key),false,`Campo privado expuesto: ${key}`);
      }
    }
    return {status:response.status,body:result};
  }
  async initialize() {
    const shared = await this.request('/?_vercel_share='+encodeURIComponent(config.shareToken));
    assert.ok([200,302,303,307,308].includes(shared.status));
    const csrf = await this.request('/api/auth/csrf'); assert.equal(csrf.status,200);
    assert.match(this.csrf,/^[a-f0-9]{64}$/);
  }
  login(identifier,password) { return this.request('/api/auth/login',{identifier,password}); }
}
const first = new BrowserSession(), administrator = new BrowserSession(), second = new BrowserSession();
async function check(name, action) { currentStep=name; await action(); checks.push({name,passed:true}); console.log(`PASS ${name}`); }
let failure;
try {
  await first.initialize();
  await check('Revisión exacta y conexión real con PostgreSQL bajo HTTPS',async()=>{
    const health=await first.request('/api/health'); assert.equal(health.status,200);
    assert.equal(health.body.revision,config.expectedRevision); assert.equal(health.body.authTransport,'httpOnly-cookie');
    const db=await first.request('/api/db/status'); assert.equal(db.status,200); assert.equal(db.body.connected,true);
  });
  await check('Administrador sintético activado sin credenciales predeterminadas',async()=>{
    // Resume sólo permite reutilizar las credenciales propias de una prueba
    // interrumpida antes de editar: nunca reabre bootstrap ni cambia claves ajenas.
    if (!previous) {
      const bootstrap=await first.request('/api/auth/bootstrap-admin',{identifier:'ADM-01',newPassword:ownerPassword,
        bootstrapSecret:config.bootstrapSecret,ownerName:'Administrador QA no operativo',ownerEmail:`qa-owner-${runId}@example.invalid`});
      assert.equal(bootstrap.status,200);
    }
    assert.equal((await first.login('ADM-01',ownerPassword)).status,200);
    assert.ok(first.sessionCookieFlags.includes('secure')&&first.sessionCookieFlags.includes('httponly')&&first.sessionCookieFlags.includes('samesite=strict'));
  });
  await check('Alta confirmada y recuperada desde la lista central, sin contraseña pública',async()=>{
    if (!previous) {
      const created=await first.request('/api/users',{id:accountId,userCode,name:'Usuario QA de persistencia',email:initialEmail.toUpperCase(),
        password:initialPassword,role:'seller',assignedHouseId:'HOUSE-NORTE',commissionRate:0,isActive:true});
      assert.equal(created.status,201);
    }
    workerCreated=true;
    const list=await first.request('/api/users'); assert.equal(list.status,200);
    assert.equal(list.body.users.find(user=>user.id===accountId).email,initialEmail);
  });
  await check('Salir del administrador e ingresar al usuario por código/correo funciona',async()=>{
    assert.equal((await first.request('/api/auth/logout',{})).status,200);
    const login=await first.login(userCode,initialPassword); assert.equal(login.status,200); assert.equal(login.body.user.id,accountId);
    assert.equal((await first.request('/api/users')).status,403);
    assert.equal((await first.request('/api/auth/logout',{})).status,200);
    assert.equal((await first.login(initialEmail,initialPassword)).status,200);
    await administrator.initialize(); assert.equal((await administrator.login('ADM-01',ownerPassword)).status,200);
    administratorAuthenticated=true;
  });
  await check('Edición sin contraseña conserva acceso y guarda nombre/correo',async()=>{
    assert.equal((await administrator.request('/api/users/'+accountId,{name:'Usuario QA editado',email:changedEmail},'PUT')).status,200);
    const me=await first.request('/api/auth/me'); assert.equal(me.status,200); assert.equal(me.body.user.name,'Usuario QA editado');
    assert.equal((await first.request('/api/auth/logout',{})).status,200);
    assert.equal((await first.login(changedEmail,initialPassword)).status,200);
  });
  await check('Contraseña nueva persiste, invalida la anterior y revoca sesión previa',async()=>{
    assert.equal((await administrator.request('/api/users/'+accountId,{password:replacementPassword},'PUT')).status,200);
    assert.equal((await first.request('/api/auth/me')).status,401);
    assert.equal((await first.login(changedEmail,initialPassword)).status,401);
    assert.equal((await first.login(changedEmail,replacementPassword)).status,200);
    await second.initialize(); const login=await second.login(userCode,replacementPassword); assert.equal(login.status,200); assert.equal(login.body.user.id,accountId);
  });
  await check('Correo duplicado rechazado sin reemplazar la cuenta previa',async()=>{
    const duplicate=await administrator.request('/api/users',{id:`QA-DUP-${runId}`,userCode:`DUP-${runId}`,name:'Duplicado QA',
      email:changedEmail.toUpperCase(),password:initialPassword,role:'seller',commissionRate:0,isActive:true});
    assert.equal(duplicate.status,409); assert.equal(duplicate.body.code,'DUPLICATE_USER_EMAIL');
    const list=await administrator.request('/api/users'); assert.equal(list.body.users.filter(user=>user.email===changedEmail).length,1);
    assert.equal(list.body.users.some(user=>user.id===`QA-DUP-${runId}`),false);
  });
  await check('Retiro de cuentas QA revoca todas sus sesiones sin borrar perfiles',async()=>{
    assert.equal((await administrator.request('/api/users/'+accountId,{isActive:false},'PUT')).status,200);
    assert.equal((await first.request('/api/auth/me')).status,401); assert.equal((await second.request('/api/auth/me')).status,401);
    assert.equal((await administrator.request('/api/users/USR-ADMIN-01',{isActive:false},'PUT')).status,200); adminRetired=true;
    assert.equal((await administrator.request('/api/auth/me')).status,401);
  });
} catch (error) {
  failure={step:currentStep,name:error?.name||'Error'};
  if(error instanceof assert.AssertionError) {
    if(typeof error.actual==='number') failure.actual=error.actual;
    if(typeof error.expected==='number') failure.expected=error.expected;
  }
  console.error(JSON.stringify({failed:failure})); process.exitCode=1;
} finally {
  if(!administratorAuthenticated&&!adminRetired) {
    try { await administrator.initialize(); administratorAuthenticated=(await administrator.login('ADM-01',ownerPassword)).status===200; }
    catch { /* El operador verifica/retira las cuentas si el acceso temporal venció. */ }
  }
  if(administratorAuthenticated&&!adminRetired) {
    if(workerCreated) await administrator.request('/api/users/'+accountId,{isActive:false},'PUT').catch(()=>{});
    const retired=await administrator.request('/api/users/USR-ADMIN-01',{isActive:false},'PUT').catch(()=>({status:0}));
    adminRetired=retired.status===200;
  }
  const report={origin:config.origin,revision:config.expectedRevision,databaseBranchId:config.databaseBranchId,runId,resumed:!!previous,
    checks,passed:!failure&&adminRetired,failed:failure||null,qaCredentialsRetired:adminRetired,providerCalls:0,
    scope:'HTTP HTTPS real de Vercel a Neon aislado, cuentas sintéticas. No prueba UI remota ni pagos/OCR.'};
  const serialized=JSON.stringify(report,null,2); for(const secret of secrets)assert.equal(serialized.includes(secret),false);
  await fs.writeFile(process.env.SGMO_REMOTE_AUTH_QA_REPORT||'/tmp/sgmo-deployed-users-summary.json',serialized);
  console.log(`RESULTADO: ${checks.length}/8 escenarios de usuarios en Vercel/Neon; retiro QA=${adminRetired}.`);
}
