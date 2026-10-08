/**
 * SGMO — Tequeños Costa
 * Core Port: Generador de Documentos PDF Oficiales
 *
 * Contrato abstracto para generar comprobantes de liquidación inmutables.
 */

import { DailyShift } from '../domain/types';

export interface IPdfGenerator {
  generateLiquidationPdf(shift: DailyShift): Promise<boolean> | boolean;
}
