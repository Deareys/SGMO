# Contraseñas y pasos para poner SGMO en producción

**Actualización 29/10:** el alta administrativa ahora solicita contraseña inicial y confirmación. En edición, una contraseña nueva la reemplaza; ambos campos vacíos conservan la anterior. El login sólo muestra correo/código y contraseña. Para probar esa versión usar la [guía del Hito 3.5](PRUEBA_LOGIN_2026_10_29.md). El flujo por enlace de esta guía anterior se conserva como recuperación/elección privada adicional.

Actualizado: 20/10/2026. Esta guía corresponde a `codex/sgmo-preparacion-mvp`, PR 2. **La app productiva todavía no está certificada.** GitHub guarda el código; Vercel ejecuta la app; Neon guarda los datos. Que una prueba pase en uno no demuestra el funcionamiento de los otros.

## Cómo funciona el acceso

- Cada persona ingresa con su código o correo y su contraseña. No elige un perfil; el servidor reconoce su cuenta y permisos.
- Las contraseñas nuevas tienen entre 12 y 128 caracteres. Se permiten frases sin exigir símbolos o mayúsculas. Evitar claves comunes y reutilizadas. Una frase de varias palabras elegidas al azar es preferible a un nombre o fecha.
- Los PIN anteriores de ocho dígitos siguen funcionando mientras se hace la transición. Al elegir contraseña se retira el PIN de esa cuenta.
- Quien conoce su contraseña abre **Mi contraseña** en la barra superior o menú móvil. Debe escribir la clave actual y confirmar la nueva. Después vuelve a ingresar; sus otras sesiones quedan cerradas y sus ventas pendientes permanecen en el dispositivo.
- Si alguien la olvida, el administrador verifica su identidad presencialmente y genera una activación de un solo uso. No puede consultar la contraseña anterior. La nueva la escribe el titular.
- El administrador operativo es **el dueño del negocio**. Sebas no necesita una cuenta admin para desarrollar o revisar GitHub.

## Ensayo manual en la app de Vercel

Usar el **preview indicado en el informe del Hito 3.4**, con acceso autorizado y datos de prueba. No usar el dominio productivo antiguo para juzgar esta rama. Al pedir acceso a Vercel se usa la cuenta autorizada; no se desactiva globalmente la protección.

1. El dueño abre `/setup` por única vez, escribe nombre/correo, elige su contraseña y utiliza el código privado de instalación. El responsable de infraestructura entrega ese código por un canal privado; nunca se pega aquí ni en GitHub. Después de activarse ya no se puede reutilizar bootstrap.
2. El dueño ingresa. En **Configuración → Usuarios & Roles → Nuevo Usuario** crea un vendedor de prueba con código/correo únicos, base y teléfono. Este formulario no solicita la contraseña del vendedor.
3. En la tarjeta del vendedor pulsa **Contraseña**, confirma que verificó su identidad y escribe **su propia contraseña de administrador**. Genera el enlace y lo entrega privadamente al vendedor. Vence en 15 minutos; otro enlace anula al anterior.
4. En otro teléfono o navegador, el vendedor abre el enlace, elige una contraseña de al menos 12 caracteres y la repite. Debe aparecer confirmación. Luego ingresa por el formulario normal con código o correo. El enlace no inicia sesión automáticamente.
5. El vendedor intenta abrir una sección administrativa: debe quedar denegada. Desde su menú cambia su contraseña; la anterior debe dejar de funcionar. Si había iniciado sesión en otro navegador, al consultar el servidor ese segundo acceso debe rechazarse.
6. Para probar olvido, el dueño repite el paso 3. El vendedor elige otra contraseña. Reabrir o reutilizar el enlace consumido debe dar error y nunca cambiar otra vez la clave.
7. Con turno y stock de prueba, abrir la terminal con conexión, cortar señal y registrar una venta. Mantener la app abierta, recuperar conexión, cambiar contraseña si se ensaya ese caso y reingresar. El pendiente debe conservarse hasta confirmación central y aparecer **una sola vez** para el dueño.
8. Registrar fecha, revisión probada, teléfono/navegador, resultado y cualquier mensaje de error. Nunca capturar contraseñas, enlaces privados ni códigos.

Los ensayos automáticos ya comprueban estos flujos con cuentas sintéticas. Queda pendiente repetirlos con el dueño y teléfonos físicos. Hoy, abrir la app desde cero completamente sin señal no está soportado; una terminal ya abierta sí conserva sus ventas. No prometer reapertura offline hasta completar el trabajo PWA.

## Pasos que faltan para producción, en orden

| Paso / hito | Qué se debe completar | Quién / dónde | Cómo sabemos que pasó |
| --- | --- | --- | --- |
| 1. Revisión técnica | Publicar la rama, revisar PR 2 y tener Actions verde en el SHA exacto | Codex / GitHub → PR 2 → Checks | Pasan tipos, build, 193 pruebas, 35 históricas, SQL PostgreSQL y tres suites de navegador |
| 2. Aceptación del acceso | El dueño activa su cuenta de ensayo y prueba alta, cambio y recuperación con un trabajador | Dueño / preview Vercel, dos dispositivos | Ambos ingresan con sus cuentas; el vendedor no administra; claves/sesiones anteriores quedan invalidadas |
| 3. Configuración del negocio | Revisar casas, productos, precios, combos, comisiones, vivienda, cuenta receptora y stock inicial; confirmar cómo se trata el faltante de caja | Dueño / Configuración y cierres en preview | Una jornada de prueba coincide con el cálculo manual y conserva recibo/snapshot |
| 4. Mercado Pago | Configurar cuenta del negocio, token, collector ID y secreto de webhook en entorno correcto; probar pago, importe/destinatario erróneo, repetido y webhook firmado | Dueño + Codex / Vercel, Mercado Pago y app | Una consulta oficial `approved` respalda cada pago; OCR/imagen sola no acredita dinero; duplicados rechazados |
| 5. OCR | Corregir facturación y clave del proyecto Gemini que realmente usa el backend; repetir extracción real | Sebas/dueño + Codex / Google AI Studio, Vercel y Validación IA | Extrae operación/importe de comprobante de prueba; errores visibles y sin exponer API key. El último 402 real fue el 15/10, no se considera resuelto por cambiar una variable |
| 6. Prueba de playa | Repetir con teléfonos reales, señal intermitente, respuesta perdida y reinicio; terminar PWA/imágenes durables si se exige abrir totalmente sin conexión | Dueño + Codex / dispositivos y app | Sin pérdidas ni duplicados, pendientes visibles. Definir la operación offline permitida antes de vender |
| 7. Alcance compartido | Centralizar los módulos locales necesarios o excluirlos expresamente de la primera salida | Dueño + Codex / fábrica, gastos, radar, mantenimiento y traslados | Nadie toma un registro local de esos módulos como dato compartido o respaldado |
| 8. Preparar entorno real | Respaldar y ensayar restauración; confirmar base Neon productiva y aplicar 001–009 revisadas. Configurar variables Production, dominio/origen y monitoreo | Codex + responsable de infraestructura / Neon y Vercel | Esquema completo, conexión TLS, secretos sólo en servidor, base de ensayo separada y plan de recuperación probado |
| 9. Release verificado | Con la aceptación previa, integrar la revisión y crear un despliegue con configuración Production; comprobarlo antes de habilitar operación | Codex / GitHub y Vercel | `/api/health` muestra el SHA esperado; `/api/db/status` conecta; login, venta compartida y cierre funcionan bajo HTTPS |
| 10. Apertura controlada | El dueño activa su cuenta productiva, carga configuración/stock reales y realiza una jornada piloto | Dueño / app productiva | Se concilian ventas, pagos, stock y caja; alertas/backup funcionando; luego se amplía el uso |

No cargar las credenciales QA ni clonar sus ventas como operación real. El entorno real requiere datos y cuentas del negocio. No promover un preview suponiendo que conserva sus variables: la configuración Production debe verificarse por separado.

## Variables de servidor para revisar en Vercel

En **Project → Settings → Environment Variables** elegir el entorno correcto. Guardar una variable no cambia un deployment existente: hace falta un despliegue nuevo.

| Nombre | Uso |
| --- | --- |
| `DATABASE_URL` | Conexión a la rama Neon correspondiente; Production debe usar la base real, nunca la de ensayo |
| `SGMO_AUTH_MODE=central` | Autenticación central. No habilitar demo en producción |
| `SGMO_PUBLIC_ORIGIN` | Origen HTTPS exacto, sin `/` final ni rutas, usado por CSRF; debe coincidir con el dominio que abre el usuario |
| `BOOTSTRAP_SECRET` | Código aleatorio privado de al menos 32 caracteres para la primera activación del dueño; retirar cuando se confirme la puesta en marcha |
| `MERCADOPAGO_ACCESS_TOKEN` | Credencial del servidor para consultar la cuenta receptora |
| `MERCADOPAGO_COLLECTOR_ID` | Identificador de esa cuenta para verificar el destinatario |
| `MERCADOPAGO_WEBHOOK_SECRET` | Secreto para validar firmas de notificaciones |
| `GEMINI_API_KEY` | Clave canónica del proyecto con facturación habilitada; si existe el alias antiguo `GIMINI_API_KEY`, la canónica tiene prioridad |

`APP_URL` no reemplaza `SGMO_PUBLIC_ORIGIN` para validar el origen de los formularios. `SGMO_ENABLE_API_TOKENS` debe permanecer ausente o deshabilitado si sólo se usan navegadores. Ninguno de los secretos se comparte por chat ni se añade a GitHub.

## Dónde mirar las pruebas

**GitHub → Actions → SGMO validation → ejecución del commit:** todos los jobs deben estar verdes. Abrir cada job para ver resultados; un verde antiguo no valida código nuevo. En el artefacto `browser-auth-report` hay resúmenes y capturas de cuentas efímeras. Para el código y prompts reales, consultar [HITO_3_4_CONTRASENAS_Y_PRODUCCION.md](HITO_3_4_CONTRASENAS_Y_PRODUCCION.md).

**Vercel:** abrir el deployment correspondiente a ese SHA. `/api/health` confirma qué código se está ejecutando y `/api/db/status` sólo confirma conexión; no demuestra por sí solo ventas, pagos ni todas las tablas. El script `npm run verify:deployment -- --url https://DOMINIO --revision SHA_COMPLETO` realiza comprobaciones de sólo lectura; para un preview protegido el acceso temporal se maneja privadamente.

**Neon:** comprobar la rama antes de consultar. `schema_migrations` debe contener 001–009. La venta de prueba debe estar una sola vez en `sales`, con stock y turno consistentes. No editar ni borrar filas para hacer que un ensayo parezca aprobado.
