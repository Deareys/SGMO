/** Navegador → API real → SQL efímero → segundo navegador.
 * Sin mocks de API, secretos operativos, servicios externos ni cambios en Neon.
 * Requiere npm run build, Playwright/Chromium y PGlite externos al proyecto.
 */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes, randomInt } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
require('tsx/cjs');
const { validateWorkerPin } = require('../../src/server/auth/cryptoUtils.ts');
const runtimePaths = [process.env.SGMO_PLAYWRIGHT_MODULES, process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES].filter(Boolean);
const { chromium } = require(require.resolve('playwright', { paths: runtimePaths.length ? runtimePaths : [process.cwd()] }));
const port = Number(process.env.SGMO_BROWSER_CENTRAL_PORT || '3103');
assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
const origin = `http://127.0.0.1:${port}`;
const administratorPassword = `Qa!${randomBytes(24).toString('hex')}`;
const activationCode = randomBytes(32).toString('hex');
let workerPin;
do { workerPin = String(randomInt(10000000, 100000000)); } while (!validateWorkerPin(workerPin).isValid);
const secrets = [administratorPassword, activationCode, workerPin];
const redact = value => secrets.reduce((result, secret) => result.replaceAll(secret, '[REDACTED]'), String(value));
const checks = [];
const pageErrors = [];
let serverProcess, browser, serverOutput = '';
const outputDirectory = process.env.SGMO_BROWSER_QA_DIR ? path.resolve(process.env.SGMO_BROWSER_QA_DIR) : path.join(os.tmpdir(), `sgmo-browser-central-${Date.now()}`);

async function eventually(assertion) {
  let failure;
  for (let attempt = 0; attempt < 160; attempt++) {
    try { return await assertion(); } catch (error) { failure = error; }
    await new Promise(resolve => setTimeout(resolve, 125));
  }
  throw failure;
}
async function queue(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('SGMO_OFFLINE_SALES_QUEUE') || '[]')); }
async function identity(page, userId) {
  await page.waitForFunction(expected => {
    const state = JSON.parse(localStorage.getItem('SGMO_TEQUENOS_COSTA_V2') || '{}');
    return state.currentUser?.id === expected && state.centralHydrated === true;
  }, userId);
}
async function login(page, identifier, credential) {
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.getByLabel('Código de usuario o correo').fill(identifier);
  await page.getByLabel('PIN o contraseña', { exact: true }).fill(credential);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
}
async function write(context, endpoint, body, method = 'POST') {
  const csrfResponse = await context.request.get(`${origin}/api/auth/csrf`);
  assert.equal(csrfResponse.status(), 200);
  const { csrfToken } = await csrfResponse.json();
  return context.request.fetch(`${origin}${endpoint}`, { method, data: body, headers: { Origin: origin, 'X-CSRF-Token': csrfToken } });
}
async function centralSales(context) {
  const response = await context.request.get(`${origin}/api/sales`);
  assert.equal(response.status(), 200);
  return (await response.json()).sales;
}
async function assertNoLocalSecrets(page) {
  const cached = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  for (const secret of secrets) assert.ok(!cached.includes(secret), 'Credencial privada en caché del navegador');
}
async function register(page) { await page.getByRole('button', { name: /^REGISTRAR \$/ }).click(); }

async function main() {
  assert.ok(process.env.SGMO_PGLITE_ROOT, 'Configurar SGMO_PGLITE_ROOT con runtime efímero externo.');
  await fs.mkdir(outputDirectory, { recursive: true });
  try {
    await fetch(origin, { signal: AbortSignal.timeout(500) });
    throw new Error('El puerto QA está ocupado; no se reutiliza un servidor existente.');
  } catch (error) { if (error.message.includes('ocupado')) throw error; }
  serverProcess = spawn(process.execPath, ['--import', 'tsx', 'scripts/tests/fixtures/browser-central-server.ts'], {
    cwd: path.resolve(__dirname, '../..'), env: { ...process.env, NODE_ENV: 'test', SGMO_BROWSER_CENTRAL_FIXTURE: 'true',
      BOOTSTRAP_SECRET: activationCode, SGMO_PUBLIC_ORIGIN: origin, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe']
  });
  serverProcess.stdout.on('data', chunk => { serverOutput += chunk.toString(); });
  serverProcess.stderr.on('data', chunk => { serverOutput += chunk.toString(); });
  await eventually(async () => {
    assert.equal(serverProcess.exitCode, null, redact(serverOutput));
    assert.ok(serverOutput.includes('SGMO_BROWSER_CENTRAL_READY'), 'Esperando backend SQL efímero');
  });
  browser = await chromium.launch({ headless: true });
  const ownerContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const sellerContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const ownerPage = await ownerContext.newPage();
  const sellerPage = await sellerContext.newPage();
  for (const page of [ownerPage, sellerPage]) page.on('pageerror', error => pageErrors.push(redact(error.message)));

  await ownerPage.goto(`${origin}/setup`, { waitUntil: 'networkidle' });
  await ownerPage.getByLabel('Nombre del dueño').fill('Propietario QA efímero');
  await ownerPage.getByLabel('Correo del dueño').fill('owner-qa@example.invalid');
  await ownerPage.getByLabel('Nueva contraseña', { exact: true }).fill(administratorPassword);
  await ownerPage.getByLabel('Repetir contraseña').fill(`${administratorPassword}Mismatch`);
  await ownerPage.getByLabel('Código privado de activación').fill(activationCode);
  await ownerPage.getByRole('button', { name: 'Activar cuenta del dueño', exact: true }).click();
  await ownerPage.getByRole('alert').filter({ hasText: 'no coinciden' }).waitFor();
  await ownerPage.getByLabel('Repetir contraseña').fill(administratorPassword);
  await ownerPage.getByRole('button', { name: 'Activar cuenta del dueño', exact: true }).click();
  await ownerPage.getByRole('status').filter({ hasText: 'cuenta del dueño está activada' }).waitFor();
  await assertNoLocalSecrets(ownerPage);
  await ownerPage.screenshot({ path: path.join(outputDirectory, 'owner-activation-confirmed.png'), fullPage: true });
  const reopening = await write(ownerContext, '/api/auth/bootstrap-admin', { identifier: 'ADM-01', newPassword: administratorPassword, bootstrapSecret: activationCode });
  assert.equal(reopening.status(), 403);
  checks.push('Alta del dueño en formulario real, identidad/contraseña atómicas y reapertura rechazada');

  await login(ownerPage, 'owner-qa@example.invalid', administratorPassword);
  await identity(ownerPage, 'USR-ADMIN-01');
  const ownerProfile = await (await ownerContext.request.get(`${origin}/api/auth/me`)).json();
  assert.equal(ownerProfile.user.name, 'Propietario QA efímero');
  assert.equal(ownerProfile.user.role, 'admin');
  const created = await write(ownerContext, '/api/users', { id: 'USR-BROWSER-SELLER', userCode: 'QA-VEND',
    name: 'Vendedor QA efímero', role: 'seller', pin: workerPin, commissionRate: 0, housingCostExempt: false, housingCostOverride: 0,
    assignedHouseId: 'HOUSE-NORTE', isActive: true });
  assert.equal(created.status(), 201, 'Alta central del vendedor');
  const dispatched = await write(ownerContext, '/api/shifts', { id: 'SHIFT-BROWSER-QA', houseId: 'HOUSE-NORTE',
    sellerId: 'USR-BROWSER-SELLER', cartId: 'CART-01', zoneId: 'ZONE-QA', zoneName: 'Santa Teresita QA',
    stockItems: ['VAR-CLASICO', 'VAR-AHUMADO', 'VAR-DULCE', 'VAR-CHEDDAR'].map(varietyId => ({ varietyId, deliveredUnits: 30 })),
    suppliesProvided: { gasPercentStart: 100, napkinsDelivered: 100, conesDelivered: 100, saucesProvided: [] } });
  assert.equal(dispatched.status(), 201, 'Despacho central al segundo navegador');
  await login(sellerPage, 'QA-VEND', workerPin);
  await identity(sellerPage, 'USR-BROWSER-SELLER');
  assert.equal((await sellerContext.request.get(`${origin}/api/users`)).status(), 403);
  const ownerCookie = (await ownerContext.cookies()).find(cookie => cookie.name === 'sgmo-session');
  const sellerCookie = (await sellerContext.cookies()).find(cookie => cookie.name === 'sgmo-session');
  assert.ok(ownerCookie?.httpOnly && sellerCookie?.httpOnly);
  assert.notEqual(ownerCookie.value, sellerCookie.value);
  checks.push('Dos contextos independientes: dueño y vendedor, cookies HttpOnly distintas, RBAC y despacho compartido');

  await sellerContext.setOffline(true);
  await eventually(async () => assert.equal(await sellerPage.evaluate(() => navigator.onLine), false));
  await register(sellerPage); await register(sellerPage);
  await eventually(async () => assert.equal((await queue(sellerPage)).length, 2));
  const offlineSales = await queue(sellerPage);
  assert.equal(offlineSales.every(sale => sale.isOfflineCreated === true && sale.syncStatus === 'pending'), true);
  assert.equal((await centralSales(ownerContext)).length, 0);
  await sellerPage.screenshot({ path: path.join(outputDirectory, 'seller-offline-two-pending.png'), fullPage: true });
  checks.push('Dos ventas sin señal quedan durables y pendientes; el servidor todavía no las anuncia recibidas');
  await sellerContext.setOffline(false);
  await eventually(async () => assert.equal((await queue(sellerPage)).length, 0));
  await eventually(async () => assert.equal((await centralSales(ownerContext)).length, 2));
  await ownerPage.reload({ waitUntil: 'networkidle' });
  await identity(ownerPage, 'USR-ADMIN-01');
  assert.equal(await ownerPage.evaluate(() => JSON.parse(localStorage.getItem('SGMO_TEQUENOS_COSTA_V2')).sales.length), 2);
  checks.push('Reconexión: dos ACK, cola vacía y las dos ventas visibles en el navegador del dueño');

  let committedWithoutResponse = false;
  const loseResponse = async route => {
    if (committedWithoutResponse) return route.abort('failed');
    const response = await route.fetch();
    assert.equal(response.status(), 200);
    committedWithoutResponse = true;
    await route.abort('failed');
  };
  await sellerPage.route('**/api/sales/sync-batch', loseResponse);
  await register(sellerPage);
  await eventually(async () => assert.ok(committedWithoutResponse));
  await eventually(async () => assert.equal((await centralSales(ownerContext)).length, 3));
  await eventually(async () => assert.equal((await queue(sellerPage)).length, 1));
  await sellerPage.unroute('**/api/sales/sync-batch', loseResponse);
  await sellerPage.getByRole('button', { name: 'Reintentar sincronización', exact: true }).first().click();
  await eventually(async () => assert.equal((await queue(sellerPage)).length, 0));
  assert.equal((await centralSales(ownerContext)).length, 3);
  checks.push('Respuesta perdida después del COMMIT: reintento del mismo UUID confirma sin duplicar la tercera venta');

  await sellerContext.setOffline(true);
  await register(sellerPage);
  await eventually(async () => assert.equal((await queue(sellerPage)).length, 1));
  await sellerPage.close(); // Simula cerrar la pestaña conservando almacenamiento del mismo dispositivo.
  const coldOfflinePage = await sellerContext.newPage();
  const coldOfflineFailure = await coldOfflinePage.goto(origin).then(() => null, error => error);
  assert.ok(coldOfflineFailure, 'La reapertura totalmente sin red necesita un hito PWA/autenticación offline propio.');
  await coldOfflinePage.close();
  checks.push('Límite reproducido: abrir otra pestaña totalmente sin señal no carga la app; el pendiente se conserva');
  await sellerContext.setOffline(false);
  const restoredPage = await sellerContext.newPage();
  restoredPage.on('pageerror', error => pageErrors.push(redact(error.message)));
  await restoredPage.goto(origin, { waitUntil: 'networkidle' });
  await identity(restoredPage, 'USR-BROWSER-SELLER');
  await eventually(async () => assert.equal((await queue(restoredPage)).length, 0));
  await eventually(async () => assert.equal((await centralSales(ownerContext)).length, 4));
  await restoredPage.reload({ waitUntil: 'networkidle' });
  await identity(restoredPage, 'USR-BROWSER-SELLER');
  assert.equal((await centralSales(ownerContext)).length, 4);
  const finalSales = await centralSales(ownerContext);
  assert.equal(new Set(finalSales.map(sale => sale.id)).size, 4);
  assert.equal(finalSales.reduce((amount, sale) => amount + sale.totalAmount, 0), 16000);
  checks.push('Pendiente sobrevive a cerrar pestaña; al abrir con señal recupera sesión, sincroniza y recargar no duplica');
  await assertNoLocalSecrets(restoredPage); await assertNoLocalSecrets(ownerPage);
  await restoredPage.screenshot({ path: path.join(outputDirectory, 'seller-recovered-four-sales.png'), fullPage: true });
  const shiftResponse = await ownerContext.request.get(`${origin}/api/shifts/SHIFT-BROWSER-QA`);
  assert.equal(shiftResponse.status(), 200);
  const { shift } = await shiftResponse.json();
  const closedResponse = await write(ownerContext, '/api/shifts/SHIFT-BROWSER-QA/close', {
    cashDeclared: 0, incentivesOrBonuses: 0,
    returnedItems: shift.stockItems.map(stock => ({ varietyId: stock.varietyId, count: stock.deliveredUnits - stock.soldUnits, wasteCount: 0 }))
  }, 'PUT');
  assert.equal(closedResponse.status(), 200);
  const closed = (await closedResponse.json()).shift;
  assert.equal(closed.housingCostDeduction, 0); assert.equal(closed.commissionRate, 0);
  assert.equal(closed.cashDeclared, 0); assert.equal(closed.cashDifference, -16000);
  await ownerPage.reload({ waitUntil: 'networkidle' }); await identity(ownerPage, 'USR-ADMIN-01');
  await ownerPage.getByTitle('Abrir menú de navegación').click();
  await ownerPage.getByRole('button', { name: 'Cierres & Arqueo', exact: true }).click();
  assert.equal(await ownerPage.getByLabel('Efectivo Entregado en Mano ($)', { exact: true }).inputValue(), '0');
  assert.equal(await ownerPage.getByLabel('Efectivo Entregado en Mano ($)', { exact: true }).isDisabled(), true);
  await ownerPage.getByRole('button', { name: 'Ver Recibo', exact: true }).click();
  const housingRow = ownerPage.getByText('Deducción Vivienda:', { exact: true }).locator('..');
  assert.match(await housingRow.innerText(), /-\$0\b/);
  const declaredRow = ownerPage.getByText('Efectivo Recaudado:', { exact: true }).locator('..');
  assert.match(await declaredRow.innerText(), /Decl: \$0\)/);
  await ownerPage.screenshot({ path: path.join(outputDirectory, 'receipt-zero-housing-zero-cash.png'), fullPage: true });
  checks.push('Cierre SQL y recibo visible conservan vivienda/comisión cero y efectivo declarado cero con diferencia real');
  assert.deepEqual(pageErrors, [], 'Errores JavaScript de la aplicación');
  checks.push('Sin errores JavaScript ni contraseñas/PIN/código privado en localStorage');
  await fs.writeFile(path.join(outputDirectory, 'central-summary.json'), JSON.stringify({ scope: 'Chromium local + API real + SQL WASM efímero; dos contextos, sin teléfonos físicos ni concurrencia PostgreSQL distribuida', checks, passed: checks.length, physicalDevices: false, coldStartOfflineSupported: false, externalProvidersCalled: false, providerPaymentsCreated: 0 }, null, 2));
  console.log(`RESULTADO: ${checks.length}/${checks.length} escenarios de navegador central aprobados.`);
  for (const check of checks) console.log(`PASS ${check}`);
}
main().catch(error => { console.error(redact(error.stack || error)); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  if (serverProcess && serverProcess.exitCode === null) {
    const exited = new Promise(resolve => serverProcess.once('exit', resolve));
    serverProcess.kill('SIGTERM');
    await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 3000))]);
    if (serverProcess.exitCode === null) serverProcess.kill('SIGKILL');
  }
});
