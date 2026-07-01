import type { ViewMode } from '../../types';

export const WORKSPACE_PANEL_DRAG_TYPE = 'application/x-threatcaddy-workspace-panel';
const WORKSPACE_PANEL_LAUNCH_KIND = 'threatcaddy.workspace-panel-launch';
const WORKSPACE_PANEL_LAUNCH_VERSION = 1;

export const DASHBOARD_WORKSPACE_PANEL_ID = 'dashboard-workspace';
export const ACTIVITY_WORKSPACE_PANEL_ID = 'activity-workspace';
export const PRODUCTS_WORKSPACE_PANEL_ID = 'products-workspace';
export const NOTES_WORKSPACE_PANEL_ID = 'notes-workspace';
export const TASKS_WORKSPACE_PANEL_ID = 'tasks-workspace';
export const EVIDENCE_WORKSPACE_PANEL_ID = 'evidence-workspace';
export const TIMELINE_WORKSPACE_PANEL_ID = 'timeline-workspace';

type WorkspacePanelLaunchableView = Extract<
  ViewMode,
  'dashboard' | 'activity' | 'products' | 'notes' | 'tasks' | 'evidence' | 'timeline'
>;

export interface WorkspacePanelLaunchDescriptor {
  view: WorkspacePanelLaunchableView;
  panelId: string;
  title: string;
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
}

export const WORKSPACE_PANEL_LAUNCH_DESCRIPTORS = {
  dashboard: {
    view: 'dashboard',
    panelId: DASHBOARD_WORKSPACE_PANEL_ID,
    title: 'Dashboard',
    defaultWidth: 900,
    defaultHeight: 620,
    minWidth: 520,
    minHeight: 420,
  },
  activity: {
    view: 'activity',
    panelId: ACTIVITY_WORKSPACE_PANEL_ID,
    title: 'Activity',
    defaultWidth: 840,
    defaultHeight: 620,
    minWidth: 500,
    minHeight: 420,
  },
  products: {
    view: 'products',
    panelId: PRODUCTS_WORKSPACE_PANEL_ID,
    title: 'Products',
    defaultWidth: 920,
    defaultHeight: 640,
    minWidth: 400,
    minHeight: 300,
  },
  notes: {
    view: 'notes',
    panelId: NOTES_WORKSPACE_PANEL_ID,
    title: 'Notes',
    defaultWidth: 560,
    defaultHeight: 380,
    minWidth: 320,
    minHeight: 240,
  },
  tasks: {
    view: 'tasks',
    panelId: TASKS_WORKSPACE_PANEL_ID,
    title: 'Tasks',
    defaultWidth: 360,
    defaultHeight: 340,
    minWidth: 300,
    minHeight: 240,
  },
  evidence: {
    view: 'evidence',
    panelId: EVIDENCE_WORKSPACE_PANEL_ID,
    title: 'Evidence',
    defaultWidth: 980,
    defaultHeight: 660,
    minWidth: 420,
    minHeight: 320,
  },
  timeline: {
    view: 'timeline',
    panelId: TIMELINE_WORKSPACE_PANEL_ID,
    title: 'Timeline',
    defaultWidth: 980,
    defaultHeight: 660,
    minWidth: 420,
    minHeight: 320,
  },
} as const satisfies Record<string, WorkspacePanelLaunchDescriptor>;

export type WorkspacePanelLaunchView = keyof typeof WORKSPACE_PANEL_LAUNCH_DESCRIPTORS;

interface WorkspacePanelLaunchPayload {
  kind: typeof WORKSPACE_PANEL_LAUNCH_KIND;
  version: typeof WORKSPACE_PANEL_LAUNCH_VERSION;
  view: WorkspacePanelLaunchView;
  panelId: WorkspacePanelLaunchDescriptor['panelId'];
  source: WorkspacePanelLaunchSource;
}

type WorkspacePanelLaunchSource = 'sidebar' | 'menu';

export function createWorkspacePanelDragPayload(
  view: WorkspacePanelLaunchView,
  source: WorkspacePanelLaunchSource = 'sidebar',
): string {
  const descriptor = WORKSPACE_PANEL_LAUNCH_DESCRIPTORS[view];
  const payload: WorkspacePanelLaunchPayload = {
    kind: WORKSPACE_PANEL_LAUNCH_KIND,
    version: WORKSPACE_PANEL_LAUNCH_VERSION,
    view,
    panelId: descriptor.panelId,
    source,
  };
  return JSON.stringify(payload);
}

export function hasWorkspacePanelDragType(types: Iterable<string> | ArrayLike<string> | null | undefined) {
  if (!types) return false;
  return Array.from(types).includes(WORKSPACE_PANEL_DRAG_TYPE);
}

export function hasExternalFileDragType(types: Iterable<string> | ArrayLike<string> | null | undefined) {
  if (!types) return false;
  return Array.from(types).includes('Files');
}

export function parseWorkspacePanelDragPayload(raw: string): WorkspacePanelLaunchDescriptor | null {
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as Partial<WorkspacePanelLaunchPayload>;
    if (
      payload.kind !== WORKSPACE_PANEL_LAUNCH_KIND
      || payload.version !== WORKSPACE_PANEL_LAUNCH_VERSION
      || !isWorkspacePanelLaunchSource(payload.source)
      || typeof payload.view !== 'string'
      || typeof payload.panelId !== 'string'
    ) {
      return null;
    }

    const descriptor = WORKSPACE_PANEL_LAUNCH_DESCRIPTORS[payload.view as WorkspacePanelLaunchView];
    if (!descriptor || payload.panelId !== descriptor.panelId) {
      return null;
    }

    return descriptor;
  } catch {
    return null;
  }
}

function isWorkspacePanelLaunchSource(value: unknown): value is WorkspacePanelLaunchSource {
  return value === 'sidebar' || value === 'menu';
}

export function getWorkspacePanelDragDescriptor(dataTransfer: DataTransfer): WorkspacePanelLaunchDescriptor | null {
  if (!hasWorkspacePanelDragType(dataTransfer.types)) {
    return null;
  }
  return parseWorkspacePanelDragPayload(dataTransfer.getData(WORKSPACE_PANEL_DRAG_TYPE));
}
