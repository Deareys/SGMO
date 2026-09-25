/**
 * SGMO — Tequeños Costa
 * Módulo de Planificación Diaria, Asesor Predictivo IA y Despacho Matutino (Check-out)
 */

import React, { useState, useMemo } from 'react';
import {
  ClipboardList,
  Sparkles,
  Bot,
  Flame,
  Sun,
  CloudSun,
  MapPin,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Package,
  Layers,
  ThermometerSun
} from 'lucide-react';
import { AppState, storageService } from '../services/storageService';
import { getStockRecommendationWithAI, StockRecommendationResult } from '../services/aiValidationService';

interface PlanningDispatchViewProps {
  state: AppState;
  onNavigate: (tab: string) => void;
}

export const PlanningDispatchView: React.FC<PlanningDispatchViewProps> = ({ state, onNavigate }) => {
  const { houses, users, carts, zones, selectedHouseId, varieties, shifts, currentUser } = state;

  const currentHouse = (houses || []).find((h) => h.id === selectedHouseId) || houses?.[0] || {
    id: 'HOUSE-DEFAULT',
    name: 'Base Operativa',
    address: 'Calle Central',
    freezerCapacityUnits: 2000,
    currentStock: [],
    residentUserIds: []
  };
  const sellers = (users || []).filter((u) => (u.role === 'seller' || u.role === 'coordinator') && u.isActive);
  const houseCarts = (carts || []).filter((c) => c.houseId === currentHouse?.id);

  // Tab de navegación del módulo
  const [activeTab, setActiveTab] = useState<'dispatch' | 'restock' | 'history'>('dispatch');

  // Estados del Formulario de Despacho
  const [selectedSellerId, setSelectedSellerId] = useState(sellers[0]?.id || '');
  const [selectedCartId, setSelectedCartId] = useState(houseCarts.find((c) => c.status === 'operativo')?.id || '');
  const [selectedZoneId, setSelectedZoneId] = useState(zones[0]?.id || '');
  
  const [clasicoUnits, setClasicoUnits] = useState(200);
  const [ahumadoUnits, setAhumadoUnits] = useState(80);
  const [dulceUnits, setDulceUnits] = useState(30);

  const [gasStartPercent, setGasStartPercent] = useState(90);
  const [napkinsDelivered, setNapkinsDelivered] = useState(5);
  const [conesDelivered, setConesDelivered] = useState(80);
  const [selectedSauces, setSelectedSauces] = useState<string[]>([
    'Mayonesa Ajo Vegana',
    'Salsa Tártara Costera',
    'Chutney Mango'
  ]);
  const [dispatchNotes, setDispatchNotes] = useState('');

  // Estados del Asistente IA de Stock
  const [weatherCondition, setWeatherCondition] = useState('28°C y Sol Radiante (Viento Calmo)');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<StockRecommendationResult | null>(null);

  // Estados para Restock durante la jornada
  const activeShifts = (shifts || []).filter((s) => s.status === 'en_curso');
  const [selectedRestockShiftId, setSelectedRestockShiftId] = useState<string>(activeShifts[0]?.id || '');
  const [restockOriginHouseId, setRestockOriginHouseId] = useState<string>(currentHouse.id);
  const [restockQuantities, setRestockQuantities] = useState<Record<string, number>>({});
  const [restockDestinationLocation, setRestockDestinationLocation] = useState<string>('');
  const [restockNotes, setRestockNotes] = useState<string>('');
  const [restockSuccessMessage, setRestockSuccessMessage] = useState<string | null>(null);

  // Shift seleccionado para restock
  const targetShift = activeShifts.find((s) => s.id === selectedRestockShiftId) || activeShifts[0];
  const originHouse = (houses || []).find((h) => h.id === restockOriginHouseId) || currentHouse;

  // Total calculado de unidades para el restock actual
  const currentRestockTotalUnits = useMemo(() => {
    return Object.values(restockQuantities).reduce<number>((acc, q) => acc + (Number(q) || 0), 0);
  }, [restockQuantities]);

  // Actualizar destino sugerido al cambiar el carrito seleccionado
  React.useEffect(() => {
    if (targetShift) {
      setRestockDestinationLocation(`${targetShift.cartCode} — ${targetShift.zoneName} (${targetShift.sellerName})`);
      setRestockOriginHouseId(targetShift.houseId || currentHouse.id);
    }
  }, [selectedRestockShiftId, targetShift?.id]);

  // Ejecutar Recomendación IA
  const handleConsultAiAdvisor = async () => {
    setIsAiLoading(true);
    const seller = users.find((u) => u.id === selectedSellerId);
    const zone = zones.find((z) => z.id === selectedZoneId);

    const result = await getStockRecommendationWithAI({
      zoneName: zone ? zone.name : 'Zona de Playa',
      sellerName: seller ? seller.name : 'Vendedor',
      dayOfWeek: new Date().toLocaleDateString('es-AR', { weekday: 'long' }),
      weatherCondition,
      availableHouseStock: currentHouse.currentStock,
      historicalAvgUnits: zone ? zone.avgDailySalesUnits : 280
    });

    setAiRecommendation(result);
    setIsAiLoading(false);
  };

  // Aplicar cantidades recomendadas por IA al formulario
  const handleApplyAiStock = () => {
    if (!aiRecommendation) return;
    const cItem = aiRecommendation.breakdown.find((b) => b.varietyId === 'VAR-CLASICO');
    const aItem = aiRecommendation.breakdown.find((b) => b.varietyId === 'VAR-AHUMADO');
    const dItem = aiRecommendation.breakdown.find((b) => b.varietyId === 'VAR-DULCE');

    if (cItem) setClasicoUnits(cItem.quantity);
    if (aItem) setAhumadoUnits(aItem.quantity);
    if (dItem) setDulceUnits(dItem.quantity);
  };

  // Confirmar Despacho Matutino
  const handleConfirmDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSellerId || !selectedCartId || !selectedZoneId) return;

    const stockToDeliver = [
      { varietyId: 'VAR-CLASICO', quantity: clasicoUnits },
      { varietyId: 'VAR-AHUMADO', quantity: ahumadoUnits },
      { varietyId: 'VAR-DULCE', quantity: dulceUnits }
    ].filter((s) => s.quantity > 0);

    storageService.dispatchSellerShift({
      sellerId: selectedSellerId,
      cartId: selectedCartId,
      zoneId: selectedZoneId,
      houseId: currentHouse.id,
      stockToDeliver,
      gasPercentStart: gasStartPercent,
      napkinsDelivered,
      conesDelivered,
      saucesProvided: selectedSauces,
      notes: dispatchNotes
    });

    alert(`¡Despacho registrado con éxito para ${users.find((u) => u.id === selectedSellerId)?.name}! Carrito listo para salir a la playa.`);
    onNavigate('dashboard');
  };

  // Confirmar Restock en Playa
  const handleConfirmRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetShift) {
      alert('Seleccione un carrito con jornada activa');
      return;
    }

    const itemsToRestock: { varietyId: string; quantity: number }[] = Object.entries(restockQuantities)
      .map(([varietyId, qty]) => ({ varietyId, quantity: Number(qty) || 0 }))
      .filter((item) => item.quantity > 0);

    if (itemsToRestock.length === 0) {
      alert('Debe indicar al menos una unidad para reabastecer');
      return;
    }

    try {
      storageService.addShiftRestock({
        shiftId: targetShift.id,
        items: itemsToRestock,
        originLocation: originHouse?.name || 'Base Operativa',
        destinationLocation: restockDestinationLocation || `${targetShift.cartCode} — ${targetShift.zoneName}`,
        notes: restockNotes
      });

      const totalAdded = itemsToRestock.reduce((acc, i) => acc + i.quantity, 0);
      setRestockSuccessMessage(
        `¡Restock confirmado con éxito! Se agregaron +${totalAdded} unidades a la jornada de ${targetShift.sellerName} (${targetShift.cartCode}).`
      );
      setRestockQuantities({});
      setRestockNotes('');

      setTimeout(() => {
        setRestockSuccessMessage(null);
      }, 5000);
    } catch (err: any) {
      alert(`Error al registrar restock: ${err.message || err}`);
    }
  };

  // Historial global consolidado de restocks realizados en todas las jornadas
  const allRestocks = (shifts || []).flatMap((shift) => {
    return (shift.restocks || []).map((r) => ({
      ...r,
      shiftDate: shift.date,
      shiftStatus: shift.status,
      cartCode: shift.cartCode
    }));
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="space-y-6 pb-12">
      
      {/* Encabezado */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-amber-400 text-xs font-semibold uppercase tracking-wider">
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Gestión de Stock en Jornada — {currentHouse.name}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white mt-1">
              Despacho Diario & Reabastecimiento en Playa (Restock)
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Control integral de entregas matutinas y refuerzos de stock adicionales a carritos en playa sin perder la trazabilidad.
            </p>
          </div>

          <div className="flex items-center bg-slate-950/70 border border-slate-800 px-3 py-2 rounded-xl text-xs text-slate-300">
            <ThermometerSun className="w-4 h-4 text-amber-400 mr-2" />
            <span>Condición: <strong>{weatherCondition}</strong></span>
          </div>
        </div>

        {/* Pestañas de Navegación del Módulo */}
        <div className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => setActiveTab('dispatch')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'dispatch'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <span>🌅 Despacho Matutino (Salida)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('restock')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'restock'
                ? 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/20'
                : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>📦 Reabastecer en Playa (Restock)</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'restock' ? 'bg-slate-950 text-sky-400' : 'bg-sky-500/20 text-sky-300'
            }`}>
              {activeShifts.length} activos
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'history'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>📜 Historial de Entregas & Restocks</span>
            {allRestocks.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'history' ? 'bg-slate-950 text-emerald-400' : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                {allRestocks.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Grid: Asistente IA + Formulario de Despacho */}
      {activeTab === 'dispatch' && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Columna Izquierda: Asesor Predictivo con IA (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-xl bg-gradient-to-b from-amber-500/5 to-transparent">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Asesor de Stock con IA</h2>
                  <span className="text-[11px] text-amber-400">Modelo Gemini 3.7 Flash</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-4">
              Calcula la entrega recomendada cruzando: pronóstico de clima, historial de venta del vendedor, afluencia de la zona y stock disponible en la base.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Clima / Pronóstico de Playa</label>
                <select
                  value={weatherCondition}
                  onChange={(e) => setWeatherCondition(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="28°C y Sol Radiante (Viento Calmo)">☀️ 28°C y Sol Radiante (Afluencia Máxima)</option>
                  <option value="31°C Muy Caluroso con Oleaje Suave">🔥 31°C Calor Intenso (Alta sed y combos x6/x12)</option>
                  <option value="23°C Nublado Parcial con Brisa">⛅ 23°C Templado / Viento Moderado</option>
                  <option value="19°C Viento Fuerte y Arena Volando">💨 19°C Viento Fuerte (Baja permanencia en playa)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleConsultAiAdvisor}
                disabled={isAiLoading}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>{isAiLoading ? 'Analizando Variables...' : 'Calcular Sugerencia con IA'}</span>
              </button>
            </div>

            {/* Resultado de la IA */}
            {aiRecommendation && (
              <div className="mt-5 p-4 bg-slate-950 border border-amber-500/40 rounded-xl space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-amber-300 flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Sugerencia Operativa
                  </span>
                  <span className="text-base font-black text-white">
                    {aiRecommendation.recommendedTotalUnits} unidades
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  {aiRecommendation.breakdown.map((item) => (
                    <div key={item.varietyId} className="flex justify-between items-center text-slate-300">
                      <span>{item.varietyName}</span>
                      <span className="font-bold text-amber-400">{item.quantity} u</span>
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-slate-400 italic bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  "{aiRecommendation.reasoning}"
                </p>

                <button
                  type="button"
                  onClick={handleApplyAiStock}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center space-x-1"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Aplicar estas cantidades al Despacho</span>
                </button>
              </div>
            )}
          </div>

          {/* Stock Actual en Congeladores de la Casa */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center">
              <Layers className="w-4 h-4 text-sky-400 mr-1.5" />
              Stock Disponible en {currentHouse?.name || 'Base'}
            </h3>
            <div className="space-y-2 text-xs">
              {(currentHouse?.currentStock || []).map((stock) => (
                <div key={stock.varietyId} className="flex justify-between items-center p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80">
                  <span className="font-medium text-slate-200">{stock.varietyName}</span>
                  <span className="font-mono font-bold text-white">{(stock.quantity || 0).toLocaleString()} u</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Columna Derecha: Formulario de Despacho y Check-out (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center space-x-2">
              <UserCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">
                Ficha de Salida a la Playa (Check-out)
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Hora actual: {new Date().toTimeString().slice(0, 5)}
            </span>
          </div>

          <form onSubmit={handleConfirmDispatch} className="space-y-5">
            
            {/* Vendedor, Carrito y Zona */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Vendedor</label>
                <select
                  value={selectedSellerId}
                  onChange={(e) => setSelectedSellerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-semibold"
                >
                  {sellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.role === 'coordinator' ? '★ (Coordinador)' : ''} ({Math.round(s.commissionRate * 100)}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Carrito Asignado</label>
                <select
                  value={selectedCartId}
                  onChange={(e) => setSelectedCartId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  {houseCarts.map((c) => (
                    <option key={c.id} value={c.id} disabled={c.status !== 'operativo'}>
                      {c.code} {c.status !== 'operativo' ? `(${c.status})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Zona de Playa</label>
                <select
                  value={selectedZoneId}
                  onChange={(e) => setSelectedZoneId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-semibold"
                >
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cantidad de Tequeños a Entregar */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center">
                  <Package className="w-4 h-4 mr-1.5" />
                  Tequeños a Entregar (Carga Inicial)
                </span>
                <span className="text-xs font-bold text-white bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                  Total: {clasicoUnits + ahumadoUnits + dulceUnits} u
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Clásico Vegano (u)</label>
                  <input
                    type="number"
                    value={clasicoUnits}
                    onChange={(e) => setClasicoUnits(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                    step="10"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Ahumado Hierbas (u)</label>
                  <input
                    type="number"
                    value={ahumadoUnits}
                    onChange={(e) => setAhumadoUnits(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                    step="10"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Dulce Guayaba (u)</label>
                  <input
                    type="number"
                    value={dulceUnits}
                    onChange={(e) => setDulceUnits(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                    step="5"
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* Insumos del Carrito (Gas, Servilletas, Conos, Salsas) */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center">
                <Flame className="w-4 h-4 mr-1.5" />
                Insumos y Estado Operativo del Carrito
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Carga de Gas (% garrafa)</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={gasStartPercent}
                      onChange={(e) => setGasStartPercent(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs font-bold text-white"
                      min="10"
                      max="100"
                    />
                    <span className="text-xs font-semibold text-slate-400">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Paquetes Servilletas</label>
                  <input
                    type="number"
                    value={napkinsDelivered}
                    onChange={(e) => setNapkinsDelivered(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-white"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Conos Térmicos (u)</label>
                  <input
                    type="number"
                    value={conesDelivered}
                    onChange={(e) => setConesDelivered(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-white"
                    min="10"
                  />
                </div>
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Instrucciones Especiales / Notas</label>
              <input
                type="text"
                value={dispatchNotes}
                onChange={(e) => setDispatchNotes(e.target.value)}
                placeholder="Ej: Priorizar balnearios del parador 3 entre 15:00 y 17:00"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none"
              />
            </div>

            {/* Botón de Confirmación */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-sm rounded-xl shadow-xl shadow-amber-500/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Confirmar Salida & Despachar Carrito a la Playa</span>
              </button>
            </div>

          </form>
        </div>

      </div>
      )}

      {/* =========================================================================
          PESTAÑA 2: REABASTECIMIENTO EN PLAYA (RESTOCK)
          Requisitos 1, 2, 3, 4, 6, 7 del usuario
          ========================================================================= */}
      {activeTab === 'restock' && (
        <div className="space-y-6">
          
          {restockSuccessMessage && (
            <div className="p-4 bg-sky-950/80 border border-sky-500/50 rounded-2xl flex items-center space-x-3 text-sky-200 animate-fadeIn shadow-xl">
              <CheckCircle2 className="w-6 h-6 text-sky-400 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-white">¡Reabastecimiento Registrado!</h4>
                <p className="text-xs text-sky-300">{restockSuccessMessage}</p>
              </div>
            </div>
          )}

          {/* Estado de Carritos en Playa actualmente */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Package className="w-5 h-5 text-sky-400" />
                  <span>Carritos con Jornada Activa en Playa ({activeShifts.length})</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Seleccioná el carrito que necesita reposición de stock durante la jornada.
                </p>
              </div>
            </div>

            {activeShifts.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
                <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto opacity-70" />
                <h4 className="text-sm font-bold text-white">No hay carritos activos en este momento</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Para realizar un restock debe existir al menos una jornada en curso. Realizá un despacho matutino primero.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('dispatch')}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl"
                >
                  Ir al Despacho Matutino
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeShifts.map((shift) => {
                  const isSelected = shift.id === selectedRestockShiftId;
                  const initialUnits = shift.stockItems.reduce((acc, i) => acc + i.deliveredUnits, 0);
                  const restockedUnits = shift.totalUnitsRestocked || 0;
                  const soldUnits = shift.totalUnitsSold;
                  const wasteUnits = shift.stockItems.reduce((acc, i) => acc + (i.wasteUnits || 0), 0);
                  const remainingInCart = Math.max(0, shift.totalUnitsDelivered - soldUnits - wasteUnits);

                  return (
                    <div
                      key={shift.id}
                      onClick={() => setSelectedRestockShiftId(shift.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                        isSelected
                          ? 'bg-slate-900 border-sky-500 shadow-xl shadow-sky-500/10 ring-2 ring-sky-500/30'
                          : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-black text-white block">{shift.sellerName}</span>
                          <span className="text-[11px] text-amber-400 font-semibold">{shift.cartCode}</span>
                          <span className="text-[10px] text-slate-400 block">{shift.zoneName}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                          En Playa
                        </span>
                      </div>

                      {/* Métricas rápidas del carrito */}
                      <div className="grid grid-cols-4 gap-1.5 p-2 bg-slate-950 rounded-xl border border-slate-800/80 text-center">
                        <div>
                          <span className="text-[9px] text-slate-400 block">Inicial</span>
                          <span className="text-xs font-bold text-slate-200 font-mono">{initialUnits}u</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-sky-400 block">Restock</span>
                          <span className="text-xs font-bold text-sky-300 font-mono">+{restockedUnits}u</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-amber-400 block">Vendido</span>
                          <span className="text-xs font-bold text-amber-300 font-mono">{soldUnits}u</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-emerald-400 block">En Carro</span>
                          <span className="text-xs font-black text-emerald-400 font-mono">{remainingInCart}u</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-400">
                          {shift.restocks && shift.restocks.length > 0
                            ? `${shift.restocks.length} entrega(s) extra hoy`
                            : 'Sin restocks aún'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRestockShiftId(shift.id);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-sky-500 text-slate-950'
                              : 'bg-slate-800 hover:bg-slate-700 text-sky-300'
                          }`}
                        >
                          {isSelected ? '✓ Seleccionado' : 'Reabastecer'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Formulario de Reabastecimiento / Restock (Exclusivo Coordinador) */}
          {targetShift && (
            <div className="bg-slate-900 border border-sky-500/30 rounded-2xl p-6 shadow-2xl space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
                <div>
                  <div className="flex items-center space-x-2 text-sky-400 text-xs font-bold uppercase tracking-wider">
                    <Package className="w-4 h-4" />
                    <span>Formulario Oficial de Entrega Adicional (Restock)</span>
                  </div>
                  <h2 className="text-xl font-extrabold text-white mt-0.5">
                    Reabastecer a {targetShift.sellerName} — {targetShift.cartCode}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Se sumará al stock entregado de la jornada activa #{targetShift.id} sin generar una jornada duplicada.
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-xs space-y-0.5">
                  <div className="text-slate-400 text-[10px]">Coordinador responsable:</div>
                  <div className="text-white font-bold">{currentUser?.name || targetShift.coordinatorName}</div>
                  <div className="text-[10px] text-sky-400">
                    Fecha y Hora: {new Date().toLocaleDateString('es-AR')} {new Date().toTimeString().substring(0, 5)} hs
                  </div>
                </div>
              </div>

              <form onSubmit={handleConfirmRestock} className="space-y-6">
                
                {/* 1. Datos de Trazabilidad: Origen y Destino */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Ubicación de Origen (Base / Congelador de salida)
                    </label>
                    <select
                      value={restockOriginHouseId}
                      onChange={(e) => setRestockOriginHouseId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-sky-400"
                      required
                    >
                      {houses.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} — {h.address}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      El stock entregado se descontará de este congelador.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Ubicación de Destino (Punto de entrega en playa)
                    </label>
                    <input
                      type="text"
                      value={restockDestinationLocation}
                      onChange={(e) => setRestockDestinationLocation(e.target.value)}
                      placeholder="Ej: Carrito C-01 — Bajada Playa Calle 38 (Parador)"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-sky-400"
                      required
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Destino físico registrado para la auditoría.
                    </span>
                  </div>
                </div>

                {/* 2. Selector de Productos y Cantidades con Botones Rápidos */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-sky-400">
                      Productos y Cantidad a Entregar
                    </label>
                    <span className="text-xs font-bold text-slate-400">
                      Total Restock a Sumar:{' '}
                      <strong className="text-white font-mono text-sm">
                        {currentRestockTotalUnits} u
                      </strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {varieties.map((v) => {
                      const currentQty = restockQuantities[v.id] || 0;
                      const houseStockItem = originHouse?.currentStock.find((s) => s.varietyId === v.id);
                      const availableInHouse = houseStockItem?.quantity || 0;
                      const shiftStockItem = targetShift.stockItems.find((s) => s.varietyId === v.id);

                      return (
                        <div key={v.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-xs font-bold text-white block">{v.name}</span>
                              <span className="text-[10px] text-slate-400">
                                En base: <strong className="text-sky-400">{availableInHouse} u</strong>
                              </span>
                            </div>
                            <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded-lg">
                              Entregado hoy: {(shiftStockItem?.deliveredUnits || 0) + (shiftStockItem?.reSuppliedUnits || 0)}u
                            </span>
                          </div>

                          {/* Stepper + Input de Cantidad */}
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                setRestockQuantities((prev) => ({
                                  ...prev,
                                  [v.id]: Math.max(0, (prev[v.id] || 0) - 5)
                                }));
                              }}
                              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center"
                            >
                              -5
                            </button>

                            <input
                              type="number"
                              value={currentQty}
                              onChange={(e) => {
                                const val = Math.max(0, Number(e.target.value));
                                setRestockQuantities((prev) => ({
                                  ...prev,
                                  [v.id]: val
                                }));
                              }}
                              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-center text-sm font-bold text-white font-mono"
                              min="0"
                            />

                            <button
                              type="button"
                              onClick={() => {
                                setRestockQuantities((prev) => ({
                                  ...prev,
                                  [v.id]: (prev[v.id] || 0) + 10
                                }));
                              }}
                              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center"
                            >
                              +10
                            </button>
                          </div>

                          {/* Botones de incremento rápido */}
                          <div className="flex items-center justify-between gap-1 pt-1">
                            {[10, 20, 30, 50].map((inc) => (
                              <button
                                key={inc}
                                type="button"
                                onClick={() => {
                                  setRestockQuantities((prev) => ({
                                    ...prev,
                                    [v.id]: (prev[v.id] || 0) + inc
                                  }));
                                }}
                                className="flex-1 py-1 bg-slate-900 hover:bg-sky-950 hover:border-sky-500/50 border border-slate-800 rounded text-[10px] font-bold text-slate-300 hover:text-sky-300 transition-all"
                              >
                                +{inc}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Notas y Justificación */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Notas u Observaciones del Restock (Opcional)
                  </label>
                  <input
                    type="text"
                    value={restockNotes}
                    onChange={(e) => setRestockNotes(e.target.value)}
                    placeholder="Ej: Reposición solicitada por alta afluencia en balneario turno tarde"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400"
                  />
                </div>

                {/* Resumen Matemático Previo a la Confirmación */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">Balance de Entrega para la Jornada:</span>
                    <span className="text-slate-200">
                      Entrega Inicial: <strong>{targetShift.stockItems.reduce((acc, i) => acc + i.deliveredUnits, 0)} u</strong> + 
                      Restocks Previos: <strong>{targetShift.totalUnitsRestocked || 0} u</strong> + 
                      Este Restock: <strong className="text-sky-400">+{currentRestockTotalUnits} u</strong> = 
                      Nuevo Total Entregado:{' '}
                      <strong className="text-white font-mono">
                        {targetShift.totalUnitsDelivered + currentRestockTotalUnits} u
                      </strong>
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={currentRestockTotalUnits === 0}
                    className="px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-400 hover:to-blue-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-sky-500/20 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar Entrega de Restock</span>
                  </button>
                </div>

              </form>

              {/* Historial de Restocks Específicos de este Carrito */}
              {targetShift.restocks && targetShift.restocks.length > 0 && (
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Entregas Adicionales Realizadas a este Carrito Hoy ({targetShift.restocks.length})
                  </h4>
                  <div className="space-y-2">
                    {targetShift.restocks.map((r) => (
                      <div key={r.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-white">{r.quantity} u de {r.varietyName}</span>
                            <span className="text-[10px] text-sky-400 bg-sky-500/15 px-1.5 py-0.2 rounded font-mono">
                              {r.timestamp}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Entregado por: <strong>{r.coordinatorName}</strong> | De <em>{r.originLocation}</em> hacia <em>{r.destinationLocation}</em>
                          </div>
                          {r.notes && <div className="text-[10px] text-slate-500 italic">"{r.notes}"</div>}
                        </div>
                        <span className="text-emerald-400 text-[10px] font-semibold bg-emerald-500/10 px-2 py-1 rounded-lg self-start sm:self-center">
                          ✓ Sumado a Jornada
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* =========================================================================
          PESTAÑA 3: HISTORIAL GLOBAL DE ENTREGAS Y RESTOCKS
          Requisito 7 del usuario
          ========================================================================= */}
      {activeTab === 'history' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                <span>Historial de Movimientos y Entregas Adicionales</span>
              </h2>
              <p className="text-xs text-slate-400">
                Auditoría completa de restocks efectuados en playa: coordinador, vendedor, fecha/hora, cantidades, origen y destino.
              </p>
            </div>
            <span className="text-xs font-mono font-bold bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-emerald-400">
              {allRestocks.length} entregas adicionales registradas
            </span>
          </div>

          {allRestocks.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No se han registrado entregas adicionales de stock durante las jornadas recientes.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Fecha y Hora</th>
                    <th className="p-3">Vendedor & Carrito</th>
                    <th className="p-3">Coordinador</th>
                    <th className="p-3">Producto & Cantidad</th>
                    <th className="p-3">Origen ➔ Destino</th>
                    <th className="p-3">Notas</th>
                    <th className="p-3 text-right">Estado Jornada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {allRestocks.map((restock) => (
                    <tr key={restock.id} className="hover:bg-slate-950/50 transition-colors">
                      <td className="p-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {restock.timestamp}
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-white block">{restock.sellerName}</span>
                        <span className="text-[10px] text-amber-400 font-semibold">{restock.cartCode}</span>
                      </td>
                      <td className="p-3 text-slate-300 font-medium">
                        {restock.coordinatorName}
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-sky-400 font-mono text-sm">+{restock.quantity} u</span>
                        <span className="text-slate-300 block text-[11px]">{restock.varietyName}</span>
                      </td>
                      <td className="p-3 text-[11px]">
                        <span className="text-slate-400 block">De: {restock.originLocation}</span>
                        <span className="text-slate-200 block">A: {restock.destinationLocation}</span>
                      </td>
                      <td className="p-3 text-slate-400 italic text-[11px] max-w-[200px] truncate">
                        {restock.notes || '—'}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          restock.shiftStatus === 'en_curso'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {restock.shiftStatus === 'en_curso' ? 'En Curso' : 'Conciliada'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
