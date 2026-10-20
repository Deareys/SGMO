/**
 * SGMO — Tequeños Costa
 * Gestor de Sesiones y Almacén de Tokens Seguros
 *
 * Persiste las sesiones en PostgreSQL si DATABASE_URL está disponible;
 * El almacén volátil se permite únicamente en una demostración explícita y aislada.
 * Un fallo de PostgreSQL se propaga: nunca habilita una sesión alternativa.
 */

import { query, isDbConfigured } from '../db/connection.js';
import { generateSessionToken, hashToken } from './cryptoUtils.js';
import { UserRole } from '../../types';
import { randomUUID } from 'crypto';
import { isIsolatedDemoEnabled } from './authPolicy.js';
import type { PoolClient } from 'pg';

export interface SessionData {
  id: string;
  userId: string;
  token: string;
  role: UserRole;
  userName: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  expiresAt: string;
  isRevoked: boolean;
}

// Almacén exclusivo del modo demo aislado; nunca es un respaldo de PostgreSQL.
const memorySessions = new Map<string, SessionData>();
const SESSION_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

// Duración de la sesión: 14 horas (cubre la jornada de playa completa sin obligar a re-ingresar PIN en la arena)
const SESSION_DURATION_HOURS = 14;

export class SessionManager {
  /**
   * Crea una sesión sólo tras persistirla. El cliente opcional conserva el bloqueo
   * transaccional de la cuenta durante login/restablecimiento y evita emitir una
   * sesión con credenciales que acaban de ser reemplazadas.
   */
  async createSession(user: { id: string; name: string; role: UserRole }, meta?: { ip?: string; userAgent?: string }, client?: PoolClient): Promise<{ token: string; session: SessionData }> {
    if (!isDbConfigured() && !isIsolatedDemoEnabled()) {
      throw new Error('Autenticación no disponible sin base central o demo aislada.');
    }
    const rawToken = generateSessionToken();
    const tokenH = hashToken(rawToken);
    const sessionId = `SES-${randomUUID()}`;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

    const session: SessionData = {
      id: sessionId,
      userId: user.id,
      token: rawToken,
      role: user.role,
      userName: user.name,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isRevoked: false
    };

    // Emitir el token sólo después de persistir; no crear un duplicado en memoria.
    if (isDbConfigured()) {
      const executeQuery = client ? client.query.bind(client) : query;
      const result = await executeQuery(`
          INSERT INTO auth_sessions (
            id, user_id, token_hash, role, ip_address, user_agent, expires_at, is_revoked, created_at, last_activity_at
          ) SELECT $1, u.id, $3, u.role, $5, $6, $7, $8, $9, $9
            FROM users u
            WHERE u.id = $2 AND u.role = $4 AND u.is_active = TRUE AND u.is_provisioned = TRUE
        `, [
          sessionId,
          user.id,
          tokenH,
          user.role,
          meta?.ip || null,
          meta?.userAgent || null,
          expiresAt.toISOString(),
          false,
          now.toISOString()
        ]);
      if (result.rowCount !== 1) {
        throw new Error('La cuenta ya no admite emisión de sesiones.');
      }
    } else {
      memorySessions.set(tokenH, session);
    }

    return { token: rawToken, session };
  }

  /**
   * Valida un token provisto y retorna la sesión activa asociada
   */
  async validateToken(rawToken: string): Promise<SessionData | null> {
    if (typeof rawToken !== 'string' || !SESSION_TOKEN_PATTERN.test(rawToken)) return null;

    const tokenH = hashToken(rawToken);

    // 1. Verificar en PostgreSQL si está configurado
    if (isDbConfigured()) {
        const res = await query(`
          UPDATE auth_sessions s SET last_activity_at = CURRENT_TIMESTAMP
          FROM users u
          WHERE s.token_hash = $1 AND u.id = s.user_id
            AND s.is_revoked = FALSE AND s.expires_at > CURRENT_TIMESTAMP
            AND u.is_active = TRUE AND u.is_provisioned = TRUE AND s.role = u.role
          RETURNING s.id, s.user_id as "userId", u.role,
            s.expires_at as "expiresAt", s.created_at as "createdAt", u.name as "userName"
        `, [tokenH]);

        if (res.rows.length > 0) {
          const row = res.rows[0];
          return {
            id: row.id,
            userId: row.userId,
            token: rawToken,
            role: row.role as UserRole,
            userName: row.userName,
            createdAt: new Date(row.createdAt).toISOString(),
            expiresAt: new Date(row.expiresAt).toISOString(),
            isRevoked: false
          };
        }
      return null;
    }

    if (!isIsolatedDemoEnabled()) return null;

    // 2. Verificar en memoria únicamente en demo.
    const mem = memorySessions.get(tokenH);
    if (!mem) return null;

    const expiresAt = new Date(mem.expiresAt);
    if (mem.isRevoked || expiresAt.getTime() <= Date.now()) {
      memorySessions.delete(tokenH);
      return null;
    }

    return mem;
  }

  /**
   * Revoca una sesión específica
   */
  async revokeSession(rawToken: string): Promise<boolean> {
    if (typeof rawToken !== 'string' || !SESSION_TOKEN_PATTERN.test(rawToken)) return false;
    const tokenH = hashToken(rawToken);

    if (isDbConfigured()) {
      await query('UPDATE auth_sessions SET is_revoked = TRUE WHERE token_hash = $1', [tokenH]);
      return true;
    }
    if (!isIsolatedDemoEnabled()) return false;

    const mem = memorySessions.get(tokenH);
    if (mem) {
      mem.isRevoked = true;
      memorySessions.delete(tokenH);
    }

    return true;
  }

  /**
   * Limpia sesiones vencidas
   */
  async cleanExpiredSessions(): Promise<void> {
    const now = Date.now();
    for (const [tokenH, session] of memorySessions.entries()) {
      if (new Date(session.expiresAt).getTime() < now) {
        memorySessions.delete(tokenH);
      }
    }

    if (isDbConfigured()) {
      await query('DELETE FROM auth_sessions WHERE expires_at <= CURRENT_TIMESTAMP OR is_revoked = TRUE');
    }
  }
}

export const sessionManager = new SessionManager();
