# SGMO: hitos, prompts y criterios de aceptación

Fecha: 13 de octubre de 2026. Responsable principal: Codex. Rama de trabajo: `codex/sgmo-preparacion-mvp`.

## Qué se recibió y por qué se recuperó código

Se inspeccionó `main` en `d291d5a`, posterior a la exportación de Studio. No era la continuación completa de `fef86d4`: faltaban la migración 005, el lock de npm y varias suites; el smoke de navegador estaba vacío y había regresiones de autenticación. Se conservaron cambios válidos, incluido `PORT`, y se recuperaron las reparaciones necesarias en una rama separada. El respaldo previo permanece fuera de la entrega Git.

Sólo el principal modifica reglas para IAs y publica Git. Los agentes trabajan en archivos delimitados. No se ejecutan migraciones en Neon, se modifica `main` ni se despliega producción en esta intervención. Los hitos siguientes distinguen código implementado de validación en un entorno desplegado.

## Lista de hitos

| Hito | Qué cambia, arregla o añade | Responsable | Cómo se demuestra |
| --- | --- | --- | --- |
| 1.2.3 Recuperación | Recuperar login estricto, scrypt, sesiones centrales, migración 005, pruebas y lock; conservar cambios útiles de Studio | Principal | TypeScript, suites de auth, build y diff de Git |
| 1.2.2 PostgreSQL real y CI | Automatizar migraciones, dos procesos HTTP, carreras bootstrap/login/reset y fallos de sockets en un contenedor PostgreSQL desechable | integracion_sql + principal | GitHub Actions; WASM local es complementario y no sustituye esa prueba |
| 1.3 Sesiones de navegador | Cookie HttpOnly/Secure/Strict, origen exacto, CSRF y revocación; TLS con certificado verificado hacia PostgreSQL | sesiones + principal | Tests HTTP/cliente/CSRF/TLS, Chromium y cookies del preview HTTPS |
| 2.1 Operación y persistencia | Estado central por rol, cola durable de ventas, ACK explícito, idempotencia, inventario de casa/carrito, despacho/reposición/merma/sobrantes/cierre/pago persistidos | cliente + repositorio + operacion_ui | SQL transaccional, pruebas de cola y errores, recorrido de dos dispositivos |
| 2.2 Pagos y OCR | Sin aprobaciones ficticias; venta central asociada a consulta bancaria; importe/receptor/moneda; firma y persistencia de webhooks; OCR sin datos inventados | sesiones + configuracion + operacion_ui | Fixtures de API/firma/DB y sandbox del proveedor; falta prueba bancaria externa |
| 2.3 Configuración central | Casas, carritos, catálogo, precios, comisiones y zonas; stock inicial contado explícitamente, permisos y auditoría | configuracion | Tests de validación, SQL de configuración y lectura desde otro dispositivo |
| 3.0 Entrega y aprendizaje | Entry point Express, salida pública segura para Vercel, versión en health, CI y guía para Sebas | Principal | Build, pruebas del entry point, Actions y preview aislado |
| 3.1 Cierre productivo | Inventario de módulos locales, PWA completa, almacenamiento de imágenes y prueba de campo | Siguiente fase | No declarar terminado hasta resolver estos pendientes y probar el entorno real |

## Prompts operativos

Se conservan aquí los prompts de alcance y sus ampliaciones técnicas consolidadas. Los mensajes posteriores entre agentes aclararon interfaces, rutas y archivos; no ampliaron sus permisos. Las instrucciones generales son: leer AGENTS.md y DECISIONS.md, preservar datos, no inventar pruebas, no hacer commits/push ni tocar reglas, no usar bases/cuentas externas, documentar cambios y límites, coordinar archivos compartidos.

### Principal: recuperación, integración y entrega

```text
Inspeccionar la última revisión de Deareys/SGMO y compararla con el Hito 1.2.1 recibido. Conservar las correcciones válidas de Studio, recuperar únicamente los cambios de seguridad perdidos y crear respaldo y rama separados. Trabajar por hitos con evidencias reproducibles y prompts visibles. Integrar autenticación, permisos, ventas, inventario y configuración sin reescribir reglas económicas a ciegas. Publicar código y documentación en GitHub con la autorización existente; no ejecutar migraciones en Neon ni declarar producción validada sin evidencia.
```

### integracion_sql: Hito 1.2.2

```text
Añadir CI con PostgreSQL real desechable y Node 22, permisos de lectura y reportes sin credenciales. Probar migraciones, sesiones y concurrencia real de bootstrap/login/reset usando dos procesos HTTP independientes contra la misma base. Guardar destinos: loopback literal y nombre de base de pruebas; nunca usar DATABASE_URL operativa. Probar caída de sockets mediante proxy TCP local y recuperación; describir honestamente que no es un reinicio del motor. Conservar WASM como complemento. Añadir smoke Chromium aislado con credenciales efímeras, viewport móvil, cookies, CSRF, recarga y rechazo productivo de demo. No simular pruebas como aprobadas si no se pueden ejecutar.
```

### sesiones: Hito 1.3

```text
Mover el navegador a sesión HttpOnly, Secure en producción, SameSite Strict y host exclusivo. No entregar bearer al navegador ni guardarlo en localStorage. Proteger todas las escrituras, incluyendo login y bootstrap, con CSRF y origen exacto configurado. Restore requiere /auth/me central válido, y logout debe revocar sin volver a iniciar una sesión cuando falla. Mantener un transporte Bearer sólo como API explícita habilitada en servidor y sin contexto de navegador. Crear tests de contratos HTTP, cliente y CSRF. No cambiar importes ni fórmulas financieras.
```

### cliente: Hito 2.1

```text
Hidratar usuarios autorizados, jornadas, ventas, catálogo, casas, carritos, zonas y configuración desde /api/bootstrap. No sembrar datos demo en producción ni mostrar caché de otra identidad. Encolar cada venta, incluso online, con UUID y pendingSync. Sincronizar en singleflight; eliminar únicamente IDs reconocidos explícitamente por el servidor y sin borrar ventas añadidas durante una solicitud o desde otra pestaña. Persistir operaciones mediante API y adoptar el resultado sólo al éxito. Adaptadores deben delegar una sola vez. Conservar módulos locales no incluidos en el snapshot y explicar su alcance. Nunca borrar datos reales o pendientes con resetToFactorySeed.
```

### repositorio: Hito 2.1

```text
Validar ventas e inventario en transacciones bloqueadas. Precio, unidades, vendedor y catálogo se derivan o validan en el servidor. Mismo ID con mismo contenido devuelve la misma venta; otro contenido da conflicto. Reintentos no sobrescriben evidencia bancaria ni duplican stock. Lote inválido revierte íntegro y devuelve acknowledgedIds exactos sólo al confirmar. Despacho y reposición debitan house_stock real; merma, devolución y cierre son idempotentes. Sobrantes del vendedor dejan esperando_cierre; coordinación/admin calculan cierre y guardan snapshot. Pago de comisión usa importe del cierre y conserva comprobante. Identificar la fórmula existente y documentar divergencias antes de cambiar cualquier deducción. Probar repositorios con SQL y después en PostgreSQL real aislado.
```

### operacion_ui: Hito 2.1 y flujo de pagos

```text
Hacer await de despacho, reposición, merma, sobrantes, cierre y registro de pago. Bloquear doble clic, conservar campos/comprobantes ante errores y mostrar éxito/PDF sólo tras confirmación central. Vendedor declara sobrantes; coordinación/admin cierra y paga. Distinguir venta guardada local pendiente de venta confirmada central. Los avisos locales no deben prometer recepción por coordinación. Para cobros digitales guardar una única venta UUID primero, sincronizar y verificar/crear checkout con su saleId central; offline queda pendiente. Eliminar enlaces ficticios y exigir approved+isLiveApi+coincidencias para representar pago bancario confirmado. Documentar recorrido móvil y tests.
```

### configuracion: Hito 2.3

```text
Persistir configuración, precios, tramos de comisión, zonas, casas, carritos y variedades mediante endpoints administrativos con validación y auditoría. Bootstrap debe devolver catálogo e inventario oficial. Crear house_stock inicialmente vacío: administrador carga conteo real por variedad con motivo, sin inventar cantidades. Validar capacidad, referencias y asignaciones; revocar únicamente sesiones afectadas y no cambiar asignaciones con jornadas abiertas. UI espera ACK, conserva formulario al fallar y no modifica caché ni anuncia éxito prematuramente. No borrar históricos al desactivar entidades. Probar roles, validación y SQL.
```

### sesiones: Hito 2.2

```text
Separar comprobante de pago confirmado; rechazar aprobaciones simuladas en producción; comprobar importe, moneda y cuenta receptora consultando la API oficial. Asociar la verificación a una venta central autorizada por saleId; impedir reutilizar una operación bancaria en otra venta con restricción transaccional. Validar firma HMAC de los avisos según documentación primaria de Mercado Pago, persistir antes de responder y soportar reintentos. No conservar webhooks sólo en memoria ni procesar en background sin garantía. No exponer tokenPrefix, credenciales o datos personales innecesarios. Los errores de API dejan pago pendiente. Crear fixtures, migración incremental, pruebas y documentación sin usar tokens ni pagos reales. Implementar módulo propio; sólo el principal integra server.ts.
```

### configuracion y principal: OCR del Hito 2.2

```text
Corregir contrato del adaptador: saleAmount de entrada y extractedData/matchResults de salida. Sin OCR real no fabricar ID, importe, fecha, destinatario o confianza. Fallback = lectura desconocida y pago pendiente, con amountMatches false y confianza cero. Validar salida estructurada y marcar extractionSucceeded sólo ante respuesta real utilizable. Una lectura OCR jamás confirma un depósito bancario. Comprobantes generados para pruebas deben decir SIMULADO SIN VALIDEZ.
```

### Principal: Hito 3.0

```text
Preparar React y Express para el despliegue Vercel vigente, publicar únicamente los archivos del frontend, mantener las API como respuestas JSON y permitir identificar qué revisión está ejecutándose. Verificar certificados PostgreSQL y límites de imágenes. Escribir guía para una persona sin conocimientos de programación: GitHub guarda código y ejecuta pruebas, Vercel ejecuta la app, Neon conserva datos compartidos. Mostrar pasos, resultados esperados y cómo reportar un fallo. No tocar la base remota ni declarar un despliegue validado sin probarlo.
```

## Decisiones económicas que necesitan confirmación

El cierre activo del prototipo usaba `max(0, comisión + incentivo − faltantes − vivienda)`. Otro módulo de dominio descuenta además un faltante de efectivo. La implementación central conserva la fórmula usada por la pantalla operativa y registra snapshot; no eligió una nueva penalización silenciosamente. Debe acordarse con quien define el negocio antes del lanzamiento. El registro de pago de comisión confirma dinero entregado manualmente; no hace transferencias bancarias.

## Cómo leer los resultados

`npm run lint` comprueba tipos; no es ESLint ni significa que TypeScript estricto esté activado. `npm test` verifica comportamientos concretos con fixtures. Build verifica compilación. SQL WASM ejecuta SQL, pero serializa en un motor embebido; no prueba sockets ni múltiples procesos. Sólo Actions/PostgreSQL y una prueba del despliegue pueden cerrar esas evidencias. El número de pruebas cambia cuando se añaden casos; no copiar los 76/41 históricos como resultado actual.

## Evidencia final y siguiente hito

El código `c2e6e2c` aprobó [CI38441510211](https://github.com/Deareys/SGMO/actions/runs/38441510211),incluyendo PostgreSQL16por sockets y8escenarios Chromium. Las174pruebas y el build también aprobaron localmente. El siguiente paso es comprobar previewHTTPS/base aislada y configuración real; la petición pública de health devuelve login deVercel,por lo que no se certificó ese deployment. Ver INFORME_ENTREGA_MVP.md y CI para detalle.
