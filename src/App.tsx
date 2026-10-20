/**
 * SGMO — Sistema de Gestión y Monitoreo de Operación
 * Tequeños Costa — Venta Ambulante en Zonas Costeras
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { storageService, AppState } from './services/storageService';
import { UserProfile } from './types';
import { PinLoginScreen } from './components/PinLoginScreen';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { PlanningDispatchView } from './components/PlanningDispatchView';
import { SellerTerminalView } from './components/SellerTerminalView';
import { VoucherValidationView } from './components/VoucherValidationView';
import { ReconciliationClosingView } from './components/ReconciliationClosingView';
import { ProductionInventoryView } from './components/ProductionInventoryView';
import { FleetMaintenanceView } from './components/FleetMaintenanceView';
import { CostsProfitabilityView } from './components/CostsProfitabilityView';
import { AdminConfigView } from './components/AdminConfigView';
import { FactoryProductionView } from './components/FactoryProductionView';
import { GeneralVouchersRepositoryView } from './components/GeneralVouchersRepositoryView';
import { AuditAlertsModal } from './components/AuditAlertsModal';
import { ChangePasswordModal } from './components/PasswordManagement';

const InitialOwnerSetup = lazy(() => import('./components/InitialOwnerSetup'));
const PasswordActivationScreen = lazy(() => import('./components/PasswordActivationScreen'));

export const App: React.FC = () => {
  const [state, setState] = useState<AppState>(storageService.getState());
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = storageService.subscribe((newState) => {
      setState({ ...newState });
    });
    void storageService.restoreSession();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!state.currentUser?.id) return;
    let stopped = false;
    const refresh = async () => {
      if (stopped || !storageService.getState().isOnline) return;
      const loaded = await storageService.refreshCentralState();
      if (!loaded || stopped) return;
      const synchronization = await storageService.flushOfflineQueue();
      if (synchronization.acknowledgedIds.length && !stopped) await storageService.refreshCentralState();
    };
    void refresh();
    const refreshTimer = window.setInterval(() => { void refresh(); }, 30_000);
    window.addEventListener('online', refresh);
    return () => {
      stopped = true;
      window.clearInterval(refreshTimer);
      window.removeEventListener('online', refresh);
    };
  }, [state.currentUser?.id]);

  // Adaptar ruta inicial automáticamente según el rol del usuario autenticado por PIN
  const handleLoginSuccess = (user: UserProfile) => {
    if (user.role === 'seller') {
      setActiveTab('seller-terminal');
    } else if (user.role === 'factory_worker') {
      setActiveTab('factory');
    } else {
      setActiveTab('dashboard');
    }
  };

  const handleLogout = async () => {
    const result = await storageService.logout();
    if (!result.success) window.alert(result.error || 'El cierre de sesión requiere conexión para confirmar la revocación.');
  };

  const handleSelectHouse = (houseId: string) => {
    storageService.setSelectedHouse(houseId);
  };

  const handleResetSeed = () => {
    if (window.confirm('¿Deseás reiniciar todos los datos a la configuración inicial de fábrica? Se cerrará la sesión actual.')) {
      try {
        storageService.resetToFactorySeed();
        setActiveTab('dashboard');
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'El reinicio no se pudo confirmar.');
      }
    }
  };

  if (window.location.pathname === '/activate') {
    return <Suspense fallback={<p role="status" className="p-6">Preparando activación…</p>}><PasswordActivationScreen /></Suspense>;
  }

  // Si no hay usuario autenticado, mostrar sólo ingreso/activación inicial.
  if (!state.currentUser) {
    if (window.location.pathname === '/setup') {
      return <Suspense fallback={<p role="status" className="p-6">Preparando activación…</p>}><InitialOwnerSetup /></Suspense>;
    }
    return <PinLoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // No mostrar los datos de otra cuenta ni semillas antiguas durante el arranque.
  if (state.centralOwnerUserId !== state.currentUser.id || !state.centralHydrated) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <div className="max-w-md bg-white border-2 border-slate-300 rounded-2xl p-6 space-y-4">
          <h1 className="font-black text-lg">Preparando la operación central</h1>
          <p role="status" className="text-slate-800">{state.centralError || 'Cargando jornadas, catálogo y configuración de tu sesión…'}</p>
          <button type="button" disabled={state.centralStatus === 'loading'} onClick={() => { void storageService.refreshCentralState(); }} className="min-h-12 w-full bg-amber-400 border-2 border-amber-600 rounded-xl font-bold disabled:opacity-50">Reintentar carga</button>
          <button type="button" onClick={handleLogout} className="min-h-12 w-full border-2 border-slate-400 rounded-xl">Cerrar sesión</button>
        </div>
      </div>
    );
  }

  const unreadAlertsCount = state.alerts.filter((a) => !a.isRead).length;
  const offlineQueueCount = storageService.getOfflineQueueCount();

  // Control de permisos a nivel de vista
  const isAuthorized = (tab: string): boolean => {
    const role = state.currentUser?.role;
    if (!role) return false;
    if (role === 'admin') return true;
    if (tab === 'admin-config' || tab === 'costs') return false;
    if (role === 'seller') {
      return tab === 'seller-terminal' || tab === 'seller-vouchers' || tab === 'vouchers-repository' || tab === 'reconciliation' || tab === 'fleet';
    }
    if (role === 'factory_worker') {
      return tab === 'factory' || tab === 'production' || tab === 'fleet';
    }
    return true; // Coordinador
  };

  const currentTabSafe = isAuthorized(activeTab)
    ? activeTab
    : state.currentUser.role === 'seller'
    ? 'seller-terminal'
    : state.currentUser.role === 'factory_worker'
    ? 'factory'
    : 'dashboard';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans selection:bg-amber-400 selection:text-slate-950 overflow-x-hidden">
      
      {/* Barra de Navegación Global */}
      <Navbar
        currentUser={state.currentUser}
        selectedHouseId={state.selectedHouseId}
        houses={state.houses}
        onSelectHouse={handleSelectHouse}
        activeTab={currentTabSafe}
        onSelectTab={(tab) => {
          if (isAuthorized(tab)) {
            setActiveTab(tab);
          }
        }}
        isOnline={state.isOnline}
        offlineQueueCount={offlineQueueCount}
        unreadAlertsCount={unreadAlertsCount}
        shifts={state.shifts}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        onOpenAudit={() => setIsAuditOpen(true)}
        onResetSeed={handleResetSeed}
        onLogout={handleLogout}
        onChangePassword={() => setIsPasswordOpen(true)}
      />
      {isPasswordOpen && <ChangePasswordModal onClose={() => setIsPasswordOpen(false)} />}

      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 space-y-2">
        {state.demoMode && <p className="rounded-xl border-2 border-amber-500 bg-amber-50 p-3 text-sm font-bold">Demostración aislada: estos datos no pertenecen a producción.</p>}
        {(state.centralError || state.saleSyncError || state.operationSyncError || offlineQueueCount > 0) && (
          <div role="status" className="rounded-xl border-2 border-amber-500 bg-amber-50 p-3 text-sm text-slate-950">
            <p>{state.centralError || state.saleSyncError || state.operationSyncError || `${offlineQueueCount} ventas pendientes de confirmación central.`}</p>
            <button type="button" disabled={state.saleSyncStatus === 'syncing' || !state.isOnline} onClick={() => { void storageService.flushOfflineQueue(); }} className="mt-2 min-h-12 px-4 border-2 border-slate-600 bg-white rounded-xl font-bold disabled:opacity-50">Reintentar sincronización</button>
          </div>
        )}
      </div>

      {/* Contenedor Principal de la Aplicación */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-6">
        
        {currentTabSafe === 'dashboard' && (
          <DashboardView state={state} onNavigate={setActiveTab} />
        )}

        {currentTabSafe === 'planning' && (
          <PlanningDispatchView state={state} onNavigate={setActiveTab} />
        )}

        {currentTabSafe === 'seller-terminal' && (
          <SellerTerminalView state={state} onNavigate={setActiveTab} />
        )}

        {(currentTabSafe === 'vouchers-repository' || currentTabSafe === 'seller-vouchers') && (
          <GeneralVouchersRepositoryView state={state} />
        )}

        {currentTabSafe === 'vouchers' && (
          <VoucherValidationView state={state} />
        )}

        {currentTabSafe === 'reconciliation' && (
          <ReconciliationClosingView state={state} />
        )}

        {currentTabSafe === 'factory' && (
          <FactoryProductionView state={state} />
        )}

        {currentTabSafe === 'production' && (
          <ProductionInventoryView state={state} />
        )}

        {currentTabSafe === 'fleet' && (
          <FleetMaintenanceView state={state} />
        )}

        {currentTabSafe === 'costs' && (
          <CostsProfitabilityView state={state} />
        )}

        {currentTabSafe === 'admin-config' && (
          <AdminConfigView state={state} />
        )}

      </main>

      {/* Modal de Alertas Operativas */}
      {isAlertsOpen && (
        <AuditAlertsModal
          state={state}
          initialTab="alerts"
          onClose={() => setIsAlertsOpen(false)}
        />
      )}

      {/* Modal de Auditoría y Trazabilidad */}
      {isAuditOpen && (
        <AuditAlertsModal
          state={state}
          initialTab="audit"
          onClose={() => setIsAuditOpen(false)}
        />
      )}

    </div>
  );
};

export default App;
