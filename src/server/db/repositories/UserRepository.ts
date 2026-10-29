/**
 * SGMO — Tequeños Costa
 * PostgreSQL Repository: Users (Con soporte de seguridad, user_code, passwords y PINs scrypt)
 */

import { query, withTransaction } from '../connection.js';
import type { PoolClient } from 'pg';
import { createHash } from 'crypto';
import { UserProfile } from '../../../types';
import { DataIntegrityError } from '../salesValidation.js';
import { hashPin, hashPassword, validateWorkerPin } from '../../auth/cryptoUtils.js';
import { validateAccountPassword } from '../../../shared/passwordPolicy.js';

export interface UserAuthRecord extends UserProfile {
  pinHash?: string | null;
  pinSalt?: string | null;
  passwordHash?: string | null;
  passwordSalt?: string | null;
  credentialType?: string | null;
  credentialVersion?: string | number;
  isProvisioned?: boolean;
  failedAttempts?: number;
  lockedUntil?: string | null;
  failedAttemptWindowStartedAt?: string | null;
}

/** Errores de entrada pública distinguibles de errores de infraestructura (HTTP 400). */
export class UserCredentialValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserCredentialValidationError';
  }
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
        COALESCE(is_provisioned, FALSE) as "isProvisioned",
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
        COALESCE(is_provisioned, FALSE) as "isProvisioned",
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
        COALESCE(is_provisioned, FALSE) as "isProvisioned",
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
  async getAuthRecordById(id: string, client?: PoolClient): Promise<UserAuthRecord | null> {
    const execute = client ? client.query.bind(client) : query;
    const res = await execute(`
      SELECT 
        id, user_code as "userCode", name, email, role, phone, 
        pin_hash as "pinHash", pin_salt as "pinSalt",
        password_hash as "passwordHash", password_salt as "passwordSalt",
        credential_type as "credentialType", credential_version as "credentialVersion",
        COALESCE(is_provisioned, FALSE) as "isProvisioned",
        failed_attempts as "failedAttempts", locked_until as "lockedUntil",
        failed_attempt_window_started_at as "failedAttemptWindowStartedAt",
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
  async getAuthRecordByIdentifier(identifier: string, client?: PoolClient): Promise<UserAuthRecord | null> {
    const clean = identifier.trim();
    const execute = client ? client.query.bind(client) : query;
    const res = await execute(`
      SELECT 
        id, user_code as "userCode", name, email, role, phone, 
        pin_hash as "pinHash", pin_salt as "pinSalt",
        password_hash as "passwordHash", password_salt as "passwordSalt",
        credential_type as "credentialType", credential_version as "credentialVersion",
        COALESCE(is_provisioned, FALSE) as "isProvisioned",
        failed_attempts as "failedAttempts", locked_until as "lockedUntil",
        failed_attempt_window_started_at as "failedAttemptWindowStartedAt",
        avatar_url as "avatarUrl", assigned_house_id as "assignedHouseId",
        commission_rate::float as "commissionRate", housing_cost_exempt as "housingCostExempt",
        housing_cost_override::float as "housingCostOverride", is_active as "isActive",
        notes, permissions,
        (password_hash IS NOT NULL) as "hasPassword"
      FROM users
      WHERE LOWER(user_code) = LOWER($1) 
         OR LOWER(BTRIM(email)) = LOWER($1)
         OR id = $1
      ${client ? 'FOR UPDATE' : ''}
    `, [clean]);

    // An ambiguous email/code/id must never choose a different account implicitly.
    if (res.rows.length !== 1) return null;
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
        failed_attempt_window_started_at as "failedAttemptWindowStartedAt",
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
    this.validateRole(user.role);
    if (typeof user.isActive !== 'boolean') throw new UserCredentialValidationError('El estado activo debe ser booleano.');
    const userCode = user.userCode === undefined ? 'USR-' + createHash('md5').update(user.id).digest('hex').slice(0, 24) : this.validateUserCode(user.userCode);
    const email = this.normalizeEmail(user.email);
    const name = this.validateName(user.name);
    const credential = this.prepareCredential(user.role, user.pin, user.password, [userCode, email]);
    const credentialType = credential.credentialType;

    await withTransaction(async (client) => {
      await client.query('LOCK TABLE users IN ROW EXCLUSIVE MODE');
      const existing = await client.query('SELECT role FROM users WHERE id = $1 FOR UPDATE', [user.id]);
      if (existing.rows.length) throw new DataIntegrityError('USER_ID_EXISTS', 'El usuario ya existe. Usá la edición autorizada del perfil.', 409);
      // INSERT únicamente: un alta no puede eludir controles de una edición financiera.
      await client.query(`
        INSERT INTO users (
          id, user_code, name, email, role, phone, pin_hash, pin_salt,
          password_hash, password_salt, credential_type, is_provisioned,
          avatar_url, assigned_house_id, commission_rate, housing_cost_exempt,
          housing_cost_override, is_active, notes, permissions
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        )
      `, [
        user.id,
        userCode,
        name,
        email,
        user.role,
        user.phone || null,
        credential.pinHash,
        credential.pinSalt,
        credential.passwordHash,
        credential.passwordSalt,
        credentialType,
        credential.isProvisioned,
        user.avatarUrl || null,
        user.assignedHouseId || null,
        user.commissionRate,
        user.housingCostExempt || false,
        user.housingCostOverride ?? null,
        user.isActive,
        user.notes || null,
        JSON.stringify(user.permissions || [])
      ]);

      // El alta y la revocación siguen siendo atómicas; conflictos concurrentes revierten la inserción.
      await this.revokeUserSessions(client, user.id);
    });

    // Return only selected public columns, never arbitrary client input or credential fields.
    const safeUser = await this.getById(user.id);
    if (!safeUser) throw new Error('No se pudo recuperar el usuario creado.');
    return safeUser;
  }

  /**
   * Actualiza el PIN de un usuario calculando hash y salt
   */
  async updatePin(id: string, newPin: string): Promise<void> {
    await this.update(id, { pin: newPin });
  }

  /** Actualiza contraseña, estado de aprovisionamiento y revoca sesiones atómicamente. */
  async updatePassword(id: string, newPassword: string): Promise<void> {
    await this.update(id, { password: newPassword });
  }

  /**
   * Alta inicial única: la ruta debe exigir siempre BOOTSTRAP_SECRET de infraestructura.
   * El lock de tabla impide que otra operación provisione un administrador entre
   * la comprobación global y la escritura; el advisory lock serializa dos bootstraps.
   * No sirve como restablecimiento o reapertura de un administrador existente.
   */
  async bootstrapInitialAdmin(identifier: string, password: string, owner?: { name: string; email: string }): Promise<boolean> {
    if (owner && (typeof owner.name !== 'string' || !owner.name.trim() || owner.name.trim().length > 120
        || typeof owner.email !== 'string' || owner.email.trim().length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner.email.trim()))) {
      throw new UserCredentialValidationError('Nombre o correo del propietario inválidos.');
    }
    const credential = this.prepareCredential('admin', undefined, password, [identifier, owner?.email]);
    return withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('sgmo.initial-admin'))");
      await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
      const provisioned = await client.query("SELECT 1 FROM users WHERE role = 'admin' AND is_provisioned = TRUE LIMIT 1");
      if (provisioned.rows.length) return false;
      const administrator = await this.getAuthRecordByIdentifier(identifier, client);
      if (!administrator || administrator.role !== 'admin' || !administrator.isActive || administrator.isProvisioned) return false;
      await client.query(`
        UPDATE users SET password_hash = $1, password_salt = $2,
          pin_hash = NULL, pin_salt = NULL, credential_type = 'password_12',
          is_provisioned = TRUE, failed_attempts = 0, locked_until = NULL,
          failed_attempt_window_started_at = NULL, updated_at = CURRENT_TIMESTAMP,
          name = COALESCE($4, name), email = COALESCE($5, email)
        WHERE id = $3
      `, [credential.passwordHash, credential.passwordSalt, administrator.id, owner?.name.trim() ?? null, owner ? this.normalizeEmail(owner.email) : null]);
      await this.revokeUserSessions(client, administrator.id);
      return true;
    });
  }

  /**
   * Actualiza datos y/o credenciales de un usuario
   */
  async update(id: string, updates: Partial<UserProfile & { pin?: string; password?: string }>): Promise<void> {
    if (updates.isActive !== undefined && typeof updates.isActive !== 'boolean') {
      throw new UserCredentialValidationError('El estado activo debe ser booleano.');
    }
    if (updates.email !== undefined) this.normalizeEmail(updates.email);
    if (updates.name !== undefined) this.validateName(updates.name);
    const financialInput = updates.commissionRate !== undefined || updates.housingCostExempt !== undefined || updates.housingCostOverride !== undefined || updates.assignedHouseId !== undefined;
    if (updates.commissionRate !== undefined && (typeof updates.commissionRate !== 'number' || !Number.isFinite(updates.commissionRate) || updates.commissionRate < 0 || updates.commissionRate > 1 || Math.abs(updates.commissionRate * 10000 - Math.round(updates.commissionRate * 10000)) > 0.00001)) throw new DataIntegrityError('INVALID_COMMISSION_RATE', 'Comisión inválida.');
    if (updates.housingCostExempt !== undefined && typeof updates.housingCostExempt !== 'boolean') throw new DataIntegrityError('INVALID_HOUSING_EXEMPTION', 'Exención de vivienda inválida.');
    if (updates.housingCostOverride !== undefined && (typeof updates.housingCostOverride !== 'number' || !Number.isFinite(updates.housingCostOverride) || updates.housingCostOverride < 0 || updates.housingCostOverride > 9999999999.99 || Math.abs(updates.housingCostOverride * 100 - Math.round(updates.housingCostOverride * 100)) > 0.00001)) throw new DataIntegrityError('INVALID_HOUSING_COST', 'Costo de vivienda inválido.');
    await withTransaction(async (client) => {
      // Shared with dispatch/configuration: cannot open a shift between checking
      // active shifts and changing a worker's settlement inputs.
      if (financialInput) await client.query("SELECT pg_advisory_xact_lock(hashtext('sgmo_financial_configuration'))");
      await client.query('LOCK TABLE users IN ROW EXCLUSIVE MODE');
      const current = await client.query('SELECT role, is_active, commission_rate, housing_cost_exempt, housing_cost_override, assigned_house_id, user_code, email FROM users WHERE id = $1 FOR UPDATE', [id]);
      if (!current.rows.length) throw new UserCredentialValidationError('Usuario no disponible.');
      const previous = current.rows[0];
      const financialChanged = (updates.commissionRate !== undefined && updates.commissionRate !== Number(previous.commission_rate))
        || (updates.housingCostExempt !== undefined && updates.housingCostExempt !== previous.housing_cost_exempt)
        || (updates.housingCostOverride !== undefined && updates.housingCostOverride !== (previous.housing_cost_override === null ? null : Number(previous.housing_cost_override)))
        || (updates.assignedHouseId !== undefined && updates.assignedHouseId !== (previous.assigned_house_id || ''));
      if (financialChanged) {
        const open = await client.query("SELECT 1 FROM daily_shifts WHERE status IN ('planificada','en_curso','esperando_cierre') LIMIT 1");
        if (open.rowCount) throw new DataIntegrityError('FINANCIAL_POLICY_LOCKED', 'Sincronizá y cerrá las jornadas abiertas antes de cambiar comisiones, vivienda o asignaciones.', 409);
      }
      const role = updates.role ?? current.rows[0].role;
      this.validateRole(role);
      const roleChanged = role !== current.rows[0].role;
      const credential = this.prepareCredential(role, updates.pin, updates.password,
        [updates.userCode ?? previous.user_code, updates.email ?? previous.email]);
      const fields: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (updates.userCode !== undefined) {
        fields.push(`user_code = $${idx++}`);
        values.push(this.validateUserCode(updates.userCode));
      }
      if (updates.name !== undefined) {
        fields.push(`name = $${idx++}`);
        values.push(this.validateName(updates.name));
      }
      if (updates.email !== undefined) {
        fields.push(`email = $${idx++}`);
        values.push(this.normalizeEmail(updates.email));
      }
      if (updates.role !== undefined) {
        fields.push(`role = $${idx++}`);
        values.push(updates.role);
      }
      if (updates.phone !== undefined) {
        fields.push(`phone = $${idx++}`);
        values.push(updates.phone);
      }
      if (roleChanged || credential.isProvisioned) {
        fields.push(`pin_hash = $${idx++}`, `pin_salt = $${idx++}`,
          `password_hash = $${idx++}`, `password_salt = $${idx++}`,
          `credential_type = $${idx++}`, `is_provisioned = $${idx++}`);
        values.push(credential.pinHash, credential.pinSalt, credential.passwordHash,
          credential.passwordSalt, credential.credentialType, credential.isProvisioned);
        fields.push('failed_attempts = 0', 'locked_until = NULL', 'failed_attempt_window_started_at = NULL');
      }
      if (updates.assignedHouseId !== undefined) {
        fields.push(`assigned_house_id = $${idx++}`);
        values.push(updates.assignedHouseId);
      }
      if (updates.commissionRate !== undefined) {
        fields.push(`commission_rate = $${idx++}`);
        values.push(updates.commissionRate);
      }
      if (updates.housingCostExempt !== undefined) {
        fields.push(`housing_cost_exempt = $${idx++}`);
        values.push(updates.housingCostExempt);
      }
      if (updates.housingCostOverride !== undefined) {
        fields.push(`housing_cost_override = $${idx++}`);
        values.push(updates.housingCostOverride);
      }
      if (updates.isActive !== undefined) {
        fields.push(`is_active = $${idx++}`);
        values.push(updates.isActive);
      }
      if (updates.notes !== undefined) {
        fields.push(`notes = $${idx++}`);
        values.push(updates.notes);
      }
      if (updates.permissions !== undefined) {
        fields.push(`permissions = $${idx++}`);
        values.push(JSON.stringify(updates.permissions));
      }

      if (fields.length === 0) return;

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      await client.query(`
        UPDATE users
        SET ${fields.join(', ')}
        WHERE id = $${idx}
      `, values);
      if (roleChanged || credential.isProvisioned || updates.isActive === false || updates.permissions !== undefined) {
        await this.revokeUserSessions(client, id);
      }
    });
  }

  private validateUserCode(userCode: string): string {
    if (typeof userCode !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(userCode.trim())) {
      throw new UserCredentialValidationError('El código de usuario debe tener entre 1 y 32 caracteres alfanuméricos, guiones o guiones bajos.');
    }
    return userCode.trim();
  }

  /** Correo opcional: se normaliza antes de persistir; el índice SQL resuelve altas concurrentes. */
  private normalizeEmail(email?: string | null): string | null {
    if (email === undefined || email === null || email === '') return null;
    if (typeof email !== 'string') throw new UserCredentialValidationError('Correo electrónico inválido.');
    const normalized = email.trim().toLowerCase();
    if (!normalized) return null;
    if (normalized.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new UserCredentialValidationError('Correo electrónico inválido.');
    }
    return normalized;
  }

  private validateName(name: string): string {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
      throw new UserCredentialValidationError('El nombre debe tener entre 1 y 120 caracteres.');
    }
    return name.trim();
  }

  private validateRole(role: UserProfile['role']): void {
    if (!['admin', 'coordinator', 'seller', 'factory_worker'].includes(role)) {
      throw new UserCredentialValidationError('Rol de usuario inválido.');
    }
  }

  /** Valida toda escritura; ausencia de credencial implica cuenta sin aprovisionar. */
  private prepareCredential(role: UserProfile['role'], pin?: string, password?: string, identifiers: Array<string | null | undefined> = []) {
    if ((role === 'admin' && pin !== undefined) || (pin !== undefined && password !== undefined)) {
      throw new UserCredentialValidationError('El tipo de credencial no corresponde al rol.');
    }
    const credential = {
      pinHash: null as string | null, pinSalt: null as string | null,
      passwordHash: null as string | null, passwordSalt: null as string | null,
      isProvisioned: false,
      credentialType: password !== undefined || role === 'admin' ? 'password_12' : 'pin_8'
    };
    if (pin !== undefined) {
      const validation = validateWorkerPin(pin);
      if (!validation.isValid) throw new UserCredentialValidationError(validation.error ?? 'Credencial inválida.');
      const hashed = hashPin(pin.trim());
      credential.pinHash = hashed.hash;
      credential.pinSalt = hashed.salt;
      credential.isProvisioned = true;
    }
    if (password !== undefined) {
      const validation = validateAccountPassword(password, identifiers);
      if (!validation.isValid) throw new UserCredentialValidationError(validation.error ?? 'Credencial inválida.');
      const hashed = hashPassword(password);
      credential.passwordHash = hashed.hash;
      credential.passwordSalt = hashed.salt;
      credential.isProvisioned = true;
    }
    return credential;
  }

  private async revokeUserSessions(client: PoolClient, id: string): Promise<void> {
    await client.query('UPDATE auth_sessions SET is_revoked = TRUE WHERE user_id = $1 AND is_revoked = FALSE', [id]);
    await client.query('UPDATE users SET credential_version=credential_version+1 WHERE id=$1', [id]);
    await client.query('UPDATE auth_password_activations SET revoked_at=clock_timestamp() WHERE user_id=$1 AND consumed_at IS NULL AND revoked_at IS NULL', [id]);
  }

  /**
   * Registra último login y resetea intentos fallidos
   */
  async recordSuccessfulLogin(id: string, client?: PoolClient): Promise<void> {
    const execute = client ? client.query.bind(client) : query;
    await execute(`
      UPDATE users
      SET failed_attempts = 0, locked_until = NULL, failed_attempt_window_started_at = NULL, last_login_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);
  }

  /**
   * Registra un intento fallido en base de datos de forma atómica y bloquea si excede el umbral
   */
  async recordFailedAttempt(id: string, client?: PoolClient): Promise<{ failedAttempts: number; isLocked: boolean; lockedUntil: string | null }> {
    const execute = client ? client.query.bind(client) : query;
    const res = await execute(`
      UPDATE users
      SET failed_attempts = CASE
            WHEN locked_until > CURRENT_TIMESTAMP THEN failed_attempts
            WHEN locked_until IS NOT NULL OR failed_attempt_window_started_at IS NULL
              OR failed_attempt_window_started_at <= CURRENT_TIMESTAMP - INTERVAL '15 minutes' THEN 1
            ELSE COALESCE(failed_attempts, 0) + 1 END,
          locked_until = CASE
            WHEN locked_until > CURRENT_TIMESTAMP THEN locked_until
            WHEN locked_until IS NOT NULL OR failed_attempt_window_started_at IS NULL
              OR failed_attempt_window_started_at <= CURRENT_TIMESTAMP - INTERVAL '15 minutes' THEN NULL
            WHEN COALESCE(failed_attempts, 0) + 1 >= 5 THEN CURRENT_TIMESTAMP + INTERVAL '15 minutes'
            ELSE NULL END,
          failed_attempt_window_started_at = CASE
            WHEN locked_until > CURRENT_TIMESTAMP THEN failed_attempt_window_started_at
            WHEN locked_until IS NOT NULL OR failed_attempt_window_started_at IS NULL
              OR failed_attempt_window_started_at <= CURRENT_TIMESTAMP - INTERVAL '15 minutes' THEN CURRENT_TIMESTAMP
            ELSE failed_attempt_window_started_at END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING failed_attempts as "failedAttempts", locked_until as "lockedUntil"
    `, [id]);

    if (res.rows.length === 0) {
      throw new Error('Usuario no disponible para registrar intento.');
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
