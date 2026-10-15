import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '@google/genai';
import { describeGeminiFailure } from '../../src/server/ai/geminiFailure.js';

test('diagnóstico OCR distingue credenciales, cupo y proveedor sin exponer errores del SDK', () => {
  for (const [status, code] of [[401,'AUTHENTICATION_FAILED'],[403,'AUTHENTICATION_FAILED'],
    [402,'BILLING_REQUIRED'],[429,'RATE_LIMITED'],[404,'MODEL_UNAVAILABLE'],
    [400,'INVALID_REQUEST'],[503,'PROVIDER_UNAVAILABLE']] as const) {
    const failure = describeGeminiFailure(new ApiError({ status, message: 'PRIVATE_KEY https://private.example' }));
    assert.deepEqual(failure, { code, httpStatus: status });
    assert.ok(!JSON.stringify(failure).includes('PRIVATE_KEY'));
  }
});

test('sólo una razón conocida de Google puede salir del error, sin metadatos privados', () => {
  const message = JSON.stringify({ error: { message: 'PRIVATE_KEY', details: [
    { reason: 'PRIVATE_KEY', metadata: { key: 'PRIVATE_KEY' } },
    { reason: 'API_KEY_INVALID', metadata: { key: 'PRIVATE_KEY' } }
  ] } });
  assert.deepEqual(describeGeminiFailure(new ApiError({ status: 400, message })),
    { code: 'INVALID_REQUEST', httpStatus: 400, reason: 'API_KEY_INVALID' });
  assert.deepEqual(describeGeminiFailure(new SyntaxError('PRIVATE_IMAGE')), { code: 'INVALID_RESPONSE' });
  assert.deepEqual(describeGeminiFailure(null), { code: 'PROVIDER_UNAVAILABLE' });
});
