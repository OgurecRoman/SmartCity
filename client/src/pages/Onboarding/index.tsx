import { useState } from 'react';
import { Button, Typography } from '@maxhub/max-ui';
import HouseJoinFlow from '../../components/HouseJoinFlow';
import type { Membership, User } from '../../types/user';
import s from './Onboarding.module.scss';

type Props = {
  user: User;
  refetch: () => void;
  isFetching: boolean;
};

export default function Onboarding({ user, refetch, isFetching }: Props) {
  const membership = user.membership;
  const [forceForm, setForceForm] = useState(false);

  if (membership?.status === 'PENDING') {
    return <PendingView membership={membership} refetch={refetch} isFetching={isFetching} />;
  }

  if (membership?.status === 'REJECTED' && !forceForm) {
    return <RejectedView membership={membership} onRetry={() => setForceForm(true)} />;
  }

  return (
    <HouseJoinFlow
      defaultFullName={user.verifiedFullName ?? user.name}
      eyebrow="Умный дом"
      title="Выберите дом"
    />
  );
}

function PendingView({
  membership,
  refetch,
  isFetching,
}: {
  membership: Membership;
  refetch: () => void;
  isFetching: boolean;
}) {
  return (
    <div className={`${s.page} ${s.centered}`}>
      <div className={s.stateCard}>
        <p className={s.eyebrow}>Вступление</p>
        <Typography.Headline variant="small">Заявка на рассмотрении</Typography.Headline>
        <Typography.Body variant="medium">
          {membership.houseAddress}, кв. {membership.apartment}
        </Typography.Body>
        <Typography.Body variant="small" className={s.hint}>
          Ждём подтверждения председателя ТСЖ или УК.
          <br />
          ФИО: {membership.fullName}
        </Typography.Body>
        <Button size="medium" stretched loading={isFetching} onClick={() => refetch()}>
          Обновить статус
        </Button>
      </div>
    </div>
  );
}

function RejectedView({
  membership,
  onRetry,
}: {
  membership: Membership;
  onRetry: () => void;
}) {
  return (
    <div className={`${s.page} ${s.centered}`}>
      <div className={s.stateCard}>
        <p className={s.eyebrow}>Вступление</p>
        <Typography.Headline variant="small">Заявку отклонили</Typography.Headline>
        <Typography.Body variant="medium">
          {membership.rejectReason ?? 'Причина не указана'}
        </Typography.Body>
        <Typography.Body variant="small" className={s.hint}>
          Можно выбрать дом на карте и подать заявку снова.
        </Typography.Body>
        <Button size="medium" stretched onClick={onRetry}>
          Подать снова
        </Button>
      </div>
    </div>
  );
}
