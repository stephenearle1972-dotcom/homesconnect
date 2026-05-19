/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LISTINGS_CSV_URL?: string;
  readonly VITE_CLOUDINARY_CLOUD_NAME?: string;
  readonly VITE_CLOUDINARY_UPLOAD_PRESET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
