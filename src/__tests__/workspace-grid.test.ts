import { afterEach, describe, expect, it } from 'vitest';
import {
  createWorkspaceGridPlacement,
  getWorkspaceJoinCueSegments,
  getWorkspaceMosaicAttachmentState,
  getWorkspaceMosaicExposedEdgeSegments,
  getSafeWorkspaceGridKeys,
  listWorkspaceGridPlacements,
  readWorkspaceCanvasRect,
  selectWorkspaceGridPlacementForPointer,
  summarizeWorkspaceMosaicEdgeSegments,
  summarizeWorkspaceMosaicRoundedCorners,
  workspaceGridPlacementIsInteriorHole,
  workspaceGridPlacementIsOccupied,
  workspaceGridSpecForKey,
  workspacePanelPlacementFromGridPlacement,
  type WorkspaceCanvasRect,
  type WorkspaceGridPlacement,
} from '../components/WorkspacePanels/workspaceGrid';

const smallCanvas: WorkspaceCanvasRect = {
  x: 240,
  y: 64,
  width: 540,
  height: 520,
};

const largeCanvas: WorkspaceCanvasRect = {
  x: 240,
  y: 64,
  width: 1600,
  height: 1200,
};

const mediumCanvas: WorkspaceCanvasRect = {
  x: 240,
  y: 64,
  width: 1120,
  height: 760,
};

describe('workspace grid reader', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('exposes only grids whose cells satisfy panel minimums', () => {
    expect(getSafeWorkspaceGridKeys(smallCanvas, { minWidth: 320, minHeight: 240 })).toEqual(['1x1', '1x2']);

    expect(getSafeWorkspaceGridKeys(largeCanvas, { minWidth: 300, minHeight: 240 })).toEqual([
      '1x1',
      '1x2',
      '2x1',
      '2x2',
      '3x2',
      '3x3',
      '4x2',
      '4x1',
      '4x4',
    ]);
  });

  it('measures the union of visible workspace regions as the overlay mosaic canvas', () => {
    document.body.innerHTML = `
      <section data-app-workspace-home="true"></section>
      <section data-app-workspace-pane="active"></section>
    `;

    const home = document.querySelector('[data-app-workspace-home="true"]') as HTMLElement;
    const pane = document.querySelector('[data-app-workspace-pane="active"]') as HTMLElement;
    home.getBoundingClientRect = () => ({
      x: 280,
      y: 64,
      left: 280,
      top: 64,
      right: 1680,
      bottom: 760,
      width: 1400,
      height: 696,
      toJSON: () => ({}),
    } as DOMRect);
    pane.getBoundingClientRect = () => ({
      x: 280,
      y: 760,
      left: 280,
      top: 760,
      right: 1680,
      bottom: 1456,
      width: 1400,
      height: 696,
      toJSON: () => ({}),
    } as DOMRect);

    expect(readWorkspaceCanvasRect()).toEqual({
      x: 280,
      y: 64,
      width: 1400,
      height: 1392,
    });
  });

  it('prefers the explicit mosaic canvas below workspace controls', () => {
    document.body.innerHTML = `
      <section data-app-workspace-home="true">
        <div data-workspace-mosaic-canvas="true"></div>
      </section>
    `;

    const home = document.querySelector('[data-app-workspace-home="true"]') as HTMLElement;
    const canvas = document.querySelector('[data-workspace-mosaic-canvas="true"]') as HTMLElement;
    home.getBoundingClientRect = () => ({
      x: 280,
      y: 104,
      left: 280,
      top: 104,
      right: 1680,
      bottom: 1456,
      width: 1400,
      height: 1352,
      toJSON: () => ({}),
    } as DOMRect);
    canvas.getBoundingClientRect = () => ({
      x: 280,
      y: 144,
      left: 280,
      top: 144,
      right: 1680,
      bottom: 1456,
      width: 1400,
      height: 1312,
      toJSON: () => ({}),
    } as DOMRect);

    expect(readWorkspaceCanvasRect()).toEqual({
      x: 280,
      y: 144,
      width: 1400,
      height: 1312,
    });
  });

  it('blocks occupied cells while allowing the moving panel to reuse its own reservation', () => {
    const rightQuarter = listWorkspaceGridPlacements(largeCanvas, { minWidth: 300, minHeight: 240 })
      .find((placement) => placement.grid === '4x1' && placement.column === 3 && placement.row === 0);

    expect(rightQuarter).toBeDefined();

    const occupied = [{
      id: 'notes-workspace',
      rect: rightQuarter!.rect,
    }];

    const blockedPlacements = listWorkspaceGridPlacements(
      largeCanvas,
      { minWidth: 300, minHeight: 240 },
      occupied,
      'tasks-workspace',
    );
    expect(blockedPlacements.map((placement) => placement.id)).not.toContain(rightQuarter!.id);

    const ownPlacements = listWorkspaceGridPlacements(
      largeCanvas,
      { minWidth: 300, minHeight: 240 },
      occupied,
      'notes-workspace',
    );
    expect(ownPlacements.map((placement) => placement.id)).toContain(rightQuarter!.id);
  });

  it('uses placement cells before rect fallback when detecting occupied cells', () => {
    const spec = workspaceGridSpecForKey('3x3');
    expect(spec).not.toBeNull();
    const topRow = createWorkspaceGridPlacement(largeCanvas, spec!, 0, 0, 3, 1);
    const topCenter = createWorkspaceGridPlacement(largeCanvas, spec!, 1, 0);
    const center = createWorkspaceGridPlacement(largeCanvas, spec!, 1, 1);
    const occupied = [occupantFrom('top-row', topRow)];

    expect(workspaceGridPlacementIsOccupied(topCenter, occupied, 'moving-panel')).toBe(true);
    expect(workspaceGridPlacementIsOccupied(center, occupied, 'moving-panel')).toBe(false);
    expect(workspaceGridPlacementIsOccupied(topCenter, occupied, 'top-row')).toBe(false);
  });

  it('uses rect fallback for same-grid occupants whose resized rect no longer matches cell metadata', () => {
    const spec = workspaceGridSpecForKey('3x3');
    expect(spec).not.toBeNull();
    const leftMiddle = createWorkspaceGridPlacement(largeCanvas, spec!, 0, 1);
    const centerMiddle = createWorkspaceGridPlacement(largeCanvas, spec!, 1, 1);
    const resizedLeftMiddle = {
      ...occupantFrom('left-middle', leftMiddle),
      rect: {
        ...leftMiddle.rect,
        width: leftMiddle.rect.width + centerMiddle.rect.width * 0.5,
      },
    };

    expect(workspaceGridPlacementIsOccupied(centerMiddle, [resizedLeftMiddle], 'moving-panel')).toBe(true);
  });

  it('selects a 3x3 center cell when an interior hole is available', () => {
    const spec = workspaceGridSpecForKey('3x3');
    expect(spec).not.toBeNull();
    const center = createWorkspaceGridPlacement(largeCanvas, spec!, 1, 1);
    const occupants = [
      occupantFrom('top', createWorkspaceGridPlacement(largeCanvas, spec!, 1, 0)),
      occupantFrom('left', createWorkspaceGridPlacement(largeCanvas, spec!, 0, 1)),
      occupantFrom('right', createWorkspaceGridPlacement(largeCanvas, spec!, 2, 1)),
      occupantFrom('bottom', createWorkspaceGridPlacement(largeCanvas, spec!, 1, 2)),
    ];

    expect(workspaceGridPlacementIsInteriorHole(center, occupants)).toBe(true);

    const selected = selectWorkspaceGridPlacementForPointer({
      canvas: largeCanvas,
      minimums: { minWidth: 300, minHeight: 240 },
      occupants,
      movingPanelId: 'center',
      pointerX: center.rect.x + center.rect.width / 2,
      pointerY: center.rect.y + center.rect.height / 2,
    });

    expect(selected).toMatchObject({
      grid: '3x3',
      column: 1,
      row: 1,
    });
  });

  it('magnetically selects an attached lower cell when the pointer is just over the upper seam', () => {
    const spec = workspaceGridSpecForKey('3x3');
    expect(spec).not.toBeNull();
    const upperLeft = createWorkspaceGridPlacement(largeCanvas, spec!, 0, 0);
    const lowerLeft = createWorkspaceGridPlacement(largeCanvas, spec!, 0, 1);
    const occupants = [occupantFrom('upper-left', upperLeft)];

    const selected = selectWorkspaceGridPlacementForPointer({
      canvas: largeCanvas,
      minimums: { minWidth: 300, minHeight: 240 },
      occupants,
      movingPanelId: 'lower-left',
      pointerX: lowerLeft.rect.x + lowerLeft.rect.width / 2,
      pointerY: lowerLeft.rect.y - 24,
    });

    expect(selected).toMatchObject({
      grid: '4x4',
      column: 0,
      row: 1,
    });
  });

  it('magnetically selects an attached side cell when the pointer is just inside its neighbor', () => {
    const spec = workspaceGridSpecForKey('3x3');
    expect(spec).not.toBeNull();
    const leftMiddle = createWorkspaceGridPlacement(largeCanvas, spec!, 0, 1);
    const centerMiddle = createWorkspaceGridPlacement(largeCanvas, spec!, 1, 1);
    const occupants = [occupantFrom('left-middle', leftMiddle)];

    const selected = selectWorkspaceGridPlacementForPointer({
      canvas: largeCanvas,
      minimums: { minWidth: 300, minHeight: 240 },
      occupants,
      movingPanelId: 'center-middle',
      pointerX: centerMiddle.rect.x - 28,
      pointerY: centerMiddle.rect.y + centerMiddle.rect.height / 2,
    });

    expect(selected).toMatchObject({
      grid: '4x4',
      column: 1,
      row: 1,
    });
  });

  it('does not snap to an empty interior cell without an attached neighbor or hole', () => {
    const selected = selectWorkspaceGridPlacementForPointer({
      canvas: largeCanvas,
      minimums: { minWidth: 300, minHeight: 240 },
      pointerX: largeCanvas.x + largeCanvas.width / 2,
      pointerY: largeCanvas.y + largeCanvas.height / 2,
    });

    expect(selected).toBeNull();
  });

  it('does not select edge or corner placements outside the explicit mosaic canvas', () => {
    const aboveTopBar = selectWorkspaceGridPlacementForPointer({
      canvas: largeCanvas,
      minimums: { minWidth: 300, minHeight: 240 },
      pointerX: largeCanvas.x + largeCanvas.width / 2,
      pointerY: largeCanvas.y - 12,
    });
    const aboveTopRight = selectWorkspaceGridPlacementForPointer({
      canvas: largeCanvas,
      minimums: { minWidth: 300, minHeight: 240 },
      pointerX: largeCanvas.x + largeCanvas.width - 4,
      pointerY: largeCanvas.y - 12,
    });

    expect(aboveTopBar).toBeNull();
    expect(aboveTopRight).toBeNull();
  });

  it('describes workspace-edge join cues for edge snap candidates', () => {
    const spec = workspaceGridSpecForKey('3x3');
    expect(spec).not.toBeNull();
    const rightMiddle = createWorkspaceGridPlacement(largeCanvas, spec!, 2, 1);

    const cues = getWorkspaceJoinCueSegments(rightMiddle, largeCanvas);

    expect(cues).toContainEqual(expect.objectContaining({
      kind: 'workspace-edge',
      side: 'right',
      rect: expect.objectContaining({
        x: rightMiddle.rect.x + rightMiddle.rect.width,
        y: rightMiddle.rect.y,
        width: 0,
        height: rightMiddle.rect.height,
      }),
    }));
  });

  it('describes neighbor-seam join cues for attached candidates', () => {
    const spec = workspaceGridSpecForKey('3x3');
    expect(spec).not.toBeNull();
    const leftMiddle = createWorkspaceGridPlacement(largeCanvas, spec!, 0, 1);
    const centerMiddle = createWorkspaceGridPlacement(largeCanvas, spec!, 1, 1);

    const cues = getWorkspaceJoinCueSegments(
      centerMiddle,
      largeCanvas,
      [occupantFrom('left-middle', leftMiddle)],
      'center-middle',
    );

    expect(cues).toContainEqual(expect.objectContaining({
      kind: 'neighbor-seam',
      side: 'left',
      rect: expect.objectContaining({
        x: centerMiddle.rect.x,
        y: centerMiddle.rect.y,
        width: 0,
        height: centerMiddle.rect.height,
      }),
    }));
  });

  it('keeps outer corner curves around a small panel attached to a longer side', () => {
    const twoByOne = workspaceGridSpecForKey('2x1');
    const fourByTwo = workspaceGridSpecForKey('4x2');
    expect(twoByOne).not.toBeNull();
    expect(fourByTwo).not.toBeNull();
    const longLeft = createWorkspaceGridPlacement(largeCanvas, twoByOne!, 0, 0);
    const smallTopRight = createWorkspaceGridPlacement(largeCanvas, fourByTwo!, 2, 0);

    const state = getWorkspaceMosaicAttachmentState(
      'long-left',
      longLeft.rect,
      [occupantFrom('long-left', longLeft), occupantFrom('small-top-right', smallTopRight)],
    );

    expect(state.right).toBe(true);
    expect(state.topRightRounded).toBe(false);
    expect(state.bottomRightRounded).toBe(true);
    expect(summarizeWorkspaceMosaicRoundedCorners(state)).toContain('bottom-right');
    expect(summarizeWorkspaceMosaicRoundedCorners(state)).not.toContain('top-right');

    const edgeSegments = summarizeWorkspaceMosaicEdgeSegments(getWorkspaceMosaicExposedEdgeSegments(
      'long-left',
      longLeft.rect,
      [occupantFrom('long-left', longLeft), occupantFrom('small-top-right', smallTopRight)],
    ));
    expect(edgeSegments).toContain('right:50-100');
  });

  it('prefers local edge cells over broad legacy regions while preserving edge labels', () => {
    const preferredNotesSize = {
      minWidth: 300,
      minHeight: 240,
      preferredWidth: 560,
      preferredHeight: 380,
    };
    const exactRightPlacement = selectWorkspaceGridPlacementForPointer({
      canvas: largeCanvas,
      minimums: preferredNotesSize,
      pointerX: largeCanvas.x + largeCanvas.width - 2,
      pointerY: largeCanvas.y + largeCanvas.height / 2,
    });

    expect(exactRightPlacement).toMatchObject({
      grid: '3x3',
      column: 2,
      row: 1,
      legacyZone: 'right',
    });
    expect(exactRightPlacement!.rect.height).toBeLessThan(largeCanvas.height / 2);

    const insetRightPlacement = selectWorkspaceGridPlacementForPointer({
      canvas: largeCanvas,
      minimums: preferredNotesSize,
      pointerX: largeCanvas.x + largeCanvas.width - 100,
      pointerY: largeCanvas.y + largeCanvas.height / 2,
    });

    expect(insetRightPlacement).toMatchObject({
      grid: '3x3',
      column: 2,
      row: 1,
      columnSpan: 1,
      rowSpan: 1,
    });

    const insetTopRightPlacement = selectWorkspaceGridPlacementForPointer({
      canvas: largeCanvas,
      minimums: preferredNotesSize,
      pointerX: largeCanvas.x + largeCanvas.width - 100,
      pointerY: largeCanvas.y + 100,
    });

    expect(insetTopRightPlacement).toMatchObject({
      grid: '3x3',
      column: 2,
      row: 0,
      legacyZone: 'top-right',
    });
    expect(insetTopRightPlacement!.rect.height).toBeLessThan(largeCanvas.height / 2);
  });

  it('prefers the nearest exposed neighbor seam over a broad top-band allocation', () => {
    const twoByOne = workspaceGridSpecForKey('2x1');
    expect(twoByOne).not.toBeNull();
    const leftPanel = createWorkspaceGridPlacement(largeCanvas, twoByOne!, 0, 0);
    const occupants = [occupantFrom('notes-workspace', leftPanel)];

    const selected = selectWorkspaceGridPlacementForPointer({
      canvas: largeCanvas,
      minimums: {
        minWidth: 300,
        minHeight: 240,
        preferredWidth: 360,
        preferredHeight: 340,
      },
      occupants,
      movingPanelId: 'tasks-workspace',
      pointerX: leftPanel.rect.x + leftPanel.rect.width + 18,
      pointerY: largeCanvas.y + 92,
    });

    expect(selected).toMatchObject({
      grid: '4x4',
      column: 2,
      row: 0,
    });
    expect(selected!.rect.x).toBe(leftPanel.rect.x + leftPanel.rect.width);
    expect(selected!.rect.height).toBeLessThan(largeCanvas.height / 2);
    expect(selected!.id).not.toContain('1x2');
  });

  it('selects a below-panel placement when the pointer is on a horizontal neighbor seam', () => {
    const fourByFour = workspaceGridSpecForKey('4x4');
    expect(fourByFour).not.toBeNull();
    const upperLeft = createWorkspaceGridPlacement(largeCanvas, fourByFour!, 0, 0);
    const occupants = [occupantFrom('notes-workspace', upperLeft)];

    const selected = selectWorkspaceGridPlacementForPointer({
      canvas: largeCanvas,
      minimums: {
        minWidth: 300,
        minHeight: 240,
        preferredWidth: 360,
        preferredHeight: 340,
      },
      occupants,
      movingPanelId: 'tasks-workspace',
      pointerX: upperLeft.rect.x + upperLeft.rect.width / 2,
      pointerY: upperLeft.rect.y + upperLeft.rect.height + 2,
    });

    expect(selected).toMatchObject({
      grid: '4x4',
      column: 0,
      row: 1,
    });
    expect(selected!.rect.y).toBe(upperLeft.rect.y + upperLeft.rect.height);
    expect(getWorkspaceJoinCueSegments(selected!, largeCanvas, occupants, 'tasks-workspace')).toContainEqual(
      expect.objectContaining({
        kind: 'neighbor-seam',
        side: 'top',
      }),
    );
  });

  it('uses anchored spans for large panels that cannot fit a single edge cell', () => {
    const rightPlacement = selectWorkspaceGridPlacementForPointer({
      canvas: mediumCanvas,
      minimums: { minWidth: 680, minHeight: 500 },
      pointerX: mediumCanvas.x + mediumCanvas.width - 2,
      pointerY: mediumCanvas.y + mediumCanvas.height / 2,
    });

    expect(rightPlacement).toMatchObject({
      grid: '3x3',
      column: 1,
      row: 1,
      columnSpan: 2,
      rowSpan: 2,
      legacyZone: 'right',
    });
    expect(rightPlacement!.rect.width).toBeGreaterThanOrEqual(680);
    expect(rightPlacement!.rect.height).toBeGreaterThanOrEqual(500);

    const cornerPlacement = selectWorkspaceGridPlacementForPointer({
      canvas: mediumCanvas,
      minimums: { minWidth: 680, minHeight: 500 },
      pointerX: mediumCanvas.x + 2,
      pointerY: mediumCanvas.y + 2,
    });

    expect(cornerPlacement).toMatchObject({
      grid: '3x3',
      column: 0,
      row: 0,
      columnSpan: 2,
      rowSpan: 2,
      legacyZone: 'top-left',
    });
    expect(cornerPlacement!.rect.width).toBeGreaterThanOrEqual(680);
    expect(cornerPlacement!.rect.height).toBeGreaterThanOrEqual(500);
  });

  it('keeps placement state ready for future variable-span mosaic tiles', () => {
    const placement = listWorkspaceGridPlacements(largeCanvas, { minWidth: 300, minHeight: 240 })[0];
    const state = workspacePanelPlacementFromGridPlacement(placement);

    expect(state).toMatchObject({
      kind: 'affixed',
      columnSpan: 1,
      rowSpan: 1,
    });
  });
});

function occupantFrom(id: string, placement: WorkspaceGridPlacement) {
  return {
    id,
    rect: placement.rect,
    placement: workspacePanelPlacementFromGridPlacement(placement),
  };
}
