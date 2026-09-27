/**
 * SGMO — Tequeños Costa
 * Laboratorio de Pruebas Integradas de Mercado Pago y Generador de Comprobantes Oficiales
 * Permite simular ventas, generar comprobantes en Canvas HD, crear Links de Sandbox oficiales y consultar pagos en vivo.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Download,
  CreditCard,
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Copy,
  RefreshCw,
  HelpCircle,
  FileText,
  Smartphone,
  Flame,
  Check,
  Camera,
  Layers,
  Info
} from 'lucide-react';
import {
  generateTestVoucherImage,
  createMercadoPagoPreference,
  getMercadoPagoRecentPayments,
  checkMercadoPagoConfigStatus,
  MercadoPagoPaymentItem,
  MercadoPagoStatusResponse,
  MercadoPagoPreferenceResponse
} from '../services/aiValidationService';
import { runFullPaymentDiagnostic, PaymentDiagnosticResult } from '../utils/paymentTest';
import { ProductVariety } from '../types';

interface MercadoPagoTestLabModalProps {
  isOpen: boolean;
  onClose: () => void;
  varieties: ProductVariety[];
  onUseVoucherInTerminal?: (base64Image: string, expectedAmount: number, operationId: string) => void;
}

export const MercadoPagoTestLabModal: React.FC<MercadoPagoTestLabModalProps> = ({
  isOpen,
  onClose,
  varieties,
  onUseVoucherInTerminal
}) => {
  const [activeTab, setActiveTab] = useState<'voucher' | 'checkout' | 'payments' | 'guide'>('voucher');

  // Estado del servidor y cuenta MP
  const [mpStatus, setMpStatus] = useState<MercadoPagoStatusResponse | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  // Estados del Generador de Comprobante
  const [voucherAmount, setVoucherAmount] = useState<number>(7500);
  const [voucherLabel, setVoucherLabel] = useState<string>('Combo x6 Tequeños (Clásicos)');
  const [voucherSender, setVoucherSender] = useState<string>('Comprador de Prueba (Sandbox)');
  const [voucherOpId, setVoucherOpId] = useState<string>(() => String(Math.floor(1000000000 + Math.random() * 9000000000)));
  const [generatedVoucherDataUrl, setGeneratedVoucherDataUrl] = useState<string>('');
  const [copiedOpId, setCopiedOpId] = useState(false);

  // Estados de Checkout Preference
  const [isCreatingPref, setIsCreatingPref] = useState(false);
  const [preferenceResult, setPreferenceResult] = useState<MercadoPagoPreferenceResponse | null>(null);
  const [copiedPrefLink, setCopiedPrefLink] = useState(false);

  // Estados de Pagos Recientes
  const [recentPayments, setRecentPayments] = useState<MercadoPagoPaymentItem[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [copiedRecentId, setCopiedRecentId] = useState<string | null>(null);
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<{ allPassed: boolean; results: PaymentDiagnosticResult[] } | null>(null);

  const handleRunDiagnostic = async () => {
    setIsRunningDiagnostic(true);
    try {
      const res = await runFullPaymentDiagnostic(voucherOpId, voucherAmount);
      setDiagnosticResult(res);
      // Actualizar también estado y pagos
      await loadStatus();
      await loadRecentPayments();
    } catch (e) {
      console.error('Error al correr diagnóstico:', e);
    } finally {
      setIsRunningDiagnostic(false);
    }
  };

  // Cargar estado inicial
  useEffect(() => {
    if (isOpen) {
      loadStatus();
      loadRecentPayments();
    }
  }, [isOpen]);

  const loadStatus = async () => {
    setIsLoadingStatus(true);
    const st = await checkMercadoPagoConfigStatus();
    setMpStatus(st);
    setIsLoadingStatus(false);
  };

  const loadRecentPayments = async () => {
    setIsLoadingPayments(true);
    const res = await getMercadoPagoRecentPayments();
    if (res.success) {
      setRecentPayments(res.payments);
    }
    setIsLoadingPayments(false);
  };

  // Regenerar imagen de comprobante cuando cambian los parámetros
  useEffect(() => {
    if (isOpen) {
      const dataUrl = generateTestVoucherImage({
        operationId: voucherOpId,
        amount: voucherAmount,
        senderName: voucherSender,
        destinationAccount: 'Tequeños Costa SRL',
        varietyLabel: voucherLabel
      });
      setGeneratedVoucherDataUrl(dataUrl);
    }
  }, [voucherAmount, voucherLabel, voucherSender, voucherOpId, isOpen]);

  // Generar nuevo ID aleatorio
  const handleRandomizeId = () => {
    setVoucherOpId(String(Math.floor(1000000000 + Math.random() * 9000000000)));
  };

  // Descargar comprobante en JPG
  const handleDownloadVoucher = () => {
    if (!generatedVoucherDataUrl) return;
    const a = document.createElement('a');
    a.href = generatedVoucherDataUrl;
    a.download = `Comprobante_MercadoPago_${voucherOpId}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Enviar a la terminal de ventas para escaneo directo
  const handleApplyToTerminal = () => {
    if (!generatedVoucherDataUrl) return;
    if (onUseVoucherInTerminal) {
      onUseVoucherInTerminal(generatedVoucherDataUrl, voucherAmount, voucherOpId);
      onClose();
    }
  };

  // Crear Link de Checkout Sandbox
  const handleCreatePreference = async () => {
    setIsCreatingPref(true);
    setPreferenceResult(null);

    const res = await createMercadoPagoPreference({
      title: voucherLabel,
      amount: voucherAmount,
      quantity: 1,
      payerEmail: 'comprador.prueba@testuser.com'
    });

    setPreferenceResult(res);
    setIsCreatingPref(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-5 sm:p-7 shadow-2xl space-y-5 my-6 max-h-[92vh] flex flex-col">
        
        {/* Encabezado */}
        <div className="border-b border-slate-800 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/25">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg sm:text-xl font-black text-white">
                    Laboratorio de Pruebas Mercado Pago
                  </h2>
                  {mpStatus && (
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold ${
                      mpStatus.configured
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {mpStatus.configured ? 'Cuenta Sandbox Conectada' : 'Modo Simulación'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Generador de comprobantes oficiales con OCR, links de cobro sandbox y resolución de dudas sobre transferencias.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleRunDiagnostic}
                disabled={isRunningDiagnostic}
                className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 text-xs font-black rounded-xl shadow-md flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 transition-all"
                title="Ejecuta una auditoría completa del backend e imprime los resultados en la consola de desarrollador (F12)"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRunningDiagnostic ? 'animate-spin' : ''}`} />
                <span>{isRunningDiagnostic ? 'Auditan...' : '🧪 Probar Backend (F12)'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Banner de resultado del diagnóstico */}
          {diagnosticResult && (
            <div className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-2 animate-fadeIn ${
              diagnosticResult.allPassed
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
            }`}>
              <div className="flex items-center space-x-2">
                {diagnosticResult.allPassed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>
                  {diagnosticResult.allPassed
                    ? 'Diagnóstico exitoso: Autorización y comunicación con el backend 100% operativas.'
                    : 'Atención: Se detectaron advertencias o fallos. Abrí la Consola F12 para ver el reporte detallado.'}
                </span>
              </div>
              <span className="text-[10px] font-mono opacity-80 shrink-0">
                Ver F12 Console
              </span>
            </div>
          )}

          {/* Resumen de la Cuenta Conectada si existe */}
          {mpStatus?.accountInfo && (
            <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between text-xs gap-2">
              <div className="flex items-center space-x-2 text-slate-300">
                <Smartphone className="w-4 h-4 text-sky-400" />
                <span>Cuenta Vendedora: <strong className="text-white">{mpStatus.accountInfo.nickname}</strong></span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">ID Vendedor: <strong className="text-sky-300 font-mono">{mpStatus.accountInfo.id}</strong></span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">{mpStatus.accountInfo.email}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 bg-sky-950 text-sky-300 border border-sky-800 rounded-lg font-mono">
                País: {mpStatus.accountInfo.countryId} ({mpStatus.accountInfo.siteId})
              </span>
            </div>
          )}
        </div>

        {/* Navegación por Pestañas */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 border-b border-slate-800 text-xs font-semibold scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('voucher')}
            className={`px-4 py-2.5 rounded-xl flex items-center space-x-2 cursor-pointer transition-all whitespace-nowrap ${
              activeTab === 'voucher'
                ? 'bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>1. Generador de Comprobante (OCR)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('checkout')}
            className={`px-4 py-2.5 rounded-xl flex items-center space-x-2 cursor-pointer transition-all whitespace-nowrap ${
              activeTab === 'checkout'
                ? 'bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>2. Pago Real Sandbox (Checkout Pro)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2.5 rounded-xl flex items-center space-x-2 cursor-pointer transition-all whitespace-nowrap ${
              activeTab === 'payments'
                ? 'bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>3. Pagos Recibidos en Cuenta ({recentPayments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`px-4 py-2.5 rounded-xl flex items-center space-x-2 cursor-pointer transition-all whitespace-nowrap ${
              activeTab === 'guide'
                ? 'bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span>¿Por qué falla el CVU en Sandbox?</span>
          </button>
        </div>

        {/* CONTENIDO DE PESTAÑAS */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-4" style={{ height: '382.75px' }}>

          {/* =========================================================================
              PESTAÑA 1: GENERADOR DE COMPROBANTES OFICIALES
              ========================================================================= */}
          {activeTab === 'voucher' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Controles de Configuración del Comprobante */}
              <div className="lg:col-span-6 space-y-4">
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center">
                    <Sparkles className="w-4 h-4 text-amber-400 mr-2" />
                    Personalizar Datos de la Venta de Prueba
                  </h3>

                  {/* Atajos Rápidos de Combos */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      Seleccionar Producto o Combo
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Combo x3 Tequeños', amount: 4000 },
                        { label: 'Combo x6 Tequeños', amount: 7500 },
                        { label: 'Promo x12 Tequeños', amount: 14000 },
                        { label: '1 Tequeño Individual', amount: 1500 }
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            setVoucherAmount(item.amount);
                            setVoucherLabel(item.label);
                          }}
                          className={`p-2.5 rounded-xl text-left border text-xs transition-all cursor-pointer ${
                            voucherAmount === item.amount
                              ? 'bg-sky-500/20 border-sky-400 text-sky-200 ring-1 ring-sky-400'
                              : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="font-bold">{item.label}</div>
                          <div className="text-emerald-400 font-mono text-[11px]">${item.amount.toLocaleString()}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Importe Manual */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Importe Transferido ($)
                    </label>
                    <input
                      type="number"
                      value={voucherAmount}
                      onChange={(e) => setVoucherAmount(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-emerald-400 font-bold focus:outline-none focus:border-sky-400"
                    />
                  </div>

                  {/* Número de Operación */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-300">
                        Número de Operación (10 dígitos)
                      </label>
                      <button
                        type="button"
                        onClick={handleRandomizeId}
                        className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold cursor-pointer flex items-center space-x-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Generar nuevo</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={voucherOpId}
                        onChange={(e) => setVoucherOpId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-sky-400"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(voucherOpId);
                          setCopiedOpId(true);
                          setTimeout(() => setCopiedOpId(false), 2000);
                        }}
                        className="absolute right-2 top-2 text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800"
                      >
                        {copiedOpId ? '¡Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  </div>

                  {/* Nombre del Comprador */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Titular Comprador
                    </label>
                    <input
                      type="text"
                      value={voucherSender}
                      onChange={(e) => setVoucherSender(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
                    />
                  </div>
                </div>

                {/* Botones de Acción de Prueba */}
                <div className="space-y-2">
                  {onUseVoucherInTerminal && (
                    <button
                      type="button"
                      onClick={handleApplyToTerminal}
                      className="w-full py-3.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-sky-500/25 flex items-center justify-center space-x-2 cursor-pointer transition-all"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Cargar y Probar en Terminal de Venta (OCR con Gemini)</span>
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadVoucher}
                      className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-emerald-400" />
                      <span>Descargar JPG</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        // Cambiar el importe a uno inconsistente
                        setVoucherAmount(3000);
                      }}
                      className="p-2.5 bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 font-bold text-xs rounded-xl border border-amber-600/40 flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Probar Inconsistencia ($3.000)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Vista Previa del Comprobante Generado */}
              <div className="lg:col-span-6 flex flex-col items-center">
                <div className="text-center mb-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Comprobante Renderizado en Alta Definición
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Idéntico al formato oficial de la app Mercado Pago Argentina
                  </p>
                </div>

                <div className="relative rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl max-w-xs sm:max-w-sm w-full bg-slate-950">
                  {generatedVoucherDataUrl ? (
                    <img
                      src={generatedVoucherDataUrl}
                      alt="Comprobante Mercado Pago"
                      className="w-full h-auto object-contain block select-none"
                    />
                  ) : (
                    <div className="p-12 text-center text-slate-500">Generando vista...</div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* =========================================================================
              PESTAÑA 2: CHECKOUT REAL MERCADO PAGO SANDBOX (PREFERENCES)
              ========================================================================= */}
          {activeTab === 'checkout' && (
            <div className="space-y-4">
              {/* Alerta de Resolución de Error Común en Sandbox */}
              <div className="p-4 bg-amber-950/40 border border-amber-500/50 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center space-x-2 text-amber-400 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>¿Te sale el error «Oh, no, algo ha salido mal» al pagar?</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Mercado Pago emite credenciales de prueba con prefijo <code className="text-amber-300 font-mono">APP_USR-</code> en cuentas nuevas. Para probar el pago sin error, seguí estas dos reglas:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-[11px]">
                  <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                    <strong className="text-amber-300 block">1. 🕵️‍♂️ Ventana de Incógnito Obligatoria:</strong>
                    <span className="text-slate-400 leading-snug block">
                      Si tenés abierta tu cuenta personal de Mercado Pago en tu navegador, MP rechaza la compra porque <em>no podés pagarte a vos mismo</em>. Siempre abrí el enlace en <strong>Modo Incógnito</strong>.
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                    <strong className="text-amber-300 block">2. 💳 Usar Checkout Directo:</strong>
                    <span className="text-slate-400 leading-snug block">
                      Al tener credenciales <code className="text-sky-300 font-mono">APP_USR-</code>, el enlace de Checkout Directo oficial procesa la preferencia generada sin conflicto de versión.
                    </span>
                  </div>
                </div>
              </div>

              {/* Botón para generar enlace */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Generar Enlace Oficial de Mercado Pago
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      Producto: {voucherLabel} • Importe: ${voucherAmount.toLocaleString()}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreatePreference}
                    disabled={isCreatingPref}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    {isCreatingPref ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ExternalLink className="w-4 h-4" />
                    )}
                    <span>{isCreatingPref ? 'Creando en MP...' : 'Generar Link de Pago'}</span>
                  </button>
                </div>

                {preferenceResult?.success && (preferenceResult.initPoint || preferenceResult.sandboxInitPoint) && (
                  <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/50 rounded-xl space-y-2.5 text-xs animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-300 flex items-center">
                        <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-400" />
                        ¡Preferencia de Pago Creada con Éxito!
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">ID: {preferenceResult.preferenceId}</span>
                    </div>

                    <p className="text-[11px] text-slate-300">
                      Copiá el enlace y abrilo en una <strong>Ventana de Incógnito</strong> para evitar conflicto de cookies:
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const targetUrl = preferenceResult.initPoint || preferenceResult.sandboxInitPoint;
                          if (targetUrl) {
                            navigator.clipboard.writeText(targetUrl);
                            setCopiedPrefLink(true);
                            setTimeout(() => setCopiedPrefLink(false), 2500);
                          }
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black rounded-lg flex items-center space-x-1.5 cursor-pointer shadow-md text-xs"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedPrefLink ? '¡Enlace Copiado al Portapapeles!' : 'Copiar Link (Incógnito)'}</span>
                      </button>

                      {preferenceResult.initPoint && (
                        <a
                          href={preferenceResult.initPoint}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg flex items-center space-x-1.5 cursor-pointer text-xs"
                        >
                          <span>Abrir Checkout Oficial</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      {preferenceResult.sandboxInitPoint && (
                        <a
                          href={preferenceResult.sandboxInitPoint}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg flex items-center space-x-1.5 cursor-pointer text-xs"
                        >
                          <span>Abrir Sandbox Alt</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Tarjetas de Prueba Oficiales de Mercado Pago */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center">
                    <CreditCard className="w-4 h-4 text-sky-400 mr-2" />
                    Tarjetas de Prueba Oficiales de Mercado Pago (Argentina)
                  </h4>
                  <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    Titular obligatorio: APRO
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  En la pantalla de pago elegí <strong>«Nueva Tarjeta»</strong>. Es crucial completar todos los campos con los valores indicados abajo:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1.5">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                      ✅ Tarjeta Aprobada al Instante (Visa)
                    </span>
                    <div className="font-mono text-sm text-white font-bold tracking-wider">
                      4025 8011 2233 4455
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-300 pt-1 border-t border-slate-800">
                      <span>Vencimiento: <strong>11/28</strong></span>
                      <span>CVV: <strong>123</strong></span>
                      <span>Titular: <strong className="text-emerald-400">APRO</strong></span>
                      <span>DNI: <strong>35123456</strong></span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1.5">
                    <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">
                      ❌ Tarjeta para Probar Rechazo / Fondos Insuficientes
                    </span>
                    <div className="font-mono text-sm text-white font-bold tracking-wider">
                      4025 8011 2233 4463
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-300 pt-1 border-t border-slate-800">
                      <span>Vencimiento: <strong>11/28</strong></span>
                      <span>CVV: <strong>123</strong></span>
                      <span>Titular: <strong className="text-rose-400">CONT</strong></span>
                      <span>DNI: <strong>35123456</strong></span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-sky-950/30 border border-sky-800/40 rounded-xl text-[11px] text-slate-300 space-y-1">
                  <div className="font-bold text-sky-400 flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>¿Querés probar la app al 100% sin depender del checkout externo de MP?</span>
                  </div>
                  <p className="text-slate-400 leading-snug">
                    Andá a la pestaña <strong>«1. Generador de Comprobante»</strong> y hacé clic en <strong>«Usar en Terminal de Ventas»</strong>. Esto carga automáticamente el comprobante en la caja, dispara el OCR de Gemini y te permite completar la venta sin tener que pelear con las cookies ni el checkout externo de MP.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              PESTAÑA 3: PAGOS RECIBIDOS EN CUENTA
              ========================================================================= */}
          {activeTab === 'payments' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Transacciones Recientes en tu Cuenta MP</h3>
                  <p className="text-[11px] text-slate-400">
                    Consultado en vivo desde la API de Mercado Pago mediante el Access Token configurado.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadRecentPayments}
                  disabled={isLoadingPayments}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPayments ? 'animate-spin' : ''}`} />
                  <span>Actualizar</span>
                </button>
              </div>

              {recentPayments.length === 0 ? (
                <div className="p-8 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-3">
                  <FileText className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-300 font-medium">
                    Aún no hay cobros registrados en tu cuenta de prueba de Mercado Pago.
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                    Esto es normal porque recién estás empezando las pruebas. Podés generar un pago con la pestaña <strong>"2. Pago Real Sandbox"</strong> o usar el <strong>"1. Generador de Comprobantes"</strong> para probar la lectura de IA en la Terminal de Ventas.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentPayments.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-white text-sm">#{p.id}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            p.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {p.status}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px]">
                          {p.payerName} ({p.payerEmail}) • {new Date(p.dateCreated).toLocaleString('es-AR')}
                        </p>
                      </div>

                      <div className="text-right flex items-center space-x-3">
                        <span className="font-bold text-emerald-400 text-sm">
                          ${p.amount.toLocaleString('es-AR')}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(p.id);
                            setCopiedRecentId(p.id);
                            setTimeout(() => setCopiedRecentId(null), 2000);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                        >
                          {copiedRecentId === p.id ? '¡Copiado!' : 'Copiar ID'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              PESTAÑA 4: GUÍA Y SOLUCIÓN AL ERROR DE CVU EN SANDBOX
              ========================================================================= */}
          {activeTab === 'guide' && (
            <div className="space-y-4 text-xs leading-relaxed">
              <div className="p-4 bg-amber-950/30 border border-amber-600/40 rounded-2xl space-y-2 text-amber-200">
                <div className="flex items-center space-x-2 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  <span>¿Por qué la app de Mercado Pago mostró el error de CVU?</span>
                </div>
                <p>
                  Cuando entraste a la app de Mercado Pago e intentaste transferir desde la cuenta de prueba, te apareció:
                  <br />
                  <em className="font-mono text-[11px] bg-slate-950/60 px-2 py-0.5 rounded text-amber-300">
                    "Activé tu CVU y transferí al instante... estamos procesando tus datos te avisaremos cuando estén listos"
                  </em>
                  <br />
                  Y al transferir por CVU/Alias saltó:
                  <em className="font-mono text-[11px] bg-slate-950/60 px-2 py-0.5 rounded text-amber-300">
                    "No funciona por ahora y que vuelva a intentarlo más tarde"
                  </em>.
                </p>
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1 text-slate-300 text-[11px]">
                  <strong className="text-white">Causa técnica:</strong>
                  <p>
                    Las cuentas de prueba (sandbox) de Mercado Pago son <strong>cuentas virtuales de desarrollo</strong>. En Argentina, para tener un CVU o Alias activo que pueda hacer transferencias interbancarias se requiere validación biométrica de RENAPER y registración en COELSA (Cámara Compensadora Bancaria). Como las cuentas de prueba son ficticias, <strong>Mercado Pago bloquea la función de transferencias bancarias por CVU entre cuentas de sandbox</strong>.
                  </p>
                </div>
              </div>

              {/* Pasos correctos para probar */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center">
                  <Check className="w-4 h-4 text-emerald-400 mr-2" />
                  ¿Cómo hacer las pruebas paso a paso?
                </h4>

                <div className="space-y-3 text-slate-300 text-[11px]">
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                    <strong className="text-sky-300 text-xs">Paso 1: Probar el flujo del Vendedor en la Playa con la Cámara / OCR de IA</strong>
                    <p>
                      1. Andá a la pestaña <strong>"1. Generador de Comprobante"</strong> de este laboratorio.<br />
                      2. Hacé clic en <strong>"Cargar y Probar en Terminal de Venta"</strong> (o descargá el JPG si querés probar subirlo desde galería o fotografiando tu pantalla).<br />
                      3. En la Terminal de Venta verás cómo Gemini OCR lee instantáneamente el número de operación y el importe, asignando el tilde verde de validación.<br />
                      4. Hacé clic en el botón gigante <strong>"COBRAR"</strong> para registrar la venta.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                    <strong className="text-sky-300 text-xs">Paso 2: Probar la Detección Anti-Fraude (Doble Gasto)</strong>
                    <p>
                      1. Con el mismo número de operación del paso anterior, intentá cobrar una segunda venta.<br />
                      2. Observá cómo el sistema detecta de inmediato el intento de doble cobro y activa el semáforo rojo:
                      <em className="text-rose-400 font-bold block mt-0.5">"¡ALERTA DE FRAUDE! El número de operación ya fue utilizado en otra venta registrada en el sistema."</em>
                    </p>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                    <strong className="text-sky-300 text-xs">Paso 3: Probar un Cobro Real Sandbox en Mercado Pago</strong>
                    <p>
                      1. Andá a la pestaña <strong>"2. Pago Real Sandbox"</strong>.<br />
                      2. Hacé clic en <strong>"Generar Link de Pago Sandbox"</strong> y abrí el link.<br />
                      3. En la pantalla oficial de Mercado Pago, ingresá con tu cuenta de comprador de prueba o usá la tarjeta Visa de prueba (<code>4025 8011 2233 4455</code>, vencimiento <code>11/28</code>, CVV <code>123</code>, Titular <code>APRO</code>).<br />
                      4. Mercado Pago aprobará el pago y te dará el ID de 10 dígitos (ej: <code>1029384756</code>).<br />
                      5. Ingresá ese ID en la Terminal de Venta o consultalo en la pestaña "Pagos Recibidos". Verás que la API oficial en vivo confirma que está acreditado en tu cuenta.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                    <strong className="text-sky-300 text-xs">Paso 4: Auditoría del Coordinador</strong>
                    <p>
                      1. Ingresá al módulo <strong>"Validar Comprobantes"</strong> en la barra superior.<br />
                      2. Vas a ver todos los comprobantes registrados, las alertas de inconsistencia y el botón para re-consultar en vivo contra la API de Mercado Pago.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Pie del Modal */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-3">
          <span className="text-[11px] text-slate-500">
            Ambiente de pruebas oficial de Tequeños Costa & Mercado Pago
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
          >
            Cerrar Laboratorio
          </button>
        </div>

      </div>
    </div>
  );
};
