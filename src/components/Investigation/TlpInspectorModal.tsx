import { useState, useEffect, useCallback } from 'react';
import { FileText, CheckSquare, Clock, Fingerprint, FileBox, Copy, ChevronRight, AlertTriangle } from 'lucide-react';
import { Modal } from '../Common/Modal';
import { ClsBadge } from '../Common/ClsBadge';
import { cn } from '../../lib/utils';
import { DEFAULT_CLS_LEVELS } from '../../types';
import {
  inspectTlpContributors,
  copyInvestigationAtLowerTlp,
  clsLevelIndex,
  type TlpContributingItem,
  type TlpContributingItemType,
} from '../../lib/tlp-inspector';
import type { Folder } from '../../types';

const TYPE_ICONS: Record<TlpContributingItemType, typeof FileText> = {
  'note': FileText,
  'task': CheckSquare,
  'timeline-event': Clock,
  'ioc': Fingerprint,
  'evidence': FileBox,
};

const TYPE_LABELS: Record<TlpContributingItemType, string> = {
  'note': 'Note',
  'task': 'Task',
  'timeline-event': 'Timeline event',
  'ioc': 'IOC',
  'evidence': 'Evidence',
};

interface TlpInspectorModalProps {
  open: boolean;
  onClose: () => void;
  folder: Folder;
  onInvestigationCreated?: (folderId: string) => void;
}

export function TlpInspectorModal({ open, onClose, folder, onInvestigationCreated }: TlpInspectorModalProps) {
  const [items, setItems] = useState<TlpContributingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copyView, setCopyView] = useState(false);
  const [targetLevel, setTargetLevel] = useState('');
  const [copyName, setCopyName] = useState('');
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setItems([]);
    setCopyView(false);
    inspectTlpContributors(folder.id)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open, folder.id]);

  const currentIdx = clsLevelIndex(folder.clsLevel);
  const lowerLevels = DEFAULT_CLS_LEVELS.filter((l) => clsLevelIndex(l) < currentIdx && clsLevelIndex(l) >= 0);

  const handleOpenCopy = useCallback(() => {
    setTargetLevel(lowerLevels[lowerLevels.length - 1] ?? '');
    setCopyName(`${folder.name} (${lowerLevels[lowerLevels.length - 1] ?? 'copy'})`);
    setCopyError('');
    setCopyView(true);
  }, [folder.name, lowerLevels]);

  const handleCopy = useCallback(async () => {
    if (!targetLevel || !copyName.trim()) return;
    setCopying(true);
    setCopyError('');
    try {
      const newId = await copyInvestigationAtLowerTlp(folder.id, folder, targetLevel, copyName.trim());
      onInvestigationCreated?.(newId);
      onClose();
    } catch (e) {
      setCopyError(e instanceof Error ? e.message : 'Copy failed');
    } finally {
      setCopying(false);
    }
  }, [folder, targetLevel, copyName, onInvestigationCreated, onClose]);

  const grouped = items.reduce<Record<string, TlpContributingItem[]>>((acc, item) => {
    const key = item.clsLevel;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const sortedLevels = Object.keys(grouped).sort((a, b) => clsLevelIndex(b) - clsLevelIndex(a));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={copyView ? 'Copy investigation at lower TLP' : 'TLP contributors'}
      wide
    >
      {copyView ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Creates a new investigation copy, excluding items classified above the target TLP level.
            Items without a classification level are always included.
          </p>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-400">Target TLP level</label>
              <div className="flex flex-wrap gap-2">
                {lowerLevels.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => {
                      setTargetLevel(level);
                      setCopyName(`${folder.name} (${level})`);
                    }}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      targetLevel === level
                        ? 'border-accent bg-accent/20 text-accent'
                        : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500',
                    )}
                  >
                    {level}
                  </button>
                ))}
                {lowerLevels.length === 0 && (
                  <p className="text-xs text-gray-500">No lower TLP levels available — this investigation is already at the lowest level.</p>
                )}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-400">New investigation name</label>
              <input
                type="text"
                value={copyName}
                onChange={(e) => setCopyName(e.target.value)}
                className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-accent focus:outline-none"
                placeholder="Investigation name"
              />
            </div>
            {targetLevel && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                <AlertTriangle size={12} className="mr-1 inline" />
                Items classified above <strong>{targetLevel}</strong> will be excluded from the copy.
                {' '}{items.filter((i) => clsLevelIndex(i.clsLevel) > clsLevelIndex(targetLevel)).length} items will be dropped.
              </div>
            )}
            {copyError && <p className="text-xs text-red-400">{copyError}</p>}
          </div>
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setCopyView(false)}
              className="text-sm text-gray-400 hover:text-gray-200"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!targetLevel || !copyName.trim() || copying || lowerLevels.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/15 px-4 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Copy size={13} />
              {copying ? 'Copying…' : 'Create copy'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              {loading
                ? 'Scanning investigation…'
                : items.length === 0
                  ? 'No explicitly classified items found — the investigation TLP may be set at the folder level only.'
                  : `${items.length} classified item${items.length !== 1 ? 's' : ''} found across all entity types.`}
            </p>
            {!loading && lowerLevels.length > 0 && (
              <button
                type="button"
                onClick={handleOpenCopy}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-hover px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                <Copy size={11} />
                Copy at lower TLP
                <ChevronRight size={11} />
              </button>
            )}
          </div>

          {loading && (
            <div className="flex h-20 items-center justify-center text-xs text-gray-500">
              Scanning…
            </div>
          )}

          {!loading && items.length > 0 && (
            <div className="space-y-3">
              {sortedLevels.map((level) => (
                <div key={level}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <ClsBadge level={level} />
                    <span className="text-xs text-gray-500">{grouped[level].length} item{grouped[level].length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-0.5 rounded-lg border border-gray-700 bg-gray-800/60 p-2">
                    {grouped[level].map((item) => {
                      const Icon = TYPE_ICONS[item.type];
                      return (
                        <div key={item.id} className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-gray-700/60">
                          <Icon size={12} className="shrink-0 text-gray-500" aria-hidden="true" />
                          <span className="min-w-[72px] text-[10px] font-medium uppercase tracking-wide text-gray-500">
                            {TYPE_LABELS[item.type]}
                          </span>
                          <span className="truncate text-xs text-gray-300">{item.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
