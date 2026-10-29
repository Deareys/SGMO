import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { authenticatedFetch, resetCsrfToken } from '../../src/services/apiClient';

beforeEach(() => resetCsrfToken());

test('concurrent writes share one CSRF negotiation and never send browser bearer tokens', async () => {
  const token = randomBytes(32).toString('hex');
  let csrfCalls = 0;
  let writeCalls = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(options?.credentials, 'same-origin');
    assert.equal(options?.mode, 'same-origin');
    assert.equal(options?.redirect, 'error');
    if (url === '/api/auth/csrf') { csrfCalls++; return Response.json({ csrfToken: token }); }
    const headers = new Headers(options?.headers);
    assert.equal(headers.get('X-CSRF-Token'), token);
    assert.equal(headers.has('Authorization'), false);
    assert.equal(headers.has('x-auth-token'), false);
    assert.equal(headers.has('x-sgmo-client'), false);
    writeCalls++;
    return Response.json({ success: true });
  };
  await Promise.all(Array.from({ length: 6 }, () => authenticatedFetch('/api/sales', {
    method: 'POST', credentials: 'include', headers: { Authorization: 'Bearer legacy', 'x-auth-token': 'legacy', 'x-sgmo-client': 'api' }
  })));
  assert.equal(csrfCalls, 1);
  assert.equal(writeCalls, 6);
});

test('only a CSRF rejection negotiates once and retries the unexecuted write', async () => {
  let csrfCalls = 0;
  let writeCalls = 0;
  let token: string;
  globalThis.fetch = async (url, options) => {
    if (url === '/api/auth/csrf') { csrfCalls++; token = randomBytes(32).toString('hex'); return Response.json({ csrfToken: token }); }
    writeCalls++;
    assert.equal(new Headers(options?.headers).get('X-CSRF-Token'), token);
    return writeCalls === 1 ? Response.json({ code: 'CSRF_REJECTED' }, { status: 403 }) : Response.json({ success: true });
  };
  assert.equal((await authenticatedFetch('/api/users', { method: 'POST' })).status, 200);
  assert.equal(csrfCalls, 2);
  assert.equal(writeCalls, 2);
});

test('business permission errors and unavailable service never replay a mutation', async () => {
  for (const status of [401, 403, 503]) {
    resetCsrfToken();
    let writes = 0;
    globalThis.fetch = async (url) => {
      if (url === '/api/auth/csrf') return Response.json({ csrfToken: randomBytes(32).toString('hex') });
      writes++;
      return Response.json({ code: 'FORBIDDEN' }, { status });
    };
    assert.equal((await authenticatedFetch('/api/sales', { method: 'POST' })).status, status);
    assert.equal(writes, 1);
  }
});

test('a malformed/unavailable CSRF negotiation cannot send credentials or mutate', async () => {
  let writes = 0;
  globalThis.fetch = async (url) => {
    if (url === '/api/auth/csrf') return Response.json({ csrfToken: 'invalid' });
    writes++;
    return Response.json({ success: true });
  };
  await assert.rejects(authenticatedFetch('/api/auth/login', { method: 'POST', body: '{}' }));
  assert.equal(writes, 0);
});

test('the browser transport refuses external URLs before negotiating or sending anything', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ success: true }); };
  await assert.rejects(authenticatedFetch('https://attacker.invalid/api/auth/login', { method: 'POST' }));
  await assert.rejects(authenticatedFetch('//attacker.invalid/api/auth/login', { method: 'POST' }));
  assert.equal(calls, 0);
});
