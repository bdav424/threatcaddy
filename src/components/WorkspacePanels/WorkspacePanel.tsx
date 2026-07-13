/* eslint-disable react-refresh/only-export-components -- chrome-state hooks are co-located with the panel component by design */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Minimize2, Move, RotateCcw, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSettings } from '../../hooks/useSettings';
import {
  WorkspacePanelContext,
  freeWorkspacePanelPlacement,
  type SeamEdge,
  type WorkspacePanelGeometry,
  type WorkspacePanelMode,
} from './workspace-panel-context';
import {
  getWorkspaceApproachCueSegments,
  getWorkspaceJoinCueSegments,
  getWorkspaceMosaicAttachmentState,
  getWorkspaceMosaicExposedEdgeSegments,
  listWorkspaceGridPlacements,
  readWorkspaceCanvasRect,
  selectWorkspaceGridPlacementForPointer,
  summarizeWorkspaceMosaicEdgeSegments,
  summarizeWorkspaceMosaicRoundedCorners,
  summarizeWorkspaceMosaicSides,
  summarizeWorkspaceGridKeys,
  summarizeWorkspacePlacementIds,
  workspacePanelPlacementFromGridPlacement,
  type WorkspacePanelPlacementState,
  type WorkspaceGridOccupant,
  type WorkspaceGridPlacement,
  type WorkspaceJoinCueSegment,
} from './workspaceGrid';

export type { WorkspacePanelGeometry, WorkspacePanelMode } from './WorkspacePanelProvider';

type ResizeEdge =
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

const OPPOSITE_SEAM_EDGE: Record<SeamEdge, SeamEdge> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

interface WorkspacePanelProps {
  id: string;
  title: string;
  mode: WorkspacePanelMode;
  geometry: WorkspacePanelGeometry;
  onModeChange: (mode: WorkspacePanelMode) => void;
  onGeometryChange: (geometry: WorkspacePanelGeometry) => void;
  children: ReactNode;
  dockedClassName?: string;
  floatingClassName?: string;
  placeholderClassName?: string;
  bodyClassName?: string;
  floatingAriaLabel?: string;
  resizeLabelBase?: string;
  minimizeLabel?: string;
  closeLabel?: string;
  restoreLabel?: string;
  preserveChildrenWhenMinimized?: boolean;
  preserveChildrenAcrossModes?: boolean;
  /** Skip rendering bodyChildren until the panel is first activated, then keep them mounted. */
  deferMount?: boolean;
  active?: boolean;
  minWidth?: number;
  minHeight?: number;
  compactWidth?: number;
  compactHeight?: number;
  forceCompact?: boolean;
  zIndex?: number;
  onPanelFocus?: () => void;
  onRestore?: () => void;
  onClose?: () => void;
}

interface WorkspacePanelHeaderAccessory {
  content: ReactNode;
  replaceTitle?: boolean;
}

interface WorkspacePanelChromeContextValue {
  compact: boolean;
  setHeaderAccessory: (accessory: WorkspacePanelHeaderAccessory | null) => void;
}

const WorkspacePanelChromeContext = createContext<WorkspacePanelChromeContextValue | null>(null);

export function useWorkspacePanelHeaderAccessory(accessory: WorkspacePanelHeaderAccessory | null) {
  const context = useContext(WorkspacePanelChromeContext);

  useEffect(() => {
    if (!context) return;

    context.setHeaderAccessory(accessory);
    return () => context.setHeaderAccessory(null);
  }, [accessory, context]);

  return Boolean(context);
}

export function useWorkspacePanelChromeState() {
  return useContext(WorkspacePanelChromeContext);
}

function MinimizedPanelRollup({
  id,
  title,
  active,
  panelPlacement,
  placeholderClassName,
  restoreLabel,
  onRestore,
  children,
}: {
  id: string;
  title: string;
  active: boolean;
  panelPlacement: WorkspacePanelPlacementState;
  placeholderClassName?: string;
  restoreLabel: string;
  onRestore: () => void;
  children?: ReactNode;
}) {
  if (!active) {
    return (
      <div hidden aria-hidden="true" data-workspace-panel-preserved={children ? id : undefined}>
        {children}
      </div>
    );
  }

  return (
    <section
      className={cn('min-w-0 rounded-[12px] border border-border-subtle/35 bg-bg-primary/50 p-1.5', placeholderClassName)}
      data-workspace-panel={id}
      data-workspace-panel-state="minimized"
      data-workspace-panel-rollup="true"
      data-workspace-panel-affixed={panelPlacement.kind === 'affixed' ? 'reserved' : undefined}
      data-workspace-panel-snap-grid={panelPlacement.kind === 'affixed' ? panelPlacement.grid : undefined}
      data-workspace-panel-snap-cell={panelPlacement.kind === 'affixed' ? `${panelPlacement.column},${panelPlacement.row}` : undefined}
      data-workspace-panel-grid-cell={panelPlacement.kind === 'affixed' ? `${panelPlacement.grid}:${panelPlacement.column},${panelPlacement.row}` : undefined}
      data-workspace-panel-snap-span={panelPlacement.kind === 'affixed' ? `${panelPlacement.columnSpan}x${panelPlacement.rowSpan}` : undefined}
    >
      <button
        type="button"
        onClick={onRestore}
        className="flex h-9 w-full items-center gap-2 rounded-[10px] border border-accent/20 bg-accent/8 px-2.5 text-left text-[11px] font-semibold text-accent transition-colors hover:bg-accent/14"
        aria-label={restoreLabel}
        title={restoreLabel}
      >
        <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <RotateCcw size={13} aria-hidden="true" />
      </button>
      {children && (
        <div hidden aria-hidden="true" data-workspace-panel-preserved={id}>
          {children}
        </div>
      )}
    </section>
  );
}

const resizeHandles: Array<{ edge: ResizeEdge; label: string; className: string; cursor: string }> = [
  { edge: 'top', label: 'top', className: 'left-7 right-7 top-[-8px] h-4', cursor: 'cursor-ns-resize' },
  { edge: 'right', label: 'right', className: 'right-[-10px] top-7 bottom-7 w-5', cursor: 'cursor-ew-resize' },
  { edge: 'bottom', label: 'bottom', className: 'left-7 right-7 bottom-[-8px] h-4', cursor: 'cursor-ns-resize' },
  { edge: 'left', label: 'left', className: 'left-[-10px] top-7 bottom-7 w-5', cursor: 'cursor-ew-resize' },
  { edge: 'top-left', label: 'top left', className: 'left-[-10px] top-[-10px] h-8 w-8', cursor: 'cursor-nwse-resize' },
  { edge: 'top-right', label: 'top right', className: 'right-[-10px] top-[-10px] h-8 w-8', cursor: 'cursor-nesw-resize' },
  { edge: 'bottom-left', label: 'bottom left', className: 'left-[-10px] bottom-[-10px] h-8 w-8', cursor: 'cursor-nesw-resize' },
  { edge: 'bottom-right', label: 'bottom right', className: 'right-[-10px] bottom-[-10px] h-8 w-8', cursor: 'cursor-nwse-resize' },
];

const FLOATING_PANEL_Z_INDEX_FLOOR = 120;
// Every snapped panel used to share this one constant, so whenever the mosaic
// math left even a sub-pixel overlap at a shared seam, which panel painted on
// top was decided by React mount/DOM order — arbitrary and inconsistent (one
// panel would win against its neighbor on one seam and lose on another).
// SNAPPED_PANEL_Z_INDEX_BASE + a per-cell offset (below) makes that ordering
// deterministic instead: same grid position always wins the same way.
const SNAPPED_PANEL_Z_INDEX_BASE = FLOATING_PANEL_Z_INDEX_FLOOR - 24;
const SHARED_SEAM_TOLERANCE = 3;
const SHARED_CORNER_TOLERANCE = 24;
const FLOATING_PANEL_REACHABLE_TOP_INSET = 8;
const FLOATING_PANEL_TOP_CHROME_SELECTORS = [
  '[data-tour="header"]',
  '[data-workspace-investigation-layer="true"]',
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function viewportSafeRect(options: { keepHeaderReachable?: boolean } = {}) {
  const canvas = readWorkspaceCanvasRect();
  let top = canvas.y + (options.keepHeaderReachable ? FLOATING_PANEL_REACHABLE_TOP_INSET : 0);

  if (options.keepHeaderReachable) {
    top = Math.max(top, floatingHeaderReachableTop());
  }

  return {
    left: canvas.x,
    top,
    right: canvas.x + canvas.width,
    bottom: canvas.y + canvas.height,
  };
}

function floatingHeaderReachableTop() {
  let top = FLOATING_PANEL_REACHABLE_TOP_INSET;

  if (typeof document !== 'undefined') {
    FLOATING_PANEL_TOP_CHROME_SELECTORS.forEach((selector) => {
      document.querySelectorAll<HTMLElement>(selector).forEach((chrome) => {
        const rect = chrome.getBoundingClientRect();
        if (rect.height > 0 && rect.bottom > 0) {
          top = Math.max(top, Math.round(rect.bottom) + FLOATING_PANEL_REACHABLE_TOP_INSET);
        }
      });
    });
  }

  return top;
}

function geometriesEqual(left: WorkspacePanelGeometry, right: WorkspacePanelGeometry) {
  return left.x === right.x
    && left.y === right.y
    && left.width === right.width
    && left.height === right.height;
}

function clampGeometry(
  geometry: WorkspacePanelGeometry,
  minWidth: number,
  minHeight: number,
  options: { keepHeaderReachable?: boolean } = {},
) {
  const safe = viewportSafeRect(options);
  const width = clamp(geometry.width, minWidth, Math.max(minWidth, safe.right - safe.left));
  const height = clamp(geometry.height, minHeight, Math.max(minHeight, safe.bottom - safe.top));

  return {
    x: clamp(geometry.x, safe.left, safe.right - width),
    y: clamp(geometry.y, safe.top, safe.bottom - height),
    width,
    height,
  };
}

function overlapLength(startA: number, endA: number, startB: number, endB: number) {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

function geometryFromElement(element: HTMLElement): WorkspacePanelGeometry {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function panelMinimumsFromElement(element: HTMLElement) {
  const minWidth = Number.parseFloat(element.dataset.workspacePanelMinWidth || '');
  const minHeight = Number.parseFloat(element.dataset.workspacePanelMinHeight || '');
  return {
    minWidth: Number.isFinite(minWidth) && minWidth > 0 ? minWidth : 300,
    minHeight: Number.isFinite(minHeight) && minHeight > 0 ? minHeight : 220,
  };
}

function snappedPanelElement(panelId: string) {
  if (typeof document === 'undefined') return null;
  const element = document.querySelector<HTMLElement>(
    `[data-workspace-panel="${panelId}"][data-workspace-panel-chrome="snapped"]`,
  );
  return element;
}

interface SharedResizeNeighbor {
  id: string;
  geometry: WorkspacePanelGeometry;
  minWidth: number;
  minHeight: number;
}

type MovingXEdge = 'left' | 'right';
type MovingYEdge = 'top' | 'bottom';

interface SharedCornerResizeTile extends SharedResizeNeighbor {
  xEdge: MovingXEdge | null;
  yEdge: MovingYEdge | null;
}

function sharedResizeNeighbors(panelId: string, edge: ResizeEdge, panelGeometry: WorkspacePanelGeometry): SharedResizeNeighbor[] {
  if (isCorner(edge) || typeof document === 'undefined') return [];
  if (!snappedPanelElement(panelId)) return [];

  const neighbors: SharedResizeNeighbor[] = [];
  const candidates = document.querySelectorAll<HTMLElement>(
    '[data-workspace-panel-chrome="snapped"][data-workspace-panel-snap-zone]',
  );
  const panelRight = panelGeometry.x + panelGeometry.width;
  const panelBottom = panelGeometry.y + panelGeometry.height;

  for (const candidate of Array.from(candidates)) {
    const candidateId = candidate.dataset.workspacePanel;
    if (!candidateId || candidateId === panelId) continue;

    const candidateGeometry = geometryFromElement(candidate);
    const candidateRight = candidateGeometry.x + candidateGeometry.width;
    const candidateBottom = candidateGeometry.y + candidateGeometry.height;
    const verticalOverlap = overlapLength(panelGeometry.y, panelBottom, candidateGeometry.y, candidateBottom);
    const horizontalOverlap = overlapLength(panelGeometry.x, panelRight, candidateGeometry.x, candidateRight);
    const sharesVerticalSpan = verticalOverlap >= Math.min(panelGeometry.height, candidateGeometry.height) * 0.55;
    const sharesHorizontalSpan = horizontalOverlap >= Math.min(panelGeometry.width, candidateGeometry.width) * 0.55;

    const sharesRequestedEdge =
      (edge === 'right' && Math.abs(candidateGeometry.x - panelRight) <= SHARED_SEAM_TOLERANCE && sharesVerticalSpan)
      || (edge === 'left' && Math.abs(candidateRight - panelGeometry.x) <= SHARED_SEAM_TOLERANCE && sharesVerticalSpan)
      || (edge === 'bottom' && Math.abs(candidateGeometry.y - panelBottom) <= SHARED_SEAM_TOLERANCE && sharesHorizontalSpan)
      || (edge === 'top' && Math.abs(candidateBottom - panelGeometry.y) <= SHARED_SEAM_TOLERANCE && sharesHorizontalSpan);

    if (sharesRequestedEdge) {
      const minimums = panelMinimumsFromElement(candidate);
      neighbors.push({
        id: candidateId,
        geometry: candidateGeometry,
        minWidth: minimums.minWidth,
        minHeight: minimums.minHeight,
      });
    }
  }

  return neighbors;
}

function resizeSharedSeamGeometry(
  start: WorkspacePanelGeometry,
  neighbors: SharedResizeNeighbor[],
  edge: ResizeEdge,
  dx: number,
  dy: number,
  minWidth: number,
  minHeight: number,
) {
  if (neighbors.length === 0) return null;

  const nextSelf = { ...start };
  const nextNeighbors = new Map<string, WorkspacePanelGeometry>();

  if (edge === 'right') {
    const outerRight = Math.min(...neighbors.map((neighbor) => neighbor.geometry.x + neighbor.geometry.width - neighbor.minWidth));
    const seam = clampSeam(start.x + start.width + dx, start.x + minWidth, outerRight);
    nextSelf.width = seam - start.x;
    neighbors.forEach((neighbor) => {
      const neighborRight = neighbor.geometry.x + neighbor.geometry.width;
      nextNeighbors.set(neighbor.id, {
        ...neighbor.geometry,
        x: seam,
        width: neighborRight - seam,
      });
    });
  } else if (edge === 'left') {
    const selfRight = start.x + start.width;
    const innerLeft = Math.max(...neighbors.map((neighbor) => neighbor.geometry.x + neighbor.minWidth));
    const seam = clampSeam(start.x + dx, innerLeft, selfRight - minWidth);
    nextSelf.x = seam;
    nextSelf.width = selfRight - seam;
    neighbors.forEach((neighbor) => {
      nextNeighbors.set(neighbor.id, {
        ...neighbor.geometry,
        width: seam - neighbor.geometry.x,
      });
    });
  } else if (edge === 'bottom') {
    const outerBottom = Math.min(...neighbors.map((neighbor) => neighbor.geometry.y + neighbor.geometry.height - neighbor.minHeight));
    const seam = clampSeam(start.y + start.height + dy, start.y + minHeight, outerBottom);
    nextSelf.height = seam - start.y;
    neighbors.forEach((neighbor) => {
      const neighborBottom = neighbor.geometry.y + neighbor.geometry.height;
      nextNeighbors.set(neighbor.id, {
        ...neighbor.geometry,
        y: seam,
        height: neighborBottom - seam,
      });
    });
  } else if (edge === 'top') {
    const selfBottom = start.y + start.height;
    const innerTop = Math.max(...neighbors.map((neighbor) => neighbor.geometry.y + neighbor.minHeight));
    const seam = clampSeam(start.y + dy, innerTop, selfBottom - minHeight);
    nextSelf.y = seam;
    nextSelf.height = selfBottom - seam;
    neighbors.forEach((neighbor) => {
      nextNeighbors.set(neighbor.id, {
        ...neighbor.geometry,
        height: seam - neighbor.geometry.y,
      });
    });
  } else {
    return null;
  }

  return { self: nextSelf, neighbors: nextNeighbors };
}

interface SharedCornerResizeGroup {
  tiles: SharedCornerResizeTile[];
}

interface MosaicBorderMergeMask {
  side: 'left' | 'right' | 'top' | 'bottom';
  startPercent: number;
  sizePercent: number;
}

function sharedCornerResizeGroup(panelId: string, edge: ResizeEdge, panelGeometry: WorkspacePanelGeometry): SharedCornerResizeGroup | null {
  if (!isCorner(edge) || typeof document === 'undefined') return null;
  if (!snappedPanelElement(panelId)) return null;

  const candidates = document.querySelectorAll<HTMLElement>(
    '[data-workspace-panel-chrome="snapped"][data-workspace-panel-snap-zone]',
  );
  const panelRight = panelGeometry.x + panelGeometry.width;
  const panelBottom = panelGeometry.y + panelGeometry.height;
  const xSeam = edge.includes('right') ? panelRight : panelGeometry.x;
  const ySeam = edge.includes('bottom') ? panelBottom : panelGeometry.y;
  const tiles: SharedCornerResizeTile[] = [];

  for (const candidate of Array.from(candidates)) {
    const candidateId = candidate.dataset.workspacePanel;
    if (!candidateId || candidateId === panelId) continue;

    const candidateGeometry = geometryFromElement(candidate);
    const candidateRight = candidateGeometry.x + candidateGeometry.width;
    const candidateBottom = candidateGeometry.y + candidateGeometry.height;
    const xEdge: MovingXEdge | null = Math.abs(candidateGeometry.x - xSeam) <= SHARED_CORNER_TOLERANCE
      ? 'left'
      : Math.abs(candidateRight - xSeam) <= SHARED_CORNER_TOLERANCE
        ? 'right'
        : null;
    const yEdge: MovingYEdge | null = Math.abs(candidateGeometry.y - ySeam) <= SHARED_CORNER_TOLERANCE
      ? 'top'
      : Math.abs(candidateBottom - ySeam) <= SHARED_CORNER_TOLERANCE
        ? 'bottom'
        : null;

    const verticalOverlap = overlapLength(panelGeometry.y, panelBottom, candidateGeometry.y, candidateBottom);
    const horizontalOverlap = overlapLength(panelGeometry.x, panelRight, candidateGeometry.x, candidateRight);
    const adjacentAlongX = Boolean(xEdge && verticalOverlap >= Math.min(panelGeometry.height, candidateGeometry.height) * 0.2);
    const adjacentAlongY = Boolean(yEdge && horizontalOverlap >= Math.min(panelGeometry.width, candidateGeometry.width) * 0.2);
    const touchesCorner = Boolean(xEdge && yEdge);
    if (!adjacentAlongX && !adjacentAlongY && !touchesCorner) continue;

    const minimums = panelMinimumsFromElement(candidate);
    tiles.push({
      id: candidateId,
      geometry: candidateGeometry,
      minWidth: minimums.minWidth,
      minHeight: minimums.minHeight,
      xEdge,
      yEdge,
    });
  }

  return tiles.length > 0 ? { tiles } : null;
}

type SeamZone = 'center' | 'edge-a' | 'edge-b';

function getSeamZone(event: PointerEvent<HTMLButtonElement>, edge: ResizeEdge): SeamZone {
  if (isCorner(edge)) return 'center';
  const rect = event.currentTarget.getBoundingClientRect();
  if (edge === 'bottom' || edge === 'top') {
    const relX = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0.5;
    if (relX < 0.2) return 'edge-a';
    if (relX > 0.8) return 'edge-b';
  } else if (edge === 'left' || edge === 'right') {
    const relY = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5;
    if (relY < 0.2) return 'edge-a';
    if (relY > 0.8) return 'edge-b';
  }
  return 'center';
}

function filterNeighborsByZone(
  neighbors: SharedResizeNeighbor[],
  zone: SeamZone,
  edge: ResizeEdge,
  panelGeometry: WorkspacePanelGeometry,
): SharedResizeNeighbor[] {
  if (zone === 'center' || isCorner(edge) || neighbors.length <= 1) return neighbors;
  const panelCenterX = panelGeometry.x + panelGeometry.width / 2;
  const panelCenterY = panelGeometry.y + panelGeometry.height / 2;
  let filtered: SharedResizeNeighbor[];
  if (edge === 'bottom' || edge === 'top') {
    filtered = neighbors.filter((n) => {
      const nCenterX = n.geometry.x + n.geometry.width / 2;
      return zone === 'edge-a' ? nCenterX < panelCenterX : nCenterX >= panelCenterX;
    });
  } else {
    filtered = neighbors.filter((n) => {
      const nCenterY = n.geometry.y + n.geometry.height / 2;
      return zone === 'edge-a' ? nCenterY < panelCenterY : nCenterY >= panelCenterY;
    });
  }
  return filtered.length > 0 ? filtered : neighbors;
}

function findCoParentIds(
  panelId: string,
  edge: ResizeEdge,
  panelGeometry: WorkspacePanelGeometry,
): string[] {
  if (isCorner(edge) || typeof document === 'undefined') return [];
  if (!snappedPanelElement(panelId)) return [];
  const candidates = document.querySelectorAll<HTMLElement>(
    '[data-workspace-panel-chrome="snapped"][data-workspace-panel-snap-zone]',
  );
  const panelRight = panelGeometry.x + panelGeometry.width;
  const panelBottom = panelGeometry.y + panelGeometry.height;
  const coParents: string[] = [];
  for (const candidate of Array.from(candidates)) {
    const candidateId = candidate.dataset.workspacePanel;
    if (!candidateId || candidateId === panelId) continue;
    const cg = geometryFromElement(candidate);
    const isCoParent =
      (edge === 'bottom' && Math.abs((cg.y + cg.height) - panelBottom) <= SHARED_SEAM_TOLERANCE)
      || (edge === 'top' && Math.abs(cg.y - panelGeometry.y) <= SHARED_SEAM_TOLERANCE)
      || (edge === 'right' && Math.abs((cg.x + cg.width) - panelRight) <= SHARED_SEAM_TOLERANCE)
      || (edge === 'left' && Math.abs(cg.x - panelGeometry.x) <= SHARED_SEAM_TOLERANCE);
    if (isCoParent) coParents.push(candidateId);
  }
  return coParents;
}

const MOVE_SNAP_THRESHOLD = 16;

function findMoveSnapTarget(
  panelId: string,
  geometry: WorkspacePanelGeometry,
): { snappedGeometry: WorkspacePanelGeometry; snapEdge: SeamEdge } | null {
  if (typeof document === 'undefined') return null;
  const candidates = document.querySelectorAll<HTMLElement>(
    '[data-workspace-panel-chrome="snapped"][data-workspace-panel-snap-zone]',
  );
  let bestDistance = MOVE_SNAP_THRESHOLD;
  let result: { snappedGeometry: WorkspacePanelGeometry; snapEdge: SeamEdge } | null = null;
  const panelRight = geometry.x + geometry.width;
  const panelBottom = geometry.y + geometry.height;
  for (const candidate of Array.from(candidates)) {
    const candidateId = candidate.dataset.workspacePanel;
    if (!candidateId || candidateId === panelId) continue;
    const cg = geometryFromElement(candidate);
    const cgRight = cg.x + cg.width;
    const cgBottom = cg.y + cg.height;
    const leftDist = Math.abs(geometry.x - cgRight);
    if (leftDist < bestDistance) {
      bestDistance = leftDist;
      result = { snappedGeometry: { ...geometry, x: cgRight }, snapEdge: 'left' };
    }
    const rightDist = Math.abs(panelRight - cg.x);
    if (rightDist < bestDistance) {
      bestDistance = rightDist;
      result = { snappedGeometry: { ...geometry, x: cg.x - geometry.width }, snapEdge: 'right' };
    }
    const topDist = Math.abs(geometry.y - cgBottom);
    if (topDist < bestDistance) {
      bestDistance = topDist;
      result = { snappedGeometry: { ...geometry, y: cgBottom }, snapEdge: 'top' };
    }
    const bottomDist = Math.abs(panelBottom - cg.y);
    if (bottomDist < bestDistance) {
      bestDistance = bottomDist;
      result = { snappedGeometry: { ...geometry, y: cg.y - geometry.height }, snapEdge: 'bottom' };
    }
  }
  return result;
}

function clampSeam(value: number, lowerBound: number, upperBound: number) {
  if (lowerBound <= upperBound) return clamp(value, lowerBound, upperBound);
  return (lowerBound + upperBound) / 2;
}

function resizeSharedCornerGeometry(
  start: WorkspacePanelGeometry,
  group: SharedCornerResizeGroup,
  edge: ResizeEdge,
  dx: number,
  dy: number,
  minWidth: number,
  minHeight: number,
) {
  if (!isCorner(edge)) return null;

  const safe = viewportSafeRect();
  const selfXEdge: MovingXEdge = edge.includes('right') ? 'right' : 'left';
  const selfYEdge: MovingYEdge = edge.includes('bottom') ? 'bottom' : 'top';
  const rawXSeam = edge.includes('right') ? start.x + start.width + dx : start.x + dx;
  const rawYSeam = edge.includes('bottom') ? start.y + start.height + dy : start.y + dy;
  const tiles: SharedCornerResizeTile[] = [
    {
      id: 'self',
      geometry: start,
      minWidth,
      minHeight,
      xEdge: selfXEdge,
      yEdge: selfYEdge,
    },
    ...group.tiles,
  ];

  const leftEdgeTiles = tiles.filter((tile) => tile.xEdge === 'left');
  const rightEdgeTiles = tiles.filter((tile) => tile.xEdge === 'right');
  const topEdgeTiles = tiles.filter((tile) => tile.yEdge === 'top');
  const bottomEdgeTiles = tiles.filter((tile) => tile.yEdge === 'bottom');
  const xSeam = clampSeam(
    rawXSeam,
    rightEdgeTiles.length > 0
      ? Math.max(...rightEdgeTiles.map((tile) => tile.geometry.x + tile.minWidth))
      : safe.left,
    leftEdgeTiles.length > 0
      ? Math.min(...leftEdgeTiles.map((tile) => tile.geometry.x + tile.geometry.width - tile.minWidth))
      : safe.right,
  );
  const ySeam = clampSeam(
    rawYSeam,
    bottomEdgeTiles.length > 0
      ? Math.max(...bottomEdgeTiles.map((tile) => tile.geometry.y + tile.minHeight))
      : safe.top,
    topEdgeTiles.length > 0
      ? Math.min(...topEdgeTiles.map((tile) => tile.geometry.y + tile.geometry.height - tile.minHeight))
      : safe.bottom,
  );
  const updates = new Map<string, WorkspacePanelGeometry>();

  tiles.forEach((tile) => {
    const next = { ...tile.geometry };
    if (tile.xEdge === 'left') {
      const right = Math.min(next.x + next.width, safe.right);
      next.x = xSeam;
      next.width = right - xSeam;
    } else if (tile.xEdge === 'right') {
      next.x = Math.max(next.x, safe.left);
      next.width = xSeam - next.x;
    }

    if (tile.yEdge === 'top') {
      const bottom = Math.min(next.y + next.height, safe.bottom);
      next.y = ySeam;
      next.height = bottom - ySeam;
    } else if (tile.yEdge === 'bottom') {
      next.y = Math.max(next.y, safe.top);
      next.height = ySeam - next.y;
    }

    updates.set(tile.id, next);
  });

  const self = updates.get('self');
  if (!self) return null;
  updates.delete('self');
  return { self, neighbors: updates };
}

function resizeGeometry(
  start: WorkspacePanelGeometry,
  edge: ResizeEdge,
  dx: number,
  dy: number,
  minWidth: number,
  minHeight: number,
  options: { keepHeaderReachable?: boolean } = {},
) {
  const safe = viewportSafeRect(options);
  let x = start.x;
  let y = start.y;
  let width = start.width;
  let height = start.height;

  if (edge.includes('right')) width = start.width + dx;
  if (edge.includes('bottom')) height = start.height + dy;
  if (edge.includes('left')) {
    x = start.x + dx;
    width = start.width - dx;
  }
  if (edge.includes('top')) {
    y = start.y + dy;
    height = start.height - dy;
  }

  if (width < minWidth) {
    if (edge.includes('left')) x -= minWidth - width;
    width = minWidth;
  }

  if (height < minHeight) {
    if (edge.includes('top')) y -= minHeight - height;
    height = minHeight;
  }

  x = clamp(x, safe.left, safe.right - minWidth);
  y = clamp(y, safe.top, safe.bottom - minHeight);
  width = Math.min(width, safe.right - x);
  height = Math.min(height, safe.bottom - y);

  return clampGeometry({ x, y, width, height }, minWidth, minHeight, options);
}

function isCorner(edge: ResizeEdge | null) {
  return Boolean(edge?.includes('-'));
}

function edgeSides(edge: ResizeEdge | null) {
  if (!edge) return [];
  if (edge === 'top-left') return ['top', 'left'];
  if (edge === 'top-right') return ['top', 'right'];
  if (edge === 'bottom-left') return ['bottom', 'left'];
  if (edge === 'bottom-right') return ['bottom', 'right'];
  return [edge];
}

function EdgeIndicator({ activeEdge, snapped = false }: { activeEdge: ResizeEdge | null; snapped?: boolean }) {
  if (!activeEdge) return null;

  if (isCorner(activeEdge)) {
    return (
      <div className={cn('pointer-events-none absolute inset-0 z-20 border border-accent/45 shadow-[0_0_14px_rgba(56,189,248,0.24)]', snapped ? 'rounded-none' : 'rounded-[18px]')}>
        {activeEdge === 'top-left' && (
          <span data-resize-indicator="top-left" className="absolute left-[-7px] top-[-7px] h-7 w-7 rounded-tl-[11px] border-l-[3px] border-t-[3px] border-accent shadow-[0_0_16px_var(--color-accent)]" />
        )}
        {activeEdge === 'top-right' && (
          <span data-resize-indicator="top-right" className="absolute right-[-7px] top-[-7px] h-7 w-7 rounded-tr-[11px] border-r-[3px] border-t-[3px] border-accent shadow-[0_0_16px_var(--color-accent)]" />
        )}
        {activeEdge === 'bottom-left' && (
          <span data-resize-indicator="bottom-left" className="absolute bottom-[-7px] left-[-7px] h-7 w-7 rounded-bl-[11px] border-b-[3px] border-l-[3px] border-accent shadow-[0_0_16px_var(--color-accent)]" />
        )}
        {activeEdge === 'bottom-right' && (
          <span data-resize-indicator="bottom-right" className="absolute bottom-[-7px] right-[-7px] h-7 w-7 rounded-br-[11px] border-b-[3px] border-r-[3px] border-accent shadow-[0_0_16px_var(--color-accent)]" />
        )}
      </div>
    );
  }

  const sides = edgeSides(activeEdge);

  return (
    <div className={cn('pointer-events-none absolute inset-0 z-20 border border-accent/45 shadow-[0_0_14px_rgba(56,189,248,0.24)]', snapped ? 'rounded-none' : 'rounded-[18px]')}>
      {sides.includes('left') && (
        <span data-resize-indicator="left" className="absolute left-[-7px] top-[12.5%] h-[75%] w-[3px] rounded-full bg-accent shadow-[0_0_16px_var(--color-accent)]" />
      )}
      {sides.includes('right') && (
        <span data-resize-indicator="right" className="absolute right-[-7px] top-[12.5%] h-[75%] w-[3px] rounded-full bg-accent shadow-[0_0_16px_var(--color-accent)]" />
      )}
      {sides.includes('top') && (
        <span data-resize-indicator="top" className="absolute left-[12.5%] top-[-7px] h-[3px] w-[75%] rounded-full bg-accent shadow-[0_0_16px_var(--color-accent)]" />
      )}
      {sides.includes('bottom') && (
        <span data-resize-indicator="bottom" className="absolute bottom-[-7px] left-[12.5%] h-[3px] w-[75%] rounded-full bg-accent shadow-[0_0_16px_var(--color-accent)]" />
      )}
    </div>
  );
}

const JUNCTION_GLYPH_POSITION: Record<string, string> = {
  'top-left': 'left-[-4px] top-[-4px]',
  'top-right': 'right-[-4px] top-[-4px]',
  'bottom-left': 'left-[-4px] bottom-[-4px]',
  'bottom-right': 'right-[-4px] bottom-[-4px]',
};

/**
 * A dot (3-way) or crosshair (4-way) stamped at the exact point multiple
 * panels meet — deliberately not a directional glyph like a T or L, since
 * that would claim a specific neighbor arrangement we don't have full
 * topology for. A crosshair is topologically honest for any true 4-way
 * junction (two boundaries always cross there); a plain dot for 3-way avoids
 * making that same claim when it isn't earned.
 */
function JunctionGlyph({ edge, junctionCount }: { edge: ResizeEdge; junctionCount: number }) {
  const position = JUNCTION_GLYPH_POSITION[edge];
  if (!position) return null;

  if (junctionCount >= 4) {
    return (
      <span
        aria-hidden="true"
        data-resize-junction-glyph="4-way"
        className={cn('pointer-events-none absolute z-[26] h-2 w-2 animate-[seam-fade-in_150ms_ease-out]', position)}
      >
        <span className="absolute left-1/2 top-0 h-full w-[1.5px] -translate-x-1/2 rounded-full bg-white/70" />
        <span className="absolute left-0 top-1/2 h-[1.5px] w-full -translate-y-1/2 rounded-full bg-white/70" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      data-resize-junction-glyph="3-way"
      className={cn('pointer-events-none absolute z-[26] h-[5px] w-[5px] animate-[seam-fade-in_150ms_ease-out] rounded-full bg-white/55', position)}
    />
  );
}

function SharedSeamIndicator({ edge, junctionCount = 0 }: { edge: ResizeEdge | null; junctionCount?: number }) {
  if (!edge || junctionCount < 2) return null;
  const sides = edgeSides(edge);
  // Brightness escalates with how many panels share this point — a plain
  // 2-panel seam stays subtle, a 4-way junction reads clearly before the
  // drag even starts.
  const alpha = junctionCount >= 4 ? 0.5 : junctionCount === 3 ? 0.38 : 0.25;
  const bgColor = `rgba(255,255,255,${alpha})`;

  return (
    <>
      {sides.map((side) => (
        <span
          key={side}
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute z-[25] animate-[seam-fade-in_150ms_ease-out]',
            side === 'left' && 'bottom-0 left-[-1px] top-0 w-[2px] rounded-[1px]',
            side === 'right' && 'bottom-0 right-[-1px] top-0 w-[2px] rounded-[1px]',
            side === 'top' && 'left-0 right-0 top-[-1px] h-[2px] rounded-[1px]',
            side === 'bottom' && 'bottom-[-1px] left-0 right-0 h-[2px] rounded-[1px]',
          )}
          style={{ backgroundColor: bgColor }}
          data-resize-seam-indicator={edge}
          data-resize-seam-side={side}
        />
      ))}
      {isCorner(edge) && junctionCount >= 3 && <JunctionGlyph edge={edge} junctionCount={junctionCount} />}
    </>
  );
}

function MoveSnapEdgeIndicator({ edge }: { edge: SeamEdge | null }) {
  if (!edge) return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute z-[26] animate-[seam-fade-in_80ms_ease-out] rounded-[1px]',
        edge === 'left' && 'bottom-0 left-[-1px] top-0 w-[2px]',
        edge === 'right' && 'bottom-0 right-[-1px] top-0 w-[2px]',
        edge === 'top' && 'left-0 right-0 top-[-1px] h-[2px]',
        edge === 'bottom' && 'bottom-[-1px] left-0 right-0 h-[2px]',
      )}
      style={{ backgroundColor: 'rgba(255,255,255,0.55)' }}
      data-move-snap-edge={edge}
    />
  );
}

function mosaicBorderMergeMasks(
  panelId: string,
  panelGeometry: WorkspacePanelGeometry,
  occupants: readonly WorkspaceGridOccupant[],
): MosaicBorderMergeMask[] {
  const masks: MosaicBorderMergeMask[] = [];
  const panelRight = panelGeometry.x + panelGeometry.width;
  const panelBottom = panelGeometry.y + panelGeometry.height;

  occupants.forEach((occupant) => {
    if (occupant.id === panelId || occupant.placement?.kind !== 'affixed') return;
    const other = occupant.rect;
    const otherRight = other.x + other.width;
    const otherBottom = other.y + other.height;
    const verticalOverlap = overlapLength(panelGeometry.y, panelBottom, other.y, otherBottom);
    const horizontalOverlap = overlapLength(panelGeometry.x, panelRight, other.x, otherRight);

    if (Math.abs(otherRight - panelGeometry.x) <= SHARED_SEAM_TOLERANCE && verticalOverlap > SHARED_SEAM_TOLERANCE) {
      masks.push({
        side: 'left',
        startPercent: (Math.max(panelGeometry.y, other.y) - panelGeometry.y) / panelGeometry.height * 100,
        sizePercent: verticalOverlap / panelGeometry.height * 100,
      });
    }

    if (Math.abs(other.x - panelRight) <= SHARED_SEAM_TOLERANCE && verticalOverlap > SHARED_SEAM_TOLERANCE) {
      masks.push({
        side: 'right',
        startPercent: (Math.max(panelGeometry.y, other.y) - panelGeometry.y) / panelGeometry.height * 100,
        sizePercent: verticalOverlap / panelGeometry.height * 100,
      });
    }

    if (Math.abs(otherBottom - panelGeometry.y) <= SHARED_SEAM_TOLERANCE && horizontalOverlap > SHARED_SEAM_TOLERANCE) {
      masks.push({
        side: 'top',
        startPercent: (Math.max(panelGeometry.x, other.x) - panelGeometry.x) / panelGeometry.width * 100,
        sizePercent: horizontalOverlap / panelGeometry.width * 100,
      });
    }

    if (Math.abs(other.y - panelBottom) <= SHARED_SEAM_TOLERANCE && horizontalOverlap > SHARED_SEAM_TOLERANCE) {
      masks.push({
        side: 'bottom',
        startPercent: (Math.max(panelGeometry.x, other.x) - panelGeometry.x) / panelGeometry.width * 100,
        sizePercent: horizontalOverlap / panelGeometry.width * 100,
      });
    }
  });

  return masks;
}

function MosaicBorderMergeMasks({ masks }: { masks: readonly MosaicBorderMergeMask[] }) {
  if (masks.length === 0) return null;
  const maskBackground = 'color-mix(in srgb, var(--color-bg-surface) 95%, var(--color-bg-raised) 5%)';

  return (
    <>
      {masks.map((mask, index) => {
        const style: CSSProperties = {
          background: maskBackground,
        };

        if (mask.side === 'left' || mask.side === 'right') {
          style.top = `${mask.startPercent}%`;
          style.height = `${mask.sizePercent}%`;
          style.width = '4px';
          if (mask.side === 'left') {
            style.left = '-2px';
          } else {
            style.right = '-2px';
          }
        } else {
          style.left = `${mask.startPercent}%`;
          style.width = `${mask.sizePercent}%`;
          style.height = '4px';
          if (mask.side === 'top') {
            style.top = '-2px';
          } else {
            style.bottom = '-2px';
          }
        }

        return (
          <span
            key={`${mask.side}-${index}`}
            aria-hidden="true"
            className="pointer-events-none absolute z-[18]"
            style={style}
            data-workspace-panel-merge-mask={mask.side}
          />
        );
      })}
    </>
  );
}

function useMeasuredWorkspaceCanvas() {
  const [canvas, setCanvas] = useState(() => readWorkspaceCanvasRect());
  const refreshCanvas = useCallback(() => {
    setCanvas(readWorkspaceCanvasRect());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    refreshCanvas();
    window.addEventListener('resize', refreshCanvas);

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(refreshCanvas) : null;
    if (observer && typeof document !== 'undefined') {
      observer.observe(document.body);
      document
        .querySelectorAll<HTMLElement>('[data-workspace-mosaic-canvas="true"], [data-app-workspace-home="true"], [data-app-workspace-pane], [data-assistantcaddy-shell-pane]')
        .forEach((element) => observer.observe(element));
    }

    return () => {
      window.removeEventListener('resize', refreshCanvas);
      observer?.disconnect();
    };
  }, [refreshCanvas]);

  return { canvas, refreshCanvas };
}

function SnapPreview({ placement }: { placement: WorkspaceGridPlacement }) {
  if (typeof document === 'undefined') return null;

  const style: CSSProperties = {
    left: placement.rect.x,
    top: placement.rect.y,
    width: placement.rect.width,
    height: placement.rect.height,
  };

  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[85] rounded-[18px] border border-dashed border-accent/70 bg-accent/10 shadow-[0_0_24px_rgba(56,189,248,0.18)]"
      style={style}
      data-workspace-snap-preview={placement.legacyZone ?? placement.id}
      data-workspace-snap-grid={placement.grid}
      data-workspace-snap-cell={`${placement.column},${placement.row}`}
      data-workspace-snap-span={`${placement.columnSpan}x${placement.rowSpan}`}
    />,
    document.body,
  );
}

function JoinWallCues({ segments }: { segments: readonly WorkspaceJoinCueSegment[] }) {
  if (typeof document === 'undefined' || segments.length === 0) return null;

  return createPortal(
    <>
      {segments.map((segment, index) => {
        const vertical = segment.side === 'left' || segment.side === 'right';
        const thickness = segment.kind === 'neighbor-seam' ? 4 : 3;
        const style: CSSProperties = vertical
          ? {
              left: segment.rect.x - thickness / 2,
              top: segment.rect.y,
              width: thickness,
              height: segment.rect.height,
            }
          : {
              left: segment.rect.x,
              top: segment.rect.y - thickness / 2,
              width: segment.rect.width,
              height: thickness,
            };

        return (
          <span
            key={`${segment.kind}-${segment.side}-${index}`}
            aria-hidden="true"
            className={cn(
              'pointer-events-none fixed z-[118] rounded-full bg-accent shadow-[0_0_18px_var(--color-accent)]',
              segment.kind === 'workspace-edge' ? 'opacity-80' : 'opacity-95',
            )}
            style={style}
            data-workspace-join-cue="true"
            data-workspace-join-cue-kind={segment.kind}
            data-workspace-join-cue-side={segment.side}
          />
        );
      })}
    </>,
    document.body,
  );
}

function ApproachCues({ segments }: { segments: readonly WorkspaceJoinCueSegment[] }) {
  if (typeof document === 'undefined' || segments.length === 0) return null;

  return createPortal(
    <>
      {segments.map((segment, index) => {
        const vertical = segment.side === 'left' || segment.side === 'right';
        const style: CSSProperties = vertical
          ? { left: segment.rect.x - 0.5, top: segment.rect.y, width: 1, height: segment.rect.height }
          : { left: segment.rect.x, top: segment.rect.y - 0.5, width: segment.rect.width, height: 1 };

        return (
          <span
            key={`approach-${segment.side}-${index}`}
            aria-hidden="true"
            className="pointer-events-none fixed z-[117] bg-accent opacity-40"
            style={style}
            data-workspace-approach-cue="true"
            data-workspace-approach-cue-side={segment.side}
          />
        );
      })}
    </>,
    document.body,
  );
}

export function WorkspacePanel({
  id,
  title,
  mode,
  geometry,
  onModeChange,
  onGeometryChange,
  children,
  dockedClassName,
  floatingClassName,
  placeholderClassName,
  bodyClassName,
  floatingAriaLabel,
  resizeLabelBase,
  minimizeLabel,
  closeLabel,
  restoreLabel,
  preserveChildrenWhenMinimized = false,
  preserveChildrenAcrossModes = false,
  deferMount = false,
  active = true,
  minWidth = 300,
  minHeight = 220,
  compactWidth = 380,
  compactHeight = 320,
  forceCompact = false,
  zIndex,
  onPanelFocus,
  onRestore,
  onClose,
}: WorkspacePanelProps) {
  const workspacePanelContext = useContext(WorkspacePanelContext);
  const { settings } = useSettings();
  const panelSnapEnabled = settings.workspacePanelSnap !== false;
  // Tracks whether this panel has ever been active; once true, stays true so children stay mounted.
  const [hasEverBeenActive, setHasEverBeenActive] = useState(() => !deferMount || active);
  useEffect(() => {
    if (!hasEverBeenActive && active) setHasEverBeenActive(true);
  }, [active, hasEverBeenActive]);
  const [activeResizeEdge, setActiveResizeEdge] = useState<ResizeEdge | null>(null);
  const [activeSharedSeamEdge, setActiveSharedSeamEdge] = useState<ResizeEdge | null>(null);
  // How many panels (including this one) meet at the point being resized —
  // 0 = no shared neighbor, 2 = a seam shared with one neighbor, 3/4 = a
  // corner junction shared with two/three neighbors. Drives which glyph
  // SharedSeamIndicator renders so a 4-way corner reads differently from a
  // plain 2-panel seam before you even start dragging.
  const [seamJunctionCount, setSeamJunctionCount] = useState(0);
  const [moveSnapEdge, setMoveSnapEdge] = useState<SeamEdge | null>(null);
  const [bottomSnapNear, setBottomSnapNear] = useState(false);
  const [snapPreview, setSnapPreview] = useState<WorkspaceGridPlacement | null>(null);
  const [snapPreviewCanvas, setSnapPreviewCanvas] = useState(() => readWorkspaceCanvasRect());
  const [approachCues, setApproachCues] = useState<WorkspaceJoinCueSegment[]>([]);
  const [headerAccessory, setHeaderAccessory] = useState<WorkspacePanelHeaderAccessory | null>(null);
  const { canvas: workspaceCanvas, refreshCanvas } = useMeasuredWorkspaceCanvas();
  const providerPanel = workspacePanelContext?.getPanel(id);
  const panelPlacement = providerPanel?.placement ?? freeWorkspacePanelPlacement;
  const occupiedGridPlacements = useMemo<WorkspaceGridOccupant[]>(
    () => workspacePanelContext?.panels
      .filter((panel) => panel.placement.kind === 'affixed')
      .map((panel) => ({ id: panel.id, rect: panel.geometry, placement: panel.placement })) ?? [],
    [workspacePanelContext?.panels],
  );
  const panelGeometry = useMemo(
    () => clampGeometry(geometry, minWidth, minHeight, { keepHeaderReachable: panelPlacement.kind !== 'affixed' }),
    [geometry, minHeight, minWidth, panelPlacement.kind],
  );
  const workspaceGridPlacements = useMemo(
    () => listWorkspaceGridPlacements(
      workspaceCanvas,
      { minWidth, minHeight },
      occupiedGridPlacements,
      id,
    ),
    [id, minHeight, minWidth, occupiedGridPlacements, workspaceCanvas],
  );
  const joinCueSegments = useMemo(
    () => snapPreview
      ? getWorkspaceJoinCueSegments(snapPreview, snapPreviewCanvas, occupiedGridPlacements, id)
      : [],
    [id, occupiedGridPlacements, snapPreview, snapPreviewCanvas],
  );
  const workspaceSnapGridOptions = summarizeWorkspaceGridKeys(workspaceGridPlacements.map((placement) => placement.grid));
  const workspaceSnapCellOptions = summarizeWorkspacePlacementIds(workspaceGridPlacements);
  const floatingZIndex = Math.max(zIndex ?? FLOATING_PANEL_Z_INDEX_FLOOR, FLOATING_PANEL_Z_INDEX_FLOOR);
  const snapped = mode === 'floating' && panelPlacement.kind === 'affixed';
  const renderedPanelGeometry = useMemo(() => {
    if (mode !== 'floating' || snapped) return panelGeometry;
    const reachableTop = floatingHeaderReachableTop();
    if (panelGeometry.y >= reachableTop) return panelGeometry;
    return { ...panelGeometry, y: reachableTop };
  }, [mode, panelGeometry, snapped]);
  const compact = forceCompact || renderedPanelGeometry.width < compactWidth || renderedPanelGeometry.height < compactHeight;
  const labelBase = resizeLabelBase || title.toLowerCase();
  const resolvedMinimizeLabel = minimizeLabel || `Minimize ${labelBase}`;
  const resolvedCloseLabel = closeLabel || `Close ${labelBase}`;
  const resolvedRestoreLabel = restoreLabel || `Restore ${labelBase}`;
  const snapZoneName = panelPlacement.kind === 'affixed' ? panelPlacement.legacyZone ?? panelPlacement.id : null;
  // Bottom-right cells win ties over top-left ones — an arbitrary but stable
  // convention, capped well under FLOATING_PANEL_Z_INDEX_FLOOR so a snapped
  // panel can never outrank a genuinely floating one.
  const snappedZIndex = panelPlacement.kind === 'affixed'
    ? SNAPPED_PANEL_Z_INDEX_BASE + Math.min(panelPlacement.row * 4 + panelPlacement.column, 20)
    : SNAPPED_PANEL_Z_INDEX_BASE;
  const effectiveFloatingZIndex = snapped ? snappedZIndex : floatingZIndex;
  const contextSeamEdge = workspacePanelContext?.activeSeamEdges.get(id) ?? null;
  const sharedSeamEdge = snapped ? (activeSharedSeamEdge ?? contextSeamEdge) : null;
  const mosaicAttachmentState = useMemo(
    () => snapped ? getWorkspaceMosaicAttachmentState(id, panelGeometry, occupiedGridPlacements) : null,
    [id, occupiedGridPlacements, panelGeometry, snapped],
  );
  const mosaicAttachedSides = mosaicAttachmentState ? summarizeWorkspaceMosaicSides(mosaicAttachmentState) : '';
  const mosaicRoundedCorners = mosaicAttachmentState ? summarizeWorkspaceMosaicRoundedCorners(mosaicAttachmentState) : '';
  const mosaicMergeMasks = useMemo(
    () => snapped ? mosaicBorderMergeMasks(id, panelGeometry, occupiedGridPlacements) : [],
    [id, occupiedGridPlacements, panelGeometry, snapped],
  );
  const mosaicEdgeSegments = useMemo(
    () => snapped ? getWorkspaceMosaicExposedEdgeSegments(id, panelGeometry, occupiedGridPlacements) : [],
    [id, occupiedGridPlacements, panelGeometry, snapped],
  );
  const mosaicEdgeSegmentSummary = summarizeWorkspaceMosaicEdgeSegments(mosaicEdgeSegments);
  const snappedMosaicStyle = mosaicAttachmentState
    ? {
        '--workspace-mosaic-radius-tl': mosaicAttachmentState.topLeftRounded ? '8px' : '0px',
        '--workspace-mosaic-radius-tr': mosaicAttachmentState.topRightRounded ? '8px' : '0px',
        '--workspace-mosaic-radius-br': mosaicAttachmentState.bottomRightRounded ? '8px' : '0px',
        '--workspace-mosaic-radius-bl': mosaicAttachmentState.bottomLeftRounded ? '8px' : '0px',
      } as CSSProperties
    : undefined;
  const chromeContext = useMemo<WorkspacePanelChromeContextValue>(
    () => ({ compact, setHeaderAccessory }),
    [compact],
  );
  const bodyChildren = hasEverBeenActive ? (
    <WorkspacePanelChromeContext.Provider value={chromeContext}>
      {children}
    </WorkspacePanelChromeContext.Provider>
  ) : null;

  useLayoutEffect(() => {
    if (mode !== 'floating' || panelPlacement.kind === 'affixed') return;
    const nextGeometry = clampGeometry(geometry, minWidth, minHeight, { keepHeaderReachable: true });
    if (geometriesEqual(geometry, nextGeometry)) return;
    onGeometryChange(nextGeometry);
  }, [active, geometry, minHeight, minWidth, mode, onGeometryChange, panelPlacement.kind]);

  const startMove = (event: PointerEvent<HTMLElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('button, input, select, textarea, [role="combobox"], [data-workspace-panel-no-drag="true"]')) {
      return;
    }

    onPanelFocus?.();
    event.preventDefault();
    const dragTarget = event.currentTarget;
    dragTarget.setPointerCapture?.(event.pointerId);
    const startX = event.clientX;
    const startY = event.clientY;
    const startGeometry = renderedPanelGeometry;
    let pendingSnapPlacement: WorkspaceGridPlacement | null = null;
    let lastGeometry = startGeometry;
    let moved = false;

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      moved = true;
      const rawGeometry = clampGeometry(
        {
          ...startGeometry,
          x: startGeometry.x + moveEvent.clientX - startX,
          y: startGeometry.y + moveEvent.clientY - startY,
        },
        minWidth,
        minHeight,
        { keepHeaderReachable: true },
      );

      const snapTarget = panelSnapEnabled ? findMoveSnapTarget(id, rawGeometry) : null;
      const nextGeometry = snapTarget ? snapTarget.snappedGeometry : rawGeometry;
      setMoveSnapEdge(snapTarget?.snapEdge ?? null);
      onGeometryChange(nextGeometry);
      lastGeometry = nextGeometry;
      const canvas = readWorkspaceCanvasRect();
      refreshCanvas();
      setSnapPreviewCanvas(canvas);
      pendingSnapPlacement = selectWorkspaceGridPlacementForPointer({
        canvas,
        minimums: {
          minWidth,
          minHeight,
          preferredWidth: nextGeometry.width,
          preferredHeight: nextGeometry.height,
        },
        occupants: occupiedGridPlacements,
        movingPanelId: id,
        pointerX: moveEvent.clientX,
        pointerY: moveEvent.clientY,
      });
      setSnapPreview(pendingSnapPlacement);
      if (!pendingSnapPlacement) {
        setApproachCues(getWorkspaceApproachCueSegments(nextGeometry, canvas, occupiedGridPlacements, id));
      } else {
        setApproachCues([]);
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      if (dragTarget.hasPointerCapture?.(event.pointerId)) {
        dragTarget.releasePointerCapture(event.pointerId);
      }
      setSnapPreview(null);
      setApproachCues([]);
      setMoveSnapEdge(null);
      setSnapPreviewCanvas(readWorkspaceCanvasRect());

      if (pendingSnapPlacement) {
        const nextGeometry = clampGeometry(pendingSnapPlacement.rect, minWidth, minHeight);
        onGeometryChange(nextGeometry);
        workspacePanelContext?.setPlacement(
          id,
          workspacePanelPlacementFromGridPlacement({ ...pendingSnapPlacement, rect: nextGeometry }),
        );
      } else if (moved) {
        onGeometryChange(clampGeometry(lastGeometry, minWidth, minHeight, { keepHeaderReachable: true }));
        workspacePanelContext?.setPlacement(id, freeWorkspacePanelPlacement);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  };

  const startResize = (edge: ResizeEdge, event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const startGeometry = renderedPanelGeometry;
    const seamGroup = sharedCornerResizeGroup(id, edge, startGeometry);
    const allSeamNeighbors = sharedResizeNeighbors(id, edge, startGeometry)
      .filter((neighbor) => workspacePanelContext?.getPanel(neighbor.id));
    const zone = getSeamZone(event, edge);
    const seamNeighbors = filterNeighborsByZone(allSeamNeighbors, zone, edge, startGeometry);
    const junctionCount = seamGroup ? seamGroup.tiles.length + 1 : seamNeighbors.length > 0 ? seamNeighbors.length + 1 : 0;
    setActiveResizeEdge(edge);
    setActiveSharedSeamEdge(seamGroup || seamNeighbors.length > 0 ? edge : null);
    setSeamJunctionCount(junctionCount);
    if (!isCorner(edge)) {
      const seamEdge = edge as SeamEdge;
      if (seamNeighbors.length > 0) {
        seamNeighbors.forEach((n) => workspacePanelContext?.notifySeamEdge(n.id, OPPOSITE_SEAM_EDGE[seamEdge]));
      }
      // Group glow: co-parents (panels sharing the same edge) also glow
      const coParentIds = findCoParentIds(id, seamEdge, startGeometry);
      coParentIds.forEach((cpId) => workspacePanelContext?.notifySeamEdge(cpId, seamEdge));
    }
    if (seamGroup) {
      // Corner group glow: notify tiles to show the side that faces the corner
      seamGroup.tiles.forEach((tile) => {
        const glowEdge = tile.xEdge ?? tile.yEdge;
        if (glowEdge) workspacePanelContext?.notifySeamEdge(tile.id, glowEdge as SeamEdge);
      });
    }

    const updatePlacementRect = (panelId: string, nextGeometry: WorkspacePanelGeometry) => {
      const currentPlacement = workspacePanelContext?.getPanel(panelId)?.placement;
      if (currentPlacement?.kind === 'affixed') {
        workspacePanelContext?.setPlacement(panelId, { ...currentPlacement, rect: nextGeometry });
      }
    };

    const applySelfGeometry = (nextGeometry: WorkspacePanelGeometry) => {
      onGeometryChange(nextGeometry);
      updatePlacementRect(id, nextGeometry);
    };

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (seamGroup) {
        const sharedGeometry = resizeSharedCornerGeometry(startGeometry, seamGroup, edge, dx, dy, minWidth, minHeight);
        if (sharedGeometry) {
          applySelfGeometry(sharedGeometry.self);
          sharedGeometry.neighbors.forEach((neighborGeometry, neighborId) => {
            if (workspacePanelContext?.getPanel(neighborId)) {
              workspacePanelContext.setGeometry(neighborId, neighborGeometry);
              updatePlacementRect(neighborId, neighborGeometry);
            }
          });
          return;
        }
      }

      if (seamNeighbors.length > 0) {
        const sharedGeometry = resizeSharedSeamGeometry(startGeometry, seamNeighbors, edge, dx, dy, minWidth, minHeight);
        if (sharedGeometry) {
          applySelfGeometry(sharedGeometry.self);
          sharedGeometry.neighbors.forEach((neighborGeometry, neighborId) => {
            if (workspacePanelContext?.getPanel(neighborId)) {
              workspacePanelContext.setGeometry(neighborId, neighborGeometry);
              updatePlacementRect(neighborId, neighborGeometry);
            }
          });
          return;
        }
      }

      const nextGeometry = resizeGeometry(startGeometry, edge, dx, dy, minWidth, minHeight, { keepHeaderReachable: !snapped });
      applySelfGeometry(nextGeometry);
      if (edge === 'bottom' || edge === 'bottom-left' || edge === 'bottom-right') {
        const safe = viewportSafeRect();
        const panelBottomEdge = nextGeometry.y + nextGeometry.height;
        setBottomSnapNear(safe.bottom - panelBottomEdge <= 12);
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      setActiveResizeEdge(null);
      setActiveSharedSeamEdge(null);
      setSeamJunctionCount(0);
      setBottomSnapNear(false);
      if (!isCorner(edge)) {
        const seamEdge = edge as SeamEdge;
        seamNeighbors.forEach((n) => workspacePanelContext?.notifySeamEdge(n.id, null));
        const coParentIds = findCoParentIds(id, seamEdge, startGeometry);
        coParentIds.forEach((cpId) => workspacePanelContext?.notifySeamEdge(cpId, null));
      }
      if (seamGroup) {
        seamGroup.tiles.forEach((tile) => workspacePanelContext?.notifySeamEdge(tile.id, null));
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  };

  const activateResizeEdge = (edge: ResizeEdge) => {
    setActiveResizeEdge(edge);
    const cornerGroup = isCorner(edge) ? sharedCornerResizeGroup(id, edge, panelGeometry) : null;
    const seamNeighbors = !isCorner(edge) ? sharedResizeNeighbors(id, edge, panelGeometry) : [];
    const isSeam = !!(cornerGroup || seamNeighbors.length > 0);
    setActiveSharedSeamEdge(isSeam ? edge : null);
    setSeamJunctionCount(cornerGroup ? cornerGroup.tiles.length + 1 : seamNeighbors.length > 0 ? seamNeighbors.length + 1 : 0);
    if (!isCorner(edge)) {
      const seamEdge = edge as SeamEdge;
      seamNeighbors.forEach((n) => workspacePanelContext?.notifySeamEdge(n.id, OPPOSITE_SEAM_EDGE[seamEdge]));
      const coParentIds = findCoParentIds(id, seamEdge, panelGeometry);
      coParentIds.forEach((cpId) => workspacePanelContext?.notifySeamEdge(cpId, seamEdge));
    }
    if (cornerGroup) {
      cornerGroup.tiles.forEach((tile) => {
        const glowEdge = tile.xEdge ?? tile.yEdge;
        if (glowEdge) workspacePanelContext?.notifySeamEdge(tile.id, glowEdge as SeamEdge);
      });
    }
  };

  const clearResizeEdge = (edge: ResizeEdge) => {
    setActiveResizeEdge((current) => current === edge ? null : current);
    setActiveSharedSeamEdge((current) => current === edge ? null : current);
    if (activeResizeEdge === edge) setSeamJunctionCount(0);
    if (!isCorner(edge)) {
      const seamEdge = edge as SeamEdge;
      sharedResizeNeighbors(id, seamEdge, panelGeometry).forEach((n) => {
        workspacePanelContext?.notifySeamEdge(n.id, null);
      });
      findCoParentIds(id, seamEdge, panelGeometry).forEach((cpId) => {
        workspacePanelContext?.notifySeamEdge(cpId, null);
      });
    } else {
      const cornerGroup = sharedCornerResizeGroup(id, edge, panelGeometry);
      cornerGroup?.tiles.forEach((tile) => workspacePanelContext?.notifySeamEdge(tile.id, null));
    }
  };

  const handlePanelPointerDownCapture = (event: PointerEvent<HTMLElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('button, input, select, textarea, [role="combobox"], [data-workspace-panel-no-drag="true"]')) return;
    onPanelFocus?.();
  };

  const header = (
    <header
      className={cn(
        'flex shrink-0 items-center gap-2 border-b border-border-subtle/35 px-3 py-2',
        mode === 'floating' && 'cursor-move select-none',
        snapped && 'px-2 py-1.5',
      )}
      onPointerDown={mode === 'floating' ? startMove : undefined}
      data-workspace-panel-header="true"
    >
      {mode === 'floating' ? (
        <Move size={14} className="shrink-0 text-accent" aria-hidden="true" />
      ) : (
        <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]" aria-hidden="true" />
      )}
      <div className={cn('min-w-0 truncate text-[10px] font-semibold uppercase text-accent', headerAccessory?.replaceTitle ? 'sr-only' : 'flex-1')}>{title}</div>
      {headerAccessory && (
        <div
          className={cn(
            'min-w-0 flex-1 items-center justify-end',
            headerAccessory.replaceTitle ? 'flex' : 'hidden md:flex',
          )}
          data-workspace-panel-titlebar-accessory="true"
        >
          {headerAccessory.content}
        </div>
      )}
      <div
        className="flex shrink-0 items-center gap-1"
        data-workspace-panel-no-drag="true"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onModeChange('minimized')}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border-subtle bg-bg-primary/70 text-text-secondary transition-colors hover:border-border-medium hover:bg-bg-hover hover:text-text-primary"
          aria-label={resolvedMinimizeLabel}
          title={resolvedMinimizeLabel}
        >
          <Minimize2 size={12} />
        </button>
        {mode === 'floating' && (
          <button
            type="button"
            onClick={() => {
              if (onClose) {
                onClose();
                return;
              }
              onModeChange('docked');
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border-subtle bg-bg-primary/70 text-text-secondary transition-colors hover:border-border-medium hover:bg-bg-hover hover:text-text-primary"
            aria-label={resolvedCloseLabel}
            title={resolvedCloseLabel}
          >
            <X size={12} />
          </button>
        )}
      </div>
    </header>
  );

  if (preserveChildrenAcrossModes || preserveChildrenWhenMinimized) {
    const visible = active && mode !== 'minimized';
    const style: CSSProperties | undefined = mode === 'floating'
      ? {
          left: renderedPanelGeometry.x,
          top: renderedPanelGeometry.y,
          width: renderedPanelGeometry.width,
          height: renderedPanelGeometry.height,
          zIndex: effectiveFloatingZIndex,
        }
      : undefined;

    const restoreMinimizedPanel = () => {
      if (onRestore) {
        onRestore();
        return;
      }
      onModeChange('docked');
    };

    return (
      <>
        {mode === 'minimized' && (
          <MinimizedPanelRollup
            id={id}
            title={title}
            active={active}
            panelPlacement={panelPlacement}
            placeholderClassName={placeholderClassName}
            restoreLabel={resolvedRestoreLabel}
            onRestore={restoreMinimizedPanel}
          />
        )}
        <section
          key="workspace-panel-content"
          role={mode === 'floating' ? 'dialog' : undefined}
          aria-label={mode === 'floating' ? floatingAriaLabel || `${title} popout` : undefined}
          aria-hidden={!visible && mode === 'docked' ? true : undefined}
          className={cn(
            'rgb-border',
            mode === 'floating'
              ? 'fixed z-[120] flex min-h-0 flex-col overflow-visible rounded-[18px] border border-border-subtle/45 bg-bg-raised/96 text-text-primary shadow-[8px_12px_24px_rgba(0,0,0,0.34)] backdrop-blur-xl'
              : 'relative min-w-0 overflow-visible rounded-[14px] border border-border-subtle/35 bg-bg-primary/60',
            !visible && 'hidden',
            mode === 'floating' && activeResizeEdge && !(snapped && sharedSeamEdge) && 'border-accent/45',
            snapped && 'rounded-[2px] border-border-subtle/60 bg-bg-primary/94 shadow-none backdrop-blur-none',
            mode === 'floating' ? floatingClassName : dockedClassName,
          )}
          style={snappedMosaicStyle ? { ...style, ...snappedMosaicStyle } : style}
          data-panel-compact={compact ? 'true' : 'false'}
          data-workspace-panel={mode === 'minimized' ? undefined : id}
          data-workspace-panel-preserved={mode === 'minimized' ? id : undefined}
          data-workspace-panel-active-resize={mode === 'floating' ? activeResizeEdge || undefined : undefined}
          data-workspace-panel-chrome={mode === 'floating' ? snapped ? 'snapped' : 'floating' : undefined}
          data-workspace-panel-affixed={snapped ? 'true' : undefined}
          data-workspace-panel-snap-zone={snapped ? snapZoneName || undefined : undefined}
          data-workspace-panel-snap-grid={snapped && panelPlacement.kind === 'affixed' ? panelPlacement.grid : undefined}
          data-workspace-panel-snap-cell={snapped && panelPlacement.kind === 'affixed' ? `${panelPlacement.column},${panelPlacement.row}` : undefined}
          data-workspace-panel-grid-cell={snapped && panelPlacement.kind === 'affixed' ? `${panelPlacement.grid}:${panelPlacement.column},${panelPlacement.row}` : undefined}
          data-workspace-panel-snap-span={snapped && panelPlacement.kind === 'affixed' ? `${panelPlacement.columnSpan}x${panelPlacement.rowSpan}` : undefined}
          data-workspace-panel-grid-span={snapped && panelPlacement.kind === 'affixed' ? `${panelPlacement.columnSpan}x${panelPlacement.rowSpan}` : undefined}
          data-workspace-snap-grid-options={mode === 'floating' && workspaceSnapGridOptions ? workspaceSnapGridOptions : undefined}
          data-workspace-snap-cell-options={mode === 'floating' && workspaceSnapCellOptions ? workspaceSnapCellOptions : undefined}
          data-workspace-panel-shared-seam={sharedSeamEdge || undefined}
          data-workspace-panel-attached-sides={snapped && mosaicAttachedSides ? mosaicAttachedSides : undefined}
          data-workspace-panel-rounded-corners={snapped && mosaicRoundedCorners ? mosaicRoundedCorners : undefined}
          data-workspace-panel-mosaic-edge-segments={snapped && mosaicEdgeSegmentSummary ? mosaicEdgeSegmentSummary : undefined}
          data-workspace-panel-attached-left={snapped && mosaicAttachmentState?.left ? 'true' : undefined}
          data-workspace-panel-attached-right={snapped && mosaicAttachmentState?.right ? 'true' : undefined}
          data-workspace-panel-attached-top={snapped && mosaicAttachmentState?.top ? 'true' : undefined}
          data-workspace-panel-attached-bottom={snapped && mosaicAttachmentState?.bottom ? 'true' : undefined}
          data-workspace-panel-min-width={mode === 'floating' ? minWidth : undefined}
          data-workspace-panel-min-height={mode === 'floating' ? minHeight : undefined}
          data-workspace-panel-z-index={mode === 'floating' ? effectiveFloatingZIndex : undefined}
          data-workspace-panel-state={mode === 'minimized' ? undefined : mode}
          onPointerDownCapture={mode === 'floating' ? handlePanelPointerDownCapture : undefined}
        >
          {header}
          <div className={cn(mode === 'floating' ? 'min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-3' : 'overflow-hidden p-3', bodyClassName)} data-workspace-panel-body="true">
            {bodyChildren}
          </div>
          {settings.rgbBorders && <span className="rgb-ring" aria-hidden="true" />}
          {mode === 'floating' && (
            <>
              <MosaicBorderMergeMasks masks={mosaicMergeMasks} />
              <EdgeIndicator activeEdge={snapped && sharedSeamEdge ? null : activeResizeEdge} snapped={snapped} />
              <SharedSeamIndicator edge={sharedSeamEdge} junctionCount={seamJunctionCount} />
              <MoveSnapEdgeIndicator edge={moveSnapEdge} />
              {bottomSnapNear && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-[-1px] left-0 right-0 z-[25] h-[2px] animate-[seam-fade-in_150ms_ease-out] rounded-[1px]"
                  style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}
                />
              )}
              {resizeHandles.map((handle) => (
                <button
                  key={handle.edge}
                  type="button"
                  aria-label={`Resize ${labelBase} from ${handle.label}`}
                  className={cn('absolute z-30 rounded-full bg-transparent outline-none', handle.className, handle.cursor)}
                  data-resize-edge={handle.edge}
                  onPointerDown={(event) => startResize(handle.edge, event)}
                  onPointerEnter={() => activateResizeEdge(handle.edge)}
                  onPointerLeave={() => clearResizeEdge(handle.edge)}
                  onFocus={() => activateResizeEdge(handle.edge)}
                  onBlur={() => clearResizeEdge(handle.edge)}
                />
              ))}
            </>
          )}
        </section>
        {active && snapPreview && <SnapPreview placement={snapPreview} />}
        {active && joinCueSegments.length > 0 && <JoinWallCues segments={joinCueSegments} />}
        {active && !snapPreview && approachCues.length > 0 && <ApproachCues segments={approachCues} />}
      </>
    );
  }

  if (mode === 'minimized') {
    const restoreMinimizedPanel = () => {
      if (onRestore) {
        onRestore();
        return;
      }
      onModeChange('docked');
    };

    return (
      <MinimizedPanelRollup
        id={id}
        title={title}
        active={active}
        panelPlacement={panelPlacement}
        placeholderClassName={placeholderClassName}
        restoreLabel={resolvedRestoreLabel}
        onRestore={restoreMinimizedPanel}
      >
        {preserveChildrenWhenMinimized ? bodyChildren : undefined}
      </MinimizedPanelRollup>
    );
  }

  if (mode === 'floating') {
    const style: CSSProperties = {
      left: renderedPanelGeometry.x,
      top: renderedPanelGeometry.y,
      width: renderedPanelGeometry.width,
      height: renderedPanelGeometry.height,
      zIndex: effectiveFloatingZIndex,
    };

    return (
      <>
        {typeof document !== 'undefined' && createPortal(
          <section
            role="dialog"
            aria-label={floatingAriaLabel || `${title} popout`}
            className={cn(
              'rgb-border fixed z-[120] flex min-h-0 flex-col overflow-visible rounded-[18px] border border-border-subtle/45 bg-bg-raised/96 text-text-primary shadow-[8px_12px_24px_rgba(0,0,0,0.34)] backdrop-blur-xl',
              !active && 'hidden',
              activeResizeEdge && !(snapped && sharedSeamEdge) && 'border-accent/45',
              snapped && 'rounded-[2px] border-border-subtle/60 bg-bg-primary/94 shadow-none backdrop-blur-none',
              floatingClassName,
            )}
            style={snappedMosaicStyle ? { ...style, ...snappedMosaicStyle } : style}
            data-panel-compact={compact ? 'true' : 'false'}
            data-workspace-panel={id}
            data-workspace-panel-active-resize={activeResizeEdge || undefined}
            data-workspace-panel-chrome={snapped ? 'snapped' : 'floating'}
            data-workspace-panel-affixed={snapped ? 'true' : undefined}
            data-workspace-panel-snap-zone={snapped ? snapZoneName || undefined : undefined}
            data-workspace-panel-snap-grid={snapped && panelPlacement.kind === 'affixed' ? panelPlacement.grid : undefined}
            data-workspace-panel-snap-cell={snapped && panelPlacement.kind === 'affixed' ? `${panelPlacement.column},${panelPlacement.row}` : undefined}
            data-workspace-panel-grid-cell={snapped && panelPlacement.kind === 'affixed' ? `${panelPlacement.grid}:${panelPlacement.column},${panelPlacement.row}` : undefined}
            data-workspace-panel-snap-span={snapped && panelPlacement.kind === 'affixed' ? `${panelPlacement.columnSpan}x${panelPlacement.rowSpan}` : undefined}
            data-workspace-panel-grid-span={snapped && panelPlacement.kind === 'affixed' ? `${panelPlacement.columnSpan}x${panelPlacement.rowSpan}` : undefined}
            data-workspace-snap-grid-options={workspaceSnapGridOptions || undefined}
            data-workspace-snap-cell-options={workspaceSnapCellOptions || undefined}
            data-workspace-panel-shared-seam={sharedSeamEdge || undefined}
            data-workspace-panel-attached-sides={snapped && mosaicAttachedSides ? mosaicAttachedSides : undefined}
            data-workspace-panel-rounded-corners={snapped && mosaicRoundedCorners ? mosaicRoundedCorners : undefined}
            data-workspace-panel-mosaic-edge-segments={snapped && mosaicEdgeSegmentSummary ? mosaicEdgeSegmentSummary : undefined}
            data-workspace-panel-attached-left={snapped && mosaicAttachmentState?.left ? 'true' : undefined}
            data-workspace-panel-attached-right={snapped && mosaicAttachmentState?.right ? 'true' : undefined}
            data-workspace-panel-attached-top={snapped && mosaicAttachmentState?.top ? 'true' : undefined}
            data-workspace-panel-attached-bottom={snapped && mosaicAttachmentState?.bottom ? 'true' : undefined}
            data-workspace-panel-min-width={minWidth}
            data-workspace-panel-min-height={minHeight}
            data-workspace-panel-z-index={effectiveFloatingZIndex}
            data-workspace-panel-state="floating"
            onPointerDownCapture={handlePanelPointerDownCapture}
          >
            {header}
            <div className={cn('min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-3', bodyClassName)} data-workspace-panel-body="true">
              {bodyChildren}
            </div>
            {settings.rgbBorders && <span className="rgb-ring" aria-hidden="true" />}
            <MosaicBorderMergeMasks masks={mosaicMergeMasks} />
            <EdgeIndicator activeEdge={snapped && sharedSeamEdge ? null : activeResizeEdge} snapped={snapped} />
            <SharedSeamIndicator edge={sharedSeamEdge} junctionCount={seamJunctionCount} />
            <MoveSnapEdgeIndicator edge={moveSnapEdge} />
            {resizeHandles.map((handle) => (
              <button
                key={handle.edge}
                type="button"
                aria-label={`Resize ${labelBase} from ${handle.label}`}
                className={cn('absolute z-30 rounded-full bg-transparent outline-none', handle.className, handle.cursor)}
                data-resize-edge={handle.edge}
                onPointerDown={(event) => startResize(handle.edge, event)}
                onPointerEnter={() => activateResizeEdge(handle.edge)}
                onPointerLeave={() => clearResizeEdge(handle.edge)}
                onFocus={() => activateResizeEdge(handle.edge)}
                onBlur={() => clearResizeEdge(handle.edge)}
              />
            ))}
          </section>,
          document.body,
        )}
        {active && snapPreview && <SnapPreview placement={snapPreview} />}
        {active && joinCueSegments.length > 0 && <JoinWallCues segments={joinCueSegments} />}
        {active && !snapPreview && approachCues.length > 0 && <ApproachCues segments={approachCues} />}
      </>
    );
  }

  return (
    <section
      hidden={!active}
      aria-hidden={!active}
      className={cn('rgb-border relative min-w-0 overflow-visible rounded-[14px] border border-border-subtle/35 bg-bg-primary/60', !active && 'hidden', dockedClassName)}
      data-workspace-panel={id}
      data-workspace-panel-state="docked"
    >
      {header}
      <div className={cn('overflow-hidden p-3', bodyClassName)} data-workspace-panel-body="true">
        {bodyChildren}
      </div>
      {settings.rgbBorders && <span className="rgb-ring" aria-hidden="true" />}
    </section>
  );
}
