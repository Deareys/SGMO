/** Hito 1.2.1: frontend debe rechazar autenticación local y persistencia de credenciales. */
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { StorageService } from '../../src/services/storageService';
import { PinLoginScreen } from '../../src/components/PinLoginScreen';
import { INITIAL_USERS } from '../../src/mockData';
import type { UserProfile } from '../../src/types';
import { resetCsrfToken } from '../../src/services/apiClient';

const storageEntries = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageEntries.get(key) ?? null,
  setItem: (key: string, value: string) => { storageEntries.set(key, value); },
  removeItem: (key: string) => { storageEntries.delete(key); },
  clear: () => { storageEntries.clear(); }
};
const worker: UserProfile = { ...INITIAL_USERS.find((user) => user.role === 'seller')!, isProvisioned: true };
const administrator: UserProfile = { ...INITIAL_USERS.find((user) => user.role === 'admin')!, isProvisioned: true };
const testWorkerPin = '58391746';
const testAdminPassword = 'Ephemeral-Admin!927';
let service: StorageService;
let requests: Array<{ url: string; input: RequestInit | undefined }>;
let responseFactory: (url: string, input?: RequestInit) => Promise<Response>;

beforeEach(() => {
  resetCsrfToken();
  storageEntries.clear();
  requests = [];
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorageMock });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {} } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
  responseFactory = async () => { throw new Error('Network unavailable'); };
  globalThis.fetch = async (input, options) => {
    const url = String(input);
    if (url === '/api/auth/csrf') return Response.json({ csrfToken: 'a'.repeat(64) });
    requests.push({ url, input: options });
    return responseFactory(url, options);
  };
  service = new StorageService();
  // Explicit test records stand in for central hydration; production no longer auto-loads seeds.
  service.getState().users = [{ ...worker }, { ...administrator }];
});

function loginResponse(user: UserProfile, extra: Record<string, unknown> = {}): Response {
  return Response.json({ success: true, user, expiresAt: new Date(Date.now() + 60000).toISOString(), ...extra });
}

async function loginAdmin(): Promise<void> {
  responseFactory = async () => loginResponse(administrator);
  assert.equal((await service.loginAsAdminAsync(administrator.userCode!, testAdminPassword)).success, true);
}

for (const [label, pin, userCode] of [
  ['PIN sin identificador', testWorkerPin, undefined],
  ['PIN legado', '1234', worker.userCode],
  ['PIN no numérico', 'abcdefgh', worker.userCode]
] as const) {
  test(`Rechaza ${label} antes de HTTP`, async () => {
    assert.equal((await service.loginWithPinAsync(pin, userCode)).success, false);
    assert.equal(requests.length, 0);
    assert.equal(service.getState().currentUser, null);
  });
}

test('Trabajador correcto requiere respuesta central y envía contrato moderno', async () => {
  responseFactory = async () => loginResponse(worker);
  const result = await service.loginWithPinAsync(testWorkerPin, worker.userCode);
  assert.equal(result.success, true);
  assert.deepEqual(JSON.parse(String(requests[0].input?.body)), { userCode: worker.userCode, pin: testWorkerPin });
  assert.equal(service.getAuthToken(), null);
  assert.equal(new Headers(requests[0].input?.headers).has('Authorization'), false);
  assert.equal(requests[0].input?.credentials, 'same-origin');
});

test('Sin respuesta central no acepta PIN local coincidente', async () => {
  service.getState().users = [{ ...worker, pin: testWorkerPin }];
  assert.equal((await service.loginWithPinAsync(testWorkerPin, worker.userCode)).success, false);
  assert.equal(service.loginWithPin(testWorkerPin, worker.userCode!).success, false);
  assert.equal(service.getState().currentUser, null);
});

test('Administrador requiere identificador antes de HTTP', async () => {
  assert.equal((await service.loginAsAdminAsync('', testAdminPassword)).success, false);
  assert.equal((await service.loginAsAdminAsync('  ', testAdminPassword)).success, false);
  assert.equal(requests.length, 0);
});

test('Administrador correcto se autentica exclusivamente con servidor', async () => {
  await loginAdmin();
  assert.equal(service.getState().currentUser?.id, administrator.id);
  assert.deepEqual(JSON.parse(String(requests[0].input?.body)), { identifier: administrator.userCode, password: testAdminPassword });
});

for (const status of [400, 401, 429, 503]) {
  test(`Respuesta HTTP ${status} nunca activa administrador o trabajador locales`, async () => {
    service.getState().users = [{ ...administrator }, { ...worker, pin: testWorkerPin }];
    responseFactory = async () => Response.json({ success: false }, { status });
    assert.equal((await service.loginAsAdminAsync(administrator.email!, 'any-password')).success, false);
    assert.equal((await service.loginWithPinAsync(testWorkerPin, worker.userCode)).success, false);
    assert.equal(service.getState().currentUser, null);
  });
}

test('Red caída y respuesta HTML no habilitan administrador público', async () => {
  assert.equal((await service.loginAsAdminAsync(administrator.email!, 'anything')).success, false);
  responseFactory = async () => new Response('<html>SPA</html>');
  assert.equal((await service.loginAsAdminAsync(administrator.email!, 'anything')).success, false);
  assert.equal(service.getState().currentUser, null);
});

for (const extra of [{ token: null }, { token: '' }, { token: 42 }, { success: false }, { expiresAt: 'invalid' }, { expiresAt: new Date(0).toISOString() }]) {
  test(`Respuesta central incompleta se rechaza: ${JSON.stringify(extra)}`, async () => {
    responseFactory = async () => loginResponse(worker, extra);
    assert.equal((await service.loginWithPinAsync(testWorkerPin, worker.userCode)).success, false);
    assert.equal(service.getAuthToken(), null);
  });
}

test('Perfil arbitrario no crea ni cambia identidad/rol autenticados', async () => {
  service.setCurrentUser(administrator);
  assert.equal(service.getState().currentUser, null);
  responseFactory = async () => loginResponse(worker);
  await service.loginWithPinAsync(testWorkerPin, worker.userCode);
  service.setCurrentUser(administrator);
  service.setCurrentUser({ ...worker, role: 'admin' });
  assert.equal(service.getState().currentUser?.role, 'seller');
});

test('Sesión activa conserva operación local al perder conexión; no abre sesión nueva', async () => {
  responseFactory = async () => loginResponse(worker);
  await service.loginWithPinAsync(testWorkerPin, worker.userCode);
  responseFactory = async () => { throw new Error('Network unavailable'); };
  const salesBefore = service.getState().sales.length;
  assert.equal((await service.loginAsAdminAsync(administrator.email!, 'anything')).success, false);
  assert.equal(service.getState().currentUser?.id, worker.id);
  assert.equal(service.getState().sales.length, salesBefore);
});

test('Recarga purga credenciales y bearer heredados sin perder ventas ni cola', () => {
  const state = service.getState();
  storageEntries.set('SGMO_TEQUENOS_COSTA_V2', JSON.stringify({ ...state, currentUser: worker,
    users: [{ ...worker, pin: testWorkerPin, password: testAdminPassword, pinHash: 'legacy-hash', pinSalt: 'legacy-salt' }] }));
  storageEntries.set('SGMO_AUTH_USER', JSON.stringify({ ...worker, pin: testWorkerPin }));
  storageEntries.set('SGMO_AUTH_TOKEN', 'existing-token-validated-only-by-server');
  const queue = JSON.stringify([{ id: 'pending-sale-preserved' }]);
  storageEntries.set('SGMO_OFFLINE_SALES_QUEUE', queue);
  const restartedService = new StorageService();
  assert.equal(restartedService.getState().currentUser, null);
  assert.equal(restartedService.getAuthToken(), null);
  assert.equal(storageEntries.has('SGMO_AUTH_TOKEN'), false);
  assert.equal(storageEntries.get('SGMO_OFFLINE_SALES_QUEUE'), queue);
  assert.equal(restartedService.getState().sales.length, state.sales.length);
  assert.equal(storageEntries.has('SGMO_AUTH_USER'), false);
  assert.equal(restartedService.getState().users[0].pin, undefined);
  const persisted = storageEntries.get('SGMO_TEQUENOS_COSTA_V2')!;
  for (const secret of [testWorkerPin, testAdminPassword, 'legacy-hash', 'legacy-salt']) assert.equal(persisted.includes(secret), false);
});

test('Alta y reset de credenciales esperan confirmación y no guardan secretos locales', async () => {
  await loginAdmin();
  let capturedInput: Record<string, unknown> | undefined;
  responseFactory = async (_url, input) => {
    capturedInput = JSON.parse(String(input?.body));
    return Response.json({ success: true, user: { ...worker, id: String(capturedInput!.id), pin: testWorkerPin,
      password: testAdminPassword, password_hash: 'server-must-never-expose-this' } });
  };
  const created = await service.createUser({ ...worker, pin: testWorkerPin, password: testAdminPassword });
  assert.equal(capturedInput?.pin, testWorkerPin);
  assert.equal(created.pin, undefined);
  responseFactory = async (_url, input) => {
    capturedInput = JSON.parse(String(input?.body));
    return Response.json({ success: true, user: { ...created, name: 'Updated worker', pin: testWorkerPin } });
  };
  await service.updateUser(created.id, { name: 'Updated worker', pin: testWorkerPin });
  assert.equal(capturedInput?.pin, testWorkerPin);
  assert.equal(service.getState().users.find((user) => user.id === created.id)?.name, 'Updated worker');
  for (const stored of storageEntries.values()) {
    assert.equal(stored.includes(testWorkerPin), false);
    assert.equal(stored.includes(testAdminPassword), false);
    assert.equal(stored.includes('server-must-never-expose-this'), false);
  }
});

test('HTTP rechazado/red caída no crea ni modifica perfiles', async () => {
  await loginAdmin();
  const originalUsers = JSON.stringify(service.getState().users);
  responseFactory = async () => Response.json({ success: false, error: 'Rejected' }, { status: 503 });
  await assert.rejects(service.createUser({ ...worker, pin: testWorkerPin }), /Rejected/);
  await assert.rejects(service.updateUser(worker.id, { pin: testWorkerPin, name: 'Rejected name' }), /Rejected/);
  await assert.rejects(service.toggleUserActive(worker.id), /Rejected/);
  responseFactory = async () => { throw new Error('Network unavailable'); };
  await assert.rejects(service.createUser(worker), /no se guardó/);
  assert.equal(JSON.stringify(service.getState().users), originalUsers);
});

test('Alta local sin sesión admin no envía ni guarda credenciales', async () => {
  await assert.rejects(service.createUser({ ...worker, pin: testWorkerPin }), /administrador/);
  await assert.rejects(service.updateUser(worker.id, { pin: testWorkerPin }), /administrador/);
  assert.equal(requests.length, 0);
});

test('Semilla sin credenciales y acceso no enumera personas ni preselecciona cuentas', () => {
  for (const user of INITIAL_USERS) {
    assert.equal(user.pin, undefined);
    assert.equal(user.isProvisioned, false);
    assert.equal('password' in user, false);
  }
  const markup = renderToStaticMarkup(React.createElement(PinLoginScreen, { onLoginSuccess() {} }));
  assert.equal(markup.includes('<select'), false);
  assert.equal(markup.includes('value="VEND-01"'), false);
  for (const user of INITIAL_USERS) assert.equal(markup.includes(user.name), false);
  assert.match(markup, /autoComplete="username"/i);
});

test('Login central elimina credenciales incluso si un servidor defectuoso las devuelve', async () => {
  responseFactory = async () => loginResponse({ ...worker, pin: testWorkerPin, password: testAdminPassword,
    pin_hash: 'unsafe-server-hash', passwordSalt: 'unsafe-server-salt' } as UserProfile);
  const result = await service.loginWithPinAsync(testWorkerPin, worker.userCode);
  assert.equal(result.success, true);
  assert.equal(result.user?.pin, undefined);
  for (const entry of storageEntries.values()) {
    for (const secret of [testWorkerPin, testAdminPassword, 'unsafe-server-hash', 'unsafe-server-salt']) {
      assert.equal(entry.includes(secret), false);
    }
  }
});

test('Confirmación de usuario incompleta no se considera alta/reset exitoso', async () => {
  await loginAdmin();
  const originalUsers = JSON.stringify(service.getState().users);
  responseFactory = async () => Response.json({ success: true, message: 'Updated' });
  await assert.rejects(service.createUser(worker), /confirmó un perfil/);
  await assert.rejects(service.updateUser(worker.id, { pin: testWorkerPin }), /confirmó un perfil/);
  assert.equal(JSON.stringify(service.getState().users), originalUsers);
});

test('Modificación confirmada de usuario actual cierra sesión y no adopta rol nuevo', async () => {
  await loginAdmin();
  responseFactory = async (url) => url === '/api/auth/logout'
    ? Response.json({ success: true })
    : Response.json({ success: true, user: { ...administrator, name: 'Updated admin' } });
  await service.updateUser(administrator.id, { name: 'Updated admin', password: testAdminPassword });
  assert.equal(service.getState().currentUser, null);
  assert.equal(service.getAuthToken(), null);
  assert.equal(service.getState().users.find((user) => user.id === administrator.id)?.name, 'Updated admin');
  assert.equal(requests.filter((request) => request.url === '/api/auth/logout').length, 1);
});

test('Restore accepts only a live server cookie session and never trusts a cached profile', async () => {
  storageEntries.set('SGMO_AUTH_USER', JSON.stringify(administrator));
  const reloaded = new StorageService();
  assert.equal(reloaded.getState().currentUser, null);
  responseFactory = async () => Response.json({ success: true, user: worker,
    session: { role: worker.role, expiresAt: new Date(Date.now() + 60000).toISOString() } });
  assert.equal(await reloaded.restoreSession(), true);
  assert.equal(reloaded.getState().currentUser?.id, worker.id);
  assert.equal(reloaded.getAuthToken(), null);
  assert.equal(requests[0].url, '/api/auth/me');
  assert.equal(requests[0].input?.credentials, 'same-origin');
});

test('Offline reload and invalid/expired central sessions never restore an identity', async () => {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
  assert.equal(await service.restoreSession(), false);
  assert.equal(requests.length, 0);
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
  for (const session of [{ expiresAt: 'invalid', role: worker.role }, { expiresAt: new Date(0).toISOString(), role: worker.role },
    { expiresAt: new Date(Date.now() + 60000).toISOString(), role: 'admin' }]) {
    responseFactory = async () => Response.json({ success: true, user: worker, session });
    assert.equal(await service.restoreSession(), false);
    assert.equal(service.getState().currentUser, null);
  }
  responseFactory = async () => Response.json({ success: false }, { status: 401 });
  assert.equal(await service.restoreSession(), false);
});

test('Logout requires central revocation; an offline failure blocks cookie restore until retry', async () => {
  await loginAdmin();
  responseFactory = async () => { throw new Error('offline'); };
  const failure = await service.logout();
  assert.equal(failure.success, false);
  assert.equal(service.getState().currentUser, null);
  assert.equal(storageEntries.get('SGMO_LOGOUT_PENDING'), 'true');
  const restart = new StorageService();
  let restores = 0;
  responseFactory = async (url) => {
    if (url === '/api/auth/me') restores++;
    return Response.json({ success: true });
  };
  assert.equal(await restart.restoreSession(), false);
  assert.equal(restores, 0);
  assert.equal(storageEntries.has('SGMO_LOGOUT_PENDING'), false);
  assert.equal(restart.getState().currentUser, null);
});
