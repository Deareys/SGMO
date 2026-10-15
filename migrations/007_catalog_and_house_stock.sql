-- Stock físico por casa: empieza vacío. El administrador registra el conteo real.
-- No copiar cantidades de mockData ni fabricar inventario al aplicar la migración.
CREATE TABLE IF NOT EXISTS house_stock (
 house_id VARCHAR(64) NOT NULL REFERENCES operational_houses(id),
 variety_id VARCHAR(64) NOT NULL REFERENCES product_varieties(id),
 units INTEGER NOT NULL DEFAULT 0 CHECK (units >= 0),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (house_id, variety_id)
);
CREATE TABLE IF NOT EXISTS house_stock_adjustments (
 id VARCHAR(64) PRIMARY KEY,
 house_id VARCHAR(64) NOT NULL REFERENCES operational_houses(id),
 variety_id VARCHAR(64) NOT NULL REFERENCES product_varieties(id),
 previous_units INTEGER NOT NULL CHECK (previous_units >= 0),
 new_units INTEGER NOT NULL CHECK (new_units >= 0),
 reason TEXT NOT NULL,
 actor_id VARCHAR(64) NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO schema_migrations(version,description) VALUES ('007_catalog_and_house_stock','Inventario real por casa y ajustes auditables sin inventario ficticio') ON CONFLICT(version) DO NOTHING;
