import { Category, Product } from '../types';

export interface CategoryFilterOption {
  id: string;
  name: string;
  nameBn?: string;
}

const VIRTUAL_PREFIX = 'name::';

/**
 * Resolves the effective display category name for a product.
 * Handles normal products, renamed categories, legacy/mock IDs, and CSV-imported
 * products where categoryName is set even if categoryId points to a fallback ID.
 */
export function resolveProductCategoryName(
  product: Pick<Product, 'categoryId' | 'categoryName'> | undefined | null,
  categories: Category[]
): string {
  if (!product) return 'General';

  const rawName = (product.categoryName || '').trim();
  const matchedById = product.categoryId
    ? categories.find(c => c.id === product.categoryId)
    : undefined;

  if (matchedById) {
    // If product has a specific non-General categoryName that differs from matchedById.name
    // (common when CSV import fell back to categories[0].id), prefer the product's own categoryName.
    if (
      rawName &&
      rawName.toLowerCase() !== 'general' &&
      rawName.toLowerCase() !== matchedById.name.trim().toLowerCase()
    ) {
      return rawName;
    }
    return matchedById.name.trim() || 'General';
  }

  if (rawName) {
    // If a category with the same name exists in categories, use its canonical casing
    const matchedByName = categories.find(
      c => c.name.trim().toLowerCase() === rawName.toLowerCase()
    );
    return matchedByName ? matchedByName.name.trim() : rawName;
  }

  return 'General';
}

/**
 * Builds a unified, deduplicated list of category options combining:
 * 1. All configured categories from settings/state
 * 2. Any extra category names found on existing products (e.g. CSV imports, legacy data)
 */
export function getUnifiedCategoryOptions(
  categories: Category[],
  products: Pick<Product, 'categoryId' | 'categoryName'>[]
): CategoryFilterOption[] {
  const options: CategoryFilterOption[] = [];
  const seenNames = new Set<string>();

  categories.forEach(c => {
    const cleanName = (c.name || '').trim();
    if (!cleanName) return;
    const key = cleanName.toLowerCase();
    if (seenNames.has(key)) return;
    seenNames.add(key);
    options.push({
      id: c.id,
      name: cleanName,
      nameBn: c.nameBn,
    });
  });

  products.forEach(p => {
    const resolvedName = resolveProductCategoryName(p, categories);
    if (!resolvedName) return;
    const key = resolvedName.toLowerCase();
    if (seenNames.has(key)) return;
    seenNames.add(key);
    options.push({
      id: `${VIRTUAL_PREFIX}${key}`,
      name: resolvedName,
    });
  });

  return options;
}

/**
 * Checks whether a product matches the selected category filter value.
 * Supports real category IDs, virtual `name::...` options, and fallback name matching.
 */
export function matchesCategoryFilter(
  product: Pick<Product, 'categoryId' | 'categoryName'> | undefined | null,
  selectedCategoryValue: string,
  categories: Category[]
): boolean {
  if (!selectedCategoryValue || selectedCategoryValue === 'ALL') return true;
  if (!product) return false;

  const isVirtual = selectedCategoryValue.startsWith(VIRTUAL_PREFIX);
  let targetName = '';

  if (isVirtual) {
    targetName = selectedCategoryValue.slice(VIRTUAL_PREFIX.length).trim().toLowerCase();
  } else {
    const selectedCat = categories.find(c => c.id === selectedCategoryValue);
    targetName = selectedCat
      ? selectedCat.name.trim().toLowerCase()
      : selectedCategoryValue.trim().toLowerCase();
  }

  const productCatName = resolveProductCategoryName(product, categories).trim().toLowerCase();
  if (productCatName === targetName) return true;

  // Also check raw categoryId when product has no conflicting non-General categoryName
  if (!isVirtual && product.categoryId === selectedCategoryValue) {
    const rawName = (product.categoryName || '').trim().toLowerCase();
    if (!rawName || rawName === 'general' || rawName === targetName) {
      return true;
    }
  }

  return false;
}

/**
 * Resolves a human-readable category label for display badges, Print headers, and PDF metadata.
 */
export function getCategoryLabelByValue(
  selectedCategoryValue: string,
  categories: Category[],
  products: Pick<Product, 'categoryId' | 'categoryName'>[],
  allLabel = 'All Categories'
): string {
  if (!selectedCategoryValue || selectedCategoryValue === 'ALL') return allLabel;
  const options = getUnifiedCategoryOptions(categories, products);
  const found = options.find(opt => opt.id === selectedCategoryValue);
  if (found) return found.name;
  if (selectedCategoryValue.startsWith(VIRTUAL_PREFIX)) {
    return selectedCategoryValue.slice(VIRTUAL_PREFIX.length);
  }
  return selectedCategoryValue;
}
