/**
 * TIGON IOT "Webhook Flows" lead delivery.
 *
 * The site is static (GitHub Pages), so leads are posted straight from the
 * browser to this website's webhook. The webhook URL is NOT committed to the
 * repo: it is injected at build time from the GitHub Actions secret
 * TIGON_WEBHOOK_URL (exposed to Vite as VITE_TIGON_WEBHOOK_URL). No HMAC
 * signing secret is used here — a signing secret must never ship to a browser.
 */

export const TIGON_ENDPOINT: string = (import.meta.env.VITE_TIGON_WEBHOOK_URL || "").trim();

/** form_name value TIGON expects for this website's webhook. */
export const TIGON_FORM_NAME = "Contact form";

/** Spam trap input name. Real visitors never see it; it must be sent empty. */
export const HONEYPOT_NAME = "website";

export const MAX_FILE_MB = 10;
export const ALLOWED_IMAGE_EXT = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"];
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,.heic,.heif";

const TRACK_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"] as const;
const STORE_KEY = "tigon_first_touch";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type FirstTouch = { ts: number; v: Partial<Record<(typeof TRACK_KEYS)[number], string>> };

function readQuery(): Record<string, string> {
  const current: Record<string, string> = {};
  try {
    const q = new URLSearchParams(window.location.search);
    for (const k of TRACK_KEYS) {
      const v = q.get(k);
      if (v) current[k] = v;
    }
  } catch {
    /* ignore */
  }
  return current;
}

/**
 * First-touch attribution: the first utm_* / gclid / fbclid values seen are
 * kept in localStorage for 30 days and sent with every lead in that window.
 */
export function captureFirstTouch(): Record<string, string> {
  const current = readQuery();
  let saved: FirstTouch | null = null;
  try {
    saved = JSON.parse(window.localStorage.getItem(STORE_KEY) || "null");
  } catch {
    saved = null;
  }
  if (saved && (!saved.ts || Date.now() - saved.ts > MAX_AGE_MS)) saved = null;
  if (!saved && Object.keys(current).length) {
    saved = { ts: Date.now(), v: current };
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(saved));
    } catch {
      /* private mode */
    }
  }
  const out: Record<string, string> = {};
  for (const k of TRACK_KEYS) out[k] = saved?.v?.[k] || current[k] || "";
  return out;
}

/** GA client id from the _ga cookie: "GA1.1.123456.789012" -> "123456.789012". */
export function gaClientId(): string {
  const m = document.cookie.match(/(?:^|;\s*)_ga=([^;]+)/);
  if (!m) return "";
  const parts = decodeURIComponent(m[1]).split(".");
  return parts.length >= 4 ? parts.slice(-2).join(".") : "";
}

/** Hidden tracking fields, filled right before sending. */
export function trackingFields(): Record<string, string> {
  return {
    ...captureFirstTouch(),
    url: window.location.href,
    referrer: document.referrer || "",
    ga_client_id: gaClientId(),
  };
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Returns an error message for a bad photo, or "" when it's fine. */
export function checkImage(file: File | null | undefined): string {
  if (!file) return "";
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_IMAGE_EXT.includes(ext) && !/^image\/(jpeg|png|gif|webp|heic|heif)$/.test(file.type)) {
    return "Photos must be JPG, PNG, GIF, WEBP or HEIC.";
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) return `Each photo must be smaller than ${MAX_FILE_MB} MB.`;
  return "";
}

export class LeadError extends Error {}

/**
 * POSTs the form to TIGON as multipart/form-data. Empty file inputs are left
 * out, tracking fields are added, form_name is forced and the honeypot is
 * always present (empty for real visitors).
 */
export async function sendLead(form: HTMLFormElement): Promise<{ id?: string }> {
  if (!TIGON_ENDPOINT) {
    throw new LeadError("Our online form is temporarily unavailable. Please call us instead.");
  }

  const fd = new FormData(form);
  form.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach((input) => {
    if (input.name && (!input.files || input.files.length === 0)) fd.delete(input.name);
  });
  const t = trackingFields();
  for (const [k, v] of Object.entries(t)) fd.set(k, v);
  fd.set("form_name", TIGON_FORM_NAME);
  if (!fd.has(HONEYPOT_NAME)) fd.set(HONEYPOT_NAME, "");

  let res: Response;
  try {
    res = await fetch(TIGON_ENDPOINT, { method: "POST", body: fd, mode: "cors" });
  } catch {
    throw new LeadError("We couldn't reach our server. Please check your connection and try again, or call us.");
  }

  const body = await res.text();
  let data: { ok?: boolean; id?: string; error?: string; message?: string } | null = null;
  try {
    data = JSON.parse(body);
  } catch {
    data = null;
  }

  if (res.status === 429) {
    throw new LeadError("Too many tries. Please wait a minute and try again.");
  }
  if (!res.ok || !data || data.ok !== true) {
    throw new LeadError(data?.error || data?.message || "Sorry, something went wrong. Please try again or call us.");
  }
  return { id: data.id };
}
