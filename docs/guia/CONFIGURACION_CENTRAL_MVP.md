# Configuración central y conteo real de casas — MVP

La aplicación conserva React/Express y las reglas económicas existentes. La pantalla de administrador escribe catálogo, casas, carritos, tramos, parámetros y zonas en PostgreSQL mediante API. La caché sólo cambia después de confirmación; una caída no anuncia éxito ni cierra el formulario.

## Archivos y contrato

- `ConfigurationRepository.ts`: lectura oficial, validaciones y transacciones auditadas.
- `configRoutes.ts`: todas las rutas requieren sesión y rol administrador. El middleware global del servidor aplica CSRF.
- `007_catalog_and_house_stock.sql`: inventario físico y ajustes auditables. **No inventa cantidades ni copia semillas**.
- `AdminConfigView.tsx`, `CommissionTiersTab.tsx` y métodos administrativos de `storageService.ts`: esperan confirmación y conservan formulario ante error.

| Ruta | Entrada | Resultado |
| --- | --- | --- |
| PUT `/api/settings` | SystemConfig completo, con tramos | Catálogo actualizado confirmado |
| PUT `/api/zones` | Array de zonas | Zonas oficiales |
| POST `/api/houses`, `/api/carts`, `/api/varieties` | `{id,attributes}` | Alta administrativa |
| PATCH recurso `/:id` | Campos editables | Edición administrativa |
| PUT `/api/houses/:id/stock` | `{varietyId,quantity,reason}` | Conteo absoluto confirmado y auditado |

Las bajas son desactivaciones. El historial de ventas y jornadas permanece. El inventario no se puede modificar desde el formulario genérico de casa: el conteo tiene ruta propia, motivo obligatorio y registro del saldo anterior/nuevo y autor. Ajustes bloquean la casa antes de stock, coordinados con despacho/reposición/devolución. Nunca permiten saldo negativo ni exceder freezer.

Las personas residentes usan `users.assigned_house_id`, fuente ya existente; coordinadores se calculan desde rol y asignación. Reasignar revoca las sesiones afectadas y exige volver a ingresar. Se rechaza reasignar personas con jornadas abiertas. Editar nombre/costo conservando asignaciones no revoca sesiones. Se rechaza editar carritos con jornadas abiertas y desactivar casas con jornadas abiertas.

## Prueba para Sebas en la aplicación

Requiere servidor con PostgreSQL de **prueba**, migraciones aplicadas y sesión administrador. GitHub permite revisar código; no es la pantalla de operación. El navegador de la aplicación local o el despliegue de prueba ejecuta estas acciones.

1. Entrar como administrador y abrir Configuración > Bases operativas.
2. Crear/editar una casa con dirección, capacidad y costo reales. Guardar y recargar: los valores deben conservarse. Abrir desde otro dispositivo: deben coincidir.
3. Crear variedades y precios. Repetir desde el otro dispositivo para comprobar persistencia.
4. Crear al menos una zona desde Bases operativas (localidad / calles). Confirmar que aparece en el despacho.
5. En Conteo físico elegir casa/variedad, ingresar 30 unidades y motivo “Conteo de prueba”. Guardar. El saldo debe ser 30, incluso si ya tenía 10: se guarda el total contado, no se suma 30.
6. Intentar una cantidad superior a la capacidad. Debe aparecer error y mantenerse el saldo anterior.
7. Despachar 12 unidades desde esa casa. La casa debe pasar a 18; repetir recarga y segundo dispositivo. Reposición de 3 debe dejar 15. Las devoluciones confirmadas deben sumar al saldo.
8. Cambiar un tramo de comisión, guardar y recargar: debe conservarse. Las liquidaciones históricas no deben recalcularse por este cambio.
9. Cortar conexión y editar una variedad. Guardar: debe fallar conservando formulario y valores anteriores. No debe mostrarse éxito.
10. Entrar como vendedor e intentar acceder a cambios administrativos: el servidor debe rechazar (403), aun si se fabricara una petición HTTP.

## Verificación automatizada

`node --import tsx --test scripts/tests/configuration.test.ts`: siete grupos de pruebas sobre validación, límites de dinero/porcentajes, zonas únicas, autorización de trabajadores, atomicidad y rollback auditado. El cliente PostgreSQL de esa suite está simulado; **no es prueba de SQL ni concurrencia real**. El hito de integración debe comprobar migración 007 y operaciones contra PostgreSQL local.

`SGMO_PGLITE_ROOT=/ruta/a/@electric-sql/pglite node --import tsx scripts/tests/config-sql.integration.ts`: seis grupos SQL reales en motor WASM efímero; comprueban mapeo del catálogo, altas, configuración, conservación histórica, inventario absoluto auditado, capacidad y residencia. Tampoco certifican concurrencia entre procesos.

`npm run lint` comprueba los tipos configurados. `npm run build` comprueba el artefacto de frontend y servidor. No se ejecutaron migraciones sobre Neon como parte de estos cambios.

## Límites de esta intervención

Producción/fábrica, compras, proveedores, traslados centrales y gastos no pasan a PostgreSQL por este módulo; no se deben interpretar sus antiguos guardados locales como escritura central confirmada. El MVP debe mostrar su alcance de forma explícita. Las zonas nuevas registradas desde UI llevan afluencia media y sugerencias cero (campos informativos; no crean stock). El despliegue necesita montar el router y entregar catálogo oficial en bootstrap.

## Hito 2.2 — Contrato OCR y contingencia

Además de configuración, se corrigió el adaptador de OCR: enviaba `expectedAmount` pero el servidor esperaba `saleAmount`; leía campos planos aunque la respuesta venía en `extractedData` y `matchResults`. Ahora usa el contrato real y requiere `extractionSucceeded: true` para aceptar una lectura. Comprueba número e importe/confianza finitos; la advertencia de OCR no acreditado acompaña cada lectura.

Errores de red, HTTP 503, JSON inválido, contrato viejo o lectura fallida dejan ID/fecha/titular/cuenta vacíos, monto cero, confianza cero y coincidencia de monto falsa. El cero expresa falta de lectura; **no altera el monto registrado de la venta**. No hay ID aleatorio ni fecha actual que finjan haber leído el comprobante. El servicio heredado mantiene `pendiente_revision` y `mpApiMatched: false`.

`node --import tsx --test scripts/tests/ocr-adapter.test.ts`: cinco grupos aprobados (contrato, contingencias, duplicidad con ID real, importe inconsistente y fallback heredado). No llama Gemini real ni acredita Mercado Pago. Para prueba manual, vender por transferencia, subir comprobante y simular API OCR no disponible: la venta debe conservar importe real y quedar pendiente de revisión, sin operación inventada. Con OCR disponible la lectura sólo ayuda; la consulta bancaria oficial es independiente.


## Precios y liquidación durante jornadas abiertas

El MVP congela los precios y entradas económicas mientras exista una jornada planificada, en curso o esperando cierre. Cambiar precios, combos, disponibilidad de una variedad, comisiones/tramos, tarifas de merma/vivienda o costos de casa devuelve 409. Los cambios de comisión, exención, costo personalizado o casa de un usuario también se rechazan durante jornadas abiertas; repetir exactamente el valor actual está permitido. Nombre, descripción, título y datos públicos de cuenta receptora pueden corregirse sin alterar la economía.

Configuración, usuario económico y apertura de jornada toman primero el mismo bloqueo transaccional `sgmo_financial_configuration`. Esto evita abrir una jornada entre la comprobación y la escritura del precio. El cierre mantiene las fórmulas existentes; no se creó otra política económica ni se revalorizan ventas almacenadas.

Para probar: abrir jornada, intentar cambiar un precio o comisión y comprobar mensaje de cierre/sincronización necesaria. Editar sólo nombre debe funcionar. Sincronizar las ventas pendientes y cerrar la jornada; entonces los valores económicos deben poder cambiarse. La suite SQL incluye este escenario y comprueba que la actualización de exención/costo de vivienda ya no se descarta silenciosamente.
