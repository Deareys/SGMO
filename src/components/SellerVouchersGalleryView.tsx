/**
 * SGMO — Tequeños Costa
 * Galería y Registro Visual de Comprobantes de Pago del Vendedor
 * Solo lectura para el vendedor (sin edición, reemplazo ni eliminación).
 * Respaldo visual en caso de discrepancias o fallas en la validación automática.
 */

import React, { useState } from 'react';
import {
  FileText,
  Calendar,
  Clock,
  DollarSign,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Search,
  Filter,
  Eye,
  X,
  Smartphone,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { AppState } from '../services/storageService';
import { SaleTransaction } from '../types';

interface SellerVouchersGalleryViewProps {
  state: AppState;
}

export const SellerVouchersGalleryView: React.FC<SellerVouchersGalleryViewProps> = ({ state }) => {
  const { currentUser, sales } = state;

  // Filtrar estrictamente solo las ventas del vendedor logueado que posean comprobante o sean Mercado Pago
  const mySalesWithVouchers = sales.filter((s) => {
    const isMySale = s.sellerId === currentUser.id;
    return isMySale && (s.voucherPhotoUrl || s.paymentMethod === 'mercado_pago');
  });

  const [selectedStatus, setSelectedStatus] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSaleForModal, setSelectedSaleForModal] = useState<SaleTransaction | null>(null);

  // Filtrado
  const filteredVouchers = mySalesWithVouchers.filter((sale) => {
    if (selectedStatus !== 'todos' && sale.validationStatus !== selectedStatus) {
      return false;
    }
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      const matchOp = sale.voucherExtractedData?.operationId?.toLowerCase()?.includes(term);
      const matchAmount = sale.totalAmount?.toString()?.includes(term);
      const matchVariety = sale.varietyName?.toLowerCase()?.includes(term);
      const matchDate = sale.timestamp && typeof sale.timestamp === 'string' ? sale.timestamp.includes(term) : false;
      if (!matchOp && !matchAmount && !matchVariety && !matchDate) {
        return false;
      }
    }
    return true;
  });

  // Estadísticas rápidas para el vendedor
  const totalCount = mySalesWithVouchers.length;
  const validatedCount = mySalesWithVouchers.filter((s) => s.validationStatus === 'validada').length;
  const pendingCount = mySalesWithVouchers.filter((s) => s.validationStatus === 'pendiente_revision').length;
  const suspiciousCount = mySalesWithVouchers.filter((s) => s.validationStatus === 'sospechosa' || s.validationStatus === 'inconsistente').length;

  const renderStatusBadge = (status: SaleTransaction['validationStatus']) => {
    switch (status) {
      case 'validada':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <ShieldCheck className="w-3 h-3 mr-1 text-emerald-400" />
            Validada
          </span>
        );
      case 'sospechosa':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <ShieldAlert className="w-3 h-3 mr-1 text-rose-400" />
            Sospechosa
          </span>
        );
      case 'inconsistente':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <AlertTriangle className="w-3 h-3 mr-1 text-rose-400" />
            Inconsistente
          </span>
        );
      case 'pendiente_revision':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Clock className="w-3 h-3 mr-1 text-amber-400" />
            Pendiente
          </span>
        );
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-16">
      
      {/* Cabecera Principal */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-sky-400 text-xs font-semibold uppercase tracking-wider">
              <FileText className="w-4 h-4" />
              <span>Respaldo Digital del Vendedor</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
              Mis Comprobantes de Pago
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Registro histórico de fotografías y comprobantes capturados en tus ventas por transferencia.
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-400">
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Registro inmutable de respaldo</span>
          </div>
        </div>

        {/* Mini tarjetas de estado */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4 mt-4 border-t border-slate-800">
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block font-semibold">Total Cargados</span>
            <span className="text-base sm:text-lg font-black text-white">{totalCount}</span>
          </div>
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block font-semibold">Validados OK</span>
            <span className="text-base sm:text-lg font-black text-emerald-400">{validatedCount}</span>
          </div>
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block font-semibold">En Revisión</span>
            <span className="text-base sm:text-lg font-black text-amber-400">{pendingCount}</span>
          </div>
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block font-semibold">Con Discrepancia</span>
            <span className="text-base sm:text-lg font-black text-rose-400">{suspiciousCount}</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros & Búsqueda */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row gap-3 items-center justify-between">
        
        {/* Búsqueda */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por N° op, monto o fecha..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Filtro por estado */}
        <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1 shrink-0" />
          {(['todos', 'validada', 'pendiente_revision', 'sospechosa'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedStatus === st
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {st === 'todos'
                ? 'Todos'
                : st === 'validada'
                ? 'Validados'
                : st === 'pendiente_revision'
                ? 'Pendientes'
                : 'Observados'}
            </button>
          ))}
        </div>

      </div>

      {/* Galería / Grid de Comprobantes */}
      {filteredVouchers.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white">No tenés comprobantes registrados</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchTerm || selectedStatus !== 'todos'
              ? 'No hay comprobantes que coincidan con la búsqueda o filtro aplicado.'
              : 'Cuando cobres por Mercado Pago o transferencia y tomes una fotografía del comprobante, aparecerá aquí como respaldo visual.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVouchers.map((sale) => {
            // Extraer fecha y hora
            const [saleDate, saleTime] = (sale.timestamp && typeof sale.timestamp === 'string' && sale.timestamp.includes(' '))
              ? sale.timestamp.split(' ')
              : [sale.timestamp || '', ''];

            const hasPhoto = !!sale.voucherPhotoUrl;

            return (
              <div
                key={sale.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                {/* Visualizador de la imagen o placeholder del comprobante */}
                <div
                  onClick={() => setSelectedSaleForModal(sale)}
                  className="relative aspect-[4/3] bg-black cursor-pointer group flex items-center justify-center overflow-hidden border-b border-slate-800"
                >
                  {hasPhoto ? (
                    <img
                      src={sale.voucherPhotoUrl}
                      alt={`Comprobante venta ${sale.id}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="p-4 text-center space-y-2 text-slate-500">
                      <Smartphone className="w-8 h-8 mx-auto text-slate-600" />
                      <span className="text-[11px] block font-medium">Captura registrada en terminal</span>
                      {sale.voucherExtractedData?.operationId && (
                        <span className="text-[10px] font-mono text-sky-400 bg-sky-950/40 px-2 py-0.5 rounded border border-sky-800/40">
                          {sale.voucherExtractedData.operationId}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Overlay de Ver Imagen */}
                  <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2 text-white text-xs font-bold">
                    <Eye className="w-4 h-4" />
                    <span>Ver Comprobante Ampliado</span>
                  </div>

                  {/* Badge flotante de Estado */}
                  <div className="absolute top-2.5 right-2.5">
                    {renderStatusBadge(sale.validationStatus)}
                  </div>
                </div>

                {/* Datos del Comprobante y Venta Asociada */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">
                        Venta #{sale.id.replace('TX-', '')}
                      </span>
                      <span className="text-sm font-black text-amber-400 font-mono">
                        ${sale.totalAmount.toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 font-medium truncate">
                      {sale.itemType.toUpperCase()} • {sale.varietyName}
                    </p>

                    {sale.voucherExtractedData?.operationId && (
                      <div className="text-[11px] text-slate-400 flex items-center space-x-1">
                        <span className="text-slate-500">Operación:</span>
                        <span className="font-mono text-sky-300 font-semibold">{sale.voucherExtractedData.operationId}</span>
                      </div>
                    )}
                  </div>

                  {/* Pie con Fecha y Hora */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{saleDate}</span>
                    </div>
                    {saleTime && (
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{saleTime} hs</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Botón de inspección modal */}
                <button
                  type="button"
                  onClick={() => setSelectedSaleForModal(sale)}
                  className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 border-t border-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-sky-400" />
                  <span>Ver Detalle y Fotografía</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Detalle Ampliado del Comprobante (Solo Lectura) */}
      {selectedSaleForModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl space-y-0 max-h-[90vh] flex flex-col">
            
            {/* Header del Modal */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <span>Comprobante de Venta #{selectedSaleForModal.id}</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  {selectedSaleForModal.timestamp}
                </span>
              </div>
              <button
                onClick={() => setSelectedSaleForModal(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo del Modal: Fotografía y Datos */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              
              {/* Fotografía de la pantalla del comprador */}
              <div className="bg-black rounded-xl overflow-hidden border border-slate-800 max-h-80 flex items-center justify-center">
                {selectedSaleForModal.voucherPhotoUrl ? (
                  <img
                    src={selectedSaleForModal.voucherPhotoUrl}
                    alt="Foto del comprobante"
                    className="max-h-80 w-auto object-contain"
                  />
                ) : (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    <Smartphone className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                    <span>No hay fotografía disponible para esta venta</span>
                  </div>
                )}
              </div>

              {/* Ficha de Detalles */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Estado de Validación:</span>
                  <div>{renderStatusBadge(selectedSaleForModal.validationStatus)}</div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Importe Cobrado:</span>
                  <strong className="text-emerald-400 font-mono text-sm font-bold">
                    ${selectedSaleForModal.totalAmount.toLocaleString()}
                  </strong>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Producto / Combo:</span>
                  <span className="text-white font-medium">
                    {selectedSaleForModal.itemType} ({selectedSaleForModal.quantityUnitsEquivalent} u)
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Variedad:</span>
                  <span className="text-amber-300 font-semibold">
                    {selectedSaleForModal.varietyName}
                  </span>
                </div>

                {selectedSaleForModal.voucherExtractedData?.operationId && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">N° de Operación:</span>
                    <span className="text-sky-300 font-mono font-bold">
                      {selectedSaleForModal.voucherExtractedData.operationId}
                    </span>
                  </div>
                )}

                {selectedSaleForModal.voucherExtractedData?.senderName && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Comprador:</span>
                    <span className="text-slate-200">
                      {selectedSaleForModal.voucherExtractedData.senderName}
                    </span>
                  </div>
                )}

                {selectedSaleForModal.voucherExtractedData?.aiNotes && (
                  <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 italic">
                    Nota IA: "{selectedSaleForModal.voucherExtractedData.aiNotes}"
                  </div>
                )}
              </div>

              {/* Mensaje Informativo de Respaldo */}
              <div className="p-3 bg-sky-950/20 border border-sky-800/40 rounded-xl text-[11px] text-sky-300 flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-sky-400 mt-0.5" />
                <span>
                  Esta fotografía sirve como tu constancia de cobro. En caso de reclamos en la liquidación o demora en la acreditación de Mercado Pago, tu coordinador puede contrastar este respaldo.
                </span>
              </div>
            </div>

            {/* Pie del modal */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSaleForModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
