import { useCallback, useState } from 'react';
import { StickyNote } from 'lucide-react';

interface StickyJotFabProps {
  onCreate: () => void;
}

export function StickyJotFab({ onCreate }: StickyJotFabProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = offset.x;
    const origY = offset.y;
    let moved = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      setOffset({ x: origX + dx, y: origY + dy });
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (!moved) onCreate();
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [offset, onCreate]);

  return (
    <button
      type="button"
      onMouseDown={handleMouseDown}
      title="New Sticky Jot"
      aria-label="New Sticky Jot"
      className="absolute z-40 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-text-primary shadow-md backdrop-blur-sm transition-colors hover:bg-white/30 dark:bg-black/30 dark:hover:bg-black/40"
      style={{ bottom: 24 - offset.y, right: 24 - offset.x }}
      data-sticky-jot-fab="true"
    >
      <StickyNote size={18} />
    </button>
  );
}
