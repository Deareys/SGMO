-- =====================================================================
-- SGMO — Sistema de Gestión y Monitoreo de Operación (Tequeños Costa)
-- MIGRACIÓN 002: Semilla Inicial de Datos Operativos (Reproducible)
-- =====================================================================

-- 1. Bases Operativas
INSERT INTO operational_houses (id, name, address, freezer_capacity_units, fixed_cost_daily, is_active)
VALUES
    ('HOUSE-NORTE', 'Base Operativa Norte — Calle 65', 'Calle 65 Nº 320, Santa Teresita', 2500, 15000.00, TRUE),
    ('HOUSE-SUR', 'Base Operativa Sur — Calle 15', 'Calle 15 Nº 410, Mar del Tuyú', 2000, 12000.00, TRUE)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address;

-- 2. Variedades de Producto
INSERT INTO product_varieties (id, name, category, description, is_available, is_active, base_price_individual, combo_prices)
VALUES
    ('VAR-CLASICO', 'Tequeño Clásico (Queso Llanero)', 'tequeno', 'Relleno de queso semiduro artesanal envuelto en masa crocante.', TRUE, TRUE, 1250.00, '{"combo3":3500,"combo6":6500,"combo12":12000}'::jsonb),
    ('VAR-AHUMADO', 'Tequeño Ahumado & Albahaca', 'tequeno', 'Queso ahumado con toque de albahaca fresca y finas hierbas.', TRUE, TRUE, 1350.00, '{"combo3":3800,"combo6":7000,"combo12":13000}'::jsonb),
    ('VAR-DULCE', 'Tequeño Dulce (Guayaba & Queso)', 'tequeno', 'El clásico contraste caribeño de dulce de guayaba y queso salado.', TRUE, TRUE, 1350.00, '{"combo3":3800,"combo6":7000,"combo12":13000}'::jsonb),
    ('VAR-CHEDDAR', 'Tequeño Cheddar & Panceta', 'tequeno', 'Queso cheddar fundente con trocitos crocantes de panceta.', TRUE, TRUE, 1400.00, '{"combo3":4000,"combo6":7500,"combo12":14000}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    base_price_individual = EXCLUDED.base_price_individual,
    combo_prices = EXCLUDED.combo_prices;

-- 3. Usuarios Iniciales
INSERT INTO users (id, name, email, role, phone, pin_hash, assigned_house_id, commission_rate, housing_cost_exempt, is_active)
VALUES
    ('USR-ADMIN-01', 'Sebastián Queipo', 'admin@tequenos.costa.ar', 'admin', '+54 9 11 4050-6070', '9999', 'HOUSE-NORTE', 0.2000, TRUE, TRUE),
    ('USR-COORD-01', 'Martín Rodríguez', 'martin.coord@tequenos.costa.ar', 'coordinator', '+54 9 2246 51-2345', '2024', 'HOUSE-NORTE', 0.2000, TRUE, TRUE),
    ('USR-COORD-02', 'Florencia Gómez', 'flor.coord@tequenos.costa.ar', 'coordinator', '+54 9 2246 51-6789', '2025', 'HOUSE-SUR', 0.2000, TRUE, TRUE),
    ('USR-VEND-01', 'Lucas Pereyra', 'lucas.p@gmail.com', 'seller', '+54 9 11 3456-7890', '1234', 'HOUSE-NORTE', 0.2000, FALSE, TRUE),
    ('USR-VEND-02', 'Camila Benítez', 'camila.b@gmail.com', 'seller', '+54 9 11 9876-5432', '5678', 'HOUSE-NORTE', 0.2000, FALSE, TRUE),
    ('USR-VEND-03', 'Mateo Rossi', 'mateo.rossi@gmail.com', 'seller', '+54 9 11 2345-6789', '4321', 'HOUSE-SUR', 0.2000, FALSE, TRUE)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role;

-- 4. Carritos
INSERT INTO selling_carts (id, code, model, house_id, status, current_seller_id, gas_level_percent, is_active)
VALUES
    ('CART-01', 'Carrito 01 — Costa Dorada', 'Acero Inoxidable Doble Quemador', 'HOUSE-NORTE', 'operativo', 'USR-VEND-01', 90.00, TRUE),
    ('CART-02', 'Carrito 02 — Muelle Central', 'Acero Inoxidable Standard', 'HOUSE-NORTE', 'operativo', 'USR-VEND-02', 85.00, TRUE),
    ('CART-03', 'Carrito 03 — Faro Sur', 'Reforzado Ruedas Anchas Arena', 'HOUSE-SUR', 'operativo', 'USR-VEND-03', 95.00, TRUE),
    ('CART-04', 'Carrito 04 — Reserva', 'Standard Plegable', 'HOUSE-NORTE', 'operativo', NULL, 100.00, TRUE)
ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    status = EXCLUDED.status;

-- 5. Tramos de Comisión Progresivos (Escalafón Dinámico)
INSERT INTO commission_tiers (id, name, min_sales, max_sales, rate, is_active, sort_order)
VALUES
    ('TIER-01', 'Tramo Base (Hasta $110.000)', 0.00, 110000.00, 0.1000, TRUE, 1),
    ('TIER-02', 'Tramo Intermedio ($110.000 a $220.000)', 110000.01, 220000.00, 0.2000, TRUE, 2),
    ('TIER-03', 'Tramo Estrella (Más de $220.000)', 220000.01, NULL, 0.3000, TRUE, 3)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    min_sales = EXCLUDED.min_sales,
    max_sales = EXCLUDED.max_sales,
    rate = EXCLUDED.rate;

-- 6. Configuración General del Sistema
INSERT INTO system_configs (config_key, config_value, updated_by)
VALUES
    ('GLOBAL_PARAMS', '{
        "systemName": "SGMO — Tequeños Costa",
        "housingCostPerPersonDaily": 8000.00,
        "defaultCommissionRate": 0.20,
        "deductionRatePerMissingUnit": 1500.00,
        "wasteToleranceThreshold": 3,
        "wastePenaltyRateBelowOrEqual": 500.00,
        "wastePenaltyRateAbove": 2500.00,
        "lowStockAlertThreshold": 20,
        "mercadoPagoConfig": {
            "alias": "tequenos.costa.mp",
            "accountHolder": "Tequeños Costa SRL"
        }
    }'::jsonb, 'USR-ADMIN-01')
ON CONFLICT (config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value;

-- Registrar migración 002
INSERT INTO schema_migrations (version, description)
VALUES ('002_seed_initial_data', 'Semilla inicial con casas operativas, variedades, usuarios base, carritos y tramos de comisión')
ON CONFLICT (version) DO NOTHING;
