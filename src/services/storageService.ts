/**
 * SGMO — Tequeños Costa
 * Servicio de Estado, Almacenamiento Local y Lógica Operativa Central
 */

import {
  UserProfile,
  ProductVariety,
  RawMaterial,
  SupplyCategory,
  Supplier,
  ProductionRecipe,
  ProductionOrder,
  FactoryIncident,
  MaterialPurchase,
  ProductionBatch,
  OperationalHouse,
  SellingCart,
  CartIncident,
  BeachZone,
  DailyShift,
  SaleTransaction,
  OperationalExpense,
  OperationalAlert,
  AuditLog,
  StockTransfer,
  ShiftStockItem,
  ShiftRestockRecord,
  ShiftWasteRecord,
  WasteReason,
  VoucherValidationStatus,
  UserRole,
  CommissionTier,
  SystemConfig
} from '../types';

import {
  INITIAL_SYSTEM_CONFIG,
  INITIAL_COMMISSION_TIERS,
  INITIAL_SUPPLY_CATEGORIES,
  INITIAL_SUPPLIERS,
  INITIAL_USERS,
  INITIAL_VARIETIES,
  INITIAL_RAW_MATERIALS,
  INITIAL_RECIPES,
  INITIAL_PRODUCTION_ORDERS,
  INITIAL_FACTORY_INCIDENTS,
  INITIAL_PRODUCTION_BATCHES,
  INITIAL_HOUSES,
  INITIAL_ZONES,
  INITIAL_CARTS,
  INITIAL_INCIDENTS,
  INITIAL_SHIFTS,
  INITIAL_SALES,
  INITIAL_EXPENSES,
  INITIAL_ALERTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_TRANSFERS
} from '../mockData';
import { calculateCommissionForSales } from '../utils/commissionUtils';

const STORAGE_KEY = 'SGMO_TEQUENOS_COSTA_V2';
const OFFLINE_QUEUE_KEY = 'SGMO_OFFLINE_SALES_QUEUE';

export interface AppState {
  currentUser: UserProfile | null;
  selectedHouseId: string;
  isOnline: boolean;
  systemConfig: SystemConfig;
  supplyCategories: SupplyCategory[];
  suppliers: Supplier[];
  users: UserProfile[];
  varieties: ProductVariety[];
  rawMaterials: RawMaterial[];
  recipes: ProductionRecipe[];
  productionOrders: ProductionOrder[];
  factoryIncidents: FactoryIncident[];
  materialPurchases: MaterialPurchase[];
  productionBatches: ProductionBatch[];
  houses: OperationalHouse[];
  zones: BeachZone[];
  carts: SellingCart[];
  incidents: CartIncident[];
  shifts: DailyShift[];
  sales: SaleTransaction[];
  expenses: OperationalExpense[];
  alerts: OperationalAlert[];
  auditLogs: AuditLog[];
  transfers: StockTransfer[];
}

type Listener = (state: AppState) => void;

class StorageService {
  private state: AppState;
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.state = this.loadInitialState();
    
    // Escuchar eventos de red en navegador
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
    }
  }

  private loadInitialState(): AppState {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          
          // Sincronizar PINs específicos de cada usuario para pruebas
          const syncedUsers = (parsed.users || INITIAL_USERS).map((u: any) => {
            const initialMatch = INITIAL_USERS.find((iu) => iu.id === u.id);
            if (initialMatch && (!u.pin || (u.pin === '1234' && initialMatch.pin !== '1234'))) {
              return { ...u, pin: initialMatch.pin };
            }
            return u;
          });

          // Asegurar que las jornadas activas de todos los vendedores estén disponibles
          const storedShifts = parsed.shifts || [];
          const existingShiftIds = new Set(storedShifts.map((s: any) => s.id));
          const syncedShifts = [
            ...storedShifts,
            ...INITIAL_SHIFTS.filter((s) => !existingShiftIds.has(s.id))
          ];

          // Asegurar que las bases operativas tengan siempre currentStock, consumablesStock, coordinatorIds y residentUserIds definidos
          const syncedHouses = (parsed.houses || INITIAL_HOUSES).map((h: any) => ({
            ...h,
            coordinatorIds: Array.isArray(h.coordinatorIds) ? h.coordinatorIds : [],
            residentUserIds: Array.isArray(h.residentUserIds) ? h.residentUserIds : [],
            currentStock: h.currentStock || [],
            consumablesStock: h.consumablesStock || {
              gasTanksAvailable: 4,
              gasTanksInUse: 2,
              napkinPacks: 20,
              traysCount: 30,
              paperConesCount: 300,
              sauceBottlesCount: 15
            }
          }));

          // Asegurar que los carritos tengan suppliesLevel y gasLevelPercent definidos
          const syncedCarts = (parsed.carts || INITIAL_CARTS).map((c: any) => ({
            ...c,
            gasLevelPercent: c.gasLevelPercent ?? 100,
            suppliesLevel: c.suppliesLevel || {
              napkins: 'alto',
              cones: 'alto',
              trays: 'alto',
              sauces: 'alto'
            },
            totalDaysInUse: c.totalDaysInUse ?? 0,
            lastMaintenanceDate: c.lastMaintenanceDate || new Date().toISOString().slice(0, 10)
          }));

          return {
            ...parsed,
            currentUser: null, // Siempre requerir autenticación por PIN al iniciar la aplicación
            users: syncedUsers,
            shifts: syncedShifts,
            houses: syncedHouses,
            carts: syncedCarts,
            isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
            // Fallback for new properties if migrating from previous key
            systemConfig: {
              ...INITIAL_SYSTEM_CONFIG,
              ...(parsed.systemConfig || {}),
              commissionTiers:
                parsed.systemConfig?.commissionTiers && parsed.systemConfig.commissionTiers.length > 0
                  ? parsed.systemConfig.commissionTiers
                  : INITIAL_COMMISSION_TIERS
            },
            supplyCategories: parsed.supplyCategories || INITIAL_SUPPLY_CATEGORIES,
            suppliers: parsed.suppliers || INITIAL_SUPPLIERS,
            recipes: parsed.recipes || INITIAL_RECIPES,
            productionOrders: parsed.productionOrders || INITIAL_PRODUCTION_ORDERS,
            factoryIncidents: parsed.factoryIncidents || INITIAL_FACTORY_INCIDENTS
          };
        } catch (e) {
          console.error('Error parseando almacenamiento local, cargando semillas iniciales', e);
        }
      }
    }

    return {
      currentUser: null, // Inicio en pantalla de login PIN
      selectedHouseId: 'HOUSE-NORTE',
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      systemConfig: INITIAL_SYSTEM_CONFIG,
      supplyCategories: INITIAL_SUPPLY_CATEGORIES,
      suppliers: INITIAL_SUPPLIERS,
      users: INITIAL_USERS,
      varieties: INITIAL_VARIETIES,
      rawMaterials: INITIAL_RAW_MATERIALS,
      recipes: INITIAL_RECIPES,
      productionOrders: INITIAL_PRODUCTION_ORDERS,
      factoryIncidents: INITIAL_FACTORY_INCIDENTS,
      materialPurchases: [],
      productionBatches: INITIAL_PRODUCTION_BATCHES,
      houses: INITIAL_HOUSES,
      zones: INITIAL_ZONES,
      carts: INITIAL_CARTS,
      incidents: INITIAL_INCIDENTS,
      shifts: INITIAL_SHIFTS,
      sales: INITIAL_SALES,
      expenses: INITIAL_EXPENSES,
      alerts: INITIAL_ALERTS,
      auditLogs: INITIAL_AUDIT_LOGS,
      transfers: INITIAL_TRANSFERS
    };
  }

  private saveState(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (e) {
        console.error('Error guardando en localStorage', e);
      }
    }
    this.notify();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }

  public getState(): AppState {
    return this.state;
  }

  // --- Inicio y Cierre de Sesión por PIN Personal ---
  public loginWithPin(pin: string): { success: boolean; user?: UserProfile; error?: string } {
    if (!pin || pin.length !== 4) {
      return { success: false, error: 'El PIN debe contener exactamente 4 dígitos.' };
    }

    const user = this.state.users.find((u) => u.pin === pin && u.isActive !== false);
    if (!user) {
      return { success: false, error: 'PIN incorrecto o cuenta inactiva. Acceso denegado.' };
    }

    this.state.currentUser = user;
    if (user.assignedHouseId) {
      this.state.selectedHouseId = user.assignedHouseId;
    }
    this.addAuditLog('LOGIN_USUARIO', 'usuarios', user.id, `Inicio de sesión exitoso de ${user.name} (${user.role}) mediante PIN`);
    this.saveState();
    return { success: true, user };
  }

  public logout(): void {
    if (this.state.currentUser) {
      this.addAuditLog('LOGOUT_USUARIO', 'usuarios', this.state.currentUser.id, `Cierre de sesión de ${this.state.currentUser.name}`);
    }
    this.state.currentUser = null;
    this.saveState();
  }

  public setSelectedHouse(houseId: string): void {
    this.state.selectedHouseId = houseId;
    this.saveState();
  }

  private handleNetworkChange(online: boolean): void {
    this.state.isOnline = online;
    if (online) {
      this.flushOfflineQueue();
    }
    this.saveState();
  }

  // --- Logs de Auditoría ---
  public addAuditLog(
    action: string,
    entityType: AuditLog['entityType'],
    entityId: string,
    details: string,
    previousValue?: string,
    newValue?: string
  ): void {
    const newLog: AuditLog = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      userId: this.state.currentUser?.id || 'USR-SISTEMA',
      userName: this.state.currentUser?.name || 'Sistema',
      userRole: this.state.currentUser?.role || 'admin',
      action,
      entityType,
      entityId,
      details,
      previousValue,
      newValue
    };
    this.state.auditLogs = [newLog, ...this.state.auditLogs];
  }

  // --- 1. Gestión de Materias Primas y Producción ---
  public addMaterialPurchase(data: Omit<MaterialPurchase, 'id' | 'registeredBy'>): void {
    const id = `PUR-${Date.now()}`;
    const purchase: MaterialPurchase = {
      ...data,
      id,
      registeredBy: this.state.currentUser?.name || 'Administración'
    };

    // Actualizar stock del insumo y costo unitario
    const material = this.state.rawMaterials.find((m) => m.id === data.materialId);
    if (material) {
      material.currentStock += data.quantity;
      material.costPerUnit = data.unitCost;
      material.lastPurchaseDate = data.date;
      material.supplier = data.supplier;
    }

    this.state.materialPurchases = [purchase, ...this.state.materialPurchases];
    this.addAuditLog(
      'COMPRA_MATERIA_PRIMA',
      'produccion',
      id,
      `Compra de ${data.quantity} ${material?.unit || 'u'} de ${data.materialName} a $${data.totalCost}`
    );
    this.saveState();
  }

  public registerProductionBatch(batchData: {
    varietyId: string;
    unitsProduced: number;
    laborCost: number;
    energyAndPackagingCost: number;
    ingredientsUsed: { materialId: string; quantity: number }[];
    notes?: string;
  }): ProductionBatch {
    const variety = this.state.varieties.find((v) => v.id === batchData.varietyId);
    const varietyName = variety ? variety.name : 'Tequeño';

    // Descontar materias primas y calcular costo de ingredientes
    let ingredientsCost = 0;
    const detailedIngredients = batchData.ingredientsUsed.map((ing) => {
      const mat = this.state.rawMaterials.find((m) => m.id === ing.materialId);
      const cost = (mat ? mat.costPerUnit : 0) * ing.quantity;
      ingredientsCost += cost;
      if (mat) {
        mat.currentStock = Math.max(0, mat.currentStock - ing.quantity);
      }
      return {
        materialId: ing.materialId,
        materialName: mat ? mat.name : 'Insumo',
        quantity: ing.quantity,
        cost
      };
    });

    const totalBatchCost = ingredientsCost + batchData.laborCost + batchData.energyAndPackagingCost;
    const unitCostCalculated = Number((totalBatchCost / (batchData.unitsProduced || 1)).toFixed(2));

    const id = `LOT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(this.state.productionBatches.length + 1).padStart(2, '0')}`;

    const newBatch: ProductionBatch = {
      id,
      date: new Date().toISOString().slice(0, 10),
      varietyId: batchData.varietyId,
      varietyName,
      unitsProduced: batchData.unitsProduced,
      ingredientsUsed: detailedIngredients,
      laborCost: batchData.laborCost,
      energyAndPackagingCost: batchData.energyAndPackagingCost,
      totalBatchCost,
      unitCostCalculated,
      status: 'en_camara_central',
      remainingUnitsInCentral: batchData.unitsProduced,
      notes: batchData.notes
    };

    this.state.productionBatches = [newBatch, ...this.state.productionBatches];
    this.addAuditLog(
      'NUEVO_LOTE_PRODUCCION',
      'produccion',
      id,
      `Producción de ${batchData.unitsProduced} unidades de ${varietyName}. Costo unitario calculado: $${unitCostCalculated}`
    );
    this.saveState();
    return newBatch;
  }

  // --- 2. Traslado a Casas / Bases Operativas ---
  public transferToHouse(toHouseId: string, items: { varietyId: string; quantity: number }[], notes?: string): StockTransfer {
    const house = this.state.houses.find((h) => h.id === toHouseId);
    const toHouseName = house ? house.name : 'Base Operativa';

    const transferItems = items.map((it) => {
      const variety = this.state.varieties.find((v) => v.id === it.varietyId);
      return {
        varietyId: it.varietyId,
        varietyName: variety ? variety.name : 'Tequeño',
        quantity: it.quantity
      };
    });

    // Descontar de lotes en cámara central
    items.forEach((item) => {
      let needed = item.quantity;
      for (const batch of this.state.productionBatches) {
        if (batch.varietyId === item.varietyId && batch.remainingUnitsInCentral > 0 && needed > 0) {
          const take = Math.min(batch.remainingUnitsInCentral, needed);
          batch.remainingUnitsInCentral -= take;
          needed -= take;
          if (batch.remainingUnitsInCentral === 0) {
            batch.status = 'distribuido';
          }
        }
      }

      // Sumar al stock de la casa destino
      if (house) {
        const stockEntry = house.currentStock.find((s) => s.varietyId === item.varietyId);
        if (stockEntry) {
          stockEntry.quantity += item.quantity;
        } else {
          const variety = this.state.varieties.find((v) => v.id === item.varietyId);
          house.currentStock.push({
            varietyId: item.varietyId,
            varietyName: variety ? variety.name : 'Tequeño',
            quantity: item.quantity
          });
        }
      }
    });

    const id = `TRF-${Date.now()}`;
    const transfer: StockTransfer = {
      id,
      date: new Date().toISOString().slice(0, 10),
      fromLocation: 'Camara Central',
      toHouseId,
      toHouseName,
      transferredBy: this.state.currentUser?.name || 'Coordinación',
      items: transferItems,
      status: 'recibido_conforme',
      notes
    };

    this.state.transfers = [transfer, ...this.state.transfers];
    this.addAuditLog(
      'TRASLADO_CENTRAL_A_CASA',
      'stock',
      id,
      `Traslado de mercadería hacia ${toHouseName}`
    );
    this.saveState();
    return transfer;
  }

  // --- 3. Planificación y Despacho Matutino (Check-out) ---
  public dispatchSellerShift(data: {
    sellerId: string;
    cartId: string;
    zoneId: string;
    houseId: string;
    stockToDeliver: { varietyId: string; quantity: number }[];
    gasPercentStart: number;
    napkinsDelivered: number;
    conesDelivered: number;
    saucesProvided: string[];
    notes?: string;
  }): DailyShift {
    // Regla de seguridad: El rol de vendedor no puede autoasignarse carro ni productos
    if (this.state.currentUser && this.state.currentUser.role === 'seller') {
      console.warn('Acceso denegado: El rol de vendedor no puede autoasignarse carro ni productos.');
      throw new Error('Solo el coordinador o el administrador pueden asignar carritos y despachar productos.');
    }

    const seller = this.state.users.find((u) => u.id === data.sellerId);
    const cart = this.state.carts.find((c) => c.id === data.cartId);
    const zone = this.state.zones.find((z) => z.id === data.zoneId);
    const house = this.state.houses.find((h) => h.id === data.houseId);

    const shiftId = `SHIFT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(this.state.shifts.length + 1).padStart(2, '0')}`;

    let totalUnits = 0;
    const stockItems: ShiftStockItem[] = data.stockToDeliver.map((item) => {
      const variety = this.state.varieties.find((v) => v.id === item.varietyId);
      totalUnits += item.quantity;

      // Descontar del congelador de la casa
      if (house) {
        const houseStock = house.currentStock.find((s) => s.varietyId === item.varietyId);
        if (houseStock) {
          houseStock.quantity = Math.max(0, houseStock.quantity - item.quantity);
        }
      }

      return {
        varietyId: item.varietyId,
        varietyName: variety ? variety.name : 'Tequeño',
        deliveredUnits: item.quantity,
        reSuppliedUnits: 0,
        soldUnits: 0,
        returnedUnits: 0,
        wasteUnits: 0,
        differenceUnits: 0
      };
    });

    // Actualizar carrito
    if (cart) {
      cart.currentSellerId = data.sellerId;
      cart.gasLevelPercent = data.gasPercentStart;
      cart.suppliesLevel = {
        napkins: data.napkinsDelivered > 3 ? 'alto' : 'medio',
        cones: data.conesDelivered > 50 ? 'alto' : 'medio',
        trays: 'alto',
        sauces: data.saucesProvided.length > 1 ? 'alto' : 'medio'
      };
    }

    const newShift: DailyShift = {
      id: shiftId,
      date: new Date().toISOString().slice(0, 10),
      houseId: data.houseId,
      houseName: house ? house.name : 'Base Operativa',
      coordinatorId: this.state.currentUser?.id || 'USR-COORD',
      coordinatorName: this.state.currentUser?.name || 'Coordinador',
      sellerId: data.sellerId,
      sellerName: seller ? seller.name : 'Vendedor',
      cartId: data.cartId,
      cartCode: cart ? cart.code : 'Carrito',
      zoneId: data.zoneId,
      zoneName: zone ? zone.name : 'Zona de Playa',
      status: 'en_curso',
      startTime: new Date().toTimeString().slice(0, 5),
      stockItems,
      suppliesProvided: {
        gasPercentStart: data.gasPercentStart,
        napkinsDelivered: data.napkinsDelivered,
        conesDelivered: data.conesDelivered,
        saucesProvided: data.saucesProvided
      },
      totalGrossSales: 0,
      totalCashSales: 0,
      totalMpSales: 0,
      cashExpected: 0,
      cashDeclared: 0,
      cashDifference: 0,
      mpValidatedAmount: 0,
      mpPendingOrSuspiciousAmount: 0,
      totalUnitsDelivered: totalUnits,
      totalUnitsSold: 0,
      totalUnitsReturned: 0,
      totalUnitsDifference: 0,
      commissionRate: seller ? (this.state.systemConfig?.commissionTiers?.[0]?.rate ?? seller.commissionRate) : 0.10,
      appliedCommissionTierId: this.state.systemConfig?.commissionTiers?.[0]?.id,
      appliedCommissionTierName: this.state.systemConfig?.commissionTiers?.[0]?.name,
      grossCommission: 0,
      housingCostDeduction: seller?.housingCostExempt ? 0 : (this.state.systemConfig?.housingCostPerPersonDaily || 8000),
      housingCostExempt: !!seller?.housingCostExempt,
      deductionsForMissingUnits: 0,
      incentivesOrBonuses: 0,
      finalPayoutAmount: 0,
      payoutStatus: 'pendiente',
      notes: data.notes
    };

    this.state.shifts = [newShift, ...this.state.shifts];
    this.addAuditLog(
      'CHECK_OUT_JORNADA',
      'jornada',
      shiftId,
      `Despacho a ${newShift.sellerName} en ${newShift.cartCode} con ${totalUnits} tequeños hacia ${newShift.zoneName}`
    );
    this.saveState();
    return newShift;
  }

  // --- 4. Registro de Ventas (Terminal Móvil / PWA) ---
  public registerSale(saleData: {
    shiftId: string;
    itemType: 'unidad' | 'combo3' | 'combo6' | 'combo12' | 'adicional';
    varietyId: string;
    quantityUnitsEquivalent: number;
    totalAmount: number;
    paymentMethod: 'efectivo' | 'mercado_pago';
    voucherPhotoUrl?: string;
    voucherExtractedData?: SaleTransaction['voucherExtractedData'];
    validationStatus?: VoucherValidationStatus;
    gpsLocation?: { lat: number; lng: number; zoneName?: string };
  }): SaleTransaction {
    const shift = this.state.shifts.find((s) => s.id === saleData.shiftId);
    const sellerId = shift ? shift.sellerId : (this.state.currentUser?.id || 'USR-SELLER');
    const sellerName = shift ? shift.sellerName : (this.state.currentUser?.name || 'Vendedor');
    const variety = this.state.varieties.find((v) => v.id === saleData.varietyId);
    const varietyName = variety ? variety.name : 'Tequeño';

    const saleId = `TX-${Date.now()}-${Math.floor(Math.random() * 100)}`;
    const isOnline = this.state.isOnline;

    const newSale: SaleTransaction = {
      id: saleId,
      shiftId: saleData.shiftId,
      sellerId,
      sellerName,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      itemType: saleData.itemType,
      varietyId: saleData.varietyId,
      varietyName,
      quantityUnitsEquivalent: saleData.quantityUnitsEquivalent,
      totalAmount: saleData.totalAmount,
      paymentMethod: saleData.paymentMethod,
      voucherPhotoUrl: saleData.voucherPhotoUrl,
      voucherExtractedData: saleData.voucherExtractedData,
      validationStatus: saleData.validationStatus || (saleData.paymentMethod === 'efectivo' ? 'validada' : 'pendiente_revision'),
      gpsLocation: saleData.gpsLocation,
      isOfflineCreated: !isOnline
    };

    // Si está offline, guardar en cola de sincronización local
    if (!isOnline) {
      this.enqueueOfflineSale(newSale);
    }

    // Actualizar ventas en la jornada
    if (shift) {
      shift.totalGrossSales += newSale.totalAmount;
      if (newSale.paymentMethod === 'efectivo') {
        shift.totalCashSales += newSale.totalAmount;
        shift.cashExpected += newSale.totalAmount;
      } else {
        shift.totalMpSales += newSale.totalAmount;
        if (newSale.validationStatus === 'validada') {
          shift.mpValidatedAmount += newSale.totalAmount;
        } else {
          shift.mpPendingOrSuspiciousAmount += newSale.totalAmount;
        }
      }

      shift.totalUnitsSold += newSale.quantityUnitsEquivalent;

      // Actualizar item específico de stock en la jornada
      const stockItem = shift.stockItems.find((s) => s.varietyId === newSale.varietyId);
      if (stockItem) {
        stockItem.soldUnits += newSale.quantityUnitsEquivalent;
      }

      // Recalcular comisión según los tramos configurados y ventas acumuladas
      const liveCommission = calculateCommissionForSales(
        shift.totalGrossSales,
        this.state.systemConfig?.commissionTiers || [],
        shift.commissionRate || 0.20
      );
      shift.commissionRate = liveCommission.rate;
      shift.appliedCommissionTierId = liveCommission.tier?.id;
      shift.appliedCommissionTierName = liveCommission.tierName;
      shift.grossCommission = liveCommission.grossCommission;
      shift.finalPayoutAmount = shift.grossCommission + shift.incentivesOrBonuses - shift.deductionsForMissingUnits;
    }

    this.state.sales = [newSale, ...this.state.sales];
    this.addAuditLog(
      'VENTA_REGISTRADA',
      'venta',
      saleId,
      `Venta de ${newSale.itemType} (${newSale.quantityUnitsEquivalent} u) por $${newSale.totalAmount} vía ${newSale.paymentMethod} (${sellerName})`
    );
    this.saveState();
    return newSale;
  }

  // --- Offline Queue Handling ---
  private enqueueOfflineSale(sale: SaleTransaction): void {
    if (typeof window === 'undefined') return;
    try {
      const existing = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
      existing.push(sale);
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(existing));
    } catch (e) {
      console.error('Error guardando en cola offline', e);
    }
  }

  public getOfflineQueueCount(): number {
    if (typeof window === 'undefined') return 0;
    try {
      const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
      return queue.length;
    } catch (e) {
      return 0;
    }
  }

  public flushOfflineQueue(): void {
    if (typeof window === 'undefined') return;
    try {
      const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
      if (queue.length > 0) {
        console.log(`Sincronizando ${queue.length} ventas locales pendientes con el servidor...`);
        localStorage.removeItem(OFFLINE_QUEUE_KEY);
        this.addAuditLog(
          'SINCRONIZACION_OFFLINE',
          'venta',
          'SYNC_BATCH',
          `Se sincronizaron automáticamente ${queue.length} ventas offline realizadas en la playa.`
        );
      }
    } catch (e) {
      console.error('Error sincronizando cola offline', e);
    }
  }

  // --- 5. Validación de Comprobantes MP ---
  public updateVoucherStatus(
    saleId: string,
    status: VoucherValidationStatus,
    extractedData?: SaleTransaction['voucherExtractedData'],
    mpVerification?: SaleTransaction['mpApiVerification']
  ): void {
    const sale = this.state.sales.find((s) => s.id === saleId);
    if (!sale) return;

    const previousStatus = sale.validationStatus;
    sale.validationStatus = status;
    if (extractedData) {
      sale.voucherExtractedData = { ...sale.voucherExtractedData, ...extractedData };
    }
    if (mpVerification) {
      sale.mpApiVerification = mpVerification;
    }

    // Actualizar resumen en la jornada
    const shift = this.state.shifts.find((s) => s.id === sale.shiftId);
    if (shift) {
      let validated = 0;
      let pending = 0;
      this.state.sales
        .filter((s) => s.shiftId === shift.id && s.paymentMethod === 'mercado_pago')
        .forEach((s) => {
          if (s.validationStatus === 'validada') {
            validated += s.totalAmount;
          } else {
            pending += s.totalAmount;
          }
        });
      shift.mpValidatedAmount = validated;
      shift.mpPendingOrSuspiciousAmount = pending;
    }

    this.addAuditLog(
      'VALIDACION_COMPROBANTE',
      'comprobante',
      saleId,
      `Estado de comprobante actualizado a: ${status} (Monto: $${sale.totalAmount})`,
      previousStatus,
      status
    );
    this.saveState();
  }

  // --- 6. Cierre de Jornada, Conciliación y Liquidación ---
  public closeAndReconcileShift(data: {
    shiftId: string;
    cashDeclared: number;
    gasPercentEnd: number;
    returnedItems: { varietyId: string; count: number; wasteCount: number }[];
    deductionMissingRatePerUnit?: number; // Costo por unidad faltante a descontar (ej: $1,500 o precio costo $300)
    bonusIncentive?: number;
    notes?: string;
    coordinatorSignature: string;
  }): DailyShift {
    const shift = this.state.shifts.find((s) => s.id === data.shiftId);
    if (!shift) throw new Error('Jornada no encontrada');

    const house = this.state.houses.find((h) => h.id === shift.houseId);
    const cart = this.state.carts.find((c) => c.id === shift.cartId);

    // Calcular diferencias de stock
    let totalReturned = 0;
    let totalWaste = 0;
    let totalDifferenceUnits = 0;

    shift.stockItems.forEach((item) => {
      const input = data.returnedItems.find((r) => r.varietyId === item.varietyId);
      const returned = input ? input.count : 0;
      // Considerar mermas cargadas durante la jornada si no se modificó en el input
      const waste = input && input.wasteCount !== undefined ? input.wasteCount : (item.wasteUnits || 0);

      item.returnedUnits = returned;
      item.wasteUnits = waste;

      // Diferencia = Entregados + Repuestos - Vendidos - Devueltos - Merma
      const diff = (item.deliveredUnits + item.reSuppliedUnits) - item.soldUnits - returned - waste;
      item.differenceUnits = diff;

      totalReturned += returned;
      totalWaste += waste;
      totalDifferenceUnits += diff;

      // Reingresar el stock devuelto al congelador de la casa
      if (house && returned > 0) {
        const houseStock = house.currentStock.find((s) => s.varietyId === item.varietyId);
        if (houseStock) {
          houseStock.quantity += returned;
        }
      }
    });

    // Actualizar datos del carrito al regresar a la base
    if (cart) {
      cart.gasLevelPercent = data.gasPercentEnd;
      cart.currentSellerId = undefined;
      cart.totalDaysInUse = (cart.totalDaysInUse || 0) + 1;
    }

    // Actualizar estados monetarios
    shift.status = 'conciliada';
    shift.endTime = new Date().toTimeString().slice(0, 5);
    if (!shift.suppliesProvided) {
      shift.suppliesProvided = {
        gasPercentStart: 100,
        napkinsDelivered: 5,
        conesDelivered: 50,
        saucesProvided: []
      };
    }
    shift.suppliesProvided.gasPercentEnd = data.gasPercentEnd;
    shift.cashDeclared = data.cashDeclared;
    shift.cashDifference = data.cashDeclared - shift.cashExpected;

    shift.totalUnitsReturned = totalReturned;
    shift.totalUnitsWaste = totalWaste;
    shift.totalUnitsDifference = totalDifferenceUnits;

    // Cálculo de deducciones por faltante si existe política
    const deductionRate = data.deductionMissingRatePerUnit || 0;
    const deductions = totalDifferenceUnits > 0 ? totalDifferenceUnits * deductionRate : 0;
    const bonus = data.bonusIncentive || 0;

    // Deducción de costo de vivienda por persona diaria (salvo exención)
    const seller = this.state.users.find((u) => u.id === shift.sellerId);
    const isExempt = !!seller?.housingCostExempt;
    const housingDeduction = isExempt ? 0 : (this.state.systemConfig?.housingCostPerPersonDaily || 8000);

    // Calcular comisión del vendedor según los tramos vigentes y el total de ventas acumulado en la jornada
    const commissionCalc = calculateCommissionForSales(
      shift.totalGrossSales,
      this.state.systemConfig?.commissionTiers || [],
      shift.commissionRate || 0.20
    );

    shift.deductionsForMissingUnits = deductions;
    shift.incentivesOrBonuses = bonus;
    shift.housingCostDeduction = housingDeduction;
    shift.housingCostExempt = isExempt;
    shift.commissionRate = commissionCalc.rate;
    shift.appliedCommissionTierId = commissionCalc.tier?.id;
    shift.appliedCommissionTierName = commissionCalc.tierName;
    shift.grossCommission = commissionCalc.grossCommission;
    shift.finalPayoutAmount = Math.max(0, shift.grossCommission + bonus - deductions - housingDeduction);
    shift.coordinatorSignature = data.coordinatorSignature;
    shift.notes = (shift.notes ? shift.notes + ' | ' : '') + (data.notes || 'Cierre registrado por ' + (this.state.currentUser?.name || 'Coordinación'));

    // Crear alerta si hay faltante de tequeños o de dinero
    if (totalDifferenceUnits > 0 || shift.cashDifference < 0) {
      this.state.alerts.unshift({
        id: `ALT-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        level: 'critica',
        title: `Diferencia en Cierre (${shift.sellerName})`,
        message: `Faltante de ${totalDifferenceUnits} tequeños y diferencia de caja de $${shift.cashDifference.toLocaleString()} en ${shift.cartCode}.`,
        category: 'diferencia_caja',
        relatedEntityId: shift.id,
        isRead: false,
        resolved: false
      });
    }

    this.addAuditLog(
      'CIERRE_CONCILIACION_JORNADA',
      'jornada',
      shift.id,
      `Cierre de jornada de ${shift.sellerName}: $${shift.totalGrossSales} ventas, devueltos ${totalReturned} u, ded. vivienda: $${housingDeduction.toLocaleString()}, liq. final: $${shift.finalPayoutAmount.toLocaleString()}`
    );

    this.saveState();
    return shift;
  }

  public paySellerCommission(shiftId: string, paymentProof: string): void {
    const shift = this.state.shifts.find((s) => s.id === shiftId);
    if (!shift) return;

    shift.status = 'liquidada';
    shift.payoutStatus = 'pagado';
    shift.payoutTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    shift.payoutPaymentProof = paymentProof;

    this.addAuditLog(
      'LIQUIDACION_PAGADA',
      'liquidacion',
      shift.id,
      `Pago de comisión a ${shift.sellerName} por $${shift.finalPayoutAmount.toLocaleString()} (${paymentProof})`
    );
    this.saveState();
  }

  // Helper para etiqueta legible de merma
  public getWasteReasonLabel(reason: string): string {
    const labels: Record<string, string> = {
      producto_danado: 'Producto dañado',
      producto_caido: 'Producto caído',
      producto_quemado: 'Producto quemado',
      producto_descongelado: 'Producto descongelado',
      producto_descartado: 'Producto descartado',
      otro: 'Otro motivo'
    };
    return labels[reason] || reason;
  }

  // Registro puntual de merma en jornada (roturas, caídas a arena, quemados, etc.)
  public recordShiftWaste(
    shiftId: string,
    varietyId: string,
    units: number,
    reason: string,
    notes?: string,
    customTimestamp?: string
  ): ShiftWasteRecord | undefined {
    const shift = this.state.shifts.find((s) => s.id === shiftId);
    if (!shift) return;

    const variety = this.state.varieties.find((v) => v.id === varietyId);
    const stockItem = shift.stockItems.find((s) => s.varietyId === varietyId);
    const varietyName = stockItem?.varietyName || variety?.name || 'Tequeño';

    if (stockItem) {
      stockItem.wasteUnits = (stockItem.wasteUnits || 0) + units;
      stockItem.differenceUnits = (stockItem.deliveredUnits + stockItem.reSuppliedUnits) - stockItem.soldUnits - stockItem.returnedUnits - stockItem.wasteUnits;
    }

    shift.totalUnitsWaste = (shift.totalUnitsWaste || 0) + units;

    const timestamp = customTimestamp || new Date().toISOString().replace('T', ' ').substring(0, 19);
    const reasonLabel = this.getWasteReasonLabel(reason);

    const wasteRecord: ShiftWasteRecord = {
      id: `WASTE-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      shiftId: shift.id,
      timestamp,
      sellerId: shift.sellerId,
      sellerName: shift.sellerName,
      varietyId,
      varietyName,
      quantity: units,
      reason,
      reasonLabel,
      notes
    };

    if (!shift.wasteRecords) {
      shift.wasteRecords = [];
    }
    shift.wasteRecords.unshift(wasteRecord);

    this.addAuditLog(
      'REGISTRO_MERMA',
      'stock',
      shiftId,
      `Merma de ${units} u de ${varietyName} registrada por ${this.state.currentUser?.name || shift.sellerName}. Motivo: ${reasonLabel}${notes ? ` (${notes})` : ''}`
    );
    this.saveState();
    return wasteRecord;
  }

  // Reabastecimiento / Entrega adicional durante la jornada (Restock)
  public addShiftRestock(data: {
    shiftId: string;
    items: { varietyId: string; quantity: number }[];
    originLocation?: string;
    destinationLocation?: string;
    notes?: string;
  }): { shift: DailyShift; restockRecords: ShiftRestockRecord[] } {
    // Seguridad: Solo el coordinador o administrador pueden realizar restock
    if (this.state.currentUser && this.state.currentUser.role === 'seller') {
      throw new Error('Solo el coordinador o el administrador pueden autorizar y entregar restocks.');
    }

    const shift = this.state.shifts.find((s) => s.id === data.shiftId);
    if (!shift) throw new Error('Jornada no encontrada');
    if (shift.status !== 'en_curso') {
      throw new Error('Solo se puede reabastecer una jornada activa en curso');
    }

    const validItems = data.items.filter((i) => i.quantity > 0);
    if (validItems.length === 0) {
      throw new Error('Debe especificar al menos una unidad para reabastecer');
    }

    const house = this.state.houses.find((h) => h.id === shift.houseId) || this.state.houses[0];
    const originLocation = data.originLocation || house?.name || 'Base Operativa';
    const destinationLocation = data.destinationLocation || `${shift.cartCode} — ${shift.zoneName} (${shift.sellerName})`;
    const coordinator = this.state.currentUser || { id: shift.coordinatorId, name: shift.coordinatorName };
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const createdRecords: ShiftRestockRecord[] = [];
    let totalRestockedInShift = 0;

    validItems.forEach((item, index) => {
      const variety = this.state.varieties.find((v) => v.id === item.varietyId);
      const varietyName = variety ? variety.name : 'Tequeño';

      // 1. Descontar del inventario del congelador de la casa de origen
      if (house) {
        const houseStock = house.currentStock.find((s) => s.varietyId === item.varietyId);
        if (houseStock) {
          houseStock.quantity = Math.max(0, houseStock.quantity - item.quantity);
        }
      }

      // 2. Sumar al stock de la jornada
      let stockItem = shift.stockItems.find((s) => s.varietyId === item.varietyId);
      if (stockItem) {
        stockItem.reSuppliedUnits = (stockItem.reSuppliedUnits || 0) + item.quantity;
      } else {
        stockItem = {
          varietyId: item.varietyId,
          varietyName,
          deliveredUnits: 0,
          reSuppliedUnits: item.quantity,
          soldUnits: 0,
          returnedUnits: 0,
          wasteUnits: 0,
          differenceUnits: 0
        };
        shift.stockItems.push(stockItem);
      }

      // Recalcular diferencia matemática
      stockItem.differenceUnits = (stockItem.deliveredUnits + stockItem.reSuppliedUnits) - stockItem.soldUnits - stockItem.returnedUnits - (stockItem.wasteUnits || 0);
      totalRestockedInShift += item.quantity;

      // 3. Crear registro histórico de entrega adicional
      const restockRecord: ShiftRestockRecord = {
        id: `RESTOCK-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
        shiftId: shift.id,
        timestamp,
        sellerId: shift.sellerId,
        sellerName: shift.sellerName,
        coordinatorId: coordinator.id,
        coordinatorName: coordinator.name,
        varietyId: item.varietyId,
        varietyName,
        quantity: item.quantity,
        originLocation,
        destinationLocation,
        notes: data.notes
      };

      createdRecords.push(restockRecord);
    });

    // 4. Actualizar totales consolidados de la jornada
    shift.totalUnitsDelivered += totalRestockedInShift;
    shift.totalUnitsRestocked = (shift.totalUnitsRestocked || 0) + totalRestockedInShift;

    if (!shift.restocks) {
      shift.restocks = [];
    }
    shift.restocks.unshift(...createdRecords);

    // 5. Registrar en auditoría
    const summaryItems = createdRecords.map((r) => `${r.quantity}u ${r.varietyName}`).join(', ');
    this.addAuditLog(
      'RESTOCK_JORNADA',
      'stock',
      shift.id,
      `Restock en jornada de ${shift.sellerName} (${shift.cartCode}): ${summaryItems} entregadas por ${coordinator.name}. De ${originLocation} hacia ${destinationLocation}.${data.notes ? ` Notas: ${data.notes}` : ''}`
    );

    this.saveState();
    return { shift, restockRecords: createdRecords };
  }

  // Registro de sobrantes devueltos a la base
  public recordShiftLeftovers(shiftId: string, returnedCounts: Record<string, number>): void {
    const shift = this.state.shifts.find((s) => s.id === shiftId);
    if (!shift) return;

    let totalReturned = 0;
    shift.stockItems.forEach((item) => {
      if (returnedCounts[item.varietyId] !== undefined) {
        item.returnedUnits = returnedCounts[item.varietyId];
      }
      item.differenceUnits = (item.deliveredUnits + item.reSuppliedUnits) - item.soldUnits - item.returnedUnits - item.wasteUnits;
      totalReturned += item.returnedUnits || 0;
    });
    shift.totalUnitsReturned = totalReturned;

    this.addAuditLog(
      'REGISTRO_SOBRANTES',
      'stock',
      shiftId,
      `Registro de sobrantes: ${totalReturned} unidades contabilizadas al cierre (${shift.sellerName}).`
    );
    this.saveState();
  }

  // --- 7. Reporte de Incidencias de Carritos e Insumos ---
  public reportCartIncident(incidentData: {
    cartId: string;
    type: CartIncident['type'];
    description: string;
  }): CartIncident {
    const id = `INC-${Date.now()}`;
    const incident: CartIncident = {
      id,
      date: new Date().toISOString().slice(0, 10),
      cartId: incidentData.cartId,
      reportedBy: this.state.currentUser?.name || 'Personal',
      type: incidentData.type,
      description: incidentData.description,
      status: 'reportado'
    };

    // Actualizar estado del carrito a en_revision
    const cart = this.state.carts.find((c) => c.id === incidentData.cartId);
    if (cart) {
      cart.status = 'en_revision';
    }

    this.state.incidents = [incident, ...this.state.incidents];
    
    this.state.alerts.unshift({
      id: `ALT-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      level: 'advertencia',
      title: `Incidencia en ${cart?.code || 'Carrito'}`,
      message: `${this.state.currentUser?.name || 'Vendedor'} reportó falla de tipo "${incidentData.type}": ${incidentData.description}`,
      category: 'mantenimiento',
      relatedEntityId: incident.id,
      isRead: false,
      resolved: false
    });

    this.addAuditLog(
      'REPORTE_INCIDENCIA_CARRITO',
      'carrito',
      incident.id,
      `Falla reportada en ${cart?.code}: ${incidentData.description}`
    );

    this.saveState();
    return incident;
  }

  public updateIncidentStatus(incidentId: string, status: CartIncident['status'], costOfRepair?: number, notes?: string): void {
    // Restricción: El vendedor no puede resolver, cerrar o modificar averías
    if (this.state.currentUser?.role === 'seller') {
      console.warn('Acceso denegado: el vendedor no tiene permisos para modificar o resolver averías.');
      return;
    }

    const inc = this.state.incidents.find((i) => i.id === incidentId);
    if (!inc) return;

    inc.status = status;
    if (costOfRepair !== undefined) inc.costOfRepair = costOfRepair;
    if (notes) inc.resolutionNotes = notes;

    if (status === 'solucionado') {
      inc.resolvedDate = new Date().toISOString().slice(0, 10);
      const cart = this.state.carts.find((c) => c.id === inc.cartId);
      if (cart) {
        cart.status = 'operativo';
      }
    }

    this.saveState();
  }

  // --- 8. Gastos Operativos ---
  public addExpense(expenseData: Omit<OperationalExpense, 'id' | 'registeredBy'>): void {
    const id = `EXP-${Date.now()}`;
    const expense: OperationalExpense = {
      ...expenseData,
      id,
      registeredBy: this.state.currentUser.name
    };

    this.state.expenses = [expense, ...this.state.expenses];
    this.addAuditLog(
      'REGISTRO_GASTO_OPERATIVO',
      'stock',
      id,
      `Gasto registrado en rubro ${expense.category}: $${expense.amount} (${expense.description})`
    );
    this.saveState();
  }

  // --- 9. Alertas ---
  public markAlertAsRead(alertId: string): void {
    const alert = this.state.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.isRead = true;
      this.saveState();
    }
  }

  public resolveAlert(alertId: string): void {
    const alert = this.state.alerts.find((a) => a.id === alertId);
    if (alert) {
      // Restricción: El vendedor no puede resolver alertas de mantenimiento o averías
      if (this.state.currentUser?.role === 'seller' && alert.category === 'mantenimiento') {
        console.warn('Acceso denegado: el vendedor no puede resolver alertas de mantenimiento o averías.');
        return;
      }
      alert.resolved = true;
      alert.isRead = true;
      this.saveState();
    }
  }

  // --- 10. Gestión de Usuarios ---
  public createUser(userData: Omit<UserProfile, 'id'>): UserProfile {
    const id = `USR-${Date.now()}`;
    const newUser: UserProfile = { ...userData, id, isActive: true };
    this.state.users = [...this.state.users, newUser];
    this.addAuditLog('CREAR_USUARIO', 'usuarios', id, `Creación de usuario: ${newUser.name} con rol ${newUser.role}`);
    this.saveState();
    return newUser;
  }

  public updateUser(userId: string, data: Partial<UserProfile>): void {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) return;
    const oldRole = user.role;
    Object.assign(user, data);
    this.addAuditLog(
      'ACTUALIZAR_USUARIO',
      'usuarios',
      userId,
      `Modificación de perfil de ${user.name}. Rol: ${user.role} (anterior: ${oldRole})`
    );
    // Si se editó el usuario activo actual, reflejar cambios
    if (this.state.currentUser && this.state.currentUser.id === userId) {
      this.state.currentUser = { ...user };
    }
    this.saveState();
  }

  public toggleUserActive(userId: string): void {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) return;
    user.isActive = !user.isActive;
    this.addAuditLog(
      'ESTADO_USUARIO',
      'usuarios',
      userId,
      `Usuario ${user.name} marcado como ${user.isActive ? 'activo' : 'inactivo'}`
    );
    this.saveState();
  }

  // --- 11. Configuración General Exclusiva de Administrador ---
  public updateSystemConfig(configData: Partial<SystemConfig>): void {
    this.state.systemConfig = {
      ...this.state.systemConfig,
      ...configData,
      updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      updatedBy: this.state.currentUser?.name || 'Administrador'
    };
    this.addAuditLog(
      'ACTUALIZAR_CONFIG_SISTEMA',
      'produccion',
      'SYSTEM_CONFIG',
      `Parámetros globales actualizados. Costo vivienda: $${this.state.systemConfig.housingCostPerPersonDaily}, Comisión base: ${(this.state.systemConfig.defaultCommissionRate * 100)}%`
    );
    this.saveState();
  }

  // --- 11.b) Gestión de Tramos de Comisión / Recompensas (Admin) ---
  public getCommissionTiers(): CommissionTier[] {
    return this.state.systemConfig?.commissionTiers || INITIAL_COMMISSION_TIERS;
  }

  public saveCommissionTiers(tiers: CommissionTier[]): void {
    if (!this.state.systemConfig) {
      this.state.systemConfig = { ...INITIAL_SYSTEM_CONFIG };
    }
    this.state.systemConfig.commissionTiers = [...tiers];
    this.state.systemConfig.updatedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
    this.state.systemConfig.updatedBy = this.state.currentUser?.name || 'Administrador';
    this.addAuditLog(
      'ACTUALIZAR_TRAMOS_COMISION',
      'configuracion',
      'COMMISSION_TIERS',
      `Configuración de tramos de comisión actualizada (${tiers.length} tramos guardados).`
    );
    this.saveState();
  }

  public addCommissionTier(tierData: Omit<CommissionTier, 'id'>): CommissionTier {
    const id = `TIER-${Date.now()}`;
    const newTier: CommissionTier = {
      ...tierData,
      id
    };
    const currentTiers = this.getCommissionTiers();
    this.saveCommissionTiers([...currentTiers, newTier]);
    return newTier;
  }

  public updateCommissionTier(tierId: string, updates: Partial<CommissionTier>): void {
    const currentTiers = this.getCommissionTiers();
    const updated = currentTiers.map((t) => (t.id === tierId ? { ...t, ...updates } : t));
    this.saveCommissionTiers(updated);
  }

  public deleteCommissionTier(tierId: string): void {
    const currentTiers = this.getCommissionTiers();
    const filtered = currentTiers.filter((t) => t.id !== tierId);
    this.saveCommissionTiers(filtered);
  }

  public toggleCommissionTier(tierId: string): void {
    const currentTiers = this.getCommissionTiers();
    const updated = currentTiers.map((t) => (t.id === tierId ? { ...t, isActive: !t.isActive } : t));
    this.saveCommissionTiers(updated);
  }

  public resetCommissionTiersToDefault(): void {
    this.saveCommissionTiers(INITIAL_COMMISSION_TIERS);
  }

  // --- 11.a) Gestión de Carritos (Admin) ---
  public createCart(cartData: Omit<SellingCart, 'id'>): SellingCart {
    const id = `CART-${Date.now()}`;
    const newCart: SellingCart = {
      ...cartData,
      id,
      isActive: true,
      gasLevelPercent: cartData.gasLevelPercent ?? 100,
      suppliesLevel: cartData.suppliesLevel || {
        napkins: 'alto',
        cones: 'alto',
        trays: 'alto',
        sauces: 'alto'
      },
      totalDaysInUse: cartData.totalDaysInUse ?? 0,
      lastMaintenanceDate: cartData.lastMaintenanceDate || new Date().toISOString().slice(0, 10)
    };
    this.state.carts = [...this.state.carts, newCart];
    this.addAuditLog('CREAR_CARRITO', 'carrito', id, `Nuevo carrito agregado: ${newCart.code}`);
    this.saveState();
    return newCart;
  }

  public updateCart(cartId: string, data: Partial<SellingCart>): void {
    const cart = this.state.carts.find((c) => c.id === cartId);
    if (!cart) return;
    Object.assign(cart, data);
    this.addAuditLog('EDITAR_CARRITO', 'carrito', cartId, `Carrito ${cart.code} actualizado. Estado: ${cart.status}`);
    this.saveState();
  }

  public toggleCartActive(cartId: string): void {
    const cart = this.state.carts.find((c) => c.id === cartId);
    if (!cart) return;
    cart.isActive = cart.isActive === undefined ? false : !cart.isActive;
    this.addAuditLog('ESTADO_CARRITO', 'carrito', cartId, `Carrito ${cart.code} ${cart.isActive ? 'activado' : 'desactivado'}`);
    this.saveState();
  }

  // --- 11.b) Gestión de Productos y Variedades (Admin) ---
  public createVariety(data: Omit<ProductVariety, 'id'>): ProductVariety {
    const id = `VAR-${Date.now()}`;
    const newVar: ProductVariety = { ...data, id, isAvailable: true, isActive: true };
    this.state.varieties = [...this.state.varieties, newVar];
    this.addAuditLog('CREAR_VARIEDAD', 'produccion', id, `Nueva variedad agregada: ${newVar.name} ($${newVar.basePriceIndividual})`);
    this.saveState();
    return newVar;
  }

  public updateVariety(varietyId: string, data: Partial<ProductVariety>): void {
    const variety = this.state.varieties.find((v) => v.id === varietyId);
    if (!variety) return;
    Object.assign(variety, data);
    this.addAuditLog('EDITAR_VARIEDAD', 'produccion', varietyId, `Variedad ${variety.name} actualizada.`);
    this.saveState();
  }

  public toggleVarietyActive(varietyId: string): void {
    const variety = this.state.varieties.find((v) => v.id === varietyId);
    if (!variety) return;
    variety.isActive = variety.isActive === undefined ? false : !variety.isActive;
    this.addAuditLog('ESTADO_VARIEDAD', 'produccion', varietyId, `Variedad ${variety.name} ${variety.isActive ? 'activada' : 'desactivada'}`);
    this.saveState();
  }

  // --- 11.c) Gestión de Casas / Bases Operativas (Admin) ---
  public createHouse(data: Omit<OperationalHouse, 'id'>): OperationalHouse {
    const id = `HOUSE-${Date.now()}`;
    const newHouse: OperationalHouse = {
      ...data,
      id,
      isActive: true,
      coordinatorIds: data.coordinatorIds || [],
      residentUserIds: data.residentUserIds || [],
      currentStock: data.currentStock || [],
      consumablesStock: data.consumablesStock || {
        gasTanksAvailable: 4,
        gasTanksInUse: 2,
        napkinPacks: 20,
        traysCount: 30,
        paperConesCount: 300,
        sauceBottlesCount: 15
      }
    };
    this.state.houses = [...this.state.houses, newHouse];
    this.addAuditLog('CREAR_CASA', 'stock', id, `Nueva base operativa creada: ${newHouse.name}`);
    this.saveState();
    return newHouse;
  }

  public updateHouse(houseId: string, data: Partial<OperationalHouse>): void {
    const house = this.state.houses.find((h) => h.id === houseId);
    if (!house) return;
    Object.assign(house, data);
    this.addAuditLog('EDITAR_CASA', 'stock', houseId, `Base ${house.name} actualizada.`);
    this.saveState();
  }

  public toggleHouseActive(houseId: string): void {
    const house = this.state.houses.find((h) => h.id === houseId);
    if (!house) return;
    house.isActive = house.isActive === undefined ? false : !house.isActive;
    this.addAuditLog('ESTADO_CASA', 'stock', houseId, `Base ${house.name} ${house.isActive ? 'activada' : 'desactivada'}`);
    this.saveState();
  }

  // --- 11.d) Gestión de Insumos y Categorías (Admin) ---
  public createRawMaterial(data: Omit<RawMaterial, 'id'>): RawMaterial {
    const id = `MAT-${Date.now()}`;
    const newMat: RawMaterial = {
      ...data,
      id,
      isActive: true,
      priceHistory: [
        { date: new Date().toISOString().slice(0, 10), costPerUnit: data.costPerUnit, supplier: data.supplier }
      ]
    };
    this.state.rawMaterials = [...this.state.rawMaterials, newMat];
    this.addAuditLog('CREAR_INSUMO', 'produccion', id, `Nuevo insumo registrado: ${newMat.name} ($${newMat.costPerUnit}/${newMat.unit})`);
    this.saveState();
    return newMat;
  }

  public updateRawMaterial(materialId: string, data: Partial<RawMaterial>): void {
    const mat = this.state.rawMaterials.find((m) => m.id === materialId);
    if (!mat) return;
    
    // Si cambia el costo unitario, registrar en historial
    if (data.costPerUnit !== undefined && data.costPerUnit !== mat.costPerUnit) {
      const history = mat.priceHistory || [];
      mat.priceHistory = [
        ...history,
        {
          date: new Date().toISOString().slice(0, 10),
          costPerUnit: data.costPerUnit,
          supplier: data.supplier || mat.supplier
        }
      ];
    }

    Object.assign(mat, data);
    this.addAuditLog('EDITAR_INSUMO', 'produccion', materialId, `Insumo ${mat.name} actualizado. Stock: ${mat.currentStock} ${mat.unit}`);
    this.saveState();
  }

  public toggleRawMaterialActive(materialId: string): void {
    const mat = this.state.rawMaterials.find((m) => m.id === materialId);
    if (!mat) return;
    mat.isActive = mat.isActive === undefined ? false : !mat.isActive;
    this.addAuditLog('ESTADO_INSUMO', 'produccion', materialId, `Insumo ${mat.name} ${mat.isActive ? 'activado' : 'desactivado'}`);
    this.saveState();
  }

  public createSupplyCategory(data: Omit<SupplyCategory, 'id'>): SupplyCategory {
    const id = `CAT-${Date.now()}`;
    const newCat: SupplyCategory = { ...data, id };
    this.state.supplyCategories = [...this.state.supplyCategories, newCat];
    this.addAuditLog('CREAR_CATEGORIA_INSUMO', 'produccion', id, `Categoría creada: ${newCat.name}`);
    this.saveState();
    return newCat;
  }

  // --- 11.e) Gestión de Proveedores (Admin) ---
  public createSupplier(data: Omit<Supplier, 'id'>): Supplier {
    const id = `SUP-${Date.now()}`;
    const newSup: Supplier = { ...data, id, isActive: true };
    this.state.suppliers = [...this.state.suppliers, newSup];
    this.addAuditLog('CREAR_PROVEEDOR', 'produccion', id, `Proveedor registrado: ${newSup.name}`);
    this.saveState();
    return newSup;
  }

  public updateSupplier(supplierId: string, data: Partial<Supplier>): void {
    const sup = this.state.suppliers.find((s) => s.id === supplierId);
    if (!sup) return;
    Object.assign(sup, data);
    this.addAuditLog('EDITAR_PROVEEDOR', 'produccion', supplierId, `Proveedor ${sup.name} actualizado`);
    this.saveState();
  }

  public toggleSupplierActive(supplierId: string): void {
    const sup = this.state.suppliers.find((s) => s.id === supplierId);
    if (!sup) return;
    sup.isActive = sup.isActive === undefined ? false : !sup.isActive;
    this.addAuditLog('ESTADO_PROVEEDOR', 'produccion', supplierId, `Proveedor ${sup.name} ${sup.isActive ? 'activado' : 'desactivado'}`);
    this.saveState();
  }

  // --- 11.f) Recetas de Producción (Admin) ---
  public createRecipe(data: Omit<ProductionRecipe, 'id'>): ProductionRecipe {
    const id = `REC-${Date.now()}`;
    const newRecipe: ProductionRecipe = { ...data, id, isActive: true };
    this.state.recipes = [...this.state.recipes, newRecipe];
    this.addAuditLog('CREAR_RECETA', 'produccion', id, `Receta creada: ${newRecipe.name} (Rendimiento: ${newRecipe.expectedYield} ${newRecipe.outputUnit})`);
    this.saveState();
    return newRecipe;
  }

  public updateRecipe(recipeId: string, data: Partial<ProductionRecipe>): void {
    const rec = this.state.recipes.find((r) => r.id === recipeId);
    if (!rec) return;
    Object.assign(rec, data);
    this.addAuditLog('EDITAR_RECETA', 'produccion', recipeId, `Receta ${rec.name} actualizada`);
    this.saveState();
  }

  public toggleRecipeActive(recipeId: string): void {
    const rec = this.state.recipes.find((r) => r.id === recipeId);
    if (!rec) return;
    rec.isActive = rec.isActive === undefined ? false : !rec.isActive;
    this.addAuditLog('ESTADO_RECETA', 'produccion', recipeId, `Receta ${rec.name} ${rec.isActive ? 'activada' : 'desactivada'}`);
    this.saveState();
  }

  // --- 12. Panel y Flujo de Fábrica / Cuadra de Producción ---
  public createProductionOrder(data: Omit<ProductionOrder, 'id' | 'createdAt' | 'status'>): ProductionOrder {
    const id = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(this.state.productionOrders.length + 1).padStart(2, '0')}`;
    const newOrder: ProductionOrder = {
      ...data,
      id,
      status: 'pendiente',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };
    this.state.productionOrders = [newOrder, ...this.state.productionOrders];
    this.addAuditLog('CREAR_ORDEN_PRODUCCION', 'produccion', id, `Orden ${id} para ${newOrder.requestedQuantity} ${newOrder.requestedUnit} de ${newOrder.productName}`);
    this.saveState();
    return newOrder;
  }

  public startProductionOrder(orderId: string): void {
    const order = this.state.productionOrders.find((o) => o.id === orderId);
    if (!order) return;
    order.status = 'en_proceso';
    order.startedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
    this.addAuditLog('INICIAR_PRODUCCION', 'produccion', orderId, `Orden ${orderId} iniciada por ${this.state.currentUser?.name || 'Fábrica'}`);
    this.saveState();
  }

  public completeProductionOrder(
    orderId: string,
    realProducedQuantity: number,
    wasteQuantity: number,
    wasteReason?: string,
    notes?: string
  ): ProductionBatch | null {
    const order = this.state.productionOrders.find((o) => o.id === orderId);
    if (!order) return null;

    const recipe = this.state.recipes.find((r) => r.id === order.recipeId);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

    // Calcular factor de escala según cantidad real
    const yieldBase = recipe ? recipe.expectedYield : (order.requestedQuantity || 1);
    const scaleFactor = realProducedQuantity / (yieldBase || 1);

    // Descontar materias primas proporcionalmente
    const ingredientsUsed: { materialId: string; quantity: number }[] = [];
    if (recipe) {
      recipe.ingredients.forEach((ing) => {
        const qtyToDiscount = Number((ing.quantityRequired * scaleFactor).toFixed(2));
        ingredientsUsed.push({ materialId: ing.materialId, quantity: qtyToDiscount });
      });
    }

    const laborCost = recipe ? Math.round(recipe.estimatedLaborCost * scaleFactor) : 50000;
    const energyAndPackagingCost = recipe ? Math.round(recipe.estimatedEnergyPackagingCost * scaleFactor) : 20000;

    // Crear Lote
    const batch = this.registerProductionBatch({
      varietyId: recipe?.varietyId || 'VAR-CLASICO',
      unitsProduced: realProducedQuantity,
      laborCost,
      energyAndPackagingCost,
      ingredientsUsed,
      notes: `Lote generado desde Orden ${order.id}. Mermas registradas: ${wasteQuantity}. ${wasteReason ? 'Causa: ' + wasteReason : ''} | ${notes || ''}`
    });

    order.status = 'completada';
    order.completedAt = now;
    order.realProducedQuantity = realProducedQuantity;
    order.wasteQuantity = wasteQuantity;
    order.wasteReason = wasteReason;
    order.efficiencyPercent = Number(((realProducedQuantity / ((realProducedQuantity + wasteQuantity) || 1)) * 100).toFixed(1));
    order.generatedBatchId = batch.id;
    order.productionNotes = (order.productionNotes ? order.productionNotes + ' | ' : '') + (notes || '');

    this.addAuditLog(
      'COMPLETAR_ORDEN_PRODUCCION',
      'produccion',
      orderId,
      `Orden ${orderId} completada. Producidos: ${realProducedQuantity}, Mermas: ${wasteQuantity}. Lote: ${batch.id}`
    );

    this.saveState();
    return batch;
  }

  public reportFactoryIncident(incidentData: {
    type: FactoryIncident['type'];
    severity: FactoryIncident['severity'];
    message: string;
  }): FactoryIncident {
    const id = `FINC-${Date.now()}`;
    const incident: FactoryIncident = {
      id,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      reportedBy: this.state.currentUser?.name || 'Personal de Fábrica',
      type: incidentData.type,
      severity: incidentData.severity,
      message: incidentData.message,
      resolved: false
    };

    this.state.factoryIncidents = [incident, ...this.state.factoryIncidents];

    this.state.alerts.unshift({
      id: `ALT-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      level: incidentData.severity === 'alta' ? 'critica' : 'advertencia',
      title: `Incidencia en Fábrica (${incidentData.type})`,
      message: `${this.state.currentUser?.name || 'Fábrica'}: ${incidentData.message}`,
      category: 'stock',
      relatedEntityId: incident.id,
      isRead: false,
      resolved: false
    });

    this.addAuditLog('INCIDENCIA_FABRICA', 'produccion', id, incidentData.message);
    this.saveState();
    return incident;
  }

  public resolveFactoryIncident(incidentId: string): void {
    const inc = this.state.factoryIncidents.find((i) => i.id === incidentId);
    if (!inc) return;
    inc.resolved = true;
    this.addAuditLog('RESOLVER_INCIDENCIA_FABRICA', 'produccion', incidentId, `Incidencia resuelta en planta.`);
    this.saveState();
  }

  // --- Reset a datos iniciales de fábrica ---
  public resetToFactorySeed(): void {
    this.state = {
      currentUser: null,
      selectedHouseId: 'HOUSE-NORTE',
      isOnline: true,
      systemConfig: INITIAL_SYSTEM_CONFIG,
      supplyCategories: INITIAL_SUPPLY_CATEGORIES,
      suppliers: INITIAL_SUPPLIERS,
      users: INITIAL_USERS,
      varieties: INITIAL_VARIETIES,
      rawMaterials: INITIAL_RAW_MATERIALS,
      recipes: INITIAL_RECIPES,
      productionOrders: INITIAL_PRODUCTION_ORDERS,
      factoryIncidents: INITIAL_FACTORY_INCIDENTS,
      materialPurchases: [],
      productionBatches: INITIAL_PRODUCTION_BATCHES,
      houses: INITIAL_HOUSES,
      zones: INITIAL_ZONES,
      carts: INITIAL_CARTS,
      incidents: INITIAL_INCIDENTS,
      shifts: INITIAL_SHIFTS,
      sales: INITIAL_SALES,
      expenses: INITIAL_EXPENSES,
      alerts: INITIAL_ALERTS,
      auditLogs: INITIAL_AUDIT_LOGS,
      transfers: INITIAL_TRANSFERS
    };
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
    }
    this.saveState();
  }
}

export const storageService = new StorageService();
