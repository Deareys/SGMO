-- =====================================================================
-- SGMO — Sistema de Gestión y Monitoreo de Operación (Tequeños Costa)
-- MIGRACIÓN 004: Modernización de Autenticación, Credenciales y Códigos de Usuario
-- =====================================================================

-- 1. Añadir columnas de soporte para credenciales modernizadas en tabla users
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_code VARCHAR(32) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(128);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_salt VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS credential_type VARCHAR(32) DEFAULT 'pin_8';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_provisioned BOOLEAN DEFAULT FALSE;

-- 2. Índice para acelerar búsquedas por código de usuario
CREATE INDEX IF NOT EXISTS idx_users_user_code ON users(user_code);

-- 3. Asignar códigos únicos estables a las cuentas operativas del negocio
UPDATE users SET user_code = 'ADM-01', credential_type = 'password_14' WHERE id = 'USR-ADMIN-1' OR id = 'USR-ADMIN-01';
UPDATE users SET user_code = 'COORD-01', credential_type = 'pin_8' WHERE id = 'USR-COORD-1' OR id = 'USR-COORD-01';
UPDATE users SET user_code = 'COORD-02', credential_type = 'pin_8' WHERE id = 'USR-COORD-2' OR id = 'USR-COORD-02';
UPDATE users SET user_code = 'FAB-01', credential_type = 'pin_8' WHERE id = 'USR-FAB-1';
UPDATE users SET user_code = 'FAB-02', credential_type = 'pin_8' WHERE id = 'USR-FAB-2';
UPDATE users SET user_code = 'VEND-01', credential_type = 'pin_8' WHERE id = 'USR-VEND-1' OR id = 'USR-VEND-01';
UPDATE users SET user_code = 'VEND-02', credential_type = 'pin_8' WHERE id = 'USR-VEND-2' OR id = 'USR-VEND-02';
UPDATE users SET user_code = 'VEND-03', credential_type = 'pin_8' WHERE id = 'USR-VEND-3' OR id = 'USR-VEND-03';
UPDATE users SET user_code = 'VEND-04', credential_type = 'pin_8' WHERE id = 'USR-VEND-4';

-- 4. Seguridad Estricta: Invalidar cualquier credencial heredada en texto plano o sin hash scrypt
UPDATE users
SET pin_hash = NULL,
    pin_salt = NULL,
    password_hash = NULL,
    password_salt = NULL,
    is_provisioned = FALSE
WHERE pin_salt IS NULL OR LENGTH(COALESCE(pin_hash, '')) != 64;

-- 5. Registrar versión en schema_migrations
INSERT INTO schema_migrations (version, description)
VALUES ('004_auth_credentials_modernization', 'Esquema de user_code, credential_type, is_provisioned e invalidación de credenciales legadas no protegidas')
ON CONFLICT (version) DO NOTHING;
