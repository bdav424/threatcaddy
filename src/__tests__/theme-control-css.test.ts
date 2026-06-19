import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const indexCss = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

describe('theme-aware native controls', () => {
  it('keeps native select popups tied to active light/dark theme tokens', () => {
    expect(indexCss).toContain('--tc-control-popup-bg: var(--color-bg-raised)');
    expect(indexCss).toContain('color-scheme: dark');
    expect(indexCss).toContain('color-scheme: light');
    expect(indexCss).toContain('select option,');
    expect(indexCss).toContain('select optgroup');
    expect(indexCss).toContain('background-color: var(--tc-control-popup-bg)');
    expect(indexCss).toContain('color: var(--tc-control-popup-fg)');
    expect(indexCss).toContain('select option:checked');
    expect(indexCss).toContain('background-color: var(--tc-control-popup-selected-bg)');
  });
});
