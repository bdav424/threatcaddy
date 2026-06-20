import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Folder } from '../types';

// The shell mounts all three sub-workspaces simultaneously. The bottleneck is the
// initial mount cost of these large components in jsdom — memoization helps in the
// real browser but doesn't reduce the one-time mount expense that dominates test time.
// "preserves minimized shell state" does the most work (initial mount + 4 interactions
// + 4 view-switches) and legitimately runs ~40-50s on its own. Keep a file-level
// threshold that covers it without flaking on slower CI machines.
vi.setConfig({ testTimeout: 60000 });

const navigateToMock = vi.fn();
const openSettingsMock = vi.fn();
const WORKSPACE_LAYOUT_TEMPLATE_STORAGE_KEY = 'threatcaddy.workspace-layout-templates.v1';
const investigationContextMock = vi.hoisted(() => ({
  folders: [] as Folder[],
  selectedFolder: undefined as Folder | undefined,
  selectedFolderId: undefined as string | undefined,
  setSelectedFolderId: vi.fn(),
  setEditingFolderId: vi.fn(),
  setSelectedTag: vi.fn(),
  setShowArchive: vi.fn(),
  setShowTrash: vi.fn(),
}));

vi.mock('../contexts/NavigationContext', () => ({
  useNavigation: () => ({
    navigateTo: navigateToMock,
  }),
}));

vi.mock('../contexts/UIModalContext', () => ({
  useUIModals: () => ({
    openSettings: openSettingsMock,
  }),
}));

vi.mock('../contexts/InvestigationContext', () => ({
  useInvestigation: () => investigationContextMock,
}));

import {
  AssistantCaddyWorkspaceShell,
  EmailCaddyWorkspace,
  CalendarCaddyWorkspace,
  CaddyAssistantOverviewPanel,
} from '../components/CaddyAssistant';
import { AssistantCaddyWorkspaceShellContent } from '../components/CaddyAssistant/AssistantCaddyWorkspaceShell';
import { CalendarCaddyWorkspaceContent } from '../components/CaddyAssistant/CalendarCaddyWorkspace';
import { EmailCaddyWorkspaceContent } from '../components/CaddyAssistant/CadEmailWorkspace';
import { AppWorkspaceShell } from '../components/WorkspacePanels/AppWorkspaceShell';
import { WorkspacePanel } from '../components/WorkspacePanels/WorkspacePanel';
import { WorkspacePanelProvider } from '../components/WorkspacePanels/WorkspacePanelProvider';
import { useWorkspacePanel } from '../components/WorkspacePanels/useWorkspacePanels';
import {
  WORKSPACE_PANEL_DRAG_TYPE,
  WORKSPACE_PANEL_LAUNCH_DESCRIPTORS,
  createWorkspacePanelDragPayload,
  type WorkspacePanelLaunchView,
} from '../components/WorkspacePanels/workspacePanelLaunch';
import { MAX_WORKSPACE_LAYOUT_TEMPLATE_BYTES } from '../components/WorkspacePanels/workspaceLayoutTemplate';
import {
  ASSISTANTCADDY_WORKSPACE_PANEL_ID,
  assistantCaddyWorkspacePanelRegistrations,
  calendarCaddyPanelRegistrations,
  createAssistantWorkspacePanelDragPayload,
  emailCaddyPanelRegistrations,
  type AssistantWorkspacePanelLaunchView,
} from '../components/CaddyAssistant/workspacePanelRegistrations';

const notesPane = (
  <section aria-label="Notes test surface">
    <h2>Notes</h2>
    <button type="button">Create blank note</button>
  </section>
);

const tasksPane = (
  <section aria-label="Tasks test surface">
    <h2>Tasks</h2>
    <button type="button">New task</button>
  </section>
);

const evidencePane = (
  <section aria-label="Evidence test surface">
    <h2>Evidence</h2>
    <p>No evidence yet</p>
    <button type="button">Import</button>
  </section>
);

const timelinePane = (
  <section aria-label="Timeline test surface">
    <h2>Timeline</h2>
    <p>No timeline events yet</p>
    <button type="button">New event</button>
  </section>
);

const whiteboardsPane = (
  <section aria-label="Whiteboards test surface">
    <h2>Whiteboards</h2>
    <button type="button">New whiteboard</button>
  </section>
);

const graphPane = (
  <section aria-label="Graph test surface">
    <h2>Entity Graph</h2>
    <button type="button">Fit to view</button>
  </section>
);

const caddyShackPane = (
  <section aria-label="CaddyShack test surface">
    <h2>CaddyShack</h2>
    <p>Connect to a team server to use Team Feed.</p>
  </section>
);

const iocsPane = (
  <section aria-label="IOCs test surface">
    <h2>IOCs</h2>
    <button type="button">New IOC</button>
  </section>
);

const experimentalWorkbenchPane = (
  <section aria-label="CaddyShack workbench test surface">
    <h2>CaddyShack workbench</h2>
    <button type="button">Open request form</button>
  </section>
);

const agentCaddyPane = (
  <section aria-label="AgentCaddy test surface">
    <h2>AgentCaddy</h2>
    <p>No active agents</p>
    <button type="button">Configure AI Settings</button>
  </section>
);

const chatPane = (
  <section aria-label="CaddyAI test surface">
    <h2>CaddyAI</h2>
    <p>No chat threads yet</p>
    <label>
      CaddyAI draft
      <input aria-label="CaddyAI draft" defaultValue="still mounted" />
    </label>
  </section>
);

function makeInvestigationFolder(id: string, name: string, clsLevel?: string): Folder {
  return {
    id,
    name,
    clsLevel,
    order: 0,
    createdAt: 1,
    status: 'active',
  };
}

function makeWorkspacePanelDataTransfer(
  raw: string,
  types: string[] = [WORKSPACE_PANEL_DRAG_TYPE],
) {
  return {
    types,
    effectAllowed: 'copy',
    dropEffect: 'none',
    getData: vi.fn((type: string) => (type === WORKSPACE_PANEL_DRAG_TYPE ? raw : '')),
    setData: vi.fn(),
  } as unknown as DataTransfer;
}

function renderWorkspaceHomeShell({
  dashboard = (
    <section aria-label="Dashboard test surface">
      <h2>Quick Links</h2>
      <button type="button">Add Link</button>
    </section>
  ),
  assistantActive = false,
  assistantView = 'overview',
  workspacePanelLaunchRequest = null,
  onWorkspacePanelLaunchHandled,
  assistantWorkspacePanelLaunchRequest = null,
  onAssistantWorkspacePanelLaunchHandled,
}: {
  dashboard?: ReactNode;
  assistantActive?: boolean;
  assistantView?: 'overview' | 'email' | 'calendar';
  workspacePanelLaunchRequest?: { view: WorkspacePanelLaunchView; requestId: number } | null;
  onWorkspacePanelLaunchHandled?: (requestId: number) => void;
  assistantWorkspacePanelLaunchRequest?: { view: AssistantWorkspacePanelLaunchView; requestId: number } | null;
  onAssistantWorkspacePanelLaunchHandled?: (requestId: number) => void;
} = {}) {
  return render(
    <AppWorkspaceShell
      workspaceActive
      assistantActive={assistantActive}
      assistantView={assistantView}
      experimentalActive={false}
      experimentalWorkbench={experimentalWorkbenchPane}
      dashboardActive={false}
      dashboard={dashboard}
      activityActive={false}
      activity={(
        <section aria-label="Activity test surface">
          <h2>Activity Log</h2>
        </section>
      )}
      productsActive={false}
      products={(
        <section aria-label="Products test surface">
          <h2>Products</h2>
        </section>
      )}
      notesActive={false}
      notes={notesPane}
      tasksActive={false}
      tasks={tasksPane}
      evidenceActive={false}
      evidence={evidencePane}
      timelineActive={false}
      timeline={timelinePane}
      whiteboardsActive={false}
      whiteboards={whiteboardsPane}
      graphActive={false}
      graph={() => graphPane}
      caddyShackActive={false}
      caddyShack={caddyShackPane}
      iocsActive={false}
      iocs={iocsPane}
      agentCaddyActive={false}
      agentCaddy={agentCaddyPane}
      chatActive={false}
      chat={chatPane}
      workspacePanelLaunchRequest={workspacePanelLaunchRequest}
      onWorkspacePanelLaunchHandled={onWorkspacePanelLaunchHandled}
      assistantWorkspacePanelLaunchRequest={assistantWorkspacePanelLaunchRequest}
      onAssistantWorkspacePanelLaunchHandled={onAssistantWorkspacePanelLaunchHandled}
    />,
  );
}

function PreservedMinimizedPanel() {
  const { panel, setMode, setGeometry, focus, restore } = useWorkspacePanel('preserved-panel');

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
      preserveChildrenWhenMinimized
      resizeLabelBase="Preserved panel"
      floatingAriaLabel="Preserved panel"
      popOutLabel="Pop out preserved panel"
      minimizeLabel="Minimize preserved panel"
      restoreLabel="Restore preserved panel"
    >
      <label>
        Preserved draft
        <input aria-label="Preserved draft" defaultValue="still mounted" />
      </label>
    </WorkspacePanel>
  );
}

function StableModePanel() {
  const { panel, setMode, setGeometry, focus, restore } = useWorkspacePanel('stable-panel');

  return (
    <>
      <button type="button" onClick={() => setMode('floating')}>Float stable panel</button>
      <button type="button" onClick={() => setMode('minimized')}>Minimize stable panel externally</button>
      <button type="button" onClick={restore}>Restore stable panel externally</button>
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
        preserveChildrenAcrossModes
        active
        resizeLabelBase="Stable panel"
        floatingAriaLabel="Stable panel"
        popOutLabel="Pop out stable panel"
        minimizeLabel="Minimize stable panel"
        restoreLabel="Restore stable panel"
      >
        <label>
          Stable draft
          <input aria-label="Stable draft" defaultValue="still mounted" />
        </label>
      </WorkspacePanel>
    </>
  );
}

describe('AssistantCaddy workspaces', () => {
  beforeEach(() => {
    navigateToMock.mockReset();
    openSettingsMock.mockReset();
    investigationContextMock.folders = [];
    investigationContextMock.selectedFolder = undefined;
    investigationContextMock.selectedFolderId = undefined;
    investigationContextMock.setSelectedFolderId.mockReset();
    investigationContextMock.setEditingFolderId.mockReset();
    investigationContextMock.setSelectedTag.mockReset();
    investigationContextMock.setShowArchive.mockReset();
    investigationContextMock.setShowTrash.mockReset();
    (window as typeof window & { __TC_CALENDARCADDY_TODAY__?: string }).__TC_CALENDARCADDY_TODAY__ = '2026-06-05T09:00:00';
    window.localStorage.clear();
  });

  it('shows an assistant preview when overview prompt is submitted', () => {
    render(<CaddyAssistantOverviewPanel />);

    const input = screen.getByRole('textbox', { name: 'Ask AssistantCaddy' });
    fireEvent.change(input, {
      target: { value: 'Build my daily brief from today’s emails and meetings.' },
    });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(screen.getByText('Daily brief preview')).toBeInTheDocument();
    expect(screen.getByText(/The assistant would lead with two follow-ups/i)).toBeInTheDocument();
  });

  it('routes overview launchpads into the dedicated workspaces', () => {
    render(<CaddyAssistantOverviewPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Open EmailCaddy' }));
    expect(navigateToMock).toHaveBeenLastCalledWith('cademail');

    fireEvent.click(screen.getByRole('button', { name: 'Open CalendarCaddy' }));
    expect(navigateToMock).toHaveBeenLastCalledWith('calendarcaddy');
  });

  it('can preserve panel children while minimized when explicitly requested', () => {
    render(
      <WorkspacePanelProvider
        initialPanels={[{
          id: 'preserved-panel',
          title: 'Preserved',
          mode: 'docked',
          geometry: { x: 320, y: 80, width: 640, height: 420 },
        }]}
      >
        <PreservedMinimizedPanel />
      </WorkspacePanelProvider>,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Preserved draft' }), {
      target: { value: 'kept through minimize' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Minimize preserved panel' }));

    expect(screen.getByRole('button', { name: 'Restore preserved panel' })).toBeInTheDocument();
    expect(document.querySelector('[data-workspace-panel-preserved="preserved-panel"]')).toBeInTheDocument();
    expect(screen.getByDisplayValue('kept through minimize')).toBeInTheDocument();
  });

  it('can preserve panel children across docked, floating, minimized, and restored modes when explicitly requested', () => {
    render(
      <WorkspacePanelProvider
        initialPanels={[{
          id: 'stable-panel',
          title: 'Stable',
          mode: 'docked',
          geometry: { x: 320, y: 80, width: 640, height: 420 },
        }]}
      >
        <StableModePanel />
      </WorkspacePanelProvider>,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Stable draft' }), {
      target: { value: 'kept through all modes' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Float stable panel' }));

    expect(screen.getByRole('dialog', { name: 'Stable panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
    expect(screen.getByDisplayValue('kept through all modes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Minimize stable panel externally' }));

    expect(document.querySelector('[data-workspace-panel="stable-panel"]')).toHaveAttribute(
      'data-workspace-panel-state',
      'minimized',
    );
    expect(screen.getByDisplayValue('kept through all modes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restore stable panel externally' }));

    expect(screen.getByRole('dialog', { name: 'Stable panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
    expect(screen.getByDisplayValue('kept through all modes')).toBeInTheDocument();
  });

  it('opens the compact overview preferences routes into settings', () => {
    render(<CaddyAssistantOverviewPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Widget preferences' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open general settings' }));

    expect(openSettingsMock).toHaveBeenLastCalledWith('general');
  });

  it('renders the Odysseus-style EmailCaddy surface', () => {
    render(<EmailCaddyWorkspace />);

    expect(screen.getByRole('heading', { level: 2, name: /emailcaddy/i })).toBeInTheDocument();
    expect(screen.queryByText('EmailCaddy workspace')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search EmailCaddy' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Select bulk action' })).toBeInTheDocument();
    expect(screen.queryByRole('separator', { name: 'Resize selected email pane' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Select all visible emails')).toBeInTheDocument();
    expect(document.querySelector('[data-email-mail-surface="true"]')).toHaveAttribute('data-email-lower-pane-active', 'false');
  });

  it('renders the EmailCaddy compact fallback without panel titlebar chrome while keeping mail content usable', async () => {
    render(
      <WorkspacePanelProvider initialPanels={emailCaddyPanelRegistrations}>
        <EmailCaddyWorkspaceContent compactPanel />
      </WorkspacePanelProvider>,
    );

    expect(screen.getByRole('heading', { level: 2, name: /emailcaddy/i })).toBeInTheDocument();
    expect(screen.queryByRole('separator', { name: 'Resize selected email pane' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Select all visible emails')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Follow-up: did we answer every onboarding question?' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Open Follow-up: did we answer every onboarding question?' })).toBeInTheDocument();
    });
    expect(document.querySelector('[data-email-mail-surface="true"]')).toHaveAttribute('data-email-lower-pane-active', 'false');
    expect(screen.queryByText('Selected message')).not.toBeInTheDocument();
    expect(document.querySelector('[data-email-reader-pane="true"]')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Follow-up: did we answer every onboarding question?' }));
    expect(screen.queryByRole('separator', { name: 'Resize selected email pane' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-email-mail-surface="true"]')).toHaveAttribute('data-email-lower-pane-active', 'false');
    expect(document.querySelector('[data-email-lower-pane="true"]')).not.toBeInTheDocument();
    const readerPanel = screen.getByRole('dialog', { name: 'EmailCaddy message reader panel' });
    expect(readerPanel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(within(readerPanel).getByText('Selected message')).toBeInTheDocument();
    expect(within(readerPanel).getByRole('button', { name: 'Reply' })).toBeInTheDocument();
    expect(within(readerPanel).getByRole('button', { name: 'Reply all' })).toBeInTheDocument();
    expect(within(readerPanel).getByRole('button', { name: 'Forward' })).toBeInTheDocument();
    expect(within(readerPanel).getByRole('button', { name: 'Context' })).toBeInTheDocument();
    expect(document.querySelector('[data-email-selected-message-card="true"]')).not.toBeInTheDocument();
    expect(screen.queryByText('EmailCaddy draft')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Search EmailCaddy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Compose' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Select bulk action' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pop out message context' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sanitize' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stage send review' })).not.toBeInTheDocument();

    fireEvent.click(within(readerPanel).getByRole('button', { name: 'Reply' }));
    const draftPanel = screen.getByRole('dialog', { name: 'EmailCaddy draft panel' });
    expect(draftPanel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(within(draftPanel).getByText('EmailCaddy draft')).toBeInTheDocument();
    expect(within(draftPanel).getByRole('textbox', { name: 'EmailCaddy draft subject' })).toBeInTheDocument();
    expect(document.querySelector('[data-email-mail-surface="true"]')).toHaveAttribute('data-email-lower-pane-active', 'false');
    expect(document.querySelector('[data-email-lower-pane="true"]')).not.toBeInTheDocument();
    expect(within(readerPanel).getByText('Selected message')).toBeInTheDocument();
  });

  it('opens the lower document view when an email card is selected', () => {
    render(<EmailCaddyWorkspace />);

    fireEvent.click(screen.getByText('Follow-up: did we answer every onboarding question?'));

    expect(screen.queryByText('Selected email')).not.toBeInTheDocument();
    expect(document.querySelector('[data-email-selected-message-card="true"]')).not.toBeInTheDocument();
    expect(screen.queryByText('EmailCaddy draft')).not.toBeInTheDocument();
    expect(screen.getByRole('separator', { name: 'Resize selected email pane' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reply' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reply all' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Forward' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Context' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    expect(screen.getByText('EmailCaddy draft')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'EmailCaddy draft subject' })).toBeInTheDocument();
  });

  it('pops out, resizes, minimizes, and restores the EmailCaddy message context panel', () => {
    render(<EmailCaddyWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: 'Compose' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'EmailCaddy draft subject' }), {
      target: { value: 'Preserved draft subject' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Context' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pop out message context' }));

    const panel = screen.getByRole('dialog', { name: 'EmailCaddy message context panel' });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(panel).toHaveClass('overflow-visible');
    expect(panel).not.toHaveClass('overflow-hidden');
    expect(screen.getByDisplayValue('Preserved draft subject')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return message context to UI' })).toBeInTheDocument();

    const rightHandle = screen.getByRole('button', { name: 'Resize message context from right' });
    fireEvent.pointerEnter(rightHandle);
    expect(panel).toHaveAttribute('data-workspace-panel-active-resize', 'right');
    expect(document.querySelector('[data-resize-indicator="right"]')).toBeInTheDocument();

    fireEvent.pointerLeave(rightHandle);
    const cornerHandle = screen.getByRole('button', { name: 'Resize message context from top left' });
    fireEvent.pointerEnter(cornerHandle);
    expect(panel).toHaveAttribute('data-workspace-panel-active-resize', 'top-left');
    expect(document.querySelector('[data-resize-indicator="top-left"]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Minimize message context' }));
    expect(screen.queryByRole('dialog', { name: 'EmailCaddy message context panel' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore message context panel' }));

    expect(screen.getByRole('dialog', { name: 'EmailCaddy message context panel' })).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(screen.getByDisplayValue('Preserved draft subject')).toBeInTheDocument();
  });

  it('restores minimized EmailCaddy popouts without bottom dock chrome while preserving draft state', () => {
    render(<EmailCaddyWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: 'Compose' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'EmailCaddy draft subject' }), {
      target: { value: 'Dock restored draft subject' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Context' }));
    fireEvent.click(screen.getByRole('button', { name: 'Context' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pop out message context' }));
    fireEvent.click(screen.getByRole('button', { name: 'Minimize message context' }));

    expect(screen.queryByRole('region', { name: 'Workspace panel dock' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-workspace-panel-dock-chip="emailcaddy-message-context"]')).toBeNull();
    const minimizedPanel = document.querySelector('[data-workspace-panel="emailcaddy-message-context"][data-workspace-panel-state="minimized"]');
    expect(minimizedPanel).toBeInTheDocument();
    expect(within(minimizedPanel as HTMLElement).queryByText(/^Dock$/)).not.toBeInTheDocument();

    fireEvent.click(within(minimizedPanel as HTMLElement).getByRole('button', { name: 'Restore message context panel' }));

    expect(screen.getByRole('dialog', { name: 'EmailCaddy message context panel' })).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(screen.getByDisplayValue('Dock restored draft subject')).toBeInTheDocument();
  });

  it('raises the active EmailCaddy popout when it receives workspace focus', () => {
    render(<EmailCaddyWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /Open Follow-up: did we answer every onboarding question?/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Context' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pop out message context' }));
    const initialPanel = screen.getByRole('dialog', { name: 'EmailCaddy message context panel' });
    const initialLayer = Number(initialPanel.getAttribute('data-workspace-panel-z-index'));

    fireEvent.pointerDown(initialPanel);

    const focusedPanel = screen.getByRole('dialog', { name: 'EmailCaddy message context panel' });
    expect(Number(focusedPanel.getAttribute('data-workspace-panel-z-index'))).toBeGreaterThan(initialLayer);
  });

  it('uses themed toolbar listboxes for EmailCaddy filters', () => {
    render(<EmailCaddyWorkspace />);

    const mailboxCombobox = screen.getByRole('combobox', { name: 'Select mailbox view' });
    fireEvent.click(mailboxCombobox);

    expect(screen.getByRole('listbox', { name: 'Select mailbox view options' })).toHaveAttribute('data-toolbar-select-listbox', 'true');
    fireEvent.click(screen.getByRole('option', { name: 'Meetings (1)' }));

    expect(mailboxCombobox).toHaveTextContent('Meetings (1)');
  });

  it('stages EmailCaddy account setup locally without provider calls or credential storage', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('unexpected provider call'));
    try {
      render(<EmailCaddyWorkspace />);

      expect(screen.getByText(/No email account connected/i)).toBeInTheDocument();
      expect(screen.getByText('Demo mailbox only')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Set up EmailCaddy account' }));

      const setup = screen.getByRole('region', { name: 'Email account setup' });
      expect(setup).toBeInTheDocument();
      expect(within(setup).getAllByText('Gmail / Google').length).toBeGreaterThan(0);
      expect(within(setup).getAllByText('Outlook / Microsoft / Hotmail').length).toBeGreaterThan(0);
      expect(within(setup).getAllByText('Proton').length).toBeGreaterThan(0);
      expect(within(setup).getAllByText('Generic IMAP / SMTP').length).toBeGreaterThan(0);
      expect(within(setup).getAllByText('Local mail bridge / manual proxy').length).toBeGreaterThan(0);
      expect(screen.getByText(/will not store passwords or tokens/i)).toBeInTheDocument();

      // Reviewing the local checklist must stay inert — no provider connection claim.
      fireEvent.click(screen.getByRole('button', { name: 'Review local setup checklist' }));
      expect(within(setup).getByText(/setup reviewed\. Save below to add this account\./i)).toBeInTheDocument();
      expect(setup).not.toHaveTextContent(/Safe local test passed|connection test passed|provider ready|provider connected/i);

      // Saving stages the account locally; titlebar reflects staged state.
      fireEvent.click(screen.getByRole('button', { name: 'Save checklist state' }));
      expect(within(setup).getByText(/account saved\. Live send and sync activate once connected\./i)).toBeInTheDocument();
      expect(screen.getByText('Local checklist staged')).toBeInTheDocument();
      expect(screen.queryByText(/No email account connected/i)).not.toBeInTheDocument();

      // Security invariants: no leaked credential strings, no fetch, no localStorage writes.
      const setupText = setup.textContent ?? '';
      expect(setupText).not.toMatch(/access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key|bearer\s+[a-z0-9]/i);
      expect(setupText).not.toMatch(/safe local test passed|connection test passed|provider ready|live provider connection|provider connected|mail sent|sent through/i);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(window.localStorage.length).toBe(0);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('keeps compact EmailCaddy account setup local while preserving draft popouts', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('unexpected provider call'));
    try {
      render(
        <WorkspacePanelProvider initialPanels={emailCaddyPanelRegistrations}>
          <EmailCaddyWorkspaceContent compactPanel />
        </WorkspacePanelProvider>,
      );

      // Compact mode shows a local-only empty state; no live account is implied.
      expect(screen.getByText(/No email account connected/i)).toBeInTheDocument();

      // Draft popouts must survive in compact mode without any provider calls.
      fireEvent.click(screen.getByRole('button', { name: 'Open Follow-up: did we answer every onboarding question?' }));
      const readerPanel = screen.getByRole('dialog', { name: 'EmailCaddy message reader panel' });
      fireEvent.click(within(readerPanel).getByRole('button', { name: 'Reply' }));
      const draftPanel = screen.getByRole('dialog', { name: 'EmailCaddy draft panel' });
      expect(draftPanel).toHaveAttribute('data-workspace-panel-state', 'floating');
      expect(within(draftPanel).getByRole('textbox', { name: 'EmailCaddy draft subject' })).toBeInTheDocument();
      expect(within(draftPanel).getByText(/editable before any platform send/i)).toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('supports editable compose fields and review controls without sending mail', () => {
    render(<EmailCaddyWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: 'Compose' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'EmailCaddy draft to' }), {
      target: { value: 'partner@example.com' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'EmailCaddy draft subject' }), {
      target: { value: 'Partner follow-up' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'EmailCaddy draft body' }), {
      target: { value: 'Here is the staged reply for review.' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'EmailCaddy draft sensitivity' }), {
      target: { value: 'external-review' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'EmailCaddy draft classification' }), {
      target: { value: 'internal' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'EmailCaddy draft audience depth' }), {
      target: { value: 'leadership' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Stage send review' }));

    expect(screen.getByDisplayValue('partner@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Partner follow-up')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Here is the staged reply for review.')).toBeInTheDocument();
    expect(screen.getByText(/CaddyAI did not send this email/i)).toBeInTheDocument();
  });

  it('asks before closing an unsaved EmailCaddy draft', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
      render(<EmailCaddyWorkspace />);

      fireEvent.click(screen.getByRole('button', { name: 'Compose' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'EmailCaddy draft subject' }), {
        target: { value: 'Unsaved local draft' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Close EmailCaddy draft' }));

      expect(confirmSpy).toHaveBeenCalledWith('Save this unsent email as a draft before closing?');
      expect(screen.queryByText('EmailCaddy draft')).not.toBeInTheDocument();
      expect(screen.getByText(/Draft saved locally in EmailCaddy before closing/i)).toBeInTheDocument();
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it('preserves reply-all context, attachment chips, and assistant aids', () => {
    render(<EmailCaddyWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /Open Partner architecture review invite attached/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Reply all' }));

    expect(screen.getByDisplayValue('no-reply@zoom.example')).toBeInTheDocument();
    expect(screen.getByDisplayValue('partner-architect@example.com')).toBeInTheDocument();
    expect(screen.queryByText('Quoted context')).not.toBeInTheDocument();
    expect(screen.getByText('Source attachment available externally')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'What am I forgetting?' }));
    expect(screen.getByText(/Coverage check: 2 extracted asks found/i)).toBeInTheDocument();
    expect(screen.getByText('Quoted context')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Extract asks' }));
    expect(screen.getByText(/Ask extraction: Review the invite for missing prep context/i)).toBeInTheDocument();
  });

  it('deletes selected email rows with Delete only when focus is outside draft fields', () => {
    render(<EmailCaddyWorkspace />);

    fireEvent.click(screen.getByLabelText('Select Security alert'));
    fireEvent.keyDown(window, { key: 'Delete', code: 'Delete' });
    expect(screen.queryByRole('button', { name: /Open Security alert/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Select Daily brief pack is ready for review'));
    fireEvent.click(screen.getByRole('button', { name: 'Compose' }));
    const body = screen.getByRole('textbox', { name: 'EmailCaddy draft body' });
    body.focus();
    fireEvent.keyDown(body, { key: 'Delete', code: 'Delete' });
    expect(screen.getByRole('button', { name: /Open Daily brief pack is ready for review/i })).toBeInTheDocument();
  });

  it('shows an empty state when the selected account has no mirrored emails', () => {
    render(<EmailCaddyWorkspace />);

    fireEvent.click(screen.getByRole('combobox', { name: 'Select email account' }));
    fireEvent.click(screen.getByRole('option', { name: 'Personal' }));

    expect(screen.getByText('No mirrored threads match this account and search view yet.')).toBeInTheDocument();
    expect(screen.queryByText('Selected email')).not.toBeInTheDocument();
  });

  it('renders the Odysseus-style CalendarCaddy surface', () => {
    render(<CalendarCaddyWorkspace />);

    expect(screen.getByRole('heading', { level: 2, name: /calendarcaddy/i })).toBeInTheDocument();
    expect(document.querySelector('[data-calendar-header-date="true"]')).toHaveTextContent('Friday, June 5, 2026');
    expect(screen.getByRole('status')).toHaveClass('sr-only');
    expect(screen.queryByText('CalendarCaddy workspace')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Ask CalendarCaddy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New event' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /month/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Friday, June 5', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use Focus work stamp brush' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use Medical stamp brush' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use Deadline stamp brush' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'CalendarCaddy selected agenda' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pop out selected agenda' })).not.toBeInTheDocument();
  });

  it('smart-minimizes CalendarCaddy secondary tools while keeping the calendar usable', () => {
    render(
      <WorkspacePanelProvider initialPanels={calendarCaddyPanelRegistrations}>
        <CalendarCaddyWorkspaceContent compactPanel />
      </WorkspacePanelProvider>,
    );

    expect(screen.getByRole('heading', { level: 2, name: /calendarcaddy/i })).toHaveClass('sr-only');
    expect(document.querySelector('[data-calendar-header-date="true"]')).toHaveTextContent('Friday, June 5, 2026');
    expect(screen.getByRole('status')).toHaveClass('sr-only');
    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Current calendar period' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /month/i })).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('[data-calendar-compact-stamp-strip="true"]')).toHaveAttribute('data-calendar-compact-stamp-count', '3');
    expect(screen.getByRole('button', { name: 'Use Focus work stamp brush' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use Medical stamp brush' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use Deadline stamp brush' })).toBeInTheDocument();
    expect(screen.getByText('Friday, June 5', { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Ask CalendarCaddy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New event' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Calendar settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'CalendarCaddy selected agenda' })).not.toBeInTheDocument();
  });

  it('keeps selected calendar state without rendering the docked selected agenda stack', () => {
    render(<CalendarCaddyWorkspace />);

    expect(screen.queryByRole('region', { name: 'CalendarCaddy selected agenda' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pop out selected agenda' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Select event Partner architecture review' }));

    expect(screen.getByText(/Partner architecture review selected/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Select event Deep research block' }));

    expect(screen.getByText(/Deep research block selected/i)).toBeInTheDocument();
    expect(screen.queryByText(/Partner architecture review selected/i)).not.toBeInTheDocument();
  });

  it('cleans up minimized EmailCaddy restore state when switching standalone AssistantCaddy workspaces', () => {
    const { rerender } = render(<EmailCaddyWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /Open Follow-up: did we answer every onboarding question?/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Context' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pop out message context' }));
    fireEvent.click(screen.getByRole('button', { name: 'Minimize message context' }));

    expect(document.querySelector('[data-workspace-panel="emailcaddy-message-context"][data-workspace-panel-state="minimized"]')).toBeInTheDocument();
    expect(document.querySelector('[data-workspace-panel-dock-chip="emailcaddy-message-context"]')).toBeNull();

    rerender(<CalendarCaddyWorkspace />);

    expect(document.querySelector('[data-workspace-panel-dock-chip="emailcaddy-message-context"]')).toBeNull();
    expect(document.querySelector('[data-workspace-panel="emailcaddy-message-context"][data-workspace-panel-state="minimized"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Restore message context panel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'CalendarCaddy selected agenda' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pop out selected agenda' })).not.toBeInTheDocument();
  });

  it('preserves minimized shell state across AssistantCaddy workspace switches without dock chips', () => {
    const { rerender } = render(<AssistantCaddyWorkspaceShell view="email" />);

    fireEvent.click(screen.getByRole('button', { name: /Open Follow-up: did we answer every onboarding question?/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Context' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pop out message context' }));
    fireEvent.click(screen.getByRole('button', { name: 'Minimize message context' }));

    expect(screen.queryByRole('region', { name: 'Workspace panel dock' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-workspace-panel-dock-chip="emailcaddy-message-context"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Restore message context panel' })).toBeInTheDocument();

    rerender(<AssistantCaddyWorkspaceShell view="overview" />);

    expect(screen.getByRole('heading', { level: 2, name: 'AssistantCaddy' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restore message context panel' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-workspace-panel-dock-chip="emailcaddy-message-context"]')).toBeNull();

    rerender(<AssistantCaddyWorkspaceShell view="calendar" />);

    expect(screen.getByRole('heading', { level: 2, name: /CalendarCaddy/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restore message context panel' })).not.toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Restore selected agenda panel' })).not.toBeInTheDocument();

    rerender(<AssistantCaddyWorkspaceShell view="email" />);
    fireEvent.click(screen.getByRole('button', { name: 'Restore message context panel' }));

    expect(screen.getByRole('dialog', { name: 'EmailCaddy message context panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
    expect(screen.queryByRole('button', { name: 'Restore selected agenda panel' })).not.toBeInTheDocument();
  });

  // Legacy shared-dock specs are intentionally skipped: minimized workspace panels
  // now restore through inline rollups, and current no-bottom-chip coverage lives
  // in the compact/minimized workspace tests above and below.
  it.skip('routes inactive dock restores back to the owning AssistantCaddy workspace', () => {
    const { rerender } = render(<AssistantCaddyWorkspaceShell view="email" />);

    fireEvent.click(screen.getByRole('button', { name: /Open Follow-up: did we answer every onboarding question?/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Context' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pop out message context' }));
    fireEvent.click(screen.getByRole('button', { name: 'Minimize message context' }));

    rerender(<AssistantCaddyWorkspaceShell view="overview" />);
    fireEvent.click(screen.getByRole('button', { name: 'Restore message context panel from workspace dock' }));

    expect(navigateToMock).toHaveBeenLastCalledWith('cademail');

    rerender(<AssistantCaddyWorkspaceShell view="email" />);

    expect(screen.getByRole('dialog', { name: 'EmailCaddy message context panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
  });

  it('keeps floating shell panels visible while AssistantCaddy is globally inactive', () => {
    const { rerender } = render(<AssistantCaddyWorkspaceShell view="email" />);

    fireEvent.click(screen.getByRole('button', { name: /Open Follow-up: did we answer every onboarding question?/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Context' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pop out message context' }));

    expect(screen.getByRole('dialog', { name: 'EmailCaddy message context panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );

    rerender(<AssistantCaddyWorkspaceShell active={false} view="overview" />);

    expect(screen.queryByRole('heading', { level: 2, name: 'AssistantCaddy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: /EmailCaddy/i })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'EmailCaddy message context panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
  });

  it.skip('keeps minimized shell dock controls visible while AssistantCaddy is globally inactive', () => {
    const { rerender } = render(<AssistantCaddyWorkspaceShell view="email" />);

    fireEvent.click(screen.getByRole('button', { name: /Open Follow-up: did we answer every onboarding question?/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Context' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pop out message context' }));
    fireEvent.click(screen.getByRole('button', { name: 'Minimize message context' }));

    rerender(<AssistantCaddyWorkspaceShell active={false} view="overview" />);

    expect(screen.getByRole('button', { name: 'Restore message context panel from workspace dock' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restore message context panel from workspace dock' }));

    expect(navigateToMock).toHaveBeenLastCalledWith('cademail');
    expect(screen.getByRole('dialog', { name: 'EmailCaddy message context panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
  });

  it('renders side-menu route surfaces without WorkspacePanel chrome', () => {
    const { unmount } = render(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={(
          <section aria-label="Dashboard test surface">
            <h2>Quick Links</h2>
          </section>
        )}
        activityActive={false}
        activity={(
          <section aria-label="Activity test surface">
            <h2>Activity Log</h2>
          </section>
        )}
        productsActive={false}
        products={(
          <section aria-label="Products test surface">
            <h2>Products</h2>
          </section>
        )}
        notesActive
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        evidenceActive={false}
        evidence={evidencePane}
        timelineActive={false}
        timeline={timelinePane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
        agentCaddyActive={false}
        agentCaddy={agentCaddyPane}
        chatActive={false}
        chat={chatPane}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Notes' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Notes panel' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Pop out Notes' })).toBeInTheDocument();
    expect(document.querySelector('[data-workspace-panel="notes-workspace"][role="dialog"]')).toBeNull();

    unmount();

    render(
      <AppWorkspaceShell
        assistantActive
        assistantView="email"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={(
          <section aria-label="Dashboard test surface">
            <h2>Quick Links</h2>
          </section>
        )}
        activityActive={false}
        activity={(
          <section aria-label="Activity test surface">
            <h2>Activity Log</h2>
          </section>
        )}
        productsActive={false}
        products={(
          <section aria-label="Products test surface">
            <h2>Products</h2>
          </section>
        )}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        evidenceActive={false}
        evidence={evidencePane}
        timelineActive={false}
        timeline={timelinePane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
        agentCaddyActive={false}
        agentCaddy={agentCaddyPane}
        chatActive={false}
        chat={chatPane}
      />,
    );

    expect(screen.getByRole('button', { name: 'Compose' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'EmailCaddy panel' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pop out EmailCaddy' })).toBeNull();
    expect(document.querySelector('[data-workspace-panel="emailcaddy-workspace"][role="dialog"]')).toBeNull();
  });

  it.skip('lets Dashboard launch into Workspace, minimize, and restore from the shared app workspace dock', async () => {
    const dashboard = (
      <section aria-label="Dashboard test surface">
        <h2>Quick Links</h2>
        <button type="button">Add Link</button>
      </section>
    );
    const onWorkspacePanelLaunchHandled = vi.fn();

    renderWorkspaceHomeShell({
      dashboard,
      workspacePanelLaunchRequest: { view: 'dashboard', requestId: 41 },
      onWorkspacePanelLaunchHandled,
    });

    await waitFor(() => {
      expect(onWorkspacePanelLaunchHandled).toHaveBeenCalledWith(41);
    });

    const panel = screen.getByRole('dialog', { name: 'Dashboard panel' });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(within(panel).getByRole('heading', { level: 2, name: 'Quick Links' })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('dialog', { name: 'Dashboard panel' })).getByRole('button', { name: 'Minimize Dashboard' }));

    expect(screen.getByRole('region', { name: 'Workspace panel dock' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore dashboard panel from workspace dock' }));

    expect(navigateToMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Dashboard panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
  });

  it('closes Workspace-owned Notes without docking and reopens the normal Notes route', async () => {
    const onWorkspacePanelLaunchHandled = vi.fn();
    const shell = (
      workspaceActive: boolean,
      notesActive: boolean,
      workspacePanelLaunchRequest: { view: WorkspacePanelLaunchView; requestId: number } | null,
    ) => (
      <AppWorkspaceShell
        workspaceActive={workspaceActive}
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={(
          <section aria-label="Dashboard test surface">
            <h2>Quick Links</h2>
          </section>
        )}
        activityActive={false}
        activity={(
          <section aria-label="Activity test surface">
            <h2>Activity Log</h2>
          </section>
        )}
        productsActive={false}
        products={(
          <section aria-label="Products test surface">
            <h2>Products</h2>
          </section>
        )}
        notesActive={notesActive}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        evidenceActive={false}
        evidence={evidencePane}
        timelineActive={false}
        timeline={timelinePane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
        agentCaddyActive={false}
        agentCaddy={agentCaddyPane}
        chatActive={false}
        chat={chatPane}
        workspacePanelLaunchRequest={workspacePanelLaunchRequest}
        onWorkspacePanelLaunchHandled={onWorkspacePanelLaunchHandled}
      />
    );

    const { rerender } = render(shell(true, false, { view: 'notes', requestId: 81 }));

    await waitFor(() => {
      expect(onWorkspacePanelLaunchHandled).toHaveBeenCalledWith(81);
    });

    const panel = screen.getByRole('dialog', { name: 'Notes panel' });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');

    fireEvent.click(within(panel).getByRole('button', { name: 'Close Notes workspace panel' }));

    expect(screen.queryByRole('dialog', { name: 'Notes panel' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Workspace panel dock' })).toBeNull();
    expect(document.querySelector('[data-workspace-panel="notes-workspace"][data-workspace-panel-state="floating-source"]')).toBeNull();
    expect(document.querySelector('[data-workspace-panel="notes-workspace"][data-workspace-panel-state="minimized"]')).toBeNull();

    rerender(shell(false, true, null));

    expect(screen.getByRole('button', { name: 'Create blank note' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Notes panel' })).toBeNull();
    expect(document.querySelector('[data-workspace-panel="notes-workspace"][data-workspace-panel-state="floating-source"]')).toBeNull();
  });

  it('keeps floating source placeholders compact so they do not reserve task-list height', async () => {
    const onWorkspacePanelLaunchHandled = vi.fn();

    renderWorkspaceHomeShell({
      workspacePanelLaunchRequest: { view: 'tasks', requestId: 47 },
      onWorkspacePanelLaunchHandled,
    });

    await waitFor(() => {
      expect(onWorkspacePanelLaunchHandled).toHaveBeenCalledWith(47);
    });

    const sourceSlot = document.querySelector<HTMLElement>(
      '[data-workspace-panel="tasks-workspace"][data-workspace-panel-state="floating-source"]',
    );
    expect(sourceSlot).not.toBeNull();
    expect(sourceSlot).toHaveAttribute('data-workspace-panel-source-compact', 'true');
    expect(sourceSlot).toHaveClass('w-fit');
    expect(sourceSlot).not.toHaveTextContent('This pane is popped out in the workspace.');
    expect(within(sourceSlot!).getByRole('button', { name: 'Return Tasks to main workspace from source slot' })).toBeInTheDocument();
  });

  it('keeps floating and minimized panels mounted on the Workspace route', async () => {
    const dashboard = (
      <section aria-label="Dashboard test surface">
        <h2>Quick Links</h2>
        <button type="button">Add Link</button>
      </section>
    );
    const onWorkspacePanelLaunchHandled = vi.fn();

    renderWorkspaceHomeShell({
      dashboard,
      workspacePanelLaunchRequest: { view: 'dashboard', requestId: 46 },
      onWorkspacePanelLaunchHandled,
    });

    await waitFor(() => {
      expect(onWorkspacePanelLaunchHandled).toHaveBeenCalledWith(46);
    });

    expect(screen.getByRole('region', { name: 'Workspace' })).toBeInTheDocument();
    expect(document.querySelector('[data-app-workspace-pane="active"]')).not.toBeNull();
    expect(document.querySelector('[data-assistantcaddy-shell-pane="active"]')).toBeNull();
    expect(document.querySelector('[data-workspace-panel="chat-workspace"]')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Dashboard panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
    expect(navigateToMock).not.toHaveBeenCalled();

    fireEvent.click(within(screen.getByRole('dialog', { name: 'Dashboard panel' })).getByRole('button', { name: 'Minimize Dashboard' }));

    expect(screen.queryByRole('region', { name: 'Workspace panel dock' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Restore Dashboard panel' })).toBeInTheDocument();
    expect(document.querySelector('[data-app-workspace-pane="active"]')).not.toBeNull();
    expect(document.querySelector('[data-assistantcaddy-shell-pane="active"]')).toBeNull();
    expect(document.querySelector('[data-workspace-panel="chat-workspace"]')).toBeNull();
    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it('hides Workspace-owned floating panels on non-Workspace routes', () => {
    const renderShell = (workspaceActive: boolean, timelineActive: boolean) => (
      <AppWorkspaceShell
        workspaceActive={workspaceActive}
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={(
          <section aria-label="Dashboard test surface">
            <h2>Quick Links</h2>
          </section>
        )}
        activityActive={false}
        activity={(
          <section aria-label="Activity test surface">
            <h2>Activity Log</h2>
          </section>
        )}
        productsActive={false}
        products={(
          <section aria-label="Products test surface">
            <h2>Products</h2>
          </section>
        )}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        evidenceActive={false}
        evidence={evidencePane}
        timelineActive={timelineActive}
        timeline={timelinePane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
        agentCaddyActive={false}
        agentCaddy={agentCaddyPane}
        chatActive={false}
        chat={chatPane}
      />
    );

    const { rerender } = render(renderShell(true, false));
    const workspace = screen.getByRole('region', { name: 'Workspace' });
    const dataTransfer = makeWorkspacePanelDataTransfer(createWorkspacePanelDragPayload('notes'));

    fireEvent.dragOver(workspace, { dataTransfer });
    fireEvent.drop(workspace, { dataTransfer, clientX: 650, clientY: 240 });

    expect(screen.getByRole('dialog', { name: 'Notes panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );

    rerender(renderShell(false, true));

    expect(screen.getByRole('heading', { name: 'Timeline' })).toBeInTheDocument();
    expect(document.querySelector('[data-workspace-panel="notes-workspace"][data-workspace-panel-state="floating"]')).toHaveClass('hidden');

    rerender(renderShell(true, false));

    expect(screen.getByRole('dialog', { name: 'Notes panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
  });

  it('shows workspace layout template controls on the Workspace home surface', () => {
    renderWorkspaceHomeShell();

    expect(screen.getByRole('region', { name: 'Workspace' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Workspace investigation layer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open CaddyShack' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Investigations' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Active workspace investigation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open CaddyAI investigation helper' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update selected workspace layout' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import workspace layout template' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export workspace layout template' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load selected workspace layout' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Workspace layout name')).not.toBeInTheDocument();
    const investigationSelector = screen.getByRole('combobox', { name: 'Active workspace investigation' });
    expect(investigationSelector).toHaveAttribute('data-toolbar-select-control', 'true');
    expect(investigationSelector).toHaveAttribute('data-workspace-investigation-select', 'true');
    expect(investigationSelector).toHaveTextContent('No investigation selected');
    const layouts = screen.getByRole('combobox', { name: 'Layouts' });
    expect(layouts).toBeInTheDocument();
    expect(layouts).toHaveAttribute('data-toolbar-select-control', 'true');
    expect(layouts).toHaveAttribute('data-workspace-layout-select', 'true');
    expect(layouts).toHaveTextContent('Default');
    fireEvent.click(layouts);
    expect(screen.getByRole('listbox', { name: 'Layouts options' })).toHaveAttribute('data-toolbar-select-listbox', 'true');
    expect(screen.getByRole('option', { name: 'Default' })).toHaveAttribute('data-toolbar-select-option-active', 'true');
    expect(screen.getByRole('option', { name: 'Add layout' })).toBeInTheDocument();
    fireEvent.click(layouts);
    expect(screen.queryByText('Save layout')).not.toBeInTheDocument();
    expect(screen.queryByText('Import layout')).not.toBeInTheDocument();
    expect(document.querySelector('[data-workspace-layout-template-controls="true"]')).toBeInTheDocument();
    expect(document.querySelector('[data-workspace-investigation-layer="true"]')).toBeInTheDocument();
    expect(document.querySelector('[data-workspace-tlp-footer="true"]')).toBeInTheDocument();
  });

  it('switches workspace investigation context without writing layout template data', () => {
    investigationContextMock.folders = [
      makeInvestigationFolder('case-alpha', 'Case Alpha', 'TLP:AMBER'),
      makeInvestigationFolder('case-beta', 'Case Beta', 'TLP:GREEN'),
    ];
    investigationContextMock.selectedFolder = investigationContextMock.folders[0];
    investigationContextMock.selectedFolderId = 'case-alpha';

    renderWorkspaceHomeShell();

    const selector = screen.getByRole('combobox', { name: 'Active workspace investigation' });
    expect(selector).toHaveTextContent('Case Alpha');
    expect(document.querySelector('[data-workspace-tlp-level="TLP:AMBER"]')).toBeInTheDocument();

    fireEvent.click(selector);
    expect(screen.getByRole('listbox', { name: 'Active workspace investigation options' })).toHaveAttribute('data-toolbar-select-listbox', 'true');
    expect(screen.getByRole('option', { name: 'Case Alpha' })).toHaveAttribute('data-toolbar-select-option-active', 'true');
    fireEvent.click(screen.getByRole('option', { name: 'Case Beta' }));

    expect(investigationContextMock.setSelectedFolderId).toHaveBeenCalledWith('case-beta');
    expect(investigationContextMock.setSelectedTag).toHaveBeenCalledWith(undefined);
    expect(investigationContextMock.setShowArchive).toHaveBeenCalledWith(false);
    expect(investigationContextMock.setShowTrash).toHaveBeenCalledWith(false);

    const workspace = screen.getByRole('region', { name: 'Workspace' });
    const dataTransfer = makeWorkspacePanelDataTransfer(createWorkspacePanelDragPayload('dashboard'));
    fireEvent.dragOver(workspace, { dataTransfer });
    fireEvent.drop(workspace, { dataTransfer, clientX: 650, clientY: 240 });
    expect(screen.getByRole('dialog', { name: 'Dashboard panel' })).toBeInTheDocument();

    const layouts = screen.getByRole('combobox', { name: 'Layouts' });
    fireEvent.click(layouts);
    fireEvent.click(screen.getByRole('option', { name: 'Add layout' }));
    expect(screen.getByRole('status')).toHaveTextContent('Added Layout 1.');

    const savedRaw = window.localStorage.getItem(WORKSPACE_LAYOUT_TEMPLATE_STORAGE_KEY);
    expect(savedRaw).not.toBeNull();
    expect(savedRaw).not.toContain('case-alpha');
    expect(savedRaw).not.toContain('case-beta');
    expect(savedRaw).not.toContain('Case Alpha');
    expect(savedRaw).not.toContain('Case Beta');
    expect(savedRaw).not.toContain('TLP:AMBER');
    expect(savedRaw).not.toContain('TLP:GREEN');
    expect(savedRaw).not.toContain('selectedFolderId');
    expect(savedRaw).not.toContain('folderId');
    expect(savedRaw).not.toContain('clsLevel');
    expect(savedRaw).not.toContain('notes');
    expect(savedRaw).not.toContain('tasks');
    expect(savedRaw).not.toContain('chatThreads');
  });

  it('clears workspace investigation from the top-row investigation dropdown', () => {
    investigationContextMock.folders = [
      makeInvestigationFolder('case-alpha', 'Case Alpha', 'TLP:AMBER'),
      makeInvestigationFolder('case-beta', 'Case Beta', 'TLP:GREEN'),
    ];
    investigationContextMock.selectedFolder = investigationContextMock.folders[0];
    investigationContextMock.selectedFolderId = 'case-alpha';

    renderWorkspaceHomeShell();

    const selector = screen.getByRole('combobox', { name: 'Active workspace investigation' });
    expect(selector).toHaveTextContent('Case Alpha');

    fireEvent.click(selector);
    fireEvent.click(screen.getByRole('option', { name: 'No investigation selected' }));

    expect(investigationContextMock.setSelectedFolderId).toHaveBeenCalledWith(undefined);
    expect(investigationContextMock.setSelectedTag).toHaveBeenCalledWith(undefined);
    expect(investigationContextMock.setShowArchive).toHaveBeenCalledWith(false);
    expect(investigationContextMock.setShowTrash).toHaveBeenCalledWith(false);
    expect(screen.getByRole('status')).toHaveTextContent('Workspace investigation context cleared.');
  });

  it.each([
    ['TLP:RED'],
    ['TLP:AMBER'],
    ['TLP:GREEN'],
    ['TLP:CLEAR'],
  ])('renders TLP workspace glow hooks for %s', (clsLevel) => {
    investigationContextMock.folders = [makeInvestigationFolder('case-alpha', 'Case Alpha', clsLevel)];
    investigationContextMock.selectedFolder = investigationContextMock.folders[0];
    investigationContextMock.selectedFolderId = 'case-alpha';

    renderWorkspaceHomeShell();

    const header = document.querySelector('[data-workspace-investigation-layer="true"]');
    const footer = document.querySelector('[data-workspace-tlp-footer="true"]');
    expect(header).toBeInTheDocument();
    expect(header).toHaveAttribute('data-workspace-tlp-level', clsLevel);
    expect((header as HTMLElement).style.borderBottomColor).not.toBe('');
    expect((header as HTMLElement).style.boxShadow).not.toBe('');
    expect(footer).toBeInTheDocument();
    expect((footer as HTMLElement).style.background).toContain('linear-gradient');
  });

  it('routes the compact CaddyAI investigation helper without mutating layout templates', () => {
    const savedLayoutPayload = JSON.stringify([{
      id: 'layout-1',
      name: 'Operator layout',
      savedAt: '2026-06-08T12:00:00.000Z',
      template: {
        kind: 'threatcaddy.workspace-layout-template',
        version: 1,
        name: 'Operator layout',
        exportedAt: '2026-06-08T12:00:00.000Z',
        panels: [{
          id: 'dashboard-workspace',
          mode: 'floating',
          restoreMode: 'floating',
          geometry: { x: 320, y: 72, width: 900, height: 620 },
        }],
      },
    }]);
    window.localStorage.setItem(WORKSPACE_LAYOUT_TEMPLATE_STORAGE_KEY, savedLayoutPayload);
    investigationContextMock.folders = [makeInvestigationFolder('case-alpha', 'Case Alpha', 'TLP:AMBER')];
    investigationContextMock.selectedFolder = investigationContextMock.folders[0];
    investigationContextMock.selectedFolderId = 'case-alpha';

    renderWorkspaceHomeShell();

    fireEvent.click(screen.getByRole('button', { name: 'Open CaddyAI investigation helper' }));

    expect(navigateToMock).toHaveBeenLastCalledWith('chat');
    expect(window.localStorage.getItem(WORKSPACE_LAYOUT_TEMPLATE_STORAGE_KEY)).toBe(savedLayoutPayload);
  });

  it('rejects oversized workspace layout uploads before reading file text', () => {
    renderWorkspaceHomeShell();
    const text = vi.fn();
    const oversizedFile = {
      name: 'oversized-layout.json',
      size: MAX_WORKSPACE_LAYOUT_TEMPLATE_BYTES + 1,
      text,
    };

    fireEvent.change(screen.getByLabelText('Workspace layout template file'), {
      target: { files: [oversizedFile] },
    });

    expect(text).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Workspace layout template is too large.');
  });

  it('launches the Dashboard as a floating panel when its sidebar payload is dropped on Workspace', () => {
    renderWorkspaceHomeShell();
    const workspace = screen.getByRole('region', { name: 'Workspace' });
    const dataTransfer = makeWorkspacePanelDataTransfer(createWorkspacePanelDragPayload('dashboard'));

    expect(screen.queryByRole('dialog', { name: 'Dashboard panel' })).toBeNull();

    fireEvent.dragOver(workspace, { dataTransfer });
    expect(workspace).toHaveAttribute('data-workspace-drop-state', 'valid');

    fireEvent.drop(workspace, { dataTransfer, clientX: 650, clientY: 240 });

    const panel = screen.getByRole('dialog', { name: 'Dashboard panel' });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(within(panel).getByRole('heading', { name: 'Quick Links' })).toBeInTheDocument();
    expect(workspace).toHaveAttribute('data-workspace-drop-state', 'idle');
    expect(document.querySelector('[data-workspace-panel="chat-workspace"]')).toBeNull();
    expect(document.querySelector('[data-workspace-panel="agentcaddy-workspace"]')).toBeNull();
    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it('launches EmailCaddy as a floating panel when its AssistantCaddy sidebar payload is dropped on Workspace', () => {
    renderWorkspaceHomeShell();
    const workspace = screen.getByRole('region', { name: 'Workspace' });
    const dataTransfer = makeWorkspacePanelDataTransfer(createAssistantWorkspacePanelDragPayload('email'));

    fireEvent.dragOver(workspace, { dataTransfer });
    expect(workspace).toHaveAttribute('data-workspace-drop-state', 'valid');

    fireEvent.drop(workspace, { dataTransfer, clientX: 700, clientY: 240 });

    const panel = screen.getByRole('dialog', { name: 'EmailCaddy panel' });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(within(panel).getByRole('button', { name: 'Compose' })).toBeInTheDocument();
    expect(document.querySelector('[data-workspace-panel="chat-workspace"]')).toBeNull();
    expect(document.querySelector('[data-workspace-panel="agentcaddy-workspace"]')).toBeNull();
    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it.each([
    ['activity', 'Activity panel', 'Activity Log', 'activity-workspace'],
    ['products', 'Products panel', 'Products', 'products-workspace'],
    ['notes', 'Notes panel', 'Notes', 'notes-workspace'],
    ['tasks', 'Tasks panel', 'Tasks', 'tasks-workspace'],
    ['evidence', 'Evidence panel', 'Evidence', 'evidence-workspace'],
    ['timeline', 'Timeline panel', 'Timeline', 'timeline-workspace'],
  ] as const)('launches the %s panel when its sidebar payload is dropped on Workspace', (view, dialogName, headingName, panelId) => {
    renderWorkspaceHomeShell();
    const workspace = screen.getByRole('region', { name: 'Workspace' });
    const dataTransfer = makeWorkspacePanelDataTransfer(createWorkspacePanelDragPayload(view));

    expect(document.querySelector(`[data-workspace-panel="${panelId}"]`)).toBeNull();

    fireEvent.dragOver(workspace, { dataTransfer });
    expect(workspace).toHaveAttribute('data-workspace-drop-state', 'valid');

    fireEvent.drop(workspace, { dataTransfer, clientX: 680, clientY: 260 });

    const panel = screen.getByRole('dialog', { name: dialogName });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(within(panel).getByRole('heading', { name: headingName })).toBeInTheDocument();
    expect(workspace).toHaveAttribute('data-workspace-drop-state', 'idle');
    expect(document.querySelector('[data-workspace-panel="chat-workspace"]')).toBeNull();
    expect(document.querySelector('[data-workspace-panel="agentcaddy-workspace"]')).toBeNull();
    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it.each([
    ['dashboard', 'Dashboard panel', 'Quick Links', 'dashboard-workspace'],
    ['activity', 'Activity panel', 'Activity Log', 'activity-workspace'],
    ['products', 'Products panel', 'Products', 'products-workspace'],
    ['notes', 'Notes panel', 'Notes', 'notes-workspace'],
    ['tasks', 'Tasks panel', 'Tasks', 'tasks-workspace'],
    ['evidence', 'Evidence panel', 'Evidence', 'evidence-workspace'],
    ['timeline', 'Timeline panel', 'Timeline', 'timeline-workspace'],
  ] as const)('opens the %s panel from a workspace launch command request', async (view, dialogName, headingName, panelId) => {
    const onWorkspacePanelLaunchHandled = vi.fn();

    renderWorkspaceHomeShell({
      workspacePanelLaunchRequest: { view, requestId: 42 },
      onWorkspacePanelLaunchHandled,
    });

    await waitFor(() => {
      expect(onWorkspacePanelLaunchHandled).toHaveBeenCalledWith(42);
    });

    const panel = screen.getByRole('dialog', { name: dialogName });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(within(panel).getByRole('heading', { name: headingName })).toBeInTheDocument();
    expect(document.querySelector(`[data-workspace-panel="${panelId}"][role="dialog"]`)).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
    expect(document.querySelector('[data-workspace-panel="chat-workspace"]')).toBeNull();
    expect(document.querySelector('[data-workspace-panel="agentcaddy-workspace"]')).toBeNull();
    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it.each([
    ['notes', 'Notes panel'],
    ['tasks', 'Tasks panel'],
  ] as const)('opens %s with the compact workspace launch footprint', async (view, dialogName) => {
    const onWorkspacePanelLaunchHandled = vi.fn();
    const descriptor = WORKSPACE_PANEL_LAUNCH_DESCRIPTORS[view];

    renderWorkspaceHomeShell({
      workspacePanelLaunchRequest: { view, requestId: 47 },
      onWorkspacePanelLaunchHandled,
    });

    await waitFor(() => {
      expect(onWorkspacePanelLaunchHandled).toHaveBeenCalledWith(47);
    });

    const panel = screen.getByRole('dialog', { name: dialogName });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(panel).toHaveAttribute('data-panel-compact', 'true');
    expect(panel).toHaveStyle({
      width: `${descriptor.defaultWidth}px`,
      height: `${descriptor.defaultHeight}px`,
    });
    expect(within(panel).getByRole('button', { name: view === 'notes' ? 'Create blank note' : 'New task' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: `Resize ${dialogName} from bottom right` })).toBeInTheDocument();
    expect(document.querySelector('[data-workspace-panel="chat-workspace"]')).toBeNull();
    expect(document.querySelector('[data-workspace-panel="agentcaddy-workspace"]')).toBeNull();
    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it('opens AssistantCaddy overview from an AssistantCaddy workspace command request without agent panels', async () => {
    const onAssistantWorkspacePanelLaunchHandled = vi.fn();

    renderWorkspaceHomeShell({
      assistantActive: false,
      assistantView: 'overview',
      assistantWorkspacePanelLaunchRequest: { view: 'overview', requestId: 72 },
      onAssistantWorkspacePanelLaunchHandled,
    });

    await waitFor(() => {
      expect(onAssistantWorkspacePanelLaunchHandled).toHaveBeenCalledWith(72);
    });

    expect(screen.getByRole('region', { name: 'Workspace' })).toBeInTheDocument();
    const panel = screen.getByRole('dialog', { name: 'AssistantCaddy panel' });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(document.querySelector(`[data-workspace-panel="${ASSISTANTCADDY_WORKSPACE_PANEL_ID}"][role="dialog"]`)).toBe(panel);
    expect(within(panel).getByRole('button', { name: 'Open EmailCaddy' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Open CalendarCaddy' })).toBeInTheDocument();
    expect(document.querySelector('[data-workspace-panel="chat-workspace"]')).toBeNull();
    expect(document.querySelector('[data-workspace-panel="agentcaddy-workspace"]')).toBeNull();

    fireEvent.click(within(panel).getByRole('button', { name: 'Minimize AssistantCaddy' }));
    expect(screen.queryByRole('region', { name: 'Workspace panel dock' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Restore AssistantCaddy panel' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restore AssistantCaddy panel' }));

    expect(navigateToMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'AssistantCaddy panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
  });

  it('opens EmailCaddy from an AssistantCaddy workspace command request without protected side panels', async () => {
    const onAssistantWorkspacePanelLaunchHandled = vi.fn();

    renderWorkspaceHomeShell({
      assistantActive: true,
      assistantView: 'email',
      assistantWorkspacePanelLaunchRequest: { view: 'email', requestId: 73 },
      onAssistantWorkspacePanelLaunchHandled,
    });

    await waitFor(() => {
      expect(onAssistantWorkspacePanelLaunchHandled).toHaveBeenCalledWith(73);
    });

    const panel = screen.getByRole('dialog', { name: 'EmailCaddy panel' });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(panel).toHaveAttribute('data-panel-compact', 'true');
    expect(panel.querySelector('[data-email-compact-panel="true"]')).not.toBeNull();
    expect(panel.querySelector('[data-email-route-header="true"]')).toBeNull();
    expect(panel.querySelector('[data-email-message-context-card="true"]')).toBeNull();
    expect(within(panel).getByRole('button', { name: 'Compose' })).toBeInTheDocument();
    expect(within(panel).getByRole('textbox', { name: 'Search EmailCaddy' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Ask CaddyAI about email search' })).toBeDisabled();
    expect(within(panel).queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Context' })).toBeDisabled();
    expect(panel.querySelector('[data-email-mail-surface="true"]')).toHaveAttribute('data-email-lower-pane-active', 'false');
    expect(panel.querySelector('[data-email-reader-pane="true"]')).toBeNull();
    expect(document.querySelector('[data-workspace-panel="chat-workspace"]')).toBeNull();
    expect(document.querySelector('[data-workspace-panel="agentcaddy-workspace"]')).toBeNull();

    const compactSearch = within(panel).getByRole('textbox', { name: 'Search EmailCaddy' });
    fireEvent.change(compactSearch, {
      target: { value: 'reply' },
    });
    expect(within(panel).getByRole('button', { name: 'Ask CaddyAI about email search' })).not.toBeDisabled();
    fireEvent.keyDown(compactSearch, { key: 'Enter', code: 'Enter' });
    expect(within(panel).queryByText('Reply shaping preview')).not.toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Ask CaddyAI about email search' }));
    expect(within(panel).getByText('Reply shaping preview')).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole('button', { name: 'Open Follow-up: did we answer every onboarding question?' }));
    expect(panel.querySelector('[data-email-mail-surface="true"]')).toHaveAttribute('data-email-lower-pane-active', 'false');
    expect(panel.querySelector('[data-email-lower-pane="true"]')).toBeNull();
    expect(within(panel).queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument();
    const readerPanel = screen.getByRole('dialog', { name: 'EmailCaddy message reader panel' });
    expect(readerPanel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(within(readerPanel).getByRole('button', { name: 'Reply' })).toBeInTheDocument();
    expect(within(readerPanel).getByRole('button', { name: 'Reply all' })).toBeInTheDocument();
    expect(within(readerPanel).getByRole('button', { name: 'Forward' })).toBeInTheDocument();
    expect(within(readerPanel).getByRole('button', { name: 'Context' })).toBeInTheDocument();

    fireEvent.click(within(readerPanel).getByRole('button', { name: 'Reply' }));
    const draftPanel = screen.getByRole('dialog', { name: 'EmailCaddy draft panel' });
    expect(draftPanel).toHaveAttribute('data-workspace-panel-state', 'floating');
    fireEvent.change(within(draftPanel).getByRole('textbox', { name: 'EmailCaddy draft subject' }), {
      target: { value: 'Command launch preserved draft subject' },
    });
    expect(panel.querySelector('[data-email-mail-surface="true"]')).toHaveAttribute('data-email-lower-pane-active', 'false');
    expect(panel.querySelector('[data-email-lower-pane="true"]')).toBeNull();

    expect(navigateToMock).not.toHaveBeenCalled();
    fireEvent.click(within(draftPanel).getByRole('button', { name: 'Context' }));
    const contextPanelSource = panel.querySelector(
      '[data-workspace-panel="emailcaddy-message-context"][data-workspace-panel-state="floating-source"]',
    );
    expect(contextPanelSource).toHaveClass('hidden');
    expect(screen.getByRole('dialog', { name: 'EmailCaddy message context panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
    fireEvent.click(within(panel).getByRole('button', { name: 'Minimize EmailCaddy' }));
    expect(screen.getByRole('button', { name: 'Restore EmailCaddy panel' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restore EmailCaddy panel' }));

    expect(navigateToMock).not.toHaveBeenCalled();
    const restoredPanel = screen.getByRole('dialog', { name: 'EmailCaddy panel' });
    expect(restoredPanel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(restoredPanel.querySelector('[data-email-mail-surface="true"]')).toHaveAttribute('data-email-lower-pane-active', 'false');
    expect(screen.getByDisplayValue('Command launch preserved draft subject')).toBeInTheDocument();
  });

  it.each([
    ['email', 'data-email-workspace-drag-source', 'emailcaddy-workspace'],
    ['calendar', 'data-calendar-workspace-drag-source', 'calendarcaddy-workspace'],
  ] as const)('writes a surface drag payload from the %s route header', (view, sourceAttribute, panelId) => {
    render(
      <WorkspacePanelProvider initialPanels={assistantCaddyWorkspacePanelRegistrations}>
        <AssistantCaddyWorkspaceShellContent
          active
          view={view}
          workspaceActive={false}
          onWorkspaceOwnPanel={() => {}}
        />
      </WorkspacePanelProvider>,
    );
    const source = document.querySelector<HTMLElement>(`[${sourceAttribute}="true"]`);
    expect(source).not.toBeNull();
    const dataTransfer = {
      effectAllowed: 'uninitialized',
      setData: vi.fn(),
    };

    fireEvent.dragStart(source!, { dataTransfer });

    expect(dataTransfer.effectAllowed).toBe('copy');
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      WORKSPACE_PANEL_DRAG_TYPE,
      expect.stringContaining('"kind":"threatcaddy.assistant-workspace-panel-launch"'),
    );
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      WORKSPACE_PANEL_DRAG_TYPE,
      expect.stringContaining('"source":"surface"'),
    );
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      WORKSPACE_PANEL_DRAG_TYPE,
      expect.stringContaining(`"panelId":"${panelId}"`),
    );
  });

  it('opens CalendarCaddy from an AssistantCaddy workspace command request without protected side panels', async () => {
    const onAssistantWorkspacePanelLaunchHandled = vi.fn();

    renderWorkspaceHomeShell({
      assistantActive: true,
      assistantView: 'calendar',
      assistantWorkspacePanelLaunchRequest: { view: 'calendar', requestId: 74 },
      onAssistantWorkspacePanelLaunchHandled,
    });

    await waitFor(() => {
      expect(onAssistantWorkspacePanelLaunchHandled).toHaveBeenCalledWith(74);
    });

    const panel = screen.getByRole('dialog', { name: 'CalendarCaddy panel' });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(panel).toHaveAttribute('data-panel-compact', 'true');
    expect(panel.querySelector('[data-calendar-compact-titlebar="true"]')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Current calendar period' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Select Friday, June 5, 2026' })).toBeInTheDocument();
    expect(within(panel).queryByRole('textbox', { name: 'Ask CalendarCaddy' })).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'New event' })).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Pop out selected agenda' })).not.toBeInTheDocument();
    expect(within(panel).queryByRole('region', { name: 'CalendarCaddy selected agenda' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-workspace-panel="chat-workspace"]')).toBeNull();
    expect(document.querySelector('[data-workspace-panel="agentcaddy-workspace"]')).toBeNull();

    fireEvent.click(within(panel).getByRole('button', { name: 'Select event Partner architecture review' }));
    expect(within(panel).getByText(/Partner architecture review selected/i)).toBeInTheDocument();

    expect(navigateToMock).not.toHaveBeenCalled();
    fireEvent.click(within(panel).getByRole('button', { name: 'Minimize CalendarCaddy' }));
    expect(screen.getByRole('button', { name: 'Restore CalendarCaddy panel' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restore CalendarCaddy panel' }));

    expect(navigateToMock).not.toHaveBeenCalled();
    const restoredPanel = screen.getByRole('dialog', { name: 'CalendarCaddy panel' });
    expect(restoredPanel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(restoredPanel).toHaveAttribute('data-panel-compact', 'true');
    expect(within(restoredPanel).getByRole('button', { name: 'Select Friday, June 5, 2026' })).toBeInTheDocument();
    expect(within(restoredPanel).queryByRole('textbox', { name: 'Ask CalendarCaddy' })).not.toBeInTheDocument();
    expect(within(restoredPanel).queryByRole('region', { name: 'CalendarCaddy selected agenda' })).not.toBeInTheDocument();
  });

  it.each([
    ['email', 'EmailCaddy panel', 'Compose', 'emailcaddy-workspace'],
    ['calendar', 'CalendarCaddy panel', 'Current calendar period', 'calendarcaddy-workspace'],
  ] as const)('opens %s as a floating panel from the Workspace route when AssistantCaddy is inactive', async (
    view,
    dialogName,
    controlName,
    panelId,
  ) => {
    const onAssistantWorkspacePanelLaunchHandled = vi.fn();

    renderWorkspaceHomeShell({
      assistantActive: false,
      assistantView: 'overview',
      assistantWorkspacePanelLaunchRequest: { view, requestId: 85 },
      onAssistantWorkspacePanelLaunchHandled,
    });

    await waitFor(() => {
      expect(onAssistantWorkspacePanelLaunchHandled).toHaveBeenCalledWith(85);
    });

    expect(screen.getByRole('region', { name: 'Workspace' })).toBeInTheDocument();
    expect(document.querySelector('[data-assistantcaddy-shell-pane="active"]')).toBeNull();
    const panel = screen.getByRole('dialog', { name: dialogName });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(document.querySelector(`[data-workspace-panel="${panelId}"][role="dialog"]`)).toBe(panel);
    expect(within(panel).getByRole('button', { name: controlName })).toBeInTheDocument();
    if (view === 'email') {
      expect(panel).toHaveAttribute('data-panel-compact', 'true');
      expect(panel.querySelector('[data-email-compact-panel="true"]')).not.toBeNull();
      expect(panel.querySelector('[data-email-route-header="true"]')).toBeNull();
      expect(panel.querySelector('[data-email-message-context-card="true"]')).toBeNull();
      expect(panel.querySelector('[data-email-mail-surface="true"]')).toHaveAttribute('data-email-lower-pane-active', 'false');
      expect(panel.querySelector('[data-email-reader-pane="true"]')).toBeNull();

      fireEvent.click(within(panel).getByRole('button', { name: 'Open Follow-up: did we answer every onboarding question?' }));
      expect(panel.querySelector('[data-email-mail-surface="true"]')).toHaveAttribute('data-email-lower-pane-active', 'false');
      expect(panel.querySelector('[data-email-lower-pane="true"]')).toBeNull();
      const readerPanel = screen.getByRole('dialog', { name: 'EmailCaddy message reader panel' });
      expect(within(readerPanel).getByRole('button', { name: 'Reply' })).toBeInTheDocument();
      expect(within(readerPanel).getByRole('button', { name: 'Reply all' })).toBeInTheDocument();
      expect(within(readerPanel).getByRole('button', { name: 'Forward' })).toBeInTheDocument();
      fireEvent.contextMenu(within(panel).getByRole('button', { name: 'Open Follow-up: did we answer every onboarding question?' }), {
        clientX: 120,
        clientY: 140,
      });
      const rowMenu = screen.getByRole('menu', { name: 'Email row actions' });
      expect(rowMenu).toHaveAttribute('data-themed-context-menu', 'toolbar-select');
      expect(within(rowMenu).getByRole('menuitem', { name: 'Open reader' })).toBeInTheDocument();
      fireEvent.click(within(readerPanel).getByRole('button', { name: 'Context' }));
      const contextPanelSource = panel.querySelector(
        '[data-workspace-panel="emailcaddy-message-context"][data-workspace-panel-state="floating-source"]',
      );
      expect(contextPanelSource).toHaveClass('hidden');
      expect(screen.getByRole('dialog', { name: 'EmailCaddy message context panel' })).toHaveAttribute(
        'data-workspace-panel-state',
        'floating',
      );
    }
    expect(document.querySelector('[data-workspace-panel="chat-workspace"]')).toBeNull();
    expect(document.querySelector('[data-workspace-panel="agentcaddy-workspace"]')).toBeNull();
    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it('ignores malformed workspace drag payloads without launching protected panels', () => {
    renderWorkspaceHomeShell();
    const workspace = screen.getByRole('region', { name: 'Workspace' });
    const dataTransfer = makeWorkspacePanelDataTransfer(JSON.stringify({
      kind: 'threatcaddy.workspace-panel-launch',
      version: 1,
      source: 'sidebar',
      view: 'chat',
      panelId: 'chat-workspace',
    }));

    fireEvent.dragOver(workspace, { dataTransfer });
    expect(workspace).toHaveAttribute('data-workspace-drop-state', 'valid');

    fireEvent.drop(workspace, { dataTransfer, clientX: 650, clientY: 240 });

    expect(screen.queryByRole('dialog', { name: 'Dashboard panel' })).toBeNull();
    expect(document.querySelector('[data-workspace-panel="chat-workspace"]')).toBeNull();
    expect(document.querySelector('[data-workspace-panel="agentcaddy-workspace"]')).toBeNull();
    expect(workspace).toHaveAttribute('data-workspace-drop-state', 'idle');
    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it('does not show the Workspace launch affordance for custom drags that also carry files', () => {
    renderWorkspaceHomeShell();
    const workspace = screen.getByRole('region', { name: 'Workspace' });
    const dataTransfer = makeWorkspacePanelDataTransfer(
      createWorkspacePanelDragPayload('dashboard'),
      [WORKSPACE_PANEL_DRAG_TYPE, 'Files'],
    );

    fireEvent.dragOver(workspace, { dataTransfer });
    expect(workspace).toHaveAttribute('data-workspace-drop-state', 'idle');

    fireEvent.drop(workspace, { dataTransfer, clientX: 650, clientY: 240 });

    expect(screen.queryByRole('dialog', { name: 'Dashboard panel' })).toBeNull();
    expect(document.querySelector('[data-workspace-panel="chat-workspace"]')).toBeNull();
    expect(document.querySelector('[data-workspace-panel="agentcaddy-workspace"]')).toBeNull();
    expect(workspace).toHaveAttribute('data-workspace-drop-state', 'idle');
    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it.skip('lets Activity join an already-mounted app workspace and restore from the shared dock', () => {
    const dashboard = (
      <section aria-label="Dashboard test surface">
        <h2>Quick Links</h2>
      </section>
    );
    const activity = (
      <section aria-label="Activity test surface">
        <h2>Activity Log</h2>
        <label htmlFor="activity-search-test">Search activity log</label>
        <input id="activity-search-test" />
      </section>
    );
    const products = (
      <section aria-label="Products test surface">
        <h2>Products</h2>
      </section>
    );
    const { rerender } = render(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={dashboard}
        activityActive
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Activity Log' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pop out Activity' }));

    const panel = screen.getByRole('dialog', { name: 'Activity panel' });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(within(panel).getByRole('heading', { level: 2, name: 'Activity Log' })).toBeInTheDocument();

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Activity panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Quick Links' })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('dialog', { name: 'Activity panel' })).getByRole('button', { name: 'Minimize Activity' }));

    expect(screen.getByRole('region', { name: 'Workspace panel dock' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore activity panel from workspace dock' }));

    expect(navigateToMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Activity panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
  });

  it.skip('lets Products join an already-mounted app workspace and restore from the shared dock', () => {
    const dashboard = (
      <section aria-label="Dashboard test surface">
        <h2>Quick Links</h2>
      </section>
    );
    const activity = (
      <section aria-label="Activity test surface">
        <h2>Activity Log</h2>
      </section>
    );
    const products = (
      <section aria-label="Products test surface">
        <h2>Products</h2>
        <label htmlFor="products-search-test">Search products</label>
        <input id="products-search-test" />
      </section>
    );
    const { rerender } = render(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Products' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pop out Products' }));

    const panel = screen.getByRole('dialog', { name: 'Products panel' });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(within(panel).getByRole('heading', { level: 2, name: 'Products' })).toBeInTheDocument();

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Products panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Quick Links' })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('dialog', { name: 'Products panel' })).getByRole('button', { name: 'Minimize Products' }));

    expect(screen.getByRole('region', { name: 'Workspace panel dock' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore products panel from workspace dock' }));

    expect(navigateToMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Products panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
  });

  it.skip('lets Notes join an already-mounted app workspace and restore from the shared dock', () => {
    const dashboard = (
      <section aria-label="Dashboard test surface">
        <h2>Quick Links</h2>
      </section>
    );
    const activity = (
      <section aria-label="Activity test surface">
        <h2>Activity Log</h2>
      </section>
    );
    const products = (
      <section aria-label="Products test surface">
        <h2>Products</h2>
      </section>
    );
    const { rerender } = render(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Notes' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pop out Notes' }));

    const panel = screen.getByRole('dialog', { name: 'Notes panel' });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(within(panel).getByRole('button', { name: 'Create blank note' })).toBeInTheDocument();

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Notes panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Quick Links' })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('dialog', { name: 'Notes panel' })).getByRole('button', { name: 'Minimize Notes' }));

    expect(screen.getByRole('region', { name: 'Workspace panel dock' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore notes panel from workspace dock' }));

    expect(navigateToMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Notes panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
  });

  it.skip('lets Tasks join an already-mounted app workspace and restore from the shared dock', () => {
    const dashboard = (
      <section aria-label="Dashboard test surface">
        <h2>Quick Links</h2>
      </section>
    );
    const activity = (
      <section aria-label="Activity test surface">
        <h2>Activity Log</h2>
      </section>
    );
    const products = (
      <section aria-label="Products test surface">
        <h2>Products</h2>
      </section>
    );
    const { rerender } = render(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Tasks' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pop out Tasks' }));

    const panel = screen.getByRole('dialog', { name: 'Tasks panel' });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(within(panel).getByRole('button', { name: 'New task' })).toBeInTheDocument();

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Tasks panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Quick Links' })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('dialog', { name: 'Tasks panel' })).getByRole('button', { name: 'Minimize Tasks' }));

    expect(screen.getByRole('region', { name: 'Workspace panel dock' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore tasks panel from workspace dock' }));

    expect(navigateToMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Tasks panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
  });

  it.skip('lets Whiteboards join an already-mounted app workspace and restore from the shared dock', () => {
    const dashboard = (
      <section aria-label="Dashboard test surface">
        <h2>Quick Links</h2>
      </section>
    );
    const activity = (
      <section aria-label="Activity test surface">
        <h2>Activity Log</h2>
      </section>
    );
    const products = (
      <section aria-label="Products test surface">
        <h2>Products</h2>
      </section>
    );
    const { rerender } = render(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Whiteboards' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pop out Whiteboards' }));

    const panel = screen.getByRole('dialog', { name: 'Whiteboards panel' });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(within(panel).getByRole('button', { name: 'New whiteboard' })).toBeInTheDocument();

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Whiteboards panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Quick Links' })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('dialog', { name: 'Whiteboards panel' })).getByRole('button', { name: 'Minimize Whiteboards' }));

    expect(screen.getByRole('region', { name: 'Workspace panel dock' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore whiteboards panel from workspace dock' }));

    expect(navigateToMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Whiteboards panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
  });

  it.skip('lets Graph join an already-mounted app workspace and restore from the shared dock', () => {
    const dashboard = (
      <section aria-label="Dashboard test surface">
        <h2>Quick Links</h2>
      </section>
    );
    const activity = (
      <section aria-label="Activity test surface">
        <h2>Activity Log</h2>
      </section>
    );
    const products = (
      <section aria-label="Products test surface">
        <h2>Products</h2>
      </section>
    );
    const graph = (visible: boolean) => (
      <section aria-label="Graph test surface">
        <h2>Entity Graph</h2>
        <p>{visible ? 'Graph visible' : 'Graph hidden'}</p>
        <button type="button">Fit to view</button>
      </section>
    );
    const { rerender } = render(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={graph}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive
        graph={graph}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Entity Graph' })).toBeInTheDocument();
    expect(screen.getByText('Graph visible')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pop out Graph' }));

    const panel = screen.getByRole('dialog', { name: 'Graph panel' });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(within(panel).getByRole('button', { name: 'Fit to view' })).toBeInTheDocument();

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={graph}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Graph panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
    expect(within(screen.getByRole('dialog', { name: 'Graph panel' })).getByText('Graph visible')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Quick Links' })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('dialog', { name: 'Graph panel' })).getByRole('button', { name: 'Minimize Graph' }));

    expect(screen.getByRole('region', { name: 'Workspace panel dock' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore graph panel from workspace dock' }));

    expect(navigateToMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Graph panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
  });

  it.skip('lets CaddyShack join an already-mounted app workspace and restore from the shared dock', () => {
    const dashboard = (
      <section aria-label="Dashboard test surface">
        <h2>Quick Links</h2>
      </section>
    );
    const activity = (
      <section aria-label="Activity test surface">
        <h2>Activity Log</h2>
      </section>
    );
    const products = (
      <section aria-label="Products test surface">
        <h2>Products</h2>
      </section>
    );
    const { rerender } = render(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'CaddyShack' })).toBeInTheDocument();
    expect(screen.getByText('Connect to a team server to use Team Feed.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pop out CaddyShack' }));

    const panel = screen.getByRole('dialog', { name: 'CaddyShack panel' });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(within(panel).getByText('Connect to a team server to use Team Feed.')).toBeInTheDocument();

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'CaddyShack panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Quick Links' })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('dialog', { name: 'CaddyShack panel' })).getByRole('button', { name: 'Minimize CaddyShack' }));

    expect(screen.getByRole('region', { name: 'Workspace panel dock' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore caddyshack panel from workspace dock' }));

    expect(navigateToMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'CaddyShack panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
  });

  it.skip('lets IOCs join an already-mounted app workspace and restore from the shared dock', () => {
    const dashboard = (
      <section aria-label="Dashboard test surface">
        <h2>Quick Links</h2>
      </section>
    );
    const activity = (
      <section aria-label="Activity test surface">
        <h2>Activity Log</h2>
      </section>
    );
    const products = (
      <section aria-label="Products test surface">
        <h2>Products</h2>
      </section>
    );
    const { rerender } = render(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive
        iocs={iocsPane}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'IOCs' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pop out IOCs' }));

    const panel = screen.getByRole('dialog', { name: 'IOCs panel' });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(within(panel).getByRole('button', { name: 'New IOC' })).toBeInTheDocument();

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'IOCs panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Quick Links' })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('dialog', { name: 'IOCs panel' })).getByRole('button', { name: 'Minimize IOCs' }));

    expect(screen.getByRole('region', { name: 'Workspace panel dock' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore iocs panel from workspace dock' }));

    expect(navigateToMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'IOCs panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
  });

  it.skip('lets the CaddyShack workbench join an already-mounted app workspace and restore from the shared dock', () => {
    const dashboard = (
      <section aria-label="Dashboard test surface">
        <h2>Quick Links</h2>
      </section>
    );
    const activity = (
      <section aria-label="Activity test surface">
        <h2>Activity Log</h2>
      </section>
    );
    const products = (
      <section aria-label="Products test surface">
        <h2>Products</h2>
      </section>
    );
    const { rerender } = render(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'CaddyShack workbench' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open request form' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pop out CaddyShack workbench' }));

    const panel = screen.getByRole('dialog', { name: 'CaddyShack workbench panel' });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(within(panel).getByRole('button', { name: 'Open request form' })).toBeInTheDocument();

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'CaddyShack workbench panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Quick Links' })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('dialog', { name: 'CaddyShack workbench panel' })).getByRole('button', { name: 'Minimize CaddyShack workbench' }));

    expect(screen.getByRole('region', { name: 'Workspace panel dock' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore caddyshack workbench panel from workspace dock' }));

    expect(navigateToMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'CaddyShack workbench panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
  });

  it.skip('keeps one shared dock for Dashboard, Activity, Products, Notes, Tasks, Whiteboards, Graph, CaddyShack, IOCs, CaddyShack workbench, and AssistantCaddy panels', () => {
    const dashboard = (
      <section aria-label="Dashboard test surface">
        <h2>Quick Links</h2>
      </section>
    );
    const activity = (
      <section aria-label="Activity test surface">
        <h2>Activity Log</h2>
      </section>
    );
    const products = (
      <section aria-label="Products test surface">
        <h2>Products</h2>
      </section>
    );
    const { rerender } = render(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pop out Dashboard' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Dashboard panel' })).getByRole('button', { name: 'Minimize Dashboard' }));

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={dashboard}
        activityActive
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pop out Activity' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Activity panel' })).getByRole('button', { name: 'Minimize Activity' }));

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pop out Products' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Products panel' })).getByRole('button', { name: 'Minimize Products' }));

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pop out Notes' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Notes panel' })).getByRole('button', { name: 'Minimize Notes' }));

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pop out Tasks' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Tasks panel' })).getByRole('button', { name: 'Minimize Tasks' }));

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pop out Whiteboards' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Whiteboards panel' })).getByRole('button', { name: 'Minimize Whiteboards' }));

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pop out Graph' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Graph panel' })).getByRole('button', { name: 'Minimize Graph' }));

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pop out CaddyShack' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'CaddyShack panel' })).getByRole('button', { name: 'Minimize CaddyShack' }));

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive
        iocs={iocsPane}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pop out IOCs' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'IOCs panel' })).getByRole('button', { name: 'Minimize IOCs' }));

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pop out CaddyShack workbench' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'CaddyShack workbench panel' })).getByRole('button', { name: 'Minimize CaddyShack workbench' }));

    rerender(
      <AppWorkspaceShell
        assistantActive
        assistantView="email"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Context' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pop out message context' }));
    fireEvent.click(screen.getByRole('button', { name: 'Minimize message context' }));

    expect(screen.getAllByRole('region', { name: 'Workspace panel dock' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Restore dashboard panel from workspace dock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore activity panel from workspace dock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore products panel from workspace dock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore notes panel from workspace dock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore tasks panel from workspace dock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore whiteboards panel from workspace dock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore graph panel from workspace dock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore caddyshack panel from workspace dock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore iocs panel from workspace dock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore caddyshack workbench panel from workspace dock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore message context panel from workspace dock' })).toBeInTheDocument();
  });

  it.skip('lets Evidence pop out, survive navigation, minimize, and restore from the shared dock', () => {
    const dashboard = (
      <section aria-label="Dashboard test surface">
        <h2>Quick Links</h2>
      </section>
    );
    const activity = (
      <section aria-label="Activity test surface">
        <h2>Activity Log</h2>
      </section>
    );
    const products = (
      <section aria-label="Products test surface">
        <h2>Products</h2>
      </section>
    );
    const { rerender } = render(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        evidenceActive
        evidence={evidencePane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Evidence' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pop out Evidence' }));

    const panel = screen.getByRole('dialog', { name: 'Evidence panel' });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(within(panel).getByText('No evidence yet')).toBeInTheDocument();

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        evidenceActive={false}
        evidence={evidencePane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Evidence panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );

    fireEvent.click(within(screen.getByRole('dialog', { name: 'Evidence panel' })).getByRole('button', { name: 'Minimize Evidence' }));

    expect(screen.getByRole('region', { name: 'Workspace panel dock' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore evidence panel from workspace dock' }));

    expect(navigateToMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Evidence panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
  });

  it.skip('lets Timeline pop out, survive navigation, minimize, and restore from the shared dock', () => {
    const dashboard = (
      <section aria-label="Dashboard test surface">
        <h2>Quick Links</h2>
      </section>
    );
    const activity = (
      <section aria-label="Activity test surface">
        <h2>Activity Log</h2>
      </section>
    );
    const products = (
      <section aria-label="Products test surface">
        <h2>Products</h2>
      </section>
    );
    const { rerender } = render(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        evidenceActive={false}
        evidence={evidencePane}
        timelineActive
        timeline={timelinePane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Timeline' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pop out Timeline' }));

    const panel = screen.getByRole('dialog', { name: 'Timeline panel' });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(within(panel).getByText('No timeline events yet')).toBeInTheDocument();

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        evidenceActive={false}
        evidence={evidencePane}
        timelineActive={false}
        timeline={timelinePane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Timeline panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );

    fireEvent.click(within(screen.getByRole('dialog', { name: 'Timeline panel' })).getByRole('button', { name: 'Minimize Timeline' }));

    expect(screen.getByRole('region', { name: 'Workspace panel dock' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore timeline panel from workspace dock' }));

    expect(navigateToMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Timeline panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
  });

  it.skip('lets AgentCaddy pop out, survive navigation, minimize, and restore from the shared dock', () => {
    const dashboard = (
      <section aria-label="Dashboard test surface">
        <h2>Quick Links</h2>
      </section>
    );
    const activity = (
      <section aria-label="Activity test surface">
        <h2>Activity Log</h2>
      </section>
    );
    const products = (
      <section aria-label="Products test surface">
        <h2>Products</h2>
      </section>
    );
    const { rerender } = render(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        evidenceActive={false}
        evidence={evidencePane}
        timelineActive={false}
        timeline={timelinePane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
        agentCaddyActive
        agentCaddy={agentCaddyPane}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'AgentCaddy' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pop out AgentCaddy' }));

    const panel = screen.getByRole('dialog', { name: 'AgentCaddy panel' });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(within(panel).getByText('No active agents')).toBeInTheDocument();

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        evidenceActive={false}
        evidence={evidencePane}
        timelineActive={false}
        timeline={timelinePane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
        agentCaddyActive={false}
        agentCaddy={agentCaddyPane}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'AgentCaddy panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );

    fireEvent.click(within(screen.getByRole('dialog', { name: 'AgentCaddy panel' })).getByRole('button', { name: 'Minimize AgentCaddy' }));

    expect(screen.getByRole('region', { name: 'Workspace panel dock' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore agentcaddy panel from workspace dock' }));

    expect(navigateToMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'AgentCaddy panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
  });

  it.skip('lets CaddyAI pop out, preserve its singleton child, minimize, and restore from the shared dock', () => {
    const dashboard = (
      <section aria-label="Dashboard test surface">
        <h2>Quick Links</h2>
      </section>
    );
    const activity = (
      <section aria-label="Activity test surface">
        <h2>Activity Log</h2>
      </section>
    );
    const products = (
      <section aria-label="Products test surface">
        <h2>Products</h2>
      </section>
    );
    const { rerender } = render(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive={false}
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        evidenceActive={false}
        evidence={evidencePane}
        timelineActive={false}
        timeline={timelinePane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
        chatActive
        chat={chatPane}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pop out CaddyAI' }));

    const panel = screen.getByRole('dialog', { name: 'CaddyAI panel' });
    expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    expect(within(panel).getByText('No chat threads yet')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'CaddyAI draft' }), {
      target: { value: 'preserved caddyai draft' },
    });
    expect(screen.getByDisplayValue('preserved caddyai draft')).toBeInTheDocument();

    rerender(
      <AppWorkspaceShell
        assistantActive={false}
        assistantView="overview"
        experimentalActive={false}
        experimentalWorkbench={experimentalWorkbenchPane}
        dashboardActive
        dashboard={dashboard}
        activityActive={false}
        activity={activity}
        productsActive={false}
        products={products}
        notesActive={false}
        notes={notesPane}
        tasksActive={false}
        tasks={tasksPane}
        evidenceActive={false}
        evidence={evidencePane}
        timelineActive={false}
        timeline={timelinePane}
        whiteboardsActive={false}
        whiteboards={whiteboardsPane}
        graphActive={false}
        graph={() => graphPane}
        caddyShackActive={false}
        caddyShack={caddyShackPane}
        iocsActive={false}
        iocs={iocsPane}
        chatActive={false}
        chat={chatPane}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'CaddyAI panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
    expect(screen.getByDisplayValue('preserved caddyai draft')).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('dialog', { name: 'CaddyAI panel' })).getByRole('button', { name: 'Minimize CaddyAI' }));

    expect(screen.getByRole('region', { name: 'Workspace panel dock' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('preserved caddyai draft')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore caddyai panel from workspace dock' }));

    expect(navigateToMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'CaddyAI panel' })).toHaveAttribute(
      'data-workspace-panel-state',
      'floating',
    );
    expect(screen.getByDisplayValue('preserved caddyai draft')).toBeInTheDocument();
  });

  it('keeps EmailCaddy draft and CalendarCaddy selection state mounted across shell switches', () => {
    const { rerender } = render(<AssistantCaddyWorkspaceShell view="email" />);

    fireEvent.click(screen.getByRole('button', { name: 'Compose' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'EmailCaddy draft subject' }), {
      target: { value: 'Shell preserved draft subject' },
    });

    rerender(<AssistantCaddyWorkspaceShell view="calendar" />);
    fireEvent.click(screen.getByRole('button', { name: 'Select event Partner architecture review' }));

    rerender(<AssistantCaddyWorkspaceShell view="email" />);

    expect(screen.getByDisplayValue('Shell preserved draft subject')).toBeInTheDocument();

    rerender(<AssistantCaddyWorkspaceShell view="calendar" />);

    expect(screen.getByText(/Partner architecture review selected/i)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'CalendarCaddy selected agenda' })).not.toBeInTheDocument();
  });

  it('opens the event drawer from a month cell action', () => {
    render(<CalendarCaddyWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /Add event on Tuesday, June 9, 2026/i }));

    expect(screen.getByRole('heading', { level: 3, name: 'Create a calendar event' })).toBeInTheDocument();
  });

  it('does not nest interactive controls inside month or week cells', () => {
    render(<CalendarCaddyWorkspace />);

    expect(document.querySelector('[data-calendar-month-cell][role="button"]')).toBeNull();
    expect(document.querySelector('[data-calendar-week-cell][role="button"]')).toBeNull();
    expect(screen.getByRole('button', { name: /Select Friday, June 5, 2026/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Week$/i }));
    expect(screen.getByRole('button', { name: /Add event on Friday, June 5, 2026 at 8 AM/i })).toBeInTheDocument();
  });

  it('deletes the selected calendar event with the Delete key', () => {
    render(<CalendarCaddyWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /Partner architecture review/i }));
    fireEvent.keyDown(window, { key: 'Delete', code: 'Delete' });

    expect(screen.queryByRole('button', { name: /Partner architecture review/i })).not.toBeInTheDocument();
    expect(screen.getByText('Removed Partner architecture review.')).toBeInTheDocument();
  });

  it('does not delete the selected calendar event while an editable field has focus', () => {
    render(<CalendarCaddyWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /Partner architecture review/i }));
    const prompt = screen.getByRole('textbox', { name: 'Ask CalendarCaddy' });
    fireEvent.change(prompt, { target: { value: 'Backspace should edit text only' } });
    fireEvent.keyDown(prompt, { key: 'Backspace', code: 'Backspace' });

    expect(screen.getByRole('button', { name: /Partner architecture review/i })).toBeInTheDocument();
    expect(screen.queryByText('Removed Partner architecture review.')).not.toBeInTheDocument();
  });

  it('opens the selected calendar event with Enter and closes transient UI with Escape', () => {
    render(<CalendarCaddyWorkspace />);

    const eventButton = screen.getByRole('button', { name: /Partner architecture review/i });
    fireEvent.contextMenu(eventButton, { clientX: 20, clientY: 30 });
    expect(screen.getByText('Edit details')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByText('Edit details')).not.toBeInTheDocument();

    fireEvent.click(eventButton);
    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });

    expect(screen.getByRole('heading', { level: 3, name: 'Partner architecture review' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('heading', { level: 3, name: 'Partner architecture review' })).not.toBeInTheDocument();
  });

  it('shows a calendar assist preview for conflict cleanup requests', () => {
    render(<CalendarCaddyWorkspace />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Ask CalendarCaddy' }), {
      target: { value: 'Check my family and work conflicts with travel buffer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send CalendarCaddy prompt' }));

    expect(screen.getByText('Conflict cleanup preview')).toBeInTheDocument();
    expect(screen.getByText(/flag the collisions that still need follow-up or travel time/i)).toBeInTheDocument();
  });
});
