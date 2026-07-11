/**
 * rgb-border-tlp-guard.test.ts
 *
 * Asserts that the RGB border animation in index.css never touches TLP/status
 * borders. TLP badge colors carry semantic meaning; hue-cycling them would
 * destroy that signal. RGB borders render as a `.rgb-ring` sibling <span>
 * (not a border-color animation) so the exclusion works by hiding that
 * sibling ring inside any TLP/status-bearing element, rather than by
 * reverting an animated border-color.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

describe('RGB border TLP guard', () => {
  it('defines the traveling ring gated behind .has-rgb-borders', () => {
    expect(css).toMatch(/\.has-rgb-borders\s+\.rgb-border/);
    expect(css).toMatch(/\.has-rgb-borders\s+\.app-window-chrome-ring/);
  });

  it('hard-stops TLP badge rings by hiding the sibling ring element', () => {
    expect(css).toMatch(/\[class\*="tlp-"\]\s+\.rgb-ring/);
    expect(css).toMatch(/\.tlp-clear-badge\s+\.rgb-ring/);
    expect(css).toMatch(/display\s*:\s*none\s*;/);
  });

  it('hard-stops data-tlp attribute rings', () => {
    expect(css).toMatch(/\[data-tlp\]\s+\.rgb-ring/);
  });

  it('hard-stops investigation-status attribute rings', () => {
    expect(css).toMatch(/\[data-investigation-status\]\s+\.rgb-ring/);
  });

  it('respects prefers-reduced-motion for both the panel ring and the chrome ring', () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion\s*:\s*reduce\)\s*\{\s*\.rgb-ring\s*\{\s*animation\s*:\s*none/);
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion\s*:\s*reduce\)\s*\{\s*\.app-window-chrome-ring\s*\{\s*animation\s*:\s*none/);
  });
});
