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
  SystemConfig,
  BeachConditionReport,
  TideCondition,
  CrowdLevel,
  BeachReportType,
  PaymentMethod
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
  INITIAL_TRANSFERS,
  INITIAL_BEACH_REPORTS
} from '../mockData';
import { calculateCommissionForSales } from '../utils/commissionUtils';
import { calculateWasteDeduction } from '../core/domain/settlementRules';
import { soundAlerts } from '../utils/soundAlerts';
import { authenticatedFetch, resetCsrfToken } from './apiClient';

const STORAGE_KEY = 'SGMO_TEQUENOS_COSTA_V2';
const OFFLINE_QUEUE_KEY = 'SGMO_OFFLINE_SALES_QUEUE';
const PENDING_OPERATIONS_KEY = 'SGMO_PENDING_OPERATIONS';
const PENDING_SALE_PREFIX = 'SGMO_PENDING_SALE_V1_';
const AUTH_TOKEN_KEY = 'SGMO_AUTH_TOKEN';
const AUTH_USER_KEY = 'SGMO_AUTH_USER';
const LOGOUT_PENDING_KEY = 'SGMO_LOGOUT_PENDING';

export interface AppState {
  currentUser: UserProfile | null;
  centralStatus?: 'not_loaded' | 'loading' | 'ready' | 'offline' | 'error' | 'demo';
  centralError?: string;
  centralOwnerUserId?: string;
  centralHydrated?: boolean;
  demoMode?: boolean;
  lastCentralSyncAt?: string;
  saleSyncStatus?: 'idle' | 'pending' | 'syncing' | 'error';
  saleSyncError?: string;
  operationSyncError?: string;
  selectedHouseId: string;
  isOnline: boolean;
  activeSeason: string;
  availableSeasons: string[];
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
  beachReports: BeachConditionReport[];
  expenses: OperationalExpense[];
  alerts: OperationalAlert[];
  auditLogs: AuditLog[];
  transfers: StockTransfer[];
}

export interface CentralSnapshot {
  users: UserProfile[];
  shifts: DailyShift[];
  sales: SaleTransaction[];
  varieties: ProductVariety[];
  houses: OperationalHouse[];
  carts: SellingCart[];
  zones: BeachZone[];
  systemConfig: SystemConfig;
}

export interface SaleSyncResult {
  success: boolean;
  acknowledgedIds: string[];
  pending: number;
  error?: string;
}

type Listener = (state: AppState) => void;

/** Credenciales de entrada transitorias: nunca forman parte del perfil/cache. */
export type UserCredentialInput = Partial<UserProfile> & { password?: string };

export class StorageService {
  private authRevision = 0;
  private logoutRequest: Promise<{ success: boolean; error?: string }> | null = null;
  private state: AppState;
  private listeners: Set<Listener> = new Set();
  private saleSyncPromise: Promise<SaleSyncResult> | null = null;
  private isStagingOperation = false;
  private hydrationPromise: Promise<boolean> | null = null;

  constructor() {
    this.state = this.loadInitialState();
    // Remove legacy bearer/profile; the server's HttpOnly cookie is the only browser identity.
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_USER_KEY);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      this.saveState(); // Elimina credenciales heredadas sin borrar ventas/stock.
    }
    
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
          
          // Los perfiles locales contienen metadatos; nunca son fuente de
          // autenticación ni deben conservar credenciales del prototipo anterior.
          const syncedUsers = (parsed.users || []).map((user: UserProfile) =>
            this.withoutCredentials(user)
          );

          // No agregar jornadas de demostración a una caché real.
          const syncedShifts = parsed.shifts || [];

          // Asegurar que las bases operativas tengan siempre currentStock, consumablesStock, coordinatorIds y residentUserIds definidos
          const syncedHouses = (parsed.houses || []).map((h: any) => ({
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
          const syncedCarts = (parsed.carts || []).map((c: any) => ({
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
            currentUser: null, // La identidad se restaura exclusivamente contra el servidor.
            centralStatus: 'not_loaded',
            saleSyncStatus: 'idle',
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
            supplyCategories: parsed.supplyCategories || [],
            suppliers: parsed.suppliers || [],
            recipes: parsed.recipes || [],
            productionOrders: parsed.productionOrders || [],
            factoryIncidents: parsed.factoryIncidents || [],
            zones: parsed.zones || [],
            beachReports: parsed.beachReports || [],
            activeSeason: parsed.activeSeason || 'Temporada 2026-2027',
            availableSeasons: parsed.availableSeasons || ['Temporada 2026-2027', 'Temporada 2027-2028', 'Temporada 2028-2029']
          };
        } catch (e) {
          console.error('No se pudo interpretar el almacenamiento local.');
        }
      }
    }

    return {
      currentUser: null,
      centralStatus: 'not_loaded',
      centralHydrated: false,
      saleSyncStatus: 'idle',
      demoMode: false,
      selectedHouseId: '',
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      activeSeason: 'Temporada 2026-2027',
      availableSeasons: ['Temporada 2026-2027', 'Temporada 2027-2028', 'Temporada 2028-2029'],
      systemConfig: structuredClone(INITIAL_SYSTEM_CONFIG),
      supplyCategories: [],
      suppliers: [],
      users: [],
      varieties: [],
      rawMaterials: [],
      recipes: [],
      productionOrders: [],
      factoryIncidents: [],
      materialPurchases: [],
      productionBatches: [],
      houses: [],
      zones: [],
      carts: [],
      incidents: [],
      shifts: [],
      sales: [],
      beachReports: [],
      expenses: [],
      alerts: [],
      auditLogs: [],
      transfers: []
    };
  }

  /** Retira credenciales de perfiles/cache; permite enviarlas solo como entrada HTTP. */
  private withoutCredentials<Profile extends Partial<UserProfile>>(profile: Profile): Profile {
    const safeProfile = { ...profile };
    for (const credentialField of [
      'pin', 'password', 'pinHash', 'pinSalt', 'passwordHash', 'passwordSalt',
      'pin_hash', 'pin_salt', 'password_hash', 'password_salt'
    ]) {
      delete (safeProfile as Record<string, unknown>)[credentialField];
    }
    return safeProfile;
  }

  private saveState(): void {
    if (this.isStagingOperation) return;
    this.state.users = this.state.users.map((user) => this.withoutCredentials(user));
    if (this.state.currentUser) {
      this.state.currentUser = this.withoutCredentials(this.state.currentUser);
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (e) {
        this.state.saleSyncError = 'No se pudo guardar la caché operativa. Las ventas durables siguen pendientes; evitá recargar hasta confirmar la sincronización.';
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

  /**
   * Carga el snapshot autorizado para la sesión. Una caída central conserva caché
   * y cola existentes; nunca trae semillas locales ni adopta otro usuario.
   */
  public refreshCentralState(): Promise<boolean> {
    if (this.hydrationPromise) return this.hydrationPromise;
    this.hydrationPromise = this.loadCentralSnapshot().finally(() => { this.hydrationPromise = null; });
    return this.hydrationPromise;
  }

  private async loadCentralSnapshot(): Promise<boolean> {
    const sessionUser = this.state.currentUser;
    if (!sessionUser) return false;
    this.state.centralStatus = 'loading';
    this.state.centralError = undefined;
    this.notify();
    try {
      const response = await authenticatedFetch('/api/bootstrap');
      const payload = await response.json();
      if (!response.ok || payload.success !== true || (!payload.configured && payload.demoMode !== true)) {
        throw new Error(payload.message || 'No se pudo cargar la operación central.');
      }
      const snapshot = payload.state as CentralSnapshot;
      for (const property of ['users', 'shifts', 'sales', 'varieties', 'houses', 'carts', 'zones'] as const) {
        if (!Array.isArray(snapshot?.[property])) throw new Error('La carga central está incompleta.');
      }
      if (!snapshot.systemConfig || !Array.isArray(snapshot.systemConfig.commissionTiers)) {
        throw new Error('El servidor no confirmó la configuración operativa.');
      }
      if (this.state.currentUser?.id !== sessionUser.id) return false;
      const pendingSales = this.readOfflineQueue().filter((sale) =>
        sessionUser.role !== 'seller' || sale.sellerId === sessionUser.id);
      const centralSales = new Map<string, SaleTransaction>(snapshot.sales.map((sale) => [sale.id, { ...sale, syncStatus: 'synced' as const }]));
      // Mientras no hay ACK, retener la versión local y su estado pendiente.
      for (const sale of pendingSales) centralSales.set(sale.id, { ...sale, syncStatus: 'pending' });
      const localShifts = new Map(this.state.shifts.map((shift) => [shift.id, shift]));
      const pendingShiftIds = new Set(pendingSales.map((sale) => sale.shiftId));
      this.state.shifts = snapshot.shifts.map((shift) =>
        this.state.centralOwnerUserId === sessionUser.id && pendingShiftIds.has(shift.id)
          ? localShifts.get(shift.id) || shift : shift);
      this.state.users = snapshot.users.map((user) => this.withoutCredentials(user));
      this.state.sales = [...centralSales.values()];
      this.state.varieties = snapshot.varieties;
      this.state.houses = snapshot.houses;
      this.state.carts = snapshot.carts;
      this.state.zones = snapshot.zones;
      this.state.systemConfig = snapshot.systemConfig;
      this.state.centralHydrated = true;
      this.state.centralOwnerUserId = sessionUser.id;
      this.state.demoMode = payload.demoMode === true;
      this.state.centralStatus = this.state.demoMode ? 'demo' : 'ready';
      this.state.lastCentralSyncAt = new Date().toISOString();
      if (!this.state.houses.some((house) => house.id === this.state.selectedHouseId)) {
        this.state.selectedHouseId = sessionUser.assignedHouseId || this.state.houses[0]?.id || '';
      }
      this.saveState();
      return true;
    } catch {
      if (this.state.currentUser?.id !== sessionUser.id) return false;
      this.state.centralStatus = this.state.isOnline ? 'error' : 'offline';
      this.state.centralError = 'No se pudo actualizar la operación central. Se conserva la caché y las ventas pendientes.';
      this.notify();
      return false;
    }
  }

  // --- Inicio y Cierre de Sesión por PIN Personal ---
  public getAuthToken(): string | null {
    // Compatibility for callers that still inspect this method. Cookies are never readable here.
    return null;
  }

  /** A reload requires a fresh central validation; cached profiles never create a session. */
  public async restoreSession(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    if (typeof window !== 'undefined' && localStorage.getItem(LOGOUT_PENDING_KEY)) {
      await this.logout();
      return false;
    }
    const revision = this.authRevision;
    try {
      const response = await authenticatedFetch('/api/auth/me');
      const result = await response.json();
      if (revision !== this.authRevision) return false;
      if (!response.ok || result.success !== true || !result.user?.id || result.user.isActive !== true
          || !['admin', 'coordinator', 'seller', 'factory_worker'].includes(result.user.role)
          || !result.session?.expiresAt || !Number.isFinite(new Date(result.session.expiresAt).getTime())
          || new Date(result.session.expiresAt).getTime() <= Date.now() || result.session.role !== result.user.role) {
        if (response.status === 401) { this.state.currentUser = null; this.saveState(); }
        return false;
      }
      this.state.currentUser = this.withoutCredentials(result.user);
      if (result.user.assignedHouseId) this.state.selectedHouseId = result.user.assignedHouseId;
      this.saveState();
      return true;
    } catch { return false; }
  }

  public async loginWithPinAsync(pin: string, userCode?: string): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    if (!userCode || !userCode.trim()) {
      return { success: false, error: 'Debe ingresar el código de usuario (userCode).' };
    }

    const cleanPin = (pin || '').trim();
    if (!/^\d{8}$/.test(cleanPin)) {
      return { success: false, error: 'El PIN personal debe contener exactamente 8 dígitos numéricos.' };
    }

    return this.authenticateWithServer({ userCode: userCode.trim(), pin: cleanPin });
  }

  public async loginAsAdminAsync(identifier: string, password: string): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    if (!identifier?.trim() || !password) {
      return { success: false, error: 'Debe ingresar identificador y contraseña.' };
    }
    return this.authenticateWithServer({ identifier: identifier.trim(), password });
  }

  /**
   * Sólo una respuesta central con perfil y vigencia habilita la sesión cookie.
   * Caídas de red, HTML de hosting estático, respuestas incompletas o errores
   * del servidor se rechazan; la venta offline de sesiones activas no cambia.
   */
  private async authenticateWithServer(credentials: { userCode: string; pin: string } | { identifier: string; password: string }): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    try {
      if (this.logoutRequest && !(await this.logoutRequest).success) {
        return { success: false, error: 'El cierre anterior requiere conexión antes de iniciar otra sesión.' };
      }
      const response = await authenticatedFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      const result = await response.json();
      if (!response.ok) {
        return { success: false, error: result.message || 'No se pudo validar el acceso en el servidor.' };
      }
      if (result.success !== true || !result.user?.id || result.user.isActive !== true
          || !['admin', 'coordinator', 'seller', 'factory_worker'].includes(result.user.role)
          || typeof result.expiresAt !== 'string' || !Number.isFinite(new Date(result.expiresAt).getTime())
          || new Date(result.expiresAt).getTime() <= Date.now() || 'token' in result) {
        return { success: false, error: 'El servidor no confirmó una sesión válida.' };
      }

      const safeUser = this.withoutCredentials(result.user as UserProfile);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        localStorage.removeItem(LOGOUT_PENDING_KEY);
      }
      this.authRevision++;
      this.state.currentUser = safeUser;
      if (safeUser.assignedHouseId) {
        this.state.selectedHouseId = safeUser.assignedHouseId;
      }
      this.addAuditLog('LOGIN_USUARIO', 'usuarios', safeUser.id, `Inicio de sesión de ${safeUser.name} (${safeUser.role}) verificado en backend`);
      this.saveState();
      return { success: true, user: safeUser };
    } catch {
      // No registrar respuestas o errores que puedan incluir datos de entrada.
      return { success: false, error: 'No se pudo conectar con el servidor. Para iniciar sesión necesitás conexión.' };
    }
  }

  public setCurrentUser(user: UserProfile | null): void {
    if (!user) {
      this.logout();
      return;
    }
    // Este adaptador puede refrescar la identidad existente, pero no autenticar
    // una cuenta ni elevar su rol desde un perfil/cache local.
    const authenticatedUser = this.state.currentUser;
    if (!authenticatedUser || authenticatedUser.id !== user.id || authenticatedUser.role !== user.role) {
      return;
    }
    this.state.currentUser = this.withoutCredentials(user);
    if (user.assignedHouseId) {
      this.state.selectedHouseId = user.assignedHouseId;
    }
    this.saveState();
  }

  /** @deprecated La autenticación requiere loginWithPinAsync y servidor disponible. */
  public loginWithPin(_pin: string, _userCode: string): { success: boolean; user?: UserProfile; error?: string } {
    return { success: false, error: 'El inicio de sesión local está deshabilitado. Usá la autenticación central con conexión.' };
  }

  public logout(): Promise<{ success: boolean; error?: string }> {
    if (this.logoutRequest) return this.logoutRequest;
    this.authRevision++;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
      localStorage.setItem(LOGOUT_PENDING_KEY, 'true');
    }

    if (this.state.currentUser) {
      this.addAuditLog('LOGOUT_USUARIO', 'usuarios', this.state.currentUser.id, `Cierre de sesión de ${this.state.currentUser.name}`);
    }
    this.state.currentUser = null;
    this.saveState();
    this.logoutRequest = (async () => {
      try {
        const response = await authenticatedFetch('/api/auth/logout', { method: 'POST' });
        const result = await response.json();
        if (!response.ok || result.success !== true) throw new Error('Revocación pendiente');
        if (typeof window !== 'undefined') localStorage.removeItem(LOGOUT_PENDING_KEY);
        resetCsrfToken();
        return { success: true };
      } catch {
        return { success: false, error: 'Saliste de esta pantalla, pero el servidor todavía no confirmó el cierre. Reconectate para completar la revocación.' };
      } finally { this.logoutRequest = null; }
    })();
    return this.logoutRequest;
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

  /** Ejecuta el cálculo previo sin publicar ni guardar sus efectos económicos. */
  private calculateOperationDraft<Result>(calculate: () => Result): Result {
    const liveState = this.state;
    this.state = structuredClone(liveState);
    this.isStagingOperation = true;
    try { return calculate(); }
    finally { this.state = liveState; this.isStagingOperation = false; }
  }

  private requireCentralOperation(roles: UserRole[]): UserProfile {
    const user = this.state.currentUser;
    if (!user || !roles.includes(user.role)) throw new Error('Tu rol no puede confirmar esta operación.');
    if (!this.state.isOnline) throw new Error('Esta operación requiere conexión con la base central.');
    if (!this.state.centralHydrated || this.state.centralOwnerUserId !== user.id) {
      throw new Error('Primero cargá la operación central de tu sesión.');
    }
    return user;
  }

  private readPendingOperations(): Array<{ key: string; userId: string; url: string; method: 'POST' | 'PUT'; payload: unknown }> {
    const pending = JSON.parse(localStorage.getItem(PENDING_OPERATIONS_KEY) || '[]');
    if (!Array.isArray(pending) || pending.some((operation) => !operation || typeof operation.key !== 'string')) {
      throw new Error('Hay operaciones sin recuperar. No borrar la caché.');
    }
    return pending;
  }

  private async persistShiftOperation(url: string, method: 'POST' | 'PUT', payload: unknown, semanticInput: unknown = payload): Promise<Record<string, any>> {
    const sessionUserId = this.state.currentUser?.id;
    if (!sessionUserId) throw new Error('Se requiere una sesión activa.');
    // Un reintento conserva el DTO exacto, incluyendo ID/timestamp. Si se perdió
    // la respuesta, el servidor puede reconocer la operación ya persistida.
    const intentKey = JSON.stringify([sessionUserId, method, url, semanticInput]);
    const pending = this.readPendingOperations();
    let intent = pending.find((operation) => operation.key === intentKey);
    if (!intent) {
      intent = { key: intentKey, userId: sessionUserId, url, method, payload };
      pending.push(intent);
      localStorage.setItem(PENDING_OPERATIONS_KEY, JSON.stringify(pending));
    }
    this.state.operationSyncError = undefined;
    let response: Response;
    let result: Record<string, any>;
    try {
      response = await authenticatedFetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(intent.payload)
      });
      result = await response.json();
    } catch {
      this.state.operationSyncError = 'La operación no se confirmó. Se conserva su identificador para reintentar sin duplicar.';
      this.notify();
      throw new Error(this.state.operationSyncError);
    }
    if (!response.ok || result.success !== true) {
      if (response.status >= 400 && response.status < 500 && response.status !== 409) {
        localStorage.setItem(PENDING_OPERATIONS_KEY, JSON.stringify(this.readPendingOperations().filter((operation) => operation.key !== intentKey)));
      }
      this.state.operationSyncError = result.message || result.error || 'La base central rechazó la operación.';
      this.notify();
      throw new Error(this.state.operationSyncError);
    }
    if (this.state.currentUser?.id !== sessionUserId) {
      throw new Error('La sesión cambió mientras se confirmaba la operación. Actualizá la operación central.');
    }
    if (!result.shift?.id) throw new Error('El servidor no confirmó la jornada actualizada.');
    localStorage.setItem(PENDING_OPERATIONS_KEY, JSON.stringify(this.readPendingOperations().filter((operation) => operation.key !== intentKey)));
    this.state.shifts = [result.shift, ...this.state.shifts.filter((shift) => shift.id !== result.shift.id)];
    this.saveState();
    // Casas/carritos/catálogo se adoptan desde sus fuentes centrales, no desde
    // el borrador que descuenta congeladores sólo en el dispositivo.
    await this.refreshCentralState();
    return result;
  }

  public async dispatchSellerShift(data: Parameters<StorageService['draftDispatchSellerShift']>[0]): Promise<DailyShift> {
    this.requireCentralOperation(['admin', 'coordinator']);
    const draft = this.calculateOperationDraft(() => this.draftDispatchSellerShift(data));
    const result = await this.persistShiftOperation('/api/shifts', 'POST', draft, data);
    return result.shift;
  }

  public async closeAndReconcileShift(data: Parameters<StorageService['draftCloseAndReconcileShift']>[0]): Promise<DailyShift | undefined> {
    this.requireCentralOperation(['admin', 'coordinator']);
    const pending = this.readOfflineQueue().some((sale) => sale.shiftId === data.shiftId);
    if (pending) {
      const sync = await this.flushOfflineQueue();
      if (!sync.success || this.readOfflineQueue().some((sale) => sale.shiftId === data.shiftId)) {
        throw new Error('Hay ventas sin confirmar. Sincronizalas antes de cerrar la jornada.');
      }
    }
    const result = await this.persistShiftOperation(`/api/shifts/${encodeURIComponent(data.shiftId)}/close`, 'PUT', data);
    return result.shift;
  }

  public async recordShiftWaste(...parameters: Parameters<StorageService['draftRecordShiftWaste']>): Promise<ShiftWasteRecord | undefined> {
    this.requireCentralOperation(['admin', 'coordinator', 'seller']);
    const record = this.calculateOperationDraft(() => this.draftRecordShiftWaste(...parameters));
    if (!record) throw new Error('No se encontró la jornada de merma.');
    const result = await this.persistShiftOperation(`/api/shifts/${encodeURIComponent(record.shiftId)}/waste`, 'POST', record, parameters);
    return result.record;
  }

  public async addShiftRestock(data: Parameters<StorageService['draftAddShiftRestock']>[0]): Promise<{ shift: DailyShift; restockRecords: ShiftRestockRecord[] }> {
    this.requireCentralOperation(['admin', 'coordinator']);
    const draft = this.calculateOperationDraft(() => this.draftAddShiftRestock(data));
    const result = await this.persistShiftOperation(`/api/shifts/${encodeURIComponent(data.shiftId)}/restock`, 'POST', { records: draft.restockRecords }, data);
    return { shift: result.shift, restockRecords: result.records };
  }

  // --- 3. Planificación y Despacho Matutino (Check-out) ---
  private draftDispatchSellerShift(data: {
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

    const shiftId = `SHIFT-${crypto.randomUUID()}`;

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
    paymentMethod: PaymentMethod;
    locationName?: string;
    beachSector?: string;
    voucherPhotoUrl?: string;
    voucherExtractedData?: SaleTransaction['voucherExtractedData'];
    validationStatus?: VoucherValidationStatus;
    mpApiVerification?: SaleTransaction['mpApiVerification'];
    gpsLocation?: { lat: number; lng: number; zoneName?: string };
  }): SaleTransaction {
    const shift = this.state.shifts.find((s) => s.id === saleData.shiftId);
    const sessionUser = this.state.currentUser;
    if (!sessionUser || !this.state.centralHydrated || this.state.centralOwnerUserId !== sessionUser.id) {
      throw new Error('No hay una operación central cargada para esta sesión.');
    }
    if (!shift || shift.status !== 'en_curso' || (sessionUser.role === 'seller' && shift.sellerId !== sessionUser.id)) {
      throw new Error('La venta requiere una jornada activa autorizada.');
    }
    if (!['seller', 'coordinator', 'admin'].includes(sessionUser.role)) throw new Error('Tu rol no puede registrar ventas.');
    if (!Number.isInteger(saleData.quantityUnitsEquivalent) || saleData.quantityUnitsEquivalent <= 0
        || !Number.isFinite(saleData.totalAmount) || saleData.totalAmount <= 0) {
      throw new Error('La venta requiere unidades enteras e importe válido.');
    }
    if (saleData.voucherPhotoUrl && saleData.voucherPhotoUrl.length > 2_000_000) {
      throw new Error('El comprobante es demasiado grande. Reducí la imagen antes de registrar la venta.');
    }
    const stockForVariety = shift.stockItems.find((item) => item.varietyId === saleData.varietyId);
    const remainingUnits = stockForVariety ? stockForVariety.deliveredUnits + stockForVariety.reSuppliedUnits
      - stockForVariety.soldUnits - stockForVariety.returnedUnits - stockForVariety.wasteUnits : 0;
    if (saleData.quantityUnitsEquivalent > remainingUnits) throw new Error('No hay stock disponible para registrar esta venta.');
    const sellerId = shift ? shift.sellerId : (this.state.currentUser?.id || 'USR-SELLER');
    const sellerName = shift ? shift.sellerName : (this.state.currentUser?.name || 'Vendedor');
    const variety = this.state.varieties.find((v) => v.id === saleData.varietyId);
    const varietyName = variety ? variety.name : 'Tequeño';

    const saleId = `TX-${crypto.randomUUID()}`;
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
      locationName: saleData.locationName || shift?.zoneName || 'Playa Costa',
      beachSector: saleData.beachSector,
      voucherPhotoUrl: saleData.voucherPhotoUrl,
      voucherExtractedData: saleData.voucherExtractedData,
      validationStatus: saleData.paymentMethod === 'efectivo' ? 'validada'
        : saleData.validationStatus && saleData.validationStatus !== 'validada' ? saleData.validationStatus : 'pendiente_revision',
      // El comprobante o una respuesta local no acreditan dinero. Solo el
      // snapshot central devuelve evidencia bancaria verificada y persistida.
      mpApiVerification: undefined,
      gpsLocation: saleData.gpsLocation,
      isOfflineCreated: !isOnline,
      syncStatus: 'pending'
    };

    // Persistir antes de modificar totales: también una venta con red puede
    // fallar al enviar. No asumir respaldo central por navigator.onLine.
    this.enqueueOfflineSale(newSale);

    // Actualizar ventas en la jornada
    if (shift) {
      shift.totalGrossSales += newSale.totalAmount;
      if (newSale.paymentMethod === 'efectivo') {
        shift.totalCashSales += newSale.totalAmount;
        shift.cashExpected += newSale.totalAmount;
      } else if (newSale.paymentMethod === 'mercado_pago') {
        shift.totalMpSales += newSale.totalAmount;
        if (newSale.validationStatus === 'validada') {
          shift.mpValidatedAmount += newSale.totalAmount;
        } else {
          shift.mpPendingOrSuspiciousAmount += newSale.totalAmount;
        }
      } else if (newSale.paymentMethod === 'transferencia') {
        shift.totalTransferSales = (shift.totalTransferSales || 0) + newSale.totalAmount;
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

    // Si la venta es por Mercado Pago o Transferencia y presenta incidencias, alertar con sonido al Administrador/Coordinador
    const isTransferPayment = newSale.paymentMethod === 'mercado_pago' || newSale.paymentMethod === 'transferencia';
    const isProblematic = newSale.validationStatus === 'sospechosa' ||
      newSale.validationStatus === 'inconsistente' ||
      newSale.validationStatus === 'pendiente_revision' ||
      Boolean(newSale.mpApiVerification && !newSale.mpApiVerification.matchedInApi);

    if (isTransferPayment && isProblematic) {
      const isCritical = newSale.validationStatus === 'sospechosa';
      const opLabel = newSale.voucherExtractedData?.operationId || newSale.id;
      const statusTitle = newSale.validationStatus === 'sospechosa'
        ? 'Alerta de Fraude / Sospechosa'
        : newSale.validationStatus === 'inconsistente'
        ? 'Inconsistencia Detectada'
        : 'Requiere Revisión Manual';

      this.state.alerts.unshift({
        id: `ALT-VOUCHER-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        level: isCritical ? 'critica' : 'advertencia',
        title: `🚨 Transferencia ${statusTitle} ($${newSale.totalAmount.toLocaleString()})`,
        message: `${sellerName} en ${newSale.locationName || 'playa'} registró cobro MP por $${newSale.totalAmount.toLocaleString()} (Op: #${opLabel}) en estado "${newSale.validationStatus}". Motivo: ${newSale.voucherExtractedData?.aiNotes || newSale.mpApiVerification?.message || 'Pendiente de acreditación'}.`,
        category: 'fraude',
        relatedEntityId: newSale.id,
        isRead: false,
        resolved: false
      });

      // Emitir sonido de alerta si el usuario en sesión es Administrador o Coordinador
      if (this.state.currentUser?.role === 'admin' || this.state.currentUser?.role === 'coordinator') {
        soundAlerts.playTransferAlertSound();
      }
    } else if (isTransferPayment && newSale.validationStatus === 'validada') {
      if (this.state.currentUser?.role === 'admin' || this.state.currentUser?.role === 'coordinator') {
        soundAlerts.playTransferSuccessSound();
      }
    }

    const locText = newSale.locationName ? ` en ${newSale.locationName}` : '';
    this.addAuditLog(
      'VENTA_REGISTRADA',
      'venta',
      saleId,
      `Venta de ${newSale.itemType} (${newSale.quantityUnitsEquivalent} u) por $${newSale.totalAmount} vía ${newSale.paymentMethod}${locText} (${sellerName})`
    );
    this.state.saleSyncStatus = 'pending';
    this.saveState();
    if (isOnline) void this.flushOfflineQueue();
    return newSale;
  }

  // --- Offline Queue Handling ---
  private readOfflineQueue(): SaleTransaction[] {
    if (typeof window === 'undefined') return [];
    const pendingSales = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    if (!Array.isArray(pendingSales) || pendingSales.some((sale) => !sale || typeof sale.id !== 'string')) {
      throw new Error('La cola de ventas necesita recuperación. No borrar ni reiniciar.');
    }
    const salesById = new Map<string, SaleTransaction>(pendingSales.map((sale: SaleTransaction) => [sale.id, sale]));
    // Cada venta nueva también posee una clave propia. Dos pestañas pueden
    // pisar el índice compartido, pero no una venta de UUID diferente.
    if (typeof localStorage.key === 'function') {
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (!key?.startsWith(PENDING_SALE_PREFIX)) continue;
        const sale = JSON.parse(localStorage.getItem(key) || 'null') as SaleTransaction;
        if (!sale?.id || key !== `${PENDING_SALE_PREFIX}${sale.id}`) {
          throw new Error('Una venta local requiere recuperación. No borrar la caché.');
        }
        salesById.set(sale.id, sale);
      }
    }
    return [...salesById.values()];
  }

  /** Fallo de cuota/JSON impide registrar la venta antes de alterar caja o stock. */
  private enqueueOfflineSale(sale: SaleTransaction): void {
    if (typeof window === 'undefined') throw new Error('El dispositivo no dispone de almacenamiento durable.');
    const pendingSales = this.readOfflineQueue();
    const existingIndex = pendingSales.findIndex((pendingSale) => pendingSale.id === sale.id);
    if (existingIndex === -1) pendingSales.push(sale);
    else pendingSales[existingIndex] = sale;
    // La escritura individual es obligatoria. El índice es reconstruible y
    // su fallo no convierte una venta durable en una operación desconocida.
    localStorage.setItem(`${PENDING_SALE_PREFIX}${sale.id}`, JSON.stringify(sale));
    try { localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(pendingSales)); }
    catch { this.state.saleSyncError = 'El índice local no se actualizó; las ventas se conservaron individualmente.'; }
  }

  public getOfflineQueueCount(): number {
    try { return this.readOfflineQueue().length; }
    catch { return 0; } // Los flujos de escritura/reset consultan la cola estricta.
  }

  /** Un solo envío activo por instancia; cada ACK se aplica sobre la cola actual. */
  public flushOfflineQueue(): Promise<SaleSyncResult> {
    if (this.saleSyncPromise) return this.saleSyncPromise;
    this.saleSyncPromise = this.synchronizePendingSales().finally(() => { this.saleSyncPromise = null; });
    return this.saleSyncPromise;
  }

  private async synchronizePendingSales(): Promise<SaleSyncResult> {
    const sessionUser = this.state.currentUser;
    const noSession = !sessionUser;
    if (typeof window === 'undefined' || noSession) {
      return { success: false, acknowledgedIds: [], pending: this.getOfflineQueueCount(), error: 'Se requiere una sesión activa.' };
    }
    try {
      const queue = this.readOfflineQueue();
      const snapshot = queue.filter((sale) => sessionUser.role !== 'seller' || sale.sellerId === sessionUser.id).slice(0, 500);
      if (snapshot.length === 0) return { success: true, acknowledgedIds: [], pending: queue.length };
      const versions = new Map(snapshot.map((sale) => [sale.id, JSON.stringify(sale)]));
      this.state.saleSyncStatus = 'syncing';
      this.state.saleSyncError = undefined;
      this.notify();
      const response = await authenticatedFetch('/api/sales/sync-batch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sales: snapshot })
      });
      const result = await response.json();
      if (!response.ok || result.success !== true || !Array.isArray(result.acknowledgedIds)
          || result.acknowledgedIds.some((id: unknown) => typeof id !== 'string' || !versions.has(id as string))) {
        throw new Error('El servidor no confirmó los identificadores del lote.');
      }
      const acknowledged = new Set<string>(result.acknowledgedIds);
      const retained = this.readOfflineQueue().filter((sale) =>
        !acknowledged.has(sale.id) || versions.get(sale.id) !== JSON.stringify(sale));
      // Escribir un array vacío conserva un resultado inequívoco y no elimina
      // ventas nuevas que llegaron mientras el request estaba en vuelo.
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(retained));
      for (const saleId of acknowledged) {
        const durableKey = `${PENDING_SALE_PREFIX}${saleId}`;
        if (localStorage.getItem(durableKey) === versions.get(saleId)) localStorage.removeItem(durableKey);
      }
      const retainedIds = new Set(retained.map((sale) => sale.id));
      this.state.sales = this.state.sales.map((sale) =>
        acknowledged.has(sale.id) && !retainedIds.has(sale.id) ? { ...sale, syncStatus: 'synced' } : sale);
      this.state.saleSyncStatus = retained.length ? 'pending' : 'idle';
      this.state.lastCentralSyncAt = new Date().toISOString();
      this.saveState();
      return { success: true, acknowledgedIds: [...acknowledged], pending: retained.length };
    } catch {
      this.state.saleSyncStatus = 'error';
      this.state.saleSyncError = 'No se confirmaron las ventas pendientes. Se conservan en este dispositivo para reintentar.';
      this.notify();
      return { success: false, acknowledgedIds: [], pending: this.getOfflineQueueCount(), error: this.state.saleSyncError };
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

    if (sale.paymentMethod !== 'efectivo' && status === 'validada') {
      throw new Error('La acreditación bancaria solo puede confirmarse desde la API central. Actualizá la operación para ver la evidencia verificada.');
    }
    const previousStatus = sale.validationStatus;
    sale.validationStatus = status;
    if (extractedData) {
      sale.voucherExtractedData = { ...sale.voucherExtractedData, ...extractedData };
    }
    // mpVerification recibido por un componente no es autoridad bancaria.
    // La evidencia solo se adopta en refreshCentralState desde el servidor.

    // Actualizar resumen en la jornada
    const shift = this.state.shifts.find((s) => s.id === sale.shiftId);
    if (shift) {
      let validated = 0;
      let pending = 0;
      this.state.sales
        .filter((s) => s.shiftId === shift.id && (s.paymentMethod === 'mercado_pago' || s.paymentMethod === 'transferencia'))
        .forEach((s) => {
          if (s.validationStatus === 'validada' && s.mpApiVerification?.matchedInApi === true
              && s.mpApiVerification?.isLiveApi === true && s.mpApiVerification?.apiStatus === 'approved') {
            validated += s.totalAmount;
          } else {
            pending += s.totalAmount;
          }
        });
      shift.mpValidatedAmount = validated;
      shift.mpPendingOrSuspiciousAmount = pending;
    }

    if (sale.syncStatus === 'pending') this.enqueueOfflineSale(sale);

    this.addAuditLog(
      'VALIDACION_COMPROBANTE',
      'comprobante',
      saleId,
      `Estado de comprobante actualizado a: ${status} (Monto: $${sale.totalAmount})`,
      previousStatus,
      status
    );

    if (status === 'validada') {
      soundAlerts.playTransferSuccessSound();
    } else if (status === 'sospechosa' || status === 'inconsistente') {
      soundAlerts.playTransferAlertSound();
    }

    this.saveState();
  }

  // --- 6. Cierre de Jornada, Conciliación y Liquidación ---
  private draftCloseAndReconcileShift(data: {
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

    // Cálculo de deducciones por faltante / merma injustificada
    const config = this.state.systemConfig;
    let deductions = 0;
    let wasteBreakdown: any = undefined;

    if (totalDifferenceUnits > 0) {
      if (config?.wasteToleranceThreshold !== undefined) {
        wasteBreakdown = calculateWasteDeduction(
          totalDifferenceUnits,
          {
            thresholdUnits: config.wasteToleranceThreshold,
            rateBelowOrEqual: config.wastePenaltyRateBelowOrEqual ?? 500,
            rateAbove: config.wastePenaltyRateAbove ?? 2500
          },
          data.deductionMissingRatePerUnit || 1500
        );
        deductions = wasteBreakdown.totalDeduction;
      } else {
        const deductionRate = data.deductionMissingRatePerUnit || config?.deductionRatePerMissingUnit || 1500;
        deductions = totalDifferenceUnits * deductionRate;
      }
    }
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
    shift.wasteDeductionBreakdown = wasteBreakdown;
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

  public async paySellerCommission(shiftId: string, paymentProof: string): Promise<void> {
    this.requireCentralOperation(['admin', 'coordinator']);
    await this.persistShiftOperation(`/api/shifts/${encodeURIComponent(shiftId)}/payout`, 'PUT', { paymentProof });
  }

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
  private draftRecordShiftWaste(
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
  private draftAddShiftRestock(data: {
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
  public async recordShiftLeftovers(shiftId: string, returnedCounts: Record<string, number>): Promise<void> {
    this.requireCentralOperation(['admin', 'coordinator', 'seller']);
    await this.persistShiftOperation(`/api/shifts/${encodeURIComponent(shiftId)}/leftovers`, 'POST', { returnedItems: Object.entries(returnedCounts).map(([varietyId, count]) => ({ varietyId, count })) });
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
  /** Crea en el servidor antes de publicar el perfil local; falla cerrado sin sesión admin. */
  public async createUser(userData: Omit<UserProfile, 'id'> & { password?: string }): Promise<UserProfile> {
    const id = `USR-${crypto.randomUUID()}`;
    const newUser = await this.persistUserChange('/api/users', 'POST', { ...userData, id });
    this.state.users = [...this.state.users, newUser];
    this.addAuditLog('CREAR_USUARIO', 'usuarios', newUser.id, `Creación de usuario: ${newUser.name} con rol ${newUser.role} confirmada en backend`);
    this.saveState();
    return newUser;
  }

  /** Una actualización rechazada no modifica el perfil, rol ni credenciales locales. */
  public async updateUser(userId: string, updates: UserCredentialInput): Promise<void> {
    const previousUser = this.state.users.find((user) => user.id === userId);
    if (!previousUser) throw new Error('No se encontró el perfil a modificar.');
    const updatedUser = await this.persistUserChange(`/api/users/${encodeURIComponent(userId)}`, 'PUT', updates);
    if (updatedUser.id !== userId) throw new Error('El servidor no confirmó el perfil solicitado.');
    this.state.users = this.state.users.map((user) => user.id === userId ? updatedUser : user);
    this.addAuditLog('ACTUALIZAR_USUARIO', 'usuarios', userId,
      `Modificación de perfil de ${updatedUser.name}. Rol: ${updatedUser.role} (anterior: ${previousUser.role}) confirmada en backend`);
    // Cambiar las credenciales/rol de la sesión activa requiere autenticación
    // central nueva; no adoptar un rol nuevo desde metadatos locales.
    if (this.state.currentUser?.id === userId) {
      this.logout();
    } else {
      this.saveState();
    }
  }

  /** PIN/password solo viajan en esta petición, jamás al caché o registro de auditoría. */
  private async persistUserChange(url: string, method: 'POST' | 'PUT', input: UserCredentialInput): Promise<UserProfile> {
    if (this.state.currentUser?.role !== 'admin') {
      throw new Error('Se requiere una sesión de administrador validada por el servidor.');
    }
    let response: Response;
    let result: { success?: boolean; user?: UserProfile; error?: string; message?: string };
    try {
      response = await authenticatedFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      result = await response.json();
    } catch {
      throw new Error('No se pudo conectar con el servidor. El perfil no se guardó.');
    }
    if (!response.ok || result.success !== true) {
      throw new Error(result.error || result.message || 'El servidor rechazó la modificación del perfil.');
    }
    if (!result.user?.id) {
      throw new Error('El servidor no confirmó un perfil actualizado.');
    }
    return this.withoutCredentials(result.user);
  }

  public async toggleUserActive(userId: string): Promise<void> {
    const user = this.state.users.find((profile) => profile.id === userId);
    if (!user) throw new Error('No se encontró el perfil a modificar.');
    await this.updateUser(userId, { isActive: !user.isActive });
  }

  // --- 11. Configuración General Exclusiva de Administrador ---
  /** Configuración administrativa: caché sólo después del ACK del servidor. */
  private async persistConfiguration(endpoint: string, method: string, payload: unknown): Promise<void> {
    if (!this.state.currentUser || this.state.currentUser.role !== 'admin') throw new Error('Se requiere administrador.');
    if (!this.state.isOnline) throw new Error('Los cambios de configuración necesitan conexión.');
    const response = await authenticatedFetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok || !result.success || !result.catalog) throw new Error(result.message || 'El servidor no confirmó el cambio.');
    const catalog = result.catalog;
    this.state.systemConfig = catalog.systemConfig;
    this.state.houses = catalog.houses;
    this.state.carts = catalog.carts;
    this.state.varieties = catalog.varieties;
    this.state.zones = catalog.zones;
    this.saveState();
  }

  public async updateSystemConfig(configData: Partial<SystemConfig>): Promise<void> {
    await this.persistConfiguration('/api/settings', 'PUT', { ...this.state.systemConfig, ...configData });
  }
  public getCommissionTiers(): CommissionTier[] { return this.state.systemConfig?.commissionTiers || []; }
  public async saveCommissionTiers(tiers: CommissionTier[]): Promise<void> {
    await this.updateSystemConfig({ commissionTiers: tiers });
  }
  public async addCommissionTier(tierData: Omit<CommissionTier, 'id'>): Promise<CommissionTier> {
    const newTier = { ...tierData, id: `TIER-${crypto.randomUUID()}` };
    await this.saveCommissionTiers([...this.getCommissionTiers(), newTier]);
    return newTier;
  }
  public async updateCommissionTier(tierId: string, updates: Partial<CommissionTier>): Promise<void> {
    await this.saveCommissionTiers(this.getCommissionTiers().map(tier => tier.id === tierId ? { ...tier, ...updates } : tier));
  }
  public async deleteCommissionTier(tierId: string): Promise<void> {
    // Desactivar conserva el tramo para lectura histórica y auditoría.
    await this.updateCommissionTier(tierId, { isActive: false });
  }
  public async toggleCommissionTier(tierId: string): Promise<void> {
    const tier = this.getCommissionTiers().find(candidate => candidate.id === tierId);
    if (!tier) throw new Error('Tramo no encontrado.');
    await this.updateCommissionTier(tierId, { isActive: !tier.isActive });
  }
  public async resetCommissionTiersToDefault(): Promise<void> { await this.saveCommissionTiers(structuredClone(INITIAL_COMMISSION_TIERS)); }
  public async saveZones(zones: BeachZone[]): Promise<void> { await this.persistConfiguration('/api/zones', 'PUT', zones); }
  public async adjustHouseStock(houseId: string, varietyId: string, quantity: number, reason: string): Promise<void> {
    await this.persistConfiguration(`/api/houses/${encodeURIComponent(houseId)}/stock`, 'PUT', { varietyId, quantity, reason });
  }
  public async createCart(cartData: Omit<SellingCart, 'id'>): Promise<SellingCart> {
    const id = `CART-${crypto.randomUUID()}`;
    await this.persistConfiguration('/api/carts', 'POST', { id, attributes: cartData });
    return this.state.carts.find(cart => cart.id === id)!;
  }
  public async updateCart(cartId: string, updates: Partial<SellingCart>): Promise<void> {
    await this.persistConfiguration(`/api/carts/${encodeURIComponent(cartId)}`, 'PATCH', updates);
  }
  public async toggleCartActive(cartId: string): Promise<void> {
    const cart = this.state.carts.find(candidate => candidate.id === cartId);
    if (!cart) throw new Error('Carrito no encontrado.');
    await this.updateCart(cartId, { isActive: !cart.isActive });
  }
  public async createVariety(attributes: Omit<ProductVariety, 'id'>): Promise<ProductVariety> {
    const id = `VAR-${crypto.randomUUID()}`;
    await this.persistConfiguration('/api/varieties', 'POST', { id, attributes });
    return this.state.varieties.find(variety => variety.id === id)!;
  }
  public async updateVariety(id: string, updates: Partial<ProductVariety>): Promise<void> {
    await this.persistConfiguration(`/api/varieties/${encodeURIComponent(id)}`, 'PATCH', updates);
  }
  public async toggleVarietyActive(id: string): Promise<void> {
    const variety = this.state.varieties.find(candidate => candidate.id === id);
    if (!variety) throw new Error('Variedad no encontrada.');
    await this.updateVariety(id, { isActive: !variety.isActive });
  }
  public async createHouse(attributes: Omit<OperationalHouse, 'id'>): Promise<OperationalHouse> {
    const id = `HOUSE-${crypto.randomUUID()}`;
    await this.persistConfiguration('/api/houses', 'POST', { id, attributes });
    return this.state.houses.find(house => house.id === id)!;
  }
  public async updateHouse(id: string, updates: Partial<OperationalHouse>): Promise<void> {
    await this.persistConfiguration(`/api/houses/${encodeURIComponent(id)}`, 'PATCH', updates);
  }
  public async toggleHouseActive(id: string): Promise<void> {
    const house = this.state.houses.find(candidate => candidate.id === id);
    if (!house) throw new Error('Casa no encontrada.');
    await this.updateHouse(id, { isActive: !house.isActive });
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

  // --- 11. Reportes de Estado de Playa en Vivo ---
  public createBeachReport(data: {
    sellerId: string;
    sellerName: string;
    shiftId?: string;
    locality: string;
    sectorDetails?: string;
    tide: TideCondition;
    crowdLevel: CrowdLevel;
    reportType: BeachReportType;
    comments: string;
    temperatureOrWeather?: string;
  }): BeachConditionReport {
    const reportId = `BREP-${Date.now()}`;
    const newReport: BeachConditionReport = {
      id: reportId,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      ...data
    };

    this.state.beachReports = [newReport, ...(this.state.beachReports || [])];

    // Disparar Alerta Operativa para Coordinador y Administrador
    const alertLevel = data.reportType === 'inconveniente' ? 'advertencia' : 'informativa';
    const titlePrefix = data.reportType === 'inconveniente'
      ? '⚠️ Inconveniente en Playa'
      : data.reportType === 'oportunidad'
      ? '🔥 Oportunidad Comercial'
      : data.reportType === 'cambio_de_zona'
      ? '🔄 Cambio de Sector'
      : 'ℹ️ Estado de Playa';

    this.state.alerts.unshift({
      id: `ALT-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      level: alertLevel,
      title: `${titlePrefix}: ${data.locality}`,
      message: `${data.sellerName} en ${data.locality} (${data.sectorDetails || 'Playa'}): ${data.comments}. Marea: ${data.tide.replace(/_/g, ' ')}, Afluencia: ${data.crowdLevel}.`,
      category: 'clima',
      relatedEntityId: reportId,
      isRead: false,
      resolved: false
    });

    this.addAuditLog(
      'REPORTE_ESTADO_PLAYA',
      'jornada',
      reportId,
      `Reporte de playa en ${data.locality} (${data.reportType}) por ${data.sellerName}: ${data.comments}`
    );

    this.saveState();
    return newReport;
  }

  // --- 12. Gestión de Temporadas ---
  public setActiveSeason(season: string): void {
    this.state.activeSeason = season;
    if (!this.state.availableSeasons.includes(season)) {
      this.state.availableSeasons.push(season);
    }
    this.addAuditLog('CAMBIO_TEMPORADA', 'configuracion', season, `Se seleccionó como activa la ${season}`);
    this.saveState();
  }

  public createSeason(seasonName: string): void {
    if (!this.state.availableSeasons.includes(seasonName)) {
      this.state.availableSeasons.push(seasonName);
      this.addAuditLog('CREAR_TEMPORADA', 'configuracion', seasonName, `Nueva temporada creada: ${seasonName}`);
      this.saveState();
    }
  }

  // --- Reset a datos iniciales de fábrica ---
  public resetToFactorySeed(): void {
    if (this.state.currentUser?.role !== 'admin') {
      throw new Error('Solo el administrador puede reiniciar una demostración local.');
    }
    if (!this.state.demoMode) {
      throw new Error('El reinicio de datos de producción está deshabilitado.');
    }
    if (this.readOfflineQueue().length || this.readPendingOperations().length || this.state.sales.some((sale) => sale.syncStatus === 'pending')) {
      throw new Error('Hay ventas pendientes. Sincronizalas antes de reiniciar; no se borró ningún dato.');
    }
    void this.logout();
    this.state = {
      currentUser: null,
      selectedHouseId: 'HOUSE-NORTE',
      isOnline: true,
      activeSeason: 'Temporada 2026-2027',
      availableSeasons: ['Temporada 2026-2027', 'Temporada 2027-2028', 'Temporada 2028-2029'],
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
      beachReports: INITIAL_BEACH_REPORTS,
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
