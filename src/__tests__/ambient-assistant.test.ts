import { describe, expect, it } from 'vitest';
import { AMBIENT_MASCOTS, getMascot, resolveConfig } from '../components/AmbientAssistant/mascots';
import { DEFAULT_SETTINGS } from '../types';

describe('ambient assistant mascot registry', () => {
  it('ships the four requested characters with stable ids', () => {
    expect(AMBIENT_MASCOTS.map((m) => m.id)).toEqual(['edgar', 'gopher', 'clip', 'wilson']);
  });

  it('every mascot has name, tagline, accent, tips, customizable slots, and a builder', () => {
    for (const m of AMBIENT_MASCOTS) {
      expect(m.name).toBeTruthy();
      expect(m.tagline).toBeTruthy();
      expect(m.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(m.tips.length).toBeGreaterThan(0);
      expect(m.slots.length).toBeGreaterThan(0);
      expect(typeof m.build).toBe('function');
      // every slot has options and the default names one of them
      for (const slot of m.slots) {
        expect(slot.options.length).toBeGreaterThan(0);
        expect(slot.options.map((o) => o.id)).toContain(m.defaults[slot.id]);
      }
    }
  });

  it('every slot option renders without throwing and produces svg markup', () => {
    for (const m of AMBIENT_MASCOTS) {
      for (const slot of m.slots) {
        for (const opt of slot.options) {
          const built = m.build({ ...m.defaults, [slot.id]: opt.id });
          expect(built.inner.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('resolveConfig fills missing slots from the character default', () => {
    const cfg = resolveConfig('wilson', { face: 'grin' });
    expect(cfg.face).toBe('grin');       // caller value kept
    expect(cfg.tee).toBe('red');         // missing slot filled from default
    expect(cfg.topper).toBe('none');
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
