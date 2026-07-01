import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../contexts/InvestigationContext', () => ({
  useInvestigation: () => ({ selectedFolderId: 'inv-1' }),
}));

vi.mock('../lib/bridges', () => ({
  getVirtualCaddyBridge: vi.fn(),
  isDesktopBridge: vi.fn(),
}));

vi.mock('../lib/virtual-bridge', () => ({
  getInvestigationVirtualJobs: vi.fn(() => Promise.resolve([])),
  createVirtualCaddyJob: vi.fn(() => Promise.resolve('job-new')),
  registerVirtualCaddyRendererHandlers: vi.fn(() => ({ unsubscribe: vi.fn() })),
}));

// VirtualCaddyPanel uses dexie.liveQuery inside useEffect.
// Return a stub Observable that resolves with an empty array.
vi.mock('dexie', async () => {
  const actual = await vi.importActual<typeof import('dexie')>('dexie');
  return {
    ...actual,
    liveQuery: () => ({
      subscribe: ({ next }: { next: (r: unknown) => void; error?: (e: unknown) => void }) => {
        Promise.resolve([]).then(next).catch(() => {});
        return { unsubscribe: vi.fn() };
      },
    }),
  };
});

import { getVirtualCaddyBridge, isDesktopBridge } from '../lib/bridges';
import { VirtualCaddyPanel } from '../components/VirtualCaddy/VirtualCaddyPanel';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('VirtualCaddyPanel', () => {
  beforeEach(() => {
    vi.mocked(isDesktopBridge).mockReturnValue(false);
    vi.mocked(getVirtualCaddyBridge).mockReturnValue(null);
  });

  it('shows desktop-only fallback when not in Electron', () => {
    render(<VirtualCaddyPanel />);
    expect(screen.getByText(/requires the desktop app/i)).toBeDefined();
  });

  it('shows drop zone and job list when desktop bridge is available', () => {
    vi.mocked(isDesktopBridge).mockReturnValue(true);
    vi.mocked(getVirtualCaddyBridge).mockReturnValue({
      submitJob: vi.fn(),
      getIngestDir: vi.fn(),
      setIngestDir: vi.fn(),
      getJobsStatus: vi.fn(),
      onJobComplete: vi.fn(() => () => {}),
      onJobStatus: vi.fn(() => () => {}),
      onJobError: vi.fn(() => () => {}),
      onFileDetected: vi.fn(() => () => {}),
      onWatchError: vi.fn(() => () => {}),
    });

    render(<VirtualCaddyPanel />);
    expect(screen.getByText(/static analysis/i)).toBeDefined();
    expect(screen.getByText(/drop samples here/i)).toBeDefined();
    expect(screen.getByText(/no analysis jobs yet/i)).toBeDefined();
  });

  it('shows air-gapped badge', () => {
    vi.mocked(isDesktopBridge).mockReturnValue(true);
    vi.mocked(getVirtualCaddyBridge).mockReturnValue({
      submitJob: vi.fn(),
      getIngestDir: vi.fn(),
      setIngestDir: vi.fn(),
      getJobsStatus: vi.fn(),
      onJobComplete: vi.fn(() => () => {}),
      onJobStatus: vi.fn(() => () => {}),
      onJobError: vi.fn(() => () => {}),
      onFileDetected: vi.fn(() => () => {}),
      onWatchError: vi.fn(() => () => {}),
    });

    render(<VirtualCaddyPanel />);
    expect(screen.getByText(/air-gapped/i)).toBeDefined();
  });
});
