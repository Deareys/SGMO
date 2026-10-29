# Verificación vigente — 29/10/2026

La entrega agrega `browser-configuration.smoke.cjs`: cinco recorridos UI → API → SQL efímero → otra sesión, con migración/respaldo, casas, carritos, porcentajes y archivo de usuarios. Configuración SQL ahora tiene siete grupos, incluido production sin demo y rechazo de reseed. Unitarias: 199. Aprobado en [40918742890, intento 2](https://github.com/Deareys/SGMO/actions/runs/40918742890), código f5395f1: ambos jobs success. Chromium 8+9+10+5. El primer intento falló con TypeError en corte TCP; la reejecución conserva las mismas expectativas estrictas. Evidencia y límites en [continuidad](../gestion/CONTINUIDAD_HITOS.md).

---

# SGMO — Validación continua y PostgreSQL multiproceso

Fecha: 13 de octubre de 2026. Hitos 1.2.2 y 1.3.

## Ampliación Hito 3.5 — 29/10/2026

El acceso móvil exige sólo dos campos, sin selector ni modos. El smoke de contraseñas incluye alta con clave inicial, recarga/logout del administrador, login desde otro navegador, edición con/sin contraseña, correo duplicado y cambio de clave en una cuenta sin base aun con una jornada abierta (diez recorridos). Se añaden validaciones de identidad, migración 010 no destructiva ante duplicados y persistencia después de reiniciar el backend. **Aprobado:** [40884981122](https://github.com/Deareys/SGMO/actions/runs/40884981122), `90a898994de7bfc6ddbdd9f82da3ab7432b6dc6e`: 196 pruebas, 35 históricas, once grupos auth SQL, once HTTP multiproceso, once de contraseñas SQL, 25 operativos PostgreSQL, seis de configuración WASM y Chromium 8+9+10.

El ensayo `deployed-users.smoke.mjs` es separado, mutativo y opt-in: requiere `--apply`, `SGMO_REMOTE_AUTH_QA_ENABLE=true` y `SGMO_REMOTE_AUTH_QA_CONFIG` apuntando a un archivo privado 0600 fuera del repositorio. El operador confirma primero el deployment y las variables limitadas a la rama QA, la copia Neon y la revisión exacta. No se ejecuta en la CI normal ni recibe secretos reales del negocio. Puede reanudar exclusivamente una ejecución propia interrumpida antes de la edición con `SGMO_REMOTE_AUTH_QA_RESUME=true`; no reabre bootstrap ni sobreescribe una cuenta previa para forzar el resultado. Las credenciales QA se retiran al terminar y sólo se guarda un resumen sin secretos. Ver [informe Hito 3.5](../historial/HITO_3_5_LOGIN_Y_USUARIOS.md).

## Ampliación Hito 3.4 — 20/10/2026

La política nueva admite 12–128 caracteres sin composición obligatoria. La suite histórica ahora prueba una entrada de 11 caracteres; un ejemplo de 12 ya no debe rechazarse por longitud. Se agregan cuatro pruebas de política y una de repositorio (193 en total), ocho grupos `passwords-sql.integration.ts --postgres`, tres escenarios de contraseñas en el runner HTTP multiproceso (nueve grupos en total) y seis recorridos `browser-passwords.smoke.cjs`. La CI verifica consumo competitivo de un código, cambio/login simultáneos, fallo cerrado de los tres endpoints, rollback integral y conservación de ventas pendientes al cambiar la clave. El navegador usa la API y SQL WASM efímero; sólo el job PostgreSQL prueba concurrencia por sockets. No usa Neon ni proveedores reales. El informe del [Hito 3.4](../historial/HITO_3_4_CONTRASENAS_Y_PRODUCCION.md) distingue los resultados locales de los de Actions.

**Verificado:** [39419629886](https://github.com/Deareys/SGMO/actions/runs/39419629886), `cf27d832b445977b3783bf38404c52f3e9822605`, 20/10/2026: ambos jobs success. El fallo inicial del escenario de consumo fue un 429 causado por el bloqueo por IP acumulado en la fixture; se separan esos escenarios reiniciando procesos y conservando SQL. Se mantienen los límites de seguridad y se exige un consumo200 y un rechazo400. El job operativo tiene 25 casos en PostgreSQL y 24 en WASM porque la prueba adicional usa conexiones concurrentes.

## Ampliación Hito 3.3 — 18/10/2026

El job SQL ejecuta ahora 24 casos de operaciones/liquidación en PostgreSQL 16, incluidos ceros, excepción individual y snapshot inmutable. El job browser instala Playwright 1.56.1 y PGlite 0.3.14 en un runtime externo y ejecuta ambos smokes: autenticación y `browser-central.smoke.cjs`. El nuevo smoke usa formulario `/setup`, dos contextos/cookies independientes, API real y SQL WASM efímero; comprueba cortes offline, ACK, respuesta perdida tras COMMIT, recuperación después de cerrar pestaña y ausencia de duplicados. No sustituye el job PostgreSQL multiproceso ni llama a proveedores.

El artefacto browser incluye `central/central-summary.json` y capturas operativas sin contraseñas. Nueve escenarios centrales pasaron localmente el 18/10, incluido el recibo con ceros; la recarga debe esperar una carga central nueva. El límite de abrir una pestaña completamente sin red se comprueba y registra como no soportado, no como PWA aprobada. Los resultados remotos de esta revisión se registran en [el informe del Hito 3.3](../historial/HITO_3_3_LIQUIDACIONES_Y_ACCESO.md) y el PR 2; una ejecución histórica no certifica el cambio nuevo.

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
| PostgreSQL 16 mediante servicio CI | Aprobado en 38441510211,commit c2e6e2c. |
| HTTP con dos procesos y PostgreSQL real | 6 grupos aprobados en 38441510211. |
| Browser headless en CI | 8 escenarios aprobados en Chromium,en 38441510211. |
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

La siguiente ejecución [38438746365](https://github.com/Deareys/SGMO/actions/runs/38438746365) ejecutó y aprobó el job `security-and-postgres`: 10 grupos de migración/autenticación, seis escenarios de dos procesos HTTP y18 escenarios de operaciones/pagos sobre PostgreSQL 16 real, además de172 pruebas,35 regresiones,tipos y build y6 grupos de configuración WASM. Chromium inició correctamente y detectó un assert prematuro al revisar la cookie antes de finalizar logout. El smoke ahora espera respuesta200, eliminación de cookie y rechazo401 de /me; no se relajó el resultado esperado. La ejecución del siguiente commit determina el resultado completo de browser.

La ejecución [38439626588](https://github.com/Deareys/SGMO/actions/runs/38439626588), commit `729e291`, repitió y aprobó todas las comprobaciones PostgreSQL. Browser confirmó correctamente logout y luego encontró que Configuración desaparecía justo después del login. Se identificó una redirección tardía de350 ms en PinLoginScreen: el callback seguía activo después de desmontar la pantalla y podía sustituir la pestaña ya elegida por el usuario. Se eliminó el retraso; el smoke mantiene su navegación inmediata para comprobar la reparación.

## Cierre técnico verificado

**Aprobado:** [38441510211](https://github.com/Deareys/SGMO/actions/runs/38441510211), commit `c2e6e2ced60e58520fd5268b088875ccca0761b3`, 13/10/2026. `security-and-postgres` y `browser` terminaron success: 174 pruebas,35 regresiones,tipos y build,10 grupos PostgreSQL de autenticación/migraciones,6 grupos HTTP multiproceso,18 escenarios de operaciones y pagos con concurrencia,6 grupos de configuración WASM y **8 escenarios Chromium**. El push equivalente [38441503064](https://github.com/Deareys/SGMO/actions/runs/38441503064) también aprobó. Cambios posteriores de esta entrega son documentación de este resultado, sin cambiar el código probado.

Los escenarios browser verifican acceso vacío móvil, credencial errónea, cookie HttpOnly/Strict y recarga, rechazo CSRF/origen, logout y loginadmin, alta/edición503conservarformularios, y rechazo demo productivo. No certifican el preview HTTPS protegido, una operación real en Neon ni un pago externo.
