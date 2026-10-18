/** Backend real con SQL PGlite efímero para QA del navegador. Nunca conecta servicios remotos.
 * La cola serializa transacciones de un motor embebido; la concurrencia PostgreSQL
 * entre procesos se verifica por separado en postgres-multiprocess.integration.ts.
 */
import express from 'express';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';

const runtimeRoot = process.env.SGMO_PGLITE_ROOT;
if (process.env.NODE_ENV !== 'test' || process.env.SGMO_BROWSER_CENTRAL_FIXTURE !== 'true' || !runtimeRoot) {
  throw new Error('Fixture exclusiva de QA aislada con runtime SQL explícito.');
}
for (const key of ['DATABASE_URL', 'POSTGRES_URL', 'PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'PGPORT', 'PGOPTIONS', 'PGSERVICE', 'PGSERVICEFILE', 'VERCEL', 'VERCEL_URL', 'GEMINI_API_KEY', 'GIMINI_API_KEY', 'MERCADOPAGO_ACCESS_TOKEN', 'MP_ACCESS_TOKEN']) delete process.env[key];
process.env.DATABASE_URL = 'postgresql://browser-test@127.0.0.1:1/sgmo_auth_test_browser';
process.env.DATABASE_SSL = 'false';
process.env.SGMO_AUTH_MODE = 'central';
process.env.SGMO_SERVER_AUTOSTART = 'false';
const { PGlite } = await import(pathToFileURL(resolve(runtimeRoot, 'dist/index.js')).href);
const { uuid_ossp } = await import(pathToFileURL(resolve(runtimeRoot, 'dist/contrib/uuid_ossp.js')).href);
const engine = new PGlite({ extensions: { uuid_ossp } });
await engine.waitReady;
let preceding = Promise.resolve();
async function acquire() {
  let release!: () => void;
  const next = new Promise<void>(completed => { release = completed; });
  const ready = preceding; preceding = next; await ready; return release;
}
async function execute(statement: string, parameters?: unknown[]) {
  const result = parameters?.length ? await engine.query(statement, parameters) : (await engine.exec(statement)).at(-1);
  return { ...result, rows: result?.rows || [], rowCount: result?.rows?.length || result?.affectedRows || 0 };
}
Pool.prototype.query = (async function(statement: string, parameters?: unknown[]) {
  const release = await acquire(); try { return await execute(statement, parameters); } finally { release(); }
}) as typeof Pool.prototype.query;
Pool.prototype.connect = (async function() { const release = await acquire(); return { query: execute, release }; }) as typeof Pool.prototype.connect;
for (const filename of (await readdir('migrations')).filter(filename => filename.endsWith('.sql')).sort()) {
  await engine.exec(await readFile(resolve('migrations', filename), 'utf8'));
}
// Importes y stock declarados para esta prueba; no son configuración del negocio.
await engine.exec(`UPDATE product_varieties SET base_price_individual=1500, combo_prices='{"combo3":4000,"combo6":7500,"combo12":14000}'::jsonb;
  UPDATE commission_tiers SET is_active=FALSE;
  INSERT INTO house_stock(house_id,variety_id,units) SELECT 'HOUSE-NORTE',id,200 FROM product_varieties;`);
const { default: app } = await import('../../../server');
const { getDbPool } = await import('../../../src/server/db/connection');
app.use('/assets', express.static(resolve('dist/assets')));
app.get('*', (_request, response) => response.sendFile(resolve('dist/index.html')));
const server = app.listen(Number(process.env.PORT), '127.0.0.1', () => { console.log('SGMO_BROWSER_CENTRAL_READY'); });
process.on('SIGTERM', () => {
  server.close(async () => { await getDbPool()?.end(); await engine.close(); process.exit(0); });
});
