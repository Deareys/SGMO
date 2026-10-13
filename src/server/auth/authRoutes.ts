/**
 * SGMO — Tequeños Costa
 * Endpoints REST de Autenticación Segura y Control de Sesión (Hito 1.2.1)
 *
 * Reglas Estrictas de Seguridad:
 * - Se elimina totalmente el login por PIN sin identificador ({ pin } solo es rechazado).
 * - Se elimina la compatibilidad con PINs legados de 4 dígitos (se exigen 8 dígitos exactos).
 * - Se eliminan todas las comparaciones en texto plano: solo scrypt con salt individual.
 * - Credenciales incorrectas y cuentas no aprovisionadas comparten respuesta genérica 401.
 * - Fallo de PostgreSQL propaga HTTP 503 SERVICE_UNAVAILABLE y jamás recurre a credenciales de contingencia.
 * - Concurrencia y bloqueo por fuerza bruta persistido en base de datos.
 */

import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { isDbConfigured, withTransaction } from '../db/connection';
import { isIsolatedDemoEnabled } from './authPolicy';
import { userRepository, UserAuthRecord } from '../db/repositories/UserRepository';
import { sessionManager } from './sessionManager';
import {
  verifyPin,
  verifyPassword,
  validateWorkerPin,
  validateAdminPassword,
  hashPin,
  hashPassword
} from './cryptoUtils';
import { pinRateLimiter, recordFailedAttempt, recordSuccessfulAttempt } from './rateLimiter';
import { authenticateToken, extractToken } from './authMiddleware';
import { INITIAL_USERS } from '../../mockData';
import { publicProfile } from './publicProfile';
import { browserSecurityMiddleware, issueCsrfToken, isExplicitApiRequest, setSessionCookie, clearSessionCookie } from './browserSecurity';

export const authRouter = Router();
authRouter.use(browserSecurityMiddleware);
authRouter.get('/csrf', issueCsrfToken);

// =====================================================================
// Almacén aislado exclusivo para desarrollo local / suite de pruebas
// (Inaccesible en producción: en producción se exige PostgreSQL central)
// =====================================================================
interface DevAccountCredential {
  pinHash?: string | null;
  pinSalt?: string | null;
  passwordHash?: string | null;
  passwordSalt?: string | null;
  isProvisioned: boolean;
  failedAttempts: number;
  lockedUntil?: number | null;
}

const devTestCredentialsStore = new Map<string, DevAccountCredential>();

// Inicializar credenciales con hash scrypt y salt individual para entorno de pruebas/desarrollo
function initDevTestStore() {
  if (!isIsolatedDemoEnabled()) return;
  // 1. Administrador demo aprovisionado por variables de entorno.
  const adminPassword = process.env.SGMO_DEMO_ADMIN_PASSWORD;
  const sellerPin = process.env.SGMO_DEMO_SELLER_PIN;
  const factoryPin = process.env.SGMO_DEMO_FACTORY_PIN;
  // Sin credenciales proporcionadas por el operador no se crea ninguna cuenta demo.
  if (!validateAdminPassword(adminPassword).isValid
      || !validateWorkerPin(sellerPin).isValid || !validateWorkerPin(factoryPin).isValid) return;
  const adminHashed = hashPassword(adminPassword);
  const adminCred: DevAccountCredential = {
    passwordHash: adminHashed.hash,
    passwordSalt: adminHashed.salt,
    isProvisioned: true,
    failedAttempts: 0
  };
  devTestCredentialsStore.set('adm-01', adminCred);
  devTestCredentialsStore.set('usr-admin-1', adminCred);
  devTestCredentialsStore.set('carlos.admin@tequenosplaya.com', adminCred);

  // 2. Vendedor demo con PIN proporcionado por el operador.
  const vend1Hashed = hashPin(sellerPin);
  const vend1Cred: DevAccountCredential = {
    pinHash: vend1Hashed.hash,
    pinSalt: vend1Hashed.salt,
    isProvisioned: true,
    failedAttempts: 0
  };
  devTestCredentialsStore.set('vend-01', vend1Cred);
  devTestCredentialsStore.set('usr-vend-1', vend1Cred);
  devTestCredentialsStore.set('lucas.b@playa.com', vend1Cred);

  // 3. Operario demo con PIN proporcionado por el operador.
  const fab1Hashed = hashPin(factoryPin);
  const fab1Cred: DevAccountCredential = {
    pinHash: fab1Hashed.hash,
    pinSalt: fab1Hashed.salt,
    isProvisioned: true,
    failedAttempts: 0
  };
  devTestCredentialsStore.set('fab-01', fab1Cred);
  devTestCredentialsStore.set('usr-fab-1', fab1Cred);

  // 4. Cuenta NO APROVISIONADA para pruebas de seguridad
  devTestCredentialsStore.set('unprovisioned-worker', {
    pinHash: null,
    pinSalt: null,
    isProvisioned: false,
    failedAttempts: 0
  });
}
initDevTestStore();

/**
 * POST /api/auth/validate-credential
 * Valida la fortaleza sintáctica y reglas de seguridad de credenciales (sin revelar existencia de usuarios).
 */
authRouter.post('/validate-credential', pinRateLimiter, async (req: Request, res: Response) => {
  try {
    const { type, value } = req.body || {};

    if (type === 'admin_password') {
      const result = validateAdminPassword(value);
      return res.json(result);
    }

    if (type === 'worker_pin') {
      const result = validateWorkerPin(value);
      return res.json(result);
    }

    return res.status(400).json({
      isValid: false,
      error: 'Tipo de credencial no reconocido. Use worker_pin o admin_password.'
    });
  } catch (error: any) {
    res.status(400).json({ isValid: false, error: 'Formato de credencial inválido.' });
  }
});

/**
 * POST /api/auth/bootstrap-admin
 * Procedimiento seguro para dar de alta el primer administrador en una base de datos recién instalada.
 */
authRouter.post('/bootstrap-admin', pinRateLimiter, async (req: Request, res: Response) => {
  const body = req.body;
  const infrastructureSecret = process.env.BOOTSTRAP_SECRET;
  // El secreto es obligatorio incluso antes del primer aprovisionamiento.
  // Hashear ambos lados permite comparación constante sin filtrar longitudes.
  const suppliedSecret = body?.bootstrapSecret;
  if (!infrastructureSecret || infrastructureSecret.length < 32
      || typeof suppliedSecret !== 'string' || suppliedSecret.length > 1024
      || !crypto.timingSafeEqual(
        crypto.createHash('sha256').update(infrastructureSecret).digest(),
        crypto.createHash('sha256').update(suppliedSecret).digest())) {
    recordFailedAttempt(req);
    return res.status(403).json({ success: false, code: 'BOOTSTRAP_DISABLED', message: 'Aprovisionamiento no autorizado.' });
  }
  if (!isDbConfigured()) {
    return res.status(503).json({ success: false, code: 'DATABASE_REQUIRED', message: 'El aprovisionamiento requiere la base central.' });
  }
  if (!body || typeof body.identifier !== 'string' || body.identifier.trim().length === 0
      || body.identifier.length > 254 || !validateAdminPassword(body.newPassword).isValid) {
    return res.status(400).json({ success: false, code: 'INVALID_CREDENTIAL_FORMAT', message: 'Datos de aprovisionamiento inválidos.' });
  }
  try {
    const provisioned = await userRepository.bootstrapInitialAdmin(body.identifier.trim(), body.newPassword);
    if (!provisioned) {
      return res.status(403).json({ success: false, code: 'BOOTSTRAP_DISABLED', message: 'Aprovisionamiento inicial no disponible.' });
    }
    return res.json({ success: true, message: 'Administrador inicial aprovisionado.' });
  } catch {
    return res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'Servicio central no disponible.' });
  }
});

/**
 * POST /api/auth/login
 * Contrato Oficial Estricto:
 * - Trabajador: { userCode, pin }
 * - Administrador: { identifier, password }
 *
 * Rechazos obligatorios:
 * - { pin } sin identificador -> HTTP 400 MISSING_USER_CODE
 * - { password } sin identificador -> HTTP 400 MISSING_IDENTIFIER
 * - PIN de 4 dígitos o longitud diferente a 8 -> HTTP 400 INVALID_PIN_FORMAT
 * - Cuentas sin aprovisionar -> HTTP 401 INVALID_CREDENTIALS
 * - Intentos fallidos excedidos -> HTTP 429 ACCOUNT_LOCKED
 */
authRouter.post('/login', pinRateLimiter, async (req: Request, res: Response) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ success: false, code: 'MISSING_CREDENTIALS', message: 'Credenciales requeridas.' });
  }
  const isAdminLogin = body.password !== undefined;
  const isWorkerLogin = body.pin !== undefined;
  const identifier = isAdminLogin ? body.identifier : body.userCode;
  if (isAdminLogin === isWorkerLogin
      || Object.keys(body).some((key) => !(isAdminLogin ? ['identifier', 'password'] : ['userCode', 'pin']).includes(key))) {
    return res.status(400).json({ success: false, code: 'INVALID_AUTH_CONTRACT', message: 'Contrato de autenticación inválido.' });
  }
  if (typeof identifier !== 'string' || identifier.trim().length === 0 || identifier.length > 254) {
    return res.status(400).json({ success: false, code: isAdminLogin ? 'MISSING_IDENTIFIER' : 'MISSING_USER_CODE', message: 'Identificador requerido.' });
  }
  const secret = isAdminLogin ? body.password : body.pin;
  if (typeof secret !== 'string' || (isAdminLogin ? secret.length === 0 || secret.length > 1024 : !/^\d{8}$/.test(secret))) {
    return res.status(400).json({ success: false, code: isAdminLogin ? 'INVALID_PASSWORD_FORMAT' : 'INVALID_PIN_FORMAT', message: 'Formato de credencial inválido.' });
  }
  const normalizedIdentifier = identifier.trim();
  const meta = { ip: req.ip, userAgent: req.headers['user-agent']?.slice(0, 512) };
  const rejectCredentials = () => {
    recordFailedAttempt(req);
    // Misma respuesta para inexistente, inactiva, no aprovisionada, hash inválido o clave incorrecta.
    return res.status(401).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Credenciales incorrectas.' });
  };
  type LoginResult = { user: UserAuthRecord; token: string; expiresAt: string };
  try {
    let loginResult: LoginResult | null = null;
    let locked = false;
    if (isDbConfigured()) {
      loginResult = await withTransaction(async (client) => {
        // Mismo orden de locks que aprovisionamiento: tabla antes de fila.
        await client.query('LOCK TABLE users IN ROW EXCLUSIVE MODE');
        // La fila bloqueada serializa verificación, contador y emisión frente a otros logins/restablecimientos.
        const account = await userRepository.getAuthRecordByIdentifier(normalizedIdentifier, client);
        if (!account || !account.isActive || (isAdminLogin ? account.role !== 'admin' : account.role === 'admin')
            || (!isAdminLogin && account.userCode?.toLowerCase() !== normalizedIdentifier.toLowerCase())) return null;
        if (account.lockedUntil && new Date(account.lockedUntil).getTime() > Date.now()) {
          locked = true;
          return null;
        }
        const verified = account.isProvisioned && (isAdminLogin
          ? verifyPassword(secret, account.passwordHash, account.passwordSalt)
          : verifyPin(secret, account.pinHash, account.pinSalt));
        if (!verified) {
          await userRepository.recordFailedAttempt(account.id, client);
          return null;
        }
        await userRepository.recordSuccessfulLogin(account.id, client);
        const created = await sessionManager.createSession(account, meta, client);
        return { user: account, token: created.token, expiresAt: created.session.expiresAt };
      });
    } else if (isIsolatedDemoEnabled()) {
      const demoCredential = devTestCredentialsStore.get(normalizedIdentifier.toLowerCase());
      const account = INITIAL_USERS.find((user) => isAdminLogin
        ? [user.id, user.userCode, user.email].some((value) => value?.toLowerCase() === normalizedIdentifier.toLowerCase())
        : user.userCode?.toLowerCase() === normalizedIdentifier.toLowerCase());
      if (demoCredential && account && account.isActive && (isAdminLogin ? account.role === 'admin' : account.role !== 'admin')) {
        locked = Boolean(demoCredential.lockedUntil && demoCredential.lockedUntil > Date.now());
        // Tras vencer el bloqueo empieza una ventana nueva de intentos.
        if (demoCredential.lockedUntil && !locked) {
          demoCredential.failedAttempts = 0;
          demoCredential.lockedUntil = null;
        }
        if (!locked && demoCredential.isProvisioned && (isAdminLogin
          ? verifyPassword(secret, demoCredential.passwordHash, demoCredential.passwordSalt)
          : verifyPin(secret, demoCredential.pinHash, demoCredential.pinSalt))) {
          demoCredential.failedAttempts = 0;
          demoCredential.lockedUntil = null;
          const created = await sessionManager.createSession(account, meta);
          loginResult = { user: account, token: created.token, expiresAt: created.session.expiresAt };
        } else if (!locked) {
          demoCredential.failedAttempts += 1;
          if (demoCredential.failedAttempts >= 5) demoCredential.lockedUntil = Date.now() + 15 * 60 * 1000;
        }
      }
    } else {
      return res.status(503).json({ success: false, code: 'DATABASE_REQUIRED', message: 'La autenticación requiere la base central.' });
    }
    if (locked) return res.status(429).json({ success: false, code: 'ACCOUNT_LOCKED', message: 'Acceso bloqueado temporalmente.' });
    if (!loginResult) return rejectCredentials();
    recordSuccessfulAttempt(req);
    const apiTransport = isExplicitApiRequest(req);
    if (!apiTransport) setSessionCookie(res, loginResult.token, loginResult.expiresAt);
    return res.json({ success: true, ...(apiTransport ? { token: loginResult.token } : {}), expiresAt: loginResult.expiresAt, user: publicProfile(loginResult.user), message: 'Inicio de sesión verificado.' });
  } catch {
    return res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'Servicio central no disponible.' });
  }
});

/**
 * POST /api/auth/logout
 * Revoca la sesión actual del usuario.
 */
authRouter.post('/logout', async (req: Request, res: Response) => {
  try {
    const token = extractToken(req);
    if (token) {
      const revoked = await sessionManager.revokeSession(token);
      if (!revoked) return res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'No se pudo revocar la sesión central.' });
    }
    clearSessionCookie(res);
    res.json({
      success: true,
      message: 'Sesión cerrada correctamente'
    });
  } catch (error: any) {
    res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'Servicio central no disponible.' });
  }
});

/**
 * GET /api/auth/me
 * Obtiene el perfil del usuario autenticado a partir del token de sesión.
 */
authRouter.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const session = req.userSession!;
    const user = isDbConfigured()
      ? await userRepository.getById(session.userId)
      : isIsolatedDemoEnabled() ? INITIAL_USERS.find((profile) => profile.id === session.userId) : null;
    if (!user || !user.isActive || user.role !== session.role) {
      return res.status(401).json({ success: false, code: 'INVALID_OR_EXPIRED_TOKEN', message: 'Sesión inválida.' });
    }
    return res.json({ success: true, user: publicProfile(user), session: { id: session.id, expiresAt: session.expiresAt, role: session.role } });
  } catch {
    return res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'Servicio central no disponible.' });
  }
});
