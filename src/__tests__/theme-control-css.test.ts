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

describe('journal page font inheritance', () => {
  // Guards the regression where the global `p, li, h1..` font-family rules beat
  // the page font inherited from the surface, so the Page-font picker silently
  // did nothing. The editor content must re-inherit to follow the page font.
  it('re-inherits font-family into the journal editor content', () => {
    expect(indexCss).toMatch(/\.journal-focus-quiet\s+p[\s\S]*?font-family:\s*inherit/);
    expect(indexCss).toMatch(/\.journal-focus-quiet\s+h1/);
  });

  it('self-hosts the bundled Journal fonts', () => {
    expect(indexCss).toMatch(/@font-face\s*\{[^}]*font-family:\s*'TC Virgil'/);
    expect(indexCss).toMatch(/@font-face\s*\{[^}]*font-family:\s*'TC Cascadia'/);
  });
});
