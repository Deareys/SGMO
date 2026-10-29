# SGMO: verificación tras configurar Vercel y Neon

Fecha: 15 de octubre de 2026, Argentina. Rama revisada: `codex/sgmo-preparacion-mvp`, revisión `6a8a8c16655a0dbd516fbe4a1976b4dd4608645d`. Solicitud: ejecutar pruebas después de cargar las credenciales. Responsable: principal Codex.

## Dictamen

El código de la rama de trabajo aprueba las pruebas automatizadas. El entorno de ensayo todavía no permite certificar el recorrido desplegado completo: Neon responde, pero la rama de ensayo está sin tablas; Vercel bloquea el acceso automatizado al preview antes de llegar a Express. Los proveedores bancario/OCR no se declararon verificados.

## Pruebas ejecutadas en esta intervención

| Comprobación | Resultado real | Alcance |
| --- | --- | --- |
| `npm run lint` | Aprobado | TypeScript sin errores |
| `npm test` | 174 aprobadas, 0 fallas, 0 omitidas/canceladas | Contratos HTTP, autenticación, roles, CSRF, colas, integridad, adaptadores y proveedores simulados |
| `npm run build` | Aprobado | React, servidor y seis archivos públicos preparados para Vercel |
| `npm run test:auth:legacy` | 35 aprobadas, 0 fallas | Demo local efímera y controles de acceso; no utiliza credenciales reales |
| SQL de diagnóstico sobre Neon | Aprobado | Base `neondb`, PostgreSQL 18.6, rama `sgmo-pruebas` accesible |
| Estructura SGMO en esa rama | Pendiente de inicialización | Cero tablas en el esquema `public` |
| Flags de servidor en Vercel | Valores esperados confirmados | `DATABASE_SSL=true`, `SGMO_AUTH_MODE=central`, `SGMO_ENABLE_API_TOKENS=false`; receptor con formato numérico válido |
| Health y estado DB del preview vía integración | Bloqueado | HTTP 403 en la fase de acceso a la protección de Vercel |
| Health y estado DB por petición HTTP pública | Bloqueado | Redirección al login de Vercel; respuesta final HTML 200, no JSON de SGMO |
| Consulta de errores de runtime de Vercel | Bloqueado | API de Vercel devuelve 403 |
| Credenciales bancarias/OCR en uso real | No comprobado | Presencia de variables no demuestra permisos ni validez del proveedor |

Se ejecutó `npm run lint && npm test && npm run build && npm run test:auth:legacy`; el proceso terminó con código 0. Queda el aviso conocido de tamaño del bundle frontend, que no produjo fallo de compilación.

El checkout local conserva `97b66ec` en su historial. Se verificó la comparación con `6a8a8c1`: sólo cambian README y dos documentos; los archivos de aplicación y pruebas son los mismos. La edición de la introducción de la guía realizada por el usuario se conserva en GitHub.

## Evidencia de CI de la revisión correcta

Se comprobó la ejecución [38510242156](https://github.com/Deareys/SGMO/actions/runs/38510242156), correspondiente a `6a8a8c1`: jobs `browser` y `security-and-postgres` en success. Sus pasos de PostgreSQL real, HTTP multiproceso, operaciones/pagos, configuración SQL y Chromium están aprobados. El workflow equivalente de push [38510237656](https://github.com/Deareys/SGMO/actions/runs/38510237656) también terminó success.

Es una ejecución ya completada que se consultó durante esta revisión; no se presenta como una prueba nueva de Neon o del deployment. PostgreSQL de CI es desechable y los proveedores bancarios se sustituyen por fixtures.

## Neon: conexión disponible, esquema ausente

Proyecto: `still-mud-30172607`, nombre `SGMO -  costa`. Rama elegida por el usuario: `sgmo-pruebas`, ID `br-solitary-base-b6xjzp4s`, hija de `production`. Base: `neondb`.

La consulta de sólo lectura devolvió:

```json
{
  "database_name": "neondb",
  "postgres_version": "18.6 (653b019)",
  "public_table_count": 0,
  "public_tables": []
}
```

Esto prueba acceso del operador a Neon, no la conexión del backend con esa rama. El valor Secret de `DATABASE_URL` no se recuperó. El login y la persistencia necesitan las tablas instaladas; no se intentó inventar un acceso alternativo ni guardar ventas en esta base vacía.

### Inicialización que falta preparar y ejecutar

Destino del ensayo: exclusivamente `sgmo-pruebas/neondb`, identificado por los IDs anteriores. Revisar justo antes de actuar, preservar un punto de recuperación y ejecutar las migraciones versionadas con conexión directa mediante el runner del proyecto. La base operativa `production` es un destino distinto.

| Archivos existentes | Efecto previsto en una base nueva |
| --- | --- |
| 001–002 | Tablas iniciales y datos de referencia; revisar catálogo, perfiles y precios antes de usarlos con el negocio |
| 003–005 | Sesiones, códigos de usuario y endurecimiento de credenciales; 005 invalida credenciales heredadas una sola vez |
| 006 | Integridad de operaciones y liquidaciones |
| 007 | Configuración e inventario por casa; requiere conteo real de stock |
| 008 | Ledger bancario y recepción durable de avisos |

El runner `scripts/migrate-database.ts` requiere una configuración privada, `SGMO_MIGRATION_TARGET=host/base` que coincida exactamente con la conexión y la opción `--apply`. No se ejecutó en esta verificación. Después se debe aprovisionar el primer administrador por el procedimiento protegido de [AUTHENTICATION.md](../tecnica/AUTHENTICATION.md), y crear usuarios de ensayo.

## Vercel: revisión y momento de las variables

Al comenzar esta revisión se encontró:

| Despliegue | Rama / revisión | Estado |
| --- | --- | --- |
| `sgmo-4cpi5e7he-deareys.vercel.app` | `main` / `d291d5a` | READY; no contiene la entrega de PR #2 |
| `sgmo-oh08vtq19-deareys.vercel.app` | `codex/sgmo-preparacion-mvp` / `6a8a8c1` | READY; creado antes de las nuevas variables |

Las fechas de creación de las variables nuevas son posteriores al preview de `6a8a8c1`. El redeploy encontrado corresponde a main. Para que la rama verificada reciba esas variables necesita un deployment nuevo de esa misma rama. La publicación de este informe puede generarlo automáticamente mediante la integración existente; comprobar su revisión y su estado antes de usarlo.

PR #2 continúa abierto y sin integrar a main. No se debe atribuir la seguridad y funcionalidad de esta rama a una app que ejecuta `d291d5a`.

### Variables observadas

Están presentes en Preview: conexión PostgreSQL, los tres flags comprobados, receptor, secretos de Mercado Pago y de bootstrap. Hay entradas generales y entradas específicas de la rama para varias claves; la específica prevalece.

También existen dos entradas `GIMINI_API_KEY`, una general y otra de rama. El código consulta `GEMINI_API_KEY`, que también existe. Las entradas con la errata no son consumidas por el servidor; confirmar que el valor vigente y facturado esté guardado bajo el nombre correcto. No se infiere que OCR falle sólo por esa duplicación.

`SGMO_PUBLIC_ORIGIN` no aparece en el inventario. El servidor tiene fallback al dominio único de `VERCEL_URL`; abrir un alias distinto puede requerir configurar el origen exacto. No se pudo probar ese caso porque la petición se detuvo en Vercel. `APP_URL` no sustituye esa variable.

## Acceso HTTP y alcance de las credenciales

La configuración observada mantiene Vercel Authentication con `all_except_custom_domains`. La integración permite consultar configuración y despliegues, pero falla al obtener acceso temporal al preview con `403`, etapa `read_protection_bypass`. La petición HTTP pública también termina en una página de login. No se presenta ese HTML 200 como backend saludable.

No hay Vercel CLI instalada ni identidad CLI local disponible; no se inició otro login ni se cambió la protección del proyecto. Para continuar, habilitar el acceso autorizado de la integración al proyecto/deployment o un mecanismo de acceso de ensayo apropiado. Si el alcance ya es correcto, revisar el permiso específico; no se garantiza que repetir el inicio de sesión lo resuelva.

Mercado Pago también necesita alcanzar el webhook sin una sesión de Vercel. El código crea `notification_url` en la preferencia; configurar una excepción únicamente en otra URL del panel no demuestra que los avisos generados por la app lleguen.

## Pruebas reales que siguen pendientes

1. Backend HTTPS con JSON en health y estado de base conectado; revisión correcta.
2. Login, cookies, CSRF y restauración con usuarios de ensayo después de instalar el esquema.
3. Catálogo, stock y operaciones compartidos entre dos dispositivos.
4. Consulta a la API oficial de Mercado Pago con el receptor del entorno correcto y una venta central vinculada.
5. Recepción de un webhook firmado, persistencia y reintento sin duplicado.
6. Extracción OCR real, con `extractionSucceeded: true`, utilizando un documento de prueba.

No se procesaron cobros, transferencias, liquidaciones ni modificaciones de stock remoto. No se leyeron ni publicaron valores Secret. El ID del receptor sólo se comprobó por formato; falta confirmar a qué cuenta corresponde mediante el proveedor. La lista completa para certificar producción sigue en [INFORME_ENTREGA_MVP.md](INFORME_ENTREGA_MVP.md).

## Prompt usado por el principal

```text
Verificar SGMO después de la configuración de credenciales indicada por el usuario. Inspeccionar la rama y revisión efectivas, metadatos de variables y la rama Neon de ensayo. Ejecutar tipos, suites del repositorio y build sin credenciales operativas. Consultar SQL de diagnóstico sin alterar datos. Probar health/estado de base del preview correcto mediante el acceso autorizado disponible y detener el recorrido desplegado ante una barrera de autenticación o esquema ausente. Diferenciar resultados locales, CI, conexión del operador y comportamiento real de proveedores. Registrar los bloqueos con evidencia y preparar los pasos de inicialización, sin simular pagos ni dar por aprobado un servicio por tener su clave. Publicar un informe sin secretos en la rama de trabajo, preservando cambios ajenos.
```

