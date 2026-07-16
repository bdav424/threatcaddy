import { useState, useEffect, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { db } from '../db';
import type { JournalBook } from '../types';

export function useJournalBooks() {
  const [books, setBooks] = useState<JournalBook[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const all = await db.journalBooks.orderBy('order').toArray();
    setBooks(all);
    setLoading(false);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const createBook = useCallback(async (name: string, investigationId?: string): Promise<JournalBook> => {
    const now = Date.now();
    const maxOrder = books.reduce((max, b) => Math.max(max, b.order), -1);
    const book: JournalBook = {
      id: nanoid(),
      name,
      investigationId,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.journalBooks.add(book);
    await reload();
    return book;
  }, [books, reload]);

  const updateBook = useCallback(async (id: string, updates: Partial<JournalBook>) => {
    await db.journalBooks.update(id, { ...updates, updatedAt: Date.now() });
    await reload();
  }, [reload]);

  const deleteBook = useCallback(async (id: string) => {
    await db.journalBooks.delete(id);
    await reload();
  }, [reload]);

  return { books, loading, createBook, updateBook, deleteBook, reload };
}
