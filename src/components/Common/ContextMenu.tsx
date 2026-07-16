import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';

export interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
}

export type ContextMenuEntry = ContextMenuItem | 'separator';

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuEntry[];
  onClose: () => void;
}

// Generic right-click menu, portaled to body and positioned at the cursor.
// Renders once invisibly to measure its own size, then reveals at a position
// clamped to the viewport — right-clicking near an edge must not open a menu
// that's partly cut off. This is the one reusable primitive; adopt it instead
// of bespoke per-component 3-dot menus (see InvestigationCard for the
// pre-existing bespoke pattern this is meant to replace over time).
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: y, left: x });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - rect.width - 8);
    const top = Math.min(y, window.innerHeight - rect.height - 8);
    setPos({ left: Math.max(8, left), top: Math.max(8, top) });
    setReady(true);
  }, [x, y]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="fixed z-[9999] min-w-[160px] rounded-xl border border-border-medium bg-bg-raised py-1 shadow-xl"
      style={{ top: pos.top, left: pos.left, visibility: ready ? 'visible' : 'hidden' }}
    >
      {items.map((item, i) => (
        item === 'separator' ? (
          <div key={`separator-${i}`} className="my-1 border-t border-border-subtle" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            onClick={() => { item.onClick(); onClose(); }}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
              item.danger
                ? 'text-red-400 hover:bg-red-500/10'
                : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
            )}
          >
            {item.icon}
            {item.label}
          </button>
        )
      ))}
    </div>,
    document.body,
  );
}
