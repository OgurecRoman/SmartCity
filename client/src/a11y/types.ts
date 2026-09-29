/** Только шрифты с нормальной кириллицей и читаемостью. */
export type FontPreference = 'default' | 'verdana' | 'arial' | 'opendyslexic';
export type FontScale = 0 | 1 | 2 | 3;

export type AccessibilitySettings = {
  font: FontPreference;
  fontScale: FontScale;
  highContrast: boolean;
  slowKeys: boolean;
  animations: boolean;
};

export const DEFAULT_A11Y_SETTINGS: AccessibilitySettings = {
  font: 'default',
  fontScale: 0,
  highContrast: false,
  slowKeys: false,
  animations: true,
};

export const FONT_SCALE_VALUES = [1, 1.1, 1.22, 1.35] as const;

export const FONT_OPTIONS: { value: FontPreference; label: string }[] = [
  { value: 'default', label: 'Системный' },
  { value: 'verdana', label: 'Verdana' },
  { value: 'arial', label: 'Arial' },
  { value: 'opendyslexic', label: 'OpenDyslexic' },
];

export const A11Y_STORAGE_KEY = 'smartcity.a11y';
