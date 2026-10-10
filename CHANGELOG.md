# CHANGELOG.md — Registro Histórico de Cambios

> Todos los cambios notables en este proyecto serán documentados en este archivo.
> Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

---

## [0.9.0] - 2026-10-10 (Fase 3: Autenticación, Autorización y Seguridad del Backend)

### Añadido
- **Módulo Criptográfico y Seguridad de PIN (`src/server/auth/cryptoUtils.ts`):**
  - Implementación de `scrypt` con salt aleatorio individual para almacenamiento seguro de PINs (`hashPin`, `verifyPin`).
  - Generación de tokens opacos criptográficos de 256 bits (`generateSessionToken`, `hashToken` con SHA-256).
- **Gestión Centralizada de Sesiones (`src/server/auth/sessionManager.ts`):**
  - `SessionManager`: Emisión, validación y revocación de sesiones vinculadas a usuarios y roles.
  - Almacenamiento seguro persistente en base de datos PostgreSQL (`auth_sessions`) y en memoria segura como respaldo.
  - Expiración automática configurada en 14 horas continuas (jornada de playa).
- **Middlewares de Control de Acceso y RBAC (`src/server/auth/authMiddleware.ts`):**
  - `authenticateToken`: Extracción y validación estricta de encabezados `Authorization: Bearer <token>` y `x-auth-token`.
  - `requireRole`: Control de acceso por roles (`admin`, `coordinator`, `seller`, `factory_worker`).
- **Protección contra Ataques de Fuerza Bruta (`src/server/auth/rateLimiter.ts`):**
  - `pinRateLimiter`: Límite de 5 intentos fallidos consecutivos de PIN con bloqueo temporal de 15 minutos (HTTP 429).
- **Endpoints de Autenticación (`src/server/auth/authRoutes.ts`):**
  - `POST /api/auth/login`: Autenticación por PIN en backend con respuesta de token seguro.
  - `POST /api/auth/logout`: Revocación inmediata de sesión.
  - `GET /api/auth/me`: Consulta del perfil autenticado a partir del token de sesión.
- **Migración DDL de Seguridad (`migrations/003_auth_sessions_security.sql`):**
  - Tabla `auth_sessions` con índices de búsqueda rápida por hash de token y fecha de expiración.
  - Columnas `failed_attempts`, `locked_until`, `last_login_at` y `pin_salt` en la tabla `users`.
- **Script de Pruebas Automatizadas (`scripts/verify-auth-security.ts`):**
  - Suite de 12 pruebas de seguridad y RBAC: rechazo anónimo 401, rechazo por rol 403, emisión de token, login seller/admin, logout y revocación.

### Modificado
- `server.ts`:
  - Montado del enrutador de autenticación en `/api/auth`.
  - Protección con `authenticateToken` y `requireRole` sobre endpoints sensibles: `/api/mercadopago/recent-payments`, `/api/mercadopago/verify-payment`, `/api/mercadopago/webhooks`, `/api/ai/*`.
- `src/server/routes/dbRoutes.ts`:
  - Aplicación de autorización basada en roles para `/users`, `/shifts`, `/sales`, `/shifts/:id/close`, `/shifts/:id/waste`, `/shifts/:id/restock` y `/migrate`.
- `src/services/storageService.ts`:
  - Método `loginWithPinAsync` que autentica contra `/api/auth/login` y almacena el token de sesión.
  - Método `getAuthToken` y limpieza de tokens al ejecutar `logout()`.
  - Sincronización de token Bearer en `flushOfflineQueue()`, `createUser()` y `updateUser()`.
- `src/components/PinLoginScreen.tsx`:
  - Actualizado para consumir el flujo asíncrono seguro del backend manteniendo feedback táctil instantáneo y alto contraste solar.
- `src/adapters/persistence/HttpStorageAdapter.ts`:
  - Encabezado `Authorization: Bearer <token>` adjunto en todas las peticiones fetch a la API.

---

## [0.8.0] - 2026-10-10 (Fase 2: Arquitectura de Persistencia Central en PostgreSQL y Adaptador Híbrido)

### Añadido
- **Esquema Relacional PostgreSQL (`migrations/`):**
  - `migrations/001_initial_schema.sql`: DDL completo de 15 tablas relacionales (`users`, `operational_houses`, `selling_carts`, `product_varieties`, `daily_shifts`, `shift_stock_items`, `shift_waste_records`, `shift_restock_records`, `sales`, `commission_tiers`, `system_configs`, `operational_expenses`, `cart_incidents`, `audit_logs`, `mp_webhook_events`) con claves foráneas, restricciones de unicidad, índices y tipos exactos `NUMERIC(12, 2)` para moneda.
  - `migrations/002_seed_initial_data.sql`: Semilla inicial reproducible de casas, variedades, carritos, usuarios y tramos de comisión.
  - Tabla de control de versiones `schema_migrations`.
- **Capa de Conexión y Repositorios Backend (`src/server/db/`):**
  - `connection.ts`: Gestor de Pool `pg` con transacciones ACID (`withTransaction`), soporte SSL y reporte estricto de estado (`DATABASE CONFIGURED` vs `DATABASE NOT CONFIGURED`).
  - `migrator.ts`: Ejecutor de migraciones secuenciales de base de datos.
  - `UserRepository.ts`: Repositorio SQL para consulta y actualización de usuarios.
  - `ShiftRepository.ts`: Repositorio transaccional para apertura, despacho y cierre conciliado de jornadas.
  - `SaleRepository.ts`: Repositorio SQL con inserción individual y sincronización masiva idempotente (`syncBatch`).
  - `StockRepository.ts`: Repositorio SQL para balances de inventario, mermas y reposiciones intermedias en playa.
- **Rutas REST en Backend (`src/server/routes/dbRoutes.ts` y `server.ts`):**
  - `GET /api/db/status`: Diagnóstico de conexión y proveedor de base de datos.
  - `POST /api/db/migrate`: Ejecución de migraciones pendientes.
  - `GET/POST/PUT /api/users`: CRUD de usuarios contra PostgreSQL.
  - `GET/POST /api/shifts`, `PUT /api/shifts/:id/close`: Gestión de jornadas y cierre de turno.
  - `GET/POST /api/sales`, `POST /api/sales/sync-batch`: Registro y sincronización de ventas.
  - `POST /api/shifts/:id/waste`, `POST /api/shifts/:id/restock`: Mermas y reposiciones.
- **Adaptadores de Infraestructura (`src/adapters/persistence/`):**
  - `HttpStorageAdapter.ts`: Implementación de `IStorageRepository` que consume los endpoints REST de PostgreSQL.
  - `HybridStorageAdapter.ts`: Coordinador reactivo que combina almacenamiento local y persistencia central según conectividad sin pérdida de datos.
  - Inyección en `src/container.ts` para proveer acceso unificado.
- **Script de Verificación y Auditoría (`scripts/verify-persistence.ts`):**
  - Comprobación automática de los 10 puntos de persistencia (ventas, jornadas, stock, IDs únicos, FKs, idempotencia).
- **Documentación Técnica:**
  - `docs/DATABASE.md`: Modelo E-R, tablas, tipos, DDL, conexión y estrategia de sincronización.
  - `docs/ARCHITECTURE.md`: Diagrama de flujo hexagonal y capas desacopladas.
  - `docs/DECISIONS.md`: Registro formal de ADR-010.

### Modificado
- **Cola Offline (`src/services/storageService.ts`):**
  - `flushOfflineQueue()` ahora envía las ventas encoladas a `POST /api/sales/sync-batch`.
  - Si el servidor devuelve error o no está disponible, las ventas permanecen en la cola local sin eliminarse.
- **Variables de Entorno (`.env.example`):**
  - Documentación de la variable `DATABASE_URL` para PostgreSQL central.

---

## [0.7.2] - 2026-10-05 (Blindaje Financiero y Eliminación de Aprobaciones Simuladas)

### Modificado
- **Regla Financiera Maestra:** "Ausencia de confirmación positiva de Mercado Pago = Pago no confirmado".
- **Servicio Cliente (`aiValidationService.ts`):** Erradicación total de fallbacks que aprobaban operaciones con $\ge 6$ dígitos ante fallos de red. Retorno forzoso de `verified: false` y `status: 'pendiente_revision'`.
- **Backend Express (`server.ts`):**
  - Eliminación de la simulación heurística en `/api/mercadopago/verify-payment`: si no hay token o la API no aprueba con 200, retorna estrictamente `verified: false` y `status: 'pendiente_acreditacion'`.
  - Endpoint OCR `/api/ai/validate-voucher`: no asume aprobación bancaria (`mpApiMatched: false`, `status: 'pendiente_revision'`).
  - Endpoint legado `/api/mercadopago/verify`: devuelve `status: 'pending'`, `verified: false`.
- **Terminal de Venta (`SellerTerminalView.tsx`):** `finalValidationStatus = 'validada'` solo se concede para efectivo o si `mpVerification.verified === true && mpVerification.status === 'approved'`. Toda otra situación queda en `pendiente_revision`.
- **Arqueo y Liquidación (`ReconciliationClosingView.tsx` y `liquidationPdfGenerator.ts`):** Eliminación del fallback que reemplazaba `mpValidatedAmount` por `totalMpSales` cuando era cero.
- **Documentación (`docs/MP_INTEGRATION.md`):** Adición de la Sección 5 con la especificación del blindaje financiero.

---

## [0.7.1] - 2026-10-05 (Política Escalonada de Descuento por Merma y Faltante Injustificado)

### Añadido
- **Dominio Puro (`settlementRules.ts`):** Función de cálculo `calculateWasteDeduction` con soporte de umbral de tolerancia ($x$) y tarifas diferenciadas para unidades justificadas ($\le x$) y excedentes injustificados ($> x$, precio combo).
- **Configuración del Administrador (`AdminConfigView.tsx`):** Controles interactivos para fijar tolerancia en unidades ($x$), tarifa por unidad tolerada ($\le x$) y tarifa por unidad excedente injustificada ($> x$).
- **Conciliación y Cierre (`ReconciliationClosingView.tsx`):** Desglose en tiempo real y en el comprobante modal de la liquidación de merma tolerada vs. merma combo.
- **Comprobante Oficial PDF (`liquidationPdfGenerator.ts`):** Inclusión del detalle analítico de unidades toleradas y excedentes en la deducción salarial.
- **Registro ADR-009 en `/docs/DECISIONS.md` y actualización de `/docs/SALES_FLOW.md`.**

---

## [0.7.0] - 2026-10-04 (Implementación de Arquitectura Hexagonal y Monolito Modular)

### Añadido
- **Núcleo Hexagonal (`src/core/`):**
  - **Dominio Puro (`src/core/domain/`):** Aislamiento de fórmulas matemáticas de comisiones escalonadas (`commissionRules.ts`), balance físico de stock (`inventoryRules.ts`), y liquidación de jornada con penalizaciones de vivienda y faltantes (`settlementRules.ts`).
  - **Puertos de Abstracción (`src/core/ports/`):** Interfaces puras para `IStorageRepository`, `IPaymentGateway`, `IVoucherAnalyzer`, `IPdfGenerator` e `ISoundNotifier`.
  - **Casos de Uso de Aplicación (`src/core/use-cases/`):** `RecordSaleUseCase`, `CalculateSettlementUseCase`, `CloseShiftUseCase` y `ValidateVoucherUseCase`.
- **Adaptadores de Infraestructura (`src/adapters/`):**
  - `LocalStorageAdapter`: Implementación desacoplada del puerto `IStorageRepository`.
  - `MercadoPagoAdapter`: Implementación del puerto `IPaymentGateway` hacia el backend.
  - `GeminiOcrAdapter`: Implementación del puerto `IVoucherAnalyzer` con validación de doble gasto.
  - `JsPdfAdapter`: Implementación del puerto `IPdfGenerator`.
  - `WebAudioAdapter`: Implementación del puerto `ISoundNotifier` con Web Audio y vibración háptica.
- **Contenedor de Inyección de Dependencias (`src/container.ts`):** Registro unificado para instanciar puertos y casos de uso.
- **Capa de Presentación Modular (`src/presentation/`):** Hook `useCore` para integración fluida con React preservando total retrocompatibilidad con las vistas existentes.

---

## [0.6.0] - 2026-10-04 (Auditoría Técnica y Gobernanza de Arquitectura)

### Añadido
- **Marco de Gobernanza para Agentes (`AGENTS.md`):** 20 reglas maestras para el trabajo colaborativo entre IAs y desarrolladores, prohibiendo refactorizaciones destructivas y protegiendo las reglas de negocio críticas.
- **Estado Real del Proyecto (`PROJECT_STATE.md`):** Mapa técnico exhaustivo con diagnóstico de arquitectura, áreas críticas y diagnóstico de fallas en Vercel.
- **Documentación de Arquitectura (`/docs/ARCHITECTURE.md`):** Análisis detallado de la arquitectura cliente-servidor actual, cuellos de botella y hoja de ruta de evolución.
- **Documentación de Base de Datos (`/docs/DATABASE.md`):** Esquemas completos de datos, relaciones de entidades y plan de migración desde `localStorage` hacia base de datos relacional/cloud.
- **Registro de Decisiones Arquitectónicas (`/docs/DECISIONS.md`):** Registro formal de decisiones técnicas tomadas, justificadas y pendientes de confirmación.
- **Guía de Integración Mercado Pago (`/docs/MP_INTEGRATION.md`):** Diagnóstico profundo de por qué falla en Vercel, Sandbox vs. Producción, webhooks y flujo de cobro con OCR.
- **Flujo de Ventas y Liquidación (`/docs/SALES_FLOW.md`):** Mapeo minucioso de la cadena de valor: Venta -> Carrito -> Arqueo -> Comisión escalonada -> Deducciones -> PDF.
- **Roles y Permisos (`/docs/ROLES_AND_PERMISSIONS.md`):** Especificación de matrices de acceso por rol y plan de securización con tokens.
- **Plan de Trabajo Priorizado (`/docs/TODO.md`):** Tareas clasificadas en Crítico, Importante, Mejoras y Futuro sin especulaciones.

---

## [0.5.0] - 2026-09-28 (Rediseño Solar de Alto Contraste para Playa)

### Añadido
- **Tema Solar de Alto Contraste en Terminal Móvil:** Reemplazo de fondos oscuros (`bg-slate-900`) por fondos claros (`bg-white` y `bg-slate-50`) con bordes gruesos y tipografía profunda (`text-slate-950`) para eliminar el reflejo solar en la orilla de la playa.
- **Arquitectura de 4 Pestañas en `SellerTerminalView`:**
  1. *Venta Rápida:* Selector ágil de combos, variedad, sector de playa, medio de pago y botón gigante de cobro.
  2. *Resumen & Caja:* Balance en tiempo real (Efectivo vs. MP/Transferencia), cálculo de comisión y control de inventario en carrito.
  3. *Radar Playas & Avisos:* Reporte colaborativo de mareas, afluencia y alertas de avería/insumos.
  4. *Mis Comprobantes:* Galería de comprobantes escaneados en la jornada con visor ampliado.
- **Actualización de Modales Operativos:** Modales de Merma, Cierre de Jornada, Autodespacho y Laboratorio de Pruebas migrados al tema solar de alto contraste.

---

## [0.4.0] - 2026-09-27 (Tramos de Comisión Progresiva y Liquidación PDF)

### Añadido
- **Módulo de Tramos de Comisión Configurables (`CommissionTier`):** Sistema escalonado dinámico administrable (ej: hasta $110.000 -> 10%, $110.000 a $220.000 -> 20%, más de $220.000 -> 30%).
- **Cálculo de Incentivo:** Indicador visual en terminal que muestra el dinero restante para alcanzar el siguiente tramo de recompensa.
- **Generador de Liquidaciones Oficiales en PDF (`liquidationPdfGenerator.ts`):** Emisión autónoma en el cliente mediante `jspdf`, inmutable con datos históricos del turno, deducción fija de vivienda ($8.000/día), descuento por mercadería faltante y firma de coordinación.
- **Laboratorio de Pruebas de Mercado Pago (`MercadoPagoTestLabModal.tsx`):** Generador de comprobantes oficiales en Canvas HD, checkout sandbox directo y diagnóstico de conectividad con la API.

---

## [0.3.0] - 2026-09-26 (Servidor Express e Integraciones Backend)

### Añadido
- **Servidor Express Full-Stack (`server.ts`):** Proxy backend en puerto 3000 para proteger llamadas a APIs externas.
- **Integración con Google Gemini 2.4:**
  - `/api/ai/validate-voucher`: Extracción OCR estructurada de números de operación, importes y fechas con análisis heurístico de anomalías visuales.
  - `/api/ai/recommend-stock`: Asesor predictivo de stock para coordinadores según clima y afluencia.
- **Endpoints de Mercado Pago en Servidor:**
  - Verificación segura con API oficial (`/api/mercadopago/verify-payment`).
  - Creación de preferencias de pago Checkout Pro (`/api/mercadopago/create-preference`).
  - Receptor inicial de Webhooks IPN (`/api/mercadopago/webhook`).

---

## [0.2.0] - 2026-09-25 (Módulos de Gestión ERP)

### Añadido
- **Gestión de Fábrica y Lotes (`FactoryProductionView.tsx`):** Recetas de producción, control de materias primas e incidencias de maquinaria.
- **Mantenimiento de Flota de Carritos (`FleetMaintenanceView.tsx`):** Control de nivel de gas en garrafas, descartables y reportes de desperfectos mecánicos.
- **Planificación y Despacho (`PlanningDispatchView.tsx`):** Asignación de carritos y entrega de stock inicial a vendedores.
- **Costos y Rentabilidad (`CostsProfitabilityView.tsx`):** Seguimiento de gastos operativos, costos fijos diarios y márgenes brutos.

---

## [0.1.0] - 2026-09-20 (Prototipo Inicial SGMO)

### Añadido
- Estructura base de React 19 + TypeScript + Vite + Tailwind CSS.
- Servicio de almacenamiento local reactivo (`storageService.ts`) en `localStorage`.
- Datos iniciales simulados (`mockData.ts`) con bases operativas, carritos, variedades y usuarios.
- Inicio de sesión rápido mediante PIN de 4 dígitos (`PinLoginScreen.tsx`).
