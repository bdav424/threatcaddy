import { describe, it, expect } from 'vitest';
import {
  detectClsLevelFromText,
  getClsBadgeStyle,
  getEffectiveClsLevels,
  isAboveClsThreshold,
  resolveIOCClsLevel,
  STIX_TLP_MARKING_DEFS,
} from '../lib/classification';
import { DEFAULT_CLS_LEVELS } from '../types';

// ── getClsBadgeStyle ────────────────────────────────────────────────

describe('getClsBadgeStyle', () => {
  it('returns red styles for TLP:RED', () => {
    const style = getClsBadgeStyle('TLP:RED');
    expect(style.bg).toContain('red');
    expect(style.text).toContain('red');
    expect(style.border).toContain('red');
  });

  it('returns amber styles for TLP:AMBER', () => {
    const style = getClsBadgeStyle('TLP:AMBER');
    expect(style.bg).toContain('amber');
    expect(style.text).toContain('amber');
  });

  it('returns amber styles for TLP:AMBER+STRICT', () => {
    const style = getClsBadgeStyle('TLP:AMBER+STRICT');
    expect(style.bg).toContain('amber');
  });

  it('returns green styles for TLP:GREEN', () => {
    const style = getClsBadgeStyle('TLP:GREEN');
    expect(style.bg).toContain('green');
  });

  it('returns gray styles for TLP:CLEAR', () => {
    const style = getClsBadgeStyle('TLP:CLEAR');
    expect(style.bg).toContain('gray');
  });

  it('returns styles for PAP levels', () => {
    expect(getClsBadgeStyle('PAP:RED').bg).toContain('red');
    expect(getClsBadgeStyle('PAP:AMBER').bg).toContain('amber');
    expect(getClsBadgeStyle('PAP:GREEN').bg).toContain('green');
    expect(getClsBadgeStyle('PAP:WHITE').bg).toContain('gray');
  });

  it('is case-insensitive', () => {
    expect(getClsBadgeStyle('tlp:red')).toEqual(getClsBadgeStyle('TLP:RED'));
    expect(getClsBadgeStyle('Tlp:Amber')).toEqual(getClsBadgeStyle('TLP:AMBER'));
  });

  it('returns neutral gray for unknown levels', () => {
    const style = getClsBadgeStyle('CUSTOM:LEVEL');
    expect(style.bg).toContain('gray');
    expect(style.text).toContain('gray');
    expect(style.border).toContain('gray');
  });
});

// ── getEffectiveClsLevels ───────────────────────────────────────────

describe('getEffectiveClsLevels', () => {
  it('returns DEFAULT_CLS_LEVELS when no user levels', () => {
    expect(getEffectiveClsLevels()).toEqual(DEFAULT_CLS_LEVELS);
  });

  it('returns DEFAULT_CLS_LEVELS for undefined', () => {
    expect(getEffectiveClsLevels(undefined)).toEqual(DEFAULT_CLS_LEVELS);
  });

  it('returns DEFAULT_CLS_LEVELS for empty array', () => {
    expect(getEffectiveClsLevels([])).toEqual(DEFAULT_CLS_LEVELS);
  });

  it('returns user levels when non-empty', () => {
    const custom = ['PUBLIC', 'INTERNAL', 'SECRET'];
    expect(getEffectiveClsLevels(custom)).toEqual(custom);
  });
});

// ── isAboveClsThreshold ─────────────────────────────────────────────

describe('isAboveClsThreshold', () => {
  const levels = DEFAULT_CLS_LEVELS; // ['TLP:CLEAR', 'TLP:GREEN', 'TLP:AMBER', 'TLP:AMBER+STRICT', 'TLP:RED']

  it('returns false when item has no level (not sensitive)', () => {
    expect(isAboveClsThreshold(undefined, 'TLP:AMBER', levels)).toBe(false);
  });

  it('returns false when item level is at the threshold', () => {
    expect(isAboveClsThreshold('TLP:AMBER', 'TLP:AMBER', levels)).toBe(false);
  });

  it('returns false when item level is below the threshold', () => {
    expect(isAboveClsThreshold('TLP:GREEN', 'TLP:AMBER', levels)).toBe(false);
    expect(isAboveClsThreshold('TLP:CLEAR', 'TLP:RED', levels)).toBe(false);
  });

  it('returns true when item level is above the threshold', () => {
    expect(isAboveClsThreshold('TLP:RED', 'TLP:AMBER', levels)).toBe(true);
    expect(isAboveClsThreshold('TLP:AMBER+STRICT', 'TLP:GREEN', levels)).toBe(true);
  });

  it('returns true for unknown item level (conservative)', () => {
    expect(isAboveClsThreshold('UNKNOWN', 'TLP:AMBER', levels)).toBe(true);
  });

  it('returns true for unknown max level (conservative)', () => {
    expect(isAboveClsThreshold('TLP:RED', 'UNKNOWN', levels)).toBe(true);
  });

  it('works with custom level hierarchies', () => {
    const custom = ['PUBLIC', 'INTERNAL', 'SECRET', 'TOP-SECRET'];
    expect(isAboveClsThreshold('SECRET', 'INTERNAL', custom)).toBe(true);
    expect(isAboveClsThreshold('PUBLIC', 'SECRET', custom)).toBe(false);
    expect(isAboveClsThreshold('INTERNAL', 'INTERNAL', custom)).toBe(false);
  });
});

// ── resolveIOCClsLevel ──────────────────────────────────────────────

describe('resolveIOCClsLevel', () => {
  it('returns IOC level when present', () => {
    expect(resolveIOCClsLevel('TLP:RED', 'TLP:GREEN', 'TLP:CLEAR')).toBe('TLP:RED');
  });

  it('falls back to entity level when IOC level is absent', () => {
    expect(resolveIOCClsLevel(undefined, 'TLP:GREEN', 'TLP:CLEAR')).toBe('TLP:GREEN');
    expect(resolveIOCClsLevel('', 'TLP:GREEN', 'TLP:CLEAR')).toBe('TLP:GREEN');
  });

  it('falls back to default level when both IOC and entity are absent', () => {
    expect(resolveIOCClsLevel(undefined, undefined, 'TLP:CLEAR')).toBe('TLP:CLEAR');
    expect(resolveIOCClsLevel('', '', 'TLP:CLEAR')).toBe('TLP:CLEAR');
  });

  it('returns empty string when all levels are absent', () => {
    expect(resolveIOCClsLevel()).toBe('');
    expect(resolveIOCClsLevel(undefined, undefined, undefined)).toBe('');
    expect(resolveIOCClsLevel('', '', '')).toBe('');
  });
});

// ── detectClsLevelFromText ──────────────────────────────────────────

describe('detectClsLevelFromText', () => {
  it('returns undefined for empty/missing text', () => {
    expect(detectClsLevelFromText(undefined)).toBeUndefined();
    expect(detectClsLevelFromText(null)).toBeUndefined();
    expect(detectClsLevelFromText('')).toBeUndefined();
    expect(detectClsLevelFromText('nothing sensitive here')).toBeUndefined();
  });

  it('detects explicit TLP markers regardless of colon/spacing', () => {
    expect(detectClsLevelFromText('Classification: TLP:RED')).toBe('TLP:RED');
    expect(detectClsLevelFromText('TLP RED — internal only')).toBe('TLP:RED');
    expect(detectClsLevelFromText('tlp:amber')).toBe('TLP:AMBER');
    expect(detectClsLevelFromText('TLP:AMBER+STRICT')).toBe('TLP:AMBER+STRICT');
    expect(detectClsLevelFromText('TLP GREEN')).toBe('TLP:GREEN');
    expect(detectClsLevelFromText('TLP:CLEAR')).toBe('TLP:CLEAR');
    expect(detectClsLevelFromText('TLP:WHITE')).toBe('TLP:CLEAR');
  });

  it('does not mistake TLP:AMBER+STRICT for plain TLP:AMBER', () => {
    expect(detectClsLevelFromText('Marked TLP:AMBER+STRICT for this doc')).toBe('TLP:AMBER+STRICT');
  });

  it('maps non-TLP confidentiality banners to TLP:AMBER', () => {
    expect(detectClsLevelFromText('CONFIDENTIAL - Company Restricted')).toBe('TLP:AMBER');
    expect(detectClsLevelFromText('Employees Only')).toBe('TLP:AMBER');
    expect(detectClsLevelFromText('Internal Use Only')).toBe('TLP:AMBER');
    expect(detectClsLevelFromText('Restricted Distribution')).toBe('TLP:AMBER');
  });

  it('takes the most restrictive marker when multiple are present', () => {
    expect(detectClsLevelFromText('CONFIDENTIAL document. Also marked TLP:RED.')).toBe('TLP:RED');
    expect(detectClsLevelFromText('TLP:GREEN doc, but also Employees Only')).toBe('TLP:AMBER');
  });
});

// ── STIX_TLP_MARKING_DEFS ──────────────────────────────────────────

describe('STIX_TLP_MARKING_DEFS', () => {
  it('has entries for all 5 TLP levels', () => {
    expect(STIX_TLP_MARKING_DEFS['TLP:CLEAR']).toBeDefined();
    expect(STIX_TLP_MARKING_DEFS['TLP:GREEN']).toBeDefined();
    expect(STIX_TLP_MARKING_DEFS['TLP:AMBER']).toBeDefined();
    expect(STIX_TLP_MARKING_DEFS['TLP:AMBER+STRICT']).toBeDefined();
    expect(STIX_TLP_MARKING_DEFS['TLP:RED']).toBeDefined();
  });

  it('all entries have correct STIX 2.1 structure', () => {
    for (const def of Object.values(STIX_TLP_MARKING_DEFS)) {
      expect(def.type).toBe('marking-definition');
      expect(def.spec_version).toBe('2.1');
      expect(def.id).toMatch(/^marking-definition--[0-9a-f-]+$/);
      expect(def.definition_type).toBe('tlp');
      expect(def.definition.tlp).toBeTruthy();
      expect(def.name).toMatch(/^TLP:/);
    }
  });

  it('has unique UUIDs for each level', () => {
    const ids = Object.values(STIX_TLP_MARKING_DEFS).map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
