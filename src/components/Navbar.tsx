/**
 * SGMO — Tequeños Costa
 * Barra de Navegación Superior de Alto Contraste Solar con Soporte Mobile-First
 * Permite operar bajo luz solar directa sin reflejos oscuros y colapsa en móvil para no robar espacio
 */

import React, { useState } from 'react';
import {
  Store,
  Wifi,
  WifiOff,
  Bell,
  RefreshCw,
  MapPin,
  Flame,
  History,
  Coins,
  Settings,
  ChefHat,
  LogOut,
  FileText,
  Volume2,
  VolumeX,
  Menu,
  X,
  ShieldCheck,
  ChevronRight,
  ClipboardList,
  Sparkles,
  BarChart3
} from 'lucide-react';
import { UserRole, UserProfile, DailyShift } from '../types';
import { soundAlerts } from '../utils/soundAlerts';

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSoundOn, setIsSoundOn] = useState(soundAlerts.isEnabled());

  const handleToggleSound = () => {
    const nextState = !isSoundOn;
    soundAlerts.setEnabled(nextState);
    setIsSoundOn(nextState);
    if (nextState) {
      soundAlerts.playTransferAlertSound();
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return { label: 'Administrador', color: 'bg-rose-100 text-rose-800 border-rose-300' };
      case 'coordinator':
        return { label: 'Coordinador', color: 'bg-blue-100 text-blue-800 border-blue-300' };
      case 'factory_worker':
        return { label: 'Fábrica / Cocina', color: 'bg-purple-100 text-purple-800 border-purple-300' };
      case 'seller':
      default:
        return { label: 'Vendedor', color: 'bg-amber-100 text-amber-900 border-amber-300' };
    }
  };

  const roleBadge = getRoleBadge(currentUser.role);

  // Mapeo de pestañas disponibles por rol
  const getNavItems = () => {
    if (currentUser.role === 'seller') {
      return [
        { id: 'seller-terminal', label: 'Terminal de Ventas', icon: Store },
        { id: 'seller-vouchers', label: 'Mis Comprobantes', icon: FileText },
        { id: 'reconciliation', label: 'Mis Cierres & Comisión', icon: Coins },
        { id: 'fleet', label: 'Reportar Falla / Insumo', icon: Flame }
      ];
    }
    if (currentUser.role === 'factory_worker') {
      return [
        { id: 'factory', label: 'Panel de Fábrica', icon: ChefHat },
        { id: 'production', label: 'Lotes & Materias Primas', icon: FileText },
        { id: 'fleet', label: 'Mantenimiento de Planta', icon: Flame }
      ];
    }
    // Coordinador y Administrador
    const items = [
      { id: 'dashboard', label: 'Tablero General', icon: BarChart3 },
      { id: 'planning', label: 'Despacho & Asesor IA', icon: ClipboardList },
      { id: 'seller-terminal', label: 'Terminal de Ventas', icon: Store },
      { id: 'vouchers', label: 'Validación IA', icon: Sparkles },
      { id: 'vouchers-repository', label: 'Galería Comprobantes', icon: FileText },
      { id: 'reconciliation', label: 'Cierres & Arqueo', icon: Coins },
      { id: 'production', label: 'Stock & Producción', icon: ChefHat },
      { id: 'fleet', label: 'Flota de Carritos', icon: Flame }
    ];
    if (currentUser.role === 'admin') {
      items.push(
        { id: 'costs', label: 'Costos & Rentabilidad', icon: Coins },
        { id: 'admin-config', label: 'Configuración', icon: Settings }
      );
    }
    return items;
  };

  const navItems = getNavItems();
  const currentNavItem = navItems.find((n) => n.id === activeTab) || navItems[0];
  const CurrentIcon = currentNavItem?.icon || Store;

  const handleSelectTabMobile = (tabId: string) => {
    onSelectTab(tabId);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b-2 border-slate-200 text-slate-900 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          
          {/* =========================================================
              BARRA PRINCIPAL (Compacta en Móvil: h-14 / 56px)
              ========================================================= */}
          <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
            
            {/* Logo y Botón de Menú Móvil */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="flex items-center space-x-2 p-1 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer group"
                title="Abrir menú de navegación"
              >
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-400 border border-amber-500 flex items-center justify-center text-slate-950 font-black text-lg sm:text-xl shadow-sm">
                  🌮
                </div>
                <div className="text-left">
                  <div className="flex items-center space-x-1">
                    <span className="font-black text-sm sm:text-base text-slate-950 tracking-tight">
                      SGMO
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                      Costa
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium hidden sm:block">
                    Tequeños Costa
                  </span>
                </div>
              </button>

              {/* Título de la Pantalla Activa en Móvil */}
              <div className="sm:hidden flex items-center pl-1 border-l border-slate-200">
                <span className="text-xs font-black text-slate-800 truncate max-w-[130px] flex items-center">
                  <CurrentIcon className="w-3.5 h-3.5 mr-1 text-amber-600 shrink-0" />
                  <span className="truncate">{currentNavItem?.label}</span>
                </span>
              </div>
            </div>

            {/* Controles del Lado Derecho */}
            <div className="flex items-center space-x-1.5 sm:space-x-2.5">
              
              {/* Estado Online / Offline */}
              <div className="flex items-center">
                {isOnline ? (
                  <span className="inline-flex items-center text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-lg">
                    <Wifi className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    <span className="hidden md:inline">Online</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center text-[11px] font-bold text-rose-800 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded-lg animate-pulse">
                    <WifiOff className="w-3.5 h-3.5 mr-1 text-rose-600" />
                    <span>Offline ({offlineQueueCount})</span>
                  </span>
                )}
              </div>

              {/* Selector de Base Operativa (Solo Desktop) */}
              {(currentUser.role === 'admin' || currentUser.role === 'coordinator') && (
                <div className="hidden lg:flex items-center bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-600 mr-1.5" />
                  <select
                    value={selectedHouseId}
                    onChange={(e) => onSelectHouse(e.target.value)}
                    className="bg-transparent text-xs text-slate-800 font-semibold focus:outline-none cursor-pointer"
                  >
                    {houses.map((h) => (
                      <option key={h.id} value={h.id} className="bg-white text-slate-900">
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Perfil del Usuario Activo (Desktop) */}
              <div className="hidden sm:flex items-center space-x-2 bg-slate-100 border border-slate-300 rounded-xl px-2.5 py-1 text-left">
                <div className="w-6 h-6 rounded-lg bg-amber-400 text-slate-950 font-black flex items-center justify-center text-xs">
                  {currentUser.name.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900 leading-tight">
                    {currentUser.name}
                  </p>
                  <span className={`text-[9px] px-1 py-0.2 rounded border font-bold ${roleBadge.color}`}>
                    {roleBadge.label}
                  </span>
                </div>
              </div>

              {/* Botón de Alertas Acústicas (Admin / Coordinador) */}
              {(currentUser.role === 'admin' || currentUser.role === 'coordinator') && (
                <button
                  type="button"
                  onClick={handleToggleSound}
                  className={`p-1.5 sm:p-2 rounded-xl transition-colors border cursor-pointer ${
                    isSoundOn
                      ? 'text-amber-800 bg-amber-100 border-amber-300 hover:bg-amber-200'
                      : 'text-slate-400 bg-slate-100 border-slate-300 hover:text-slate-600'
                  }`}
                  title={isSoundOn ? 'Alertas sonoras activas (clic para silenciar)' : 'Alertas silenciadas (clic para activar)'}
                >
                  {isSoundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              )}

              {/* Campana de Alertas Operativas */}
              <button
                type="button"
                onClick={onOpenAlerts}
                className="relative p-1.5 sm:p-2 text-slate-700 hover:text-amber-600 hover:bg-slate-100 rounded-xl transition-colors border border-slate-300 cursor-pointer"
                title="Centro de Alertas"
              >
                <Bell className="w-4 h-4" />
                {unreadAlertsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-[10px] font-black text-white rounded-full flex items-center justify-center ring-2 ring-white animate-bounce">
                    {unreadAlertsCount}
                  </span>
                )}
              </button>

              {/* Botón Auditoría (Desktop) */}
              <button
                type="button"
                onClick={onOpenAudit}
                title="Trazabilidad y Auditoría"
                className="hidden sm:flex p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border border-slate-300 cursor-pointer"
              >
                <History className="w-4 h-4" />
              </button>

              {/* Botón Salir (Desktop) */}
              <button
                type="button"
                onClick={onLogout}
                className="hidden sm:flex items-center space-x-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-600" />
                <span>Salir</span>
              </button>

              {/* Botón Menú Hamburguesa Móvil */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="sm:hidden p-2 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
                aria-label="Abrir Menú"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5 text-rose-600" /> : <Menu className="w-5 h-5 text-slate-900" />}
              </button>

            </div>
          </div>

          {/* =========================================================
              BARRA DE PESTAÑAS SOLO EN ESCRITORIO (Desktop Horizontal)
              ========================================================= */}
          <nav className="hidden sm:flex space-x-1.5 overflow-x-auto py-2 border-t border-slate-200 text-xs font-semibold scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-400 text-slate-950 font-black border border-amber-500 shadow-sm'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

        </div>
      </header>

      {/* =========================================================
          MENÚ DESPLEGABLE MÓVIL (Slide-down Fullscreen Drawer)
          Liberador del viewport en celulares
          ========================================================= */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm sm:hidden flex flex-col animate-fadeIn">
          <div className="bg-white border-b-2 border-slate-200 w-full p-4 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            
            {/* Header del Menú Móvil */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-400 border border-amber-500 flex items-center justify-center text-slate-950 font-black text-xl shadow-sm">
                  🌮
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-950">Menú SGMO Costa</h3>
                  <div className="flex items-center space-x-2 text-xs text-slate-600">
                    <span className="font-bold text-slate-900">{currentUser.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded border font-bold ${roleBadge.color}`}>
                      {roleBadge.label}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector de Base en Móvil (Admin / Coordinador) */}
            {(currentUser.role === 'admin' || currentUser.role === 'coordinator') && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Base Operativa Activa:
                </span>
                <select
                  value={selectedHouseId}
                  onChange={(e) => onSelectHouse(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                >
                  {houses.map((h) => (
                    <option key={h.id} value={h.id}>
                      📍 {h.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Lista de Vistas y Módulos Disponibles */}
            <div className="space-y-1 pt-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-2 block mb-1">
                Módulos del Sistema
              </span>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectTabMobile(item.id)}
                    className={`w-full p-3 rounded-xl flex items-center justify-between text-left text-xs font-black transition-all cursor-pointer ${
                      isActive
                        ? 'bg-amber-400 text-slate-950 border-2 border-amber-500 shadow-sm'
                        : 'bg-slate-50 border border-slate-200 text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-600'}`} />
                      <span className="text-sm">{item.label}</span>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                  </button>
                );
              })}
            </div>

            {/* Accesos de Utilidad Inferiores */}
            <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenAudit();
                }}
                className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <History className="w-4 h-4 text-slate-600" />
                <span>Auditoría</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onLogout();
                }}
                className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-600" />
                <span>Cerrar Sesión</span>
              </button>
            </div>

          </div>
          
          {/* Fondo oscuro para cerrar al tocar afuera */}
          <div
            className="flex-1"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        </div>
      )}
    </>
  );
};
