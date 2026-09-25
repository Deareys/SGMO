/**
 * SGMO — Tequeños Costa
 * Barra de Navegación Superior con Control de Acceso por Roles (RBAC), Estado de Red y Alertas
 */

import React from 'react';
import {
  Shield,
  ClipboardList,
  Store,
  Wifi,
  WifiOff,
  Bell,
  RefreshCw,
  MapPin,
  Flame,
  AlertTriangle,
  History,
  Coins,
  Settings,
  ChefHat,
  LogOut,
  UserCheck,
  FileText
} from 'lucide-react';
import { UserRole, UserProfile, DailyShift } from '../types';

interface NavbarProps {
  currentUser: UserProfile;
  selectedHouseId: string;
  houses: { id: string; name: string }[];
  onSelectHouse: (houseId: string) => void;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  isOnline: boolean;
  offlineQueueCount: number;
  unreadAlertsCount: number;
  shifts?: DailyShift[];
  onOpenAlerts: () => void;
  onOpenAudit: () => void;
  onResetSeed: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  selectedHouseId,
  houses,
  onSelectHouse,
  activeTab,
  onSelectTab,
  isOnline,
  offlineQueueCount,
  unreadAlertsCount,
  shifts,
  onOpenAlerts,
  onOpenAudit,
  onResetSeed,
  onLogout
}) => {
  const hasAssignedSalesShift = shifts?.some(
    (s) => s.sellerId === currentUser.id && (s.status === 'en_curso' || s.status === 'planificada' || s.status === 'esperando_cierre')
  );
  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return { label: 'Administrador', color: 'bg-rose-950/80 text-rose-300 border-rose-800' };
      case 'coordinator':
        return { label: 'Coordinador', color: 'bg-blue-950/80 text-blue-300 border-blue-800' };
      case 'factory_worker':
        return { label: 'Fábrica / Cocina', color: 'bg-purple-950/80 text-purple-300 border-purple-800' };
      case 'seller':
      default:
        return { label: 'Vendedor', color: 'bg-amber-950/80 text-amber-300 border-amber-800' };
    }
  };

  const roleBadge = getRoleBadge(currentUser.role);

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-lg">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Título del Sistema */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center shadow-md shadow-amber-500/20 text-slate-950 font-black text-xl">
              🌮
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-white flex items-center">
                  SGMO <span className="text-amber-400 ml-1.5 font-medium text-xs sm:text-sm px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20">Tequeños Costa</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Gestión y Monitoreo de Operación Ambulante Costera
              </p>
            </div>
          </div>

          {/* Controles de Sesión, Base y Estado */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            
            {/* Estado de Red / Offline Sync */}
            <div className="flex items-center">
              {isOnline ? (
                <span className="inline-flex items-center text-xs font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-1 rounded-lg">
                  <Wifi className="w-3.5 h-3.5 mr-1" />
                  <span className="hidden md:inline">Online</span>
                </span>
              ) : (
                <span className="inline-flex items-center text-xs font-medium text-rose-400 bg-rose-950/80 border border-rose-800 px-2 py-1 rounded-lg animate-pulse">
                  <WifiOff className="w-3.5 h-3.5 mr-1" />
                  <span>Offline ({offlineQueueCount})</span>
                </span>
              )}
            </div>

            {/* Selector de Base Operativa (para Admin/Coordinador) */}
            {(currentUser.role === 'admin' || currentUser.role === 'coordinator') && (
              <div className="hidden lg:flex items-center bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1">
                <MapPin className="w-3.5 h-3.5 text-amber-400 mr-1.5" />
                <select
                  value={selectedHouseId}
                  onChange={(e) => onSelectHouse(e.target.value)}
                  className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
                >
                  {houses.map((h) => (
                    <option key={h.id} value={h.id} className="bg-slate-900 text-slate-200">
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Perfil del Usuario Activo */}
            <div className="flex items-center space-x-2 bg-slate-800/90 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-left">
              <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                {currentUser.name.charAt(0)}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-bold text-slate-100 leading-tight">
                  {currentUser.name}
                </p>
                <span className={`text-[10px] px-1.5 py-0.2 rounded border font-semibold ${roleBadge.color}`}>
                  {roleBadge.label}
                </span>
              </div>
            </div>

            {/* Botón de Cerrar Sesión */}
            <button
              onClick={onLogout}
              className="flex items-center space-x-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-200 border border-rose-800/60 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors"
              title="Cerrar sesión y volver al ingreso por PIN"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>

            {/* Botón de Auditoría */}
            <button
              onClick={onOpenAudit}
              title="Registro de Auditoría y Trazabilidad"
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors border border-slate-800"
            >
              <History className="w-4 h-4" />
            </button>

            {/* Campana de Alertas */}
            <button
              onClick={onOpenAlerts}
              className="relative p-2 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded-lg transition-colors border border-slate-800"
              title="Centro de Alertas Operativas"
            >
              <Bell className="w-4 h-4" />
              {unreadAlertsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center ring-2 ring-slate-900 animate-bounce">
                  {unreadAlertsCount}
                </span>
              )}
            </button>

            {/* Reset / Demo Helper */}
            <button
              onClick={onResetSeed}
              title="Restaurar datos de prueba a configuración inicial"
              className="hidden sm:flex items-center text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 p-2 rounded-lg border border-slate-800"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

          </div>
        </div>

        {/* Barra de Pestañas / Módulos de Navegación según Rol Autorizado */}
        <nav className="flex space-x-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/60 text-xs font-medium">
          
          {/* Vendedor de Playa */}
          {currentUser.role === 'seller' && (
            <>
              <button
                onClick={() => onSelectTab('seller-terminal')}
                className={`px-3.5 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'seller-terminal'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Mi Terminal de Ventas</span>
              </button>

              <button
                onClick={() => onSelectTab('seller-vouchers')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'seller-vouchers'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Mis Comprobantes</span>
              </button>

              <button
                onClick={() => onSelectTab('reconciliation')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'reconciliation'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Mis Cierres & Comisión</span>
              </button>

              <button
                onClick={() => onSelectTab('fleet')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'fleet'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Reportar Falla / Insumo</span>
              </button>
            </>
          )}

          {/* Operario de Fábrica / Cuadra */}
          {currentUser.role === 'factory_worker' && (
            <>
              <button
                onClick={() => onSelectTab('factory')}
                className={`px-3.5 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'factory'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>Panel de Fábrica & Cocina</span>
              </button>

              <button
                onClick={() => onSelectTab('production')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'production'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Stock de Insumos & Recetas</span>
              </button>

              <button
                onClick={() => onSelectTab('fleet')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'fleet'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Garrafas & Equipamiento</span>
              </button>
            </>
          )}

          {/* Coordinador de Base Operativa */}
          {currentUser.role === 'coordinator' && (
            <>
              <button
                onClick={() => onSelectTab('dashboard')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'dashboard'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Radar & Dashboard</span>
              </button>

              <button
                onClick={() => onSelectTab('planning')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'planning'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Despacho & Asesor IA</span>
              </button>

              <button
                onClick={() => onSelectTab('seller-terminal')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'seller-terminal'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Terminal de Ventas</span>
                {hasAssignedSalesShift && (
                  <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold border border-emerald-500/30 animate-pulse">
                    En Venta
                  </span>
                )}
              </button>

              <button
                onClick={() => onSelectTab('vouchers-repository')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'vouchers-repository'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Galería Comprobantes</span>
              </button>

              <button
                onClick={() => onSelectTab('vouchers')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'vouchers'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Validación IA Comprobantes</span>
              </button>

              <button
                onClick={() => onSelectTab('reconciliation')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'reconciliation'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Cierres & Liquidaciones</span>
              </button>

              <button
                onClick={() => onSelectTab('production')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'production'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Stock Multinivel</span>
              </button>

              <button
                onClick={() => onSelectTab('fleet')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'fleet'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Carritos & Gas</span>
              </button>
            </>
          )}

          {/* Administrador General (acceso total + Configuración Maestro) */}
          {currentUser.role === 'admin' && (
            <>
              <button
                onClick={() => onSelectTab('dashboard')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'dashboard'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Radar & Dashboard</span>
              </button>

              <button
                onClick={() => onSelectTab('planning')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'planning'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Despacho & IA</span>
              </button>

              <button
                onClick={() => onSelectTab('seller-terminal')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'seller-terminal'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Terminal Ventas</span>
              </button>

              <button
                onClick={() => onSelectTab('vouchers-repository')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'vouchers-repository'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Galería Comprobantes</span>
              </button>

              <button
                onClick={() => onSelectTab('vouchers')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'vouchers'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Comprobantes IA</span>
              </button>

              <button
                onClick={() => onSelectTab('reconciliation')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'reconciliation'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Cierres & Liquidaciones</span>
              </button>

              <button
                onClick={() => onSelectTab('factory')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'factory'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>Fábrica & Cocina</span>
              </button>

              <button
                onClick={() => onSelectTab('production')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'production'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Stock Multinivel</span>
              </button>

              <button
                onClick={() => onSelectTab('fleet')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'fleet'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Carritos & Gas</span>
              </button>

              <button
                onClick={() => onSelectTab('costs')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'costs'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Costos & P&L</span>
              </button>

              <button
                onClick={() => onSelectTab('admin-config')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all ${
                  activeTab === 'admin-config'
                    ? 'bg-rose-600 text-white font-bold shadow-md shadow-rose-600/30 ring-1 ring-rose-400'
                    : 'text-rose-300/90 hover:text-white hover:bg-rose-950/60 border border-rose-900/60'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Configuración Maestro</span>
              </button>
            </>
          )}

        </nav>
      </div>
    </header>
  );
};
