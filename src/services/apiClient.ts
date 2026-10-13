/** Same-origin browser transport. Session cookies are HttpOnly; only the CSRF proof lives in memory. */
let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;

export function resetCsrfToken(): void {
  csrfToken = null;
  csrfRequest = null;
}

async function obtainCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (!csrfRequest) {
    csrfRequest = (async () => {
      const response = await fetch('/api/auth/csrf', { credentials: 'same-origin', cache: 'no-store', mode: 'same-origin', redirect: 'error' });
      const result = await response.json();
      if (!response.ok || typeof result.csrfToken !== 'string' || !/^[a-f0-9]{64}$/.test(result.csrfToken)) {
        throw new Error('No se pudo preparar una solicitud segura al servidor.');
      }
      csrfToken = result.csrfToken;
      return csrfToken;
    })().finally(() => { csrfRequest = null; });
  }
  return csrfRequest;
}

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const endpoint = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const relativeApi = /^\/api(?:\/|$)/.test(endpoint);
  const sameOriginApi = typeof window !== 'undefined' && window.location?.origin
    && endpoint.startsWith(`${window.location.origin}/api/`);
  if (!relativeApi && !sameOriginApi) throw new Error('La API requiere una URL del mismo origen.');
  const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const write = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  headers.delete('Authorization');
  headers.delete('x-auth-token');
  headers.delete('x-sgmo-client');
  if (write) headers.set('X-CSRF-Token', await obtainCsrfToken());
  const options = { ...init, headers, credentials: 'same-origin' as const, mode: 'same-origin' as const, redirect: 'error' as const, cache: 'no-store' as const };
  const retryInput = input instanceof Request ? input.clone() : input;
  let response = await fetch(input, options);
  // Retry only the rejected CSRF proof: middleware guarantees the write has not executed.
  if (write && response.status === 403) {
    const failure = await response.clone().json().catch(() => null);
    if (failure?.code === 'CSRF_REJECTED') {
      resetCsrfToken();
      headers.set('X-CSRF-Token', await obtainCsrfToken());
      response = await fetch(retryInput, options);
    }
  }
  return response;
}
