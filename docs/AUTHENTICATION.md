# SGMO — Autenticación vigente y aprovisionamiento

Estado al 12 de octubre de 2026: implementación reparada localmente. No certificada para producción. Consultar `HITO_1_2_1_INFORME.md` y `POSTGRES_AUTH_TESTS.md`.

## Contratos y respuestas

| Operación | Entrada / condición | Resultado |
| --- | --- | --- |
| POST /api/auth/login, trabajador | `{ userCode, pin }`; PIN string de exactamente ocho dígitos | Token opaco y perfil público si la cuenta está activa, aprovisionada, sin bloqueo y la credencial coincide |
| POST /api/auth/login, administrador | `{ identifier, password }`; identificador código/email/ID de cuenta admin | Misma estructura de sesión; contraseña mínimo 14, máximo 1024 caracteres, con mayúscula/minúscula y número o símbolo al aprovisionar |
| POST /api/auth/validate-credential | `{ type: 'worker_pin' o 'admin_password', value }` | Validación sintáctica/fortaleza; no consulta usuarios ni informa existencia |
| POST /api/auth/bootstrap-admin | `{ identifier, newPassword, bootstrapSecret }` | Alta inicial protegida; nunca reset de administrador ya aprovisionado |
| GET /api/auth/me | Bearer válido | Perfil público y vencimiento |
| POST /api/auth/logout | Bearer de sesión actual | Revocación central; un fallo no informa éxito |
| POST /api/users | Admin autenticado, perfil público y PIN/password opcional del rol correspondiente | Cuenta creada, aprovisionada solo si se entrega credencial válida; respuesta sin secretos |
| PUT /api/users/:id | Admin autenticado y campos a actualizar | Confirmación de perfil central; cambio de credencial/rol/inactividad/permisos revoca sesiones |

No se aceptan `{ pin }`, PIN4, `{ identifier, pin }`, `{ userCode, password }`, `email/username` como campos alternativos de login ni payloads mixtos. El código de trabajador debe coincidir con `user_code`, no con un ID/email alternativo. Los formatos/tipos inválidos reciben 400; credencial incorrecta, cuenta inexistente/inactiva/no aprovisionada comparten 401 `INVALID_CREDENTIALS`. Bloqueo devuelve 429. Caída de servicio central devuelve 503, sin datos internos ni fallback. No se devuelven PIN, password, hash o salt.

## Modos de ejecución

- **Central:** PostgreSQL obligatorio para nuevas sesiones. Ausencia/configuración inválida/fallo no habilita autenticación en cliente o memoria. La app aún puede conservar la operación offline de una sesión ya activa; no se inventa una identidad nueva.
- **Demo aislada:** requiere `SGMO_AUTH_MODE=demo`, `NODE_ENV=development` o `test`, ausencia de variables DATABASE_URL/POSTGRES_URL/PGHOST/PGDATABASE/PGUSER y credenciales de demo suministradas mediante entorno. El servidor se enlaza a `127.0.0.1`. No hay valores predeterminados; ninguna cuenta se provisiona si falta o falla alguna credencial demo. No desplegar esta configuración ni publicarla mediante proxy/túnel.
- `.env.example` es documentación; el servidor no carga `.env` automáticamente. Inyectar variables por la plataforma o el mecanismo seguro de Node. Nunca copiar la configuración demo a producción.

## Alta inicial del administrador

1. En un entorno aislado, validar y respaldar el esquema. El código reparado necesita migraciones 001–005, aplicadas por el migrador versionado. **Esta intervención no ejecutó ese paso en Neon.**
2. La semilla crea perfiles sin credenciales. Identificar el administrador inicial activo por su código/ID real; no inferir IDs de la caché del navegador.
3. Generar un secreto criptográficamente aleatorio de al menos 32 caracteres (por ejemplo, 32 bytes aleatorios codificados hex) e inyectar `BOOTSTRAP_SECRET` solo en el entorno del servidor. No usar contraseñas públicas ni incluirlo en Vite, Git, capturas o logs.
4. El operador autorizado envía una solicitud `bootstrap-admin` desde un canal de infraestructura controlado, HTTPS o loopback local. Proporciona identificador real, nueva contraseña robusta elegida para esa cuenta y secreto de infraestructura. No ofrecer este secreto en una pantalla pública.
5. El repositorio toma un lock global y de tabla y verifica que no haya ningún administrador aprovisionado, incluso inactivo. La cuenta destino debe ser admin activa sin aprovisionar. La escritura y revocación de sesiones son transaccionales. Repetir o apuntar a trabajador/inactivo/no existente no reabre el acceso.
6. Iniciar sesión con el contrato de administrador y retirar `BOOTSTRAP_SECRET` de la infraestructura. No usar bootstrap como mecanismo de emergencia de reset.

Si falta esquema, servidor o secreto, el proceso queda bloqueado. No usar demo o credenciales predeterminadas para sortearlo. Si ya existen admins provisionados pero nadie puede autenticar, falta completar el procedimiento de recuperación de infraestructura del Hito 1.3; no hay un endpoint público de reapertura. Una contraseña borrada por la antigua 004 no puede reconstruirse mediante migración.

## Alta y restablecimiento de trabajadores

Con una sesión admin verificada, consultar **GET /api/users** para obtener IDs/códigos centrales actuales. POST crea cuenta nueva; PUT sobre ID existente, con `{ pin }`, restablece su credencial. Debe ser string de ocho dígitos y cumplir las reglas de fortaleza del servidor. La credencial se transporta únicamente en la petición y se comparte con su titular mediante canal privado; nunca se guarda en perfiles/caché/auditoría del navegador.

La migración 005 invalida una sola vez los PINs anteriores y revoca sesiones. Un hash no demuestra que el PIN original tuviera ocho dígitos: todos los trabajadores previos deben aprovisionarse **después** de esa migración. No reejecutar el SQL manualmente tras restablecer cuentas. Cambiar un rol sin credencial válida apropiada deja la cuenta sin aprovisionar. Cambiar credencial revoca las sesiones activas en la misma transacción.

La UI espera confirmación del backend antes de mostrar éxito. La hidratación general de usuarios desde PostgreSQL aún pertenece al Hito 2.1: para cuentas existentes, la fuente fiable es GET /api/users, no los perfiles iniciales de la caché. Un fallo no crea credenciales locales alternativas.

## Sesiones, intentos y límites pendientes

- Sesiones de 14 horas, tokens aleatorios de 256 bits; PostgreSQL conserva hash SHA-256. No se almacenan tokens centrales en un duplicado de memoria.
- Login toma lock de tabla de escritura antes de fila, verifica, registra el resultado y emite la sesión dentro de la misma transacción. Reset/altas usan el mismo orden; bootstrap usa lock global exclusivo. Esto evita sesiones nuevas emitidas fuera de la transacción después de un reset. La concurrencia real sigue pendiente de prueba.
- Cinco fallos por cuenta en ventana de 15 minutos bloquean otros 15. Los intentos en bloqueo no extienden su vencimiento y la siguiente ventana comienza nuevamente. SQL ejecutado en WASM; no certificado entre servidores.
- Control por origen complementario en Map, hasta 10.000 entradas con limpieza de vencidas; no puede crecer indefinidamente ni desbloquear direcciones al saturarse. `x-forwarded-for` directo no se confía. En Cloud Run configurar proxies confiables y un control compartido; no asumir distribución del Map.
- Bearer continúa en localStorage y puede ser obtenido por XSS. Migración completa a cookies HttpOnly/Secure, CSRF/CORS y vencimiento/reanudación del cliente pendiente de Hito 1.3. No se realizó una conversión parcial.
- Cerrar sesión en el cliente elimina su acceso local inmediatamente; si la red falla no puede garantizarse revocación central desde el navegador. El endpoint central no afirma revocación exitosa ante fallos. Hace falta mejorar aviso/reintento de logout y reanudación offline sin guardar credenciales.
- Verificar TLS de PostgreSQL y configuración del alojamiento antes de producción. No se modificaron infraestructura, pagos ni reglas de comisiones/stock/liquidación en este hito.
