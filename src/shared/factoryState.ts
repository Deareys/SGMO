import type {
  RawMaterial,
  ProductionRecipe,
  ProductionOrder,
  ProductionBatch,
  MaterialPurchase,
  SupplyCategory,
  Supplier,
  FactoryIncident,
  StockTransfer,
} from "../types";
export interface FactoryState {
  rawMaterials: RawMaterial[];
  recipes: ProductionRecipe[];
  productionOrders: ProductionOrder[];
  productionBatches: ProductionBatch[];
  materialPurchases: MaterialPurchase[];
  supplyCategories: SupplyCategory[];
  suppliers: Supplier[];
  factoryIncidents: FactoryIncident[];
  transfers: StockTransfer[];
}
export const FACTORY_COLLECTIONS = [
  "rawMaterials",
  "recipes",
  "productionOrders",
  "productionBatches",
  "materialPurchases",
  "supplyCategories",
  "suppliers",
  "factoryIncidents",
  "transfers",
] as const;
export function emptyFactoryState(): FactoryState {
  return Object.fromEntries(
    FACTORY_COLLECTIONS.map((key) => [key, []]),
  ) as unknown as FactoryState;
}
