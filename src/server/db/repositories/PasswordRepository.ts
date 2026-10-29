/** Elección/cambio de contraseña y recuperación presencial. Sólo hashes entran en SQL.
 * Locks: tabla users → cuentas ordenadas → activación. Igual orden en todos los flujos.
 * Un código no autentica: únicamente permite elegir contraseña y después exige login normal.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { withTransaction } from '../connection.js';
import { userRepository, type UserAuthRecord } from './UserRepository.js';
import { hashPassword, verifyPassword, verifyPin } from '../../auth/cryptoUtils.js';
import type { SessionData } from '../../auth/sessionManager.js';
import { validateAccountPassword } from '../../../shared/passwordPolicy.js';

export class PasswordFlowError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) { super(message); }
}
const tokenDigest = (value: string) => createHash('sha256').update(value).digest('hex');
const INVALID_ACTIVATION = 'El código no está disponible, venció o ya fue utilizado. Pedí uno nuevo al administrador.';
type Failure = { error: string; message: string; status: number };
const unauthorized = (): Failure => ({ error: 'REAUTHENTICATION_REQUIRED', message: 'No se pudo verificar la credencial actual.', status: 401 });

export class PasswordRepository {
  private async lockUsers(client: PoolClient, userIds: string[]) {
    await client.query('LOCK TABLE users IN ROW EXCLUSIVE MODE');
    await client.query('SELECT id FROM users WHERE id=ANY($1::varchar[]) ORDER BY id FOR UPDATE', [userIds]);
  }
  private async sessionActive(client: PoolClient, session: SessionData): Promise<boolean> {
    const result = await client.query(`SELECT 1 FROM auth_sessions WHERE id=$1 AND user_id=$2 AND role=$3
      AND is_revoked=FALSE AND expires_at>clock_timestamp()`, [session.id, session.userId, session.role]);
    return result.rows.length === 1;
  }
  private verifyCredential(account: UserAuthRecord, credential: string): boolean {
    return account.isProvisioned === true && (account.passwordHash
      ? verifyPassword(credential, account.passwordHash, account.passwordSalt)
      : account.role !== 'admin' && verifyPin(credential, account.pinHash, account.pinSalt));
  }
  private async reauthenticate(client: PoolClient, account: UserAuthRecord | null, credential: string): Promise<Failure | null> {
    if (!account?.isActive) return unauthorized();
    if (account.lockedUntil && new Date(account.lockedUntil).getTime() > Date.now()) {
      return { error: 'ACCOUNT_LOCKED', message: 'Acceso bloqueado temporalmente.', status: 429 };
    }
    if (!this.verifyCredential(account, credential)) {
      // Retornar el error permite COMMIT del contador; lanzar dentro borraría el intento por rollback.
      await userRepository.recordFailedAttempt(account.id, client);
      return unauthorized();
    }
    await userRepository.recordSuccessfulLogin(account.id, client);
    return null;
  }
  private audit(client: PoolClient, actor: UserAuthRecord | null, target: UserAuthRecord, action: string) {
    return client.query(`INSERT INTO audit_logs(id,user_id,user_name,user_role,action,entity_type,entity_id,details)
      VALUES($1,$2,$3,$4,$5,'usuarios',$6,$7)`, [randomUUID(), actor?.id ?? 'INFRASTRUCTURE', actor?.name ?? 'Operador de infraestructura',
      actor?.role ?? 'admin', action, target.id, 'Gestión de credencial personal; sin secretos en auditoría.']);
  }
  private fail(result: Failure): never { throw new PasswordFlowError(result.error, result.message, result.status); }

  /** Requiere administrador reautenticado. El código se muestra una vez y vence en 15 minutos. */
  async issueActivation(targetId: string, administrator: SessionData, currentPassword: string) {
    const result = await withTransaction(async client => {
      await this.lockUsers(client, [administrator.userId, targetId]);
      const actor = await userRepository.getAuthRecordById(administrator.userId, client);
      if (actor?.role !== 'admin' || !await this.sessionActive(client, administrator)) return unauthorized();
      const rejected = await this.reauthenticate(client, actor, currentPassword);
      if (rejected) return rejected;
      const target = await userRepository.getAuthRecordById(targetId, client);
      if (!target?.isActive) return { error: 'USER_UNAVAILABLE', message: 'La cuenta no está disponible.', status: 409 };
      return this.createActivation(client, target, actor);
    });
    if ('error' in result) return this.fail(result);
    return result;
  }
  private async createActivation(client: PoolClient, target: UserAuthRecord, actor: UserAuthRecord | null) {
    const token = randomBytes(32).toString('hex');
    await client.query(`UPDATE auth_password_activations SET revoked_at=clock_timestamp()
      WHERE user_id=$1 AND consumed_at IS NULL AND revoked_at IS NULL`, [target.id]);
    const created = await client.query(`INSERT INTO auth_password_activations(token_hash,user_id,credential_version,issued_by,issuer_credential_version,purpose,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,clock_timestamp()+INTERVAL '15 minutes') RETURNING expires_at`,
      [tokenDigest(token), target.id, target.credentialVersion ?? 0, actor?.id ?? null, actor?.credentialVersion ?? null, target.isProvisioned ? 'recovery' : 'activation']);
    await this.audit(client, actor, target, 'PASSWORD_ACTIVATION_ISSUED');
    const expiresAt = new Date(created.rows[0].expires_at).toISOString();
    return { token, expiresAt };
  }
  /** Exclusiva del CLI de infraestructura. No hay endpoint HTTP que invoque este método. */
  async issueOwnerRecovery(identifier: string) {
    return withTransaction(async client => {
      await client.query('LOCK TABLE users IN ROW EXCLUSIVE MODE');
      const target = await userRepository.getAuthRecordByIdentifier(identifier, client);
      if (!target?.isActive || target.role !== 'admin') throw new PasswordFlowError('USER_UNAVAILABLE', 'Administrador no disponible.', 409);
      return this.createActivation(client, target, null);
    });
  }
  /** Consumo único y escritura/revocación en una transacción. Un reset no devuelve cookie ni sesión. */
  async completeActivation(token: string, newPassword: string): Promise<void> {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new PasswordFlowError('ACTIVATION_UNAVAILABLE', INVALID_ACTIVATION);
    const validation = validateAccountPassword(newPassword);
    if (!validation.isValid) throw new PasswordFlowError('INVALID_PASSWORD', validation.error!);
    const digest = tokenDigest(token);
    await withTransaction(async client => {
      const initial = await client.query('SELECT user_id,issued_by FROM auth_password_activations WHERE token_hash=$1', [digest]);
      if (!initial.rows.length) throw new PasswordFlowError('ACTIVATION_UNAVAILABLE', INVALID_ACTIVATION);
      const { user_id: userId, issued_by: issuerId } = initial.rows[0];
      await this.lockUsers(client, issuerId ? [userId, issuerId] : [userId]);
      const record = await client.query(`SELECT * FROM auth_password_activations WHERE token_hash=$1 AND consumed_at IS NULL
        AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR UPDATE`, [digest]);
      const activation = record.rows[0];
      const target = await userRepository.getAuthRecordById(userId, client);
      const issuer = issuerId ? await userRepository.getAuthRecordById(issuerId, client) : null;
      if (!activation || !target?.isActive || String(target.credentialVersion ?? 0) !== String(activation.credential_version)
          || (issuerId && (!issuer?.isActive || issuer.role !== 'admin' || String(issuer.credentialVersion ?? 0) !== String(activation.issuer_credential_version)))) {
        throw new PasswordFlowError('ACTIVATION_UNAVAILABLE', INVALID_ACTIVATION);
      }
      const policy = validateAccountPassword(newPassword, [target.userCode, target.email]);
      if (!policy.isValid) throw new PasswordFlowError('INVALID_PASSWORD', policy.error!);
      if (this.verifyCredential(target, newPassword)) throw new PasswordFlowError('PASSWORD_REUSED', 'Elegí una contraseña distinta de la actual.');
      const consumed = await client.query(`UPDATE auth_password_activations SET consumed_at=clock_timestamp()
        WHERE token_hash=$1 AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at>clock_timestamp() RETURNING user_id`, [digest]);
      if (consumed.rows.length !== 1) throw new PasswordFlowError('ACTIVATION_UNAVAILABLE', INVALID_ACTIVATION);
      await this.replacePassword(client, target, newPassword);
      await this.audit(client, target, target, 'PASSWORD_ACTIVATION_COMPLETED');
    });
  }
  /** Cambiar clave exige la credencial actual y revoca todas las sesiones, incluida la solicitante. */
  async changePassword(session: SessionData, currentCredential: string, newPassword: string): Promise<void> {
    const validation = validateAccountPassword(newPassword);
    if (!validation.isValid) throw new PasswordFlowError('INVALID_PASSWORD', validation.error!);
    const result = await withTransaction(async client => {
      await this.lockUsers(client, [session.userId]);
      const account = await userRepository.getAuthRecordById(session.userId, client);
      if (!await this.sessionActive(client, session)) return unauthorized();
      const rejected = await this.reauthenticate(client, account, currentCredential);
      if (rejected) return rejected;
      const policy = validateAccountPassword(newPassword, [account!.userCode, account!.email]);
      if (!policy.isValid) return { error: 'INVALID_PASSWORD', message: policy.error!, status: 400 };
      if (this.verifyCredential(account!, newPassword)) return { error: 'PASSWORD_REUSED', message: 'Elegí una contraseña distinta de la actual.', status: 400 };
      await this.replacePassword(client, account!, newPassword);
      await this.audit(client, account, account!, 'PASSWORD_CHANGED');
      return { success: true };
    });
    if ('error' in result) this.fail(result);
  }
  private async replacePassword(client: PoolClient, account: UserAuthRecord, password: string) {
    const credential = hashPassword(password);
    await client.query(`UPDATE users SET password_hash=$2,password_salt=$3,pin_hash=NULL,pin_salt=NULL,
      credential_type='password_12',is_provisioned=TRUE,credential_version=credential_version+1,
      failed_attempts=0,locked_until=NULL,failed_attempt_window_started_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
      [account.id, credential.hash, credential.salt]);
    await client.query('UPDATE auth_sessions SET is_revoked=TRUE WHERE user_id=$1 AND is_revoked=FALSE', [account.id]);
    await client.query(`UPDATE auth_password_activations SET revoked_at=clock_timestamp()
      WHERE user_id=$1 AND consumed_at IS NULL AND revoked_at IS NULL`, [account.id]);
  }
}
export const passwordRepository = new PasswordRepository();
