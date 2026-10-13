# Hito 1.3 — Transporte de sesión del navegador

Fecha: 13 de octubre de 2026. Rama de integración: `codex/sgmo-preparacion-mvp`.

## Prompt operativo aplicado

Migrar de manera coherente los consumidores del frontend y el backend a sesión cookie HttpOnly, conservando autenticación PostgreSQL fail-closed, RBAC y reglas financieras. Proteger todas las mutaciones del navegador, incluido login y bootstrap, mediante CSRF y origen exacto. Eliminar bearer heredado de almacenamiento local; no restaurar identidad desde caché ni abrir login offline. Dejar un transporte API explícito para herramientas autorizadas, desactivado por defecto. Probar bloqueo CSRF, cookies, restauración y revocación. No modificar reglas para IAs, hacer commits/push ni operar bases remotas desde el agente auxiliar.

## Contrato browser

1. `GET /api/auth/csrf` entrega `{ csrfToken }` y cookie CSRF HttpOnly. La prueba CSRF se conserva exclusivamente en memoria JavaScript.
2. `POST /api/auth/login` conserva `{ userCode, pin }` y `{ identifier, password }`; requiere cookie CSRF, `X-CSRF-Token` coincidente y `Origin` autorizado.
3. Login browser responde `{ success, user, expiresAt, message }` y cookie de sesión; **no devuelve token de sesión en JSON**.
4. `GET /api/auth/me` valida la sesión cookie en el servidor y permite restaurar perfil y vigencia. No acepta el perfil/cache local como autenticación.
5. `POST /api/auth/logout` revoca centralmente antes de borrar cookie. Si PostgreSQL falla, devuelve 503 y conserva cookie para reintentar; no afirma revocación exitosa.

Producción utiliza `__Host-sgmo-session` y `__Host-sgmo-csrf`, sin Domain, Path `/`, HttpOnly, Secure y SameSite Strict. Desarrollo/test local utiliza `sgmo-session` y `sgmo-csrf`, sin Secure para HTTP loopback. La sesión conserva vigencia máxima de 14 horas, hash SHA-256 persistido, revocación y validación central existentes.

## Origen y CSRF

`browserSecurityMiddleware` se monta sobre `/api` antes de las rutas que mutan estado; authRouter también lo incluye para conservar protección en pruebas o montajes independientes. Las excepciones públicas, como webhook bancario con su autenticación específica, son responsabilidad de la integración del servidor y no constituyen una exención genérica para `/api`.

En producción el origen válido procede de `SGMO_PUBLIC_ORIGIN` (URL HTTPS exacta sin path ni barra final) o de `https://${VERCEL_URL}` suministrado por la plataforma. No se calcula usando Host, X-Forwarded-Host, X-Forwarded-Proto ni entradas del cliente. Sin configuración válida, las rutas browser devuelven `503 BROWSER_SECURITY_NOT_CONFIGURED`; los diagnósticos públicos deben montarse fuera de este middleware.

Sin origen explícito, desarrollo/test sólo admite HTTP `localhost` o `127.0.0.1` en el puerto real del socket del servidor. Los writes requieren Origin exacto y comparación temporalmente segura de cookie y header CSRF. Fetch Metadata de otro sitio se rechaza. El double-submit aleatorio es portátil entre instancias: no depende de un Map por proceso. Cookies `__Host-` en producción y origen exacto evitan que un subdominio suministre una cookie legítima para esta aplicación. HTTPS es indispensable.

El frontend debe servirse en el mismo origen que `/api`. Un frontend y API en dominios diferentes requieren otro diseño explícito; este hito no introduce CORS con credenciales entre sitios ni cookies SameSite None.

## Compatibilidad API explícita

`SGMO_ENABLE_API_TOKENS=true` activa un transporte opt-in para herramientas. Deben enviar `X-SGMO-Client: api`, carecer de Origin y de Fetch Metadata de navegador (`Sec-Fetch-Site`, `Sec-Fetch-Dest`, `Sec-Fetch-User`) y no enviar cookie de sesión. Se tolera `Sec-Fetch-Mode` porque Node fetch lo añade automáticamente.

Sólo ese transporte recibe token JSON en login y puede usar `Authorization: Bearer`. No crea cookies de sesión. Está desactivado por defecto y no lo utiliza el frontend. No constituye otra forma de validar PIN ni elimina identificador/fortaleza/provisionamiento/RBAC. Las suites heredadas que necesitan bearer seleccionan esta modalidad de forma explícita. No existe autenticación mediante `x-auth-token`.

## Cliente y transición

`apiClient.authenticatedFetch` centraliza credenciales same-origin, elimina Authorization/x-auth-token/X-SGMO-Client de consumidores browser, evita redirects y obtiene una única prueba CSRF compartida entre writes concurrentes. Únicamente un rechazo `403 CSRF_REJECTED`, emitido antes de ejecutar la mutación, permite renovar CSRF y reintentar una vez. Errores económicos, permisos, 401 y 503 no repiten writes.

Al inicializar StorageService se eliminan `SGMO_AUTH_TOKEN` y `SGMO_AUTH_USER`; ventas, stock y cola permanecen intactos. `getAuthToken()` permanece como firma compatible y retorna null. `restoreSession()` requiere conexión y `/me` válido; no restaura offline ni admite perfil arbitrario o vigencia inválida.

Logout limpia la identidad de pantalla y guarda `SGMO_LOGOUT_PENDING` mientras falta confirmación central. Una recarga con ese marcador reintenta revocación y no restaura la cookie existente. La interfaz muestra el cierre pendiente. Una autenticación nueva espera un logout en curso para evitar que su respuesta tardía borre la cookie nueva. Ninguno de estos marcadores contiene credenciales.

## Evidencia del agente

Pruebas realizadas durante integración:

- `auth-routes.test.ts`: 27/27, con HTTP real y backend simulado donde corresponde. Incluye cookies HttpOnly, CSRF incorrecto/ausente, origen atacante y Host falsificado, API desactivada y fallo central al revocar.
- `client-auth-security.test.ts`: 31/31. Incluye purga bearer legado, cookie restore válido, rechazo offline/expirado y logout pendiente.
- `api-client-security.test.ts` y `browser-security.test.ts`: 8/8. Incluye concurrencia CSRF, no repetición de errores económicos, restricciones API y atributos Secure/host-only.
- `npm run lint`: aprobado al integrar estos cambios.
- `npm run build`: aprobado (Vite y bundle backend); aviso de bundle mayor de 500 kB registrado, sin optimizaciones ajenas al alcance.
- `git diff --check`: aprobado.

Estos resultados no sustituyen la prueba final de PostgreSQL real, los dos procesos ni browser smoke; esos controles pertenecen a la integración del hito y deben registrarse en el informe global. Las pruebas locales de atributos Secure no certifican HTTPS remoto ni el despliegue.
