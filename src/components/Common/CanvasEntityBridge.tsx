import { useState, useMemo } from 'react';
import { Sparkles, Link2, FileText, CheckSquare, Crosshair, Search } from 'lucide-react';
import type { Folder } from '../../types';
import { extractIOCs } from '../../lib/ioc-extractor';
import { ClsSelect } from './ClsSelect';
import { cn } from '../../lib/utils';

// An existing Note/Task/IOC, flattened to what a canvas entity-bridge needs
// (canvas editors don't import Note/Task/StandaloneIOC directly — App.tsx owns
// those hooks and hands down this narrower shape).
export interface CanvasEntityRef {
  id: string;
  type: 'note' | 'task' | 'ioc';
  label: string;
  clsLevel?: string;
  folderId?: string;
}

export const ENTITY_ICON: Record<CanvasEntityRef['type'], typeof FileText> = {
  note: FileText,
  task: CheckSquare,
  ioc: Crosshair,
};

interface PromoteModalProps {
  text: string;
  folders: Folder[];
  onPromote: (kind: CanvasEntityRef['type'], investigationId: string | undefined, clsLevel: string | undefined) => void;
  onClose: () => void;
}

export function PromoteModal({ text, folders, onPromote, onClose }: PromoteModalProps) {
  const [kind, setKind] = useState<CanvasEntityRef['type']>('note');
  const [investigationId, setInvestigationId] = useState('');
  const [clsLevel, setClsLevel] = useState<string | undefined>(undefined);
  const activeInvestigations = folders.filter((f) => !('isFolder' in f));
  const detectedIOC = useMemo(() => extractIOCs(text)[0], [text]);
  const preview = text.length > 140 ? `${text.slice(0, 140)}…` : text;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm rounded-xl border border-border-medium bg-bg-raised shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-accent" />
            <span className="text-sm font-semibold text-text-primary">Promote to…</span>
          </div>
        </div>
        <div className="space-y-3 p-4">
          <div className="rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-xs text-text-secondary">
            {preview}
          </div>

          <div>
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-muted">Type</span>
            <div className="flex gap-1.5">
              {(['note', 'task', 'ioc'] as const).map((k) => {
                const Icon = ENTITY_ICON[k];
                const disabled = k === 'ioc' && !detectedIOC;
                return (
                  <button
                    key={k}
                    type="button"
                    disabled={disabled}
                    onClick={() => setKind(k)}
                    title={disabled ? 'No IOC pattern detected in this text' : undefined}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                      kind === k ? 'border-accent bg-accent/15 text-accent' : 'border-border-subtle text-text-secondary hover:bg-bg-hover',
                    )}
                  >
                    <Icon size={12} />
                    {k}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              TLP / classification
            </span>
            <ClsSelect value={clsLevel} onChange={setClsLevel} className="w-full" />
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Investigation (optional)
            </span>
            <select
              value={investigationId}
              onChange={(e) => setInvestigationId(e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent/40 focus:outline-none"
            >
              <option value="">Personal (no investigation)</option>
              {activeInvestigations.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-text-muted">
              Binding to an investigation makes that investigation's TLP a floor for the new entity — it can only raise its classification, never lower it.
            </p>
          </label>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-border-subtle px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
            >
              Cancel
            </button>
            <button
              onClick={() => onPromote(kind, investigationId || undefined, clsLevel)}
              className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
            >
              Promote
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AddEntityModalProps {
  entities: CanvasEntityRef[];
  onPick: (entity: CanvasEntityRef) => void;
  onClose: () => void;
}

export function AddEntityModal({ entities, onPick, onClose }: AddEntityModalProps) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q ? entities.filter((e) => e.label.toLowerCase().includes(q)) : entities;
    return matches.slice(0, 50);
  }, [entities, query]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[70vh] w-full max-w-sm flex-col rounded-xl border border-border-medium bg-bg-raised shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <div className="flex items-center gap-2">
            <Link2 size={15} className="text-accent" />
            <span className="text-sm font-semibold text-text-primary">Add entity to canvas</span>
          </div>
        </div>
        <div className="border-b border-border-subtle p-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-surface px-2 py-1.5">
            <Search size={12} className="shrink-0 text-text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes, tasks, IOCs…"
              className="w-full bg-transparent text-sm text-text-primary focus:outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {entities.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-text-muted">No notes, tasks, or IOCs yet.</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-text-muted">No matches.</div>
          ) : (
            filtered.map((entity) => {
              const Icon = ENTITY_ICON[entity.type];
              return (
                <button
                  key={`${entity.type}-${entity.id}`}
                  type="button"
                  onClick={() => onPick(entity)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-text-primary hover:bg-bg-hover"
                >
                  <Icon size={13} className="shrink-0 text-text-muted" />
                  <span className="truncate">{entity.label || 'Untitled'}</span>
                </button>
              );
            })
          )}
        </div>
        <div className="border-t border-border-subtle p-2">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-border-subtle px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
