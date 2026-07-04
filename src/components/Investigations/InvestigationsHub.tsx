import { useMemo, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, WifiOff, Briefcase, Search, ChevronDown, ChevronRight, ArrowUpDown } from 'lucide-react';
import type { Folder, InvestigationSummary, InvestigationDataMode, Note, Task, TimelineEvent, Whiteboard, StandaloneIOC, ChatThread } from '../../types';
import { cn } from '../../lib/utils';
import { getInheritedClsLevel } from '../../lib/classification';
import { clsLevelIndex } from '../../lib/tlp-inspector';
import { InvestigationCard } from './InvestigationCard';
import { SupervisorSummary } from '../Agent/SupervisorSummary';

const ZERO_COUNTS = { notes: 0, tasks: 0, iocs: 0, events: 0, whiteboards: 0, chats: 0 };
const STALE_DAYS = 7;
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;
const SECTIONS_KEY = 'threatcaddy:hub-sections-collapsed';
const SORT_KEY = 'threatcaddy:hub-sort';

type SortMode = 'lastActive' | 'created' | 'tlp' | 'name';

function readCollapsed(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(SECTIONS_KEY) ?? '{}') as Record<string, boolean>; } catch { return {}; }
}
function writeCollapsed(v: Record<string, boolean>) {
  try { localStorage.setItem(SECTIONS_KEY, JSON.stringify(v)); } catch { /* ignore */ }
}
function readSort(): SortMode {
  try {
    const v = localStorage.getItem(SORT_KEY);
    if (v === 'lastActive' || v === 'created' || v === 'tlp' || v === 'name') return v;
  } catch { /* ignore */ }
  return 'lastActive';
}

export interface InvestigationsHubProps {
  localFolders: Folder[];
  remoteInvestigations: InvestigationSummary[];
  syncedFolderIds: Set<string>;
  serverConnected: boolean;
  localLoading: boolean;
  remoteLoading: boolean;
  onOpenInvestigation: (folderId: string, mode: InvestigationDataMode) => void;
  onSyncLocally: (folderId: string) => void;
  onUnsync: (folderId: string) => void;
  onCreateInvestigation: () => void;
  onEditInvestigation?: (folderId: string) => void;
  onArchiveInvestigation?: (folderId: string) => void;
  onUnarchiveInvestigation?: (folderId: string) => void;
  onDeleteInvestigation?: (folderId: string) => void;
  allNotes?: Note[];
  allTasks?: Task[];
  allEvents?: TimelineEvent[];
  allWhiteboards?: Whiteboard[];
  allIOCs?: StandaloneIOC[];
  allChats?: ChatThread[];
  syncingFolderId?: string | null;
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-raised p-3 animate-pulse">
      <div className="h-4 bg-bg-deep rounded w-3/4 mb-3" />
      <div className="grid grid-cols-3 gap-1 mb-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 bg-bg-deep/50 rounded-md" />
        ))}
      </div>
      <div className="flex gap-2">
        <div className="h-4 bg-bg-deep rounded w-14" />
        <div className="h-4 bg-bg-deep rounded w-10" />
      </div>
    </div>
  );
}

function EmptyState({ message, showCreate, onCreate }: { message: string; showCreate?: boolean; onCreate?: () => void }) {
  const { t } = useTranslation('investigations');
  return (
    <div className="flex flex-col items-center justify-center py-10 text-text-muted">
      <Briefcase size={28} className="mb-2 opacity-40" />
      <p className="text-sm">{message}</p>
      {showCreate && onCreate && (
        <button
          onClick={onCreate}
          className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple text-white hover:brightness-110 transition-all"
        >
          <Plus size={14} />
          {t('hub.createInvestigation')}
        </button>
      )}
    </div>
  );
}

function DisconnectedBanner() {
  const { t } = useTranslation('investigations');
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border-subtle bg-bg-deep/50 text-text-muted text-xs mb-3">
      <WifiOff size={14} />
      <span>{t('hub.disconnected')}</span>
    </div>
  );
}

interface CollapsibleSectionProps {
  id: string;
  title: string;
  count: number;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ id, title, count, defaultExpanded = true, children }: CollapsibleSectionProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(readCollapsed);

  const isCollapsed = collapsed[id] ?? !defaultExpanded;

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !isCollapsed };
      writeCollapsed(next);
      return next;
    });
  }, [id, isCollapsed]);

  return (
    <section className="mb-6">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-2 mb-3 group w-full text-left"
        aria-expanded={!isCollapsed}
      >
        {isCollapsed ? (
          <ChevronRight size={14} className="text-text-muted shrink-0 transition-transform" />
        ) : (
          <ChevronDown size={14} className="text-text-muted shrink-0 transition-transform" />
        )}
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider group-hover:text-text-secondary transition-colors">
          {title}
        </h3>
        <span className="px-1.5 py-px rounded-full bg-bg-deep text-[9px] font-mono text-text-muted">
          {count}
        </span>
      </button>
      {!isCollapsed && children}
    </section>
  );
}

export function InvestigationsHub({
  localFolders,
  remoteInvestigations,
  syncedFolderIds,
  serverConnected,
  localLoading,
  remoteLoading,
  onOpenInvestigation,
  onSyncLocally,
  onUnsync,
  onCreateInvestigation,
  onEditInvestigation,
  onArchiveInvestigation,
  onUnarchiveInvestigation,
  onDeleteInvestigation,
  allNotes,
  allTasks,
  allEvents,
  allWhiteboards,
  allIOCs,
  allChats,
  syncingFolderId,
}: InvestigationsHubProps) {
  const { t } = useTranslation('investigations');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>(readSort);

  const matchesSearch = (name: string) => {
    if (!searchQuery.trim()) return true;
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  };

  // Compute entity counts for local folders
  const localCountsMap = useMemo(() => {
    const map = new Map<string, { notes: number; tasks: number; iocs: number; events: number; whiteboards: number; chats: number }>();
    for (const f of localFolders) map.set(f.id, { notes: 0, tasks: 0, iocs: 0, events: 0, whiteboards: 0, chats: 0 });
    for (const n of (allNotes ?? [])) { if (!n.trashed && !n.archived && n.folderId) { const c = map.get(n.folderId); if (c) c.notes++; } }
    for (const t of (allTasks ?? [])) { if (!t.trashed && !t.archived && t.folderId) { const c = map.get(t.folderId); if (c) c.tasks++; } }
    for (const e of (allEvents ?? [])) { if (!e.trashed && !e.archived && e.folderId) { const c = map.get(e.folderId); if (c) c.events++; } }
    for (const w of (allWhiteboards ?? [])) { if (!w.trashed && !w.archived && w.folderId) { const c = map.get(w.folderId); if (c) c.whiteboards++; } }
    for (const i of (allIOCs ?? [])) { if (!i.trashed && !i.archived && i.folderId) { const c = map.get(i.folderId); if (c) c.iocs++; } }
    for (const ch of (allChats ?? [])) { if (!ch.trashed && !ch.archived && ch.folderId) { const c = map.get(ch.folderId); if (c) c.chats++; } }
    return map;
  }, [localFolders, allNotes, allTasks, allEvents, allWhiteboards, allIOCs, allChats]);

  // Compute inherited TLP/PAP classification for each local folder
  const localInheritedClsMap = useMemo(() => {
    const allEntities = [
      ...(allNotes ?? []).filter((n) => !n.trashed && !n.archived),
      ...(allTasks ?? []).filter((t) => !t.trashed && !t.archived),
      ...(allEvents ?? []).filter((e) => !e.trashed && !e.archived),
      ...(allIOCs ?? []).filter((i) => !i.trashed && !i.archived),
    ];
    const map = new Map<string, string | undefined>();
    for (const f of localFolders) {
      const entityLevel = getInheritedClsLevel(f.id, allEntities);
      const folderLevel = f.clsLevel;
      // Pick the higher of entity-inherited and folder-set TLP.
      // Previously `?? f.clsLevel` was used, which only fell back when
      // getInheritedClsLevel returned undefined (no entities with TLP).
      // That silently ignored a manually-raised folder clsLevel whenever
      // any entity carried a TLP — even a lower one — causing the hub
      // badge to stay stale instead of showing the raised level.
      let effective: string | undefined;
      if (!entityLevel) {
        effective = folderLevel;
      } else if (!folderLevel) {
        effective = entityLevel;
      } else {
        effective = clsLevelIndex(folderLevel) > clsLevelIndex(entityLevel) ? folderLevel : entityLevel;
      }
      map.set(f.id, effective);
    }
    return map;
  }, [localFolders, allNotes, allTasks, allEvents, allIOCs]);

  // Compute last activity timestamp per folder (most recent entity updatedAt)
  const lastActivityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of localFolders) map.set(f.id, f.updatedAt ?? f.createdAt ?? 0);
    const track = (folderId: string | undefined, ts: number | undefined) => {
      if (!folderId || !ts) return;
      const prev = map.get(folderId) ?? 0;
      if (ts > prev) map.set(folderId, ts);
    };
    for (const n of (allNotes ?? [])) { if (!n.trashed) track(n.folderId, n.updatedAt); }
    for (const t of (allTasks ?? [])) { if (!t.trashed) track(t.folderId, t.updatedAt); }
    for (const e of (allEvents ?? [])) { if (!e.trashed) track(e.folderId, e.updatedAt); }
    for (const i of (allIOCs ?? [])) { if (!i.trashed) track(i.folderId, i.updatedAt); }
    return map;
  }, [localFolders, allNotes, allTasks, allEvents, allIOCs]);

  // eslint-disable-next-line react-hooks/purity
  const nowRef = useRef(Date.now());
  const now = nowRef.current;

  // Sort comparator
  const sortFolders = useCallback((a: Folder, b: Folder): number => {
    if (sortMode === 'lastActive') {
      return (lastActivityMap.get(b.id) ?? 0) - (lastActivityMap.get(a.id) ?? 0);
    }
    if (sortMode === 'created') {
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    }
    if (sortMode === 'tlp') {
      const ai = clsLevelIndex(localInheritedClsMap.get(a.id));
      const bi = clsLevelIndex(localInheritedClsMap.get(b.id));
      return bi - ai;
    }
    return a.name.localeCompare(b.name);
  }, [sortMode, lastActivityMap, localInheritedClsMap]);

  // Partition all local folders (pure local + synced) into status sections
  const allLocalFolders = localFolders.filter((f) => matchesSearch(f.name));

  const activeSection: Folder[] = [];
  const monitoringSection: Folder[] = [];
  const staleSection: Folder[] = [];
  const closedSection: Folder[] = [];

  for (const f of allLocalFolders) {
    const status = f.status || 'active';
    if (status === 'closed' || status === 'archived') {
      closedSection.push(f);
      continue;
    }
    const lastActivity = lastActivityMap.get(f.id) ?? 0;
    const isStale = (now - lastActivity) > STALE_MS;
    if (isStale) {
      staleSection.push(f);
    } else if (status === 'monitoring') {
      monitoringSection.push(f);
    } else {
      activeSection.push(f);
    }
  }

  activeSection.sort(sortFolders);
  monitoringSection.sort(sortFolders);
  staleSection.sort(sortFolders);
  closedSection.sort(sortFolders);

  // Remote-only investigations (not synced locally)
  const remoteOnlyInvestigations = remoteInvestigations.filter((r) => !syncedFolderIds.has(r.folderId) && matchesSearch(r.folder.name));

  // Build a lookup for remote data to merge with synced local folders
  const remoteByFolderId = new Map<string, InvestigationSummary>();
  for (const r of remoteInvestigations) {
    remoteByFolderId.set(r.folderId, r);
  }

  const handleSortChange = (mode: SortMode) => {
    setSortMode(mode);
    try { localStorage.setItem(SORT_KEY, mode); } catch { /* ignore */ }
  };

  const renderLocalCard = (f: Folder, dataMode: InvestigationDataMode, stale?: boolean) => {
    const status = (f.status || 'active') as 'active' | 'monitoring' | 'closed' | 'archived';
    const remote = remoteByFolderId.get(f.id);
    return (
      <InvestigationCard
        key={f.id}
        folderId={f.id}
        name={f.name}
        status={status}
        isStale={stale}
        color={f.color}
        icon={f.icon}
        description={f.description}
        clsLevel={f.clsLevel}
        inheritedClsLevel={localInheritedClsMap.get(f.id)}
        entityCounts={remote?.entityCounts ?? localCountsMap.get(f.id) ?? ZERO_COUNTS}
        memberCount={remote?.memberCount}
        role={remote?.role}
        dataMode={dataMode}
        updatedAt={f.updatedAt ?? f.createdAt}
        onOpen={(id) => onOpenInvestigation(id, dataMode)}
        onUnsync={dataMode === 'synced' ? onUnsync : undefined}
        onSettings={onEditInvestigation}
        onArchive={status !== 'archived' ? onArchiveInvestigation : undefined}
        onUnarchive={status === 'archived' ? onUnarchiveInvestigation : undefined}
        onDelete={onDeleteInvestigation}
        syncing={syncingFolderId === f.id}
      />
    );
  };

  const cardDataMode = (f: Folder): InvestigationDataMode =>
    syncedFolderIds.has(f.id) ? 'synced' : 'local';

  const SORT_OPTIONS: { value: SortMode; label: string }[] = [
    { value: 'lastActive', label: t('hub.sortLastActive') },
    { value: 'created',    label: t('hub.sortCreated') },
    { value: 'tlp',        label: t('hub.sortTlp') },
    { value: 'name',       label: t('hub.sortName') },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-text-primary">{t('hub.title')}</h1>
          <button
            onClick={onCreateInvestigation}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-purple text-white hover:brightness-110 transition-all"
          >
            <Plus size={16} />
            {t('hub.newInvestigation')}
          </button>
        </div>

        {/* Search + Sort Bar */}
        <div className="flex items-center gap-3 mb-8">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder={t('hub.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full ps-8 pe-3 py-1.5 rounded-lg border border-border-subtle bg-bg-deep text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple/50"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowUpDown size={12} className="text-text-muted shrink-0" aria-hidden="true" />
            {SORT_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleSortChange(value)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  sortMode === value
                    ? 'bg-purple/20 text-purple'
                    : 'text-text-muted hover:bg-bg-deep hover:text-text-secondary',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Supervisor summary */}
        <SupervisorSummary onOpenSupervisor={(folderId) => onOpenInvestigation(folderId, 'local')} />

        {localLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <>
            {/* Active */}
            <CollapsibleSection id="active" title={t('hub.active')} count={activeSection.length} defaultExpanded>
              {activeSection.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeSection.map((f) => renderLocalCard(f, cardDataMode(f)))}
                </div>
              ) : (
                <EmptyState message={t('hub.noActive')} showCreate onCreate={onCreateInvestigation} />
              )}
            </CollapsibleSection>

            {/* Monitoring */}
            <CollapsibleSection id="monitoring" title={t('hub.monitoring')} count={monitoringSection.length} defaultExpanded>
              {monitoringSection.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {monitoringSection.map((f) => renderLocalCard(f, cardDataMode(f)))}
                </div>
              ) : (
                <EmptyState message={t('hub.noMonitoring')} />
              )}
            </CollapsibleSection>

            {/* Stale */}
            <CollapsibleSection id="stale" title={t('hub.stale')} count={staleSection.length} defaultExpanded={false}>
              {staleSection.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {staleSection.map((f) => renderLocalCard(f, cardDataMode(f), true))}
                </div>
              ) : (
                <EmptyState message={t('hub.noStale')} />
              )}
            </CollapsibleSection>

            {/* Closed */}
            <CollapsibleSection id="closed" title={t('hub.closed')} count={closedSection.length} defaultExpanded={false}>
              {closedSection.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {closedSection.map((f) => renderLocalCard(f, cardDataMode(f)))}
                </div>
              ) : (
                <EmptyState message={t('hub.noClosed')} />
              )}
            </CollapsibleSection>
          </>
        )}

        {/* Shared With Me (remote only) */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">{t('hub.sharedWithMe')}</h3>
            {serverConnected && (
              <span className="px-1.5 py-px rounded-full bg-bg-deep text-[9px] font-mono text-text-muted">
                {remoteOnlyInvestigations.length}
              </span>
            )}
          </div>
          {!serverConnected ? (
            <DisconnectedBanner />
          ) : remoteLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : remoteOnlyInvestigations.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {remoteOnlyInvestigations.map((r) => (
                <InvestigationCard
                  key={r.folderId}
                  folderId={r.folderId}
                  name={r.folder.name}
                  status={(r.folder.status || 'active') as 'active' | 'monitoring' | 'closed' | 'archived'}
                  color={r.folder.color}
                  icon={r.folder.icon}
                  description={r.folder.description}
                  clsLevel={r.folder.clsLevel}
                  entityCounts={r.entityCounts}
                  memberCount={r.memberCount}
                  role={r.role}
                  dataMode="remote"
                  updatedAt={r.folder.updatedAt}
                  onOpen={(id) => onOpenInvestigation(id, 'remote')}
                  onSync={onSyncLocally}
                  onSettings={onEditInvestigation}
                  syncing={syncingFolderId === r.folderId}
                />
              ))}
            </div>
          ) : (
            <EmptyState message={t('hub.noShared')} />
          )}
        </section>
      </div>
    </div>
  );
}
