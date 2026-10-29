# SGMO — Pruebas SQL de autenticación (Hito 1.2.2)

Fecha: 12 de octubre de 2026. Base de trabajo: `43971a03719734ef11c3042b0c745162b4874174` más reparaciones locales del Hito 1.2.1.

## Evidencia y alcance

`scripts/tests/postgres-auth.integration.ts` ejecuta SQL de las migraciones y de los repositorios de producción, con dos transportes separados:

| Modo | Qué verifica | Qué no demuestra |
| --- | --- | --- |
| `--wasm` | Motor PostgreSQL compilado a WASM (PGlite), SQL real, constraints, transacciones, migraciones y operaciones del repositorio. No devuelve filas programadas mediante mocks. | Transporte de `pg`, sockets, procesos distintos, contención de locks entre conexiones ni protección distribuida en Cloud Run. |
| `--postgres` | PostgreSQL local mediante `pg.Pool`, con operaciones simultáneas de bootstrap y contador por cuenta. | Neon, Cloud Run, latencia de red, varias instancias desplegadas ni caída/reinicio real de infraestructura. |

Ejecución WASM comprobada: **10 grupos aprobados**, sin conectar Neon ni otra base remota. PostgreSQL con sockets no ejecutado en este entorno: no hay servidor PostgreSQL instalado y la instalación del sistema no está permitida. La dependencia opcional PGlite 0.3.14 se instaló fuera del repositorio; no se añadió una dependencia de producción ni se modificó `package.json` por estas pruebas.

## Casos cubiertos

1. Instalación nueva con migraciones 001–005, semilla sin credenciales y segunda ejecución del migrador sin repetir versiones.
2. Bootstrap de administrador inicial: rechazo de trabajador, uso único y reutilización rechazada. La competencia simultánea entre dos administradores se ejecuta sólo en el modo PostgreSQL.
3. Alta con PIN aleatorio, hash verificable, PIN incorrecto rechazado, respuestas de repositorio sin hashes/salts/credenciales y cuenta no provisionada sin emisión de sesión.
4. Rollback conjunto de contador de éxito y sesión, seguido de commit exitoso. Un gestor nuevo consulta la sesión central; no depende del objeto anterior.
5. Cinco fallos bloquean durante la ventana; fallos dentro del bloqueo no prolongan su vencimiento. Bloqueo expirado y ventana antigua comienzan nuevamente en uno. Incrementos paralelos sólo en PostgreSQL.
6. Restablecimiento de PIN/contraseña, cambio de rol, modificación de permisos e inactividad revocan sesiones; cambio de rol sin nueva credencial deja la cuenta sin aprovisionar.
7. Logout y expiración rechazan tokens previamente emitidos.
8. Snapshot existente anterior a 004: contraseñas válidas preservadas, PINs anteriores invalidados, revocación de sesiones y códigos únicos incluso con IDs históricos con/sin cero.
9. Colisión de códigos ignorando mayúsculas aborta 005 y permite rollback sin renombrar las cuentas ni conservar cambios parciales.
10. Snapshot con 004 ya registrada: 005 independiente conserva administrador válido, no reactiva uno sin aprovisionar, invalida administrador con hash malformado y exige restablecimiento de trabajadores.

Las pruebas HTTP de login, contratos, fallos centrales y RBAC se ejecutan separadamente. Este runner comprueba persistencia y SQL; no afirma haber ejecutado un flujo HTTP completo sobre PostgreSQL.

## Ejecutar con PostgreSQL local

Usar una **base exclusiva y desechable**, creada previamente por el responsable del entorno local. Nunca copiar `DATABASE_URL` de producción. Por ejemplo, si PostgreSQL local ya está instalado:

```bash
createdb sgmo_auth_test_local
```

Desde la raíz del proyecto, definir `SGMO_AUTH_TEST_DATABASE_URL` mediante la configuración local segura de la terminal y ejecutar:

```bash
node --import tsx scripts/tests/postgres-auth.integration.ts --postgres
```

Formato aceptado: `postgresql://usuario@127.0.0.1:5432/sgmo_auth_test_local`. Si hace falta contraseña, consumirla por una variable local segura; no agregarla a scripts, documentación, Git ni capturas. La URL puede incluir contraseña, pero el runner nunca la imprime.

Guardas obligatorias del runner:

- Host literal `127.0.0.1` o `[::1]`; no acepta `localhost`, nombres DNS ni hosts remotos.
- Base cuyo nombre cumple `sgmo_auth_test*`; no acepta parámetros adicionales ni fragmentos en la URL suministrada.
- Ignora `DATABASE_URL`, `POSTGRES_URL`, variables PG heredadas y configuración SSL previa. No carga `.env`.
- Crea esquemas nuevos con sufijo criptográficamente aleatorio y elimina únicamente esos esquemas al terminar. No elimina la base ni `public`.
- Las credenciales se generan en cada ejecución, no se imprimen y no se escriben a archivos.

Si la ejecución se interrumpe de forma forzada pueden quedar esquemas `sgmo_auth_test_*`; revisarlos manualmente dentro de esa base exclusiva. No utilizar órdenes de borrado masivo en una base que contenga información operativa.

## Ejecutar con PostgreSQL WASM

Instalar la dependencia opcional en un directorio temporal separado:

```bash
npm install --prefix /workspace/scratch/012845ae38fb/sql-test-runtime @electric-sql/pglite@0.3.14
```

Comando utilizado durante esta intervención:

```bash
SGMO_PGLITE_ROOT=/workspace/scratch/012845ae38fb/sql-test-runtime/node_modules/@electric-sql/pglite node --import tsx scripts/tests/postgres-auth.integration.ts --wasm
```

Adaptar las rutas en otra máquina. Se carga la extensión `uuid-ossp` incluida en PGlite para ejecutar 001 íntegramente. El adaptador sustituye únicamente el transporte de `pg.Pool` durante este proceso de prueba y restaura sus métodos al finalizar. La ejecución es en memoria, sin directorio de datos permanente.

Se emplea `node --import tsx` porque la CLI `npx tsx` intenta crear un socket IPC y recibió `EPERM` en este entorno. Ese límite no demuestra un fallo del código de autenticación.

## Pendientes antes de cerrar integración de producción

- Ejecutar `--postgres` con un PostgreSQL local disponible; registrar versión del servidor y resultado exacto.
- Dos procesos de backend distintos deben competir por bootstrap y login en la misma base. La prueba en un pool concurrente no equivale a instancias distribuidas.
- Probar login correcto simultáneo con restablecimiento/inactividad y caída/reinicio reales del servidor: nunca emitir una sesión tras credenciales reemplazadas ni recuperar acceso mediante memoria.
- Verificar instalación de 005 sobre una copia aislada del esquema real, especialmente códigos duplicados y estado de 004. No ejecutar sobre Neon en este alcance.
- Si una versión antigua de 004 ya borró una contraseña, el hash no se puede reconstruir; requiere respaldo o restablecimiento autorizado. El test no promete recuperarlo.
- 005 invalida PINs de trabajadores existentes una sola vez: coordinar aprovisionamiento seguro y respaldo antes de aplicar en un entorno operativo. No reejecutar manualmente el archivo SQL sobre usuarios ya restablecidos; usar el migrador versionado.

Estado del Hito 1.2.2: **evidencia SQL WASM disponible; integración PostgreSQL con conexiones reales y distribución pendiente**.
