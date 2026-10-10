# ARCHITECTURE.md — Arquitectura de Software del Sistema SGMO

> **Sistema:** SGMO — Tequeños Costa  
> **Versión:** 0.8.0  
> **Patrón Arquitectónico:** Arquitectura Hexagonal (Puertos y Adaptadores) + Monolito Modular con Persistencia Híbrida (PostgreSQL Central + LocalStorage Offline)

---

## 1. VISIÓN GENERAL

**SGMO (Sistema de Gestión y Monitoreo de Operación)** es la plataforma operacional de **Tequeños Costa SRL**, diseñada para controlar de punta a punta la operación estival de venta ambulante de comida en las playas de la Costa Atlántica (Santa Teresita, Mar del Tuyú, Costa del Este, Las Toninas y San Bernardo).

El sistema coordina:
1. **Fábrica y Cocina:** Recetas, insumos, órdenes de producción y rendimientos.
2. **Bases Operativas:** Traslados centrales, stock en freezer y garrafas de gas.
3. **Despacho Matutino:** Asignación de carritos y entrega de stock inicial.
4. **Terminal de Venta Móvil:** Venta táctil optimizada para luz solar con combos y métodos de pago (efectivo, Mercado Pago y transferencia).
5. **Auditoría Financiera y Anti-Fraude:** Verificación de transferencias Mercado Pago con regla estricta: *"Ausencia de confirmación positiva = Pago no confirmado"*.
6. **Arqueo y Cierre de Jornada:** Conteo de sobrantes, balance físico de unidades, registro de mermas y deducciones por faltantes injustificados.
7. **Liquidación Salarial:** Comisiones escalonadas dinámicas, deducción de vivienda y emisión inmutable de comprobantes PDF.

---

## 2. ARQUITECTURA HEXAGONAL IMPLEMENTADA

El flujo de control y las dependencias respetan el principio de inversión de dependencias:

```
[ FRONTEND / PRESENTACIÓN ]
  Vistas React (SellerTerminalView, ReconciliationClosingView, AdminConfigView, etc.)
            │
            ▼
[ CASOS DE USO / DOMINIO ]
  RecordSaleUseCase, CalculateSettlementUseCase, CloseShiftUseCase, ValidateVoucherUseCase
  Fórmulas puras: commissionRules.ts, inventoryRules.ts, settlementRules.ts
            │
            ▼
[ PUERTOS DE ABSTRACCIÓN (INTERFACES) ]
  IStorageRepository, IPaymentGateway, IVoucherAnalyzer, IPdfGenerator, ISoundNotifier
            │
            ▼
[ ADAPTADORES DE INFRAESTRUCTURA ]
  ┌─────────────────────────────────────────────────────────────┐
  │ IStorageRepository:                                         │
  │   - LocalStorageAdapter (Persistencia local offline)        │
  │   - HttpStorageAdapter  (Cliente HTTP hacia PostgreSQL)     │
  │   - HybridStorageAdapter (Coordinador local/central)        │
  │ IPaymentGateway:   MercadoPagoAdapter                       │
  │ IVoucherAnalyzer:  GeminiOcrAdapter                         │
  │ IPdfGenerator:     JsPdfAdapter                             │
  │ ISoundNotifier:    WebAudioAdapter                          │
  └─────────────────────────────────────────────────────────────┘
            │
            ▼
[ BACKEND EXPRESS (server.ts) ]
  /api/health
  /api/ai/validate-voucher (Google Gemini OCR)
  /api/mercadopago/verify-payment (API Oficial de Mercado Pago)
  /api/db/status, /api/db/migrate
  /api/users, /api/shifts, /api/sales, /api/sales/sync-batch
            │
            ▼
[ ACCESO A DATOS Y REPOSITORIOS (src/server/db/) ]
  Pool de conexiones pg, withTransaction() (Transacciones ACID)
  UserRepository, ShiftRepository, SaleRepository, StockRepository
            │
            ▼
[ MOTOR RELACIONAL: POSTGRESQL ]
  Esquema formal: users, operational_houses, selling_carts, product_varieties,
  daily_shifts, shift_stock_items, shift_waste_records, sales, commission_tiers...
```

---

## 3. COMPONENTES CLAVE

### 3.1 Núcleo de Dominio (`src/core/domain/`)
- **Reglas Puras:** Fórmulas matemáticas de cálculo de comisiones progresivas (`commissionRules.ts`), balance físico de inventario (`inventoryRules.ts`) y liquidación salarial con deducciones por faltantes y vivienda (`settlementRules.ts`).
- **Independencia Total:** El dominio no importa React, ni librerías de terceros, ni detalles de red.

### 3.2 Puertos (`src/core/ports/`)
- Contratos TypeScript que definen qué operaciones requiere el sistema sin acoplarse a cómo se resuelven tecnológicamente:
  - `IStorageRepository`: Persistencia y lectura de usuarios, turnos, stock y ventas.
  - `IPaymentGateway`: Verificación oficial con pasarelas de pago.
  - `IVoucherAnalyzer`: OCR y detección de anomalías visuales en capturas de pantalla.
  - `IPdfGenerator`: Generación de liquidaciones firmadas.
  - `ISoundNotifier`: Notificaciones sonoras y vibración háptica para playa.

### 3.3 Adaptadores (`src/adapters/`)
- Implementaciones técnicas concretas.
- Para almacenamiento se cuenta con:
  - `LocalStorageAdapter`: Persistencia en `localStorage` del dispositivo.
  - `HttpStorageAdapter`: Consumo de la API REST del backend hacia PostgreSQL.
  - `HybridStorageAdapter`: Adaptador que combina ambas capas: garantiza funcionalidad cuando el dispositivo está sin red y sincroniza con PostgreSQL cuando hay conexión activa y credenciales configuradas.

### 3.4 Contenedor IoC (`src/container.ts`)
- Registra las dependencias e inyecta los adaptadores en los casos de uso.
- Permite alternar la infraestructura sin modificar los componentes visuales.

### 3.5 Backend Modular (`server.ts` + `src/server/`)
- `server.ts`: Servidor Express centralizado en puerto 3000.
- `src/server/db/connection.ts`: Pool de conexiones `pg` con transacciones ACID.
- `src/server/db/migrator.ts`: Ejecutor de migraciones secuenciales (`001_initial_schema.sql`, `002_seed_initial_data.sql`).
- `src/server/db/repositories/`: Repositorios SQL especializados por entidad.
- `src/server/routes/dbRoutes.ts`: Router REST con rutas `/api/db/*`, `/api/users`, `/api/shifts`, `/api/sales`, etc.

---

## 4. BLINDAJE FINANCIERO Y AUDITORÍA MERCADO PAGO

Se mantiene inalterable la regla financiera:
> **Ausencia de confirmación positiva de Mercado Pago = Pago no confirmado**

1. Las consultas a `/api/mercadopago/verify-payment` requieren token oficial y respuesta HTTP 200 con `status === 'approved'`.
2. Ante ausencia de token, fallas de red, timeout o errores 404/500, el backend retorna estrictamente `verified: false` y `status: 'pendiente_acreditacion'`.
3. Ningún análisis OCR ni simulación contingente puede transformar una operación en aprobada.
