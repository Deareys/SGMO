/**
 * Hito 1.2.2: dos procesos HTTP auténticos contra PostgreSQL local exclusivo.
 * Credenciales efímeras, routers reales y aislamiento por esquema. El proxy TCP
 * permite cortar el transporte real sin apagar/alterar un motor compartido.
 */
import assert from 'node:assert/strict';
import { randomBytes, randomInt } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { validateWorkerPin } from '../../src/server/auth/cryptoUtils';

const rawUrl = process.env.SGMO_AUTH_TEST_DATABASE_URL;
if (!rawUrl) throw new Error('Falta SGMO_AUTH_TEST_DATABASE_URL para PostgreSQL local exclusivo.');
let target: URL;
try { target = new URL(rawUrl); }
catch { throw new Error('URL de pruebas inválida; no se imprime su contenido.'); }
if (!['postgres:', 'postgresql:'].includes(target.protocol)
    || !['127.0.0.1', '[::1]'].includes(target.hostname)
    || !/^\/sgmo_auth_test[a-z0-9_]*$/.test(target.pathname)
    || target.search || target.hash) {
  throw new Error('Destino rechazado: requiere PostgreSQL loopback, base sgmo_auth_test* y sin opciones URL.');
}
const schema = `sgmo_auth_test_http_${randomBytes(6).toString('hex')}`;
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
assert.equal(resolve(process.cwd()), resolve(projectRoot));
const secrets = [rawUrl];
const outcomes: string[] = [];
let currentTest = 'Preparación PostgreSQL local';
const children = new Set<ChildProcess>();
const sockets = new Set<net.Socket>();
let transportAvailable = true;
let applicationPool: Pool | null = null;
const controllerUrl = new URL(target);
controllerUrl.searchParams.set('options', `-c search_path=${schema}`);
const controller = new Pool({ connectionString: controllerUrl.href, ssl: false, connectionTimeoutMillis: 5000 });
const sharedSecret = randomBytes(32).toString('hex');
secrets.push(sharedSecret);

function pin(): string {
  for (;;) {
    const candidate = String(randomInt(0, 100_000_000)).padStart(8, '0');
    if (validateWorkerPin(candidate).isValid) { secrets.push(candidate); return candidate; }
  }
}
function password(): string {
  const candidate = `Aa!${randomBytes(24).toString('hex')}9`;
  secrets.push(candidate);
  return candidate;
}
const workerPin = pin();
let wrongPin = pin();
while (wrongPin === workerPin) wrongPin = pin();
const adminPasswords = [password(), password()];
const workerIdentity = { userCode: 'HTTP-WORKER', pin: workerPin };

/** Browser-style jar: cookie token jamás se obtiene del JSON del login. */
class BrowserClient {
  readonly cookies = new Map<string, string>();
  csrf = '';
  async request(origin: string, path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') {
    const headers: Record<string, string> = { Origin: origin, 'Content-Type': 'application/json' };
    if (this.cookies.size) headers.Cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    if (method !== 'GET' && this.csrf) headers['X-CSRF-Token'] = this.csrf;
    const response = await fetch(`${origin}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000)
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';');
      const separator = pair.indexOf('=');
      this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    const result = { status: response.status, body: await response.json() };
    if (path === '/api/auth/csrf' && response.ok) this.csrf = result.body.csrfToken;
    for (const key of ['pin', 'password', 'pinHash', 'pinSalt', 'passwordHash', 'passwordSalt', 'token']) {
      assert.equal(Object.hasOwn(result.body, key), false, 'Respuesta browser expuso credenciales.');
      if (result.body.user) assert.equal(Object.hasOwn(result.body.user, key), false);
    }
    return result;
  }
  async initialize(origin: string) {
    const response = await this.request(origin, '/api/auth/csrf');
    assert.equal(response.status, 200);
    assert.ok(this.csrf);
  }
}

const proxy = net.createServer((downstream) => {
  if (!transportAvailable) { downstream.destroy(); return; }
  const upstream = net.connect({ host: target.hostname === '[::1]' ? '::1' : target.hostname, port: Number(target.port || 5432) });
  for (const socket of [downstream, upstream]) {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => { downstream.destroy(); upstream.destroy(); });
  }
  downstream.pipe(upstream);
  upstream.pipe(downstream);
  downstream.on('close', () => upstream.destroy());
  upstream.on('close', () => downstream.destroy());
});

async function startWorker(): Promise<{ process: ChildProcess; origin: string }> {
  const address = proxy.address();
  assert.ok(address && typeof address !== 'string');
  const workerUrl = new URL(controllerUrl);
  workerUrl.hostname = '127.0.0.1';
  workerUrl.port = String(address.port);
  const environment = { ...process.env };
  for (const key of ['DATABASE_URL', 'POSTGRES_URL', 'PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD',
    'PGPORT', 'PGOPTIONS', 'PGSERVICE', 'PGSERVICEFILE', 'GEMINI_API_KEY', 'MERCADOPAGO_ACCESS_TOKEN',
    'MP_ACCESS_TOKEN', 'SGMO_DEMO_ADMIN_PASSWORD', 'SGMO_DEMO_SELLER_PIN', 'SGMO_DEMO_FACTORY_PIN',
    'SGMO_ENABLE_API_TOKENS', 'SGMO_PUBLIC_ORIGIN', 'VERCEL_URL']) delete environment[key];
  Object.assign(environment, {
    DATABASE_URL: workerUrl.href, DATABASE_SSL: 'false', NODE_ENV: 'test',
    SGMO_AUTH_MODE: 'central', SGMO_POSTGRES_HTTP_FIXTURE: 'true', BOOTSTRAP_SECRET: sharedSecret
  });
  const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/tests/fixtures/postgres-http-server.ts'], {
    cwd: projectRoot, env: environment, stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });
  children.add(child);
  // No reenviar logs del driver: podrían contener identificadores sensibles de infraestructura.
  child.stdout?.resume();
  child.stderr?.resume();
  const port = await new Promise<number>((resolveReady, reject) => {
    const timeout = setTimeout(() => reject(new Error('Servidor HTTP de prueba no inició.')), 15000);
    child.once('message', (message: { port: number }) => { clearTimeout(timeout); resolveReady(message.port); });
    child.once('exit', () => { clearTimeout(timeout); reject(new Error('Servidor HTTP de prueba terminó.')); });
  });
  return { process: child, origin: `http://127.0.0.1:${port}` };
}
async function stopWorker(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) { children.delete(child); return; }
  const finished = once(child, 'exit');
  child.kill('SIGTERM');
  const forced = setTimeout(() => child.kill('SIGKILL'), 3000);
  await finished;
  clearTimeout(forced);
  children.delete(child);
}
async function check(title: string, action: () => Promise<void>) {
  currentTest = title;
  await action();
  outcomes.push(title);
  console.log(`PASS ${title}`);
}

try {
  await controller.query(`CREATE SCHEMA ${schema}`);
  for (const key of ['DATABASE_URL', 'POSTGRES_URL', 'PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'PGPORT', 'PGOPTIONS', 'PGSERVICE', 'PGSERVICEFILE']) delete process.env[key];
  process.env.DATABASE_URL = controllerUrl.href;
  process.env.DATABASE_SSL = 'false';
  process.env.NODE_ENV = 'test';
  process.env.SGMO_AUTH_MODE = 'central';
  const { runMigrations } = await import('../../src/server/db/migrator');
  const { userRepository } = await import('../../src/server/db/repositories/UserRepository');
  const { getDbPool } = await import('../../src/server/db/connection');
  applicationPool = getDbPool();
  assert.equal((await runMigrations()).success, true);
  await userRepository.create({ id: 'HTTP-WORKER', userCode: 'HTTP-WORKER', name: 'Trabajador HTTP efímero',
    phone: '', role: 'seller', commissionRate: 0.2, isActive: true, pin: workerPin });
  for (const id of ['HTTP-ADMIN-A', 'HTTP-ADMIN-B']) {
    await userRepository.create({ id, userCode: id, name: 'Admin HTTP efímero', phone: '', role: 'admin', commissionRate: 0.2, isActive: true });
  }
  await new Promise<void>((resolveListening, reject) => {
    proxy.once('error', reject); proxy.listen(0, '127.0.0.1', resolveListening);
  });
  let first = await startWorker();
  const second = await startWorker();
  const clients = [new BrowserClient(), new BrowserClient()];
  await Promise.all([clients[0].initialize(first.origin), clients[1].initialize(second.origin)]);
  let winningAdmin = 0;
  await check('Dos procesos: bootstrap competitivo permite exactamente un administrador inicial', async () => {
    const results = await Promise.all(clients.map((client, index) => client.request(index === 0 ? first.origin : second.origin,
      '/api/auth/bootstrap-admin', { identifier: index === 0 ? 'HTTP-ADMIN-A' : 'HTTP-ADMIN-B', newPassword: adminPasswords[index], bootstrapSecret: sharedSecret })));
    assert.equal(results.filter((result) => result.status === 200).length, 1);
    assert.equal(results.filter((result) => result.status === 403).length, 1);
    winningAdmin = results.findIndex((result) => result.status === 200);
  });
  const admin = new BrowserClient();
  await admin.initialize(first.origin);
  const adminIdentity = { identifier: winningAdmin === 0 ? 'HTTP-ADMIN-A' : 'HTTP-ADMIN-B', password: adminPasswords[winningAdmin] };
  assert.equal((await admin.request(first.origin, '/api/auth/login', adminIdentity)).status, 200);

  await check('Dos procesos: cinco fallos concurrentes bloquean también el PIN correcto', async () => {
    const requests = Array.from({ length: 5 }, (_, index) => clients[index % 2].request(index % 2 ? second.origin : first.origin,
      '/api/auth/login', { ...workerIdentity, pin: wrongPin }));
    const results = await Promise.all(requests);
    assert.ok(results.every((result) => result.status === 401));
    const stored = (await controller.query('SELECT failed_attempts, locked_until FROM users WHERE id = $1', ['HTTP-WORKER'])).rows[0];
    assert.equal(stored.failed_attempts, 5);
    assert.ok(stored.locked_until);
    assert.equal((await clients[1].request(second.origin, '/api/auth/login', workerIdentity)).status, 429);
    await controller.query("UPDATE users SET locked_until = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE id = $1", ['HTTP-WORKER']);
    assert.equal((await clients[0].request(first.origin, '/api/auth/login', workerIdentity)).status, 200);
  });

  await check('Sesión HttpOnly central cruza procesos y sobrevive reinicio del backend', async () => {
    assert.equal((await clients[0].request(second.origin, '/api/auth/me')).status, 200);
    await stopWorker(first.process);
    first = await startWorker();
    assert.equal((await clients[0].request(first.origin, '/api/auth/me')).status, 200);
  });

  await check('Reset y login competitivo: ninguna sesión de PIN previo queda utilizable', async () => {
    const replacementPin = pin();
    const results = await Promise.all([
      clients[0].request(first.origin, '/api/auth/login', workerIdentity),
      admin.request(second.origin, '/api/users/HTTP-WORKER', { pin: replacementPin }, 'PUT')
    ]);
    assert.ok([200, 401].includes(results[0].status));
    assert.equal(results[1].status, 200);
    assert.equal((await clients[0].request(first.origin, '/api/auth/me')).status, 401);
    assert.equal((await clients[1].request(second.origin, '/api/auth/login', workerIdentity)).status, 401);
    workerIdentity.pin = replacementPin;
    assert.equal((await clients[0].request(first.origin, '/api/auth/login', workerIdentity)).status, 200);
  });

  await check('Inactividad central revoca acceso en ambas instancias', async () => {
    assert.equal((await admin.request(second.origin, '/api/users/HTTP-WORKER', { isActive: false }, 'PUT')).status, 200);
    assert.equal((await clients[0].request(first.origin, '/api/auth/me')).status, 401);
    assert.equal((await clients[0].request(second.origin, '/api/auth/me')).status, 401);
    assert.equal((await clients[1].request(second.origin, '/api/auth/login', workerIdentity)).status, 401);
    assert.equal((await admin.request(second.origin, '/api/users/HTTP-WORKER', { isActive: true }, 'PUT')).status, 200);
    assert.equal((await clients[0].request(first.origin, '/api/auth/login', workerIdentity)).status, 200);
  });

  await check('Corte TCP real: login, sesión y logout fallan cerrados sin memoria alternativa', async () => {
    transportAvailable = false;
    for (const socket of sockets) socket.destroy();
    assert.equal((await clients[0].request(first.origin, '/api/auth/me')).status, 503);
    assert.equal((await clients[1].request(second.origin, '/api/auth/login', workerIdentity)).status, 503);
    assert.equal((await clients[0].request(first.origin, '/api/auth/logout', {})).status, 503);
    assert.equal((await admin.request(second.origin, '/api/auth/password-activations', {
      userId: 'HTTP-WORKER', currentPassword: adminIdentity.password, identityConfirmed: true })).status, 503);
    assert.equal((await clients[0].request(first.origin, '/api/auth/change-password', {
      currentCredential: workerIdentity.pin, newPassword: adminPasswords[0], confirmPassword: adminPasswords[0] })).status, 503);
    assert.equal((await clients[1].request(second.origin, '/api/auth/complete-password-activation', {
      token: randomBytes(32).toString('hex'), newPassword: adminPasswords[0], confirmPassword: adminPasswords[0] })).status, 503);
    transportAvailable = true;
    assert.equal((await clients[0].request(second.origin, '/api/auth/me')).status, 200);
    assert.equal((await clients[0].request(second.origin, '/api/auth/logout', {})).status, 200);
    assert.equal((await clients[0].request(first.origin, '/api/auth/me')).status, 401);
  });

  await check('Contraseña personal: recuperación requiere admin reautenticado y confirmación de identidad', async () => {
    assert.equal((await admin.request(first.origin, '/api/users', { id: 'HTTP-PASSWORD', userCode: 'HTTP-PASSWORD',
      name: 'Contraseña HTTP efímera', role: 'seller', commissionRate: 0, isActive: true })).status, 201);
    assert.equal((await admin.request(first.origin, '/api/auth/password-activations', {
      userId: 'HTTP-PASSWORD', currentPassword: adminIdentity.password, identityConfirmed: false })).status, 400);
    assert.equal((await admin.request(first.origin, '/api/auth/password-activations', {
      userId: 'HTTP-PASSWORD', currentPassword: password(), identityConfirmed: true })).status, 401);
    assert.equal((await controller.query('SELECT failed_attempts FROM users WHERE id=$1', [adminIdentity.identifier])).rows[0].failed_attempts, 1);
  });
  let personalPassword = password().slice(0, 12);
  secrets.push(personalPassword);
  await check('Dos procesos compiten por un código: exactamente un consumo, sin sesión automática', async () => {
    const issued = await admin.request(first.origin, '/api/auth/password-activations', {
      userId: 'HTTP-PASSWORD', currentPassword: adminIdentity.password, identityConfirmed: true });
    assert.equal(issued.status, 200);
    const token = issued.body.activation.token; secrets.push(token);
    const results = await Promise.all(clients.map((client, index) => client.request(index ? second.origin : first.origin,
      '/api/auth/complete-password-activation', { token, newPassword: personalPassword, confirmPassword: personalPassword })));
    assert.equal(results.filter(result => result.status === 200).length, 1);
    assert.equal(results.filter(result => result.status === 400).length, 1);
    for (const client of clients) assert.equal((await client.request(first.origin, '/api/auth/me')).status, 401);
    for (const client of clients) assert.equal((await client.request(first.origin, '/api/auth/login', {
      identifier: 'HTTP-PASSWORD', password: personalPassword })).status, 200);
    assert.equal((await clients[0].request(second.origin, '/api/users')).status, 403);
    assert.equal((await clients[0].request(second.origin, '/api/auth/password-activations', {
      userId: 'HTTP-PASSWORD', currentPassword: personalPassword, identityConfirmed: true })).status, 403);
  });
  await check('Cambio propio y login competitivo: ninguna sesión previa queda utilizable entre procesos', async () => {
    const replacement = password().slice(0, 12); secrets.push(replacement);
    const results = await Promise.all([
      clients[0].request(first.origin, '/api/auth/login', { identifier: 'HTTP-PASSWORD', password: personalPassword }),
      clients[1].request(second.origin, '/api/auth/change-password', {
        currentCredential: personalPassword, newPassword: replacement, confirmPassword: replacement })
    ]);
    assert.ok([200, 401].includes(results[0].status)); assert.equal(results[1].status, 200);
    for (const client of clients) assert.equal((await client.request(first.origin, '/api/auth/me')).status, 401);
    assert.equal((await clients[0].request(first.origin, '/api/auth/login', { identifier: 'HTTP-PASSWORD', password: personalPassword })).status, 401);
    personalPassword = replacement;
    assert.equal((await clients[0].request(second.origin, '/api/auth/login', { identifier: 'HTTP-PASSWORD', password: personalPassword })).status, 200);
  });
  console.log(`RESULTADO: ${outcomes.length} grupos PostgreSQL HTTP multiproceso aprobados.`);
} catch (error) {
  console.error(`FAIL ${currentTest}; ${error instanceof Error ? error.name : 'Error'}.`);
  process.exitCode = 1;
} finally {
  transportAvailable = true;
  await Promise.all([...children].map(stopWorker));
  for (const socket of sockets) socket.destroy();
  if (proxy.listening) await new Promise<void>((done) => proxy.close(() => done()));
  if (applicationPool) await applicationPool.end();
  try { await controller.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
  catch { process.exitCode = 1; console.error('No se pudo limpiar el esquema HTTP efímero.'); }
  await controller.end();
  if (process.env.SGMO_TEST_REPORT_DIR) {
    await mkdir(process.env.SGMO_TEST_REPORT_DIR, { recursive: true });
    const report = JSON.stringify({ mode: 'postgres-local-two-http-processes', checks: outcomes,
      failedTest: process.exitCode ? currentTest : null, networkFault: 'local TCP proxy interrupted; PostgreSQL server was not stopped' }, null, 2);
    assert.ok(secrets.every((secret) => !report.includes(secret)), 'Informe contiene un secreto.');
    await writeFile(resolve(process.env.SGMO_TEST_REPORT_DIR, 'postgres-multiprocess.json'), report);
  }
}
