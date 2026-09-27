/**
 * SGMO — Tequeños Costa
 * Terminal Móvil PWA para Vendedores Ambulantes y Coordinadores en Jornada de Venta
 * Diseñado con alto contraste, touch targets generosos y flujo ágil bajo la luz solar
 */

import React, { useState, useRef, useMemo } from 'react';
import {
  Store,
  DollarSign,
  Smartphone,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Package,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Send,
  Image as ImageIcon,
  Eye,
  X,
  Plus,
  Minus,
  Coins,
  Scale,
  FileText,
  Check,
  ClipboardList,
  Clock,
  ArrowRight,
  UserCheck,
  Award,
  Waves,
  MapPin,
  Compass,
  Sun,
  Wind,
  CreditCard,
  QrCode,
  Copy,
  CheckCheck,
  ExternalLink,
  Shield,
  Loader2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AppState, storageService } from '../services/storageService';
import {
  analyzeVoucherWithAI,
  verifyMercadoPagoPayment,
  createMercadoPagoPreference,
  VoucherAnalysisResult,
  MercadoPagoVerificationResponse,
  MercadoPagoPreferenceResponse
} from '../services/aiValidationService';
import { CameraCaptureModal } from './CameraCaptureModal';
import { MercadoPagoTestLabModal } from './MercadoPagoTestLabModal';
import { calculateCommissionForSales } from '../utils/commissionUtils';
import { PaymentMethod, TideCondition, CrowdLevel, BeachReportType } from '../types';

interface SellerTerminalViewProps {
  state: AppState;
  onNavigate?: (tab: string) => void;
}

export const SellerTerminalView: React.FC<SellerTerminalViewProps> = ({ state, onNavigate }) => {
  const { currentUser, shifts, varieties, sales, carts, zones, houses } = state;

  const today = new Date().toISOString().slice(0, 10);

  // 1. Determinar la jornada activa correspondiente a este usuario:
  // Si es coordinador o vendedor, buscar si tiene una jornada asignada como sellerId
  const activeShift = useMemo(() => {
    return (
      shifts.find((s) => s.sellerId === currentUser.id && s.status === 'en_curso') ||
      shifts.find((s) => s.sellerId === currentUser.id && (s.status === 'planificada' || s.date === today)) ||
      (currentUser.role === 'admin' ? shifts.find((s) => s.status === 'en_curso') || shifts[0] : undefined)
    );
  }, [shifts, currentUser, today]);

  const currentCart = carts.find((c) => c.id === activeShift?.cartId);

  // Sub-pantallas de la Terminal: 'ventas' (cobro), 'resumen' (balance), 'radar' (playas), 'comprobantes' (fotos y registros)
  const [terminalTab, setTerminalTab] = useState<'ventas' | 'resumen' | 'radar' | 'comprobantes'>('ventas');
  const [generatedPrefLink, setGeneratedPrefLink] = useState<string | null>(null);
  const [isGeneratingPref, setIsGeneratingPref] = useState(false);
  const [copiedPrefLink, setCopiedPrefLink] = useState(false);

  // Estados de la Venta en Curso
  const [selectedItemType, setSelectedItemType] = useState<'unidad' | 'combo3' | 'combo6' | 'combo12'>('combo3');
  const [quantityMultiplier, setQuantityMultiplier] = useState(1);
  const [selectedVarietyId, setSelectedVarietyId] = useState(varieties[0]?.id || 'VAR-CLASICO');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');

  // Localidad y sector de playa para la venta actual (se puede cambiar al desplazarse por marea u otra razón)
  const assignedLocality = useMemo(() => {
    if (!activeShift?.zoneName) return 'Santa Teresita';
    if (activeShift.zoneName.includes('Santa Teresita')) return 'Santa Teresita';
    if (activeShift.zoneName.includes('Mar del Tuyú')) return 'Mar del Tuyú';
    if (activeShift.zoneName.includes('Costa del Este')) return 'Costa del Este';
    if (activeShift.zoneName.includes('Las Toninas')) return 'Las Toninas';
    if (activeShift.zoneName.includes('San Bernardo')) return 'San Bernardo';
    return activeShift.zoneName.split(' ')[0] || 'Santa Teresita';
  }, [activeShift]);

  const [saleLocation, setSaleLocation] = useState<string>('Santa Teresita');
  const [saleSectorDetail, setSaleSectorDetail] = useState<string>('');
  const [showCustomSectorInput, setShowCustomSectorInput] = useState<boolean>(false);

  // Sincronizar localidad con la jornada asignada
  React.useEffect(() => {
    if (assignedLocality) {
      setSaleLocation(assignedLocality);
      setBeachReportLocality(assignedLocality);
    }
  }, [assignedLocality]);

  // Reporte de Estado de Playa (Marea, Afluencia, Oportunidad/Inconveniente)
  const [showBeachReportModal, setShowBeachReportModal] = useState(false);
  const [beachReportLocality, setBeachReportLocality] = useState(assignedLocality || 'Santa Teresita');
  const [beachReportSector, setBeachReportSector] = useState('');
  const [beachReportTide, setBeachReportTide] = useState<TideCondition>('marea_normal');
  const [beachReportCrowd, setBeachReportCrowd] = useState<CrowdLevel>('alta');
  const [beachReportType, setBeachReportType] = useState<BeachReportType>('estado_general');
  const [beachReportComments, setBeachReportComments] = useState('');
  const [beachReportWeather, setBeachReportWeather] = useState('28°C Soleado');
  const [beachReportSuccessMsg, setBeachReportSuccessMsg] = useState<string | null>(null);

  // Estados de Comprobante MP y Cámara
  const [voucherImage, setVoucherImage] = useState<string | null>(null);
  const [isAnalyzingVoucher, setIsAnalyzingVoucher] = useState(false);
  const [voucherAnalysis, setVoucherAnalysis] = useState<VoucherAnalysisResult | null>(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);

  // Estados de Verificación de Mercado Pago e Ingreso Manual de Operación
  const [manualOperationId, setManualOperationId] = useState<string>('');
  const [isVerifyingMp, setIsVerifyingMp] = useState(false);
  const [mpVerification, setMpVerification] = useState<MercadoPagoVerificationResponse | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showTestLabModal, setShowTestLabModal] = useState(false);
  const [copiedAlias, setCopiedAlias] = useState(false);

  // Modales operativos
  const [showMyVouchersModal, setShowMyVouchersModal] = useState(false);
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [showSelfDispatchModal, setShowSelfDispatchModal] = useState(false);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [inspectVoucherSale, setInspectVoucherSale] = useState<any | null>(null);

  // Estados para Registro de Merma Rápida
  const [wasteVarietyId, setWasteVarietyId] = useState(varieties[0]?.id || 'VAR-CLASICO');
  const [wasteUnits, setWasteUnits] = useState(1);
  const [wasteReason, setWasteReason] = useState('Caído en la arena');
  const [wasteSuccessMessage, setWasteSuccessMessage] = useState<string | null>(null);

  // Estados para Cierre de Jornada y Sobrantes
  const [closingReturnedCounts, setClosingReturnedCounts] = useState<Record<string, number>>({});
  const [closingWasteCounts, setClosingWasteCounts] = useState<Record<string, number>>({});
  const [closingCashDeclared, setClosingCashDeclared] = useState<number>(0);
  const [closingGasPercent, setClosingGasPercent] = useState<number>(85);
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [closingSuccessSummary, setClosingSuccessSummary] = useState<any | null>(null);

  // Estados para Autodespacho de Coordinador (si no tiene turno asignado)
  const availableHouseCarts = useMemo(() => {
    return carts.filter((c) => c.status === 'operativo');
  }, [carts]);
  const [selfDispatchCartId, setSelfDispatchCartId] = useState(availableHouseCarts[0]?.id || '');
  const [selfDispatchZoneId, setSelfDispatchZoneId] = useState(zones[0]?.id || '');
  const [selfDispatchClasico, setSelfDispatchClasico] = useState(120);
  const [selfDispatchAhumado, setSelfDispatchAhumado] = useState(60);
  const [selfDispatchDulce, setSelfDispatchDulce] = useState(30);

  // Reporte de Incidencia de Carrito
  const [incidentType, setIncidentType] = useState<'quemador_gas' | 'rueda_arena' | 'falta_insumos'>('quemador_gas');
  const [incidentDescription, setIncidentDescription] = useState('');

  const fallbackGalleryInputRef = useRef<HTMLInputElement>(null);

  // Precios estándar de referencia
  const itemPrices: Record<string, { price: number; units: number; label: string }> = {
    unidad: { price: 1500, units: 1, label: '1 Tequeño Individual' },
    combo3: { price: 4000, units: 3, label: 'Combo x3 Tequeños' },
    combo6: { price: 7500, units: 6, label: 'Combo x6 Tequeños' },
    combo12: { price: 14000, units: 12, label: 'Super Promo x12' }
  };

  const currentSaleConfig = itemPrices[selectedItemType];
  const calculatedTotalAmount = currentSaleConfig.price * quantityMultiplier;
  const calculatedTotalUnits = currentSaleConfig.units * quantityMultiplier;

  // Comprobantes registrados en esta jornada / por este usuario
  const myShiftVouchers = useMemo(() => {
    if (!activeShift) return [];
    return sales.filter(
      (s) =>
        (s.shiftId === activeShift.id || (s.sellerId === currentUser.id && s.timestamp.startsWith(today))) &&
        (s.voucherPhotoUrl || s.paymentMethod === 'mercado_pago')
    );
  }, [sales, activeShift, currentUser, today]);

  // Procesar imagen de comprobante con Gemini OCR y auto-verificación en Mercado Pago
  const processVoucherBase64 = async (base64: string) => {
    setVoucherImage(base64);
    setVoucherAnalysis(null);
    setMpVerification(null);

    setIsAnalyzingVoucher(true);
    const existingOpIds = sales
      .map((s) => s.voucherExtractedData?.operationId || s.mpApiVerification?.mpTransactionId)
      .filter(Boolean) as string[];

    const result = await analyzeVoucherWithAI({
      imageBase64: base64,
      saleAmount: calculatedTotalAmount,
      saleVariety: varieties.find((v) => v.id === selectedVarietyId)?.name || 'Tequeño',
      sellerName: currentUser.name,
      saleTimestamp: new Date().toISOString(),
      existingOperationIds: existingOpIds
    });

    setVoucherAnalysis(result);
    setIsAnalyzingVoucher(false);

    // Si la IA detectó un número de operación, poblar el campo manual y disparar verificación segura con MP
    if (result.extractedData.operationId) {
      const extractedOp = result.extractedData.operationId;
      setManualOperationId(extractedOp);
      
      setIsVerifyingMp(true);
      const mpResult = await verifyMercadoPagoPayment({
        operationId: extractedOp,
        expectedAmount: calculatedTotalAmount,
        existingOperationIds: existingOpIds
      });
      setMpVerification(mpResult);
      setIsVerifyingMp(false);
    }
  };

  // Verificar manualmente el número de operación ingresado o corregido
  const handleVerifyOperationId = async (opIdOverride?: string) => {
    const targetId = (opIdOverride || manualOperationId || '').trim();
    if (!targetId) {
      alert('Por favor ingresá un número de operación para verificar con Mercado Pago.');
      return;
    }

    setIsVerifyingMp(true);
    const existingOpIds = sales
      .map((s) => s.voucherExtractedData?.operationId || s.mpApiVerification?.mpTransactionId)
      .filter(Boolean) as string[];

    const mpResult = await verifyMercadoPagoPayment({
      operationId: targetId,
      expectedAmount: calculatedTotalAmount,
      existingOperationIds: existingOpIds
    });

    setMpVerification(mpResult);
    setIsVerifyingMp(false);
  };

  const handleCameraCapture = (base64: string) => {
    processVoucherBase64(base64);
  };

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      processVoucherBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  // Generar link de pago directo oficial de Mercado Pago para el cliente
  const handleGenerateDirectPaymentLink = async () => {
    setIsGeneratingPref(true);
    try {
      const varietyName = varieties.find((v) => v.id === selectedVarietyId)?.name || 'Tequeño';
      const res = await createMercadoPagoPreference({
        title: `${currentSaleConfig.label} (${varietyName})`,
        quantity: 1,
        amount: calculatedTotalAmount
      });
      if (res.success) {
        const link = res.initPoint || res.sandboxInitPoint || null;
        setGeneratedPrefLink(link);
      } else {
        alert(res.message || 'No se pudo generar el link de pago.');
      }
    } catch (err: any) {
      alert('Error al generar link: ' + (err.message || 'Error de red'));
    } finally {
      setIsGeneratingPref(false);
    }
  };

  // 1. Confirmar y Registrar Venta
  const handleConfirmSale = () => {
    if (!activeShift) {
      alert('No tenés una jornada activa despachada hoy.');
      return;
    }

    const finalOpId = manualOperationId.trim() || voucherAnalysis?.extractedData.operationId;

    // Determinar estado de validación según respuesta de MP o IA
    let finalValidationStatus: 'validada' | 'pendiente_revision' | 'inconsistente' | 'sospechosa' = 'pendiente_revision';
    if (paymentMethod === 'efectivo') {
      finalValidationStatus = 'validada';
    } else if (mpVerification?.verified) {
      finalValidationStatus = 'validada';
    } else if (mpVerification?.isDuplicate) {
      finalValidationStatus = 'sospechosa';
    } else if (voucherAnalysis) {
      finalValidationStatus = voucherAnalysis.validationStatus;
    } else if (paymentMethod === 'mercado_pago' || paymentMethod === 'transferencia') {
      finalValidationStatus = finalOpId ? 'pendiente_revision' : 'pendiente_revision';
    }

    storageService.registerSale({
      shiftId: activeShift.id,
      itemType: selectedItemType,
      varietyId: selectedVarietyId,
      quantityUnitsEquivalent: calculatedTotalUnits,
      totalAmount: calculatedTotalAmount,
      paymentMethod,
      locationName: saleLocation,
      beachSector: saleSectorDetail.trim() || undefined,
      voucherPhotoUrl: voucherImage || undefined,
      voucherExtractedData: finalOpId || voucherAnalysis ? {
        ...(voucherAnalysis ? voucherAnalysis.extractedData : {}),
        operationId: finalOpId,
        amount: calculatedTotalAmount,
        senderName: mpVerification?.payerName || voucherAnalysis?.extractedData.senderName,
        confidenceScore: voucherAnalysis ? voucherAnalysis.extractedData.confidenceScore : 0.95,
        aiNotes: voucherAnalysis?.extractedData.aiNotes || (finalOpId ? `Comprobante ingresado manualmente: ${finalOpId}` : undefined)
      } : undefined,
      validationStatus: finalValidationStatus,
      mpApiVerification: mpVerification ? {
        matchedInApi: mpVerification.verified,
        mpTransactionId: mpVerification.operationId,
        apiStatus: mpVerification.status,
        verifiedAt: new Date().toISOString(),
        payerName: mpVerification.payerName,
        payerEmail: mpVerification.payerEmail,
        amount: mpVerification.amount,
        amountMatches: mpVerification.amountMatches,
        isDuplicate: mpVerification.isDuplicate,
        isLiveApi: mpVerification.isLiveApi,
        message: mpVerification.message
      } : undefined
    });

    try {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#f59e0b', '#10b981', '#38bdf8']
      });
    } catch (e) {
      // Ignorar si no está soportado en iframe
    }

    // Resetear formulario para la próxima venta
    setVoucherImage(null);
    setVoucherAnalysis(null);
    setManualOperationId('');
    setMpVerification(null);
    setQuantityMultiplier(1);
  };

  // Manejar envío de Reporte de Estado de Playa
  const handleConfirmBeachReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!beachReportComments.trim()) {
      alert('Por favor ingresá un comentario u observación sobre la playa.');
      return;
    }

    storageService.createBeachReport({
      sellerId: currentUser.id,
      sellerName: currentUser.name,
      shiftId: activeShift?.id,
      locality: beachReportLocality,
      sectorDetails: beachReportSector.trim() || undefined,
      tide: beachReportTide,
      crowdLevel: beachReportCrowd,
      reportType: beachReportType,
      comments: beachReportComments.trim(),
      temperatureOrWeather: beachReportWeather.trim() || undefined
    });

    setBeachReportSuccessMsg(`¡Reporte de ${beachReportLocality} emitido! Coordinación y compañeros alertados.`);
    setTimeout(() => {
      setBeachReportSuccessMsg(null);
      setShowBeachReportModal(false);
      setBeachReportComments('');
      setBeachReportSector('');
    }, 1800);
  };

  // 2. Registrar Merma (rotura o caída)
  const handleConfirmWaste = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    storageService.recordShiftWaste(activeShift.id, wasteVarietyId, wasteUnits, wasteReason);

    const varietyName = varieties.find((v) => v.id === wasteVarietyId)?.name || 'Tequeño';
    setWasteSuccessMessage(`Merma de ${wasteUnits} u de ${varietyName} registrada correctamente.`);
    setTimeout(() => {
      setWasteSuccessMessage(null);
      setShowWasteModal(false);
      setWasteUnits(1);
    }, 1800);
  };

  // 3. Abrir modal de cierre e inicializar conteo de sobrantes
  const handleOpenClosingModal = () => {
    if (!activeShift) return;
    const initialReturned: Record<string, number> = {};
    const initialWaste: Record<string, number> = {};

    activeShift.stockItems.forEach((item) => {
      // Por defecto, sugerir los tequeños teóricos restantes en carrito
      const remainingTheory = Math.max(
        0,
        item.deliveredUnits + item.reSuppliedUnits - item.soldUnits - (item.wasteUnits || 0)
      );
      initialReturned[item.varietyId] = item.returnedUnits > 0 ? item.returnedUnits : remainingTheory;
      initialWaste[item.varietyId] = item.wasteUnits || 0;
    });

    setClosingReturnedCounts(initialReturned);
    setClosingWasteCounts(initialWaste);
    setClosingCashDeclared(activeShift.cashExpected || activeShift.totalCashSales || 0);
    setClosingGasPercent(activeShift.suppliesProvided?.gasPercentEnd || 75);
    setShowClosingModal(true);
  };

  // Guardar solo sobrantes
  const handleSaveLeftoversOnly = () => {
    if (!activeShift) return;
    storageService.recordShiftLeftovers(activeShift.id, closingReturnedCounts);
    alert('Sobrantes contados guardados correctamente en la base de datos.');
  };

  // 4. Realizar Cierre y Conciliación de Jornada
  const handleConfirmCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    const returnedItems = activeShift.stockItems.map((item) => ({
      varietyId: item.varietyId,
      count: Number(closingReturnedCounts[item.varietyId] || 0),
      wasteCount: Number(closingWasteCounts[item.varietyId] || 0)
    }));

    const closed = storageService.closeAndReconcileShift({
      shiftId: activeShift.id,
      returnedItems,
      cashDeclared: Number(closingCashDeclared),
      gasPercentEnd: Number(closingGasPercent),
      bonusIncentive: 0,
      deductionMissingRatePerUnit: 1500,
      coordinatorSignature: currentUser.name || 'Coordinador Operativo',
      notes: closingNotes || `Cierre registrado en terminal por ${currentUser.name} (${currentUser.role})`
    });

    if (closed) {
      try {
        confetti({
          particleCount: 70,
          spread: 80,
          origin: { y: 0.7 },
          colors: ['#10b981', '#f59e0b', '#3b82f6']
        });
      } catch (e) {}

      setClosingSuccessSummary(closed);
    }
  };

  // 5. Iniciar autodespacho si el coordinador o administrador quiere salir a vender
  const handleSelfDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role === 'seller') {
      alert('Los vendedores no pueden autoasignarse carrito ni productos. Esta acción solo la puede realizar un coordinador o administrador.');
      setShowSelfDispatchModal(false);
      return;
    }
    const cart = carts.find((c) => c.id === selfDispatchCartId);
    const zone = zones.find((z) => z.id === selfDispatchZoneId);
    const house = houses.find((h) => h.id === cart?.houseId) || houses[0];

    const stockToDeliver = [
      { varietyId: 'VAR-CLASICO', quantity: Number(selfDispatchClasico) },
      { varietyId: 'VAR-AHUMADO', quantity: Number(selfDispatchAhumado) },
      { varietyId: 'VAR-DULCE', quantity: Number(selfDispatchDulce) }
    ].filter((s) => s.quantity > 0);

    storageService.dispatchSellerShift({
      houseId: house?.id || 'HOUSE-NORTE',
      sellerId: currentUser.id,
      cartId: selfDispatchCartId,
      zoneId: selfDispatchZoneId,
      stockToDeliver,
      gasPercentStart: cart?.gasLevelPercent || 95,
      napkinsDelivered: 5,
      conesDelivered: 60,
      saucesProvided: ['Mayonesa Ajo Vegana', 'Chutney Mango'],
      notes: `Jornada iniciada por ${currentUser.name} (${currentUser.role}) en ${zone?.name || 'Playa'}`
    });

    setShowSelfDispatchModal(false);
  };

  // Enviar reporte de emergencia / insumos
  const handleReportIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift || !incidentDescription) return;

    storageService.reportCartIncident({
      cartId: activeShift.cartId,
      type: incidentType,
      description: incidentDescription
    });

    alert('¡Aviso enviado a la base de coordinación! Recibirás asistencia a la brevedad.');
    setShowIncidentModal(false);
    setIncidentDescription('');
  };

  // Cálculo de comisiones acumuladas dinámicas según tramos vigentes
  const dynamicCommissionCalc = useMemo(() => {
    if (!activeShift) return null;
    return calculateCommissionForSales(
      activeShift.totalGrossSales,
      state.systemConfig?.commissionTiers || [],
      activeShift.commissionRate || currentUser.commissionRate || 0.20
    );
  }, [activeShift, state.systemConfig?.commissionTiers, currentUser.commissionRate]);

  const myCommissionRate = dynamicCommissionCalc
    ? dynamicCommissionCalc.rate
    : (activeShift?.commissionRate || currentUser.commissionRate || 0.10);

  const myEarnedCommission = dynamicCommissionCalc
    ? dynamicCommissionCalc.grossCommission
    : (activeShift ? activeShift.totalGrossSales * myCommissionRate : 0);
  const unitsRemainingInCart = activeShift
    ? Math.max(
        0,
        activeShift.stockItems.reduce(
          (acc, item) =>
            acc + (item.deliveredUnits + item.reSuppliedUnits - item.soldUnits - (item.wasteUnits || 0)),
          0
        )
      )
    : 0;

  // =========================================================================
  // VISTA PARA VENDEDOR SIN JORNADA ASIGNADA
  // El rol de vendedor no debe poder autoasignarse carro ni productos.
  // Solo el coordinador o el administrador pueden realizar la asignación y despacho.
  // =========================================================================
  if (!activeShift && currentUser.role === 'seller') {
    const assignedHouse = houses.find((h) => h.id === currentUser.assignedHouseId) || houses[0];
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-16 animate-fadeIn">
        <div className="bg-white border-2 border-slate-300 rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-5 text-slate-900">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 border-2 border-amber-400 text-slate-950 flex items-center justify-center mx-auto text-3xl shadow-sm">
            🏖️
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold">
              <UserCheck className="w-3.5 h-3.5 text-amber-700" />
              <span>Vendedor: {currentUser.name}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-950">
              Esperando Despacho de Carrito
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed font-medium">
              Hola, <strong className="text-slate-950">{currentUser.name}</strong>. Actualmente no tenés una jornada activa ni carrito asignado para hoy.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 text-left space-y-3 text-xs text-slate-800 max-w-md mx-auto">
            <div className="font-black text-amber-800 uppercase tracking-wider text-[11px] flex items-center">
              <ShieldAlert className="w-4 h-4 mr-1.5 shrink-0 text-amber-600" />
              Protocolo de Asignación y Carga
            </div>
            <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
              Por normativa y control de inventario, la asignación de carritos y entrega de stock de tequeños solo puede ser realizada por tu <strong className="text-slate-950 font-black">Coordinador</strong> o el <strong className="text-slate-950 font-black">Administrador</strong> desde la base operativa.
            </p>
            <div className="pt-2 border-t border-slate-200 space-y-1.5 text-slate-600 text-[11px] font-semibold">
              <div className="flex justify-between">
                <span>Base asignada:</span>
                <span className="text-slate-950 font-bold">{assignedHouse?.name || 'Base Operativa'}</span>
              </div>
              <div className="flex justify-between">
                <span>Tu comisión:</span>
                <span className="text-emerald-700 font-black">{Math.round(myCommissionRate * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Estado:</span>
                <span className="text-amber-700 font-bold">Pendiente de Check-out en Base</span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            {onNavigate && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate('seller-vouchers')}
                  className="w-full sm:w-auto px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs sm:text-sm rounded-xl border-2 border-slate-300 flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-sky-600" />
                  <span>Mis Comprobantes</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('reconciliation')}
                  className="w-full sm:w-auto px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs sm:text-sm rounded-xl border-2 border-slate-300 flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <Coins className="w-4 h-4 text-emerald-600" />
                  <span>Mis Cierres & Comisión</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VISTA ALTERNATIVA: Si el usuario es Coordinador o Administrador y NO tiene jornada asignada
  // =========================================================================
  if (!activeShift) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-16 animate-fadeIn">
        <div className="bg-white border-2 border-slate-300 rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-5 text-slate-900">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 border-2 border-amber-400 text-slate-950 flex items-center justify-center mx-auto text-3xl shadow-sm">
            🏖️
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-100 border border-blue-300 text-blue-900 text-xs font-bold">
              <UserCheck className="w-3.5 h-3.5 text-blue-700" />
              <span>Rol: {currentUser.name} ({currentUser.role === 'coordinator' ? 'Coordinador' : currentUser.role})</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-950">
              Terminal de Ventas de Playa
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed font-medium">
              Los coordinadores y administradores pueden asignar carritos y salir a vender en la playa cuando lo requieran. Actualmente no tenés un carrito asignado para hoy.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 text-left space-y-2.5 text-xs text-slate-800 max-w-md mx-auto">
            <div className="font-black uppercase tracking-wider text-[11px] flex items-center text-amber-800">
              <Check className="w-3.5 h-3.5 mr-1 text-amber-600" />
              Capacidades autorizadas para coordinación:
            </div>
            <ul className="space-y-1.5 pl-1 text-[11px] text-slate-700 font-medium">
              <li>• Cobrar tequeños individuales y combos (x3, x6, x12)</li>
              <li>• Cobrar en efectivo o escanear comprobantes de transferencia</li>
              <li>• Consultar tu historial de comprobantes en tiempo real</li>
              <li>• Registrar mermas de producto caído o roto</li>
              <li>• Registrar sobrantes devueltos y realizar el cierre de tu jornada</li>
            </ul>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowSelfDispatchModal(true)}
              className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-xs sm:text-sm rounded-xl border-2 border-amber-600 shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <Store className="w-4 h-4" />
              <span>Asignarme Carrito y Salir a Vender</span>
            </button>

            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('planning')}
                className="w-full sm:w-auto px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs sm:text-sm rounded-xl border-2 border-slate-300 flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <ClipboardList className="w-4 h-4 text-sky-600" />
                <span>Ir a Despacho & Asesor IA</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal de Autodespacho para Coordinador o Administrador */}
        {showSelfDispatchModal && currentUser.role !== 'seller' && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Autodespacho de Carrito</h3>
                    <span className="text-[11px] text-slate-400">Asignar jornada para: {currentUser.name}</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowSelfDispatchModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSelfDispatch} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Carrito Disponible</label>
                  <select
                    value={selfDispatchCartId}
                    onChange={(e) => setSelfDispatchCartId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    required
                  >
                    {availableHouseCarts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} ({c.model}) — Gas: {c.gasLevelPercent}%
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Zona de Playa</label>
                  <select
                    value={selfDispatchZoneId}
                    onChange={(e) => setSelfDispatchZoneId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    required
                  >
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} ({z.beachCrowdLevel} afluencia)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 pt-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Stock Inicial en Conservadora (Unidades)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 block mb-1">Clásico</span>
                      <input
                        type="number"
                        value={selfDispatchClasico}
                        onChange={(e) => setSelfDispatchClasico(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs font-bold text-white text-center"
                        min="0"
                        step="10"
                      />
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 block mb-1">Ahumado</span>
                      <input
                        type="number"
                        value={selfDispatchAhumado}
                        onChange={(e) => setSelfDispatchAhumado(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs font-bold text-white text-center"
                        min="0"
                        step="10"
                      />
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 block mb-1">Dulce</span>
                      <input
                        type="number"
                        value={selfDispatchDulce}
                        onChange={(e) => setSelfDispatchDulce(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs font-bold text-white text-center"
                        min="0"
                        step="10"
                      />
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-amber-400 font-bold">
                    Total: {selfDispatchClasico + selfDispatchAhumado + selfDispatchDulce} unidades
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowSelfDispatchModal(false)}
                    className="px-4 py-2 bg-slate-800 text-xs text-slate-300 rounded-xl hover:bg-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/20"
                  >
                    Iniciar Mi Jornada de Venta
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VISTA PRINCIPAL: TERMINAL OPERATIVA CON JORNADA ACTIVA
  // =========================================================================
  return (
    <div className="max-w-2xl mx-auto px-1 sm:px-4 space-y-4 pb-20 animate-fadeIn">
      
      {/* 1. Header Compacto de Rendimiento y Selector de Pantallas de la Terminal */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm space-y-3 text-slate-900">
        
        {/* Fila Superior: Vendedor, Carrito y Saldo de Comisión */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 border border-amber-500 text-slate-950 flex items-center justify-center font-black text-xl shadow-sm shrink-0">
              🏖️
            </div>
            <div>
              <div className="flex items-center space-x-1.5 flex-wrap">
                <h2 className="text-sm sm:text-base font-black text-slate-950 leading-tight">
                  {currentUser.name}
                </h2>
                {currentUser.role === 'coordinator' && (
                  <span className="px-1.5 py-0.2 rounded bg-blue-100 border border-blue-300 text-blue-900 text-[10px] font-bold">
                    Coordinador
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-600 font-bold block">
                {activeShift.cartCode} • {saleLocation}
              </span>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">
              Mi Comisión ({Math.round(myCommissionRate * 100)}%)
            </div>
            <div className="text-base sm:text-lg font-black text-emerald-700 font-mono">
              ${myEarnedCommission.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Barra de Pestañas de la Terminal (Touch targets amplios para móvil) */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setTerminalTab('ventas')}
            className={`py-2 px-1 rounded-lg text-center font-black text-xs transition-all flex flex-col sm:flex-row items-center justify-center sm:space-x-1 cursor-pointer min-h-[44px] ${
              terminalTab === 'ventas'
                ? 'bg-amber-400 text-slate-950 border border-amber-500 shadow-sm'
                : 'text-slate-700 hover:text-slate-950 hover:bg-slate-200/70'
            }`}
          >
            <span className="text-sm">⚡</span>
            <span className="text-[11px] sm:text-xs">Cobrar</span>
          </button>

          <button
            type="button"
            onClick={() => setTerminalTab('resumen')}
            className={`py-2 px-1 rounded-lg text-center font-black text-xs transition-all flex flex-col sm:flex-row items-center justify-center sm:space-x-1 cursor-pointer min-h-[44px] ${
              terminalTab === 'resumen'
                ? 'bg-amber-400 text-slate-950 border border-amber-500 shadow-sm'
                : 'text-slate-700 hover:text-slate-950 hover:bg-slate-200/70'
            }`}
          >
            <span className="text-sm">📊</span>
            <span className="text-[11px] sm:text-xs">Resumen</span>
          </button>

          <button
            type="button"
            onClick={() => setTerminalTab('radar')}
            className={`py-2 px-1 rounded-lg text-center font-black text-xs transition-all flex flex-col sm:flex-row items-center justify-center sm:space-x-1 cursor-pointer min-h-[44px] ${
              terminalTab === 'radar'
                ? 'bg-amber-400 text-slate-950 border border-amber-500 shadow-sm'
                : 'text-slate-700 hover:text-slate-950 hover:bg-slate-200/70'
            }`}
          >
            <span className="text-sm">🏖️</span>
            <span className="text-[11px] sm:text-xs">Playas</span>
          </button>

          <button
            type="button"
            onClick={() => setTerminalTab('comprobantes')}
            className={`py-2 px-1 rounded-lg text-center font-black text-xs transition-all flex flex-col sm:flex-row items-center justify-center sm:space-x-1 cursor-pointer min-h-[44px] relative ${
              terminalTab === 'comprobantes'
                ? 'bg-amber-400 text-slate-950 border border-amber-500 shadow-sm'
                : 'text-slate-700 hover:text-slate-950 hover:bg-slate-200/70'
            }`}
          >
            <span className="text-sm">📸</span>
            <span className="text-[11px] sm:text-xs">Comprob.</span>
            {myShiftVouchers.length > 0 && (
              <span className="ml-0.5 sm:ml-1 text-[9px] px-1 py-0.2 rounded-full bg-slate-950 text-white font-mono">
                {myShiftVouchers.length}
              </span>
            )}
          </button>
        </div>

      </div>

      {/* =========================================================================
          PESTAÑA 1: VENTA RÁPIDA / COBRAR
          Estructura limpia: 1. Pedido -> 2. Relleno -> 3. Playa -> 4. Pago -> 5. Cobrar
          ========================================================================= */}
      {terminalTab === 'ventas' && (
        <div className="space-y-3 animate-fadeIn">
          
          {/* Mini indicador rápido de stock en carrito */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 flex items-center justify-between text-xs text-amber-950 font-bold">
            <span className="flex items-center">
              <Package className="w-3.5 h-3.5 mr-1.5 text-amber-700 shrink-0" />
              <span>Stock en carrito: <strong className="text-slate-950">{unitsRemainingInCart} u</strong></span>
            </span>
            <span className="text-[11px] text-slate-600 font-mono">
              Vendido hoy: ${activeShift.totalGrossSales.toLocaleString()}
            </span>
          </div>

          {/* SECCIÓN 1: Selecciona el Pedido */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center">
                <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center text-[11px] font-black mr-1.5">
                  1
                </span>
                Seleccioná el Pedido
              </label>

              {/* Multiplicador de Combos / Cantidad */}
              <div className="flex items-center space-x-1.5 bg-slate-100 px-2 py-1 rounded-xl border border-slate-300">
                <span className="text-[11px] text-slate-700 font-bold">Cant:</span>
                <button
                  type="button"
                  onClick={() => setQuantityMultiplier((prev) => Math.max(1, prev - 1))}
                  className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 text-slate-900 border border-slate-300 flex items-center justify-center font-black text-sm active:scale-95 transition-transform"
                >
                  -
                </button>
                <span className="text-sm font-black text-slate-950 px-1.5 font-mono">
                  {quantityMultiplier}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantityMultiplier((prev) => prev + 1)}
                  className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 text-slate-900 border border-slate-300 flex items-center justify-center font-black text-sm active:scale-95 transition-transform"
                >
                  +
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              {(Object.keys(itemPrices) as (keyof typeof itemPrices)[]).map((key) => {
                const item = itemPrices[key];
                const isSelected = selectedItemType === key;
                const priceForMultiplier = item.price * quantityMultiplier;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedItemType(key)}
                    className={`p-3 rounded-xl text-left border-2 transition-all flex flex-col justify-between cursor-pointer min-h-[72px] ${
                      isSelected
                        ? 'bg-amber-50 border-amber-500 text-slate-950 ring-2 ring-amber-400/40 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="font-black text-xs sm:text-sm text-slate-950 leading-tight">
                        {item.label}
                      </div>
                      <span className="text-[11px] text-slate-600 font-bold">
                        {item.units * quantityMultiplier} {item.units * quantityMultiplier === 1 ? 'unidad' : 'unidades'}
                      </span>
                    </div>
                    <div className="text-base sm:text-lg font-black text-amber-900 mt-1.5 font-mono">
                      ${priceForMultiplier.toLocaleString()}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECCIÓN 2: Variedad de Relleno */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center">
                <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center text-[11px] font-black mr-1.5">
                  2
                </span>
                Variedad de Relleno
              </label>
              <span className="text-[11px] text-slate-600 font-bold">
                {varieties.find((v) => v.id === selectedVarietyId)?.name.replace('Tequeño ', '')}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {varieties.map((v) => {
                const isSelected = selectedVarietyId === v.id;
                const stockInCart = activeShift.stockItems.find((s) => s.varietyId === v.id);
                const remainingUnits = stockInCart
                  ? Math.max(0, stockInCart.deliveredUnits + stockInCart.reSuppliedUnits - stockInCart.soldUnits - (stockInCart.wasteUnits || 0))
                  : 0;

                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVarietyId(v.id)}
                    className={`p-2.5 rounded-xl text-center border-2 text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center min-h-[58px] ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate w-full">{v.name.replace('Tequeño ', '')}</span>
                    <span className={`text-[10px] mt-0.5 font-mono font-bold ${isSelected ? 'text-slate-900' : 'text-slate-600'}`}>
                      {remainingUnits} u disp.
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECCIÓN 3: Playa o Localidad de esta Venta */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center">
                <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center text-[11px] font-black mr-1.5">
                  3
                </span>
                Playa / Localidad
              </label>
              <span className="text-[11px] text-amber-900 font-black font-mono">
                {saleLocation} {saleSectorDetail ? `(${saleSectorDetail})` : ''}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
              {['Santa Teresita', 'Mar del Tuyú', 'Costa del Este', 'Las Toninas', 'San Bernardo'].map((loc) => {
                const isSelected = saleLocation === loc;
                return (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setSaleLocation(loc)}
                    className={`p-2 rounded-xl border-2 text-left text-xs font-black transition-all cursor-pointer flex items-center justify-between min-h-[42px] ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{loc}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-1 text-slate-950" />}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setShowCustomSectorInput(!showCustomSectorInput)}
                className={`p-2 rounded-xl border-2 text-left text-xs font-bold transition-all cursor-pointer flex items-center justify-between min-h-[42px] ${
                  showCustomSectorInput || saleSectorDetail
                    ? 'bg-sky-50 border-sky-400 text-sky-900 font-black'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>+ Sector/Bajada</span>
                <Compass className="w-3.5 h-3.5 shrink-0 ml-1 text-slate-500" />
              </button>
            </div>

            {showCustomSectorInput && (
              <div className="pt-2 border-t border-slate-100 flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Ej: Bajada Calle 38, Muelle, Carpa 4..."
                  value={saleSectorDetail}
                  onChange={(e) => setSaleSectorDetail(e.target.value)}
                  className="flex-1 bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-950 font-bold placeholder-slate-400 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCustomSectorInput(false)}
                  className="px-3 py-2 bg-slate-800 text-white text-xs rounded-xl font-bold cursor-pointer hover:bg-slate-900"
                >
                  OK
                </button>
              </div>
            )}
          </div>

          {/* SECCIÓN 4: Forma de Pago */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center">
              <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center text-[11px] font-black mr-1.5">
                4
              </span>
              Forma de Pago
            </label>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('efectivo')}
                className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center space-y-1 font-black text-xs sm:text-sm transition-all cursor-pointer min-h-[64px] ${
                  paymentMethod === 'efectivo'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-300'
                    : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                }`}
              >
                <DollarSign className={`w-5 h-5 ${paymentMethod === 'efectivo' ? 'text-white' : 'text-emerald-600'}`} />
                <span>Efectivo</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('mercado_pago')}
                className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center space-y-1 font-black text-xs sm:text-sm transition-all cursor-pointer min-h-[64px] ${
                  paymentMethod === 'mercado_pago'
                    ? 'bg-sky-600 text-white border-sky-700 shadow-md ring-2 ring-sky-300'
                    : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Smartphone className={`w-5 h-5 ${paymentMethod === 'mercado_pago' ? 'text-white' : 'text-sky-600'}`} />
                <span className="truncate">Mercado Pago</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('transferencia')}
                className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center space-y-1 font-black text-xs sm:text-sm transition-all cursor-pointer min-h-[64px] ${
                  paymentMethod === 'transferencia'
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-300'
                    : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                }`}
              >
                <CreditCard className={`w-5 h-5 ${paymentMethod === 'transferencia' ? 'text-white' : 'text-indigo-600'}`} />
                <span className="truncate">Transferencia</span>
              </button>
            </div>

            {/* Submódulo de Mercado Pago / Transferencia */}
            {(paymentMethod === 'mercado_pago' || paymentMethod === 'transferencia') && (
              <div className="mt-2 p-3 sm:p-4 bg-slate-50 border-2 border-slate-200 rounded-xl space-y-3">
                
                {/* Cuenta oficial y botones de acción rápida */}
                <div className="bg-white border-2 border-sky-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
                  <div>
                    <span className="text-[10px] text-sky-800 font-black uppercase tracking-wider block">
                      Cuenta Oficial para Transferir
                    </span>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="text-sm sm:text-base font-black text-slate-950 font-mono">
                        {state.systemConfig?.mercadoPagoConfig?.alias || 'tequenos.costa.mp'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(state.systemConfig?.mercadoPagoConfig?.alias || 'tequenos.costa.mp');
                          setCopiedAlias(true);
                          setTimeout(() => setCopiedAlias(false), 2000);
                        }}
                        className="px-2 py-0.5 rounded-md bg-sky-100 hover:bg-sky-200 text-sky-900 border border-sky-300 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                        title="Copiar alias"
                      >
                        {copiedAlias ? <CheckCheck className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                        <span className="text-[10px]">{copiedAlias ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-600 font-semibold block">
                      Titular: {state.systemConfig?.mercadoPagoConfig?.accountHolder || 'Tequeños Costa SRL'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 pt-1 sm:pt-0">
                    {/* Botón Laboratorio de Pruebas (SE MANTIENE PARA QUE PUEDAS HACER PRUEBAS) */}
                    <button
                      type="button"
                      onClick={() => setShowTestLabModal(true)}
                      className="px-3 py-2 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 border border-amber-500 shadow-sm cursor-pointer"
                      title="Generar comprobante de prueba o link de pago sandbox"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Lab de Pruebas</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowQrModal(true)}
                      className="px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 border border-sky-700 shadow-sm cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Ver QR</span>
                    </button>
                  </div>
                </div>

                {/* Subir foto de comprobante */}
                <input
                  type="file"
                  ref={fallbackGalleryInputRef}
                  accept="image/*"
                  onChange={handleGalleryUpload}
                  className="hidden"
                />

                {!voucherImage ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setIsCameraModalOpen(true)}
                      className="w-full py-3 border-2 border-dashed border-sky-400 hover:border-sky-500 rounded-xl bg-white flex flex-col items-center justify-center text-slate-800 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
                    >
                      <div className="p-1.5 rounded-full bg-sky-100 text-sky-800 mb-1">
                        <Camera className="w-5 h-5" />
                      </div>
                      <span className="text-xs sm:text-sm font-black text-slate-950">
                        Fotografiar Pantalla del Comprobante
                      </span>
                      <span className="text-[11px] text-slate-600 font-medium">
                        La IA extraerá el número de operación automáticamente
                      </span>
                    </button>

                    <div className="flex items-center justify-between px-1 text-[11px]">
                      <span className="text-slate-600 font-medium">¿Reflejo de sol en la cámara?</span>
                      <button
                        type="button"
                        onClick={() => fallbackGalleryInputRef.current?.click()}
                        className="text-sky-700 hover:text-sky-900 font-bold flex items-center space-x-1 cursor-pointer"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Cargar desde galería</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative rounded-xl overflow-hidden border-2 border-slate-300 max-h-44 flex items-center justify-center bg-slate-900">
                      <img src={voucherImage} alt="Comprobante" className="max-h-44 object-contain" />
                      <button
                        type="button"
                        onClick={() => {
                          setVoucherImage(null);
                          setVoucherAnalysis(null);
                        }}
                        className="absolute top-2 right-2 bg-rose-600 text-white p-1 rounded-full text-xs shadow-md cursor-pointer hover:bg-rose-500"
                      >
                        ✕
                      </button>
                    </div>

                    {isAnalyzingVoucher && (
                      <div className="flex items-center justify-center space-x-2 text-amber-800 text-xs py-2 bg-amber-50 rounded-xl border border-amber-300">
                        <Sparkles className="w-4 h-4 animate-spin text-amber-600" />
                        <span className="font-bold">Gemini OCR extrayendo número de comprobante...</span>
                      </div>
                    )}

                    {voucherAnalysis && (
                      <div
                        className={`p-2.5 rounded-xl border-2 text-xs space-y-1 ${
                          voucherAnalysis.validationStatus === 'validada'
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-medium'
                            : voucherAnalysis.validationStatus === 'sospechosa'
                            ? 'bg-rose-50 border-rose-400 text-rose-950 font-medium'
                            : 'bg-amber-50 border-amber-400 text-amber-950 font-medium'
                        }`}
                      >
                        <div className="flex items-center justify-between font-black">
                          <span className="flex items-center">
                            {voucherAnalysis.validationStatus === 'validada' ? (
                              <ShieldCheck className="w-4 h-4 mr-1 text-emerald-700" />
                            ) : (
                              <ShieldAlert className="w-4 h-4 mr-1 text-rose-700" />
                            )}
                            Diagnóstico IA: {voucherAnalysis.validationStatus.toUpperCase()}
                          </span>
                          <span className="font-mono">Op: #{voucherAnalysis.extractedData.operationId}</span>
                        </div>
                        <p className="text-[11px]">{voucherAnalysis.extractedData.aiNotes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Campo de Número de Operación Manual */}
                <div className="pt-2 border-t border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-800">
                      Número de Operación / Transferencia:
                    </label>
                    <span className="text-[10px] text-slate-500 font-bold">
                      {manualOperationId ? 'Listo para verificar' : 'Dictado o manual'}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Ej: 8934521876"
                        value={manualOperationId}
                        onChange={(e) => {
                          setManualOperationId(e.target.value);
                          setMpVerification(null);
                        }}
                        className="w-full bg-white border-2 border-slate-300 focus:border-sky-500 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-950 font-mono font-bold placeholder-slate-400 focus:outline-none"
                      />
                      {manualOperationId && (
                        <button
                          type="button"
                          onClick={() => {
                            setManualOperationId('');
                            setMpVerification(null);
                          }}
                          className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-900 text-xs font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleVerifyOperationId()}
                      disabled={isVerifyingMp || !manualOperationId.trim()}
                      className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-black flex items-center space-x-1.5 border border-sky-700 shadow-sm cursor-pointer disabled:cursor-not-allowed shrink-0"
                    >
                      {isVerifyingMp ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Consultando...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>Verificar MP</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Resultado de Verificación en Mercado Pago */}
                {mpVerification && (
                  <div
                    className={`p-3 rounded-xl border-2 text-xs space-y-1 animate-fadeIn ${
                      mpVerification.verified
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                        : mpVerification.isDuplicate
                        ? 'bg-rose-50 border-rose-400 text-rose-950 ring-2 ring-rose-400'
                        : 'bg-amber-50 border-amber-400 text-amber-950'
                    }`}
                  >
                    <div className="flex items-center justify-between font-black text-xs">
                      <span className="flex items-center space-x-1">
                        {mpVerification.verified ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                            <span>PAGO ACREDITADO EN CUENTA</span>
                          </>
                        ) : mpVerification.isDuplicate ? (
                          <>
                            <ShieldAlert className="w-4 h-4 text-rose-700 animate-pulse" />
                            <span>¡ALERTA DE DUPLICIDAD / FRAUDE!</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4 text-amber-700" />
                            <span>OPERACIÓN NO ENCONTRADA EN MP</span>
                          </>
                        )}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white border border-slate-300">
                        {mpVerification.isLiveApi ? 'API En Vivo' : 'Modo Offline'}
                      </span>
                    </div>

                    <p className="text-[11px] leading-tight font-medium">
                      {mpVerification.message}
                    </p>

                    {mpVerification.payerName && (
                      <div className="text-[11px] font-bold pt-1 border-t border-slate-300 flex items-center justify-between">
                        <span>Titular: {mpVerification.payerName}</span>
                        <span className="font-mono">Op #{mpVerification.operationId}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Nota offline */}
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-900 flex items-center space-x-1.5 font-medium">
                  <span className="text-sm">🏖️</span>
                  <span>
                    <strong>Playa sin señal:</strong> Podés cobrar igual. La foto y los datos se guardan en el celular para que el coordinador o admin rechequee con su botón de revisión.
                  </span>
                </div>

              </div>
            )}
          </div>

          {/* SECCIÓN 5: Botón de Cobro Gigante (Touch Target Principal para el Pulgar) */}
          <button
            type="button"
            onClick={handleConfirmSale}
            className="w-full py-4 px-4 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-base sm:text-lg rounded-2xl border-2 border-amber-600 shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] cursor-pointer min-h-[58px]"
          >
            <CheckCircle2 className="w-6 h-6 shrink-0" />
            <span className="truncate">
              COBRAR ${calculatedTotalAmount.toLocaleString()} ({quantityMultiplier > 1 ? `${quantityMultiplier}x ` : ''}
              {currentSaleConfig.label})
            </span>
          </button>

          {/* Accesos rápidos inferiores */}
          <div className="flex items-center justify-between px-1 text-xs">
            <button
              type="button"
              onClick={() => setShowIncidentModal(true)}
              className="text-rose-700 hover:text-rose-800 font-bold flex items-center space-x-1 p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer"
            >
              <Flame className="w-4 h-4 text-rose-600" />
              <span>Reportar falla o faltante</span>
            </button>

            <button
              type="button"
              onClick={() => setTerminalTab('resumen')}
              className="text-slate-600 hover:text-slate-950 font-bold flex items-center space-x-1 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <span>Ver balance del día</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>

        </div>
      )}

      {/* =========================================================================
          PESTAÑA 2: RESUMEN DE VENTAS & CAJA
          Visualización clara de ventas, tequeños en carrito, comisión y cierre
          ========================================================================= */}
      {terminalTab === 'resumen' && (
        <div className="space-y-4 animate-fadeIn">
          
          {/* Card Resumen Financiero */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-950">Resumen de Ventas de Hoy</h3>
                <span className="text-xs text-slate-500 font-semibold">{activeShift.cartCode} • {activeShift.zoneName}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Recaudación Total</span>
                <span className="text-xl font-black text-slate-950 font-mono">${activeShift.totalGrossSales.toLocaleString()}</span>
              </div>
            </div>

            {/* Grid 3 Columnas: Efectivo, MP, y Comisión */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-xl bg-emerald-50 border-2 border-emerald-200">
                <span className="text-[10px] text-emerald-800 uppercase font-black block">Efectivo</span>
                <span className="text-sm sm:text-base font-black text-emerald-950 font-mono">
                  ${(activeShift.cashExpected || activeShift.totalCashSales).toLocaleString()}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-sky-50 border-2 border-sky-200">
                <span className="text-[10px] text-sky-800 uppercase font-black block">MP / Transf.</span>
                <span className="text-sm sm:text-base font-black text-sky-950 font-mono">
                  ${((activeShift.totalMpSales || 0) + (activeShift.totalTransferSales || 0)).toLocaleString()}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border-2 border-amber-300">
                <span className="text-[10px] text-amber-900 uppercase font-black block">Mi Comisión</span>
                <span className="text-sm sm:text-base font-black text-amber-950 font-mono">
                  ${myEarnedCommission.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Escalafón de Ventas */}
            {dynamicCommissionCalc && (
              <div className="p-3 bg-slate-50 border-2 border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5 font-black text-slate-900">
                    <Award className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Escalafón: {dynamicCommissionCalc.tierName}</span>
                  </div>
                  <span className="font-mono font-black text-emerald-800 text-xs bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-300">
                    {Math.round(myCommissionRate * 100)}% comisión
                  </span>
                </div>

                {dynamicCommissionCalc.salesToNextTier && dynamicCommissionCalc.salesToNextTier > 0 ? (
                  <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-200">
                    <span>Próximo escalafón ({Math.round((dynamicCommissionCalc.nextTier?.rate || 0) * 100)}%):</span>
                    <span className="text-sky-800 font-black">
                      ¡Faltan ${dynamicCommissionCalc.salesToNextTier.toLocaleString()} en ventas!
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] text-amber-900 font-bold pt-1 border-t border-slate-200 text-right">
                    ⭐ ¡Alcanzaste el escalafón máximo de recompensa!
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Inventario de Tequeños en Carrito por Variedad */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-sm font-black text-slate-950 flex items-center">
                <Package className="w-4 h-4 mr-1.5 text-amber-600" />
                <span>Control de Tequeños en Carrito</span>
              </h4>
              <span className="text-xs font-black text-slate-900 font-mono">
                {unitsRemainingInCart} u restantes / {activeShift.totalUnitsSold} u vendidas
              </span>
            </div>

            <div className="space-y-2">
              {activeShift.stockItems.map((item) => {
                const delivered = item.deliveredUnits + item.reSuppliedUnits;
                const remaining = Math.max(0, delivered - item.soldUnits - (item.wasteUnits || 0));
                const soldPercent = delivered > 0 ? Math.round((item.soldUnits / delivered) * 100) : 0;

                return (
                  <div key={item.varietyId} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-black text-slate-900">{item.varietyName}</span>
                      <span className="text-slate-600 font-mono text-[11px]">
                        <strong>{item.soldUnits}</strong> vendidos | <strong>{remaining}</strong> en carrito
                      </span>
                    </div>
                    {/* Barra de progreso */}
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-amber-500 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100, soldPercent)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Botones de Cierre y Mermas */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowWasteModal(true)}
              className="p-3 bg-white hover:bg-slate-50 border-2 border-slate-300 rounded-xl flex items-center justify-center space-x-2 text-slate-900 font-black text-xs cursor-pointer shadow-xs min-h-[48px]"
            >
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Registrar Merma</span>
            </button>

            <button
              type="button"
              onClick={handleOpenClosingModal}
              className="p-3 bg-emerald-600 hover:bg-emerald-500 border-2 border-emerald-700 text-white rounded-xl flex items-center justify-center space-x-2 font-black text-xs cursor-pointer shadow-md min-h-[48px]"
            >
              <Coins className="w-4 h-4 shrink-0" />
              <span>Sobrantes & Cierre</span>
            </button>
          </div>

        </div>
      )}

      {/* =========================================================================
          PESTAÑA 3: RADAR DE PLAYAS & AVISOS DE LA COSTA
          Avisos en vivo, marea, afluencia y reporte de faltantes/fallas
          ========================================================================= */}
      {terminalTab === 'radar' && (
        <div className="space-y-4 animate-fadeIn">
          
          {/* Header del Radar con botón para emitir reporte */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-950 flex items-center space-x-1.5">
                  <Waves className="w-5 h-5 text-sky-600" />
                  <span>Radar de Playas en Vivo</span>
                </h3>
                <p className="text-xs text-slate-600 font-medium">
                  Estado de mareas, afluencia y oportunidades en la Costa Atlántica
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowBeachReportModal(true)}
                className="px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-black flex items-center space-x-1 shadow-sm border border-sky-700 cursor-pointer shrink-0"
              >
                <span>+ Emitir Aviso</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowBeachReportModal(true)}
                className="p-3 rounded-xl bg-sky-50 border-2 border-sky-200 text-sky-950 font-black text-xs flex flex-col items-center justify-center space-y-1 hover:bg-sky-100 transition-colors"
              >
                <Waves className="w-5 h-5 text-sky-600" />
                <span>Reportar Marea o Gente</span>
              </button>

              <button
                type="button"
                onClick={() => setShowIncidentModal(true)}
                className="p-3 rounded-xl bg-rose-50 border-2 border-rose-200 text-rose-950 font-black text-xs flex flex-col items-center justify-center space-y-1 hover:bg-rose-100 transition-colors"
              >
                <Flame className="w-5 h-5 text-rose-600" />
                <span>Pedir Insumo o Avisar Falla</span>
              </button>
            </div>
          </div>

          {/* Lista de Reportes y Avisos Emitidos */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <h4 className="text-sm font-black text-slate-950">Avisos Recientes de la Costa</h4>

            {state.beachReports && state.beachReports.length > 0 ? (
              <div className="space-y-2.5">
                {state.beachReports.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between font-black">
                      <span className="text-slate-950 flex items-center space-x-1">
                        <MapPin className="w-3.5 h-3.5 text-amber-600" />
                        <span>{rep.locality} {rep.sectorDetails ? `(${rep.sectorDetails})` : ''}</span>
                      </span>
                      <span className="text-slate-500 text-[10px] font-mono">{rep.timestamp}</span>
                    </div>

                    <div className="flex items-center space-x-2 text-[10px]">
                      <span className="bg-sky-100 text-sky-900 border border-sky-300 px-1.5 py-0.5 rounded font-bold">
                        🌊 {rep.tide.replace(/_/g, ' ')}
                      </span>
                      <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.5 rounded font-bold">
                        👥 Afluencia: {rep.crowdLevel}
                      </span>
                      {rep.temperatureOrWeather && (
                        <span className="text-slate-500 font-medium">{rep.temperatureOrWeather}</span>
                      )}
                    </div>

                    <p className="text-slate-800 text-xs font-medium leading-relaxed">
                      <strong className="text-slate-950">{rep.sellerName}:</strong> {rep.comments}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 text-xs">
                No hay avisos registrados todavía para hoy.
              </div>
            )}
          </div>

        </div>
      )}

      {/* =========================================================================
          PESTAÑA 4: MIS COMPROBANTES DE LA JORNADA
          Listado claro con foto, estado, monto y botón para volver a comprobar
          ========================================================================= */}
      {terminalTab === 'comprobantes' && (
        <div className="space-y-3 animate-fadeIn">
          
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-base font-black text-slate-950 flex items-center space-x-1.5">
                  <Camera className="w-5 h-5 text-sky-600" />
                  <span>Mis Comprobantes de Transferencia</span>
                </h3>
                <span className="text-xs text-slate-500 font-semibold">
                  {myShiftVouchers.length} registrados en {activeShift.cartCode}
                </span>
              </div>

              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('vouchers-repository')}
                  className="text-xs font-black text-amber-900 hover:text-amber-800 flex items-center space-x-1 cursor-pointer"
                >
                  <span>Ver Todos</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {myShiftVouchers.length === 0 ? (
              <div className="text-center py-10 text-slate-500 space-y-2">
                <FileText className="w-10 h-10 text-slate-400 mx-auto" />
                <p className="text-sm font-bold text-slate-800">Aún no registraste comprobantes en esta jornada.</p>
                <p className="text-xs text-slate-500">Cada cobro con Mercado Pago o Transferencia aparecerá aquí con su foto y estado.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {myShiftVouchers.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-3 bg-slate-50 rounded-xl border-2 border-slate-200 flex items-center justify-between space-x-3"
                  >
                    <div className="flex items-center space-x-3">
                      {sale.voucherPhotoUrl ? (
                        <div
                          onClick={() => setInspectVoucherSale(sale)}
                          className="w-14 h-14 rounded-xl bg-slate-200 border-2 border-slate-300 overflow-hidden shrink-0 cursor-pointer relative group"
                        >
                          <img
                            src={sale.voucherPhotoUrl}
                            alt="Comprobante"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Eye className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-slate-200 border-2 border-slate-300 flex items-center justify-center shrink-0 text-slate-500">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                      )}

                      <div>
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          <span className="font-black text-slate-950 text-sm font-mono">
                            ${sale.totalAmount.toLocaleString()}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded border font-black uppercase ${
                              sale.validationStatus === 'validada'
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : sale.validationStatus === 'sospechosa'
                                ? 'bg-rose-100 text-rose-900 border-rose-300'
                                : 'bg-amber-100 text-amber-900 border-amber-300'
                            }`}
                          >
                            {sale.validationStatus}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 font-semibold mt-0.5">
                          {sale.varietyName} ({sale.quantityUnitsEquivalent} u)
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {sale.timestamp.slice(11, 19)} hs {sale.voucherExtractedData?.operationId ? `• Op #${sale.voucherExtractedData.operationId}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {sale.voucherPhotoUrl && (
                        <button
                          type="button"
                          onClick={() => setInspectVoucherSale(sale)}
                          className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-black rounded-lg flex items-center space-x-1 shadow-xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-sky-600" />
                          <span>Ver</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* =========================================================================
          MODAL: CONSULTAR MIS COMPROBANTES (Punto 5 del requerimiento)
          ========================================================================= */}
      {showMyVouchersModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center font-bold">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-950">Mis Comprobantes de Transferencia</h3>
                  <span className="text-[11px] text-slate-600 font-semibold">
                    Jornada: {activeShift.cartCode} ({myShiftVouchers.length} registrados)
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowMyVouchersModal(false)}
                className="text-slate-500 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {myShiftVouchers.length === 0 ? (
                <div className="text-center py-10 text-slate-500 space-y-2">
                  <FileText className="w-10 h-10 text-slate-400 mx-auto" />
                  <p className="text-sm font-bold text-slate-800">Aún no registraste comprobantes en esta jornada.</p>
                  <p className="text-xs text-slate-500">Cada venta con Mercado Pago y comprobante aparecerá aquí.</p>
                </div>
              ) : (
                myShiftVouchers.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-3 bg-slate-50 rounded-xl border-2 border-slate-200 flex items-center justify-between space-x-3"
                  >
                    <div className="flex items-center space-x-3">
                      {sale.voucherPhotoUrl ? (
                        <div
                          onClick={() => setInspectVoucherSale(sale)}
                          className="w-14 h-14 rounded-lg bg-slate-200 border border-slate-300 overflow-hidden shrink-0 cursor-pointer relative group"
                        >
                          <img
                            src={sale.voucherPhotoUrl}
                            alt="Comprobante"
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Eye className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-slate-200 border border-slate-300 flex items-center justify-center shrink-0 text-slate-500">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                      )}

                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-black text-slate-950 text-xs sm:text-sm">
                            ${sale.totalAmount.toLocaleString()}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-black uppercase ${
                              sale.validationStatus === 'validada'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : sale.validationStatus === 'sospechosa'
                                ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}
                          >
                            {sale.validationStatus}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 font-semibold">
                          {sale.varietyName} ({sale.quantityUnitsEquivalent} u)
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {sale.timestamp} {sale.voucherExtractedData?.operationId ? `• Op: #${sale.voucherExtractedData.operationId}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      {sale.voucherPhotoUrl && (
                        <button
                          onClick={() => setInspectVoucherSale(sale)}
                          className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold rounded-lg flex items-center space-x-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-sky-600" />
                          <span>Ver</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-200 pt-3 flex justify-between items-center text-xs">
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMyVouchersModal(false);
                    onNavigate('vouchers-repository');
                  }}
                  className="text-amber-900 hover:text-amber-800 font-black flex items-center space-x-1 cursor-pointer"
                >
                  <span>Abrir Galería Completa de Comprobantes</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowMyVouchersModal(false)}
                className="px-4 py-2 bg-slate-200 text-slate-800 font-bold rounded-xl hover:bg-slate-300 ml-auto cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: REGISTRAR MERMA (Punto 7 del requerimiento)
          ========================================================================= */}
      {showWasteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-950">Registrar Merma</h3>
                  <span className="text-[11px] text-slate-600">Producto roto, caído o inutilizado en jornada</span>
                </div>
              </div>
              <button
                onClick={() => setShowWasteModal(false)}
                className="text-slate-500 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {wasteSuccessMessage ? (
              <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl text-center space-y-2 animate-fadeIn">
                <CheckCircle2 className="w-8 h-8 text-emerald-700 mx-auto" />
                <p className="text-sm font-black text-emerald-950">{wasteSuccessMessage}</p>
                <p className="text-xs text-emerald-800">El stock restante en carrito se actualizó en tiempo real.</p>
              </div>
            ) : (
              <form onSubmit={handleConfirmWaste} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-800 mb-1">Variedad de Tequeño</label>
                  <select
                    value={wasteVarietyId}
                    onChange={(e) => setWasteVarietyId(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 text-xs text-slate-950 font-bold focus:outline-none focus:border-amber-500"
                  >
                    {varieties.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 mb-1">Cantidad de Unidades</label>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => setWasteUnits((prev) => Math.max(1, prev - 1))}
                      className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 border-2 border-slate-300 font-black flex items-center justify-center text-lg active:scale-95"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={wasteUnits}
                      onChange={(e) => setWasteUnits(Math.max(1, Number(e.target.value)))}
                      className="flex-1 bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 text-center text-base font-black text-slate-950 font-mono"
                      min="1"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setWasteUnits((prev) => prev + 1)}
                      className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 border-2 border-slate-300 font-black flex items-center justify-center text-lg active:scale-95"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 mb-1">Motivo de la Merma</label>
                  <select
                    value={wasteReason}
                    onChange={(e) => setWasteReason(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 text-xs text-slate-950 font-bold focus:outline-none focus:border-amber-500"
                  >
                    <option value="Caído en la arena">🏖️ Caído en la arena</option>
                    <option value="Roto / desarmado al freír">🍳 Roto o desarmado en freidora</option>
                    <option value="Sobrecalentado / quemado">🔥 Sobrecalentado / quemado</option>
                    <option value="Defecto de masa o relleno">🧀 Defecto de masa o relleno abierto</option>
                    <option value="Otro motivo">Otro motivo</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowWasteModal(false)}
                    className="px-4 py-2 bg-slate-100 text-xs font-bold text-slate-700 rounded-xl hover:bg-slate-200 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-400 hover:bg-amber-300 border-2 border-amber-500 text-slate-950 text-xs font-black rounded-xl shadow-sm cursor-pointer"
                  >
                    Confirmar Merma
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: REGISTRAR SOBRANTES Y CIERRE DE JORNADA (Puntos 6 y 8)
          ========================================================================= */}
      {showClosingModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-950">Sobrantes y Cierre de Jornada</h3>
                  <span className="text-[11px] text-slate-600 font-semibold">
                    Jornada: {activeShift.cartCode} • {currentUser.name}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowClosingModal(false);
                  setClosingSuccessSummary(null);
                }}
                className="text-slate-500 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {closingSuccessSummary ? (
              <div className="space-y-4 py-2 animate-fadeIn">
                <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl text-center space-y-2">
                  <CheckCircle2 className="w-12 h-12 text-emerald-700 mx-auto" />
                  <h4 className="text-lg font-black text-slate-950">¡Jornada Cerrada y Conciliada!</h4>
                  <p className="text-xs text-emerald-900 font-medium">
                    Se registraron los sobrantes devueltos a la base, las mermas y la liquidación de comisión.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-600">Ventas Brutas Totales:</span>
                    <span className="font-black text-slate-950 font-mono">${closingSuccessSummary.totalGrossSales.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-600">Efectivo Declarado:</span>
                    <span className="font-black text-emerald-800 font-mono">${closingSuccessSummary.cashDeclared.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-600">Total Tequeños Devueltos (Sobrantes):</span>
                    <span className="font-black text-sky-800 font-mono">{closingSuccessSummary.totalUnitsReturned} u</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="font-black text-slate-900">Comisión Final a Liquidar:</span>
                    <span className="font-black text-emerald-800 text-sm font-mono">
                      ${closingSuccessSummary.finalPayoutAmount.toLocaleString()}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowClosingModal(false);
                    setClosingSuccessSummary(null);
                  }}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Aceptar y Finalizar
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmCloseShift} className="space-y-4">
                
                {/* 1. Conteo de Sobrantes por Variedad */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center">
                      <Scale className="w-3.5 h-3.5 text-amber-600 mr-1.5" />
                      1. Conteo de Sobrantes Devueltos a Base
                    </label>
                    <button
                      type="button"
                      onClick={handleSaveLeftoversOnly}
                      className="text-[11px] text-amber-900 hover:text-amber-800 font-black cursor-pointer underline"
                    >
                      Guardar Sobrantes sin Cerrar
                    </button>
                  </div>

                  <div className="space-y-2">
                    {activeShift.stockItems.map((item) => {
                      const returned = closingReturnedCounts[item.varietyId] ?? 0;
                      const waste = closingWasteCounts[item.varietyId] ?? item.wasteUnits ?? 0;
                      const delivered = item.deliveredUnits + item.reSuppliedUnits;
                      const diff = delivered - item.soldUnits - returned - waste;

                      return (
                        <div
                          key={item.varietyId}
                          className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2"
                        >
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-black text-slate-950">{item.varietyName}</span>
                            <span className="text-[11px] text-slate-600 font-mono">
                              Entregados: {delivered} | Vendidos: {item.soldUnits}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-1">
                            <div>
                              <label className="block text-[10px] text-sky-900 font-bold mb-1">
                                Sobrantes Intactos (Devueltos)
                              </label>
                              <input
                                type="number"
                                min="0"
                                max={delivered}
                                value={returned}
                                onChange={(e) =>
                                  setClosingReturnedCounts({
                                    ...closingReturnedCounts,
                                    [item.varietyId]: Number(e.target.value)
                                  })
                                }
                                className="w-full bg-white border-2 border-slate-300 rounded-lg p-1.5 text-xs text-center font-bold text-slate-950 font-mono"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-amber-900 font-bold mb-1">
                                Mermas Acumuladas
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={waste}
                                onChange={(e) =>
                                  setClosingWasteCounts({
                                    ...closingWasteCounts,
                                    [item.varietyId]: Number(e.target.value)
                                  })
                                }
                                className="w-full bg-white border-2 border-slate-300 rounded-lg p-1.5 text-xs text-center font-bold text-slate-950 font-mono"
                              />
                            </div>
                          </div>

                          <div className="flex justify-between text-[10px] text-slate-600 pt-0.5 border-t border-slate-200">
                            <span>Balance tequeños:</span>
                            <span
                              className={`font-mono font-bold ${
                                diff === 0 ? 'text-emerald-700' : diff > 0 ? 'text-rose-700' : 'text-amber-700'
                              }`}
                            >
                              {diff === 0 ? 'Cuadre perfecto (0)' : diff > 0 ? `Faltante de ${diff} u` : `Excedente de ${Math.abs(diff)} u`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Arqueo de Efectivo */}
                <div className="space-y-2 pt-1 border-t border-slate-200">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-700 mr-1.5" />
                    2. Arqueo de Efectivo en Mano
                  </label>

                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[10px] text-slate-600 block mb-1 font-bold">Efectivo Esperado</span>
                      <div className="text-base font-black text-slate-950 font-mono">
                        ${(activeShift.cashExpected || activeShift.totalCashSales).toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-600 block mb-1 font-bold">Efectivo Contado en Mano</span>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1.5 text-xs text-slate-500 font-bold">$</span>
                        <input
                          type="number"
                          value={closingCashDeclared}
                          onChange={(e) => setClosingCashDeclared(Number(e.target.value))}
                          className="w-full bg-white border-2 border-slate-300 rounded-lg p-1.5 pl-6 text-xs font-bold text-slate-950 font-mono"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-[11px] font-mono">
                    {closingCashDeclared - (activeShift.cashExpected || activeShift.totalCashSales) === 0 ? (
                      <span className="text-emerald-700 font-bold">✓ Caja cuadrada sin diferencias</span>
                    ) : closingCashDeclared - (activeShift.cashExpected || activeShift.totalCashSales) < 0 ? (
                      <span className="text-rose-700 font-bold">
                        ⚠️ Diferencia negativa de ${Math.abs(closingCashDeclared - (activeShift.cashExpected || activeShift.totalCashSales)).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-sky-700 font-bold">
                        Sobrante de caja de ${Math.abs(closingCashDeclared - (activeShift.cashExpected || activeShift.totalCashSales)).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* 3. Garrafa y Observaciones */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-black text-slate-800 mb-1">Gas Garrafa Final (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={closingGasPercent}
                      onChange={(e) => setClosingGasPercent(Number(e.target.value))}
                      className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2 text-xs text-slate-950 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-800 mb-1">Notas de Cierre</label>
                    <input
                      type="text"
                      placeholder="Observaciones de jornada..."
                      value={closingNotes}
                      onChange={(e) => setClosingNotes(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2 text-xs text-slate-950 font-medium"
                    />
                  </div>
                </div>

                {/* Botón de Cierre Definitivo */}
                <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowClosingModal(false)}
                    className="px-4 py-2 bg-slate-100 text-xs font-bold text-slate-700 rounded-xl hover:bg-slate-200 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-md flex items-center space-x-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Realizar Cierre de Mi Jornada</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: INSPECCIÓN AMPLIADA DE COMPROBANTE
          ========================================================================= */}
      {inspectVoucherSale && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 max-h-[90vh] flex flex-col text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-sm font-black text-slate-950 flex items-center space-x-1.5">
                <Camera className="w-4 h-4 text-sky-600" />
                <span>Comprobante: {inspectVoucherSale.voucherExtractedData?.operationId || inspectVoucherSale.id}</span>
              </h3>
              <button
                onClick={() => setInspectVoucherSale(null)}
                className="text-slate-500 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center max-h-72 border-2 border-slate-300">
              <img
                src={inspectVoucherSale.voucherPhotoUrl}
                alt="Comprobante"
                className="max-h-72 w-auto object-contain"
              />
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-600 font-bold">Importe:</span>
                <span className="font-black text-slate-950 font-mono">${inspectVoucherSale.totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-bold">Estado de Validación:</span>
                <span className="font-black uppercase text-emerald-800">{inspectVoucherSale.validationStatus}</span>
              </div>
              {inspectVoucherSale.voucherExtractedData?.senderName && (
                <div className="flex justify-between">
                  <span className="text-slate-600 font-bold">Emisor:</span>
                  <span className="text-slate-950 font-bold">{inspectVoucherSale.voucherExtractedData.senderName}</span>
                </div>
              )}
              {inspectVoucherSale.voucherExtractedData?.aiNotes && (
                <p className="text-[11px] text-slate-600 italic pt-1 border-t border-slate-200">
                  {inspectVoucherSale.voucherExtractedData.aiNotes}
                </p>
              )}
            </div>

            <button
              onClick={() => setInspectVoucherSale(null)}
              className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 text-xs font-black rounded-xl cursor-pointer"
            >
              Cerrar Vista
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Reporte de Estado de Playa & Mareas */}
      {showBeachReportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-2 border-slate-300 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center">
                  <Waves className="w-5 h-5 animate-pulse text-sky-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-950 leading-tight">
                    Reporte de Estado de Playa
                  </h3>
                  <span className="text-[11px] text-sky-800 font-bold">
                    Costa Atlántica • Información en Tiempo Real
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBeachReportModal(false)}
                className="text-slate-500 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {beachReportSuccessMsg ? (
              <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl text-center space-y-2 text-emerald-900">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-700" />
                <p className="font-black text-sm">{beachReportSuccessMsg}</p>
                <p className="text-xs text-slate-600">Actualizando radar operativo...</p>
              </div>
            ) : (
              <form onSubmit={handleConfirmBeachReport} className="space-y-4">
                {/* 1. Localidad y Sector */}
                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-800">
                    1. Localidad & Sector Costero
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {['Santa Teresita', 'Mar del Tuyú', 'Costa del Este', 'Las Toninas', 'San Bernardo'].map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => setBeachReportLocality(loc)}
                        className={`p-2 rounded-xl text-xs font-black border-2 transition-all cursor-pointer text-left ${
                          beachReportLocality === loc
                            ? 'bg-sky-500 text-white border-sky-600 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        🏖️ {loc}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Detalle de bajada o sector (ej: Bajada Calle 38, Muelle, Parador 2)..."
                    value={beachReportSector}
                    onChange={(e) => setBeachReportSector(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-950 font-bold placeholder-slate-400 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* 2. Estado de Marea */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-800">
                    2. Estado de la Marea
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { id: 'marea_baja', label: '🌊 Marea Baja', desc: 'Playa ancha, buena circulación' },
                      { id: 'marea_normal', label: '🌊 Marea Normal', desc: 'Franja de playa adecuada' },
                      { id: 'marea_alta', label: '⚠️ Marea Alta', desc: 'Poco espacio en orilla' },
                      { id: 'sin_playa_marea_llena', label: '🚨 Sin Playa Seca', desc: 'Mar hasta las carpas/duna' }
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setBeachReportTide(item.id as any)}
                        className={`p-2 rounded-xl border-2 text-left cursor-pointer transition-all ${
                          beachReportTide === item.id
                            ? 'bg-sky-50 border-sky-500 text-sky-950 ring-2 ring-sky-300'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-black text-[11px] text-slate-950">{item.label}</div>
                        <div className="text-[10px] text-slate-500 leading-tight font-medium">{item.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Afluencia de Personas */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-800">
                    3. Afluencia de Turistas
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: 'muy_alta', label: '🔥 Muy Alta' },
                      { id: 'alta', label: '👥 Alta' },
                      { id: 'media', label: '🚶 Media' },
                      { id: 'baja', label: '🏖️ Poca gente' }
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setBeachReportCrowd(item.id as any)}
                        className={`p-2 rounded-xl border-2 text-center text-xs font-black cursor-pointer transition-all ${
                          beachReportCrowd === item.id
                            ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Tipo de Situación */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-800">
                    4. Tipo de Reporte
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { id: 'estado_general', label: 'ℹ️ Estado General', desc: 'Monitoreo de rutina' },
                      { id: 'oportunidad', label: '💡 Oportunidad Comercial', desc: 'Torneo, música, alta demanda' },
                      { id: 'inconveniente', label: '⚠️ Inconveniente', desc: 'Marea alta, viento, problema' },
                      { id: 'cambio_de_zona', label: '🔄 Cambio de Sector', desc: 'Me desplazo a otra zona' }
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setBeachReportType(item.id as any)}
                        className={`p-2 rounded-xl border-2 text-left cursor-pointer transition-all ${
                          beachReportType === item.id
                            ? 'bg-amber-50 border-amber-500 text-amber-950 ring-2 ring-amber-300'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-black text-[11px] text-slate-950">{item.label}</div>
                        <div className="text-[10px] text-slate-500 leading-tight font-medium">{item.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Comentario / Observación */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-800">
                    5. Observación del Vendedor (Obligatorio)
                  </label>
                  <textarea
                    value={beachReportComments}
                    onChange={(e) => setBeachReportComments(e.target.value)}
                    placeholder="Ej: Marea alta tapó la orilla en Santa Teresita, me replegué 5 cuadras hacia Mar del Tuyú donde hay mucha gente..."
                    rows={3}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 text-xs text-slate-950 font-medium placeholder-slate-400 focus:outline-none focus:border-sky-500"
                    required
                  />
                </div>

                {/* Clima / Temperatura */}
                <div className="flex items-center space-x-2">
                  <Sun className="w-4 h-4 text-amber-600 shrink-0" />
                  <input
                    type="text"
                    placeholder="Clima (ej: 29°C Soleado, viento leve)"
                    value={beachReportWeather}
                    onChange={(e) => setBeachReportWeather(e.target.value)}
                    className="flex-1 bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-950 font-bold focus:outline-none"
                  />
                </div>

                {/* Botones */}
                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowBeachReportModal(false)}
                    className="px-4 py-2 bg-slate-100 text-xs font-bold text-slate-700 rounded-xl hover:bg-slate-200 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs rounded-xl shadow-md flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Emitir Reporte a Coordinación</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Reporte Rápido de Incidencia */}
      {showIncidentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-950 flex items-center">
                <Flame className="w-5 h-5 text-rose-600 mr-2" />
                <span>Aviso a Base de Coordinación</span>
              </h3>
              <button onClick={() => setShowIncidentModal(false)} className="text-slate-500 hover:text-slate-900 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleReportIncident} className="space-y-3">
              <div>
                <label className="block text-xs font-black text-slate-800 mb-1">Tipo de Problema</label>
                <select
                  value={incidentType}
                  onChange={(e) => setIncidentType(e.target.value as any)}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 text-xs text-slate-950 font-bold"
                >
                  <option value="quemador_gas">Falla en Quemador / Garrafa de Gas</option>
                  <option value="rueda_arena">Rueda trabada / Arena pesada</option>
                  <option value="falta_insumos">Me quedé sin Servilletas / Salsas</option>
                  <option value="otro">Otro problema operativo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 mb-1">Detalle del Problema</label>
                <textarea
                  value={incidentDescription}
                  onChange={(e) => setIncidentDescription(e.target.value)}
                  placeholder="Ej: Se apagó el piloto y no prende, estoy a la altura de la carpa 40..."
                  rows={3}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 text-xs text-slate-950 font-medium focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowIncidentModal(false)}
                  className="px-4 py-2 bg-slate-100 text-xs font-bold text-slate-700 rounded-xl hover:bg-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl flex items-center space-x-1 shadow-sm cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar Alerta</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: QR de Cobro Rápido Mercado Pago para el Comprador */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-center text-slate-900 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2 text-left">
                <div className="p-1.5 rounded-lg bg-sky-100 text-sky-800">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-950">QR de Pago Mercado Pago</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Mostrale esta pantalla al comprador</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="text-slate-500 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-white rounded-2xl inline-block border-2 border-slate-200 shadow-sm mx-auto">
              <div className="w-48 h-48 bg-white flex flex-col items-center justify-center relative p-2">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <rect x="5" y="5" width="28" height="28" fill="#000" rx="3" />
                  <rect x="9" y="9" width="20" height="20" fill="#fff" rx="2" />
                  <rect x="13" y="13" width="12" height="12" fill="#0284c7" rx="1" />

                  <rect x="67" y="5" width="28" height="28" fill="#000" rx="3" />
                  <rect x="71" y="9" width="20" height="20" fill="#fff" rx="2" />
                  <rect x="75" y="13" width="12" height="12" fill="#0284c7" rx="1" />

                  <rect x="5" y="67" width="28" height="28" fill="#000" rx="3" />
                  <rect x="9" y="71" width="20" height="20" fill="#fff" rx="2" />
                  <rect x="13" y="75" width="12" height="12" fill="#0284c7" rx="1" />

                  <rect x="38" y="8" width="6" height="6" fill="#000" />
                  <rect x="48" y="8" width="6" height="6" fill="#000" />
                  <rect x="58" y="8" width="6" height="6" fill="#000" />
                  
                  <rect x="8" y="38" width="6" height="6" fill="#000" />
                  <rect x="18" y="38" width="6" height="6" fill="#000" />
                  <rect x="28" y="38" width="6" height="6" fill="#000" />
                  <rect x="38" y="38" width="8" height="8" fill="#0284c7" />
                  <rect x="50" y="38" width="6" height="6" fill="#000" />
                  <rect x="60" y="38" width="6" height="6" fill="#000" />
                  <rect x="70" y="38" width="6" height="6" fill="#000" />
                  <rect x="82" y="38" width="6" height="6" fill="#000" />

                  <rect x="38" y="50" width="6" height="6" fill="#000" />
                  <rect x="48" y="50" width="8" height="8" fill="#000" />
                  <rect x="60" y="50" width="6" height="6" fill="#0284c7" />
                  <rect x="74" y="50" width="6" height="6" fill="#000" />

                  <rect x="38" y="65" width="6" height="6" fill="#000" />
                  <rect x="52" y="65" width="6" height="6" fill="#000" />
                  <rect x="65" y="65" width="8" height="8" fill="#000" />
                  <rect x="78" y="65" width="6" height="6" fill="#000" />

                  <rect x="38" y="78" width="8" height="8" fill="#0284c7" />
                  <rect x="52" y="78" width="6" height="6" fill="#000" />
                  <rect x="65" y="78" width="6" height="6" fill="#000" />
                  <rect x="78" y="78" width="8" height="8" fill="#000" />
                </svg>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="font-black text-slate-950 text-base font-mono">
                Importe: ${calculatedTotalAmount.toLocaleString()}
              </div>
              <p className="text-slate-600 text-[11px] font-bold">
                O transferir directamente al Alias:
              </p>
              <div className="p-2.5 bg-slate-50 border-2 border-slate-300 rounded-xl flex items-center justify-between">
                <span className="font-mono font-black text-sky-800 text-sm">
                  {state.systemConfig?.mercadoPagoConfig?.alias || 'tequenos.costa.mp'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(state.systemConfig?.mercadoPagoConfig?.alias || 'tequenos.costa.mp');
                    setCopiedAlias(true);
                    setTimeout(() => setCopiedAlias(false), 2000);
                  }}
                  className="px-2.5 py-1 bg-sky-100 hover:bg-sky-200 text-sky-900 border border-sky-300 rounded-lg text-xs font-black cursor-pointer"
                >
                  {copiedAlias ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                Titular: {state.systemConfig?.mercadoPagoConfig?.accountHolder || 'Tequeños Costa SRL'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-black rounded-xl border border-slate-300 cursor-pointer"
            >
              Listo / Volver a la Terminal
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Captura Directa con Cámara Trasera */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handleCameraCapture}
      />

      {/* MODAL: Laboratorio de Pruebas Mercado Pago & Generador de Comprobantes */}
      <MercadoPagoTestLabModal
        isOpen={showTestLabModal}
        onClose={() => setShowTestLabModal(false)}
        varieties={varieties}
        onUseVoucherInTerminal={(base64, amount, opId) => {
          setPaymentMethod('mercado_pago');
          setManualOperationId(opId);
          processVoucherBase64(base64);
        }}
      />

    </div>
  );
};
