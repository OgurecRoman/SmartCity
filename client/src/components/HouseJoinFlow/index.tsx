import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Typography } from '@maxhub/max-ui';
import { api } from '../../api/client';
import YandexMap from '../YandexMap';
import { useInvalidateAppQueries } from '../../lib/invalidate';
import { queryKeys } from '../../lib/queryKeys';
import type { YmapsCoords } from '../../lib/ymaps';
import type { Building, GeoHit, House, HouseLookup } from '../../types/house';
import type { Membership } from '../../types/user';
import s from '../../pages/Onboarding/Onboarding.module.scss';

const DEFAULT_CENTER: YmapsCoords = [55.8285919, 49.0850117];

type Candidate = {
  building: Building;
  house: House | null;
  coords: YmapsCoords;
};

export type HouseJoinFlowMode = 'join' | 'uk-add';

export type HouseJoinFlowProps = {
  mode?: HouseJoinFlowMode;
  defaultFullName?: string;
  onCancel?: () => void;
  onSuccess?: () => void;
  eyebrow?: string;
  title?: string;
};

export default function HouseJoinFlow({
  mode = 'join',
  defaultFullName = '',
  onCancel,
  onSuccess,
  eyebrow = 'Умный город',
  title = 'Выберите дом',
}: HouseJoinFlowProps) {
  const isUkAdd = mode === 'uk-add';
  const apiKey = import.meta.env.VITE_YANDEX_MAPS_API_KEY?.trim() ?? '';
  const { invalidateMe, invalidateHouses } = useInvalidateAppQueries();

  const [center, setCenter] = useState<YmapsCoords>(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(16);
  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [selectedHouse, setSelectedHouse] = useState<House | null>(null);
  const [apartment, setApartment] = useState('');
  const [fullName, setFullName] = useState(defaultFullName);
  const [error, setError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(query.trim()), 400);
    return () => window.clearTimeout(t);
  }, [query]);

  const housesQuery = useQuery({
    queryKey: queryKeys.houses,
    queryFn: async () => {
      const { data } = await api.get<House[]>('/houses');
      return data;
    },
  });

  const geoQuery = useQuery({
    queryKey: ['geo', 'search', debouncedQ],
    queryFn: async () => {
      const { data } = await api.get<GeoHit[]>('/geo/search', { params: { q: debouncedQ } });
      return data;
    },
    enabled: debouncedQ.length >= 3,
  });

  const markers = useMemo(
    () =>
      (housesQuery.data ?? [])
        .filter((h): h is House & { lat: number; lng: number } => h.lat != null && h.lng != null)
        .map((h) => ({
          id: h.id,
          coords: [h.lat, h.lng] as YmapsCoords,
          title: h.address,
        })),
    [housesQuery.data],
  );

  const createHouseMutation = useMutation({
    mutationFn: async (coords: YmapsCoords) => {
      const { data } = await api.post<House>('/houses', { lat: coords[0], lng: coords[1] });
      return data;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (payload: { houseId: number; apartment: string; fullName: string }) => {
      const { data } = await api.patch<{ membership: Membership }>('/me', payload);
      return data;
    },
    onSuccess: async () => {
      await invalidateMe();
      onSuccess?.();
    },
  });

  const finishUkAdd = async () => {
    await Promise.all([invalidateHouses(), housesQuery.refetch()]);
    onSuccess?.();
  };

  const busy =
    lookupLoading || createHouseMutation.isPending || submitMutation.isPending;

  const handleMapClick = async (coords: YmapsCoords) => {
    setError(null);
    setCandidate(null);
    setLookupLoading(true);
    try {
      const { data } = await api.get<HouseLookup>('/houses/lookup', {
        params: { lat: coords[0], lng: coords[1] },
      });
      setCandidate({
        building: data.building,
        house: data.house,
        coords: [data.building.lat, data.building.lng],
      });
      setCenter([data.building.lat, data.building.lng]);
    } catch (err) {
      setError((err as Error).message || 'Не удалось определить дом');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleMarkerClick = (id: number | string) => {
    const house = housesQuery.data?.find((h) => h.id === id);
    if (!house) return;
    setError(null);
    setCandidate(null);
    if (isUkAdd) {
      void finishUkAdd();
      return;
    }
    setSelectedHouse(house);
  };

  const handleConfirmBuilding = async () => {
    if (!candidate) return;
    setError(null);
    try {
      if (isUkAdd) {
        await createHouseMutation.mutateAsync(candidate.coords);
        setCandidate(null);
        await finishUkAdd();
        return;
      }

      if (candidate.house) {
        setSelectedHouse(candidate.house);
        setCandidate(null);
        return;
      }
      const house = await createHouseMutation.mutateAsync(candidate.coords);
      setSelectedHouse(house);
      setCandidate(null);
      await housesQuery.refetch();
    } catch (err) {
      setError((err as Error).message || 'Не удалось сохранить дом');
    }
  };

  const handleSubmit = async () => {
    if (!selectedHouse) return;
    setError(null);
    const apt = apartment.trim();
    const name = fullName.trim();
    if (!apt) {
      setError('Укажите номер квартиры');
      return;
    }
    if (name.length < 3) {
      setError('Укажите ваше ФИО');
      return;
    }
    try {
      await submitMutation.mutateAsync({
        houseId: selectedHouse.id,
        apartment: apt,
        fullName: name,
      });
    } catch (err) {
      setError((err as Error).message || 'Не удалось подать заявку');
    }
  };

  if (selectedHouse && !isUkAdd) {
    return (
      <div className={s.pageForm}>
        <button
          type="button"
          className={s.back}
          onClick={() => {
            setSelectedHouse(null);
            setError(null);
          }}
        >
          ← На карту
        </button>
        <div className={s.topTitle}>
          <p className={s.eyebrow}>{eyebrow}</p>
          <Typography.Headline variant="small">Ваши данные</Typography.Headline>
        </div>
        <div className={s.addressChip}>{selectedHouse.address}</div>
        {selectedHouse.entrances?.length > 0 && (
          <p className={s.entrances}>
            Подъезды:{' '}
            {selectedHouse.entrances
              .map((e) => `${e.number}: кв. ${e.from}–${e.to}`)
              .join(' · ')}
          </p>
        )}

        <div className={s.form}>
          <label className={s.field}>
            <span className={s.label}>Квартира</span>
            <input
              className={s.fieldInput}
              placeholder="Например, 12"
              value={apartment}
              onChange={(e) => setApartment(e.target.value)}
              maxLength={10}
              autoComplete="off"
              inputMode="text"
            />
          </label>
          <label className={s.field}>
            <span className={s.label}>ФИО</span>
            <input
              className={s.fieldInput}
              placeholder="Иванов Иван Иванович"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={150}
              autoComplete="name"
            />
          </label>
          {error && (
            <Typography.Body variant="small" className={s.error}>
              {error}
            </Typography.Body>
          )}
          <div className={s.actions}>
            <Button size="medium" stretched loading={busy} onClick={() => void handleSubmit()}>
              Подать заявку
            </Button>
            {onCancel && (
              <Button size="medium" variant="secondary" stretched onClick={onCancel}>
                Отменить
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={s.pageMap}>
      <header className={s.topBar}>
        {onCancel && (
          <button type="button" className={s.back} onClick={onCancel}>
            ← Назад
          </button>
        )}
        <div className={s.topTitle}>
          <p className={s.eyebrow}>{eyebrow}</p>
          <Typography.Headline variant="small">{title}</Typography.Headline>
        </div>
      </header>

      <div className={s.mapStage}>
        {!apiKey ? (
          <div className={s.missingKey}>
            <Typography.Body variant="medium">Нет ключа Яндекс.Карт</Typography.Body>
            <Typography.Body variant="small" className={s.hint}>
              VITE_YANDEX_MAPS_API_KEY в client/.env
            </Typography.Body>
          </div>
        ) : (
          <div className={s.mapShell}>
            <YandexMap
              apiKey={apiKey}
              center={center}
              zoom={zoom}
              markers={markers}
              onMapClick={(coords) => void handleMapClick(coords)}
              onMarkerClick={handleMarkerClick}
            />
          </div>
        )}

        <div className={s.searchOverlay}>
          <input
            className={s.searchInput}
            placeholder="Поиск адреса"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            enterKeyHint="search"
          />
          {geoQuery.data && geoQuery.data.length > 0 && (
            <ul className={s.suggests}>
              {geoQuery.data.map((hit) => (
                <li key={`${hit.lat},${hit.lng},${hit.label}`}>
                  <button
                    type="button"
                    className={s.suggestBtn}
                    onClick={() => {
                      setCenter([hit.lat, hit.lng]);
                      setZoom(17);
                      setQuery(hit.label);
                      setDebouncedQ('');
                      void handleMapClick([hit.lat, hit.lng]);
                    }}
                  >
                    {hit.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={s.bottomDock}>
          {lookupLoading && (
            <div className={s.statusPill} role="status">
              Ищем дом…
            </div>
          )}

          {error && !candidate && (
            <div className={s.errorBanner}>
              <Typography.Body variant="small" className={s.error}>
                {error}
              </Typography.Body>
            </div>
          )}

          {candidate && (
            <div className={s.sheet}>
              <div className={s.sheetHandle} aria-hidden />
              <Typography.Body variant="medium-strong">
                {isUkAdd ? 'Добавить этот дом в УК?' : 'Это ваш дом?'}
              </Typography.Body>
              <div className={s.addressChip}>{candidate.building.address}</div>
              {candidate.building.entrances?.length > 0 && (
                <p className={s.entrances}>
                  Подъезды:{' '}
                  {candidate.building.entrances
                    .map((e) => `${e.number}: кв. ${e.from}–${e.to}`)
                    .join(' · ')}
                </p>
              )}
              <Typography.Body variant="small" className={s.hint}>
                {isUkAdd
                  ? candidate.house
                    ? 'Дом уже в системе — проверим, что он вашей УК'
                    : 'Дом появится в списке домов УК сразу'
                  : candidate.house
                    ? 'Дом уже в системе'
                    : 'Добавим дом после подтверждения'}
              </Typography.Body>
              {error && (
                <Typography.Body variant="small" className={s.error}>
                  {error}
                </Typography.Body>
              )}
              <div className={s.sheetActions}>
                <Button
                  size="medium"
                  variant="primary"
                  stretched
                  loading={busy}
                  onClick={() => void handleConfirmBuilding()}
                >
                  {isUkAdd ? 'Добавить' : 'Да, это он'}
                </Button>
                <Button
                  size="medium"
                  variant="secondary"
                  stretched
                  disabled={busy}
                  onClick={() => {
                    setCandidate(null);
                    setError(null);
                  }}
                >
                  Выбрать другой
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
