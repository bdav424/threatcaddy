// src/lib/bridges.ts
//
// Canonical interface definitions for the desktop IPC adapters exposed via preload.mjs.
// Both the Electron preload (window.threatcaddyMail / window.threatcaddy.calendar) and a
// future server-side adapter must satisfy these interfaces. The renderer holds only
// credentialReferenceIds — raw secrets never cross this boundary.

import type { CalendarEvent } from '../types';

// ─── Mail Bridge ───────────────────────────────────────────────────────────────

export interface MailBridge {
  saveCredential(ref: string, cred: unknown): Promise<{ ok: boolean }>;
  execute(action: string, credentialReferenceId: string, params?: Record<string, unknown>): Promise<unknown>;
  startOAuth(providerId: string): Promise<{ credRefId: string; email: string | null }>;
}

// ─── Calendar Bridge ───────────────────────────────────────────────────────────

export interface CalendarBridge {
  pull(accountId: string, range: { timeMinISO: string; timeMaxISO: string }): Promise<CalendarEvent[]>;
  create(accountId: string, event: CalendarEvent): Promise<{ remoteId: string; etag?: string }>;
  update(accountId: string, event: CalendarEvent): Promise<{ remoteId: string; etag?: string }>;
  remove(accountId: string, remoteId: string): Promise<{ ok: boolean }>;
}

export interface DesktopCalendarBridge extends CalendarBridge {
  startOAuth(providerId: string): Promise<{ credRefId: string; email: string | null }>;
  registerAccount(account: unknown): Promise<unknown>;
}

// ─── Resolvers ────────────────────────────────────────────────────────────────

type MailBridgeGlobal = typeof globalThis & { threatcaddyMail?: MailBridge };
type CalendarBridgeGlobal = typeof globalThis & { threatcaddy?: { calendar?: DesktopCalendarBridge } };

export function getMailBridge(): MailBridge | null {
  return (globalThis as MailBridgeGlobal).threatcaddyMail ?? null;
}

export function getCalendarBridge(): DesktopCalendarBridge | null {
  return (globalThis as CalendarBridgeGlobal).threatcaddy?.calendar ?? null;
}

export function isDesktopBridge(): boolean {
  return Boolean((globalThis as { threatcaddyDesktop?: { isDesktop?: boolean } }).threatcaddyDesktop?.isDesktop);
}
