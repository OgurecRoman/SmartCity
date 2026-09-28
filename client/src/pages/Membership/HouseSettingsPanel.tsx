import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Spinner, Typography } from '@maxhub/max-ui';
import { api } from '../../api/client';
import { useToast } from '../../components/Toast/ToastProvider';
import { messageForApiError } from '../../lib/apiError';
import { useInvalidateAppQueries } from '../../lib/invalidate';
import { queryKeys } from '../../lib/queryKeys';
import type { House } from '../../types/house';
import s from './Membership.module.scss';

export function HouseSettingsPanel() {
  const toast = useToast();
  const { invalidateHouses, invalidateMe } = useInvalidateAppQueries();
  const [houseId, setHouseId] = useState<number | ''>('');
  const [percent, setPercent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const housesQuery = useQuery({
    queryKey: queryKeys.houses,
    queryFn: async () => {
      const { data } = await api.get<House[]>('/houses');
      return data;
    },
  });

  const houses = housesQuery.data ?? [];
  const activeHouseId = typeof houseId === 'number' ? houseId : houses[0]?.id;
  const activeHouse = houses.find((h) => h.id === activeHouseId) ?? null;

  const saveMutation = useMutation({
    mutationFn: async ({ house, votePercent }: { house: number; votePercent: number }) => {
      const { data } = await api.patch<House>(`/houses/${house}`, { votePercent });
      return data;
    },
    onSuccess: async (house) => {
      setError(null);
      setPercent(String(house.votePercent));
      toast.success(`Порог для «${house.address}»: ${house.votePercent}%`);
      await Promise.all([invalidateHouses(), invalidateMe()]);
    },
    onError: (err) => {
      setError(messageForApiError(err));
      toast.error(err);
    },
  });

  if (housesQuery.isLoading) {
    return (
      <div className={s.state}>
        <Spinner size={40} appearance="themed" />
      </div>
    );
  }

  return (
    <div className={s.section}>
      <Typography.Body variant="small" className={s.hint}>
        Процент подписей жителей, после которого NORMAL-заявка уходит в УК
      </Typography.Body>

      <label className={s.field}>
        <span className={s.label}>Дом</span>
        <select
          className={s.select}
          value={activeHouseId ?? ''}
          disabled={saveMutation.isPending || houses.length === 0}
          onChange={(e) => {
            const next = Number(e.target.value);
            setHouseId(next);
            const found = houses.find((h) => h.id === next);
            setPercent(found ? String(found.votePercent) : '');
            setError(null);
          }}
        >
          {houses.length === 0 && (
            <option value="" disabled>
              Нет домов
            </option>
          )}
          {houses.map((house) => (
            <option key={house.id} value={house.id}>
              {house.address} · {house.votePercent}%
            </option>
          ))}
        </select>
      </label>

      {activeHouse && (
        <label className={s.field}>
          <span className={s.label}>Порог подписей, %</span>
          <input
            className={s.select}
            type="number"
            min={0}
            max={100}
            step={1}
            value={percent === '' ? String(activeHouse.votePercent) : percent}
            disabled={saveMutation.isPending}
            onChange={(e) => setPercent(e.target.value)}
          />
        </label>
      )}

      {error && <p className={s.error}>{error}</p>}

      <Button
        size="small"
        stretched
        loading={saveMutation.isPending}
        disabled={activeHouseId == null}
        onClick={() => {
          if (activeHouseId == null) return;
          const raw = percent === '' ? activeHouse?.votePercent : Number(percent);
          if (raw == null || Number.isNaN(raw) || raw < 0 || raw > 100) {
            setError('Укажите число от 0 до 100');
            return;
          }
          saveMutation.mutate({ house: activeHouseId, votePercent: Math.round(raw) });
        }}
      >
        Сохранить
      </Button>
    </div>
  );
}

