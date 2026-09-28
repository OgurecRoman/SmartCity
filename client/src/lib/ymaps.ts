export type YmapsCoords = [number, number]; // [lat, lng]

export type YmapsMapEvent = {
  get(key: 'coords'): YmapsCoords;
  get(key: 'target'): unknown;
};

export type YmapsPlacemark = {
  events: {
    add: (type: string, handler: (e: unknown) => void) => void;
  };
  geometry?: { getCoordinates: () => YmapsCoords };
};

export type YmapsMap = {
  destroy: () => void;
  setCenter: (center: YmapsCoords, zoom?: number, options?: { duration?: number }) => void;
  getCenter: () => YmapsCoords;
  container: {
    fitToViewport: () => void;
  };
  controls: {
    add: (control: string, options?: Record<string, unknown>) => void;
  };
  geoObjects: {
    add: (obj: unknown) => void;
    removeAll: () => void;
  };
  events: {
    add: (type: string, handler: (e: YmapsMapEvent) => void) => void;
    remove: (type: string, handler: (e: YmapsMapEvent) => void) => void;
  };
};

export type YmapsApi = {
  ready: (cb: () => void) => void;
  Map: new (
    element: HTMLElement,
    state: { center: YmapsCoords; zoom: number; controls?: string[] },
    options?: { suppressMapOpenBlock?: boolean; yandexMapDisablePoiInteractivity?: boolean },
  ) => YmapsMap;
  Placemark: new (
    geometry: YmapsCoords,
    properties?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => YmapsPlacemark;
};

declare global {
  interface Window {
    ymaps?: YmapsApi;
  }
}

const SCRIPT_ID = 'yandex-maps-jsapi';

export function loadYmaps(apiKey: string): Promise<YmapsApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('ymaps только в браузере'));
  }

  if (window.ymaps) {
    return new Promise((resolve) => {
      window.ymaps!.ready(() => resolve(window.ymaps!));
    });
  }

  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => {
        window.ymaps?.ready(() => resolve(window.ymaps!));
      });
      existing.addEventListener('error', () => reject(new Error('Не удалось загрузить Яндекс.Карты')));
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`;
    script.onload = () => {
      if (!window.ymaps) {
        reject(new Error('ymaps не появился после загрузки скрипта'));
        return;
      }
      window.ymaps.ready(() => resolve(window.ymaps!));
    };
    script.onerror = () => reject(new Error('Не удалось загрузить Яндекс.Карты'));
    document.head.appendChild(script);
  });
}
