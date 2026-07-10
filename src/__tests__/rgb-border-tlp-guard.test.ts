/**
 * rgb-border-tlp-guard.test.ts
 *
 * Asserts that the RGB border animation in index.css never touches TLP/status
 * borders.  TLP badge colors carry semantic meaning; hue-cycling them would
 * destroy that signal.  These selectors must be present and must use revert +
 * animation:none overrides inside the .has-rgb-borders rule-set.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

describe('RGB border TLP guard', () => {
  it('defines the .has-rgb-borders rule with allowed chrome selectors', () => {
    expect(css).toMatch(/\.has-rgb-borders\s+\.app-window-frame/);
  });

  it('hard-stops TLP badge borders with revert !important', () => {
    // The exclusion block must cover tlp-clear-badge and the generic tlp- class wildcard
    expect(css).toMatch(/\.has-rgb-borders\s+\.tlp-clear-badge/);
    expect(css).toMatch(/\.has-rgb-borders\s+\[class\*="tlp-"\]/);
    // Must explicitly revert border-color so TLP colors are restored
    expect(css).toMatch(/border-color\s*:\s*revert\s*!important/);
  });

  it('hard-stops data-tlp attribute borders', () => {
    expect(css).toMatch(/\.has-rgb-borders\s+\[data-tlp\]/);
  });

  it('hard-stops investigation-status attribute borders', () => {
    expect(css).toMatch(/\.has-rgb-borders\s+\[data-investigation-status\]/);
  });

  it('cancels animation on all excluded TLP/status selectors', () => {
    // animation: none must appear in the exclusion block
    expect(css).toMatch(/animation\s*:\s*none/);
  });

  it('respects prefers-reduced-motion', () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion\s*:\s*reduce\)/);
    expect(css).toMatch(/\.has-rgb-borders\s*\{[^}]*animation\s*:\s*none/);
  });
});
