/**
 * SGMO — Tequeños Costa
 * Panel de Control Ejecutivo y Radar Operativo en Tiempo Real
 */

import React, { useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Package,
  ShoppingCart,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Clock,
  MapPin,
  Users,
  Building2,
  ArrowUpRight,
  ShieldAlert,
  Sparkles,
  Waves,
  Compass,
  Sun,
  Calendar,
  CreditCard
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid
} from 'recharts';
import { AppState } from '../services/storageService';

interface DashboardViewProps {
  state: AppState;
  onNavigate: (tab: string) => void;
}

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6'];

export const DashboardView: React.FC<DashboardViewProps> = ({ state, onNavigate }) => {
  const { shifts, sales, houses, productionBatches, carts, alerts } = state;

  // Cálculos consolidados del día de hoy
  const today = new Date().toISOString().slice(0, 10);
  const todayShifts = (shifts || []).filter((s) => s.date === today || s.status === 'en_curso');
  const todaySales = (sales || []).filter((s) => s.timestamp.startsWith(today));

  const totalGrossSales = todayShifts.reduce((sum, s) => sum + (s?.totalGrossSales || 0), 0);
  const totalCashSales = todayShifts.reduce((sum, s) => sum + (s?.totalCashSales || 0), 0);
  const totalMpSales = todayShifts.reduce((sum, s) => sum + (s?.totalMpSales || 0), 0);

  const totalUnitsDelivered = todayShifts.reduce((sum, s) => sum + (s?.totalUnitsDelivered || 0), 0);
  const totalUnitsSold = todayShifts.reduce((sum, s) => sum + (s?.totalUnitsSold || 0), 0);
  const totalUnitsInCarts = Math.max(0, totalUnitsDelivered - totalUnitsSold);

  const activeCartsCount = (carts || []).filter((c) => c.status === 'operativo' && c.currentSellerId).length;
  const cartsInMaintenance = (carts || []).filter((c) => c.status === 'en_reparacion' || c.status === 'en_revision').length;

  const pendingVouchers = (sales || []).filter((s) => s.paymentMethod === 'mercado_pago' && s.validationStatus === 'pendiente_revision').length;
  const suspiciousVouchers = (sales || []).filter((s) => s.paymentMethod === 'mercado_pago' && s.validationStatus === 'sospechosa').length;

  // Stock total en frío
  const totalCentralStock = (productionBatches || []).reduce((sum, b) => sum + (b?.remainingUnitsInCentral || 0), 0);
  const totalHousesStock = (houses || []).reduce(
    (sum, h) => sum + (h?.currentStock || []).reduce((sSum, item) => sSum + (item?.quantity || 0), 0),
    0
  );

  // Estimación de costo unitario promedio ponderado
  const avgUnitCost = (productionBatches || []).length > 0
    ? (productionBatches || []).reduce((sum, b) => sum + (b?.unitCostCalculated || 0), 0) / productionBatches.length
    : 220;
  const totalEstCostOfGoods = totalUnitsSold * avgUnitCost;
  const totalCommissions = todayShifts.reduce((sum, s) => sum + (s?.grossCommission || 0), 0);
  const estGrossMargin = totalGrossSales > 0 ? ((totalGrossSales - totalEstCostOfGoods - totalCommissions) / totalGrossSales) * 100 : 54;

  const totalTransferSales = (sales || [])
    .filter((s) => s.paymentMethod === 'transferencia' && s.timestamp.startsWith(today))
    .reduce((sum, s) => sum + s.totalAmount, 0) +
    todayShifts.reduce((sum, s) => sum + (s?.totalTransferSales || 0), 0);

  // Recaudación y Unidades por Localidad / Playa Costera
  const localityStats = useMemo(() => {
    const map: Record<string, { totalAmount: number; units: number; count: number }> = {};
    (sales || []).forEach((s) => {
      const loc = s.locationName || 'Santa Teresita';
      let norm = loc;
      if (loc.includes('Santa Teresita')) norm = 'Santa Teresita';
      else if (loc.includes('Mar del Tuyú')) norm = 'Mar del Tuyú';
      else if (loc.includes('Costa del Este')) norm = 'Costa del Este';
      else if (loc.includes('Las Toninas')) norm = 'Las Toninas';
      else if (loc.includes('San Bernardo')) norm = 'San Bernardo';

      if (!map[norm]) {
        map[norm] = { totalAmount: 0, units: 0, count: 0 };
      }
      map[norm].totalAmount += s.totalAmount;
      map[norm].units += s.quantityUnitsEquivalent;
      map[norm].count += 1;
    });

    return Object.entries(map).map(([locality, data]) => ({
      locality,
      ...data
    })).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [sales]);

  // Datos para gráfico por Vendedor
  const sellerChartData = todayShifts.map((s) => ({
    name: s.sellerName.split(' ')[0],
    ventas: s.totalGrossSales,
    unidades: s.totalUnitsSold,
    comision: s.grossCommission
  }));

  // Datos para gráfico de Métodos de Pago
  const paymentData = [
    { name: 'Efectivo', value: totalCashSales || 0, fill: '#10b981' },
    { name: 'Mercado Pago', value: totalMpSales || 0, fill: '#0ea5e9' },
    { name: 'Transferencia', value: totalTransferSales || 0, fill: '#6366f1' }
  ].filter((p) => p.value > 0);
  if (paymentData.length === 0) {
    paymentData.push({ name: 'Sin Ventas', value: 1, fill: '#64748b' });
  }

  return (
    <div className="space-y-6 pb-12">
      
      {/* Encabezado con indicador de jornada */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span>Radar Operativo en Vivo — Costa Atlántica</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            Centro de Mando & Control de Ventas
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Monitoreo en tiempo real de carritos en playa, stock frigorífico, cobranzas y validación de transferencias.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onNavigate('planning')}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center space-x-1.5"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Despachar Vendedor</span>
          </button>
          <button
            onClick={() => onNavigate('reconciliation')}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm rounded-xl border border-slate-700 transition-all flex items-center space-x-1.5"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Cierre & Conciliación</span>
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas Clave (KPIs) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        
        {/* Total Recaudado */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Ventas del Día</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white">
            ${totalGrossSales.toLocaleString()}
          </div>
          <div className="flex items-center text-[11px] text-slate-400 mt-2 space-x-2">
            <span className="text-emerald-400 font-semibold">💵 ${(totalCashSales).toLocaleString()} efvo</span>
            <span>•</span>
            <span className="text-sky-400 font-semibold">📱 ${(totalMpSales).toLocaleString()} MP</span>
          </div>
        </div>

        {/* Tequeños en Operación */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Tequeños Vendidos</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white">
            {totalUnitsSold.toLocaleString()} <span className="text-xs font-normal text-slate-400">/ {totalUnitsDelivered} despachados</span>
          </div>
          <div className="flex items-center text-[11px] text-amber-400 mt-2">
            <Clock className="w-3.5 h-3.5 mr-1" />
            <span>{totalUnitsInCarts} unidades activas en playa</span>
          </div>
        </div>

        {/* Margen Operativo Estimado */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Margen Neto Estimado</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white">
            {(estGrossMargin ?? 0).toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
            <span>Comisiones: ${totalCommissions.toLocaleString()}</span>
            <span className="text-emerald-400">Rentable</span>
          </div>
        </div>

        {/* Alertas & Comprobantes MP */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Comprobantes MP</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${suspiciousVouchers > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-sky-500/10 text-sky-400'}`}>
              {suspiciousVouchers > 0 ? <ShieldAlert className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white flex items-center space-x-2">
            <span>{pendingVouchers + suspiciousVouchers}</span>
            <span className="text-xs font-normal text-slate-400">por revisar</span>
          </div>
          <div className="text-[11px] mt-2 flex items-center space-x-1.5">
            {suspiciousVouchers > 0 ? (
              <span className="text-rose-400 font-bold flex items-center">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {suspiciousVouchers} sospechoso(s)
              </span>
            ) : (
              <span className="text-emerald-400">Sin duplicados detectados</span>
            )}
          </div>
        </div>

      </div>

      {/* Radar de Stock Multinivel (Producción -> Cámara -> Bases -> Carritos) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-amber-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              Trazabilidad y Stock en Cadena Fría
            </h2>
          </div>
          <button
            onClick={() => onNavigate('production')}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center"
          >
            <span>Ver Producción & Traslados</span>
            <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5">
            <div className="text-xs text-slate-400 font-medium">1. Cámara Central (Fábrica)</div>
            <div className="text-xl font-bold text-white mt-1">{totalCentralStock.toLocaleString()} <span className="text-xs font-normal text-slate-400">u</span></div>
            <p className="text-[11px] text-slate-500 mt-1">Listo para despacho a la costa</p>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5">
            <div className="text-xs text-slate-400 font-medium">2. {houses[0]?.name || 'Base Norte (Calle 65)'}</div>
            <div className="text-xl font-bold text-white mt-1">
              {(houses[0]?.currentStock || []).reduce((s, i) => s + (i?.quantity || 0), 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">u</span>
            </div>
            <p className="text-[11px] text-emerald-400 mt-1">
              Freezer al {Math.round((((houses[0]?.currentStock || []).reduce((s, i) => s + (i?.quantity || 0), 0)) / (houses[0]?.freezerCapacityUnits || 1)) * 100)}% de capacidad
            </p>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5">
            <div className="text-xs text-slate-400 font-medium">3. {houses[1]?.name || 'Base Sur (Calle 15)'}</div>
            <div className="text-xl font-bold text-white mt-1">
              {(houses[1]?.currentStock || []).reduce((s, i) => s + (i?.quantity || 0), 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">u</span>
            </div>
            <p className="text-[11px] text-emerald-400 mt-1">
              Freezer al {Math.round((((houses[1]?.currentStock || []).reduce((s, i) => s + (i?.quantity || 0), 0)) / (houses[1]?.freezerCapacityUnits || 1)) * 100)}% de capacidad
            </p>
          </div>

          <div className="bg-slate-950/70 border border-amber-500/30 rounded-xl p-3.5 bg-amber-500/5">
            <div className="text-xs text-amber-400 font-semibold flex items-center justify-between">
              <span>4. Carritos en Playa</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <div className="text-xl font-bold text-amber-300 mt-1">{totalUnitsInCarts.toLocaleString()} <span className="text-xs font-normal text-slate-400">u</span></div>
            <p className="text-[11px] text-slate-400 mt-1">{activeCartsCount} carritos vendiendo</p>
          </div>

        </div>
      </div>

      {/* Estado de Zonas de Playa & Carritos Activos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Mapa / Lista de Zonas Costeras */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-amber-400" />
              <h2 className="text-base sm:text-lg font-bold text-white">
                Distribución por Sectores de Playa
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              {state.zones.length} Zonas Operativas
            </span>
          </div>

          <div className="space-y-3">
            {state.zones.map((zone) => {
              const activeShiftInZone = todayShifts.find((s) => s.zoneId === zone.id);
              const progress = activeShiftInZone
                ? Math.min(100, Math.round((activeShiftInZone.totalUnitsSold / (activeShiftInZone.totalUnitsDelivered || 1)) * 100))
                : 0;

              return (
                <div
                  key={zone.id}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-200">{zone.name}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          zone.touristAffluence === 'alta' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          Afluencia {zone.touristAffluence}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{zone.description}</p>
                    </div>

                    <div className="text-left sm:text-right">
                      {activeShiftInZone ? (
                        <div>
                          <span className="text-xs font-semibold text-emerald-400 flex items-center sm:justify-end">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
                            {activeShiftInZone.sellerName} ({activeShiftInZone.cartCode})
                          </span>
                          <span className="text-xs font-bold text-white">
                            ${activeShiftInZone.totalGrossSales.toLocaleString()} ({activeShiftInZone.totalUnitsSold} u vendidas)
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 italic">
                          Sin vendedor asignado hoy
                        </span>
                      )}
                    </div>
                  </div>

                  {activeShiftInZone && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                        <span>Ritmo de venta del carrito</span>
                        <span>{progress}% vendido ({activeShiftInZone.totalUnitsDelivered - activeShiftInZone.totalUnitsSold} u en stock)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Gráfico de Ventas y Cobranzas */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-white flex items-center">
                <DollarSign className="w-4 h-4 text-sky-400 mr-1.5" />
                Medios de Pago del Día
              </h2>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {paymentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`$${Number(val).toLocaleString()}`, 'Total']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 mt-2">
              <div className="flex items-center justify-between text-xs bg-slate-950/60 p-2 rounded-lg">
                <span className="flex items-center text-emerald-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2"></span>
                  Efectivo en mano
                </span>
                <span className="font-bold text-white">${totalCashSales.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs bg-slate-950/60 p-2 rounded-lg">
                <span className="flex items-center text-sky-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500 mr-2"></span>
                  Mercado Pago
                </span>
                <span className="font-bold text-white">${totalMpSales.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs bg-slate-950/60 p-2 rounded-lg">
                <span className="flex items-center text-indigo-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 mr-2"></span>
                  Transferencias Bancarias
                </span>
                <span className="font-bold text-white">${totalTransferSales.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800">
            <button
              onClick={() => onNavigate('vouchers')}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-xl transition-all flex items-center justify-center space-x-1.5 border border-slate-700 cursor-pointer"
            >
              <span>Auditar Comprobantes IA</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Radar de Playas & Reportes de Vendedores en Vivo (Marea, Afluencia e Inconvenientes) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <Waves className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Radar de Playas & Condiciones Costeras en Vivo</span>
                <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-bold">
                  {state.beachReports?.length || 0} reportes
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Avisos de marea, afluencia y desplazamientos reportados por vendedores en la arena.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('seller')}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all flex items-center space-x-1.5 self-start sm:self-auto cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-sky-400" />
            <span>Ver Terminal Vendedor</span>
          </button>
        </div>

        {state.beachReports && state.beachReports.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {state.beachReports.map((report) => {
              const isAlert = report.reportType === 'inconveniente';
              const isOpp = report.reportType === 'oportunidad';
              return (
                <div
                  key={report.id}
                  className={`p-4 rounded-xl border transition-all text-xs space-y-2.5 ${
                    isAlert
                      ? 'bg-rose-950/20 border-rose-900/60'
                      : isOpp
                      ? 'bg-amber-950/20 border-amber-900/60'
                      : 'bg-slate-950/80 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-white flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-amber-400" />
                      <span>{report.locality}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{report.timestamp}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <span className={`px-2 py-0.5 rounded-full font-bold ${
                      report.tide === 'marea_alta' || report.tide === 'sin_playa_marea_llena'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    }`}>
                      🌊 {report.tide.replace(/_/g, ' ')}
                    </span>

                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                      👥 Afluencia: {report.crowdLevel}
                    </span>

                    {report.reportType && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                        {report.reportType.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  <p className="text-slate-200 text-xs leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                    "{report.comments}"
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                    <span>Vendedor: <strong className="text-slate-300">{report.sellerName}</strong></span>
                    {report.sectorDetails && <span className="italic">{report.sectorDetails}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center text-slate-500 text-xs bg-slate-950/60 rounded-xl">
            No se han registrado reportes de playa hoy todavía.
          </div>
        )}
      </div>

      {/* Recaudación por Localidad / Playa (Costa Atlántica) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-amber-400" />
              <span>Recaudación & Tequeños Vendidos por Localidad / Playa</span>
            </h2>
            <p className="text-xs text-slate-400">
              Desglose geográfico de ventas en la Costa Atlántica (Santa Teresita, Mar del Tuyú, Costa del Este, etc.)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Gráfico de Barras */}
          <div className="lg:col-span-2 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={localityStats} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="locality" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip
                  formatter={(val: any) => [`$${Number(val).toLocaleString()}`, 'Recaudado']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="totalAmount" fill="#38bdf8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla Resumen */}
          <div className="space-y-2">
            {localityStats.map((loc, idx) => (
              <div
                key={loc.locality}
                className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-white block">
                    {idx + 1}. {loc.locality}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {loc.units} tequeños • {loc.count} tickets
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-emerald-400 block">
                    ${loc.totalAmount.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    ~${Math.round(loc.totalAmount / (loc.count || 1)).toLocaleString()} /venta
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gráfico de Ventas por Vendedor */}
      {sellerChartData.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <h2 className="text-base font-bold text-white mb-4 flex items-center">
            <Users className="w-4 h-4 text-amber-400 mr-2" />
            Rendimiento de Ventas por Vendedor (Jornada Activa)
          </h2>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sellerChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip
                  formatter={(val: any) => [`$${Number(val).toLocaleString()}`, 'Ventas']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="ventas" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

    </div>
  );
};
