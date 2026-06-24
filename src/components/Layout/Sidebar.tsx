import { useEffect, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText, FileSearch, ListChecks, Clock, Trash2, Briefcase,
  Archive, Settings as SettingsIcon,
  PanelLeftClose, PanelLeft, Github, Download, Chrome, PenTool, Activity, Network, Search, Shield,
  LayoutDashboard, PanelsTopLeft, MessageSquare, LayoutTemplate, ChevronLeft, ChevronDown, ChevronRight,
  Bot, FileOutput, FlaskConical, Sparkles, Mail, CalendarDays, Monitor,
} from 'lucide-react';
import type { Timeline, Whiteboard, ViewMode } from '../../types';
import { cn } from '../../lib/utils';
import { NavItem, CollapsedIcon } from './SidebarHelpers';
import { FortuneIntIcon } from '../Common/FortuneIntIcon';
import { WhiteboardSubList } from './WhiteboardSubList';
import { TimelineSubList } from './TimelineSubList';
import { TagSubList } from './TagSubList';
import { useNavigation } from '../../contexts/NavigationContext';
import { useInvestigation } from '../../contexts/InvestigationContext';
import { useUIModals } from '../../contexts/UIModalContext';
import { useInvestigationClassification } from '../../hooks/useInvestigationClassification';
import { getClsBadgeStyle, getTlpBorderColor } from '../../lib/classification';
import {
  WORKSPACE_PANEL_DRAG_TYPE,
  WORKSPACE_PANEL_LAUNCH_DESCRIPTORS,
  createWorkspacePanelDragPayload,
  getWorkspacePanelDragDescriptor,
  hasExternalFileDragType,
  hasWorkspacePanelDragType,
  type WorkspacePanelLaunchView,
} from '../WorkspacePanels/workspacePanelLaunch';
import {
  ASSISTANT_WORKSPACE_PANEL_LAUNCH_DESCRIPTORS,
  createAssistantWorkspacePanelDragPayload,
  getAssistantWorkspacePanelDragDescriptor,
  type AssistantWorkspacePanelLaunchView,
} from '../CaddyAssistant/workspacePanelRegistrations';

const NAV_ACCENT_COLORS: Record<string, string> = {
  dashboard: 'var(--color-purple)',
  workspace: 'var(--color-purple)',
  investigations: 'var(--color-purple)',
  experimental: 'var(--color-purple)',
  caddyassistant: 'var(--color-purple)',
  cademail: 'var(--color-accent-blue)',
  calendarcaddy: 'var(--color-accent-green)',
  notes: 'var(--color-accent-blue)',
  tasks: 'var(--color-accent-amber)',
  evidence: 'var(--color-accent-blue)',
  products: 'var(--color-accent-green)',
  timeline: 'var(--color-accent-blue)',
  whiteboard: 'var(--color-purple)',
  'ioc-stats': 'var(--color-accent-green)',
  graph: 'var(--color-purple)',
  reports: 'var(--color-accent-amber)',
  activity: 'var(--color-accent-amber)',
  chat: 'var(--color-purple)',
  caddyshack: 'var(--color-purple)',
  agent: 'var(--color-accent-amber)',
  virtualcaddy: 'var(--color-accent-green)',
  netmap: 'var(--color-accent-amber)',
  fortuneint: 'var(--color-accent-blue)',
  settings: 'var(--color-accent-blue)',
  archive: 'var(--color-accent-amber)',
  trash: 'var(--color-accent-pink)',
  expand: 'var(--color-purple)',
};

const INVESTIGATION_GROUP_VIEWS: ViewMode[] = [
  'investigations',
  'chat',
  'notes',
  'tasks',
  'evidence',
  'products',
  'timeline',
  'whiteboard',
  'ioc-stats',
  'graph',
  'reports',
  'activity',
  'virtualcaddy',
  'netmap',
];

const ASSISTANT_GROUP_VIEWS: ViewMode[] = [
  'caddyassistant',
  'cademail',
  'calendarcaddy',
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  noteCounts: { total: number; trashed: number; archived: number };
  taskCounts: { todo: number; 'in-progress': number; done: number; total: number };
  timelineCounts?: { total: number; starred: number };
  timelines?: Timeline[];
  onCreateTimeline?: (name: string) => void;
  onDeleteTimeline?: (id: string) => void;
  onRenameTimeline?: (id: string, name: string) => void;
  timelineEventCounts?: Record<string, number>;
  whiteboards?: Whiteboard[];
  onCreateWhiteboard?: (name?: string) => Promise<Whiteboard>;
  onDeleteWhiteboard?: (id: string) => void;
  onRenameWhiteboard?: (id: string, name: string) => void;
  whiteboardCount?: number;
  onNavigate?: () => void;
  onRenameTag?: (id: string, name: string) => void;
  onDeleteTag?: (id: string) => void;
  investigationScopedCounts?: { notes: number; tasks: number; events: number; whiteboards: number; iocs: number } | null;
  evidenceCount?: number;
  productCount?: number;
  chatCount?: number;
  fortuneIntActive?: boolean;
  onOpenCaddyAI?: () => void;
  onOpenFortuneInt?: () => void;
  onOpenWorkspacePanel?: (view: WorkspacePanelLaunchView) => void;
  onOpenAssistantWorkspacePanel?: (view: AssistantWorkspacePanelLaunchView) => void;
  agentStatus?: 'idle' | 'running' | 'waiting' | 'paused' | 'error';
  onToggleAgent?: () => void;
  serverConnected?: boolean;
  sidebarAccentStyle?: 'default' | 'color-chips';
}
export function Sidebar({
  collapsed,
  onToggleCollapsed,
  noteCounts,
  taskCounts,
  timelineCounts,
  timelines = [],
  onCreateTimeline,
  onDeleteTimeline,
  onRenameTimeline,
  timelineEventCounts = {},
  whiteboards = [],
  onCreateWhiteboard,
  onDeleteWhiteboard,
  onRenameWhiteboard,
  whiteboardCount,
  onNavigate,
  onRenameTag,
  onDeleteTag,
  investigationScopedCounts,
  evidenceCount,
  productCount,
  chatCount,
  fortuneIntActive,
  onOpenCaddyAI,
  onOpenFortuneInt,
  onOpenWorkspacePanel,
  onOpenAssistantWorkspacePanel,
  agentStatus,
  onToggleAgent,
  sidebarAccentStyle = 'default',
}: SidebarProps) {
  const { t } = useTranslation('common');

  // Context hooks
  const { activeView, selectedTimelineId, setSelectedTimelineId, selectedWhiteboardId, setSelectedWhiteboardId, navigateTo } = useNavigation();
  const { selectedFolderId, setSelectedFolderId, folders, tags, selectedTag, setSelectedTag, showTrash, setShowTrash, showArchive, setShowArchive, setEditingFolderId, agentPendingCount } = useInvestigation();
  const { openSettings } = useUIModals();

  // Derived state
  const selectedFolder = folders.find((f) => f.id === selectedFolderId);
  const agentActionCount = agentPendingCount || undefined;
  const accentColorFor = (slot: string) => NAV_ACCENT_COLORS[slot] || 'var(--color-purple)';
  const chatActive = activeView === 'chat' && !fortuneIntActive && !showTrash && !showArchive;
  const fortuneIntVisible = !!onOpenFortuneInt;
  const fortuneIntSelected = activeView === 'chat' && !!fortuneIntActive && !showTrash && !showArchive;
  const investigationsActive = !showTrash && !showArchive
    && INVESTIGATION_GROUP_VIEWS.includes(activeView)
    && !(activeView === 'chat' && !!fortuneIntActive);
  const assistantActive = !showTrash && !showArchive && ASSISTANT_GROUP_VIEWS.includes(activeView);
  const [investigationsExpanded, setInvestigationsExpanded] = useState(true);
  const [assistantExpanded, setAssistantExpanded] = useState(true);
  const [workspaceNavDropState, setWorkspaceNavDropState] = useState<'idle' | 'valid'>('idle');

  useEffect(() => {
    if (investigationsActive) {
      setInvestigationsExpanded(true);
    }
  }, [investigationsActive]);

  useEffect(() => {
    if (assistantActive) {
      setAssistantExpanded(true);
    }
  }, [assistantActive]);

  const clearFilters = () => {
    setSelectedFolderId(undefined);
    setSelectedTag(undefined);
    setShowTrash(false);
    setShowArchive(false);
  };

  const navToView = (view: ViewMode) => {
    navigateTo(view);
    if (!selectedFolderId) clearFilters();
  };

  const nav = (fn: () => void) => {
    fn();
    onNavigate?.();
  };

  const handleWorkspacePanelDragStart = (event: DragEvent<HTMLElement>, view: WorkspacePanelLaunchView) => {
    const descriptor = WORKSPACE_PANEL_LAUNCH_DESCRIPTORS[view];
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(WORKSPACE_PANEL_DRAG_TYPE, createWorkspacePanelDragPayload(view));
    event.dataTransfer.setData('text/plain', `ThreatCaddy Workspace panel: ${descriptor.title}`);
  };

  const handleAssistantWorkspacePanelDragStart = (event: DragEvent<HTMLElement>, view: AssistantWorkspacePanelLaunchView) => {
    const descriptor = ASSISTANT_WORKSPACE_PANEL_LAUNCH_DESCRIPTORS[view];
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(WORKSPACE_PANEL_DRAG_TYPE, createAssistantWorkspacePanelDragPayload(view));
    event.dataTransfer.setData('text/plain', `ThreatCaddy Workspace panel: ${descriptor.title}`);
  };

  const resolveWorkspaceNavDrop = (dataTransfer: DataTransfer): { kind: 'workspace'; view: WorkspacePanelLaunchView } | { kind: 'assistant'; view: AssistantWorkspacePanelLaunchView } | null => {
    if (!hasWorkspacePanelDragType(dataTransfer.types) || hasExternalFileDragType(dataTransfer.types)) {
      return null;
    }

    const workspaceDescriptor = getWorkspacePanelDragDescriptor(dataTransfer);
    if (workspaceDescriptor) {
      const view = workspacePanelLaunchViewForPanelId(workspaceDescriptor.panelId);
      return view ? { kind: 'workspace', view } : null;
    }

    const assistantDescriptor = getAssistantWorkspacePanelDragDescriptor(dataTransfer);
    if (assistantDescriptor) {
      const view = assistantWorkspacePanelLaunchViewForPanelId(assistantDescriptor.panelId);
      return view ? { kind: 'assistant', view } : null;
    }

    return null;
  };

  const handleWorkspaceNavDragOver = (event: DragEvent<HTMLElement>) => {
    if (!resolveWorkspaceNavDrop(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setWorkspaceNavDropState('valid');
  };

  const handleWorkspaceNavDragLeave = (event: DragEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setWorkspaceNavDropState('idle');
  };

  const handleWorkspaceNavDrop = (event: DragEvent<HTMLElement>) => {
    const launch = resolveWorkspaceNavDrop(event.dataTransfer);
    if (!launch) return;

    event.preventDefault();
    event.stopPropagation();
    setWorkspaceNavDropState('idle');
    if (launch.kind === 'assistant') {
      onOpenAssistantWorkspacePanel?.(launch.view);
    } else {
      onOpenWorkspacePanel?.(launch.view);
    }
    onNavigate?.();
  };

  const workspaceNavDropProps = {
    onDragOver: handleWorkspaceNavDragOver,
    onDragLeave: handleWorkspaceNavDragLeave,
    onDrop: handleWorkspaceNavDrop,
    title: workspaceNavDropState === 'valid'
      ? 'Drop to open in Workspace'
      : undefined,
  };

  type CollapsedNavItem = {
    key: string;
    icon: typeof FileText;
    label: string;
    active: boolean;
    onClick: () => void;
    draggable?: boolean;
    onDragStart?: (event: DragEvent<HTMLElement>) => void;
    onDragOver?: (event: DragEvent<HTMLElement>) => void;
    onDragLeave?: (event: DragEvent<HTMLElement>) => void;
    onDrop?: (event: DragEvent<HTMLElement>) => void;
    actions?: React.ReactNode;
    badge?: number;
    dataTour?: string;
    title?: string;
    accentKey: string;
  };

  const collapsedTopItems: CollapsedNavItem[] = [
    {
      key: 'dashboard',
      icon: LayoutDashboard,
      label: t('sidebar.dashboard'),
      active: activeView === 'dashboard' && !showTrash && !showArchive,
      onClick: () => nav(() => navToView('dashboard')),
      draggable: true,
      onDragStart: (event) => handleWorkspacePanelDragStart(event, 'dashboard'),
      accentKey: 'dashboard',
    },
    {
      key: 'workspace',
      icon: PanelsTopLeft,
      label: t('sidebar.workspace', { defaultValue: 'Workspace' }),
      active: activeView === 'workspace' && !showTrash && !showArchive,
      onClick: () => nav(() => navToView('workspace')),
      ...workspaceNavDropProps,
      dataTour: 'workspace',
      accentKey: 'workspace',
    },
    {
      key: 'experimental',
      icon: FlaskConical,
      label: t('sidebar.experimental', { defaultValue: 'CaddyShack' }),
      active: activeView === 'experimental' && !showTrash && !showArchive,
      onClick: () => nav(() => navToView('experimental')),
      accentKey: 'experimental',
    },
    {
      key: 'investigations',
      icon: Briefcase,
      label: t('sidebar.investigations'),
      active: investigationsActive,
      onClick: () => nav(() => navToView('investigations')),
      dataTour: 'investigations',
      accentKey: 'investigations',
    },
    {
      key: 'caddyassistant',
      icon: Sparkles,
      label: t('sidebar.caddyAssistant', { defaultValue: 'AssistantCaddy' }),
      active: assistantActive,
      onClick: () => nav(() => navToView('caddyassistant')),
      draggable: true,
      onDragStart: (event) => handleAssistantWorkspacePanelDragStart(event, 'overview'),
      accentKey: 'caddyassistant',
    },
  ];

  const collapsedInvestigationItems: CollapsedNavItem[] = [
    {
      key: 'chat',
      icon: MessageSquare,
      label: t('sidebar.caddyAI'),
      active: chatActive,
      onClick: () => nav(() => onOpenCaddyAI ? onOpenCaddyAI() : navToView('chat')),
      badge: chatCount,
      dataTour: 'chat',
      accentKey: 'chat',
    },
    {
      key: 'notes',
      icon: FileText,
      label: t('sidebar.notes'),
      active: activeView === 'notes' && !showTrash && !showArchive,
      onClick: () => nav(() => navToView('notes')),
      draggable: true,
      onDragStart: (event) => handleWorkspacePanelDragStart(event, 'notes'),
      badge: investigationScopedCounts ? investigationScopedCounts.notes : noteCounts.total,
      accentKey: 'notes',
    },
    {
      key: 'tasks',
      icon: ListChecks,
      label: t('sidebar.tasks'),
      active: activeView === 'tasks' && !showTrash && !showArchive,
      onClick: () => nav(() => navToView('tasks')),
      draggable: true,
      onDragStart: (event) => handleWorkspacePanelDragStart(event, 'tasks'),
      badge: investigationScopedCounts ? investigationScopedCounts.tasks : taskCounts.total,
      dataTour: 'tasks',
      accentKey: 'tasks',
    },
    {
      key: 'evidence',
      icon: FileSearch,
      label: t('sidebar.evidence'),
      active: activeView === 'evidence' && !showTrash && !showArchive,
      onClick: () => nav(() => navToView('evidence')),
      draggable: true,
      onDragStart: (event) => handleWorkspacePanelDragStart(event, 'evidence'),
      badge: evidenceCount,
      accentKey: 'evidence',
    },
    {
      key: 'products',
      icon: FileOutput,
      label: t('sidebar.products'),
      active: activeView === 'products' && !showTrash && !showArchive,
      onClick: () => nav(() => navToView('products')),
      draggable: true,
      onDragStart: (event) => handleWorkspacePanelDragStart(event, 'products'),
      badge: productCount,
      accentKey: 'products',
    },
    {
      key: 'timeline',
      icon: Clock,
      label: t('sidebar.timeline'),
      active: activeView === 'timeline' && !showTrash && !showArchive,
      onClick: () => nav(() => navToView('timeline')),
      draggable: true,
      onDragStart: (event) => handleWorkspacePanelDragStart(event, 'timeline'),
      badge: investigationScopedCounts ? investigationScopedCounts.events : timelineCounts?.total,
      dataTour: 'timeline',
      accentKey: 'timeline',
    },
    {
      key: 'whiteboard',
      icon: PenTool,
      label: t('sidebar.whiteboards'),
      active: activeView === 'whiteboard' && !showTrash && !showArchive,
      onClick: () => nav(() => navToView('whiteboard')),
      badge: investigationScopedCounts ? investigationScopedCounts.whiteboards : whiteboardCount,
      dataTour: 'whiteboards',
      accentKey: 'whiteboard',
    },
    {
      key: 'ioc-stats',
      icon: Search,
      label: t('sidebar.iocs'),
      active: activeView === 'ioc-stats' && !showTrash && !showArchive,
      onClick: () => nav(() => navToView('ioc-stats')),
      badge: investigationScopedCounts ? investigationScopedCounts.iocs : undefined,
      accentKey: 'ioc-stats',
    },
    {
      key: 'graph',
      icon: Network,
      label: t('sidebar.graph'),
      active: activeView === 'graph' && !showTrash && !showArchive,
      onClick: () => nav(() => navToView('graph')),
      accentKey: 'graph',
    },
    {
      key: 'reports',
      icon: FileOutput,
      label: t('sidebar.reports'),
      active: activeView === 'reports' && !showTrash && !showArchive,
      onClick: () => nav(() => navToView('reports')),
      accentKey: 'reports',
    },
    {
      key: 'activity',
      icon: Activity,
      label: t('sidebar.activity'),
      active: activeView === 'activity' && !showTrash && !showArchive,
      onClick: () => nav(() => navToView('activity')),
      draggable: true,
      onDragStart: (event) => handleWorkspacePanelDragStart(event, 'activity'),
      dataTour: 'activity',
      accentKey: 'activity',
    },
    {
      key: 'virtualcaddy',
      icon: Monitor,
      label: t('sidebar.virtualCaddy', { defaultValue: 'VirtualCaddy' }),
      active: activeView === 'virtualcaddy' && !showTrash && !showArchive,
      onClick: () => nav(() => navToView('virtualcaddy')),
      accentKey: 'virtualcaddy',
    },
    {
      key: 'netmap',
      icon: Network,
      label: t('sidebar.netMap', { defaultValue: 'Network Map' }),
      active: activeView === 'netmap' && !showTrash && !showArchive,
      onClick: () => nav(() => navToView('netmap')),
      accentKey: 'netmap',
    },
  ];

  const collapsedAssistantItems: CollapsedNavItem[] = [
    {
      key: 'cademail',
      icon: Mail,
      label: t('sidebar.cadEmail', { defaultValue: 'EmailCaddy' }),
      active: activeView === 'cademail' && !showTrash && !showArchive,
      onClick: () => nav(() => navToView('cademail')),
      draggable: true,
      onDragStart: (event) => handleAssistantWorkspacePanelDragStart(event, 'email'),
      accentKey: 'cademail',
    },
    {
      key: 'calendarcaddy',
      icon: CalendarDays,
      label: t('sidebar.calendarCaddy', { defaultValue: 'CalendarCaddy' }),
      active: activeView === 'calendarcaddy' && !showTrash && !showArchive,
      onClick: () => nav(() => navToView('calendarcaddy')),
      draggable: true,
      onDragStart: (event) => handleAssistantWorkspacePanelDragStart(event, 'calendar'),
      accentKey: 'calendarcaddy',
    },
  ];

  const collapsedBottomItems: CollapsedNavItem[] = [
    {
      key: 'caddyshack',
      icon: LayoutTemplate,
      label: t('sidebar.caddyShack'),
      active: activeView === 'caddyshack' && !showTrash && !showArchive,
      onClick: () => nav(() => navToView('caddyshack')),
      dataTour: 'caddyshack',
      accentKey: 'caddyshack',
    },
    {
      key: 'agent',
      icon: Bot,
      label: t('sidebar.agentCaddy'),
      active: activeView === 'agent' && !showTrash && !showArchive,
      onClick: () => nav(() => navToView('agent')),
      badge: agentActionCount,
      dataTour: 'agent',
      accentKey: 'agent',
    },
  ];

  // TLP/PAP classification inheritance for the active investigation
  const inheritedClsLevel = useInvestigationClassification(selectedFolder?.id ?? null);
  const effectiveClsLevel = inheritedClsLevel !== 'TLP:CLEAR' ? inheritedClsLevel : (selectedFolder?.clsLevel ?? 'TLP:CLEAR');
  const clsBadgeStyle = effectiveClsLevel !== 'TLP:CLEAR' ? getClsBadgeStyle(effectiveClsLevel) : null;
  const tlpBorderColor = getTlpBorderColor(effectiveClsLevel);

  // --- Collapsed: icon-only rail ---
  if (collapsed) {
    return (
      <nav
        className="w-12 border-r border-border-subtle sidebar-glass flex flex-col items-center h-full shrink-0 overflow-hidden"
        aria-label="Main navigation"
        data-tour="sidebar-nav"
      >
        {/* Top expand button */}
        <div className="shrink-0 flex flex-col items-center py-1.5 border-b border-border-subtle w-full">
          <CollapsedIcon
            icon={PanelLeft}
            label={t('sidebar.expandSidebar')}
            onClick={onToggleCollapsed}
            accentStyle={sidebarAccentStyle}
            accentColor={accentColorFor('expand')}
          />
        </div>

        {/* Scrollable view icons */}
        <div className="flex-1 flex flex-col items-center py-2 gap-1 overflow-y-auto overflow-x-hidden w-full">
          {collapsedTopItems.map((item) => (
            <CollapsedIcon
              key={item.key}
              icon={item.icon}
              label={item.label}
              active={item.active}
              badge={item.badge}
              onClick={item.onClick}
              draggable={item.draggable}
              onDragStart={item.onDragStart}
              onDragOver={item.onDragOver}
              onDragLeave={item.onDragLeave}
              onDrop={item.onDrop}
              actions={item.actions}
              dataTour={item.dataTour}
              title={item.title}
              accentStyle={sidebarAccentStyle}
              accentColor={accentColorFor(item.accentKey)}
            />
          ))}

          <div className="w-6 h-px bg-border-subtle my-1" />
          {collapsedInvestigationItems.map((item) => (
            <CollapsedIcon
              key={item.key}
              icon={item.icon}
              label={item.label}
              active={item.active}
              badge={item.badge}
              onClick={item.onClick}
              draggable={item.draggable}
              onDragStart={item.onDragStart}
              onDragOver={item.onDragOver}
              onDragLeave={item.onDragLeave}
              onDrop={item.onDrop}
              actions={item.actions}
              dataTour={item.dataTour}
              title={item.title}
              accentStyle={sidebarAccentStyle}
              accentColor={accentColorFor(item.accentKey)}
            />
          ))}

          <div className="w-6 h-px bg-border-subtle my-1" />
          {collapsedAssistantItems.map((item) => (
            <CollapsedIcon
              key={item.key}
              icon={item.icon}
              label={item.label}
              active={item.active}
              badge={item.badge}
              onClick={item.onClick}
              draggable={item.draggable}
              onDragStart={item.onDragStart}
              onDragOver={item.onDragOver}
              onDragLeave={item.onDragLeave}
              onDrop={item.onDrop}
              actions={item.actions}
              dataTour={item.dataTour}
              title={item.title}
              accentStyle={sidebarAccentStyle}
              accentColor={accentColorFor(item.accentKey)}
            />
          ))}

          <div className="w-6 h-px bg-border-subtle my-1" />
          {fortuneIntVisible && (
            <CollapsedIcon
              icon={FortuneIntIcon}
              label={t('sidebar.fortuneInt', { defaultValue: 'FortuneINT' })}
              active={fortuneIntSelected}
              onClick={() => nav(() => onOpenFortuneInt?.())}
              dataTour="fortuneint"
              accentStyle={sidebarAccentStyle}
              accentColor={accentColorFor('fortuneint')}
            />
          )}
          {collapsedBottomItems.map((item) => (
            <CollapsedIcon
              key={item.key}
              icon={item.icon}
              label={item.label}
              active={item.active}
              badge={item.badge}
              onClick={item.onClick}
              dataTour={item.dataTour}
              accentStyle={sidebarAccentStyle}
              accentColor={accentColorFor(item.accentKey)}
            />
          ))}
        </div>

        {/* Fixed footer — always visible */}
        <div className="shrink-0 flex flex-col items-center py-1.5 gap-1 border-t border-border-subtle w-full">
          <CollapsedIcon
            icon={SettingsIcon}
            label={t('sidebar.settings')}
            onClick={() => nav(() => openSettings())}
            accentStyle={sidebarAccentStyle}
            accentColor={accentColorFor('settings')}
          />
          <CollapsedIcon
            icon={Archive}
            label={t('sidebar.archive')}
            active={showArchive}
            badge={noteCounts.archived}
            onClick={() => nav(() => { setShowArchive(!showArchive); setShowTrash(false); setSelectedFolderId(undefined); setSelectedTag(undefined); })}
            accentStyle={sidebarAccentStyle}
            accentColor={accentColorFor('archive')}
          />
          <CollapsedIcon
            icon={Trash2}
            label={t('sidebar.trash')}
            active={showTrash}
            badge={noteCounts.trashed}
            onClick={() => nav(() => { setShowTrash(!showTrash); setShowArchive(false); setSelectedFolderId(undefined); setSelectedTag(undefined); })}
            accentStyle={sidebarAccentStyle}
            accentColor={accentColorFor('trash')}
          />
          <CollapsedIcon
            icon={PanelLeft}
            label={t('sidebar.expandSidebar')}
            onClick={onToggleCollapsed}
            accentStyle={sidebarAccentStyle}
            accentColor={accentColorFor('expand')}
          />
        </div>
      </nav>
    );
  }

  // Status helpers for the investigation context header
  const selectedStatus = selectedFolder ? (selectedFolder.status || 'active') : 'active';
  const statusColor = selectedStatus === 'active'
    ? 'bg-accent-green'
    : selectedStatus === 'archived'
      ? 'bg-accent-amber'
      : 'bg-text-muted';
  const statusTextColor = selectedStatus === 'active'
    ? 'text-accent-green'
    : selectedStatus === 'archived'
      ? 'text-accent-amber'
      : 'text-text-muted';

  // --- Expanded: full sidebar ---
  return (
    <nav className="w-[260px] border-r border-border-subtle sidebar-glass flex flex-col h-full shrink-0 overflow-hidden" aria-label="Main navigation">
      {/* 1. HEADER */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">{t('appName')}</span>
        <button onClick={onToggleCollapsed} className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors" aria-label={t('sidebar.collapseSidebar')} title={t('sidebar.collapseSidebar')}>
          <PanelLeftClose size={16} />
        </button>
      </div>

      {/* 2. INVESTIGATION CONTEXT HEADER */}
      {selectedFolder && !assistantActive && (
        <div className="px-3 py-2 border-b border-border-subtle">
          <button
            onClick={() => { setSelectedFolderId(undefined); navigateTo('investigations'); }}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary mb-1 transition-colors"
          >
            <ChevronLeft size={14} />
            {t('sidebar.allInvestigations')}
          </button>
          {/* Clickable investigation card — opens settings */}
          <button
            onClick={() => setEditingFolderId(selectedFolder.id)}
            className="w-full text-start rounded-lg border border-border-subtle bg-bg-raised hover:border-border-medium hover:bg-bg-hover transition-colors p-2 group overflow-hidden"
            title={t('sidebar.investigationSettings')}
          >
            {selectedFolder.color && (
              <div className="h-0.5 rounded-full mb-1.5 -mx-0.5" style={{ backgroundColor: selectedFolder.color }} />
            )}
            <div className="flex items-center gap-2">
              {!selectedFolder.color && (
                <div className={cn('w-2 h-2 rounded-full shrink-0', statusColor)} />
              )}
              <span className="text-sm font-medium text-text-primary truncate flex-1">{selectedFolder.name}</span>
              {clsBadgeStyle && (
                <span
                  className={cn('text-[9px] font-mono font-bold px-1 py-px rounded border shrink-0', clsBadgeStyle.bg, clsBadgeStyle.text, clsBadgeStyle.border)}
                  title={`Classification: ${effectiveClsLevel}`}
                >
                  {effectiveClsLevel}
                </span>
              )}
              <SettingsIcon size={12} className="text-text-muted opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0" />
            </div>
            {investigationScopedCounts && (
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-text-muted">
                <span className="flex items-center gap-1"><FileText size={10} className="text-accent-blue" />{investigationScopedCounts.notes}</span>
                <span className="flex items-center gap-1"><ListChecks size={10} className="text-accent-amber" />{investigationScopedCounts.tasks}</span>
                <span className="flex items-center gap-1"><Clock size={10} className="text-accent-green" />{investigationScopedCounts.events}</span>
                <span className="flex items-center gap-1"><Search size={10} className="text-accent-green" />{investigationScopedCounts.iocs}</span>
              </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className={cn('text-[10px] font-medium uppercase tracking-wide', statusTextColor)}>
                {selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)}
              </span>
            </div>
            {/* TLP/PAP colored bottom border strip */}
            {tlpBorderColor && (
              <div className="-mx-2 -mb-2 mt-1.5 h-[3px] rounded-b" style={{ backgroundColor: tlpBorderColor }} />
            )}
          </button>
          {/* Agent toggle + status */}
          <div className="flex items-center justify-between mt-1.5 px-0.5">
            <div className="flex items-center gap-1.5">
              <Bot size={12} className={selectedFolder.agentEnabled ? 'text-accent-blue' : 'text-text-muted'} />
              <span className="text-[10px] text-text-muted">{t('sidebar.agentCaddy')}</span>
              {agentStatus && agentStatus !== 'idle' && (
                <span className={cn(
                  'text-[9px] px-1 py-px rounded',
                  agentStatus === 'running' && 'bg-accent-blue/10 text-accent-blue',
                  agentStatus === 'waiting' && 'bg-accent-amber/10 text-accent-amber',
                  agentStatus === 'error' && 'bg-red-400/10 text-red-400',
                  agentStatus === 'paused' && 'bg-surface-raised text-text-muted',
                )}>
                  {agentStatus}
                </span>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleAgent?.(); }}
              className={cn(
                'relative inline-flex h-4 w-7 items-center rounded-full transition-colors',
                selectedFolder.agentEnabled ? 'bg-accent-blue' : 'bg-gray-600',
              )}
              role="switch"
              aria-checked={!!selectedFolder.agentEnabled}
              aria-label={selectedFolder.agentEnabled ? t('sidebar.disableAgent') : t('sidebar.enableAgent')}
              title={selectedFolder.agentEnabled ? t('sidebar.disableAgent') : t('sidebar.enableAgent')}
            >
              <span className={cn(
                'inline-block h-3 w-3 rounded-full bg-white transition-transform',
                selectedFolder.agentEnabled ? 'translate-x-[13px]' : 'translate-x-[2px]',
              )} />
            </button>
          </div>
        </div>
      )}

      {/* 3. NAVIGATION */}
      <nav data-tour="sidebar-nav" className="flex-1 overflow-y-auto px-2 pt-2 space-y-0.5" aria-label="Views">
        <div data-tour="dashboard">
          <NavItem
            icon={<LayoutDashboard size={16} />}
            label={t('sidebar.dashboard')}
            active={activeView === 'dashboard' && !showTrash && !showArchive}
            onClick={() => nav(() => navToView('dashboard'))}
            draggable
            onDragStart={(event) => handleWorkspacePanelDragStart(event, 'dashboard')}
            accentStyle={sidebarAccentStyle}
            accentColor={accentColorFor('dashboard')}
          />
        </div>
        <div data-tour="workspace">
          <NavItem
            icon={<PanelsTopLeft size={16} />}
            label={t('sidebar.workspace', { defaultValue: 'Workspace' })}
            active={activeView === 'workspace' && !showTrash && !showArchive}
            onClick={() => nav(() => navToView('workspace'))}
            onDragOver={handleWorkspaceNavDragOver}
            onDragLeave={handleWorkspaceNavDragLeave}
            onDrop={handleWorkspaceNavDrop}
            title={workspaceNavDropState === 'valid' ? 'Drop to open in Workspace' : undefined}
            accentStyle={sidebarAccentStyle}
            accentColor={accentColorFor('workspace')}
          />
        </div>
        <div data-tour="experimental">
          <NavItem
            icon={<FlaskConical size={16} />}
            label={t('sidebar.experimental', { defaultValue: 'CaddyShack' })}
            active={activeView === 'experimental' && !showTrash && !showArchive}
            onClick={() => nav(() => navToView('experimental'))}
            accentStyle={sidebarAccentStyle}
            accentColor={accentColorFor('experimental')}
          />
        </div>

        <div className="h-px bg-border-subtle mx-1 my-1.5" />

        <div data-tour="investigations">
          <NavItem
            icon={<Briefcase size={16} />}
            label={t('sidebar.investigations')}
            active={investigationsActive}
            onClick={() => nav(() => navToView('investigations'))}
            actions={(
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setInvestigationsExpanded((current) => !current);
                }}
                className="rounded p-1 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
                aria-label={t('sidebar.toggleInvestigations', { defaultValue: 'Toggle Investigations menu' })}
                title={t('sidebar.toggleInvestigations', { defaultValue: 'Toggle Investigations menu' })}
              >
                {investigationsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
            accentStyle={sidebarAccentStyle}
            accentColor={accentColorFor('investigations')}
          />
        </div>
        {investigationsExpanded && (
          <div className="space-y-0.5">
            <div data-tour="chat" className="ms-4">
              <NavItem
                icon={<MessageSquare size={14} />}
                label={t('sidebar.caddyAI')}
                badge={chatCount}
                badgeColor="bg-purple/15 text-purple"
                active={chatActive}
                onClick={() => nav(() => onOpenCaddyAI ? onOpenCaddyAI() : navToView('chat'))}
                compact
                accentStyle={sidebarAccentStyle}
                accentColor={accentColorFor('chat')}
              />
            </div>
            <div className="ms-4">
              <NavItem
                icon={<FileText size={14} />}
                label={t('sidebar.notes')}
                badge={investigationScopedCounts ? investigationScopedCounts.notes : noteCounts.total}
                badgeColor="bg-accent-blue/15 text-accent-blue"
                active={activeView === 'notes' && !showTrash && !showArchive}
                onClick={() => nav(() => navToView('notes'))}
                draggable
                onDragStart={(event) => handleWorkspacePanelDragStart(event, 'notes')}
                compact
                scopedColor={selectedFolder?.color || undefined}
                accentStyle={sidebarAccentStyle}
                accentColor={accentColorFor('notes')}
              />
            </div>
            <div data-tour="tasks" className="ms-4">
              <NavItem
                icon={<ListChecks size={14} />}
                label={t('sidebar.tasks')}
                badge={investigationScopedCounts ? investigationScopedCounts.tasks : taskCounts.total}
                badgeColor="bg-accent-amber/15 text-accent-amber"
                active={activeView === 'tasks' && !showTrash && !showArchive}
                onClick={() => nav(() => navToView('tasks'))}
                draggable
                onDragStart={(event) => handleWorkspacePanelDragStart(event, 'tasks')}
                compact
                scopedColor={selectedFolder?.color || undefined}
                accentStyle={sidebarAccentStyle}
                accentColor={accentColorFor('tasks')}
              />
            </div>
            <div className="ms-4">
              <NavItem
                icon={<FileSearch size={14} />}
                label={t('sidebar.evidence')}
                badge={evidenceCount}
                badgeColor="bg-accent-blue/15 text-accent-blue"
                active={activeView === 'evidence' && !showTrash && !showArchive}
                onClick={() => nav(() => navToView('evidence'))}
                draggable
                onDragStart={(event) => handleWorkspacePanelDragStart(event, 'evidence')}
                compact
                scopedColor={selectedFolder?.color || undefined}
                accentStyle={sidebarAccentStyle}
                accentColor={accentColorFor('evidence')}
              />
            </div>
            <div className="ms-4">
              <NavItem
                icon={<FileOutput size={14} />}
                label={t('sidebar.products')}
                badge={productCount}
                badgeColor="bg-accent-green/15 text-accent-green"
                active={activeView === 'products' && !showTrash && !showArchive}
                onClick={() => nav(() => navToView('products'))}
                draggable
                onDragStart={(event) => handleWorkspacePanelDragStart(event, 'products')}
                compact
                scopedColor={selectedFolder?.color || undefined}
                accentStyle={sidebarAccentStyle}
                accentColor={accentColorFor('products')}
              />
            </div>
            <div data-tour="timeline" className="ms-4">
              <NavItem
                icon={<Clock size={14} />}
                label={t('sidebar.timeline')}
                badge={investigationScopedCounts ? investigationScopedCounts.events : timelineCounts?.total}
                badgeColor="bg-accent-green/15 text-accent-green"
                active={activeView === 'timeline' && !showTrash && !showArchive}
                onClick={() => nav(() => navToView('timeline'))}
                draggable
                onDragStart={(event) => handleWorkspacePanelDragStart(event, 'timeline')}
                compact
                scopedColor={selectedFolder?.color || undefined}
                accentStyle={sidebarAccentStyle}
                accentColor={accentColorFor('timeline')}
              />
            </div>
            <div data-tour="whiteboards" className="ms-4">
              <NavItem
                icon={<PenTool size={14} />}
                label={t('sidebar.whiteboards')}
                badge={investigationScopedCounts ? investigationScopedCounts.whiteboards : whiteboardCount}
                active={activeView === 'whiteboard' && !showTrash && !showArchive}
                onClick={() => nav(() => navToView('whiteboard'))}
                compact
                scopedColor={selectedFolder?.color || undefined}
                accentStyle={sidebarAccentStyle}
                accentColor={accentColorFor('whiteboard')}
              />
            </div>
            <div className="ms-4">
              <NavItem
                icon={<Search size={14} />}
                label={t('sidebar.iocs')}
                badge={investigationScopedCounts ? investigationScopedCounts.iocs : undefined}
                badgeColor="bg-accent-green/15 text-accent-green"
                active={activeView === 'ioc-stats' && !showTrash && !showArchive}
                onClick={() => nav(() => navToView('ioc-stats'))}
                compact
                scopedColor={selectedFolder?.color || undefined}
                accentStyle={sidebarAccentStyle}
                accentColor={accentColorFor('ioc-stats')}
              />
            </div>
            <div className="ms-4">
              <NavItem
                icon={<Network size={14} />}
                label={t('sidebar.graph')}
                active={activeView === 'graph' && !showTrash && !showArchive}
                onClick={() => nav(() => navToView('graph'))}
                compact
                accentStyle={sidebarAccentStyle}
                accentColor={accentColorFor('graph')}
              />
            </div>
            <div data-tour="activity" className="ms-4">
              <NavItem
                icon={<Activity size={14} />}
                label={t('sidebar.activity')}
                active={activeView === 'activity' && !showTrash && !showArchive}
                onClick={() => nav(() => navToView('activity'))}
                draggable
                onDragStart={(event) => handleWorkspacePanelDragStart(event, 'activity')}
                compact
                accentStyle={sidebarAccentStyle}
                accentColor={accentColorFor('activity')}
              />
            </div>
          </div>
        )}

        <div className="mt-1">
          <NavItem
            icon={<Sparkles size={16} />}
            label={t('sidebar.caddyAssistant', { defaultValue: 'AssistantCaddy' })}
            active={assistantActive}
            onClick={() => nav(() => navToView('caddyassistant'))}
            draggable
            onDragStart={(event) => handleAssistantWorkspacePanelDragStart(event, 'overview')}
            actions={(
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setAssistantExpanded((current) => !current);
                }}
                className="rounded p-1 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
                aria-label={t('sidebar.toggleCaddyAssistant', { defaultValue: 'Toggle AssistantCaddy menu' })}
                title={t('sidebar.toggleCaddyAssistant', { defaultValue: 'Toggle AssistantCaddy menu' })}
              >
                {assistantExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
            accentStyle={sidebarAccentStyle}
            accentColor={accentColorFor('caddyassistant')}
          />
        </div>
        {assistantExpanded && (
          <div className="space-y-0.5">
            <div className="ms-4">
              <NavItem
                icon={<Mail size={14} />}
                label={t('sidebar.cadEmail', { defaultValue: 'EmailCaddy' })}
                active={activeView === 'cademail' && !showTrash && !showArchive}
                onClick={() => nav(() => navToView('cademail'))}
                draggable
                onDragStart={(event) => handleAssistantWorkspacePanelDragStart(event, 'email')}
                compact
                accentStyle={sidebarAccentStyle}
                accentColor={accentColorFor('cademail')}
              />
            </div>
            <div className="ms-4">
              <NavItem
                icon={<CalendarDays size={14} />}
                label={t('sidebar.calendarCaddy', { defaultValue: 'CalendarCaddy' })}
                active={activeView === 'calendarcaddy' && !showTrash && !showArchive}
                onClick={() => nav(() => navToView('calendarcaddy'))}
                draggable
                onDragStart={(event) => handleAssistantWorkspacePanelDragStart(event, 'calendar')}
                compact
                accentStyle={sidebarAccentStyle}
                accentColor={accentColorFor('calendarcaddy')}
              />
            </div>
          </div>
        )}

        <div className="h-px bg-border-subtle mx-1 my-1.5" />
        {fortuneIntVisible && (
          <div data-tour="fortuneint">
            <NavItem
              icon={<FortuneIntIcon size={16} />}
              label={t('sidebar.fortuneInt', { defaultValue: 'FortuneINT' })}
              active={fortuneIntSelected}
              onClick={() => nav(() => onOpenFortuneInt?.())}
              accentStyle={sidebarAccentStyle}
              accentColor={accentColorFor('fortuneint')}
            />
          </div>
        )}
        <div data-tour="caddyshack">
          <NavItem
            icon={<LayoutTemplate size={16} />}
            label={t('sidebar.caddyShack')}
            active={activeView === 'caddyshack' && !showTrash && !showArchive}
            onClick={() => nav(() => navToView('caddyshack'))}
            accentStyle={sidebarAccentStyle}
            accentColor={accentColorFor('caddyshack')}
          />
        </div>
        <div data-tour="agent">
          <NavItem
            icon={<Bot size={16} />}
            label={t('sidebar.agentCaddy')}
            badge={agentActionCount}
            badgeColor="bg-accent-amber/15 text-accent-amber"
            active={activeView === 'agent' && !showTrash && !showArchive}
            onClick={() => nav(() => navToView('agent'))}
            accentStyle={sidebarAccentStyle}
            accentColor={accentColorFor('agent')}
          />
        </div>

        {/* CONTEXTUAL SUB-LISTS */}

        {/* Whiteboards — only in whiteboard view */}
        {activeView === 'whiteboard' && (
          <WhiteboardSubList
            whiteboards={whiteboards}
            selectedWhiteboardId={selectedWhiteboardId}
            onWhiteboardSelect={setSelectedWhiteboardId}
            onCreateWhiteboard={onCreateWhiteboard}
            onDeleteWhiteboard={onDeleteWhiteboard}
            onRenameWhiteboard={onRenameWhiteboard}
            onNavigate={onNavigate}
          />
        )}

        {/* Timelines — only in timeline view */}
        {activeView === 'timeline' && (
          <TimelineSubList
            timelines={timelines}
            selectedTimelineId={selectedTimelineId}
            timelineCounts={timelineCounts}
            timelineEventCounts={timelineEventCounts}
            onTimelineSelect={setSelectedTimelineId}
            onCreateTimeline={onCreateTimeline}
            onDeleteTimeline={onDeleteTimeline}
            onRenameTimeline={onRenameTimeline}
            onNavigate={onNavigate}
          />
        )}

        {/* TAGS */}
        <TagSubList
          tags={tags}
          selectedTag={selectedTag}
          onTagSelect={setSelectedTag}
          onFolderSelect={setSelectedFolderId}
          onShowTrash={setShowTrash}
          onShowArchive={setShowArchive}
          onRenameTag={onRenameTag}
          onDeleteTag={onDeleteTag}
          onNavigate={onNavigate}
        />
      </nav>

      {/* FOOTER */}
      <div className="border-t border-border-subtle sidebar-glass px-2 py-1.5 flex items-center gap-1 shrink-0 sticky bottom-0 z-10">
        <button
          onClick={() => nav(() => openSettings())}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          <SettingsIcon size={14} />
          <span>{t('sidebar.settings')}</span>
        </button>
        <div className="flex-1" />
        <button
          onClick={() => nav(() => { setShowArchive(!showArchive); setShowTrash(false); setSelectedFolderId(undefined); setSelectedTag(undefined); })}
          className={cn(
            'flex items-center gap-1 px-1.5 py-1 rounded-lg text-xs transition-colors',
            showArchive ? 'bg-bg-active text-purple' : 'text-text-muted hover:bg-bg-hover hover:text-text-primary'
          )}
          title={t('sidebar.archive')}
          aria-label={t('sidebar.archive')}
        >
          <Archive size={14} />
          {noteCounts.archived > 0 && (
            <span className="font-mono text-[10px]">{noteCounts.archived}</span>
          )}
        </button>
        <button
          onClick={() => nav(() => { setShowTrash(!showTrash); setShowArchive(false); setSelectedFolderId(undefined); setSelectedTag(undefined); })}
          className={cn(
            'flex items-center gap-1 px-1.5 py-1 rounded-lg text-xs transition-colors',
            showTrash ? 'bg-bg-active text-purple' : 'text-text-muted hover:bg-bg-hover hover:text-text-primary'
          )}
          title={t('sidebar.trash')}
          aria-label={t('sidebar.trash')}
        >
          <Trash2 size={14} />
          {noteCounts.trashed > 0 && (
            <span className="font-mono text-[10px]">{noteCounts.trashed}</span>
          )}
        </button>
      </div>

      {/* Mobile-only links */}
      <div className="md:hidden border-t border-border-subtle px-2 py-2 space-y-0.5">
        <a
          href="https://github.com/peterhanily/threatcaddy"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          <Github size={16} />
          <span>{t('sidebar.github')}</span>
        </a>
        <a
          href="./threatcaddy-standalone.html"
          download
          className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          <Download size={16} />
          <span>{t('sidebar.downloadStandalone')}</span>
        </a>
        <a
          href="https://chromewebstore.google.com/detail/threatcaddy-%E2%80%94-quick-captu/lakelgngpkkaeinfdlnmifookbeeffbh"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          <Chrome size={16} />
          <span>{t('sidebar.chromeExtension')}</span>
        </a>
        <a
          href="https://threatcaddy.com/privacy.html"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          <Shield size={16} />
          <span>{t('sidebar.privacy')}</span>
        </a>
      </div>
    </nav>
  );
}

function workspacePanelLaunchViewForPanelId(panelId: string): WorkspacePanelLaunchView | null {
  const match = Object.entries(WORKSPACE_PANEL_LAUNCH_DESCRIPTORS)
    .find(([, descriptor]) => descriptor.panelId === panelId);
  return match ? match[0] as WorkspacePanelLaunchView : null;
}

function assistantWorkspacePanelLaunchViewForPanelId(panelId: string): AssistantWorkspacePanelLaunchView | null {
  const match = Object.entries(ASSISTANT_WORKSPACE_PANEL_LAUNCH_DESCRIPTORS)
    .find(([, descriptor]) => descriptor.panelId === panelId);
  return match ? match[0] as AssistantWorkspacePanelLaunchView : null;
}
