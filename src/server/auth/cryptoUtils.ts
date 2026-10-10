/**
 * SGMO — Tequeños Costa
 * Criptografía y Utilidades de Seguridad para PINs y Tokens
 *
 * Utiliza scrypt y HMAC de Node.js con salt criptográfico.
 * No expone secretos ni almacena PINs en texto plano.
 */

import crypto from 'crypto';

const SALT_ROUNDS_BYTES = 16;
const KEY_LEN = 32;

export interface HashResult {
  hash: string;
  salt: string;
}

/**
 * Genera un hash seguro para un PIN de 4 dígitos utilizando scrypt con salt individual
 */
export function hashPin(pin: string, providedSalt?: string): HashResult {
  const salt = providedSalt || crypto.randomBytes(SALT_ROUNDS_BYTES).toString('hex');
  const derivedKey = crypto.scryptSync(pin, salt, KEY_LEN);
  return {
    hash: derivedKey.toString('hex'),
    salt
  };
}

/**
 * Verifica un PIN ingresado contra un hash y salt almacenados
 * Soporta también verificación de hashes legados de 4 dígitos sin salt durante transición gradual
 */
export function verifyPin(pin: string, storedHash: string, storedSalt?: string | null): boolean {
  if (!pin || !storedHash) return false;

  // Si storedHash es el pin plano legado (longitud 4 o número plano)
  if (storedHash === pin) {
    return true;
  }

  // Si existe salt o el hash es de scrypt (hex 64 chars)
  if (storedSalt) {
    const derivedKey = crypto.scryptSync(pin, storedSalt, KEY_LEN);
    const candidateBuffer = derivedKey;
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (candidateBuffer.length !== storedBuffer.length) return false;
    return crypto.timingSafeEqual(candidateBuffer, storedBuffer);
  }

  // Si no hay salt pero storedHash parece hex de 64 caracteres
  if (storedHash.length === 64) {
    const defaultSalt = 'tequenos_costa_pin_salt_v1';
    const derivedKey = crypto.scryptSync(pin, defaultSalt, KEY_LEN);
    const candidateBuffer = derivedKey;
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (candidateBuffer.length !== storedBuffer.length) return false;
    return crypto.timingSafeEqual(candidateBuffer, storedBuffer);
  }

  return false;
}

/**
 * Genera un token de sesión criptográfico opaco de 256 bits (64 hex)
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Genera el hash SHA-256 del token para almacenar en base de datos
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
