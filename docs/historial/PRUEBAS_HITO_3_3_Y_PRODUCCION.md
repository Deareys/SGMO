# Cómo probar el Hito 3.3 y preparar producción

Esta guía distingue tres lugares: **GitHub guarda y prueba el código**, **Vercel muestra y ejecuta la aplicación**, **Neon conserva los datos centrales**. Las conversaciones explican y coordinan; una afirmación en el chat no sustituye las pruebas ni un commit publicado.

## 1. Encontrar la versión correcta

1. Abrí [el PR 2](https://github.com/Deareys/SGMO/pull/2). Es la propuesta que lleva los cambios de `codex/sgmo-preparacion-mvp` a `main`.
2. En **Commits** podés ver qué se guardó. En **Files changed** podés leer cada cambio. En **Checks** abrí **SGMO validation** y revisá los dos trabajos: `security-and-postgres` y `browser`.
3. Un círculo verde significa que esa ejecución pasó. Abrí el detalle para confirmar que corresponde al último commit; un resultado verde de otra revisión no verifica la actual.
4. En Vercel, proyecto `sgmo` → **Deployments**, elegí el deployment cuya rama sea `codex/sgmo-preparacion-mvp` y cuyo commit coincida. **Visit** abre ese ensayo. Si Vercel pide acceso, ingresá con tu cuenta autorizada o usá el enlace privado de Share del deployment. La protección de Vercel y el login de SGMO son dos controles diferentes.
5. En el mismo origen, abrí `/api/health`. Debe mostrar `status: "ok"`, el commit esperado en `revision` y `authTransport: "httpOnly-cookie"`. En `/api/db/status`, `configured` y `connected` deben ser `true`. Esto comprueba infraestructura, no todas las funciones.

## 2. Probar el login sin selector

En la portada debe haber un único formulario con **Código de usuario o correo**, **PIN o contraseña** e **Ingresar**. No elegís un perfil. La cuenta verificada por el servidor determina qué pantallas puede usar.

- Trabajador: su código individual y PIN personal de ocho dígitos. El teclado numérico se despliega si lo necesita.
- Dueño: su correo o código y contraseña de al menos 14 caracteres, con mayúsculas, minúsculas y número o símbolo.
- Un dato incorrecto debe rechazar el acceso. Escribir o borrar un identificador no debe iniciar sesión automáticamente.
- Recargá con conexión: debe recuperar la sesión. Cerrá sesión y recargá: debe pedir el acceso otra vez.

No uses códigos de ejemplo como si fueran cuentas habilitadas: las semillas originales no tienen contraseñas por defecto.

## 3. Activar al dueño del negocio

Sebas configura la infraestructura; **no necesita una cuenta administrativa personal de SGMO**. El administrador operativo es el dueño.

1. Confirmar que se está usando el entorno correcto y una instalación sin administrador aprovisionado. La cuenta original `ADM-01` debe existir activa y sin credencial; la instalación de ensayo actual cumple esa condición al iniciar este hito.
2. Abrir **Configuración inicial del negocio** desde el login, o agregar `/setup` al origen verificado.
3. El dueño ingresa su nombre, correo, contraseña y confirmación. El responsable introduce el **código privado de activación**, correspondiente al `BOOTSTRAP_SECRET` de ese entorno.
4. El código no es una contraseña de usuario ni una clave de Mercado Pago. Si al guardarlo como Secret no conservaste una copia privada, no se puede recuperar desde SGMO: el responsable debe generar otro valor aleatorio de al menos 32 caracteres, actualizar esa variable del entorno correcto y redeployar antes del alta.
5. Presionar **Activar cuenta del dueño**. Tras la confirmación, entrar con su correo y contraseña. El servidor debe mostrar el nombre elegido.
6. Después de comprobar el acceso, retirar `BOOTSTRAP_SECRET` del entorno y redeployar. El endpoint ya rechaza reutilizar el alta si existe un administrador aprovisionado.
7. El dueño crea los usuarios de coordinación/vendedores desde **Configuración → Usuarios & Roles** y entrega a cada uno sus datos por un canal privado.

No escribir contraseñas, PIN, claves, cookies ni código privado en GitHub, capturas o el chat. En ensayo usar cuentas de prueba; el alta productiva es independiente y requiere la base productiva correctamente preparada. Si el alta perdió la respuesta por un corte, probar primero el login con las credenciales elegidas; no asumir que falló la transacción.

## 4. Revisar liquidaciones

Realizarlo en ensayo y sin ventas reales. La app impide cambiar precios/comisiones/vivienda mientras haya jornadas abiertas; un 409 indica ese conflicto y exige sincronizar y cerrar antes de cambiar política.

| Caso | Qué se espera | Dónde se comprueba |
| --- | --- | --- |
| Vivienda diaria configurada en 0 | Descuento 0; no sustituir por 8000 | Configuración → Parámetros & Vivienda, luego Cierres & Arqueo |
| Exención de vivienda | Descuento 0, aunque el costo global sea positivo | Configuración → Usuarios & Roles y cierre |
| Excepción individual existente, incluido 0 | Prima sobre el costo global; la exención prima sobre ambos | Casos SQL automáticos, con perfil preparado por fixture; no requiere editar JSON manualmente |
| Comisión 0, sin tramos activos que la sustituyan | Comisión bruta 0, también en el PDF | Perfil/reglas de comisión, cierre y descarga |
| Tarifa plana de faltante 0, sin política escalonada | Faltante físico registrado y penalización 0 | Caso SQL automático; revisar política aplicable |
| Efectivo declarado 0 con efectivo esperado positivo | Mostrar 0 declarado y la diferencia real | Arqueo, recibo digital y PDF |
| Cambiar reglas después de cerrar | El recibo conserva importes del cierre | Historial de Comprobantes & Liquidaciones |

Ejemplo matemático controlado: con venta de 1500, comisión del 20 %, vivienda 0 y sin otras deducciones, el pago es 300. Si se declara efectivo 0, el faltante de caja es 1500 y se informa por separado: la política vigente no lo descuenta automáticamente de los 300. El dueño debe acordar otra política antes de implementarla. El ejemplo no afirma que el catálogo del negocio tenga actualmente ese precio.

## 5. Ensayo con dos dispositivos y cortes

Las pruebas automáticas usan dos navegadores aislados que simulan dueño y vendedor. Para completar campo, repetir con dos teléfonos o un teléfono y una computadora:

1. Abrir el **mismo origen verificado** en ambos. Un dominio de Preview y el dominio productivo no comparten necesariamente base/cookies/configuración.
2. Ingresar como dueño en uno y vendedor de prueba en otro. Despachar su jornada con stock de ensayo; verificar que el vendedor la reciba al cargar.
3. En el vendedor, con la terminal ya abierta y cargada, activar modo avión. Registrar dos ventas de prueba. Deben verse como pendientes, sin anunciar respaldo central ni aprobación bancaria.
4. Desde el dueño con señal, confirmar que esas ventas aún no llegaron.
5. Volver a activar la señal. Esperar sincronización o usar **Reintentar sincronización**. Debe quedar cero pendientes y cada venta aparecer una sola vez desde el dueño. Recargar ambos y volver a comprobar.
6. Repetir dejando una venta pendiente, cerrando la pestaña y reabriendo **con señal**. Debe recuperar la sesión válida y la venta, sin duplicarla.
7. La respuesta perdida después del guardado se prueba automáticamente con Chromium: el backend confirma SQL y la red descarta su respuesta; el reintento conserva el UUID. No hace falta provocar este corte manualmente ni repetir una venta con un ID nuevo.

**Límite actual comprobado:** una pestaña nueva o recarga totalmente sin señal todavía no carga la aplicación. Debe prepararse PWA y una política segura de acceso offline antes de prometer ese funcionamiento. No borrar almacenamiento del sitio ni cambiar de navegador con pendientes: la cola pertenece a ese dispositivo/origen. Imágenes pesadas, cuota agotada y prueba física prolongada necesitan el siguiente hito.

## 6. Mercado Pago y OCR

Después de guardar las variables correctas y generar un deployment nuevo:

1. Confirmar proyecto/cuenta receptora, origen HTTPS y entorno del Access Token. La existencia de una variable no demuestra que la credencial sea válida.
2. Leer un comprobante ficticio claramente marcado como prueba: OCR debe devolver `extractionSucceeded: true` y los campos correctos. HTTP 200 con `extractionSucceeded: false` no es éxito.
3. Un resultado OCR nunca confirma acreditación. Probar un pago controlado del proveedor y su coincidencia de cuenta, importe, estado aprobado, entorno real o sandbox y unicidad. No cobrar clientes durante el ensayo.
4. Verificar que el webhook oficial llegue a `/api/mercadopago/webhook` sin quedar en una pantalla de acceso de Vercel, que valide la firma y se conserve en SQL. Repetir la notificación no debe duplicar la aplicación del pago. Un webhook inventado con un ID inexistente no acredita esta prueba.
5. Probar también la operación inexistente, importe incorrecto, cuenta incorrecta, reintento y número de operación ya usado. Deben quedar rechazados o pendientes, nunca aprobados por apariencia del comprobante.

**Qué significa 402:** `Payment Required`, es decir, el proveedor requiere resolver facturación. En la última prueba real de Gemini, el backend recibió ese código; Google documenta saldo prepago agotado como causa de `payment_required`. Revisar en AI Studio el **proyecto al que pertenece la clave usada por Vercel**, no sólo una cuenta con créditos. Cargar/habilitar facturación allí, comprobar la clave correcta `GEMINI_API_KEY` y redeployar. La variable con la errata `GIMINI_API_KEY` sólo es compatibilidad y pierde prioridad ante la correcta. Reintentar muchas veces sin resolver saldo no lo arregla. Fuente: [Google Gemini — API errors](https://ai.google.dev/gemini-api/docs/api-errors).

Otros códigos frecuentes: 401 pide autenticación; 403 rechaza permisos/origen/CSRF; 404 indica ruta inexistente o versión incorrecta; 409 conflicto de estado/datos; 429 límite de solicitudes; 503 servicio/base no disponible. Leer también el mensaje y el endpoint: el mismo número no identifica por sí solo la causa.

## 7. Por qué sigue apareciendo el main anterior

Una rama GitHub es una línea de código; un deployment es una ejecución de un commit; el dominio apunta a uno de esos deployments. El PR 2 sigue separado de `main`. Un push a `codex/sgmo-preparacion-mvp` actualiza su **Preview**, mientras el dominio productivo continúa sirviendo el commit de `main` seleccionado como Production. No es un cambio de caché que se arregle borrando datos del teléfono.

Para probar hoy, usar el Preview del PR. Para actualizar producción, la secuencia es:

1. Cerrar los ensayos y revisar PR/Checks. Preparar respaldo y política de reversión; no dar por aprobadas pruebas bancarias o de campo pendientes.
2. En Vercel **Production**, configurar su propia `DATABASE_URL` (rama Neon productiva, nunca la de ensayo), `SGMO_PUBLIC_ORIGIN` exacto del dominio, `SGMO_AUTH_MODE=central`, TLS, `BOOTSTRAP_SECRET` sólo para el alta, y credenciales/cuenta/firma de Mercado Pago y Gemini correspondientes. Mantener deshabilitados tokens API si no se necesitan. `APP_URL` no sustituye el origen usado por este backend.
3. Preparar/verificar migraciones 001–008 con conexión directa y respaldo, siguiendo `CREDENCIALES_Y_VERIFICACION.md`. Crear el esquema no ocurre por vincular Neon. Revisar que el inventario/catálogo y datos iniciales del negocio sean correctos; no copiar ventas QA.
4. Integrar la versión revisada del PR en `main`, preparar un deployment con configuración **Production** sin asignarle el dominio todavía y comprobarlo. Un redeploy del `main` viejo vuelve a publicar código viejo. La elección de integrar/promover se toma con el resultado concreto de las verificaciones.
5. Verificar revisión, API, DB, login del dueño, un despacho/venta/cierre de ensayo, cookies HTTPS y proveedores. Aprovisionar al dueño privadamente y retirar el secreto inicial. Promover al dominio sólo cuando pase la validación; repetir los controles en ese dominio final.

El 18/10 el dominio `sgmo-rose.vercel.app` sirve portada pero su backend anterior no pasa el control de release. La base Neon productiva se observó sin tablas y los secretos principales sólo están en Preview. Por eso **no está certificado para operar ventas reales**. Fuentes: [Vercel — GitHub y deployments](https://vercel.com/docs/git/vercel-for-github), código/configuración e inventario comprobados del proyecto.

## 8. Comandos para quien revise técnicamente

En una terminal dentro de la carpeta del repositorio, Node.js 22 o superior:

```bash
npm ci
npm run lint
npm test
npm run build
npm run test:auth:legacy
npm run verify:deployment -- --url https://TU-DEPLOYMENT.vercel.app --revision SHA_COMPLETO_DE_40_CARACTERES
```

El último control es sólo lectura y exige todas las comprobaciones; un fallo produce salida distinta de cero. Para Preview protegido puede recibir un acceso temporal por la variable privada de terminal `SGMO_DEPLOYMENT_SHARE_TOKEN`; no pasarlo por argumentos, no guardarlo en Git ni imprimirlo. Revocarlo al terminar. En entornos que obligan a usar proxy y Node 24, ejecutar el script con `node --use-env-proxy scripts/verify-deployment.mjs ...`.

Las suites PostgreSQL 16 y navegador se ejecutan reproduciblemente en GitHub Actions; Sebas no necesita instalar esos servicios para leer el resultado. Los prompts usados por el principal están completos en `HITO_3_3_LIQUIDACIONES_Y_ACCESO.md`. No hubo agentes auxiliares en esta intervención.
