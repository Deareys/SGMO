/** Comprobaciones de infraestructura de sólo lectura. No certifican cobros ni operación de campo. */
import { pathToFileURL } from 'node:url';

/**
 * @param {{ origin: string, expectedRevision: string, shareToken?: string,
 * request?: (url: URL, options?: RequestInit) => Promise<Response> }} options
 */
export async function verifyDeployment({ origin, expectedRevision, shareToken = undefined, request = (url, options) => fetch(url, options) }) {
  const target = new URL(origin);
  const local = ['127.0.0.1', '[::1]', 'localhost'].includes(target.hostname);
  if ((target.protocol !== 'https:' && !(local && target.protocol === 'http:')) || target.username || target.password
      || target.pathname !== '/' || target.search || target.hash) throw new Error('Usá sólo el origen HTTPS de la app, sin ruta, parámetros ni credenciales.');
  if (!expectedRevision || (expectedRevision !== 'local' && !/^[a-f0-9]{40}$/.test(expectedRevision))) throw new Error('Indicá el SHA completo esperado con --revision.');
  const cookies = new Map();
  const checks = [];
  const rememberCookies = response => {
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0]; const separator = pair.indexOf('=');
      if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  };
  async function get(endpoint) {
    const response = await request(new URL(endpoint, target), { redirect: 'manual', signal: AbortSignal.timeout(20000),
      headers: cookies.size ? { Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ') } : {} });
    rememberCookies(response);
    const body = await response.text();
    let json; try { json = JSON.parse(body); } catch {}
    return { response, body, json };
  }
  async function check(name, operation) {
    try { await operation(); checks.push({ name, passed: true }); }
    catch (error) { checks.push({ name, passed: false, reason: error.message === 'HTTP no esperado' ? error.message : 'Respuesta o contrato no coincide con el release esperado' }); }
  }
  const requireResult = (condition) => { if (!condition) throw new Error('Contrato no esperado'); };
  if (shareToken) {
    if (!target.hostname.endsWith('.vercel.app')) throw new Error('El acceso temporal sólo se envía a un hostname vercel.app.');
    // La clave se recibe por entorno, no por argumentos, logs ni archivo versionado.
    await check('Acceso autorizado al preview', async () => {
      const accessPath = `/?_vercel_share=${encodeURIComponent(shareToken)}`;
      const { response } = await get(accessPath);
      requireResult([200, 302, 303, 307, 308].includes(response.status) && cookies.size > 0);
    });
  }
  for (const endpoint of ['/', '/setup']) await check(`Frontend ${endpoint}`, async () => {
    const { response, body } = await get(endpoint);
    requireResult(response.status === 200 && /text\/html/i.test(response.headers.get('content-type') || '') && /<html|<!doctype html/i.test(body));
  });
  await check('Frontend: JavaScript y CSS reales, sin fallback HTML', async () => {
    const {body} = await get('/');
    const javascript = body.match(/<script[^>]+src="(\/assets\/[A-Za-z0-9_.-]+\.js)"/i)?.[1];
    const stylesheet = body.match(/<link[^>]+href="(\/assets\/[A-Za-z0-9_.-]+\.css)"/i)?.[1];
    requireResult(Boolean(javascript && stylesheet));
    for (const [asset, mime] of [[javascript, /(?:java|ecma)script/i], [stylesheet, /text\/css/i]]) {
      const {response,body:content} = await get(asset);
      requireResult(response.status===200 && mime.test(response.headers.get('content-type')||'') && content.length>0 && !/^\s*<!doctype html/i.test(content));
    }
  });
  await check('Backend: revisión exacta y transporte de sesión', async () => {
    const { response, json } = await get('/api/health');
    requireResult(response.status === 200 && json?.status === 'ok' && json.revision === expectedRevision && json.authTransport === 'httpOnly-cookie');
    requireResult(response.headers.get('cache-control')?.includes('no-store'));
  });
  await check('Conexión con la base central', async () => {
    const { response, json } = await get('/api/db/status');
    requireResult(response.status === 200 && json?.configured === true && json.connected === true);
  });
  for (const endpoint of ['/api/auth/me', '/api/bootstrap', '/api/users', '/api/sales']) await check(`Acceso anónimo denegado ${endpoint}`, async () => {
    const { response, json } = await get(endpoint);
    requireResult(response.status === 401 && json && response.headers.get('cache-control')?.includes('no-store'));
  });
  await check('Preparación CSRF', async () => {
    const { response, json } = await get('/api/auth/csrf');
    requireResult(response.status === 200 && /^[a-f0-9]{64}$/.test(json?.csrfToken || ''));
  });
  await check('API inexistente mantiene JSON404', async () => {
    const { response, json } = await get('/api/release-check-operation-that-does-not-exist');
    requireResult(response.status === 404 && json?.code === 'API_NOT_FOUND');
  });
  return { origin: target.origin, expectedRevision, passed: checks.every(check => check.passed), checks,
    scope: 'Sólo lectura: frontend, API, revisión, conexión DB y barreras anónimas. No prueba migraciones completas, login real, ventas, pagos, OCR ni teléfonos.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argument = name => process.argv[process.argv.indexOf(name) + 1];
  if (!process.argv.includes('--url') || !process.argv.includes('--revision')) {
    console.error('Uso: npm run verify:deployment -- --url https://TU-APP.vercel.app --revision SHA_COMPLETO');
    process.exitCode = 1;
  } else {
    try {
      const report = await verifyDeployment({ origin: argument('--url'), expectedRevision: argument('--revision'), shareToken: process.env.SGMO_DEPLOYMENT_SHARE_TOKEN });
      console.log(JSON.stringify(report, null, 2));
      if (!report.passed) process.exitCode = 1;
    } catch { console.error('No se pudo verificar el deployment. Revisá URL, SHA y acceso autorizado.'); process.exitCode = 1; }
  }
}
