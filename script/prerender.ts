/**
 * Post-build step for GitHub Pages.
 *
 * Vite emits a single-page app. GitHub Pages has no rewrite rules, so every URL
 * that should be reachable directly needs a real file on disk. This script:
 *   - writes an index.html for /inventory, /financing and every /golfcart/<slug>,
 *     each with its own title, description, canonical and structured data
 *   - writes 404.html as the SPA fallback for anything else
 *   - writes CNAME (custom domain) and .nojekyll
 *
 * Sitemaps, feeds and robots.txt are produced earlier by script/generate-seo.ts,
 * which writes them into client/public so Vite copies them into dist.
 */
import { mkdir, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import type { Cart, Store } from "../shared/schema";
import { S3_CARTS_URL } from "../shared/schema";
import type { CartIndexEntry, SlugMap } from "../shared/inventory";
import { storeIdOf } from "../shared/inventory";

const DIST = path.resolve(import.meta.dirname, "..", "dist");
const DATA = path.join(DIST, "data");

const SITE_DOMAIN = process.env.SITE_DOMAIN || "badboygolfcarts.com";
const BASE_PATH = (process.env.BASE_PATH || "/").replace(/\/$/, "");
const SITE_URL = `https://${SITE_DOMAIN}${BASE_PATH}`;
const SITE_NAME = "Bad Boy Golf Carts";
const PHONE_NUMBER = "1-888-840-4490";
const WRITE_CNAME = process.env.WRITE_CNAME !== "false" && BASE_PATH === "";
const DEFAULT_SHARE_IMAGE = `${SITE_URL}/og-image.png`;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  const target = path.join(DATA, file);
  if (!existsSync(target)) return fallback;
  return JSON.parse(await readFile(target, "utf-8")) as T;
}

interface PageMeta {
  title: string;
  description: string;
  url: string;
  image?: string;
  jsonLd?: unknown;
}

/** Rewrites the head of the built index.html for one route. */
function renderPage(shell: string, meta: PageMeta): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const url = escapeHtml(meta.url);

  let html = shell
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description" content="[\s\S]*?"\s*\/>/, `<meta name="description" content="${description}" />`)
    .replace(/<meta property="og:title" content="[\s\S]*?"\s*\/>/, `<meta property="og:title" content="${title}" />`)
    .replace(
      /<meta property="og:description" content="[\s\S]*?"\s*\/>/,
      `<meta property="og:description" content="${description}" />`,
    )
    .replace(/<meta property="og:url" content="[\s\S]*?"\s*\/>/, `<meta property="og:url" content="${url}" />`)
    .replace(/<meta name="twitter:title" content="[\s\S]*?"\s*\/>/, `<meta name="twitter:title" content="${title}" />`)
    .replace(
      /<meta name="twitter:description" content="[\s\S]*?"\s*\/>/,
      `<meta name="twitter:description" content="${description}" />`,
    )
    .replace(/<link rel="canonical" href="[\s\S]*?"\s*\/>/, `<link rel="canonical" href="${url}" />`);

  // Cart pages share their own photo; every other page shares the brand card.
  // Rewriting both keeps the URL correct when the build targets another domain.
  const shareImage = escapeHtml(meta.image || DEFAULT_SHARE_IMAGE);
  html = html
    .replace(/<meta property="og:image" content="[\s\S]*?"\s*\/>/, `<meta property="og:image" content="${shareImage}" />`)
    .replace(/<meta name="twitter:image" content="[\s\S]*?"\s*\/>/, `<meta name="twitter:image" content="${shareImage}" />`)
    .replace(/<meta property="og:image:alt" content="[\s\S]*?"\s*\/>/, `<meta property="og:image:alt" content="${title}" />`);

  const extraHead: string[] = [];
  if (meta.jsonLd) {
    extraHead.push(
      `<script type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, "\\u003c")}</script>`,
    );
  }

  if (extraHead.length > 0) {
    html = html.replace("</head>", `    ${extraHead.join("\n    ")}\n  </head>`);
  }
  return html;
}

async function writePage(routePath: string, html: string) {
  const target = routePath === "" ? path.join(DIST, "index.html") : path.join(DIST, routePath, "index.html");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, html);
}

function cartTitle(cart: Cart): string {
  const condition = cart.isUsed ? "Used" : "New";
  const parts = [condition, cart.cartType?.year, cart.cartType?.make, cart.cartType?.model].filter(Boolean);
  return parts.join(" ") || "Golf Cart";
}

function cartImage(cart: Cart): string | undefined {
  const first = cart.imageUrls?.[0];
  return first ? (first.startsWith("http") ? first : `${S3_CARTS_URL}${first}`) : undefined;
}

async function main() {
  const shellPath = path.join(DIST, "index.html");
  if (!existsSync(shellPath)) {
    throw new Error("dist/index.html not found - run `vite build` before prerendering");
  }
  const shell = await readFile(shellPath, "utf-8");

  const [carts, stores, slugMap] = await Promise.all([
    readJson<CartIndexEntry[]>("carts.json", []),
    readJson<Store[]>("stores.json", []),
    readJson<SlugMap>("slug-map.json", { slugToId: {}, idToSlug: {} }),
  ]);

  const storeMap = new Map<string, Store>();
  for (const store of stores) {
    if (store.storeId) storeMap.set(store.storeId, store);
  }
  const cartById = new Map<string, CartIndexEntry>();
  for (const cart of carts) cartById.set(cart._id, cart);

  // Home page - keep the shell's own copy, just pin the canonical URL.
  await writePage(
    "",
    renderPage(shell, {
      title: `${SITE_NAME} | New & Used Golf Cart Inventory Updated Daily | ${SITE_DOMAIN}`,
      description: `Browse discounted golf cart inventory at ${SITE_DOMAIN}. Updated daily with the best deals on new and used golf carts. Premium brands including Denago, Evolution, Club Car, EZGO, Yamaha and more. Street legal, electric, and gas golf carts available nationwide. Call ${PHONE_NUMBER}.`,
      url: `${SITE_URL}/`,
    }),
  );

  await writePage(
    "inventory",
    renderPage(shell, {
      title: `Golf Cart Inventory - ${carts.length} Discounted Carts | ${SITE_NAME}`,
      description: `Browse ${carts.length} discounted new and used golf carts. Filter by brand, condition, power type, color, seating, drivetrain and location. Updated daily. Call ${PHONE_NUMBER}.`,
      url: `${SITE_URL}/inventory`,
    }),
  );

  await writePage(
    "financing",
    renderPage(shell, {
      title: `Golf Cart Financing - 0% APR for 48 Months | ${SITE_NAME}`,
      description: `Golf cart financing with 0% APR for 48 months on approved credit. Fast approvals on new and used golf carts. Call ${PHONE_NUMBER} to apply.`,
      url: `${SITE_URL}/financing`,
    }),
  );

  // One real page per cart so search engines and shared links resolve directly.
  let cartPages = 0;
  for (const [slug, cartId] of Object.entries(slugMap.slugToId)) {
    const cart = cartById.get(cartId);
    if (!cart) continue;

    const title = cartTitle(cart);
    const color = cart.cartAttributes?.cartColor || "";
    const store = storeMap.get(storeIdOf(cart));
    const location = store ? `${store.address?.city || ""}, ${store.address?.state || ""}`.trim() : "";
    const price = cart.retailPrice || 0;
    const image = cartImage(cart);
    const url = `${SITE_URL}/golfcart/${slug}`;

    const description =
      `${title}${color ? ` in ${color}` : ""}${location ? ` available in ${location}` : ""}. ` +
      `${cart.isElectric ? "Electric" : "Gas"} golf cart${cart.title?.isStreetLegal ? ", street legal" : ""}` +
      `${price ? ` - $${price.toLocaleString("en-US")}` : ""}. Call ${PHONE_NUMBER} for the best discounted price.`;

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: title + (color ? ` ${color}` : ""),
      description,
      url,
      ...(image ? { image } : {}),
      ...(cart.cartType?.make ? { brand: { "@type": "Brand", name: cart.cartType.make } } : {}),
      ...(cart.cartType?.model ? { model: cart.cartType.model } : {}),
      itemCondition: cart.isUsed ? "https://schema.org/UsedCondition" : "https://schema.org/NewCondition",
      offers: {
        "@type": "Offer",
        url,
        priceCurrency: "USD",
        ...(price ? { price } : {}),
        availability: "https://schema.org/InStock",
        seller: { "@type": "AutoDealer", name: SITE_NAME, telephone: PHONE_NUMBER },
      },
    };

    await writePage(`golfcart/${slug}`, renderPage(shell, { title: `${title} | ${SITE_NAME}`, description, url, image, jsonLd }));
    cartPages++;
  }

  // GitHub Pages serves 404.html for unknown paths; the SPA then routes client-side.
  await writeFile(
    path.join(DIST, "404.html"),
    renderPage(shell, {
      title: `Page Not Found | ${SITE_NAME}`,
      description: `The page you are looking for is not available. Browse discounted golf carts at ${SITE_DOMAIN} or call ${PHONE_NUMBER}.`,
      url: `${SITE_URL}/404`,
    }),
  );

  await writeFile(path.join(DIST, ".nojekyll"), "");
  if (WRITE_CNAME) {
    await writeFile(path.join(DIST, "CNAME"), `${SITE_DOMAIN}\n`);
  }

  console.log(
    `Prerendered ${cartPages} cart pages + home/inventory/financing/404` +
      `${WRITE_CNAME ? `, CNAME (${SITE_DOMAIN})` : ""}`,
  );
}

main().catch((error) => {
  console.error(`\nprerender failed: ${(error as Error).message}`);
  process.exit(1);
});
