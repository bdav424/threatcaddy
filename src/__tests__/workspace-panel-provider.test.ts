import { describe, expect, it } from 'vitest';
import { fitWorkspacePanelGeometryToCompactDefault } from '../components/WorkspacePanels/WorkspacePanelProvider';

describe('workspace panel provider geometry reset', () => {
  it('resets stale persisted panel sizes to the registered compact default', () => {
    expect(fitWorkspacePanelGeometryToCompactDefault(
      { x: 4, y: 6, width: 240, height: 180 },
      { x: 320, y: 72, width: 900, height: 620 },
    )).toEqual({
      x: 320,
      y: 72,
      width: 900,
      height: 620,
    });
  });

  it('rounds usable imported geometry without resetting it', () => {
    expect(fitWorkspacePanelGeometryToCompactDefault(
      { x: 44.4, y: 91.8, width: 640.2, height: 420.7 },
      { x: 320, y: 72, width: 900, height: 620 },
    )).toEqual({
      x: 44,
      y: 92,
      width: 640,
      height: 421,
    });
  });
});
