# Hito 2.1 — Integridad operativa y financiera central

Fecha: 13 de octubre de 2026. Implementación en rama de preparación del MVP; no se ejecutaron migraciones remotas ni se desplegó.

## Alcance y criterio económico

Se conservaron React, Express, PostgreSQL y las fórmulas del dominio. La fórmula utilizada por la pantalla de conciliación activa (`storageService` y `ReconciliationClosingView`) es `max(0, comisión + bono − faltantes − vivienda)`. La diferencia de efectivo se informa por separado. `core.calculateSettlement` tiene una variante que descuenta faltante de efectivo; NO se adoptó esa variante silenciosamente ni se modificó la fórmula comercial. Las comisiones provienen de `calculateCommissionForSales`; los faltantes usan `calculateWasteDeduction`. Tasas, vivienda y tramos proceden del servidor. El cliente ya no controla el total liquidado ni el descuento por unidad. Las bonificaciones siguen siendo una entrada explícita de coordinación/admin.

Dependencias: migraciones 006 (snapshots y unicidad de evidencia real), 007 (inventario por casa, propiedad del hito de configuración) y 008 (claims bancarios, propiedad del hito de pagos). El inventario de casa empieza vacío; un administrador debe registrar el conteo real antes de despachar. No se fabricaron cantidades desde datos demo.

## Contratos

| Operación | Entrada autorizada | Respuesta |
| --- | --- | --- |
| POST `/api/shifts` | Borrador de despacho con IDs, cantidades entregadas, suministros y zona | `{success,shift}` canónico |
| POST `/api/sales` | Venta con ID estable, fecha, presentación, variedad, unidades, importe y método | `{success,sale,acknowledgedIds}` |
| POST `/api/sales/sync-batch` | `{sales:[...]}` hasta 500 ventas | `{success,inserted,updated:0,acknowledgedIds}` |
| POST `/api/shifts/:id/waste` | Registro con ID/fecha estables y `shiftId` igual a ruta | `{success,record,shift}` |
| POST `/api/shifts/:id/restock` | `{records:[...]}` de una jornada | `{success,records,record,shift}` |
| POST `/api/shifts/:id/leftovers` | `{returnedItems:[{varietyId,count,wasteCount?}],notes?}` | Jornada `esperando_cierre` |
| PUT `/api/shifts/:id/close` | `cashDeclared`, conteos físicos, `gasPercentEnd?`, `bonusIncentive?`, `notes?` | Liquidación canónica con snapshot |
| PUT `/api/shifts/:id/payout` | `{paymentProof?:string}`; importe tomado del cierre | Jornada liquidada y pago registrado |

Admin supervisa todo. Coordinación muta/consulta jornadas donde es coordinador asignado o vendedor propio. El vendedor vende y declara sobrantes sólo en su jornada. El rol de fábrica no accede a estos recursos. El cuerpo de merma/reposición no puede cambiar la jornada indicada en la URL. Las rutas devuelven 400/403/404/409 previsibles y un 503 genérico ante fallo de infraestructura; no devuelven errores SQL.

## Atomicidad, reintentos e historial

- Ventas y lotes bloquean jornadas en orden estable. Un advisory lock por ID protege incluso filas todavía inexistentes. Mismo ID/payload devuelve el original; cualquier alteración económica, identidad, fecha o evidencia aportada da 409. No se utiliza UPSERT para modificar ventas ya registradas.
- Un lote con un conflicto tardío revierte todas sus ventas y contadores. El ACK enumera únicamente IDs confirmados. Repetir ventas confirmadas después del cierre devuelve ACK, pero nuevas ventas en una jornada cerrada se rechazan.
- La identidad del vendedor/variedad procede de la jornada/catálogo. Efectivo se registra como validado operativamente; pagos digitales empiezan pendientes. `mpApiVerification` y validaciones bancarias afirmadas por cliente se ignoran. Una métrica bancaria del cierre requiere claim bancario oficial y evidencia coherente, no sólo flags JSON históricos.
- Ventas/mermas/reposiciones/cierre comparten el lock de jornada, evitando cierres sobre escrituras concurrentes. Dispatch y cierre adquieren primero el lock financiero común con configuración, impidiendo cambiar políticas entre validación y despacho/cierre.
- Despacho debita casa; reposición debita casa y suma turno; cierre retorna unidades contadas a casa exactamente una vez. Reintentos idénticos de merma/reposición conservan ID/fecha y no duplican contadores.
- Dispatch, declaración de sobrantes, cierre y pago tienen reintentos idempotentes. Cambiar un cierre ya persistido da 409. El pago utiliza el importe histórico y no puede sustituir el comprobante existente. `settlement_snapshot` congela configuración, tramos, autor, fórmula, comisión y deducciones.
- El cliente debe conservar el DTO exacto de una operación incierta hasta ACK. Rehacer una operación con nuevo ID tras perder la respuesta permitiría un segundo despacho/reposición lógico; el cliente implementa su ledger de pendientes.

## Verificación reproducible

`node --import tsx --test scripts/tests/sales-validation.test.ts`: 3 pruebas unitarias aprobadas.

`SGMO_PGLITE_ROOT=/ruta/externa/@electric-sql/pglite node --import tsx scripts/tests/sales-integrity.integration.ts --wasm`: SQL real sobre PostgreSQL compilado a WASM, 17 escenarios aprobados. Incluye derivación y saldo de despacho, reintentos y conflictos, rechazo de fraude bancario del cliente, precios/unidades/métodos, rollback de lote, ACK, pertenencia, reposiciones y mermas, retorno/cierre/pago y claims bancarios únicos con devolución y respuesta obsoleta, más saneamiento de evidencia histórica sin claim.

`SGMO_SALES_TEST_DATABASE_URL=postgresql://...@127.0.0.1:5432/sgmo_sales_test node --import tsx scripts/tests/sales-integrity.integration.ts --postgres`: preparado para CI/local aislado. También acepta `SGMO_AUTH_TEST_DATABASE_URL` de base exclusiva de pruebas. Rechaza destinos remotos, parámetros URL y bases sin prefijo de pruebas. Crea un esquema aleatorio propio y elimina únicamente ese esquema. No lee `.env`. En ese modo añade dos conexiones concurrentes para el mismo ID. Este modo NO se ejecutó en el entorno actual: no afirmar concurrencia PostgreSQL de red verificada hasta obtener el resultado CI.

WASM ejecuta sintaxis, constraints, JSONB y transacciones auténticas; serializa el transporte de su motor único y no demuestra concurrencia distribuida. Tipos/build y batería completa los verifica el agente principal al integrar el resto de cambios.

## Pendientes y límites

El catálogo central es la autoridad de precios en producción. La terminal usa la variedad seleccionada y el servidor exige sus importes exactos en centavos; las referencias fijas anteriores sólo continúan en tests/demo sin base. No se eligieron nuevos importes comerciales: el administrador debe revisar los valores de la semilla y guardar los precios reales antes de abrir jornadas. Se prueba que un precio fijo antiguo ya no sea admitido cuando difiere del catálogo. La configuración se bloquea mientras existen jornadas abiertas para proteger ventas offline pendientes; esto no constituye un versionado general de precios por temporada.

La evidencia de verificación heredada que antiguamente provenía del cliente requiere auditoría. No se borraron imágenes ni JSON histórico. El nuevo flujo de escrituras y las métricas del cierre usan autoridad bancaria del servidor. El sistema registra bonificaciones y liquidación pero no ejecuta transferencias bancarias al vendedor.
