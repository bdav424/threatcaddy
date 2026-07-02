import { useState, useCallback, useRef, useEffect, useMemo, type PointerEvent as ReactPointerEvent, type CSSProperties } from 'react';
import { BookOpen, Plus, Trash2, Send, Palette, Upload, Pencil, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useJournalPages } from '../../hooks/useJournalPages';
import type { JournalPage, JournalPageTheme, JournalPaperStyle, Folder } from '../../types';
import { cn } from '../../lib/utils';

// ── Legacy theme CSS (backwards compat for old pages without paperColor) ──────

function getLegacyThemeClasses(theme: JournalPageTheme): string {
  switch (theme) {
    case 'paper': return 'bg-[#faf8f3] text-[#2c2c2c]';
    case 'lined': return 'bg-white lined-page';
    case 'bullet': return 'bg-white bullet-page';
    case 'grid': return 'bg-white grid-page';
    case 'cream': return 'bg-[#fffdf5] text-[#2c2c2c]';
    case 'blue-gray': return 'bg-[#f0f4f8] text-[#1e2a3a]';
    case 'sage': return 'bg-[#f2f5f0] text-[#2a3328]';
    case 'watermark': return 'bg-white watermark-page';
    default: return '';
  }
}

// ── Paper style → inline CSS background ──────────────────────────────────────

function getPaperPatternStyle(paperStyle: JournalPaperStyle, paperColor: string | 'theme'): CSSProperties {
  const bg = paperColor === 'theme' ? 'var(--color-bg-surface)' : paperColor;
  // Theme-aware line color: use the CSS variable so it adapts to dark/light mode.
  // For fixed paper colors, use a subtle dark tint.
  const lineColor = paperColor === 'theme' ? 'var(--color-border-medium)' : 'rgba(0,0,0,0.15)';

  switch (paperStyle) {
    case 'lined':
      return {
        backgroundColor: bg,
        backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent 27px, ${lineColor} 27px, ${lineColor} 28px)`,
        backgroundSize: '100% 28px',
      };
    case 'dot':
      return {
        backgroundColor: bg,
        backgroundImage: `radial-gradient(circle, ${lineColor} 1.2px, transparent 1.2px)`,
        backgroundSize: '20px 20px',
      };
    case 'grid':
      return {
        backgroundColor: bg,
        backgroundImage: [
          `linear-gradient(to right, ${lineColor} 1px, transparent 1px)`,
          `linear-gradient(to bottom, ${lineColor} 1px, transparent 1px)`,
        ].join(', '),
        backgroundSize: '20px 20px',
      };
    case 'blank':
    default:
      return { backgroundColor: bg };
  }
}

// ── Color-wheel helpers (self-contained, no dep on AppearanceSettings) ────────

type HslColor = { h: number; s: number; l: number };

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

function hexToHsl(hex: string): HslColor {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex({ h, s, l }: HslColor): string {
  const sl = s / 100;
  const ll = l / 100;
  const a = sl * Math.min(ll, 1 - ll);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hslToWheelPoint(color: HslColor) {
  const angle = (color.h * Math.PI) / 180;
  const radius = clamp((100 - color.l) / 100, 0, 1) * 50;
  return { x: 50 + Math.sin(angle) * radius, y: 50 - Math.cos(angle) * radius };
}

function pointerToWheelHsl(event: ReactPointerEvent<HTMLElement>): { hsl: HslColor; point: { x: number; y: number } } {
  const rect = event.currentTarget.getBoundingClientRect();
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  const radius = Math.max(1, Math.min(rect.width, rect.height) / 2);
  const raw = Math.sqrt(dx * dx + dy * dy);
  const dist = clamp(raw / radius, 0, 1);
  const ux = raw === 0 ? 0 : dx / raw;
  const uy = raw === 0 ? 0 : dy / raw;
  const h = Math.round((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  return {
    hsl: { h, s: clamp(Math.round(dist * 160), 0, 100), l: clamp(Math.round(100 - dist * 100), 0, 100) },
    point: { x: 50 + ux * dist * 50, y: 50 + uy * dist * 50 },
  };
}

const COLOR_WHEEL_BG = 'radial-gradient(circle, #ffffff 0%, rgba(255,255,255,0.88) 17%, rgba(255,255,255,0) 43%, rgba(0,0,0,0.15) 62%, rgba(0,0,0,0.92) 100%), conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)';

// ── Preset swatches ───────────────────────────────────────────────────────────

const PAPER_SWATCHES: { label: string; value: string | 'theme' }[] = [
  { label: 'Theme',      value: 'theme' },
  { label: 'White',      value: '#ffffff' },
  { label: 'Cream',      value: '#fffdf5' },
  { label: 'Warm ivory', value: '#faf8f3' },
  { label: 'Light gray', value: '#f3f4f6' },
  { label: 'Cool gray',  value: '#f0f4f8' },
  { label: 'Sage',       value: '#f2f5f0' },
  { label: 'Warm tan',   value: '#f5efe6' },
  { label: 'Mid gray',   value: '#9ca3af' },
  { label: 'Near-black', value: '#1e1e1e' },
];

// ── Paper style options ───────────────────────────────────────────────────────

const PAPER_STYLES: { key: JournalPaperStyle; label: string }[] = [
  { key: 'blank',  label: 'Blank' },
  { key: 'lined',  label: 'Lined' },
  { key: 'dot',    label: 'Dot' },
  { key: 'grid',   label: 'Grid' },
];

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

// ── Background picker ─────────────────────────────────────────────────────────

interface BackgroundPickerProps {
  paperColor: string | 'theme';
  paperStyle: JournalPaperStyle;
  onChangePaperColor: (color: string | 'theme') => void;
  onChangePaperStyle: (style: JournalPaperStyle) => void;
  onClose: () => void;
}

function BackgroundPicker({ paperColor, paperStyle, onChangePaperColor, onChangePaperStyle, onClose }: BackgroundPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const wheelPtrRef = useRef<number | null>(null);

  const [hexInput, setHexInput] = useState<string>(paperColor === 'theme' ? '' : paperColor);
  const [wheelPt, setWheelPt] = useState(() =>
    paperColor !== 'theme' ? hslToWheelPoint(hexToHsl(paperColor)) : { x: 50, y: 50 },
  );

  useEffect(() => {
    if (paperColor !== 'theme') {
      setHexInput(paperColor);
      setWheelPt(hslToWheelPoint(hexToHsl(paperColor)));
    }
  }, [paperColor]);

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  const applyHex = useCallback((hex: string) => {
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      onChangePaperColor(hex);
      setWheelPt(hslToWheelPoint(hexToHsl(hex)));
    }
  }, [onChangePaperColor]);

  const handleWheelPointer = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (wheelPtrRef.current !== null && e.pointerId !== wheelPtrRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    wheelPtrRef.current = e.pointerId;
    const { hsl, point } = pointerToWheelHsl(e);
    const hex = hslToHex(hsl);
    setWheelPt(point);
    setHexInput(hex);
    onChangePaperColor(hex);
  }, [onChangePaperColor]);

  const releaseWheel = useCallback(() => { wheelPtrRef.current = null; }, []);

  const hsl = paperColor !== 'theme' ? hexToHsl(paperColor) : { h: 0, s: 0, l: 100 };

  // Small preview tiles for each paper style
  const styleTileStyle = (key: JournalPaperStyle): CSSProperties => {
    const base = '#ffffff';
    const line = 'rgba(0,0,0,0.18)';
    switch (key) {
      case 'lined': return {
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent 8px, ${line} 8px, ${line} 9px)`,
        backgroundSize: '100% 9px',
        backgroundColor: base,
      };
      case 'dot': return {
        backgroundImage: `radial-gradient(circle, ${line} 1px, transparent 1px)`,
        backgroundSize: '6px 6px',
        backgroundColor: base,
      };
      case 'grid': return {
        backgroundImage: `linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`,
        backgroundSize: '6px 6px',
        backgroundColor: base,
      };
      default: return { backgroundColor: base };
    }
  };

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-border-medium bg-bg-raised shadow-xl"
    >
      {/* ── Paper style ── */}
      <div className="border-b border-border-subtle px-3 py-2.5">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Paper style</p>
        <div className="grid grid-cols-4 gap-1.5">
          {PAPER_STYLES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onChangePaperStyle(key)}
              title={label}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-all',
                paperStyle === key
                  ? 'border-accent bg-accent/10'
                  : 'border-border-subtle hover:border-border-medium hover:bg-bg-hover',
              )}
            >
              <div
                className="h-10 w-full rounded border border-border-subtle overflow-hidden"
                style={styleTileStyle(key)}
              />
              <span className={cn('text-[9px] font-medium', paperStyle === key ? 'text-accent' : 'text-text-muted')}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Background color ── */}
      <div className="px-3 py-2.5">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Background color</p>

        {/* Preset swatches */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PAPER_SWATCHES.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => {
                onChangePaperColor(value);
                if (value !== 'theme') {
                  setHexInput(value);
                  setWheelPt(hslToWheelPoint(hexToHsl(value)));
                }
              }}
              title={label}
              className={cn(
                'relative flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all',
                paperColor === value
                  ? 'border-accent scale-110 shadow-md'
                  : 'border-transparent hover:border-border-medium hover:scale-105',
              )}
              style={
                value === 'theme'
                  ? { background: 'linear-gradient(135deg, var(--color-bg-surface) 50%, var(--color-bg-raised) 50%)' }
                  : { backgroundColor: value }
              }
            >
              {value === 'theme' && (
                <span className="text-[8px] font-bold leading-none text-text-muted select-none">T</span>
              )}
              {paperColor === value && value !== 'theme' && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="h-2 w-2 rounded-full bg-white/80 shadow" />
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Color wheel */}
        <div className="flex justify-center">
          <div
            className="relative h-40 w-40 touch-none rounded-full border border-white/20 shadow-inner cursor-crosshair"
            style={{ background: COLOR_WHEEL_BG }}
            onPointerDown={handleWheelPointer}
            onPointerMove={(e) => { if (wheelPtrRef.current !== null) handleWheelPointer(e); }}
            onPointerUp={releaseWheel}
            onPointerCancel={releaseWheel}
            role="application"
            aria-label="Color wheel"
          >
            {/* Selector dot */}
            <span
              className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.55)]"
              style={{
                left: `${wheelPt.x}%`,
                top: `${wheelPt.y}%`,
                backgroundColor: paperColor !== 'theme' ? paperColor : '#ffffff',
              }}
            />
          </div>
        </div>

        {/* HSL sliders */}
        <div className="mt-2.5 space-y-1.5">
          {(['h', 's', 'l'] as const).map((ch) => {
            const labels = { h: 'Hue', s: 'Saturation', l: 'Lightness' };
            const maxes = { h: 359, s: 100, l: 100 };
            return (
              <label key={ch} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[9px] text-text-muted">{labels[ch]}</span>
                <input
                  type="range"
                  min={0}
                  max={maxes[ch]}
                  value={hsl[ch]}
                  onChange={(e) => {
                    const updated = { ...hsl, [ch]: Number(e.target.value) };
                    const hex = hslToHex(updated);
                    setHexInput(hex);
                    setWheelPt(hslToWheelPoint(updated));
                    onChangePaperColor(hex);
                  }}
                  className="flex-1 accent-accent"
                />
                <span className="w-6 text-right text-[9px] text-text-muted">{hsl[ch]}</span>
              </label>
            );
          })}
        </div>

        {/* Hex input + reset */}
        <div className="mt-2 flex items-center gap-2">
          <div
            className="h-6 w-6 shrink-0 rounded border border-border-subtle"
            style={{ backgroundColor: paperColor !== 'theme' ? paperColor : 'var(--color-bg-surface)' }}
          />
          <input
            value={hexInput}
            placeholder="#ffffff"
            onChange={(e) => {
              setHexInput(e.target.value);
              applyHex(e.target.value);
            }}
            className="flex-1 rounded border border-border-subtle bg-bg-surface px-2 py-1 font-mono text-[11px] text-text-primary focus:border-accent/40 focus:outline-none"
          />
          <button
            onClick={() => { onChangePaperColor('theme'); setHexInput(''); }}
            className="rounded px-2 py-1 text-[9px] text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors"
            title="Reset to theme default"
          >
            Reset
          </button>
        </div>
      </div>
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
          onClick={() => {
            clearTimeout(saveTimer.current);
            const canvas = canvasRef.current;
            if (canvas) onSave(canvas.toDataURL('image/png'));
            onExit();
          }}
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
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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

  // Resolve effective paper color + style, with backwards-compat for old theme-only pages
  const paperColor = page.paperColor ?? 'theme';
  const paperStyle = page.paperStyle ?? 'blank';
  const usingNewStyle = page.paperColor !== undefined;
  const legacyClasses = usingNewStyle ? '' : getLegacyThemeClasses(page.theme);
  const paperSurfaceStyle = usingNewStyle ? getPaperPatternStyle(paperStyle, paperColor) : {};

  return (
    <div className="flex flex-col h-full">
      {/* Top toolbar */}
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2 shrink-0 bg-bg-raised flex-wrap">
        <div className="relative">
          <button
            onClick={() => setShowBgPicker((v) => !v)}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-text-muted hover:bg-bg-hover hover:text-text-primary"
            title="Change page background"
          >
            <Palette size={13} />
            <span
              className="h-3 w-3 rounded-full border border-border-subtle inline-block ml-0.5"
              style={
                paperColor === 'theme'
                  ? { background: 'linear-gradient(135deg, var(--color-bg-surface) 50%, var(--color-bg-raised) 50%)' }
                  : { backgroundColor: paperColor }
              }
            />
          </button>
          {showBgPicker && (
            <BackgroundPicker
              paperColor={paperColor}
              paperStyle={paperStyle}
              onChangePaperColor={(c) => onUpdate({ paperColor: c })}
              onChangePaperStyle={(s) => onUpdate({ paperStyle: s })}
              onClose={() => setShowBgPicker(false)}
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
          onClick={() => setConfirmDelete(true)}
          className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-red-500/10 hover:text-red-400"
          title="Delete page"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xs rounded-xl border border-border-medium bg-bg-raised shadow-2xl">
            <div className="px-4 py-3 border-b border-border-subtle">
              <span className="text-sm font-semibold text-text-primary">Delete page?</span>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-xs text-text-muted">
                <strong className="text-text-primary">"{page.title || 'Untitled'}"</strong> will be permanently deleted.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setConfirmDelete(false); onDelete(); }}
                  className="flex-1 rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page surface — background color + paper pattern */}
      <div className={cn('flex-1 overflow-auto relative', legacyClasses)} style={paperSurfaceStyle}>
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
            className="min-h-[60vh] w-full bg-transparent text-sm leading-7 text-inherit outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 empty:before:pointer-events-none [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2 [&_li]:my-0.5 [&_ul_ul]:list-[circle] [&_ul_ul_ul]:list-[square]"
          />
          {/* Read-only drawing overlay — always visible when drawing data exists */}
          {page.drawingData && !drawMode && (
            <img
              src={page.drawingData}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full"
              style={{ objectFit: 'fill' }}
            />
          )}
          {/* Interactive drawing canvas overlay — only in draw mode */}
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
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('journal-list-collapsed') === 'true'; } catch { return false; }
  });

  const toggleCollapse = () => {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem('journal-list-collapsed', String(next)); } catch {}
      return next;
    });
  };

  if (collapsed) {
    return (
      <div className="flex h-full w-8 shrink-0 flex-col border-r border-border-subtle bg-bg-raised items-center gap-1 pt-2">
        <button
          onClick={toggleCollapse}
          title="Expand pages list"
          className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-bg-hover hover:text-text-primary"
        >
          <ChevronRight size={14} />
        </button>
        <button
          onClick={onNewPage}
          title="New blank page"
          className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-bg-hover hover:text-text-primary"
        >
          <Plus size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-56 shrink-0 flex-col border-r border-border-subtle bg-bg-raised">
      <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Pages</span>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleCollapse}
            title="Collapse pages list"
            className="flex h-5 w-5 items-center justify-center rounded text-text-muted hover:bg-bg-hover hover:text-text-primary"
          >
            <ChevronLeft size={12} />
          </button>
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
