import { describe, it, expect } from 'vitest';
import { mergeRemote } from '../hooks/useCalendarSync';
import type { CalendarEvent } from '../types';

const base: CalendarEvent = {
  id: 'local-1',
  remoteId: 'remote-1',
  title: 'Meeting',
  start: '2026-06-18T10:00:00.000Z',
  end: '2026-06-18T11:00:00.000Z',
  allDay: false,
  source: 'Google Calendar',
  detail: '',
  location: '',
  syncState: 'synced',
  updatedAt: 1000,
};

describe('mergeRemote', () => {
  it('upserts new remote events that have no local counterpart', () => {
    const result = mergeRemote([], [base]);
    expect(result).toHaveLength(1);
    expect(result[0].remoteId).toBe('remote-1');
    expect(result[0].syncState).toBe('synced');
  });

  it('overwrites local synced event with newer remote version', () => {
    const local: CalendarEvent = { ...base, title: 'Old title', updatedAt: 500, syncState: 'synced' };
    const remote: CalendarEvent = { ...base, title: 'New title', updatedAt: 2000, syncState: 'synced' };
    const result = mergeRemote([local], [remote]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('New title');
    expect(result[0].id).toBe('local-1'); // preserves local id
  });

  it('preserves local dirty event that is newer than remote (last-write-wins)', () => {
    const local: CalendarEvent = { ...base, title: 'My edit', updatedAt: 9000, syncState: 'dirty' };
    const remote: CalendarEvent = { ...base, title: 'Remote version', updatedAt: 5000, syncState: 'synced' };
    const result = mergeRemote([local], [remote]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('My edit');
    expect(result[0].syncState).toBe('dirty');
  });

  it('does NOT preserve dirty event when remote is newer', () => {
    const local: CalendarEvent = { ...base, title: 'Old dirty', updatedAt: 100, syncState: 'dirty' };
    const remote: CalendarEvent = { ...base, title: 'Newer remote', updatedAt: 9999, syncState: 'synced' };
    const result = mergeRemote([local], [remote]);
    expect(result[0].title).toBe('Newer remote');
  });

  it('ignores remote events without a remoteId', () => {
    const noId: CalendarEvent = { ...base, remoteId: undefined };
    const result = mergeRemote([], [noId]);
    expect(result).toHaveLength(0);
  });

  it('leaves local-only events (no remoteId) untouched', () => {
    const localOnly: CalendarEvent = { ...base, remoteId: undefined, id: 'local-only', syncState: 'local' };
    const result = mergeRemote([localOnly], [base]);
    expect(result).toHaveLength(2);
    const lo = result.find((e) => e.id === 'local-only');
    expect(lo?.syncState).toBe('local');
  });
});
