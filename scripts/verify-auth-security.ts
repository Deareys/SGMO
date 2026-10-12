/**
 * SGMO — Tequeños Costa
 * Script de Verificación de Autenticación, Autorización y Seguridad (Fase 3)
 */

import http from 'http';

const PORT = process.env.PORT || '3000';
const BASE_URL = `http://127.0.0.1:${PORT}`;
// Esta suite histórica sólo puede utilizarse con demo local explícita, nunca contra una base de negocio.
if (process.env.NODE_ENV !== 'test' || process.env.SGMO_AUTH_MODE !== 'demo'
    || [process.env.DATABASE_URL, process.env.POSTGRES_URL, process.env.PGHOST, process.env.PGDATABASE, process.env.PGUSER].some(Boolean)
    || !process.env.SGMO_DEMO_SELLER_PIN || !process.env.SGMO_DEMO_FACTORY_PIN || !process.env.SGMO_DEMO_ADMIN_PASSWORD) {
  throw new Error('Esta suite requiere demo aislada, NODE_ENV=test y credenciales efímeras proporcionadas por el operador.');
}
const sellerPin = process.env.SGMO_DEMO_SELLER_PIN;
const factoryPin = process.env.SGMO_DEMO_FACTORY_PIN;
const adminPassword = process.env.SGMO_DEMO_ADMIN_PASSWORD;

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

    // 3. Intento de login con PIN inválido sin userCode (debe fallar con HTTP 400 MISSING_USER_CODE o 401)
    const badLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { pin: '00000000' }
    });
    assert(badLogin.status === 400 && badLogin.body.code === 'MISSING_USER_CODE', 'Login sin userCode es rechazado');

    // 4. Login exitoso con Vendedor (userCode: 'VEND-01', PIN efímero de 8 dígitos)
    const sellerLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { userCode: 'VEND-01', pin: sellerPin }
    });
    assert(
      sellerLogin.status === 200 && sellerLogin.body.success === true && Boolean(sellerLogin.body.token),
      'Login exitoso de Vendedor emite token de sesión válido'
    );
    const sellerToken = sellerLogin.body.token;

    // 5. Login exitoso con Administrador (identifier: 'carlos.admin@tequenosplaya.com', password: adminPassword)
    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { identifier: 'carlos.admin@tequenosplaya.com', password: adminPassword }
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

    // --- PRUEBAS DE AUTORIZACIÓN POR RECURSO (FASE 3.1: SEC-02 & SEC-03) ---

    // 10. SEC-02: Vendedor intenta registrar una venta atribuyéndola a otro vendedor (HTTP 403)
    const forgedSellerSale = await request('/api/sales', {
      method: 'POST',
      token: sellerToken,
      body: {
        id: `SALE-TEST-FORGED-${Date.now()}`,
        shiftId: 'SHIFT-20260830-01',
        sellerId: 'USR-VEND-2', // Lucas Benítez (USR-VEND-1) intentando registrar a nombre de Esteban Morales
        sellerName: 'Esteban Morales',
        itemType: 'unidad',
        varietyId: 'VAR-CLASICO',
        varietyName: 'Tequeño Clásico',
        quantityUnitsEquivalent: 1,
        totalAmount: 2500,
        paymentMethod: 'efectivo',
        timestamp: new Date().toISOString(),
        validationStatus: 'validada'
      }
    });
    assert(
      forgedSellerSale.status === 403 && forgedSellerSale.body.code === 'FORBIDDEN',
      'SEC-02: Vendedor intentando registrar venta a nombre de otro vendedor es rechazado con HTTP 403'
    );

    // 11. SEC-02: Vendedor intenta registrar una venta en una jornada ajena (HTTP 403)
    const forgedShiftSale = await request('/api/sales', {
      method: 'POST',
      token: sellerToken,
      body: {
        id: `SALE-TEST-FORGED-SHIFT-${Date.now()}`,
        shiftId: 'SHIFT-20260830-02', // Jornada de Micaela Rossi (USR-VEND-3)
        sellerId: 'USR-VEND-1',
        sellerName: 'Lucas Benítez',
        itemType: 'unidad',
        varietyId: 'VAR-CLASICO',
        varietyName: 'Tequeño Clásico',
        quantityUnitsEquivalent: 1,
        totalAmount: 2500,
        paymentMethod: 'efectivo',
        timestamp: new Date().toISOString(),
        validationStatus: 'validada'
      }
    });
    assert(
      forgedShiftSale.status === 403 && forgedShiftSale.body.code === 'FORBIDDEN',
      'SEC-02: Vendedor intentando registrar venta en jornada perteneciente a otro vendedor es rechazado con HTTP 403'
    );

    // 12. SEC-03: Vendedor intenta consultar ventas de una jornada ajena (HTTP 403)
    const forbiddenShiftSales = await request('/api/sales/shift/SHIFT-20260830-02', {
      token: sellerToken
    });
    assert(
      forbiddenShiftSales.status === 403 && forbiddenShiftSales.body.code === 'FORBIDDEN',
      'SEC-03: Vendedor intentando consultar ventas de una jornada ajena es rechazado con HTTP 403'
    );

    // 13. SEC-03: Vendedor consulta detalle de jornada ajena en /shifts/:id (HTTP 403)
    const forbiddenShiftDetail = await request('/api/shifts/SHIFT-20260830-02', {
      token: sellerToken
    });
    assert(
      forbiddenShiftDetail.status === 403 && forbiddenShiftDetail.body.code === 'FORBIDDEN',
      'SEC-03: Vendedor intentando ver detalle de jornada ajena (/shifts/:id) es rechazado con HTTP 403'
    );

    // 14. Vendedor consulta legítimamente su propia jornada en /shifts/:id (HTTP 200)
    const ownShiftDetail = await request('/api/shifts/SHIFT-20260830-01', {
      token: sellerToken
    });
    assert(
      ownShiftDetail.status === 200 && ownShiftDetail.body.success === true && ownShiftDetail.body.shift?.sellerId === 'USR-VEND-1',
      'Vendedor autenticado puede consultar el detalle de su propia jornada legítimamente (HTTP 200)'
    );

    // 15. Control de Rol Estricto: Operario de fábrica (factory_worker) no puede acceder a ventas ni jornadas
    const factoryLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { userCode: 'FAB-01', pin: factoryPin } // Marcos Benavídez (USR-FAB-1)
    });
    assert(
      factoryLogin.status === 200 && factoryLogin.body.user.role === 'factory_worker',
      'Login exitoso de operario de fábrica emite token con rol factory_worker'
    );
    const factoryToken = factoryLogin.body.token;

    const factoryShiftsAccess = await request('/api/shifts', { token: factoryToken });
    assert(
      factoryShiftsAccess.status === 403 && factoryShiftsAccess.body.code === 'FORBIDDEN',
      'RBAC: factory_worker es rechazado con HTTP 403 al intentar consultar /api/shifts'
    );

    const factorySalesAccess = await request('/api/sales', { token: factoryToken });
    assert(
      factorySalesAccess.status === 403 && factorySalesAccess.body.code === 'FORBIDDEN',
      'RBAC: factory_worker es rechazado con HTTP 403 al intentar consultar /api/sales'
    );

    const factoryShiftSalesAccess = await request('/api/sales/shift/SHIFT-20260830-01', { token: factoryToken });
    assert(
      factoryShiftSalesAccess.status === 403 && factoryShiftSalesAccess.body.code === 'FORBIDDEN',
      'RBAC: factory_worker es rechazado con HTTP 403 al intentar consultar ventas de una jornada'
    );

    const factoryPostSale = await request('/api/sales', {
      method: 'POST',
      token: factoryToken,
      body: { shiftId: 'SHIFT-20260830-01', itemType: 'combo3', varietyId: 'VAR-CLASICO', quantityUnitsEquivalent: 3, totalAmount: 4000, paymentMethod: 'efectivo' }
    });
    assert(
      factoryPostSale.status === 403 && factoryPostSale.body.code === 'FORBIDDEN',
      'RBAC: factory_worker es rechazado con HTTP 403 al intentar registrar ventas individuales'
    );

    // 16. Integridad de Ventas: Intento de registrar venta con precio adulterado (HTTP 400)
    const tamperedPriceSale = await request('/api/sales', {
      method: 'POST',
      token: sellerToken,
      body: {
        id: `SALE-TAMPERED-PRICE-${Date.now()}`,
        shiftId: 'SHIFT-20260831-01', // Jornada activa en_curso de Lucas Benítez
        sellerId: 'USR-VEND-1',
        itemType: 'combo6',
        varietyId: 'VAR-CLASICO',
        varietyName: 'Tequeño Clásico',
        quantityUnitsEquivalent: 6,
        totalAmount: 500, // Fraude: Combo 6u cuesta $7.500, enviado $500
        paymentMethod: 'efectivo',
        timestamp: new Date().toISOString()
      }
    });
    assert(
      tamperedPriceSale.status === 400 && tamperedPriceSale.body.code === 'INVALID_SALE_PRICE',
      'Integridad: Venta individual con total adulterado ($500 por combo6) es rechazada con HTTP 400 INVALID_SALE_PRICE'
    );

    // 17. Integridad de Ventas: Intento de registrar venta con descuento arbitrario no autorizado (HTTP 400)
    const unauthorizedDiscountSale = await request('/api/sales', {
      method: 'POST',
      token: sellerToken,
      body: {
        id: `SALE-UNAUTH-DISCOUNT-${Date.now()}`,
        shiftId: 'SHIFT-20260831-01',
        sellerId: 'USR-VEND-1',
        itemType: 'combo3',
        varietyId: 'VAR-CLASICO',
        quantityUnitsEquivalent: 3,
        totalAmount: 3000, // Descuento arbitrario no configurado ($3.000 en vez de $4.000)
        paymentMethod: 'efectivo',
        timestamp: new Date().toISOString()
      }
    });
    assert(
      unauthorizedDiscountSale.status === 400 && unauthorizedDiscountSale.body.code === 'INVALID_SALE_PRICE',
      'Integridad: Venta con precio o descuento arbitrario no oficial es rechazada con HTTP 400 INVALID_SALE_PRICE'
    );

    // 18. Integridad de Ventas: Intento de registrar unidades equivalentes incongruentes con el combo (HTTP 400)
    const invalidUnitsSale = await request('/api/sales', {
      method: 'POST',
      token: sellerToken,
      body: {
        id: `SALE-INVALID-UNITS-${Date.now()}`,
        shiftId: 'SHIFT-20260831-01',
        sellerId: 'USR-VEND-1',
        itemType: 'combo6',
        varietyId: 'VAR-CLASICO',
        quantityUnitsEquivalent: 5, // Inconsistencia: combo6 exige múltiplos de 6
        totalAmount: 7500,
        paymentMethod: 'efectivo',
        timestamp: new Date().toISOString()
      }
    });
    assert(
      invalidUnitsSale.status === 400 && invalidUnitsSale.body.code === 'UNITS_MISMATCH',
      'Integridad: Venta con unidades incompatibles con el combo (5u en combo6) es rechazada con HTTP 400 UNITS_MISMATCH'
    );

    // 19. Integridad de Ventas: Intento de registrar medio de pago no autorizado (HTTP 400)
    const invalidPaymentSale = await request('/api/sales', {
      method: 'POST',
      token: sellerToken,
      body: {
        id: `SALE-INVALID-PAY-${Date.now()}`,
        shiftId: 'SHIFT-20260831-01',
        sellerId: 'USR-VEND-1',
        itemType: 'combo3',
        varietyId: 'VAR-CLASICO',
        quantityUnitsEquivalent: 3,
        totalAmount: 4000,
        paymentMethod: 'criptomoneda', // Medio inválido
        timestamp: new Date().toISOString()
      }
    });
    assert(
      invalidPaymentSale.status === 400 && invalidPaymentSale.body.code === 'INVALID_PAYMENT_METHOD',
      'Integridad: Venta con medio de pago no soportado ("criptomoneda") es rechazada con HTTP 400 INVALID_PAYMENT_METHOD'
    );

    // 20. Integridad de Ventas: Intento de registrar variedad de producto inexistente en catálogo (HTTP 400)
    const invalidVarietySale = await request('/api/sales', {
      method: 'POST',
      token: sellerToken,
      body: {
        id: `SALE-INVALID-VAR-${Date.now()}`,
        shiftId: 'SHIFT-20260831-01',
        sellerId: 'USR-VEND-1',
        itemType: 'combo3',
        varietyId: 'VAR-FANTASMA', // Variedad inexistente
        quantityUnitsEquivalent: 3,
        totalAmount: 4000,
        paymentMethod: 'efectivo',
        timestamp: new Date().toISOString()
      }
    });
    assert(
      invalidVarietySale.status === 400 && invalidVarietySale.body.code === 'UNKNOWN_VARIETY',
      'Integridad: Venta con variedad inexistente en catálogo es rechazada con HTTP 400 UNKNOWN_VARIETY'
    );

    // 21. SEC-02: Lote offline con venta atribuida a un tercero es rechazado con HTTP 403
    const forgedBatch = await request('/api/sales/sync-batch', {
      method: 'POST',
      token: sellerToken,
      body: {
        sales: [
          {
            id: `SALE-TEST-BATCH-LEGIT-${Date.now()}`,
            shiftId: 'SHIFT-20260830-01',
            sellerId: 'USR-VEND-1',
            itemType: 'combo3',
            varietyId: 'VAR-CLASICO',
            varietyName: 'Tequeño Clásico',
            quantityUnitsEquivalent: 3,
            totalAmount: 4000,
            paymentMethod: 'efectivo',
            timestamp: new Date().toISOString(),
            validationStatus: 'validada'
          },
          {
            id: `SALE-TEST-BATCH-FORGED-${Date.now()}`,
            shiftId: 'SHIFT-20260830-01',
            sellerId: 'USR-VEND-2', // Fraude: venta atribuida a otro vendedor en el lote
            itemType: 'combo6',
            varietyId: 'VAR-CLASICO',
            varietyName: 'Tequeño Clásico',
            quantityUnitsEquivalent: 6,
            totalAmount: 7500,
            paymentMethod: 'efectivo',
            timestamp: new Date().toISOString(),
            validationStatus: 'validada'
          }
        ]
      }
    });
    assert(
      forgedBatch.status === 403 && forgedBatch.body.code === 'FORBIDDEN',
      'SEC-02: Lote offline conteniendo ventas atribuidas a terceros es rechazado con HTTP 403 sin sincronizar'
    );

    // 22. SEC-02: Lote offline con venta asignada a una jornada ajena es rechazado con HTTP 403
    const forgedBatchShift = await request('/api/sales/sync-batch', {
      method: 'POST',
      token: sellerToken,
      body: {
        sales: [
          {
            id: `SALE-TEST-BATCH-WRONGSHIFT-${Date.now()}`,
            shiftId: 'SHIFT-20260830-02', // Jornada de otro vendedor
            sellerId: 'USR-VEND-1',
            itemType: 'combo3',
            varietyId: 'VAR-CLASICO',
            varietyName: 'Tequeño Clásico',
            quantityUnitsEquivalent: 3,
            totalAmount: 4000,
            paymentMethod: 'efectivo',
            timestamp: new Date().toISOString(),
            validationStatus: 'validada'
          }
        ]
      }
    });
    assert(
      forgedBatchShift.status === 403 && forgedBatchShift.body.code === 'FORBIDDEN',
      'SEC-02: Lote offline con ventas asignadas a jornada ajena es rechazado con HTTP 403'
    );

    // 23. Integridad Económica en Lotes: Lote offline con precio adulterado es rechazado atómicamente (HTTP 400)
    const tamperedBatchPrices = await request('/api/sales/sync-batch', {
      method: 'POST',
      token: sellerToken,
      body: {
        sales: [
          {
            id: `SALE-BATCH-VALID-${Date.now()}`,
            shiftId: 'SHIFT-20260830-01',
            sellerId: 'USR-VEND-1',
            itemType: 'combo3',
            varietyId: 'VAR-CLASICO',
            quantityUnitsEquivalent: 3,
            totalAmount: 4000,
            paymentMethod: 'efectivo',
            timestamp: new Date().toISOString()
          },
          {
            id: `SALE-BATCH-CORRUPT-${Date.now()}`,
            shiftId: 'SHIFT-20260830-01',
            sellerId: 'USR-VEND-1',
            itemType: 'combo6',
            varietyId: 'VAR-CLASICO',
            quantityUnitsEquivalent: 6,
            totalAmount: 150, // Precio manipulado en el lote
            paymentMethod: 'efectivo',
            timestamp: new Date().toISOString()
          }
        ]
      }
    });
    assert(
      tamperedBatchPrices.status === 400 && tamperedBatchPrices.body.code === 'INVALID_SALE_PRICE',
      'Integridad Lotes: Lote offline con venta adulterada ($150) es rechazado atómicamente con HTTP 400 sin escrituras parciales'
    );

    // 24. SEC-03: Administrador puede consultar ventas de cualquier jornada
    const adminCheckShiftSales = await request('/api/sales/shift/SHIFT-20260830-02', {
      token: adminToken
    });
    assert(
      adminCheckShiftSales.status === 200 && adminCheckShiftSales.body.success === true,
      'SEC-03: Administrador conserva permisos para consultar ventas de jornadas operativas (no restringido por 403)'
    );

    // 25. SEC-02 / SEC-03: Solicitud de ventas sin token es rechazada con HTTP 401
    const unauthSaleReq = await request('/api/sales', {
      method: 'POST',
      body: { id: 'TEST-NOAUTH', shiftId: 'SHIFT-1' }
    });
    assert(
      unauthSaleReq.status === 401,
      'Solicitud de ventas sin token es rechazada con HTTP 401'
    );

    // 26. Cierre de sesión (Logout) y revocación
    const logoutRes = await request('/api/auth/logout', { method: 'POST', token: sellerToken });
    assert(logoutRes.status === 200 && logoutRes.body.success === true, 'POST /api/auth/logout revoca la sesión');

    // 27. Token revocado ya no permite acceso a /api/auth/me
    const postLogoutMe = await request('/api/auth/me', { token: sellerToken });
    assert(postLogoutMe.status === 401, 'Token revocado es rechazado con HTTP 401');

    // --- PRUEBAS DE MODERNIZACIÓN DE CREDENCIALES (HITO 1.2) ---
    console.log('\n--- HITO 1.2: VALIDACIÓN DE CREDENCIALES Y AUTENTICACIÓN MODERNIZADA ---');

    // 28. Login de Vendedor con código único 'VEND-01' y PIN efímero personal de 8 dígitos
    const modernWorkerLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { userCode: 'VEND-01', pin: sellerPin }
    });
    assert(
      modernWorkerLogin.status === 200 &&
        modernWorkerLogin.body.success === true &&
        modernWorkerLogin.body.user.role === 'seller' &&
        modernWorkerLogin.body.user.userCode === 'VEND-01',
      'Hito 1.2: Login exitoso de Vendedor con userCode VEND-01 y PIN de 8 dígitos'
    );

    // 29. Login con PIN de 8 dígitos sin userCode (debe ser rechazado por Hito 1.2.1)
    const modernWorkerDirectPin = await request('/api/auth/login', {
      method: 'POST',
      body: { pin: sellerPin }
    });
    assert(
      modernWorkerDirectPin.status === 400 &&
        modernWorkerDirectPin.body.code === 'MISSING_USER_CODE',
      'Hito 1.2.1: Login por PIN sin userCode es rechazado estrictamente'
    );

    // 30. Login de Administrador con correo y contraseña de >= 14 caracteres
    const modernAdminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { identifier: 'carlos.admin@tequenosplaya.com', password: adminPassword }
    });
    assert(
      modernAdminLogin.status === 200 &&
        modernAdminLogin.body.success === true &&
        modernAdminLogin.body.user.role === 'admin',
      'Hito 1.2: Login exitoso de Administrador con correo y contraseña (≥14 caracteres)'
    );

    // 31. Login de Administrador con código único 'ADM-01' y contraseña
    const modernAdminByCode = await request('/api/auth/login', {
      method: 'POST',
      body: { identifier: 'ADM-01', password: adminPassword }
    });
    assert(
      modernAdminByCode.status === 200 &&
        modernAdminByCode.body.success === true &&
        modernAdminByCode.body.user.userCode === 'ADM-01',
      'Hito 1.2: Login exitoso de Administrador mediante userCode ADM-01 y contraseña'
    );

    // 32. Rechazo de PIN secuencial (12345678)
    const valSequential = await request('/api/auth/validate-credential', {
      method: 'POST',
      body: { type: 'worker_pin', value: '12345678' }
    });
    assert(
      valSequential.body.isValid === false,
      'Hito 1.2: Validación rechaza PIN secuencial 12345678'
    );

    // 33. Rechazo de PIN repetitivo (00000000 y 11111111)
    const valRepetitive = await request('/api/auth/validate-credential', {
      method: 'POST',
      body: { type: 'worker_pin', value: '00000000' }
    });
    assert(
      valRepetitive.body.isValid === false,
      'Hito 1.2: Validación rechaza PIN repetitivo 00000000'
    );

    // 34. Rechazo de contraseña de admin demasiado corta (< 14 caracteres)
    const valShortPassword = await request('/api/auth/validate-credential', {
      method: 'POST',
      body: { type: 'admin_password', value: 'AdminPass123!' }
    });
    assert(
      valShortPassword.body.isValid === false,
      'Hito 1.2: Validación rechaza contraseña de administrador de menos de 14 caracteres'
    );

    // 35. Aceptación de contraseña de admin segura (≥ 14 caracteres con mayúsculas, minúsculas y caracteres especiales)
    const valStrongPassword = await request('/api/auth/validate-credential', {
      method: 'POST',
      body: { type: 'admin_password', value: adminPassword }
    });
    assert(
      valStrongPassword.body.isValid === true,
      'Hito 1.2: Validación acepta contraseña de administrador segura (≥14 chars con variedad)'
    );

    // 36. Aceptación de PIN de 8 dígitos seguro para trabajador
    const valStrongWorkerPin = await request('/api/auth/validate-credential', {
      method: 'POST',
      body: { type: 'worker_pin', value: sellerPin }
    });
    assert(
      valStrongWorkerPin.body.isValid === true,
      'Hito 1.2: Validación acepta PIN no predecible de 8 dígitos para trabajador'
    );

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
