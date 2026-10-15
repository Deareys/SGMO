# Hito 3.2: inicialización del ensayo y acceso al preview

Fecha: 15 de octubre de 2026, Argentina. Estado: base inicializada; reparación del arranque en validación.

Sebas autorizó continuar con la base de ensayo y resolver el acceso autorizado al preview. El alcance es la rama Neon `sgmo-pruebas` (`br-solitary-base-b6xjzp4s`), base `neondb`, del proyecto `still-mud-30172607`, y el preview de `codex/sgmo-preparacion-mvp`. Esta autorización específica permite la inicialización remota de ensayo; no cambia reglas para auxiliares ni implica integrar main o operar sobre la rama Neon production.

Antes de migrar se confirmó cero tablas públicas y se creó el respaldo `sgmo-pruebas-pre-migracion-20261015` (`br-mute-unit-b6up0ykz`), sin compute. Se aplicaron las migraciones 001–008 en una transacción con control de base vacía y registro de versiones. La primera llamada fue rechazada por instrucciones múltiples en una consulta preparada y revirtió; se comprobó nuevamente cero tablas. La segunda separó las instrucciones respetando strings, comentarios y bloques dollar-quoted, con reconstrucción exacta de cada archivo, y confirmó las ocho versiones atómicamente.

Resultado SQL: 21 tablas públicas, ocho migraciones, seis perfiles semilla sin credenciales, cero ventas, cero jornadas y cero filas de stock. Pruebas de unicidad de código de usuario, rechazo de hash inválido e inventario negativo aprobaron sin dejar usuarios o stock de prueba. El esquema de la rama production no se modificó.

La API autorizada permitió crear un acceso temporal de una hora para el deployment de ensayo. El secreto de ese enlace se conserva fuera de esta documentación. No se deshabilita Deployment Protection ni se publica el enlace privado.

El acceso se generó mediante `patch_url_protection_bypass` sobre el deployment concreto, con `ttl: 3600`, usando el alcance por defecto de la conexión. La consulta previa de bypass y las herramientas de logs siguen devolviendo 403. Con el enlace temporal y cookies privadas las peticiones ya alcanzaron la función, que respondió 500 `FUNCTION_INVOCATION_FAILED`, incluido health.

## Reparación de arranque en curso

Se reprodujo un defecto concreto al emitir el backend como ESM y cargarlo con Node nativo: `ERR_MODULE_NOT_FOUND` en los imports relativos sin extensión. Se corrigen exclusivamente los especificadores usados en el grafo de ejecución para incluir `.js` y `index.js` cuando corresponde, manteniendo TypeScript/React/Express y las reglas del negocio. La prueba nueva `backend-esm-entry.test.ts` compila el grafo, lo carga sin tsx y solicita health por HTTP. Falló antes de los cambios y aprobó después. Falta confirmar el resultado de esta reparación en Vercel; no se atribuye definitivamente el error remoto a esa causa sin dicha prueba.

Verificación local de la reparación: tipos, suite completa (175 casos), build y 35 regresiones de autenticación aprobaron. El cambio de aplicación se limita a especificadores de importación; no modifica operaciones SQL, precios, comisiones o autorizaciones.

## Prompt operativo del principal

```text
Inicializar exclusivamente la rama Neon de ensayo ya elegida por el usuario, con respaldo previo y los SQL versionados sin alterar reglas económicas. Confirmar proyecto/rama/base y rechazar una base con tablas antes de la primera inicialización. Conservar versiones y comprobar resultados transaccionales. Resolver acceso temporal y acotado al preview usando la autorización existente, sin desactivar la protección general. Probar backend, autenticación y operaciones con cuentas/datos de ensayo; consultar proveedores sin procesar dinero real. Mantener secretos fuera del repositorio y registrar resultados y límites verificables.
```
