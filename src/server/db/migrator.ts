/**
 * SGMO — Tequeños Costa
 * PostgreSQL Migration Runner
 *
 * Aplica migraciones secuenciales de forma transaccional, registrando versiones
 * aplicadas en la tabla 'schema_migrations'.
 */

import fs from 'fs';
import path from 'path';
import { isDbConfigured, withTransaction, query } from './connection.js';

export interface MigrationResult {
  version: string;
  success: boolean;
  message: string;
  appliedAt?: string;
}

export async function runMigrations(): Promise<{ success: boolean; results: MigrationResult[] }> {
  if (!isDbConfigured()) {
    return {
      success: false,
      results: [
        {
          version: 'none',
          success: false,
          message: 'DATABASE NOT CONFIGURED: No se pueden ejecutar migraciones sin DATABASE_URL.'
        }
      ]
    };
  }

  // 1. Asegurar tabla de schema_migrations
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(64) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      description TEXT
    );
  `);

  // 2. Obtener migraciones ya aplicadas
  const appliedRes = await query<{ version: string }>('SELECT version FROM schema_migrations ORDER BY applied_at ASC');
  const appliedVersions = new Set(appliedRes.rows.map((r) => r.version));

  // 3. Buscar archivos de migración
  const migrationsDir = path.join(process.cwd(), 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    return {
      success: false,
      results: [{ version: 'none', success: false, message: 'No se encontraron las migraciones; el esquema no fue verificado.' }]
    };
  }

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const results: MigrationResult[] = [];

  for (const file of files) {
    const version = file.replace('.sql', '');
    if (version === '002_seed_initial_data' && appliedVersions.has('002_production_baseline')) {
      results.push({version,success:true,message:'Omitida: este entorno tiene inicialización productiva sin datos demo.'});
      continue;
    }
    if (appliedVersions.has(version)) {
      results.push({
        version,
        success: true,
        message: 'Previamente aplicada.'
      });
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sqlContent = fs.readFileSync(filePath, 'utf-8');

    try {
      await withTransaction(async (client) => {
        await client.query(sqlContent);
        await client.query(
          'INSERT INTO schema_migrations (version, description) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING',
          [version, `Migración automática ejecutada desde archivo ${file}`]
        );
      });

      results.push({
        version,
        success: true,
        message: 'Aplicada exitosamente.',
        appliedAt: new Date().toISOString()
      });
      console.log(`✅ [Migración aplicada]: ${file}`);
    } catch (err: any) {
      console.error(`No se pudo aplicar la migración ${file}.`);
      results.push({
        version,
        success: false,
        message: 'No se pudo aplicar la migración. El esquema requiere revisión antes de continuar.'
      });
      return { success: false, results };
    }
  }

  return { success: true, results };
}
