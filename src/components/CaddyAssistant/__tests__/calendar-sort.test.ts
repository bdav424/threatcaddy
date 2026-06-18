import { describe, it, expect } from 'vitest';
import { sortEvents } from '../calendar-utils';

const ev = (id: string, start: string, end = start, allDay = false) =>
  ({ id, title: id, start, end, allDay });

describe('sortEvents', () => {
  it('orders by start time, including within the same hour', () => {
    const out = sortEvents([
      ev('b', '2026-06-18T09:45:00Z'),
      ev('a', '2026-06-18T09:10:00Z'),
      ev('c', '2026-06-18T11:00:00Z'),
    ]);
    expect(out.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });
  it('puts unparseable dates last instead of scrambling', () => {
    const out = sortEvents([ev('bad', 'not-a-date'), ev('good', '2026-06-18T08:00:00Z')]);
    expect(out.map((e) => e.id)).toEqual(['good', 'bad']);
  });
});
