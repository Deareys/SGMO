# Hito 3.5 — Acceso simple y usuarios persistentes

29/10/2026, Argentina. En implementación. Alcance solicitado: crear/editar cuentas y contraseña en PostgreSQL, cerrar sesión e ingresar con esos datos; pantalla normal de identificador y contraseña. Sin proveedor externo nuevo ni costo de autenticación adicional.

## Diagnóstico confirmado

GitHub main `d291d5ae52f1a86d4445824beec553ea1cbcf877`; PR 2 abierto, sin integrar, head `f8d9b4ff868937ccaca80952d036ceab20909ccc`. Vercel `sgmo-rose.vercel.app` sirve ese main antiguo (`dpl_86jnrjcuhse1TDNUuuH9NHQasdUw`). Su componente de acceso enumera trabajadores de una lista local y tiene modos admin/trabajador. La rama reparada aún no llegó a ese dominio. La base Neon productiva no tiene tablas; ensayo tiene nueve migraciones, ocho perfiles y ninguna cuenta aprovisionada. Los datos que sólo existan en navegadores antiguos no se consideran migrados; no borrar su caché.

## Hitos y prompt utilizado por el principal

1. Confirmar revisión desplegada, rutas, fuente de usuarios y esquema actual.
2. Simplificar acceso a correo/código y contraseña. Habilitar contraseña inicial en alta y reemplazo explícito en edición; clave vacía no altera credencial. Validación sencilla coherente en cliente/servidor y correo único.
3. Verificar alta → lectura SQL → recarga → logout → login por correo/código; edición de identidad/contraseña → rechazo del secreto anterior y sesiones revocadas. Probar errores, duplicados y ausencia de secretos en respuestas/caché.
4. Publicar sólo los cambios pertinentes, comprobar Actions y un deployment conectado a Neon; entregar URL exacta y pasos manuales. Separar verificación de ensayo y despliegue productivo.

```text
Reparar exclusivamente inicio de sesión y persistencia de usuarios sobre la revisión remota vigente. No reconstruir otras funciones. Leer código y despliegue reales antes de atribuir causas. Conservar React/Express/PostgreSQL/scrypt, cookies HttpOnly, CSRF, RBAC, límites de intentos, transacciones y ventas pendientes. Mostrar un formulario sin picker ni modos de perfil. Permitir al administrador asignar una contraseña al crear y restablecerla explícitamente al editar; guardar sólo hash/salt y omitir secretos del estado público. Mantener cambio propio y recuperación existentes. Normalizar y validar identificadores; rechazar duplicados sin alterar cuentas previas. Confirmar el guardado antes del éxito y reproducir el recorrido completo desde otro navegador. Ensayar migraciones en una copia antes de modificar ensayo. No añadir servicios pagos ni usar credenciales predeterminadas. Publicar y documentar la revisión y URL verificadas; nunca afirmar que el dominio principal fue reparado si aún sirve el main anterior.
```

No se delegan tareas a agentes auxiliares. Pruebas con cuentas sintéticas; no se cambia la contraseña de una persona real.
