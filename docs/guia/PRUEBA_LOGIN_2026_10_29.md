# Probar el login y el guardado de usuarios

29/10/2026. Usar la URL exacta y revisión indicadas en el [informe del Hito 3.5](../historial/HITO_3_5_LOGIN_Y_USUARIOS.md). GitHub guarda el código; Vercel ejecuta una revisión concreta y Neon guarda las cuentas. Una rama publicada no cambia automáticamente el dominio principal.

Versión funcional verificada: [abrir la app de ensayo](https://sgmo-hxrkrkfqs-deareys.vercel.app), revisión `90a89899…`. Requiere acceso autorizado de Vercel. **No confundir con `sgmo-rose.vercel.app`, que sigue en el main antiguo.** El dueño debe completar la primera activación antes de crear cuentas; los perfiles sin contraseña en la base no tienen un acceso predeterminado.

## Primera cuenta del negocio

La cuenta administradora pertenece al dueño. Si esa base aún no tiene ningún administrador activado, el dueño abre directamente `/setup` en la URL verificada, escribe su nombre/correo, elige contraseña y utiliza el código privado `BOOTSTRAP_SECRET` que configuró el responsable de la instalación en ese entorno. No hay contraseña predeterminada ni acceso por elegir un perfil. No compartir el código o contraseñas en GitHub, capturas o soporte. El enlace `/setup` no figura en el login público.

Si el preview pide acceso a Vercel, entrar con la cuenta autorizada. Esa protección del entorno de pruebas es independiente de la cuenta del negocio. No borrar los datos del navegador de la app antigua: pueden contener información que todavía no llegó a PostgreSQL.

## Prueba de aceptación

1. Abrir la app verificada. Sólo deben verse **Código de usuario o correo**, **Contraseña** e **Ingresar**, además de la marca y botón para mostrar/ocultar la clave. No debe haber lista de personas, selector de rol ni botón para cambiar a administrador.
2. Ingresar con la cuenta del dueño. Abrir **Configuración → Usuarios & Roles → Nuevo Usuario**. Completar nombre y un código único; puede ser un número, conservando sus ceros. El correo es opcional y, si se completa, debe pertenecer sólo a esa cuenta. Elegir rol y base. Asignar contraseña inicial de al menos 12 caracteres y repetirla; se permiten frases sin exigir símbolos o mayúsculas.
3. Pulsar **Guardar Usuario**. Debe cerrarse el formulario después de que confirme el servidor y aparecer el usuario. Recargar: debe seguir apareciendo. Si falla el servidor, el formulario debe mostrar el error y conservar los datos para corregirlo.
4. Salir del administrador e ingresar con el código y contraseña recién guardados. Repetir en otro navegador o teléfono usando correo y contraseña si se asignó correo. Debe abrir el perfil correcto, con los permisos de ese usuario.
5. Volver a ingresar como administrador y editar su nombre/correo sin completar contraseña. Guardar, recargar y verificar los cambios. El usuario debe poder seguir entrando con la misma contraseña y el identificador actualizado.
6. Editar otra vez: completar **Nueva contraseña** y **Repetir contraseña**. Guardar. La anterior debe dejar de funcionar, la nueva debe ingresar y las sesiones anteriores deben rechazarse al consultar el servidor. El titular puede cambiarla luego desde **Mi contraseña**. Si una cuenta no tenía base, debe conservar **Sin base asignada** al editar su clave; cambiar la contraseña no debe asignarle una casa ni exigir cerrar jornadas.
7. Intentar crear otra cuenta con el mismo correo, incluso cambiando mayúsculas. Debe mostrarse el error de correo asignado y no aparecer un usuario falso. Un código repetido también debe rechazarse.
8. Si hay un corte de conexión al guardar, no asumir éxito o fracaso: reconectar y recargar la lista antes de repetir. Una respuesta perdida puede ocurrir después de que PostgreSQL haya confirmado el cambio.

## Qué comprueba cada herramienta

- **App en Vercel:** permite recorrer formularios, salir, recargar e ingresar desde otro dispositivo.
- **GitHub → Actions:** revisa tipos, build, pruebas, PostgreSQL real con procesos concurrentes y Chromium. Usar la ejecución del commit probado; no un verde antiguo.
- **Neon:** la rama correcta debe tener las migraciones 001–010. El perfil debe existir en `users`, con hash/salt y sin contraseña legible; no editar hashes manualmente. La consulta de una contraseña nunca debe mostrar su texto original.

Las pruebas automáticas usan cuentas aleatorias y separadas del dueño. Este hito no certifica pagos, OCR ni los demás módulos de la aplicación.
