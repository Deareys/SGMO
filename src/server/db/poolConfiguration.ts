/** TLS verificado para bases remotas; las opciones URL no pueden reemplazar la política segura. */
import type { PoolConfig } from 'pg';

export function createPoolConfiguration(environment: NodeJS.ProcessEnv = process.env): PoolConfig {
  const raw = environment.DATABASE_URL || environment.POSTGRES_URL;
  let url: URL | undefined;
  try {
    if (raw) {
      url = new URL(raw);
      if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) throw new Error();
    }
  } catch { throw new Error('Configuración PostgreSQL inválida.'); }
  const host = url?.hostname || environment.PGHOST || 'localhost';
  const loopback = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host.toLowerCase());
  const urlMode = url?.searchParams.get('sslmode');
  const disableTls = environment.DATABASE_SSL === 'false' || urlMode === 'disable';
  if (!loopback && disableTls) throw new Error('PostgreSQL remoto requiere TLS verificado.');
  if (urlMode === 'no-verify' || url?.searchParams.get('ssl') === 'no-verify' || environment.PGSSLMODE === 'no-verify') {
    throw new Error('No se admite TLS sin verificación.');
  }
  if (url) for (const key of ['ssl', 'sslmode', 'sslrootcert', 'sslcert', 'sslkey']) url.searchParams.delete(key);
  const tls = !loopback || environment.DATABASE_SSL === 'true' || Boolean(urlMode && urlMode !== 'disable');
  const port = environment.PGPORT ? Number(environment.PGPORT) : undefined;
  if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535)) throw new Error('Puerto PostgreSQL inválido.');
  return {
    connectionString: url?.href,
    host: url ? undefined : environment.PGHOST,
    port: url ? undefined : port,
    database: url ? undefined : environment.PGDATABASE,
    user: url ? undefined : environment.PGUSER,
    password: url ? undefined : environment.PGPASSWORD,
    max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000,
    ssl: tls ? { rejectUnauthorized: true, ...(environment.DATABASE_SSL_CA ? { ca: environment.DATABASE_SSL_CA } : {}) } : false,
    enableChannelBinding: true
  };
}
