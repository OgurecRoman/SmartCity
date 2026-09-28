import { Typography } from '@maxhub/max-ui';
import s from './Stub.module.scss';

export default function Stub({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className={s.page}>
      <Typography.Headline variant="small" asChild>
        <h1>{title}</h1>
      </Typography.Headline>
      <Typography.Body variant="medium" className={s.hint}>
        {hint ?? 'Раздел в разработке'}
      </Typography.Body>
    </div>
  );
}
