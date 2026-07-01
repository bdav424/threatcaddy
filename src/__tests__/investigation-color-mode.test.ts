import { describe, it, expect, beforeEach } from 'vitest';
import {
  getInvestigationColorMode,
  setInvestigationColorMode,
  tlpToAccentColor,
  type InvestigationColorMode,
} from '../lib/investigation-color-mode';

// jsdom provides localStorage in the vitest environment
const STORAGE_KEY = 'threatcaddy:investigationColorMode';

beforeEach(() => {
  localStorage.removeItem(STORAGE_KEY);
});

describe('getInvestigationColorMode', () => {
  it('returns "manual" when nothing is stored', () => {
    expect(getInvestigationColorMode()).toBe('manual');
  });

  it('returns "tlp" when stored as tlp', () => {
    localStorage.setItem(STORAGE_KEY, 'tlp');
    expect(getInvestigationColorMode()).toBe('tlp');
  });

  it('returns "combined" when stored as combined', () => {
    localStorage.setItem(STORAGE_KEY, 'combined');
    expect(getInvestigationColorMode()).toBe('combined');
  });

  it('falls back to "manual" for an unknown stored value', () => {
    localStorage.setItem(STORAGE_KEY, 'bogus');
    expect(getInvestigationColorMode()).toBe('manual');
  });
});

describe('setInvestigationColorMode', () => {
  it('persists "manual"', () => {
    setInvestigationColorMode('manual');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('manual');
  });

  it('persists "tlp"', () => {
    setInvestigationColorMode('tlp');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('tlp');
  });

  it('persists "combined"', () => {
    setInvestigationColorMode('combined');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('combined');
  });

  it('round-trips through get → set → get', () => {
    const modes: InvestigationColorMode[] = ['manual', 'tlp', 'combined'];
    for (const mode of modes) {
      setInvestigationColorMode(mode);
      expect(getInvestigationColorMode()).toBe(mode);
    }
  });
});

describe('tlpToAccentColor', () => {
  it('returns red tint for TLP:RED', () => {
    const color = tlpToAccentColor('TLP:RED');
    expect(color).not.toBeNull();
    expect(color).toContain('226');  // R component
  });

  it('returns amber tint for TLP:AMBER', () => {
    const color = tlpToAccentColor('TLP:AMBER');
    expect(color).not.toBeNull();
    expect(color).toContain('239'); // R component
  });

  it('returns green tint for TLP:GREEN', () => {
    const color = tlpToAccentColor('TLP:GREEN');
    expect(color).not.toBeNull();
    expect(color).toContain('99'); // R component
  });

  it('returns null for TLP:CLEAR', () => {
    expect(tlpToAccentColor('TLP:CLEAR')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(tlpToAccentColor('')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(tlpToAccentColor('tlp:red')).not.toBeNull();
    expect(tlpToAccentColor('tlp:amber')).not.toBeNull();
    expect(tlpToAccentColor('tlp:green')).not.toBeNull();
  });

  it('returns rgba() strings with 0.12 alpha', () => {
    const red = tlpToAccentColor('TLP:RED');
    expect(red).toMatch(/rgba\(\d+,\d+,\d+,0\.12\)/);
  });
});
