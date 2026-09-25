/**
 * SGMO — Tequeños Costa
 * Repositorio Central y Galería General de Comprobantes de Pago
 * 
 * Reglas de Acceso:
 * 1. Administrador: acceso total a todos los comprobantes de todas las bases y vendedores.
 * 2. Coordinadores: acceso a los comprobantes de los vendedores de sus bases operativas y turnos gestionados,
 *    con selector para ver comprobantes generales requeridos para conciliaciones de caja.
 * 3. Vendedor: consulta estricta y exclusiva de sus propios comprobantes en modo solo lectura.
 * 
 * Evidencia histórica inmutable: no se permite la edición ni eliminación de fotografías.
 * Preparado para integración futura con API y Webhooks de Mercado Pago.
 */

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Calendar,
  Clock,
  DollarSign,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Search,
  Filter,
  Eye,
  X,
  Smartphone,
  CheckCircle2,
  Lock,
  Layers,
  Building,
  User,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Copy,
  Check,
  Link2,
  LayoutGrid,
  List,
  Sparkles,
  Info
} from 'lucide-react';
import { AppState } from '../services/storageService';
import { SaleTransaction, VoucherValidationStatus } from '../types';

interface GeneralVouchersRepositoryViewProps {
  state: AppState;
}

export const GeneralVouchersRepositoryView: React.FC<GeneralVouchersRepositoryViewProps> = ({ state }) => {
  const { currentUser, sales, users, houses, shifts } = state;

  // Modos de vista: Galería de tarjetas o Tabla densa de conciliación
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>('todos');
  const [selectedHouseFilter, setSelectedHouseFilter] = useState<string>('todos');
  const [dateFilter, setDateFilter] = useState<string>('todos');

  // Para coordinadores: 'mis_vendedores' (por defecto) o 'todos_conciliacion'
  const [coordinatorScope, setCoordinatorScope] = useState<'mis_vendedores' | 'todos_conciliacion'>('mis_vendedores');

  // Modal de inspección de comprobante
  const [inspectingSale, setInspectingSale] = useState<SaleTransaction | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotationDegrees, setRotationDegrees] = useState<number>(0);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  // Determinar vendedores gestionados para Coordinador
  const coordinatorManagedSellerIds = useMemo(() => {
    if (currentUser.role !== 'coordinator') return [];

    // Casas coordinadas por este usuario
    const myHouseIds = houses
      .filter((h) => h.coordinatorIds?.includes(currentUser.id))
      .map((h) => h.id);

    // Vendedores asignados a esas casas
    const sellersInMyHouses = users
      .filter((u) => u.role === 'seller' && u.assignedHouseId && myHouseIds?.includes(u.assignedHouseId))
      .map((u) => u.id);

    // Vendedores en turnos coordinados por este usuario
    const sellersInMyShifts = shifts
      .filter((s) => s.coordinatorId === currentUser.id)
      .map((s) => s.sellerId);

    // Incluir también al propio coordinador para que pueda consultar los comprobantes de sus propias jornadas de venta
    return Array.from(new Set([...sellersInMyHouses, ...sellersInMyShifts, currentUser.id]));
  }, [currentUser, houses, users, shifts]);

  // Lista de todos los comprobantes (ventas con comprobante o Mercado Pago)
  const allVoucherSales = useMemo(() => {
    return sales.filter((s) => s.voucherPhotoUrl || s.paymentMethod === 'mercado_pago');
  }, [sales]);

  // Aplicar control de acceso según Rol
  const accessibleVoucherSales = useMemo(() => {
    if (currentUser.role === 'admin') {
      return allVoucherSales;
    }

    if (currentUser.role === 'seller') {
      // El vendedor SOLAMENTE puede consultar sus propios comprobantes
      return allVoucherSales.filter((s) => s.sellerId === currentUser.id);
    }

    if (currentUser.role === 'coordinator') {
      // Si el coordinador está en modo 'mis_vendedores', limitar a su equipo gestionado
      if (coordinatorScope === 'mis_vendedores') {
        return allVoucherSales.filter((s) => coordinatorManagedSellerIds?.includes(s.sellerId));
      }
      // En modo 'todos_conciliacion', puede ver los comprobantes generales para cuadrar caja
      return allVoucherSales;
    }

    // Por defecto para cualquier otro rol restringido
    return allVoucherSales.filter((s) => s.sellerId === currentUser.id);
  }, [currentUser, allVoucherSales, coordinatorScope, coordinatorManagedSellerIds]);

  // Vendedores disponibles para el filtro según rol
  const availableSellersForFilter = useMemo(() => {
    const sellerIds = Array.from(new Set(accessibleVoucherSales.map((s) => s.sellerId)));
    return users.filter((u) => sellerIds?.includes(u.id));
  }, [accessibleVoucherSales, users]);

  // Filtrado final
  const filteredSales = useMemo(() => {
    return accessibleVoucherSales.filter((sale) => {
      // Filtro por Estado
      if (statusFilter !== 'todos' && sale.validationStatus !== statusFilter) {
        return false;
      }

      // Filtro por Vendedor
      if (selectedSellerFilter !== 'todos' && sale.sellerId !== selectedSellerFilter) {
        return false;
      }

      // Filtro por Base / Casa (si aplica)
      if (selectedHouseFilter !== 'todos') {
        const sellerObj = users.find((u) => u.id === sale.sellerId);
        if (sellerObj?.assignedHouseId !== selectedHouseFilter) {
          return false;
        }
      }

      // Filtro por Fecha
      if (dateFilter !== 'todos') {
        const saleDate = sale.timestamp.split(' ')[0] || '';
        if (dateFilter === 'hoy') {
          const todayStr = new Date().toISOString().split('T')[0];
          if (saleDate !== todayStr && !saleDate.startsWith('2026-08-31')) {
            // Nota: soporte para demo 2026-08-31
            return false;
          }
        }
      }

      // Búsqueda libre
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const opMatch = sale.voucherExtractedData?.operationId?.toLowerCase()?.includes(term);
        const sellerMatch = sale.sellerName?.toLowerCase()?.includes(term);
        const idMatch = sale.id?.toLowerCase()?.includes(term);
        const amountMatch = sale.totalAmount?.toString()?.includes(term);
        const varietyMatch = sale.varietyName?.toLowerCase()?.includes(term);
        const dateMatch = sale.timestamp && typeof sale.timestamp === 'string' ? sale.timestamp.includes(term) : false;
        const senderMatch = sale.voucherExtractedData?.senderName?.toLowerCase()?.includes(term);

        if (!opMatch && !sellerMatch && !idMatch && !amountMatch && !varietyMatch && !dateMatch && !senderMatch) {
          return false;
        }
      }

      return true;
    });
  }, [accessibleVoucherSales, statusFilter, selectedSellerFilter, selectedHouseFilter, dateFilter, searchTerm, users]);

  // Métricas para cabecera
  const metrics = useMemo(() => {
    const totalCount = accessibleVoucherSales.length;
    const validatedCount = accessibleVoucherSales.filter((s) => s.validationStatus === 'validada').length;
    const pendingCount = accessibleVoucherSales.filter((s) => s.validationStatus === 'pendiente_revision').length;
    const alertCount = accessibleVoucherSales.filter(
      (s) => s.validationStatus === 'inconsistente' || s.validationStatus === 'sospechosa'
    ).length;
    const totalAmount = accessibleVoucherSales.reduce((acc, s) => acc + s.totalAmount, 0);

    return { totalCount, validatedCount, pendingCount, alertCount, totalAmount };
  }, [accessibleVoucherSales]);

  // Abrir inspector modal
  const handleOpenInspector = (sale: SaleTransaction) => {
    setInspectingSale(sale);
    setZoomLevel(1);
    setRotationDegrees(0);
    setCopiedId(false);
  };

  const handleCopyOperationId = (opId: string) => {
    navigator.clipboard?.writeText(opId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const renderStatusBadge = (status: VoucherValidationStatus) => {
    switch (status) {
      case 'validada':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <ShieldCheck className="w-3 h-3 mr-1 text-emerald-400" />
            Validada
          </span>
        );
      case 'sospechosa':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <ShieldAlert className="w-3 h-3 mr-1 text-rose-400" />
            Sospechosa
          </span>
        );
      case 'inconsistente':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3 mr-1 text-amber-400" />
            Inconsistente
          </span>
        );
      case 'pendiente_revision':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
            <Clock className="w-3 h-3 mr-1 text-sky-400" />
            Pendiente
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* 1. Cabecera Principal y Control de Alcance */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-sky-400 text-xs font-semibold uppercase tracking-wider">
              <FileText className="w-4 h-4" />
              <span>
                {currentUser.role === 'admin'
                  ? 'Repositorio Central de Comprobantes • Auditoría Global'
                  : currentUser.role === 'coordinator'
                  ? 'Galería de Comprobantes • Base Operativa'
                  : 'Mis Comprobantes de Pago • Respaldo Digital'}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white mt-1 flex items-center space-x-2">
              <span>Consulta General de Comprobantes</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {currentUser.role === 'admin' ? 'Admin' : currentUser.role === 'coordinator' ? 'Coordinación' : 'Vendedor'}
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              {currentUser.role === 'admin'
                ? 'Control centralizado de comprobantes digitales de toda la flota. Registro histórico inmutable de respaldo para conciliación de caja.'
                : currentUser.role === 'coordinator'
                ? 'Supervisión de comprobantes de ventas correspondientes a los vendedores asignados a tus bases operativas y conciliación de caja.'
                : 'Historial digital inmutable de tus cobros registrados con fotografía. Los comprobantes se conservan como evidencia permanente de respaldo.'}
            </p>
          </div>

          {/* Badge de Inmutabilidad de Evidencia */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1.5 bg-slate-950/80 border border-slate-800 px-3 py-2 rounded-xl text-xs text-slate-400">
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Evidencia histórica inmutable</span>
            </div>

            <div className="flex items-center space-x-1.5 bg-sky-950/60 border border-sky-800/60 px-3 py-2 rounded-xl text-xs text-sky-300">
              <Link2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>Listo para API Mercado Pago</span>
            </div>
          </div>
        </div>

        {/* Selector de Alcance para Coordinadores */}
        {currentUser.role === 'coordinator' && (
          <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/40 p-3 rounded-xl">
            <div className="flex items-center space-x-2 text-xs text-slate-300">
              <Building className="w-4 h-4 text-amber-400" />
              <span className="font-semibold">Alcance de Consulta de Coordinación:</span>
            </div>

            <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setCoordinatorScope('mis_vendedores')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  coordinatorScope === 'mis_vendedores'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Mis Vendedores Gestionados ({coordinatorManagedSellerIds.length})
              </button>

              <button
                type="button"
                onClick={() => setCoordinatorScope('todos_conciliacion')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  coordinatorScope === 'todos_conciliacion'
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos los Comprobantes (Modo Conciliación)
              </button>
            </div>
          </div>
        )}

        {/* Indicador de solo lectura para vendedores */}
        {currentUser.role === 'seller' && (
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center space-x-2 text-xs text-amber-400/90 bg-amber-950/20 px-3 py-2 rounded-xl border border-amber-800/30">
            <Info className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              Tus comprobantes son resguardados automáticamente. Para garantizar la validez legal y evitar discrepancias en liquidación, las fotografías no pueden ser modificadas ni eliminadas.
            </span>
          </div>
        )}

        {/* Tarjetas de Métricas Rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-4 border-t border-slate-800">
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Comprobantes</span>
            <span className="text-lg sm:text-xl font-black text-white">{metrics.totalCount}</span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Monto Digital Total</span>
            <span className="text-lg sm:text-xl font-black text-amber-400 font-mono">
              ${metrics.totalAmount.toLocaleString()}
            </span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Validados</span>
            <span className="text-lg sm:text-xl font-black text-emerald-400">{metrics.validatedCount}</span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-sky-400 uppercase font-semibold block">En Revisión</span>
            <span className="text-lg sm:text-xl font-black text-sky-400">{metrics.pendingCount}</span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-rose-400 uppercase font-semibold block">Discrepancias / Alertas</span>
            <span className="text-lg sm:text-xl font-black text-rose-400">{metrics.alertCount}</span>
          </div>
        </div>
      </div>

      {/* 2. Barra de Filtros, Búsqueda y Modos de Visualización */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          
          {/* Campo de Búsqueda */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar por N° op, vendedor, venta o monto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Selectores de Filtro (Vendedor, Casa, Fecha) */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            
            {/* Filtro Vendedor (solo si hay más de 1 accesible) */}
            {currentUser.role !== 'seller' && (
              <select
                value={selectedSellerFilter}
                onChange={(e) => setSelectedSellerFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                <option value="todos">Todos los Vendedores</option>
                {availableSellersForFilter.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}

            {/* Filtro Casa/Base (para admin y coordinador) */}
            {currentUser.role !== 'seller' && (
              <select
                value={selectedHouseFilter}
                onChange={(e) => setSelectedHouseFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                <option value="todos">Todas las Bases</option>
                {houses.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            )}

            {/* Selector de Vista: Cuadrícula vs Tabla */}
            <div className="flex items-center bg-slate-950 border border-slate-800 p-0.5 rounded-xl ml-auto">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
                title="Vista en Galería de Tarjetas"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
                title="Vista en Tabla de Conciliación"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>

        {/* Pestañas de Filtro por Estado */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pt-2 border-t border-slate-800/80 scrollbar-none">
          <span className="text-[11px] text-slate-400 font-semibold mr-1 shrink-0 flex items-center">
            <Filter className="w-3.5 h-3.5 mr-1" /> Estado:
          </span>

          {[
            { id: 'todos', label: 'Todos' },
            { id: 'validada', label: 'Validadas' },
            { id: 'pendiente_revision', label: 'Pendientes' },
            { id: 'inconsistente', label: 'Inconsistentes' },
            { id: 'sospechosa', label: 'Sospechosas' }
          ].map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === st.id
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Contenido Principal: Galería de Comprobantes o Tabla */}
      {filteredSales.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No se encontraron comprobantes</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {searchTerm || statusFilter !== 'todos' || selectedSellerFilter !== 'todos'
              ? 'No hay registros que coincidan con los filtros aplicados. Intentá restablecer los filtros para ver todos los comprobantes.'
              : 'Aún no se han registrado cobros por Mercado Pago o transferencias con comprobante fotográfico en este alcance.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        
        /* A) VISTA EN GALERÍA DE TARJETAS */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredSales.map((sale) => {
            const [saleDate, saleTime] = (sale.timestamp && typeof sale.timestamp === 'string' && sale.timestamp.includes(' '))
              ? sale.timestamp.split(' ')
              : [sale.timestamp || '', ''];

            const hasPhoto = !!sale.voucherPhotoUrl;
            const opId = sale.voucherExtractedData?.operationId;
            const isMpMatched = sale.mpApiVerification?.matchedInApi;

            return (
              <div
                key={sale.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between group"
              >
                {/* Visualizador de la Fotografía del Comprobante */}
                <div
                  onClick={() => handleOpenInspector(sale)}
                  className="relative aspect-[4/3] bg-black cursor-pointer overflow-hidden border-b border-slate-800 flex items-center justify-center"
                >
                  {hasPhoto ? (
                    <img
                      src={sale.voucherPhotoUrl}
                      alt={`Comprobante venta ${sale.id}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="p-4 text-center space-y-2 text-slate-500">
                      <Smartphone className="w-8 h-8 mx-auto text-slate-600" />
                      <span className="text-[11px] block font-medium">Captura registrada en terminal</span>
                      {opId && (
                        <span className="text-[10px] font-mono text-sky-400 bg-sky-950/40 px-2 py-0.5 rounded border border-sky-800/40">
                          {opId}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Overlay para Revisar Imagen */}
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2 text-white text-xs font-bold backdrop-blur-[2px]">
                    <Eye className="w-4 h-4 text-sky-400" />
                    <span>Abrir y Revisar</span>
                  </div>

                  {/* Badge flotante de Estado de Validación */}
                  <div className="absolute top-2.5 right-2.5 z-10">
                    {renderStatusBadge(sale.validationStatus)}
                  </div>

                  {/* Tag inferior de Método */}
                  <div className="absolute bottom-2 left-2 z-10 bg-slate-950/80 backdrop-blur-sm border border-slate-800 rounded-md px-2 py-0.5 text-[10px] font-medium text-sky-300">
                    {sale.paymentMethod === 'mercado_pago' ? 'Mercado Pago' : 'Transferencia'}
                  </div>
                </div>

                {/* Información detallada de la Venta */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    
                    {/* Encabezado de Venta e Importe */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-white block">
                          Venta #{sale.id.replace('TX-', '')}
                        </span>
                        <p className="text-[11px] text-slate-400 truncate max-w-[140px]">
                          {sale.varietyName}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-base font-black text-amber-400 font-mono block">
                          ${sale.totalAmount.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase">
                          {sale.itemType} ({sale.quantityUnitsEquivalent}u)
                        </span>
                      </div>
                    </div>

                    {/* Vendedor */}
                    <div className="flex items-center space-x-1.5 text-xs text-slate-300 bg-slate-950/60 px-2.5 py-1.5 rounded-xl border border-slate-800/80">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate font-semibold">{sale.sellerName}</span>
                    </div>

                    {/* N° Operación extraído */}
                    {opId && (
                      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                        <span className="text-slate-500">Operación:</span>
                        <span className="font-mono text-sky-300 font-semibold">{opId}</span>
                      </div>
                    )}

                    {/* Estado de preparación para API Mercado Pago */}
                    <div className="text-[10px] px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400">Conciliación MP:</span>
                      {isMpMatched ? (
                        <span className="text-emerald-400 font-bold flex items-center">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Aprobado
                        </span>
                      ) : (
                        <span className="text-amber-400/90 flex items-center font-medium">
                          <Clock className="w-3 h-3 mr-1" />
                          Pendiente API
                        </span>
                      )}
                    </div>

                  </div>

                  {/* Pie con Fecha y Hora */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{saleDate}</span>
                    </div>
                    {saleTime && (
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{saleTime} hs</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Botón de inspección para coordinadores y administradores */}
                <button
                  type="button"
                  onClick={() => handleOpenInspector(sale)}
                  className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 border-t border-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-sky-400" />
                  <span>
                    {currentUser.role === 'seller' ? 'Ver Mi Comprobante' : 'Revisar Comprobante'}
                  </span>
                </button>

              </div>
            );
          })}
        </div>

      ) : (

        /* B) VISTA EN TABLA DE CONCILIACIÓN */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Comprobante</th>
                  <th className="p-3">Venta</th>
                  <th className="p-3">Vendedor</th>
                  <th className="p-3">Fecha & Hora</th>
                  <th className="p-3">Producto / Variedad</th>
                  <th className="p-3 text-right">Importe</th>
                  <th className="p-3">Método</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Conciliación MP</th>
                  <th className="p-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredSales.map((sale) => {
                  const [saleDate, saleTime] = (sale.timestamp && typeof sale.timestamp === 'string' && sale.timestamp.includes(' '))
                    ? sale.timestamp.split(' ')
                    : [sale.timestamp || '', ''];

                  return (
                    <tr key={sale.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Thumbnail */}
                      <td className="p-3">
                        <div
                          onClick={() => handleOpenInspector(sale)}
                          className="w-12 h-10 rounded-lg overflow-hidden bg-black border border-slate-800 cursor-pointer flex items-center justify-center hover:opacity-80 transition-opacity"
                        >
                          {sale.voucherPhotoUrl ? (
                            <img
                              src={sale.voucherPhotoUrl}
                              alt="Comprobante"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Smartphone className="w-4 h-4 text-slate-500" />
                          )}
                        </div>
                      </td>

                      {/* Venta ID */}
                      <td className="p-3 font-mono text-white font-bold">
                        #{sale.id.replace('TX-', '')}
                      </td>

                      {/* Vendedor */}
                      <td className="p-3">
                        <div className="font-semibold text-white">{sale.sellerName}</div>
                        <div className="text-[10px] text-slate-500">{sale.sellerId}</div>
                      </td>

                      {/* Fecha y Hora */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="text-slate-200">{saleDate}</div>
                        <div className="text-[10px] text-slate-500">{saleTime} hs</div>
                      </td>

                      {/* Variedad / Producto */}
                      <td className="p-3">
                        <div className="text-slate-200 font-medium">{sale.varietyName}</div>
                        <div className="text-[10px] text-slate-500 uppercase">
                          {sale.itemType} ({sale.quantityUnitsEquivalent} u)
                        </div>
                      </td>

                      {/* Importe */}
                      <td className="p-3 text-right font-mono font-black text-amber-400">
                        ${sale.totalAmount.toLocaleString()}
                      </td>

                      {/* Método */}
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-950 border border-slate-800 text-sky-300">
                          {sale.paymentMethod === 'mercado_pago' ? 'Mercado Pago' : 'Transferencia'}
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="p-3 whitespace-nowrap">
                        {renderStatusBadge(sale.validationStatus)}
                      </td>

                      {/* Conciliación MP */}
                      <td className="p-3 whitespace-nowrap">
                        {sale.mpApiVerification?.matchedInApi ? (
                          <span className="text-[11px] text-emerald-400 font-semibold flex items-center">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Aprobado
                          </span>
                        ) : (
                          <span className="text-[11px] text-amber-400 font-medium flex items-center">
                            <Clock className="w-3.5 h-3.5 mr-1" />
                            Pendiente API
                          </span>
                        )}
                      </td>

                      {/* Acción */}
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenInspector(sale)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1 mx-auto transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-sky-400" />
                          <span>Revisar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. MODAL INSPECTOR DE COMPROBANTE Y EVIDENCIA HISTÓRICA */}
      {inspectingSale && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl my-auto flex flex-col max-h-[92vh]">
            
            {/* Header del Modal */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-sky-950 text-sky-400 border border-sky-800/60">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <span>Comprobante de Venta #{inspectingSale.id}</span>
                    {renderStatusBadge(inspectingSale.validationStatus)}
                  </h3>
                  <span className="text-xs text-slate-400">
                    Registrado el {inspectingSale.timestamp} por {inspectingSale.sellerName}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setInspectingSale(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo del Modal con Visor Ampliado y Ficha Técnica */}
            <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-y-auto">
              
              {/* Columna Izquierda: Visor de Imagen con Controles de Zoom y Rotación (7 cols) */}
              <div className="lg:col-span-7 bg-black p-4 flex flex-col items-center justify-between border-b lg:border-b-0 lg:border-r border-slate-800">
                
                {/* Barra de herramientas del visor */}
                <div className="w-full flex items-center justify-between pb-3 text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Fotografía del Comprobante</span>

                  <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                      className="p-1 hover:text-white rounded"
                      title="Alejar"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-mono px-1">{Math.round(zoomLevel * 100)}%</span>
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                      className="p-1 hover:text-white rounded"
                      title="Acercar"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRotationDegrees((r) => (r + 90) % 360)}
                      className="p-1 hover:text-white rounded ml-1 border-l border-slate-800 pl-1.5"
                      title="Rotar 90°"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Contenedor de la Imagen */}
                <div className="flex-1 w-full flex items-center justify-center overflow-hidden min-h-[320px] max-h-[480px]">
                  {inspectingSale.voucherPhotoUrl ? (
                    <img
                      src={inspectingSale.voucherPhotoUrl}
                      alt="Comprobante en alta resolución"
                      style={{
                        transform: `scale(${zoomLevel}) rotate(${rotationDegrees}deg)`,
                        transition: 'transform 0.2s ease-out'
                      }}
                      className="max-h-[460px] max-w-full object-contain rounded-lg"
                    />
                  ) : (
                    <div className="text-center text-slate-500 space-y-2 p-8">
                      <Smartphone className="w-12 h-12 mx-auto text-slate-600" />
                      <p className="text-xs">No se registró archivo fotográfico para esta transacción.</p>
                    </div>
                  )}
                </div>

                {/* Pie del visor: Descarga o enlace externo si existe foto */}
                {inspectingSale.voucherPhotoUrl && (
                  <div className="w-full pt-3 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Resolución optimizada para auditoría</span>
                    <a
                      href={inspectingSale.voucherPhotoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-400 hover:text-sky-300 flex items-center space-x-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir imagen en pestaña nueva</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Columna Derecha: Ficha Técnica, OCR y Preparación para Mercado Pago (5 cols) */}
              <div className="lg:col-span-5 p-5 space-y-4 bg-slate-900/90 flex flex-col justify-between">
                <div className="space-y-4">
                  
                  {/* Ficha 1: Datos de la Venta Asociada */}
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Detalle de la Operación
                    </span>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Vendedor</span>
                        <span className="font-semibold text-white">{inspectingSale.sellerName}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Importe Cobrado</span>
                        <span className="font-mono font-black text-amber-400 text-sm">
                          ${inspectingSale.totalAmount.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Producto / Variedad</span>
                        <span className="font-medium text-slate-200">{inspectingSale.varietyName}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Formato</span>
                        <span className="font-medium text-slate-200 uppercase">
                          {inspectingSale.itemType} ({inspectingSale.quantityUnitsEquivalent}u)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ficha 2: Datos Extraídos por OCR / IA */}
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider flex items-center">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Lectura OCR & Datos Extraídos
                      </span>
                      {inspectingSale.voucherExtractedData?.confidenceScore && (
                        <span className="text-[10px] font-mono text-slate-400">
                          Confianza: {Math.round(inspectingSale.voucherExtractedData.confidenceScore * 100)}%
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5 text-xs">
                      {inspectingSale.voucherExtractedData?.operationId ? (
                        <div className="flex items-center justify-between bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
                          <span className="text-slate-400">N° de Operación:</span>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono text-sky-300 font-bold">
                              {inspectingSale.voucherExtractedData.operationId}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyOperationId(inspectingSale.voucherExtractedData!.operationId!)}
                              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
                              title="Copiar N° de Operación"
                            >
                              {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500 italic">No se detectó número de operación en el comprobante.</p>
                      )}

                      {inspectingSale.voucherExtractedData?.senderName && (
                        <div className="flex items-center justify-between text-[11px] px-1">
                          <span className="text-slate-500">Emisor / Titular:</span>
                          <span className="text-slate-300 font-medium">{inspectingSale.voucherExtractedData.senderName}</span>
                        </div>
                      )}

                      {inspectingSale.voucherExtractedData?.destinationAccount && (
                        <div className="flex items-center justify-between text-[11px] px-1">
                          <span className="text-slate-500">Cuenta Destino:</span>
                          <span className="text-slate-300 font-mono">{inspectingSale.voucherExtractedData.destinationAccount}</span>
                        </div>
                      )}

                      {inspectingSale.voucherExtractedData?.aiNotes && (
                        <div className="mt-2 p-2 rounded-lg bg-slate-900 border border-slate-800/80 text-[11px] text-slate-300">
                          <span className="font-semibold text-slate-400 block mb-0.5">Observación técnica:</span>
                          {inspectingSale.voucherExtractedData.aiNotes}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ficha 3: Módulo Preparado para Validación Automática de Mercado Pago */}
                  <div className="bg-sky-950/30 p-3.5 rounded-xl border border-sky-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-sky-300 tracking-wider flex items-center">
                        <Link2 className="w-3 h-3 mr-1" />
                        Conciliación Mercado Pago API
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-900/60 text-sky-200 border border-sky-700/60">
                        Preparado
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300">
                      Estructura preparada para enlazar con la API de Mercado Pago y webhooks de pagos entrantes.
                    </p>

                    <div className="space-y-1 text-xs pt-1 border-t border-sky-900/40">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Estado en API MP:</span>
                        <span className="font-semibold text-white">
                          {inspectingSale.mpApiVerification?.apiStatus || 'Aguardando sincronización webhook'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">ID de Transacción MP:</span>
                        <span className="font-mono text-sky-300">
                          {inspectingSale.mpApiVerification?.mpTransactionId || inspectingSale.voucherExtractedData?.operationId || 'No asignado'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ficha 4: Registro de Trazabilidad e Inmutabilidad */}
                  <div className="flex items-center space-x-2 text-[11px] text-slate-400 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
                    <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      Registro histórico inmutable • No puede ser editado ni eliminado por ningún usuario para salvaguardar la auditoría.
                    </span>
                  </div>

                </div>

                {/* Botón de Cierre */}
                <div className="pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setInspectingSale(null)}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    Cerrar Revisión
                  </button>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
