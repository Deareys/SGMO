/**
 * SGMO — Tequeños Costa
 * Definiciones de Tipos del Sistema de Gestión y Monitoreo de Operación
 */

export type UserRole = 'admin' | 'coordinator' | 'seller' | 'factory_worker';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  pin?: string; // Código PIN para inicio de sesión seguro
  avatarUrl?: string;
  assignedHouseId?: string; // Para coordinadores, vendedores y residentes
  commissionRate: number; // Porcentaje de comisión estándar (ej: 0.20 = 20%)
  housingCostExempt?: boolean; // Excepción: exento de costo de vivienda
  housingCostOverride?: number; // Excepción: costo de vivienda personalizado
  isActive: boolean;
  notes?: string;
  permissions?: string[];
}

// 1. Materias Primas, Insumos y Categorías
export interface SupplyCategory {
  id: string;
  name: string; // ej: "Harinas & Masas", "Quesos & Rellenos", "Aderezos & Salsas", "Packaging & Descartables", "Gas & Combustibles", "Otros Insumos"
  description?: string;
}

export interface RawMaterial {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  unit: 'kg' | 'litro' | 'unidad' | 'paquete' | 'gramos' | 'cc';
  currentStock: number;
  minStockAlert: number;
  costPerUnit: number; // Costo de compra actual
  supplierId?: string;
  supplier: string;
  lastPurchaseDate: string;
  isActive: boolean;
  priceHistory?: {
    date: string;
    costPerUnit: number;
    supplier?: string;
  }[];
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone: string;
  email?: string;
  address?: string;
  suppliedCategoryIds: string[];
  suppliedMaterialIds: string[];
  notes?: string;
  isActive: boolean;
}

export interface MaterialPurchase {
  id: string;
  date: string;
  materialId: string;
  materialName: string;
  supplierId?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  supplier: string;
  invoiceNumber?: string;
  registeredBy: string;
}

// 2. Productos, Variedades, Combos y Precios
export interface CustomCombo {
  id: string;
  name: string; // ej: "Combo 3 Unidades", "Combo 6 Unidades", "Super Promo 20 Tequeños"
  unitsEquivalent: number;
  price: number;
  isDefault?: boolean;
}

export interface ProductVariety {
  id: string;
  name: string; // ej: "Tequeño Clásico Queso Vegano", "Tequeño Ahumado & Finas Hierbas", "Tequeño Dulce de Membrillo", "Mayonesa de Zanahoria"
  category?: 'tequeno' | 'aderezo' | 'otro';
  description: string;
  isAvailable: boolean;
  isActive: boolean; // Soft delete para preservar historial de ventas
  basePriceIndividual: number; // Precio por unidad individual
  comboPrices: {
    combo3: number;
    combo6: number;
    combo12: number;
    [key: string]: number;
  };
  customCombos?: CustomCombo[];
}

// 3. Recetas y Órdenes de Producción (Fábrica / Cocina)
export type ProductionType = 'tequenos' | 'aderezos_salsas' | 'masas' | 'otros';

export interface RecipeIngredient {
  materialId: string;
  materialName: string;
  quantityRequired: number; // Cantidad requerida para el rendimiento esperado
  unit: string;
}

export interface ProductionRecipe {
  id: string;
  name: string; // ej: "Receta Mayonesa de Zanahoria", "Receta Tequeño Clásico 500u"
  type: ProductionType;
  varietyId?: string; // Vinculación a variedad si genera producto final
  outputUnit: 'unidad' | 'kg' | 'litro' | 'pote';
  expectedYield: number; // Rendimiento estándar esperado (ej: 20 kg o 500 unidades)
  ingredients: RecipeIngredient[];
  estimatedLaborCost: number;
  estimatedEnergyPackagingCost: number;
  instructions?: string;
  isActive: boolean;
}

export interface ProductionOrder {
  id: string; // ej: "ORD-20260831-01"
  recipeId: string;
  productName: string;
  type?: ProductionType;
  requestedQuantity: number;
  requestedUnit: string;
  targetDate: string;
  targetShift?: 'manana' | 'tarde' | 'noche';
  assignedResponsibleId?: string;
  assignedResponsibleName?: string;
  assignedWorkerName?: string;
  status: 'pendiente' | 'en_proceso' | 'completada' | 'cancelada';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  realProducedQuantity?: number;
  wasteQuantity?: number;
  wasteReason?: string;
  ingredientsUsedReal?: {
    materialId: string;
    materialName: string;
    quantity: number;
    cost: number;
  }[];
  generatedBatchId?: string;
  productionNotes?: string;
  efficiencyPercent?: number;
}

export interface FactoryIncident {
  id: string;
  timestamp: string;
  reportedBy: string;
  type: 'falta_materia_prima' | 'falla_maquinaria' | 'merma_excesiva' | 'espacio_freezer' | 'falta_envases' | 'otro';
  severity: 'baja' | 'media' | 'alta' | 'critica';
  message: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedNotes?: string;
}

export interface ProductionBatch {
  id: string; // ej: "LOT-20260831-01"
  date: string;
  varietyId: string;
  varietyName: string;
  unitsProduced: number;
  ingredientsUsed: {
    materialId: string;
    materialName: string;
    quantity: number;
    cost: number;
  }[];
  laborCost: number;
  energyAndPackagingCost: number;
  totalBatchCost: number;
  unitCostCalculated: number; // Costo real de fabricación por unidad
  status: 'en_camara_central' | 'distribuido' | 'agotado';
  remainingUnitsInCentral: number;
  notes?: string;
}

// 4. Casas / Bases Operativas & Almacenamiento
export interface OperationalHouse {
  id: string;
  name: string; // ej: "Casa Norte - Calle 65", "Casa Sur - Calle 15"
  address: string;
  coordinatorIds: string[];
  residentUserIds?: string[]; // Personas asignadas a la vivienda
  freezerCapacityUnits: number;
  fixedCostDaily?: number; // Costo operativo propio de la casa
  isActive: boolean;
  currentStock: {
    varietyId: string;
    varietyName: string;
    quantity: number;
  }[];
  consumablesStock: {
    gasTanksAvailable: number; // Garrafas llenas
    gasTanksInUse: number;
    napkinPacks: number;
    traysCount: number;
    paperConesCount: number;
    sauceBottlesCount: number;
  };
}

// 5. Carritos y Mantenimiento
export type CartStatus = 'operativo' | 'en_revision' | 'en_reparacion' | 'fuera_de_servicio';

export interface CartIncident {
  id: string;
  date: string;
  cartId: string;
  reportedBy: string;
  type: 'rueda' | 'frenos' | 'quemador_gas' | 'estructura' | 'limpieza' | 'electrico' | 'otro';
  description: string;
  status: 'reportado' | 'en_revision' | 'pendiente' | 'en_reparacion' | 'solucionado';
  costOfRepair?: number;
  resolvedDate?: string;
  resolutionNotes?: string;
}

export interface SellingCart {
  id: string; // ej: "CART-01"
  code: string; // "Carrito 01 - Costa Dorada"
  model?: string;
  houseId: string;
  status: CartStatus;
  currentSellerId?: string;
  gasLevelPercent: number; // 0% a 100%
  suppliesLevel: {
    napkins: 'alto' | 'medio' | 'bajo' | 'agotado';
    cones: 'alto' | 'medio' | 'bajo' | 'agotado';
    trays: 'alto' | 'medio' | 'bajo' | 'agotado';
    sauces: 'alto' | 'medio' | 'bajo' | 'agotado';
  };
  lastMaintenanceDate: string;
  totalDaysInUse: number;
  notes?: string;
  locationNotes?: string; // Notas de ubicación / recorrido
  isActive: boolean; // Soft delete
}

// 5. Zonas de Playa
export interface BeachZone {
  id: string;
  name: string; // ej: "Zona 1: Calle 63 a Calle 25"
  description: string;
  touristAffluence: 'alta' | 'media' | 'baja';
  avgDailySalesUnits: number;
  recommendedStartUnits: number;
}

// 6. Jornadas Diarias de Venta
export type ShiftStatus = 'planificada' | 'en_curso' | 'esperando_cierre' | 'conciliada' | 'liquidada';

export type WasteReason = 
  | 'producto_danado'
  | 'producto_caido'
  | 'producto_quemado'
  | 'producto_descongelado'
  | 'producto_descartado'
  | 'otro';

export interface ShiftWasteRecord {
  id: string;
  shiftId: string;
  timestamp: string; // ISO / YYYY-MM-DD HH:mm:ss
  sellerId: string;
  sellerName: string;
  varietyId: string;
  varietyName: string;
  quantity: number;
  reason: WasteReason | string;
  reasonLabel: string;
  notes?: string;
}

export interface ShiftRestockRecord {
  id: string;
  shiftId: string;
  timestamp: string; // ISO / YYYY-MM-DD HH:mm:ss
  sellerId: string;
  sellerName: string;
  coordinatorId: string;
  coordinatorName: string;
  varietyId: string;
  varietyName: string;
  quantity: number;
  originLocation: string; // Ej: "Base Norte — Calle 65"
  destinationLocation: string; // Ej: "Carrito C-01 — Zona 2 (Playa)"
  notes?: string;
}

export interface ShiftStockItem {
  varietyId: string;
  varietyName: string;
  deliveredUnits: number; // Lo que entrega el coordinador a la mañana
  reSuppliedUnits: number; // Entregas adicionales durante el día si hubo reposición
  soldUnits: number; // Según registro de ventas
  returnedUnits: number; // Contados físicamente al final del día
  wasteUnits: number; // Merma / caída al suelo / tequeño roto justificado
  differenceUnits: number; // delivered + reSupplied - sold - returned - waste
}

export type PaymentMethod = 'efectivo' | 'mercado_pago' | 'transferencia';

export type VoucherValidationStatus = 
  | 'validada'            // 🟢 Validado (Coincide monto, fecha y existe en MP)
  | 'pendiente_revision'  // 🟡 Pendiente de revisar / procesando IA
  | 'inconsistente'       // 🔴 Inconsistencia en monto o fecha
  | 'sospechosa';         // ⚠️ Sospecha de duplicidad o comprobante editado

export interface SaleTransaction {
  id: string;
  shiftId: string;
  sellerId: string;
  sellerName: string;
  timestamp: string;
  itemType: 'unidad' | 'combo3' | 'combo6' | 'combo12' | 'adicional';
  varietyId: string;
  varietyName: string;
  quantityUnitsEquivalent: number; // ej: combo6 = 6 unidades
  totalAmount: number;
  paymentMethod: PaymentMethod;
  
  // Localidad y sector de playa específico de la venta
  locationName?: string; // ej: "Santa Teresita", "Mar del Tuyú", "Costa del Este", "Las Toninas", "San Bernardo"
  beachSector?: string; // ej: "Muelle / Calle 38", "Bajada Calle 68", "Parador Pinar"

  // Datos de comprobante de transferencia (Mercado Pago o Transferencia Bancaria)
  voucherPhotoUrl?: string;
  voucherExtractedData?: {
    operationId?: string;
    amount?: number;
    date?: string;
    time?: string;
    senderName?: string;
    destinationAccount?: string;
    confidenceScore?: number;
    aiNotes?: string;
  };
  validationStatus: VoucherValidationStatus;
  mpApiVerification?: {
    matchedInApi: boolean;
    mpTransactionId?: string;
    apiStatus?: string;
    verifiedAt?: string;
  };

  gpsLocation?: {
    lat: number;
    lng: number;
    zoneName?: string;
  };
  isOfflineCreated?: boolean;
}

export interface DailyShift {
  id: string;
  date: string;
  houseId: string;
  houseName: string;
  coordinatorId: string;
  coordinatorName: string;
  sellerId: string;
  sellerName: string;
  cartId: string;
  cartCode: string;
  zoneId: string;
  zoneName: string;
  status: ShiftStatus;
  
  // Stock
  stockItems: ShiftStockItem[];
  
  // Consumibles entregados
  suppliesProvided: {
    gasPercentStart: number;
    gasPercentEnd?: number;
    napkinsDelivered: number;
    conesDelivered: number;
    saucesProvided: string[];
  };

  // Horarios
  startTime: string;
  endTime?: string;

  // Resumen Financiero de Jornada
  totalGrossSales: number;
  totalCashSales: number;
  totalMpSales: number;
  totalTransferSales?: number;
  season?: string; // ej: "Temporada 2026-2027"
  
  cashExpected: number;
  cashDeclared: number;
  cashDifference: number; // Declared - Expected

  mpValidatedAmount: number;
  mpPendingOrSuspiciousAmount: number;

  totalUnitsDelivered: number;
  totalUnitsRestocked?: number;
  totalUnitsSold: number;
  totalUnitsReturned: number;
  totalUnitsWaste?: number;
  totalUnitsDifference: number;

  // Registro histórico de entregas adicionales (Restocks) y Mermas
  restocks?: ShiftRestockRecord[];
  wasteRecords?: ShiftWasteRecord[];

  // Liquidación del Vendedor
  commissionRate: number; // ej: 0.20 (20%)
  appliedCommissionTierId?: string; // ID del tramo de comisión aplicado
  appliedCommissionTierName?: string; // Nombre del tramo alcanzado (ej: "Tramo Intermedio ($110.000 a $220.000) - 20%")
  grossCommission: number;
  housingCostDeduction: number; // Costo de vivienda por persona descontado (ej: $8.000)
  housingCostExempt?: boolean;
  deductionsForMissingUnits: number;
  incentivesOrBonuses: number;
  finalPayoutAmount: number;
  payoutStatus: 'pendiente' | 'pagado' | 'retenido_revision';
  payoutTimestamp?: string;
  payoutPaymentProof?: string;

  notes?: string;
  coordinatorSignature?: string;
}

// 7. Configuración General del Sistema y Tramos de Comisión (Exclusivo Administrador)
export interface CommissionTier {
  id: string;
  name: string; // ej: "Hasta $110.000", "De $110.000 a $220.000", etc.
  minSales: number; // Monto mínimo de ventas (o mayor a este monto)
  maxSales: number | null; // Monto tope de ventas (inclusive), null indica sin límite superior (en adelante)
  rate: number; // Porcentaje en decimal (ej: 0.10 para 10%, 0.20 para 20%, 0.30 para 30%)
  isActive: boolean; // Activo o desactivado
}

export interface SystemConfig {
  housingCostPerPersonDaily: number; // Costo por persona por jornada (ej: 8000)
  defaultCommissionRate: number; // ej: 0.20 (20%)
  commissionTiers: CommissionTier[]; // Tramos configurables de recompensas / porcentaje de comisión
  deductionRatePerMissingUnit: number; // ej: 1500
  lowStockAlertThreshold: number;
  systemName: string;
  updatedAt?: string;
  updatedBy?: string;
}

// 8. Costos Operativos y Gastos Fijos
export interface OperationalExpense {
  id: string;
  date: string;
  category: 'alquiler_casa' | 'logistica_flete' | 'mantenimiento' | 'gas_combustible' | 'sueldos_coordinacion' | 'packaging_insumos' | 'otro';
  houseId?: string;
  description: string;
  amount: number;
  receiptNumber?: string;
  registeredBy: string;
}

// 8. Alertas Operativas Inteligentes
export interface OperationalAlert {
  id: string;
  timestamp: string;
  level: 'critica' | 'advertencia' | 'informativa';
  title: string;
  message: string;
  category: 'stock' | 'comprobante' | 'mantenimiento' | 'diferencia_caja' | 'liquidacion' | 'clima';
  relatedEntityId?: string;
  isRead: boolean;
  resolved: boolean;
}

// 9. Logs de Auditoría
export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  entityType: 'stock' | 'venta' | 'jornada' | 'liquidacion' | 'carrito' | 'comprobante' | 'produccion' | 'usuarios' | 'configuracion';
  entityId: string;
  details: string;
  previousValue?: string;
  newValue?: string;
}

// 10. Traslados entre Centro y Casas
export interface StockTransfer {
  id: string;
  date: string;
  fromLocation: 'Camara Central' | string;
  toHouseId: string;
  toHouseName: string;
  transferredBy: string;
  items: {
    varietyId: string;
    varietyName: string;
    quantity: number;
  }[];
  status: 'en_transito' | 'recibido_conforme' | 'con_diferencia';
  notes?: string;
}

// 11. Reportes de Estado de Playa y Mareas en Tiempo Real
export type TideCondition = 'marea_baja' | 'marea_normal' | 'marea_alta' | 'sin_playa_marea_llena';
export type CrowdLevel = 'muy_alta' | 'alta' | 'media' | 'baja' | 'desierta';
export type BeachReportType = 'estado_general' | 'oportunidad' | 'inconveniente' | 'cambio_de_zona';

export interface BeachConditionReport {
  id: string;
  timestamp: string;
  sellerId: string;
  sellerName: string;
  shiftId?: string;
  locality: string; // ej: "Santa Teresita", "Mar del Tuyú", "Costa del Este", "Las Toninas", "San Bernardo"
  sectorDetails?: string; // ej: "Bajada Calle 32 - Parador", "Zona Muelle", "Calle 68"
  tide: TideCondition;
  crowdLevel: CrowdLevel;
  reportType: BeachReportType;
  comments: string;
  temperatureOrWeather?: string;
}

