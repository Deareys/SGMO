import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('La salida pública de Vercel contiene sólo frontend y conserva archivos ajenos al build', async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'sgmo-public-test-'));
  try {
    await mkdir(path.join(temporaryRoot, 'dist/assets'), { recursive: true });
    await mkdir(path.join(temporaryRoot, 'public'), { recursive: true });
    await writeFile(path.join(temporaryRoot, 'dist/index.html'), '<div>app</div>');
    await writeFile(path.join(temporaryRoot, 'dist/assets/app-new.js'), 'frontend');
    await writeFile(path.join(temporaryRoot, 'dist/server.cjs'), 'PRIVATE_BACKEND');
    await writeFile(path.join(temporaryRoot, 'dist/server.cjs.map'), 'PRIVATE_SOURCE');
    await writeFile(path.join(temporaryRoot, 'public/robots.txt'), 'User-agent: *');
    const prepareScript = path.resolve('scripts/prepare-vercel-public.mjs');
    execFileSync(process.execPath, [prepareScript], { cwd: temporaryRoot, stdio: 'pipe' });
    assert.deepEqual((await readdir(path.join(temporaryRoot, 'public'))).sort(), ['.sgmo-generated.json', 'assets', 'index.html', 'robots.txt']);
    assert.equal(await readFile(path.join(temporaryRoot, 'public/assets/app-new.js'), 'utf8'), 'frontend');
    // Dos builds retiran sólo el asset previo registrado, conservando robots.txt.
    await rm(path.join(temporaryRoot, 'dist/assets/app-new.js'));
    await writeFile(path.join(temporaryRoot, 'dist/assets/app-next.js'), 'next');
    execFileSync(process.execPath, [prepareScript], { cwd: temporaryRoot, stdio: 'pipe' });
    assert.deepEqual(await readdir(path.join(temporaryRoot, 'public/assets')), ['app-next.js']);
    assert.equal(await readFile(path.join(temporaryRoot, 'public/robots.txt'), 'utf8'), 'User-agent: *');
  } finally { await rm(temporaryRoot, { recursive: true, force: true }); }
});

test('Entrypoint productivo mantiene API desconocida en JSON404 y reporta revisión sin necesitar base', async () => {
  const environment = { ...process.env, NODE_ENV: 'production', VERCEL: '1', SGMO_SERVER_AUTOSTART: 'false',
    SGMO_PUBLIC_ORIGIN: 'https://sgmo-test.example.invalid', SGMO_AUTH_MODE: 'central', SGMO_REVISION: 'revision-qa',
    VERCEL_GIT_COMMIT_SHA: '', SGMO_ENABLE_API_TOKENS: '', DATABASE_URL: '', POSTGRES_URL: '',
    PGHOST: '', PGDATABASE: '', PGUSER: '', GEMINI_API_KEY: '', MERCADOPAGO_ACCESS_TOKEN: '', MP_ACCESS_TOKEN: '' };
  const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/tests/fixtures/server-entrypoint.ts'], { env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  const startup = new Promise<number>((resolve, reject) => {
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      try { resolve(JSON.parse(output.trim()).port); } catch {}
    });
    child.on('exit', () => reject(new Error('Entrypoint no disponible.')));
    child.on('error', reject);
  });
  const timeout = setTimeout(() => child.kill('SIGTERM'), 15_000);
  try {
    const origin = `http://127.0.0.1:${await startup}`;
    const health = await fetch(`${origin}/api/health`);
    assert.equal(health.status, 200);
    const healthJson = await health.json();
    assert.equal(healthJson.revision, 'revision-qa');
    assert.equal(healthJson.authTransport, 'httpOnly-cookie');
    const unknown = await fetch(`${origin}/api/operation-that-does-not-exist`);
    assert.equal(unknown.status, 404);
    assert.equal(unknown.headers.get('cache-control'), 'no-store');
    assert.equal((await unknown.json()).code, 'API_NOT_FOUND');
    const anonymous = await fetch(`${origin}/api/bootstrap`);
    assert.equal(anonymous.status, 401);
  } finally {
    clearTimeout(timeout);
    if (child.exitCode === null && child.signalCode === null) { const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited; }
  }
});
