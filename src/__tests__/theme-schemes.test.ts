import { describe, expect, it, beforeEach } from 'vitest';
import {
  applyColorScheme,
  DEFAULT_DARK_THEME_COLORS,
  type AppearanceColorVariable,
} from '../lib/theme-schemes';
import type { CustomAppearanceTheme } from '../types';

const customTheme: CustomAppearanceTheme = {
  id: 'custom-dark',
  name: 'Custom Dark',
  swatch: '#111111',
  dark: {
    ...DEFAULT_DARK_THEME_COLORS,
    '--color-bg-surface': '#222222',
  } satisfies Record<AppearanceColorVariable, string>,
  light: {
    ...DEFAULT_DARK_THEME_COLORS,
    '--color-bg-surface': '#eeeeee',
  } satisfies Record<AppearanceColorVariable, string>,
  createdAt: 1,
  updatedAt: 1,
};

describe('applyColorScheme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('clears stale custom theme variables when returning to a built-in scheme', () => {
    applyColorScheme('custom-dark', 'dark', [customTheme]);

    expect(document.documentElement.style.getPropertyValue('--color-bg-surface')).toBe('#222222');

    applyColorScheme('indigo', 'dark', []);

    expect(document.documentElement.style.getPropertyValue('--color-bg-surface')).toBe('');
  });

  it('applies the active interface font to root variables', () => {
    applyColorScheme('indigo', 'dark', [], '"Avenir Next", sans-serif', 105);

    expect(document.documentElement.style.getPropertyValue('--tc-font-family')).toBe('"Avenir Next", sans-serif');
    expect(document.documentElement.style.getPropertyValue('--tc-font-scale')).toBe('1.05');
  });

  it('ignores unmanaged or invalid custom theme variables', () => {
    applyColorScheme('custom-dark', 'dark', [{
      ...customTheme,
      dark: {
        ...customTheme.dark,
        '--color-bg-surface': 'url(javascript:alert(1))',
        '--not-managed': '#ffffff',
      },
    }]);

    expect(document.documentElement.style.getPropertyValue('--color-bg-surface')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--not-managed')).toBe('');
  });
});
