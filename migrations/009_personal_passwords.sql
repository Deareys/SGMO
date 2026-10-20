-- Contraseñas personales y recuperación presencial. No modifica hashes, sesiones ni operaciones existentes.
ALTER TABLE users ADD COLUMN IF NOT EXISTS credential_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_auth_credentials_consistent;
ALTER TABLE users ADD CONSTRAINT users_auth_credentials_consistent CHECK (
  (credential_type IN ('password_12','password_14') AND (credential_type != 'password_14' OR role='admin')
    AND pin_hash IS NULL AND pin_salt IS NULL
    AND ((password_hash IS NULL AND password_salt IS NULL AND is_provisioned=FALSE)
      OR (COALESCE(password_hash ~ '^[0-9a-f]{64}$',FALSE) AND COALESCE(password_salt ~ '^[0-9a-f]{32}$',FALSE))))
  OR
  (role!='admin' AND credential_type='pin_8' AND password_hash IS NULL AND password_salt IS NULL
    AND ((pin_hash IS NULL AND pin_salt IS NULL AND is_provisioned=FALSE)
      OR (COALESCE(pin_hash ~ '^[0-9a-f]{64}$',FALSE) AND COALESCE(pin_salt ~ '^[0-9a-f]{32}$',FALSE))))
);
CREATE TABLE IF NOT EXISTS auth_password_activations (
  token_hash VARCHAR(64) PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  user_id VARCHAR(64) NOT NULL REFERENCES users(id),
  credential_version BIGINT NOT NULL,
  issued_by VARCHAR(64) REFERENCES users(id),
  issuer_credential_version BIGINT,
  purpose VARCHAR(16) NOT NULL CHECK (purpose IN ('activation','recovery')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CHECK (expires_at > created_at),
  CHECK ((issued_by IS NULL AND issuer_credential_version IS NULL) OR (issued_by IS NOT NULL AND issuer_credential_version IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_auth_password_activations_user ON auth_password_activations(user_id) WHERE consumed_at IS NULL AND revoked_at IS NULL;
INSERT INTO schema_migrations(version,description) VALUES('009_personal_passwords','Contraseñas personales, versión de credencial y activaciones de un solo uso sin secretos reversibles') ON CONFLICT(version) DO NOTHING;
