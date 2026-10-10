/**
 * SGMO — Tequeños Costa
 * Backend Database Connection Manager (PostgreSQL)
 *
 * Administra el Pool de conexiones a PostgreSQL con soporte transaccional ACID,
 * detección estricta de variables de entorno y reporte de estado.
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

export interface DbStatus {
  status: 'DATABASE CONFIGURED' | 'DATABASE NOT CONFIGURED';
  configured: boolean;
  provider: string;
  database?: string;
  host?: string;
  port?: number;
  poolTotalCount?: number;
  poolIdleCount?: number;
  poolWaitingCount?: number;
  message: string;
}

let pool: Pool | null = null;
let isConfiguredCache: boolean | null = null;

/**
 * Determina de forma estricta si PostgreSQL cuenta con credenciales en el entorno.
 * Soporta DATABASE_URL o variables individuales (PGHOST, PGUSER, PGDATABASE, etc.).
 */
export function isDbConfigured(): boolean {
  if (isConfiguredCache !== null) {
    return isConfiguredCache;
  }

  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (databaseUrl && databaseUrl.trim().length > 10 && !databaseUrl.includes('YOUR_POSTGRES_URL')) {
    isConfiguredCache = true;
    return true;
  }

  const pghost = process.env.PGHOST;
  const pgdatabase = process.env.PGDATABASE;
  const pguser = process.env.PGUSER;

  if (pghost && pgdatabase && pguser) {
    isConfiguredCache = true;
    return true;
  }

  isConfiguredCache = false;
  return false;
}

/**
 * Obtiene o inicializa el Pool de conexiones de PostgreSQL.
 * Retorna null si la base de datos no está configurada.
 */
export function getDbPool(): Pool | null {
  if (!isDbConfigured()) {
    return null;
  }

  if (!pool) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    const isSslRequired = process.env.DATABASE_SSL === 'true' || 
      (connectionString ? !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1') : false);

    pool = new Pool({
      connectionString: connectionString || undefined,
      host: process.env.PGHOST,
      port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: isSslRequired ? { rejectUnauthorized: false } : undefined
    });

    pool.on('error', (err) => {
      console.error('❌ [PostgreSQL Pool Error inesperado]:', err.message);
    });
  }

  return pool;
}

/**
 * Ejecuta una consulta SQL parametrizada utilizando el Pool.
 * Lanza un error explícito si la base de datos no está configurada.
 */
export async function query<R extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<R>> {
  const currentPool = getDbPool();
  if (!currentPool) {
    throw new Error('DATABASE NOT CONFIGURED: Falta la variable de entorno DATABASE_URL o credenciales PG.');
  }
  return currentPool.query<R>(text, params);
}

/**
 * Ejecuta una función dentro de una transacción ACID (BEGIN / COMMIT / ROLLBACK).
 */
export async function withTransaction<T>(
  action: (client: PoolClient) => Promise<T>
): Promise<T> {
  const currentPool = getDbPool();
  if (!currentPool) {
    throw new Error('DATABASE NOT CONFIGURED: No se puede iniciar transacción sin conexión a PostgreSQL.');
  }

  const client = await currentPool.connect();
  try {
    await client.query('BEGIN');
    const result = await action(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Retorna el estado detallado de la infraestructura de base de datos.
 */
export async function getDatabaseStatus(): Promise<DbStatus> {
  const configured = isDbConfigured();

  if (!configured) {
    return {
      status: 'DATABASE NOT CONFIGURED',
      configured: false,
      provider: 'Ninguno (Requiere DATABASE_URL en variables de entorno)',
      message: 'PostgreSQL no está configurado. La aplicación opera con persistencia local en el navegador del dispositivo.'
    };
  }

  const currentPool = getDbPool();
  let provider = 'PostgreSQL Compatible';
  const connectionUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

  if (connectionUrl.includes('neon.tech')) provider = 'Neon Serverless Postgres';
  else if (connectionUrl.includes('supabase.co')) provider = 'Supabase PostgreSQL';
  else if (connectionUrl.includes('googleapis') || process.env.CLOUDSQL_INSTANCE) provider = 'Google Cloud SQL PostgreSQL';

  try {
    const res = await currentPool!.query('SELECT current_database() as db_name, version() as pg_version, NOW() as current_time');
    return {
      status: 'DATABASE CONFIGURED',
      configured: true,
      provider,
      database: res.rows[0]?.db_name,
      poolTotalCount: currentPool?.totalCount,
      poolIdleCount: currentPool?.idleCount,
      poolWaitingCount: currentPool?.waitingCount,
      message: `Conexión activa a PostgreSQL (${res.rows[0]?.pg_version?.split(' ')[0] || 'v15+'}).`
    };
  } catch (err: any) {
    return {
      status: 'DATABASE CONFIGURED',
      configured: true,
      provider,
      message: `Credenciales presentes pero falló el handshake de conexión: ${err.message}`
    };
  }
}
