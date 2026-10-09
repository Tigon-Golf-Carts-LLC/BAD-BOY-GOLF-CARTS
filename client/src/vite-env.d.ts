/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** TIGON IOT webhook URL, injected at build time from the TIGON_WEBHOOK_URL secret. */
  readonly VITE_TIGON_WEBHOOK_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
