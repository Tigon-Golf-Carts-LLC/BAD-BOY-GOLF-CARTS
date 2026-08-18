/**
 * Generates every data-driven SEO / AI / discovery file into client/public.
 *
 * Runs after script/fetch-data.ts (so it can read the DMS inventory snapshot in
 * client/public/data) and before `vite build` (so Vite copies the results into
 * dist/). Without a snapshot it still emits every file, containing the static
 * pages and store locations only.
 *
 * Static, hand-written files (llms.txt, ai.txt, gpt.txt, claude.txt, seo.txt,
 * nlp.txt, training.txt, crawlers.txt, bots.txt, humans.txt, security.txt,
 * ads.txt, accessibility.txt, compliance.txt, performance.txt, images.txt,
 * geo.txt, schema.json, manifest.json, browserconfig.xml, opensearch.xml) are
 * NOT touched here - only robots.txt's sitemap block is rewritten.
 */
import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import type { Cart, Store } from "../shared/schema";
import type { CartIndexEntry, SlugMap } from "../shared/inventory";
import { storeIdOf } from "../shared/inventory";
import { STORE_LOCATIONS, SERVICE_STATES, type StoreLocation } from "../shared/locations";
import {
  BASE_PATH,
  BUILD_DATE,
  DATA_DIR,
  DMS_API,
  EMAIL,
  NOW_ISO,
  PHONE_E164,
  PHONE_NUMBER,
  PLACEHOLDER_IMAGE,
  PUBLIC_DIR,
  RFC822,
  SITE_DOMAIN,
  SITE_NAME,
  SITE_URL,
  TODAY,
  absoluteUrl,
  clean,
  hasSnapshot,
  imageUrl,
  readData,
  sitemapIndex,
  urlset,
  xmlEscape,
  type SitemapEntry,
} from "./seo-lib";

interface Brand {
  key: string;
  label: string;
}

interface CartRecord {
  id: string;
  slug: string;
  title: string;
  url: string;
  make: string;
  model: string;
  year: string;
  color: string;
  condition: "New" | "Used";
  power: "Electric" | "Gas";
  streetLegal: boolean;
  lifted: boolean;
  passengers: string;
  driveTrain: string;
  price: number;
  images: string[];
  storeId: string;
  location?: StoreLocation;
  storeCity: string;
  storeState: string;
}

const written: string[] = [];

async function write(relativePath: string, contents: string) {
  const target = path.join(PUBLIC_DIR, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
  written.push(relativePath);
}

function titleOf(cart: CartIndexEntry): string {
  const condition = cart.isUsed ? "Used" : "New";
  return [condition, cart.cartType?.year, cart.cartType?.make, cart.cartType?.model]
    .filter(Boolean)
    .join(" ")
    .trim() || "Golf Cart";
}

/** Matches a DMS store to the verified location record by city name. */
function matchLocation(store: Store | undefined): StoreLocation | undefined {
  if (!store) return undefined;
  const city = (store.address?.city || "").toLowerCase();
  if (!city) return undefined;
  return STORE_LOCATIONS.find(
    (l) => l.city.toLowerCase() === city || l.city.toLowerCase().includes(city) || city.includes(l.slug.replace(/-/g, " ")),
  );
}

/** Reads the per-cart detail files so image sitemaps can list every photo. */
async function loadDetailImages(): Promise<Map<string, string[]>> {
  const images = new Map<string, string[]>();
  const cartDir = path.join(DATA_DIR, "cart");
  if (!existsSync(cartDir)) return images;

  const files = await readdir(cartDir);
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const cart = JSON.parse(await readFile(path.join(cartDir, file), "utf-8")) as Cart;
      if (cart._id && cart.imageUrls && cart.imageUrls.length > 0) {
        images.set(cart._id, cart.imageUrls.slice(0, 10));
      }
    } catch {
      // A malformed detail file should not fail the whole build.
    }
  }
  return images;
}

async function buildCartRecords(): Promise<CartRecord[]> {
  const [index, stores, slugMap] = await Promise.all([
    readData<CartIndexEntry[]>("carts.json", []),
    readData<Store[]>("stores.json", []),
    readData<SlugMap>("slug-map.json", { slugToId: {}, idToSlug: {} }),
  ]);
  const detailImages = await loadDetailImages();

  const storeById = new Map<string, Store>();
  for (const store of stores) if (store.storeId) storeById.set(store.storeId, store);

  const records: CartRecord[] = [];
  for (const cart of index) {
    const slug = slugMap.idToSlug[cart._id];
    if (!slug) continue;

    const storeId = storeIdOf(cart);
    const store = storeById.get(storeId);
    const location = matchLocation(store);
    const files = detailImages.get(cart._id) || cart.imageUrls || [];

    records.push({
      id: cart._id,
      slug,
      title: titleOf(cart),
      url: absoluteUrl(`/golfcart/${slug}`),
      make: clean(cart.cartType?.make),
      model: clean(cart.cartType?.model),
      year: clean(cart.cartType?.year),
      color: clean(cart.cartAttributes?.cartColor),
      condition: cart.isUsed ? "Used" : "New",
      power: cart.isElectric ? "Electric" : "Gas",
      streetLegal: cart.title?.isStreetLegal === true,
      lifted: cart.cartAttributes?.isLifted === true,
      passengers: clean(cart.cartAttributes?.passengers),
      driveTrain: clean(cart.cartAttributes?.driveTrain),
      price: cart.retailPrice || 0,
      images: files.map((f) => imageUrl(f)),
      storeId,
      location,
      storeCity: clean(store?.address?.city || location?.city),
      storeState: clean(store?.address?.state || location?.state),
    });
  }
  return records;
}

const facetUrl = (param: string, value: string) =>
  absoluteUrl(`/inventory?${param}=${encodeURIComponent(value)}`);

function uniqueSorted(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v && v.length > 0))).sort((a, b) =>
    a.localeCompare(b),
  );
}

async function main() {
  const carts = await buildCartRecords();
  const brands = await readData<Brand[]>("brands.json", []);
  const stores = await readData<Store[]>("stores.json", []);
  const snapshot = hasSnapshot();

  const makes = uniqueSorted(carts.map((c) => c.make));
  const models = new Map<string, Set<string>>();
  for (const cart of carts) {
    if (!cart.make || !cart.model) continue;
    if (!models.has(cart.make)) models.set(cart.make, new Set());
    models.get(cart.make)!.add(cart.model);
  }
  const colors = uniqueSorted(carts.map((c) => c.color));
  const seatOptions = uniqueSorted(carts.map((c) => c.passengers));
  const driveTrains = uniqueSorted(carts.map((c) => c.driveTrain));
  const cities = uniqueSorted([...carts.map((c) => c.storeCity), ...STORE_LOCATIONS.map((l) => l.city)]);

  const staticPages: SitemapEntry[] = [
    { loc: absoluteUrl("/"), lastmod: TODAY, changefreq: "weekly", priority: "1.0" },
    { loc: absoluteUrl("/inventory"), lastmod: TODAY, changefreq: "daily", priority: "0.9" },
    { loc: absoluteUrl("/financing"), lastmod: TODAY, changefreq: "monthly", priority: "0.8" },
  ];

  // ---------------------------------------------------------------- sitemaps
  await write(
    "sitemap-pages.xml",
    urlset(staticPages, { comment: `Primary pages - ${SITE_NAME}` }),
  );
  await write(
    "page-sitemap.xml",
    urlset(staticPages, { comment: "Static page sitemap (alias of sitemap-pages.xml)" }),
  );

  await write(
    "sitemap-brands.xml",
    urlset(
      makes.map((make) => ({
        loc: facetUrl("make", make),
        lastmod: TODAY,
        changefreq: "daily",
        priority: "0.85",
      })),
      { comment: `Brand landing pages - ${makes.length} manufacturers in stock` },
    ),
  );

  const categoryEntries: SitemapEntry[] = [
    ...["New", "Used"].map((condition) => ({
      loc: facetUrl("condition", condition),
      lastmod: TODAY,
      changefreq: "daily",
      priority: "0.85",
    })),
    ...["Electric", "Gas"].map((power) => ({
      loc: facetUrl("powerType", power),
      lastmod: TODAY,
      changefreq: "daily",
      priority: "0.8",
    })),
    ...seatOptions.map((seats) => ({
      loc: facetUrl("seats", seats),
      lastmod: TODAY,
      changefreq: "weekly",
      priority: "0.7",
    })),
    ...driveTrains.map((drive) => ({
      loc: facetUrl("driveTrain", drive),
      lastmod: TODAY,
      changefreq: "weekly",
      priority: "0.7",
    })),
    { loc: facetUrl("isStreetLegal", "true"), lastmod: TODAY, changefreq: "daily", priority: "0.8" },
    { loc: facetUrl("isLifted", "true"), lastmod: TODAY, changefreq: "weekly", priority: "0.7" },
  ];
  await write("category-sitemap.xml", urlset(categoryEntries, { comment: "Category and feature facets" }));

  const tagEntries: SitemapEntry[] = [];
  for (const [make, modelSet] of Array.from(models.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const model of Array.from(modelSet).sort()) {
      tagEntries.push({
        loc: absoluteUrl(
          `/inventory?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`,
        ),
        lastmod: TODAY,
        changefreq: "daily",
        priority: "0.8",
      });
    }
  }
  for (const color of colors) {
    tagEntries.push({ loc: facetUrl("color", color), lastmod: TODAY, changefreq: "weekly", priority: "0.6" });
  }
  await write("tag-sitemap.xml", urlset(tagEntries, { comment: "Model and colour tag pages" }));

  await write(
    "geo-sitemap.xml",
    urlset(
      cities.map((city) => {
        const location = STORE_LOCATIONS.find((l) => l.city.toLowerCase() === city.toLowerCase());
        return {
          loc: facetUrl("location", city),
          lastmod: TODAY,
          changefreq: "daily",
          priority: "0.8",
          images: location
            ? [
                {
                  loc: PLACEHOLDER_IMAGE,
                  title: `${SITE_NAME} - ${location.city}, ${location.stateCode}`,
                  caption: `Golf carts for sale in ${location.city}, ${location.state}`,
                  geoLocation: `${location.city}, ${location.state}, USA`,
                },
              ]
            : undefined,
        };
      }),
      { comment: `Location pages - ${STORE_LOCATIONS.length} stores across ${SERVICE_STATES.length} states` },
    ),
  );

  const cartEntries: SitemapEntry[] = carts.map((cart) => ({
    loc: cart.url,
    lastmod: TODAY,
    changefreq: "daily",
    priority: "0.9",
    images: cart.images.slice(0, 10).map((image, i) => ({
      loc: image,
      title: cart.title,
      caption:
        i === 0
          ? `${cart.title}${cart.color ? ` in ${cart.color}` : ""} - ${SITE_NAME}`
          : `${cart.title} - photo ${i + 1}`,
      geoLocation: cart.storeCity ? `${cart.storeCity}, ${cart.storeState}, USA` : undefined,
    })),
  }));
  await write(
    "dynamic-sitemap.xml",
    urlset(cartEntries, { comment: `Individual vehicle pages - ${carts.length} carts in stock` }),
  );

  const imageEntries = cartEntries.filter((entry) => (entry.images?.length || 0) > 0);
  const imageSitemap = urlset(imageEntries, {
    comment: `Image sitemap - ${imageEntries.reduce((sum, e) => sum + (e.images?.length || 0), 0)} images`,
  });
  await write("sitemap-images.xml", imageSitemap);
  await write("image-sitemap.xml", imageSitemap);

  await write(
    "mobile-sitemap.xml",
    urlset(
      [...staticPages, ...cartEntries.slice(0, 1000)].map((entry) => ({
        ...entry,
        images: undefined,
        extra: "    <mobile:mobile/>\n",
      })),
      { comment: "Mobile sitemap - the site is fully responsive, every URL serves both form factors", mobile: true },
    ),
  );

  const alternates = (loc: string) =>
    `    <xhtml:link rel="alternate" hreflang="en-US" href="${xmlEscape(loc)}"/>\n` +
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(loc)}"/>\n`;
  const hreflangEntries = staticPages.map((entry) => ({ ...entry, extra: alternates(entry.loc) }));
  await write(
    "hreflang-sitemap.xml",
    urlset(hreflangEntries, { comment: "hreflang alternates - en-US and x-default", xhtml: true }),
  );
  await write(
    "xhtml-sitemap.xml",
    urlset([...hreflangEntries, ...cartEntries.slice(0, 1000).map((e) => ({ ...e, extra: alternates(e.loc) }))], {
      comment: "XHTML sitemap with language alternates",
      xhtml: true,
    }),
  );

  await write(
    "urllist.xml",
    urlset(
      [
        ...staticPages,
        ...makes.map((make) => ({ loc: facetUrl("make", make), lastmod: TODAY })),
        ...cities.map((city) => ({ loc: facetUrl("location", city), lastmod: TODAY })),
        ...carts.map((cart) => ({ loc: cart.url, lastmod: TODAY })),
      ].map((entry) => ({ ...entry, images: undefined })),
      { comment: "Flat list of every indexable URL", image: false },
    ),
  );

  // Content types the site does not publish yet. The files exist so the URLs
  // resolve, but they stay out of sitemap.xml so Search Console is not told to
  // fetch an empty sitemap.
  const emptyNote = (what: string) =>
    urlset([], { comment: `${what} - no ${what.toLowerCase()} published yet. Regenerated on every build.` });
  await write("sitemap-blog.xml", emptyNote("Blog sitemap"));
  await write("post-sitemap.xml", emptyNote("Post sitemap"));
  await write("author-sitemap.xml", emptyNote("Author sitemap"));
  await write("events-sitemap.xml", emptyNote("Events sitemap"));
  await write(
    "news-sitemap.xml",
    urlset([], {
      comment:
        "Google News sitemap - reserved for future news articles. Inventory listings are not news content, so no URLs are listed.",
      news: true,
    }),
  );

  const indexedSitemaps = [
    "sitemap-pages.xml",
    "page-sitemap.xml",
    "sitemap-brands.xml",
    "category-sitemap.xml",
    "tag-sitemap.xml",
    "geo-sitemap.xml",
    "dynamic-sitemap.xml",
    "sitemap-images.xml",
    "image-sitemap.xml",
    "mobile-sitemap.xml",
    "hreflang-sitemap.xml",
    "xhtml-sitemap.xml",
    "urllist.xml",
  ];
  await write("sitemap.xml", sitemapIndex(indexedSitemaps));

  // ------------------------------------------------------------------ feeds
  await writeProductFeeds(carts, stores);
  await writeSyndicationFeeds(carts);
  await writeDataFeeds(carts, brands, makes, cities);

  // -------------------------------------------------------------- locations
  await writeLocationFiles(stores);

  // -------------------------------------------------------------- AI corpus
  await writeLlmsFull(carts, brands, makes, models, colors, seatOptions, driveTrains);

  // ------------------------------------------------------------- robots.txt
  await updateRobots(indexedSitemaps);

  // ------------------------------------------ refresh the hand-written files
  await refreshStaticFiles({
    carts: carts.length,
    brands: makes.length || brands.length,
    hasSnapshot: snapshot,
  });

  console.log(
    `Generated ${written.length} SEO/AI files in client/public ` +
      `(${snapshot ? `${carts.length} carts, ${makes.length} brands` : "no inventory snapshot - static content only"}, ` +
      `${STORE_LOCATIONS.length} locations)`,
  );
}

/* -------------------------------------------------------------------------- */
/* Product feeds                                                              */
/* -------------------------------------------------------------------------- */

function merchantItem(cart: CartRecord, extra = ""): string {
  const description =
    `${cart.title}${cart.color ? ` in ${cart.color}` : ""}. ` +
    `${cart.power} golf cart${cart.streetLegal ? ", street legal" : ""}` +
    `${cart.passengers ? `, ${cart.passengers} passenger` : ""}` +
    `${cart.driveTrain ? `, ${cart.driveTrain}` : ""}` +
    `${cart.storeCity ? `. Available in ${cart.storeCity}, ${cart.storeState}` : ""}. ` +
    `Call ${PHONE_NUMBER}.`;

  let item = `    <item>\n`;
  item += `      <g:id>${xmlEscape(cart.id)}</g:id>\n`;
  item += `      <g:title>${xmlEscape(cart.title + (cart.color ? ` ${cart.color}` : ""))}</g:title>\n`;
  item += `      <g:description>${xmlEscape(description)}</g:description>\n`;
  item += `      <g:link>${xmlEscape(cart.url)}</g:link>\n`;
  item += `      <g:image_link>${xmlEscape(cart.images[0] || PLACEHOLDER_IMAGE)}</g:image_link>\n`;
  for (const image of cart.images.slice(1, 11)) {
    item += `      <g:additional_image_link>${xmlEscape(image)}</g:additional_image_link>\n`;
  }
  item += `      <g:availability>in_stock</g:availability>\n`;
  item += `      <g:condition>${cart.condition === "Used" ? "used" : "new"}</g:condition>\n`;
  if (cart.price > 0) item += `      <g:price>${cart.price.toFixed(2)} USD</g:price>\n`;
  if (cart.make) item += `      <g:brand>${xmlEscape(cart.make)}</g:brand>\n`;
  if (cart.model) item += `      <g:mpn>${xmlEscape(cart.model)}</g:mpn>\n`;
  item += `      <g:identifier_exists>no</g:identifier_exists>\n`;
  item += `      <g:google_product_category>Vehicles &amp; Parts &gt; Vehicles &gt; Motor Vehicles</g:google_product_category>\n`;
  item += `      <g:product_type>Golf Carts &gt; ${xmlEscape(cart.condition)} &gt; ${xmlEscape(cart.make || "Golf Cart")}</g:product_type>\n`;
  if (cart.year) item += `      <g:product_detail><g:section_name>Vehicle</g:section_name><g:attribute_name>Year</g:attribute_name><g:attribute_value>${xmlEscape(cart.year)}</g:attribute_value></g:product_detail>\n`;
  if (cart.passengers) item += `      <g:product_detail><g:section_name>Vehicle</g:section_name><g:attribute_name>Passengers</g:attribute_name><g:attribute_value>${xmlEscape(cart.passengers)}</g:attribute_value></g:product_detail>\n`;
  item += `      <g:product_detail><g:section_name>Vehicle</g:section_name><g:attribute_name>Power</g:attribute_name><g:attribute_value>${cart.power}</g:attribute_value></g:product_detail>\n`;
  item += extra;
  item += `    </item>\n`;
  return item;
}

function rssShell(title: string, description: string, body: string, extraNs = ""): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"${extraNs}>\n`;
  xml += `  <channel>\n`;
  xml += `    <title>${xmlEscape(title)}</title>\n`;
  xml += `    <link>${xmlEscape(SITE_URL)}/</link>\n`;
  xml += `    <description>${xmlEscape(description)}</description>\n`;
  xml += `    <lastBuildDate>${RFC822}</lastBuildDate>\n`;
  xml += body;
  xml += `  </channel>\n</rss>\n`;
  return xml;
}

async function writeProductFeeds(carts: CartRecord[], stores: Store[]) {
  const sellable = carts.filter((cart) => cart.price > 0);

  await write(
    "product_feed.xml",
    rssShell(
      `${SITE_NAME} - Product Feed`,
      `Google Merchant Center product feed for ${SITE_NAME}. ${sellable.length} golf carts with pricing. Updated daily.`,
      sellable.map((cart) => merchantItem(cart)).join(""),
    ),
  );

  await write(
    "google-shopping-feed.xml",
    rssShell(
      `${SITE_NAME} - Google Shopping Feed`,
      `Google Shopping feed for ${SITE_NAME}. New and used golf carts, updated daily. Call ${PHONE_NUMBER}.`,
      sellable
        .map((cart) =>
          merchantItem(
            cart,
            `      <g:custom_label_0>${xmlEscape(cart.condition)}</g:custom_label_0>\n` +
              `      <g:custom_label_1>${cart.power}</g:custom_label_1>\n` +
              (cart.storeCity ? `      <g:custom_label_2>${xmlEscape(cart.storeCity)}</g:custom_label_2>\n` : "") +
              (cart.streetLegal ? `      <g:custom_label_3>Street Legal</g:custom_label_3>\n` : ""),
          ),
        )
        .join(""),
    ),
  );

  const storeById = new Map<string, Store>();
  for (const store of stores) if (store.storeId) storeById.set(store.storeId, store);

  const localItems = carts
    .filter((cart) => cart.storeId)
    .map((cart) => {
      const store = storeById.get(cart.storeId);
      let item = `    <item>\n`;
      item += `      <g:store_code>${xmlEscape(cart.storeId)}</g:store_code>\n`;
      item += `      <g:id>${xmlEscape(cart.id)}</g:id>\n`;
      item += `      <g:quantity>1</g:quantity>\n`;
      if (cart.price > 0) item += `      <g:price>${cart.price.toFixed(2)} USD</g:price>\n`;
      item += `      <g:availability>in_stock</g:availability>\n`;
      item += `      <g:pickup_method>buy</g:pickup_method>\n`;
      item += `      <g:pickup_sla>same_day</g:pickup_sla>\n`;
      if (store?.name) item += `      <g:store_name>${xmlEscape(store.name)}</g:store_name>\n`;
      if (cart.storeCity) {
        item += `      <g:store_address>${xmlEscape(
          [store?.address?.address1, cart.storeCity, cart.storeState, store?.address?.postalCode]
            .filter(Boolean)
            .join(", "),
        )}</g:store_address>\n`;
      }
      item += `    </item>\n`;
      return item;
    });

  await write(
    "local-inventory-feed.xml",
    rssShell(
      `${SITE_NAME} - Local Inventory Feed`,
      `Google local inventory feed: per-store golf cart availability across ${STORE_LOCATIONS.length} locations.`,
      localItems.join(""),
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* Syndication feeds                                                          */
/* -------------------------------------------------------------------------- */

async function writeSyndicationFeeds(carts: CartRecord[]) {
  const latest = carts.slice(0, 50);

  const rssItems = latest
    .map((cart) => {
      const description =
        `${cart.title}${cart.color ? ` in ${cart.color}` : ""}` +
        `${cart.price > 0 ? ` - $${cart.price.toLocaleString("en-US")}` : " - call for price"}` +
        `${cart.storeCity ? `, available in ${cart.storeCity}, ${cart.storeState}` : ""}.`;
      return (
        `    <item>\n` +
        `      <title>${xmlEscape(cart.title)}</title>\n` +
        `      <link>${xmlEscape(cart.url)}</link>\n` +
        `      <guid isPermaLink="true">${xmlEscape(cart.url)}</guid>\n` +
        `      <description>${xmlEscape(description)}</description>\n` +
        `      <pubDate>${RFC822}</pubDate>\n` +
        (cart.make ? `      <category>${xmlEscape(cart.make)}</category>\n` : "") +
        `    </item>\n`
      );
    })
    .join("");

  const rss =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
    `  <channel>\n` +
    `    <title>${xmlEscape(SITE_NAME)} - Latest Inventory</title>\n` +
    `    <link>${SITE_URL}/inventory</link>\n` +
    `    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>\n` +
    `    <description>Newly listed discounted golf carts from ${SITE_NAME}. Updated daily. Call ${PHONE_NUMBER}.</description>\n` +
    `    <language>en-US</language>\n` +
    `    <lastBuildDate>${RFC822}</lastBuildDate>\n` +
    `    <ttl>1440</ttl>\n` +
    rssItems +
    `  </channel>\n</rss>\n`;

  await write("rss.xml", rss);
  await write("feed.xml", rss);

  const atomEntries = latest
    .map(
      (cart) =>
        `  <entry>\n` +
        `    <title>${xmlEscape(cart.title)}</title>\n` +
        `    <link href="${xmlEscape(cart.url)}"/>\n` +
        `    <id>${xmlEscape(cart.url)}</id>\n` +
        `    <updated>${NOW_ISO}</updated>\n` +
        `    <summary>${xmlEscape(
          `${cart.title}${cart.color ? ` in ${cart.color}` : ""}${cart.price > 0 ? ` - $${cart.price.toLocaleString("en-US")}` : ""}`,
        )}</summary>\n` +
        `  </entry>\n`,
    )
    .join("");

  await write(
    "atom.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en-US">\n` +
      `  <title>${xmlEscape(SITE_NAME)} - Latest Inventory</title>\n` +
      `  <link href="${SITE_URL}/atom.xml" rel="self"/>\n` +
      `  <link href="${SITE_URL}/inventory"/>\n` +
      `  <id>${SITE_URL}/</id>\n` +
      `  <updated>${NOW_ISO}</updated>\n` +
      `  <author><name>${xmlEscape(SITE_NAME)}</name><email>${EMAIL}</email></author>\n` +
      `  <subtitle>Discounted new and used golf carts, updated daily.</subtitle>\n` +
      atomEntries +
      `</feed>\n`,
  );

  await write(
    "podcast.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<!-- Podcast feed placeholder. ${SITE_NAME} does not publish a podcast yet; the channel is valid and ready for episodes. -->\n` +
      `<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">\n` +
      `  <channel>\n` +
      `    <title>${xmlEscape(SITE_NAME)} Golf Cart Podcast</title>\n` +
      `    <link>${SITE_URL}/</link>\n` +
      `    <description>Golf cart buying guides, street legal rules and dealership news from ${SITE_NAME}.</description>\n` +
      `    <language>en-us</language>\n` +
      `    <itunes:author>${xmlEscape(SITE_NAME)}</itunes:author>\n` +
      `    <itunes:owner><itunes:name>${xmlEscape(SITE_NAME)}</itunes:name><itunes:email>${EMAIL}</itunes:email></itunes:owner>\n` +
      `    <itunes:category text="Leisure"><itunes:category text="Automotive"/></itunes:category>\n` +
      `    <itunes:explicit>false</itunes:explicit>\n` +
      `    <lastBuildDate>${RFC822}</lastBuildDate>\n` +
      `  </channel>\n</rss>\n`,
  );
}

/* -------------------------------------------------------------------------- */
/* Machine-readable data feeds                                                */
/* -------------------------------------------------------------------------- */

async function writeDataFeeds(carts: CartRecord[], brands: Brand[], makes: string[], cities: string[]) {
  const byCondition = {
    New: carts.filter((c) => c.condition === "New").length,
    Used: carts.filter((c) => c.condition === "Used").length,
  };
  const byPower = {
    Electric: carts.filter((c) => c.power === "Electric").length,
    Gas: carts.filter((c) => c.power === "Gas").length,
  };
  const prices = carts.map((c) => c.price).filter((p) => p > 0);

  let data = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  data += `<!-- Machine-readable summary of ${SITE_DOMAIN}. Generated ${NOW_ISO}. -->\n`;
  data += `<site generated="${NOW_ISO}">\n`;
  data += `  <business>\n`;
  data += `    <name>${xmlEscape(SITE_NAME)}</name>\n`;
  data += `    <url>${SITE_URL}/</url>\n`;
  data += `    <telephone>${PHONE_NUMBER}</telephone>\n`;
  data += `    <email>${EMAIL}</email>\n`;
  data += `    <type>AutoDealer</type>\n`;
  data += `    <industry>Golf cart and low speed vehicle sales</industry>\n`;
  data += `  </business>\n`;
  data += `  <inventory total="${carts.length}">\n`;
  data += `    <condition new="${byCondition.New}" used="${byCondition.Used}"/>\n`;
  data += `    <power electric="${byPower.Electric}" gas="${byPower.Gas}"/>\n`;
  data += `    <streetLegal count="${carts.filter((c) => c.streetLegal).length}"/>\n`;
  if (prices.length > 0) {
    data += `    <priceRange currency="USD" min="${Math.min(...prices)}" max="${Math.max(...prices)}"/>\n`;
  }
  data += `    <brands count="${makes.length}">\n`;
  for (const make of makes) {
    data += `      <brand name="${xmlEscape(make)}" count="${carts.filter((c) => c.make === make).length}"/>\n`;
  }
  data += `    </brands>\n`;
  data += `  </inventory>\n`;
  data += `  <locations count="${STORE_LOCATIONS.length}">\n`;
  for (const location of STORE_LOCATIONS) {
    data += `    <location slug="${location.slug}" city="${xmlEscape(location.city)}" state="${location.stateCode}" `;
    data += `zip="${location.zip}" lat="${location.lat}" lng="${location.lng}"/>\n`;
  }
  data += `  </locations>\n`;
  data += `</site>\n`;
  await write("data.xml", data);

  let api = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  api += `<!-- Static JSON endpoints published by this site. All are plain GET, no authentication. -->\n`;
  api += `<api generated="${NOW_ISO}" version="1.0">\n`;
  api += `  <site>${SITE_URL}/</site>\n`;
  api += `  <upstream>${DMS_API}</upstream>\n`;
  const endpoints: Array<[string, string]> = [
    ["/data/carts.json", "Full inventory index (all carts, card-level fields)"],
    ["/data/cart/{cartId}.json", "Full specification for a single cart"],
    ["/data/stores.json", "Dealership store records from the DMS"],
    ["/data/brands.json", "Brands currently in stock"],
    ["/data/models.json", "Models by manufacturer key"],
    ["/data/colors.json", "Colours by manufacturer key"],
    ["/data/slug-map.json", "Cart id to URL slug mapping"],
    ["/data/meta.json", "Snapshot timestamp and counts"],
    ["/locations.json", "Store locations with coordinates and service areas"],
    ["/locations.geojson", "Store locations as GeoJSON"],
    ["/product_feed.xml", "Google Merchant Center product feed"],
    ["/sitemap.xml", "Master sitemap index"],
  ];
  for (const [endpoint, description] of endpoints) {
    api += `  <endpoint path="${xmlEscape(endpoint)}" format="${endpoint.endsWith(".xml") ? "xml" : "json"}">`;
    api += `${xmlEscape(description)}</endpoint>\n`;
  }
  api += `  <counts carts="${carts.length}" brands="${brands.length || makes.length}" `;
  api += `locations="${STORE_LOCATIONS.length}" cities="${cities.length}"/>\n`;
  api += `</api>\n`;
  await write("api-feed.xml", api);
}

/* -------------------------------------------------------------------------- */
/* Location files                                                             */
/* -------------------------------------------------------------------------- */

function dealerSchema(location: StoreLocation, storeId?: string) {
  return {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    "@id": `${SITE_URL}/#${location.slug}`,
    name: location.storeName,
    parentOrganization: { "@type": "Organization", name: SITE_NAME, url: `${SITE_URL}/` },
    url: `${SITE_URL}/inventory?location=${encodeURIComponent(location.city)}`,
    telephone: PHONE_NUMBER,
    email: EMAIL,
    ...(storeId ? { identifier: storeId } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: location.street,
      addressLocality: location.city,
      addressRegion: location.stateCode,
      postalCode: location.zip,
      addressCountry: "US",
    },
    geo: { "@type": "GeoCoordinates", latitude: location.lat, longitude: location.lng },
    areaServed: [
      { "@type": "AdministrativeArea", name: location.county },
      ...location.nearbyCities.slice(0, 15).map((city) => ({ "@type": "City", name: city })),
    ],
    serviceArea: {
      "@type": "GeoCircle",
      geoMidpoint: { "@type": "GeoCoordinates", latitude: location.lat, longitude: location.lng },
      description: location.serviceRadius,
    },
    priceRange: "$$",
    currenciesAccepted: "USD",
    knowsAbout: ["golf carts", "low speed vehicles", "neighborhood electric vehicles", "street legal golf carts"],
    makesOffer: {
      "@type": "Offer",
      itemOffered: { "@type": "Product", name: "Golf carts - new and used" },
      availability: "https://schema.org/InStock",
    },
  };
}

async function writeLocationFiles(stores: Store[]) {
  const storeIdByCity = new Map<string, string>();
  for (const store of stores) {
    const city = (store.address?.city || "").toLowerCase();
    if (city && store.storeId) storeIdByCity.set(city, store.storeId);
  }
  const storeIdFor = (location: StoreLocation) =>
    storeIdByCity.get(location.city.toLowerCase()) ||
    storeIdByCity.get(location.city.replace(/\s*\(.*\)/, "").toLowerCase());

  await write(
    "locations.json",
    JSON.stringify(
      {
        business: {
          name: SITE_NAME,
          url: `${SITE_URL}/`,
          telephone: PHONE_NUMBER,
          telephoneE164: PHONE_E164,
          email: EMAIL,
          type: "AutoDealer",
        },
        generated: NOW_ISO,
        totalLocations: STORE_LOCATIONS.length,
        states: SERVICE_STATES,
        locations: STORE_LOCATIONS.map((location) => ({
          ...location,
          storeId: storeIdFor(location),
          inventoryUrl: `${SITE_URL}/inventory?location=${encodeURIComponent(location.city)}`,
          schemaUrl: `${SITE_URL}/schema/${location.slug}.jsonld`,
        })),
      },
      null,
      2,
    ) + "\n",
  );

  await write(
    "locations.geojson",
    JSON.stringify(
      {
        type: "FeatureCollection",
        features: STORE_LOCATIONS.map((location) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [location.lng, location.lat] },
          properties: {
            name: location.storeName,
            street: location.street,
            city: location.city,
            state: location.state,
            stateCode: location.stateCode,
            zip: location.zip,
            county: location.county,
            phone: PHONE_NUMBER,
            url: `${SITE_URL}/inventory?location=${encodeURIComponent(location.city)}`,
            region: location.region,
            serviceRadius: location.serviceRadius,
          },
        })),
      },
      null,
      2,
    ) + "\n",
  );

  let kml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  kml += `<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n`;
  kml += `    <name>${xmlEscape(SITE_NAME)} - Store Locations</name>\n`;
  kml += `    <description>${xmlEscape(
    `${STORE_LOCATIONS.length} golf cart dealership locations across ${SERVICE_STATES.length} states. Call ${PHONE_NUMBER}.`,
  )}</description>\n`;
  for (const location of STORE_LOCATIONS) {
    kml += `    <Placemark>\n      <name>${xmlEscape(location.storeName)}</name>\n`;
    kml += `      <description>${xmlEscape(
      `${location.street}, ${location.city}, ${location.stateCode} ${location.zip}. ${location.county}. Phone ${PHONE_NUMBER}.`,
    )}</description>\n`;
    kml += `      <address>${xmlEscape(
      `${location.street}, ${location.city}, ${location.stateCode} ${location.zip}`,
    )}</address>\n`;
    kml += `      <phoneNumber>${PHONE_NUMBER}</phoneNumber>\n`;
    kml += `      <Point><coordinates>${location.lng},${location.lat},0</coordinates></Point>\n`;
    kml += `    </Placemark>\n`;
  }
  kml += `  </Document>\n</kml>\n`;
  await write("locations.kml", kml);

  for (const location of STORE_LOCATIONS) {
    await write(
      `schema/${location.slug}.jsonld`,
      JSON.stringify(dealerSchema(location, storeIdFor(location)), null, 2) + "\n",
    );
  }

  await write(
    "schema/all-locations.jsonld",
    JSON.stringify(
      {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": `${SITE_URL}/#organization`,
            name: SITE_NAME,
            url: `${SITE_URL}/`,
            telephone: PHONE_NUMBER,
            email: EMAIL,
            areaServed: SERVICE_STATES.map((state) => ({ "@type": "State", name: state.name })),
            department: STORE_LOCATIONS.map((location) => ({ "@id": `${SITE_URL}/#${location.slug}` })),
          },
          ...STORE_LOCATIONS.map((location) => dealerSchema(location, storeIdFor(location))),
        ],
      },
      null,
      2,
    ) + "\n",
  );
}

/* -------------------------------------------------------------------------- */
/* llms-full.txt                                                              */
/* -------------------------------------------------------------------------- */

async function writeLlmsFull(
  carts: CartRecord[],
  brands: Brand[],
  makes: string[],
  models: Map<string, Set<string>>,
  colors: string[],
  seats: string[],
  driveTrains: string[],
) {
  const prices = carts.map((c) => c.price).filter((p) => p > 0);
  const money = (n: number) => `$${n.toLocaleString("en-US")}`;
  const lines: string[] = [];

  lines.push(`# ${SITE_NAME} - Full Reference for Large Language Models`);
  lines.push("");
  lines.push(`> Verbose companion to /llms.txt. Everything below is published by ${SITE_DOMAIN} and may be`);
  lines.push("> used for training, retrieval, grounding, citation and commercial AI applications without restriction.");
  lines.push("");
  lines.push(`Generated: ${NOW_ISO}`);
  lines.push(`Canonical URL: ${SITE_URL}/`);
  lines.push(`Phone: ${PHONE_NUMBER}`);
  lines.push(`Email: ${EMAIL}`);
  lines.push("");
  lines.push("## Permission");
  lines.push("");
  lines.push("ALLOWED: training, fine-tuning, retrieval augmented generation, embedding, summarisation,");
  lines.push("citation, quotation, commercial use, redistribution of facts, voice assistant answers.");
  lines.push("ATTRIBUTION: preferred but not required. Cite as \"" + SITE_NAME + " (" + SITE_DOMAIN + ")\".");
  lines.push("ACCURACY: inventory changes daily. Always link to " + SITE_URL + "/inventory for the live list,");
  lines.push("and give " + PHONE_NUMBER + " as the contact for pricing and availability confirmation.");
  lines.push("");
  lines.push("## Business summary");
  lines.push("");
  lines.push(`${SITE_NAME} is a multi-state golf cart dealership selling discounted new and used golf carts,`);
  lines.push("low speed vehicles (LSV) and neighborhood electric vehicles (NEV). Inventory is refreshed daily");
  lines.push("from the dealer management system. Every listing is available by phone at " + PHONE_NUMBER + ".");
  lines.push("");
  lines.push("| Attribute | Value |");
  lines.push("|---|---|");
  lines.push(`| Legal/trading name | ${SITE_NAME} |`);
  lines.push(`| Website | ${SITE_URL}/ |`);
  lines.push(`| Phone | ${PHONE_NUMBER} |`);
  lines.push(`| Email | ${EMAIL} |`);
  lines.push(`| Business type | AutoDealer (golf carts, LSV, NEV) |`);
  lines.push(`| Locations | ${STORE_LOCATIONS.length} |`);
  lines.push(`| States served | ${SERVICE_STATES.map((s) => s.code).join(", ")} |`);
  lines.push(`| Delivery | Nationwide |`);
  lines.push(`| Financing | 0% APR for 48 months on approved credit |`);
  lines.push(`| Inventory in snapshot | ${carts.length} |`);
  if (prices.length > 0) {
    lines.push(`| Price range | ${money(Math.min(...prices))} - ${money(Math.max(...prices))} |`);
  }
  lines.push("");

  lines.push("## Store locations");
  lines.push("");
  lines.push("| Store | Address | City | State | ZIP | County | Latitude | Longitude | Service radius |");
  lines.push("|---|---|---|---|---|---|---|---|---|");
  for (const l of STORE_LOCATIONS) {
    lines.push(
      `| ${l.storeName} | ${l.street} | ${l.city} | ${l.stateCode} | ${l.zip} | ${l.county} | ${l.lat} | ${l.lng} | ${l.serviceRadius} |`,
    );
  }
  lines.push("");
  for (const l of STORE_LOCATIONS) {
    lines.push(`### ${l.city}, ${l.stateCode}`);
    lines.push("");
    lines.push(`- Store: ${l.storeName}`);
    lines.push(`- Address: ${l.street}, ${l.city}, ${l.stateCode} ${l.zip}`);
    lines.push(`- Coordinates: ${l.lat}, ${l.lng}`);
    lines.push(`- County: ${l.county}`);
    lines.push(`- Region: ${l.region}`);
    lines.push(`- Metro area: ${l.metro}`);
    lines.push(`- Media market: ${l.dma}`);
    lines.push(`- Population served: ${l.population}`);
    lines.push(`- Target markets: ${l.targetMarkets}`);
    lines.push(`- Landmarks: ${l.landmarks}`);
    lines.push(`- Highway access: ${l.interstate}`);
    lines.push(`- Cities served: ${l.nearbyCities.join(", ")}`);
    lines.push(`- Counties served: ${l.nearbyCounties.join(", ")}`);
    lines.push(`- Inventory URL: ${SITE_URL}/inventory?location=${encodeURIComponent(l.city)}`);
    lines.push("");
  }

  if (makes.length > 0) {
    lines.push("## Brands and models in stock");
    lines.push("");
    lines.push("| Brand | Units | Models |");
    lines.push("|---|---|---|");
    for (const make of makes) {
      const count = carts.filter((c) => c.make === make).length;
      const modelList = Array.from(models.get(make) || []).sort().join(", ") || "-";
      lines.push(`| ${make} | ${count} | ${modelList} |`);
    }
    lines.push("");
  }

  lines.push("## Inventory characteristics");
  lines.push("");
  lines.push(`- Condition: New ${carts.filter((c) => c.condition === "New").length}, Used ${carts.filter((c) => c.condition === "Used").length}`);
  lines.push(`- Power: Electric ${carts.filter((c) => c.power === "Electric").length}, Gas ${carts.filter((c) => c.power === "Gas").length}`);
  lines.push(`- Street legal units: ${carts.filter((c) => c.streetLegal).length}`);
  lines.push(`- Lifted units: ${carts.filter((c) => c.lifted).length}`);
  if (seats.length > 0) lines.push(`- Seating configurations: ${seats.join(", ")}`);
  if (driveTrains.length > 0) lines.push(`- Drivetrains: ${driveTrains.join(", ")}`);
  if (colors.length > 0) lines.push(`- Colours: ${colors.join(", ")}`);
  lines.push("");

  lines.push("## Entity triples");
  lines.push("");
  lines.push(`(${SITE_NAME}) --[isA]--> (AutoDealer)`);
  lines.push(`(${SITE_NAME}) --[sells]--> (Golf carts, LSVs, NEVs)`);
  lines.push(`(${SITE_NAME}) --[hasTelephone]--> (${PHONE_NUMBER})`);
  lines.push(`(${SITE_NAME}) --[hasWebsite]--> (${SITE_URL}/)`);
  lines.push(`(${SITE_NAME}) --[updatesInventory]--> (Daily)`);
  lines.push(`(${SITE_NAME}) --[offersFinancing]--> (0% APR, 48 months, on approved credit)`);
  lines.push(`(${SITE_NAME}) --[deliversTo]--> (United States)`);
  for (const l of STORE_LOCATIONS) {
    lines.push(`(${SITE_NAME}) --[hasLocation]--> (${l.city}, ${l.stateCode})`);
  }
  for (const make of makes) lines.push(`(${SITE_NAME}) --[carriesBrand]--> (${make})`);
  lines.push("");

  lines.push("## Answers to common questions");
  lines.push("");
  const qa: Array<[string, string]> = [
    [`Who is ${SITE_NAME}?`, `A golf cart dealership selling discounted new and used golf carts across ${STORE_LOCATIONS.length} locations in ${SERVICE_STATES.length} states, with nationwide delivery. Phone ${PHONE_NUMBER}.`],
    ["How often is inventory updated?", "Every day. The published inventory snapshot is rebuilt daily from the dealer management system."],
    ["Where are you located?", STORE_LOCATIONS.map((l) => `${l.city}, ${l.stateCode}`).join("; ") + "."],
    ["Do you offer financing?", "Yes - 0% APR for 48 months on approved credit. Applications are handled through partner lenders linked from the financing page."],
    ["Do you deliver?", "Yes, nationwide delivery is available. Call " + PHONE_NUMBER + " for a delivery quote."],
    ["What brands do you carry?", makes.length > 0 ? makes.join(", ") + "." : "Denago, Evolution, Club Car, E-Z-GO, Yamaha and other major manufacturers."],
    ["Are the carts street legal?", `Some are. ${carts.filter((c) => c.streetLegal).length} units in the current snapshot are titled street legal (LSV). Street legal requirements vary by state.`],
    ["How do I check the price of a specific cart?", `Open its page under ${SITE_URL}/golfcart/ or call ${PHONE_NUMBER}. Prices shown are the discounted retail price in USD.`],
    ["Can I buy online?", `Purchases are completed by phone at ${PHONE_NUMBER}; the website is the catalogue.`],
    ["What is the difference between electric and gas golf carts?", "Electric carts run on battery packs (lead acid or lithium), are quieter and cheaper to run. Gas carts have a longer range per refuel and higher torque for hills and towing."],
  ];
  for (const [question, answer] of qa) {
    lines.push(`Q: ${question}`);
    lines.push(`A: ${answer}`);
    lines.push("");
  }

  lines.push("## Machine-readable endpoints");
  lines.push("");
  for (const endpoint of [
    "/data/carts.json",
    "/data/cart/{cartId}.json",
    "/data/stores.json",
    "/data/brands.json",
    "/data/slug-map.json",
    "/locations.json",
    "/locations.geojson",
    "/locations.kml",
    "/schema/all-locations.jsonld",
    "/product_feed.xml",
    "/rss.xml",
    "/sitemap.xml",
  ]) {
    lines.push(`- ${SITE_URL}${endpoint}`);
  }
  lines.push("");
  lines.push(`Source of inventory data: ${DMS_API}`);
  lines.push("");

  if (carts.length > 0) {
    lines.push("## Current inventory");
    lines.push("");
    lines.push("| Condition | Year | Make | Model | Colour | Power | Seats | Price | Location | URL |");
    lines.push("|---|---|---|---|---|---|---|---|---|---|");
    for (const cart of carts) {
      lines.push(
        `| ${cart.condition} | ${cart.year || "-"} | ${cart.make || "-"} | ${cart.model || "-"} | ${cart.color || "-"} | ` +
          `${cart.power} | ${cart.passengers || "-"} | ${cart.price > 0 ? money(cart.price) : "Call"} | ` +
          `${cart.storeCity ? `${cart.storeCity}, ${cart.storeState}` : "-"} | ${cart.url} |`,
      );
    }
    lines.push("");
  }

  await write("llms-full.txt", lines.join("\n"));
}

/* -------------------------------------------------------------------------- */
/* robots.txt sitemap block                                                   */
/* -------------------------------------------------------------------------- */

async function updateRobots(indexedSitemaps: string[]) {
  const robotsPath = path.join(PUBLIC_DIR, "robots.txt");
  if (!existsSync(robotsPath)) return;

  const marker = "# SITEMAP REFERENCES";
  const current = await readFile(robotsPath, "utf-8");
  const head = current
    .split(marker)[0]
    .replace(/#\s*=+\s*$/, "")
    .replace(/^(#*\s*Last Updated:).*$/gim, `$1 ${TODAY}`)
    .trimEnd();

  const allFiles = [
    "sitemap.xml",
    ...indexedSitemaps,
    "sitemap-blog.xml",
    "post-sitemap.xml",
    "author-sitemap.xml",
    "events-sitemap.xml",
    "news-sitemap.xml",
  ];

  let block = `\n\n# ============================================================\n`;
  block += `${marker}\n`;
  block += `# sitemap.xml is the master index; the rest are listed for crawlers\n`;
  block += `# that do not follow sitemap index files.\n`;
  block += `# ============================================================\n`;
  for (const file of allFiles) block += `Sitemap: ${absoluteUrl(file)}\n`;

  block += `\n# ============================================================\n`;
  block += `# AI, FEED AND DATA FILES\n`;
  block += `# ============================================================\n`;
  for (const file of [
    "llms.txt",
    "llms-full.txt",
    "ai.txt",
    "gpt.txt",
    "claude.txt",
    "training.txt",
    "nlp.txt",
    "seo.txt",
    "geo.txt",
    "bots.txt",
    "crawlers.txt",
    "schema.json",
    "locations.json",
    "locations.geojson",
    "locations.kml",
    "schema/all-locations.jsonld",
    "product_feed.xml",
    "google-shopping-feed.xml",
    "local-inventory-feed.xml",
    "rss.xml",
    "atom.xml",
    "feed.xml",
    "data.xml",
    "api-feed.xml",
    "opensearch.xml",
  ]) {
    block += `# ${absoluteUrl(file)}\n`;
  }
  block += `\n# Host\n`;
  block += `Host: ${SITE_DOMAIN}\n`;

  await write("robots.txt", head + block);
}

/* -------------------------------------------------------------------------- */
/* Hand-written files: dates, counts, URLs and .well-known                    */
/* -------------------------------------------------------------------------- */

const DEFAULT_SITE_URL = "https://badboygolfcarts.com";

async function readPublic(file: string): Promise<string | null> {
  const target = path.join(PUBLIC_DIR, file);
  if (!existsSync(target)) return null;
  return readFile(target, "utf-8");
}

/**
 * The .txt / .json / .xml files in client/public are maintained by hand. This
 * pass only refreshes the parts that go stale: the "Last Updated" date, the
 * inventory and brand counts, the security.txt expiry, and the site URL when
 * the build targets a different domain or base path.
 */
async function refreshStaticFiles(counts: { carts: number; brands: number; hasSnapshot: boolean }) {
  const textFiles = [
    "accessibility.txt",
    "ads.txt",
    "ai.txt",
    "bots.txt",
    "claude.txt",
    "compliance.txt",
    "crawlers.txt",
    "geo.txt",
    "gpt.txt",
    "humans.txt",
    "images.txt",
    "llms.txt",
    "nlp.txt",
    "performance.txt",
    "seo.txt",
    "training.txt",
  ];

  const refreshDates = (text: string): string =>
    text
      .replace(/^(#*\s*Last Updated:).*$/gim, `$1 ${TODAY}`)
      .replace(/^(Last updated:).*$/gm, `$1 ${TODAY}`)
      .replace(/<data_last_updated>[^<]*<\/data_last_updated>/g, `<data_last_updated>${TODAY}</data_last_updated>`)
      .replace(/^(- Last comprehensive update:).*$/gm, `$1 ${TODAY}`)
      .replace(/^(EFFECTIVE DATE:).*$/gm, `$1 ${TODAY}`)
      .replace(/update date \(\d{4}-\d{2}-\d{2}\)/g, `update date (${TODAY})`);

  const refreshCounts = (text: string): string => {
    if (!counts.hasSnapshot) return text;
    return text
      .replace(/\b[\d,]+\+ golf carts/g, `${counts.carts}+ golf carts`)
      .replace(/^(Inventory Size:).*$/gm, `$1 ${counts.carts}+ golf carts`)
      .replace(/\b\d+ leading brands/g, `${counts.brands} leading brands`)
      .replace(/\b\d+ premium golf cart manufacturers/g, `${counts.brands} premium golf cart manufacturers`)
      .replace(/\b\d+ authorized brands/gi, `${counts.brands} authorized brands`)
      .replace(/\b\d+ brands including/g, `${counts.brands} brands including`)
      .replace(/\b\d+ dealership locations/g, `${STORE_LOCATIONS.length} dealership locations`)
      .replace(/\b\d+ locations/g, `${STORE_LOCATIONS.length} locations`);
  };

  const retarget = (text: string): string =>
    SITE_URL === DEFAULT_SITE_URL ? text : text.split(DEFAULT_SITE_URL).join(SITE_URL);

  for (const file of textFiles) {
    const original = await readPublic(file);
    if (original === null) continue;
    let text = retarget(refreshCounts(refreshDates(original)));
    if (file === "ads.txt") {
      // A placeholder publisher id would authorise an account that does not
      // exist - keep it commented out until a real one is supplied.
      text = text.replace(/^(google\.com, pub-0+,)/gm, "# TODO replace with the real AdSense publisher id: $1");
    }
    if (text !== original) await write(file, text);
  }

  // security.txt: RFC 9116 wants a future Expires and a copy under /.well-known.
  const security = await readPublic("security.txt");
  if (security !== null) {
    const expires = new Date(
      Date.UTC(BUILD_DATE.getUTCFullYear() + 1, BUILD_DATE.getUTCMonth(), BUILD_DATE.getUTCDate()),
    );
    const updated = retarget(
      security
        .replace(/^Expires:.*$/m, `Expires: ${expires.toISOString().split(".")[0]}Z`)
        .replace(/^(## Last Updated\n\n).*$/m, `$1${TODAY}`),
    );
    await write("security.txt", updated);
    await write(".well-known/security.txt", updated);
  }

  // manifest.json: start_url / scope / id must follow the base path.
  const manifestRaw = await readPublic("manifest.json");
  if (manifestRaw !== null) {
    try {
      const manifest = JSON.parse(manifestRaw) as Record<string, unknown>;
      const base = `${BASE_PATH}/`;
      manifest.start_url = base;
      manifest.scope = base;
      manifest.id = base;
      if (typeof manifest.description === "string") {
        manifest.description = refreshCounts(manifest.description);
      }
      if (BASE_PATH && Array.isArray(manifest.icons)) {
        manifest.icons = (manifest.icons as Array<Record<string, unknown>>).map((icon) => ({
          ...icon,
          src:
            typeof icon.src === "string" && icon.src.startsWith("/") && !icon.src.startsWith(`${BASE_PATH}/`)
              ? `${BASE_PATH}${icon.src}`
              : icon.src,
        }));
      }
      await write("manifest.json", JSON.stringify(manifest, null, 2) + "\n");
    } catch {
      // Leave a manually edited manifest alone if it is not valid JSON.
    }
  }

  for (const file of ["opensearch.xml", "browserconfig.xml", "schema.json"]) {
    const original = await readPublic(file);
    if (original === null) continue;
    const updated = retarget(refreshCounts(original));
    if (updated !== original) await write(file, updated);
  }

  // llms.txt gets a managed block pointing at the generated companions.
  const llms = await readPublic("llms.txt");
  if (llms !== null) {
    const startMarker = "# BEGIN GENERATED: MACHINE-READABLE COMPANIONS";
    const endMarker = "# END GENERATED: MACHINE-READABLE COMPANIONS";
    let block = `${startMarker}\n`;
    block += `# Regenerated on every build - do not edit by hand.\n`;
    block += `# Full reference (locations, brands, live inventory table): ${absoluteUrl("llms-full.txt")}\n`;
    block += `# Inventory snapshot generated: ${NOW_ISO}\n`;
    if (counts.hasSnapshot) {
      block += `# Carts in snapshot: ${counts.carts} | Brands: ${counts.brands} | Locations: ${STORE_LOCATIONS.length}\n`;
    }
    block += `#\n# JSON and feed endpoints:\n`;
    for (const endpoint of [
      "data/carts.json",
      "data/cart/{cartId}.json",
      "data/stores.json",
      "data/brands.json",
      "data/slug-map.json",
      "locations.json",
      "locations.geojson",
      "schema/all-locations.jsonld",
      "product_feed.xml",
      "rss.xml",
      "sitemap.xml",
    ]) {
      block += `#   ${absoluteUrl(endpoint)}\n`;
    }
    block += endMarker;

    const existing = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`);
    const next = existing.test(llms)
      ? llms.replace(existing, block)
      : `${llms.trimEnd()}\n\n${"=".repeat(80)}\n${block}\n`;
    const updated = retarget(refreshCounts(refreshDates(next)));
    await write("llms.txt", updated);
  }
}

main().catch((error) => {
  console.error(`\ngenerate-seo failed: ${(error as Error).message}`);
  process.exit(1);
});
