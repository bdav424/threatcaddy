import { useCallback, useEffect, useRef, useState } from 'react';
import { Briefcase, ChevronDown } from 'lucide-react';
import { useInvestigation } from '../../contexts/InvestigationContext';
import { cn } from '../../lib/utils';
import type { Folder } from '../../types';

const NO_INVESTIGATION_LABEL = 'No investigation';
const MAX_UNDO_DEPTH = 10;
const ANNOTATION_DURATION_MS = 4000;

interface MoveHistoryEntry {
  fromFolderId: string | undefined;
  fromFolderName: string;
}

interface EntityInvestigationBarProps {
  folders: Folder[];
  currentFolderId?: string;
  onMove: (folderId: string | undefined) => void;
  className?: string;
}

/**
 * Shown inside single-item editors (notes, whiteboards, ...). Splits what used to be one
 * conflated "investigation name → dropdown that reassigns the item" control into two:
 * the name opens investigation-level options (rename/TLP/archive), a separate "Move to"
 * button reassigns this item to a different investigation.
 */
export function EntityInvestigationBar({ folders, currentFolderId, onMove, className }: EntityInvestigationBarProps) {
  const { setEditingFolderId } = useInvestigation();
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [annotation, setAnnotation] = useState<{ fromName: string } | null>(null);
  const undoStackRef = useRef<MoveHistoryEntry[]>([]);
  const annotationTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const currentFolder = folders.find((f) => f.id === currentFolderId);
  const otherFolders = folders.filter((f) => f.id !== currentFolderId);

  const dismissAnnotationLater = useCallback(() => {
    clearTimeout(annotationTimeoutRef.current);
    annotationTimeoutRef.current = setTimeout(() => setAnnotation(null), ANNOTATION_DURATION_MS);
  }, []);

  const moveTo = useCallback((toFolderId: string | undefined) => {
    const fromFolderId = currentFolderId;
    const fromFolderName = folders.find((f) => f.id === fromFolderId)?.name || NO_INVESTIGATION_LABEL;
    onMove(toFolderId);
    undoStackRef.current.push({ fromFolderId, fromFolderName });
    if (undoStackRef.current.length > MAX_UNDO_DEPTH) undoStackRef.current.shift();
    setAnnotation({ fromName: fromFolderName });
    dismissAnnotationLater();
    setShowMoveMenu(false);
  }, [currentFolderId, folders, onMove, dismissAnnotationLater]);

  const handleUndo = useCallback(() => {
    const last = undoStackRef.current.pop();
    if (!last) return;
    onMove(last.fromFolderId);
    clearTimeout(annotationTimeoutRef.current);
    setAnnotation(null);
  }, [onMove]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only claim Ctrl+Z when there's a move to undo — otherwise let the
      // browser/editor's own undo (e.g. note text editing) proceed untouched.
      if (event.ctrlKey && event.key === 'z' && undoStackRef.current.length > 0) {
        event.preventDefault();
        handleUndo();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo]);

  useEffect(() => {
    if (!showMoveMenu) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setShowMoveMenu(false);
    };
    window.addEventListener('mousedown', closeOnOutsideClick);
    return () => window.removeEventListener('mousedown', closeOnOutsideClick);
  }, [showMoveMenu]);

  useEffect(() => () => clearTimeout(annotationTimeoutRef.current), []);

  return (
    <div ref={containerRef} className={cn('relative flex items-center gap-1', className)}>
      <button
        type="button"
        onClick={() => currentFolder && setEditingFolderId(currentFolder.id)}
        disabled={!currentFolder}
        className={cn(
          'flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors',
          currentFolder ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'cursor-default text-gray-500',
        )}
        title={currentFolder ? `Investigation options for ${currentFolder.name}` : NO_INVESTIGATION_LABEL}
        aria-label={currentFolder ? `Open investigation options for ${currentFolder.name}` : NO_INVESTIGATION_LABEL}
      >
        <Briefcase size={14} />
        <span className="max-w-[140px] truncate">{currentFolder?.name || NO_INVESTIGATION_LABEL}</span>
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setShowMoveMenu((v) => !v)}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
          title="Move to a different investigation"
          aria-haspopup="listbox"
          aria-expanded={showMoveMenu}
        >
          <span>Move to</span>
          <ChevronDown size={12} className={cn('transition-transform', showMoveMenu && 'rotate-180')} />
        </button>
        {showMoveMenu && (
          <div
            role="listbox"
            aria-label="Move to investigation"
            className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-xl"
          >
            {currentFolderId && (
              <button
                type="button"
                role="option"
                onClick={() => moveTo(undefined)}
                className="w-full px-3 py-1.5 text-start text-xs text-gray-300 hover:bg-gray-800"
              >
                {NO_INVESTIGATION_LABEL}
              </button>
            )}
            {otherFolders.length === 0 && !currentFolderId && (
              <div className="px-3 py-1.5 text-xs text-gray-500">No other investigations</div>
            )}
            {otherFolders.map((f) => (
              <button
                key={f.id}
                type="button"
                role="option"
                onClick={() => moveTo(f.id)}
                className="w-full truncate px-3 py-1.5 text-start text-xs text-gray-300 hover:bg-gray-800"
              >
                {f.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {annotation && (
        <div className="move-annotation absolute right-0 top-full z-50 mt-1 flex items-center gap-2 whitespace-nowrap rounded-lg border border-accent/40 bg-gray-900 px-2.5 py-1 text-[11px] text-gray-300 shadow-xl">
          <span>Moved from {annotation.fromName}</span>
          <button type="button" onClick={handleUndo} className="font-medium text-accent hover:text-accent/80">
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
