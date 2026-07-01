import type {
  WorkspacePanelGeometry,
  WorkspacePanelRegistration,
} from '../WorkspacePanels/WorkspacePanelProvider';
import {
  WORKSPACE_PANEL_DRAG_TYPE,
  hasWorkspacePanelDragType,
} from '../WorkspacePanels/workspacePanelLaunch';

const defaultContextPanelGeometry: WorkspacePanelGeometry = {
  x: 320,
  y: 92,
  width: 380,
  height: 470,
};

const defaultMessageReaderPanelGeometry: WorkspacePanelGeometry = {
  x: 340,
  y: 104,
  width: 480,
  height: 520,
};

const defaultDraftPanelGeometry: WorkspacePanelGeometry = {
  x: 380,
  y: 112,
  width: 560,
  height: 580,
};

const defaultSelectedAgendaPanelGeometry: WorkspacePanelGeometry = {
  x: 360,
  y: 86,
  width: 420,
  height: 430,
};

const defaultEmailCaddyPanelGeometry: WorkspacePanelGeometry = {
  x: 260,
  y: 68,
  width: 1040,
  height: 700,
};

const defaultCalendarCaddyPanelGeometry: WorkspacePanelGeometry = {
  x: 248,
  y: 64,
  width: 740,
  height: 500,
};

const ASSISTANT_WORKSPACE_PANEL_LAUNCH_KIND = 'threatcaddy.assistant-workspace-panel-launch';
const ASSISTANT_WORKSPACE_PANEL_LAUNCH_VERSION = 1;

export const ASSISTANTCADDY_WORKSPACE_PANEL_ID = 'assistantcaddy-workspace';
export const EMAILCADDY_WORKSPACE_PANEL_ID = 'emailcaddy-workspace';
export const EMAILCADDY_MESSAGE_CONTEXT_PANEL_ID = 'emailcaddy-message-context';
export const EMAILCADDY_MESSAGE_READER_PANEL_ID = 'emailcaddy-message-reader';
export const EMAILCADDY_DRAFT_PANEL_ID = 'emailcaddy-draft';
export const CALENDARCADDY_WORKSPACE_PANEL_ID = 'calendarcaddy-workspace';
export const CALENDARCADDY_SELECTED_AGENDA_PANEL_ID = 'calendarcaddy-selected-agenda';

export interface AssistantWorkspacePanelLaunchDescriptor {
  panelId: string;
  title: string;
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
}

export const ASSISTANT_WORKSPACE_PANEL_LAUNCH_DESCRIPTORS = {
  overview: {
    panelId: ASSISTANTCADDY_WORKSPACE_PANEL_ID,
    title: 'AssistantCaddy',
    defaultWidth: 860,
    defaultHeight: 620,
    minWidth: 440,
    minHeight: 360,
  },
  email: {
    panelId: EMAILCADDY_WORKSPACE_PANEL_ID,
    title: 'EmailCaddy',
    defaultWidth: defaultEmailCaddyPanelGeometry.width,
    defaultHeight: defaultEmailCaddyPanelGeometry.height,
    minWidth: 680,
    minHeight: 500,
  },
  calendar: {
    panelId: CALENDARCADDY_WORKSPACE_PANEL_ID,
    title: 'CalendarCaddy',
    defaultWidth: defaultCalendarCaddyPanelGeometry.width,
    defaultHeight: defaultCalendarCaddyPanelGeometry.height,
    minWidth: 520,
    minHeight: 360,
  },
} as const satisfies Record<string, AssistantWorkspacePanelLaunchDescriptor>;

export type AssistantWorkspacePanelLaunchView = keyof typeof ASSISTANT_WORKSPACE_PANEL_LAUNCH_DESCRIPTORS;

type AssistantWorkspacePanelLaunchSource = 'sidebar' | 'menu' | 'surface';

interface AssistantWorkspacePanelLaunchPayload {
  kind: typeof ASSISTANT_WORKSPACE_PANEL_LAUNCH_KIND;
  version: typeof ASSISTANT_WORKSPACE_PANEL_LAUNCH_VERSION;
  view: AssistantWorkspacePanelLaunchView;
  panelId: AssistantWorkspacePanelLaunchDescriptor['panelId'];
  source: AssistantWorkspacePanelLaunchSource;
}

export function createAssistantWorkspacePanelDragPayload(
  view: AssistantWorkspacePanelLaunchView,
  source: AssistantWorkspacePanelLaunchSource = 'sidebar',
): string {
  const descriptor = ASSISTANT_WORKSPACE_PANEL_LAUNCH_DESCRIPTORS[view];
  const payload: AssistantWorkspacePanelLaunchPayload = {
    kind: ASSISTANT_WORKSPACE_PANEL_LAUNCH_KIND,
    version: ASSISTANT_WORKSPACE_PANEL_LAUNCH_VERSION,
    view,
    panelId: descriptor.panelId,
    source,
  };
  return JSON.stringify(payload);
}

export function parseAssistantWorkspacePanelDragPayload(raw: string): AssistantWorkspacePanelLaunchDescriptor | null {
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as Partial<AssistantWorkspacePanelLaunchPayload>;
    if (
      payload.kind !== ASSISTANT_WORKSPACE_PANEL_LAUNCH_KIND
      || payload.version !== ASSISTANT_WORKSPACE_PANEL_LAUNCH_VERSION
      || !isAssistantWorkspacePanelLaunchSource(payload.source)
      || typeof payload.view !== 'string'
      || typeof payload.panelId !== 'string'
    ) {
      return null;
    }

    const descriptor = ASSISTANT_WORKSPACE_PANEL_LAUNCH_DESCRIPTORS[payload.view as AssistantWorkspacePanelLaunchView];
    if (!descriptor || payload.panelId !== descriptor.panelId) {
      return null;
    }

    return descriptor;
  } catch {
    return null;
  }
}

export function getAssistantWorkspacePanelDragDescriptor(dataTransfer: DataTransfer): AssistantWorkspacePanelLaunchDescriptor | null {
  if (!hasWorkspacePanelDragType(dataTransfer.types)) {
    return null;
  }
  return parseAssistantWorkspacePanelDragPayload(dataTransfer.getData(WORKSPACE_PANEL_DRAG_TYPE));
}

function isAssistantWorkspacePanelLaunchSource(value: unknown): value is AssistantWorkspacePanelLaunchSource {
  return value === 'sidebar' || value === 'menu' || value === 'surface';
}

export const emailCaddyPanelRegistrations: WorkspacePanelRegistration[] = [
  {
    id: EMAILCADDY_WORKSPACE_PANEL_ID,
    title: 'EmailCaddy',
    mode: 'docked',
    geometry: defaultEmailCaddyPanelGeometry,
  },
  {
    id: EMAILCADDY_MESSAGE_CONTEXT_PANEL_ID,
    title: 'message context',
    mode: 'docked',
    geometry: defaultContextPanelGeometry,
  },
  {
    id: EMAILCADDY_MESSAGE_READER_PANEL_ID,
    title: 'message reader',
    mode: 'docked',
    geometry: defaultMessageReaderPanelGeometry,
  },
  {
    id: EMAILCADDY_DRAFT_PANEL_ID,
    title: 'draft',
    mode: 'docked',
    geometry: defaultDraftPanelGeometry,
  },
];

export const calendarCaddyPanelRegistrations: WorkspacePanelRegistration[] = [
  {
    id: CALENDARCADDY_WORKSPACE_PANEL_ID,
    title: 'CalendarCaddy',
    mode: 'docked',
    geometry: defaultCalendarCaddyPanelGeometry,
  },
  {
    id: CALENDARCADDY_SELECTED_AGENDA_PANEL_ID,
    title: 'selected agenda',
    mode: 'docked',
    geometry: defaultSelectedAgendaPanelGeometry,
  },
];

export const assistantCaddyOverviewPanelRegistration: WorkspacePanelRegistration = {
  id: ASSISTANTCADDY_WORKSPACE_PANEL_ID,
  title: 'AssistantCaddy',
  mode: 'docked',
  geometry: {
    x: 280,
    y: 72,
    width: 860,
    height: 620,
  },
};

export const assistantCaddyWorkspacePanelRegistrations: WorkspacePanelRegistration[] = [
  assistantCaddyOverviewPanelRegistration,
  ...emailCaddyPanelRegistrations,
  ...calendarCaddyPanelRegistrations,
];
