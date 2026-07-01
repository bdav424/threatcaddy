import type { CustomAppearanceTheme } from '../types';

/** Color scheme presets. Each scheme provides CSS variable overrides for dark and light modes. */

export interface ColorScheme {
  id: string;
  label: string;
  /** The primary accent swatch color (for previewing in the picker) */
  swatch: string;
  preferredTheme?: 'dark' | 'light';
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

type OdysseusThemeSeed = {
  id: string;
  label: string;
  preferredTheme: 'dark' | 'light';
  bg: string;
  fg: string;
  panel: string;
  border: string;
  accent: string;
};

const ODYSSEUS_THEME_SEEDS: OdysseusThemeSeed[] = [
  { id: 'dark', label: 'Original', preferredTheme: 'dark', bg: '#282c34', fg: '#9cdef2', panel: '#111111', border: '#355a66', accent: '#e06c75' },
  { id: 'light', label: 'Light', preferredTheme: 'light', bg: '#f0ebe3', fg: '#5a5248', panel: '#faf6f0', border: '#d4cdc2', accent: '#c47d5a' },
  { id: 'midnight', label: 'Midnight', preferredTheme: 'dark', bg: '#0d1117', fg: '#c9d1d9', panel: '#161b22', border: '#30363d', accent: '#f85149' },
  { id: 'paper', label: 'Paper', preferredTheme: 'light', bg: '#faf8f5', fg: '#3b3836', panel: '#ffffff', border: '#d5d0c8', accent: '#c5ac4a' },
  { id: 'cyberpunk', label: 'Cyberpunk', preferredTheme: 'dark', bg: '#0a0a0f', fg: '#0ff0fc', panel: '#12101a', border: '#9b30ff', accent: '#e040fb' },
  { id: 'retrowave', label: 'Retrowave', preferredTheme: 'dark', bg: '#1a1a2e', fg: '#e94560', panel: '#16213e', border: '#533483', accent: '#e94560' },
  { id: 'forest', label: 'Forest', preferredTheme: 'dark', bg: '#1b2a1b', fg: '#a8d5a2', panel: '#142414', border: '#3d6b3d', accent: '#7cb871' },
  { id: 'ocean', label: 'Ocean', preferredTheme: 'dark', bg: '#0b1a2c', fg: '#64d2ff', panel: '#091422', border: '#1e5074', accent: '#4facfe' },
  { id: 'ume', label: 'Ume', preferredTheme: 'dark', bg: '#2b1b2e', fg: '#f5c2e7', panel: '#1e1420', border: '#6c4675', accent: '#f5a0c0' },
  { id: 'copper', label: 'Copper', preferredTheme: 'dark', bg: '#1c1410', fg: '#e8c39e', panel: '#140f0a', border: '#7a5533', accent: '#d4764e' },
  { id: 'terminal', label: 'Terminal', preferredTheme: 'dark', bg: '#000000', fg: '#00ff41', panel: '#0a0a0a', border: '#003b00', accent: '#00ff41' },
  { id: 'organs', label: 'Organs', preferredTheme: 'dark', bg: '#0a0406', fg: '#efe1c8', panel: '#15080a', border: '#3a1519', accent: '#c83240' },
  { id: 'lavender', label: 'Lavender', preferredTheme: 'light', bg: '#f3eef8', fg: '#3d3551', panel: '#faf7ff', border: '#cec3de', accent: '#9b6dcc' },
  { id: 'gpt', label: 'GPT', preferredTheme: 'dark', bg: '#212121', fg: '#ececec', panel: '#171717', border: '#424242', accent: '#949494' },
  { id: 'claude', label: 'Claude', preferredTheme: 'dark', bg: '#262624', fg: '#f5f4f0', panel: '#30302e', border: '#4a4a47', accent: '#c6613f' },
  { id: 'cute', label: 'Cute', preferredTheme: 'light', bg: '#fff0f5', fg: '#d4608a', panel: '#fff8fa', border: '#f0c0d0', accent: '#ff6b9d' },
];

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '').trim();
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${clampChannel(r).toString(16).padStart(2, '0')}${clampChannel(g).toString(16).padStart(2, '0')}${clampChannel(b).toString(16).padStart(2, '0')}`;
}

function mixHex(base: string, target: string, ratio: number) {
  const from = hexToRgb(base);
  const to = hexToRgb(target);
  return rgbToHex({
    r: from.r + (to.r - from.r) * ratio,
    g: from.g + (to.g - from.g) * ratio,
    b: from.b + (to.b - from.b) * ratio,
  });
}

function softenForThemeMode(seed: OdysseusThemeSeed, theme: 'dark' | 'light') {
  if (theme === seed.preferredTheme) return seed;
  if (theme === 'dark') {
    return {
      ...seed,
      bg: mixHex(seed.bg, '#0f172a', 0.84),
      fg: mixHex(seed.fg, '#e7ecf3', 0.68),
      panel: mixHex(seed.panel, '#111827', 0.82),
      border: mixHex(seed.border, '#334155', 0.56),
    };
  }
  return {
    ...seed,
    bg: mixHex(seed.bg, '#f7f4ee', 0.84),
    fg: mixHex(seed.fg, '#2f2925', 0.76),
    panel: mixHex(seed.panel, '#ffffff', 0.9),
    border: mixHex(seed.border, '#d9d1c4', 0.56),
  };
}

function buildOdysseusAppearance(seed: OdysseusThemeSeed, theme: 'dark' | 'light'): Record<AppearanceColorVariable, string> {
  const resolved = softenForThemeMode(seed, theme);
  const accentHover = mixHex(resolved.accent, '#ffffff', theme === 'dark' ? 0.18 : 0.1);
  const accentDim = mixHex(resolved.accent, theme === 'dark' ? resolved.bg : '#000000', theme === 'dark' ? 0.2 : 0.14);
  const raised = mixHex(resolved.panel, resolved.fg, theme === 'dark' ? 0.06 : 0.03);
  const hover = mixHex(resolved.panel, resolved.fg, theme === 'dark' ? 0.12 : 0.08);
  const active = mixHex(resolved.panel, resolved.accent, theme === 'dark' ? 0.16 : 0.14);
  const borderSubtle = mixHex(resolved.border, resolved.panel, theme === 'dark' ? 0.36 : 0.22);
  const textSecondary = mixHex(resolved.fg, resolved.panel, theme === 'dark' ? 0.34 : 0.4);
  const textMuted = mixHex(resolved.fg, resolved.panel, theme === 'dark' ? 0.52 : 0.58);
  return {
    '--color-accent': resolved.accent,
    '--color-accent-hover': accentHover,
    '--color-accent-dim': accentDim,
    '--color-bg-deep': resolved.bg,
    '--color-bg-surface': resolved.panel,
    '--color-bg-raised': raised,
    '--color-bg-hover': hover,
    '--color-bg-active': active,
    '--color-border-subtle': borderSubtle,
    '--color-border-medium': resolved.border,
    '--color-text-primary': resolved.fg,
    '--color-text-secondary': textSecondary,
    '--color-text-muted': textMuted,
    '--color-purple': accentHover,
    '--color-accent-blue': theme === 'dark' ? mixHex('#38bdf8', resolved.fg, 0.1) : mixHex('#0284c7', resolved.panel, 0.08),
    '--color-accent-green': theme === 'dark' ? mixHex('#4ade80', resolved.fg, 0.08) : mixHex('#16a34a', resolved.panel, 0.08),
    '--color-accent-amber': theme === 'dark' ? mixHex('#fbbf24', resolved.fg, 0.08) : mixHex('#d97706', resolved.panel, 0.08),
    '--color-accent-pink': mixHex(resolved.accent, '#f472b6', 0.28),
  };
}

export const ODYSSEUS_COLOR_SCHEMES: ColorScheme[] = ODYSSEUS_THEME_SEEDS.map((seed) => ({
  id: `odysseus-${seed.id}`,
  label: seed.label,
  swatch: seed.accent,
  preferredTheme: seed.preferredTheme,
  dark: buildOdysseusAppearance(seed, 'dark'),
  light: buildOdysseusAppearance(seed, 'light'),
}));

export const ALL_BUILTIN_COLOR_SCHEMES: ColorScheme[] = [
  ...COLOR_SCHEMES,
  ...ODYSSEUS_COLOR_SCHEMES,
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
  const scheme = ALL_BUILTIN_COLOR_SCHEMES.find((s) => s.id === schemeId) || customThemes.find((s) => s.id === schemeId);
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
