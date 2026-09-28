import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Spinner, Typography } from '@maxhub/max-ui';
import { api } from '../../api/client';
import { useToast } from '../../components/Toast/ToastProvider';
import { messageForApiError } from '../../lib/apiError';
import { useInvalidateAppQueries } from '../../lib/invalidate';
import { queryKeys } from '../../lib/queryKeys';
import type { House } from '../../types/house';
import type { ResidentItem } from '../../types/membership';
import type { User } from '../../types/user';
import s from './Membership.module.scss';

export function ResidentsPanel() {
  const toast = useToast();
  const { invalidateResidents } = useInvalidateAppQueries();
  const [houseId, setHouseId] = useState<number | ''>('');
  const [confirmId, setConfirmId] = useState<number | null>(null);
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

  const residentsQuery = useQuery({
    queryKey: queryKeys.residents(activeHouseId ?? 0),
    queryFn: async () => {
      const { data } = await api.get<ResidentItem[]>('/residents', {
        params: { houseId: activeHouseId },
      });
      return data;
    },
    enabled: activeHouseId != null,
  });

  const removeMutation = useMutation({
    mutationFn: async ({ house, userId }: { house: number; userId: number }) => {
      const { data } = await api.delete<User>(`/houses/${house}/residents/${userId}`);
      return data;
    },
    onSuccess: async (_data, vars) => {
      setError(null);
      setConfirmId(null);
      toast.success('Житель убран из дома');
      await invalidateResidents(vars.house);
    },
    onError: (err) => {
      setError(messageForApiError(err));
      toast.error(err);
    },
  });

  const busy = removeMutation.isPending;
  const residents = residentsQuery.data ?? [];

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
        Подтверждённые жители дома. Удаление убирает человека из дома
        {residents.length ? ` · ${residents.length}` : ''}
      </Typography.Body>

      <label className={s.field}>
        <span className={s.label}>Дом</span>
        <select
          className={s.select}
          value={activeHouseId ?? ''}
          disabled={busy || houses.length === 0}
          onChange={(e) => {
            setHouseId(Number(e.target.value));
            setConfirmId(null);
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
              {house.address}
            </option>
          ))}
        </select>
      </label>

      {error && <p className={s.error}>{error}</p>}

      {activeHouseId == null ? null : residentsQuery.isLoading ? (
        <div className={s.state}>
          <Spinner size={32} appearance="themed" />
        </div>
      ) : residentsQuery.isError ? (
        <div className={s.state}>
          <Typography.Body variant="medium">{(residentsQuery.error as Error).message}</Typography.Body>
          <Button size="small" onClick={() => void residentsQuery.refetch()}>
            Повторить
          </Button>
        </div>
      ) : residents.length === 0 ? (
        <div className={s.empty}>
          <Typography.Body variant="medium">В доме пока нет жителей</Typography.Body>
        </div>
      ) : (
        <ul className={s.list}>
          {residents.map((resident) => (
            <li key={resident.id} className={s.card}>
              <div className={s.cardTop}>
                <Typography.Body variant="medium-strong" className={s.cardTitle}>
                  {resident.fullName}
                </Typography.Body>
                {resident.role === 'CHAIRMAN' && (
                  <Typography.Label variant="medium" className={s.meta}>
                    ТСЖ
                  </Typography.Label>
                )}
              </div>
              <p className={s.meta}>
                {resident.apartment ? `кв. ${resident.apartment}` : 'квартира не указана'}
                {resident.residentTypeLabel ? ` · ${resident.residentTypeLabel}` : ''}
                {resident.username ? ` · @${resident.username}` : ''}
              </p>

              {confirmId === resident.id ? (
                <div className={s.rowActions}>
                  <Button
                    size="small"
                    stretched
                    loading={busy}
                    onClick={() => {
                      if (activeHouseId == null) return;
                      removeMutation.mutate({ house: activeHouseId, userId: resident.id });
                    }}
                  >
                    Убрать из дома
                  </Button>
                  <Button
                    size="small"
                    variant="secondary"
                    stretched
                    disabled={busy}
                    onClick={() => {
                      setConfirmId(null);
                      setError(null);
                    }}
                  >
                    Отмена
                  </Button>
                </div>
              ) : (
                <Button
                  size="small"
                  variant="secondary"
                  stretched
                  disabled={busy}
                  onClick={() => {
                    setConfirmId(resident.id);
                    setError(null);
                  }}
                >
                  Удалить
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
