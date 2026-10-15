import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { setSessionCookie, clearSessionCookie, validateBrowserSecurityConfiguration, isExplicitApiRequest } from '../../src/server/auth/browserSecurity';

test('production session cookie is host-only, Secure, HttpOnly, strict and expires', () => {
  const originalEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    let name: string;
    let options: Record<string, unknown>;
    let cleared: string;
    const response = { cookie(cookieName: string, _value: string, settings: Record<string, unknown>) { name = cookieName; options = settings; },
      clearCookie(cookieName: string, settings: Record<string, unknown>) { cleared = cookieName; options = settings; }, setHeader() {} };
    setSessionCookie(response as never, randomBytes(32).toString('hex'), new Date(Date.now() + 60000).toISOString());
    assert.equal(name!, '__Host-sgmo-session');
    assert.equal(options!.httpOnly, true);
    assert.equal(options!.secure, true);
    assert.equal(options!.sameSite, 'strict');
    assert.equal(options!.path, '/');
    assert.equal('domain' in options!, false);
    assert.ok(options!.expires instanceof Date);
    clearSessionCookie(response as never);
    assert.equal(cleared!, name!);
    assert.equal(options!.secure, true);
  } finally {
    if (originalEnvironment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalEnvironment;
  }
});

test('production origin requires exact HTTPS config or trusted Vercel environment', () => {
  const original = { NODE_ENV: process.env.NODE_ENV, SGMO_PUBLIC_ORIGIN: process.env.SGMO_PUBLIC_ORIGIN, VERCEL_URL: process.env.VERCEL_URL };
  process.env.NODE_ENV = 'production';
  delete process.env.VERCEL_URL;
  try {
    for (const origin of [undefined, 'http://app.example', 'https://app.example/path', 'https://app.example/']) {
      if (origin) process.env.SGMO_PUBLIC_ORIGIN = origin; else delete process.env.SGMO_PUBLIC_ORIGIN;
      assert.throws(validateBrowserSecurityConfiguration);
    }
    process.env.SGMO_PUBLIC_ORIGIN = 'https://app.example';
    assert.doesNotThrow(validateBrowserSecurityConfiguration);
    delete process.env.SGMO_PUBLIC_ORIGIN;
    process.env.VERCEL_URL = 'trusted-preview.vercel.app';
    assert.doesNotThrow(validateBrowserSecurityConfiguration);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('API opt-in cannot be used by a browser with Origin or browser Fetch Metadata', () => {
  const original = process.env.SGMO_ENABLE_API_TOKENS;
  try {
    const headers = { 'x-sgmo-client': 'api', 'sec-fetch-mode': 'cors' };
    delete process.env.SGMO_ENABLE_API_TOKENS;
    assert.equal(isExplicitApiRequest({ headers } as never), false);
    process.env.SGMO_ENABLE_API_TOKENS = 'true';
    assert.equal(isExplicitApiRequest({ headers } as never), true);
    for (const extra of [{ origin: 'https://app.example' }, { 'sec-fetch-site': 'same-origin' }, { 'sec-fetch-dest': 'empty' }, { 'sec-fetch-user': '?1' }]) {
      assert.equal(isExplicitApiRequest({ headers: { ...headers, ...extra } } as never), false);
    }
  } finally { if (original === undefined) delete process.env.SGMO_ENABLE_API_TOKENS; else process.env.SGMO_ENABLE_API_TOKENS = original; }
});

test('Vercel mantiene cookies Secure y origen HTTPS aunque NODE_ENV esté mal configurado', () => {
  const saved = { NODE_ENV:process.env.NODE_ENV,VERCEL:process.env.VERCEL,SGMO_PUBLIC_ORIGIN:process.env.SGMO_PUBLIC_ORIGIN,VERCEL_URL:process.env.VERCEL_URL };
  process.env.VERCEL='1'; process.env.NODE_ENV='development';
  delete process.env.VERCEL_URL; process.env.SGMO_PUBLIC_ORIGIN='http://app.example';
  try {
    assert.throws(validateBrowserSecurityConfiguration);
    let cookieName=''; let cookieOptions:Record<string,unknown>={};
    const response={cookie(name:string,_token:string,options:Record<string,unknown>){cookieName=name;cookieOptions=options;},setHeader(){}};
    setSessionCookie(response as never,randomBytes(32).toString('hex'),new Date(Date.now()+60000).toISOString());
    assert.equal(cookieName,'__Host-sgmo-session');assert.equal(cookieOptions.secure,true);assert.equal(cookieOptions.httpOnly,true);
  } finally {for(const [key,value] of Object.entries(saved)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
