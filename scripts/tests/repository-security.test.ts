/**
 * Pruebas unitarias con cliente PostgreSQL simulado, SIN conexiones ni migraciones.
 * Comprueban validación, límites de transacción, campos devueltos y contratos SQL;
 * no demuestran concurrencia, constraints ni sintaxis contra PostgreSQL real.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import type { UserProfile } from '../../src/types';
import { getDbPool } from '../../src/server/db/connection';
import { UserRepository, UserCredentialValidationError } from '../../src/server/db/repositories/UserRepository';
import { DataIntegrityError } from '../../src/server/db/salesValidation';
import { validateWorkerPin, verifyPin, verifyPassword } from '../../src/server/auth/cryptoUtils';

// El pool nunca conecta: connect/query se reemplazan antes de ejecutar un método.
process.env.DATABASE_URL = 'postgresql://repository-test@127.0.0.1:1/repository-test';
const pool = getDbPool()!;
const originalConnect = pool.connect;
const originalQuery = pool.query;
const repository = new UserRepository();
const statements: Array<{ sql: string; parameters: unknown[] }> = [];
let role: UserProfile['role'] = 'seller';
let userExistsForCreate = false;
let administratorExists = false;
let rejectRevocation = false;
let identifierRows: object[] = [];
const publicProfile: UserProfile = {
  id: 'UNIT-USER', userCode: 'UNIT-USER', name: 'Cuenta efímera', role: 'seller',
  phone: '', commissionRate: 0.2, isActive: true
};
const query = async (sql: string, parameters: unknown[] = []) => {
  statements.push({ sql, parameters });
  if (rejectRevocation && sql.includes('UPDATE auth_sessions')) throw new Error('Revocación no disponible');
  let rows: object[] = [];
  if (sql === 'SELECT role FROM users WHERE id = $1 FOR UPDATE') rows = userExistsForCreate ? [{ role }] : [];
  else if (sql.includes('SELECT role')) rows = [{ role, is_active: true }];
  else if (sql.includes('SELECT 1 FROM users')) rows = administratorExists ? [{ exists: 1 }] : [];
  else if (sql.includes('pin_hash as "pinHash"')) rows = identifierRows;
  else if (sql.includes('SELECT') && sql.includes('FROM users')) rows = [{ ...publicProfile }];
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] };
};
const client = { query, release() {} } as unknown as PoolClient;
pool.connect = (async () => client) as typeof pool.connect;
pool.query = query as typeof pool.query;
after(async () => {
  pool.connect = originalConnect;
  pool.query = originalQuery;
  await pool.end();
});

function reset() {
  statements.length = 0;
  role = 'seller';
  userExistsForCreate = false;
  administratorExists = false;
  rejectRevocation = false;
  identifierRows = [];
}
function workerPin(): string {
  let candidate: string;
  do { candidate = crypto.randomInt(10000000, 100000000).toString(); }
  while (!validateWorkerPin(candidate).isValid);
  return candidate;
}
function adminPassword(): string { return `Admin-${crypto.randomBytes(20).toString('hex')}`; }

function transactionCommands() {
  return statements.filter(({ sql }) => /^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)).map(({ sql }) => sql);
}

test('create rechaza PIN legado, malformado y credenciales cruzadas antes de escribir', async () => {
  reset();
  const pin = workerPin();
  for (const invalid of [pin.slice(0, 4), pin.slice(0, 7), `${pin}1`, ` ${pin}`, `${pin} `, 'abcdefgh', 12345678, null, '']) {
    await assert.rejects(repository.create({ ...publicProfile, pin: invalid as string }), UserCredentialValidationError);
  }
  await assert.rejects(repository.create({ ...publicProfile, password: adminPassword() }), UserCredentialValidationError);
  await assert.rejects(repository.create({ ...publicProfile, role: 'admin', pin }), UserCredentialValidationError);
  await assert.rejects(repository.create({ ...publicProfile, role: 'admin', password: '' }), UserCredentialValidationError);
  await assert.rejects(repository.create({ ...publicProfile, role: 'unknown' as UserProfile['role'] }), UserCredentialValidationError);
  await assert.rejects(repository.create({ ...publicProfile, isActive: 'false' as unknown as boolean }), UserCredentialValidationError);
  assert.equal(statements.length, 0);
});

test('create hashea, marca aprovisionamiento y no refleja campos arbitrarios del request', async () => {
  reset();
  const pin = workerPin();
  const response = await repository.create({ ...publicProfile, pin, pinHash: 'injected', passwordHash: 'injected', privateField: 'injected' } as UserProfile);
  const insert = statements.find(({ sql }) => sql.includes('INSERT INTO users'))!;
  assert.equal(verifyPin(pin, insert.parameters[6] as string, insert.parameters[7] as string), true);
  assert.equal(insert.parameters[8], null);
  assert.equal(insert.parameters[9], null);
  assert.equal(insert.parameters[10], 'pin_8');
  assert.equal(insert.parameters[11], true);
  assert.ok(statements.some(({ sql }) => sql.includes('UPDATE auth_sessions')));
  assert.deepEqual(transactionCommands(), ['BEGIN', 'COMMIT']);
  for (const credentialField of ['pin', 'password', 'pinHash', 'pinSalt', 'passwordHash', 'passwordSalt', 'privateField']) {
    assert.equal(Object.hasOwn(response, credentialField), false);
  }
  assert.ok(!insert.parameters.includes(pin));
});

test('fallo de revocación obliga rollback de creación y aprovisionamiento', async () => {
  reset();
  rejectRevocation = true;
  await assert.rejects(repository.create({ ...publicProfile, pin: workerPin() }), /Revocación no disponible/);
  assert.deepEqual(transactionCommands(), ['BEGIN', 'ROLLBACK']);
});

test('update valida tipo por rol bloqueado y hace rollback sin cambiar credenciales', async () => {
  reset();
  role = 'admin';
  await assert.rejects(repository.updatePin(publicProfile.id, workerPin()), UserCredentialValidationError);
  assert.deepEqual(transactionCommands(), ['BEGIN', 'ROLLBACK']);
  assert.ok(statements.some(({ sql }) => sql.includes('FOR UPDATE')));
  assert.ok(!statements.some(({ sql }) => sql.includes('UPDATE users')));
  reset();
  await assert.rejects(repository.updatePassword(publicProfile.id, adminPassword()), UserCredentialValidationError);
  assert.deepEqual(transactionCommands(), ['BEGIN', 'ROLLBACK']);
});

test('cambio de rol sin credencial desactiva aprovisionamiento y revoca en la misma transacción', async () => {
  reset();
  await repository.update(publicProfile.id, { role: 'admin' });
  const update = statements.find(({ sql }) => sql.includes('UPDATE users'))!;
  assert.deepEqual(update.parameters.slice(1, 7), [null, null, null, null, 'password_14', false]);
  const updateIndex = statements.findIndex(({ sql }) => sql.includes('UPDATE users'));
  const revokeIndex = statements.findIndex(({ sql }) => sql.includes('UPDATE auth_sessions'));
  assert.ok(updateIndex < revokeIndex);
  assert.equal(statements.at(-1)?.sql, 'COMMIT');
});

test('restablecer PIN completa aprovisionamiento y contraseña opuesta queda nula', async () => {
  reset();
  const pin = workerPin();
  await repository.updatePin(publicProfile.id, pin);
  const update = statements.find(({ sql }) => sql.includes('UPDATE users'))!;
  assert.equal(verifyPin(pin, update.parameters[0] as string, update.parameters[1] as string), true);
  assert.deepEqual(update.parameters.slice(2, 6), [null, null, 'pin_8', true]);
  assert.ok(statements.some(({ sql }) => sql.includes('UPDATE auth_sessions')));
  assert.deepEqual(transactionCommands(), ['BEGIN', 'COMMIT']);
});

test('desactivar cuenta revoca y no permite booleanos convertidos desde strings', async () => {
  reset();
  await repository.update(publicProfile.id, { isActive: false });
  assert.ok(statements.some(({ sql }) => sql.includes('UPDATE auth_sessions')));
  reset();
  await assert.rejects(repository.update(publicProfile.id, { isActive: 'false' as unknown as boolean }), UserCredentialValidationError);
  assert.equal(statements.length, 0);
});

test('bootstrap nunca reutiliza una instalación con administrador provisionado', async () => {
  reset();
  administratorExists = true;
  assert.equal(await repository.bootstrapInitialAdmin('UNIT-ADMIN', adminPassword()), false);
  assert.ok(statements.some(({ sql }) => sql.includes('pg_advisory_xact_lock')));
  assert.ok(statements.some(({ sql }) => sql.includes('LOCK TABLE users')));
  assert.ok(!statements.some(({ sql }) => sql.includes('UPDATE users')));
});

test('bootstrap inicial requiere cuenta admin activa sin provisionar y escritura/revocación atómicas', async () => {
  for (const candidate of [null, { ...publicProfile, role: 'seller' }, { ...publicProfile, role: 'admin', isActive: false }, { ...publicProfile, role: 'admin', isProvisioned: true }]) {
    reset();
    identifierRows = candidate ? [candidate] : [];
    assert.equal(await repository.bootstrapInitialAdmin('UNIT-ADMIN', adminPassword()), false);
    assert.ok(!statements.some(({ sql }) => sql.includes('UPDATE users')));
  }
  reset();
  const password = adminPassword();
  identifierRows = [{ ...publicProfile, role: 'admin', isProvisioned: false }];
  assert.equal(await repository.bootstrapInitialAdmin('UNIT-ADMIN', password), true);
  const update = statements.find(({ sql }) => sql.includes('UPDATE users'))!;
  assert.equal(verifyPassword(password, update.parameters[0] as string, update.parameters[1] as string), true);
  assert.ok(statements.some(({ sql }) => sql.includes('UPDATE auth_sessions')));
  assert.deepEqual(transactionCommands(), ['BEGIN', 'COMMIT']);
});

test('identificador ambiguo no selecciona una cuenta arbitraria', async () => {
  reset();
  identifierRows = [{ ...publicProfile }, { ...publicProfile, id: 'UNIT-OTHER' }];
  assert.equal(await repository.getAuthRecordByIdentifier('ambiguous', client), null);
  assert.ok(statements.at(-1)?.sql.includes('FOR UPDATE'));
});

test('bootstrap guarda identidad del dueño junto con su credencial y revierte si falla la revocación', async () => {
  reset();
  await assert.rejects(repository.bootstrapInitialAdmin('UNIT-ADMIN', adminPassword(), { name: 'Dueño', email: 'sin-correo' }), UserCredentialValidationError);
  assert.equal(statements.length, 0);
  identifierRows = [{ ...publicProfile, role: 'admin', isProvisioned: false }];
  assert.equal(await repository.bootstrapInitialAdmin('UNIT-ADMIN', adminPassword(), { name: ' Dueño QA ', email: ' owner@example.invalid ' }), true);
  const update = statements.find(({ sql }) => sql.includes('UPDATE users'))!;
  assert.deepEqual(update.parameters.slice(3), ['Dueño QA', 'owner@example.invalid']);
  assert.deepEqual(transactionCommands(), ['BEGIN', 'COMMIT']);
  reset();
  identifierRows = [{ ...publicProfile, role: 'admin', isProvisioned: false }];
  rejectRevocation = true;
  await assert.rejects(repository.bootstrapInitialAdmin('UNIT-ADMIN', adminPassword(), { name: 'Dueño QA', email: 'owner@example.invalid' }));
  assert.deepEqual(transactionCommands(), ['BEGIN', 'ROLLBACK']);
});

// Crear con un ID previo antes usaba UPSERT y eludía controles económicos de update.
test('create con ID existente no reemplaza rol, comisión, credenciales ni estado de la cuenta', async () => {
  reset(); userExistsForCreate = true;
  await assert.rejects(repository.create({ ...publicProfile, pin: workerPin(), commissionRate: 1 }),
    (error: unknown) => error instanceof DataIntegrityError && error.status === 409 && error.code === 'USER_ID_EXISTS');
  assert.deepEqual(transactionCommands(), ['BEGIN', 'ROLLBACK']);
  assert.ok(!statements.some(({ sql }) => sql.includes('INSERT INTO users') || sql.includes('UPDATE users') || sql.includes('UPDATE auth_sessions')));
});
