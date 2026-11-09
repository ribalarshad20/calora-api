import type { Env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';

export type OffProduct = {
  barcode: string;
  name: string;
  brand: string;
  servingUnit: string;
  servingGrams: number | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  imageUrl: string | null;
};

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchByBarcode(env: Env, barcode: string): Promise<OffProduct> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': env.OPEN_FOOD_FACTS_USER_AGENT },
  });
  if (!res.ok) throw new AppError(502, 'Open Food Facts unavailable', 'OFF_UNAVAILABLE');
  const json = (await res.json()) as {
    status: number;
    product?: Record<string, unknown>;
  };
  if (json.status !== 1 || !json.product) {
    throw new AppError(404, 'Product not found', 'PRODUCT_NOT_FOUND');
  }
  const p = json.product;
  const nutriments = (p.nutriments ?? {}) as Record<string, unknown>;
  return {
    barcode,
    name: String(p.product_name || p.generic_name || 'Unknown product'),
    brand: String(p.brands || ''),
    servingUnit: '100g',
    servingGrams: 100,
    calories: num(nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal']),
    proteinG: num(nutriments.proteins_100g),
    carbsG: num(nutriments.carbohydrates_100g),
    fatG: num(nutriments.fat_100g),
    imageUrl: (p.image_front_small_url as string) || (p.image_url as string) || null,
  };
}

export async function searchOff(env: Env, query: string, page = 1): Promise<OffProduct[]> {
  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
  url.searchParams.set('search_terms', query);
  url.searchParams.set('search_simple', '1');
  url.searchParams.set('action', 'process');
  url.searchParams.set('json', '1');
  url.searchParams.set('page', String(page));
  url.searchParams.set('page_size', '20');
  url.searchParams.set('fields', 'code,product_name,brands,nutriments,image_front_small_url');

  const res = await fetch(url, {
    headers: { 'User-Agent': env.OPEN_FOOD_FACTS_USER_AGENT },
  });
  if (!res.ok) throw new AppError(502, 'Open Food Facts unavailable', 'OFF_UNAVAILABLE');
  const json = (await res.json()) as { products?: Record<string, unknown>[] };
  return (json.products ?? [])
    .filter((p) => p.code && p.product_name)
    .map((p) => {
      const nutriments = (p.nutriments ?? {}) as Record<string, unknown>;
      return {
        barcode: String(p.code),
        name: String(p.product_name),
        brand: String(p.brands || ''),
        servingUnit: '100g',
        servingGrams: 100,
        calories: num(nutriments['energy-kcal_100g']),
        proteinG: num(nutriments.proteins_100g),
        carbsG: num(nutriments.carbohydrates_100g),
        fatG: num(nutriments.fat_100g),
        imageUrl: (p.image_front_small_url as string) || null,
      };
    });
}
