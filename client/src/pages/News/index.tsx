import { Typography } from '@maxhub/max-ui';
import s from './News.module.scss';

export default function News() {
  return (
    <div className={s.page}>
      <Typography.Headline variant="small" asChild>
        <h1>News</h1>
      </Typography.Headline>
    </div>
  );
}
