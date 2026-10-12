# ROLES_AND_PERMISSIONS.md — Roles, Permisos y Matriz de Seguridad

> **Sistema:** SGMO — Tequeños Costa  
> **Versión:** 0.6.0  
> **Enfoque:** Control de Acceso Basado en Roles (RBAC), vulnerabilidades actuales y plan de securización.

---

## Estado vigente — 12 de octubre de 2026

Las secciones de auditoría/plan anteriores describen el estado histórico y no el contrato vigente. Este se documenta en `AUTHENTICATION.md`: roles reales `admin`, `coordinator`, `seller`, `factory_worker`; sesiones opacas centrales, scrypt y RBAC en backend. No se usan JWT ni PIN4. Memoria solo demo aislada. La autorización e integridad por recurso siguen verificadas por la suite de regresión. Persistencia distribuida/cookies aún pendientes.

## 1. ROLES DEFINIDOS EN EL SISTEMA

El negocio cuenta con 4 roles operativos claramente diferenciados:

1. **Vendedor (`seller`):**
   - Personal operativo en la arena con el carrito de tequeños.
   - Utiliza exclusivamente dispositivos móviles (smartphones de gama media/baja).
   - Necesita una interfaz simple, de botones grandes, sin distracciones y legible bajo luz solar intensa.
2. **Coordinador de Base / Supervisor de Playa (`coordinator`):**
   - Encargado de despachar los carritos por la mañana, realizar reposiciones en cuatriciclo, verificar comprobantes dudosos de Mercado Pago y realizar el arqueo final con emisión de liquidación en PDF.
   - Utiliza tablet o laptop en la base operativa.
3. **Administrador General / Dueño (`admin`):**
   - Acceso irrestricto a todas las bases operativas, reportes de rentabilidad, modificación de precios de venta, configuración de tramos de comisión y gestión de usuarios.
4. **Jefe de Cocina / Producción (`kitchen`):**
   - Encargado de la fábrica central donde se amasa y fracciona la producción diaria.
   - Gestiona órdenes de producción, materias primas (harina, queso llanero, margarina), lotes de congelado y reportes de insumos.

---

## 2. MATRIZ DE PERMISOS POR VISTA Y ACCIÓN

| Módulo / Acción | Vendedor (`seller`) | Coordinador (`coordinator`) | Administrador (`admin`) | Cocina (`kitchen`) |
| :--- | :---: | :---: | :---: | :---: |
| **Terminal de Ventas Móvil** | **TOTAL** | Lectura / Auto-despacho | **TOTAL** | Sin Acceso |
| **Registrar Ventas en Carrito** | **TOTAL** | Permitido | Permitido | Sin Acceso |
| **Registrar Mermas de Turno** | **TOTAL** | Requiere Firma | Permitido | Sin Acceso |
| **Ver Resumen de Caja y Comisión Propia** | **TOTAL** | Permitido | Permitido | Sin Acceso |
| **Radar de Playas y Clima** | **TOTAL** | **TOTAL** | **TOTAL** | Lectura |
| **Despacho y Asignación de Carritos** | Sin Acceso | **TOTAL** | **TOTAL** | Sin Acceso |
| **Reposición en Playa** | Solicitar | **TOTAL** | **TOTAL** | Sin Acceso |
| **Cierre de Jornada y Arqueo** | Concurrente | **TOTAL** | **TOTAL** | Sin Acceso |
| **Emisión y Descarga de PDF de Liquidación** | Solo Lectura | **TOTAL** | **TOTAL** | Sin Acceso |
| **Fábrica y Lotes de Producción** | Sin Acceso | Lectura de Stock | **TOTAL** | **TOTAL** |
| **Mantenimiento de Carritos y Garrafas** | Reportar Avería | **TOTAL** | **TOTAL** | Sin Acceso |
| **Costos, Tramos de Comisión y Precios** | Sin Acceso | Sin Acceso | **TOTAL** | Sin Acceso |
| **Reseteo a Datos de Fábrica / Semilla** | Sin Acceso | Sin Acceso | **TOTAL** | Sin Acceso |
| **Laboratorio de Pruebas de Mercado Pago** | Solo Sandbox | **TOTAL** | **TOTAL** | Sin Acceso |

---

## 3. AUDITORÍA DE SEGURIDAD (VULNERABILIDADES DETECTADAS)

### 3.1 Autorización Client-Side Pura
- **Vulnerabilidad:** La restricción de navegación se ejecuta únicamente en `App.tsx`:
  ```typescript
  const isAuthorized = (tab: AppTab) => {
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'coordinator') return tab !== 'costs' && tab !== 'factory';
    if (currentUser.role === 'kitchen') return tab === 'factory' || tab === 'fleet';
    return tab === 'seller';
  };
  ```
- **Riesgo:** Cualquier usuario puede abrir la consola de JavaScript y ejecutar:
  ```javascript
  const state = JSON.parse(localStorage.getItem('SGMO_APP_STATE'));
  state.currentUser.role = 'admin';
  localStorage.setItem('SGMO_APP_STATE', JSON.stringify(state));
  location.reload();
  ```
  Esto le otorga inmediatamente acceso a la configuración de costos, rentabilidad y salarios.

### 3.2 Almacenamiento de PINs en Texto Plano
- **Vulnerabilidad:** Los códigos de 4 dígitos de los usuarios están almacenados en texto sin cifrar dentro del objeto `state.users`.
- **Riesgo:** Si un vendedor presta su teléfono o un tercero inspecciona el almacenamiento local, puede obtener el PIN de los coordinadores y administradores (`9999`, `2024`).

### 3.3 Ausencia de Tokens de Sesión (JWT / Sessions)
- **Vulnerabilidad:** No existen firmas criptográficas ni tokens de corta duración que expiren al cerrar sesión.
- **Riesgo:** No hay forma de invalidar la sesión de un empleado despedido de manera centralizada.

---

## 4. PLAN DE SECURIZACIÓN Y ENDURECIMIENTO (HARDENING)

1. **Autenticación Basada en Tokens:**
   - Crear endpoint en backend: `POST /api/auth/login` recibiendo `{ userId, pin }`.
   - El backend verifica el PIN contra un hash almacenado con `bcrypt.compare()`.
   - Si es válido, emite un JSON Web Token (JWT) firmado con una clave secreta (`JWT_SECRET`) o una cookie `HttpOnly` segura.
2. **Validación de Roles en Servidor:**
   - Todos los endpoints de escritura (`/api/shifts/close`, `/api/sales`, `/api/pricing`) deben validar el rol del usuario que emite la petición antes de ejecutar la acción.
3. **Auditoría de Acciones Críticas:**
   - Registrar en una tabla inmutable de log (`audit_logs`) quién modificó precios, quién autorizó mermas mayores a 10 unidades y quién generó liquidaciones salariales.
