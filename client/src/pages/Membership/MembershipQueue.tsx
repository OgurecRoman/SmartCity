import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Spinner, Typography } from '@maxhub/max-ui';
import { api } from '../../api/client';
import { useToast } from '../../components/Toast/ToastProvider';
import { messageForApiError } from '../../lib/apiError';
import { formatDate } from '../../lib/formatDate';
import { useInvalidateAppQueries } from '../../lib/invalidate';
import { queryKeys } from '../../lib/queryKeys';
import type { MembershipRequestItem } from '../../types/membership';
import type { Paginated } from '../../types/request';
import s from './Membership.module.scss';

export function MembershipQueue() {
  const toast = useToast();
  const { invalidateMembership } = useInvalidateAppQueries();
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: queryKeys.membership,
    queryFn: async () => {
      const { data } = await api.get<Paginated<MembershipRequestItem>>('/membership/requests', {
        params: { limit: 50, offset: 0 },
      });
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<MembershipRequestItem>(`/membership/requests/${id}/approve`);
      return data;
    },
    onSuccess: async () => {
      setActionError(null);
      toast.success('Заявка одобрена');
      await invalidateMembership();
    },
    onError: (err) => {
      setActionError(messageForApiError(err));
      toast.error(err);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason: rejectReason }: { id: number; reason: string }) => {
      const { data } = await api.post<MembershipRequestItem>(`/membership/requests/${id}/reject`, {
        reason: rejectReason,
      });
      return data;
    },
    onSuccess: async () => {
      setRejectId(null);
      setReason('');
      setActionError(null);
      toast.success('Заявка отклонена');
      await invalidateMembership();
    },
    onError: (err) => {
      setActionError(messageForApiError(err));
      toast.error(err);
    },
  });

  const busy = approveMutation.isPending || rejectMutation.isPending;
  const items = query.data?.items ?? [];

  if (query.isLoading) {
    return (
      <div className={s.state}>
        <Spinner size={40} appearance="themed" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className={s.state}>
        <Typography.Body variant="medium">{(query.error as Error).message}</Typography.Body>
        <Button size="small" onClick={() => void query.refetch()}>
          Повторить
        </Button>
      </div>
    );
  }

  return (
    <div className={s.section}>
      <Typography.Body variant="small" className={s.hint}>
        Заявки на вступление в дом
        {query.data?.total != null ? ` · ${query.data.total}` : ''}
      </Typography.Body>

      {actionError && <p className={s.error}>{actionError}</p>}

      {items.length === 0 ? (
        <div className={s.empty}>
          <Typography.Body variant="medium">Очередь пуста</Typography.Body>
          <Typography.Body variant="small" className={s.hint}>
            Новые заявки появятся здесь
          </Typography.Body>
        </div>
      ) : (
        <ul className={s.list}>
          {items.map((item) => (
            <li key={item.id} className={s.card}>
              <div className={s.cardTop}>
                <Typography.Body variant="medium-strong" className={s.cardTitle}>
                  {item.fullName}
                </Typography.Body>
                <time className={s.meta} dateTime={item.createdAt}>
                  {formatDate(item.createdAt)}
                </time>
              </div>
              <p className={s.meta}>
                {item.houseAddress}, кв. {item.apartment}
              </p>

              {rejectId === item.id ? (
                <div className={s.rejectBox}>
                  <label className={s.field}>
                    <span className={s.label}>Причина отказа</span>
                    <textarea
                      className={s.textarea}
                      rows={3}
                      maxLength={500}
                      value={reason}
                      disabled={busy}
                      placeholder="Например, квартира занята"
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <div className={s.rowActions}>
                    <Button
                      size="small"
                      stretched
                      loading={busy}
                      onClick={() => {
                        if (reason.trim().length < 3) {
                          setActionError('Укажите причину (от 3 символов)');
                          return;
                        }
                        rejectMutation.mutate({ id: item.id, reason: reason.trim() });
                      }}
                    >
                      Отклонить
                    </Button>
                    <Button
                      size="small"
                      variant="secondary"
                      stretched
                      disabled={busy}
                      onClick={() => {
                        setRejectId(null);
                        setReason('');
                        setActionError(null);
                      }}
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <div className={s.rowActions}>
                  <Button
                    size="small"
                    stretched
                    loading={busy}
                    onClick={() => approveMutation.mutate(item.id)}
                  >
                    Одобрить
                  </Button>
                  <Button
                    size="small"
                    variant="secondary"
                    stretched
                    disabled={busy}
                    onClick={() => {
                      setRejectId(item.id);
                      setReason('');
                      setActionError(null);
                    }}
                  >
                    Отклонить
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
