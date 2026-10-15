# Hito 3.2: inicialización del ensayo y acceso al preview

Fecha: 15 de octubre de 2026, Argentina. Estado: base y preview operativos; pruebas de operación y diagnóstico OCR en curso.

Sebas autorizó continuar con la base de ensayo y resolver el acceso autorizado al preview. El alcance es la rama Neon `sgmo-pruebas` (`br-solitary-base-b6xjzp4s`), base `neondb`, del proyecto `still-mud-30172607`, y el preview de `codex/sgmo-preparacion-mvp`. Esta autorización específica permite la inicialización remota de ensayo; no cambia reglas para auxiliares ni implica integrar main o operar sobre la rama Neon production.

Antes de migrar se confirmó cero tablas públicas y se creó el respaldo `sgmo-pruebas-pre-migracion-20261015` (`br-mute-unit-b6up0ykz`), sin compute. Se aplicaron las migraciones 001–008 en una transacción con control de base vacía y registro de versiones. La primera llamada fue rechazada por instrucciones múltiples en una consulta preparada y revirtió; se comprobó nuevamente cero tablas. La segunda separó las instrucciones respetando strings, comentarios y bloques dollar-quoted, con reconstrucción exacta de cada archivo, y confirmó las ocho versiones atómicamente.

Resultado SQL: 21 tablas públicas, ocho migraciones, seis perfiles semilla sin credenciales, cero ventas, cero jornadas y cero filas de stock. Pruebas de unicidad de código de usuario, rechazo de hash inválido e inventario negativo aprobaron sin dejar usuarios o stock de prueba. El esquema de la rama production no se modificó.

La API autorizada permitió crear un acceso temporal de una hora para el deployment de ensayo. El secreto de ese enlace se conserva fuera de esta documentación. No se deshabilita Deployment Protection ni se publica el enlace privado.

El acceso se generó mediante `patch_url_protection_bypass` sobre el deployment concreto, con `ttl: 3600`, usando el alcance por defecto de la conexión. La consulta previa de bypass y las herramientas de logs siguen devolviendo 403. Con el enlace temporal y cookies privadas las peticiones ya alcanzaron la función, que respondió 500 `FUNCTION_INVOCATION_FAILED`, incluido health.

## Reparación de arranque en curso

Se reprodujo un defecto concreto al emitir el backend como ESM y cargarlo con Node nativo: `ERR_MODULE_NOT_FOUND` en los imports relativos sin extensión. Se corrigen exclusivamente los especificadores usados en el grafo de ejecución para incluir `.js` y `index.js` cuando corresponde, manteniendo TypeScript/React/Express y las reglas del negocio. La prueba nueva `backend-esm-entry.test.ts` compila el grafo, lo carga sin tsx y solicita health por HTTP. Falló antes de los cambios y aprobó después. Falta confirmar el resultado de esta reparación en Vercel; no se atribuye definitivamente el error remoto a esa causa sin dicha prueba.

Verificación local de la reparación: tipos, suite completa (175 casos), build y 35 regresiones de autenticación aprobaron. El cambio de arranque se limita a especificadores de importación; no modifica operaciones SQL, precios, comisiones o autorizaciones.

Confirmación real: deployment `dpl_Hwn6zU3czj1vB32pxQuqbDvrRkeX`, commit `bfbd292e7b90b8598780ac1c6d7327d67deffaa2`, estado READY. La página responde 200; `/api/health` devuelve JSON 200 y esa revisión; `/api/db/status` devuelve `configured:true, connected:true`. Actions `38678468051` aprobó. La reparación sí resolvió el fallo de arranque observado en el preview.

## Ensayo HTTP con datos ficticios

Se aprovisionó por operación SQL una cuenta QA administrativa temporal, con contraseña aleatoria fuerte y scrypt de la implementación real. No se utilizó ni sustituyó `BOOTSTRAP_SECRET`; esta preparación no certifica el endpoint HTTP de bootstrap inicial. Las credenciales de QA nunca se publican y se retirarán al finalizar para conservar disponible el aprovisionamiento del administrador propio.

Login administrador y trabajador con cookie HttpOnly/Secure/SameSite Strict aprobaron contra Neon. Se rechazaron acceso anónimo, PIN sin identificador, escritura sin CSRF, origen ajeno, enumeración de usuarios por vendedor y lectura de jornada ajena. Recursos de ensayo usan prefijos QA y nombres ENSAYO. El catálogo original no se sobrescribe.

Se confirmó despacho de diez unidades ficticias sobre treinta de stock, precio adulterado rechazado, venta offline con ACK central, reenvío con cero inserciones y consulta de la misma venta desde otra sesión. El servidor rechazó también un `sellerId` ajeno; se corrigió la fixture para probar precio sin alterar identidad. La prueba operativa inicial esperaba 200 al crear jornada; el contrato devuelve correctamente 201.

## Proveedores reales

Mercado Pago: `/recent-payments` devolvió 200 y dos resultados de la cuenta configurada desde la API oficial. Fue sólo lectura: no se crearon cobros y no se asignaron esos pagos a ventas QA. Esto no certifica un cobro nuevo, conciliación, `live_mode` ni entrega de webhooks. El prefijo del token no basta para certificar su entorno financiero.

OCR: la primera imagen generada para el ensayo, con marca SIN VALIDEZ y datos ficticios, produjo HTTP 200 pero `extractionSucceeded:false`, sin operación ni importe inventados y sin acreditación bancaria. El servidor ocultaba la diferencia entre error del proveedor y lectura incompleta. Se añade `ocrFailure`, diagnóstico acotado sin mensajes/URLs/claves del SDK, y se detienen cambios de modelo ante errores 400/401/402/403. Se preservan los reintentos de contingencia existentes para errores transitorios. La comprobación del diagnóstico desplegado está pendiente.

## Prompt operativo del principal

```text
Inicializar exclusivamente la rama Neon de ensayo ya elegida por el usuario, con respaldo previo y los SQL versionados sin alterar reglas económicas. Confirmar proyecto/rama/base y rechazar una base con tablas antes de la primera inicialización. Conservar versiones y comprobar resultados transaccionales. Resolver acceso temporal y acotado al preview usando la autorización existente, sin desactivar la protección general. Probar backend, autenticación y operaciones con cuentas/datos de ensayo; consultar proveedores sin procesar dinero real. Mantener secretos fuera del repositorio y registrar resultados y límites verificables.
```

Prompt de la corrección del diagnóstico OCR:

```text
La llamada real de OCR no extrajo datos y el error genérico no permite distinguir configuración de lectura. Añadir sólo códigos seguros de diagnóstico y estado HTTP del proveedor; nunca devolver errores completos, claves, URLs ni metadatos. No seguir cambiando modelos ante errores permanentes de credenciales/facturación/solicitud. Mantener extracción y acreditación bancaria separadas. Probar errores reales del SDK y verificar ausencia de datos privados; desplegar en la misma rama de ensayo y repetir la imagen ficticia.
```
