# Hito 3.3 — Liquidaciones, acceso y preparación de operación

Fecha: 18/10/2026, Argentina. Estado: cambios implementados y pruebas locales aprobadas; evidencia de publicación, CI y preview en [el PR 2](https://github.com/Deareys/SGMO/pull/2). Continúa el diagnóstico `DIAGNOSTICO_GENERAL_2026_10_18.md`. Guía para Sebas: [PRUEBAS_HITO_3_3_Y_PRODUCCION.md](PRUEBAS_HITO_3_3_Y_PRODUCCION.md).

Sebas autorizó corregir liquidaciones, retirar el selector de perfiles del login, preparar el administrador del dueño, probar sesiones/dispositivos y cortes de señal y preparar producción. Mercado Pago/OCR serán configurados por Sebas; no se cambian sus secretos como parte de esta reparación. El propietario del negocio, no Sebas, será el administrador de uso real y elegirá su contraseña por un canal privado.

| Subhito | Cambio y criterio de cierre | Estado |
| --- | --- | --- |
| 3.3.1 Liquidaciones | Cero, excepción individual, exención, comisión y tarifa; coherencia servidor/UI/PDF y regresiones SQL | Implementado; 24 casos SQL WASM y regresión con jsPDF real aprobados |
| 3.3.2 Acceso único | Un formulario, sin selección de perfil ni listado público; el servidor devuelve el rol | Implementado; login trabajador/admin y acceso móvil comprobados en Chromium |
| 3.3.3 Administrador del dueño | Alta inicial privada y pruebas con sesiones independientes; sin contraseñas del dueño inventadas o publicadas | Flujo implementado/probado; alta de la persona real pendiente de elección privada de su contraseña |
| 3.3.4 Cortes de red | Venta pendiente durable, reconexión, reenvío sin duplicados y recuperación; registrar límites del arranque offline | Nueve escenarios Chromium/API/SQL aprobados; teléfonos físicos y arranque completamente offline pendientes |
| 3.3.5 Mercado Pago/OCR | Configuración de Sebas, lectura OCR utilizable y pago/webhook oficiales | Pendiente de configuración/validación real; no se hicieron cobros |
| 3.3.6 Preparación productiva | Revisiones/orígenes/variables y controles de release; explicación de 402 y main | Gate reproducible preparado; producción actual no aprueba |

## Prompts operativos del principal

```text
3.3.1: Reparar el tratamiento de cero y excepción individual en liquidaciones usando la regla operativa actual como autoridad. No recalcular historia ni introducir descuento automático por efectivo faltante. Probar primero un caso SQL que falle con el código previo y después los casos de cero, override, exención, comisión y snapshot. Alinear cálculo central, auxiliar, UI y PDF. Conservar imports ESM ejecutables en Node.
3.3.2: Retirar el selector de perfiles. Mostrar un solo formulario de identificador y credencial, manteniendo accesibilidad móvil y teclado numérico para quien usa PIN. Elegir el contrato por forma de credencial sin consultar/listar cuentas; el backend autentica y decide el rol. Mantener CSRF/cookies y probar trabajador, coordinador, fábrica y administrador.
3.3.3: Preparar un alta inicial comprensible para el dueño del negocio, que elige su contraseña privada. No crear una cuenta personal de Sebas ni pedir contraseñas por chat. Probar el flujo autorizado con cuentas efímeras y sesiones independientes; conservar semillas sin claves predeterminadas y revocar credenciales QA al terminar.
3.3.4: Ensayar cortes de red reales del navegador y recuperación de pendientes. Verificar que una venta que perdió la respuesta no se duplique y que nada se anuncie sincronizado antes del ACK. Preservar autenticación central; no inventar sesiones desde localStorage para conseguir un arranque offline aparente.
3.3.5: Conservar la separación OCR/acreditación bancaria. No cambiar las claves que está configurando Sebas ni simular aprobaciones. Preparar los escenarios de extracción, pago y webhook oficiales; registrar expresamente cualquier dependencia aún no disponible.
3.3.6: Preparar y ejecutar las comprobaciones de release posibles. Explicar que 402 corresponde a facturación del proveedor y que push a una rama de ensayo no actualiza la rama productiva. Documentar los pasos exactos, versiones, entorno y límites que dependan de la configuración del negocio/proveedores. Publicar ramas de trabajo sin perder cambios ajenos.
```

No se lanzaron agentes auxiliares en este hito.

## Alta inicial del propietario

Se prepara `/setup` como formulario de activación de una instalación nueva. El dueño ingresa nombre, correo y una contraseña propia; el responsable de infraestructura introduce el código privado `BOOTSTRAP_SECRET`. No se publica ni se recupera ese secreto desde la aplicación. El backend conserva CSRF, limitación de intentos y los bloqueos transaccionales que permiten un único primer administrador; el nombre y correo se guardan en la misma transacción que su contraseña. Después del alta no se puede reutilizar este formulario para cambiar al dueño ni restablecer accesos. No se crea una cuenta personal para Sebas. Las pruebas usan exclusivamente identidades y claves efímeras en SQL local.

## Evidencia y alcance

- Durante el ensayo se reprodujo una carrera de recarga: `centralHydrated` sobrevivía en la caché y podía habilitar datos anteriores antes del nuevo bootstrap. Se invalida ese indicador al cargar; la sesión y los datos operativos deben confirmarse por separado con el servidor. La regresión conserva tanto la caché como la cola durable y comprueba que `/me` por sí solo no marque datos actualizados.
- La regresión SQL inicial reprodujo el defecto: costo configurado cero producía 8000. La suite reparada aprobó 24 casos; siete agregados cubren vivienda cero, tarifa plana cero, excepción individual cero/positiva, exención prioritaria, comisión cero y efectivo faltante separado. Cada caso reintenta el cierre después de cambiar política/perfil y comprueba que no cambie el snapshot histórico.
- La prueba de jsPDF usa una instancia real e intercepta únicamente la descarga: comisión cero, vivienda cero y efectivo declarado cero conservan el valor y el faltante informado. No se reescriben comprobantes históricos almacenados.
- Al revisar la captura se detectó también que el formulario histórico de arqueo se inicializaba con efectivo esperado en lugar del declarado. Se corrige para cargar el efectivo y conteos guardados, incluido cero; los campos de jornadas conciliadas/liquidadas quedan de sólo lectura.
- Playwright 1.56.1 con Chromium: ocho escenarios del smoke de autenticación y nueve del smoke central aprobados localmente. El segundo usa dos contextos independientes, cookies distintas, routers reales y PGlite efímero con migraciones 001–008; no sustituye respuestas de la API. Incluye el recibo visible de cierre con vivienda y efectivo declarado cero.
- En ese ensayo se registraron cuatro ventas sintéticas por 16000 en total, con cuatro UUID únicos. Se verificaron dos ventas offline, una respuesta perdida tras COMMIT y una venta recuperada al cerrar/abrir pestaña. El total no cambia al reintentar ni recargar. No hubo conexión con Neon ni llamadas a Mercado Pago/Gemini en esos escenarios.
- Se comprobó el límite de arranque: una pestaña nueva sin red falla al cargar. Al recuperar señal, la venta previa sigue conservada y sincroniza. Esto no equivale a PWA completa ni a probar dos teléfonos físicos.
- El control de producción de sólo lectura aprobó 1/10 comprobaciones en `https://sgmo-rose.vercel.app` (sólo la portada). El backend productivo viejo no satisface los contratos del release. La comprobación no modifica ese deployment.
- Inventario Vercel sin descifrar valores: `DATABASE_URL`, `BOOTSTRAP_SECRET`, variables Mercado Pago y flags centrales siguen asignados a Preview; Production sólo comparte `GEMINI_API_KEY` y `APP_URL`. La variable correcta Gemini tiene prioridad sobre el alias con errata `GIMINI_API_KEY`. No se leyeron sus valores ni se cambiaron secretos.

Las pruebas SQL WASM no prueban concurrencia entre procesos. La nueva revisión debe aprobar además PostgreSQL 16 real y sus pruebas HTTP multiproceso en GitHub Actions. El alta real del dueño, configuración productiva, webhook/pago oficial, OCR después de resolver facturación y campo siguen abiertos.

## Verificaciones locales de la entrega

| Control | Resultado | Alcance |
| --- | --- | --- |
| `npm run lint` | Aprobado | TypeScript de frontend, backend y scripts |
| `npm test` | 188/188 | Autenticación, cliente, políticas económicas, PDF, persistencia y gate de release |
| `npm run build` | Aprobado | Vite, servidor y salida Vercel; advertencia de chunk grande ya registrada en diagnóstico |
| `npm run test:auth:legacy` | 35/35 | Regresiones históricas de autenticación/RBAC |
| `sales-integrity.integration.ts --wasm` | 24/24 | SQL transaccional efímero, siete regresiones económicas nuevas |
| `postgres-auth.integration.ts --wasm` | 10/10 grupos | Migraciones y autenticación; no concurrencia distribuida |
| `browser-auth.smoke.cjs` | 8/8 | Acceso móvil, PIN/admin, cookies, logout, CSRF y errores sin DB |
| `browser-central.smoke.cjs` | 9/9 | Dueño, dos contextos, venta compartida, cortes, recuperación y recibo |
| `verify-deployment` sobre dominio productivo anterior | 1/10; rechazo esperado | Sólo portada pasa; no se promovió ningún cambio a producción |

Las dependencias QA se instalaron fuera del repositorio. Los fixtures borran conexiones/credenciales heredadas de su entorno antes de usar SQL efímero; no migran ni aprovisionan al dueño en Neon. Las claves sintéticas nunca aparecen en informes/capturas. El gate de release es de sólo lectura y no debe interpretarse como certificación de pagos o funcionamiento de campo.

Al repetir tipos después del build se confirmó con `tsc --listFilesOnly` que TypeScript incluía también los bundles generados/minificados en `public/assets`, junto con versiones anteriores. Se excluye esa salida, igual que `dist` y `build`, sin excluir fuentes ni tests. No se borran archivos ajenos ni se deshabilita la verificación del código original.
