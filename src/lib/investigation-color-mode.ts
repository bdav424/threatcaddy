// src/lib/investigation-color-mode.ts
//
// UI preference for how investigation cards and workspace headers are colored.
// Stored in localStorage — this is presentational state, not a secret.

export type InvestigationColorMode = 'manual' | 'tlp' | 'combined';

const STORAGE_KEY = 'threatcaddy:investigationColorMode';

export function getInvestigationColorMode(): InvestigationColorMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'tlp' || stored === 'combined') return stored;
  } catch { /* ignore */ }
  return 'manual';
}

export function setInvestigationColorMode(mode: InvestigationColorMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch { /* ignore */ }
}

/**
 * Derive a card background tint hex color from a TLP classification string.
 * Returns an rgba() string suitable for use as a CSS background-color, or null
 * for TLP:CLEAR / unknown levels.
 */
export function tlpToAccentColor(tlpLevel: string): string | null {
  const u = tlpLevel.toUpperCase();
  if (u.includes('RED'))   return 'rgba(226,75,74,0.12)';
  if (u.includes('AMBER')) return 'rgba(239,159,39,0.12)';
  if (u.includes('GREEN')) return 'rgba(99,153,34,0.12)';
  return null;
}
