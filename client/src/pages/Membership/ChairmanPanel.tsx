import { useMemo, useState } from 'react';
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

export function ChairmanPanel() {
  const toast = useToast();
  const { invalidateResidents } = useInvalidateAppQueries();
  const [houseId, setHouseId] = useState<number | ''>('');
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
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

  const residents = residentsQuery.data ?? [];
  const chairman = useMemo(() => residents.find((r) => r.role === 'CHAIRMAN') ?? null, [residents]);
  const candidates = useMemo(
    () => residents.filter((r) => r.role === 'RESIDENT' || (chairman && r.id === chairman.id)),
    [residents, chairman],
  );

  const appointMutation = useMutation({
    mutationFn: async ({ house, userId }: { house: number; userId: number }) => {
      const { data } = await api.put<User>(`/houses/${house}/chairman`, { userId });
      return data;
    },
    onSuccess: async (_data, vars) => {
      setError(null);
      setSelectedUserId('');
      toast.success('Председатель назначен');
      await invalidateResidents(vars.house);
    },
    onError: (err) => {
      setError(messageForApiError(err));
      toast.error(err);
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (house: number) => {
      const { data } = await api.delete<User>(`/houses/${house}/chairman`);
      return data;
    },
    onSuccess: async (_data, house) => {
      setError(null);
      toast.success('Председатель снят с должности');
      await invalidateResidents(house);
    },
    onError: (err) => {
      setError(messageForApiError(err));
      toast.error(err);
    },
  });

  const busy = appointMutation.isPending || dismissMutation.isPending;

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
        В каждом доме один председатель ТСЖ. При назначении нового предыдущий снимается.
      </Typography.Body>

      <label className={s.field}>
        <span className={s.label}>Дом</span>
        <select
          className={s.select}
          value={activeHouseId ?? ''}
          disabled={busy || houses.length === 0}
          onChange={(e) => {
            setHouseId(Number(e.target.value));
            setSelectedUserId('');
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
      ) : (
        <>
          <div className={s.card}>
            <Typography.Label variant="medium-strong">Сейчас</Typography.Label>
            {chairman ? (
              <>
                <Typography.Body variant="medium-strong" className={s.cardTitle}>
                  {chairman.fullName}
                </Typography.Body>
                <p className={s.meta}>
                  {chairman.apartment ? `кв. ${chairman.apartment}` : 'квартира не указана'}
                  {chairman.username ? ` · @${chairman.username}` : ''}
                </p>
                <Button
                  size="small"
                  variant="secondary"
                  stretched
                  loading={busy}
                  onClick={() => dismissMutation.mutate(activeHouseId)}
                >
                  Снять с должности
                </Button>
              </>
            ) : (
              <Typography.Body variant="small" className={s.hint}>
                Председатель ещё не назначен
              </Typography.Body>
            )}
          </div>

          <div className={s.card}>
            <Typography.Label variant="medium-strong">Назначить</Typography.Label>
            {candidates.length === 0 ? (
              <Typography.Body variant="small" className={s.hint}>
                В доме нет жителей для назначения
              </Typography.Body>
            ) : (
              <>
                <select
                  className={s.select}
                  value={selectedUserId}
                  disabled={busy}
                  onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">Выберите жителя…</option>
                  {candidates.map((resident) => (
                    <option key={resident.id} value={resident.id}>
                      {resident.fullName}
                      {resident.apartment ? `, кв. ${resident.apartment}` : ''}
                      {resident.role === 'CHAIRMAN' ? ' (сейчас)' : ''}
                    </option>
                  ))}
                </select>
                <Button
                  size="small"
                  stretched
                  loading={busy}
                  disabled={!selectedUserId || selectedUserId === chairman?.id}
                  onClick={() => {
                    if (!selectedUserId || activeHouseId == null) return;
                    appointMutation.mutate({ house: activeHouseId, userId: selectedUserId });
                  }}
                >
                  Назначить председателем
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
