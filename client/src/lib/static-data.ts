/**
 * Static data layer.
 *
 * On GitHub Pages there is no Express proxy, so the JSON snapshot written by
 * script/fetch-data.ts (served from /data) is the API. Filtering, sorting and
 * pagination that used to happen on the server now happen here in the browser.
 */
import type { Cart, CartModel, Store } from "@shared/schema";
import {
  filterCarts,
  parseCartsQuery,
  sortCarts,
  type CartIndexEntry,
  type SlugMap,
} from "@shared/inventory";

export interface CartsResult {
  carts: CartIndexEntry[];
  totalCarts: number;
}

export interface SiteMeta {
  generatedAt: string;
  totalCarts: number;
  totalStores: number;
  totalBrands: number;
}

export interface Brand {
  key: string;
  label: string;
}

/** BASE_URL is "/" for a custom domain and "/<repo>/" for a project site. */
const DATA_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/data`;

const inflight = new Map<string, Promise<unknown>>();

function loadJson<T>(file: string): Promise<T> {
  const existing = inflight.get(file);
  if (existing) return existing as Promise<T>;

  const request = fetch(`${DATA_BASE}/${file}`)
    .then((res) => {
      if (!res.ok) throw new Error(`${res.status}: failed to load ${file}`);
      return res.json() as Promise<T>;
    })
    .catch((error) => {
      inflight.delete(file);
      throw error;
    });

  inflight.set(file, request);
  return request;
}

export const getCartIndex = () => loadJson<CartIndexEntry[]>("carts.json");
export const getStores = () => loadJson<Store[]>("stores.json");
export const getBrands = () => loadJson<Brand[]>("brands.json");
export const getSlugMap = () => loadJson<SlugMap>("slug-map.json");
export const getMeta = () => loadJson<SiteMeta>("meta.json");

export async function getModels(makeKeys: string[]): Promise<CartModel[]> {
  if (makeKeys.length === 0) return [];
  const models = await loadJson<CartModel[]>("models.json");
  return models.filter((model) => makeKeys.includes(model.makeKey));
}

export async function getColors(makeKeys: string[]): Promise<string[]> {
  if (makeKeys.length === 0) return [];
  const colorsByMake = await loadJson<Record<string, string[]>>("colors.json");
  const unique = new Set<string>();
  for (const key of makeKeys) {
    for (const color of colorsByMake[key] || []) unique.add(color);
  }
  return Array.from(unique).sort((a, b) => a.localeCompare(b));
}

/** Mirrors the old `GET /api/carts?...` response. */
export async function getCarts(queryString: string): Promise<CartsResult> {
  const { filters, pageNumber, pageSize, priceSortASC } = parseCartsQuery(queryString);
  const index = await getCartIndex();

  const matched = filterCarts(index, filters);
  // carts.json is already stored in default order; only re-sort when a price
  // sort is requested.
  const ordered = priceSortASC === null ? matched : sortCarts(matched, priceSortASC);

  const start = pageNumber * pageSize;
  return { carts: ordered.slice(start, start + pageSize), totalCarts: ordered.length };
}

export function getCart(cartId: string): Promise<Cart> {
  return loadJson<Cart>(`cart/${cartId}.json`);
}

/** Routes the query keys the pages already use to the static data above. */
export async function resolveStaticQuery(key: string): Promise<unknown> {
  if (key === "/api/stores") return getStores();
  if (key === "/api/brands") return getBrands();
  if (key === "/api/slug-map") return getSlugMap();
  if (key === "/api/meta") return getMeta();
  if (key.startsWith("/api/carts")) return getCarts(key.split("?")[1] || "");
  if (key.startsWith("/api/cart/")) return getCart(key.slice("/api/cart/".length));
  throw new Error(`No static data source for "${key}"`);
}
