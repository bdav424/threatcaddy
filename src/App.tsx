import { useCallback, useMemo, useEffect, useRef, useState, lazy, Suspense, memo, type ReactNode } from 'react';
import type { CanvasEntityRef } from './components/Common/CanvasEntityBridge';
import { AppLayout } from './components/Layout/AppLayout';
import { BottomTabBar } from './components/Layout/BottomTabBar';
import { Header } from './components/Layout/Header';
import { Sidebar } from './components/Layout/Sidebar';
import {
  WORKSPACE_PANEL_LAUNCH_DESCRIPTORS,
  type WorkspacePanelLaunchView,
} from './components/WorkspacePanels/workspacePanelLaunch';
import {
  ASSISTANT_WORKSPACE_PANEL_LAUNCH_DESCRIPTORS,
  type AssistantWorkspacePanelLaunchView,
} from './components/CaddyAssistant/workspacePanelRegistrations';
import { NavigationProvider, useNavigation, savedNavState } from './contexts/NavigationContext';
import { InvestigationProvider, useInvestigation } from './contexts/InvestigationContext';
import { UIModalProvider, useUIModals } from './contexts/UIModalContext';
const NoteList = lazy(() => import('./components/Notes/NoteList').then(m => ({ default: m.NoteList })));
const NoteEditor = lazy(() => import('./components/Notes/NoteEditor').then(m => ({ default: m.NoteEditor })));
const JotsPanel = lazy(() => import('./components/Notes/JotsPanel').then(m => ({ default: m.JotsPanel })));
const MeetingImportModal = lazy(() => import('./components/Notes/MeetingImportModal').then(m => ({ default: m.MeetingImportModal })));
const JournalView = lazy(() => import('./components/Journal/JournalView').then(m => ({ default: m.JournalView })));
const TaskListView = lazy(() => import('./components/Tasks/TaskList').then(m => ({ default: m.TaskListView })));
const EvidenceView = lazy(() => import('./components/Evidence/EvidenceView').then(m => ({ default: m.EvidenceView })));
const ProductView = lazy(() => import('./components/Products/ProductView').then(m => ({ default: m.ProductView })));
const ExperimentalView = lazy(() => import('./components/Experimental/ExperimentalView').then(m => ({ default: m.ExperimentalView })));
const TimelineView = lazy(() => import('./components/Timeline/TimelineView').then(m => ({ default: m.TimelineView })));
const WhiteboardView = lazy(() => import('./components/Whiteboard/WhiteboardView').then(m => ({ default: m.WhiteboardView })));
const ActivityLogView = lazy(() => import('./components/Activity/ActivityLogView').then(m => ({ default: m.ActivityLogView })));
const QuickCapture = lazy(() => import('./components/Clips/QuickCapture').then(m => ({ default: m.QuickCapture })));
const InvestigationTemplatePicker = lazy(() => import('./components/Notes/InvestigationTemplatePicker').then(m => ({ default: m.InvestigationTemplatePicker })));
const NoteTemplateCreator = lazy(() => import('./components/Notes/NoteTemplateCreator').then(m => ({ default: m.NoteTemplateCreator })));
const SettingsPanel = lazy(() => import('./components/Settings/SettingsPanel').then(m => ({ default: m.SettingsPanel })));
import { useNotes } from './hooks/useNotes';
import { useTasks } from './hooks/useTasks';
import { useTimeline } from './hooks/useTimeline';
import { useTimelines } from './hooks/useTimelines';
import { useWhiteboards } from './hooks/useWhiteboards';
import { useStandaloneIOCs } from './hooks/useStandaloneIOCs';
import { useEvidenceItems } from './hooks/useEvidenceItems';
import { useChats } from './hooks/useChats';
import { useFolders } from './hooks/useFolders';
import { useTlpEscalation } from './hooks/useTlpEscalation';
import { useTags } from './hooks/useTags';
import { useSettings } from './hooks/useSettings';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useNoteTemplates } from './hooks/useNoteTemplates';
import { useReports } from './hooks/useReports';
import { usePlaybooks } from './hooks/usePlaybooks';
import { useIntegrations } from './hooks/useIntegrations';
const PlaybookPicker = lazy(() => import('./components/Playbooks/PlaybookPicker').then(m => ({ default: m.PlaybookPicker })));
const OperationNameGenerator = lazy(() => import('./components/Common/OperationNameGenerator').then(m => ({ default: m.OperationNameGenerator })));
import { useActivityLog } from './hooks/useActivityLog';
import { ActivityLogContext } from './hooks/ActivityLogContext';
import { ScreenshareContext } from './hooks/ScreenshareContext';
import { getEffectiveClsLevels, isAboveClsThreshold, detectClsLevelFromText, getInheritedClsLevel } from './lib/classification';
import { effectiveTlpLevel } from './lib/tlp-inspector';
import { clipBuffer } from './lib/clipBuffer';
import { formatBytes, openFilePicker, getDroppedFiles, dispatchFile, type FileOpenDetail } from './lib/file-handler';
import { hasPendingChanges } from './lib/pending-changes';
import { useInvestigationData } from './hooks/useInvestigationData';
import type { ConfidenceLevel, EvidenceItem, IOCType, Note, NoteTemplate, NoteType, Task, TimelineEvent, ChatThread, ChatAttachment, StandaloneIOC, ViewMode } from './types';
import { DEFAULT_QUICK_LINKS } from './types';
const DashboardView = lazy(() => import('./components/Dashboard/DashboardView').then(m => ({ default: m.DashboardView })));
import { FileText, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from './lib/utils';
import { resolveBuiltinTemplateId } from './lib/builtin-templates';
import { exportJSON, importJSON, mergeImportJSON, downloadFile, exportInvestigationJSON } from './lib/export';
import { ConfirmDialog } from './components/Common/ConfirmDialog';
const SearchOverlay = lazy(() => import('./components/Search/SearchOverlay').then(m => ({ default: m.SearchOverlay })));
import { extractIOCs, mergeIOCAnalysis } from './lib/ioc-extractor';
import { buildEvidenceItemDrafts, evidenceFileKeyFromFile, evidenceFileKeyFromItem, findDuplicateEvidenceItemIds, MAX_EVIDENCE_IMPORT_FILES } from './lib/evidence-import';
import { extractEvidenceTableIOCCandidates, type EvidenceTableIOCCandidate } from './lib/evidence-ioc-candidates';
import { BUILTIN_PRODUCT_BASELINES, importProductBaselinePackage, isProductBaselineTemplate, isProductNote, PRODUCT_NOTE_TAG, PRODUCT_DRAFT_TAG } from './lib/product-baselines';
import { generateSampleInvestigation, isSampleEntity } from './lib/sample-investigation';
import { db } from './db';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import { ActiveFilterBar } from './components/Common/ActiveFilterBar';
const InvestigationDetailPanel = lazy(() => import('./components/Investigation/InvestigationDetailPanel').then(m => ({ default: m.InvestigationDetailPanel })));
const GraphView = lazy(() => import('./components/Graph/GraphView').then(m => ({ default: m.GraphView })));
const ChatView = lazy(() => import('./components/Chat/ChatView').then(m => ({ default: m.ChatView })));
const IOCStatsView = lazy(() => import('./components/Analysis/IOCStatsView').then(m => ({ default: m.IOCStatsView })));
const StandaloneIOCForm = lazy(() => import('./components/Analysis/StandaloneIOCForm').then(m => ({ default: m.StandaloneIOCForm })));

const TrashArchiveView = lazy(() => import('./components/TrashArchive/TrashArchiveView').then(m => ({ default: m.TrashArchiveView })));
const InvestigationsHub = lazy(() => import('./components/Investigations/InvestigationsHub').then(m => ({ default: m.InvestigationsHub })));
const CreateInvestigationModal = lazy(() => import('./components/Investigations/CreateInvestigationModal').then(m => ({ default: m.CreateInvestigationModal })));
import { useCaddyAgent } from './hooks/useCaddyAgent';
import { useAgentProfiles } from './hooks/useAgentProfiles';
import { useAgentDeployments } from './hooks/useAgentDeployments';
import { useServerAgents } from './hooks/useServerAgents';
import { useTour } from './hooks/useTour';
import { TourOverlay, TourGlow } from './components/Tour/TourOverlay';
import { TourTooltip } from './components/Tour/TourTooltip';
const DemoWelcomeModal = lazy(() => import('./components/Common/DemoWelcomeModal').then(m => ({ default: m.DemoWelcomeModal })));
const DataImportModal = lazy(() => import('./components/Import/DataImportModal').then(m => ({ default: m.DataImportModal })));
import type { ImportResult } from './lib/data-import';

function normalizeInvestigationName(name?: string): string {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}
import { ToastProvider, useToast } from './contexts/ToastContext';
import { ChatStreamProvider } from './contexts/ChatStreamContext';
import { useTranslation } from 'react-i18next';
import { ToastContainer } from './components/Common/Toast';
import { generateInvestigationReport, printReport } from './lib/report';
import { useIsMobile } from './hooks/useIsMobile';
const ExecDashboard = lazy(() => import('./components/ExecMode/ExecDashboard').then(m => ({ default: m.ExecDashboard })));
import { ShareReceiver } from './components/ExecMode/ShareReceiver';
const ShareDialog = lazy(() => import('./components/ExecMode/ShareDialog').then(m => ({ default: m.ShareDialog })));
import type { SharePayload, InvestigationBundle } from './lib/share';
import { AuthProvider, useAuth } from './contexts/AuthContext';
const ReportCaddyView = lazy(() => import('./components/ReportCaddy/ReportCaddyView').then(m => ({ default: m.ReportCaddyView })));
const AppWorkspaceShell = lazy(() => import('./components/WorkspacePanels/AppWorkspaceShell').then(m => ({ default: m.AppWorkspaceShell })));
const VirtualCaddyWorkspace = lazy(() => import('./components/VirtualCaddy/VirtualCaddyWorkspace').then(m => ({ default: m.VirtualCaddyWorkspace })));
const VirtualCaddyPanel = lazy(() => import('./components/VirtualCaddy/VirtualCaddyPanel').then(m => ({ default: m.VirtualCaddyPanel })));
const VirtualCaddyDetonationReview = lazy(() => import('./components/VirtualCaddy/VirtualCaddyDetonationReview').then(m => ({ default: m.VirtualCaddyDetonationReview })));
const VirtualCaddySandbox = lazy(() => import('./components/VirtualCaddy/VirtualCaddySandbox').then(m => ({ default: m.VirtualCaddySandbox })));
const NetworkMapPanel = lazy(() => import('./components/NetMap/NetworkMapPanel').then(m => ({ default: m.NetworkMapPanel })));
const NetMapWorkspace = lazy(() => import('./components/NetMap/NetMapWorkspace').then(m => ({ default: m.NetMapWorkspace })));

type WorkspacePanelLaunchRequest = {
  view: WorkspacePanelLaunchView;
  requestId: number;
};

type AssistantWorkspacePanelLaunchRequest = {
  view: AssistantWorkspacePanelLaunchView;
  requestId: number;
};
const AgentPanel = lazy(() => import('./components/Agent/AgentPanel').then(m => ({ default: m.AgentPanel })));
const AgentDashboard = lazy(() => import('./components/Agent/AgentDashboard').then(m => ({ default: m.AgentDashboard })));
const ConflictDialog = lazy(() => import('./components/Common/ConflictDialog').then(m => ({ default: m.ConflictDialog })));
const KeyboardShortcutsPanel = lazy(() => import('./components/Common/KeyboardShortcutsPanel').then(m => ({ default: m.KeyboardShortcutsPanel })));
const ServerOnboardingModal = lazy(() => import('./components/Settings/ServerOnboardingModal').then(m => ({ default: m.ServerOnboardingModal })));
import { installSyncHooks, initLocalOnlyFlags } from './lib/sync-middleware';
import { autoEnrichImportedIOCs } from './lib/ioc-auto-enrichment';
import { upsertIOCObservations } from './lib/ioc-observations';

// Install Dexie hooks once at module load so every write is captured
installSyncHooks();
initLocalOnlyFlags();
import { useLoggedActions } from './hooks/useLoggedActions';
import { useServerSync } from './hooks/useServerSync';
import { useRemoteInvestigations } from './hooks/useRemoteInvestigations';
import { SyncPassphrasePrompt } from './components/Sync/SyncPassphrasePrompt';
import { usePushNotifications } from './hooks/usePushNotifications';
import { useUpcomingMeetings } from './hooks/useUpcomingMeetings';
import { useAlertSchedule } from './hooks/useAlertSchedule';
import { AlertGlowPanel } from './components/Alerts/AlertGlowPanel';
import { useSlackDMs } from './hooks/useSlackDMs';
import { useSlackSync } from './hooks/useSlackSync';
import { useDmAlerts } from './hooks/useDmAlerts';

const VALID_RASTER_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/avif']);

// ─── NetMap tabbed view ───────────────────────────────────────────────────────
// Combines the streaming discovery panel (NetworkMapPanel) and the legacy
// ARP/ping workspace (NetMapWorkspace) in a two-tab layout under one nav entry.

function NetMapTabView() {
  const [tab, setTab] = useState<'scan' | 'legacy'>('scan');
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="shrink-0 flex border-b border-border-subtle/50 bg-bg-primary/80">
        {(['scan', 'legacy'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-[12px] font-semibold transition-colors border-b-2 ${
              tab === t
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            {t === 'scan' ? 'Network Map' : 'Quick Scan'}
          </button>
        ))}
      </div>
      <Suspense fallback={<div className="flex flex-1 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>}>
        {tab === 'scan' ? <NetworkMapPanel /> : <NetMapWorkspace />}
      </Suspense>
    </div>
  );
}

// ─── VirtualCaddy tabbed view ─────────────────────────────────────────────────
// Combines the file-watcher workspace (VirtualCaddyWorkspace), the static analysis
// job panel (VirtualCaddyPanel), the Detonation Review artifact viewer
// (VirtualCaddyDetonationReview), and the VM Sandbox orchestrator (VirtualCaddySandbox)
// in a four-tab layout under one nav entry.

type VirtualCaddyTab = 'analyze' | 'watch' | 'review' | 'sandbox';

const VIRTUALCADDY_TAB_LABEL: Record<VirtualCaddyTab, string> = {
  analyze: 'Static Analysis',
  watch: 'File Watch',
  review: 'Detonation Review',
  sandbox: 'VM Sandbox',
};

function VirtualCaddyTabView() {
  const [tab, setTab] = useState<VirtualCaddyTab>('analyze');
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="shrink-0 flex border-b border-border-subtle/50 bg-bg-primary/80">
        {(['analyze', 'watch', 'review', 'sandbox'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-[12px] font-semibold transition-colors border-b-2 ${
              tab === t
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            {VIRTUALCADDY_TAB_LABEL[t]}
          </button>
        ))}
      </div>
      {/* Panel content */}
      <Suspense fallback={<div className="flex flex-1 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>}>
        {tab === 'analyze' ? <VirtualCaddyPanel />
          : tab === 'watch' ? <VirtualCaddyWorkspace />
          : tab === 'review' ? <VirtualCaddyDetonationReview />
          : <VirtualCaddySandbox />}
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ChatStreamProvider>
          <AppDataLayer />
        </ChatStreamProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

// ─── AppDataLayer ─────────────────────────────────────────────────────
// Calls data/server hooks and renders: InvestigationProvider → NavigationBridge → UIModalProvider → AppInner

function AppDataLayer() {
  const { settings, updateSettings, toggleTheme } = useSettings();
  const { addToast } = useToast();
  const { t: tt } = useTranslation('toast');
  const notes = useNotes();
  const tasks = useTasks();
  const timeline = useTimeline();
  const { timelines, createTimeline, updateTimeline, deleteTimeline, reload: reloadTimelines } = useTimelines();
  const { whiteboards, createWhiteboard, updateWhiteboard, deleteWhiteboard, trashWhiteboard, restoreWhiteboard, toggleArchiveWhiteboard, emptyTrashWhiteboards, getFilteredWhiteboards, whiteboardCounts, reload: reloadWhiteboards } = useWhiteboards();
  const standaloneIOCsHook = useStandaloneIOCs();
  const evidenceItemsHook = useEvidenceItems();
  const chatsHook = useChats();
  const { folders, loading: foldersLoading, createFolder, findOrCreateFolder, updateFolder, deleteFolder, deleteFolderWithContents, trashFolderContents, archiveFolder, unarchiveFolder, reload: reloadFolders } = useFolders();
  const { tags, createTag, updateTag, deleteTag, reload: reloadTags } = useTags();

  // Flattened for a whiteboard canvas's "Add entity" picker (entity bridge) —
  // WhiteboardEditor doesn't import Note/Task/StandaloneIOC directly, it only
  // knows this narrower shape, same pattern as onTearToInvestigation.
  const canvasEntities = useMemo<CanvasEntityRef[]>(() => [
    ...notes.notes.filter((n) => !n.trashed).map((n): CanvasEntityRef => ({ id: n.id, type: 'note', label: n.title, clsLevel: n.clsLevel, folderId: n.folderId })),
    ...tasks.tasks.filter((t) => !t.trashed).map((t): CanvasEntityRef => ({ id: t.id, type: 'task', label: t.title, clsLevel: t.clsLevel, folderId: t.folderId })),
    ...standaloneIOCsHook.iocs.filter((i) => !i.trashed).map((i): CanvasEntityRef => ({ id: i.id, type: 'ioc', label: i.value, clsLevel: i.clsLevel, folderId: i.folderId })),
  ], [notes.notes, tasks.tasks, standaloneIOCsHook.iocs]);
  const noteTemplatesHook = useNoteTemplates();
  const reportsHook = useReports();
  const playbooksHook = usePlaybooks();
  const integrationsHook = useIntegrations();

  const activityLog = useActivityLog();

  // ─── Team Server Integration ───────────────────────────────────
  const auth = useAuth();
  const { remoteInvestigations, loading: remoteLoading, refresh: refreshRemote } = useRemoteInvestigations(auth.connected);

  const handleFolderInvite = useCallback(() => {
    refreshRemote();
  }, [refreshRemote]);

  const { presenceUsers, syncConflicts, setSyncConflicts, handleResolveConflict, handleResolveAllConflicts } = useServerSync(auth, {
    notes: notes.reload,
    tasks: tasks.reload,
    timeline: timeline.reload,
    timelines: reloadTimelines,
    whiteboards: reloadWhiteboards,
    standaloneIOCs: standaloneIOCsHook.reload,
    evidenceItems: evidenceItemsHook.reload,
    chats: chatsHook.reload,
    folders: reloadFolders,
    tags: reloadTags,
    onSyncPullComplete: refreshRemote,
  }, handleFolderInvite);

  /** Reload every data hook — use after bulk operations that touch multiple tables. */
  const reloadAll = useCallback(() => {
    reloadFolders();
    notes.reload();
    tasks.reload();
    timeline.reload();
    reloadTimelines();
    reloadWhiteboards();
    standaloneIOCsHook.reload();
    evidenceItemsHook.reload();
    chatsHook.reload();
    reloadTags();
    noteTemplatesHook.reload();
    playbooksHook.reload();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadFolders, notes.reload, tasks.reload, timeline.reload, reloadTimelines, reloadWhiteboards, standaloneIOCsHook.reload, evidenceItemsHook.reload, chatsHook.reload, reloadTags, noteTemplatesHook.reload, playbooksHook.reload]);

  // Reload folders when agent tools modify folder state (e.g. deploy_agent enables agentEnabled)
  useEffect(() => {
    const handler = () => reloadFolders();
    window.addEventListener('tc-folders-changed', handler);
    return () => window.removeEventListener('tc-folders-changed', handler);
  }, [reloadFolders]);

  // Reload UI when external agents write data via the agent bridge
  useEffect(() => {
    const handler = () => { notes.reload(); tasks.reload(); timeline.reload(); standaloneIOCsHook.reload(); evidenceItemsHook.reload(); chatsHook.reload(); reloadTags(); };
    window.addEventListener('threatcaddy:entities-changed', handler);
    return () => window.removeEventListener('threatcaddy:entities-changed', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes.reload, tasks.reload, timeline.reload, standaloneIOCsHook.reload, evidenceItemsHook.reload]);

  const syncedFolderIds = useMemo(() => {
    const localIds = new Set(folders.map(f => f.id));
    return new Set(remoteInvestigations.filter(r => localIds.has(r.folderId)).map(r => r.folderId));
  }, [folders, remoteInvestigations]);

  const isMobile = useIsMobile();

  // Compute safe default view from settings for NavigationProvider
  const safeDefaultView = settings.defaultView === 'dashboard' || settings.defaultView === 'workspace' || settings.defaultView === 'notes' || settings.defaultView === 'tasks' || settings.defaultView === 'evidence' || settings.defaultView === 'products' || settings.defaultView === 'experimental' || settings.defaultView === 'timeline' || settings.defaultView === 'whiteboard' || settings.defaultView === 'activity' || settings.defaultView === 'graph' || settings.defaultView === 'ioc-stats' || settings.defaultView === 'chat' || settings.defaultView === 'caddyassistant' || settings.defaultView === 'cademail' || settings.defaultView === 'calendarcaddy' || settings.defaultView === 'reportcaddy' || settings.defaultView === 'agent' || settings.defaultView === 'investigations' || settings.defaultView === 'virtualcaddy' || settings.defaultView === 'netmap' ? settings.defaultView : 'notes';

  return (
    <InvestigationProvider
      folders={folders}
      tags={tags}
      authConnected={auth.connected}
      initialSelectedFolderId={savedNavState?.selectedFolderId}
      onReloadAll={reloadAll}
      onRefreshRemote={refreshRemote}
    >
      <UIModalProvider
        authConnected={auth.connected}
        authServerUrl={auth.serverUrl ?? undefined}
        isMobile={isMobile}
      >
        <NavigationBridge
          folders={folders}
          timelineEvents={timeline.events}
          initialSettings={settings}
          updateSettings={updateSettings}
          defaultView={safeDefaultView}
        >
          <AppInner
            settings={settings}
            updateSettings={updateSettings}
            toggleTheme={toggleTheme}
            addToast={addToast}
            tt={tt}
            notes={notes}
            tasks={tasks}
            timeline={timeline}
            timelines={timelines}
            createTimeline={createTimeline}
            updateTimeline={updateTimeline}
            deleteTimeline={deleteTimeline}
            reloadTimelines={reloadTimelines}
            whiteboards={whiteboards}
            createWhiteboard={createWhiteboard}
            updateWhiteboard={updateWhiteboard}
            deleteWhiteboard={deleteWhiteboard}
            trashWhiteboard={trashWhiteboard}
            restoreWhiteboard={restoreWhiteboard}
            toggleArchiveWhiteboard={toggleArchiveWhiteboard}
            emptyTrashWhiteboards={emptyTrashWhiteboards}
            getFilteredWhiteboards={getFilteredWhiteboards}
            whiteboardCounts={whiteboardCounts}
            reloadWhiteboards={reloadWhiteboards}
            standaloneIOCsHook={standaloneIOCsHook}
            evidenceItemsHook={evidenceItemsHook}
            reportsHook={reportsHook}
            chatsHook={chatsHook}
            canvasEntities={canvasEntities}
            folders={folders}
            foldersLoading={foldersLoading}
            createFolder={createFolder}
            findOrCreateFolder={findOrCreateFolder}
            updateFolder={updateFolder}
            deleteFolder={deleteFolder}
            deleteFolderWithContents={deleteFolderWithContents}
            trashFolderContents={trashFolderContents}
            archiveFolder={archiveFolder}
            unarchiveFolder={unarchiveFolder}
            reloadFolders={reloadFolders}
            tags={tags}
            createTag={createTag}
            updateTag={updateTag}
            deleteTag={deleteTag}
            reloadTags={reloadTags}
            noteTemplatesHook={noteTemplatesHook}
            playbooksHook={playbooksHook}
            integrationsHook={integrationsHook}
            activityLog={activityLog}
            auth={auth}
            remoteInvestigations={remoteInvestigations}
            remoteLoading={remoteLoading}
            refreshRemote={refreshRemote}
            presenceUsers={presenceUsers}
            syncConflicts={syncConflicts}
            setSyncConflicts={setSyncConflicts}
            handleResolveConflict={handleResolveConflict}
            handleResolveAllConflicts={handleResolveAllConflicts}
            reloadAll={reloadAll}
            syncedFolderIds={syncedFolderIds}
            isMobile={isMobile}
          />
        </NavigationBridge>
      </UIModalProvider>
    </InvestigationProvider>
  );
}

// ─── NavigationBridge ─────────────────────────────────────────────────
// Reads InvestigationContext to pass selectedFolderId & clearFilters to NavigationProvider

function NavigationBridge({ folders, timelineEvents, initialSettings, updateSettings, defaultView, children }: {
  folders: import('./types').Folder[];
  timelineEvents: import('./types').TimelineEvent[];
  initialSettings: Pick<import('./types').Settings, 'editorMode' | 'taskViewMode' | 'noteListCollapsed'>;
  updateSettings: (s: Partial<import('./types').Settings>) => void;
  defaultView: import('./types').ViewMode;
  children: ReactNode;
}) {
  const { selectedFolderId, clearFilters, setSelectedFolderId } = useInvestigation();
  const uiModals = useUIModals();

  return (
    <NavigationProvider
      folders={folders}
      selectedFolderId={selectedFolderId}
      timelineEvents={timelineEvents}
      initialSettings={initialSettings}
      updateSettings={updateSettings}
      onClearFilters={clearFilters}
      onCloseSettings={uiModals.closeSettings}
      onRestoreFolderId={setSelectedFolderId}
      defaultView={defaultView}
    >
      {children}
    </NavigationProvider>
  );
}

// ─── AppInner Props ───────────────────────────────────────────────────
// Entity hooks and other data passed down from AppDataLayer.
// Using ReturnType for hooks to keep this type in sync automatically.

type AppInnerProps = {
  settings: ReturnType<typeof useSettings>['settings'];
  updateSettings: ReturnType<typeof useSettings>['updateSettings'];
  toggleTheme: ReturnType<typeof useSettings>['toggleTheme'];
  addToast: ReturnType<typeof useToast>['addToast'];
  tt: ReturnType<typeof useTranslation>['t'];
  notes: ReturnType<typeof useNotes>;
  tasks: ReturnType<typeof useTasks>;
  timeline: ReturnType<typeof useTimeline>;
  timelines: ReturnType<typeof useTimelines>['timelines'];
  createTimeline: ReturnType<typeof useTimelines>['createTimeline'];
  updateTimeline: ReturnType<typeof useTimelines>['updateTimeline'];
  deleteTimeline: ReturnType<typeof useTimelines>['deleteTimeline'];
  reloadTimelines: ReturnType<typeof useTimelines>['reload'];
  whiteboards: ReturnType<typeof useWhiteboards>['whiteboards'];
  createWhiteboard: ReturnType<typeof useWhiteboards>['createWhiteboard'];
  updateWhiteboard: ReturnType<typeof useWhiteboards>['updateWhiteboard'];
  deleteWhiteboard: ReturnType<typeof useWhiteboards>['deleteWhiteboard'];
  trashWhiteboard: ReturnType<typeof useWhiteboards>['trashWhiteboard'];
  restoreWhiteboard: ReturnType<typeof useWhiteboards>['restoreWhiteboard'];
  toggleArchiveWhiteboard: ReturnType<typeof useWhiteboards>['toggleArchiveWhiteboard'];
  emptyTrashWhiteboards: ReturnType<typeof useWhiteboards>['emptyTrashWhiteboards'];
  getFilteredWhiteboards: ReturnType<typeof useWhiteboards>['getFilteredWhiteboards'];
  whiteboardCounts: ReturnType<typeof useWhiteboards>['whiteboardCounts'];
  reloadWhiteboards: ReturnType<typeof useWhiteboards>['reload'];
  standaloneIOCsHook: ReturnType<typeof useStandaloneIOCs>;
  evidenceItemsHook: ReturnType<typeof useEvidenceItems>;
  reportsHook: ReturnType<typeof useReports>;
  chatsHook: ReturnType<typeof useChats>;
  canvasEntities: CanvasEntityRef[];
  folders: ReturnType<typeof useFolders>['folders'];
  foldersLoading: boolean;
  createFolder: ReturnType<typeof useFolders>['createFolder'];
  findOrCreateFolder: ReturnType<typeof useFolders>['findOrCreateFolder'];
  updateFolder: ReturnType<typeof useFolders>['updateFolder'];
  deleteFolder: ReturnType<typeof useFolders>['deleteFolder'];
  deleteFolderWithContents: ReturnType<typeof useFolders>['deleteFolderWithContents'];
  trashFolderContents: ReturnType<typeof useFolders>['trashFolderContents'];
  archiveFolder: ReturnType<typeof useFolders>['archiveFolder'];
  unarchiveFolder: ReturnType<typeof useFolders>['unarchiveFolder'];
  reloadFolders: ReturnType<typeof useFolders>['reload'];
  tags: ReturnType<typeof useTags>['tags'];
  createTag: ReturnType<typeof useTags>['createTag'];
  updateTag: ReturnType<typeof useTags>['updateTag'];
  deleteTag: ReturnType<typeof useTags>['deleteTag'];
  reloadTags: ReturnType<typeof useTags>['reload'];
  noteTemplatesHook: ReturnType<typeof useNoteTemplates>;
  playbooksHook: ReturnType<typeof usePlaybooks>;
  integrationsHook: ReturnType<typeof useIntegrations>;
  activityLog: ReturnType<typeof useActivityLog>;
  auth: ReturnType<typeof useAuth>;
  remoteInvestigations: ReturnType<typeof useRemoteInvestigations>['remoteInvestigations'];
  remoteLoading: boolean;
  refreshRemote: ReturnType<typeof useRemoteInvestigations>['refresh'];
  presenceUsers: ReturnType<typeof useServerSync>['presenceUsers'];
  syncConflicts: ReturnType<typeof useServerSync>['syncConflicts'];
  setSyncConflicts: ReturnType<typeof useServerSync>['setSyncConflicts'];
  handleResolveConflict: ReturnType<typeof useServerSync>['handleResolveConflict'];
  handleResolveAllConflicts: ReturnType<typeof useServerSync>['handleResolveAllConflicts'];
  reloadAll: () => void;
  syncedFolderIds: Set<string>;
  isMobile: boolean;
};

// ─── AppInner ─────────────────────────────────────────────────────────
// Consumes context hooks, contains filtering, callbacks, and JSX
// Wrapped with React.memo so it only re-renders when its props actually change,
// preventing cascading re-renders when unrelated hooks in AppDataLayer update.

const AppInner = memo(function AppInner({
  settings, updateSettings, toggleTheme,
  addToast, tt,
  notes, tasks, timeline,
  timelines, createTimeline, updateTimeline, deleteTimeline, reloadTimelines,
  whiteboards, createWhiteboard, updateWhiteboard, deleteWhiteboard,
  trashWhiteboard, restoreWhiteboard, toggleArchiveWhiteboard,
  emptyTrashWhiteboards, getFilteredWhiteboards, whiteboardCounts, reloadWhiteboards,
  standaloneIOCsHook, evidenceItemsHook, reportsHook, chatsHook, canvasEntities,
  folders, foldersLoading, createFolder, findOrCreateFolder, updateFolder, deleteFolder,
  deleteFolderWithContents, trashFolderContents, archiveFolder, unarchiveFolder, reloadFolders,
  tags, createTag, updateTag, deleteTag, reloadTags,
  noteTemplatesHook, playbooksHook, integrationsHook,
  activityLog, auth,
  remoteInvestigations, remoteLoading,
  presenceUsers, syncConflicts, setSyncConflicts, handleResolveConflict, handleResolveAllConflicts,
  reloadAll, syncedFolderIds, isMobile,
}: AppInnerProps) {
  // ─── Context hooks ────────────────────────────────────────────────
  const nav = useNavigation();
  const inv = useInvestigation();
  const ui = useUIModals();
  const { t: tExec } = useTranslation('exec');
  const [startupGraceExpired, setStartupGraceExpired] = useState(false);
  const [syncPassphraseDismissed, setSyncPassphraseDismissed] = useState(false);
  const [pendingChatDraft, setPendingChatDraft] = useState<{
    id: string;
    threadId: string;
    text: string;
    attachments?: ChatAttachment[];
  } | null>(null);
  const [showInvestigationTemplatePicker, setShowInvestigationTemplatePicker] = useState(false);
  const [showNoteTemplateCreator, setShowNoteTemplateCreator] = useState(false);
  const [showJotsPanel, setShowJotsPanel] = useState(false);
  const [showMeetingImport, setShowMeetingImport] = useState(false);
  const [whisperEndpoint, setWhisperEndpoint] = useState('');
  const [fortuneIntMode, setFortuneIntMode] = useState(false);
  const [fortuneIntOpenRequest, setFortuneIntOpenRequest] = useState(0);

  usePushNotifications({
    serverUrl: auth.serverUrl,
    connected: auth.connected,
    getAccessToken: auth.getAccessToken,
  });

  const upcomingMeetings = useUpcomingMeetings(settings.alertLeadMinutes ?? 15);
  const { visible: alertItems, dismiss: dismissAlert, acknowledge: acknowledgeAlert } = useAlertSchedule(
    upcomingMeetings,
    settings.alertLeadMinutes ?? 15,
    settings.alertEnabled !== false,
  );

  const slackCredRefId = settings.slackAccount?.credRefId ?? null;
  useSlackSync(slackCredRefId);
  const slackDmThreads = useSlackDMs();
  const {
    visible: dmAlertItems,
    dismissDm,
    acknowledgeDm,
  } = useDmAlerts(
    slackDmThreads,
    (settings.slackDmAlertsEnabled !== false) && Boolean(slackCredRefId),
    settings.slackDmSnoozeDuration ?? 2,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setStartupGraceExpired(true), 6000);
    return () => window.clearTimeout(timer);
  }, []);

  // Load Whisper endpoint from safeStorage (desktop only)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.threatcaddyNotes) return;
    window.threatcaddyNotes.getWhisperEndpoint().then((url) => {
      if (url) setWhisperEndpoint(url);
    }).catch(() => { /* ignore */ });
  }, []);

  // Destructure frequently-used context values
  const {
    activeView, setActiveView, selectedNoteId, setSelectedNoteId,
    selectedTimelineId, setSelectedTimelineId, selectedWhiteboardId, setSelectedWhiteboardId,
    selectedChatThreadId, setSelectedChatThreadId,
    sort, setSort, editorMode, setEditorMode,
    noteListWidth, noteListCollapsed,
    noteListDragging, notesContainerRef, noteNavGraceRef,
    setPendingNewTask, pendingNewEvent, setPendingNewEvent,
    navigateTo, handleNoteListDragStart, toggleNoteListCollapse, handleToggleEditorMode,
    initialDeepLink,
  } = nav;

  const {
    selectedFolderId, setSelectedFolderId,
    investigationMode, setInvestigationMode,
    selectedTag, setSelectedTag,
    showTrash, setShowTrash, showArchive, setShowArchive,
    selectedIOCTypes, setSelectedIOCTypes,
    editingFolderId, setEditingFolderId,
    selectedFolder, selectedTagObj, editingFolder,
    investigationMembers,
    syncingFolderId, confirmUnsyncId, setConfirmUnsyncId,
    handleOpenInvestigation: ctxHandleOpenInvestigation, handleSyncLocally, handleUnsyncConfirmed, handleUnsync,
  } = inv;

  // Auto-escalate folder TLP when any child entity carries a more restrictive
  // classification. Fires reactively for the currently open investigation.
  useTlpEscalation(selectedFolderId);

  const {
    showSettings, settingsInitialTab, openSettings, closeSettings,
    showQuickCapture, setShowQuickCapture,
    showPlaybookPicker, setShowPlaybookPicker,
    playbookApplyFolderId, setPlaybookApplyFolderId,
    showIOCForm, setShowIOCForm,
    showDataImport, setShowDataImport,
    searchOverlayOpen, setSearchOverlayOpen,
    showDemoModal, setShowDemoModal,
    showCreateInvestigationModal, setShowCreateInvestigationModal,
    showNameGenerator, setShowNameGenerator,
    showShortcutsPanel, setShowShortcutsPanel,
    mobileSidebarOpen, setMobileSidebarOpen,
    forceAnalystMode, setForceAnalystMode,
    screenshareMaxLevel,
    pendingImportFile, setPendingImportFile,
    shareLinkPayload, setShareLinkPayload,
    shareData, setShareData,
    showServerOnboarding, serverOnboardingName, dismissServerOnboarding,
    showFileEncryptionWarning, fileEncryptionDismissed, dismissFileEncryptionWarning,
  } = ui;

  const resolveLocalFolderForRemote = useCallback((folderId: string) => {
    const remote = remoteInvestigations.find((item) => item.folderId === folderId);
    if (!remote) return undefined;
    const remoteName = normalizeInvestigationName(remote.folder.name);
    if (!remoteName) return undefined;
    const matches = folders.filter((folder) => normalizeInvestigationName(folder.name) === remoteName);
    if (matches.length === 0) return undefined;
    return matches.find((folder) => notes.notes.some((note) => note.folderId === folder.id && !note.trashed && !note.archived)) || matches[0];
  }, [folders, notes.notes, remoteInvestigations]);

  // Wrap InvestigationContext's handleOpenInvestigation to add navigation
  // (InvestigationProvider can't receive navigateTo because NavigationProvider is nested inside it)
  const handleOpenInvestigation = useCallback((folderId: string, mode: import('./types').InvestigationDataMode) => {
    const localFolder = mode === 'remote' ? resolveLocalFolderForRemote(folderId) : undefined;
    ctxHandleOpenInvestigation(localFolder?.id ?? folderId, localFolder ? 'local' : mode);
    navigateTo('notes');
  }, [ctxHandleOpenInvestigation, navigateTo, resolveLocalFolderForRemote]);

  const tour = useTour({
    onComplete: () => updateSettings({ tourCompleted: true }),
    onNavigate: (view) => setActiveView(view),
    onShowSettings: (show) => { if (show) openSettings(); else closeSettings(); },
  });

  // Instrumented wrappers for activity logging
  const {
    loggedCreateNote, loggedTrashNote, loggedRestoreNote,
    loggedTogglePin, loggedToggleArchive,
    loggedCreateTask, loggedDeleteTask, loggedToggleComplete,
    loggedTrashTask, loggedRestoreTask, loggedToggleArchiveTask,
    loggedCreateEvent, loggedDeleteEvent, loggedToggleStar,
    loggedTrashEvent, loggedRestoreEvent, loggedToggleArchiveEvent,
    loggedCreateTimeline, loggedDeleteTimeline,
    loggedCreateWhiteboard, loggedDeleteWhiteboard,
    loggedTrashWhiteboard, loggedRestoreWhiteboard, loggedToggleArchiveWhiteboard,
    loggedCreateIOC, loggedTrashIOC, loggedRestoreIOC,
    loggedToggleArchiveIOC, loggedDeleteIOC,
    loggedTrashEvidenceItem, loggedRestoreEvidenceItem,
    loggedToggleArchiveEvidenceItem, loggedDeleteEvidenceItem,
    loggedCreateFolder, loggedDeleteFolder,
    loggedArchiveFolder, loggedUnarchiveFolder,
    loggedCreateTag, loggedDeleteTag,
    loggedCreateChatThread,
    emptyAllTrash,
  } = useLoggedActions(
    activityLog.log,
    notes,
    tasks,
    timeline,
    { timelines, createTimeline, deleteTimeline },
    { whiteboards, createWhiteboard, deleteWhiteboard, trashWhiteboard, restoreWhiteboard, toggleArchiveWhiteboard, emptyTrashWhiteboards, reload: reloadWhiteboards },
    standaloneIOCsHook,
    evidenceItemsHook,
    { createThread: chatsHook.createThread, reload: chatsHook.reload },
    { folders, createFolder, deleteFolder, deleteFolderWithContents, trashFolderContents, archiveFolder, unarchiveFolder },
    { tags, createTag, deleteTag },
  );

  const autoEnrichCreatedIOCs = useCallback((createdIOCs: StandaloneIOC[]) => {
    if (settings.tiAutoEnrichImportedIOCs === false || createdIOCs.length === 0) return;
    const executionOptions = auth.connected && auth.serverUrl
      ? { useServerProxy: { serverUrl: auth.serverUrl, getAccessToken: auth.getAccessToken } }
      : undefined;
    void autoEnrichImportedIOCs(createdIOCs, {
      maxIOCs: settings.tiAutoEnrichImportedIOCMax ?? 50,
      investigation: selectedFolder ? { id: selectedFolder.id, name: selectedFolder.name } : undefined,
      getInstallationsForIOCType: integrationsHook.getInstallationsForIOCType,
      addRun: integrationsHook.addRun,
      executionOptions,
      onComplete: (stats) => {
        standaloneIOCsHook.reload();
        if (stats.missingIntegration > 0 && stats.enriched === 0 && stats.errors === 0) {
          addToast(
            'warning',
            `Imported IOCs were extracted, but VirusTotal auto-check could not run because no enabled VirusTotal integration matched ${stats.missingIntegration} IOC${stats.missingIntegration === 1 ? '' : 's'}.`,
            7000,
          );
        } else if (stats.queued > 0) {
          addToast(
            stats.errors > 0 ? 'warning' : 'success',
            `VirusTotal auto-check finished for imported IOCs: ${stats.enriched} enriched, ${stats.errors} error${stats.errors === 1 ? '' : 's'}${stats.missingIntegration > 0 ? `, ${stats.missingIntegration} skipped without a matching VirusTotal integration` : ''}.`,
            5000,
          );
        }
      },
    });
  }, [addToast, auth.connected, auth.getAccessToken, auth.serverUrl, integrationsHook.addRun, integrationsHook.getInstallationsForIOCType, selectedFolder, settings.tiAutoEnrichImportedIOCMax, settings.tiAutoEnrichImportedIOCs, standaloneIOCsHook]);

  const loggedCreateIOCWithAuto = useCallback(async (partial?: Partial<StandaloneIOC>) => {
    const ioc = await loggedCreateIOC(partial);
    autoEnrichCreatedIOCs([ioc]);
    return ioc;
  }, [autoEnrichCreatedIOCs, loggedCreateIOC]);

  const handleUpdateNoteWithIOCObservation = useCallback((id: string, updates: Partial<Note>) => {
    notes.updateNote(id, updates);
    if (!updates.iocAnalysis?.iocs?.length) return;

    const note = notes.notes.find((candidate) => candidate.id === id);
    const folderId = updates.folderId ?? note?.folderId;
    void upsertIOCObservations(updates.iocAnalysis.iocs, {
      folderId,
      clsLevel: updates.clsLevel ?? note?.clsLevel,
      source: { kind: 'note', id, title: updates.title ?? note?.title },
      defaultConfidence: settings.tiDefaultConfidence as ConfidenceLevel | undefined,
    }).then((result) => {
      if (result.touched.length === 0) return;
      standaloneIOCsHook.reload();
      autoEnrichCreatedIOCs(result.touched);
    });
  }, [autoEnrichCreatedIOCs, notes, settings.tiDefaultConfidence, standaloneIOCsHook]);

  const demoProcessedRef = useRef(false);
  const shareProcessedRef = useRef(false);

  // Warn before closing tab with unsaved editor changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasPendingChanges()) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const effectiveClsLevels = useMemo(() => getEffectiveClsLevels(settings.tiClsLevels), [settings.tiClsLevels]);

  const loggedTrashChatThread = useCallback(async (id: string) => {
    const thread = chatsHook.threads.find((t) => t.id === id);
    await chatsHook.trashThread(id);
    activityLog.log('chat', 'trash', `Trashed chat thread "${thread?.title || 'Untitled'}"`, id, thread?.title);
    if (selectedChatThreadId === id) setSelectedChatThreadId(undefined);
  }, [chatsHook, activityLog, selectedChatThreadId, setSelectedChatThreadId]);

  const handleSearchNavigateToNote = useCallback((id: string) => {
    const openNote = async () => {
      noteNavGraceRef.current = true;
      const note = notes.notes.find((n) => n.id === id) || await db.notes.get(id);
      if (note) setInvestigationMode('local');
      setSelectedFolderId(note?.folderId);
      setSelectedTag(undefined);
      setShowTrash(!!note?.trashed);
      setShowArchive(!note?.trashed && !!note?.archived);
      setSelectedNoteId(id);
      setTimeout(() => { noteNavGraceRef.current = false; }, 2000);
    };
    void openNote();
    navigateTo('notes', { selectedNoteId: id });
  }, [navigateTo, noteNavGraceRef, notes.notes, setInvestigationMode, setSelectedFolderId, setSelectedNoteId, setSelectedTag, setShowArchive, setShowTrash]);

  useEffect(() => {
    if (investigationMode !== 'remote' || !selectedFolderId) return;
    if (folders.some((folder) => folder.id === selectedFolderId)) {
      setInvestigationMode('synced');
      return;
    }
    const localFolder = resolveLocalFolderForRemote(selectedFolderId);
    if (localFolder) {
      setSelectedFolderId(localFolder.id);
      setInvestigationMode('local');
    }
  }, [folders, investigationMode, resolveLocalFolderForRemote, selectedFolderId, setInvestigationMode, setSelectedFolderId]);

  // Resolve timeline deep-link once events are loaded
  const deepLinkTimelineResolved = useCallback(() => {
    if (initialDeepLink?.type !== 'event' || !timeline.events.length) return;
    const ev = timeline.events.find((e) => e.id === initialDeepLink.id);
    if (ev && !selectedTimelineId) setSelectedTimelineId(ev.timelineId);
  }, [timeline.events, selectedTimelineId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run when events load for deep-link resolution
  useEffect(deepLinkTimelineResolved, [timeline.events]);

  // Navigate in response to notification clicks
  useEffect(() => {
    const handler = (e: Event) => {
      const { type, postId, folderId } = (e as CustomEvent).detail ?? {};
      if ((type === 'mention' || type === 'reply' || type === 'reaction') && postId) {
        if (folderId) setSelectedFolderId(folderId);
        setActiveView('reportcaddy');
        window.dispatchEvent(new CustomEvent('caddyshack-select-post', { detail: { postId } }));
      } else if (type === 'invite' && folderId) {
        setSelectedFolderId(folderId);
        navigateTo('notes');
      }
    };
    window.addEventListener('notification-navigate', handler);
    return () => window.removeEventListener('notification-navigate', handler);
  }, [navigateTo, setSelectedFolderId]);

  // Reload hooks and navigate after integration creates entities in Dexie
  useEffect(() => {
    const handler = async (e: Event) => {
      const { noteId, iocId } = (e as CustomEvent).detail ?? {};
      if (noteId) {
        await notes.reload();
        handleSearchNavigateToNote(noteId);
      }
      if (iocId) {
        standaloneIOCsHook.reload();
      }
    };
    window.addEventListener('integration-entity-created', handler);
    return () => window.removeEventListener('integration-entity-created', handler);
  }, [notes, standaloneIOCsHook, handleSearchNavigateToNote]);

  // Listen for clip imports from the Chrome extension via postMessage
  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      // Only accept messages from our own window (extension injects script into this page)
      // event.source === window ensures only same-window postMessage is accepted,
      // blocking cross-window/cross-tab attacks even under file:// where origins are "null"
      if (event.source !== window) return;
      const isFileProtocol = window.location.protocol === 'file:';
      if (!isFileProtocol && event.origin !== window.location.origin) return;
      if (event.data?.type !== 'THREATCADDY_IMPORT_CLIPS' && event.data?.type !== 'BROWSERNOTES_IMPORT_CLIPS') return;
      const clips = event.data.clips;
      if (!Array.isArray(clips) || clips.length === 0) return;

      try {
        const folderCache = new Map<string, typeof folders[0]>();
        let lastEntityType: string = 'note';
        let lastEntityId: string | undefined;
        let lastFolderId: string | undefined;
        const entityTypesUsed = new Set<string>();

        let failedClips = 0;
        for (const clip of clips) {
          try {
          // Sanitize clip fields — only accept expected string/number types
          const rawContent = typeof clip.content === 'string' ? clip.content : '';
          const sourceUrl = typeof clip.sourceUrl === 'string' ? clip.sourceUrl : '';
          const sourceTitle = typeof clip.sourceTitle === 'string' ? clip.sourceTitle : '';
          const clipTitle = typeof clip.title === 'string' ? clip.title : '';
          const createdAt = typeof clip.createdAt === 'number' ? clip.createdAt : Date.now();
          const entityType = typeof clip.entityType === 'string' ? clip.entityType : 'note';
          const folderName = typeof clip.folderName === 'string' && clip.folderName.trim()
            ? clip.folderName.trim() : 'Clips';
          const clsLevel = typeof clip.clsLevel === 'string' && clip.clsLevel ? clip.clsLevel : undefined;

          // Resolve folder (cached)
          if (!folderCache.has(folderName)) {
            folderCache.set(folderName, await findOrCreateFolder(folderName));
          }
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- just set above
          const folder = folderCache.get(folderName)!;
          lastFolderId = folder.id;

          const timestamp = new Date(createdAt).toLocaleString();
          const content = `*Clipped ${timestamp}*\n\n${rawContent}`;
          const freshIOCs = extractIOCs(rawContent, {
            enabledTypes: settings.tiEnabledIOCTypes,
            defaultConfidence: settings.tiDefaultConfidence,
          });
          const iocAnalysis = mergeIOCAnalysis(undefined, freshIOCs);
          const iocTypes = [...new Set(freshIOCs.filter((i) => !i.dismissed).map((i) => i.type))];

          entityTypesUsed.add(entityType);

          if (entityType === 'task') {
            const task = await loggedCreateTask({
              title: clipTitle || rawContent.substring(0, 80) || 'Clip Task',
              description: content,
              folderId: folder.id,
              clsLevel: clsLevel || folder.clsLevel,
              status: 'todo',
              priority: 'none',
              iocAnalysis,
              iocTypes,
            });
            lastEntityId = task.id; lastEntityType = 'task';
          } else if (entityType === 'timeline-event') {
            const event = await loggedCreateEvent({
              title: clipTitle || rawContent.substring(0, 80) || 'Clip Event',
              description: content,
              source: sourceUrl || 'Extension clip',
              folderId: folder.id,
              clsLevel: clsLevel || folder.clsLevel,
              eventType: 'evidence',
              confidence: 'medium',
              timelineId: timelines[0]?.id || '',
              iocAnalysis,
              iocTypes,
            });
            lastEntityId = event.id; lastEntityType = 'timeline-event';
          } else {
            const note = await loggedCreateNote({
              title: sourceUrl || clipTitle || rawContent.substring(0, 80) || 'Clip',
              content,
              folderId: folder.id,
              clsLevel: clsLevel || folder.clsLevel,
              sourceUrl,
              sourceTitle,
              createdAt,
              iocAnalysis,
              iocTypes,
            });
            lastEntityId = note.id; lastEntityType = 'note';
          }
          } catch (clipErr) {
            console.error('Failed to import clip:', clipErr);
            failedClips++;
          }
        }
        if (failedClips > 0) {
          addToast('warning', tt('clip.importWarning', { count: failedClips }));
        }

        // Navigate to the appropriate view and select the latest entity
        if (lastFolderId) setSelectedFolderId(lastFolderId);
        if (entityTypesUsed.size === 1) {
          if (lastEntityType === 'task') {
            navigateTo('tasks');
          } else if (lastEntityType === 'timeline-event') {
            navigateTo('timeline');
          } else {
            if (lastEntityId) handleSearchNavigateToNote(lastEntityId);
          }
        } else {
          // Mixed batch — default to notes, select last note
          if (lastEntityId) handleSearchNavigateToNote(lastEntityId);
        }
      } catch (error) {
        console.error('Failed to import clips:', error);
        addToast('error', tt('clip.importFailed'));
      }
    };

    window.addEventListener('message', handler);
    // Replay any clips that arrived while the encryption lock screen was shown
    clipBuffer.flush();
    return () => window.removeEventListener('message', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- setSelectedFolderId is stable; settings deps intentionally omitted to avoid re-registering handler
  }, [findOrCreateFolder, loggedCreateNote, loggedCreateTask, loggedCreateEvent, timelines, navigateTo, addToast, setSelectedFolderId, handleSearchNavigateToNote]);

  // Handle files opened via PWA File Handling API (double-click .md on desktop)
  useEffect(() => {
    const handler = async (e: Event) => {
      const { name, content, size, lastModified } = (e as CustomEvent<FileOpenDetail>).detail;
      try {
        const created = new Date(lastModified).toLocaleDateString(undefined, {
          year: 'numeric', month: 'short', day: 'numeric',
        });
        const title = `${name} — ${formatBytes(size)} — Created ${created}`;
        const freshIOCs = extractIOCs(content, {
          enabledTypes: settings.tiEnabledIOCTypes,
          defaultConfidence: settings.tiDefaultConfidence,
        });
        const iocAnalysis = mergeIOCAnalysis(undefined, freshIOCs);
        const iocTypes = [...new Set(freshIOCs.filter((i) => !i.dismissed).map((i) => i.type))];
        const note = await loggedCreateNote({
          title,
          content,
          folderId: selectedFolderId,
          sourceTitle: name,
          iocAnalysis,
          iocTypes,
        });
        handleSearchNavigateToNote(note.id);
        addToast('success', tt('clip.openedAsNote', { name }));
      } catch (err) {
        console.error('Failed to import file as note:', err);
        addToast('error', tt('clip.openFailed', { name }));
      }
    };
    window.addEventListener('threatcaddy:file-open', handler);
    return () => window.removeEventListener('threatcaddy:file-open', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- settings deps intentionally omitted
  }, [loggedCreateNote, selectedFolderId, handleSearchNavigateToNote, addToast]);

  // Global drag-and-drop for markdown/text files
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    const onDrop = async (e: DragEvent) => {
      if (e.defaultPrevented) return;
      const files = getDroppedFiles(e);
      if (files.length === 0) return;
      e.preventDefault();
      for (const file of files) {
        await dispatchFile(file);
      }
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  // Track Clips folder ID for External Backup envelope type detection
  const clipsFolderId = useMemo(
    () => folders.find((f) => f.name === 'Clips')?.id,
    [folders]
  );

  // Filtered notes (always exclude trashed/archived — TrashArchiveView handles those)
  const filteredNotes = useMemo(
    () =>
      notes.getFilteredNotes({
        folderId: selectedFolderId,
        tag: selectedTag,
        showTrashed: false,
        showArchived: false,
        sort,
        iocTypes: selectedIOCTypes.length > 0 ? selectedIOCTypes : undefined,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notes.getFilteredNotes, selectedFolderId, selectedTag, sort, selectedIOCTypes]
  );

  // Filtered tasks
  const filteredTasks = useMemo(
    () =>
      tasks.getFilteredTasks({
        folderId: selectedFolderId,
        tag: selectedTag,
        showTrashed: false,
        showArchived: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks.getFilteredTasks, selectedFolderId, selectedTag]
  );

  // Filtered timeline events
  const filteredTimelineEvents = useMemo(
    () =>
      timeline.getFilteredEvents({
        folderId: selectedFolderId,
        tag: selectedTag,
        timelineId: selectedTimelineId,
        showTrashed: false,
        showArchived: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeline.getFilteredEvents, selectedFolderId, selectedTag, selectedTimelineId]
  );

  // Filtered whiteboards
  const filteredWhiteboards = useMemo(
    () => getFilteredWhiteboards({
      folderId: selectedFolderId,
      tag: selectedTag,
      showTrashed: false,
      showArchived: false,
    }),
    [getFilteredWhiteboards, selectedFolderId, selectedTag]
  );

  // Filtered standalone IOCs
  const filteredStandaloneIOCs = useMemo(
    () => standaloneIOCsHook.getFilteredIOCs({
      folderId: selectedFolderId,
      tag: selectedTag,
      showTrashed: false,
      showArchived: false,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [standaloneIOCsHook.getFilteredIOCs, selectedFolderId, selectedTag]
  );

  const filteredEvidenceItems = useMemo(
    () => evidenceItemsHook.getFilteredEvidenceItems({
      folderId: selectedFolderId,
      tag: selectedTag,
      showTrashed: false,
      showArchived: false,
    }),
    [evidenceItemsHook.getFilteredEvidenceItems, selectedFolderId, selectedTag],
  );

  // Filtered chat threads
  const filteredChatThreads = useMemo(
    () => chatsHook.getFilteredThreads({
      folderId: selectedFolderId,
      showTrashed: false,
      showArchived: false,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatsHook.getFilteredThreads, selectedFolderId]
  );

  // ─── Remote investigation data adapter ─────────────────────────
  const remoteData = useInvestigationData(
    investigationMode === 'remote' ? selectedFolderId ?? null : null,
    'remote',
  );

  // Resolved entity arrays — pick remote data when in remote mode, local otherwise
  const resolvedNotes = useMemo(
    () => investigationMode === 'remote' ? remoteData.notes : filteredNotes,
    [investigationMode, remoteData.notes, filteredNotes],
  );
  const resolvedTasks = investigationMode === 'remote' ? remoteData.tasks : filteredTasks;
  const resolvedTimelineEvents = investigationMode === 'remote' ? remoteData.events : filteredTimelineEvents;
  const resolvedWhiteboards = investigationMode === 'remote' ? remoteData.whiteboards : filteredWhiteboards;
  const resolvedStandaloneIOCs = investigationMode === 'remote' ? remoteData.iocs : filteredStandaloneIOCs;
  const resolvedEvidenceItems = investigationMode === 'remote' ? remoteData.evidenceItems : filteredEvidenceItems;
  const resolvedChatThreads = investigationMode === 'remote' ? remoteData.chats : filteredChatThreads;

  // Auto-deselect whiteboard when trashed/archived/filtered out
  useEffect(() => {
    if (selectedWhiteboardId && !resolvedWhiteboards.find((w) => w.id === selectedWhiteboardId)) {
      setSelectedWhiteboardId(undefined);
    }
  }, [selectedWhiteboardId, resolvedWhiteboards]);

  // Screenshare-safe: filter once on full arrays, derive folder-scoped and investigation-scoped from these
  const screensafeNotes = useMemo(
    () => screenshareMaxLevel ? notes.notes.filter((n) => !isAboveClsThreshold(n.clsLevel, screenshareMaxLevel, effectiveClsLevels)) : notes.notes,
    [notes.notes, screenshareMaxLevel, effectiveClsLevels]
  );
  const screensafeTasks = useMemo(
    () => screenshareMaxLevel ? tasks.tasks.filter((t) => !isAboveClsThreshold(t.clsLevel, screenshareMaxLevel, effectiveClsLevels)) : tasks.tasks,
    [tasks.tasks, screenshareMaxLevel, effectiveClsLevels]
  );
  const screensafeTimelineEvents = useMemo(
    () => screenshareMaxLevel ? timeline.events.filter((e) => !isAboveClsThreshold(e.clsLevel, screenshareMaxLevel, effectiveClsLevels)) : timeline.events,
    [timeline.events, screenshareMaxLevel, effectiveClsLevels]
  );
  const screensafeWhiteboards = useMemo(
    () => screenshareMaxLevel ? whiteboards.filter((w) => !isAboveClsThreshold(w.clsLevel, screenshareMaxLevel, effectiveClsLevels)) : whiteboards,
    [whiteboards, screenshareMaxLevel, effectiveClsLevels]
  );
  const screensafeStandaloneIOCs = useMemo(
    () => screenshareMaxLevel ? standaloneIOCsHook.iocs.filter((i) => !isAboveClsThreshold(i.clsLevel, screenshareMaxLevel, effectiveClsLevels)) : standaloneIOCsHook.iocs,
    [standaloneIOCsHook.iocs, screenshareMaxLevel, effectiveClsLevels]
  );
  const screensafeEvidenceItems = useMemo(
    () => screenshareMaxLevel ? evidenceItemsHook.evidenceItems.filter((item) => !isAboveClsThreshold(item.clsLevel, screenshareMaxLevel, effectiveClsLevels)) : evidenceItemsHook.evidenceItems,
    [evidenceItemsHook.evidenceItems, screenshareMaxLevel, effectiveClsLevels]
  );
  const screensafeChatThreads = useMemo(
    () => screenshareMaxLevel ? chatsHook.threads.filter((t) => !isAboveClsThreshold(t.clsLevel ?? undefined, screenshareMaxLevel, effectiveClsLevels)) : chatsHook.threads,
    [chatsHook.threads, screenshareMaxLevel, effectiveClsLevels]
  );
  // Investigations themselves weren't gated by screenshare mode — only the
  // entities inside them were, so a folder marked TLP:RED purely at the
  // folder level (no red-marked content) still showed up by name/badge in
  // the Investigations hub and the workspace investigation switcher. Uses
  // the RAW (non-screensafe) entity arrays for the inherited-level lookup —
  // using the already-filtered screensafe arrays here would hide exactly the
  // content that should raise a folder's effective level, undercounting it.
  const screensafeFolders = useMemo(() => {
    if (!screenshareMaxLevel) return folders;
    const allEntities = [
      ...notes.notes.filter((n) => !n.trashed && !n.archived),
      ...tasks.tasks.filter((t) => !t.trashed && !t.archived),
      ...timeline.events.filter((e) => !e.trashed && !e.archived),
      ...standaloneIOCsHook.iocs.filter((i) => !i.trashed && !i.archived),
    ];
    return folders.filter((f) => {
      const effective = effectiveTlpLevel(f.clsLevel, getInheritedClsLevel(f.id, allEntities));
      return !isAboveClsThreshold(effective, screenshareMaxLevel, effectiveClsLevels);
    });
  }, [folders, notes.notes, tasks.tasks, timeline.events, standaloneIOCsHook.iocs, screenshareMaxLevel, effectiveClsLevels]);
  // Remote investigation summaries only carry the folder-level clsLevel (no
  // local entity data to inherit from), so this filters on that alone.
  const screensafeRemoteInvestigations = useMemo(
    () => screenshareMaxLevel
      ? remoteInvestigations.filter((r) => !isAboveClsThreshold(r.folder.clsLevel, screenshareMaxLevel, effectiveClsLevels))
      : remoteInvestigations,
    [remoteInvestigations, screenshareMaxLevel, effectiveClsLevels]
  );

  // Folder-filtered + screenshare-safe (for NoteList, TaskList, TimelineView)
  // Use resolved arrays (which pick remote vs local) instead of raw filtered arrays
  const ssFilteredNotes = useMemo(
    () => screenshareMaxLevel ? resolvedNotes.filter((n) => !isAboveClsThreshold(n.clsLevel, screenshareMaxLevel, effectiveClsLevels)) : resolvedNotes,
    [resolvedNotes, screenshareMaxLevel, effectiveClsLevels]
  );
  const hiddenLocalNotesHint = useMemo(() => {
    const activeLocalCount = notes.notes.filter((note) => !note.trashed && !note.archived).length;
    if (ssFilteredNotes.length > 0 || activeLocalCount === 0) return undefined;
    if (investigationMode === 'remote') {
      return `${activeLocalCount} local notes are stored, but this view is showing the remote server snapshot. Open the local investigation or clear the investigation filter.`;
    }
    return `${activeLocalCount} local notes are stored, but the current filters hide them. Clear investigation, tag, IOC, archive/trash, and screenshare filters.`;
  }, [investigationMode, notes.notes, ssFilteredNotes.length]);
  const ssFilteredTasks = useMemo(
    () => screenshareMaxLevel ? resolvedTasks.filter((t) => !isAboveClsThreshold(t.clsLevel, screenshareMaxLevel, effectiveClsLevels)) : resolvedTasks,
    [resolvedTasks, screenshareMaxLevel, effectiveClsLevels]
  );
  const ssFilteredTimelineEvents = useMemo(
    () => screenshareMaxLevel ? resolvedTimelineEvents.filter((e) => !isAboveClsThreshold(e.clsLevel, screenshareMaxLevel, effectiveClsLevels)) : resolvedTimelineEvents,
    [resolvedTimelineEvents, screenshareMaxLevel, effectiveClsLevels]
  );
  const ssFilteredWhiteboards = useMemo(
    () => screenshareMaxLevel ? resolvedWhiteboards.filter((w) => !isAboveClsThreshold(w.clsLevel, screenshareMaxLevel, effectiveClsLevels)) : resolvedWhiteboards,
    [resolvedWhiteboards, screenshareMaxLevel, effectiveClsLevels]
  );
  const ssFilteredStandaloneIOCs = useMemo(
    () => screenshareMaxLevel ? resolvedStandaloneIOCs.filter((i) => !isAboveClsThreshold(i.clsLevel, screenshareMaxLevel, effectiveClsLevels)) : resolvedStandaloneIOCs,
    [resolvedStandaloneIOCs, screenshareMaxLevel, effectiveClsLevels]
  );
  const ssFilteredEvidenceItems = useMemo(
    () => screenshareMaxLevel ? resolvedEvidenceItems.filter((item) => !isAboveClsThreshold(item.clsLevel, screenshareMaxLevel, effectiveClsLevels)) : resolvedEvidenceItems,
    [resolvedEvidenceItems, screenshareMaxLevel, effectiveClsLevels]
  );
  const ssFilteredChatThreads = useMemo(
    () => screenshareMaxLevel ? resolvedChatThreads.filter((t) => !isAboveClsThreshold(t.clsLevel ?? undefined, screenshareMaxLevel, effectiveClsLevels)) : resolvedChatThreads,
    [resolvedChatThreads, screenshareMaxLevel, effectiveClsLevels]
  );

  // Investigation-scoped arrays (for graph, IOC stats, search) — derive from screensafe,
  // or use remote data directly when in remote mode
  const investigationNotes = useMemo(
    () => investigationMode === 'remote' ? remoteData.notes : selectedFolderId ? screensafeNotes.filter((n) => n.folderId === selectedFolderId) : screensafeNotes,
    [investigationMode, remoteData.notes, screensafeNotes, selectedFolderId]
  );
  const investigationTasks = useMemo(
    () => investigationMode === 'remote' ? remoteData.tasks : selectedFolderId ? screensafeTasks.filter((t) => t.folderId === selectedFolderId) : screensafeTasks,
    [investigationMode, remoteData.tasks, screensafeTasks, selectedFolderId]
  );
  const investigationTimelineEvents = useMemo(
    () => investigationMode === 'remote' ? remoteData.events : selectedFolderId ? screensafeTimelineEvents.filter((e) => e.folderId === selectedFolderId) : screensafeTimelineEvents,
    [investigationMode, remoteData.events, screensafeTimelineEvents, selectedFolderId]
  );
  const investigationWhiteboards = useMemo(
    () => investigationMode === 'remote' ? remoteData.whiteboards : selectedFolderId ? screensafeWhiteboards.filter((w) => w.folderId === selectedFolderId) : screensafeWhiteboards,
    [investigationMode, remoteData.whiteboards, screensafeWhiteboards, selectedFolderId]
  );
  const investigationStandaloneIOCs = useMemo(
    () => investigationMode === 'remote' ? remoteData.iocs : selectedFolderId ? screensafeStandaloneIOCs.filter((i) => i.folderId === selectedFolderId) : screensafeStandaloneIOCs,
    [investigationMode, remoteData.iocs, screensafeStandaloneIOCs, selectedFolderId]
  );
  const investigationEvidenceItems = useMemo(
    () => investigationMode === 'remote' ? remoteData.evidenceItems : selectedFolderId ? screensafeEvidenceItems.filter((item) => item.folderId === selectedFolderId) : screensafeEvidenceItems,
    [investigationMode, remoteData.evidenceItems, screensafeEvidenceItems, selectedFolderId]
  );

  const investigationScopedCounts = useMemo(() => {
    if (!selectedFolderId) return null;
    const iocKeys = new Set<string>();
    const collect = (a?: { iocs: Array<{ type: string; value: string; dismissed: boolean }> }) => {
      if (!a?.iocs) return;
      for (const i of a.iocs) if (!i.dismissed) iocKeys.add(`${i.type}:${i.value.toLowerCase()}`);
    };
    for (const n of investigationNotes) if (!n.trashed && !n.archived) collect(n.iocAnalysis);
    for (const t of investigationTasks) if (!t.trashed && !t.archived) collect(t.iocAnalysis);
    for (const e of investigationTimelineEvents) if (!e.trashed && !e.archived) collect(e.iocAnalysis);
    return {
      notes: investigationNotes.filter(n => !n.trashed && !n.archived).length,
      tasks: investigationTasks.filter(t => !t.trashed && !t.archived).length,
      events: investigationTimelineEvents.filter(e => !e.trashed && !e.archived).length,
      whiteboards: investigationWhiteboards.filter(w => !w.trashed && !w.archived).length,
      iocs: iocKeys.size,
    };
  }, [selectedFolderId, investigationNotes, investigationTasks, investigationTimelineEvents, investigationWhiteboards]);

  const activeEvidenceItems = useMemo(
    () => investigationEvidenceItems.filter((item) => !item.trashed && !item.archived),
    [investigationEvidenceItems],
  );
  const activeProducts = useMemo(
    () => investigationNotes.filter((note) => !note.trashed && !note.archived && isProductNote(note)),
    [investigationNotes],
  );
  const productBaselines = useMemo(
    () => [
      ...BUILTIN_PRODUCT_BASELINES,
      ...noteTemplatesHook.templates.filter((template) => template.source !== 'builtin' && isProductBaselineTemplate(template)),
    ],
    [noteTemplatesHook.templates],
  );
  const handleImportProductBaseline = useCallback(async (json: string, fileName: string): Promise<NoteTemplate> => {
    const template = await importProductBaselinePackage(json, fileName);
    await noteTemplatesHook.reload();
    addToast('success', `Imported product baseline "${template.name}".`);
    return template;
  }, [addToast, noteTemplatesHook]);
  const handleUpdateProductBaseline = useCallback(async (id: string, updates: Partial<NoteTemplate>) => {
    await noteTemplatesHook.updateTemplate(id, updates);
    addToast('success', 'Updated product baseline.');
  }, [addToast, noteTemplatesHook]);

  // Screenshare context value
  const screenshareCtx = useMemo(
    () => ({ maxLevel: screenshareMaxLevel, effectiveLevels: effectiveClsLevels }),
    [screenshareMaxLevel, effectiveClsLevels]
  );

  // Timeline event counts per timeline
  const timelineEventCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ev of timeline.events) {
      counts[ev.timelineId] = (counts[ev.timelineId] || 0) + 1;
    }
    return counts;
  }, [timeline.events]);

  // Selected note — use resolved notes (local or remote) so remote notes can be selected
  const selectedNote = useMemo(
    () => resolvedNotes.find((n) => n.id === selectedNoteId),
    [resolvedNotes, selectedNoteId]
  );

  const noteTemplateMap = useMemo(
    () => new Map(noteTemplatesHook.templates.map((template) => [template.id, template])),
    [noteTemplatesHook.templates],
  );

  const attachedInvestigationTemplates = useMemo(
    () => (selectedFolder?.noteTemplateIds ?? [])
      .map((templateId) => noteTemplateMap.get(resolveBuiltinTemplateId(templateId)))
      .filter((template): template is NoteTemplate => Boolean(template)),
    [noteTemplateMap, selectedFolder?.noteTemplateIds],
  );

  // Auto-deselect when selected note is no longer in filtered list
  // Fixes stale editor after trash, delete, archive, restore, tag change, etc.
  // Skip when notes list is empty (still loading after folder switch or sample import)
  // Skip during grace period (note was just created, live query hasn't picked it up yet)
  // Skip during remote loading to avoid premature deselection
  useEffect(() => {
    if (noteNavGraceRef.current) return;
    if (investigationMode === 'remote' && remoteData.loading) return;
    if (selectedNoteId && resolvedNotes.length > 0 && !resolvedNotes.find((n) => n.id === selectedNoteId)) {
      setSelectedNoteId(undefined);
    }
  }, [selectedNoteId, resolvedNotes, investigationMode, remoteData.loading]);

  // Note counts (include all notes)
  const noteCounts = useMemo(() => ({
    total: notes.notes.filter((n) => !n.trashed && !n.archived).length,
    trashed: notes.notes.filter((n) => n.trashed).length,
    archived: notes.notes.filter((n) => n.archived && !n.trashed).length,
  }), [notes.notes]);

  // Combined trash/archive counts across all entity types
  const combinedTrashedCount = useMemo(() =>
    noteCounts.trashed + tasks.taskCounts.trashed + timeline.eventCounts.trashed + whiteboardCounts.trashed + standaloneIOCsHook.iocCounts.trashed + evidenceItemsHook.evidenceCounts.trashed,
    [noteCounts.trashed, tasks.taskCounts.trashed, timeline.eventCounts.trashed, whiteboardCounts.trashed, standaloneIOCsHook.iocCounts.trashed, evidenceItemsHook.evidenceCounts.trashed]
  );
  const combinedArchivedCount = useMemo(() =>
    noteCounts.archived + tasks.taskCounts.archived + timeline.eventCounts.archived + whiteboardCounts.archived + standaloneIOCsHook.iocCounts.archived + evidenceItemsHook.evidenceCounts.archived,
    [noteCounts.archived, tasks.taskCounts.archived, timeline.eventCounts.archived, whiteboardCounts.archived, standaloneIOCsHook.iocCounts.archived, evidenceItemsHook.evidenceCounts.archived]
  );

  const handleNewNote = useCallback(async () => {
    if (showQuickCapture) return;
    setShowTrash(false);
    setShowArchive(false);
    const folder = selectedFolderId ? folders.find((f) => f.id === selectedFolderId) : undefined;
    const note = await loggedCreateNote({
      folderId: selectedFolderId,
      clsLevel: folder?.clsLevel,
    });
    handleSearchNavigateToNote(note.id);
  }, [loggedCreateNote, selectedFolderId, showQuickCapture, folders, handleSearchNavigateToNote]);

  const handleNewTypedNote = useCallback(async (type: NoteType) => {
    if (showQuickCapture) return;
    setShowTrash(false);
    setShowArchive(false);
    const folder = selectedFolderId ? folders.find((f) => f.id === selectedFolderId) : undefined;
    if (type === 'sticky') {
      const note = await loggedCreateNote({
        noteType: 'sticky',
        title: 'Jot',
        folderId: selectedFolderId,
        clsLevel: folder?.clsLevel,
      });
      setShowJotsPanel(true);
      void note;
      return;
    }
    if (type === 'definition') {
      const existing = notes.notes.find((n) => n.folderId === selectedFolderId && n.noteType === 'definition' && !n.trashed);
      if (existing) {
        addToast('info', 'This investigation already has a Definition note.');
        handleSearchNavigateToNote(existing.id);
        return;
      }
    }
    const defaultContent = type === 'definition'
      ? '## Scope\n\n## Hypothesis\n\n## Objective\n'
      : type === 'journal'
        ? `### ${new Date().toLocaleString()}\n\n`
        : '';
    const note = await loggedCreateNote({
      noteType: type,
      title: type === 'journal' ? 'Journal' : type === 'definition' ? 'Definition' : 'Untitled Note',
      content: defaultContent,
      folderId: selectedFolderId,
      clsLevel: folder?.clsLevel,
    });
    handleSearchNavigateToNote(note.id);
  }, [loggedCreateNote, selectedFolderId, showQuickCapture, folders, handleSearchNavigateToNote, notes.notes, addToast, setShowJotsPanel]);

  const handleCreateNoteFromTemplate = useCallback(async (templateId: string) => {
    const template = noteTemplateMap.get(resolveBuiltinTemplateId(templateId));
    if (!template) {
      addToast('error', 'Template is no longer available.');
      return;
    }
    setShowTrash(false);
    setShowArchive(false);
    const folder = selectedFolderId ? folders.find((f) => f.id === selectedFolderId) : undefined;
    const note = await loggedCreateNote({
      title: template.name,
      content: template.content,
      folderId: selectedFolderId,
      tags: template.tags ?? [],
      clsLevel: template.clsLevel ?? folder?.clsLevel,
    });
    handleSearchNavigateToNote(note.id);
  }, [addToast, folders, handleSearchNavigateToNote, loggedCreateNote, noteTemplateMap, selectedFolderId, setShowArchive, setShowTrash]);

  const handleSaveInvestigationTemplateIds = useCallback(async (templateIds: string[]) => {
    if (!selectedFolderId) {
      addToast('warning', 'Open an investigation before attaching templates.');
      return;
    }
    // Normalize any legacy/aliased ids to canonical so saves persist the clean id going forward.
    const uniqueIds = Array.from(new Set(templateIds.map(resolveBuiltinTemplateId)))
      .filter((templateId) => noteTemplateMap.has(templateId));
    await updateFolder(selectedFolderId, { noteTemplateIds: uniqueIds });
    addToast('success', uniqueIds.length === 0 ? 'No templates attached to this investigation.' : `${uniqueIds.length} template${uniqueIds.length === 1 ? '' : 's'} attached to this investigation.`);
  }, [addToast, noteTemplateMap, selectedFolderId, updateFolder]);

  const handleCreateNoteTemplate = useCallback(async (data: Partial<NoteTemplate> & { name: string; content: string }) => {
    const template = await noteTemplatesHook.createTemplate(data);
    if (selectedFolderId) {
      const currentTemplateIds = selectedFolder?.noteTemplateIds ?? [];
      await updateFolder(selectedFolderId, {
        noteTemplateIds: Array.from(new Set([...currentTemplateIds, template.id])),
      });
      addToast('success', `Saved "${template.name}" as a template and attached it to this investigation.`);
    } else {
      addToast('success', `Saved "${template.name}" as a template.`);
    }
  }, [addToast, noteTemplatesHook, selectedFolder?.noteTemplateIds, selectedFolderId, updateFolder]);

  const handleNewTask = useCallback(async () => {
    setShowTrash(false);
    setShowArchive(false);
    setPendingNewTask(true);
    navigateTo('tasks');
  }, [navigateTo]);

  const handleNewTimelineEvent = useCallback(() => {
    setShowTrash(false);
    setShowArchive(false);
    setPendingNewEvent(true);
    navigateTo('timeline');
  }, [navigateTo]);

  const handleNewWhiteboard = useCallback(async () => {
    const wb = await loggedCreateWhiteboard(undefined, selectedFolderId);
    setSelectedWhiteboardId(wb.id);
    navigateTo('whiteboard', { selectedWhiteboardId: wb.id });
  }, [loggedCreateWhiteboard, selectedFolderId, navigateTo]);

  const handleNewIOC = useCallback(() => {
    setShowIOCForm(true);
  }, [setShowIOCForm]);

  const handleShareNoteLink = useCallback((note: Note) => {
    setShareLinkPayload({ v: 1, s: 'note', t: Date.now(), d: note });
  }, []);

  // ─── Note list resize ────────────────────────────────────────
  const handleShareInvestigationLink = useCallback((folderId: string) => {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;
    const bundle: InvestigationBundle = {
      folder,
      notes: notes.notes.filter((n) => n.folderId === folderId && !n.trashed),
      tasks: tasks.tasks.filter((t) => t.folderId === folderId && !t.trashed),
      events: timeline.events.filter((e) => e.folderId === folderId && !e.trashed),
      timelines: timelines.filter((tl) => folder.timelineId === tl.id),
      whiteboards: whiteboards.filter((w) => w.folderId === folderId && !w.trashed),
      iocs: standaloneIOCsHook.iocs.filter((i) => i.folderId === folderId && !i.trashed),
      evidenceItems: evidenceItemsHook.evidenceItems.filter((item) => item.folderId === folderId && !item.trashed),
      chatThreads: chatsHook.threads.filter((c) => c.folderId === folderId && !c.trashed),
      tags,
    };
    setShareLinkPayload({ v: 1, s: 'investigation', t: Date.now(), d: bundle });
  }, [folders, notes.notes, tasks.tasks, timeline.events, timelines, whiteboards, standaloneIOCsHook.iocs, evidenceItemsHook.evidenceItems, chatsHook.threads, tags]);

  const handleShareChatThread = useCallback((thread: ChatThread) => {
    // Trim thread for sharing — strip large tool call results to reduce payload size
    const trimmedThread: ChatThread = {
      ...thread,
      messages: thread.messages.map(msg => ({
        ...msg,
        toolCalls: msg.toolCalls?.map(tc => ({
          ...tc,
          result: tc.result.length > 500 ? tc.result.substring(0, 500) + '... [truncated for sharing]' : tc.result,
        })),
      })),
      contextSummary: undefined, // Not needed for share
    };
    setShareLinkPayload({ v: 1, s: 'chat', t: Date.now(), d: trimmedThread });
  }, []);

  const handleSaveSharedPayload = useCallback(async (payload: SharePayload) => {
    if (payload.s === 'investigation') {
      const bundle = payload.d as InvestigationBundle;
      await db.transaction('rw', [db.folders, db.notes, db.tasks, db.timelineEvents, db.whiteboards, db.standaloneIOCs, db.evidenceItems, db.chatThreads, db.timelines, db.tags], async () => {
        await db.folders.put(bundle.folder);
        await db.notes.bulkPut(bundle.notes);
        await db.tasks.bulkPut(bundle.tasks);
        await db.timelineEvents.bulkPut(bundle.events);
        await db.whiteboards.bulkPut(bundle.whiteboards);
        await db.standaloneIOCs.bulkPut(bundle.iocs);
        if (bundle.evidenceItems) await db.evidenceItems.bulkPut(bundle.evidenceItems);
        if (bundle.chatThreads) await db.chatThreads.bulkPut(bundle.chatThreads);
        await db.timelines.bulkPut(bundle.timelines);
        await db.tags.bulkPut(bundle.tags);
      });
      reloadAll();
      addToast('success', tt('share.investigationSaved', { name: bundle.folder.name }));
    } else if (payload.s === 'note') {
      await db.notes.put(payload.d as Note);
      notes.reload();
      addToast('success', tt('share.noteSaved'));
    } else if (payload.s === 'task') {
      await db.tasks.put(payload.d as Task);
      tasks.reload();
      addToast('success', tt('share.taskSaved'));
    } else if (payload.s === 'event') {
      await db.timelineEvents.put(payload.d as TimelineEvent);
      timeline.reload();
      addToast('success', tt('share.eventSaved'));
    } else if (payload.s === 'chat') {
      await db.chatThreads.put(payload.d as ChatThread);
      chatsHook.reload();
      addToast('success', tt('share.chatSaved'));
    }
  }, [reloadAll, notes, tasks, timeline, chatsHook, addToast]);

  const handleDataImportComplete = useCallback((result: ImportResult) => {
    activityLog.log(
      'data',
      'import',
      `Data import: ${result.timelineEventsCreated} events, ${result.iocsExtracted} IOCs`,
    );
    addToast('success', tt('import.dataImported', { events: result.timelineEventsCreated, iocs: result.iocsExtracted }));
    // Reload all hooks to pick up new entities
    notes.reload();
    timeline.reload();
    standaloneIOCsHook.reload();
    reloadTimelines();
    reloadTags();
    // Navigate based on what was imported
    if (result.timelineEventsCreated > 0) {
      navigateTo('timeline');
    } else if (result.iocsExtracted > 0) {
      navigateTo('ioc-stats');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityLog, addToast, notes.reload, timeline.reload, standaloneIOCsHook.reload, reloadTimelines, reloadTags, navigateTo]);

  const handleEvidenceImport = useCallback(async (files: File[]): Promise<EvidenceItem[]> => {
    if (!selectedFolderId) {
      throw new Error('Select an investigation before importing evidence.');
    }
    if (files.length > MAX_EVIDENCE_IMPORT_FILES) {
      throw new Error(`Import up to ${MAX_EVIDENCE_IMPORT_FILES} evidence files at once.`);
    }

    const createdItems: EvidenceItem[] = [];
    const activeEvidenceKeys = new Set(
      evidenceItemsHook.evidenceItems
        .filter((item) => item.folderId === selectedFolderId && !item.trashed)
        .map(evidenceFileKeyFromItem),
    );
    const selectedEvidenceKeys = new Set<string>();
    const filesToImport: File[] = [];
    let skippedDuplicateFiles = 0;

    for (const file of files) {
      const key = evidenceFileKeyFromFile(file);
      const scopedKey = `${selectedFolderId}|${key}`;
      if (activeEvidenceKeys.has(scopedKey) || selectedEvidenceKeys.has(scopedKey)) {
        skippedDuplicateFiles += 1;
        continue;
      }
      selectedEvidenceKeys.add(scopedKey);
      filesToImport.push(file);
    }

    if (filesToImport.length === 0) {
      throw new Error('All selected evidence files are already imported for this investigation.');
    }

    let createdIOCCount = 0;
    const failedFiles: Array<{ name: string; message: string }> = [];
    for (const file of filesToImport) {
      let drafts: Awaited<ReturnType<typeof buildEvidenceItemDrafts>>;
      try {
        drafts = await buildEvidenceItemDrafts(file, {
          folderName: selectedFolder?.name,
        });
      } catch (err) {
        failedFiles.push({
          name: file.name,
          message: err instanceof Error ? err.message : 'import failed',
        });
        continue;
      }

      for (const draft of drafts) {
        // Evidence inherits the investigation's TLP, but its own content can carry
        // an explicit TLP marker or a confidentiality banner ("Confidential",
        // "Company Restricted", "Employees Only", ...) that's more restrictive than
        // the folder — e.g. a RED-marked document dropped into a GREEN investigation.
        // effectiveTlpLevel takes the max of the two, same as the sidebar's
        // investigation-card badge does for folder-vs-entity TLP.
        const detectedClsLevel = detectClsLevelFromText(draft.content);
        const item = await evidenceItemsHook.createEvidenceItem({
          ...draft,
          folderId: selectedFolderId,
          clsLevel: detectedClsLevel
            ? effectiveTlpLevel(selectedFolder?.clsLevel, detectedClsLevel)
            : selectedFolder?.clsLevel,
        });

        const enabledIOCTypes = settings.tiEnabledIOCTypes as IOCType[] | undefined;
        const defaultIOCConfidence = settings.tiDefaultConfidence as ConfidenceLevel | undefined;
        const tableCandidates = extractEvidenceTableIOCCandidates(draft.content, {
          enabledTypes: enabledIOCTypes,
          defaultConfidence: defaultIOCConfidence,
        });
        const freshIOCs = extractIOCs(draft.content, {
          enabledTypes: settings.tiEnabledIOCTypes,
          defaultConfidence: settings.tiDefaultConfidence,
        });
        const tableIOCs = tableCandidates.map((candidate) => ({
          id: `evidence-table-${candidate.type}-${candidate.value.toLowerCase()}`,
          type: candidate.type,
          value: candidate.value,
          confidence: candidate.confidence,
          firstSeen: Date.now(),
          dismissed: false,
          analystNotes: `${candidate.notes}\n\nEvidence file: "${draft.fileName}".`,
        }));
        const observationResult = await upsertIOCObservations([...tableIOCs, ...freshIOCs], {
          folderId: selectedFolderId,
          clsLevel: selectedFolder?.clsLevel,
          source: { kind: 'evidence', id: item.id, title: item.title, fileName: draft.fileName },
          defaultConfidence: defaultIOCConfidence,
        });
        const linkedIOCIds = observationResult.touched.map((ioc) => ioc.id);
        createdIOCCount += observationResult.created.length;
        autoEnrichCreatedIOCs(observationResult.touched);

        if (linkedIOCIds.length > 0) {
          await evidenceItemsHook.updateEvidenceItem(item.id, { linkedIOCIds });
        }
        createdItems.push(linkedIOCIds.length > 0 ? { ...item, linkedIOCIds } : item);
      }

      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }

    if (createdItems.length === 0 && failedFiles.length > 0) {
      const summary = failedFiles.slice(0, 3).map((item) => `${item.name}: ${item.message}`).join('; ');
      throw new Error(`Evidence import failed. ${summary}`);
    }

    evidenceItemsHook.reload();
    standaloneIOCsHook.reload();
    reloadTags();
    activityLog.log(
      'evidence',
      'import',
      `Imported ${filesToImport.length} evidence file${filesToImport.length === 1 ? '' : 's'} as ${createdItems.length} evidence item${createdItems.length === 1 ? '' : 's'} and extracted ${createdIOCCount} IOC${createdIOCCount === 1 ? '' : 's'}${skippedDuplicateFiles > 0 ? `; skipped ${skippedDuplicateFiles} duplicate file${skippedDuplicateFiles === 1 ? '' : 's'}` : ''}${failedFiles.length > 0 ? `; failed ${failedFiles.length} file${failedFiles.length === 1 ? '' : 's'}` : ''}`,
      selectedFolderId,
      selectedFolder?.name,
    );
    addToast('success', `Imported ${createdItems.length} evidence item${createdItems.length === 1 ? '' : 's'}${createdIOCCount > 0 ? ` and extracted ${createdIOCCount} IOC${createdIOCCount === 1 ? '' : 's'}` : ''}${skippedDuplicateFiles > 0 ? `; skipped ${skippedDuplicateFiles} duplicate file${skippedDuplicateFiles === 1 ? '' : 's'}` : ''}`);
    if (failedFiles.length > 0) {
      addToast('warning', `${failedFiles.length} evidence file${failedFiles.length === 1 ? '' : 's'} could not be imported.`, 7000);
    }
    return createdItems;
  }, [selectedFolderId, selectedFolder, standaloneIOCsHook, evidenceItemsHook, settings.tiEnabledIOCTypes, settings.tiDefaultConfidence, loggedCreateIOCWithAuto, reloadTags, activityLog, addToast]);

  const handleDeduplicateEvidence = useCallback(async (): Promise<number> => {
    if (!selectedFolderId) {
      throw new Error('Select an investigation before deduplicating evidence.');
    }

    const duplicateIds = findDuplicateEvidenceItemIds(evidenceItemsHook.evidenceItems, selectedFolderId);
    if (duplicateIds.length === 0) {
      addToast('info', 'No duplicate evidence found.');
      return 0;
    }

    for (const id of duplicateIds) {
      await evidenceItemsHook.updateEvidenceItem(id, { trashed: true, trashedAt: Date.now() });
    }

    evidenceItemsHook.reload();
    activityLog.log(
      'evidence',
      'deduplicate',
      `Moved ${duplicateIds.length} duplicate evidence item${duplicateIds.length === 1 ? '' : 's'} to trash`,
      selectedFolderId,
      selectedFolder?.name,
    );
    addToast('success', `Moved ${duplicateIds.length} duplicate evidence item${duplicateIds.length === 1 ? '' : 's'} to trash.`);
    return duplicateIds.length;
  }, [activityLog, addToast, evidenceItemsHook, selectedFolder?.name, selectedFolderId]);

  const handleCreateTableIOCsFromEvidence = useCallback(async (
    item: EvidenceItem,
    candidates: EvidenceTableIOCCandidate[],
  ): Promise<number> => {
    const folderId = item.folderId || selectedFolderId;
    if (!folderId) {
      throw new Error('Select an investigation before adding table IOCs.');
    }
    if (candidates.length === 0) return 0;

    const existingIOCKeys = new Set(
      standaloneIOCsHook.iocs
        .filter((ioc) => ioc.folderId === folderId && !ioc.trashed)
        .map((ioc) => `${ioc.type}:${ioc.value.toLowerCase()}`),
    );
    const linkedIOCIds = new Set(item.linkedIOCIds || []);
    let created = 0;

    for (const candidate of candidates) {
      const key = `${candidate.type}:${candidate.value.toLowerCase()}`;
      if (existingIOCKeys.has(key)) continue;
      const ioc = await loggedCreateIOCWithAuto({
        type: candidate.type,
        value: candidate.value,
        confidence: candidate.confidence,
        folderId,
        clsLevel: item.clsLevel || selectedFolder?.clsLevel,
        tags: ['source:evidence', 'source:table'],
        analystNotes: `${candidate.notes}\n\nEvidence file: "${item.fileName}".`,
      });
      existingIOCKeys.add(key);
      linkedIOCIds.add(ioc.id);
      created += 1;
    }

    if (created > 0) {
      await evidenceItemsHook.updateEvidenceItem(item.id, { linkedIOCIds: Array.from(linkedIOCIds) });
      evidenceItemsHook.reload();
      standaloneIOCsHook.reload();
      reloadTags();
      activityLog.log(
        'evidence',
        'update',
        `Added ${created} IOC${created === 1 ? '' : 's'} from evidence table "${item.fileName}"`,
        folderId,
        selectedFolder?.name,
      );
      addToast('success', `Added ${created} IOC${created === 1 ? '' : 's'} from table evidence.`);
    }

    return created;
  }, [activityLog, addToast, evidenceItemsHook, loggedCreateIOCWithAuto, reloadTags, selectedFolder?.clsLevel, selectedFolder?.name, selectedFolderId, standaloneIOCsHook]);

  const handleAnalyzeImageEvidence = useCallback(async (item: EvidenceItem) => {
    if (!selectedFolderId) {
      addToast('error', 'Select an investigation before analyzing image evidence.');
      return;
    }
    if (!item.imageData || !item.imageDataMimeType || !VALID_RASTER_IMAGE_MIME_TYPES.has(item.imageDataMimeType.toLowerCase())) {
      addToast('error', 'This image only has metadata stored. Re-import a smaller image to analyze pixels in CaddyAI.');
      return;
    }

    const thread = await loggedCreateChatThread({
      title: `Analyze image: ${item.fileName}`,
      folderId: selectedFolderId,
      model: settings.llmDefaultModel || 'claude-sonnet-4-6',
      provider: (settings.llmDefaultProvider as ChatThread['provider']) || 'anthropic',
      tags: ['evidence-analysis'],
    });
    const text = [
      `Analyze this ThreatCaddy image evidence: ${item.fileName}`,
      '',
      'Identify what the image shows, transcribe visible text, extract IOCs or other security-relevant entities, and call out uncertainty.',
      '',
      'Evidence metadata:',
      `- Investigation: ${selectedFolder?.name || selectedFolderId}`,
      `- File type: ${item.fileType}`,
      `- MIME: ${item.imageDataMimeType}`,
      `- Size: ${formatBytes(item.size)}`,
      item.imageWidth && item.imageHeight ? `- Dimensions: ${item.imageWidth} x ${item.imageHeight}px` : undefined,
      item.imageAspectRatio ? `- Aspect ratio: ${item.imageAspectRatio}` : undefined,
      item.extractionWarning ? `- Import note: ${item.extractionWarning}` : undefined,
    ].filter(Boolean).join('\n');
    setPendingChatDraft({
      id: `image-analysis-${item.id}-${Date.now()}`,
      threadId: thread.id,
      text,
      attachments: [{
        type: 'image',
        data: item.imageData,
        mimeType: item.imageDataMimeType,
        name: item.fileName,
      }],
    });
    setSelectedChatThreadId(thread.id);
    navigateTo('chat');
  }, [addToast, loggedCreateChatThread, navigateTo, selectedFolder?.name, selectedFolderId, setSelectedChatThreadId, settings.llmDefaultModel, settings.llmDefaultProvider]);

  // Copies an evidence item's extracted content into a new ReportCaddy draft.
  // The evidence item itself is left untouched — this is a copy, not a move or link.
  const handlePromoteEvidenceToReportDraft = useCallback(async (item: EvidenceItem) => {
    const report = await reportsHook.createReport({
      title: item.title,
      templateId: 'rt-imported-document',
      sections: [{ sectionId: 'content', content: item.content }],
      folderId: item.folderId,
    });
    addToast('success', `Created ReportCaddy draft from "${item.title}"`);
    navigateTo('reportcaddy');
    return report;
  }, [reportsHook, addToast, navigateTo]);

  const handleShipReportToProducts = useCallback((title: string, content: string, folderId?: string) => {
    void loggedCreateNote({
      title,
      content,
      folderId,
      tags: [PRODUCT_NOTE_TAG, PRODUCT_DRAFT_TAG, 'reportcaddy'],
    });
  }, [loggedCreateNote]);

  const handleOpenFortuneInt = useCallback(() => {
    setFortuneIntMode(true);
    setFortuneIntOpenRequest((value) => value + 1);
    navigateTo('chat');
  }, [navigateTo]);

  const handleOpenCaddyAI = useCallback(() => {
    setFortuneIntMode(false);
    navigateTo('chat');
  }, [navigateTo]);

  const handleQuickCapture = useCallback(async (data: Partial<Note>) => {
    const folder = selectedFolderId ? folders.find((f) => f.id === selectedFolderId) : undefined;
    const note = await loggedCreateNote({
      ...data,
      folderId: data.folderId ?? selectedFolderId,
      clsLevel: data.clsLevel ?? folder?.clsLevel,
    });
    handleSearchNavigateToNote(note.id);
  }, [loggedCreateNote, selectedFolderId, folders, handleSearchNavigateToNote]);

  const handleImportComplete = useCallback(() => {
    setInvestigationMode('local');
    setSelectedFolderId(undefined);
    setSelectedNoteId(undefined);
    setSelectedTag(undefined);
    setSelectedIOCTypes([]);
    setShowTrash(false);
    setShowArchive(false);
    reloadAll();
    closeSettings();
    navigateTo('notes');
  }, [closeSettings, navigateTo, reloadAll, setInvestigationMode, setSelectedFolderId, setSelectedIOCTypes, setSelectedNoteId, setSelectedTag, setShowTrash, setShowArchive]);

  const handleQuickSave = useCallback(async () => {
    try {
      const json = await exportJSON();
      const date = new Date().toISOString().slice(0, 10);
      downloadFile(json, `threatcaddy-backup-${date}.json`, 'application/json');
      addToast('success', tt('backup.exported'));
    } catch {
      addToast('error', tt('backup.exportFailed'));
    }
  }, [addToast, tt]);

  const handleQuickLoad = useCallback((file: File) => {
    setPendingImportFile(file);
  }, []);

  const handleConfirmImport = useCallback(async () => {
    if (!pendingImportFile) return;
    try {
      const text = await pendingImportFile.text();
      await importJSON(text);
      setPendingImportFile(null);
      handleImportComplete();
      addToast('success', tt('backup.restored'));
    } catch {
      addToast('error', tt('backup.restoreFailed'));
      setPendingImportFile(null);
    }
  }, [pendingImportFile, handleImportComplete, addToast, tt]);

  const handleMergeImport = useCallback(async () => {
    if (!pendingImportFile) return;
    try {
      const text = await pendingImportFile.text();
      const result = await mergeImportJSON(text);
      setPendingImportFile(null);
      handleImportComplete();
      const notesMerged = (result.tables.notes?.added ?? 0) + (result.tables.notes?.updated ?? 0);
      const investigationsWithNotes = result.noteInvestigations.filter((item) => item.notes > 0).length;
      addToast('success', tt('backup.mergeCompleteDetailed', {
        notes: notesMerged,
        investigations: investigationsWithNotes,
        added: result.added,
        updated: result.updated,
        skipped: result.skipped,
      }));
    } catch {
      addToast('error', tt('backup.mergeFailed'));
      setPendingImportFile(null);
    }
  }, [pendingImportFile, handleImportComplete, addToast, tt]);

  // Sample investigation
  const sampleLoaded = useMemo(() => folders.some((f) => f.id === 'sample-investigation'), [folders]);

  const handleLoadSample = useCallback(async () => {
    const data = generateSampleInvestigation();
    // Write all entities to DB
    await db.folders.put(data.folder);
    await db.timelines.put(data.timeline);
    await db.tags.bulkPut(data.tags);
    await db.notes.bulkPut(data.notes);
    await db.tasks.bulkPut(data.tasks);
    await db.timelineEvents.bulkPut(data.timelineEvents);
    await db.standaloneIOCs.bulkPut(data.standaloneIOCs);
    await db.whiteboards.bulkPut([data.whiteboard]);
    if (data.chatThreads) await db.chatThreads.bulkPut(data.chatThreads);
    // Reload all hooks
    handleImportComplete();
    // Navigate to sample and open first note
    setSelectedFolderId('sample-investigation');
    navigateTo('notes');
    setSelectedNoteId(data.notes[0]?.id);
    activityLog.log('data', 'import', 'Loaded sample investigation "Operation DARK GLACIER"');
    addToast('success', tt('investigation.sampleLoaded'));
  }, [handleImportComplete, navigateTo, activityLog, setSelectedFolderId, addToast]);

  const handleDeleteSample = useCallback(async () => {
    // Delete sample entities using filter() on primary key — avoids loading entire tables into memory.
    // Dexie's filter() on a Collection still iterates the index but only pulls matching keys,
    // which is far cheaper than .toArray() + in-memory filter + bulkDelete.
    const tables = [
      db.notes, db.tasks, db.timelineEvents, db.standaloneIOCs,
      db.whiteboards, db.timelines, db.tags, db.chatThreads,
    ] as const;
    await Promise.all(
      tables.map(table =>
        table.filter(item => isSampleEntity(item.id)).delete()
      )
    );
    await db.folders.delete('sample-investigation');

    handleImportComplete();
    if (selectedFolderId === 'sample-investigation') {
      setSelectedFolderId(undefined);
    }
    activityLog.log('data', 'delete', 'Removed sample investigation "Operation DARK GLACIER"');
    addToast('success', tt('investigation.sampleRemoved'));
  }, [handleImportComplete, selectedFolderId, activityLog, setSelectedFolderId, addToast]);

  // ?demo URL parameter handling
  useEffect(() => {
    if (demoProcessedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('demo')) return;
    demoProcessedRef.current = true;
    // Clean the ?demo param from the URL so it doesn't linger
    const url = new URL(window.location.href);
    url.searchParams.delete('demo');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    if (sampleLoaded) {
      setSelectedFolderId('sample-investigation');
      navigateTo('notes');
      setSelectedNoteId('sample-note-1');
      setShowDemoModal(true);
    } else {
      handleLoadSample().then(() => setShowDemoModal(true));
    }
  }, [sampleLoaded, handleLoadSample, navigateTo, setSelectedFolderId]);

  // PWA share_target handler — fires when the user shares a URL/text to ThreatCaddy from
  // a mobile browser. The manifest delivers ?share_title=&share_text=&share_url= on the root.
  // Inbound content is treated as DATA only — no evaluation or execution of shared text.
  useEffect(() => {
    if (shareProcessedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const shareTitle = params.get('share_title');
    const shareText = params.get('share_text');
    const shareUrl = params.get('share_url');
    if (!shareTitle && !shareText && !shareUrl) return;
    shareProcessedRef.current = true;
    // Clean share params from URL so they don't persist on refresh
    const url = new URL(window.location.href);
    url.searchParams.delete('share_title');
    url.searchParams.delete('share_text');
    url.searchParams.delete('share_url');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    if (!selectedFolderId) {
      addToast('info', 'Open an investigation to capture this shared content');
      return;
    }
    const titleLine = shareTitle ? `# ${shareTitle}\n\n` : '';
    const urlLine = shareUrl ? `${shareUrl}\n\n` : '';
    const body = `${titleLine}${urlLine}${shareText ?? ''}`.trim();
    void notes.createNote({ folderId: selectedFolderId, content: body }).then((note) => {
      navigateTo('notes');
      setSelectedNoteId(note.id);
      addToast('success', 'Captured shared content as a new note');
    });
  }, [selectedFolderId, notes, navigateTo, setSelectedNoteId, addToast]);

  // Keyboard shortcuts
  // Search overlay navigation callbacks
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSearchNavigateToTask = useCallback((_id: string) => {
    setSelectedFolderId(undefined);
    setSelectedTag(undefined);
    navigateTo('tasks');
  }, [navigateTo, setSelectedFolderId]);

  const handleSearchNavigateToTimeline = useCallback((id: string) => {
    const ev = timeline.events.find((e) => e.id === id);
    if (ev) {
      setSelectedTimelineId(ev.timelineId);
      navigateTo('timeline', { selectedTimelineId: ev.timelineId });
    } else {
      navigateTo('timeline');
    }
  }, [timeline.events, navigateTo]);

  const handleSearchNavigateToWhiteboard = useCallback((id: string) => {
    setSelectedWhiteboardId(id);
    navigateTo('whiteboard', { selectedWhiteboardId: id });
  }, [navigateTo]);

  const handleSearchNavigateToIOC = useCallback(() => {
    navigateTo('ioc-stats');
  }, [navigateTo]);

  const handleSearchNavigateToChat = useCallback((id: string) => {
    setSelectedChatThreadId(id);
    navigateTo('chat');
  }, [navigateTo]);

  // ── Command-palette quick-pivot callbacks ─────────────────────────────────

  const handlePaletteSwitchInvestigation = useCallback((folderId: string) => {
    setSelectedFolderId(folderId);
    setSearchOverlayOpen(false);
  }, [setSelectedFolderId, setSearchOverlayOpen]);

  const handlePaletteNavigateToView = useCallback((view: ViewMode) => {
    navigateTo(view);
    setSearchOverlayOpen(false);
  }, [navigateTo, setSearchOverlayOpen]);

  const handleDraftHuntNarrative = useCallback(async (iocValue: string, iocType: string) => {
    try {
      const thread = await loggedCreateChatThread({
        title: `Hunt narrative: ${iocValue}`,
        folderId: selectedFolderId,
        model: settings.llmDefaultModel || 'claude-sonnet-4-6',
        provider: (settings.llmDefaultProvider as ChatThread['provider']) || 'anthropic',
        tags: ['hunt-narrative'],
      });
      const investigationName = folders.find((f) => f.id === selectedFolderId)?.name ?? 'N/A';
      const prompt = [
        `Draft a threat hunt narrative for the following indicator:`,
        ``,
        `IOC: ${iocValue} (${iocType})`,
        `Investigation: ${investigationName}`,
        ``,
        `Cover: what this IOC suggests, hunting queries for logs/network/endpoint, likely hypotheses, recommended next steps, and relevant MITRE ATT&CK techniques.`,
      ].join('\n');
      setPendingChatDraft({ id: `hunt-${iocValue}-${Date.now()}`, threadId: thread.id, text: prompt });
      setSelectedChatThreadId(thread.id);
      navigateTo('chat');
    } catch { /* ignore */ }
  }, [loggedCreateChatThread, selectedFolderId, settings.llmDefaultModel, settings.llmDefaultProvider, folders, navigateTo]);

  // ─────────────────────────────────────────────────────────────────────────

  const [workspacePanelLaunchRequest, setWorkspacePanelLaunchRequest] = useState<WorkspacePanelLaunchRequest | null>(null);
  const [assistantWorkspacePanelLaunchRequest, setAssistantWorkspacePanelLaunchRequest] = useState<AssistantWorkspacePanelLaunchRequest | null>(null);
  const handleOpenWorkspacePanel = useCallback((view: WorkspacePanelLaunchView) => {
    if (!WORKSPACE_PANEL_LAUNCH_DESCRIPTORS[view]) return;

    closeSettings();
    setShowTrash(false);
    setShowArchive(false);
    setWorkspacePanelLaunchRequest((current) => ({
      view,
      requestId: (current?.requestId ?? 0) + 1,
    }));
    navigateTo('workspace');
  }, [closeSettings, navigateTo, setShowArchive, setShowTrash]);
  const handleWorkspacePanelLaunchHandled = useCallback((requestId: number) => {
    setWorkspacePanelLaunchRequest((current) => (
      current?.requestId === requestId ? null : current
    ));
  }, []);
  const handleOpenAssistantWorkspacePanel = useCallback((view: AssistantWorkspacePanelLaunchView) => {
    if (!ASSISTANT_WORKSPACE_PANEL_LAUNCH_DESCRIPTORS[view]) return;

    closeSettings();
    setShowTrash(false);
    setShowArchive(false);
    setAssistantWorkspacePanelLaunchRequest((current) => ({
      view,
      requestId: (current?.requestId ?? 0) + 1,
    }));
    navigateTo('workspace');
  }, [closeSettings, navigateTo, setShowArchive, setShowTrash]);
  const handleAssistantWorkspacePanelLaunchHandled = useCallback((requestId: number) => {
    setAssistantWorkspacePanelLaunchRequest((current) => (
      current?.requestId === requestId ? null : current
    ));
  }, []);

  useKeyboardShortcuts({
    onNewNote: handleNewNote,
    onNewTask: handleNewTask,
    onSearch: () => setSearchOverlayOpen(true),
    onSave: handleQuickSave,
    onOpenFile: openFilePicker,
    onTogglePreview: handleToggleEditorMode,
    onSwitchView: (view) => { navigateTo(view); },
    onEscape: () => {
      ui.closeAllModals();
    },
    onShowShortcuts: () => setShowShortcutsPanel(true),
  });

  // Determine list title
  let listTitle = 'Notes';
  if (selectedFolderId) {
    const folder = folders.find((f) => f.id === selectedFolderId);
    listTitle = folder?.name || 'Investigation';
  }
  else if (selectedTag) listTitle = `#${selectedTag}`;

  const sidebarProps = useMemo(() => ({
    noteCounts: { ...noteCounts, trashed: combinedTrashedCount, archived: combinedArchivedCount },
    taskCounts: tasks.taskCounts,
    timelineCounts: timeline.eventCounts,
    timelines,
    onCreateTimeline: (name: string) => loggedCreateTimeline(name),
    onDeleteTimeline: (id: string) => { loggedDeleteTimeline(id); if (selectedTimelineId === id) setSelectedTimelineId(undefined); },
    onRenameTimeline: (id: string, name: string) => updateTimeline(id, { name }),
    timelineEventCounts,
    whiteboards,
    onCreateWhiteboard: (name?: string) => loggedCreateWhiteboard(name, selectedFolderId),
    onDeleteWhiteboard: (id: string) => { loggedDeleteWhiteboard(id); if (selectedWhiteboardId === id) setSelectedWhiteboardId(undefined); },
    onRenameWhiteboard: (id: string, name: string) => updateWhiteboard(id, { name }),
    whiteboardCount: whiteboardCounts.total,
    onRenameTag: (id: string, name: string) => updateTag(id, { name }),
    onDeleteTag: loggedDeleteTag,
    investigationScopedCounts,
    evidenceCount: activeEvidenceItems.length,
    productCount: activeProducts.length,
    chatCount: chatsHook.threadCounts.total,
    fortuneIntActive: fortuneIntMode,
    onOpenCaddyAI: handleOpenCaddyAI,
    onOpenFortuneInt: handleOpenFortuneInt,
    onOpenWorkspacePanel: handleOpenWorkspacePanel,
    onOpenAssistantWorkspacePanel: handleOpenAssistantWorkspacePanel,
    serverConnected: auth.connected,
  }), [noteCounts, combinedTrashedCount, combinedArchivedCount, tasks.taskCounts, timeline.eventCounts, timelines, selectedTimelineId, loggedCreateTimeline, loggedDeleteTimeline, updateTimeline, timelineEventCounts, whiteboards, selectedFolderId, selectedWhiteboardId, loggedCreateWhiteboard, loggedDeleteWhiteboard, updateWhiteboard, whiteboardCounts, updateTag, loggedDeleteTag, investigationScopedCounts, activeEvidenceItems.length, activeProducts.length, chatsHook.threadCounts.total, fortuneIntMode, handleOpenCaddyAI, handleOpenFortuneInt, handleOpenWorkspacePanel, handleOpenAssistantWorkspacePanel, auth.connected]);

  // CaddyAgent hook — manages auto-repeating loop
  const caddyAgent = useCaddyAgent({
    folder: selectedFolder,
    settings,
    onEntitiesChanged: () => { notes.reload(); tasks.reload(); timeline.reload(); standaloneIOCsHook.reload(); evidenceItemsHook.reload(); chatsHook.reload(); },
  });

  const agentProfilesHook = useAgentProfiles();
  const agentDeploymentsHook = useAgentDeployments(selectedFolderId);
  const serverAgents = useServerAgents({
    investigationId: selectedFolderId,
    deployments: agentDeploymentsHook.deployments,
    profiles: agentProfilesHook.profiles,
    enabled: agentDeploymentsHook.deployments.some(d => d.serverSideEnabled),
  });

  const investigationEntityCounts = useMemo(() => {
    if (!editingFolderId) return { notes: 0, tasks: 0, events: 0, whiteboards: 0 };
    return {
      notes: notes.notes.filter((n) => n.folderId === editingFolderId && !n.trashed).length,
      tasks: tasks.tasks.filter((t) => t.folderId === editingFolderId && !t.trashed).length,
      events: timeline.events.filter((e) => e.folderId === editingFolderId && !e.trashed).length,
      whiteboards: whiteboards.filter((w) => w.folderId === editingFolderId && !w.trashed).length,
    };
  }, [editingFolderId, notes.notes, tasks.tasks, timeline.events, whiteboards]);

  const assistantWorkspaceActive = activeView === 'caddyassistant'
    || activeView === 'cademail'
    || activeView === 'calendarcaddy';
  const dashboardWorkspaceActive = activeView === 'dashboard';
  const activityWorkspaceActive = activeView === 'activity';
  const productsWorkspaceActive = activeView === 'products';
  const notesWorkspaceActive = activeView === 'notes';
  const tasksWorkspaceActive = activeView === 'tasks';
  const evidenceWorkspaceActive = activeView === 'evidence';
  const timelineWorkspaceActive = activeView === 'timeline';
  const whiteboardsWorkspaceActive = activeView === 'whiteboard';
  const graphWorkspaceActive = activeView === 'graph';
  const reportCaddyWorkspaceActive = activeView === 'reportcaddy';
  const iocsWorkspaceActive = activeView === 'ioc-stats';
  const experimentalWorkspaceActive = activeView === 'experimental';
  const agentCaddyWorkspaceActive = activeView === 'agent';
  const chatWorkspaceActive = activeView === 'chat';
  const workspaceRouteActive = activeView === 'workspace';
  const appWorkspaceActive = workspaceRouteActive || assistantWorkspaceActive || dashboardWorkspaceActive || activityWorkspaceActive || productsWorkspaceActive || notesWorkspaceActive || tasksWorkspaceActive || evidenceWorkspaceActive || timelineWorkspaceActive || whiteboardsWorkspaceActive || graphWorkspaceActive || reportCaddyWorkspaceActive || iocsWorkspaceActive || experimentalWorkspaceActive || agentCaddyWorkspaceActive || chatWorkspaceActive;
  const assistantWorkspaceVisible = assistantWorkspaceActive && !showSettings && !showTrash && !showArchive;
  const dashboardWorkspaceVisible = dashboardWorkspaceActive && !showSettings && !showTrash && !showArchive;
  const activityWorkspaceVisible = activityWorkspaceActive && !showSettings && !showTrash && !showArchive;
  const productsWorkspaceVisible = productsWorkspaceActive && !showSettings && !showTrash && !showArchive;
  const notesWorkspaceVisible = notesWorkspaceActive && !showSettings && !showTrash && !showArchive;
  const tasksWorkspaceVisible = tasksWorkspaceActive && !showSettings && !showTrash && !showArchive;
  const evidenceWorkspaceVisible = evidenceWorkspaceActive && !showSettings && !showTrash && !showArchive;
  const timelineWorkspaceVisible = timelineWorkspaceActive && !showSettings && !showTrash && !showArchive;
  const whiteboardsWorkspaceVisible = whiteboardsWorkspaceActive && !showSettings && !showTrash && !showArchive;
  const graphWorkspaceVisible = graphWorkspaceActive && !showSettings && !showTrash && !showArchive;
  const reportCaddyWorkspaceVisible = reportCaddyWorkspaceActive && !showSettings && !showTrash && !showArchive;
  const iocsWorkspaceVisible = iocsWorkspaceActive && !showSettings && !showTrash && !showArchive;
  const experimentalWorkspaceVisible = experimentalWorkspaceActive && !showSettings && !showTrash && !showArchive;
  const agentCaddyWorkspaceVisible = agentCaddyWorkspaceActive && !showSettings && !showTrash && !showArchive;
  const chatWorkspaceVisible = chatWorkspaceActive && !showSettings && !showTrash && !showArchive;
  const workspaceRouteVisible = workspaceRouteActive && !showSettings && !showTrash && !showArchive;
  const appWorkspaceVisible = appWorkspaceActive && !showSettings && !showTrash && !showArchive;
  const assistantShellView = activeView === 'cademail'
    ? 'email'
    : activeView === 'calendarcaddy'
      ? 'calendar'
      : 'overview';
  const routeSwitchHidden = (
    activeView === 'graph'
    || activeView === 'chat'
    || appWorkspaceActive
  ) && !showSettings && !showTrash && !showArchive;
  const [appWorkspaceMounted, setAppWorkspaceMounted] = useState(appWorkspaceActive);
  const appWorkspaceShouldRender = appWorkspaceMounted || appWorkspaceActive;

  useEffect(() => {
    if (appWorkspaceActive) {
      setAppWorkspaceMounted(true);
    }
  }, [appWorkspaceActive]);

  const handleCreateWorkspaceNote = useCallback(async () => {
    if (showQuickCapture) return;
    setShowTrash(false);
    setShowArchive(false);
    const folder = selectedFolderId ? folders.find((f) => f.id === selectedFolderId) : undefined;
    noteNavGraceRef.current = true;
    try {
      const note = await loggedCreateNote({
        folderId: selectedFolderId,
        clsLevel: folder?.clsLevel,
      });
      await notes.reload();
      setSelectedNoteId(note.id);
      window.setTimeout(() => { noteNavGraceRef.current = false; }, 2000);
    } catch (error) {
      noteNavGraceRef.current = false;
      throw error;
    }
  }, [folders, loggedCreateNote, noteNavGraceRef, notes, selectedFolderId, setSelectedNoteId, showQuickCapture]);

  const handleNotesWorkspaceCreate = workspaceRouteActive ? handleCreateWorkspaceNote : handleNewNote;

  // Auto-open Notes/Whiteboards instead of leaving an empty-state "create one" prompt:
  // no investigation selected -> fresh page; investigation selected -> its most recently
  // updated note/whiteboard, or fresh if it has none. Only fires on genuine arrival (view
  // just became active, or the investigation changed) — not on every selection change, so
  // explicit user actions like "back to list" aren't fought by re-opening something.
  const notesAutoOpenRef = useRef<{ view: ViewMode | null; folderId: string | undefined }>({ view: null, folderId: undefined });
  useEffect(() => {
    if (activeView !== 'notes' || showTrash || showArchive) return;
    const prev = notesAutoOpenRef.current;
    const enteredView = prev.view !== 'notes';
    const folderChanged = prev.folderId !== selectedFolderId;
    notesAutoOpenRef.current = { view: activeView, folderId: selectedFolderId };
    if (!enteredView && !folderChanged) return;
    if (selectedNoteId) return;
    if (!selectedFolderId) {
      void handleNotesWorkspaceCreate();
      return;
    }
    const candidates = resolvedNotes.filter((n) => n.folderId === selectedFolderId && !n.trashed && !n.archived && !n.isFolder);
    if (candidates.length > 0) {
      setSelectedNoteId(candidates.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b)).id);
    } else {
      void handleNotesWorkspaceCreate();
    }
  }, [activeView, selectedFolderId, selectedNoteId, resolvedNotes, showTrash, showArchive, handleNotesWorkspaceCreate, setSelectedNoteId]);

  const whiteboardsAutoOpenRef = useRef<{ view: ViewMode | null; folderId: string | undefined }>({ view: null, folderId: undefined });
  useEffect(() => {
    if (activeView !== 'whiteboard' || showTrash || showArchive) return;
    const prev = whiteboardsAutoOpenRef.current;
    const enteredView = prev.view !== 'whiteboard';
    const folderChanged = prev.folderId !== selectedFolderId;
    whiteboardsAutoOpenRef.current = { view: activeView, folderId: selectedFolderId };
    if (!enteredView && !folderChanged) return;
    if (selectedWhiteboardId) return;
    if (!selectedFolderId) {
      void handleNewWhiteboard();
      return;
    }
    const candidates = resolvedWhiteboards.filter((w) => w.folderId === selectedFolderId && !w.trashed && !w.archived);
    if (candidates.length > 0) {
      setSelectedWhiteboardId(candidates.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b)).id);
    } else {
      void handleNewWhiteboard();
    }
  }, [activeView, selectedFolderId, selectedWhiteboardId, resolvedWhiteboards, showTrash, showArchive, handleNewWhiteboard, setSelectedWhiteboardId]);

  const handleCreateWorkspaceTypedNote = useCallback(async (type: NoteType) => {
    if (showQuickCapture) return;
    setShowTrash(false);
    setShowArchive(false);
    const folder = selectedFolderId ? folders.find((f) => f.id === selectedFolderId) : undefined;
    if (type === 'sticky') {
      const note = await loggedCreateNote({
        noteType: 'sticky',
        title: 'Jot',
        folderId: selectedFolderId,
        clsLevel: folder?.clsLevel,
      });
      void note;
      await notes.reload();
      setShowJotsPanel(true);
      return;
    }
    if (type === 'definition') {
      const existing = notes.notes.find((n) => n.folderId === selectedFolderId && n.noteType === 'definition' && !n.trashed);
      if (existing) {
        addToast('info', 'This investigation already has a Definition note.');
        await notes.reload();
        setSelectedNoteId(existing.id);
        return;
      }
    }
    const defaultContent = type === 'definition'
      ? '## Scope\n\n## Hypothesis\n\n## Objective\n'
      : type === 'journal'
        ? `### ${new Date().toLocaleString()}\n\n`
        : '';
    noteNavGraceRef.current = true;
    try {
      const note = await loggedCreateNote({
        noteType: type,
        title: type === 'journal' ? 'Journal' : type === 'definition' ? 'Definition' : 'Untitled Note',
        content: defaultContent,
        folderId: selectedFolderId,
        clsLevel: folder?.clsLevel,
      });
      await notes.reload();
      setSelectedNoteId(note.id);
      window.setTimeout(() => { noteNavGraceRef.current = false; }, 2000);
    } catch (error) {
      noteNavGraceRef.current = false;
      throw error;
    }
  }, [folders, loggedCreateNote, noteNavGraceRef, notes, selectedFolderId, setSelectedNoteId, showQuickCapture, addToast, setShowJotsPanel]);

  const handleNotesWorkspaceCreateTyped = workspaceRouteActive ? handleCreateWorkspaceTypedNote : handleNewTypedNote;

  const jotsCount = selectedFolderId
    ? notes.notes.filter((n) => n.noteType === 'sticky' && n.folderId === selectedFolderId && !n.trashed && !n.archived).length
    : 0;
  const allJotsCount = notes.notes.filter((n) => n.noteType === 'sticky' && !n.trashed && !n.archived).length;

  const filterBar = !assistantWorkspaceActive && !workspaceRouteActive && (selectedFolderId || selectedTag) ? (
    <ActiveFilterBar
      folderName={selectedFolder?.name}
      folderColor={selectedFolder?.color}
      folderStatus={selectedFolder?.status}
      folderClsLevel={selectedFolder?.clsLevel}
      tagName={selectedTag}
      tagColor={selectedTagObj?.color}
      onClear={() => { setSelectedFolderId(undefined); setSelectedTag(undefined); }}
      onEditFolder={selectedFolderId ? () => setEditingFolderId(selectedFolderId) : undefined}
      playbookExecution={selectedFolder?.playbookExecution}
      onOpenJots={selectedFolderId ? () => setShowJotsPanel(true) : undefined}
      jotsCount={jotsCount}
    />
  ) : null;
  const remoteInvestigationBanner = investigationMode === 'remote' && selectedFolderId && !assistantWorkspaceActive ? (
    <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex items-center justify-between">
      <span>Viewing remote investigation — data is not stored locally</span>
      <button
        onClick={() => handleSyncLocally(selectedFolderId)}
        className="text-xs px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 transition-colors"
      >
        Sync locally
      </button>
    </div>
  ) : null;

  // Share receiver — early return on all devices
  if (shareData) {
    return (
      <ShareReceiver
        encodedData={shareData}
        theme={settings.theme}
        onDismiss={() => {
          setShareData(null);
          history.replaceState(null, '', location.pathname + location.search);
        }}
        onSave={handleSaveSharedPayload}
      />
    );
  }

  // Wait for core data before rendering to prevent empty-content flash on refresh
  const dataReady = startupGraceExpired || (!notes.loading && !foldersLoading && !tasks.loading);
  if (!dataReady) {
    return (
      <div className="min-h-screen bg-gray-950 dark:bg-gray-950 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 rounded-full border-2 border-gray-700 border-t-purple animate-spin" />
          <p className="text-sm font-medium text-gray-300">Loading ThreatCaddy</p>
          <p className="mt-1 text-xs text-gray-500">Opening the local workspace database...</p>
        </div>
      </div>
    );
  }

  // Mobile exec mode — replace entire UI with executive dashboard
  if (isMobile && !forceAnalystMode) {
    return (
      <ScreenshareContext.Provider value={screenshareCtx}>
      <ActivityLogContext.Provider value={activityLog.log}>
        <ErrorBoundary region="exec-dashboard">
        <Suspense fallback={<div className="flex-1 flex items-center justify-center text-gray-500">Loading…</div>}>
        <ExecDashboard
          folders={folders}
          allNotes={screensafeNotes}
          allTasks={screensafeTasks}
          allEvents={screensafeTimelineEvents}
          allWhiteboards={screensafeWhiteboards}
          allIOCs={screensafeStandaloneIOCs}
          allTimelines={timelines}
          allTags={tags}
          allChatThreads={chatsHook.threads}
          activityEntries={activityLog.entries}
          theme={settings.theme}
          onToggleTheme={toggleTheme}
          onSwitchToAnalystMode={(folderId, view) => {
            setForceAnalystMode(true);
            if (folderId) setSelectedFolderId(folderId);
            if (view) setActiveView(view);
            else if (folderId) setActiveView('notes');
          }}
        />
        </Suspense>
        </ErrorBoundary>
      </ActivityLogContext.Provider>
      <ToastContainer />
      </ScreenshareContext.Provider>
    );
  }

  const notesWorkspace = (
    <div
      data-tour="notes-editor"
      data-notes-workspace="true"
      data-notes-has-selection={selectedNote ? 'true' : 'false'}
      ref={notesContainerRef}
      className="flex min-h-0 flex-1 overflow-hidden bg-bg-primary"
    >
      <div
        data-notes-list-pane="true"
        className={cn(
          'shrink-0 h-full overflow-hidden',
          !noteListDragging && 'transition-[width] duration-150',
          selectedNote ? 'hidden md:block' : 'w-full md:block'
        )}
        style={selectedNote ? { width: noteListCollapsed ? 0 : noteListWidth } : undefined}
      >
        <NoteList
          notes={ssFilteredNotes}
          selectedId={selectedNoteId}
          onSelect={setSelectedNoteId}
          sort={sort}
          onSortChange={setSort}
          title={listTitle}
          selectedIOCTypes={selectedIOCTypes}
          onIOCTypesChange={setSelectedIOCTypes}
          folders={folders}
          emptyHint={hiddenLocalNotesHint}
          onCreate={handleNotesWorkspaceCreate}
          onCreateTyped={selectedFolderId ? handleNotesWorkspaceCreateTyped : undefined}
          onOpenJots={selectedFolderId ? () => setShowJotsPanel(true) : undefined}
          onImportMeeting={selectedFolderId ? () => setShowMeetingImport(true) : undefined}
          attachedTemplates={selectedFolder ? attachedInvestigationTemplates : []}
          onCreateFromTemplate={handleCreateNoteFromTemplate}
          onManageTemplates={selectedFolder ? () => setShowInvestigationTemplatePicker(true) : undefined}
          tiExportConfig={{
            defaultClsLevel: settings.tiDefaultClsLevel,
            defaultReportSource: settings.tiDefaultReportSource,
          }}
          onTrash={loggedTrashNote}
          onCreateFolder={async (name, icon) => {
            const { nanoid } = await import('nanoid');
            await db.notes.add({
              id: nanoid(), title: name, content: '', folderId: selectedFolderId,
              tags: icon ? [`icon:${icon}`] : [], pinned: false, archived: false, trashed: false, isFolder: true,
              createdAt: Date.now(), updatedAt: Date.now(),
            });
            notes.reload();
          }}
          onMoveToFolder={async (noteId, parentNoteId) => {
            await db.notes.update(noteId, { parentNoteId: parentNoteId || undefined, updatedAt: Date.now() });
            notes.reload();
          }}
          onRenameFolder={async (noteId, newName) => {
            await db.notes.update(noteId, { title: newName, updatedAt: Date.now() });
            notes.reload();
          }}
          onDeleteFolder={async (noteId, action) => {
            const children = await db.notes.where('parentNoteId').equals(noteId).toArray();
            const now = Date.now();
            if (action === 'trash_contents') {
              for (const child of children) {
                await db.notes.update(child.id, { trashed: true, trashedAt: now, updatedAt: now });
              }
            } else {
              for (const child of children) {
                await db.notes.update(child.id, { parentNoteId: undefined, updatedAt: now });
              }
            }
            await db.notes.update(noteId, { trashed: true, trashedAt: now, updatedAt: now });
            notes.reload();
          }}
        />
      </div>
      {/* Resize handle with collapse/expand toggle — desktop only */}
      <div
        data-notes-splitter="true"
        className={cn(
          'hidden md:flex shrink-0 relative items-center',
          noteListDragging ? 'bg-accent/50' : 'bg-gray-700 hover:bg-accent/30',
          noteListCollapsed ? 'w-2 cursor-pointer' : 'w-1 cursor-col-resize'
        )}
        onMouseDown={noteListCollapsed ? undefined : handleNoteListDragStart}
        onClick={noteListCollapsed ? toggleNoteListCollapse : undefined}
      >
        {!noteListCollapsed && <div className="absolute inset-y-0 -left-1 -right-1" />}
        <button
          onClick={(e) => { e.stopPropagation(); toggleNoteListCollapse(); }}
          className="absolute top-1/2 -translate-y-1/2 -right-3 z-10 w-6 h-6 rounded-full bg-gray-800 border border-gray-600 flex items-center justify-center hover:bg-gray-700 hover:border-accent/50 transition-colors"
          title={noteListCollapsed ? 'Expand note list' : 'Collapse note list'}
        >
          {noteListCollapsed ? <PanelLeftOpen size={12} /> : <PanelLeftClose size={12} />}
        </button>
      </div>
      <div
        data-notes-editor-pane="true"
        className={cn('flex-1 min-w-0 overflow-hidden', !selectedNote && 'hidden md:block')}
      >
        {selectedNote ? (
          <NoteEditor
            note={selectedNote}
            onUpdate={handleUpdateNoteWithIOCObservation}
            onTrash={loggedTrashNote}
            onRestore={loggedRestoreNote}
            onTogglePin={loggedTogglePin}
            onToggleArchive={loggedToggleArchive}
            allTags={tags}
            folders={folders}
            onCreateTag={loggedCreateTag}
            editorMode={editorMode}
            onEditorModeChange={setEditorMode}
            onBack={() => setSelectedNoteId(undefined)}
            clipsFolderId={clipsFolderId}
            settings={settings}
            allNotes={screensafeNotes}
            allTasks={screensafeTasks}
            allTimelineEvents={screensafeTimelineEvents}
            onNavigateToNote={handleSearchNavigateToNote}
            onShareLink={handleShareNoteLink}
            onSaveAsTemplate={async (n) => {
              await noteTemplatesHook.saveNoteAsTemplate(n);
              addToast('success', tt('investigation.savedAsTemplate', { name: n.title }));
            }}
            whisperEnabled={settings.whisperEnabled && !!whisperEndpoint}
            whisperEndpoint={whisperEndpoint}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-600">
            <FileText size={48} className="mb-3" />
            <p className="text-lg font-medium">Select a note or create one</p>
            <p className="text-sm mt-1">Ctrl+N for quick capture</p>
          </div>
        )}
      </div>
    </div>
  );

  const tasksWorkspace = (
    <TaskListView
      tasks={ssFilteredTasks}
      allTags={tags}
      folders={folders}
      onCreateTag={loggedCreateTag}
      onToggleComplete={loggedToggleComplete}
      onUpdateTask={tasks.updateTask}
      onDeleteTask={loggedDeleteTask}
      onTrashTask={loggedTrashTask}
      onRestoreTask={loggedRestoreTask}
      onToggleArchiveTask={loggedToggleArchiveTask}
      onCreateTask={(data) => loggedCreateTask({ ...data, folderId: data.folderId ?? selectedFolderId, clsLevel: data.clsLevel ?? selectedFolder?.clsLevel })}
      getTasksByStatus={(status) => tasks.getTasksByStatus(status, selectedFolderId)}
      allNotes={screensafeNotes}
      allTimelineEvents={screensafeTimelineEvents}
      scopeLabel={selectedFolder?.name}
      members={investigationMembers}
      currentUserId={auth.user?.id}
    />
  );

  const timelineWorkspace = (
    <TimelineView
      events={ssFilteredTimelineEvents}
      allTags={tags}
      folders={folders}
      onCreateTag={loggedCreateTag}
      onCreateEvent={(data) => loggedCreateEvent({ ...data, folderId: data.folderId ?? selectedFolderId, clsLevel: data.clsLevel ?? selectedFolder?.clsLevel, timelineId: selectedTimelineId || timelines[0]?.id || '' })}
      onUpdateEvent={timeline.updateEvent}
      onDeleteEvent={loggedDeleteEvent}
      onTrashEvent={loggedTrashEvent}
      onRestoreEvent={loggedRestoreEvent}
      onToggleArchiveEvent={loggedToggleArchiveEvent}
      onToggleStar={loggedToggleStar}
      getFilteredEvents={timeline.getFilteredEvents}
      timelines={timelines}
      selectedTimelineId={selectedTimelineId}
      onTimelineReload={reloadTimelines}
      onEventsReload={timeline.reload}
      scopeLabel={selectedFolder?.name}
      selectedFolderId={selectedFolderId}
      openNewForm={pendingNewEvent}
      onNewFormOpened={() => setPendingNewEvent(false)}
    />
  );

  const handlePromoteToEntity = async (kind: CanvasEntityRef['type'], text: string, investigationId: string | undefined, clsLevel: string | undefined) => {
    const folder = investigationId ? folders.find((f) => f.id === investigationId) : undefined;
    // Same TLP-floor rule as tearing into an investigation and as
    // Books (Slice B): binding raises the effective classification,
    // never lowers it.
    const effectiveLevel = effectiveTlpLevel(folder?.clsLevel, clsLevel);
    if (kind === 'note') {
      await notes.createNote({
        title: text.length > 60 ? `${text.slice(0, 60)}…` : text,
        content: text,
        folderId: investigationId,
        clsLevel: effectiveLevel,
      });
    } else if (kind === 'task') {
      await tasks.createTask({
        title: text.length > 80 ? `${text.slice(0, 80)}…` : text,
        description: text,
        folderId: investigationId,
        clsLevel: effectiveLevel,
      });
    } else {
      const detected = extractIOCs(text)[0];
      if (!detected) return;
      await standaloneIOCsHook.createIOC({
        type: detected.type,
        value: detected.value,
        analystNotes: text,
        folderId: investigationId,
        clsLevel: effectiveLevel,
      });
    }
  };

  const whiteboardsWorkspace = (
    <WhiteboardView
      whiteboards={ssFilteredWhiteboards}
      folders={folders}
      allTags={tags}
      onCreateWhiteboard={(name?: string) => loggedCreateWhiteboard(name, selectedFolderId)}
      onUpdateWhiteboard={updateWhiteboard}
      onDeleteWhiteboard={loggedDeleteWhiteboard}
      onTrashWhiteboard={loggedTrashWhiteboard}
      onRestoreWhiteboard={loggedRestoreWhiteboard}
      onToggleArchiveWhiteboard={loggedToggleArchiveWhiteboard}
      onCreateTag={loggedCreateTag}
      selectedWhiteboardId={selectedWhiteboardId ?? null}
      onWhiteboardSelect={(id) => setSelectedWhiteboardId(id ?? undefined)}
      settings={settings}
      entities={canvasEntities}
      onPromoteToEntity={handlePromoteToEntity}
    />
  );

  const graphWorkspace = (visible: boolean) => (
    <GraphView
      visible={visible}
      notes={screensafeNotes}
      tasks={screensafeTasks}
      timelineEvents={screensafeTimelineEvents}
      settings={settings}
      scopedNotes={investigationNotes}
      scopedTasks={investigationTasks}
      scopedTimelineEvents={investigationTimelineEvents}
      standaloneIOCs={screensafeStandaloneIOCs}
      scopedStandaloneIOCs={selectedFolderId ? screensafeStandaloneIOCs.filter((ioc) => ioc.folderId === selectedFolderId) : screensafeStandaloneIOCs}
      onNavigateToNote={handleSearchNavigateToNote}
      onNavigateToTask={() => { setSelectedFolderId(undefined); setSelectedTag(undefined); navigateTo('tasks'); }}
      onNavigateToTimelineEvent={(id) => { const ev = timeline.events.find((e) => e.id === id); if (ev) { setSelectedTimelineId(ev.timelineId); navigateTo('timeline', { selectedTimelineId: ev.timelineId }); } else { navigateTo('timeline'); } }}
      onUpdateNote={notes.updateNote}
      onUpdateTask={tasks.updateTask}
      onUpdateEvent={timeline.updateEvent}
    />
  );

  const iocsWorkspace = (
    <IOCStatsView
      notes={screensafeNotes}
      tasks={screensafeTasks}
      timelineEvents={screensafeTimelineEvents}
      standaloneIOCs={screensafeStandaloneIOCs.filter((i) => !i.trashed && !i.archived)}
      settings={settings}
      scopedNotes={investigationNotes}
      scopedTasks={investigationTasks}
      scopedTimelineEvents={investigationTimelineEvents}
      scopedStandaloneIOCs={investigationStandaloneIOCs.filter((i) => !i.trashed && !i.archived)}
      selectedFolderId={selectedFolderId}
      selectedFolderName={selectedFolder?.name}
      folders={folders}
      allTags={tags}
      allStandaloneIOCs={screensafeStandaloneIOCs}
      filteredStandaloneIOCs={ssFilteredStandaloneIOCs}
      onCreateIOC={loggedCreateIOCWithAuto}
      onUpdateIOC={standaloneIOCsHook.updateIOC}
      onDeleteIOC={loggedDeleteIOC}
      onTrashIOC={loggedTrashIOC}
      onRestoreIOC={loggedRestoreIOC}
      onToggleArchiveIOC={loggedToggleArchiveIOC}
      onOpenSettings={() => { openSettings('integrations'); }}
      onNavigateToSource={(sourceType, sourceId) => {
        if (sourceType === 'note') {
          handleSearchNavigateToNote(sourceId);
        } else if (sourceType === 'task') {
          navigateTo('tasks');
        } else if (sourceType === 'event') {
          const ev = timeline.events.find((e) => e.id === sourceId);
          if (ev?.timelineId) {
            setSelectedTimelineId(ev.timelineId);
            navigateTo('timeline', { selectedTimelineId: ev.timelineId });
          } else {
            navigateTo('timeline');
          }
        }
      }}
      investigationMembers={investigationMembers}
      iocTableColumns={settings.iocTableColumns}
      onUpdateTableColumns={(columns) => updateSettings({ iocTableColumns: columns })}
    />
  );

  const evidenceWorkspace = (
    <EvidenceView
      folderId={selectedFolderId}
      folderName={selectedFolder?.name}
      items={ssFilteredEvidenceItems}
      onImportFiles={handleEvidenceImport}
      onDeduplicate={handleDeduplicateEvidence}
      onCreateTableIOCs={handleCreateTableIOCsFromEvidence}
      onOpenChat={() => navigateTo('chat')}
      onAnalyzeImage={handleAnalyzeImageEvidence}
      onPromoteToReportDraft={handlePromoteEvidenceToReportDraft}
    />
  );

  const reportCaddyWorkspace = (
    <ReportCaddyView
      folderId={selectedFolderId}
      folderName={selectedFolder?.name}
      settings={settings}
      reports={reportsHook.reports}
      onCreateReport={reportsHook.createReport}
      onUpdateReportSection={reportsHook.updateSection}
      onUpdateReportTitle={reportsHook.updateTitle}
      onDeleteReport={reportsHook.deleteReport}
      onShipReportToProducts={handleShipReportToProducts}
      onCreateReportCheckpoint={reportsHook.createCheckpoint}
      onRestoreReportCheckpoint={reportsHook.restoreCheckpoint}
      onDeleteReportCheckpoint={reportsHook.deleteCheckpoint}
    />
  );

  const experimentalWorkbenchWorkspace = (
    <ExperimentalView
      folder={selectedFolder}
      settings={settings}
      onUpdateSettings={updateSettings}
      onOpenChat={() => navigateTo('chat')}
    />
  );

  const agentCaddyWorkspace = selectedFolder ? (
    <AgentPanel
      folder={selectedFolder}
      settings={settings}
      agentRunning={caddyAgent.running}
      agentProgress={caddyAgent.progress}
      agentStreamingContent={caddyAgent.streamingContent}
      agentError={caddyAgent.error}
      agentStatus={caddyAgent.agentStatus}
      onRunOnce={caddyAgent.runOnce}
      onNavigateToChat={(threadId) => {
        setSelectedChatThreadId(threadId);
        setActiveView('chat');
      }}
      onNavigateToNote={(noteId) => {
        handleSearchNavigateToNote(noteId);
      }}
      onEntitiesChanged={() => { notes.reload(); tasks.reload(); timeline.reload(); standaloneIOCsHook.reload(); evidenceItemsHook.reload(); chatsHook.reload(); }}
      onOpenSettings={(tab) => { openSettings(tab); }}
      onFolderChanged={reloadFolders}
      profiles={agentProfilesHook.profiles}
      deployments={agentDeploymentsHook.deployments}
      onDeployProfile={(profile) => agentDeploymentsHook.deployProfile(profile)}
      onRemoveDeployment={agentDeploymentsHook.removeDeployment}
      serverConnected={!!auth.connected}
      serverRegistered={serverAgents.serverRegistered}
      serverRunning={serverAgents.serverRunning}
      onRegisterServer={serverAgents.registerServerAgents}
      onUnregisterServer={serverAgents.unregisterServerAgents}
    />
  ) : (
    <AgentDashboard
      folders={folders}
      onOpenInvestigation={(folderId) => {
        setSelectedFolderId(folderId);
        setActiveView('agent');
      }}
      onOpenSettings={(tab) => { openSettings(tab); }}
    />
  );

  const chatWorkspace = (
    <ChatView
      threads={ssFilteredChatThreads}
      onCreateThread={loggedCreateChatThread}
      onUpdateThread={chatsHook.updateThread}
      onAddMessage={chatsHook.addMessage}
      onTrashThread={loggedTrashChatThread}
      onShareThread={handleShareChatThread}
      settings={settings}
      onUpdateSettings={updateSettings}
      onEntitiesChanged={() => { notes.reload(); tasks.reload(); timeline.reload(); standaloneIOCsHook.reload(); evidenceItemsHook.reload(); chatsHook.reload(); }}
      onNavigateToEntity={(type, id) => {
        if (type === 'note') { handleSearchNavigateToNote(id); }
        else if (type === 'task') { navigateTo('tasks'); }
        else if (type === 'event') { const ev = timeline.events.find((e) => e.id === id); setSelectedTimelineId(ev?.timelineId); navigateTo('timeline', { selectedTimelineId: ev?.timelineId }); }
        else if (type === 'ioc') { navigateTo('graph'); }
      }}
      onOpenSettings={(tab) => { openSettings(tab); }}
      fortuneIntMode={fortuneIntMode}
      onActivateFortuneInt={handleOpenFortuneInt}
      fortuneIntOpenRequest={fortuneIntOpenRequest}
      pendingDraft={pendingChatDraft}
      onPendingDraftConsumed={(id) => setPendingChatDraft((current) => current?.id === id ? null : current)}
    />
  );

  return (
    <ScreenshareContext.Provider value={screenshareCtx}>
    <ActivityLogContext.Provider value={activityLog.log}>
      {/* Analyst mode back-pill — desktop-style banner hidden on narrow viewports */}
      {isMobile && forceAnalystMode && (
        <div className="hidden sm:flex bg-accent/10 border-b border-accent/20 px-3 py-2 items-center justify-between text-xs shrink-0">
          <span className="text-text-secondary">Analyst Mode — optimized for desktop</span>
          <button
            onClick={() => setForceAnalystMode(false)}
            className="text-accent font-medium ms-2 whitespace-nowrap"
          >
            {tExec('dashboard.backToExecView')}
          </button>
        </div>
      )}
      {showFileEncryptionWarning && !fileEncryptionDismissed && (
        <div className="bg-yellow-900/30 border-b border-yellow-700/40 px-3 py-2 flex items-center justify-between text-xs shrink-0 gap-3">
          <span className="text-yellow-300">
            Running standalone on file:// without encryption. Other local HTML files can access your data.
            Content Security Policy is not enforced in standalone mode.{' '}
            <button
              onClick={() => { openSettings(); }}
              className="underline text-yellow-200 font-medium"
            >
              Enable encryption
            </button>{' '}
            in Settings to protect it.
          </span>
          <button
            onClick={dismissFileEncryptionWarning}
            className="text-yellow-400 hover:text-yellow-200 font-medium whitespace-nowrap"
          >
            Dismiss
          </button>
        </div>
      )}
      <AppLayout
        bgImageEnabled={settings.bgImageEnabled}
        bgImageOpacity={settings.bgImageOpacity}
        bgImagePosX={settings.bgImagePosX}
        bgImagePosY={settings.bgImagePosY}
        bgImageZoom={settings.bgImageZoom}
        bgImageBlur={settings.bgImageBlur}
        bgEffectPattern={settings.bgEffectPattern}
        bgEffectColor={settings.bgEffectColor}
        bgEffectIntensity={settings.bgEffectIntensity}
        bgEffectSize={settings.bgEffectSize}
        bgGlowIntensity={settings.bgGlowIntensity}
        bgGlowColor={settings.bgGlowColor}
        bgParticleGlow={settings.bgParticleGlow}
        bgEffectTrail={settings.bgEffectTrail}
        theme={settings.theme}
        header={
          <ErrorBoundary region="header">
          <Header
            theme={settings.theme}
            onToggleTheme={toggleTheme}
            onQuickNote={handleNewNote}
            onNewNote={() => setShowQuickCapture(true)}
            onNewTask={handleNewTask}
            onNewTimelineEvent={handleNewTimelineEvent}
            onNewWhiteboard={handleNewWhiteboard}
            onNewIOC={handleNewIOC}
            onNewNoteTemplate={() => setShowNoteTemplateCreator(true)}
            onImportNoteTemplate={selectedFolder ? () => setShowInvestigationTemplatePicker(true) : undefined}
            onOpenFile={openFilePicker}
            onImportData={() => setShowDataImport(true)}
            onToggleSidebar={() => updateSettings({ sidebarCollapsed: !settings.sidebarCollapsed })}
            onMobileMenuToggle={() => setMobileSidebarOpen((prev) => !prev)}
            sidebarCollapsed={settings.sidebarCollapsed}
            onQuickSave={handleQuickSave}
            onQuickLoad={handleQuickLoad}
            onStartTour={() => tour.start(activeView)}
            onOpenFortuneInt={handleOpenFortuneInt}
            onOpenJots={() => setShowJotsPanel(true)}
            jotsCount={allJotsCount}
            effectiveClsLevels={effectiveClsLevels}
            presenceUsers={presenceUsers}
            addToast={addToast}
          />
          </ErrorBoundary>
        }
        sidebar={
          <ErrorBoundary region="sidebar">
          <Sidebar
            {...sidebarProps}
            agentStatus={caddyAgent.agentStatus}
            onToggleAgent={async () => { await caddyAgent.toggleAgent(); reloadFolders(); }}
            collapsed={settings.sidebarCollapsed}
            sidebarAccentStyle={settings.sidebarAccentStyle}
            onToggleCollapsed={() => updateSettings({ sidebarCollapsed: !settings.sidebarCollapsed })}
            onNavigate={() => setSelectedNoteId(undefined)}
          />
          </ErrorBoundary>
        }
        bottomNav={<BottomTabBar />}
      >
        <ErrorBoundary region="main-content">
        <Suspense fallback={<div className="flex-1 flex items-center justify-center text-gray-500">Loading…</div>}>
        <div className={routeSwitchHidden ? 'hidden' : 'flex flex-col flex-1 overflow-hidden'}>
        {filterBar}
        {remoteInvestigationBanner}
        {showSettings ? (
          <ErrorBoundary region="settings">
          <SettingsPanel
            settings={settings}
            onUpdateSettings={updateSettings}
            notes={notes.notes}
            onImportComplete={handleImportComplete}
            sampleLoaded={sampleLoaded}
            onLoadSample={handleLoadSample}
            onDeleteSample={handleDeleteSample}
            onClose={() => { closeSettings(); }}
            initialTab={settingsInitialTab as 'general' | 'ai' | 'data' | 'templates' | 'intel' | 'integrations' | 'shortcuts' | undefined}
            templateProps={{
              templates: noteTemplatesHook.templates,
              userTemplates: noteTemplatesHook.userTemplates,
              categories: noteTemplatesHook.categories,
              onCreateTemplate: noteTemplatesHook.createTemplate,
              onUpdateTemplate: noteTemplatesHook.updateTemplate,
              onDeleteTemplate: noteTemplatesHook.deleteTemplate,
              onDuplicateBuiltin: noteTemplatesHook.duplicateBuiltin,
            }}
            playbookProps={{
              playbooks: playbooksHook.playbooks,
              userPlaybooks: playbooksHook.userPlaybooks,
              onCreatePlaybook: playbooksHook.createPlaybook,
              onUpdatePlaybook: playbooksHook.updatePlaybook,
              onDeletePlaybook: playbooksHook.deletePlaybook,
            }}
          />
          </ErrorBoundary>
        ) : showTrash || showArchive ? (
          <TrashArchiveView
            mode={showTrash ? 'trash' : 'archive'}
            notes={screensafeNotes}
            tasks={screensafeTasks}
            timelineEvents={screensafeTimelineEvents}
            whiteboards={screensafeWhiteboards}
            standaloneIOCs={screensafeStandaloneIOCs}
            evidenceItems={screensafeEvidenceItems}
            chatThreads={screensafeChatThreads}
            folders={folders}
            onRestoreNote={loggedRestoreNote}
            onDeleteNotePermanently={(id) => { notes.deleteNote(id); activityLog.log('note', 'delete', 'Permanently deleted note', id); }}
            onTrashNote={loggedTrashNote}
            onUnarchiveNote={loggedToggleArchive}
            onRestoreTask={loggedRestoreTask}
            onDeleteTaskPermanently={loggedDeleteTask}
            onTrashTask={loggedTrashTask}
            onUnarchiveTask={loggedToggleArchiveTask}
            onRestoreEvent={loggedRestoreEvent}
            onDeleteEventPermanently={loggedDeleteEvent}
            onTrashEvent={loggedTrashEvent}
            onUnarchiveEvent={loggedToggleArchiveEvent}
            onRestoreWhiteboard={loggedRestoreWhiteboard}
            onDeleteWhiteboardPermanently={loggedDeleteWhiteboard}
            onTrashWhiteboard={loggedTrashWhiteboard}
            onUnarchiveWhiteboard={loggedToggleArchiveWhiteboard}
            onRestoreIOC={loggedRestoreIOC}
            onDeleteIOCPermanently={loggedDeleteIOC}
            onTrashIOC={loggedTrashIOC}
            onUnarchiveIOC={loggedToggleArchiveIOC}
            onRestoreEvidenceItem={loggedRestoreEvidenceItem}
            onDeleteEvidenceItemPermanently={loggedDeleteEvidenceItem}
            onTrashEvidenceItem={loggedTrashEvidenceItem}
            onUnarchiveEvidenceItem={loggedToggleArchiveEvidenceItem}
            onRestoreThread={chatsHook.restoreThread}
            onDeleteThreadPermanently={chatsHook.deleteThread}
            onTrashThread={chatsHook.trashThread}
            onUnarchiveThread={chatsHook.restoreThread}
            onEmptyAllTrash={async () => { await emptyAllTrash(); addToast('success', tt('investigation.trashEmptied')); }}
          />
        ) : activeView === 'workspace' ? (
          null /* Workspace route is hosted by the always-mounted app workspace shell. */
        ) : activeView === 'dashboard' ? (
          null /* Dashboard shell is always-mounted below after first use. */
        ) : activeView === 'ioc-stats' ? (
          null /* IOCStatsView is always-mounted below for workspace panel persistence */
        ) : activeView === 'activity' ? (
          null /* ActivityLogView is always-mounted below for workspace panel persistence */
        ) : activeView === 'graph' ? (
          null /* GraphView is always-mounted below for layout persistence */
        ) : activeView === 'evidence' ? (
          null /* EvidenceView is always-mounted below for workspace panel persistence */
        ) : activeView === 'products' ? (
          null /* ProductView is always-mounted below for workspace panel persistence */
        ) : activeView === 'experimental' ? (
          null /* Experimental/CaddyShack workbench is always-mounted below for workspace panel persistence */
        ) : activeView === 'caddyassistant' || activeView === 'cademail' || activeView === 'calendarcaddy' ? (
          null /* AssistantCaddy shell is always-mounted below after first use. */
        ) : activeView === 'timeline' ? (
          null /* TimelineView is always-mounted below for workspace panel persistence */
        ) : activeView === 'whiteboard' ? (
          null /* WhiteboardView is always-mounted below for workspace panel persistence */
        ) : activeView === 'chat' ? (
          null
        ) : activeView === 'journal' ? (
          <Suspense fallback={null}>
            <JournalView
              folders={folders}
              clsLevels={settings.tiClsLevels}
              onTearToInvestigation={async (content, title, investigationId) => {
                const folder = folders.find((f) => f.id === investigationId);
                const now = new Date();
                const dateStr = now.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
                await notes.createNote({
                  title: `${title} (from Journal, ${dateStr})`,
                  content: `*Torn from Journal on ${dateStr}*\n\n${content}`,
                  folderId: investigationId,
                  clsLevel: folder?.clsLevel,
                });
              }}
            />
          </Suspense>
        ) : activeView === 'virtualcaddy' ? (
          <VirtualCaddyTabView />
        ) : activeView === 'netmap' ? (
          <NetMapTabView />
        ) : activeView === 'investigations' ? (
          <InvestigationsHub
            localFolders={screensafeFolders}
            remoteInvestigations={screensafeRemoteInvestigations}
            syncedFolderIds={syncedFolderIds}
            serverConnected={auth.connected}
            localLoading={foldersLoading}
            remoteLoading={remoteLoading}
            onOpenInvestigation={handleOpenInvestigation}
            onSyncLocally={handleSyncLocally}
            onUnsync={handleUnsync}
            syncingFolderId={syncingFolderId}
            onCreateInvestigation={() => setShowCreateInvestigationModal(true)}
            onEditInvestigation={(id) => setEditingFolderId(id)}
            onArchiveInvestigation={(id) => loggedArchiveFolder(id)}
            onUnarchiveInvestigation={(id) => loggedUnarchiveFolder(id)}
            onDeleteInvestigation={(id) => {
              const folder = folders.find(f => f.id === id);
              if (!confirm(`Delete "${folder?.name || 'this investigation'}" and all its contents? This cannot be undone.`)) return;
              loggedDeleteFolder(id);
              if (selectedFolderId === id) { setSelectedFolderId(undefined); setSelectedNoteId(undefined); }
            }}
            allNotes={screensafeNotes}
            allTasks={screensafeTasks}
            allEvents={screensafeTimelineEvents}
            allWhiteboards={screensafeWhiteboards}
            allIOCs={screensafeStandaloneIOCs}
            allChats={screensafeChatThreads}
          />
        ) : activeView === 'reportcaddy' ? (
          null /* ReportCaddyView is always-mounted below for workspace panel persistence */
        ) : activeView === 'agent' ? (
          null /* AgentCaddy is always-mounted below for workspace panel persistence */
        ) : activeView === 'tasks' ? (
          null /* TaskListView is always-mounted below for workspace panel persistence */
        ) : activeView === 'notes' ? (
          null /* Notes shell is always-mounted below for workspace panel persistence */
        ) : (
          notesWorkspace
        )}
        </div>
        {/* Always-mounted app workspace shell — hidden via CSS after first use so floating panels and dock state survive app navigation. */}
        {appWorkspaceShouldRender && (
          <div className={appWorkspaceVisible ? 'flex flex-col flex-1 overflow-hidden' : 'hidden'}>
            {filterBar}
            {remoteInvestigationBanner}
            <AppWorkspaceShell
              workspaceActive={workspaceRouteVisible}
              assistantActive={assistantWorkspaceVisible}
              assistantView={assistantShellView}
              dashboardActive={dashboardWorkspaceVisible}
              screensafeFolders={screensafeFolders}
              dashboard={(
                <DashboardView
                  links={settings.quickLinks ?? DEFAULT_QUICK_LINKS}
                  onUpdateLinks={(links) => updateSettings({ quickLinks: links })}
                  onViewChange={navigateTo}
                  folders={folders}
                  allNotes={screensafeNotes}
                  allTasks={screensafeTasks}
                  allEvents={screensafeTimelineEvents}
                  allIOCs={screensafeStandaloneIOCs}
                  dashboardKPIs={settings.dashboardKPIs as import('./types').KPIMetricId[] | undefined}
                  onUpdateKPIs={(kpis) => updateSettings({ dashboardKPIs: kpis })}
                />
              )}
              activityActive={activityWorkspaceVisible}
              activity={(
                <ActivityLogView
                  entries={activityLog.entries}
                  getFiltered={activityLog.getFiltered}
                  onClear={activityLog.clear}
                />
              )}
              productsActive={productsWorkspaceVisible}
              products={(
                <ProductView
                  folderName={selectedFolder?.name}
                  products={activeProducts}
                  baselines={productBaselines}
                  onOpenSourceNote={(id) => handleSearchNavigateToNote(id)}
                  onOpenChat={() => navigateTo('chat')}
                  onImportBaseline={handleImportProductBaseline}
                  onUpdateBaseline={handleUpdateProductBaseline}
                />
              )}
              notesActive={notesWorkspaceVisible}
              notes={notesWorkspace}
              tasksActive={tasksWorkspaceVisible}
              tasks={tasksWorkspace}
              evidenceActive={evidenceWorkspaceVisible}
              evidence={evidenceWorkspace}
              timelineActive={timelineWorkspaceVisible}
              timeline={timelineWorkspace}
              whiteboardsActive={whiteboardsWorkspaceVisible}
              whiteboards={whiteboardsWorkspace}
              graphActive={graphWorkspaceVisible}
              graph={graphWorkspace}
              reportCaddyActive={reportCaddyWorkspaceVisible}
              reportCaddy={reportCaddyWorkspace}
              iocsActive={iocsWorkspaceVisible}
              iocs={iocsWorkspace}
              experimentalActive={experimentalWorkspaceVisible}
              experimentalWorkbench={experimentalWorkbenchWorkspace}
              agentCaddyActive={agentCaddyWorkspaceVisible}
              agentCaddy={agentCaddyWorkspace}
              chatActive={chatWorkspaceVisible}
              chat={chatWorkspace}
              workspacePanelLaunchRequest={workspacePanelLaunchRequest}
              onWorkspacePanelLaunchHandled={handleWorkspacePanelLaunchHandled}
              assistantWorkspacePanelLaunchRequest={assistantWorkspacePanelLaunchRequest}
              onAssistantWorkspacePanelLaunchHandled={handleAssistantWorkspacePanelLaunchHandled}
            />
          </div>
        )}
        </Suspense>
        </ErrorBoundary>
      </AppLayout>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-black/50 animate-[fadeIn_150ms_ease-out]" onClick={() => setMobileSidebarOpen(false)} />
          <div className="relative h-full w-[280px] max-w-[85vw] shrink-0 animate-[slideInLeft_200ms_ease-out]" onClick={(e) => e.stopPropagation()}>
            <Sidebar
              {...sidebarProps}
              agentStatus={caddyAgent.agentStatus}
              onToggleAgent={async () => { await caddyAgent.toggleAgent(); reloadFolders(); }}
              collapsed={false}
              sidebarAccentStyle={settings.sidebarAccentStyle}
              onToggleCollapsed={() => setMobileSidebarOpen(false)}
              onNavigate={() => { setMobileSidebarOpen(false); setSelectedNoteId(undefined); }}
            />
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        <QuickCapture
          open={showQuickCapture}
          onClose={() => setShowQuickCapture(false)}
          onCapture={handleQuickCapture}
          folders={folders}
          defaultFolderId={selectedFolderId}
          templates={noteTemplatesHook.templates}
        />
      </Suspense>

      {showMeetingImport && selectedFolderId && (
        <Suspense fallback={null}>
          <MeetingImportModal
            onClose={() => setShowMeetingImport(false)}
            onImport={async (title, content) => {
              const folder = folders.find((f) => f.id === selectedFolderId);
              const newNote = await notes.createNote({
                title,
                content,
                folderId: selectedFolderId,
                clsLevel: folder?.clsLevel,
              });
              setSelectedNoteId(newNote.id);
              navigateTo('notes');
              setShowMeetingImport(false);
            }}
          />
        </Suspense>
      )}

      {showJotsPanel && (
        <Suspense fallback={null}>
          <JotsPanel
            notes={notes.notes}
            onClose={() => setShowJotsPanel(false)}
            onCreateJot={async () => {
              const folder = selectedFolderId ? folders.find((f) => f.id === selectedFolderId) : undefined;
              await notes.createNote({
                noteType: 'sticky',
                title: 'Jot',
                folderId: selectedFolderId,
                clsLevel: folder?.clsLevel,
              });
            }}
            onUpdateJot={(id, updates) => notes.updateNote(id, updates)}
            onTrashJot={(id) => notes.trashNote(id)}
            onSelect={(id) => { setSelectedNoteId(id); navigateTo('notes'); }}
          />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <InvestigationTemplatePicker
          open={showInvestigationTemplatePicker}
          onClose={() => setShowInvestigationTemplatePicker(false)}
          templates={noteTemplatesHook.templates}
          selectedTemplateIds={selectedFolder?.noteTemplateIds ?? []}
          investigationName={selectedFolder?.name}
          onSave={handleSaveInvestigationTemplateIds}
        />
      </Suspense>

      <Suspense fallback={null}>
        <NoteTemplateCreator
          open={showNoteTemplateCreator}
          onClose={() => setShowNoteTemplateCreator(false)}
          categories={noteTemplatesHook.categories}
          defaultClsLevel={selectedFolder?.clsLevel}
          attachInvestigationName={selectedFolder?.name}
          onCreate={handleCreateNoteTemplate}
        />
      </Suspense>

      <Suspense fallback={null}><PlaybookPicker
        open={showPlaybookPicker}
        onClose={() => { setShowPlaybookPicker(false); setPlaybookApplyFolderId(undefined); }}
        playbooks={playbooksHook.playbooks}
        applyToExisting={playbookApplyFolderId ? folders.find(f => f.id === playbookApplyFolderId)?.name : undefined}
        onSelect={async (playbookId, name) => {
          if (playbookApplyFolderId) {
            // Apply playbook to existing investigation
            const folder = folders.find(f => f.id === playbookApplyFolderId);
            if (!folder) return;
            await playbooksHook.instantiate(playbookId, folder, noteTemplatesHook.templates);
            notes.reload();
            tasks.reload();
            reloadTimelines();
            reloadFolders();
            setPlaybookApplyFolderId(undefined);
            const pb = playbooksHook.playbooks.find(p => p.id === playbookId);
            addToast('success', tt('investigation.playbookRan', { playbook: pb?.name, investigation: folder.name }));
          } else {
            // Create new investigation from playbook
            const folder = await loggedCreateFolder(name);
            await playbooksHook.instantiate(playbookId, folder, noteTemplatesHook.templates);
            notes.reload();
            tasks.reload();
            reloadTimelines();
            reloadFolders();
            setSelectedFolderId(folder.id);
            setSelectedTag(undefined);
            setShowTrash(false);
            setShowArchive(false);
            addToast('success', tt('investigation.createdFromPlaybook', { name }));
          }
        }}
      /></Suspense>

      <Suspense fallback={null}>

        <StandaloneIOCForm
          open={showIOCForm}
          onClose={() => setShowIOCForm(false)}
          onSubmit={async (data) => {
            await loggedCreateIOCWithAuto(data);
            navigateTo('ioc-stats');
          }}
          folders={folders}
          defaultFolderId={selectedFolderId}
        />
      </Suspense>

      <Suspense fallback={null}><DataImportModal
        open={showDataImport}
        onClose={() => setShowDataImport(false)}
        folders={folders}
        timelines={timelines}
        defaultFolderId={selectedFolderId}
        onCreateTimeline={loggedCreateTimeline}
        onImportComplete={handleDataImportComplete}
      /></Suspense>

      <ConfirmDialog
        open={!!pendingImportFile}
        onClose={() => setPendingImportFile(null)}
        onConfirm={handleConfirmImport}
        title="Load Backup"
        message="Choose how to import this backup. 'Replace All' will clear existing data. 'Merge' will add new items and update older ones without removing anything."
        confirmLabel="Replace All"
        danger
        secondaryAction={handleMergeImport}
        secondaryLabel="Merge"
      />

      <ConfirmDialog
        open={!!confirmUnsyncId}
        onClose={() => setConfirmUnsyncId(null)}
        onConfirm={() => { if (confirmUnsyncId) handleUnsyncConfirmed(confirmUnsyncId); setConfirmUnsyncId(null); }}
        title="Unsync Investigation"
        message="This will remove the local copy of this investigation. You can re-sync it later from the server."
        confirmLabel="Unsync"
        danger
      />

      <Suspense fallback={null}><ShareDialog
        open={shareLinkPayload !== null}
        onClose={() => setShareLinkPayload(null)}
        payload={shareLinkPayload}
        folderId={shareLinkPayload?.s === 'investigation'
          ? (shareLinkPayload.d as InvestigationBundle).folder.id
          : undefined}
      /></Suspense>

      <Suspense fallback={null}><DemoWelcomeModal
        open={showDemoModal}
        onClose={() => setShowDemoModal(false)}
        onStartTour={() => tour.start(activeView)}
        onDeleteDemo={handleDeleteSample}
      /></Suspense>

      <Suspense fallback={null}><SearchOverlay
        open={searchOverlayOpen}
        onClose={() => setSearchOverlayOpen(false)}
        notes={screensafeNotes}
        tasks={screensafeTasks}
        clipsFolderId={clipsFolderId}
        onNavigateToNote={handleSearchNavigateToNote}
        onNavigateToTask={handleSearchNavigateToTask}
        timelineEvents={screensafeTimelineEvents}
        whiteboards={screensafeWhiteboards}
        onNavigateToTimeline={handleSearchNavigateToTimeline}
        onNavigateToWhiteboard={handleSearchNavigateToWhiteboard}
        standaloneIOCs={screensafeStandaloneIOCs.filter((i) => !i.trashed && !i.archived)}
        chatThreads={screensafeChatThreads.filter((c) => !c.trashed && !c.archived)}
        onNavigateToIOC={handleSearchNavigateToIOC}
        onNavigateToChat={handleSearchNavigateToChat}
        selectedFolderId={selectedFolderId}
        scopedNotes={investigationNotes}
        scopedTasks={investigationTasks}
        scopedTimelineEvents={investigationTimelineEvents}
        scopedWhiteboards={investigationWhiteboards}
        folders={folders}
        onSwitchInvestigation={handlePaletteSwitchInvestigation}
        onNavigateToView={handlePaletteNavigateToView}
        onDraftHuntNarrative={handleDraftHuntNarrative}
      /></Suspense>

      {editingFolder && (
        <Suspense fallback={null}><InvestigationDetailPanel
          folder={editingFolder}
          onUpdate={updateFolder}
          onClose={() => setEditingFolderId(undefined)}
          allTags={tags}
          onCreateTag={loggedCreateTag}
          entityCounts={investigationEntityCounts}
          effectiveClsLevels={effectiveClsLevels}
          onCreateTimeline={async (name) => {
            const tl = await loggedCreateTimeline(name);
            return tl;
          }}
          onNavigateToTimeline={(timelineId) => {
            setEditingFolderId(undefined);
            setSelectedTimelineId(timelineId);
            navigateTo('timeline', { selectedTimelineId: timelineId });
          }}
          onExport={editingFolderId === selectedFolderId && investigationMode === 'remote' ? undefined : async (folderId) => {
            try {
              const json = await exportInvestigationJSON(folderId);
              const folder = folders.find((f) => f.id === folderId);
              const slug = (folder?.name || 'investigation').toLowerCase().replace(/\s+/g, '-');
              const date = new Date().toISOString().slice(0, 10);
              downloadFile(json, `threatcaddy-${slug}-${date}.json`, 'application/json');
              activityLog.log('data', 'export', `Exported investigation "${folder?.name}"`, folderId, folder?.name);
              addToast('success', tt('investigation.exported', { name: folder?.name }));
            } catch {
              addToast('error', tt('investigation.exportFailed'));
            }
          }}
          onGenerateReport={(folderId) => {
            const folder = folders.find((f) => f.id === folderId);
            if (!folder) return;
            const folderNotes = notes.notes.filter((n) => n.folderId === folderId && !n.trashed && !n.archived);
            const folderTasks = tasks.tasks.filter((t) => t.folderId === folderId && !t.trashed && !t.archived);
            const folderEvents = timeline.events.filter((e) => e.folderId === folderId && !e.trashed && !e.archived);
            const folderIOCs = standaloneIOCsHook.iocs.filter((i) => i.folderId === folderId && !i.trashed && !i.archived);
            const html = generateInvestigationReport({ folder, notes: folderNotes, tasks: folderTasks, events: folderEvents, standaloneIOCs: folderIOCs });
            const blob = new Blob([html], { type: 'text/html' });
            const blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, '_blank', 'noopener,noreferrer');
            setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
            activityLog.log('data', 'export', `Generated report for "${folder.name}"`, folderId, folder.name);
            addToast('success', tt('investigation.reportGenerated', { name: folder.name }));
          }}
          onPrintReport={(folderId) => {
            const folder = folders.find((f) => f.id === folderId);
            if (!folder) return;
            const folderNotes = notes.notes.filter((n) => n.folderId === folderId && !n.trashed && !n.archived);
            const folderTasks = tasks.tasks.filter((t) => t.folderId === folderId && !t.trashed && !t.archived);
            const folderEvents = timeline.events.filter((e) => e.folderId === folderId && !e.trashed && !e.archived);
            const folderIOCs = standaloneIOCsHook.iocs.filter((i) => i.folderId === folderId && !i.trashed && !i.archived);
            const html = generateInvestigationReport({ folder, notes: folderNotes, tasks: folderTasks, events: folderEvents, standaloneIOCs: folderIOCs });
            printReport(html);
            activityLog.log('data', 'export', `Print report for "${folder.name}"`, folderId, folder.name);
          }}
          onShareLink={handleShareInvestigationLink}
          serverConnected={auth.connected}
          onToggleSync={(folderId, currentlyLocalOnly) => {
            const newLocalOnly = !currentlyLocalOnly;
            updateFolder(folderId, { localOnly: newLocalOnly });
            import('./lib/sync-middleware').then(({ markFolderLocalOnly }) => {
              markFolderLocalOnly(folderId, newLocalOnly);
            });
            if (!newLocalOnly) {
              // Re-sync folder to server when enabling sync
              import('./lib/sync-engine').then(({ syncEngine }) => {
                syncEngine.syncFolder(folderId);
              });
            }
          }}
          playbookSteps={editingFolder?.playbookExecution ? playbooksHook.playbooks.find(p => p.id === editingFolder.playbookExecution?.templateId)?.steps : undefined}
          onRunPlaybook={() => {
            setPlaybookApplyFolderId(editingFolderId);
            setShowPlaybookPicker(true);
          }}
          onArchive={(id) => { loggedArchiveFolder(id); setEditingFolderId(undefined); }}
          onUnarchive={(id) => { loggedUnarchiveFolder(id); setEditingFolderId(undefined); }}
          onDelete={(id) => { loggedDeleteFolder(id); if (selectedFolderId === id) setSelectedFolderId(undefined); setEditingFolderId(undefined); }}
        /></Suspense>
      )}

      {tour.isActive && tour.currentStep && (
        <>
          <TourOverlay targetRect={tour.targetRect} />
          <TourGlow targetRect={tour.targetRect} />
          <TourTooltip
            step={tour.currentStep}
            targetRect={tour.targetRect}
            currentIndex={tour.currentStepIndex}
            totalSteps={tour.totalSteps}
            onNext={tour.next}
            onPrev={tour.prev}
            onSkip={tour.skip}
          />
        </>
      )}

      <CreateInvestigationModal
        open={showCreateInvestigationModal}
        onClose={() => setShowCreateInvestigationModal(false)}
        onCreate={async (name) => {
          const folder = await loggedCreateFolder(name);
          setShowCreateInvestigationModal(false);
          if (folder) {
            handleOpenInvestigation(folder.id, 'local');
          }
        }}
        onOpenNameGenerator={() => { setShowCreateInvestigationModal(false); setShowNameGenerator(true); }}
        onOpenPlaybookPicker={() => { setShowCreateInvestigationModal(false); setShowPlaybookPicker(true); }}
      />
      <Suspense fallback={null}><KeyboardShortcutsPanel
        open={showShortcutsPanel}
        onClose={() => setShowShortcutsPanel(false)}
      /></Suspense>
      <Suspense fallback={null}><OperationNameGenerator
        open={showNameGenerator}
        onClose={() => setShowNameGenerator(false)}
        onCreateInvestigation={async (name) => {
          const folder = await loggedCreateFolder(name);
          setShowNameGenerator(false);
          if (folder) {
            handleOpenInvestigation(folder.id, 'local');
          }
        }}
      /></Suspense>
      <Suspense fallback={null}>
        <ServerOnboardingModal
          open={showServerOnboarding}
          onClose={dismissServerOnboarding}
          serverName={serverOnboardingName}
        />
      </Suspense>
    </ActivityLogContext.Provider>
    <ToastContainer />

    {/* Sync Conflict Dialog */}
    {syncConflicts.length > 0 && (
      <Suspense fallback={null}><ConflictDialog
        conflicts={syncConflicts}
        onResolve={handleResolveConflict}
        onResolveAll={handleResolveAllConflicts}
        onClose={() => setSyncConflicts([])}
      /></Suspense>
    )}

    {/* Meeting + Slack DM alert overlay */}
    <AlertGlowPanel
      items={alertItems}
      dmItems={dmAlertItems}
      settings={settings}
      onDismiss={dismissAlert}
      onAcknowledge={acknowledgeAlert}
      onDismissDm={dismissDm}
      onAcknowledgeDm={acknowledgeDm}
    />

    {/* Sync Passphrase Prompt — shown for passkey users who haven't yet set an encryption key */}
    {auth.connected && startupGraceExpired && auth.getSyncKey() === null && !syncPassphraseDismissed && (
      <SyncPassphrasePrompt
        onSubmit={async (passphrase) => {
          await auth.setSyncPassphrase(passphrase);
          setSyncPassphraseDismissed(true);
        }}
        onDismiss={() => setSyncPassphraseDismissed(true)}
      />
    )}
    </ScreenshareContext.Provider>
  );
});
