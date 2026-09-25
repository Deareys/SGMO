/**
 * SGMO — Tequeños Costa
 * Módulo de Análisis Financiero, Estructura de Costos y Rentabilidad Real
 */

import React, { useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  PieChart as PieIcon,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  Coins,
  Receipt,
  FileSpreadsheet
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
import { AppState, storageService } from '../services/storageService';
import { OperationalExpense } from '../types';

interface CostsProfitabilityViewProps {
  state: AppState;
}

const COST_COLORS = ['#38bdf8', '#fbbf24', '#f87171', '#a78bfa', '#34d399', '#94a3b8'];

export const CostsProfitabilityView: React.FC<CostsProfitabilityViewProps> = ({ state }) => {
  const { expenses, sales, shifts, productionBatches, houses } = state;

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState<OperationalExpense['category']>('alquiler_casas');
  const [expenseAmount, setExpenseAmount] = useState(150000);
  const [expenseDescription, setExpenseDescription] = useState('Alquiler Base Norte quincena');
  const [expenseHouseId, setExpenseHouseId] = useState(houses[0]?.id || '');

  // Cálculos Consolidados
  const totalGrossRevenue = (sales || []).reduce((sum, s) => sum + (s?.totalAmount || 0), 0);
  const totalUnitsSold = (shifts || []).reduce((sum, s) => sum + (s?.totalUnitsSold || 0), 0);
  const totalCommissionsPaid = (shifts || []).reduce((sum, s) => sum + (s?.grossCommission || 0), 0);

  const avgProductionUnitCost = (productionBatches || []).length > 0
    ? (productionBatches || []).reduce((sum, b) => sum + (b?.unitCostCalculated || 0), 0) / productionBatches.length
    : 220;

  const totalGoodsProductionCost = totalUnitsSold * avgProductionUnitCost;
  const totalOperatingExpenses = (expenses || []).reduce((sum, e) => sum + (e?.amount || 0), 0);

  const totalNetProfit = totalGrossRevenue - totalGoodsProductionCost - totalCommissionsPaid - totalOperatingExpenses;
  const netMarginPercent = totalGrossRevenue > 0 ? (totalNetProfit / totalGrossRevenue) * 100 : 48;

  // Desglose Unitario de 1 Tequeño vendido a $1,500
  const avgSellingPrice = 1450;
  const rawMaterialUnitCost = 140;
  const laborAndEnergyCost = avgProductionUnitCost - rawMaterialUnitCost;
  const avgCommissionRate = totalGrossRevenue > 0 && totalCommissionsPaid > 0
    ? (totalCommissionsPaid / totalGrossRevenue)
    : (state.systemConfig?.defaultCommissionRate || 0.20);
  const sellerCommissionAvg = avgSellingPrice * avgCommissionRate;
  const mpFeeAvg = avgSellingPrice * 0.02;
  const overheadEst = 80;
  const netUnitProfit = avgSellingPrice - rawMaterialUnitCost - laborAndEnergyCost - sellerCommissionAvg - mpFeeAvg - overheadEst;

  const unitBreakdownData = [
    { name: 'Materia Prima', value: rawMaterialUnitCost },
    { name: 'Producción & Energía', value: Math.round(laborAndEnergyCost) },
    { name: `Comisión Vendedor (${Math.round(avgCommissionRate * 100)}%)`, value: Math.round(sellerCommissionAvg) },
    { name: 'Fee Mercado Pago', value: Math.round(mpFeeAvg) },
    { name: 'Costos Fijos / Logística', value: overheadEst },
    { name: 'Margen Neto Negocio', value: Math.round(netUnitProfit) }
  ];

  // Manejar Nuevo Gasto
  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseAmount <= 0) return;

    storageService.addExpense({
      date: new Date().toISOString().slice(0, 10),
      category: expenseCategory,
      amount: expenseAmount,
      description: expenseDescription,
      houseId: expenseHouseId || undefined
    });

    setShowExpenseModal(false);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Encabezado */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Finanzas, Costos Reales & Rentabilidad</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white mt-1">
              Unit Economics & Balance Operativo
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Desglose detallado del costo de producción, comisiones, costos fijos y rentabilidad neta real.
            </p>
          </div>

          <button
            onClick={() => setShowExpenseModal(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-600/20 flex items-center space-x-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Gasto Operativo</span>
          </button>
        </div>
      </div>

      {/* Tarjetas Financieras */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md">
          <span className="text-xs text-slate-400 font-medium uppercase">Ingresos Brutos Acumulados</span>
          <div className="text-2xl font-black text-white mt-1.5 font-mono">
            ${totalGrossRevenue.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{totalUnitsSold} tequeños comercializados</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md">
          <span className="text-xs text-slate-400 font-medium uppercase">Costo Total de Producción</span>
          <div className="text-2xl font-black text-amber-400 mt-1.5 font-mono">
            ${Math.round(totalGoodsProductionCost).toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Costo medio: ${(avgProductionUnitCost ?? 0).toFixed(2)} /u</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md">
          <span className="text-xs text-slate-400 font-medium uppercase">Comisiones & Gastos Fijos</span>
          <div className="text-2xl font-black text-sky-400 mt-1.5 font-mono">
            ${(totalCommissionsPaid + totalOperatingExpenses).toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Comisiones: ${totalCommissionsPaid.toLocaleString()}</p>
        </div>

        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-md bg-emerald-950/10">
          <span className="text-xs text-emerald-400 font-bold uppercase">Ganancia Neta Real</span>
          <div className="text-2xl font-black text-emerald-300 mt-1.5 font-mono">
            ${Math.round(totalNetProfit).toLocaleString()}
          </div>
          <div className="flex items-center text-[11px] text-emerald-400 mt-1 font-semibold">
            <span>Margen Neto: {(netMarginPercent ?? 0).toFixed(1)}%</span>
          </div>
        </div>

      </div>

      {/* Desglose de Unit Economics (1 Tequeño) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Gráfico Torta del Unit Economic (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white mb-2 flex items-center">
              <PieIcon className="w-4 h-4 text-amber-400 mr-2" />
              Desglose Unitario de 1 Tequeño (${avgSellingPrice})
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Distribución porcentual de cada peso ingresado por venta en la playa.
            </p>

            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={unitBreakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {unitBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COST_COLORS[index % COST_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`$${val}`, 'Monto']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 text-xs">
            {unitBreakdownData.map((item, idx) => (
              <div key={item.name} className="flex justify-between items-center text-slate-300">
                <span className="flex items-center">
                  <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: COST_COLORS[idx % COST_COLORS.length] }}></span>
                  {item.name}
                </span>
                <strong className="font-mono text-white">${item.value} ({((item.value / avgSellingPrice) * 100).toFixed(0)}%)</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Libro de Gastos Operativos (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center">
              <Receipt className="w-4 h-4 text-emerald-400 mr-2" />
              Gastos Operativos Registrados
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              Total: ${totalOperatingExpenses.toLocaleString()}
            </span>
          </div>

          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {expenses.map((exp) => (
              <div
                key={exp.id}
                className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-white">{exp.description}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 capitalize">
                    {exp.category.replace(/_/g, ' ')} • {exp.date} (por {exp.registeredBy})
                  </div>
                </div>

                <div className="font-mono font-bold text-rose-400 text-sm">
                  -${exp.amount.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* MODAL: Nuevo Gasto */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center">
                <Plus className="w-5 h-5 text-emerald-400 mr-2" />
                Registrar Gasto Operativo
              </h3>
              <button onClick={() => setShowExpenseModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Rubro de Gasto</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                >
                  <option value="alquiler_casas">Alquiler de Casa / Base Operativa</option>
                  <option value="flete_traslado">Flete / Traslado Costa</option>
                  <option value="garrafas_gas">Garrafas de Gas</option>
                  <option value="mantenimiento_carritos">Taller / Reparación de Carritos</option>
                  <option value="insumos_packaging">Packaging / Servilletas / Conos</option>
                  <option value="otro">Otro Gasto General</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Monto ($)</label>
                <input
                  type="number"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-bold font-mono"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Descripción / Concepto</label>
                <input
                  type="text"
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  placeholder="Ej: Recarga de 3 garrafas de 10kg en YPF"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 bg-slate-800 text-xs text-slate-300 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl"
                >
                  Guardar Gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
