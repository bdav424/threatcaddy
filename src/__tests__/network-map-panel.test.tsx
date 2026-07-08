import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../contexts/InvestigationContext', () => ({
  useInvestigation: () => ({ selectedFolderId: 'inv-1' }),
}));

vi.mock('../lib/bridges', () => ({
  getNetmapBridge: vi.fn(),
  isDesktopBridge: vi.fn(),
}));

vi.mock('../lib/netmap-bridge', () => ({
  getNetmapScanJobs: vi.fn(() => Promise.resolve([])),
  createNetmapScanJob: vi.fn(() => Promise.resolve()),
  registerNetmapRendererHandlers: vi.fn(() => ({ unsubscribe: vi.fn() })),
}));

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

vi.mock('nanoid', () => ({ nanoid: () => 'test-id-123' }));

import { getNetmapBridge, isDesktopBridge } from '../lib/bridges';
import { createNetmapScanJob } from '../lib/netmap-bridge';
import { NetworkMapPanel } from '../components/NetMap/NetworkMapPanel';

// ── Bridge factory ────────────────────────────────────────────────────────────

function makeMockBridge(overrides = {}) {
  return {
    startScan: vi.fn(() =>
      Promise.resolve({ ok: true, scanJobId: 'job-new', subnet: '192.168.1.0/24', startedAt: new Date().toISOString() }),
    ),
    detectSubnet: vi.fn(() => Promise.resolve({ subnet: '192.168.1.0/24' })),
    onDeviceFound: vi.fn(() => vi.fn()),
    onScanComplete: vi.fn(() => vi.fn()),
    scan: vi.fn(),
    arpOnly: vi.fn(),
    ping: vi.fn(),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NetworkMapPanel', () => {
  beforeEach(() => {
    vi.mocked(isDesktopBridge).mockReturnValue(false);
    vi.mocked(getNetmapBridge).mockReturnValue(null);
  });

  it('shows desktop-only fallback when not in Electron', async () => {
    render(<NetworkMapPanel />);
    await act(async () => {});
    expect(screen.getByText(/requires the desktop app/i)).toBeDefined();
  });

  it('renders scan button when desktop bridge is available', async () => {
    vi.mocked(isDesktopBridge).mockReturnValue(true);
    vi.mocked(getNetmapBridge).mockReturnValue(makeMockBridge());

    render(<NetworkMapPanel />);
    await act(async () => {});
    expect(screen.getByRole('button', { name: /scan network/i })).toBeDefined();
  });

  it('shows LAN-only badge', async () => {
    vi.mocked(isDesktopBridge).mockReturnValue(true);
    vi.mocked(getNetmapBridge).mockReturnValue(makeMockBridge());

    render(<NetworkMapPanel />);
    await act(async () => {});
    expect(screen.getByText(/LAN only/i)).toBeDefined();
  });

  it('shows empty state when no devices are found', async () => {
    vi.mocked(isDesktopBridge).mockReturnValue(true);
    vi.mocked(getNetmapBridge).mockReturnValue(makeMockBridge());

    render(<NetworkMapPanel />);
    await act(async () => {});
    expect(screen.getByText(/no scan yet/i)).toBeDefined();
  });

  it('calls bridge.startScan and createNetmapScanJob when Scan Network is clicked', async () => {
    const bridge = makeMockBridge();
    vi.mocked(isDesktopBridge).mockReturnValue(true);
    vi.mocked(getNetmapBridge).mockReturnValue(bridge);

    render(<NetworkMapPanel />);
    await act(async () => {});

    const scanBtn = screen.getByRole('button', { name: /scan network/i });
    await userEvent.click(scanBtn);

    expect(bridge.startScan).toHaveBeenCalledWith(
      expect.objectContaining({ investigationId: 'inv-1' }),
    );
    expect(vi.mocked(createNetmapScanJob)).toHaveBeenCalledWith(
      'inv-1', 'job-new', '192.168.1.0/24', expect.any(String),
    );
  });

  it('shows scanning spinner text while scan is in progress', async () => {
    let resolveStartScan!: (v: unknown) => void;
    const startScanPromise = new Promise((r) => { resolveStartScan = r; });
    const bridge = makeMockBridge({ startScan: vi.fn(() => startScanPromise) });
    vi.mocked(isDesktopBridge).mockReturnValue(true);
    vi.mocked(getNetmapBridge).mockReturnValue(bridge);

    render(<NetworkMapPanel />);
    await act(async () => {});
    const scanBtn = screen.getByRole('button', { name: /scan network/i });
    await userEvent.click(scanBtn);

    expect(screen.getByText(/scanning/i)).toBeDefined();

    // Clean up pending promise
    resolveStartScan({ ok: false, error: 'test abort' });
    await act(async () => {});
  });
});
