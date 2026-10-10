-- =====================================================================
-- SGMO — Sistema de Gestión y Monitoreo de Operación (Tequeños Costa)
-- MIGRACIÓN 003: Esquema de Sesiones, Auditoría y Seguridad
-- =====================================================================

-- 1. TABLA: auth_sessions (Sesiones y Tokens Seguros emitidos por el Servidor)
CREATE TABLE IF NOT EXISTS auth_sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    role VARCHAR(32) NOT NULL,
    ip_address VARCHAR(64),
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON auth_sessions(expires_at);

-- 2. Asegurar columnas de seguridad en la tabla users
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_salt VARCHAR(64);

-- Registrar versión en schema_migrations
INSERT INTO schema_migrations (version, description)
VALUES ('003_auth_sessions_security', 'Tabla auth_sessions, indices y campos de control de intentos fallidos en users')
ON CONFLICT (version) DO NOTHING;
