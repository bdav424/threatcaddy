import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { executeTool } from '../lib/llm-tools';
import type { ToolUseBlock } from '../types';

function makeToolUse(name: string, input: Record<string, unknown> = {}): ToolUseBlock {
  return { type: 'tool_use', id: `tool-${name}`, name, input };
}

describe('read_evidence recovery', () => {
  beforeEach(async () => {
    await db.evidenceItems.clear();
    await db.evidenceItems.add({
      id: 'ev1', title: 'Malware Report', folderId: 'f1', fileName: 'report.pdf',
      fileType: 'pdf', size: 1000, content: 'malicious content here',
      extractionStatus: 'complete', importedAt: Date.now(), chunkIndex: 0, chunkCount: 1,
      tags: [], createdAt: Date.now(), updatedAt: Date.now(), trashed: false, archived: false,
    } as never);
  });

  it('falls back to title matching when a hallucinated id fails to resolve', async () => {
    const { result } = await executeTool(makeToolUse('read_evidence', { id: 'wrong-hallucinated-id', title: 'Malware Report' }), 'f1');
    const parsed = JSON.parse(result);
    expect(parsed.error).toBeUndefined();
    expect(parsed.title).toBe('Malware Report');
  });

  it('lists available evidence when nothing matches at all', async () => {
    const { result } = await executeTool(makeToolUse('read_evidence', { id: 'totally-wrong' }), 'f1');
    const parsed = JSON.parse(result);
    expect(parsed.error).toBeTruthy();
    expect(parsed.available).toEqual([{ id: 'ev1', title: 'Malware Report', fileName: 'report.pdf' }]);
  });

  it('matches when the query is a superstring of the real title (paraphrase-tolerant)', async () => {
    const { result } = await executeTool(makeToolUse('read_evidence', { title: 'the Malware Report file' }), 'f1');
    const parsed = JSON.parse(result);
    expect(parsed.error).toBeUndefined();
    expect(parsed.id).toBe('ev1');
  });
});
