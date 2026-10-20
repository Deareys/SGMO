/**
 * SGMO — Tequeños Costa
 * REST Router for Central Persistence (PostgreSQL) con Protección RBAC
 */

import { Router, Request, Response } from 'express';
import {
  isDbConfigured,
  getDatabaseStatus,
  runMigrations,
  userRepository,
  shiftRepository,
  saleRepository,
  stockRepository,
  validateSaleIntegrity
} from '../db/index.js';
import { authenticateToken, requireRole } from '../auth/authMiddleware.js';
import { UserCredentialValidationError } from '../db/repositories/UserRepository.js';
import { publicProfile } from '../auth/publicProfile.js';
import { isIsolatedDemoEnabled } from '../auth/authPolicy.js';
import { INITIAL_SHIFTS, INITIAL_SALES } from '../../mockData.js';
import { randomUUID } from 'crypto';
import { DataIntegrityError, assertOperationId } from '../db/salesValidation.js';

export const dbRouter = Router();

// 1. Estado y Salud de la Base de Datos (Público para diagnóstico del cliente)
dbRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await getDatabaseStatus();
    res.json(status);
  } catch (error: any) {
    res.status(503).json({
      status: 'DATABASE CONFIGURED',
      configured: true,
      provider: 'PostgreSQL',
      connected: false,
      message: 'No se pudo verificar la conexión central.'
    });
  }
});

// 2. Ejecución de Migraciones (Restringido exclusivamente a Administradores)
dbRouter.post('/migrate', authenticateToken, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    if (!isDbConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'DATABASE NOT CONFIGURED: Configure DATABASE_URL en variables de entorno para aplicar migraciones.'
      });
    }
    const result = await runMigrations();
    res.json(result);
  } catch (error: any) {
    res.status(503).json({ success: false, error: 'No se pudo confirmar la actualización del esquema central.' });
  }
});

// Middleware de verificación de configuración de DB para rutas de persistencia
const requireDb = (req: Request, res: Response, next: any) => {
  if (!isDbConfigured()) {
    return res.status(503).json({
      success: false,
      dbConfigured: false,
      code: 'DATABASE_NOT_CONFIGURED',
      message: 'PostgreSQL no está configurado. La operación central no se realizó; se conservan las ventas pendientes en el dispositivo.'
    });
  }
  next();
};

/**
 * Resuelve una jornada según la persistencia activa:
 * - Si PostgreSQL está configurado, consulta EXCLUSIVAMENTE la base central.
 *   Si la base arroja un error, se propaga para responder 503 y denegar la autorización.
 *   Si la jornada no existe en PostgreSQL, retorna null.
 *   NUNCA recurre a datos semilla de demostración cuando PostgreSQL está activo.
 * - Si PostgreSQL NO está configurado (modo contingencia local sin DATABASE_URL),
 *   resuelve la jornada a partir de INITIAL_SHIFTS.
 */
export async function resolveShift(shiftId: string) {
  if (isDbConfigured()) {
    return await shiftRepository.getById(shiftId);
  }
  const fallback = isIsolatedDemoEnabled() && INITIAL_SHIFTS.find((s) => s.id === shiftId);
  return fallback || null;
}

// 3. Gestión de Usuarios (Requiere Autenticación y Autorización)
// GET /users: Accesible por admin y coordinator
dbRouter.get('/users', authenticateToken, requireRole('admin', 'coordinator'), requireDb, async (req: Request, res: Response) => {
  try {
    const allUsers = await userRepository.getAll();
    const requestingUser = req.userSession!.role === 'admin' ? null : await userRepository.getById(req.userSession!.userId);
    const users = req.userSession!.role === 'admin' ? allUsers : allUsers.filter((user) => user.id === requestingUser?.id
      || (requestingUser?.assignedHouseId && user.assignedHouseId === requestingUser.assignedHouseId));
    res.json({ success: true, count: users.length, users: users.map(publicProfile) });
  } catch (error: any) {
    res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', error: 'Servicio central no disponible.' });
  }
});

/** Solo campos públicos y credenciales de entrada; nunca se aceptan hashes o flags de aprovisionamiento del cliente. */
function userInput(body: unknown): Record<string, any> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new UserCredentialValidationError('Perfil inválido.');
  const allowed = ['id', 'userCode', 'name', 'email', 'role', 'phone', 'pin', 'password', 'avatarUrl',
    'assignedHouseId', 'commissionRate', 'housingCostExempt', 'housingCostOverride', 'isActive', 'notes', 'permissions'];
  const input = Object.fromEntries(Object.entries(body).filter(([key]) => allowed.includes(key)));
  if (input.userCode !== undefined && (typeof input.userCode !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(input.userCode))) {
    throw new UserCredentialValidationError('Código de usuario inválido.');
  }
  return input;
}

function userWriteError(error: unknown, res: Response) {
  if (error instanceof DataIntegrityError) {
    return res.status(error.status).json({ success: false, code: error.code, error: error.message });
  }
  if (error instanceof UserCredentialValidationError) {
    return res.status(400).json({ success: false, code: 'INVALID_USER_INPUT', error: error.message });
  }
  if ((error as { code?: string })?.code === '23505') {
    return res.status(409).json({ success: false, code: 'DUPLICATE_USER_CODE', error: 'El identificador de usuario ya está asignado.' });
  }
  return res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', error: 'No se pudo confirmar la operación central.' });
}

// POST /users: Sólo admin puede crear usuarios. La validación completa está también en el repositorio.
dbRouter.post('/users', authenticateToken, requireRole('admin'), requireDb, async (req: Request, res: Response) => {
  try {
    const input = userInput(req.body);
    if (typeof input.id !== 'string' || !input.id || typeof input.name !== 'string' || !input.name.trim()
        || !input.role || typeof input.commissionRate !== 'number') throw new UserCredentialValidationError('Perfil de usuario incompleto.');
    input.isActive ??= true;
    const created = await userRepository.create(input as any);
    return res.status(201).json({ success: true, user: publicProfile(created) });
  } catch (error) {
    return userWriteError(error, res);
  }
});

// PUT /users/:id: Sólo admin; devuelve confirmación pública para actualizar la caché del cliente.
dbRouter.put('/users/:id', authenticateToken, requireRole('admin'), requireDb, async (req: Request, res: Response) => {
  try {
    const input = userInput(req.body);
    delete input.id;
    await userRepository.update(req.params.id, input);
    const updated = await userRepository.getById(req.params.id);
    if (!updated) throw new UserCredentialValidationError('Perfil no disponible.');
    return res.json({ success: true, user: publicProfile(updated), message: 'Usuario actualizado' });
  } catch (error) {
    return userWriteError(error, res);
  }
});

// 4. Jornadas (Daily Shifts)
// GET /shifts: admin global, coordinación asignada, vendedor propio; fábrica denegada.
dbRouter.get('/shifts', authenticateToken, requireRole('admin', 'coordinator', 'seller'), async (req: Request, res: Response) => {
  try {
    const session = req.userSession!;
    if (session.role === 'seller') {
      // Vendedor: sólo su jornada activa o relacionada
      if (isDbConfigured()) {
        const shift = await shiftRepository.getActiveForUser(session.userId);
        return res.json({ success: true, count: shift ? 1 : 0, shifts: shift ? [shift] : [] });
      }
      const shift = INITIAL_SHIFTS.find((s) => s.sellerId === session.userId && s.status === 'en_curso');
      return res.json({ success: true, count: shift ? 1 : 0, shifts: shift ? [shift] : [] });
    }

    if (isDbConfigured()) {
      const shifts = (await shiftRepository.getAll()).filter((shift) => session.role === 'admin'
        || shift.coordinatorId === session.userId || shift.sellerId === session.userId);
      return res.json({ success: true, count: shifts.length, shifts });
    }
    const shifts = isIsolatedDemoEnabled() ? INITIAL_SHIFTS.filter((shift) => session.role === 'admin'
      || shift.coordinatorId === session.userId || shift.sellerId === session.userId) : [];
    return res.json({ success: true, count: shifts.length, shifts });
  } catch (error: any) {
    if (isDbConfigured()) {
      return res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', error: 'No se pudo consultar la operación central.' });
    }
    res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', error: 'No se pudo consultar la operación central.' });
  }
});

// GET /shifts/active/:userId: Usuario autenticado (él mismo o admin/coord)
dbRouter.get('/shifts/active/:userId', authenticateToken, requireRole('admin', 'coordinator', 'seller'), async (req: Request, res: Response) => {
  try {
    const session = req.userSession!;
    if (session.role === 'seller' && session.userId !== req.params.userId) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'No podés ver la jornada de otro vendedor.' });
    }

    if (isDbConfigured()) {
      const shift = await shiftRepository.getActiveForUser(req.params.userId);
      if (shift && session.role === 'coordinator' && shift.coordinatorId !== session.userId && shift.sellerId !== session.userId) {
        return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'La jornada no corresponde a tu coordinación.' });
      }
      return res.json({ success: true, shift });
    }
    const shift = (isIsolatedDemoEnabled() && INITIAL_SHIFTS.find((s) => s.sellerId === req.params.userId && s.status === 'en_curso')) || null;
    if (shift && session.role === 'coordinator' && shift.coordinatorId !== session.userId && shift.sellerId !== session.userId) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'La jornada no corresponde a tu coordinación.' });
    }
    res.json({ success: true, shift });
  } catch (error: any) {
    if (isDbConfigured()) {
      return res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', error: 'No se pudo consultar la operación central.' });
    }
    res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', error: 'No se pudo consultar la operación central.' });
  }
});

// GET /shifts/:id: Ver detalle de jornada (admin, coordinador o el vendedor asignado)
dbRouter.get('/shifts/:id', authenticateToken, requireRole('admin', 'coordinator', 'seller'), async (req: Request, res: Response) => {
  try {
    const session = req.userSession!;
    const shift = await resolveShift(req.params.id);

    if (!shift) {
      return res.status(404).json({ success: false, message: 'Jornada no encontrada' });
    }

    if ((session.role === 'seller' && shift.sellerId !== session.userId)
        || (session.role === 'coordinator' && shift.coordinatorId !== session.userId && shift.sellerId !== session.userId)) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Acceso no autorizado: No podés consultar los datos de una jornada perteneciente a otro vendedor.'
      });
    }

    res.json({ success: true, shift });
  } catch (error: any) {
    if (isDbConfigured()) {
      return res.status(503).json({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
        message: 'No se pudo consultar la operación central.'
      });
    }
    res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', error: 'No se pudo consultar la operación central.' });
  }
});

/** Respuestas de operación predecibles; los mensajes SQL internos no salen a HTTP. */
function operationError(res: Response, error: unknown) {
  if (error instanceof DataIntegrityError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  return res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'La operación central no se pudo confirmar; conservá los datos y reintentá.' });
}

// POST /shifts: la cuenta coordinadora y métricas iniciales se derivan del servidor.
dbRouter.post('/shifts', authenticateToken, requireRole('admin', 'coordinator'), requireDb, async (req: Request, res: Response) => {
  try {
    const shift = await shiftRepository.createShift(req.body, req.userSession!);
    res.status(201).json({ success: true, shift });
  } catch (error) { operationError(res,error); }
});

// Cierre sólo con conteos físicos; payout/comisiones enviados por cliente se ignoran.
dbRouter.put('/shifts/:id/close', authenticateToken, requireRole('admin', 'coordinator'), requireDb, async (req: Request, res: Response) => {
  try {
    if (req.body?.shiftId && req.body.shiftId !== req.params.id) throw new DataIntegrityError('SHIFT_PATH_MISMATCH','La jornada del cuerpo no coincide con la ruta.');
    const shift = await shiftRepository.closeAndReconcileShift(req.params.id, req.body, req.userSession!);
    res.json({ success: true, shift, message: 'Jornada conciliada y cerrada en PostgreSQL' });
  } catch (error) { operationError(res,error); }
});

// Declaración del vendedor, separada de la conciliación autorizada.
dbRouter.post('/shifts/:id/leftovers', authenticateToken, requireRole('admin','coordinator','seller'), requireDb, async (req: Request,res: Response) => {
  try {
    const shift = await shiftRepository.declareLeftovers(req.params.id,req.body,req.userSession!);
    res.json({ success: true, shift });
  } catch (error) { operationError(res,error); }
});

dbRouter.put('/shifts/:id/payout', authenticateToken, requireRole('admin','coordinator'), requireDb, async (req: Request,res: Response) => {
  try {
    const shift = await shiftRepository.markPayout(req.params.id,req.body?.paymentProof,req.userSession!);
    res.json({ success: true, shift });
  } catch (error) { operationError(res,error); }
});

// 5. Transacciones de Venta
// GET /sales: Admin y coordinador exclusivamente
dbRouter.get('/sales', authenticateToken, requireRole('admin', 'coordinator'), requireDb, async (req: Request, res: Response) => {
  try {
    const all = await saleRepository.getAll();
    const session = req.userSession!;
    const allowed = session.role === 'admin' ? null : new Set((await shiftRepository.getAll())
      .filter((shift) => shift.coordinatorId === session.userId || shift.sellerId === session.userId).map((shift) => shift.id));
    const sales = allowed ? all.filter((sale) => allowed.has(sale.shiftId)) : all;
    res.json({ success: true, count: sales.length, sales });
  } catch (error: any) {
    res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'No se pudo consultar la operación central.' });
  }
});

// GET /sales/shift/:shiftId: Ver ventas de una jornada (Admin, Coord o el vendedor dueño del turno)
dbRouter.get('/sales/shift/:shiftId', authenticateToken, requireRole('admin', 'coordinator', 'seller'), async (req: Request, res: Response) => {
  try {
    const session = req.userSession!;
    const shift = await resolveShift(req.params.shiftId);

    if (!shift) {
      return res.status(404).json({ success: false, message: 'Jornada no encontrada' });
    }

    // Aislamiento por recurso SEC-03: si es vendedor, sólo puede ver las ventas de su propia jornada
    if (session.role !== 'admin' && shift.sellerId !== session.userId
        && !(session.role === 'coordinator' && shift.coordinatorId === session.userId)) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Acceso no autorizado: No podés consultar ventas de una jornada perteneciente a otro vendedor.'
      });
    }

    if (isDbConfigured()) {
      const sales = await saleRepository.getByShiftId(req.params.shiftId);
      return res.json({ success: true, count: sales.length, sales });
    } else {
      const sales = INITIAL_SALES.filter((s) => s.shiftId === req.params.shiftId);
      return res.json({ success: true, count: sales.length, sales });
    }
  } catch (error: any) {
    if (isDbConfigured()) {
      return res.status(503).json({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
        message: 'No se pudo consultar la operación central.'
      });
    }
    res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'No se pudo consultar la operación central.' });
  }
});

/** Selecciona sólo campos de venta de entrada; evidencia bancaria no se acepta aquí. */
function saleInput(body: any, generateMissing = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new DataIntegrityError('INVALID_SALE_DATA','Venta inválida.');
  const sale = { id: body.id ?? (generateMissing ? `TX-${randomUUID()}` : undefined),
    shiftId: body.shiftId, sellerId: body.sellerId, sellerName: body.sellerName,
    timestamp: body.timestamp ?? (generateMissing ? new Date().toISOString() : undefined),
    itemType: body.itemType,varietyId: body.varietyId,varietyName: body.varietyName,
    quantityUnitsEquivalent: body.quantityUnitsEquivalent,totalAmount: body.totalAmount,paymentMethod: body.paymentMethod,
    locationName: body.locationName,beachSector: body.beachSector,voucherPhotoUrl: body.voucherPhotoUrl,
    voucherExtractedData: body.voucherExtractedData,gpsLocation: body.gpsLocation,isOfflineCreated: body.isOfflineCreated,
    validationStatus: body.paymentMethod === 'efectivo' ? 'validada' : 'pendiente_revision' };
  assertOperationId(sale.id,'ID de venta'); assertOperationId(sale.shiftId,'Jornada');
  for (const value of [sale.locationName,sale.beachSector]) if (value !== undefined && (typeof value !== 'string' || value.length > 120)) throw new DataIntegrityError('INVALID_LOCATION','Ubicación inválida.');
  if (sale.voucherPhotoUrl !== undefined && (typeof sale.voucherPhotoUrl !== 'string' || sale.voucherPhotoUrl.length > 2000000)) throw new DataIntegrityError('INVALID_VOUCHER','Imagen de comprobante inválida o demasiado grande.');
  for (const value of [sale.voucherExtractedData,sale.gpsLocation]) if (value !== undefined && value !== null && (typeof value !== 'object' || Array.isArray(value) || JSON.stringify(value).length > 10000)) throw new DataIntegrityError('INVALID_EVIDENCE','Datos de comprobante o ubicación inválidos.');
  return sale as import('../../types').SaleTransaction;
}

dbRouter.post('/sales', authenticateToken, requireRole('seller','coordinator','admin'), requireDb, async (req: Request,res: Response) => {
  try {
    const sale = await saleRepository.createSale(saleInput(req.body,true),req.userSession!);
    res.status(201).json({ success: true, sale, acknowledgedIds: [sale.id] });
  } catch (error) { operationError(res,error); }
});

dbRouter.post('/sales/sync-batch', authenticateToken, requireRole('seller','coordinator','admin'), requireDb, async (req: Request,res: Response) => {
  try {
    if (!Array.isArray(req.body?.sales) || req.body.sales.length > 500) throw new DataIntegrityError('INVALID_BATCH','El lote debe contener hasta 500 ventas.');
    const sales = req.body.sales.map((sale: unknown) => saleInput(sale));
    const result = await saleRepository.syncBatch(sales,req.userSession!);
    res.json({ success: true, ...result });
  } catch (error) { operationError(res,error); }
});

// Ruta e identidad del registro siempre deben referirse a la misma jornada.
dbRouter.post('/shifts/:id/waste', authenticateToken, requireRole('coordinator','admin'), requireDb, async (req: Request,res: Response) => {
  try {
    assertOperationId(req.params.id,'Jornada');
    if (req.body?.shiftId !== req.params.id) throw new DataIntegrityError('SHIFT_PATH_MISMATCH','La jornada del registro no coincide con la ruta.');
    const record = await stockRepository.recordWaste(req.body,req.userSession!);
    const shift = await shiftRepository.getById(req.params.id);
    res.status(201).json({ success: true, record, shift });
  } catch (error) { operationError(res,error); }
});

dbRouter.post('/shifts/:id/restock', authenticateToken, requireRole('coordinator','admin'), requireDb, async (req: Request,res: Response) => {
  try {
    assertOperationId(req.params.id,'Jornada');
    const records = req.body?.records ?? [req.body];
    if (!Array.isArray(records) || records.some((record: any) => !record || record.shiftId !== req.params.id)) throw new DataIntegrityError('SHIFT_PATH_MISMATCH','La reposición no corresponde a la ruta.');
    const persisted = await stockRepository.recordRestockBatch(records,req.userSession!);
    const shift = await shiftRepository.getById(req.params.id);
    res.status(201).json({ success: true, records: persisted, record: persisted[0], shift });
  } catch (error) { operationError(res,error); }
});
