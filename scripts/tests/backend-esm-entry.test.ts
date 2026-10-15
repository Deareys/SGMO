/** El cargador de desarrollo resuelve imports que Node ESM no acepta.
 * Compilar el grafo del backend y pedir health a Node nativo evita publicar
 * un servidor que sólo inicia bajo tsx.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

test('el backend emitido como ESM inicia en Node nativo y responde health', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'sgmo-native-esm-'));
  try {
    const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
    const options = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;
    const pending = [path.join(root, 'server.ts')];
    const visited = new Set<string>();
    while (pending.length) {
      const filename = pending.pop()!;
      if (visited.has(filename)) continue;
      visited.add(filename);
      const source = await fs.readFile(filename, 'utf8');
      const emitted = ts.transpileModule(source, {
        fileName: filename,
        compilerOptions: { ...options, noEmit: false, allowImportingTsExtensions: false, module: ts.ModuleKind.ESNext }
      });
      const destination = path.join(output, path.relative(root, filename).replace(/\.tsx?$/, '.js'));
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, emitted.outputText);
      for (const reference of ts.preProcessFile(source).importedFiles) {
        if (!reference.fileName.startsWith('.')) continue;
        const resolved = ts.resolveModuleName(reference.fileName, filename, options, ts.sys).resolvedModule?.resolvedFileName;
        if (resolved?.startsWith(root) && !resolved.includes('/node_modules/') && !resolved.endsWith('.d.ts')) {
          pending.push(resolved);
        }
      }
    }
    await fs.writeFile(path.join(output, 'package.json'), JSON.stringify({ type: 'module' }));
    await fs.symlink(path.join(root, 'node_modules'), path.join(output, 'node_modules'), 'dir');
    const childSource = [
      'import http from "node:http";',
      'const {default:app}=await import(' + JSON.stringify(path.join(output, 'server.js')) + ');',
      'const server=http.createServer(app);',
      'await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));',
      'try {',
      ' const response=await fetch("http://127.0.0.1:"+server.address().port+"/api/health");',
      ' console.log(JSON.stringify({status:response.status,body:await response.json()}));',
      '} finally { await new Promise(resolve=>server.close(resolve)); }'
    ].join('\n');
    const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !/^(PG|DATABASE_URL$|POSTGRES|SGMO_|GEMINI_|MERCADOPAGO_|MP_ACCESS_TOKEN$|VERCEL)/.test(key)));
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', childSource], {
      cwd: output, encoding: 'utf8', timeout: 15000,
      env: { ...environment, NODE_ENV: 'production', VERCEL: '1', SGMO_SERVER_AUTOSTART: 'false',
        SGMO_PUBLIC_ORIGIN: 'https://qa.example.invalid', SGMO_REVISION: 'native-esm-test' }
    });
    assert.equal(child.status, 0, child.stderr + child.stdout);
    const result = JSON.parse(child.stdout.trim());
    assert.equal(result.status, 200);
    assert.equal(result.body.status, 'ok');
    assert.equal(result.body.authTransport, 'httpOnly-cookie');
    assert.equal(result.body.revision, 'native-esm-test');
  } finally {
    await fs.rm(output, { recursive: true, force: true });
  }
});
