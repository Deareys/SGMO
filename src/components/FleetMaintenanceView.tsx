/**
 * SGMO — Tequeños Costa
 * Módulo de Flota de Carritos, Garrafas de Gas y Mantenimiento de Playa
 */

import React, { useState } from 'react';
import {
  Flame,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Plus,
  Coins,
  MapPin,
  Sparkles,
  Layers
} from 'lucide-react';
import { AppState, storageService } from '../services/storageService';
import { CartIncident } from '../types';

interface FleetMaintenanceViewProps {
  state: AppState;
}

export const FleetMaintenanceView: React.FC<FleetMaintenanceViewProps> = ({ state }) => {
  const { carts, incidents, houses, users, currentUser } = state;
  const isSeller = currentUser?.role === 'seller';

  // Obtener carrito asignado al vendedor (si corresponde)
  const userAssignedCart = isSeller ? carts.find((c) => c.currentSellerId === currentUser?.id) : null;

  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [selectedCartId, setSelectedCartId] = useState(userAssignedCart?.id || carts[0]?.id || '');
  const [incidentType, setIncidentType] = useState<CartIncident['type']>('quemador_gas');
  const [description, setDescription] = useState('');

  // Manejar reporte de incidente
  const handleReportIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description) return;

    storageService.reportCartIncident({
      cartId: selectedCartId,
      type: incidentType,
      description
    });

    setShowIncidentModal(false);
    setDescription('');
  };

  // Manejar resolución de incidente
  const handleResolveIncident = (incidentId: string) => {
    if (isSeller) return;
    const cost = prompt('Ingresá el costo del repuesto / taller ($):', '12000');
    storageService.updateIncidentStatus(
      incidentId,
      'solucionado',
      cost ? Number(cost) : 0,
      'Reparación finalizada y testeada en base'
    );
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Encabezado */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-amber-400 text-xs font-semibold uppercase tracking-wider">
              <Flame className="w-3.5 h-3.5" />
              <span>Infraestructura Móvil & Combustible</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white mt-1">
              Flota de Carritos, Garrafas de Gas & Taller
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Control de garrafas, ruedas para arena, quemadores térmicos y registro de mantenimiento preventivo.
            </p>
          </div>

          <button
            onClick={() => setShowIncidentModal(true)}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-rose-600/20 flex items-center space-x-1.5 transition-all"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Reportar Avería o Falla</span>
          </button>
        </div>
      </div>

      {/* Grid de Carritos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {carts.map((cart) => {
          const house = houses.find((h) => h.id === cart.houseId);
          const currentSeller = users.find((u) => u.id === cart.currentSellerId);
          const isGasLow = (cart.gasLevelPercent ?? 100) < 20;

          return (
            <div
              key={cart.id}
              className={`bg-slate-900 border rounded-2xl p-5 shadow-xl flex flex-col justify-between transition-all ${
                cart.status === 'en_reparacion'
                  ? 'border-rose-500/50 bg-rose-950/10'
                  : cart.status === 'en_revision'
                  ? 'border-amber-500/50 bg-amber-950/10'
                  : 'border-slate-800'
              }`}
            >
              <div>
                {/* Header del Carrito */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-lg font-black text-white">{cart.code}</span>
                    <span className="text-[11px] text-slate-400 block">{house?.name}</span>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    cart.status === 'operativo'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : cart.status === 'en_reparacion'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {cart.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Vendedor Asignado */}
                <div className="mt-3 text-xs">
                  <span className="text-slate-400 text-[11px]">Asignación Actual:</span>
                  <div className="font-bold text-white mt-0.5">
                    {currentSeller ? (
                      <span className="text-emerald-400 flex items-center">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
                        {currentSeller.name}
                      </span>
                    ) : (
                      <span className="text-slate-500">En base / Disponible</span>
                    )}
                  </div>
                </div>

                {/* Nivel de Garrafa de Gas */}
                <div className="mt-4 bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 flex items-center">
                      <Flame className={`w-3.5 h-3.5 mr-1 ${isGasLow ? 'text-rose-500 animate-bounce' : 'text-amber-400'}`} />
                      Nivel de Gas
                    </span>
                    <span className={`font-mono font-bold ${isGasLow ? 'text-rose-400 font-black' : 'text-white'}`}>
                      {cart.gasLevelPercent ?? 100}%
                    </span>
                  </div>

                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        isGasLow ? 'bg-rose-500' : (cart.gasLevelPercent ?? 100) > 60 ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${cart.gasLevelPercent ?? 100}%` }}
                    ></div>
                  </div>

                  {isGasLow && (
                    <span className="text-[10px] font-bold text-rose-400 block text-center">
                      ⚠️ Recargar garrafa antes del próximo turno
                    </span>
                  )}
                </div>

                {/* Insumos */}
                <div className="mt-3 text-[11px] text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Servilletas:</span>
                    <span className="text-slate-200 capitalize font-medium">{cart.suppliesLevel?.napkins || 'medio'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Conos:</span>
                    <span className="text-slate-200 capitalize font-medium">{cart.suppliesLevel?.cones || 'medio'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex justify-between">
                <span>Días de uso: {cart.totalDaysInUse ?? 0}</span>
                <span>Mant: {cart.lastMaintenanceDate || 'Sin registro'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Historial de Incidencias & Reparaciones (Exclusivo taller, coordinación y administración) */}
      {!isSeller && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Wrench className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold text-white">
                Libro de Averías e Intervenciones de Taller
              </h2>
            </div>
            <span className="text-xs text-slate-400">{incidents.length} registros</span>
          </div>

          <div className="space-y-3">
            {incidents.map((inc) => {
              const cart = carts.find((c) => c.id === inc.cartId);
              const isResolved = inc.status === 'solucionado';

              return (
                <div
                  key={inc.id}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white text-xs">{cart?.code || inc.cartId}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-amber-400 font-semibold text-xs capitalize">{inc.type.replace(/_/g, ' ')}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-[11px] text-slate-400">{inc.date} (por {inc.reportedBy})</span>
                    </div>
                    <p className="text-xs text-slate-300">{inc.description}</p>
                    {inc.resolutionNotes && (
                      <p className="text-[11px] text-emerald-400 italic">Solución: {inc.resolutionNotes}</p>
                    )}
                  </div>

                  <div className="flex items-center space-x-3">
                    {inc.costOfRepair && (
                      <span className="font-mono text-xs text-slate-300 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                        ${inc.costOfRepair.toLocaleString()}
                      </span>
                    )}

                    {!isResolved ? (
                      <button
                        onClick={() => handleResolveIncident(inc.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Marcar Reparado</span>
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-400 flex items-center">
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Solucionado ({inc.resolvedDate})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: Reportar Incidencia */}
      {showIncidentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center">
                <AlertTriangle className="w-5 h-5 text-rose-400 mr-2" />
                Registrar Falla de Carrito
              </h3>
              <button onClick={() => setShowIncidentModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleReportIncident} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Carrito Afectado</label>
                <select
                  value={selectedCartId}
                  onChange={(e) => setSelectedCartId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                >
                  {carts.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} ({c.model})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de Incidencia</label>
                <select
                  value={incidentType}
                  onChange={(e) => setIncidentType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                >
                  <option value="quemador_gas">Quemador / Garrafa de Gas</option>
                  <option value="rueda_arena">Ruedas / Ejes / Chasis de Arena</option>
                  <option value="falla_electrica_bateria">Luces / Batería LED</option>
                  <option value="higiene_estructura">Tapa Térmica / Chapa / Vidrio</option>
                  <option value="falta_insumos">Faltante Crítico de Insumos</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Descripción de la Falla</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Detallar síntoma para el tallerista..."
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
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl"
                >
                  Reportar a Mantenimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
