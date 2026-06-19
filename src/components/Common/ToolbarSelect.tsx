import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ToolbarSelectOption<T extends string> {
  value: T;
  label: string;
}

interface ToolbarSelectProps<T extends string> {
  value: T;
  options: Array<ToolbarSelectOption<T>>;
  onChange: (value: T) => void;
  ariaLabel: string;
  title?: string;
  leadingIcon?: ReactNode;
  className?: string;
  buttonClassName?: string;
  listboxClassName?: string;
  buttonDataProps?: Record<`data-${string}`, string | number | boolean | undefined>;
}

export function ToolbarSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  title,
  leadingIcon,
  className,
  buttonClassName,
  listboxClassName,
  buttonDataProps,
}: ToolbarSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [popupRect, setPopupRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const listboxRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const updatePopupRect = useCallback(() => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPopupRect({
      left: rect.left,
      top: rect.bottom + 4,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePopupRect();

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!wrapperRef.current?.contains(target) && !listboxRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', updatePopupRect);
    window.addEventListener('scroll', updatePopupRect, true);
    return () => {
      window.removeEventListener('mousedown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', updatePopupRect);
      window.removeEventListener('scroll', updatePopupRect, true);
    };
  }, [open, updatePopupRect]);

  const handleComboboxKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(true);
    }

    if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <button
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        title={title}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleComboboxKeyDown}
        className={cn(
          'flex h-8 w-full items-center justify-between gap-2 rounded-[10px] border border-border-subtle bg-bg-primary/80 px-2.5 text-left text-[11px] font-medium text-text-primary outline-none transition-colors hover:border-border-medium hover:bg-bg-hover focus:border-accent/50',
          buttonClassName,
        )}
        data-toolbar-select-control="true"
        {...buttonDataProps}
      >
        {leadingIcon}
        <span className="min-w-0 flex-1 truncate">{selectedOption?.label}</span>
        <ChevronDown size={13} className={cn('shrink-0 text-accent transition-transform', open && 'rotate-180')} />
      </button>

      {open && popupRect && typeof document !== 'undefined' && createPortal(
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label={`${ariaLabel} options`}
          style={{
            left: popupRect.left,
            top: popupRect.top,
            minWidth: popupRect.width,
          }}
          className={cn(
            'fixed z-[260] overflow-hidden rounded-[10px] border border-border-medium bg-bg-raised/98 p-1 text-[11px] shadow-[8px_12px_24px_rgba(0,0,0,0.32)] backdrop-blur-xl',
            listboxClassName,
          )}
          data-toolbar-select-listbox="true"
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                data-toolbar-select-option="true"
                data-toolbar-select-option-active={selected ? 'true' : undefined}
                className={cn(
                  'relative flex min-h-8 w-full items-center rounded-[8px] px-3 py-1.5 text-left transition-colors',
                  selected
                    ? 'bg-bg-active text-text-primary shadow-[0_10px_22px_rgba(0,0,0,0.16)]'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                )}
              >
                {selected && (
                  <>
                    <span
                      className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-purple"
                      style={{ boxShadow: '0 0 8px 1px var(--color-purple)' }}
                    />
                    <span className="mr-2 h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
                  </>
                )}
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
