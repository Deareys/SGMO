-- A payment can fund one sale only. Evidence is written exclusively by the bank verification flow.
CREATE TABLE IF NOT EXISTS bank_payment_claims (
  payment_id VARCHAR(32) PRIMARY KEY,
  sale_id VARCHAR(64) NOT NULL UNIQUE REFERENCES sales(id),
  collector_id VARCHAR(32) NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency_id VARCHAR(3) NOT NULL CHECK (currency_id = 'ARS'),
  status VARCHAR(32) NOT NULL,
  bank_updated_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS bank_webhook_events (
  id VARCHAR(64) PRIMARY KEY,
  payment_id VARCHAR(32) NOT NULL,
  request_id VARCHAR(128) NOT NULL,
  signature_timestamp VARCHAR(16) NOT NULL,
  state VARCHAR(16) NOT NULL DEFAULT 'received' CHECK (state IN ('received','processed','unmatched','failed')),
  attempts INT NOT NULL DEFAULT 0,
  summary JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_bank_webhooks_pending ON bank_webhook_events(state, received_at);
INSERT INTO schema_migrations(version,description) VALUES ('008_bank_payment_claims','Unique bank payment claims and durable authenticated webhook inbox') ON CONFLICT(version) DO NOTHING;
