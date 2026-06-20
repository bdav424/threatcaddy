import { useCallback, useMemo, type DragEvent, type ReactNode } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { WorkspacePanel } from '../WorkspacePanels/WorkspacePanel';
import { WorkspacePanelDock } from '../WorkspacePanels/WorkspacePanelDock';
import {
  WorkspacePanelProvider,
  type WorkspacePanelState,
} from '../WorkspacePanels/WorkspacePanelProvider';
import { useWorkspacePanel } from '../WorkspacePanels/useWorkspacePanels';
import { CaddyAssistantOverviewPanel } from './CaddyAssistantOverviewPanel';
import { EmailCaddyWorkspaceContent } from './CadEmailWorkspace';
import { CalendarCaddyWorkspaceContent } from './CalendarCaddyWorkspace';
import {
  ASSISTANTCADDY_WORKSPACE_PANEL_ID,
  CALENDARCADDY_WORKSPACE_PANEL_ID,
  EMAILCADDY_WORKSPACE_PANEL_ID,
  ASSISTANT_WORKSPACE_PANEL_LAUNCH_DESCRIPTORS,
  assistantCaddyWorkspacePanelRegistrations,
  createAssistantWorkspacePanelDragPayload,
  type AssistantWorkspacePanelLaunchView,
} from './workspacePanelRegistrations';
import { WORKSPACE_PANEL_DRAG_TYPE } from '../WorkspacePanels/workspacePanelLaunch';

export type AssistantCaddyWorkspaceView = 'overview' | 'email' | 'calendar';

export function AssistantCaddyWorkspaceShell({
  active = true,
  view,
}: {
  active?: boolean;
  view: AssistantCaddyWorkspaceView;
}) {
  const { navigateTo } = useNavigation();
  const handleRestorePanel = useCallback((panel: WorkspacePanelState) => {
    if (panel.id === ASSISTANTCADDY_WORKSPACE_PANEL_ID && view !== 'overview') {
      navigateTo('caddyassistant');
      return;
    }

    if (panel.id.startsWith('emailcaddy-') && view !== 'email') {
      navigateTo('cademail');
      return;
    }

    if (panel.id.startsWith('calendarcaddy-') && view !== 'calendar') {
      navigateTo('calendarcaddy');
    }
  }, [navigateTo, view]);

  return (
    <WorkspacePanelProvider initialPanels={assistantCaddyWorkspacePanelRegistrations}>
      <AssistantCaddyWorkspaceShellContent active={active} view={view} />
      <WorkspacePanelDock onRestorePanel={handleRestorePanel} />
    </WorkspacePanelProvider>
  );
}

export function AssistantCaddyWorkspaceShellContent({
  active = true,
  view,
  workspaceActive = false,
  workspaceOwnedPanelIds = new Set<string>(),
  onWorkspaceOwnPanel,
  onWorkspaceClosePanel,
}: {
  active?: boolean;
  view: AssistantCaddyWorkspaceView;
  workspaceActive?: boolean;
  workspaceOwnedPanelIds?: ReadonlySet<string>;
  onWorkspaceOwnPanel?: (panelId: string) => void;
  onWorkspaceClosePanel?: (panelId: string) => void;
}) {
  const routeSurfaceActive = Boolean(onWorkspaceOwnPanel) && active && !workspaceActive;
  const shellPanelActive = active && !routeSurfaceActive;
  const overviewRouteActive = routeSurfaceActive && view === 'overview';
  const emailRouteActive = routeSurfaceActive && view === 'email';
  const calendarRouteActive = routeSurfaceActive && view === 'calendar';
  const overviewWorkspacePanelActive = (shellPanelActive && view === 'overview')
    || (workspaceActive && workspaceOwnedPanelIds.has(ASSISTANTCADDY_WORKSPACE_PANEL_ID));
  const emailWorkspacePanelActive = (shellPanelActive && view === 'email')
    || (workspaceActive && workspaceOwnedPanelIds.has(EMAILCADDY_WORKSPACE_PANEL_ID));
  const calendarWorkspacePanelActive = (shellPanelActive && view === 'calendar')
    || (workspaceActive && workspaceOwnedPanelIds.has(CALENDARCADDY_WORKSPACE_PANEL_ID));

  const emailChildren = useCallback(
    (compact: boolean, surfaceDragStart?: (event: DragEvent<HTMLElement>) => void) => (
      <EmailCaddyWorkspaceContent
        compactPanel={compact}
        onWorkspaceOwnPanel={onWorkspaceOwnPanel}
        onWorkspacePanelDragStart={surfaceDragStart}
      />
    ),
    [onWorkspaceOwnPanel],
  );

  const calendarChildren = useCallback(
    (compact: boolean, width: number, surfaceDragStart?: (event: DragEvent<HTMLElement>) => void) => (
      <CalendarCaddyWorkspaceContent
        compactPanel={compact}
        compactPanelWidth={width}
        onWorkspaceOwnPanel={onWorkspaceOwnPanel}
        onWorkspacePanelDragStart={surfaceDragStart}
      />
    ),
    [onWorkspaceOwnPanel],
  );

  const overviewChild = useMemo(() => <CaddyAssistantOverviewPanel />, []);

  return (
    <>
      <AssistantCaddyOverviewWorkspacePanel
        routeActive={overviewRouteActive}
        workspacePanelActive={overviewWorkspacePanelActive}
        onWorkspaceOwnPanel={onWorkspaceOwnPanel}
        onWorkspaceClosePanel={onWorkspaceClosePanel}
      >
        {overviewChild}
      </AssistantCaddyOverviewWorkspacePanel>
      <EmailCaddyWorkspacePanel
        routeActive={emailRouteActive}
        workspacePanelActive={emailWorkspacePanelActive}
        onWorkspaceOwnPanel={onWorkspaceOwnPanel}
        onWorkspaceClosePanel={onWorkspaceClosePanel}
      >
        {emailChildren}
      </EmailCaddyWorkspacePanel>
      <CalendarCaddyWorkspacePanel
        routeActive={calendarRouteActive}
        workspacePanelActive={calendarWorkspacePanelActive}
        onWorkspaceOwnPanel={onWorkspaceOwnPanel}
        onWorkspaceClosePanel={onWorkspaceClosePanel}
      >
        {calendarChildren}
      </CalendarCaddyWorkspacePanel>
    </>
  );
}

function EmailCaddyWorkspacePanel({
  routeActive,
  workspacePanelActive,
  onWorkspaceOwnPanel,
  onWorkspaceClosePanel,
  children,
}: {
  routeActive: boolean;
  workspacePanelActive: boolean;
  onWorkspaceOwnPanel?: (panelId: string) => void;
  onWorkspaceClosePanel?: (panelId: string) => void;
  children: ReactNode | ((compact: boolean, surfaceDragStart?: (event: DragEvent<HTMLElement>) => void) => ReactNode);
}) {
  const { panel, setMode, setGeometry, focus, restore } = useWorkspacePanel(EMAILCADDY_WORKSPACE_PANEL_ID);
  const compact = panel.mode === 'floating' || panel.geometry.width < 860 || panel.geometry.height < 600;
  const handleModeChange = useCallback((mode: Parameters<typeof setMode>[0]) => {
    if (mode === 'floating' || mode === 'minimized') {
      onWorkspaceOwnPanel?.(panel.id);
    }
    setMode(mode);
  }, [onWorkspaceOwnPanel, panel.id, setMode]);
  const handleClose = useCallback(() => {
    onWorkspaceClosePanel?.(panel.id);
    setMode('docked');
  }, [onWorkspaceClosePanel, panel.id, setMode]);
  const handleSurfaceDragStart = useCallback((event: DragEvent<HTMLElement>) => {
    setAssistantWorkspacePanelDragPayload(event, 'email');
  }, []);

  if (routeActive) {
    return <>{typeof children === 'function' ? children(false, handleSurfaceDragStart) : children}</>;
  }

  return (
    <WorkspacePanel
      id={panel.id}
      title={panel.title}
      mode={panel.mode}
      geometry={panel.geometry}
      zIndex={panel.zIndex}
      onModeChange={handleModeChange}
      onGeometryChange={setGeometry}
      onPanelFocus={focus}
      onRestore={restore}
      onClose={handleClose}
      active={workspacePanelActive}
      preserveChildrenAcrossModes
      minWidth={680}
      minHeight={500}
      compactWidth={860}
      compactHeight={600}
      forceCompact={panel.mode === 'floating'}
      resizeLabelBase="EmailCaddy panel"
      floatingAriaLabel="EmailCaddy panel"
      popOutLabel="Pop out EmailCaddy"
      dockLabel="Dock EmailCaddy back into main workspace"
      minimizeLabel="Minimize EmailCaddy"
      closeLabel="Close EmailCaddy workspace panel"
      restoreLabel="Restore EmailCaddy panel"
      dockedClassName="flex h-full min-h-0 flex-col"
      floatingClassName="shadow-[10px_16px_36px_rgba(0,0,0,0.38)]"
      placeholderClassName="m-3"
      bodyClassName="flex min-h-0 flex-1 overflow-hidden p-0"
    >
      {typeof children === 'function' ? children(compact) : children}
    </WorkspacePanel>
  );
}

function CalendarCaddyWorkspacePanel({
  routeActive,
  workspacePanelActive,
  onWorkspaceOwnPanel,
  onWorkspaceClosePanel,
  children,
}: {
  routeActive: boolean;
  workspacePanelActive: boolean;
  onWorkspaceOwnPanel?: (panelId: string) => void;
  onWorkspaceClosePanel?: (panelId: string) => void;
  children: ReactNode | ((compact: boolean, width: number, surfaceDragStart?: (event: DragEvent<HTMLElement>) => void) => ReactNode);
}) {
  const { panel, setMode, setGeometry, focus, restore } = useWorkspacePanel(CALENDARCADDY_WORKSPACE_PANEL_ID);
  const compact = panel.mode === 'floating' && (panel.geometry.width < 760 || panel.geometry.height < 520);
  const handleModeChange = useCallback((mode: Parameters<typeof setMode>[0]) => {
    if (mode === 'floating' || mode === 'minimized') {
      onWorkspaceOwnPanel?.(panel.id);
    }
    setMode(mode);
  }, [onWorkspaceOwnPanel, panel.id, setMode]);
  const handleClose = useCallback(() => {
    onWorkspaceClosePanel?.(panel.id);
    setMode('docked');
  }, [onWorkspaceClosePanel, panel.id, setMode]);
  const handleSurfaceDragStart = useCallback((event: DragEvent<HTMLElement>) => {
    setAssistantWorkspacePanelDragPayload(event, 'calendar');
  }, []);

  if (routeActive) {
    return <>{typeof children === 'function' ? children(false, panel.geometry.width, handleSurfaceDragStart) : children}</>;
  }

  return (
    <WorkspacePanel
      id={panel.id}
      title={panel.title}
      mode={panel.mode}
      geometry={panel.geometry}
      zIndex={panel.zIndex}
      onModeChange={handleModeChange}
      onGeometryChange={setGeometry}
      onPanelFocus={focus}
      onRestore={restore}
      onClose={handleClose}
      active={workspacePanelActive}
      preserveChildrenAcrossModes
      minWidth={520}
      minHeight={360}
      compactWidth={760}
      compactHeight={520}
      resizeLabelBase="CalendarCaddy panel"
      floatingAriaLabel="CalendarCaddy panel"
      popOutLabel="Pop out CalendarCaddy"
      dockLabel="Dock CalendarCaddy back into main workspace"
      minimizeLabel="Minimize CalendarCaddy"
      closeLabel="Close CalendarCaddy workspace panel"
      restoreLabel="Restore CalendarCaddy panel"
      dockedClassName="flex h-full min-h-0 flex-col"
      floatingClassName="shadow-[10px_16px_36px_rgba(0,0,0,0.38)]"
      placeholderClassName="m-1.5 p-2 [&>div]:min-h-[56px]"
      bodyClassName="flex min-h-0 flex-1 overflow-hidden p-0"
    >
      {typeof children === 'function' ? children(compact, panel.geometry.width) : children}
    </WorkspacePanel>
  );
}

function setAssistantWorkspacePanelDragPayload(
  event: DragEvent<HTMLElement>,
  view: AssistantWorkspacePanelLaunchView,
) {
  const descriptor = ASSISTANT_WORKSPACE_PANEL_LAUNCH_DESCRIPTORS[view];
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData(WORKSPACE_PANEL_DRAG_TYPE, createAssistantWorkspacePanelDragPayload(view, 'surface'));
  event.dataTransfer.setData('text/plain', `ThreatCaddy Workspace panel: ${descriptor.title}`);
}

function AssistantCaddyOverviewWorkspacePanel({
  routeActive,
  workspacePanelActive,
  onWorkspaceOwnPanel,
  onWorkspaceClosePanel,
  children,
}: {
  routeActive: boolean;
  workspacePanelActive: boolean;
  onWorkspaceOwnPanel?: (panelId: string) => void;
  onWorkspaceClosePanel?: (panelId: string) => void;
  children: ReactNode;
}) {
  const { panel, setMode, setGeometry, focus, restore } = useWorkspacePanel(ASSISTANTCADDY_WORKSPACE_PANEL_ID);
  const handleModeChange = useCallback((mode: Parameters<typeof setMode>[0]) => {
    if (mode === 'floating' || mode === 'minimized') {
      onWorkspaceOwnPanel?.(panel.id);
    }
    setMode(mode);
  }, [onWorkspaceOwnPanel, panel.id, setMode]);
  const handleClose = useCallback(() => {
    onWorkspaceClosePanel?.(panel.id);
    setMode('docked');
  }, [onWorkspaceClosePanel, panel.id, setMode]);

  if (routeActive) {
    return (
      <div className="flex min-h-0 flex-1" data-assistantcaddy-shell-pane="route">
        {children}
      </div>
    );
  }

  return (
    <WorkspacePanel
      id={panel.id}
      title={panel.title}
      mode={panel.mode}
      geometry={panel.geometry}
      zIndex={panel.zIndex}
      onModeChange={handleModeChange}
      onGeometryChange={setGeometry}
      onPanelFocus={focus}
      onRestore={restore}
      onClose={handleClose}
      active={workspacePanelActive}
      preserveChildrenAcrossModes
      minWidth={440}
      minHeight={360}
      compactWidth={720}
      compactHeight={500}
      resizeLabelBase="AssistantCaddy panel"
      floatingAriaLabel="AssistantCaddy panel"
      popOutLabel="Pop out AssistantCaddy"
      dockLabel="Dock AssistantCaddy back into main workspace"
      minimizeLabel="Minimize AssistantCaddy"
      closeLabel="Close AssistantCaddy workspace panel"
      restoreLabel="Restore AssistantCaddy panel"
      dockedClassName="flex h-full min-h-0 flex-col"
      floatingClassName="shadow-[10px_16px_36px_rgba(0,0,0,0.38)]"
      placeholderClassName="m-3"
      bodyClassName="flex min-h-0 flex-1 overflow-hidden p-0"
    >
      <div
        className="flex min-h-0 flex-1"
        data-assistantcaddy-shell-pane={workspacePanelActive ? 'active' : 'inactive'}
      >
        {children}
      </div>
    </WorkspacePanel>
  );
}
