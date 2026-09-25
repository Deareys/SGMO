/**
 * SGMO — Tequeños Costa
 * Modal de Trazabilidad, Registro de Auditoría Inmutable y Centro de Alertas Operativas
 */

import React, { useState } from 'react';
import {
  History,
  Bell,
  AlertTriangle,
  CheckCircle2,
  X,
  ShieldCheck,
  Clock,
  Filter,
  User,
  Layers
} from 'lucide-react';
import { AppState, storageService } from '../services/storageService';

interface AuditAlertsModalProps {
  state: AppState;
  initialTab?: 'alerts' | 'audit';
  onClose: () => void;
}

export const AuditAlertsModal: React.FC<AuditAlertsModalProps> = ({
  state,
  initialTab = 'alerts',
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'alerts' | 'audit'>(initialTab);
  const [auditFilter, setAuditFilter] = useState<string>('todos');

  const { alerts, auditLogs, currentUser } = state;
  const isSeller = currentUser?.role === 'seller';

  const filteredLogs = auditLogs.filter((log) => {
    if (auditFilter === 'todos') return true;
    return log.entityType === auditFilter;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Cabecera del Modal con Pestañas */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setActiveTab('alerts')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                activeTab === 'alerts'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Alertas Operativas ({alerts.filter((a) => !a.resolved).length})</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                activeTab === 'audit'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Auditoría & Trazabilidad ({auditLogs.length})</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido según pestaña */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {activeTab === 'alerts' ? (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    alert.resolved
                      ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                      : alert.level === 'critica'
                      ? 'bg-rose-950/30 border-rose-600/50'
                      : 'bg-amber-950/30 border-amber-600/50'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        alert.level === 'critica' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-slate-950'
                      }`}>
                        {alert.level}
                      </span>
                      <span className="font-bold text-white text-xs">{alert.title}</span>
                      <span className="text-[10px] text-slate-500">• {alert.timestamp}</span>
                    </div>
                    <p className="text-xs text-slate-300">{alert.message}</p>
                  </div>

                  {!alert.resolved && (
                    // Si el usuario es vendedor y la alerta es de avería/mantenimiento, no puede resolverla
                    isSeller && (alert.category === 'mantenimiento' || alert.relatedEntityId?.startsWith('INC-')) ? (
                      <span className="text-[11px] text-slate-500 italic px-2 py-1 self-end sm:self-center">
                        Solo taller / mantenimiento
                      </span>
                    ) : (
                      <button
                        onClick={() => storageService.resolveAlert(alert.id)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-emerald-700 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center space-x-1 whitespace-nowrap self-end sm:self-center"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resolver</span>
                      </button>
                    )
                  )}
                </div>
              ))}

              {alerts.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-500">
                  No hay alertas activas en el sistema.
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              
              {/* Filtro de tipo de auditoría */}
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-slate-400">Filtrar por:</span>
                {['todos', 'jornada', 'venta', 'comprobante', 'produccion', 'carrito', 'stock'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setAuditFilter(f)}
                    className={`px-2.5 py-1 rounded-lg uppercase text-[10px] font-bold ${
                      auditFilter === f ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Lista de Registros */}
              <div className="space-y-2 font-mono text-xs">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-amber-400 font-bold">{log.action}</span>
                      <span className="text-slate-500">{log.timestamp}</span>
                    </div>

                    <p className="text-slate-300 text-xs font-sans">{log.details}</p>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                      <span>Usuario: <strong className="text-slate-400">{log.userName}</strong> ({log.userRole})</span>
                      <span>Ref ID: {log.entityId}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
