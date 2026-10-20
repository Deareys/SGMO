/** Recuperación excepcional del dueño desde una terminal privada con acceso a su base.
 * No hay endpoint público ni reapertura del bootstrap. Sólo entrega un enlace temporal;
 * el dueño elige su contraseña en la app. Nunca ejecutar en CI ni redirigir su salida.
 */
import { createPoolConfiguration } from '../src/server/db/poolConfiguration';
import { getDbPool } from '../src/server/db/connection';
import { passwordRepository } from '../src/server/db/repositories/PasswordRepository';

const configuration = createPoolConfiguration();
const connection = configuration.connectionString ? new URL(configuration.connectionString) : null;
const target = `${connection?.hostname || configuration.host}/${connection?.pathname.slice(1) || configuration.database}`;
const identifierIndex = process.argv.indexOf('--identifier');
const identifier = identifierIndex < 0 ? '' : process.argv[identifierIndex + 1];
const publicOrigin = new URL(process.env.SGMO_PUBLIC_ORIGIN || 'https://invalid.example');
if (!process.stdout.isTTY || !process.stdin.isTTY || process.env.CI
    || !process.argv.includes('--apply') || process.env.SGMO_RECOVERY_TARGET !== target
    || !identifier || identifier.startsWith('--') || !process.env.SGMO_PUBLIC_ORIGIN
    || publicOrigin.origin !== process.env.SGMO_PUBLIC_ORIGIN || publicOrigin.username || publicOrigin.password
    || (publicOrigin.protocol !== 'https:' && !['127.0.0.1', 'localhost', '[::1]'].includes(publicOrigin.hostname))) {
  throw new Error('Requiere terminal privada interactiva, --apply --identifier CODIGO, SGMO_RECOVERY_TARGET=host/base y SGMO_PUBLIC_ORIGIN exacto. Ver docs/HITO_3_4_CONTRASENAS_Y_PRODUCCION.md.');
}
const pool = getDbPool();
if (!pool) throw new Error('No se configuró PostgreSQL.');
try {
  const activation = await passwordRepository.issueOwnerRecovery(identifier);
  console.log(`Enlace privado de un solo uso, válido hasta ${activation.expiresAt}:`);
  console.log(`${publicOrigin.origin}/activate#token=${activation.token}`);
  console.log('Entregar únicamente al dueño después de verificar presencialmente su identidad. No compartir en soporte.');
} catch {
  console.error('No se pudo preparar la recuperación. Revisar cuenta, destino y migración 009 sin compartir credenciales.');
  process.exitCode = 1;
} finally { await pool.end(); }
