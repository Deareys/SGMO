# SGMO: conectar credenciales y verificar servicios

Fecha de inspección: 14 de octubre de 2026, Argentina. Alcance: lectura de configuración y consultas SQL; preparación de instrucciones. No se aplicaron migraciones, no se cambiaron variables remotas y no se procesaron cobros.

## Estado comprobado

| Servicio | Evidencia actual | Lo que falta |
| --- | --- | --- |
| GitHub | Rama `codex/sgmo-preparacion-mvp`, PR #2 abierto. Código inspeccionado en `6132bffab2636ca17602bca97712be35023544a8` | Verificar la revisión que finalmente ejecuta Vercel |
| Vercel | Proyecto `sgmo`; preview de esa revisión en estado READY. Conexión de ChatGPT permite leer proyecto, deployments y nombres de variables | Las solicitudes a health/status y la generación de acceso temporal reciben 403 en la protección de Vercel; no certifican el backend |
| Variables Vercel | Sólo `GEMINI_API_KEY` y `APP_URL`, ambas para production/preview. Consulta sin descifrar valores; cero variables de producción ocultas según la respuesta | PostgreSQL, configuración de origen, Mercado Pago y alta inicial |
| Neon | Proyecto `SGMO -  costa` (`still-mud-30172607`), rama `production` (`br-fancy-unit-b67bv6j9`), base `neondb`. Consulta SQL exitosa | El esquema público tiene cero tablas; falta instalar/revisar el esquema SGMO |
| Mercado Pago | Credenciales no presentes en el inventario de variables consultado | Obtener acceso de la cuenta receptora y comprobar API/webhooks oficiales |
| Gemini | Nombre de variable presente | Verificar proyecto, facturación, modelo y extracción real; presencia de clave no demuestra validez |

Neon conectado a ChatGPT y PostgreSQL conectado al backend son comprobaciones diferentes. Los datos que pudieran existir en navegadores no se trasladan automáticamente a Neon. Este estado actualiza los pendientes de entorno de los informes anteriores, conservando su historial.

## 1. Acceso para quien verifica

Vercel y Neon ya están conectados a este chat. Para futuras sesiones, conectar las cuentas que contienen SGMO y autorizar su proyecto y ámbito propietario. GitHub conserva el código; Vercel ejecuta la app; Neon conserva los datos compartidos.

El acceso protegido de Vercel aún devuelve 403 incluso indicando el proyecto y su ámbito propietario. Revisar el alcance de la conexión de Vercel y la capacidad de acceso al deployment. Si ya están autorizados, revisar los permisos específicos de la cuenta; volver a iniciar sesión por sí solo no demuestra que se resolvió. No compartir enlaces con parámetros privados de acceso en documentación pública.

Las claves de Mercado Pago y Gemini se configuran en el servidor de SGMO. No hace falta publicarlas en GitHub ni enviarlas por el chat para que la app las use. Las pruebas administrativas también necesitan una sesión autorizada de SGMO.

## 2. Preparar la base de ensayo en Neon

1. Abrir https://console.neon.tech y seleccionar `SGMO -  costa`.
2. En Branches, crear una rama de ensayo llamada `sgmo-pruebas` desde la rama actual. Identificar su ID y mantenerla separada de `production`. Las ramas Neon y las ramas GitHub son independientes.
3. En Connect, seleccionar esa rama, la base `neondb` y el rol autorizado.
4. Para Vercel, copiar la cadena PostgreSQL con Connection pooling activado. Copiar únicamente la URL que comienza por `postgresql://`, sin el comando `psql` ni comillas externas.
5. Guardar esa cadena como `DATABASE_URL`, tipo Secret, en Preview y restringida a la rama GitHub `codex/sgmo-preparacion-mvp`.

Ejemplo ficticio, no utilizable:

```text
postgresql://USUARIO:CONTRASENA@HOST-pooler.aws.neon.tech/neondb?sslmode=require
```

Para migraciones se prepara una conexión directa, obtenida desactivando Connection pooling, dentro de un entorno privado del operador. No reemplazar la conexión de la app por una URL inventada ni reducir la verificación TLS.

Una conexión exitosa no crea tablas. El operador debe revisar y aplicar las migraciones 001–008 sobre la rama de ensayo, comprobar resultados y provisionar usuarios. El script `npm run db:migrate -- --apply` exige una `.env` privada y `SGMO_MIGRATION_TARGET=host/base` exactamente igual al destino; no ejecutarlo contra `production` como prueba. La migración 005 invalida credenciales heredadas una vez. Antes de actualizar una base existente, preparar y verificar respaldo/copia. El contenido observado hoy no sustituye una inspección justo antes de migrar.

## 3. Variables en Vercel

Abrir https://vercel.com/dashboard, entrar al proyecto `sgmo` y a Settings → Environment Variables. Para el ensayo seleccionar Preview y la rama `codex/sgmo-preparacion-mvp`. Cada clave va en una fila distinta. Escribir valores sin comillas externas ni espacios añadidos.

Vercel permite elegir Config o Secret; en interfaces anteriores la opción equivalente era Sensitive. El API puede seguir mostrando el tipo `sensitive`. Los Secrets siguen disponibles al servidor después de guardarlos, aunque su valor no pueda recuperarse desde la interfaz.

| Variable exacta | Valor/origen | Tipo | Necesidad |
| --- | --- | --- | --- |
| `DATABASE_URL` | Cadena de la rama Neon de ensayo, con pooling | Secret | Base y autenticación |
| `DATABASE_SSL` | `true` | Config | TLS de PostgreSQL |
| `SGMO_AUTH_MODE` | `central` | Config | Autenticación normal |
| `SGMO_PUBLIC_ORIGIN` | Origen HTTPS exacto usado para abrir la app, sin barra final ni `/api` | Config | Cookies, CSRF y enlaces de cobro |
| `SGMO_ENABLE_API_TOKENS` | `false` | Config | Mantener transporte de navegador con cookies |
| `GEMINI_API_KEY` | Clave Gemini del proyecto con facturación/cupo previsto; ya hay una configurada | Secret | OCR |
| `MERCADOPAGO_ACCESS_TOKEN` | Access Token del entorno/cuenta receptora apropiados | Secret | Consulta bancaria y Checkout Pro |
| `MERCADOPAGO_WEBHOOK_SECRET` | Firma secreta de Webhooks del mismo entorno | Secret | Autenticar avisos bancarios |
| `MERCADOPAGO_COLLECTOR_ID` | ID numérico de la cuenta receptora del entorno de prueba | Config | Recomendado; si falta, el servidor intenta obtenerlo mediante `/users/me` |
| `BOOTSTRAP_SECRET` | Secreto aleatorio de al menos 32 caracteres generado en un gestor de contraseñas | Secret | Temporal, sólo para el primer administrador |

`APP_URL` ya existe y no sustituye `SGMO_PUBLIC_ORIGIN` en el código actual. `DATABASE_SSL_CA` se reserva para un proveedor que necesite una CA privada; no se necesita inventar ese valor para Neon. Las variables `SGMO_DEMO_*` corresponden únicamente a demo local aislada.

Elegir un dominio de preview estable y abrir siempre ese origen para el ensayo. Si `SGMO_PUBLIC_ORIGIN` apunta a otro dominio, las escrituras pueden responder `ORIGIN_REJECTED` o `CSRF_REJECTED`. El fallback `VERCEL_URL` corresponde al deployment y puede diferir del alias de rama que se usa en el navegador.

Las claves deben conservar sus nombres exactos de servidor; agregarles un prefijo público como `VITE_` las expondría al cliente.

Después de guardar, entrar en Deployments y hacer Redeploy del preview de la rama de trabajo. Los cambios sólo llegan a deployments nuevos. Verificar branch, commit, dominio y estado READY después. Las credenciales productivas se configuran separadamente cuando se termina el ensayo.

## 4. Mercado Pago

1. Abrir https://www.mercadopago.com.ar/developers/es con la cuenta receptora del negocio y entrar en Tus integraciones.
2. Seleccionar o crear la aplicación de SGMO con Checkout Pro. El código actual crea preferencias mediante `/checkout/preferences` y consulta pagos mediante `/v1/payments`; no implementa Orders ni una integración QR independiente.
3. Para el ensayo seguir la preparación de cuentas/credenciales de Checkout Pro basado en preferencias. Mantener comprador y vendedor de prueba diferenciados. Guardar el Access Token correspondiente en `MERCADOPAGO_ACCESS_TOKEN` de Preview. El receptor configurado debe corresponder a ese mismo entorno.
4. Para cobros reales, obtener/activar las credenciales productivas de la cuenta receptora y guardarlas después en el entorno productivo. La Public Key, Client ID y Client Secret no se consumen en este flujo actual.

El prefijo de un token no basta para demostrar el entorno ni su validez. La verificación depende de la respuesta oficial, incluido `live_mode`. Un pago de sandbox puede servir para probar integración, pero SGMO no lo convierte en dinero real acreditado.

### Webhooks

En la misma aplicación: Webhooks → Configurar notificaciones. Seleccionar el entorno correspondiente y el evento Pagos (`payment`). Configurar la URL HTTPS de SGMO:

```text
https://DOMINIO-DEL-ENSAYO/api/mercadopago/webhook
```

Guardar la firma secreta generada por Mercado Pago en `MERCADOPAGO_WEBHOOK_SECRET` del mismo entorno y redeployar. Esa firma es diferente del Access Token.

Mercado Pago debe alcanzar esa URL sin una sesión de Vercel. La protección observada hoy es un bloqueo pendiente. Resolver un acceso de ensayo adecuado al plan y comprobarlo; no interpretar una página Login – Vercel como un error del webhook de SGMO.

El backend define `notification_url` al crear la preferencia. Esa URL tiene prioridad sobre la del panel; debe comprobarse su acceso real. Añadir un parámetro privado solamente en el panel no resuelve necesariamente el flujo generado por el código.

Un webhook válido se persiste y después se consulta su pago oficial. Una notificación simulada con un ID inexistente no demuestra que se haya conciliado un pago. Firma, recurso, cuenta, importe, estado y unicidad se prueban por separado.

Para las transferencias, probar el tipo de operación que realmente utilizan los clientes. Todavía no se ha demostrado que todos los números impresos en comprobantes externos sean IDs consultables con esta API y cuenta. Si no se pueden consultar, se necesita definir e implementar una conciliación compatible; no aprobar por OCR.

## 5. Gemini y OCR

Ya hay una `GEMINI_API_KEY` configurada. En https://aistudio.google.com, ir a API Keys y comprobar a qué proyecto pertenece. Confirmar la facturación/saldo y cupo de API de ese proyecto. Los créditos de un proyecto o servicio diferente no verifican el cupo de esta clave.

Si hace falta otra clave, crearla para el proyecto elegido, restringir su uso a Gemini API y reemplazar la variable Secret en Preview; luego redeployar. Se usa desde Express, por lo que una restricción de sitios web pensada para llamadas del navegador no describe este uso.

El ensayo usa un comprobante ficticio claramente marcado como prueba y verifica que el endpoint `/api/ai/validate-voucher` devuelve una extracción utilizable (`extractionSucceeded: true`) con campos correctos. Una respuesta HTTP 200 con extracción fallida no demuestra OCR activo. La lectura OCR no marca un pago como acreditado.

## 6. Primer administrador

Con esquema preparado en la rama de ensayo, identificar en SQL el perfil admin activo sin aprovisionar. En una instalación nueva con las semillas actuales normalmente será `ADM-01`; confirmarlo antes.

`BOOTSTRAP_SECRET` habilita el procedimiento inicial del operador. `POST /api/auth/bootstrap-admin` recibe `{ identifier, newPassword, bootstrapSecret }` y exige la protección del navegador/CSRF o un transporte API habilitado explícitamente. La contraseña del administrador debe cumplir la validación actual: al menos 14 caracteres, mayúscula/minúscula y número o símbolo. No es necesario publicar contraseña o secreto en este documento.

Después del alta y login comprobados, retirar `BOOTSTRAP_SECRET` y redeployar. Crear/aprovisionar las cuentas de coordinación y vendedores desde Administración. No usar bootstrap para restablecer un administrador que ya fue aprovisionado. Detalles en [AUTHENTICATION.md](AUTHENTICATION.md).

## 7. Evidencias para confirmar que funciona

Usar el mismo dominio de ensayo en todos los pasos.

| Comprobación | Resultado exigido | Qué aún no demuestra |
| --- | --- | --- |
| Abrir `/api/health` | JSON con `status: "ok"`, `authTransport: "httpOnly-cookie"` y revisión esperada | Conexión a PostgreSQL o proveedores |
| Abrir `/api/db/status` | `configured: true` y `connected: true` | Existencia/estado de tablas; puede devolver HTTP 200 aunque `connected` sea false |
| Login, bootstrap y recarga | Sesión central válida; datos autorizados; cookie HttpOnly/Secure; `/api/auth/me` funciona | Venta/stock correctos por sí solos |
| Dos dispositivos | Cambio confirmado en uno leído en otro con permisos correctos | Cola offline completamente resuelta |
| `/api/mercadopago/status` con sesión | Credencial configurada | Token válido o depósito acreditado; la ruta sólo comprueba presencia |
| Consulta bancaria autorizada y venta vinculada | API oficial accesible, cuenta esperada y pago asociado a una venta central | Sandbox no acredita dinero real |
| Aviso bancario | Firma válida, evento durable, consulta oficial y reintento sin duplicado | Un simple ping no prueba conciliación |
| OCR real | Campos extraídos del documento de prueba y `extractionSucceeded: true` | Acreditación bancaria |

Registrar sólo estados, códigos HTTP, revisión y conteos necesarios. Mantener credenciales, datos personales de pagadores y enlaces privados fuera de logs compartidos.

Para pedir continuidad basta confirmar qué variables se guardaron, en qué entorno y el dominio de ensayo. No enviar valores secretos. El recorrido completo de venta/cierre está en [GUIA_SEBAS.md](GUIA_SEBAS.md).

## Prompt de este hito

```text
Hito 3.0.1: preparación de credenciales y verificación de conexiones.
Inspeccionar variables y contratos reales de SGMO. Consultar documentación oficial vigente y conectar Vercel/Neon mediante integraciones autorizadas. Leer proyectos, deployments, nombres de variables y estructura SQL sin revelar secretos ni modificar datos. Diferenciar conexión del operador, conexión de la app, presencia de clave y prueba real del proveedor. Documentar nombres exactos, entorno Preview separado, origen HTTPS, TLS, primer administrador, Mercado Pago por preferencias/payment, firma de avisos y Gemini. Registrar 403 de protección y cualquier prueba que no se pudo completar. Publicar la guía preservando cambios de terceros; no aplicar migraciones remotas ni procesar cobros en este hito.
```

## Documentación primaria consultada

- Vercel, Config/Secret: https://vercel.com/changelog/environment-variables-now-use-config-and-secret-types
- Vercel, ámbitos de variables: https://vercel.com/docs/environment-variables
- Vercel, redeploy y secretos: https://vercel.com/docs/environment-variables/rotating-secrets
- Neon, conexiones: https://neon.com/docs/connect/connect-from-any-app
- Neon, ramas: https://neon.com/docs/manage/branches
- Mercado Pago, credenciales: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/credentials
- Mercado Pago, Webhooks por preferencias: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/additional-content/notifications/webhooks
- Mercado Pago, compras de prueba: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/integration-test/test-purchases
- Gemini, claves: https://ai.google.dev/gemini-api/docs/api-key
- Gemini, facturación: https://ai.google.dev/gemini-api/docs/billing
