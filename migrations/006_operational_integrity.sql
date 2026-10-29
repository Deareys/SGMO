-- Hito 2.1 — snapshots de cierre y declaración física inmutables por flujo servidor.
-- No cambia fórmulas financieras ni borra ventas/evidencia existente.
ALTER TABLE daily_shifts ADD COLUMN IF NOT EXISTS settlement_snapshot JSONB;
ALTER TABLE daily_shifts ADD COLUMN IF NOT EXISTS dispatch_snapshot JSONB;
ALTER TABLE daily_shifts ADD COLUMN IF NOT EXISTS leftovers_snapshot JSONB;

-- Una misma acreditación bancaria real no puede respaldar dos ventas distintas.
-- Si evidencia histórica contiene duplicados, la migración falla y revierte:
-- auditar esas ventas antes de aplicar, nunca borrar comprobantes automáticamente.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_live_mp_transaction
ON sales ((mp_api_verification->>'mpTransactionId'))
WHERE mp_api_verification->>'matchedInApi' = 'true'
  AND mp_api_verification->>'isLiveApi' = 'true'
  AND mp_api_verification->>'apiStatus' = 'approved'
  AND mp_api_verification->>'mpTransactionId' IS NOT NULL;

INSERT INTO schema_migrations (version,description)
VALUES ('006_operational_integrity','Snapshots de cierre y retorno físico, unicidad evidencia Mercado Pago real')
ON CONFLICT (version) DO NOTHING;
