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

// Lista negra de PINs comunes o predecibles de 8 dígitos
const COMMON_PREDICTABLE_PINS = new Set([
  '12345678',
  '87654321',
  '01234567',
  '76543210',
  '23456789',
  '98765432',
  '00000000',
  '11111111',
  '22222222',
  '33333333',
  '44444444',
  '55555555',
  '66666666',
  '77777777',
  '88888888',
  '99999999',
  '11223344',
  '22334455',
  '33445566',
  '44556677',
  '12121212',
  '13131313',
  '14141414',
  '12341234',
  '12344321',
  '43211234',
  '13572468',
  '24681357',
  '87651234',
  '11112222',
  '22221111',
  '00001111'
]);

/**
 * Valida un PIN de trabajador contra las reglas de seguridad:
 * - Debe tener exactamente 8 dígitos numéricos.
 * - Rechaza secuencias ascendentes o descendentes (12345678, 87654321, etc.).
 * - Rechaza repetición continua de dígitos (11111111, 44444444).
 * - Rechaza 4 o más dígitos idénticos consecutivos.
 * - Rechaza patrones alternantes o repetitivos (12121212, 12341234, 11223344).
 * - Rechaza PINs comunes o predecibles conocidos.
 */
export function validateWorkerPin(pin: string): { isValid: boolean; error?: string } {
  if (!pin || typeof pin !== 'string') {
    return { isValid: false, error: 'El PIN es obligatorio y debe ser numérico.' };
  }

  const clean = pin.trim();

  if (!/^\d{8}$/.test(clean)) {
    return {
      isValid: false,
      error: `El PIN debe tener exactamente 8 dígitos numéricos (actual: ${clean.length} caracteres).`
    };
  }

  if (COMMON_PREDICTABLE_PINS.has(clean)) {
    return {
      isValid: false,
      error: 'El PIN ingresado es un patrón común o predecible no permitido por seguridad.'
    };
  }

  // 1. Rechazar todos los dígitos idénticos (ej: 00000000, 77777777)
  if (/^(\d)\1{7}$/.test(clean)) {
    return {
      isValid: false,
      error: 'El PIN no puede estar formado por el mismo dígito repetido.'
    };
  }

  // 2. Rechazar 4 o más dígitos idénticos consecutivos (ej: 98111142)
  if (/(\d)\1{3,}/.test(clean)) {
    return {
      isValid: false,
      error: 'El PIN no puede contener 4 o más dígitos idénticos consecutivos.'
    };
  }

  // 3. Rechazar patrones de 2 dígitos repetidos (ej: 12121212)
  if (/^(\d{2})\1{3}$/.test(clean)) {
    return {
      isValid: false,
      error: 'El PIN no puede ser una secuencia repetitiva de dos dígitos.'
    };
  }

  // 4. Rechazar patrones de 4 dígitos repetidos (ej: 12341234)
  if (/^(\d{4})\1$/.test(clean)) {
    return {
      isValid: false,
      error: 'El PIN no puede ser un patrón duplicado de 4 dígitos.'
    };
  }

  // 5. Rechazar parejas de dígitos idénticos (ej: 11223344)
  if (/^(\d)\1(\d)\2(\d)\3(\d)\4$/.test(clean)) {
    return {
      isValid: false,
      error: 'El PIN no puede ser una serie de pares repetidos (ej: 11223344).'
    };
  }

  // 6. Rechazar secuencias aritméticas ascendentes (ej: 01234567, 12345678, 23456789)
  let isAscending = true;
  for (let i = 1; i < 8; i++) {
    const prev = parseInt(clean[i - 1], 10);
    const curr = parseInt(clean[i], 10);
    if ((prev + 1) % 10 !== curr) {
      isAscending = false;
      break;
    }
  }
  if (isAscending) {
    return {
      isValid: false,
      error: 'El PIN no puede ser una secuencia numérica ascendente continua.'
    };
  }

  // 7. Rechazar secuencias aritméticas descendentes (ej: 98765432, 87654321, 76543210)
  let isDescending = true;
  for (let i = 1; i < 8; i++) {
    const prev = parseInt(clean[i - 1], 10);
    const curr = parseInt(clean[i], 10);
    if ((prev - 1 + 10) % 10 !== curr) {
      isDescending = false;
      break;
    }
  }
  if (isDescending) {
    return {
      isValid: false,
      error: 'El PIN no puede ser una secuencia numérica descendente continua.'
    };
  }

  return { isValid: true };
}

/**
 * Valida la contraseña de un Administrador:
 * - Longitud mínima de 14 caracteres.
 * - Debe contener mayúsculas, minúsculas y al menos un número o símbolo.
 */
export function validateAdminPassword(password: string): { isValid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { isValid: false, error: 'La contraseña es obligatoria.' };
  }

  if (password.length < 14) {
    return {
      isValid: false,
      error: `La contraseña de administrador debe tener al menos 14 caracteres (actual: ${password.length}).`
    };
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumberOrSymbol = /[0-9\W_]/.test(password);

  if (!hasUpper || !hasLower || !hasNumberOrSymbol) {
    return {
      isValid: false,
      error: 'La contraseña debe incluir mayúsculas, minúsculas y al menos un número o símbolo especial.'
    };
  }

  return { isValid: true };
}

/**
 * Genera un hash seguro para un PIN de 8 dígitos utilizando scrypt con salt individual
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
 * Genera un hash seguro para una contraseña de Administrador utilizando scrypt con salt individual
 */
export function hashPassword(password: string, providedSalt?: string): HashResult {
  const salt = providedSalt || crypto.randomBytes(SALT_ROUNDS_BYTES).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, KEY_LEN);
  return {
    hash: derivedKey.toString('hex'),
    salt
  };
}

/**
 * Verifica una contraseña de Administrador contra hash y salt almacenados con comparación en tiempo constante
 * REGLA ESTRICTA (Hito 1.2.1):
 * - Requiere obligatoriamente hash scrypt y salt individual.
 * - Rechaza terminantemente cualquier valor en texto plano o sin hash.
 */
export function verifyPassword(password: string, storedHash?: string | null, storedSalt?: string | null): boolean {
  if (!password || !storedHash || !storedSalt) return false;

  // El hash debe ser un hash scrypt hexadecimal válido de 32 bytes (64 caracteres)
  if (typeof storedHash !== 'string' || storedHash.length !== KEY_LEN * 2) {
    return false;
  }
  if (typeof storedSalt !== 'string' || storedSalt.length < 16) {
    return false;
  }

  try {
    const derivedKey = crypto.scryptSync(password, storedSalt, KEY_LEN);
    const candidateBuffer = derivedKey;
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (candidateBuffer.length !== storedBuffer.length) return false;
    return crypto.timingSafeEqual(candidateBuffer, storedBuffer);
  } catch {
    return false;
  }
}

/**
 * Verifica un PIN ingresado contra un hash y salt almacenados con comparación en tiempo constante
 * REGLA ESTRICTA (Hito 1.2.1):
 * - Rechaza terminantemente cualquier coincidencia en texto plano (storedHash === pin).
 * - Rechaza hashes legados o no aprovisionados sin salt individual.
 * - Requiere formato de PIN de exactamente 8 dígitos.
 */
export function verifyPin(pin: string, storedHash?: string | null, storedSalt?: string | null): boolean {
  if (!pin || !storedHash || !storedSalt) return false;

  const cleanPin = pin.trim();
  if (!/^\d{8}$/.test(cleanPin)) {
    return false;
  }

  // El hash debe ser un hash scrypt hexadecimal válido de 32 bytes (64 caracteres)
  if (typeof storedHash !== 'string' || storedHash.length !== KEY_LEN * 2) {
    return false;
  }
  if (typeof storedSalt !== 'string' || storedSalt.length < 16) {
    return false;
  }

  try {
    const derivedKey = crypto.scryptSync(cleanPin, storedSalt, KEY_LEN);
    const candidateBuffer = derivedKey;
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (candidateBuffer.length !== storedBuffer.length) return false;
    return crypto.timingSafeEqual(candidateBuffer, storedBuffer);
  } catch {
    return false;
  }
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
