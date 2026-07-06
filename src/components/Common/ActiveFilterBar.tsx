import { useEffect, useRef, useState } from 'react';
import { Briefcase, Maximize2, Tag, Pin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ClsBadge } from './ClsBadge';
import { getClsBadgeStyle, getTlpBorderColor } from '../../lib/classification';
import { effectiveTlpLevel } from '../../lib/tlp-inspector';
import type { InvestigationStatus, PlaybookExecution } from '../../types';
import { subscribeRoutePopOut, type RoutePopOutSignalValue } from '../../lib/route-popout-signal';

const statusColors: Record<InvestigationStatus, string> = {
  active: 'bg-green-500/20 text-green-400',
  monitoring: 'bg-blue-500/20 text-blue-400',
  closed: 'bg-gray-500/20 text-gray-400',
  archived: 'bg-yellow-500/20 text-yellow-400',
};

interface ActiveFilterBarProps {
  folderName?: string;
  folderColor?: string;
  folderStatus?: InvestigationStatus;
  folderClsLevel?: string;
  tagName?: string;
  tagColor?: string;
  onClear: () => void;
  onEditFolder?: () => void;
  playbookExecution?: PlaybookExecution;
  onOpenJots?: () => void;
  jotsCount?: number;
}

const STATUS_KEYS: Record<InvestigationStatus, string> = { active: 'hub.active', monitoring: 'hub.monitoring', closed: 'hub.closed', archived: 'hub.archived' };

// Below this header width, the wide centered TLP bar collapses back to a compact pill.
const HEADER_COMPACT_BREAKPOINT = 900;

export function ActiveFilterBar({ folderName, folderColor, folderStatus, folderClsLevel, tagName, tagColor, onClear, onEditFolder, playbookExecution, onOpenJots, jotsCount }: ActiveFilterBarProps) {
  const { t } = useTranslation('investigations');

  // Pop-out button for the active route panel (e.g. Notes, Tasks).
  // Published by RoutePanelPopOutSurface via module-level signal (context can't cross the sibling boundary).
  const [popOut, setPopOut] = useState<RoutePopOutSignalValue | null>(null);
  useEffect(() => subscribeRoutePopOut(setPopOut), []);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.offsetWidth;
      setIsCompact(width < HEADER_COMPACT_BREAKPOINT);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!folderName && !tagName) return null;

  const accentColor = folderColor || tagColor || '#6366f1';
  const tlpBorderColor = getTlpBorderColor(folderClsLevel);
  const pbCompleted = playbookExecution?.steps.filter(s => s.completed).length ?? 0;
  const pbTotal = playbookExecution?.steps.length ?? 0;
  const pbPct = pbTotal > 0 ? Math.round((pbCompleted / pbTotal) * 100) : 0;
  const resolvedTlpLevel = effectiveTlpLevel(folderClsLevel, undefined);
  const tlpStyle = getClsBadgeStyle(resolvedTlpLevel);

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-2 px-3 py-1 border-b-4 text-sm shrink-0"
      style={{
        borderLeftWidth: '3px',
        borderLeftColor: accentColor,
        borderBottomColor: tlpBorderColor || '#1f2937',
        backgroundColor: `color-mix(in srgb, ${accentColor} 8%, transparent)`,
      }}
    >
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        {folderName && (
          <span className="flex items-center gap-1.5">
            <Briefcase size={14} style={{ color: folderColor }} />
            {onEditFolder ? (
              <button
                onClick={onEditFolder}
                className="text-gray-200 font-medium hover:text-accent transition-colors"
                title="View investigation details"
              >
                {folderName}
              </button>
            ) : (
              <span className="text-gray-200 font-medium">{folderName}</span>
            )}
          </span>
        )}
        {tagName && (
          <span className="flex items-center gap-1.5">
            <Tag size={14} style={{ color: tagColor }} />
            <span className="text-gray-200 font-medium">#{tagName}</span>
          </span>
        )}
        {folderStatus && (
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[folderStatus]}`}>
            {t(STATUS_KEYS[folderStatus])}
          </span>
        )}
        {playbookExecution && pbTotal > 0 && (
          <span className="flex items-center gap-1.5 ms-1" title={`${playbookExecution.templateName}: ${pbCompleted}/${pbTotal} steps`}>
            <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pbPct}%`,
                  backgroundColor: pbPct === 100 ? '#22c55e' : '#6366f1',
                }}
              />
            </div>
            <span className="text-[10px] text-gray-500 tabular-nums">{pbCompleted}/{pbTotal}</span>
          </span>
        )}
        {onOpenJots && (
          <button
            onClick={onOpenJots}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
            aria-label="Open Jots"
            title="Jots (sticky notes)"
          >
            <Pin size={11} />
            Jots{jotsCount ? ` (${jotsCount})` : ''}
          </button>
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center">
        {folderClsLevel && (
          isCompact ? (
            <ClsBadge level={resolvedTlpLevel} />
          ) : (
            <span
              className={`${tlpStyle.bg} ${tlpStyle.text} ${tlpStyle.border} mx-auto min-w-96 max-w-[35%] truncate whitespace-nowrap rounded-full border px-6 py-0.5 text-center text-[10px] font-medium`}
            >
              {resolvedTlpLevel}
            </span>
          )
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {popOut && (
          <button
            onClick={popOut.onPopOut}
            className="hidden md:inline-flex p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
            aria-label={popOut.label}
            title={popOut.label}
          >
            <Maximize2 size={13} />
          </button>
        )}
        <button
          onClick={onClear}
          className="px-2 py-0.5 rounded text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
          aria-label="Show all"
          title="Show all"
        >
          Show All
        </button>
      </div>
    </div>
  );
}
