/** Fixture HTTP multiproceso: routers reales, nunca importado por producción. */
import express from 'express';
import { browserSecurityMiddleware } from '../../../src/server/auth/browserSecurity';
import { authRouter } from '../../../src/server/auth/authRoutes';
import { dbRouter } from '../../../src/server/routes/dbRoutes';
import { getDbPool } from '../../../src/server/db/connection';

const url = new URL(process.env.DATABASE_URL || 'invalid:');
if (process.env.NODE_ENV !== 'test' || process.env.SGMO_POSTGRES_HTTP_FIXTURE !== 'true'
    || !['127.0.0.1', '[::1]'].includes(url.hostname)
    || !/^\/sgmo_auth_test[a-z0-9_]*$/.test(url.pathname)) {
  throw new Error('Fixture exclusiva de PostgreSQL local desechable.');
}
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '4kb' }));
app.use('/api', browserSecurityMiddleware);
app.use('/api/auth', authRouter);
app.use('/api', dbRouter);
const server = app.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (address && typeof address !== 'string') process.send?.({ port: address.port });
});
process.on('SIGTERM', () => {
  server.close(async () => { await getDbPool()?.end(); process.exit(0); });
});
