import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Container, Flex, Spinner, Typography } from '@maxhub/max-ui';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import Request from '../../components/Request';
import type { Paginated, RequestType } from '../../types/request';
import { queryKeys } from '../../lib/queryKeys';
import s from './Requests.module.scss';
import SearchLine from '../../components/SearchLine';

type FilterId = 'all' | 'voting' | 'active' | 'done' | 'mine';

const PAGE_SIZE = 10;

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const isUk = user.role === 'UK_EMPLOYEE';
  const canCreate = !isUk;
  const [filter, setFilter] = useState<FilterId>('all');

  const listQuery = useInfiniteQuery({
    queryKey: [...queryKeys.requests, isUk ? 'uk' : 'house'],
    queryFn: async ({ pageParam }) => {
      const { data } = await api.get<Paginated<RequestType>>(isUk ? '/uk/requests' : '/requests', {
        params: { limit: PAGE_SIZE, offset: pageParam },
      });
      return data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
  });

  const allItems = useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [listQuery.data],
  );
  const total = listQuery.data?.pages[0]?.total ?? allItems.length;

  const requests = useMemo(() => {
    const list = allItems.filter((item) => matchesFilter(item, filter));
    return [...list].sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99));
  }, [allItems, filter]);

  if (listQuery.isLoading) {
    return (
      <div className={s.state}>
        <Spinner size={40} appearance="themed" />
      </div>
    );
  }

  if (listQuery.isError) {
    return (
      <div className={s.state}>
        <Typography.Body variant="medium">{(listQuery.error as Error).message}</Typography.Body>
        <Button size="small" loading={listQuery.isFetching} onClick={() => void listQuery.refetch()}>
          Повторить
        </Button>
      </div>
    );
  }

  return (
    <div className={s.page}>
      {!isUk && <SearchLine />}
      <div className={s.header}>
        <Typography.Headline variant="small" asChild>
          <h1 className={s.title}>{isUk ? 'Заявки' : 'Заявки дома'}</h1>
        </Typography.Headline>
        <div className={s.actions}>
          <Typography.Label variant="medium" className={s.count}>
            {requests.length}
            {total != null ? ` / ${total}` : ''}
          </Typography.Label>
          {canCreate && (
            <button
              type="button"
              className={s.createIcon}
              aria-label="Создать заявку"
              onClick={() => navigate('/requests/new')}
            >
              <Plus size={20} strokeWidth={2.25} aria-hidden />
            </button>
          )}
        </div>
      </div>

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
              {canCreate ? 'Создайте первую заявку' : 'Смените фильтр'}
            </Typography.Body>
            {canCreate && (
              <Button size="small" onClick={() => navigate('/requests/new')}>
                Создать заявку
              </Button>
            )}
          </div>
        ) : (
          <Flex direction="column" gap={12}>
            {requests.map((request) => (
              <Request key={request.id} request={request} />
            ))}
            {listQuery.hasNextPage && (
              <Button
                size="medium"
                variant="secondary"
                stretched
                loading={listQuery.isFetchingNextPage}
                onClick={() => void listQuery.fetchNextPage()}
              >
                Показать ещё
              </Button>
            )}
          </Flex>
        )}
      </Container>
    </div>
  );
}
