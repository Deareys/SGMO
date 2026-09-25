/**
 * SGMO — Tequeños Costa
 * Generador de Comprobantes Oficiales de Liquidación en PDF
 * Utiliza jsPDF para emitir un documento PDF real, descargable y autónomo.
 */

import { jsPDF } from 'jspdf';
import { DailyShift } from '../types';

/**
 * Genera un nombre de archivo normalizado y limpio:
 * Formato: Liquidacion_NombreVendedor_YYYY-MM-DD.pdf
 */
export function generateLiquidationFilename(sellerName: string, date: string): string {
  const sanitizedName = (sellerName || 'Vendedor')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');

  const sanitizedDate = (date || new Date().toISOString().slice(0, 10))
    .replace(/[^a-zA-Z0-9_-]/g, '-');

  return `Liquidacion_${sanitizedName}_${sanitizedDate}.pdf`;
}

/**
 * Formatea montos en pesos argentinos ($ X.XXX)
 */
function formatCurrency(amount: number): string {
  return `$ ${Math.round(amount || 0).toLocaleString('es-AR')}`;
}

/**
 * Genera y descarga el PDF oficial de liquidación de la jornada.
 *
 * IMPORTANTE: Utiliza exclusivamente los valores almacenados en `shift`
 * garantizando la inmutabilidad histórica sin recalcular con configuraciones actuales.
 */
export function downloadLiquidationPdf(shift: DailyShift): boolean {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 14;
    const contentWidth = pageWidth - margin * 2; // 182mm

    // =========================================================================
    // COLORES DE MARCA
    // =========================================================================
    const slateDark = [15, 23, 42]; // #0f172a
    const slateHeader = [30, 41, 59]; // #1e293b
    const slateSub = [71, 85, 105]; // #475569
    const slateLightBg = [248, 250, 252]; // #f8fafc
    const slateBorder = [226, 232, 240]; // #e2e8f0
    const amberMain = [217, 119, 6]; // #d97706
    const emeraldDark = [16, 149, 106]; // #10b981
    const roseDark = [225, 29, 72]; // #e11d48

    let y = 14;

    // =========================================================================
    // 1. ENCABEZADO PRINCIPAL (BRANDING & FOLIO)
    // =========================================================================
    // Fondo decorativo del encabezado
    doc.setFillColor(slateHeader[0], slateHeader[1], slateHeader[2]);
    doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'F');

    // Banda dorada lateral
    doc.setFillColor(amberMain[0], amberMain[1], amberMain[2]);
    doc.rect(margin, y, 3, 24, 'F');

    // Título y Subtítulo
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('TEQUEÑOS COSTA — SGMO', margin + 7, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225);
    doc.text('Sistema de Gestión Marítima Operativa • Comprobante Oficial de Cierre y Liquidación', margin + 7, y + 14);
    doc.text(`Base Operativa: ${shift.houseName || 'Base Central'}`, margin + 7, y + 19);

    // Folio y Fecha a la derecha
    doc.setTextColor(245, 158, 11);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`FOLIO: ${shift.id}`, pageWidth - margin - 5, y + 8, { align: 'right' });

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Fecha Jornada: ${shift.date}`, pageWidth - margin - 5, y + 14, { align: 'right' });
    doc.text(`Horario: ${shift.startTime || '--:--'} a ${shift.endTime || 'Fin de jornada'} hs`, pageWidth - margin - 5, y + 19, { align: 'right' });

    y += 28;

    // =========================================================================
    // 2. DATOS DE IDENTIFICACIÓN DEL VENDEDOR Y OPERACIÓN
    // =========================================================================
    doc.setFillColor(slateLightBg[0], slateLightBg[1], slateLightBg[2]);
    doc.setDrawColor(slateBorder[0], slateBorder[1], slateBorder[2]);
    doc.roundedRect(margin, y, contentWidth, 22, 1.5, 1.5, 'FD');

    // Columna 1: Vendedor
    doc.setFontSize(7.5);
    doc.setTextColor(slateSub[0], slateSub[1], slateSub[2]);
    doc.setFont('helvetica', 'bold');
    doc.text('VENDEDOR TITULAR:', margin + 4, y + 6);
    doc.setFontSize(9.5);
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    doc.text(shift.sellerName || 'No especificado', margin + 4, y + 12);
    doc.setFontSize(7);
    doc.setTextColor(slateSub[0], slateSub[1], slateSub[2]);
    doc.setFont('helvetica', 'normal');
    doc.text(`ID: ${shift.sellerId || 'S/D'}`, margin + 4, y + 17);

    // Columna 2: Carrito y Zona
    const col2X = margin + 65;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('CARRITO ASIGNADO:', col2X, y + 6);
    doc.setFontSize(8.5);
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    doc.text(shift.cartCode || shift.cartId || 'Carrito Costa', col2X, y + 12);
    doc.setFontSize(7);
    doc.setTextColor(slateSub[0], slateSub[1], slateSub[2]);
    doc.setFont('helvetica', 'normal');
    doc.text(`Zona: ${shift.zoneName || 'Playa'}`, col2X, y + 17);

    // Columna 3: Coordinación y Estado
    const col3X = margin + 125;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('ESTADO DE JORNADA:', col3X, y + 6);
    
    // Badge de estado
    const statusText = (shift.status || 'CONCILIADA').toUpperCase();
    const isLiquidated = shift.status === 'liquidada' || shift.payoutStatus === 'pagado';
    doc.setFontSize(8.5);
    if (isLiquidated) {
      doc.setTextColor(emeraldDark[0], emeraldDark[1], emeraldDark[2]);
      doc.text(`LIQUIDADA / PAGADA`, col3X, y + 12);
    } else {
      doc.setTextColor(amberMain[0], amberMain[1], amberMain[2]);
      doc.text(`CONCILIADA (Pendiente Pago)`, col3X, y + 12);
    }
    doc.setFontSize(7);
    doc.setTextColor(slateSub[0], slateSub[1], slateSub[2]);
    doc.setFont('helvetica', 'normal');
    doc.text(`Coordinador: ${shift.coordinatorSignature || shift.coordinatorName || 'Coordinación'}`, col3X, y + 17);

    y += 26;

    // =========================================================================
    // 3. BALANCE FÍSICO DE UNIDADES & STOCK
    // =========================================================================
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    doc.text('1. BALANCE Y CONCILIACIÓN FÍSICA DE UNIDADES (TEQUEÑOS)', margin, y + 4);

    y += 6;

    // Tarjetas resumen de stock
    const cardWidth = (contentWidth - 12) / 5;
    const cardHeight = 16;
    const stockSummaryCards = [
      {
        label: 'ENTREGADOS',
        value: `${shift.totalUnitsDelivered || 0} u`,
        sub: 'Carga inicial mañana',
        color: slateDark
      },
      {
        label: 'RESTOCK (EXTRA)',
        value: `${shift.totalUnitsRestocked || 0} u`,
        sub: (shift.totalUnitsRestocked && shift.totalUnitsRestocked > 0) ? 'Refuerzo en playa' : 'Sin reposición',
        color: (shift.totalUnitsRestocked && shift.totalUnitsRestocked > 0) ? amberMain : slateSub
      },
      {
        label: 'VENDIDOS',
        value: `${shift.totalUnitsSold || 0} u`,
        sub: 'Venta registrada',
        color: emeraldDark
      },
      {
        label: 'SOBRANTES',
        value: `${shift.totalUnitsReturned || 0} u`,
        sub: 'Devueltos a base',
        color: slateDark
      },
      {
        label: 'MERMAS / DIF.',
        value: `${shift.totalUnitsWaste || 0} u / ${shift.totalUnitsDifference || 0} u`,
        sub: shift.totalUnitsDifference > 0 ? `Faltante: ${shift.totalUnitsDifference} u` : 'Sin faltante',
        color: shift.totalUnitsDifference > 0 ? roseDark : emeraldDark
      }
    ];

    stockSummaryCards.forEach((card, idx) => {
      const cx = margin + idx * (cardWidth + 3);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(slateBorder[0], slateBorder[1], slateBorder[2]);
      doc.roundedRect(cx, y, cardWidth, cardHeight, 1.2, 1.2, 'FD');

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(slateSub[0], slateSub[1], slateSub[2]);
      doc.text(card.label, cx + cardWidth / 2, y + 4.5, { align: 'center' });

      doc.setFontSize(9.5);
      doc.setTextColor(card.color[0], card.color[1], card.color[2]);
      doc.text(card.value, cx + cardWidth / 2, y + 10, { align: 'center' });

      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(slateSub[0], slateSub[1], slateSub[2]);
      doc.text(card.sub, cx + cardWidth / 2, y + 14, { align: 'center' });
    });

    y += cardHeight + 4;

    // Detalle por Variedad (Tabla)
    if (shift.stockItems && shift.stockItems.length > 0) {
      // Cabecera de la tabla
      doc.setFillColor(slateHeader[0], slateHeader[1], slateHeader[2]);
      doc.rect(margin, y, contentWidth, 6, 'F');

      doc.setFontSize(6.8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('VARIEDAD / PRODUCTO', margin + 3, y + 4.2);
      doc.text('ENTREG.', margin + 70, y + 4.2, { align: 'center' });
      doc.text('RESTOCK', margin + 92, y + 4.2, { align: 'center' });
      doc.text('VENDIDOS', margin + 115, y + 4.2, { align: 'center' });
      doc.text('DEVUELTOS', margin + 138, y + 4.2, { align: 'center' });
      doc.text('MERMA', margin + 160, y + 4.2, { align: 'center' });
      doc.text('DIFERENCIA', margin + 180, y + 4.2, { align: 'right' });

      y += 6;

      shift.stockItems.forEach((item, index) => {
        const isEven = index % 2 === 0;
        doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
        doc.setDrawColor(slateBorder[0], slateBorder[1], slateBorder[2]);
        doc.rect(margin, y, contentWidth, 5.5, 'FD');

        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
        doc.text(item.varietyName, margin + 3, y + 3.8);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(slateSub[0], slateSub[1], slateSub[2]);
        doc.text(`${item.deliveredUnits || 0}`, margin + 70, y + 3.8, { align: 'center' });
        doc.text(`${item.reSuppliedUnits || 0}`, margin + 92, y + 3.8, { align: 'center' });
        doc.text(`${item.soldUnits || 0}`, margin + 115, y + 3.8, { align: 'center' });
        doc.text(`${item.returnedUnits || 0}`, margin + 138, y + 3.8, { align: 'center' });
        doc.text(`${item.wasteUnits || 0}`, margin + 160, y + 3.8, { align: 'center' });

        const diff = item.differenceUnits || 0;
        if (diff > 0) {
          doc.setTextColor(roseDark[0], roseDark[1], roseDark[2]);
          doc.setFont('helvetica', 'bold');
          doc.text(`-${diff} u (Faltante)`, margin + 180, y + 3.8, { align: 'right' });
        } else if (diff < 0) {
          doc.setTextColor(amberMain[0], amberMain[1], amberMain[2]);
          doc.text(`+${Math.abs(diff)} u (Sobrante)`, margin + 180, y + 3.8, { align: 'right' });
        } else {
          doc.setTextColor(emeraldDark[0], emeraldDark[1], emeraldDark[2]);
          doc.text('Exacto (0)', margin + 180, y + 3.8, { align: 'right' });
        }

        y += 5.5;
      });
    }

    y += 4;

    // =========================================================================
    // 4. VENTAS TOTALES & DESGLOSE POR MÉTODO DE PAGO
    // =========================================================================
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    doc.text('2. RECAUDACIÓN Y VENTAS POR MÉTODO DE PAGO', margin, y + 4);

    y += 6;

    const payBoxWidth = (contentWidth - 6) / 2;
    const payBoxHeight = 27;

    // Caja 1: Efectivo
    doc.setFillColor(slateLightBg[0], slateLightBg[1], slateLightBg[2]);
    doc.setDrawColor(slateBorder[0], slateBorder[1], slateBorder[2]);
    doc.roundedRect(margin, y, payBoxWidth, payBoxHeight, 1.5, 1.5, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    doc.text('EFECTIVO EN MANO', margin + 4, y + 5.5);

    doc.setFontSize(10.5);
    doc.setTextColor(emeraldDark[0], emeraldDark[1], emeraldDark[2]);
    doc.text(formatCurrency(shift.totalCashSales), margin + payBoxWidth - 4, y + 5.5, { align: 'right' });

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(slateSub[0], slateSub[1], slateSub[2]);
    doc.text(`• Efectivo Teórico Esperado:`, margin + 4, y + 11.5);
    doc.text(formatCurrency(shift.cashExpected), margin + payBoxWidth - 4, y + 11.5, { align: 'right' });

    doc.text(`• Efectivo Físico Declarado:`, margin + 4, y + 16.5);
    doc.text(formatCurrency(shift.cashDeclared || shift.cashExpected), margin + payBoxWidth - 4, y + 16.5, { align: 'right' });

    const cashDiff = (shift.cashDeclared || shift.cashExpected) - shift.cashExpected;
    doc.setFont('helvetica', 'bold');
    if (cashDiff < 0) {
      doc.setTextColor(roseDark[0], roseDark[1], roseDark[2]);
      doc.text(`• Diferencia de Caja: Faltante de ${formatCurrency(Math.abs(cashDiff))}`, margin + 4, y + 22);
    } else if (cashDiff > 0) {
      doc.setTextColor(emeraldDark[0], emeraldDark[1], emeraldDark[2]);
      doc.text(`• Diferencia de Caja: Sobrante de ${formatCurrency(cashDiff)}`, margin + 4, y + 22);
    } else {
      doc.setTextColor(emeraldDark[0], emeraldDark[1], emeraldDark[2]);
      doc.text(`• Diferencia de Caja: Cuadrada ($0)`, margin + 4, y + 22);
    }

    // Caja 2: Mercado Pago / Transferencias
    const mpX = margin + payBoxWidth + 6;
    doc.setFillColor(slateLightBg[0], slateLightBg[1], slateLightBg[2]);
    doc.setDrawColor(slateBorder[0], slateBorder[1], slateBorder[2]);
    doc.roundedRect(mpX, y, payBoxWidth, payBoxHeight, 1.5, 1.5, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    doc.text('MERCADO PAGO / TRANSFERENCIAS', mpX + 4, y + 5.5);

    doc.setFontSize(10.5);
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    doc.text(formatCurrency(shift.totalMpSales), mpX + payBoxWidth - 4, y + 5.5, { align: 'right' });

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(slateSub[0], slateSub[1], slateSub[2]);
    doc.text(`• Comprobantes Validados:`, mpX + 4, y + 11.5);
    doc.setTextColor(emeraldDark[0], emeraldDark[1], emeraldDark[2]);
    doc.text(formatCurrency(shift.mpValidatedAmount || shift.totalMpSales), mpX + payBoxWidth - 4, y + 11.5, { align: 'right' });

    doc.setTextColor(slateSub[0], slateSub[1], slateSub[2]);
    doc.text(`• En Revisión / Observados:`, mpX + 4, y + 16.5);
    doc.text(formatCurrency(shift.mpPendingOrSuspiciousAmount || 0), mpX + payBoxWidth - 4, y + 16.5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(amberMain[0], amberMain[1], amberMain[2]);
    doc.text(`• Ventas Totales Brutas: ${formatCurrency(shift.totalGrossSales)}`, mpX + 4, y + 22);

    y += payBoxHeight + 5;

    // =========================================================================
    // 5. LIQUIDACIÓN DE COMISIÓN Y DESCUENTOS (DETALLE FINANCIERO)
    // =========================================================================
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    doc.text('3. DETALLE DE LIQUIDACIÓN DE COMISIONES & DESCUENTOS DEL VENDEDOR', margin, y + 4);

    y += 6;

    // Contenedor principal de liquidación
    const liqBoxHeight = 52;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(slateBorder[0], slateBorder[1], slateBorder[2]);
    doc.roundedRect(margin, y, contentWidth, liqBoxHeight, 2, 2, 'FD');

    // Fila 1: Total Ventas y Tramo Aplicado
    const ratePercent = Math.round((shift.commissionRate || 0.20) * 100);
    const tierName = shift.appliedCommissionTierName || `Tramo ${ratePercent}% (${ratePercent}% sobre ventas totales)`;

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(slateSub[0], slateSub[1], slateSub[2]);
    doc.text('Ventas Totales Brutas de la Jornada:', margin + 5, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    doc.text(formatCurrency(shift.totalGrossSales), margin + 85, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(slateSub[0], slateSub[1], slateSub[2]);
    doc.text('Escalafón / Tramo de Comisión Aplicado:', margin + 5, y + 11.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(amberMain[0], amberMain[1], amberMain[2]);
    doc.text(`${tierName}`, margin + 85, y + 11.5);

    // Fila 2: Comisión Bruta
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(slateSub[0], slateSub[1], slateSub[2]);
    doc.text(`Comisión Bruta Ganada (${ratePercent}% sobre ${formatCurrency(shift.totalGrossSales)}):`, margin + 5, y + 17);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(emeraldDark[0], emeraldDark[1], emeraldDark[2]);
    doc.text(`+ ${formatCurrency(shift.grossCommission)}`, margin + contentWidth - 5, y + 17, { align: 'right' });

    // Fila 3: Costo de Vivienda
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(slateSub[0], slateSub[1], slateSub[2]);
    doc.text('Deducción Alojamiento / Costo Diario de Vivienda:', margin + 5, y + 22.5);
    doc.setFont('helvetica', 'bold');
    if (shift.housingCostExempt) {
      doc.setTextColor(emeraldDark[0], emeraldDark[1], emeraldDark[2]);
      doc.text('$ 0 (Exento autorizado)', margin + contentWidth - 5, y + 22.5, { align: 'right' });
    } else {
      doc.setTextColor(roseDark[0], roseDark[1], roseDark[2]);
      doc.text(`- ${formatCurrency(shift.housingCostDeduction || 8000)}`, margin + contentWidth - 5, y + 22.5, { align: 'right' });
    }

    // Fila 4: Descuento por Faltantes de Unidades
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(slateSub[0], slateSub[1], slateSub[2]);
    doc.text('Descuentos por Faltante de Unidades no justificadas:', margin + 5, y + 28);
    doc.setFont('helvetica', 'bold');
    if (shift.deductionsForMissingUnits && shift.deductionsForMissingUnits > 0) {
      doc.setTextColor(roseDark[0], roseDark[1], roseDark[2]);
      doc.text(`- ${formatCurrency(shift.deductionsForMissingUnits)}`, margin + contentWidth - 5, y + 28, { align: 'right' });
    } else {
      doc.setTextColor(slateSub[0], slateSub[1], slateSub[2]);
      doc.text('$ 0', margin + contentWidth - 5, y + 28, { align: 'right' });
    }

    // Fila 5: Incentivos / Bonos / Otros Ajustes
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(slateSub[0], slateSub[1], slateSub[2]);
    doc.text('Incentivos por Objetivos / Bonos / Otros Ajustes:', margin + 5, y + 33.5);
    doc.setFont('helvetica', 'bold');
    if (shift.incentivesOrBonuses && shift.incentivesOrBonuses > 0) {
      doc.setTextColor(emeraldDark[0], emeraldDark[1], emeraldDark[2]);
      doc.text(`+ ${formatCurrency(shift.incentivesOrBonuses)}`, margin + contentWidth - 5, y + 33.5, { align: 'right' });
    } else {
      doc.setTextColor(slateSub[0], slateSub[1], slateSub[2]);
      doc.text('$ 0', margin + contentWidth - 5, y + 33.5, { align: 'right' });
    }

    // Fila 6: TOTAL NETO A COBRAR (Destacado en fondo oscuro)
    doc.setFillColor(slateHeader[0], slateHeader[1], slateHeader[2]);
    doc.roundedRect(margin + 3, y + 38, contentWidth - 6, 11.5, 1.2, 1.2, 'F');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('IMPORTE FINAL A PAGAR AL VENDEDOR (NETO):', margin + 8, y + 45.5);

    doc.setFontSize(12);
    doc.setTextColor(245, 158, 11);
    doc.text(formatCurrency(shift.finalPayoutAmount), margin + contentWidth - 8, y + 46, { align: 'right' });

    y += liqBoxHeight + 4;

    // =========================================================================
    // 6. ESTADO DE PAGO, OBSERVACIONES Y FIRMAS
    // =========================================================================
    // Caja de Estado y Observaciones
    doc.setFillColor(slateLightBg[0], slateLightBg[1], slateLightBg[2]);
    doc.setDrawColor(slateBorder[0], slateBorder[1], slateBorder[2]);
    doc.roundedRect(margin, y, contentWidth, 23, 1.5, 1.5, 'FD');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    doc.text('ESTADO DE LA LIQUIDACIÓN & PAGO:', margin + 4, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(slateSub[0], slateSub[1], slateSub[2]);
    const payoutStateLabel = shift.payoutStatus === 'pagado'
      ? `PAGADO el ${shift.payoutTimestamp || shift.date} • Comprobante/Método: ${shift.payoutPaymentProof || 'Efectivo en mano'}`
      : 'PENDIENTE DE PAGO (Liquidación conciliada y autorizada por coordinación)';
    doc.text(payoutStateLabel, margin + 55, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVACIONES / NOTAS:', margin + 4, y + 10);
    doc.setFont('helvetica', 'normal');
    const notesText = shift.notes || 'Cierre completado conforme a las políticas operativas de SGMO Tequeños Costa.';
    doc.text(notesText, margin + 4, y + 15, { maxWidth: contentWidth - 8 });

    y += 26;

    // =========================================================================
    // 7. FIRMAS DIGITALES / CONFORMIDAD
    // =========================================================================
    const sigBoxWidth = (contentWidth - 10) / 2;

    // Firma Coordinador
    doc.setDrawColor(slateSub[0], slateSub[1], slateSub[2]);
    doc.line(margin + 10, y + 12, margin + sigBoxWidth - 10, y + 12);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    doc.text(shift.coordinatorSignature || shift.coordinatorName || 'Coordinación Operativa', margin + sigBoxWidth / 2, y + 15.5, { align: 'center' });
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(slateSub[0], slateSub[1], slateSub[2]);
    doc.text('Firma y Aprobación Coordinador de Base', margin + sigBoxWidth / 2, y + 18.5, { align: 'center' });

    // Firma Vendedor
    const sigVendX = margin + sigBoxWidth + 10;
    doc.setDrawColor(slateSub[0], slateSub[1], slateSub[2]);
    doc.line(sigVendX + 10, y + 12, sigVendX + sigBoxWidth - 10, y + 12);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    doc.text(shift.sellerName || 'Vendedor Titular', sigVendX + sigBoxWidth / 2, y + 15.5, { align: 'center' });
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(slateSub[0], slateSub[1], slateSub[2]);
    doc.text('Firma y Conformidad de Liquidación Recibida', sigVendX + sigBoxWidth / 2, y + 18.5, { align: 'center' });

    // Pie de página de seguridad
    doc.setFontSize(5.5);
    doc.setTextColor(slateSub[0], slateSub[1], slateSub[2]);
    doc.text(
      `Comprobante emitido automáticamente por el Sistema SGMO • Documento oficial de auditoría interna • Folio ${shift.id} • ${new Date().toLocaleString('es-AR')}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );

    // =========================================================================
    // 8. DESCARGA DEL ARCHIVO PDF
    // =========================================================================
    const filename = generateLiquidationFilename(shift.sellerName, shift.date);

    try {
      doc.save(filename);
      return true;
    } catch (saveError) {
      // Fallback para descarga en entornos de navegador con restricciones
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return true;
    }
  } catch (error) {
    console.error('Error al generar PDF de liquidación:', error);
    return false;
  }
}
