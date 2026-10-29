import { LEGACY_BACKUP_KEY, sanitizeLegacyValue, type LegacyBackup } from '../shared/legacyBackup';
let recovery: LegacyBackup | null = null;
/** Copiar antes de hidratar la caché. Si la cuota impide la copia, bloquear la
 * sustitución de la clave original hasta descargar o respaldar en el servidor. */
export function captureLegacyBackup(): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = localStorage.getItem(LEGACY_BACKUP_KEY);
    if (existing) { recovery = JSON.parse(existing); return; }
    const previous = localStorage.getItem('SGMO_TEQUENOS_COSTA_V2');
    if (!previous) return;
    const state = JSON.parse(previous);
    if (state.centralOwnerUserId || !['users','houses','sales','shifts'].some(key => Array.isArray(state[key]) && state[key].length)) return;
    recovery = { format: 'sgmo-legacy-v1', sourceId: crypto.randomUUID(), sourceOrigin: window.location.origin,
      capturedAt: new Date().toISOString(), state: sanitizeLegacyValue(state) as Record<string, unknown> };
    // La cola antigua también se respalda; no se consume ni se borra.
    const queue = localStorage.getItem('SGMO_OFFLINE_SALES_QUEUE');
    if (queue) recovery.state.offlineSalesQueue = sanitizeLegacyValue(JSON.parse(queue));
    localStorage.setItem(LEGACY_BACKUP_KEY, JSON.stringify(recovery));
  } catch { /* La referencia en memoria permite exportar sin tocar el original. */ }
}
export function getLegacyBackup(): LegacyBackup | null { return recovery; }
export function canReplaceLegacyCache(): boolean {
  if (!recovery || typeof window === 'undefined') return true;
  try { return !!localStorage.getItem(LEGACY_BACKUP_KEY); } catch { return false; }
}
export function downloadLegacyBackup(backup = recovery): void {
  if (!backup) throw new Error('No hay datos anteriores en este navegador.');
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], {type:'application/json'}));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `sgmo-respaldo-${backup.sourceId}.json`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
