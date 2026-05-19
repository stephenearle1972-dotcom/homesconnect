/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LISTINGS_CSV_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
