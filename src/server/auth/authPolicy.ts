/**
 * La demostración es opt-in, local y sin base central. Omitir NODE_ENV nunca
 * habilita credenciales ni sesiones de prueba. La política se comparte entre
 * las rutas y el gestor de sesiones para evitar contingencias inconsistentes.
 */
import { isDbConfigured } from '../db/connection';

export function isIsolatedDemoEnabled(): boolean {
  return process.env.SGMO_AUTH_MODE === 'demo'
    && ['development', 'test'].includes(process.env.NODE_ENV || '')
    && ![process.env.DATABASE_URL, process.env.POSTGRES_URL, process.env.PGHOST,
      process.env.PGDATABASE, process.env.PGUSER].some(Boolean)
    && !isDbConfigured();
}
