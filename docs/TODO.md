# TODO.md — Backlog Técnico y Plan de Mejoras Priorizado

> **Sistema:** SGMO — Tequeños Costa  
> **Versión:** 0.6.0  
> **Criterio de Priorización:** Seguridad y Disponibilidad > Integridad de Datos > Experiencia de Usuario > Optimizaciones Secundarias.

---

## 1. NIVEL 1: CRÍTICO (Seguridad y Arquitectura de Despliegue)

- [ ] **Configurar Despliegue Correcto de Backend (Vercel / Cloud Run):**
  - Resolver el fallo de ejecución de `server.ts` en producción.
  - Opciones técnicas:
    - *Opción A:* Agregar archivo `vercel.json` con `rewrites` hacia un handler Serverless Node.js.
    - *Opción B (Recomendada):* Desplegar el backend Express en Google Cloud Run o Railway para tener un proceso Node.js continuo que soporte Webhooks de Mercado Pago 24/7 sin límites de tiempo de ejecución.
- [x] **Cifrado de Credenciales y PINs (Completado en Hito 1.2):**
  - Implementado `scrypt` con salt criptográfico individual de 16 bytes para PINs de 8 dígitos de trabajadores y contraseñas (≥14 caracteres) de administradores.
  - Rechazo estricto de PINs repetitivos, secuenciales y predecibles en backend.
  - Eliminación de exposición de hashes y contraseñas en DTOs públicos de la API.
- [x] **Autenticación Segura con Tokens de Sesión y RBAC (Completado en Fase 3 y Hito 1.2):**
  - Endpoints `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` y `POST /api/auth/validate-credential`.
  - Sesiones criptográficas opacas de 256 bits almacenadas en PostgreSQL / memoria, con expiración automática y rate limiting contra fuerza bruta.
- [ ] **Evitar Confusión con Fallbacks Simulados:**
  - Marcar de forma muy visible en la UI (`badge` rojo parpadeante) cuando una validación de comprobante fue simulada por falta de conexión, impidiendo que se confirme una venta como "aprobada por banco" si no hubo respuesta real de la API.

---

## 2. NIVEL 2: IMPORTANTE (Persistencia y Mercado Pago Real)

- [ ] **Provisionar Base de Datos Centralizada en la Nube:**
  - `[PENDIENTE DE CONFIRMACIÓN]` Elegir entre PostgreSQL (Cloud SQL) o Firebase Firestore para sincronización multi-dispositivo.
  - Migrar las entidades de `src/types/index.ts` a tablas/colecciones remotas.
- [ ] **Persistencia Inmutable de Webhooks de Mercado Pago:**
  - Reemplazar el array volátil en memoria RAM (`receivedWebhooks = []`) en `server.ts` por una tabla de eventos en base de datos.
- [ ] **Verificación de Pagos con Cuenta de Producción:**
  - Reemplazar credenciales `TEST-` por credenciales productivas `APP_USR-` provistas por el cliente antes del inicio de la temporada.
  - Probar flujo de cobro con tarjeta real y cuenta de Mercado Pago real.
- [ ] **Cola de Sincronización Offline (Outbox Pattern):**
  - Implementar sincronización automática en segundo plano mediante `ServiceWorker` y `BackgroundSyncAPI` para vaciar `SGMO_OFFLINE_SALES_QUEUE` cuando regrese la señal 4G a la playa.

---

## 3. NIVEL 3: MEJORAS DE UX / UI (Usabilidad en Playa)

- [ ] **Retroalimentación Háptica (Vibración al Vender):**
  - Activar `navigator.vibrate([50, 50, 50])` al confirmar una venta en la terminal para que el vendedor sienta la confirmación física en la mano con el ruido de las olas y el bullicio de la playa.
- [ ] **Indicador de Estado de Conectividad en Tiempo Real:**
  - Mostrar un semáforo discreto en la barra superior (Verde = Conectado a Servidor, Amarillo = Modo Offline / Sin señal, Rojo = Error de sincronización).
- [ ] **Modo Ráfaga de Venta:**
  - Botón de repetición rápida para vender el mismo combo sucesivas veces cuando hay una fila de clientes frente al carrito sin volver a seleccionar la variedad.
- [ ] **Optimización del Tamaño de Imágenes de Comprobantes:**
  - Comprimir las imágenes de la cámara con Canvas a un máximo de 1024x1024px y formato WebP antes de subirlas al backend para reducir el consumo del paquete de datos móviles del vendedor.

---

## 4. NIVEL 4: FUTURO / EXTENSIBILIDAD

- [ ] **Integración con Sensores IoT de Peso en Garrafas:**
  - Telemetría bluetooth o LoRaWAN para medir el peso de la garrafa de gas del carrito y emitir alertas tempranas de reemplazo antes de que se apague el freidor en plena tarde.
- [ ] **Soporte Multi-Plaza / Multi-Temporada:**
  - Separar los datos por temporada (ej: Verano 2026/2027) y habilitar múltiples localidades costeras simultáneas con monedas o listas de precios diferenciadas.
- [ ] **Impresión Térmica Bluetooth Opcional:**
  - Conexión directa mediante Web Bluetooth API a impresoras térmicas de 58mm en el carrito para clientes que requieran ticket físico en papel.
