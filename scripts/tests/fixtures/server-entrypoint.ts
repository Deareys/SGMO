/** Importa exactamente el entrypoint de producción sin iniciar Vite ni usar infraestructura externa. */
import app from '../../../server';
import { once } from 'node:events';
const listener = app.listen(0, '127.0.0.1');
await once(listener, 'listening');
console.log(JSON.stringify({ port: (listener.address() as { port: number }).port }));
process.on('SIGTERM', () => listener.close(() => process.exit(0)));
