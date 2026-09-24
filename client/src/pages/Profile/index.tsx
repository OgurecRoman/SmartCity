import { Typography } from '@maxhub/max-ui';
import { useAuth } from '../../auth/AuthProvider';
import s from './Profile.module.scss';

export default function Profile() {
  const { user } = useAuth();

  return (
    <div className={s.page}>
      <Typography.Headline variant="small" asChild>
        <h1>Профиль</h1>
      </Typography.Headline>
      <Typography.Body variant="medium">{user.name}</Typography.Body>
      <Typography.Body variant="small">{user.roleLabel}</Typography.Body>
      {user.onboarded && (
        <>
          <Typography.Body variant="small">{user.house?.address}</Typography.Body>
          <Typography.Body variant="small">
            кв. {user.apartment}
            {user.entrance ? ` · подъезд ${user.entrance}` : ''}
            {user.residentTypeLabel ? ` · ${user.residentTypeLabel}` : ''}
          </Typography.Body>
        </>
      )}
    </div>
  );
}
