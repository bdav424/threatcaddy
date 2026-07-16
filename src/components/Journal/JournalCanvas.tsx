import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Excalidraw, MainMenu, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { Lock, Unlock, Sparkles, Link2 } from 'lucide-react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawTextElement } from '@excalidraw/excalidraw/element/types';
import type { JournalPage } from '../../types';

// Self-host Excalidraw's fonts/assets from /fonts instead of the esm.sh CDN
// (same as WhiteboardEditor — the woff2 already ship in public/fonts).
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).EXCALIDRAW_ASSET_PATH = '/';
}

interface JournalCanvasProps {
  page: JournalPage;
  onUpdate: (updates: Partial<JournalPage>) => void;
  /** Fired when the user asks to promote the single selected text element to a real entity. */
  onPromote?: (text: string) => void;
  /** Fired when the user asks to bring an existing entity onto the canvas. */
  onAddEntity?: () => void;
}

export interface JournalCanvasHandle {
  /** Insert a labeled text element (used after picking an entity to add to the canvas). */
  insertLabel: (text: string) => void;
}

function pickAppState(appState: Record<string, unknown>): Record<string, unknown> {
  const { zoom, scrollX, scrollY, theme } = appState;
  return { zoom, scrollX, scrollY, theme };
}

// A per-page movable canvas backed by Excalidraw. Phase 1 of the OkSo-style
// nested canvas: text and a movable canvas coexist on one journal page. The
// lock "holds the page" — Excalidraw's view mode makes the scene read-only so
// you can pan/zoom around a fixed board without nudging elements; unlock to
// edit and rearrange. Phase 2 bridges the canvas to real entities: promote a
// selected text element to a Note/Task/IOC, or bring an existing one in.
const JournalCanvas = forwardRef<JournalCanvasHandle, JournalCanvasProps>(function JournalCanvas(
  { page, onUpdate, onPromote, onAddEntity },
  ref,
) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingRef = useRef<{ elements: readonly unknown[]; appState: Record<string, unknown> } | null>(null);
  const [locked, setLocked] = useState(false);
  const [selectedText, setSelectedText] = useState<string | null>(null);

  // onUpdate is a fresh closure every render (it captures the current page id in
  // JournalView). Keep a ref to the latest one so the save callbacks below can
  // stay STABLE (empty deps). If they changed each render, the unmount effect
  // keyed on them would run its cleanup on every render, flushing synchronously
  // → save → reload() → re-render → an unbroken loop (and the churn stopped new
  // elements from ever committing). Track the last serialized scene too, so
  // pure cursor/selection changes (which also fire onChange) don't write.
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);
  const lastSavedRef = useRef<string>(page.canvasData ?? '');

  const flush = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = undefined;
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    const elementsJson = JSON.stringify(pending.elements);
    if (elementsJson === lastSavedRef.current) return; // nothing structural changed
    lastSavedRef.current = elementsJson;
    onUpdateRef.current({
      canvasData: elementsJson,
      canvasAppState: JSON.stringify(pending.appState),
    });
  }, []);

  // Flush any pending scene on unmount so switching back to text (or pages)
  // never drops the last edits. `flush` is stable, so this runs only on unmount.
  useEffect(() => () => flush(), [flush]);

  const handleChange = useCallback((elements: readonly unknown[], appState: Record<string, unknown>) => {
    clearTimeout(saveTimer.current);
    pendingRef.current = { elements: [...elements], appState: pickAppState(appState) };
    saveTimer.current = setTimeout(() => flush(), 600);

    // Promote is only offered for a single selected plain text element.
    const selectedIds = appState.selectedElementIds as Record<string, boolean> | undefined;
    const ids = selectedIds ? Object.keys(selectedIds).filter((id) => selectedIds[id]) : [];
    if (ids.length === 1) {
      const el = (elements as ExcalidrawTextElement[]).find((e) => e.id === ids[0]);
      setSelectedText(el && el.type === 'text' ? (el.originalText || el.text || '') : null);
    } else {
      setSelectedText(null);
    }
  }, [flush]);

  useImperativeHandle(ref, () => ({
    insertLabel: (text: string) => {
      const api = apiRef.current;
      if (!api) return;
      const appState = api.getAppState();
      const scrollX = typeof appState.scrollX === 'number' ? appState.scrollX : 0;
      const scrollY = typeof appState.scrollY === 'number' ? appState.scrollY : 0;
      const zoomValue = typeof appState.zoom?.value === 'number' ? appState.zoom.value : 1;
      const [newEl] = convertToExcalidrawElements([{
        type: 'text',
        text,
        x: (appState.width / 2 - scrollX) / zoomValue - 60,
        y: (appState.height / 2 - scrollY) / zoomValue - 12,
      }]);
      api.updateScene({ elements: [...api.getSceneElements(), newEl] });
    },
  }), []);

  let initialElements: unknown[] = [];
  if (page.canvasData) {
    try { initialElements = JSON.parse(page.canvasData); } catch (e) { console.warn('Failed to parse journal canvas elements:', e); }
  }
  let initialAppState: Record<string, unknown> = {};
  if (page.canvasAppState) {
    try { initialAppState = pickAppState(JSON.parse(page.canvasAppState)); } catch (e) { console.warn('Failed to parse journal canvas appState:', e); }
  }

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  return (
    <div className="absolute inset-0">
      <Excalidraw
        key={page.id}
        excalidrawAPI={(api) => { apiRef.current = api; }}
        viewModeEnabled={locked}
        initialData={{
          elements: initialElements as never,
          appState: { ...initialAppState, theme: isDark ? 'dark' : 'light' } as never,
        }}
        onChange={handleChange as never}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: { saveFileToDisk: true },
          },
        }}
      >
        <MainMenu>
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ToggleTheme />
          <MainMenu.DefaultItems.Help />
        </MainMenu>
      </Excalidraw>

      {/* Lock toggle — floats over the canvas so it's reachable without hunting
          through Excalidraw's own UI. Locked = read-only (pan/zoom a held
          board); unlocked = edit and rearrange. */}
      <button
        type="button"
        onClick={() => setLocked((v) => !v)}
        title={locked ? 'Canvas locked — click to edit' : 'Lock canvas (pan/zoom without moving items)'}
        className={
          'absolute right-3 top-3 z-10 flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium shadow-lg backdrop-blur transition-colors ' +
          (locked
            ? 'border-accent bg-accent/20 text-accent'
            : 'border-border-subtle bg-bg-raised/90 text-text-muted hover:text-text-primary')
        }
      >
        {locked ? <Lock size={13} /> : <Unlock size={13} />}
        {locked ? 'Locked' : 'Lock'}
      </button>

      {/* Entity bridge — promote the selected text element to a real Note/Task/
          IOC, or bring an existing one onto the board. Hidden while locked;
          both are edits and the lock exists specifically to prevent those. */}
      {!locked && (onPromote || onAddEntity) && (
        <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5">
          {onPromote && (
            <button
              type="button"
              onClick={() => selectedText && onPromote(selectedText)}
              disabled={!selectedText}
              title={selectedText ? 'Promote selected text to a Note, Task, or IOC' : 'Select a single text element to promote'}
              className="flex items-center gap-1 rounded-lg border border-border-subtle bg-bg-raised/90 px-2.5 py-1.5 text-xs font-medium text-text-muted shadow-lg backdrop-blur transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles size={13} />
              Promote
            </button>
          )}
          {onAddEntity && (
            <button
              type="button"
              onClick={onAddEntity}
              title="Add an existing Note, Task, or IOC to the canvas"
              className="flex items-center gap-1 rounded-lg border border-border-subtle bg-bg-raised/90 px-2.5 py-1.5 text-xs font-medium text-text-muted shadow-lg backdrop-blur transition-colors hover:text-text-primary"
            >
              <Link2 size={13} />
              Add entity
            </button>
          )}
        </div>
      )}
    </div>
  );
});

export default JournalCanvas;
