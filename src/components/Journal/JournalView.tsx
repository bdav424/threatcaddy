import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { BookOpen, Plus, Trash2, Send, Palette, Upload, Pencil, X } from 'lucide-react';
import { useJournalPages, JOURNAL_THEME_LABELS, JOURNAL_THEMES } from '../../hooks/useJournalPages';
import type { JournalPage, JournalPageTheme, Folder } from '../../types';
import { cn } from '../../lib/utils';

// ── Page theme CSS ────────────────────────────────────────────────────────────

function getThemeClasses(theme: JournalPageTheme): string {
  switch (theme) {
    case 'paper': return 'bg-[#faf8f3] text-[#2c2c2c]';
    case 'lined': return 'bg-white lined-page';
    case 'bullet': return 'bg-white bullet-page';
    case 'grid': return 'bg-white grid-page';
    case 'cream': return 'bg-[#fffdf5] text-[#2c2c2c]';
    case 'blue-gray': return 'bg-[#f0f4f8] text-[#1e2a3a]';
    case 'sage': return 'bg-[#f2f5f0] text-[#2a3328]';
    case 'watermark': return 'bg-white watermark-page';
    default: return 'bg-white text-gray-900';
  }
}

// ── Tear to investigation modal ───────────────────────────────────────────────

interface TearModalProps {
  page: JournalPage;
  folders: Folder[];
  onTear: (investigationId: string) => void;
  onClose: () => void;
}

function TearModal({ page, folders, onTear, onClose }: TearModalProps) {
  const [selectedId, setSelectedId] = useState('');
  const activeInvestigations = folders.filter((f) => !('isFolder' in f));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-xl border border-border-medium bg-bg-raised shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <div className="flex items-center gap-2">
            <Send size={15} className="text-accent" />
            <span className="text-sm font-semibold text-text-primary">Send page to investigation</span>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-text-muted">
            A copy of <strong className="text-text-primary">"{page.title}"</strong> will be created as a note in the selected investigation. The original stays in your Journal.
          </p>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent/40 focus:outline-none"
          >
            <option value="">Select an investigation…</option>
            {activeInvestigations.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-border-subtle px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
            >
              Cancel
            </button>
            <button
              onClick={() => { if (selectedId) onTear(selectedId); }}
              disabled={!selectedId}
              className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-40"
            >
              Send page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Theme picker ──────────────────────────────────────────────────────────────

interface ThemePickerProps {
  current: JournalPageTheme;
  onChange: (theme: JournalPageTheme) => void;
  onClose: () => void;
}

function ThemePicker({ current, onChange, onClose }: ThemePickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute right-0 top-full z-40 mt-1 w-40 rounded-lg border border-border-medium bg-bg-raised shadow-lg">
      {JOURNAL_THEMES.map((t) => (
        <button
          key={t}
          onClick={() => { onChange(t); onClose(); }}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-bg-hover',
            current === t ? 'text-accent font-medium' : 'text-text-secondary',
          )}
        >
          {JOURNAL_THEME_LABELS[t]}
        </button>
      ))}
    </div>
  );
}

// ── Rich text toolbar ─────────────────────────────────────────────────────────

type DrawColor = 'black' | 'red' | 'blue' | 'green' | 'eraser';

const DRAW_COLORS: { key: DrawColor; label: string; hex: string }[] = [
  { key: 'black', label: 'Black', hex: '#1a1a1a' },
  { key: 'red', label: 'Red', hex: '#ef4444' },
  { key: 'blue', label: 'Blue', hex: '#3b82f6' },
  { key: 'green', label: 'Green', hex: '#22c55e' },
  { key: 'eraser', label: 'Eraser', hex: '#ffffff' },
];

function RichToolbar({ onFormat }: { onFormat: (cmd: string, val?: string) => void }) {
  const btn = (label: string, cmd: string, val?: string, title?: string) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onFormat(cmd, val); }}
      className="rounded px-1.5 py-0.5 text-[11px] font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
      title={title ?? label}
    >
      {label}
    </button>
  );
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {btn('H1', 'formatBlock', '<h1>', 'Heading 1')}
      {btn('H2', 'formatBlock', '<h2>', 'Heading 2')}
      {btn('H3', 'formatBlock', '<h3>', 'Heading 3')}
      <div className="w-px h-4 bg-border-subtle mx-1" />
      {btn('B', 'bold', undefined, 'Bold')}
      {btn('I', 'italic', undefined, 'Italic')}
      {btn('U', 'underline', undefined, 'Underline')}
      <div className="w-px h-4 bg-border-subtle mx-1" />
      {btn('• List', 'insertUnorderedList', undefined, 'Bulleted list')}
      {btn('1. List', 'insertOrderedList', undefined, 'Numbered list')}
      {btn('—', 'insertHorizontalRule', undefined, 'Horizontal rule')}
    </div>
  );
}

// ── Drawing canvas ────────────────────────────────────────────────────────────

interface DrawingCanvasProps {
  initialData?: string;
  onSave: (data: string) => void;
  onExit: () => void;
}

function DrawingCanvas({ initialData, onSave, onExit }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawColor, setDrawColor] = useState<DrawColor>('black');
  const isDrawing = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    if (initialData) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = initialData;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) onSave(canvas.toDataURL('image/png'));
    }, 800);
  }, [onSave]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    canvasRef.current?.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const color = DRAW_COLORS.find((c) => c.key === drawColor)!;
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    ctx.lineWidth = drawColor === 'eraser' ? 24 : pressure * 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color.hex;
    ctx.globalCompositeOperation = drawColor === 'eraser' ? 'destination-out' : 'source-over';
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePointerUp = () => {
    isDrawing.current = false;
    scheduleSave();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    onSave('');
  };

  return (
    <div className="absolute inset-0 z-10 flex flex-col">
      {/* Draw toolbar */}
      <div className="flex items-center gap-2 shrink-0 bg-bg-raised/95 backdrop-blur border-b border-border-subtle px-3 py-1.5">
        <span className="text-[11px] font-semibold text-text-muted">Draw mode</span>
        <div className="flex items-center gap-1">
          {DRAW_COLORS.map(({ key, hex, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setDrawColor(key)}
              title={label}
              className={cn(
                'h-5 w-5 rounded-full border-2 transition-transform',
                drawColor === key ? 'scale-125 border-text-primary' : 'border-transparent hover:scale-110',
                key === 'eraser' && 'border-border-subtle bg-bg-surface',
              )}
              style={key !== 'eraser' ? { backgroundColor: hex } : undefined}
            >
              {key === 'eraser' && <span className="text-[9px] text-text-muted">✕</span>}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={clearCanvas}
          className="ml-2 rounded px-2 py-0.5 text-[10px] text-text-muted hover:bg-red-500/10 hover:text-red-400 transition-colors"
        >
          Clear drawing
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          <X size={11} /> Exit draw
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="flex-1 w-full cursor-crosshair"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  );
}

// ── Page editor ───────────────────────────────────────────────────────────────

interface PageEditorProps {
  page: JournalPage;
  onUpdate: (updates: Partial<JournalPage>) => void;
  onDelete: () => void;
  onTear: () => void;
  onImportMeeting: () => void;
  folders: Folder[];
}

function PageEditor({ page, onUpdate, onDelete, onTear, onImportMeeting }: PageEditorProps) {
  const [title, setTitle] = useState(page.title);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastPageId = useRef<string>('');

  // Sync content into contenteditable when page changes (but not on every keystroke)
  useEffect(() => {
    if (lastPageId.current !== page.id) {
      lastPageId.current = page.id;
      setTitle(page.title);
      if (editorRef.current) {
        editorRef.current.innerHTML = page.content || '';
      }
    }
  }, [page.id, page.content, page.title]);

  const scheduleContentSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (editorRef.current) {
        onUpdate({ content: editorRef.current.innerHTML });
      }
    }, 600);
  }, [onUpdate]);

  const handleFormat = useCallback((cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    scheduleContentSave();
  }, [scheduleContentSave]);

  const handleTitleBlur = useCallback(() => {
    if (title !== page.title) onUpdate({ title });
  }, [title, page.title, onUpdate]);

  const themeClasses = getThemeClasses(page.theme);

  return (
    <div className="flex flex-col h-full">
      {/* Top toolbar */}
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2 shrink-0 bg-bg-raised flex-wrap">
        <div className="relative">
          <button
            onClick={() => setShowThemePicker(!showThemePicker)}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-text-muted hover:bg-bg-hover hover:text-text-primary"
            title="Change page theme"
          >
            <Palette size={13} />
            <span>{JOURNAL_THEME_LABELS[page.theme]}</span>
          </button>
          {showThemePicker && (
            <ThemePicker
              current={page.theme}
              onChange={(t) => onUpdate({ theme: t })}
              onClose={() => setShowThemePicker(false)}
            />
          )}
        </div>
        <div className="w-px h-4 bg-border-subtle" />
        <RichToolbar onFormat={handleFormat} />
        <div className="flex-1" />
        <button
          onClick={() => setDrawMode((v) => !v)}
          className={cn(
            'flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors',
            drawMode ? 'bg-accent text-white' : 'text-text-muted hover:bg-bg-hover hover:text-text-primary',
          )}
          title="Toggle drawing mode"
        >
          <Pencil size={12} />
          Draw
        </button>
        <button
          onClick={onImportMeeting}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-text-muted hover:bg-bg-hover hover:text-text-primary"
          title="Import meeting notes into this page"
        >
          <Upload size={12} />
          Import
        </button>
        <button
          onClick={onTear}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-accent bg-accent/10 hover:bg-accent/20 transition-colors"
          title="Send this page to an investigation"
        >
          <Send size={12} />
          Tear to investigation
        </button>
        <button
          onClick={onDelete}
          className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-red-500/10 hover:text-red-400"
          title="Delete page"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Page surface */}
      <div className={cn('flex-1 overflow-auto relative', themeClasses)}>
        <div className="mx-auto max-w-3xl px-8 py-6 relative">
          {/* Linked badge */}
          {page.linkedInvestigationId && (
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs text-accent">
              <Send size={10} />
              Sent to investigation
            </div>
          )}
          {/* Title */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="Page title…"
            className="mb-4 w-full bg-transparent text-2xl font-bold text-inherit placeholder-gray-400 outline-none"
          />
          {/* Rich text content */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={scheduleContentSave}
            data-placeholder="Start writing…"
            className="min-h-[60vh] w-full bg-transparent text-sm leading-7 text-inherit outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 empty:before:pointer-events-none"
          />
          {/* Drawing canvas overlay */}
          {drawMode && (
            <DrawingCanvas
              initialData={page.drawingData}
              onSave={(data) => onUpdate({ drawingData: data || undefined })}
              onExit={() => setDrawMode(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page list ─────────────────────────────────────────────────────────────────

interface PageListProps {
  pages: JournalPage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewPage: () => void;
  onNewJournal: () => void;
}

function PageList({ pages, selectedId, onSelect, onNewPage, onNewJournal }: PageListProps) {
  return (
    <div className="flex h-full w-56 shrink-0 flex-col border-r border-border-subtle bg-bg-raised">
      <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Pages</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onNewJournal}
            title="New journal entry (today's date)"
            className="flex h-5 w-5 items-center justify-center rounded text-text-muted hover:bg-bg-hover hover:text-text-primary"
          >
            <BookOpen size={12} />
          </button>
          <button
            onClick={onNewPage}
            title="New blank page"
            className="flex h-5 w-5 items-center justify-center rounded text-text-muted hover:bg-bg-hover hover:text-text-primary"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {pages.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-text-muted">
            No pages yet. Create one with +.
          </div>
        )}
        {pages.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={cn(
              'flex w-full flex-col items-start px-3 py-2.5 text-left transition-colors hover:bg-bg-hover',
              selectedId === p.id && 'bg-accent/10 text-accent',
            )}
          >
            <span className={cn('truncate text-sm font-medium', selectedId === p.id ? 'text-accent' : 'text-text-primary')}>
              {p.title || 'Untitled'}
            </span>
            <span className="mt-0.5 text-[10px] text-text-muted">
              {new Date(p.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              {p.linkedInvestigationId && (
                <span className="ml-1 text-accent/70">· linked</span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Meeting import modal (lightweight inline version) ─────────────────────────

interface MeetingPasteModalProps {
  onClose: () => void;
  onImport: (content: string) => void;
}

function MeetingPasteModal({ onClose, onImport }: MeetingPasteModalProps) {
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => { const raw = ev.target?.result as string; onImport(raw); onClose(); };
    reader.readAsText(f);
  }, [onImport, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-xl border border-border-medium bg-bg-raised shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <span className="text-sm font-semibold text-text-primary">Import meeting notes</span>
        </div>
        <div className="p-4 space-y-3">
          {window.threatcaddyNotes ? (
            <button
              onClick={async () => {
                const r = await window.threatcaddyNotes!.pickFile();
                if (r.ok && r.content) { onImport(r.content); onClose(); }
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border-medium bg-bg-surface px-4 py-5 text-sm text-text-secondary hover:border-accent/40 hover:text-accent"
            >
              <Upload size={16} /> Pick .txt / .vtt / .md file
            </button>
          ) : (
            <>
              <button onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border-medium bg-bg-surface px-4 py-5 text-sm text-text-secondary hover:border-accent/40 hover:text-accent">
                <Upload size={16} /> Pick .txt / .vtt / .md file
              </button>
              <input ref={fileRef} type="file" accept=".txt,.vtt,.md" className="hidden" onChange={handleFile} />
            </>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Or paste meeting text here…"
            rows={5}
            className="w-full resize-none rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/40"
          />
          {text.trim() && (
            <button onClick={() => { onImport(text); onClose(); }} className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90">
              Import
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main JournalView ──────────────────────────────────────────────────────────

interface JournalViewProps {
  folders: Folder[];
  onTearToInvestigation: (pageContent: string, pageTitle: string, investigationId: string) => Promise<void>;
}

export function JournalView({ folders, onTearToInvestigation }: JournalViewProps) {
  const { pages, loading, createPage, updatePage, deletePage, linkToInvestigation } = useJournalPages();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tearingPage, setTearingPage] = useState<JournalPage | null>(null);
  const [showMeetingModal, setShowMeetingModal] = useState(false);

  const selectedPage = useMemo(() => pages.find((p) => p.id === selectedId) ?? null, [pages, selectedId]);

  // Auto-select first page when pages load
  useEffect(() => {
    if (!loading && pages.length > 0 && !selectedId) setSelectedId(pages[0].id);
  }, [loading, pages, selectedId]);

  const handleNewPage = useCallback(async () => {
    const p = await createPage();
    setSelectedId(p.id);
  }, [createPage]);

  const handleNewJournal = useCallback(async () => {
    const date = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const p = await createPage({ title: date, content: `# ${date}\n\n`, theme: 'lined' });
    setSelectedId(p.id);
  }, [createPage]);

  const handleDelete = useCallback(async () => {
    if (!selectedId) return;
    await deletePage(selectedId);
    setSelectedId(null);
  }, [selectedId, deletePage]);

  const handleTear = useCallback(async (investigationId: string) => {
    if (!tearingPage) return;
    await onTearToInvestigation(tearingPage.content, tearingPage.title, investigationId);
    await linkToInvestigation(tearingPage.id, investigationId);
    setTearingPage(null);
  }, [tearingPage, onTearToInvestigation, linkToInvestigation]);

  const handleMeetingImport = useCallback((raw: string) => {
    if (!selectedPage) return;
    updatePage(selectedPage.id, { content: (selectedPage.content ? selectedPage.content + '\n\n---\n\n' : '') + raw });
  }, [selectedPage, updatePage]);

  if (loading) {
    return <div className="flex h-full items-center justify-center text-text-muted text-sm">Loading journal…</div>;
  }

  return (
    <div className="flex h-full overflow-hidden">
      <PageList
        pages={pages}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNewPage={handleNewPage}
        onNewJournal={handleNewJournal}
      />

      <div className="flex-1 min-w-0 overflow-hidden">
        {selectedPage ? (
          <PageEditor
            page={selectedPage}
            onUpdate={(updates) => updatePage(selectedPage.id, updates)}
            onDelete={handleDelete}
            onTear={() => setTearingPage(selectedPage)}
            onImportMeeting={() => setShowMeetingModal(true)}
            folders={folders}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-text-muted">
            <BookOpen size={40} className="opacity-30" />
            <p className="text-sm">No page selected</p>
            <button
              onClick={handleNewPage}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/25"
            >
              <Plus size={13} />
              New page
            </button>
          </div>
        )}
      </div>

      {tearingPage && (
        <TearModal
          page={tearingPage}
          folders={folders}
          onTear={handleTear}
          onClose={() => setTearingPage(null)}
        />
      )}

      {showMeetingModal && (
        <MeetingPasteModal
          onClose={() => setShowMeetingModal(false)}
          onImport={handleMeetingImport}
        />
      )}
    </div>
  );
}
