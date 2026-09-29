import type { ColorSchemeType, PlatformType } from '@maxhub/max-ui';

export function detectPlatform(): PlatformType {
  if (typeof navigator === 'undefined') return 'android';

  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/i.test(ua)) return 'ios';

  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return 'ios';

  return 'android';
}

export function getSystemColorScheme(): ColorSchemeType {
  if (typeof window === 'undefined') return 'light';

  const fromMax = window.WebApp?.colorScheme;
  if (fromMax === 'light' || fromMax === 'dark') return fromMax;

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
