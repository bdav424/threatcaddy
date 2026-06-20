export type CalendarProvider = 'google' | 'microsoft' | 'caldav';
export type CalendarAccountStatus = 'connected' | 'failed' | 'revoked';

export interface CalendarAccountConfig {
  schemaVersion: 1;
  id: string;
  provider: CalendarProvider;
  label: string;
  email?: string;
  credRefId: string;
  calendarEnabled: boolean;
  status: CalendarAccountStatus;
  createdAt: number;
  updatedAt: number;
}

export function createCalendarAccountConfig(input: {
  id: string;
  provider: CalendarProvider;
  label: string;
  email?: string;
  credRefId: string;
  now?: number;
}): CalendarAccountConfig {
  const now = input.now ?? Date.now();
  return {
    schemaVersion: 1,
    id: input.id,
    provider: input.provider,
    label: input.label,
    email: input.email,
    credRefId: input.credRefId,
    calendarEnabled: true,
    status: 'connected',
    createdAt: now,
    updatedAt: now,
  };
}

export function sanitizeCalendarAccount(raw: unknown): CalendarAccountConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.schemaVersion !== 1) return null;
  if (typeof obj.id !== 'string' || !obj.id) return null;
  if (!(['google', 'microsoft', 'caldav'] as string[]).includes(obj.provider as string)) return null;
  if (typeof obj.credRefId !== 'string' || !obj.credRefId) return null;
  return {
    schemaVersion: 1,
    id: obj.id,
    provider: obj.provider as CalendarProvider,
    label: typeof obj.label === 'string' ? obj.label : '',
    email: typeof obj.email === 'string' ? obj.email : undefined,
    credRefId: obj.credRefId,
    calendarEnabled: obj.calendarEnabled !== false,
    status: (['connected', 'failed', 'revoked'] as string[]).includes(obj.status as string)
      ? (obj.status as CalendarAccountStatus)
      : 'connected',
    createdAt: typeof obj.createdAt === 'number' ? obj.createdAt : Date.now(),
    updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : Date.now(),
  };
}

export function sanitizeCalendarAccounts(input: unknown): CalendarAccountConfig[] {
  if (!Array.isArray(input)) return [];
  return input.map(sanitizeCalendarAccount).filter((a): a is CalendarAccountConfig => a !== null);
}

/** Map a CalendarAccountConfig to the shape useCalendarSync expects. */
export function toSyncAccount(a: CalendarAccountConfig): {
  id: string;
  provider: CalendarProvider;
  label: string;
  calendarEnabled: boolean;
} {
  return {
    id: a.id,
    provider: a.provider,
    label: a.label,
    calendarEnabled: a.calendarEnabled && a.status === 'connected',
  };
}
