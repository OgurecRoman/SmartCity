import { Button, EllipsisText, Flex, Typography } from '@maxhub/max-ui';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { useInvalidateAppQueries } from '../../lib/invalidate';
import type { RequestType } from '../../types/request';
import { STATUS_TONE } from './helpers';
import { RequestDetail } from './RequestDetail';
import s from './Request.module.scss';

export default function Request({ request }: { request: RequestType }) {
  const { user } = useAuth();
  const { invalidateRequests } = useInvalidateAppQueries();
  const [modal, setModal] = useState(false);

  const isUk = user.role === 'UK_EMPLOYEE';
  const tone = STATUS_TONE[request.status] ?? s.toneSubmitted;
  const showVotes = request.status === 'VOTING';
  const votePercent =
    request.votesRequired > 0
      ? Math.min(100, Math.round((request.votesCount / request.votesRequired) * 100))
      : 0;

  const voteMutation = useMutation({
    mutationFn: () => api.post(`/requests/${request.id}/vote`),
    onSuccess: () => invalidateRequests(),
  });

  const unvoteMutation = useMutation({
    mutationFn: () => api.delete(`/requests/${request.id}/vote`),
    onSuccess: () => invalidateRequests(),
  });

  const busy = voteMutation.isPending || unvoteMutation.isPending;

  const voteActions = !isUk ? (
    <>
      {request.canVote && (
        <Button size="small" variant="primary" stretched loading={busy} onClick={() => voteMutation.mutate()}>
          Поддержать
        </Button>
      )}
      {request.hasVoted && !request.isMine && (
        <Button size="small" variant="secondary" stretched loading={busy} onClick={() => unvoteMutation.mutate()}>
          Отозвать подпись
        </Button>
      )}
    </>
  ) : null;

  return (
    <>
      <article className={s.card}>
        <Flex direction="column" gap={10} className={s.inner}>
          <Flex direction="row" justify="space-between" align="center" gap={8} className={s.top}>
            <span className={`${s.badge} ${tone}`}>{request.statusLabel}</span>
            <Flex direction="row" align="center" gap={8}>
              {request.priority === 'EMERGENCY' && (
                <span className={`${s.badge} ${s.toneEmergency}`}>{request.priorityLabel}</span>
              )}
              {request.isMine && (
                <Typography.Label variant="medium-strong" className={s.mine}>
                  моя
                </Typography.Label>
              )}
            </Flex>
          </Flex>

          <Typography.Body variant="medium-strong" asChild className={s.title}>
            <EllipsisText maxLines={2}>{request.title}</EllipsisText>
          </Typography.Body>

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
              {voteActions}
            </div>
          )}

          <Button size="small" variant="secondary" stretched onClick={() => setModal(true)}>
            Подробнее
          </Button>
        </Flex>
      </article>

      {modal && (
        <RequestDetail request={request} onClose={() => setModal(false)} voteActions={voteActions} />
      )}
    </>
  );
}
