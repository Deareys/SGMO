/**
 * SGMO — Tequeños Costa
 * Datos Iniciales y Semilla de Operación Costera
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
  ProductionBatch,
  OperationalHouse,
  SellingCart,
  BeachZone,
  DailyShift,
  SaleTransaction,
  OperationalExpense,
  OperationalAlert,
  AuditLog,
  StockTransfer,
  CartIncident,
  CommissionTier,
  SystemConfig
} from './types';

export const INITIAL_COMMISSION_TIERS: CommissionTier[] = [
  {
    id: 'TIER-1',
    name: 'Tramo Inicial (Hasta $110.000)',
    minSales: 0,
    maxSales: 110000,
    rate: 0.10, // 10%
    isActive: true
  },
  {
    id: 'TIER-2',
    name: 'Tramo Intermedio ($110.000 a $220.000)',
    minSales: 110000,
    maxSales: 220000,
    rate: 0.20, // 20%
    isActive: true
  },
  {
    id: 'TIER-3',
    name: 'Tramo Avanzado ($220.000 a $330.000)',
    minSales: 220000,
    maxSales: 330000,
    rate: 0.30, // 30%
    isActive: true
  },
  {
    id: 'TIER-4',
    name: 'Tramo Superior (Más de $330.000)',
    minSales: 330000,
    maxSales: null, // Sin límite superior
    rate: 0.30, // 30%
    isActive: true
  }
];

export const INITIAL_SYSTEM_CONFIG: SystemConfig = {
  housingCostPerPersonDaily: 8000,
  defaultCommissionRate: 0.20,
  commissionTiers: INITIAL_COMMISSION_TIERS,
  deductionRatePerMissingUnit: 1500,
  lowStockAlertThreshold: 50,
  systemName: 'SGMO — Tequeños Costa',
  updatedAt: '2026-08-31 09:00',
  updatedBy: 'Carlos Mendoza'
};

export const INITIAL_SUPPLY_CATEGORIES: SupplyCategory[] = [
  { id: 'CAT-HARINAS', name: 'Harinas & Masas', description: 'Harinas especiales, polvos de hornear y mejoradores' },
  { id: 'CAT-QUESOS', name: 'Quesos & Rellenos', description: 'Quesos veganos en barra, ahumados y pastas de frutas' },
  { id: 'CAT-ADEREZOS', name: 'Aderezos & Salsas Caseras', description: 'Mayonesas artesanales, aliolis y chutneys elaborados' },
  { id: 'CAT-ACEITES', name: 'Aceites & Materias Grasas', description: 'Aceites de girasol alto oleico y freidoras' },
  { id: 'CAT-PACKAGING', name: 'Packaging & Descartables', description: 'Conos térmicos, servilletas, bandejas y potes para salsa' },
  { id: 'CAT-GAS', name: 'Gas & Combustibles', description: 'Garrafas de 10kg/15kg y reguladores de presión' },
  { id: 'CAT-OTROS', name: 'Otros Insumos & Limpieza', description: 'Desinfectantes, guantes y condimentos' }
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'SUP-01',
    name: 'Molinos del Plata SA',
    contactName: 'Roberto Giménez',
    phone: '+54 9 11 4455-6677',
    email: 'ventas@molinosdelplata.com.ar',
    address: 'Parque Industrial Ruta 2, Km 45',
    suppliedCategoryIds: ['CAT-HARINAS'],
    suppliedMaterialIds: ['MAT-HARINA'],
    notes: 'Entrega semanal los días martes. Pago a 15 días.',
    isActive: true
  },
  {
    id: 'SUP-02',
    name: 'PlantBased Dairy Co.',
    contactName: 'Lucía Santillán',
    phone: '+54 9 11 8899-2233',
    email: 'pedidos@plantbaseddairy.com',
    address: 'Av. Libertador 3200, CABA',
    suppliedCategoryIds: ['CAT-QUESOS'],
    suppliedMaterialIds: ['MAT-QUESO-VEG'],
    notes: 'Queso barra vegetal con punto de fusión a 65°C.',
    isActive: true
  },
  {
    id: 'SUP-03',
    name: 'Distribuidora Costa Atlántica',
    contactName: 'Gonzalo Farias',
    phone: '+54 9 223 456-7890',
    email: 'contacto@districosta.com.ar',
    address: 'Av. Juan B. Justo 4500, Mar del Plata',
    suppliedCategoryIds: ['CAT-ACEITES', 'CAT-OTROS'],
    suppliedMaterialIds: ['MAT-ACEITE', 'MAT-ZANAHORIA', 'MAT-ZUCCHINI', 'MAT-AJO'],
    notes: 'Proveedor local diario de vegetales frescos y aceites.',
    isActive: true
  },
  {
    id: 'SUP-04',
    name: 'Envases Ecológicos SA',
    contactName: 'Mariana Duarte',
    phone: '+54 9 11 3344-7788',
    email: 'mduarte@envasoseco.com',
    address: 'Camino de Cintura 1280, Buenos Aires',
    suppliedCategoryIds: ['CAT-PACKAGING'],
    suppliedMaterialIds: ['MAT-PACKAGING', 'MAT-POTES-SALSA'],
    notes: 'Papel kraft antigrasa y conos biodegradables.',
    isActive: true
  },
  {
    id: 'SUP-05',
    name: 'Gas Austral Costa',
    contactName: 'Héctor Paez',
    phone: '+54 9 223 667-1122',
    email: 'garrafas@gasaustral.com.ar',
    address: 'Ruta 11 y Acceso Norte',
    suppliedCategoryIds: ['CAT-GAS'],
    suppliedMaterialIds: ['MAT-GARRAFA'],
    notes: 'Cambio de garrafas vacías por llenas a domicilio.',
    isActive: true
  }
];

export const INITIAL_USERS: UserProfile[] = [
  {
    id: 'USR-ADMIN-1',
    name: 'Carlos Mendoza',
    email: 'carlos.admin@tequenosplaya.com',
    role: 'admin',
    phone: '+54 9 11 5544-2211',
    pin: '1234',
    commissionRate: 0,
    housingCostExempt: true,
    isActive: true,
    notes: 'Socio fundador y director general de operaciones'
  },
  {
    id: 'USR-COORD-1',
    name: 'Mateo Roldán',
    email: 'mateo.coord@tequenosplaya.com',
    role: 'coordinator',
    phone: '+54 9 223 445-8899',
    pin: '2233',
    assignedHouseId: 'HOUSE-NORTE',
    commissionRate: 0.05, // Bono coordinador
    housingCostExempt: true,
    isActive: true,
    notes: 'Responsable Base Norte (Calles 65 a 25)'
  },
  {
    id: 'USR-COORD-2',
    name: 'Valeria Gómez',
    email: 'valeria.coord@tequenosplaya.com',
    role: 'coordinator',
    phone: '+54 9 223 998-1122',
    pin: '4455',
    assignedHouseId: 'HOUSE-SUR',
    commissionRate: 0.05,
    housingCostExempt: true,
    isActive: true,
    notes: 'Responsable Base Sur (Calles 25 a 01 y Faro)'
  },
  {
    id: 'USR-FAB-1',
    name: 'Marcos Benavídez',
    email: 'marcos.fabrica@tequenosplaya.com',
    role: 'factory_worker',
    phone: '+54 9 223 777-4411',
    pin: '5566',
    commissionRate: 0,
    housingCostExempt: true,
    isActive: true,
    notes: 'Jefe de Cuadra y Maestro Tequeñero en Planta Central'
  },
  {
    id: 'USR-FAB-2',
    name: 'Ana Laura Giménez',
    email: 'ana.cocina@tequenosplaya.com',
    role: 'factory_worker',
    phone: '+54 9 223 888-3322',
    pin: '7788',
    commissionRate: 0,
    housingCostExempt: true,
    isActive: true,
    notes: 'Especialista en salsas artesanales, aderezos y control de calidad'
  },
  {
    id: 'USR-VEND-1',
    name: 'Lucas Benítez',
    email: 'lucas.b@playa.com',
    role: 'seller',
    phone: '+54 9 11 6789-0123',
    pin: '1111',
    assignedHouseId: 'HOUSE-NORTE',
    commissionRate: 0.20, // 20%
    housingCostExempt: false,
    isActive: true,
    notes: 'Vendedor destacado - Zona Balnearios Centro'
  },
  {
    id: 'USR-VEND-2',
    name: 'Esteban Morales',
    email: 'esteban.m@playa.com',
    role: 'seller',
    phone: '+54 9 11 4321-9876',
    pin: '2222',
    assignedHouseId: 'HOUSE-NORTE',
    commissionRate: 0.18, // 18%
    housingCostExempt: false,
    isActive: true,
    notes: 'Vendedor habitual'
  },
  {
    id: 'USR-VEND-3',
    name: 'Micaela Rossi',
    email: 'micaela.r@playa.com',
    role: 'seller',
    phone: '+54 9 223 555-7788',
    pin: '3333',
    assignedHouseId: 'HOUSE-SUR',
    commissionRate: 0.20,
    housingCostExempt: false,
    isActive: true,
    notes: 'Vendedora experimentada - Zona Sur / Muelle'
  },
  {
    id: 'USR-VEND-4',
    name: 'Julián Castro',
    email: 'julian.c@playa.com',
    role: 'seller',
    phone: '+54 9 223 333-2211',
    pin: '4444',
    assignedHouseId: 'HOUSE-SUR',
    commissionRate: 0.18,
    housingCostExempt: false,
    isActive: true,
    notes: 'Vendedor nuevo - Primera temporada'
  }
];

export const INITIAL_VARIETIES: ProductVariety[] = [
  {
    id: 'VAR-CLASICO',
    name: 'Tequeño Clásico Queso Vegano',
    category: 'tequeno',
    description: 'Masa crocante artesanal rellena de queso vegano de almendras y castañas fundente.',
    isAvailable: true,
    isActive: true,
    basePriceIndividual: 1500,
    comboPrices: {
      combo3: 4000,
      combo6: 7500,
      combo12: 14000
    },
    customCombos: [
      { id: 'CMB-3', name: 'Combo Trío (3u)', unitsEquivalent: 3, price: 4000, isDefault: true },
      { id: 'CMB-6', name: 'Combo Clásico (6u)', unitsEquivalent: 6, price: 7500, isDefault: true },
      { id: 'CMB-12', name: 'Combo Docena (12u)', unitsEquivalent: 12, price: 14000, isDefault: true }
    ]
  },
  {
    id: 'VAR-AHUMADO',
    name: 'Tequeño Ahumado & Finas Hierbas',
    category: 'tequeno',
    description: 'Queso vegano ahumado a la leña con orégano silvestre, romero y oliva.',
    isAvailable: true,
    isActive: true,
    basePriceIndividual: 1600,
    comboPrices: {
      combo3: 4300,
      combo6: 8000,
      combo12: 15000
    },
    customCombos: [
      { id: 'CMB-3', name: 'Combo Trío (3u)', unitsEquivalent: 3, price: 4300, isDefault: true },
      { id: 'CMB-6', name: 'Combo Clásico (6u)', unitsEquivalent: 6, price: 8000, isDefault: true },
      { id: 'CMB-12', name: 'Combo Docena (12u)', unitsEquivalent: 12, price: 15000, isDefault: true }
    ]
  },
  {
    id: 'VAR-MEMBRILLO',
    name: 'Tequeño Dulce de Membrillo & Queso',
    category: 'tequeno',
    description: 'Tradicional pasta de dulce de membrillo rubio con queso cremoso vegano.',
    isAvailable: true,
    isActive: true,
    basePriceIndividual: 1600,
    comboPrices: {
      combo3: 4300,
      combo6: 8000,
      combo12: 15000
    },
    customCombos: [
      { id: 'CMB-3', name: 'Combo Trío (3u)', unitsEquivalent: 3, price: 4300, isDefault: true },
      { id: 'CMB-6', name: 'Combo Clásico (6u)', unitsEquivalent: 6, price: 8000, isDefault: true },
      { id: 'CMB-12', name: 'Combo Docena (12u)', unitsEquivalent: 12, price: 15000, isDefault: true }
    ]
  },
  {
    id: 'VAR-DULCE',
    name: 'Tequeño Dulce Guayaba & Queso',
    category: 'tequeno',
    description: 'Deliciosa combinación de dulce de guayaba tropical con queso cremoso vegano.',
    isAvailable: true,
    isActive: true,
    basePriceIndividual: 1600,
    comboPrices: {
      combo3: 4300,
      combo6: 8000,
      combo12: 15000
    }
  },
  {
    id: 'VAR-MAYO-ZANAHORIA',
    name: 'Mayonesa de Zanahoria Artesanal',
    category: 'aderezo',
    description: 'Salsa untable cremosa elaborada a base de zanahorias asadas, oliva y especias.',
    isAvailable: true,
    isActive: true,
    basePriceIndividual: 800,
    comboPrices: { combo3: 2200, combo6: 4000, combo12: 7500 }
  },
  {
    id: 'VAR-ALIOLI-ZUCCHINI',
    name: 'Alioli de Zucchini & Ajo Asado',
    category: 'aderezo',
    description: 'Aderezo emulsionado ligero de zucchini grillado con toque de ajo confitado.',
    isAvailable: true,
    isActive: true,
    basePriceIndividual: 800,
    comboPrices: { combo3: 2200, combo6: 4000, combo12: 7500 }
  }
];

export const INITIAL_RAW_MATERIALS: RawMaterial[] = [
  {
    id: 'MAT-HARINA',
    name: 'Harina de Trigo 0000 Especial',
    categoryId: 'CAT-HARINAS',
    categoryName: 'Harinas & Masas',
    unit: 'kg',
    currentStock: 450,
    minStockAlert: 100,
    costPerUnit: 850,
    supplierId: 'SUP-01',
    supplier: 'Molinos del Plata SA',
    lastPurchaseDate: '2026-08-25',
    isActive: true,
    priceHistory: [
      { date: '2026-08-01', costPerUnit: 780, supplier: 'Molinos del Plata SA' },
      { date: '2026-08-25', costPerUnit: 850, supplier: 'Molinos del Plata SA' }
    ]
  },
  {
    id: 'MAT-QUESO-VEG',
    name: 'Queso Vegano en Barra Artesanal',
    categoryId: 'CAT-QUESOS',
    categoryName: 'Quesos & Rellenos',
    unit: 'kg',
    currentStock: 180,
    minStockAlert: 50,
    costPerUnit: 5200,
    supplierId: 'SUP-02',
    supplier: 'PlantBased Dairy Co.',
    lastPurchaseDate: '2026-08-26',
    isActive: true,
    priceHistory: [
      { date: '2026-08-10', costPerUnit: 4900, supplier: 'PlantBased Dairy Co.' },
      { date: '2026-08-26', costPerUnit: 5200, supplier: 'PlantBased Dairy Co.' }
    ]
  },
  {
    id: 'MAT-ACEITE',
    name: 'Aceite de Girasol Alto Oleico',
    categoryId: 'CAT-ACEITES',
    categoryName: 'Aceites & Materias Grasas',
    unit: 'litro',
    currentStock: 120,
    minStockAlert: 40,
    costPerUnit: 1950,
    supplierId: 'SUP-03',
    supplier: 'Distribuidora Costa Atlántica',
    lastPurchaseDate: '2026-08-27',
    isActive: true
  },
  {
    id: 'MAT-ZANAHORIA',
    name: 'Zanahoria Fresca Seleccionada',
    categoryId: 'CAT-ADEREZOS',
    categoryName: 'Aderezos & Salsas Caseras',
    unit: 'kg',
    currentStock: 65,
    minStockAlert: 20,
    costPerUnit: 750,
    supplierId: 'SUP-03',
    supplier: 'Distribuidora Costa Atlántica',
    lastPurchaseDate: '2026-08-29',
    isActive: true
  },
  {
    id: 'MAT-ZUCCHINI',
    name: 'Zucchini Fresco Huerta',
    categoryId: 'CAT-ADEREZOS',
    categoryName: 'Aderezos & Salsas Caseras',
    unit: 'kg',
    currentStock: 45,
    minStockAlert: 15,
    costPerUnit: 950,
    supplierId: 'SUP-03',
    supplier: 'Distribuidora Costa Atlántica',
    lastPurchaseDate: '2026-08-29',
    isActive: true
  },
  {
    id: 'MAT-AJO',
    name: 'Ajo Morado Cabeza',
    categoryId: 'CAT-ADEREZOS',
    categoryName: 'Aderezos & Salsas Caseras',
    unit: 'kg',
    currentStock: 12,
    minStockAlert: 5,
    costPerUnit: 2800,
    supplierId: 'SUP-03',
    supplier: 'Distribuidora Costa Atlántica',
    lastPurchaseDate: '2026-08-28',
    isActive: true
  },
  {
    id: 'MAT-MEMBRILLO',
    name: 'Dulce de Membrillo en Pan',
    categoryId: 'CAT-QUESOS',
    categoryName: 'Quesos & Rellenos',
    unit: 'kg',
    currentStock: 50,
    minStockAlert: 20,
    costPerUnit: 3400,
    supplierId: 'SUP-03',
    supplier: 'Distribuidora Costa Atlántica',
    lastPurchaseDate: '2026-08-25',
    isActive: true
  },
  {
    id: 'MAT-PACKAGING',
    name: 'Conos Térmicos y Servilletas',
    categoryId: 'CAT-PACKAGING',
    categoryName: 'Packaging & Descartables',
    unit: 'paquete',
    currentStock: 250,
    minStockAlert: 80,
    costPerUnit: 420,
    supplierId: 'SUP-04',
    supplier: 'Envases Ecológicos SA',
    lastPurchaseDate: '2026-08-24',
    isActive: true
  },
  {
    id: 'MAT-POTES-SALSA',
    name: 'Potes Biodegradables para Aderezo (50cc)',
    categoryId: 'CAT-PACKAGING',
    categoryName: 'Packaging & Descartables',
    unit: 'paquete',
    currentStock: 350,
    minStockAlert: 100,
    costPerUnit: 180,
    supplierId: 'SUP-04',
    supplier: 'Envases Ecológicos SA',
    lastPurchaseDate: '2026-08-28',
    isActive: true
  },
  {
    id: 'MAT-GUAYABA',
    name: 'Pasta de Guayaba Pura',
    categoryId: 'CAT-QUESOS',
    categoryName: 'Quesos & Rellenos',
    unit: 'kg',
    currentStock: 40,
    minStockAlert: 15,
    costPerUnit: 4100,
    supplierId: 'SUP-03',
    supplier: 'Distribuidora Costa Atlántica',
    lastPurchaseDate: '2026-08-20',
    isActive: true
  },
  {
    id: 'MAT-GARRAFA',
    name: 'Carga de Garrafa de Gas 10kg',
    categoryId: 'CAT-GAS',
    categoryName: 'Gas & Combustibles',
    unit: 'unidad',
    currentStock: 14,
    minStockAlert: 5,
    costPerUnit: 9500,
    supplierId: 'SUP-05',
    supplier: 'Gas Austral Costa',
    lastPurchaseDate: '2026-08-28',
    isActive: true
  }
];

export const INITIAL_RECIPES: ProductionRecipe[] = [
  {
    id: 'REC-TEQ-CLASICO',
    name: 'Receta Tequeño Clásico Queso Vegano (500u)',
    type: 'tequenos',
    varietyId: 'VAR-CLASICO',
    outputUnit: 'unidad',
    expectedYield: 500,
    estimatedLaborCost: 24000,
    estimatedEnergyPackagingCost: 9000,
    instructions: 'Mezclar harina, agua tibia, sal y aceite hasta obtener masa sedosa. Reposar 30 min. Cortar queso en bastones de 12g. Envolver en espiral solapado. Congelar en túnel a -18°C.',
    isActive: true,
    ingredients: [
      { materialId: 'MAT-HARINA', materialName: 'Harina de Trigo 0000 Especial', quantityRequired: 10, unit: 'kg' },
      { materialId: 'MAT-QUESO-VEG', materialName: 'Queso Vegano en Barra Artesanal', quantityRequired: 12, unit: 'kg' },
      { materialId: 'MAT-ACEITE', materialName: 'Aceite de Girasol Alto Oleico', quantityRequired: 3, unit: 'litro' }
    ]
  },
  {
    id: 'REC-MAYO-ZANAHORIA',
    name: 'Receta Mayonesa de Zanahoria Artesanal (20 kg)',
    type: 'aderezos_salsas',
    varietyId: 'VAR-MAYO-ZANAHORIA',
    outputUnit: 'kg',
    expectedYield: 20,
    estimatedLaborCost: 15000,
    estimatedEnergyPackagingCost: 4000,
    instructions: 'Hervir o asar zanahorias hasta punto puré suave. Emulsionar con aceite alto oleico, ajo asado, sal marina y jugo de limón en procesadora industrial. Envasar en potes esterilizados.',
    isActive: true,
    ingredients: [
      { materialId: 'MAT-ZANAHORIA', materialName: 'Zanahoria Fresca Seleccionada', quantityRequired: 16, unit: 'kg' },
      { materialId: 'MAT-ACEITE', materialName: 'Aceite de Girasol Alto Oleico', quantityRequired: 5, unit: 'litro' },
      { materialId: 'MAT-AJO', materialName: 'Ajo Morado Cabeza', quantityRequired: 0.8, unit: 'kg' }
    ]
  },
  {
    id: 'REC-ALIOLI-ZUCCHINI',
    name: 'Receta Alioli de Zucchini & Ajo Asado (15 kg)',
    type: 'aderezos_salsas',
    varietyId: 'VAR-ALIOLI-ZUCCHINI',
    outputUnit: 'kg',
    expectedYield: 15,
    estimatedLaborCost: 14000,
    estimatedEnergyPackagingCost: 3500,
    instructions: 'Cortar zucchinis en rodajas y asar a la chapa. Procesar con emulsionante vegetal, ajo confitado y aceite. Enfriar rápidamente a 4°C.',
    isActive: true,
    ingredients: [
      { materialId: 'MAT-ZUCCHINI', materialName: 'Zucchini Fresco Huerta', quantityRequired: 13, unit: 'kg' },
      { materialId: 'MAT-ACEITE', materialName: 'Aceite de Girasol Alto Oleico', quantityRequired: 3.5, unit: 'litro' },
      { materialId: 'MAT-AJO', materialName: 'Ajo Morado Cabeza', quantityRequired: 1.2, unit: 'kg' }
    ]
  },
  {
    id: 'REC-TEQ-MEMBRILLO',
    name: 'Receta Tequeño Dulce de Membrillo & Queso (300u)',
    type: 'tequenos',
    varietyId: 'VAR-MEMBRILLO',
    outputUnit: 'unidad',
    expectedYield: 300,
    estimatedLaborCost: 16000,
    estimatedEnergyPackagingCost: 6000,
    instructions: 'Cortar bastón mixto 50% queso vegano y 50% dulce de membrillo. Doble sellado en extremos para evitar fuga en freidora.',
    isActive: true,
    ingredients: [
      { materialId: 'MAT-HARINA', materialName: 'Harina de Trigo 0000 Especial', quantityRequired: 6, unit: 'kg' },
      { materialId: 'MAT-QUESO-VEG', materialName: 'Queso Vegano en Barra Artesanal', quantityRequired: 4, unit: 'kg' },
      { materialId: 'MAT-MEMBRILLO', materialName: 'Dulce de Membrillo en Pan', quantityRequired: 4, unit: 'kg' },
      { materialId: 'MAT-ACEITE', materialName: 'Aceite de Girasol Alto Oleico', quantityRequired: 2, unit: 'litro' }
    ]
  }
];

export const INITIAL_PRODUCTION_ORDERS: ProductionOrder[] = [
  {
    id: 'ORD-20260831-01',
    recipeId: 'REC-MAYO-ZANAHORIA',
    productName: 'Mayonesa de Zanahoria Artesanal',
    type: 'aderezos_salsas',
    requestedQuantity: 20,
    requestedUnit: 'kg',
    targetDate: '2026-08-31',
    targetShift: 'manana',
    assignedResponsibleId: 'USR-FAB-2',
    assignedResponsibleName: 'Ana Laura Giménez',
    status: 'en_proceso',
    createdAt: '2026-08-31 07:30',
    startedAt: '2026-08-31 08:15',
    productionNotes: 'Lote solicitado para reabastecer ambas bases norte y sur.'
  },
  {
    id: 'ORD-20260831-02',
    recipeId: 'REC-TEQ-CLASICO',
    productName: 'Tequeño Clásico Queso Vegano',
    type: 'tequenos',
    requestedQuantity: 3000,
    requestedUnit: 'unidad',
    targetDate: '2026-08-31',
    targetShift: 'manana',
    assignedResponsibleId: 'USR-FAB-1',
    assignedResponsibleName: 'Marcos Benavídez',
    status: 'completada',
    createdAt: '2026-08-31 06:00',
    startedAt: '2026-08-31 06:30',
    completedAt: '2026-08-31 10:15',
    realProducedQuantity: 2950,
    wasteQuantity: 50,
    wasteReason: 'Recortes de puntas y 15 bastones con rotura de masa en cinta',
    efficiencyPercent: 98.3,
    generatedBatchId: 'LOT-20260831-01',
    productionNotes: 'Excelente textura y sellado hermético.'
  },
  {
    id: 'ORD-20260831-03',
    recipeId: 'REC-ALIOLI-ZUCCHINI',
    productName: 'Alioli de Zucchini & Ajo Asado',
    type: 'aderezos_salsas',
    requestedQuantity: 15,
    requestedUnit: 'kg',
    targetDate: '2026-08-31',
    targetShift: 'tarde',
    assignedResponsibleId: 'USR-FAB-2',
    assignedResponsibleName: 'Ana Laura Giménez',
    status: 'pendiente',
    createdAt: '2026-08-31 09:00',
    productionNotes: 'Preparar para la recarga de la tarde.'
  }
];

export const INITIAL_FACTORY_INCIDENTS: FactoryIncident[] = [
  {
    id: 'FINC-01',
    timestamp: '2026-08-31 08:45',
    reportedBy: 'Marcos Benavídez',
    type: 'falla_maquinaria',
    severity: 'media',
    message: 'La amasadora industrial número 2 presenta una leve vibración al trabajar a máxima velocidad.',
    resolved: false
  },
  {
    id: 'FINC-02',
    timestamp: '2026-08-31 09:20',
    reportedBy: 'Ana Laura Giménez',
    type: 'falta_envases',
    severity: 'baja',
    message: 'Quedan 2 paquetes de potes descartables de 50cc para aderezos en planta. Solicitar reposición a proveedor.',
    resolved: false
  }
];

export const INITIAL_PRODUCTION_BATCHES: ProductionBatch[] = [
  {
    id: 'LOT-20260830-01',
    date: '2026-08-30',
    varietyId: 'VAR-CLASICO',
    varietyName: 'Tequeño Clásico Queso Vegano',
    unitsProduced: 2500,
    ingredientsUsed: [
      { materialId: 'MAT-HARINA', materialName: 'Harina 0000', quantity: 50, cost: 42500 },
      { materialId: 'MAT-QUESO-VEG', materialName: 'Queso Vegano', quantity: 60, cost: 312000 },
      { materialId: 'MAT-ACEITE', materialName: 'Aceite', quantity: 15, cost: 29250 }
    ],
    laborCost: 120000,
    energyAndPackagingCost: 45000,
    totalBatchCost: 548750,
    unitCostCalculated: 219.5,
    status: 'distribuido',
    remainingUnitsInCentral: 400,
    notes: 'Lote de fin de semana con masa extra elástica.'
  },
  {
    id: 'LOT-20260830-02',
    date: '2026-08-30',
    varietyId: 'VAR-AHUMADO',
    varietyName: 'Tequeño Ahumado & Finas Hierbas',
    unitsProduced: 1200,
    ingredientsUsed: [
      { materialId: 'MAT-HARINA', materialName: 'Harina 0000', quantity: 24, cost: 20400 },
      { materialId: 'MAT-QUESO-VEG', materialName: 'Queso Vegano Ahumado', quantity: 30, cost: 165000 },
      { materialId: 'MAT-ACEITE', materialName: 'Aceite', quantity: 8, cost: 15600 }
    ],
    laborCost: 65000,
    energyAndPackagingCost: 28000,
    totalBatchCost: 294000,
    unitCostCalculated: 245.0,
    status: 'distribuido',
    remainingUnitsInCentral: 250,
    notes: 'Ahumado con astillas de manzano natural.'
  },
  {
    id: 'LOT-20260831-01',
    date: '2026-08-31',
    varietyId: 'VAR-CLASICO',
    varietyName: 'Tequeño Clásico Queso Vegano',
    unitsProduced: 2950,
    ingredientsUsed: [
      { materialId: 'MAT-HARINA', materialName: 'Harina 0000', quantity: 59, cost: 50150 },
      { materialId: 'MAT-QUESO-VEG', materialName: 'Queso Vegano', quantity: 71, cost: 369200 },
      { materialId: 'MAT-ACEITE', materialName: 'Aceite', quantity: 18, cost: 35100 }
    ],
    laborCost: 140000,
    energyAndPackagingCost: 52000,
    totalBatchCost: 646450,
    unitCostCalculated: 219.1,
    status: 'en_camara_central',
    remainingUnitsInCentral: 2050,
    notes: 'Producción fresca de hoy para abastecer las 2 bases.'
  }
];

export const INITIAL_HOUSES: OperationalHouse[] = [
  {
    id: 'HOUSE-NORTE',
    name: 'Base Operativa Norte — Calle 65',
    address: 'Av. Costanera & Calle 65, Zona Balnearios Norte',
    coordinatorIds: ['USR-COORD-1'],
    residentUserIds: ['USR-COORD-1', 'USR-VEND-1', 'USR-VEND-2'],
    freezerCapacityUnits: 3500,
    fixedCostDaily: 15000,
    isActive: true,
    currentStock: [
      { varietyId: 'VAR-CLASICO', varietyName: 'Tequeño Clásico', quantity: 1450 },
      { varietyId: 'VAR-AHUMADO', varietyName: 'Tequeño Ahumado', quantity: 620 },
      { varietyId: 'VAR-MEMBRILLO', varietyName: 'Tequeño Membrillo', quantity: 280 }
    ],
    consumablesStock: {
      gasTanksAvailable: 6,
      gasTanksInUse: 4,
      napkinPacks: 45,
      traysCount: 300,
      paperConesCount: 800,
      sauceBottlesCount: 32
    }
  },
  {
    id: 'HOUSE-SUR',
    name: 'Base Operativa Sur — Calle 15',
    address: 'Calle 15 entre 1 y 2, Zona Muelle y Centro',
    coordinatorIds: ['USR-COORD-2'],
    residentUserIds: ['USR-COORD-2', 'USR-VEND-3', 'USR-VEND-4'],
    freezerCapacityUnits: 3000,
    fixedCostDaily: 14000,
    isActive: true,
    currentStock: [
      { varietyId: 'VAR-CLASICO', varietyName: 'Tequeño Clásico', quantity: 1100 },
      { varietyId: 'VAR-AHUMADO', varietyName: 'Tequeño Ahumado', quantity: 490 },
      { varietyId: 'VAR-MEMBRILLO', varietyName: 'Tequeño Membrillo', quantity: 190 }
    ],
    consumablesStock: {
      gasTanksAvailable: 4,
      gasTanksInUse: 3,
      napkinPacks: 30,
      traysCount: 220,
      paperConesCount: 550,
      sauceBottlesCount: 24
    }
  }
];

export const INITIAL_ZONES: BeachZone[] = [
  {
    id: 'ZONE-1',
    name: 'Zona 1: Calle 63 ➔ Calle 45 (Norte Familiar)',
    description: 'Playas amplias, carpas familiares y alta afluencia a media tarde.',
    touristAffluence: 'alta',
    avgDailySalesUnits: 320,
    recommendedStartUnits: 300
  },
  {
    id: 'ZONE-2',
    name: 'Zona 2: Calle 45 ➔ Calle 25 (Balnearios Jóvenes)',
    description: 'Paradores con música, surfistas y consumo intensivo de combos.',
    touristAffluence: 'alta',
    avgDailySalesUnits: 380,
    recommendedStartUnits: 350
  },
  {
    id: 'ZONE-3',
    name: 'Zona 3: Calle 25 ➔ Calle 10 (Muelle & Centro)',
    description: 'Zona de alto tránsito peatonal constante y puestos de pescadores.',
    touristAffluence: 'alta',
    avgDailySalesUnits: 340,
    recommendedStartUnits: 320
  },
  {
    id: 'ZONE-4',
    name: 'Zona 4: Calle 10 ➔ Faro Sur (Playa Tranquila)',
    description: 'Extensión amplia con sombrillas dispersas y grupos familiares.',
    touristAffluence: 'media',
    avgDailySalesUnits: 220,
    recommendedStartUnits: 200
  }
];

export const INITIAL_CARTS: SellingCart[] = [
  {
    id: 'CART-01',
    code: 'Carrito C-01 (Norte Alfa)',
    model: 'Modelo Playa Pro 2026 - Ruedas Globo',
    houseId: 'HOUSE-NORTE',
    status: 'operativo',
    currentSellerId: 'USR-VEND-1',
    gasLevelPercent: 85,
    suppliesLevel: {
      napkins: 'alto',
      cones: 'alto',
      trays: 'alto',
      sauces: 'alto'
    },
    lastMaintenanceDate: '2026-08-25',
    totalDaysInUse: 42,
    notes: 'Ruedas inflables de arena nuevas. Quemador en óptimo estado.',
    locationNotes: 'Asignado a Paradores Zona Norte (Bajada Calle 54)',
    isActive: true
  },
  {
    id: 'CART-02',
    code: 'Carrito C-02 (Norte Beta)',
    model: 'Modelo Standard Reforzado',
    houseId: 'HOUSE-NORTE',
    status: 'operativo',
    currentSellerId: 'USR-VEND-2',
    gasLevelPercent: 65,
    suppliesLevel: {
      napkins: 'medio',
      cones: 'alto',
      trays: 'medio',
      sauces: 'medio'
    },
    lastMaintenanceDate: '2026-08-20',
    totalDaysInUse: 38,
    notes: 'Quemador calibrado con regulador de 28 mbar.',
    locationNotes: 'Recorrido entre Calle 45 y Balneario Juventud',
    isActive: true
  },
  {
    id: 'CART-03',
    code: 'Carrito C-03 (Sur Rayo)',
    model: 'Modelo Playa Pro 2026',
    houseId: 'HOUSE-SUR',
    status: 'operativo',
    currentSellerId: 'USR-VEND-3',
    gasLevelPercent: 90,
    suppliesLevel: {
      napkins: 'alto',
      cones: 'alto',
      trays: 'alto',
      sauces: 'alto'
    },
    lastMaintenanceDate: '2026-08-28',
    totalDaysInUse: 29,
    notes: 'Excelente estado general. Conservadora térmica impecable.',
    locationNotes: 'Zona Muelle y Calle 20',
    isActive: true
  },
  {
    id: 'CART-04',
    code: 'Carrito C-04 (Sur Centella)',
    model: 'Modelo Standard Acero Inox',
    houseId: 'HOUSE-SUR',
    status: 'en_revision',
    currentSellerId: undefined,
    gasLevelPercent: 20,
    suppliesLevel: {
      napkins: 'bajo',
      cones: 'bajo',
      trays: 'bajo',
      sauces: 'agotado'
    },
    lastMaintenanceDate: '2026-08-15',
    totalDaysInUse: 50,
    notes: 'Vendedor reportó chirrido en eje delantero. Requiere engrase.',
    locationNotes: 'En depósito Base Sur',
    isActive: true
  },
  {
    id: 'CART-05',
    code: 'Carrito C-05 (Norte Refuerzo)',
    model: 'Modelo Playa Pro 2026 - Ruedas Globo',
    houseId: 'HOUSE-NORTE',
    status: 'operativo',
    currentSellerId: 'USR-COORD-1',
    gasLevelPercent: 95,
    suppliesLevel: {
      napkins: 'alto',
      cones: 'alto',
      trays: 'alto',
      sauces: 'alto'
    },
    lastMaintenanceDate: '2026-08-29',
    totalDaysInUse: 14,
    notes: 'Carrito asignado a coordinación para cobertura operativa y venta directa.',
    locationNotes: 'Zona 1: Paradores y Bajada Calle 54',
    isActive: true
  }
];

export const INITIAL_INCIDENTS: CartIncident[] = [
  {
    id: 'INC-01',
    date: '2026-08-30',
    cartId: 'CART-04',
    reportedBy: 'Julián Castro',
    type: 'rueda',
    description: 'La rueda delantera izquierda tiene arena en el rodamiento y frena al empujar en arena seca.',
    status: 'en_revision',
    costOfRepair: 0
  },
  {
    id: 'INC-02',
    date: '2026-08-26',
    cartId: 'CART-02',
    reportedBy: 'Esteban Morales',
    type: 'quemador_gas',
    description: 'Llama naranja con viento fuerte. Se limpió el pico inyector de gas.',
    status: 'solucionado',
    costOfRepair: 8500,
    resolvedDate: '2026-08-27',
    resolutionNotes: 'Se reemplazó la tobera y regulador de 28mbar.'
  }
];

export const INITIAL_SHIFTS: DailyShift[] = [
  {
    id: 'SHIFT-20260831-01',
    date: '2026-08-31',
    houseId: 'HOUSE-NORTE',
    houseName: 'Base Norte — Calle 65',
    coordinatorId: 'USR-COORD-1',
    coordinatorName: 'Mateo Roldán',
    sellerId: 'USR-VEND-1',
    sellerName: 'Lucas Benítez',
    cartId: 'CART-01',
    cartCode: 'Carrito C-01 (Norte Alfa)',
    zoneId: 'ZONE-2',
    zoneName: 'Zona 2: Calle 45 ➔ Calle 25',
    status: 'en_curso',
    startTime: '10:30',
    stockItems: [
      {
        varietyId: 'VAR-CLASICO',
        varietyName: 'Tequeño Clásico',
        deliveredUnits: 200,
        reSuppliedUnits: 50,
        soldUnits: 176,
        returnedUnits: 0,
        wasteUnits: 0,
        differenceUnits: 0
      },
      {
        varietyId: 'VAR-AHUMADO',
        varietyName: 'Tequeño Ahumado',
        deliveredUnits: 80,
        reSuppliedUnits: 0,
        soldUnits: 62,
        returnedUnits: 0,
        wasteUnits: 0,
        differenceUnits: 0
      }
    ],
    suppliesProvided: {
      gasPercentStart: 95,
      napkinsDelivered: 5,
      conesDelivered: 80,
      saucesProvided: ['Mayonesa de Zanahoria', 'Alioli de Zucchini', 'Chutney Mango']
    },
    totalGrossSales: 312000,
    totalCashSales: 168000,
    totalMpSales: 144000,
    cashExpected: 168000,
    cashDeclared: 0,
    cashDifference: 0,
    mpValidatedAmount: 96000,
    mpPendingOrSuspiciousAmount: 48000,
    totalUnitsDelivered: 330,
    totalUnitsRestocked: 50,
    totalUnitsSold: 238,
    totalUnitsReturned: 0,
    totalUnitsWaste: 0,
    totalUnitsDifference: 0,
    restocks: [
      {
        id: 'RESTOCK-20260831-01',
        shiftId: 'SHIFT-20260831-01',
        timestamp: '2026-08-31 15:15:00',
        sellerId: 'USR-VEND-1',
        sellerName: 'Lucas Benítez',
        coordinatorId: 'USR-COORD-1',
        coordinatorName: 'Mateo Roldán',
        varietyId: 'VAR-CLASICO',
        varietyName: 'Tequeño Clásico',
        quantity: 50,
        originLocation: 'Base Norte — Calle 65',
        destinationLocation: 'Carrito C-01 — Zona 2: Calle 45 ➔ Calle 25',
        notes: 'Refuerzo de stock por alta afluencia en balnearios'
      }
    ],
    wasteRecords: [],
    commissionRate: 0.20,
    grossCommission: 62400,
    housingCostDeduction: 8000,
    deductionsForMissingUnits: 0,
    incentivesOrBonuses: 0,
    finalPayoutAmount: 54400,
    payoutStatus: 'pendiente',
    notes: 'Jornada soleada con excelente ritmo de ventas en balnearios.'
  },
  {
    id: 'SHIFT-20260831-02',
    date: '2026-08-31',
    houseId: 'HOUSE-NORTE',
    houseName: 'Base Norte — Calle 65',
    coordinatorId: 'USR-COORD-1',
    coordinatorName: 'Mateo Roldán',
    sellerId: 'USR-VEND-2',
    sellerName: 'Esteban Morales',
    cartId: 'CART-02',
    cartCode: 'Carrito C-02 (Norte Beta)',
    zoneId: 'ZONE-1',
    zoneName: 'Zona 1: Calle 65 ➔ Calle 45',
    status: 'en_curso',
    startTime: '10:45',
    stockItems: [
      {
        varietyId: 'VAR-CLASICO',
        varietyName: 'Tequeño Clásico',
        deliveredUnits: 180,
        reSuppliedUnits: 0,
        soldUnits: 142,
        returnedUnits: 0,
        wasteUnits: 0,
        differenceUnits: 0
      },
      {
        varietyId: 'VAR-CHOCLO',
        varietyName: 'Tequeño Choclo & Bechamel',
        deliveredUnits: 70,
        reSuppliedUnits: 0,
        soldUnits: 55,
        returnedUnits: 0,
        wasteUnits: 0,
        differenceUnits: 0
      }
    ],
    suppliesProvided: {
      gasPercentStart: 90,
      napkinsDelivered: 4,
      conesDelivered: 70,
      saucesProvided: ['Mayonesa de Zanahoria', 'Mostaza Miel Vegana']
    },
    totalGrossSales: 258000,
    totalCashSales: 138000,
    totalMpSales: 120000,
    cashExpected: 138000,
    cashDeclared: 0,
    cashDifference: 0,
    mpValidatedAmount: 120000,
    mpPendingOrSuspiciousAmount: 0,
    totalUnitsDelivered: 250,
    totalUnitsSold: 197,
    totalUnitsReturned: 0,
    totalUnitsDifference: 0,
    commissionRate: 0.18,
    grossCommission: 46440,
    housingCostDeduction: 8000,
    deductionsForMissingUnits: 0,
    incentivesOrBonuses: 0,
    finalPayoutAmount: 38440,
    payoutStatus: 'pendiente',
    notes: 'Buen movimiento en zona familiar.'
  },
  {
    id: 'SHIFT-20260831-03',
    date: '2026-08-31',
    houseId: 'HOUSE-SUR',
    houseName: 'Base Sur — Calle 15',
    coordinatorId: 'USR-COORD-2',
    coordinatorName: 'Valeria Gómez',
    sellerId: 'USR-VEND-3',
    sellerName: 'Micaela Rossi',
    cartId: 'CART-03',
    cartCode: 'Carrito C-03 (Sur Rayo)',
    zoneId: 'ZONE-3',
    zoneName: 'Zona 3: Calle 25 ➔ Calle 10',
    status: 'en_curso',
    startTime: '10:15',
    stockItems: [
      {
        varietyId: 'VAR-CLASICO',
        varietyName: 'Tequeño Clásico',
        deliveredUnits: 220,
        reSuppliedUnits: 40,
        soldUnits: 195,
        returnedUnits: 0,
        wasteUnits: 0,
        differenceUnits: 0
      },
      {
        varietyId: 'VAR-MEMBRILLO',
        varietyName: 'Tequeño Membrillo',
        deliveredUnits: 80,
        reSuppliedUnits: 0,
        soldUnits: 68,
        returnedUnits: 0,
        wasteUnits: 0,
        differenceUnits: 0
      }
    ],
    suppliesProvided: {
      gasPercentStart: 100,
      napkinsDelivered: 6,
      conesDelivered: 90,
      saucesProvided: ['Alioli de Zucchini', 'Chutney Mango']
    },
    totalGrossSales: 345000,
    totalCashSales: 180000,
    totalMpSales: 165000,
    cashExpected: 180000,
    cashDeclared: 0,
    cashDifference: 0,
    mpValidatedAmount: 165000,
    mpPendingOrSuspiciousAmount: 0,
    totalUnitsDelivered: 340,
    totalUnitsSold: 263,
    totalUnitsReturned: 0,
    totalUnitsDifference: 0,
    commissionRate: 0.20,
    grossCommission: 69000,
    housingCostDeduction: 8000,
    deductionsForMissingUnits: 0,
    incentivesOrBonuses: 0,
    finalPayoutAmount: 61000,
    payoutStatus: 'pendiente',
    notes: 'Excelente jornada de ventas en Muelle.'
  },
  {
    id: 'SHIFT-20260831-04',
    date: '2026-08-31',
    houseId: 'HOUSE-SUR',
    houseName: 'Base Sur — Calle 15',
    coordinatorId: 'USR-COORD-2',
    coordinatorName: 'Valeria Gómez',
    sellerId: 'USR-VEND-4',
    sellerName: 'Julián Castro',
    cartId: 'CART-04',
    cartCode: 'Carrito C-04 (Sur Centella)',
    zoneId: 'ZONE-4',
    zoneName: 'Zona 4: Calle 10 ➔ Faro',
    status: 'en_curso',
    startTime: '11:00',
    stockItems: [
      {
        varietyId: 'VAR-CLASICO',
        varietyName: 'Tequeño Clásico',
        deliveredUnits: 160,
        reSuppliedUnits: 0,
        soldUnits: 110,
        returnedUnits: 0,
        wasteUnits: 0,
        differenceUnits: 0
      },
      {
        varietyId: 'VAR-AHUMADO',
        varietyName: 'Tequeño Ahumado',
        deliveredUnits: 60,
        reSuppliedUnits: 0,
        soldUnits: 45,
        returnedUnits: 0,
        wasteUnits: 0,
        differenceUnits: 0
      }
    ],
    suppliesProvided: {
      gasPercentStart: 85,
      napkinsDelivered: 4,
      conesDelivered: 60,
      saucesProvided: ['Mayonesa de Zanahoria']
    },
    totalGrossSales: 202500,
    totalCashSales: 112500,
    totalMpSales: 90000,
    cashExpected: 112500,
    cashDeclared: 0,
    cashDifference: 0,
    mpValidatedAmount: 90000,
    mpPendingOrSuspiciousAmount: 0,
    totalUnitsDelivered: 220,
    totalUnitsSold: 155,
    totalUnitsReturned: 0,
    totalUnitsDifference: 0,
    commissionRate: 0.18,
    grossCommission: 36450,
    housingCostDeduction: 8000,
    deductionsForMissingUnits: 0,
    incentivesOrBonuses: 0,
    finalPayoutAmount: 28450,
    payoutStatus: 'pendiente',
    notes: 'Primera semana en zona Faro.'
  },
  {
    id: 'SHIFT-20260831-05',
    date: '2026-08-31',
    houseId: 'HOUSE-NORTE',
    houseName: 'Base Norte — Calle 54',
    coordinatorId: 'USR-COORD-1',
    coordinatorName: 'Mateo Roldán',
    sellerId: 'USR-COORD-1',
    sellerName: 'Mateo Roldán (Coordinador)',
    cartId: 'CART-05',
    cartCode: 'Carrito C-05 (Norte Refuerzo)',
    zoneId: 'ZONE-1',
    zoneName: 'Zona 1: Calle 65 ➔ Calle 50',
    status: 'en_curso',
    startTime: '11:30',
    stockItems: [
      {
        varietyId: 'VAR-CLASICO',
        varietyName: 'Tequeño Clásico Queso Vegano',
        deliveredUnits: 140,
        reSuppliedUnits: 0,
        soldUnits: 42,
        returnedUnits: 0,
        wasteUnits: 0,
        differenceUnits: 0
      },
      {
        varietyId: 'VAR-AHUMADO',
        varietyName: 'Tequeño Ahumado & Finas Hierbas',
        deliveredUnits: 80,
        reSuppliedUnits: 0,
        soldUnits: 25,
        returnedUnits: 0,
        wasteUnits: 0,
        differenceUnits: 0
      },
      {
        varietyId: 'VAR-DULCE',
        varietyName: 'Tequeño Dulce de Membrillo',
        deliveredUnits: 40,
        reSuppliedUnits: 0,
        soldUnits: 10,
        returnedUnits: 0,
        wasteUnits: 0,
        differenceUnits: 0
      }
    ],
    suppliesProvided: {
      gasPercentStart: 95,
      napkinsDelivered: 5,
      conesDelivered: 70,
      saucesProvided: ['Mayonesa Ajo Vegana', 'Chutney Mango']
    },
    totalGrossSales: 96500,
    totalCashSales: 51500,
    totalMpSales: 45000,
    cashExpected: 51500,
    cashDeclared: 0,
    cashDifference: 0,
    mpValidatedAmount: 45000,
    mpPendingOrSuspiciousAmount: 0,
    totalUnitsDelivered: 260,
    totalUnitsSold: 77,
    totalUnitsReturned: 0,
    totalUnitsDifference: 0,
    commissionRate: 0.20,
    grossCommission: 19300,
    housingCostDeduction: 0,
    housingCostExempt: true,
    deductionsForMissingUnits: 0,
    incentivesOrBonuses: 0,
    finalPayoutAmount: 19300,
    payoutStatus: 'pendiente',
    notes: 'Jornada operativa de venta directa de coordinación para cubrir refuerzo de paradores.'
  },
  {
    id: 'SHIFT-20260830-01',
    date: '2026-08-30',
    houseId: 'HOUSE-NORTE',
    houseName: 'Base Norte — Calle 65',
    coordinatorId: 'USR-COORD-1',
    coordinatorName: 'Mateo Roldán',
    sellerId: 'USR-VEND-1',
    sellerName: 'Lucas Benítez',
    cartId: 'CART-01',
    cartCode: 'Carrito C-01 (Norte Alfa)',
    zoneId: 'ZONE-2',
    zoneName: 'Zona 2: Calle 45 ➔ Calle 25',
    status: 'liquidada',
    startTime: '10:00',
    endTime: '18:45',
    stockItems: [
      {
        varietyId: 'VAR-CLASICO',
        varietyName: 'Tequeño Clásico',
        deliveredUnits: 220,
        reSuppliedUnits: 0,
        soldUnits: 185,
        returnedUnits: 35,
        wasteUnits: 0,
        differenceUnits: 0
      },
      {
        varietyId: 'VAR-AHUMADO',
        varietyName: 'Tequeño Ahumado',
        deliveredUnits: 90,
        reSuppliedUnits: 0,
        soldUnits: 78,
        returnedUnits: 12,
        wasteUnits: 0,
        differenceUnits: 0
      }
    ],
    suppliesProvided: {
      gasPercentStart: 100,
      gasPercentEnd: 75,
      napkinsDelivered: 5,
      conesDelivered: 90,
      saucesProvided: ['Mayonesa de Zanahoria', 'Alioli de Zucchini']
    },
    totalGrossSales: 345000,
    totalCashSales: 180000,
    totalMpSales: 165000,
    cashExpected: 180000,
    cashDeclared: 180000,
    cashDifference: 0,
    mpValidatedAmount: 165000,
    mpPendingOrSuspiciousAmount: 0,
    totalUnitsDelivered: 310,
    totalUnitsSold: 263,
    totalUnitsReturned: 47,
    totalUnitsDifference: 0,
    commissionRate: 0.20,
    grossCommission: 69000,
    housingCostDeduction: 8000,
    deductionsForMissingUnits: 0,
    incentivesOrBonuses: 3000,
    finalPayoutAmount: 64000, // 69000 - 8000 + 3000
    payoutStatus: 'pagado',
    payoutTimestamp: '2026-08-30 19:15',
    payoutPaymentProof: 'Efectivo en mano tras conteo',
    coordinatorSignature: 'Mateo Roldán',
    notes: 'Cierre perfecto sin diferencias.'
  },
  {
    id: 'SHIFT-20260830-02',
    date: '2026-08-30',
    houseId: 'HOUSE-SUR',
    houseName: 'Base Sur — Calle 15',
    coordinatorId: 'USR-COORD-2',
    coordinatorName: 'Valeria Gómez',
    sellerId: 'USR-VEND-3',
    sellerName: 'Micaela Rossi',
    cartId: 'CART-03',
    cartCode: 'Carrito C-03 (Sur Rayo)',
    zoneId: 'ZONE-3',
    zoneName: 'Zona 3: Calle 25 ➔ Calle 10',
    status: 'liquidada',
    startTime: '10:15',
    endTime: '19:00',
    stockItems: [
      {
        varietyId: 'VAR-CLASICO',
        varietyName: 'Tequeño Clásico',
        deliveredUnits: 250,
        reSuppliedUnits: 0,
        soldUnits: 210,
        returnedUnits: 38,
        wasteUnits: 2,
        differenceUnits: 0
      },
      {
        varietyId: 'VAR-MEMBRILLO',
        varietyName: 'Tequeño Membrillo',
        deliveredUnits: 60,
        reSuppliedUnits: 0,
        soldUnits: 55,
        returnedUnits: 5,
        wasteUnits: 0,
        differenceUnits: 0
      }
    ],
    suppliesProvided: {
      gasPercentStart: 100,
      gasPercentEnd: 70,
      napkinsDelivered: 6,
      conesDelivered: 100,
      saucesProvided: ['Mayonesa de Zanahoria', 'Alioli de Zucchini']
    },
    totalGrossSales: 375000,
    totalCashSales: 200000,
    totalMpSales: 175000,
    cashExpected: 200000,
    cashDeclared: 200000,
    cashDifference: 0,
    mpValidatedAmount: 175000,
    mpPendingOrSuspiciousAmount: 0,
    totalUnitsDelivered: 310,
    totalUnitsSold: 265,
    totalUnitsReturned: 43,
    totalUnitsDifference: 0,
    commissionRate: 0.20,
    grossCommission: 75000,
    housingCostDeduction: 8000,
    deductionsForMissingUnits: 0,
    incentivesOrBonuses: 5000,
    finalPayoutAmount: 72000, // 75000 - 8000 + 5000
    payoutStatus: 'pagado',
    payoutTimestamp: '2026-08-30 19:30',
    payoutPaymentProof: 'Transferencia Mercado Pago',
    coordinatorSignature: 'Valeria Gómez',
    notes: 'Excelente jornada de ventas.'
  }
];

export const INITIAL_SALES: SaleTransaction[] = [
  {
    id: 'TX-20260831-C01',
    shiftId: 'SHIFT-20260831-05',
    sellerId: 'USR-COORD-1',
    sellerName: 'Mateo Roldán (Coordinador)',
    timestamp: '2026-08-31 12:45:10',
    itemType: 'combo6',
    varietyId: 'VAR-CLASICO',
    varietyName: 'Tequeño Clásico Queso Vegano',
    quantityUnitsEquivalent: 6,
    totalAmount: 7500,
    paymentMethod: 'mercado_pago',
    validationStatus: 'validada',
    voucherPhotoUrl: 'https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=800&auto=format&fit=crop&q=80',
    voucherExtractedData: {
      operationId: 'MP-77221190',
      amount: 7500,
      date: '2026-08-31',
      time: '12:44',
      senderName: 'Florencia Varela',
      destinationAccount: 'tequenos.costa.mp',
      confidenceScore: 0.99,
      aiNotes: 'Comprobante verificado correctamente'
    },
    mpApiVerification: {
      matchedInApi: true,
      mpTransactionId: 'MP-77221190',
      apiStatus: 'approved',
      verifiedAt: '2026-08-31 12:45:30'
    },
    gpsLocation: { lat: -38.0062, lng: -57.5420, zoneName: 'Parador Playa Norte' }
  },
  {
    id: 'TX-20260831-C02',
    shiftId: 'SHIFT-20260831-05',
    sellerId: 'USR-COORD-1',
    sellerName: 'Mateo Roldán (Coordinador)',
    timestamp: '2026-08-31 13:10:05',
    itemType: 'combo12',
    varietyId: 'VAR-AHUMADO',
    varietyName: 'Tequeño Ahumado & Finas Hierbas',
    quantityUnitsEquivalent: 12,
    totalAmount: 14000,
    paymentMethod: 'efectivo',
    validationStatus: 'validada',
    gpsLocation: { lat: -38.0070, lng: -57.5425, zoneName: 'Parador Playa Norte' }
  },
  {
    id: 'TX-20260831-01',
    shiftId: 'SHIFT-20260831-01',
    sellerId: 'USR-VEND-1',
    sellerName: 'Lucas Benítez',
    timestamp: '2026-08-31 11:15:20',
    itemType: 'combo6',
    varietyId: 'VAR-CLASICO',
    varietyName: 'Tequeño Clásico Queso Vegano',
    quantityUnitsEquivalent: 6,
    totalAmount: 7500,
    paymentMethod: 'mercado_pago',
    validationStatus: 'validada',
    voucherPhotoUrl: 'https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=800&auto=format&fit=crop&q=80',
    voucherExtractedData: {
      operationId: 'MP-98432109',
      amount: 7500,
      date: '2026-08-31',
      time: '11:14',
      senderName: 'Martina Rodríguez',
      destinationAccount: 'tequenos.costa.mp',
      confidenceScore: 0.98,
      aiNotes: 'Comprobante verificado con éxito'
    },
    mpApiVerification: {
      matchedInApi: true,
      mpTransactionId: 'MP-98432109',
      apiStatus: 'approved',
      verifiedAt: '2026-08-31 11:16:00'
    },
    gpsLocation: { lat: -38.0055, lng: -57.5412, zoneName: 'Parador Playa Grande' }
  },
  {
    id: 'TX-20260831-02',
    shiftId: 'SHIFT-20260831-01',
    sellerId: 'USR-VEND-1',
    sellerName: 'Lucas Benítez',
    timestamp: '2026-08-31 11:42:10',
    itemType: 'combo12',
    varietyId: 'VAR-AHUMADO',
    varietyName: 'Tequeño Ahumado & Finas Hierbas',
    quantityUnitsEquivalent: 12,
    totalAmount: 15000,
    paymentMethod: 'efectivo',
    validationStatus: 'validada',
    gpsLocation: { lat: -38.0062, lng: -57.5420, zoneName: 'Sector Carpas 3' }
  },
  {
    id: 'TX-20260831-03',
    shiftId: 'SHIFT-20260831-01',
    sellerId: 'USR-VEND-1',
    sellerName: 'Lucas Benítez',
    timestamp: '2026-08-31 12:05:44',
    itemType: 'combo6',
    varietyId: 'VAR-CLASICO',
    varietyName: 'Tequeño Clásico Queso Vegano',
    quantityUnitsEquivalent: 6,
    totalAmount: 7500,
    paymentMethod: 'mercado_pago',
    validationStatus: 'pendiente_revision',
    voucherPhotoUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80',
    voucherExtractedData: {
      operationId: 'MP-Pending-01',
      amount: 7500,
      date: '2026-08-31',
      time: '12:04',
      senderName: 'Santiago F.',
      confidenceScore: 0.88,
      aiNotes: 'Foto con brillo solar, esperando verificación API'
    },
    gpsLocation: { lat: -38.0071, lng: -57.5435, zoneName: 'Orilla Sur' }
  },
  {
    id: 'TX-20260831-04',
    shiftId: 'SHIFT-20260831-01',
    sellerId: 'USR-VEND-2',
    sellerName: 'Esteban Morales',
    timestamp: '2026-08-31 13:20:15',
    itemType: 'combo12',
    varietyId: 'VAR-MEMBRILLO',
    varietyName: 'Tequeño Dulce Guayaba',
    quantityUnitsEquivalent: 12,
    totalAmount: 15000,
    paymentMethod: 'mercado_pago',
    validationStatus: 'validada',
    voucherPhotoUrl: 'https://images.unsplash.com/photo-1580519542036-c47de6196ba5?w=800&auto=format&fit=crop&q=80',
    voucherExtractedData: {
      operationId: 'MP-88329411',
      amount: 15000,
      date: '2026-08-31',
      time: '13:19',
      senderName: 'Camila Benítez',
      destinationAccount: 'tequenos.costa.mp',
      confidenceScore: 0.99,
      aiNotes: 'Comprobante verificado correctamente en servidor'
    },
    mpApiVerification: {
      matchedInApi: true,
      mpTransactionId: 'MP-88329411',
      apiStatus: 'approved',
      verifiedAt: '2026-08-31 13:21:02'
    },
    gpsLocation: { lat: -38.0041, lng: -57.5390, zoneName: 'Sector Carpas Central' }
  },
  {
    id: 'TX-20260831-05',
    shiftId: 'SHIFT-20260830-02',
    sellerId: 'USR-VEND-3',
    sellerName: 'Micaela Rossi',
    timestamp: '2026-08-31 14:45:00',
    itemType: 'combo6',
    varietyId: 'VAR-CLASICO',
    varietyName: 'Tequeño Clásico',
    quantityUnitsEquivalent: 6,
    totalAmount: 7500,
    paymentMethod: 'mercado_pago',
    validationStatus: 'validada',
    voucherPhotoUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop&q=80',
    voucherExtractedData: {
      operationId: 'MP-77218392',
      amount: 7500,
      date: '2026-08-31',
      time: '14:44',
      senderName: 'Facundo Silva',
      destinationAccount: 'tequenos.costa.mp',
      confidenceScore: 0.96,
      aiNotes: 'Importe y destinatario validados'
    },
    mpApiVerification: {
      matchedInApi: true,
      mpTransactionId: 'MP-77218392',
      apiStatus: 'approved',
      verifiedAt: '2026-08-31 14:46:10'
    },
    gpsLocation: { lat: -38.0120, lng: -57.5480, zoneName: 'Playa Varese Sur' }
  },
  {
    id: 'TX-20260831-06',
    shiftId: 'SHIFT-20260830-02',
    sellerId: 'USR-VEND-3',
    sellerName: 'Micaela Rossi',
    timestamp: '2026-08-31 16:10:30',
    itemType: 'combo3',
    varietyId: 'VAR-AHUMADO',
    varietyName: 'Tequeño Ahumado',
    quantityUnitsEquivalent: 3,
    totalAmount: 4000,
    paymentMethod: 'mercado_pago',
    validationStatus: 'inconsistente',
    voucherPhotoUrl: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&auto=format&fit=crop&q=80',
    voucherExtractedData: {
      operationId: 'MP-77299104',
      amount: 3500,
      date: '2026-08-31',
      time: '16:09',
      senderName: 'Gastón Pereyra',
      destinationAccount: 'tequenos.costa.mp',
      confidenceScore: 0.91,
      aiNotes: 'Diferencia detectada: comprobante dice $3.500 pero venta es de $4.000'
    },
    mpApiVerification: {
      matchedInApi: false,
      apiStatus: 'pending_review'
    },
    gpsLocation: { lat: -38.0135, lng: -57.5492, zoneName: 'Bajada Náutica' }
  },
  {
    id: 'TX-20260831-07',
    shiftId: 'SHIFT-20260830-02',
    sellerId: 'USR-VEND-4',
    sellerName: 'Julián Castro',
    timestamp: '2026-08-31 17:35:12',
    itemType: 'combo12',
    varietyId: 'VAR-CLASICO',
    varietyName: 'Tequeño Clásico',
    quantityUnitsEquivalent: 12,
    totalAmount: 15000,
    paymentMethod: 'mercado_pago',
    validationStatus: 'sospechosa',
    voucherPhotoUrl: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&auto=format&fit=crop&q=80',
    voucherExtractedData: {
      operationId: 'MP-66102938',
      amount: 15000,
      date: '2026-08-30',
      time: '19:40',
      senderName: 'Federico M.',
      destinationAccount: 'tequenos.costa.mp',
      confidenceScore: 0.75,
      aiNotes: 'Alerta: Fecha del comprobante (30-Ago) no coincide con el día de venta (31-Ago)'
    },
    mpApiVerification: {
      matchedInApi: false,
      apiStatus: 'rejected'
    },
    gpsLocation: { lat: -38.0150, lng: -57.5510, zoneName: 'Zona Escollera' }
  }
];

export const INITIAL_EXPENSES: OperationalExpense[] = [
  {
    id: 'EXP-01',
    date: '2026-08-25',
    category: 'alquiler_casa',
    houseId: 'HOUSE-NORTE',
    description: 'Alquiler quincenal Base Operativa Norte (Calle 65)',
    amount: 220000,
    registeredBy: 'Carlos Mendoza'
  },
  {
    id: 'EXP-02',
    date: '2026-08-25',
    category: 'alquiler_casa',
    houseId: 'HOUSE-SUR',
    description: 'Alquiler quincenal Base Operativa Sur (Calle 15)',
    amount: 195000,
    registeredBy: 'Carlos Mendoza'
  },
  {
    id: 'EXP-03',
    date: '2026-08-28',
    category: 'gas_combustible',
    description: 'Recarga lote de 10 garrafas de 10kg',
    amount: 95000,
    registeredBy: 'Mateo Roldán'
  }
];

export const INITIAL_ALERTS: OperationalAlert[] = [
  {
    id: 'ALT-01',
    timestamp: '2026-08-31 09:20',
    level: 'advertencia',
    title: 'Falta de Envases en Fábrica',
    message: 'Ana Laura Giménez reportó que quedan pocos potes de aderezo de 50cc en planta.',
    category: 'stock',
    relatedEntityId: 'FINC-02',
    isRead: false,
    resolved: false
  },
  {
    id: 'ALT-02',
    timestamp: '2026-08-31 08:45',
    level: 'advertencia',
    title: 'Mantenimiento Preventivo de Maquinaria',
    message: 'Amasadora 2 presenta vibración leve en velocidad alta.',
    category: 'mantenimiento',
    relatedEntityId: 'FINC-01',
    isRead: false,
    resolved: false
  },
  {
    id: 'ALT-03',
    timestamp: '2026-08-30 18:30',
    level: 'informativa',
    title: 'Nueva Receta Registrada',
    message: 'Se cargó la receta artesanal de Mayonesa de Zanahoria (20 kg).',
    category: 'stock',
    isRead: true,
    resolved: true
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'LOG-01',
    timestamp: '2026-08-31 09:00:00',
    userId: 'USR-ADMIN-1',
    userName: 'Carlos Mendoza',
    userRole: 'admin',
    action: 'ACTUALIZAR_CONFIG_SISTEMA',
    entityType: 'produccion',
    entityId: 'CONFIG',
    details: 'Costo de vivienda diaria configurado a $8.000 por persona.'
  },
  {
    id: 'LOG-02',
    timestamp: '2026-08-31 07:30:00',
    userId: 'USR-ADMIN-1',
    userName: 'Carlos Mendoza',
    userRole: 'admin',
    action: 'CREAR_ORDEN_PRODUCCION',
    entityType: 'produccion',
    entityId: 'ORD-20260831-01',
    details: 'Orden de producción de 20 kg Mayonesa de Zanahoria asignada a Ana Laura Giménez.'
  }
];

export const INITIAL_TRANSFERS: StockTransfer[] = [
  {
    id: 'TRF-01',
    date: '2026-08-31',
    fromLocation: 'Camara Central',
    toHouseId: 'HOUSE-NORTE',
    toHouseName: 'Base Norte — Calle 65',
    transferredBy: 'Carlos Mendoza',
    items: [
      { varietyId: 'VAR-CLASICO', varietyName: 'Tequeño Clásico', quantity: 900 },
      { varietyId: 'VAR-AHUMADO', varietyName: 'Tequeño Ahumado', quantity: 300 }
    ],
    status: 'recibido_conforme',
    notes: 'Despacho matutino con furgón refrigerado a -18°C.'
  }
];

