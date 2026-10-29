# Guía vigente de SGMO — entrega del 29/10/2026

Aplicación habitual: [sgmo-rose.vercel.app](https://sgmo-rose.vercel.app). GitHub guarda las versiones; Vercel ejecuta la app; Neon conserva la operación central. Usar este enlace estable después de verificar la publicación registrada en continuidad. Los enlaces de preview son otras versiones dentro del mismo proyecto `sgmo`. `deareys-studio` es otro proyecto, no una segunda mitad de SGMO.

## Preparar la presentación de hoy

1. El dueño abre `/setup` en el dominio habitual, elige nombre/correo/contraseña de al menos 12 caracteres y usa el código privado `BOOTSTRAP_SECRET` ya configurado en Vercel. No hay una cuenta activa predeterminada; el administrador es el dueño del negocio, no Sebas. El código de instalación es privado y no se pega en GitHub ni en el chat.
2. Si usaste la app vieja, abrí **Configuración → Recuperar datos anteriores** desde ese mismo navegador y dominio. Guardá el respaldo en Neon antes de incorporar el catálogo. Para descargar sin iniciar sesión: `/respaldo`. En otro dispositivo podés cargar ese JSON desde la misma sección. Nunca borrar el almacenamiento para probar la actualización.
3. **Incorporar catálogo y configuración** trae casas, carritos, productos, usuarios y montos anteriores usando validaciones del servidor. Las cuentas importadas no tienen contraseña recuperable: asignala desde Usuarios. Si aparece resultado parcial, el respaldo queda completo y el mensaje identifica registros rechazados. Las cuentas ya activadas no se reemplazan.
4. El historial anterior de ventas/jornadas/comprobantes queda respaldado y descargable; no aparece automáticamente como movimientos verificados en la operación central. Si había operaciones reales, necesitan revisión del respaldo y carga controlada. Un archivo mayor de 3,5 MB se conserva para importación del operador; no se finge un envío exitoso.
5. Si no hay datos anteriores, configurá bases, productos/precios/combos, carritos, zonas, tramos, vivienda y personas. Production arranca sin ejemplos ficticios ni precios supuestos. Registrá stock físico por casa/variedad con motivo. Crear una variedad o casa no inventa existencias.
6. Abrí una jornada, probá una venta en efectivo y comprobala desde otro navegador. Para ensayar pagos/OCR, configurar las credenciales de **Production** y verificar proveedor/importe/cuenta/webhook; sólo cambiar claves no demuestra que un cobro esté acreditado.

## Comprobar que la configuración se comparte

- Crear/editar casa, carrito o usuario, guardar, recargar y consultar desde otra cuenta. El éxito sólo aparece después de la respuesta central. Volver a la pestaña o esperar hasta 30 segundos trae cambios; recargar consulta de nuevo.
- Un campo de porcentaje usa números humanos: escribir `17,5` equivale a 17,5 %, almacenado como `0,175`. Las cuentas nuevas toman la comisión base actual. Los tramos configurados determinan la comisión según ventas; una liquidación archivada no cambia retroactivamente.
- Con jornadas abiertas, precios/comisiones/vivienda y asignaciones económicas pueden devolver 409: cerrar/sincronizar esas jornadas antes de modificar la política. Esto preserva las liquidaciones; no es un guardado local que se pierde.
- Desactivar un usuario revoca su acceso y lo retira de la lista habitual y selectores operativos. **Mostrar usuarios archivados** permite consultarlo/reactivarlo sin perder su historial.
- Cambiar contraseña invalida la anterior y sus sesiones; editar otros datos dejando clave vacía la conserva. El login no muestra personas ni permite elegir rol.

## Alcance y pendientes que no deben ocultarse

La operación central cubre acceso, catálogo/configuración, jornadas, ventas, stock por casa, cierres y pagos con verificación de servidor. Fábrica, gastos y otras vistas heredadas aún contienen funciones locales: el aviso de la app las identifica; no usarlas como registro compartido. Apertura desde cero sin señal/PWA completa y pruebas con proveedores/teléfonos reales requieren cierre adicional. Los registros que siguen únicamente en un teléfono no se migran sin acceder a ese origen o recibir su respaldo.

## Evidencia y continuidad

El registro activo es [CONTINUIDAD_HITOS.md](../gestion/CONTINUIDAD_HITOS.md). Allí se actualiza esta entrega, el prompt del principal, revisiones, pruebas, publicación y tareas pendientes. Los informes siguientes se conservan como explicación e historial; sus limitaciones antiguas no sustituyen el estado vigente.

---

# SGMO: cómo revisar, probar y empezar a entender el código

Esta guía corresponde a la rama `codex/sgmo-preparacion-mvp`, no necesariamente a la app que hoy ves en producción. Primero verificá la versión. El plan y todos los prompts están en [HITOS_Y_PROMPTS_MVP.md](../historial/HITOS_Y_PROMPTS_MVP.md).

## 1. Dónde está cada cosa

| Lugar | Qué hace | Qué podés comprobar |
| --- | --- | --- |
| GitHub | Guarda archivos, cambios y versiones; Actions ejecuta pruebas | Rama, commits, Files changed, checks y reportes |
| Este chat | Trabaja sobre código y te explica resultados | Prompts, decisiones y evidencias publicadas; una respuesta no despliega automáticamente |
| VS Code o Codespaces | Permite abrir archivos y ejecutar comandos | TypeScript, tests, build y servidor local |
| Vercel | Ejecuta frontend y backend del proyecto desplegado | Interfaz real, rutas /api, cookies HTTPS, errores y versión |
| Neon/PostgreSQL | Conserva usuarios, ventas, jornadas, inventario y configuración compartidos | Un segundo dispositivo debe leer el mismo dato confirmado |
| Navegador del vendedor | Conserva caché y ventas aún pendientes | Cola offline; un guardado local todavía no es un respaldo central |

## 2. Ver los cambios en GitHub

1. Abrí https://github.com/Deareys/SGMO.
2. En el selector de rama elegí `codex/sgmo-preparacion-mvp`. Si estás en `main`, podés estar mirando código anterior.
3. Abrí `docs/GUIA_SEBAS.md` o `docs/HITOS_Y_PROMPTS_MVP.md`: GitHub muestra el documento directamente, sin descargar ZIP.
4. En el pull request, `Files changed` compara lo recibido con lo modificado. Verde significa líneas añadidas; rojo, líneas reemplazadas o retiradas. No significa que se haya borrado el proyecto.
5. En `Actions`, abrí la ejecución **SGMO validation** de esa rama/commit. Abrí los trabajos y sus pasos. Comprobá que no diga skipped/cancelled cuando esperabas una prueba ejecutada.
6. Un check verde demuestra los casos cubiertos por ese trabajo. No demuestra que el teléfono del cliente, su banco o el despliegue productivo ya hayan sido probados.

## 3. Ejecutar las pruebas sin saber programar

Abrí el repositorio en VS Code/Codespaces y su terminal. Una terminal es una ventana donde se escriben instrucciones. Ejecutá estos comandos uno por uno, dentro de la carpeta donde existe `package.json`:

```bash
npm ci
npm run lint
npm test
npm run build
npm run test:auth:legacy
```

- `npm ci`: instala exactamente las dependencias del lock. Dejalo terminar antes del siguiente comando.
- `npm run lint`: resultado correcto = vuelve el cursor, sin errores de TypeScript. Un mensaje de npm sobre proxy no es un error del código.
- `npm test`: resultado correcto = `fail 0`, sin suites canceladas. Si falla, copiá nombre del caso y error, no secretos.
- `npm run build`: resultado correcto = frontend y servidor compilados y salida pública preparada. El aviso de bundle grande es una mejora pendiente; no equivale a build fallido.
- `npm run test:auth:legacy`: inicia y cierra su propio servidor de pruebas local en 3101, con cuentas efímeras y sin Neon/Mercado Pago. No necesita tus credenciales reales.

Las pruebas SQL completas por sockets se ejecutan en Actions con un contenedor PostgreSQL desechable. Las pruebas WASM y Chromium necesitan runtimes adicionales externos; no tenés que instalarlos manualmente para revisar el check de GitHub.

No pegues DATABASE_URL, contraseñas, PINs ni tokens en el chat o en un archivo público. No ejecutes migraciones, reinicios o reseteos sobre una base que pueda contener ventas reales para hacer una prueba.

## 4. Probar la app en Vercel

Para probar estos cambios, el deployment debe corresponder a esta rama y utilizar una base de pruebas separada. Una preview conectada a la misma base productiva puede modificar ventas reales. Primero resolvemos ese entorno; no hay que adivinar que esté vacío.

1. Abrí el deployment de esa rama en Vercel. En sus datos de origen, comprobá branch y commit.
2. En otra pestaña abrí `https://DOMINIO-DEL-PREVIEW/api/health` reemplazando el dominio. Debe aparecer JSON con `status: "ok"`, `authTransport: "httpOnly-cookie"` y `revision` del commit. Si recibís una página de login de Vercel, es su protección del deployment; si recibís HTML de SGMO, la ruta está mal configurada.
3. Health confirma que el backend responde. No confirma PostgreSQL, migraciones ni banco.
4. Entrá con cuentas de prueba provisionadas. Trabajador = código + PIN de 8 dígitos; administrador = identificador + contraseña. No existe una contraseña predeterminada que debas adivinar.
5. Seguí el recorrido de abajo y anotá resultado esperado/observado.

## 5. Recorrido manual mínimo: dos dispositivos

Usá una notebook como administrador/coordinador y un teléfono como vendedor, ambos en la misma preview con base de pruebas.

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| Acceso | Probar código inexistente, PIN incorrecto, y luego correcto | Los dos primeros rechazan sin enumerar usuarios; el tercero carga datos autorizados |
| Catálogo | Admin cambia un precio sin jornadas abiertas y recarga; vendedor actualiza estado | Ambos leen el precio central; cambios económicos durante jornadas abiertas se rechazan para proteger ventas pendientes y liquidaciones |
| Stock inicial | Admin registra conteo por casa/variedad y motivo | Se guarda saldo real; no aparecen 300 unidades porque el prototipo las sugiera |
| Despacho | Coordinador entrega carrito y cantidades disponibles | Casa se debita, turno se abre y vendedor lo ve; despacho sin saldo se rechaza |
| Venta efectivo | Vendedor registra una unidad/combos del catálogo | Aparece venta y stock baja exactamente sus unidades; pending desaparece sólo al ACK central |
| Dos dispositivos | Refrescar panel del coordinador | Ve esa venta; puede tardar hasta 30 s por actualización periódica |
| Reposición/merma | Reponer y registrar merma una vez; repetir una solicitud de prueba | Contadores no se duplican al repetir el mismo ID; stock insuficiente se rechaza |
| Sobrantes | Vendedor carga conteo de regreso | Turno queda esperando cierre; vendedor no decide importe final |
| Cierre | Coordinador declara efectivo y confirma conteos | Importes calculados en servidor, stock devuelto una vez y PDF sólo al confirmar |
| Comisión | Registrar comprobante de entrega de dinero | Estado pagado confirmado central; no se envía dinero automáticamente |
| Permisos | Vendedor intenta abrir jornada ajena o configurar precios | Servidor rechaza; ocultar un botón no es la única protección |

Los casos detallados están en [OPERACIONES_MVP.md](OPERACIONES_MVP.md) y [CONFIGURACION_CENTRAL_MVP.md](CONFIGURACION_CENTRAL_MVP.md).

## 6. Probar pérdida de conexión sin perder ventas

1. Primero iniciá sesión y cargá tu turno **con conexión**. Mantené esa pestaña abierta.
2. Desactivá Wi-Fi/datos del teléfono, o en Chrome abrí F12 → Network/Red → Offline.
3. Registrá dos ventas de prueba. Deben quedar con aviso pendiente/sin confirmación central; nunca pago bancario aprobado.
4. Recuperá conexión. Usá `Reintentar sincronización` si hace falta.
5. Esperá confirmación y comprobá en el otro dispositivo: exactamente dos ventas, sin duplicados, stock consistente y cola vacía.
6. Repetí con dos pestañas del mismo vendedor y cortes de conexión. Una venta añadida mientras se sincroniza debe conservarse.
7. No borres almacenamiento del navegador ni cierres una sesión con ventas pendientes para probar un borrado. El navegador aún conserva el único ejemplar de lo no sincronizado.

Esta entrega permite ventas con la sesión/turno ya cargados. No certifica instalar PWA, abrir la app desde cero sin red, conservar sesiones revocadas offline ni sincronizar con la app cerrada. La instalación y almacenamiento offline completo tienen un hito pendiente.

## 7. Probar Mercado Pago y OCR

Usá sandbox/cuentas de prueba del proveedor. No uses dinero del cliente para una primera comprobación.

- Una captura es evidencia aportada, no un depósito confirmado. Un OCR legible debe extraer campos y seguir pendiente hasta la consulta bancaria.
- Sin API key/imagen legible/conexión: no debe inventar número de operación, titular o confianza alta.
- Una venta digital debe guardarse y sincronizarse antes de vincular el pago por su `saleId`. Si queda offline, sigue pendiente.
- Probar operación inexistente, pendiente, rechazada, importe distinto, moneda distinta y cuenta receptora distinta: ninguna debe aprobar la venta.
- Aplicar el mismo ID aprobado a dos ventas debe producir conflicto; reintentar la misma venta no duplica ingresos.
- Webhook sin firma o adulterado debe rechazarse. Uno válido se guarda y puede repetirse sin duplicar. Estas pruebas automatizadas usan firmas creadas para el fixture, no credenciales del cliente.
- Simulaciones deben decir que son simuladas y nunca convertirse en confirmación bancaria productiva.

## 8. Aprender el código en este orden

1. `package.json`: buscá `scripts`; cada nombre explica qué comando podés ejecutar. El lock fija versiones de dependencias.
2. `src/types.ts`: define qué campos tiene un usuario, venta o jornada. Es el vocabulario compartido.
3. `src/components/SellerTerminalView.tsx`: es la pantalla; buscá el botón que registra venta y el manejador al que llama.
4. `src/services/storageService.ts`: conserva estado, registra la venta local y sincroniza. Buscá `recordSale`, `flushOfflineQueue`, `refreshCentralState`.
5. `src/services/apiClient.ts`: prepara peticiones al servidor, cookies y CSRF. Un `await` significa esperar la respuesta antes de continuar.
6. `src/server/routes/dbRoutes.ts`: recibe la operación; comprueba rol y recurso. `400` = datos incorrectos; `401` = sesión ausente/inválida; `403` = permiso rechazado; `409` = conflicto; `503` = servicio no disponible. `200` por sí solo no basta: la app comprueba también el contrato de respuesta.
7. `src/server/db/repositories/SaleRepository.ts` y `ShiftRepository.ts`: leen/escriben PostgreSQL; una transacción confirma todo junto o revierte.
8. `migrations/`: cambios versionados en las tablas. Crear un archivo no significa que ya se haya ejecutado en Neon.
9. `scripts/tests/`: ejemplos que preparan un caso, ejecutan una acción y comparan resultado con `assert`. Leé primero `persistence-sync.test.ts` y `operation-ui.test.ts`.
10. `.github/workflows/ci.yml`: indica qué pruebas ejecuta GitHub cada vez que se publica una revisión.

Ejemplo de lectura: botón → servicio → petición HTTP → ruta con permisos → repositorio/SQL → respuesta → pantalla actualizada. Si falla antes de la respuesta confirmada, la pantalla conserva lo pendiente.

## 9. Cómo reportar un fallo útil

Copiá esta ficha sin incluir credenciales ni datos reales de compradores:

```text
Versión/commit y dominio del preview:
Rol de la cuenta de prueba:
Pantalla:
Pasos exactos:
Resultado que esperaba:
Resultado que vi:
Mensaje/código HTTP:
Fecha y hora:
Conexión activa/offline:
¿Quedaron ventas pendientes?:
```

## 10. Qué falta antes de vender en producción

- Confirmar si Neon contiene datos reales; separar preview y base de pruebas y hacer respaldo recuperable.
- Aprobar/evaluar migraciones incrementales sobre copia y provisionar cuentas seguras, sin credenciales demo.
- Actions PostgreSQL real y navegador aprobados en el commit entregado.
- Verificar frontend y backend de esa revisión en HTTPS, cookies, CSRF, variables y permisos del deployment.
- Cuenta receptora y sandbox de Mercado Pago, webhook firmado, OCR real y pruebas de dos dispositivos.
- Acordar la política de descuento por diferencia de efectivo y completar capacitación del operador.
- Identificar fábrica, gastos, incidencias y otras pantallas que aún guarden datos sólo en este dispositivo: no usarlas como sistema central completo.
- Completar PWA/IndexedDB o almacenamiento durable de comprobantes y ensayo en un teléfono con la señal de playa.

No hace falta que aprendas todo el lenguaje para probar. Primero verificá una acción, su resultado visible y que otro dispositivo reciba exactamente el mismo dato.

## Desarrollo local y migraciones manuales

`npm run dev` usa variables que el entorno ya le haya entregado. Si trabajás en VS Code y querés cargar un archivo privado de configuración, copiá `.env.example` a `.env`, completá la base **de pruebas**, usá `SGMO_PUBLIC_ORIGIN=http://localhost:3000` y ejecutá `npm run dev:local`. Una conexión local a PostgreSQL desechable puede usar `DATABASE_SSL=false`; una conexión remota exige verificación TLS.

No ejecutes esta orden sobre Neon todavía: primero se debe identificar y respaldar su contenido. Para quien configure la copia de pruebas, el procedimiento manual será fijar en `.env` `SGMO_MIGRATION_TARGET=hostname/nombre_de_base` exactamente igual al destino de DATABASE_URL y luego `npm run db:migrate -- --apply`. El script exige ese destino explícito y no imprime contraseñas. Esta orden actualiza tablas; no es una prueba inofensiva ni parte del build. Después se aprovisiona el primer administrador con `POST /api/auth/bootstrap-admin`, el secreto de infraestructura y una contraseña nueva, siguiendo AUTHENTICATION.md/CSRF. Retirar BOOTSTRAP_SECRET del servidor después; crear y provisionar trabajadores desde Administración.
