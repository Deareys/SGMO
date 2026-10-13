/** Browser transport: host-only HttpOnly cookies and a CSRF token held in client memory.
 * Origins are compared against explicit deployment configuration, never Host or forwarded headers.
 * API tokens are an opt-in CLI transport and cannot be requested by a browser.
 */
import crypto from 'node:crypto';
import type { Request, Response, NextFunction, CookieOptions } from 'express';

const TOKEN_FORMAT = /^[a-f0-9]{64}$/;
const production = () => process.env.NODE_ENV === 'production';
const sessionCookieName = () => production() ? '__Host-sgmo-session' : 'sgmo-session';
const csrfCookieName = () => production() ? '__Host-sgmo-csrf' : 'sgmo-csrf';
const cookieOptions = (): CookieOptions => ({ httpOnly: true, secure: production(), sameSite: 'strict', path: '/' });
const configuredOrigin = () => process.env.SGMO_PUBLIC_ORIGIN
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

function readCookie(req: Request, name: string): string | null {
  const matches = (req.headers.cookie || '').split(';').map((entry) => entry.trim())
    .filter((entry) => entry.startsWith(`${name}=`));
  if (matches.length !== 1) return null;
  const token = matches[0].slice(name.length + 1);
  return TOKEN_FORMAT.test(token) ? token : null;
}

export function readSessionCookie(req: Request): string | null {
  return readCookie(req, sessionCookieName());
}

export function setSessionCookie(res: Response, token: string, expiresAt: string): void {
  res.cookie(sessionCookieName(), token, { ...cookieOptions(), expires: new Date(expiresAt) });
  res.setHeader('Cache-Control', 'no-store');
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(sessionCookieName(), cookieOptions());
  res.setHeader('Cache-Control', 'no-store');
}

/** Credential-bearing HTTP APIs must opt in on the server and use a browser-forbidden context. */
export function isExplicitApiRequest(req: Request): boolean {
  return process.env.SGMO_ENABLE_API_TOKENS === 'true'
    && req.headers['x-sgmo-client'] === 'api'
    && !req.headers.origin
    // Node's fetch emits sec-fetch-mode: cors, but has no browser site/destination metadata.
    && !['sec-fetch-site', 'sec-fetch-dest', 'sec-fetch-user'].some((header) => req.headers[header] !== undefined)
    && !readSessionCookie(req);
}

export function validateBrowserSecurityConfiguration(): void {
  const origin = configuredOrigin();
  if (!origin && !production()) return;
  try {
    const parsed = new URL(origin || '');
    if (parsed.origin !== origin || !['http:', 'https:'].includes(parsed.protocol)
        || (production() && parsed.protocol !== 'https:')) throw new Error('invalid');
  } catch { throw new Error('SGMO_PUBLIC_ORIGIN debe ser un origen exacto; HTTPS obligatorio en producción.'); }
}

function allowedOrigin(req: Request, candidate: string): boolean {
  const configured = configuredOrigin();
  if (configured) return candidate === configured;
  if (production()) return false;
  // Development uses the real listening socket, so spoofed Host/Forwarded cannot authorize an origin.
  const port = req.socket.localPort;
  return Boolean(port) && [`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(candidate);
}

export function browserSecurityMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store');
  if (isExplicitApiRequest(req)) { next(); return; }
  if (production()) {
    try { validateBrowserSecurityConfiguration(); }
    catch {
      res.status(503).json({ success: false, code: 'BROWSER_SECURITY_NOT_CONFIGURED', message: 'El acceso seguro del navegador requiere configurar su origen HTTPS.' });
      return;
    }
  }
  const origin = req.headers.origin;
  const site = req.headers['sec-fetch-site'];
  if ((origin && !allowedOrigin(req, origin)) || (site && site !== 'same-origin' && site !== 'none')) {
    res.status(403).json({ success: false, code: 'ORIGIN_REJECTED', message: 'Origen de solicitud no autorizado.' });
    return;
  }
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) { next(); return; }
  // Every browser mutation, including login and first-admin provisioning, requires both proofs.
  const headerToken = req.headers['x-csrf-token'];
  const cookieToken = readCookie(req, csrfCookieName());
  if (typeof origin !== 'string' || !allowedOrigin(req, origin)
      || typeof headerToken !== 'string' || !TOKEN_FORMAT.test(headerToken) || !cookieToken
      || !crypto.timingSafeEqual(Buffer.from(headerToken, 'hex'), Buffer.from(cookieToken, 'hex'))) {
    res.status(403).json({ success: false, code: 'CSRF_REJECTED', message: 'Solicitud sin protección CSRF válida.' });
    return;
  }
  next();
}

export function issueCsrfToken(req: Request, res: Response): void {
  const token = readCookie(req, csrfCookieName()) || crypto.randomBytes(32).toString('hex');
  res.cookie(csrfCookieName(), token, cookieOptions());
  res.setHeader('Cache-Control', 'no-store');
  res.json({ csrfToken: token });
}
