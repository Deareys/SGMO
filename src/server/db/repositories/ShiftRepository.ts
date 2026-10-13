/**
 * SGMO — Tequeños Costa
 * PostgreSQL Repository: Daily Shifts & Shift Stock Items
 */

import { query, withTransaction } from '../connection';
import { DailyShift, ShiftStockItem, ShiftStatus } from '../../../types';
import type { PoolClient } from 'pg';
import { randomUUID } from 'crypto';
import { calculateCommissionForSales } from '../../../core/domain/commissionRules';
import { calculateWasteDeduction } from '../../../core/domain/settlementRules';
import { assertOperationId, assertOperationQuantity, assertOperationMoney, CANONICAL_BANK_SALE_SQL, assertShiftMutationAccess, DataIntegrityError, type OperationActor } from '../salesValidation';

function countIdentity(items: Array<{ varietyId: string; count: number; wasteCount?: number }>): string {
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new DataIntegrityError('INVALID_COUNTS','Conteo inválido.');
    assertOperationId(item.varietyId,'Variedad'); assertOperationQuantity(item.count,'Devueltos',true);
    if (item.wasteCount !== undefined) assertOperationQuantity(item.wasteCount,'Merma',true);
  }
  return JSON.stringify([...items].sort((left,right) => left.varietyId.localeCompare(right.varietyId))
    .map((item) => [item.varietyId,item.count,item.wasteCount ?? null]));
}

export class ShiftRepository {
  async getAll(): Promise<DailyShift[]> {
    const shiftsRes = await query(`
      SELECT 
        s.id, s.date::text, s.house_id as "houseId", s.house_name as "houseName",
        s.coordinator_id as "coordinatorId", s.coordinator_name as "coordinatorName",
        s.seller_id as "sellerId", s.seller_name as "sellerName",
        s.cart_id as "cartId", s.cart_code as "cartCode",
        s.zone_id as "zoneId", s.zone_name as "zoneName",
        s.status, s.supplies_provided as "suppliesProvided",
        s.start_time as "startTime", s.end_time as "endTime",
        s.total_gross_sales::float as "totalGrossSales",
        s.total_cash_sales::float as "totalCashSales",
        s.total_mp_sales::float as "totalMpSales",
        s.total_transfer_sales::float as "totalTransferSales",
        s.season,
        s.cash_expected::float as "cashExpected",
        s.cash_declared::float as "cashDeclared",
        s.cash_difference::float as "cashDifference",
        (SELECT COALESCE(SUM(sales.total_amount),0)::float FROM sales WHERE sales.shift_id=s.id AND COALESCE((${CANONICAL_BANK_SALE_SQL}),FALSE)) AS "mpValidatedAmount",
        (SELECT COALESCE(SUM(sales.total_amount),0)::float FROM sales WHERE sales.shift_id=s.id AND sales.payment_method!='efectivo' AND NOT COALESCE((${CANONICAL_BANK_SALE_SQL}),FALSE)) AS "mpPendingOrSuspiciousAmount",
        s.total_units_delivered as "totalUnitsDelivered",
        s.total_units_restocked as "totalUnitsRestocked",
        s.total_units_sold as "totalUnitsSold",
        s.total_units_returned as "totalUnitsReturned",
        s.total_units_waste as "totalUnitsWaste",
        s.total_units_difference as "totalUnitsDifference",
        s.commission_rate::float as "commissionRate",
        s.applied_commission_tier_id as "appliedCommissionTierId",
        s.applied_commission_tier_name as "appliedCommissionTierName",
        s.gross_commission::float as "grossCommission",
        s.housing_cost_deduction::float as "housingCostDeduction",
        s.housing_cost_exempt as "housingCostExempt",
        s.deductions_for_missing_units::float as "deductionsForMissingUnits",
        s.waste_deduction_breakdown as "wasteDeductionBreakdown",
        s.incentives_or_bonuses::float as "incentivesOrBonuses",
        s.final_payout_amount::float as "finalPayoutAmount",
        s.payout_status as "payoutStatus",
        s.payout_timestamp as "payoutTimestamp",
        s.payout_payment_proof as "payoutPaymentProof",
        s.notes, s.coordinator_signature as "coordinatorSignature",
        s.settlement_snapshot as "settlementSnapshot", s.leftovers_snapshot as "leftoversSnapshot"
      FROM daily_shifts s
      ORDER BY s.date DESC, s.start_time DESC
    `);

    const shifts: DailyShift[] = [];
    for (const row of shiftsRes.rows) {
      const stockRes = await query(`
        SELECT 
          variety_id as "varietyId", variety_name as "varietyName",
          delivered_units as "deliveredUnits", resupplied_units as "reSuppliedUnits",
          sold_units as "soldUnits", returned_units as "returnedUnits",
          waste_units as "wasteUnits", difference_units as "differenceUnits"
        FROM shift_stock_items
        WHERE shift_id = $1
      `, [row.id]);

      shifts.push({
        ...row,
        stockItems: stockRes.rows
      });
    }

    return shifts;
  }

  async getActiveForUser(userId: string): Promise<DailyShift | null> {
    const res = await query(`
      SELECT id FROM daily_shifts
      WHERE seller_id = $1 AND status IN ('en_curso', 'planificada')
      ORDER BY start_time DESC
      LIMIT 1
    `, [userId]);

    if (res.rows.length === 0) return null;
    return this.getById(res.rows[0].id);
  }

  async getById(id: string, client?: PoolClient): Promise<DailyShift | null> {
    const execute = client ? client.query.bind(client) : query;
    const shiftRes = await execute(`
      SELECT 
        s.id, s.date::text, s.house_id as "houseId", s.house_name as "houseName",
        s.coordinator_id as "coordinatorId", s.coordinator_name as "coordinatorName",
        s.seller_id as "sellerId", s.seller_name as "sellerName",
        s.cart_id as "cartId", s.cart_code as "cartCode",
        s.zone_id as "zoneId", s.zone_name as "zoneName",
        s.status, s.supplies_provided as "suppliesProvided",
        s.start_time as "startTime", s.end_time as "endTime",
        s.total_gross_sales::float as "totalGrossSales",
        s.total_cash_sales::float as "totalCashSales",
        s.total_mp_sales::float as "totalMpSales",
        s.total_transfer_sales::float as "totalTransferSales",
        s.season,
        s.cash_expected::float as "cashExpected",
        s.cash_declared::float as "cashDeclared",
        s.cash_difference::float as "cashDifference",
        (SELECT COALESCE(SUM(sales.total_amount),0)::float FROM sales WHERE sales.shift_id=s.id AND COALESCE((${CANONICAL_BANK_SALE_SQL}),FALSE)) AS "mpValidatedAmount",
        (SELECT COALESCE(SUM(sales.total_amount),0)::float FROM sales WHERE sales.shift_id=s.id AND sales.payment_method!='efectivo' AND NOT COALESCE((${CANONICAL_BANK_SALE_SQL}),FALSE)) AS "mpPendingOrSuspiciousAmount",
        s.total_units_delivered as "totalUnitsDelivered",
        s.total_units_restocked as "totalUnitsRestocked",
        s.total_units_sold as "totalUnitsSold",
        s.total_units_returned as "totalUnitsReturned",
        s.total_units_waste as "totalUnitsWaste",
        s.total_units_difference as "totalUnitsDifference",
        s.commission_rate::float as "commissionRate",
        s.applied_commission_tier_id as "appliedCommissionTierId",
        s.applied_commission_tier_name as "appliedCommissionTierName",
        s.gross_commission::float as "grossCommission",
        s.housing_cost_deduction::float as "housingCostDeduction",
        s.housing_cost_exempt as "housingCostExempt",
        s.deductions_for_missing_units::float as "deductionsForMissingUnits",
        s.waste_deduction_breakdown as "wasteDeductionBreakdown",
        s.incentives_or_bonuses::float as "incentivesOrBonuses",
        s.final_payout_amount::float as "finalPayoutAmount",
        s.payout_status as "payoutStatus",
        s.payout_timestamp as "payoutTimestamp",
        s.payout_payment_proof as "payoutPaymentProof",
        s.notes, s.coordinator_signature as "coordinatorSignature",
        s.settlement_snapshot as "settlementSnapshot", s.leftovers_snapshot as "leftoversSnapshot"
      FROM daily_shifts s
      WHERE s.id = $1
    `, [id]);

    if (shiftRes.rows.length === 0) return null;
    const shift = shiftRes.rows[0];

    const stockRes = await execute(`
      SELECT 
        variety_id as "varietyId", variety_name as "varietyName",
        delivered_units as "deliveredUnits", resupplied_units as "reSuppliedUnits",
        sold_units as "soldUnits", returned_units as "returnedUnits",
        waste_units as "wasteUnits", difference_units as "differenceUnits"
      FROM shift_stock_items
      WHERE shift_id = $1
    `, [id]);

    return {
      ...shift,
      stockItems: stockRes.rows
    };
  }

  /** Despacho autorizado: servidor deriva identidad, estado inicial y saldo del turno. */
  async createShift(input: DailyShift, actor?: OperationActor): Promise<DailyShift> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new DataIntegrityError('INVALID_SHIFT', 'Despacho inválido.');
    if (input.notes !== undefined && (typeof input.notes !== 'string' || input.notes.length > 2000)) throw new DataIntegrityError('INVALID_NOTES','Notas inválidas.');
    const shiftId = input.id || `SHIFT-${randomUUID()}`;
    for (const [label, value] of Object.entries({ id: shiftId, houseId: input.houseId, sellerId: input.sellerId, cartId: input.cartId, zoneId: input.zoneId })) assertOperationId(value, label);
    if (actor && !['admin', 'coordinator'].includes(actor.role)) throw new DataIntegrityError('FORBIDDEN', 'Rol sin permiso para despachar.', 403);
    return withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('sgmo_financial_configuration'))");
      const dispatchIdentity = JSON.stringify([input.houseId,input.sellerId,input.cartId,input.zoneId,
        input.zoneName ?? input.zoneId,input.notes ?? null,
        Array.isArray(input.stockItems) ? [...input.stockItems].sort((left,right) => String(left.varietyId).localeCompare(String(right.varietyId)))
          .map((item) => [item.varietyId,item.deliveredUnits]) : null,
        input.suppliesProvided ? [input.suppliesProvided.gasPercentStart,input.suppliesProvided.napkinsDelivered,
          input.suppliesProvided.conesDelivered,input.suppliesProvided.saucesProvided] : null]);
      await client.query("SELECT pg_advisory_xact_lock(hashtext('sgmo.shift.' || $1))",[shiftId]);
      const existing = await client.query('SELECT * FROM daily_shifts WHERE id = $1 FOR UPDATE', [shiftId]);
      if (existing.rows.length) {
        assertShiftMutationAccess(existing.rows[0], actor);
        if (existing.rows[0].dispatch_snapshot?.identity !== dispatchIdentity) {
          throw new DataIntegrityError('SHIFT_ALREADY_EXISTS', 'La jornada ya existe con otro despacho.', 409);
        }
        return (await this.getById(shiftId,client))!;
      }
      const house = await client.query('SELECT * FROM operational_houses WHERE id = $1 FOR UPDATE', [input.houseId]);
      const seller = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [input.sellerId]);
      const cart = await client.query('SELECT * FROM selling_carts WHERE id = $1 FOR UPDATE', [input.cartId]);
      if (!seller.rows[0]?.is_active || !['seller', 'coordinator'].includes(seller.rows[0]?.role)) throw new DataIntegrityError('INVALID_SELLER', 'Vendedor inactivo o incompatible con el despacho.');
      if (!cart.rows[0]?.is_active || cart.rows[0]?.status !== 'operativo' || cart.rows[0]?.house_id !== input.houseId) throw new DataIntegrityError('INVALID_CART', 'Carrito no disponible en la casa seleccionada.');
      if (!house.rows[0]?.is_active) throw new DataIntegrityError('INVALID_HOUSE', 'Casa operativa no disponible.');
      const coordinatorId = actor?.userId ?? input.coordinatorId;
      assertOperationId(coordinatorId, 'Coordinador');
      const coordinator = await client.query('SELECT * FROM users WHERE id = $1', [coordinatorId]);
      if (!coordinator.rows[0]?.is_active || !['admin', 'coordinator'].includes(coordinator.rows[0]?.role)
          || (actor?.role === 'coordinator' && coordinator.rows[0].assigned_house_id && coordinator.rows[0].assigned_house_id !== input.houseId)) {
        throw new DataIntegrityError('FORBIDDEN', 'Coordinador no autorizado para esa casa.', 403);
      }
      const busy = await client.query(`SELECT id FROM daily_shifts WHERE (seller_id = $1 OR cart_id = $2)
        AND status IN ('planificada', 'en_curso', 'esperando_cierre')`, [input.sellerId, input.cartId]);
      if (busy.rows.length) throw new DataIntegrityError('ACTIVE_SHIFT_CONFLICT', 'El vendedor o carrito ya tiene una jornada abierta.', 409);
      if (!Array.isArray(input.stockItems) || !input.stockItems.length || input.stockItems.length > 100) throw new DataIntegrityError('INVALID_STOCK', 'El despacho necesita variedades y cantidades.');
      const stockItems: ShiftStockItem[] = [];
      const ids = new Set<string>();
      for (const item of input.stockItems) {
        assertOperationId(item.varietyId, 'Variedad');
        assertOperationQuantity(item.deliveredUnits, 'Cantidad entregada');
        if (ids.has(item.varietyId)) throw new DataIntegrityError('DUPLICATE_VARIETY', 'No repetir variedades en el despacho.');
        ids.add(item.varietyId);
        const houseStock = await client.query(`UPDATE house_stock SET units=units-$3 WHERE house_id=$1 AND variety_id=$2 AND units>=$3 RETURNING units`, [input.houseId,item.varietyId,item.deliveredUnits]);
        if (!houseStock.rows.length) throw new DataIntegrityError('INSUFFICIENT_HOUSE_STOCK','La casa no dispone del stock solicitado para despachar.',409);
        const variety = await client.query('SELECT name, is_active, is_available FROM product_varieties WHERE id = $1 FOR SHARE', [item.varietyId]);
        if (!variety.rows[0]?.is_active || !variety.rows[0]?.is_available) throw new DataIntegrityError('INVALID_VARIETY', 'Variedad no disponible.');
        stockItems.push({ varietyId: item.varietyId, varietyName: variety.rows[0].name,
          deliveredUnits: item.deliveredUnits, reSuppliedUnits: 0, soldUnits: 0,
          returnedUnits: 0, wasteUnits: 0, differenceUnits: item.deliveredUnits });
      }
      const supplies = input.suppliesProvided;
      if (!supplies || typeof supplies.gasPercentStart !== 'number' || !Number.isFinite(supplies.gasPercentStart)
          || supplies.gasPercentStart < 0 || supplies.gasPercentStart > 100) throw new DataIntegrityError('INVALID_SUPPLIES', 'Nivel de gas inicial inválido.');
      assertOperationQuantity(supplies.napkinsDelivered, 'Servilletas', true);
      assertOperationQuantity(supplies.conesDelivered, 'Conos', true);
      if (!Array.isArray(supplies.saucesProvided) || supplies.saucesProvided.some((value) => typeof value !== 'string' || value.length > 120)) throw new DataIntegrityError('INVALID_SUPPLIES', 'Salsas inválidas.');
      const startTime = new Date().toISOString();
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
      await client.query(`INSERT INTO daily_shifts (id,date,house_id,house_name,coordinator_id,coordinator_name,
        seller_id,seller_name,cart_id,cart_code,zone_id,zone_name,status,supplies_provided,start_time,
        total_units_delivered,commission_rate,notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'en_curso',$13,$14,$15,$16,$17)`,
      [shiftId,date,input.houseId,house.rows[0].name,coordinatorId,coordinator.rows[0].name,
        input.sellerId,seller.rows[0].name,input.cartId,cart.rows[0].code,input.zoneId,
        typeof input.zoneName === 'string' && input.zoneName.length <= 120 ? input.zoneName : input.zoneId,
        JSON.stringify({ gasPercentStart: supplies.gasPercentStart, napkinsDelivered: supplies.napkinsDelivered,
          conesDelivered: supplies.conesDelivered, saucesProvided: supplies.saucesProvided }),
        startTime,stockItems.reduce((sum,item) => sum + item.deliveredUnits, 0),Number(seller.rows[0].commission_rate),input.notes ?? null]);
      for (const item of stockItems) await client.query(`INSERT INTO shift_stock_items
        (id,shift_id,variety_id,variety_name,delivered_units,difference_units) VALUES ($1,$2,$3,$4,$5,$5)`,
        [`STK-${randomUUID()}`,shiftId,item.varietyId,item.varietyName,item.deliveredUnits]);
      await client.query('UPDATE daily_shifts SET dispatch_snapshot=$2 WHERE id=$1',[shiftId,JSON.stringify({ identity: dispatchIdentity,actorId: coordinatorId })]);
      await client.query('UPDATE selling_carts SET current_seller_id = $2, gas_level_percent = $3 WHERE id = $1', [input.cartId,input.sellerId,supplies.gasPercentStart]);
      return (await this.getById(shiftId, client))!;
    });
  }

  /** Cierra una sola vez usando ventas y políticas centrales; el cliente sólo declara conteos físicos. */
  async closeAndReconcileShift(shiftId: string, closingData: Partial<DailyShift> & {
    returnedItems?: Array<{ varietyId: string; count: number; wasteCount?: number }>;
    gasPercentEnd?: number; bonusIncentive?: number;
  }, actor?: OperationActor): Promise<DailyShift> {
    assertOperationId(shiftId, 'Jornada');
    if (!closingData || typeof closingData !== 'object' || Array.isArray(closingData)) throw new DataIntegrityError('INVALID_CLOSING', 'Cierre inválido.');
    if (closingData.notes !== undefined && (typeof closingData.notes !== 'string' || closingData.notes.length > 2000)) throw new DataIntegrityError('INVALID_NOTES','Notas inválidas.');
    assertOperationMoney(closingData.cashDeclared, 'Efectivo declarado');
    const bonus = closingData.bonusIncentive ?? 0;
    assertOperationMoney(bonus, 'Bonificación');
    return withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('sgmo_financial_configuration'))");
      const locked = await client.query('SELECT * FROM daily_shifts WHERE id = $1 FOR UPDATE', [shiftId]);
      const shift = locked.rows[0];
      if (!shift) throw new DataIntegrityError('SHIFT_NOT_FOUND', 'Jornada no encontrada.', 404);
      assertShiftMutationAccess(shift, actor);
      if (actor && !['admin','coordinator'].includes(actor.role)) throw new DataIntegrityError('FORBIDDEN', 'Rol sin permiso para cierre.', 403);
      const returned = closingData.returnedItems ?? closingData.stockItems?.map((item) => ({ varietyId: item.varietyId, count: item.returnedUnits, wasteCount: item.wasteUnits }));
      if (!Array.isArray(returned)) throw new DataIntegrityError('INVALID_COUNTS', 'Se requieren conteos físicos por variedad.');
      const closingIdentity = JSON.stringify([closingData.cashDeclared,bonus,closingData.gasPercentEnd ?? null,
        closingData.notes ?? null,countIdentity(returned)]);
      if (!['en_curso','esperando_cierre'].includes(shift.status)) {
        if (shift.settlement_snapshot?.closingIdentity === closingIdentity) return (await this.getById(shiftId,client))!;
        throw new DataIntegrityError('SHIFT_ALREADY_CLOSED','La liquidación histórica no se puede sobrescribir.',409);
      }
      await client.query('SELECT id FROM operational_houses WHERE id=$1 FOR UPDATE', [shift.house_id]);
      const stockResult = await client.query('SELECT * FROM shift_stock_items WHERE shift_id = $1 ORDER BY variety_id', [shiftId]);
      const stock = stockResult.rows;
      const declared = new Map<string, { count: number; wasteCount?: number }>();
      for (const item of returned) {
        assertOperationId(item.varietyId, 'Variedad'); assertOperationQuantity(item.count, 'Devueltos', true);
        if (item.wasteCount !== undefined) assertOperationQuantity(item.wasteCount, 'Merma física', true);
        if (declared.has(item.varietyId) || !stock.some((stored) => stored.variety_id === item.varietyId)) throw new DataIntegrityError('INVALID_COUNTS', 'Conteo duplicado o variedad ajena a la jornada.');
        declared.set(item.varietyId, item);
      }
      if (declared.size !== stock.length) throw new DataIntegrityError('INCOMPLETE_COUNTS', 'Hay variedades sin conteo físico.');
      const salesResult = await client.query(`SELECT s.variety_id, s.payment_method, s.quantity_units_equivalent,
        s.total_amount::float AS amount, s.validation_status, s.mp_api_verification,
        EXISTS (SELECT 1 FROM bank_payment_claims claim WHERE claim.sale_id=s.id
          AND claim.payment_id=s.mp_api_verification->>'mpTransactionId' AND claim.status='approved'
          AND claim.amount=s.total_amount AND claim.currency_id='ARS') AS "hasBankClaim"
        FROM sales s WHERE s.shift_id = $1`, [shiftId]);
      let gross = 0, cash = 0, mp = 0, transfer = 0, validated = 0, pending = 0, soldTotal = 0;
      const soldByVariety = new Map<string, number>();
      for (const sale of salesResult.rows) {
        gross += sale.amount; soldTotal += sale.quantity_units_equivalent;
        soldByVariety.set(sale.variety_id, (soldByVariety.get(sale.variety_id) ?? 0) + sale.quantity_units_equivalent);
        if (sale.payment_method === 'efectivo') cash += sale.amount;
        else {
          if (sale.payment_method === 'mercado_pago') mp += sale.amount; else transfer += sale.amount;
          const verification = sale.mp_api_verification;
          if (sale.hasBankClaim === true && sale.validation_status === 'validada' && verification?.matchedInApi === true && verification?.isLiveApi === true
              && verification?.apiStatus === 'approved' && verification?.amountMatches === true && verification?.dateMatches === true
              && verification?.recipientMatches === true && verification?.currencyMatches === true) validated += sale.amount;
          else pending += sale.amount;
        }
      }
      let returnedTotal = 0, wasteTotal = 0, differenceTotal = 0;
      for (const item of stock) {
        const count = declared.get(item.variety_id)!;
        const sold = soldByVariety.get(item.variety_id) ?? 0;
        // Una merma del cierre puede aumentar la declarada, nunca borrar registros ya auditados.
        const waste = count.wasteCount ?? item.waste_units;
        if (waste < item.waste_units) throw new DataIntegrityError('WASTE_BELOW_RECORDED', 'La merma declarada es menor que los registros existentes.');
        const difference = item.delivered_units + item.resupplied_units - sold - count.count - waste;
        if (difference < 0) throw new DataIntegrityError('INVENTORY_OVERCOUNT', 'Los conteos exceden el stock entregado.', 409);
        returnedTotal += count.count; wasteTotal += waste; differenceTotal += difference;
        if (count.count > 0) await client.query(`INSERT INTO house_stock (house_id,variety_id,units) VALUES ($1,$2,$3)
          ON CONFLICT (house_id,variety_id) DO UPDATE SET units=house_stock.units+$3,updated_at=CURRENT_TIMESTAMP`, [shift.house_id,item.variety_id,count.count]);
        await client.query(`UPDATE shift_stock_items SET sold_units=$3,returned_units=$4,waste_units=$5,difference_units=$6
          WHERE shift_id=$1 AND variety_id=$2`, [shiftId,item.variety_id,sold,count.count,waste,difference]);
      }
      const seller = await client.query('SELECT commission_rate::float, housing_cost_exempt FROM users WHERE id=$1 FOR SHARE', [shift.seller_id]);
      const configResult = await client.query("SELECT config_value FROM system_configs WHERE config_key='GLOBAL_PARAMS' FOR SHARE");
      const config = configResult.rows[0]?.config_value;
      if (!config) throw new DataIntegrityError('MISSING_FINANCIAL_POLICY', 'Configurar las políticas centrales antes de liquidar.', 409);
      const tiers = await client.query(`SELECT id,name,min_sales::float AS "minSales",max_sales::float AS "maxSales",rate::float,is_active AS "isActive"
        FROM commission_tiers WHERE is_active=TRUE ORDER BY min_sales FOR SHARE`);
      const commission = calculateCommissionForSales(gross, tiers.rows, seller.rows[0]?.commission_rate ?? 0.20);
      const housing = seller.rows[0]?.housing_cost_exempt ? 0 : (config.housingCostPerPersonDaily || 8000);
      const deduction = calculateWasteDeduction(differenceTotal, config.wasteToleranceThreshold !== undefined ? {
        thresholdUnits: config.wasteToleranceThreshold, rateBelowOrEqual: config.wastePenaltyRateBelowOrEqual ?? 500,
        rateAbove: config.wastePenaltyRateAbove ?? 2500 } : undefined, config.deductionRatePerMissingUnit || 1500);
      // Conserva la fórmula de la UI activa: diferencia de caja se informa por separado.
      const finalPayout = Math.max(0, commission.grossCommission + bonus - deduction.totalDeduction - housing);
      const snapshot = { version: 1, closingIdentity, formula: 'commission+bonus-missing-housing', configuration: config,
        tiers: tiers.rows, seller: { commissionRate: seller.rows[0]?.commission_rate, housingCostExempt: !!seller.rows[0]?.housing_cost_exempt },
        commission, deduction, cashDifference: closingData.cashDeclared! - cash, actorId: actor?.userId ?? shift.coordinator_id };
      await client.query(`UPDATE daily_shifts SET status='conciliada',end_time=CURRENT_TIMESTAMP,
        cash_declared=$2,cash_expected=$3,cash_difference=$2::numeric-$3::numeric,total_gross_sales=$4,total_cash_sales=$3,
        total_mp_sales=$5,total_transfer_sales=$6,mp_validated_amount=$7,mp_pending_or_suspicious_amount=$8,
        total_units_sold=$9,total_units_returned=$10,total_units_waste=$11,total_units_difference=$12,
        commission_rate=$13,applied_commission_tier_id=$14,applied_commission_tier_name=$15,gross_commission=$16,
        housing_cost_deduction=$17,housing_cost_exempt=$18,deductions_for_missing_units=$19,waste_deduction_breakdown=$20,
        incentives_or_bonuses=$21,final_payout_amount=$22,notes=$23,coordinator_signature=$24,settlement_snapshot=$25,
        updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [shiftId,closingData.cashDeclared,cash,gross,mp,transfer,validated,pending,
        soldTotal,returnedTotal,wasteTotal,differenceTotal,commission.rate,commission.tier?.id ?? null,commission.tierName,
        commission.grossCommission,housing,!!seller.rows[0]?.housing_cost_exempt,deduction.totalDeduction,JSON.stringify(deduction),
        bonus,finalPayout,closingData.notes ?? shift.notes,actor?.userName ?? shift.coordinator_name,JSON.stringify(snapshot)]);
      if (closingData.gasPercentEnd !== undefined) {
        if (typeof closingData.gasPercentEnd !== 'number' || !Number.isFinite(closingData.gasPercentEnd) || closingData.gasPercentEnd < 0 || closingData.gasPercentEnd > 100) throw new DataIntegrityError('INVALID_GAS', 'Nivel de gas inválido.');
        await client.query('UPDATE selling_carts SET gas_level_percent=$2 WHERE id=$1', [shift.cart_id,closingData.gasPercentEnd]);
        await client.query("UPDATE daily_shifts SET supplies_provided=jsonb_set(supplies_provided,'{gasPercentEnd}',$2::jsonb) WHERE id=$1",[shiftId,JSON.stringify(closingData.gasPercentEnd)]);
      }
      await client.query('UPDATE selling_carts SET current_seller_id=NULL,total_days_in_use=total_days_in_use+1 WHERE id=$1', [shift.cart_id]);
      return (await this.getById(shiftId, client))!;
    });
  }

  /** Conteo del vendedor: espera revisión; el saldo de casa vuelve sólo al conciliar. */
  async declareLeftovers(shiftId: string, input: { returnedItems: Array<{ varietyId: string; count: number; wasteCount?: number }>; notes?: string }, actor: OperationActor): Promise<DailyShift> {
    assertOperationId(shiftId,'Jornada');
    if (!input || !Array.isArray(input.returnedItems)) throw new DataIntegrityError('INVALID_COUNTS','Se requieren conteos físicos.');
    if (input.notes !== undefined && (typeof input.notes !== 'string' || input.notes.length > 2000)) throw new DataIntegrityError('INVALID_NOTES','Notas inválidas.');
    const declared = [...input.returnedItems].sort((left,right) => String(left.varietyId).localeCompare(String(right.varietyId)));
    for (const count of declared) {
      assertOperationId(count.varietyId,'Variedad'); assertOperationQuantity(count.count,'Devueltos',true);
      if (count.wasteCount !== undefined) assertOperationQuantity(count.wasteCount,'Merma',true);
    }
    return withTransaction(async (client) => {
      const locked = await client.query('SELECT * FROM daily_shifts WHERE id=$1 FOR UPDATE',[shiftId]);
      const shift = locked.rows[0];
      if (!shift) throw new DataIntegrityError('SHIFT_NOT_FOUND','Jornada no encontrada.',404);
      assertShiftMutationAccess(shift,actor);
      if (shift.status === 'esperando_cierre' && shift.leftovers_snapshot) {
        const stored = shift.leftovers_snapshot.returnedItems;
        if (countIdentity(stored) !== countIdentity(declared)) throw new DataIntegrityError('LEFTOVERS_CONFLICT','El conteo ya fue declarado con otras cantidades.',409);
        return (await this.getById(shiftId,client))!;
      }
      if (shift.status !== 'en_curso') throw new DataIntegrityError('SHIFT_NOT_ACTIVE','La jornada no admite un nuevo conteo.',409);
      const stock = await client.query(`SELECT *, (SELECT COALESCE(SUM(quantity_units_equivalent),0)::int FROM sales
        WHERE shift_id=$1 AND variety_id=shift_stock_items.variety_id) AS sold FROM shift_stock_items WHERE shift_id=$1`,[shiftId]);
      if (declared.length !== stock.rows.length || new Set(declared.map((count) => count.varietyId)).size !== declared.length) throw new DataIntegrityError('INCOMPLETE_COUNTS','Hay variedades duplicadas o sin contar.');
      for (const count of declared) {
        const item = stock.rows.find((entry) => entry.variety_id === count.varietyId);
        if (!item) throw new DataIntegrityError('INVALID_VARIETY','Variedad ajena a la jornada.');
        const waste = count.wasteCount ?? item.waste_units;
        if (waste < item.waste_units) throw new DataIntegrityError('WASTE_BELOW_RECORDED','No se puede reducir la merma registrada.');
        const difference = item.delivered_units+item.resupplied_units-item.sold-count.count-waste;
        if (difference < 0) throw new DataIntegrityError('INVENTORY_OVERCOUNT','Los conteos exceden el stock entregado.',409);
        await client.query(`UPDATE shift_stock_items SET sold_units=$3,returned_units=$4,waste_units=$5,difference_units=$6
          WHERE shift_id=$1 AND variety_id=$2`,[shiftId,count.varietyId,item.sold,count.count,waste,difference]);
      }
      await client.query(`UPDATE daily_shifts SET status='esperando_cierre',leftovers_snapshot=$2,updated_at=CURRENT_TIMESTAMP
        WHERE id=$1`,[shiftId,JSON.stringify({ returnedItems: declared, actorId: actor.userId, notes: input.notes ?? null })]);
      return (await this.getById(shiftId,client))!;
    });
  }

  /** Pago explícito sobre la liquidación inmutable, nunca sobre un monto enviado por el cliente. */
  async markPayout(shiftId: string, proof: string | undefined, actor: OperationActor): Promise<DailyShift> {
    assertOperationId(shiftId, 'Jornada');
    if (proof !== undefined && (typeof proof !== 'string' || proof.length > 200000)) throw new DataIntegrityError('INVALID_PROOF', 'Comprobante de pago inválido o demasiado grande.');
    return withTransaction(async (client) => {
      const result = await client.query('SELECT * FROM daily_shifts WHERE id=$1 FOR UPDATE', [shiftId]);
      const shift = result.rows[0];
      if (!shift) throw new DataIntegrityError('SHIFT_NOT_FOUND', 'Jornada no encontrada.', 404);
      assertShiftMutationAccess(shift, actor);
      if (!['admin','coordinator'].includes(actor.role)) throw new DataIntegrityError('FORBIDDEN', 'No autorizado para liquidar.', 403);
      if (shift.payout_status === 'pagado') {
        if ((shift.payout_payment_proof ?? null) !== (proof ?? null)) throw new DataIntegrityError('PAYOUT_CONFLICT', 'El pago ya tiene otro comprobante.', 409);
        return (await this.getById(shiftId,client))!;
      }
      if (shift.status !== 'conciliada') throw new DataIntegrityError('SHIFT_NOT_RECONCILED', 'Conciliar antes de registrar pago.', 409);
      await client.query(`UPDATE daily_shifts SET status='liquidada',payout_status='pagado',payout_timestamp=CURRENT_TIMESTAMP,
        payout_payment_proof=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [shiftId,proof ?? null]);
      return (await this.getById(shiftId,client))!;
    });
  }
}

export const shiftRepository = new ShiftRepository();
