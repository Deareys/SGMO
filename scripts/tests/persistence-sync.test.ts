/** Hito 2.1: cola durable, ACK selectivo, hidratación central y operaciones confirmadas. */
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { StorageService, type CentralSnapshot } from '../../src/services/storageService';
import { resetCsrfToken } from '../../src/services/apiClient';
import { INITIAL_USERS, INITIAL_SHIFTS, INITIAL_VARIETIES, INITIAL_HOUSES, INITIAL_CARTS, INITIAL_ZONES, INITIAL_SYSTEM_CONFIG } from '../../src/mockData';
import type { SaleTransaction } from '../../src/types';

const storage = new Map<string, string>();
const queueKey = 'SGMO_OFFLINE_SALES_QUEUE';
const stateKey = 'SGMO_TEQUENOS_COSTA_V2';
const worker = structuredClone(INITIAL_USERS.find((user) => user.role === 'seller')!);
const administrator = structuredClone(INITIAL_USERS.find((user) => user.role === 'admin')!);
let service: StorageService;
let requestCount: number;
let responder: (url: string, input?: RequestInit) => Promise<Response>;
let rejectQueueWrites: boolean;
let rejectCacheWrites: boolean;
let rejectIndexWrites: boolean;

function snapshot(): CentralSnapshot {
  return structuredClone({ users: [worker, administrator], shifts: INITIAL_SHIFTS.filter((shift) => shift.sellerId === worker.id), sales: [],
    varieties: INITIAL_VARIETIES, houses: INITIAL_HOUSES, carts: INITIAL_CARTS, zones: INITIAL_ZONES, systemConfig: INITIAL_SYSTEM_CONFIG });
}
function pendingSale(id: string, sellerId = worker.id): SaleTransaction {
  return { id, sellerId, sellerName: worker.name, shiftId: snapshot().shifts[0].id, timestamp: new Date().toISOString(),
    itemType: 'unidad', varietyId: INITIAL_VARIETIES[0].id, varietyName: INITIAL_VARIETIES[0].name,
    quantityUnitsEquivalent: 1, totalAmount: 1500, paymentMethod: 'efectivo', validationStatus: 'validada', syncStatus: 'pending', isOfflineCreated: true };
}
function writeQueue(sales: SaleTransaction[]) { storage.set(queueKey, JSON.stringify(sales)); }
function readQueue(): SaleTransaction[] { return JSON.parse(storage.get(queueKey) || '[]'); }
function selectWorkerScope() {
  Object.assign(service.getState(), snapshot(), { currentUser: worker, centralHydrated: true, centralOwnerUserId: worker.id, isOnline: false });
}

beforeEach(() => {
  resetCsrfToken(); storage.clear(); requestCount = 0; rejectQueueWrites = false; rejectCacheWrites = false; rejectIndexWrites = false;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {} } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { if ((rejectCacheWrites && key === stateKey) || (rejectIndexWrites && key === queueKey)) throw new Error('QuotaExceeded'); if (rejectQueueWrites && (key === queueKey || key.startsWith('SGMO_PENDING_SALE_V1_'))) throw new Error('QuotaExceeded'); storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
    get length() { return storage.size; },
    key: (index: number) => [...storage.keys()][index] ?? null
  } });
  responder = async () => { throw new Error('Network unavailable'); };
  globalThis.fetch = async (url, input) => {
    if (String(url) === '/api/auth/csrf') return Response.json({ csrfToken: 'a'.repeat(64) });
    requestCount++;
    return responder(String(url), input);
  };
  service = new StorageService();
});

test('Instalación nueva no carga personas, turnos, ventas o catálogo de demostración', () => {
  assert.equal(service.getState().users.length, 0);
  assert.equal(service.getState().shifts.length, 0);
  assert.equal(service.getState().sales.length, 0);
  assert.equal(service.getState().varieties.length, 0);
  assert.equal(service.getState().houses.length, 0);
  assert.equal(service.getState().demoMode, false);
});

test('Recarga no agrega turnos/zonas mock a caché central pequeña', () => {
  storage.set(stateKey, JSON.stringify({ ...service.getState(), shifts: [], zones: [{ id: 'only-central-zone', name: 'Central' }] }));
  const restored = new StorageService();
  assert.equal(restored.getState().shifts.length, 0);
  assert.deepEqual(restored.getState().zones.map((zone) => zone.id), ['only-central-zone']);
});

test('Hydration adopta datos centrales y conserva pendientes propios por ID', async () => {
  service.getState().currentUser = worker;
  const pending = pendingSale('pending-local');
  writeQueue([pending, pendingSale('other-person-pending', 'another-worker')]);
  responder = async () => Response.json({ success: true, configured: true, demoMode: false, state: { ...snapshot(), users: [] } });
  assert.equal(await service.refreshCentralState(), true);
  assert.deepEqual(service.getState().sales.map((sale) => sale.id), ['pending-local']);
  assert.equal(service.getState().centralOwnerUserId, worker.id);
  assert.equal(service.getState().demoMode, false);
  assert.equal(readQueue().length, 2);
});

for (const response of [
  () => Response.json({ success: false }, { status: 503 }),
  () => Response.json({ success: true, configured: true, state: {} }),
  () => Response.json({ success: true, configured: false, demoMode: false, state: snapshot() })
]) {
  test('Central caída/incompleta/no configurada conserva caché y cola, no usa semillas', async () => {
    selectWorkerScope();
    writeQueue([pendingSale('preserved')]);
    const before = JSON.stringify(service.getState().shifts);
    responder = async () => response();
    assert.equal(await service.refreshCentralState(), false);
    assert.equal(JSON.stringify(service.getState().shifts), before);
    assert.equal(readQueue()[0].id, 'preserved');
    assert.match(service.getState().centralError!, /conserva/);
  });
}

test('Una respuesta de bootstrap tardía no adopta datos para otra identidad', async () => {
  service.getState().currentUser = worker;
  let finish!: (response: Response) => void;
  responder = () => new Promise((resolve) => { finish = resolve; });
  const refresh = service.refreshCentralState();
  await new Promise((resolve) => setImmediate(resolve));
  service.getState().currentUser = administrator;
  finish(Response.json({ success: true, configured: true, state: snapshot() }));
  assert.equal(await refresh, false);
  assert.equal(service.getState().centralHydrated, false);
});

for (const response of [
  () => Response.json({ success: true }),
  () => Response.json({ success: false, acknowledgedIds: ['sale-1'] }),
  () => Response.json({ success: true, acknowledgedIds: ['unknown-id'] }),
  () => Response.json({ success: false }, { status: 503 })
]) {
  test('No elimina cola sin confirmación válida, incluso si HTTP es 200', async () => {
    selectWorkerScope(); writeQueue([pendingSale('sale-1')]);
    responder = async () => response();
    assert.equal((await service.flushOfflineQueue()).success, false);
    assert.equal(readQueue().length, 1);
    assert.equal(service.getState().saleSyncStatus, 'error');
  });
}

test('ACK parcial elimina exclusivamente IDs confirmados y actualiza indicadores', async () => {
  selectWorkerScope(); writeQueue([pendingSale('sale-1'), pendingSale('sale-2')]);
  service.getState().sales = readQueue();
  responder = async () => Response.json({ success: true, acknowledgedIds: ['sale-1'] });
  const result = await service.flushOfflineQueue();
  assert.equal(result.success, true);
  assert.equal(result.pending, 1);
  assert.deepEqual(readQueue().map((sale) => sale.id), ['sale-2']);
  assert.equal(service.getState().sales[0].syncStatus, 'synced');
});

test('Reintento conserva IDs estables y confirma después de error de red', async () => {
  selectWorkerScope(); writeQueue([pendingSale('same-id-retry')]);
  const requests: string[][] = [];
  responder = async (_url, input) => {
    requests.push(JSON.parse(String(input?.body)).sales.map((sale: SaleTransaction) => sale.id));
    if (requests.length === 1) throw new Error('Network unavailable');
    return Response.json({ success: true, acknowledgedIds: ['same-id-retry'] });
  };
  assert.equal((await service.flushOfflineQueue()).success, false);
  assert.equal((await service.flushOfflineQueue()).success, true);
  assert.deepEqual(requests, [['same-id-retry'], ['same-id-retry']]);
  assert.deepEqual(readQueue(), []);
});

test('Un ACK no borra ventas nuevas concurrentes ni versión editada del mismo ID', async () => {
  selectWorkerScope(); const original = pendingSale('sale-1'); writeQueue([original]);
  let finish!: (response: Response) => void;
  responder = () => new Promise((resolve) => { finish = resolve; });
  const sync = service.flushOfflineQueue();
  await new Promise((resolve) => setImmediate(resolve));
  const updated = { ...original, beachSector: 'Updated while request in flight' };
  writeQueue([updated, pendingSale('new-concurrent-sale')]);
  finish(Response.json({ success: true, acknowledgedIds: ['sale-1'] }));
  const result = await sync;
  assert.equal(result.pending, 2);
  assert.deepEqual(readQueue().map((sale) => sale.id), ['sale-1', 'new-concurrent-sale']);
});

test('Dos flush simultáneos comparten request y no reenvían sin necesidad', async () => {
  selectWorkerScope(); writeQueue([pendingSale('sale-1')]);
  let finish!: (response: Response) => void;
  responder = () => new Promise((resolve) => { finish = resolve; });
  const first = service.flushOfflineQueue(); const second = service.flushOfflineQueue();
  assert.equal(first, second);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requestCount, 1);
  finish(Response.json({ success: true, acknowledgedIds: ['sale-1'] }));
  await Promise.all([first, second]);
});

test('Vendedor no incluye pendientes de otras personas en el lote enviado', async () => {
  selectWorkerScope(); writeQueue([pendingSale('own'), pendingSale('other', 'someone-else')]);
  responder = async (_url, input) => {
    const sales = JSON.parse(String(input?.body)).sales;
    assert.deepEqual(sales.map((sale: SaleTransaction) => sale.id), ['own']);
    return Response.json({ success: true, acknowledgedIds: ['own'] });
  };
  await service.flushOfflineQueue();
  assert.deepEqual(readQueue().map((sale) => sale.id), ['other']);
});

test('Venta online también se encola antes de confirmación central y conserva UUID', async () => {
  selectWorkerScope(); service.getState().isOnline = true;
  const first = service.registerSale({ shiftId: service.getState().shifts[0].id, itemType: 'unidad', varietyId: INITIAL_VARIETIES[0].id,
    quantityUnitsEquivalent: 1, totalAmount: 1500, paymentMethod: 'efectivo' });
  assert.equal(first.syncStatus, 'pending'); assert.equal(first.isOfflineCreated, false);
  assert.match(first.id, /^TX-[a-f0-9-]{36}$/);
  await service.flushOfflineQueue();
  assert.equal(readQueue()[0].id, first.id);
});

test('Fallo al persistir cola impide alterar caja, ventas y stock de jornada', () => {
  selectWorkerScope(); rejectQueueWrites = true;
  const before = JSON.stringify({ shifts: service.getState().shifts, sales: service.getState().sales });
  assert.throws(() => service.registerSale({ shiftId: service.getState().shifts[0].id, itemType: 'unidad', varietyId: INITIAL_VARIETIES[0].id,
    quantityUnitsEquivalent: 1, totalAmount: 1500, paymentMethod: 'efectivo' }), /QuotaExceeded/);
  assert.equal(JSON.stringify({ shifts: service.getState().shifts, sales: service.getState().sales }), before);
});

test('Reset rechaza producción, roles no admin y cola inválida/pendiente sin borrar datos', () => {
  selectWorkerScope(); const before = storage.get(stateKey);
  assert.throws(() => service.resetToFactorySeed(), /administrador/);
  service.getState().currentUser = administrator;
  assert.throws(() => service.resetToFactorySeed(), /producción/);
  service.getState().demoMode = true; writeQueue([pendingSale('preserved')]);
  assert.throws(() => service.resetToFactorySeed(), /pendientes/);
  storage.set(queueKey, '{invalid');
  assert.throws(() => service.resetToFactorySeed());
  assert.equal(storage.get(stateKey), before);
  assert.equal(storage.get(queueKey), '{invalid');
});

test('Despacho rechazado no publica borrador ni descuenta inventario local', async () => {
  selectWorkerScope(); service.getState().isOnline = true; service.getState().currentUser = administrator;
  service.getState().centralOwnerUserId = administrator.id;
  const economicState = () => ({ shifts: service.getState().shifts, houses: service.getState().houses, carts: service.getState().carts,
    sales: service.getState().sales, auditLogs: service.getState().auditLogs });
  const before = JSON.stringify(economicState());
  responder = async () => Response.json({ success: false, message: 'Rejected dispatch' }, { status: 503 });
  await assert.rejects(service.dispatchSellerShift({ houseId: INITIAL_HOUSES[0].id, cartId: INITIAL_CARTS[0].id,
    sellerId: worker.id, zoneId: INITIAL_ZONES[0].id, stockToDeliver: [{ varietyId: INITIAL_VARIETIES[0].id, quantity: 10 }],
    gasPercentStart: 100, napkinsDelivered: 5, conesDelivered: 50, saucesProvided: [] }), /Rejected dispatch/);
  assert.equal(JSON.stringify(economicState()), before);
  assert.equal(service.getState().operationSyncError, 'Rejected dispatch');
});

test('Venta inválida/fuera de stock no altera cola o totales locales', () => {
  selectWorkerScope();
  const shiftId = service.getState().shifts[0].id;
  for (const units of [0, -1, 0.5, 999_999]) {
    assert.throws(() => service.registerSale({ shiftId, itemType: 'unidad', varietyId: INITIAL_VARIETIES[0].id,
      quantityUnitsEquivalent: units, totalAmount: 1500, paymentMethod: 'efectivo' }));
  }
  assert.deepEqual(readQueue(), []);
});

test('Merma/restock rechazada no publica cambios de stock o inventario', async () => {
  selectWorkerScope(); service.getState().isOnline = true; service.getState().currentUser = administrator;
  service.getState().centralOwnerUserId = administrator.id;
  const before = JSON.stringify({ shifts: service.getState().shifts, houses: service.getState().houses });
  responder = async () => Response.json({ success: false, message: 'Rejected stock operation' }, { status: 400 });
  await assert.rejects(service.recordShiftWaste(service.getState().shifts[0].id, INITIAL_VARIETIES[0].id, 1, 'caida_en_arena'), /Rejected/);
  await assert.rejects(service.addShiftRestock({ shiftId: service.getState().shifts[0].id,
    items: [{ varietyId: INITIAL_VARIETIES[0].id, quantity: 5 }] }), /Rejected/);
  assert.equal(JSON.stringify({ shifts: service.getState().shifts, houses: service.getState().houses }), before);
});

test('Respuesta de despacho perdida conserva ID y payload exactos para retry, incluso tras recarga', async () => {
  selectWorkerScope(); service.getState().isOnline = true; service.getState().currentUser = administrator;
  service.getState().centralOwnerUserId = administrator.id;
  const dispatchInput = { houseId: INITIAL_HOUSES[0].id, cartId: INITIAL_CARTS[0].id,
    sellerId: worker.id, zoneId: INITIAL_ZONES[0].id, stockToDeliver: [{ varietyId: INITIAL_VARIETIES[0].id, quantity: 10 }],
    gasPercentStart: 100, napkinsDelivered: 5, conesDelivered: 50, saucesProvided: [] };
  const bodies: string[] = [];
  let persistedShift: ReturnType<typeof snapshot>['shifts'][number];
  responder = async (url, input) => {
    if (url === '/api/bootstrap') return Response.json({ success: true, configured: true, demoMode: false,
      state: { ...snapshot(), shifts: [persistedShift] } });
    bodies.push(String(input?.body));
    if (bodies.length === 1) throw new Error('Response lost after server commit');
    persistedShift = JSON.parse(String(input?.body));
    return Response.json({ success: true, shift: persistedShift });
  };
  await assert.rejects(service.dispatchSellerShift(dispatchInput), /no se confirmó/);
  assert.equal(JSON.parse(storage.get('SGMO_PENDING_OPERATIONS')!).length, 1);
  service = new StorageService();
  selectWorkerScope(); service.getState().currentUser = administrator;
  service.getState().centralOwnerUserId = administrator.id; service.getState().isOnline = true;
  const confirmed = await service.dispatchSellerShift(dispatchInput);
  assert.equal(bodies[0], bodies[1]);
  assert.equal(confirmed.id, JSON.parse(bodies[0]).id);
  assert.deepEqual(JSON.parse(storage.get('SGMO_PENDING_OPERATIONS')!), []);
});

test('Cierre rechaza pendientes de venta sin confirmar y no modifica saldos', async () => {
  selectWorkerScope(); service.getState().currentUser = administrator;
  service.getState().centralOwnerUserId = administrator.id; service.getState().isOnline = true;
  const shiftId = service.getState().shifts[0].id;
  writeQueue([pendingSale('not-confirmed')]);
  const before = JSON.stringify(service.getState().shifts);
  responder = async () => Response.json({ success: false }, { status: 503 });
  await assert.rejects(service.closeAndReconcileShift({ shiftId, cashDeclared: 0, gasPercentEnd: 50,
    returnedItems: [], deductionMissingRatePerUnit: 1500, bonusIncentive: 0, coordinatorSignature: 'QA' }), /ventas sin confirmar/);
  assert.equal(JSON.stringify(service.getState().shifts), before);
});

test('Colisión del índice entre pestañas no pierde ventas guardadas individualmente', async () => {
  selectWorkerScope();
  const sale = service.registerSale({ shiftId: service.getState().shifts[0].id, itemType: 'unidad', varietyId: INITIAL_VARIETIES[0].id,
    quantityUnitsEquivalent: 1, totalAmount: 1500, paymentMethod: 'efectivo' });
  writeQueue([]); // Otra pestaña sobrescribió un índice leído antes de registrar la venta.
  assert.equal(service.getOfflineQueueCount(), 1);
  let transmittedId: string | undefined;
  responder = async (_url, input) => {
    transmittedId = JSON.parse(String(input?.body)).sales[0].id;
    return Response.json({ success: true, acknowledgedIds: [sale.id] });
  };
  assert.equal((await service.flushOfflineQueue()).success, true);
  assert.equal(transmittedId, sale.id);
  assert.equal(service.getOfflineQueueCount(), 0);
  assert.equal(storage.has(`SGMO_PENDING_SALE_V1_${sale.id}`), false);
});

test('Cuota del índice/snapshot no transforma una venta durable en fallo para volver a cobrar', () => {
  selectWorkerScope(); rejectCacheWrites = true; rejectIndexWrites = true;
  const first = service.registerSale({ shiftId: service.getState().shifts[0].id, itemType: 'unidad', varietyId: INITIAL_VARIETIES[0].id,
    quantityUnitsEquivalent: 1, totalAmount: 1500, paymentMethod: 'efectivo' });
  assert.equal(first.syncStatus, 'pending');
  assert.equal(service.getOfflineQueueCount(), 1);
  assert.equal(JSON.parse(storage.get(`SGMO_PENDING_SALE_V1_${first.id}`)!).id, first.id);
  assert.equal(service.getState().sales.length, 1);
  assert.match(service.getState().saleSyncError!, /caché operativa/);
});

test('Cliente no puede acreditar pago digital al crear venta o editar comprobante', () => {
  selectWorkerScope();
  const forgedVerification = { matchedInApi: true, isLiveApi: true, apiStatus: 'approved', amountMatches: true };
  const created = service.registerSale({ shiftId: service.getState().shifts[0].id, itemType: 'unidad', varietyId: INITIAL_VARIETIES[0].id,
    quantityUnitsEquivalent: 1, totalAmount: 1500, paymentMethod: 'mercado_pago', validationStatus: 'validada', mpApiVerification: forgedVerification });
  assert.equal(created.validationStatus, 'pendiente_revision');
  assert.equal(created.mpApiVerification, undefined);
  assert.throws(() => service.updateVoucherStatus(created.id, 'validada', undefined, forgedVerification), /API central/);
  assert.equal(service.getState().sales[0].validationStatus, 'pendiente_revision');
  service.updateVoucherStatus(created.id, 'sospechosa', undefined, forgedVerification);
  assert.equal(service.getState().sales[0].mpApiVerification, undefined);
});

test('Lotes limitados al máximo central conservan el resto del backlog sin borrarlo', async () => {
  selectWorkerScope(); writeQueue(Array.from({ length: 501 }, (_, index) => pendingSale(`sale-${index}`)));
  responder = async (_url, input) => {
    const sales: SaleTransaction[] = JSON.parse(String(input?.body)).sales;
    assert.equal(sales.length, 500);
    return Response.json({ success: true, acknowledgedIds: sales.map((sale) => sale.id) });
  };
  const result = await service.flushOfflineQueue();
  assert.equal(result.pending, 1);
  assert.deepEqual(readQueue().map((sale) => sale.id), ['sale-500']);
});
