/* eslint-disable react-refresh/only-export-components -- panel-id constants are co-located with the shell component by design */
import { Bot, Briefcase, Download, Maximize2, Save, Upload } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { useInvestigation } from '../../contexts/InvestigationContext';
import type { Folder } from '../../types';
import { RoutePopOutContext } from '../../contexts/RoutePopOutContext';
import { setRoutePopOut } from '../../lib/route-popout-signal';
import { downloadFile } from '../../lib/export';
import { ClsBadge } from '../Common/ClsBadge';
import { useInvestigationClassification } from '../../hooks/useInvestigationClassification';
import { effectiveTlpLevel } from '../../lib/tlp-inspector';

import { ToolbarSelect, type ToolbarSelectOption } from '../Common/ToolbarSelect';
import {
  ASSISTANT_WORKSPACE_PANEL_LAUNCH_DESCRIPTORS,
  ASSISTANTCADDY_WORKSPACE_PANEL_ID,
  assistantCaddyWorkspacePanelRegistrations,
  getAssistantWorkspacePanelDragDescriptor,
  type AssistantWorkspacePanelLaunchView,
} from '../CaddyAssistant/workspacePanelRegistrations';
import {
  AssistantCaddyWorkspaceShellContent,
  type AssistantCaddyWorkspaceView,
} from '../CaddyAssistant/AssistantCaddyWorkspaceShell';
import { WorkspacePanel } from './WorkspacePanel';
import { WorkspacePanelDock } from './WorkspacePanelDock';
import { freeWorkspacePanelPlacement } from './workspace-panel-context';
import {
  WorkspacePanelProvider,
  type WorkspacePanelGeometry,
  type WorkspacePanelRegistration,
  type WorkspacePanelState,
} from './WorkspacePanelProvider';
import { useWorkspacePanel, useWorkspacePanels } from './useWorkspacePanels';
import {
  createWorkspaceLayoutTemplate,
  MAX_WORKSPACE_LAYOUT_TEMPLATE_BYTES,
  parseWorkspaceLayoutTemplate,
  sanitizeWorkspaceLayoutName,
  serializeWorkspaceLayoutTemplate,
  type WorkspaceLayoutTemplate,
} from './workspaceLayoutTemplate';
import {
  ACTIVITY_WORKSPACE_PANEL_ID,
  DASHBOARD_WORKSPACE_PANEL_ID,
  EVIDENCE_WORKSPACE_PANEL_ID,
  NOTES_WORKSPACE_PANEL_ID,
  PRODUCTS_WORKSPACE_PANEL_ID,
  TASKS_WORKSPACE_PANEL_ID,
  TIMELINE_WORKSPACE_PANEL_ID,
  WORKSPACE_PANEL_LAUNCH_DESCRIPTORS,
  getWorkspacePanelDragDescriptor,
  hasExternalFileDragType,
  hasWorkspacePanelDragType,
  type WorkspacePanelLaunchDescriptor,
  type WorkspacePanelLaunchView,
} from './workspacePanelLaunch';
import { readWorkspaceCanvasRect } from './workspaceGrid';

export const dashboardWorkspacePanelId = DASHBOARD_WORKSPACE_PANEL_ID;
export const activityWorkspacePanelId = ACTIVITY_WORKSPACE_PANEL_ID;
export const productsWorkspacePanelId = PRODUCTS_WORKSPACE_PANEL_ID;
export const notesWorkspacePanelId = NOTES_WORKSPACE_PANEL_ID;
export const tasksWorkspacePanelId = TASKS_WORKSPACE_PANEL_ID;
export const evidenceWorkspacePanelId = EVIDENCE_WORKSPACE_PANEL_ID;
export const timelineWorkspacePanelId = TIMELINE_WORKSPACE_PANEL_ID;
export const whiteboardsWorkspacePanelId = 'whiteboards-workspace';
export const graphWorkspacePanelId = 'graph-workspace';
export const reportCaddyWorkspacePanelId = 'reportcaddy-workspace';
export const iocsWorkspacePanelId = 'iocs-workspace';
export const experimentalWorkbenchWorkspacePanelId = 'experimental-workbench-workspace';
export const agentCaddyWorkspacePanelId = 'agentcaddy-workspace';
export const chatWorkspacePanelId = 'chat-workspace';
export const reportsWorkspacePanelId = 'reports-workspace';

type WorkspacePanelLaunchRequest = {
  view: WorkspacePanelLaunchView;
  requestId: number;
};

type AssistantWorkspacePanelLaunchRequest = {
  view: AssistantWorkspacePanelLaunchView;
  requestId: number;
};

type WorkspacePanelGeometryDescriptor = Pick<
  WorkspacePanelLaunchDescriptor,
  'defaultWidth' | 'defaultHeight' | 'minWidth' | 'minHeight'
>;

interface WorkspaceOwnershipContextValue {
  ownPanel: (panelId: string) => void;
  closePanel: (panelId: string) => void;
}

const WorkspaceOwnershipContext = createContext<WorkspaceOwnershipContextValue | null>(null);

function useWorkspaceOwnedPanel(id: string) {
  const ownership = useContext(WorkspaceOwnershipContext);
  const panelController = useWorkspacePanel(id);
  const setOwnedMode = useCallback((mode: Parameters<typeof panelController.setMode>[0]) => {
    if (mode === 'floating' || mode === 'minimized') {
      ownership?.ownPanel(id);
    }
    panelController.setMode(mode);
  }, [id, ownership, panelController]);
  const closeOwnedPanel = useCallback(() => {
    ownership?.closePanel(id);
    panelController.setMode('docked');
  }, [id, ownership, panelController]);

  return {
    ...panelController,
    setMode: setOwnedMode,
    close: closeOwnedPanel,
  };
}

const dashboardWorkspacePanelRegistration: WorkspacePanelRegistration = {
  id: dashboardWorkspacePanelId,
  title: 'Dashboard',
  mode: 'docked',
  geometry: {
    x: 320,
    y: 72,
    width: 900,
    height: 620,
  },
};

const activityWorkspacePanelRegistration: WorkspacePanelRegistration = {
  id: activityWorkspacePanelId,
  title: 'Activity',
  mode: 'docked',
  geometry: {
    x: 340,
    y: 88,
    width: 840,
    height: 620,
  },
};

const productsWorkspacePanelRegistration: WorkspacePanelRegistration = {
  id: productsWorkspacePanelId,
  title: 'Products',
  mode: 'docked',
  geometry: {
    x: 360,
    y: 96,
    width: 920,
    height: 640,
  },
};

const notesWorkspacePanelRegistration: WorkspacePanelRegistration = {
  id: notesWorkspacePanelId,
  title: 'Notes',
  mode: 'docked',
  geometry: {
    x: 320,
    y: 76,
    width: 560,
    height: 380,
  },
};

const tasksWorkspacePanelRegistration: WorkspacePanelRegistration = {
  id: tasksWorkspacePanelId,
  title: 'Tasks',
  mode: 'docked',
  geometry: {
    x: 340,
    y: 84,
    width: 360,
    height: 340,
  },
};

const evidenceWorkspacePanelRegistration: WorkspacePanelRegistration = {
  id: evidenceWorkspacePanelId,
  title: 'Evidence',
  mode: 'docked',
  geometry: {
    x: 320,
    y: 76,
    width: 980,
    height: 660,
  },
};

const timelineWorkspacePanelRegistration: WorkspacePanelRegistration = {
  id: timelineWorkspacePanelId,
  title: 'Timeline',
  mode: 'docked',
  geometry: {
    x: 320,
    y: 76,
    width: 980,
    height: 660,
  },
};

const whiteboardsWorkspacePanelRegistration: WorkspacePanelRegistration = {
  id: whiteboardsWorkspacePanelId,
  title: 'Whiteboards',
  mode: 'docked',
  geometry: {
    x: 340,
    y: 84,
    width: 980,
    height: 660,
  },
};

const graphWorkspacePanelRegistration: WorkspacePanelRegistration = {
  id: graphWorkspacePanelId,
  title: 'Graph',
  mode: 'docked',
  geometry: {
    x: 300,
    y: 72,
    width: 1020,
    height: 680,
  },
};

const reportCaddyWorkspacePanelRegistration: WorkspacePanelRegistration = {
  id: reportCaddyWorkspacePanelId,
  title: 'ReportCaddy',
  mode: 'docked',
  geometry: {
    x: 360,
    y: 92,
    width: 860,
    height: 640,
  },
};

const iocsWorkspacePanelRegistration: WorkspacePanelRegistration = {
  id: iocsWorkspacePanelId,
  title: 'IOCs',
  mode: 'docked',
  geometry: {
    x: 300,
    y: 72,
    width: 1040,
    height: 680,
  },
};

const experimentalWorkbenchWorkspacePanelRegistration: WorkspacePanelRegistration = {
  id: experimentalWorkbenchWorkspacePanelId,
  title: 'CaddyShack workbench',
  mode: 'docked',
  geometry: {
    x: 320,
    y: 76,
    width: 980,
    height: 660,
  },
};

const agentCaddyWorkspacePanelRegistration: WorkspacePanelRegistration = {
  id: agentCaddyWorkspacePanelId,
  title: 'AgentCaddy',
  mode: 'docked',
  geometry: {
    x: 320,
    y: 76,
    width: 980,
    height: 660,
  },
};

const chatWorkspacePanelRegistration: WorkspacePanelRegistration = {
  id: chatWorkspacePanelId,
  title: 'CaddyAI',
  mode: 'docked',
  geometry: {
    x: 300,
    y: 72,
    width: 1040,
    height: 680,
  },
};

const reportsWorkspacePanelRegistration: WorkspacePanelRegistration = {
  id: reportsWorkspacePanelId,
  title: 'Reports',
  mode: 'docked',
  geometry: {
    x: 320,
    y: 72,
    width: 860,
    height: 640,
  },
};

const appWorkspacePanelRegistrations: WorkspacePanelRegistration[] = [
  ...assistantCaddyWorkspacePanelRegistrations,
  dashboardWorkspacePanelRegistration,
  activityWorkspacePanelRegistration,
  productsWorkspacePanelRegistration,
  notesWorkspacePanelRegistration,
  tasksWorkspacePanelRegistration,
  evidenceWorkspacePanelRegistration,
  timelineWorkspacePanelRegistration,
  whiteboardsWorkspacePanelRegistration,
  graphWorkspacePanelRegistration,
  reportCaddyWorkspacePanelRegistration,
  iocsWorkspacePanelRegistration,
  experimentalWorkbenchWorkspacePanelRegistration,
  agentCaddyWorkspacePanelRegistration,
  chatWorkspacePanelRegistration,
  reportsWorkspacePanelRegistration,
];

export function AppWorkspaceShell({
  workspaceActive = false,
  assistantActive,
  assistantView,
  dashboardActive,
  dashboard,
  screensafeFolders,
  activityActive,
  activity,
  productsActive,
  products,
  notesActive,
  notes,
  tasksActive,
  tasks,
  evidenceActive = false,
  evidence = null,
  timelineActive = false,
  timeline = null,
  whiteboardsActive,
  whiteboards,
  graphActive,
  graph,
  reportCaddyActive,
  reportCaddy,
  iocsActive,
  iocs,
  experimentalActive,
  experimentalWorkbench,
  agentCaddyActive = false,
  agentCaddy = null,
  chatActive = false,
  chat = null,
  reportsActive = false,
  reports = null,
  workspacePanelLaunchRequest = null,
  onWorkspacePanelLaunchHandled,
  assistantWorkspacePanelLaunchRequest = null,
  onAssistantWorkspacePanelLaunchHandled,
}: {
  workspaceActive?: boolean;
  assistantActive: boolean;
  assistantView: AssistantCaddyWorkspaceView;
  dashboardActive: boolean;
  dashboard: ReactNode;
  /** Screenshare-filtered investigation list, for the investigation-switcher dropdown. */
  screensafeFolders?: Folder[];
  activityActive: boolean;
  activity: ReactNode;
  productsActive: boolean;
  products: ReactNode;
  notesActive: boolean;
  notes: ReactNode;
  tasksActive: boolean;
  tasks: ReactNode;
  evidenceActive?: boolean;
  evidence?: ReactNode;
  timelineActive?: boolean;
  timeline?: ReactNode;
  whiteboardsActive: boolean;
  whiteboards: ReactNode;
  graphActive: boolean;
  graph: (visible: boolean) => ReactNode;
  reportCaddyActive: boolean;
  reportCaddy: ReactNode;
  iocsActive: boolean;
  iocs: ReactNode;
  experimentalActive: boolean;
  experimentalWorkbench: ReactNode;
  agentCaddyActive?: boolean;
  agentCaddy?: ReactNode;
  chatActive?: boolean;
  chat?: ReactNode;
  reportsActive?: boolean;
  reports?: ReactNode;
  workspacePanelLaunchRequest?: WorkspacePanelLaunchRequest | null;
  onWorkspacePanelLaunchHandled?: (requestId: number) => void;
  assistantWorkspacePanelLaunchRequest?: AssistantWorkspacePanelLaunchRequest | null;
  onAssistantWorkspacePanelLaunchHandled?: (requestId: number) => void;
}) {
  const { navigateTo } = useNavigation();
  const [assistantMounted, setAssistantMounted] = useState(assistantActive);
  const [dashboardMounted, setDashboardMounted] = useState(dashboardActive);
  const [activityMounted, setActivityMounted] = useState(activityActive);
  const [productsMounted, setProductsMounted] = useState(productsActive);
  const [notesMounted, setNotesMounted] = useState(notesActive);
  const [tasksMounted, setTasksMounted] = useState(tasksActive);
  const [evidenceMounted, setEvidenceMounted] = useState(evidenceActive);
  const [timelineMounted, setTimelineMounted] = useState(timelineActive);
  const [whiteboardsMounted, setWhiteboardsMounted] = useState(whiteboardsActive);
  const [graphMounted, setGraphMounted] = useState(graphActive);
  const [reportCaddyMounted, setReportCaddyMounted] = useState(reportCaddyActive);
  const [iocsMounted, setIocsMounted] = useState(iocsActive);
  const [experimentalMounted, setExperimentalMounted] = useState(experimentalActive);
  const [agentCaddyMounted, setAgentCaddyMounted] = useState(agentCaddyActive);
  const [chatMounted, setChatMounted] = useState(chatActive);
  const [reportsMounted, setReportsMounted] = useState(reportsActive);
  const [workspaceOwnedPanelIds, setWorkspaceOwnedPanelIds] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    if (assistantActive) {
      setAssistantMounted(true);
    }
  }, [assistantActive]);

  useEffect(() => {
    if (dashboardActive) {
      setDashboardMounted(true);
    }
  }, [dashboardActive]);

  useEffect(() => {
    if (activityActive) {
      setActivityMounted(true);
    }
  }, [activityActive]);

  useEffect(() => {
    if (productsActive) {
      setProductsMounted(true);
    }
  }, [productsActive]);

  useEffect(() => {
    if (notesActive) {
      setNotesMounted(true);
    }
  }, [notesActive]);

  useEffect(() => {
    if (tasksActive) {
      setTasksMounted(true);
    }
  }, [tasksActive]);

  useEffect(() => {
    if (evidenceActive) {
      setEvidenceMounted(true);
    }
  }, [evidenceActive]);

  useEffect(() => {
    if (timelineActive) {
      setTimelineMounted(true);
    }
  }, [timelineActive]);

  useEffect(() => {
    if (whiteboardsActive) {
      setWhiteboardsMounted(true);
    }
  }, [whiteboardsActive]);

  useEffect(() => {
    if (graphActive) {
      setGraphMounted(true);
    }
  }, [graphActive]);

  useEffect(() => {
    if (reportCaddyActive) {
      setReportCaddyMounted(true);
    }
  }, [reportCaddyActive]);

  useEffect(() => {
    if (iocsActive) {
      setIocsMounted(true);
    }
  }, [iocsActive]);

  useEffect(() => {
    if (experimentalActive) {
      setExperimentalMounted(true);
    }
  }, [experimentalActive]);

  useEffect(() => {
    if (agentCaddyActive) {
      setAgentCaddyMounted(true);
    }
  }, [agentCaddyActive]);

  useEffect(() => {
    if (chatActive) {
      setChatMounted(true);
    }
  }, [chatActive]);

  useEffect(() => {
    if (reportsActive) {
      setReportsMounted(true);
    }
  }, [reportsActive]);

  const handleRestorePanel = useCallback((panel: WorkspacePanelState) => {
    if (workspaceOwnedPanelIds.has(panel.id)) {
      return;
    }

    if (panel.id === ASSISTANTCADDY_WORKSPACE_PANEL_ID) {
      navigateTo('caddyassistant');
      return;
    }

    if (panel.id.startsWith('emailcaddy-')) {
      navigateTo('cademail');
      return;
    }

    if (panel.id.startsWith('calendarcaddy-')) {
      navigateTo('calendarcaddy');
      return;
    }

    if (panel.id === dashboardWorkspacePanelId) {
      navigateTo('dashboard');
      return;
    }

    if (panel.id === activityWorkspacePanelId) {
      navigateTo('activity');
      return;
    }

    if (panel.id === productsWorkspacePanelId) {
      navigateTo('products');
      return;
    }

    if (panel.id === notesWorkspacePanelId) {
      navigateTo('notes');
      return;
    }

    if (panel.id === tasksWorkspacePanelId) {
      navigateTo('tasks');
      return;
    }

    if (panel.id === evidenceWorkspacePanelId) {
      navigateTo('evidence');
      return;
    }

    if (panel.id === timelineWorkspacePanelId) {
      navigateTo('timeline');
      return;
    }

    if (panel.id === whiteboardsWorkspacePanelId) {
      navigateTo('whiteboard');
      return;
    }

    if (panel.id === graphWorkspacePanelId) {
      navigateTo('graph');
      return;
    }

    if (panel.id === reportCaddyWorkspacePanelId) {
      navigateTo('reportcaddy');
      return;
    }

    if (panel.id === iocsWorkspacePanelId) {
      navigateTo('ioc-stats');
      return;
    }

    if (panel.id === experimentalWorkbenchWorkspacePanelId) {
      navigateTo('experimental');
      return;
    }

    if (panel.id === agentCaddyWorkspacePanelId) {
      navigateTo('agent');
      return;
    }

    if (panel.id === chatWorkspacePanelId) {
      navigateTo('chat');
    }
  }, [navigateTo, workspaceOwnedPanelIds]);

  const featurePaneActive = assistantActive
    || dashboardActive
    || activityActive
    || productsActive
    || notesActive
    || tasksActive
    || evidenceActive
    || timelineActive
    || whiteboardsActive
    || graphActive
    || reportCaddyActive
    || iocsActive
    || experimentalActive
    || agentCaddyActive
    || chatActive
    || reportsActive;

  const mountWorkspaceLayoutPanel = useCallback((panelId: string) => {
    if (
      panelId === ASSISTANTCADDY_WORKSPACE_PANEL_ID
      || panelId.startsWith('emailcaddy-')
      || panelId.startsWith('calendarcaddy-')
    ) {
      setAssistantMounted(true);
      return;
    }

    switch (panelId) {
      case dashboardWorkspacePanelId:
        setDashboardMounted(true);
        break;
      case activityWorkspacePanelId:
        setActivityMounted(true);
        break;
      case productsWorkspacePanelId:
        setProductsMounted(true);
        break;
      case notesWorkspacePanelId:
        setNotesMounted(true);
        break;
      case tasksWorkspacePanelId:
        setTasksMounted(true);
        break;
      case evidenceWorkspacePanelId:
        setEvidenceMounted(true);
        break;
      case timelineWorkspacePanelId:
        setTimelineMounted(true);
        break;
      case whiteboardsWorkspacePanelId:
        setWhiteboardsMounted(true);
        break;
      case graphWorkspacePanelId:
        setGraphMounted(true);
        break;
      case reportCaddyWorkspacePanelId:
        setReportCaddyMounted(true);
        break;
      case iocsWorkspacePanelId:
        setIocsMounted(true);
        break;
      case experimentalWorkbenchWorkspacePanelId:
        setExperimentalMounted(true);
        break;
      case agentCaddyWorkspacePanelId:
        setAgentCaddyMounted(true);
        break;
      case chatWorkspacePanelId:
        setChatMounted(true);
        break;
      default:
        break;
    }
  }, []);

  const handleWorkspaceOwnPanel = useCallback((panelId: string) => {
    setWorkspaceOwnedPanelIds((current) => {
      if (current.has(panelId)) return current;
      const next = new Set(current);
      next.add(panelId);
      return next;
    });
    mountWorkspaceLayoutPanel(panelId);
  }, [mountWorkspaceLayoutPanel]);

  const handleWorkspaceClosePanel = useCallback((panelId: string) => {
    setWorkspaceOwnedPanelIds((current) => {
      if (!current.has(panelId)) return current;
      const next = new Set(current);
      next.delete(panelId);
      return next;
    });
  }, []);

  const workspaceOwnershipContext = useMemo<WorkspaceOwnershipContextValue>(
    () => ({
      ownPanel: handleWorkspaceOwnPanel,
      closePanel: handleWorkspaceClosePanel,
    }),
    [handleWorkspaceClosePanel, handleWorkspaceOwnPanel],
  );

  const handleLayoutTemplatePanelsApplied = useCallback((panelIds: string[]) => {
    setWorkspaceOwnedPanelIds((current) => {
      const next = new Set(current);
      panelIds.forEach((panelId) => next.add(panelId));
      return next;
    });
    panelIds.forEach(mountWorkspaceLayoutPanel);
  }, [mountWorkspaceLayoutPanel]);

  const routeSurfaceActive = useCallback((routeActive: boolean) => routeActive && !workspaceActive, [workspaceActive]);
  const workspacePanelActive = useCallback((panelId: string) => (
    workspaceActive && workspaceOwnedPanelIds.has(panelId)
  ), [workspaceActive, workspaceOwnedPanelIds]);
  const panelPaneActive = useCallback((panelId: string, routeActive: boolean) => (
    routeSurfaceActive(routeActive) || workspacePanelActive(panelId)
  ), [routeSurfaceActive, workspacePanelActive]);

  return (
    <WorkspacePanelProvider initialPanels={appWorkspacePanelRegistrations}>
      <WorkspaceOwnershipContext.Provider value={workspaceOwnershipContext}>
      <WorkspacePanelLaunchEffect
        request={workspacePanelLaunchRequest}
        onLaunchPanel={handleWorkspaceOwnPanel}
        onHandled={onWorkspacePanelLaunchHandled}
      />
      <AssistantWorkspacePanelLaunchEffect
        request={assistantWorkspacePanelLaunchRequest}
        onLaunchPanel={handleWorkspaceOwnPanel}
        onHandled={onAssistantWorkspacePanelLaunchHandled}
      />
      {workspaceActive && !featurePaneActive && (
        <WorkspaceHome
          workspaceOwnedPanelIds={workspaceOwnedPanelIds}
          onLaunchPanel={handleWorkspaceOwnPanel}
          onLayoutTemplatePanelsApplied={handleLayoutTemplatePanelsApplied}
          screensafeFolders={screensafeFolders}
        />
      )}
      {(assistantMounted || assistantActive || Array.from(workspaceOwnedPanelIds).some((panelId) => (
        panelId === ASSISTANTCADDY_WORKSPACE_PANEL_ID
        || panelId.startsWith('emailcaddy-')
        || panelId.startsWith('calendarcaddy-')
      ))) && (
        <AssistantCaddyWorkspaceShellContent
          active={assistantActive}
          view={assistantView}
          workspaceActive={workspaceActive}
          workspaceOwnedPanelIds={workspaceOwnedPanelIds}
          onWorkspaceOwnPanel={handleWorkspaceOwnPanel}
          onWorkspaceClosePanel={handleWorkspaceClosePanel}
        />
      )}
      {(dashboardMounted || dashboardActive || workspaceOwnedPanelIds.has(dashboardWorkspacePanelId)) && (
        <AppWorkspacePane active={panelPaneActive(dashboardWorkspacePanelId, dashboardActive)} preserveWorkspaceCanvas={workspacePanelActive(dashboardWorkspacePanelId)}>
          <DashboardWorkspacePanel routeActive={routeSurfaceActive(dashboardActive)} workspacePanelActive={workspacePanelActive(dashboardWorkspacePanelId)}>{dashboard}</DashboardWorkspacePanel>
        </AppWorkspacePane>
      )}
      {(activityMounted || activityActive || workspaceOwnedPanelIds.has(activityWorkspacePanelId)) && (
        <AppWorkspacePane active={panelPaneActive(activityWorkspacePanelId, activityActive)} preserveWorkspaceCanvas={workspacePanelActive(activityWorkspacePanelId)}>
          <ActivityWorkspacePanel routeActive={routeSurfaceActive(activityActive)} workspacePanelActive={workspacePanelActive(activityWorkspacePanelId)}>{activity}</ActivityWorkspacePanel>
        </AppWorkspacePane>
      )}
      {(productsMounted || productsActive || workspaceOwnedPanelIds.has(productsWorkspacePanelId)) && (
        <AppWorkspacePane active={panelPaneActive(productsWorkspacePanelId, productsActive)} preserveWorkspaceCanvas={workspacePanelActive(productsWorkspacePanelId)}>
          <ProductsWorkspacePanel routeActive={routeSurfaceActive(productsActive)} workspacePanelActive={workspacePanelActive(productsWorkspacePanelId)}>{products}</ProductsWorkspacePanel>
        </AppWorkspacePane>
      )}
      {(notesMounted || notesActive || workspaceOwnedPanelIds.has(notesWorkspacePanelId)) && (
        <AppWorkspacePane active={panelPaneActive(notesWorkspacePanelId, notesActive)} preserveWorkspaceCanvas={workspacePanelActive(notesWorkspacePanelId)}>
          <NotesWorkspacePanel routeActive={routeSurfaceActive(notesActive)} workspacePanelActive={workspacePanelActive(notesWorkspacePanelId)}>{notes}</NotesWorkspacePanel>
        </AppWorkspacePane>
      )}
      {(tasksMounted || tasksActive || workspaceOwnedPanelIds.has(tasksWorkspacePanelId)) && (
      <AppWorkspacePane active={panelPaneActive(tasksWorkspacePanelId, tasksActive)} preserveWorkspaceCanvas={workspacePanelActive(tasksWorkspacePanelId)}>
        <TasksWorkspacePanel routeActive={routeSurfaceActive(tasksActive)} workspacePanelActive={workspacePanelActive(tasksWorkspacePanelId)}>{tasks}</TasksWorkspacePanel>
      </AppWorkspacePane>
      )}
      {(evidenceMounted || evidenceActive || workspaceOwnedPanelIds.has(evidenceWorkspacePanelId)) && (
        <AppWorkspacePane active={panelPaneActive(evidenceWorkspacePanelId, evidenceActive)} preserveWorkspaceCanvas={workspacePanelActive(evidenceWorkspacePanelId)}>
          <EvidenceWorkspacePanel routeActive={routeSurfaceActive(evidenceActive)} workspacePanelActive={workspacePanelActive(evidenceWorkspacePanelId)}>{evidence}</EvidenceWorkspacePanel>
        </AppWorkspacePane>
      )}
      {(timelineMounted || timelineActive || workspaceOwnedPanelIds.has(timelineWorkspacePanelId)) && (
        <AppWorkspacePane active={panelPaneActive(timelineWorkspacePanelId, timelineActive)} preserveWorkspaceCanvas={workspacePanelActive(timelineWorkspacePanelId)}>
          <TimelineWorkspacePanel routeActive={routeSurfaceActive(timelineActive)} workspacePanelActive={workspacePanelActive(timelineWorkspacePanelId)}>{timeline}</TimelineWorkspacePanel>
        </AppWorkspacePane>
      )}
      {(whiteboardsMounted || whiteboardsActive || workspaceOwnedPanelIds.has(whiteboardsWorkspacePanelId)) && (
        <AppWorkspacePane active={panelPaneActive(whiteboardsWorkspacePanelId, whiteboardsActive)} preserveWorkspaceCanvas={workspacePanelActive(whiteboardsWorkspacePanelId)}>
          <WhiteboardsWorkspacePanel routeActive={routeSurfaceActive(whiteboardsActive)} workspacePanelActive={workspacePanelActive(whiteboardsWorkspacePanelId)}>{whiteboards}</WhiteboardsWorkspacePanel>
        </AppWorkspacePane>
      )}
      {(graphMounted || graphActive || workspaceOwnedPanelIds.has(graphWorkspacePanelId)) && (
        <AppWorkspacePane active={panelPaneActive(graphWorkspacePanelId, graphActive)} preserveWorkspaceCanvas={workspacePanelActive(graphWorkspacePanelId)}>
          <GraphWorkspacePanel routeActive={routeSurfaceActive(graphActive)} workspacePanelActive={workspacePanelActive(graphWorkspacePanelId)} renderGraph={graph} />
        </AppWorkspacePane>
      )}
      {(reportCaddyMounted || reportCaddyActive || workspaceOwnedPanelIds.has(reportCaddyWorkspacePanelId)) && (
        <AppWorkspacePane active={panelPaneActive(reportCaddyWorkspacePanelId, reportCaddyActive)} preserveWorkspaceCanvas={workspacePanelActive(reportCaddyWorkspacePanelId)}>
          <ReportCaddyWorkspacePanel routeActive={routeSurfaceActive(reportCaddyActive)} workspacePanelActive={workspacePanelActive(reportCaddyWorkspacePanelId)}>{reportCaddy}</ReportCaddyWorkspacePanel>
        </AppWorkspacePane>
      )}
      {(iocsMounted || iocsActive || workspaceOwnedPanelIds.has(iocsWorkspacePanelId)) && (
        <AppWorkspacePane active={panelPaneActive(iocsWorkspacePanelId, iocsActive)} preserveWorkspaceCanvas={workspacePanelActive(iocsWorkspacePanelId)}>
          <IocsWorkspacePanel routeActive={routeSurfaceActive(iocsActive)} workspacePanelActive={workspacePanelActive(iocsWorkspacePanelId)}>{iocs}</IocsWorkspacePanel>
        </AppWorkspacePane>
      )}
      {(experimentalMounted || experimentalActive || workspaceOwnedPanelIds.has(experimentalWorkbenchWorkspacePanelId)) && (
        <AppWorkspacePane active={panelPaneActive(experimentalWorkbenchWorkspacePanelId, experimentalActive)} preserveWorkspaceCanvas={workspacePanelActive(experimentalWorkbenchWorkspacePanelId)}>
          <ExperimentalWorkbenchWorkspacePanel routeActive={routeSurfaceActive(experimentalActive)} workspacePanelActive={workspacePanelActive(experimentalWorkbenchWorkspacePanelId)}>{experimentalWorkbench}</ExperimentalWorkbenchWorkspacePanel>
        </AppWorkspacePane>
      )}
      {(agentCaddyMounted || agentCaddyActive || workspaceOwnedPanelIds.has(agentCaddyWorkspacePanelId)) && (
        <AppWorkspacePane active={panelPaneActive(agentCaddyWorkspacePanelId, agentCaddyActive)} preserveWorkspaceCanvas={workspacePanelActive(agentCaddyWorkspacePanelId)}>
          <AgentCaddyWorkspacePanel routeActive={routeSurfaceActive(agentCaddyActive)} workspacePanelActive={workspacePanelActive(agentCaddyWorkspacePanelId)}>{agentCaddy}</AgentCaddyWorkspacePanel>
        </AppWorkspacePane>
      )}
      {(chatMounted || chatActive || workspaceOwnedPanelIds.has(chatWorkspacePanelId)) && (
        <ChatWorkspacePanel routeActive={routeSurfaceActive(chatActive)} workspacePanelActive={workspacePanelActive(chatWorkspacePanelId)}>{chat}</ChatWorkspacePanel>
      )}
      {(reportsMounted || reportsActive || workspaceOwnedPanelIds.has(reportsWorkspacePanelId)) && (
        <ReportsWorkspacePanel routeActive={routeSurfaceActive(reportsActive)} workspacePanelActive={workspacePanelActive(reportsWorkspacePanelId)}>{reports}</ReportsWorkspacePanel>
      )}
      <WorkspacePanelDock onRestorePanel={handleRestorePanel} />
      </WorkspaceOwnershipContext.Provider>
    </WorkspacePanelProvider>
  );
}

function WorkspaceHome({
  workspaceOwnedPanelIds,
  onLaunchPanel,
  onLayoutTemplatePanelsApplied,
  screensafeFolders,
}: {
  workspaceOwnedPanelIds: ReadonlySet<string>;
  onLaunchPanel: (panelId: string) => void;
  onLayoutTemplatePanelsApplied: (panelIds: string[]) => void;
  screensafeFolders?: Folder[];
}) {
  const { setGeometry, setMode, setPlacement, focusPanel } = useWorkspacePanels();
  const [dragState, setDragState] = useState<'idle' | 'valid'>('idle');

  const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    if (
      !hasWorkspacePanelDragType(event.dataTransfer.types)
      || hasExternalFileDragType(event.dataTransfer.types)
    ) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDragState('valid');
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragState('idle');
  }, []);

  const handleDrop = useCallback((event: DragEvent<HTMLElement>) => {
    if (!hasWorkspacePanelDragType(event.dataTransfer.types)) return;

    event.preventDefault();
    event.stopPropagation();

    if (hasExternalFileDragType(event.dataTransfer.types)) {
      setDragState('idle');
      return;
    }

    const descriptor = getWorkspacePanelDragDescriptor(event.dataTransfer)
      ?? getAssistantWorkspacePanelDragDescriptor(event.dataTransfer);
    if (!descriptor) {
      setDragState('idle');
      return;
    }

    onLaunchPanel(descriptor.panelId);
    setGeometry(descriptor.panelId, workspaceDropGeometryForPointer(event.clientX, event.clientY, descriptor));
    setPlacement(descriptor.panelId, freeWorkspacePanelPlacement);
    setMode(descriptor.panelId, 'floating');
    focusPanel(descriptor.panelId);
    setDragState('idle');
  }, [focusPanel, onLaunchPanel, setGeometry, setMode, setPlacement]);

  return (
    <section
      role="region"
      aria-label="Workspace"
      className={[
        'relative min-h-0 flex-1 overflow-hidden bg-bg-primary/40 transition-shadow',
        dragState === 'valid'
          ? 'shadow-[inset_0_0_0_1px_var(--color-accent),inset_0_0_28px_rgba(56,189,248,0.16)]'
          : '',
      ].filter(Boolean).join(' ')}
      data-app-workspace-home="true"
      data-workspace-drop-state={dragState}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 top-10"
        data-workspace-mosaic-canvas="true"
      />
      <WorkspaceLayoutTemplateControls
        workspaceOwnedPanelIds={workspaceOwnedPanelIds}
        onApplied={onLayoutTemplatePanelsApplied}
        screensafeFolders={screensafeFolders}
      />
    </section>
  );
}

const WORKSPACE_LAYOUT_TEMPLATE_STORAGE_KEY = 'threatcaddy.workspace-layout-templates.v1';
const DEFAULT_WORKSPACE_LAYOUT_SELECT_VALUE = '__default_workspace_layout__';
const ADD_WORKSPACE_LAYOUT_SELECT_VALUE = '__add_workspace_layout__';
const noopWorkspaceInvestigationSetter = () => {};
const noopWorkspaceBooleanSetter = () => {};

interface SavedWorkspaceLayoutTemplate {
  id: string;
  name: string;
  savedAt: string;
  template: WorkspaceLayoutTemplate;
}

function WorkspaceLayoutTemplateControls({
  workspaceOwnedPanelIds,
  onApplied,
  screensafeFolders,
}: {
  workspaceOwnedPanelIds: ReadonlySet<string>;
  onApplied: (panelIds: string[]) => void;
  screensafeFolders?: Folder[];
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const investigationContext = useInvestigation();
  // Falls back to the unfiltered context list when the caller doesn't pass
  // screensafeFolders (e.g. tests rendering this shell directly) rather than
  // showing an empty dropdown — App.tsx's real render path always passes it.
  const dropdownFolders = screensafeFolders
    ?? (Array.isArray(investigationContext.folders) ? investigationContext.folders : []);
  const {
    selectedFolder,
    selectedFolderId,
    setSelectedFolderId = noopWorkspaceInvestigationSetter,
    setSelectedTag = noopWorkspaceInvestigationSetter,
    setShowArchive = noopWorkspaceBooleanSetter,
    setShowTrash = noopWorkspaceBooleanSetter,
  } = investigationContext;
  const { navigateTo } = useNavigation();
  const { allowedPanelIds, applyLayoutPanels, panels } = useWorkspacePanels();
  const layoutAllowedPanelIds = useMemo(() => getWorkspaceLayoutTemplateAllowedPanelIds(allowedPanelIds), [allowedPanelIds]);
  const [savedLayouts, setSavedLayouts] = useState<SavedWorkspaceLayoutTemplate[]>(() => readSavedWorkspaceLayoutTemplates(layoutAllowedPanelIds));
  const [selectedLayoutId, setSelectedLayoutId] = useState('');
  const [status, setStatus] = useState('');
  const selectedLayout = savedLayouts.find((layout) => layout.id === selectedLayoutId) ?? null;
  const selectedLayoutSelectValue = selectedLayoutId || DEFAULT_WORKSPACE_LAYOUT_SELECT_VALUE;
  const workspaceLayoutPanels = useMemo(
    () => panels.filter((panel) => (
      layoutAllowedPanelIds.has(panel.id)
      && (workspaceOwnedPanelIds.has(panel.id) || panel.mode !== 'docked')
    )),
    [layoutAllowedPanelIds, panels, workspaceOwnedPanelIds],
  );

  const persistSavedLayouts = useCallback((nextLayouts: SavedWorkspaceLayoutTemplate[]) => {
    setSavedLayouts(nextLayouts);
    writeSavedWorkspaceLayoutTemplates(nextLayouts);
  }, []);

  const handleSelectInvestigation = useCallback((folderId?: string) => {
    setSelectedFolderId(folderId);
    setSelectedTag(undefined);
    setShowArchive(false);
    setShowTrash(false);
    setStatus(folderId ? 'Workspace investigation context switched.' : 'Workspace investigation context cleared.');
  }, [setSelectedFolderId, setSelectedTag, setShowArchive, setShowTrash]);

  const applyTemplate = useCallback((template: WorkspaceLayoutTemplate, actionLabel: string) => {
    const parsed = parseWorkspaceLayoutTemplate(serializeWorkspaceLayoutTemplate(template), layoutAllowedPanelIds);
    if (!parsed.ok || !parsed.template) {
      setStatus(parsed.error || 'Workspace layout template could not be loaded.');
      return;
    }

    applyLayoutPanels(parsed.template.panels);
    onApplied(parsed.template.panels.map((panel) => panel.id));
    setStatus(`${actionLabel} ${parsed.template.panels.length} panels.`);
  }, [applyLayoutPanels, layoutAllowedPanelIds, onApplied]);

  const nextWorkspaceLayoutName = useCallback(() => {
    const existingNames = new Set(savedLayouts.map((layout) => layout.name));
    let index = savedLayouts.length + 1;
    let name = `Layout ${index}`;
    while (existingNames.has(name)) {
      index += 1;
      name = `Layout ${index}`;
    }
    return name;
  }, [savedLayouts]);

  const createCurrentTemplate = useCallback((nameOverride?: string) => {
    const name = sanitizeWorkspaceLayoutName(nameOverride || selectedLayout?.name || nextWorkspaceLayoutName()) || 'Workspace layout';
    if (workspaceLayoutPanels.length === 0) {
      setStatus('No workspace panels are open for this layout.');
      return null;
    }

    return createWorkspaceLayoutTemplate(workspaceLayoutPanels, { name });
  }, [nextWorkspaceLayoutName, selectedLayout?.name, workspaceLayoutPanels]);

  const handleAddLayout = useCallback(() => {
    const template = createCurrentTemplate(nextWorkspaceLayoutName());
    if (!template) return;
    const savedLayout: SavedWorkspaceLayoutTemplate = {
      id: createWorkspaceLayoutTemplateId(),
      name: template.name || 'Workspace layout',
      savedAt: new Date().toISOString(),
      template,
    };
    const nextLayouts = [savedLayout, ...savedLayouts.filter((layout) => layout.name !== savedLayout.name)].slice(0, 24);
    persistSavedLayouts(nextLayouts);
    setSelectedLayoutId(savedLayout.id);
    setStatus(`Added ${savedLayout.name}.`);
  }, [createCurrentTemplate, nextWorkspaceLayoutName, persistSavedLayouts, savedLayouts]);

  const handleUpdateLayout = useCallback(() => {
    if (!selectedLayout) {
      setStatus('Select a saved workspace layout to update.');
      return;
    }

    const template = createCurrentTemplate(selectedLayout.name);
    if (!template) return;
    const updatedLayout: SavedWorkspaceLayoutTemplate = {
      ...selectedLayout,
      savedAt: new Date().toISOString(),
      template,
    };
    const nextLayouts = [
      updatedLayout,
      ...savedLayouts.filter((layout) => layout.id !== selectedLayout.id && layout.name !== updatedLayout.name),
    ].slice(0, 24);
    persistSavedLayouts(nextLayouts);
    setSelectedLayoutId(updatedLayout.id);
    setStatus(`Updated ${updatedLayout.name}.`);
  }, [createCurrentTemplate, persistSavedLayouts, savedLayouts, selectedLayout]);

  const handleLoadLayout = useCallback(() => {
    if (!selectedLayout) {
      setStatus('Select a workspace layout to load.');
      return;
    }
    applyTemplate(selectedLayout.template, `Loaded ${selectedLayout.name} with`);
  }, [applyTemplate, selectedLayout]);

  const handleExportLayout = useCallback(() => {
    const template = selectedLayout?.template ?? createCurrentTemplate();
    if (!template) return;
    const name = sanitizeWorkspaceLayoutName(template.name || selectedLayout?.name || 'workspace-layout') || 'workspace-layout';
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(
      serializeWorkspaceLayoutTemplate(template),
      `threatcaddy-${slugWorkspaceLayoutName(name)}-${date}.json`,
      'application/json',
    );
    setStatus(`Exported ${name}.`);
  }, [createCurrentTemplate, selectedLayout]);

  const handleSelectLayout = useCallback((value: string) => {
    if (value === ADD_WORKSPACE_LAYOUT_SELECT_VALUE) {
      handleAddLayout();
      return;
    }
    if (value === DEFAULT_WORKSPACE_LAYOUT_SELECT_VALUE) {
      setSelectedLayoutId('');
      setStatus('Default workspace layout selected.');
      return;
    }
    setSelectedLayoutId(value);
    const layout = savedLayouts.find((entry) => entry.id === value);
    setStatus(layout ? `${layout.name} selected.` : 'Workspace layout selected.');
  }, [handleAddLayout, savedLayouts]);

  const handleImportLayout = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    if (file.size > MAX_WORKSPACE_LAYOUT_TEMPLATE_BYTES) {
      setStatus('Workspace layout template is too large.');
      return;
    }

    try {
      const raw = await file.text();
      const parsed = parseWorkspaceLayoutTemplate(raw, layoutAllowedPanelIds);
      if (!parsed.ok || !parsed.template) {
        setStatus(parsed.error || 'Workspace layout template could not be imported.');
        return;
      }

      const name = parsed.template.name || sanitizeWorkspaceLayoutName(file.name.replace(/\.json$/i, '')) || 'Imported workspace layout';
      const savedLayout: SavedWorkspaceLayoutTemplate = {
        id: createWorkspaceLayoutTemplateId(),
        name,
        savedAt: new Date().toISOString(),
        template: {
          ...parsed.template,
          name,
        },
      };
      const nextLayouts = [savedLayout, ...savedLayouts.filter((layout) => layout.name !== savedLayout.name)].slice(0, 24);
      persistSavedLayouts(nextLayouts);
      setSelectedLayoutId(savedLayout.id);
      applyLayoutPanels(parsed.template.panels);
      onApplied(parsed.template.panels.map((panel) => panel.id));
      setStatus(`Imported ${name} with ${parsed.template.panels.length} panels.`);
    } catch {
      setStatus('Workspace layout template could not be imported.');
    }
  }, [applyLayoutPanels, layoutAllowedPanelIds, onApplied, persistSavedLayouts, savedLayouts]);


  // Reactive entity TLP for the active investigation.
  // effectiveTlpLevel picks max(folder.clsLevel, entity-derived) so the header
  // always reflects the highest classification regardless of which surface set it.
  const entityClsLevel = useInvestigationClassification(selectedFolderId ?? null);
  const resolvedClsLevel = effectiveTlpLevel(selectedFolder?.clsLevel, entityClsLevel);

  const investigationLabel = selectedFolder?.name || 'No investigation selected';
  const tlpLevel = resolvedClsLevel !== 'TLP:CLEAR' ? resolvedClsLevel : (selectedFolder?.clsLevel || 'TLP');
  const tlpGlow = workspaceTlpGlow(resolvedClsLevel);
  const investigationOptions = useMemo<Array<ToolbarSelectOption<string>>>(() => [
    { value: '', label: 'No investigation selected' },
    ...dropdownFolders.map((folder) => ({ value: folder.id, label: folder.name })),
  ], [dropdownFolders]);
  const layoutOptions = useMemo<Array<ToolbarSelectOption<string>>>(() => [
    { value: DEFAULT_WORKSPACE_LAYOUT_SELECT_VALUE, label: 'Default' },
    ...savedLayouts.map((layout) => ({ value: layout.id, label: layout.name })),
    { value: ADD_WORKSPACE_LAYOUT_SELECT_VALUE, label: 'Add layout' },
  ], [savedLayouts]);

  return (
    <div
      className="absolute left-0 right-0 top-0 z-[220] flex h-10 items-center justify-between gap-2 border-b border-white/20 bg-bg-raised/92 px-3 backdrop-blur-xl"
      data-workspace-layout-template-controls="true"
      data-workspace-investigation-layer="true"
      data-workspace-tlp-level={tlpLevel}
      style={{
        borderBottomColor: tlpGlow.border,
        boxShadow: `0 8px 20px rgba(0,0,0,0.18), 0 0 22px ${tlpGlow.glow}`,
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div
          className="inline-flex items-center px-1"
          data-workspace-tlp-inspect="true"
        >
          {resolvedClsLevel && resolvedClsLevel !== 'TLP:CLEAR' ? (
            <ClsBadge level={resolvedClsLevel} />
          ) : selectedFolder?.clsLevel ? (
            <ClsBadge level={selectedFolder.clsLevel} />
          ) : (
            <span className="inline-flex h-6 items-center rounded-[7px] border border-border-subtle bg-bg-primary/60 px-6 text-[10px] font-semibold uppercase text-text-muted">
              {tlpLevel}
            </span>
          )}
        </div>
        <ToolbarSelect
          value={selectedFolderId || ''}
          options={investigationOptions}
          onChange={(value) => handleSelectInvestigation(value || undefined)}
          ariaLabel="Active workspace investigation"
          title={investigationLabel}
          leadingIcon={<Briefcase size={13} className="shrink-0 text-accent" aria-hidden="true" />}
          className="min-w-[170px] max-w-[280px]"
          buttonClassName="h-7 rounded-[8px] bg-bg-primary/70 text-[11px] font-semibold"
          buttonDataProps={{ 'data-workspace-investigation-select': 'true' }}
        />
        <button
          type="button"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-accent/30 bg-accent/10 text-accent transition-colors hover:border-accent/60 hover:bg-accent/16"
          aria-label="Open CaddyAI investigation helper"
          title={selectedFolder ? `Open CaddyAI helper for ${selectedFolder.name}` : 'Open CaddyAI investigation helper'}
          onClick={() => navigateTo('chat')}
          data-workspace-caddyai-helper="true"
        >
          <Bot size={13} aria-hidden="true" />
        </button>
      </div>
      <div className="flex min-w-0 items-center gap-1.5">
        <ToolbarSelect
          value={selectedLayoutSelectValue}
          options={layoutOptions}
          onChange={handleSelectLayout}
          ariaLabel="Layouts"
          className="min-w-[118px] max-w-[170px]"
          buttonClassName="h-7 rounded-[8px] bg-bg-primary/70 text-[11px] font-semibold"
          buttonDataProps={{ 'data-workspace-layout-select': 'true' }}
        />
        <button
          type="button"
          onClick={handleLoadLayout}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] border border-border-subtle bg-bg-primary/70 text-text-secondary transition-colors hover:border-border-medium hover:bg-bg-hover hover:text-text-primary"
          aria-label="Load selected workspace layout"
          title="Load selected workspace layout"
        >
          <Maximize2 size={13} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleUpdateLayout}
          disabled={!selectedLayout}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] border border-border-subtle bg-bg-primary/70 text-accent transition-colors hover:border-border-medium hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-45"
          aria-label="Update selected workspace layout"
          title="Update selected workspace layout"
        >
          <Save size={13} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] border border-border-subtle bg-bg-primary/70 text-accent transition-colors hover:border-border-medium hover:bg-bg-hover"
          aria-label="Import workspace layout template"
          title="Import workspace layout template"
        >
          <Upload size={13} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleExportLayout}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] border border-border-subtle bg-bg-primary/70 text-accent transition-colors hover:border-border-medium hover:bg-bg-hover"
          aria-label="Export workspace layout template"
          title="Export workspace layout template"
        >
          <Download size={13} aria-hidden="true" />
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        data-workspace-layout-template-input="true"
        aria-label="Workspace layout template file"
        onChange={handleImportLayout}
      />
      <span role="status" aria-live="polite" className="sr-only">{status}</span>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-1px] left-0 right-0 h-px"
        data-workspace-tlp-footer="true"
        style={{ background: `linear-gradient(90deg, transparent, ${tlpGlow.border}, transparent)` }}
      />
    </div>
  );
}

function workspaceTlpGlow(level?: string) {
  const normalized = (level || '').toUpperCase();
  if (normalized.includes('RED')) {
    return { border: 'rgba(248,113,113,0.55)', glow: 'rgba(248,113,113,0.18)' };
  }
  if (normalized.includes('AMBER')) {
    return { border: 'rgba(251,191,36,0.55)', glow: 'rgba(251,191,36,0.18)' };
  }
  if (normalized.includes('GREEN')) {
    return { border: 'rgba(74,222,128,0.5)', glow: 'rgba(74,222,128,0.15)' };
  }
  if (normalized.includes('CLEAR')) {
    return { border: 'rgba(148,163,184,0.45)', glow: 'rgba(148,163,184,0.12)' };
  }
  return { border: 'rgba(139,92,246,0.35)', glow: 'rgba(139,92,246,0.14)' };
}

function getWorkspaceLayoutTemplateAllowedPanelIds(allowedPanelIds: ReadonlySet<string>) {
  const blockedPanelIds = new Set([agentCaddyWorkspacePanelId]);
  return new Set(Array.from(allowedPanelIds).filter((panelId) => !blockedPanelIds.has(panelId)));
}

function readSavedWorkspaceLayoutTemplates(allowedPanelIds: ReadonlySet<string>): SavedWorkspaceLayoutTemplate[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(WORKSPACE_LAYOUT_TEMPLATE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((entry): SavedWorkspaceLayoutTemplate[] => {
      if (!isRecord(entry)) return [];
      if (typeof entry.id !== 'string' || typeof entry.name !== 'string' || typeof entry.savedAt !== 'string') return [];
      const templateRaw = JSON.stringify(entry.template);
      if (!templateRaw) return [];
      const templateResult = parseWorkspaceLayoutTemplate(templateRaw, allowedPanelIds);
      if (!templateResult.ok || !templateResult.template) return [];
      const name = sanitizeWorkspaceLayoutName(entry.name || templateResult.template.name);
      if (!name) return [];

      return [{
        id: entry.id.slice(0, 80),
        name,
        savedAt: entry.savedAt.slice(0, 64),
        template: {
          ...templateResult.template,
          name,
        },
      }];
    }).slice(0, 24);
  } catch {
    return [];
  }
}

function writeSavedWorkspaceLayoutTemplates(layouts: SavedWorkspaceLayoutTemplate[]) {
  if (typeof window === 'undefined') return;
  const payload = layouts.map((layout) => ({
    id: layout.id,
    name: layout.name,
    savedAt: layout.savedAt,
    template: layout.template,
  }));
  try {
    window.localStorage.setItem(WORKSPACE_LAYOUT_TEMPLATE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Layout persistence is a convenience layer; import/load should still work without storage.
  }
}

function createWorkspaceLayoutTemplateId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `layout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function slugWorkspaceLayoutName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace-layout';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function WorkspacePanelLaunchEffect({
  request,
  onLaunchPanel,
  onHandled,
}: {
  request: WorkspacePanelLaunchRequest | null;
  onLaunchPanel: (panelId: string) => void;
  onHandled?: (requestId: number) => void;
}) {
  const { setGeometry, setMode, setPlacement, focusPanel } = useWorkspacePanels();
  const handledRequestIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!request) return;
    if (handledRequestIdRef.current === request.requestId) return;

    handledRequestIdRef.current = request.requestId;

    const descriptor = WORKSPACE_PANEL_LAUNCH_DESCRIPTORS[request.view];
    if (!descriptor) {
      onHandled?.(request.requestId);
      return;
    }

    onLaunchPanel(descriptor.panelId);
    setGeometry(descriptor.panelId, workspaceCommandGeometry(descriptor));
    setPlacement(descriptor.panelId, freeWorkspacePanelPlacement);
    setMode(descriptor.panelId, 'floating');
    focusPanel(descriptor.panelId);
    onHandled?.(request.requestId);
  }, [focusPanel, onHandled, onLaunchPanel, request, setGeometry, setMode, setPlacement]);

  return null;
}

function AssistantWorkspacePanelLaunchEffect({
  request,
  onLaunchPanel,
  onHandled,
}: {
  request: AssistantWorkspacePanelLaunchRequest | null;
  onLaunchPanel: (panelId: string) => void;
  onHandled?: (requestId: number) => void;
}) {
  const { setGeometry, setMode, setPlacement, focusPanel } = useWorkspacePanels();
  const handledRequestIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!request) return;
    if (handledRequestIdRef.current === request.requestId) return;

    handledRequestIdRef.current = request.requestId;

    const descriptor = ASSISTANT_WORKSPACE_PANEL_LAUNCH_DESCRIPTORS[request.view];
    if (!descriptor) {
      onHandled?.(request.requestId);
      return;
    }

    onLaunchPanel(descriptor.panelId);
    setGeometry(descriptor.panelId, assistantWorkspaceCommandGeometry(descriptor));
    setPlacement(descriptor.panelId, freeWorkspacePanelPlacement);
    setMode(descriptor.panelId, 'floating');
    focusPanel(descriptor.panelId);
    onHandled?.(request.requestId);
  }, [focusPanel, onHandled, onLaunchPanel, request, setGeometry, setMode, setPlacement]);

  return null;
}

function assistantWorkspaceCommandGeometry(
  descriptor: typeof ASSISTANT_WORKSPACE_PANEL_LAUNCH_DESCRIPTORS[AssistantWorkspacePanelLaunchView],
): WorkspacePanelGeometry {
  if (typeof window === 'undefined') {
    return {
      x: 260,
      y: 68,
      width: descriptor.defaultWidth,
      height: descriptor.defaultHeight,
    };
  }

  const viewportWidth = window.innerWidth || 1280;
  const viewportHeight = window.innerHeight || 800;
  const width = Math.min(descriptor.defaultWidth, Math.max(descriptor.minWidth, viewportWidth - 48));
  const height = Math.min(descriptor.defaultHeight, Math.max(descriptor.minHeight, viewportHeight - 48));

  return {
    x: Math.max(16, Math.round((viewportWidth - width) / 2)),
    y: Math.max(56, Math.round((viewportHeight - height) / 2)),
    width,
    height,
  };
}

function workspaceCommandGeometry(descriptor: WorkspacePanelGeometryDescriptor): WorkspacePanelGeometry {
  if (typeof window === 'undefined') {
    return {
      x: 320,
      y: 72,
      width: descriptor.defaultWidth,
      height: descriptor.defaultHeight,
    };
  }

  return workspaceDropGeometryForPointer(Number.NaN, Number.NaN, descriptor);
}

function workspaceDropGeometryForPointer(
  clientX: number,
  clientY: number,
  descriptor: WorkspacePanelGeometryDescriptor,
): WorkspacePanelGeometry {
  if (typeof window === 'undefined') {
    return {
      x: 320,
      y: 72,
      width: descriptor.defaultWidth,
      height: descriptor.defaultHeight,
    };
  }

  const margin = 12;
  const workspaceBottomChromeReserve = 144;
  const canvas = readWorkspaceCanvasRect();
  const safeLeft = Math.max(margin, canvas.x + margin);
  const safeTop = Math.max(margin, canvas.y + margin);
  const safeRight = Math.max(safeLeft + descriptor.minWidth, canvas.x + canvas.width - margin);
  const safeBottom = Math.max(
    safeTop + descriptor.minHeight,
    canvas.y + canvas.height - margin - workspaceBottomChromeReserve,
  );
  const width = clampWorkspaceDropValue(
    descriptor.defaultWidth,
    descriptor.minWidth,
    Math.max(descriptor.minWidth, safeRight - safeLeft),
  );
  const height = clampWorkspaceDropValue(
    descriptor.defaultHeight,
    descriptor.minHeight,
    Math.max(descriptor.minHeight, safeBottom - safeTop),
  );
  const pointerX = Number.isFinite(clientX) ? clientX : safeLeft + width / 2;
  const pointerY = Number.isFinite(clientY) ? clientY : safeTop + 36;
  const maxX = Math.max(safeLeft, safeRight - width);
  const maxY = Math.max(safeTop, safeBottom - height);

  return {
    x: clampWorkspaceDropValue(pointerX - width / 2, safeLeft, maxX),
    y: clampWorkspaceDropValue(pointerY - 36, safeTop, maxY),
    width,
    height,
  };
}

function clampWorkspaceDropValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function AppWorkspacePane({
  active,
  preserveWorkspaceCanvas = false,
  children,
}: {
  active: boolean;
  preserveWorkspaceCanvas?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      hidden={!active}
      aria-hidden={!active}
      className={preserveWorkspaceCanvas ? 'contents' : 'flex min-h-0 flex-1 flex-col'}
      data-app-workspace-pane={active ? 'active' : 'inactive'}
      data-app-workspace-pane-layout={preserveWorkspaceCanvas ? 'workspace-owned' : 'route'}
    >
      {children}
    </div>
  );
}

function RoutePanelPopOutSurface({
  title,
  onPopOut,
  popOutLabel = 'Pop out',
  children,
}: {
  title: string;
  onPopOut: () => void;
  popOutLabel?: string;
  children: ReactNode;
}) {
  // Publish the pop-out callback to ActiveFilterBar via module-level signal.
  // ActiveFilterBar is a sibling above AppWorkspaceShell, so context can't reach it.
  const onPopOutRef = useRef(onPopOut);
  onPopOutRef.current = onPopOut;

  useEffect(() => {
    setRoutePopOut({ label: popOutLabel, onPopOut: () => onPopOutRef.current() });
    return () => setRoutePopOut(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popOutLabel, title]);

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col" data-app-route-panel-surface={title.toLowerCase()}>
      <div className="flex min-h-0 flex-1 flex-col">
        {children}
      </div>
    </div>
  );
}

function DashboardWorkspacePanel({ routeActive, workspacePanelActive, children }: { routeActive: boolean; workspacePanelActive: boolean; children: ReactNode }) {
  const { panel, setMode, setGeometry, focus, restore, close } = useWorkspaceOwnedPanel(dashboardWorkspacePanelId);

  if (routeActive) {
    const isDocked = panel.mode === 'docked';
    return <RoutePanelPopOutSurface title={panel.title} popOutLabel={isDocked ? 'Pop out' : 'Dock'} onPopOut={isDocked ? () => { setMode('floating'); focus(); } : () => setMode('docked')}>{children}</RoutePanelPopOutSurface>;
  }

  return (
    <WorkspacePanel
      id={panel.id}
      title={panel.title}
      mode={panel.mode}
      geometry={panel.geometry}
      zIndex={panel.zIndex}
      onModeChange={setMode}
      onGeometryChange={setGeometry}
      onPanelFocus={focus}
      onRestore={restore}
      onClose={close}
      active={workspacePanelActive || (routeActive && panel.mode !== 'docked')}
      minWidth={520}
      minHeight={420}
      compactWidth={720}
      compactHeight={520}
      resizeLabelBase="Dashboard panel"
      floatingAriaLabel="Dashboard panel"
      minimizeLabel="Minimize Dashboard"
      closeLabel="Close Dashboard workspace panel"
      restoreLabel="Restore Dashboard panel"
      dockedClassName="flex h-full min-h-0 flex-col"
      floatingClassName="shadow-[10px_16px_36px_rgba(0,0,0,0.38)]"
      placeholderClassName="m-3"
      bodyClassName="flex min-h-0 flex-1 overflow-hidden p-0"
    >
      {children}
    </WorkspacePanel>
  );
}

function ActivityWorkspacePanel({ routeActive, workspacePanelActive, children }: { routeActive: boolean; workspacePanelActive: boolean; children: ReactNode }) {
  const { panel, setMode, setGeometry, focus, restore, close } = useWorkspaceOwnedPanel(activityWorkspacePanelId);

  if (routeActive) {
    const isDocked = panel.mode === 'docked';
    return <RoutePanelPopOutSurface title={panel.title} popOutLabel={isDocked ? 'Pop out' : 'Dock'} onPopOut={isDocked ? () => { setMode('floating'); focus(); } : () => setMode('docked')}>{children}</RoutePanelPopOutSurface>;
  }

  return (
    <WorkspacePanel
      id={panel.id}
      title={panel.title}
      mode={panel.mode}
      geometry={panel.geometry}
      zIndex={panel.zIndex}
      onModeChange={setMode}
      onGeometryChange={setGeometry}
      onPanelFocus={focus}
      onRestore={restore}
      onClose={close}
      active={workspacePanelActive || (routeActive && panel.mode !== 'docked')}
      minWidth={500}
      minHeight={420}
      compactWidth={680}
      compactHeight={520}
      resizeLabelBase="Activity panel"
      floatingAriaLabel="Activity panel"
      minimizeLabel="Minimize Activity"
      closeLabel="Close Activity workspace panel"
      restoreLabel="Restore Activity panel"
      dockedClassName="flex h-full min-h-0 flex-col"
      floatingClassName="shadow-[10px_16px_36px_rgba(0,0,0,0.38)]"
      placeholderClassName="m-3"
      bodyClassName="flex min-h-0 flex-1 overflow-hidden p-0"
    >
      {children}
    </WorkspacePanel>
  );
}

function ProductsWorkspacePanel({ routeActive, workspacePanelActive, children }: { routeActive: boolean; workspacePanelActive: boolean; children: ReactNode }) {
  const { panel, setMode, setGeometry, focus, restore, close } = useWorkspaceOwnedPanel(productsWorkspacePanelId);

  if (routeActive) {
    const isDocked = panel.mode === 'docked';
    return <RoutePanelPopOutSurface title={panel.title} popOutLabel={isDocked ? 'Pop out' : 'Dock'} onPopOut={isDocked ? () => { setMode('floating'); focus(); } : () => setMode('docked')}>{children}</RoutePanelPopOutSurface>;
  }

  return (
    <WorkspacePanel
      id={panel.id}
      title={panel.title}
      mode={panel.mode}
      geometry={panel.geometry}
      zIndex={panel.zIndex}
      onModeChange={setMode}
      onGeometryChange={setGeometry}
      onPanelFocus={focus}
      onRestore={restore}
      onClose={close}
      active={workspacePanelActive || (routeActive && panel.mode !== 'docked')}
      minWidth={400}
      minHeight={300}
      compactWidth={740}
      compactHeight={540}
      resizeLabelBase="Products panel"
      floatingAriaLabel="Products panel"
      minimizeLabel="Minimize Products"
      closeLabel="Close Products workspace panel"
      restoreLabel="Restore Products panel"
      dockedClassName="flex h-full min-h-0 flex-col"
      floatingClassName="shadow-[10px_16px_36px_rgba(0,0,0,0.38)]"
      placeholderClassName="m-3"
      bodyClassName="flex min-h-0 flex-1 overflow-hidden p-0"
    >
      {children}
    </WorkspacePanel>
  );
}

function NotesWorkspacePanel({ routeActive, workspacePanelActive, children }: { routeActive: boolean; workspacePanelActive: boolean; children: ReactNode }) {
  const { panel, setMode, setGeometry, focus, restore, close } = useWorkspaceOwnedPanel(notesWorkspacePanelId);

  if (routeActive) {
    const isDocked = panel.mode === 'docked';
    return <RoutePanelPopOutSurface title={panel.title} popOutLabel={isDocked ? 'Pop out' : 'Dock'} onPopOut={isDocked ? () => { setMode('floating'); focus(); } : () => setMode('docked')}>{children}</RoutePanelPopOutSurface>;
  }

  return (
    <WorkspacePanel
      id={panel.id}
      title={panel.title}
      mode={panel.mode}
      geometry={panel.geometry}
      zIndex={panel.zIndex}
      onModeChange={setMode}
      onGeometryChange={setGeometry}
      onPanelFocus={focus}
      onRestore={restore}
      onClose={close}
      active={workspacePanelActive || (routeActive && panel.mode !== 'docked')}
      preserveChildrenWhenMinimized
      minWidth={320}
      minHeight={240}
      compactWidth={620}
      compactHeight={420}
      resizeLabelBase="Notes panel"
      floatingAriaLabel="Notes panel"
      minimizeLabel="Minimize Notes"
      closeLabel="Close Notes workspace panel"
      restoreLabel="Restore Notes panel"
      dockedClassName="flex h-full min-h-0 flex-col"
      floatingClassName="shadow-[10px_16px_36px_rgba(0,0,0,0.38)]"
      placeholderClassName="m-3"
      bodyClassName="flex min-h-0 flex-1 overflow-hidden p-0"
    >
      {children}
    </WorkspacePanel>
  );
}

function TasksWorkspacePanel({ routeActive, workspacePanelActive, children }: { routeActive: boolean; workspacePanelActive: boolean; children: ReactNode }) {
  const { panel, setMode, setGeometry, focus, restore, close } = useWorkspaceOwnedPanel(tasksWorkspacePanelId);

  if (routeActive) {
    const isDocked = panel.mode === 'docked';
    return <RoutePanelPopOutSurface title={panel.title} popOutLabel={isDocked ? 'Pop out' : 'Dock'} onPopOut={isDocked ? () => { setMode('floating'); focus(); } : () => setMode('docked')}>{children}</RoutePanelPopOutSurface>;
  }

  return (
    <WorkspacePanel
      id={panel.id}
      title={panel.title}
      mode={panel.mode}
      geometry={panel.geometry}
      zIndex={panel.zIndex}
      onModeChange={setMode}
      onGeometryChange={setGeometry}
      onPanelFocus={focus}
      onRestore={restore}
      onClose={close}
      active={workspacePanelActive || (routeActive && panel.mode !== 'docked')}
      minWidth={300}
      minHeight={240}
      compactWidth={480}
      compactHeight={380}
      resizeLabelBase="Tasks panel"
      floatingAriaLabel="Tasks panel"
      minimizeLabel="Minimize Tasks"
      closeLabel="Close Tasks workspace panel"
      restoreLabel="Restore Tasks panel"
      dockedClassName="flex h-full min-h-0 flex-col"
      floatingClassName="shadow-[10px_16px_36px_rgba(0,0,0,0.38)]"
      placeholderClassName="m-3"
      bodyClassName="flex min-h-0 flex-1 overflow-hidden p-0"
    >
      {children}
    </WorkspacePanel>
  );
}

function EvidenceWorkspacePanel({ routeActive, workspacePanelActive, children }: { routeActive: boolean; workspacePanelActive: boolean; children: ReactNode }) {
  const { panel, setMode, setGeometry, focus, restore, close } = useWorkspaceOwnedPanel(evidenceWorkspacePanelId);

  if (routeActive && panel.mode === 'docked') {
    return <RoutePanelPopOutSurface title={panel.title} onPopOut={() => { setMode('floating'); focus(); }}>{children}</RoutePanelPopOutSurface>;
  }

  return (
    <WorkspacePanel
      id={panel.id}
      title={panel.title}
      mode={panel.mode}
      geometry={panel.geometry}
      zIndex={panel.zIndex}
      onModeChange={setMode}
      onGeometryChange={setGeometry}
      onPanelFocus={focus}
      onRestore={restore}
      onClose={close}
      active={workspacePanelActive || (routeActive && panel.mode !== 'docked')}
      minWidth={420}
      minHeight={320}
      compactWidth={800}
      compactHeight={560}
      resizeLabelBase="Evidence panel"
      floatingAriaLabel="Evidence panel"
      minimizeLabel="Minimize Evidence"
      closeLabel="Close Evidence workspace panel"
      restoreLabel="Restore Evidence panel"
      dockedClassName="flex h-full min-h-0 flex-col"
      floatingClassName="shadow-[10px_16px_36px_rgba(0,0,0,0.38)]"
      placeholderClassName="m-3"
      bodyClassName="flex min-h-0 flex-1 overflow-hidden p-0"
    >
      {children}
    </WorkspacePanel>
  );
}

function TimelineWorkspacePanel({ routeActive, workspacePanelActive, children }: { routeActive: boolean; workspacePanelActive: boolean; children: ReactNode }) {
  const { panel, setMode, setGeometry, focus, restore, close } = useWorkspaceOwnedPanel(timelineWorkspacePanelId);

  if (routeActive && panel.mode === 'docked') {
    return <RoutePanelPopOutSurface title={panel.title} onPopOut={() => { setMode('floating'); focus(); }}>{children}</RoutePanelPopOutSurface>;
  }

  return (
    <WorkspacePanel
      id={panel.id}
      title={panel.title}
      mode={panel.mode}
      geometry={panel.geometry}
      zIndex={panel.zIndex}
      onModeChange={setMode}
      onGeometryChange={setGeometry}
      onPanelFocus={focus}
      onRestore={restore}
      onClose={close}
      active={workspacePanelActive || (routeActive && panel.mode !== 'docked')}
      minWidth={420}
      minHeight={320}
      compactWidth={800}
      compactHeight={560}
      resizeLabelBase="Timeline panel"
      floatingAriaLabel="Timeline panel"
      minimizeLabel="Minimize Timeline"
      closeLabel="Close Timeline workspace panel"
      restoreLabel="Restore Timeline panel"
      dockedClassName="flex h-full min-h-0 flex-col"
      floatingClassName="shadow-[10px_16px_36px_rgba(0,0,0,0.38)]"
      placeholderClassName="m-3"
      bodyClassName="flex min-h-0 flex-1 overflow-hidden p-0"
    >
      {children}
    </WorkspacePanel>
  );
}

function WhiteboardsWorkspacePanel({ routeActive, workspacePanelActive, children }: { routeActive: boolean; workspacePanelActive: boolean; children: ReactNode }) {
  const { panel, setMode, setGeometry, focus, restore, close } = useWorkspaceOwnedPanel(whiteboardsWorkspacePanelId);

  if (routeActive && panel.mode === 'docked') {
    return <RoutePanelPopOutSurface title={panel.title} onPopOut={() => { setMode('floating'); focus(); }}>{children}</RoutePanelPopOutSurface>;
  }

  return (
    <WorkspacePanel
      id={panel.id}
      title={panel.title}
      mode={panel.mode}
      geometry={panel.geometry}
      zIndex={panel.zIndex}
      onModeChange={setMode}
      onGeometryChange={setGeometry}
      onPanelFocus={focus}
      onRestore={restore}
      onClose={close}
      active={workspacePanelActive || (routeActive && panel.mode !== 'docked')}
      preserveChildrenWhenMinimized
      minWidth={420}
      minHeight={320}
      compactWidth={800}
      compactHeight={560}
      resizeLabelBase="Whiteboards panel"
      floatingAriaLabel="Whiteboards panel"
      minimizeLabel="Minimize Whiteboards"
      closeLabel="Close Whiteboards workspace panel"
      restoreLabel="Restore Whiteboards panel"
      dockedClassName="flex h-full min-h-0 flex-col"
      floatingClassName="shadow-[10px_16px_36px_rgba(0,0,0,0.38)]"
      placeholderClassName="m-3"
      bodyClassName="flex min-h-0 flex-1 overflow-hidden p-0"
    >
      {children}
    </WorkspacePanel>
  );
}

function GraphWorkspacePanel({
  routeActive,
  workspacePanelActive,
  renderGraph,
}: {
  routeActive: boolean;
  workspacePanelActive: boolean;
  renderGraph: (visible: boolean) => ReactNode;
}) {
  const { panel, setMode, setGeometry, focus, restore, close } = useWorkspaceOwnedPanel(graphWorkspacePanelId);
  const graphVisible = workspacePanelActive || panel.mode === 'floating';

  if (routeActive && panel.mode === 'docked') {
    return (
      <RoutePanelPopOutSurface title={panel.title} onPopOut={() => { setMode('floating'); focus(); }}>
        {renderGraph(true)}
      </RoutePanelPopOutSurface>
    );
  }

  return (
    <WorkspacePanel
      id={panel.id}
      title={panel.title}
      mode={panel.mode}
      geometry={panel.geometry}
      zIndex={panel.zIndex}
      onModeChange={setMode}
      onGeometryChange={setGeometry}
      onPanelFocus={focus}
      onRestore={restore}
      onClose={close}
      active={workspacePanelActive || (routeActive && panel.mode !== 'docked')}
      minWidth={420}
      minHeight={320}
      compactWidth={800}
      compactHeight={560}
      resizeLabelBase="Graph panel"
      floatingAriaLabel="Graph panel"
      minimizeLabel="Minimize Graph"
      closeLabel="Close Graph workspace panel"
      restoreLabel="Restore Graph panel"
      dockedClassName="flex h-full min-h-0 flex-col"
      floatingClassName="shadow-[10px_16px_36px_rgba(0,0,0,0.38)]"
      placeholderClassName="m-3"
      bodyClassName="flex min-h-0 flex-1 overflow-hidden p-0"
    >
      {renderGraph(graphVisible)}
    </WorkspacePanel>
  );
}

function ReportCaddyWorkspacePanel({ routeActive, workspacePanelActive, children }: { routeActive: boolean; workspacePanelActive: boolean; children: ReactNode }) {
  const { panel, setMode, setGeometry, focus, restore, close } = useWorkspaceOwnedPanel(reportCaddyWorkspacePanelId);

  if (routeActive && panel.mode === 'docked') {
    return <RoutePanelPopOutSurface title={panel.title} onPopOut={() => { setMode('floating'); focus(); }}>{children}</RoutePanelPopOutSurface>;
  }

  return (
    <WorkspacePanel
      id={panel.id}
      title={panel.title}
      mode={panel.mode}
      geometry={panel.geometry}
      zIndex={panel.zIndex}
      onModeChange={setMode}
      onGeometryChange={setGeometry}
      onPanelFocus={focus}
      onRestore={restore}
      onClose={close}
      active={workspacePanelActive || (routeActive && panel.mode !== 'docked')}
      minWidth={400}
      minHeight={300}
      compactWidth={740}
      compactHeight={540}
      resizeLabelBase="ReportCaddy panel"
      floatingAriaLabel="ReportCaddy panel"
      minimizeLabel="Minimize ReportCaddy"
      closeLabel="Close ReportCaddy workspace panel"
      restoreLabel="Restore ReportCaddy panel"
      dockedClassName="flex h-full min-h-0 flex-col"
      floatingClassName="shadow-[10px_16px_36px_rgba(0,0,0,0.38)]"
      placeholderClassName="m-3"
      bodyClassName="flex min-h-0 flex-1 overflow-hidden p-0"
    >
      {children}
    </WorkspacePanel>
  );
}

function IocsWorkspacePanel({ routeActive, workspacePanelActive, children }: { routeActive: boolean; workspacePanelActive: boolean; children: ReactNode }) {
  const { panel, setMode, setGeometry, focus, restore, close } = useWorkspaceOwnedPanel(iocsWorkspacePanelId);

  if (routeActive && panel.mode === 'docked') {
    return <RoutePanelPopOutSurface title={panel.title} onPopOut={() => { setMode('floating'); focus(); }}>{children}</RoutePanelPopOutSurface>;
  }

  return (
    <WorkspacePanel
      id={panel.id}
      title={panel.title}
      mode={panel.mode}
      geometry={panel.geometry}
      zIndex={panel.zIndex}
      onModeChange={setMode}
      onGeometryChange={setGeometry}
      onPanelFocus={focus}
      onRestore={restore}
      onClose={close}
      active={workspacePanelActive || (routeActive && panel.mode !== 'docked')}
      minWidth={420}
      minHeight={320}
      compactWidth={800}
      compactHeight={560}
      resizeLabelBase="IOCs panel"
      floatingAriaLabel="IOCs panel"
      minimizeLabel="Minimize IOCs"
      closeLabel="Close IOCs workspace panel"
      restoreLabel="Restore IOCs panel"
      dockedClassName="flex h-full min-h-0 flex-col"
      floatingClassName="shadow-[10px_16px_36px_rgba(0,0,0,0.38)]"
      placeholderClassName="m-3"
      bodyClassName="flex min-h-0 flex-1 overflow-hidden p-0"
    >
      {children}
    </WorkspacePanel>
  );
}

function ExperimentalWorkbenchWorkspacePanel({ routeActive, workspacePanelActive, children }: { routeActive: boolean; workspacePanelActive: boolean; children: ReactNode }) {
  const { panel, setMode, setGeometry, focus, restore, close } = useWorkspaceOwnedPanel(experimentalWorkbenchWorkspacePanelId);

  if (routeActive && panel.mode === 'docked') {
    return <RoutePanelPopOutSurface title={panel.title} onPopOut={() => { setMode('floating'); focus(); }}>{children}</RoutePanelPopOutSurface>;
  }

  return (
    <WorkspacePanel
      id={panel.id}
      title={panel.title}
      mode={panel.mode}
      geometry={panel.geometry}
      zIndex={panel.zIndex}
      onModeChange={setMode}
      onGeometryChange={setGeometry}
      onPanelFocus={focus}
      onRestore={restore}
      onClose={close}
      active={workspacePanelActive || (routeActive && panel.mode !== 'docked')}
      minWidth={420}
      minHeight={320}
      compactWidth={800}
      compactHeight={560}
      resizeLabelBase="CaddyShack workbench panel"
      floatingAriaLabel="CaddyShack workbench panel"
      minimizeLabel="Minimize CaddyShack workbench"
      closeLabel="Close CaddyShack workbench workspace panel"
      restoreLabel="Restore CaddyShack workbench panel"
      dockedClassName="flex h-full min-h-0 flex-col"
      floatingClassName="shadow-[10px_16px_36px_rgba(0,0,0,0.38)]"
      placeholderClassName="m-3"
      bodyClassName="flex min-h-0 flex-1 overflow-hidden p-0"
    >
      {children}
    </WorkspacePanel>
  );
}

function AgentCaddyWorkspacePanel({ routeActive, workspacePanelActive, children }: { routeActive: boolean; workspacePanelActive: boolean; children: ReactNode }) {
  const { panel, setMode, setGeometry, focus, restore, close } = useWorkspaceOwnedPanel(agentCaddyWorkspacePanelId);

  if (routeActive && panel.mode === 'docked') {
    return <RoutePanelPopOutSurface title={panel.title} onPopOut={() => { setMode('floating'); focus(); }}>{children}</RoutePanelPopOutSurface>;
  }

  return (
    <WorkspacePanel
      id={panel.id}
      title={panel.title}
      mode={panel.mode}
      geometry={panel.geometry}
      zIndex={panel.zIndex}
      onModeChange={setMode}
      onGeometryChange={setGeometry}
      onPanelFocus={focus}
      onRestore={restore}
      onClose={close}
      active={workspacePanelActive || (routeActive && panel.mode !== 'docked')}
      minWidth={420}
      minHeight={320}
      compactWidth={800}
      compactHeight={560}
      resizeLabelBase="AgentCaddy panel"
      floatingAriaLabel="AgentCaddy panel"
      minimizeLabel="Minimize AgentCaddy"
      closeLabel="Close AgentCaddy workspace panel"
      restoreLabel="Restore AgentCaddy panel"
      dockedClassName="flex h-full min-h-0 flex-col"
      floatingClassName="shadow-[10px_16px_36px_rgba(0,0,0,0.38)]"
      placeholderClassName="m-3"
      bodyClassName="flex min-h-0 flex-1 overflow-hidden p-0"
    >
      {children}
    </WorkspacePanel>
  );
}

function ChatWorkspacePanel({ routeActive, workspacePanelActive, children }: { routeActive: boolean; workspacePanelActive: boolean; children: ReactNode }) {
  const { panel, setMode, setGeometry, focus, restore, close } = useWorkspaceOwnedPanel(chatWorkspacePanelId);

  if (routeActive && panel.mode === 'docked') {
    // Provide the pop-out callback via context so ChatView can render the button
    // inline in its own action bar rather than in a dedicated row above it.
    return (
      <RoutePopOutContext.Provider value={{ label: 'Pop out', onPopOut: () => { setMode('floating'); focus(); } }}>
        <div className="relative flex h-full min-h-0 flex-1 flex-col" data-app-route-panel-surface={panel.title.toLowerCase()}>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      </RoutePopOutContext.Provider>
    );
  }

  return (
    <WorkspacePanel
      id={panel.id}
      title={panel.title}
      mode={panel.mode}
      geometry={panel.geometry}
      zIndex={panel.zIndex}
      onModeChange={setMode}
      onGeometryChange={setGeometry}
      onPanelFocus={focus}
      onRestore={restore}
      onClose={close}
      active={workspacePanelActive || (routeActive && panel.mode !== 'docked')}
      preserveChildrenAcrossModes
      minWidth={440}
      minHeight={340}
      compactWidth={820}
      compactHeight={580}
      resizeLabelBase="CaddyAI panel"
      floatingAriaLabel="CaddyAI panel"
      minimizeLabel="Minimize CaddyAI"
      closeLabel="Close CaddyAI workspace panel"
      restoreLabel="Restore CaddyAI panel"
      dockedClassName="flex h-full min-h-0 flex-col"
      floatingClassName="shadow-[10px_16px_36px_rgba(0,0,0,0.38)]"
      placeholderClassName="m-3"
      bodyClassName="flex min-h-0 flex-1 overflow-hidden p-0"
    >
      {children}
    </WorkspacePanel>
  );
}

function ReportsWorkspacePanel({ routeActive, workspacePanelActive, children }: { routeActive: boolean; workspacePanelActive: boolean; children: ReactNode }) {
  const { panel, setMode, setGeometry, focus, restore, close } = useWorkspaceOwnedPanel(reportsWorkspacePanelId);

  if (routeActive && panel.mode === 'docked') {
    return <RoutePanelPopOutSurface title={panel.title} onPopOut={() => { setMode('floating'); focus(); }}>{children}</RoutePanelPopOutSurface>;
  }

  return (
    <WorkspacePanel
      id={panel.id}
      title={panel.title}
      mode={panel.mode}
      geometry={panel.geometry}
      zIndex={panel.zIndex}
      onModeChange={setMode}
      onGeometryChange={setGeometry}
      onPanelFocus={focus}
      onRestore={restore}
      onClose={close}
      active={workspacePanelActive || (routeActive && panel.mode !== 'docked')}
      minWidth={380}
      minHeight={300}
      compactWidth={700}
      compactHeight={480}
      resizeLabelBase="Reports panel"
      floatingAriaLabel="Reports panel"
      minimizeLabel="Minimize Reports"
      closeLabel="Close Reports workspace panel"
      restoreLabel="Restore Reports panel"
      dockedClassName="flex h-full min-h-0 flex-col"
      floatingClassName="shadow-[10px_16px_36px_rgba(0,0,0,0.38)]"
      placeholderClassName="m-3"
      bodyClassName="flex min-h-0 flex-1 overflow-hidden p-0"
    >
      {children}
    </WorkspacePanel>
  );
}
