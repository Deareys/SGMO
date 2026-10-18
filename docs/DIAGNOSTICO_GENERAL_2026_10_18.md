# SGMO — Diagnóstico general del 18 de octubre de 2026

**Dictamen:** el núcleo de ventas tiene una base técnica comprobada en ensayo, pero la aplicación completa todavía no está lista para operar en producción en la playa. Hay bloqueos de publicación, acceso inicial e integraciones, un defecto económico con valores cero y funcionalidades que siguen siendo locales.

Fecha de inspección: 18/10/2026, Argentina. Revisión de ejecución: `97e1308d2fbf1976453f2c7a6fd85d96f10af2c6`, rama `codex/sgmo-preparacion-mvp`. Main: `d291d5ae52f1a86d4445824beec553ea1cbcf877`. El [PR 2](https://github.com/Deareys/SGMO/pull/2) sigue abierto y en borrador, sin integrar. El commit de este informe sólo cambia documentación.

## Qué se verificó y qué significa

Se compararon por SHA de blob **131 archivos de ejecución, pruebas, migraciones y configuración** del espacio de trabajo contra GitHub: ninguna diferencia. Después se ejecutaron tipos, pruebas, build y regresiones; se consultaron Vercel y ambas ramas Neon mediante lecturas; se comprobó el preview con un acceso temporal autorizado. No se crearon usuarios ni ventas, no se ejecutaron migraciones y no se probaron cobros durante este diagnóstico.

El escenario analizado es: trabajador inicia sesión → carga jornada/catálogo central → registra venta → conserva el pendiente hasta ACK → coordinador ve el mismo registro → cierre usa valores centrales → consulta bancaria u OCR actualizan evidencia sin inventar acreditación. Producción y ensayo se evaluaron por separado.

Al terminar las lecturas se revocó el acceso temporal de este diagnóstico, sin regenerarlo. No se cambió la protección general de Vercel ni el acceso habitual del propietario.

| Área | Estado | Evidencia y límite |
| --- | --- | --- |
| Producción pública | Bloqueada | La raíz `https://sgmo-rose.vercel.app/` devuelve HTML 200; `/api/health` y `/api/db/status` devuelven 404 con `x-vercel-error: NOT_FOUND`. Una interfaz visible no prueba que el backend funcione. |
| Versión desplegada | Pendiente de promoción | Producción `dpl_86jnrjcuhse1TDNUuuH9NHQasdUw` apunta a main `d291d5a`; las reparaciones están en la rama de ensayo. Vercel declara READY para ambos, pero ese estado no certifica las rutas de la aplicación. |
| Preview actual | Operativo para comprobación técnica | `dpl_xSRydpMpHhK1zaCCvBuLVGKWFtDD`, URL propia `https://sgmo-2fnefv9jn-deareys.vercel.app`, revisión `97e1308`. Raíz, health y base 200 después del acceso autorizado. |
| Base de ensayo | Inicializada y conectada | 21 tablas, ocho migraciones; consultas SQL y conexión desde el backend confirmadas. |
| Acceso de usuarios | Falta alta inicial | Ocho perfiles totales, seis originales activos y dos QA inactivos; **cero perfiles activos aprovisionados**, cero administradores aprovisionados y cero sesiones utilizables. Los perfiles originales no tienen credenciales predeterminadas. |
| Ventas, stock y cierre | Implementados y probados, con un defecto económico pendiente | Hay ACK, idempotencia, alcance por rol y transacciones. El recorrido real con datos ficticios del 15/10 está documentado; hoy se reejecutaron las pruebas locales. Los casos de valores cero descritos más abajo requieren reparación. |
| Mercado Pago | Integración parcial verificada | La consulta oficial de pagos recientes aprobó el 15/10. No hay claims ni eventos en Neon; no está demostrado el ciclo completo de un cobro, firma entrante, consulta, conciliación y reintento del proveedor. No se repitió hoy la consulta autenticada porque no hay cuentas operativas. |
| Gemini/OCR | Extracción real pendiente | Última llamada real documentada, 15/10: proveedor 402 `BILLING_REQUIRED`. No se repitió hoy ni se presume que la facturación siga igual. Tener una variable presente no certifica saldo, permisos o extracción. |
| Uso sin señal | Parcial | La cola conserva ventas hasta ACK, pero `restoreSession()` exige validación central tras recargar. No hay manifest, service worker ni IndexedDB implementados. Abrir/recargar completamente sin red y recuperar el trabajo en playa sigue pendiente. |
| Fábrica, gastos, radar e incidencias | Persistencia local | Métodos de `storageService.ts` guardan estos registros en caché del navegador; las pantallas muestran `LocalOperationNotice`. No son una fuente compartida y respaldada en Neon. La rentabilidad combina ventas centrales con costos locales/estimados. |
| Pruebas y dependencias | Aprobadas dentro del alcance | Tipos, 177 casos, build, 35 regresiones y `npm audit` sin vulnerabilidades conocidas reportadas. Eso no equivale a certificar todas las reglas económicas o dispositivos. |

## Hallazgos prioritarios

### D-01 — Alta prioridad: producción sigue usando código anterior y no tiene API operativa

La configuración de producción observada es diferente de la de ensayo. La lista actual de variables contiene `DATABASE_URL`, Access Token de Mercado Pago y secreto de webhook únicamente para Preview, incluyendo overrides de esta rama. No aparecen esas claves con destino Production. La base Neon llamada `production` tiene **cero tablas públicas**. `GEMINI_API_KEY` y `APP_URL` sí aparecen con destino Production, pero no sustituyen las variables de base/banco ni `SGMO_PUBLIC_ORIGIN`.

Además de las rutas 404, main conserva en `src/services/storageService.ts`, método `loginAsAdminAsync`, una contingencia local que admite al perfil administrador encontrado sin verificar la contraseña cuando la respuesta central no fue exitosa ni 401/429. Esto es un defecto de autenticación del cliente antiguo, no prueba de acceso a una base remota. La rama de ensayo elimina esa contingencia y exige sesión central. No utilizar main para iniciar una operación real mientras siga en ese estado.

**Cierre del hallazgo:** corregir los defectos pendientes de la rama actual, revisar e integrar la versión adecuada mediante el flujo de release, preparar configuración/esquema productivos con respaldo y comprobar API, sesión y operación en el dominio final. No basta con fusionar el PR: producción todavía necesita sus propias credenciales y preparación de base.

### D-02 — Alta prioridad: valores económicos cero se reemplazan por valores predeterminados

`validateSystemConfig` en `src/server/db/repositories/ConfigurationRepository.ts` admite `housingCostPerPersonDaily: 0` y `deductionRatePerMissingUnit: 0`. Sin embargo, `closeAndReconcileShift` en `src/server/db/repositories/ShiftRepository.ts` usa:

```ts
config.housingCostPerPersonDaily || 8000
config.deductionRatePerMissingUnit || 1500
```

El operador `||` considera el cero como ausente. Para un vendedor **no exento** y vivienda configurada en cero, el cierre toma 8000. Para faltantes sin política escalonada definida y tarifa plana cero, pasa 1500 al cálculo. No es necesario modificar una base para demostrar la discrepancia entre la validación y esas expresiones.

Reproducción del 18/10, sólo validador y funciones puras con las expresiones de la ruta:

| Caso | Valor aceptado | Valor utilizado por la expresión |
| --- | --- | --- |
| Vivienda diaria, vendedor no exento | 0 | 8000 |
| Tarifa plana de faltante, sin tramos de merma | 0 | 1500 |
| Deducción resultante por un faltante con esa tarifa | Esperado 0 | 1500 |

La misma construcción aparece en la previsualización de comisión de `SellerTerminalView.tsx`, `ReconciliationClosingView.tsx` y en el porcentaje mostrado por `liquidationPdfGenerator.ts`: una comisión cero puede mostrarse como 20 %. El cálculo central de comisión sí usa `??` para su valor de respaldo; hay que alinear presentación, PDF y cierre sin cambiar importes históricos.

El campo `housingCostOverride` también se persiste y lo contempla `CalculateSettlementUseCase`, mientras el cierre central consulta sólo comisión y exención del vendedor y aplica el costo global. Debe revisarse la regla esperada para esa excepción antes de certificar consistencia entre los dos caminos de cálculo.

**Cierre del hallazgo:** distinguir cero de ausencia y agregar casos de regresión de cierre SQL, previsualización y PDF para vivienda cero, tarifa cero, comisión cero y excepción individual. Mantener snapshots históricos. No se corrigió el código de negocio durante este diagnóstico. Las 177 pruebas actuales no cubren todos estos casos; el ensayo previo usó vendedor exento y no detectaba vivienda cero.

### D-03 — Alta prioridad: falta una cuenta propia para operar

La limpieza del ensayo anterior retiró intencionalmente las credenciales QA. Eso dejó disponible el alta del administrador original mediante `POST /api/auth/bootstrap-admin`, con secreto de infraestructura y nueva contraseña privada. La pantalla de login no incluye asistente de alta inicial; un usuario sin conocimientos técnicos no puede resolverlo escribiendo cualquier contraseña en login.

**Cierre del hallazgo:** preparar un procedimiento de alta privado y comprensible para el propietario, verificar su login y crear los trabajadores desde Administración. No publicar contraseñas/PIN ni dejar las cuentas técnicas de QA activas como cuentas de negocio.

### D-04 — Alta prioridad para pagos: falta validar la cadena completa del proveedor

Mercado Pago tiene código de firma HMAC, inbox durable, ledger con unicidad y consulta oficial. Pero el preview exige Vercel Authentication a una petición anónima. El permiso temporal del operador no se entrega automáticamente a Mercado Pago. `create-preference` arma `notification_url` con el origen del servidor; un cambio sólo en el panel del proveedor puede no corregir esa URL efectiva.

`SGMO_PUBLIC_ORIGIN` no aparece en la configuración inspeccionada. El fallback `VERCEL_URL` es válido para el dominio propio del deployment, pero no equivale a un origen estable para operación, cookies y avisos bancarios. No se debe desactivar indiscriminadamente la protección como solución al diagnóstico.

No hay eventos bancarios persistidos ni claims en el ensayo. Tampoco hay un worker/scheduler implementado para revisar automáticamente todos los eventos fallidos; existe reintento administrativo. Deben probarse entrega real, firma, receptor, importe, moneda, fecha, duplicados y conciliación con cuentas de prueba apropiadas.

La consulta de dos pagos aprobada el 15/10 no demuestra que cualquier número leído de una transferencia externa se pueda consultar mediante esta API. El caso real del cliente —muchos vendedores, una cuenta receptora— requiere ese ensayo específico. OCR nunca reemplaza esa comprobación.

### D-05 — Prioridad de puesta en marcha: OCR y facturación por comprobar

El backend acepta el nombre canónico `GEMINI_API_KEY` y, como compatibilidad, `GIMINI_API_KEY` cuando falta o está vacía la primera. La errata sigue presente en la configuración de Preview. No se leyeron los valores Secret.

El diagnóstico incorporado devuelve códigos acotados y no el error privado completo del SDK. Último resultado real: extracción fallida con proveedor 402, importe/operación desconocidos y acreditación falsa. La facturación del proyecto asociado a la clave debe revisarse y la extracción debe repetirse con una imagen SIN VALIDEZ; luego con cámara real. **Estado actual de la facturación: pendiente de confirmación, no se consultó la cuenta de Google hoy.**

### D-06 — Alta prioridad para la playa: offline todavía no cubre todo el ciclo

En `storageService.ts`, `restoreSession()` devuelve `false` si el navegador informa que está offline, y la identidad inicial no se restaura desde un perfil local. Es una protección de autenticación deliberada. Sin un mecanismo adicional seguro para continuar una sesión cargada y sin assets offline, recargar/cerrar/abrir la app sin señal no está resuelto de forma completa.

Las ventas pendientes se conservan en `localStorage`, incluyendo fotos base64. Hay pruebas de cuota/ACK/reenvío, pero no hay almacenamiento de imágenes separado ni una prueba de campo de recuperación con el teléfono cerrado, sin conexión y luego reconectado. Debe ensayarse antes de depender de la app durante una jornada.

### D-07 — Alcance pendiente: no todos los módulos comparten información

Ejemplos de rutas locales: `addExpense`, `createProductionOrder`, `reportCartIncident`, `setActiveSeason` y gestión de materias primas/proveedores en `storageService.ts`. Guardan en el estado local; no tienen el circuito de confirmación central del despacho/venta/cierre.

Los avisos de interfaz son correctos, pero no convierten estos módulos en funcionalidad multiusuario. Si el entregable incluye fábrica, gastos, compras, traslados, mantenimiento, radar y multitemporada como gestión compartida, falta desarrollo. Si se entrega primero sólo el circuito comercial, debe explicitarse ese alcance y evitar que datos locales se interpreten como inventario/contabilidad centrales.

### D-08 — Mejoras de operación y mantenimiento

- **Carga móvil:** el build genera un chunk principal de 1.649,80 kB, 450,84 kB gzip, y avisa tamaño elevado. Revisar carga diferida por módulo/PDF. No se midió rendimiento real en un teléfono de playa; los tiempos de esta conexión de diagnóstico no sirven como benchmark móvil.
- **Carga central:** `/api/bootstrap` obtiene todas las jornadas/ventas y luego filtra por rol; el cliente lo solicita cada 30 segundos. Revisar filtrado SQL y paginación cuando aumente el historial. Una venta de ensayo no demuestra comportamiento con una temporada completa.
- **Migraciones:** el endpoint administrativo `/api/migrate` está protegido por sesión/rol/CSRF, pero no usa el control de destino explícito del script CLI. Revisar su disponibilidad y el rol de base de mínimo privilegio durante el release; no se invocó.
- **Liquidación:** acordar la política de diferencia de efectivo. La fórmula central conservada registra la diferencia por separado y no la descuenta automáticamente del pago final; el camino alternativo de dominio debe seguir la misma política acordada.
- **Respaldo:** existe la rama previa a la migración, sin compute. No hay evidencia de una restauración de ventas recientes o de una prueba de recuperación operativa. Esto no afirma que Neon carezca de mecanismos automáticos; falta demostrar el procedimiento elegido.
- **Continuidad:** el Git local conserva un HEAD anterior y cambios locales ya publicados mediante API autenticada. El cotejo de 131 archivos confirmó que el código auditado coincide con GitHub. No se hizo reset, ni se borraron diferencias del usuario para aparentar un árbol limpio.

## Evidencia de las verificaciones

| Verificación del 18/10 | Resultado |
| --- | --- |
| `npm run lint` | Exit 0 |
| `npm test` | 177 aprobadas, cero fallas, cero omitidas |
| `npm run build` | Exit 0; frontend y bundle de servidor generados; aviso de chunk grande |
| `npm run test:auth:legacy` | 35 aprobadas, cero fallas |
| `npm audit --json` | Exit 0; cero vulnerabilidades conocidas reportadas en el árbol auditado |
| HTTP del preview autorizado | Raíz 200; health 200 con revisión `97e1308`; base 200 `configured:true, connected:true` |
| HTTP sin sesión SGMO en preview autorizado | `/api/auth/me`, `/api/bootstrap`, `/api/mercadopago/status`: 401, correctamente |
| HTTP sin permiso de Vercel | Preview 401 `Protected by Vercel Authentication`, antes de llegar a SGMO |
| HTTP público productivo | Raíz 200; health y db/status 404 NOT_FOUND en `sgmo-rose.vercel.app` |
| SQL de ensayo | 21 tablas; ocho migraciones; ocho perfiles; seis activos pero ninguno aprovisionado; cero sesiones utilizables |
| Registros de ensayo | Una venta QA, una jornada conciliada; cero otras ventas; cero jornadas abiertas; cero claims y eventos bancarios |
| SQL productivo | Cero tablas públicas en `neondb` de la rama `production` |
| Neon `long-running-queries` | Ninguna consulta de más de cinco minutos en ese momento; no es una prueba de carga |
| Chromium local | **No ejecutado completamente:** falta el binario Chromium de Playwright. No es un fallo demostrado de la app. |

La [CI del código inspeccionado](https://github.com/Deareys/SGMO/actions/runs/38680767894), del 15/10, tiene ambos trabajos aprobados: `browser` y `security-and-postgres`. Incluye Chromium con cuentas efímeras, PostgreSQL real desechable, autenticación desde dos procesos HTTP e integridad de ventas/inventario/banco. Hoy se reejecutaron los checks locales indicados arriba; no se presenta la CI histórica como una ejecución nueva contra Neon/proveedores. Las pruebas autenticadas reales de login/venta del 15/10 constan en [HITO_3_2_ENSAYO.md](HITO_3_2_ENSAYO.md); no se repitieron creando nuevas cuentas en este diagnóstico.

## Orden recomendado para continuar

1. **Corregir y probar la consistencia económica:** valores cero, excepción de vivienda, comisión presentada/PDF y política de diferencias de efectivo. Comparar mismos datos entre cálculo central, previsualización y comprobante.
2. **Aprovisionar el administrador propio en ensayo**, configurar cuentas/catálogo/stock del negocio de forma deliberada y hacer el recorrido de dos dispositivos con confirmación en Neon.
3. **Cerrar proveedores:** origen estable y acceso apropiado para webhook, cobro de prueba y conciliación; revisar la facturación de Gemini y demostrar extracción real sin confirmar dinero por OCR.
4. **Ensayar la playa:** corte de red, cámara/fotos, falta de espacio, cierre/reapertura, recuperación de pendientes y reintentos de una venta que recibió respuesta incierta.
5. **Preparar producción y recuperación:** versión revisada, variables Production, migraciones probadas, respaldo/restauración, cuentas propias, health/base/login/venta/pago/cierre en el dominio final. Mantener un regreso seguro a la versión anterior.
6. **Completar o delimitar los módulos locales** según lo contratado. No dar por entregada toda la gestión multiusuario mientras estos datos dependan del navegador.

Para repetir las comprobaciones sencillas: [PRUEBA_MANUAL_ENSAYO.md](PRUEBA_MANUAL_ENSAYO.md). Ver una pantalla o un check verde de build no demuestra por sí solo que un pago ingresó o que otro dispositivo recibió la venta.

## Prompt utilizado por el principal

No se delegó en agentes auxiliares durante este diagnóstico.

```text
Auditar SGMO como está hoy. Confirmar reglas/ADRs y revisiones reales de GitHub, Vercel y Neon; cotejar el código local con la rama remota antes de atribuir resultados. Ejecutar tipos, pruebas, build, regresiones y auditoría de dependencias sin actualizar paquetes. Revisar el flujo UI → API → base → respuesta por autenticación, ventas, stock/cierre, pagos/OCR y offline, distinguiendo producción, ensayo y módulos locales. Usar lecturas para el estado de las bases y un permiso temporal acotado para el preview; no crear cuentas, ventas, cobros ni migraciones. Registrar defectos reproducibles y límites de observación; no reescribir ni reparar reglas económicas durante la tarea de diagnóstico. Publicar informe y backlog priorizados, sin secretos, conservando cambios ajenos y sin integrar main.
```
