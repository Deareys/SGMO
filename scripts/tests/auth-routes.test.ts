import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomInt } from 'node:crypto';
import { once } from 'node:events';
import { validateWorkerPin } from '../../src/server/auth/cryptoUtils';

function randomPin() {
  let pin: string;
  do { pin = String(randomInt(10000000, 100000000)); } while (!validateWorkerPin(pin).isValid);
  return pin;
}
const sellerPin = randomPin();
const adminPassword = `Aa!${randomBytes(24).toString('hex')}`;
const bootstrapSecret = randomBytes(32).toString('hex');
async function startScenario(scenario: string, overrides: Record<string, string | undefined> = {}) {
  const env = { ...process.env, NODE_ENV: 'test', SGMO_AUTH_MODE: 'demo',
    SGMO_DEMO_ADMIN_PASSWORD: adminPassword, SGMO_DEMO_SELLER_PIN: sellerPin,
    SGMO_DEMO_FACTORY_PIN: randomPin(), BOOTSTRAP_SECRET: bootstrapSecret,
    AUTH_TEST_SCENARIO: scenario };
  for (const key of ['DATABASE_URL', 'POSTGRES_URL', 'PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']) delete env[key];
  Object.assign(env, overrides);
  for (const key of Object.keys(env)) if (env[key] === undefined) delete env[key];
  const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/tests/fixtures/auth-server.ts'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let errorOutput = '';
  child.stderr.on('data', (chunk) => { errorOutput += chunk; });
  const port = await new Promise<number>((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Fixture no inició.')); }, 15000);
    child.stdout.on('data', (chunk) => {
      output += chunk;
      if (output.includes('\n')) { clearTimeout(timeout); resolve(JSON.parse(output.split('\n')[0]).port); }
    });
    child.on('exit', (code) => { clearTimeout(timeout); if (code) reject(new Error(`Fixture falló: ${errorOutput}`)); });
  });
  return {
    async request(path: string, body?: unknown, token?: string, headers: Record<string, string> = {}) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, { method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    },
    async close() { child.kill('SIGTERM'); await once(child, 'exit'); }
  };
}

test('Contrato estricto, aislamiento demo, perfiles públicos y RBAC por HTTP', async (context) => {
  const fixture = await startScenario('demo');
  context.after(() => fixture.close());
  const worker = { userCode: 'VEND-01', pin: sellerPin };
  const admin = { identifier: 'ADM-01', password: adminPassword };
  for (const [name, body, code] of [
    ['PIN sin identificador', { pin: sellerPin }, 'MISSING_USER_CODE'],
    ['PIN legado', { userCode: 'VEND-01', pin: '1234' }, 'INVALID_PIN_FORMAT'],
    ['Password sin identificador', { password: adminPassword }, 'MISSING_IDENTIFIER'],
    ['Alias trabajador', { identifier: 'VEND-01', pin: sellerPin }, 'INVALID_AUTH_CONTRACT'],
    ['Alias administrador', { userCode: 'ADM-01', password: adminPassword }, 'INVALID_AUTH_CONTRACT'],
    ['Contrato mixto', { ...worker, password: adminPassword }, 'INVALID_AUTH_CONTRACT']
  ] as const) await context.test(name, async () => {
    const result = await fixture.request('/api/auth/login', body);
    assert.equal(result.status, 400); assert.equal(result.body.code, code);
  });
  const workerLogin = await fixture.request('/api/auth/login', worker);
  assert.equal(workerLogin.status, 200);
  assert.match(workerLogin.body.token, /^[0-9a-f]{64}$/);
  const profile = await fixture.request('/api/auth/me', undefined, workerLogin.body.token);
  assert.equal(profile.status, 200);
  for (const key of ['pin', 'password', 'pinHash', 'pinSalt', 'passwordHash', 'passwordSalt', 'failedAttempts']) {
    assert.ok(!(key in workerLogin.body.user)); assert.ok(!(key in profile.body.user));
  }
  assert.equal((await fixture.request('/protected', undefined, workerLogin.body.token)).status, 403);
  assert.equal((await fixture.request('/protected')).status, 401);
  const adminLogin = await fixture.request('/api/auth/login', admin);
  assert.equal(adminLogin.status, 200);
  assert.equal((await fixture.request('/protected', undefined, adminLogin.body.token)).status, 200);
  assert.equal((await fixture.request('/api/auth/logout', {}, workerLogin.body.token)).status, 200);
  assert.equal((await fixture.request('/api/auth/me', undefined, workerLogin.body.token)).status, 401);
  await context.test('Credencial incorrecta y cuenta inexistente comparten respuesta', async () => {
    const wrong = await fixture.request('/api/auth/login', { ...worker, pin: randomPin() });
    const missing = await fixture.request('/api/auth/login', { ...worker, userCode: 'NO-EXISTE' });
    assert.equal(wrong.status, 401); assert.deepEqual(wrong, missing);
  });
  await fixture.request('/api/auth/login', worker);
  await context.test('Bootstrap sin secreto nunca abre acceso inicial', async () => {
    assert.equal((await fixture.request('/api/auth/bootstrap-admin', { identifier: 'ADM-01', newPassword: adminPassword })).status, 403);
    assert.equal((await fixture.request('/api/auth/bootstrap-admin', { identifier: 'ADM-01', newPassword: adminPassword, bootstrapSecret })).status, 503);
  });
  await context.test('Validador no consulta ni enumera cuentas', async () => {
    const result = await fixture.request('/api/auth/validate-credential', { type: 'worker_pin', value: sellerPin, identifier: 'NO-EXISTE' });
    assert.equal(result.status, 200); assert.equal(result.body.isValid, true);
    assert.equal((await fixture.request('/api/auth/validate-credential', { type: 'worker_pin', value: {} })).body.isValid, false);
    assert.equal((await fixture.request('/api/auth/login', { ...worker, pin: 'x'.repeat(5000) })).status, 413);
  });
});

for (const [name, overrides] of [
  ['NODE_ENV omitido', { NODE_ENV: undefined }],
  ['demo en producción', { NODE_ENV: 'production' }],
  ['demo no seleccionada', { SGMO_AUTH_MODE: undefined }],
  ['base central caída con demo seleccionada', { DATABASE_URL: 'postgresql://invalid:invalid@127.0.0.1:1/sgmo_auth_test' }]
] as const) test(`No hay acceso alternativo: ${name}`, async (context) => {
  const fixture = await startScenario('disabled', overrides);
  context.after(() => fixture.close());
  const result = await fixture.request('/api/auth/login', { userCode: 'VEND-01', pin: sellerPin });
  assert.equal(result.status, 503); assert.equal(result.body.token, undefined);
});

test('Fallos de persistencia, validación, revocación y cuenta inválida no habilitan sesión', async (context) => {
  const fixture = await startScenario('central', { DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:1/sgmo_auth_test' });
  context.after(() => fixture.close());
  const worker = { userCode: 'VEND-01', pin: sellerPin };
  const login = await fixture.request('/api/auth/login', worker);
  assert.equal(login.status, 200);
  const capture = await fixture.request('/test/control', {});
  const statements = capture.body.statements as string[];
  assert.ok(statements[0] === 'BEGIN');
  assert.ok(statements.findIndex((sql) => sql.includes('FOR UPDATE')) < statements.findIndex((sql) => sql.includes('INSERT INTO auth_sessions')));
  assert.ok(statements.findIndex((sql) => sql.includes('INSERT INTO auth_sessions')) < statements.indexOf('COMMIT'));
  for (const [name, failure, path, body, token] of [
    ['Guardar sesión', 'INSERT INTO auth_sessions', '/api/auth/login', worker, undefined],
    ['Validar sesión', 'UPDATE auth_sessions s', '/api/auth/me', undefined, login.body.token],
    ['Revocar sesión', 'UPDATE auth_sessions SET is_revoked', '/api/auth/logout', {}, login.body.token]
  ] as const) await context.test(name, async () => {
    await fixture.request('/test/control', { failure });
    const result = await fixture.request(path, body, token);
    assert.equal(result.status, 503); assert.equal(result.body.token, undefined);
    assert.ok(!JSON.stringify(result.body).includes('Detalle interno'));
  });
  await fixture.request('/test/control', { failure: null });
  for (const [name, patch] of [
    ['Sin aprovisionar', { isProvisioned: false }], ['Inactiva', { isActive: false }],
    ['Texto plano', { pinHash: sellerPin }], ['Salt/hash inválidos', { pinHash: 'z'.repeat(64) }]
  ] as const) await context.test(name, async () => {
    // Usar nuevo fixture evita restaurar un hash o crear acceso mediante valores conocidos.
    const isolated = await startScenario('central', { DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:1/sgmo_auth_test' });
    try {
      await isolated.request('/test/control', { patch });
      const result = await isolated.request('/api/auth/login', worker);
      assert.equal(result.status, 401); assert.equal(result.body.code, 'INVALID_CREDENTIALS'); assert.equal(result.body.token, undefined);
    } finally { await isolated.close(); }
  });
});

test('Bloqueo por origen no se evade falsificando x-forwarded-for', async (context) => {
  const fixture = await startScenario('demo');
  context.after(() => fixture.close());
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await fixture.request('/api/auth/login', { userCode: 'NO-EXISTE', pin: sellerPin }, undefined, { 'x-forwarded-for': `203.0.113.${attempt + 1}` });
    assert.equal(result.status, 401);
  }
  const blocked = await fixture.request('/api/auth/login', { userCode: 'VEND-01', pin: sellerPin }, undefined, { 'x-forwarded-for': '198.51.100.10' });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.code, 'TOO_MANY_ATTEMPTS');
});

test('Cuenta bloqueada no emite sesión ni revela credenciales por HTTP', async (context) => {
  const fixture = await startScenario('central', { DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:1/sgmo_auth_test' });
  context.after(() => fixture.close());
  await fixture.request('/test/control', { patch: { lockedUntil: new Date(Date.now() + 60000).toISOString() } });
  const result = await fixture.request('/api/auth/login', { userCode: 'VEND-01', pin: sellerPin });
  assert.equal(result.status, 429);
  assert.equal(result.body.token, undefined);
});
