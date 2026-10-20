import test from 'node:test';
import assert from 'node:assert/strict';
import { createPoolConfiguration } from '../../src/server/db/poolConfiguration';

test('URL sslmode no reemplaza verificación TLS de PostgreSQL remoto', () => {
  const config = createPoolConfiguration({ DATABASE_URL: 'postgresql://user@db.example.invalid/sgmo?sslmode=require&channel_binding=require' });
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
  assert.equal(new URL(config.connectionString!).searchParams.has('sslmode'), false);
  assert.equal(new URL(config.connectionString!).searchParams.get('channel_binding'), 'require');
});
test('No se puede desactivar TLS ni certificado en una base remota', () => {
  for (const environment of [
    { DATABASE_URL: 'postgresql://user@db.example.invalid/sgmo?sslmode=disable' },
    { PGHOST: 'db.example.invalid', DATABASE_SSL: 'false' },
    { DATABASE_URL: 'postgresql://user@db.example.invalid/sgmo?sslmode=no-verify' },
    { PGHOST: 'db.example.invalid', PGSSLMODE: 'no-verify' }
  ]) assert.throws(() => createPoolConfiguration(environment));
});
test('PostgreSQL local desechable no exige TLS y certificados privados son explícitos', () => {
  assert.equal(createPoolConfiguration({ DATABASE_URL: 'postgresql://test@127.0.0.1:5432/sgmo_auth_test_ci' }).ssl, false);
  assert.deepEqual(createPoolConfiguration({ PGHOST: 'db.example.invalid', DATABASE_SSL_CA: 'test-ca' }).ssl, { rejectUnauthorized: true, ca: 'test-ca' });
  assert.throws(() => createPoolConfiguration({ DATABASE_URL: 'not-a-url' }));
});
