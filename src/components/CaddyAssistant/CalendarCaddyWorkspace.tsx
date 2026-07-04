import { memo, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import {
  AudioLines,
  Baby,
  BriefcaseBusiness,
  CalendarDays,
  CakeSlice,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flag,
  GraduationCap,
  Heart,
  Palmtree,
  PencilLine,
  Plane,
  Plus,
  RefreshCw,
  Settings,
  Upload,
  Stamp,
  Sparkles,
  Stethoscope,
  Trash2,
  Umbrella,
  Video,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  WorkspacePanel,
  useWorkspacePanelHeaderAccessory,
} from '../WorkspacePanels/WorkspacePanel';
import { WorkspacePanelDock } from '../WorkspacePanels/WorkspacePanelDock';
import {
  WorkspacePanelProvider,
} from '../WorkspacePanels/WorkspacePanelProvider';
import { useWorkspacePanel } from '../WorkspacePanels/useWorkspacePanels';
import { cn } from '../../lib/utils';
import { getCalendarBridge } from '../../lib/bridges';
import { calendarCaddyPanelRegistrations } from './workspacePanelRegistrations';
import { sortEvents } from './calendar-utils';
import { useCalendarSync, type PendingDeletion, type CalendarSyncAccount } from '../../hooks/useCalendarSync';
import { useCalendarAccounts } from '../../hooks/useCalendarAccounts';
import { toSyncAccount } from '../../lib/calendar-accounts';
import type { CalendarEvent, EventSource } from '../../types';
import { parseICSContent } from '../../lib/ics-parser';

type CalendarViewMode = 'week' | 'month' | 'year';
type CalendarDensity = 'condensed' | 'medium' | 'spacious';
type RepeatMode = 'none' | 'daily' | 'weekly';
type WeekSnapMinutes = 15 | 30;
type CalendarStampId = 'birthday' | 'holiday' | 'vacation' | 'school' | 'travel' | 'focus' | 'family' | 'medical' | 'deadline' | 'pto' | 'parental';

interface EventDraft {
  id: string | null;
  title: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  allDay: boolean;
  source: EventSource;
  detail: string;
  location: string;
  conferenceApp: string;
  repeatMode: RepeatMode;
  repeatCount: number;
}

interface AssistantPreview {
  title: string;
  summary: string;
  bullets: string[];
}

interface WeekSelectionState {
  startDay: Date;
  endDay: Date;
  start: Date;
  end: Date;
}

interface MonthSelectionState {
  start: Date;
  end: Date;
}

interface EventResizeState {
  eventId: string;
  edge: 'start' | 'end';
  day: Date;
  originalStart: Date;
  originalEnd: Date;
}

interface EventContextMenuState {
  eventId: string;
  x: number;
  y: number;
}

interface CalendarStamp {
  id: CalendarStampId;
  label: string;
  icon: LucideIcon;
  color: string;
  softBackground: string;
  ring: string;
}

type StampInteractionEvent = Pick<MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>, 'preventDefault' | 'stopPropagation'>;

declare global {
  interface Window {
    __TC_CALENDARCADDY_TODAY__?: string | Date | (() => string | Date);
  }
}

const DEFAULT_WEEK_START_INDEX = 0;
const DEFAULT_EVENT_DURATION_MINUTES = 30;
const MAX_STAMPS_PER_DAY = 3;
const DAY_STAMP_STORAGE_KEY = 'tc-calendarcaddy-day-stamps-v2';
const EVENT_STAMP_STORAGE_KEY = 'tc-calendarcaddy-event-stamps-v1';
const EVENT_STORAGE_KEY = 'tc-calendarcaddy-events-v1';
const EVENT_DELETION_KEY = 'tc-calendarcaddy-pending-deletions-v1';
const COMPACT_TITLEBAR_STAMP_PRIORITY: CalendarStampId[] = ['focus', 'medical', 'deadline', 'pto', 'school', 'travel'];
const COMPACT_VIEW_LABELS: Record<CalendarViewMode, string> = { week: 'W', month: 'M', year: 'Y' };
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EVENT_SOURCES: EventSource[] = ['ThreatCaddy Work', 'Research', 'Family', 'Zoom', 'PTO'];
const WEEK_HOURS = Array.from({ length: 24 }, (_, index) => index);

const CALENDAR_STAMPS: CalendarStamp[] = [
  {
    id: 'birthday',
    label: 'Birthday',
    icon: CakeSlice,
    color: '#fb7185',
    softBackground: 'rgba(251, 113, 133, 0.14)',
    ring: 'rgba(251, 113, 133, 0.74)',
  },
  {
    id: 'holiday',
    label: 'Holiday',
    icon: Stamp,
    color: '#f59e0b',
    softBackground: 'rgba(245, 158, 11, 0.14)',
    ring: 'rgba(245, 158, 11, 0.72)',
  },
  {
    id: 'vacation',
    label: 'Vacation',
    icon: Palmtree,
    color: '#22c55e',
    softBackground: 'rgba(34, 197, 94, 0.14)',
    ring: 'rgba(34, 197, 94, 0.72)',
  },
  {
    id: 'school',
    label: 'School',
    icon: GraduationCap,
    color: '#38bdf8',
    softBackground: 'rgba(56, 189, 248, 0.14)',
    ring: 'rgba(56, 189, 248, 0.72)',
  },
  {
    id: 'pto',
    label: 'Paid time off',
    icon: Umbrella,
    color: '#fbbf24',
    softBackground: 'rgba(251, 191, 36, 0.14)',
    ring: 'rgba(251, 191, 36, 0.74)',
  },
  {
    id: 'parental',
    label: 'Parental leave',
    icon: Baby,
    color: '#c084fc',
    softBackground: 'rgba(192, 132, 252, 0.14)',
    ring: 'rgba(192, 132, 252, 0.72)',
  },
  {
    id: 'travel',
    label: 'Travel',
    icon: Plane,
    color: '#60a5fa',
    softBackground: 'rgba(96, 165, 250, 0.14)',
    ring: 'rgba(96, 165, 250, 0.72)',
  },
  {
    id: 'focus',
    label: 'Focus work',
    icon: BriefcaseBusiness,
    color: '#14b8a6',
    softBackground: 'rgba(20, 184, 166, 0.14)',
    ring: 'rgba(20, 184, 166, 0.72)',
  },
  {
    id: 'family',
    label: 'Family',
    icon: Heart,
    color: '#f472b6',
    softBackground: 'rgba(244, 114, 182, 0.14)',
    ring: 'rgba(244, 114, 182, 0.72)',
  },
  {
    id: 'medical',
    label: 'Medical',
    icon: Stethoscope,
    color: '#34d399',
    softBackground: 'rgba(52, 211, 153, 0.14)',
    ring: 'rgba(52, 211, 153, 0.72)',
  },
  {
    id: 'deadline',
    label: 'Deadline',
    icon: Flag,
    color: '#fb923c',
    softBackground: 'rgba(251, 146, 60, 0.14)',
    ring: 'rgba(251, 146, 60, 0.72)',
  },
];

const STAMP_BY_ID = Object.fromEntries(
  CALENDAR_STAMPS.map((stamp) => [stamp.id, stamp]),
) as Record<CalendarStampId, CalendarStamp>;

function compactTitlebarStampLimit(width?: number) {
  if (width === undefined || width >= 640) return 3;
  if (width >= 580) return 2;
  if (width >= 540) return 1;
  return 0;
}

const SOURCE_STYLES: Record<EventSource, { color: string; softBackground: string; ring: string }> = {
  'ThreatCaddy Work': {
    color: '#f59f9f',
    softBackground: 'rgba(245, 159, 159, 0.16)',
    ring: 'rgba(245, 159, 159, 0.28)',
  },
  Research: {
    color: '#7fd694',
    softBackground: 'rgba(127, 214, 148, 0.16)',
    ring: 'rgba(127, 214, 148, 0.28)',
  },
  Family: {
    color: '#d28cff',
    softBackground: 'rgba(210, 140, 255, 0.16)',
    ring: 'rgba(210, 140, 255, 0.28)',
  },
  Zoom: {
    color: '#7ec4ff',
    softBackground: 'rgba(126, 196, 255, 0.16)',
    ring: 'rgba(126, 196, 255, 0.28)',
  },
  PTO: {
    color: '#f4bf61',
    softBackground: 'rgba(244, 191, 97, 0.16)',
    ring: 'rgba(244, 191, 97, 0.28)',
  },
  'Google Calendar': {
    color: '#7ec4ff',
    softBackground: 'rgba(126, 196, 255, 0.16)',
    ring: 'rgba(126, 196, 255, 0.28)',
  },
  'Microsoft 365': {
    color: '#8fa8ff',
    softBackground: 'rgba(143, 168, 255, 0.16)',
    ring: 'rgba(143, 168, 255, 0.28)',
  },
  CalDAV: {
    color: '#9fe0c8',
    softBackground: 'rgba(159, 224, 200, 0.16)',
    ring: 'rgba(159, 224, 200, 0.28)',
  },
  ICS: {
    color: '#a78bfa',
    softBackground: 'rgba(167, 139, 250, 0.16)',
    ring: 'rgba(167, 139, 250, 0.28)',
  },
};

const initialEvents: CalendarEvent[] = [
  {
    id: 'event-1',
    title: 'Partner architecture review',
    start: '2026-06-09T13:00:00',
    end: '2026-06-09T14:00:00',
    allDay: false,
    source: 'ThreatCaddy Work',
    detail: 'Needs prep notes and a clearer decision path before the meeting starts.',
    location: 'Zoom link opens externally',
    conferenceApp: 'Zoom',
  },
  {
    id: 'event-2',
    title: 'Deep research block',
    start: '2026-06-10T10:00:00',
    end: '2026-06-10T12:00:00',
    allDay: false,
    source: 'Research',
    detail: 'Protected work block for note cleanup, drafting, and follow-up actions.',
    location: 'Research lane',
  },
  {
    id: 'event-3',
    title: 'School pickup buffer',
    start: '2026-06-11T15:30:00',
    end: '2026-06-11T16:00:00',
    allDay: false,
    source: 'Family',
    detail: 'Personal hold stays visible so later work meetings do not silently overwrite it.',
    location: 'Maps route opens externally',
  },
  {
    id: 'event-4',
    title: 'Threat brief review',
    start: '2026-06-12T11:00:00',
    end: '2026-06-12T12:00:00',
    allDay: false,
    source: 'ThreatCaddy Work',
    detail: 'Good candidate for turn-this-meeting-into-work once the review ends.',
    location: 'Teams link opens externally',
  },
  ...Array.from({ length: 21 }, (_, index) => {
    const start = addDays(createDate(2026, 6, 6, 8, 45), index);
    const end = addMinutes(start, 15);
    return {
      id: `event-daily-recurring-${index + 1}`,
      title: 'Daily recurring standup',
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: false,
      source: 'ThreatCaddy Work',
      detail: 'Three-week daily recurring appointment seed for CalendarCaddy density and repeat coverage.',
      location: 'AssistantCaddy sample calendar',
    } satisfies CalendarEvent;
  }),
  {
    id: 'event-august-pto',
    title: 'August PTO block',
    start: createDate(2026, 7, 3, 0, 0).toISOString(),
    end: createDate(2026, 7, 16, 23, 59).toISOString(),
    allDay: true,
    source: 'PTO',
    detail: 'Two-week all-day PTO block for ranged month rendering and drag-selection parity.',
    location: 'Out of office',
  },
];

const densityClasses: Record<
  CalendarDensity,
  {
    shell: string;
    headerGap: string;
    brandIcon: string;
    brandIconSize: number;
    title: string;
    titleSubtle: string;
    windowButton: string;
    windowIconSize: number;
    toolbarWrap: string;
    toolbarButton: string;
    toolbarIconButton: string;
    toolbarIconSize: number;
    monthLabel: string;
    segmentedWrap: string;
    segmentedButton: string;
    densityWrap: string;
    densityButton: string;
    promptWrap: string;
    promptInput: string;
    promptHelper: string;
    providerButton: string;
    agendaButton: string;
    previewWrap: string;
    previewTitle: string;
    previewSummary: string;
    previewList: string;
    monthWrap: string;
    monthWeekday: string;
    monthCell: string;
    dayNumber: string;
    dayNumberSelected: string;
    cellAdd: string;
    monthEvent: string;
    monthMore: string;
    weekWrap: string;
    weekHeaderCell: string;
    weekHeaderLabel: string;
    weekHeaderDate: string;
    allDayLabel: string;
    allDayCell: string;
    allDayEvent: string;
    weekHourLabel: string;
    weekSlot: string;
    weekEvent: string;
    yearGrid: string;
    yearCard: string;
    yearTitle: string;
    yearMeta: string;
    drawerWidth: string;
    drawerPadding: string;
    drawerFieldLabel: string;
    drawerField: string;
    drawerTextarea: string;
    drawerFooterButton: string;
    statusText: string;
    slotHeight: number;
    maxMonthEvents: number;
  }
> = {
  condensed: {
    shell: 'rounded-[20px] p-2',
    headerGap: 'gap-2',
    brandIcon: 'h-7 w-7 rounded-[12px]',
    brandIconSize: 15,
    title: 'text-[19px]',
    titleSubtle: 'text-[11px] tracking-[0.18em]',
    windowButton: 'h-8 w-8 rounded-[10px]',
    windowIconSize: 15,
    toolbarWrap: 'mt-1.5 gap-1.5',
    toolbarButton: 'h-8 rounded-[10px] px-3 text-[12px]',
    toolbarIconButton: 'h-8 w-8 rounded-[10px]',
    toolbarIconSize: 15,
    monthLabel: 'text-[15px]',
    segmentedWrap: 'rounded-[12px]',
    segmentedButton: 'px-2.5 py-1.5 text-[12px]',
    densityWrap: 'rounded-[12px]',
    densityButton: 'px-2.25 py-1.5 text-[10px]',
    promptWrap: 'mt-2',
    promptInput: 'text-[14px]',
    promptHelper: 'text-[10px]',
    providerButton: 'h-7 rounded-full px-2 text-[10px]',
    agendaButton: 'h-7 rounded-full px-2.5 text-[10px]',
    previewWrap: 'mt-1.5 rounded-[14px] px-3 py-2',
    previewTitle: 'text-[15px]',
    previewSummary: 'mt-1 text-[12px] leading-5',
    previewList: 'mt-1.5 space-y-1 text-[11px] leading-5',
    monthWrap: 'mt-2 rounded-[16px]',
    monthWeekday: 'px-1 py-1 text-[10px]',
    monthCell: 'h-full min-h-0 overflow-hidden p-1.25',
    dayNumber: 'text-[11px]',
    dayNumberSelected: 'h-6 w-6 text-[11px]',
    cellAdd: 'h-5 w-5',
    monthEvent: 'mt-1 rounded-[7px] px-1.25 py-0.5 text-[10px]',
    monthMore: 'mt-1 text-[10px]',
    weekWrap: 'mt-2.5 rounded-[16px]',
    weekHeaderCell: 'px-1.5 py-1.5',
    weekHeaderLabel: 'text-[10px]',
    weekHeaderDate: 'mt-0.5 text-[13px]',
    allDayLabel: 'px-2 py-1.5 text-[10px]',
    allDayCell: 'min-h-[36px] px-1 py-1',
    allDayEvent: 'rounded-[8px] px-1.5 py-0.5 text-[10px]',
    weekHourLabel: 'h-8 px-1.5 text-[10px]',
    weekSlot: 'h-8',
    weekEvent: 'rounded-[8px] px-1.25 py-0.75 text-[10px]',
    yearGrid: 'mt-2.5 gap-2',
    yearCard: 'rounded-[15px] p-2.5',
    yearTitle: 'text-[14px]',
    yearMeta: 'mt-2 text-[12px]',
    drawerWidth: 'max-w-[350px]',
    drawerPadding: 'p-4',
    drawerFieldLabel: 'text-[11px]',
    drawerField: 'h-9 rounded-[10px] px-3 text-[13px]',
    drawerTextarea: 'rounded-[10px] px-3 py-2 text-[13px]',
    drawerFooterButton: 'h-9 rounded-[10px] px-3 text-[13px]',
    statusText: 'text-[11px]',
    slotHeight: 32,
    maxMonthEvents: 2,
  },
  medium: {
    shell: 'rounded-[24px] p-3',
    headerGap: 'gap-2.5',
    brandIcon: 'h-8 w-8 rounded-[13px]',
    brandIconSize: 17,
    title: 'text-[22px]',
    titleSubtle: 'text-[11px] tracking-[0.18em]',
    windowButton: 'h-9 w-9 rounded-[11px]',
    windowIconSize: 16,
    toolbarWrap: 'mt-2 gap-1.5',
    toolbarButton: 'h-9 rounded-[11px] px-3.5 text-[13px]',
    toolbarIconButton: 'h-9 w-9 rounded-[11px]',
    toolbarIconSize: 17,
    monthLabel: 'text-[17px]',
    segmentedWrap: 'rounded-[13px]',
    segmentedButton: 'px-3.25 py-1.75 text-[13px]',
    densityWrap: 'rounded-[13px]',
    densityButton: 'px-2.75 py-1.75 text-[11px]',
    promptWrap: 'mt-2.5',
    promptInput: 'text-[15px]',
    promptHelper: 'text-[11px]',
    providerButton: 'h-7.5 rounded-full px-2.5 text-[10px]',
    agendaButton: 'h-8 rounded-full px-3 text-[11px]',
    previewWrap: 'mt-2 rounded-[15px] px-3 py-2.5',
    previewTitle: 'text-[16px]',
    previewSummary: 'mt-1 text-[13px] leading-5',
    previewList: 'mt-2 space-y-1.5 text-[12px] leading-5',
    monthWrap: 'mt-2.5 rounded-[18px]',
    monthWeekday: 'px-1.5 py-1.5 text-[11px]',
    monthCell: 'h-full min-h-0 overflow-hidden p-1.75',
    dayNumber: 'text-[12px]',
    dayNumberSelected: 'h-7 w-7 text-[12px]',
    cellAdd: 'h-6 w-6',
    monthEvent: 'mt-1 rounded-[8px] px-1.75 py-0.75 text-[11px]',
    monthMore: 'mt-1 text-[11px]',
    weekWrap: 'mt-3 rounded-[18px]',
    weekHeaderCell: 'px-2 py-2',
    weekHeaderLabel: 'text-[11px]',
    weekHeaderDate: 'mt-1 text-[15px]',
    allDayLabel: 'px-2.5 py-2 text-[11px]',
    allDayCell: 'min-h-[42px] px-1.5 py-1.5',
    allDayEvent: 'rounded-[9px] px-2 py-1 text-[11px]',
    weekHourLabel: 'h-10 px-2.5 text-[11px]',
    weekSlot: 'h-10',
    weekEvent: 'rounded-[11px] px-2 py-1.5 text-[11px]',
    yearGrid: 'mt-3 gap-3',
    yearCard: 'rounded-[17px] p-3.25',
    yearTitle: 'text-[15px]',
    yearMeta: 'mt-2 text-[12px]',
    drawerWidth: 'max-w-[380px]',
    drawerPadding: 'p-4',
    drawerFieldLabel: 'text-[11px]',
    drawerField: 'h-10 rounded-[11px] px-3 text-[14px]',
    drawerTextarea: 'rounded-[11px] px-3 py-2.5 text-[14px]',
    drawerFooterButton: 'h-10 rounded-[11px] px-3.5 text-[14px]',
    statusText: 'text-[12px]',
    slotHeight: 40,
    maxMonthEvents: 3,
  },
  spacious: {
    shell: 'rounded-[26px] p-4',
    headerGap: 'gap-3',
    brandIcon: 'h-9 w-9 rounded-[15px]',
    brandIconSize: 18,
    title: 'text-[25px]',
    titleSubtle: 'text-[12px] tracking-[0.18em]',
    windowButton: 'h-10 w-10 rounded-[12px]',
    windowIconSize: 17,
    toolbarWrap: 'mt-2.5 gap-2',
    toolbarButton: 'h-10 rounded-[12px] px-4 text-[14px]',
    toolbarIconButton: 'h-10 w-10 rounded-[12px]',
    toolbarIconSize: 18,
    monthLabel: 'text-[19px]',
    segmentedWrap: 'rounded-[14px]',
    segmentedButton: 'px-3.75 py-2 text-[14px]',
    densityWrap: 'rounded-[14px]',
    densityButton: 'px-3.25 py-2 text-[12px]',
    promptWrap: 'mt-3',
    promptInput: 'text-[16px]',
    promptHelper: 'text-[12px]',
    providerButton: 'h-8 rounded-full px-3 text-[11px]',
    agendaButton: 'h-8.5 rounded-full px-3.5 text-[11px]',
    previewWrap: 'mt-2.5 rounded-[17px] px-3.5 py-3',
    previewTitle: 'text-[17px]',
    previewSummary: 'mt-1 text-[14px] leading-6',
    previewList: 'mt-2.5 space-y-1.5 text-[13px] leading-6',
    monthWrap: 'mt-3 rounded-[20px]',
    monthWeekday: 'px-2 py-1.75 text-[12px]',
    monthCell: 'h-full min-h-0 overflow-hidden p-2.25',
    dayNumber: 'text-[13px]',
    dayNumberSelected: 'h-8 w-8 text-[13px]',
    cellAdd: 'h-6 w-6',
    monthEvent: 'mt-1.25 rounded-[9px] px-2 py-0.75 text-[11px]',
    monthMore: 'mt-1.5 text-[12px]',
    weekWrap: 'mt-3.5 rounded-[20px]',
    weekHeaderCell: 'px-2.5 py-2.5',
    weekHeaderLabel: 'text-[11px]',
    weekHeaderDate: 'mt-1 text-[16px]',
    allDayLabel: 'px-3 py-2.5 text-[12px]',
    allDayCell: 'min-h-[46px] px-2 py-1.75',
    allDayEvent: 'rounded-[10px] px-2 py-1 text-[12px]',
    weekHourLabel: 'h-11 px-3 text-[12px]',
    weekSlot: 'h-11',
    weekEvent: 'rounded-[12px] px-2.5 py-1.5 text-[12px]',
    yearGrid: 'mt-3.5 gap-3',
    yearCard: 'rounded-[19px] p-3.5',
    yearTitle: 'text-[16px]',
    yearMeta: 'mt-2.5 text-[13px]',
    drawerWidth: 'max-w-[400px]',
    drawerPadding: 'p-5',
    drawerFieldLabel: 'text-[12px]',
    drawerField: 'h-11 rounded-[12px] px-3.5 text-[15px]',
    drawerTextarea: 'rounded-[12px] px-3.5 py-3 text-[15px]',
    drawerFooterButton: 'h-11 rounded-[12px] px-4 text-[15px]',
    statusText: 'text-[13px]',
    slotHeight: 44,
    maxMonthEvents: 3,
  },
};

function buttonClass(active = false, sizeClass = 'h-10 rounded-[12px] px-4 text-[14px]') {
  return cn(
    'border font-medium transition-colors',
    sizeClass,
    active
      ? 'border-accent/30 bg-accent/10 text-accent'
      : 'border-border-subtle bg-bg-raised/70 text-text-secondary hover:border-border-medium hover:bg-bg-hover hover:text-text-primary',
  );
}

function createDate(year: number, month: number, day: number, hour = 0, minute = 0) {
  return new Date(year, month, day, hour, minute, 0, 0);
}

function cloneDate(date: Date) {
  return new Date(date.getTime());
}

function startOfDay(date: Date) {
  return createDate(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return createDate(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, amount: number) {
  const next = cloneDate(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number) {
  const next = cloneDate(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

function addYears(date: Date, amount: number) {
  const next = cloneDate(date);
  next.setFullYear(next.getFullYear() + amount);
  return next;
}

function addMinutes(date: Date, amount: number) {
  const next = cloneDate(date);
  next.setMinutes(next.getMinutes() + amount);
  return next;
}

function endOfDay(date: Date) {
  return addDays(startOfDay(date), 1);
}

function startOfWeek(date: Date, weekStartIndex = DEFAULT_WEEK_START_INDEX) {
  const normalized = startOfDay(date);
  const day = normalized.getDay();
  const delta = -((day - weekStartIndex + 7) % 7);
  return addDays(normalized, delta);
}

function getOrderedWeekdayLabels(weekStartIndex = DEFAULT_WEEK_START_INDEX) {
  return Array.from({ length: 7 }, (_, index) => WEEKDAY_LABELS[(weekStartIndex + index) % 7]);
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function sameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function clampDateRange(left: Date, right: Date) {
  return left.getTime() <= right.getTime() ? [left, right] : [right, left];
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function floorToSnap(value: number, snapMinutes: WeekSnapMinutes) {
  return Math.floor(value / snapMinutes) * snapMinutes;
}

function clampTimeToDay(value: Date, day: Date) {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  if (value.getTime() < dayStart.getTime()) {
    return dayStart;
  }
  if (value.getTime() > dayEnd.getTime()) {
    return dayEnd;
  }
  return value;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromDateInputValue(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return createDate(year, (month || 1) - 1, day || 1);
}

function dateStampKey(date: Date) {
  return toDateInputValue(startOfDay(date));
}

function cloneTimeOnDay(day: Date, timeSource: Date) {
  return createDate(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    timeSource.getHours(),
    timeSource.getMinutes(),
  );
}

function normalizeStampIds(value: unknown): CalendarStampId[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<CalendarStampId>();
  const ids: CalendarStampId[] = [];

  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    if (!(entry in STAMP_BY_ID)) continue;
    const stampId = entry as CalendarStampId;
    if (seen.has(stampId)) continue;
    seen.add(stampId);
    ids.push(stampId);
    if (ids.length >= MAX_STAMPS_PER_DAY) break;
  }

  return ids;
}

function normalizeStampMap(value: unknown): Record<string, CalendarStampId[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const next: Record<string, CalendarStampId[]> = {};

  for (const [key, ids] of Object.entries(value)) {
    const normalized = normalizeStampIds(ids);
    if (normalized.length > 0) {
      next[key] = normalized;
    }
  }

  return next;
}

function loadStampMap(storageKey: string): Record<string, CalendarStampId[]> {
  if (typeof window === 'undefined') return {};

  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? normalizeStampMap(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

function getStampOutlineStyle(stampIds: CalendarStampId[]): CSSProperties {
  if (stampIds.length === 0) return {};
  return {
    boxShadow: stampIds
      .slice(0, MAX_STAMPS_PER_DAY)
      .map((id, index) => `inset 0 0 0 ${index * 3 + 1}px ${STAMP_BY_ID[id].ring}`)
      .join(', '),
  };
}

function getStampTooltip(stampIds: CalendarStampId[]) {
  if (stampIds.length === 0) return undefined;
  return `Stamps: ${stampIds.map((id) => STAMP_BY_ID[id].label).join(', ')}`;
}

function mergeStampIds(...groups: CalendarStampId[][]) {
  const seen = new Set<CalendarStampId>();
  const merged: CalendarStampId[] = [];

  for (const group of groups) {
    for (const id of group) {
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(id);
      if (merged.length >= MAX_STAMPS_PER_DAY) return merged;
    }
  }

  return merged;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"], [contenteditable=""]'));
}

function isNativeActionTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(target.closest('button, a, [role="button"], [role="menuitem"]'));
}

function toTimeInputValue(date: Date) {
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}`;
}

function combineDateTime(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);
  return createDate(year, month - 1, day, hour || 0, minute || 0);
}

function parseEventDate(value: string) {
  return new Date(value);
}

function getCalendarToday() {
  if (typeof window !== 'undefined' && window.__TC_CALENDARCADDY_TODAY__) {
    const override = typeof window.__TC_CALENDARCADDY_TODAY__ === 'function'
      ? window.__TC_CALENDARCADDY_TODAY__()
      : window.__TC_CALENDARCADDY_TODAY__;
    return override instanceof Date ? cloneDate(override) : new Date(override);
  }

  return new Date();
}

function formatMonthHeading(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

function formatWeekHeading(start: Date) {
  const end = addDays(start, 6);
  const monthPart = `${MONTH_LABELS[start.getMonth()]} ${start.getDate()}`;
  const endPart = sameMonth(start, end)
    ? `${end.getDate()}, ${end.getFullYear()}`
    : `${MONTH_LABELS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  return `${monthPart} – ${endPart}`;
}

function formatAgendaDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatFullDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatHourLabel(hour: number) {
  const sample = createDate(2026, 5, 1, hour, 0);
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric' }).format(sample);
}

function formatTimeRange(event: CalendarEvent) {
  if (event.allDay) {
    return 'All day';
  }

  const start = parseEventDate(event.start);
  const end = parseEventDate(event.end);
  return `${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(start)} – ${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(end)}`;
}

function buildMonthGrid(displayDate: Date, weekStartIndex = DEFAULT_WEEK_START_INDEX) {
  const firstDay = startOfMonth(displayDate);
  const lastDay = createDate(displayDate.getFullYear(), displayDate.getMonth() + 1, 0);
  const gridStart = startOfWeek(firstDay, weekStartIndex);
  const trailingOffset = ((weekStartIndex + 6) - lastDay.getDay() + 7) % 7;
  const gridEnd = addDays(lastDay, trailingOffset);
  const days: Date[] = [];
  for (let cursor = cloneDate(gridStart); cursor.getTime() <= gridEnd.getTime(); cursor = addDays(cursor, 1)) {
    days.push(cursor);
  }
  return days;
}

function eventOccursOnDate(event: CalendarEvent, date: Date) {
  const start = startOfDay(parseEventDate(event.start));
  const end = startOfDay(parseEventDate(event.end));
  const [rangeStart, rangeEnd] = clampDateRange(start, end);
  const day = startOfDay(date).getTime();
  return day >= rangeStart.getTime() && day <= rangeEnd.getTime();
}

function getEventDurationMinutes(event: CalendarEvent) {
  if (event.allDay) {
    return 24 * 60;
  }
  const start = parseEventDate(event.start);
  const end = parseEventDate(event.end);
  return Math.max(30, Math.round((end.getTime() - start.getTime()) / 60000));
}

function getDefaultDraft(date: Date, hour = 9): EventDraft {
  const start = createDate(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0);
  const end = addMinutes(start, DEFAULT_EVENT_DURATION_MINUTES);
  return {
    id: null,
    title: '',
    startDate: toDateInputValue(start),
    startTime: toTimeInputValue(start),
    endDate: toDateInputValue(end),
    endTime: toTimeInputValue(end),
    allDay: false,
    source: 'ThreatCaddy Work',
    detail: '',
    location: '',
    conferenceApp: '',
    repeatMode: 'none',
    repeatCount: 1,
  };
}

function getDraftFromEvent(event: CalendarEvent): EventDraft {
  const start = parseEventDate(event.start);
  const end = parseEventDate(event.end);
  return {
    id: event.id,
    title: event.title,
    startDate: toDateInputValue(start),
    startTime: toTimeInputValue(start),
    endDate: toDateInputValue(end),
    endTime: toTimeInputValue(end),
    allDay: event.allDay,
    source: event.source,
    detail: event.detail,
    location: event.location,
    conferenceApp: event.conferenceApp || '',
    repeatMode: 'none',
    repeatCount: 1,
  };
}

function resolvePreview(value: string): AssistantPreview | null {
  const query = value.toLowerCase();

  if (query.includes('prep') || query.includes('agenda')) {
    return {
      title: 'Agenda assist preview',
      summary: 'CalendarCaddy would pull the invite body, meeting context, and related email trail into a short prep brief before the event starts.',
      bullets: [
        'Highlight the missing agenda items and decision owners before the meeting.',
        'Pull the join link, related thread, and any prep docs into one review lane.',
      ],
    };
  }

  if (query.includes('zoom') || query.includes('meet') || query.includes('teams')) {
    return {
      title: 'Join-link review preview',
      summary: 'CalendarCaddy would keep the scheduling action inside ThreatCaddy but leave the actual meeting launch in the external app or link target.',
      bullets: [
        'Preserve the original conference link instead of forcing an in-app join.',
        'Warn when a meeting still has no prep block or follow-up buffer attached.',
      ],
    };
  }

  if (query.includes('conflict') || query.includes('buffer')) {
    return {
      title: 'Conflict cleanup preview',
      summary: 'CalendarCaddy would compare work, family, and PTO holds and tell you which items need a real decision instead of a silent overlap.',
      bullets: [
        'Flag the collisions that still need follow-up or travel time.',
        'Offer to turn a meeting into a protected work block once it ends.',
      ],
    };
  }

  return {
    title: 'Calendar assist preview',
    summary: 'Ask for prep, conflicts, scheduling cleanup, or a better next-step plan and the calendar bar will route you into the right action.',
    bullets: [
      'Use the week grid for explicit scheduling and edits.',
      'Use the assist bar for agenda shaping and workflow questions.',
    ],
  };
}

function repeatStep(mode: RepeatMode) {
  return mode === 'weekly' ? 7 : 1;
}

export function CalendarCaddyWorkspace() {
  return (
    <WorkspacePanelProvider initialPanels={calendarCaddyPanelRegistrations}>
      <CalendarCaddyWorkspaceContent />
      <WorkspacePanelDock />
    </WorkspacePanelProvider>
  );
}

export const CalendarCaddyWorkspaceContent = memo(function CalendarCaddyWorkspaceContent({
  compactPanel = false,
  compactPanelWidth,
  onWorkspaceOwnPanel,
  onWorkspacePanelDragStart,
}: {
  compactPanel?: boolean;
  compactPanelWidth?: number;
  onWorkspaceOwnPanel?: (panelId: string) => void;
  onWorkspacePanelDragStart?: (event: DragEvent<HTMLElement>) => void;
} = {}) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [densityMode] = useState<CalendarDensity>('condensed');
  const weekSnapMinutes: WeekSnapMinutes = 15;
  const [today] = useState(() => getCalendarToday());
  const [displayDate, setDisplayDate] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(today));
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    try {
      const raw = localStorage.getItem(EVENT_STORAGE_KEY);
      if (raw) return sortEvents(JSON.parse(raw) as CalendarEvent[]);
    } catch { /* fall through to seed */ }
    return sortEvents(initialEvents);
  });
  const [pendingDeletions, setPendingDeletions] = useState<PendingDeletion[]>(() => {
    try { return JSON.parse(localStorage.getItem(EVENT_DELETION_KEY) ?? '[]'); } catch { return []; }
  });
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantPreview, setAssistantPreview] = useState<AssistantPreview | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<EventDraft>(() => getDefaultDraft(today));
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [weekSelection, setWeekSelection] = useState<WeekSelectionState | null>(null);
  const [monthSelection, setMonthSelection] = useState<MonthSelectionState | null>(null);
  const [statusMessage, setStatusMessage] = useState('Click a week slot for 30 minutes or drag to size it in 15-minute steps.');
  const [activeStampId, setActiveStampId] = useState<CalendarStampId | null>(null);
  const [stampDragActive, setStampDragActive] = useState(false);
  const [dayStamps, setDayStamps] = useState<Record<string, CalendarStampId[]>>(() => loadStampMap(DAY_STAMP_STORAGE_KEY));
  const [eventStamps, setEventStamps] = useState<Record<string, CalendarStampId[]>>(() => loadStampMap(EVENT_STAMP_STORAGE_KEY));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventContextMenu, setEventContextMenu] = useState<EventContextMenuState | null>(null);
  const assistantInputRef = useRef<HTMLInputElement>(null);
  const icsFileInputRef = useRef<HTMLInputElement>(null);
  const weekScrollerRef = useRef<HTMLDivElement>(null);
  const selectionAnchorRef = useRef<Date | null>(null);
  const selectionDayRef = useRef<Date | null>(null);
  const selectionHasMovedRef = useRef(false);
  const suppressWeekCellClickRef = useRef(false);
  const monthSelectionAnchorRef = useRef<Date | null>(null);
  const monthSelectionHasMovedRef = useRef(false);
  const suppressMonthCellClickRef = useRef(false);
  const stampDragActionRef = useRef<'add' | 'remove' | null>(null);
  const eventResizeRef = useRef<EventResizeState | null>(null);
  const draggedEventStartRef = useRef<Date | null>(null);
  const selectedAgendaPanel = useWorkspacePanel('calendarcaddy-selected-agenda');
  const handleSelectedAgendaPanelModeChange = useCallback((mode: Parameters<typeof selectedAgendaPanel.setMode>[0]) => {
    if (mode === 'floating' || mode === 'minimized') {
      onWorkspaceOwnPanel?.(selectedAgendaPanel.panel.id);
    }
    selectedAgendaPanel.setMode(mode);
  }, [onWorkspaceOwnPanel, selectedAgendaPanel]);

  // Calendar accounts — persisted in settings (credRefId only, no tokens)
  const { accounts: calendarAccountConfigs, addAccount: addCalendarAccount, removeAccount: removeCalendarAccount } = useCalendarAccounts();
  const calendarAccounts: CalendarSyncAccount[] = calendarAccountConfigs.map(toSyncAccount);
  const primaryAccountId = calendarAccountConfigs.find((a) => a.calendarEnabled && a.status === 'connected')?.id ?? null;

  const { syncing, lastSyncedAt, error: syncError, sync } = useCalendarSync(
    setEvents, pendingDeletions, setPendingDeletions, calendarAccounts, primaryAccountId,
  );

  // Calendar connect panel state
  const [calSettingsOpen, setCalSettingsOpen] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<'google' | 'microsoft' | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const density = densityClasses[densityMode];
  const activeStamp = activeStampId ? STAMP_BY_ID[activeStampId] : null;
  const ActiveStampIcon = activeStamp?.icon;
  const weekdayLabels = useMemo(() => getOrderedWeekdayLabels(), []);
  const monthDates = useMemo(() => buildMonthGrid(displayDate), [displayDate]);
  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const selectedDayEvents = useMemo(
    () => sortEvents(events.filter((event) => eventOccursOnDate(event, selectedDate))),
    [events, selectedDate],
  );
  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  // Re-register saved calendar accounts with the desktop main process on mount so
  // that IPC pull/create/update/remove handlers can resolve account → token.
  useEffect(() => {
    const bridge = getCalendarBridge();
    if (!bridge?.registerAccount) return;
    for (const acct of calendarAccountConfigs) {
      if (acct.status === 'connected') {
        void bridge.registerAccount({
          id: acct.id,
          provider: acct.provider,
          label: acct.label,
          email: acct.email,
          credRefId: acct.credRefId,
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally run once on mount
  }, []);

  const handleConnectProvider = useCallback(async (provider: 'google' | 'microsoft') => {
    const bridge = getCalendarBridge();

    if (!bridge?.startOAuth) {
      setConnectError('Calendar OAuth is only available in the ThreatCaddy desktop app.');
      return;
    }

    setConnectingProvider(provider);
    setConnectError(null);

    try {
      const result = await bridge.startOAuth(provider);
      const { credRefId, email } = result;
      const label = email || (provider === 'google' ? 'Google Calendar' : 'Microsoft 365');
      addCalendarAccount({ id: credRefId, provider, label, email: email || undefined, credRefId });
      await bridge.registerAccount({ id: credRefId, provider, label, email: email || undefined, credRefId });
      setCalSettingsOpen(false);
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : 'Connection failed. Check your OAuth client ID configuration.');
    } finally {
      setConnectingProvider(null);
    }
  }, [addCalendarAccount]);

  useEffect(() => {
    if (viewMode !== 'week' || !weekScrollerRef.current) {
      return;
    }
    const morningFocusHour = 7;
    const scrollTop = Math.max(0, morningFocusHour * density.slotHeight - density.slotHeight * 2);
    weekScrollerRef.current.scrollTop = scrollTop;
  }, [viewMode, density.slotHeight]);

  useEffect(() => {
    try {
      localStorage.setItem(DAY_STAMP_STORAGE_KEY, JSON.stringify(dayStamps));
    } catch {
      // Calendar stamping remains usable even if local persistence is unavailable.
    }
  }, [dayStamps]);

  useEffect(() => {
    try {
      localStorage.setItem(EVENT_STAMP_STORAGE_KEY, JSON.stringify(eventStamps));
    } catch {
      // Calendar stamping remains usable even if local persistence is unavailable.
    }
  }, [eventStamps]);

  useEffect(() => {
    try { localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(events)); } catch { /* ok */ }
  }, [events]);

  useEffect(() => {
    try { localStorage.setItem(EVENT_DELETION_KEY, JSON.stringify(pendingDeletions)); } catch { /* ok */ }
  }, [pendingDeletions]);

  useEffect(() => {
    if (!selectedEventId) {
      return;
    }
    if (!events.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(null);
      setEventContextMenu(null);
    }
  }, [events, selectedEventId]);

  useEffect(() => {
    if (!eventContextMenu) {
      return undefined;
    }

    const closeMenu = () => setEventContextMenu(null);
    const closeMenuOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };
    window.addEventListener('click', closeMenu);
    window.addEventListener('keydown', closeMenuOnEscape);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('keydown', closeMenuOnEscape);
    };
  }, [eventContextMenu]);

  useEffect(() => {
    if (!calSettingsOpen) return undefined;
    const close = (e: globalThis.MouseEvent) => {
      if (!(e.target as Element).closest('[data-cal-settings-panel]')) {
        setCalSettingsOpen(false);
      }
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [calSettingsOpen]);

  const openCreateDrawer = (date: Date, hour = 9) => {
    setSelectedDate(startOfDay(date));
    setDrawerMode('create');
    setDraft(getDefaultDraft(date, hour));
    setDrawerOpen(true);
  };

  const handleICSFileChange = useCallback((fileEvent: ChangeEvent<HTMLInputElement>) => {
    const file = fileEvent.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text !== 'string') return;
      try {
        const parsed = parseICSContent(text);
        if (parsed.length === 0) {
          setStatusMessage('No events found in the selected ICS file.');
          return;
        }
        const imported: CalendarEvent[] = parsed.map((ev) => ({
          id: `ics-${ev.uid}-${ev.start.getTime()}`,
          title: ev.title,
          start: ev.start.toISOString(),
          end: ev.end.toISOString(),
          allDay: false,
          source: 'ICS' as EventSource,
          detail: ev.description ?? '',
          location: ev.location ?? '',
          conferenceApp: '',
          syncState: 'local' as const,
          updatedAt: Date.now(),
        }));
        setEvents((current) => {
          const existingIds = new Set(current.map((ev) => ev.id));
          const fresh = imported.filter((ev) => !existingIds.has(ev.id));
          return sortEvents([...current, ...fresh]);
        });
        setStatusMessage(`Imported ${parsed.length} event${parsed.length === 1 ? '' : 's'} from ${file.name}.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setStatusMessage(`ICS import failed: ${message}`);
      } finally {
        // Reset so the same file can be re-selected
        if (icsFileInputRef.current) icsFileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  }, []);

  const openEditDrawer = (event: CalendarEvent) => {
    const eventStart = parseEventDate(event.start);
    setSelectedDate(startOfDay(eventStart));
    setSelectedEventId(event.id);
    setEventContextMenu(null);
    setDrawerMode('edit');
    setDraft(getDraftFromEvent(event));
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
  };

  const selectEvent = (event: CalendarEvent) => {
    setSelectedEventId(event.id);
    setSelectedDate(startOfDay(parseEventDate(event.start)));
    setEventContextMenu(null);
    setStatusMessage(`${event.title} selected. Double-click to edit, drag to move, or right-click for options.`);
  };

  const clearWeekSelection = () => {
    selectionAnchorRef.current = null;
    selectionDayRef.current = null;
    selectionHasMovedRef.current = false;
    setWeekSelection(null);
  };

  const clearMonthSelection = () => {
    monthSelectionAnchorRef.current = null;
    monthSelectionHasMovedRef.current = false;
    setMonthSelection(null);
  };

  const getOrderedMonthRange = (selection: MonthSelectionState) => {
    const [start, end] = clampDateRange(startOfDay(selection.start), startOfDay(selection.end));
    return { start, end };
  };

  const getOrderedWeekSelectionDays = (selection: WeekSelectionState) => {
    const [startDay, endDay] = clampDateRange(startOfDay(selection.startDay), startOfDay(selection.endDay));
    return { startDay, endDay };
  };

  const dateIsInMonthSelection = (date: Date) => {
    if (!monthSelection) return false;
    const { start, end } = getOrderedMonthRange(monthSelection);
    const day = startOfDay(date).getTime();
    return day >= start.getTime() && day <= end.getTime();
  };

  const dateIsInWeekSelection = (date: Date) => {
    if (!weekSelection) return false;
    const { startDay, endDay } = getOrderedWeekSelectionDays(weekSelection);
    const day = startOfDay(date).getTime();
    return day >= startDay.getTime() && day <= endDay.getTime();
  };

  const stampIdsForDate = (date: Date) => dayStamps[dateStampKey(date)] ?? [];

  const explicitStampIdsForEvent = (event: CalendarEvent) => eventStamps[event.id] ?? [];

  const stampIdsForEvent = (event: CalendarEvent, date = parseEventDate(event.start)) => (
    mergeStampIds(explicitStampIdsForEvent(event), stampIdsForDate(date))
  );

  const highlightedStampIds = useMemo(() => {
    const targetDate = selectedEvent ? parseEventDate(selectedEvent.start) : selectedDate;
    return new Set(mergeStampIds(
      stampIdsForDate(targetDate),
      selectedEvent ? explicitStampIdsForEvent(selectedEvent) : [],
    ));
  }, [dayStamps, eventStamps, selectedDate, selectedEvent]);
  const compactStampLimit = compactPanel ? compactTitlebarStampLimit(compactPanelWidth) : 0;
  const compactStampIds = useMemo(() => {
    if (compactStampLimit <= 0) return [];

    const ordered = activeStampId && !COMPACT_TITLEBAR_STAMP_PRIORITY.includes(activeStampId)
      ? [activeStampId, ...COMPACT_TITLEBAR_STAMP_PRIORITY]
      : COMPACT_TITLEBAR_STAMP_PRIORITY;

    return ordered.slice(0, compactStampLimit);
  }, [activeStampId, compactStampLimit]);

  const setDateStamp = (date: Date, stampId: CalendarStampId, action: 'add' | 'remove') => {
    const key = dateStampKey(date);
    const stamp = STAMP_BY_ID[stampId];

    setDayStamps((current) => {
      const existing = current[key] ?? [];
      if (action === 'remove') {
        const nextIds = existing.filter((id) => id !== stampId);
        const next = { ...current };
        if (nextIds.length > 0) {
          next[key] = nextIds;
        } else {
          delete next[key];
        }
        return next;
      }

      if (existing.includes(stampId)) {
        return current;
      }
      if (existing.length >= MAX_STAMPS_PER_DAY) {
        setStatusMessage(`${formatFullDate(date)} already has ${MAX_STAMPS_PER_DAY} stamps.`);
        return current;
      }

      return { ...current, [key]: [...existing, stampId] };
    });

    setStatusMessage(
      action === 'remove'
        ? `${stamp.label} removed from ${formatFullDate(date)}.`
        : `${stamp.label} stamped on ${formatFullDate(date)}.`,
    );
  };

  const startDateStampDrag = (date: Date, event: MouseEvent<HTMLElement>) => {
    if (!activeStampId || event.button !== 0) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    const existing = stampIdsForDate(date).includes(activeStampId);
    const action: 'add' | 'remove' = existing ? 'remove' : 'add';
    stampDragActionRef.current = action;
    setStampDragActive(true);
    setDateStamp(date, activeStampId, action);
    setSelectedDate(startOfDay(date));
    return true;
  };

  const continueDateStampDrag = (date: Date, event: MouseEvent<HTMLElement>) => {
    if (!activeStampId || !stampDragActionRef.current || event.buttons !== 1) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    setDateStamp(date, activeStampId, stampDragActionRef.current);
    return true;
  };

  const toggleActiveStamp = (stampId: CalendarStampId) => {
    setActiveStampId((current) => {
      const next = current === stampId ? null : stampId;
      setStatusMessage(
        next
          ? `${STAMP_BY_ID[next].label} stamp mode is on. Click or drag days, or click events, to tag them.`
          : 'Stamp mode is off.',
      );
      return next;
    });
  };

  const clearActiveStamp = () => {
    setActiveStampId(null);
    stampDragActionRef.current = null;
    setStampDragActive(false);
    setStatusMessage('Stamp mode is off.');
  };

  const clearStampIfActive = (stampId: CalendarStampId) => {
    setActiveStampId((current) => (current === stampId ? null : current));
  };

  const toggleEventStamp = (event: CalendarEvent, stampId: CalendarStampId) => {
    const stamp = STAMP_BY_ID[stampId];
    setEventStamps((current) => {
      const existing = current[event.id] ?? [];
      const next = { ...current };

      if (existing.includes(stampId)) {
        const nextIds = existing.filter((id) => id !== stampId);
        if (nextIds.length > 0) {
          next[event.id] = nextIds;
        } else {
          delete next[event.id];
        }
        setStatusMessage(`${stamp.label} removed from ${event.title}.`);
        return next;
      }

      if (existing.length >= MAX_STAMPS_PER_DAY) {
        setStatusMessage(`${event.title} already has ${MAX_STAMPS_PER_DAY} explicit event stamps.`);
        return current;
      }

      next[event.id] = [...existing, stampId];
      setStatusMessage(`${stamp.label} stamped on ${event.title}.`);
      return next;
    });
  };

  const handleStampBankClick = (stampId: CalendarStampId) => {
    // The bank only arms/disarms the active stamp "brush". Apply a stamp by clicking a day or
    // event; remove a placed stamp by clicking its badge on the item. The bank must never strip a
    // stamp off the selected day/event — that wiped the stamp you'd just applied when you clicked
    // to put the tool away.
    toggleActiveStamp(stampId);
  };

  const renderCompactStampStrip = () => {
    if (!compactPanel || compactStampIds.length === 0) return null;

    return (
      <div
        className="flex min-w-0 shrink-0 items-center gap-0.5"
        aria-label="Compact calendar stamps"
        data-calendar-compact-stamp-strip="true"
        data-calendar-compact-stamp-count={compactStampIds.length}
      >
        {compactStampIds.map((stampId) => {
          const stamp = STAMP_BY_ID[stampId];
          const Icon = stamp.icon;
          const active = activeStampId === stamp.id;
          const used = highlightedStampIds.has(stamp.id);
          const label = `${active ? 'Turn off' : 'Use'} ${stamp.label} stamp brush`;

          return (
            <button
              key={stamp.id}
              type="button"
              onClick={() => handleStampBankClick(stamp.id)}
              aria-label={label}
              aria-pressed={active}
              title={used ? `${stamp.label} is on the selected item — remove it from its badge` : `${stamp.label}${active ? ' brush on' : ''}`}
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-transform hover:scale-105',
                active || used ? 'scale-105 opacity-100 ring-2 ring-accent/45' : 'opacity-85 hover:opacity-100',
              )}
              style={{
                color: stamp.color,
                borderColor: stamp.ring,
                backgroundColor: stamp.softBackground,
                boxShadow: used ? `0 0 0 2px ${stamp.ring}, 0 0 14px ${stamp.ring}` : undefined,
              }}
            >
              <Icon size={12} strokeWidth={2.35} />
            </button>
          );
        })}
      </div>
    );
  };

  const removeDateStampFromBadge = (date: Date) => (stampId: CalendarStampId, event: StampInteractionEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDateStamp(date, stampId, 'remove');
    clearStampIfActive(stampId);
  };

  const removeEventStampFromBadge = (calendarEvent: CalendarEvent, date = parseEventDate(calendarEvent.start)) => (
    stampId: CalendarStampId,
    event: StampInteractionEvent,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (explicitStampIdsForEvent(calendarEvent).includes(stampId)) {
      toggleEventStamp(calendarEvent, stampId);
      clearStampIfActive(stampId);
      return;
    }

    if (stampIdsForDate(date).includes(stampId)) {
      setDateStamp(date, stampId, 'remove');
      clearStampIfActive(stampId);
    }
  };

  const startEventResize = (
    calendarEvent: CalendarEvent,
    edge: EventResizeState['edge'],
    mouseEvent: MouseEvent<HTMLElement>,
  ) => {
    mouseEvent.preventDefault();
    mouseEvent.stopPropagation();
    const originalStart = parseEventDate(calendarEvent.start);
    const originalEnd = parseEventDate(calendarEvent.end);
    eventResizeRef.current = {
      eventId: calendarEvent.id,
      edge,
      day: startOfDay(originalStart),
      originalStart,
      originalEnd,
    };
    setSelectedEventId(calendarEvent.id);
    setStatusMessage(edge === 'start' ? 'Drag the top edge to adjust the start time.' : 'Drag the bottom edge to adjust the end time.');
  };

  const renderStampBadges = (
    stampIds: CalendarStampId[],
    compact = false,
    onRemove?: (stampId: CalendarStampId, event: StampInteractionEvent) => void,
  ) => {
    if (stampIds.length === 0) return null;

    return (
      <div className="flex min-w-0 items-center gap-0.5" aria-label={getStampTooltip(stampIds)}>
        {stampIds.slice(0, MAX_STAMPS_PER_DAY).map((stampId) => {
          const stamp = STAMP_BY_ID[stampId];
          const Icon = stamp.icon;
          return (
            <span
              key={stamp.id}
              title={onRemove ? `Remove ${stamp.label}` : stamp.label}
              role={onRemove ? 'button' : undefined}
              tabIndex={onRemove ? 0 : undefined}
              onMouseDown={onRemove ? (event) => {
                event.preventDefault();
                event.stopPropagation();
              } : undefined}
              onClick={onRemove ? (event) => onRemove(stamp.id, event) : undefined}
              onKeyDown={onRemove ? (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
                onRemove(stamp.id, event);
              } : undefined}
              className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-full border',
                compact ? 'h-4 w-4' : 'h-5 w-5',
                onRemove && 'cursor-pointer transition-transform hover:scale-110 hover:ring-2 hover:ring-current/25 focus:outline-none focus:ring-2 focus:ring-current/35',
              )}
              style={{
                color: stamp.color,
                borderColor: stamp.ring,
                backgroundColor: stamp.softBackground,
              }}
            >
              <Icon size={compact ? 10 : 12} strokeWidth={2.3} />
            </span>
          );
        })}
      </div>
    );
  };

  const resolveCalendarDateFromPointer = (clientX: number, clientY: number) => {
    if (typeof document === 'undefined') return null;
    const cell = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>('[data-calendar-date]');
    const dateValue = cell?.dataset.calendarDate;
    return dateValue ? fromDateInputValue(dateValue) : null;
  };

  useEffect(() => {
    if (!stampDragActive || !activeStampId) {
      return undefined;
    }

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      if (!stampDragActionRef.current || event.buttons !== 1) {
        return;
      }

      const date = resolveCalendarDateFromPointer(event.clientX, event.clientY);
      if (!date) {
        return;
      }

      event.preventDefault();
      setDateStamp(date, activeStampId, stampDragActionRef.current);
      setSelectedDate(startOfDay(date));
    };

    const handleMouseUp = () => {
      stampDragActionRef.current = null;
      setStampDragActive(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeStampId, stampDragActive]);

  const handleAssistantSubmit = () => {
    setAssistantPreview(resolvePreview(assistantInput));
  };

  const handleAssistantKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    handleAssistantSubmit();
  };

  const setDraftField = <K extends keyof EventDraft>(field: K, value: EventDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const saveDraft = () => {
    if (!draft.title.trim()) {
      setStatusMessage('Add a title before saving the event.');
      return;
    }

    const rawStart = draft.allDay ? combineDateTime(draft.startDate, '00:00') : combineDateTime(draft.startDate, draft.startTime);
    const rawEnd = draft.allDay ? combineDateTime(draft.endDate, '23:59') : combineDateTime(draft.endDate, draft.endTime);
    const [start, end] = clampDateRange(rawStart, rawEnd);

    if (drawerMode === 'edit' && draft.id) {
      setEvents((current) => sortEvents(current.map((event) => (
        event.id === draft.id
          ? {
            ...event,
            title: draft.title.trim(),
            start: start.toISOString(),
            end: end.toISOString(),
            allDay: draft.allDay,
            source: draft.source,
            detail: draft.detail.trim(),
            location: draft.location.trim(),
            conferenceApp: draft.conferenceApp.trim(),
            syncState: event.remoteId ? 'dirty' : 'local',
            updatedAt: Date.now(),
          }
          : event
      ))));
      setStatusMessage(`Updated ${draft.title.trim()}.`);
      closeDrawer();
      return;
    }

    const occurrences = draft.repeatMode === 'none' ? 1 : Math.max(1, draft.repeatCount);
    const step = repeatStep(draft.repeatMode);
    const createdEvents = Array.from({ length: occurrences }, (_, index) => {
      const startAt = addDays(start, index * step);
      const endAt = addDays(end, index * step);
      return {
        id: `event-${Date.now()}-${index}`,
        title: draft.title.trim(),
        start: startAt.toISOString(),
        end: endAt.toISOString(),
        allDay: draft.allDay,
        source: draft.source,
        detail: draft.detail.trim(),
        location: draft.location.trim(),
        conferenceApp: draft.conferenceApp.trim(),
        syncState: 'local',
        updatedAt: Date.now(),
      } satisfies CalendarEvent;
    });

    setEvents((current) => sortEvents([...current, ...createdEvents]));
    setSelectedDate(startOfDay(start));
    setDisplayDate(startOfMonth(start));
    setStatusMessage(
      draft.repeatMode === 'none'
        ? `Added ${draft.title.trim()}.`
        : `Added ${occurrences} ${draft.repeatMode} ${occurrences === 1 ? 'event' : 'events'} for ${draft.title.trim()}.`,
    );
    closeDrawer();
  };

  const createProvisionalEvent = (start: Date, end: Date, title = 'New event') => {
    const normalizedEnd = end.getTime() > start.getTime()
      ? end
      : addMinutes(start, DEFAULT_EVENT_DURATION_MINUTES);
    const event: CalendarEvent = {
      id: `event-${Date.now()}-${Math.round(start.getTime() / 1000)}`,
      title,
      start: start.toISOString(),
      end: normalizedEnd.toISOString(),
      allDay: false,
      source: 'ThreatCaddy Work',
      detail: '',
      location: '',
      conferenceApp: '',
      syncState: 'local',
      updatedAt: Date.now(),
    };

    setEvents((current) => sortEvents([...current, event]));
    setSelectedEventId(event.id);
    setSelectedDate(startOfDay(start));
    setDisplayDate(startOfMonth(start));
    setStatusMessage('New event placed. Drag it to move, grab the top or bottom edge to resize, or double-click to edit details.');
    return event;
  };

  const createProvisionalAllDayEvent = (start: Date, end: Date, title = 'New event') => {
    const [rangeStart, rangeEnd] = clampDateRange(startOfDay(start), startOfDay(end));
    const event: CalendarEvent = {
      id: `event-${Date.now()}-${Math.round(rangeStart.getTime() / 1000)}`,
      title,
      start: rangeStart.toISOString(),
      end: createDate(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate(), 23, 59).toISOString(),
      allDay: true,
      source: 'ThreatCaddy Work',
      detail: '',
      location: '',
      conferenceApp: '',
      syncState: 'local',
      updatedAt: Date.now(),
    };

    setEvents((current) => sortEvents([...current, event]));
    setSelectedEventId(event.id);
    setSelectedDate(rangeStart);
    setDisplayDate(startOfMonth(rangeStart));
    setStatusMessage(`${title} placed across ${formatFullDate(rangeStart)} through ${formatFullDate(rangeEnd)}. Double-click to edit details.`);
    return event;
  };

  const deleteDraftEvent = () => {
    if (!draft.id) {
      closeDrawer();
      return;
    }

    const removedDraft = events.find((e) => e.id === draft.id);
    if (removedDraft?.remoteId && removedDraft.syncAccountId) {
      const { remoteId, syncAccountId } = removedDraft;
      setPendingDeletions((cur) => [...cur, { remoteId, syncAccountId }]);
    }
    setEvents((current) => current.filter((event) => event.id !== draft.id));
    setEventStamps((current) => {
      const next = { ...current };
      delete next[draft.id!];
      return next;
    });
    setSelectedEventId((current) => (current === draft.id ? null : current));
    setStatusMessage(`Removed ${draft.title.trim()}.`);
    closeDrawer();
  };

  const deleteEvent = (eventId: string) => {
    const event = events.find((item) => item.id === eventId);
    if (event?.remoteId && event.syncAccountId) {
      const { remoteId, syncAccountId } = event;
      setPendingDeletions((cur) => [...cur, { remoteId, syncAccountId }]);
    }
    setEvents((current) => current.filter((item) => item.id !== eventId));
    setEventStamps((current) => {
      const next = { ...current };
      delete next[eventId];
      return next;
    });
    setSelectedEventId((current) => (current === eventId ? null : current));
    setEventContextMenu(null);
    setStatusMessage(event ? `Removed ${event.title}.` : 'Removed event.');
  };

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (eventContextMenu) {
          event.preventDefault();
          setEventContextMenu(null);
          return;
        }

        if (drawerOpen) {
          event.preventDefault();
          closeDrawer();
          return;
        }

        if (weekSelection) {
          event.preventDefault();
          clearWeekSelection();
          setStatusMessage('Week selection cleared.');
          return;
        }

        if (monthSelection) {
          event.preventDefault();
          clearMonthSelection();
          setStatusMessage('Month selection cleared.');
          return;
        }

        if (activeStampId) {
          event.preventDefault();
          clearActiveStamp();
        }

        return;
      }

      if (isEditableTarget(event.target) || drawerOpen) {
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedEvent) {
        event.preventDefault();
        deleteEvent(selectedEvent.id);
        return;
      }

      if (event.key === 'Enter' && selectedEvent && !eventContextMenu && !isNativeActionTarget(event.target)) {
        event.preventDefault();
        openEditDrawer(selectedEvent);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeStampId, drawerOpen, eventContextMenu, monthSelection, selectedEvent, weekSelection, events]);

  const handleNavigate = useCallback((direction: -1 | 1) => {
    if (viewMode === 'week') {
      const nextWeek = addDays(weekStart, direction * 7);
      setSelectedDate(nextWeek);
      setDisplayDate(startOfMonth(nextWeek));
      return;
    }

    if (viewMode === 'year') {
      const nextYear = addYears(displayDate, direction);
      setDisplayDate(nextYear);
      return;
    }

    const nextMonth = addMonths(displayDate, direction);
    setDisplayDate(nextMonth);
    if (!sameMonth(selectedDate, nextMonth)) {
      setSelectedDate(startOfMonth(nextMonth));
    }
  }, [displayDate, selectedDate, viewMode, weekStart]);

  const handleToday = useCallback(() => {
    setSelectedDate(startOfDay(today));
    setDisplayDate(startOfMonth(today));
  }, [today]);

  const moveEventToSlot = (eventId: string, nextStart: Date, status = 'Moved event to a new time slot.') => {
    setEvents((current) => sortEvents(current.map((event) => {
      if (event.id !== eventId) {
        return event;
      }

      const originalStart = parseEventDate(event.start);
      const duration = parseEventDate(event.end).getTime() - originalStart.getTime();
      const nextEnd = new Date(nextStart.getTime() + duration);
      return {
        ...event,
        start: nextStart.toISOString(),
        end: nextEnd.toISOString(),
        allDay: false,
        syncState: event.remoteId ? 'dirty' : 'local',
        updatedAt: Date.now(),
      };
    })));
    setSelectedEventId(eventId);
    setSelectedDate(startOfDay(nextStart));
    setStatusMessage(status);
  };

  const moveEventToDayPreservingTime = (eventId: string, date: Date, originalStart: Date) => {
    const nextStart = createDate(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      originalStart.getHours(),
      originalStart.getMinutes(),
    );
    moveEventToSlot(eventId, nextStart, `Moved event to ${formatFullDate(date)} with its original start time.`);
  };

  const resolveSlotTimeFromElement = (date: Date, hour: number, target: HTMLElement, clientY: number) => {
    const rect = target.getBoundingClientRect();
    const fallbackHeight = density.slotHeight;
    const height = rect.height || fallbackHeight;
    const rawOffsetY = clientY - rect.top;
    const offsetY = clampNumber(Number.isFinite(rawOffsetY) ? rawOffsetY : 0, 0, Math.max(height - 1, 0));
    const rawMinutes = Math.floor((offsetY / Math.max(height, 1)) * 60);
    const snappedMinutes = clampNumber(floorToSnap(rawMinutes, weekSnapMinutes), 0, 60 - weekSnapMinutes);
    return createDate(date.getFullYear(), date.getMonth(), date.getDate(), hour, snappedMinutes);
  };

  const resolveSlotTime = (date: Date, hour: number, event: MouseEvent<HTMLElement> | DragEvent<HTMLElement>) => (
    resolveSlotTimeFromElement(date, hour, event.currentTarget, event.clientY)
  );

  const updateWeekSelectionAtPoint = (date: Date, hour: number, target: HTMLElement, clientY: number) => {
    if (eventResizeRef.current) {
      const resize = eventResizeRef.current;
      if (!sameDay(resize.day, date)) {
        return;
      }

      const point = clampTimeToDay(resolveSlotTimeFromElement(date, hour, target, clientY), resize.day);
      setEvents((current) => sortEvents(current.map((calendarEvent) => {
        if (calendarEvent.id !== resize.eventId) {
          return calendarEvent;
        }

        if (resize.edge === 'start') {
          const latestStart = addMinutes(resize.originalEnd, -weekSnapMinutes);
          const nextStart = point.getTime() < latestStart.getTime() ? point : latestStart;
          return { ...calendarEvent, start: nextStart.toISOString(), allDay: false, syncState: calendarEvent.remoteId ? 'dirty' : 'local', updatedAt: Date.now() };
        }

        const earliestEnd = addMinutes(resize.originalStart, weekSnapMinutes);
        const nextEnd = point.getTime() > earliestEnd.getTime() ? point : earliestEnd;
        return { ...calendarEvent, end: nextEnd.toISOString(), allDay: false, syncState: calendarEvent.remoteId ? 'dirty' : 'local', updatedAt: Date.now() };
      })));
      setStatusMessage('Resizing selected event.');
      return;
    }

    const anchor = selectionAnchorRef.current;
    const activeDay = selectionDayRef.current;
    if (!anchor || !activeDay) {
      return;
    }

    const hoveredDay = startOfDay(date);
    const nextPoint = clampTimeToDay(resolveSlotTimeFromElement(date, hour, target, clientY), hoveredDay);
    const nextPointOnAnchorDay = cloneTimeOnDay(activeDay, nextPoint);
    selectionHasMovedRef.current = true;
    setSelectedDate(hoveredDay);

    const nextState = nextPointOnAnchorDay.getTime() <= anchor.getTime()
      ? {
        startDay: activeDay,
        endDay: hoveredDay,
        start: nextPointOnAnchorDay,
        end: anchor,
      }
      : {
        startDay: activeDay,
        endDay: hoveredDay,
        start: anchor,
        end: nextPointOnAnchorDay,
      };

    if (sameDay(activeDay, hoveredDay)) {
      setWeekSelection(nextState);
      return;
    }

    const { startDay, endDay } = getOrderedWeekSelectionDays(nextState);
    setStatusMessage(`Selection spans ${formatFullDate(startDay)} through ${formatFullDate(endDay)} at the selected time range.`);
    setWeekSelection(nextState);
  };

  const startWeekSelection = (date: Date, hour: number, event: MouseEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();

    const day = startOfDay(date);
    const anchor = clampTimeToDay(resolveSlotTime(date, hour, event), day);
    const initialEnd = clampTimeToDay(addMinutes(anchor, DEFAULT_EVENT_DURATION_MINUTES), day);

    suppressWeekCellClickRef.current = true;
    selectionAnchorRef.current = anchor;
    selectionDayRef.current = day;
    selectionHasMovedRef.current = false;
    setSelectedDate(day);
    setWeekSelection({
      startDay: day,
      endDay: day,
      start: anchor,
      end: initialEnd.getTime() > anchor.getTime() ? initialEnd : addMinutes(anchor, weekSnapMinutes),
    });
  };

  const startMonthSelection = (date: Date, event: MouseEvent<HTMLElement>) => {
    if (activeStampId || event.button !== 0) {
      return false;
    }

    event.preventDefault();
    const day = startOfDay(date);
    suppressMonthCellClickRef.current = true;
    monthSelectionAnchorRef.current = day;
    monthSelectionHasMovedRef.current = false;
    setSelectedDate(day);
    setMonthSelection({ start: day, end: day });
    setStatusMessage('Drag across month cells to create an all-day New event range.');
    return true;
  };

  const updateWeekSelection = (date: Date, hour: number, event: MouseEvent<HTMLElement>) => {
    if (event.buttons !== 1) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    updateWeekSelectionAtPoint(date, hour, event.currentTarget, event.clientY);
  };

  const resolveWeekCellFromPointer = (clientX: number, clientY: number) => {
    if (typeof document === 'undefined') return null;
    const cell = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>('[data-calendar-week-cell="true"]');
    if (!cell) return null;

    const dateValue = cell.dataset.calendarDate;
    const hourValue = cell.dataset.calendarHour;
    if (!dateValue || !hourValue) return null;

    const hour = Number(hourValue);
    if (!Number.isFinite(hour)) return null;
    return { cell, date: fromDateInputValue(dateValue), hour };
  };

  const updateWeekSelectionFromPointer = (event: globalThis.MouseEvent) => {
    if (event.buttons !== 1) {
      return;
    }

    const target = resolveWeekCellFromPointer(event.clientX, event.clientY);
    if (!target) {
      return;
    }

    event.preventDefault();
    updateWeekSelectionAtPoint(target.date, target.hour, target.cell, event.clientY);
  };

  const updateEventResizeFromPointer = (event: globalThis.MouseEvent) => {
    if (!eventResizeRef.current || event.buttons !== 1) {
      return;
    }

    const target = resolveWeekCellFromPointer(event.clientX, event.clientY);
    if (!target) {
      return;
    }

    event.preventDefault();
    updateWeekSelectionAtPoint(target.date, target.hour, target.cell, event.clientY);
  };

  const updateMonthSelectionAtDate = (date: Date) => {
    const anchor = monthSelectionAnchorRef.current;
    if (!anchor) {
      return;
    }

    const day = startOfDay(date);
    monthSelectionHasMovedRef.current = monthSelectionHasMovedRef.current || !sameDay(anchor, day);
    setSelectedDate(day);
    setMonthSelection({ start: anchor, end: day });
  };

  const updateMonthSelection = (date: Date, event: MouseEvent<HTMLElement>) => {
    if (!monthSelectionAnchorRef.current || event.buttons !== 1) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    updateMonthSelectionAtDate(date);
    return true;
  };

  const resolveMonthCellFromPointer = (clientX: number, clientY: number) => {
    if (typeof document === 'undefined') return null;
    const cell = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>('[data-calendar-month-cell="true"]');
    const dateValue = cell?.dataset.calendarDate;
    return dateValue ? fromDateInputValue(dateValue) : null;
  };

  const updateMonthSelectionFromPointer = (event: globalThis.MouseEvent) => {
    if (!monthSelectionAnchorRef.current || event.buttons !== 1) {
      return;
    }

    const date = resolveMonthCellFromPointer(event.clientX, event.clientY);
    if (!date) {
      return;
    }

    event.preventDefault();
    updateMonthSelectionAtDate(date);
  };

  const finalizeMonthSelection = () => {
    const anchor = monthSelectionAnchorRef.current;
    if (!monthSelection || !anchor) {
      clearMonthSelection();
      window.setTimeout(() => {
        suppressMonthCellClickRef.current = false;
      }, 0);
      return;
    }

    const { start, end } = getOrderedMonthRange(monthSelection);
    if (monthSelectionHasMovedRef.current && !sameDay(start, end)) {
      createProvisionalAllDayEvent(start, end);
    } else {
      setSelectedDate(anchor);
      setStatusMessage(`${formatFullDate(anchor)} selected. Drag across month cells to create an all-day range.`);
    }

    clearMonthSelection();
    window.setTimeout(() => {
      suppressMonthCellClickRef.current = false;
    }, 0);
  };

  const finalizeWeekSelection = () => {
    const activeDay = selectionDayRef.current;
    if (!weekSelection || !activeDay) {
      clearWeekSelection();
      window.setTimeout(() => {
        suppressWeekCellClickRef.current = false;
      }, 0);
      return;
    }

    const { startDay, endDay } = getOrderedWeekSelectionDays(weekSelection);
    const normalizedStart = weekSelection.start;
    const normalizedEnd = selectionHasMovedRef.current
      ? weekSelection.end
      : addMinutes(normalizedStart, DEFAULT_EVENT_DURATION_MINUTES);
    const days: Date[] = [];

    for (let cursor = startDay; cursor.getTime() <= endDay.getTime(); cursor = addDays(cursor, 1)) {
      days.push(cursor);
    }

    const createdEvents = days.map((day) => {
      const start = clampTimeToDay(cloneTimeOnDay(day, normalizedStart), day);
      const rawEnd = cloneTimeOnDay(day, normalizedEnd);
      const end = rawEnd.getTime() > start.getTime()
        ? clampTimeToDay(rawEnd, day)
        : clampTimeToDay(addMinutes(start, weekSnapMinutes), day);
      return createProvisionalEvent(start, end);
    });

    if (days.length > 1) {
      setStatusMessage(`${createdEvents[0]?.title ?? 'New event'} placed across ${days.length} days from ${formatFullDate(startDay)} through ${formatFullDate(endDay)}.`);
    } else {
      setStatusMessage(
        selectionHasMovedRef.current
          ? `${createdEvents[0]?.title ?? 'New event'} placed from the dragged ${weekSnapMinutes}-minute snapped time range.`
          : `${createdEvents[0]?.title ?? 'New event'} placed as a 30-minute time block.`,
      );
    }

    clearWeekSelection();
    window.setTimeout(() => {
      suppressWeekCellClickRef.current = false;
    }, 0);
  };

  useEffect(() => {
    if (!selectionAnchorRef.current) {
      return undefined;
    }

    const handleMouseUp = () => {
      finalizeWeekSelection();
    };

    window.addEventListener('mousemove', updateWeekSelectionFromPointer);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', updateWeekSelectionFromPointer);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [weekSelection, weekSnapMinutes]);

  useEffect(() => {
    if (!monthSelectionAnchorRef.current) {
      return undefined;
    }

    const handleMouseUp = () => {
      finalizeMonthSelection();
    };

    window.addEventListener('mousemove', updateMonthSelectionFromPointer);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', updateMonthSelectionFromPointer);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [monthSelection]);

  useEffect(() => {
    if (!eventResizeRef.current) {
      return undefined;
    }

    const handleMouseUp = () => {
      eventResizeRef.current = null;
      setStatusMessage('Event resized. Double-click to edit details or drag again to adjust.');
    };

    window.addEventListener('mousemove', updateEventResizeFromPointer);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', updateEventResizeFromPointer);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [events]);

  const renderMonthCell = (date: Date) => {
    const dayEvents = sortEvents(events.filter((event) => eventOccursOnDate(event, date)));
    const visibleEvents = dayEvents.slice(0, density.maxMonthEvents);
    const isCurrentMonth = sameMonth(date, displayDate);
    const isSelectedDay = sameDay(date, selectedDate);
    const isToday = sameDay(date, today);
    const isInMonthSelection = dateIsInMonthSelection(date);
    const stamps = stampIdsForDate(date);

    return (
      <div
        key={date.toISOString()}
        data-calendar-month-cell="true"
        data-calendar-date={toDateInputValue(date)}
        onMouseDown={(event) => {
          if (startDateStampDrag(date, event)) return;
          startMonthSelection(date, event);
        }}
        onMouseEnter={(event) => {
          if (continueDateStampDrag(date, event)) return;
          updateMonthSelection(date, event);
        }}
        onMouseMove={(event) => {
          if (continueDateStampDrag(date, event)) return;
          updateMonthSelection(date, event);
        }}
        title={getStampTooltip(stamps)}
        className={cn(
          'relative border border-border-subtle bg-bg-primary/55 text-left align-top transition-colors hover:border-border-medium hover:bg-bg-hover',
          density.monthCell,
          isCurrentMonth ? 'text-text-primary' : 'text-text-muted/80',
          isSelectedDay && 'border-accent/30 bg-accent/10',
          isInMonthSelection && 'border-accent/45 bg-accent/12 ring-1 ring-accent/25 ring-inset',
          isToday && 'ring-1 ring-accent/35 ring-inset',
          activeStampId && 'cursor-copy',
          monthSelection && !activeStampId && 'cursor-crosshair',
        )}
        style={getStampOutlineStyle(stamps)}
      >
        <button
          type="button"
          onClick={(event) => {
            if (activeStampId) {
              event.preventDefault();
              return;
            }
            if (suppressMonthCellClickRef.current) {
              event.preventDefault();
              suppressMonthCellClickRef.current = false;
              return;
            }
            setSelectedDate(startOfDay(date));
          }}
          onMouseDown={(event) => {
            if (startDateStampDrag(date, event)) return;
            startMonthSelection(date, event);
            event.stopPropagation();
          }}
          aria-label={`Select ${formatFullDate(date)}${stamps.length ? `, ${getStampTooltip(stamps)}` : ''}`}
          className="absolute inset-0 z-0 rounded-none focus:outline-none focus:ring-1 focus:ring-accent/40"
        />
        <div className="relative z-10 flex items-start justify-between gap-2 pointer-events-none">
          <span
            className={cn(
              'font-semibold',
              density.dayNumber,
              isSelectedDay && cn('inline-flex items-center justify-center rounded-full bg-accent text-white', density.dayNumberSelected),
              !isSelectedDay && isToday && 'text-accent',
            )}
          >
            {date.getDate()}
          </span>
          <div className="min-w-0 flex-1 pt-0.5 pointer-events-auto">
            {renderStampBadges(stamps, true, removeDateStampFromBadge(date))}
          </div>
          <button
            type="button"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              openCreateDrawer(date);
            }}
            aria-label={`Add event on ${formatFullDate(date)}`}
            className={cn(
              'pointer-events-auto flex items-center justify-center rounded-full border border-border-subtle bg-bg-primary/70 text-text-muted transition-colors hover:border-border-medium hover:bg-bg-hover hover:text-text-primary',
              density.cellAdd,
            )}
          >
            <Plus size={12} />
          </button>
        </div>

        <div className="relative z-10 mt-1">
          {visibleEvents.map((event) => (
            (() => {
              const eventStampIds = stampIdsForEvent(event, date);
              return (
            <div
              key={`${date.toISOString()}-${event.id}`}
              className="relative"
            >
              {eventStampIds.length > 0 && (
                <div className="absolute left-1 top-1 z-20">
                  {renderStampBadges(eventStampIds, true, removeEventStampFromBadge(event, date))}
                </div>
              )}
              <button
                type="button"
                onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  if (activeStampId) {
                    toggleEventStamp(event, activeStampId);
                    return;
                  }
                  selectEvent(event);
                }}
                onDoubleClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  openEditDrawer(event);
                }}
                onContextMenu={(menuEvent) => {
                  menuEvent.preventDefault();
                  menuEvent.stopPropagation();
                  selectEvent(event);
                  setEventContextMenu({ eventId: event.id, x: menuEvent.clientX, y: menuEvent.clientY });
                }}
                aria-label={`Select event ${event.title}`}
                title={getStampTooltip(eventStampIds)}
                className={cn(
                  'block w-full border text-left font-medium',
                  density.monthEvent,
                  eventStampIds.length > 0 && 'pl-6',
                  selectedEventId === event.id && 'ring-1 ring-accent/45',
                )}
                style={{
                  color: SOURCE_STYLES[event.source].color,
                  backgroundColor: SOURCE_STYLES[event.source].softBackground,
                  borderColor: SOURCE_STYLES[event.source].ring,
                  ...getStampOutlineStyle(eventStampIds),
                }}
              >
                <span className="block min-w-0 flex-1 truncate">
                  {event.allDay ? event.title : `${formatTimeRange(event).split(' – ')[0]} ${event.title}`}
                </span>
              </button>
            </div>
              );
            })()
          ))}
          {dayEvents.length > visibleEvents.length && (
            <div className={cn('font-medium text-text-muted', density.monthMore)}>
              +{dayEvents.length - visibleEvents.length} more
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderWeekTimedCell = (date: Date, hour: number) => {
    const slotEvents = sortEvents(events.filter((event) => {
      if (event.allDay) return false;
      const start = parseEventDate(event.start);
      return sameDay(start, date) && start.getHours() === hour;
    }));
    const slotStart = createDate(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0);
    const slotEnd = addMinutes(slotStart, 60);
    const selectionPreview = weekSelection && dateIsInWeekSelection(date)
      ? (() => {
        const selectionStart = cloneTimeOnDay(date, weekSelection.start);
        const selectionEnd = cloneTimeOnDay(date, weekSelection.end);
        const overlapStart = Math.max(slotStart.getTime(), selectionStart.getTime());
        const overlapEnd = Math.min(slotEnd.getTime(), selectionEnd.getTime());
        if (overlapEnd <= overlapStart) {
          return null;
        }

        const offsetMinutes = (overlapStart - slotStart.getTime()) / 60000;
        const overlapMinutes = (overlapEnd - overlapStart) / 60000;
        return {
          top: Math.round((offsetMinutes / 60) * density.slotHeight) + 2,
          height: Math.max(8, Math.round((overlapMinutes / 60) * density.slotHeight) - 4),
        };
      })()
      : null;

    return (
      <div
        key={`${date.toISOString()}-${hour}`}
        data-calendar-week-cell="true"
        data-calendar-date={toDateInputValue(date)}
        data-calendar-hour={hour}
        onMouseDown={(event) => {
          if (startDateStampDrag(date, event)) return;
          startWeekSelection(date, hour, event);
        }}
        onMouseEnter={(event) => {
          if (continueDateStampDrag(date, event)) return;
          updateWeekSelection(date, hour, event);
        }}
        onMouseMove={(event) => {
          if (continueDateStampDrag(date, event)) return;
          updateWeekSelection(date, hour, event);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const draggedId = event.dataTransfer.getData('text/plain') || draggingEventId;
          if (draggedId) {
            const originalStart = draggedEventStartRef.current;
            if (originalStart && !sameDay(originalStart, date)) {
              moveEventToDayPreservingTime(draggedId, date, originalStart);
            } else {
              moveEventToSlot(draggedId, resolveSlotTime(date, hour, event));
            }
          }
          setDraggingEventId(null);
          draggedEventStartRef.current = null;
        }}
        className={cn(
          'relative border-t border-l border-border-subtle bg-bg-primary/48 transition-colors hover:bg-bg-hover/60',
          density.weekSlot,
          selectionPreview && 'bg-accent/5',
          sameDay(date, selectedDate) && 'bg-accent/5',
        )}
      >
        <button
          type="button"
          onClick={(event) => {
            if (activeStampId) {
              event.preventDefault();
              return;
            }
            if (suppressWeekCellClickRef.current) {
              event.preventDefault();
              suppressWeekCellClickRef.current = false;
              return;
            }
            const start = createDate(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0);
            createProvisionalEvent(start, addMinutes(start, DEFAULT_EVENT_DURATION_MINUTES));
          }}
          onDoubleClick={(event) => {
            event.preventDefault();
            openCreateDrawer(date, hour);
          }}
          onMouseDown={(event) => {
            if (startDateStampDrag(date, event)) return;
            startWeekSelection(date, hour, event);
          }}
          aria-label={`Add event on ${formatFullDate(date)} at ${formatHourLabel(hour)}`}
          className="absolute inset-0 z-0 focus:outline-none focus:ring-1 focus:ring-accent/40"
        />
        {selectionPreview && (
          <div
            className="pointer-events-none absolute left-1 right-1 z-[1] rounded-md border border-accent/35 bg-accent/14"
            style={{
              top: selectionPreview.top,
              height: selectionPreview.height,
            }}
          />
        )}
        {slotEvents.map((event) => {
          const start = parseEventDate(event.start);
          const duration = getEventDurationMinutes(event);
          const top = Math.round((start.getMinutes() / 60) * density.slotHeight) + 2;
          const height = Math.max(20, Math.round((duration / 60) * density.slotHeight) - 4);
          const eventStampIds = stampIdsForEvent(event, date);
          return (
            <button
              key={event.id}
              type="button"
              draggable
              onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
              onDragStart={(dragEvent: DragEvent<HTMLButtonElement>) => {
                dragEvent.dataTransfer.setData('text/plain', event.id);
                setDraggingEventId(event.id);
                draggedEventStartRef.current = parseEventDate(event.start);
              }}
              onDragEnd={() => {
                setDraggingEventId(null);
                draggedEventStartRef.current = null;
              }}
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                if (activeStampId) {
                  toggleEventStamp(event, activeStampId);
                  return;
                }
                selectEvent(event);
              }}
              onDoubleClick={(clickEvent) => {
                clickEvent.stopPropagation();
                openEditDrawer(event);
              }}
              onContextMenu={(menuEvent) => {
                menuEvent.preventDefault();
                menuEvent.stopPropagation();
                selectEvent(event);
                setEventContextMenu({ eventId: event.id, x: menuEvent.clientX, y: menuEvent.clientY });
              }}
              title={getStampTooltip(eventStampIds)}
              className={cn(
                'absolute left-1 right-1 z-10 border text-left font-medium shadow-[0_10px_20px_rgba(15,23,42,0.14)]',
                density.weekEvent,
                selectedEventId === event.id && 'ring-1 ring-accent/55',
              )}
              style={{
                top,
                height,
                color: SOURCE_STYLES[event.source].color,
                backgroundColor: SOURCE_STYLES[event.source].softBackground,
                borderColor: SOURCE_STYLES[event.source].ring,
                ...getStampOutlineStyle(eventStampIds),
              }}
            >
              <span
                className="absolute inset-x-1 top-0 h-2.5 cursor-ns-resize rounded-t-md border-t border-white/35 bg-white/25 opacity-80 shadow-[0_1px_6px_rgba(255,255,255,0.16)] transition-opacity hover:opacity-100"
                title="Drag to adjust start"
                onMouseDown={(mouseEvent) => startEventResize(event, 'start', mouseEvent)}
              />
              <div className="flex min-w-0 items-center justify-between gap-1 pr-1">
                <span className="min-w-0 flex-1 truncate">{event.title}</span>
                {renderStampBadges(eventStampIds, true, removeEventStampFromBadge(event, date))}
              </div>
              <div className="truncate text-[0.92em] opacity-80">{formatTimeRange(event)}</div>
              <span
                className="absolute inset-x-1 bottom-0 h-2.5 cursor-ns-resize rounded-b-md border-b border-white/35 bg-white/25 opacity-80 shadow-[0_-1px_6px_rgba(255,255,255,0.16)] transition-opacity hover:opacity-100"
                title="Drag to adjust end"
                onMouseDown={(mouseEvent) => startEventResize(event, 'end', mouseEvent)}
              />
            </button>
          );
        })}
      </div>
    );
  };

  const calendarHeading = viewMode === 'week'
    ? formatWeekHeading(weekStart)
    : viewMode === 'year'
      ? `${displayDate.getFullYear()}`
      : formatMonthHeading(displayDate);
  const selectedDateLabel = formatFullDate(selectedDate);
  const compactTitlebarControls = useMemo(() => {
    if (!compactPanel) return null;

    const iconButtonClass = 'flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] border border-border-subtle bg-bg-raised/70 text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover';

    return (
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1" data-calendar-compact-titlebar="true">
        <div className="mr-auto hidden min-w-[7.5rem] flex-1 flex-col leading-none text-left min-[680px]:flex">
          <span className="truncate text-[11px] font-semibold text-text-primary" data-calendar-compact-selected-date="true">
            {selectedDateLabel}
          </span>
          <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-text-muted">
            CalendarCaddy
          </span>
        </div>
        <button
          type="button"
          onClick={() => handleNavigate(-1)}
          className={iconButtonClass}
          aria-label="Previous calendar period"
        >
          <ChevronLeft size={13} />
        </button>
        <button
          type="button"
          className="inline-flex h-6 min-w-0 max-w-[128px] shrink items-center gap-1 rounded-[8px] border border-transparent bg-transparent px-1.5 text-[13px] font-semibold text-text-primary transition-colors hover:border-border-subtle hover:bg-bg-hover"
          aria-label="Current calendar period"
          title={calendarHeading}
        >
          <span className="min-w-0 truncate">{calendarHeading}</span>
          <ChevronDown size={12} className="shrink-0 text-text-muted" />
        </button>
        <button
          type="button"
          onClick={() => handleNavigate(1)}
          className={iconButtonClass}
          aria-label="Next calendar period"
        >
          <ChevronRight size={13} />
        </button>
        <div className="inline-flex h-6 shrink-0 overflow-hidden rounded-[8px] border border-border-subtle bg-bg-raised/70" data-calendar-compact-view-switcher="true">
          {(['week', 'month', 'year'] as CalendarViewMode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setViewMode(item)}
              aria-label={item}
              aria-pressed={viewMode === item}
              title={`${item[0].toUpperCase()}${item.slice(1)} view`}
              className={cn(
                'min-w-[24px] px-1.5 text-[11px] font-semibold transition-colors',
                viewMode === item
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
              )}
            >
              {COMPACT_VIEW_LABELS[item]}
            </button>
          ))}
        </div>
        {renderCompactStampStrip()}
      </div>
    );
  }, [calendarHeading, compactPanel, handleNavigate, renderCompactStampStrip, selectedDateLabel, viewMode]);
  const compactTitlebarAccessory = useMemo(
    () => compactTitlebarControls ? { content: compactTitlebarControls, replaceTitle: true } : null,
    [compactTitlebarControls],
  );
  const compactControlsInTitlebar = useWorkspacePanelHeaderAccessory(compactTitlebarAccessory);
  const showCalendarInnerHeader = !compactPanel || !compactControlsInTitlebar;
  const selectedDateStampIds = stampIdsForDate(selectedDate);
  const selectedAgendaContent = (
    <div
      role="region"
      aria-label="CalendarCaddy selected agenda"
      className="grid min-w-0 gap-3 text-[12px] text-text-secondary"
      data-calendar-selected-agenda-panel="true"
    >
      <div
        role="group"
        aria-label="Selected agenda day summary"
        className="min-w-0 rounded-[12px] border border-border-subtle/55 bg-bg-raised/54 p-3"
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              Selected day
            </div>
            <div className="mt-1 truncate text-sm font-semibold text-text-primary">{formatAgendaDate(selectedDate)}</div>
          </div>
          <div className="shrink-0">{renderStampBadges(selectedDateStampIds, false)}</div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-medium text-text-muted">
          <span className="rounded-full border border-border-subtle bg-bg-primary/70 px-2 py-1">
            {selectedDayEvents.length} {selectedDayEvents.length === 1 ? 'event' : 'events'}
          </span>
          <span className="rounded-full border border-border-subtle bg-bg-primary/70 px-2 py-1">
            {selectedDateStampIds.length} {selectedDateStampIds.length === 1 ? 'stamp' : 'stamps'}
          </span>
        </div>
        <p className="mt-3 line-clamp-3 leading-5 text-text-secondary">Status: {statusMessage}</p>
      </div>

      <div
        role="group"
        aria-label="Selected agenda current event"
        className="min-w-0 rounded-[12px] border border-border-subtle/55 bg-bg-raised/54 p-3"
      >
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          Selected event
        </div>
        {selectedEvent ? (
          <div className="mt-2 min-w-0">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-text-primary">{selectedEvent.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-medium text-text-muted">
                  <span>{formatTimeRange(selectedEvent)}</span>
                  <span>{selectedEvent.source}</span>
                </div>
              </div>
              <div className="shrink-0">{renderStampBadges(stampIdsForEvent(selectedEvent), true)}</div>
            </div>
            {(selectedEvent.location || selectedEvent.conferenceApp || selectedEvent.detail) && (
              <dl className="mt-3 grid gap-2 text-[11px] leading-5">
                {selectedEvent.location && (
                  <div className="grid min-w-0 grid-cols-[82px_minmax(0,1fr)] gap-2">
                    <dt className="font-semibold uppercase tracking-[0.12em] text-text-muted">Location</dt>
                    <dd className="min-w-0 truncate text-text-secondary">{selectedEvent.location}</dd>
                  </div>
                )}
                {selectedEvent.conferenceApp && (
                  <div className="grid min-w-0 grid-cols-[82px_minmax(0,1fr)] gap-2">
                    <dt className="font-semibold uppercase tracking-[0.12em] text-text-muted">Link</dt>
                    <dd className="min-w-0 truncate text-text-secondary">{selectedEvent.conferenceApp}</dd>
                  </div>
                )}
                {selectedEvent.detail && (
                  <div className="grid min-w-0 grid-cols-[82px_minmax(0,1fr)] gap-2">
                    <dt className="font-semibold uppercase tracking-[0.12em] text-text-muted">Notes</dt>
                    <dd className="min-w-0 line-clamp-2 text-text-secondary">{selectedEvent.detail}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        ) : (
          <p className="mt-2 leading-5 text-text-secondary">No event selected.</p>
        )}
      </div>

      <div
        role="group"
        aria-label="Selected agenda day list"
        className="min-w-0 rounded-[12px] border border-border-subtle/55 bg-bg-raised/54 p-3"
      >
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
            Day agenda
          </div>
          <span className="shrink-0 text-[11px] font-medium text-text-muted">{formatAgendaDate(selectedDate)}</span>
        </div>
        {selectedDayEvents.length > 0 ? (
          <div className="mt-2 grid gap-1.5">
            {selectedDayEvents.map((event) => {
              const eventStampIds = stampIdsForEvent(event);
              return (
                <div
                  key={event.id}
                  className={cn(
                    'grid min-w-0 grid-cols-[86px_minmax(0,1fr)_auto] items-center gap-2 rounded-[10px] border bg-bg-primary/58 px-2.5 py-2',
                    selectedEventId === event.id && 'ring-1 ring-accent/45',
                  )}
                  style={{
                    borderColor: SOURCE_STYLES[event.source].ring,
                  }}
                >
                  <span className="truncate text-[11px] font-semibold text-text-muted">{formatTimeRange(event)}</span>
                  <span className="min-w-0 truncate text-[12px] font-semibold text-text-primary">{event.title}</span>
                  <span className="shrink-0">{renderStampBadges(eventStampIds, true)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 leading-5 text-text-secondary">No scheduled items for this day.</p>
        )}
      </div>
    </div>
  );

  return (
    <section
      className={cn(
        'relative flex min-h-0 min-w-0 flex-1 w-full flex-col overflow-hidden text-text-primary',
        compactPanel
          ? 'border-0 bg-transparent p-0 shadow-none'
          : cn('border border-border-subtle bg-bg-raised/88 shadow-[0_24px_70px_rgba(15,23,42,0.2)] backdrop-blur-sm', density.shell),
      )}
      data-assistant-workspace="calendarcaddy"
      data-calendar-compact-panel={compactPanel ? 'true' : 'false'}
      data-density={densityMode}
    >
      {showCalendarInnerHeader && (
      <div className={cn(
        'shrink-0 border border-border-subtle bg-bg-primary/78 shadow-[0_16px_38px_rgba(15,23,42,0.14)] backdrop-blur-sm',
        compactPanel ? 'rounded-[12px] px-1.5 py-1' : 'rounded-[16px] px-2.5 py-1',
      )}>
        <div className={cn('flex min-w-0 flex-wrap items-center lg:flex-nowrap', compactPanel ? 'gap-1' : 'gap-1.5')}>
          <div
            className={cn(
              'flex min-w-0 items-center gap-2 rounded-[12px]',
              compactPanel && 'sr-only',
              onWorkspacePanelDragStart && 'cursor-grab px-1 py-0.5 transition-colors hover:bg-bg-hover/70 active:cursor-grabbing',
            )}
            draggable={Boolean(onWorkspacePanelDragStart)}
            onDragStart={onWorkspacePanelDragStart}
            title={onWorkspacePanelDragStart ? 'Drag CalendarCaddy into Workspace' : undefined}
            data-calendar-workspace-drag-source={onWorkspacePanelDragStart ? 'true' : undefined}
          >
            <div
              className={cn('flex items-center justify-center border border-accent/20 shadow-[0_12px_24px_rgba(15,23,42,0.14)]', density.brandIcon)}
              style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-hover))' }}
            >
              <CalendarDays size={density.brandIconSize} strokeWidth={2.2} className="text-white" />
            </div>
            <div className="min-w-0">
              <h2 className={cn('min-w-0 truncate font-semibold leading-none', density.title, compactPanel && 'sr-only')}>
                <span className="text-accent">Calendar</span>
                <span className="text-text-primary">Caddy</span>
              </h2>
              <div
                className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] font-medium leading-tight text-text-muted"
                data-calendar-header-date="true"
                aria-label="CalendarCaddy selected date"
              >
                <span className="min-w-0 truncate">{selectedDateLabel}</span>
                {selectedDayEvents.length > 0 && (
                  <span className="shrink-0 rounded-full border border-border-subtle bg-bg-primary/70 px-1.5 py-0.5 text-[10px] text-text-secondary">
                    {selectedDayEvents.length} {selectedDayEvents.length === 1 ? 'event' : 'events'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {!compactPanel && <div className="hidden h-8 w-px shrink-0 bg-border-subtle/70 2xl:block" />}

          <div className={cn('flex min-w-0 flex-1 items-center gap-1.5', compactPanel ? 'justify-start' : 'justify-end')}>
            <div className={cn('flex min-w-0 items-center overflow-x-auto no-scrollbar', compactPanel ? 'gap-1' : 'gap-1.5')}>
              <button
                type="button"
                onClick={() => handleNavigate(-1)}
                className={cn('flex items-center justify-center border border-border-subtle bg-bg-raised/70 text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover', density.toolbarIconButton)}
                aria-label="Previous calendar period"
              >
                <ChevronLeft size={density.toolbarIconSize} />
              </button>
              {!compactPanel && (
                <button type="button" onClick={handleToday} className={buttonClass(false, density.toolbarButton)}>
                  Today
                </button>
              )}
              <button
                type="button"
                className={cn(
                  'inline-flex min-w-0 items-center gap-2 rounded-[10px] border border-transparent bg-transparent px-2.5 font-semibold text-text-primary transition-colors hover:border-border-subtle hover:bg-bg-hover',
                  density.monthLabel,
                  compactPanel && 'max-w-[128px] gap-1 px-1.5 text-[13px]',
                )}
                aria-label="Current calendar period"
                title={calendarHeading}
              >
                <span className="min-w-0 truncate">{calendarHeading}</span>
                <ChevronDown size={density.toolbarIconSize - 1} className="text-text-muted" />
              </button>
              <button
                type="button"
                onClick={() => handleNavigate(1)}
                className={cn('flex items-center justify-center border border-border-subtle bg-bg-raised/70 text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover', density.toolbarIconButton)}
                aria-label="Next calendar period"
              >
                <ChevronRight size={density.toolbarIconSize} />
              </button>

              <div className="hidden h-8 w-px shrink-0 bg-border-subtle/70 2xl:block" />

              <div className={cn('inline-flex shrink-0 overflow-hidden border border-border-subtle bg-bg-raised/70', density.segmentedWrap)}>
                {(['week', 'month', 'year'] as CalendarViewMode[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setViewMode(item)}
                    aria-label={item}
                    aria-pressed={viewMode === item}
                    className={cn(
                      'font-medium capitalize transition-colors',
                      density.segmentedButton,
                      compactPanel && 'min-w-[24px] px-1.5 py-1 text-[11px]',
                      viewMode === item
                        ? 'bg-accent/10 text-accent'
                        : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                    )}
                  >
                    {compactPanel ? COMPACT_VIEW_LABELS[item] : item}
                  </button>
                ))}
              </div>
              {renderCompactStampStrip()}

              {!compactPanel && (
                <>
                  <input
                    ref={icsFileInputRef}
                    type="file"
                    accept=".ics,text/calendar"
                    className="hidden"
                    onChange={handleICSFileChange}
                    aria-label="Import ICS calendar file"
                  />
                  <button
                    type="button"
                    onClick={() => icsFileInputRef.current?.click()}
                    title="Import events from an .ics file"
                    className={cn('inline-flex shrink-0 items-center gap-2 border border-border-subtle bg-bg-raised/80 font-semibold text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover', density.toolbarButton)}
                  >
                    <Upload size={density.toolbarIconSize} className="text-text-muted" />
                    Import .ics
                  </button>
                  <button
                    type="button"
                    onClick={() => openCreateDrawer(selectedDate)}
                    className={cn('inline-flex shrink-0 items-center gap-2 border border-border-subtle bg-bg-raised/80 font-semibold text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover', density.toolbarButton)}
                  >
                    <Plus size={density.toolbarIconSize} className="text-accent" />
                    New event
                  </button>
                </>
              )}
            </div>

            {!compactPanel && (
              <div className="relative flex shrink-0 items-center gap-1.5" data-cal-settings-panel="true">
                <button
                  type="button"
                  onClick={() => { setCalSettingsOpen((v) => !v); setConnectError(null); }}
                  aria-label="Calendar account settings"
                  aria-expanded={calSettingsOpen}
                  className={cn(
                    'flex items-center justify-center border transition-colors',
                    density.toolbarIconButton,
                    calSettingsOpen
                      ? 'border-accent/30 bg-accent/10 text-accent'
                      : 'border-border-subtle bg-bg-raised/70 text-text-primary hover:border-border-medium hover:bg-bg-hover',
                  )}
                >
                  <Settings size={density.toolbarIconSize} />
                </button>

                {/* Calendar accounts panel */}
                {calSettingsOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-[16px] border border-border-subtle bg-bg-primary shadow-[0_8px_32px_rgba(0,0,0,0.28)] backdrop-blur-sm">
                    <div className="border-b border-border-subtle px-4 py-3">
                      <p className="text-[13px] font-semibold text-text-primary">Calendar accounts</p>
                      <p className="mt-0.5 text-[11px] text-text-muted">Tokens are stored in the OS keychain. ThreatCaddy holds only a credential reference.</p>
                    </div>

                    {calendarAccountConfigs.length > 0 && (
                      <ul className="divide-y divide-border-subtle/60 px-2 py-1">
                        {calendarAccountConfigs.map((acct) => (
                          <li key={acct.id} className="flex items-center justify-between gap-2 py-2 px-2">
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-medium text-text-primary">{acct.label}</p>
                              <p className="truncate text-[11px] text-text-muted capitalize">{acct.provider} · {acct.status}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeCalendarAccount(acct.id)}
                              className="shrink-0 text-[11px] text-text-muted transition-colors hover:text-red-400"
                              aria-label={`Remove ${acct.label}`}
                            >
                              <X size={13} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="space-y-2 px-3 py-3">
                      {connectError && (
                        <p className="rounded-[10px] bg-red-500/10 px-3 py-2 text-[11px] text-red-400">{connectError}</p>
                      )}
                      <button
                        type="button"
                        disabled={connectingProvider !== null}
                        onClick={() => { void handleConnectProvider('google'); }}
                        className="flex w-full items-center gap-2 rounded-[11px] border border-border-subtle bg-bg-raised/70 px-3 py-2.5 text-[12px] font-medium text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover disabled:opacity-50"
                      >
                        <CalendarDays size={14} className="shrink-0 text-[#7ec4ff]" />
                        {connectingProvider === 'google' ? 'Connecting…' : 'Connect Google Calendar'}
                      </button>
                      <button
                        type="button"
                        disabled={connectingProvider !== null}
                        onClick={() => { void handleConnectProvider('microsoft'); }}
                        className="flex w-full items-center gap-2 rounded-[11px] border border-border-subtle bg-bg-raised/70 px-3 py-2.5 text-[12px] font-medium text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover disabled:opacity-50"
                      >
                        <CalendarDays size={14} className="shrink-0 text-[#8fa8ff]" />
                        {connectingProvider === 'microsoft' ? 'Connecting…' : 'Connect Microsoft 365'}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => { void sync(); }}
                  disabled={syncing}
                  aria-label="Sync calendar with connected accounts"
                  title={syncError ?? (lastSyncedAt ? `Last synced ${new Date(lastSyncedAt).toLocaleTimeString()}` : 'Sync with connected accounts')}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border-subtle px-3 py-1.5 text-[13px] font-medium transition-colors',
                    syncing ? 'opacity-60' : syncError ? 'text-red-400 hover:bg-bg-hover' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                  )}
                >
                  <RefreshCw size={14} className={syncing ? 'animate-spin' : undefined} />
                  {syncing ? 'Syncing…' : 'Sync'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {!compactPanel && (
        <div className={cn('shrink-0', density.promptWrap)}>
          <div className="flex min-w-0 items-center gap-2 rounded-[999px] border border-border-subtle bg-bg-primary/78 px-2 py-2 shadow-[0_14px_32px_rgba(15,23,42,0.1)] backdrop-blur-sm">
            <button
              type="button"
              onClick={() => assistantInputRef.current?.focus()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-purple/20 bg-purple/10 text-purple transition-colors hover:bg-purple/15 sm:h-9 sm:w-9"
              aria-label="Focus CalendarCaddy prompt"
            >
              <Sparkles size={14} />
            </button>

            <div className="min-w-0 flex-1">
              <input
                ref={assistantInputRef}
                type="text"
                value={assistantInput}
                onChange={(event) => setAssistantInput(event.target.value)}
                onKeyDown={handleAssistantKeyDown}
                aria-label="Ask CalendarCaddy"
                placeholder="Message AssistantCaddy..."
                className={cn('min-w-0 w-full bg-transparent text-text-primary outline-none placeholder:text-text-muted', density.promptInput)}
              />
            </div>

            <div className="hidden h-7 w-px shrink-0 bg-border-subtle/80 lg:block" />

            <div className="flex min-w-0 shrink-0 items-center gap-1 overflow-x-auto rounded-full border border-border-subtle bg-bg-raised/58 px-1.5 py-1 no-scrollbar max-lg:max-w-[46vw]">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-bg-primary/70 text-text-muted" title="Calendar stamps">
                <Stamp size={12} />
              </div>
              {CALENDAR_STAMPS.map((stamp) => {
                const Icon = stamp.icon;
                const active = activeStampId === stamp.id;
                const used = highlightedStampIds.has(stamp.id);
                const label = `${active ? 'Turn off' : 'Use'} ${stamp.label} stamp brush`;
                return (
                  <button
                    key={stamp.id}
                    type="button"
                    onClick={() => handleStampBankClick(stamp.id)}
                    aria-label={label}
                    aria-pressed={active}
                    title={used ? `${stamp.label} is on the selected item — remove it from its badge` : `${stamp.label}${active ? ' brush on' : ''}`}
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-transform hover:scale-105',
                      active || used ? 'scale-105 opacity-100 ring-2 ring-accent/45' : 'opacity-85 hover:opacity-100',
                    )}
                    style={{
                      color: stamp.color,
                      borderColor: stamp.ring,
                      backgroundColor: stamp.softBackground,
                      boxShadow: used ? `0 0 0 2px ${stamp.ring}, 0 0 14px ${stamp.ring}` : undefined,
                    }}
                  >
                    <Icon size={12} strokeWidth={2.35} />
                  </button>
                );
              })}
              {activeStamp && (
                <button
                  type="button"
                  onClick={clearActiveStamp}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-bg-primary/70 text-text-muted transition-colors hover:border-border-medium hover:text-text-primary"
                  aria-label="Turn off stamp mode"
                  title={`Turn off ${activeStamp.label} stamp`}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleAssistantSubmit}
              aria-label="Send CalendarCaddy prompt"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-purple/20 text-white shadow-[0_14px_28px_rgba(109,77,230,0.28)] transition-transform hover:scale-[1.02] sm:h-10 sm:w-10"
              style={{ background: 'linear-gradient(135deg, var(--color-accent), #7c3aed)' }}
            >
              <AudioLines size={density.toolbarIconSize + 1} />
            </button>
          </div>
        </div>
      )}

      {!compactPanel && assistantPreview && (
        <div className={cn('shrink-0 border border-accent/18 bg-accent/8 text-text-primary', density.previewWrap)}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            <Sparkles size={14} />
            CalendarCaddy assist
          </div>
          <h3 className={cn('mt-1 font-semibold text-text-primary', density.previewTitle)}>{assistantPreview.title}</h3>
          <p className={cn('text-text-secondary', density.previewSummary)}>{assistantPreview.summary}</p>
          <ul className={cn('text-text-secondary', density.previewList)}>
            {assistantPreview.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-accent" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedAgendaPanel.panel.mode !== 'docked' && (
        <WorkspacePanel
          id="calendarcaddy-selected-agenda"
          title="Selected agenda"
          mode={selectedAgendaPanel.panel.mode}
          geometry={selectedAgendaPanel.panel.geometry}
          zIndex={selectedAgendaPanel.panel.zIndex}
          onPanelFocus={selectedAgendaPanel.focus}
          onRestore={selectedAgendaPanel.restore}
          onModeChange={handleSelectedAgendaPanelModeChange}
          onGeometryChange={selectedAgendaPanel.setGeometry}
          dockedClassName="shrink-0"
          placeholderClassName="shrink-0"
          floatingAriaLabel="CalendarCaddy selected agenda panel"
          resizeLabelBase="selected agenda"
          minimizeLabel="Minimize selected agenda"
          closeLabel="Close selected agenda workspace panel"
          restoreLabel="Restore selected agenda panel"
          minWidth={320}
          minHeight={280}
          compactWidth={420}
          compactHeight={360}
        >
          {selectedAgendaContent}
        </WorkspacePanel>
      )}

      {viewMode === 'month' ? (
        <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-border-subtle bg-bg-primary/65', compactPanel ? 'rounded-[12px]' : density.monthWrap)}>
          <div className="grid min-w-0 grid-cols-7 border-b border-border-subtle bg-bg-deep/45">
            {weekdayLabels.map((label) => (
              <div key={label} className={cn('text-center font-semibold uppercase tracking-[0.16em] text-text-muted', density.monthWeekday)}>
                {label}
              </div>
            ))}
          </div>
          <div className={cn(`grid min-h-0 min-w-0 flex-1 ${monthDates.length > 35 ? 'grid-rows-6' : 'grid-rows-5'} grid-cols-7`)}>
            {monthDates.map((date) => renderMonthCell(date))}
          </div>
        </div>
      ) : viewMode === 'week' ? (
        <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-border-subtle bg-bg-primary/65', compactPanel ? 'rounded-[12px]' : density.weekWrap)}>
          <div className="grid min-w-0 grid-cols-[74px_repeat(7,minmax(0,1fr))] border-b border-border-subtle bg-bg-deep/45">
            <div className="border-r border-border-subtle" />
            {weekDates.map((date) => (
              (() => {
                const stamps = stampIdsForDate(date);
                return (
              <button
                key={date.toISOString()}
                type="button"
                data-calendar-date={toDateInputValue(date)}
                onClick={() => setSelectedDate(startOfDay(date))}
                onMouseDown={(event) => startDateStampDrag(date, event)}
                onMouseEnter={(event) => continueDateStampDrag(date, event)}
                title={getStampTooltip(stamps)}
                className={cn(
                  'border-l border-border-subtle text-left transition-colors hover:bg-bg-hover/60',
                  density.weekHeaderCell,
                  sameDay(date, selectedDate) && 'bg-accent/8',
                  activeStampId && 'cursor-copy',
                )}
                style={getStampOutlineStyle(stamps)}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className={cn('font-semibold uppercase tracking-[0.16em] text-text-muted', density.weekHeaderLabel)}>
                    {weekdayLabels[weekDates.indexOf(date)]}
                  </div>
                  {renderStampBadges(stamps, true, removeDateStampFromBadge(date))}
                </div>
                <div className={cn('font-semibold text-text-primary', density.weekHeaderDate)}>
                  {date.getDate()}
                </div>
              </button>
                );
              })()
            ))}
          </div>

          <div className="min-h-0 min-w-0 flex-1 overflow-auto">
            <div className="grid min-w-0 grid-cols-[74px_repeat(7,minmax(0,1fr))] border-b border-border-subtle">
              <div className={cn('border-r border-border-subtle font-semibold uppercase tracking-[0.16em] text-text-muted', density.allDayLabel)}>
                All day
              </div>
              {weekDates.map((date) => (
                (() => {
                  const stamps = stampIdsForDate(date);
                  return (
                <div
                  key={`all-day-${date.toISOString()}`}
                  data-calendar-date={toDateInputValue(date)}
                  onMouseDown={(event) => startDateStampDrag(date, event)}
                  onMouseEnter={(event) => continueDateStampDrag(date, event)}
                  title={getStampTooltip(stamps)}
                  className={cn(
                    'border-l border-border-subtle bg-bg-primary/50',
                    density.allDayCell,
                    activeStampId && 'cursor-copy',
                  )}
                  style={getStampOutlineStyle(stamps)}
                >
                  <div className="mb-1">{renderStampBadges(stamps, true, removeDateStampFromBadge(date))}</div>
                  {events.filter((event) => event.allDay && eventOccursOnDate(event, date)).map((event) => {
                    const eventStampIds = stampIdsForEvent(event, date);
                    return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        if (activeStampId) {
                          toggleEventStamp(event, activeStampId);
                          return;
                        }
                        selectEvent(event);
                      }}
                      onDoubleClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        openEditDrawer(event);
                      }}
                      onContextMenu={(menuEvent) => {
                        menuEvent.preventDefault();
                        menuEvent.stopPropagation();
                        selectEvent(event);
                        setEventContextMenu({ eventId: event.id, x: menuEvent.clientX, y: menuEvent.clientY });
                      }}
                      title={getStampTooltip(eventStampIds)}
                      className={cn(
                        'mb-1 block w-full border text-left font-medium',
                        density.allDayEvent,
                        selectedEventId === event.id && 'ring-1 ring-accent/45',
                      )}
                      style={{
                        color: SOURCE_STYLES[event.source].color,
                        backgroundColor: SOURCE_STYLES[event.source].softBackground,
                        borderColor: SOURCE_STYLES[event.source].ring,
                        ...getStampOutlineStyle(eventStampIds),
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-1">
                        {renderStampBadges(eventStampIds, true, removeEventStampFromBadge(event, date))}
                        <span className="min-w-0 flex-1 truncate">{event.title}</span>
                      </span>
                    </button>
                    );
                  })}
                </div>
                  );
                })()
              ))}
            </div>

            <div className="grid min-w-0 grid-cols-[74px_repeat(7,minmax(0,1fr))]">
              {WEEK_HOURS.flatMap((hour) => [
                <div
                  key={`hour-${hour}`}
                  className={cn('flex items-start border-r border-border-subtle bg-bg-primary/72 pt-2 font-medium text-text-muted', density.weekHourLabel)}
                >
                  {formatHourLabel(hour)}
                </div>,
                ...weekDates.map((date) => renderWeekTimedCell(date, hour)),
              ])}
            </div>
          </div>
        </div>
      ) : (
        <div className={cn('grid min-h-0 min-w-0 flex-1 auto-rows-max overflow-auto sm:grid-cols-2 xl:grid-cols-4', compactPanel ? 'gap-1.5' : density.yearGrid)}>
          {Array.from({ length: 12 }, (_, index) => createDate(displayDate.getFullYear(), index, 1)).map((month) => {
            const monthEventCount = events.filter((event) => sameMonth(parseEventDate(event.start), month)).length;
            return (
              <button
                key={month.toISOString()}
                type="button"
                onClick={() => {
                  setDisplayDate(month);
                  setViewMode('month');
                }}
                className={cn('border border-border-subtle bg-bg-primary/60 text-left transition-colors hover:border-border-medium hover:bg-bg-hover', density.yearCard)}
              >
                <div className={cn('font-semibold text-text-primary', density.yearTitle)}>
                  {MONTH_LABELS[month.getMonth()]} {month.getFullYear()}
                </div>
                <div className={cn('text-text-secondary', density.yearMeta)}>
                  {monthEventCount === 0 ? 'No scheduled items yet.' : `${monthEventCount} scheduled ${monthEventCount === 1 ? 'item' : 'items'}.`}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {statusMessage}
      </div>

      {eventContextMenu && selectedEvent && (
        <div
          role="menu"
          aria-label="Calendar event actions"
          className="fixed z-[260] w-48 overflow-hidden rounded-[10px] border border-border-medium bg-bg-raised/98 p-1 text-[11px] shadow-[8px_12px_24px_rgba(0,0,0,0.32)] backdrop-blur-xl"
          style={{ left: eventContextMenu.x, top: eventContextMenu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
          data-calendar-event-menu="true"
          data-themed-context-menu="toolbar-select"
        >
          <div className="border-b border-border-subtle px-2.5 py-2">
            <div className="truncate text-[11px] font-semibold text-text-primary">{selectedEvent.title}</div>
            <div className="mt-0.5 truncate text-[11px] text-text-muted">{formatTimeRange(selectedEvent)}</div>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => openEditDrawer(selectedEvent)}
            className="mt-1 flex min-h-8 w-full items-center gap-2 rounded-[8px] px-3 py-1.5 text-left text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
          >
            <PencilLine size={13} />
            Edit details
          </button>
          {activeStamp && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                toggleEventStamp(selectedEvent, activeStamp.id);
                setEventContextMenu(null);
              }}
              className="flex min-h-8 w-full items-center gap-2 rounded-[8px] px-3 py-1.5 text-left text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
            >
              {ActiveStampIcon && <ActiveStampIcon size={13} />}
              Toggle {activeStamp.label}
            </button>
          )}
          {explicitStampIdsForEvent(selectedEvent).length > 0 && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setEventStamps((current) => {
                  const next = { ...current };
                  delete next[selectedEvent.id];
                  return next;
                });
                setEventContextMenu(null);
                setStatusMessage(`Cleared explicit stamps from ${selectedEvent.title}.`);
              }}
              className="flex min-h-8 w-full items-center gap-2 rounded-[8px] px-3 py-1.5 text-left text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
            >
              <Stamp size={13} />
              Clear event stamps
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => deleteEvent(selectedEvent.id)}
            className="flex min-h-8 w-full items-center gap-2 rounded-[8px] px-3 py-1.5 text-left text-rose-300 transition-colors hover:bg-rose-400/10"
          >
            <Trash2 size={13} />
            Delete event
          </button>
        </div>
      )}

      {drawerOpen && (
        <div className="absolute inset-0 z-30 flex justify-end bg-[rgba(2,6,23,0.42)] backdrop-blur-[2px]">
          <div className={cn('h-full w-full border-l border-border-subtle bg-bg-primary/95 shadow-[-24px_0_64px_rgba(15,23,42,0.22)]', density.drawerWidth, density.drawerPadding)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                  {drawerMode === 'edit' ? 'Edit event' : 'New event'}
                </div>
                <h3 className="mt-1 text-lg font-semibold text-text-primary">
                  {drawerMode === 'edit' ? draft.title || 'Update selected event' : 'Create a calendar event'}
                </h3>
                <p className="mt-1 text-sm leading-5 text-text-secondary">
                  Use this drawer to create, confirm, and refine events from either the month cells or the week grid.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className={cn('flex items-center justify-center border border-border-subtle bg-bg-raised/70 text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover', density.toolbarIconButton)}
                aria-label="Close event editor"
              >
                <X size={density.toolbarIconSize} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <label className="block">
                <span className={cn('font-semibold uppercase tracking-[0.16em] text-text-muted', density.drawerFieldLabel)}>Event title</span>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(event) => setDraftField('title', event.target.value)}
                  aria-label="Event title"
                  placeholder="Add a short event title"
                  className={cn('mt-1.5 w-full border border-border-subtle bg-bg-raised/70 text-text-primary outline-none placeholder:text-text-muted', density.drawerField)}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={cn('font-semibold uppercase tracking-[0.16em] text-text-muted', density.drawerFieldLabel)}>Start date</span>
                  <input
                    type="date"
                    value={draft.startDate}
                    onChange={(event) => setDraftField('startDate', event.target.value)}
                    aria-label="Start date"
                    className={cn('mt-1.5 w-full border border-border-subtle bg-bg-raised/70 text-text-primary outline-none', density.drawerField)}
                  />
                </label>
                <label className="block">
                  <span className={cn('font-semibold uppercase tracking-[0.16em] text-text-muted', density.drawerFieldLabel)}>End date</span>
                  <input
                    type="date"
                    value={draft.endDate}
                    onChange={(event) => setDraftField('endDate', event.target.value)}
                    aria-label="End date"
                    className={cn('mt-1.5 w-full border border-border-subtle bg-bg-raised/70 text-text-primary outline-none', density.drawerField)}
                  />
                </label>
              </div>

              {!draft.allDay && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className={cn('font-semibold uppercase tracking-[0.16em] text-text-muted', density.drawerFieldLabel)}>Start time</span>
                    <input
                      type="time"
                      value={draft.startTime}
                      onChange={(event) => setDraftField('startTime', event.target.value)}
                      aria-label="Start time"
                      className={cn('mt-1.5 w-full border border-border-subtle bg-bg-raised/70 text-text-primary outline-none', density.drawerField)}
                    />
                  </label>
                  <label className="block">
                    <span className={cn('font-semibold uppercase tracking-[0.16em] text-text-muted', density.drawerFieldLabel)}>End time</span>
                    <input
                      type="time"
                      value={draft.endTime}
                      onChange={(event) => setDraftField('endTime', event.target.value)}
                      aria-label="End time"
                      className={cn('mt-1.5 w-full border border-border-subtle bg-bg-raised/70 text-text-primary outline-none', density.drawerField)}
                    />
                  </label>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={cn('font-semibold uppercase tracking-[0.16em] text-text-muted', density.drawerFieldLabel)}>Source</span>
                  <select
                    value={draft.source}
                    onChange={(event) => setDraftField('source', event.target.value as EventSource)}
                    aria-label="Event source"
                    className={cn('mt-1.5 w-full border border-border-subtle bg-bg-raised/70 text-text-primary outline-none', density.drawerField)}
                  >
                    {EVENT_SOURCES.map((source) => (
                      <option key={source} value={source}>{source}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={cn('font-semibold uppercase tracking-[0.16em] text-text-muted', density.drawerFieldLabel)}>Conference app</span>
                  <input
                    type="text"
                    value={draft.conferenceApp}
                    onChange={(event) => setDraftField('conferenceApp', event.target.value)}
                    aria-label="Conference app"
                    placeholder="Zoom, Teams, Meet"
                    className={cn('mt-1.5 w-full border border-border-subtle bg-bg-raised/70 text-text-primary outline-none placeholder:text-text-muted', density.drawerField)}
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 rounded-xl border border-border-subtle bg-bg-raised/60 px-3 py-2.5 text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={draft.allDay}
                  onChange={(event) => setDraftField('allDay', event.target.checked)}
                  aria-label="All day event"
                />
                <span>All day event</span>
              </label>

              {drawerMode === 'create' && (
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                  <label className="block">
                    <span className={cn('font-semibold uppercase tracking-[0.16em] text-text-muted', density.drawerFieldLabel)}>Repeat</span>
                    <select
                      value={draft.repeatMode}
                      onChange={(event) => setDraftField('repeatMode', event.target.value as RepeatMode)}
                      aria-label="Repeat schedule"
                      className={cn('mt-1.5 w-full border border-border-subtle bg-bg-raised/70 text-text-primary outline-none', density.drawerField)}
                    >
                      <option value="none">Does not repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className={cn('font-semibold uppercase tracking-[0.16em] text-text-muted', density.drawerFieldLabel)}>Count</span>
                    <input
                      type="number"
                      min={1}
                      value={draft.repeatCount}
                      onChange={(event) => setDraftField('repeatCount', Math.max(1, Number(event.target.value) || 1))}
                      aria-label="Repeat count"
                      className={cn('mt-1.5 w-full border border-border-subtle bg-bg-raised/70 text-text-primary outline-none', density.drawerField)}
                    />
                  </label>
                </div>
              )}

              <label className="block">
                <span className={cn('font-semibold uppercase tracking-[0.16em] text-text-muted', density.drawerFieldLabel)}>Location or handoff</span>
                <input
                  type="text"
                  value={draft.location}
                  onChange={(event) => setDraftField('location', event.target.value)}
                  aria-label="Event location"
                  placeholder="External Zoom link, office, maps route"
                  className={cn('mt-1.5 w-full border border-border-subtle bg-bg-raised/70 text-text-primary outline-none placeholder:text-text-muted', density.drawerField)}
                />
              </label>

              <label className="block">
                <span className={cn('font-semibold uppercase tracking-[0.16em] text-text-muted', density.drawerFieldLabel)}>Notes</span>
                <textarea
                  value={draft.detail}
                  onChange={(event) => setDraftField('detail', event.target.value)}
                  aria-label="Event notes"
                  rows={4}
                  placeholder="Prep needs, follow-up buffer, or context to preserve."
                  className={cn('mt-1.5 w-full border border-border-subtle bg-bg-raised/70 text-text-primary outline-none placeholder:text-text-muted', density.drawerTextarea)}
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
              <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                <Clock3 size={15} className="text-accent" />
                <span>{formatFullDate(selectedDate)}</span>
                {draft.conferenceApp && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-bg-raised/70 px-2 py-1 text-xs">
                    <Video size={12} />
                    {draft.conferenceApp}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {drawerMode === 'edit' && (
                  <button
                    type="button"
                    onClick={deleteDraftEvent}
                    className={cn('inline-flex items-center gap-2 border border-rose-400/20 bg-rose-400/10 font-semibold text-rose-300 transition-colors hover:bg-rose-400/15', density.drawerFooterButton)}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeDrawer}
                  className={cn('border border-border-subtle bg-bg-raised/70 font-semibold text-text-secondary transition-colors hover:border-border-medium hover:bg-bg-hover hover:text-text-primary', density.drawerFooterButton)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveDraft}
                  className={cn('inline-flex items-center gap-2 border border-accent/30 bg-accent/12 font-semibold text-accent transition-colors hover:bg-accent/16', density.drawerFooterButton)}
                >
                  {drawerMode === 'edit' ? <PencilLine size={14} /> : <Check size={14} />}
                  {drawerMode === 'edit' ? 'Confirm edit' : 'Confirm event'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
