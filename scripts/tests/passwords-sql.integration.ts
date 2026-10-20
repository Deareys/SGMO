/** Credenciales personales sobre SQL desechable. Nunca carga .env ni acepta destinos remotos. */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';
import type { UserProfile } from '../../src/types';
import { hashPassword, hashPin, hashToken, verifyPassword, verifyPin } from '../../src/server/auth/cryptoUtils';

const mode = process.argv[2] ?? '--wasm';
if (!['--postgres','--wasm'].includes(mode)) throw new Error('Seleccionar --postgres o --wasm.');
const ownSchema = `sgmo_password_test_${randomBytes(6).toString('hex')}`;
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
  process.env.DATABASE_URL = 'postgresql://test@127.0.0.1:1/sgmo_password_test_wasm';
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
let applicationPool: Pool | null = null;
const password = () => randomBytes(6).toString('hex');
const profile = (id: string, role: UserProfile['role'] = 'seller'): UserProfile => ({
  id, userCode: id, name: 'Prueba efímera de credenciales', role, phone: '', commissionRate: 0, isActive: true
});
async function check(title: string, action: () => Promise<void>) {
  await action(); passed++; console.log(`PASS ${title}`);
}
try {
  await setupPool.query(`CREATE SCHEMA ${ownSchema}`);
  if (mode === '--wasm') await database.exec(`SET search_path TO ${ownSchema}`);
  const migrations = (await readdir('migrations')).filter(name => name.endsWith('.sql')).sort();
  for (const filename of migrations.filter(name => name < '009')) {
    await setupPool.query(await readFile(resolve('migrations', filename), 'utf8'));
  }
  const legacyPassword = password() + password();
  const legacyPin = '58392047';
  const passwordHash = hashPassword(legacyPassword), pinHash = hashPin(legacyPin);
  await setupPool.query(`INSERT INTO users(id,user_code,name,role,password_hash,password_salt,credential_type,is_provisioned)
    VALUES('PW-ADMIN','PW-ADMIN','Administrador efímero','admin',$1,$2,'password_14',TRUE)`, [passwordHash.hash,passwordHash.salt]);
  await setupPool.query(`INSERT INTO users(id,user_code,name,role,pin_hash,pin_salt,credential_type,is_provisioned)
    VALUES('PW-LEGACY','PW-LEGACY','Trabajador previo','seller',$1,$2,'pin_8',TRUE)`, [pinHash.hash,pinHash.salt]);
  for (const filename of migrations.filter(name => name >= '009')) {
    await setupPool.query(await readFile(resolve('migrations', filename), 'utf8'));
  }
  const { userRepository } = await import('../../src/server/db/repositories/UserRepository');
  const { passwordRepository, PasswordFlowError } = await import('../../src/server/db/repositories/PasswordRepository');
  const { sessionManager } = await import('../../src/server/auth/sessionManager');
  const { query, getDbPool } = await import('../../src/server/db/connection');
  applicationPool = getDbPool();
  const administratorSession = (await sessionManager.createSession(profile('PW-ADMIN', 'admin'))).session;
  const issue = (id: string) => passwordRepository.issueActivation(id, administratorSession, legacyPassword);
  const unavailable = (error: unknown) => error instanceof PasswordFlowError && error.code === 'ACTIVATION_UNAVAILABLE';

  await check('009 preserva hashes, PIN y tipos históricos sin cambiar credenciales', async () => {
    const admin = await userRepository.getAuthRecordById('PW-ADMIN');
    const legacy = await userRepository.getAuthRecordById('PW-LEGACY');
    assert.equal(admin!.passwordHash, passwordHash.hash); assert.equal(admin!.credentialType, 'password_14');
    assert.equal(legacy!.pinHash, pinHash.hash); assert.equal(verifyPin(legacyPin, legacy!.pinHash, legacy!.pinSalt), true);
    assert.equal(String(legacy!.credentialVersion), '0');
  });
  await check('Reautenticación obligatoria y contador de fallos confirmado por COMMIT', async () => {
    await assert.rejects(passwordRepository.issueActivation('PW-LEGACY', administratorSession, password()),
      (error: unknown) => error instanceof PasswordFlowError && error.status === 401);
    assert.equal((await userRepository.getAuthRecordById('PW-ADMIN'))!.failedAttempts, 1);
    const workerSession = (await sessionManager.createSession(profile('PW-LEGACY'))).session;
    await assert.rejects(passwordRepository.issueActivation('PW-LEGACY', workerSession, legacyPin));
    assert.equal((await query('SELECT count(*)::int AS count FROM auth_password_activations')).rows[0].count, 0);
  });
  await check('Alta sin clave, enlace almacenado como hash y elección personal de 12 caracteres', async () => {
    await userRepository.create(profile('PW-NEW'));
    const activation = await issue('PW-NEW');
    assert.match(activation.token, /^[a-f0-9]{64}$/);
    const stored = (await query('SELECT * FROM auth_password_activations WHERE user_id=$1', ['PW-NEW'])).rows[0];
    assert.equal(stored.token_hash, hashToken(activation.token)); assert.notEqual(stored.token_hash, activation.token);
    assert.equal(new Date(stored.expires_at).getTime() - new Date(stored.created_at).getTime() < 901000, true);
    assert.equal((await userRepository.getAuthRecordById('PW-NEW'))!.isProvisioned, false);
    await assert.rejects(passwordRepository.completeActivation(activation.token, 'Password1234'));
    const selected = password();
    await passwordRepository.completeActivation(activation.token, selected);
    const account = (await userRepository.getAuthRecordById('PW-NEW'))!;
    assert.equal(account.credentialType, 'password_12'); assert.equal(account.pinHash, null);
    assert.equal(verifyPassword(selected, account.passwordHash, account.passwordSalt), true);
    await assert.rejects(passwordRepository.completeActivation(activation.token, password()), unavailable);
    const publicUser = await userRepository.getById('PW-NEW');
    for (const key of ['passwordHash','passwordSalt','pinHash','pinSalt','credentialVersion']) assert.equal(Object.hasOwn(publicUser!, key), false);
  });
  await check('Nuevo enlace invalida el anterior y vencimiento usa el reloj de SQL', async () => {
    const first = await issue('PW-NEW'), replacement = await issue('PW-NEW');
    await assert.rejects(passwordRepository.completeActivation(first.token, password()), unavailable);
    await query(`UPDATE auth_password_activations SET created_at=clock_timestamp()-INTERVAL '20 minutes',
      expires_at=clock_timestamp()-INTERVAL '1 minute' WHERE token_hash=$1`, [hashToken(replacement.token)]);
    await assert.rejects(passwordRepository.completeActivation(replacement.token, password()), unavailable);
    await assert.rejects(passwordRepository.completeActivation(randomBytes(32).toString('hex'), password()), unavailable);
  });
  await check('Cambio propio convierte PIN, exige actual y revoca todas las sesiones y enlaces', async () => {
    const first = await sessionManager.createSession(profile('PW-LEGACY'));
    const second = await sessionManager.createSession(profile('PW-LEGACY'));
    const activation = await issue('PW-LEGACY');
    await assert.rejects(passwordRepository.changePassword(first.session, 'invalid', password()));
    assert.equal((await userRepository.getAuthRecordById('PW-LEGACY'))!.failedAttempts, 1);
    const selected = password();
    await passwordRepository.changePassword(first.session, legacyPin, selected);
    for (const token of [first.token, second.token]) assert.equal(await sessionManager.validateToken(token), null);
    const account = (await userRepository.getAuthRecordById('PW-LEGACY'))!;
    assert.equal(account.pinHash, null); assert.equal(account.failedAttempts, 0);
    assert.equal(verifyPassword(selected, account.passwordHash, account.passwordSalt), true);
    await assert.rejects(passwordRepository.completeActivation(activation.token, password()), unavailable);
    const fresh = await sessionManager.createSession(profile('PW-LEGACY'));
    await assert.rejects(passwordRepository.changePassword(fresh.session, selected, selected),
      (error: unknown) => error instanceof PasswordFlowError && error.code === 'PASSWORD_REUSED');
    assert.ok(await sessionManager.validateToken(fresh.token));
  });
  await check('Inactividad, permisos e identidad del emisor invalidan enlaces previos', async () => {
    let activation = await issue('PW-NEW');
    await userRepository.update('PW-NEW', { isActive: false });
    await userRepository.update('PW-NEW', { isActive: true });
    await assert.rejects(passwordRepository.completeActivation(activation.token, password()), unavailable);
    activation = await issue('PW-NEW');
    await userRepository.update('PW-NEW', { permissions: [] });
    await assert.rejects(passwordRepository.completeActivation(activation.token, password()), unavailable);
    activation = await issue('PW-NEW');
    await userRepository.update('PW-ADMIN', { permissions: [] });
    await assert.rejects(passwordRepository.completeActivation(activation.token, password()), unavailable);
  });
  await check('Fallo SQL revierte consumo, contraseña y sesiones; el código permite reintento seguro', async () => {
    const current = (await sessionManager.createSession(profile('PW-ADMIN', 'admin'))).session;
    const activation = await passwordRepository.issueActivation('PW-NEW', current, legacyPassword);
    const before = (await userRepository.getAuthRecordById('PW-NEW'))!.passwordHash;
    const session = await sessionManager.createSession(profile('PW-NEW'));
    await query(`CREATE FUNCTION reject_password_revocation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Fallo deliberado QA'; END; $$`);
    await query(`CREATE TRIGGER password_revocation_failure BEFORE UPDATE ON auth_sessions
      FOR EACH ROW WHEN (OLD.user_id='PW-NEW') EXECUTE FUNCTION reject_password_revocation()`);
    await assert.rejects(passwordRepository.completeActivation(activation.token, password()));
    assert.equal((await userRepository.getAuthRecordById('PW-NEW'))!.passwordHash, before);
    assert.equal((await query('SELECT consumed_at FROM auth_password_activations WHERE token_hash=$1', [hashToken(activation.token)])).rows[0].consumed_at, null);
    await query('DROP TRIGGER password_revocation_failure ON auth_sessions');
    assert.ok(await sessionManager.validateToken(session.token));
    await passwordRepository.completeActivation(activation.token, password());
    assert.equal(await sessionManager.validateToken(session.token), null);
  });
  await check('Recuperación del dueño sólo por operador y consumo competitivo único', async () => {
    const activation = await passwordRepository.issueOwnerRecovery('PW-ADMIN');
    await assert.rejects(passwordRepository.issueOwnerRecovery('PW-NEW'));
    const attempts = await Promise.allSettled([
      passwordRepository.completeActivation(activation.token, password()),
      passwordRepository.completeActivation(activation.token, password())
    ]);
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter(result => result.status === 'rejected').length, 1);
    const audit = (await query('SELECT details FROM audit_logs')).rows;
    assert.ok(audit.length > 0); assert.ok(audit.every(row => !row.details.includes(activation.token)));
  });
  console.log(`RESULTADO: ${passed} grupos de contraseñas SQL aprobados (${mode}; WASM no prueba transporte distribuido).`);
} finally {
  await applicationPool?.end();
  if (mode === '--postgres') await setupPool.query(`DROP SCHEMA IF EXISTS ${ownSchema} CASCADE`);
  await setupPool.end();
  if (mode === '--wasm') {
    Pool.prototype.query = originalQuery; Pool.prototype.connect = originalConnect;
    await database.close();
  }
}
