import { useMemo, useState } from 'react';
import { Button, Container, Flex, Spinner, Typography } from '@maxhub/max-ui';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import Request from '../../components/Request';
import type { RequestType } from '../../types/request';
import s from './Requests.module.scss';
import SearchLine from '../../components/SearchLine';

type FilterId = 'all' | 'voting' | 'active' | 'done' | 'mine';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'voting', label: 'Подписи' },
  { id: 'active', label: 'В работе' },
  { id: 'done', label: 'Закрыты' },
  { id: 'mine', label: 'Мои заявки' },
];

const STATUS_ORDER: Record<string, number> = {
  VOTING: 0,
  SUBMITTED: 1,
  IN_PROGRESS: 2,
  DELEGATED: 3,
  RESOLVED: 4,
  REJECTED: 5,
  EXPIRED: 6,
};

function matchesFilter(request: RequestType, filter: FilterId) {
  switch (filter) {
    case 'voting':
      return request.status === 'VOTING';
    case 'active':
      return request.status === 'SUBMITTED' || request.status === 'IN_PROGRESS' || request.status === 'DELEGATED';
    case 'done':
      return request.status === 'RESOLVED' || request.status === 'REJECTED' || request.status === 'EXPIRED';
    case 'mine':
      return request.isMine;
    default:
      return true;
  }
}

export default function Requests() {
  const [filter, setFilter] = useState<FilterId>('all');
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['requests'],
    queryFn: async () => {
      const { data } = await api.get<RequestType[]>('/requests');
      return data;
    },
  });

  const requests = useMemo(() => {
    const list = (data ?? []).filter((item) => matchesFilter(item, filter));
    return [...list].sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99));
  }, [data, filter]);

  if (isLoading) {
    return (
      <div className={s.state}>
        <Spinner size={40} appearance="themed" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.state}>
        <Typography.Body variant="medium">{error.message}</Typography.Body>
        <Button size="small" loading={isFetching} onClick={() => refetch()}>
          Повторить
        </Button>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <SearchLine />
      <Flex direction="row" justify="space-between" align="center" gap={12} className={s.header}>
        <Typography.Headline variant="small" asChild>
          <h1>Заявки дома</h1>
        </Typography.Headline>
        <Typography.Label variant="medium" className={s.count}>
          {requests.length}
        </Typography.Label>
      </Flex>

      <div className={s.filters} role="tablist" aria-label="Фильтр заявок">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            className={filter === item.id ? `${s.chip} ${s.chipActive}` : s.chip}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Container>
        {requests.length === 0 ? (
          <div className={s.empty}>
            <Typography.Body variant="medium">Пока пусто</Typography.Body>
            <Typography.Body variant="small" className={s.emptyHint}>
              Смените фильтр или создайте заявку позже
            </Typography.Body>
          </div>
        ) : (
          <Flex direction="column" gap={12}>
            {requests.map((request) => (
              <Request key={request.id} request={request} />
            ))}
          </Flex>
        )}
      </Container>
    </div>
  );
}
