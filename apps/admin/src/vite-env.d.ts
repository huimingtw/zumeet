/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: string;
  readonly VITE_ADMIN_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
