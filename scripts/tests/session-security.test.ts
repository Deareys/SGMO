import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pool, type PoolClient } from 'pg';
import { generateSessionToken, hashToken } from '../../src/server/auth/cryptoUtils';

// Pool simulado sin sockets: estas pruebas no certifican ejecución SQL en PostgreSQL real.
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/session_test';
process.env.NODE_ENV = 'test';
process.env.SGMO_AUTH_MODE = 'demo'; // Una base configurada debe prevalecer sobre demo.
process.env.SGMO_ENABLE_API_TOKENS = 'true';
const originalQuery = Pool.prototype.query;
type CapturedQuery = { statement: string; parameters: unknown[] };
const capturedQueries: CapturedQuery[] = [];
let queryFailure = false;
let returnedRows: unknown[] = [];
let affectedRows = 1;
Pool.prototype.query = (async function(statement: string, parameters: unknown[] = []) {
  capturedQueries.push({ statement, parameters });
  if (queryFailure) throw new Error('Error interno con información sensible de infraestructura');
  return { rows: returnedRows, rowCount: affectedRows };
}) as typeof Pool.prototype.query;
after(() => { Pool.prototype.query = originalQuery; });

const { SessionManager, sessionManager } = await import('../../src/server/auth/sessionManager');
const { authenticateToken } = await import('../../src/server/auth/authMiddleware');
const manager = new SessionManager();
const user = { id: 'TEST-USER', name: 'Usuario efímero', role: 'seller' as const };
const resetQuery = () => {
  capturedQueries.length = 0;
  queryFailure = false;
  returnedRows = [];
  affectedRows = 1;
};

test('emisión central almacena sólo hash y exige rol/estado/aprovisionamiento vigente', async () => {
  resetQuery();
  const { token, session } = await manager.createSession(user);
  assert.match(session.id, /^SES-[0-9a-f-]{36}$/);
  assert.equal(capturedQueries.length, 1);
  const query = capturedQueries[0];
  assert.ok(query.parameters.includes(hashToken(token)));
  assert.ok(!query.parameters.includes(token));
  assert.match(query.statement, /u\.role = \$4/);
  assert.match(query.statement, /u\.is_active = TRUE/);
  assert.match(query.statement, /u\.is_provisioned = TRUE/);
  affectedRows = 0;
  await assert.rejects(manager.createSession(user));
});

test('fallo al emitir una sesión central rechaza incluso cuando está solicitado demo', async () => {
  resetQuery();
  queryFailure = true;
  await assert.rejects(manager.createSession(user));
});

test('emisión conserva el cliente transaccional del login y propaga el fallo para rollback', async () => {
  resetQuery();
  queryFailure = true; // El pool no debe ser usado cuando login ya tiene transacción.
  let clientCalls = 0;
  const client = { async query() { clientCalls++; return { rowCount: 1, rows: [] }; } } as unknown as PoolClient;
  await manager.createSession(user, undefined, client);
  assert.equal(clientCalls, 1);
  assert.equal(capturedQueries.length, 0);
  client.query = (async () => { throw new Error('Persistencia transaccional fallida'); }) as PoolClient['query'];
  await assert.rejects(manager.createSession(user, undefined, client));
});

test('sesión ausente central no puede validarse usando un duplicado local', async () => {
  resetQuery();
  const { token } = await manager.createSession(user);
  returnedRows = [];
  assert.equal(await manager.validateToken(token), null);
});

test('sesión emitida no sigue funcionando cuando falla la base central', async () => {
  resetQuery();
  const { token } = await manager.createSession(user);
  queryFailure = true;
  await assert.rejects(manager.validateToken(token));
  await assert.rejects(manager.revokeSession(token));
  await assert.rejects(manager.cleanExpiredSessions());
});

test('validación usa estado y rol central, vigencia y revocación sin cache', async () => {
  resetQuery();
  const token = generateSessionToken();
  const now = new Date();
  returnedRows = [{ id: 'TEST-SESSION', userId: user.id, role: 'coordinator', userName: user.name,
    createdAt: now, expiresAt: new Date(now.getTime() + 60000) }];
  const session = await manager.validateToken(token);
  assert.equal(session?.role, 'coordinator');
  assert.equal(session?.createdAt, now.toISOString());
  const query = capturedQueries[0];
  assert.match(query.statement, /s\.role = u\.role/);
  assert.match(query.statement, /u\.is_active = TRUE AND u\.is_provisioned = TRUE/);
  assert.match(query.statement, /s\.is_revoked = FALSE AND s\.expires_at > CURRENT_TIMESTAMP/);
  assert.equal(capturedQueries.length, 1);
  returnedRows = [];
  assert.equal(await manager.validateToken(token), null);
});

test('tokens malformados nunca consultan base ni lanzan por tipos inesperados', async () => {
  resetQuery();
  for (const malformed of [undefined, null, {}, [], 'not-a-token', 'a'.repeat(65), 'z'.repeat(64)]) {
    assert.equal(await manager.validateToken(malformed as string), null);
    assert.equal(await manager.revokeSession(malformed as string), false);
  }
  assert.equal(capturedQueries.length, 0);
});

test('middleware transforma caída de base en 503 genérico sin revelar detalles', async () => {
  resetQuery();
  queryFailure = true;
  let status = 0;
  let payload: unknown;
  let continued = false;
  const request = { headers: { authorization: `Bearer ${generateSessionToken()}`, 'x-sgmo-client': 'api' } };
  const response = { status(code: number) { status = code; return this; }, json(body: unknown) { payload = body; return this; } };
  await authenticateToken(request as never, response as never, () => { continued = true; });
  assert.equal(status, 503);
  assert.equal(continued, false);
  assert.equal((payload as { code: string }).code, 'SERVICE_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify(payload), /sensible|infraestructura|postgresql|test:test/i);
});

test('middleware rechaza token ausente e inválido y permite únicamente sesión válida', async () => {
  resetQuery();
  const originalValidate = sessionManager.validateToken;
  try {
    for (const scenario of ['missing', 'invalid', 'valid']) {
      let status = 0;
      let continued = false;
      const now = new Date().toISOString();
      sessionManager.validateToken = async () => scenario === 'valid' ? {
        id: 'TEST', userId: user.id, token: 'test-token', role: user.role, userName: user.name,
        createdAt: now, expiresAt: now, isRevoked: false
      } : null;
      const request = { headers: scenario === 'missing' ? {} : { authorization: 'Bearer test-token', 'x-sgmo-client': 'api' } };
      const response = { status(code: number) { status = code; return this; }, json() { return this; } };
      await authenticateToken(request as never, response as never, () => { continued = true; });
      assert.equal(continued, scenario === 'valid');
      assert.equal(status, scenario === 'valid' ? 0 : 401);
    }
  } finally { sessionManager.validateToken = originalValidate; }
});
