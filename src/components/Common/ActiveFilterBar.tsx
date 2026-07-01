import { Briefcase, Tag, Pin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ClsBadge } from './ClsBadge';
import { getTlpBorderColor } from '../../lib/classification';
import type { InvestigationStatus, PlaybookExecution } from '../../types';

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

export function ActiveFilterBar({ folderName, folderColor, folderStatus, folderClsLevel, tagName, tagColor, onClear, onEditFolder, playbookExecution, onOpenJots, jotsCount }: ActiveFilterBarProps) {
  const { t } = useTranslation('investigations');
  if (!folderName && !tagName) return null;

  const accentColor = folderColor || tagColor || '#6366f1';
  const tlpBorderColor = getTlpBorderColor(folderClsLevel);
  const pbCompleted = playbookExecution?.steps.filter(s => s.completed).length ?? 0;
  const pbTotal = playbookExecution?.steps.length ?? 0;
  const pbPct = pbTotal > 0 ? Math.round((pbCompleted / pbTotal) * 100) : 0;

  return (
    <div
      className="flex items-center gap-2 px-3 py-1 border-b-4 text-sm shrink-0"
      style={{
        borderLeftWidth: '3px',
        borderLeftColor: accentColor,
        borderBottomColor: tlpBorderColor || '#1f2937',
        backgroundColor: `color-mix(in srgb, ${accentColor} 8%, transparent)`,
      }}
    >
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
      {folderClsLevel && <ClsBadge level={folderClsLevel} />}
      <button
        onClick={onClear}
        className="ms-auto px-2 py-0.5 rounded text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
        aria-label="Show all"
        title="Show all"
      >
        Show All
      </button>
    </div>
  );
}
