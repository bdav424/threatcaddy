/**
 * ICS calendar file parser.
 *
 * TODO: Install dependencies before use:
 *   pnpm add ical.js rrule
 *
 * This module exports the stable ParsedCalendarEvent interface and
 * parseICSContent function. The internals are stubbed until ical.js and rrule
 * are installed — no hand-rolled VCALENDAR/RRULE/TZID parsing is done here.
 * Once the packages are installed, replace the stub body with the real
 * implementation shown in the comments below.
 */

export interface ParsedCalendarEvent {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  isRecurring: boolean;
  recurrenceId?: string;
}

/**
 * Parse the text content of an ICS file and return a flat list of events.
 * Recurring events are expanded up to 90 days out from today.
 *
 * Requires ical.js + rrule to be installed (`pnpm add ical.js rrule`).
 * Until then this function throws an informative error rather than silently
 * returning empty results or hand-rolling RRULE parsing.
 *
 * --- Real implementation (uncomment after pnpm add ical.js rrule) ---
 *
 * import ICAL from 'ical.js';
 * import { RRule } from 'rrule';
 *
 * export function parseICSContent(icsText: string): ParsedCalendarEvent[] {
 *   const jcalData = ICAL.parse(icsText);
 *   const comp = new ICAL.Component(jcalData);
 *   const vevents = comp.getAllSubcomponents('vevent');
 *   const results: ParsedCalendarEvent[] = [];
 *
 *   for (const vevent of vevents) {
 *     const event = new ICAL.Event(vevent);
 *     const base = {
 *       uid: event.uid,
 *       title: event.summary ?? '(No title)',
 *       description: event.description,
 *       location: event.location,
 *     };
 *
 *     if (event.isRecurring()) {
 *       const rruleProp = vevent.getFirstPropertyValue('rrule');
 *       if (rruleProp) {
 *         try {
 *           const dtstart = event.startDate.toJSDate();
 *           const duration = event.endDate.toJSDate().getTime() - dtstart.getTime();
 *           const rrule = new RRule({
 *             ...RRule.parseString(rruleProp.toString()),
 *             dtstart,
 *           });
 *           const now = Date.now();
 *           const rangeStart = new Date(now - 7 * 24 * 60 * 60 * 1000);
 *           const rangeEnd = new Date(now + 90 * 24 * 60 * 60 * 1000);
 *           for (const d of rrule.between(rangeStart, rangeEnd)) {
 *             results.push({ ...base, start: d, end: new Date(d.getTime() + duration), isRecurring: true });
 *           }
 *         } catch {
 *           // Fall back to single occurrence on rrule parse failure
 *           results.push({ ...base, start: event.startDate.toJSDate(), end: event.endDate.toJSDate(), isRecurring: true });
 *         }
 *       }
 *     } else {
 *       results.push({ ...base, start: event.startDate.toJSDate(), end: event.endDate.toJSDate(), isRecurring: false });
 *     }
 *   }
 *
 *   return results;
 * }
 */

// ---------------------------------------------------------------------------
// STUB — replace with the real implementation above once ical.js + rrule are
// installed. Do NOT add regex/hand-rolled VCALENDAR or RRULE parsing here.
// ---------------------------------------------------------------------------
export function parseICSContent(_icsText: string): ParsedCalendarEvent[] {
  throw new Error(
    'ICS parsing requires ical.js and rrule. Run: pnpm add ical.js rrule — then replace this stub with the real implementation in src/lib/ics-parser.ts.',
  );
}
