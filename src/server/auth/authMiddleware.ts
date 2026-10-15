/**
 * SGMO — Tequeños Costa
 * Middlewares de Autenticación y Autorización Basados en Roles (RBAC)
 */

import { Request, Response, NextFunction } from 'express';
import { sessionManager, SessionData } from './sessionManager.js';
import { UserRole } from '../../types';
import { isExplicitApiRequest, readSessionCookie } from './browserSecurity.js';

// Extender la interfaz Request de Express para adjuntar la sesión
declare global {
  namespace Express {
    interface Request {
      userSession?: SessionData;
    }
  }
}

/**
 * El navegador autentica con cookie HttpOnly. Bearer sólo existe en el transporte API opt-in.
 */
export function extractToken(req: Request): string | null {
  const cookieToken = readSessionCookie(req);
  if (cookieToken) return cookieToken;
  if (!isExplicitApiRequest(req)) return null;
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return null;
}

/**
 * Middleware que exige una sesión válida y autenticada
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Se requiere una sesión válida.'
    });
    return;
  }

  let session: SessionData | null;
  try {
    session = await sessionManager.validateToken(token);
  } catch {
    res.status(503).json({
      success: false,
      code: 'SERVICE_UNAVAILABLE',
      message: 'El servicio de autenticación no está disponible. Intentá nuevamente.'
    });
    return;
  }
  if (!session) {
    res.status(401).json({
      success: false,
      code: 'INVALID_OR_EXPIRED_TOKEN',
      message: 'Sesión inválida o expirada. Por favor, reingresá tu PIN para iniciar sesión.'
    });
    return;
  }

  req.userSession = session;
  next();
}

/**
 * Middleware que verifica que el usuario autenticado posea uno de los roles autorizados
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userSession) {
      res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'No autenticado.'
      });
      return;
    }

    const userRole = req.userSession.role;
    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: `Acceso restringido: Se requiere rol [${allowedRoles.join(', ')}]. Tu rol es [${userRole}].`
      });
      return;
    }

    next();
  };
}
