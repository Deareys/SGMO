/**
 * SGMO — Tequeños Costa
 * Endpoints REST de Autenticación por PIN y Control de Sesión
 *
 * Flujo:
 * - POST /api/auth/login: Valida PIN en el backend, genera sesión criptográfica y devuelve token + usuario.
 * - POST /api/auth/logout: Revoca la sesión activa.
 * - GET  /api/auth/me: Retorna el usuario autenticado a partir del token Bearer.
 */

import { Router, Request, Response } from 'express';
import { isDbConfigured } from '../db/connection';
import { userRepository, UserAuthRecord } from '../db/repositories/UserRepository';
import { sessionManager } from './sessionManager';
import { verifyPin } from './cryptoUtils';
import { pinRateLimiter, recordFailedAttempt, recordSuccessfulAttempt } from './rateLimiter';
import { authenticateToken, extractToken } from './authMiddleware';
import { INITIAL_USERS } from '../../mockData';

export const authRouter = Router();

/**
 * POST /api/auth/login
 * Autentica un usuario mediante su PIN de 4 dígitos.
 */
authRouter.post('/login', pinRateLimiter, async (req: Request, res: Response) => {
  try {
    const { pin } = req.body;

    if (!pin || typeof pin !== 'string' || pin.trim().length !== 4) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_PIN_FORMAT',
        message: 'El PIN debe ser una cadena numérica de exactamente 4 dígitos.'
      });
    }

    const cleanPin = pin.trim();
    let authenticatedUser: any = null;

    // 1. Intentar validar contra PostgreSQL si está configurado
    if (isDbConfigured()) {
      try {
        const users = await userRepository.getAllForAuth();
        for (const u of users) {
          if (u.pinHash && verifyPin(cleanPin, u.pinHash, u.pinSalt)) {
            authenticatedUser = u;
            await userRepository.recordSuccessfulLogin(u.id);
            break;
          }
        }
      } catch (dbErr: any) {
        console.warn('⚠️ Error al consultar usuarios en PG para login, recurriendo a usuarios iniciales:', dbErr.message);
      }
    }

    // 2. Si no hay conexión a PG o no se encontró en PG, validar contra usuarios iniciales seguros
    if (!authenticatedUser) {
      const match = INITIAL_USERS.find((u) => u.pin === cleanPin && u.isActive !== false);
      if (match) {
        authenticatedUser = match;
      }
    }

    // 3. Si no coincide con ningún usuario
    if (!authenticatedUser) {
      const { remainingAttempts, isBlocked } = recordFailedAttempt(req);
      return res.status(401).json({
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: isBlocked
          ? 'Demasiados intentos fallidos. Acceso bloqueado temporalmente por seguridad.'
          : `PIN incorrecto o cuenta inactiva. Te quedan ${remainingAttempts} intento(s) antes del bloqueo.`,
        remainingAttempts
      });
    }

    // Resetear contador de intentos fallidos por IP
    recordSuccessfulAttempt(req);

    // 4. Crear sesión criptográfica en el backend
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

    // Omitir campos sensibles de la respuesta
    const { pin: _pin, pinHash: _ph, pinSalt: _ps, ...safeUser } = authenticatedUser;

    res.json({
      success: true,
      token,
      expiresAt: session.expiresAt,
      user: safeUser,
      message: `Bienvenido/a ${authenticatedUser.name}`
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
