# SGMO: cómo repetir el ensayo

Esta guía usa exclusivamente la rama GitHub `codex/sgmo-preparacion-mvp` y la rama Neon `sgmo-pruebas`. El informe con resultados y prompts es [HITO_3_2_ENSAYO.md](../historial/HITO_3_2_ENSAYO.md). No ejecutes las pruebas sobre la base productiva.

## 1. Comprobar la versión desde Vercel

1. Abrí el proyecto `sgmo` en Vercel → Deployments. Elegí un deployment **Preview**, estado **Ready**, de `codex/sgmo-preparacion-mvp`.
2. Usá la URL propia de ese deployment. Vercel puede pedir acceso con tu cuenta autorizada. La protección sigue activa; los accesos temporales del operador no son enlaces públicos permanentes.
3. Agregá `/api/health` a esa URL. Debe mostrarse un pequeño texto JSON con `status: "ok"`, `authTransport: "httpOnly-cookie"` y `revision` igual al commit del deployment. Un 200 de health sólo confirma el servidor.
4. Abrí `/api/db/status`. Deben aparecer **ambos** `configured: true` y `connected: true`. Un 200 con `connected: false` no aprueba la conexión.
5. Volvé a la raíz de la URL para abrir la app.

Usar siempre el mismo origen evita mezclar cookies entre deployments. Hasta configurar un `SGMO_PUBLIC_ORIGIN` estable, el backend toma la URL propia del deployment; un alias de rama diferente puede rechazar escrituras por origen.

## 2. Preparar tus cuentas

Las cuentas QA automáticas no son cuentas para operar: sus credenciales se retiran al finalizar. Los seis perfiles originales se conservan sin contraseñas/PIN predeterminados. Hay que aprovisionar tu administrador y luego crear trabajadores desde Administración.

El primer administrador usa el procedimiento de operador `POST /api/auth/bootstrap-admin` con `{ identifier, newPassword, bootstrapSecret }`, cookie/CSRF y el `BOOTSTRAP_SECRET` privado que configuraste en Preview. `ADM-01` es el código del perfil administrador semilla. La contraseña nueva debe tener al menos 14 caracteres, mayúscula, minúscula y número o símbolo. La pantalla de login actual no tiene un formulario de bootstrap. Este alta requiere un operador que aplique [AUTHENTICATION.md](../tecnica/AUTHENTICATION.md) y la configuración vigente de cookies/CSRF en [DECISIONS.md](../tecnica/DECISIONS.md); no uses el contrato bearer de las notas históricas.

Con el administrador ya aprovisionado, abrí login → Administrador e ingresá código/correo y contraseña. Después del alta y login confirmados, retirar `BOOTSTRAP_SECRET` y crear otro preview captura la configuración cerrada. Para trabajadores, el login usa su código individual y PIN de ocho dígitos no predecible. No compartas claves o PIN por GitHub/chat/capturas.

## 3. Probar una venta desde dos dispositivos

1. Desde Administración, crear una casa, carrito y producto con nombres **ENSAYO**. Fijar precios ficticios y registrar un conteo de 30 unidades ficticias con motivo ENSAYO. No alterar el catálogo real como parte de esta prueba.
2. Crear un vendedor de ensayo, asignarlo a esa casa y aprovisionar su PIN. El teléfono A entra como ese vendedor; el dispositivo B entra como administrador. Usar el mismo deployment en ambos.
3. Despachar 10 unidades al vendedor. La casa debe quedar con 20. La jornada debe empezar con cero vendidos.
4. En el teléfono A registrar una venta de una unidad en efectivo. Es una simulación operativa: no hace falta dinero real. Esperar la confirmación de sincronización.
5. Actualizar el dispositivo B. Debe ver exactamente la misma venta, con mismo identificador e importe, y una sola unidad vendida. Ver sólo la venta en A no demuestra persistencia central.
6. Cerrar la jornada declarando nueve unidades devueltas, cero merma y efectivo ficticio igual a esa única venta. La casa debe terminar con 29, con diferencia física y de caja cero.
7. Cerrar sesión y volver a ingresar para comprobar que la venta sigue guardada. Usar nombres ENSAYO permite reconocer el historial después.

La prueba automática ya ejercitó el reenvío del mismo ID: una primera inserción y cero inserciones en el segundo envío. Para comprobarlo técnicamente en GitHub, abrir Actions → `security-and-postgres` → `PostgreSQL sales, inventory and bank payment integrity`. No repitas manualmente el cobro para simular un reintento.

Una venta con `isOfflineCreated:true` enviada por HTTP prueba el contrato del servidor. La prueba de desconectar físicamente el teléfono, recargarlo y recuperar toda la cola requiere un ensayo adicional: no la da por aprobada este informe.

## 4. Distinguir banco y OCR

| Prueba | Qué demuestra | Qué falta demostrar |
| --- | --- | --- |
| Consulta de pagos recientes con HTTP 200 | El backend pudo consultar la API oficial con la credencial del servidor | Cobro nuevo, cuenta compradora/receptora, conciliación y webhook |
| OCR con `extractionSucceeded: true` | Gemini devolvió datos que el servidor pudo interpretar | Que ese dinero esté acreditado |
| OCR pendiente o `ocrFailure` | No hubo lectura confirmada; revisar código seguro de diagnóstico | Nunca completar importe/operación inventados |
| Pago bancario acreditado | Debe existir consulta oficial y verificaciones de cuenta, importe, moneda, fecha y unicidad | Un comprobante por sí solo no lo demuestra |

Para cámara/OCR usar primero una imagen con importe y número ficticios y la marca **ENSAYO SIN VALIDEZ**. No usar pagos reales de otra venta para comprobar el circuito ficticio. Los webhooks del proveedor todavía necesitan una URL de ensayo estable que Mercado Pago pueda alcanzar sin sesión de Vercel.

## 5. Ver las pruebas en GitHub o ejecutarlas

En GitHub → Actions, abrir **SGMO validation** de la revisión elegida. Los dos trabajos son `browser` y `security-and-postgres`. Verde significa que aprobaron los escenarios de esos trabajos; el navegador de CI usa cuentas efímeras y no sustituye la prueba de campo del preview con Neon/proveedores.

En una terminal de VS Code/Codespaces, dentro de la carpeta del repositorio:

```bash
npm ci
npm run lint
npm test
npm run build
npm run test:auth:legacy
```

`lint` comprueba tipos, `test` ejecuta escenarios automáticos, `build` genera la aplicación y la última orden prueba contratos históricos en demo aislada. Estas órdenes no ejecutan migraciones sobre Neon. Las pruebas de PostgreSQL real las prepara CI en su contenedor desechable; no apuntar esas suites a la base del negocio.

Si algo falla, guardar el nombre de la prueba, estado HTTP y `revision`. No guardar cuerpos de login, cookies, claves o cadenas de conexión. Un 401 suele exigir sesión, un 403 requiere revisar permisos/origen/CSRF, y un 503 indica que una dependencia no pudo confirmar la operación. Revisar el código y el mensaje concreto antes de concluir la causa.
