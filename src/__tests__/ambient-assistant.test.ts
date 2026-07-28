import { describe, expect, it } from 'vitest';
import { AMBIENT_MASCOTS, getMascot } from '../components/AmbientAssistant/mascots';
import { DEFAULT_SETTINGS } from '../types';

describe('ambient assistant mascot registry', () => {
  it('ships the four requested characters with stable ids', () => {
    expect(AMBIENT_MASCOTS.map((m) => m.id)).toEqual(['edgar', 'gopher', 'clip', 'wilson']);
  });

  it('every mascot has a name, tagline, accent, component, and at least one tip', () => {
    for (const m of AMBIENT_MASCOTS) {
      expect(m.name).toBeTruthy();
      expect(m.tagline).toBeTruthy();
      expect(m.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(typeof m.Component).toBe('function');
      expect(m.tips.length).toBeGreaterThan(0);
    }
  });

  it('getMascot resolves a known id and falls back to Edgar for unknown/undefined', () => {
    expect(getMascot('wilson').id).toBe('wilson');
    expect(getMascot(undefined).id).toBe('edgar');
    // @ts-expect-error — intentionally passing an out-of-range value
    expect(getMascot('nope').id).toBe('edgar');
  });

  it('is off by default and defaults to Edgar (opt-in, never surprises the operator)', () => {
    expect(DEFAULT_SETTINGS.ambientAssistantEnabled).toBe(false);
    expect(DEFAULT_SETTINGS.ambientAssistantCharacter).toBe('edgar');
    expect(DEFAULT_SETTINGS.ambientAssistantTips).toBe(true);
  });
});
