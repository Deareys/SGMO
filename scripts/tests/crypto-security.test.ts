import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  generateSessionToken, hashPassword, hashPin, hashToken,
  validateAdminPassword, validateWorkerPin, verifyPassword, verifyPin
} from '../../src/server/auth/cryptoUtils';

// Credenciales efímeras de la suite, nunca aprovisionadas en semillas o SQL.
const workerPin = () => `${crypto.randomInt(20000000, 80000000)}`;
const adminPassword = () => `Admin-${crypto.randomBytes(20).toString('hex')}`;

test('PINs y contraseñas válidos se derivan con salts individuales y verifican sólo su valor', () => {
  const pin = workerPin();
  const pinHash = hashPin(pin);
  assert.match(pinHash.hash, /^[0-9a-f]{64}$/);
  assert.match(pinHash.salt, /^[0-9a-f]{32}$/);
  assert.equal(verifyPin(pin, pinHash.hash, pinHash.salt), true);
  assert.equal(verifyPin(pin[0] === '1' ? `2${pin.slice(1)}` : `1${pin.slice(1)}`, pinHash.hash, pinHash.salt), false);
  assert.notEqual(hashPin(pin).salt, pinHash.salt);

  const password = adminPassword();
  const passwordHash = hashPassword(password);
  assert.equal(verifyPassword(password, passwordHash.hash, passwordHash.salt), true);
  assert.equal(verifyPassword(`${password}-incorrecta`, passwordHash.hash, passwordHash.salt), false);
  assert.notEqual(hashPassword(password).salt, passwordHash.salt);
});

test('no acepta credenciales almacenadas en texto plano ni salt ausente', () => {
  const pin = workerPin();
  const password = adminPassword();
  assert.equal(verifyPin(pin, pin, null), false);
  assert.equal(verifyPin(pin, pin, crypto.randomBytes(16).toString('hex')), false);
  assert.equal(verifyPassword(password, password, null), false);
  assert.equal(verifyPassword(password, password, crypto.randomBytes(16).toString('hex')), false);
});

test('verificación rechaza todos los formatos no hex o tamaños incorrectos sin lanzar', () => {
  const pin = workerPin();
  const password = adminPassword();
  const pinHash = hashPin(pin);
  const passwordHash = hashPassword(password);
  const malformedHashes = [null, undefined, '', 'a'.repeat(63), 'a'.repeat(65), 'z'.repeat(64), `${'a'.repeat(62)}gg`, 42, {}];
  const malformedSalts = [null, undefined, '', 'a'.repeat(16), 'a'.repeat(31), 'a'.repeat(33), 'z'.repeat(32), 42, {}];
  for (const malformed of malformedHashes) {
    assert.equal(verifyPin(pin, malformed as string, pinHash.salt), false);
    assert.equal(verifyPassword(password, malformed as string, passwordHash.salt), false);
  }
  for (const malformed of malformedSalts) {
    assert.equal(verifyPin(pin, pinHash.hash, malformed as string), false);
    assert.equal(verifyPassword(password, passwordHash.hash, malformed as string), false);
  }
});

test('entradas no string, PIN legado o con espacios y contraseñas enormes se rechazan', () => {
  const pin = workerPin();
  const { hash, salt } = hashPin(pin);
  for (const malformed of [undefined, null, {}, [], 12345678, '1234', `${pin} `, ` ${pin}`, '1'.repeat(10000)]) {
    assert.equal(verifyPin(malformed as string, hash, salt), false);
    assert.equal(validateWorkerPin(malformed as string).isValid, false);
    assert.throws(() => hashPin(malformed as string));
  }
  for (const malformed of [undefined, null, {}, [], 12345678, 'short', 'A'.repeat(1025)]) {
    assert.equal(verifyPassword(malformed as string, hash, salt), false);
    assert.equal(validateAdminPassword(malformed as string).isValid, false);
    assert.throws(() => hashPassword(malformed as string));
  }
});

test('aprovisionamiento no permite salts malformadas y conserva algoritmo existente', () => {
  const pin = workerPin();
  const password = adminPassword();
  for (const salt of ['', 'a'.repeat(16), 'z'.repeat(32), {}]) {
    assert.throws(() => hashPin(pin, salt as string));
    assert.throws(() => hashPassword(password, salt as string));
  }
  const salt = crypto.randomBytes(16).toString('hex');
  assert.equal(hashPin(pin, salt).hash, crypto.scryptSync(pin, salt, 32).toString('hex'));
  assert.equal(hashPassword(password, salt).hash, crypto.scryptSync(password, salt, 32).toString('hex'));
});

test('tokens opacos de 256 bits son únicos y se almacenan mediante SHA-256', () => {
  const token = generateSessionToken();
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.notEqual(generateSessionToken(), token);
  assert.equal(hashToken(token), crypto.createHash('sha256').update(token).digest('hex'));
  assert.notEqual(hashToken(token), token);
});
