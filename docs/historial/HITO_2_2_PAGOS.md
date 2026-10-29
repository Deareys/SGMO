# Hito 2.2 — Evidencia bancaria y webhooks Mercado Pago

Fecha: 13 de octubre de 2026. Integración en `codex/sgmo-preparacion-mvp`.

## Prompt operativo

Sustituir exclusivamente los endpoints Mercado Pago inseguros por un router modular con autorización real, precios derivados de ventas centrales y comprobación oficial de importe, moneda y receptor. Rechazar simulaciones productivas y doble asignación de un pago. Persistir notificaciones autenticadas por HMAC antes de responder éxito, procesar sin tareas abandonadas en memoria y permitir reintentos. Mantener OCR como extracción, sin autoridad bancaria. Registrar pruebas, límites, operación y dependencias. No ejecutar migraciones remotas ni llamadas a cuentas reales durante esta intervención.

## Decisiones y contratos

`paymentRouter` se monta en `/api/mercadopago`. `handleMercadoPagoWebhook` puede servir el alias `/api/webhooks/mercadopago`; ambos paths necesitan la excepción exacta del middleware CSRF browser, porque su autenticación es la firma bancaria. Ninguna otra ruta del router queda exenta de cookies/RBAC/CSRF.

- `GET /status`: cuenta autenticada admin/coordinator/seller; informa configuración/modo, sin fragmentos de tokens, correo, identidad del titular ni saldos.
- `POST /create-preference`: requiere `{ saleId }`, cuenta autorizada sobre esa venta y venta digital central pendiente. Importe, moneda ARS y referencia salen del servidor. Los campos amount/title/quantity/payerEmail enviados por el cliente no gobiernan el cobro. URL de regreso usa el origen HTTPS configurado y regresar del checkout no acredita un pago.
- `POST /verify-payment`: requiere `{ saleId, operationId }` (paymentId es alias técnico del puerto); un ID ausente/alfanumérico se rechaza. Sin saleId devuelve 400 SALE_REQUIRED. Sin PostgreSQL o credenciales bancarias devuelve 503 PAYMENT_SERVICE_UNAVAILABLE.
- `GET /recent-payments`: admin/coordinator, resultados sin información del pagador ni tarjeta/documento/email. Un proveedor indisponible devuelve 503.
- `POST /verify`: endpoint legado retirado, HTTP 410; nunca aprueba.
- `GET /webhooks` y `POST /webhooks/:eventId/retry`: sólo administrador, inbox persistido y reprocesamiento mediante consulta oficial.

El flujo de venta debe guardar la intención pendiente con UUID y recibir ACK central antes de crear checkout o reclamar un pago. Una captura OCR previa sólo puede aportar el ID sugerido; la venta offline sigue pendiente. Las vistas de auditoría envían saleId y recargan evidencia central: no elevan localmente un comprobante a dinero acreditado.

## Qué permite acreditar

La respuesta oficial debe tener el ID exacto solicitado, estado approved, live_mode true, monto sin subcentavos, cero reembolso, currency_id ARS y collector_id igual al receptor. El receptor se obtiene de MERCADOPAGO_COLLECTOR_ID configurado o de `/users/me` usando el token del servidor. No se eliminan letras de un ID ni se acepta el importe supuesto del cliente.

La referencia externa, si existe, debe coincidir con la venta. La creación del pago debe corresponder al día de la jornada en America/Argentina/Buenos_Aires, asignado por el servidor, y no anteceder su apertura por más de cinco minutos. Esto impide asignar un pago histórico disponible a una jornada posterior. Los pagos de otra fecha o casos especiales requieren revisión; no hay una excepción que los apruebe por OCR.

`BankPaymentRepository.applyPayment` bloquea jornada y venta en el orden usado por stock/cierre, serializa el ID bancario con advisory lock y aplica las restricciones SQL de `bank_payment_claims`. El ID bancario es único y la venta tiene un único pago asignado. Un intento de reasignación responde 409 PAYMENT_ALREADY_CLAIMED. El ledger permanece reservado aunque el proveedor luego reporte reembolso/cancelación, para impedir reciclar el mismo pago en otra venta.

`date_last_updated` y la evidencia central impiden que una respuesta approved más antigua sobrescriba un reembolso reciente. Un reembolso invalida la evidencia de la venta; no vuelve a escribir importes/liquidaciones de jornadas conciliadas o liquidadas. Las discrepancias posteriores al cierre requieren gestión contable explícita, sin alterar silenciosamente el comprobante de liquidación emitido.

El backend escribe únicamente una proyección de la respuesta oficial, sin datos del pagador. Los clientes, capturas, XML/JSON importados y `existingOperationIds` no constituyen fuente de aprobación ni control distribuido de duplicados. Evidencia JSON heredada sin ledger debe tratarse como no acreditada durante el cierre; el proceso del cierre se integra en el hito global.

## Webhooks durables

Se utiliza el manifest oficial `id:[data.id_url];request-id:[x-request-id_header];ts:[ts_header];` y HMAC-SHA256 con MERCADOPAGO_WEBHOOK_SECRET. Se obtiene data.id de query, no del body. Se exigen campos no ambiguos y digest hexadecimal correcto; la comparación es temporalmente segura. El body debe referir el mismo pago y topic payment. Su supuesto status/importe nunca autoriza dinero.

La migración 008 crea `bank_webhook_events` como inbox persistido y `bank_payment_claims` como ledger. Primero se almacena el evento validado; luego se consulta el recurso oficial y se aplica evidencia si puede asociarse por external_reference o por un claim previo. Un evento sin venta identificable queda unmatched y visible. Un error de API/DB responde 503, mantiene estado recuperable y permite reintento del proveedor o del administrador.

No se envía 200 antes de persistir, no se utiliza fire-and-forget ni arrays de notificaciones en RAM. El identificador del inbox procede del manifest autenticado; repetirlo no crea otra fila. Distintas notificaciones del mismo pago pueden generar varias filas de auditoría; la restricción del ledger evita nuevas asignaciones/duplicación financiera.

Se aceptan timestamps de firma expresados en segundos o milisegundos según los ejemplos oficiales. No se impone un TTL local corto que descarte reintentos tardíos. Reproducir una firma válida sólo permite reprocesar el mismo recurso mediante su estado oficial actual, manteniendo idempotencia y orden de actualización. No acepta un nuevo recurso ni contenido bancario inventado en el body.

## Operación y configuración

1. Aplicar 008 en la base correspondiente mediante el flujo de migraciones revisado. No se ejecutó en Neon durante este trabajo.
2. Configurar MERCADOPAGO_ACCESS_TOKEN (MP_ACCESS_TOKEN sigue como alias), MERCADOPAGO_WEBHOOK_SECRET y, opcionalmente, MERCADOPAGO_COLLECTOR_ID. Usar secretos del servidor, no variables VITE ni archivos públicos.
3. Configurar SGMO_PUBLIC_ORIGIN HTTPS exacto o el VERCEL_URL confiable del servidor. Frontend y `/api` permanecen en el mismo origen.
4. En Tus integraciones de Mercado Pago configurar el webhook público y el tópico payment. Registrar la clave secreta sin publicarla. No se admiten IPN sin firma como alternativa.
5. Verificar venta central real de prueba, importe/receptor, firma, ACK, duplicado y reembolso en un entorno aislado antes de utilizar dinero productivo. Una API que no permita consultar una transferencia bancaria concreta no puede suplirse con OCR: queda pendiente de conciliación.
6. Revisar regularmente eventos failed/unmatched. El endpoint admin retry vuelve a consultar la API. No existe un worker automático ni scheduler en este alcance; no afirmar reprocesamiento autónomo.

Consultas al proveedor tienen timeout de cinco segundos y no imprimen errores/raw payloads. La entrega bancaria real y los límites del hosting todavía requieren pruebas del entorno de despliegue.

## Evidencia y límites

`scripts/tests/payment-security.test.ts`: **8 grupos aprobados**, ejecutando HTTP y simulando provider/Pool. Incluye importe autoritativo, alcance por vendedor/coordinador, moneda/receptor/reembolso/sandbox/fecha/referencia, duplicados, evidencia obsoleta, errores/rollback, checkout, privacidad y webhook HMAC+inbox+reintento. TypeScript aprobado después de integrar los archivos.

Estos mocks no certifican la sintaxis/constraints/concurrencia de 008 contra PostgreSQL real ni que una transferencia de la cuenta del cliente sea consultable. La integración final/CI debe verificar migración, ledger concurrente y operaciones reales aisladas. No se hicieron pagos, webhooks reales, conexiones remotas ni despliegues desde el agente.

`scripts/tests/mp-client-security.test.ts` verifica la señal de acreditación del cliente y que no se envían importe ni supuestas pruebas como autoridad. `npm run build` aprobado tras integrar el router (aviso de bundle grande; sin optimización ajena al alcance). Los resultados SQL adicionales del agente responsable de repositorios y la CI se registran en el informe global del principal.

## Fuentes primarias consultadas

- [Webhooks — documentación oficial Checkout Pro](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/additional-content/notifications/webhooks).
- [Configurar notificaciones y manifest — Mercado Pago](https://www.mercadopago.com.ar/developers/es/docs/wallet-connect/notifications).
- [Obtener pago — referencia oficial de campos](https://www.mercadopago.com.ar/developers/es/reference/online-payments/subscriptions/get-payment/get).
- [Webhooks schema oficial](https://github.com/mercadopago/openapi/blob/main/schemas/webhooks.yaml).

Se consultaron el 13 de octubre de 2026. Las reglas locales de fecha, origen, persistencia, alcance y conservación de liquidaciones son decisiones de SGMO; no requisitos atribuidos al proveedor.
