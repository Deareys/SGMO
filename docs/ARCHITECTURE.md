# ARCHITECTURE.md — Arquitectura de Software del Sistema SGMO

> **Sistema:** SGMO — Tequeños Costa  
> **Versión:** 0.6.0  
> **Rol del Documento:** Especificación técnica integral de la arquitectura actual, cuellos de botella y arquitectura objetivo.

---

## 1. VISIÓN GENERAL

**SGMO (Sistema de Gestión y Monitoreo de Operación)** es una aplicación web concebida para administrar la producción en fábrica, despacho a carritos, venta ambulante en playas de la Costa Atlántica, control de averías, arqueo de caja y liquidación salarial con comisiones por tramos de vendedores ambulantes de tequeños.

---

## 2. ARQUITECTURA ACTUAL (AS-IS)

Actualmente, el sistema está estructurado como una **Single Page Application (SPA)** de React 19 empaquetada con Vite 6 y estilizada con Tailwind CSS v4, complementada por un **servidor backend Express 4.21** en `server.ts`.

### 2.1 Diagrama de Bloques Actual

```
+-----------------------------------------------------------------------------------+
|                            CLIENTE: BROWSER / PWA                                 |
|                                                                                   |
|  [Vistas de Negocio - React 19]                                                   |
|   ├── SellerTerminalView.tsx        (Terminal móvil de venta, tema solar claro)   |
|   ├── ReconciliationClosingView.tsx (Arqueo, diferencias, mermas, PDF jsPDF)      |
|   ├── PlanningDispatchView.tsx      (Asignación de carritos y stock matutino)     |
|   ├── FactoryProductionView.tsx     (Recetas, lotes y órdenes en cocina)          |
|   ├── FleetMaintenanceView.tsx      (Garrafas de gas, insumos y averías)          |
|   └── CostsProfitabilityView.tsx    (Costos fijos, comisiones y márgenes)         |
|                                                                                   |
|  [Capa de Estado y Persistencia Cliente]                                          |
|   └── src/services/storageService.ts (Patrón Observable Singleton)                |
|        └── Window localStorage ('SGMO_APP_STATE')                                 |
|                                                                                   |
|  [Capa de Integración Cliente]                                                    |
|   └── src/services/aiValidationService.ts                                         |
|        ├── fetch('/api/ai/validate-voucher')                                      |
|        ├── fetch('/api/mercadopago/verify-payment')                               |
|        └── Fallback Mock Local (si falla la red o el servidor)                    |
+-----------------------------------------------------------------------------------+
                                          │
                         Llamadas HTTP REST (JSON)
                                          ▼
+-----------------------------------------------------------------------------------+
|                        SERVIDOR BACKEND (server.ts)                               |
|                         Node.js + Express en Puerto 3000                           |
|                                                                                   |
|  [Endpoints de Integración Externa]                                               |
|   ├── POST /api/ai/validate-voucher    ──> Google Gemini API (@google/genai)      |
|   ├── POST /api/ai/recommend-stock     ──> Google Gemini API (Análisis clima)     |
|   ├── GET  /api/mercadopago/status     ──> Diagnóstico de credenciales MP         |
|   ├── POST /api/mercadopago/create-pref ─> SDK Mercado Pago (Checkout Pro)        |
|   ├── POST /api/mercadopago/verify-pay ──> API REST Mercado Pago (/v1/payments)   |
|   └── POST /api/mercadopago/webhook    ──> Receptor IPN Mercado Pago              |
|                                                                                   |
|  [Persistencia en Servidor]                                                       |
|   └── Array volátil en RAM: `receivedWebhooks = []`                               |
|   └── ¡NO HAY BASE DE DATOS CENTRALIZADA EN EL SERVIDOR!                          |
+-----------------------------------------------------------------------------------+
```

---

## 3. COMPONENTES Y RESPONSABILIDADES

### 3.1 Frontend (`/src`)
- **`App.tsx`:** Componente raíz que maneja el ciclo de autenticación, selección de rol, navegación superior (`NavigationHeader`) y montaje condicional de la vista activa.
- **`src/components/SellerTerminalView.tsx`:** Vista principal para vendedores en playa. Diseñada en tema solar claro de alto contraste para visibilidad bajo sol directo. Dividida en 4 submódulos:
  1. *Ventas:* Selector rápido de combos, variedad, sector costero y botón táctil gigante.
  2. *Resumen:* Balance en tiempo real, desglose de comisiones, arqueo de stock en carrito.
  3. *Radar:* Condiciones climáticas, afluencia y avisos operativos.
  4. *Comprobantes:* Galería de vouchers procesados.
- **`src/components/ReconciliationClosingView.tsx`:** Panel del coordinador para el arqueo vespertino. Compara unidades vendidas contra sobrantes devueltos, calcula mermas y genera el PDF de liquidación.
- **`src/components/PlanningDispatchView.tsx`:** Entrega inicial de carritos a los vendedores antes de salir a la playa.
- **`src/components/FactoryProductionView.tsx`:** Control de masa, queso y armado en la fábrica central.
- **`src/components/FleetMaintenanceView.tsx`:** Taller de carritos, pesaje de garrafas de gas y repuestos.
- **`src/components/CostsProfitabilityView.tsx`:** Configuración de precios, comisiones escalonadas y costos fijos.

### 3.2 Capa de Almacenamiento (`src/services/storageService.ts`)
- Implementa una arquitectura reactiva mediante el patrón Observer (`listeners: Set<() => void>`).
- Todas las operaciones CRUD (`recordSale`, `closeShift`, `recordWaste`, `updateProductPrice`, etc.) modifican un objeto monolítico en memoria y lo serializan en `localStorage.getItem('SGMO_APP_STATE')`.

### 3.3 Backend (`server.ts`)
- Configurado como servidor Express con middleware `cors()` y `express.json({ limit: '15mb' })`.
- En entorno de desarrollo (`NODE_ENV !== 'production'`), monta los middlewares de Vite (`vite.middlewares`).
- En entorno de producción, sirve los estáticos de `dist/`.
- Aloja los proxies seguros hacia las APIs de Google Gemini y Mercado Pago evitando exponer `GEMINI_API_KEY` y `MERCADOPAGO_ACCESS_TOKEN` en el bundle del navegador.

---

## 4. ANÁLISIS DE CUELLOS DE BOTELLA Y FALLAS DE ARQUITECTURA

### 4.1 Inexistencia de Base de Datos Compartida
- **Problema:** Toda la base de datos reside en el `localStorage` del dispositivo local.
- **Consecuencia Operativa:** Si el Vendedor A registra una venta en su teléfono celular, el Coordinador en la base central no puede verla en su computadora, porque no viaja a una base de datos centralizada. Cada dispositivo es una "isla" aislada.
- **Consecuencia de Datos:** Si el vendedor limpia el historial del navegador o borra datos del sitio, pierde todo el registro del día y su historial de ventas.

### 4.2 Desconexión en Vercel (Por qué falla en producción)
- **Problema:** En el archivo `package.json`, el comando de ejecución es `tsx server.ts`. Vercel es una plataforma de hosting estático orientada a funciones Serverless (`/api/*.ts` individuales). Al hacer deploy directo en Vercel sin archivo `vercel.json` ni migración de rutas a Serverless Functions:
  1. El servidor `server.ts` **nunca se inicia**.
  2. Las rutas `/api/mercadopago/*` y `/api/ai/*` devuelven error 404 o retornan el `index.html` estático de la SPA.
  3. El frontend activa su mecanismo de contingencia (`aiValidationService.ts`), haciendo creer al usuario que la app "funciona", pero en realidad está simulando respuestas mock de forma local.

### 4.3 Almacenamiento en Memoria de Webhooks de Mercado Pago
- **Problema:** En `server.ts`, los webhooks de pago se guardan en la variable:
  ```typescript
  const receivedWebhooks: any[] = [];
  ```
- **Consecuencia:** Ante cualquier reinicio del servidor o escalado de instancias, los eventos de pago recibidos se pierden permanentemente.

### 4.4 Autenticación y Autorización Client-Side
- **Problema:** Los usuarios y sus PINs residen en texto plano en `localStorage.getItem('SGMO_APP_STATE')`.
- **Consecuencia:** Cualquier usuario con acceso a las DevTools del navegador puede inspeccionar los PINs de todos los coordinadores y administradores, o cambiar su propio rol en tiempo de ejecución a `admin` modificando la variable de estado.

---

## 5. ARQUITECTURA OBJETIVO (TO-BE)

Para evolucionar este prototipo a un sistema empresarial de alta disponibilidad para la temporada de verano:

```
+─────────────────────────────────────────────────────────────+
|                     CLIENTES (PWA)                          |
|   Vendedores (Móvil)   |   Coordinador / Admin (Desktop)    |
+──────────────────────────────┬──────────────────────────────+
                               │ HTTPS / WSS
                               ▼
+─────────────────────────────────────────────────────────────+
|                    GATEWAY / API SERVER                     |
|         Node.js Express / NestJS o Vercel Serverless        |
|                                                             |
|  - Autenticación con JWT / Refresh Tokens en HttpOnly       |
|  - Validación de Esquemas con Zod / Joi                     |
|  - Control de Acceso Basado en Roles (RBAC en Servidor)     |
|  - Endpoints Mercado Pago (Checkout Pro + IPN Webhooks)     |
|  - Integración Gemini 2.4 (OCR + Visión Computacional)      |
+──────────────┬──────────────────────────────┬───────────────+
               │                              │
               ▼                              ▼
+──────────────────────────────+ +────────────────────────────+
|   BASE DE DATOS RELACIONAL   | |    COLA Y CACHÉ (REDIS)    |
|   PostgreSQL / Cloud SQL     | |  - Cola de eventos IPN MP  |
|  - Tablas transaccionales    | |  - Verificación duplicados |
|  - Constraints de integridad | |  - Rate limiting           |
+──────────────────────────────+ +────────────────────────────+
```

### 5.1 Fases Recomendadas de Migración
1. **Fase 1 (Inmediata):** Configurar `vercel.json` o desplegar en contenedor (Google Cloud Run / Railway / Render) para que `server.ts` se ejecute 24/7 y las rutas `/api/*` respondan con credenciales de entorno.
2. **Fase 2 (Corto Plazo):** Provisionar Base de Datos relacional en la nube (PostgreSQL con Drizzle ORM o Cloud SQL) para centralizar ventas, stock y arqueos.
3. **Fase 3 (Medio Plazo):** Reemplazar autenticación mock por Auth segura con JWT y contraseñas hasheadas (bcrypt).
4. **Fase 4 (Operación Playa):** Implementar sincronización robusta offline con IndexedDB + cola de salida (Outbox Pattern) y resolución de conflictos por timestamp.

---

## 6. IMPLEMENTACIÓN: ARQUITECTURA HEXAGONAL (MONOLITO MODULAR)

A partir de la versión 0.7.0, el proyecto adopta la **Arquitectura Hexagonal (Puertos y Adaptadores)** estructurada como un **Monolito Modular**:

```
src/
├── core/                               <─── EL HEXÁGONO (NÚCLEO PURO E INDEPENDIENTE)
│   ├── domain/                         # Entidades, tipos y reglas matemáticas puras
│   │   ├── types.ts                    # Re-exporta los tipos centrales del dominio
│   │   ├── commissionRules.ts          # Fórmulas de tramos de comisión (10%, 20%, 30%)
│   │   ├── inventoryRules.ts           # Equivalencias de combos y balance físico
│   │   └── settlementRules.ts          # Liquidación final ($8000 vivienda, $1500 tequeño)
│   ├── ports/                          # Contratos e Interfaces puras (Puertos)
│   │   ├── IStorageRepository.ts       # Puerto de persistencia y estado
│   │   ├── IPaymentGateway.ts          # Puerto de cobros (Mercado Pago, Sandbox)
│   │   ├── IVoucherAnalyzer.ts         # Puerto de análisis de comprobantes OCR
│   │   ├── IPdfGenerator.ts            # Puerto de emisión de liquidaciones
│   │   └── ISoundNotifier.ts           # Puerto de sonido y háptica
│   └── use-cases/                      # Casos de uso de la aplicación
│       ├── RecordSaleUseCase.ts        # Registrar venta con validación de stock
│       ├── CalculateSettlementUseCase.ts # Liquidación analítica de jornada
│       ├── CloseShiftUseCase.ts        # Cierre operativo y emisión de PDF
│       └── ValidateVoucherUseCase.ts   # OCR y verificación de doble gasto
│
├── adapters/                           <─── LOS ADAPTADORES (INFRAESTRUCTURA Y EXTERNOS)
│   ├── persistence/
│   │   └── LocalStorageAdapter.ts      # Implementa IStorageRepository con LocalStorage
│   ├── payments/
│   │   └── MercadoPagoAdapter.ts       # Implementa IPaymentGateway hacia /api/mercadopago
│   ├── ai/
│   │   └── GeminiOcrAdapter.ts         # Implementa IVoucherAnalyzer hacia /api/ai
│   ├── pdf/
│   │   └── JsPdfAdapter.ts             # Implementa IPdfGenerator con jsPDF
│   └── notifications/
│       └── WebAudioAdapter.ts          # Implementa ISoundNotifier con Web Audio y vibración
│
├── presentation/                       <─── CAPA DE PRESENTACIÓN (REACT)
│   ├── components/                     # Vistas táctiles en tema solar claro
│   └── hooks/
│       └── useCore.ts                  # Hook React para acceder a Casos de Uso
│
└── container.ts                        <─── CONTENEDOR DE INYECCIÓN DE DEPENDENCIAS (IoC)
```

