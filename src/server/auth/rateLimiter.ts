/**
 * SGMO — Tequeños Costa
 * Control de Tasa (Rate Limiter) en Memoria para Intentos de Autenticación
 *
 * Protege contra fuerza bruta sobre PINs de 4 dígitos (10.000 combinaciones posibles).
 * Bloquea temporalmente tras 5 intentos fallidos consecutivos durante 15 minutos.
 */

import { Request, Response, NextFunction } from 'express';

interface AttemptRecord {
  count: number;
  firstAttempt: number;
  blockedUntil?: number;
}

const attemptsByIp = new Map<string, AttemptRecord>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutos de bloqueo

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

export function pinRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const now = Date.now();
  const record = attemptsByIp.get(ip);

  if (record) {
    // Si está bloqueado
    if (record.blockedUntil && record.blockedUntil > now) {
      const remainingSeconds = Math.ceil((record.blockedUntil - now) / 1000);
      res.status(429).json({
        success: false,
        code: 'TOO_MANY_ATTEMPTS',
        message: `Demasiados intentos fallidos de PIN. Acceso bloqueado temporalmente por seguridad. Reintentá en ${remainingSeconds} segundos.`,
        retryAfter: remainingSeconds
      });
      return;
    }

    // Si ya expiró la ventana, resetear
    if (now - record.firstAttempt > WINDOW_MS) {
      attemptsByIp.set(ip, { count: 0, firstAttempt: now });
    }
  }

  next();
}

export function recordFailedAttempt(req: Request): { remainingAttempts: number; isBlocked: boolean } {
  const ip = getClientIp(req);
  const now = Date.now();
  let record = attemptsByIp.get(ip);

  if (!record || now - record.firstAttempt > WINDOW_MS) {
    record = { count: 1, firstAttempt: now };
  } else {
    record.count += 1;
  }

  let isBlocked = false;
  if (record.count >= MAX_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_DURATION_MS;
    isBlocked = true;
  }

  attemptsByIp.set(ip, record);

  return {
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - record.count),
    isBlocked
  };
}

export function recordSuccessfulAttempt(req: Request): void {
  const ip = getClientIp(req);
  attemptsByIp.delete(ip);
}
