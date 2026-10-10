# DATABASE.md — Modelo de Datos y Esquema de Persistencia Central (PostgreSQL)

> **Sistema:** SGMO — Tequeños Costa  
> **Versión:** 0.8.0 (Fase 2: Persistencia Central Relacional)  
> **Motor de Base de Datos:** PostgreSQL (Compatible con Cloud SQL, Neon, Supabase y PostgreSQL nativo)  
> **Estado de Conexión:** Dual / Híbrido (`DATABASE CONFIGURED` cuando existe `DATABASE_URL`; fallback local en `localStorage` ante contingencias de red o ausencia de credenciales).

---

## 1. ARQUITECTURA DE PERSISTENCIA REAL

La persistencia del sistema está desacoplada mediante la **Arquitectura Hexagonal**:

```
+-----------------------------------------------------------------------------------+
|                              CAPA DE PRESENTACIÓN / REACT                         |
|   Terminal de Venta, Cierre de Jornada, Configuración, Vistas Operativas          |
+-----------------------------------------------------------------------------------+
                                          │
                                          ▼
+-----------------------------------------------------------------------------------+
|                        CASOS DE USO / PUERTO IStorageRepository                   |
+-----------------------------------------------------------------------------------+
                                          │
                  ┌───────────────────────┴────────────────────────┐
                  ▼                                                ▼
+------------------------------------+           +----------------------------------+
|        LocalStorageAdapter         |           |        HttpStorageAdapter        |
|  - Almacena en window.localStorage |           |  - Consulta REST a /api/db/*     |
|  - Modo offline 100% garantizado   |           |  - Persistencia multi-cliente    |
+------------------------------------+           +----------------------------------+
                  ▲                                                ▲
                  └───────────────────────┬────────────────────────┘
                                          │
                                          ▼
                         +----------------------------------+
                         |       HybridStorageAdapter       |
                         |  - Detecta estado central        |
                         |  - Respaldo local inmutable      |
                         |  - Sincronización sin pérdidas   |
                         +----------------------------------+
                                          │
                            (Llamadas HTTP REST a Express)
                                          │
                                          ▼
+-----------------------------------------------------------------------------------+
|                         BACKEND EXPRESS (server.ts)                               |
|   /api/db/status  /api/db/migrate  /api/users  /api/shifts  /api/sales/sync-batch |
+-----------------------------------------------------------------------------------+
                                          │
                                          ▼
+-----------------------------------------------------------------------------------+
|                          CAPA DE ACCESO A DATOS (pg)                              |
|   Pool de conexiones, Transacciones ACID (withTransaction), Repositorios          |
|   (UserRepository, ShiftRepository, SaleRepository, StockRepository)              |
+-----------------------------------------------------------------------------------+
                                          │
                                          ▼
+-----------------------------------------------------------------------------------+
|                          MOTOR POSTGRESQL (Nube / Local)                          |
|   Tablas relacionales, Constraints, Índices, Moneda NUMERIC(12,2)                 |
+-----------------------------------------------------------------------------------+
```

---

## 2. ESQUEMA DE TABLAS RELACIONALES

Todas las entidades están modeladas en `migrations/001_initial_schema.sql` respetando los contratos de dominio de `src/types.ts`:

### 2.1 Tabla de Control de Versiones: `schema_migrations`
- `version VARCHAR(64) PRIMARY KEY`: Nombre o identificador único de la migración (ej: `'001_initial_schema'`).
- `applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`: Momento de ejecución.
- `description TEXT`: Detalle descriptivo del cambio.

### 2.2 Bases Operativas y Viviendas: `operational_houses`
- `id VARCHAR(64) PRIMARY KEY`: Identificador único (ej: `'HOUSE-NORTE'`).
- `name VARCHAR(120) NOT NULL`: Nombre de la base operativa.
- `address TEXT NOT NULL`: Dirección física en la Costa Atlántica.
- `freezer_capacity_units INT NOT NULL DEFAULT 2000`: Capacidad máxima de almacenamiento de tequeños congelados.
- `fixed_cost_daily NUMERIC(12, 2) NOT NULL DEFAULT 0.00`: Costo operativo diario de la vivienda/base.
- `consumables_stock JSONB NOT NULL`: Stock de garrafas de gas, conos, servilletas y salsas.
- `is_active BOOLEAN NOT NULL DEFAULT TRUE`: Soft delete.
- `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`.

### 2.3 Usuarios y Personal: `users`
- `id VARCHAR(64) PRIMARY KEY`: Identificador único (ej: `'USR-VEND-01'`).
- `name VARCHAR(120) NOT NULL`: Nombre completo.
- `email VARCHAR(160)`: Correo electrónico.
- `role VARCHAR(32) NOT NULL`: Rol del sistema (`'admin'`, `'coordinator'`, `'seller'`, `'factory_worker'`).
- `phone VARCHAR(40)`: Teléfono de contacto.
- `pin_hash VARCHAR(255)`: Código PIN para autenticación rápida en playa.
- `pin_salt VARCHAR(64)`: Sal para hasheo seguro en fases posteriores.
- `assigned_house_id VARCHAR(64) REFERENCES operational_houses(id)`: Vivienda o base asignada.
- `commission_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.2000`: Porcentaje de comisión estándar (0.20 = 20%).
- `housing_cost_exempt BOOLEAN NOT NULL DEFAULT FALSE`: Excepción de costo de vivienda.
- `housing_cost_override NUMERIC(12, 2)`: Costo de vivienda personalizado.
- `is_active BOOLEAN NOT NULL DEFAULT TRUE`: Estado de actividad.
- `permissions JSONB`: Array de permisos específicos.

### 2.4 Flota de Carritos: `selling_carts`
- `id VARCHAR(64) PRIMARY KEY`: Identificador único (ej: `'CART-01'`).
- `code VARCHAR(64) UNIQUE NOT NULL`: Identificador visible (ej: `'Carrito 01 — Costa Dorada'`).
- `model VARCHAR(100)`: Modelo de carro y tipo de quemador.
- `house_id VARCHAR(64) REFERENCES operational_houses(id)`: Base a la que pertenece.
- `status VARCHAR(32) NOT NULL CHECK ('operativo', 'en_revision', 'en_reparacion', 'fuera_de_servicio')`.
- `current_seller_id VARCHAR(64) REFERENCES users(id)`: Vendedor asignado actualmente.
- `gas_level_percent NUMERIC(5, 2) NOT NULL DEFAULT 100.00`: Porcentaje de carga de gas.
- `supplies_level JSONB`: Niveles de insumos (servilletas, conos, bandejas, salsas).
- `last_maintenance_date DATE`, `total_days_in_use INT`.
- `is_active BOOLEAN NOT NULL DEFAULT TRUE`.

### 2.5 Variedades de Tequeños y Productos: `product_varieties`
- `id VARCHAR(64) PRIMARY KEY`: Identificador único (ej: `'VAR-CLASICO'`).
- `name VARCHAR(120) NOT NULL`: Nombre comercial.
- `category VARCHAR(32) NOT NULL CHECK ('tequeno', 'aderezo', 'otro')`.
- `description TEXT`: Descripción del producto e ingredientes.
- `is_available BOOLEAN NOT NULL DEFAULT TRUE`: Disponibilidad operativa.
- `is_active BOOLEAN NOT NULL DEFAULT TRUE`: Soft delete.
- `base_price_individual NUMERIC(12, 2) NOT NULL`: Precio de venta individual en ARS.
- `combo_prices JSONB NOT NULL`: Mapa de precios por combo (`{"combo3": 3500, "combo6": 6500, "combo12": 12000}`).
- `custom_combos JSONB`: Promociones personalizadas.

### 2.6 Escalafón de Comisiones Progresivas: `commission_tiers`
- `id VARCHAR(64) PRIMARY KEY`: Identificador del tramo (ej: `'TIER-01'`).
- `name VARCHAR(120) NOT NULL`: Nombre (ej: `'Tramo Base (Hasta $110.000)'`).
- `min_sales NUMERIC(12, 2) NOT NULL`: Piso de facturación del tramo.
- `max_sales NUMERIC(12, 2)`: Techo de facturación (NULL = sin límite).
- `rate NUMERIC(5, 4) NOT NULL`: Porcentaje aplicable (0.10, 0.20, 0.30).
- `is_active BOOLEAN NOT NULL DEFAULT TRUE`: Activo/inactivo.
- `sort_order INT NOT NULL DEFAULT 0`: Orden de evaluación.

### 2.7 Jornadas Diarias de Venta: `daily_shifts`
- `id VARCHAR(64) PRIMARY KEY`: Identificador único de jornada (ej: `'SHIFT-20261010-01'`).
- `date DATE NOT NULL`: Fecha del turno.
- `house_id VARCHAR(64) REFERENCES operational_houses(id)`, `house_name VARCHAR(120)`.
- `coordinator_id VARCHAR(64) REFERENCES users(id)`, `coordinator_name VARCHAR(120)`.
- `seller_id VARCHAR(64) NOT NULL REFERENCES users(id)`, `seller_name VARCHAR(120)`.
- `cart_id VARCHAR(64) NOT NULL REFERENCES selling_carts(id)`, `cart_code VARCHAR(64)`.
- `zone_id VARCHAR(64)`, `zone_name VARCHAR(120)`.
- `status VARCHAR(32) NOT NULL CHECK ('planificada', 'en_curso', 'esperando_cierre', 'conciliada', 'liquidada')`.
- `start_time TIMESTAMPTZ NOT NULL`, `end_time TIMESTAMPTZ`.
- `total_gross_sales NUMERIC(12, 2)`, `total_cash_sales NUMERIC(12, 2)`, `total_mp_sales NUMERIC(12, 2)`.
- `cash_expected NUMERIC(12, 2)`, `cash_declared NUMERIC(12, 2)`, `cash_difference NUMERIC(12, 2)`.
- `mp_validated_amount NUMERIC(12, 2)`, `mp_pending_or_suspicious_amount NUMERIC(12, 2)`.
- `total_units_delivered INT`, `total_units_restocked INT`, `total_units_sold INT`, `total_units_returned INT`, `total_units_waste INT`, `total_units_difference INT`.
- `commission_rate NUMERIC(5, 4)`, `applied_commission_tier_id VARCHAR(64)`, `gross_commission NUMERIC(12, 2)`.
- `housing_cost_deduction NUMERIC(12, 2)`, `deductions_for_missing_units NUMERIC(12, 2)`.
- `waste_deduction_breakdown JSONB`: Desglose exacto de merma tolerada vs. merma excedente combo.
- `final_payout_amount NUMERIC(12, 2) NOT NULL`: Salario final neto a pagar.
- `payout_status VARCHAR(32) NOT NULL CHECK ('pendiente', 'pagado', 'retenido_revision')`.
- `coordinator_signature TEXT`: Firma digitalizada del coordinador.

### 2.8 Stock por Jornada: `shift_stock_items`
- `id VARCHAR(64) PRIMARY KEY`.
- `shift_id VARCHAR(64) NOT NULL REFERENCES daily_shifts(id) ON DELETE CASCADE`.
- `variety_id VARCHAR(64) NOT NULL REFERENCES product_varieties(id)`.
- `variety_name VARCHAR(120) NOT NULL`.
- `delivered_units INT NOT NULL DEFAULT 0`: Entregados a la mañana.
- `resupplied_units INT NOT NULL DEFAULT 0`: Repuestos en la arena.
- `sold_units INT NOT NULL DEFAULT 0`: Vendidos según registro.
- `returned_units INT NOT NULL DEFAULT 0`: Sobrantes físicos devueltos.
- `waste_units INT NOT NULL DEFAULT 0`: Mermas registradas.
- `difference_units INT NOT NULL DEFAULT 0`: Balance físico estricto.
- `CONSTRAINT uq_shift_stock_item UNIQUE (shift_id, variety_id)`.

### 2.9 Transacciones de Venta: `sales`
- `id VARCHAR(64) PRIMARY KEY`: UUID o identificador de venta generado en cliente.
- `shift_id VARCHAR(64) NOT NULL REFERENCES daily_shifts(id) ON DELETE RESTRICT`.
- `seller_id VARCHAR(64) NOT NULL REFERENCES users(id)`.
- `seller_name VARCHAR(120) NOT NULL`.
- `timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`.
- `item_type VARCHAR(32) NOT NULL CHECK ('unidad', 'combo3', 'combo6', 'combo12', 'adicional')`.
- `variety_id VARCHAR(64) NOT NULL REFERENCES product_varieties(id)`.
- `variety_name VARCHAR(120) NOT NULL`.
- `quantity_units_equivalent INT NOT NULL CHECK (quantity_units_equivalent > 0)`.
- `total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0)`.
- `payment_method VARCHAR(32) NOT NULL CHECK ('efectivo', 'mercado_pago', 'transferencia')`.
- `location_name VARCHAR(120)`, `beach_sector VARCHAR(120)`.
- `voucher_photo_url TEXT`, `voucher_extracted_data JSONB`.
- `validation_status VARCHAR(32) NOT NULL CHECK ('validada', 'pendiente_revision', 'inconsistente', 'sospechosa')`.
- `mp_api_verification JSONB`: Registro de respuesta oficial de API Mercado Pago (amount, transactionId, etc.).
- `gps_location JSONB`: Coordenadas geográficas lat/lng.
- `is_offline_created BOOLEAN NOT NULL DEFAULT FALSE`.

### 2.10 Tablas de Soporte y Auditoría
- `shift_waste_records`: Registro individual de mermas con motivo, unidades y hora.
- `shift_restock_records`: Registro de entregas intermedias en la playa por coordinadores en moto.
- `system_configs`: Parámetros operativos globales (tolerancia de mermas, tarifas, alias MP).
- `operational_expenses`: Gastos de flete, garrafas, reparaciones y alquiler.
- `cart_incidents`: Registro de desperfectos mecánicos en carritos.
- `audit_logs`: Trazabilidad inmutable de cambios con usuario, acción, entidad y valor previo/nuevo.
- `mp_webhook_events`: Registro de todas las notificaciones IPN recibidas desde Mercado Pago.

---

## 3. MIGRACIONES Y REPRODUCIBILIDAD

El sistema de migraciones reside en `/migrations` y es ejecutado por `src/server/db/migrator.ts`:

1. `migrations/001_initial_schema.sql`: Estructura completa DDL de tablas, índices y restricciones.
2. `migrations/002_seed_initial_data.sql`: Datos semilla reproducibles (casas, variedades, usuarios y tramos de comisión).

Para ejecutar las migraciones automáticamente:
- **Vía API:** `POST /api/db/migrate`
- **Vía script de verificación:** `npx tsx scripts/verify-persistence.ts`

---

## 4. CONEXIÓN Y VARIABLES DE ENTORNO

La conexión a PostgreSQL se configura exclusivamente mediante variables de entorno en el servidor:

```bash
# Formato estándar de conexión
DATABASE_URL="postgresql://usuario:password@host:5432/sgmo_tequenos?sslmode=require"

# O mediante parámetros individuales
PGHOST="localhost"
PGPORT="5432"
PGDATABASE="sgmo_tequenos"
PGUSER="postgres"
PGPASSWORD="secret_password"
```

Si estas variables no están presentes, el backend responde en `GET /api/db/status`:
```json
{
  "status": "DATABASE NOT CONFIGURED",
  "configured": false,
  "provider": "Ninguno (Requiere DATABASE_URL en variables de entorno)",
  "message": "PostgreSQL no está configurado. La aplicación opera con persistencia local en el navegador del dispositivo."
}
```
Y el sistema continúa operando mediante `LocalStorageAdapter` sin interrupciones.

---

## 5. ESTRATEGIA OFFLINE Y SINCRONIZACIÓN

1. **Generación de IDs en Cliente:**
   - Toda venta genera un ID único con prefijo de tiempo y random (`crypto.randomUUID()` o `sale-timestamp-rand`).
   - Esto garantiza que al sincronizar contra PostgreSQL no existan colisiones de claves primarias.
2. **Idempotencia en Lote (`POST /api/sales/sync-batch`):**
   - El endpoint de sincronización utiliza `ON CONFLICT (id)` o comprobación de existencia para evitar duplicar ventas si la misma transacción se retransmite.
3. **Resguardo de la Cola Offline:**
   - `flushOfflineQueue()` en `storageService.ts` no purga la cola si el servidor no responde o devuelve 503; los datos locales permanecen intactos hasta recibir confirmación HTTP 200.
