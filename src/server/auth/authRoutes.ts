/**
 * SGMO — Tequeños Costa
 * Endpoints REST de Autenticación Segura y Control de Sesión (Hito 1.2.1)
 *
 * Reglas Estrictas de Seguridad:
 * - Se elimina totalmente el login por PIN sin identificador ({ pin } solo es rechazado).
 * - Se elimina la compatibilidad con PINs legados de 4 dígitos (se exigen 8 dígitos exactos).
 * - Se eliminan todas las comparaciones en texto plano: solo scrypt con salt individual.
 * - Las cuentas sin credenciales aprovisionadas son rechazadas (HTTP 401 ACCOUNT_NOT_PROVISIONED).
 * - Fallo de PostgreSQL propaga HTTP 503 SERVICE_UNAVAILABLE y jamás recurre a credenciales de contingencia.
 * - Concurrencia y bloqueo por fuerza bruta persistido en base de datos.
 */

import { Router, Request, Response } from 'express';
import { isDbConfigured } from '../db/connection';
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

export const authRouter = Router();

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
  // 1. Admin de prueba (CostaTequenos2026!#)
  const adminHashed = hashPassword('CostaTequenos2026!#');
  const adminCred: DevAccountCredential = {
    passwordHash: adminHashed.hash,
    passwordSalt: adminHashed.salt,
    isProvisioned: true,
    failedAttempts: 0
  };
  devTestCredentialsStore.set('adm-01', adminCred);
  devTestCredentialsStore.set('usr-admin-1', adminCred);
  devTestCredentialsStore.set('carlos.admin@tequenosplaya.com', adminCred);

  // 2. Vendedor Lucas Benítez (VEND-01: 38491725)
  const vend1Hashed = hashPin('38491725');
  const vend1Cred: DevAccountCredential = {
    pinHash: vend1Hashed.hash,
    pinSalt: vend1Hashed.salt,
    isProvisioned: true,
    failedAttempts: 0
  };
  devTestCredentialsStore.set('vend-01', vend1Cred);
  devTestCredentialsStore.set('usr-vend-1', vend1Cred);
  devTestCredentialsStore.set('lucas.b@playa.com', vend1Cred);

  // 3. Operario de fábrica Marcos Benavídez (FAB-01: 61528473)
  const fab1Hashed = hashPin('61528473');
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
authRouter.post('/validate-credential', async (req: Request, res: Response) => {
  try {
    const { type, value } = req.body;

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
    res.status(500).json({ isValid: false, error: error.message });
  }
});

/**
 * POST /api/auth/bootstrap-admin
 * Procedimiento seguro para dar de alta el primer administrador en una base de datos recién instalada.
 */
authRouter.post('/bootstrap-admin', async (req: Request, res: Response) => {
  try {
    const { identifier, newPassword, bootstrapSecret } = req.body;

    if (!identifier || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Debe ingresar el identificador del administrador y la nueva contraseña.'
      });
    }

    const val = validateAdminPassword(newPassword);
    if (!val.isValid) {
      return res.status(400).json({ success: false, message: val.error });
    }

    if (isDbConfigured()) {
      const existingAdmin = await userRepository.getAuthRecordByIdentifier(identifier);
      if (!existingAdmin) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado en la base central.' });
      }

      if (existingAdmin.isProvisioned && existingAdmin.passwordHash) {
        // Si ya está aprovisionado, se requiere el token secreto de infraestructura para rotación de emergencia
        const envSecret = process.env.BOOTSTRAP_SECRET;
        if (!envSecret || bootstrapSecret !== envSecret) {
          return res.status(403).json({
            success: false,
            code: 'BOOTSTRAP_DISABLED',
            message: 'El administrador ya se encuentra aprovisionado. Procedimiento bloqueado.'
          });
        }
      }

      await userRepository.updatePassword(existingAdmin.id, newPassword);
      return res.json({ success: true, message: 'Contraseña de administrador aprovisionada correctamente.' });
    } else {
      // Modo desarrollo
      const hashed = hashPassword(newPassword);
      devTestCredentialsStore.set(identifier.toLowerCase(), {
        passwordHash: hashed.hash,
        passwordSalt: hashed.salt,
        isProvisioned: true,
        failedAttempts: 0
      });
      return res.json({ success: true, message: 'Contraseña de administrador provisionada en entorno de desarrollo.' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/auth/login
 * Contrato Oficial Estricto:
 * - Trabajador: { userCode, pin } (o { identifier, pin })
 * - Administrador: { identifier, password }
 *
 * Rechazos obligatorios:
 * - { pin } sin identificador -> HTTP 400 MISSING_USER_CODE
 * - { password } sin identificador -> HTTP 400 MISSING_IDENTIFIER
 * - PIN de 4 dígitos o longitud diferente a 8 -> HTTP 400 INVALID_PIN_FORMAT
 * - Cuentas sin aprovisionar -> HTTP 401 ACCOUNT_NOT_PROVISIONED
 * - Intentos fallidos excedidos -> HTTP 429 ACCOUNT_LOCKED
 */
authRouter.post('/login', pinRateLimiter, async (req: Request, res: Response) => {
  try {
    const { pin, password, identifier, userCode, email, username } = req.body;
    const resolvedIdentifier = (identifier || userCode || email || username || '').toString().trim();

    // =========================================================================
    // 1. CASO: AUTENTICACIÓN DE ADMINISTRADOR MEDIANTE CONTRASEÑA
    // =========================================================================
    if (password !== undefined) {
      if (!resolvedIdentifier) {
        return res.status(400).json({
          success: false,
          code: 'MISSING_IDENTIFIER',
          message: 'Debe ingresar el identificador o correo electrónico del usuario administrador.'
        });
      }

      if (typeof password !== 'string' || password.length === 0) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_PASSWORD_FORMAT',
          message: 'Debe suministrar una contraseña válida.'
        });
      }

      let authenticatedAdmin: any = null;

      // 1.a. Validación contra PostgreSQL si está configurado
      if (isDbConfigured()) {
        try {
          const authRecord = await userRepository.getAuthRecordByIdentifier(resolvedIdentifier);

          if (!authRecord || authRecord.isActive === false || authRecord.role !== 'admin') {
            recordFailedAttempt(req);
            return res.status(401).json({
              success: false,
              code: 'INVALID_CREDENTIALS',
              message: 'Credenciales de administrador incorrectas.'
            });
          }

          // Verificar si la cuenta está bloqueada en base de datos
          if (authRecord.lockedUntil && new Date(authRecord.lockedUntil).getTime() > Date.now()) {
            return res.status(429).json({
              success: false,
              code: 'ACCOUNT_LOCKED',
              message: 'Cuenta bloqueada temporalmente por reiterados intentos fallidos. Reintente en 15 minutos.'
            });
          }

          // Verificar si la cuenta está aprovisionada con hash scrypt válido
          if (!authRecord.isProvisioned || !authRecord.passwordHash || !authRecord.passwordSalt) {
            return res.status(401).json({
              success: false,
              code: 'ACCOUNT_NOT_PROVISIONED',
              message: 'La cuenta de administrador no posee credenciales aprovisionadas en el sistema.'
            });
          }

          // Verificación criptográfica estricta con scrypt
          const isPasswordValid = verifyPassword(password, authRecord.passwordHash, authRecord.passwordSalt);
          if (isPasswordValid) {
            authenticatedAdmin = authRecord;
            await userRepository.recordSuccessfulLogin(authRecord.id);
            recordSuccessfulAttempt(req);
          } else {
            await userRepository.recordFailedAttempt(authRecord.id);
            const { remainingAttempts, isBlocked } = recordFailedAttempt(req);
            return res.status(401).json({
              success: false,
              code: 'INVALID_CREDENTIALS',
              message: isBlocked
                ? 'Demasiados intentos fallidos. Acceso bloqueado temporalmente por seguridad.'
                : `Credenciales de administrador incorrectas. Te quedan ${remainingAttempts} intento(s) antes del bloqueo.`,
              remainingAttempts
            });
          }
        } catch (dbErr: any) {
          console.error('⚠️ Error al consultar base de datos para login admin:', dbErr.message);
          // REGLA CRÍTICA: La falla de PostgreSQL propaga 503 y NUNCA recurre a datos de contingencia
          return res.status(503).json({
            success: false,
            code: 'SERVICE_UNAVAILABLE',
            message: 'Servicio central de base de datos no disponible temporalmente.'
          });
        }
      } else {
        // 1.b. Modo desarrollo local / pruebas sin base central
        if (process.env.NODE_ENV === 'production') {
          return res.status(503).json({
            success: false,
            code: 'DATABASE_REQUIRED',
            message: 'La base de datos central es obligatoria para iniciar sesión en producción.'
          });
        }

        const devCred = devTestCredentialsStore.get(resolvedIdentifier.toLowerCase());
        const mockUser = INITIAL_USERS.find(
          (u) =>
            u.id.toLowerCase() === resolvedIdentifier.toLowerCase() ||
            (u.userCode && u.userCode.toLowerCase() === resolvedIdentifier.toLowerCase()) ||
            u.email?.toLowerCase() === resolvedIdentifier.toLowerCase()
        );

        if (!devCred || !mockUser || mockUser.role !== 'admin' || mockUser.isActive === false) {
          recordFailedAttempt(req);
          return res.status(401).json({
            success: false,
            code: 'INVALID_CREDENTIALS',
            message: 'Credenciales de administrador incorrectas.'
          });
        }

        if (!devCred.isProvisioned || !devCred.passwordHash || !devCred.passwordSalt) {
          return res.status(401).json({
            success: false,
            code: 'ACCOUNT_NOT_PROVISIONED',
            message: 'La cuenta no posee credenciales aprovisionadas.'
          });
        }

        if (devCred.lockedUntil && devCred.lockedUntil > Date.now()) {
          return res.status(429).json({
            success: false,
            code: 'ACCOUNT_LOCKED',
            message: 'Cuenta bloqueada temporalmente por reiterados intentos fallidos.'
          });
        }

        const isPasswordValid = verifyPassword(password, devCred.passwordHash, devCred.passwordSalt);
        if (isPasswordValid) {
          devCred.failedAttempts = 0;
          devCred.lockedUntil = null;
          authenticatedAdmin = mockUser;
          recordSuccessfulAttempt(req);
        } else {
          devCred.failedAttempts += 1;
          if (devCred.failedAttempts >= 5) {
            devCred.lockedUntil = Date.now() + 15 * 60 * 1000;
          }
          const { remainingAttempts, isBlocked } = recordFailedAttempt(req);
          return res.status(401).json({
            success: false,
            code: 'INVALID_CREDENTIALS',
            message: isBlocked
              ? 'Demasiados intentos fallidos. Acceso bloqueado temporalmente.'
              : `Credenciales de administrador incorrectas. Te quedan ${remainingAttempts} intento(s).`,
            remainingAttempts
          });
        }
      }

      // Crear sesión segura
      const meta = {
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent']
      };

      const { token, session } = await sessionManager.createSession(
        {
          id: authenticatedAdmin.id,
          name: authenticatedAdmin.name,
          role: authenticatedAdmin.role
        },
        meta
      );

      const { pin: _p, pinHash: _ph, pinSalt: _ps, password: _pw, passwordHash: _pwh, passwordSalt: _pws, ...safeAdmin } = authenticatedAdmin;

      return res.json({
        success: true,
        token,
        expiresAt: session.expiresAt,
        user: safeAdmin,
        message: `Bienvenido/a Administrador ${authenticatedAdmin.name}`
      });
    }

    // =========================================================================
    // 2. CASO: AUTENTICACIÓN DE TRABAJADOR MEDIANTE CÓDIGO DE USUARIO + PIN
    // =========================================================================
    if (pin !== undefined) {
      // REGLA CRÍTICA (Hito 1.2.1): Prohibido terminantemente el login por PIN sin identificador
      if (!resolvedIdentifier) {
        return res.status(400).json({
          success: false,
          code: 'MISSING_USER_CODE',
          message: 'Debe especificar el código de usuario (userCode) o identificador de cuenta.'
        });
      }

      if (typeof pin !== 'string') {
        return res.status(400).json({
          success: false,
          code: 'INVALID_PIN_FORMAT',
          message: 'El PIN debe ser una cadena numérica de exactamente 8 dígitos.'
        });
      }

      const cleanPin = pin.trim();

      // REGLA CRÍTICA (Hito 1.2.1): Eliminada la compatibilidad con PINs de 4 dígitos
      if (!/^\d{8}$/.test(cleanPin)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_PIN_FORMAT',
          message: `El PIN ingresado posee una longitud o formato inválido (${cleanPin.length} caracteres). Debe contener exactamente 8 dígitos numéricos.`
        });
      }

      let authenticatedUser: any = null;

      // 2.a. Validación contra PostgreSQL si está configurado
      if (isDbConfigured()) {
        try {
          const authRecord = await userRepository.getAuthRecordByIdentifier(resolvedIdentifier);

          if (!authRecord || authRecord.isActive === false) {
            recordFailedAttempt(req);
            return res.status(401).json({
              success: false,
              code: 'INVALID_CREDENTIALS',
              message: 'Código de usuario incorrecto o cuenta inactiva.'
            });
          }

          // Verificar si la cuenta está bloqueada en base de datos
          if (authRecord.lockedUntil && new Date(authRecord.lockedUntil).getTime() > Date.now()) {
            return res.status(429).json({
              success: false,
              code: 'ACCOUNT_LOCKED',
              message: 'Cuenta bloqueada temporalmente por reiterados intentos fallidos. Reintente en 15 minutos.'
            });
          }

          // Verificar si la cuenta está aprovisionada con hash scrypt válido
          if (!authRecord.isProvisioned || !authRecord.pinHash || !authRecord.pinSalt) {
            return res.status(401).json({
              success: false,
              code: 'ACCOUNT_NOT_PROVISIONED',
              message: 'La cuenta no posee un PIN personal aprovisionado en el sistema.'
            });
          }

          // Verificación criptográfica estricta con scrypt
          const isPinValid = verifyPin(cleanPin, authRecord.pinHash, authRecord.pinSalt);
          if (isPinValid) {
            authenticatedUser = authRecord;
            await userRepository.recordSuccessfulLogin(authRecord.id);
            recordSuccessfulAttempt(req);
          } else {
            await userRepository.recordFailedAttempt(authRecord.id);
            const { remainingAttempts, isBlocked } = recordFailedAttempt(req);
            return res.status(401).json({
              success: false,
              code: 'INVALID_CREDENTIALS',
              message: isBlocked
                ? 'Demasiados intentos fallidos. Acceso bloqueado temporalmente por seguridad.'
                : `PIN incorrecto. Te quedan ${remainingAttempts} intento(s) antes del bloqueo.`,
              remainingAttempts
            });
          }
        } catch (dbErr: any) {
          console.error('⚠️ Error al consultar base de datos para login trabajador:', dbErr.message);
          // REGLA CRÍTICA: La falla de PostgreSQL propaga 503 y NUNCA recurre a datos de contingencia
          return res.status(503).json({
            success: false,
            code: 'SERVICE_UNAVAILABLE',
            message: 'Servicio central de base de datos no disponible temporalmente.'
          });
        }
      } else {
        // 2.b. Modo desarrollo local / pruebas sin base central
        if (process.env.NODE_ENV === 'production') {
          return res.status(503).json({
            success: false,
            code: 'DATABASE_REQUIRED',
            message: 'La base de datos central es obligatoria para iniciar sesión en producción.'
          });
        }

        const devCred = devTestCredentialsStore.get(resolvedIdentifier.toLowerCase());
        const mockUser = INITIAL_USERS.find(
          (u) =>
            u.id.toLowerCase() === resolvedIdentifier.toLowerCase() ||
            (u.userCode && u.userCode.toLowerCase() === resolvedIdentifier.toLowerCase()) ||
            u.email?.toLowerCase() === resolvedIdentifier.toLowerCase()
        );

        if (!devCred || !mockUser || mockUser.isActive === false) {
          recordFailedAttempt(req);
          return res.status(401).json({
            success: false,
            code: 'INVALID_CREDENTIALS',
            message: 'Código de usuario incorrecto o cuenta no encontrada.'
          });
        }

        if (!devCred.isProvisioned || !devCred.pinHash || !devCred.pinSalt) {
          return res.status(401).json({
            success: false,
            code: 'ACCOUNT_NOT_PROVISIONED',
            message: 'La cuenta no posee credenciales aprovisionadas.'
          });
        }

        if (devCred.lockedUntil && devCred.lockedUntil > Date.now()) {
          return res.status(429).json({
            success: false,
            code: 'ACCOUNT_LOCKED',
            message: 'Cuenta bloqueada temporalmente por reiterados intentos fallidos.'
          });
        }

        const isPinValid = verifyPin(cleanPin, devCred.pinHash, devCred.pinSalt);
        if (isPinValid) {
          devCred.failedAttempts = 0;
          devCred.lockedUntil = null;
          authenticatedUser = mockUser;
          recordSuccessfulAttempt(req);
        } else {
          devCred.failedAttempts += 1;
          if (devCred.failedAttempts >= 5) {
            devCred.lockedUntil = Date.now() + 15 * 60 * 1000;
          }
          const { remainingAttempts, isBlocked } = recordFailedAttempt(req);
          return res.status(401).json({
            success: false,
            code: 'INVALID_CREDENTIALS',
            message: isBlocked
              ? 'Demasiados intentos fallidos. Acceso bloqueado temporalmente.'
              : `PIN incorrecto. Te quedan ${remainingAttempts} intento(s).`,
            remainingAttempts
          });
        }
      }

      // Crear sesión segura
      const meta = {
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent']
      };

      const { token, session } = await sessionManager.createSession(
        {
          id: authenticatedUser.id,
          name: authenticatedUser.name,
          role: authenticatedUser.role
        },
        meta
      );

      const { pin: _p, pinHash: _ph, pinSalt: _ps, password: _pw, passwordHash: _pwh, passwordSalt: _pws, ...safeUser } = authenticatedUser;

      return res.json({
        success: true,
        token,
        expiresAt: session.expiresAt,
        user: safeUser,
        message: `Bienvenido/a ${authenticatedUser.name}`
      });
    }

    // =========================================================================
    // 3. CASO: SOLICITUD SIN CREDENCIALES
    // =========================================================================
    return res.status(400).json({
      success: false,
      code: 'MISSING_CREDENTIALS',
      message: 'Debe ingresar userCode + PIN personal de 8 dígitos para trabajador o identificador + contraseña para administrador.'
    });
  } catch (error: any) {
    console.error('Error en /api/auth/login:', error);
    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: error.message || 'Error interno al procesar el inicio de sesión'
    });
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
      await sessionManager.revokeSession(token);
    }
    res.json({
      success: true,
      message: 'Sesión cerrada correctamente'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/auth/me
 * Obtiene el perfil del usuario autenticado a partir del token de sesión.
 */
authRouter.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const session = req.userSession!;

    let userProfile: any = null;
    if (isDbConfigured()) {
      userProfile = await userRepository.getById(session.userId);
    }

    if (!userProfile) {
      const match = INITIAL_USERS.find((u) => u.id === session.userId);
      if (match) {
        const { pin: _pin, ...safeMatch } = match;
        userProfile = safeMatch;
      }
    }

    if (!userProfile) {
      userProfile = {
        id: session.userId,
        name: session.userName,
        role: session.role
      };
    }

    res.json({
      success: true,
      user: userProfile,
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
        role: session.role
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});
