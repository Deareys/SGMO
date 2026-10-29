-- Inicialización productiva sin personas ficticias, precios, stock o ventas demo.
-- Ejecutar sólo en destino respaldado. No reemplaza filas existentes.
INSERT INTO users(id,name,role,commission_rate,housing_cost_exempt,is_active)
VALUES('USR-ADMIN-01','Dueño del negocio (pendiente de activación)','admin',0,TRUE,TRUE)
ON CONFLICT(id) DO NOTHING;
INSERT INTO system_configs(config_key,config_value,updated_by)
VALUES('GLOBAL_PARAMS','{"systemName":"SGMO — Tequeños Costa","housingCostPerPersonDaily":0,"defaultCommissionRate":0,"deductionRatePerMissingUnit":0,"wasteToleranceThreshold":0,"wastePenaltyRateBelowOrEqual":0,"wastePenaltyRateAbove":0,"lowStockAlertThreshold":20,"mercadoPagoConfig":{}}'::jsonb,'USR-ADMIN-01')
ON CONFLICT(config_key) DO NOTHING;
INSERT INTO system_configs(config_key,config_value,updated_by)
VALUES('beach_zones','[]'::jsonb,'USR-ADMIN-01') ON CONFLICT(config_key) DO NOTHING;
INSERT INTO schema_migrations(version,description)
VALUES('002_production_baseline','Inicialización sin datos ficticios; reemplaza la semilla de demostración 002_seed_initial_data en este entorno')
ON CONFLICT(version) DO NOTHING;
