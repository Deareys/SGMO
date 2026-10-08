# DATABASE.md — Modelo de Datos y Esquema de Persistencia

> **Sistema:** SGMO — Tequeños Costa  
> **Versión:** 0.6.0  
> **Estado Actual:** Serialización en `localStorage` (Clave `SGMO_APP_STATE`)  
> **Estado Objetivo:** Base de Datos Relacional PostgreSQL / Cloud SQL

---

## 1. ESQUEMA DE DATOS ACTUAL (`src/types/index.ts`)

En el sistema actual, el estado global se almacena en memoria y se persiste en `window.localStorage` dentro de la clave `SGMO_APP_STATE`.

### 1.1 Entidades Principales

```
+---------------------------------------------------------------------------------+
|                                 DIAGRAMA E-R (LÓGICO)                           |
+---------------------------------------------------------------------------------+

     [BaseOperativa] 1 ──── N [Cart] 1 ──── N [Shift] 1 ──── N [Sale]
                                                │
                                                ├──── N [ShiftWasteRecord]
                                                ├──── N [ShiftRestockRecord]
                                                └──── 1 [ShiftReconciliation]

     [User] (sellerId, coordinatorId) ─── ASIGNADO A ───> [Shift]

     [Variety] 1 ──── N [SaleItem]
         │
         └──── N [RecipeItem] ──── N [RawMaterial] ──── N [Supplier]

     [CommissionTier] (Reglas de cálculo global)
     [OperatingCost] (Costos fijos y variables)
```

---

## 2. ESPECIFICACIÓN DETALLADA DE ENTIDADES

### 2.1 `User` (Usuarios y Personal)
- `id: string` (PK, ej: `'usr-1'`)
- `name: string` (Nombre y apellido del empleado)
- `role: 'seller' | 'coordinator' | 'admin' | 'kitchen'`
- `pin: string` (Código numérico de 4 dígitos para login rápido en playa)
- `assignedCartId?: string` (FK opcional a `Cart`)
- `phone?: string`
- `active: boolean`

### 2.2 `Cart` (Carritos de Playa)
- `id: string` (PK, ej: `'cart-1'`)
- `code: string` (Identificador físico, ej: `'C-01'`)
- `name: string` (Nombre de fantasía, ej: `'El Dorado'`)
- `baseId: string` (FK a `BaseOperativa`, ej: `'base-sta-teresita'`)
- `assignedSellerId?: string` (FK opcional a `User`)
- `status: 'available' | 'assigned' | 'in_route' | 'maintenance'`
- `gasTankLevel: number` (Porcentaje de gas restante en la garrafa, 0-100)
- `inventory: Record<string, number>` (Mapa de variedadId -> stock actual de unidades en carrito)
- `location?: string` (Playa actual, ej: `'Calle 32 - Santa Teresita'`)

### 2.3 `Variety` (Variedades de Producto)
- `id: string` (PK, ej: `'var-queso'`)
- `name: string` (Nombre comercial, ej: `'Tequeño de Queso Llanero'`)
- `price: number` (Precio unitario de venta al público en ARS)
- `cost: number` (Costo unitario de fabricación en ARS)
- `color: string` (Código hex para la UI, ej: `'#3B82F6'`)
- `isAvailable: boolean`

### 2.4 `Shift` (Jornada de Venta del Vendedor)
- `id: string` (PK, ej: `'shift-20261004-usr-1'`)
- `cartId: string` (FK a `Cart`)
- `sellerId: string` (FK a `User`)
- `coordinatorId: string` (FK a `User` que despachó)
- `startTime: string` (ISO timestamp de salida a playa)
- `endTime?: string` (ISO timestamp de regreso y cierre)
- `status: 'open' | 'closed'`
- `initialStock: Record<string, number>` (Unidades entregadas por variedad al salir)
- `currentStock: Record<string, number>` (Stock restante estimado en tiempo real)
- `finalStock?: Record<string, number>` (Unidades físicas devueltas a la base al cerrar)
- `initialGasLevel: number` (Gas al inicio del turno)
- `finalGasLevel?: number` (Gas al cierre)

### 2.5 `Sale` (Transacción de Venta)
- `id: string` (PK, ej: `'sale-1728000000000'`)
- `shiftId: string` (FK a `Shift`)
- `sellerId: string` (FK a `User`)
- `timestamp: string` (ISO timestamp)
- `varietyId: string` (FK a `Variety`)
- `quantity: number` (Unidades equivalentes vendidas, ej: 1, 3, 6, 12)
- `unitPrice: number` (Precio unitario aplicado)
- `totalAmount: number` (Total cobrado en ARS)
- `comboType: 'unidad' | 'combo3' | 'combo6' | 'combo12'`
- `paymentMethod: 'cash' | 'mercadopago' | 'transfer'`
- `voucherUrl?: string` (DataURL base64 o URL remota de la captura de pantalla del comprobante)
- `voucherOcrData?: VoucherOCRData` (Datos extraídos por Gemini OCR: operationId, amount, date)
- `paymentStatus: 'pending' | 'verified' | 'rejected'`
- `location: string` (Sector de playa o bajada registrada)
- `isOffline?: boolean` (Flag indicador de venta realizada sin conexión)

### 2.6 `ShiftWasteRecord` (Mermas del Turno)
- `id: string` (PK)
- `shiftId: string` (FK a `Shift`)
- `varietyId: string` (FK a `Variety`)
- `quantity: number` (Cantidad de unidades rotas, quemadas o caídas)
- `reason: 'quemado' | 'roto' | 'vencido' | 'caida_arena' | 'otro'`
- `timestamp: string` (ISO)
- `authorizedBy: string` (FK a `User` coordinador)

### 2.7 `ShiftRestockRecord` (Reposiciones Intermedias en Playa)
- `id: string` (PK)
- `shiftId: string` (FK a `Shift`)
- `timestamp: string` (ISO)
- `items: Record<string, number>` (Unidades adicionales entregadas en la playa)
- `dispatchedBy: string` (FK a `User` coordinador en moto o cuatriciclo)

### 2.8 `CommissionTier` (Escalafón Dinámico de Comisiones)
- `id: string` (PK)
- `name: string` (ej: `'Tramo Inicial (10%)'`, `'Tramo Medio (20%)'`, `'Tramo Estrella (30%)'`)
- `minSalesAmount: number` (Piso de facturación del tramo en ARS)
- `maxSalesAmount: number` (Techo del tramo en ARS; `Infinity` para el tramo superior)
- `percentage: number` (Porcentaje aplicable, ej: 10, 20, 30)
- `active: boolean`

---

## 3. ESQUEMA DE BASE DE DATOS OBJETIVO (POSTGRESQL / CLOUD SQL)

Para llevar este modelo a un motor relacional en la nube, se propone el siguiente esquema DDL:

```sql
-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA DE USUARIOS
CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('seller', 'coordinator', 'admin', 'kitchen')),
    pin_hash VARCHAR(255) NOT NULL, -- Hasheado con bcrypt, NO texto plano
    phone VARCHAR(30),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLA DE BASES OPERATIVAS
CREATE TABLE bases_operativas (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    city VARCHAR(80) NOT NULL,
    address TEXT,
    active BOOLEAN DEFAULT TRUE
);

-- 3. TABLA DE CARRITOS
CREATE TABLE carts (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(80) NOT NULL,
    base_id VARCHAR(64) REFERENCES bases_operativas(id),
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'in_route', 'maintenance')),
    gas_tank_level NUMERIC(5,2) DEFAULT 100.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABLA DE VARIEDADES
CREATE TABLE varieties (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    cost NUMERIC(10,2) NOT NULL,
    color VARCHAR(20) DEFAULT '#3B82F6',
    is_available BOOLEAN DEFAULT TRUE
);

-- 5. TABLA DE JORNADAS / TURNOS (SHIFTS)
CREATE TABLE shifts (
    id VARCHAR(64) PRIMARY KEY,
    cart_id VARCHAR(64) NOT NULL REFERENCES carts(id),
    seller_id VARCHAR(64) NOT NULL REFERENCES users(id),
    coordinator_id VARCHAR(64) NOT NULL REFERENCES users(id),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    initial_gas_level NUMERIC(5,2) DEFAULT 100.0,
    final_gas_level NUMERIC(5,2),
    housing_deduction NUMERIC(10,2) DEFAULT 8000.00,
    missing_unit_penalty NUMERIC(10,2) DEFAULT 1500.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABLA DE STOCK INICIAL Y FINAL POR JORNADA
CREATE TABLE shift_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shift_id VARCHAR(64) NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    variety_id VARCHAR(64) NOT NULL REFERENCES varieties(id),
    initial_stock INT NOT NULL DEFAULT 0,
    returned_stock INT,
    CONSTRAINT uq_shift_variety UNIQUE (shift_id, variety_id)
);

-- 7. TABLA DE TRANSACCIONES DE VENTA
CREATE TABLE sales (
    id VARCHAR(64) PRIMARY KEY,
    shift_id VARCHAR(64) NOT NULL REFERENCES shifts(id),
    seller_id VARCHAR(64) NOT NULL REFERENCES users(id),
    variety_id VARCHAR(64) NOT NULL REFERENCES varieties(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10,2) NOT NULL,
    total_amount NUMERIC(10,2) NOT NULL,
    combo_type VARCHAR(20) NOT NULL CHECK (combo_type IN ('unidad', 'combo3', 'combo6', 'combo12')),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'mercadopago', 'transfer')),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'verified', 'rejected')),
    mp_operation_id VARCHAR(80),
    voucher_image_url TEXT,
    location VARCHAR(120),
    is_offline BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sales_shift ON sales(shift_id);
CREATE INDEX idx_sales_mp_op ON sales(mp_operation_id);

-- 8. TABLA DE AUDITORÍA DE MERCADO PAGO / WEBHOOKS
CREATE TABLE mp_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic VARCHAR(50) NOT NULL,
    resource_id VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. RIESGOS DE PERSISTENCIA Y RECOMENDACIONES

1. **Pérdida de datos por limpieza de caché:**
   - En navegadores móviles iOS (Safari), el almacenamiento local de PWAs que no se abren en 7 días puede ser purgado automáticamente por WebKit.
   - **Mitigación:** Almacenamiento primario en PostgreSQL con réplica de solo lectura offline en IndexedDB mediante Dexie.js o SQLite WASM.
2. **Concurrencia de Vendedores:**
   - Actualmente dos carritos no pueden compartir ventas ni consolidarse en el dashboard del coordinador si están en diferentes dispositivos físicos.
   - **Mitigación:** Implementar WebSocket (Socket.io) o polling cada 15 segundos hacia el backend en el panel de coordinación.
