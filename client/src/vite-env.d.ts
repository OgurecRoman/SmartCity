/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_DEV_USER_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface MaxWebApp {
  initData?: string;
  ready?: () => void;
}

interface Window {
  WebApp?: MaxWebApp;
}
