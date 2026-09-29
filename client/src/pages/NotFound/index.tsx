import { Button, Typography } from '@maxhub/max-ui';
import { useNavigate } from 'react-router';
import s from './NotFound.module.scss';

const FLOORS = [
  ['blinkSlow', 'dim', 'lit', 'dim'],
  ['dim', 'lit', 'lit', 'lit'],
  ['lit', 'dim', 'blink', 'dim'],
  ['dim', 'lit', 'dim', 'lit'],
] as const;

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className={s.page} role="status" aria-live="polite">
      <div className={s.stage} aria-hidden>
        <div className={s.glow} />

        <div className={s.building}>
          <div className={s.cornice} />
          <div className={s.facade}>
            {FLOORS.map((row, floor) => (
              <div className={s.floor} key={floor}>
                {row.map((kind, i) =>
                (
                    <div
                      className={[
                        s.apartment,
                        kind === 'dim' ? s.dim : s.lit,
                        kind === 'blink' ? s.blink : '',
                        kind === 'blinkSlow' ? s.blinkSlow : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      key={i}
                    >
                      <span className={s.pane} />
                      <span className={s.pane} />
                      <span className={s.pane} />
                      <span className={s.pane} />
                    </div>
                  ),
                )}
              </div>
            ))}

            <div className={s.entrance}>
              <div className={s.canopy} />
              <div className={s.door}>
                <span className={s.doorGlass} />
                <span className={s.plate}>404</span>
                <span className={s.knob} />
              </div>
            </div>
          </div>
          <div className={s.base} />
          <div className={s.ground} />
        </div>

        <p className={s.code}>404</p>
      </div>

      <div className={s.copy}>
        <Typography.Headline variant="small" asChild>
          <h1 className={s.title}>Страница не найдена</h1>
        </Typography.Headline>
        <Typography.Body variant="medium" className={s.hint}>
          Такой страницы в приложении нет. Вернитесь на главную и продолжите с дома.
        </Typography.Body>
      </div>

      <div className={s.cta}>
        <Button size="medium" stretched onClick={() => navigate('/', { replace: true })}>
          На главную
        </Button>
      </div>
    </div>
  );
}
