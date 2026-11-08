/** Estado central autorizado para un dispositivo. Nunca devuelve datos demo ante una caída de PostgreSQL. */
import { Router } from 'express';
import { authenticateToken } from '../auth/authMiddleware.js';
import { isIsolatedDemoEnabled } from '../auth/authPolicy.js';
import { publicProfile } from '../auth/publicProfile.js';
import { isDbConfigured } from '../db/connection.js';
import { userRepository } from '../db/repositories/UserRepository.js';
import { shiftRepository } from '../db/repositories/ShiftRepository.js';
import { saleRepository } from '../db/repositories/SaleRepository.js';
import { configurationRepository } from '../db/repositories/ConfigurationRepository.js';
import { productionRepository } from '../db/repositories/ProductionRepository.js';
import { emptyFactoryState } from '../../shared/factoryState.js';
import * as initial from '../../mockData.js';

export const bootstrapRouter = Router();
bootstrapRouter.get('/bootstrap', authenticateToken, async (req, res) => {
  const session = req.userSession!;
  try {
    const configured = isDbConfigured();
    if (!configured && !isIsolatedDemoEnabled()) {
      return res.status(503).json({ success: false, code: 'DATABASE_REQUIRED', message: 'Se necesita la base central para cargar la operación.' });
    }
    const current = configured ? await userRepository.getById(session.userId) : initial.INITIAL_USERS.find((user) => user.id === session.userId);
    if (!current || !current.isActive || current.role !== session.role) return res.status(401).json({ success: false, message: 'Sesión inválida.' });
    const catalog = configured ? await configurationRepository.getBootstrapCatalog() : {
      houses: initial.INITIAL_HOUSES, carts: initial.INITIAL_CARTS, varieties: initial.INITIAL_VARIETIES,
      zones: initial.INITIAL_ZONES, systemConfig: initial.INITIAL_SYSTEM_CONFIG
    };
    const production = configured ? await productionRepository.snapshot(['admin','factory_worker'].includes(current.role),current.role==='coordinator') : {factory:emptyFactoryState(),houseStock:[],centralStock:[]};
    if(configured) catalog.houses = catalog.houses.map(house=>({...house,currentStock:production.houseStock.filter(entry=>entry.houseId===house.id).map(({houseId,...entry})=>entry)}));
    const allShifts = configured ? await shiftRepository.getAll() : initial.INITIAL_SHIFTS;
    const shifts = allShifts.filter((shift) => current.role === 'admin'
      || (current.role === 'coordinator' && (shift.coordinatorId === current.id || shift.sellerId === current.id))
      || (current.role === 'seller' && shift.sellerId === current.id));
    const shiftIds = new Set(shifts.map((shift) => shift.id));
    const allSales = configured ? await saleRepository.getAll() : initial.INITIAL_SALES;
    const users = ['admin', 'coordinator'].includes(current.role)
      ? (configured ? await userRepository.getAll() : initial.INITIAL_USERS).filter((user) => current.role === 'admin'
        || user.id === current.id || (current.assignedHouseId && user.assignedHouseId === current.assignedHouseId))
      : [current];
    const allowedHouses = new Set([current.assignedHouseId, ...shifts.flatMap((shift) => [shift.houseId,shift.returnHouseId])].filter(Boolean));
    const houses = ['admin','coordinator','factory_worker'].includes(current.role) ? catalog.houses : catalog.houses.filter((house) => allowedHouses.has(house.id));
    const houseIds = new Set(houses.map((house) => house.id));
    const state = {
      users: users.map(publicProfile), shifts,
      sales: allSales.filter((sale) => current.role === 'admin' || shiftIds.has(sale.shiftId)),
      ...catalog, houses, centralStock:production.centralStock,
      carts: current.role === 'admin' ? catalog.carts : catalog.carts.filter((cart) => !cart.houseId || current.role === 'coordinator' || houseIds.has(cart.houseId) || cart.currentSellerId === current.id),
      ...production.factory, incidents: [], expenses: [], alerts: [], auditLogs: [], beachReports: []
    };
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, configured, demoMode: !configured, currentUser: publicProfile(current), state });
  } catch {
    return res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'No se pudo cargar la operación central. Tus ventas pendientes permanecen en el dispositivo.' });
  }
});
