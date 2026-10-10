-- =====================================================================
-- SGMO — Sistema de Gestión y Monitoreo de Operación (Tequeños Costa)
-- MIGRACIÓN 001: Esquema Relacional Inicial para PostgreSQL
-- =====================================================================

-- Extensión para generación de UUIDs si está disponible
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de Control de Versiones de Esquema
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(64) PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

-- 1. TABLA: operational_houses (Bases Operativas y Viviendas de Temporada)
CREATE TABLE IF NOT EXISTS operational_houses (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    address TEXT NOT NULL,
    freezer_capacity_units INT NOT NULL DEFAULT 2000,
    fixed_cost_daily NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    consumables_stock JSONB NOT NULL DEFAULT '{"gasTanksAvailable":0,"gasTanksInUse":0,"napkinPacks":0,"traysCount":0,"paperConesCount":0,"sauceBottlesCount":0}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLA: users (Personal, Vendedores, Coordinadores, Administradores)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(160),
    role VARCHAR(32) NOT NULL CHECK (role IN ('admin', 'coordinator', 'seller', 'factory_worker')),
    phone VARCHAR(40),
    pin_hash VARCHAR(255),
    pin_salt VARCHAR(64),
    avatar_url TEXT,
    assigned_house_id VARCHAR(64) REFERENCES operational_houses(id) ON DELETE SET NULL,
    commission_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.2000 CHECK (commission_rate >= 0 AND commission_rate <= 1),
    housing_cost_exempt BOOLEAN NOT NULL DEFAULT FALSE,
    housing_cost_override NUMERIC(12, 2),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_assigned_house ON users(assigned_house_id);

-- 3. TABLA: selling_carts (Flota de Carritos de Venta Ambulante)
CREATE TABLE IF NOT EXISTS selling_carts (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(64) UNIQUE NOT NULL,
    model VARCHAR(100),
    house_id VARCHAR(64) REFERENCES operational_houses(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'operativo' CHECK (status IN ('operativo', 'en_revision', 'en_reparacion', 'fuera_de_servicio')),
    current_seller_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    gas_level_percent NUMERIC(5, 2) NOT NULL DEFAULT 100.00 CHECK (gas_level_percent >= 0 AND gas_level_percent <= 100),
    supplies_level JSONB NOT NULL DEFAULT '{"napkins":"alto","cones":"alto","trays":"alto","sauces":"alto"}'::jsonb,
    last_maintenance_date DATE,
    total_days_in_use INT NOT NULL DEFAULT 0,
    notes TEXT,
    location_notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_carts_house ON selling_carts(house_id);
CREATE INDEX IF NOT EXISTS idx_carts_status ON selling_carts(status);

-- 4. TABLA: product_varieties (Variedades de Tequeños y Productos)
CREATE TABLE IF NOT EXISTS product_varieties (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    category VARCHAR(32) NOT NULL DEFAULT 'tequeno' CHECK (category IN ('tequeno', 'aderezo', 'otro')),
    description TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    base_price_individual NUMERIC(12, 2) NOT NULL CHECK (base_price_individual >= 0),
    combo_prices JSONB NOT NULL DEFAULT '{"combo3":0,"combo6":0,"combo12":0}'::jsonb,
    custom_combos JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_varieties_active ON product_varieties(is_active, is_available);

-- 5. TABLA: commission_tiers (Escalafón Dinámico de Comisiones Progresivas)
CREATE TABLE IF NOT EXISTS commission_tiers (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    min_sales NUMERIC(12, 2) NOT NULL CHECK (min_sales >= 0),
    max_sales NUMERIC(12, 2), -- NULL representa infinito / sin límite superior
    rate NUMERIC(5, 4) NOT NULL CHECK (rate >= 0 AND rate <= 1),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tiers_active ON commission_tiers(is_active, sort_order);

-- 6. TABLA: daily_shifts (Jornadas Diarias de Venta)
CREATE TABLE IF NOT EXISTS daily_shifts (
    id VARCHAR(64) PRIMARY KEY,
    date DATE NOT NULL,
    house_id VARCHAR(64) REFERENCES operational_houses(id),
    house_name VARCHAR(120) NOT NULL,
    coordinator_id VARCHAR(64) REFERENCES users(id),
    coordinator_name VARCHAR(120) NOT NULL,
    seller_id VARCHAR(64) NOT NULL REFERENCES users(id),
    seller_name VARCHAR(120) NOT NULL,
    cart_id VARCHAR(64) NOT NULL REFERENCES selling_carts(id),
    cart_code VARCHAR(64) NOT NULL,
    zone_id VARCHAR(64) NOT NULL,
    zone_name VARCHAR(120) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'en_curso' CHECK (status IN ('planificada', 'en_curso', 'esperando_cierre', 'conciliada', 'liquidada')),
    supplies_provided JSONB NOT NULL DEFAULT '{"gasPercentStart":100,"napkinsDelivered":0,"conesDelivered":0,"saucesProvided":[]}'::jsonb,
    start_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMPTZ,
    
    -- Métricas financieras brutas
    total_gross_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_cash_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_mp_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_transfer_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    season VARCHAR(64) DEFAULT 'Temporada 2026-2027',
    
    -- Arqueo de efectivo
    cash_expected NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cash_declared NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cash_difference NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    
    -- Blindaje Mercado Pago
    mp_validated_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    mp_pending_or_suspicious_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    
    -- Conteo físico de unidades
    total_units_delivered INT NOT NULL DEFAULT 0,
    total_units_restocked INT NOT NULL DEFAULT 0,
    total_units_sold INT NOT NULL DEFAULT 0,
    total_units_returned INT NOT NULL DEFAULT 0,
    total_units_waste INT NOT NULL DEFAULT 0,
    total_units_difference INT NOT NULL DEFAULT 0,
    
    -- Liquidación del Vendedor
    commission_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.2000,
    applied_commission_tier_id VARCHAR(64),
    applied_commission_tier_name VARCHAR(120),
    gross_commission NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    housing_cost_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    housing_cost_exempt BOOLEAN NOT NULL DEFAULT FALSE,
    deductions_for_missing_units NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    waste_deduction_breakdown JSONB,
    incentives_or_bonuses NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    final_payout_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payout_status VARCHAR(32) NOT NULL DEFAULT 'pendiente' CHECK (payout_status IN ('pendiente', 'pagado', 'retenido_revision')),
    payout_timestamp TIMESTAMPTZ,
    payout_payment_proof TEXT,
    notes TEXT,
    coordinator_signature TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shifts_date ON daily_shifts(date);
CREATE INDEX IF NOT EXISTS idx_shifts_seller ON daily_shifts(seller_id);
CREATE INDEX IF NOT EXISTS idx_shifts_cart ON daily_shifts(cart_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON daily_shifts(status);

-- 7. TABLA: shift_stock_items (Balance de Stock por Variedad en cada Jornada)
CREATE TABLE IF NOT EXISTS shift_stock_items (
    id VARCHAR(64) PRIMARY KEY,
    shift_id VARCHAR(64) NOT NULL REFERENCES daily_shifts(id) ON DELETE CASCADE,
    variety_id VARCHAR(64) NOT NULL REFERENCES product_varieties(id),
    variety_name VARCHAR(120) NOT NULL,
    delivered_units INT NOT NULL DEFAULT 0,
    resupplied_units INT NOT NULL DEFAULT 0,
    sold_units INT NOT NULL DEFAULT 0,
    returned_units INT NOT NULL DEFAULT 0,
    waste_units INT NOT NULL DEFAULT 0,
    difference_units INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_shift_stock_item UNIQUE (shift_id, variety_id)
);

CREATE INDEX IF NOT EXISTS idx_shift_stock_shift ON shift_stock_items(shift_id);

-- 8. TABLA: shift_waste_records (Mermas Justificadas y Roturas en Turno)
CREATE TABLE IF NOT EXISTS shift_waste_records (
    id VARCHAR(64) PRIMARY KEY,
    shift_id VARCHAR(64) NOT NULL REFERENCES daily_shifts(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    seller_id VARCHAR(64) NOT NULL REFERENCES users(id),
    seller_name VARCHAR(120) NOT NULL,
    variety_id VARCHAR(64) NOT NULL REFERENCES product_varieties(id),
    variety_name VARCHAR(120) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    reason VARCHAR(64) NOT NULL,
    reason_label VARCHAR(120) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_waste_shift ON shift_waste_records(shift_id);

-- 9. TABLA: shift_restock_records (Reposiciones Intermedias en la Playa)
CREATE TABLE IF NOT EXISTS shift_restock_records (
    id VARCHAR(64) PRIMARY KEY,
    shift_id VARCHAR(64) NOT NULL REFERENCES daily_shifts(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    seller_id VARCHAR(64) NOT NULL REFERENCES users(id),
    seller_name VARCHAR(120) NOT NULL,
    coordinator_id VARCHAR(64) REFERENCES users(id),
    coordinator_name VARCHAR(120) NOT NULL,
    variety_id VARCHAR(64) NOT NULL REFERENCES product_varieties(id),
    variety_name VARCHAR(120) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    origin_location VARCHAR(120) NOT NULL,
    destination_location VARCHAR(120) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_restock_shift ON shift_restock_records(shift_id);

-- 10. TABLA: sales (Transacciones de Venta en Playa)
CREATE TABLE IF NOT EXISTS sales (
    id VARCHAR(64) PRIMARY KEY,
    shift_id VARCHAR(64) NOT NULL REFERENCES daily_shifts(id) ON DELETE RESTRICT,
    seller_id VARCHAR(64) NOT NULL REFERENCES users(id),
    seller_name VARCHAR(120) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    item_type VARCHAR(32) NOT NULL CHECK (item_type IN ('unidad', 'combo3', 'combo6', 'combo12', 'adicional')),
    variety_id VARCHAR(64) NOT NULL REFERENCES product_varieties(id),
    variety_name VARCHAR(120) NOT NULL,
    quantity_units_equivalent INT NOT NULL CHECK (quantity_units_equivalent > 0),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    payment_method VARCHAR(32) NOT NULL CHECK (payment_method IN ('efectivo', 'mercado_pago', 'transferencia')),
    
    -- Ubicación y sector
    location_name VARCHAR(120),
    beach_sector VARCHAR(120),
    
    -- Comprobante e IA
    voucher_photo_url TEXT,
    voucher_extracted_data JSONB,
    validation_status VARCHAR(32) NOT NULL DEFAULT 'pendiente_revision' CHECK (validation_status IN ('validada', 'pendiente_revision', 'inconsistente', 'sospechosa')),
    
    -- Verificación oficial Mercado Pago API
    mp_api_verification JSONB,
    
    -- Coordenadas GPS
    gps_location JSONB,
    is_offline_created BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sales_shift ON sales(shift_id);
CREATE INDEX IF NOT EXISTS idx_sales_seller ON sales(seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON sales(timestamp);
CREATE INDEX IF NOT EXISTS idx_sales_validation_status ON sales(validation_status);

-- 11. TABLA: system_configs (Parámetros Globales del Sistema)
CREATE TABLE IF NOT EXISTS system_configs (
    config_key VARCHAR(64) PRIMARY KEY,
    config_value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(64)
);

-- 12. TABLA: operational_expenses (Gastos Operativos y Logística)
CREATE TABLE IF NOT EXISTS operational_expenses (
    id VARCHAR(64) PRIMARY KEY,
    date DATE NOT NULL,
    category VARCHAR(64) NOT NULL,
    house_id VARCHAR(64) REFERENCES operational_houses(id),
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    receipt_number VARCHAR(120),
    registered_by VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON operational_expenses(date);

-- 13. TABLA: cart_incidents (Mantenimiento e Incidencias Mecánicas)
CREATE TABLE IF NOT EXISTS cart_incidents (
    id VARCHAR(64) PRIMARY KEY,
    date DATE NOT NULL,
    cart_id VARCHAR(64) NOT NULL REFERENCES selling_carts(id),
    reported_by VARCHAR(120) NOT NULL,
    type VARCHAR(64) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'reportado' CHECK (status IN ('reportado', 'en_revision', 'pendiente', 'en_reparacion', 'solucionado')),
    cost_of_repair NUMERIC(12, 2),
    resolved_date DATE,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_incidents_cart ON cart_incidents(cart_id);

-- 14. TABLA: audit_logs (Bitácora Inmutable de Auditoría)
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(64) NOT NULL,
    user_name VARCHAR(120) NOT NULL,
    user_role VARCHAR(32) NOT NULL,
    action VARCHAR(120) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    details TEXT NOT NULL,
    previous_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

-- 15. TABLA: mp_webhook_events (Notificaciones Oficiales IPN de Mercado Pago)
CREATE TABLE IF NOT EXISTS mp_webhook_events (
    id VARCHAR(64) PRIMARY KEY,
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    topic VARCHAR(64) NOT NULL,
    action VARCHAR(64),
    resource_id VARCHAR(120),
    payment_data JSONB,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mp_webhooks_resource ON mp_webhook_events(resource_id);

-- Registrar versión inicial aplicada en schema_migrations
INSERT INTO schema_migrations (version, description)
VALUES ('001_initial_schema', 'Esquema relacional inicial para usuarios, carritos, productos, jornadas, stock, ventas, mermas, gastos y auditoría')
ON CONFLICT (version) DO NOTHING;
