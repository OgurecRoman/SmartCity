import { Button, Container, Flex, Spinner, Typography } from '@maxhub/max-ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { ChevronRight, Plus, Settings2 } from 'lucide-react';
import { api } from '../../api/client';
import Request from '../../components/Request';
import { useAuth } from '../../auth/AuthProvider';
import type { Paginated, RequestType } from '../../types/request';
import { queryKeys } from '../../lib/queryKeys';
import s from './Profile.module.scss';

type Company = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  workingHours: string | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isUk = user.role === 'UK_EMPLOYEE';
  const canCreate = !isUk;

  const mineQuery = useQuery({
    queryKey: [...queryKeys.requests, 'mine'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<RequestType>>('/requests', {
        params: { filter: 'mine', limit: 50, offset: 0 },
      });
      return data;
    },
    enabled: canCreate,
  });

  const companyQuery = useQuery({
    queryKey: queryKeys.company,
    queryFn: async () => {
      const { data } = await api.get<Company | null>('/company');
      return data;
    },
    enabled: isUk,
  });

  const requests = mineQuery.data?.items ?? [];
  const displayName = user.verifiedFullName ?? user.name;
  const company = companyQuery.data;

  const footerMeta = user.house
    ? [user.house.address, user.apartment ? `кв. ${user.apartment}` : null, user.entrance ? `подъезд ${user.entrance}` : null]
        .filter(Boolean)
        .join(' · ')
    : isUk
      ? company?.name
        ? `${company.name} · все дома в зоне ответственности`
        : 'Без привязки к квартире · работаете по всем домам'
      : 'Дом и квартира ещё не указаны';

  return (
    <div className={s.page}>
      <div className={s.header}>
        <Typography.Headline variant="small" asChild>
          <h1 className={s.title}>Профиль</h1>
        </Typography.Headline>
      </div>

      <section className={s.identity} aria-label="Профиль">
        <div className={s.avatar} aria-hidden>
          {initials(displayName)}
        </div>
        <div className={s.identityText}>
          <Typography.Title variant="medium" className={s.name}>
            {displayName}
          </Typography.Title>
          <span className={isUk ? `${s.role} ${s.roleUk}` : s.role}>{user.roleLabel}</span>
          {user.residentTypeLabel && !isUk && (
            <Typography.Label variant="medium" className={s.meta}>
              {user.residentTypeLabel}
            </Typography.Label>
          )}
        </div>
        <Typography.Body variant="small" className={s.address}>
          {footerMeta}
        </Typography.Body>
      </section>

      {isUk && (
        <section className={s.ukCard} aria-label="Рабочий профиль УК">
          <Typography.Title variant="small" asChild>
            <h2>Кабинет УК</h2>
          </Typography.Title>
          <Typography.Body variant="small" className={s.ukHint}>
            Заявки, жители и объявления — по выбранному дому в соответствующих разделах. Квартира сотруднику не
            нужна.
          </Typography.Body>
          {companyQuery.isLoading ? (
            <Spinner size={28} appearance="themed" />
          ) : company ? (
            <div className={s.ukContacts}>
              {company.phone && (
                <a className={s.link} href={`tel:${company.phone}`}>
                  {company.phone}
                </a>
              )}
              {company.email && (
                <a className={s.link} href={`mailto:${company.email}`}>
                  {company.email}
                </a>
              )}
              {company.workingHours && (
                <Typography.Body variant="small" className={s.meta}>
                  {company.workingHours}
                </Typography.Body>
              )}
            </div>
          ) : null}
        </section>
      )}

      <section className={s.menu} aria-label="Разделы профиля">
        <button type="button" className={s.menuItem} onClick={() => navigate('/settings')}>
          <span className={s.menuIcon} aria-hidden>
            <Settings2 size={18} strokeWidth={2.1} />
          </span>
          <span className={s.menuText}>
            <span className={s.menuTitle}>Настройки</span>
            <span className={s.menuHint}>Тема, шрифт и доступность</span>
          </span>
          <ChevronRight size={18} strokeWidth={2} className={s.menuChevron} aria-hidden />
        </button>
      </section>

      {canCreate && (
        <>
          <div className={s.sectionHead}>
            <Typography.Title variant="small" asChild>
              <h2 className={s.title}>Мои заявки</h2>
            </Typography.Title>
            <div className={s.actions}>
              <Typography.Label variant="medium" className={s.count}>
                {mineQuery.data?.total ?? requests.length}
              </Typography.Label>
              <button
                type="button"
                className={s.createIcon}
                aria-label="Создать заявку"
                onClick={() => navigate('/requests/new')}
              >
                <Plus size={20} strokeWidth={2.25} aria-hidden />
              </button>
            </div>
          </div>

          <Container>
            {mineQuery.isLoading ? (
              <div className={s.empty}>
                <Spinner size={32} appearance="themed" />
              </div>
            ) : mineQuery.isError ? (
              <div className={s.empty}>
                <Typography.Body variant="medium">{(mineQuery.error as Error).message}</Typography.Body>
                <Button size="small" onClick={() => void mineQuery.refetch()}>
                  Повторить
                </Button>
              </div>
            ) : requests.length === 0 ? (
              <div className={s.empty}>
                <Typography.Body variant="medium">Пока пусто</Typography.Body>
                <Typography.Body variant="small" className={s.emptyHint}>
                  Здесь появятся ваши заявки
                </Typography.Body>
                <Button size="small" onClick={() => navigate('/requests/new')}>
                  Создать заявку
                </Button>
              </div>
            ) : (
              <Flex direction="column" gap={12}>
                {requests.map((request) => (
                  <Request key={request.id} request={request} />
                ))}
              </Flex>
            )}
          </Container>
        </>
      )}
    </div>
  );
}
