import { describe, it, expect } from 'vitest';
import { validateTlpLevelChange, type TlpContributingItem } from '../lib/tlp-inspector';

const items: TlpContributingItem[] = [
  { id: '1', type: 'note', title: 'Recon notes', clsLevel: 'TLP:AMBER' },
  { id: '2', type: 'ioc', title: '1.2.3.4', clsLevel: 'TLP:GREEN' },
];

describe('validateTlpLevelChange', () => {
  it('allows raising above the auto-derived floor', () => {
    expect(validateTlpLevelChange('TLP:RED', items).allowed).toBe(true);
  });

  it('allows setting exactly at the floor', () => {
    expect(validateTlpLevelChange('TLP:AMBER', items).allowed).toBe(true);
  });

  it('blocks lowering below the floor and names the blocking content', () => {
    const result = validateTlpLevelChange('TLP:GREEN', items);
    expect(result.allowed).toBe(false);
    expect(result.error).toContain('Recon notes');
    expect(result.error).toContain('TLP:AMBER');
  });

  it('blocks clearing to None when classified content exists', () => {
    const result = validateTlpLevelChange('', items);
    expect(result.allowed).toBe(false);
    expect(result.error).toContain('Recon notes');
  });

  it('allows any level when there are no contributing items', () => {
    expect(validateTlpLevelChange('TLP:CLEAR', []).allowed).toBe(true);
  });
});
