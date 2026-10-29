-- Conservación íntegra y trazable de datos del prototipo, sin secretos.
-- No transforma confirmaciones locales en pagos bancarios ni liquidaciones oficiales.
CREATE TABLE IF NOT EXISTS legacy_imports (
  id UUID PRIMARY KEY,
  source_id UUID NOT NULL UNIQUE,
  source_origin TEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  imported_by VARCHAR(64) NOT NULL REFERENCES users(id),
  payload JSONB NOT NULL,
  record_counts JSONB NOT NULL,
  catalog_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO schema_migrations(version,description) VALUES('011_legacy_recovery','Respaldo trazable del prototipo y resultado de incorporación del catálogo') ON CONFLICT(version) DO NOTHING;
