/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_DEV_USER_ID?: string;
  readonly VITE_YANDEX_MAPS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface MaxWebApp {
  initData?: string;
  ready?: () => void;
  colorScheme?: 'light' | 'dark';
  onEvent?: (eventType: string, callback: () => void) => void;
  offEvent?: (eventType: string, callback: () => void) => void;
}

interface Window {
  WebApp?: MaxWebApp;
}
