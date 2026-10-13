/** Confirmar una liquidación requiere persistencia: ningún PDF se emite ante un fallo central. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { CloseShiftUseCase } from '../../src/core/use-cases/CloseShiftUseCase';
import type { IStorageRepository } from '../../src/core/ports/IStorageRepository';
import { INITIAL_SHIFTS, INITIAL_USERS, INITIAL_VARIETIES, INITIAL_SALES } from '../../src/mockData';
import { StorageService } from '../../src/services/storageService';
import { SellerTerminalView } from '../../src/components/SellerTerminalView';
import { PlanningDispatchView } from '../../src/components/PlanningDispatchView';

const initialShift = INITIAL_SHIFTS[0];

test('Un cierre rechazado no emite PDF ni presenta un cierre guardado', async () => {
  let pdfCalls = 0;
  let readCalls = 0;
  const repository = {
    closeShift: async () => { throw new Error('PostgreSQL no disponible'); },
    getShifts: () => { readCalls++; return [initialShift]; }
  } as unknown as IStorageRepository;
  const useCase = new CloseShiftUseCase(repository, { generateLiquidationPdf: () => { pdfCalls++; return true; } });
  await assert.rejects(useCase.execute({ shiftId: initialShift.id, closingData: {}, generatePdf: true }), /PostgreSQL no disponible/);
  assert.equal(pdfCalls, 0);
  assert.equal(readCalls, 0);
});

test('El PDF espera confirmación y recibe la jornada central confirmada', async () => {
  let confirmPersistence!: () => void;
  const persisted = new Promise<void>((resolve) => { confirmPersistence = resolve; });
  const confirmedShift = { ...initialShift, status: 'conciliada' as const, finalPayoutAmount: 19273 };
  let pdfShift;
  const repository = { closeShift: () => persisted, getShifts: () => [confirmedShift] } as unknown as IStorageRepository;
  const useCase = new CloseShiftUseCase(repository, { generateLiquidationPdf: (shift) => { pdfShift = shift; return true; } });
  const execution = useCase.execute({ shiftId: initialShift.id, closingData: {}, generatePdf: true });
  await Promise.resolve();
  assert.equal(pdfShift, undefined);
  confirmPersistence();
  await execution;
  assert.equal(pdfShift, confirmedShift);
});

function sellerState() {
  const state = new StorageService().getState();
  const seller = INITIAL_USERS.find((user) => user.role === 'seller')!;
  return { ...state, varieties: structuredClone(INITIAL_VARIETIES), sales: structuredClone(INITIAL_SALES), currentUser: seller, shifts: [{ ...initialShift, sellerId: seller.id, status: 'en_curso' as const }] };
}

test('La terminal advierte respaldo pendiente y separa registro de cobro', () => {
  const state = sellerState();
  state.sales = [{ ...state.sales[0], sellerId: state.currentUser.id, shiftId: state.shifts[0].id, syncStatus: 'pending' }];
  const html = renderToStaticMarkup(React.createElement(SellerTerminalView, { state }));
  assert.match(html, /pendientes de confirmación central/);
  assert.match(html, /Reintentar sincronización/);
  assert.match(html, /REGISTRAR/);
});

test('Una jornada conciliada no permite registrar nuevas ventas desde su botón', () => {
  const state = sellerState();
  state.shifts = [{ ...state.shifts[0], status: 'conciliada' as any, date: new Date().toISOString().slice(0, 10) }];
  const html = renderToStaticMarkup(React.createElement(SellerTerminalView, { state }));
  const saleButton = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.find((button) => button.includes('REGISTRAR'));
  assert.ok(saleButton, 'Existe un botón de registro de venta');
  assert.match(saleButton, /disabled=""/);
});

test('El despacho explica que la entrega requiere confirmación central', () => {
  const state = sellerState();
  const html = renderToStaticMarkup(React.createElement(PlanningDispatchView, { state, onNavigate() {} }));
  assert.match(html, /Despachos y reposiciones requieren conexión/);
  assert.match(html, /La entrega se confirma cuando el servidor la guarda/);
});

test('El botón de registro usa el precio del catálogo central seleccionado', () => {
  const state = sellerState();
  state.varieties = [{ ...state.varieties[0], comboPrices: { ...state.varieties[0].comboPrices, combo3: 9876 } }];
  const html = renderToStaticMarkup(React.createElement(SellerTerminalView, { state }));
  const saleButton = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.find((button) => button.includes('REGISTRAR'));
  assert.ok(saleButton);
  assert.ok(saleButton.includes((9876).toLocaleString()));
  assert.ok(!saleButton.includes((4000).toLocaleString()));
});

test('Un combo sin precio no cae a tarifa fija y bloquea la venta', () => {
  const state = sellerState();
  state.varieties = [{ ...state.varieties[0], comboPrices: { ...state.varieties[0].comboPrices, combo3: 0 } }];
  const html = renderToStaticMarkup(React.createElement(SellerTerminalView, { state }));
  const saleButton = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.find((button) => button.includes('REGISTRAR'));
  assert.ok(saleButton);
  assert.match(saleButton, /disabled=""/);
  assert.match(html, /Falta el precio confirmado/);
});
