# Prioridad de entrega — 29/10/2026

- [x] Base production respaldada, inicializada sin personas/ventas demo, once migraciones y rol de app sin DDL.
- [x] Usuarios/casas/carritos/montos centrales; porcentajes legibles y nuevos perfiles con comisión configurada; archivados ocultos y sesiones revocadas.
- [x] Recuperación y archivo idempotente de datos del navegador; incorporación explícita de catálogo y configuración con errores parciales visibles. El historial financiero anterior se conserva como evidencia y no se presenta como verificado.
- [x] Documentos agrupados bajo docs, enlaces relativos verificados y un registro activo de continuidad.
- [x] Código funcional f5395f1 publicado en main y dominio habitual verificado contra Production; evidencia, CI y alcance en CONTINUIDAD_HITOS.md.
- [ ] Dueño activa cuenta privada; recibir datos que sigan sólo en navegadores o archivos mayores de 3,5 MB; revisar historial previo antes de incorporarlo a operaciones.
- [ ] Confirmar datos reales (catálogo, stock físico, montos, cuentas), aceptación del dueño en teléfonos y proveedores reales.
- [ ] Centralizar los módulos heredados de fábrica/gastos/mantenimiento/radar y PWA completa. Aviso visible en vistas locales; no certificarlas como compartidas.
- [ ] Evitar actualizaciones concurrentes de configuración con control de versión/ETag. Hoy se confirma cada escritura SQL y se refresca, pero dos administradores guardando formularios antiguos pueden sustituir cambios del otro.

- [ ] Investigar TypeError intermitente en el ensayo de corte TCP: mismo código aprobó al reejecutar, manteniendo expectativas HTTP 503. No se atribuye causa ni se elimina cobertura.

La lista siguiente es histórica; consultar continuidad y guía para el estado vigente.

---

# TODO.md — Backlog Técnico y Plan de Mejoras Priorizado

> **Actualización 13/10/2026:** el contenido histórico puede describir prototipo/localStorage o contratos sustituidos. Para alcance vigente, pruebas y pendientes leer [HITOS_Y_PROMPTS_MVP.md](../historial/HITOS_Y_PROMPTS_MVP.md), [GUIA_SEBAS.md](../guia/GUIA_SEBAS.md), [CI.md](../pruebas/CI.md) y los módulos nuevos. “Implementado” no certifica producción ni datos compartidos de todas las pantallas.

## Diagnóstico vigente — 18 de octubre de 2026

**Prioridad 29/10 — Acceso/usuarios:** reparar el recorrido de alta/edición con contraseña inicial y correo único; retirar modos/teclado/enlaces del login. Ver [Hito 3.5](../historial/HITO_3_5_LOGIN_Y_USUARIOS.md). Confirmado que el dominio principal sigue en main antiguo, PR 2 sin integrar y base productiva vacía; una prueba en la rama no actualiza esa dirección. Preservar cachés antiguas hasta revisar si contienen información sin respaldo central.

Actualización 20/10: contraseñas personales, activación presencial, cambio propio y recuperación excepcional del dueño implementados en el [Hito 3.4](../historial/HITO_3_4_CONTRASENAS_Y_PRODUCCION.md). Migración 009 aplicada sólo a ensayo después de copia y comprobación de integridad. El [plan ordenado de producción](../guia/CONTRASENAS_Y_SALIDA_A_PRODUCCION.md) prevalece sobre tareas históricas de autenticación ya sustituidas. No se integró esta rama automáticamente en main.

Actions [39419629886](https://github.com/Deareys/SGMO/actions/runs/39419629886), `cf27d832…`, aprobado: 193 pruebas, 35 históricas, SQL PostgreSQL 16, nueve grupos HTTP de dos procesos y tres suites Chromium. **Pendiente operativo:** alta privada del dueño, aceptación en teléfonos, proveedores, alcance offline/local y preparación productiva. El dominio público antiguo y la base productiva vacía siguen siendo bloqueantes; no equivale a un fallo del preview reparado.

Informe inicial: [DIAGNOSTICO_GENERAL_2026_10_18.md](../historial/DIAGNOSTICO_GENERAL_2026_10_18.md). La intervención posterior autorizada repara liquidaciones y acceso; su evidencia y límites están en [HITO_3_3_LIQUIDACIONES_Y_ACCESO.md](../historial/HITO_3_3_LIQUIDACIONES_Y_ACCESO.md).

- [ ] **Alta — D-01:** preparar release de la rama reparada. Main/productivo siguen en `d291d5a`; el dominio público sirve la interfaz pero sus rutas API responden 404, no tiene variables principales Production ni tablas en la rama Neon productiva. La contingencia insegura de admin local permanece en main.
- [x] **Código — D-02:** corregidos ceros, excepción individual y exención de vivienda, comisión y tarifa cero; PDF/recibo conservan efectivo declarado cero. Regresiones SQL y PDF verifican el cierre y su snapshot inmutable. Validación de la nueva revisión en CI/deployment: ver informe del hito.
- [ ] **Alta — D-03:** el administrador real será el dueño del negocio. Formulario privado `/setup` preparado y probado con identidad efímera; falta que el dueño elija su contraseña en el entorno correcto. Sebas no necesita cuenta administrativa propia. No reactivar cuentas QA para operar.
- [ ] **Alta — D-04/05:** comprobar origen estable, webhook real y ciclo completo de Mercado Pago; revisar facturación del proyecto Gemini y repetir extracción real. MP/OCR no se reejecutaron hoy con cuentas de negocio; el último OCR real del 15/10 respondió 402.
- [ ] **Alta para playa — D-06:** Chromium comprobó ventas con la terminal ya abierta sin señal, ACK al reconectar, reintento tras respuesta perdida y pendiente conservado al cerrar pestaña y abrir con señal. La reapertura completamente sin red sigue sin cargar; faltan PWA, autenticación offline definida, imágenes durables y ensayo en teléfonos físicos.
- [ ] **Alcance — D-07:** centralizar o delimitar módulos locales de fábrica, gastos, radar, mantenimiento, traslados y temporadas; no presentarlos como registros compartidos.
- [ ] **Operación — D-08:** reducir carga inicial, revisar filtrado SQL/paginación del bootstrap, acceso administrativo a migraciones, prueba de restauración y política de diferencias de caja.

La verificación del diagnóstico inicial usó 177 pruebas; el hito posterior amplía la cobertura e instala Chromium aislado. Los resultados de cada revisión se registran en el informe correspondiente. La CI del 15/10 no se usa para certificar código posterior.


> **Sistema:** SGMO — Tequeños Costa  
> **Versión:** 0.6.0  
> **Criterio de Priorización:** Seguridad y Disponibilidad > Integridad de Datos > Experiencia de Usuario > Optimizaciones Secundarias.

---

## Seguimiento actual — 12 de octubre de 2026

- [x] Reparación local de login legado, plaintext/offline, bootstrap y fallback de sesiones: ver `HITO_1_2_1_INFORME.md`.
- [x] Pruebas HTTP, criptografía, cliente y SQL WASM reproducibles.
- [ ] Cierre de integración PostgreSQL: conexiones reales, dos procesos, carrera login/reset y caída/reinicio. WASM no demuestra distribución.
- [ ] QA de navegador real y móvil (véase BROWSER_AUTH_QA.md; descargas Chromium bloqueadas).
- [ ] Hito 1.3: bearer sigue en localStorage; implementar cookies HttpOnly, CSRF y CORS de manera completa.
- [ ] Control por origen compartido y política `trust proxy` limitada a proxies comprobados en Cloud Run. El Map es complementario por instancia.
- [ ] Revisar TLS en `connection.ts`: actualmente permite `rejectUnauthorized:false`; configurar verificación y confianza del proveedor.
- [ ] Recuperación administrativa cuando no exista ninguna sesión válida: procedimiento de infraestructura, sin reapertura pública de bootstrap.
- [ ] Hito 2.1: hidratar perfiles/estado desde PostgreSQL; no depender de IDs/nombres de semillas locales para restablecer cuentas existentes. Usar GET /api/users como fuente central actual.
- [ ] Hito 2.1: `resetToFactorySeed()` elimina ventas y cola pendiente; impedir pérdidas con respaldo/confirmación de sincronización y revocar sesión central. No cambiado en este hito.
- [ ] Hito 2.1: reanudación de sesión tras recarga offline sin inventar autenticación local.

## Prioridades vigentes de esta entrega

- **Actualización 15/10 — Hito 3.2:** base `sgmo-pruebas` respaldada e inicializada; preview accesible y arranque ESM corregido; login, permisos, venta compartida/idempotente y cierre comprobados por HTTP y SQL. Mercado Pago consulta oficial 200. OCR llega a Gemini pero devuelve 402 de facturación. Webhook del proveedor y ensayo desde teléfonos siguen pendientes. Evidencia y próximos hitos: [HITO_3_2_ENSAYO.md](../historial/HITO_3_2_ENSAYO.md); pasos: [PRUEBA_MANUAL_ENSAYO.md](../guia/PRUEBA_MANUAL_ENSAYO.md).
- [x] Código: cookies/CSRF/TLS, venta y stock centrales, cola ACK, ledger banco/webhooks, configuración, CI y packaging Vercel. Evidencia/limitaciones: [INFORME_ENTREGA_MVP.md](../historial/INFORME_ENTREGA_MVP.md).
- [x] Verificar Actions PostgreSQL/Chromium de la revisión y preview HTTPS con base aislada. Código `aec673f`, Actions `38680069628` aprobado.
- [x] Respaldar/identificar y aplicar migraciones 001–008 exclusivamente en la rama Neon de ensayo, con verificación SQL. Production no se modificó.
- [ ] Aprovisionar cuentas propias; las credenciales QA se retiraron y las semillas permanecen sin claves predeterminadas.
- [ ] Configurar precios/catálogo/alias/cuenta/stock reales y probar Mercado Pago/OCR oficial con dos dispositivos.
- [ ] Resolver fórmula de faltante de efectivo con el negocio; conservar snapshot y comprobante de liquidación reproducible.
- [ ] PWA, IndexedDB/almacenamiento de imágenes y QA de playa; actualmente sólo sesión/turno ya cargados operan con red intermitente.
- [ ] Centralizar módulos locales de fábrica/gastos/traslados/mantenimiento/radar y revisión manual; evitar usarlos como fuente compartida hasta ese hito.

La lista histórica siguiente documenta hallazgos previos, no el estado literal del código entregado.

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
- [ ] **Cierre productivo de Autenticación con Tokens de Sesión y RBAC:**
  - Endpoints `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` y `POST /api/auth/validate-credential`.
  - Sesiones opacas de 256 bits centrales; memoria solo demo explícita. Implementación y pruebas locales corregidas; falta certificar PostgreSQL real, distribución y transporte seguro del token.
- [ ] **Evitar Confusión con Fallbacks Simulados:**
  - Marcar de forma muy visible en la UI (`badge` rojo parpadeante) cuando una validación de comprobante fue simulada por falta de conexión, impidiendo que se confirme una venta como "aprobada por banco" si no hubo respuesta real de la API.

---

## 2. NIVEL 2: IMPORTANTE (Persistencia y Mercado Pago Real)

- [ ] **Provisionar Base de Datos Centralizada en la Nube:**
  - PostgreSQL ya está implementado y Sebas eligió Neon. No se conectó ni verificó el entorno remoto en esta intervención.
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
