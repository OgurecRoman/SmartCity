import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Switch, Typography } from '@maxhub/max-ui';
import { ChevronLeft } from 'lucide-react';
import { useA11y } from '../../a11y/AccessibilityProvider';
import {
  DEFAULT_A11Y_SETTINGS,
  FONT_OPTIONS,
  type AccessibilitySettings,
  type FontScale,
} from '../../a11y/types';
import s from './Settings.module.scss';

export default function Settings() {
  const navigate = useNavigate();
  const { settings, applySettings, resetSettings } = useA11y();
  const [draft, setDraft] = useState<AccessibilitySettings>(settings);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(settings), [draft, settings]);

  const patch = <K extends keyof AccessibilitySettings>(key: K, value: AccessibilitySettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const onReset = () => {
    setDraft({ ...DEFAULT_A11Y_SETTINGS });
    resetSettings();
  };

  const onApply = () => {
    applySettings(draft);
    navigate('/profile');
  };

  return (
    <div className={s.page}>
      <div className={s.top}>
        <button type="button" className={s.back} onClick={() => navigate(-1)}>
          <ChevronLeft size={18} strokeWidth={2} aria-hidden />
          Назад
        </button>
        <Typography.Headline variant="small" asChild>
          <h1>Настройки</h1>
        </Typography.Headline>
        <Typography.Body variant="small" className={s.hint}>
          Доступность: шрифт, контраст и удобство управления. Тема — как в MAX.
        </Typography.Body>
      </div>

      <section className={s.card} aria-label="Оформление">
        <label className={s.field}>
          <span className={s.label}>Шрифт</span>
          <select
            className={s.select}
            value={draft.font}
            onChange={(e) => patch('font', e.target.value as AccessibilitySettings['font'])}
          >
            {FONT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <div className={s.field}>
          <span className={s.label} id="font-scale-label">
            Размер шрифта
          </span>
          <div className={s.scale} role="radiogroup" aria-labelledby="font-scale-label">
            {([0, 1, 2, 3] as FontScale[]).map((level) => (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={draft.fontScale === level}
                aria-label={`Размер ${level + 1} из 4`}
                className={draft.fontScale === level ? `${s.scaleBtn} ${s.scaleBtnActive}` : s.scaleBtn}
                style={{ fontSize: `${0.85 + level * 0.22}rem` }}
                onClick={() => patch('fontScale', level)}
              >
                A
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={s.card} aria-label="Доступность">
        <label className={s.toggleRow}>
          <div className={s.toggleText}>
            <span className={s.toggleTitle}>Высокая контрастность</span>
            <span className={s.toggleHint}>Чёрный и белый без полутонов</span>
          </div>
          <Switch
            checked={draft.highContrast}
            onChange={(e) => patch('highContrast', e.currentTarget.checked)}
            aria-label="Высокая контрастность"
          />
        </label>

        <label className={s.toggleRow}>
          <div className={s.toggleText}>
            <span className={s.toggleTitle}>Медленные клавиши</span>
            <span className={s.toggleHint}>Защита от случайных повторных нажатий</span>
          </div>
          <Switch
            checked={draft.slowKeys}
            onChange={(e) => patch('slowKeys', e.currentTarget.checked)}
            aria-label="Медленные клавиши"
          />
        </label>

        <label className={s.toggleRow}>
          <div className={s.toggleText}>
            <span className={s.toggleTitle}>Анимации</span>
            <span className={s.toggleHint}>Отключите, если движение мешает</span>
          </div>
          <Switch
            checked={draft.animations}
            onChange={(e) => patch('animations', e.currentTarget.checked)}
            aria-label="Анимации"
          />
        </label>
      </section>

      <div className={s.actions}>
        <Button size="large" variant="secondary" stretched onClick={onReset}>
          Сброс
        </Button>
        <Button size="large" stretched onClick={onApply} disabled={!dirty}>
          Применить
        </Button>
      </div>
    </div>
  );
}
