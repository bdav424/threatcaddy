import { useState, useEffect, useCallback } from 'react';
import { db } from '../db';
import type { GraphSnapshot } from '../types';
import { nanoid } from 'nanoid';

export function useGraphSnapshots(folderId: string | null) {
  const [snapshots, setSnapshots] = useState<GraphSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (folderId == null) {
      setSnapshots([]);
      setLoading(false);
      return;
    }
    const rows = await db.graphSnapshots
      .where('folderId').equals(folderId)
      .reverse()
      .sortBy('createdAt');
    setSnapshots(rows.reverse());
    setLoading(false);
  }, [folderId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    void load();
  }, [load]);

  const saveSnapshot = useCallback(async (
    dataUrl: string,
    nodeCount: number,
    edgeCount: number,
    caption = '',
  ): Promise<GraphSnapshot> => {
    const snap: GraphSnapshot = {
      id: nanoid(),
      folderId,
      dataUrl,
      caption,
      nodeCount,
      edgeCount,
      createdAt: Date.now(),
    };
    await db.graphSnapshots.add(snap);
    setSnapshots(prev => [snap, ...prev]);
    return snap;
  }, [folderId]);

  const deleteSnapshot = useCallback(async (id: string) => {
    await db.graphSnapshots.delete(id);
    setSnapshots(prev => prev.filter(s => s.id !== id));
  }, []);

  const updateCaption = useCallback(async (id: string, caption: string) => {
    await db.graphSnapshots.update(id, { caption });
    setSnapshots(prev => prev.map(s => s.id === id ? { ...s, caption } : s));
  }, []);

  return { snapshots, loading, saveSnapshot, deleteSnapshot, updateCaption };
}
