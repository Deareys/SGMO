/** Diagnóstico acotado del proveedor OCR. Nunca devuelve mensajes, claves,
 * URLs ni metadatos del SDK: sus errores pueden contener información privada.
 * El estado HTTP y una razón conocida permiten corregir la configuración
 * sin confundir una llamada fallida con una imagen ilegible.
 */
export interface GeminiFailure {
  code: 'AUTHENTICATION_FAILED' | 'BILLING_REQUIRED' | 'RATE_LIMITED' | 'MODEL_UNAVAILABLE'
    | 'INVALID_REQUEST' | 'PROVIDER_UNAVAILABLE' | 'INVALID_RESPONSE';
  httpStatus?: number;
  reason?: string;
}

const publicReasons = new Set(['API_KEY_INVALID', 'API_KEY_SERVICE_BLOCKED',
  'API_KEY_HTTP_REFERRER_BLOCKED', 'API_KEY_IP_ADDRESS_BLOCKED', 'SERVICE_DISABLED',
  'BILLING_DISABLED', 'QUOTA_EXCEEDED', 'RATE_LIMIT_EXCEEDED']);

/** Acepta errores desconocidos de red, JSON o ApiError de @google/genai. */
export function describeGeminiFailure(error: unknown): GeminiFailure {
  const candidate = error as { status?: unknown; message?: unknown } | null;
  const status = typeof candidate?.status === 'number' && Number.isInteger(candidate.status)
    && candidate.status >= 400 && candidate.status <= 599 ? candidate.status : undefined;
  const code: GeminiFailure['code'] = status === 401 || status === 403 ? 'AUTHENTICATION_FAILED'
    : status === 402 ? 'BILLING_REQUIRED' : status === 429 ? 'RATE_LIMITED'
    : status === 404 ? 'MODEL_UNAVAILABLE' : status === 400 ? 'INVALID_REQUEST'
    : status === undefined && error instanceof SyntaxError ? 'INVALID_RESPONSE' : 'PROVIDER_UNAVAILABLE';
  let reason: string | undefined;
  if (typeof candidate?.message === 'string' && candidate.message.length <= 32768) {
    try {
      const parsed = JSON.parse(candidate.message);
      const details = parsed?.error?.details;
      if (Array.isArray(details)) reason = details.find(detail => publicReasons.has(detail?.reason))?.reason;
    } catch { /* Los mensajes libres del SDK no se publican. */ }
  }
  return { code, ...(status === undefined ? {} : { httpStatus: status }), ...(reason ? { reason } : {}) };
}
