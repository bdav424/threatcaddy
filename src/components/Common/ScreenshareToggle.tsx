import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { MonitorOff, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ScreenshareToggleProps {
  maxLevel: string | null;
  onChangeLevel: (level: string | null) => void;
  effectiveLevels: string[];
}

const SCREENSHARE_OPTIONS = [
  {
    id: 'clear',
    label: 'Clear',
    sublabel: 'Show everything',
    level: null,
    badge: null,
    btnClass: 'text-gray-400 hover:bg-gray-700/60',
  },
  {
    id: 'green',
    label: 'Green',
    sublabel: 'Hide Amber & Red',
    level: 'TLP:GREEN',
    badge: 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/40',
    btnClass: 'text-green-400 hover:bg-green-500/10',
  },
  {
    id: 'amber',
    label: 'Yellow',
    sublabel: 'Hide Red only',
    level: 'TLP:AMBER',
    badge: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40',
    btnClass: 'text-amber-400 hover:bg-amber-500/10',
  },
] as const;

export function ScreenshareToggle({ maxLevel, onChangeLevel }: ScreenshareToggleProps) {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        (!dropdownRef.current || !dropdownRef.current.contains(e.target as Node))
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !ref.current) { setDropdownPos(null); return; }
    const rect = ref.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  }, [open]);

  const active = maxLevel !== null;
  const activeOption = SCREENSHARE_OPTIONS.find((o) => o.level === maxLevel);

  const dropdown = open && dropdownPos ? createPortal(
    <div
      ref={dropdownRef}
      style={{ top: dropdownPos.top, right: dropdownPos.right }}
      className="fixed w-52 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-[260] overflow-hidden"
    >
      {SCREENSHARE_OPTIONS.map((option, i) => {
        const selected = maxLevel === option.level;
        return (
          <button
            key={option.id}
            onClick={() => { onChangeLevel(option.level); setOpen(false); }}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors',
              i === 0 ? 'rounded-t-lg' : i === SCREENSHARE_OPTIONS.length - 1 ? 'rounded-b-lg' : '',
              selected ? 'bg-gray-700' : 'hover:bg-gray-700/60',
              option.btnClass,
            )}
          >
            <span className="w-3 shrink-0 flex items-center justify-center">
              {selected && <Check size={11} />}
            </span>
            <span className="flex-1 text-left">
              <span className="font-medium">{option.label}</span>
              <span className="ml-1.5 text-gray-500 text-[10px]">{option.sublabel}</span>
            </span>
          </button>
        );
      })}
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative" ref={ref} data-tour="screenshare">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'p-1.5 sm:p-2 rounded-lg transition-colors',
            active
              ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800',
          )}
          title={active ? `Screenshare: ${maxLevel}` : 'Screenshare mode'}
          aria-label="Toggle screenshare mode"
        >
          <MonitorOff size={16} />
        </button>
        {active && activeOption?.badge && (
          <span className={cn(
            'hidden sm:inline text-[10px] font-semibold border rounded-full px-2 py-0.5',
            activeOption.badge,
          )}>
            {activeOption.label}
          </span>
        )}
      </div>
      {dropdown}
    </div>
  );
}
