import { useState, useEffect, useCallback, useRef } from 'react';
import { nanoid } from 'nanoid';
import { db } from '../db';
import type { Report, ReportSectionContent } from '../types';

const SAVE_DEBOUNCE_MS = 600;

export function useReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const reload = useCallback(async () => {
    const all = await db.reports.orderBy('updatedAt').reverse().toArray();
    setReports(all);
    setLoading(false);
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const timers = saveTimers.current;
    return () => { timers.forEach((t) => clearTimeout(t)); };
  }, []);

  const createReport = useCallback(async (partial: Pick<Report, 'title' | 'templateId' | 'sections'> & Partial<Pick<Report, 'folderId'>>): Promise<Report> => {
    const now = Date.now();
    const report: Report = {
      id: nanoid(),
      title: partial.title,
      templateId: partial.templateId,
      sections: partial.sections,
      folderId: partial.folderId,
      createdAt: now,
      updatedAt: now,
    };
    await db.reports.add(report);
    await reload();
    return report;
  }, [reload]);

  // Debounced per-report write-through: local state updates instantly so
  // typing stays responsive, the Dexie write lands ~600ms after the last
  // keystroke so we're not hitting IndexedDB on every character.
  const scheduleSave = useCallback((id: string, updates: Partial<Report>) => {
    const timers = saveTimers.current;
    clearTimeout(timers.get(id));
    timers.set(id, setTimeout(() => {
      void db.reports.update(id, { ...updates, updatedAt: Date.now() });
    }, SAVE_DEBOUNCE_MS));
  }, []);

  const updateSection = useCallback((id: string, sectionId: string, content: string) => {
    setReports((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const sections: ReportSectionContent[] = r.sections.map((s) =>
        s.sectionId === sectionId ? { ...s, content } : s,
      );
      scheduleSave(id, { sections });
      return { ...r, sections };
    }));
  }, [scheduleSave]);

  const updateTitle = useCallback((id: string, title: string) => {
    setReports((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      scheduleSave(id, { title });
      return { ...r, title };
    }));
  }, [scheduleSave]);

  const deleteReport = useCallback(async (id: string) => {
    clearTimeout(saveTimers.current.get(id));
    saveTimers.current.delete(id);
    await db.reports.delete(id);
    await reload();
  }, [reload]);

  return { reports, loading, createReport, updateSection, updateTitle, deleteReport, reload };
}
