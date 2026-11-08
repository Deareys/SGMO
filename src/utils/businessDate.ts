/** Fecha operativa de Argentina, independiente del huso horario del dispositivo. */
export function businessDate(date: Date): string {
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}
