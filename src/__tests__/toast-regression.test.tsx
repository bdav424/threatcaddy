import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Regression guard for the toast call sites that previously used a non-existent
// `showToast(message, type)` instead of `addToast(type, message)` (see UI-REVIEW-WORKLOAD P1-2).
// The type system already pins the method name + arg order (ToastType is the first arg); these
// tests pin the *wiring* — that the user action actually fires addToast with the correct values.

const mocks = vi.hoisted(() => ({ addToast: vi.fn() }));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ addToast: mocks.addToast, toasts: [], removeToast: vi.fn() }),
}));

vi.mock('../contexts/InvestigationContext', () => ({
  useInvestigation: () => ({ selectedFolderId: null, selectedFolder: null }),
}));

// SectionEditor (rendered inside ReportEditor) reads graph snapshots from Dexie; stub it.
vi.mock('../hooks/useGraphSnapshots', () => ({
  useGraphSnapshots: () => ({ snapshots: [], saveSnapshot: vi.fn(), updateCaption: vi.fn() }),
}));

import { ReportEditor } from '../components/ReportCaddy/ReportInstanceEditor';
import type { ActiveReport } from '../components/ReportCaddy/ReportInstanceEditor';
import type { ReportTemplate } from '../types';

beforeEach(() => {
  mocks.addToast.mockReset();
});

describe('toast regression — addToast(type, message) wiring', () => {
  it('ReportEditor copy-markdown fires addToast("success", "Copied to clipboard")', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const template = {
      id: 'tpl-1',
      name: 'Test Template',
      source: 'user',
      category: 'general',
      sections: [{ id: 's1', title: 'Summary', order: 0, placeholder: 'Write here.' }],
    } as unknown as ReportTemplate;

    const report: ActiveReport = {
      id: 'rep-1',
      title: 'Test Report',
      templateId: 'tpl-1',
      sections: [{ sectionId: 's1', content: 'Body text.' }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    render(
      <ReportEditor
        report={report}
        template={template}
        onUpdateSection={vi.fn()}
        onUpdateTitle={vi.fn()}
        onBack={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle('Copy Markdown'));

    await waitFor(() => {
      expect(mocks.addToast).toHaveBeenCalledWith('success', 'Copied to clipboard');
    });
    expect(writeText).toHaveBeenCalled();
  });

  // GraphView's capture path only calls a toast once the cytoscape canvas has laid out and
  // attached its imperative ref — which jsdom never does (no layout). Driving that branch in a
  // unit test means stubbing the lazy canvas AND the graph-data/filter pipeline, which is brittle.
  // The runtime contract (addToast(type, message), not the old showToast(message, type)) is already
  // compile-enforced by ToastType; this is a cheap, deterministic guard against reintroducing the
  // wrong call name/arg order in the snapshot handler specifically.
  it('GraphView snapshot handler uses addToast(type, message), not showToast', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/Graph/GraphView.tsx'), 'utf8');
    expect(src).not.toMatch(/showToast/);
    expect(src).toMatch(/addToast\(\s*['"]success['"]\s*,/);
    expect(src).toMatch(/addToast\(\s*['"]error['"]\s*,/);
  });
});
