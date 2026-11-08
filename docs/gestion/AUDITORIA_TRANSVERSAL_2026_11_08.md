# Auditoría transversal SGMO — 8 de noviembre de 2026

> Revisión del código publicado, consultas **de sólo lectura** a Neon production y pruebas automáticas aisladas. No implica certificación de celulares físicos, Mercado Pago real ni la API en el dominio (acceso de Vercel a observabilidad bloqueado por permisos 403).

## Estado de versión e infraestructura

- GitHub: `Deareys/SGMO`. PR #3 fusionado en main (`b266136182bf29cadc2154a0c1d13fd4db4f2885`), luego Vercel asignó ese mismo commit al despliegue Production `dpl_7sudN44w8u4HJmMJ8vi2xrrMkrUU`, estado READY y alias `sgmo-deareys.vercel.app`. Se requiere acceso del equipo Deareys para ejecutar verificación HTTP real y leer logs; no confundir BUILD READY con prueba extremo a extremo.
- Neon project `still-mud-30172607`, rama principal `production`, base `neondb`. Se observaron **26 tablas** y **12 migraciones**. El esquema y las columnas de `factory_state`, `factory_commands`, `house_stock`, `users`, `sales`, `daily_shifts` y demás repositorios inspeccionados son compatibles con las consultas revisadas.
- La producción fabrica lotes dentro de `factory_state.payload` (JSONB), no en una tabla física llamada `production_batches`. Esto es deliberado desde la migración 012. No crear otra tabla paralela.
- Estado en el instante de la consulta: **1 lote** en `factory_state` por **25.000 unidades centrales**, **1 comando** de fábrica, **0 traslados**, **0 filas de stock de casas**, **0 jornadas y 0 ventas**. La base confirma el lote, no confirma movimientos posteriores. No registrar traslados ficticios.
- Validaciones de integridad consultadas: **0** stocks negativos, **0** referencias huérfanas de stock, **0** roles desconocidos, **0** ventas huérfanas, **0** jornadas de stock huérfanas, **0** cuentas activas sin secreto de login. Tres perfiles activos aprovisionados según rol: 1 administrador, 1 coordinador, 1 vendedor (hay otros inactivos).

## Hallazgos priorizados

| Gravedad | Hallazgo | Evidencia | Acción |
| --- | --- | --- | --- |
| CRÍTICO — reparado | `/api/bootstrap` ocultaba `productionBatches` a coordinación; pantalla mostraba 0 aunque SQL contenía 25.000 u. | `bootstrapRoutes.ts`, `ProductionRepository.ts`, `ProductionInventoryView.tsx` | PR #3 publica suma central por variedad e historial de transferencias sin exponer costos/recetas. Prueba Chromium con 2 sesiones de roles distintos y traslados: PASS. |
| ALTA — pendiente | Gastos, incidencias/mantenimiento de carritos y reportes de playa persisten sólo en `localStorage` y no se propagan. Sus tablas `operational_expenses` y `cart_incidents` existen pero las funciones actuales no las usan; los reportes de playa carecen de tabla/API. | `storageService.ts:addExpense/reportCartIncident/updateIncidentStatus/createBeachReport`; `bootstrapRoutes.ts` pone `expenses/incidents/beachReports: []`. | Implementar repositorios y endpoints autenticados con idempotencia, permisos y pruebas multiusuario, conservar backups e importar datos locales sólo con revisión. No basta con refrescar la UI. |
| ALTA — pendiente | No existe canal push Realtime: el cliente consulta `/api/bootstrap` cada 30 segundos y al recuperar foco/red. | `App.tsx`, `storageService.refreshCentralState` | Mostrar hora de actualización y permitir refresco manual. Evaluar polling adaptativo/SSE si el caso de uso requiere menor latencia, sin aumentar innecesariamente el consumo móvil. |
| ALTA — pendiente | Cada carga recupera todas las jornadas, todas las ventas y toda la configuración desde SQL y filtra por rol en memoria del servidor. Se repetirá cada 30 s por dispositivo. | `bootstrapRoutes.ts` usa `shiftRepository.getAll`/`saleRepository.getAll`. | Añadir consultas SQL por rol/turno/temporada, paginación y delta desde cursor, con tests de autorización y consistencia. Nunca filtrar permisos únicamente en navegador. |
| ALTA — pendiente | El navegador copia snapshots, ventas y posiblemente fotos/base64 en `localStorage`; cuota y rendimiento limitados, colas pendientes deben preservarse. | `storageService.saveState` y `readOfflineQueue` | Evaluar IndexedDB para pendientes/comprobantes, compactar caché central y prevenir pérdida con pruebas de cuota; no borrar registros anteriores automáticamente. |
| MEDIA — corregido en rama de auditoría | Dashboard usa fecha UTC para día de Argentina, duplica ventas por transferencia al sumar `sales` + `shifts` y publica margen `54%` / costo `220` aunque no haya datos. | `DashboardView.tsx` | Día de Buenos Aires con prueba de cambio de fecha; transferencia desde totales centrales; margen `Sin datos` cuando no hay costos observables. |
| MEDIA — corregido en rama de auditoría | Fábrica mostraba botón de trasladar que backend denegaba al operario; falta de capacidad de destino y error de traslado poco visible en modal. | `ProductionInventoryView.tsx` y `ProductionRepository.command` | Ocultar botón a fábrica; mostrar capacidad restante y error dentro del modal. La validación final continúa siendo del servidor. |
| MEDIA — pendiente | Un coordinador no recibe detalles de recetas y costos intencionalmente. Los componentes y reportes deben calcular únicamente agregados autorizados, nunca simular precios/costos. | `ProductionRepository.snapshot`, `DashboardView` | Test de redacción y reportes con datos ausentes; no exponer costeo a coordinación. |
| MEDIA — pendiente | La descarga de comprobantes y verificación de pagos con Mercado Pago y OCR real no está certificada para el despliegue actual. | `paymentRoutes.ts`, adaptadores IA/MP, pruebas mock. | Ensayo aislado contra proveedor con credenciales del dueño y monto de prueba; fallo 402 Gemini se diagnosticó en histórico, no dar por resuelto. |
| MEDIA — validación de CI pendiente | `motion` no tiene referencias de uso en el código; se retiró su árbol de dependencias de `package.json` y `package-lock.json` en esta rama de auditoría, sin cambiar ninguna librería activa. | Búsqueda GitHub y análisis de dependencias del lock. | Sólo integrar si `npm ci`, TypeScript, pruebas y build completos pasan; conservar `tslib`, usado también por Tailwind. |
| MEDIA — pendiente | Vite en `package-lock.json` está fijado en 6.4.4, afectado por el aviso de seguridad GHSA-8g5g-mxqh-grgj; `jspdf` está en 4.2.1 (corrección del aviso GHSA-wfv2-pwc8-crg5) y Express en 4.22.3. | Lock exacto; GitHub Security Advisories de octubre y marzo de 2026. | Actualizar Vite a 6.4.5 o posterior en rama separada con `npm install` y lock regenerado por npm, sin hand-edit de integridad. La exposición directa del dev server no es la del frontend Vercel publicado. Ejecutar `npm audit` para dependencias transitivas. |
| MEDIA — pendiente | Gran parte de las vistas se importa de forma estática desde App; SellerTerminalView y AdminConfigView son especialmente grandes; `package.json` no tiene ESLint propiamente dicho (`lint` es `tsc`). | `App.tsx`, tamaños del repositorio, scripts NPM. | Dividir vistas con lazy/Suspense preservando estado, medir tamaño/gastos de red, añadir ESLint real y revisar dependencias directas/transitivas. |

## Matriz de flujos

| Flujo | Persistencia de código | Cobertura actual | Estado de campo |
| --- | --- | --- | --- |
| Login/sesión, alta y permisos | API Express + PostgreSQL; cookie HttpOnly, CSRF | pruebas unitarias, SQL y Chromium | Falta comprobación HTTP productiva por 403 Vercel |
| Catálogos, casas y carritos | API + SQL | Chromium/SQL, actualización entre contextos | Pendiente prueba con usuarios reales |
| Crear lote, materias primas | `/api/production/commands` + `factory_state` | Chromium y SQL aislados, idempotencia | Existencia real del lote comprobada en Neon |
| Cámara central → casa | comando SQL transaccional: resta por lote, suma `house_stock` | Chromium con roles separados y error 409 | **No existe traslado confirmado en Neon** |
| Casa → jornada/carrito, reposición | `daily_shifts`, `shift_stock_items`, `house_stock` | suites SQL de ventas e inventario | Sin jornadas reales; aceptación pendiente |
| Registrar ventas / offline / ACK | API + SQL, cola local por ID | suites offline, reintentos y multiproceso | No se hizo venta real |
| Pago MP + OCR | backend/proveedores | mocks y tests de seguridad | Verificación real pendiente |
| Cierre y liquidación | SQL transaccional + PDF posterior a ACK | tests SQL, PDF y regresiones | Aceptación financiera pendiente |
| Mantenimiento/incidencias | solo local en frontend | pruebas de UI local | **No compartido** |
| Gastos y rentabilidad | gastos locales, parte del resto central | componentes y mocks | **No compartido** |
| Reportes de playa y alertas | local | prueba UI local | **No compartido** |
| Temporadas | selección local | sin persistencia central confirmada | **No compartido** |

## Criterios de salida para producción operativa

1. Vercel: `/api/health` y `/api/db/status` 200 y conectados; `/api/bootstrap` autenticado comprobado con admin/coordinador/vendedor; pruebas de autorización 401/403; observabilidad sin errores críticos. Esta prueba no se pudo realizar todavía porque la conexión del equipo Deareys devuelve 403.
2. En un entorno de ensayo/ramificación, probar lote + traslado + despacho + venta + merma + restock + cierre + pago. Comparar saldos antes/después de cada transacción entre **dos contextos** con identidad distinta. Ningún movimiento se ejecuta directamente en producción para testear.
3. Verificar en teléfonos de playa latencia, interrupciones de señal, persistencia de pendientes y recuperación sin duplicación, y no mostrar stock/ventas como confirmados hasta ACK.
4. Centralizar mantenimiento, gastos, reportes de playa y temporadas; agregar cobertura de endpoints, esquema, RBAC, idempotencia y errores, sin reimportar registros locales automáticamente.
5. Hacer una revisión de dependencias y rendimiento con mediciones repetibles antes de retirar librerías o ampliar funcionalidades.

## Ejecutado y no ejecutado

- Ejecutado: inspección de GitHub, comparación focalizada de contratos TypeScript/SQL; consultas de sólo lectura al esquema y saldos de Neon; publicación del PR #3 y verificación metadata Vercel `READY`; CI del PR #3 (SQL, TypeScript, build y Chromium) aprobado.
- En validación separada: correcciones de fecha y panel financiero, visibilidad de acción de traslado y advertencia de reporte local, con nueva prueba de fecha.
- No ejecutado: peticiones autenticadas al despliegue Production; transacciones reales de stock/pagos/ventas; revisión exhaustiva de vulnerabilidades de todas las dependencias mediante `npm audit`; centralización de módulos heredados, pruebas físicas. Estos límites **no** se interpretan como éxito.
