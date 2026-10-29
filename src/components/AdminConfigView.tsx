/**
 * SGMO — Tequeños Costa
 * Panel de Configuración General Exclusivo del Administrador
 * Gestión integral de Carritos, Productos, Casas, Insumos, Proveedores, Recetas y Usuarios
 */

import React, { useState } from 'react';
import {
  Settings,
  Truck,
  Package,
  Home,
  Layers,
  ChefHat,
  Users,
  Building2,
  Plus,
  Edit2,
  Power,
  DollarSign,
  AlertCircle,
  Save,
  CheckCircle2,
  Trash2,
  Info,
  Calendar,
  X,
  FileText,
  Percent,
  Sliders,
  ShieldCheck,
  Key,
  Eye,
  EyeOff,
  Award,
  Smartphone,
  QrCode,
  Sparkles
} from 'lucide-react';
import { IssuePasswordActivationModal } from './PasswordManagement';
import { validateAccountPassword, MIN_PASSWORD_LENGTH, MAX_NEW_PASSWORD_LENGTH } from '../shared/passwordPolicy';
import { CommissionTiersTab } from './CommissionTiersTab';
import { MercadoPagoTestLabModal } from './MercadoPagoTestLabModal';
import { AppState, storageService } from '../services/storageService';
import { checkMercadoPagoConfigStatus } from '../services/aiValidationService';
import {
  SellingCart,
  ProductVariety,
  OperationalHouse,
  RawMaterial,
  SupplyCategory,
  Supplier,
  ProductionRecipe,
  UserProfile,
  UserRole,
  SystemConfig
} from '../types';

interface AdminConfigViewProps {
  state: AppState;
}

type AdminTab =
  | 'params'
  | 'commissions'
  | 'carts'
  | 'products'
  | 'houses'
  | 'supplies'
  | 'recipes'
  | 'suppliers'
  | 'users';

export const AdminConfigView: React.FC<AdminConfigViewProps> = ({ state }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('params');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [stockHouseId, setStockHouseId] = useState('');
  const [stockVarietyId, setStockVarietyId] = useState('');
  const [stockQuantity, setStockQuantity] = useState(0);
  const [stockReason, setStockReason] = useState('');
  const [stockSaving, setStockSaving] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');

  // Estados para Modales de Creación / Edición
  const [editingCart, setEditingCart] = useState<SellingCart | null>(null);
  const [isCreatingCart, setIsCreatingCart] = useState(false);

  const [editingVariety, setEditingVariety] = useState<ProductVariety | null>(null);
  const [isCreatingVariety, setIsCreatingVariety] = useState(false);

  const [editingHouse, setEditingHouse] = useState<OperationalHouse | null>(null);
  const [isCreatingHouse, setIsCreatingHouse] = useState(false);

  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);
  const [isCreatingMaterial, setIsCreatingMaterial] = useState(false);

  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);

  const [editingRecipe, setEditingRecipe] = useState<ProductionRecipe | null>(null);
  const [isCreatingRecipe, setIsCreatingRecipe] = useState(false);

  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [activationUser, setActivationUser] = useState<UserProfile | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Estado temporal para Parámetros Globales
  const [globalParams, setGlobalParams] = useState<SystemConfig>(state.systemConfig);
  const [mpStatus, setMpStatus] = useState<any | null>(null);
  const [showTestLabModal, setShowTestLabModal] = useState(false);

  React.useEffect(() => {
    checkMercadoPagoConfigStatus().then(setMpStatus);
  }, []);

  const notifySuccess = (msg: string) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  React.useEffect(() => { setGlobalParams(state.systemConfig); }, [state.systemConfig]);
  const reportConfigError = (error: unknown) => setConfigError(error instanceof Error ? error.message : 'No se confirmó el cambio.');

  // Guardar Parámetros Globales
  const handleSaveGlobalParams = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigError(null);
    try { await storageService.updateSystemConfig(globalParams);
    notifySuccess('Parámetros confirmados por el servidor'); } catch (error) { reportConfigError(error); }
  };

  return (
    <div className="space-y-6 pb-16">
      {configError && <p role="alert" className="bg-rose-100 text-rose-900 border-2 border-rose-500 p-4 rounded-xl">{configError}</p>}
      
      {/* Encabezado Principal */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center">
                Configuración General del Sistema
                <span className="ml-3 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/80">
                  Exclusivo Administrador
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Administración integral de parámetros maestros, carritos, productos, bases, insumos y usuarios.
              </p>
            </div>
          </div>
        </div>

        {saveSuccessMsg && (
          <div className="flex items-center space-x-2 bg-emerald-950/90 border border-emerald-700 text-emerald-300 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* Selector de Submódulos de Configuración */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-slate-800 text-xs font-medium">
        <button
          onClick={() => setActiveTab('params')}
          className={`px-4 py-2.5 rounded-xl flex items-center space-x-2 transition-all whitespace-nowrap ${
            activeTab === 'params'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Parámetros & Vivienda</span>
        </button>

        <button
          onClick={() => setActiveTab('commissions')}
          className={`px-4 py-2.5 rounded-xl flex items-center space-x-2 transition-all whitespace-nowrap ${
            activeTab === 'commissions'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Tramos de Comisión ({(state.systemConfig?.commissionTiers || []).length})</span>
        </button>

        <button
          onClick={() => setActiveTab('carts')}
          className={`px-4 py-2.5 rounded-xl flex items-center space-x-2 transition-all whitespace-nowrap ${
            activeTab === 'carts'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Carritos ({state.carts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2.5 rounded-xl flex items-center space-x-2 transition-all whitespace-nowrap ${
            activeTab === 'products'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Productos & Combos ({state.varieties.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('houses')}
          className={`px-4 py-2.5 rounded-xl flex items-center space-x-2 transition-all whitespace-nowrap ${
            activeTab === 'houses'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Bases Operativas ({state.houses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('supplies')}
          className={`px-4 py-2.5 rounded-xl flex items-center space-x-2 transition-all whitespace-nowrap ${
            activeTab === 'supplies'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Insumos & Stock ({state.rawMaterials.length})</span>
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
          <span>Recetas Maestras ({state.recipes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2.5 rounded-xl flex items-center space-x-2 transition-all whitespace-nowrap ${
            activeTab === 'suppliers'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Proveedores ({state.suppliers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 rounded-xl flex items-center space-x-2 transition-all whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Usuarios & Roles ({state.users.length})</span>
        </button>
      </div>

      {/* 1. TAB: PARÁMETROS GENERALES & VIVIENDA */}
      {activeTab === 'params' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center">
              <DollarSign className="w-5 h-5 text-amber-400 mr-2" />
              Parámetros Operativos y Costos de Vivienda
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Estos valores impactan directamente en las liquidaciones automáticas al cierre de jornada y alertas del sistema.
            </p>
          </div>

          <form onSubmit={handleSaveGlobalParams} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4 space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Costo Diario de Vivienda por Persona ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  value={globalParams.housingCostPerPersonDaily}
                  onChange={(e) =>
                    setGlobalParams({ ...globalParams, housingCostPerPersonDaily: Number(e.target.value) })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Se descuenta de la comisión bruta diaria de cada vendedor alojado, salvo exención individual configurada.
              </p>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300">
                  Comisión Base de Respaldo (%)
                </label>
                <button
                  type="button"
                  onClick={() => setActiveTab('commissions')}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center space-x-1 cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Configurar Tramos Dinámicos</span>
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm">%</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={globalParams.defaultCommissionRate}
                  onChange={(e) =>
                    setGlobalParams({ ...globalParams, defaultCommissionRate: Number(e.target.value) })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Las liquidaciones calculan el porcentaje según el escalafón de tramos de venta alcanzado. Este valor actúa como respaldo si no existieran tramos activos.
              </p>
            </div>

            {/* Política Escalonada de Mermas y Faltantes Injustificados */}
            <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  Política de Descuento por Merma y Faltantes Injustificados
                </label>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Protección contra mermas excesivas o regalos no autorizados. Los tequeños justificados (caídas accidentales o degustación) tienen tarifa reducida; los excedentes injustificados se cobran a precio combo.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-300">
                    Tolerancia Justificada (≤ x unidades)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={globalParams.wasteToleranceThreshold ?? 3}
                    onChange={(e) =>
                      setGlobalParams({
                        ...globalParams,
                        wasteToleranceThreshold: Math.max(0, Number(e.target.value) || 0)
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400 font-mono"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Cantidad límite justificada (ej: 3 u)</span>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-300">
                    Descuento si ≤ x unidades ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-slate-400 text-xs">$</span>
                    <input
                      type="number"
                      min="0"
                      value={globalParams.wastePenaltyRateBelowOrEqual ?? 500}
                      onChange={(e) =>
                        setGlobalParams({
                          ...globalParams,
                          wastePenaltyRateBelowOrEqual: Math.max(0, Number(e.target.value) || 0)
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-6 pr-2 py-2 text-sm text-white focus:outline-none focus:border-amber-400 font-mono"
                      required
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">Tarifa tolerada o costo (ej: $500 o $0)</span>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-300">
                    Descuento si &gt; x unidades ($ Combo)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-slate-400 text-xs">$</span>
                    <input
                      type="number"
                      min="0"
                      value={globalParams.wastePenaltyRateAbove ?? 2500}
                      onChange={(e) =>
                        setGlobalParams({
                          ...globalParams,
                          wastePenaltyRateAbove: Math.max(0, Number(e.target.value) || 0),
                          deductionRatePerMissingUnit: Math.max(0, Number(e.target.value) || 0)
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-6 pr-2 py-2 text-sm text-amber-300 focus:outline-none focus:border-amber-400 font-mono font-bold"
                      required
                    />
                  </div>
                  <span className="text-[10px] text-amber-400/80">Tarifa injustificada combo (ej: $2.500)</span>
                </div>
              </div>

              {/* Ejemplo dinámico de aplicación */}
              <div className="p-2.5 bg-slate-900/80 border border-slate-700/50 rounded-lg text-[11px] text-slate-300 flex items-center gap-2">
                <span className="text-amber-400 font-bold">ℹ Regla Activa:</span>
                <span>
                  Merma ≤ {globalParams.wasteToleranceThreshold ?? 3} u = <strong>${(globalParams.wastePenaltyRateBelowOrEqual ?? 500).toLocaleString()}/u</strong>.
                  Excedente &gt; {globalParams.wasteToleranceThreshold ?? 3} u = <strong>${(globalParams.wastePenaltyRateAbove ?? 2500).toLocaleString()}/u</strong> (tarifa combo).
                </span>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4 space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Umbral de Alerta de Stock Mínimo en Base (unidades)
              </label>
              <input
                type="number"
                value={globalParams.lowStockAlertThreshold}
                onChange={(e) =>
                  setGlobalParams({ ...globalParams, lowStockAlertThreshold: Number(e.target.value) })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                required
              />
              <p className="text-[11px] text-slate-400">
                Genera advertencia preventiva cuando el stock en freezer desciende de este nivel.
              </p>
            </div>

            {/* SECCIÓN: Configuración de Mercado Pago & Cobros Digitales */}
            <div className="md:col-span-2 bg-gradient-to-r from-sky-950/40 via-slate-900 to-slate-950 border border-sky-800/40 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                      <span>Cobros Digitales & Mercado Pago Oficial</span>
                      {mpStatus && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                          mpStatus.configured
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {mpStatus.configured ? 'Token Live Conectado' : 'Modo Simulación / Prueba'}
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Datos mostrados a los vendedores para dictar o generar QR a los compradores en la playa.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowTestLabModal(true)}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-amber-500/20 flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Laboratorio de Pruebas MP</span>
                  </button>

                  <div className="text-[11px] text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                    Consulta: <strong className="text-white">API Oficial (server.ts)</strong>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Alias Oficial de Mercado Pago
                  </label>
                  <input
                    type="text"
                    value={globalParams.mercadoPagoConfig?.alias || 'tequenos.costa.mp'}
                    onChange={(e) =>
                      setGlobalParams({
                        ...globalParams,
                        mercadoPagoConfig: {
                          alias: e.target.value,
                          cvu: globalParams.mercadoPagoConfig?.cvu || '',
                          accountHolder: globalParams.mercadoPagoConfig?.accountHolder || 'Tequeños Costa SRL'
                        }
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-sky-300 focus:outline-none focus:border-sky-400 font-bold"
                    placeholder="ej: tequenos.costa.mp"
                    required
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    El alias que los clientes ingresan en su app MP
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    CVU de la Cuenta
                  </label>
                  <input
                    type="text"
                    value={globalParams.mercadoPagoConfig?.cvu || '0000003100084592019482'}
                    onChange={(e) =>
                      setGlobalParams({
                        ...globalParams,
                        mercadoPagoConfig: {
                          alias: globalParams.mercadoPagoConfig?.alias || 'tequenos.costa.mp',
                          cvu: e.target.value,
                          accountHolder: globalParams.mercadoPagoConfig?.accountHolder || 'Tequeños Costa SRL'
                        }
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-400"
                    placeholder="22 dígitos"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Por si pagan por transferencia bancaria tradicional
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Titular / Razón Social
                  </label>
                  <input
                    type="text"
                    value={globalParams.mercadoPagoConfig?.accountHolder || 'Tequeños Costa SRL'}
                    onChange={(e) =>
                      setGlobalParams({
                        ...globalParams,
                        mercadoPagoConfig: {
                          alias: globalParams.mercadoPagoConfig?.alias || 'tequenos.costa.mp',
                          cvu: globalParams.mercadoPagoConfig?.cvu || '',
                          accountHolder: e.target.value
                        }
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400 font-semibold"
                    placeholder="ej: Tequeños Costa SRL"
                    required
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Nombre que aparece en el comprobante
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <span className="font-bold text-amber-400 flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Seguridad de Credenciales de Mercado Pago:</span>
                </span>
                <p>
                  Por estrictas normas de seguridad, el <strong>Token de Acceso de Mercado Pago</strong> (<code>MERCADOPAGO_ACCESS_TOKEN</code>) nunca se almacena en el navegador ni en la base de datos visible; se configura como variable de entorno en el servidor. Todas las consultas de verificación y cruce se procesan de forma privada en el backend (<code>server.ts</code>).
                </p>
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center space-x-2 transition-colors shadow-lg shadow-amber-500/20"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Parámetros Maestros</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. TAB: TRAMOS DE COMISIÓN / RECOMPENSAS */}
      {activeTab === 'commissions' && (
        <CommissionTiersTab
          tiers={state.systemConfig?.commissionTiers || []}
          housingCostDaily={state.systemConfig?.housingCostPerPersonDaily ?? 8000}
          onAddTier={async (tierData) => {
            await storageService.addCommissionTier(tierData);
            notifySuccess(`Nuevo tramo "${tierData.name}" agregado con éxito`);
          }}
          onUpdateTier={async (tierId, updates) => {
            await storageService.updateCommissionTier(tierId, updates);
            notifySuccess('Tramo de comisión actualizado');
          }}
          onDeleteTier={async (tierId) => {
            await storageService.deleteCommissionTier(tierId);
            notifySuccess('Tramo eliminado');
          }}
          onToggleTier={async (tierId) => {
            await storageService.toggleCommissionTier(tierId);
            notifySuccess('Estado del tramo actualizado');
          }}
          onResetDefaults={async () => {
            await storageService.resetCommissionTiersToDefault();
            notifySuccess('Se restablecieron los tramos iniciales sugeridos (10%, 20%, 30%)');
          }}
        />
      )}

      {/* 3. TAB: GESTIÓN DE CARRITOS */}
      {activeTab === 'carts' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center">
                <Truck className="w-5 h-5 text-amber-400 mr-2" />
                Parque de Carritos de Venta Ambulante
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Alta, edición de datos, cambio de estado, asignación de ubicación y notas internas.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingCart(null);
                setIsCreatingCart(true);
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center space-x-1.5 text-xs transition-colors self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Carrito</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {state.carts.map((cart) => {
              const house = state.houses.find((h) => h.id === cart.houseId);
              const seller = state.users.find((u) => u.id === cart.currentSellerId);
              return (
                <div
                  key={cart.id}
                  className={`border rounded-xl p-4 transition-all ${
                    cart.isActive !== false
                      ? 'bg-slate-800/60 border-slate-700'
                      : 'bg-slate-950/60 border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white text-sm">{cart.code}</span>
                        {cart.isActive === false && (
                          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                            Inactivo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-amber-300/90 font-medium mt-0.5">{cart.model}</p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        cart.status === 'operativo'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          : cart.status === 'en_revision'
                          ? 'bg-amber-950 text-amber-300 border border-amber-700'
                          : 'bg-rose-950 text-rose-300 border border-rose-700'
                      }`}
                    >
                      {cart.status}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs text-slate-300 border-t border-slate-700/60 pt-3">
                    <p className="flex items-center text-slate-400">
                      <Home className="w-3.5 h-3.5 text-slate-500 mr-1.5" />
                      Base: <span className="text-white ml-1">{house?.name || 'Sin asignar'}</span>
                    </p>
                    {cart.locationNotes && (
                      <p className="flex items-start text-slate-400">
                        <FileText className="w-3.5 h-3.5 text-slate-500 mr-1.5 mt-0.5 flex-shrink-0" />
                        <span>Ubicación: <strong className="text-slate-200">{cart.locationNotes}</strong></span>
                      </p>
                    )}
                    {cart.notes && (
                      <div className="bg-slate-900/80 border border-slate-700/60 rounded-lg p-2 text-[11px] text-amber-200/90 mt-2">
                        <strong className="text-amber-400">Notas internas:</strong> {cart.notes}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs">
                    <button
                      onClick={() => setEditingCart(cart)}
                      className="text-amber-400 hover:text-amber-300 font-medium flex items-center space-x-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={async () => {
                        try { await storageService.toggleCartActive(cart.id);
                        notifySuccess(`Estado del carrito ${cart.code} confirmado`); } catch(error) { reportConfigError(error); }
                      }}
                      className={`flex items-center space-x-1 ${
                        cart.isActive !== false ? 'text-rose-400 hover:text-rose-300' : 'text-emerald-400 hover:text-emerald-300'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{cart.isActive !== false ? 'Desactivar' : 'Activar'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. TAB: PRODUCTOS Y VARIEDADES */}
      {activeTab === 'products' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center">
                <Package className="w-5 h-5 text-amber-400 mr-2" />
                Catálogo de Productos, Variedades y Precios de Combos
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Ajuste de precio unitario, combos (trío, clásico, docena), recetas asociadas y activación.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingVariety(null);
                setIsCreatingVariety(true);
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center space-x-1.5 text-xs transition-colors self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Variedad</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {state.varieties.map((v) => (
              <div
                key={v.id}
                className={`border rounded-xl p-4 transition-all ${
                  v.isActive !== false ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-950/60 border-slate-800 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base">{v.name}</h3>
                    <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                      {v.category || 'Tequeño'}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      v.isAvailable
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        : 'bg-rose-950 text-rose-300 border border-rose-700'
                    }`}
                  >
                    {v.isAvailable ? 'Disponible' : 'Agotado'}
                  </span>
                </div>

                <p className="text-xs text-slate-400 mt-2 line-clamp-2">{v.description}</p>

                <div className="mt-3 bg-slate-900/80 border border-slate-700/60 rounded-lg p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Precio Individual:</span>
                    <strong className="text-white">${v.basePriceIndividual.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Combo Trío (3u):</span>
                    <strong className="text-amber-300">${v.comboPrices.combo3.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Combo Clásico (6u):</span>
                    <strong className="text-amber-300">${v.comboPrices.combo6.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Combo Docena (12u):</span>
                    <strong className="text-amber-300">${v.comboPrices.combo12.toLocaleString()}</strong>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs">
                  <button
                    onClick={() => setEditingVariety(v)}
                    className="text-amber-400 hover:text-amber-300 font-medium flex items-center space-x-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Editar Precios / Datos</span>
                  </button>
                  <button
                    onClick={async () => {
                      try { await storageService.toggleVarietyActive(v.id);
                      notifySuccess(`Variedad ${v.name} confirmada`); } catch(error) { reportConfigError(error); }
                    }}
                    className={`flex items-center space-x-1 ${
                      v.isActive !== false ? 'text-rose-400 hover:text-rose-300' : 'text-emerald-400 hover:text-emerald-300'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{v.isActive !== false ? 'Desactivar' : 'Activar'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'houses' && <div className="bg-white text-slate-950 border-2 border-slate-300 rounded-xl p-5 space-y-4">
        <h3 className="font-bold">Conteo físico / ingreso de mercadería en la casa</h3>
        <p className="text-sm">Ingresá la cantidad total contada para esa variedad, no sólo el incremento. El motivo queda registrado. El despacho y las devoluciones actualizan este saldo automáticamente.</p>
        <form className="grid sm:grid-cols-2 gap-3" onSubmit={async event => {
          event.preventDefault(); if (stockSaving) return; setStockSaving(true); setConfigError(null);
          try { await storageService.adjustHouseStock(stockHouseId, stockVarietyId, stockQuantity, stockReason); notifySuccess('Conteo físico confirmado'); setStockReason(''); }
          catch (error) { reportConfigError(error); } finally { setStockSaving(false); }
        }}>
          <select aria-label="Casa del conteo" required value={stockHouseId} onChange={event=>setStockHouseId(event.target.value)} className="border-2 p-3 rounded-lg"><option value="">Elegir casa</option>{state.houses.filter(house=>house.isActive).map(house=><option key={house.id} value={house.id}>{house.name}</option>)}</select>
          <select aria-label="Variedad del conteo" required value={stockVarietyId} onChange={event=>setStockVarietyId(event.target.value)} className="border-2 p-3 rounded-lg"><option value="">Elegir variedad</option>{state.varieties.filter(variety=>variety.isActive).map(variety=><option key={variety.id} value={variety.id}>{variety.name}</option>)}</select>
          <label>Unidades totales contadas<input type="number" required min="0" step="1" value={stockQuantity} onChange={event=>setStockQuantity(Number(event.target.value))} className="border-2 p-3 rounded-lg w-full" /></label>
          <label>Motivo<input required maxLength={2000} value={stockReason} onChange={event=>setStockReason(event.target.value)} placeholder="Ingreso de lote / inventario físico" className="border-2 p-3 rounded-lg w-full" /></label>
          <button disabled={stockSaving} type="submit" className="bg-emerald-600 text-white font-bold min-h-12 rounded-lg">{stockSaving?'Confirmando...':'Guardar conteo real'}</button>
        </form>
        <h3 className="font-bold">Zonas de despacho</h3>
        <p className="text-sm">Creá las zonas reales antes del primer despacho.</p>
        <ul>{state.zones.map(zone=><li key={zone.id}>{zone.name}</li>)}</ul>
        <form className="flex gap-2" onSubmit={async event=>{event.preventDefault();setConfigError(null);try {await storageService.saveZones([...state.zones,{id:`ZONE-${crypto.randomUUID()}`,name:newZoneName.trim(),description:'',touristAffluence:'media',avgDailySalesUnits:0,recommendedStartUnits:0}]);setNewZoneName('');notifySuccess('Zona confirmada');} catch(error){reportConfigError(error);} }}>
          <input required maxLength={120} aria-label="Nombre de zona nueva" value={newZoneName} onChange={event=>setNewZoneName(event.target.value)} className="border-2 p-3 rounded-lg" placeholder="Localidad / calles" /><button type="submit" className="bg-amber-400 p-3 rounded-lg font-bold">Agregar zona</button>
        </form>
      </div>}

      {/* 4. TAB: BASES OPERATIVAS */}
      {activeTab === 'houses' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center">
                <Home className="w-5 h-5 text-amber-400 mr-2" />
                Bases Operativas y Casas de Alojamiento
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Gestión de depósitos intermedios, capacidad frigorífica y asignación de personal residente.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingHouse(null);
                setIsCreatingHouse(true);
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center space-x-1.5 text-xs transition-colors self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Base Operativa</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {state.houses.map((house) => {
              const residents = state.users.filter((u) => house.residentUserIds?.includes(u.id));
              const totalStock = (house.currentStock || []).reduce((acc, s) => acc + (s.quantity || 0), 0);
              return (
                <div
                  key={house.id}
                  className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-white text-base">{house.name}</h3>
                      <p className="text-xs text-slate-400">{house.address}</p>
                    </div>
                    <span className="text-xs font-bold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2.5 py-1 rounded-lg">
                      Cap: {house.freezerCapacityUnits.toLocaleString()} u
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-900/80 p-3 rounded-lg border border-slate-700/60">
                    <div>
                      <span className="text-slate-400 block">Stock en Freezer:</span>
                      <strong className="text-emerald-400 text-sm">{totalStock.toLocaleString()} u</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Costo Fijo Diario:</span>
                      <strong className="text-white text-sm">${(house.fixedCostDaily || 0).toLocaleString()}</strong>
                    </div>
                  </div>

                  <div className="text-xs">
                    <span className="text-slate-400 font-semibold block mb-1.5">Personal Residente / Asignado:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {residents.length > 0 ? (
                        residents.map((r) => (
                          <span
                            key={r.id}
                            className="bg-slate-900 border border-slate-700 text-slate-200 px-2 py-0.5 rounded-md text-[11px]"
                          >
                            {r.name} ({r.role === 'coordinator' ? 'Coord' : 'Vendedor'})
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 italic">Sin residentes asignados</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs">
                    <button
                      onClick={() => setEditingHouse(house)}
                      className="text-amber-400 hover:text-amber-300 font-medium flex items-center space-x-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Editar Base</span>
                    </button>
                    <span className="text-[11px] text-slate-400">
                      Garrafas Disp: {house.consumablesStock?.gasTanksAvailable ?? 0}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. TAB: INSUMOS Y MATERIAS PRIMAS */}
      {activeTab === 'supplies' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center">
                <Layers className="w-5 h-5 text-amber-400 mr-2" />
                Insumos, Materias Primas e Historial de Precios
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Control de harina, queso vegano, vegetales, aceites, envases y garrafas de gas con seguimiento de costos.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingMaterial(null);
                setIsCreatingMaterial(true);
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center space-x-1.5 text-xs transition-colors self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Insumo</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold border-b border-slate-700">
                <tr>
                  <th className="p-3">Insumo</th>
                  <th className="p-3">Categoría</th>
                  <th className="p-3">Stock Actual</th>
                  <th className="p-3">Costo Unitario</th>
                  <th className="p-3">Proveedor</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {state.rawMaterials.map((mat) => (
                  <tr key={mat.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-semibold text-white">
                      {mat.name}
                      {mat.currentStock <= mat.minStockAlert && (
                        <span className="ml-2 text-[10px] bg-rose-950 text-rose-300 px-2 py-0.5 rounded-full border border-rose-800">
                          Bajo Stock
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-300">{mat.categoryName || 'General'}</td>
                    <td className="p-3 font-medium text-slate-200">
                      {mat.currentStock} {mat.unit}
                      <span className="text-slate-500 block text-[10px]">Mín: {mat.minStockAlert} {mat.unit}</span>
                    </td>
                    <td className="p-3 text-amber-300 font-bold">
                      ${mat.costPerUnit.toLocaleString()} / {mat.unit}
                    </td>
                    <td className="p-3 text-slate-300">{mat.supplier || 'N/A'}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setEditingMaterial(mat)}
                        className="text-amber-400 hover:text-amber-300 font-medium px-2 py-1 bg-slate-800 rounded-lg"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. TAB: RECETAS MAESTRAS DE PRODUCCIÓN */}
      {activeTab === 'recipes' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center">
                <ChefHat className="w-5 h-5 text-amber-400 mr-2" />
                Recetas Maestras y Escandallos de Fábrica
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Fórmulas estándar para tequeños, masas y salsas caseras (mayonesa de zanahoria, alioli de zucchini, etc.).
              </p>
            </div>
            <button
              onClick={() => {
                setEditingRecipe(null);
                setIsCreatingRecipe(true);
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center space-x-1.5 text-xs transition-colors self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Receta</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {state.recipes.map((rec) => (
              <div key={rec.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base">{rec.name}</h3>
                    <span className="text-xs text-amber-400 uppercase font-semibold">
                      Tipo: {rec.type}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-200 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700">
                    Rendimiento: {rec.expectedYield} {rec.outputUnit}
                  </span>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-700/60 space-y-1.5 text-xs">
                  <span className="text-slate-400 font-semibold block">Ingredientes requeridos por tanda:</span>
                  {rec.ingredients.map((ing, idx) => (
                    <div key={idx} className="flex justify-between text-slate-300">
                      <span>• {ing.materialName}</span>
                      <strong className="text-white">{ing.quantityRequired} {ing.unit}</strong>
                    </div>
                  ))}
                </div>

                {rec.instructions && (
                  <p className="text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <strong className="text-slate-300">Procedimiento:</strong> {rec.instructions}
                  </p>
                )}

                <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs">
                  <button
                    onClick={() => setEditingRecipe(rec)}
                    className="text-amber-400 hover:text-amber-300 font-medium flex items-center space-x-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Editar Fórmula</span>
                  </button>
                  <span className="text-[11px] text-slate-400">
                    Mano de obra est: ${rec.estimatedLaborCost.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. TAB: PROVEEDORES */}
      {activeTab === 'suppliers' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center">
                <Building2 className="w-5 h-5 text-amber-400 mr-2" />
                Directorio Oficial de Proveedores
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Contactos comerciales, rubros abastecidos, condiciones de pago y notas operativas.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingSupplier(null);
                setIsCreatingSupplier(true);
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center space-x-1.5 text-xs transition-colors self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Proveedor</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {state.suppliers.map((sup) => (
              <div key={sup.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-3">
                <div>
                  <h3 className="font-bold text-white text-base">{sup.name}</h3>
                  <p className="text-xs text-amber-400">{sup.contactName}</p>
                </div>

                <div className="space-y-1 text-xs text-slate-300">
                  <p>📞 {sup.phone}</p>
                  <p>✉️ {sup.email}</p>
                  <p>📍 {sup.address}</p>
                </div>

                {sup.notes && (
                  <p className="text-[11px] text-slate-400 bg-slate-900/80 p-2 rounded border border-slate-700/60">
                    {sup.notes}
                  </p>
                )}

                <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs">
                  <button
                    onClick={() => setEditingSupplier(sup)}
                    className="text-amber-400 hover:text-amber-300 font-medium flex items-center space-x-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Editar Proveedor</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. TAB: USUARIOS, ROLES Y EXENCIÓN DE VIVIENDA */}
      {activeTab === 'users' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center">
                <Users className="w-5 h-5 text-amber-400 mr-2" />
                Gestión de Personal, Roles y Exención de Vivienda
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Administración de cuentas, contraseñas personales, permisos, comisión y base asignada.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingUser(null);
                setIsCreatingUser(true);
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center space-x-1.5 text-xs transition-colors self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Usuario</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {state.users.map((u) => {
              const house = state.houses.find((h) => h.id === u.assignedHouseId);
              return (
                <div
                  key={u.id}
                  className={`border rounded-xl p-5 space-y-3 transition-all ${
                    u.isActive !== false ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-950/60 border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-white text-base">{u.name}</h3>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                        u.role === 'admin'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : u.role === 'coordinator'
                          ? 'bg-blue-950 text-blue-300 border border-blue-800'
                          : u.role === 'factory_worker'
                          ? 'bg-purple-950 text-purple-300 border border-purple-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {u.role === 'admin'
                        ? 'Administrador'
                        : u.role === 'coordinator'
                        ? 'Coordinador'
                        : u.role === 'factory_worker'
                        ? 'Fábrica'
                        : 'Vendedor'}
                    </span>
                  </div>

                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-700/60 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Teléfono:</span>
                      <strong className="text-white">{u.phone || 'N/A'}</strong>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Base Asignada:</span>
                      <strong className="text-amber-300">{house?.name || 'Central'}</strong>
                    </div>
                    {u.role === 'seller' && (
                      <div className="flex justify-between text-slate-300">
                        <span>Comisión sobre Ventas:</span>
                        <strong className="text-emerald-400">{((u.commissionRate ?? 0.20) * 100).toFixed(0)}%</strong>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-300">
                      <span>Exento Costo Vivienda:</span>
                      <strong className={u.housingCostExempt ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                        {u.housingCostExempt ? 'Sí (Exento)' : 'No (Descuenta)'}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Acceso:</span>
                      <strong className="text-slate-200">{u.hasPassword ? 'Contraseña configurada' : 'Pendiente de contraseña'}</strong>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs">
                    <button
                      onClick={() => setEditingUser(u)}
                      className="text-amber-400 hover:text-amber-300 font-medium flex items-center space-x-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Editar Usuario</span>
                    </button>
                    <button type="button" disabled={u.isActive === false} onClick={() => setActivationUser(u)} className="min-h-12 text-sky-300 underline font-bold disabled:opacity-50" aria-label={`Activar o restablecer contraseña de ${u.name}`}>Contraseña</button>
                    {u.id !== state.currentUser?.id && (
                      <button
                        onClick={async () => {
                          try {
                            await storageService.toggleUserActive(u.id);
                            notifySuccess(`Usuario ${u.name} modificado`);
                          } catch (error) {
                            alert(error instanceof Error ? error.message : 'No se pudo confirmar el cambio.');
                          }
                        }}
                        className={`flex items-center space-x-1 ${
                          u.isActive !== false ? 'text-rose-400 hover:text-rose-300' : 'text-emerald-400 hover:text-emerald-300'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{u.isActive !== false ? 'Desactivar' : 'Activar'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activationUser && <IssuePasswordActivationModal user={activationUser} onClose={() => setActivationUser(null)} />}

      {/* --- MODALES DE EDICIÓN / CREACIÓN --- */}

      {/* Modal Carrito */}
      {(isCreatingCart || editingCart) && (
        <CartModal
          cart={editingCart}
          houses={state.houses}
          onClose={() => {
            setIsCreatingCart(false);
            setEditingCart(null);
          }}
          onSave={async (cartData) => {
            if (editingCart) {
              await storageService.updateCart(editingCart.id, cartData);
              notifySuccess(`Carrito ${editingCart.code} actualizado`);
            } else {
              await storageService.createCart(cartData as any);
              notifySuccess('Nuevo carrito agregado al parque móvil');
            }
            setIsCreatingCart(false);
            setEditingCart(null);
          }}
        />
      )}

      {/* Modal Producto */}
      {(isCreatingVariety || editingVariety) && (
        <VarietyModal
          variety={editingVariety}
          onClose={() => {
            setIsCreatingVariety(false);
            setEditingVariety(null);
          }}
          onSave={async (varData) => {
            if (editingVariety) {
              await storageService.updateVariety(editingVariety.id, varData);
              notifySuccess(`Producto ${editingVariety.name} actualizado`);
            } else {
              await storageService.createVariety(varData as any);
              notifySuccess('Nueva variedad registrada en catálogo');
            }
            setIsCreatingVariety(false);
            setEditingVariety(null);
          }}
        />
      )}

      {/* Modal Base Operativa */}
      {(isCreatingHouse || editingHouse) && (
        <HouseModal
          house={editingHouse}
          users={state.users}
          onClose={() => {
            setIsCreatingHouse(false);
            setEditingHouse(null);
          }}
          onSave={async (houseData) => {
            if (editingHouse) {
              await storageService.updateHouse(editingHouse.id, houseData);
              notifySuccess(`Base operativa ${editingHouse.name} actualizada`);
            } else {
              await storageService.createHouse(houseData as any);
              notifySuccess('Nueva base operativa creada con éxito');
            }
            setIsCreatingHouse(false);
            setEditingHouse(null);
          }}
        />
      )}

      {/* Modal Insumo */}
      {(isCreatingMaterial || editingMaterial) && (
        <MaterialModal
          material={editingMaterial}
          categories={state.supplyCategories}
          suppliers={state.suppliers}
          onClose={() => {
            setIsCreatingMaterial(false);
            setEditingMaterial(null);
          }}
          onSave={(matData) => {
            if (editingMaterial) {
              storageService.updateRawMaterial(editingMaterial.id, matData);
              notifySuccess(`Insumo ${editingMaterial.name} actualizado`);
            } else {
              storageService.createRawMaterial(matData as any);
              notifySuccess('Nuevo insumo registrado');
            }
            setIsCreatingMaterial(false);
            setEditingMaterial(null);
          }}
        />
      )}

      {/* Modal Usuario */}
      {(isCreatingUser || editingUser) && (
        <UserModal
          user={editingUser}
          houses={state.houses}
          onClose={() => {
            setIsCreatingUser(false);
            setEditingUser(null);
          }}
          onSave={async (userData) => {
            if (editingUser) {
              await storageService.updateUser(editingUser.id, userData);
              notifySuccess(`Perfil de ${editingUser.name} actualizado`);
            } else {
              await storageService.createUser(userData as any);
              notifySuccess('Nuevo usuario creado con éxito');
            }
            setIsCreatingUser(false);
            setEditingUser(null);
          }}
        />
      )}

      {/* Modal Receta */}
      {(isCreatingRecipe || editingRecipe) && (
        <RecipeModal
          recipe={editingRecipe}
          materials={state.rawMaterials}
          varieties={state.varieties}
          onClose={() => {
            setIsCreatingRecipe(false);
            setEditingRecipe(null);
          }}
          onSave={(recData) => {
            if (editingRecipe) {
              storageService.updateRecipe(editingRecipe.id, recData);
              notifySuccess(`Receta ${editingRecipe.name} actualizada`);
            } else {
              storageService.createRecipe(recData as any);
              notifySuccess('Nueva receta maestra creada con éxito');
            }
            setIsCreatingRecipe(false);
            setEditingRecipe(null);
          }}
        />
      )}

      {/* Modal Proveedor */}
      {(isCreatingSupplier || editingSupplier) && (
        <SupplierModal
          supplier={editingSupplier}
          categories={state.supplyCategories}
          onClose={() => {
            setIsCreatingSupplier(false);
            setEditingSupplier(null);
          }}
          onSave={(supData) => {
            if (editingSupplier) {
              storageService.updateSupplier(editingSupplier.id, supData);
              notifySuccess(`Proveedor ${editingSupplier.name} actualizado`);
            } else {
              storageService.createSupplier(supData as any);
              notifySuccess('Nuevo proveedor registrado');
            }
            setIsCreatingSupplier(false);
            setEditingSupplier(null);
          }}
        />
      )}

      {/* Modal Laboratorio de Pruebas Mercado Pago */}
      <MercadoPagoTestLabModal
        isOpen={showTestLabModal}
        onClose={() => setShowTestLabModal(false)}
        varieties={state.varieties}
      />

    </div>
  );
};

// --- SUBCOMPONENTES DE MODALES ---

interface CartModalProps {
  cart: SellingCart | null;
  houses: OperationalHouse[];
  onClose: () => void;
  onSave: (data: Partial<SellingCart>) => Promise<void>;
}

const CartModal: React.FC<CartModalProps> = ({ cart, houses, onClose, onSave }) => {
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    code: cart?.code || '',
    model: cart?.model || 'Modelo Playa Pro 2026 - Ruedas Globo',
    houseId: cart?.houseId || houses[0]?.id || '',
    status: cart?.status || 'operativo',
    locationNotes: cart?.locationNotes || '',
    notes: cart?.notes || ''
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white">
            {cart ? `Editar ${cart.code}` : 'Nuevo Carrito de Venta'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {saveError && <p role="alert" className="text-rose-300">{saveError}</p>}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (saving) return;
            setSaving(true); setSaveError(null);
            try { await onSave(formData); } catch (error) { setSaveError(error instanceof Error ? error.message : "No se guardó el cambio."); } finally { setSaving(false); }
          }}
          className="space-y-3 text-xs"
        >
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Código / Nombre Identificador</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Ej: Carrito C-05 (Norte Gamma)"
              required
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Modelo / Especificación</label>
            <input
              type="text"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Base Asignada</label>
              <select
                value={formData.houseId}
                onChange={(e) => setFormData({ ...formData, houseId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              >
                {houses.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Estado</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="operativo">Operativo</option>
                <option value="en_revision">En Revisión</option>
                <option value="fuera_de_servicio">Fuera de Servicio</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Ubicación Asignada / Recorrido</label>
            <input
              type="text"
              value={formData.locationNotes}
              onChange={(e) => setFormData({ ...formData, locationNotes: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Ej: Bajada Calle 54 a Balnearios Norte"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Notas Internas (visibles para coordinadores)</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Detalles mecánicos, mantenimiento reciente, etc."
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
              type="submit" disabled={saving}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg"
            >
              Guardar Carrito
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface VarietyModalProps {
  variety: ProductVariety | null;
  onClose: () => void;
  onSave: (data: Partial<ProductVariety>) => Promise<void>;
}

const VarietyModal: React.FC<VarietyModalProps> = ({ variety, onClose, onSave }) => {
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: variety?.name || '',
    category: variety?.category || 'tequeno',
    description: variety?.description || '',
    basePriceIndividual: variety?.basePriceIndividual || 1500,
    combo3: variety?.comboPrices.combo3 || 4000,
    combo6: variety?.comboPrices.combo6 || 7500,
    combo12: variety?.comboPrices.combo12 || 14000,
    isAvailable: variety?.isAvailable !== false
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white">
            {variety ? `Editar ${variety.name}` : 'Nueva Variedad de Producto'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {saveError && <p role="alert" className="text-rose-300">{saveError}</p>}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (saving) return;
            setSaving(true); setSaveError(null);
            try { await onSave({
              name: formData.name,
              category: formData.category as any,
              description: formData.description,
              basePriceIndividual: Number(formData.basePriceIndividual),
              isAvailable: formData.isAvailable,
              comboPrices: {
                combo3: Number(formData.combo3),
                combo6: Number(formData.combo6),
                combo12: Number(formData.combo12)
              }
            }); } catch (error) { setSaveError(error instanceof Error ? error.message : "No se guardó el cambio."); } finally { setSaving(false); }
          }}
          className="space-y-3 text-xs"
        >
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Nombre del Producto</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Ej: Tequeño Ahumado & Finas Hierbas"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Categoría</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="tequeno">Tequeño</option>
                <option value="aderezo">Aderezo / Salsa</option>
                <option value="bebida">Bebida</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Precio Individual ($)</label>
              <input
                type="number"
                value={formData.basePriceIndividual}
                onChange={(e) => setFormData({ ...formData, basePriceIndividual: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Trío (3u)</label>
              <input
                type="number"
                value={formData.combo3}
                onChange={(e) => setFormData({ ...formData, combo3: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Clásico (6u)</label>
              <input
                type="number"
                value={formData.combo6}
                onChange={(e) => setFormData({ ...formData, combo6: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Docena (12u)</label>
              <input
                type="number"
                value={formData.combo12}
                onChange={(e) => setFormData({ ...formData, combo12: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Descripción / Relleno</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Ingredientes clave, punto de fundido, notas alérgenos..."
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
              type="submit" disabled={saving}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg"
            >
              Guardar Variedad
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface HouseModalProps {
  house: OperationalHouse | null;
  users: UserProfile[];
  onClose: () => void;
  onSave: (data: Partial<OperationalHouse>) => Promise<void>;
}

const HouseModal: React.FC<HouseModalProps> = ({ house, users, onClose, onSave }) => {
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: house?.name || '',
    address: house?.address || '',
    freezerCapacityUnits: house?.freezerCapacityUnits ?? 0,
    fixedCostDaily: house?.fixedCostDaily ?? 0,
    residentUserIds: Array.isArray(house?.residentUserIds) ? house.residentUserIds : [],
    coordinatorIds: Array.isArray(house?.coordinatorIds) ? house.coordinatorIds : []
  });

  const toggleResident = (userId: string) => {
    const list = formData.residentUserIds || [];
    if (list.includes(userId)) {
      setFormData({
        ...formData,
        residentUserIds: list.filter((id) => id !== userId)
      });
    } else {
      setFormData({
        ...formData,
        residentUserIds: [...list, userId]
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white">
            {house ? `Editar ${house.name}` : 'Nueva Base Operativa'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {saveError && <p role="alert" className="text-rose-300">{saveError}</p>}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (saving) return;
            setSaving(true); setSaveError(null);
            try { await onSave(formData); } catch (error) { setSaveError(error instanceof Error ? error.message : "No se guardó el cambio."); } finally { setSaving(false); }
          }}
          className="space-y-3 text-xs"
        >
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Nombre de la Base</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Ej: Base Operativa Centro — Calle 30"
              required
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Dirección / Referencia</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Av. Costanera & Calle 30"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Capacidad Freezer (u)</label>
              <input
                type="number"
                value={formData.freezerCapacityUnits}
                onChange={(e) => setFormData({ ...formData, freezerCapacityUnits: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Costo Fijo Diario ($)</label>
              <input
                type="number"
                value={formData.fixedCostDaily}
                onChange={(e) => setFormData({ ...formData, fixedCostDaily: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">Personal Residente en esta Base</label>
            <div className="max-h-32 overflow-y-auto space-y-1 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              {users.map((u) => (
                <label key={u.id} className="flex items-center space-x-2 text-slate-300 hover:text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.residentUserIds?.includes(u.id))}
                    onChange={() => toggleResident(u.id)}
                    className="rounded border-slate-700 text-amber-500 focus:ring-0"
                  />
                  <span>{u.name} ({u.role})</span>
                </label>
              ))}
            </div>
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
              type="submit" disabled={saving}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg"
            >
              Guardar Base
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface MaterialModalProps {
  material: RawMaterial | null;
  categories: SupplyCategory[];
  suppliers: Supplier[];
  onClose: () => void;
  onSave: (data: Partial<RawMaterial>) => void;
}

const MaterialModal: React.FC<MaterialModalProps> = ({ material, categories, suppliers, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: material?.name || '',
    categoryId: material?.categoryId || categories[0]?.id || '',
    unit: material?.unit || 'kg',
    currentStock: material?.currentStock || 0,
    minStockAlert: material?.minStockAlert || 50,
    costPerUnit: material?.costPerUnit || 1000,
    supplierId: material?.supplierId || suppliers[0]?.id || '',
    supplier: material?.supplier || suppliers[0]?.name || ''
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white">
            {material ? `Editar ${material.name}` : 'Nuevo Insumo / Materia Prima'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const cat = categories.find((c) => c.id === formData.categoryId);
            const sup = suppliers.find((s) => s.id === formData.supplierId);
            onSave({
              ...formData,
              categoryName: cat?.name || 'General',
              supplier: sup?.name || formData.supplier,
              currentStock: Number(formData.currentStock),
              minStockAlert: Number(formData.minStockAlert),
              costPerUnit: Number(formData.costPerUnit)
            });
          }}
          className="space-y-3 text-xs"
        >
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Nombre del Insumo</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Ej: Harina 0000 Especial"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Categoría</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Unidad de Medida</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="kg">Kilogramos (kg)</option>
                <option value="litro">Litros (l)</option>
                <option value="unidad">Unidades (u)</option>
                <option value="paquete">Paquetes (pq)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Stock Actual</label>
              <input
                type="number"
                value={formData.currentStock}
                onChange={(e) => setFormData({ ...formData, currentStock: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                required
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Alerta Mínimo</label>
              <input
                type="number"
                value={formData.minStockAlert}
                onChange={(e) => setFormData({ ...formData, minStockAlert: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                required
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Costo Unit ($)</label>
              <input
                type="number"
                value={formData.costPerUnit}
                onChange={(e) => setFormData({ ...formData, costPerUnit: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Proveedor Habitual</label>
            <select
              value={formData.supplierId}
              onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
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
              Guardar Insumo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface UserModalProps {
  user: UserProfile | null;
  houses: OperationalHouse[];
  onClose: () => void;
  onSave: (data: Partial<UserProfile> & { password?: string }) => Promise<void>;
}

const UserModal: React.FC<UserModalProps> = ({ user, houses, onClose, onSave }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [formData, setFormData] = useState({
    name: user?.name || '',
    userCode: user?.userCode || '',
    email: user?.email || '',
    phone: user?.phone || '',
    role: user?.role || ('seller' as UserRole),
    password: '',
    assignedHouseId: user ? (user.assignedHouseId || '') : (houses[0]?.id || ''),
    commissionRate: user?.commissionRate ?? 0.20,
    housingCostExempt: !!user?.housingCostExempt,
    notes: user?.notes || ''
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full my-auto p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white">
            {user ? `Editar a ${user.name}` : 'Nuevo Usuario / Personal'}
          </h3>
          <button onClick={onClose}
              disabled={isSaving} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (isSaving) return;
            if (!formData.userCode.trim()) {
              alert('El código de usuario es obligatorio (ej: VEND-05, COORD-03, ADM-02).');
              return;
            }
            const { password, ...profile } = formData;
            if ((!user || formData.role !== user.role) && !password) {
              setSaveError('Asigná una contraseña para habilitar el acceso de esta cuenta.'); return;
            }
            if (password) {
              const policy = validateAccountPassword(password, [formData.userCode, formData.email]);
              if (!policy.isValid) { setSaveError(policy.error || 'Contraseña inválida.'); return; }
              if (password !== passwordConfirmation) { setSaveError('Las contraseñas no coinciden.'); return; }
            } else if (passwordConfirmation) { setSaveError('Ingresá la nueva contraseña y su confirmación.'); return; }
            setIsSaving(true);
            setSaveError(null);
            try {
              await onSave({
                ...profile,
                name: formData.name.trim(),
                email: formData.email.trim().toLowerCase(),
                ...(password ? { password } : {}),
                userCode: formData.userCode.trim().toUpperCase(),
                commissionRate: Number(formData.commissionRate)
              });
            } catch (error) {
              setSaveError(error instanceof Error ? error.message : 'No se pudo guardar el usuario.');
            } finally {
              setIsSaving(false);
            }
          }}
          className="space-y-3 text-xs"
        >
          {saveError && <p role="alert" className="text-red-300">{saveError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Nombre Completo</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                placeholder="Ej: Marcos Benavídez"
                maxLength={120}
                required
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Código Único</label>
              <input
                type="text"
                value={formData.userCode}
                onChange={(e) => setFormData({ ...formData, userCode: e.target.value.toUpperCase() })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                placeholder="Ej: VEND-05"
                maxLength={32}
                pattern="[A-Za-z0-9_-]+"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Correo Electrónico</label>
              <input
                type="email"
                maxLength={160}
                autoComplete="off"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Teléfono Móvil</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Rol Operativo</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium"
              >
                <option value="admin">Administrador</option>
                <option value="coordinator">Coordinador de Base</option>
                <option value="seller">Vendedor de Playa</option>
                <option value="factory_worker">Personal de Fábrica / Cuadra</option>
              </select>
            </div>

            <div>
              <p className="rounded-lg border border-slate-500 bg-slate-800 p-3 text-slate-100">El usuario ingresa con su código o correo y su contraseña. Después puede cambiarla desde «Mi contraseña».</p>
            </div>
          </div>

          <fieldset className="space-y-3 rounded-xl border border-slate-600 p-3">
            <legend className="px-1 font-bold text-slate-100">Contraseña de acceso</legend>
            <p className="text-slate-200">{user ? 'Dejá ambos campos vacíos para conservar la contraseña actual. Una nueva contraseña cierra las sesiones anteriores.' : 'Asigná una contraseña inicial. La persona puede cambiarla después desde su cuenta.'}</p>
            <label className="block font-semibold text-slate-100">{user ? 'Nueva contraseña' : 'Contraseña inicial'}
              <input type="password" autoComplete="new-password" value={formData.password} disabled={isSaving} required={!user || formData.role !== user.role} minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_NEW_PASSWORD_LENGTH} onChange={event => setFormData({ ...formData, password: event.target.value })} className="mt-1 w-full min-h-12 rounded-lg border border-slate-500 bg-white px-3 text-base text-slate-950" />
            </label>
            <label className="block font-semibold text-slate-100">Repetir contraseña
              <input type="password" autoComplete="new-password" value={passwordConfirmation} disabled={isSaving} required={!!formData.password} minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_NEW_PASSWORD_LENGTH} onChange={event => setPasswordConfirmation(event.target.value)} className="mt-1 w-full min-h-12 rounded-lg border border-slate-500 bg-white px-3 text-base text-slate-950" />
            </label>
            <p className="text-slate-200">Mínimo {MIN_PASSWORD_LENGTH} caracteres; podés usar una frase. La contraseña anterior no se puede consultar.</p>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Base Asignada</label>
              <select
                value={formData.assignedHouseId}
                onChange={(e) => setFormData({ ...formData, assignedHouseId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="">Sin base asignada</option>
                {houses.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Comisión Ventas (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={formData.commissionRate}
                onChange={(e) => setFormData({ ...formData, commissionRate: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-200 block">Exento de Descuento de Vivienda</span>
              <span className="text-[11px] text-slate-400">Si está marcado, no se le deducirá el costo de alojamiento diario</span>
            </div>
            <input
              type="checkbox"
              checked={formData.housingCostExempt}
              onChange={(e) => setFormData({ ...formData, housingCostExempt: e.target.checked })}
              className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-0"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg"
            >
              {isSaving ? 'Guardando…' : 'Guardar Usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface RecipeModalProps {
  recipe: ProductionRecipe | null;
  materials: RawMaterial[];
  varieties: ProductVariety[];
  onClose: () => void;
  onSave: (data: Partial<ProductionRecipe>) => void;
}

const RecipeModal: React.FC<RecipeModalProps> = ({ recipe, materials, varieties, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: recipe?.name || '',
    type: recipe?.type || ('tequenos' as ProductionRecipe['type']),
    varietyId: recipe?.varietyId || varieties[0]?.id || '',
    outputUnit: recipe?.outputUnit || 'unidad',
    expectedYield: recipe?.expectedYield || 500,
    estimatedLaborCost: recipe?.estimatedLaborCost || 24000,
    estimatedEnergyPackagingCost: recipe?.estimatedEnergyPackagingCost || 9000,
    instructions: recipe?.instructions || ''
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white">
            {recipe ? `Editar ${recipe.name}` : 'Nueva Receta de Producción'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave({
              ...formData,
              expectedYield: Number(formData.expectedYield),
              estimatedLaborCost: Number(formData.estimatedLaborCost),
              estimatedEnergyPackagingCost: Number(formData.estimatedEnergyPackagingCost),
              ingredients: recipe?.ingredients || [
                { materialId: materials[0]?.id || 'MAT-HARINA', materialName: materials[0]?.name || 'Harina', quantityRequired: 10, unit: 'kg' }
              ]
            });
          }}
          className="space-y-3 text-xs"
        >
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Nombre de la Receta</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Ej: Mayonesa de Zanahoria Artesanal (20 kg)"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Tipo de Elaboración</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="tequenos">Tequeños</option>
                <option value="aderezos_salsas">Aderezos & Salsas</option>
                <option value="masa_base">Masa Base</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Rendimiento Esperado</label>
              <input
                type="number"
                value={formData.expectedYield}
                onChange={(e) => setFormData({ ...formData, expectedYield: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Instrucciones y Control de Calidad</label>
            <textarea
              rows={3}
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Pasos de cocción, temperaturas, envasado..."
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
              Guardar Receta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface SupplierModalProps {
  supplier: Supplier | null;
  categories: SupplyCategory[];
  onClose: () => void;
  onSave: (data: Partial<Supplier>) => void;
}

const SupplierModal: React.FC<SupplierModalProps> = ({ supplier, categories, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: supplier?.name || '',
    contactName: supplier?.contactName || '',
    phone: supplier?.phone || '',
    email: supplier?.email || '',
    address: supplier?.address || '',
    notes: supplier?.notes || ''
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white">
            {supplier ? `Editar ${supplier.name}` : 'Nuevo Proveedor'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(formData);
          }}
          className="space-y-3 text-xs"
        >
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Razón Social / Proveedor</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Ej: Molinos del Plata SA"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Nombre de Contacto</label>
              <input
                type="text"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Teléfono</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Email</label>
              <input
                type="email"
                maxLength={160}
                autoComplete="off"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Dirección</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Notas / Días de Entrega</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Frecuencia semanal, plazos de pago..."
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
              Guardar Proveedor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
