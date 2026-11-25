export interface CatalogFood {
  id: string;
  name: string;
  kcal: number;
  basis: '100g' | '100ml';
  referenceType?: 'source_example';
  kcalPerPortion?: number;
  servingSourceUrl?: string;
}

export function normalizeFoodName(name: string) {
  return name.normalize('NFKC').toLowerCase().replace(/\s/gu, '');
}

export function searchFoods(foods: readonly CatalogFood[], query: string, limit = 15) {
  const needle = normalizeFoodName(query);
  if (!needle) return [];
  const exact: CatalogFood[] = [];
  const prefix: CatalogFood[] = [];
  const partial: CatalogFood[] = [];
  for (const food of foods) {
    const name = normalizeFoodName(food.name);
    if (name === needle) exact.push(food);
    else if (name.startsWith(needle)) prefix.push(food);
    else if (name.includes(needle)) partial.push(food);
  }
  return [...exact, ...prefix, ...partial].slice(0, limit);
}

export function searchFoodTerms(foods: readonly CatalogFood[], query: string) {
  const terms = new Map<string, string>();
  for (const part of query.split(/[,，]/u)) {
    const term = part.trim();
    const key = normalizeFoodName(term);
    if (key && !terms.has(key)) terms.set(key, term);
    if (terms.size === 12) break;
  }
  return [...terms].map(([key, term]) => ({
    key,
    term,
    matches: searchFoods(foods, term, terms.size === 1 ? 15 : 5),
  }));
}
