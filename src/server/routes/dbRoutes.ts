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
  stockRepository
} from '../db';
import { authenticateToken, requireRole } from '../auth/authMiddleware';

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
// GET /shifts: Admin y coordinador ven todas; vendedor puede ver su historial
dbRouter.get('/shifts', authenticateToken, requireDb, async (req: Request, res: Response) => {
  try {
    const session = req.userSession!;
    if (session.role === 'seller') {
      // Vendedor: sólo su jornada activa o relacionada
      const shift = await shiftRepository.getActiveForUser(session.userId);
      return res.json({ success: true, count: shift ? 1 : 0, shifts: shift ? [shift] : [] });
    }
    const shifts = await shiftRepository.getAll();
    res.json({ success: true, count: shifts.length, shifts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /shifts/active/:userId: Usuario autenticado (él mismo o admin/coord)
dbRouter.get('/shifts/active/:userId', authenticateToken, requireDb, async (req: Request, res: Response) => {
  try {
    const session = req.userSession!;
    if (session.role === 'seller' && session.userId !== req.params.userId) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'No podés ver la jornada de otro vendedor.' });
    }
    const shift = await shiftRepository.getActiveForUser(req.params.userId);
    res.json({ success: true, shift });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /shifts/:id: Ver detalle de jornada
dbRouter.get('/shifts/:id', authenticateToken, requireDb, async (req: Request, res: Response) => {
  try {
    const shift = await shiftRepository.getById(req.params.id);
    if (!shift) {
      return res.status(404).json({ success: false, message: 'Jornada no encontrada' });
    }
    const session = req.userSession!;
    if (session.role === 'seller' && shift.sellerId !== session.userId) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Acceso no autorizado a esta jornada.' });
    }
    res.json({ success: true, shift });
  } catch (error: any) {
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
// GET /sales: Admin y coordinador
dbRouter.get('/sales', authenticateToken, requireRole('admin', 'coordinator'), requireDb, async (req: Request, res: Response) => {
  try {
    const sales = await saleRepository.getAll();
    res.json({ success: true, count: sales.length, sales });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /sales/shift/:shiftId: Ver ventas de una jornada
dbRouter.get('/sales/shift/:shiftId', authenticateToken, requireDb, async (req: Request, res: Response) => {
  try {
    const sales = await saleRepository.getByShiftId(req.params.shiftId);
    res.json({ success: true, count: sales.length, sales });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /sales: Registrar venta individual (vendedor, coord o admin)
dbRouter.post('/sales', authenticateToken, requireRole('seller', 'coordinator', 'admin'), requireDb, async (req: Request, res: Response) => {
  try {
    const created = await saleRepository.createSale(req.body);
    res.status(201).json({ success: true, sale: created });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /sales/sync-batch: Sincronización masiva de lote de ventas offline
dbRouter.post('/sales/sync-batch', authenticateToken, requireRole('seller', 'coordinator', 'admin'), requireDb, async (req: Request, res: Response) => {
  try {
    const { sales } = req.body;
    if (!Array.isArray(sales)) {
      return res.status(400).json({ success: false, message: 'El campo "sales" debe ser un array' });
    }
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
