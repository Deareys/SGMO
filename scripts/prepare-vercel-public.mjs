/** Vercel sirve public/** en su CDN. Copiar sólo el frontend; nunca el bundle o mapa del servidor. */
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const publicRoot = path.join(projectRoot, 'public');
const ownershipFile = path.join(publicRoot, '.sgmo-generated.json');
await mkdir(publicRoot, { recursive: true });

// El manifiesto sólo permite retirar archivos generados por un build anterior.
let priorFiles = [];
try { priorFiles = JSON.parse(await readFile(ownershipFile, 'utf8')); } catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
for (const file of priorFiles) {
  if (file !== 'index.html' && !/^assets\/[A-Za-z0-9_.-]+$/.test(file)) throw new Error('Manifiesto de build inválido.');
  await rm(path.join(publicRoot, file), { force: true });
}

const generatedFiles = ['index.html'];
await cp(path.join(projectRoot, 'dist/index.html'), path.join(publicRoot, 'index.html'));
await mkdir(path.join(publicRoot, 'assets'), { recursive: true });
for (const file of await readdir(path.join(projectRoot, 'dist/assets'))) {
  if (!/^[A-Za-z0-9_.-]+$/.test(file)) throw new Error('Nombre de asset inválido.');
  await cp(path.join(projectRoot, 'dist/assets', file), path.join(publicRoot, 'assets', file));
  generatedFiles.push(`assets/${file}`);
}
await writeFile(ownershipFile, JSON.stringify(generatedFiles));
console.log(`Frontend para Vercel preparado: ${generatedFiles.length} archivos públicos.`);
