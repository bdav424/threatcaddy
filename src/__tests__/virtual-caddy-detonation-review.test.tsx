import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { db } from '../db';
import type { VirtualBridge } from '../lib/bridges';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../contexts/InvestigationContext', () => ({
  useInvestigation: () => ({ selectedFolderId: 'inv-1' }),
}));

vi.mock('../lib/bridges', () => ({
  getVirtualBridge: vi.fn(),
  isDesktopBridge: vi.fn(),
}));

import { getVirtualBridge, isDesktopBridge } from '../lib/bridges';
import { VirtualCaddyDetonationReview } from '../components/VirtualCaddy/VirtualCaddyDetonationReview';

// 1x1 transparent PNG, base64-encoded — a real, minimal, decodable image for the
// screenshot-gallery path.
const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function makeBridge(overrides: Partial<VirtualBridge> = {}): VirtualBridge {
  return {
    setWatchDir: vi.fn(),
    getWatchDir: vi.fn(),
    listFiles: vi.fn(async () => ({ files: [] })),
    readFile: vi.fn(async () => ({ ok: false, error: 'not mocked' })),
    stopWatch: vi.fn(),
    getStatus: vi.fn(),
    onFileChanged: vi.fn(() => () => {}),
    onWatchError: vi.fn(() => () => {}),
    ...overrides,
  };
}

describe('VirtualCaddyDetonationReview', () => {
  beforeEach(async () => {
    await db.notes.clear();
    vi.mocked(isDesktopBridge).mockReturnValue(false);
    vi.mocked(getVirtualBridge).mockReturnValue(null);
  });

  it('shows desktop-only fallback when not in Electron', () => {
    render(<VirtualCaddyDetonationReview />);
    expect(screen.getByText(/requires the desktop app/i)).toBeInTheDocument();
  });

  it('shows an empty state when the watch directory has no recognized artifacts', async () => {
    vi.mocked(isDesktopBridge).mockReturnValue(true);
    vi.mocked(getVirtualBridge).mockReturnValue(makeBridge({
      listFiles: vi.fn(async () => ({
        files: [{ name: 'random-notes.log', relativePath: 'random-notes.log', size: 100, mtimeMs: Date.now(), ctimeMs: Date.now() }],
      })),
    }));

    render(<VirtualCaddyDetonationReview />);
    await waitFor(() => expect(screen.getByText(/no screenshots, report, or pcap summary recognized/i)).toBeInTheDocument());
  });

  it('renders a screenshot thumbnail and opens it in the lightbox', async () => {
    vi.mocked(isDesktopBridge).mockReturnValue(true);
    const bridge = makeBridge({
      listFiles: vi.fn(async () => ({
        files: [{ name: 'desktop.png', relativePath: 'desktop.png', size: 1024, mtimeMs: Date.now(), ctimeMs: Date.now() }],
      })),
      readFile: vi.fn(async (relativePath: string) => {
        if (relativePath === 'desktop.png') return { ok: true, content: TINY_PNG_BASE64, encoding: 'base64' as const };
        return { ok: false, error: 'unexpected path' };
      }),
    });
    vi.mocked(getVirtualBridge).mockReturnValue(bridge);

    render(<VirtualCaddyDetonationReview />);

    const thumbButton = await waitFor(() => {
      const btn = screen.getByRole('button', { name: '' }); // image button has no accessible name beyond alt text on <img>
      return btn;
    });
    const img = within(thumbButton).getByAltText('desktop.png') as HTMLImageElement;
    expect(img.src).toMatch(/^data:image\/png;base64,/);

    fireEvent.click(thumbButton);
    expect(screen.getByRole('dialog', { name: /screenshot viewer: desktop\.png/i })).toBeInTheDocument();
  });

  it('shows a size-cap message instead of loading an oversized screenshot', async () => {
    vi.mocked(isDesktopBridge).mockReturnValue(true);
    const readFile = vi.fn();
    vi.mocked(getVirtualBridge).mockReturnValue(makeBridge({
      listFiles: vi.fn(async () => ({
        files: [{ name: 'huge.png', relativePath: 'huge.png', size: 20 * 1024 * 1024, mtimeMs: Date.now(), ctimeMs: Date.now() }],
      })),
      readFile,
    }));

    render(<VirtualCaddyDetonationReview />);
    await waitFor(() => expect(screen.getByText(/too large to preview/i)).toBeInTheDocument());
    expect(readFile).not.toHaveBeenCalled();
  });

  it('parses a JSON pcap summary into a table', async () => {
    vi.mocked(isDesktopBridge).mockReturnValue(true);
    const summary = JSON.stringify([
      { srcIp: '203.0.113.5', dstIp: '198.51.100.9', protocol: 'tcp', bytes: '4096' },
    ]);
    vi.mocked(getVirtualBridge).mockReturnValue(makeBridge({
      listFiles: vi.fn(async () => ({
        files: [{ name: 'pcap-summary.json', relativePath: 'pcap-summary.json', size: summary.length, mtimeMs: Date.now(), ctimeMs: Date.now() }],
      })),
      readFile: vi.fn(async () => ({ ok: true, content: summary, encoding: 'utf8' as const })),
    }));

    render(<VirtualCaddyDetonationReview />);
    await waitFor(() => expect(screen.getByText('203.0.113.5')).toBeInTheDocument());
    expect(screen.getByText('198.51.100.9')).toBeInTheDocument();
    expect(screen.getByText('srcIp')).toBeInTheDocument();
  });

  it('parses a CSV pcap summary into a table', async () => {
    vi.mocked(isDesktopBridge).mockReturnValue(true);
    const csv = 'srcIp,dstIp,packets\n203.0.113.5,198.51.100.9,42\n';
    vi.mocked(getVirtualBridge).mockReturnValue(makeBridge({
      listFiles: vi.fn(async () => ({
        files: [{ name: 'traffic-conv.csv', relativePath: 'traffic-conv.csv', size: csv.length, mtimeMs: Date.now(), ctimeMs: Date.now() }],
      })),
      readFile: vi.fn(async () => ({ ok: true, content: csv, encoding: 'utf8' as const })),
    }));

    render(<VirtualCaddyDetonationReview />);
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
  });

  it('renders report markdown and strips embedded script tags (sanitization)', async () => {
    vi.mocked(isDesktopBridge).mockReturnValue(true);
    const report = '# Verdict: malicious\n\nDropped `evil.exe`.\n\n<script>window.__pwned = true;</script>';
    vi.mocked(getVirtualBridge).mockReturnValue(makeBridge({
      listFiles: vi.fn(async () => ({
        files: [{ name: 'report.md', relativePath: 'report.md', size: report.length, mtimeMs: Date.now(), ctimeMs: Date.now() }],
      })),
      readFile: vi.fn(async () => ({ ok: true, content: report, encoding: 'utf8' as const })),
    }));

    render(<VirtualCaddyDetonationReview />);
    await waitFor(() => expect(screen.getByText('Verdict: malicious')).toBeInTheDocument());
    expect(document.querySelector('script')).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
  });

  it('compiles a Detonation Report note from the currently loaded artifacts', async () => {
    vi.mocked(isDesktopBridge).mockReturnValue(true);
    const report = '# Verdict: malicious';
    vi.mocked(getVirtualBridge).mockReturnValue(makeBridge({
      listFiles: vi.fn(async () => ({
        files: [{ name: 'report.md', relativePath: 'report.md', size: report.length, mtimeMs: Date.now(), ctimeMs: Date.now() }],
      })),
      readFile: vi.fn(async () => ({ ok: true, content: report, encoding: 'utf8' as const })),
    }));

    render(<VirtualCaddyDetonationReview />);
    await waitFor(() => expect(screen.getByText('Verdict: malicious')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /compile detonation report/i }));
    await waitFor(() => expect(screen.getByText(/note created/i)).toBeInTheDocument());

    const notes = await db.notes.where('folderId').equals('inv-1').toArray();
    expect(notes).toHaveLength(1);
    expect(notes[0].content).toContain('Verdict: malicious');
    expect(notes[0].tags).toContain('detonation-report');
  });
});
