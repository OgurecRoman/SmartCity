import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ColorSchemeType } from '@maxhub/max-ui';
import { getSystemColorScheme } from '../lib/device';
import { loadAccessibilitySettings, saveAccessibilitySettings } from './storage';
import {
  DEFAULT_A11Y_SETTINGS,
  FONT_SCALE_VALUES,
  type AccessibilitySettings,
} from './types';
import './a11y.css';

type A11yContextValue = {
  settings: AccessibilitySettings;
  resolvedColorScheme: ColorSchemeType;
  applySettings: (next: AccessibilitySettings) => void;
  resetSettings: () => void;
};

const A11yContext = createContext<A11yContextValue | null>(null);

function resolveScheme(theme: AccessibilitySettings['theme'], system: ColorSchemeType): ColorSchemeType {
  if (theme === 'system') return system;
  return theme;
}

function applyDom(settings: AccessibilitySettings, scheme: ColorSchemeType) {
  const root = document.documentElement;
  root.dataset.a11yFont = settings.font;
  root.dataset.a11yScheme = scheme;
  root.style.setProperty('--a11y-zoom', String(FONT_SCALE_VALUES[settings.fontScale]));
  root.classList.toggle('a11y-contrast', settings.highContrast);
  root.classList.toggle('a11y-reduce-motion', !settings.animations);
  root.style.colorScheme = scheme;
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => loadAccessibilitySettings());
  const [systemScheme, setSystemScheme] = useState<ColorSchemeType>(() => getSystemColorScheme());

  const resolvedColorScheme = resolveScheme(settings.theme, systemScheme);

  const syncDom = useEffectEvent((next: AccessibilitySettings, scheme: ColorSchemeType) => {
    applyDom(next, scheme);
  });

  useEffect(() => {
    syncDom(settings, resolvedColorScheme);
  }, [settings, resolvedColorScheme, syncDom]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemScheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!settings.slowKeys) return;

    let lockedUntil = 0;
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest('button, a, [role="button"], label, input[type="checkbox"], input[type="radio"], .Tappable')) {
        return;
      }

      const now = Date.now();
      if (now < lockedUntil) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      lockedUntil = now + 500;
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [settings.slowKeys]);

  const value = useMemo<A11yContextValue>(
    () => ({
      settings,
      resolvedColorScheme,
      applySettings: (next) => {
        setSettings(next);
        saveAccessibilitySettings(next);
      },
      resetSettings: () => {
        const next = { ...DEFAULT_A11Y_SETTINGS };
        setSettings(next);
        saveAccessibilitySettings(next);
      },
    }),
    [settings, resolvedColorScheme],
  );

  return <A11yContext.Provider value={value}>{children}</A11yContext.Provider>;
}

export function useA11y() {
  const ctx = useContext(A11yContext);
  if (!ctx) throw new Error('useA11y must be used within AccessibilityProvider');
  return ctx;
}
