/**
 * SGMO — Tequeños Costa
 * PostgreSQL Repository: Users (Con soporte de seguridad, pin_salt y pin_hash)
 */

import { query } from '../connection';
import { UserProfile } from '../../../types';
import { hashPin } from '../../auth/cryptoUtils';

export interface UserAuthRecord extends UserProfile {
  pinHash?: string | null;
  pinSalt?: string | null;
  failedAttempts?: number;
  lockedUntil?: string | null;
}

export class UserRepository {
  /**
   * Obtiene todos los usuarios para administración (omite pin plano y hashes)
   */
  async getAll(): Promise<UserProfile[]> {
    const res = await query(`
      SELECT 
        id, name, email, role, phone, avatar_url as "avatarUrl",
        assigned_house_id as "assignedHouseId", commission_rate::float as "commissionRate",
        housing_cost_exempt as "housingCostExempt", housing_cost_override::float as "housingCostOverride",
        is_active as "isActive", notes, permissions
      FROM users
      ORDER BY name ASC
    `);

    return res.rows.map((r) => ({
      ...r,
      permissions: Array.isArray(r.permissions) ? r.permissions : []
    }));
  }

  /**
   * Obtiene usuario por ID público (sin exponer credenciales)
   */
  async getById(id: string): Promise<UserProfile | null> {
    const res = await query(`
      SELECT 
        id, name, email, role, phone, avatar_url as "avatarUrl",
        assigned_house_id as "assignedHouseId", commission_rate::float as "commissionRate",
        housing_cost_exempt as "housingCostExempt", housing_cost_override::float as "housingCostOverride",
        is_active as "isActive", notes, permissions
      FROM users
      WHERE id = $1
    `, [id]);

    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      ...r,
      permissions: Array.isArray(r.permissions) ? r.permissions : []
    };
  }

  /**
   * Obtiene los datos de autenticación interna de un usuario (para verificación en backend)
   */
  async getAuthRecordById(id: string): Promise<UserAuthRecord | null> {
    const res = await query(`
      SELECT 
        id, name, email, role, phone, pin_hash as "pinHash", pin_salt as "pinSalt",
        failed_attempts as "failedAttempts", locked_until as "lockedUntil",
        avatar_url as "avatarUrl", assigned_house_id as "assignedHouseId",
        commission_rate::float as "commissionRate", housing_cost_exempt as "housingCostExempt",
        housing_cost_override::float as "housingCostOverride", is_active as "isActive",
        notes, permissions
      FROM users
      WHERE id = $1
    `, [id]);

    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      ...r,
      permissions: Array.isArray(r.permissions) ? r.permissions : []
    };
  }

  /**
   * Obtiene todos los registros con credenciales para validación de PIN en backend
   */
  async getAllForAuth(): Promise<UserAuthRecord[]> {
    const res = await query(`
      SELECT 
        id, name, email, role, phone, pin_hash as "pinHash", pin_salt as "pinSalt",
        failed_attempts as "failedAttempts", locked_until as "lockedUntil",
        avatar_url as "avatarUrl", assigned_house_id as "assignedHouseId",
        commission_rate::float as "commissionRate", housing_cost_exempt as "housingCostExempt",
        housing_cost_override::float as "housingCostOverride", is_active as "isActive",
        notes, permissions
      FROM users
      WHERE is_active = TRUE
    `);

    return res.rows.map((r) => ({
      ...r,
      permissions: Array.isArray(r.permissions) ? r.permissions : []
    }));
  }

  /**
   * Crea un usuario aplicando hash y salt al PIN si se suministra
   */
  async create(user: UserProfile & { pin?: string }): Promise<UserProfile> {
    let pinHashToStore: string | null = null;
    let pinSaltToStore: string | null = null;

    if (user.pin && user.pin.trim().length === 4) {
      const hashed = hashPin(user.pin.trim());
      pinHashToStore = hashed.hash;
      pinSaltToStore = hashed.salt;
    }

    await query(`
      INSERT INTO users (
        id, name, email, role, phone, pin_hash, pin_salt, avatar_url,
        assigned_house_id, commission_rate, housing_cost_exempt, housing_cost_override,
        is_active, notes, permissions
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        phone = EXCLUDED.phone,
        pin_hash = COALESCE(EXCLUDED.pin_hash, users.pin_hash),
        pin_salt = COALESCE(EXCLUDED.pin_salt, users.pin_salt),
        commission_rate = EXCLUDED.commission_rate,
        is_active = EXCLUDED.is_active,
        updated_at = CURRENT_TIMESTAMP
    `, [
      user.id,
      user.name,
      user.email || null,
      user.role,
      user.phone || null,
      pinHashToStore,
      pinSaltToStore,
      user.avatarUrl || null,
      user.assignedHouseId || null,
      user.commissionRate,
      user.housingCostExempt || false,
      user.housingCostOverride || null,
      user.isActive,
      user.notes || null,
      JSON.stringify(user.permissions || [])
    ]);

    const { pin, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Actualiza el PIN de un usuario calculando hash y salt
   */
  async updatePin(id: string, newPin: string): Promise<void> {
    const hashed = hashPin(newPin);
    await query(`
      UPDATE users
      SET pin_hash = $1, pin_salt = $2, failed_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [hashed.hash, hashed.salt, id]);
  }

  /**
   * Actualiza datos de un usuario
   */
  async update(id: string, updates: Partial<UserProfile & { pin?: string }>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(updates.name);
    }
    if (updates.email !== undefined) {
      fields.push(`email = $${idx++}`);
      values.push(updates.email);
    }
    if (updates.role !== undefined) {
      fields.push(`role = $${idx++}`);
      values.push(updates.role);
    }
    if (updates.phone !== undefined) {
      fields.push(`phone = $${idx++}`);
      values.push(updates.phone);
    }
    if (updates.pin !== undefined && updates.pin.trim().length === 4) {
      const hashed = hashPin(updates.pin.trim());
      fields.push(`pin_hash = $${idx++}`);
      values.push(hashed.hash);
      fields.push(`pin_salt = $${idx++}`);
      values.push(hashed.salt);
    }
    if (updates.assignedHouseId !== undefined) {
      fields.push(`assigned_house_id = $${idx++}`);
      values.push(updates.assignedHouseId);
    }
    if (updates.commissionRate !== undefined) {
      fields.push(`commission_rate = $${idx++}`);
      values.push(updates.commissionRate);
    }
    if (updates.isActive !== undefined) {
      fields.push(`is_active = $${idx++}`);
      values.push(updates.isActive);
    }
    if (updates.notes !== undefined) {
      fields.push(`notes = $${idx++}`);
      values.push(updates.notes);
    }

    if (fields.length === 0) return;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await query(`
      UPDATE users 
      SET ${fields.join(', ')}
      WHERE id = $${idx}
    `, values);
  }

  /**
   * Registra último login
   */
  async recordSuccessfulLogin(id: string): Promise<void> {
    await query(`
      UPDATE users
      SET failed_attempts = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);
  }
}

export const userRepository = new UserRepository();
