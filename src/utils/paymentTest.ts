/**
 * SGMO — Diagnóstico y Banco de Pruebas de Pagos Mercado Pago
 * Archivo: src/utils/paymentTest.ts
 *
 * Simula solicitudes de consulta y verificación de pago contra el backend,
 * auditando si los fallos ocurren en autorización (401/403), comunicación de red,
 * o respuesta de la API oficial de Mercado Pago.
 */

import { authenticatedFetch } from '../services/apiClient';

export interface PaymentDiagnosticResult {
  step: string;
  status: 'SUCCESS' | 'FAILED' | 'WARNING';
  httpStatus?: number;
  failurePoint?: 'AUTHORIZATION' | 'NETWORK_COMMUNICATION' | 'NOT_FOUND' | 'VALIDATION_MISMATCH' | 'NONE';
  data?: any;
  error?: string;
  suggestion?: string;
}

/**
 * Consulta el estado y autenticación del backend con Mercado Pago (/api/mercadopago/status)
 */
export async function testBackendMpStatus(): Promise<PaymentDiagnosticResult> {
  console.group('🔍 [TEST 1/3] Verificando Estado de Conexión del Backend con Mercado Pago');
  try {
    const startTime = performance.now();
    const response = await authenticatedFetch('/api/mercadopago/status', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    const duration = Math.round(performance.now() - startTime);

    console.log(`⏱️ Latencia: ${duration}ms | HTTP Status: ${response.status} (${response.statusText})`);

    if (!response.ok) {
      const errText = await response.text();
      console.error('❌ Error HTTP al consultar /api/mercadopago/status:', errText);
      console.groupEnd();
      return {
        step: 'mp_status_check',
        status: 'FAILED',
        httpStatus: response.status,
        failurePoint: response.status === 401 || response.status === 403 ? 'AUTHORIZATION' : 'NETWORK_COMMUNICATION',
        error: `HTTP ${response.status}: ${errText}`,
        suggestion: 'Revisar la configuración de CORS o variables de entorno en el servidor.'
      };
    }

    const json = await response.json();
    console.log('📦 Respuesta recibida de /api/mercadopago/status:', json);

    const hasAccount = Boolean(json.accountInfo?.id);
    const isConfigured = Boolean(json.configured);

    if (!isConfigured) {
      console.warn('⚠️ Token no configurado en el servidor.');
      console.groupEnd();
      return {
        step: 'mp_status_check',
        status: 'WARNING',
        httpStatus: response.status,
        failurePoint: 'AUTHORIZATION',
        data: json,
        suggestion: 'Configurar MERCADOPAGO_ACCESS_TOKEN en las variables de entorno.'
      };
    }

    if (!hasAccount) {
      console.warn('⚠️ Token presente pero Mercado Pago rechazó la consulta de cuenta /users/me.');
      console.groupEnd();
      return {
        step: 'mp_status_check',
        status: 'FAILED',
        httpStatus: response.status,
        failurePoint: 'AUTHORIZATION',
        data: json,
        suggestion: 'El token ingresado no es válido o fue modificado a mano. Copiarlo exactamente desde el panel de MP.'
      };
    }

    console.log(`✅ Conexión con Mercado Pago exitosa: Usuario "${json.accountInfo.nickname}" (ID: ${json.accountInfo.id})`);
    console.groupEnd();
    return {
      step: 'mp_status_check',
      status: 'SUCCESS',
      httpStatus: response.status,
      failurePoint: 'NONE',
      data: json
    };
  } catch (err: any) {
    console.error('💥 Error crítico de comunicación de red:', err);
    console.groupEnd();
    return {
      step: 'mp_status_check',
      status: 'FAILED',
      failurePoint: 'NETWORK_COMMUNICATION',
      error: err.message || 'Error de red al conectar con el backend',
      suggestion: 'Verificar si el servidor de backend (server.ts) está en ejecución en el puerto 3000.'
    };
  }
}

/**
 * Simula una solicitud de verificación de pago al backend (/api/mercadopago/verify-payment)
 * probando un número de operación específico.
 */
export async function testBackendPaymentVerification(
  operationId: string = 'TEST-OK-884920',
  expectedAmount: number = 7500
): Promise<PaymentDiagnosticResult> {
  console.group(`🔍 [TEST 2/3] Simulando Verificación de Pago: Op #${operationId} ($${expectedAmount})`);
  try {
    const payload = {
      operationId,
      expectedAmount,
      existingOperationIds: []
    };

    console.log('📤 Enviando payload a /api/mercadopago/verify-payment:', payload);
    const startTime = performance.now();

    const response = await authenticatedFetch('/api/mercadopago/verify-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const duration = Math.round(performance.now() - startTime);
    console.log(`⏱️ Latencia: ${duration}ms | HTTP Status: ${response.status} (${response.statusText})`);

    const json = await response.json();
    console.log('📦 Respuesta de verificación del backend:', json);

    if (!response.ok) {
      console.error('❌ Error HTTP devuelto por el backend:', json);
      console.groupEnd();
      return {
        step: 'payment_verification',
        status: 'FAILED',
        httpStatus: response.status,
        failurePoint: response.status === 401 || response.status === 403 ? 'AUTHORIZATION' : 'NETWORK_COMMUNICATION',
        data: json,
        error: json.message || 'Fallo HTTP al verificar el pago'
      };
    }

    if (json.status === 'not_found') {
      console.warn(`⚠️ Operación #${operationId} no encontrada en Mercado Pago.`);
      console.groupEnd();
      return {
        step: 'payment_verification',
        status: 'WARNING',
        httpStatus: response.status,
        failurePoint: 'NOT_FOUND',
        data: json,
        suggestion: 'El ID no existe aún en la cuenta de MP o pertenece a otra cuenta de prueba.'
      };
    }

    if (json.verified) {
      console.log(`🎉 ¡PAGO VERIFICADO Y ACREDITADO! Estado: "${json.status}", Monto: $${json.amount}`);
      console.groupEnd();
      return {
        step: 'payment_verification',
        status: 'SUCCESS',
        httpStatus: response.status,
        failurePoint: 'NONE',
        data: json
      };
    } else {
      console.warn(`⚠️ Pago no verificado: estado "${json.status}", coincide monto: ${json.amountMatches}`);
      console.groupEnd();
      return {
        step: 'payment_verification',
        status: 'WARNING',
        httpStatus: response.status,
        failurePoint: 'VALIDATION_MISMATCH',
        data: json,
        suggestion: json.message
      };
    }
  } catch (err: any) {
    console.error('💥 Error de comunicación al verificar pago:', err);
    console.groupEnd();
    return {
      step: 'payment_verification',
      status: 'FAILED',
      failurePoint: 'NETWORK_COMMUNICATION',
      error: err.message,
      suggestion: 'Revisar la conectividad con el backend local o proxy /api.'
    };
  }
}

/**
 * Consulta los pagos recientes registrados en la cuenta de Mercado Pago (/api/mercadopago/recent-payments)
 */
export async function testBackendRecentPayments(): Promise<PaymentDiagnosticResult> {
  console.group('🔍 [TEST 3/3] Consultando Pagos Recientes en Cuenta de Mercado Pago');
  try {
    const startTime = performance.now();
    const response = await authenticatedFetch('/api/mercadopago/recent-payments', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    const duration = Math.round(performance.now() - startTime);

    console.log(`⏱️ Latencia: ${duration}ms | HTTP Status: ${response.status}`);
    const json = await response.json();
    console.log('📦 Respuesta de pagos recientes:', json);

    if (!response.ok || json.success === false) {
      console.error('❌ Error devuelto al listar pagos:', json);
      console.groupEnd();
      return {
        step: 'recent_payments',
        status: 'FAILED',
        httpStatus: response.status,
        failurePoint: json.message?.includes('401') ? 'AUTHORIZATION' : 'NETWORK_COMMUNICATION',
        data: json,
        error: json.message
      };
    }

    console.log(`✅ Consulta exitosa. Pagos encontrados en cuenta: ${json.payments?.length || 0}`);
    console.groupEnd();
    return {
      step: 'recent_payments',
      status: 'SUCCESS',
      httpStatus: response.status,
      failurePoint: 'NONE',
      data: json
    };
  } catch (err: any) {
    console.error('💥 Error al consultar pagos recientes:', err);
    console.groupEnd();
    return {
      step: 'recent_payments',
      status: 'FAILED',
      failurePoint: 'NETWORK_COMMUNICATION',
      error: err.message
    };
  }
}

/**
 * Ejecuta la batería de pruebas diagnósticas completa e imprime el reporte final en consola.
 * Puede ser llamada desde DevTools ejecutando: `window.runPaymentTest()`
 */
export async function runFullPaymentDiagnostic(customOperationId?: string, amount: number = 7500): Promise<{
  allPassed: boolean;
  results: PaymentDiagnosticResult[];
}> {
  console.clear?.();
  console.log('%c==================================================================', 'color: #38bdf8; font-weight: bold;');
  console.log('%c🚀 INICIANDO DIAGNÓSTICO INTEGRAL DE MERCADO PAGO (SGMO)', 'color: #fbbf24; font-size: 14px; font-weight: bold;');
  console.log('%c==================================================================', 'color: #38bdf8; font-weight: bold;');

  const results: PaymentDiagnosticResult[] = [];

  // Paso 1: Conexión y Autorización
  const statusRes = await testBackendMpStatus();
  results.push(statusRes);

  // Paso 2: Consulta de Pagos Recientes
  const recentRes = await testBackendRecentPayments();
  results.push(recentRes);

  // Paso 3: Verificación de Pago Específico
  const opToTest = customOperationId || 'TEST-OK-884920';
  const verifyRes = await testBackendPaymentVerification(opToTest, amount);
  results.push(verifyRes);

  // Resumen Ejecutivo en Consola
  console.log('%c------------------------------------------------------------------', 'color: #64748b;');
  console.log('%c📊 INFORME DE DIAGNÓSTICO FINAL:', 'color: #f8fafc; font-weight: bold; font-size: 12px;');

  let hasAuthError = false;
  let hasNetError = false;

  results.forEach((r, idx) => {
    const icon = r.status === 'SUCCESS' ? '✅' : r.status === 'WARNING' ? '⚠️' : '❌';
    console.log(`${icon} Paso ${idx + 1} [${r.step}]: ${r.status} (HTTP ${r.httpStatus || 'N/A'}) - Punto de fallo: ${r.failurePoint}`);
    if (r.failurePoint === 'AUTHORIZATION') hasAuthError = true;
    if (r.failurePoint === 'NETWORK_COMMUNICATION') hasNetError = true;
    if (r.suggestion) console.log(`   💡 Sugerencia: ${r.suggestion}`);
  });

  console.log('%c------------------------------------------------------------------', 'color: #64748b;');
  if (hasAuthError) {
    console.log('%c🚨 DIAGNÓSTICO: EL FALLO OCURRE EN LA AUTORIZACIÓN (Credenciales inválidas o no aceptadas por MP).', 'color: #f87171; font-weight: bold;');
  } else if (hasNetError) {
    console.log('%c🚨 DIAGNÓSTICO: EL FALLO OCURRE EN LA COMUNICACIÓN DE RED (Servidor local o proxy /api no responde).', 'color: #f87171; font-weight: bold;');
  } else {
    console.log('%c✨ DIAGNÓSTICO: LA COMUNICACIÓN Y AUTORIZACIÓN CON EL BACKEND ESTÁN 100% OPERATIVAS.', 'color: #4ade80; font-weight: bold;');
  }
  console.log('%c==================================================================', 'color: #38bdf8; font-weight: bold;');

  return {
    allPassed: results.every((r) => r.status === 'SUCCESS'),
    results
  };
}

// Exponer la función globalmente en el navegador para pruebas directas desde la consola F12
if (typeof window !== 'undefined') {
  (window as any).runPaymentTest = runFullPaymentDiagnostic;
  (window as any).testBackendMpStatus = testBackendMpStatus;
  (window as any).testBackendPaymentVerification = testBackendPaymentVerification;
  (window as any).testBackendRecentPayments = testBackendRecentPayments;
}
