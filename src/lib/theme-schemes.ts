import type { CustomAppearanceTheme } from '../types';

/** Color scheme presets. Each scheme provides CSS variable overrides for dark and light modes. */

export interface ColorScheme {
  id: string;
  label: string;
  /** The primary accent swatch color (for previewing in the picker) */
  swatch: string;
  dark: Record<string, string>;
  light: Record<string, string>;
}

export type AppearanceColorVariable =
  | '--color-accent'
  | '--color-accent-hover'
  | '--color-accent-dim'
  | '--color-bg-deep'
  | '--color-bg-surface'
  | '--color-bg-raised'
  | '--color-bg-hover'
  | '--color-bg-active'
  | '--color-border-subtle'
  | '--color-border-medium'
  | '--color-text-primary'
  | '--color-text-secondary'
  | '--color-text-muted'
  | '--color-purple'
  | '--color-accent-blue'
  | '--color-accent-green'
  | '--color-accent-amber'
  | '--color-accent-pink';

export const APPEARANCE_COLOR_VARIABLES: { key: AppearanceColorVariable; label: string }[] = [
  { key: '--color-accent', label: 'Accent' },
  { key: '--color-accent-hover', label: 'Accent hover' },
  { key: '--color-accent-dim', label: 'Accent dim' },
  { key: '--color-bg-deep', label: 'Deep background' },
  { key: '--color-bg-surface', label: 'Surface' },
  { key: '--color-bg-raised', label: 'Raised surface' },
  { key: '--color-bg-hover', label: 'Hover surface' },
  { key: '--color-bg-active', label: 'Active surface' },
  { key: '--color-border-subtle', label: 'Subtle border' },
  { key: '--color-border-medium', label: 'Medium border' },
  { key: '--color-text-primary', label: 'Primary text' },
  { key: '--color-text-secondary', label: 'Secondary text' },
  { key: '--color-text-muted', label: 'Muted text' },
  { key: '--color-purple', label: 'Primary highlight' },
  { key: '--color-accent-blue', label: 'Blue accent' },
  { key: '--color-accent-green', label: 'Green accent' },
  { key: '--color-accent-amber', label: 'Amber accent' },
  { key: '--color-accent-pink', label: 'Pink accent' },
];

export const DEFAULT_DARK_THEME_COLORS: Record<AppearanceColorVariable, string> = {
  '--color-accent': '#6366f1',
  '--color-accent-hover': '#818cf8',
  '--color-accent-dim': '#4f46e5',
  '--color-bg-deep': '#0d0b14',
  '--color-bg-surface': '#13111c',
  '--color-bg-raised': '#1a1726',
  '--color-bg-hover': '#211d30',
  '--color-bg-active': '#262040',
  '--color-border-subtle': '#272234',
  '--color-border-medium': '#39314a',
  '--color-text-primary': '#e4e0f0',
  '--color-text-secondary': '#9590a8',
  '--color-text-muted': '#918ba8',
  '--color-purple': '#7c6bf0',
  '--color-accent-blue': '#38bdf8',
  '--color-accent-green': '#4ade80',
  '--color-accent-amber': '#fbbf24',
  '--color-accent-pink': '#f472b6',
};

export const DEFAULT_LIGHT_THEME_COLORS: Record<AppearanceColorVariable, string> = {
  '--color-accent': '#4f46e5',
  '--color-accent-hover': '#6366f1',
  '--color-accent-dim': '#4338ca',
  '--color-bg-deep': '#f8f7fc',
  '--color-bg-surface': '#f0eef8',
  '--color-bg-raised': '#e8e5f5',
  '--color-bg-hover': '#ddd9ef',
  '--color-bg-active': '#d4cee8',
  '--color-border-subtle': '#e5e1ef',
  '--color-border-medium': '#d7d1e4',
  '--color-text-primary': '#1a1726',
  '--color-text-secondary': '#5f5878',
  '--color-text-muted': '#716b88',
  '--color-purple': '#6d5ce0',
  '--color-accent-blue': '#0284c7',
  '--color-accent-green': '#16a34a',
  '--color-accent-amber': '#d97706',
  '--color-accent-pink': '#db2777',
};

export const FONT_OPTIONS = [
  { id: 'system', label: 'System UI', value: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { id: 'serif', label: 'Serif', value: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' },
  { id: 'mono', label: 'Mono', value: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' },
  { id: 'rounded', label: 'Rounded', value: 'ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif' },
] as const;

export const COLOR_SCHEMES: ColorScheme[] = [
  {
    id: 'indigo',
    label: 'Indigo',
    swatch: '#6366f1',
    dark: {}, // default — no overrides needed
    light: {},
  },
  {
    id: 'ocean',
    label: 'Ocean',
    swatch: '#0ea5e9',
    dark: {
      '--color-accent': '#0ea5e9',
      '--color-accent-hover': '#38bdf8',
      '--color-accent-dim': '#0284c7',
      '--color-bg-deep': '#0a0f18',
      '--color-bg-surface': '#0f1620',
      '--color-bg-raised': '#141d2b',
      '--color-bg-hover': '#1a2536',
      '--color-bg-active': '#1e2d42',
      '--color-purple': '#38bdf8',
    },
    light: {
      '--color-accent': '#0284c7',
      '--color-accent-hover': '#0ea5e9',
      '--color-accent-dim': '#0369a1',
      '--color-bg-deep': '#f0f9ff',
      '--color-bg-surface': '#e0f2fe',
      '--color-bg-raised': '#bae6fd',
      '--color-bg-hover': '#a5d8f5',
      '--color-bg-active': '#7dd3fc',
      '--color-purple': '#0ea5e9',
    },
  },
  {
    id: 'emerald',
    label: 'Emerald',
    swatch: '#10b981',
    dark: {
      '--color-accent': '#10b981',
      '--color-accent-hover': '#34d399',
      '--color-accent-dim': '#059669',
      '--color-bg-deep': '#0a1410',
      '--color-bg-surface': '#0f1c16',
      '--color-bg-raised': '#14261e',
      '--color-bg-hover': '#1a3028',
      '--color-bg-active': '#1e3a30',
      '--color-purple': '#34d399',
    },
    light: {
      '--color-accent': '#059669',
      '--color-accent-hover': '#10b981',
      '--color-accent-dim': '#047857',
      '--color-bg-deep': '#f0fdf4',
      '--color-bg-surface': '#dcfce7',
      '--color-bg-raised': '#bbf7d0',
      '--color-bg-hover': '#a7f3d0',
      '--color-bg-active': '#86efac',
      '--color-purple': '#10b981',
    },
  },
  {
    id: 'rose',
    label: 'Rose',
    swatch: '#f43f5e',
    dark: {
      '--color-accent': '#f43f5e',
      '--color-accent-hover': '#fb7185',
      '--color-accent-dim': '#e11d48',
      '--color-bg-deep': '#140a0e',
      '--color-bg-surface': '#1c0f14',
      '--color-bg-raised': '#26141c',
      '--color-bg-hover': '#301a24',
      '--color-bg-active': '#3a1e2c',
      '--color-purple': '#fb7185',
    },
    light: {
      '--color-accent': '#e11d48',
      '--color-accent-hover': '#f43f5e',
      '--color-accent-dim': '#be123c',
      '--color-bg-deep': '#fff1f2',
      '--color-bg-surface': '#ffe4e6',
      '--color-bg-raised': '#fecdd3',
      '--color-bg-hover': '#fda4af',
      '--color-bg-active': '#fb7185',
      '--color-purple': '#f43f5e',
    },
  },
  {
    id: 'amber',
    label: 'Amber',
    swatch: '#f59e0b',
    dark: {
      '--color-accent': '#f59e0b',
      '--color-accent-hover': '#fbbf24',
      '--color-accent-dim': '#d97706',
      '--color-bg-deep': '#14100a',
      '--color-bg-surface': '#1c160f',
      '--color-bg-raised': '#261e14',
      '--color-bg-hover': '#30261a',
      '--color-bg-active': '#3a2e1e',
      '--color-purple': '#fbbf24',
    },
    light: {
      '--color-accent': '#d97706',
      '--color-accent-hover': '#f59e0b',
      '--color-accent-dim': '#b45309',
      '--color-bg-deep': '#fffbeb',
      '--color-bg-surface': '#fef3c7',
      '--color-bg-raised': '#fde68a',
      '--color-bg-hover': '#fcd34d',
      '--color-bg-active': '#fbbf24',
      '--color-purple': '#f59e0b',
    },
  },
  {
    id: 'slate',
    label: 'Slate',
    swatch: '#64748b',
    dark: {
      '--color-accent': '#64748b',
      '--color-accent-hover': '#94a3b8',
      '--color-accent-dim': '#475569',
      '--color-bg-deep': '#0c0e12',
      '--color-bg-surface': '#12151a',
      '--color-bg-raised': '#1a1e26',
      '--color-bg-hover': '#222730',
      '--color-bg-active': '#2a303c',
      '--color-purple': '#94a3b8',
    },
    light: {
      '--color-accent': '#475569',
      '--color-accent-hover': '#64748b',
      '--color-accent-dim': '#334155',
      '--color-bg-deep': '#f8fafc',
      '--color-bg-surface': '#f1f5f9',
      '--color-bg-raised': '#e2e8f0',
      '--color-bg-hover': '#cbd5e1',
      '--color-bg-active': '#94a3b8',
      '--color-purple': '#64748b',
    },
  },
];

function isAppearanceColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim());
}

/** Apply a color scheme's CSS variables to the document root. */
export function applyColorScheme(
  schemeId: string,
  theme: 'dark' | 'light',
  customThemes: CustomAppearanceTheme[] = [],
  fontFamily?: string,
  fontScale?: number,
): void {
  const scheme = COLOR_SCHEMES.find((s) => s.id === schemeId) || customThemes.find((s) => s.id === schemeId);
  const root = document.documentElement;

  // Clear every managed appearance variable, including values from deleted/imported themes.
  for (const { key } of APPEARANCE_COLOR_VARIABLES) {
    root.style.removeProperty(key);
  }

  root.style.setProperty('--tc-font-family', fontFamily || FONT_OPTIONS[0].value);
  root.style.setProperty('--tc-font-scale', String((fontScale ?? 100) / 100));

  if (!scheme) return; // default indigo — no overrides
  const vars = theme === 'dark' ? scheme.dark : scheme.light;
  for (const { key } of APPEARANCE_COLOR_VARIABLES) {
    const value = vars[key];
    if (isAppearanceColor(value)) root.style.setProperty(key, value.trim());
  }
}
