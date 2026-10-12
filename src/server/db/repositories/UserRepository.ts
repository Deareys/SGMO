/**
 * SGMO — Tequeños Costa
 * PostgreSQL Repository: Users (Con soporte de seguridad, user_code, passwords y PINs scrypt)
 */

import { query } from '../connection';
import { UserProfile } from '../../../types';
import { hashPin, hashPassword, validateWorkerPin, validateAdminPassword } from '../../auth/cryptoUtils';

export interface UserAuthRecord extends UserProfile {
  pinHash?: string | null;
  pinSalt?: string | null;
  passwordHash?: string | null;
  passwordSalt?: string | null;
  credentialType?: string | null;
  isProvisioned?: boolean;
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
        id, user_code as "userCode", name, email, role, phone, avatar_url as "avatarUrl",
        assigned_house_id as "assignedHouseId", commission_rate::float as "commissionRate",
        housing_cost_exempt as "housingCostExempt", housing_cost_override::float as "housingCostOverride",
        is_active as "isActive", notes, permissions,
        (password_hash IS NOT NULL) as "hasPassword"
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
        id, user_code as "userCode", name, email, role, phone, avatar_url as "avatarUrl",
        assigned_house_id as "assignedHouseId", commission_rate::float as "commissionRate",
        housing_cost_exempt as "housingCostExempt", housing_cost_override::float as "housingCostOverride",
        is_active as "isActive", notes, permissions,
        (password_hash IS NOT NULL) as "hasPassword"
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
   * Obtiene usuario por su código único de usuario (ej: 'VEND-01', 'COORD-01', 'ADM-01')
   */
  async getByUserCode(userCode: string): Promise<UserProfile | null> {
    const res = await query(`
      SELECT 
        id, user_code as "userCode", name, email, role, phone, avatar_url as "avatarUrl",
        assigned_house_id as "assignedHouseId", commission_rate::float as "commissionRate",
        housing_cost_exempt as "housingCostExempt", housing_cost_override::float as "housingCostOverride",
        is_active as "isActive", notes, permissions,
        (password_hash IS NOT NULL) as "hasPassword"
      FROM users
      WHERE LOWER(user_code) = LOWER($1)
    `, [userCode.trim()]);

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
        id, user_code as "userCode", name, email, role, phone, 
        pin_hash as "pinHash", pin_salt as "pinSalt",
        password_hash as "passwordHash", password_salt as "passwordSalt",
        credential_type as "credentialType",
        COALESCE(is_provisioned, FALSE) as "isProvisioned",
        failed_attempts as "failedAttempts", locked_until as "lockedUntil",
        avatar_url as "avatarUrl", assigned_house_id as "assignedHouseId",
        commission_rate::float as "commissionRate", housing_cost_exempt as "housingCostExempt",
        housing_cost_override::float as "housingCostOverride", is_active as "isActive",
        notes, permissions,
        (password_hash IS NOT NULL) as "hasPassword"
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
   * Busca registro de autenticación por cualquier identificador único (userCode, email o id)
   */
  async getAuthRecordByIdentifier(identifier: string): Promise<UserAuthRecord | null> {
    const clean = identifier.trim();
    const res = await query(`
      SELECT 
        id, user_code as "userCode", name, email, role, phone, 
        pin_hash as "pinHash", pin_salt as "pinSalt",
        password_hash as "passwordHash", password_salt as "passwordSalt",
        credential_type as "credentialType",
        COALESCE(is_provisioned, FALSE) as "isProvisioned",
        failed_attempts as "failedAttempts", locked_until as "lockedUntil",
        avatar_url as "avatarUrl", assigned_house_id as "assignedHouseId",
        commission_rate::float as "commissionRate", housing_cost_exempt as "housingCostExempt",
        housing_cost_override::float as "housingCostOverride", is_active as "isActive",
        notes, permissions,
        (password_hash IS NOT NULL) as "hasPassword"
      FROM users
      WHERE LOWER(user_code) = LOWER($1) 
         OR LOWER(email) = LOWER($1)
         OR id = $1
      LIMIT 1
    `, [clean]);

    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      ...r,
      permissions: Array.isArray(r.permissions) ? r.permissions : []
    };
  }

  /**
   * Obtiene todos los registros con credenciales para validación de autenticación en backend
   */
  async getAllForAuth(): Promise<UserAuthRecord[]> {
    const res = await query(`
      SELECT 
        id, user_code as "userCode", name, email, role, phone, 
        pin_hash as "pinHash", pin_salt as "pinSalt",
        password_hash as "passwordHash", password_salt as "passwordSalt",
        credential_type as "credentialType",
        failed_attempts as "failedAttempts", locked_until as "lockedUntil",
        avatar_url as "avatarUrl", assigned_house_id as "assignedHouseId",
        commission_rate::float as "commissionRate", housing_cost_exempt as "housingCostExempt",
        housing_cost_override::float as "housingCostOverride", is_active as "isActive",
        notes, permissions,
        (password_hash IS NOT NULL) as "hasPassword"
      FROM users
      WHERE is_active = TRUE
    `);

    return res.rows.map((r) => ({
      ...r,
      permissions: Array.isArray(r.permissions) ? r.permissions : []
    }));
  }

  /**
   * Crea un usuario aplicando hash y salt criptográfico a sus credenciales
   */
  async create(user: UserProfile & { pin?: string; password?: string }): Promise<UserProfile> {
    let pinHashToStore: string | null = null;
    let pinSaltToStore: string | null = null;
    let passwordHashToStore: string | null = null;
    let passwordSaltToStore: string | null = null;
    let credentialType = user.role === 'admin' ? 'password_14' : 'pin_8';

    if (user.role === 'admin' && user.password) {
      const val = validateAdminPassword(user.password);
      if (!val.isValid) throw new Error(val.error);
      const hashed = hashPassword(user.password);
      passwordHashToStore = hashed.hash;
      passwordSaltToStore = hashed.salt;
    } else if (user.pin) {
      const pinTrimmed = user.pin.trim();
      // Si tiene 8 dígitos validar seguridad estricta
      if (pinTrimmed.length === 8) {
        const val = validateWorkerPin(pinTrimmed);
        if (!val.isValid) throw new Error(val.error);
      }
      const hashed = hashPin(pinTrimmed);
      pinHashToStore = hashed.hash;
      pinSaltToStore = hashed.salt;
    }

    await query(`
      INSERT INTO users (
        id, user_code, name, email, role, phone, pin_hash, pin_salt,
        password_hash, password_salt, credential_type,
        avatar_url, assigned_house_id, commission_rate, housing_cost_exempt,
        housing_cost_override, is_active, notes, permissions
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
      ON CONFLICT (id) DO UPDATE SET
        user_code = COALESCE(EXCLUDED.user_code, users.user_code),
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        phone = EXCLUDED.phone,
        pin_hash = COALESCE(EXCLUDED.pin_hash, users.pin_hash),
        pin_salt = COALESCE(EXCLUDED.pin_salt, users.pin_salt),
        password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
        password_salt = COALESCE(EXCLUDED.password_salt, users.password_salt),
        commission_rate = EXCLUDED.commission_rate,
        is_active = EXCLUDED.is_active,
        updated_at = CURRENT_TIMESTAMP
    `, [
      user.id,
      user.userCode || null,
      user.name,
      user.email || null,
      user.role,
      user.phone || null,
      pinHashToStore,
      pinSaltToStore,
      passwordHashToStore,
      passwordSaltToStore,
      credentialType,
      user.avatarUrl || null,
      user.assignedHouseId || null,
      user.commissionRate,
      user.housingCostExempt || false,
      user.housingCostOverride || null,
      user.isActive,
      user.notes || null,
      JSON.stringify(user.permissions || [])
    ]);

    const { pin, password, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Actualiza el PIN de un usuario calculando hash y salt
   */
  async updatePin(id: string, newPin: string): Promise<void> {
    const cleanPin = newPin.trim();
    if (cleanPin.length === 8) {
      const val = validateWorkerPin(cleanPin);
      if (!val.isValid) throw new Error(val.error);
    }
    const hashed = hashPin(cleanPin);
    await query(`
      UPDATE users
      SET pin_hash = $1, pin_salt = $2, failed_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [hashed.hash, hashed.salt, id]);
  }

  /**
   * Actualiza la contraseña de un Administrador calculando hash y salt scrypt
   */
  async updatePassword(id: string, newPassword: string): Promise<void> {
    const val = validateAdminPassword(newPassword);
    if (!val.isValid) throw new Error(val.error);
    const hashed = hashPassword(newPassword);
    await query(`
      UPDATE users
      SET password_hash = $1, password_salt = $2, failed_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [hashed.hash, hashed.salt, id]);
  }

  /**
   * Actualiza datos y/o credenciales de un usuario
   */
  async update(id: string, updates: Partial<UserProfile & { pin?: string; password?: string }>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.userCode !== undefined) {
      fields.push(`user_code = $${idx++}`);
      values.push(updates.userCode.trim());
    }
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
    if (updates.pin !== undefined) {
      const cleanPin = updates.pin.trim();
      if (cleanPin.length === 8) {
        const val = validateWorkerPin(cleanPin);
        if (!val.isValid) throw new Error(val.error);
      }
      const hashed = hashPin(cleanPin);
      fields.push(`pin_hash = $${idx++}`);
      values.push(hashed.hash);
      fields.push(`pin_salt = $${idx++}`);
      values.push(hashed.salt);
    }
    if (updates.password !== undefined) {
      const val = validateAdminPassword(updates.password);
      if (!val.isValid) throw new Error(val.error);
      const hashed = hashPassword(updates.password);
      fields.push(`password_hash = $${idx++}`);
      values.push(hashed.hash);
      fields.push(`password_salt = $${idx++}`);
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
   * Registra último login y resetea intentos fallidos
   */
  async recordSuccessfulLogin(id: string): Promise<void> {
    await query(`
      UPDATE users
      SET failed_attempts = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);
  }

  /**
   * Registra un intento fallido en base de datos de forma atómica y bloquea si excede el umbral
   */
  async recordFailedAttempt(id: string): Promise<{ failedAttempts: number; isLocked: boolean; lockedUntil: string | null }> {
    const res = await query(`
      UPDATE users
      SET failed_attempts = COALESCE(failed_attempts, 0) + 1,
          locked_until = CASE 
            WHEN COALESCE(failed_attempts, 0) + 1 >= 5 THEN CURRENT_TIMESTAMP + INTERVAL '15 minutes'
            ELSE NULL 
          END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING failed_attempts as "failedAttempts", locked_until as "lockedUntil"
    `, [id]);

    if (res.rows.length === 0) {
      return { failedAttempts: 1, isLocked: false, lockedUntil: null };
    }

    const row = res.rows[0];
    const isLocked = Boolean(row.lockedUntil && new Date(row.lockedUntil).getTime() > Date.now());
    return {
      failedAttempts: row.failedAttempts,
      isLocked,
      lockedUntil: row.lockedUntil
    };
  }
}

export const userRepository = new UserRepository();
