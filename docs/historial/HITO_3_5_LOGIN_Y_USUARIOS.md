# Hito 3.5 — Acceso simple y usuarios persistentes

29/10/2026, Argentina. Implementado y probado en ensayo; el dominio principal conserva la revisión antigua. Alcance solicitado: crear/editar cuentas y contraseña en PostgreSQL, cerrar sesión e ingresar con esos datos; pantalla normal de identificador y contraseña. Sin proveedor externo nuevo ni costo de autenticación adicional.

## Diagnóstico confirmado

GitHub main `d291d5ae52f1a86d4445824beec553ea1cbcf877`; PR 2 abierto, sin integrar, head `f8d9b4ff868937ccaca80952d036ceab20909ccc`. Vercel `sgmo-rose.vercel.app` sirve ese main antiguo (`dpl_86jnrjcuhse1TDNUuuH9NHQasdUw`). Su componente de acceso enumera trabajadores de una lista local y tiene modos admin/trabajador. La rama reparada aún no llegó a ese dominio. La base Neon productiva no tiene tablas; ensayo tiene nueve migraciones, ocho perfiles y ninguna cuenta aprovisionada. Los datos que sólo existan en navegadores antiguos no se consideran migrados; no borrar su caché.

En esa revisión, `createUser` y `updateUser` modifican caché y muestran el resultado antes de terminar `fetch`. No comprueban HTTP no exitoso; un 404 no activa `.catch`. La prueba pública del 29/10 confirmó **404** en `/api/health` y `/api/db/status`. Esto explica el falso guardado: los perfiles mostrados en el cliente no equivalen a cuentas persistidas para autenticar. El nuevo recorrido espera la confirmación PostgreSQL y sólo entonces actualiza la lista.

## Hitos y prompt utilizado por el principal

1. Confirmar revisión desplegada, rutas, fuente de usuarios y esquema actual.
2. Simplificar acceso a correo/código y contraseña. Habilitar contraseña inicial en alta y reemplazo explícito en edición; clave vacía no altera credencial. Validación sencilla coherente en cliente/servidor y correo único.
3. Verificar alta → lectura SQL → recarga → logout → login por correo/código; edición de identidad/contraseña → rechazo del secreto anterior y sesiones revocadas. Probar errores, duplicados y ausencia de secretos en respuestas/caché.
4. Publicar sólo los cambios pertinentes, comprobar Actions y un deployment conectado a Neon; entregar URL exacta y pasos manuales. Separar verificación de ensayo y despliegue productivo.

```text
Reparar exclusivamente inicio de sesión y persistencia de usuarios sobre la revisión remota vigente. No reconstruir otras funciones. Leer código y despliegue reales antes de atribuir causas. Conservar React/Express/PostgreSQL/scrypt, cookies HttpOnly, CSRF, RBAC, límites de intentos, transacciones y ventas pendientes. Mostrar un formulario sin picker ni modos de perfil. Permitir al administrador asignar una contraseña al crear y restablecerla explícitamente al editar; guardar sólo hash/salt y omitir secretos del estado público. Mantener cambio propio y recuperación existentes. Normalizar y validar identificadores; rechazar duplicados sin alterar cuentas previas. Confirmar el guardado antes del éxito y reproducir el recorrido completo desde otro navegador. Ensayar migraciones en una copia antes de modificar ensayo. No añadir servicios pagos ni usar credenciales predeterminadas. Publicar y documentar la revisión y URL verificadas; nunca afirmar que el dominio principal fue reparado si aún sirve el main anterior.
```

No se delegan tareas a agentes auxiliares. Pruebas con cuentas sintéticas; no se cambia la contraseña de una persona real.

## Resultado y pruebas

Revisión funcional final: `90a898994de7bfc6ddbdd9f82da3ab7432b6dc6e`. [Actions 40884981122](https://github.com/Deareys/SGMO/actions/runs/40884981122) aprobado, ambos jobs en success. Tipos/build, **196 pruebas**, **35 históricas**, **11 grupos SQL de autenticación/migración**, **11 grupos HTTP en dos procesos PostgreSQL 16**, **11 grupos SQL de contraseñas**, **25 casos de operación** y seis grupos WASM de configuración. Chromium: **8 de acceso + 9 centrales + 10 de cuentas/contraseñas**. La nueva cobertura reproduce alta, recarga, logout del administrador, ingreso desde otro navegador, edición con/sin clave, revocación y duplicados; también reinicia un backend conservando las cuentas.

La revisión final incluye una regresión adicional: al editar la contraseña de una cuenta sin base, el formulario conserva su asignación vacía y el repositorio escribe SQL `NULL`. Antes podía asignar la primera base sin pedirlo y bloquear el guardado si existía una jornada abierta. La prueba de navegador conserva una jornada abierta y comprueba guardado e ingreso de la cuenta de fábrica; el test PostgreSQL verifica la FK vacía y la nueva contraseña. No se modifica la regla económica que impide cambiar asignaciones durante jornadas abiertas.

Preview de trabajo final: [sgmo-hxrkrkfqs-deareys.vercel.app](https://sgmo-hxrkrkfqs-deareys.vercel.app), deployment `dpl_6HXj2FmF4y2tJCrHM8GWyKG3xMR9`, revisión `90a89899…`. **11/11** comprobaciones de infraestructura HTTPS, revisión exacta, conexión Neon, CSRF y barreras anónimas. [Resultado final sin secretos](evidencias/HITO_3_5_PREVIEW_FINAL.json). Mantiene protección de Vercel: abrir con una cuenta autorizada. El administrador real aún debe activar su cuenta privadamente en `/setup`; no existe contraseña predeterminada.

Prueba de nube independiente: rama Git `qa/login-20261029`, deployment `dpl_5bvWHPpgR4Ay8qJ2YdMKAnTar7hK`, revisión `6e475e591292a2153bb0051a14d7d29cbb86a4ab`, conectada exclusivamente a copia Neon `br-autumn-scene-b6dn6018`. El script `scripts/tests/deployed-users.smoke.mjs` completó **8/8** escenarios HTTPS reales: activación sintética, alta, lectura central, salir de administrador e ingresar al trabajador por código/correo, edición sin cambiar clave, cambio de clave y revocación, segunda sesión y correo duplicado. No llamó a pagos ni OCR. [Resultado sin secretos](evidencias/HITO_3_5_VERCEL_NEON.json). Este ensayo antecede a los ajustes de mensajes públicos y al caso sin base de la revisión final; no se atribuye una ejecución mutativa a otra revisión.

La primera ejecución remota se detuvo al recibir un 401 inesperado; la autorización temporal del preview impedía continuar. Se renovó el acceso y se comprobó la misma revisión sin cambiar las reglas de autenticación. Se reanudó con las credenciales privadas de sus propias cuentas, sin reabrir bootstrap ni repetir el alta. La prueba mantuvo sus expectativas 401/403 y la comprobación de que la contraseña anterior dejara de funcionar. Al terminar, ambas cuentas sintéticas quedaron inactivas y **cero sesiones QA activas**, confirmado por SQL; los perfiles/auditoría se conservaron y la venta histórica no se modificó. No usar ese deployment QA como app operativa.

## Base y conservación de datos

Respaldo sin compute: `sgmo-pruebas-pre-010-20261029`, `br-patient-dew-b6nc146n`. Se ensayó la migración 010 en la copia y después en `sgmo-pruebas`; los conteos y huellas de usuarios, ventas y sesiones permanecieron iguales. Sólo se agregó el índice único del correo y su versión. Ensayo: **22 tablas, diez migraciones, ocho perfiles, cero cuentas reales aprovisionadas**. La migración rechaza correos previos duplicados y revierte sin borrar ni reasignar filas; probado tanto en WASM como en PostgreSQL de CI.

La copia de QA recibió exclusivamente credenciales aleatorias de esa prueba y quedó retirada al terminar. Las variables nuevas de QA se limitaron a su rama de preview. Los archivos locales con códigos, cookies o conexiones no se publican; el informe JSON sólo contiene resultados y metadatos de la prueba.

## Uso y publicación

La [guía manual](../guia/PRUEBA_LOGIN_2026_10_29.md) explica alta, edición, confirmación y primer administrador. La contraseña anterior no se consulta ni se muestra: sólo se reemplaza. Se conserva el cambio propio y la recuperación por enlace además de la contraseña inicial solicitada. Los correos se normalizan; un código numérico conserva sus ceros. El login no muestra usuarios, modos de rol, teclado PIN ni enlaces de configuración. Los mensajes públicos se refieren a contraseña/acceso, manteniendo compatibilidad histórica únicamente dentro del servicio.

**El dominio `sgmo-rose.vercel.app` continúa en main antiguo.** Publicar una rama no cambia esa app. Integrar/publicar requiere respetar la regla 15 de AGENTS.md, configurar Production con su base y preparar su primera cuenta; antes de sustituir el cliente viejo deben resguardarse los datos que sólo estén en esos navegadores. No se declara reparado el dominio principal por haber aprobado el preview. No se certifican otros módulos ni proveedores en este hito.
