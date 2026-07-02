import { useState, useCallback, useRef, useEffect, useMemo, type PointerEvent as ReactPointerEvent, type CSSProperties } from 'react';
import { BookOpen, Plus, Trash2, Send, Palette, Upload, Pencil, X } from 'lucide-react';
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
  // Subtle 15% dark tint for lines/dots — works on any background color.
  const lineColor = 'rgba(0,0,0,0.15)';

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
      className="absolute left-0 top-full z-40 mt-1 w-72 rounded-xl border border-border-medium bg-bg-raised shadow-xl"
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
      