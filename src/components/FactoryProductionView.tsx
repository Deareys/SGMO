/**
 * SGMO — Tequeños Costa
 * Panel Exclusivo de Fábrica / Cuadra de Producción
 * Registro rápido para operarios de cocina: Órdenes, Recetas, Mermas, Control de Stock e Incidencias
 */

import React, { useState } from 'react';
import {
  ChefHat,
  Play,
  CheckCircle,
  AlertTriangle,
  Layers,
  Flame,
  Plus,
  RefreshCw,
  Clock,
  Trash2,
  X,
  FileSpreadsheet,
  TrendingUp,
  Sliders,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { AppState, storageService } from '../services/storageService';
import { ProductionOrder, ProductionRecipe, FactoryIncident } from '../types';

interface FactoryProductionViewProps {
  state: AppState;
}

export const FactoryProductionView: React.FC<FactoryProductionViewProps> = ({ state }) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'recipes' | 'inventory' | 'incidents'>('orders');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modales
  const [completingOrder, setCompletingOrder] = useState<ProductionOrder | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isReportingIncident, setIsReportingIncident] = useState(false);
  const [selectedRecipeForBatch, setSelectedRecipeForBatch] = useState<ProductionRecipe | null>(null);

  const notifySuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const pendingOrders = state.productionOrders.filter((o) => o.status === 'pendiente' || o.status === 'en_proceso');
  const completedOrders = state.productionOrders.filter((o) => o.status === 'completada');

  return (
    <div className="space-y-6 pb-16">
      
      {/* Encabezado Principal */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <ChefHat className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center">
                Fábrica & Cuadra de Producción
                <span className="ml-3 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/80">
                  Operarios & Cocina
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Control ágil de tandas de tequeños, elaboración de salsas, registro de mermas y alertas mecánicas.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsReportingIncident(true)}
            className="px-3.5 py-2 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold rounded-xl flex items-center space-x-1.5 text-xs transition-colors"
          >
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>Reportar Falla / Insumo</span>
          </button>

          <button
            onClick={() => setIsCreatingOrder(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center space-x-1.5 text-xs transition-colors shadow-md shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Orden de Cocina</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-950/90 border border-emerald-700 text-emerald-300 px-4 py-3 rounded-xl text-xs sm:text-sm font-medium flex items-center space-x-2 animate-fadeIn">
          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Navegación Interna */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-slate-800 text-xs font-medium">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2.5 rounded-xl flex items-center space-x-2 transition-all whitespace-nowrap ${
            activeTab === 'orders'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Órdenes de Trabajo ({pendingOrders.length} activas)</span>
        </button>

        <button
          onClick={() => setActiveTab('recipes')}
          className={`px-4 py-2.5 rounded-xl flex items-center space-x-2 transition-all whitespace-nowrap ${
            activeTab === 'recipes'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <ChefHat className="w-4 h-4" />
          <span>Recetario & Fórmulas ({state.recipes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2.5 rounded-xl flex items-center space-x-2 transition-all whitespace-nowrap ${
            activeTab === 'inventory'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Materias Primas & Lotes Centrales</span>
        </button>

        <button
          onClick={() => setActiveTab('incidents')}
          className={`px-4 py-2.5 rounded-xl flex items-center space-x-2 transition-all whitespace-nowrap ${
            activeTab === 'incidents'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Incidencias de Fábrica ({state.factoryIncidents?.length || 0})</span>
        </button>
      </div>

      {/* 1. TAB: ÓRDENES DE PRODUCCIÓN EN COCINA */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          
          {/* Órdenes Activas / Pendientes */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center">
              <Play className="w-4 h-4 text-amber-400 mr-2" />
              Órdenes de Producción Pendientes y en Curso
            </h2>

            {pendingOrders.length === 0 ? (
              <div className="text-center py-10 bg-slate-950/60 rounded-xl border border-slate-800 text-slate-400 text-xs">
                No hay órdenes pendientes en este momento. Podés lanzar una tanda con el botón "Nueva Orden de Cocina" o desde el Recetario.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingOrders.map((order) => {
                  const recipe = state.recipes.find((r) => r.id === order.recipeId);
                  return (
                    <div
                      key={order.id}
                      className={`border rounded-xl p-5 space-y-3 transition-all ${
                        order.status === 'en_proceso'
                          ? 'bg-amber-950/20 border-amber-500/50 ring-1 ring-amber-500/30'
                          : 'bg-slate-800/60 border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-mono text-slate-400 block">{order.id}</span>
                          <h3 className="font-bold text-white text-base">{order.productName}</h3>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                            order.status === 'en_proceso'
                              ? 'bg-amber-500 text-slate-950 animate-pulse'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {order.status === 'en_proceso' ? 'En Cocción/Masa' : 'Pendiente'}
                        </span>
                      </div>

                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-700/60 space-y-1 text-xs">
                        <div className="flex justify-between text-slate-300">
                          <span>Objetivo:</span>
                          <strong className="text-white">
                            {order.requestedQuantity} {order.requestedUnit}
                          </strong>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>Fecha Requerida:</span>
                          <span className="text-amber-300">{order.targetDate}</span>
                        </div>
                        {order.assignedWorkerName && (
                          <div className="flex justify-between text-slate-300">
                            <span>Responsable:</span>
                            <span className="text-slate-200">{order.assignedWorkerName}</span>
                          </div>
                        )}
                      </div>

                      {order.productionNotes && (
                        <p className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded border border-slate-800">
                          {order.productionNotes}
                        </p>
                      )}

                      <div className="pt-2 flex items-center justify-between gap-2">
                        {order.status === 'pendiente' ? (
                          <button
                            onClick={() => {
                              storageService.startProductionOrder(order.id);
                              notifySuccess(`Orden ${order.id} iniciada`);
                            }}
                            className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center space-x-1.5 transition-colors"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Comenzar Producción</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setCompletingOrder(order)}
                            className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center space-x-1.5 transition-colors shadow-md shadow-emerald-500/20"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Finalizar & Registrar Lote</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Historial de Órdenes Completadas */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center">
              <CheckCircle className="w-4 h-4 text-emerald-400 mr-2" />
              Tandas Finalizadas Recientemente
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold border-b border-slate-700">
                  <tr>
                    <th className="p-3">Orden / Lote</th>
                    <th className="p-3">Producto</th>
                    <th className="p-3">Producidos Real</th>
                    <th className="p-3">Mermas / Descartes</th>
                    <th className="p-3">Eficiencia</th>
                    <th className="p-3">Completada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {completedOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono text-slate-300">
                        {ord.id}
                        {ord.generatedBatchId && (
                          <span className="block text-[10px] text-amber-400">{ord.generatedBatchId}</span>
                        )}
                      </td>
                      <td className="p-3 font-bold text-white">{ord.productName}</td>
                      <td className="p-3 font-semibold text-emerald-400">
                        {ord.realProducedQuantity || ord.requestedQuantity} {ord.requestedUnit}
                      </td>
                      <td className="p-3 text-rose-300">
                        {ord.wasteQuantity || 0} u
                        {ord.wasteReason && (
                          <span className="block text-[10px] text-slate-500">{ord.wasteReason}</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-slate-800 text-slate-200 rounded font-bold">
                          {ord.efficiencyPercent || 98}%
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">{ord.completedAt || ord.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* 2. TAB: RECETARIO & LANZAMIENTO RÁPIDO */}
      {activeTab === 'recipes' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center">
              <ChefHat className="w-5 h-5 text-amber-400 mr-2" />
              Fórmulas y Recetas Estándar de la Cuadra
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Podés lanzar una orden directa a partir de cualquiera de estas recetas con proporciones calculadas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {state.recipes.map((rec) => (
              <div key={rec.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base">{rec.name}</h3>
                    <span className="text-xs text-amber-400 font-semibold uppercase">{rec.type}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-200 bg-slate-900 px-2 py-1 rounded border border-slate-700">
                    Rinde: {rec.expectedYield} {rec.outputUnit}
                  </span>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-700/60 space-y-1 text-xs">
                  <span className="text-slate-400 font-semibold block">Insumos necesarios:</span>
                  {rec.ingredients.map((ing, i) => (
                    <div key={i} className="flex justify-between text-slate-300">
                      <span>• {ing.materialName}</span>
                      <strong className="text-white">{ing.quantityRequired} {ing.unit}</strong>
                    </div>
                  ))}
                </div>

                {rec.instructions && (
                  <p className="text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    {rec.instructions}
                  </p>
                )}

                <button
                  onClick={() => {
                    storageService.createProductionOrder({
                      recipeId: rec.id,
                      productName: rec.name,
                      targetDate: new Date().toISOString().slice(0, 10),
                      requestedQuantity: rec.expectedYield,
                      requestedUnit: rec.outputUnit,
                      assignedWorkerName: state.currentUser.name,
                      productionNotes: `Lanzada desde panel de cocina por ${state.currentUser.name}`
                    });
                    notifySuccess(`Orden de producción creada para "${rec.name}"`);
                    setActiveTab('orders');
                  }}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center space-x-1.5 transition-colors shadow-md shadow-amber-500/20"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Preparar Tanda ({rec.expectedYield} {rec.outputUnit})</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. TAB: MATERIAS PRIMAS & STOCK */}
      {activeTab === 'inventory' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Insumos en Planta */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center">
              <Layers className="w-4 h-4 text-amber-400 mr-2" />
              Stock de Insumos en Cuadra
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold border-b border-slate-700">
                  <tr>
                    <th className="p-2.5">Insumo</th>
                    <th className="p-2.5">Stock</th>
                    <th className="p-2.5">Alerta Mín.</th>
                    <th className="p-2.5">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {state.rawMaterials.map((mat) => {
                    const isLow = mat.currentStock <= mat.minStockAlert;
                    return (
                      <tr key={mat.id} className="hover:bg-slate-800/40">
                        <td className="p-2.5 font-semibold text-white">{mat.name}</td>
                        <td className="p-2.5 font-bold text-slate-200">{mat.currentStock} {mat.unit}</td>
                        <td className="p-2.5 text-slate-400">{mat.minStockAlert} {mat.unit}</td>
                        <td className="p-2.5">
                          {isLow ? (
                            <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold">
                              Reponer urgente
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px]">
                              Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Lotes Terminados en Cámara Central */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center">
              <TrendingUp className="w-4 h-4 text-emerald-400 mr-2" />
              Lotes en Cámara Frigorífica Central
            </h2>

            <div className="space-y-3">
              {state.productionBatches.map((batch) => {
                const variety = state.varieties.find((v) => v.id === batch.varietyId);
                return (
                  <div
                    key={batch.id}
                    className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-amber-400">{batch.id}</span>
                        <span className="font-semibold text-white">{variety?.name}</span>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Elaborado el {batch.date} {batch.notes ? `• ${batch.notes}` : ''}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-black text-emerald-400">
                        {(batch.unitsProduced || 0).toLocaleString()} u
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        Costo unit: ${(batch.unitCostCalculated ?? 0).toFixed(0)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* 4. TAB: INCIDENCIAS & FALLAS */}
      {activeTab === 'incidents' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center">
                <AlertTriangle className="w-5 h-5 text-rose-400 mr-2" />
                Libro de Incidencias y Fallas en Planta
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Averías en amasadoras, freidoras, falta de envases o problemas de temperatura.
              </p>
            </div>
            <button
              onClick={() => setIsReportingIncident(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl flex items-center space-x-1.5 text-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Reportar Incidencia</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {state.factoryIncidents && state.factoryIncidents.length > 0 ? (
              state.factoryIncidents.map((inc) => (
                <div
                  key={inc.id}
                  className={`border rounded-xl p-4 space-y-2 text-xs ${
                    inc.resolved
                      ? 'bg-slate-950/60 border-slate-800 opacity-70'
                      : 'bg-rose-950/20 border-rose-800/60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="font-bold text-rose-300 uppercase tracking-wider text-[10px]">
                      {inc.type.replace('_', ' ')}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        inc.resolved
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}
                    >
                      {inc.resolved ? 'Solucionado' : 'Abierto'}
                    </span>
                  </div>

                  <p className="text-white font-medium">{inc.message}</p>
                  <p className="text-slate-400 text-[11px]">
                    Reportado por {inc.reportedBy} ({inc.timestamp})
                  </p>

                  {!inc.resolved && (
                    <button
                      onClick={() => {
                        storageService.resolveFactoryIncident(inc.id);
                        notifySuccess('Incidencia marcada como resuelta');
                      }}
                      className="mt-2 text-emerald-400 hover:text-emerald-300 font-bold text-xs"
                    >
                      ✓ Marcar como Resuelto
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="col-span-2 text-center py-8 text-slate-500 text-xs">
                No hay incidencias activas en planta.
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL COMPLETAR ORDEN & MERMAS --- */}
      {completingOrder && (
        <CompleteOrderModal
          order={completingOrder}
          onClose={() => setCompletingOrder(null)}
          onComplete={(realQty, wasteQty, wasteReason, notes) => {
            storageService.completeProductionOrder(
              completingOrder.id,
              realQty,
              wasteQty,
              wasteReason,
              notes
            );
            notifySuccess(`Orden ${completingOrder.id} finalizada y lote ingresado a cámara central`);
            setCompletingOrder(null);
          }}
        />
      )}

      {/* --- MODAL CREAR ORDEN --- */}
      {isCreatingOrder && (
        <CreateOrderModal
          recipes={state.recipes}
          onClose={() => setIsCreatingOrder(false)}
          onCreate={(orderData) => {
            storageService.createProductionOrder({
              ...orderData,
              assignedWorkerName: state.currentUser.name
            });
            notifySuccess('Nueva orden de cocina programada');
            setIsCreatingOrder(false);
          }}
        />
      )}

      {/* --- MODAL REPORTAR INCIDENCIA --- */}
      {isReportingIncident && (
        <ReportIncidentModal
          onClose={() => setIsReportingIncident(false)}
          onReport={(data) => {
            storageService.reportFactoryIncident(data);
            notifySuccess('Incidencia y alerta enviada a los coordinadores');
            setIsReportingIncident(false);
          }}
        />
      )}

    </div>
  );
};

// --- SUBCOMPONENTES DE MODALES ---

interface CompleteOrderModalProps {
  order: ProductionOrder;
  onClose: () => void;
  onComplete: (realQty: number, wasteQty: number, wasteReason: string, notes: string) => void;
}

const CompleteOrderModal: React.FC<CompleteOrderModalProps> = ({ order, onClose, onComplete }) => {
  const [realQuantity, setRealQuantity] = useState(order.requestedQuantity);
  const [wasteQuantity, setWasteQuantity] = useState(0);
  const [wasteReason, setWasteReason] = useState('Rotura de masa al enrollar');
  const [notes, setNotes] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white">Finalizar Orden {order.id}</h3>
            <p className="text-xs text-amber-400 font-medium">{order.productName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onComplete(Number(realQuantity), Number(wasteQuantity), wasteReason, notes);
          }}
          className="space-y-3 text-xs"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Cantidad Real Producida</label>
              <input
                type="number"
                value={realQuantity}
                onChange={(e) => setRealQuantity(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Mermas / Descarte (u)</label>
              <input
                type="number"
                value={wasteQuantity}
                onChange={(e) => setWasteQuantity(Number(e.target.value))}
                className="w-full bg-slate-950 border border-rose-800 rounded-lg px-3 py-2 text-rose-300 font-bold text-sm"
                required
              />
            </div>
          </div>

          {wasteQuantity > 0 && (
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Motivo de Merma</label>
              <select
                value={wasteReason}
                onChange={(e) => setWasteReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="Rotura de masa al enrollar">Rotura de masa al enrollar</option>
                <option value="Deformación de queso / tamaño irregular">Deformación de queso / tamaño irregular</option>
                <option value="Temperatura de freidora / exceso de dorado">Temperatura de freidora / exceso de dorado</option>
                <option value="Recorte de extremos no recuperable">Recorte de extremos no recuperable</option>
                <option value="Otro">Otro motivo</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Notas de la Tanda</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Observaciones de consistencia, textura..."
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg shadow-md shadow-emerald-500/20"
            >
              Guardar & Generar Lote
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface CreateOrderModalProps {
  recipes: ProductionRecipe[];
  onClose: () => void;
  onCreate: (data: {
    recipeId: string;
    productName: string;
    targetDate: string;
    requestedQuantity: number;
    requestedUnit: string;
    productionNotes?: string;
  }) => void;
}

const CreateOrderModal: React.FC<CreateOrderModalProps> = ({ recipes, onClose, onCreate }) => {
  const [selectedRecipeId, setSelectedRecipeId] = useState(recipes[0]?.id || '');
  const [quantity, setQuantity] = useState(recipes[0]?.expectedYield || 500);
  const [targetDate, setTargetDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white">Programar Orden de Cocina</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onCreate({
              recipeId: selectedRecipeId,
              productName: selectedRecipe?.name || 'Producción',
              targetDate,
              requestedQuantity: Number(quantity),
              requestedUnit: selectedRecipe?.outputUnit || 'unidad',
              productionNotes: notes
            });
          }}
          className="space-y-3 text-xs"
        >
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Receta a Elaborar</label>
            <select
              value={selectedRecipeId}
              onChange={(e) => {
                setSelectedRecipeId(e.target.value);
                const r = recipes.find((x) => x.id === e.target.value);
                if (r) setQuantity(r.expectedYield);
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
            >
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} (Rinde: {r.expectedYield} {r.outputUnit})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Cantidad Objetivo</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Fecha de Entrega</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Instrucciones Especiales</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Ej: Preparar para reparto de las 11:00 hs..."
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg"
            >
              Crear Orden
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ReportIncidentModalProps {
  onClose: () => void;
  onReport: (data: {
    type: FactoryIncident['type'];
    severity: FactoryIncident['severity'];
    message: string;
  }) => void;
}

const ReportIncidentModal: React.FC<ReportIncidentModalProps> = ({ onClose, onReport }) => {
  const [type, setType] = useState<FactoryIncident['type']>('falla_maquinaria');
  const [severity, setSeverity] = useState<FactoryIncident['severity']>('media');
  const [message, setMessage] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center">
            <ShieldAlert className="w-4 h-4 text-rose-400 mr-2" />
            Reportar Incidencia en Cocina / Planta
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onReport({ type, severity, message });
          }}
          className="space-y-3 text-xs"
        >
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Tipo de Incidencia</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
            >
              <option value="falla_maquinaria">Falla en Maquinaria / Amasadora / Selladora</option>
              <option value="falta_insumo">Falta Crítica de Insumo o Packaging</option>
              <option value="desvio_temperatura">Problema de Frío / Freezer / Gas</option>
              <option value="calidad_materia_prima">Defecto en Materia Prima Recibida</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Severidad</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
            >
              <option value="baja">Baja — Puede continuar</option>
              <option value="media">Media — Afecta ritmo de producción</option>
              <option value="alta">Alta / Crítica — Parada de producción</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Descripción del Problema</label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Describa el síntoma, ruido, insumo faltante..."
              required
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg"
            >
              Enviar Reporte
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
