# SGMO — Informe Hito 1.2.1 y avance verificable de 1.2.2

Fecha: 12 de octubre de 2026. Base Git: `43971a03719734ef11c3042b0c745162b4874174`. Rama local: `codex/hito-1-2-1-verificacion`.

**Estado:** correcciones implementadas y pruebas locales aprobadas. Cierre integral pendiente de QA navegador real y validación PostgreSQL con conexiones/múltiples procesos. No aptitud productiva certificada. La ejecución de reparación original no conectó Neon ni realizó migraciones remotas o despliegues. El 12 de octubre Sebas autorizó guardar esta entrega mediante commit/push en rama de trabajo; ver registro de publicación siguiente.

## Qué se encontró y corrigió

- Frontend podía autenticar administrador con contraseña arbitraria ante red caída o errores HTTP; trabajadores podían entrar comparando PIN local en texto plano. Ambas vías se eliminaron. El método síncrono legado conserva interfaz de rechazo para no crear otro acceso.
- Login acepta solo contratos modernos por rol, no PIN4, aliases alternativos o solicitudes mixtas. Cuenta inexistente/inactiva/no provisionada/hash inválido devuelve respuesta genérica, sin enumeración por diferencias de error de credencial.
- Bootstrap inicial exigía secreto solo después de aprovisionar. Ahora lo exige siempre, verifica rol/estado y permite alta inicial única serializada, sin reset público.
- Sesiones guardaban/aceptaban duplicados en memoria cuando fallaba PostgreSQL. Emisión, validación y revocación ahora dependen exclusivamente de la base central configurada. Middleware transforma fallos en 503 genérico, sin excepciones asíncronas sin manejar.
- Login serializa verificación, contador y sesión dentro de una transacción; altas/reset revocan sesiones atómicamente. Locks de tabla antes de fila mantienen el mismo orden frente a bootstrap. El rol central/inactividad/expiración/revocación se comprueban al validar sesión.
- Todas las escrituras de PIN/password validan formato y rol y marcan aprovisionamiento coherente; cambios de rol eliminan la credencial anterior. Campos internos del cliente no se reflejan ni controlan aprovisionamiento.
- Demo ahora opt-in, sin valores públicos predeterminados, credenciales por entorno y bind loopback. Omitir NODE_ENV o configurar PG no activa una contingencia insegura.
- Control por origen no confía directamente en x-forwarded-for y limita memoria. Bloqueo por cuenta usa SQL con ventana persistente y expiración comprobada localmente.
- Perfil público por allowlist y sanitización de caché retiran credenciales/hashes/salts. Alta, edición y activación de usuarios esperan confirmación central antes de cambiar caché/notificar éxito; adaptadores eliminan solicitudes duplicadas. Pantalla de acceso pide código manual sin publicar selector de cuentas. El modal de usuario bloquea Guardar, Cancelar y cierre mientras confirma la operación.
- Tamaño de cuerpo de auth limitado a 4 KB; formatos y JSON inválidos responden genérico. Hash scrypt 64hex/salt32hex estricto; contraseña entre 14 y 1024 para almacenamiento/verificación.

## Semillas y migraciones

002 mantiene perfiles sin credenciales y no modifica roles existentes al repetir inserción. mockData fue inspeccionado: sin PIN/password, usuarios no provisionados; no fue necesario modificarlo.

004 corregida para instalaciones nuevas: no elimina password válida por PIN nulo, conserva códigos existentes y resuelve IDs históricos sin asignar el mismo código dos veces. 005 permite corregir instalaciones donde 004 ya estaba registrada, añade ventana de intentos, códigos únicos ignorando mayúsculas y constraint por rol; revoca sesiones y exige restablecer todos los PINs anteriores una vez. Preserva passwords válidas sin reactivar admins no provisionados.

**Impacto operativo necesario:** después de aplicar 005 se deben aprovisionar trabajadores con PIN nuevo. No se puede inferir la longitud del PIN a partir de un hash. Contraseña que ya borró una 004 anterior necesita respaldo/restablecimiento; el código no la recupera. Una colisión de códigos aborta 005 con rollback, sin renombrar cuentas silenciosamente. No ejecutar SQL manualmente sobre cuentas ya restablecidas; usar versiones del migrador.

## Validación y evidencia

| Comprobación | Resultado / alcance |
| --- | --- |
| Línea base TypeScript y build sobre respaldo original | Aprobados |
| Suite histórica sobre código original | 41 aprobadas incluso con los accesos inseguros; muestra cobertura insuficiente |
| `npm run lint` | Aprobado sobre cambios |
| `npm test` | 76 pruebas aprobadas, 0 fallidas: cliente, crypto, sesiones, repositorio, contratos HTTP, fallos, RBAC y rate limiting |
| `npm run test:auth:legacy` | 41 aprobadas, credenciales efímeras y servicios externos deshabilitados; acepta 200 real donde antes toleraba 503 |
| `npm run test:auth:sql` con dependencia opcional externa PGlite | 10 grupos SQL aprobados; migraciones/transacciones/constraints reales en WASM |
| `npm run build` | Aprobado; aviso preexistente de bundle frontend grande, no error |
| `git diff --check` | Aprobado |
| PostgreSQL local por sockets / varias instancias / Neon | No ejecutados; runner local seguro preparado |
| QA navegador real | Chromium no disponible; descargas de Chromium/headless-shell fallaron con ZIP inválido. Smoke reproducible creado, sintaxis aprobada; no se ejecutaron escenarios UI. Ver BROWSER_AUTH_QA.md |

Los mocks de PG no certifican SQL real. WASM sí ejecuta el SQL pero no demuestra contención entre conexiones o servidores. Consultar `POSTGRES_AUTH_TESTS.md` para reproducir y distinguir resultados. Las credenciales de pruebas se generan en ejecución y no se imprimen/guardan.

Se añadió package-lock para instalar con npm ci; el repositorio solo tenía bun.lock y npm ci inicial falló. No se cambiaron los rangos/librerías declarados. npm resolvió los rangos existentes; revisar coherencia del lock con el gestor usado en la siguiente sesión. La suite usa node --import tsx porque la CLI tsx requiere IPC no disponible en este entorno.

## Archivos y alcance

Código: authRoutes, authPolicy, publicProfile, cryptoUtils, authMiddleware, sessionManager, rateLimiter, UserRepository, rutas de usuarios en dbRoutes, storageService, PinLoginScreen, modal de usuarios de AdminConfigView, puerto IStorageRepository y sus tres adaptadores; server.ts parsers/bind demo. Configuración: package.json, package-lock, tsconfig y env.example. SQL: 002, 004 y nueva 005. Pruebas: scripts/tests y runner demo/suite histórica. Documentación: AGENTS (estado real y restricción de auxiliares), decisiones, roles, DB, TODO, CHANGELOG, continuidad, autenticación e informes.

No se alteraron fórmulas de comisiones, stock, precios, mermas, liquidación PDF ni implementación de Mercado Pago/Gemini. La reducción de handlers duplicados de autenticación fue necesaria para eliminar contingencias inseguras en todas las ramas, no una refactorización general. El puerto updateUser cambia a Promise para poder propagar fallos de confirmación, con todos sus adaptadores actualizados.

## Respaldo y restauración

Antes de editar código se creó `.backup_pre_codex_hito_1_2_1/` con fuentes/configuración/documentación del checkout. Base Git y rama identificadas arriba. Los respaldos anteriores de AI Studio `.backup_pre_hito_1_2/` y `.backup_pre_hito_1_2_1/` no aparecen en este checkout: no se afirma que se hayan exportado ni borrado.

El respaldo nuevo permanece local, ignorado por Git; tsconfig excluye .backup_* y los bundles no lo importan. Las entregas de fuentes/patch lo excluyen junto con .env, node_modules y builds. El build usado para comprobar la base original creó artefactos dentro de su directorio: para restaurar utilizar los archivos fuente originales, no esos artefactos generados.

Restauración segura: guardar primero el trabajo posterior en una ubicación nueva; comparar cada archivo del manifiesto/diff; copiar únicamente la versión del respaldo del archivo que se decide revertir. Para nuevos archivos introducidos en este hito, quitarlos únicamente tras confirmar que no contienen trabajo posterior. No usar reset --hard ni copiar todo indiscriminadamente sobre cambios de otro agente. Si falta el respaldo local, obtener un checkout separado de la base Git indicada y conciliar manualmente. El archivo de fuentes entregado conserva cambios nuevos para recuperación de esta intervención.

## Bloqueos y próximo prompt

No se declara cierre productivo: falta PostgreSQL con sockets, dos procesos, carrera login/reset, caída/reinicio, QA navegador móvil, cookies HttpOnly/CSRF/CORS, TLS verificado y alojamiento real. El Map por IP no es distribuido. La UI completa todavía debe hidratar usuarios del servidor; GET /api/users es la fuente actual para aprovisionar IDs existentes. Reseteo a semillas borra cola/ventas: registrado para Hito 2.1, sin tocar datos críticos aquí.

**Siguiente tarea — Hito 1.2.2:** leer AGENTS, AUTHENTICATION y POSTGRES_AUTH_TESTS. Partir de esta rama y diff; no rehacer reparaciones. Ejecutar runner --postgres en base local desechable sgmo_auth_test*, verificar dos procesos compitiendo por bootstrap/login y reset simultáneo, provocar caída/reinicio y comprobar fail-closed. Registrar resultados exactos; no llamar a mocks/WASM prueba distribuida. No conectar Neon ni desplegar sin ampliar ese alcance. Después resolver Hito 1.3 como cambio coherente frontend/backend y mantener las pruebas anteriores válidas.

Para volver a AI Studio, entregar todas las fuentes y documentos de esta misma revisión. Leer primero AGENTS, CONTINUIDAD_HITOS, este informe y TODO; contrastar con git status. No repetir informes 41/41 sin ejecutar la suite ampliada ni activar defaults/demo para hacer pasar pruebas. No registrar secretos en capturas o prompts. El canal de entrega actual es GitHub: usar la rama `codex/hito-1-2-1-verificacion` y verificar su HEAD. No continuar sobre main mientras el PR siga sin integrar.

## Registro de sincronización con GitHub

Autorización explícita recibida el 12 de octubre de 2026. Se prepara publicación en `https://github.com/Deareys/SGMO/tree/codex/hito-1-2-1-verificacion` y PR borrador hacia main. La verificación remota del commit se comunica al finalizar esta publicación. El informe de reparación original se conserva como evidencia de pruebas locales; la publicación no equivale a certificar Neon, PostgreSQL distribuido ni QA navegador. La base actual de main fue comprobada antes de guardar y continúa en `43971a03719734ef11c3042b0c745162b4874174`.
