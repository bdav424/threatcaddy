import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../components/Common/Modal';
import { ConfirmDialog } from '../components/Common/ConfirmDialog';
import { ThemeToggle } from '../components/Common/ThemeToggle';
import { NoteCard } from '../components/Notes/NoteCard';
import { Header } from '../components/Layout/Header';
import { Sidebar } from '../components/Layout/Sidebar';
import {
  WORKSPACE_PANEL_DRAG_TYPE,
  createWorkspacePanelDragPayload,
} from '../components/WorkspacePanels/workspacePanelLaunch';
import { createAssistantWorkspacePanelDragPayload } from '../components/CaddyAssistant/workspacePanelRegistrations';
import type { Note } from '../types';

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn(), toasts: [], removeToast: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ connected: false, user: null, serverUrl: null }),
}));

vi.mock('../contexts/UIModalContext', () => ({
  useUIModals: () => ({
    screenshareMaxLevel: null,
    setScreenshareMaxLevel: vi.fn(),
    setSearchOverlayOpen: vi.fn(),
    openSettings: vi.fn(),
  }),
}));

vi.mock('../contexts/ChatStreamContext', () => ({
  useChatStream: () => ({ isStreaming: false, streamingThreadId: null, streamingContent: '', abort: null }),
}));

vi.mock('../contexts/InvestigationContext', () => ({
  useInvestigation: () => ({
    selectedFolder: undefined,
    selectedFolderId: undefined,
    setSelectedFolderId: vi.fn(),
    folders: [],
    tags: [],
    selectedTag: undefined,
    setSelectedTag: vi.fn(),
    showTrash: false,
    setShowTrash: vi.fn(),
    showArchive: false,
    setShowArchive: vi.fn(),
    setEditingFolderId: vi.fn(),
    agentPendingCount: 0,
  }),
}));

const navigateToMock = vi.fn();

vi.mock('../contexts/NavigationContext', () => ({
  useNavigation: () => ({
    activeView: 'notes',
    selectedTimelineId: undefined,
    setSelectedTimelineId: vi.fn(),
    selectedWhiteboardId: undefined,
    setSelectedWhiteboardId: vi.fn(),
    navigateTo: navigateToMock,
  }),
}));

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <Modal open={false} onClose={() => {}} title="Test">
        <p>Content</p>
      </Modal>
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders title and content when open', () => {
    render(
      <Modal open={true} onClose={() => {}} title="My Modal">
        <p>Modal content</p>
      </Modal>
    );
    expect(screen.getByText('My Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('calls onClose when X button is clicked', () => {
    let closed = false;
    render(
      <Modal open={true} onClose={() => { closed = true; }} title="Test">
        <p>Content</p>
      </Modal>
    );
    const closeBtn = screen.getByRole('button');
    fireEvent.click(closeBtn);
    expect(closed).toBe(true);
  });
});

describe('ConfirmDialog', () => {
  it('shows message and action buttons', () => {
    render(
      <ConfirmDialog
        open={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Delete?"
        message="Are you sure?"
        confirmLabel="Yes, delete"
        danger
      />
    );
    expect(screen.getByText('Delete?')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByText('Yes, delete')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onConfirm and onClose when confirmed', () => {
    let confirmed = false;
    let closed = false;
    render(
      <ConfirmDialog
        open={true}
        onClose={() => { closed = true; }}
        onConfirm={() => { confirmed = true; }}
        title="Are you sure?"
        message="Proceed?"
        confirmLabel="Yes"
      />
    );
    fireEvent.click(screen.getByText('Yes'));
    expect(confirmed).toBe(true);
    expect(closed).toBe(true);
  });
});

describe('ThemeToggle', () => {
  it('shows sun icon in dark mode', () => {
    const { container } = render(<ThemeToggle theme="dark" onToggle={() => {}} />);
    expect(container.querySelector('button')).toBeInTheDocument();
  });

  it('calls onToggle when clicked', () => {
    let toggled = false;
    render(<ThemeToggle theme="dark" onToggle={() => { toggled = true; }} />);
    fireEvent.click(screen.getByRole('button'));
    expect(toggled).toBe(true);
  });
});

describe('NoteCard', () => {
  const note: Note = {
    id: '1',
    title: 'Test Note',
    content: '# Hello World\n\nSome **bold** text',
    tags: ['work', 'important'],
    pinned: true,
    archived: false,
    trashed: false,
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now(),
  };

  it('renders note title', () => {
    render(<NoteCard note={note} active={false} onSelect={() => {}} />);
    expect(screen.getByText('Test Note')).toBeInTheDocument();
  });

  it('shows tags', () => {
    render(<NoteCard note={note} active={false} onSelect={() => {}} />);
    expect(screen.getByText('work')).toBeInTheDocument();
    // TagPills collapses overflow tags behind a "+N" button
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    let selectedId = '';
    render(<NoteCard note={note} active={false} onSelect={(id) => { selectedId = id; }} />);
    fireEvent.click(screen.getByText('Test Note'));
    expect(selectedId).toBe(note.id);
  });

  it('shows "Untitled" for empty title', () => {
    const untitled = { ...note, title: '' };
    render(<NoteCard note={untitled} active={false} onSelect={() => {}} />);
    expect(screen.getByText('Untitled')).toBeInTheDocument();
  });

  it('shows folder name badge when folderName is set', () => {
    render(<NoteCard note={note} active={false} onSelect={() => {}} folderName="Work" folderColor="#3b82f6" />);
    expect(screen.getByText('Work')).toBeInTheDocument();
  });

  it('does not show folder badge when folderName is not set', () => {
    render(<NoteCard note={note} active={false} onSelect={() => {}} />);
    expect(screen.queryByText('Work')).not.toBeInTheDocument();
  });

  it('applies folder color left border when not active', () => {
    const { container } = render(<NoteCard note={note} active={false} onSelect={() => {}} folderColor="#ef4444" folderName="Clips" />);
    const card = container.querySelector('div[role="button"]') as HTMLElement;
    expect(card).toBeTruthy();
    // jsdom normalizes hex to rgb
    expect(card.style.borderLeftColor).toBe('rgb(239, 68, 68)');
    expect(parseInt(card.style.borderLeftWidth)).toBe(3);
  });

  it('does not apply folder color left border when active', () => {
    const { container } = render(<NoteCard note={note} active={true} onSelect={() => {}} folderColor="#ef4444" folderName="Clips" />);
    const card = container.querySelector('div[role="button"]') as HTMLElement;
    expect(card).toBeTruthy();
    expect(card.style.borderLeftColor).toBe('');
  });

  it('shows IOC count badge when note has active IOCs', () => {
    const noteWithIOCs: Note = {
      ...note,
      iocAnalysis: {
        extractedAt: Date.now(),
        iocs: [
          { id: 'i1', type: 'ipv4', value: '1.2.3.4', confidence: 'high', firstSeen: Date.now(), dismissed: false },
          { id: 'i2', type: 'domain', value: 'evil.com', confidence: 'high', firstSeen: Date.now(), dismissed: false },
          { id: 'i3', type: 'md5', value: 'abc', confidence: 'low', firstSeen: Date.now(), dismissed: true },
        ],
      },
    };
    render(<NoteCard note={noteWithIOCs} active={false} onSelect={() => {}} />);
    expect(screen.getByText('2')).toBeInTheDocument(); // 2 non-dismissed
  });
});

describe('Header', () => {
  const defaultProps = {
    theme: 'dark' as const,
    onToggleTheme: () => {},
    onQuickNote: () => {},
    onNewNote: () => {},
    onNewTask: () => {},
    onNewTimelineEvent: () => {},
    onNewWhiteboard: () => {},
    onToggleSidebar: () => {},
    onMobileMenuToggle: () => {},
    sidebarCollapsed: false,
    onQuickSave: () => {},
    onQuickLoad: () => {},
    effectiveClsLevels: ['TLP:CLEAR', 'TLP:GREEN', 'TLP:AMBER', 'TLP:AMBER+STRICT', 'TLP:RED'],
  };

  it('renders Create dropdown button with "New" label', () => {
    render(<Header {...defaultProps} />);
    const btn = screen.getByTitle('Create new...');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('New');
  });

  it('shows 5 items when Create dropdown is opened', () => {
    render(<Header {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Create new...'));
    expect(screen.getByText('Quick Note')).toBeTruthy();
    expect(screen.getByText('New Note from Template')).toBeTruthy();
    expect(screen.getByText('Task')).toBeTruthy();
    expect(screen.getByText('Timeline Event')).toBeTruthy();
    expect(screen.getByText('Whiteboard')).toBeTruthy();
  });

  it('calls onQuickNote when Quick Note item is clicked', () => {
    const onQuickNote = vi.fn();
    render(<Header {...defaultProps} onQuickNote={onQuickNote} />);
    fireEvent.click(screen.getByTitle('Create new...'));
    fireEvent.click(screen.getByText('Quick Note'));
    expect(onQuickNote).toHaveBeenCalledOnce();
  });

  it('calls onNewNote when New Note from Template item is clicked', () => {
    const onNewNote = vi.fn();
    render(<Header {...defaultProps} onNewNote={onNewNote} />);
    fireEvent.click(screen.getByTitle('Create new...'));
    fireEvent.click(screen.getByText('New Note from Template'));
    expect(onNewNote).toHaveBeenCalledOnce();
  });

  it('calls onNewNoteTemplate when New Note Template item is clicked', () => {
    const onNewNoteTemplate = vi.fn();
    render(<Header {...defaultProps} onNewNoteTemplate={onNewNoteTemplate} />);
    fireEvent.click(screen.getByTitle('Create new...'));
    fireEvent.click(screen.getByText('New Note Template'));
    expect(onNewNoteTemplate).toHaveBeenCalledOnce();
  });

  it('closes dropdown after clicking an item', () => {
    render(<Header {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Create new...'));
    expect(screen.getByText('Timeline Event')).toBeTruthy();
    fireEvent.click(screen.getByText('Task'));
    expect(screen.queryByText('Timeline Event')).toBeNull();
  });

  it('opens FortuneINT from the help menu', () => {
    const onOpenFortuneInt = vi.fn();
    render(<Header {...defaultProps} onOpenFortuneInt={onOpenFortuneInt} />);
    fireEvent.click(screen.getByTitle('Help & Links'));
    fireEvent.click(screen.getByText('FortuneINT'));
    expect(onOpenFortuneInt).toHaveBeenCalledOnce();
  });
});

describe('Sidebar', () => {
  beforeEach(() => {
    navigateToMock.mockReset();
  });

  const defaultProps = {
    collapsed: false,
    onToggleCollapsed: () => {},
    noteCounts: { total: 1, trashed: 0, archived: 0 },
    taskCounts: { todo: 1, 'in-progress': 0, done: 0, total: 1 },
    timelineCounts: { total: 0, starred: 0 },
    timelines: [],
    timelineEventCounts: {},
    whiteboards: [],
    whiteboardCount: 0,
    evidenceCount: 0,
    productCount: 0,
    chatCount: 2,
  };

  it('renders FortuneINT in the left sidebar and calls the handler', () => {
    const onOpenFortuneInt = vi.fn();
    render(<Sidebar {...defaultProps} onOpenFortuneInt={onOpenFortuneInt} />);
    fireEvent.click(screen.getByText('FortuneINT'));
    expect(onOpenFortuneInt).toHaveBeenCalledOnce();
  });

  it('applies color chip accent styling when enabled', () => {
    render(<Sidebar {...defaultProps} sidebarAccentStyle="color-chips" />);
    expect(screen.getByText('Dashboard').closest('[data-accent-style]')).toHaveAttribute('data-accent-style', 'color-chips');
  });

  it('renders the investigations and assistant dropdown structure', () => {
    render(<Sidebar {...defaultProps} onOpenFortuneInt={vi.fn()} />);

    expect(screen.getByText('CaddyShack')).toBeInTheDocument();
    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('Investigations')).toBeInTheDocument();
    expect(screen.getByText('CaddyAI')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Evidence')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('Whiteboards')).toBeInTheDocument();
    expect(screen.getByText('IOCs')).toBeInTheDocument();
    expect(screen.getByText('Graph')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getByText('AssistantCaddy')).toBeInTheDocument();
    expect(screen.getByText('EmailCaddy')).toBeInTheDocument();
    expect(screen.getByText('CalendarCaddy')).toBeInTheDocument();
    expect(screen.getByText('FortuneINT')).toBeInTheDocument();
    expect(screen.getByText('Templates')).toBeInTheDocument();
    expect(screen.getByText('AgentCaddy')).toBeInTheDocument();
  });

  it('routes the Workspace sidebar item to the workspace view', () => {
    render(<Sidebar {...defaultProps} />);

    fireEvent.click(screen.getByText('Workspace'));
    expect(navigateToMock).toHaveBeenLastCalledWith('workspace');
  });

  it('marks only approved sidebar items as workspace panel drag launchers', () => {
    render(<Sidebar {...defaultProps} />);

    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('draggable', 'true');
    expect(screen.getByRole('button', { name: 'Activity' })).toHaveAttribute('draggable', 'true');
    expect(screen.getByRole('button', { name: 'Products' })).toHaveAttribute('draggable', 'true');
    expect(screen.getByRole('button', { name: 'Notes' })).toHaveAttribute('draggable', 'true');
    expect(screen.getByRole('button', { name: 'Tasks' })).toHaveAttribute('draggable', 'true');
    expect(screen.getByRole('button', { name: 'Evidence' })).toHaveAttribute('draggable', 'true');
    expect(screen.getByRole('button', { name: 'Timeline' })).toHaveAttribute('draggable', 'true');
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('title', 'Dashboard: drag into Workspace');
    expect(screen.getByRole('button', { name: 'Notes' })).toHaveAttribute('title', 'Notes: drag into Workspace');
    expect(screen.getByRole('button', { name: 'Evidence' })).toHaveAttribute('title', 'Evidence: drag into Workspace');
    expect(screen.getByRole('button', { name: 'Timeline' })).toHaveAttribute('title', 'Timeline: drag into Workspace');
    expect(screen.getByRole('button', { name: 'EmailCaddy' })).toHaveAttribute('title', 'EmailCaddy: drag into Workspace');
    expect(screen.getByRole('button', { name: 'AssistantCaddy' })).toHaveAttribute('draggable', 'true');
    expect(screen.getByRole('button', { name: 'AssistantCaddy' })).toHaveAttribute('title', 'AssistantCaddy: drag into Workspace');
    expect(screen.getByRole('button', { name: 'Workspace' })).not.toHaveAttribute('draggable');
    expect(screen.getByRole('button', { name: 'CaddyAI' })).not.toHaveAttribute('draggable');
    expect(screen.getByRole('button', { name: 'EmailCaddy' })).toHaveAttribute('draggable', 'true');
    expect(screen.getByRole('button', { name: 'CalendarCaddy' })).toHaveAttribute('draggable', 'true');
    expect(screen.getByRole('button', { name: 'AgentCaddy' })).not.toHaveAttribute('draggable');
  });

  it('does not render side-menu workspace arrow action buttons', () => {
    const onOpenWorkspacePanel = vi.fn();
    const onOpenAssistantWorkspacePanel = vi.fn();
    render(
      <Sidebar
        {...defaultProps}
        onOpenWorkspacePanel={onOpenWorkspacePanel}
        onOpenAssistantWorkspacePanel={onOpenAssistantWorkspacePanel}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Open Dashboard in Workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Activity in Workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Products in Workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Notes in Workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Tasks in Workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open CaddyAI in Workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open AssistantCaddy in Workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open EmailCaddy in Workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open CalendarCaddy in Workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open AgentCaddy in Workspace' })).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('title', 'Dashboard: drag into Workspace');
    expect(screen.getByRole('button', { name: 'AssistantCaddy' })).toHaveAttribute('title', 'AssistantCaddy: drag into Workspace');
    expect(screen.getByRole('button', { name: 'EmailCaddy' })).toHaveAttribute('title', 'EmailCaddy: drag into Workspace');
    expect(onOpenWorkspacePanel).not.toHaveBeenCalled();
    expect(onOpenAssistantWorkspacePanel).not.toHaveBeenCalled();
    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it('keeps collapsed workspace-capable items as draggable hover-text launchers only', () => {
    const onOpenWorkspacePanel = vi.fn();
    const onOpenAssistantWorkspacePanel = vi.fn();
    render(
      <Sidebar
        {...defaultProps}
        collapsed
        onOpenWorkspacePanel={onOpenWorkspacePanel}
        onOpenAssistantWorkspacePanel={onOpenAssistantWorkspacePanel}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Open Dashboard in Workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Activity in Workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Products in Workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Notes in Workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Tasks in Workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open CaddyAI in Workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open AssistantCaddy in Workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open EmailCaddy in Workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open CalendarCaddy in Workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open AgentCaddy in Workspace' })).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('title', 'Dashboard: drag into Workspace');
    expect(screen.getByRole('button', { name: 'AssistantCaddy' })).toHaveAttribute('draggable', 'true');
    expect(screen.getByRole('button', { name: 'AssistantCaddy' })).toHaveAttribute('title', 'AssistantCaddy: drag into Workspace');
    expect(screen.getByRole('button', { name: 'EmailCaddy' })).toHaveAttribute('draggable', 'true');
    expect(screen.getByRole('button', { name: 'CalendarCaddy' })).toHaveAttribute('draggable', 'true');
    expect(screen.getByRole('button', { name: 'EmailCaddy' })).toHaveAttribute('title', 'EmailCaddy: drag into Workspace');
    expect(screen.getByRole('button', { name: 'CalendarCaddy' })).toHaveAttribute('title', 'CalendarCaddy: drag into Workspace');
    expect(onOpenWorkspacePanel).not.toHaveBeenCalled();
    expect(onOpenAssistantWorkspacePanel).not.toHaveBeenCalled();
    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it('writes the Dashboard workspace panel payload during expanded sidebar drag start', () => {
    render(<Sidebar {...defaultProps} />);
    const dataTransfer = {
      effectAllowed: 'uninitialized',
      setData: vi.fn(),
    };

    fireEvent.dragStart(screen.getByRole('button', { name: 'Dashboard' }), { dataTransfer });

    expect(dataTransfer.effectAllowed).toBe('copy');
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      WORKSPACE_PANEL_DRAG_TYPE,
      expect.stringContaining('"view":"dashboard"'),
    );
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      'text/plain',
      'ThreatCaddy Workspace panel: Dashboard',
    );
  });

  it('writes the Dashboard workspace panel payload during collapsed sidebar drag start', () => {
    render(<Sidebar {...defaultProps} collapsed />);
    const dataTransfer = {
      effectAllowed: 'uninitialized',
      setData: vi.fn(),
    };

    fireEvent.dragStart(screen.getByRole('button', { name: 'Dashboard' }), { dataTransfer });

    expect(dataTransfer.effectAllowed).toBe('copy');
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      WORKSPACE_PANEL_DRAG_TYPE,
      expect.stringContaining('"panelId":"dashboard-workspace"'),
    );
  });

  it.each([
    ['Activity', 'activity', 'activity-workspace'],
    ['Products', 'products', 'products-workspace'],
    ['Notes', 'notes', 'notes-workspace'],
    ['Tasks', 'tasks', 'tasks-workspace'],
    ['Evidence', 'evidence', 'evidence-workspace'],
    ['Timeline', 'timeline', 'timeline-workspace'],
  ])('writes the %s workspace panel payload during sidebar drag start', (label, view, panelId) => {
    render(<Sidebar {...defaultProps} />);
    const dataTransfer = {
      effectAllowed: 'uninitialized',
      setData: vi.fn(),
    };

    fireEvent.dragStart(screen.getByRole('button', { name: label }), { dataTransfer });

    expect(dataTransfer.effectAllowed).toBe('copy');
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      WORKSPACE_PANEL_DRAG_TYPE,
      expect.stringContaining(`"view":"${view}"`),
    );
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      WORKSPACE_PANEL_DRAG_TYPE,
      expect.stringContaining(`"panelId":"${panelId}"`),
    );
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      'text/plain',
      `ThreatCaddy Workspace panel: ${label}`,
    );
  });

  it('writes the lower-risk workspace panel payload during collapsed sidebar drag start', () => {
    render(<Sidebar {...defaultProps} collapsed />);
    const dataTransfer = {
      effectAllowed: 'uninitialized',
      setData: vi.fn(),
    };

    fireEvent.dragStart(screen.getByRole('button', { name: 'Notes' }), { dataTransfer });

    expect(dataTransfer.effectAllowed).toBe('copy');
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      WORKSPACE_PANEL_DRAG_TYPE,
      expect.stringContaining('"panelId":"notes-workspace"'),
    );
  });

  it.each([
    ['AssistantCaddy', 'overview', 'assistantcaddy-workspace'],
    ['EmailCaddy', 'email', 'emailcaddy-workspace'],
    ['CalendarCaddy', 'calendar', 'calendarcaddy-workspace'],
  ])('writes the %s AssistantCaddy workspace panel payload during sidebar drag start', (label, view, panelId) => {
    render(<Sidebar {...defaultProps} />);
    const dataTransfer = {
      effectAllowed: 'uninitialized',
      setData: vi.fn(),
    };

    fireEvent.dragStart(screen.getByRole('button', { name: label }), { dataTransfer });

    expect(dataTransfer.effectAllowed).toBe('copy');
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      WORKSPACE_PANEL_DRAG_TYPE,
      expect.stringContaining('"kind":"threatcaddy.assistant-workspace-panel-launch"'),
    );
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      WORKSPACE_PANEL_DRAG_TYPE,
      expect.stringContaining(`"view":"${view}"`),
    );
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      WORKSPACE_PANEL_DRAG_TYPE,
      expect.stringContaining(`"panelId":"${panelId}"`),
    );
  });

  it('launches an AssistantCaddy surface payload when dropped on the Workspace nav item', () => {
    const onOpenWorkspacePanel = vi.fn();
    const onOpenAssistantWorkspacePanel = vi.fn();
    const onNavigate = vi.fn();
    render(
      <Sidebar
        {...defaultProps}
        onOpenWorkspacePanel={onOpenWorkspacePanel}
        onOpenAssistantWorkspacePanel={onOpenAssistantWorkspacePanel}
        onNavigate={onNavigate}
      />,
    );
    const raw = createAssistantWorkspacePanelDragPayload('email', 'surface');
    const dataTransfer = {
      types: [WORKSPACE_PANEL_DRAG_TYPE],
      dropEffect: 'none',
      getData: vi.fn((type: string) => (type === WORKSPACE_PANEL_DRAG_TYPE ? raw : '')),
    };
    const workspaceItem = screen.getByRole('button', { name: 'Workspace' });

    fireEvent.dragOver(workspaceItem, { dataTransfer });
    expect(dataTransfer.dropEffect).toBe('copy');
    fireEvent.drop(workspaceItem, { dataTransfer });

    expect(onOpenAssistantWorkspacePanel).toHaveBeenCalledWith('email');
    expect(onOpenWorkspacePanel).not.toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it('launches a route workspace payload when dropped on the collapsed Workspace nav item', () => {
    const onOpenWorkspacePanel = vi.fn();
    const onOpenAssistantWorkspacePanel = vi.fn();
    render(
      <Sidebar
        {...defaultProps}
        collapsed
        onOpenWorkspacePanel={onOpenWorkspacePanel}
        onOpenAssistantWorkspacePanel={onOpenAssistantWorkspacePanel}
      />,
    );
    const raw = createWorkspacePanelDragPayload('notes');
    const dataTransfer = {
      types: [WORKSPACE_PANEL_DRAG_TYPE],
      dropEffect: 'none',
      getData: vi.fn((type: string) => (type === WORKSPACE_PANEL_DRAG_TYPE ? raw : '')),
    };
    const workspaceItem = screen.getByRole('button', { name: 'Workspace' });

    fireEvent.dragOver(workspaceItem, { dataTransfer });
    expect(dataTransfer.dropEffect).toBe('copy');
    fireEvent.drop(workspaceItem, { dataTransfer });

    expect(onOpenWorkspacePanel).toHaveBeenCalledWith('notes');
    expect(onOpenAssistantWorkspacePanel).not.toHaveBeenCalled();
    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it('ignores external files and malformed workspace drops on the Workspace nav item', () => {
    const onOpenWorkspacePanel = vi.fn();
    const onOpenAssistantWorkspacePanel = vi.fn();
    render(
      <Sidebar
        {...defaultProps}
        onOpenWorkspacePanel={onOpenWorkspacePanel}
        onOpenAssistantWorkspacePanel={onOpenAssistantWorkspacePanel}
      />,
    );
    const workspaceItem = screen.getByRole('button', { name: 'Workspace' });

    fireEvent.drop(workspaceItem, {
      dataTransfer: {
        types: [WORKSPACE_PANEL_DRAG_TYPE, 'Files'],
        getData: vi.fn(() => createAssistantWorkspacePanelDragPayload('calendar', 'surface')),
      },
    });
    fireEvent.drop(workspaceItem, {
      dataTransfer: {
        types: [WORKSPACE_PANEL_DRAG_TYPE],
        getData: vi.fn(() => '{"kind":"wrong"}'),
      },
    });

    expect(onOpenWorkspacePanel).not.toHaveBeenCalled();
    expect(onOpenAssistantWorkspacePanel).not.toHaveBeenCalled();
    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it('collapses and expands the AssistantCaddy submenu from its toggle', () => {
    render(<Sidebar {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle AssistantCaddy menu' }));
    expect(screen.queryByText('EmailCaddy')).toBeNull();
    expect(screen.queryByText('CalendarCaddy')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Toggle AssistantCaddy menu' }));
    expect(screen.getByText('EmailCaddy')).toBeInTheDocument();
    expect(screen.getByText('CalendarCaddy')).toBeInTheDocument();
  });

  it('routes assistant menu selections through the expected view keys', () => {
    render(<Sidebar {...defaultProps} />);

    fireEvent.click(screen.getByText('AssistantCaddy'));
    expect(navigateToMock).toHaveBeenLastCalledWith('caddyassistant');

    fireEvent.click(screen.getByText('EmailCaddy'));
    expect(navigateToMock).toHaveBeenLastCalledWith('cademail');

    fireEvent.click(screen.getByText('CalendarCaddy'));
    expect(navigateToMock).toHaveBeenLastCalledWith('calendarcaddy');
  });
});
