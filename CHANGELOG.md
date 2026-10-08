# CHANGELOG.md — Registro Histórico de Cambios

> Todos los cambios notables en este proyecto serán documentados en este archivo.
> Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

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
