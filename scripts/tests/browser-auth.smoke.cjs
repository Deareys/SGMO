/**
 * QA opcional en navegador real: usa Chromium Playwright y servidores loopback
 * aislados, sin base de datos ni cuentas/sesiones del usuario. No imprime claves.
 * Requiere npm run build y Playwright + Chromium instalados externamente.
 */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomInt, randomBytes } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
require('tsx/cjs');
const { validateWorkerPin } = require('../../src/server/auth/cryptoUtils.ts');
const runtimeSearchPaths = [process.env.SGMO_PLAYWRIGHT_MODULES, process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES].filter(Boolean);
const { chromium } = require(require.resolve('playwright', { paths: runtimeSearchPaths.length ? runtimeSearchPaths : [process.cwd()] }));

const repositoryRoot = path.resolve(__dirname, '../..');
const port = Number(process.env.SGMO_BROWSER_QA_PORT || '3102');
assert.ok(Number.isInteger(port) && port > 0 && port <= 65535, 'Puerto QA inválido');
const origin = `http://127.0.0.1:${port}`;
const workerPin = generatePin();
const factoryPin = generatePin();
const administratorPassword = `${randomBytes(20).toString('hex')}Qa!9`;
const secretValues = [workerPin, factoryPin, administratorPassword];
const checks = [];
let serverProcess;
let browser;
let serverOutput = '';

function generatePin() {
  let candidate;
  do { candidate = randomInt(0, 100_000_000).toString().padStart(8, '0'); }
  while (!validateWorkerPin(candidate).isValid);
  return candidate;
}

function redact(message) {
  return secretValues.reduce((text, secret) => text.replaceAll(secret, '[REDACTED]'), String(message));
}

function isolatedEnvironment(mode) {
  return {
    ...process.env,
    NODE_ENV: mode === 'demo' ? 'development' : 'production',
    SGMO_AUTH_MODE: 'demo', // Producción debe rechazarlo aun con esta selección.
    SGMO_DEMO_ADMIN_PASSWORD: administratorPassword,
    SGMO_DEMO_SELLER_PIN: workerPin,
    SGMO_DEMO_FACTORY_PIN: factoryPin,
    DATABASE_URL: '', POSTGRES_URL: '', PGHOST: '', PGDATABASE: '', PGUSER: '',
    PGPASSWORD: '', PGPORT: '', DATABASE_SSL: '', GEMINI_API_KEY: '',
    MERCADOPAGO_ACCESS_TOKEN: '', MP_ACCESS_TOKEN: '', BOOTSTRAP_SECRET: '',
    PORT: String(port), SGMO_ENABLE_API_TOKENS: '',
    SGMO_PUBLIC_ORIGIN: mode === 'demo' ? origin : 'https://sgmo-qa.example.invalid',
    DISABLE_HMR: 'true'
  };
}

async function startServer(mode) {
  // No reutilizar ni automatizar un servidor o sesión existente.
  try {
    await fetch(`${origin}/api/db/status`, { signal: AbortSignal.timeout(500) });
    throw new Error(`El puerto QA ${port} ya está ocupado; detené ese proceso antes de ejecutar QA aislada.`);
  } catch (error) {
    if (error.message.includes('ocupado')) throw error;
  }
  serverOutput = '';
  serverProcess = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: repositoryRoot, env: isolatedEnvironment(mode), stdio: ['ignore', 'pipe', 'pipe']
  });
  serverProcess.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  serverProcess.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (serverProcess.exitCode !== null) throw new Error(`Servidor QA terminó: ${redact(serverOutput)}`);
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Servidor QA no respondió a tiempo.');
}

async function stopServer() {
  if (!serverProcess || serverProcess.exitCode !== null) return;
  const child = serverProcess;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGTERM');
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
  if (child.exitCode === null) child.kill('SIGKILL');
  serverProcess = undefined;
}

async function assertEventually(assertion) {
  let lastFailure;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await assertion(); return; } catch (error) { lastFailure = error; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastFailure;
}

async function assertValue(locator, expected) {
  await assertEventually(async () => assert.equal(await locator.inputValue(), expected));
}

async function assertVisible(locator) {
  await locator.waitFor({ state: 'visible' });
}

async function pressPin(page, credential) {
  await page.getByLabel('PIN o contraseña', { exact:true }).fill('');
  const keyboard=page.locator('details');
  if (!await keyboard.evaluate(element=>element.open)) await keyboard.locator('summary').click();
  for (const digit of credential) await page.getByRole('button', { name: digit, exact: true }).click();
  await page.getByRole('button', { name:'Ingresar',exact:true }).click();
}

async function currentUserId(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('SGMO_TEQUENOS_COSTA_V2')).currentUser?.id ?? null);
}

async function waitForIdentity(page, userId) {
  await page.waitForFunction((expected) =>
    JSON.parse(localStorage.getItem('SGMO_TEQUENOS_COSTA_V2')).currentUser?.id === expected, userId);
}

async function assertNoLocalCredentials(page) {
  const cachedEntries = await page.evaluate(() => Object.values(localStorage));
  for (const entry of cachedEntries) for (const credential of secretValues) {
    assert.equal(entry.includes(credential), false, 'Credencial apareció en caché local');
  }
  assert.equal(await page.evaluate(() => localStorage.getItem('SGMO_AUTH_TOKEN')), null);
}

async function navigateToConfiguration(page) {
  await page.getByTitle('Abrir menú de navegación').click();
  await page.getByRole('button', { name: 'Configuración', exact: true }).click();
  await page.getByRole('button', { name: /^Usuarios & Roles/ }).click();
}

async function main() {
  const outputDirectory = process.env.SGMO_BROWSER_QA_DIR
    ? path.resolve(process.env.SGMO_BROWSER_QA_DIR)
    : await fs.mkdtemp(path.join(os.tmpdir(), 'sgmo-browser-auth-'));
  await fs.mkdir(outputDirectory, { recursive: true });
  browser = await chromium.launch({ headless: true });
  await startServer('demo');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(redact(error.message)));
  await page.goto(origin, { waitUntil: 'networkidle' });

  await assertValue(page.getByLabel('Código de usuario o correo'), '');
  assert.equal(await page.locator('select').count(), 0);
  await assertVisible(page.getByText('Teclado numérico para PIN', { exact: true }));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
    'Acceso móvil desborda horizontalmente');
  await page.screenshot({ path: path.join(outputDirectory, 'login-mobile-390x844.png'), fullPage: true });
  checks.push('Acceso móvil: identificador vacío, sin perfiles públicos, teclado desplegable y sin desborde horizontal');

  let loginRequests = 0;
  page.on('request', (request) => { if (request.url().endsWith('/api/auth/login')) loginRequests++; });
  await page.getByLabel('Código de usuario o correo').pressSequentially('VEND-01');
  assert.equal(loginRequests, 0, 'Escribir userCode no debe ingresar dígitos al PIN');
  let incorrectPin = factoryPin;
  while (incorrectPin === workerPin) incorrectPin = generatePin();
  await pressPin(page, incorrectPin);
  await assertVisible(page.locator('.bg-rose-50').first());
  assert.equal(await currentUserId(page), null);
  checks.push('PIN incorrecto rechazado; escribir código no alimenta el PIN');
  await pressPin(page, workerPin);
  await waitForIdentity(page, 'USR-VEND-1');
  await assertNoLocalCredentials(page);
  const cookies = await context.cookies();
  assert.equal(cookies.find((cookie) => cookie.name === 'sgmo-session')?.httpOnly, true);
  assert.equal(cookies.find((cookie) => cookie.name === 'sgmo-session')?.sameSite, 'Strict');
  assert.equal(await page.evaluate(() => document.cookie.includes('sgmo-session')), false);
  await page.reload({ waitUntil: 'networkidle' });
  await waitForIdentity(page, 'USR-VEND-1');
  await assertNoLocalCredentials(page);
  checks.push('Login trabajador: cookie HttpOnly/Strict, sin token local, sesión restaurada al recargar');
  const missingCsrf = await context.request.post(`${origin}/api/auth/logout`, {
    data: {}, headers: { Origin: origin }
  });
  assert.equal(missingCsrf.status(), 403);
  const csrf = await (await context.request.get(`${origin}/api/auth/csrf`)).json();
  const foreignOrigin = await context.request.post(`${origin}/api/auth/logout`, {
    data: {}, headers: { Origin: 'https://untrusted.example.invalid', 'X-CSRF-Token': csrf.csrfToken }
  });
  assert.equal(foreignOrigin.status(), 403);
  assert.equal((await context.request.get(`${origin}/api/auth/me`)).status(), 200);
  checks.push('CSRF ausente y origen externo rechazados sin cerrar una sesión legítima');

  await page.getByTitle('Abrir menú de navegación').click();
  // La pantalla se limpia inmediatamente por seguridad; la revocación es asíncrona.
  const logoutResponse = page.waitForResponse((response) => response.url() === `${origin}/api/auth/logout`
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Cerrar Sesión', exact: true }).click();
  const revoked = await logoutResponse;
  assert.equal(revoked.status(), 200);
  await revoked.finished();
  await assertVisible(page.getByLabel('Código de usuario o correo'));
  assert.equal(await page.evaluate(() => localStorage.getItem('SGMO_AUTH_TOKEN')), null);
  await assertEventually(async () => assert.equal((await context.cookies()).some((cookie) => cookie.name === 'sgmo-session'), false));
  assert.equal((await context.request.get(`${origin}/api/auth/me`)).status(), 401);
  await assertValue(page.locator('input[type="text"]'), '');
  await assertValue(page.locator('input[type="password"]'), '');
  await page.screenshot({ path: path.join(outputDirectory, 'login-admin-mobile-blank.png'), fullPage: true });
  await page.locator('input[type="text"]').fill('ADM-01');
  await page.locator('input[type="password"]').fill(administratorPassword);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await waitForIdentity(page, 'USR-ADMIN-1');
  await assertNoLocalCredentials(page);
  checks.push('Logout elimina token; admin sin preselección y login correcto central');

  await navigateToConfiguration(page);
  const usersBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('SGMO_TEQUENOS_COSTA_V2')).users);
  await page.getByRole('button', { name: 'Nuevo Usuario', exact: true }).click();
  const newUserForm = page.locator('form').filter({ has: page.getByPlaceholder('Ej: VEND-05') });
  await newUserForm.getByPlaceholder('Ej: Marcos Benavídez').fill('QA usuario temporal');
  await newUserForm.getByPlaceholder('Ej: VEND-05').fill('QA-TEMP');
  await newUserForm.locator('input[type="email"]').fill('qa@example.invalid');
  await newUserForm.locator('input[type="tel"]').fill('000000000');
  assert.equal(await newUserForm.locator('input[type="password"]').count(), 0, 'Cada usuario elige su contraseña fuera del alta administrativa');
  await newUserForm.getByRole('button', { name: 'Guardar Usuario', exact: true }).click();
  await assertVisible(newUserForm.getByRole('alert'));
  await assertEventually(async () => assert.equal(await newUserForm.getByRole('button', { name: 'Guardar Usuario', exact: true }).isEnabled(), true));
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('SGMO_TEQUENOS_COSTA_V2')).users), usersBefore);
  await assertNoLocalCredentials(page);
  checks.push('Alta contra DB no configurada: 503 visible, modal y perfiles conservados, sin falso éxito');
  await newUserForm.getByRole('button', { name: 'Cancelar', exact: true }).click();

  await page.getByRole('button', { name: 'Editar Usuario', exact: true }).nth(1).click();
  const editUserForm = page.locator('form').filter({ has: page.getByPlaceholder('Ej: VEND-05') });
  assert.equal(await editUserForm.locator('input[type="password"]').count(), 0);
  let updateRequestBody;
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().includes('/api/users/')) updateRequestBody = request.postDataJSON();
  });
  await editUserForm.getByPlaceholder('Ej: Marcos Benavídez').fill('QA cambio rechazado');
  await editUserForm.getByRole('button', { name: 'Guardar Usuario', exact: true }).click();
  await assertVisible(editUserForm.getByRole('alert'));
  assert.equal(Object.hasOwn(updateRequestBody, 'pin'), false);
  assert.equal(Object.hasOwn(updateRequestBody, 'password'), false);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('SGMO_TEQUENOS_COSTA_V2')).users), usersBefore);
  checks.push('Edición 503 mantiene modal/perfil; credenciales vacías se omiten del request');

  await context.close();
  await stopServer();
  await startServer('production');
  const productionContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const productionPage = await productionContext.newPage();
  productionPage.on('pageerror', (error) => pageErrors.push(redact(error.message)));
  await productionPage.goto(origin, { waitUntil: 'networkidle' });
  await productionPage.getByLabel('Código de usuario o correo').fill('VEND-01');
  await pressPin(productionPage, workerPin);
  await assertVisible(productionPage.locator('.bg-rose-50').first());
  assert.equal(await currentUserId(productionPage), null);
  await productionPage.locator('input[type="text"]').fill('ADM-01');
  await productionPage.locator('input[type="password"]').fill(administratorPassword);
  await productionPage.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await assertVisible(productionPage.locator('.bg-rose-50').first());
  assert.equal(await currentUserId(productionPage), null);
  checks.push('Producción sin DB rechaza trabajador/admin demo, aun con SGMO_AUTH_MODE=demo');
  assert.deepEqual(pageErrors, [], 'Errores de ejecución del frontend');
  await productionContext.close();
  await fs.writeFile(path.join(outputDirectory, 'result.json'), JSON.stringify({ checks, pageErrors }, null, 2));
  console.log(`QA navegador aprobada: ${checks.length} escenarios. Evidencia: ${outputDirectory}`);
}

main().catch((error) => {
  console.error(`QA navegador NO completada: ${redact(error.stack || error.message)}`);
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close();
  await stopServer();
});
