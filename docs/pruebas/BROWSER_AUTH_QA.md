# QA de autenticación en navegador — Hito 1.2.1

Fecha: 12 de octubre de 2026.

## Estado real

**Pendiente de ejecución en navegador real.** La biblioteca Playwright existe en el runtime de trabajo, pero no hay ejecutable Chromium/Chrome. Se intentaron las descargas de Chromium y Chromium Headless Shell; ambas fallaron en todos los reintentos con archivo ZIP inválido/truncado (`End of central directory record signature not found`).

La ejecución de `node scripts/tests/browser-auth.smoke.cjs` terminó con salida 1 en `chromium.launch()` por ejecutable inexistente. **No se inició ningún servidor de QA ni se ejecutaron escenarios UI.** No hay capturas ni resultados positivos de navegador para este intento. `node --check scripts/tests/browser-auth.smoke.cjs` aprobó la sintaxis; eso no verifica sus selectores ni escenarios. El script queda preparado para reproducir la comprobación en un entorno con navegador disponible.

Las 26 pruebas de `client-auth-security.test.ts` usan el servicio real con red y almacenamiento simulados, y render ReactDOM estático. No sustituyen el recorrido de navegador.

## Comprobación preparada

`../scripts/tests/browser-auth.smoke.cjs` prepara estas comprobaciones:

1. Acceso móvil de 390×844: código vacío, sin listado público de trabajadores, teclado visible y ausencia de desborde horizontal.
2. Escritura de `userCode` con teclado físico sin ingresar accidentalmente números al PIN.
3. PIN incorrecto rechazado y trabajador correcto aceptado contra el backend real de demo aislada.
4. Logout elimina el bearer; acceso admin vacío y login central correcto.
5. Alta de usuario con HTTP 503 porque la demo no tiene DB: el error queda visible, el modal permanece y los perfiles no cambian.
6. Edición con 503 conserva modal/perfil y omite las credenciales vacías del payload.
7. Producción sin DB rechaza credenciales demo de trabajador y administrador incluso si `SGMO_AUTH_MODE=demo` está presente.
8. Ninguna credencial de prueba aparece en localStorage ni hay errores JavaScript de página.

**Estos son criterios del script, no resultados aprobados.** No se afirma integración PostgreSQL real. La alta/edición exitosa en navegador contra PostgreSQL queda fuera de este smoke y requiere la prueba de integración del Hito 1.2.2.

## Cómo reproducir

Desde la raíz del repositorio, con Node y las dependencias del proyecto instaladas:

```bash
npm ci
npm run build
```

Instalar Playwright fuera del repositorio para no alterar dependencias del producto, si el entorno no lo ofrece:

```bash
QA_RUNTIME_DIR=$(mktemp -d)
npm install --prefix "$QA_RUNTIME_DIR" playwright
node "$QA_RUNTIME_DIR/node_modules/playwright/cli.js" install chromium --only-shell
SGMO_PLAYWRIGHT_MODULES="$QA_RUNTIME_DIR/node_modules" node scripts/tests/browser-auth.smoke.cjs
```

Cuando el runtime ya ofrece Playwright y `CODEX_PRIMARY_RUNTIME_NODE_MODULES`, el script lo descubre automáticamente:

```bash
node "$CODEX_PRIMARY_RUNTIME_NODE_MODULES/playwright/cli.js" install chromium --only-shell
node scripts/tests/browser-auth.smoke.cjs
```

La prueba requiere el puerto 3000 libre. Crea un navegador nuevo sin perfiles ni sesiones del usuario, genera credenciales efímeras y no las imprime. Vacía variables de PostgreSQL, pagos, IA y bootstrap en los procesos de QA; primero ejecuta demo explícita en loopback y después producción sin DB. No consulta Neon, no ejecuta migraciones, no despliega y no escribe commits. Los procesos iniciados por el script se detienen al finalizar, también ante fallos.

Las capturas contienen exclusivamente pantallas de acceso vacías. Las evidencias se guardan en un directorio temporal nuevo por ejecución; se puede elegir el directorio mediante `SGMO_BROWSER_QA_DIR`. Solo una ejecución aprobada produce `result.json`. No activar trazas de navegador ni grabar payloads de login con credenciales.

## Revisión estática adicional

El formulario de usuario espera `onSave`, muestra el error recibido y no se cierra cuando el servidor rechaza. Al preparar QA se observó que los controles Cancelar y X aún permitían cerrar el modal mientras una petición estaba pendiente; el agente principal añadió `disabled={isSaving}` a ambos controles de `AdminConfigView.tsx`. La compilación lo comprueba; el comportamiento visual debe verificarse al ejecutar QA.
