import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateHousingDeduction, calculateSettlement } from '../../src/core/domain/settlementRules';
import { CalculateSettlementUseCase } from '../../src/core/use-cases/CalculateSettlementUseCase';
import type { IStorageRepository } from '../../src/core/ports/IStorageRepository';
import { jsPDF } from 'jspdf';
import { downloadLiquidationPdf } from '../../src/utils/liquidationPdfGenerator';
import { INITIAL_SHIFTS } from '../../src/mockData';

test('vivienda distingue cero, ausencia, excepción y exención con prioridad explícita', () => {
  assert.equal(calculateHousingDeduction({ housingCostPerPersonDaily:0 }),0);
  assert.equal(calculateHousingDeduction({ housingCostPerPersonDaily:8000,housingDeductionOverride:0 }),0);
  assert.equal(calculateHousingDeduction({ housingCostPerPersonDaily:8000,housingDeductionOverride:1500 }),1500);
  assert.equal(calculateHousingDeduction({ isHousingExempt:true,housingCostPerPersonDaily:8000,housingDeductionOverride:1500 }),0);
  assert.equal(calculateHousingDeduction({}),8000);
  assert.throws(()=>calculateHousingDeduction({ housingCostPerPersonDaily:NaN }),/inválido/);
  assert.throws(()=>calculateHousingDeduction({ housingDeductionOverride:-1 }),/inválido/);
});

test('cálculo auxiliar conserva regla central: incentivo y efectivo faltante separado', () => {
  const result=calculateSettlement({ totalSalesAmount:1500,grossCommission:300,housingCostPerPersonDaily:0,
    missingUnitsCount:1,missingUnitPenaltyRate:0,cashExpected:1500,cashHandedIn:0,incentivesOrBonuses:25 });
  assert.equal(result.housingDeduction,0);
  assert.equal(result.missingUnitsPenalty,0);
  assert.equal(result.cashShortfall,1500);
  assert.equal(result.totalDeductions,0);
  assert.equal(result.finalPayoutAmount,325);
});

test('caso de uso toma política central y mantiene comisión cero sin tramos activos', () => {
  const repository={
    getShifts:()=>[{ id:'S',stockItems:[{deliveredUnits:2}],incentivesOrBonuses:0 }],
    getUsers:()=>[{ id:'V',commissionRate:0,housingCostExempt:false,housingCostOverride:0 }],
    getSalesForShift:()=>[{ paymentMethod:'efectivo',totalAmount:1500,quantityUnitsEquivalent:1 }],
    getWasteRecords:()=>[],getCommissionTiers:()=>[],
    getSystemConfig:()=>({ housingCostPerPersonDaily:8000,deductionRatePerMissingUnit:0 })
  } as unknown as IStorageRepository;
  const result=new CalculateSettlementUseCase(repository).execute({ shiftId:'S',sellerId:'V',cashHandedIn:0,returnedUnits:{ variety:0 } });
  assert.equal(result.commissionRate,0);
  assert.equal(result.grossCommission,0);
  assert.equal(result.housingDeduction,0);
  assert.equal(result.missingUnitsPenalty,0);
  assert.equal(result.cashShortfall,1500);
  assert.equal(result.finalPayoutAmount,0);
});

test('PDF conserva comisión y vivienda cero, y declara el efectivo cero sin ocultar su faltante', () => {
  const writtenText: string[] = [];
  let saved = false;
  // Instrumenta una instancia real de jsPDF, conservando composición y cálculo.
  // Sólo la descarga se sustituye, para no generar archivos en la suite unitaria.
  const onInitialize = function(this: jsPDF) {
    const originalText = this.text;
    this.text = function(text: string | string[], ...arguments_: any[]) {
      writtenText.push(...(Array.isArray(text) ? text : [text]));
      return originalText.call(this, text, ...arguments_);
    } as typeof this.text;
    this.save = (() => { saved = true; return this; }) as typeof this.save;
  };
  const subscription = ['initialized', onInitialize] as [string, (...arguments_: any[]) => void];
  const events = (jsPDF.API as unknown as { events: typeof subscription[] }).events;
  events.push(subscription);
  try {
    assert.equal(downloadLiquidationPdf({ ...INITIAL_SHIFTS[0], commissionRate: 0, appliedCommissionTierName: '',
      housingCostExempt: false, housingCostDeduction: 0, cashExpected: 1500, cashDeclared: 0,
      totalGrossSales: 1500, totalCashSales: 1500, grossCommission: 0, finalPayoutAmount: 0 }), true);
    assert.equal(saved, true);
    assert.ok(writtenText.some(text => text.includes('Tramo 0%')));
    assert.ok(writtenText.includes('- $ 0'));
    assert.ok(!writtenText.includes('- $ 8.000'));
    assert.ok(writtenText.some(text => text.includes('1.500') && /FALTANTE/i.test(text)));
  } finally {
    events.splice(events.indexOf(subscription), 1);
  }
});
