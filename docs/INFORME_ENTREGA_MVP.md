# SGMO: informe de entrega MVP para revisión

Fecha: 13 de octubre de 2026. Rama: `codex/sgmo-preparacion-mvp`. Base recibida: `d291d5ae52f1a86d4445824beec553ea1cbcf877`. Responsable de integración y publicación: principal Codex. No se integró en main ni se ejecutaron migraciones en Neon.

## Resultado de esta intervención

Se recuperó seguridad perdida en la exportación de Studio y se integraron sesiones de navegador, persistencia autorizada, ventas offline, inventario y operaciones centrales, configuración y verificación bancaria. Se conservó React/Express, las fórmulas económicas de la pantalla activa y los registros previos. Los precios del vendedor ahora reflejan el catálogo; sólo la API bancaria y su ledger central confirman acreditación. Los errores no inventan enlaces, cantidades bancarias, IDs OCR o confirmaciones de guardado.

Los hitos y prompts están en [HITOS_Y_PROMPTS_MVP.md](HITOS_Y_PROMPTS_MVP.md), y la explicación para Sebas en [GUIA_SEBAS.md](GUIA_SEBAS.md). El historial anterior en PR1/fef86d4 queda como antecedente; esta rama parte del main actualizado y recupera sus reparaciones necesarias.

## Evidencia local de la revisión publicada

| Verificación | Resultado | Qué demuestra |
| --- | --- | --- |
| `npm run lint` | Aprobado, sin errores | TypeScript compilable; no declara modo strict ni ESLint |
| `npm test` | 174 aprobadas, 0 fallas/canceladas/omitidas | Contratos HTTP, sesiones, CSRF, roles, TLS, cliente, cola, cuotas, OCR, banco simulado y UI/adaptadores |
| `npm run build` | Aprobado, frontend/servidor y 6 archivos públicos | Compilación completa y packaging frontend sin publicar backend; queda aviso de bundle grande |
| `npm run test:auth:legacy` | 35 aprobadas, 0 fallas | Autenticación/RBAC y rechazo de escritura bancaria/central ficticia sin configuración |
| SQL autenticación/migraciones | 10 grupos aprobados, migraciones 001–008 | Sintaxis, constraints, revocaciones y rollback en PostgreSQL WASM |
| SQL operaciones/pagos | 17 grupos aprobados | Precio central/centavos, transacciones, stock, idempotencia, liquidación, ledger bancario y evidencia histórica no confiable |
| SQL configuración | 6 grupos aprobados | Catálogo, stock físico, permisos, capacidad, auditoría y congelación de política económica |
| `git diff --check` | Aprobado | Sin errores de espacios del diff |

Las suites con SQL se ejecutaron en motores WASM efímeros, sin Neon. La suite histórica se adaptó a las restricciones reales: los antiguos asserts de precio sobre demo ya no se consideran pruebas de integridad central. Esa cobertura está en SQL/unitarias; no se aceptan503 como alternativa permisiva a400/403para fingir esos casos.

## Evidencia en GitHub que debe consultarse

El workflow [SGMO validation](https://github.com/Deareys/SGMO/actions) incluye PostgreSQL 16 por sockets, autenticación mediante dos procesos, transacciones operativas con conexiones concurrentes, configuración WASM y Chromium. Revisar la ejecución que corresponda al commit de esta rama. Un workflow escrito no es un resultado aprobado; su conclusión y artefactos están en esa ejecución. Los reportes excluyen credenciales/dumps/URLs de conexión.

En el entorno local no se pudo iniciar PostgreSQL 16 porque el namespace no permite asignar UID de un usuario no root; tampoco se pudo completar la descarga local de Chromium. Ninguno de esos intentos se contó como una prueba aprobada. La prueba de pérdida de conectividad del runner real corta sockets mediante proxy TCP local, no reinicia el motor ni certifica varias instancias en la nube.

## Cierre CI aprobado

[38441510211](https://github.com/Deareys/SGMO/actions/runs/38441510211) terminó **success** en ambos jobs, con el código `c2e6e2ced60e58520fd5268b088875ccca0761b3`:174 pruebas,35 regresiones,tipos y build,10 grupos SQL de autenticación,6escenarios HTTP multiproceso,18 escenarios de operaciones/pagos PostgreSQL 16real,6 grupos de configuración WASM y 8 escenarios Chromium. El workflow equivalente de push también aprobó. Esta actualización final de documentación conserva ese código. Se cerró la prueba CI por sockets/navegador; sigue pendiente certificar el deployment/entorno operativo.

## Historial PostgreSQL real en Actions

La ejecución [38438746365](https://github.com/Deareys/SGMO/actions/runs/38438746365), commit `4eaf617`, ejecutó correctamente migraciones/autenticación (10 grupos), HTTP con dos procesos (6 grupos) y operaciones/pagos (18 escenarios, incluido dos conexiones concurrentes). Tipos,172 pruebas,35 regresiones,build y6 grupos de configuración WASM también pasaron. Browser empezó en Chromium real y detectó una carrera en el smoke al revisar cookie antes de finalizar logout; se corrigió la espera sin cambiar los asserts financieros/de seguridad. Consultar el siguiente commit para la conclusión completa. Más historial en [CI.md](CI.md).

Vercel marcó una preview automática como desplegada. La petición pública a `/api/health` redirigió a **Login – Vercel**: su protección impide comprobar desde esta sesión la app/backend. Esto no demuestra fallo de SGMO ni confirma su configuración. No se eludió esa protección ni se modificaron variables o datos remotos.

## Qué todavía impide certificar producción

1. Estado/datos de Neon sin identificar: primero respaldo, copia aislada, revisión de migraciones y aprovisionamiento. La005 invalida credenciales heredadas una vez. Inventario inicial exige conteo real; el catálogo y alias de semilla necesitan revisión del negocio.
2. CI ya aprobado para el código entregado; verificar el preview HTTPS de esa revisión, cookies/origen/CSRF/proxy/TLS, usuarios y dos dispositivos. Health200 solamente prueba backend activo y versión.
3. Prueba oficial de Mercado Pago con cuenta receptora y sandbox, firma de webhooks, importes y OCR real. Fixtures no demuestran conectividad o permisos del proveedor. El retorno de Checkout nunca se toma como aprobación.
4. Elegir la regla comercial sobre diferencia de efectivo: se conserva la fórmula de la pantalla activa, sin descontar automáticamente otro faltante. No se envía dinero al registrar pago de comisión.
5. PWA completa y almacenamiento durable de imágenes/IndexedDB siguen pendientes; localStorage tiene cuota y no existe apertura inicial offline certificada. Fábrica/gastos/traslados/mantenimiento/radar y marcas manuales de revisión tienen partes locales, señaladas en UI.
6. Recorrido interactivo en un móvil real: despacho, venta/offline, reposición, merma, sobrantes, conciliación, PDF y entrega de comisión. Las pruebas SSR no sustituyen ese recorrido.

## Pasos siguientes

CI técnico ya aprobado. Ahora acceder al dominio de Vercel y preparar una preview con una base distinta de la operativa. Aplicar/probar migraciones sobre copia, provisionar cuentas de ensayo, configurar catálogo/casas/carritos/zonas/stock y seguir GUIA_SEBAS. Cerrar los límites de PWA/módulos locales y política de liquidación antes del ensayo con ventas reales. No llamar a esta entrega “lista para salir a vender” mientras esos puntos permanezcan pendientes.
