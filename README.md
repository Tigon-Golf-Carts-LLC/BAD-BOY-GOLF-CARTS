# Bad Boy Golf Carts — badboygolfcarts.com

Static website for Bad Boy Golf Carts, built with React + Vite and hosted on **GitHub Pages**.
Inventory comes from the Tigon DMS API and is snapshotted into static JSON at build time.

## How it works (and why)

GitHub Pages serves static files only — it cannot run the Express proxy this site used on Replit.
The Tigon DMS API also does not send CORS headers, so a browser cannot call it directly.

So the DMS call moved from *request time* to *build time*:

```
GitHub Actions (daily + on push)
  └─ npm run fetch-data    → calls api.tigondms.com, writes client/public/data/*.json
  └─ npm run generate-seo  → sitemaps, feeds, location data, llms-full.txt, robots.txt
  └─ vite build            → builds the React app into dist/
  └─ npm run prerender     → per-page HTML, 404.html, CNAME, .nojekyll
  └─ deploy-pages          → publishes dist/ to GitHub Pages
```

The browser then reads `/data/*.json` and does the filtering, sorting and pagination locally —
same URLs, same filters, same slugs as before, with no server.

## Publishing to GitHub Pages

1. Merge this branch into `main`.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Wait for the **Deploy to GitHub Pages** workflow to finish (Actions tab).
4. **Settings → Pages → Custom domain:** enter `badboygolfcarts.com`, save, then tick
   **Enforce HTTPS** once the certificate is issued (can take up to ~30 minutes).
5. Update DNS at your registrar (see below).

> "There isn't a GitHub Pages site here" means no deployment exists yet for the domain.
> DNS alone does not create the site — steps 2 and 3 have to run first.

### HTTPS / the "Not secure" warning

If the browser shows **Not secure**, the page was served over plain HTTP. Fix it at the source:
**Settings → Pages → Enforce HTTPS**. GitHub issues and renews the certificate for free once the
custom domain is verified; ticking the box makes GitHub redirect every HTTP request to HTTPS.
The box is greyed out until the certificate finishes provisioning (usually minutes, up to 24h).

The site does not rely on that alone. `client/index.html` carries:

- a redirect in the first `<script>` of `<head>` that sends any HTTP visitor to HTTPS
  (localhost and LAN addresses excluded, so local development still works)
- `Content-Security-Policy: upgrade-insecure-requests`, so any subresource requested over
  HTTP is upgraded instead of triggering a mixed-content warning
- `referrer` set to `strict-origin-when-cross-origin`

Note this is a static site: it takes no logins, no payments and no form submissions — every
application is a link out to the lender's own secure site — so nothing sensitive is ever typed
into a page served from this domain.

The site rebuilds automatically:

- on every push to `main`
- daily at **03:55 UTC (10:55 PM EST)** — the same refresh time the old server used
- on demand from **Actions → Deploy to GitHub Pages → Run workflow**

If the DMS API is unreachable or returns zero carts, the build fails on purpose and the previous
deployment stays live.

### DNS records

For the apex domain `badboygolfcarts.com` — delete any existing A / AAAA / CNAME records for
`@` and `www` that point somewhere else first:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `185.199.108.153` | 3600 |
| A | `@` | `185.199.109.153` | 3600 |
| A | `@` | `185.199.110.153` | 3600 |
| A | `@` | `185.199.111.153` | 3600 |
| AAAA | `@` | `2606:50c0:8000::153` | 3600 |
| AAAA | `@` | `2606:50c0:8001::153` | 3600 |
| AAAA | `@` | `2606:50c0:8002::153` | 3600 |
| AAAA | `@` | `2606:50c0:8003::153` | 3600 |
| CNAME | `www` | `tigon-golf-carts-llc.github.io.` | 3600 |

All four A records (and all four AAAA) are required — they are GitHub's load-balanced set, not
alternatives. Leave MX and TXT records for email alone.

### Hosting without a custom domain

To serve from `https://tigon-golf-carts-llc.github.io/BAD-BOY-GOLF-CARTS/` instead, edit the `env`
block in `.github/workflows/deploy.yml`:

```yaml
env:
  SITE_DOMAIN: tigon-golf-carts-llc.github.io
  BASE_PATH: "/BAD-BOY-GOLF-CARTS/"
```

`BASE_PATH` feeds Vite's `base`, the router, the data loader and every generated URL, and `CNAME`
is skipped automatically when it is not `/`.

## Local development

```bash
npm install
npm run fetch-data   # pulls a fresh inventory snapshot into client/public/data
npm run dev          # http://localhost:5173
```

`npm run fetch-data` needs outbound access to `api.tigondms.com`. The snapshot is gitignored —
it is regenerated on every build.

Full production build:

```bash
npm run build        # fetch-data + generate-seo + vite build + prerender → dist/
npm run preview
```

| Script | What it does |
|--------|--------------|
| `npm run dev` | Vite dev server |
| `npm run fetch-data` | Refresh the DMS snapshot in `client/public/data` |
| `npm run generate-seo` | Regenerate sitemaps, feeds, location data and robots.txt |
| `npm run build` | Snapshot + SEO files + build + prerender |
| `npm run build:site` | SEO files + build + prerender, reusing the existing snapshot |
| `npm run check` | TypeScript check |

## SEO / AI file suite

Everything lives under `client/public/`, so it is served from the site root.

### Generated on every build (`npm run generate-seo`)

Do not hand-edit these — they are rewritten from the inventory snapshot and `shared/locations.ts`.

**Sitemaps (20).** `sitemap.xml` is a sitemap **index**; it lists every child sitemap, which is what
Search Console and Bing should be pointed at.

| File | Contents |
|------|----------|
| `sitemap.xml` | Master index of all child sitemaps |
| `sitemap-pages.xml`, `page-sitemap.xml` | Home, inventory, financing |
| `sitemap-brands.xml` | One URL per manufacturer in stock |
| `category-sitemap.xml` | Condition, power type, seating, drivetrain, street legal, lifted |
| `tag-sitemap.xml` | Make+model and colour facets |
| `geo-sitemap.xml` | One URL per store city, with image geo tags |
| `dynamic-sitemap.xml` | Every `/golfcart/<slug>` page, with images |
| `sitemap-images.xml`, `image-sitemap.xml` | Image sitemap, up to 10 photos per cart |
| `mobile-sitemap.xml` | Mobile namespace |
| `hreflang-sitemap.xml`, `xhtml-sitemap.xml` | `en-US` + `x-default` alternates |
| `urllist.xml` | Flat list of every indexable URL |
| `sitemap-blog.xml`, `post-sitemap.xml`, `author-sitemap.xml`, `events-sitemap.xml`, `news-sitemap.xml` | Valid but empty — the site has no blog, news or events yet. Deliberately **not** listed in `sitemap.xml` so Search Console is never told to fetch an empty sitemap. Add content and they fill in. |

**Feeds and data (9).** `product_feed.xml` and `google-shopping-feed.xml` (Google Merchant Center
RSS 2.0 with the `g:` namespace), `local-inventory-feed.xml` (per-store availability),
`rss.xml` / `feed.xml` / `atom.xml` (latest inventory), `podcast.xml` (valid empty channel),
`data.xml` and `api-feed.xml` (machine-readable site summary and endpoint list).

**Locations (15).** `locations.json`, `locations.geojson`, `locations.kml`,
`schema/all-locations.jsonld` and one `schema/<store>.jsonld` per store (AutoDealer schema with
address, coordinates and service area).

**AI (1) and access control (1).** `llms-full.txt` (full location, brand and live inventory tables
plus entity triples and Q&A) and the sitemap block in `robots.txt`.

### Hand-written, refreshed on every build

`llms.txt`, `ai.txt`, `gpt.txt`, `claude.txt`, `training.txt`, `nlp.txt`, `seo.txt`, `geo.txt`,
`crawlers.txt`, `bots.txt`, `accessibility.txt`, `compliance.txt`, `performance.txt`, `images.txt`,
`humans.txt`, `security.txt`, `ads.txt`, `schema.json`, `manifest.json`, `browserconfig.xml`,
`opensearch.xml`, and the body of `robots.txt`.

Edit the content freely. The build only rewrites the parts that go stale:

- `Last Updated` dates
- inventory and brand counts (`808+ golf carts` → the live number)
- the site URL, if you build for a different domain or base path
- `security.txt`'s `Expires` (one year out), also copied to `.well-known/security.txt`
- `manifest.json`'s `start_url` / `scope` / `id`, to follow `BASE_PATH`
- the generated block at the end of `llms.txt`

### Needs your input

- **`ads.txt`** carries a placeholder AdSense publisher id, which the build comments out. Put your
  real `pub-…` id in if you run ads; otherwise the file is fine as pure documentation.
- **Financing partner artwork** lives in `client/public/partners/` (`sheffield-bbt.png`,
  `bli-heartland.png`, `dll-financial-solutions.png`, `roadrunner-octane.png`,
  `univest-capital.png`, `dealer-direct.png`). These are branded name plates generated for this
  site. To use a lender's own artwork, replace the file, keeping the same name — the page picks
  it up with no code change. 800×400 or any 2:1 image works.
- **Store locations** live in `shared/locations.ts` (11 stores, verified addresses and
  coordinates). Everything geographic is generated from that one file — edit it and rebuild.

## Project structure

```
client/src/pages/               Home, Inventory, CartDetail, Financing, NotFound
client/src/components/          Header, Footer, CartCard, InventoryFilters, ThemeProvider
client/src/lib/static-data.ts   Reads /data/*.json — replaces the old Express API
client/public/                  SEO, AI and discovery files, favicons
shared/schema.ts                Types/Zod schemas for DMS data
shared/inventory.ts             Slug, sort and filter logic shared by build scripts and browser
shared/locations.ts             The 11 store locations — single source of truth for geo files
script/fetch-data.ts            Build-time DMS snapshot
script/generate-seo.ts          Sitemaps, feeds, location data, robots.txt
script/prerender.ts             Static pages, 404, CNAME
.github/workflows/deploy.yml    Build + deploy to GitHub Pages
```

## Brand

Hot rod dealership look: garage black surfaces, hot rod red accents, chrome lettering and
racing stripes.

| Token | Value |
|-------|-------|
| Primary red (dark theme) | `hsl(0 84% 52%)` |
| Primary red (light theme) | `hsl(0 82% 44%)` |
| Theme colour / tile colour | `#d10f14` |
| Garage black | `#0b0c0e` |
| Default theme | Dark |

The colour lives in `client/src/index.css` as `--primary` (plus `--ring`, `--accent`,
`--chart-1` and the sidebar tokens). Retune those and the whole UI follows — the hot rod
helpers (`.hotrod-heading`, `.chrome-text`, `.racing-stripes`, `.flame-rule`, `.carbon-surface`,
`.redline-glow`) are all driven by `--primary`.

Brand assets, all generated from `client/public/favicon.svg`:

| File | Use |
|------|-----|
| `favicon.svg` | Master mark — the BB badge |
| `favicon.ico`, `logo-icon.ico` | Multi-resolution (16–256px) browser icons |
| `favicon.png`, `icon-192.png`, `icon-512.png` | PNG icons for search engines and the manifest |
| `icon-maskable-512.png` | Android maskable icon (safe-zone inset) |
| `apple-touch-icon.png` | 180px iOS home screen icon, opaque background |
| `og-image.png` | 1200×630 social share card |
| `attached_assets/bad-boy-golf-carts-badge.svg` | Header and footer logo |
| `attached_assets/bad-boy-hero.svg` | Home page hero backdrop |

To change the mark, edit `favicon.svg` and re-render the raster sizes; the SVG hero and badge
are plain SVG and can be edited directly.

## Site facts

- Phone: **1-888-840-4490** (every CTA is a `tel:` link)
- 11 stores across PA, NJ, DE, NC, IN, VA, FL — nationwide delivery
- Images: `https://s3.amazonaws.com/prod.docs.s3/carts/<filename>`
- DMS API: `https://api.tigondms.com/wp-website`
- Theme: green primary (hue 152), dark mode by default, Plus Jakarta Sans
