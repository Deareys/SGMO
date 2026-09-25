/**
 * SGMO — Tequeños Costa
 * Pestaña de Configuración de Tramos de Comisión y Recompensas (Admin)
 */

import React, { useState, useMemo } from 'react';
import {
  Award,
  Plus,
  Edit2,
  Trash2,
  Power,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  DollarSign,
  Calculator,
  X,
  Save,
  Home,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { CommissionTier } from '../types';
import { calculateCommissionForSales, formatTierRange } from '../utils/commissionUtils';

interface CommissionTiersTabProps {
  tiers: CommissionTier[];
  housingCostDaily: number;
  onAddTier: (tierData: Omit<CommissionTier, 'id'>) => void;
  onUpdateTier: (tierId: string, updates: Partial<CommissionTier>) => void;
  onDeleteTier: (tierId: string) => void;
  onToggleTier: (tierId: string) => void;
  onResetDefaults: () => void;
}

export const CommissionTiersTab: React.FC<CommissionTiersTabProps> = ({
  tiers,
  housingCostDaily,
  onAddTier,
  onUpdateTier,
  onDeleteTier,
  onToggleTier,
  onResetDefaults
}) => {
  const [editingTier, setEditingTier] = useState<CommissionTier | null>(null);
  const [isCreatingTier, setIsCreatingTier] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Estado del simulador interactivo
  const [simSales, setSimSales] = useState<number>(180000);
  const [includeHousingInSim, setIncludeHousingInSim] = useState<boolean>(true);

  // Ordenar tramos por venta mínima
  const sortedTiers = useMemo(() => {
    return [...tiers].sort((a, b) => a.minSales - b.minSales);
  }, [tiers]);

  // Cálculo en vivo del simulador
  const simResult = useMemo(() => {
    return calculateCommissionForSales(simSales, tiers, 0.20);
  }, [simSales, tiers]);

  const simPayout = useMemo(() => {
    const gross = simResult.grossCommission;
    const housing = includeHousingInSim ? housingCostDaily : 0;
    return Math.max(0, gross - housing);
  }, [simResult.grossCommission, includeHousingInSim, housingCostDaily]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Encabezado de la Sección */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                <Award className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center">
                Escalafón de Comisiones y Tramos de Recompensa
                <span className="ml-3 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
                  Configuración Dinámica
                </span>
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-3xl">
              Configura los tramos de ventas de la jornada y los porcentajes que reciben los vendedores.
              El porcentaje alcanzado se aplica sobre el <strong>total de ventas brutas</strong> de la jornada.
            </p>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 flex items-center space-x-1.5 transition-all"
              title="Restablecer los 4 tramos iniciales sugeridos"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer Tramos Iniciales</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingTier(null);
                setIsCreatingTier(true);
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-all shadow-md shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Nuevo Tramo</span>
            </button>
          </div>
        </div>

        {/* Nota de Garantía de Historial */}
        <div className="mt-4 p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-start space-x-3 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-slate-200">Garantía de Liquidaciones Históricas:</strong> Los cambios que realices aquí
            se aplicarán a las jornadas en curso y futuras. Las liquidaciones ya cerradas y pagadas{' '}
            <span className="text-amber-400">conservan intacto el porcentaje y reglas</span> que se utilizaron en el momento del cierre.
          </div>
        </div>
      </div>

      {/* Tramos Configurados (Lista y Tarjetas) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
            <span>Tramos Activos ({sortedTiers.filter((t) => t.isActive).length} de {sortedTiers.length})</span>
          </h3>
          <span className="text-xs text-slate-400">
            Se evalúan en orden creciente según el total de ventas alcanzado
          </span>
        </div>

        {sortedTiers.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/50 rounded-xl border border-slate-800 space-y-3">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
            <p className="text-sm text-slate-300 font-semibold">No hay tramos de comisión definidos</p>
            <p className="text-xs text-slate-500">Haz clic en "Agregar Nuevo Tramo" o "Restablecer Tramos Iniciales".</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedTiers.map((tier, index) => {
              const ratePercent = Math.round(tier.rate * 100);
              return (
                <div
                  key={tier.id}
                  className={`p-4 rounded-xl border transition-all ${
                    tier.isActive
                      ? 'bg-slate-950/70 border-slate-800 hover:border-amber-500/40'
                      : 'bg-slate-950/30 border-slate-800/50 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        <h4 className="font-bold text-white text-sm">{tier.name}</h4>
                      </div>
                      <p className="text-xs text-slate-400 font-mono">
                        Rango: <span className="text-slate-200 font-semibold">{formatTierRange(tier)}</span>
                      </p>
                    </div>

                    <div className="text-right space-y-1">
                      <div className="inline-flex items-center px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 font-black text-sm">
                        {ratePercent}%
                      </div>
                      <div>
                        {tier.isActive ? (
                          <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40 font-semibold">
                            Activo
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full font-semibold">
                            Inactivo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acciones del Tramo */}
                  <div className="mt-4 pt-3 border-t border-slate-800/70 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => onToggleTier(tier.id)}
                      className={`px-2.5 py-1 rounded-lg flex items-center space-x-1 font-semibold transition-colors ${
                        tier.isActive
                          ? 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
                          : 'text-emerald-400 hover:bg-emerald-950/40'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{tier.isActive ? 'Desactivar' : 'Activar'}</span>
                    </button>

                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTier(tier);
                          setIsCreatingTier(false);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title="Editar límites y porcentaje"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(tier.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
                        title="Eliminar tramo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Simulador Interactivo de Comisiones y Liquidación */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Calculator className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Simulador en Vivo de Liquidación</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Verificación instantánea de reglas
          </span>
        </div>

        <p className="text-xs text-slate-400">
          Prueba cualquier monto de ventas de la jornada o usa los accesos rápidos para comprobar el porcentaje aplicado,
          la comisión bruta resultante y el descuento por vivienda.
        </p>

        {/* Accesos Rápidos de los Ejemplos Requeridos */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold mr-1">Ejemplos requeridos:</span>
          <button
            type="button"
            onClick={() => setSimSales(100000)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
              simSales === 100000
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            $100.000 (10%)
          </button>
          <button
            type="button"
            onClick={() => setSimSales(180000)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
              simSales === 180000
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            $180.000 (20%)
          </button>
          <button
            type="button"
            onClick={() => setSimSales(300000)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
              simSales === 300000
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            $300.000 (30%)
          </button>
          <button
            type="button"
            onClick={() => setSimSales(400000)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
              simSales === 400000
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            $400.000 (&gt;$330k)
          </button>
        </div>

        {/* Controles del Simulador */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Ventas Totales de la Jornada ($)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-mono text-xs">$</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={simSales}
                onChange={(e) => setSimSales(Math.max(0, Number(e.target.value)))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="block text-xs font-semibold text-slate-300">Descuento de Vivienda ($)</span>
              <span className="text-[11px] text-slate-400">
                Costo actual: ${housingCostDaily.toLocaleString()} / día
              </span>
            </div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeHousingInSim}
                onChange={(e) => setIncludeHousingInSim(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 focus:ring-amber-400"
              />
              <span className="text-xs text-slate-300">Aplicar descuento</span>
            </label>
          </div>
        </div>

        {/* Tarjeta de Resultado de la Simulación */}
        <div className="bg-gradient-to-br from-amber-500/10 via-slate-950/90 to-emerald-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-medium uppercase">Tramo Alcanzado</span>
              <span className="text-sm font-bold text-amber-300 block truncate mt-1">
                {simResult.tierName}
              </span>
            </div>

            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-medium uppercase">Porcentaje Aplicado</span>
              <span className="text-xl font-black text-amber-400 block mt-0.5">
                {Math.round(simResult.rate * 100)}%
              </span>
            </div>

            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-medium uppercase">Comisión Bruta</span>
              <span className="text-xl font-black text-emerald-400 block mt-0.5 font-mono">
                +${simResult.grossCommission.toLocaleString()}
              </span>
            </div>

            <div className="p-3 bg-slate-900/80 rounded-xl border border-emerald-500/30 bg-emerald-950/20">
              <span className="text-[11px] text-emerald-300 block font-medium uppercase">Liquidación Neta</span>
              <span className="text-xl font-black text-white block mt-0.5 font-mono">
                ${simPayout.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-300 bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <strong>Explicación matemática:</strong> Se aplica el {Math.round(simResult.rate * 100)}% directamente sobre ${simSales.toLocaleString()} = ${simResult.grossCommission.toLocaleString()}.
              {includeHousingInSim && ` Menos $${housingCostDaily.toLocaleString()} de vivienda = $${simPayout.toLocaleString()} neto.`}
            </div>
            {simResult.salesToNextTier && simResult.salesToNextTier > 0 && (
              <div className="text-sky-300 font-semibold flex items-center space-x-1 flex-shrink-0">
                <TrendingUp className="w-4 h-4" />
                <span>¡Faltan ${simResult.salesToNextTier.toLocaleString()} para el {Math.round((simResult.nextTier?.rate || 0) * 100)}%!</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Creación / Edición de Tramo */}
      {(isCreatingTier || editingTier) && (
        <CommissionTierModal
          tier={editingTier}
          onClose={() => {
            setIsCreatingTier(false);
            setEditingTier(null);
          }}
          onSave={(tierData) => {
            if (editingTier) {
              onUpdateTier(editingTier.id, tierData);
            } else {
              onAddTier(tierData as Omit<CommissionTier, 'id'>);
            }
            setIsCreatingTier(false);
            setEditingTier(null);
          }}
        />
      )}

      {/* Confirmación de Eliminación */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2 text-rose-400">
              <AlertCircle className="w-5 h-5" />
              <h4 className="font-bold text-white text-base">¿Eliminar este tramo?</h4>
            </div>
            <p className="text-xs text-slate-300">
              Esta acción eliminará el tramo para futuras liquidaciones. Las liquidaciones históricas conservan sus datos archivados.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteTier(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación de Restablecimiento a Tramos Iniciales */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2 text-amber-400">
              <RotateCcw className="w-5 h-5" />
              <h4 className="font-bold text-white text-base">¿Restablecer Tramos Iniciales?</h4>
            </div>
            <p className="text-xs text-slate-300">
              Se restablecerá la configuración recomendada:
            </p>
            <ul className="text-xs text-slate-400 space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono">
              <li>• Hasta $110.000: <strong>10%</strong></li>
              <li>• Más de $110.000 y hasta $220.000: <strong>20%</strong></li>
              <li>• Más de $220.000 y hasta $330.000: <strong>30%</strong></li>
              <li>• Más de $330.000: <strong>30%</strong> (sin límite superior)</li>
            </ul>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetDefaults();
                  setShowResetConfirm(false);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs"
              >
                Confirmar y Restablecer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =========================================================================
// MODAL PARA CREAR O EDITAR TRAMO DE COMISIÓN
// =========================================================================
interface CommissionTierModalProps {
  tier: CommissionTier | null;
  onClose: () => void;
  onSave: (data: Partial<CommissionTier>) => void;
}

const CommissionTierModal: React.FC<CommissionTierModalProps> = ({ tier, onClose, onSave }) => {
  const [name, setName] = useState(tier?.name || '');
  const [minSales, setMinSales] = useState<number>(tier?.minSales ?? 0);
  const [hasNoMax, setHasNoMax] = useState<boolean>(tier ? tier.maxSales === null : false);
  const [maxSales, setMaxSales] = useState<number>(tier?.maxSales ?? 110000);
  const [ratePercent, setRatePercent] = useState<number>(tier ? Math.round(tier.rate * 100) : 10);
  const [isActive, setIsActive] = useState<boolean>(tier?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor ingresa un nombre descriptivo para el tramo.');
      return;
    }
    if (minSales < 0) {
      setError('La venta mínima no puede ser negativa.');
      return;
    }
    if (!hasNoMax && maxSales <= minSales) {
      setError('La venta máxima debe ser estrictamente mayor que la venta mínima.');
      return;
    }
    if (ratePercent <= 0 || ratePercent > 100) {
      setError('El porcentaje de comisión debe estar entre 1% y 100%.');
      return;
    }

    onSave({
      name: name.trim(),
      minSales,
      maxSales: hasNoMax ? null : maxSales,
      rate: ratePercent / 100,
      isActive
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-200">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-base">
              {tier ? 'Editar Tramo de Comisión' : 'Agregar Nuevo Tramo de Comisión'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Nombre del Tramo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Hasta $110.000, Más de $330.000..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Venta Mínima ($)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={minSales}
                onChange={(e) => setMinSales(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-slate-300 font-semibold">Venta Máxima ($)</label>
                <label className="flex items-center space-x-1 cursor-pointer text-[11px] text-amber-400">
                  <input
                    type="checkbox"
                    checked={hasNoMax}
                    onChange={(e) => setHasNoMax(e.target.checked)}
                    className="rounded text-amber-500 bg-slate-950 border-slate-700 focus:ring-amber-400"
                  />
                  <span>Sin tope</span>
                </label>
              </div>
              <input
                type="number"
                disabled={hasNoMax}
                min={minSales + 1}
                step="1000"
                value={hasNoMax ? '' : maxSales}
                onChange={(e) => setMaxSales(Number(e.target.value))}
                placeholder={hasNoMax ? 'Sin límite superior' : 'Monto tope'}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
                required={!hasNoMax}
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Porcentaje de Comisión sobre Total de Ventas (%)
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                value={ratePercent}
                onChange={(e) => setRatePercent(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-amber-400 pr-8"
                required
              />
              <span className="absolute right-3 top-2 text-slate-400 font-bold">%</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Ej: ingresa <strong>20</strong> para 20%. En una venta de $180.000 corresponderán $36.000 de comisión bruta.
            </p>
          </div>

          <div className="pt-1">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700 focus:ring-amber-400"
              />
              <span className="text-slate-300 font-medium">Tramo activo y disponible para liquidar</span>
            </label>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-400">
            <strong className="text-slate-300">Regla resultante:</strong> Se otorgará el{' '}
            <span className="text-amber-400 font-bold">{ratePercent}%</span> sobre el total vendido cuando las ventas de la
            jornada se ubiquen entre <span className="font-mono text-white">${minSales.toLocaleString()}</span> y{' '}
            <span className="font-mono text-white">{hasNoMax ? 'en adelante (sin tope)' : `$${maxSales.toLocaleString()}`}</span>.
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-md shadow-amber-500/20 flex items-center space-x-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Tramo</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
