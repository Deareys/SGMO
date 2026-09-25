/**
 * SGMO — Tequeños Costa
 * Módulo de Validación Asistida con IA de Comprobantes de Transferencia (Mercado Pago)
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Bot,
  Sparkles,
  Smartphone,
  Search,
  Filter,
  Check,
  RotateCcw,
  Layers,
  ArrowRight
} from 'lucide-react';
import { AppState, storageService } from '../services/storageService';
import { VoucherValidationStatus } from '../types';

interface VoucherValidationViewProps {
  state: AppState;
}

export const VoucherValidationView: React.FC<VoucherValidationViewProps> = ({ state }) => {
  const { sales, shifts, users } = state;

  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  // Filtrar ventas por transferencia / Mercado Pago
  const mpSales = sales.filter((s) => s.paymentMethod === 'mercado_pago');

  const filteredSales = mpSales.filter((s) => {
    if (statusFilter === 'todos') return true;
    return s.validationStatus === statusFilter;
  });

  const selectedSale = mpSales.find((s) => s.id === selectedSaleId) || filteredSales[0] || mpSales[0];

  // Acciones de Validación
  const handleUpdateStatus = (saleId: string, newStatus: VoucherValidationStatus) => {
    storageService.updateVoucherStatus(saleId, newStatus);
  };

  // Contadores por estado
  const pendingCount = mpSales.filter((s) => s.validationStatus === 'pendiente_revision').length;
  const suspiciousCount = mpSales.filter((s) => s.validationStatus === 'sospechosa').length;
  const inconsistentCount = mpSales.filter((s) => s.validationStatus === 'inconsistente').length;
  const validatedCount = mpSales.filter((s) => s.validationStatus === 'validada').length;

  return (
    <div className="space-y-6 pb-12">
      
      {/* Encabezado */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-sky-400 text-xs font-semibold uppercase tracking-wider">
              <Bot className="w-3.5 h-3.5" />
              <span>Auditoría de Pagos Digitales & Detección de Fraudes</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white mt-1">
              Centro de Validación IA de Transferencias
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              OCR con Gemini 3.7 Flash y cruce de datos contra API de Mercado Pago y base histórica de comprobantes.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs bg-sky-950 text-sky-300 border border-sky-800 px-3 py-1.5 rounded-xl font-bold">
              {mpSales.length} Comprobantes Totales
            </span>
          </div>
        </div>

        {/* Semáforo de Comprobantes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800">
          <button
            onClick={() => setStatusFilter('pendiente_revision')}
            className={`p-3 rounded-xl border text-left transition-all ${
              statusFilter === 'pendiente_revision'
                ? 'bg-amber-500/20 border-amber-500 text-white ring-1 ring-amber-500'
                : 'bg-slate-950/60 border-slate-800 text-slate-300'
            }`}
          >
            <div className="text-[11px] text-amber-400 font-semibold uppercase">Pendientes</div>
            <div className="text-xl font-black text-white mt-0.5">{pendingCount}</div>
          </button>

          <button
            onClick={() => setStatusFilter('sospechosa')}
            className={`p-3 rounded-xl border text-left transition-all ${
              statusFilter === 'sospechosa'
                ? 'bg-rose-500/20 border-rose-500 text-white ring-1 ring-rose-500'
                : 'bg-slate-950/60 border-slate-800 text-slate-300'
            }`}
          >
            <div className="text-[11px] text-rose-400 font-semibold uppercase flex items-center">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Sospechosas
            </div>
            <div className="text-xl font-black text-white mt-0.5">{suspiciousCount}</div>
          </button>

          <button
            onClick={() => setStatusFilter('inconsistente')}
            className={`p-3 rounded-xl border text-left transition-all ${
              statusFilter === 'inconsistente'
                ? 'bg-orange-500/20 border-orange-500 text-white ring-1 ring-orange-500'
                : 'bg-slate-950/60 border-slate-800 text-slate-300'
            }`}
          >
            <div className="text-[11px] text-orange-400 font-semibold uppercase">Inconsistentes</div>
            <div className="text-xl font-black text-white mt-0.5">{inconsistentCount}</div>
          </button>

          <button
            onClick={() => setStatusFilter('validada')}
            className={`p-3 rounded-xl border text-left transition-all ${
              statusFilter === 'validada'
                ? 'bg-emerald-500/20 border-emerald-500 text-white ring-1 ring-emerald-500'
                : 'bg-slate-950/60 border-slate-800 text-slate-300'
            }`}
          >
            <div className="text-[11px] text-emerald-400 font-semibold uppercase">Validadas</div>
            <div className="text-xl font-black text-white mt-0.5">{validatedCount}</div>
          </button>
        </div>
      </div>

      {/* Grid Principal: Lista de Comprobantes + Inspector Detallado */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Columna Izquierda: Lista de Comprobantes (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-300">Comprobantes Registrados</span>
            <button
              onClick={() => setStatusFilter('todos')}
              className="text-[11px] text-sky-400 hover:underline"
            >
              Ver todos ({mpSales.length})
            </button>
          </div>

          <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
            {filteredSales.map((sale) => {
              const isSelected = selectedSale?.id === sale.id;
              const isSuspicious = sale.validationStatus === 'sospechosa';
              const isValidated = sale.validationStatus === 'validada';

              return (
                <div
                  key={sale.id}
                  onClick={() => setSelectedSaleId(sale.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-800 border-sky-500 ring-1 ring-sky-500 shadow-md'
                      : 'bg-slate-950/70 border-slate-800/90 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">${sale.totalAmount.toLocaleString()}</span>
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      isValidated
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : isSuspicious
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {sale.validationStatus.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
                    <span>{sale.sellerName}</span>
                    <span>{sale.timestamp.slice(11, 16)} hs</span>
                  </div>

                  {sale.voucherExtractedData?.operationId && (
                    <div className="text-[10px] text-slate-500 font-mono mt-1">
                      Op: {sale.voucherExtractedData.operationId}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredSales.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500">
                No hay comprobantes con el filtro seleccionado.
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Inspector Detallado de OCR y API (7 cols) */}
        {selectedSale ? (
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            
            {/* Header del Comprobante Seleccionado */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[11px] text-slate-400 uppercase font-mono">Transacción #{selectedSale.id}</span>
                <h2 className="text-xl font-extrabold text-white">
                  ${selectedSale.totalAmount.toLocaleString()} • {selectedSale.itemType}
                </h2>
              </div>

              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  selectedSale.validationStatus === 'validada'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : selectedSale.validationStatus === 'sospechosa'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {selectedSale.validationStatus.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Cruce de Datos OCR vs Venta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Datos de la Venta Declarada */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block border-b border-slate-800 pb-1">
                  1. Venta Registrada en Playa
                </span>
                <div className="flex justify-between"><span className="text-slate-400">Vendedor:</span> <strong className="text-white">{selectedSale.sellerName}</strong></div>
                <div className="flex justify-between"><span className="text-slate-400">Importe:</span> <strong className="text-white font-mono">${selectedSale.totalAmount.toLocaleString()}</strong></div>
                <div className="flex justify-between"><span className="text-slate-400">Variedad:</span> <strong className="text-amber-300">{selectedSale.varietyName}</strong></div>
                <div className="flex justify-between"><span className="text-slate-400">Fecha/Hora:</span> <span className="text-slate-300">{selectedSale.timestamp}</span></div>
              </div>

              {/* Datos Extraídos por Gemini OCR */}
              <div className="bg-slate-950/80 border border-sky-900/60 rounded-xl p-3.5 space-y-2 text-xs bg-sky-950/10">
                <span className="text-[10px] uppercase font-bold text-sky-400 block border-b border-slate-800 pb-1 flex items-center justify-between">
                  <span>2. OCR Extraído con IA</span>
                  <Sparkles className="w-3 h-3 text-sky-400" />
                </span>
                <div className="flex justify-between"><span className="text-slate-400">N° Operación:</span> <strong className="text-white font-mono">{selectedSale.voucherExtractedData?.operationId || 'No detectado'}</strong></div>
                <div className="flex justify-between"><span className="text-slate-400">Monto Leído:</span> <strong className="text-emerald-400 font-mono">${(selectedSale.voucherExtractedData?.amount || selectedSale.totalAmount).toLocaleString()}</strong></div>
                <div className="flex justify-between"><span className="text-slate-400">Emisor:</span> <span className="text-slate-200">{selectedSale.voucherExtractedData?.senderName || 'Cliente'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Destino:</span> <span className="text-slate-200">{selectedSale.voucherExtractedData?.destinationAccount || 'Tequeños Costa'}</span></div>
              </div>

            </div>

            {/* Estado contra la API de Mercado Pago */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2.5">
                <Smartphone className="w-5 h-5 text-sky-400" />
                <div>
                  <div className="font-bold text-white">Estado API Mercado Pago</div>
                  <div className="text-[11px] text-slate-400">Verificación cruzada de acreditación en cuenta bancaria</div>
                </div>
              </div>

              <div>
                <span className={`px-2.5 py-1 rounded-lg font-bold text-xs ${
                  selectedSale.validationStatus === 'validada'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : selectedSale.validationStatus === 'sospechosa'
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {selectedSale.validationStatus === 'validada' ? 'APROBADA & ACREDITADA' : 'PENDIENTE / REQUIERE REVISIÓN'}
                </span>
              </div>
            </div>

            {/* Observaciones de la IA */}
            {selectedSale.voucherExtractedData?.aiNotes && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 space-y-1">
                <span className="text-[10px] uppercase font-bold text-amber-400 block">Diagnóstico Heurístico & Anti-Fraude:</span>
                <p className="italic text-slate-400">"{selectedSale.voucherExtractedData.aiNotes}"</p>
              </div>
            )}

            {/* Botones de Acción para el Coordinador */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => handleUpdateStatus(selectedSale.id, 'validada')}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Aprobar Comprobante</span>
              </button>

              <button
                onClick={() => handleUpdateStatus(selectedSale.id, 'sospechosa')}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/20 flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Marcar como Sospechosa / Fraude</span>
              </button>

              <button
                onClick={() => handleUpdateStatus(selectedSale.id, 'pendiente_revision')}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        ) : (
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs">
            Seleccioná un comprobante para auditarlo con IA.
          </div>
        )}

      </div>

    </div>
  );
};
