# DECISIONS.md — Registro de Decisiones de Arquitectura (ADRs)

> **Sistema:** SGMO — Tequeños Costa  
> **Versión:** 0.6.0  
> **Propósito:** Registrar formalmente el historial de decisiones arquitectónicas, su contexto, sus consecuencias y la justificación de los cambios a realizar.

---

## Estado actual (12 de octubre de 2026)

ADR-013 sustituye los contratos antiguos de autenticación y sus contingencias. Los estados históricos no certifican producción. Consultar `AUTHENTICATION.md`, `HITO_1_2_1_INFORME.md` y `POSTGRES_AUTH_TESTS.md` antes de continuar.

## ÍNDICE DE DECISIONES

- [ADR-001: Persistencia Rápida en LocalStorage para Fase Prototipo](#adr-001-persistencia-rápida-en-localstorage-para-fase-prototipo)
- [ADR-002: Backend Express en Puerto 3000 como Proxy de APIs](#adr-002-backend-express-en-puerto-3000-como-proxy-de-apis)
- [ADR-003: Rediseño a Tema Solar Claro de Alto Contraste](#adr-003-rediseño-a-tema-solar-claro-de-alto-contraste)
- [ADR-004: Emisión de Comprobantes PDF en el Navegador con jsPDF](#adr-004-emisión-de-comprobantes-pdf-en-el-navegador-con-jspdf)
- [ADR-005: Fallback Mock Contingente para Validaciones Externas](#adr-005-fallback-mock-contingente-para-validaciones-externas)
- [ADR-006: Autenticación Rápida con PIN de 4 Dígitos](#adr-006-autenticación-rápida-con-pin-de-4-dígitos)
- [ADR-007: Plan de Evolución Post-Auditoría (Qué cambiaríamos ahora)](#adr-007-plan-de-evolución-post-auditoría-qué-cambiaríamos-ahora)
- [ADR-008: Adopción de Arquitectura Hexagonal (Monolito Modular)](#adr-008-adopción-de-arquitectura-hexagonal-monolito-modular)
- [ADR-009: Política Escalonada de Descuento por Merma y Faltantes Injustificados](#adr-009-política-escalonada-de-descuento-por-merma-y-faltantes-injustificados)
- [ADR-010: Persistencia Central en PostgreSQL y Estrategia de Migración Progresiva Híbrida](#adr-010-persistencia-central-en-postgresql-y-estrategia-de-migración-progresiva-híbrida)
- [ADR-011: Integridad Económica de Ventas, Precios Oficiales y Rechazo Atómico de Lotes Offline](#adr-011-integridad-económica-de-ventas-precios-oficiales-y-rechazo-atómico-de-lotes-offline)
- [ADR-012: Modernización de Autenticación, Credenciales de Administrador y PINs Seguros de 8 Dígitos](#adr-012-modernización-de-autenticación-credenciales-de-administrador-y-pins-seguros-de-8-dígitos)

---

### ADR-001: Persistencia Rápida en LocalStorage para Fase Prototipo

- **Estado:** Aceptado originalmente; **En proceso de reemplazo**.
- **Fecha:** Septiembre 2026.
- **Contexto:** En el inicio del proyecto, el objetivo principal era validar la lógica compleja de negocio en la playa: arqueo de tequeños, mermas, reposición, comisiones progresivas y despacho de carritos sin depender de un despliegue complejo de infraestructura de base de datos.
- **Decisión:** Implementar un servicio centralizado `storageService.ts` basado en `window.localStorage` con un patrón Observer para actualizar la UI reactivamente.
- **Consecuencias Positivas:**
  - Desarrollo ultrarrápido sin demoras de provisioning o migraciones.
  - La aplicación funciona instantáneamente sin conexión a internet.
  - Gran velocidad para iterar sobre el modelo de datos.
- **Consecuencias Negativas (Detectadas en Auditoría):**
  - No existe comunicación entre dispositivos: el teléfono del vendedor y la laptop del coordinador no comparten datos.
  - Riesgo crítico de pérdida de información si el usuario borra la caché del navegador.
  - Límites de almacenamiento (típicamente 5MB en navegadores móviles).
- **Decisión Futura:** Migrar a PostgreSQL en la nube con IndexedDB para almacenamiento local y sincronización asíncrona.

---

### ADR-002: Backend Express en Puerto 3000 como Proxy de APIs

- **Estado:** Aceptado.
- **Fecha:** Septiembre 2026.
- **Contexto:** Se necesitaban integrar dos servicios externos críticos: Google Gemini API (para OCR de comprobantes bancarios) y la API oficial de Mercado Pago (para cobros con Checkout Pro y verificación de transferencias). Ambas APIs requieren tokens secretos (`GEMINI_API_KEY`, `MERCADOPAGO_ACCESS_TOKEN`).
- **Decisión:** Montar un servidor Express en `server.ts` que escuche en el puerto 3000, actúe como proxy seguro para las llamadas a APIs externas y monte los middlewares de Vite en desarrollo.
- **Consecuencias Positivas:**
  - Los secretos nunca se envían al cliente ni se exponen en el bundle JavaScript.
  - Se pueden recibir webhooks en una URL centralizada (`/api/mercadopago/webhook`).
- **Consecuencias Negativas / Problemas de Despliegue:**
  - En plataformas de alojamiento Serverless como Vercel (plan estático estándar), un proceso `server.ts` continuo de Express no se ejecuta sin configuración específica de Serverless Functions (`api/*.ts` o `vercel.json` con runtime de Node.js).
  - Al desplegar en Vercel, los endpoints `/api/*` fallan con 404 o devuelven el HTML de la SPA.

---

### ADR-003: Rediseño a Tema Solar Claro de Alto Contraste

- **Estado:** Aceptado.
- **Fecha:** Septiembre 2026.
- **Contexto:** Las pruebas de campo revelaron que las interfaces oscuras (`bg-slate-900`, `bg-slate-950`) son ilegibles en la orilla de la playa al mediodía debido al resplandor del sol y los reflejos en las pantallas de los teléfonos móviles.
- **Decisión:** Rediseñar la Terminal de Ventas y todos los modales hacia un **Tema Solar de Alto Contraste**: fondos blancos y crema suave (`bg-white`, `bg-slate-50`), bordes reforzados (`border-2 border-slate-300`), tipografía negra profunda (`text-slate-950`), botones de gran tamaño y contrastes de color saturados para botones de acción.
- **Consecuencias:** Excelente usabilidad en condiciones reales de playa con sol extremo; ergonomía táctil optimizada para operar con una sola mano.

---

### ADR-004: Emisión de Comprobantes PDF en el Navegador con jsPDF

- **Estado:** Aceptado.
- **Fecha:** Septiembre 2026.
- **Contexto:** Al finalizar el turno en la playa, el vendedor y el coordinador deben firmar un documento de liquidación. Dado que en la costa el servicio de internet móvil suele cortarse por saturación de antenas, no se podía depender de un servidor externo para renderizar el PDF.
- **Decisión:** Utilizar `jspdf` para generar el documento de liquidación oficial directamente en la memoria del navegador del cliente, con membrete oficial, desglose de comisiones, deducciones y espacios para firmas.
- **Consecuencias:** Generación instantánea de comprobantes de liquidación en PDF, 100% funcional incluso sin conexión a internet.

---

### ADR-005: Fallback Mock Contingente para Validaciones Externas

- **Estado:** Aceptado con advertencia de auditoría.
- **Fecha:** Septiembre 2026.
- **Contexto:** En la playa, la conectividad 4G/5G es intermitente. Si una consulta a Mercado Pago o Gemini falla por falta de señal, el vendedor no puede quedar bloqueado sin poder despachar un tequeño.
- **Decisión:** En `aiValidationService.ts`, capturar los errores de red hacia `/api/*` y retornar una respuesta mock de éxito con una advertencia `simulated: true`.
- **Consecuencias Positivas:** La aplicación no crashea ni deja congelada la pantalla del vendedor en el mostrador.
- **Consecuencias Negativas (Riesgo Financiero):** Si el vendedor o el sistema confunden una simulación contingente con un pago real verificado por la API bancaria, se pueden entregar tequeños por comprobantes falsos o inexistentes.
- **Ajuste Mandatorio:** Toda simulación debe mostrarse con una insignia roja parpadeante de "COMPROBANTE NO VERIFICADO POR BANCO (SIN CONEXIÓN)" y requerir confirmación explícita del coordinador.

---

### ADR-006: Autenticación Rápida con PIN de 4 Dígitos

- **Estado:** Aceptado para la versión actual; **Debe securizarse en backend**.
- **Fecha:** Septiembre 2026.
- **Contexto:** Los vendedores ambulantes en la arena no pueden escribir correos electrónicos largos ni contraseñas alfanuméricas complejas mientras atienden una fila de clientes.
- **Decisión:** Pantalla de teclado numérico táctil de 4 dígitos (`PinLoginScreen.tsx`).
- **Consecuencias:** Gran velocidad de inicio de turno.
- **Problema de Seguridad:** Los PINs se almacenan en texto plano en `localStorage`. Cualquier usuario que conozca las DevTools puede ver el PIN del administrador (`9999`) o del coordinador (`2024`).
- **Ajuste:** Mantener el teclado numérico en el frontend, pero enviar el PIN al backend para validación contra un hash bcrypt y emitir una sesión firmada (JWT/cookie).

---

### ADR-007: Plan de Evolución Post-Auditoría (Qué cambiaríamos ahora)

Teniendo en cuenta el informe del ingeniero auditor, las decisiones que cambiaríamos de cara a producción son:

1. **Separación Real de Capas:**
   - Desacoplar la UI de React de la persistencia directa en `localStorage`. La UI debe interactuar con una capa de Repositorios / Servicios API.
2. **Hosting Backend Adecuado:**
   - En lugar de intentar forzar un monolito Express dentro de un hosting puramente estático sin adaptar sus rutas, desplegar el backend en un contenedor Docker (Google Cloud Run / Railway) o adaptar los endpoints a la estructura Serverless de Vercel (`/api/[route].ts`).
3. **Persistencia Centralizada Multidispositivo:**
   - Migrar hacia una base de datos PostgreSQL alojada en la nube (Cloud SQL / Supabase / Neon) o Firebase Firestore, permitiendo que las ventas de los carritos se sincronicen en vivo con el panel del coordinador.
4. **Almacenamiento Persistente de Webhooks:**
   - Guardar cada notificación IPN de Mercado Pago en una tabla de auditoría en base de datos para conciliación contable automática.

---

### ADR-008: Adopción de Arquitectura Hexagonal (Monolito Modular)

- **Estado:** Aceptado e Implementado.
- **Fecha:** Octubre 2026.
- **Contexto:** Se requiere una arquitectura que garantice la inmutabilidad de las reglas de negocio (comisiones progresivas, balance de inventario y liquidaciones salariales) y permita a múltiples desarrolladores e IAs colaborar sin provocar regresiones ni romper integraciones.
- **Decisión:** Implementar la **Arquitectura Hexagonal (Puertos y Adaptadores)** estructurada como un **Monolito Modular**:
  - `src/core/domain/`: Reglas puras de negocio y tipos.
  - `src/core/ports/`: Interfaces abstractas para persistencia, pasarelas de pago, análisis OCR, emisión de PDFs y notificaciones.
  - `src/core/use-cases/`: Casos de uso de la aplicación (`RecordSaleUseCase`, `CalculateSettlementUseCase`, `CloseShiftUseCase`, `ValidateVoucherUseCase`).
  - `src/adapters/`: Implementaciones técnicas concretas para localStorage, Mercado Pago API, Gemini OCR, jsPDF y Web Audio/Haptic API.
  - `src/container.ts`: Contenedor de Inversión de Control (IoC) para cablear puertos con adaptadores.
  - `src/presentation/`: Vistas de usuario y hooks de conexión (`useCore`).
- **Consecuencias:**
  - Máximo desacoplamiento: las reglas financieras y de stock no dependen de librerías ni de React.
  - Intercambiabilidad: si se cambia de LocalStorage a PostgreSQL, solo se programa un nuevo adaptador que cumpla `IStorageRepository`.
  - Seguridad contra regresiones: futuras IAs trabajan sobre adaptadores específicos sin tocar el core.

---

### ADR-009: Política Escalonada de Descuento por Merma y Faltantes Injustificados

- **Estado:** Aceptado e Implementado.
- **Fecha:** Octubre 2026.
- **Contexto:** Se detectó la necesidad de proteger a los productores contra regalos no autorizados o mermas abusivas por parte de los vendedores ambulantes. Se requiere distinguir entre merma justificada (caídas accidentales menores, degustación permitida) y merma o faltante injustificado (que debe cobrarse al vendedor a tarifa combo).
- **Decisión:** Implementar en el Dominio (`settlementRules.ts`) y en la configuración del Administrador (`SystemConfig` / `AdminConfigView`) una regla escalonada por tramo de cantidad:
  - `wasteToleranceThreshold`: Cantidad máxima tolerada / justificada ($x$, ej: 3 tequeños).
  - `wastePenaltyRateBelowOrEqual`: Tarifa reducida o costo de reposición para unidades $\le x$ (ej: $500 o $0).
  - `wastePenaltyRateAbove`: Tarifa de penalización por unidad para excedentes $> x$ cobrados a precio combo (ej: $2.500).
- **Consecuencias:**
  - Control financiero estricto: evita que las pérdidas por mercadería regalada recaigan sobre la fábrica.
  - Flexibilidad para el Administrador: puede modificar el umbral y los valores desde el panel de control sin tocar código.
  - Trazabilidad y transparencia: el desglose de unidades toleradas vs. excedente combo se detalla en la pantalla de conciliación y en el comprobante oficial en PDF.

---

### ADR-010: Persistencia Central en PostgreSQL y Estrategia de Migración Progresiva Híbrida

- **Estado:** Aceptado e Implementado (Fase 2).
- **Fecha:** Octubre 2026.
- **Contexto:** La auditoría técnica identificó que la persistencia mono-dispositivo en `localStorage` impedía la sincronización de ventas entre los carritos de los vendedores y el panel del coordinador, exponiendo los datos a pérdidas accidentales por borrado de caché del navegador. Se requiere migrar hacia PostgreSQL sin romper la funcionalidad offline existente ni reescribir abruptamente el sistema.
- **Decisión:**
  1. Diseñar el esquema relacional completo en PostgreSQL con tipos monetarios exactos (`NUMERIC(12, 2)`), integridad referencial estricta (FKs) y tablas versionadas mediante `schema_migrations`.
  2. Implementar repositorios de backend con transacciones ACID (`withTransaction`) para turnos, stock y ventas (`UserRepository`, `ShiftRepository`, `SaleRepository`, `StockRepository`).
  3. Crear un router REST en `server.ts` (`/api/db/*`, `/api/users`, `/api/shifts`, `/api/sales`, `/api/sales/sync-batch`).
  4. Mantener `LocalStorageAdapter` intacto e introducir `HttpStorageAdapter` y `HybridStorageAdapter` implementando el mismo puerto `IStorageRepository`.
  5. Exponer el estado de conexión real (`DATABASE CONFIGURED` / `DATABASE NOT CONFIGURED`) mediante `GET /api/db/status` sin generar conexiones ni aprobaciones ficticias.
  6. Actualizar `flushOfflineQueue()` para enviar lotes de ventas a `/api/sales/sync-batch` conservando los datos en almacenamiento local ante fallos de conexión.
- **Consecuencias:**
  - Cero regresiones: la aplicación sigue funcionando de manera idéntica tanto si PostgreSQL está activo como si se opera en modo local offline.
  - Preparado para múltiples dispositivos: en cuanto se inyecte `DATABASE_URL`, el backend persiste turnos y ventas centralizadamente.
  - Datos protegidos: ninguna operación destructiva sobre `localStorage`.

---

### ADR-011: Integridad Económica de Ventas, Precios Oficiales y Rechazo Atómico de Lotes Offline

- **Estado:** Aceptado e Implementado (Fase 3.2).
- **Fecha:** Octubre 2026.
- **Contexto:** En la Fase 3.1 se implementó autenticación por sesión/token y RBAC para aislar recursos entre roles. Sin embargo, persistía la vulnerabilidad de que el backend confiaba ciegamente en los valores numéricos de `totalAmount`, `quantityUnitsEquivalent` y precios enviados por el cliente en `POST /sales` y `POST /sales/sync-batch`. Un cliente manipulado o fraudulento podía enviar importes arbitrarios (ej: $100 por un combo de $7.500) o registrar unidades inconsistentes con el tipo de combo (ej: 5 unidades en un combo de 6). Asimismo, `resolveShift()` podía consultar datos semilla de contingencia incluso si la base central PostgreSQL fallaba transitoriamente.
- **Decisión:**
  1. **Política Estricta para `resolveShift()`**:
     - Si PostgreSQL está configurado (`isDbConfigured()`), se consulta única y exclusivamente la base central (`ShiftRepository.getById()`).
     - Si la consulta a PostgreSQL arroja un error, bajo ninguna circunstancia se recurre a `INITIAL_SHIFTS`: se propaga el error y se devuelve HTTP 503 `SERVICE_UNAVAILABLE`.
     - Si la jornada no existe en PostgreSQL, se devuelve HTTP 404.
     - Los datos de contingencia (`INITIAL_SHIFTS`) se utilizan exclusivamente cuando el sistema opera en modo sin base de datos central configurada.
  2. **Validación Exhaustiva de Integridad y Precios Oficiales (`salesValidation.ts`)**:
     - Validación de tipo de ítem (`unidad`, `combo3`, `combo6`, `combo12`, `adicional`) contra catálogo.
     - Validación de congruencia de unidades equivalentes: deben ser múltiplos exactos del paquete seleccionado.
     - Verificación de existencia y estado activo de la variedad de producto en el catálogo oficial centralizado (o catálogo contingente si no hay DB).
     - Validación estricta del importe total (`totalAmount`) contra los precios oficiales autorizados para la variedad y los combos promocionales estándar de playa ($1.500 / $4.000 / $7.500 / $14.000), rechazando importes manipulados con HTTP 400 `INVALID_SALE_PRICE`.
     - Validación de medios de pago soportados (`efectivo`, `mercado_pago`, `transferencia`).
  3. **Política de Rechazo Atómico en Lotes de Sincronización Offline (`POST /sales/sync-batch`)**:
     - Antes de persistir cualquier registro del lote en base de datos, se valida la totalidad de los ítems secuencialmente.
     - Si tan solo una venta del lote contiene importes adulterados, datos incompatibles o pertenece a otro vendedor/jornada, se **rechaza el lote completo de forma atómica** devolviendo HTTP 400/403 con el índice exacto del ítem corrupto y el motivo de rechazo.
     - **Justificación de Dominio:** En un sistema de venta ambulante con arqueo y balance de caja, admitir escrituras parciales de un lote corrompido generaría desfasajes en el recuento físico de mercadería del carrito y en la recaudación de efectivo, dificultando la auditoría forense del vendedor. El rechazo atómico preserva la integridad del estado central y alerta inmediatamente sobre la inconsistencia.
- **Consecuencias:**
  - Cierre definitivo de vectores de fraude por manipulación de precios en el cliente.
  - Blindaje completo del cálculo económico en el backend sin depender de la UI de React.
  - Trazabilidad y consistencia garantizadas tanto en operaciones individuales como en sincronización de lotes offline.

---

### ADR-012: Modernización de Autenticación, Credenciales de Administrador y PINs Seguros de 8 Dígitos

- **Estado:** Aceptado e Implementado (Hito 1.2).
- **Fecha:** Octubre 2026.
- **Contexto:** En el diseño preliminar, SGMO utilizaba PINs de 4 dígitos (ej: 1111, 2222, 1234). En una operación en playa de hasta 25 personas (vendedores, coordinadores y operarios de fábrica), los PINs de 4 dígitos presentan un espacio de claves limitado (10.000 combinaciones) y riesgo de colisión o acceso no autorizado cruzado. Además, el rol de Administrador requería un nivel superior de protección con contraseñas de alta entropía.
- **Decisión:**
  1. **Cuentas Individuales con Códigos Únicos (`userCode`)**:
     - Cada usuario dispone de un código único y no ambiguo (ej: `ADM-01`, `COORD-01`, `COORD-02`, `FAB-01`, `FAB-02`, `VEND-01` a `VEND-04`).
     - Se prohíbe el uso de credenciales compartidas entre trabajadores.
  2. **Trabajadores Operativos (PIN personal de 8 dígitos)**:
     - PIN personal de exactamente 8 dígitos numéricos (100.000.000 combinaciones posibles).
     - Validación estricta en backend (`validateWorkerPin`):
       - Rechaza PINs idénticos (`00000000`, `11111111`).
       - Rechaza 4 o más dígitos consecutivos repetidos (`11119876`).
       - Rechaza secuencias aritméticas ascendentes (`01234567`, `12345678`, etc.) y descendentes (`98765432`, `87654321`, etc.).
       - Rechaza patrones duplicados o alternantes (`12121212`, `12341234`, `11223344`).
       - Rechaza lista negra de PINs comunes predecibles.
     - Almacenamiento protegido mediante función de derivación de claves `scrypt` con salt criptográfica individual de 16 bytes.
  3. **Administradores (Contraseñas de Alta Entropía)**:
     - Identificador mediante código (`ADM-01`) o correo electrónico (`carlos.admin@tequenosplaya.com`).
     - Contraseña de al menos 14 caracteres (`validateAdminPassword`) con presencia obligatoria de letras mayúsculas, minúsculas y caracteres numéricos o símbolos.
     - Almacenamiento mediante scrypt con salt criptográfica individual de 16 bytes.
  4. **Compatibilidad y Período de Transición**:
     - Se mantiene soporte retrocompatible para pruebas de transición automatizadas sin debilitar las reglas del nuevo flujo.
     - Se añade migración de base de datos `migrations/004_auth_credentials_modernization.sql` con actualización de esquema e índices.
  5. **Experiencia de Usuario en Playa (Solar High Contrast)**:
     - Pantalla de inicio de sesión con selector intuitivo entre trabajador y administrador.
     - Selector ágil de cuenta individual + visor de 8 puntos de alto contraste + teclado táctil amplio optimizado para el pulgar bajo luz solar directa.
- **Consecuencias:**
  - Elevación drástica de la seguridad y el aislamiento de cuentas operativas.
  - Cero secretos expuestos en el código del frontend.
  - Trazabilidad y auditoría infalible por cuenta individual en el backend.






### ADR-013: Autenticación central cerrada ante fallos y aprovisionamiento explícito

- **Estado:** Implementado localmente; validación de producción pendiente.
- **Fecha:** 12 de octubre de 2026.
- **Contexto:** La suite histórica aprobaba 41 casos aunque el frontend aceptaba administrador offline sin verificar contraseña, comparaba PIN en texto plano y las sesiones centrales recurrían a memoria. Bootstrap protegía solo cuentas ya provisionadas.
- **Decisión:** Trabajador `{ userCode, pin }`, administrador `{ identifier, password }`, sin aliases alternativos. Nuevas sesiones solo mediante backend. Base configurada exige persistencia y validación centrales, sin fallback. Demo explícita usa credenciales suministradas por entorno, sin PG y bind loopback. Login verifica cuenta, registra intento y emite sesión en una sola transacción con lock de tabla antes de fila. El orden común con altas/reset evita ciclos de locks con bootstrap. Este último requiere secreto siempre y se usa una sola vez para un admin activo inicial.
- **Consecuencias:** Se pierde el acceso nuevo sin red deliberadamente; la venta offline de una sesión ya activa sigue disponible. 005 exige restablecer PINs previos porque no puede deducirse su longitud desde scrypt. Los cambios de credencial/rol/inactividad revocan sesiones atómicamente. Gestión de usuarios devuelve confirmación central antes de actualizar caché. Los archivos de respaldo se excluyen de TypeScript y entregas.
- **Compatibilidad:** Sustituye ADR-006 y la transición insegura de ADR-012. No se reescribe la arquitectura ni las reglas económicas. La consolidación de handlers duplicados de login y cliente fue necesaria para cerrar todas las contingencias inseguras con un mismo contrato. El puerto `updateUser` ahora es asíncrono para propagar fallos; sus adaptadores realizan una única escritura.
- **Pendientes:** Cookies HttpOnly/CSRF/CORS (Hito 1.3), control por origen compartido y proxies confiables, PostgreSQL real/múltiples instancias, recuperación administrativa por infraestructura y reanudación offline tras recarga. No se modificó TLS de conexión en este hito: revisar `rejectUnauthorized:false` antes de producción.

### Registro de entrega — 12 de octubre de 2026

Sebas confirmó autorización permanente al modelo principal de Codex para guardar mediante commits/push cuando lo requiera el trabajo. Se exceptúa de forma explícita AGENTS sección 15 para operaciones del principal en ramas de trabajo. Los enlaces locales/ZIP no fueron accesibles al usuario; GitHub pasa a ser el canal de continuidad. Publicación comprobada de `codex/hito-1-2-1-verificacion`, código `7a855afd531ef5ab4815f0c64ece414f1c91e0b2`, y PR borrador https://github.com/Deareys/SGMO/pull/1 hacia main con las correcciones y documentación. El canal autenticado GitHub se utilizó porque la terminal no tenía credenciales para push; el resultado remoto se verificó por SHA del árbol. No se solicitan permisos repetidos para guardar esta entrega. No se realizan migraciones remotas ni integración automática en main. Studio debe importar la rama correcta: el proyecto anterior en main carece de estas reparaciones.
