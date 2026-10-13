/** Migración manual: exige identificar el destino; nunca se importa desde el servidor o build. */
import { createPoolConfiguration } from '../src/server/db/poolConfiguration';
import { getDbPool } from '../src/server/db/connection';
import { runMigrations } from '../src/server/db/migrator';

const configuration = createPoolConfiguration();
const connection = configuration.connectionString ? new URL(configuration.connectionString) : null;
const target = `${connection?.hostname || configuration.host}/${connection?.pathname.slice(1) || configuration.database}`;
if (!process.argv.includes('--apply') || !process.env.SGMO_MIGRATION_TARGET || process.env.SGMO_MIGRATION_TARGET !== target) {
  throw new Error('Migración no autorizada para ese destino. Requiere --apply y SGMO_MIGRATION_TARGET=host/base, después de respaldo y revisión.');
}
const pool = getDbPool();
if (!pool) throw new Error('No se configuró PostgreSQL.');
try {
  console.log(`Destino de migración: ${target}`); // No mostrar usuario, contraseña o URL.
  const result = await runMigrations();
  for (const step of result.results) console.log(`${step.success ? 'OK' : 'FAIL'} ${step.version}`);
  process.exitCode = result.success ? 0 : 1;
} catch {
  console.error('No se pudo completar la migración. Revisar esquema y conexión sin compartir credenciales.');
  process.exitCode = 1;
} finally { await pool.end(); }
