interface SortableEvent {
  start: string;
  end: string;
  allDay: boolean;
  title?: string;
}

function parseMs(dateStr: string): number {
  const t = new Date(dateStr).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

export function sortEvents<T extends SortableEvent>(events: T[]): T[] {
  return [...events].sort((left, right) => {
    const s = parseMs(left.start) - parseMs(right.start);
    if (s !== 0) return s;
    if (left.allDay !== right.allDay) return left.allDay ? -1 : 1;
    const e = parseMs(left.end) - parseMs(right.end);
    if (e !== 0) return e;
    return (left.title ?? '').localeCompare(right.title ?? '');
  });
}
