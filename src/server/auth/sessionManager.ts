/**
 * SGMO — Tequeños Costa
 * Gestor de Sesiones y Almacén de Tokens Seguros
 *
 * Persiste las sesiones en PostgreSQL si DATABASE_URL está disponible;
 * mantiene un almacén en memoria cifrado seguro con expiración automática si opera localmente.
 */

import { query, isDbConfigured } from '../db/connection';
import { generateSessionToken, hashToken } from './cryptoUtils';
import { UserRole } from '../../types';

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

// Almacén en memoria volátil de respaldo para desarrollo o cuando PG está desconectado
const memorySessions = new Map<string, SessionData>();

// Duración de la sesión: 14 horas (cubre la jornada de playa completa sin obligar a re-ingresar PIN en la arena)
const SESSION_DURATION_HOURS = 14;

export class SessionManager {
  /**
   * Crea una nueva sesión para un usuario autenticado
   */
  async createSession(user: { id: string; name: string; role: UserRole }, meta?: { ip?: string; userAgent?: string }): Promise<{ token: string; session: SessionData }> {
    const rawToken = generateSessionToken();
    const tokenH = hashToken(rawToken);
    const sessionId = `SES-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

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

    // Guardar en memoria
    memorySessions.set(tokenH, session);

    // Si PG está disponible, guardar en tabla auth_sessions
    if (isDbConfigured()) {
      try {
        await query(`
          INSERT INTO auth_sessions (
            id, user_id, token_hash, role, ip_address, user_agent, expires_at, is_revoked, created_at, last_activity_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
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
      } catch (err: any) {
        console.warn('⚠️ No se pudo persistir sesión en PostgreSQL, usando almacenamiento en memoria:', err.message);
      }
    }

    return { token: rawToken, session };
  }

  /**
   * Valida un token provisto y retorna la sesión activa asociada
   */
  async validateToken(rawToken: string): Promise<SessionData | null> {
    if (!rawToken || typeof rawToken !== 'string') return null;

    const tokenH = hashToken(rawToken);

    // 1. Verificar en PostgreSQL si está configurado
    if (isDbConfigured()) {
      try {
        const res = await query(`
          SELECT 
            s.id, s.user_id as "userId", s.role, s.expires_at as "expiresAt",
            s.is_revoked as "isRevoked", s.created_at as "createdAt",
            u.name as "userName", u.is_active as "isActive"
          FROM auth_sessions s
          JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = $1
        `, [tokenH]);

        if (res.rows.length > 0) {
          const row = res.rows[0];
          const expiresAt = new Date(row.expiresAt);

          if (row.isRevoked || !row.isActive || expiresAt.getTime() < Date.now()) {
            return null;
          }

          // Actualizar last_activity_at de forma asíncrona
          query('UPDATE auth_sessions SET last_activity_at = CURRENT_TIMESTAMP WHERE id = $1', [row.id]).catch(() => {});

          return {
            id: row.id,
            userId: row.userId,
            token: rawToken,
            role: row.role as UserRole,
            userName: row.userName,
            createdAt: row.createdAt,
            expiresAt: row.expiresAt,
            isRevoked: false
          };
        }
      } catch (err: any) {
        // En caso de falla en DB, consultar el caché en memoria
      }
    }

    // 2. Verificar en memoria
    const mem = memorySessions.get(tokenH);
    if (!mem) return null;

    const expiresAt = new Date(mem.expiresAt);
    if (mem.isRevoked || expiresAt.getTime() < Date.now()) {
      memorySessions.delete(tokenH);
      return null;
    }

    return mem;
  }

  /**
   * Revoca una sesión específica
   */
  async revokeSession(rawToken: string): Promise<boolean> {
    if (!rawToken) return false;
    const tokenH = hashToken(rawToken);

    const mem = memorySessions.get(tokenH);
    if (mem) {
      mem.isRevoked = true;
      memorySessions.delete(tokenH);
    }

    if (isDbConfigured()) {
      try {
        await query('UPDATE auth_sessions SET is_revoked = TRUE WHERE token_hash = $1', [tokenH]);
        return true;
      } catch {
        return false;
      }
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
      try {
        await query('DELETE FROM auth_sessions WHERE expires_at < CURRENT_TIMESTAMP OR is_revoked = TRUE');
      } catch {}
    }
  }
}

export const sessionManager = new SessionManager();
