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

/** Digits only + common UPC-A → EAN-13 padding so OFF lookups succeed more often. */
export function normalizeBarcode(raw: string): string[] {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 4) return [];
  const out = new Set<string>([digits]);
  if (digits.length === 12) out.add(`0${digits}`); // UPC-A → EAN-13
  if (digits.length === 13 && digits.startsWith('0')) out.add(digits.slice(1));
  if (digits.length === 8) out.add(digits); // EAN-8
  return [...out];
}

function mapOffProduct(barcode: string, p: Record<string, unknown>): OffProduct {
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

async function fetchOffProduct(
  env: Env,
  barcode: string,
): Promise<OffProduct | null> {
  const headers = { 'User-Agent': env.OPEN_FOOD_FACTS_USER_AGENT };

  // Prefer v2, then legacy v0 — some regional codes only resolve on one.
  const urls = [
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
    `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        status?: number;
        product?: Record<string, unknown>;
      };
      if (json.status === 1 && json.product) {
        return mapOffProduct(barcode, json.product);
      }
    } catch {
      // try next
    }
  }
  return null;
}

export async function fetchByBarcode(env: Env, barcode: string): Promise<OffProduct> {
  const candidates = normalizeBarcode(barcode);
  if (candidates.length === 0) {
    throw new AppError(400, 'Invalid barcode', 'INVALID_BARCODE');
  }

  let lastNetworkFail = false;
  for (const code of candidates) {
    try {
      const product = await fetchOffProduct(env, code);
      if (product) return product;
    } catch {
      lastNetworkFail = true;
    }
  }

  if (lastNetworkFail) {
    throw new AppError(502, 'Open Food Facts unavailable', 'OFF_UNAVAILABLE');
  }
  throw new AppError(
    404,
    'Product not found in Open Food Facts. Try Browse or Describe meal instead.',
    'PRODUCT_NOT_FOUND',
  );
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
