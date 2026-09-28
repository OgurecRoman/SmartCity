import { Button, Flex, Spinner, Typography } from '@maxhub/max-ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useDictionaries } from '../../hooks/useDictionaries';
import { useInvalidateAppQueries } from '../../lib/invalidate';
import { queryKeys } from '../../lib/queryKeys';
import type { RequestDetailed, RequestType } from '../../types/request';
import { PhotoGrid, STATUS_TONE, canReopen, formatDate, type Org } from './helpers';
import { getPortalRoot } from '../../lib/portalRoot';
import s from './Request.module.scss';

type Props = {
  request: RequestType;
  onClose: () => void;
  voteActions: ReactNode;
};

export function RequestDetail({ request, onClose, voteActions }: Props) {
  useBodyScrollLock(true);
  const { user } = useAuth();
  const { data: dictionaries } = useDictionaries();
  const { invalidateRequests } = useInvalidateAppQueries();
  const [rating, setRating] = useState(request.rating ?? 0);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenPhotos, setReopenPhotos] = useState<File[]>([]);
  const [statusTarget, setStatusTarget] = useState('');
  const [statusComment, setStatusComment] = useState('');
  const [organizationId, setOrganizationId] = useState<number | ''>('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolvedByName, setResolvedByName] = useState('');
  const [resultPhotos, setResultPhotos] = useState<File[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const reopenFileRef = useRef<HTMLInputElement>(null);
  const resultFileRef = useRef<HTMLInputElement>(null);

  const isUk = user.role === 'UK_EMPLOYEE';
  const detailQuery = useQuery({
    queryKey: queryKeys.request(request.id),
    queryFn: async () => {
      const { data } = await api.get<RequestDetailed>(`/requests/${request.id}`);
      return data;
    },
  });

  const orgsQuery = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const { data } = await api.get<Org[]>('/organizations');
      return data;
    },
    enabled: isUk,
    staleTime: 60_000,
  });

  const detail = detailQuery.data;
  const view = detail ?? request;
  const tone = STATUS_TONE[view.status] ?? s.toneSubmitted;
  const showVotes = view.status === 'VOTING';
  const votePercent =
    view.votesRequired > 0 ? Math.min(100, Math.round((view.votesCount / view.votesRequired) * 100)) : 0;
  const deadline = formatDate(view.deadline);
  const createdAt = formatDate(view.createdAt);
  const photoUrls = view.photoUrls ?? [];
  const resultPhotoUrls = view.resultPhotoUrls ?? [];
  const transitions = dictionaries?.transitions?.[view.status] ?? [];

  useEffect(() => {
    setRating(view.rating ?? 0);
  }, [view.rating]);

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/requests/${request.id}`),
    onSuccess: async () => {
      onClose();
      await invalidateRequests();
    },
  });

  const rateMutation = useMutation({
    mutationFn: (value: number) => api.post(`/requests/${request.id}/rate`, { rating: value }),
    onSuccess: async () => {
      await invalidateRequests();
      await detailQuery.refetch();
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('reason', reopenReason.trim());
      for (const file of reopenPhotos) fd.append('photos', file);
      const { data } = await api.post(`/requests/${request.id}/reopen`, fd, {
        headers: { 'Content-Type': undefined as unknown as string },
        timeout: 60_000,
      });
      return data;
    },
    onSuccess: async () => {
      setReopenOpen(false);
      setReopenReason('');
      setReopenPhotos([]);
      await invalidateRequests();
      await detailQuery.refetch();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async () => {
      if (statusTarget === 'RESOLVED' && resultPhotos.length > 0) {
        const fd = new FormData();
        fd.append('status', statusTarget);
        if (statusComment.trim()) fd.append('comment', statusComment.trim());
        fd.append('resolutionNote', resolutionNote.trim());
        fd.append('resolvedByName', resolvedByName.trim());
        for (const file of resultPhotos) fd.append('photos', file);
        const { data } = await api.patch(`/requests/${request.id}/status`, fd, {
          headers: { 'Content-Type': undefined as unknown as string },
          timeout: 60_000,
        });
        return data;
      }
      const body: Record<string, unknown> = { status: statusTarget };
      if (statusComment.trim()) body.comment = statusComment.trim();
      if (statusTarget === 'DELEGATED') body.organizationId = Number(organizationId);
      if (statusTarget === 'RESOLVED') {
        body.resolutionNote = resolutionNote.trim();
        body.resolvedByName = resolvedByName.trim();
      }
      const { data } = await api.patch(`/requests/${request.id}/status`, body);
      return data;
    },
    onSuccess: async () => {
      setStatusTarget('');
      setStatusComment('');
      setOrganizationId('');
      setResolutionNote('');
      setResolvedByName('');
      setResultPhotos([]);
      setLocalError(null);
      await invalidateRequests();
      await detailQuery.refetch();
    },
    onError: (err) => setLocalError((err as Error).message),
  });

  const busy =
    deleteMutation.isPending ||
    rateMutation.isPending ||
    reopenMutation.isPending ||
    statusMutation.isPending;

  const reopenPreviews = useMemo(
    () => reopenPhotos.map((file) => URL.createObjectURL(file)),
    [reopenPhotos],
  );
  useEffect(() => () => reopenPreviews.forEach((url) => URL.revokeObjectURL(url)), [reopenPreviews]);

  const errorText =
    localError ??
    (deleteMutation.error as Error | null)?.message ??
    (rateMutation.error as Error | null)?.message ??
    (reopenMutation.error as Error | null)?.message ??
    (statusMutation.error as Error | null)?.message ??
    null;

  function submitStatus(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!statusTarget) {
      setLocalError('Выберите статус');
      return;
    }
    if (statusTarget === 'DELEGATED' && !organizationId) {
      setLocalError('Выберите организацию');
      return;
    }
    if (statusTarget === 'RESOLVED') {
      if (resolutionNote.trim().length < 3) {
        setLocalError('Укажите, что сделано');
        return;
      }
      if (resolvedByName.trim().length < 2) {
        setLocalError('Укажите ответственного');
        return;
      }
    }
    statusMutation.mutate();
  }

  function submitReopen(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (reopenReason.trim().length < 5) {
      setLocalError('Опишите проблему (от 5 символов)');
      return;
    }
    if (reopenPhotos.length === 0) {
      setLocalError('Приложите хотя бы одно фото');
      return;
    }
    reopenMutation.mutate();
  }

  return createPortal(
    <div className={s.modal} onClick={onClose} role="presentation">
      <div
        className={s.modalContent}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`request-title-${request.id}`}
      >
        <header className={s.modalHeader}>
          <Flex direction="row" align="center" gap={8} className={s.meta}>
            <span className={`${s.badge} ${tone}`}>{view.statusLabel}</span>
            {view.priority === 'EMERGENCY' && (
              <span className={`${s.badge} ${s.toneEmergency}`}>{view.priorityLabel}</span>
            )}
            <span className={s.chip}>{view.categoryLabel}</span>
          </Flex>
          <button type="button" className={s.closeButton} onClick={onClose} aria-label="Закрыть">
            <X size={20} color="currentColor" />
          </button>
        </header>

        <div className={s.modalBody}>
          {detailQuery.isLoading && !detail ? (
            <div className={s.detailLoading}>
              <Spinner size={32} appearance="themed" />
            </div>
          ) : (
            <>
              <Typography.Headline variant="small" asChild className={s.modalTitle}>
                <h2 id={`request-title-${request.id}`}>{view.title}</h2>
              </Typography.Headline>

              <Typography.Body variant="medium" asChild className={s.modalDescription}>
                <p>{view.description}</p>
              </Typography.Body>

              <PhotoGrid urls={photoUrls} label="Фото" />
              <PhotoGrid urls={resultPhotoUrls} label="Фото результата" />

              <dl className={s.details}>
                {view.author && (
                  <div className={s.detailRow}>
                    <dt>Автор</dt>
                    <dd>
                      {view.author.name}
                      {view.author.apartment ? `, кв. ${view.author.apartment}` : ''}
                    </dd>
                  </div>
                )}
                {deadline && showVotes && (
                  <div className={s.detailRow}>
                    <dt>Срок сбора</dt>
                    <dd>до {deadline}</dd>
                  </div>
                )}
                {createdAt && (
                  <div className={s.detailRow}>
                    <dt>Создана</dt>
                    <dd>{createdAt}</dd>
                  </div>
                )}
                {view.delegatedTo && (
                  <div className={s.detailRow}>
                    <dt>Служба</dt>
                    <dd>{view.delegatedTo.name}</dd>
                  </div>
                )}
                {view.resolutionNote && (
                  <div className={s.detailRow}>
                    <dt>Сделано</dt>
                    <dd>{view.resolutionNote}</dd>
                  </div>
                )}
                {view.resolvedByName && (
                  <div className={s.detailRow}>
                    <dt>Ответственный</dt>
                    <dd>{view.resolvedByName}</dd>
                  </div>
                )}
                {view.rating != null && (
                  <div className={s.detailRow}>
                    <dt>Оценка</dt>
                    <dd>{view.rating} / 5</dd>
                  </div>
                )}
              </dl>

              {detail?.votes && detail.votes.length > 0 && (
                <div className={s.block}>
                  <Typography.Label variant="medium-strong">Кто подписал</Typography.Label>
                  <ul className={s.simpleList}>
                    {detail.votes.map((vote) => (
                      <li key={vote.id}>
                        {vote.user.name}
                        {vote.user.apartment ? `, кв. ${vote.user.apartment}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {detail?.statusHistory &&
                detail.statusHistory.some((entry) => entry.oldStatus != null) && (
                  <div className={s.block}>
                    <Typography.Label variant="medium-strong">История</Typography.Label>
                    <ul className={s.timeline}>
                      {detail.statusHistory.map((entry) => {
                        const title =
                          entry.oldStatusLabel != null
                            ? `${entry.oldStatusLabel} → ${entry.newStatusLabel}`
                            : `Создана · ${entry.newStatusLabel}`;
                        return (
                          <li key={entry.id} className={s.timelineItem}>
                            <span className={s.timelineTitle}>{title}</span>
                            <span className={s.timelineMeta}>
                              {formatDate(entry.changedAt)}
                              {entry.changedBy ? ` · ${entry.changedBy.name}` : ''}
                            </span>
                            {entry.comment ? <span className={s.timelineComment}>{entry.comment}</span> : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

              {view.isMine && view.status === 'RESOLVED' && (
                <div className={s.block}>
                  <Typography.Label variant="medium-strong">Оценка</Typography.Label>
                  <div className={s.ratingRow}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={value <= rating ? `${s.star} ${s.starOn}` : s.star}
                        disabled={busy}
                        aria-label={`${value} из 5`}
                        onClick={() => {
                          setRating(value);
                          rateMutation.mutate(value);
                        }}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {canReopen(view) && !reopenOpen && (
                <Button size="small" variant="secondary" stretched onClick={() => setReopenOpen(true)}>
                  Не сделано — вернуть в УК
                </Button>
              )}

              {reopenOpen && (
                <form className={s.formBlock} onSubmit={submitReopen}>
                  <label className={s.field}>
                    <span className={s.fieldLabel}>Что не так</span>
                    <textarea
                      className={s.textarea}
                      rows={3}
                      value={reopenReason}
                      disabled={busy}
                      onChange={(e) => setReopenReason(e.target.value)}
                    />
                  </label>
                  <input
                    ref={reopenFileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className={s.fileInput}
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
                      setReopenPhotos((prev) => [...prev, ...files].slice(0, 5));
                      e.target.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    size="small"
                    variant="secondary"
                    stretched
                    onClick={() => reopenFileRef.current?.click()}
                  >
                    Добавить фото
                  </Button>
                  {reopenPhotos.length > 0 && (
                    <div className={s.photoGrid}>
                      {reopenPhotos.map((file, index) => (
                        <div key={`${file.name}-${index}`} className={s.photoLink}>
                          <img src={reopenPreviews[index]} alt="" className={s.photo} />
                        </div>
                      ))}
                    </div>
                  )}
                  <Button type="submit" size="small" stretched loading={busy}>
                    Отправить
                  </Button>
                </form>
              )}

              {isUk && transitions.length > 0 && (
                <form className={s.formBlock} onSubmit={submitStatus}>
                  <Typography.Label variant="medium-strong">Сменить статус</Typography.Label>
                  <select
                    className={s.select}
                    value={statusTarget}
                    disabled={busy}
                    onChange={(e) => setStatusTarget(e.target.value)}
                  >
                    <option value="">Выберите…</option>
                    {transitions.map((status) => (
                      <option key={status} value={status}>
                        {dictionaries?.statuses.find((item) => item.value === status)?.label ?? status}
                      </option>
                    ))}
                  </select>

                  {statusTarget === 'DELEGATED' && (
                    <select
                      className={s.select}
                      value={organizationId}
                      disabled={busy || orgsQuery.isLoading}
                      onChange={(e) => setOrganizationId(e.target.value ? Number(e.target.value) : '')}
                    >
                      <option value="">Организация…</option>
                      {(orgsQuery.data ?? []).map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {statusTarget === 'RESOLVED' && (
                    <>
                      <textarea
                        className={s.textarea}
                        rows={3}
                        placeholder="Что сделано"
                        value={resolutionNote}
                        disabled={busy}
                        onChange={(e) => setResolutionNote(e.target.value)}
                      />
                      <input
                        className={s.select}
                        placeholder="Ответственный"
                        value={resolvedByName}
                        disabled={busy}
                        onChange={(e) => setResolvedByName(e.target.value)}
                      />
                      <input
                        ref={resultFileRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className={s.fileInput}
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
                          setResultPhotos((prev) => [...prev, ...files].slice(0, 5));
                          e.target.value = '';
                        }}
                      />
                      <Button
                        type="button"
                        size="small"
                        variant="secondary"
                        stretched
                        onClick={() => resultFileRef.current?.click()}
                      >
                        Фото результата
                      </Button>
                    </>
                  )}

                  <input
                    className={s.select}
                    placeholder="Комментарий (необязательно)"
                    value={statusComment}
                    disabled={busy}
                    onChange={(e) => setStatusComment(e.target.value)}
                  />

                  <Button type="submit" size="small" stretched loading={busy} disabled={!statusTarget}>
                    Применить
                  </Button>
                </form>
              )}

              {errorText && <p className={s.error}>{errorText}</p>}
            </>
          )}
        </div>

        <footer className={s.modalFooter}>
          {showVotes && (
            <div className={s.votes}>
              <Flex direction="row" justify="space-between" align="center" gap={8}>
                <Typography.Label variant="medium">Подписи</Typography.Label>
                <Typography.Label variant="medium-strong">
                  {view.votesCount} / {view.votesRequired}
                </Typography.Label>
              </Flex>
              <div className={s.votesTrack} aria-hidden>
                <div className={s.votesFill} style={{ width: `${votePercent}%` }} />
              </div>
              {view.isMine && (
                <Typography.Label variant="medium" className={s.metaText}>
                  Автор не голосует за свою заявку — ждут соседей
                </Typography.Label>
              )}
              {voteActions}
            </div>
          )}

          {view.isMine && view.status === 'VOTING' && (
            <Button
              size="small"
              variant="secondary"
              stretched
              loading={busy}
              onClick={() => {
                if (window.confirm('Удалить заявку?')) deleteMutation.mutate();
              }}
            >
              Удалить заявку
            </Button>
          )}
        </footer>
      </div>
    </div>,
    getPortalRoot(),
  );
}
