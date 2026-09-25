/**
 * SGMO — Tequeños Costa
 * Módulo de Producción, Materias Primas y Trazabilidad de Inventario Multinivel
 */

import React, { useState } from 'react';
import {
  Factory,
  PackagePlus,
  Truck,
  ArrowRight,
  Plus,
  Coins,
  Warehouse,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Sparkles
} from 'lucide-react';
import { AppState, storageService } from '../services/storageService';

interface ProductionInventoryViewProps {
  state: AppState;
}

export const ProductionInventoryView: React.FC<ProductionInventoryViewProps> = ({ state }) => {
  const { rawMaterials, productionBatches, houses, varieties, transfers, materialPurchases } = state;

  // Estados de Modales
  const [showNewBatchModal, setShowNewBatchModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Formulario Nuevo Lote
  const [batchVarietyId, setBatchVarietyId] = useState(varieties[0]?.id || '');
  const [batchUnits, setBatchUnits] = useState(2500);
  const [batchLaborCost, setBatchLaborCost] = useState(120000);
  const [batchEnergyCost, setBatchEnergyCost] = useState(45000);
  const [batchNotes, setBatchNotes] = useState('');

  // Formulario Nueva Compra
  const [purchaseMaterialId, setPurchaseMaterialId] = useState(rawMaterials[0]?.id || '');
  const [purchaseQty, setPurchaseQty] = useState(50);
  const [purchaseUnitCost, setPurchaseUnitCost] = useState(1200);
  const [purchaseSupplier, setPurchaseSupplier] = useState('Distribuidora Costa');

  // Formulario Traslado a Casas
  const [transferTargetHouseId, setTransferTargetHouseId] = useState(houses[0]?.id || '');
  const [transferClasicoQty, setTransferClasicoQty] = useState(500);
  const [transferAhumadoQty, setTransferAhumadoQty] = useState(200);
  const [transferNotes, setTransferNotes] = useState('');

  // Manejar creación de Lote
  const handleCreateBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (batchUnits <= 0) return;

    // Calcular ingredientes estándar requeridos
    const flourQty = Math.round((batchUnits / 50) * 1.0); // 1kg por 50 tequeños
    const cheeseQty = Math.round((batchUnits / 40) * 1.0); // 1kg queso por 40 tequeños
    const oilQty = Math.round((batchUnits / 150) * 1.0); // 1L por 150 tequeños

    storageService.registerProductionBatch({
      varietyId: batchVarietyId,
      unitsProduced: batchUnits,
      laborCost: batchLaborCost,
      energyAndPackagingCost: batchEnergyCost,
      ingredientsUsed: [
        { materialId: 'MAT-HARINA', quantity: flourQty },
        { materialId: 'MAT-QUESO-VEG', quantity: cheeseQty },
        { materialId: 'MAT-ACEITE', quantity: oilQty }
      ],
      notes: batchNotes
    });

    setShowNewBatchModal(false);
    setBatchNotes('');
  };

  // Manejar Compra de Insumos
  const handleCreatePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const material = rawMaterials.find((m) => m.id === purchaseMaterialId);
    if (!material || purchaseQty <= 0) return;

    storageService.addMaterialPurchase({
      date: new Date().toISOString().slice(0, 10),
      materialId: purchaseMaterialId,
      materialName: material.name,
      quantity: purchaseQty,
      unitCost: purchaseUnitCost,
      totalCost: purchaseQty * purchaseUnitCost,
      supplier: purchaseSupplier
    });

    setShowPurchaseModal(false);
  };

  // Manejar Traslado
  const handleCreateTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const items: { varietyId: string; quantity: number }[] = [];
    if (transferClasicoQty > 0) {
      items.push({ varietyId: 'VAR-CLASICO', quantity: transferClasicoQty });
    }
    if (transferAhumadoQty > 0) {
      items.push({ varietyId: 'VAR-AHUMADO', quantity: transferAhumadoQty });
    }

    if (items.length === 0) return;

    storageService.transferToHouse(transferTargetHouseId, items, transferNotes);
    setShowTransferModal(false);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 text-xs font-semibold uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5" />
            <span>Fábrica & Cadena de Distribución</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white mt-1">
            Producción, Materias Primas y Stock Central
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Trazabilidad completa: Compra de insumos ➔ Cocción de lotes ➔ Cámara frigorífica ➔ Despacho a Bases.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowPurchaseModal(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center space-x-1.5 transition-all"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Comprar Insumos</span>
          </button>

          <button
            onClick={() => setShowNewBatchModal(true)}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold rounded-xl shadow-lg shadow-amber-500/20 flex items-center space-x-1.5 transition-all"
          >
            <Factory className="w-4 h-4" />
            <span>Registrar Lote Fabricado</span>
          </button>

          <button
            onClick={() => setShowTransferModal(true)}
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-sky-600/20 flex items-center space-x-1.5 transition-all"
          >
            <Truck className="w-4 h-4" />
            <span>Trasladar a Casas</span>
          </button>
        </div>
      </div>

      {/* 1. Materias Primas e Insumos */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <PackagePlus className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">
              Stock de Materias Primas en Fábrica
            </h2>
          </div>
          <span className="text-xs text-slate-400">{rawMaterials.length} insumos registrados</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {rawMaterials.map((mat) => {
            const isLow = mat.currentStock <= mat.minStockAlert;
            return (
              <div
                key={mat.id}
                className={`bg-slate-950/80 border rounded-xl p-3.5 flex flex-col justify-between transition-all ${
                  isLow ? 'border-rose-500/50 bg-rose-950/10' : 'border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 line-clamp-1">{mat.name}</span>
                    {isLow && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                    )}
                  </div>
                  <div className="text-xl font-black text-white mt-1.5">
                    {mat.currentStock} <span className="text-xs font-normal text-slate-400">{mat.unit}</span>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex justify-between items-center">
                  <span>Costo: ${mat.costPerUnit}/{mat.unit}</span>
                  {isLow ? (
                    <span className="text-rose-400 font-semibold">Reponer</span>
                  ) : (
                    <span className="text-emerald-400 font-medium">Óptimo</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Lotes de Producción y Costo Unitario Real */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Factory className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">
              Lotes Fabricados & Costo Unitario por Tequeño
            </h2>
          </div>
          <span className="text-xs text-slate-400">Trazabilidad por lote</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">Lote ID</th>
                <th className="py-3 px-3">Fecha</th>
                <th className="py-3 px-3">Variedad</th>
                <th className="py-3 px-3">Producidos</th>
                <th className="py-3 px-3">En Cámara Central</th>
                <th className="py-3 px-3">Costo Total Lote</th>
                <th className="py-3 px-3">Costo Unitario Real</th>
                <th className="py-3 px-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {productionBatches.map((batch) => (
                <tr key={batch.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-amber-300">{batch.id}</td>
                  <td className="py-3 px-3 text-slate-400">{batch.date}</td>
                  <td className="py-3 px-3 font-semibold text-white">{batch.varietyName}</td>
                  <td className="py-3 px-3 font-bold text-white">{batch.unitsProduced.toLocaleString()} u</td>
                  <td className="py-3 px-3">
                    <span className={`font-semibold ${batch.remainingUnitsInCentral > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {batch.remainingUnitsInCentral.toLocaleString()} u
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono">${batch.totalBatchCost.toLocaleString()}</td>
                  <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                    ${(batch.unitCostCalculated ?? 0).toFixed(2)} /u
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      batch.status === 'en_camara_central'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        : batch.status === 'distribuido'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {batch.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Traslados hacia las Casas/Bases Operativas */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Truck className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-bold text-white">
              Historial de Traslados a Casas (Cadena de Frío)
            </h2>
          </div>
        </div>

        <div className="space-y-2.5">
          {transfers.map((trf) => (
            <div
              key={trf.id}
              className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center font-mono text-xs font-bold">
                  🚚
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white text-xs">{trf.fromLocation}</span>
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <span className="font-bold text-amber-300 text-xs">{trf.toHouseName}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {trf.items.map((it) => `${it.quantity} u de ${it.varietyName}`).join(' • ')}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 text-right">
                <div>
                  <span className="text-[10px] text-slate-400 block">{trf.date}</span>
                  <span className="text-[11px] font-semibold text-emerald-400 flex items-center justify-end">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {trf.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL: Registrar Lote de Producción */}
      {showNewBatchModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center">
                <Factory className="w-5 h-5 text-amber-400 mr-2" />
                Registrar Nuevo Lote Fabricado
              </h3>
              <button
                onClick={() => setShowNewBatchModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Variedad de Tequeño</label>
                <select
                  value={batchVarietyId}
                  onChange={(e) => setBatchVarietyId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  {varieties.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Cantidad a Producir (u)</label>
                  <input
                    type="number"
                    value={batchUnits}
                    onChange={(e) => setBatchUnits(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-bold"
                    min="100"
                    step="50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Mano de Obra ($)</label>
                  <input
                    type="number"
                    value={batchLaborCost}
                    onChange={(e) => setBatchLaborCost(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Energía, Gas y Packaging ($)</label>
                <input
                  type="number"
                  value={batchEnergyCost}
                  onChange={(e) => setBatchEnergyCost(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Insumos a descontar de stock:</span>
                  <span className="text-white font-medium">Harina ~{Math.round(batchUnits/50)}kg, Queso ~{Math.round(batchUnits/40)}kg</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-bold pt-1 border-t border-slate-800">
                  <span>Costo Unitario Estimado:</span>
                  <span>~${((batchLaborCost + batchEnergyCost + (batchUnits * 140)) / (batchUnits || 1)).toFixed(2)} por tequeño</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Notas del Lote</label>
                <input
                  type="text"
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  placeholder="Ej: Masa con hidratación extra para días ventosos"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewBatchModal(false)}
                  className="px-4 py-2 bg-slate-800 text-xs font-semibold text-slate-300 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20"
                >
                  Crear y Almacenar Lote
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Registrar Compra de Materias Primas */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center">
                <Plus className="w-5 h-5 text-emerald-400 mr-2" />
                Registrar Compra de Insumos
              </h3>
              <button onClick={() => setShowPurchaseModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreatePurchase} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Insumo</label>
                <select
                  value={purchaseMaterialId}
                  onChange={(e) => {
                    setPurchaseMaterialId(e.target.value);
                    const m = rawMaterials.find((item) => item.id === e.target.value);
                    if (m) setPurchaseUnitCost(m.costPerUnit);
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                >
                  {rawMaterials.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Cantidad Comprada</label>
                  <input
                    type="number"
                    value={purchaseQty}
                    onChange={(e) => setPurchaseQty(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-bold"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Costo Unitario ($)</label>
                  <input
                    type="number"
                    value={purchaseUnitCost}
                    onChange={(e) => setPurchaseUnitCost(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Proveedor</label>
                <input
                  type="text"
                  value={purchaseSupplier}
                  onChange={(e) => setPurchaseSupplier(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs flex justify-between items-center">
                <span className="text-slate-400">Total a Pagar:</span>
                <span className="text-emerald-400 font-bold text-sm">${(purchaseQty * purchaseUnitCost).toLocaleString()}</span>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPurchaseModal(false)}
                  className="px-4 py-2 bg-slate-800 text-xs text-slate-300 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl"
                >
                  Ingresar a Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Trasladar de Cámara Central a Casas */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center">
                <Truck className="w-5 h-5 text-sky-400 mr-2" />
                Despacho Frigorífico a Casa / Base
              </h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Casa de Destino</label>
                <select
                  value={transferTargetHouseId}
                  onChange={(e) => setTransferTargetHouseId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                >
                  {houses.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Tequeño Clásico (u)</label>
                  <input
                    type="number"
                    value={transferClasicoQty}
                    onChange={(e) => setTransferClasicoQty(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-bold"
                    step="50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Tequeño Ahumado (u)</label>
                  <input
                    type="number"
                    value={transferAhumadoQty}
                    onChange={(e) => setTransferAhumadoQty(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-bold"
                    step="50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Notas de Flete / Precinto</label>
                <input
                  type="text"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="Ej: Flete refrigerado a -18°C con termógrafo"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 bg-slate-800 text-xs text-slate-300 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold rounded-xl"
                >
                  Confirmar Traslado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
