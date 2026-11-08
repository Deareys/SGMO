import test from 'node:test';
import assert from 'node:assert/strict';
import { businessDate } from '../../src/utils/businessDate';

test('La jornada de Argentina no cambia a medianoche UTC', () => {
  assert.equal(businessDate(new Date('2026-11-08T00:40:00.000Z')), '2026-11-07');
  assert.equal(businessDate(new Date('2026-11-08T03:00:00.000Z')), '2026-11-08');
});
test('El cálculo es estable con fechas inválidas', () => {
  assert.equal(businessDate(new Date('invalid')), '');
});
