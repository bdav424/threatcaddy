import { useState, useEffect, useRef, useCallback } from 'react';
import { liveQuery } from 'dexie';
import type { InvestigationColorMode } from '../../lib/investigation-color-mode';
import { useTranslation } from 'react-i18next';
import {
  FileText, CheckSquare, Search, Clock, Layout, MessageSquare,
  Download, CloudOff, MoreVertical, Settings, Archive, Trash2, Loader2, Timer,
} from 'lucide-react';
import type { InvestigationDataMode } from '../../types';
import { formatDate, cn } from '../../lib/utils';
import { getClsBadgeStyle } from '../../lib/classification';
import { useInvestigationClassification } from '../../hooks/useInvestigationClassification';
import { getInvestigationColorMode, tlpToAccentColor } from '../../lib/investigation-color-mode';
import { clsLevelIndex } from '../../lib/tlp-inspector';
import { db } from '../../db';

export interface InvestigationCardProps {
  folderId: string;
  name: string;
  status: 'active' | 'monitoring' | 'closed' | 'archived';
  isStale?: boolean;
  color?: string;
  icon?: string;
  description?: string;
  clsLevel?: string;
  inheritedClsLevel?: string;
  entityCounts: {
    notes: number;
    tasks: number;
    iocs: number;
    events: number;
    whiteboards: number;
    chats: number;
  };
  memberCount?: number;
  role?: 'owner' | 'editor' | 'viewer';
  dataMode: InvestigationDataMode;
  updatedAt?: string | number;
  active?: boolean;
  onOpen: (folderId: string) => void;
  onSync?: (folderId: string) => void;
  onUnsync?: (folderId: string) => void;
  onSettings?: (folderId: string) => void;
  onArchive?: (folderId: string) => void;
  onUnarchive?: (folderId: string) => void;
  onDelete?: (folderId: string) => void;
  syncing?: boolean;
}

const STATUS_STYLES: Record<string, { dot: string; text: string }> = {
  active:     { dot: 'bg-accent-green', text: 'text-accent-green' },
  monitoring: { dot: 'bg-accent-blue',  text: 'text-accent-blue' },
  closed:     { dot: 'bg-text-muted',   text: 'text-text-muted' },
  archived:   { dot: 'bg-accent-amber', text: 'text-accent-amber' },
};

const DATA_MODE_CLASSES: Record<InvestigationDataMode, string> = {
  local:  'bg-blue-500/15 text-blue-400',
  synced: 'bg-green-500/15 text-green-400',
  remote: 'bg-amber-500/15 text-amber-400',
};

const ENTITY_STATS = [
  { key: 'notes'       as const, labelKey: 'card.entity.notes',       icon: FileText,      color: 'text-accent-blue',  bg: 'bg-accent-blue/10' },
  { key: 'tasks'       as const, labelKey: 'card.entity.tasks',       icon: CheckSquare,   color: 'text-accent-amber', bg: 'bg-accent-amber/10' },
  { key: 'iocs'        as const, labelKey: 'card.entity.iocs',        icon: Search,        color: 'text-accent-green', bg: 'bg-accent-green/10' },
  { key: 'events'      as const, labelKey: 'card.entity.events',      icon: Clock,         color: 'text-purple',       bg: 'bg-purple/10' },
  { key: 'whiteboards' as const, labelKey: 'card.entity.whiteboards', icon: Layout,        color: 'text-accent-pink',  bg: 'bg-accent-pink/10' },
  { key: 'chats'       as const, labelKey: 'card.entity.chats',       icon: MessageSquare, color: 'text-purple',       bg: 'bg-purple/10' },
];

export function InvestigationCard({
  folderId,
  name,
  status,
  isStale,
  color,
  icon,
  description,
  clsLevel,
  inheritedClsLevel,
  entityCounts,
  memberCount,
  role,
  dataMode,
  updatedAt,
  active,
  onOpen,
  onSync,
  onUnsync,
  onSettings,
  onArchive,
  onUnarchive,
  onDelete,
  syncing,
}: InvestigationCardProps) {
  const { t } = useTranslation('investigations');
  const sty = STATUS_STYLES[status] ?? STATUS_STYLES.active;
  const statusLabel = t(`card.status.${status}`);
  const dataModeLabel = t(`card.dataMode.${dataMode}`);
  const dataModeClasses = DATA_MODE_CLASSES[dataMode];

  // Live folder clsLevel from Dexie — reactive to writes from other components/tabs
  const [liveFolderClsLevel, setLiveFolderClsLevel] = useState<string | undefined>(undefined);
  useEffect(() => {
    const subscription = liveQuery(() =>
      db.folders.get(folderId).then((f) => f?.clsLevel),
    ).subscribe({
      next: (val) => setLiveFolderClsLevel(val),
      error: () => setLiveFolderClsLevel(undefined),
    });
    return () => subscription.unsubscribe();
  }, [folderId]);

  // Live TLP level from investigation content (notes/IOCs/events)
  const liveClsLevel = useInvestigationClassification(folderId);

  // Reactive effective level: max of live entity TLP + live folder TLP
  const effectiveClsLevel = (() => {
    const folder = liveFolderClsLevel ?? clsLevel;
    const folderIdx = clsLevelIndex(folder);
    const entityIdx = clsLevelIndex(liveClsLevel);
    return entityIdx > folderIdx ? liveClsLevel : folder;
  })();
  const clsBadgeStyle = effectiveClsLevel ? getClsBadgeStyle(effectiveClsLevel) : null;
  const tlpOutlineColor = (() => {
    const u = (effectiveClsLevel ?? '').toUpperCase();
    if (u.includes('RED')) return '#cc0000';
    if (u.includes('AMBER')) return '#ff8c00';
    if (u.includes('GREEN')) return '#007a00';
    return 'rgba(255,255,255,0.15)';
  })();

  // Investigation color mode: manual | tlp | combined — reactive to settings changes
  const [colorMode, setColorMode] = useState<InvestigationColorMode>(getInvestigationColorMode);
  useEffect(() => {
    const handler = (e: CustomEvent<InvestigationColorMode>) => setColorMode(e.detail);
    window.addEventListener('tc:invColorModeChanged', handler as EventListener);
    return () => window.removeEventListener('tc:invColorModeChanged', handler as EventListener);
  }, []);
  // Background tint: TLP mode uses TLP-derived tint; combined uses manual color via CSS
  const tlpBgTint = tlpToAccentColor(liveClsLevel);
  // For combined mode, append hex alpha "1a" (≈10% opacity) to a 6-digit hex color.
  const manualBgTint = color && /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}1a` : null;
  const cardBgTint =
    colorMode === 'tlp'      ? tlpBgTint :
    colorMode === 'combined' ? (manualBgTint ?? tlpBgTint) :
    null;
  // Color strip: shown in manual and combined modes (not in TLP-only mode)
  const showColorStrip = !!color && colorMode !== 'tlp';

  const formattedUpdate = updatedAt
    ? typeof updatedAt === 'number'
      ? formatDate(updatedAt)
      : formatDate(new Date(updatedAt).getTime())
    : null;

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (dataMode === 'remote' && onSync) onSync(folderId);
    if (dataMode === 'synced' && onUnsync) onUnsync(folderId);
  };

  // Context menu (three-dot)
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeMenu();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen, closeMenu]);

  const isLocal = dataMode === 'local';
  const isSynced = dataMode === 'synced';
  const isRemote = dataMode === 'remote';
  const showMenuButton = isLocal || isSynced || (isRemote && !!onSettings);

  const handleMenuItemClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
    closeMenu();
  };

  return (
    <button
      onClick={() => onOpen(folderId)}
      data-tlp={effectiveClsLevel || undefined}
      className={cn(
        'relative w-full text-start rounded-lg border transition-all duration-200 cursor-pointer',
        'hover:scale-[1.01] hover:shadow-lg',
        active
          ? 'bg-purple/5 shadow-md'
          : 'border-border-subtle bg-bg-raised hover:border-border-medium',
      )}
      style={{
        ...(active
          ? { border: `1.5px solid ${tlpOutlineColor}` }
          : { boxShadow: `inset 0 3px 0 0 ${tlpOutlineColor}, inset 0 -3px 0 0 ${tlpOutlineColor}` }),
        ...(cardBgTint ? { backgroundColor: cardBgTint } : {}),
      }}
    >
      {/* Color accent — small left-border strip for user-chosen color (manual/combined modes) */}
      {showColorStrip && color && (
        <div
          className="absolute left-0 top-[4px] bottom-[4px] w-[3px] rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
      )}

      {/* Stale indicator */}
      {isStale && (
        <div className="absolute right-2 top-2 text-text-muted/50" title="Stale — no activity in the last 7 days" aria-label="Stale investigation">
          <Timer size={12} />
        </div>
      )}

      <div className="p-3">
        {/* Header: name + status badge */}
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <span className="text-base shrink-0" role="img" aria-hidden="true">
              {icon}
            </span>
          )}
          <span
            className={cn('w-2 h-2 rounded-full shrink-0', sty.dot)}
            style={status === 'active' ? { animation: 'status-pulse 2s ease-in-out infinite' } : undefined}
          />
          <span className="text-sm font-semibold text-text-primary truncate flex-1">
            {name}
          </span>
          {clsBadgeStyle && effectiveClsLevel && (
            <span
              className={cn(
                'text-[9px] font-mono font-bold px-1 py-0.5 rounded border shrink-0',
                effectiveClsLevel.toUpperCase().includes('CLEAR')
                  ? 'tlp-clear-badge'
                  : cn(clsBadgeStyle.bg, clsBadgeStyle.text, clsBadgeStyle.border),
              )}
              title={`${inheritedClsLevel ? 'Inherited' : 'Investigation'} classification: ${effectiveClsLevel}`}
            >
              {effectiveClsLevel}
            </span>
          )}
          <span className={cn('text-[10px] font-medium uppercase tracking-wide shrink-0', sty.text)}>
            {statusLabel}
          </span>

          {/* Context menu */}
          {showMenuButton && (
            <div ref={menuRef} className="relative shrink-0">
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setMenuOpen((v) => !v); } }}
                className="p-0.5 rounded hover:bg-bg-deep transition-colors text-text-muted hover:text-text-secondary"
                title={t('card.actions')}
                aria-label={t('card.actions')}
              >
                <MoreVertical size={14} />
              </span>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-lg border border-border-subtle bg-bg-raised shadow-xl py-1">
                  {onSettings && (
                    <button
                      onClick={(e) => handleMenuItemClick(e, () => onSettings(folderId))}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-deep hover:text-text-primary transition-colors"
                    >
                      <Settings size={12} />
                      {t('card.settings')}
                    </button>
                  )}
                  {(isLocal || isSynced) && status !== 'archived' && onArchive && (
                    <button
                      onClick={(e) => handleMenuItemClick(e, () => onArchive(folderId))}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-deep hover:text-text-primary transition-colors"
                    >
                      <Archive size={12} />
                      {t('card.archive')}
                    </button>
                  )}
                  {(isLocal || isSynced) && status === 'archived' && onUnarchive && (
                    <button
                      onClick={(e) => handleMenuItemClick(e, () => onUnarchive(folderId))}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-deep hover:text-text-primary transition-colors"
                    >
                      <Archive size={12} />
                      {t('card.unarchive')}
                    </button>
                  )}
                  {(isLocal || isSynced) && onDelete && (
                    <button
                      onClick={(e) => handleMenuItemClick(e, () => onDelete(folderId))}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={12} />
                      {t('card.delete')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        {description && (
          <p className="text-xs text-text-secondary mt-1.5 line-clamp-2 ms-0.5">
            {description}
          </p>
        )}

        {/* CLS level (folder-level override, shown only when different from inherited) */}
        {clsLevel && clsLevel !== effectiveClsLevel && (
          <span className="inline-block mt-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">
            {clsLevel}
          </span>
        )}

        {/* Entity counts 2x3 grid */}
        <div className="grid grid-cols-3 gap-1 mt-2.5">
          {ENTITY_STATS.map((s) => {
            const Icon = s.icon;
            const val = entityCounts[s.key];
            return (
              <div
                key={s.key}
                className={cn(
                  'flex flex-col items-center rounded-md py-1.5',
                  val > 0 ? s.bg : 'bg-bg-deep/50',
                )}
              >
                <Icon size={12} className={val > 0 ? s.color : 'text-text-muted'} />
                <span className={cn('text-sm font-bold mt-0.5', val > 0 ? s.color : 'text-text-muted')}>
                  {val}
                </span>
                <span className="text-[8px] font-medium text-text-muted uppercase tracking-wide mt-0.5">
                  {t(s.labelKey)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Bottom row: data mode + role + updated + action */}
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          {/* Data mode badge */}
          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', dataModeClasses)}>
            {dataModeLabel}{dataMode === 'synced' ? ' \u2195' : ''}
          </span>

          {/* Role badge */}
          {role && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-bg-deep text-text-secondary">
              {t(`card.role.${role}`)}
            </span>
          )}

          {/* Member count */}
          {memberCount != null && memberCount > 0 && (
            <span className="text-[10px] font-mono text-text-muted">
              {t('card.members', { count: memberCount })}
            </span>
          )}

          <span className="flex-1" />

          {/* Updated timestamp */}
          {formattedUpdate && (
            <span className="text-[10px] font-mono text-text-muted shrink-0">
              {formattedUpdate}
            </span>
          )}

          {/* Action button */}
          {syncing ? (
            <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple/15 text-purple shrink-0">
              <Loader2 size={10} className="animate-spin" />
              {t('card.syncing')}
            </span>
          ) : (
            <>
              {dataMode === 'remote' && onSync && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleActionClick}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleActionClick(e as unknown as React.MouseEvent); } }}
                  className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors shrink-0"
                  title={t('card.syncLocally')}
                  aria-label={t('card.syncLocally')}
                >
                  <Download size={10} />
                  {t('card.sync')}
                </span>
              )}
              {dataMode === 'synced' && onUnsync && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleActionClick}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleActionClick(e as unknown as React.MouseEvent); } }}
                  className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-text-muted/15 text-text-secondary hover:bg-text-muted/25 transition-colors shrink-0"
                  title={t('card.removeLocalCopy')}
                  aria-label={t('card.removeLocalCopy')}
                >
                  <CloudOff size={10} />
                  {t('card.unsync')}
                </span>
              )}
            </>
          )}
        </div>
      </div>

    </button>
  );
}
