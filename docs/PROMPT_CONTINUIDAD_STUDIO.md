# SGMO — Prompt de continuidad para Studio

Este texto se puede pegar en Google AI Studio (en adelante, Studio). La rama de entrega contiene el código ya reparado; este prompt es una guía de continuidad, no un sustituto de importar esas fuentes.

---

SGMO — RECEPCIÓN DEL HITO 1.2.1 Y CONTINUIDAD DEL HITO 1.2.2

CONTEXTO Y FUENTE DE VERDAD

Continúas SGMO — Tequeños Costa, con React + TypeScript + Express + PostgreSQL, después de reparaciones realizadas por Codex. Antes de modificar nada, importa o sincroniza esta rama completa:

Repositorio: https://github.com/Deareys/SGMO
Rama: codex/hito-1-2-1-verificacion
Fuentes: https://github.com/Deareys/SGMO/tree/codex/hito-1-2-1-verificacion
Base original: 43971a03719734ef11c3042b0c745162b4874174

Mientras el PR no se haya integrado, main no contiene las reparaciones. No trabajes sobre una copia anterior ni reconstruyas las correcciones a partir de este resumen. Si la integración de Studio no permite importar esa rama, informa el bloqueo concreto antes de editar. Si tu entorno no contiene .git, dilo sin inventar commits: verifica los archivos reales importados y conserva un respaldo recuperable.

LEE PRIMERO

1. AGENTS.md.
2. docs/HITO_1_2_1_INFORME.md.
3. docs/AUTHENTICATION.md.
4. docs/POSTGRES_AUTH_TESTS.md.
5. docs/BROWSER_AUTH_QA.md.
6. docs/DECISIONS.md, docs/TODO.md y docs/CONTINUIDAD_HITOS.md.

Identifica la revisión y los cambios presentes. Confirma que existen authPolicy.ts, publicProfile.ts, migración 005 y las suites nuevas. Inspecciona la implementación; no basta con encontrar comentarios de seguridad.

TRABAJO YA REALIZADO — CONSERVAR

- Eliminación de login local de trabajadores por comparación de PIN en texto plano.
- Eliminación de login administrador que aceptaba cualquier contraseña ante red caída o respuestas de error del backend.
- Contrato estricto: trabajador { userCode, pin }, PIN string de ocho dígitos; administrador { identifier, password }. No PIN sin usuario, PIN4, aliases alternativos ni payload mixto.
- scrypt con hash hexadecimal de 64 caracteres y salt de 32; comparación segura. Entradas inválidas y credenciales no provisionadas no autentican.
- Bootstrap inicial exige siempre BOOTSTRAP_SECRET de infraestructura, cuenta admin activa no provisionada y ausencia de admins ya provisionados. Uso inicial único serializado; no sirve para reset público.
- Base central configurada: emisión, validación y revocación de sesiones dependen de PostgreSQL; no fallback en memoria. Errores devuelven 503 genérico.
- Login mantiene lock de tabla antes de fila y transacción durante verificación, contador y emisión. Altas/reset revocan sesiones dentro de su transacción; validar sesión comprueba rol actual, actividad, aprovisionamiento, revocación y expiración.
- Demo explícita, sin credenciales predeterminadas, por variables de entorno y bind loopback; deshabilitada en producción, con NODE_ENV omitido o con configuración PG.
- Bloqueo por cuenta con ventana persistente y expiración. Control por origen en Map complementario, limitado en memoria; no confía directamente en x-forwarded-for ni demuestra distribución.
- Perfil público sin secretos; credenciales retiradas de la caché. Alta, edición y activación de usuarios esperan confirmación central. Puerto updateUser asíncrono y adaptadores sin solicitudes duplicadas.
- Acceso pide código manual sin enumerar trabajadores. Modal mantiene errores y bloquea cierre durante guardado.
- Semilla 002 sin credenciales y sin reemplazar roles existentes. 004 corregida para instalaciones nuevas; 005 añade consistencia, unicidad de códigos y ventana de intentos para instalaciones existentes.
- npm package-lock y comandos reproducibles de pruebas, sin cambiar los rangos de dependencias del producto.

VALIDACIÓN ANTERIOR — REPRODUCIR, NO DAR POR HECHA

Codex ejecutó TypeScript y build, 76 pruebas nuevas, 41 de regresión y 10 grupos SQL en PGlite WASM, todos aprobados. La suite original también pasaba 41 pruebas pese a fallos de seguridad: repetir solo 41 no acredita cierre.

Comandos:
- npm ci
- npm run lint
- npm test
- npm run test:auth:legacy
- npm run build
- npm run test:auth:sql con PGlite externo configurado según POSTGRES_AUTH_TESTS.md.
- npm run test:auth:postgres solo con una base local exclusiva sgmo_auth_test* y la guarda de URL del runner.

Mocks no certifican SQL. PGlite ejecuta SQL, constraints y transacciones, pero no acredita sockets, procesos distintos ni contención distribuida. Chromium no pudo descargarse en el entorno de Codex: browser-auth.smoke.cjs está preparado, sin escenarios UI aprobados. No hay prueba de Neon ni despliegue productivo.

SIGUIENTE HITO 1.2.2 — VALIDACIÓN INDEPENDIENTE

A. Comprobar importación/revisión correcta y conservar respaldo antes de cambios. Ejecutar la línea base de tipos, build y pruebas; registrar errores reales sin alterar comportamientos para obtener verde.
B. Si hay PostgreSQL local, ejecutar las pruebas de migraciones nuevas/existentes en base desechable aislada. Comprobar bootstrap, credenciales, revocación, expiración y rollback.
C. Probar dos procesos de backend contra esa misma base: fallos concurrentes, bloqueo, bootstrap simultáneo y login correcto compitiendo con reset/cambio de rol/inactividad. No emitir sesión con credenciales sustituidas.
D. Provocar caída/reinicio de PostgreSQL local. No emitir/aceptar sesiones mediante memoria, demo o datos locales. No informar logout exitoso cuando falla revocación central.
E. Ejecutar QA navegador móvil y administración con el smoke preparado. Verificar login, errores, alta/edición, PIN/contraseña vacíos y ausencia de credenciales en localStorage. La prueba de cliente con HTTP simulado no sustituye navegador real.
F. Corregir únicamente fallos comprobados de este hito, preservando todo el avance válido. Actualizar informe, decisiones y TODO. Si faltan PostgreSQL o navegador, documentar el bloqueo y dejar pasos reproducibles: no introducir atajos.

MIGRACIONES — IMPACTO OBLIGATORIO

No conectes Neon ni ejecutes migraciones remotas en este hito. La 005 invalida una sola vez todos los PINs previos y revoca sesiones; deben aprovisionarse trabajadores después de aplicarla. Un hash no permite inferir PIN4/PIN8. Si la antigua 004 borró una contraseña válida, ninguna migración la reconstruye: requiere respaldo o recuperación autorizada. Las colisiones de códigos abortan con rollback; no renombrar cuentas silenciosamente. Usar migrador versionado, no reejecutar SQL manualmente después de restablecer usuarios.

PENDIENTES POSTERIORES — NO DECLARAR RESUELTOS

Hito 1.3: cookies HttpOnly/Secure y CSRF/CORS coherentes frontend/backend; TLS de PostgreSQL; recuperación administrativa; control compartido por origen/proxies confiables. Bearer sigue en localStorage. No hacer una migración parcial de cookies.
Hito 2.1: hidratación de perfiles/estado centrales, sincronización entre dispositivos, idempotencia y cola offline. GET /api/users es la fuente de IDs reales. resetToFactorySeed aún puede borrar ventas/cola: necesita protección, sin eliminar datos durante esta recepción. Definir reanudación de sesión tras recarga sin red sin crear login local nuevo.

LÍMITES Y ENTREGA

No reescribir arquitectura, interfaz general, comisiones, stock, mermas, precios, arqueos, liquidación PDF ni pagos/OCR ajenos al hito. No borrar trabajo válido o respaldos. No exponer secretos. No desplegar ni integrar automáticamente en main.

Sebas autorizó al principal de Codex a modificar reglas y guardar commits/push cuando sea necesario. Esa excepción no concede a Studio o auxiliares facultad para cambiar AGENTS ni ampliar permisos. Respeta las reglas restantes. Si no dispones de Git, informa cómo exportar/sincronizar las fuentes sin afirmar que lo hiciste.

Finaliza con revisión/base de trabajo, archivos cambiados, problemas corregidos, comandos/resultados exactos, pruebas no ejecutadas, estado de respaldo, impactos de migración y próximo hito. Distingue implementado, probado localmente y pendiente de producción. No declares cierre productivo mientras falte evidencia real.
