import { useEffect, useRef, useState } from 'react';
import { loadYmaps, type YmapsApi, type YmapsCoords, type YmapsMap } from '../../lib/ymaps';
import s from './YandexMap.module.scss';

export type MapMarker = {
  id: number | string;
  coords: YmapsCoords;
  title?: string;
};

type Props = {
  apiKey: string;
  center: YmapsCoords;
  zoom?: number;
  markers?: MapMarker[];
  onMapClick?: (coords: YmapsCoords) => void;
  onMarkerClick?: (id: number | string) => void;
  className?: string;
};

export default function YandexMap({
  apiKey,
  center,
  zoom = 16,
  markers = [],
  onMapClick,
  onMarkerClick,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<YmapsMap | null>(null);
  const ymapsRef = useRef<YmapsApi | null>(null);
  const [ready, setReady] = useState(false);
  const onMapClickRef = useRef(onMapClick);
  const onMarkerClickRef = useRef(onMarkerClick);
  const centerRef = useRef(center);
  const zoomRef = useRef(zoom);
  onMapClickRef.current = onMapClick;
  onMarkerClickRef.current = onMarkerClick;
  centerRef.current = center;
  zoomRef.current = zoom;

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    const el = containerRef.current;
    if (!el || !apiKey.trim()) return;

    setReady(false);

    void loadYmaps(apiKey.trim())
      .then((ymaps) => {
        if (cancelled || !containerRef.current) return;
        ymapsRef.current = ymaps;

        const map = new ymaps.Map(
          containerRef.current,
          {
            center: centerRef.current,
            zoom: zoomRef.current,
            controls: [],
          },
          { suppressMapOpenBlock: true, yandexMapDisablePoiInteractivity: true },
        );

        map.controls.add('geolocationControl', {
          float: 'none',
          position: { top: 72, right: 12 },
        });
        map.controls.add('zoomControl', {
          float: 'none',
          position: { top: 120, right: 12 },
          size: 'small',
        });

        mapRef.current = map;
        map.events.add('click', (e) => {
          if (e.get('target') !== map) return;
          onMapClickRef.current?.(e.get('coords'));
        });

        const fit = () => {
          try {
            map.container.fitToViewport();
          } catch {}
        };

        requestAnimationFrame(() => {
          fit();
          requestAnimationFrame(fit);
        });

        resizeObserver = new ResizeObserver(() => fit());
        resizeObserver.observe(containerRef.current);

        setReady(true);
      })
      .catch((err) => {
        console.error(err);
      });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      mapRef.current?.destroy();
      mapRef.current = null;
      setReady(false);
    };
  }, [apiKey]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    mapRef.current.setCenter(center, zoom, { duration: 300 });
  }, [center, zoom, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const ymaps = ymapsRef.current;
    if (!ready || !map || !ymaps) return;

    map.geoObjects.removeAll();
    for (const marker of markers) {
      if (!Number.isFinite(marker.coords[0]) || !Number.isFinite(marker.coords[1])) continue;
      const placemark = new ymaps.Placemark(
        marker.coords,
        {
          balloonContent: marker.title,
          hintContent: marker.title,
        },
        { preset: 'islands#blueHomeIcon' },
      );
      placemark.events.add('click', () => {
        onMarkerClickRef.current?.(marker.id);
      });
      map.geoObjects.add(placemark);
    }
  }, [markers, ready]);

  return <div ref={containerRef} className={className ? `${s.map} ${className}` : s.map} />;
}
