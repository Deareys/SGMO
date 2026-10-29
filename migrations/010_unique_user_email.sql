-- Identificador de acceso opcional y único, ignorando espacios exteriores/mayúsculas.
-- Un duplicado preexistente aborta la transacción: no borrar ni renombrar cuentas.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_normalized_unique
  ON users (LOWER(BTRIM(email)))
  WHERE email IS NOT NULL AND BTRIM(email) <> '';
INSERT INTO schema_migrations(version,description)
  VALUES ('010_unique_user_email','Correo de acceso normalizado y único sin modificar cuentas existentes')
  ON CONFLICT(version) DO NOTHING;
