/**
 * SGMO — Tequeños Costa
 * Módulo de Cierre de Jornada, Conciliación Física/Monetaria y Liquidación de Comisiones
 */

import React, { useState, useMemo } from 'react';
import {
  Coins,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  Package,
  Calculator,
  UserCheck,
  Printer,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Flame,
  Layers,
  Award,
  TrendingUp,
  Download,
  Search,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AppState, storageService } from '../services/storageService';
import { DailyShift } from '../types';
import { calculateCommissionForSales } from '../utils/commissionUtils';
import { downloadLiquidationPdf, generateLiquidationFilename } from '../utils/liquidationPdfGenerator';

interface ReconciliationClosingViewProps {
  state: AppState;
}

export const ReconciliationClosingView: React.FC<ReconciliationClosingViewProps> = ({ state }) => {
  const { shifts, currentUser, houses } = state;

  // Filtrar jornadas activas o del día (si es vendedor, solo sus propias jornadas)
  const activeOrRecentShifts = shifts.filter((s) => {
    if (currentUser.role === 'seller') {
      return s.sellerId === currentUser.id;
    }
    return s.status === 'en_curso' || s.status === 'conciliada' || s.status === 'liquidada';
  });

  const [selectedShiftId, setSelectedShiftId] = useState<string>(
    activeOrRecentShifts.find((s) => s.status === 'en_curso')?.id || activeOrRecentShifts[0]?.id || ''
  );

  const selectedShift = shifts.find((s) => s.id === selectedShiftId) || activeOrRecentShifts[0];

  // Estados del Formulario de Cierre Físico
  const [cashDeclared, setCashDeclared] = useState<number>(selectedShift ? selectedShift.cashExpected : 0);
  const [gasPercentEnd, setGasPercentEnd] = useState<number>(65);
  
  // Stock devuelto contado
  const [returnedCounts, setReturnedCounts] = useState<Record<string, { count: number; waste: number }>>({});
  const [deductionMissingRate, setDeductionMissingRate] = useState<number>(1500); // $1,500 precio venta o $300 costo
  const [bonusIncentive, setBonusIncentive] = useState<number>(0);
  const [closingNotes, setClosingNotes] = useState<string>('');

  // Comprobante de Liquidación Digital (Modal)
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [receiptShift, setReceiptShift] = useState<DailyShift | null>(null);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState<string>('');

  // Función principal para descargar el comprobante en PDF real
  const handleDownloadPdf = (shiftToDownload: DailyShift) => {
    const success = downloadLiquidationPdf(shiftToDownload);
    if (success) {
      const filename = generateLiquidationFilename(shiftToDownload.sellerName, shiftToDownload.date);
      setDownloadSuccessMessage(`Archivo generado y descargado: ${filename}`);
      setTimeout(() => setDownloadSuccessMessage(null), 5000);
    } else {
      alert('Hubo un error al generar y descargar el comprobante PDF.');
    }
  };

  // Inicializar conteos al cambiar de jornada seleccionada
  React.useEffect(() => {
    if (selectedShift) {
      setCashDeclared(selectedShift.cashExpected);
      const initial: Record<string, { count: number; waste: number }> = {};
      selectedShift.stockItems.forEach((item) => {
        const estReturned = Math.max(0, item.deliveredUnits + item.reSuppliedUnits - item.soldUnits);
        initial[item.varietyId] = {
          count: item.returnedUnits || estReturned,
          waste: item.wasteUnits || 0
        };
      });
      setReturnedCounts(initial);
    }
  }, [selectedShiftId]);

  // Cálculo de comisión para la jornada actual (o valores históricos congelados si ya fue cerrada)
  const commissionDetails = useMemo(() => {
    if (!selectedShift) return null;
    if (selectedShift.status === 'conciliada' || selectedShift.status === 'liquidada') {
      // Usar exactamente los valores históricos congelados al momento del cierre
      return {
        rate: selectedShift.commissionRate,
        tierName: selectedShift.appliedCommissionTierName || `Tramo (${Math.round(selectedShift.commissionRate * 100)}%)`,
        grossCommission: selectedShift.grossCommission,
        isHistorical: true,
        nextTier: null,
        salesToNextTier: null
      };
    }
    // Para jornada en curso: calcular dinámicamente de acuerdo a ventas brutas y tramos vigentes
    const calc = calculateCommissionForSales(
      selectedShift.totalGrossSales,
      state.systemConfig?.commissionTiers || [],
      selectedShift.commissionRate || 0.20
    );
    return {
      rate: calc.rate,
      tierName: calc.tierName,
      grossCommission: calc.grossCommission,
      isHistorical: false,
      nextTier: calc.nextTier,
      salesToNextTier: calc.salesToNextTier
    };
  }, [selectedShift, state.systemConfig?.commissionTiers]);

  // Manejar Cierre y Conciliación
  const handlePerformClosing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShift) return;

    const returnedItems = selectedShift.stockItems.map((item) => ({
      varietyId: item.varietyId,
      count: returnedCounts[item.varietyId]?.count || 0,
      wasteCount: returnedCounts[item.varietyId]?.waste || 0
    }));

    const reconciled = storageService.closeAndReconcileShift({
      shiftId: selectedShift.id,
      cashDeclared,
      gasPercentEnd,
      returnedItems,
      deductionMissingRatePerUnit: deductionMissingRate,
      bonusIncentive,
      notes: closingNotes,
      coordinatorSignature: currentUser.name
    });

    setReceiptShift(reconciled);
    setShowReceiptModal(true);

    try {
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {}
  };

  // Pagar Comisión
  const handlePayCommission = (shiftId: string) => {
    const proof = `PAGO-EFVO-${new Date().toLocaleTimeString('es-AR').slice(0, 5)}`;
    storageService.paySellerCommission(shiftId, proof);
    const updated = storageService.getState().shifts.find((s) => s.id === shiftId);
    if (updated) {
      setReceiptShift(updated);
      setShowReceiptModal(true);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Encabezado */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-amber-400 text-xs font-semibold uppercase tracking-wider">
              <Coins className="w-3.5 h-3.5" />
              <span>Control de Fin de Jornada & Liquidaciones</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white mt-1">
              Cierre, Conciliación de Stock & Pago de Comisiones
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Conteo físico de tequeños devueltos, arqueo de caja de efectivo, validación de MP y cálculo de liquidación neta.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-xl font-bold">
              {shifts.filter((s) => s.status === 'en_curso').length} Jornadas por cerrar
            </span>
          </div>
        </div>
      </div>

      {/* Selector de Jornada Activa */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {activeOrRecentShifts.map((s) => {
          const isSelected = s.id === selectedShift?.id;
          return (
            <div
              key={s.id}
              onClick={() => setSelectedShiftId(s.id)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-slate-800 border-amber-500 ring-1 ring-amber-500 shadow-lg'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{s.sellerName}</span>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                  s.status === 'liquidada'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : s.status === 'conciliada'
                    ? 'bg-sky-500/20 text-sky-300'
                    : 'bg-amber-500/20 text-amber-300 animate-pulse'
                }`}>
                  {s.status}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                <span>{s.cartCode} ({s.zoneName.split(' ')[0]})</span>
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-white">${s.totalGrossSales.toLocaleString()}</span>
                  {(s.status === 'liquidada' || s.status === 'conciliada') && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadPdf(s);
                      }}
                      title="Descargar Comprobante PDF"
                      className="p-1 hover:bg-amber-500 hover:text-slate-950 text-amber-400 bg-slate-800 rounded transition-colors"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Alerta de descarga exitosa si se disparó */}
      {downloadSuccessMessage && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="font-medium">{downloadSuccessMessage}</span>
          </div>
          <button onClick={() => setDownloadSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-200">✕</button>
        </div>
      )}

      {selectedShift && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Columna Izquierda: Formulario de Conteo Físico y Arqueo (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center">
                  <Calculator className="w-5 h-5 text-amber-400 mr-2" />
                  Conciliación de {selectedShift.sellerName}
                </h2>
                <span className="text-xs text-slate-400">
                  {selectedShift.cartCode} • Despachado a las {selectedShift.startTime} hs
                </span>
              </div>

              {(selectedShift.status === 'liquidada' || selectedShift.status === 'conciliada') && (
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => { setReceiptShift(selectedShift); setShowReceiptModal(true); }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-xs font-bold rounded-xl flex items-center space-x-1 transition-all"
                    title="Ver Comprobante Digital"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Ver Recibo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(selectedShift)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl flex items-center space-x-1 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                    title="Descargar Archivo PDF Oficial"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar PDF</span>
                  </button>
                </div>
              )}
            </div>

            <form onSubmit={handlePerformClosing} className="space-y-5">
              
              {/* 1. Conteo Físico de Tequeños Devueltos */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center">
                    <Package className="w-4 h-4 mr-1.5" />
                    1. Conteo de Stock Devuelto & Conciliación Física
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Total Entregado:{' '}
                    <strong className="text-white">
                      {selectedShift.stockItems.reduce((acc, i) => acc + i.deliveredUnits, 0)}u inicial + {selectedShift.totalUnitsRestocked || 0}u restock = {selectedShift.totalUnitsDelivered}u
                    </strong>
                  </span>
                </div>

                {/* Banner de Restocks Realizados en esta Jornada */}
                {selectedShift.restocks && selectedShift.restocks.length > 0 && (
                  <div className="bg-sky-950/40 border border-sky-500/30 rounded-xl p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between font-semibold text-sky-300">
                      <span className="flex items-center space-x-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        <span>Entregas Adicionales (Restocks) durante la Jornada:</span>
                      </span>
                      <span className="font-mono font-bold text-white">+{selectedShift.totalUnitsRestocked} u totales</span>
                    </div>
                    <div className="space-y-1 pt-1">
                      {selectedShift.restocks.map((r) => (
                        <div key={r.id} className="text-[11px] text-slate-300 flex justify-between">
                          <span>
                            • <strong>+{r.quantity} u</strong> {r.varietyName} a las {r.timestamp} (por {r.coordinatorName})
                          </span>
                          <span className="text-slate-400 text-[10px] italic">{r.notes || 'En playa'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2.5">
                  {selectedShift.stockItems.map((item) => {
                    const currentReturned = returnedCounts[item.varietyId]?.count || 0;
                    const currentWaste = returnedCounts[item.varietyId]?.waste || 0;
                    const totalDeliveredForVariety = item.deliveredUnits + (item.reSuppliedUnits || 0);
                    const expectedReturn = totalDeliveredForVariety - item.soldUnits;
                    const diff = expectedReturn - currentReturned - currentWaste;

                    return (
                      <div key={item.varietyId} className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <span className="font-bold text-white text-sm">{item.varietyName}</span>
                          <div className="flex flex-wrap gap-2 text-slate-400 text-[11px]">
                            <span>Inicial: <strong>{item.deliveredUnits}u</strong></span>
                            {item.reSuppliedUnits > 0 && (
                              <span className="text-sky-400">Restock: <strong>+{item.reSuppliedUnits}u</strong></span>
                            )}
                            <span className="text-slate-200">Total: <strong>{totalDeliveredForVariety}u</strong></span>
                            <span className="text-amber-400">Vendidos: <strong>{item.soldUnits}u</strong></span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 items-center pt-1">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">Devueltos Intactos</label>
                            <input
                              type="number"
                              disabled={selectedShift.status === 'liquidada'}
                              value={currentReturned}
                              onChange={(e) => {
                                setReturnedCounts({
                                  ...returnedCounts,
                                  [item.varietyId]: {
                                    ...returnedCounts[item.varietyId],
                                    count: Number(e.target.value)
                                  }
                                });
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white font-bold"
                              min="0"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">Merma / Rotos</label>
                            <input
                              type="number"
                              disabled={selectedShift.status === 'liquidada'}
                              value={currentWaste}
                              onChange={(e) => {
                                setReturnedCounts({
                                  ...returnedCounts,
                                  [item.varietyId]: {
                                    ...returnedCounts[item.varietyId],
                                    waste: Number(e.target.value)
                                  }
                                });
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white"
                              min="0"
                            />
                          </div>

                          <div className="text-right">
                            <span className="block text-[10px] text-slate-400 mb-0.5">Diferencia Física</span>
                            <span className={`font-mono font-bold text-xs ${
                              diff === 0
                                ? 'text-emerald-400'
                                : diff > 0
                                ? 'text-rose-400'
                                : 'text-sky-400'
                            }`}>
                              {diff === 0
                                ? '✓ Cuadra (0 diff)'
                                : diff > 0
                                ? `Faltan ${diff} u`
                                : `Sobran ${Math.abs(diff)} u`}
                            </span>
                          </div>
                        </div>

                        {/* Detalle visual de la ecuación */}
                        <div className="text-[10px] text-slate-500 font-mono pt-0.5 border-t border-slate-900">
                          {totalDeliveredForVariety} entregados - {item.soldUnits} vendidos - {currentReturned} devueltos - {currentWaste} mermas = {diff} diferencia
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Arqueo de Caja de Efectivo */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center">
                  <DollarSign className="w-4 h-4 mr-1.5" />
                  2. Arqueo de Dinero en Efectivo
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Efectivo Esperado (por ventas)</label>
                    <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono font-bold text-white">
                      ${selectedShift.cashExpected.toLocaleString()}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Efectivo Entregado en Mano ($)</label>
                    <input
                      type="number"
                      disabled={selectedShift.status === 'liquidada'}
                      value={cashDeclared}
                      onChange={(e) => setCashDeclared(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs font-mono font-black text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800">
                  <span className="text-slate-400">Diferencia de Caja:</span>
                  <span className={`font-mono font-bold ${
                    cashDeclared - selectedShift.cashExpected >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {cashDeclared - selectedShift.cashExpected === 0
                      ? '✓ Exacto ($0)'
                      : cashDeclared - selectedShift.cashExpected > 0
                      ? `+$${(cashDeclared - selectedShift.cashExpected).toLocaleString()} (Sobrante)`
                      : `-$${Math.abs(cashDeclared - selectedShift.cashExpected).toLocaleString()} (Faltante de caja)`}
                  </span>
                </div>
              </div>

              {/* 3. Nivel de Gas al Retornar */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-slate-300">Nivel de Gas Restante en Garrafa</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    disabled={selectedShift.status === 'liquidada'}
                    value={gasPercentEnd}
                    onChange={(e) => setGasPercentEnd(Number(e.target.value))}
                    className="w-16 bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white font-bold text-center"
                    min="0"
                    max="100"
                  />
                  <span className="text-slate-400">%</span>
                </div>
              </div>

              {/* Botón de Cierre de Jornada */}
              {selectedShift.status === 'en_curso' && (
                <button
                  type="submit"
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm rounded-xl shadow-xl shadow-amber-500/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Realizar Cierre de Jornada & Calcular Liquidación</span>
                </button>
              )}

            </form>
          </div>

          {/* Columna Derecha: Liquidación de Comisión y Pago Final (5 cols) */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Coins className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Liquidación Neta</h2>
              </div>
              <span className="text-xs text-amber-400 font-bold">
                Comisión: {Math.round((commissionDetails?.rate ?? selectedShift.commissionRate) * 100)}%
              </span>
            </div>

            {/* Desglose Matemático de Liquidación */}
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center p-2.5 bg-slate-950/70 rounded-xl border border-slate-800">
                <span className="text-slate-300">Ventas Brutas Totales:</span>
                <span className="font-mono font-bold text-white">${selectedShift.totalGrossSales.toLocaleString()}</span>
              </div>

              {/* Tramo de Comisión Aplicado */}
              <div className="p-3 bg-gradient-to-r from-amber-950/30 to-slate-950/70 rounded-xl border border-amber-500/25 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 flex items-center space-x-1.5">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tramo de Recompensas:</span>
                  </span>
                  <span className="text-amber-400 font-bold text-[11px] bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                    {commissionDetails?.tierName}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-800/80">
                  <span className="text-slate-300">
                    Comisión Bruta ({Math.round((commissionDetails?.rate ?? selectedShift.commissionRate) * 100)}% sobre ventas):
                  </span>
                  <span className="font-mono font-bold text-emerald-400">
                    +${(commissionDetails?.grossCommission ?? selectedShift.grossCommission).toLocaleString()}
                  </span>
                </div>
                {commissionDetails?.salesToNextTier && commissionDetails.salesToNextTier > 0 && selectedShift.status === 'en_curso' && (
                  <div className="text-[11px] text-sky-300 bg-sky-950/40 border border-sky-500/20 p-2 rounded-lg flex items-center justify-between">
                    <span>Próximo escalón ({Math.round((commissionDetails.nextTier?.rate || 0) * 100)}%):</span>
                    <span className="font-bold">Faltan ${commissionDetails.salesToNextTier.toLocaleString()} en ventas</span>
                  </div>
                )}
                {commissionDetails?.isHistorical && (
                  <div className="text-[10px] text-slate-400 italic">
                    * Liquidación histórica congelada con el porcentaje y reglas del momento de su cierre.
                  </div>
                )}
              </div>

              {/* Deducción por Costo de Vivienda */}
              <div className={`flex justify-between items-center p-2.5 rounded-xl border ${
                selectedShift.housingCostExempt
                  ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300'
              }`}>
                <span>Costo Diario de Vivienda:</span>
                <span className="font-mono font-bold">
                  {selectedShift.housingCostExempt ? (
                    <span className="text-[11px] bg-emerald-900/60 px-2 py-0.5 rounded text-emerald-300">
                      $0 (Exento por Admin)
                    </span>
                  ) : (
                    `-$${(selectedShift.housingCostDeduction || state.systemConfig?.housingCostPerPersonDaily || 8000).toLocaleString()}`
                  )}
                </span>
              </div>

              {selectedShift.deductionsForMissingUnits > 0 && (
                <div className="flex justify-between items-center p-2.5 bg-rose-950/30 rounded-xl border border-rose-800/40 text-rose-300">
                  <span>Deducción por Faltante de Unidades:</span>
                  <span className="font-mono font-bold">-${selectedShift.deductionsForMissingUnits.toLocaleString()}</span>
                </div>
              )}

              {selectedShift.incentivesOrBonuses > 0 && (
                <div className="flex justify-between items-center p-2.5 bg-emerald-950/30 rounded-xl border border-emerald-800/40 text-emerald-300">
                  <span>Incentivo por Objetivo:</span>
                  <span className="font-mono font-bold">+${selectedShift.incentivesOrBonuses.toLocaleString()}</span>
                </div>
              )}

              {/* Total Neto a Cobrar */}
              <div className="p-4 bg-gradient-to-br from-amber-500/15 to-emerald-500/15 border border-amber-500/30 rounded-2xl space-y-1">
                <div className="text-xs text-slate-300 uppercase font-semibold">Total a Pagar al Vendedor:</div>
                <div className="text-2xl font-black text-white font-mono">
                  ${selectedShift.finalPayoutAmount.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-400">
                  Estado: <strong className="text-amber-400 uppercase">{selectedShift.payoutStatus}</strong>
                </p>
              </div>
            </div>

            {/* Acción de Pago y Firma */}
            {selectedShift.payoutStatus === 'pendiente' ? (
              <button
                type="button"
                onClick={() => handlePayCommission(selectedShift.id)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Coins className="w-4 h-4" />
                <span>Pagar Comisión & Emitir Comprobante</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-950/40 border border-emerald-600/40 rounded-xl text-xs text-emerald-300 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Liquidación pagada el {selectedShift.payoutTimestamp} ({selectedShift.payoutPaymentProof})</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setReceiptShift(selectedShift); setShowReceiptModal(true); }}
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ver Comprobante</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(selectedShift)}
                    className="py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar PDF</span>
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {/* HISTORIAL Y CONSULTA POSTERIOR DE COMPROBANTES Y LIQUIDACIONES */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center">
              <FileText className="w-5 h-5 text-amber-400 mr-2" />
              Historial de Comprobantes & Liquidaciones
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Consulta y descarga oficial de liquidaciones cerradas para auditoría, coordinadores y administración
            </p>
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por vendedor, fecha, folio..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Tabla de comprobantes emitidos */}
        {shifts.filter((s) => {
          const isClosed = s.status === 'conciliada' || s.status === 'liquidada';
          if (!isClosed) return false;
          if (currentUser.role === 'seller') return s.sellerId === currentUser.id;
          if (!historySearch.trim()) return true;
          const query = historySearch.toLowerCase();
          return (
            s.sellerName.toLowerCase().includes(query) ||
            s.date.includes(query) ||
            s.id.toLowerCase().includes(query) ||
            s.cartCode.toLowerCase().includes(query) ||
            (s.houseName && s.houseName.toLowerCase().includes(query))
          );
        }).length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            No se encontraron comprobantes de liquidación cerrados con el criterio de búsqueda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Folio / Fecha</th>
                  <th className="py-2.5 px-3">Vendedor</th>
                  <th className="py-2.5 px-3">Puesto & Zona</th>
                  <th className="py-2.5 px-3 text-right">Balance Unidades</th>
                  <th className="py-2.5 px-3 text-right">Ventas Totales</th>
                  <th className="py-2.5 px-3 text-right">Comisión Neta</th>
                  <th className="py-2.5 px-3 text-center">Estado Pago</th>
                  <th className="py-2.5 px-3 text-center">Comprobante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {shifts.filter((s) => {
                  const isClosed = s.status === 'conciliada' || s.status === 'liquidada';
                  if (!isClosed) return false;
                  if (currentUser.role === 'seller') return s.sellerId === currentUser.id;
                  if (!historySearch.trim()) return true;
                  const query = historySearch.toLowerCase();
                  return (
                    s.sellerName.toLowerCase().includes(query) ||
                    s.date.includes(query) ||
                    s.id.toLowerCase().includes(query) ||
                    s.cartCode.toLowerCase().includes(query) ||
                    (s.houseName && s.houseName.toLowerCase().includes(query))
                  );
                }).map((shift) => (
                  <tr key={shift.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-mono font-bold text-white">{shift.id}</div>
                      <div className="text-[10px] text-slate-400">{shift.date}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-200">{shift.sellerName}</div>
                      <div className="text-[10px] text-slate-400">{shift.houseName}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-slate-200 font-medium">{shift.cartCode}</div>
                      <div className="text-[10px] text-slate-400">{shift.zoneName}</div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="font-bold text-amber-400">{shift.totalUnitsSold} vend.</div>
                      <div className="text-[10px] text-slate-400">
                        {shift.totalUnitsDelivered} ent. {shift.totalUnitsRestocked > 0 ? `(+${shift.totalUnitsRestocked} rst.)` : ''} • {shift.totalUnitsReturned} sob.
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-white">
                      ${shift.totalGrossSales.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                      ${shift.finalPayoutAmount.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        shift.payoutStatus === 'pagado'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {shift.payoutStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => { setReceiptShift(shift); setShowReceiptModal(true); }}
                          title="Ver Comprobante Digital"
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-medium transition-colors"
                        >
                          Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(shift)}
                          title="Descargar Comprobante en PDF"
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[11px] flex items-center space-x-1 shadow-sm transition-all cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Recibo Digital de Liquidación */}
      {showReceiptModal && receiptShift && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-slate-200 my-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <span className="text-xl">🌮</span>
                <div>
                  <span className="font-black text-white text-base block">Comprobante de Liquidación Digital</span>
                  <span className="text-[11px] text-slate-400 font-mono">Folio: {receiptShift.id}</span>
                </div>
              </div>
              <button onClick={() => setShowReceiptModal(false)} className="text-slate-400 hover:text-white p-1">✕</button>
            </div>

            {/* Notificación de descarga rápida si acaba de ocurrir */}
            {downloadSuccessMessage && (
              <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{downloadSuccessMessage}</span>
              </div>
            )}

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 font-mono text-xs max-h-[60vh] overflow-y-auto">
              {/* Encabezado y Datos de Identificación */}
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-amber-400">Jornada: {receiptShift.id}</span>
                <span>{receiptShift.date} ({receiptShift.startTime} - {receiptShift.endTime || 'Cierre'})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Vendedor:</span>
                <span className="text-white font-bold">{receiptShift.sellerName} (ID: {receiptShift.sellerId})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Base / Carrito / Zona:</span>
                <span className="text-white">{receiptShift.houseName} • {receiptShift.cartCode} • {receiptShift.zoneName}</span>
              </div>

              {/* Ventas y Medios de Pago */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="text-[11px] uppercase font-bold text-slate-300 mb-1.5">Recaudación y Métodos de Pago</div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Ventas Totales Brutas:</span>
                  <span className="text-white font-bold">${receiptShift.totalGrossSales.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Efectivo Recaudado:</span>
                  <span>${receiptShift.totalCashSales.toLocaleString()} (Decl: ${(receiptShift.cashDeclared || receiptShift.cashExpected).toLocaleString()})</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Mercado Pago / Transferencia:</span>
                  <span>${receiptShift.totalMpSales.toLocaleString()} (Validado: ${(receiptShift.mpValidatedAmount || receiptShift.totalMpSales).toLocaleString()})</span>
                </div>
              </div>

              {/* Balance de Productos */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="text-[11px] uppercase font-bold text-slate-300 mb-1.5">Balance de Unidades</div>
                <div className="grid grid-cols-2 gap-y-1 text-[11px]">
                  <div><span className="text-slate-400">Entregados:</span> <strong className="text-white">{receiptShift.totalUnitsDelivered} u</strong></div>
                  <div><span className="text-slate-400">Restock:</span> <strong className="text-white">{receiptShift.totalUnitsRestocked || 0} u {receiptShift.totalUnitsRestocked > 0 ? '(Sí)' : '(No)'}</strong></div>
                  <div><span className="text-slate-400">Vendidos:</span> <strong className="text-amber-400">{receiptShift.totalUnitsSold} u</strong></div>
                  <div><span className="text-slate-400">Sobrantes:</span> <strong className="text-white">{receiptShift.totalUnitsReturned} u</strong></div>
                  <div><span className="text-slate-400">Mermas:</span> <strong className="text-white">{receiptShift.totalUnitsWaste || 0} u</strong></div>
                  <div>
                    <span className="text-slate-400">Diferencias:</span>{' '}
                    <strong className={receiptShift.totalUnitsDifference > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                      {receiptShift.totalUnitsDifference || 0} u {receiptShift.totalUnitsDifference > 0 ? '(Faltante)' : ''}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Liquidación de Comisión y Deducciones */}
              <div className="pt-2 border-t border-slate-800/80 space-y-1">
                <div className="text-[11px] uppercase font-bold text-slate-300 mb-1">Liquidación de Comisión</div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tramo Aplicado:</span>
                  <span className="text-amber-300 font-bold">
                    {receiptShift.appliedCommissionTierName || `Tramo ${Math.round(receiptShift.commissionRate * 100)}%`} ({Math.round(receiptShift.commissionRate * 100)}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Comisión Bruta:</span>
                  <span className="text-emerald-400 font-bold">+${receiptShift.grossCommission.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Deducción Vivienda:</span>
                  <span className="text-rose-400 font-bold">
                    {receiptShift.housingCostExempt ? '$0 (Exento autorizado)' : `-$${(receiptShift.housingCostDeduction || 8000).toLocaleString()}`}
                  </span>
                </div>
                {receiptShift.deductionsForMissingUnits > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Deducción Faltantes:</span>
                    <span className="text-rose-400 font-bold">-${receiptShift.deductionsForMissingUnits.toLocaleString()}</span>
                  </div>
                )}
                {receiptShift.incentivesOrBonuses > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Incentivos / Bonos:</span>
                    <span className="text-emerald-400 font-bold">+${receiptShift.incentivesOrBonuses.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-800 pt-2 text-emerald-400 font-bold text-sm">
                  <span>Importe Final a Pagar:</span>
                  <span>${receiptShift.finalPayoutAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px] pt-1">
                  <span className="text-slate-400">Estado de Liquidación:</span>
                  <span className="text-amber-400 font-bold uppercase">{receiptShift.status} • {receiptShift.payoutStatus}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-[11px] text-slate-400 pt-2">
              <span>Coordinador: {receiptShift.coordinatorSignature || currentUser.name}</span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl flex items-center space-x-1.5 transition-colors cursor-pointer"
                  title="Abrir diálogo de impresión"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(receiptShift)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center space-x-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                  title="Descargar archivo PDF real en tu dispositivo"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar como PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
