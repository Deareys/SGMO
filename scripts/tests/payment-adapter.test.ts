/** El cliente no fabrica enlaces ni convierte una contingencia bancaria en acreditación. */
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MercadoPagoAdapter } from '../../src/adapters/payments/MercadoPagoAdapter';
import { resetCsrfToken } from '../../src/services/apiClient';
import { MercadoPagoTestLabModal } from '../../src/components/MercadoPagoTestLabModal';

let requests: Array<{ endpoint: string; body: unknown }>;
let responseForPayment: () => Response | Promise<Response>;
const adapter = new MercadoPagoAdapter();
const saleId = 'TX-867baf1e-39d5-4612-9ef6-cc5a5d33c051';
const preferenceInput = { saleId, title: 'Texto cliente', quantity: 1, unitPrice: 1, externalReference: 'Manipulado' };
const verificationInput = { saleId, paymentId: '123456789', expectedAmount: 7500 };

beforeEach(() => {
  requests = [];
  resetCsrfToken();
  responseForPayment = () => Response.json({ message: 'Unavailable' }, { status: 503 });
  globalThis.fetch = async (input, options) => {
    const endpoint = String(input);
    if (endpoint === '/api/auth/csrf') return Response.json({ csrfToken: 'c'.repeat(64) });
    requests.push({ endpoint, body: options?.body ? JSON.parse(String(options.body)) : undefined });
    return responseForPayment();
  };
});

test('Crear checkout ante HTTP 503 rechaza y no inventa pref_mock ni enlace', async () => {
  await assert.rejects(adapter.createPreference(preferenceInput), /enlace oficial/);
  assert.equal(requests.length, 1);
});

test('Crear checkout ante caída de red rechaza sin alternativa simulada', async () => {
  responseForPayment = () => { throw new Error('Network unavailable'); };
  await assert.rejects(adapter.createPreference(preferenceInput), /Network unavailable/);
});

test('Crear checkout transmite solo el ID central: el servidor determina importe y referencia', async () => {
  responseForPayment = () => Response.json({ success: true, preferenceId: 'PREF-official', initPoint: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=PREF-official' });
  const result = await adapter.createPreference(preferenceInput);
  assert.equal(result.preferenceId, 'PREF-official');
  assert.deepEqual(requests[0].body, { saleId });
});

test('Respuesta con enlace ajeno a Mercado Pago no produce un checkout', async () => {
  responseForPayment = () => Response.json({ success: true, preferenceId: 'PREF', initPoint: 'https://example.com/payment' });
  await assert.rejects(adapter.createPreference(preferenceInput), /enlace oficial/);
});

test('Sin venta central no se contacta al banco para checkout ni verificación', async () => {
  await assert.rejects(adapter.createPreference({ ...preferenceInput, saleId: '' }), /venta central/);
  await assert.rejects(adapter.verifyPayment({ ...verificationInput, saleId: '' }), /venta central/);
  assert.deepEqual(requests, []);
});

for (const [name, override] of [
  ['status pendiente', { status: 'pending' }],
  ['API no viva', { isLiveApi: false }],
  ['sandbox', { isSimulated: true }],
  ['importe diferente', { amountMatches: false }],
  ['importe omitido', { amount: undefined }]
] as const) {
  test(`verified del servidor no basta con ${name}`, async () => {
    responseForPayment = () => Response.json({ verified: true, status: 'approved', isLiveApi: true, amountMatches: true, amount: 7500, ...override });
    const result = await adapter.verifyPayment(verificationInput);
    assert.equal(result.verified, false);
  });
}

test('Solo evidencia bancaria aprobada real y consistente puede devolverse como acreditación', async () => {
  responseForPayment = () => Response.json({ verified: true, status: 'approved', isLiveApi: true, amountMatches: true, amount: 7500, operationId: '123456789' });
  const result = await adapter.verifyPayment(verificationInput);
  assert.equal(result.verified, true);
  assert.deepEqual(requests[0].body, { saleId, operationId: '123456789' });
});

test('Una caída bancaria conserva pendiente sin inventar importe acreditado', async () => {
  const result = await adapter.verifyPayment(verificationInput);
  assert.equal(result.verified, false);
  assert.equal(result.amount, undefined);
  assert.equal(result.isLiveApi, false);
  assert.equal(result.status, 'pending');
});

test('Laboratorio fuera de demo muestra límite sin generador de comprobantes ni checkout', () => {
  const html = renderToStaticMarkup(React.createElement(MercadoPagoTestLabModal, { isOpen: true, onClose() {}, varieties: [] }));
  assert.match(html, /únicamente en un entorno demo aislado/);
  assert.doesNotMatch(html, /Generador de Comprobante/);
});

test('Laboratorio demo etiqueta imágenes sin validez bancaria', () => {
  const html = renderToStaticMarkup(React.createElement(MercadoPagoTestLabModal, { isOpen: true, demoMode: true, onClose() {}, varieties: [] }));
  assert.match(html, /SIMULACIÓN SIN VALIDEZ BANCARIA/);
});
