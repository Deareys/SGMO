/** Política común de altas/cambios; el login conserva compatibilidad con secretos anteriores. */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_NEW_PASSWORD_LENGTH = 128;

const COMMON_PASSWORDS = new Set([
  'password1234', 'password12345', 'password123456', 'passwordpassword', 'password123!',
  'contraseña123', 'contrasena123', 'contraseña1234', 'contrasena1234', 'micontraseña123', 'micontrasena123',
  'administrador', 'administrador123', 'administrador1234', 'admin12345678', 'administrator',
  'welcome12345', 'welcome123456', 'bienvenido123', 'bienvenidos123', 'tequenos12345', 'tequeños12345',
  'tequenos2026!', 'tequenos2027!', 'qwerty123456', 'qwertyuiop12', 'qwertyuiop123', 'qwertyuiopasdf',
  'letmein123456', 'changeme12345', 'cambiame12345', 'iloveyou12345', '123456789012', '1234567890123',
  '12345678901234', '123456789012345', '098765432109', '111111111111', '000000000000'
]);
const comparable = (value: string) => value.normalize('NFKC').toLowerCase();

/** Devuelve sólo error de política; nunca consulta ni identifica cuentas. No modifica el secreto. */
export function validateAccountPassword(value: unknown, identifiers: Array<string | null | undefined> = []): { isValid: boolean; error?: string } {
  if (typeof value !== 'string') return { isValid: false, error: 'La contraseña es obligatoria.' };
  const length = Array.from(value).length;
  if (length < MIN_PASSWORD_LENGTH || length > MAX_NEW_PASSWORD_LENGTH) {
    return { isValid: false, error: `Usá entre ${MIN_PASSWORD_LENGTH} y ${MAX_NEW_PASSWORD_LENGTH} caracteres.` };
  }
  const normalized = comparable(value);
  const compact = normalized.replace(/\s/g, '');
  let repeated = false;
  for (let size = 1; size <= 6; size++) {
    if (compact.length % size === 0 && compact === compact.slice(0, size).repeat(compact.length / size)) repeated = true;
  }
  const sequential = /^\d+$/.test(compact) && [1, -1].some(step => [...compact].every((digit, index) =>
    index === 0 || Number(digit) === (Number(compact[index - 1]) + step + 10) % 10));
  const derivedFromIdentifier = identifiers.filter((identifier): identifier is string => typeof identifier === 'string')
    .flatMap(identifier => [identifier, identifier.split('@')[0]])
    .some(identifier => {
      const account = comparable(identifier).replace(/[^\p{L}\p{N}]/gu, '');
      const password = compact.replace(/[^\p{L}\p{N}]/gu, '');
      return account.length >= 4 && password.startsWith(account) && /^\d{0,8}$/.test(password.slice(account.length));
    });
  if (!compact || COMMON_PASSWORDS.has(compact) || repeated || sequential || derivedFromIdentifier) {
    return { isValid: false, error: 'Elegí una contraseña menos predecible, sin patrones comunes ni tu identificador.' };
  }
  return { isValid: true };
}
