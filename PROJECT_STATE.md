# PROJECT_STATE.md — Estado Real del Proyecto

> **Fecha de Actualización:** Octubre 2026 (Fase 3 de Remediación Completada)  
> **Sistema:** SGMO — Tequeños Costa (Sistema de Gestión y Monitoreo de Operación)  
> **Tipo de Aplicación:** PWA / SPA Full-Stack (React 19 + Vite 6 + Tailwind CSS v4 + Express Node.js Backend + PostgreSQL Driver + Auth & RBAC)

---

## 1. RESUMEN EJECUTIVO Y DIAGNÓSTICO GENERAL
El sistema **SGMO** es una plataforma integral desarrollada para gestionar la operación completa de venta ambulante de comida (tequeños) en playas de la Costa Atlántica (Santa Teresita, Mar del Tuyú, Costa del Este, Las Toninas, San Bernardo).

El proyecto ha completado exitosamente:
1. **Fase 1: Blindaje Financiero de Mercado Pago:** Erradicación total de cualquier aprobación simulada o heurística. Rige la regla: *"Ausencia de confirmación positiva de Mercado Pago = Pago no confirmado"*.
2. **Fase 2: Arquitectura de Persistencia Central en PostgreSQL:**
   - Modelado relacional estricto con `NUMERIC(12, 2)` para moneda y claves primarias/foráneas en `migrations/001_initial_schema.sql`.
   - Sistema de migraciones versionado y ejecutor reproducible (`src/server/db/migrator.ts`).
   - Módulo de base de datos con Pool `pg` y transacciones ACID (`src/server/db/connection.ts`).
   - Repositorios especializados para usuarios, jornadas, ventas y balances de stock.
   - Endpoints REST (`/api/db/*`, `/api/users`, `/api/shifts`, `/api/sales`, `/api/sales/sync-batch`).
   - Adaptadores `LocalStorageAdapter`, `HttpStorageAdapter` y `HybridStorageAdapter` bajo el puerto `IStorageRepository`.
3. **Fase 3: Autenticación, Autorización y Seguridad del Backend:**
   - Validación segura de PIN en backend (`POST /api/auth/login`) con hashing `scrypt` y salt criptográfico individual.
   - Emisión de tokens de sesión opacos de 256 bits (`SessionManager`) persistidos en tabla `auth_sessions` o memoria segura.
   - Control de tasa contra fuerza bruta (`pinRateLimiter`): 5 intentos fallidos activan bloqueo de 15 minutos.
   - Middlewares de autorización basados en roles (`authenticateToken`, `requireRole` para `admin`, `coordinator`, `seller`, `factory_worker`).
   - Blindaje de endpoints sensibles (`/api/mercadopago/recent-payments`, `/api/mercadopago/verify-payment`, `/api/ai/*`, `/api/users`, `/api/shifts`, `/api/sales`).
   - Script de verificación automatizada `scripts/verify-auth-security.ts` con 12/12 pruebas aprobadas.

---

## 2. ARQUITECTURA DETECTADA E IMPLEMENTADA

```
+-------------------------------------------------------------------------+
|                          CLIENTE (BROWSER / PWA)                        |
|                                                                         |
|  [Vistas React 19]                                                      |
|   - Terminal Venta (Mobile First, Alto Contraste Solar)                 |
|   - Cierre y Conciliación (Arqueo, Mermas, PDF jsPDF)                   |
|   - Despacho y Planificación (Stock por Carrito y Asesor IA)            |
|   - Fábrica y Producción (Recetas, Lotes, Órdenes)                      |
|   - Control de Flota y Carritos (Garrafas, Reparaciones)                |
|   - Costos y Tramos de Comisión (Configuración Admin)                   |
|                                                                         |
|  [Capa de Adaptadores de Persistencia]                                  |
|   - HybridStorageAdapter (Coordinador local/central)                    |
|   - LocalStorageAdapter (window.localStorage 'SGMO_APP_STATE')          |
|   - HttpStorageAdapter  (Cliente HTTP hacia /api/db/* y /api/sales)     |
|                                                                         |
|  [StorageService (storageService.ts)]                                   |
|   (Estado reactivo, cache local y cola offline protegida)               |
+-------------------------------------------------------------------------+
                                    |
                    (Llamadas HTTP a /api/*)
                                    v
+-------------------------------------------------------------------------+
|                      SERVIDOR BACKEND (server.ts)                       |
|                   Express 4.21 en Node.js (Puerto 3000)                 |
|                                                                         |
|  [Endpoints de Integración]                                             |
|   - POST /api/ai/validate-voucher      --> Google Gemini (OCR)          |
|   - POST /api/mercadopago/verify-pay   --> Consulta API v1/payments     |
|   - POST /api/mercadopago/webhook      --> Receptor IPN de eventos MP   |
|                                                                         |
|  [Endpoints de Persistencia Central]                                    |
|   - GET  /api/db/status                --> Diagnóstico de conexión PG   |
|   - POST /api/db/migrate               --> Ejecutor de migraciones DDL  |
|   - GET/POST /api/users                --> Gestión central de usuarios  |
|   - GET/POST /api/shifts               --> Jornadas y balance de stock  |
|   - GET/POST /api/sales                --> Ventas individuales         |
|   - POST /api/sales/sync-batch         --> Sincronización masiva        |
|                                                                         |
|  [Capa de Datos PostgreSQL (src/server/db/)]                            |
|   - Pool de conexiones pg con detección estricta de DATABASE_URL        |
|   - Transacciones ACID (withTransaction) para balance de stock          |
|   - Repositorios: UserRepository, ShiftRepository, SaleRepository       |
+-------------------------------------------------------------------------+
```

---

## 3. FUNCIONALIDADES CONFIRMADAS (100% OPERATIVAS EN CÓDIGO)

| Módulo / Funcionalidad | Estado | Implementación Confirmada |
| :--- | :--- | :--- |
| **Blindaje Financiero MP** | Completa | Cero aprobaciones heurísticas o simuladas. "Ausencia de confirmación positiva = Pago no confirmado". |
| **Terminal de Ventas Móvil** | Completa | Combos (`unidad`, `combo3`, `combo6`, `combo12`), Variedad con stock visible en carrito, Playa/Bajada, Métodos de pago. |
| **Diseño Solar de Alto Contraste** | Completa | Paleta clara (`bg-white`, `bg-slate-50`, texto `text-slate-950`, bordes gruesos) para operar bajo el sol. |
| **Arqueo y Cierre de Jornada** | Completa | Conteo de sobrantes, faltantes/sobrantes de mercadería y efectivo, registro de mermas y gas final. |
| **Cálculo Progresivo de Comisiones** | Completa | Tramos configurables por Administrador con incentivo de próximo escalafón. |
| **Generación de Liquidación en PDF** | Completa | Generación autónoma mediante `jspdf` con desglose de merma tolerada vs combo y firmas. |
| **Esquema Relacional PostgreSQL** | Completa | Modelado DDL completo en `migrations/001_initial_schema.sql` y `002_seed_initial_data.sql`. |
| **Capa de Persistencia Central** | Completa | Backend preparado para PostgreSQL con pool `pg`, repositorios transaccionales y endpoints REST. |
| **Persistencia Híbrida / Dual** | Completa | `HybridStorageAdapter` que alterna entre almacenamiento local y PostgreSQL según conectividad. |
| **Vaciado Seguro de Cola Offline** | Completa | `flushOfflineQueue()` sincroniza por lote mediante `POST /api/sales/sync-batch` sin borrar ventas locales si hay fallos. |
| **Radar de Playas y Clima** | Completa | Reportes de marea y afluencia turística. |
| **Gestión de Fábrica y Lotes** | Completa | Recetas, órdenes de producción, materias primas, proveedores. |
| **Autenticación y RBAC (Fase 3.1)** | Completa | Sesiones con Bearer token, revocación en memoria, control de acceso por rol (`admin`, `coordinator`, `seller`, `factory_worker`), aislamiento SEC-02/SEC-03. |
| **Integridad de Ventas y Precios (Fase 3.2)** | Completa | Validación en backend de catálogo, unidades de combos, precios oficiales de playa, medio de pago y rechazo atómico de lotes offline (`salesValidation.ts`). |

---

## 4. ESTADO DE LA BASE DE DATOS POSTGRESQL

- **Proveedor Detectado:** Ninguno en variables de entorno locales (requiere inyección de `DATABASE_URL`).
- **Estado Técnico:** `DATABASE NOT CONFIGURED` (reportado de forma transparente y sin conexiones ficticias).
- **Modo Operativo Actual:** La aplicación opera con persistencia local en `localStorage` mediante `HybridStorageAdapter` + `LocalStorageAdapter`.
- **Preparación:** Toda la infraestructura (esquema DDL, migraciones, repositorios, pool y endpoints) está lista para operar en cuanto se configure `DATABASE_URL`.

---

## 5. ASPECTOS PENDIENTES PARA FASES POSTERIORES
- `[FASE 3 - COMPLETADA]` Autenticación segura en backend, RBAC estricto, aislamiento de recursos e integridad económica de ventas (Fase 3.1 + Fase 3.2).
- `[FASE 4]` Offline definitivo (IndexedDB mediante Dexie.js o SQLite WASM, Service Worker y PWA instalable con manifest).
- `[FASE 5]` Despliegue en contenedor persistente (Google Cloud Run / Railway / VPS) con PostgreSQL gestionado (Cloud SQL / Neon / Supabase).
