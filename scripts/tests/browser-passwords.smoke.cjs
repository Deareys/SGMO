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
const port = Number(process.env.SGMO_BROWSER_PASSWORD_PORT || '3104');
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
const outputDirectory = process.env.SGMO_BROWSER_QA_DIR ? path.resolve(process.env.SGMO_BROWSER_QA_DIR) : path.join(os.tmpdir(), `sgmo-browser-password-${Date.now()}`);

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
  await page.getByLabel('Contraseña', { exact: true }).fill(credential);
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
  assert.ok(process.env.SGMO_PGLITE_ROOT, 'Falta el runtime SQL efímero.');
  await fs.mkdir(outputDirectory, { recursive: true });
  try { await fetch(origin, { signal: AbortSignal.timeout(500) }); throw new Error('Puerto QA ocupado'); }
  catch (error) { if (error.message.includes('ocupado')) throw error; }
  serverProcess = spawn(process.execPath, ['--import', 'tsx', 'scripts/tests/fixtures/browser-central-server.ts'], {
    cwd: path.resolve(__dirname, '../..'), env: { ...process.env, NODE_ENV: 'test', SGMO_BROWSER_CENTRAL_FIXTURE: 'true',
      BOOTSTRAP_SECRET: activationCode, SGMO_PUBLIC_ORIGIN: origin, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe']
  });
  serverProcess.stdout.on('data', chunk => { serverOutput += chunk.toString(); });
  serverProcess.stderr.on('data', chunk => { serverOutput += chunk.toString(); });
  await eventually(async () => {
    assert.equal(serverProcess.exitCode, null, redact(serverOutput));
    assert.ok(serverOutput.includes('SGMO_BROWSER_CENTRAL_READY'));
  });
  browser = await chromium.launch({ headless: true });
  const owner = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const worker = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const otherDevice = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const ownerPage = await owner.newPage(), workerPage = await worker.newPage(), otherPage = await otherDevice.newPage();
  for (const page of [ownerPage, workerPage, otherPage]) page.on('pageerror', error => pageErrors.push(redact(error.message)));
  assert.equal((await write(owner, '/api/auth/bootstrap-admin', { identifier: 'ADM-01', newPassword: administratorPassword, bootstrapSecret: activationCode })).status(), 200);
  await login(ownerPage, 'ADM-01', administratorPassword); await identity(ownerPage, 'USR-ADMIN-01');
  await ownerPage.getByTitle('Abrir menú de navegación').click();
  await ownerPage.getByRole('button', { name: 'Configuración', exact: true }).click();
  await ownerPage.getByRole('button', { name: /Usuarios & Roles/ }).click();
  await ownerPage.getByRole('button', { name: 'Nuevo Usuario', exact: true }).click();
  const form = ownerPage.locator('form').filter({ has: ownerPage.getByPlaceholder('Ej: VEND-05') });
  const initialPassword = randomBytes(6).toString('hex'); secrets.push(initialPassword);
  await form.getByLabel('Contraseña inicial', { exact: true }).fill(initialPassword);
  await form.getByLabel('Repetir contraseña', { exact: true }).fill(initialPassword);
  await form.getByPlaceholder('Ej: Marcos Benavídez').fill('Persona QA contraseña');
  await form.getByPlaceholder('Ej: VEND-05').fill('QA-PERSONAL');
  await form.locator('input[type=email]').fill('personal-qa@example.invalid');
  await form.locator('input[type=tel]').fill('000000000');
  await form.locator('select').nth(0).selectOption('seller');
  await form.locator('select').nth(1).selectOption('HOUSE-NORTE');
  const saved = ownerPage.waitForResponse(response => response.url() === `${origin}/api/users` && response.request().method() === 'POST');
  await form.getByRole('button', { name: 'Guardar Usuario', exact: true }).click();
  const response = await saved; assert.equal(response.status(), 201);
  const userId = (await response.json()).user.id;
  checks.push('Alta real por administrador con contraseña inicial, seguida de elección privada por enlace');

  // Reproduce el reporte: guardar, salir de administración y entrar a esa cuenta.
  await otherPage.goto(origin, { waitUntil: 'networkidle' });
  assert.equal(await otherPage.locator('input').count(), 2);
  assert.equal(await otherPage.locator('select,details,a').count(), 0);
  await login(otherPage, 'personal-qa@example.invalid', initialPassword); await identity(otherPage, userId);
  await otherPage.reload({ waitUntil: 'networkidle' }); await identity(otherPage, userId);
  await ownerPage.reload({ waitUntil: 'networkidle' }); await identity(ownerPage, 'USR-ADMIN-01');
  async function openUsers() {
    await ownerPage.getByTitle('Abrir menú de navegación').click();
    await ownerPage.getByRole('button', { name: 'Configuración', exact: true }).click();
    await ownerPage.getByRole('button', { name: /Usuarios & Roles/ }).click();
  }
  const userCard = name => ownerPage.locator('div.border.rounded-xl.p-5').filter({ has: ownerPage.getByText(name, { exact: true }) });
  await openUsers();
  assert.equal(await userCard('Persona QA contraseña').count(), 1);
  assert.equal((await write(owner, '/api/auth/logout', {})).status(), 200);
  await ownerPage.reload({ waitUntil: 'networkidle' });
  await ownerPage.getByLabel('Código de usuario o correo').waitFor();
  await login(ownerPage, 'ADM-01', administratorPassword); await identity(ownerPage, 'USR-ADMIN-01'); await openUsers();
  assert.equal(await userCard('Persona QA contraseña').count(), 1);
  checks.push('Usuario guardado sobrevive recarga y logout del administrador; otro navegador ingresa con la contraseña inicial sin selector de perfiles');

  const editedPassword = randomBytes(6).toString('hex'); secrets.push(editedPassword);
  await userCard('Persona QA contraseña').getByRole('button', { name: 'Editar Usuario', exact: true }).click();
  const edit = ownerPage.locator('form').filter({ has: ownerPage.getByPlaceholder('Ej: VEND-05') });
  await edit.getByPlaceholder('Ej: Marcos Benavídez').fill('Persona QA editada');
  await edit.locator('input[type=email]').fill('editada-qa@example.invalid');
  await edit.getByLabel('Nueva contraseña', { exact: true }).fill(editedPassword);
  await edit.getByLabel('Repetir contraseña', { exact: true }).fill(editedPassword);
  const updated = ownerPage.waitForResponse(reply => reply.url() === `${origin}/api/users/${userId}` && reply.request().method() === 'PUT');
  await edit.getByRole('button', { name: 'Guardar Usuario', exact: true }).click();
  assert.equal((await updated).status(), 200);
  assert.equal((await otherDevice.request.get(`${origin}/api/auth/me`)).status(), 401);
  assert.equal((await write(otherDevice, '/api/auth/login', { identifier: 'QA-PERSONAL', password: initialPassword })).status(), 401);
  await login(otherPage, 'editada-qa@example.invalid', editedPassword); await identity(otherPage, userId);
  const me = await (await otherDevice.request.get(`${origin}/api/auth/me`)).json();
  assert.equal(me.user.name, 'Persona QA editada');
  await userCard('Persona QA editada').getByRole('button', { name: 'Editar Usuario', exact: true }).click();
  const keepPassword = ownerPage.locator('form').filter({ has: ownerPage.getByPlaceholder('Ej: VEND-05') });
  assert.equal(await keepPassword.getByLabel('Nueva contraseña', { exact: true }).inputValue(), '');
  await keepPassword.getByPlaceholder('Ej: Marcos Benavídez').fill('Persona QA contraseña');
  await keepPassword.locator('input[type=email]').fill('personal-qa@example.invalid');
  const kept = ownerPage.waitForResponse(reply => reply.url() === `${origin}/api/users/${userId}` && reply.request().method() === 'PUT');
  await keepPassword.getByRole('button', { name: 'Guardar Usuario', exact: true }).click();
  assert.equal((await kept).status(), 200);
  assert.equal((await write(otherDevice, '/api/auth/logout', {})).status(), 200);
  await otherPage.reload({ waitUntil: 'networkidle' });
  await login(otherPage, 'QA-PERSONAL', editedPassword); await identity(otherPage, userId);
  assert.equal((await write(otherDevice, '/api/auth/logout', {})).status(), 200);
  await otherPage.reload({ waitUntil: 'networkidle' });
  checks.push('Editar identidad y contraseña persiste y revoca la sesión previa; editar con clave vacía conserva el acceso');

  await ownerPage.getByRole('button', { name: 'Nuevo Usuario', exact: true }).click();
  const duplicate = ownerPage.locator('form').filter({ has: ownerPage.getByPlaceholder('Ej: VEND-05') });
  await duplicate.getByPlaceholder('Ej: Marcos Benavídez').fill('Duplicado rechazado');
  await duplicate.getByPlaceholder('Ej: VEND-05').fill('QA-DUPLICADO');
  await duplicate.locator('input[type=email]').fill('PERSONAL-QA@EXAMPLE.INVALID');
  await duplicate.getByLabel('Contraseña inicial', { exact: true }).fill(initialPassword);
  await duplicate.getByLabel('Repetir contraseña', { exact: true }).fill(initialPassword);
  await duplicate.getByRole('button', { name: 'Guardar Usuario', exact: true }).click();
  await duplicate.getByRole('alert').filter({ hasText: 'correo ya está asignado' }).waitFor();
  await duplicate.getByRole('button', { name: 'Cancelar', exact: true }).click();
  assert.equal((await (await owner.request.get(`${origin}/api/users`)).json()).users.filter(account => account.userCode === 'QA-DUPLICADO').length, 0);
  checks.push('Correo duplicado muestra error y no agrega un perfil local inexistente');

  async function issueLink() {
    await ownerPage.getByRole('button', { name: 'Activar o restablecer contraseña de Persona QA contraseña', exact: true }).click();
    const dialog = ownerPage.getByRole('dialog', { name: 'Activar o restablecer contraseña', exact: true });
    await dialog.getByLabel('Verifiqué presencialmente la identidad de esta persona.').check();
    await dialog.getByLabel('Tu contraseña de administrador').fill(administratorPassword);
    await dialog.getByRole('button', { name: 'Generar enlace de un solo uso', exact: true }).click();
    await dialog.getByRole('status').waitFor();
    const link = await dialog.getByLabel('Enlace privado de activación').inputValue();
    secrets.push(link, new URLSearchParams(new URL(link).hash.slice(1)).get('token'));
    await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
    return link;
  }
  const link = await issueLink();
  const selected = randomBytes(6).toString('hex'), changed = randomBytes(6).toString('hex'), recovered = randomBytes(6).toString('hex');
  secrets.push(selected, changed, recovered);
  await workerPage.goto(link, { waitUntil: 'networkidle' });
  assert.equal(new URL(workerPage.url()).hash, '');
  await workerPage.getByLabel('Nueva contraseña', { exact: true }).fill(selected);
  await workerPage.getByLabel('Repetir contraseña').fill(changed);
  await workerPage.getByRole('button', { name: 'Guardar mi contraseña', exact: true }).click();
  await workerPage.getByRole('alert').filter({ hasText: 'no coinciden' }).waitFor();
  await workerPage.getByLabel('Repetir contraseña').fill(selected);
  await workerPage.getByRole('button', { name: 'Guardar mi contraseña', exact: true }).click();
  await workerPage.getByRole('status').filter({ hasText: 'contraseña quedó guardada' }).waitFor();
  assert.equal((await worker.request.get(`${origin}/api/auth/me`)).status(), 401, 'Un código no autentica');
  await assertNoLocalSecrets(workerPage);
  await workerPage.screenshot({ path: path.join(outputDirectory, 'password-selected-mobile.png'), fullPage: true });
  checks.push('Elección privada de 12 caracteres desde teléfono simulado, confirmación y enlace retirado de la URL; sin login automático');

  await login(workerPage, 'personal-qa@example.invalid', selected); await identity(workerPage, userId);
  await login(otherPage, 'QA-PERSONAL', selected); await identity(otherPage, userId);
  assert.equal((await worker.request.get(`${origin}/api/users`)).status(), 403);
  assert.equal((await write(worker, '/api/auth/password-activations', { userId, currentPassword: selected, identityConfirmed: true })).status(), 403);
  checks.push('Correo o código con contraseña propia; dos sesiones independientes y permisos del vendedor aplicados por API');

  assert.equal((await write(owner, '/api/shifts', { id: 'SHIFT-PASSWORD-QA', houseId: 'HOUSE-NORTE', sellerId: userId,
    cartId: 'CART-01', zoneId: 'ZONE-QA', zoneName: 'Ensayo contraseña',
    stockItems: ['VAR-CLASICO','VAR-AHUMADO','VAR-DULCE','VAR-CHEDDAR'].map(varietyId => ({ varietyId, deliveredUnits: 30 })),
    suppliesProvided: { gasPercentStart: 100, napkinsDelivered: 100, conesDelivered: 100, saucesProvided: [] } })).status(), 201);
  await workerPage.reload({ waitUntil: 'networkidle' }); await identity(workerPage, userId);
  const hold = route => route.abort('failed');
  await workerPage.route('**/api/sales/sync-batch', hold);
  await worker.setOffline(true); await register(workerPage);
  await eventually(async () => assert.equal((await queue(workerPage)).length, 1));
  const pendingId = (await queue(workerPage))[0].id;
  await worker.setOffline(false);
  await workerPage.getByTitle('Abrir menú de navegación').click();
  await workerPage.getByRole('button', { name: 'Mi contraseña', exact: true }).click();
  const dialog = workerPage.getByRole('dialog', { name: 'Mi contraseña', exact: true });
  await dialog.getByLabel('Contraseña o PIN actual').fill(selected);
  await dialog.getByLabel('Nueva contraseña', { exact: true }).fill(changed);
  await dialog.getByLabel('Repetir contraseña').fill(changed);
  await dialog.getByRole('button', { name: 'Guardar mi contraseña', exact: true }).click();
  await workerPage.getByLabel('Código de usuario o correo').waitFor();
  assert.equal((await queue(workerPage))[0].id, pendingId);
  assert.equal((await otherDevice.request.get(`${origin}/api/auth/me`)).status(), 401);
  assert.equal((await write(worker, '/api/auth/login', { identifier: 'QA-PERSONAL', password: selected })).status(), 401);
  await login(workerPage, 'QA-PERSONAL', changed); await identity(workerPage, userId);
  assert.equal((await queue(workerPage))[0].id, pendingId);
  await workerPage.unroute('**/api/sales/sync-batch', hold);
  await workerPage.getByRole('button', { name: 'Reintentar sincronización', exact: true }).first().click();
  await eventually(async () => assert.equal((await queue(workerPage)).length, 0));
  const sales = await centralSales(owner); assert.equal(sales.length, 1); assert.equal(sales[0].id, pendingId);
  checks.push('Cambio propio con clave actual revoca ambos dispositivos y la clave anterior; conserva y sincroniza una venta pendiente exactamente una vez');

  const recoveryLink = await issueLink();
  const token = new URLSearchParams(new URL(recoveryLink).hash.slice(1)).get('token');
  await workerPage.goto(recoveryLink, { waitUntil: 'networkidle' });
  // Se confirma en SQL pero se pierde la respuesta. El mensaje debe orientar al login sin reenviar a ciegas.
  await workerPage.route('**/api/auth/complete-password-activation', async route => { await route.fetch(); await route.abort('failed'); });
  await workerPage.getByLabel('Nueva contraseña', { exact: true }).fill(recovered);
  await workerPage.getByLabel('Repetir contraseña').fill(recovered);
  await workerPage.getByRole('button', { name: 'Guardar mi contraseña', exact: true }).click();
  await workerPage.getByRole('alert').filter({ hasText: 'probá ingresar con tu nueva contraseña' }).waitFor();
  await workerPage.unroute('**/api/auth/complete-password-activation');
  await login(workerPage, 'QA-PERSONAL', recovered); await identity(workerPage, userId);
  assert.equal((await write(worker, '/api/auth/complete-password-activation', { token, newPassword: changed, confirmPassword: changed })).status(), 400);
  assert.equal((await centralSales(owner)).length, 1);
  checks.push('Recuperación presencial y respuesta perdida después del COMMIT: nuevo login funciona, enlace consumido no se reutiliza y ventas intactas');
  // Hay una jornada abierta: editar la clave no debe asignar otra casa por defecto
  // ni disparar el bloqueo económico de un cambio de base que no se pidió.
  assert.equal((await write(owner,'/api/users',{id:'USR-QA-NO-HOUSE',userCode:'QA-NO-HOUSE',name:'Cuenta QA sin base',
    role:'factory_worker',commissionRate:0.2,isActive:true})).status(),201);
  await ownerPage.reload({waitUntil:'networkidle'}); await identity(ownerPage,'USR-ADMIN-01'); await openUsers();
  await userCard('Cuenta QA sin base').getByRole('button',{name:'Editar Usuario',exact:true}).click();
  const unassigned=ownerPage.locator('form').filter({has:ownerPage.getByPlaceholder('Ej: VEND-05')});
  assert.equal(await unassigned.locator('select').nth(1).inputValue(),'');
  const unassignedPassword=randomBytes(6).toString('hex'); secrets.push(unassignedPassword);
  await unassigned.getByLabel('Nueva contraseña',{exact:true}).fill(unassignedPassword);
  await unassigned.getByLabel('Repetir contraseña',{exact:true}).fill(unassignedPassword);
  const unassignedSaved=ownerPage.waitForResponse(reply=>reply.url()===`${origin}/api/users/USR-QA-NO-HOUSE`&&reply.request().method()==='PUT');
  await unassigned.getByRole('button',{name:'Guardar Usuario',exact:true}).click();
  const unassignedResponse=await unassignedSaved; assert.equal(unassignedResponse.status(),200);
  assert.equal((await unassignedResponse.json()).user.assignedHouseId,null);
  const factoryLogin=await write(otherDevice,'/api/auth/login',{identifier:'QA-NO-HOUSE',password:unassignedPassword});
  assert.equal(factoryLogin.status(),200); assert.equal((await factoryLogin.json()).user.role,'factory_worker');
  checks.push('Asignación vacía se conserva al editar contraseña aun con una jornada abierta; fábrica ingresa con su nueva clave');
  for (const page of [ownerPage,workerPage,otherPage]) await assertNoLocalSecrets(page);
  assert.deepEqual(pageErrors, []);
  await workerPage.screenshot({ path: path.join(outputDirectory, 'password-changed-pending-recovered.png'), fullPage: true });
  checks.push('Sin errores JavaScript, contraseñas o enlaces privados persistidos en localStorage');
  await fs.writeFile(path.join(outputDirectory, 'passwords-summary.json'), JSON.stringify({ checks, passed: checks.length,
    scope: 'Chromium local + API real + SQL WASM; no teléfonos físicos ni proveedores externos' }, null, 2));
  console.log(`RESULTADO: ${checks.length}/${checks.length} escenarios de contraseñas en navegador aprobados.`);
  for (const check of checks) console.log(`PASS ${check}`);
}
main().catch(error => { console.error(redact(error.stack || error)); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  if (serverProcess && serverProcess.exitCode === null) {
    const exited = new Promise(resolve => serverProcess.once('exit', resolve)); serverProcess.kill('SIGTERM');
    await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 3000))]);
    if (serverProcess.exitCode === null) serverProcess.kill('SIGKILL');
  }
});

