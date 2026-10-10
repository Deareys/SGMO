# DECISIONS.md — Registro de Decisiones de Arquitectura (ADRs)

> **Sistema:** SGMO — Tequeños Costa  
> **Versión:** 0.6.0  
> **Propósito:** Registrar formalmente el historial de decisiones arquitectónicas, su contexto, sus consecuencias y la justificación de los cambios a realizar.

---

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



