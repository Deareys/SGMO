import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { validateAccountPassword } from '../../src/shared/passwordPolicy';
import { hashPassword, verifyPassword } from '../../src/server/auth/cryptoUtils';

test('política personal: mínimo 12, máximo 128 y sin mezcla obligatoria de caracteres', () => {
  assert.equal(validateAccountPassword('veleropiedra').isValid, true);
  assert.equal(validateAccountPassword('veleropiedr').isValid, false);
  assert.equal(validateAccountPassword('una frase con espacios').isValid, true);
  assert.equal(validateAccountPassword(randomBytes(64).toString('hex')).isValid, true);
  assert.equal(validateAccountPassword(randomBytes(65).toString('hex')).isValid, false);
  for (const value of [null, undefined, {}, 123456789012]) assert.equal(validateAccountPassword(value).isValid, false);
});

test('rechaza lista local de claves comunes, secuencias, ciclos e identificador de la cuenta', () => {
  for (const password of ['Password1234', 'contraseña123', 'qwertyuiop123', '111111111111', '1234567890123456',
    '0987654321098765', 'ab'.repeat(8), 'abc123'.repeat(3), ' '.repeat(12)]) {
    assert.equal(validateAccountPassword(password).isValid, false, password);
  }
  assert.equal(validateAccountPassword('VENDEDOR12345', ['VENDEDOR']).isValid, false);
  assert.equal(validateAccountPassword('marceloperez12', ['marceloperez@example.invalid']).isValid, false);
  assert.equal(validateAccountPassword('una frase distinta', ['VENDEDOR']).isValid, true);
});

test('cuenta puntos Unicode y conserva el secreto exacto en scrypt, incluidos espacios', () => {
  const password = '🌊🍃🪨⛵🌵🐚🦋🐠🌸🌙🍂☀';
  assert.equal(Array.from(password).length, 12);
  assert.equal(validateAccountPassword(password).isValid, true);
  assert.equal(validateAccountPassword([...password].slice(0, 11).join('')).isValid, false);
  for (const candidate of [password, ' una frase propia ']) {
    const hashed = hashPassword(candidate);
    assert.equal(verifyPassword(candidate, hashed.hash, hashed.salt), true);
    assert.equal(verifyPassword(candidate.normalize('NFKD') + ' ', hashed.hash, hashed.salt), false);
  }
});

test('claves históricas mayores de 128 se verifican pero no se admiten como claves nuevas', () => {
  const legacy = randomBytes(100).toString('hex');
  const hashed = hashPassword(legacy);
  assert.equal(validateAccountPassword(legacy).isValid, false);
  assert.equal(verifyPassword(legacy, hashed.hash, hashed.salt), true);
});
