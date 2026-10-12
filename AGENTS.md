# AGENTS.md — Reglas Maestras de Arquitectura y Colaboración entre IAs

> **IMPORTANTE PARA TODAS LAS INSTANCIAS DE IA:**
> Este documento establece las reglas obligatorias e innegociables para cualquier agente de Inteligencia Artificial o desarrollador que trabaje en este repositorio. Este sistema es un software de producción acumulativo para **SGMO — Tequeños Costa**. No debe tratarse como código descartable o experimental.

---

## 1. FUENTE DE VERDAD
1. El código y los archivos presentes en este repositorio son la **única fuente de verdad**.
2. No asumas que una conversación anterior, el prompt de un usuario o una memoria conversacional previa describe con exactitud el estado actual del código.
3. Antes de realizar cualquier cambio, debes:
   - Inspeccionar los archivos reales involucrados (`view_file` / `list_dir`).
   - Revisar la documentación en `/docs`.
   - Verificar el estado actual de Git (`git status`).
   - Consultar las decisiones arquitectónicas en `/docs/DECISIONS.md`.

---

## 2. NO ROMPER FUNCIONALIDADES EXISTENTES
1. Queda estrictamente prohibido reemplazar, reescribir o refactorizar archivos completos cuando la tarea sólo requiera una corrección o ajuste puntual.
2. Jerarquía estricta de prioridades al programar:
   1. **Seguridad e integridad de datos** (no perder ventas, no filtrar secretos, no corromper stock).
   2. **Preservar funcionalidades existentes** (no romper otros módulos o roles).
   3. **Respetar reglas de negocio** (cálculo de comisiones, arqueo de caja, stock equivalente).
   4. **Correctitud** (código sin bugs ni errores de tipos).
   5. **Mantenibilidad** (código limpio, modular y tipado).
   6. **Usabilidad** (experiencia táctil, Mobile First, alto contraste solar).
   7. **Rendimiento** (bajo consumo de batería y datos móviles en la playa).
   8. **Elegancia estética del código**.

---

## 3. CAMBIOS MÍNIMOS
1. Cada intervención debe producir **únicamente los cambios estrictamente necesarios** para satisfacer el requerimiento solicitado.
2. No aproveches una tarea específica para realizar:
   - Refactorizaciones no solicitadas.
   - Cambios de librerías o dependencias.
   - Rediseños generales de interfaz.
   - Limpieza o reordenamiento masivo de código.
3. Si detectas un error o una oportunidad de mejora ajena a la tarea en curso:
   - **NO la toques**.
   - Regístrala formalmente en `/docs/TODO.md` bajo la categoría correspondiente.

---

## 4. NOMENCLATURA
1. Emplear nombres descriptivos, semánticos y autoexplicativos que revelen la intención y responsabilidad del elemento.
2. Prohibido utilizar nombres genéricos o ambiguos como: `data`, `temp`, `item2`, `val`, `button1`, `handleThing`, `x`, `arr`.
3. Utilizar nomenclatura consistente con el dominio de negocio:
   - `SellerTerminalView`, `ReconciliationClosingView`, `CommissionTiersTab`.
   - `calculateCommissionForSales`, `verifyMercadoPagoPayment`, `recordShiftWaste`.
   - `unitsRemainingInCart`, `cashDifference`, `finalPayoutAmount`.
4. Mantener la coherencia idiomática existente en el código (tipos y comentarios de negocio en español/inglés técnico consistente).
5. No renombrar variables ni funciones existentes por preferencia estética.

---

## 5. DOCUMENTACIÓN DEL CÓDIGO
1. Todo módulo, servicio o función con lógica de negocio no trivial debe estar documentado indicando:
   - **Qué hace** y cuál es su responsabilidad.
   - **Qué parámetros recibe** y su tipado.
   - **Qué retorna**.
   - **Qué reglas de negocio aplica**.
   - **Dependencias y casos borde** contemplados (offline, fallos de API, duplicidades).
2. Los comentarios deben explicar principalmente el **POR QUÉ** se tomó una decisión o existe una excepción, no simplemente repetir lo que la línea de código ya hace.

---

## 6. REGLAS DE NEGOCIO
1. Son consideradas **lógica crítica del sistema**:
   - Venta ambulante y combos (`unidad`, `combo3`, `combo6`, `combo12`).
   - Control de inventario y unidades equivalentes en carritos.
   - Registro de mermas (`ShiftWasteRecord`) y reposiciones intermedias (`ShiftRestockRecord`).
   - Arqueo de efectivo y cálculo de diferencias en el cierre de jornada.
   - Comisiones escalonadas dinámicas (`CommissionTier`), deducciones por vivienda y faltantes.
   - Generación de comprobante inmutable de liquidación en PDF.
2. Jamás modifiques una regla de negocio sin identificar previamente:
   - La regla actual y su archivo de origen.
   - Qué componentes y reportes dependen de ella.
   - El impacto económico y operativo del cambio.

---

## 7. MERCADO PAGO
1. La integración de Mercado Pago es crítica para la facturación y auditoría contra fraudes.
2. Se debe diferenciar técnica y conceptualmente:
   - **Venta registrada**: Intención o registro local en el carrito.
   - **Comprobante recibido**: Imagen o captura de pantalla aportada por el comprador.
   - **Comprobante analizado (OCR)**: Datos extraídos mediante IA (número de operación e importe).
   - **Pago pendiente**: Pendiente de acreditación bancaria.
   - **Pago verificado en vivo**: Acreditado y consultado exitosamente en la API oficial de Mercado Pago (`status === 'approved'`).
   - **Pago no encontrado**: Operación inexistente en la cuenta receptora oficial.
   - **Pago inconsistente**: Importe o destinatario diferente al de la venta.
   - **Alerta de fraude (Doble gasto)**: Número de operación ya utilizado en una venta previa.
3. **Regla de Oro**: La extracción por OCR **no garantiza** que el dinero esté acreditado en la cuenta de Mercado Pago. La verificación contra API o webhook es un proceso independiente.

---

## 8. GEMINI / OCR
1. El modelo de IA (Gemini) se utiliza como **asistente de visión y extracción de texto estructurado**, no como autoridad financiera final.
2. Toda llamada a Gemini debe contar con:
   - Mecanismos de contingencia ante errores 503 / 429 (backoff y fallback de modelos).
   - Modo de funcionamiento sin conexión o contingencia local para que el vendedor no quede bloqueado en la playa.
3. El frontend nunca debe llamar directamente a la API de Gemini con API Keys expuestas; las llamadas deben procesarse a través del backend (`/api/ai/*`).

---

## 9. OFFLINE Y SINCRONIZACIÓN
1. La terminal de venta debe operar de manera 100% fluida en zonas de playa con señal nula o intermitente.
2. Las transacciones registradas sin conexión deben identificarse con `isOfflineCreated: true` y encolarse en `SGMO_OFFLINE_SALES_QUEUE`.
3. Nunca asumas que una operación creada offline está verificada con Mercado Pago o respaldada en un servidor central hasta que ocurra la sincronización real.
4. Preservar la unicidad de IDs (`crypto.randomUUID()` o timestamp + prefijo) para evitar colisiones en la sincronización.

---

## 10. SEGURIDAD
1. **Cero Secretos en Frontend**: Nunca ingresar tokens de acceso de Mercado Pago (`APP_USR-...`), API keys de Gemini, ni contraseñas en código cliente ni en repositorios públicos.
2. Todas las credenciales deben consumirse en variables de entorno del servidor (`process.env.MERCADOPAGO_ACCESS_TOKEN`, `process.env.GEMINI_API_KEY`).
3. **Autorización Real**: El control de acceso a operaciones sensibles (cambio de precios, edición de tramos de comisión, reseteo de base) no debe depender únicamente de ocultar botones en la UI; debe validarse en el backend.
4. **Almacenamiento Seguro**: Los PINs de usuarios no deben residir en texto plano en `localStorage` en un entorno de producción real.

---

## 11. BASE DE DATOS Y PERSISTENCIA
1. El frontend conserva una caché operativa en `localStorage`. El backend ya implementa repositorios PostgreSQL y migraciones 001–005. La conexión y las migraciones del entorno remoto no se han verificado en esta intervención; no confundir implementación local con disponibilidad productiva. La autenticación central no utiliza caché local como alternativa ante fallos.
2. Cualquier evolución hacia una base de datos real (PostgreSQL / Firestore) debe respetar los esquemas y contratos definidos en `src/types.ts`.
3. No realizar migraciones destructivas ni eliminar campos sin analizar todas sus dependencias en las vistas.

---

## 12. ARQUITECTURA
1. No cambiar el framework (React + Vite + Tailwind CSS), ni el servidor Express, ni la arquitectura modular sin autorización explícita.
2. Toda propuesta de cambio arquitectónico (por ejemplo, migrar a Vercel Serverless Functions o conectar Cloud SQL/PostgreSQL) debe documentarse previamente en `/docs/DECISIONS.md`.

---

## 13. INTERFAZ Y DISEÑO VISUAL
1. **Mobile First y Alto Contraste Solar**:
   - La aplicación la utilizan vendedores caminando por la arena bajo el sol del mediodía.
   - Fondos claros (`bg-white`, `bg-slate-50`), bordes de alto contraste (`border-2 border-slate-300`) y tipografía oscura profunda (`text-slate-950`).
   - Evitar fondos oscuros (`bg-slate-900`) en pantallas operativas de vendedores ambulantes, ya que generan reflejos cegadores con la luz solar.
2. **Touch Targets Generosos**:
   - Botones principales con altura mínima de 48px a 58px para uso cómodo con el pulgar.
   - No depender de estados `hover` (en pantallas táctiles de móviles no existe hover).
   - Utilizar elementos semánticos `<button>` con atributos de accesibilidad y estados activos claros (`active:scale-95`).

---

## 14. TEST Y VALIDACIÓN OBLIGATORIA
1. Antes de dar por finalizada cualquier tarea, es obligatorio ejecutar:
   - Verificación de tipos TypeScript (`npm run lint` / `tsc --noEmit`).
   - Compilación completa del proyecto (`npm run build` o `compile_applet`).
   - Comprobación manual de que la funcionalidad alterada no produjo regresiones en vistas relacionadas.
2. Nunca declarar que una tarea está completada si no se verificó la compilación limpia.
3. Si alguna verificación no se pudo ejecutar por límites de entorno, indicarlo explícitamente en el informe.

---

## 15. GESTIÓN DE GIT (PROHIBICIÓN ESTRICTA DE COMMIT/PUSH AUTOMÁTICO)

> **Excepción expresa autorizada por Sebas — 12 de octubre de 2026:** el modelo principal de Codex puede ejecutar `git add`, crear commits y hacer push de ramas de trabajo cuando sea necesario, sin pedir confirmación adicional ni entregar ZIP. Esta autorización prevalece sobre los puntos 1–3 de esta sección exclusivamente para esas operaciones del principal. Los auxiliares siguen sujetos a la prohibición. No amplía permisos para `reset --hard`, rebase destructivo, migraciones remotas ni despliegues. En esta entrega se usa una rama separada y PR de revisión; no se integra automáticamente en main.
1. **REGLA ABSOLUTA**: Queda terminantemente prohibido ejecutar:
   - `git add`
   - `git commit`
   - `git push`
   - `git reset --hard`
   - `git rebase`
2. No crear commits automáticos. El usuario o líder técnico revisará personalmente todos los cambios antes de decidir si se incorporan al historial.
3. Al finalizar una tarea, únicamente se debe consultar y mostrar `git status`.

---

## 16. COLABORACIÓN MULTI-AGENTE
1. Este repositorio es atendido por múltiples agentes de IA y desarrolladores humanos en diferentes sesiones.
2. Nunca asumas que eres la única IA trabajando.
3. No reviertas cambios hechos por otra IA simplemente por discrepancias de estilo si el código cumple las reglas funcionales.
4. Mantén la documentación en `/docs` actualizada en cada turno para que la siguiente IA pueda continuar el trabajo sin ambigüedades.
5. En la intervención autorizada por Sebas del 12 de octubre de 2026, solo el modelo principal de Codex puede modificar o exceptuar estas reglas. Los agentes auxiliares no pueden hacerlo ni ampliar sus permisos. Toda excepción debe registrar su motivo y alcance antes de aplicarse.

---

## 17. REVERSIBILIDAD
1. Mantener los cambios atómicos, organizados y bien delimitados.
2. Modificar únicamente los bloques de código pertinentes para facilitar la revisión diferencial (`git diff`).

---

## 18. GESTIÓN DE CAMBIOS NO SOLICITADOS
1. Si durante la inspección encuentras bugs, deuda técnica o código mejorable que no forman parte del requerimiento actual:
   - **NO los modifiques por tu cuenta**.
   - Agrégalos con descripción clara y archivo de referencia en `/docs/TODO.md`.

---

## 19. TRATAMIENTO DE LA INCERTIDUMBRE
1. **Prohibido inventar o especular**:
   - Si un comportamiento, credencial o regla no puede confirmarse inspeccionando el código real, márcala explícitamente como:
     `[PENDIENTE DE CONFIRMACIÓN]`.
2. Busca siempre en el código antes de emitir afirmaciones sobre cómo funciona el sistema.

---

## 20. PRINCIPIO GENERAL: SOFTWARE ACUMULATIVO
1. Este repositorio representa un sistema empresarial completo para una pyme real de la Costa Atlántica.
2. Cada archivo nuevo o modificado debe sumar robustez, trazabilidad y claridad.
3. Respeta siempre el trabajo previo y protege la integridad del negocio en cada línea de código.
