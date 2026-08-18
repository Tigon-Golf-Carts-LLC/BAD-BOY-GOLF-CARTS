/**
 * Build-time inventory snapshot.
 *
 * GitHub Pages can only serve static files, and the Tigon DMS API does not send
 * CORS headers, so the browser cannot call it directly. Instead this script runs
 * during the build (in GitHub Actions), pulls everything the site needs from the
 * DMS API, and writes it as static JSON into client/public/data/. Vite copies
 * that directory into the published site.
 *
 * Re-run the deploy workflow (it is also scheduled daily) to refresh inventory.
 */
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import type { Cart, CartModel, Store } from "../shared/schema";
import {
  DMS_BASE_URL,
  buildSearchBlob,
  buildSlugMap,
  makeKeyOf,
  sortCarts,
  storeIdOf,
  type CartIndexEntry,
} from "../shared/inventory";

const OUT_DIR = path.resolve(import.meta.dirname, "..", "client", "public", "data");
const PAGE_SIZE = 500;
const MAX_PAGES = 40;

async function fetchDMS<T>(endpoint: string, body?: unknown): Promise<T> {
  const url = `${DMS_BASE_URL}${endpoint}`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: body ? "POST" : "GET",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        throw new Error(`DMS API error: ${response.status} ${response.statusText}`);
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        const delay = attempt * 2000;
        console.warn(`  ${endpoint} failed (attempt ${attempt}/3), retrying in ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

async function fetchAllCarts(): Promise<Cart[]> {
  const all: Cart[] = [];
  for (let pageNumber = 0; pageNumber < MAX_PAGES; pageNumber++) {
    const data = await fetchDMS<{ carts?: Cart[] }>("/get-carts", { pageNumber, pageSize: PAGE_SIZE });
    const carts = data?.carts || [];
    all.push(...carts);
    console.log(`  page ${pageNumber}: ${carts.length} carts (${all.length} total)`);
    if (carts.length < PAGE_SIZE) break;
  }
  return all;
}

/** The card grid and the filters only need a subset of each cart. */
function toIndexEntry(cart: Cart, store?: Store): CartIndexEntry {
  return {
    _id: cart._id,
    cartType: {
      make: cart.cartType?.make ?? null,
      model: cart.cartType?.model ?? null,
      year: cart.cartType?.year ?? null,
    },
    retailPrice: cart.retailPrice ?? null,
    isElectric: cart.isElectric ?? null,
    isUsed: cart.isUsed ?? null,
    cartAttributes: {
      cartColor: cart.cartAttributes?.cartColor ?? null,
      passengers: cart.cartAttributes?.passengers ?? null,
      driveTrain: cart.cartAttributes?.driveTrain ?? null,
      isLifted: cart.cartAttributes?.isLifted ?? null,
    },
    title: { isStreetLegal: cart.title?.isStreetLegal ?? null },
    cartLocation: {
      locationId: cart.cartLocation?.locationId ?? null,
      latestStoreId: cart.cartLocation?.latestStoreId ?? null,
    },
    imageUrls: cart.imageUrls && cart.imageUrls.length > 0 ? [cart.imageUrls[0]] : [],
    _search: buildSearchBlob(cart, store),
  };
}

async function writeJson(relativePath: string, data: unknown) {
  const target = path.join(OUT_DIR, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(data));
}

async function main() {
  console.log(`Fetching inventory from ${DMS_BASE_URL} ...`);

  const [carts, stores] = await Promise.all([
    fetchAllCarts(),
    fetchDMS<Store[]>("/tigon-stores").catch((error) => {
      console.warn(`  stores unavailable: ${(error as Error).message}`);
      return [] as Store[];
    }),
  ]);

  if (carts.length === 0) {
    throw new Error(
      "DMS API returned zero carts - refusing to publish an empty site. " +
        "The previous deployment stays live; re-run the workflow once the API recovers.",
    );
  }

  const storeMap = new Map<string, Store>();
  for (const store of stores || []) {
    if (store.storeId) storeMap.set(store.storeId, store);
  }

  // Brands, derived from the inventory itself.
  const makeMap = new Map<string, string>();
  for (const cart of carts) {
    const make = cart?.cartType?.make;
    if (make && make.trim()) {
      const key = makeKeyOf(make);
      if (!makeMap.has(key)) makeMap.set(key, make);
    }
  }
  const brands = Array.from(makeMap.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const makeKeys = brands.map((b) => b.key);

  // Models and colors, per make, so the filter sidebar keeps working offline.
  let models: CartModel[] = [];
  const colors: Record<string, string[]> = {};
  if (makeKeys.length > 0) {
    models = await fetchDMS<CartModel[]>("/get-cart-models", { makeKeys }).catch((error) => {
      console.warn(`  models unavailable: ${(error as Error).message}`);
      return [] as CartModel[];
    });

    for (const key of makeKeys) {
      const result = await fetchDMS<Array<{ color: string }>>("/get-cart-colors", { makeKeys: [key] }).catch(
        () => [] as Array<{ color: string }>,
      );
      colors[key] = result.map((c) => c.color).filter(Boolean);
    }
  }

  const slugMap = buildSlugMap(carts, stores || []);
  const sorted = sortCarts(carts);
  const index = sorted.map((cart) => toIndexEntry(cart, storeMap.get(storeIdOf(cart))));

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  await writeJson("carts.json", index);
  await writeJson("stores.json", stores || []);
  await writeJson("brands.json", brands);
  await writeJson("models.json", models);
  await writeJson("colors.json", colors);
  await writeJson("slug-map.json", slugMap);

  // One file per cart for the detail pages, so a visitor only downloads the cart
  // they actually opened.
  for (const cart of carts) {
    const detail: Cart = { ...cart };
    delete (detail as Record<string, unknown>).internalCartImageUrls;
    await writeJson(path.join("cart", `${cart._id}.json`), detail);
  }

  await writeJson("meta.json", {
    generatedAt: new Date().toISOString(),
    totalCarts: carts.length,
    totalStores: (stores || []).length,
    totalBrands: brands.length,
  });

  console.log(
    `Wrote ${carts.length} carts, ${(stores || []).length} stores, ${brands.length} brands, ` +
      `${models.length} models to client/public/data`,
  );
}

main().catch((error) => {
  console.error(`\nfetch-data failed: ${(error as Error).message}`);
  process.exit(1);
});
