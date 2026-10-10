/**
 * SGMO — Tequeños Costa
 * Middlewares de Autenticación y Autorización Basados en Roles (RBAC)
 */

import { Request, Response, NextFunction } from 'express';
import { sessionManager, SessionData } from './sessionManager';
import { UserRole } from '../../types';

// Extender la interfaz Request de Express para adjuntar la sesión
declare global {
  namespace Express {
    interface Request {
      userSession?: SessionData;
    }
  }
}

/**
 * Extrae el Bearer token del encabezado Authorization o de x-auth-token
 */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const customHeader = req.headers['x-auth-token'];
  if (typeof customHeader === 'string' && customHeader.length > 0) {
    return customHeader.trim();
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
      message: 'Acceso denegado: Se requiere un token de sesión válido en el encabezado Authorization.'
    });
    return;
  }

  const session = await sessionManager.validateToken(token);
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
