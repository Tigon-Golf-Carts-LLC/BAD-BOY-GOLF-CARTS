/**
 * Pure inventory helpers shared by the build-time data fetcher (script/fetch-data.ts)
 * and the browser (client/src/lib/static-data.ts).
 *
 * The site is fully static, so everything the Express proxy used to do — sorting,
 * filtering, pagination, slug building — now happens either at build time or in
 * the browser against the JSON snapshot in /data.
 */
import type { Cart, Store } from "./schema";

export const DMS_BASE_URL = "https://api.tigondms.com/wp-website";

/** Cart fields kept in the lightweight /data/carts.json index. */
export type CartIndexEntry = Cart & { _search?: string };

export interface SlugMap {
  slugToId: Record<string, string>;
  idToSlug: Record<string, string>;
}

export interface CartFilters {
  searchText?: string;
  isNew?: boolean;
  isUsed?: boolean;
  isElectric?: boolean;
  isGas?: boolean;
  isStreetLegal?: boolean;
  isLifted?: boolean;
  makes?: string[];
  models?: string[];
  colors?: string[];
  seats?: string[];
  driveTrain?: string[];
  storeIds?: string[];
}

export function slugifyPart(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Normalizes a make label ("Club Car") into the DMS make key ("club_car"). */
export function makeKeyOf(make: string): string {
  return make.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

export function storeIdOf(cart: Cart): string {
  return cart?.cartLocation?.locationId || cart?.cartLocation?.latestStoreId || "";
}

/**
 * Slugs are derived from make/model/color/city/state/country and de-duplicated
 * with a numeric suffix, matching the URLs the Express server used to serve.
 */
export function buildSlugMap(carts: Cart[], stores: Store[]): SlugMap {
  const storeMap = new Map<string, Store>();
  for (const store of stores) {
    if (store.storeId) storeMap.set(store.storeId, store);
  }

  const slugToId: Record<string, string> = {};
  const idToSlug: Record<string, string> = {};
  const slugCounts: Record<string, number> = {};

  for (const cart of carts) {
    const make = cart?.cartType?.make || "";
    const model = cart?.cartType?.model || "";
    const color = cart?.cartAttributes?.cartColor || "";
    const store = storeMap.get(storeIdOf(cart));
    const city = store?.address?.city || "";
    const state = store?.address?.state || "";
    const country = store?.address?.country || "USA";

    const parts = [make, model, color, city, state, country].map(slugifyPart).filter(Boolean);
    const baseSlug = parts.length > 0 ? parts.join("-") : `cart-${cart._id}`;

    let finalSlug: string;
    if (slugCounts[baseSlug] === undefined) {
      slugCounts[baseSlug] = 0;
      finalSlug = baseSlug;
    } else {
      slugCounts[baseSlug]++;
      finalSlug = `${baseSlug}-${String(slugCounts[baseSlug]).padStart(2, "0")}`;
    }

    slugToId[finalSlug] = cart._id;
    idToSlug[cart._id] = finalSlug;
  }

  return { slugToId, idToSlug };
}

/** New carts with photos first, then new without, then used with photos, then the rest. */
export function sortCarts<T extends Cart>(carts: T[], priceSortASC?: boolean | null): T[] {
  const score = (cart: Cart): number => {
    const isNew = cart.isUsed !== true;
    const hasImages = !!(cart.imageUrls && cart.imageUrls.length > 0);
    if (isNew && hasImages) return 4;
    if (isNew && !hasImages) return 3;
    if (!isNew && hasImages) return 2;
    return 1;
  };

  return [...carts].sort((a, b) => {
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;

    if (priceSortASC === true) {
      return (a.retailPrice || 999999) - (b.retailPrice || 999999);
    }
    if (priceSortASC === false) {
      return (b.retailPrice || 0) - (a.retailPrice || 0);
    }
    return 0;
  });
}

function digitsOf(value: string): string {
  const match = value.match(/\d+/);
  return match ? match[0] : "";
}

function matchesAny(values: string[], candidate: string | null | undefined): boolean {
  if (values.length === 0) return true;
  const target = (candidate || "").trim().toLowerCase();
  if (!target) return false;
  return values.some((v) => v.trim().toLowerCase() === target);
}

export function buildSearchBlob(cart: Cart, store?: Store): string {
  return [
    cart?.cartType?.make,
    cart?.cartType?.model,
    cart?.cartType?.year,
    cart?.cartAttributes?.cartColor,
    cart?.cartAttributes?.seatColor,
    cart?.cartAttributes?.driveTrain,
    cart?.isUsed ? "used" : "new",
    cart?.isElectric ? "electric" : "gas",
    cart?.vinNo,
    cart?.serialNo,
    store?.name,
    store?.address?.city,
    store?.address?.state,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Client-side equivalent of the filters the DMS API used to apply server-side. */
export function filterCarts<T extends CartIndexEntry>(carts: T[], filters: CartFilters): T[] {
  const makes = filters.makes || [];
  const models = filters.models || [];
  const colors = filters.colors || [];
  const seatDigits = (filters.seats || []).map(digitsOf).filter(Boolean);
  const driveDigits = (filters.driveTrain || []).map(digitsOf).filter(Boolean);
  const storeIds = filters.storeIds || [];
  const searchTerms = (filters.searchText || "").trim().toLowerCase().split(/\s+/).filter(Boolean);

  return carts.filter((cart) => {
    // "New" and "Used" checked together behaves like no condition filter at all.
    if (filters.isNew && !filters.isUsed && cart.isUsed === true) return false;
    if (filters.isUsed && !filters.isNew && cart.isUsed !== true) return false;

    if (filters.isElectric && !filters.isGas && cart.isElectric !== true) return false;
    if (filters.isGas && !filters.isElectric && cart.isElectric === true) return false;

    if (filters.isStreetLegal && cart.title?.isStreetLegal !== true) return false;
    if (filters.isLifted && cart.cartAttributes?.isLifted !== true) return false;

    if (!matchesAny(makes, cart.cartType?.make)) return false;
    if (!matchesAny(models, cart.cartType?.model)) return false;
    if (!matchesAny(colors, cart.cartAttributes?.cartColor)) return false;

    if (seatDigits.length > 0) {
      const passengers = digitsOf(cart.cartAttributes?.passengers || "");
      if (!passengers || !seatDigits.includes(passengers)) return false;
    }

    if (driveDigits.length > 0) {
      const drive = digitsOf(cart.cartAttributes?.driveTrain || "");
      if (!drive || !driveDigits.includes(drive)) return false;
    }

    if (storeIds.length > 0 && !storeIds.includes(storeIdOf(cart))) return false;

    if (searchTerms.length > 0) {
      const blob = cart._search || buildSearchBlob(cart);
      if (!searchTerms.every((term) => blob.includes(term))) return false;
    }

    return true;
  });
}

/** Parses the `/api/carts?...` style query string the pages still build. */
export function parseCartsQuery(queryString: string): {
  filters: CartFilters;
  pageNumber: number;
  pageSize: number;
  priceSortASC: boolean | null;
} {
  const params = new URLSearchParams(queryString);
  const list = (key: string) =>
    params.get(key) ? params.get(key)!.split(",").map((v) => v.trim()).filter(Boolean) : [];

  return {
    pageNumber: parseInt(params.get("pageNumber") || "0", 10) || 0,
    pageSize: Math.min(parseInt(params.get("pageSize") || "20", 10) || 20, 500),
    priceSortASC: params.get("priceSortASC") === null ? null : params.get("priceSortASC") === "true",
    filters: {
      searchText: params.get("searchText") || "",
      isNew: params.get("isNew") === "true",
      isUsed: params.get("isUsed") === "true",
      isElectric: params.get("isElectric") === "true",
      isGas: params.get("isGas") === "true",
      isStreetLegal: params.get("isStreetLegal") === "true",
      isLifted: params.get("isLifted") === "true",
      makes: list("makes"),
      models: list("models"),
      colors: list("colors"),
      seats: list("seats"),
      driveTrain: list("driveTrain"),
      storeIds: list("storeIds"),
    },
  };
}
