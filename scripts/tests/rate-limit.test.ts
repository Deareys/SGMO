import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { pinRateLimiter, recordFailedAttempt } from '../../src/server/auth/rateLimiter';

test('La saturación del registro por origen no abre acceso ni desaloja bloqueos activos', () => {
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  const request = (origin: string) => ({ ip: origin, socket: { remoteAddress: origin } }) as Request;
  let status = 0;
  let nextCalled = false;
  const response = { status(value: number) { status = value; return this; }, json() { return this; } } as unknown as Response;
  try {
    for (let origin = 0; origin < 10000; origin++) recordFailedAttempt(request(`origin-${origin}`));
    const locked = request('origin-0');
    for (let failure = 1; failure < 5; failure++) recordFailedAttempt(locked);
    pinRateLimiter(request('origin-overflow'), response, () => { nextCalled = true; });
    assert.equal(status, 429); assert.equal(nextCalled, false);
    status = 0;
    pinRateLimiter(locked, response, () => { nextCalled = true; });
    assert.equal(status, 429); assert.equal(nextCalled, false);
    now += 16 * 60 * 1000;
    pinRateLimiter(request('origin-after-expiry'), response, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  } finally { Date.now = originalNow; }
});
