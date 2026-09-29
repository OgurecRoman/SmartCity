import {
  A11Y_STORAGE_KEY,
  DEFAULT_A11Y_SETTINGS,
  type AccessibilitySettings,
  type FontPreference,
  type FontScale,
} from './types';

function isFont(value: unknown): value is FontPreference {
  return value === 'default' || value === 'verdana' || value === 'arial' || value === 'opendyslexic';
}

function isFontScale(value: unknown): value is FontScale {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

export function loadAccessibilitySettings(): AccessibilitySettings {
  try {
    const raw = localStorage.getItem(A11Y_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_A11Y_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AccessibilitySettings> & { theme?: unknown };
    return {
      font: isFont(parsed.font) ? parsed.font : DEFAULT_A11Y_SETTINGS.font,
      fontScale: isFontScale(parsed.fontScale) ? parsed.fontScale : DEFAULT_A11Y_SETTINGS.fontScale,
      highContrast: typeof parsed.highContrast === 'boolean' ? parsed.highContrast : DEFAULT_A11Y_SETTINGS.highContrast,
      slowKeys: typeof parsed.slowKeys === 'boolean' ? parsed.slowKeys : DEFAULT_A11Y_SETTINGS.slowKeys,
      animations: typeof parsed.animations === 'boolean' ? parsed.animations : DEFAULT_A11Y_SETTINGS.animations,
    };
  } catch {
    return { ...DEFAULT_A11Y_SETTINGS };
  }
}

export function saveAccessibilitySettings(settings: AccessibilitySettings): void {
  localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(settings));
}
