-- SGMO — Hito 1.2.1: corrección para instalaciones con 004 ya aplicada.
-- Ejecutar solo tras respaldo y revisión; nunca aprovisiona credenciales conocidas.
-- Migrator registra esta versión en una transacción independiente de 004.

ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempt_window_started_at TIMESTAMPTZ;

-- No se puede distinguir un scrypt de PIN4 de un scrypt de PIN8. Se exige un
-- restablecimiento seguro de TODOS los trabajadores existentes, una sola vez.
-- Los hashes no se pueden convertir ni recuperar. No se altera información operativa.
UPDATE users SET pin_hash = NULL, pin_salt = NULL,
    password_hash = NULL, password_salt = NULL, is_provisioned = FALSE,
    credential_type = 'pin_8', failed_attempts = 0, locked_until = NULL,
    failed_attempt_window_started_at = NULL
WHERE role != 'admin';

-- Contraseñas modernas válidas se conservan, aunque el PIN sea NULL.
-- No reactivar automáticamente una cuenta que nunca fue aprovisionada.
UPDATE users SET pin_hash = NULL, pin_salt = NULL, credential_type = 'password_14'
WHERE role = 'admin';
UPDATE users SET password_hash = NULL, password_salt = NULL, is_provisioned = FALSE
WHERE role = 'admin' AND (
    password_hash IS NULL OR password_hash !~ '^[0-9a-f]{64}$'
    OR password_salt IS NULL OR password_salt !~ '^[0-9a-f]{32}$'
);
UPDATE users SET is_provisioned = FALSE WHERE is_provisioned IS NULL;
ALTER TABLE users ALTER COLUMN is_provisioned SET DEFAULT FALSE;
ALTER TABLE users ALTER COLUMN is_provisioned SET NOT NULL;
ALTER TABLE users ALTER COLUMN credential_type SET NOT NULL;

-- Si la 004 anterior ya borró una contraseña válida, ninguna migración puede
-- reconstruirla: recuperar el respaldo o usar restablecimiento autorizado.
-- Revocar toda sesión previa impide conservar acceso con credenciales invalidadas.
UPDATE auth_sessions SET is_revoked = TRUE WHERE is_revoked = FALSE;

UPDATE users SET user_code = 'USR-' || SUBSTRING(MD5(id) FROM 1 FOR 24)
WHERE user_code IS NULL OR BTRIM(user_code) = '';
-- Si existen códigos iguales ignorando mayúsculas, abortar con rollback en vez
-- de renombrar cuentas existentes silenciosamente. Resolver colisión previamente.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_code_lower_unique ON users (LOWER(user_code));
ALTER TABLE users ALTER COLUMN user_code SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_auth_credentials_consistent' AND conrelid = 'users'::regclass) THEN
    ALTER TABLE users ADD CONSTRAINT users_auth_credentials_consistent CHECK (
      (role = 'admin' AND credential_type = 'password_14' AND pin_hash IS NULL AND pin_salt IS NULL
        AND ((password_hash IS NULL AND password_salt IS NULL AND is_provisioned = FALSE)
          OR (COALESCE(password_hash ~ '^[0-9a-f]{64}$', FALSE) AND COALESCE(password_salt ~ '^[0-9a-f]{32}$', FALSE))))
      OR
      (role != 'admin' AND credential_type = 'pin_8' AND password_hash IS NULL AND password_salt IS NULL
        AND ((pin_hash IS NULL AND pin_salt IS NULL AND is_provisioned = FALSE)
          OR (COALESCE(pin_hash ~ '^[0-9a-f]{64}$', FALSE) AND COALESCE(pin_salt ~ '^[0-9a-f]{32}$', FALSE))))
    );
  END IF;
END $$;

INSERT INTO schema_migrations (version, description)
VALUES ('005_auth_security_hardening', 'Invalidación PIN legado, consistencia credenciales por rol, revocación de sesiones, códigos únicos y ventana persistente de intentos')
ON CONFLICT (version) DO NOTHING;
