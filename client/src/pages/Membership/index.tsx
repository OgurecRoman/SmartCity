import { useState } from 'react';
import { Typography } from '@maxhub/max-ui';
import { useAuth } from '../../auth/AuthProvider';
import { ChairmanPanel } from './ChairmanPanel';
import { HouseSettingsPanel } from './HouseSettingsPanel';
import { MembershipQueue } from './MembershipQueue';
import { ResidentsPanel } from './ResidentsPanel';
import s from './Membership.module.scss';

type TabId = 'requests' | 'residents' | 'chairman' | 'house';

export default function Membership() {
  const { user } = useAuth();
  const isUk = user.role === 'UK_EMPLOYEE';
  const isChairman = user.role === 'CHAIRMAN';
  const canReview = isUk || isChairman;
  const [tab, setTab] = useState<TabId>('requests');

  if (!canReview) {
    return (
      <div className={s.page}>
        <Typography.Headline variant="small" asChild>
          <h1>Жители</h1>
        </Typography.Headline>
        <Typography.Body variant="medium" className={s.hint}>
          Раздел доступен УК и председателю ТСЖ
        </Typography.Body>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <Typography.Headline variant="small" asChild>
        <h1>Жители</h1>
      </Typography.Headline>

      <div className={s.tabs} role="tablist" aria-label="Разделы">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'requests'}
          className={tab === 'requests' ? `${s.tab} ${s.tabActive}` : s.tab}
          onClick={() => setTab('requests')}
        >
          Вступления
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'residents'}
          className={tab === 'residents' ? `${s.tab} ${s.tabActive}` : s.tab}
          onClick={() => setTab('residents')}
        >
          Список
        </button>
        {isUk && (
          <>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'chairman'}
              className={tab === 'chairman' ? `${s.tab} ${s.tabActive}` : s.tab}
              onClick={() => setTab('chairman')}
            >
              ТСЖ
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'house'}
              className={tab === 'house' ? `${s.tab} ${s.tabActive}` : s.tab}
              onClick={() => setTab('house')}
            >
              Дом
            </button>
          </>
        )}
      </div>

      {tab === 'requests' ? (
        <MembershipQueue />
      ) : tab === 'residents' ? (
        <ResidentsPanel />
      ) : isUk && tab === 'house' ? (
        <HouseSettingsPanel />
      ) : isUk && tab === 'chairman' ? (
        <ChairmanPanel />
      ) : (
        <MembershipQueue />
      )}
    </div>
  );
}
