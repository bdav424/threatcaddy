import { DEFAULT_CLS_LEVELS, DEFAULT_PAP_LEVELS } from '../types';

/** Tailwind-compatible style classes for a classification level badge. */
export interface ClsBadgeStyle {
  bg: string;
  text: string;
  border: string;
}

const TLP_STYLES: Record<string, ClsBadgeStyle> = {
  'TLP:RED':          { bg: 'bg-red-500/20',    text: 'text-red-700 dark:text-red-400',    border: 'border-red-500/40' },
  'TLP:AMBER+STRICT': { bg: 'bg-amber-500/20',  text: 'text-amber-700 dark:text-amber-400',  border: 'border-amber-500/60' },
  'TLP:AMBER':        { bg: 'bg-amber-500/20',  text: 'text-amber-700 dark:text-amber-400',  border: 'border-amber-500/40' },
  'TLP:GREEN':        { bg: 'bg-green-500/20',  text: 'text-green-700 dark:text-green-400',  border: 'border-green-500/40' },
  'TLP:CLEAR':        { bg: 'bg-gray-500/20',   text: 'text-gray-700 dark:text-gray-400',   border: 'border-gray-500/40' },
  'PAP:RED':          { bg: 'bg-red-500/20',    text: 'text-red-700 dark:text-red-400',    border: 'border-red-500/40' },
  'PAP:AMBER':        { bg: 'bg-amber-500/20',  text: 'text-amber-700 dark:text-amber-400',  border: 'border-amber-500/40' },
  'PAP:GREEN':        { bg: 'bg-green-500/20',  text: 'text-green-700 dark:text-green-400',  border: 'border-green-500/40' },
  'PAP:WHITE':        { bg: 'bg-gray-500/20',   text: 'text-gray-700 dark:text-gray-400',   border: 'border-gray-500/40' },
};

const NEUTRAL_STYLE: ClsBadgeStyle = { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/40' };

/** Returns Tailwind classes for a classification badge. Falls back to neutral gray for custom levels. */
export function getClsBadgeStyle(level: string): ClsBadgeStyle {
  return TLP_STYLES[level.toUpperCase()] ?? NEUTRAL_STYLE;
}

/** Returns the user's configured cls levels if non-empty, otherwise the built-in TLP defaults. */
export function getEffectiveClsLevels(userLevels?: string[]): string[] {
  return userLevels && userLevels.length > 0 ? userLevels : DEFAULT_CLS_LEVELS;
}

/**
 * Returns true if the item should be hidden during screenshare mode.
 * - No level → visible (not sensitive)
 * - Unknown level (not in hierarchy) → hidden (conservative)
 * - Otherwise compare indices: hidden if item index > max index
 */
export function isAboveClsThreshold(itemLevel: string | undefined, maxLevel: string, effectiveLevels: string[]): boolean {
  if (!itemLevel) return false;
  const itemIdx = effectiveLevels.indexOf(itemLevel);
  const maxIdx = effectiveLevels.indexOf(maxLevel);
  if (itemIdx === -1) return true; // unknown level → hide conservatively
  if (maxIdx === -1) return true;  // unknown max → hide conservatively
  return itemIdx > maxIdx;
}

/** Cascade: IOC-level > entity-level > global default > empty string. */
export function resolveIOCClsLevel(iocLevel?: string, entityLevel?: string, defaultLevel?: string): string {
  return iocLevel || entityLevel || defaultLevel || '';
}

/** Combined TLP+PAP priority order (highest sensitivity last). */
const COMBINED_LEVEL_ORDER = [
  ...DEFAULT_CLS_LEVELS, // TLP:CLEAR ... TLP:RED
  ...DEFAULT_PAP_LEVELS,  // PAP:WHITE ... PAP:RED
];

/**
 * Given a list of entities with optional `clsLevel`, returns the highest-sensitivity
 * TLP or PAP level found across all items for the given folderId.
 * Returns undefined when no classified content exists.
 */
export function getInheritedClsLevel(
  folderId: string,
  entities: { folderId?: string; clsLevel?: string }[],
): string | undefined {
  let bestIdx = -1;
  let bestLevel: string | undefined;
  for (const e of entities) {
    if (e.folderId !== folderId || !e.clsLevel) continue;
    const idx = COMBINED_LEVEL_ORDER.indexOf(e.clsLevel);
    if (idx > bestIdx) {
      bestIdx = idx;
      bestLevel = e.clsLevel;
    }
  }
  return bestLevel;
}

const CLS_TEXT_MARKERS: Array<{ pattern: RegExp; level: string }> = [
  { pattern: /\bTLP\s*:?\s*RED\b/i, level: 'TLP:RED' },
  { pattern: /\bTLP\s*:?\s*AMBER\s*\+\s*STRICT\b/i, level: 'TLP:AMBER+STRICT' },
  { pattern: /\bTLP\s*:?\s*AMBER\b/i, level: 'TLP:AMBER' },
  { pattern: /\bTLP\s*:?\s*GREEN\b/i, level: 'TLP:GREEN' },
  { pattern: /\bTLP\s*:?\s*(CLEAR|WHITE)\b/i, level: 'TLP:CLEAR' },
  // Non-TLP confidentiality banners commonly found in ingested documents/emails.
  // None of these name a TLP color, so they map onto the AMBER tier — "limited
  // disclosure, restricted to participants' organizations" is the closest official
  // TLP definition to "Confidential / Company Restricted / Employees Only". This
  // is conservative on purpose (same spirit as isAboveClsThreshold's "unknown
  // level -> hide" default above), and it means every downstream consumer of
  // clsLevel (badge styling, border color, screenshare threshold, folder TLP
  // escalation) picks these up for free without needing to know the source wording.
  { pattern: /\bconfidential\b/i, level: 'TLP:AMBER' },
  { pattern: /\b(company|internal)\s+restricted\b/i, level: 'TLP:AMBER' },
  { pattern: /\bemployees?\s+only\b/i, level: 'TLP:AMBER' },
  { pattern: /\binternal\s+use\s+only\b/i, level: 'TLP:AMBER' },
  { pattern: /\brestricted\s+distribution\b/i, level: 'TLP:AMBER' },
];

/**
 * Scans free text (evidence content, OCR text, etc.) for explicit TLP markers
 * and common non-TLP confidentiality banners, returning the most restrictive
 * level found. Returns undefined when nothing matches.
 */
export function detectClsLevelFromText(text: string | undefined | null): string | undefined {
  if (!text) return undefined;
  let best: string | undefined;
  let bestIdx = -1;
  for (const { pattern, level } of CLS_TEXT_MARKERS) {
    if (pattern.test(text)) {
      const idx = DEFAULT_CLS_LEVELS.indexOf(level);
      if (idx > bestIdx) {
        bestIdx = idx;
        best = level;
      }
    }
  }
  return best;
}

/** Hex color for a TLP/PAP bottom-border indicator. Returns undefined for CLEAR/WHITE/unknown. */
export function getTlpBorderColor(level: string | undefined): string | undefined {
  if (!level) return undefined;
  const upper = level.toUpperCase();
  if (upper.includes('RED')) return '#ef4444';
  if (upper.includes('AMBER')) return '#f97316';
  if (upper.includes('GREEN')) return '#22c55e';
  return undefined;
}

/**
 * Official OASIS STIX 2.1 marking-definition objects for the Traffic Light Protocol.
 * UUIDs are the canonical ones from the STIX 2.1 specification.
 */
export const STIX_TLP_MARKING_DEFS: Record<string, {
  type: 'marking-definition';
  spec_version: '2.1';
  id: string;
  created: string;
  definition_type: 'tlp';
  name: string;
  definition: { tlp: string };
}> = {
  'TLP:CLEAR': {
    type: 'marking-definition',
    spec_version: '2.1',
    id: 'marking-definition--94868c89-83c2-464b-929b-a1a8aa3c8487',
    created: '2022-10-01T00:00:00.000Z',
    definition_type: 'tlp',
    name: 'TLP:CLEAR',
    definition: { tlp: 'clear' },
  },
  'TLP:GREEN': {
    type: 'marking-definition',
    spec_version: '2.1',
    id: 'marking-definition--bab4a63c-afd4-4e03-b846-b75e0496be71',
    created: '2022-10-01T00:00:00.000Z',
    definition_type: 'tlp',
    name: 'TLP:GREEN',
    definition: { tlp: 'green' },
  },
  'TLP:AMBER': {
    type: 'marking-definition',
    spec_version: '2.1',
    id: 'marking-definition--55d920b0-5e8b-4f79-9ee9-91f868d9b421',
    created: '2022-10-01T00:00:00.000Z',
    definition_type: 'tlp',
    name: 'TLP:AMBER',
    definition: { tlp: 'amber' },
  },
  'TLP:AMBER+STRICT': {
    type: 'marking-definition',
    spec_version: '2.1',
    id: 'marking-definition--939a9414-2ddd-4d32-a0cd-b7571b03f430',
    created: '2022-10-01T00:00:00.000Z',
    definition_type: 'tlp',
    name: 'TLP:AMBER+STRICT',
    definition: { tlp: 'amber+strict' },
  },
  'TLP:RED': {
    type: 'marking-definition',
    spec_version: '2.1',
    id: 'marking-definition--e828b379-4e03-4974-9ac4-e53a884c97c1',
    created: '2022-10-01T00:00:00.000Z',
    definition_type: 'tlp',
    name: 'TLP:RED',
    definition: { tlp: 'red' },
  },
};
