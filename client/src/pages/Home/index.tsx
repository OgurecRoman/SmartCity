import { useQuery } from '@tanstack/react-query';
import { Button, Spinner, Typography } from '@maxhub/max-ui';
import { useNavigate } from 'react-router';
import { ChevronRight, Clock3, Mail, MapPin, PenLine, Phone, Star } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import type { Paginated, RequestType } from '../../types/request';
import { queryKeys } from '../../lib/queryKeys';
import s from './Home.module.scss';

type Company = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  workingHours: string | null;
  rating: { average: number | null; count: number } | null;
};

function firstName(full: string) {
  return full.trim().split(/\s+/)[0] || full;
}

function shortAddress(address: string) {
  return address.replace(/\s+улица\b/gi, ' ул.').replace(/\s+улица,/gi, ' ул.,');
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const displayName = user.verifiedFullName ?? user.name;
  const isUk = user.role === 'UK_EMPLOYEE';
  const canCreate = !isUk;

  const companyQuery = useQuery({
    queryKey: queryKeys.company,
    queryFn: async () => {
      const { data } = await api.get<Company | null>('/company');
      return data;
    },
  });

  const requestsQuery = useQuery({
    queryKey: [...queryKeys.requests, 'home-summary'],
    queryFn: async () => {
      const path = isUk ? '/uk/requests' : '/requests';
      const { data } = await api.get<Paginated<RequestType>>(path, {
        params: { limit: 50, offset: 0 },
      });
      return data;
    },
    enabled: user.onboarded || isUk,
  });

  const items = requestsQuery.data?.items ?? [];
  const votingCount = items.filter((item) => item.status === 'VOTING').length;
  const activeCount = items.filter(
    (item) => item.status === 'SUBMITTED' || item.status === 'IN_PROGRESS' || item.status === 'DELEGATED',
  ).length;
  const company = companyQuery.data;

  const placeLine = user.house
    ? [shortAddress(user.house.address), user.apartment ? `кв. ${user.apartment}` : null]
        .filter(Boolean)
        .join(', ')
    : isUk
      ? company?.name ?? 'Все дома в зоне ответственности'
      : 'Дом ещё не выбран';

  return (
    <div className={s.page}>
      <section className={s.hero} aria-label="Приветствие">
        <div className={s.heroTop}>
          <Typography.Label variant="medium" className={s.eyebrow}>
            {isUk ? 'Кабинет УК' : 'Дом'}
          </Typography.Label>
          <span className={s.role}>{user.roleLabel}</span>
        </div>
        <Typography.Headline variant="small" asChild>
          <h1 className={s.hello}>Привет, {firstName(displayName)}</h1>
        </Typography.Headline>
        <p className={s.place}>
          <MapPin size={15} strokeWidth={2} aria-hidden className={s.placeIcon} />
          <span>{placeLine}</span>
        </p>
      </section>

      {(user.onboarded || isUk) && (
        <section className={s.card} aria-label="Сводка по заявкам">
          <div className={s.cardHead}>
            <Typography.Title variant="small" asChild>
              <h2>Заявки{isUk ? '' : ' дома'}</h2>
            </Typography.Title>
            <button type="button" className={s.linkBtn} onClick={() => navigate('/requests')}>
              Все
              <ChevronRight size={16} strokeWidth={2} aria-hidden />
            </button>
          </div>

          {requestsQuery.isLoading ? (
            <div className={s.cardState}>
              <Spinner size={28} appearance="themed" />
            </div>
          ) : requestsQuery.isError ? (
            <Typography.Body variant="small" className={s.muted}>
              {(requestsQuery.error as Error).message}
            </Typography.Body>
          ) : (
            <>
              <div className={s.stats}>
                <button
                  type="button"
                  className={s.stat}
                  onClick={() => navigate('/requests')}
                  aria-label={`Сбор подписей: ${votingCount}`}
                >
                  <span className={s.statValue}>{votingCount}</span>
                  <span className={s.statLabel}>сбор подписей</span>
                </button>
                <button
                  type="button"
                  className={s.stat}
                  onClick={() => navigate('/requests')}
                  aria-label={`В работе: ${activeCount}`}
                >
                  <span className={s.statValue}>{activeCount}</span>
                  <span className={s.statLabel}>в работе</span>
                </button>
              </div>
              {canCreate && (
                <Button size="small" stretched onClick={() => navigate('/requests/new')}>
                  Создать заявку
                </Button>
              )}
              {isUk && (
                <Button size="small" variant="secondary" stretched onClick={() => navigate('/requests')}>
                  К заявкам
                </Button>
              )}
            </>
          )}
        </section>
      )}

      <section className={s.card} aria-label="Управляющая компания">
        <div className={s.cardHead}>
          <Typography.Title variant="small" asChild>
            <h2>{isUk ? 'Компания' : 'Ваша УК'}</h2>
          </Typography.Title>
          {isUk && (
            <button
              type="button"
              className={s.createIcon}
              aria-label="Редактировать УК"
              onClick={() => navigate('/company/edit')}
            >
              <PenLine size={20} strokeWidth={2.25} aria-hidden />
            </button>
          )}
        </div>

        {companyQuery.isLoading ? (
          <div className={s.cardState}>
            <Spinner size={28} appearance="themed" />
          </div>
        ) : !company ? (
          <Typography.Body variant="small" className={s.muted}>
            Данные УК пока недоступны
          </Typography.Body>
        ) : (
          <div className={s.company}>
            <Typography.Body variant="medium-strong" className={s.companyName}>
              {company.name}
            </Typography.Body>

            {company.rating && company.rating.count > 0 && (
              <p className={s.rating}>
                <Star size={14} strokeWidth={2} aria-hidden />
                <span>
                  {company.rating.average?.toFixed(1) ?? '—'}
                  <span className={s.ratingMuted}> · {company.rating.count} оценок</span>
                </span>
              </p>
            )}

            <ul className={s.contactList}>
              {company.phone && (
                <li>
                  <a className={s.contact} href={`tel:${company.phone}`}>
                    <Phone size={16} strokeWidth={1.9} aria-hidden />
                    <span>{company.phone}</span>
                  </a>
                </li>
              )}
              {company.email && (
                <li>
                  <a className={s.contact} href={`mailto:${company.email}`}>
                    <Mail size={16} strokeWidth={1.9} aria-hidden />
                    <span>{company.email}</span>
                  </a>
                </li>
              )}
              {company.workingHours && (
                <li className={s.contactStatic}>
                  <Clock3 size={16} strokeWidth={1.9} aria-hidden />
                  <span>{company.workingHours}</span>
                </li>
              )}
              {company.address && (
                <li className={s.contactStatic}>
                  <MapPin size={16} strokeWidth={1.9} aria-hidden />
                  <span>{company.address}</span>
                </li>
              )}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
