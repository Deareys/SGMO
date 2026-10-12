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

-- 3. Asignar códigos sin colisiones cuando coexisten IDs históricos con/sin cero.
-- Conserva códigos ya definidos; el ID alternativo recibe un código estable distinto.
DO $$
DECLARE account_mapping RECORD;
BEGIN
  FOR account_mapping IN
    SELECT * FROM (VALUES
      ('USR-ADMIN-01', 'ADM-01'), ('USR-ADMIN-1', 'ADM-01'),
      ('USR-COORD-01', 'COORD-01'), ('USR-COORD-1', 'COORD-01'),
      ('USR-COORD-02', 'COORD-02'), ('USR-COORD-2', 'COORD-02'),
      ('USR-FAB-1', 'FAB-01'), ('USR-FAB-2', 'FAB-02'),
      ('USR-VEND-01', 'VEND-01'), ('USR-VEND-1', 'VEND-01'),
      ('USR-VEND-02', 'VEND-02'), ('USR-VEND-2', 'VEND-02'),
      ('USR-VEND-03', 'VEND-03'), ('USR-VEND-3', 'VEND-03'),
      ('USR-VEND-4', 'VEND-04')
    ) AS codes(account_id, account_code)
  LOOP
    UPDATE users SET user_code = account_mapping.account_code
    WHERE id = account_mapping.account_id AND user_code IS NULL
      AND NOT EXISTS (SELECT 1 FROM users WHERE LOWER(user_code) = LOWER(account_mapping.account_code));
  END LOOP;
END $$;
UPDATE users SET user_code = 'USR-' || SUBSTRING(MD5(id) FROM 1 FOR 24) WHERE user_code IS NULL;
UPDATE users SET credential_type = CASE WHEN role = 'admin' THEN 'password_14' ELSE 'pin_8' END;

-- 4. Las contraseñas son independientes del PIN: PIN nulo no borra password válido.
-- No activa cuentas: is_provisioned FALSE se conserva hasta aprovisionamiento explícito.
UPDATE users SET password_hash = NULL, password_salt = NULL, is_provisioned = FALSE
WHERE role != 'admin' OR password_hash IS NULL OR password_hash !~ '^[0-9a-f]{64}$'
  OR password_salt IS NULL OR password_salt !~ '^[0-9a-f]{32}$';

-- Un hash scrypt no permite saber si el PIN original tenía cuatro u ocho dígitos.
-- Invalidar todos los PIN previos: no afirmar conversión segura a partir del hash.
-- La migración 005 también corrige instalaciones donde la 004 antigua ya se ejecutó.
UPDATE users SET pin_hash = NULL, pin_salt = NULL;
UPDATE users SET is_provisioned = FALSE WHERE role != 'admin';
UPDATE auth_sessions SET is_revoked = TRUE WHERE is_revoked = FALSE;

-- 5. Registrar versión en schema_migrations
INSERT INTO schema_migrations (version, description)
VALUES ('004_auth_credentials_modernization', 'Esquema de user_code, credential_type, is_provisioned e invalidación de credenciales legadas no protegidas')
ON CONFLICT (version) DO NOTHING;
