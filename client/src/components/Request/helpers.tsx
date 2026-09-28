import { Typography } from '@maxhub/max-ui';
import { PhotoGallery } from '../PhotoLightbox';
import { formatDate } from '../../lib/formatDate';
import type { RequestType } from '../../types/request';
import s from './Request.module.scss';

export { formatDate };

export const STATUS_TONE: Record<string, string> = {
  VOTING: s.toneVoting,
  SUBMITTED: s.toneSubmitted,
  IN_PROGRESS: s.toneProgress,
  DELEGATED: s.toneDelegated,
  RESOLVED: s.toneResolved,
  REJECTED: s.toneRejected,
  EXPIRED: s.toneExpired,
};

const REOPEN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type Org = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  categories: string[];
};

export function canReopen(request: RequestType) {
  if (!request.isMine || request.status !== 'RESOLVED') return false;
  if (request.reopenedAt) return false;
  if (!request.resolvedAt) return false;
  const resolved = new Date(request.resolvedAt).getTime();
  if (Number.isNaN(resolved)) return false;
  return Date.now() - resolved <= REOPEN_WINDOW_MS;
}

export function PhotoGrid({ urls, label }: { urls: string[]; label: string }) {
  if (urls.length === 0) return null;
  return (
    <div className={s.photos}>
      <Typography.Label variant="medium" className={s.metaText}>
        {label}
      </Typography.Label>
      <PhotoGallery urls={urls} className={s.photoGrid} thumbClassName={s.photoLink} imgClassName={s.photo} />
    </div>
  );
}
