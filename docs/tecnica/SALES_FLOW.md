# SALES_FLOW.md — Flujo Integral de Ventas, Stock, Comisiones y Liquidación

> **Sistema:** SGMO — Tequeños Costa  
> **Versión:** 0.6.0  
> **Área:** Lógica Crítica de Negocio  
> **Advertencia:** Cualquier modificación en las fórmulas de este documento altera directamente la remuneración económica de los empleados y el balance de inventario de la empresa.

---

## 1. MAPA DE LA CADENA DE VALOR OPERATIVA

La jornada comercial de un vendedor en la playa sigue un ciclo cerrado estricto de 7 etapas:

```
[1. DESPACHO MATUTINO] ──> [2. VENTA EN PLAYA] ──> [3. MERMAS Y REPOSICIONES]
         │                            │                           │
         │                            ▼                           │
         │                 [4. COBRO (EFVO / MP / CVU)]           │
         │                            │                           │
         ▼                            ▼                           ▼
[7. LIQUIDACIÓN & PDF] <── [6. CÁLCULO DE COMISIÓN] <── [5. ARQUEO Y CIERRE]
```

---

## 2. ETAPA 1: DESPACHO MATUTINO (CARGA DE STOCK EN BASE)

Antes de salir a la orilla de la playa:
1. El Coordinador asigna un **Carrito (`Cart`)** a un **Vendedor (`User`)**.
2. Se registra el nivel inicial de la garrafa de gas (`initialGasLevel`, típicamente 100%).
3. Se cargan los tequeños congelados por variedad en el inventario del carrito:
   - Ejemplo: 100 Queso Llanero, 60 Jamón y Queso, 40 Panceta y Cheddar, 40 Dulce de Guayaba y Queso. Total inicial = 240 unidades.
4. Se crea un registro de jornada abierta: `Shift.status = 'open'`.

---

## 3. ETAPA 2: VENTA AMBULANTE EN LA PLAYA

El vendedor recorre las bajadas y carpas de la playa con la **Terminal de Venta Móvil (`SellerTerminalView.tsx`)**:

### 3.1 Unidades Equivalentes y Combos
La venta no se hace únicamente por unidad individual, sino frecuentemente en combos:
- **`unidad`**: 1 tequeño equivalente.
- **`combo3`**: 3 tequeños equivalentes (descuenta 3 unidades del stock de la variedad).
- **`combo6`**: 6 tequeños equivalentes (descuenta 6 unidades del stock).
- **`combo12`**: 12 tequeños equivalentes (descuenta 12 unidades del stock).

### 3.2 Impacto Inmediato en Stock del Carrito
Al confirmar una venta de un combo de 6 unidades:
$$\text{Stock Actual} = \text{Stock Anterior} - 6$$
Si el stock de la variedad llega a 0, la terminal bloquea la venta de esa variedad para evitar vender mercadería inexistente.

---

## 4. ETAPA 3: REPOSICIONES Y MERMAS DURANTE EL TURNO

Durante las 6 u 8 horas de venta en la arena ocurren imprevistos:

### 4.1 Mermas (`ShiftWasteRecord`)
- Ocurre cuando un tequeño se rompe en el freidor, se quema, o se cae a la arena.
- El vendedor lo registra en la terminal indicando variedad, cantidad y motivo (`'quemado' | 'roto' | 'vencido' | 'caida_arena'`).
- **Regla contable:** La merma debidamente registrada y justificada **no se le cobra al vendedor**, pero se resta del stock físico disponible.

### 4.2 Reposiciones Intermedias (`ShiftRestockRecord`)
- Cuando un vendedor está vendiendo a gran ritmo y se queda sin tequeños de queso a las 15:30 hs, solicita un refuerzo.
- Un coordinador en cuatriciclo o moto le lleva 60 unidades más a la playa.
- Se registra la reposición asociada al `shiftId`.
- **Regla contable:** Aumenta las unidades entregadas bajo la custodia del vendedor:
$$\text{Total Unidades a Cargo} = \text{Stock Inicial} + \sum \text{Reposiciones}$$

---

## 5. ETAPA 4: MEDIOS DE PAGO Y RECAUDACIÓN

Cada venta se clasifica estrictamente según el canal de cobro:

1. **Efectivo (`cash`):**
   - El dinero físico queda en la riñonera del vendedor.
   - Suma al acumulador `totalCashSales`.
2. **Mercado Pago (`mercadopago`):**
   - Cobro mediante QR o link generado en la terminal.
   - Suma a `totalDigitalSales`.
3. **Transferencia Bancaria / CVU (`transfer`):**
   - El cliente transfiere al Alias oficial de la empresa (`tequenos.costa.mp`).
   - El vendedor toma fotografía del comprobante con la cámara trasera.
   - La IA Gemini extrae el número de comprobante y monto.
   - Suma a `totalTransferSales`.

---

## 6. ETAPA 5: ARQUEO DE MERCADERÍA Y CIERRE EN BASE

Al finalizar la tarde, el carrito regresa a la base central. El Coordinador realiza el conteo físico en conjunto con el vendedor:

### 6.1 Fórmula Matemática de Balance de Stock
$$\text{Total Teórico Vendido} = (\text{Stock Inicial} + \text{Reposiciones}) - \text{Stock Devuelto Físico} - \text{Mermas Registradas}$$

$$\text{Diferencia de Stock} = \text{Unidades Registradas en Sistema} - \text{Total Teórico Vendido}$$

- Si $\text{Diferencia} = 0$: Arqueo perfecto.
- Si $\text{Diferencia} < 0$: **Faltante de Tequeños / Merma Injustificada** (faltan unidades físicas que no fueron cobradas o superan la tolerancia permitida).
  - **Política Escalonada Configurable por el Administrador:**
    - Para unidades $\le x$ (tolerancia por caídas accidentales o degustación permitida): se cobra a tarifa reducida $\$xxxxx$ (ej: $\$500$ de costo o $\$0$).
    - Para unidades $> x$ (merma o faltante no justificado / regalos no autorizados): **se cobra a precio combo** $\$yyyyy$ (ej: $\$2.500$ por tequeño).
    - Desglose contable: $\text{Deducción} = (\text{Toleradas} \times \$xxxxx) + (\text{Excedentes} \times \$yyyyy)$.
- Si $\text{Diferencia} > 0$: **Sobrante de Tequeños** (se vendió más de lo registrado o hubo un error en la entrega matutina).

### 6.2 Arqueo de Caja (Efectivo)
$$\text{Efectivo Esperado en Riñonera} = \sum \text{Ventas Registradas en Efectivo}$$
$$\text{Diferencia de Caja} = \text{Efectivo Real Entregado} - \text{Efectivo Esperado}$$
- Todo faltante de efectivo se deduce íntegramente del pago final del vendedor.

---

## 7. ETAPA 6: CÁLCULO PROGRESIVO DE COMISIONES

Las comisiones no son un porcentaje plano, sino un **escalafón progresivo por tramos** diseñado para incentivar el volumen de venta diario:

### 7.1 Configuración de Tramos Predeterminada (`CommissionTier`)
| Tramo | Rango de Facturación Total Diaria | Porcentaje de Comisión |
| :--- | :--- | :--- |
| **Tramo 1 (Base)** | De $0 hasta $110.000 ARS | **10%** |
| **Tramo 2 (Medio)** | De $110.001 hasta $220.000 ARS | **20%** |
| **Tramo 3 (Estrella)** | Más de $220.000 ARS | **30%** |

### 7.2 Lógica de Cálculo
El sistema aplica el porcentaje correspondiente al volumen alcanzado sobre la facturación bruta total del día (`totalSalesAmount`):

$$\text{Comisión Bruta} = \text{Total Facturado} \times \left( \frac{\text{Porcentaje del Tramo}}{100} \right)$$

*Ejemplo:*
- Si un vendedor vende $240.000 en el día:
  - Alcanza el Tramo Estrella (30%).
  - Comisión Bruta = $240.000 \times 0.30 = \mathbf{\$72.000\text{ ARS}}$.

---

## 8. ETAPA 7: LIQUIDACIÓN FINAL Y GENERACIÓN DE PDF

La liquidación final que cobra el vendedor en mano se calcula mediante la fórmula maestra:

$$\mathbf{\text{Pago Final Vendedor}} = \text{Comisión Bruta} - \text{Deducción Vivienda} - \text{Penalización Faltantes} - \text{Faltante Efectivo}$$

Donde:
- **Deducción Fija de Vivienda:** **$8.000 ARS diarios** (costo operativo acordado por hospedaje y comodidades del personal de temporada).
- **Penalización Faltantes:** $\text{Unidades Faltantes} \times \$1.500\text{ ARS}$.
- **Faltante Efectivo:** $\max(0, \text{Efectivo Esperado} - \text{Efectivo Entregado})$.

### 8.1 Emisión del Comprobante PDF (`liquidationPdfGenerator.ts`)
Con los datos confirmados, el sistema invoca `generateLiquidationPdf(data)` mediante `jspdf`, produciendo un documento inmutable con:
1. Membrete oficial de **SGMO — Tequeños Costa**.
2. Identificador de jornada, fecha, nombre del vendedor, carrito y base.
3. Desglose analítico de ventas: Unidades por variedad, Efectivo vs. Digital.
4. Balance de mercadería: Inicial, Reposición, Merma, Devuelto, Faltante.
5. Liquidación económica: Comisión ganada, deducción de vivienda, penalizaciones y **Total Neto a Cobrar**.
6. Espacio para firma hológrafa del vendedor y del coordinador.
