import { describe, it, expect } from 'vitest';
import { clsLevelIndex, effectiveTlpLevel } from '../lib/tlp-inspector';

// ---------------------------------------------------------------------------
// clsLevelIndex — order baseline
// ---------------------------------------------------------------------------
describe('clsLevelIndex', () => {
  it('returns -1 for undefined', () => {
    expect(clsLevelIndex(undefined)).toBe(-1);
  });

  it('returns -1 for empty string', () => {
    expect(clsLevelIndex('')).toBe(-1);
  });

  it('orders TLP levels correctly (CLEAR < GREEN < AMBER < AMBER+STRICT < RED)', () => {
    const clear = clsLevelIndex('TLP:CLEAR');
    const green = clsLevelIndex('TLP:GREEN');
    const amber = clsLevelIndex('TLP:AMBER');
    const amberStrict = clsLevelIndex('TLP:AMBER+STRICT');
    const red = clsLevelIndex('TLP:RED');

    expect(clear).toBeGreaterThanOrEqual(0);
    expect(green).toBeGreaterThan(clear);
    expect(amber).toBeGreaterThan(green);
    expect(amberStrict).toBeGreaterThan(amber);
    expect(red).toBeGreaterThan(amberStrict);
  });
});

// ---------------------------------------------------------------------------
// effectiveTlpLevel — precedence: max(folder, entity), never downgrade
// ---------------------------------------------------------------------------
describe('effectiveTlpLevel', () => {
  it('RED investigation + AMBER child → stays RED', () => {
    expect(effectiveTlpLevel('TLP:RED', 'TLP:AMBER')).toBe('TLP:RED');
  });

  it('GREEN investigation + AMBER child → escalates to AMBER', () => {
    expect(effectiveTlpLevel('TLP:GREEN', 'TLP:AMBER')).toBe('TLP:AMBER');
  });

  it('AMBER investigation + GREEN child → stays AMBER (no downgrade)', () => {
    expect(effectiveTlpLevel('TLP:AMBER', 'TLP:GREEN')).toBe('TLP:AMBER');
  });

  it('RED investigation + AMBER+STRICT child → stays RED', () => {
    expect(effectiveTlpLevel('TLP:RED', 'TLP:AMBER+STRICT')).toBe('TLP:RED');
  });

  it('AMBER investigation + AMBER+STRICT child → escalates to AMBER+STRICT', () => {
    expect(effectiveTlpLevel('TLP:AMBER', 'TLP:AMBER+STRICT')).toBe('TLP:AMBER+STRICT');
  });

  it('no folder TLP + AMBER child → returns AMBER', () => {
    expect(effectiveTlpLevel(undefined, 'TLP:AMBER')).toBe('TLP:AMBER');
  });

  it('RED folder + no entity TLP → returns RED', () => {
    expect(effectiveTlpLevel('TLP:RED', undefined)).toBe('TLP:RED');
  });

  it('no folder TLP + no entity TLP → returns TLP:CLEAR', () => {
    expect(effectiveTlpLevel(undefined, undefined)).toBe('TLP:CLEAR');
  });

  it('equal levels → returns that level', () => {
    expect(effectiveTlpLevel('TLP:AMBER', 'TLP:AMBER')).toBe('TLP:AMBER');
  });

  it('TLP:CLEAR folder + TLP:CLEAR entity → returns TLP:CLEAR', () => {
    expect(effectiveTlpLevel('TLP:CLEAR', 'TLP:CLEAR')).toBe('TLP:CLEAR');
  });
});
