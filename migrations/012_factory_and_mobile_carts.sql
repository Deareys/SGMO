-- Operación de fábrica compartida. Los comandos se confirman con sus movimientos de stock.
CREATE TABLE IF NOT EXISTS factory_state (
  id INTEGER PRIMARY KEY CHECK(id=1),
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO factory_state(id,payload) VALUES(1,'{"rawMaterials":[],"recipes":[],"productionOrders":[],"productionBatches":[],"materialPurchases":[],"supplyCategories":[],"suppliers":[],"factoryIncidents":[],"transfers":[]}'::jsonb) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS factory_commands (
  id VARCHAR(64) PRIMARY KEY,
  actor_id VARCHAR(64) NOT NULL REFERENCES users(id),
  request_hash VARCHAR(64) NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS factory_legacy_archives (
  id VARCHAR(64) PRIMARY KEY REFERENCES factory_commands(id),
  actor_id VARCHAR(64) NOT NULL REFERENCES users(id),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE daily_shifts ADD COLUMN IF NOT EXISTS return_house_id VARCHAR(64) REFERENCES operational_houses(id);
ALTER TABLE daily_shifts ADD COLUMN IF NOT EXISTS return_house_name VARCHAR(120);
INSERT INTO schema_migrations(version,description) VALUES('012_factory_and_mobile_carts','Fábrica y traslados transaccionales, idempotencia y destino independiente del carrito') ON CONFLICT(version) DO NOTHING;
