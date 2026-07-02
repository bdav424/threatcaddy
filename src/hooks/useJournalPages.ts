import { useState, useEffect, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { db } from '../db';
import type { JournalPage, JournalPageTheme } from '../types';

export function useJournalPages() {
  const [pages, setPages] = useState<JournalPage[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const all = await db.journalPages.orderBy('updatedAt').reverse().toArray();
    setPages(all);
    setLoading(false);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const createPage = useCallback(async (partial?: Partial<Pick<JournalPage, 'title' | 'content' | 'theme' | 'paperColor' | 'paperStyle'>>): Promise<JournalPage> => {
    const now = Date.now();
    const page: JournalPage = {
      id: nanoid(),
      title: partial?.title ?? 'Untitled Page',
      content: partial?.content ?? '',
      theme: partial?.theme ?? 'plain',
      paperColor: partial?.paperColor ?? 'theme',
      paperStyle: partial?.paperStyle ?? 'blank',
      createdAt: now,
      updatedAt: now,
    };
    await db.journalPages.add(page);
    await reload();
    return page;
  }, [reload]);

  const updatePage = useCallback(async (id: string, updates: Partial<JournalPage>) => {
    await db.journalPages.update(id, { ...updates, updatedAt: Date.now() });
    await reload();
  }, [reload]);

  const deletePage = useCallback(async (id: string) => {
    await db.journalPages.delete(id);
    await reload();
  }, [reload]);

  const linkToInvestigation = useCallback(async (id: string, investigationId: string) => {
    await db.journalPages.update(id, { linkedInvestigationId: investigationId, linkedAt: Date.now(), updatedAt: Date.now() });
    await reload();
  }, [reload]);

  return { pages, loading, createPage, updatePage, deletePage, linkToInvestigation, reload };
}

export const JOURNAL_THEME_LABELS: Record<JournalPageTheme, string> = {
  plain: 'Plain',
  paper: 'Paper',
  lined: 'Lined',
  bullet: 'Bullet',
  grid: 'Grid',
  cream: 'Cream',
  'blue-gray': 'Blue-Gray',
  sage: 'Sage',
  watermark: 'Watermark',
};

export con