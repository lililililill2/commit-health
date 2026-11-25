import { useQuery } from '@tanstack/react-query';

import type { CatalogFood } from './catalog-search';

interface FoodCatalog {
  version: string;
  foods: CatalogFood[];
}

export function useFoodCatalog(enabled: boolean) {
  return useQuery({
    queryKey: ['food-catalog'],
    enabled,
    queryFn: async ({ signal }): Promise<FoodCatalog> => {
      const response = await fetch('/food-catalog/foods-final.json', { signal, cache: 'no-cache' });
      if (!response.ok) throw new Error('Food catalog unavailable');
      return response.json() as Promise<FoodCatalog>;
    },
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    retry: false,
  });
}
