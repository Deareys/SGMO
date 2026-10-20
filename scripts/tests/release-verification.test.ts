import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyDeployment } from '../verify-deployment.mjs';

test('el gate de release detecta backend antiguo, DB caída y rutas privadas abiertas', async () => {
  const revision = 'a'.repeat(40);
  let faulty = false;
  const request = async (url: URL) => {
    const endpoint = url.pathname;
    if (endpoint === '/' || endpoint === '/setup') return new Response('<!doctype html><html></html>', { headers: { 'Content-Type': 'text/html' } });
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
    if (endpoint === '/api/health') return Response.json({ status: 'ok', revision: faulty ? 'b'.repeat(40) : revision, authTransport: 'httpOnly-cookie' }, { headers });
    if (endpoint === '/api/db/status') return Response.json({ configured: true, connected: !faulty }, { headers });
    if (endpoint === '/api/auth/csrf') return Response.json({ csrfToken: '1'.repeat(64) }, { headers });
    if (endpoint.includes('does-not-exist')) return Response.json({ code: 'API_NOT_FOUND' }, { status: 404, headers });
    return Response.json({ success: false }, { status: faulty ? 200 : 401, headers });
  };
  const valid = await verifyDeployment({ origin: 'https://release.example.invalid', expectedRevision: revision, request });
  assert.equal(valid.passed, true); assert.equal(valid.checks.length, 10);
  faulty = true;
  const invalid = await verifyDeployment({ origin: 'https://release.example.invalid', expectedRevision: revision, request });
  assert.equal(invalid.passed, false);
  assert.equal(invalid.checks.filter((check: { passed: boolean }) => !check.passed).length, 6);
  await assert.rejects(verifyDeployment({ origin: 'https://secret@example.invalid/', expectedRevision: revision, request }));
  await assert.rejects(verifyDeployment({ origin: 'https://release.example.invalid', expectedRevision: 'abreviado', request }));
});
