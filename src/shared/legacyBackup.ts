/** Formato de recuperación del prototipo. No transporta identidad ni secretos.
 * Los comprobantes/historial se conservan como evidencia, nunca como pago verificado.
 */
export const LEGACY_BACKUP_KEY = 'SGMO_LEGACY_BACKUP_V1';
export interface LegacyBackup {
  format: 'sgmo-legacy-v1'; sourceId: string; sourceOrigin: string; capturedAt: string;
  state: Record<string, unknown>;
}
const privateKey = /password|(^|_)pin($|_)|pinHash|pinSalt|secret|api.?key|token|authorization|salt|credential|session/i;
export function sanitizeLegacyValue(value: unknown, depth = 0): unknown {
  if (depth > 30) throw new Error('El respaldo supera la profundidad admitida.');
  if (Array.isArray(value)) return value.map(entry => sanitizeLegacyValue(entry, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !privateKey.test(key) && !['__proto__', 'constructor', 'prototype', 'currentUser'].includes(key))
    .map(([key, entry]) => [key, sanitizeLegacyValue(entry, depth + 1)]));
  return value;
}
export function legacyCounts(state: Record<string, unknown>): Record<string, number> {
  return Object.fromEntries(Object.entries(state).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, (value as unknown[]).length]));
}
/** Huella independiente del orden de claves que devuelve JSONB o un archivo. */
export function canonicalLegacyJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalLegacyJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalLegacyJson((value as Record<string,unknown>)[key])).join(',') + '}';
  return JSON.stringify(value);
}
