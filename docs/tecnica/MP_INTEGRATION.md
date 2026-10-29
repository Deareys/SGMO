# MP_INTEGRATION.md — Integración con Mercado Pago y Diagnóstico de Vercel

> **Actualización 13/10/2026:** el contenido histórico puede describir prototipo/localStorage o contratos sustituidos. Para alcance vigente, pruebas y pendientes leer [HITOS_Y_PROMPTS_MVP.md](../historial/HITOS_Y_PROMPTS_MVP.md), [GUIA_SEBAS.md](../guia/GUIA_SEBAS.md), [CI.md](../pruebas/CI.md) y los módulos nuevos. “Implementado” no certifica producción ni datos compartidos de todas las pantallas.


> **Sistema:** SGMO — Tequeños Costa  
> **Versión:** 0.6.0  
> **Tema Central:** Diagnóstico de fallos en Vercel, credenciales Sandbox vs. Producción, flujo de cobro y verificación anti-fraude.

---

## 1. DIAGNÓSTICO PROFUNDO: ¿POR QUÉ FALLA EN VERCEL?

El usuario reportó que al desplegar en Vercel, el sistema de Mercado Pago "no funciona" y sospechaba de los secretos de prueba. Tras la inspección técnica del código fuente y la arquitectura de despliegue, **el diagnóstico exacto consta de dos causas críticas combinadas**:

### Causa 1: Desconexión del Servidor Express (La Causa Principal)
1. **El modelo de ejecución del proyecto:**
   - La aplicación está concebida como un servidor Node.js continuo (`server.ts` con Express 4.21).
   - En el entorno de desarrollo y pruebas locales, se inicia mediante `"dev": "tsx server.ts"`.
   - `server.ts` aloja los endpoints:
     - `POST /api/mercadopago/create-preference`
     - `POST /api/mercadopago/verify-payment`
     - `POST /api/mercadopago/webhook`
     - `GET  /api/mercadopago/status`
2. **El modelo de ejecución de Vercel:**
   - Vercel es una plataforma orientada a sitios estáticos y **Funciones Serverless independientes**.
   - Vercel **no ejecuta automáticamente un archivo `server.ts` continuo de Express** a menos que:
     - Exista una configuración explícita en `vercel.json` que redirija todas las peticiones a un handler Serverless.
     - O los endpoints estén descompuestos en archivos independientes dentro de la carpeta `/api` (ej: `/api/mercadopago/verify-payment.ts`).
3. **El síntoma en el navegador:**
   - Cuando el frontend React hace una petición `fetch('/api/mercadopago/verify-payment')` en Vercel:
     - El enrutador de Vercel busca una función Serverless o un archivo estático. Al no encontrarlo, **retorna un código HTTP 404** o el propio archivo estático `index.html` (comportamiento típico de fallback SPA).
     - El frontend intenta parsear `response.json()` sobre un HTML y lanza un error de sintaxis JSON (`Unexpected token '<'`).
     - Al capturar este error, `aiValidationService.ts` activa el fallback simulado, haciendo que parezca que todo "funciona de mentira", pero jamás interactuó con la API de Mercado Pago.

### Causa 2: Gestión de Variables de Entorno y Secretos en Vercel
1. El backend en `server.ts` busca `process.env.MERCADOPAGO_ACCESS_TOKEN`.
2. En Vercel:
   - Si las variables no fueron cargadas en el panel de configuración de Vercel (**Project Settings -> Environment Variables**), `process.env.MERCADOPAGO_ACCESS_TOKEN` será `undefined`.
   - Las variables que comienzan con `VITE_` (como `VITE_MERCADOPAGO_PUBLIC_KEY`) sí se incrustan en el cliente durante el build de Vite, pero **el Access Token (`TEST-...` o `APP_USR-...`) NUNCA debe tener el prefijo `VITE_`**, ya que exponerlo en el cliente permitiría a cualquier usuario robar los fondos o acceder a la cuenta de Mercado Pago.
3. Para que funcione en Vercel, es obligatorio que `MERCADOPAGO_ACCESS_TOKEN` esté configurado en el servidor, no en el cliente.

### Causa 3: Credenciales Sandbox vs. Producción
1. Las credenciales de prueba comienzan con el prefijo **`TEST-`** (ej: `TEST-681707973060-...`).
2. **Limitaciones inquebrantables del Sandbox de Mercado Pago:**
   - **No se puede pagar con dinero real ni con tarjetas reales.**
   - **No se puede pagar desde una cuenta de Mercado Pago real.**
   - Para probar un Checkout en Sandbox, se deben usar:
     - Cuentas de prueba de comprador creadas en el panel de Mercado Pago Developers.
     - O tarjetas de crédito de prueba oficiales de Mercado Pago (disponibles en la pestaña de Ayuda del modal `MercadoPagoTestLabModal.tsx`).
   - Si un usuario en producción intenta escanear el QR o abrir el link de Checkout generado con un token `TEST-` usando su app de Mercado Pago personal en su celular, **Mercado Pago rechazará la operación con un error indicando que el vendedor y el comprador son inválidos o que no se pueden procesar pagos reales en modo sandbox.**

---

## 2. MAPA DE ENDPOINTS IMPLEMENTADOS EN `server.ts`

### 2.1 `GET /api/mercadopago/status`
- **Propósito:** Diagnóstico en vivo de la conexión con Mercado Pago.
- **Respuesta:**
  ```json
  {
    "isConfigured": true,
    "hasAccessToken": true,
    "tokenPrefix": "TEST-",
    "mode": "sandbox",
    "publicKey": "APP_USR-...",
    "webhookUrl": "https://midominio.com/api/mercadopago/webhook"
  }
  ```

### 2.2 `POST /api/mercadopago/create-preference`
- **Propósito:** Crear una preferencia de pago oficial para que el cliente pague en el carrito mediante Checkout Pro (QR o link de pago).
- **Parámetros recibidos:**
  ```json
  {
    "title": "Combo 6 Tequeños + Salsa",
    "quantity": 1,
    "unitPrice": 8500,
    "externalReference": "shift-1-sale-1728000000"
  }
  ```
- **Respuesta:** `initPoint` (link para pagar en producción) y `sandboxInitPoint` (link para pagar en modo test).

### 2.3 `POST /api/mercadopago/verify-payment`
- **Propósito:** Consultar directamente a la API oficial de Mercado Pago (`https://api.mercadopago.com/v1/payments/{paymentId}`) para constatar que el dinero ingresó realmente a la cuenta bancaria.
- **Regla anti-fraude:** Compara:
  - `status === 'approved'`
  - `transaction_amount >= expectedAmount`
  - `external_reference === expectedReference`

### 2.4 `POST /api/mercadopago/webhook`
- **Propósito:** Receptor de notificaciones IPN (Instant Payment Notification). Mercado Pago envía un POST cada vez que un cobro cambia de estado (`payment.created`, `payment.updated`).
- **Estado Actual:** Recibe el evento y lo apila en un array en memoria RAM (`receivedWebhooks`).
- **Riesgo:** Si el servidor se reinicia, el historial se borra. Requiere guardarse en base de datos.

---

## 3. DIFERENCIACIÓN CRÍTICA: OCR (GEMINI) VS. VERIFICACIÓN BANCARIA (API MP)

Uno de los mayores riesgos detectados en la auditoría es la confusión entre "leer un comprobante con IA" y "verificar un pago".

```
+-----------------------------------------------------------------------------------+
| FLUJO CORRECTO DE VERIFICACIÓN DE PAGOS DIGITALES                                 |
+-----------------------------------------------------------------------------------+

   [Comprador muestra pantalla de su celular con comprobante]
                          │
                          ▼
   [Vendedor toma foto con CameraCaptureModal]
                          │
                          ▼
   [Google Gemini OCR (/api/ai/validate-voucher)]
   - Extrae: Nro de Operación (#987654321), Importe ($8.500), Fecha y Banco.
   - Detecta anomalías visuales (tipografías trucadas, montajes fotográficos).
   - ¡ATENCIÓN!: Esto SOLO certifica que la IMAGEN dice eso. NO CERTIFICA que el dinero esté en la cuenta.
                          │
                          ▼
   [Verificación contra Base de Datos Local / Central]
   - ¿Este Nro de Operación ya fue ingresado hoy por otro vendedor?
     -> SÍ: ¡ALERTA DE FRAUDE / DOBLE GASTO! Rechazo inmediato.
     -> NO: Se continúa.
                          │
                          ▼
   [Consulta a la API de Mercado Pago o Webhook (/api/mercadopago/verify-payment)]
   - Consulta bancaria oficial con token de acceso seguro.
   - Si status === 'approved' y monto coincide:
     ===> PAGO REALMENTE VERIFICADO Y CONFIRMADO.
```

---

## 4. GUÍA DE PASOS PARA HABILITAR MERCADO PAGO EN PRODUCCIÓN

Para que el sistema cobre con Mercado Pago real durante la temporada de playa:

1. **Obtener Credenciales de Producción:**
   - Ingresar a [Mercado Pago Developers](https://www.mercadopago.com.ar/developers).
   - Ir a **Tus integraciones** -> Seleccionar la aplicación.
   - En el menú lateral, ir a **Credenciales de Producción**.
   - Copiar el **Access Token de Producción** (comienza con `APP_USR-`) y la **Public Key de Producción**.
2. **Configuración del Hosting:**
   - Si se usa Vercel:
     - Configurar `vercel.json` para enrutar `/api/(.*)` a la función Serverless que ejecute `server.ts` o migrar las rutas a `/api/*.ts`.
     - En el panel de Vercel, agregar la variable de entorno secreta:
       - `MERCADOPAGO_ACCESS_TOKEN = APP_USR-...`
       - `GEMINI_API_KEY = AIzaSy...`
   - Si se usa un contenedor (Google Cloud Run / Railway / VPS):
     - Configurar el comando de inicio `"start": "node dist/server.js"`.
     - Cargar las variables de entorno en el contenedor.
3. **Configuración de Webhooks en Mercado Pago:**
   - En el panel de desarrollador de Mercado Pago, registrar la URL pública del webhook:
     `https://midominio.com/api/mercadopago/webhook`
   - Seleccionar los eventos: `Pagos (payment)`.

---

## 5. REGLA MAESTRA DE BLINDAJE FINANCIERO (V0.7.2)

> **REGLA FINANCIERA INQUEBRANTABLE:**  
> **"La aplicación nunca debe considerar confirmado un pago sin confirmación positiva de Mercado Pago."**  
> `AUSENCIA DE CONFIRMACIÓN POSITIVA DE MERCADO PAGO = PAGO NO CONFIRMADO`

### Principios Operativos Aplicados:
1. **Erradicación del Aprobado Heurístico:**
   - Se eliminaron todos los fallbacks que aprobaban operaciones por tener $\ge 6$ dígitos numéricos o por no contener palabras clave.
   - Si no hay credenciales en el servidor, si la API devuelve error (400, 500), si el pago no existe (404), o si no hay conexión a internet en la playa, el resultado es estrictamente `verified: false` y `status: 'pendiente_revision'` / `'pendiente_acreditacion'`.
2. **Separación Estricta entre OCR y Validación Bancaria:**
   - La inteligencia artificial (Gemini) cumple una función de **visión y extracción de datos estructurados**, nunca de autoridad de acreditación financiera.
   - Un comprobante escaneado con importe correcto y tipografía legible queda en estado `pendiente_revision` hasta que la API oficial de Mercado Pago o el coordinador en base confirmen el ingreso del dinero.
3. **Cálculo de Caja y Arqueo Salarial:**
   - Los pagos no confirmados se totalizan en `mpPendingOrSuspiciousAmount` y **nunca** se suman a `mpValidatedAmount`.
   - El comprobante oficial de liquidación en PDF y los reportes de arqueo desglosan explícitamente el monto validado real vs. el monto observado/pendiente.
