import { useState, useEffect, useRef, useCallback } from 'react';
import { Excalidraw, MainMenu, exportToBlob, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';

// Self-host fonts — prevent CDN fallback to esm.sh
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).EXCALIDRAW_ASSET_PATH = '/';
}
import { ArrowLeft, Trash2, Image, Sparkles, Link2 } from 'lucide-react';
import { markPending, clearPending } from '../../lib/pending-changes';
import type { Whiteboard, Tag, Folder, Settings } from '../../types';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawTextElement } from '@excalidraw/excalidraw/element/types';
import { TagInput } from '../Common/TagInput';
import { ClsSelect } from '../Common/ClsSelect';
import { ConfirmDialog } from '../Common/ConfirmDialog';
import { EntityInvestigationBar } from '../Common/EntityInvestigationBar';
import { PromoteModal, AddEntityModal, type CanvasEntityRef } from '../Common/CanvasEntityBridge';

interface WhiteboardEditorProps {
  whiteboard: Whiteboard;
  allTags: Tag[];
  folders: Folder[];
  onUpdate: (id: string, updates: Partial<Whiteboard>) => void;
  onCreateTag: (name: string) => Promise<Tag>;
  onBack: () => void;
  onDelete?: (id: string) => void;
  settings?: Settings;
  /** Existing Notes/Tasks/IOCs offered by the "Add entity" picker. */
  entities?: CanvasEntityRef[];
  /** Promotes a selected text element on the canvas to a real Note/Task/IOC. */
  onPromoteToEntity?: (kind: CanvasEntityRef['type'], text: string, investigationId: string | undefined, clsLevel: string | undefined) => Promise<void>;
}

function pickAppState(appState: Record<string, unknown>): Record<string, unknown> {
  const { zoom, scrollX, scrollY, theme } = appState;
  return { zoom, scrollX, scrollY, theme };
}

export default function WhiteboardEditor({ whiteboard, allTags, folders, onUpdate, onCreateTag, onBack, onDelete, settings, entities, onPromoteToEntity }: WhiteboardEditorProps) {
  const [name, setName] = useState(whiteboard.name);
  const [saved, setSaved] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [promptingText, setPromptingText] = useState<string | null>(null);
  const [showEntityPicker, setShowEntityPicker] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const excalidrawSaveRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const pendingNameRef = useRef<string | null>(null);
  const pendingSceneRef = useRef<{ elements: readonly unknown[]; appState: Record<string, unknown> } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(whiteboard.name);
  }, [whiteboard.id, whiteboard.name]);

  const flashSaved = useCallback(() => {
    setSaved(true);
    clearTimeout(savedTimeoutRef.current);
    savedTimeoutRef.current = setTimeout(() => setSaved(false), 1500);
  }, []);

  const flushPendingNameSave = useCallback((showSaved = true) => {
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = undefined;

    const pendingName = pendingNameRef.current;
    if (pendingName === null) return;

    pendingNameRef.current = null;
    clearPending();
    onUpdate(whiteboard.id, { name: pendingName });
    if (showSaved) flashSaved();
  }, [flashSaved, onUpdate, whiteboard.id]);

  const flushPendingSceneSave = useCallback((showSaved = true) => {
    clearTimeout(excalidrawSaveRef.current);
    excalidrawSaveRef.current = undefined;

    const pendingScene = pendingSceneRef.current;
    if (!pendingScene) return;

    pendingSceneRef.current = null;
    clearPending();
    onUpdate(whiteboard.id, {
      elements: JSON.stringify(pendingScene.elements),
      appState: JSON.stringify(pendingScene.appState),
    });
    if (showSaved) flashSaved();
  }, [flashSaved, onUpdate, whiteboard.id]);

  useEffect(() => {
    return () => {
      flushPendingNameSave(false);
      flushPendingSceneSave(false);
      clearTimeout(savedTimeoutRef.current);
    };
  }, [flushPendingNameSave, flushPendingSceneSave]);

  const handleNameChange = (value: string) => {
    setName(value);
    clearTimeout(saveTimeoutRef.current);
    pendingNameRef.current = value;
    markPending();
    saveTimeoutRef.current = setTimeout(() => flushPendingNameSave(), 500);
  };

  const handleExcalidrawChange = useCallback((elements: readonly unknown[], appState: Record<string, unknown>) => {
    clearTimeout(excalidrawSaveRef.current);
    pendingSceneRef.current = {
      elements: [...elements],
      appState: pickAppState(appState),
    };
    markPending();
    excalidrawSaveRef.current = setTimeout(() => flushPendingSceneSave(), 500);

    // Promote is only offered for a single selected plain text element.
    const selectedIds = appState.selectedElementIds as Record<string, boolean> | undefined;
    const ids = selectedIds ? Object.keys(selectedIds).filter((id) => selectedIds[id]) : [];
    if (ids.length === 1) {
      const el = (elements as ExcalidrawTextElement[]).find((e) => e.id === ids[0]);
      setSelectedText(el && el.type === 'text' ? (el.originalText || el.text || '') : null);
    } else {
      setSelectedText(null);
    }
  }, [flushPendingSceneSave]);

  const handleAddEntity = useCallback((entity: CanvasEntityRef) => {
    const api = excalidrawApiRef.current;
    if (!api) return;
    const prefix = entity.type === 'note' ? 'Note' : entity.type === 'task' ? 'Task' : 'IOC';
    const appState = api.getAppState();
    const scrollX = typeof appState.scrollX === 'number' ? appState.scrollX : 0;
    const scrollY = typeof appState.scrollY === 'number' ? appState.scrollY : 0;
    const zoomValue = typeof appState.zoom?.value === 'number' ? appState.zoom.value : 1;
    const [newEl] = convertToExcalidrawElements([{
      type: 'text',
      text: `[${prefix}] ${entity.label}`,
      x: (appState.width / 2 - scrollX) / zoomValue - 60,
      y: (appState.height / 2 - scrollY) / zoomValue - 12,
    }]);
    api.updateScene({ elements: [...api.getSceneElements(), newEl] });
    setShowEntityPicker(false);
  }, []);

  const handleTagsChange = useCallback((tags: string[]) => {
    onUpdate(whiteboard.id, { tags });
    flashSaved();
  }, [whiteboard.id, onUpdate, flashSaved]);

  const handleFolderChange = useCallback((folderId?: string) => {
    onUpdate(whiteboard.id, { folderId });
    flashSaved();
  }, [whiteboard.id, onUpdate, flashSaved]);

  const handleExportPNG = useCallback(async () => {
    const api = excalidrawApiRef.current;
    if (!api) return;
    try {
      const elements = api.getSceneElements();
      const appState = api.getAppState();
      const blob = await exportToBlob({
        elements,
        appState: { ...appState, exportWithDarkMode: appState.theme === 'dark' },
        files: api.getFiles(),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${whiteboard.name || 'whiteboard'}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export whiteboard as PNG:', err);
    }
  }, [whiteboard.name]);

  // Parse initial data
  let initialElements: unknown[] = [];
  try { initialElements = JSON.parse(whiteboard.elements); } catch (e) { console.warn('Failed to parse whiteboard elements:', e); }

  let initialAppState: Record<string, unknown> = {};
  if (whiteboard.appState) {
    try { initialAppState = pickAppState(JSON.parse(whiteboard.appState)); } catch (e) { console.warn('Failed to parse whiteboard appState:', e); }
  }

  // Detect theme from document
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar — two rows so the name input and the Move-To/TLP controls each
          get their own full-width row instead of competing as two flex-1
          elements in one row, which is what caused them to overlap on narrow
          (mobile) viewports. */}
      <div className="flex flex-col gap-2 p-2 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-2 -m-0.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
            title="Back to list"
          >
            <ArrowLeft size={18} />
          </button>
          <input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-gray-200 text-sm font-medium px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="Whiteboard name"
          />
          {saved && <span className="text-xs text-green-500 shrink-0">Saved</span>}
          <button
            onClick={handleExportPNG}
            className="p-2 -m-0.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
            title="Export as PNG"
          >
            <Image size={16} />
          </button>
          {onDelete && (
            <button
              onClick={() => setShowConfirmDelete(true)}
              className="p-2 -m-0.5 rounded text-red-500 hover:text-red-400 hover:bg-gray-800 shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
              title="Delete whiteboard"
              aria-label="Delete whiteboard"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <EntityInvestigationBar
            folders={folders}
            currentFolderId={whiteboard.folderId}
            onMove={handleFolderChange}
            className="min-w-0 flex-1"
          />
          <ClsSelect
            value={whiteboard.clsLevel}
            onChange={(clsLevel) => { onUpdate(whiteboard.id, { clsLevel }); flashSaved(); }}
            clsLevels={settings?.tiClsLevels}
          />
        </div>
      </div>

      {/* Tags */}
      <div className="px-3 py-1.5 border-b border-gray-800 shrink-0">
        <TagInput
          selectedTags={whiteboard.tags}
          allTags={allTags}
          onChange={handleTagsChange}
          onCreateTag={onCreateTag}
        />
      </div>

      {/* Entity bridge — promote the selected text element to a real Note/Task/
          IOC, or bring an existing one onto the board. Rendered in normal flow
          (not floated over the canvas) so it can never collide with Excalidraw's
          own toolbar, which claims the entire top band of the canvas on narrow
          viewports regardless of what breakpoint we'd otherwise guess at. */}
      {(onPromoteToEntity || entities) && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-gray-800 shrink-0">
          {onPromoteToEntity && (
            <button
              type="button"
              onClick={() => selectedText && setPromptingText(selectedText)}
              disabled={!selectedText}
              title={selectedText ? 'Promote selected text to a Note, Task, or IOC' : 'Select a single text element to promote'}
              className="flex items-center gap-1 rounded-lg border border-border-subtle bg-bg-raised px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40 min-h-[36px]"
            >
              <Sparkles size={13} />
              Promote
            </button>
          )}
          {entities && (
            <button
              type="button"
              onClick={() => setShowEntityPicker(true)}
              title="Add an existing Note, Task, or IOC to the board"
              className="flex items-center gap-1 rounded-lg border border-border-subtle bg-bg-raised px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors hover:text-text-primary min-h-[36px]"
            >
              <Link2 size={13} />
              Add entity
            </button>
          )}
        </div>
      )}

      {/* Excalidraw canvas — needs a container with explicit dimensions */}
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0">
          <Excalidraw
            key={whiteboard.id}
            excalidrawAPI={(api) => { excalidrawApiRef.current = api; }}
            initialData={{
              elements: initialElements as never,
              appState: {
                ...initialAppState,
                theme: isDark ? 'dark' : 'light',
              } as never,
            }}
            onChange={handleExcalidrawChange as never}
            UIOptions={{
              canvasActions: {
                loadScene: false,
                saveToActiveFile: false,
                export: { saveFileToDisk: true },
              },
            }}
          >
            {/* Custom menu without social links (GitHub, X, Discord) */}
            <MainMenu>
              <MainMenu.DefaultItems.ClearCanvas />
              <MainMenu.DefaultItems.ChangeCanvasBackground />
              <MainMenu.Separator />
              <MainMenu.DefaultItems.ToggleTheme />
              <MainMenu.DefaultItems.Help />
            </MainMenu>
          </Excalidraw>
        </div>
      </div>

      {promptingText && onPromoteToEntity && (
        <PromoteModal
          text={promptingText}
          folders={folders}
          onPromote={async (kind, investigationId, clsLevel) => {
            await onPromoteToEntity(kind, promptingText, investigationId, clsLevel);
            setPromptingText(null);
          }}
          onClose={() => setPromptingText(null)}
        />
      )}

      {showEntityPicker && entities && (
        <AddEntityModal
          entities={entities}
          onPick={handleAddEntity}
          onClose={() => setShowEntityPicker(false)}
        />
      )}

      <ConfirmDialog
        open={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        onConfirm={() => onDelete?.(whiteboard.id)}
        title="Delete Whiteboard"
        message="This whiteboard will be permanently deleted. This cannot be undone."
        confirmLabel="Delete Whiteboard"
        danger
      />
    </div>
  );
}
