# Hito 3.4 — Contraseñas personales, recuperación y preparación productiva

Implementación y ensayos iniciales: 18/10/2026, Argentina. Continuidad y publicación: 20/10/2026. Estado: implementado y verificado localmente; publicación/CI remota en curso. Base recibida: `e730d09055d6aadca6189821875362509ff437dd`, rama `codex/sgmo-preparacion-mvp`, PR 2. Sebas autoriza este cambio después de discutir alternativas; el administrador operativo es el dueño del negocio.

## Política y alcance

Contraseña nueva de 12 a 128 caracteres; se permiten frases y pegado/autocompletado. Se bloquean claves comunes, patrones y derivados simples del identificador. No se acorta ni se transforma una contraseña existente. El mínimo elegido prioriza usabilidad frente a la recomendación de 15 caracteres sin segundo factor; no se afirma equivalencia. El correo o código identifica y el servidor determina el rol. No se requiere servicio de correo para el alta/recuperación presencial.

El dueño crea un perfil sin conocer la contraseña final. Genera una activación temporal verificando su propia contraseña. El usuario elige la clave y la confirma; el código sólo sirve una vez y no inicia sesión automáticamente. Quien sabe su clave puede cambiarla; quien la olvida necesita verificación presencial y un nuevo código del administrador. No se muestra ni se recupera el secreto anterior. No se fuerzan cambios periódicos. Los cambios revocan sesiones y códigos pendientes sin eliminar ventas.

## Hitos y prompts del principal

| Hito | Criterio de cierre | Estado |
| --- | --- | --- |
| 3.4.1 Política/esquema | Migración 009 conserva credenciales y operaciones, tokens hasheados, vencimiento y versión | Verificado en SQL local y copia Neon |
| 3.4.2 Backend | Login de todos los roles con contraseña, activación, cambio y recuperación atómicos/RBAC | Implementado; SQL y navegador aprobados |
| 3.4.3 Interfaz | Alta por administrador, elección privada, Mi contraseña y mensajes comprensibles | Seis recorridos Chromium aprobados |
| 3.4.4 Verificación | SQL real, concurrencia, navegador y backend/base de ensayo | Ensayos locales/Neon aprobados; CI/preview nuevos pendientes |
| 3.4.5 Release | GitHub/CI/preview verificados y tareas productivas documentadas | En curso; producción pendiente |

```text
3.4.1: Implementar política compartida 12–128, sin composición arbitraria, con rechazo de claves comunes y patrones. Preservar credenciales anteriores. Crear migración aditiva 009 que permita contraseñas personales en todos los roles y activaciones de un solo uso, hasheadas, con versión y vencimiento. Probar la migración antes de aplicarla a ensayo; no tocar producción.
3.4.2: Mantener contratos estrictos/cookies/CSRF y separar rol de tipo de credencial. Implementar cambio propio con reautenticación, activación/reset con administrador reautenticado y consumo atómico de token. Serializar cambios, rechazar reutilización y revocar sesiones/códigos. Auditar sin secretos. Fallar cerrado si PostgreSQL no responde.
3.4.3: El dueño crea perfiles y entrega códigos temporales después de verificar presencialmente a cada persona. El trabajador elige su contraseña final; no guardar claves ni tokens en localStorage. Facilitar cambiar contraseña en todos los roles y explicar recuperación manual en login. Preservar cola de ventas al reingresar después de cambiar/resetear.
3.4.4: Probar navegador → API → SQL → respuesta, claves incorrectas/comunes, permisos, vencimiento, reenvío y carreras entre procesos. Verificar backend/Neon con evidencia de la revisión correcta; no confundir conexión, esquema y operaciones. No hacer cobros ni llamadas OCR durante estas pruebas de identidad.
3.4.5: Publicar sólo archivos pertinentes sobre el árbol remoto vigente, conservar cambios ajenos y verificar CI/preview. Entregar pasos entendibles para activar al dueño, configurar negocio/proveedores, ensayar campo, preparar esquema/variables productivas y promover únicamente la revisión validada.
```

No se utilizan agentes auxiliares. Las pruebas usan credenciales sintéticas efímeras; no se aprovisiona al dueño real sin su elección privada.

## Evidencia local y de Neon

| Verificación | Resultado | Alcance |
| --- | --- | --- |
| `npm run lint` | Aprobado, 20/10 | TypeScript sin errores |
| `npm run build` | Aprobado, 20/10 | Vite, servidor y empaquetado público Vercel; advertencia previa de tamaño de bundle |
| `npm test` | 193/193, 18/10 | Política, criptografía, HTTP, repositorios, cliente, liquidaciones y regresiones |
| `PORT=3105 npm run test:auth:legacy` | 35/35, 20/10 | Demo aislada con credenciales aleatorias; mínimo actualizado a 12 |
| Autenticación SQL `--wasm` | 10 grupos, 18/10 | Migraciones 001–009 y regresiones históricas |
| Contraseñas SQL `--wasm` | 8 grupos, 18/10 | Preservación histórica, hash del código, vencimiento, consumo único, revocaciones y rollback deliberado |
| Ventas SQL `--wasm` | 24 casos, 18/10 | Integridad de venta/stock/pagos/liquidación conservada |
| Configuración SQL WASM | 6 grupos, 18/10 | Configuración, stock y snapshots |
| Chromium auth/central/contraseñas | 8 + 9 + 6 escenarios, 18/10 | API real y SQL efímero; contextos separados y viewport móvil |
| Neon copia y ensayo | 009 aplicada y validada, 18/10 | SQL PostgreSQL remoto real; 22 tablas, nueve migraciones |

La nueva prueba histórica falló inicialmente porque el ejemplo que debía medir 11 caracteres tenía 12. Se corrigió el dato de prueba; no se modificó el mínimo de la aplicación para obtener un aprobado. El 20/10 terminó 35/35. Los ensayos WASM no demuestran concurrencia de procesos: esa evidencia corresponde al nuevo workflow PostgreSQL 16.

Neon proyecto `still-mud-30172607`: respaldo previo sin compute `sgmo-pruebas-pre-009-20261018` (`br-misty-poetry-b6jp9gzv`), copia de ensayo `sgmo-ensayo-009-20261018` (`br-autumn-scene-b6dn6018`). La copia recibió 009 dentro de una transacción antes de tocar `sgmo-pruebas` (`br-solitary-base-b6xjzp4s`). Se compararon conteos y huellas de las filas: ocho usuarios, una venta, un turno y cuatro sesiones históricas permanecieron iguales; sólo se añade `credential_version=0`. Después se aplicó 009 a la base de ensayo con el mismo resultado. Ninguna cuenta se aprovisionó. No se imprimieron hashes de credenciales ni secretos.

La rama productiva `br-fancy-unit-b67bv6j9` permaneció sin tablas en la lectura del 18/10. No se modificó producción ni se llamó a Mercado Pago/Gemini en este hito. No se creó una contraseña para el dueño. La cuenta del negocio debe activarla su titular en privado.

## Recuperación excepcional del dueño

Si existe otro admin, usar su recuperación presencial normal. Si ninguno puede entrar, un operador autorizado con acceso a la base ejecuta el CLI desde una terminal privada después de verificar al dueño. Debe configurar `.env` fuera de Git, confirmar `SGMO_RECOVERY_TARGET=host/base`, `SGMO_PUBLIC_ORIGIN` exacto y ejecutar `npm run auth:recover-owner -- --apply --identifier CODIGO_DEL_DUENO`. El comando exige stdin/stdout interactivos, rechaza CI/salida redirigida y entrega un enlace de 15 minutos. No escribir el secreto en argumentos, tickets, capturas ni logs. El código queda hasheado y la emisión queda auditada. No se ejecutó este comando contra una cuenta real durante el hito.

La política de 12 caracteres es una decisión de usabilidad solicitada por Sebas. No equivale al mínimo de 15 sin segundo factor de [NIST SP 800-63B-4, sección 3.1.1.2](https://pages.nist.gov/800-63-4/sp800-63b.html#passwordver). Se admite una lista local de claves comunes, no una consulta exhaustiva de filtraciones. No hay MFA implementado.

## Cierre remoto

Pendiente registrar SHA publicado, ejecución Actions de esa revisión y URL/resultado del preview. No presentar esta evidencia local como publicación terminada. Los pasos del negocio y del release están en [CONTRASENAS_Y_SALIDA_A_PRODUCCION.md](CONTRASENAS_Y_SALIDA_A_PRODUCCION.md).
