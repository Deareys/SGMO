/**
 * Hito 1.2.2: SQL auténtico sobre PostgreSQL local desechable o PGlite WASM.
 * No carga .env, no acepta destinos remotos y sólo crea/elimina esquemas propios.
 * WASM sustituye el transporte de pg; NO demuestra concurrencia distribuida.
 * Ejecutar independientemente de la suite de mocks; ver POSTGRES_AUTH_TESTS.md.
 */
import assert from 'node:assert/strict';
import { randomBytes, randomInt } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { hashPassword, hashPin, hashToken, validateWorkerPin, verifyPassword, verifyPin } from '../../src/server/auth/cryptoUtils';
import type { UserProfile } from '../../src/types';

const mode = process.argv[2];
if (mode !== '--postgres' && mode !== '--wasm') {
  throw new Error('Seleccionar --postgres o --wasm; consultar docs/POSTGRES_AUTH_TESTS.md.');
}
const suffix = randomBytes(6).toString('hex');
const freshSchema = `sgmo_auth_test_${suffix}`;
const existingSchema = `sgmo_auth_test_existing_${suffix}`;
const collisionSchema = `sgmo_auth_test_collision_${suffix}`;
const previouslyAppliedSchema = `sgmo_auth_test_preapplied_${suffix}`;
const ownSchemas = [freshSchema, existingSchema, collisionSchema, previouslyAppliedSchema];
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const originalPoolQuery = Pool.prototype.query;
const originalPoolConnect = Pool.prototype.connect;
let wasmDatabase: any;
let setupPool: Pool | undefined;
let passed = 0;
let currentTest = 'Preparación del entorno';
let applicationPool: Pool | null = null;

/** URL exclusiva; localhost textual es rechazado para evitar resolución externa. */
function validateLocalUrl(raw: string | undefined): URL {
  if (!raw) throw new Error('Falta SGMO_AUTH_TEST_DATABASE_URL.');
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
      || !['127.0.0.1', '[::1]'].includes(url.hostname)
      || !/^\/sgmo_auth_test[a-z0-9_]*$/.test(url.pathname)
      || url.search || url.hash) {
    throw new Error('Sólo se acepta PostgreSQL loopback en base exclusiva sgmo_auth_test*, sin parámetros URL.');
  }
  return url;
}

/** Credenciales nuevas por ejecución; no se imprimen ni se persisten en archivos. */
function workerPin(): string {
  for (;;) {
    const pin = String(randomInt(0, 100_000_000)).padStart(8, '0');
    if (validateWorkerPin(pin).isValid) return pin;
  }
}
function administratorPassword(): string { return `Aa!${randomBytes(24).toString('base64url')}9`; }
function account(id: string, role: UserProfile['role'] = 'seller'): UserProfile {
  return { id, userCode: id, name: 'Cuenta efímera de integración', role,
    phone: '', commissionRate: 0.2, isActive: true };
}
async function migration(number: string): Promise<string> {
  const filenames: Record<string, string> = {
    '001': '001_initial_schema.sql', '002': '002_seed_initial_data.sql',
    '003': '003_auth_sessions_security.sql', '004': '004_auth_credentials_modernization.sql',
    '005': '005_auth_security_hardening.sql'
  };
  return readFile(resolve(projectRoot, 'migrations', filenames[number]), 'utf8');
}
async function check(title: string, action: () => Promise<void>) {
  currentTest = title;
  await action();
  passed++;
  console.log(`PASS ${title}`);
}

try {
  // El runner ignora cualquier configuración central heredada y nunca lee .env.
  for (const key of ['DATABASE_URL', 'POSTGRES_URL', 'PGHOST', 'PGDATABASE', 'PGUSER',
    'PGPASSWORD', 'PGPORT', 'PGOPTIONS', 'PGSERVICE', 'PGSERVICEFILE', 'DATABASE_SSL']) {
    delete process.env[key];
  }
  process.env.NODE_ENV = 'test';
  process.env.SGMO_AUTH_MODE = 'central';
  process.env.DATABASE_SSL = 'false';

  if (mode === '--wasm') {
    const runtimeRoot = process.env.SGMO_PGLITE_ROOT;
    if (!runtimeRoot) throw new Error('Falta SGMO_PGLITE_ROOT para dependencia opcional fuera del repositorio.');
    const { PGlite } = await import(pathToFileURL(resolve(runtimeRoot, 'dist/index.js')).href);
    const { uuid_ossp } = await import(pathToFileURL(resolve(runtimeRoot, 'dist/contrib/uuid_ossp.js')).href);
    wasmDatabase = new PGlite({ extensions: { uuid_ossp } });
    await wasmDatabase.waitReady;
    // Motor único: serializar transacciones evita que operaciones de prueba se
    // mezclen en la misma conexión. Esto NO simula conexiones PostgreSQL paralelas.
    let previous = Promise.resolve();
    const acquire = async () => {
      let release!: () => void;
      const next = new Promise<void>((resolveNext) => { release = resolveNext; });
      const ready = previous;
      previous = next;
      await ready;
      return release;
    };
    const execute = async (statement: string, parameters?: unknown[]) => {
      const result = parameters?.length
        ? await wasmDatabase.query(statement, parameters)
        : (await wasmDatabase.exec(statement)).at(-1);
      return { ...result, rows: result?.rows ?? [], rowCount: result?.affectedRows ?? 0 };
    };
    Pool.prototype.query = (async function(statement: string, parameters?: unknown[]) {
      const release = await acquire();
      try { return await execute(statement, parameters); } finally { release(); }
    }) as typeof Pool.prototype.query;
    Pool.prototype.connect = (async function() {
      const release = await acquire();
      return { query: execute, release };
    }) as typeof Pool.prototype.connect;
    process.env.DATABASE_URL = 'postgresql://test@127.0.0.1:1/sgmo_auth_test_wasm';
    setupPool = new Pool();
    console.log('Motor: PostgreSQL compilado a WASM (PGlite); concurrencia distribuida NO comprobada.');
  } else {
    const url = validateLocalUrl(process.env.SGMO_AUTH_TEST_DATABASE_URL);
    // options lo fija el runner tras validar la URL; no acepta flags del usuario.
    url.searchParams.set('options', `-c search_path=${freshSchema}`);
    process.env.DATABASE_URL = url.href;
    setupPool = new Pool({ connectionString: url.href, ssl: false });
    console.log('Motor: PostgreSQL local mediante pg.Pool; nunca Neon/remoto.');
  }
  for (const schema of ownSchemas) await setupPool.query(`CREATE SCHEMA ${schema}`);
  await setupPool.query(`SET search_path TO ${freshSchema}`);
  if (mode === '--wasm') await wasmDatabase.exec(`SET search_path TO ${freshSchema}`);
  const { userRepository } = await import('../../src/server/db/repositories/UserRepository');
  const { sessionManager, SessionManager } = await import('../../src/server/auth/sessionManager');
  const { getDbPool, withTransaction, query } = await import('../../src/server/db/connection');
  const { runMigrations } = await import('../../src/server/db/migrator');
  applicationPool = getDbPool();

  await check('Instalación nueva: migraciones 001–005 y semillas sin credenciales', async () => {
    // runMigrations resuelve ./migrations del cwd: exigir raíz correcta.
    assert.equal(resolve(process.cwd()), resolve(projectRoot));
    const result = await runMigrations();
    assert.equal(result.success, true);
    assert.equal(result.results.length, 5);
    const seeds = await query('SELECT pin_hash, password_hash, is_provisioned, user_code FROM users');
    assert.ok(seeds.rows.length > 0);
    assert.ok(seeds.rows.every((row) => row.pin_hash === null && row.password_hash === null
      && row.is_provisioned === false && row.user_code));
    const repeated = await runMigrations();
    assert.ok(repeated.results.every((row) => row.message === 'Previamente aplicada.'));
  });

  await check('Bootstrap: un único administrador; rechazo de trabajador y reutilización', async () => {
    await userRepository.create(account('TEST-ADMIN-A', 'admin'));
    await userRepository.create(account('TEST-ADMIN-B', 'admin'));
    await userRepository.create(account('TEST-WORKER'));
    assert.equal(await userRepository.bootstrapInitialAdmin('TEST-WORKER', administratorPassword()), false);
    if (mode === '--postgres') {
      const results = await Promise.all([
        userRepository.bootstrapInitialAdmin('TEST-ADMIN-A', administratorPassword()),
        userRepository.bootstrapInitialAdmin('TEST-ADMIN-B', administratorPassword())
      ]);
      assert.equal(results.filter(Boolean).length, 1);
    } else {
      assert.equal(await userRepository.bootstrapInitialAdmin('TEST-ADMIN-A', administratorPassword()), true);
      assert.equal(await userRepository.bootstrapInitialAdmin('TEST-ADMIN-B', administratorPassword()), false);
    }
    assert.equal(await userRepository.bootstrapInitialAdmin('TEST-ADMIN-A', administratorPassword()), false);
  });

  await check('Alta, hashes y consulta pública; PIN incorrecto y cuenta sin aprovisionar', async () => {
    const pin = workerPin();
    const created = await userRepository.create({ ...account('TEST-SELLER'), pin });
    assert.equal(created.isProvisioned, true);
    for (const key of ['pin', 'password', 'pinHash', 'pinSalt', 'passwordHash', 'passwordSalt']) {
      assert.equal(Object.hasOwn(created, key), false);
    }
    const authentication = await userRepository.getAuthRecordByIdentifier('test-seller');
    assert.equal(verifyPin(pin, authentication!.pinHash!, authentication!.pinSalt!), true);
    let incorrectPin = workerPin();
    while (incorrectPin === pin) incorrectPin = workerPin();
    assert.equal(verifyPin(incorrectPin, authentication!.pinHash!, authentication!.pinSalt!), false);
    assert.equal((await userRepository.getAuthRecordById('TEST-WORKER'))!.isProvisioned, false);
    await assert.rejects(sessionManager.createSession(account('TEST-WORKER')));
  });

  await check('Sesión y contador de éxito se revierten conjuntamente al fallar transacción', async () => {
    await userRepository.recordFailedAttempt('TEST-SELLER');
    let rolledBackToken = '';
    await assert.rejects(withTransaction(async (client) => {
      await userRepository.getAuthRecordByIdentifier('TEST-SELLER', client);
      await userRepository.recordSuccessfulLogin('TEST-SELLER', client);
      rolledBackToken = (await sessionManager.createSession(account('TEST-SELLER'), undefined, client)).token;
      throw new Error('Fallo deliberado posterior a INSERT');
    }));
    assert.equal(await sessionManager.validateToken(rolledBackToken), null);
    assert.equal((await userRepository.getAuthRecordById('TEST-SELLER'))!.failedAttempts, 1);
    let committedToken = '';
    await withTransaction(async (client) => {
      await userRepository.getAuthRecordByIdentifier('TEST-SELLER', client);
      await userRepository.recordSuccessfulLogin('TEST-SELLER', client);
      committedToken = (await sessionManager.createSession(account('TEST-SELLER'), undefined, client)).token;
    });
    assert.ok(await new SessionManager().validateToken(committedToken));
    const persisted = await query('SELECT token_hash FROM auth_sessions WHERE token_hash = $1', [hashToken(committedToken)]);
    assert.equal(persisted.rows.length, 1);
  });

  await check('Ventana de intentos, bloqueo de cinco fallos y expiración sin prolongar bloqueo', async () => {
    await userRepository.recordSuccessfulLogin('TEST-SELLER');
    const attempts = mode === '--postgres'
      ? await Promise.all(Array.from({ length: 5 }, () => userRepository.recordFailedAttempt('TEST-SELLER')))
      : await (async () => {
        const results = [];
        for (let count = 0; count < 5; count++) results.push(await userRepository.recordFailedAttempt('TEST-SELLER'));
        return results;
      })();
    assert.equal(Math.max(...attempts.map((attempt) => attempt.failedAttempts)), 5);
    const locked = await userRepository.getAuthRecordById('TEST-SELLER');
    assert.ok(locked!.lockedUntil);
    const whileLocked = await userRepository.recordFailedAttempt('TEST-SELLER');
    assert.equal(whileLocked.failedAttempts, 5);
    assert.equal(new Date(whileLocked.lockedUntil!).getTime(), new Date(locked!.lockedUntil!).getTime());
    await query("UPDATE users SET locked_until = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE id = $1", ['TEST-SELLER']);
    assert.equal((await userRepository.recordFailedAttempt('TEST-SELLER')).failedAttempts, 1);
    await query("UPDATE users SET failed_attempts = 4, failed_attempt_window_started_at = CURRENT_TIMESTAMP - INTERVAL '16 minutes', locked_until = NULL WHERE id = $1", ['TEST-SELLER']);
    const newWindow = await userRepository.recordFailedAttempt('TEST-SELLER');
    assert.equal(newWindow.failedAttempts, 1);
    assert.equal(newWindow.isLocked, false);
  });

  await check('Restablecimiento, cambio de rol, permisos e inactividad revocan sesiones', async () => {
    for (const transition of ['pin', 'role', 'permissions', 'inactive']) {
      const id = `TEST-TRANSITION-${transition}`;
      await userRepository.create({ ...account(id), pin: workerPin() });
      const { token } = await sessionManager.createSession(account(id));
      if (transition === 'pin') await userRepository.updatePin(id, workerPin());
      if (transition === 'role') await userRepository.update(id, { role: 'admin' });
      if (transition === 'permissions') await userRepository.update(id, { permissions: [] });
      if (transition === 'inactive') await userRepository.update(id, { isActive: false });
      assert.equal(await sessionManager.validateToken(token), null);
      if (transition === 'role') {
        const changed = await userRepository.getAuthRecordById(id);
        assert.equal(changed!.isProvisioned, false);
        assert.equal(changed!.pinHash, null);
      }
    }
    const password = administratorPassword();
    await userRepository.create({ ...account('TEST-ADMIN-RESET', 'admin'), password });
    const { token } = await sessionManager.createSession(account('TEST-ADMIN-RESET', 'admin'));
    await userRepository.updatePassword('TEST-ADMIN-RESET', administratorPassword());
    assert.equal(await sessionManager.validateToken(token), null);
    const credential = await userRepository.getAuthRecordById('TEST-ADMIN-RESET');
    assert.equal(verifyPassword(password, credential!.passwordHash!, credential!.passwordSalt!), false);
  });

  await check('Logout y expiración rechazan sesiones centrales; gestor nuevo conserva vigencia', async () => {
    const { token } = await sessionManager.createSession(account('TEST-SELLER'));
    assert.ok(await new SessionManager().validateToken(token));
    await sessionManager.revokeSession(token);
    assert.equal(await sessionManager.validateToken(token), null);
    const expiring = await sessionManager.createSession(account('TEST-SELLER'));
    await query("UPDATE auth_sessions SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE token_hash = $1", [hashToken(expiring.token)]);
    assert.equal(await sessionManager.validateToken(expiring.token), null);
  });

  /** Snapshots parciales simulan instalaciones existentes sin tocar esquema nuevo. */
  const snapshot = async (schema: string, action: (client: PoolClient) => Promise<void>) => {
    const client = await setupPool!.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL search_path TO ${schema}`);
      await client.query(await migration('001'));
      await client.query(await migration('003'));
      await client.query(`ALTER TABLE users ADD COLUMN user_code VARCHAR(32) UNIQUE,
        ADD COLUMN password_hash VARCHAR(128), ADD COLUMN password_salt VARCHAR(64),
        ADD COLUMN credential_type VARCHAR(32) DEFAULT 'pin_8', ADD COLUMN is_provisioned BOOLEAN DEFAULT FALSE`);
      await action(client);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  };

  await check('Instalación existente: 004/005 preservan password válido, invalidan PIN y sesiones', async () => {
    await snapshot(existingSchema, async (client) => {
      const password = administratorPassword();
      const hashedPassword = hashPassword(password);
      const hashedPin = hashPin(workerPin());
      await client.query(`INSERT INTO users (id,name,role,password_hash,password_salt,is_provisioned)
        VALUES ($1,'Admin previo','admin',$2,$3,TRUE)`, ['USR-ADMIN-01', hashedPassword.hash, hashedPassword.salt]);
      await client.query(`INSERT INTO users (id,name,role,pin_hash,pin_salt,is_provisioned)
        VALUES ($1,'Trabajador previo','seller',$2,$3,TRUE)`, ['USR-VEND-01', hashedPin.hash, hashedPin.salt]);
      await client.query("INSERT INTO users (id,name,role) VALUES ('USR-ADMIN-1','Admin histórico alternativo','admin'), ('USR-VEND-1','Trabajador histórico alternativo','seller')");
      await client.query(`INSERT INTO auth_sessions (id,user_id,token_hash,role,expires_at)
        VALUES ('PREVIOUS-SESSION','USR-VEND-01',$1,'seller',CURRENT_TIMESTAMP + INTERVAL '1 hour')`, [randomBytes(32).toString('hex')]);
      await client.query(await migration('004'));
      await client.query(await migration('005'));
      const administrator = (await client.query("SELECT * FROM users WHERE id = 'USR-ADMIN-01'")).rows[0];
      assert.equal(administrator.is_provisioned, true);
      assert.equal(verifyPassword(password, administrator.password_hash, administrator.password_salt), true);
      const seller = (await client.query("SELECT * FROM users WHERE id = 'USR-VEND-01'")).rows[0];
      assert.equal(seller.pin_hash, null);
      assert.equal(seller.is_provisioned, false);
      const allCodes = (await client.query('SELECT LOWER(user_code) AS code FROM users')).rows.map((row) => row.code);
      assert.equal(new Set(allCodes).size, allCodes.length);
      assert.equal((await client.query('SELECT is_revoked FROM auth_sessions')).rows[0].is_revoked, true);
      await client.query('SAVEPOINT invalid_credential');
      await assert.rejects(client.query("UPDATE users SET is_provisioned = TRUE, pin_hash = NULL, pin_salt = NULL WHERE id = 'USR-VEND-01'"));
      await client.query('ROLLBACK TO SAVEPOINT invalid_credential');
    });
  });

  await check('005 detecta colisión de códigos sin renombrar; rollback no modifica credenciales', async () => {
    await snapshot(collisionSchema, async (client) => {
      await client.query("INSERT INTO users (id,name,role,user_code) VALUES ('COLLISION-A','Cuenta A','seller','CODE-A'),('COLLISION-B','Cuenta B','seller','code-a')");
      await client.query('SAVEPOINT collision_migration');
      await assert.rejects(client.query(await migration('005')));
      await client.query('ROLLBACK TO SAVEPOINT collision_migration');
      assert.equal((await client.query("SELECT COUNT(*)::int AS count FROM users WHERE user_code IN ('CODE-A','code-a')")).rows[0].count, 2);
      const column = await client.query("SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'users' AND column_name = 'failed_attempt_window_started_at'", [collisionSchema]);
      assert.equal(column.rows.length, 0);
    });
  });

  await check('005 independiente: 004 previa no reactiva administradores y exige restablecer trabajadores', async () => {
    await snapshot(previouslyAppliedSchema, async (client) => {
      const credential = hashPassword(administratorPassword());
      const pin = hashPin(workerPin());
      await client.query(`INSERT INTO users (id,name,role,user_code,password_hash,password_salt,is_provisioned)
        VALUES ('OLD-ADMIN-ACTIVE','Admin válido','admin','OLD-ADMIN-ACTIVE',$1,$2,TRUE),
          ('OLD-ADMIN-INACTIVE','Admin no provisionado','admin','OLD-ADMIN-INACTIVE',$1,$2,FALSE)`, [credential.hash, credential.salt]);
      await client.query(`INSERT INTO users (id,name,role,user_code,password_hash,password_salt,is_provisioned)
        VALUES ('OLD-ADMIN-INVALID','Admin inválido','admin','OLD-ADMIN-INVALID',$1,$2,TRUE)`, [randomBytes(8).toString('hex'), randomBytes(4).toString('hex')]);
      await client.query(`INSERT INTO users (id,name,role,user_code,pin_hash,pin_salt,is_provisioned)
        VALUES ('OLD-WORKER','Trabajador previo','seller','OLD-WORKER',$1,$2,TRUE)`, [pin.hash, pin.salt]);
      await client.query("INSERT INTO schema_migrations (version) VALUES ('004_auth_credentials_modernization')");
      await client.query(await migration('005'));
      const accounts = (await client.query('SELECT id,is_provisioned,password_hash,pin_hash FROM users')).rows;
      assert.equal(accounts.find((record) => record.id === 'OLD-ADMIN-ACTIVE')!.is_provisioned, true);
      assert.equal(accounts.find((record) => record.id === 'OLD-ADMIN-INACTIVE')!.is_provisioned, false);
      assert.equal(accounts.find((record) => record.id === 'OLD-ADMIN-INVALID')!.password_hash, null);
      assert.equal(accounts.find((record) => record.id === 'OLD-ADMIN-INVALID')!.is_provisioned, false);
      assert.equal(accounts.find((record) => record.id === 'OLD-WORKER')!.pin_hash, null);
      assert.equal(accounts.find((record) => record.id === 'OLD-WORKER')!.is_provisioned, false);
    });
  });

  console.log(`RESULTADO: ${passed} grupos aprobados; ${mode === '--wasm' ? 'concurrencia PostgreSQL real PENDIENTE' : 'bootstrap y contador concurrentes comprobados en pool local'}.`);
} catch (error) {
  // No mostrar SQL/params/credenciales generadas si una aserción o driver falla.
  console.error(`FAIL ${currentTest}; ${error instanceof Error ? error.name : 'Error'}.`);
  process.exitCode = 1;
} finally {
  if (setupPool) {
    // Sólo esquemas aleatorios que este runner creó; nunca public ni otra base.
    for (const schema of ownSchemas) {
      try { await setupPool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
      catch { console.error('No se pudo limpiar un esquema efímero; revisar entorno local.'); process.exitCode = 1; }
    }
  }
  if (wasmDatabase) {
    Pool.prototype.query = originalPoolQuery;
    Pool.prototype.connect = originalPoolConnect;
    await wasmDatabase.close();
  }
  if (applicationPool) await applicationPool.end();
  if (setupPool) await setupPool.end();
}
