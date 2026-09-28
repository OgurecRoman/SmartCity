import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { Button, Typography } from '@maxhub/max-ui';
import { ChevronLeft, ImagePlus, X } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { useToast } from '../../components/Toast/ToastProvider';
import { useDictionaries } from '../../hooks/useDictionaries';
import { messageForApiError } from '../../lib/apiError';
import { useInvalidateAppQueries } from '../../lib/invalidate';
import type { RequestType } from '../../types/request';
import s from './RequestCreate.module.scss';

const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export default function RequestCreate() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { data: dictionaries } = useDictionaries();
  const { invalidateRequests } = useInvalidateAppQueries();
  const fileRef = useRef<HTMLInputElement>(null);

  const categories = dictionaries?.categories ?? [];
  const priorities = useMemo(
    () => (dictionaries?.priorities ?? []).filter((p) => p.value === 'NORMAL' || p.value === 'EMERGENCY'),
    [dictionaries?.priorities],
  );

  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'EMERGENCY'>('NORMAL');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const previews = useMemo(() => photos.map((file) => URL.createObjectURL(file)), [photos]);
  useEffect(() => {
    return () => {
      for (const url of previews) URL.revokeObjectURL(url);
    };
  }, [previews]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const trimmedDescription = description.trim();
      const trimmedTitle = title.trim();

      if (photos.length > 0) {
        const fd = new FormData();
        fd.append('category', category);
        fd.append('description', trimmedDescription);
        fd.append('priority', priority);
        if (trimmedTitle) fd.append('title', trimmedTitle);
        for (const file of photos) fd.append('photos', file);
        const { data } = await api.post<RequestType>('/requests', fd, {
          headers: { 'Content-Type': undefined as unknown as string },
          timeout: 60_000,
        });
        return data;
      }

      const { data } = await api.post<RequestType>('/requests', {
        category,
        description: trimmedDescription,
        priority,
        ...(trimmedTitle ? { title: trimmedTitle } : {}),
      });
      return data;
    },
    onSuccess: async () => {
      await invalidateRequests();
      toast.success('Заявка создана');
      navigate('/requests', { replace: true });
    },
    onError: (err) => {
      setLocalError(messageForApiError(err));
      toast.error(err);
    },
  });

  const busy = createMutation.isPending;
  const canCreate = user.role !== 'UK_EMPLOYEE';

  function addPhotos(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setLocalError(null);
    const next = [...photos];
    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith('image/')) {
        setLocalError('Можно только изображения');
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setLocalError('Фото больше 8 МБ');
        continue;
      }
      if (next.length >= MAX_PHOTOS) {
        setLocalError(`Максимум ${MAX_PHOTOS} фото`);
        break;
      }
      next.push(file);
    }
    setPhotos(next);
    if (fileRef.current) fileRef.current.value = '';
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!canCreate) {
      setLocalError('Сотрудники УК не создают заявки');
      return;
    }
    if (!category) {
      setLocalError('Выберите категорию');
      return;
    }
    if (description.trim().length < 5) {
      setLocalError('Описание — минимум 5 символов');
      return;
    }
    createMutation.mutate();
  }

  const errorText = localError ?? (createMutation.error as Error | null)?.message ?? null;
  const priorityOptions =
    priorities.length > 0
      ? priorities
      : [
          { value: 'NORMAL', label: 'Обычная' },
          { value: 'EMERGENCY', label: 'Аварийная' },
        ];

  if (!canCreate) {
    return (
      <div className={s.page}>
        <header className={s.top}>
          <Typography.Headline variant="small" asChild>
            <h1>Новая заявка</h1>
          </Typography.Headline>
          <Typography.Body variant="small" className={s.hint}>
            Сотрудники УК не создают заявки жителей
          </Typography.Body>
        </header>
        <div className={s.actions}>
          <Button size="medium" variant="secondary" stretched onClick={() => navigate('/requests')}>
            К списку
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <header className={s.top}>
        <button type="button" className={s.back} onClick={() => navigate(-1)}>
          <ChevronLeft size={18} strokeWidth={2} aria-hidden />
          Назад
        </button>
        <Typography.Headline variant="small" asChild>
          <h1>Новая заявка</h1>
        </Typography.Headline>
        <Typography.Body variant="small" className={s.hint}>
          Обычную подпишут соседи. Аварийная сразу уходит в УК.
        </Typography.Body>
      </header>

      <form className={s.form} onSubmit={onSubmit}>
        <label className={s.field}>
          <span className={s.labelRow}>
            <span className={s.label}>Категория</span>
            <span className={s.required}>обязательно</span>
          </span>
          <select
            className={s.control}
            value={category}
            disabled={busy}
            required
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="" disabled>
              Выберите…
            </option>
            {categories.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className={s.field} role="group" aria-labelledby="request-priority-label">
          <span className={s.labelRow} id="request-priority-label">
            <span className={s.label}>Приоритет</span>
          </span>
          <div className={s.priorityRow} role="radiogroup" aria-label="Приоритет">
            {priorityOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={priority === item.value}
                className={priority === item.value ? `${s.priority} ${s.priorityActive}` : s.priority}
                disabled={busy}
                onClick={() => setPriority(item.value as 'NORMAL' | 'EMERGENCY')}
              >
                {item.label}
              </button>
            ))}
          </div>
          {priority === 'EMERGENCY' && (
            <p className={s.warn}>Без сбора подписей — сразу уходит в УК</p>
          )}
        </div>

        <label className={s.field}>
          <span className={s.labelRow}>
            <span className={s.label}>Заголовок</span>
            <span className={s.optional}>необязательно</span>
          </span>
          <input
            className={s.control}
            type="text"
            maxLength={120}
            placeholder="Кратко, о чём заявка"
            value={title}
            disabled={busy}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className={s.field}>
          <span className={s.labelRow}>
            <span className={s.label}>Описание</span>
            <span className={s.required}>обязательно</span>
          </span>
          <textarea
            className={`${s.control} ${s.textarea}`}
            rows={5}
            maxLength={2000}
            placeholder="Что случилось и где именно"
            value={description}
            disabled={busy}
            required
            onChange={(e) => setDescription(e.target.value)}
          />
          <span className={s.counter}>{description.trim().length} / 2000</span>
        </label>

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
          <ul className={s.photoList}>
            {photos.map((file, index) => (
              <li key={`${file.name}-${file.size}-${index}`} className={s.photoItem}>
                <img src={previews[index]} alt="" className={s.photoThumb} />
                <button
                  type="button"
                  className={s.photoRemove}
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

        {errorText && <p className={s.error}>{errorText}</p>}

        <div className={s.actions}>
          <Button type="submit" size="large" stretched loading={busy}>
            Отправить
          </Button>
          <Button
            type="button"
            size="medium"
            variant="secondary"
            stretched
            disabled={busy}
            onClick={() => navigate('/requests')}
          >
            Отмена
          </Button>
        </div>
      </form>
    </div>
  );
}
