import { Typography } from '@maxhub/max-ui';
import { useAuth } from '../../auth/AuthProvider';
import s from './Home.module.scss';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className={s.page}>
      <Typography.Headline variant="small" asChild>
        <h1>Умный дом</h1>
      </Typography.Headline>
      <Typography.Body variant="medium">
        Привет, {user.name}
      </Typography.Body>
      <Typography.Body variant="small">
        {user.onboarded
          ? `${user.house?.address ?? 'Дом'}, кв. ${user.apartment ?? '—'}`
          : 'Нужно пройти онбординг: указать дом и квартиру'}
      </Typography.Body>
      <Typography.Label variant="large">
        {user.roleLabel}
      </Typography.Label>
    </div>
  );
}
