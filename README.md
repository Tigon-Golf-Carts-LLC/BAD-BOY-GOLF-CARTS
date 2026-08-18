# Discounted Golf Carts — discountedgolfcart.com

Static website for Discounted Golf Carts, built with React + Vite and hosted on **GitHub Pages**.
Inventory comes from the Tigon DMS API and is snapshotted into static JSON at build time.

## How it works (and why)

GitHub Pages serves static files only — it cannot run the Express proxy this site used on Replit.
The Tigon DMS API also does not send CORS headers, so a browser cannot call it directly.

So the DMS call moved from *request time* to *build time*:

```
GitHub Actions (daily + on push)
  └─ npm run fetch-data   → calls api.tigondms.com, writes client/public/data/*.json
  └─ vite build           → builds the React app into dist/
  └─ npm run prerender    → per-page HTML, sitemap.xml, 404.html, CNAME, .nojekyll
  └─ deploy-pages         → publishes dist/ to GitHub Pages
```

The browser then reads `/data/*.json` and does the filtering, sorting and pagination locally —
same URLs, same filters, same slugs as before, with no server.

### What gets generated

| File | Contents |
|------|----------|
| `data/carts.json` | Every cart, trimmed to the fields the grid and filters need |
| `data/cart/<id>.json` | Full detail for one cart (loaded only when that page is opened) |
| `data/stores.json`, `data/brands.json`, `data/models.json`, `data/colors.json` | Filter sources |
| `data/slug-map.json` | `/golfcart/<slug>` ⇄ cart id |
| `data/meta.json` | Snapshot timestamp and counts |
| `index.html`, `inventory/`, `financing/`, `golfcart/<slug>/` | Real HTML pages with their own title, description, canonical URL, Open Graph tags and Product structured data |
| `404.html` | SPA fallback for any other path |
| `sitemap.xml` | Home, inventory, brand/model/condition/location facets, and every cart page with image entries |

## Publishing to GitHub Pages

1. Push this branch and merge it into `main`.
2. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Settings → Pages → Custom domain:** enter `discountedgolfcart.com` and save, then tick
   **Enforce HTTPS** once the certificate is issued (can take up to ~30 minutes).
4. Update DNS at your registrar (see below).

The site rebuilds automatically:

- on every push to `main`
- daily at **03:55 UTC (10:55 PM EST)** — the same refresh time the old server used
- on demand from **Actions → Deploy to GitHub Pages → Run workflow**

If the DMS API is unreachable or returns zero carts, the build fails on purpose and the previous
deployment stays live.

### DNS records

For the apex domain `discountedgolfcart.com` — delete any existing A / AAAA / CNAME records for
`@` and `www` that point at Replit first:

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

### Hosting without a custom domain

To serve from `https://tigon-golf-carts-llc.github.io/BAD-BOY-GOLF-CARTS/` instead, edit the `env`
block in `.github/workflows/deploy.yml`:

```yaml
env:
  SITE_DOMAIN: tigon-golf-carts-llc.github.io
  BASE_PATH: "/BAD-BOY-GOLF-CARTS/"
```

`BASE_PATH` feeds Vite's `base`, the router and the data loader, and `CNAME` is skipped
automatically when it is not `/`.

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
npm run build        # fetch-data + vite build + prerender  → dist/
npm run preview
```

| Script | What it does |
|--------|--------------|
| `npm run dev` | Vite dev server |
| `npm run fetch-data` | Refresh the DMS snapshot in `client/public/data` |
| `npm run build` | Snapshot + build + prerender |
| `npm run build:site` | Build + prerender using the existing snapshot |
| `npm run check` | TypeScript check |

## Project structure

```
client/src/pages/          Home, Inventory, CartDetail, Financing, NotFound
client/src/components/     Header, Footer, CartCard, InventoryFilters, ThemeProvider
client/src/lib/static-data.ts  Reads /data/*.json — replaces the old Express API
client/public/             SEO files (robots.txt, llms.txt, ai.txt, …) and favicons
shared/schema.ts           Types/Zod schemas for DMS data
shared/inventory.ts        Slug, sort and filter logic shared by build scripts and browser
script/fetch-data.ts       Build-time DMS snapshot
script/prerender.ts        Static pages, sitemap, CNAME, 404
.github/workflows/deploy.yml  Build + deploy to GitHub Pages
```

## Site facts

- Phone: **1-888-840-4490** (every CTA is a `tel:` link)
- Images: `https://s3.amazonaws.com/prod.docs.s3/carts/<filename>`
- DMS API: `https://api.tigondms.com/wp-website`
- Theme: green primary (hue 152), dark mode by default, Plus Jakarta Sans
