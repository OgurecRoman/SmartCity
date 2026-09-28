import { useState } from 'react';
import { Button, Typography } from '@maxhub/max-ui';
import { PhotoGallery } from '../../components/PhotoLightbox';
import { formatDate } from '../../lib/formatDate';
import type { AnnouncementItem, NewsItem } from '../../types/feed';
import s from './Feed.module.scss';

export function FeedAnnouncements({
  items,
  canManage,
  busy,
  onEdit,
  onDelete,
}: {
  items: AnnouncementItem[];
  canManage: (item: AnnouncementItem) => boolean;
  busy: boolean;
  onEdit: (item: AnnouncementItem) => void;
  onDelete: (id: number) => void;
}) {
  const [confirmId, setConfirmId] = useState<number | null>(null);

  if (items.length === 0) {
    return (
      <div className={s.empty}>
        <Typography.Body variant="medium">Пока нет объявлений</Typography.Body>
        <Typography.Body variant="small" className={s.emptyHint}>
          Здесь появятся сообщения УК и председателя
        </Typography.Body>
      </div>
    );
  }

  return (
    <ul className={s.list}>
      {items.map((item) => (
        <li key={item.id} className={s.card}>
          <div className={s.cardTop}>
            <span className={s.badge}>Объявление</span>
            <time className={s.meta} dateTime={item.createdAt}>
              {formatDate(item.createdAt)}
            </time>
          </div>
          <Typography.Body variant="medium-strong" className={s.cardTitle}>
            {item.title}
          </Typography.Body>
          <Typography.Body variant="small" className={s.cardText}>
            {item.description}
          </Typography.Body>
          <PhotoGallery
            urls={item.photoUrls ?? []}
            className={s.photos}
            thumbClassName={s.photoLink}
            imgClassName={s.photo}
          />
          <p className={s.meta}>
            {item.author.name}
            {item.houseAddress ? ` · ${item.houseAddress}` : ''}
          </p>
          {canManage(item) && (
            <div className={s.cardActions}>
              {confirmId === item.id ? (
                <>
                  <Button size="small" stretched loading={busy} onClick={() => onDelete(item.id)}>
                    Удалить
                  </Button>
                  <Button
                    size="small"
                    variant="secondary"
                    stretched
                    disabled={busy}
                    onClick={() => setConfirmId(null)}
                  >
                    Отмена
                  </Button>
                </>
              ) : (
                <>
                  <Button size="small" variant="secondary" stretched disabled={busy} onClick={() => onEdit(item)}>
                    Изменить
                  </Button>
                  <Button
                    size="small"
                    variant="secondary"
                    stretched
                    disabled={busy}
                    onClick={() => setConfirmId(item.id)}
                  >
                    Удалить
                  </Button>
                </>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function FeedNews({
  items,
  canManage,
  busy,
  onEdit,
  onDelete,
}: {
  items: NewsItem[];
  canManage: (item: NewsItem) => boolean;
  busy: boolean;
  onEdit: (item: NewsItem) => void;
  onDelete: (id: number) => void;
}) {
  const [confirmId, setConfirmId] = useState<number | null>(null);

  if (items.length === 0) {
    return (
      <div className={s.empty}>
        <Typography.Body variant="medium">Пока нет новостей</Typography.Body>
        <Typography.Body variant="small" className={s.emptyHint}>
          Напишите соседям — чай, субботник, объявление о пропаже
        </Typography.Body>
      </div>
    );
  }

  return (
    <ul className={s.list}>
      {items.map((item) => (
        <li key={item.id} className={s.card}>
          <div className={s.cardTop}>
            <span className={`${s.badge} ${s.badgeNews}`}>Новость</span>
            <time className={s.meta} dateTime={item.createdAt}>
              {formatDate(item.createdAt)}
            </time>
          </div>
          <Typography.Body variant="medium-strong" className={s.cardTitle}>
            {item.title}
          </Typography.Body>
          <Typography.Body variant="small" className={s.cardText}>
            {item.description}
          </Typography.Body>
          <p className={s.contact}>Связаться: {item.contact}</p>
          <PhotoGallery
            urls={item.photoUrls ?? []}
            className={s.photos}
            thumbClassName={s.photoLink}
            imgClassName={s.photo}
          />
          <p className={s.meta}>
            {item.author.name}
            {item.isMine ? ' · ваша' : ''}
          </p>
          {canManage(item) && (
            <div className={s.cardActions}>
              {confirmId === item.id ? (
                <>
                  <Button size="small" stretched loading={busy} onClick={() => onDelete(item.id)}>
                    Удалить
                  </Button>
                  <Button
                    size="small"
                    variant="secondary"
                    stretched
                    disabled={busy}
                    onClick={() => setConfirmId(null)}
                  >
                    Отмена
                  </Button>
                </>
              ) : (
                <>
                  <Button size="small" variant="secondary" stretched disabled={busy} onClick={() => onEdit(item)}>
                    Изменить
                  </Button>
                  <Button
                    size="small"
                    variant="secondary"
                    stretched
                    disabled={busy}
                    onClick={() => setConfirmId(item.id)}
                  >
                    Удалить
                  </Button>
                </>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
