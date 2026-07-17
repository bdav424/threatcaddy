import { useState, useEffect, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { db } from '../db';
import type { JournalCollection } from '../types';

export function useJournalCollections() {
  const [collections, setCollections] = useState<JournalCollection[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const all = await db.journalCollections.orderBy('order').toArray();
    setCollections(all);
    setLoading(false);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const createCollection = useCallback(async (name: string, investigationId?: string): Promise<JournalCollection> => {
    const now = Date.now();
    const maxOrder = collections.reduce((max, c) => Math.max(max, c.order), -1);
    const collection: JournalCollection = {
      id: nanoid(),
      name,
      investigationId,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.journalCollections.add(collection);
    await reload();
    return collection;
  }, [collections, reload]);

  const updateCollection = useCallback(async (id: string, updates: Partial<JournalCollection>) => {
    await db.journalCollections.update(id, { ...updates, updatedAt: Date.now() });
    await reload();
  }, [reload]);

  const deleteCollection = useCallback(async (id: string) => {
    await db.journalCollections.delete(id);
    await reload();
  }, [reload]);

  return { collections, loading, createCollection, updateCollection, deleteCollection, reload };
}
