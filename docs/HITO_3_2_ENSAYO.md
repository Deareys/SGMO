# Hito 3.2: inicialización del ensayo y acceso al preview

Fecha: 15 de octubre de 2026, Argentina. Estado: base de ensayo y acceso autorizado comprobados; operación HTTP aprobada. OCR bloqueado por facturación del proveedor (402). Producción no certificada.

Sebas autorizó continuar con la base de ensayo y resolver el acceso autorizado al preview. El alcance es la rama Neon `sgmo-pruebas` (`br-solitary-base-b6xjzp4s`), base `neondb`, del proyecto `still-mud-30172607`, y el preview de `codex/sgmo-preparacion-mvp`. Esta autorización específica permite la inicialización remota de ensayo; no cambia reglas para auxiliares ni implica integrar main o operar sobre la rama Neon production.

Antes de migrar se confirmó cero tablas públicas y se creó el respaldo `sgmo-pruebas-pre-migracion-20261015` (`br-mute-unit-b6up0ykz`), sin compute. Se aplicaron las migraciones 001–008 en una transacción con control de base vacía y registro de versiones. La primera llamada fue rechazada por instrucciones múltiples en una consulta preparada y revirtió; se comprobó nuevamente cero tablas. La segunda separó las instrucciones respetando strings, comentarios y bloques dollar-quoted, con reconstrucción exacta de cada archivo, y confirmó las ocho versiones atómicamente.

Estado SQL inmediatamente después de migrar: 21 tablas públicas, ocho migraciones, seis perfiles semilla sin credenciales, cero ventas, cero jornadas y cero filas de stock. Pruebas de unicidad de código de usuario, rechazo de hash inválido e inventario negativo aprobaron sin dejar usuarios o stock de prueba. El esquema de la rama production no se modificó. El ensayo operativo posterior dejó un historial ficticio identificado, descrito más abajo.

La API autorizada permitió crear un acceso temporal de una hora para el deployment de ensayo. El secreto de ese enlace se conserva fuera de esta documentación. No se deshabilita Deployment Protection ni se publica el enlace privado.

El acceso se generó mediante `patch_url_protection_bypass` sobre el deployment concreto, con `ttl: 3600`, usando el alcance por defecto de la conexión. La consulta previa de bypass y las herramientas de logs siguen devolviendo 403. Con el enlace temporal y cookies privadas las peticiones ya alcanzaron la función, que respondió 500 `FUNCTION_INVOCATION_FAILED`, incluido health.

## Reparación de arranque confirmada

Se reprodujo un defecto concreto al emitir el backend como ESM y cargarlo con Node nativo: `ERR_MODULE_NOT_FOUND` en los imports relativos sin extensión. Se corrigieron exclusivamente los especificadores usados en el grafo de ejecución para incluir `.js` y `index.js` cuando corresponde, manteniendo TypeScript/React/Express y las reglas del negocio. La prueba nueva `backend-esm-entry.test.ts` compila el grafo, lo carga sin tsx y solicita health por HTTP. Falló antes de los cambios y aprobó después. La comprobación remota posterior confirmó que el preview inicia correctamente.

Verificación local de la reparación: tipos, suite completa (175 casos), build y 35 regresiones de autenticación aprobaron. El cambio de arranque se limita a especificadores de importación; no modifica operaciones SQL, precios, comisiones o autorizaciones.

Confirmación real: deployment `dpl_Hwn6zU3czj1vB32pxQuqbDvrRkeX`, commit `bfbd292e7b90b8598780ac1c6d7327d67deffaa2`, estado READY. La página responde 200; `/api/health` devuelve JSON 200 y esa revisión; `/api/db/status` devuelve `configured:true, connected:true`. Actions `38678468051` aprobó. La reparación sí resolvió el fallo de arranque observado en el preview.

## Ensayo HTTP con datos ficticios

Se aprovisionó por operación SQL una cuenta QA administrativa temporal, con contraseña aleatoria fuerte y scrypt de la implementación real. No se utilizó ni sustituyó `BOOTSTRAP_SECRET`; esta preparación no certifica el endpoint HTTP de bootstrap inicial. Las credenciales de QA nunca se publicaron y ya se retiraron para conservar disponible el aprovisionamiento del administrador propio.

Login administrador y trabajador con cookie HttpOnly/Secure/SameSite Strict aprobaron contra Neon. Se rechazaron acceso anónimo, PIN sin identificador, escritura sin CSRF, origen ajeno, enumeración de usuarios por vendedor y lectura de jornada ajena. Recursos de ensayo usan prefijos QA y nombres ENSAYO. El catálogo original no se sobrescribe.

Se confirmó despacho de diez unidades ficticias sobre treinta de stock, precio adulterado rechazado, venta offline con ACK central, reenvío con cero inserciones y consulta de la misma venta desde otra sesión. El servidor rechazó también un `sellerId` ajeno; se corrigió la fixture para probar precio sin alterar identidad. La prueba operativa inicial esperaba 200 al crear jornada; el contrato devuelve correctamente 201.

## Proveedores reales

Mercado Pago: `/recent-payments` devolvió 200 y dos resultados de la cuenta configurada desde la API oficial. Fue sólo lectura: no se crearon cobros y no se asignaron esos pagos a ventas QA. Esto no certifica un cobro nuevo, conciliación, `live_mode` ni entrega de webhooks. El prefijo del token no basta para certificar su entorno financiero.

OCR: la primera imagen generada para el ensayo, con marca SIN VALIDEZ y datos ficticios, produjo HTTP 200 pero `extractionSucceeded:false`, sin operación ni importe inventados y sin acreditación bancaria. El servidor ocultaba la diferencia entre error del proveedor y lectura incompleta. Se añadió `ocrFailure`, diagnóstico acotado sin mensajes/URLs/claves del SDK, y se detienen cambios de modelo ante errores 400/401/402/403. Se preservan los reintentos de contingencia existentes para errores transitorios. La comprobación del diagnóstico y del alias se realizó en dos deployments nuevos.

En la revisión `6662d271958c72dd8524e56138d2603e48c1db3f`, desplegada y con Actions aprobado (`38679556634`), el diagnóstico devolvió `NOT_CONFIGURED`. La configuración específica de esta rama tenía `GIMINI_API_KEY`, un nombre no consumido por SGMO; también existe una entrada global correctamente nombrada, cuya presencia por sí sola no garantizó un cliente disponible en el deployment. Se intentó corregir sólo el nombre de la entrada específica, pero Vercel rechazó la operación con 400: los Secrets no admiten cambio de nombre. No se alteró ningún valor o alcance. Para aprovechar la configuración existente sin leer ni recrear secretos, el backend acepta `GIMINI_API_KEY` como alias de compatibilidad sólo si falta o está vacía la canónica `GEMINI_API_KEY`. La canónica conserva prioridad y ambos nombres quedan fuera del frontend. El deployment nuevo y su resultado se detallan más abajo.

El cierre de la jornada ficticia quedó `conciliada`. Consulta SQL independiente: una venta de $1500 ficticios, una unidad vendida, nueve devueltas, ninguna merma, diferencia física cero, caja declarada/esperada $1500 y diferencia de caja cero. La casa quedó con 29 de las 30 unidades ficticias iniciales. Cero asignaciones de pagos bancarios. Logout del vendedor confirmado y sesión posterior rechazada.

Verificación de la corrección de diagnóstico: tipos, 177 pruebas, build y 35 regresiones aprobaron. El diagnóstico usa una allowlist de razones y no expone mensajes o metadatos del SDK.

Resultado final de OCR en `aec673f8ae2af82c413862c09535e6bcf48c7b26`, deployment `dpl_Fxuogv1djdu2rnJoxD5XqSszrURn`: health y login 200; el backend pudo iniciar la llamada y Gemini devolvió **402**, reportado como `ocrFailure: { code: "BILLING_REQUIRED", httpStatus: 402 }`. La respuesta funcional permanece `extractionSucceeded:false`, operación vacía, importe cero y `mpApiMatched:false`. **La extracción no está aprobada.** No se infiere saldo, cuenta de facturación concreta ni validez general de la clave desde este código; hay que revisar el proyecto y su facturación.

Google documenta el 402 como crédito Prepay agotado y recomienda resolverlo en la cuenta de facturación en vez de reintentar. Referencias oficiales: [errores de API](https://ai.google.dev/gemini-api/docs/api-errors), [facturación](https://ai.google.dev/gemini-api/docs/billing). Abrir AI Studio → API Keys, identificar el proyecto de la clave usada en Preview y revisar Billing/Usage de esa misma cuenta/proyecto. Tener créditos en otro proyecto o producto no demuestra que esta llamada tenga saldo utilizable. No se añadieron créditos ni se cambiaron condiciones de facturación.

Actions del código final: [38680069628](https://github.com/Deareys/SGMO/actions/runs/38680069628), aprobado. Local: tipos, 177 pruebas, build y 35 regresiones aprobados. CI incluye PostgreSQL real desechable, autenticación desde dos procesos HTTP, integridad de ventas/banco/configuración y Chromium. Ese Chromium prueba el entorno efímero de CI, no una operación manual del preview contra Neon.

## Finalización del ensayo

Se revocaron todas las sesiones de los dos usuarios QA, se retiraron sus hashes/credenciales, se desactivaron ambos perfiles y los recursos ficticios y se añadió una anotación de auditoría. No se borraron ventas, jornada, conteos ni historial. Confirmación SQL: ocho migraciones; una venta QA conservada; cero sesiones QA activas; cero cuentas QA activas/aprovisionadas; seis perfiles originales conservados; cero administradores aprovisionados. El administrador original queda disponible para su alta con la contraseña elegida por el propietario y el secreto de infraestructura. El backup previo permanece sin compute.

Se comprobó por HTTP que la sesión administrativa QA dejó de ser válida (401) y que la base sigue `configured:true, connected:true` (200). Se revocó el último enlace temporal del operador sin regenerarlo; la revocación de tres enlaces anteriores respondió `not_found`. Los enlaces se generaron siempre con caducidad de una hora, sin acceso permanente. La entrada normal del propietario sigue siendo su acceso autorizado desde Vercel.

El acceso temporal resuelve las comprobaciones del operador. **No resuelve todavía la entrada pública de webhooks de Mercado Pago**: el proveedor no posee las cookies del operador. Falta preparar un origen estable de ensayo accesible para ese aviso firmado y comprobar la URL efectiva generada por Checkout. No se deshabilitó la protección general.

## Cómo revisar y seguir

Guía de pasos y resultados esperados, sin necesidad de leer todo el código: [PRUEBA_MANUAL_ENSAYO.md](PRUEBA_MANUAL_ENSAYO.md). Código y documentación se guardan en la rama de trabajo y [PR 2](https://github.com/Deareys/SGMO/pull/2); no se integra main automáticamente. En este hito no se lanzaron agentes auxiliares: todos los prompts operativos del principal aparecen a continuación.

| Hito siguiente | Trabajo y criterio de cierre |
| --- | --- |
| 3.3 Cuentas y campo | Aprovisionar administrador propio, cuentas de coordinación/vendedor y catálogo/stock de ensayo; repetir operación desde dos teléfonos, cortes de red y recuperación de cola. Las pruebas HTTP actuales no certifican cámara ni uso de playa. |
| 3.4 Banco completo | Preparar comprador/receptor de prueba y origen estable para webhook firmado; probar Checkout, consulta oficial, duplicados, importe/cuenta/moneda/fecha y conciliación sin asignar pagos ajenos. Lectura de pagos recientes ya aprobada. |
| 3.5 OCR y salida productiva | Resolver facturación del proyecto de la clave, lograr extracción real con imagen ficticia y luego cámara; preparar respaldos, configuración productiva, prueba de restauración y despliegue verificado. Mantener separados OCR y acreditación. |

Prompts propuestos para esos hitos, todavía no ejecutados:

```text
3.3: Preparar acceso del propietario sin publicar credenciales. Mantener las semillas y recursos reales. Guiar una operación de ensayo desde dos teléfonos y verificar cada confirmación en Neon, incluida recuperación de cola al cortar red. Registrar dispositivo, revisión y resultado, sin confundir ACK de servidor con prueba completa offline.
3.4: Probar el ciclo bancario con cuentas de prueba apropiadas y un origen de webhook accesible y acotado. Verificar firma, consulta oficial, receptor, importe, moneda, fecha y unicidad. No usar pagos reales ajenos para acreditar ventas ficticias. Documentar sandbox y live_mode con claridad.
3.5: Comprobar facturación de la clave en su proyecto y repetir OCR real. No aprobar dinero por imagen. Ensayar cámara y contingencias, respaldo/restauración y configuración final antes de certificar producción; no sustituir las verificaciones por checks de compilación.
```

## Prompt operativo del principal

```text
Inicializar exclusivamente la rama Neon de ensayo ya elegida por el usuario, con respaldo previo y los SQL versionados sin alterar reglas económicas. Confirmar proyecto/rama/base y rechazar una base con tablas antes de la primera inicialización. Conservar versiones y comprobar resultados transaccionales. Resolver acceso temporal y acotado al preview usando la autorización existente, sin desactivar la protección general. Probar backend, autenticación y operaciones con cuentas/datos de ensayo; consultar proveedores sin procesar dinero real. Mantener secretos fuera del repositorio y registrar resultados y límites verificables.
```

Prompt de la corrección del diagnóstico OCR:

```text
La llamada real de OCR no extrajo datos y el error genérico no permite distinguir configuración de lectura. Añadir sólo códigos seguros de diagnóstico y estado HTTP del proveedor; nunca devolver errores completos, claves, URLs ni metadatos. No seguir cambiando modelos ante errores permanentes de credenciales/facturación/solicitud. Mantener extracción y acreditación bancaria separadas. Probar errores reales del SDK y verificar ausencia de datos privados; desplegar en la misma rama de ensayo y repetir la imagen ficticia.
```

Continuación del prompt de configuración:

```text
El preview informa NOT_CONFIGURED y el Secret de esta rama tiene la errata GIMINI_API_KEY. Vercel no permite renombrar Secrets y no se debe leer, publicar o rotar el valor para esta reparación. Añadir una compatibilidad mínima en el backend: GEMINI_API_KEY tiene prioridad; GIMINI_API_KEY sólo se usa si falta/está vacía la primera. Mantener el nombre canónico en la documentación de nuevas configuraciones. Repetir tipos, pruebas, build y el OCR real con imagen ficticia antes de afirmar que quedó operativo.
```
