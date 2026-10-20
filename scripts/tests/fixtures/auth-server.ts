/** Servidor exclusivo de pruebas: no se importa desde server.ts ni desde el bundle productivo. */
import express from 'express';
import { Pool } from 'pg';
import { hashPin, hashPassword } from '../../../src/server/auth/cryptoUtils';
import { once } from 'node:events';

const mode = process.env.AUTH_TEST_SCENARIO;
let failure: string | null = null;
const statements: string[] = [];
const pin = hashPin(process.env.SGMO_DEMO_SELLER_PIN!);
const password = hashPassword(process.env.SGMO_DEMO_ADMIN_PASSWORD!);
const accounts: Record<string, any> = {
  'VEND-01': { id: 'USR-VEND-1', userCode: 'VEND-01', name: 'Trabajador de prueba', role: 'seller', isActive: true, isProvisioned: true, pinHash: pin.hash, pinSalt: pin.salt, commissionRate: 0.2 },
  'ADM-01': { id: 'USR-ADMIN-1', userCode: 'ADM-01', name: 'Administrador de prueba', role: 'admin', isActive: true, isProvisioned: true, passwordHash: password.hash, passwordSalt: password.salt, commissionRate: 0.2 }
};
const sessions = new Map<string, any>();
// En escenarios centrales solo se simula el transporte PG; no se abren sockets de base.
if (mode === 'central') {
  const execute = async (sql: string, params: any[] = []) => {
    statements.push(sql.trim());
    if (failure && sql.includes(failure)) throw new Error('Detalle interno sensible que no debe llegar al cliente');
    if (/^\s*(BEGIN|COMMIT|ROLLBACK)/.test(sql)) return { rows: [], rowCount: 0 };
    if (sql.includes('FROM users') && sql.includes('LOWER(user_code)')) {
      const account = accounts[String(params[0]).toUpperCase()];
      return { rows: account ? [{ ...account }] : [], rowCount: account ? 1 : 0 };
    }
    if (sql.includes('INSERT INTO auth_sessions')) {
      const account = Object.values(accounts).find((user) => user.id === params[1]);
      if (!account?.isActive || !account?.isProvisioned) return { rows: [], rowCount: 0 };
      sessions.set(params[2], { id: params[0], userId: params[1], role: params[3], expiresAt: params[6], createdAt: params[8], userName: account.name });
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('FROM users u') && sql.includes('UPDATE auth_sessions s')) {
      const session = sessions.get(params[0]);
      const account = session && Object.values(accounts).find((user) => user.id === session.userId);
      return { rows: session && account.isActive && account.isProvisioned && account.role === session.role ? [session] : [], rowCount: 1 };
    }
    if (sql.includes('UPDATE auth_sessions SET is_revoked')) {
      sessions.delete(params[0]);
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('FROM users') && sql.includes('WHERE id = $1')) {
      const account = Object.values(accounts).find((user) => user.id === params[0]);
      return { rows: account ? [account] : [], rowCount: account ? 1 : 0 };
    }
    if (sql.includes('RETURNING failed_attempts')) return { rows: [{ failedAttempts: 1, isLocked: false, lockedUntil: null }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  };
  Pool.prototype.query = execute as any;
  Pool.prototype.connect = (async () => ({ query: execute, release() {} })) as any;
}
const { authRouter } = await import('../../../src/server/auth/authRoutes');
const { authenticateToken, requireRole } = await import('../../../src/server/auth/authMiddleware');
const { recordSuccessfulAttempt } = await import('../../../src/server/auth/rateLimiter');
const app = express();
app.use(express.json({ limit: '4kb' }));
app.use('/api/auth', authRouter);
app.get('/protected', authenticateToken, requireRole('admin'), (_req, res) => res.json({ success: true }));
app.post('/test/control', (req, res) => {
  failure = req.body.failure ?? null;
  if (req.body.patch) Object.assign(accounts[req.body.account || 'VEND-01'], req.body.patch);
  if (req.body.clearOrigin) recordSuccessfulAttempt(req);
  res.json({ statements });
});
app.use((error: any, _req: any, res: any, _next: any) => res.status(error.status === 413 ? 413 : 400).json({ success: false, message: 'Solicitud inválida.' }));
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
console.log(JSON.stringify({ port: (server.address() as any).port }));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
