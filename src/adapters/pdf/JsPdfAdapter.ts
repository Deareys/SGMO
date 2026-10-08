/**
 * SGMO — Tequeños Costa
 * PDF Adapter: jsPDF Client-Side Generation
 *
 * Implementa el puerto IPdfGenerator para generar el documento oficial de liquidación
 * en la memoria del navegador sin depender de un servidor externo.
 */

import { IPdfGenerator } from '../../core/ports/IPdfGenerator';
import { DailyShift } from '../../core/domain/types';
import { downloadLiquidationPdf } from '../../utils/liquidationPdfGenerator';

export class JsPdfAdapter implements IPdfGenerator {
  generateLiquidationPdf(shift: DailyShift): boolean {
    return downloadLiquidationPdf(shift);
  }
}

export const jsPdfAdapter = new JsPdfAdapter();
