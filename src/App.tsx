/**
 * SGMO — Sistema de Gestión y Monitoreo de Operación
 * Tequeños Costa — Venta Ambulante en Zonas Costeras
 */

import React, { useState, useEffect } from 'react';
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

export const App: React.FC = () => {
  const [state, setState] = useState<AppState>(storageService.getState());
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = storageService.subscribe((newState) => {
      setState({ ...newState });
    });
    return () => unsubscribe();
  }, []);

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

  const handleLogout = () => {
    storageService.logout();
  };

  const handleSelectHouse = (houseId: string) => {
    storageService.setSelectedHouse(houseId);
  };

  const handleResetSeed = () => {
    if (window.confirm('¿Deseás reiniciar todos los datos a la configuración inicial de fábrica? Se cerrará la sesión actual.')) {
      storageService.resetToFactorySeed();
      setActiveTab('dashboard');
    }
  };

  // Si no hay usuario autenticado, renderizar exclusivamente la pantalla de ingreso con PIN
  if (!state.currentUser) {
    return <PinLoginScreen onLoginSuccess={handleLoginSuccess} />;
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950">
      
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
      />

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
