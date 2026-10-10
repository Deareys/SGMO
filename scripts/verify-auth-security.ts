/**
 * SGMO — Tequeños Costa
 * Script de Verificación de Autenticación, Autorización y Seguridad (Fase 3)
 */

import http from 'http';

const BASE_URL = 'http://localhost:3000';

async function request(path: string, options: { method?: string; body?: any; token?: string } = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const req = http.request(url, {
      method: options.method || 'GET',
      headers
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode || 200, body: parsed });
        } catch {
          resolve({ status: res.statusCode || 200, body: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runSecurityTests() {
  console.log('=====================================================================');
  console.log('SGMO — VERIFICACIÓN AUTOMATIZADA DE SEGURIDAD Y RBAC (FASE 3)');
  console.log('=====================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  try {
    // 1. Endpoint público de health
    const health = await request('/api/health');
    assert(health.status === 200 && health.body.status === 'ok', 'Health Check disponible sin credenciales');

    // 2. Intento de acceso a ruta protegida sin token (debe responder 401)
    const unauthRecentPayments = await request('/api/mercadopago/recent-payments');
    assert(unauthRecentPayments.status === 401, 'Ruta /api/mercadopago/recent-payments rechaza acceso anónimo con HTTP 401');

    const unauthVerify = await request('/api/mercadopago/verify-payment', {
      method: 'POST',
      body: { operationId: '123456', expectedAmount: 7500 }
    });
    assert(unauthVerify.status === 401, 'Ruta /api/mercadopago/verify-payment rechaza acceso anónimo con HTTP 401');

    // 3. Intento de login con PIN inválido (debe fallar con HTTP 401)
    const badLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { pin: '0000' }
    });
    assert(badLogin.status === 401 && badLogin.body.success === false, 'Login rechaza PIN inválido con HTTP 401');

    // 4. Login exitoso con PIN de Vendedor ('1111' - Lucas Benítez)
    const sellerLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { pin: '1111' }
    });
    assert(
      sellerLogin.status === 200 && sellerLogin.body.success === true && Boolean(sellerLogin.body.token),
      'Login exitoso de Vendedor emite token de sesión válido'
    );
    const sellerToken = sellerLogin.body.token;

    // 5. Login exitoso con PIN de Administrador ('1234' - Carlos Mendoza)
    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { pin: '1234' }
    });
    assert(
      adminLogin.status === 200 && adminLogin.body.success === true && adminLogin.body.user.role === 'admin',
      'Login exitoso de Administrador emite token con rol admin'
    );
    const adminToken = adminLogin.body.token;

    // 6. Verificar /api/auth/me con token de vendedor
    const sellerMe = await request('/api/auth/me', { token: sellerToken });
    assert(sellerMe.status === 200 && sellerMe.body.user.role === 'seller', 'GET /api/auth/me devuelve perfil autenticado del vendedor');

    // 7. Control RBAC: Vendedor intenta acceder a recent-payments (debe responder 403 Forbidden)
    const sellerAccessForbidden = await request('/api/mercadopago/recent-payments', { token: sellerToken });
    assert(
      sellerAccessForbidden.status === 403 && sellerAccessForbidden.body.code === 'FORBIDDEN',
      'RBAC: Vendedor recibe 403 FORBIDDEN al intentar consultar recent-payments de Mercado Pago'
    );

    // 8. Control RBAC: Administrador accede exitosamente a recent-payments
    const adminAccessAllowed = await request('/api/mercadopago/recent-payments', { token: adminToken });
    assert(
      adminAccessAllowed.status === 200,
      'RBAC: Administrador accede a /api/mercadopago/recent-payments exitosamente'
    );

    // 9. Vendedor consulta verify-payment con token (permitido)
    const sellerVerifyPay = await request('/api/mercadopago/verify-payment', {
      method: 'POST',
      token: sellerToken,
      body: { operationId: 'SIM-OK-12345', expectedAmount: 7500 }
    });
    assert(
      sellerVerifyPay.status === 200 && sellerVerifyPay.body.success === true,
      'Vendedor autenticado puede validar pagos legítimamente con su token'
    );

    // 10. Cierre de sesión (Logout) y revocación
    const logoutRes = await request('/api/auth/logout', { method: 'POST', token: sellerToken });
    assert(logoutRes.status === 200 && logoutRes.body.success === true, 'POST /api/auth/logout revoca la sesión');

    // 11. Token revocado ya no permite acceso a /api/auth/me
    const postLogoutMe = await request('/api/auth/me', { token: sellerToken });
    assert(postLogoutMe.status === 401, 'Token revocado es rechazado con HTTP 401');

    console.log('\n=====================================================================');
    console.log(`RESULTADO DE LA AUDITORÍA DE SEGURIDAD: ${passed} pruebas superadas, ${failed} fallidas.`);
    console.log('=====================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Error ejecutando pruebas:', err);
    process.exit(1);
  }
}

runSecurityTests();
