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
  CreditCard
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AppState, storageService } from '../services/storageService';
import { analyzeVoucherWithAI, VoucherAnalysisResult } from '../services/aiValidationService';
import { CameraCaptureModal } from './CameraCaptureModal';
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

  // Procesar imagen de comprobante
  const processVoucherBase64 = async (base64: string) => {
    setVoucherImage(base64);
    setVoucherAnalysis(null);

    setIsAnalyzingVoucher(true);
    const existingOpIds = sales
      .map((s) => s.voucherExtractedData?.operationId)
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

  // 1. Confirmar y Registrar Venta
  const handleConfirmSale = () => {
    if (!activeShift) {
      alert('No tenés una jornada activa despachada hoy.');
      return;
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
      voucherExtractedData: voucherAnalysis ? voucherAnalysis.extractedData : undefined,
      validationStatus: voucherAnalysis
        ? voucherAnalysis.validationStatus
        : paymentMethod === 'efectivo'
        ? 'validada'
        : 'pendiente_revision'
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
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto text-3xl shadow-inner">
            🏖️
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Vendedor: {currentUser.name}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Esperando Despacho de Carrito
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              Hola, <strong className="text-white">{currentUser.name}</strong>. Actualmente no tenés una jornada activa ni carrito asignado para hoy.
            </p>
          </div>

          <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-left space-y-3 text-xs text-slate-300 max-w-md mx-auto">
            <div className="font-bold text-amber-400 uppercase tracking-wider text-[11px] flex items-center">
              <ShieldAlert className="w-4 h-4 mr-1.5 shrink-0" />
              Protocolo de Asignación y Carga
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Por normativa y control de inventario, la asignación de carritos y entrega de stock de tequeños solo puede ser realizada por tu <strong className="text-amber-300">Coordinador</strong> o el <strong className="text-amber-300">Administrador</strong> desde la base operativa.
            </p>
            <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-slate-400 text-[11px]">
              <div className="flex justify-between">
                <span>Base asignada:</span>
                <span className="text-slate-200 font-semibold">{assignedHouse?.name || 'Base Operativa'}</span>
              </div>
              <div className="flex justify-between">
                <span>Tu comisión:</span>
                <span className="text-emerald-400 font-bold">{Math.round(myCommissionRate * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Estado:</span>
                <span className="text-amber-400 font-semibold">Pendiente de Check-out en Base</span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            {onNavigate && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate('seller-vouchers')}
                  className="w-full sm:w-auto px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm rounded-xl border border-slate-700 flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-sky-400" />
                  <span>Mis Comprobantes</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('reconciliation')}
                  className="w-full sm:w-auto px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm rounded-xl border border-slate-700 flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <Coins className="w-4 h-4 text-emerald-400" />
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
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto text-3xl shadow-inner">
            🏖️
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Rol: {currentUser.name} ({currentUser.role === 'coordinator' ? 'Coordinador' : currentUser.role})</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Terminal de Ventas de Playa
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              Los coordinadores y administradores pueden asignar carritos y salir a vender en la playa cuando lo requieran. Actualmente no tenés un carrito asignado para hoy.
            </p>
          </div>

          <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-left space-y-2.5 text-xs text-slate-300 max-w-md mx-auto">
            <div className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center text-amber-400">
              <Check className="w-3.5 h-3.5 mr-1" />
              Capacidades autorizadas para coordinación:
            </div>
            <ul className="space-y-1.5 pl-1 text-[11px] text-slate-300">
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
              className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <Store className="w-4 h-4" />
              <span>Asignarme Carrito y Salir a Vender</span>
            </button>

            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('planning')}
                className="w-full sm:w-auto px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm rounded-xl border border-slate-700 flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <ClipboardList className="w-4 h-4 text-sky-400" />
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
    <div className="max-w-2xl mx-auto space-y-4 pb-20 animate-fadeIn">
      
      {/* 1. Barra Superior de Rendimiento en Tiempo Real */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/20">
              🏖️
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-white leading-tight">
                  {currentUser.name}
                </h2>
                {currentUser.role === 'coordinator' && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-bold">
                    Coordinador en Venta
                  </span>
                )}
              </div>
              <span className="text-[11px] text-amber-400 font-medium">
                {activeShift.cartCode} • {activeShift.zoneName}
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Mi Comisión ({Math.round(myCommissionRate * 100)}%)</div>
            <div className="text-lg font-black text-emerald-400">
              ${myEarnedCommission.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Mini Métricas de la Jornada */}
        <div className="grid grid-cols-3 gap-2 pt-3 text-center">
          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-medium">Ventas Hoy</span>
            <span className="text-xs sm:text-sm font-black text-white">${activeShift.totalGrossSales.toLocaleString()}</span>
          </div>

          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-medium">Tequeños Vendidos</span>
            <span className="text-xs sm:text-sm font-black text-amber-300">{activeShift.totalUnitsSold} u</span>
          </div>

          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-medium">En Carrito</span>
            <span className="text-xs sm:text-sm font-black text-sky-400">{unitsRemainingInCart} u</span>
          </div>
        </div>

        {/* Escalafón y Progreso de Comisión del Vendedor */}
        {dynamicCommissionCalc && (
          <div className="mt-3 p-3 bg-gradient-to-r from-amber-500/10 via-slate-950/80 to-emerald-500/10 border border-amber-500/30 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-1.5 text-amber-300 font-bold">
                <Award className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Escalafón: {dynamicCommissionCalc.tierName}</span>
              </div>
              <span className="font-mono font-black text-emerald-400 text-xs bg-emerald-950/80 px-2 py-0.5 rounded-lg border border-emerald-800/60">
                {Math.round(myCommissionRate * 100)}% de comisión
              </span>
            </div>

            {dynamicCommissionCalc.salesToNextTier && dynamicCommissionCalc.salesToNextTier > 0 ? (
              <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1 border-t border-slate-800/80">
                <span className="text-slate-400">
                  Próximo escalafón ({Math.round((dynamicCommissionCalc.nextTier?.rate || 0) * 100)}%):
                </span>
                <span className="text-sky-300 font-bold flex items-center space-x-1">
                  <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
                  <span>¡Faltan solo ${dynamicCommissionCalc.salesToNextTier.toLocaleString()} en ventas!</span>
                </span>
              </div>
            ) : (
              <div className="text-[11px] text-amber-300/90 font-medium pt-1 border-t border-slate-800/80 text-right">
                ⭐ ¡Alcanzaste el escalafón máximo de recompensa!
              </div>
            )}
          </div>
        )}

        {/* Notificación de Restock Recibido en Jornada */}
        {Boolean(activeShift.totalUnitsRestocked && activeShift.totalUnitsRestocked > 0) && (
          <div className="mt-3 p-2.5 bg-sky-950/40 border border-sky-500/30 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 text-sky-300">
              <Package className="w-4 h-4 text-sky-400 shrink-0" />
              <span>
                <strong>+{activeShift.totalUnitsRestocked} tequeños</strong> sumados en restock por coordinación
              </span>
            </div>
            <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full font-bold">
              {activeShift.restocks?.length || 1} entrega(s) extra
            </span>
          </div>
        )}

        {/* 2. Barra de Acciones Operativas Rápidas (Comprobantes, Reporte de Playa, Merma, Sobrantes y Cierre) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-800/80 mt-3">
          <button
            type="button"
            onClick={() => setShowMyVouchersModal(true)}
            className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-700/70 hover:border-slate-600 rounded-xl flex flex-col items-center justify-center space-y-1 transition-all text-slate-200 cursor-pointer group"
          >
            <div className="flex items-center space-x-1">
              <Camera className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-bold text-white">Comprobantes</span>
            </div>
            <span className="text-[10px] text-sky-400 font-semibold">
              {myShiftVouchers.length} registrados
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowBeachReportModal(true)}
            className="p-2.5 bg-gradient-to-b from-sky-950/40 to-sky-900/20 hover:from-sky-900/40 hover:to-sky-800/30 border border-sky-500/40 hover:border-sky-400 rounded-xl flex flex-col items-center justify-center space-y-1 transition-all text-sky-300 cursor-pointer group"
          >
            <div className="flex items-center space-x-1">
              <Waves className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform animate-pulse" />
              <span className="text-[11px] font-bold text-white">Estado Playa</span>
            </div>
            <span className="text-[10px] text-sky-400 font-semibold">
              Marea / Afluencia
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowWasteModal(true)}
            className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-700/70 hover:border-slate-600 rounded-xl flex flex-col items-center justify-center space-y-1 transition-all text-slate-200 cursor-pointer group"
          >
            <div className="flex items-center space-x-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-bold text-white">Registrar Merma</span>
            </div>
            <span className="text-[10px] text-amber-400 font-semibold">
              Caído / Roto
            </span>
          </button>

          <button
            type="button"
            onClick={handleOpenClosingModal}
            className="p-2.5 bg-gradient-to-b from-emerald-950/40 to-emerald-900/20 hover:from-emerald-900/40 hover:to-emerald-800/30 border border-emerald-600/40 hover:border-emerald-500 rounded-xl flex flex-col items-center justify-center space-y-1 transition-all text-emerald-300 cursor-pointer group"
          >
            <div className="flex items-center space-x-1">
              <Coins className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-bold text-emerald-200">Sobrantes</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-semibold">
              Arqueo final
            </span>
          </button>
        </div>
      </div>

      {/* Radar de Estado de Playa en Vivo (Últimos Reportes de la Costa) */}
      {state.beachReports && state.beachReports.length > 0 && (
        <div className="bg-slate-900 border border-sky-900/40 rounded-2xl p-3.5 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-sky-300 flex items-center space-x-1.5">
              <Waves className="w-4 h-4 text-sky-400 animate-pulse" />
              <span>Radar de Playas en Vivo — Avisos de la Costa</span>
            </span>
            <button
              type="button"
              onClick={() => setShowBeachReportModal(true)}
              className="text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center space-x-1 cursor-pointer"
            >
              <span>+ Nuevo aviso</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {state.beachReports.slice(0, 2).map((rep) => (
              <div
                key={rep.id}
                className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] space-y-1"
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="text-amber-300 flex items-center space-x-1">
                    <MapPin className="w-3 h-3 text-amber-400" />
                    <span>{rep.locality}</span>
                  </span>
                  <span className="text-slate-400 text-[10px] font-mono">{rep.timestamp.slice(11, 16)} hs</span>
                </div>
                <div className="flex items-center space-x-2 text-[10px] text-slate-300">
                  <span className="bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded font-medium">
                    🌊 {rep.tide.replace(/_/g, ' ')}
                  </span>
                  <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-medium">
                    👥 Afluencia {rep.crowdLevel}
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] leading-snug line-clamp-2">
                  <strong className="text-white">{rep.sellerName}:</strong> {rep.comments}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Selector de Producto / Combo y Multiplicador */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
            1. Seleccioná el Pedido
          </label>
          <div className="flex items-center space-x-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 font-semibold">Cantidad:</span>
            <button
              type="button"
              onClick={() => setQuantityMultiplier((prev) => Math.max(1, prev - 1))}
              className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs"
            >
              -
            </button>
            <span className="text-xs font-black text-amber-400 px-1 font-mono">
              {quantityMultiplier}
            </span>
            <button
              type="button"
              onClick={() => setQuantityMultiplier((prev) => prev + 1)}
              className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs"
            >
              +
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {(Object.keys(itemPrices) as (keyof typeof itemPrices)[]).map((key) => {
            const item = itemPrices[key];
            const isSelected = selectedItemType === key;
            const priceForMultiplier = item.price * quantityMultiplier;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedItemType(key)}
                className={`p-3.5 rounded-xl text-left border transition-all flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-500 text-white shadow-md shadow-amber-500/10 ring-1 ring-amber-500'
                    : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="font-bold text-xs sm:text-sm">{item.label}</div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {item.units * quantityMultiplier} {item.units * quantityMultiplier === 1 ? 'unidad' : 'unidades'}
                  </span>
                </div>
                <div className="text-base sm:text-lg font-black text-amber-400 mt-2 font-mono">
                  ${priceForMultiplier.toLocaleString()}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Selector de Variedad */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
          2. Variedad de Relleno
        </label>

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
                className={`p-2.5 rounded-xl text-center border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black'
                    : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>{v.name.replace('Tequeño ', '')}</span>
                {stockInCart && (
                  <span className={`text-[10px] mt-0.5 font-mono ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>
                    {remainingUnits} u disp.
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Selector de Playa / Localidad de esta Venta (Requerimiento Costa) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
            <MapPin className="w-4 h-4 text-amber-400" />
            <span>3. Playa / Localidad de esta Venta</span>
          </label>
          <span className="text-[11px] text-amber-400 font-bold font-mono">
            {saleLocation} {saleSectorDetail ? `(${saleSectorDetail})` : ''}
          </span>
        </div>

        {saleLocation !== assignedLocality && (
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-300 flex items-center space-x-2">
            <span className="text-sm">🔄</span>
            <span>
              Marcando venta en <strong>{saleLocation}</strong> (desplazamiento fuera de <em>{assignedLocality}</em> por marea o recorrido). Se audita en métricas.
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {['Santa Teresita', 'Mar del Tuyú', 'Costa del Este', 'Las Toninas', 'San Bernardo'].map((loc) => {
            const isSelected = saleLocation === loc;
            return (
              <button
                key={loc}
                type="button"
                onClick={() => setSaleLocation(loc)}
                className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>🏖️ {loc}</span>
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-1" />}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setShowCustomSectorInput(!showCustomSectorInput)}
            className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
              showCustomSectorInput || (!['Santa Teresita', 'Mar del Tuyú', 'Costa del Este', 'Las Toninas', 'San Bernardo'].includes(saleLocation))
                ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>📍 + Detalle sector</span>
            <Compass className="w-3.5 h-3.5 shrink-0 ml-1" />
          </button>
        </div>

        {showCustomSectorInput && (
          <div className="pt-2 border-t border-slate-800 flex items-center space-x-2">
            <input
              type="text"
              placeholder="Ej: Bajada Calle 38, Muelle, Orilla Carpas 3, Parador..."
              value={saleSectorDetail}
              onChange={(e) => setSaleSectorDetail(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <button
              type="button"
              onClick={() => setShowCustomSectorInput(false)}
              className="px-3 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl font-bold cursor-pointer hover:bg-slate-700"
            >
              Listo
            </button>
          </div>
        )}
      </div>

      {/* 6. Selector de Método de Pago */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
          4. Forma de Pago
        </label>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setPaymentMethod('efectivo')}
            className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1 font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              paymentMethod === 'efectivo'
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-600/20'
                : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <span>Efectivo</span>
          </button>

          <button
            type="button"
            onClick={() => setPaymentMethod('mercado_pago')}
            className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1 font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              paymentMethod === 'mercado_pago'
                ? 'bg-sky-600 text-white border-sky-400 shadow-lg shadow-sky-600/20'
                : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-5 h-5 text-sky-400" />
            <span>Mercado Pago</span>
          </button>

          <button
            type="button"
            onClick={() => setPaymentMethod('transferencia')}
            className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1 font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              paymentMethod === 'transferencia'
                ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/20'
                : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-5 h-5 text-indigo-400" />
            <span>Transferencia</span>
          </button>
        </div>

        {/* Si es Mercado Pago o Transferencia Bancaria: Cargar / Fotografiar Comprobante */}
        {(paymentMethod === 'mercado_pago' || paymentMethod === 'transferencia') && (
          <div className="mt-3 p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-sky-400 flex items-center">
                <Camera className="w-4 h-4 mr-1.5" />
                Foto de Comprobante ({paymentMethod === 'mercado_pago' ? 'Mercado Pago' : 'Transferencia'})
              </span>
              <span className="text-[10px] text-slate-400">Validación OCR con Gemini</span>
            </div>

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
                  className="w-full py-4 border-2 border-dashed border-sky-500/60 hover:border-sky-400 rounded-xl bg-gradient-to-b from-sky-950/40 to-sky-900/20 flex flex-col items-center justify-center text-slate-200 transition-all cursor-pointer shadow-lg shadow-sky-950/40 group active:scale-[0.99]"
                >
                  <div className="p-2.5 rounded-full bg-sky-500 text-slate-950 mb-2 group-hover:scale-110 transition-transform">
                    <Camera className="w-6 h-6" />
                  </div>
                  <span className="text-xs sm:text-sm font-extrabold text-white">
                    Fotografiar Pantalla del Comprobante
                  </span>
                  <span className="text-[11px] text-sky-300/80 mt-0.5">
                    Abre la cámara trasera para capturar la transferencia
                  </span>
                </button>

                <div className="flex items-center justify-between px-1 text-[11px]">
                  <span className="text-slate-500">¿Problemas con la cámara?</span>
                  <button
                    type="button"
                    onClick={() => fallbackGalleryInputRef.current?.click()}
                    className="text-sky-400 hover:text-sky-300 font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Cargar desde galería de fotos</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative rounded-xl overflow-hidden border border-slate-700 max-h-48 flex items-center justify-center bg-black">
                  <img src={voucherImage} alt="Comprobante" className="max-h-48 object-contain" />
                  <button
                    onClick={() => {
                      setVoucherImage(null);
                      setVoucherAnalysis(null);
                    }}
                    className="absolute top-2 right-2 bg-rose-600 text-white p-1 rounded-full text-xs shadow-md"
                  >
                    ✕
                  </button>
                </div>

                {isAnalyzingVoucher && (
                  <div className="flex items-center justify-center space-x-2 text-amber-400 text-xs py-2 bg-slate-900 rounded-lg">
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Gemini OCR analizando importe y autenticidad...</span>
                  </div>
                )}

                {voucherAnalysis && (
                  <div
                    className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                      voucherAnalysis.validationStatus === 'validada'
                        ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300'
                        : voucherAnalysis.validationStatus === 'sospechosa'
                        ? 'bg-rose-950/50 border-rose-600 text-rose-300'
                        : 'bg-amber-950/40 border-amber-600/40 text-amber-300'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center">
                        {voucherAnalysis.validationStatus === 'validada' ? (
                          <ShieldCheck className="w-4 h-4 mr-1 text-emerald-400" />
                        ) : (
                          <ShieldAlert className="w-4 h-4 mr-1 text-rose-400" />
                        )}
                        Estado: {voucherAnalysis.validationStatus.toUpperCase()}
                      </span>
                      <span>Op: {voucherAnalysis.extractedData.operationId}</span>
                    </div>
                    <p className="text-[11px] opacity-90">{voucherAnalysis.extractedData.aiNotes}</p>
                    {voucherAnalysis.matchResults.mismatchReason && (
                      <p className="text-[11px] font-bold text-rose-400">
                        {voucherAnalysis.matchResults.mismatchReason}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6. Botón de Cobro Gigante (Touch Target Primario) */}
      <button
        type="button"
        onClick={handleConfirmSale}
        className="w-full py-4 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-base sm:text-lg rounded-2xl shadow-xl shadow-amber-500/25 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] cursor-pointer"
      >
        <CheckCircle2 className="w-6 h-6" />
        <span>
          COBRAR ${calculatedTotalAmount.toLocaleString()} ({quantityMultiplier > 1 ? `${quantityMultiplier}x ` : ''}
          {currentSaleConfig.label})
        </span>
      </button>

      {/* 7. Barra Inferior de Soporte / Emergencia */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => setShowIncidentModal(true)}
          className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center space-x-1.5 p-2 rounded-lg bg-rose-950/30 border border-rose-800/40"
        >
          <Flame className="w-4 h-4" />
          <span>Reportar Falla o Faltante</span>
        </button>

        <span className="text-[11px] text-slate-500">
          Modo Offline activo con cola automática
        </span>
      </div>

      {/* =========================================================================
          MODAL: CONSULTAR MIS COMPROBANTES (Punto 5 del requerimiento)
          ========================================================================= */}
      {showMyVouchersModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Mis Comprobantes de Transferencia</h3>
                  <span className="text-[11px] text-slate-400">
                    Jornada: {activeShift.cartCode} ({myShiftVouchers.length} registrados)
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowMyVouchersModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {myShiftVouchers.length === 0 ? (
                <div className="text-center py-10 text-slate-400 space-y-2">
                  <FileText className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-sm font-medium">Aún no registraste comprobantes de transferencia en esta jornada.</p>
                  <p className="text-xs text-slate-500">Cada venta con Mercado Pago y comprobante aparecerá aquí.</p>
                </div>
              ) : (
                myShiftVouchers.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between space-x-3"
                  >
                    <div className="flex items-center space-x-3">
                      {sale.voucherPhotoUrl ? (
                        <div
                          onClick={() => setInspectVoucherSale(sale)}
                          className="w-14 h-14 rounded-lg bg-black border border-slate-700 overflow-hidden flex-shrink-0 cursor-pointer relative group"
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
                        <div className="w-14 h-14 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0 text-slate-600">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                      )}

                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white text-xs sm:text-sm">
                            ${sale.totalAmount.toLocaleString()}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                              sale.validationStatus === 'validada'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : sale.validationStatus === 'sospechosa'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {sale.validationStatus}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {sale.varietyName} ({sale.quantityUnitsEquivalent} u)
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {sale.timestamp} {sale.voucherExtractedData?.operationId ? `• Op: ${sale.voucherExtractedData.operationId}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      {sale.voucherPhotoUrl && (
                        <button
                          onClick={() => setInspectVoucherSale(sale)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold rounded-lg flex items-center space-x-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-xs">
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMyVouchersModal(false);
                    onNavigate('vouchers-repository');
                  }}
                  className="text-amber-400 hover:text-amber-300 font-semibold flex items-center space-x-1"
                >
                  <span>Abrir Galería Completa de Comprobantes</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowMyVouchersModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 ml-auto"
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Registrar Merma</h3>
                  <span className="text-[11px] text-slate-400">Producto roto, caído o inutilizado en jornada</span>
                </div>
              </div>
              <button
                onClick={() => setShowWasteModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {wasteSuccessMessage ? (
              <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-center space-y-2 animate-fadeIn">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-sm font-bold text-emerald-200">{wasteSuccessMessage}</p>
                <p className="text-xs text-emerald-400/80">El stock restante en carrito se actualizó en tiempo real.</p>
              </div>
            ) : (
              <form onSubmit={handleConfirmWaste} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Variedad de Tequeño</label>
                  <select
                    value={wasteVarietyId}
                    onChange={(e) => setWasteVarietyId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {varieties.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Cantidad de Unidades</label>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => setWasteUnits((prev) => Math.max(1, prev - 1))}
                      className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-lg"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={wasteUnits}
                      onChange={(e) => setWasteUnits(Math.max(1, Number(e.target.value)))}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-center text-base font-bold text-white font-mono"
                      min="1"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setWasteUnits((prev) => prev + 1)}
                      className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-lg"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Motivo de la Merma</label>
                  <select
                    value={wasteReason}
                    onChange={(e) => setWasteReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="Caído en la arena">🏖️ Caído en la arena</option>
                    <option value="Roto / desarmado al freír">🍳 Roto o desarmado en freidora</option>
                    <option value="Sobrecalentado / quemado">🔥 Sobrecalentado / quemado</option>
                    <option value="Defecto de masa o relleno">🧀 Defecto de masa o relleno abierto</option>
                    <option value="Otro motivo">Otro motivo</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowWasteModal(false)}
                    className="px-4 py-2 bg-slate-800 text-xs text-slate-300 rounded-xl hover:bg-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/20"
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Sobrantes y Cierre de Jornada</h3>
                  <span className="text-[11px] text-slate-400">
                    Jornada: {activeShift.cartCode} • {currentUser.name}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowClosingModal(false);
                  setClosingSuccessSummary(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {closingSuccessSummary ? (
              <div className="space-y-4 py-2 animate-fadeIn">
                <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl text-center space-y-2">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                  <h4 className="text-lg font-black text-white">¡Jornada Cerrada y Conciliada!</h4>
                  <p className="text-xs text-emerald-300">
                    Se registraron los sobrantes devueltos a la base, las mermas y la liquidación de comisión.
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="text-slate-400">Ventas Brutas Totales:</span>
                    <span className="font-bold text-white">${closingSuccessSummary.totalGrossSales.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="text-slate-400">Efectivo Declarado:</span>
                    <span className="font-bold text-emerald-400">${closingSuccessSummary.cashDeclared.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="text-slate-400">Total Tequeños Devueltos (Sobrantes):</span>
                    <span className="font-bold text-sky-400">{closingSuccessSummary.totalUnitsReturned} u</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="font-bold text-slate-200">Comisión Final a Liquidar:</span>
                    <span className="font-black text-emerald-400 text-sm">
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
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl"
                >
                  Aceptar y Finalizar
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmCloseShift} className="space-y-4">
                
                {/* 1. Conteo de Sobrantes por Variedad */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center">
                      <Scale className="w-3.5 h-3.5 text-amber-400 mr-1.5" />
                      1. Conteo de Sobrantes Devueltos a Base
                    </label>
                    <button
                      type="button"
                      onClick={handleSaveLeftoversOnly}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold cursor-pointer underline"
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
                          className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2"
                        >
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-white">{item.varietyName}</span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              Entregados: {delivered} | Vendidos: {item.soldUnits}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-1">
                            <div>
                              <label className="block text-[10px] text-sky-400 font-semibold mb-1">
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
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-center font-bold text-white font-mono"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-amber-400 font-semibold mb-1">
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
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-center font-bold text-white font-mono"
                              />
                            </div>
                          </div>

                          <div className="flex justify-between text-[10px] text-slate-400 pt-0.5 border-t border-slate-800/60">
                            <span>Balance tequeños:</span>
                            <span
                              className={`font-mono font-bold ${
                                diff === 0 ? 'text-emerald-400' : diff > 0 ? 'text-rose-400' : 'text-amber-400'
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
                <div className="space-y-2 pt-1 border-t border-slate-800">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400 mr-1.5" />
                    2. Arqueo de Efectivo en Mano
                  </label>

                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">Efectivo Esperado</span>
                      <div className="text-base font-black text-white font-mono">
                        ${(activeShift.cashExpected || activeShift.totalCashSales).toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">Efectivo Contado en Mano</span>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1.5 text-xs text-slate-500 font-bold">$</span>
                        <input
                          type="number"
                          value={closingCashDeclared}
                          onChange={(e) => setClosingCashDeclared(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 pl-6 text-xs font-bold text-white font-mono"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-[11px] font-mono">
                    {closingCashDeclared - (activeShift.cashExpected || activeShift.totalCashSales) === 0 ? (
                      <span className="text-emerald-400 font-bold">✓ Caja cuadrada sin diferencias</span>
                    ) : closingCashDeclared - (activeShift.cashExpected || activeShift.totalCashSales) < 0 ? (
                      <span className="text-rose-400 font-bold">
                        ⚠️ Diferencia negativa de ${Math.abs(closingCashDeclared - (activeShift.cashExpected || activeShift.totalCashSales)).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-sky-400 font-bold">
                        Sobrante de caja de ${Math.abs(closingCashDeclared - (activeShift.cashExpected || activeShift.totalCashSales)).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* 3. Garrafa y Observaciones */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-800">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Gas Garrafa Final (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={closingGasPercent}
                      onChange={(e) => setClosingGasPercent(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Notas de Cierre</label>
                    <input
                      type="text"
                      placeholder="Observaciones de jornada..."
                      value={closingNotes}
                      onChange={(e) => setClosingNotes(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-white"
                    />
                  </div>
                </div>

                {/* Botón de Cierre Definitivo */}
                <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowClosingModal(false)}
                    className="px-4 py-2 bg-slate-800 text-xs text-slate-300 rounded-xl hover:bg-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/25 flex items-center space-x-1.5 cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                <Camera className="w-4 h-4 text-sky-400" />
                <span>Comprobante: {inspectVoucherSale.voucherExtractedData?.operationId || inspectVoucherSale.id}</span>
              </h3>
              <button
                onClick={() => setInspectVoucherSale(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-black rounded-xl overflow-hidden flex items-center justify-center max-h-72 border border-slate-800">
              <img
                src={inspectVoucherSale.voucherPhotoUrl}
                alt="Comprobante"
                className="max-h-72 w-auto object-contain"
              />
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Importe:</span>
                <span className="font-bold text-white">${inspectVoucherSale.totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Estado de Validación:</span>
                <span className="font-bold uppercase text-emerald-400">{inspectVoucherSale.validationStatus}</span>
              </div>
              {inspectVoucherSale.voucherExtractedData?.senderName && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Emisor:</span>
                  <span className="text-white">{inspectVoucherSale.voucherExtractedData.senderName}</span>
                </div>
              )}
              {inspectVoucherSale.voucherExtractedData?.aiNotes && (
                <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-800">
                  {inspectVoucherSale.voucherExtractedData.aiNotes}
                </p>
              )}
            </div>

            <button
              onClick={() => setInspectVoucherSale(null)}
              className="w-full py-2 bg-slate-800 text-slate-200 text-xs font-bold rounded-xl"
            >
              Cerrar Vista
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Reporte de Estado de Playa & Mareas */}
      {showBeachReportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Waves className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Reporte de Estado de Playa
                  </h3>
                  <span className="text-[11px] text-sky-400">
                    Costa Atlántica • Información en Tiempo Real
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBeachReportModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {beachReportSuccessMsg ? (
              <div className="p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-center space-y-2 text-emerald-300">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400" />
                <p className="font-bold text-sm">{beachReportSuccessMsg}</p>
                <p className="text-xs text-slate-300">Actualizando radar operativo...</p>
              </div>
            ) : (
              <form onSubmit={handleConfirmBeachReport} className="space-y-4">
                {/* 1. Localidad y Sector */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    1. Localidad & Sector Costero
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {['Santa Teresita', 'Mar del Tuyú', 'Costa del Este', 'Las Toninas', 'San Bernardo'].map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => setBeachReportLocality(loc)}
                        className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-left ${
                          beachReportLocality === loc
                            ? 'bg-sky-500 text-slate-950 border-sky-400 font-black'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400"
                  />
                </div>

                {/* 2. Estado de Marea */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
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
                        className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                          beachReportTide === item.id
                            ? 'bg-sky-500/20 border-sky-400 text-sky-200 ring-1 ring-sky-400'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="font-bold text-[11px] text-white">{item.label}</div>
                        <div className="text-[10px] text-slate-400 leading-tight">{item.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Afluencia de Personas */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
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
                        className={`p-2 rounded-xl border text-center text-xs font-bold cursor-pointer transition-all ${
                          beachReportCrowd === item.id
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Tipo de Situación */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
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
                        className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                          beachReportType === item.id
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="font-bold text-[11px] text-white">{item.label}</div>
                        <div className="text-[10px] text-slate-400 leading-tight">{item.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Comentario / Observación */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    5. Observación del Vendedor (Obligatorio)
                  </label>
                  <textarea
                    value={beachReportComments}
                    onChange={(e) => setBeachReportComments(e.target.value)}
                    placeholder="Ej: Marea alta tapó la orilla en Santa Teresita, me replegué 5 cuadras hacia Mar del Tuyú donde hay mucha gente y salen combos docena..."
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400"
                    required
                  />
                </div>

                {/* Clima / Temperatura */}
                <div className="flex items-center space-x-2">
                  <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Clima (ej: 29°C Soleado, viento leve)"
                    value={beachReportWeather}
                    onChange={(e) => setBeachReportWeather(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
                  />
                </div>

                {/* Botones */}
                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowBeachReportModal(false)}
                    className="px-4 py-2 bg-slate-800 text-xs text-slate-300 rounded-xl hover:bg-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 flex items-center space-x-1.5 cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center">
                <Flame className="w-5 h-5 text-rose-400 mr-2" />
                Aviso Urgente a Base de Coordinación
              </h3>
              <button onClick={() => setShowIncidentModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleReportIncident} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de Problema</label>
                <select
                  value={incidentType}
                  onChange={(e) => setIncidentType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                >
                  <option value="quemador_gas">Falla en Quemador / Garrafa de Gas</option>
                  <option value="rueda_arena">Rueda trabada / Arena pesada</option>
                  <option value="falta_insumos">Me quedé sin Servilletas / Salsas</option>
                  <option value="otro">Otro problema operativo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Detalle del Problema</label>
                <textarea
                  value={incidentDescription}
                  onChange={(e) => setIncidentDescription(e.target.value)}
                  placeholder="Ej: Se apagó el piloto y no prende, estoy a la altura de la carpa 40..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowIncidentModal(false)}
                  className="px-4 py-2 bg-slate-800 text-xs text-slate-300 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar Alerta</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Captura Directa con Cámara Trasera */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handleCameraCapture}
      />

    </div>
  );
};
