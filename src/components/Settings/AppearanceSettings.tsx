import { useState, useEffect, useMemo, useRef, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, Copy, Download, GripHorizontal, MousePointer2, Palette, Pencil, Pipette, RotateCcw, Save, Trash2, Type, Upload, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AppearanceTypographyTarget, BackgroundEffectPattern, CustomAppearanceTheme, Settings, SidebarAccentStyle } from '../../types';
import {
  ALL_BUILTIN_COLOR_SCHEMES,
  APPEARANCE_COLOR_VARIABLES,
  COLOR_SCHEMES,
  DEFAULT_DARK_THEME_COLORS,
  DEFAULT_LIGHT_THEME_COLORS,
  FONT_OPTIONS,
  ODYSSEUS_COLOR_SCHEMES,
  type AppearanceColorVariable,
  type ColorScheme,
} from '../../lib/theme-schemes';
import { saveBgImage, loadBgImage, loadBgImageBlob, removeBgImage } from '../../lib/theme-bg';
import { cn } from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';

interface AppearanceSettingsProps {
  settings: Settings;
  onUpdateSettings: (updates: Partial<Settings>) => void;
}

type ThemeDraft = {
  id?: string;
  name: string;
  swatch: string;
  fontFamily?: string;
  fontTargets?: Partial<Record<AppearanceTypographyTarget, string>>;
  dark: Record<AppearanceColorVariable, string>;
  light: Record<AppearanceColorVariable, string>;
};

type PaletteEditorTarget =
  | { kind: 'theme-color'; key: AppearanceColorVariable; mode: HarmonyMode }
  | { kind: 'draft-color'; key: AppearanceColorVariable; mode: HarmonyMode }
  | { kind: 'draft-swatch' }
  | { kind: 'harmony-accent' }
  | { kind: 'background-effect-color' };

type PaletteEditorState = {
  id: number;
  target: PaletteEditorTarget;
  label: string;
  value: string;
  draftValue: string;
  inputValue: string;
  position: { x: number; y: number };
};

type HslColor = { h: number; s: number; l: number };
type WheelSelection = { color: HslColor; point: { x: number; y: number } };
type WheelLoupeState = { x: number; y: number; color: string; visible: boolean };
type ThemeBackgroundExport = {
  data: string;
  mimeType: string;
  size: number;
  settings: Pick<Settings, 'bgImageEnabled' | 'bgImageOpacity' | 'bgImagePosX' | 'bgImagePosY' | 'bgImageZoom' | 'bgImageBlur' | 'bgEffectPattern' | 'bgEffectColor' | 'bgEffectIntensity' | 'bgEffectSize' | 'frostedPanels'>;
};
type ThemeExportBundle = {
  threatCaddyAppearanceThemes: CustomAppearanceTheme[];
  threatCaddyAppearanceBackgroundImage?: ThemeBackgroundExport;
};
type HarmonyAssignment = {
  key: AppearanceColorVariable;
  label: string;
  value: string;
};
type HarmonySuggestion = {
  id: string;
  label: string;
  description: string;
  preview: string[];
  assignments: HarmonyAssignment[];
};
type HarmonyType = 'complementary' | 'analogous' | 'triadic' | 'monochromatic';
type HarmonyMode = 'dark' | 'light';

const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8 MB
const COLOR_WHEEL_BACKGROUND = 'radial-gradient(circle, #ffffff 0%, rgba(255,255,255,0.88) 17%, rgba(255,255,255,0) 43%, rgba(0,0,0,0.15) 62%, rgba(0,0,0,0.92) 100%), conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)';

const TYPOGRAPHY_TARGETS: { id: AppearanceTypographyTarget; label: string; description: string }[] = [
  { id: 'interface', label: 'Whole interface', description: 'Default font for the full app' },
  { id: 'headings', label: 'Headings', description: 'Section titles and labels' },
  { id: 'body', label: 'Body text', description: 'Notes, tables, cards, and descriptions' },
  { id: 'controls', label: 'Controls', description: 'Buttons, inputs, menus, and sliders' },
  { id: 'navigation', label: 'Navigation', description: 'Sidebar and top-level navigation' },
  { id: 'code', label: 'Code', description: 'Monospace snippets and technical text' },
];

const COMMON_LOCAL_FONTS = [
  'Arial',
  'Avenir Next',
  'Courier New',
  'Futura',
  'Georgia',
  'Helvetica Neue',
  'Menlo',
  'Monaco',
  'SF Pro Display',
  'SF Pro Text',
  'Times New Roman',
  'Verdana',
];

const PALETTE_PREVIEW_ITEMS: { key: AppearanceColorVariable; label: string; description: string }[] = [
  { key: '--color-bg-deep', label: 'Page background', description: 'Outer workspace and deep page background' },
  { key: '--color-bg-surface', label: 'Main panel', description: 'Primary content panels and settings surfaces' },
  { key: '--color-bg-raised', label: 'Raised cards', description: 'Cards, popovers, and elevated sections' },
  { key: '--color-bg-hover', label: 'Hover row', description: 'Hovered lists, rows, and quiet buttons' },
  { key: '--color-bg-active', label: 'Selected row', description: 'Active navigation and selected objects' },
  { key: '--color-accent', label: 'Primary action', description: 'Main buttons, active tabs, and focus color' },
  { key: '--color-accent-hover', label: 'Action hover', description: 'Hovered primary actions and brighter accents' },
  { key: '--color-accent-dim', label: 'Action shadow', description: 'Pressed and lower-emphasis accent states' },
  { key: '--color-border-subtle', label: 'Soft borders', description: 'Panel dividers and low-contrast outlines' },
  { key: '--color-border-medium', label: 'Strong borders', description: 'Inputs, selected cards, and harder outlines' },
  { key: '--color-text-primary', label: 'Primary text', description: 'Headings and important content' },
  { key: '--color-text-secondary', label: 'Secondary text', description: 'Labels, metadata, and supporting copy' },
  { key: '--color-text-muted', label: 'Muted text', description: 'Hints, empty states, and quiet labels' },
  { key: '--color-accent-blue', label: 'Info signal', description: 'Informational badges and blue status accents' },
  { key: '--color-accent-green', label: 'Success signal', description: 'Resolved, clean, or positive status accents' },
  { key: '--color-accent-amber', label: 'Warning signal', description: 'Pending, warning, or notable status accents' },
  { key: '--color-accent-pink', label: 'Critical signal', description: 'High-priority or destructive-adjacent accents' },
  { key: '--color-purple', label: 'Highlight signal', description: 'Secondary highlight accents and emphasis' },
];

const PALETTE_GROUPS: { title: string; keys: AppearanceColorVariable[] }[] = [
  {
    title: 'Background',
    keys: ['--color-bg-deep', '--color-bg-surface', '--color-bg-raised', '--color-bg-hover', '--color-bg-active'],
  },
  {
    title: 'Text and borders',
    keys: ['--color-text-primary', '--color-text-secondary', '--color-text-muted', '--color-border-subtle', '--color-border-medium'],
  },
  {
    title: 'Actions and signals',
    keys: ['--color-accent', '--color-accent-hover', '--color-accent-dim', '--color-accent-blue', '--color-accent-green', '--color-accent-amber', '--color-accent-pink', '--color-purple'],
  },
];

const BACKGROUND_EFFECT_OPTIONS: { id: BackgroundEffectPattern; label: string; description: string }[] = [
  { id: 'none', label: 'Solid', description: 'Keep the desktop background still.' },
  { id: 'dots', label: 'Dots', description: 'A quiet Odysseus-style dotted field.' },
  { id: 'synapse', label: 'Synapse', description: 'Grid pulses inspired by the Odysseus synapse background.' },
  { id: 'rain', label: 'Rain', description: 'Thin falling streaks with adjustable intensity.' },
  { id: 'constellations', label: 'Constellations', description: 'Floating nodes with subtle connective lines.' },
  { id: 'perlin-flow', label: 'Perlin Flow', description: 'Soft drifting particle streams.' },
  { id: 'petals', label: 'Petals', description: 'Gentle falling petal shapes.' },
  { id: 'sparkles', label: 'Sparkles', description: 'Small twinkling points for a lighter ambient effect.' },
  { id: 'embers', label: 'Embers', description: 'Slow rising warm flecks for a calmer alert feel.' },
  { id: 'swirls', label: 'Swirls', description: 'ThreatCaddy orbiting ribbons that keep the older motion option available.' },
];

const BACKGROUND_EFFECT_LABELS: Record<BackgroundEffectPattern, string> = Object.fromEntries(
  BACKGROUND_EFFECT_OPTIONS.map((option) => [option.id, option.label]),
) as Record<BackgroundEffectPattern, string>;
const BACKGROUND_EFFECT_IDS = new Set<BackgroundEffectPattern>(BACKGROUND_EFFECT_OPTIONS.map((option) => option.id));

const DEFAULT_ODYSSEUS_EFFECT_COLOR = '__palette__';

type OdysseusVisualDefault = Omit<Partial<Settings>, 'bgEffectColor'> & {
  bgEffectColor?: string | typeof DEFAULT_ODYSSEUS_EFFECT_COLOR;
};

const ODYSSEUS_VISUAL_DEFAULTS: Record<string, OdysseusVisualDefault> = {
  'odysseus-dark': { bgEffectPattern: 'none', bgEffectColor: undefined, bgEffectIntensity: 100, bgEffectSize: 100, frostedPanels: false },
  'odysseus-light': { bgEffectPattern: 'dots', bgEffectColor: DEFAULT_ODYSSEUS_EFFECT_COLOR, bgEffectIntensity: 100, bgEffectSize: 100, frostedPanels: false },
  'odysseus-midnight': { bgEffectPattern: 'rain', bgEffectColor: '#ffffff', bgEffectIntensity: 50, bgEffectSize: 100, frostedPanels: false },
  'odysseus-paper': { bgEffectPattern: 'dots', bgEffectColor: DEFAULT_ODYSSEUS_EFFECT_COLOR, bgEffectIntensity: 100, bgEffectSize: 100, frostedPanels: false },
  'odysseus-cyberpunk': { bgEffectPattern: 'synapse', bgEffectColor: DEFAULT_ODYSSEUS_EFFECT_COLOR, bgEffectIntensity: 100, bgEffectSize: 100, frostedPanels: false },
  'odysseus-retrowave': { bgEffectPattern: 'embers', bgEffectColor: DEFAULT_ODYSSEUS_EFFECT_COLOR, bgEffectIntensity: 100, bgEffectSize: 100, frostedPanels: false },
  'odysseus-forest': { bgEffectPattern: 'petals', bgEffectColor: DEFAULT_ODYSSEUS_EFFECT_COLOR, bgEffectIntensity: 100, bgEffectSize: 100, frostedPanels: false },
  'odysseus-ocean': { bgEffectPattern: 'constellations', bgEffectColor: DEFAULT_ODYSSEUS_EFFECT_COLOR, bgEffectIntensity: 100, bgEffectSize: 100, frostedPanels: false },
  'odysseus-ume': { bgEffectPattern: 'petals', bgEffectColor: '#f5a0c0', bgEffectIntensity: 100, bgEffectSize: 100, frostedPanels: false },
  'odysseus-copper': { bgEffectPattern: 'none', bgEffectColor: undefined, bgEffectIntensity: 100, bgEffectSize: 100, frostedPanels: false },
  'odysseus-terminal': { bgEffectPattern: 'perlin-flow', bgEffectColor: '#00ff41', bgEffectIntensity: 80, bgEffectSize: 100, frostedPanels: false },
  'odysseus-organs': { bgEffectPattern: 'rain', bgEffectColor: '#451616', bgEffectIntensity: 65, bgEffectSize: 100, frostedPanels: false },
  'odysseus-lavender': { bgEffectPattern: 'none', bgEffectColor: undefined, bgEffectIntensity: 100, bgEffectSize: 100, frostedPanels: true },
  'odysseus-gpt': { bgEffectPattern: 'none', bgEffectColor: undefined, bgEffectIntensity: 100, bgEffectSize: 100, frostedPanels: false },
  'odysseus-claude': { bgEffectPattern: 'none', bgEffectColor: undefined, bgEffectIntensity: 100, bgEffectSize: 100, frostedPanels: false },
  'odysseus-cute': { bgEffectPattern: 'sparkles', bgEffectColor: '#ff8cb8', bgEffectIntensity: 100, bgEffectSize: 100, frostedPanels: false },
};

function nowId() {
  return `theme-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim());
}

function isBackgroundEffectPattern(value: unknown): value is BackgroundEffectPattern {
  return typeof value === 'string' && BACKGROUND_EFFECT_IDS.has(value as BackgroundEffectPattern);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hexToHsl(hex: string): HslColor {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex({ h, s, l }: HslColor): string {
  const sat = clamp(s, 0, 100) / 100;
  const light = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (channel: number) => Math.round((channel + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function normalizeHexInput(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

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

function getPaletteEffectColor(
  pattern: BackgroundEffectPattern,
  colors: Record<AppearanceColorVariable, string>,
): string | undefined {
  if (pattern === 'none') return undefined;
  const accent = colors['--color-accent'];
  const text = colors['--color-text-primary'];
  const surface = colors['--color-bg-surface'];
  if (pattern === 'embers') return colors['--color-accent-amber'] || accent;
  if (pattern === 'sparkles' || pattern === 'petals') return colors['--color-accent-pink'] || accent;
  if (pattern === 'constellations') return colors['--color-accent-blue'] || mixHex(text, accent, 0.34);
  if (pattern === 'perlin-flow') return colors['--color-accent-green'] || mixHex(accent, text, 0.28);
  if (pattern === 'synapse') return mixHex(accent, text, 0.22);
  if (pattern === 'rain') return mixHex(text, surface, 0.16);
  if (pattern === 'dots') return mixHex(text, accent, 0.18);
  if (pattern === 'swirls') return accent;
  return text || accent;
}

function resolveOdysseusVisualDefaults(
  themeId: string,
  colors: Record<AppearanceColorVariable, string>,
): Partial<Settings> {
  const defaults = ODYSSEUS_VISUAL_DEFAULTS[themeId];
  if (!defaults) return {};
  const pattern = defaults.bgEffectPattern ?? 'none';
  return {
    ...defaults,
    bgEffectColor: defaults.bgEffectColor === DEFAULT_ODYSSEUS_EFFECT_COLOR
      ? getPaletteEffectColor(pattern, colors)
      : defaults.bgEffectColor,
  };
}

function getEffectPreviewBackground(pattern: BackgroundEffectPattern, color: string) {
  if (pattern === 'none') return `linear-gradient(135deg, ${color}22, transparent 55%, ${color}12)`;
  if (pattern === 'dots') {
    return `radial-gradient(circle, ${color}55 1px, transparent 1.5px), linear-gradient(135deg, ${color}10, transparent 58%, ${color}16)`;
  }
  if (pattern === 'synapse') {
    return `linear-gradient(${color}18 1px, transparent 1px), linear-gradient(90deg, ${color}18 1px, transparent 1px), radial-gradient(circle at 30% 38%, ${color}32 0, transparent 20%)`;
  }
  if (pattern === 'rain') {
    return `repeating-linear-gradient(100deg, transparent 0 18px, ${color}33 19px, transparent 21px), linear-gradient(135deg, ${color}10, transparent 58%, ${color}16)`;
  }
  if (pattern === 'constellations') {
    return `radial-gradient(circle at 22% 26%, ${color}44 0, transparent 8%), radial-gradient(circle at 70% 36%, ${color}33 0, transparent 7%), radial-gradient(circle at 46% 68%, ${color}2c 0, transparent 6%), linear-gradient(135deg, ${color}12, transparent 55%, ${color}18)`;
  }
  if (pattern === 'perlin-flow') {
    return `radial-gradient(ellipse at 18% 22%, ${color}2f 0, transparent 28%), radial-gradient(ellipse at 74% 66%, ${color}24 0, transparent 34%), linear-gradient(135deg, transparent, ${color}18 54%, transparent)`;
  }
  if (pattern === 'petals') {
    return `radial-gradient(ellipse at 26% 28%, ${color}44 0, transparent 11%), radial-gradient(ellipse at 62% 52%, ${color}2f 0, transparent 10%), radial-gradient(ellipse at 80% 22%, ${color}26 0, transparent 8%), linear-gradient(135deg, ${color}10, transparent 58%, ${color}16)`;
  }
  if (pattern === 'sparkles') {
    return `radial-gradient(circle at 24% 30%, ${color}55 0, transparent 10%), radial-gradient(circle at 60% 44%, ${color}44 0, transparent 8%), radial-gradient(circle at 72% 18%, ${color}30 0, transparent 6%), linear-gradient(135deg, ${color}10, transparent 58%, ${color}16)`;
  }
  if (pattern === 'embers') {
    return `radial-gradient(circle at 25% 70%, ${color}55 0, transparent 10%), radial-gradient(circle at 68% 38%, ${color}3f 0, transparent 8%), linear-gradient(20deg, ${color}22, transparent 58%)`;
  }
  return `radial-gradient(circle at 30% 38%, ${color}32 0, transparent 20%), radial-gradient(circle at 64% 62%, ${color}20 0, transparent 24%), linear-gradient(135deg, ${color}14, transparent 52%, ${color}18)`;
}

function hslPartsToHex(h: number, s: number, l: number) {
  return hslToHex({
    h: ((Math.round(h) % 360) + 360) % 360,
    s: clamp(Math.round(s), 0, 100),
    l: clamp(Math.round(l), 0, 100),
  });
}

function generateOdysseusHarmonyBase(accentHex: string, harmonyType: HarmonyType, mode: HarmonyMode) {
  const { h, s } = hexToHsl(accentHex);
  const isDark = mode === 'dark';
  let bgH: number;
  let bgS: number;
  let bgL: number;
  let fgS: number;
  let fgL: number;
  let panelL: number;
  let borderH: number;
  let borderS: number;
  let borderL: number;

  if (harmonyType === 'complementary') {
    bgH = h; bgS = Math.max(s * 0.15, 3);
    bgL = isDark ? 13 : 95; fgL = isDark ? 85 : 15; fgS = Math.max(s * 0.2, 5);
    panelL = isDark ? 8 : 98;
    borderH = h; borderS = Math.max(s * 0.25, 8); borderL = isDark ? 28 : 75;
  } else if (harmonyType === 'analogous') {
    bgH = (h - 30 + 360) % 360; bgS = Math.max(s * 0.12, 3);
    bgL = isDark ? 14 : 95; fgL = isDark ? 84 : 18; fgS = Math.max(s * 0.15, 5);
    panelL = isDark ? 9 : 97;
    borderH = (h + 30) % 360; borderS = Math.max(s * 0.3, 10); borderL = isDark ? 30 : 72;
  } else if (harmonyType === 'triadic') {
    bgH = (h + 240) % 360; bgS = Math.max(s * 0.1, 2);
    bgL = isDark ? 13 : 96; fgL = isDark ? 86 : 14; fgS = Math.max(s * 0.18, 5);
    panelL = isDark ? 8 : 99;
    borderH = (h + 120) % 360; borderS = Math.max(s * 0.2, 8); borderL = isDark ? 28 : 74;
  } else {
    bgH = h; bgS = Math.max(s * 0.08, 2);
    bgL = isDark ? 12 : 96; fgL = isDark ? 87 : 13; fgS = Math.max(s * 0.15, 5);
    panelL = isDark ? 7 : 99;
    borderH = h; borderS = Math.max(s * 0.2, 6); borderL = isDark ? 26 : 76;
  }

  return {
    bg: hslPartsToHex(bgH, bgS, bgL),
    fg: hslPartsToHex(h, fgS, fgL),
    panel: hslPartsToHex(bgH, bgS * 0.6, panelL),
    border: hslPartsToHex(borderH, borderS, borderL),
    accent: accentHex,
  };
}

function buildHarmonySuggestions(baseHex: string, mode: HarmonyMode): HarmonySuggestion[] {
  const base = hexToHsl(baseHex);
  const isDark = mode === 'dark';
  const configs: { id: HarmonyType; label: string; description: string }[] = [
    { id: 'complementary', label: 'Complementary', description: 'Odysseus-style palette with the accent as the action color and a tuned opposite border family.' },
    { id: 'analogous', label: 'Analogous', description: 'Odysseus-style palette that shifts the shell slightly around nearby hues.' },
    { id: 'triadic', label: 'Triadic', description: 'Odysseus-style palette that balances the shell, border, and accent across three hue lanes.' },
    { id: 'monochromatic', label: 'Monochromatic', description: 'Odysseus-style palette that keeps the whole interface in one restrained color family.' },
  ];

  return configs.map((config) => {
    const generated = generateOdysseusHarmonyBase(baseHex, config.id, mode);
    const accentHover = mixHex(generated.accent, '#ffffff', isDark ? 0.18 : 0.1);
    const accentDim = mixHex(generated.accent, isDark ? generated.bg : '#000000', isDark ? 0.2 : 0.14);
    const raised = mixHex(generated.panel, generated.fg, isDark ? 0.06 : 0.03);
    const hover = mixHex(generated.panel, generated.fg, isDark ? 0.12 : 0.08);
    const active = mixHex(generated.panel, generated.accent, isDark ? 0.16 : 0.14);
    const borderSubtle = mixHex(generated.border, generated.panel, isDark ? 0.36 : 0.22);
    const textSecondary = mixHex(generated.fg, generated.panel, isDark ? 0.34 : 0.4);
    const textMuted = mixHex(generated.fg, generated.panel, isDark ? 0.52 : 0.58);
    const signalLight = isDark ? 58 : 42;
    const signalSat = Math.max(base.s, 48);
    const assignments: HarmonyAssignment[] = [
      { key: '--color-bg-deep', label: colorLabelFor('--color-bg-deep'), value: generated.bg },
      { key: '--color-bg-surface', label: colorLabelFor('--color-bg-surface'), value: generated.panel },
      { key: '--color-bg-raised', label: colorLabelFor('--color-bg-raised'), value: raised },
      { key: '--color-bg-hover', label: colorLabelFor('--color-bg-hover'), value: hover },
      { key: '--color-bg-active', label: colorLabelFor('--color-bg-active'), value: active },
      { key: '--color-border-subtle', label: colorLabelFor('--color-border-subtle'), value: borderSubtle },
      { key: '--color-border-medium', label: colorLabelFor('--color-border-medium'), value: generated.border },
      { key: '--color-text-primary', label: colorLabelFor('--color-text-primary'), value: generated.fg },
      { key: '--color-text-secondary', label: colorLabelFor('--color-text-secondary'), value: textSecondary },
      { key: '--color-text-muted', label: colorLabelFor('--color-text-muted'), value: textMuted },
      { key: '--color-accent', label: colorLabelFor('--color-accent'), value: generated.accent },
      { key: '--color-accent-hover', label: colorLabelFor('--color-accent-hover'), value: accentHover },
      { key: '--color-accent-dim', label: colorLabelFor('--color-accent-dim'), value: accentDim },
      { key: '--color-purple', label: colorLabelFor('--color-purple'), value: accentHover },
      { key: '--color-accent-blue', label: colorLabelFor('--color-accent-blue'), value: hslPartsToHex(base.h - 110, signalSat, signalLight) },
      { key: '--color-accent-green', label: colorLabelFor('--color-accent-green'), value: hslPartsToHex(base.h + 110, signalSat, signalLight) },
      { key: '--color-accent-amber', label: colorLabelFor('--color-accent-amber'), value: hslPartsToHex(base.h + 42, Math.max(base.s, 60), isDark ? 60 : 46) },
      { key: '--color-accent-pink', label: colorLabelFor('--color-accent-pink'), value: hslPartsToHex(base.h + 180, Math.max(base.s, 56), isDark ? 64 : 48) },
    ];

    return {
      ...config,
      preview: [generated.bg, generated.panel, generated.fg, generated.border, generated.accent],
      assignments,
    };
  });
}

function normalizeFontValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 240) return undefined;
  if (/[;{}<>\0]/.test(trimmed)) return undefined;
  return trimmed;
}

function normalizeFontTargets(value: unknown): Partial<Record<AppearanceTypographyTarget, string>> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const result: Partial<Record<AppearanceTypographyTarget, string>> = {};
  for (const { id } of TYPOGRAPHY_TARGETS) {
    const fontValue = normalizeFontValue((value as Partial<Record<AppearanceTypographyTarget, unknown>>)[id]);
    if (fontValue) result[id] = fontValue;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function colorLabelFor(key: AppearanceColorVariable) {
  return PALETTE_PREVIEW_ITEMS.find((item) => item.key === key)?.label
    || APPEARANCE_COLOR_VARIABLES.find((item) => item.key === key)?.label
    || key;
}

function hslToWheelPoint(color: HslColor) {
  const angle = (color.h * Math.PI) / 180;
  const radius = clamp((100 - color.l) / 100, 0, 1) * 50;
  return {
    x: 50 + Math.sin(angle) * radius,
    y: 50 - Math.cos(angle) * radius,
  };
}

function pointerToWheelSelection(event: ReactPointerEvent<HTMLElement>): WheelSelection {
  const rect = event.currentTarget.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const radius = Math.max(1, Math.min(rect.width, rect.height) / 2);
  const rawDistance = Math.sqrt(dx * dx + dy * dy);
  const distance = clamp(rawDistance / radius, 0, 1);
  const unitX = rawDistance === 0 ? 0 : dx / rawDistance;
  const unitY = rawDistance === 0 ? 0 : dy / rawDistance;
  const h = Math.round((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  return {
    color: {
      h,
      s: clamp(Math.round(distance * 160), 0, 100),
      l: clamp(Math.round(100 - distance * 100), 0, 100),
    },
    point: {
      x: 50 + unitX * distance * 50,
      y: 50 + unitY * distance * 50,
    },
  };
}

function fontValue(fontName: string) {
  return `"${fontName.replace(/"/g, '')}", ${FONT_OPTIONS[0].value}`;
}

function normalizeColors(
  source: Record<string, string> | undefined,
  fallback: Record<AppearanceColorVariable, string>,
): Record<AppearanceColorVariable, string> {
  const result = { ...fallback };
  for (const { key } of APPEARANCE_COLOR_VARIABLES) {
    if (isColor(source?.[key])) result[key] = source[key].trim();
  }
  return result;
}

function toDraft(theme: ColorScheme | CustomAppearanceTheme | undefined): ThemeDraft {
  const label = theme && 'label' in theme ? theme.label : theme?.name;
  return {
    id: 'createdAt' in (theme || {}) ? (theme as CustomAppearanceTheme).id : undefined,
    name: label || 'Custom theme',
    swatch: theme?.swatch || '#6366f1',
    fontFamily: (theme as CustomAppearanceTheme | undefined)?.fontFamily,
    fontTargets: (theme as CustomAppearanceTheme | undefined)?.fontTargets,
    dark: normalizeColors(theme?.dark, DEFAULT_DARK_THEME_COLORS),
    light: normalizeColors(theme?.light, DEFAULT_LIGHT_THEME_COLORS),
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string, mimeType: string): Blob | null {
  const match = dataUrl.match(/^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return null;
  const resolvedMime = match[1] || mimeType;
  if (!resolvedMime.startsWith('image/')) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: resolvedMime });
}

function extractThemeBackgroundExport(value: unknown): ThemeBackgroundExport | undefined {
  if (!value || typeof value !== 'object' || !('threatCaddyAppearanceBackgroundImage' in value)) return undefined;
  const raw = (value as { threatCaddyAppearanceBackgroundImage?: unknown }).threatCaddyAppearanceBackgroundImage;
  if (!raw || typeof raw !== 'object') return undefined;
  const candidate = raw as Partial<ThemeBackgroundExport>;
  if (typeof candidate.data !== 'string' || typeof candidate.mimeType !== 'string') return undefined;
  if (!candidate.mimeType.startsWith('image/')) return undefined;
  const size = typeof candidate.size === 'number' && Number.isFinite(candidate.size) ? candidate.size : 0;
  if (size > MAX_IMAGE_SIZE) return undefined;
  const settingsRaw = candidate.settings && typeof candidate.settings === 'object' ? candidate.settings : {};
  const s = settingsRaw as Partial<Settings>;
  return {
    data: candidate.data,
    mimeType: candidate.mimeType,
    size,
    settings: {
      bgImageEnabled: s.bgImageEnabled === false ? false : true,
      bgImageOpacity: typeof s.bgImageOpacity === 'number' ? clamp(s.bgImageOpacity, 0, 100) : undefined,
      bgImagePosX: typeof s.bgImagePosX === 'number' ? clamp(s.bgImagePosX, 0, 100) : undefined,
      bgImagePosY: typeof s.bgImagePosY === 'number' ? clamp(s.bgImagePosY, 0, 100) : undefined,
      bgImageZoom: typeof s.bgImageZoom === 'number' ? clamp(s.bgImageZoom, 50, 200) : undefined,
      bgImageBlur: typeof s.bgImageBlur === 'number' ? clamp(s.bgImageBlur, 0, 40) : undefined,
      bgEffectPattern: isBackgroundEffectPattern(s.bgEffectPattern) ? s.bgEffectPattern : undefined,
      bgEffectColor: isColor(s.bgEffectColor) ? s.bgEffectColor : undefined,
      bgEffectIntensity: typeof s.bgEffectIntensity === 'number' ? clamp(s.bgEffectIntensity, 0, 100) : undefined,
      bgEffectSize: typeof s.bgEffectSize === 'number' ? clamp(s.bgEffectSize, 40, 180) : undefined,
      frostedPanels: typeof s.frostedPanels === 'boolean' ? s.frostedPanels : undefined,
    },
  };
}

async function serializeTheme(theme: CustomAppearanceTheme | CustomAppearanceTheme[], settings: Settings) {
  const bundle: ThemeExportBundle = {
    threatCaddyAppearanceThemes: Array.isArray(theme) ? theme : [theme],
  };
  const backgroundBlob = await loadBgImageBlob();
  if (backgroundBlob && backgroundBlob.size <= MAX_IMAGE_SIZE && backgroundBlob.type.startsWith('image/')) {
    bundle.threatCaddyAppearanceBackgroundImage = {
      data: await blobToDataUrl(backgroundBlob),
      mimeType: backgroundBlob.type,
      size: backgroundBlob.size,
      settings: {
        bgImageEnabled: settings.bgImageEnabled,
        bgImageOpacity: settings.bgImageOpacity,
        bgImagePosX: settings.bgImagePosX,
        bgImagePosY: settings.bgImagePosY,
        bgImageZoom: settings.bgImageZoom,
        bgImageBlur: settings.bgImageBlur,
        bgEffectPattern: settings.bgEffectPattern,
        bgEffectColor: settings.bgEffectColor,
        bgEffectIntensity: settings.bgEffectIntensity,
        bgEffectSize: settings.bgEffectSize,
        frostedPanels: settings.frostedPanels,
      },
    };
  }
  return JSON.stringify(bundle, null, 2);
}

function downloadJson(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseImportedThemes(value: unknown): CustomAppearanceTheme[] {
  const raw = value && typeof value === 'object' && 'threatCaddyAppearanceThemes' in value
    ? (value as { threatCaddyAppearanceThemes: unknown }).threatCaddyAppearanceThemes
    : value;
  const items = Array.isArray(raw) ? raw : [raw];
  return items.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Partial<CustomAppearanceTheme>;
    const name = typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name.trim() : 'Imported theme';
    const swatch = isColor(candidate.swatch) ? candidate.swatch : '#6366f1';
    const timestamp = Date.now();
    return [{
      id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id.trim() : nowId(),
      name,
      swatch,
      fontFamily: normalizeFontValue(candidate.fontFamily),
      fontTargets: normalizeFontTargets(candidate.fontTargets),
      dark: normalizeColors(candidate.dark, DEFAULT_DARK_THEME_COLORS),
      light: normalizeColors(candidate.light, DEFAULT_LIGHT_THEME_COLORS),
      createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : timestamp,
      updatedAt: timestamp,
    }];
  });
}

export function AppearanceSettings({ settings, onUpdateSettings }: AppearanceSettingsProps) {
  const { t } = useTranslation('settings');
  const { addToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const paletteEditorIdRef = useRef(0);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingTheme, setEditingTheme] = useState(false);
  const [draft, setDraft] = useState<ThemeDraft>(() => toDraft(COLOR_SCHEMES[0]));
  const [draftMode, setDraftMode] = useState<'dark' | 'light'>('dark');
  const [paletteEditor, setPaletteEditor] = useState<PaletteEditorState | null>(null);
  const [dragStart, setDragStart] = useState<{ pointerId: number; x: number; y: number; originX: number; originY: number } | null>(null);
  const [wheelPointerId, setWheelPointerId] = useState<number | null>(null);
  const [wheelLoupe, setWheelLoupe] = useState<WheelLoupeState>({ x: 50, y: 50, color: '#ffffff', visible: false });
  const [previewPickMode, setPreviewPickMode] = useState(false);
  const [previewSampleEditorId, setPreviewSampleEditorId] = useState<number | null>(null);
  const [typographyTarget, setTypographyTarget] = useState<AppearanceTypographyTarget>('interface');
  const [localFonts, setLocalFonts] = useState<{ id: string; label: string; value: string }[]>([]);
  const [customFontName, setCustomFontName] = useState('');
  const [appearanceLabTab, setAppearanceLabTab] = useState<'themes' | 'customize'>('themes');
  const [showAdvancedColors, setShowAdvancedColors] = useState(false);
  const [selectedHarmonyId, setSelectedHarmonyId] = useState<string>('complementary');
  const [harmonyAccentHex, setHarmonyAccentHex] = useState('#6366f1');
  const [harmonyMode, setHarmonyMode] = useState<HarmonyMode>(settings.theme ?? 'dark');

  const customThemes = settings.customAppearanceThemes ?? [];
  const scheme = settings.colorScheme ?? 'indigo';
  const selectedBuiltin = COLOR_SCHEMES.find((theme) => theme.id === scheme);
  const selectedOdysseusBuiltin = ODYSSEUS_COLOR_SCHEMES.find((theme) => theme.id === scheme);
  const selectedCustom = customThemes.find((theme) => theme.id === scheme);
  const selectedTheme = selectedBuiltin || selectedOdysseusBuiltin || selectedCustom || COLOR_SCHEMES[0];
  const activeDraft = editingTheme ? draft : toDraft(selectedTheme);
  const activeModeColors = activeDraft[draftMode];
  const runtimeThemeMode = settings.theme ?? 'dark';
  const runtimeModeColors = activeDraft[runtimeThemeMode];
  const bgOverlayOpacity = clamp(settings.bgImageOpacity ?? 85, 0, 100);
  const bgTransparency = 100 - bgOverlayOpacity;
  const bgBlur = clamp(settings.bgImageBlur ?? 0, 0, 40);
  const panelTransparency = clamp(settings.windowGlassTransparency ?? 0, 0, 100);
  const panelBlur = clamp(settings.windowGlassBlur ?? 0, 0, 40);
  const zoom = settings.bgImageZoom ?? 100;
  const posX = settings.bgImagePosX ?? 50;
  const posY = settings.bgImagePosY ?? 50;
  const bgEnabled = settings.bgImageEnabled ?? false;
  const showBackgroundControls = Boolean(bgPreview || bgEnabled);
  const bgEffectPattern = isBackgroundEffectPattern(settings.bgEffectPattern) ? settings.bgEffectPattern : 'none';
  const fallbackBgEffectColor = getPaletteEffectColor(bgEffectPattern, runtimeModeColors) ?? runtimeModeColors['--color-text-primary'];
  const bgEffectColor = isColor(settings.bgEffectColor) ? settings.bgEffectColor : fallbackBgEffectColor;
  const bgEffectIntensity = clamp(settings.bgEffectIntensity ?? 60, 0, 100);
  const bgEffectSize = clamp(settings.bgEffectSize ?? 100, 40, 180);
  const themeEffectColor = getPaletteEffectColor(bgEffectPattern, runtimeModeColors) ?? runtimeModeColors['--color-accent'];
  const bgEffectHsl = hexToHsl(bgEffectColor);
  const frostedPanels = settings.frostedPanels ?? false;
  const fontFamily = settings.appearanceFontFamily || selectedCustom?.fontFamily || FONT_OPTIONS[0].value;
  const fontTargets = settings.appearanceFontTargets ?? selectedCustom?.fontTargets ?? {};
  const fontScale = settings.appearanceFontScale ?? 100;
  const sidebarAccentStyle = settings.sidebarAccentStyle ?? 'default';
  const harmonySuggestions = useMemo(() => buildHarmonySuggestions(harmonyAccentHex, harmonyMode), [harmonyAccentHex, harmonyMode]);
  const selectedHarmony = harmonySuggestions.find((suggestion) => suggestion.id === selectedHarmonyId) || harmonySuggestions[0];
  const nativeEyeDropperSupported = typeof window !== 'undefined'
    && typeof (window as Window & { EyeDropper?: unknown }).EyeDropper === 'function';
  const previewSamplingActive = paletteEditor !== null && previewSampleEditorId === paletteEditor.id;
  const exportableCustomThemes = customThemes.map((theme) => (
    theme.id === scheme ? { ...theme, fontFamily, fontTargets } : theme
  ));
  const allFontOptions = useMemo(() => {
    const seen = new Set<string>();
    return [
      ...FONT_OPTIONS,
      ...COMMON_LOCAL_FONTS.map((font) => ({ id: `common-${font}`, label: font, value: fontValue(font) })),
      ...localFonts,
    ].filter((font) => {
      if (seen.has(font.value)) return false;
      seen.add(font.value);
      return true;
    });
  }, [localFonts]);

  useEffect(() => {
    let revoke: string | null = null;
    loadBgImage().then((url) => {
      if (url) { revoke = url; setBgPreview(url); }
    });
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, []);

  useEffect(() => {
    const fontNavigator = navigator as Navigator & {
      queryLocalFonts?: () => Promise<{ family: string; fullName?: string }[]>;
    };
    if (!fontNavigator.queryLocalFonts) return;
    fontNavigator.queryLocalFonts()
      .then((fonts) => {
        const families = [...new Set(fonts.map((font) => font.family).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        setLocalFonts(families.map((family) => ({ id: `local-${family}`, label: family, value: fontValue(family) })));
      })
      .catch(() => {
        // Browsers may require a user gesture or may not expose local font enumeration.
      });
  }, []);

  useEffect(() => {
    setHarmonyAccentHex(activeModeColors['--color-accent']);
  }, [activeModeColors['--color-accent']]);

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addToast('error', t('appearance.errorNotImage'));
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      addToast('error', t('appearance.errorTooLarge'));
      return;
    }
    setLoading(true);
    try {
      await saveBgImage(file);
      if (bgPreview) URL.revokeObjectURL(bgPreview);
      const url = URL.createObjectURL(file);
      setBgPreview(url);
      onUpdateSettings({ bgImageEnabled: true });
      addToast('success', t('appearance.bgSet'));
    } catch {
      addToast('error', t('appearance.bgSaveFailed'));
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemoveImage = async () => {
    try {
      await removeBgImage();
      if (bgPreview) URL.revokeObjectURL(bgPreview);
      setBgPreview(null);
      onUpdateSettings({ bgImageEnabled: false });
      addToast('success', t('appearance.bgRemoved'));
    } catch {
      addToast('error', t('appearance.bgRemoveFailed'));
    }
  };

  const resetPosition = () => onUpdateSettings({ bgImagePosX: 50, bgImagePosY: 50, bgImageZoom: 100 });
  const resetAmbientMotion = () => onUpdateSettings({
    bgEffectPattern: 'none',
    bgEffectColor: undefined,
    bgEffectIntensity: 60,
    bgEffectSize: 100,
    frostedPanels: false,
  });

  const startCreateTheme = () => {
    const selectedLabel = 'label' in selectedTheme ? selectedTheme.label : selectedTheme.name;
    setDraft({ ...toDraft(selectedTheme), id: undefined, name: `${selectedLabel || 'Theme'} copy`, fontFamily, fontTargets });
    setEditingTheme(true);
  };

  const startEditTheme = (theme: CustomAppearanceTheme) => {
    setDraft(toDraft(theme));
    setEditingTheme(true);
  };

  const setDraftColor = (key: AppearanceColorVariable, value: string) => {
    setDraft((prev) => ({ ...prev, [draftMode]: { ...prev[draftMode], [key]: value } }));
  };

  const saveTheme = () => {
    const timestamp = Date.now();
    const theme: CustomAppearanceTheme = {
      id: draft.id || nowId(),
      name: draft.name.trim() || 'Custom theme',
      swatch: isColor(draft.swatch) ? draft.swatch : draft.dark['--color-accent'],
      fontFamily: draft.fontFamily,
      fontTargets: draft.fontTargets,
      dark: draft.dark,
      light: draft.light,
      createdAt: customThemes.find((existing) => existing.id === draft.id)?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    const exists = customThemes.some((existing) => existing.id === theme.id);
    const next = exists
      ? customThemes.map((existing) => existing.id === theme.id ? theme : existing)
      : [...customThemes, theme];
    onUpdateSettings({
      customAppearanceThemes: next,
      colorScheme: theme.id,
      appearanceFontFamily: theme.fontFamily || settings.appearanceFontFamily,
      appearanceFontTargets: theme.fontTargets || settings.appearanceFontTargets,
    });
    setEditingTheme(false);
    addToast('success', exists ? 'Theme updated.' : 'Theme saved.');
  };

  const deleteTheme = (id: string) => {
    const next = customThemes.filter((theme) => theme.id !== id);
    onUpdateSettings({ customAppearanceThemes: next, colorScheme: scheme === id ? 'indigo' : scheme });
    addToast('success', 'Theme deleted.');
  };

  const selectTheme = (theme: ColorScheme | CustomAppearanceTheme) => {
    const nextMode = 'preferredTheme' in theme && theme.preferredTheme ? theme.preferredTheme : runtimeThemeMode;
    const nextColors = theme[nextMode];
    const updates: Partial<Settings> = {
      colorScheme: theme.id,
      ...resolveOdysseusVisualDefaults(theme.id, nextColors),
    };
    if ('preferredTheme' in theme && theme.preferredTheme) {
      updates.theme = theme.preferredTheme;
    }
    if ('fontFamily' in theme && theme.fontFamily) {
      updates.appearanceFontFamily = theme.fontFamily;
    }
    if ('fontTargets' in theme && theme.fontTargets) {
      updates.appearanceFontTargets = theme.fontTargets;
    }
    onUpdateSettings(updates);
  };

  const selectBackgroundEffect = (pattern: BackgroundEffectPattern) => {
    onUpdateSettings({
      bgEffectPattern: pattern,
      bgEffectColor: getPaletteEffectColor(pattern, runtimeModeColors),
    });
  };

  const applyThemeEffectColor = () => {
    onUpdateSettings({ bgEffectColor: themeEffectColor });
  };

  const setBackgroundEffectHsl = (patch: Partial<HslColor>) => {
    const next = {
      h: patch.h ?? bgEffectHsl.h,
      s: patch.s ?? bgEffectHsl.s,
      l: patch.l ?? bgEffectHsl.l,
    };
    onUpdateSettings({ bgEffectColor: hslToHex(next) });
  };

  const handleImportThemes = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const imported = parseImportedThemes(parsed);
      if (imported.length === 0) throw new Error('No themes found');
      const usedIds = new Set([
        ...ALL_BUILTIN_COLOR_SCHEMES.map((theme) => theme.id),
        ...customThemes.map((theme) => theme.id),
      ]);
      const deduped = imported.map((theme) => {
        const id = usedIds.has(theme.id) ? nowId() : theme.id;
        usedIds.add(id);
        return id === theme.id ? theme : { ...theme, id };
      });
      const updates: Partial<Settings> = {
        customAppearanceThemes: [...customThemes, ...deduped],
        colorScheme: deduped[0].id,
        appearanceFontFamily: deduped[0].fontFamily || settings.appearanceFontFamily,
        appearanceFontTargets: deduped[0].fontTargets || settings.appearanceFontTargets,
      };
      const background = extractThemeBackgroundExport(parsed);
      if (background) {
        const blob = dataUrlToBlob(background.data, background.mimeType);
        if (blob && blob.size <= MAX_IMAGE_SIZE) {
          await saveBgImage(blob);
          if (bgPreview) URL.revokeObjectURL(bgPreview);
          setBgPreview(URL.createObjectURL(blob));
          Object.assign(updates, background.settings, { bgImageEnabled: background.settings.bgImageEnabled ?? true });
        }
      }
      onUpdateSettings(updates);
      addToast('success', `Imported ${deduped.length} theme${deduped.length === 1 ? '' : 's'}.`);
    } catch {
      addToast('error', 'Could not import that theme file.');
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  };

  const exportSelectedTheme = async () => {
    const theme = selectedCustom;
    if (!theme) {
      saveTheme();
      return;
    }
    downloadJson(`${theme.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'theme'}.json`, await serializeTheme({ ...theme, fontFamily, fontTargets }, settings));
  };

  const beginThemeFromCurrent = () => {
    const selectedLabel = 'label' in selectedTheme ? selectedTheme.label : selectedTheme.name;
    setDraft({
      ...toDraft(selectedTheme),
      id: undefined,
      name: `${selectedLabel || 'Theme'} copy`,
      fontFamily,
      fontTargets,
    });
    setEditingTheme(true);
  };

  const updateCurrentTheme = () => {
    if (!selectedCustom) {
      beginThemeFromCurrent();
      return;
    }
    const timestamp = Date.now();
    const nextTheme: CustomAppearanceTheme = {
      ...selectedCustom,
      fontFamily,
      fontTargets,
      dark: normalizeColors(selectedCustom.dark, DEFAULT_DARK_THEME_COLORS),
      light: normalizeColors(selectedCustom.light, DEFAULT_LIGHT_THEME_COLORS),
      updatedAt: timestamp,
    };
    onUpdateSettings({
      customAppearanceThemes: customThemes.map((theme) => theme.id === selectedCustom.id ? nextTheme : theme),
      appearanceFontFamily: fontFamily,
      appearanceFontTargets: fontTargets,
    });
    addToast('success', 'Theme updated.');
  };

  const applyDraftToCurrent = (nextDraft: ThemeDraft) => {
    if (editingTheme) {
      setDraft(nextDraft);
      return;
    }
    const timestamp = Date.now();
    const themeId = selectedCustom?.id || nowId();
    const themeName = selectedCustom?.name || `${'label' in selectedTheme ? selectedTheme.label : selectedTheme.name} custom`;
    const nextTheme: CustomAppearanceTheme = {
      id: themeId,
      name: themeName,
      swatch: isColor(nextDraft.swatch) ? nextDraft.swatch : nextDraft.dark['--color-accent'],
      fontFamily,
      fontTargets,
      dark: nextDraft.dark,
      light: nextDraft.light,
      createdAt: selectedCustom?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    const nextThemes = selectedCustom
      ? customThemes.map((theme) => theme.id === selectedCustom.id ? nextTheme : theme)
      : [...customThemes, nextTheme];
    onUpdateSettings({
      customAppearanceThemes: nextThemes,
      colorScheme: nextTheme.id,
      appearanceFontTargets: fontTargets,
    });
  };

  const openColorEditor = (target: PaletteEditorTarget, label: string, color: string) => {
    const value = isColor(color) ? color : '#ffffff';
    setPreviewSampleEditorId(null);
    setPaletteEditor({
      id: paletteEditorIdRef.current += 1,
      target,
      label,
      value,
      draftValue: value,
      inputValue: value,
      position: { x: 360, y: 160 },
    });
    setPreviewPickMode(false);
  };

  const closePaletteEditor = () => {
    setPaletteEditor(null);
    setPreviewSampleEditorId(null);
    setPreviewPickMode(false);
  };

  const togglePreviewPickMode = () => {
    setPreviewSampleEditorId(null);
    setPreviewPickMode((active) => !active);
  };

  const openPaletteEditor = (key: AppearanceColorVariable, label: string) => {
    const mode = draftMode;
    openColorEditor(
      { kind: 'theme-color', key, mode },
      label,
      activeDraft[mode][key] || DEFAULT_DARK_THEME_COLORS[key] || '#ffffff',
    );
  };

  const openDraftColorEditor = (key: AppearanceColorVariable, label: string) => {
    const mode = draftMode;
    openColorEditor({ kind: 'draft-color', key, mode }, label, draft[mode][key] || '#ffffff');
  };

  const openDraftSwatchEditor = () => {
    openColorEditor({ kind: 'draft-swatch' }, 'Theme swatch', draft.swatch || draft.dark['--color-accent']);
  };

  const openHarmonyAccentEditor = () => {
    openColorEditor({ kind: 'harmony-accent' }, 'Color Harmony accent', harmonyAccentHex);
  };

  const openBackgroundEffectColorEditor = () => {
    openColorEditor({ kind: 'background-effect-color' }, 'Background effect color', bgEffectColor);
  };

  const paletteEditorTargetsThemeKey = (key: AppearanceColorVariable) => (
    paletteEditor?.target.kind === 'theme-color'
    && paletteEditor.target.key === key
    && paletteEditor.target.mode === draftMode
  );

  const setPaletteDraftValue = (value: string) => {
    const normalized = normalizeHexInput(value);
    if (!isColor(normalized)) return;
    setPaletteEditor((prev) => prev ? { ...prev, draftValue: normalized, inputValue: normalized } : prev);
  };

  const setPaletteDraftValueForEditor = (editorId: number, value: string) => {
    const normalized = normalizeHexInput(value);
    if (!isColor(normalized)) return;
    setPaletteEditor((prev) => prev?.id === editorId ? { ...prev, draftValue: normalized, inputValue: normalized } : prev);
  };

  const setPaletteInputValue = (value: string) => {
    const normalized = normalizeHexInput(value);
    setPaletteEditor((prev) => prev ? {
      ...prev,
      inputValue: value,
      draftValue: isColor(normalized) ? normalized : prev.draftValue,
    } : prev);
  };

  const applyPaletteEditor = () => {
    if (!paletteEditor) return;
    const normalizedInput = normalizeHexInput(paletteEditor.inputValue);
    const nextValue = isColor(normalizedInput) ? normalizedInput : paletteEditor.draftValue;
    if (!isColor(nextValue)) {
      addToast('error', 'Use a valid six-character hex color.');
      return;
    }
    const { target } = paletteEditor;
    if (target.kind === 'theme-color') {
      const nextDraft = {
        ...activeDraft,
        [target.mode]: {
          ...activeDraft[target.mode],
          [target.key]: nextValue,
        },
        swatch: target.key === '--color-accent' ? nextValue : activeDraft.swatch,
      };
      applyDraftToCurrent(nextDraft);
    } else if (target.kind === 'draft-color') {
      setDraft((prev) => ({
        ...prev,
        [target.mode]: {
          ...prev[target.mode],
          [target.key]: nextValue,
        },
      }));
    } else if (target.kind === 'draft-swatch') {
      setDraft((prev) => ({ ...prev, swatch: nextValue }));
    } else if (target.kind === 'harmony-accent') {
      setHarmonyAccentHex(nextValue);
    } else {
      onUpdateSettings({ bgEffectColor: nextValue });
    }
    closePaletteEditor();
  };

  const useEyeDropper = async () => {
    if (!paletteEditor) return;
    const win = window as Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } };
    if (!win.EyeDropper) {
      setPreviewSampleEditorId(paletteEditor.id);
      setPreviewPickMode(true);
      addToast('info', 'Click a live preview part to sample that color.');
      return;
    }
    const editorId = paletteEditor.id;
    try {
      const result = await new win.EyeDropper().open();
      setPaletteDraftValueForEditor(editorId, result.sRGBHex);
    } catch {
      // User cancelled the picker.
    }
  };

  const handlePreviewColorTarget = (key: AppearanceColorVariable, label: string) => {
    if (paletteEditor && previewSampleEditorId === paletteEditor.id) {
      const value = activeModeColors[key] || DEFAULT_DARK_THEME_COLORS[key] || DEFAULT_LIGHT_THEME_COLORS[key] || '#ffffff';
      setPaletteDraftValueForEditor(paletteEditor.id, value);
      setPreviewSampleEditorId(null);
      setPreviewPickMode(false);
      return;
    }
    openPaletteEditor(key, label);
  };

  const setPaletteHsl = (patch: Partial<HslColor>) => {
    if (!paletteEditor) return;
    const current = hexToHsl(paletteEditor.draftValue);
    const next = {
      h: patch.h ?? current.h,
      s: patch.s ?? current.s,
      l: patch.l ?? current.l,
    };
    setPaletteDraftValue(hslToHex(next));
  };

  const updateWheelFromPointer = (event: ReactPointerEvent<HTMLElement>, shouldSelect: boolean) => {
    const selection = pointerToWheelSelection(event);
    const color = hslToHex(selection.color);
    setWheelLoupe({ ...selection.point, color, visible: true });
    if (shouldSelect) setPaletteDraftValue(color);
  };

  const choosePaletteWheelColor = (event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setWheelPointerId(event.pointerId);
    updateWheelFromPointer(event, true);
  };

  const dragPaletteWheelColor = (event: ReactPointerEvent<HTMLElement>) => {
    updateWheelFromPointer(event, wheelPointerId === event.pointerId);
  };

  const endPaletteWheelSelection = (event: ReactPointerEvent<HTMLElement>) => {
    if (wheelPointerId === event.pointerId) setWheelPointerId(null);
  };

  const beginDragPalette = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!paletteEditor) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragStart({
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      originX: paletteEditor.position.x,
      originY: paletteEditor.position.y,
    });
  };

  const dragPalette = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!paletteEditor || !dragStart || dragStart.pointerId !== event.pointerId) return;
    setPaletteEditor({
      ...paletteEditor,
      position: {
        x: clamp(dragStart.originX + event.clientX - dragStart.x, 16, window.innerWidth - 340),
        y: clamp(dragStart.originY + event.clientY - dragStart.y, 16, window.innerHeight - 320),
      },
    });
  };

  const setTypographyFont = (target: AppearanceTypographyTarget, value: string) => {
    if (target === 'interface') {
      onUpdateSettings({ appearanceFontFamily: value });
      return;
    }
    onUpdateSettings({ appearanceFontTargets: { ...fontTargets, [target]: value } });
  };

  const addCustomFont = () => {
    const name = customFontName.trim();
    if (!name) return;
    const value = fontValue(name);
    setLocalFonts((prev) => prev.some((font) => font.value === value) ? prev : [...prev, { id: `manual-${name}`, label: name, value }]);
    setTypographyFont(typographyTarget, value);
    setCustomFontName('');
  };

  const applyHarmonyAssignments = (assignments: HarmonyAssignment[]) => {
    const nextModeColors = { ...activeDraft[harmonyMode] };
    for (const assignment of assignments) nextModeColors[assignment.key] = assignment.value;
    applyDraftToCurrent({
      ...activeDraft,
      [harmonyMode]: nextModeColors,
      swatch: nextModeColors['--color-accent'],
    });
    setDraftMode(harmonyMode);
    addToast('success', `Harmony generated for ${harmonyMode} mode.`);
  };

  const applyHarmonyField = (assignment: HarmonyAssignment) => {
    const nextModeColors = { ...activeDraft[harmonyMode], [assignment.key]: assignment.value };
    applyDraftToCurrent({
      ...activeDraft,
      [harmonyMode]: nextModeColors,
      swatch: assignment.key === '--color-accent' ? assignment.value : activeDraft.swatch,
    });
    setDraftMode(harmonyMode);
  };

  const previewNavItems: { label: string; field: AppearanceColorVariable; accentField: AppearanceColorVariable; active?: boolean }[] = [
    { label: 'Dashboard', field: '--color-bg-active', accentField: '--color-purple', active: true },
    { label: 'Investigations', field: '--color-text-secondary', accentField: '--color-purple' },
    { label: 'Notes', field: '--color-accent-blue', accentField: '--color-accent-blue' },
    { label: 'Tasks', field: '--color-accent-amber', accentField: '--color-accent-amber' },
    { label: 'CaddyAI', field: '--color-purple', accentField: '--color-purple' },
  ];
  const primaryColorFields: { key: AppearanceColorVariable; label: string }[] = [
    { key: '--color-bg-deep', label: 'Background' },
    { key: '--color-bg-surface', label: 'Panel' },
    { key: '--color-border-medium', label: 'Border' },
    { key: '--color-text-primary', label: 'Text' },
    { key: '--color-bg-active', label: 'Sidebar' },
    { key: '--color-accent', label: 'Accent' },
  ];

  const renderPreviewNavItem = ({
    label,
    field,
    accentField,
    active = false,
  }: {
    label: string;
    field: AppearanceColorVariable;
    accentField: AppearanceColorVariable;
    active?: boolean;
  }) => (
    <button
      key={label}
      onClick={() => handlePreviewColorTarget(field, label === 'Dashboard' ? 'Selected navigation' : `${label} navigation accent`)}
      className={cn(
        'flex w-full items-center gap-2 rounded-md text-left text-xs transition-colors',
        sidebarAccentStyle === 'color-chips'
          ? active
            ? 'border border-border-medium bg-bg-active px-2 py-1.5 font-medium shadow-[0_10px_22px_rgba(0,0,0,0.16)]'
            : 'border border-transparent px-2 py-1.5 hover:border-border-subtle hover:bg-bg-hover'
          : active
            ? 'px-2 py-1.5 font-medium'
            : 'px-2 py-1.5'
      )}
      style={{ color: active ? activeModeColors['--color-text-primary'] : activeModeColors[field] }}
    >
      {sidebarAccentStyle === 'color-chips' ? (
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-2xl border"
          style={{
            borderColor: activeModeColors[accentField],
            color: activeModeColors[accentField],
            backgroundColor: active ? activeModeColors['--color-bg-active'] : activeModeColors['--color-bg-surface'],
          }}
        >
          <span className="h-2.5 w-2.5 rounded-[6px] border" style={{ borderColor: activeModeColors[accentField] }} />
        </span>
      ) : (
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: active ? activeModeColors['--color-accent'] : activeModeColors['--color-border-medium'] }}
        />
      )}
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-300">
              <Palette size={15} /> ThreatCaddy Appearance
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              ThreatCaddy themes, imported Odysseus presets, and a harmony tool that expands into real ThreatCaddy color fields.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => importRef.current?.click()} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-400 hover:bg-gray-800 hover:text-gray-200">
              <Upload size={13} /> Import
            </button>
            {customThemes.length > 0 && (
              <button onClick={async () => downloadJson('threatcaddy-themes.json', await serializeTheme(exportableCustomThemes, settings))} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-400 hover:bg-gray-800 hover:text-gray-200">
                <Download size={13} /> Export all
              </button>
            )}
          </div>
        </div>

        <div className="inline-flex rounded-lg border border-gray-700 bg-gray-950 p-0.5">
          {([
            { id: 'themes', label: 'Themes' },
            { id: 'customize', label: 'Customize' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setAppearanceLabTab(tab.id)}
              className={`rounded-md px-3 py-1 text-xs ${appearanceLabTab === tab.id ? 'bg-gray-700 text-gray-100' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {appearanceLabTab === 'themes' ? (
          <>
            <div className="space-y-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">ThreatCaddy themes</div>
                <p className="mt-1 text-xs text-gray-500">Native palettes tuned for ThreatCaddy&apos;s master theme, panels, and navigation accents.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {COLOR_SCHEMES.map((theme) => (
                  <div key={theme.id} className={`rounded-lg border p-2 transition-colors ${scheme === theme.id ? 'border-accent bg-accent/10' : 'border-gray-700/80 bg-gray-900/30'}`}>
                    <button onClick={() => selectTheme(theme)} className="flex w-full items-center gap-2 text-left">
                      <span className="h-4 w-4 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: theme.swatch }} />
                      <span className="min-w-0 flex-1 truncate text-sm text-gray-200">{theme.label}</span>
                      {scheme === theme.id && <Check size={14} className="text-accent" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">Odysseus themes</div>
                <p className="mt-1 text-xs text-gray-500">Imported from the Odysseus repo preset table, including the original, paper, midnight, GPT, Claude, and expressive variants.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {ODYSSEUS_COLOR_SCHEMES.map((theme) => (
                  <div key={theme.id} className={`rounded-lg border p-2 transition-colors ${scheme === theme.id ? 'border-accent bg-accent/10' : 'border-gray-700/80 bg-gray-900/30'}`}>
                    <button onClick={() => selectTheme(theme)} className="flex w-full items-center gap-2 text-left">
                      <span className="h-4 w-4 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: theme.swatch }} />
                      <span className="min-w-0 flex-1 truncate text-sm text-gray-200">{theme.label}</span>
                      <span className="rounded-full border border-gray-700 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.16em] text-gray-500">{theme.preferredTheme}</span>
                      {scheme === theme.id && <Check size={14} className="text-accent" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">Created themes</span>
                <button onClick={updateCurrentTheme} className="flex items-center gap-1 rounded-md border border-gray-700 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-gray-800">
                  <Save size={13} /> Update Theme
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {customThemes.map((theme) => (
                  <div key={theme.id} className={`rounded-lg border p-2 transition-colors ${scheme === theme.id ? 'border-accent bg-accent/10' : 'border-gray-700/80 bg-gray-900/30'}`}>
                    <button onClick={() => selectTheme(theme)} className="flex w-full items-center gap-2 text-left">
                      <span className="h-4 w-4 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: theme.swatch }} />
                      <span className="min-w-0 flex-1 truncate text-sm text-gray-200">{theme.name}</span>
                      {scheme === theme.id && <Check size={14} className="text-accent" />}
                    </button>
                    <div className="mt-2 flex items-center gap-1 border-t border-gray-800 pt-2">
                      <button onClick={() => startEditTheme(theme)} className="p-1 text-gray-500 hover:text-gray-200" title="Edit theme" aria-label={`Edit ${theme.name} theme`}><Pencil size={12} /></button>
                      <button onClick={async () => downloadJson(`${theme.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'theme'}.json`, await serializeTheme(theme, settings))} className="p-1 text-gray-500 hover:text-gray-200" title="Export theme" aria-label={`Export ${theme.name} theme`}><Download size={12} /></button>
                      <button onClick={() => deleteTheme(theme.id)} className="p-1 text-gray-500 hover:text-red-400" title="Delete theme" aria-label={`Delete ${theme.name} theme`}><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
                <button onClick={startCreateTheme} className="flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-700/80 bg-gray-900/30 p-2 text-left transition-colors hover:border-gray-500 hover:bg-gray-800/60">
                  <span className="h-4 w-4 shrink-0 rounded-full border border-gray-500 bg-white" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-200">+ Create New</span>
                </button>
              </div>
            </div>

            {editingTheme && (
              <div className="space-y-4 rounded-xl border border-gray-700/80 bg-gray-900/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Copy size={15} className="text-gray-500" />
                    <input
                      value={draft.name}
                      onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                      className="min-w-0 flex-1 rounded border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm text-gray-100 focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={saveTheme} className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-white hover:brightness-110">
                      <Save size={13} /> {draft.id ? 'Update' : 'Save'}
                    </button>
                    <button onClick={() => setEditingTheme(false)} className="p-1.5 text-gray-500 hover:text-gray-200"><X size={14} /></button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                  <label className="space-y-1">
                    <span className="text-xs text-gray-400">Theme font</span>
                    <select
                      value={draft.fontFamily || ''}
                      onChange={(e) => setDraft((prev) => ({ ...prev, fontFamily: e.target.value || undefined }))}
                      className="w-full rounded border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm text-gray-200 focus:border-accent focus:outline-none"
                    >
                      <option value="">Use global font</option>
                      {allFontOptions.map((font) => <option key={font.id} value={font.value}>{font.label}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-gray-400">Swatch</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Theme swatch color"
                        value={draft.swatch}
                        onChange={(e) => setDraft((prev) => ({ ...prev, swatch: e.target.value }))}
                        className="h-9 min-w-0 flex-1 rounded border border-gray-700 bg-gray-950"
                      />
                      <button
                        type="button"
                        onClick={openDraftSwatchEditor}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-700 text-gray-300 transition-colors hover:bg-gray-800"
                        aria-label="Edit theme swatch color"
                        title="Edit theme swatch color"
                      >
                        <Pipette size={14} />
                      </button>
                    </div>
                  </label>
                </div>

                <div className="inline-flex rounded-lg border border-gray-700 bg-gray-950 p-0.5">
                  {(['dark', 'light'] as const).map((mode) => (
                    <button key={mode} onClick={() => setDraftMode(mode)} className={`rounded-md px-3 py-1 text-xs capitalize ${draftMode === mode ? 'bg-gray-700 text-gray-100' : 'text-gray-500 hover:text-gray-300'}`}>
                      {mode}
                    </button>
                  ))}
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  {APPEARANCE_COLOR_VARIABLES.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2 rounded-lg border border-gray-800 bg-black/10 px-2 py-1.5">
                      <input
                        type="color"
                        aria-label={`${label} color`}
                        value={draft[draftMode][key]}
                        onChange={(e) => setDraftColor(key, e.target.value)}
                        className="h-7 w-8 shrink-0 rounded border border-gray-700 bg-transparent"
                      />
                      <span className="min-w-0 flex-1 text-xs text-gray-300">{label}</span>
                      <span className="font-mono text-[10px] text-gray-500">{draft[draftMode][key]}</span>
                      <button
                        type="button"
                        onClick={() => openDraftColorEditor(key, label)}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-700 text-gray-300 transition-colors hover:bg-gray-800"
                        aria-label={`Edit ${label} color`}
                        title={`Edit ${label} color`}
                      >
                        <Pipette size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!editingTheme && (
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={startCreateTheme} className="flex items-center gap-1 rounded-md border border-gray-700 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-gray-800">
                  <Copy size={13} /> Duplicate current
                </button>
                <button onClick={exportSelectedTheme} className="flex items-center gap-1 rounded-md border border-gray-700 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-gray-800">
                  <Download size={13} /> Export selected
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="space-y-4 rounded-xl border border-gray-700/70 bg-gray-900/40 p-4">
              <div>
                <div className="text-sm font-semibold text-gray-200">Colors</div>
                <p className="mt-1 text-[11px] text-gray-500">Use the Odysseus-style quick color fields first, then expand into the rest of ThreatCaddy if you want finer control.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {primaryColorFields.map((field) => (
                  <button
                    key={field.key}
                    onClick={() => openPaletteEditor(field.key, field.label)}
                    className="flex items-center justify-between rounded-lg border border-gray-800 bg-black/10 px-3 py-2 text-left transition-colors hover:border-gray-600"
                  >
                    <span className="text-sm text-gray-300">{field.label}</span>
                    <span className="h-7 w-7 rounded-full border border-white/15" style={{ backgroundColor: activeModeColors[field.key] }} />
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button onClick={() => setShowAdvancedColors((current) => !current)} className="rounded-md border border-gray-700 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-gray-800">
                  {showAdvancedColors ? 'Hide More Colors' : 'More Colors'}
                </button>
                <div className="inline-flex rounded-lg border border-gray-700 bg-gray-950 p-0.5">
                  {([
                    { id: 'default', label: 'Default' },
                    { id: 'color-chips', label: 'Color Chips' },
                  ] as { id: SidebarAccentStyle; label: string }[]).map((option) => (
                    <button
                      key={option.id}
                      onClick={() => onUpdateSettings({ sidebarAccentStyle: option.id })}
                      className={`rounded-md px-3 py-1 text-xs ${sidebarAccentStyle === option.id ? 'bg-gray-700 text-gray-100' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {showAdvancedColors && (
                <div className="space-y-3 border-t border-gray-800 pt-4">
                  {PALETTE_GROUPS.map((group) => (
                    <div key={group.title} className="space-y-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">{group.title}</div>
                      <div className="grid content-start gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {group.keys.map((key) => {
                          const label = colorLabelFor(key);
                          return (
                            <button
                              key={key}
                              onClick={() => openPaletteEditor(key, label)}
                              className={`flex items-center gap-2 rounded-lg border bg-black/10 px-2.5 py-2 text-left transition-colors hover:border-gray-600 ${paletteEditorTargetsThemeKey(key) ? 'border-accent bg-accent/10' : 'border-gray-800'}`}
                            >
                              <span className="h-5 w-5 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: activeModeColors[key] }} />
                              <span className="min-w-0 flex-1 text-xs text-gray-300">{label}</span>
                              <span className="font-mono text-[10px] text-gray-500">{activeModeColors[key]}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-xl border border-gray-700/70 bg-gray-900/40 p-4">
              <div>
                <div className="text-sm font-semibold text-gray-200">Color Harmony</div>
                <p className="mt-1 text-[11px] text-gray-500">Generate a set from the accent color, then apply the whole pack or just the fields you want.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs text-gray-400">Accent Color</span>
                  <div className="flex items-center gap-2 rounded-lg border border-gray-800 bg-black/10 px-3 py-2">
                    <input
                      type="color"
                      aria-label="Color Harmony accent color"
                      value={harmonyAccentHex}
                      onChange={(e) => setHarmonyAccentHex(e.target.value)}
                      className="h-8 w-8 rounded border border-gray-700 bg-transparent"
                    />
                    <span className="font-mono text-sm text-gray-300">{harmonyAccentHex}</span>
                    <button
                      type="button"
                      onClick={openHarmonyAccentEditor}
                      className="ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-700 text-gray-300 transition-colors hover:bg-gray-800"
                      aria-label="Edit Color Harmony accent color"
                      title="Edit Color Harmony accent color"
                    >
                      <Pipette size={14} />
                    </button>
                  </div>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-gray-400">Harmony</span>
                  <select
                    value={selectedHarmonyId}
                    onChange={(e) => setSelectedHarmonyId(e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 focus:border-accent focus:outline-none"
                  >
                    {harmonySuggestions.map((suggestion) => (
                      <option key={suggestion.id} value={suggestion.id}>{suggestion.label}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-gray-400">Mode</span>
                  <select
                    value={harmonyMode}
                    onChange={(e) => setHarmonyMode(e.target.value as HarmonyMode)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 focus:border-accent focus:outline-none"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>
                <div className="space-y-1">
                  <span className="text-xs text-gray-400">Generate</span>
                  <button
                    onClick={() => applyHarmonyAssignments(selectedHarmony.assignments)}
                    className="flex h-[42px] w-full items-center justify-center rounded-lg border border-accent bg-accent/10 text-sm font-medium text-accent hover:bg-accent/15"
                  >
                    Generate palette
                  </button>
                </div>
              </div>
              <div className="overflow-hidden rounded-full border border-gray-800">
                <div className="flex h-6">
                  {selectedHarmony.preview.map((color) => (
                    <span key={`${selectedHarmony.id}-${color}`} className="flex-1" style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {selectedHarmony.assignments.map((assignment) => (
                  <div key={`${selectedHarmony.id}-${assignment.key}`} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-black/10 px-2.5 py-2">
                    <span className="h-5 w-5 shrink-0 rounded-full border border-white/10" style={{ backgroundColor: assignment.value }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-gray-200">{assignment.label}</div>
                      <div className="font-mono text-[10px] text-gray-500">{assignment.value}</div>
                    </div>
                    <button
                      onClick={() => applyHarmonyField(assignment)}
                      className="rounded-md border border-gray-700 px-2 py-1 text-[10px] text-gray-300 hover:bg-gray-800"
                    >
                      Apply
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <input ref={importRef} type="file" accept="application/json,.json" onChange={handleImportThemes} className="hidden" />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-300">
            <Palette size={15} /> Palette
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={togglePreviewPickMode}
              className={`flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs ${previewPickMode ? 'border-accent bg-accent/15 text-accent' : 'border-gray-700 text-gray-300 hover:bg-gray-800'}`}
            >
              <MousePointer2 size={13} /> Select from preview
            </button>
            <div className="inline-flex rounded-lg border border-gray-700 bg-gray-950 p-0.5">
              {(['dark', 'light'] as const).map((mode) => (
                <button key={mode} onClick={() => setDraftMode(mode)} className={`rounded-md px-3 py-1 text-xs capitalize ${draftMode === mode ? 'bg-gray-700 text-gray-100' : 'text-gray-500 hover:text-gray-300'}`}>
                  {mode}
                </button>
              ))}
            </div>
            <button onClick={updateCurrentTheme} className="flex items-center gap-1 rounded-md border border-gray-700 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-gray-800">
              <Save size={13} /> Update Theme
            </button>
          </div>
        </div>
        <div className="space-y-3">
          <div className="space-y-3">
            {PALETTE_GROUPS.map((group) => (
              <div key={group.title} className="space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">{group.title}</div>
                <div className="grid content-start gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {group.keys.map((key) => {
                    const label = colorLabelFor(key);
                    return (
                      <button
                        key={key}
                        onClick={() => openPaletteEditor(key, label)}
                        className={`flex items-center gap-2 rounded-lg border bg-gray-900/30 px-2.5 py-2 text-left transition-colors hover:border-gray-600 hover:bg-gray-800/50 ${paletteEditorTargetsThemeKey(key) ? 'border-accent bg-accent/10' : 'border-gray-800'}`}
                      >
                        <span className="h-5 w-5 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: activeModeColors[key] }} />
                        <span className="min-w-0 flex-1 text-xs text-gray-300">{label}</span>
                        <span className="font-mono text-[10px] text-gray-500">{activeModeColors[key]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div
            className="rounded-xl border p-3 shadow-inner"
            style={{ backgroundColor: activeModeColors['--color-bg-deep'], borderColor: activeModeColors['--color-border-subtle'] }}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold" style={{ color: activeModeColors['--color-text-primary'] }}>Live preview</div>
                <div className="text-[10px]" style={{ color: activeModeColors['--color-text-muted'] }}>
                  {previewSamplingActive ? 'Click a preview part to sample its color.' : previewPickMode ? 'Click a preview part to edit its color.' : 'Click any preview part to open its color.'}
                </div>
              </div>
              <button
                onClick={togglePreviewPickMode}
                className="rounded-md border px-2 py-1 text-[10px]"
                style={{
                  borderColor: previewPickMode ? activeModeColors['--color-accent'] : activeModeColors['--color-border-medium'],
                  color: previewPickMode ? activeModeColors['--color-accent-hover'] : activeModeColors['--color-text-secondary'],
                  backgroundColor: previewPickMode ? `${activeModeColors['--color-accent']}22` : activeModeColors['--color-bg-surface'],
                }}
              >
                <MousePointer2 size={12} className="mr-1 inline" /> Pick
              </button>
            </div>

            <div
              className="overflow-hidden rounded-lg border"
              style={{ backgroundColor: activeModeColors['--color-bg-deep'], borderColor: activeModeColors['--color-border-medium'] }}
            >
              <div
                className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left"
                style={{
                  backgroundColor: activeModeColors['--color-bg-surface'],
                  borderColor: activeModeColors['--color-border-subtle'],
                  color: activeModeColors['--color-text-primary'],
                }}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePreviewColorTarget('--color-accent', 'Logo accent')}
                    className="h-5 w-5 rounded-md border border-white/15"
                    style={{ backgroundColor: activeModeColors['--color-accent'] }}
                    aria-label="Edit logo accent color"
                    title="Edit logo accent color"
                  />
                  <button
                    type="button"
                    onClick={() => handlePreviewColorTarget('--color-text-primary', 'Top bar title text')}
                    className="text-xs font-semibold"
                    style={{ color: activeModeColors['--color-text-primary'] }}
                  >
                    ThreatCaddy
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handlePreviewColorTarget('--color-bg-deep', 'Search field background')}
                  className="h-6 w-44 rounded-md border"
                  style={{ backgroundColor: activeModeColors['--color-bg-deep'], borderColor: activeModeColors['--color-border-medium'] }}
                  aria-label="Edit search field background color"
                  title="Edit search field background color"
                />
                <button
                  type="button"
                  onClick={() => handlePreviewColorTarget('--color-accent', 'New button accent')}
                  className="rounded-md px-2 py-1 text-[10px] font-medium text-white"
                  style={{ backgroundColor: activeModeColors['--color-accent'] }}
                >
                  New
                </button>
              </div>

              <div className="grid min-h-[340px] md:grid-cols-[170px_minmax(0,1fr)]">
                <aside className="border-r p-3" style={{ backgroundColor: activeModeColors['--color-bg-surface'], borderColor: activeModeColors['--color-border-subtle'] }}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handlePreviewColorTarget('--color-text-muted', 'Navigation section label')}
                      className="block text-left text-[10px] font-semibold uppercase tracking-[0.18em]"
                      style={{ color: activeModeColors['--color-text-muted'] }}
                    >
                      ThreatCaddy
                    </button>
                    <span
                      className="rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.16em]"
                      style={{
                        borderColor: activeModeColors['--color-border-medium'],
                        color: activeModeColors['--color-text-muted'],
                      }}
                    >
                      {sidebarAccentStyle === 'color-chips' ? 'chips' : 'default'}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {previewNavItems.map(renderPreviewNavItem)}
                  </div>
                </aside>

                <div className="space-y-3 p-4" style={{ backgroundColor: activeModeColors['--color-bg-deep'] }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <button
                        onClick={() => handlePreviewColorTarget('--color-text-primary', 'Primary headings')}
                        className="block text-left text-base font-semibold"
                        style={{ color: activeModeColors['--color-text-primary'] }}
                      >
                        Investigation dashboard
                      </button>
                      <button
                        onClick={() => handlePreviewColorTarget('--color-text-muted', 'Muted helper text')}
                        className="mt-1 block text-left text-xs"
                        style={{ color: activeModeColors['--color-text-muted'] }}
                      >
                        Compact preview of the colors used across the workspace.
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePreviewColorTarget('--color-border-medium', 'Secondary button border')}
                        className="rounded-md border px-3 py-1.5 text-xs"
                        style={{
                          borderColor: activeModeColors['--color-border-medium'],
                          color: activeModeColors['--color-text-secondary'],
                          backgroundColor: activeModeColors['--color-bg-surface'],
                        }}
                      >
                        Filter
                      </button>
                      <button
                        onClick={() => handlePreviewColorTarget('--color-accent', 'Primary action')}
                        className="rounded-md px-3 py-1.5 text-xs font-medium text-white"
                        style={{ backgroundColor: activeModeColors['--color-accent'] }}
                      >
                        Add IOC
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-3">
                    {[
                      ['Open investigations', '12', '--color-accent-blue'],
                      ['Resolved tasks', '31', '--color-accent-green'],
                      ['Warnings', '4', '--color-accent-amber'],
                    ].map(([label, value, key]) => (
                      <button
                        key={label}
                        onClick={() => handlePreviewColorTarget('--color-bg-raised', 'Metric card surface')}
                        className="rounded-lg border p-3 text-left"
                        style={{ backgroundColor: activeModeColors['--color-bg-raised'], borderColor: activeModeColors['--color-border-subtle'] }}
                      >
                        <span className="block text-[10px]" style={{ color: activeModeColors['--color-text-muted'] }}>{label}</span>
                        <span className="mt-1 block text-lg font-semibold" style={{ color: activeModeColors[key as AppearanceColorVariable] }}>{value}</span>
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(220px,0.75fr)]">
                    <button
                      onClick={() => handlePreviewColorTarget('--color-bg-raised', 'Investigation card surface')}
                      className="rounded-lg border p-3 text-left"
                      style={{ backgroundColor: activeModeColors['--color-bg-raised'], borderColor: activeModeColors['--color-border-subtle'] }}
                    >
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold" style={{ color: activeModeColors['--color-text-primary'] }}>Operation Nightglass</div>
                          <div className="mt-1 text-xs" style={{ color: activeModeColors['--color-text-secondary'] }}>Credential theft cluster with linked domains and scheduled tasks.</div>
                        </div>
                        <span className="rounded-full px-2 py-1 text-[10px] font-medium text-gray-950" style={{ backgroundColor: activeModeColors['--color-accent-pink'] }}>High</span>
                      </div>
                      <div className="grid gap-2 md:grid-cols-3">
                        {[
                          ['IOC', '--color-accent-blue'],
                          ['Clean', '--color-accent-green'],
                          ['Review', '--color-accent-amber'],
                        ].map(([label, key]) => (
                          <span key={label} className="rounded-md px-2 py-1 text-center text-[10px] font-medium text-gray-950" style={{ backgroundColor: activeModeColors[key as AppearanceColorVariable] }}>
                            {label}
                          </span>
                        ))}
                      </div>
                    </button>

                    <div className="space-y-2">
                      <button
                        onClick={() => handlePreviewColorTarget('--color-bg-hover', 'Hovered row')}
                        className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left"
                        style={{ backgroundColor: activeModeColors['--color-bg-hover'], borderColor: activeModeColors['--color-border-subtle'] }}
                      >
                        <span className="text-xs" style={{ color: activeModeColors['--color-text-primary'] }}>Hovered task row</span>
                        <span className="text-[10px]" style={{ color: activeModeColors['--color-text-muted'] }}>Now</span>
                      </button>
                      <button
                        onClick={() => handlePreviewColorTarget('--color-bg-surface', 'Chat or note panel')}
                        className="w-full rounded-lg border p-3 text-left"
                        style={{ backgroundColor: activeModeColors['--color-bg-surface'], borderColor: activeModeColors['--color-border-medium'] }}
                      >
                        <div className="text-xs font-medium" style={{ color: activeModeColors['--color-text-primary'] }}>CaddyAI note</div>
                        <div className="mt-1 text-[11px]" style={{ color: activeModeColors['--color-text-secondary'] }}>
                          This panel shows note, chat, and modal surface colors.
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-2 md:grid-cols-4">
                    {[
                      ['Info signal', '--color-accent-blue'],
                      ['Success signal', '--color-accent-green'],
                      ['Warning signal', '--color-accent-amber'],
                      ['Critical signal', '--color-accent-pink'],
                    ].map(([label, key]) => (
                      <button
                        key={label}
                        onClick={() => handlePreviewColorTarget(key as AppearanceColorVariable, label)}
                        className="rounded-full px-2 py-1 text-[10px] font-medium text-gray-950"
                        style={{ backgroundColor: activeModeColors[key as AppearanceColorVariable] }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-300">
          <Type size={15} /> Typography
        </h3>
        <div className="space-y-4 rounded-xl border border-gray-700/70 bg-gray-900/40 p-4">
          <div className="grid gap-2 md:grid-cols-3">
            {TYPOGRAPHY_TARGETS.map((target) => (
              <button
                key={target.id}
                onClick={() => setTypographyTarget(target.id)}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${typographyTarget === target.id ? 'border-accent bg-accent/10' : 'border-gray-800 bg-black/10 hover:border-gray-600'}`}
              >
                <div className="text-xs font-medium text-gray-200">{target.label}</div>
                <div className="mt-0.5 text-[10px] text-gray-500">{target.description}</div>
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="space-y-1">
              <span className="text-xs text-gray-400">Font for {TYPOGRAPHY_TARGETS.find((target) => target.id === typographyTarget)?.label.toLowerCase()}</span>
              <select
                value={typographyTarget === 'interface' ? fontFamily : (fontTargets[typographyTarget] || fontFamily)}
                onChange={(e) => setTypographyFont(typographyTarget, e.target.value)}
                className="w-full rounded border border-gray-700 bg-gray-950 px-2.5 py-2 text-sm text-gray-200 focus:border-accent focus:outline-none"
              >
                {allFontOptions.map((font) => <option key={font.id} value={font.value}>{font.label}</option>)}
              </select>
            </label>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Scale</span>
                <span className="text-xs tabular-nums text-gray-500">{fontScale}%</span>
              </div>
              <input type="range" min={90} max={115} value={fontScale} onChange={(e) => onUpdateSettings({ appearanceFontScale: Number(e.target.value) })} className="w-full accent-accent" />
              <button onClick={() => onUpdateSettings({ appearanceFontFamily: FONT_OPTIONS[0].value, appearanceFontTargets: undefined, appearanceFontScale: 100 })} className="text-[11px] text-gray-500 hover:text-gray-300">Reset typography</button>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-gray-400">Add a font by name</span>
            <div className="flex gap-2">
              <input
                value={customFontName}
                onChange={(e) => setCustomFontName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addCustomFont(); }}
                placeholder="e.g. SF Pro, Helvetica, JetBrains Mono"
                className="min-w-0 flex-1 rounded border border-gray-700 bg-gray-950 px-2.5 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:border-accent focus:outline-none"
              />
              <button onClick={addCustomFont} className="rounded-md border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800">
                Add
              </button>
            </div>
            <p className="text-[10px] text-gray-500">
              Browsers can only enumerate installed fonts when the Local Font Access API is available; otherwise add a known system font here.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300">Bordered Panels</h3>
        <div className="space-y-4 rounded-xl border border-gray-700/70 bg-gray-900/40 p-4">
          <div className="grid gap-3 rounded-lg border border-gray-800/80 bg-black/10 p-3 md:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Transparency</div>
              <div className="mt-1 text-lg font-semibold text-gray-100">{panelTransparency}%</div>
              <div className="text-[11px] text-gray-500">0% keeps panels solid.</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Blur</div>
              <div className="mt-1 text-lg font-semibold text-gray-100">{panelBlur}px</div>
              <div className="text-[11px] text-gray-500">0px keeps panel edges crisp.</div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Panel transparency</span>
                <span className="text-xs tabular-nums text-gray-500">{panelTransparency}%</span>
              </div>
              <input type="range" min={0} max={100} value={panelTransparency} onChange={(e) => onUpdateSettings({ windowGlassTransparency: Number(e.target.value) })} className="h-1.5 w-full accent-accent" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Panel blur</span>
                <span className="text-xs tabular-nums text-gray-500">{panelBlur}px</span>
              </div>
              <input type="range" min={0} max={40} value={panelBlur} onChange={(e) => onUpdateSettings({ windowGlassBlur: Number(e.target.value) })} className="h-1.5 w-full accent-accent" />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-300">Ambient Motion</h3>
            <p className="mt-1 text-[11px] text-gray-500">
              Pull the Odysseus-style animated background into ThreatCaddy without breaking the existing master theme.
            </p>
          </div>
          {(bgEffectPattern !== 'none' || frostedPanels) && (
            <button onClick={resetAmbientMotion} className="flex items-center gap-1 rounded-md border border-gray-700 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-gray-800">
              <RotateCcw size={13} /> Reset motion
            </button>
          )}
        </div>

        <div className="space-y-4 rounded-xl border border-gray-700/70 bg-gray-900/40 p-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-medium text-gray-300">Background animation</div>
                <div className="mt-1 text-[11px] text-gray-500">Choose any animation independently of the selected ThreatCaddy or Odysseus theme.</div>
              </div>
              <span className="rounded-full border border-gray-700 bg-black/20 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-gray-500">
                {BACKGROUND_EFFECT_LABELS[bgEffectPattern]}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {BACKGROUND_EFFECT_OPTIONS.map((option) => {
                const active = option.id === bgEffectPattern;
                const previewColor = active
                  ? bgEffectColor
                  : getPaletteEffectColor(option.id, runtimeModeColors) ?? bgEffectColor;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => selectBackgroundEffect(option.id)}
                    className={cn(
                      'group min-h-[118px] overflow-hidden rounded-lg border bg-gray-950 text-left transition-colors hover:border-gray-500',
                      active ? 'border-accent shadow-[0_0_0_1px_var(--color-accent)]' : 'border-gray-800',
                    )}
                  >
                    <span
                      className="block h-10 border-b border-white/5"
                      style={{
                        backgroundImage: getEffectPreviewBackground(option.id, previewColor),
                        backgroundSize: option.id === 'dots' || option.id === 'synapse' ? '18px 18px, auto' : undefined,
                      }}
                    />
                    <span className="block px-2 py-1.5">
                      <span className="flex items-center justify-between gap-2 text-[11px] font-medium text-gray-300 group-hover:text-gray-100">
                        <span className="truncate">{option.label}</span>
                        {active && <span className="text-[9px] uppercase tracking-[0.14em] text-accent">Active</span>}
                      </span>
                      <span className="mt-1 line-clamp-2 text-[10px] leading-4 text-gray-500">{option.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-3 rounded-lg border border-gray-800 bg-black/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-medium text-gray-300">Effect color</div>
                  <div className="mt-1 text-[11px] text-gray-500">Tune the particle hue while keeping the animation family tied to the active theme.</div>
                </div>
                <button
                  type="button"
                  onClick={applyThemeEffectColor}
                  className="rounded-md border border-gray-700 px-2.5 py-1.5 text-xs text-gray-300 transition-colors hover:bg-gray-800"
                >
                  Use theme color
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2">
                <input
                  type="color"
                  aria-label="Effect color"
                  value={bgEffectColor}
                  onChange={(event) => onUpdateSettings({ bgEffectColor: event.target.value })}
                  className="h-8 w-8 rounded border border-gray-700 bg-transparent"
                />
                <span className="font-mono text-sm text-gray-300">{bgEffectColor}</span>
                <button
                  type="button"
                  onClick={openBackgroundEffectColorEditor}
                  className="ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-700 text-gray-300 transition-colors hover:bg-gray-800"
                  aria-label="Edit effect color"
                  title="Edit effect color"
                >
                  <Pipette size={14} />
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="flex items-center justify-between text-xs text-gray-400">
                    <span>Hue</span>
                    <span className="tabular-nums text-gray-500">{bgEffectHsl.h}</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={359}
                    value={bgEffectHsl.h}
                    onChange={(event) => setBackgroundEffectHsl({ h: Number(event.target.value) })}
                    aria-label="Background effect hue"
                    className="h-2 w-full accent-accent"
                  />
                </label>
                <label className="space-y-1">
                  <span className="flex items-center justify-between text-xs text-gray-400">
                    <span>Saturation</span>
                    <span className="tabular-nums text-gray-500">{bgEffectHsl.s}%</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={bgEffectHsl.s}
                    onChange={(event) => setBackgroundEffectHsl({ s: Number(event.target.value) })}
                    aria-label="Background effect saturation"
                    className="h-2 w-full accent-accent"
                  />
                </label>
                <label className="space-y-1">
                  <span className="flex items-center justify-between text-xs text-gray-400">
                    <span>Light</span>
                    <span className="tabular-nums text-gray-500">{bgEffectHsl.l}%</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={bgEffectHsl.l}
                    onChange={(event) => setBackgroundEffectHsl({ l: Number(event.target.value) })}
                    aria-label="Background effect lightness"
                    className="h-2 w-full accent-accent"
                  />
                </label>
              </div>
            </div>
            <div className="rounded-lg border border-gray-800 bg-black/10 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">Theme derived</div>
              <div className="mt-3 flex items-center gap-3">
                <span className="h-10 w-10 rounded-lg border border-white/15" style={{ backgroundColor: themeEffectColor }} />
                <div className="min-w-0">
                  <div className="font-mono text-xs text-gray-300">{themeEffectColor}</div>
                  <div className="mt-1 text-[11px] leading-4 text-gray-500">Generated from the active ThreatCaddy/Odysseus palette for the selected animation.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Intensity</span>
                <span className="text-xs tabular-nums text-gray-500">{bgEffectIntensity}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={bgEffectIntensity}
                onChange={(event) => onUpdateSettings({ bgEffectIntensity: Number(event.target.value) })}
                aria-label="Background effect intensity"
                className="h-2 w-full accent-accent"
              />
              <div className="flex justify-between text-[10px] text-gray-600"><span>Subtle</span><span>Strong</span></div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Size</span>
                <span className="text-xs tabular-nums text-gray-500">{bgEffectSize}%</span>
              </div>
              <input
                type="range"
                min={40}
                max={180}
                step={5}
                value={bgEffectSize}
                onChange={(event) => onUpdateSettings({ bgEffectSize: Number(event.target.value) })}
                aria-label="Background effect size"
                className="h-2 w-full accent-accent"
              />
              <div className="flex justify-between text-[10px] text-gray-600"><span>Fine</span><span>Large</span></div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-800 bg-black/20">
            <div
              className="h-28"
              style={{
                backgroundImage: getEffectPreviewBackground(bgEffectPattern, bgEffectColor),
                backgroundSize: bgEffectPattern === 'dots' || bgEffectPattern === 'synapse' ? '22px 22px, auto' : undefined,
              }}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="rounded-lg border border-gray-800 bg-black/10 px-3 py-3 text-[11px] leading-5 text-gray-400">
              {BACKGROUND_EFFECT_OPTIONS.find((option) => option.id === bgEffectPattern)?.description}
              <div className="mt-2 text-gray-500">
                Use this for motion and atmosphere. Background images still sit on top when enabled.
              </div>
            </div>

            <label className="flex items-center justify-between rounded-lg border border-gray-800 bg-black/10 px-3 py-3">
              <div>
                <div className="text-xs font-medium text-gray-200">Frosted panels</div>
                <div className="mt-1 text-[11px] text-gray-500">Lift the shell and settings surfaces off the animated background.</div>
              </div>
              <input
                type="checkbox"
                checked={frostedPanels}
                onChange={(event) => onUpdateSettings({ frostedPanels: event.target.checked })}
                className="rounded border-gray-600"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300">{t('appearance.backgroundImage')}</h3>

        {showBackgroundControls ? (
          <div className="space-y-3">
            <div className="relative h-36 overflow-hidden rounded-lg border border-gray-700">
              {bgPreview ? (
                <>
                  <div
                    className="h-full w-full"
                    style={{
                      backgroundImage: `url(${bgPreview})`,
                      backgroundSize: 'cover',
                      backgroundPosition: `${posX}% ${posY}%`,
                      backgroundRepeat: 'no-repeat',
                      filter: bgBlur > 0 ? `blur(${bgBlur}px)` : undefined,
                      transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
                    }}
                  />
                  <div className="absolute inset-0" style={{ backgroundColor: settings.theme === 'dark' ? `rgba(0,0,0,${bgOverlayOpacity / 100})` : `rgba(255,255,255,${bgOverlayOpacity / 100})` }} />
                  <button onClick={handleRemoveImage} className="absolute right-2 top-2 rounded bg-black/60 p-1 text-white transition-colors hover:bg-black/80" title={t('appearance.removeImage')}>
                    <X size={14} />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={loading}
                  className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gray-900/40 px-4 text-center text-gray-500 transition-colors hover:text-gray-300"
                >
                  <Upload size={20} />
                  <span className="text-sm">{loading ? t('appearance.saving') : t('appearance.uploadBgImage')}</span>
                  <span className="max-w-sm text-xs text-gray-600">No background image is stored in this standalone browser bucket.</span>
                </button>
              )}
            </div>

            <label className="flex cursor-pointer select-none items-center gap-2">
              <input type="checkbox" checked={bgEnabled} onChange={(e) => onUpdateSettings({ bgImageEnabled: e.target.checked })} className="rounded border-gray-600" />
              <span className="text-sm text-gray-300">{t('appearance.enableBackground')}</span>
            </label>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{t('appearance.transparency')}</span>
                <span className="text-xs tabular-nums text-gray-500">{bgTransparency}%</span>
              </div>
              <input type="range" min={0} max={100} value={bgTransparency} onChange={(e) => onUpdateSettings({ bgImageOpacity: 100 - Number(e.target.value) })} className="h-1.5 w-full accent-accent" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Blur</span>
                <span className="text-xs tabular-nums text-gray-500">{bgBlur}px</span>
              </div>
              <input type="range" min={0} max={40} value={bgBlur} onChange={(e) => onUpdateSettings({ bgImageBlur: Number(e.target.value) })} className="h-1.5 w-full accent-accent" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{t('appearance.zoom')}</span>
                <span className="text-xs tabular-nums text-gray-500">{zoom}%</span>
              </div>
              <input type="range" min={50} max={200} step={5} value={zoom} onChange={(e) => onUpdateSettings({ bgImageZoom: Number(e.target.value) })} className="h-1.5 w-full accent-accent" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{t('appearance.position')}</span>
                {(posX !== 50 || posY !== 50 || zoom !== 100) && (
                  <button onClick={resetPosition} className="flex items-center gap-1 text-[10px] text-gray-500 transition-colors hover:text-gray-300">
                    <RotateCcw size={10} /> {t('common:reset')}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">{t('appearance.horizontal')}</span>
                    <span className="text-[10px] tabular-nums text-gray-600">{posX}%</span>
                  </div>
                  <input type="range" min={0} max={100} value={posX} onChange={(e) => onUpdateSettings({ bgImagePosX: Number(e.target.value) })} className="h-1.5 w-full accent-accent" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">{t('appearance.vertical')}</span>
                    <span className="text-[10px] tabular-nums text-gray-600">{posY}%</span>
                  </div>
                  <input type="range" min={0} max={100} value={posY} onChange={(e) => onUpdateSettings({ bgImagePosY: Number(e.target.value) })} className="h-1.5 w-full accent-accent" />
                </div>
              </div>
            </div>

            <button onClick={() => fileRef.current?.click()} disabled={loading} className="text-xs text-accent transition-colors hover:text-accent-hover disabled:opacity-60">
              {bgPreview ? t('appearance.changeImage') : t('appearance.uploadBgImage')}
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} disabled={loading} className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-gray-700 py-6 text-gray-500 transition-colors hover:border-gray-500 hover:text-gray-400">
            {loading ? (
              <span className="text-sm">{t('appearance.saving')}</span>
            ) : (
              <>
                <Upload size={20} />
                <span className="text-sm">{t('appearance.uploadBgImage')}</span>
                <span className="text-xs text-gray-600">{t('appearance.uploadHint')}</span>
              </>
            )}
          </button>
        )}

        <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
      </div>

      {paletteEditor && (() => {
        const hsl = hexToHsl(paletteEditor.draftValue);
        const wheelPoint = hslToWheelPoint(hsl);
        return (
          <div
            className="fixed z-[100] w-[360px] rounded-lg border border-gray-700 bg-gray-950 shadow-2xl shadow-black/50"
            style={{ left: paletteEditor.position.x, top: paletteEditor.position.y }}
            data-appearance-color-editor="true"
          >
            <div
              onPointerDown={beginDragPalette}
              onPointerMove={dragPalette}
              onPointerUp={() => setDragStart(null)}
              className="flex cursor-move items-center justify-between gap-2 border-b border-gray-800 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <GripHorizontal size={14} className="text-gray-500" />
                <span className="truncate text-xs font-medium text-gray-200">{paletteEditor.label}</span>
              </div>
              <button
                onPointerDown={(event) => event.stopPropagation()}
                onClick={closePaletteEditor}
                className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-200"
                aria-label="Cancel color selection"
              >
                <X size={13} />
              </button>
            </div>

            <div className="space-y-3 p-3">
              <div className="flex items-center gap-3">
                <div className="h-20 w-20 shrink-0 rounded-full border border-white/20 shadow-inner" style={{ backgroundColor: paletteEditor.draftValue }} />
                <div className="min-w-0 flex-1">
                  <input
                    value={paletteEditor.inputValue}
                    aria-label={`${paletteEditor.label} hex color`}
                    data-appearance-color-editor-target={paletteEditor.target.kind}
                    data-appearance-color-editor-key={'key' in paletteEditor.target ? paletteEditor.target.key : undefined}
                    data-appearance-color-editor-mode={'mode' in paletteEditor.target ? paletteEditor.target.mode : undefined}
                    onChange={(e) => setPaletteInputValue(e.target.value)}
                    className="w-full rounded border border-gray-800 bg-black/20 px-2 py-1.5 font-mono text-xs text-gray-300 focus:border-accent focus:outline-none"
                  />
                  <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                    <label className="flex cursor-pointer items-center justify-center gap-1 rounded-md border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800">
                      Browser color
                      <input
                        type="color"
                        value={paletteEditor.draftValue}
                        onChange={(e) => setPaletteDraftValue(e.target.value)}
                        className="sr-only"
                      />
                    </label>
                    <button
                      onClick={useEyeDropper}
                      className={cn(
                        'rounded-md border px-2 py-1.5 text-gray-300 transition-colors hover:bg-gray-800',
                        previewSamplingActive ? 'border-accent bg-accent/15 text-accent' : 'border-gray-700'
                      )}
                      title={nativeEyeDropperSupported ? 'Pick color from screen' : 'Pick color from live preview'}
                      aria-label={nativeEyeDropperSupported ? 'Pick color from screen' : 'Pick color from live preview'}
                    >
                      <Pipette size={15} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <div
                  className="relative h-48 w-48 touch-none rounded-full border border-white/20 shadow-inner"
                  onPointerDown={choosePaletteWheelColor}
                  onPointerMove={dragPaletteWheelColor}
                  onPointerUp={endPaletteWheelSelection}
                  onPointerCancel={endPaletteWheelSelection}
                  onPointerLeave={() => {
                    if (wheelPointerId === null) setWheelLoupe((prev) => ({ ...prev, visible: false }));
                  }}
                  role="application"
                  aria-label="Color wheel"
                  style={{
                    background: COLOR_WHEEL_BACKGROUND,
                  }}
                >
                  {wheelLoupe.visible && (
                    <div
                      className="pointer-events-none absolute z-10 h-20 w-20 -translate-x-1/2 -translate-y-[120%] overflow-hidden rounded-full border-2 border-white shadow-[0_12px_28px_rgba(0,0,0,0.55),0_0_0_2px_rgba(0,0,0,0.45)]"
                      style={{
                        left: `${wheelLoupe.x}%`,
                        top: `${wheelLoupe.y}%`,
                        background: COLOR_WHEEL_BACKGROUND,
                        backgroundSize: '384px 384px',
                        backgroundPosition: `${40 - (wheelLoupe.x / 100) * 384}px ${40 - (wheelLoupe.y / 100) * 384}px`,
                      }}
                    >
                      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/80" />
                      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/80" />
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9px] text-white">
                        {wheelLoupe.color}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label="Drag selected color"
                    className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.55)]"
                    style={{
                      left: `${wheelPoint.x}%`,
                      top: `${wheelPoint.y}%`,
                      backgroundColor: paletteEditor.draftValue,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block">
                  <div className="mb-1 flex justify-between text-[10px] text-gray-500"><span>Hue</span><span>{hsl.h}</span></div>
                  <input type="range" min={0} max={359} value={hsl.h} onChange={(e) => setPaletteHsl({ h: Number(e.target.value) })} className="w-full accent-accent" />
                </label>
                <label className="block">
                  <div className="mb-1 flex justify-between text-[10px] text-gray-500"><span>Saturation</span><span>{hsl.s}%</span></div>
                  <input type="range" min={0} max={100} value={hsl.s} onChange={(e) => setPaletteHsl({ s: Number(e.target.value) })} className="w-full accent-accent" />
                </label>
                <label className="block">
                  <div className="mb-1 flex justify-between text-[10px] text-gray-500"><span>Light</span><span>{hsl.l}%</span></div>
                  <input type="range" min={0} max={100} value={hsl.l} onChange={(e) => setPaletteHsl({ l: Number(e.target.value) })} className="w-full accent-accent" />
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-800 pt-3">
                <button onClick={closePaletteEditor} className="rounded-md px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800 hover:text-gray-200">
                  Cancel
                </button>
                <button onClick={applyPaletteEditor} className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:brightness-110">
                  Apply
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
