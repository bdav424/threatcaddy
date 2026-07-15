/**
 * glass-style.test.ts
 *
 * Asserts the structural properties of the four-style glass system in
 * index.css: each style is gated behind [data-glass-style="..."], grain
 * survives alongside every style's own pattern (background-image is not
 * additive across separate CSS rules — a naive second rule would silently
 * replace it, which is exactly the bug this system replaced), the edge
 * bevel applies unconditionally, and the light-mode scrim doesn't clobber
 * that bevel the same way the old box-shadow rule would have.
 *
 * Regex note: every "match up to the next rule" pattern here uses [^{}]*?
 * (excludes BOTH brace characters), never [\s\S]*? or .*? alone, between an
 * anchor and its own opening brace. [\s\S]*? can cross a `}` and land the
 * match on a completely unrelated, much later rule — a real bug caught
 * while writing this file (see git history), not a hypothetical one.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
const appLayout = readFileSync(resolve(process.cwd(), 'src/components/Layout/AppLayout.tsx'), 'utf8');

const STYLES = ['streaks', 'blurry', 'bumpy', 'lined'] as const;

describe('glass style: selector gating', () => {
  it('defines a [data-glass-style] rule for every style', () => {
    for (const style of STYLES) {
      expect(css).toMatch(new RegExp(`\\[data-glass-style="${style}"\\]\\.has-panel-glass`));
    }
  });

  it('no longer defines an .app-window-sheen CSS rule or renders that DOM element', () => {
    // Comments may still reference the old name for historical context (the
    // codebase's established convention — see e.g. the grey-wash comment
    // above the backdrop-filter rule); what must be gone is the actual rule
    // and the DOM element that used to carry it.
    expect(css).not.toMatch(/\.app-window-sheen\s*\{/);
    expect(appLayout).not.toMatch(/className="app-window-sheen"/);
  });
});

describe('glass style: grain is not silently dropped', () => {
  it('every style rule that sets background-image includes --tc-grain-image', () => {
    for (const style of STYLES) {
      const styleBlockPattern = new RegExp(
        `\\[data-glass-style="${style}"\\][^{}]*?\\{[^}]*background-image:[^;]*;[^}]*\\}`,
        'g',
      );
      const matches = css.match(styleBlockPattern) || [];
      expect(matches.length).toBeGreaterThan(0);
      for (const block of matches) {
        expect(block).toMatch(/var\(--tc-grain-image\)/);
      }
    }
  });

  it('defines --tc-grain-image once as a reusable custom property', () => {
    expect(css).toMatch(/--tc-grain-image:\s*url\("data:image\/svg\+xml/);
  });
});

describe('glass style: bumpy uses real refraction, not a painted gradient', () => {
  it('bumpy backdrop-filter references the noise SVG filter', () => {
    expect(css).toMatch(/\[data-glass-style="bumpy"\][^{}]*?\{[^}]*backdrop-filter:\s*url\(#tc-glass-noise\)/);
  });

  it('AppLayout defines the #tc-glass-noise filter with feTurbulence + feDisplacementMap', () => {
    expect(appLayout).toMatch(/id="tc-glass-noise"/);
    expect(appLayout).toMatch(/feTurbulence/);
    expect(appLayout).toMatch(/feDisplacementMap/);
  });

  it('bumpy does not declare its own gradient background-image (only grain)', () => {
    const bumpyBgRule = css.match(/\[data-glass-style="bumpy"\][^{}]*?\{[^}]*background-image:[^;]*;[^}]*\}/);
    expect(bumpyBgRule).not.toBeNull();
    expect(bumpyBgRule![0]).not.toMatch(/linear-gradient|radial-gradient|repeating-linear-gradient/);
  });
});

describe('glass style: world-space attachment is scoped correctly', () => {
  it('streaks and blurry use background-attachment: fixed (scroll-linked)', () => {
    for (const style of ['streaks', 'blurry']) {
      const rule = css.match(new RegExp(`\\[data-glass-style="${style}"\\][^{}]*?\\{[^}]*background-attachment:[^;]*;[^}]*\\}`));
      expect(rule).not.toBeNull();
      expect(rule![0]).toMatch(/fixed/);
    }
  });

  it('lined stays local-space (no background-attachment: fixed) — it is a material property, not a light effect', () => {
    const linedRules = css.match(/\[data-glass-style="lined"\][^{}]*?\{[^}]*\}/g) || [];
    expect(linedRules.length).toBeGreaterThan(0);
    for (const rule of linedRules) {
      expect(rule).not.toMatch(/background-attachment:\s*fixed/);
    }
  });

  it('real-panel and small-element tiers use different background-size for streaks', () => {
    const streaksRules = css.match(/\[data-glass-style="streaks"\][^{}]*?\{[^}]*\}/g) || [];
    const sizes = streaksRules
      .map((r) => r.match(/background-size:\s*([^;]*);/)?.[1]?.replace(/\s*!important\s*$/, ''))
      .filter(Boolean);
    expect(sizes).toContain('auto, 100vw 100vh');
    expect(sizes).toContain('auto, 50vw 50vh');
  });
});

describe('glass style: edge bevel', () => {
  it('defines --tc-panel-bevel once', () => {
    expect(css).toMatch(/--tc-panel-bevel:\s*inset/);
  });

  it('applies unconditionally (not gated on [data-glass-style])', () => {
    // Anchored on the "Edge bevel" comment through the following "S3: Panel
    // glass scrim" comment — `.has-panel-glass .bg-gray-900,` alone also
    // opens the background-color and backdrop-filter rules earlier in the
    // file, so a loosely-anchored search would happily match one of those.
    const afterComment = css.split('Edge bevel: cheap (2-4 inset box-shadow layers')[1];
    expect(afterComment).toBeTruthy();
    const bevelSection = afterComment!.split('S3: Panel glass scrim')[0];
    const bevelRule = bevelSection.match(/\.has-panel-glass[^{}]*?\{[^}]*box-shadow:\s*var\(--tc-panel-bevel\)\s*!important;[^}]*\}/);
    expect(bevelRule).not.toBeNull();
    expect(bevelRule![0]).not.toMatch(/data-glass-style/);
  });

  it('the light-mode scrim folds --tc-panel-bevel into its own box-shadow instead of replacing it', () => {
    // box-shadow is not additive across separate CSS rules — if the light-mode
    // scrim set box-shadow without including --tc-panel-bevel, it would
    // silently drop the bevel for every light-theme panel.
    const scrimRule = css.match(/\.light\.has-panel-glass[^{}]*?\{[^}]*box-shadow:[^;]*;[^}]*\}/);
    expect(scrimRule).not.toBeNull();
    expect(scrimRule![0]).toMatch(/var\(--tc-panel-bevel\)/);
  });
});
