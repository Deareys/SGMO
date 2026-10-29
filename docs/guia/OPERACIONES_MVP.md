# Operaciones del MVP y cómo probarlas

Estos pasos describen pruebas que Sebas puede hacer. No constituyen evidencia de que se hayan ejecutado en Vercel o Neon. Usar cuentas y una base de pruebas, sin ventas reales.

## Dónde probar

- **GitHub:** conserva código, historial y resultados de automatizaciones. Abrir un archivo en GitHub no ejecuta la aplicación ni demuestra funcionamiento.
- **Terminal de VS Code o Codespaces:** desde la raíz del repositorio, `npm ci`, `npm run lint`, `npm test` y `npm run build` comprueban dependencias, tipos, casos automáticos y compilación. Un comando que termina con error requiere investigar su mensaje; no continuar diciendo que aprobó.
- **Navegador local:** `npm run dev` inicia la aplicación. Leer la dirección impresa por la terminal y abrirla. Debe existir un backend y PostgreSQL de pruebas configurados para confirmar operaciones centrales.
- **Vista de Vercel:** sirve para validar el despliegue conectado al backend correcto. El frontend puede abrir perfectamente mientras la API falla; probar una escritura y verla desde otra sesión confirma más que mirar la pantalla.
- **Sin señal:** las ventas de una sesión ya iniciada se guardan en el dispositivo y quedan pendientes. Despachos, reposiciones, mermas y cierres requieren confirmación del servidor. Un acceso nuevo offline no está habilitado.

## Recorrido guiado

1. **Despachar como coordinador o administrador.** En Despacho, seleccionar vendedor, carrito, casa y zona; anotar las cantidades. Confirmar una vez. El botón muestra “Confirmando despacho…”. El éxito y la navegación aparecen después de la confirmación central. Abrir la terminal del vendedor desde otra sesión y verificar la misma jornada y carga. No usar datos semilla como prueba de sincronización.
2. **Simular fallo durante un despacho.** En herramientas del navegador → Red/Network, elegir Offline antes de confirmar, o detener la API de pruebas. Debe verse un error y conservarse el formulario. La aplicación no debe anunciar entrega ni asignar una jornada nueva local. Restaurar la conexión y repetir una vez. Una operación pudo llegar al servidor aunque se perdiera su respuesta: recargar/consultar la jornada antes de repetir la entrega física.
3. **Registrar una venta en efectivo.** Elegir un combo, variedad y ubicación. El precio proviene del catálogo central de esa variedad; un precio ausente/ inválido bloquea el registro. Probar una actualización autorizada del catálogo cuando no haya jornadas abiertas y verificar que la nueva jornada muestre el nuevo precio. El botón “REGISTRAR” guarda la venta. Ver el mensaje de venta guardada en el dispositivo y pendiente de sincronizar mientras no existe confirmación. Comparar unidades y efectivo con una cuenta manual. Comprobar después desde otra sesión. Guardar una venta no mueve dinero.
4. **Venta electrónica.** Elegir Mercado Pago/transferencia y cargar el comprobante o número de operación. Primero pulsar REGISTRAR: se crea una venta con ID único, pendiente de sincronizar/pago. El formulario conserva el comprobante y bloquea un segundo registro. Después pulsar Verificar MP: el sistema exige confirmación de esa venta central antes de consultar al banco. “Datos de pago” permite generar un enlace oficial para esa misma venta; no hay un QR de cobro configurado. Una falta de conexión conserva pendiente y no genera enlaces ficticios. La foto/OCR no acredita pagos. “Preparar otra venta” libera el formulario; la anterior sigue en el historial con su estado real. Consultar Mis Comprobantes para volver a revisarla. Nunca interpretar el guardado como confirmación bancaria.
5. **Venta offline y recuperación.** Iniciar sesión y cargar su jornada con red. Activar Offline en Network, registrar dos ventas y anotar sus IDs/importes. Recargar solo si se probó y documentó la recuperación de sesión offline en ese entorno. Restablecer red y pulsar “Reintentar sincronización”. Si falla, las ventas deben seguir pendientes. Después de confirmación deben desaparecer del pendiente y existir una sola vez en la vista del coordinador. No borrar datos del navegador, cerrar sesión con pendientes ni cambiar de dispositivo.
6. **Reposición.** Desde Despacho → Restock, cargar las unidades y confirmar. Esperar confirmación antes de entregar físicamente. Repetir el caso con red caída: las cantidades no se limpian y no aparece éxito. Restaurar conexión, consultar el historial antes de reintentar si hubo respuesta perdida.
7. **Merma.** Desde la terminal, abrir Registrar Merma, elegir variedad, cantidad y motivo. Esperar el registro central. Con API caída no debe cerrarse el formulario ni mostrarse éxito. Verificar desde otra sesión el registro, stock y motivo.
8. **Conteo de sobrantes.** “Guardar Sobrantes sin Cerrar” envía el conteo al servidor y espera confirmación. No cierra la jornada ni registra una liquidación. Si falla, conserva el formulario. El vendedor puede guardar su conteo; el cierre definitivo lo confirma coordinación o administración.
9. **Cerrar jornada.** Anotar antes ventas, stock, efectivo y conteos. Cargar devueltos, mermas, efectivo declarado y notas. La pantalla muestra “Confirmando cierre…” mientras espera al servidor. Solo tras confirmación aparece el resumen/PDF. Si falla, conservar datos y repetir luego de comprobar la jornada central. Las ventas pendientes deben sincronizarse antes del cierre; un error de sincronización debe impedirlo.
10. **Comisión entregada.** Cerrar primero. “Registrar Comisión Entregada” pide confirmar que el dinero ya fue entregado. Es un registro manual autorizado, no una transferencia bancaria. El estado pagado y el comprobante requieren confirmación central; una API caída no debe marcar pagado. Verificar historial desde otra sesión y que el importe coincida con la liquidación guardada.
11. **Reportes de playa e incidencias.** Estos avisos conservan información en el dispositivo cuando no cuentan con API compartida. Usar el canal habitual para avisar al coordinador. La pantalla no debe prometer que otra persona recibió una alerta que no fue sincronizada.

## Cómo interpretar los archivos

| Archivo/carpeta | Responsabilidad | Qué mirar al estudiar |
|---|---|---|
| `src/components/PlanningDispatchView.tsx` | Formularios de despacho y reposición | `await` significa esperar la confirmación; `catch` muestra fallos sin limpiar el formulario. |
| `src/components/SellerTerminalView.tsx` | Registro de ventas, merma y cierre en el celular | Diferencia entre venta pendiente local, pago pendiente bancario y venta confirmada central. |
| `src/components/ReconciliationClosingView.tsx` | Conciliación y registro manual de comisión entregada | El comprobante requiere un cierre guardado y el estado de pago requiere confirmación. |
| `src/services/storageService.ts` | Caché del navegador y coordinación con API | Cola de ventas, lectura central y actualización local después de respuesta. |
| `src/server/routes/` | Rutas que recibe el servidor | Validaciones de permisos y parámetros; el servidor debe rechazar solicitudes incorrectas. |
| `src/server/db/repositories/` | Escrituras/lecturas PostgreSQL | Transacción agrupa cambios: todo se guarda o todo se revierte. |
| `scripts/tests/operation-ui.test.ts` | Casos automáticos del recorrido de cierre | Rechazo de cierre no genera PDF; el PDF espera confirmación y usa datos guardados. |

El botón deshabilitado evita clics repetidos mientras una operación está en curso, pero no reemplaza idempotencia y controles del servidor. La validación financiera central sigue siendo obligatoria.

## Límite actual de módulos locales

Producción/fábrica, compras de materias primas, traslados desde cámara, gastos, incidencias y reportes de playa conservan registros en este navegador. No cuentan todavía con sincronización compartida completa. El refresco central no debe reemplazar sus historiales por arreglos vacíos del servidor. Casas, carritos y stock confirmado de despacho provienen del servidor: un traslado registrado solo localmente no acredita automáticamente stock central para salir a vender.

Rentabilidad combina ventas centrales y costos/gastos locales o estimados; no presentarla como contabilidad final. Para compartir esas operaciones se necesita un hito específico de persistencia; no se reescribieron sus reglas de negocio en esta entrega.

## Cambios del flujo bancario en esta entrega

- `MercadoPagoAdapter` ya no devuelve enlaces `pref_mock` ni fabrica importes acreditados ante un fallo.
- El servidor recibe el ID de venta, determina importe y dueño, y persiste evidencia bancaria. El cliente no autoriza importes manipulados.
- Solo un pago aprobado real, importe coincidente y sin simulación puede mostrarse acreditado.
- El laboratorio se limita a demo aislada. Imágenes simuladas llevan marca visible y no acreditan fondos; los enlaces se generan desde una venta central en Terminal.
- El antiguo SVG decorativo no era un QR escaneable de cobro y se retiró para evitar una indicación engañosa.
- Las pruebas de contrato/SSR verifican esos límites, pero no reemplazan un recorrido interactivo del navegador ni una prueba bancaria real.
