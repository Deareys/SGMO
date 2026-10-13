# SGMO — Validación continua y PostgreSQL multiproceso

Fecha: 13 de octubre de 2026. Hitos 1.2.2 y 1.3.

## Flujo automatizado

`.github/workflows/ci.yml` se ejecuta en push a `main`/`codex/**`, pull requests y ejecución manual. Utiliza Node 22, permisos de GitHub limitados a `contents: read` y no guarda credenciales de checkout. No despliega ni accede a Neon, Mercado Pago o Gemini.

El job `security-and-postgres` instala con `npm ci`, comprueba tipos, pruebas locales, compilación y suite histórica en demo efímera. Después ejecuta migraciones/repositorios contra el servicio PostgreSQL 16, autenticación HTTP contra dos procesos de Node distintos y transacciones de ventas/inventario/pagos con dos conexiones concurrentes. Configuración usa además SQL WASM externo con seis grupos; no se afirma su concurrencia de red por esa evidencia. El contenedor expone su puerto únicamente en el runner y utiliza `sgmo_auth_test_ci`; sus credenciales son exclusivas de esa ejecución.

El job `browser` compila y ejecuta Chromium headless con Playwright instalado fuera del repositorio (`runner.temp`). No añade una dependencia de producción. Las cuentas demo reciben credenciales nuevas por ejecución. Se verifica acceso móvil, PIN incorrecto/correcto, administrador, cookies HttpOnly/Strict, restauración al recargar, logout, ausencia de token/credenciales en localStorage, rechazo CSRF/origen externo y errores visibles de escrituras sin base. La comprobación de producción rechaza demo; no simula un acceso exitoso de producción por HTTP.

Referencia primaria del diseño del servicio PostgreSQL: [GitHub Docs — PostgreSQL service containers](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers). No es necesario configurar un secreto de una base real para estas pruebas.

## Evidencia de ejecución

Un archivo workflow preparado no demuestra que un job haya pasado. Registrar aquí o en el informe del hito el enlace, commit, fecha y conclusión de una ejecución real antes de declarar cerrado el Hito 1.2.2.

| Verificación | Estado al preparar este cambio |
| --- | --- |
| SQL en motor WASM | 13/10: migraciones 001–008 y diez grupos de autenticación aprobados localmente. |
| PostgreSQL 16 mediante servicio CI | Pendiente de ejecución real del workflow. |
| HTTP con dos procesos y PostgreSQL real | Runner implementado; pendiente de ejecución real. |
| Browser headless en CI | Job preparado; pendiente de ejecución real. |
| Instancias Cloud Run/Neon | Fuera del alcance de este workflow; no comprobadas. |

El job PostgreSQL conserva `postgres-auth.json` y `postgres-multiprocess.json`, con nombres de escenarios y eventual escenario fallido. El browser conserva capturas del acceso vacío y `result.json`. No se suben `.env`, dumps, SQL con credenciales, directorios de datos, cookies, tokens ni logs completos de procesos. La retención de artefactos es de siete días.

Limitaciones locales comprobadas el 13/10: los binarios PostgreSQL 16 descargados fuera del repositorio no pudieron iniciar con un usuario no root porque el namespace rechaza `chown`/mapeo de UID; no se alteraron usuarios ni binarios. Chromium tampoco estaba instalado y su descarga produjo un archivo incompleto. Esos intentos no cuentan como pruebas PostgreSQL o navegador aprobadas; los jobs de CI cubren esos requisitos cuando realmente se ejecuten.

## PostgreSQL local y dos procesos

Definir `SGMO_AUTH_TEST_DATABASE_URL` en una terminal segura apuntando a una base local exclusiva, por ejemplo el formato `postgresql://usuario@127.0.0.1:5432/sgmo_auth_test_local`. Después:

```bash
npm run test:auth:postgres
node --import tsx scripts/tests/postgres-multiprocess.integration.ts
```

No copiar una conexión productiva. Ambos runners rechazan hosts externos, parámetros arbitrarios en la URL y nombres de base que no empiezan por `sgmo_auth_test`. Crean esquemas aleatorios y limpian únicamente esos esquemas. El runner HTTP ignora variables PG heredadas y no carga `.env`.

`scripts/tests/fixtures/postgres-http-server.ts` monta los routers reales de autenticación y persistencia, junto con el middleware CSRF. Es una fixture exclusiva de pruebas; no se importa en la aplicación productiva. Los dos servidores usan puertos asignados automáticamente y cookies de navegador, sin habilitar la API opcional de tokens ni buscar tokens en el JSON.

Escenarios multiproceso:

1. Dos aprovisionamientos iniciales concurrentes: exactamente uno permitido.
2. Cinco PIN incorrectos repartidos entre instancias: contador central y bloqueo del PIN correcto desde la otra instancia.
3. Sesión consultable desde otra instancia y después de reiniciar un proceso backend.
4. Login con PIN previo compite con restablecimiento: ninguna sesión antigua queda utilizable después de confirmar el reset.
5. Inactividad revoca acceso desde ambas instancias y rechaza nuevos logins.
6. Corte del transporte TCP real hacia PostgreSQL: `/me`, login y logout devuelven 503; al recuperar transporte se revoca correctamente la sesión y ambas instancias la rechazan.

El sexto caso corta sockets en un proxy TCP local que transporta consultas a PostgreSQL real. No sustituye respuestas SQL ni monkey-patchea repositorios. **No apaga ni reinicia el motor PostgreSQL**: la evidencia corresponde a pérdida del transporte, y el reinicio probado es del backend. El control del proxy no necesita privilegios adicionales sobre la base.

## Demo histórica y browser local

La suite histórica actual verifica 35 escenarios de autenticación/RBAC y rechazo de escritura sin base; los antiguos escenarios económicos contra datos demo se trasladaron a SQL central y tests de validación, porque una503 de base ausente no demuestra un rechazo de precio o pertenencia. No se flexibilizaron asserts para aceptar resultados alternativos.

La suite histórica conserva compatibilidad explícita para CLI: el launcher habilita `SGMO_ENABLE_API_TOKENS=true` sólo en el proceso de prueba y la suite envía `X-SGMO-Client: api`. El navegador no puede usar ese transporte. No habilitar esa variable en un despliegue sólo para hacer pasar una prueba vieja.

```bash
PORT=3101 npm run test:auth:legacy
SGMO_BROWSER_QA_PORT=3102 node scripts/tests/browser-auth.smoke.cjs
```

El browser necesita Playwright/Chromium instalados y `SGMO_PLAYWRIGHT_MODULES` indicando su directorio externo `node_modules`. Debe ejecutarse después de `npm run build`. Los puertos son configurables para no usar un servidor o sesión existentes accidentalmente.

## Límites antes de producción

La suite en dos procesos locales mejora la evidencia de concurrencia; no certifica redes, configuración TLS, proxies ni varias instancias desplegadas en Cloud Run. Revisar por separado cookies `__Host-*` y `Secure` bajo HTTPS real, origen público, límites complementarios por IP y configuración del proxy. Las migraciones siguen pendientes de validación sobre una copia aislada del esquema real antes de ejecutarlas sobre un entorno operativo.

## Primera ejecución y corrección del workflow

La ejecución [38437844058](https://github.com/Deareys/SGMO/actions/runs/38437844058) del commit `7cf7bf9` fue rechazada antes de crear jobs: la variable `runner.temp` estaba en `jobs.env`, donde ese contexto no está disponible. Se trasladó el directorio de reportes a `steps.env`. El error corresponde al workflow, no a una prueba PostgreSQL ejecutada. Consultar la siguiente ejecución del commit corregido; no contar esta ejecución como evidencia aprobada.

La siguiente ejecución [38438746365](https://github.com/Deareys/SGMO/actions/runs/38438746365) ejecutó y aprobó el job `security-and-postgres`: 10 grupos de migración/autenticación, seis escenarios de dos procesos HTTP y18operaciones/pagos sobre PostgreSQL16 real, además de172tests,35regresiones,tipos/build y6configWASM. Chromium inició correctamente y detectó un assert prematuro al revisar la cookie antes de finalizar logout. El smoke ahora espera respuesta200, eliminación de cookie y rechazo401de/me; no se relajó el resultado esperado. La ejecución del siguiente commit determina el resultado completo de browser.

La ejecución [38439626588](https://github.com/Deareys/SGMO/actions/runs/38439626588), commit `729e291`, repitió y aprobó todas las comprobaciones PostgreSQL. Browser confirmó correctamente logout y luego encontró que Configuración desaparecía justo después del login. Se identificó una redirección tardía de350msen PinLoginScreen: el callback seguía activo después de desmontar la pantalla y podía sustituir la pestaña ya elegida por el usuario. Se eliminó el retraso; el smoke mantiene su navegación inmediata para comprobar la reparación.
