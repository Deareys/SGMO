# SGMO — Continuidad del desarrollo por hitos

Fecha: 12 de octubre de 2026.
Base inspeccionada: `43971a03719734ef11c3042b0c745162b4874174`.
Rama local de trabajo: `codex/hito-1-2-1-verificacion`.
Estado actualizado: correcciones locales del Hito 1.2.1 implementadas y evidencia SQL WASM de 1.2.2 disponible. Consultar HITO_1_2_1_INFORME.md, AUTHENTICATION.md y POSTGRES_AUTH_TESTS.md para resultados/limitaciones. El inventario siguiente conserva los hallazgos iniciales como historial, no describe los mecanismos actuales.

## Autorización y límites

Sebas autorizó reparaciones necesarias, documentación y agentes auxiliares. Solo el agente principal puede modificar o exceptuar reglas para IAs del proyecto. Los auxiliares deben respetar AGENTS.md y trabajar en archivos delimitados; no pueden ampliar sus permisos. Una excepción debe registrar regla, motivo, alcance y riesgo antes de aplicarse.

Conservar React, Express y arquitectura modular. Proteger ventas, stock, comisiones, arqueos y liquidaciones; cualquier cambio crítico necesita análisis previo de dependencias. No hacer refactorizaciones generales ni eliminar respaldos. La autorización original se amplió explícitamente el 12 de octubre: el principal de Codex puede crear commits/push de ramas de trabajo sin confirmación adicional. No se conectan Neon ni se ejecutan migraciones remotas o despliegues; esta entrega se publica para revisión en una rama separada de main. El alcance original sin commits/push se conserva solo como historial del prompt siguiente, no como restricción vigente del principal.

## Evidencia inicial

Esto es revisión estática de código, no demostración mediante pruebas ni auditoría completa.

| Hallazgo | Fuente | Consecuencia / trabajo pendiente |
| --- | --- | --- |
| bootstrap-admin exige BOOTSTRAP_SECRET solo si la cuenta ya está aprovisionada y tiene hash de contraseña; no valida rol admin | src/server/auth/authRoutes.ts | Proteger también el aprovisionamiento inicial, verificar rol y estado, impedir reutilización/concurrencia y separar recuperación de emergencia. |
| createSession guarda primero en memoria y absorbe errores de persistencia; validateToken consulta memoria cuando PostgreSQL falla o no encuentra sesión | src/server/auth/sessionManager.ts | Cuando la base central está configurada, su fallo debe impedir emitir o aceptar una sesión mediante memoria. Revisar revocación y respuesta HTTP. |
| Credenciales públicas de prueba se inicializan siempre; el login local las permite con cualquier NODE_ENV distinto de production | src/server/auth/authRoutes.ts | Demo debe requerir selección explícita e aislamiento; omitir NODE_ENV no puede habilitar autenticación de demostración. |
| create/updatePin/update admiten PINs de longitud distinta de ocho porque solo validan fortaleza dentro del caso de ocho dígitos | src/server/db/repositories/UserRepository.ts | Rechazar formatos inválidos en todas las escrituras de credenciales, con reglas por rol. |
| create/updatePin/updatePassword/update no establecen is_provisioned al aprovisionar | src/server/db/repositories/UserRepository.ts | Completar de forma coherente el ciclo de alta/restablecimiento y revocación de sesiones. |
| La migración 004 borra también contraseñas según condiciones del hash/salt de PIN | migrations/004_auth_credentials_modernization.sql | Probar con cuentas nuevas, heredadas y administradores con contraseña válida; revisar colisiones de códigos antes de modificar SQL. No asumir si se aplicó en remoto. |
| Contador por cuenta usa UPDATE SQL; limitación por IP usa Map y acepta x-forwarded-for directamente | UserRepository.ts y src/server/auth/rateLimiter.ts | SQL atómico de incremento no demuestra seguridad de todo el flujo concurrente. Revisar ventana, bloqueo, éxito concurrente y confianza del proxy; documentar alcance por instancia. |
| Una aserción permite 503 como alternativa a 200 al consultar ventas con administrador | scripts/verify-auth-security.ts | Separar autorización de disponibilidad; un error de servicio no demuestra éxito funcional. Ampliar cobertura de escenarios negativos y base caída. |
| TODO y documentación de roles contienen estados y contratos anteriores | docs/TODO.md, docs/ROLES_AND_PERMISSIONS.md, AGENTS.md | Corregir estados tras verificar; preservar decisiones históricas indicando cuáles fueron reemplazadas. |

El rechazo de PIN sin identificador aparece en la ruta inspeccionada. Falta buscar todas las rutas y consumidores antes de afirmar eliminación total. Los respaldos de AI Studio no están confirmados en este checkout: .gitignore excluye .backup_*. No afirmar que se conservaron o exportaron.

## Orden de los siguientes hitos

1. **Hito 1.2.1 — reapertura, corrección y verificación.** Completar inventario, respaldo previo a editar código, línea base de tipos/build/pruebas y correcciones puntuales de bootstrap, demo, repositorio, sesiones, hashes, contrato y semillas. Mantener registro de fallos anteriores al cambio. Cerrar solo con evidencia de rechazo de login legado/texto plano y cobertura de fallos centrales.
2. **Hito 1.2.2 — integración de autenticación con PostgreSQL de pruebas.** Instancia local o aislada, nunca Neon productivo en este alcance. Verificar migraciones para instalaciones nuevas y existentes, bloqueo concurrente desde dos instancias, aprovisionamiento, revocación, reinicio y caída de base. No confundir mocks con PostgreSQL real. Si no puede ejecutarse, registrar bloqueo y pasos reproducibles.
3. **Hito 1.3 — transporte y ciclo completo de sesión.** Revisar cookies HttpOnly/Secure, CSRF, CORS, origen de frontend/backend, expiración y clientes móviles. Implementar frontend y backend como cambio coherente con pruebas. El requisito de venta offline no habilita autenticación alternativa en el servidor.
4. **Hito 2.1 — verificación de persistencia y sincronización.** Aprovechar la Fase 2 existente; verificar en lugar de reescribir. Probar lotes, reintentos, duplicados, errores y recuperación entre dispositivos. Conservar ventas locales hasta confirmación central y preservar reglas económicas.
5. **Hito 2.2 — revisión final y preparación operativa.** Revisar pagos/webhooks y OCR existentes, configuración y arranque del backend, documentación y regresiones. Preparar entrega para revisión. Las operaciones remotas y el despliegue siguen fuera de este alcance.

La numeración posterior es provisional y debe reconciliarse con documentación o hitos adicionales encontrados. Cada hito empieza solo con dependencias previas verificadas o un bloqueo explícito.

## Prompt operativo del primer hito

> SGMO — HITO 1.2.1: VERIFICACIÓN INDEPENDIENTE Y CIERRE REAL DE REGRESIONES
>
> Trabaja sobre la base y rama indicadas, inspecciona git status, AGENTS.md y reglas anidadas, DECISIONS.md y los archivos reales. Los informes anteriores son hipótesis por comprobar. Mantén arquitectura y módulos financieros. Conserva una copia recuperable antes de editar código y registra cómo restaurarla sin sobrescribir trabajo ajeno. No ejecutes migraciones remotas, no conectes Neon ni despliegues. El principal de Codex está autorizado a guardar commits/push en ramas de trabajo; Studio y auxiliares no deben ampliar esa autorización. No publiques secretos.
>
> Revisa todas las rutas de autenticación y aprovisionamiento, consumidores frontend, hashes scrypt, semillas 002, migración 004 y sesiones. Contrato objetivo: trabajador { userCode, pin } de ocho dígitos; administrador { identifier, password }. Investiga y documenta cualquier alias existente antes de decidir su eliminación. Elimina credenciales en texto plano y login sin identificador. Cuenta no aprovisionada o hash inválido no autentica.
>
> Corrige bootstrap inicial sin atajos públicos: autorización de infraestructura obligatoria, rol administrador comprobado, operación atómica y uso inicial limitado; restablecimiento normal con autorización apropiada y revocación de sesiones. Si faltan dependencias, deja el procedimiento cerrado y documenta el bloqueo.
>
> Demo debe ser explícita y aislada; no depende únicamente de NODE_ENV. Todas las escrituras de credenciales validan rol/formato/fortaleza y actualizan estado de aprovisionamiento consistentemente. Con base configurada, ningún error ni ausencia de sesión central puede activar memoria como alternativa. Logout no informa éxito si falló la revocación central. Respuestas y logs no exponen secretos ni errores internos. Revisa enumeración de cuentas y límites de tamaños/tipos de entrada.
>
> Evalúa el flujo concurrente completo de bloqueo por cuenta y el control por origen; distingue SQL implementado, pruebas locales simuladas y PostgreSQL real. No afirmes protección distribuida sin probarla. No cambies cookies parcialmente en este hito: registra dependencia para Hito 1.3.
>
> Ejecuta línea base y luego TypeScript, build y pruebas pertinentes con servicios externos aislados. Añade casos de bootstrap no autorizado, rol inválido, reutilización, credenciales públicas fuera de demo, NODE_ENV omitido, PIN inválido en cada escritura, cuenta sin aprovisionar, hashes inválidos/texto plano, login sin identificador/cuatro dígitos, fallo al guardar/leer/revocar sesión y RBAC. No conserves aserciones permisivas para obtener una suite verde. Pruebas que cambien datos se ejecutan solo en entorno desechable.
>
> Actualiza TODO, decisiones aplicables y documentación de autenticación. Entrega archivos/diferencias, comandos y resultados exactos, contrato final, limitaciones, pendientes de PostgreSQL, restauración y guía de continuidad para AI Studio. No declarar completado si queda una ruta activa de login legado/texto plano o si no se verifica compilación. Una prueba pendiente no se reporta como aprobada.

## Entrega y continuidad entre IAs

Cada informe debe registrar base Git, rama, alcance, archivos modificados, motivo de cada cambio, comando/resultado de validación, pruebas no ejecutadas, decisiones y pendientes. Mantener CHANGELOG.md si existe y docs/TODO.md sin marcar como cerrado lo no demostrado. Guardar instrucciones del próximo hito con dependencias y criterios de aceptación. Las futuras exportaciones deben excluir secretos, node_modules y respaldos; no asumir que exportar un build sincroniza fuentes.

Para volver a AI Studio: entregar fuentes y documentos de la misma revisión, indicar base y cambios pendientes, adjuntar resultados reproducibles y ordenar leer primero AGENTS.md, este documento y el informe del último hito. Si otro agente cambió el repositorio durante el trabajo, comparar y conciliar antes de continuar; no sobrescribir automáticamente.
