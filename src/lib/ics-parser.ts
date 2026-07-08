/**
 * ICS calendar file parser.
 *
 * Uses ical.js for VCALENDAR/VEVENT/TZID parsing and rrule for RRULE
 * expansion. No hand-rolled calendar parsing is done here — both are
 * well-vetted libraries purpose-built for RFC 5545.
 */

import ICAL from 'ical.js';
import { RRule } from 'rrule';

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
 * Recurring events are expanded from 7 days ago to 90 days out from today.
 */
export function parseICSContent(icsText: string): ParsedCalendarEvent[] {
  const jcalData = ICAL.parse(icsText);
  const comp = new ICAL.Component(jcalData);
  const vevents = comp.getAllSubcomponents('vevent');
  const results: ParsedCalendarEvent[] = [];

  for (const vevent of vevents) {
    const event = new ICAL.Event(vevent);
    const base = {
      uid: event.uid,
      title: event.summary ?? '(No title)',
      description: event.description ?? undefined,
      location: event.location ?? undefined,
    };

    if (event.isRecurring()) {
      const rruleProp = vevent.getFirstPropertyValue('rrule');
      if (rruleProp) {
        try {
          const dtstart = event.startDate.toJSDate();
          const duration = event.endDate.toJSDate().getTime() - dtstart.getTime();
          const rrule = new RRule({
            ...RRule.parseString(rruleProp.toString()),
            dtstart,
          });
          const now = Date.now();
          const rangeStart = new Date(now - 7 * 24 * 60 * 60 * 1000);
          const rangeEnd = new Date(now + 90 * 24 * 60 * 60 * 1000);
          for (const d of rrule.between(rangeStart, rangeEnd)) {
            results.push({ ...base, start: d, end: new Date(d.getTime() + duration), isRecurring: true });
          }
        } catch {
          // Fall back to single occurrence on rrule parse failure
          results.push({
            ...base,
            start: event.startDate.toJSDate(),
            end: event.endDate.toJSDate(),
            isRecurring: true,
          });
        }
      } else {
        results.push({
          ...base,
          start: event.startDate.toJSDate(),
          end: event.endDate.toJSDate(),
          isRecurring: true,
        });
      }
    } else {
      results.push({
        ...base,
        start: event.startDate.toJSDate(),
        end: event.endDate.toJSDate(),
        isRecurring: false,
      });
    }
  }

  return results;
}
