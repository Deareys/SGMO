# PROJECT_STATE.md — Estado Real del Proyecto

> **Fecha de Auditoría:** Octubre 2026  
> **Sistema:** SGMO — Tequeños Costa (Sistema de Gestión y Monitoreo de Operación)  
> **Tipo de Aplicación:** PWA / SPA Full-Stack (React 19 + Vite 6 + Tailwind CSS v4 + Express Node.js Backend)

---

## 1. RESUMEN EJECUTIVO Y DIAGNÓSTICO GENERAL
El sistema **SGMO** es una plataforma integral desarrollada para gestionar la operación completa de venta ambulante de comida (tequeños) en playas de la Costa Atlántica (Santa Teresita, Mar del Tuyú, Costa del Este, Las Toninas, San Bernardo).

El modelo de negocio, las reglas operativas (despacho, combos, mermas, reposición, arqueo, comisiones por tramos, liquidación en PDF) y la experiencia de usuario de la **Terminal de Venta** están muy bien concebidos y son completamente funcionales a nivel de prototipo avanzado en un único dispositivo.

Sin embargo, tal como señaló la auditoría técnica externa, el proyecto presenta **cuello de botella arquitectónico y de seguridad**:
1. **Falta de Base de Datos Centralizada:** Toda la información operativa reside en el `localStorage` del navegador cliente mediante un servicio monolítico (`storageService.ts`). Si un vendedor vende desde su celular, los datos no viajan a una base de datos central en la nube; quedan atrapados en su navegador local.
2. **Desconexión en Vercel:** El backend en `server.ts` es un proceso Express persistente. Al desplegar en Vercel (plataforma serverless basada en funciones estáticas), el servidor Node no se ejecuta, por lo que las rutas `/api/mercadopago/*` y `/api/ai/*` devuelven 404 o el HTML estático de la SPA. La app parece funcionar porque tiene un mecanismo de *fallback contingente* que genera respuestas mock locales.
3. **Seguridad y Control de Acceso:** La autenticación se realiza mediante PIN de 4 dígitos guardado en texto plano en `localStorage`. La autorización de roles es 100% del lado del cliente (`isAuthorized(tab)`).

---

## 2. ARQUITECTURA DETECTADA

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
|  [StorageService (storageService.ts)]  <--->  [localStorage del Browser]|
|   (Maneja el estado reactivo, mockData inicial y persistencia local)    |
|                                                                         |
|  [aiValidationService.ts]                                               |
|   (Cliente fetch hacia /api/* con fallbacks simulados si no hay red)    |
+-------------------------------------------------------------------------+
                                    |
                    (Llamadas HTTP a /api/*)
                                    v
+-------------------------------------------------------------------------+
|                      SERVIDOR BACKEND (server.ts)                       |
|                   Express 4.21 en Node.js (Puerto 3000)                 |
|                                                                         |
|  [Endpoints de Integración]                                             |
|   - POST /api/ai/validate-voucher      --> Google Gemini 2.4 (OCR)      |
|   - POST /api/ai/recommend-stock       --> Google Gemini 2.4 (Predictivo)|
|   - GET  /api/mercadopago/status       --> Consulta credenciales MP     |
|   - POST /api/mercadopago/create-pref  --> Crea preferencia Checkout Pro|
|   - POST /api/mercadopago/verify-pay   --> Consulta API v1/payments     |
|   - POST /api/mercadopago/webhook      --> Receptor IPN de eventos MP   |
|                                                                         |
|  [Persistencia en Servidor]                                             |
|   - NINGUNA BASE DE DATOS CONECTADA.                                    |
|   - Webhooks se guardan en un array volátil en memoria RAM.             |
|   - No hay almacenamiento de ventas, usuarios ni stock en servidor.     |
+-------------------------------------------------------------------------+
```

---

## 3. FUNCIONALIDADES CONFIRMADAS (100% OPERATIVAS EN CÓDIGO)

| Módulo / Funcionalidad | Estado | Implementación Confirmada |
| :--- | :--- | :--- |
| **Terminal de Ventas Móvil** | Completa | Flujo ágil en 4 pestañas: Pedido con combos (`unidad`, `combo3`, `combo6`, `combo12`), Variedad con stock visible en carrito, Playa/Bajada, Métodos de pago (Efectivo, MP, Transferencia con Alias y QR), Botón gigante táctil. |
| **Diseño Solar de Alto Contraste** | Completa | Paleta clara (`bg-white`, `bg-slate-50`, texto `text-slate-950`, bordes gruesos) para operar bajo el sol sin reflejos. |
| **Arqueo y Cierre de Jornada** | Completa | Conteo de sobrantes devueltos a base, cálculo de faltantes/sobrantes de mercadería y efectivo, registro de mermas y gas final. |
| **Cálculo Progresivo de Comisiones** | Completa | Tramos configurables por el Administrador (ej: <=$110k: 10%, $110k-$220k: 20%, >$220k: 30%). Cálculo automático con incentivo de próximo escalafón. |
| **Generación de Liquidación en PDF** | Completa | Generación autónoma mediante `jspdf` con membrete oficial, desglose de comisiones, deducción por vivienda ($8.000/día), descuento por tequeños faltantes y firmas. |
| **Laboratorio de Pruebas de MP** | Completa | Modal con 4 pestañas: Generador de comprobantes HD en Canvas, Link Sandbox oficial, Consulta de pagos recientes y Guía de errores CVU. |
| **Radar de Playas y Clima** | Completa | Registro y visualización en tiempo real de condiciones de marea, afluencia turística e incidencias de compañeros. |
| **Gestión de Fábrica y Lotes** | Completa | Recetas, órdenes de producción, materias primas, proveedores y control de mermas en cocina. |
| **Mantenimiento de Carritos** | Completa | Control de estado de garrafas de gas, insumos (conos, servilletas, salsas) y reporte de averías mecánicas. |
| **Exportación / Reinicio de Datos** | Completa | Función de reseteo a datos de fábrica (`resetToFactorySeed`) y persistencia local inmediata. |

---

## 4. FUNCIONALIDADES PARCIALMENTE IMPLEMENTADAS O CON LIMITACIONES TÉCNICAS

| Funcionalidad | Limitación Actual | Causa Raíz |
| :--- | :--- | :--- |
| **Verificación Real de Mercado Pago** | Parcial | Funciona si el servidor `server.ts` se corre con un token válido (`MERCADOPAGO_ACCESS_TOKEN`). En Vercel o sin servidor, cae en simulación local. |
| **Validación OCR con Gemini** | Parcial | El endpoint `/api/ai/validate-voucher` analiza la imagen con Gemini. Si el servidor no corre o no hay API key, simula lectura local con éxito garantizado. |
| **Sincronización Multi-Dispositivo** | Incompleta | No existe replicación entre dispositivos. Cada celular o computadora mantiene su propio `localStorage`. |
| **Webhooks de Mercado Pago** | Parcial | El endpoint existe en Express, pero los eventos se almacenan en un array volátil en memoria (`receivedWebhooks = []`), perdiéndose al reiniciar el servidor. |
| **Cola Offline** | Parcial | Existe la clave `SGMO_OFFLINE_SALES_QUEUE`, pero el proceso de vaciado/sincronización contra un servidor central no está implementado al no haber API de sincronización en `server.ts`. |

---

## 5. ÁREAS CRÍTICAS IDENTIFICADAS

1. **Integridad de Stock de Tequeños:**
   - La fórmula de balance es: `Diferencia = (Entregados + Repuestos) - Vendidos - Devueltos - Mermas`.
   - Cualquier alteración en `storageService.ts` impacta en deducciones monetarias directas al sueldo del vendedor ($1.500 por tequeño faltante).
2. **Cálculo de Liquidación del Vendedor:**
   - Afecta la remuneración real del personal.
   - Fórmula: `Cobro Final = Comisión Bruta - Deducción Vivienda - Deducción Faltantes + Incentivos`.
3. **Doble Gasto / Fraude con Comprobantes:**
   - El sistema valida si `existingOperationIds` ya incluye el número de comprobante.
   - Si se borra la memoria del navegador o no se consulta una base de datos centralizada, dos vendedores distintos podrían aceptar el mismo comprobante transferido sin darse cuenta.

---

## 6. PROBLEMAS CONOCIDOS (INSPECCIÓN TÉCNICA)

1. **Despliegue en Vercel:**
   - El archivo `package.json` define `"dev": "tsx server.ts"`, pero para Vercel no hay un archivo `vercel.json` que redirija `/api/*` a Serverless Functions.
   - Al desplegar en Vercel, `/api/*` no responde, activando los fallbacks simulados del cliente.
2. **Seguridad de PINs:**
   - Los PINs residen en `this.state.users` dentro de `localStorage`.
   - No hay hashing (bcrypt/argon2), ni tokens JWT, ni cookies `HttpOnly`.
3. **Dependencia de un Solo Archivo Monolítico:**
   - `src/services/storageService.ts` tiene más de 1.800 líneas y concentra todas las entidades del negocio, dificultando el mantenimiento concurrente por varias IAs.

---

## 7. ASPECTOS PENDIENTES DE CONFIRMACIÓN CON EL CLIENTE
- `[PENDIENTE DE CONFIRMACIÓN]` ¿Se utilizará una base de datos en la nube (ej. PostgreSQL / Cloud SQL o Firebase Firestore) para centralizar los carritos y computadoras de los coordinadores en tiempo real?
- `[PENDIENTE DE CONFIRMACIÓN]` ¿Dónde se hospedará definitivamente el backend en producción? (¿Vercel con Serverless Functions, o un contenedor en Cloud Run / Railway / VPS con Node.js persistente para soportar Webhooks y Express?).
- `[PENDIENTE DE CONFIRMACIÓN]` Cuenta productiva de Mercado Pago: ¿Se cuenta con credenciales `APP_USR-` de una cuenta de empresa verificada en Argentina para recibir pagos reales en temporada?
