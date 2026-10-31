/** Cámara y fábrica compartidas. Cada comando bloquea el documento de fábrica
 * y, si mueve mercadería, las casas implicadas. Stock, auditoría y recibo
 * idempotente se confirman en la misma transacción. No usa estado de proceso.
 */
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { query, withTransaction } from "../connection.js";
import {
  ConfigurationValidationError,
  validateResourceId,
} from "./ConfigurationRepository.js";
import {
  emptyFactoryState,
  FACTORY_COLLECTIONS,
  type FactoryState,
} from "../../../shared/factoryState.js";
import {
  canonicalLegacyJson,
  sanitizeLegacyValue,
} from "../../../shared/legacyBackup.js";
import type { ProductionBatch, StockTransfer } from "../../../types";
type Actor = { userId: string; role: string; userName?: string };
const reject = (message: string, status = 400): never => {
  throw new ConfigurationValidationError(message, status);
};
function object(value: any): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    reject("Datos de producción inválidos.");
  return value;
}
function text(value: any, label: string, max = 2000, optional = false): string {
  if (value === undefined && optional) return "";
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!optional && !value.trim())
  )
    reject(`${label} inválido.`);
  return value.trim();
}
function quantity(
  value: any,
  label: string,
  zero = false,
  integer = false,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < (zero ? 0 : 0.000001) ||
    value > 100000000 ||
    (integer && !Number.isSafeInteger(value))
  )
    reject(`${label} inválido.`);
  return value;
}
function money(value: any, label: string): number {
  quantity(value, label, true);
  if (Math.abs(value * 100 - Math.round(value * 100)) > 0.0001)
    reject(`${label} admite dos decimales.`);
  return value;
}
const round = (value: number) => Math.round(value * 100) / 100;
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());
const catalogFields: Record<string, string[]> = {
  rawMaterials: [
    "name",
    "categoryId",
    "categoryName",
    "unit",
    "currentStock",
    "minStockAlert",
    "costPerUnit",
    "supplierId",
    "supplier",
    "lastPurchaseDate",
    "isActive",
    "priceHistory",
  ],
  recipes: [
    "name",
    "type",
    "varietyId",
    "outputUnit",
    "expectedYield",
    "ingredients",
    "estimatedLaborCost",
    "estimatedEnergyPackagingCost",
    "instructions",
    "isActive",
  ],
  suppliers: [
    "name",
    "contactName",
    "phone",
    "email",
    "address",
    "suppliedCategoryIds",
    "suppliedMaterialIds",
    "notes",
    "isActive",
  ],
  supplyCategories: ["name", "description", "icon"],
};
export class ProductionRepository {
  /** Una lectura MVCC para cámara y stock de casas: no mezclar lados de un traslado. */
  async snapshot(includeFactory = true): Promise<{
    factory: FactoryState;
    houseStock: Array<{
      houseId: string;
      varietyId: string;
      varietyName: string;
      quantity: number;
    }>;
  }> {
    const r = await query(
      `SELECT ${includeFactory ? "f.payload" : "'{}'::jsonb"} AS payload,COALESCE((SELECT jsonb_agg(jsonb_build_object('houseId',s.house_id,'varietyId',s.variety_id,'varietyName',v.name,'quantity',s.units)) FROM house_stock s JOIN product_varieties v ON v.id=s.variety_id),'[]'::jsonb) AS stock FROM factory_state f WHERE f.id=1`,
    );
    if (!r.rows[0]) throw new Error("Falta el esquema de producción.");
    return {
      factory: includeFactory
        ? { ...emptyFactoryState(), ...r.rows[0].payload }
        : emptyFactoryState(),
      houseStock: r.rows[0].stock,
    };
  }
  async command(
    candidate: unknown,
    actor: Actor,
  ): Promise<{ id: string; entityId?: string }> {
    const command = object(candidate);
    const id = validateResourceId(command.id);
    const kind = text(command.kind, "Operación", 40);
    const input = object(command.input);
    if (!["admin", "factory_worker", "coordinator"].includes(actor.role))
      reject("Sin permiso para producción.", 403);
    if (actor.role === "coordinator" && kind !== "transfer")
      reject("Esta acción requiere administración o fábrica.", 403);
    if (["catalog", "import-local"].includes(kind) && actor.role !== "admin")
      reject("Sólo administración modifica el catálogo de fábrica.", 403);
    const digest = createHash("sha256")
      .update(canonicalLegacyJson({ kind, input }))
      .digest("hex");
    return withTransaction(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('sgmo.production'))",
      );
      const prior = (
        await client.query(
          "SELECT actor_id,request_hash,result FROM factory_commands WHERE id=$1",
          [id],
        )
      ).rows[0];
      if (prior) {
        if (prior.actor_id !== actor.userId || prior.request_hash !== digest)
          reject("La operación ya existe con otros datos.", 409);
        return prior.result;
      }
      const doc = (
        await client.query(
          "SELECT payload FROM factory_state WHERE id=1 FOR UPDATE",
        )
      ).rows[0]?.payload as FactoryState;
      if (!doc) throw new Error("Falta configuración de fábrica.");
      const account = (
        await client.query(
          "SELECT name,assigned_house_id FROM users WHERE id=$1 AND is_active=TRUE",
          [actor.userId],
        )
      ).rows[0];
      if (!account) reject("Cuenta no disponible.", 403);
      const actorName = account.name;
      let entityId = id;
      if (kind === "catalog") {
        const collection = text(input.collection, "Catálogo", 40);
        if (!catalogFields[collection]) reject("Catálogo inválido.");
        const entity = validateResourceId(input.entityId);
        const attributes = object(input.attributes);
        if (
          Object.keys(attributes).some(
            (key) => !catalogFields[collection].includes(key),
          )
        )
          reject("Campo de catálogo no admitido.");
        const entries = (doc as any)[collection] as any[];
        const existing = entries.find((entry) => entry.id === entity);
        if (input.create && existing) reject("El registro ya existe.", 409);
        if (!input.create && !existing) reject("Registro no encontrado.", 404);
        const next = {
          ...(existing || {}),
          ...attributes,
          id: entity,
          isActive: attributes.isActive ?? existing?.isActive ?? true,
        };
        await this.validateCatalog(collection, next, client, doc);
        if (
          collection === "rawMaterials" &&
          existing &&
          next.costPerUnit !== existing.costPerUnit
        )
          next.priceHistory = [
            ...(existing.priceHistory || []),
            {
              date: today(),
              costPerUnit: next.costPerUnit,
              supplier: next.supplier,
            },
          ];
        (doc as any)[collection] = [
          next,
          ...entries.filter((entry) => entry.id !== entity),
        ];
        entityId = entity;
      } else if (kind === "purchase") {
        const material = doc.rawMaterials.find(
          (entry) => entry.id === input.materialId && entry.isActive,
        );
        if (!material) reject("Insumo no disponible.");
        const amount = quantity(input.quantity, "Cantidad");
        const unitCost = money(input.unitCost, "Costo unitario");
        material.currentStock = quantity(
          material.currentStock + amount,
          "Stock",
          true,
        );
        material.costPerUnit = unitCost;
        material.lastPurchaseDate = today();
        material.supplier = text(input.supplier, "Proveedor", 200, true);
        doc.materialPurchases.unshift({
          id,
          date: today(),
          materialId: material.id,
          materialName: material.name,
          quantity: amount,
          unitCost,
          totalCost: money(round(amount * unitCost), "Costo de compra"),
          supplier: material.supplier,
          registeredBy: actorName,
        });
      } else if (kind === "batch") {
        const batch = await this.batch(client, doc, input, id);
        doc.productionBatches.unshift(batch);
      } else if (kind === "transfer") {
        if (actor.role === "factory_worker")
          reject("El traslado requiere coordinación o administración.", 403);
        const to = validateResourceId(input.toHouseId);
        const from = input.fromHouseId
          ? validateResourceId(input.fromHouseId)
          : null;
        if (from === to) reject("Elegí un destino diferente del origen.");
        if (
          actor.role === "coordinator" &&
          (!account.assigned_house_id ||
            ![to, from].includes(account.assigned_house_id))
        )
          reject("Traslado fuera de tu base.", 403);
        const ids = [...new Set([to, from].filter(Boolean))].sort();
        const houses = (
          await client.query(
            "SELECT id,name,freezer_capacity_units,is_active FROM operational_houses WHERE id=ANY($1::varchar[]) ORDER BY id FOR UPDATE",
            [ids],
          )
        ).rows;
        if (
          houses.length !== ids.length ||
          houses.some((house) => !house.is_active)
        )
          reject("Base no disponible.");
        if (
          !Array.isArray(input.items) ||
          !input.items.length ||
          input.items.length > 100
        )
          reject("Agregá cantidades al traslado.");
        const seen = new Set<string>();
        const items: StockTransfer["items"] = [];
        for (const entry of input.items) {
          const varietyId = validateResourceId(entry.varietyId);
          if (seen.has(varietyId))
            reject("No repetir productos en un traslado.");
          seen.add(varietyId);
          const units = quantity(entry.quantity, "Cantidad", false, true);
          const variety = (
            await client.query(
              "SELECT name FROM product_varieties WHERE id=$1 AND is_active=TRUE",
              [varietyId],
            )
          ).rows[0];
          if (!variety) reject("Producto no disponible.");
          items.push({ varietyId, varietyName: variety.name, quantity: units });
        }
        const current = Number(
          (
            await client.query(
              "SELECT COALESCE(SUM(units),0) AS units FROM house_stock WHERE house_id=$1",
              [to],
            )
          ).rows[0].units,
        );
        if (
          current + items.reduce((sum, item) => sum + item.quantity, 0) >
          houses.find((house) => house.id === to).freezer_capacity_units
        )
          reject("El traslado supera la capacidad de la casa.", 409);
        for (const item of items) {
          if (from) {
            const r = await client.query(
              "UPDATE house_stock SET units=units-$3,updated_at=NOW() WHERE house_id=$1 AND variety_id=$2 AND units>=$3 RETURNING units",
              [from, item.varietyId, item.quantity],
            );
            if (!r.rowCount)
              reject("Stock insuficiente en la casa de origen.", 409);
          } else {
            let needed = item.quantity;
            for (const batch of [...doc.productionBatches].sort(
              (a, b) =>
                a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
            )) {
              if (batch.varietyId !== item.varietyId) continue;
              const take = Math.min(needed, batch.remainingUnitsInCentral);
              batch.remainingUnitsInCentral -= take;
              needed -= take;
              if (!batch.remainingUnitsInCentral) batch.status = "distribuido";
              if (!needed) break;
            }
            if (needed) reject("Stock insuficiente en cámara central.", 409);
          }
          await client.query(
            "INSERT INTO house_stock(house_id,variety_id,units) VALUES($1,$2,$3) ON CONFLICT(house_id,variety_id) DO UPDATE SET units=house_stock.units+$3,updated_at=NOW()",
            [to, item.varietyId, item.quantity],
          );
        }
        doc.transfers.unshift({
          id,
          date: today(),
          fromLocation: from
            ? houses.find((house) => house.id === from).name
            : "Camara Central",
          toHouseId: to,
          toHouseName: houses.find((house) => house.id === to).name,
          transferredBy: actorName,
          items,
          status: "recibido_conforme",
          notes: text(input.notes, "Notas", 2000, true),
        });
      } else if (kind === "order-create") {
        const recipe = doc.recipes.find(
          (entry) => entry.id === input.recipeId && entry.isActive,
        );
        if (!recipe?.varietyId)
          reject("Elegí una receta vinculada a un producto.");
        doc.productionOrders.unshift({
          id,
          recipeId: recipe.id,
          productName: recipe.name,
          requestedQuantity: quantity(input.requestedQuantity, "Cantidad"),
          requestedUnit: recipe.outputUnit,
          targetDate: text(input.targetDate, "Fecha", 10),
          type: recipe.type,
          status: "pendiente",
          createdAt: new Date().toISOString(),
          assignedWorkerName: actorName,
          productionNotes: text(input.productionNotes, "Notas", 2000, true),
        });
      } else if (kind === "order-start" || kind === "order-complete") {
        const order = doc.productionOrders.find(
          (entry) => entry.id === input.orderId,
        );
        if (!order) reject("Orden no encontrada.", 404);
        entityId = order.id;
        if (kind === "order-start") {
          if (order.status !== "pendiente" && order.status !== "en_proceso")
            reject("La orden ya terminó.", 409);
          order.status = "en_proceso";
          order.startedAt ??= new Date().toISOString();
        } else {
          if (order.status === "completada" || order.status === "cancelada")
            reject("La orden ya terminó; no se crea otro lote.", 409);
          const recipe = doc.recipes.find(
            (entry) => entry.id === order.recipeId && entry.isActive,
          );
          if (!recipe?.varietyId)
            reject("La receta necesita un producto disponible.");
          const units = quantity(
            input.realProducedQuantity,
            "Cantidad producida",
            false,
            true,
          );
          const waste = quantity(input.wasteQuantity, "Merma", true);
          const factor = units / recipe.expectedYield;
          const batch = await this.batch(
            client,
            doc,
            {
              varietyId: recipe.varietyId,
              unitsProduced: units,
              laborCost: round(recipe.estimatedLaborCost * factor),
              energyAndPackagingCost: round(
                recipe.estimatedEnergyPackagingCost * factor,
              ),
              ingredientsUsed: recipe.ingredients.map((entry) => ({
                materialId: entry.materialId,
                quantity: Number((entry.quantityRequired * factor).toFixed(6)),
              })),
              notes: text(input.notes, "Notas", 2000, true),
            },
            id,
          );
          doc.productionBatches.unshift(batch);
          Object.assign(order, {
            status: "completada",
            completedAt: new Date().toISOString(),
            realProducedQuantity: units,
            wasteQuantity: waste,
            wasteReason: text(input.wasteReason, "Motivo", 2000, true),
            generatedBatchId: batch.id,
            efficiencyPercent: round((units / (units + waste)) * 100),
            productionNotes: text(input.notes, "Notas", 2000, true),
          });
        }
      } else if (kind === "incident") {
        const types = [
          "falta_materia_prima",
          "falla_maquinaria",
          "merma_excesiva",
          "espacio_freezer",
          "falta_envases",
          "otro",
        ];
        if (
          !types.includes(input.type) ||
          !["baja", "media", "alta", "critica"].includes(input.severity)
        )
          reject("Incidencia inválida.");
        doc.factoryIncidents.unshift({
          id,
          timestamp: new Date().toISOString(),
          reportedBy: actorName,
          type: input.type,
          severity: input.severity,
          message: text(input.message, "Detalle"),
          resolved: false,
        });
      } else if (kind === "incident-resolve") {
        const incident = doc.factoryIncidents.find(
          (entry) => entry.id === input.incidentId,
        );
        if (!incident) reject("Incidencia no encontrada.", 404);
        incident.resolved = true;
        incident.resolvedAt = new Date().toISOString();
        incident.resolvedNotes = text(input.notes, "Detalle", 2000, true);
      } else if (kind === "import-local") {
        const legacy = object(sanitizeLegacyValue(input.state));
        for (const collection of FACTORY_COLLECTIONS)
          if (
            legacy[collection] !== undefined &&
            (!Array.isArray(legacy[collection]) ||
              legacy[collection].length > 10000)
          )
            reject("Respaldo de fábrica demasiado grande o inválido.");
        for (const collection of [
          "rawMaterials",
          "suppliers",
          "supplyCategories",
          "recipes",
        ] as const) {
          if (!Array.isArray(legacy[collection])) continue;
          for (const row of legacy[collection]) {
            validateResourceId(row.id);
            if (doc[collection].some((entry) => entry.id === row.id)) continue;
            await this.validateCatalog(collection, row, client, doc);
            (doc[collection] as any[]).push(row);
          }
        }
        for (const row of Array.isArray(legacy.productionBatches)
          ? legacy.productionBatches
          : []) {
          validateResourceId(row.id);
          if (doc.productionBatches.some((entry) => entry.id === row.id))
            continue;
          const variety = (
            await client.query(
              "SELECT name FROM product_varieties WHERE id=$1",
              [validateResourceId(row.varietyId)],
            )
          ).rows[0];
          if (!variety) reject("Un lote anterior usa un producto inexistente.");
          quantity(row.unitsProduced, "Unidades producidas", false, true);
          quantity(
            row.remainingUnitsInCentral,
            "Existencias anteriores",
            true,
            true,
          );
          if (row.remainingUnitsInCentral > row.unitsProduced)
            reject("Un lote anterior excede lo producido.");
          money(row.totalBatchCost, "Costo anterior");
          money(row.laborCost, "Mano de obra");
          money(row.energyAndPackagingCost, "Energía");
          const ingredients = Array.isArray(row.ingredientsUsed)
            ? row.ingredientsUsed
            : [];
          if (ingredients.length > 100)
            reject("Ingredientes anteriores inválidos.");
          for (const entry of ingredients) {
            validateResourceId(entry.materialId);
            quantity(entry.quantity, "Cantidad anterior", true);
            money(entry.cost, "Costo anterior");
            text(entry.materialName, "Ingrediente anterior", 120);
          }
          doc.productionBatches.push({
            id: row.id,
            date: text(row.date, "Fecha anterior", 10),
            varietyId: row.varietyId,
            varietyName: variety.name,
            unitsProduced: row.unitsProduced,
            remainingUnitsInCentral: row.remainingUnitsInCentral,
            ingredientsUsed: ingredients,
            laborCost: row.laborCost,
            energyAndPackagingCost: row.energyAndPackagingCost,
            totalBatchCost: row.totalBatchCost,
            status: row.remainingUnitsInCentral
              ? "en_camara_central"
              : "distribuido",
            notes: text(row.notes, "Notas anteriores", 2000, true),
            unitCostCalculated: round(row.totalBatchCost / row.unitsProduced),
          });
        }
        // Los movimientos previos se archivan, no vuelven a acreditar stock a casas.
        await client.query(
          "INSERT INTO factory_commands(id,actor_id,request_hash,result) VALUES($1,$2,$3,$4)",
          [id, actor.userId, digest, JSON.stringify({ id })],
        );
        await client.query(
          "INSERT INTO factory_legacy_archives(id,actor_id,payload) VALUES($1,$2,$3)",
          [id, actor.userId, JSON.stringify(legacy)],
        );
      } else reject("Operación de fábrica no admitida.");
      await client.query(
        "UPDATE factory_state SET payload=$1,updated_at=clock_timestamp() WHERE id=1",
        [JSON.stringify(doc)],
      );
      const result = { id, entityId };
      if (kind !== "import-local")
        await client.query(
          "INSERT INTO factory_commands(id,actor_id,request_hash,result) VALUES($1,$2,$3,$4)",
          [id, actor.userId, digest, JSON.stringify(result)],
        );
      await client.query(
        `INSERT INTO audit_logs(id,user_id,user_name,user_role,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,'FACTORY_COMMAND','produccion',$5,$6)`,
        [id, actor.userId, actorName, actor.role, entityId, kind],
      );
      return result;
    });
  }
  private async validateCatalog(
    collection: string,
    row: any,
    client: PoolClient,
    doc: FactoryState,
  ): Promise<void> {
    row.name = text(row.name, "Nombre", 120);
    row.isActive ??= true;
    if (row.isActive !== undefined && typeof row.isActive !== "boolean")
      reject("Estado inválido.");
    if (collection === "rawMaterials") {
      if (
        !["kg", "litro", "unidad", "paquete", "gramos", "cc"].includes(row.unit)
      )
        reject("Unidad inválida.");
      quantity(row.currentStock, "Stock", true);
      quantity(row.minStockAlert, "Alerta", true);
      money(row.costPerUnit, "Costo unitario");
    }
    if (collection === "recipes") {
      quantity(row.expectedYield, "Rendimiento");
      money(row.estimatedLaborCost, "Mano de obra");
      money(row.estimatedEnergyPackagingCost, "Energía");
      if (
        !["tequenos", "aderezos_salsas", "masa_base", "otro"].includes(
          row.type,
        ) ||
        !["unidad", "kg", "litro", "pote"].includes(row.outputUnit)
      )
        reject("Tipo o unidad de receta inválidos.");
      if (!Array.isArray(row.ingredients) || row.ingredients.length > 100)
        reject("Ingredientes inválidos.");
      const seen = new Set();
      for (const entry of row.ingredients) {
        validateResourceId(entry.materialId);
        const material = doc.rawMaterials.find(
          (material) => material.id === entry.materialId,
        );
        if (!material) reject("Ingrediente de receta no encontrado.");
        entry.materialName = material.name;
        entry.unit = material.unit;
        quantity(entry.quantityRequired, "Ingrediente");
        if (seen.has(entry.materialId)) reject("Ingrediente repetido.");
        seen.add(entry.materialId);
      }
      if (
        row.varietyId &&
        !(
          await client.query(
            "SELECT id FROM product_varieties WHERE id=$1 AND is_active=TRUE",
            [validateResourceId(row.varietyId)],
          )
        ).rowCount
      )
        reject("Producto de receta no disponible.");
    }
    if (collection === "suppliers") {
      row.suppliedCategoryIds ??= [];
      row.suppliedMaterialIds ??= [];
      text(row.phone ?? "", "Teléfono", 100, true);
      if (
        !Array.isArray(row.suppliedCategoryIds) ||
        !Array.isArray(row.suppliedMaterialIds)
      )
        reject("Proveedor inválido.");
    }
  }
  private async batch(
    client: PoolClient,
    doc: FactoryState,
    input: any,
    id: string,
  ): Promise<ProductionBatch> {
    const variety = (
      await client.query(
        "SELECT name FROM product_varieties WHERE id=$1 AND is_active=TRUE",
        [validateResourceId(input.varietyId)],
      )
    ).rows[0];
    if (!variety) reject("Producto no disponible.");
    const units = quantity(
      input.unitsProduced,
      "Unidades producidas",
      false,
      true,
    );
    const labor = money(input.laborCost, "Mano de obra"),
      energy = money(input.energyAndPackagingCost, "Energía");
    if (
      !Array.isArray(input.ingredientsUsed) ||
      input.ingredientsUsed.length > 100
    )
      reject("Ingredientes inválidos.");
    const seen = new Set();
    const ingredients = [];
    for (const entry of input.ingredientsUsed) {
      const material = doc.rawMaterials.find(
        (row) => row.id === entry.materialId && row.isActive,
      );
      if (!material) reject("Ingrediente no disponible.");
      if (seen.has(material.id)) reject("Ingrediente repetido.");
      seen.add(material.id);
      const used = quantity(entry.quantity, "Cantidad de ingrediente");
      if (material.currentStock < used)
        reject("Insumos insuficientes para producir el lote.", 409);
      material.currentStock = Number((material.currentStock - used).toFixed(6));
      ingredients.push({
        materialId: material.id,
        materialName: material.name,
        quantity: used,
        cost: round(used * material.costPerUnit),
      });
    }
    const total = round(
      labor + energy + ingredients.reduce((sum, entry) => sum + entry.cost, 0),
    );
    money(total, "Costo del lote");
    return {
      id,
      date: today(),
      varietyId: input.varietyId,
      varietyName: variety.name,
      unitsProduced: units,
      ingredientsUsed: ingredients,
      laborCost: labor,
      energyAndPackagingCost: energy,
      totalBatchCost: total,
      unitCostCalculated: round(total / units),
      status: "en_camara_central",
      remainingUnitsInCentral: units,
      notes: text(input.notes, "Notas", 2000, true),
    };
  }
}
export const productionRepository = new ProductionRepository();
