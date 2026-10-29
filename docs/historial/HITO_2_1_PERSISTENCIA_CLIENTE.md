# Hito 2.1 — Persistencia y confirmación del cliente

Fecha: 13 de octubre de 2026. Código de esta intervención, pendiente de la verificación global y publicación del principal.

## Prompt operativo aplicado

> Inspeccionar fuentes reales y contratos existentes. Mantener React, Express, las fórmulas económicas y las reglas de stock. El cliente debe cargar la operación autorizada desde PostgreSQL y conservar ventas locales hasta recibir un ACK explícito de sus identificadores. No generar autenticación offline ni incorporar semillas a producción. Las operaciones de jornada deben confirmar en el servidor antes de mostrar éxito. Conservar identificadores y payloads ante respuestas perdidas. Documentar evidencia y límites, probar concurrencia/reintentos/cuota y no conectar Neon ni realizar commits/push como auxiliar.

## Archivos y comportamiento

- `src/services/storageService.ts`: hidratación, caché, cola, borradores operativos, confirmación de jornadas y protección del reinicio. Los bloques de autenticación pertenecen al Hito 1.3 y configuración al agente correspondiente.
- `src/adapters/persistence/`: delegación de las escrituras a una sola implementación; elimina envíos duplicados y cambia operaciones confirmadas a contratos async.
- `src/App.tsx`: restaura sesión central, carga datos de la cuenta, actualiza cada 30 segundos y al recuperar conexión; informa errores y pendientes y ofrece reintentos.
- `src/types.ts`: `SaleTransaction.syncStatus` distingue pendiente/sincronizada; no se confunde con validación bancaria.
- `scripts/tests/persistence-sync.test.ts`: comprobaciones significativas del contrato del cliente, con HTTP y almacenamiento simulados.

Una instalación nueva comienza sin personas, jornadas, ventas, casas, carritos, zonas o catálogo ficticios. Los valores iniciales de configuración son provisionales; no habilitan ventas sin una carga central válida. Una caché antigua no recibe jornadas o zonas de demostración adicionales.

`GET /api/bootstrap` requiere sesión y retorna `{ success, configured, demoMode, state }`. `state` contiene arrays autorizados de usuarios, jornadas, ventas, catálogo, casas, carritos, zonas y configuración. El cliente no publica datos de una cuenta anterior mientras prepara otra identidad. Un fallo mantiene caché y pendientes, sin reemplazarlos por mocks. Los arrays de módulos todavía locales, omitidos por el servidor, se preservan; no se declaran centralizados.

## Ventas pendientes y ACK

Todas las ventas se guardan antes de alterar totales, aun si el navegador tiene conexión. Usan UUID y `syncStatus: pending`. La escritura individual `SGMO_PENDING_SALE_V1_<id>` es obligatoria y el índice `SGMO_OFFLINE_SALES_QUEUE` es reconstruible: si dos pestañas pisan el índice, las ventas de UUID diferentes siguen disponibles. La unión de ambos formatos conserva colas heredadas.

`POST /api/sales/sync-batch` recibe un snapshot de hasta 500 ventas. Solo `{ success: true, acknowledgedIds: [...] }` con IDs pertenecientes a ese snapshot permite retirar confirmadas. Se compara también la versión enviada; una venta editada o una nueva venta concurrente permanece pendiente. Un 200 incompleto, error de red, rechazo de precios/stock o fallo central no borra la cola. Cada instancia comparte un envío activo y el backend mantiene la idempotencia entre dispositivos/pestañas.

Si no se puede persistir la venta individual, el registro falla antes de modificar caja/stock. Si solo falla el índice o snapshot, la venta individual durable se conserva y se muestra el problema; no se devuelve un falso fallo que invite a registrar/cobrar nuevamente. La imagen se limita a 2.000.000 de caracteres conforme al contrato central; imágenes mayores deben reducirse antes del registro.

Las cantidades deben ser enteras positivas, los importes válidos y el stock suficiente según el balance existente. Los pagos digitales entran pendientes. El cliente no acepta `validationStatus: validada` ni flags bancarios enviados por otro componente como acreditación. `updateVoucherStatus` rechaza la aprobación local de pagos digitales y no adopta `mpVerification` del llamador. La evidencia bancaria se obtiene al refrescar el snapshot central después de verificar en la API oficial; OCR nunca acredita dinero.

## Jornadas, stock y liquidación

Despacho, merma, restock, sobrantes, cierre y registro de pago son async. Despacho/merma/restock calculan un borrador sobre una copia aislada sin publicar, guardar ni descontar la operación real. Después del ACK se adopta la jornada canónica y se recargan casas/carritos desde su fuente central. Cierre usa el cálculo autorizado del servidor y exige que las ventas de esa jornada estén confirmadas.

`SGMO_PENDING_OPERATIONS` conserva el DTO exacto del intento, con su ID y timestamp, ante una respuesta perdida. Reintentar los mismos parámetros reutiliza la entrada pendiente, incluso después de recargar; no genera otro despacho/restock/merma. Los rechazos definitivos 4xx, salvo conflicto 409, permiten retirar ese intento; las incertidumbres permanecen para revisión/reintento. No eliminar esta clave para solucionar errores: contiene operaciones que podrían haberse aplicado centralmente.

El reinicio de semillas solo permite una demo explícita con administrador, sin ventas ni operaciones pendientes. Está bloqueado en producción y no elimina registros pendientes o colas corruptas.

## Evidencia y límites

La suite específica aprobó **28 pruebas locales**: inicio sin semillas, caché pequeña, carga por identidad, base caída/respuesta incompleta, ACK parcial/inválido, reintentos, versiones concurrentes, single-flight, scope por vendedor, cuota, índice pisado por otra pestaña, respuesta de despacho perdida y rechazo de acreditación local. Son pruebas del cliente con HTTP/almacenamiento simulados; no sustituyen PostgreSQL real ni recorrido de navegador. El principal integra resultados SQL, navegador, tipado y compilación del proyecto completo.

Límites que siguen vigentes:

- `localStorage` tiene cuota limitada, especialmente con comprobantes base64; falta migración coherente a IndexedDB y archivos centrales, no implementada parcialmente aquí.
- La sesión existente permite registrar ventas sin conexión durante su uso. Recargar sin red no restaura una identidad nueva; la restauración requiere validación central. Falta el cierre completo de PWA/service worker y continuidad offline tras recarga.
- Operaciones sensibles de stock, cierre y pago requieren conexión/confirmación central; las ventas pendientes deben sincronizarse antes del cierre.
- La idempotencia evita duplicar un reintento, pero una operación pendiente conflictiva puede necesitar revisión del administrador. No hay descarte automático destructivo.
- Los módulos de fábrica, reportes de playa, gastos e incidencias que permanecen locales deben identificarse como tales en UI/documentación; su presencia en caché no demuestra sincronización entre dispositivos.

Comandos de verificación específica:

```bash
node --import tsx --test scripts/tests/persistence-sync.test.ts
npm run lint
npm run build
```

Restauración: utilizar el respaldo/commit de base registrado por el principal. Copiar únicamente los archivos del alcance, conservar las claves de ventas/operaciones pendientes y revisar el diff; no ejecutar `reset --hard`, borrar el almacenamiento del navegador ni restaurar credenciales heredadas.
