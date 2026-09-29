import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Spinner, Typography } from '@maxhub/max-ui';
import { ImagePlus, Plus, X } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { useToast } from '../../components/Toast/ToastProvider';
import { messageForApiError } from '../../lib/apiError';
import { useInvalidateAppQueries } from '../../lib/invalidate';
import { queryKeys } from '../../lib/queryKeys';
import type { AnnouncementItem, NewsItem } from '../../types/feed';
import type { House } from '../../types/house';
import type { Paginated } from '../../types/request';
import { FeedAnnouncements, FeedNews } from './FeedLists';
import s from './Feed.module.scss';

type TabId = 'announcements' | 'news';

type EditTarget =
  | { kind: 'news'; id: number }
  | { kind: 'announcements'; id: number };

type Props = {
  defaultTab?: TabId;
};

const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export default function Feed({ defaultTab = 'announcements' }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const { invalidateFeed } = useInvalidateAppQueries();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<TabId>(defaultTab);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<EditTarget | null>(null);

  const isUk = user.role === 'UK_EMPLOYEE';
  const isChairman = user.role === 'CHAIRMAN';
  const canPostNews = user.role === 'RESIDENT' || user.role === 'CHAIRMAN';
  const canPostAnnouncement = user.role === 'CHAIRMAN' || user.role === 'UK_EMPLOYEE';

  const housesQuery = useQuery({
    queryKey: queryKeys.houses,
    queryFn: async () => {
      const { data } = await api.get<House[]>('/houses');
      return data;
    },
    enabled: isUk && composerOpen && tab === 'announcements' && !editing,
  });

  const announcementsQuery = useQuery({
    queryKey: [...queryKeys.announcements, user.house?.id ?? 'all'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<AnnouncementItem>>('/announcements', {
        params: {
          limit: 30,
          offset: 0,
          ...(isUk && user.house?.id ? { houseId: user.house.id } : {}),
        },
      });
      return data;
    },
    enabled: !isUk || user.house != null,
  });

  const newsQuery = useQuery({
    queryKey: [...queryKeys.news, user.house?.id ?? 'all'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<NewsItem>>('/news', {
        params: {
          limit: 30,
          offset: 0,
          ...(isUk && user.house?.id ? { houseId: user.house.id } : {}),
        },
      });
      return data;
    },
    enabled: !isUk || user.house != null,
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');
  const [houseId, setHouseId] = useState<number | ''>('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const photoPreviews = useMemo(() => photos.map((file) => URL.createObjectURL(file)), [photos]);
  useEffect(() => {
    return () => {
      for (const url of photoPreviews) URL.revokeObjectURL(url);
    };
  }, [photoPreviews]);

  const createNews = useMutation({
    mutationFn: async () => {
      if (photos.length > 0) {
        const fd = new FormData();
        fd.append('title', title.trim());
        fd.append('description', description.trim());
        fd.append('contact', contact.trim());
        for (const file of photos) fd.append('photos', file);
        const { data } = await api.post<NewsItem>('/news', fd, {
          headers: { 'Content-Type': undefined as unknown as string },
          timeout: 60_000,
        });
        return data;
      }

      const { data } = await api.post<NewsItem>('/news', {
        title: title.trim(),
        description: description.trim(),
        contact: contact.trim(),
      });
      return data;
    },
    onSuccess: async () => {
      await invalidateFeed();
      toast.success('Новость опубликована');
      resetComposer();
    },
    onError: (err) => {
      setFormError(messageForApiError(err));
      toast.error(err);
    },
  });

  const createAnnouncement = useMutation({
    mutationFn: async () => {
      if (isUk && !houseId) throw new Error('Выберите дом');

      if (photos.length > 0) {
        const fd = new FormData();
        fd.append('title', title.trim());
        fd.append('description', description.trim());
        if (isUk && houseId) fd.append('houseId', String(houseId));
        for (const file of photos) fd.append('photos', file);
        const { data } = await api.post<AnnouncementItem>('/announcements', fd, {
          headers: { 'Content-Type': undefined as unknown as string },
          timeout: 60_000,
        });
        return data;
      }

      const payload: { title: string; description: string; houseId?: number } = {
        title: title.trim(),
        description: description.trim(),
      };
      if (isUk && houseId) payload.houseId = Number(houseId);
      const { data } = await api.post<AnnouncementItem>('/announcements', payload);
      return data;
    },
    onSuccess: async () => {
      await invalidateFeed();
      toast.success('Объявление опубликовано');
      resetComposer();
    },
    onError: (err) => {
      setFormError(messageForApiError(err));
      toast.error(err);
    },
  });

  const updateNews = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.patch<NewsItem>(`/news/${id}`, {
        title: title.trim(),
        description: description.trim(),
        contact: contact.trim(),
      });
      return data;
    },
    onSuccess: async () => {
      await invalidateFeed();
      toast.success('Новость обновлена');
      resetComposer();
    },
    onError: (err) => {
      setFormError(messageForApiError(err));
      toast.error(err);
    },
  });

  const updateAnnouncement = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.patch<AnnouncementItem>(`/announcements/${id}`, {
        title: title.trim(),
        description: description.trim(),
      });
      return data;
    },
    onSuccess: async () => {
      await invalidateFeed();
      toast.success('Объявление обновлено');
      resetComposer();
    },
    onError: (err) => {
      setFormError(messageForApiError(err));
      toast.error(err);
    },
  });

  const deleteNews = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/news/${id}`);
    },
    onSuccess: async () => {
      await invalidateFeed();
      toast.success('Новость удалена');
    },
    onError: (err) => toast.error(err),
  });

  const deleteAnnouncement = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/announcements/${id}`);
    },
    onSuccess: async () => {
      await invalidateFeed();
      toast.success('Объявление удалено');
    },
    onError: (err) => toast.error(err),
  });

  const busy =
    createNews.isPending ||
    createAnnouncement.isPending ||
    updateNews.isPending ||
    updateAnnouncement.isPending;
  const deleteBusy = deleteNews.isPending || deleteAnnouncement.isPending;
  const activeQuery = tab === 'announcements' ? announcementsQuery : newsQuery;
  const canComposeHere =
    (tab === 'news' && canPostNews) || (tab === 'announcements' && canPostAnnouncement);

  const houses = housesQuery.data ?? [];
  const houseOptions = useMemo(() => {
    if (houses.length > 0) return houses.map((h) => ({ id: h.id, address: h.address }));
    if (user.house) return [{ id: user.house.id, address: user.house.address }];
    return [] as { id: number; address: string }[];
  }, [houses, user.house]);

  function resetComposer() {
    setComposerOpen(false);
    setEditing(null);
    setTitle('');
    setDescription('');
    setContact('');
    setHouseId('');
    setPhotos([]);
    setFormError(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function openComposer() {
    setEditing(null);
    setFormError(null);
    setTitle('');
    setDescription('');
    setContact('');
    setPhotos([]);
    if (fileRef.current) fileRef.current.value = '';
    if (isUk && user.house) setHouseId(user.house.id);
    else if (isUk && houseOptions[0]) setHouseId(houseOptions[0].id);
    else if (user.house) setHouseId(user.house.id);
    setComposerOpen(true);
  }

  function addPhotos(list: FileList | null) {
    if (!list?.length) return;
    setFormError(null);
    const incoming = Array.from(list);
    const next = [...photos];
    for (const file of incoming) {
      if (next.length >= MAX_PHOTOS) break;
      if (!file.type.startsWith('image/')) {
        setFormError('Можно только изображения');
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setFormError('Фото больше 8 МБ');
        continue;
      }
      next.push(file);
    }
    setPhotos(next);
    if (fileRef.current) fileRef.current.value = '';
  }

  function onPlusClick() {
    if (composerOpen) {
      resetComposer();
      return;
    }
    openComposer();
  }

  function startEditNews(item: NewsItem) {
    setTab('news');
    setEditing({ kind: 'news', id: item.id });
    setTitle(item.title);
    setDescription(item.description);
    setContact(item.contact);
    setHouseId(item.houseId);
    setPhotos([]);
    setFormError(null);
    setComposerOpen(true);
  }

  function startEditAnnouncement(item: AnnouncementItem) {
    setTab('announcements');
    setEditing({ kind: 'announcements', id: item.id });
    setTitle(item.title);
    setDescription(item.description);
    setContact('');
    setHouseId(item.houseId);
    setPhotos([]);
    setFormError(null);
    setComposerOpen(true);
  }

  function canManageNews(item: NewsItem) {
    return Boolean(item.isMine) || isUk || item.author.id === user.id;
  }

  function canManageAnnouncement(item: AnnouncementItem) {
    if (isUk) return true;
    if (isChairman && user.house?.id === item.houseId) return true;
    return false;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (title.trim().length < 3) {
      setFormError('Заголовок — минимум 3 символа');
      return;
    }
    if (description.trim().length < 5) {
      setFormError('Текст — минимум 5 символов');
      return;
    }
    if (editing?.kind === 'news' || (!editing && tab === 'news')) {
      if (contact.trim().length < 3) {
        setFormError('Укажите контакт');
        return;
      }
      if (editing?.kind === 'news') {
        updateNews.mutate(editing.id);
        return;
      }
      createNews.mutate();
      return;
    }
    if (editing?.kind === 'announcements') {
      updateAnnouncement.mutate(editing.id);
      return;
    }
    createAnnouncement.mutate();
  }

  const errorText = formError;

  return (
    <div className={s.page}>
      <div className={s.header}>
        <Typography.Headline variant="small" asChild>
          <h1 className={s.title}>Лента</h1>
        </Typography.Headline>
        {canComposeHere || (composerOpen && editing) ? (
          <button
            type="button"
            className={s.createIcon}
            aria-label={
              composerOpen
                ? 'Закрыть форму'
                : tab === 'news'
                  ? 'Написать новость'
                  : 'Новое объявление'
            }
            onClick={onPlusClick}
          >
            {composerOpen ? <X size={20} strokeWidth={2.25} aria-hidden /> : <Plus size={20} strokeWidth={2.25} aria-hidden />}
          </button>
        ) : (
          <span className={s.createIconSpacer} aria-hidden />
        )}
      </div>

      <div className={s.tabs} role="tablist" aria-label="Разделы ленты">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'announcements'}
          className={tab === 'announcements' ? `${s.tab} ${s.tabActive}` : s.tab}
          onClick={() => {
            setTab('announcements');
            resetComposer();
          }}
        >
          Объявления
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'news'}
          className={tab === 'news' ? `${s.tab} ${s.tabActive}` : s.tab}
          onClick={() => {
            setTab('news');
            resetComposer();
          }}
        >
          Новости
        </button>
      </div>

      {composerOpen && (canComposeHere || editing) && (
        <form className={s.composer} onSubmit={onSubmit}>
          <Typography.Title variant="small" asChild>
            <h2>
              {editing
                ? editing.kind === 'news'
                  ? 'Редактировать новость'
                  : 'Редактировать объявление'
                : tab === 'news'
                  ? 'Новость соседям'
                  : 'Объявление'}
            </h2>
          </Typography.Title>

          {tab === 'announcements' && isUk && !editing && (
            <label className={s.field}>
              <span className={s.label}>Дом</span>
              <select
                className={s.control}
                value={houseId}
                disabled={busy || housesQuery.isLoading}
                required
                onChange={(e) => setHouseId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="" disabled>
                  Выберите дом…
                </option>
                {houseOptions.map((house) => (
                  <option key={house.id} value={house.id}>
                    {house.address}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className={s.field}>
            <span className={s.label}>Заголовок</span>
            <input
              className={s.control}
              value={title}
              maxLength={120}
              disabled={busy}
              required
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label className={s.field}>
            <span className={s.label}>Текст</span>
            <textarea
              className={`${s.control} ${s.textarea}`}
              value={description}
              maxLength={2000}
              rows={4}
              disabled={busy}
              required
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          {(tab === 'news' || editing?.kind === 'news') && (
            <label className={s.field}>
              <span className={s.label}>Контакт</span>
              <input
                className={s.control}
                value={contact}
                maxLength={200}
                placeholder="Телефон, кв. или @username"
                disabled={busy}
                required
                onChange={(e) => setContact(e.target.value)}
              />
            </label>
          )}

          {!editing && (
            <div className={s.field}>
              <span className={s.labelRow}>
                <span className={s.label}>Фото</span>
                <span className={s.optional}>до {MAX_PHOTOS}</span>
              </span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className={s.fileInput}
                disabled={busy || photos.length >= MAX_PHOTOS}
                onChange={(e) => addPhotos(e.target.files)}
              />
              <ul className={s.photoPickList}>
                {photos.map((file, index) => (
                  <li key={`${file.name}-${file.size}-${index}`} className={s.photoPickItem}>
                    <img src={photoPreviews[index]} alt="" className={s.photoPickThumb} />
                    <button
                      type="button"
                      className={s.photoPickRemove}
                      aria-label="Убрать фото"
                      disabled={busy}
                      onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <X size={14} strokeWidth={2} aria-hidden />
                    </button>
                  </li>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <li>
                    <button
                      type="button"
                      className={s.addPhoto}
                      disabled={busy}
                      onClick={() => fileRef.current?.click()}
                    >
                      <ImagePlus size={22} strokeWidth={1.75} aria-hidden />
                      <span>Добавить</span>
                    </button>
                  </li>
                )}
              </ul>
            </div>
          )}

          {errorText && <p className={s.error}>{errorText}</p>}

          <div className={s.composerActions}>
            <Button type="submit" size="medium" stretched loading={busy}>
              {editing ? 'Сохранить' : 'Опубликовать'}
            </Button>
            <Button type="button" size="medium" variant="secondary" stretched disabled={busy} onClick={resetComposer}>
              Отмена
            </Button>
          </div>
        </form>
      )}

      {activeQuery.isLoading ? (
        <div className={s.state}>
          <Spinner size={40} appearance="themed" />
        </div>
      ) : activeQuery.isError ? (
        <div className={s.state}>
          <Typography.Body variant="medium">{(activeQuery.error as Error).message}</Typography.Body>
          <Button size="small" onClick={() => void activeQuery.refetch()}>
            Повторить
          </Button>
        </div>
      ) : tab === 'announcements' ? (
        <FeedAnnouncements
          items={announcementsQuery.data?.items ?? []}
          canManage={canManageAnnouncement}
          busy={deleteBusy}
          onEdit={startEditAnnouncement}
          onDelete={(id) => deleteAnnouncement.mutate(id)}
        />
      ) : (
        <FeedNews
          items={newsQuery.data?.items ?? []}
          canManage={canManageNews}
          busy={deleteBusy}
          onEdit={startEditNews}
          onDelete={(id) => deleteNews.mutate(id)}
        />
      )}
    </div>
  );
}

