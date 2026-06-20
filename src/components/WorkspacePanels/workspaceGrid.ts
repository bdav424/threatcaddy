import type { WorkspacePanelGeometry } from './workspace-panel-context';

export type WorkspaceGridKey = '1x1' | '1x2' | '2x1' | '2x2' | '3x2' | '3x3' | '4x2' | '4x1' | '4x4';

export type WorkspaceCanvasRect = WorkspacePanelGeometry;

export interface WorkspaceGridSpec {
  key: WorkspaceGridKey;
  columns: number;
  rows: number;
}

export interface WorkspaceGridMinimums {
  minWidth: number;
  minHeight: number;
  preferredWidth?: number;
  preferredHeight?: number;
}

export interface WorkspaceGridOccupant {
  id: string;
  rect: WorkspacePanelGeometry;
  placement?: WorkspacePanelPlacementState | null;
}

export interface WorkspaceGridPlacement {
  id: string;
  grid: WorkspaceGridKey;
  columns: number;
  rows: number;
  column: number;
  row: number;
  columnSpan: number;
  rowSpan: number;
  rect: WorkspacePanelGeometry;
  legacyZone: WorkspaceLegacySnapZone | null;
}

export interface WorkspaceGridCell {
  column: number;
  row: number;
}

export type WorkspaceMosaicSide = 'left' | 'right' | 'top' | 'bottom';

export interface WorkspaceMosaicEdgeSegment {
  side: WorkspaceMosaicSide;
  startPercent: number;
  endPercent: number;
}

export type WorkspaceJoinCueKind = 'workspace-edge' | 'neighbor-seam';

export interface WorkspaceJoinCueSegment {
  side: WorkspaceMosaicSide;
  kind: WorkspaceJoinCueKind;
  rect: WorkspacePanelGeometry;
}

export interface WorkspaceMosaicAttachmentState {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
  topLeftRounded: boolean;
  topRightRounded: boolean;
  bottomLeftRounded: boolean;
  bottomRightRounded: boolean;
}

export type WorkspacePanelPlacementState =
  | { kind: 'free' }
  | {
      kind: 'affixed';
      id: string;
      grid: WorkspaceGridKey;
      columns: number;
      rows: number;
      column: number;
      row: number;
      columnSpan: number;
      rowSpan: number;
      rect: WorkspacePanelGeometry;
      legacyZone: WorkspaceLegacySnapZone | null;
    };

export type WorkspaceLegacySnapZone =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export const WORKSPACE_GRID_SPECS: readonly WorkspaceGridSpec[] = [
  { key: '1x1', columns: 1, rows: 1 },
  { key: '1x2', columns: 1, rows: 2 },
  { key: '2x1', columns: 2, rows: 1 },
  { key: '2x2', columns: 2, rows: 2 },
  { key: '3x2', columns: 3, rows: 2 },
  { key: '3x3', columns: 3, rows: 3 },
  { key: '4x2', columns: 4, rows: 2 },
  { key: '4x1', columns: 4, rows: 1 },
  { key: '4x4', columns: 4, rows: 4 },
];

const SIDE_GRID_ORDER: WorkspaceGridKey[] = ['3x3', '4x1', '2x1', '1x1'];
const EDGE_GRID_ORDER: WorkspaceGridKey[] = ['3x3', '4x2', '3x2', '2x2', '1x2', '1x1'];
const CORNER_GRID_ORDER: WorkspaceGridKey[] = ['4x4', '3x3', '4x2', '3x2', '2x2', '1x2', '2x1', '1x1'];
const LEGACY_SIDE_GRID_ORDER: WorkspaceGridKey[] = ['2x1', '4x1', '1x1'];
const LEGACY_EDGE_GRID_ORDER: WorkspaceGridKey[] = ['1x2', '2x2', '3x2', '4x2', '1x1'];
const LEGACY_CORNER_GRID_ORDER: WorkspaceGridKey[] = ['2x2', '4x4', '4x2', '3x2', '1x2', '2x1', '1x1'];
const INTERIOR_GRID_ORDER: WorkspaceGridKey[] = ['3x3', '4x4', '4x2', '3x2', '2x2', '4x1', '2x1', '1x2', '1x1'];
const MOSAIC_ATTACH_TOLERANCE = 3;
const MOSAIC_CORNER_ATTACH_TOLERANCE = 24;
const ATTACHED_PLACEMENT_MAGNET_DISTANCE = 56;
const LOCAL_SEAM_MAGNET_DISTANCE = 96;

export function readWorkspaceCanvasRect(): WorkspaceCanvasRect {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { x: 8, y: 8, width: 1272, height: 792 };
  }

  const explicitWorkspaceCanvases = visibleWorkspaceRects('[data-workspace-mosaic-canvas="true"]');
  if (explicitWorkspaceCanvases.length > 0) {
    return rectUnion(explicitWorkspaceCanvases);
  }

  const visibleWorkspaceCanvases = Array.from(document.querySelectorAll<HTMLElement>(
    '[data-app-workspace-home="true"], [data-app-workspace-pane="active"], [data-assistantcaddy-shell-pane="active"]',
  )).flatMap((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width >= 320 && rect.height >= 240 && rect.bottom > 0 && rect.right > 0 ? [rect] : [];
  });

  if (visibleWorkspaceCanvases.length > 0) {
    return rectUnion(visibleWorkspaceCanvases);
  }

  let left = 8;
  let top = 8;
  const sidebar = document.querySelector('.app-window-sidebar');
  if (sidebar instanceof HTMLElement) {
    const rect = sidebar.getBoundingClientRect();
    if (rect.width > 0 && rect.right > 0 && rect.right < window.innerWidth * 0.65) {
      left = Math.max(left, Math.round(rect.right) + 8);
    }
  }

  const titlebar = document.querySelector('[data-tour="header"]');
  if (titlebar instanceof HTMLElement) {
    const rect = titlebar.getBoundingClientRect();
    if (rect.height > 0 && rect.bottom > 0 && rect.bottom < window.innerHeight * 0.35) {
      top = Math.max(top, Math.round(rect.bottom) + 8);
    }
  }

  const right = Math.max(left + 320, window.innerWidth - 8);
  const bottom = Math.max(top + 320, window.innerHeight - 8);

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function visibleWorkspaceRects(selector: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).flatMap((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width >= 320 && rect.height >= 240 && rect.bottom > 0 && rect.right > 0 ? [rect] : [];
  });
}

function rectUnion(rects: readonly DOMRect[]) {
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.round(right - left),
    height: Math.round(bottom - top),
  };
}

export function workspaceGridFits(
  canvas: WorkspaceCanvasRect,
  minimums: WorkspaceGridMinimums,
  spec: WorkspaceGridSpec,
) {
  return canvas.width / spec.columns >= minimums.minWidth
    && canvas.height / spec.rows >= minimums.minHeight;
}

export function workspaceGridSpecForKey(key: WorkspaceGridKey) {
  return WORKSPACE_GRID_SPECS.find((spec) => spec.key === key) ?? null;
}

export function getSafeWorkspaceGridKeys(
  canvas: WorkspaceCanvasRect,
  minimums: WorkspaceGridMinimums,
) {
  return WORKSPACE_GRID_SPECS
    .filter((spec) => workspaceGridFits(canvas, minimums, spec))
    .map((spec) => spec.key);
}

export function listWorkspaceGridPlacements(
  canvas: WorkspaceCanvasRect,
  minimums: WorkspaceGridMinimums,
  occupants: readonly WorkspaceGridOccupant[] = [],
  movingPanelId = '',
) {
  return WORKSPACE_GRID_SPECS
    .filter((spec) => workspaceGridFits(canvas, minimums, spec))
    .flatMap((spec) => {
      const placements: WorkspaceGridPlacement[] = [];
      for (let row = 0; row < spec.rows; row += 1) {
        for (let column = 0; column < spec.columns; column += 1) {
          const placement = createWorkspaceGridPlacement(canvas, spec, column, row);
          if (!workspaceGridPlacementIsOccupied(placement, occupants, movingPanelId)) {
            placements.push(placement);
          }
        }
      }
      return placements;
    });
}

export function selectWorkspaceGridPlacementForPointer({
  canvas,
  minimums,
  occupants = [],
  movingPanelId = '',
  pointerX,
  pointerY,
  edgeThreshold = 30,
  cornerThreshold = 160,
}: {
  canvas: WorkspaceCanvasRect;
  minimums: WorkspaceGridMinimums;
  occupants?: readonly WorkspaceGridOccupant[];
  movingPanelId?: string;
  pointerX: number;
  pointerY: number;
  edgeThreshold?: number;
  cornerThreshold?: number;
}) {
  if (canvas.width < minimums.minWidth || canvas.height < minimums.minHeight) {
    return null;
  }

  if (
    pointerX < canvas.x
    || pointerX > canvas.x + canvas.width
    || pointerY < canvas.y
    || pointerY > canvas.y + canvas.height
  ) {
    return null;
  }

  const nearLeft = pointerX <= canvas.x + edgeThreshold;
  const nearRight = pointerX >= canvas.x + canvas.width - edgeThreshold;
  const nearTop = pointerY <= canvas.y + edgeThreshold;
  const nearBottom = pointerY >= canvas.y + canvas.height - edgeThreshold;
  const cornerLeft = pointerX <= canvas.x + cornerThreshold;
  const cornerRight = pointerX >= canvas.x + canvas.width - cornerThreshold;
  const cornerTop = pointerY <= canvas.y + cornerThreshold;
  const cornerBottom = pointerY >= canvas.y + canvas.height - cornerThreshold;
  const activeLeft = nearLeft || cornerLeft;
  const activeRight = nearRight || cornerRight;
  const activeTop = nearTop || cornerTop;
  const activeBottom = nearBottom || cornerBottom;
  const cornerActive = (cornerLeft || cornerRight) && (cornerTop || cornerBottom);
  const sideOnly = (activeLeft || activeRight) && !(activeTop || activeBottom);
  const edgeOnly = (activeTop || activeBottom) && !(activeLeft || activeRight);
  const exactCornerActive = (nearLeft || nearRight) && (nearTop || nearBottom);
  const exactSideOnly = (nearLeft || nearRight) && !(nearTop || nearBottom);
  const exactEdgeOnly = (nearTop || nearBottom) && !(nearLeft || nearRight);

  const interiorPlacement = selectInteriorWorkspaceGridPlacement({
    canvas,
    minimums,
    occupants,
    movingPanelId,
    pointerX,
    pointerY,
  });

  const nearestSeamPlacement = selectNearestSeamWorkspaceGridPlacement({
    canvas,
    minimums,
    occupants,
    movingPanelId,
    pointerX,
    pointerY,
    activeLeft,
    activeRight,
    activeTop,
    activeBottom,
    borderMagnetDistance: Math.max(edgeThreshold, cornerThreshold),
  });
  if (nearestSeamPlacement) {
    return nearestSeamPlacement;
  }

  if (!activeLeft && !activeRight && !activeTop && !activeBottom) {
    return interiorPlacement;
  }

  const gridOrder = exactCornerActive
    ? LEGACY_CORNER_GRID_ORDER
    : exactSideOnly
      ? LEGACY_SIDE_GRID_ORDER
      : exactEdgeOnly
        ? LEGACY_EDGE_GRID_ORDER
        : cornerActive
          ? CORNER_GRID_ORDER
          : sideOnly
            ? SIDE_GRID_ORDER
            : edgeOnly
              ? EDGE_GRID_ORDER
              : CORNER_GRID_ORDER;

  for (const gridKey of gridOrder) {
    if (gridKey === '1x1') continue;
    const spec = WORKSPACE_GRID_SPECS.find((candidate) => candidate.key === gridKey);
    if (!spec || !workspaceGridFits(canvas, minimums, spec)) continue;

    const column = activeLeft
      ? 0
      : activeRight
        ? spec.columns - 1
        : clampGridIndex(Math.floor((pointerX - canvas.x) / (canvas.width / spec.columns)), spec.columns);
    const row = activeTop
      ? 0
      : activeBottom
        ? spec.rows - 1
        : clampGridIndex(Math.floor((pointerY - canvas.y) / (canvas.height / spec.rows)), spec.rows);
    const placement = createWorkspaceGridPlacement(canvas, spec, column, row);
    if (!workspaceGridPlacementIsOccupied(placement, occupants, movingPanelId)) {
      return placement;
    }
  }

  const adaptiveEdgePlacement = selectAdaptiveAnchoredGridPlacement({
    canvas,
    minimums,
    occupants,
    movingPanelId,
    pointerX,
    pointerY,
    activeLeft,
    activeRight,
    activeTop,
    activeBottom,
    gridOrder: cornerActive
      ? CORNER_GRID_ORDER
      : sideOnly
        ? SIDE_GRID_ORDER
        : edgeOnly
          ? EDGE_GRID_ORDER
          : gridOrder,
  });
  if (adaptiveEdgePlacement) {
    return adaptiveEdgePlacement;
  }

  if (gridOrder.includes('1x1')) {
    const fullCanvasSpec = workspaceGridSpecForKey('1x1');
    if (fullCanvasSpec && workspaceGridFits(canvas, minimums, fullCanvasSpec)) {
      const placement = createWorkspaceGridPlacement(canvas, fullCanvasSpec, 0, 0);
      if (!workspaceGridPlacementIsOccupied(placement, occupants, movingPanelId)) {
        return {
          ...placement,
          legacyZone: legacySnapZoneForActiveSides(activeLeft, activeRight, activeTop, activeBottom),
        };
      }
    }
  }

  return interiorPlacement;
}

function selectNearestSeamWorkspaceGridPlacement({
  canvas,
  minimums,
  occupants,
  movingPanelId,
  pointerX,
  pointerY,
  activeLeft,
  activeRight,
  activeTop,
  activeBottom,
  borderMagnetDistance,
}: {
  canvas: WorkspaceCanvasRect;
  minimums: WorkspaceGridMinimums;
  occupants: readonly WorkspaceGridOccupant[];
  movingPanelId: string;
  pointerX: number;
  pointerY: number;
  activeLeft: boolean;
  activeRight: boolean;
  activeTop: boolean;
  activeBottom: boolean;
  borderMagnetDistance: number;
}) {
  let bestPlacement: WorkspaceGridPlacement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  const preferredWidth = Math.max(minimums.minWidth, minimums.preferredWidth ?? minimums.minWidth);
  const preferredHeight = Math.max(minimums.minHeight, minimums.preferredHeight ?? minimums.minHeight);

  const considerPlacement = (
    placement: WorkspaceGridPlacement,
    gridIndex: number,
    spec: WorkspaceGridSpec,
  ) => {
    if (workspaceGridPlacementIsOccupied(placement, occupants, movingPanelId)) return;

    const attachment = nearestPlacementAttachment({
      placement,
      canvas,
      occupants,
      movingPanelId,
      pointerX,
      pointerY,
      activeLeft,
      activeRight,
      activeTop,
      activeBottom,
      borderMagnetDistance,
    });
    if (!attachment) return;

    const centerDistance = distanceBetweenPoints(
      pointerX,
      pointerY,
      placement.rect.x + placement.rect.width / 2,
      placement.rect.y + placement.rect.height / 2,
    );
    const area = placement.rect.width * placement.rect.height;
    const sizeDelta = Math.abs(placement.rect.width - preferredWidth)
      + Math.abs(placement.rect.height - preferredHeight);
    const expectedColumn = anchoredSpanStart({
      activeStart: activeLeft,
      activeEnd: activeRight,
      pointerOffset: pointerX - canvas.x,
      axisSize: canvas.width,
      cells: spec.columns,
      span: placement.columnSpan,
    });
    const expectedRow = anchoredSpanStart({
      activeStart: activeTop,
      activeEnd: activeBottom,
      pointerOffset: pointerY - canvas.y,
      axisSize: canvas.height,
      cells: spec.rows,
      span: placement.rowSpan,
    });
    const pointerAlignmentPenalty = Math.abs(placement.column - expectedColumn) + Math.abs(placement.row - expectedRow);
    const score = attachment.distance * 1_000_000
      + attachment.priority * 100_000
      + sizeDelta * 1_000
      + pointerAlignmentPenalty * 100
      + centerDistance
      + area / 100_000
      + gridIndex / 100;
    if (score < bestScore) {
      bestPlacement = {
        ...placement,
        legacyZone: attachment.legacyZone ?? placement.legacyZone,
      };
      bestScore = score;
    }
  };

  createDirectNeighborSeamPlacements({
    canvas,
    minimums,
    occupants,
    movingPanelId,
    pointerX,
    pointerY,
    preferredWidth,
    preferredHeight,
  }).forEach(({ placement, spec }) => considerPlacement(placement, -1, spec));

  for (const [gridIndex, gridKey] of INTERIOR_GRID_ORDER.entries()) {
    if (gridKey === '1x1') continue;
    const spec = workspaceGridSpecForKey(gridKey);
    if (!spec) continue;
    const minimumColumnSpan = minimumSpanForAxis(canvas.width, spec.columns, minimums.minWidth);
    const minimumRowSpan = minimumSpanForAxis(canvas.height, spec.rows, minimums.minHeight);
    if (!minimumColumnSpan || !minimumRowSpan) continue;

    for (let row = 0; row < spec.rows; row += 1) {
      for (let column = 0; column < spec.columns; column += 1) {
        for (let rowSpan = minimumRowSpan; rowSpan <= spec.rows - row; rowSpan += 1) {
          for (let columnSpan = minimumColumnSpan; columnSpan <= spec.columns - column; columnSpan += 1) {
            const placement = createWorkspaceGridPlacement(canvas, spec, column, row, columnSpan, rowSpan);
            considerPlacement(placement, gridIndex, spec);
          }
        }
      }
    }
  }

  return bestPlacement;
}

function createDirectNeighborSeamPlacements({
  canvas,
  minimums,
  occupants,
  movingPanelId,
  pointerX,
  pointerY,
  preferredWidth,
  preferredHeight,
}: {
  canvas: WorkspaceCanvasRect;
  minimums: WorkspaceGridMinimums;
  occupants: readonly WorkspaceGridOccupant[];
  movingPanelId: string;
  pointerX: number;
  pointerY: number;
  preferredWidth: number;
  preferredHeight: number;
}) {
  const canvasRight = canvas.x + canvas.width;
  const canvasBottom = canvas.y + canvas.height;
  const seamSpec = workspaceGridSpecForKey('4x4') ?? WORKSPACE_GRID_SPECS[WORKSPACE_GRID_SPECS.length - 1];
  const candidates: Array<{ placement: WorkspaceGridPlacement; spec: WorkspaceGridSpec }> = [];

  const addCandidate = (placement: WorkspaceGridPlacement) => {
    const rect = placement.rect;
    if (rect.width < minimums.minWidth || rect.height < minimums.minHeight) return;
    if (rect.x < canvas.x - 1 || rect.y < canvas.y - 1) return;
    if (rect.x + rect.width > canvasRight + 1 || rect.y + rect.height > canvasBottom + 1) return;
    candidates.push({
      placement,
      spec: seamSpec,
    });
  };

  occupants.forEach((occupant) => {
    if (occupant.id === movingPanelId) return;
    const other = occupant.rect;
    const otherRight = other.x + other.width;
    const otherBottom = other.y + other.height;
    const horizontalDistance = pointerX < other.x ? other.x - pointerX : pointerX > otherRight ? pointerX - otherRight : 0;
    const verticalDistance = pointerY < other.y ? other.y - pointerY : pointerY > otherBottom ? pointerY - otherBottom : 0;
    const width = Math.min(preferredWidth, canvas.width);
    const height = Math.min(preferredHeight, canvas.height);
    const anchorPlacement = occupant.placement?.kind === 'affixed' && occupant.placement.grid === seamSpec.key
      ? occupant.placement
      : null;
    const anchorColumnSpan = (rect: WorkspacePanelGeometry) => Math.max(
      1,
      Math.min(
        seamSpec.columns,
        minimumSpanForAxis(canvas.width, seamSpec.columns, rect.width) ?? 1,
      ),
    );
    const anchorRowSpan = (rect: WorkspacePanelGeometry) => Math.max(
      1,
      Math.min(
        seamSpec.rows,
        minimumSpanForAxis(canvas.height, seamSpec.rows, rect.height) ?? 1,
      ),
    );
    const anchoredPlacement = (
      id: string,
      rect: WorkspacePanelGeometry,
      column: number,
      row: number,
      columnSpan: number,
      rowSpan: number,
    ) => createAnchoredRectWorkspacePlacement(id, rect, {
      grid: seamSpec.key,
      columns: seamSpec.columns,
      rows: seamSpec.rows,
      column: clampNumber(column, 0, seamSpec.columns - columnSpan),
      row: clampNumber(row, 0, seamSpec.rows - rowSpan),
      columnSpan,
      rowSpan,
    });

    if (Math.abs(pointerY - otherBottom) <= LOCAL_SEAM_MAGNET_DISTANCE && horizontalDistance <= LOCAL_SEAM_MAGNET_DISTANCE) {
      const belowHeight = Math.min(height, canvasBottom - otherBottom);
      const belowWidth = Math.min(width, canvas.width);
      const rect = {
        x: clampAttachedAxisStart(pointerX - belowWidth / 2, belowWidth, other.x, otherRight, canvas.x, canvasRight),
        y: otherBottom,
        width: belowWidth,
        height: belowHeight,
      };
      const columnSpan = anchorColumnSpan(rect);
      const rowSpan = anchorRowSpan(rect);
      addCandidate(anchorPlacement ? anchoredPlacement(
        `neighbor-below-${occupant.id}`,
        rect,
        Math.floor((rect.x - canvas.x) / (canvas.width / seamSpec.columns)),
        anchorPlacement.row + anchorPlacement.rowSpan,
        columnSpan,
        rowSpan,
      ) : createSeamRectWorkspacePlacement(canvas, seamSpec, `neighbor-below-${occupant.id}`, rect, 'bottom', otherBottom));
    }

    if (Math.abs(pointerY - other.y) <= LOCAL_SEAM_MAGNET_DISTANCE && horizontalDistance <= LOCAL_SEAM_MAGNET_DISTANCE) {
      const aboveHeight = Math.min(height, other.y - canvas.y);
      const aboveWidth = Math.min(width, canvas.width);
      const rect = {
        x: clampAttachedAxisStart(pointerX - aboveWidth / 2, aboveWidth, other.x, otherRight, canvas.x, canvasRight),
        y: other.y - aboveHeight,
        width: aboveWidth,
        height: aboveHeight,
      };
      const columnSpan = anchorColumnSpan(rect);
      const rowSpan = anchorRowSpan(rect);
      addCandidate(anchorPlacement ? anchoredPlacement(
        `neighbor-above-${occupant.id}`,
        rect,
        Math.floor((rect.x - canvas.x) / (canvas.width / seamSpec.columns)),
        anchorPlacement.row - rowSpan,
        columnSpan,
        rowSpan,
      ) : createSeamRectWorkspacePlacement(canvas, seamSpec, `neighbor-above-${occupant.id}`, rect, 'top', other.y));
    }

    if (Math.abs(pointerX - otherRight) <= LOCAL_SEAM_MAGNET_DISTANCE && verticalDistance <= LOCAL_SEAM_MAGNET_DISTANCE) {
      const rightWidth = Math.min(width, canvasRight - otherRight);
      const rightHeight = Math.min(height, canvas.height);
      const rect = {
        x: otherRight,
        y: clampAttachedAxisStart(pointerY - rightHeight / 2, rightHeight, other.y, otherBottom, canvas.y, canvasBottom),
        width: rightWidth,
        height: rightHeight,
      };
      const columnSpan = anchorColumnSpan(rect);
      const rowSpan = anchorRowSpan(rect);
      addCandidate(anchorPlacement ? anchoredPlacement(
        `neighbor-right-${occupant.id}`,
        rect,
        anchorPlacement.column + anchorPlacement.columnSpan,
        Math.floor((rect.y - canvas.y) / (canvas.height / seamSpec.rows)),
        columnSpan,
        rowSpan,
      ) : createSeamRectWorkspacePlacement(canvas, seamSpec, `neighbor-right-${occupant.id}`, rect, 'right', otherRight));
    }

    if (Math.abs(pointerX - other.x) <= LOCAL_SEAM_MAGNET_DISTANCE && verticalDistance <= LOCAL_SEAM_MAGNET_DISTANCE) {
      const leftWidth = Math.min(width, other.x - canvas.x);
      const leftHeight = Math.min(height, canvas.height);
      const rect = {
        x: other.x - leftWidth,
        y: clampAttachedAxisStart(pointerY - leftHeight / 2, leftHeight, other.y, otherBottom, canvas.y, canvasBottom),
        width: leftWidth,
        height: leftHeight,
      };
      const columnSpan = anchorColumnSpan(rect);
      const rowSpan = anchorRowSpan(rect);
      addCandidate(anchorPlacement ? anchoredPlacement(
        `neighbor-left-${occupant.id}`,
        rect,
        anchorPlacement.column - columnSpan,
        Math.floor((rect.y - canvas.y) / (canvas.height / seamSpec.rows)),
        columnSpan,
        rowSpan,
      ) : createSeamRectWorkspacePlacement(canvas, seamSpec, `neighbor-left-${occupant.id}`, rect, 'left', other.x));
    }
  });

  return candidates;
}

function clampAttachedAxisStart(
  preferredStart: number,
  size: number,
  neighborStart: number,
  neighborEnd: number,
  canvasStart: number,
  canvasEnd: number,
) {
  const canvasMinimum = canvasStart;
  const canvasMaximum = canvasEnd - size;
  if (neighborEnd - neighborStart >= size) {
    return clampNumber(
      preferredStart,
      Math.max(canvasMinimum, neighborStart),
      Math.min(canvasMaximum, neighborEnd - size),
    );
  }

  return clampNumber(preferredStart, canvasMinimum, canvasMaximum);
}

function createAnchoredRectWorkspacePlacement(
  id: string,
  rect: WorkspacePanelGeometry,
  gridPosition: Pick<WorkspaceGridPlacement, 'grid' | 'columns' | 'rows' | 'column' | 'row' | 'columnSpan' | 'rowSpan'>,
): WorkspaceGridPlacement {
  return {
    id,
    grid: gridPosition.grid,
    columns: gridPosition.columns,
    rows: gridPosition.rows,
    column: gridPosition.column,
    row: gridPosition.row,
    columnSpan: gridPosition.columnSpan,
    rowSpan: gridPosition.rowSpan,
    rect,
    legacyZone: null,
  };
}

function createSeamRectWorkspacePlacement(
  canvas: WorkspaceCanvasRect,
  spec: WorkspaceGridSpec,
  id: string,
  rect: WorkspacePanelGeometry,
  seamSide: WorkspaceMosaicSide,
  seamCoordinate: number,
): WorkspaceGridPlacement {
  const placement = createExactRectWorkspacePlacement(canvas, spec, id, rect);
  const cellWidth = canvas.width / spec.columns;
  const cellHeight = canvas.height / spec.rows;

  if (seamSide === 'bottom') {
    const row = clampNumber(Math.floor((seamCoordinate - canvas.y + MOSAIC_ATTACH_TOLERANCE) / cellHeight), 0, spec.rows - 1);
    return {
      ...placement,
      row,
      rowSpan: clampSpan(placement.rowSpan, spec.rows - row),
    };
  }

  if (seamSide === 'top') {
    const bottomRow = clampNumber(Math.ceil((seamCoordinate - canvas.y - MOSAIC_ATTACH_TOLERANCE) / cellHeight), 1, spec.rows);
    const rowSpan = clampSpan(placement.rowSpan, bottomRow);
    return {
      ...placement,
      row: bottomRow - rowSpan,
      rowSpan,
    };
  }

  if (seamSide === 'right') {
    const column = clampNumber(Math.floor((seamCoordinate - canvas.x + MOSAIC_ATTACH_TOLERANCE) / cellWidth), 0, spec.columns - 1);
    return {
      ...placement,
      column,
      columnSpan: clampSpan(placement.columnSpan, spec.columns - column),
    };
  }

  const rightColumn = clampNumber(Math.ceil((seamCoordinate - canvas.x - MOSAIC_ATTACH_TOLERANCE) / cellWidth), 1, spec.columns);
  const columnSpan = clampSpan(placement.columnSpan, rightColumn);
  return {
    ...placement,
    column: rightColumn - columnSpan,
    columnSpan,
  };
}

function createExactRectWorkspacePlacement(
  canvas: WorkspaceCanvasRect,
  spec: WorkspaceGridSpec,
  id: string,
  rect: WorkspacePanelGeometry,
): WorkspaceGridPlacement {
  const cellWidth = canvas.width / spec.columns;
  const cellHeight = canvas.height / spec.rows;
  const column = clampGridIndex(Math.floor((rect.x - canvas.x) / cellWidth), spec.columns);
  const row = clampGridIndex(Math.floor((rect.y - canvas.y) / cellHeight), spec.rows);
  const rightColumn = Math.min(
    spec.columns,
    Math.max(column + 1, Math.ceil((rect.x + rect.width - canvas.x) / cellWidth)),
  );
  const bottomRow = Math.min(
    spec.rows,
    Math.max(row + 1, Math.ceil((rect.y + rect.height - canvas.y) / cellHeight)),
  );
  return {
    id,
    grid: spec.key,
    columns: spec.columns,
    rows: spec.rows,
    column,
    row,
    columnSpan: clampSpan(rightColumn - column, spec.columns - column),
    rowSpan: clampSpan(bottomRow - row, spec.rows - row),
    rect,
    legacyZone: null,
  };
}

function nearestPlacementAttachment({
  placement,
  canvas,
  occupants,
  movingPanelId,
  pointerX,
  pointerY,
  activeLeft,
  activeRight,
  activeTop,
  activeBottom,
  borderMagnetDistance,
}: {
  placement: WorkspaceGridPlacement;
  canvas: WorkspaceCanvasRect;
  occupants: readonly WorkspaceGridOccupant[];
  movingPanelId: string;
  pointerX: number;
  pointerY: number;
  activeLeft: boolean;
  activeRight: boolean;
  activeTop: boolean;
  activeBottom: boolean;
  borderMagnetDistance: number;
}) {
  const rect = placement.rect;
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const canvasRight = canvas.x + canvas.width;
  const canvasBottom = canvas.y + canvas.height;
  const attachments: Array<{
    distance: number;
    priority: number;
    legacyZone: WorkspaceLegacySnapZone | null;
  }> = [];
  const touchesLeft = Math.abs(rect.x - canvas.x) <= MOSAIC_ATTACH_TOLERANCE;
  const touchesRight = Math.abs(right - canvasRight) <= MOSAIC_ATTACH_TOLERANCE;
  const touchesTop = Math.abs(rect.y - canvas.y) <= MOSAIC_ATTACH_TOLERANCE;
  const touchesBottom = Math.abs(bottom - canvasBottom) <= MOSAIC_ATTACH_TOLERANCE;
  const edgeLegacyZone = legacySnapZoneForActiveSides(
    activeLeft && touchesLeft,
    activeRight && touchesRight,
    activeTop && touchesTop,
    activeBottom && touchesBottom,
  );

  const addWorkspaceEdgeAttachment = (
    active: boolean,
    touches: boolean,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    fallbackZone: WorkspaceLegacySnapZone,
  ) => {
    if (!active || !touches) return;
    const distance = distanceFromPointToSegment(pointerX, pointerY, x1, y1, x2, y2);
    if (distance > borderMagnetDistance) return;
    attachments.push({
      distance,
      priority: 1,
      legacyZone: edgeLegacyZone ?? fallbackZone,
    });
  };

  addWorkspaceEdgeAttachment(activeLeft, touchesLeft, rect.x, rect.y, rect.x, bottom, 'left');
  addWorkspaceEdgeAttachment(activeRight, touchesRight, right, rect.y, right, bottom, 'right');
  addWorkspaceEdgeAttachment(activeTop, touchesTop, rect.x, rect.y, right, rect.y, 'top');
  addWorkspaceEdgeAttachment(activeBottom, touchesBottom, rect.x, bottom, right, bottom, 'bottom');

  occupants.forEach((occupant) => {
    if (occupant.id === movingPanelId) return;
    const other = occupant.rect;
    const otherRight = other.x + other.width;
    const otherBottom = other.y + other.height;
    const verticalOverlap = overlapRange(rect.y, bottom, other.y, otherBottom);
    const horizontalOverlap = overlapRange(rect.x, right, other.x, otherRight);

    if (verticalOverlap && Math.abs(otherRight - rect.x) <= MOSAIC_ATTACH_TOLERANCE) {
      const distance = distanceFromPointToSegment(pointerX, pointerY, rect.x, verticalOverlap.start, rect.x, verticalOverlap.end);
      if (distance <= LOCAL_SEAM_MAGNET_DISTANCE) {
        attachments.push({ distance, priority: 0, legacyZone: null });
      }
    }

    if (verticalOverlap && Math.abs(other.x - right) <= MOSAIC_ATTACH_TOLERANCE) {
      const distance = distanceFromPointToSegment(pointerX, pointerY, right, verticalOverlap.start, right, verticalOverlap.end);
      if (distance <= LOCAL_SEAM_MAGNET_DISTANCE) {
        attachments.push({ distance, priority: 0, legacyZone: null });
      }
    }

    if (horizontalOverlap && Math.abs(otherBottom - rect.y) <= MOSAIC_ATTACH_TOLERANCE) {
      const distance = distanceFromPointToSegment(pointerX, pointerY, horizontalOverlap.start, rect.y, horizontalOverlap.end, rect.y);
      if (distance <= LOCAL_SEAM_MAGNET_DISTANCE) {
        attachments.push({ distance, priority: 0, legacyZone: null });
      }
    }

    if (horizontalOverlap && Math.abs(other.y - bottom) <= MOSAIC_ATTACH_TOLERANCE) {
      const distance = distanceFromPointToSegment(pointerX, pointerY, horizontalOverlap.start, bottom, horizontalOverlap.end, bottom);
      if (distance <= LOCAL_SEAM_MAGNET_DISTANCE) {
        attachments.push({ distance, priority: 0, legacyZone: null });
      }
    }
  });

  if (workspaceGridPlacementIsInteriorHole(placement, occupants, movingPanelId)) {
    const distance = distanceFromPointToRect(pointerX, pointerY, rect);
    if (distance <= ATTACHED_PLACEMENT_MAGNET_DISTANCE) {
      attachments.push({ distance, priority: 2, legacyZone: placement.legacyZone });
    }
  }

  if (attachments.length === 0) return null;
  return attachments.sort((left, rightAttachment) => (
    left.distance - rightAttachment.distance
    || left.priority - rightAttachment.priority
  ))[0];
}

function selectAdaptiveAnchoredGridPlacement({
  canvas,
  minimums,
  occupants,
  movingPanelId,
  pointerX,
  pointerY,
  activeLeft,
  activeRight,
  activeTop,
  activeBottom,
  gridOrder,
}: {
  canvas: WorkspaceCanvasRect;
  minimums: WorkspaceGridMinimums;
  occupants: readonly WorkspaceGridOccupant[];
  movingPanelId: string;
  pointerX: number;
  pointerY: number;
  activeLeft: boolean;
  activeRight: boolean;
  activeTop: boolean;
  activeBottom: boolean;
  gridOrder: readonly WorkspaceGridKey[];
}) {
  const legacyZone = legacySnapZoneForActiveSides(activeLeft, activeRight, activeTop, activeBottom);
  if (!legacyZone) return null;

  let best: { placement: WorkspaceGridPlacement; score: number } | null = null;

  for (const [index, gridKey] of gridOrder.entries()) {
    if (gridKey === '1x1') continue;
    const spec = workspaceGridSpecForKey(gridKey);
    if (!spec) continue;

    const columnSpan = minimumSpanForAxis(canvas.width, spec.columns, minimums.minWidth);
    const rowSpan = minimumSpanForAxis(canvas.height, spec.rows, minimums.minHeight);
    if (!columnSpan || !rowSpan) continue;
    if (columnSpan === 1 && rowSpan === 1) continue;

    const column = anchoredSpanStart({
      activeStart: activeLeft,
      activeEnd: activeRight,
      pointerOffset: pointerX - canvas.x,
      axisSize: canvas.width,
      cells: spec.columns,
      span: columnSpan,
    });
    const row = anchoredSpanStart({
      activeStart: activeTop,
      activeEnd: activeBottom,
      pointerOffset: pointerY - canvas.y,
      axisSize: canvas.height,
      cells: spec.rows,
      span: rowSpan,
    });
    const placement = {
      ...createWorkspaceGridPlacement(canvas, spec, column, row, columnSpan, rowSpan),
      legacyZone,
    };
    if (workspaceGridPlacementIsOccupied(placement, occupants, movingPanelId)) continue;

    const area = placement.rect.width * placement.rect.height;
    const score = area + index / 100;
    if (!best || score < best.score) {
      best = { placement, score };
    }
  }

  if (!best) return null;
  return best.placement;
}

function minimumSpanForAxis(axisSize: number, cells: number, minimum: number) {
  if (axisSize < minimum) return null;
  const cellSize = axisSize / cells;
  return Math.min(cells, Math.max(1, Math.ceil(minimum / cellSize)));
}

function anchoredSpanStart({
  activeStart,
  activeEnd,
  pointerOffset,
  axisSize,
  cells,
  span,
}: {
  activeStart: boolean;
  activeEnd: boolean;
  pointerOffset: number;
  axisSize: number;
  cells: number;
  span: number;
}) {
  const maxStart = Math.max(0, cells - span);
  if (activeStart) return 0;
  if (activeEnd) return maxStart;

  const cellSize = axisSize / cells;
  const centeredStart = Math.floor((pointerOffset / cellSize) - ((span - 1) / 2));
  return Math.min(maxStart, Math.max(0, centeredStart));
}

export function summarizeWorkspaceGridKeys(keys: readonly WorkspaceGridKey[]) {
  return Array.from(new Set(keys)).join(' ');
}

export function summarizeWorkspacePlacementIds(placements: readonly WorkspaceGridPlacement[]) {
  return placements.map((placement) => placement.id).join(' ');
}

export function workspacePanelPlacementFromGridPlacement(
  placement: WorkspaceGridPlacement,
): WorkspacePanelPlacementState {
  return {
    kind: 'affixed',
    id: placement.id,
    grid: placement.grid,
    columns: placement.columns,
    rows: placement.rows,
    column: placement.column,
    row: placement.row,
    columnSpan: placement.columnSpan,
    rowSpan: placement.rowSpan,
    rect: placement.rect,
    legacyZone: placement.legacyZone,
  };
}

export function createWorkspaceGridPlacement(
  canvas: WorkspaceCanvasRect,
  spec: WorkspaceGridSpec,
  column: number,
  row: number,
  columnSpan = 1,
  rowSpan = 1,
): WorkspaceGridPlacement {
  const safeColumn = clampGridIndex(column, spec.columns);
  const safeRow = clampGridIndex(row, spec.rows);
  const safeColumnSpan = clampSpan(columnSpan, spec.columns - safeColumn);
  const safeRowSpan = clampSpan(rowSpan, spec.rows - safeRow);
  const left = safeColumn === 0
    ? canvas.x
    : Math.round(canvas.x + (canvas.width * safeColumn) / spec.columns);
  const rightColumn = safeColumn + safeColumnSpan;
  const bottomRow = safeRow + safeRowSpan;
  const right = rightColumn === spec.columns
    ? canvas.x + canvas.width
    : Math.round(canvas.x + (canvas.width * rightColumn) / spec.columns);
  const top = safeRow === 0
    ? canvas.y
    : Math.round(canvas.y + (canvas.height * safeRow) / spec.rows);
  const bottom = bottomRow === spec.rows
    ? canvas.y + canvas.height
    : Math.round(canvas.y + (canvas.height * bottomRow) / spec.rows);

  return {
    id: `grid-${spec.key}-c${safeColumn}-r${safeRow}${safeColumnSpan === 1 && safeRowSpan === 1 ? '' : `-s${safeColumnSpan}x${safeRowSpan}`}`,
    grid: spec.key,
    columns: spec.columns,
    rows: spec.rows,
    column: safeColumn,
    row: safeRow,
    columnSpan: safeColumnSpan,
    rowSpan: safeRowSpan,
    rect: {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    },
    legacyZone: legacySnapZoneForCell(spec, safeColumn, safeRow, safeColumnSpan, safeRowSpan),
  };
}

function legacySnapZoneForCell(
  spec: WorkspaceGridSpec,
  column: number,
  row: number,
  columnSpan = 1,
  rowSpan = 1,
): WorkspaceLegacySnapZone | null {
  if (columnSpan !== 1 || rowSpan !== 1) return null;

  if (spec.key === '2x1') {
    return column === 0 ? 'left' : 'right';
  }

  if (spec.key === '1x2') {
    return row === 0 ? 'top' : 'bottom';
  }

  if (spec.key === '2x2') {
    if (column === 0 && row === 0) return 'top-left';
    if (column === 1 && row === 0) return 'top-right';
    if (column === 0 && row === 1) return 'bottom-left';
    return 'bottom-right';
  }

  return null;
}

function legacySnapZoneForActiveSides(
  activeLeft: boolean,
  activeRight: boolean,
  activeTop: boolean,
  activeBottom: boolean,
): WorkspaceLegacySnapZone | null {
  if (activeLeft && activeTop) return 'top-left';
  if (activeRight && activeTop) return 'top-right';
  if (activeLeft && activeBottom) return 'bottom-left';
  if (activeRight && activeBottom) return 'bottom-right';
  if (activeLeft) return 'left';
  if (activeRight) return 'right';
  if (activeTop) return 'top';
  if (activeBottom) return 'bottom';
  return null;
}

export function workspaceGridPlacementCells(placement: Pick<WorkspaceGridPlacement, 'column' | 'row' | 'columnSpan' | 'rowSpan'>): WorkspaceGridCell[] {
  const cells: WorkspaceGridCell[] = [];
  for (let row = placement.row; row < placement.row + placement.rowSpan; row += 1) {
    for (let column = placement.column; column < placement.column + placement.columnSpan; column += 1) {
      cells.push({ column, row });
    }
  }
  return cells;
}

export function workspaceGridPlacementIsOccupied(
  placement: WorkspaceGridPlacement,
  occupants: readonly WorkspaceGridOccupant[],
  movingPanelId: string,
) {
  return occupants.some((occupant) => {
    if (occupant.id === movingPanelId) return false;
    if (occupant.placement?.kind === 'affixed' && occupant.placement.grid === placement.grid) {
      return workspaceGridCellsOverlap(placement, occupant.placement) || overlapArea(placement.rect, occupant.rect) > 1;
    }
    return overlapArea(placement.rect, occupant.rect) > 1;
  });
}

export function workspaceGridPlacementHasAttachedNeighbor(
  placement: WorkspaceGridPlacement,
  occupants: readonly WorkspaceGridOccupant[],
  movingPanelId = '',
) {
  return occupants.some((occupant) => {
    if (occupant.id === movingPanelId) return false;
    return placementTouchesOccupant(placement.rect, occupant.rect);
  });
}

export function workspaceGridPlacementIsInteriorHole(
  placement: WorkspaceGridPlacement,
  occupants: readonly WorkspaceGridOccupant[],
  movingPanelId = '',
) {
  if (placement.column <= 0 || placement.row <= 0) return false;
  if (placement.column + placement.columnSpan >= placement.columns) return false;
  if (placement.row + placement.rowSpan >= placement.rows) return false;

  const occupiedCells = new Set<string>();
  occupants.forEach((occupant) => {
    if (occupant.id === movingPanelId || occupant.placement?.kind !== 'affixed') return;
    if (occupant.placement.grid !== placement.grid) return;
    workspaceGridPlacementCells(occupant.placement).forEach((cell) => {
      occupiedCells.add(cellKey(cell.column, cell.row));
    });
  });

  if (occupiedCells.size === 0) return false;

  const cells = workspaceGridPlacementCells(placement);
  const sideChecks = {
    left: false,
    right: false,
    top: false,
    bottom: false,
  };

  cells.forEach((cell) => {
    if (occupiedCells.has(cellKey(cell.column - 1, cell.row))) sideChecks.left = true;
    if (occupiedCells.has(cellKey(cell.column + 1, cell.row))) sideChecks.right = true;
    if (occupiedCells.has(cellKey(cell.column, cell.row - 1))) sideChecks.top = true;
    if (occupiedCells.has(cellKey(cell.column, cell.row + 1))) sideChecks.bottom = true;
  });

  return sideChecks.left && sideChecks.right && sideChecks.top && sideChecks.bottom;
}

export function getWorkspaceMosaicAttachmentState(
  panelId: string,
  rect: WorkspacePanelGeometry,
  occupants: readonly WorkspaceGridOccupant[],
): WorkspaceMosaicAttachmentState {
  const state = {
    left: false,
    right: false,
    top: false,
    bottom: false,
    leftTouchesTop: false,
    leftTouchesBottom: false,
    rightTouchesTop: false,
    rightTouchesBottom: false,
    topTouchesLeft: false,
    topTouchesRight: false,
    bottomTouchesLeft: false,
    bottomTouchesRight: false,
  };
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;

  occupants.forEach((occupant) => {
    if (occupant.id === panelId) return;
    const other = occupant.rect;
    const otherRight = other.x + other.width;
    const otherBottom = other.y + other.height;
    const verticalOverlap = overlapLength(rect.y, bottom, other.y, otherBottom);
    const horizontalOverlap = overlapLength(rect.x, right, other.x, otherRight);

    if (Math.abs(otherRight - rect.x) <= MOSAIC_ATTACH_TOLERANCE && verticalOverlap > MOSAIC_ATTACH_TOLERANCE) {
      state.left = true;
      state.leftTouchesTop ||= other.y <= rect.y + MOSAIC_CORNER_ATTACH_TOLERANCE;
      state.leftTouchesBottom ||= otherBottom >= bottom - MOSAIC_CORNER_ATTACH_TOLERANCE;
    }
    if (Math.abs(other.x - right) <= MOSAIC_ATTACH_TOLERANCE && verticalOverlap > MOSAIC_ATTACH_TOLERANCE) {
      state.right = true;
      state.rightTouchesTop ||= other.y <= rect.y + MOSAIC_CORNER_ATTACH_TOLERANCE;
      state.rightTouchesBottom ||= otherBottom >= bottom - MOSAIC_CORNER_ATTACH_TOLERANCE;
    }
    if (Math.abs(otherBottom - rect.y) <= MOSAIC_ATTACH_TOLERANCE && horizontalOverlap > MOSAIC_ATTACH_TOLERANCE) {
      state.top = true;
      state.topTouchesLeft ||= other.x <= rect.x + MOSAIC_CORNER_ATTACH_TOLERANCE;
      state.topTouchesRight ||= otherRight >= right - MOSAIC_CORNER_ATTACH_TOLERANCE;
    }
    if (Math.abs(other.y - bottom) <= MOSAIC_ATTACH_TOLERANCE && horizontalOverlap > MOSAIC_ATTACH_TOLERANCE) {
      state.bottom = true;
      state.bottomTouchesLeft ||= other.x <= rect.x + MOSAIC_CORNER_ATTACH_TOLERANCE;
      state.bottomTouchesRight ||= otherRight >= right - MOSAIC_CORNER_ATTACH_TOLERANCE;
    }
  });

  return {
    left: state.left,
    right: state.right,
    top: state.top,
    bottom: state.bottom,
    topLeftRounded: !state.leftTouchesTop && !state.topTouchesLeft,
    topRightRounded: !state.rightTouchesTop && !state.topTouchesRight,
    bottomLeftRounded: !state.leftTouchesBottom && !state.bottomTouchesLeft,
    bottomRightRounded: !state.rightTouchesBottom && !state.bottomTouchesRight,
  };
}

export function getWorkspaceMosaicExposedEdgeSegments(
  panelId: string,
  rect: WorkspacePanelGeometry,
  occupants: readonly WorkspaceGridOccupant[],
): WorkspaceMosaicEdgeSegment[] {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const covered = {
    left: [] as Array<[number, number]>,
    right: [] as Array<[number, number]>,
    top: [] as Array<[number, number]>,
    bottom: [] as Array<[number, number]>,
  };

  occupants.forEach((occupant) => {
    if (occupant.id === panelId) return;
    const other = occupant.rect;
    const otherRight = other.x + other.width;
    const otherBottom = other.y + other.height;
    const verticalOverlap = overlapRange(rect.y, bottom, other.y, otherBottom);
    const horizontalOverlap = overlapRange(rect.x, right, other.x, otherRight);

    if (verticalOverlap && Math.abs(otherRight - rect.x) <= MOSAIC_ATTACH_TOLERANCE) {
      covered.left.push([verticalOverlap.start - rect.y, verticalOverlap.end - rect.y]);
    }
    if (verticalOverlap && Math.abs(other.x - right) <= MOSAIC_ATTACH_TOLERANCE) {
      covered.right.push([verticalOverlap.start - rect.y, verticalOverlap.end - rect.y]);
    }
    if (horizontalOverlap && Math.abs(otherBottom - rect.y) <= MOSAIC_ATTACH_TOLERANCE) {
      covered.top.push([horizontalOverlap.start - rect.x, horizontalOverlap.end - rect.x]);
    }
    if (horizontalOverlap && Math.abs(other.y - bottom) <= MOSAIC_ATTACH_TOLERANCE) {
      covered.bottom.push([horizontalOverlap.start - rect.x, horizontalOverlap.end - rect.x]);
    }
  });

  return (['left', 'right', 'top', 'bottom'] as WorkspaceMosaicSide[]).flatMap((side) => {
    const length = side === 'left' || side === 'right' ? rect.height : rect.width;
    return complementIntervals(mergeIntervals(covered[side], length), length)
      .filter(([start, end]) => end - start > 1)
      .map(([start, end]) => ({
        side,
        startPercent: percentOfLength(start, length),
        endPercent: percentOfLength(end, length),
      }));
  });
}

export function getWorkspaceJoinCueSegments(
  placement: Pick<WorkspaceGridPlacement, 'rect'>,
  canvas: WorkspaceCanvasRect,
  occupants: readonly WorkspaceGridOccupant[] = [],
  movingPanelId = '',
): WorkspaceJoinCueSegment[] {
  const rect = placement.rect;
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const canvasRight = canvas.x + canvas.width;
  const canvasBottom = canvas.y + canvas.height;
  const segments: WorkspaceJoinCueSegment[] = [];
  const seen = new Set<string>();

  const addSegment = (side: WorkspaceMosaicSide, kind: WorkspaceJoinCueKind, segmentRect: WorkspacePanelGeometry) => {
    const length = side === 'left' || side === 'right' ? segmentRect.height : segmentRect.width;
    if (length <= 1) return;

    const key = [
      side,
      kind,
      Math.round(segmentRect.x),
      Math.round(segmentRect.y),
      Math.round(segmentRect.width),
      Math.round(segmentRect.height),
    ].join(':');
    if (seen.has(key)) return;
    seen.add(key);
    segments.push({ side, kind, rect: segmentRect });
  };

  if (Math.abs(rect.x - canvas.x) <= MOSAIC_ATTACH_TOLERANCE) {
    addSegment('left', 'workspace-edge', { x: rect.x, y: rect.y, width: 0, height: rect.height });
  }

  if (Math.abs(right - canvasRight) <= MOSAIC_ATTACH_TOLERANCE) {
    addSegment('right', 'workspace-edge', { x: right, y: rect.y, width: 0, height: rect.height });
  }

  if (Math.abs(rect.y - canvas.y) <= MOSAIC_ATTACH_TOLERANCE) {
    addSegment('top', 'workspace-edge', { x: rect.x, y: rect.y, width: rect.width, height: 0 });
  }

  if (Math.abs(bottom - canvasBottom) <= MOSAIC_ATTACH_TOLERANCE) {
    addSegment('bottom', 'workspace-edge', { x: rect.x, y: bottom, width: rect.width, height: 0 });
  }

  occupants.forEach((occupant) => {
    if (occupant.id === movingPanelId) return;
    const other = occupant.rect;
    const otherRight = other.x + other.width;
    const otherBottom = other.y + other.height;
    const verticalOverlap = overlapRange(rect.y, bottom, other.y, otherBottom);
    const horizontalOverlap = overlapRange(rect.x, right, other.x, otherRight);

    if (verticalOverlap && Math.abs(otherRight - rect.x) <= MOSAIC_ATTACH_TOLERANCE) {
      addSegment('left', 'neighbor-seam', {
        x: rect.x,
        y: verticalOverlap.start,
        width: 0,
        height: verticalOverlap.end - verticalOverlap.start,
      });
    }

    if (verticalOverlap && Math.abs(other.x - right) <= MOSAIC_ATTACH_TOLERANCE) {
      addSegment('right', 'neighbor-seam', {
        x: right,
        y: verticalOverlap.start,
        width: 0,
        height: verticalOverlap.end - verticalOverlap.start,
      });
    }

    if (horizontalOverlap && Math.abs(otherBottom - rect.y) <= MOSAIC_ATTACH_TOLERANCE) {
      addSegment('top', 'neighbor-seam', {
        x: horizontalOverlap.start,
        y: rect.y,
        width: horizontalOverlap.end - horizontalOverlap.start,
        height: 0,
      });
    }

    if (horizontalOverlap && Math.abs(other.y - bottom) <= MOSAIC_ATTACH_TOLERANCE) {
      addSegment('bottom', 'neighbor-seam', {
        x: horizontalOverlap.start,
        y: bottom,
        width: horizontalOverlap.end - horizontalOverlap.start,
        height: 0,
      });
    }
  });

  return segments;
}

export function summarizeWorkspaceMosaicSides(state: WorkspaceMosaicAttachmentState) {
  return (['left', 'right', 'top', 'bottom'] as const)
    .filter((side) => state[side])
    .join(' ');
}

export function summarizeWorkspaceMosaicRoundedCorners(state: WorkspaceMosaicAttachmentState) {
  return [
    state.topLeftRounded ? 'top-left' : '',
    state.topRightRounded ? 'top-right' : '',
    state.bottomLeftRounded ? 'bottom-left' : '',
    state.bottomRightRounded ? 'bottom-right' : '',
  ].filter(Boolean).join(' ');
}

export function summarizeWorkspaceMosaicEdgeSegments(segments: readonly WorkspaceMosaicEdgeSegment[]) {
  return segments
    .map((segment) => `${segment.side}:${Math.round(segment.startPercent)}-${Math.round(segment.endPercent)}`)
    .join(' ');
}

function overlapArea(left: WorkspacePanelGeometry, right: WorkspacePanelGeometry) {
  const xOverlap = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const yOverlap = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  return xOverlap * yOverlap;
}

function selectInteriorWorkspaceGridPlacement({
  canvas,
  minimums,
  occupants,
  movingPanelId,
  pointerX,
  pointerY,
}: {
  canvas: WorkspaceCanvasRect;
  minimums: WorkspaceGridMinimums;
  occupants: readonly WorkspaceGridOccupant[];
  movingPanelId: string;
  pointerX: number;
  pointerY: number;
}) {
  if (
    pointerX < canvas.x
    || pointerX > canvas.x + canvas.width
    || pointerY < canvas.y
    || pointerY > canvas.y + canvas.height
  ) {
    return null;
  }

  for (const gridKey of INTERIOR_GRID_ORDER) {
    const spec = workspaceGridSpecForKey(gridKey);
    if (!spec || !workspaceGridFits(canvas, minimums, spec)) continue;

    const column = clampGridIndex(Math.floor((pointerX - canvas.x) / (canvas.width / spec.columns)), spec.columns);
    const row = clampGridIndex(Math.floor((pointerY - canvas.y) / (canvas.height / spec.rows)), spec.rows);
    const placement = createWorkspaceGridPlacement(canvas, spec, column, row);
    if (workspaceGridPlacementIsOccupied(placement, occupants, movingPanelId)) continue;
    if (
      workspaceGridPlacementIsInteriorHole(placement, occupants, movingPanelId)
      || workspaceGridPlacementHasAttachedNeighbor(placement, occupants, movingPanelId)
    ) {
      return placement;
    }
  }

  return selectAttachedWorkspaceGridPlacementNearPointer({
    canvas,
    minimums,
    occupants,
    movingPanelId,
    pointerX,
    pointerY,
  });
}

function selectAttachedWorkspaceGridPlacementNearPointer({
  canvas,
  minimums,
  occupants,
  movingPanelId,
  pointerX,
  pointerY,
}: {
  canvas: WorkspaceCanvasRect;
  minimums: WorkspaceGridMinimums;
  occupants: readonly WorkspaceGridOccupant[];
  movingPanelId: string;
  pointerX: number;
  pointerY: number;
}) {
  let best: { placement: WorkspaceGridPlacement; score: number } | null = null;

  for (const gridKey of INTERIOR_GRID_ORDER) {
    const spec = workspaceGridSpecForKey(gridKey);
    if (!spec || !workspaceGridFits(canvas, minimums, spec)) continue;

    for (let row = 0; row < spec.rows; row += 1) {
      for (let column = 0; column < spec.columns; column += 1) {
        const placement = createWorkspaceGridPlacement(canvas, spec, column, row);
        if (workspaceGridPlacementIsOccupied(placement, occupants, movingPanelId)) continue;
        if (
          !workspaceGridPlacementIsInteriorHole(placement, occupants, movingPanelId)
          && !workspaceGridPlacementHasAttachedNeighbor(placement, occupants, movingPanelId)
        ) {
          continue;
        }

        const distance = distanceFromPointToRect(pointerX, pointerY, placement.rect);
        if (distance > ATTACHED_PLACEMENT_MAGNET_DISTANCE) continue;

        const centerDistance = distanceBetweenPoints(
          pointerX,
          pointerY,
          placement.rect.x + placement.rect.width / 2,
          placement.rect.y + placement.rect.height / 2,
        );
        const score = distance * 10_000 + centerDistance;
        if (!best || score < best.score) {
          best = { placement, score };
        }
      }
    }
  }

  return best?.placement ?? null;
}

function workspaceGridCellsOverlap(
  left: Pick<WorkspaceGridPlacement, 'column' | 'row' | 'columnSpan' | 'rowSpan'>,
  right: Pick<WorkspaceGridPlacement, 'column' | 'row' | 'columnSpan' | 'rowSpan'>,
) {
  const leftCells = workspaceGridPlacementCells(left);
  const rightCells = new Set(workspaceGridPlacementCells(right).map((cell) => cellKey(cell.column, cell.row)));
  return leftCells.some((cell) => rightCells.has(cellKey(cell.column, cell.row)));
}

function placementTouchesOccupant(placement: WorkspacePanelGeometry, occupant: WorkspacePanelGeometry) {
  const right = placement.x + placement.width;
  const bottom = placement.y + placement.height;
  const occupantRight = occupant.x + occupant.width;
  const occupantBottom = occupant.y + occupant.height;
  const verticalOverlap = overlapLength(placement.y, bottom, occupant.y, occupantBottom);
  const horizontalOverlap = overlapLength(placement.x, right, occupant.x, occupantRight);
  return (
    (Math.abs(occupantRight - placement.x) <= MOSAIC_ATTACH_TOLERANCE && verticalOverlap > MOSAIC_ATTACH_TOLERANCE)
    || (Math.abs(occupant.x - right) <= MOSAIC_ATTACH_TOLERANCE && verticalOverlap > MOSAIC_ATTACH_TOLERANCE)
    || (Math.abs(occupantBottom - placement.y) <= MOSAIC_ATTACH_TOLERANCE && horizontalOverlap > MOSAIC_ATTACH_TOLERANCE)
    || (Math.abs(occupant.y - bottom) <= MOSAIC_ATTACH_TOLERANCE && horizontalOverlap > MOSAIC_ATTACH_TOLERANCE)
  );
}

function distanceFromPointToRect(pointerX: number, pointerY: number, rect: WorkspacePanelGeometry) {
  const dx = Math.max(rect.x - pointerX, 0, pointerX - (rect.x + rect.width));
  const dy = Math.max(rect.y - pointerY, 0, pointerY - (rect.y + rect.height));
  return distanceBetweenPoints(0, 0, dx, dy);
}

function distanceBetweenPoints(leftX: number, leftY: number, rightX: number, rightY: number) {
  const dx = rightX - leftX;
  const dy = rightY - leftY;
  return Math.sqrt(dx * dx + dy * dy);
}

function distanceFromPointToSegment(
  pointerX: number,
  pointerY: number,
  segmentStartX: number,
  segmentStartY: number,
  segmentEndX: number,
  segmentEndY: number,
) {
  const dx = segmentEndX - segmentStartX;
  const dy = segmentEndY - segmentStartY;
  if (dx === 0 && dy === 0) {
    return distanceBetweenPoints(pointerX, pointerY, segmentStartX, segmentStartY);
  }

  const t = clampNumber(
    ((pointerX - segmentStartX) * dx + (pointerY - segmentStartY) * dy) / (dx * dx + dy * dy),
    0,
    1,
  );
  return distanceBetweenPoints(
    pointerX,
    pointerY,
    segmentStartX + t * dx,
    segmentStartY + t * dy,
  );
}

function overlapLength(startA: number, endA: number, startB: number, endB: number) {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

function overlapRange(startA: number, endA: number, startB: number, endB: number) {
  const start = Math.max(startA, startB);
  const end = Math.min(endA, endB);
  return end - start > 1 ? { start, end } : null;
}

function mergeIntervals(intervals: Array<[number, number]>, length: number) {
  const sorted = intervals
    .map(([start, end]) => [clampNumber(start, 0, length), clampNumber(end, 0, length)] as [number, number])
    .filter(([start, end]) => end - start > 1)
    .sort((left, right) => left[0] - right[0]);
  const merged: Array<[number, number]> = [];

  sorted.forEach(([start, end]) => {
    const previous = merged[merged.length - 1];
    if (!previous || start > previous[1] + 1) {
      merged.push([start, end]);
      return;
    }
    previous[1] = Math.max(previous[1], end);
  });

  return merged;
}

function complementIntervals(intervals: Array<[number, number]>, length: number) {
  const complement: Array<[number, number]> = [];
  let cursor = 0;

  intervals.forEach(([start, end]) => {
    if (start > cursor) complement.push([cursor, start]);
    cursor = Math.max(cursor, end);
  });

  if (cursor < length) complement.push([cursor, length]);
  return complement;
}

function percentOfLength(value: number, length: number) {
  if (length <= 0) return 0;
  return clampNumber((value / length) * 100, 0, 100);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function cellKey(column: number, row: number) {
  return `${column},${row}`;
}

function clampSpan(value: number, max: number) {
  return Math.min(Math.max(1, max), Math.max(1, value));
}

function clampGridIndex(value: number, count: number) {
  return Math.min(count - 1, Math.max(0, value));
}
