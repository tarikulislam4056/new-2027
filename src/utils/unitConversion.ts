import { Product } from '../types';

export interface UnitQuantityLike {
  quantity?: number;
  returnQuantity?: number;
  unit?: string;
  conversionFactor?: number;
  baseQuantity?: number;
}

/**
 * Formats numbers cleanly: integers without decimals, fractions trimmed up to 2 decimal places.
 */
export function formatCleanNumber(value: number): string {
  const num = Number(value) || 0;
  if (Math.abs(num - Math.round(num)) < 1e-6) {
    return String(Math.round(num));
  }
  return String(Number(num.toFixed(2)));
}

/**
 * Returns true if the product defines a bulk purchase unit distinct from its base/sales unit
 * with a conversion factor > 1 (e.g., 1 CTN = 12 Pcs).
 */
export function hasDualUnit(product?: Partial<Product> | null): boolean {
  if (!product?.purchaseUnit) return false;
  const conv = Number(product.unitConversion || 0);
  if (!(conv > 1)) return false;
  const baseUnit = (product.unit || 'Pcs').trim().toLowerCase();
  const purchUnit = product.purchaseUnit.trim().toLowerCase();
  return purchUnit.length > 0 && purchUnit !== baseUnit;
}

/**
 * Returns the multiplier (in base units) for a chosen transaction unit on a product.
 * E.g. if 1 CTN = 12 Pcs, returns 12 for 'CTN' and 1 for 'Pcs'.
 */
export function getUnitMultiplier(
  product?: Partial<Product> | null,
  selectedUnit?: string | null
): number {
  if (!hasDualUnit(product) || !selectedUnit) return 1;
  if (selectedUnit.trim().toLowerCase() === product!.purchaseUnit!.trim().toLowerCase()) {
    return Number(product!.unitConversion);
  }
  return 1;
}

/**
 * Resolves the effective conversion factor for a line item.
 * Prefers explicitly persisted `conversionFactor`, falling back to product configuration.
 */
export function getEffectiveConversionFactor(
  item: { unit?: string; conversionFactor?: number } | null | undefined,
  product?: Partial<Product> | null
): number {
  if (item && Number(item.conversionFactor) > 0) {
    return Number(item.conversionFactor);
  }
  return getUnitMultiplier(product, item?.unit);
}

/**
 * Resolves the base-unit quantity for a line item (e.g. 1 CTN -> 12 Pcs).
 * Prefers explicitly persisted `baseQuantity`, falling back to quantity * factor.
 */
export function getBaseQuantity(
  item: UnitQuantityLike | null | undefined,
  product?: Partial<Product> | null
): number {
  if (!item) return 0;
  if (typeof item.baseQuantity === 'number' && Number.isFinite(item.baseQuantity) && item.baseQuantity >= 0) {
    return item.baseQuantity;
  }
  const qty = Number(item.quantity ?? item.returnQuantity ?? 0);
  const factor = getEffectiveConversionFactor(item, product);
  return Number((qty * factor).toFixed(4));
}

/**
 * Normalizes a bulk price down to per-base-unit price (e.g. ৳1200 / 12 = ৳100 per Pcs).
 */
export function computeNormalizedItemCost(price: number, factor: number): number {
  const numPrice = Number(price) || 0;
  if (factor > 0) {
    return Number((numPrice / factor).toFixed(6));
  }
  return numPrice;
}

/**
 * Formats a base stock amount into carton + loose pieces breakdown when dual-unit is active.
 * Returns null if not dual-unit, <= 0, or strictly less than 1 carton.
 */
export function formatCartonBreakdown(
  stock: number,
  product?: Partial<Product> | null
): string | null {
  if (!hasDualUnit(product)) return null;
  const conv = Number(product!.unitConversion);
  const pUnit = product!.purchaseUnit!;
  const bUnit = product!.unit || 'Pcs';
  const abs = Number(stock) || 0;
  if (abs <= 0 || abs + 1e-9 < conv) return null;

  const cartons = Math.floor((abs + 1e-9) / conv);
  const rem = Number((abs - cartons * conv).toFixed(2));
  if (rem > 1e-6) {
    return `${formatCleanNumber(cartons)} ${pUnit} + ${formatCleanNumber(rem)} ${bUnit}`;
  }
  return `${formatCleanNumber(cartons)} ${pUnit}`;
}

/**
 * Formats stock with base unit and optional carton breakdown, e.g.:
 * `12 Pcs (1 CTN)`, `16 Pcs (1 CTN + 4 Pcs)`, or `4 Pcs`.
 */
export function formatStockWithUnit(
  stock: number,
  product?: Partial<Product> | null
): string {
  const num = Number(stock) || 0;
  const bUnit = product?.unit || 'Pcs';
  const baseText = `${formatCleanNumber(num)} ${bUnit}`;
  const breakdown = formatCartonBreakdown(num, product);
  return breakdown ? `${baseText} (${breakdown})` : baseText;
}

/**
 * Returns deduplicated unit options for a product row, putting the product's
 * base unit and bulk purchase unit first.
 */
export function getProductUnitOptions(
  product: Partial<Product> | null | undefined,
  globalUnits: string[],
  extraUnit?: string | null
): string[] {
  const candidates = [
    product?.unit,
    product?.purchaseUnit,
    extraUnit || undefined,
    ...globalUnits,
  ];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of candidates) {
    if (!raw) continue;
    const trimmed = String(raw).trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(trimmed);
    }
  }
  return result.length > 0 ? result : ['Pcs'];
}
