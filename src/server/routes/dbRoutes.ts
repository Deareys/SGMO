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
} from '../db';
import { authenticateToken, requireRole } from '../auth/authMiddleware';
import { INITIAL_SHIFTS, INITIAL_SALES } from '../../mockData';

export const dbRouter = Router();

// 1. Estado y Salud de la Base de Datos (Público para diagnóstico del cliente)
dbRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await getDatabaseStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({
      status: 'DATABASE CONFIGURED',
      configured: true,
      provider: 'PostgreSQL',
      message: `Error al consultar estado: ${error.message}`
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// Middleware de verificación de configuración de DB para rutas de persistencia
const requireDb = (req: Request, res: Response, next: any) => {
  if (!isDbConfigured()) {
    return res.status(503).json({
      success: false,
      dbConfigured: false,
      code: 'DATABASE_NOT_CONFIGURED',
      message: 'DATABASE NOT CONFIGURED: PostgreSQL no está conectado. Utilizando persistencia local de contingencia.'
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
  const fallback = INITIAL_SHIFTS.find((s) => s.id === shiftId);
  return fallback || null;
}

// 3. Gestión de Usuarios (Requiere Autenticación y Autorización)
// GET /users: Accesible por admin y coordinator
dbRouter.get('/users', authenticateToken, requireRole('admin', 'coordinator'), requireDb, async (req: Request, res: Response) => {
  try {
    const users = await userRepository.getAll();
    res.json({ success: true, count: users.length, users });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /users: Sólo admin puede crear usuarios
dbRouter.post('/users', authenticateToken, requireRole('admin'), requireDb, async (req: Request, res: Response) => {
  try {
    const created = await userRepository.create(req.body);
    res.status(201).json({ success: true, user: created });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /users/:id: Sólo admin puede modificar usuarios
dbRouter.put('/users/:id', authenticateToken, requireRole('admin'), requireDb, async (req: Request, res: Response) => {
  try {
    await userRepository.update(req.params.id, req.body);
    res.json({ success: true, message: 'Usuario actualizado' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Jornadas (Daily Shifts)
// GET /shifts: Admin y coordinador ven todas; vendedor puede ver su historial; factory_worker denegado
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
      const shifts = await shiftRepository.getAll();
      return res.json({ success: true, count: shifts.length, shifts });
    }
    return res.json({ success: true, count: INITIAL_SHIFTS.length, shifts: INITIAL_SHIFTS });
  } catch (error: any) {
    if (isDbConfigured()) {
      return res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
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
      return res.json({ success: true, shift });
    }
    const shift = INITIAL_SHIFTS.find((s) => s.sellerId === req.params.userId && s.status === 'en_curso') || null;
    res.json({ success: true, shift });
  } catch (error: any) {
    if (isDbConfigured()) {
      return res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
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

    if (session.role === 'seller' && shift.sellerId !== session.userId) {
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
        message: `Error al consultar la base central: ${error.message}`
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /shifts: Iniciar jornada (coordinador o admin)
dbRouter.post('/shifts', authenticateToken, requireRole('admin', 'coordinator'), requireDb, async (req: Request, res: Response) => {
  try {
    const created = await shiftRepository.createShift(req.body);
    res.status(201).json({ success: true, shift: created });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /shifts/:id/close: Cierre de jornada y arqueo (coordinador o admin)
dbRouter.put('/shifts/:id/close', authenticateToken, requireRole('admin', 'coordinator'), requireDb, async (req: Request, res: Response) => {
  try {
    await shiftRepository.closeAndReconcileShift(req.params.id, req.body);
    res.json({ success: true, message: 'Jornada conciliada y cerrada en PostgreSQL' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Transacciones de Venta
// GET /sales: Admin y coordinador exclusivamente
dbRouter.get('/sales', authenticateToken, requireRole('admin', 'coordinator'), requireDb, async (req: Request, res: Response) => {
  try {
    const sales = await saleRepository.getAll();
    res.json({ success: true, count: sales.length, sales });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
    if (session.role === 'seller' && shift.sellerId !== session.userId) {
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
        message: `Error al consultar la base central: ${error.message}`
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /sales: Registrar venta individual (vendedor, coord o admin; factory_worker rechazado)
dbRouter.post('/sales', authenticateToken, requireRole('seller', 'coordinator', 'admin'), async (req: Request, res: Response, next) => {
  try {
    const session = req.userSession!;
    const saleData = req.body;

    if (!saleData || typeof saleData !== 'object') {
      return res.status(400).json({ success: false, message: 'Datos de venta inválidos' });
    }

    // 1. Control de recurso SEC-02 para vendedores:
    if (session.role === 'seller') {
      // Si el cliente declara un sellerId diferente al del token, rechazar con 403
      if (saleData.sellerId && saleData.sellerId !== session.userId) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Violación de seguridad: No podés registrar ventas atribuidas a otro vendedor.'
        });
      }

      // Comprobar que la jornada exista y pertenezca al vendedor autenticado
      if (!saleData.shiftId) {
        return res.status(400).json({ success: false, message: 'Se requiere shiftId para registrar la venta' });
      }

      const shift = await resolveShift(saleData.shiftId);
      if (!shift) {
        return res.status(404).json({ success: false, message: 'La jornada asignada a la venta no existe' });
      }

      if (shift.sellerId !== session.userId) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Violación de seguridad: No podés registrar ventas en una jornada que pertenece a otro vendedor.'
        });
      }

      if (shift.status !== 'en_curso') {
        return res.status(400).json({
          success: false,
          code: 'SHIFT_NOT_ACTIVE',
          message: `La jornada no está activa (estado actual: ${shift.status}). No se pueden registrar ventas.`
        });
      }

      // Derivar de forma canónica la identidad del vendedor desde la sesión del servidor
      saleData.sellerId = session.userId;
      saleData.sellerName = session.userName;
    } else {
      if (saleData.shiftId) {
        const shift = await resolveShift(saleData.shiftId);
        if (!shift) {
          return res.status(404).json({ success: false, message: 'La jornada asignada a la venta no existe' });
        }
      }
    }

    // 2. Validación de integridad de datos, catálogo, unidades y precios oficiales (Fase 3.2)
    const integrityCheck = await validateSaleIntegrity(saleData);
    if (!integrityCheck.isValid) {
      return res.status(400).json({
        success: false,
        code: integrityCheck.code || 'INVALID_SALE_DATA',
        message: integrityCheck.error
      });
    }

    // Asegurar ID y timestamp
    if (!saleData.id) {
      saleData.id = `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
    if (!saleData.timestamp) {
      saleData.timestamp = new Date().toISOString();
    }

    next();
  } catch (error: any) {
    if (isDbConfigured()) {
      return res.status(503).json({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
        message: `Error al validar la venta contra la base central: ${error.message}`
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
}, requireDb, async (req: Request, res: Response) => {
  try {
    const created = await saleRepository.createSale(req.body);
    res.status(201).json({ success: true, sale: created });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /sales/sync-batch: Sincronización masiva de lote de ventas offline
dbRouter.post('/sales/sync-batch', authenticateToken, requireRole('seller', 'coordinator', 'admin'), async (req: Request, res: Response, next) => {
  try {
    const session = req.userSession!;
    const { sales } = req.body;

    if (!Array.isArray(sales)) {
      return res.status(400).json({ success: false, message: 'El campo "sales" debe ser un array' });
    }

    if (sales.length === 0) {
      return res.json({ success: true, message: 'Lote vacío: 0 insertadas, 0 actualizadas', inserted: 0, updated: 0 });
    }

    // Control de recurso SEC-02 e Integridad Económica (Fase 3.2):
    // Validar atómicamente todo el lote antes de cualquier inserción. Si una venta está adulterada, el lote se rechaza.
    for (let i = 0; i < sales.length; i++) {
      const item = sales[i];

      // 1. Verificación de pertenencia de vendedor
      if (session.role === 'seller') {
        if (item.sellerId && item.sellerId !== session.userId) {
          return res.status(403).json({
            success: false,
            code: 'FORBIDDEN',
            message: `Violación de seguridad en el lote (ítem #${i + 1}): Venta atribuida a otro vendedor (${item.sellerId}). Lote rechazado sin sincronizar.`
          });
        }

        if (!item.shiftId) {
          return res.status(400).json({
            success: false,
            message: `Ítem #${i + 1} del lote no especifica shiftId.`
          });
        }

        const shift = await resolveShift(item.shiftId);
        if (!shift) {
          return res.status(404).json({
            success: false,
            message: `La jornada ${item.shiftId} del ítem #${i + 1} no existe.`
          });
        }

        if (shift.sellerId !== session.userId) {
          return res.status(403).json({
            success: false,
            code: 'FORBIDDEN',
            message: `Violación de seguridad en el lote (ítem #${i + 1}): La jornada ${item.shiftId} pertenece a otro vendedor.`
          });
        }

        // Forzar identidad canónica del servidor
        item.sellerId = session.userId;
        item.sellerName = session.userName;
      } else {
        if (item.shiftId) {
          const shift = await resolveShift(item.shiftId);
          if (!shift) {
            return res.status(404).json({
              success: false,
              message: `La jornada ${item.shiftId} del ítem #${i + 1} no existe.`
            });
          }
        }
      }

      // 2. Validación de integridad económica y catálogo (Fase 3.2):
      const integrityCheck = await validateSaleIntegrity(item);
      if (!integrityCheck.isValid) {
        return res.status(400).json({
          success: false,
          code: integrityCheck.code || 'BATCH_VALIDATION_ERROR',
          itemIndex: i,
          saleId: item.id,
          message: `Rechazo atómico de lote (ítem #${i + 1}): ${integrityCheck.error}`
        });
      }
    }

    next();
  } catch (error: any) {
    if (isDbConfigured()) {
      return res.status(503).json({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
        message: `Error al validar el lote contra la base central: ${error.message}`
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
}, requireDb, async (req: Request, res: Response) => {
  try {
    const { sales } = req.body;
    const result = await saleRepository.syncBatch(sales);
    res.json({
      success: true,
      message: `Lote sincronizado: ${result.inserted} insertadas, ${result.updated} actualizadas`,
      ...result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Mermas y Reposiciones de Stock (Coordinador o Admin)
dbRouter.post('/shifts/:id/waste', authenticateToken, requireRole('coordinator', 'admin'), requireDb, async (req: Request, res: Response) => {
  try {
    const record = await stockRepository.recordWaste(req.body);
    res.status(201).json({ success: true, record });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

dbRouter.post('/shifts/:id/restock', authenticateToken, requireRole('coordinator', 'admin'), requireDb, async (req: Request, res: Response) => {
  try {
    const record = await stockRepository.recordRestock(req.body);
    res.status(201).json({ success: true, record });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
