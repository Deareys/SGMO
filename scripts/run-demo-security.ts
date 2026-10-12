/** Suite histórica de regresión, reproducible con credenciales efímeras y sin APIs/bases externas. */
import { spawn } from 'node:child_process';
import { randomBytes, randomInt } from 'node:crypto';
import { once } from 'node:events';
import { validateWorkerPin } from '../src/server/auth/cryptoUtils';

function workerPin(): string {
  for (;;) {
    const candidate = String(randomInt(0, 100_000_000)).padStart(8, '0');
    if (validateWorkerPin(candidate).isValid) return candidate;
  }
}
const env = { ...process.env };
for (const key of ['DATABASE_URL', 'POSTGRES_URL', 'PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD',
  'PGPORT', 'PGOPTIONS', 'PGSERVICE', 'PGSERVICEFILE', 'MERCADOPAGO_ACCESS_TOKEN', 'GEMINI_API_KEY', 'BOOTSTRAP_SECRET']) delete env[key];
const testPort = process.env.PORT || '3006';
Object.assign(env, { PORT: testPort, NODE_ENV: 'test', SGMO_AUTH_MODE: 'demo',
  SGMO_DEMO_ADMIN_PASSWORD: `Aa!${randomBytes(24).toString('hex')}`,
  SGMO_DEMO_SELLER_PIN: workerPin(), SGMO_DEMO_FACTORY_PIN: workerPin() });
const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
const timeout = setTimeout(() => { server.kill(); }, 45000);
try {
  await new Promise<void>((resolve, reject) => {
    server.stdout.on('data', (chunk) => {
      if (String(chunk).includes('SGMO Server corriendo')) resolve();
    });
    server.stderr.on('data', (chunk) => process.stderr.write(chunk));
    server.on('exit', () => reject(new Error('Servidor demo no disponible.')));
  });
  const suite = spawn(process.execPath, ['--import', 'tsx', 'scripts/verify-auth-security.ts'], { env, stdio: 'inherit' });
  const [exitCode] = await once(suite, 'exit');
  process.exitCode = exitCode === 0 ? 0 : 1;
} finally {
  clearTimeout(timeout);
  if (server.exitCode === null && server.signalCode === null) {
    server.kill('SIGTERM');
    await once(server, 'exit');
  }
}
