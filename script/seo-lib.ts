/**
 * Shared helpers for the SEO / AI file generator (script/generate-seo.ts).
 */
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export const PUBLIC_DIR = path.resolve(import.meta.dirname, "..", "client", "public");
export const DATA_DIR = path.join(PUBLIC_DIR, "data");

export const SITE_DOMAIN = process.env.SITE_DOMAIN || "badboygolfcarts.com";
export const BASE_PATH = (process.env.BASE_PATH || "/").replace(/\/$/, "");
export const SITE_URL = `https://${SITE_DOMAIN}${BASE_PATH}`;
export const SITE_NAME = "Bad Boy Golf Carts";
export const PHONE_NUMBER = "1-888-840-4490";
export const PHONE_E164 = "+18888404490";
export const EMAIL = "tigongolfcarts@gmail.com";
export const S3_CARTS_URL = "https://s3.amazonaws.com/prod.docs.s3/carts/";
export const PLACEHOLDER_IMAGE =
  "https://tigongolfcarts.com/wp-content/uploads/2024/11/TIGON-GOLF-CARTS-IMAGES-COMING-SOON.jpg";
export const DMS_API = "https://api.tigondms.com/wp-website";

/** Build date. SOURCE_DATE_EPOCH keeps repeat builds reproducible when set. */
export const BUILD_DATE = new Date(
  process.env.SOURCE_DATE_EPOCH ? Number(process.env.SOURCE_DATE_EPOCH) * 1000 : Date.now(),
);
export const TODAY = BUILD_DATE.toISOString().split("T")[0];
export const NOW_ISO = BUILD_DATE.toISOString();
export const RFC822 = BUILD_DATE.toUTCString();

export function xmlEscape(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Removes control characters that would make an XML feed invalid. */
export function clean(str: string | null | undefined): string {
  return String(str ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function absoluteUrl(pathname: string): string {
  return `${SITE_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

export function imageUrl(file: string | undefined | null): string {
  if (!file) return PLACEHOLDER_IMAGE;
  return file.startsWith("http") ? file : `${S3_CARTS_URL}${file}`;
}

export async function readData<T>(file: string, fallback: T): Promise<T> {
  const target = path.join(DATA_DIR, file);
  if (!existsSync(target)) return fallback;
  try {
    return JSON.parse(await readFile(target, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export const hasSnapshot = () => existsSync(path.join(DATA_DIR, "carts.json"));

export interface SitemapImage {
  loc: string;
  title?: string;
  caption?: string;
  geoLocation?: string;
  license?: string;
}

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
  images?: SitemapImage[];
  /** Raw XML inserted inside the <url> element (mobile / xhtml / news extensions). */
  extra?: string;
}

export function urlEntry(entry: SitemapEntry): string {
  let out = `  <url>\n    <loc>${xmlEscape(entry.loc)}</loc>\n`;
  if (entry.lastmod) out += `    <lastmod>${entry.lastmod}</lastmod>\n`;
  if (entry.changefreq) out += `    <changefreq>${entry.changefreq}</changefreq>\n`;
  if (entry.priority) out += `    <priority>${entry.priority}</priority>\n`;
  if (entry.extra) out += entry.extra;
  for (const image of entry.images || []) {
    out += `    <image:image>\n      <image:loc>${xmlEscape(image.loc)}</image:loc>\n`;
    if (image.title) out += `      <image:title>${xmlEscape(image.title)}</image:title>\n`;
    if (image.caption) out += `      <image:caption>${xmlEscape(image.caption)}</image:caption>\n`;
    if (image.geoLocation) {
      out += `      <image:geo_location>${xmlEscape(image.geoLocation)}</image:geo_location>\n`;
    }
    if (image.license) out += `      <image:license>${xmlEscape(image.license)}</image:license>\n`;
    out += `    </image:image>\n`;
  }
  return out + `  </url>\n`;
}

export interface UrlsetOptions {
  comment?: string;
  image?: boolean;
  xhtml?: boolean;
  mobile?: boolean;
  news?: boolean;
}

export function urlset(entries: SitemapEntry[], options: UrlsetOptions = {}): string {
  const ns = ['xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'];
  if (options.image !== false) ns.push('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
  if (options.xhtml) ns.push('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  if (options.mobile) ns.push('xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0"');
  if (options.news) ns.push('xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"');

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  if (options.comment) xml += `<!-- ${options.comment} -->\n`;
  xml += `<urlset ${ns.join("\n        ")}>\n`;
  for (const entry of entries) xml += urlEntry(entry);
  return xml + `</urlset>\n`;
}

export function sitemapIndex(files: string[]): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<!-- Master sitemap index for ${SITE_NAME} (${SITE_DOMAIN}). Every child sitemap is listed here. -->\n`;
  xml += `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  for (const file of files) {
    xml += `  <sitemap>\n    <loc>${xmlEscape(absoluteUrl(file))}</loc>\n`;
    xml += `    <lastmod>${TODAY}</lastmod>\n  </sitemap>\n`;
  }
  return xml + `</sitemapindex>\n`;
}
