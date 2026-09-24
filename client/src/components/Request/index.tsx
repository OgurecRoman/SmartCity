import { Button, EllipsisText, Flex, Typography } from '@maxhub/max-ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { RequestType } from '../../types/request';
import s from './Request.module.scss';

const STATUS_TONE: Record<string, string> = {
  VOTING: s.toneVoting,
  SUBMITTED: s.toneSubmitted,
  IN_PROGRESS: s.toneProgress,
  DELEGATED: s.toneDelegated,
  RESOLVED: s.toneResolved,
  REJECTED: s.toneRejected,
  EXPIRED: s.toneExpired,
};

function formatDeadline(deadline: string | null) {
  if (!deadline) return null;
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export default function Request({ request }: { request: RequestType }) {
  const queryClient = useQueryClient();
  const tone = STATUS_TONE[request.status] ?? s.toneSubmitted;
  const deadline = formatDeadline(request.deadline);
  const showVotes = request.status === 'VOTING';
  const votePercent =
    request.votesRequired > 0
      ? Math.min(100, Math.round((request.votesCount / request.votesRequired) * 100))
      : 0;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['requests'] });

  const voteMutation = useMutation({
    mutationFn: () => api.post(`/requests/${request.id}/vote`),
    onSuccess: invalidate,
  });

  const unvoteMutation = useMutation({
    mutationFn: () => api.delete(`/requests/${request.id}/vote`),
    onSuccess: invalidate,
  });

  const busy = voteMutation.isPending || unvoteMutation.isPending;

  return (
    <article className={s.card}>
      <Flex direction="column" gap={10} className={s.inner}>
        <Flex direction="row" justify="space-between" align="center" gap={8} className={s.top}>
          <span className={`${s.badge} ${tone}`}>{request.statusLabel}</span>
          {request.priority === 'EMERGENCY' && (
            <span className={`${s.badge} ${s.toneEmergency}`}>{request.priorityLabel}</span>
          )}
        </Flex>

        <Typography.Body variant="medium-strong" asChild className={s.title}>
          <EllipsisText maxLines={2}>{request.title}</EllipsisText>
        </Typography.Body>

        <Typography.Body variant="small" asChild className={s.description}>
          <EllipsisText maxLines={2}>{request.description}</EllipsisText>
        </Typography.Body>

        <Flex direction="row" align="center" gap={8} className={s.meta}>
          <span className={s.chip}>{request.categoryLabel}</span>
          {request.author?.apartment && (
            <Typography.Label variant="medium" className={s.metaText}>
              кв. {request.author.apartment}
            </Typography.Label>
          )}
          {deadline && showVotes && (
            <Typography.Label variant="medium" className={s.metaText}>
              до {deadline}
            </Typography.Label>
          )}
          {request.isMine && (
            <Typography.Label variant="medium-strong" className={s.mine}>
              моя
            </Typography.Label>
          )}
        </Flex>

        {showVotes && (
          <div className={s.votes}>
            <Flex direction="row" justify="space-between" align="center" gap={8}>
              <Typography.Label variant="medium">Подписи</Typography.Label>
              <Typography.Label variant="medium-strong">
                {request.votesCount} / {request.votesRequired}
              </Typography.Label>
            </Flex>
            <div className={s.votesTrack} aria-hidden>
              <div className={s.votesFill} style={{ width: `${votePercent}%` }} />
            </div>

            {request.canVote && (
              <Button
                size="small"
                variant="primary"
                stretched
                loading={busy}
                onClick={() => voteMutation.mutate()}
              >
                Поддержать
              </Button>
            )}
            {request.hasVoted && !request.isMine && (
              <Button
                size="small"
                variant="secondary"
                stretched
                loading={busy}
                onClick={() => unvoteMutation.mutate()}
              >
                Отозвать подпись
              </Button>
            )}
            {request.isMine && (
              <Typography.Label variant="medium" className={s.metaText}>
                Автор не голосует за свою заявку — ждут соседей
              </Typography.Label>
            )}
          </div>
        )}
      </Flex>
    </article>
  );
}
