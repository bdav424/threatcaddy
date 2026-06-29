import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Pin, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Note } from '../../types';
import { cn } from '../../lib/utils';

interface JotsPanelProps {
  notes: Note[];
  onClose: () => void;
  onCreateJot: () => void;
  onUpdateJot: (id: string, updates: Partial<Note>) => void;
  onTrashJot: (id: string) => void;
  onSelect?: (id: string) => void;
}

export function JotsPanel({ notes, onClose, onCreateJot, onUpdateJot, onTrashJot, onSelect }: JotsPanelProps) {
  const jots = notes.filter((n) => n.noteType === 'sticky' && !n.trashed && !n.archived);
  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const current = jots[index] ?? null;

  // Keep index in bounds when jots list changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (index >= jots.length && jots.length > 0) setIndex(jots.length - 1);
  }, [jots.length, index]);

  // Sync draft when card changes
  useEffect(() => {
    if (current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(current.content);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitleDraft(current.title);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditing(false);
    }
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleSave = useCallback((id: string, updates: Partial<Note>) => {
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => onUpdateJot(id, updates), 600);
  }, [onUpdateJot]);

  const handlePrev = () => setIndex((i) => Math.max(0, i - 1));
  const handleNext = () => setIndex((i) => Math.min(jots.length - 1, i + 1));

  // Arrow key navigation when not editing
  useEffect(() => {
    if (editing) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); handleNext(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(saveTimeoutRef.current), []);

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-72 rounded-xl border border-border-medium bg-bg-raised shadow-2xl"
      data-jots-panel="true"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Pin size={13} className="text-accent" />
          <span className="text-xs font-semibold text-text-primary">Jots</span>
          {jots.length > 0 && (
            <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
              {index + 1}/{jots.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onCreateJot}
            className="flex h-5 w-5 items-center justify-center rounded text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
            title="New jot"
          >
            <Plus size={12} />
          </button>
          <button
            onClick={onClose}
            className="flex h-5 w-5 items-center justify-center rounded text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
            title="Close Jots"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Card area */}
      {jots.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-text-muted">
          <Pin size={28} strokeWidth={1.5} className="text-text-faint" />
          <p className="text-xs">No jots yet</p>
          <button
            onClick={onCreateJot}
            className="rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
          >
            Add first jot
          </button>
        </div>
      ) : (
        <div className="relative p-3">
          {/* Title */}
          {editing ? (
            <input
              ref={titleRef}
              value={titleDraft}
              onChange={(e) => {
                setTitleDraft(e.target.value);
                if (current) scheduleSave(current.id, { title: e.target.value });
              }}
              className="mb-2 w-full rounded border border-border-subtle bg-transparent px-1.5 py-0.5 text-xs font-semibold text-text-primary outline-none focus:border-accent/50"
              placeholder="Title…"
            />
          ) : (
            <button
              className={cn('mb-1 block w-full text-left text-xs font-semibold text-text-primary truncate', !current.title && 'text-text-muted')}
              onClick={() => { setEditing(true); setTimeout(() => textRef.current?.focus(), 50); }}
            >
              {current.title || 'Untitled jot'}
            </button>
          )}

          {/* Content */}
          {editing ? (
            <textarea
              ref={textRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (current) scheduleSave(current.id, { content: e.target.value });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
              }}
              className="h-28 w-full resize-none rounded border border-border-subtle bg-bg-surface px-2 py-1.5 text-xs text-text-primary placeholder-text-muted outline-none focus:border-accent/40"
              placeholder="Write your jot…"
              autoFocus
            />
          ) : (
            <button
              className={cn(
                'block h-28 w-full overflow-hidden rounded border border-border-subtle bg-bg-surface px-2 py-1.5 text-left text-xs text-text-secondary whitespace-pre-wrap',
                !draft && 'text-text-muted',
              )}
              onClick={() => setEditing(true)}
            >
              {draft || 'Click to edit…'}
            </button>
          )}

          {/* Footer */}
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrev}
                disabled={index === 0}
                className="flex h-6 w-6 items-center justify-center rounded text-text-muted disabled:opacity-30 hover:bg-bg-hover hover:text-text-primary"
                title="Previous jot (←)"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={handleNext}
                disabled={index >= jots.length - 1}
                className="flex h-6 w-6 items-center justify-center rounded text-text-muted disabled:opacity-30 hover:bg-bg-hover hover:text-text-primary"
                title="Next jot (→)"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="flex items-center gap-1">
              {onSelect && (
                <button
                  onClick={() => { onSelect(current.id); onClose(); }}
                  className="rounded px-2 py-0.5 text-[10px] text-text-muted transition-colors hover:text-accent"
                  title="Open in editor"
                >
                  Open
                </button>
              )}
              <button
                onClick={() => {
                  if (confirm('Trash this jot?')) onTrashJot(current.id);
                }}
                className="flex h-6 w-6 items-center justify-center rounded text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                title="Trash jot"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pip dots for quick navigation */}
      {jots.length > 1 && (
        <div className="flex justify-center gap-1 pb-2">
          {jots.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={cn(
                'h-1.5 w-1.5 rounded-full transition-colors',
                i === index ? 'bg-accent' : 'bg-border-medium hover:bg-text-muted',
              )}
              aria-label={`Go to jot ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
