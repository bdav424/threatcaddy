import nunjucks from 'nunjucks';
import { db } from '../db';
import type { Note, Task, TimelineEvent, StandaloneIOC } from '../types';

// ---------------------------------------------------------------------------
// Nunjucks environment — no file-system loader, safe for browser + Electron.
// trimBlocks removes the newline after {% %} tags.
// lstripBlocks strips leading whitespace before {% %} tags.
// These two together prevent stray blank lines in loop/conditional output.
// ---------------------------------------------------------------------------
const njkEnv = new nunjucks.Environment(null, {
  autoescape: false,
  trimBlocks: true,
  lstripBlocks: true,
  throwOnUndefined: false,
});

// ---------------------------------------------------------------------------
// Render context types
// ---------------------------------------------------------------------------

export interface ReportIocEntry {
  value: string;
  type: string;
  confidence: string;
  tags: string[];
  analystNotes: string;
  firstSeen: string;
  lastSeen: string;
}

export interface ReportTimelineEntry {
  timestamp: string;
  title: string;
  description: string;
  actor: string;
  eventType: string;
  tags: string[];
  mitreAttackIds: string[];
}

export interface ReportNoteEntry {
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
}

export interface ReportTaskEntry {
  title: string;
  status: string;
  priority: string;
  tags: string[];
  dueDate: string;
  description: string;
}

export interface ReportRenderContext {
  investigation: {
    name: string;
    description: string;
    id: string;
  };
  iocs: ReportIocEntry[];
  timeline: ReportTimelineEntry[];
  notes: ReportNoteEntry[];
  tasks: ReportTaskEntry[];
  date: string;
  year: string;
  totalIocCount: number;
  openTaskCount: number;
}

// ---------------------------------------------------------------------------
// Context builder — reads from Dexie for the current investigation folder
// ---------------------------------------------------------------------------

function fmtDate(ts?: number): string {
  if (!ts) return '';
  return new Date(ts).toISOString().split('T')[0];
}

function fmtTs(ts?: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function mapIoc(ioc: StandaloneIOC): ReportIocEntry {
  return {
    value: ioc.value,
    type: ioc.type,
    confidence: ioc.confidence,
    tags: ioc.tags ?? [],
    analystNotes: ioc.analystNotes ?? '',
    firstSeen: fmtDate(ioc.firstSeen),
    lastSeen: fmtDate(ioc.lastSeen),
  };
}

function mapTimeline(ev: TimelineEvent): ReportTimelineEntry {
  return {
    timestamp: fmtTs(ev.timestamp),
    title: ev.title,
    description: ev.description ?? '',
    actor: ev.actor ?? '',
    eventType: ev.eventType,
    tags: ev.tags ?? [],
    mitreAttackIds: ev.mitreAttackIds ?? [],
  };
}

function mapNote(note: Note): ReportNoteEntry {
  return {
    title: note.title,
    content: note.content,
    tags: note.tags ?? [],
    createdAt: fmtDate(note.createdAt),
  };
}

function mapTask(task: Task): ReportTaskEntry {
  return {
    title: task.title,
    status: task.status,
    priority: String(task.priority ?? ''),
    tags: task.tags ?? [],
    dueDate: task.dueDate ?? '',
    description: task.description ?? '',
  };
}

export async function buildReportContext(
  folderId?: string,
  investigationName?: string,
): Promise<ReportRenderContext> {
  const now = Date.now();
  const today = fmtDate(now);
  const year = new Date(now).getFullYear().toString();

  if (!folderId) {
    return {
      investigation: { name: investigationName ?? 'Untitled Investigation', description: '', id: '' },
      iocs: [], timeline: [], notes: [], tasks: [],
      date: today, year,
      totalIocCount: 0, openTaskCount: 0,
    };
  }

  const [rawNotes, rawTasks, rawIocs, rawTimeline] = await Promise.all([
    db.notes.where('folderId').equals(folderId).filter(n => !n.trashed && !n.archived).toArray(),
    db.tasks.where('folderId').equals(folderId).filter(t => !t.trashed && !t.archived).toArray(),
    db.standaloneIOCs.where('folderId').equals(folderId).filter(i => !i.trashed && !i.archived).toArray(),
    db.timelineEvents.where('folderId').equals(folderId).filter(e => !e.trashed && !e.archived).sortBy('timestamp'),
  ]);

  const folder = await db.folders.get(folderId);
  const iocs = rawIocs.map(mapIoc);
  const tasks = rawTasks.map(mapTask);

  return {
    investigation: {
      name: folder?.name ?? investigationName ?? 'Untitled Investigation',
      description: folder?.description ?? '',
      id: folderId,
    },
    iocs,
    timeline: rawTimeline.map(mapTimeline),
    notes: rawNotes.map(mapNote),
    tasks,
    date: today,
    year,
    totalIocCount: iocs.length,
    openTaskCount: tasks.filter(t => t.status !== 'completed' && t.status !== 'closed').length,
  };
}

// ---------------------------------------------------------------------------
// Renderer — safe: renderString never touches the file system.
// Returns empty string on template error so the user sees a blank section
// rather than a crash.
// ---------------------------------------------------------------------------

export function renderSectionTemplate(
  bodyTemplate: string,
  context: ReportRenderContext,
): string {
  try {
    return njkEnv.renderString(bodyTemplate, context as unknown as Record<string, unknown>);
  } catch {
    return '';
  }
}
