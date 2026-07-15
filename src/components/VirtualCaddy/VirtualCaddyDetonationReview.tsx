// src/components/VirtualCaddy/VirtualCaddyDetonationReview.tsx
//
// Read-only artifact viewer for a VM's detonation output: screenshots, a packet-capture
// summary, and an analysis report. Files are produced by a VM you run yourself and land
// in the same watched directory VirtualCaddyWorkspace already reads from — this view just
// classifies and renders them instead of showing one flat file list.
//
// Air-gap invariant: no fetch/WebSocket/exec calls are made here or anywhere in the
// desktop bridge this reads from (see desktop/virtual-bridge.mjs). Reads go through the
// existing virtual:read-file IPC handler, which already resolves relativePath against the
// watched directory and rejects anything that escapes it (path traversal guard) — this
// component never constructs filesystem paths itself, only passes back relativePath values
// the bridge already gave it.
//
// Security notes (content here can originate indirectly from an analyzed malware sample,
// so it is treated as untrusted):
// - Report markdown goes through the same renderMarkdown()/DOMPurify pipeline as Notes —
//   no separate, unaudited HTML rendering path.
// - Report/pcap-summary JSON and CSV are parsed defensively (try/catch, no eval) and
//   rendered as plain React text nodes (table cells, <pre> blocks) — never
//   dangerouslySetInnerHTML — so malformed or hostile content can't inject markup.
// - Screenshot <img> src values are data: URIs this component builds itself from a
//   fixed extension allowlist + the base64 bytes the bridge returned; filenames/paths
//   from the watched directory never flow into a URI scheme or attribute unescaped.
// - Size caps (MAX_IMAGE_BYTES / MAX_TEXT_BYTES) and a screenshot count cap prevent a
//   huge or numerous set of dropped files from hanging the renderer.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Image as ImageIcon, FileText, Network, Loader2, Monitor, AlertTriangle,
  X, ChevronLeft, ChevronRight, CheckCircle, Sparkles,
} from 'lucide-react';
import { getVirtualBridge, isDesktopBridge } from '../../lib/bridges';
import type { VirtualFile } from '../../types';
import { useInvestigation } from '../../contexts/InvestigationContext';
import { useNotes } from '../../hooks/useNotes';
import { renderMarkdown } from '../../lib/markdown';
import { cn } from '../../lib/utils';

const IMAGE_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
};
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB per screenshot
const MAX_TEXT_BYTES = 2 * 1024 * 1024; // 2MB for report/pcap-summary text
const MAX_GALLERY_SCREENSHOTS = 24; // cap concurrent image loads

type ArtifactKind = 'screenshot' | 'pcap-summary' | 'report' | 'other';

interface ClassifiedFile extends VirtualFile {
  kind: ArtifactKind;
}

interface PcapSummaryRow {
  [key: string]: string;
}

function extOf(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase();
}

function classify(file: VirtualFile): ArtifactKind {
  const ext = extOf(file.name);
  const base = file.name.toLowerCase();
  if (ext in IMAGE_MIME) return 'screenshot';
  if (base.startsWith('report') && (ext === 'md' || ext === 'txt' || ext === 'json')) return 'report';
  if ((ext === 'json' || ext === 'csv') && (base.includes('pcap') || base.includes('conv') || base.includes('traffic'))) return 'pcap-summary';
  if (ext === 'md') return 'report';
  return 'other';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Naive CSV parse — no quoted-comma handling. Good enough for tshark-style field exports. */
function parseCsv(text: string): PcapSummaryRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row: PcapSummaryRow = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? '').trim(); });
    return row;
  });
}

function parsePcapSummary(text: string, isJson: boolean): { rows: PcapSummaryRow[]; error?: string } {
  if (!isJson) {
    try {
      return { rows: parseCsv(text) };
    } catch {
      return { rows: [], error: 'Could not parse as CSV' };
    }
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return { rows: [], error: 'Expected a JSON array of records' };
    const rows = parsed
      .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
      .map((r) => {
        const row: PcapSummaryRow = {};
        for (const [k, v] of Object.entries(r)) row[k] = String(v);
        return row;
      });
    return { rows };
  } catch {
    return { rows: [], error: 'Could not parse as JSON' };
  }
}

export function VirtualCaddyDetonationReview() {
  const { selectedFolderId } = useInvestigation();
  const { createNote } = useNotes(selectedFolderId);
  const bridge = getVirtualBridge();
  const isDesktop = isDesktopBridge();

  const [files, setFiles] = useState<ClassifiedFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [screenshotData, setScreenshotData] = useState<Record<string, string>>({}); // relativePath -> data URI
  const [screenshotErrors, setScreenshotErrors] = useState<Record<string, string>>({});
  const [reportText, setReportText] = useState<{ file: ClassifiedFile; content: string } | null>(null);
  const [pcapSummary, setPcapSummary] = useState<{ file: ClassifiedFile; rows: PcapSummaryRow[]; error?: string } | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [compileStatus, setCompileStatus] = useState<'idle' | 'compiling' | 'ok' | 'error'>('idle');

  const refresh = useCallback(async () => {
    if (!bridge) return;
    setIsLoadingFiles(true);
    const result = await bridge.listFiles();
    const classified = (result.files ?? []).map((f) => ({ ...f, kind: classify(f) }));
    setFiles(classified);
    setIsLoadingFiles(false);
  }, [bridge]);

  useEffect(() => {
    if (!bridge) return;
    refresh();
    const unsub = bridge.onFileChanged(() => { refresh(); });
    return unsub;
  }, [bridge, refresh]);

  const screenshots = useMemo(() => files.filter((f) => f.kind === 'screenshot'), [files]);
  const reportFile = useMemo(() => files.filter((f) => f.kind === 'report').sort((a, b) => b.mtimeMs - a.mtimeMs)[0], [files]);
  const pcapFile = useMemo(() => files.filter((f) => f.kind === 'pcap-summary').sort((a, b) => b.mtimeMs - a.mtimeMs)[0], [files]);

  // Load screenshot thumbnails (capped) whenever the list changes
  useEffect(() => {
    if (!bridge) return;
    let cancelled = false;
    (async () => {
      for (const file of screenshots.slice(0, MAX_GALLERY_SCREENSHOTS)) {
        if (screenshotData[file.relativePath] || screenshotErrors[file.relativePath]) continue;
        if (file.size > MAX_IMAGE_BYTES) {
          if (!cancelled) setScreenshotErrors((prev) => ({ ...prev, [file.relativePath]: `Too large to preview (${formatBytes(file.size)})` }));
          continue;
        }
        const mime = IMAGE_MIME[extOf(file.name)];
        const result = await bridge.readFile(file.relativePath);
        if (cancelled) return;
        if (result.ok && result.content && result.encoding === 'base64' && mime) {
          setScreenshotData((prev) => ({ ...prev, [file.relativePath]: `data:${mime};base64,${result.content}` }));
        } else {
          setScreenshotErrors((prev) => ({ ...prev, [file.relativePath]: result.error ?? 'Could not read file' }));
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge, screenshots]);

  // Load the latest report file
  useEffect(() => {
    if (!bridge || !reportFile) { setReportText(null); return; }
    if (reportFile.size > MAX_TEXT_BYTES) {
      setReportText({ file: reportFile, content: `_Report too large to preview (${formatBytes(reportFile.size)}) — open via File Watch to inspect._` });
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await bridge.readFile(reportFile.relativePath);
      if (cancelled) return;
      if (result.ok && result.content !== undefined && result.encoding === 'utf8') {
        let content = result.content;
        if (extOf(reportFile.name) === 'json') {
          try {
            content = '```json\n' + JSON.stringify(JSON.parse(result.content), null, 2) + '\n```';
          } catch {
            content = '```\n' + result.content + '\n```';
          }
        }
        setReportText({ file: reportFile, content });
      } else {
        setReportText({ file: reportFile, content: `_Could not read report: ${result.error ?? 'unknown error'}_` });
      }
    })();
    return () => { cancelled = true; };
  }, [bridge, reportFile]);

  // Load the latest pcap-summary file
  useEffect(() => {
    if (!bridge || !pcapFile) { setPcapSummary(null); return; }
    if (pcapFile.size > MAX_TEXT_BYTES) {
      setPcapSummary({ file: pcapFile, rows: [], error: `Too large to preview (${formatBytes(pcapFile.size)})` });
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await bridge.readFile(pcapFile.relativePath);
      if (cancelled) return;
      if (result.ok && result.content !== undefined && result.encoding === 'utf8') {
        const parsed = parsePcapSummary(result.content, extOf(pcapFile.name) === 'json');
        setPcapSummary({ file: pcapFile, ...parsed });
      } else {
        setPcapSummary({ file: pcapFile, rows: [], error: result.error ?? 'Could not read file' });
      }
    })();
    return () => { cancelled = true; };
  }, [bridge, pcapFile]);

  const pcapColumns = useMemo(() => {
    if (!pcapSummary?.rows.length) return [];
    return Object.keys(pcapSummary.rows[0]);
  }, [pcapSummary]);

  const handleCompile = async () => {
    setCompileStatus('compiling');
    try {
      const lines: string[] = [
        `# Detonation Report`,
        '',
        `*Compiled from air-gapped VM ingest — no network activity.*`,
        '',
      ];
      if (reportText) {
        lines.push(`## Analysis Report (${reportText.file.name})`, '', reportText.content, '');
      }
      if (pcapSummary && pcapColumns.length > 0) {
        lines.push(`## Packet Capture Summary (${pcapSummary.file.name})`, '');
        lines.push(`| ${pcapColumns.join(' | ')} |`);
        lines.push(`| ${pcapColumns.map(() => '---').join(' | ')} |`);
        for (const row of pcapSummary.rows.slice(0, 200)) {
          lines.push(`| ${pcapColumns.map((c) => row[c] ?? '').join(' | ')} |`);
        }
        if (pcapSummary.rows.length > 200) lines.push('', `*... and ${pcapSummary.rows.length - 200} more rows — see the raw file.*`);
        lines.push('');
      } else if (pcapSummary?.error) {
        lines.push(`## Packet Capture Summary (${pcapSummary.file.name})`, '', `_${pcapSummary.error}_`, '');
      }
      if (screenshots.length > 0) {
        lines.push(`## Screenshots (${screenshots.length})`, '');
        for (const s of screenshots) {
          lines.push(`- \`${s.name}\` — ${formatBytes(s.size)}, ${new Date(s.mtimeMs).toLocaleString()}`);
        }
        lines.push('', '*View screenshots in the Detonation Review tab, or File Watch to export them.*', '');
      }
      if (!reportText && !pcapSummary && screenshots.length === 0) {
        lines.push('_No classified artifacts were found in the watched directory yet._');
      }

      await createNote({
        title: `Detonation Report — ${new Date().toLocaleString()}`,
        content: lines.join('\n'),
        tags: ['virtualcaddy', 'detonation-report'],
        folderId: selectedFolderId,
      });
      setCompileStatus('ok');
      setTimeout(() => setCompileStatus('idle'), 2500);
    } catch {
      setCompileStatus('error');
      setTimeout(() => setCompileStatus('idle'), 2500);
    }
  };

  if (!isDesktop || !bridge) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <Monitor size={48} className="text-text-muted opacity-40" />
        <div>
          <p className="text-sm font-semibold text-text-primary">Detonation Review requires the desktop app</p>
          <p className="mt-1 max-w-sm text-xs text-text-secondary">
            Reading VM artifacts is only available in the ThreatCaddy desktop app.
          </p>
        </div>
      </div>
    );
  }

  const hasAnything = screenshots.length > 0 || !!reportFile || !!pcapFile;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border-subtle/50 bg-bg-primary/60 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-sm font-semibold text-text-primary">Detonation Review</span>
            <p className="mt-0.5 text-[11px] text-text-secondary">
              Screenshots, packet-capture summary, and report dropped by a VM you run — recognized by filename (screenshots: .png/.jpg/.gif/.webp; report: report.md/.txt/.json or any .md; pcap summary: *pcap*/*conv*/*traffic*.json/.csv).
            </p>
          </div>
          <button
            type="button"
            onClick={handleCompile}
            disabled={compileStatus === 'compiling' || !selectedFolderId}
            className={cn(
              'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border px-3 text-[11px] font-semibold transition-colors',
              compileStatus === 'ok'
                ? 'border-green-500/25 bg-green-500/10 text-green-400'
                : compileStatus === 'error'
                ? 'border-red-500/25 bg-red-500/8 text-red-400'
                : 'border-accent/25 bg-accent/10 text-accent hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            {compileStatus === 'compiling' ? (
              <><Loader2 size={12} className="animate-spin" />Compiling…</>
            ) : compileStatus === 'ok' ? (
              <><CheckCircle size={12} />Note created</>
            ) : (
              <><Sparkles size={12} />Compile Detonation Report</>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {isLoadingFiles && files.length === 0 && (
          <div className="flex items-center justify-center gap-2 p-8">
            <Loader2 size={14} className="animate-spin text-text-muted" />
            <span className="text-[12px] text-text-muted">Loading…</span>
          </div>
        )}

        {!isLoadingFiles && !hasAnything && (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <ImageIcon size={28} className="text-text-muted opacity-25" />
            <p className="text-[11px] text-text-muted">No screenshots, report, or pcap summary recognized yet — configure a watch directory under File Watch.</p>
          </div>
        )}

        {/* Screenshots */}
        {screenshots.length > 0 && (
          <section aria-label="Screenshots">
            <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              <ImageIcon size={12} /> Screenshots ({screenshots.length})
            </h4>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {screenshots.slice(0, MAX_GALLERY_SCREENSHOTS).map((file, i) => {
                const dataUri = screenshotData[file.relativePath];
                const error = screenshotErrors[file.relativePath];
                return (
                  <button
                    key={file.relativePath}
                    type="button"
                    disabled={!dataUri}
                    onClick={() => setLightboxIndex(i)}
                    className="group flex aspect-video items-center justify-center overflow-hidden rounded-[10px] border border-border-subtle/60 bg-bg-raised/40 disabled:cursor-default"
                  >
                    {dataUri ? (
                      <img src={dataUri} alt={file.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    ) : error ? (
                      <div className="flex flex-col items-center gap-1 p-2 text-center">
                        <AlertTriangle size={14} className="text-amber-400" />
                        <span className="text-[9px] text-text-muted">{error}</span>
                      </div>
                    ) : (
                      <Loader2 size={14} className="animate-spin text-text-muted" />
                    )}
                  </button>
                );
              })}
            </div>
            {screenshots.length > MAX_GALLERY_SCREENSHOTS && (
              <p className="mt-2 text-[10px] text-text-muted">
                {screenshots.length - MAX_GALLERY_SCREENSHOTS} more screenshot(s) not shown — browse them all under File Watch.
              </p>
            )}
          </section>
        )}

        {/* Packet capture summary */}
        {pcapSummary && (
          <section aria-label="Packet capture summary">
            <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              <Network size={12} /> Packet Capture Summary
              <span className="font-mono text-[10px] normal-case tracking-normal text-text-muted/70">{pcapSummary.file.name}</span>
            </h4>
            {pcapSummary.error ? (
              <p className="text-[11px] text-red-400">{pcapSummary.error}</p>
            ) : pcapColumns.length === 0 ? (
              <p className="text-[11px] text-text-muted">No rows found.</p>
            ) : (
              <div className="overflow-x-auto rounded-[10px] border border-border-subtle/60">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-bg-raised/60">
                    <tr>
                      {pcapColumns.map((col) => (
                        <th key={col} className="whitespace-nowrap px-2.5 py-1.5 font-semibold text-text-secondary">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pcapSummary.rows.slice(0, 100).map((row, i) => (
                      <tr key={i} className="border-t border-border-subtle/30">
                        {pcapColumns.map((col) => (
                          <td key={col} className="whitespace-nowrap px-2.5 py-1.5 font-mono text-text-primary">{row[col]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pcapSummary.rows.length > 100 && (
                  <p className="px-2.5 py-1.5 text-[10px] text-text-muted">... and {pcapSummary.rows.length - 100} more rows.</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Report */}
        {reportText && (
          <section aria-label="Analysis report">
            <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              <FileText size={12} /> Analysis Report
              <span className="font-mono text-[10px] normal-case tracking-normal text-text-muted/70">{reportText.file.name}</span>
            </h4>
            <div
              className="prose prose-sm prose-invert max-w-none rounded-[10px] border border-border-subtle/60 bg-bg-raised/30 p-3 text-[12px]"
              // Sanitized by renderMarkdown()/DOMPurify (see file header) — same pipeline Notes use.
              dangerouslySetInnerHTML={{ __html: renderMarkdown(reportText.content) }}
            />
          </section>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && screenshots[lightboxIndex] && (
        <ScreenshotLightbox
          files={screenshots.slice(0, MAX_GALLERY_SCREENSHOTS)}
          data={screenshotData}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

function ScreenshotLightbox({
  files, data, index, onIndexChange, onClose,
}: {
  files: ClassifiedFile[];
  data: Record<string, string>;
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const file = files[index];
  const uri = data[file.relativePath];

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndexChange((index + 1) % files.length);
      if (e.key === 'ArrowLeft') onIndexChange((index - 1 + files.length) % files.length);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [index, files.length, onIndexChange, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Screenshot viewer: ${file.name}`}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-4">
        <span className="max-w-md truncate text-sm text-white">{file.name}</span>
        <button onClick={onClose} className="rounded-full p-2 text-white hover:bg-white/10" aria-label="Close screenshot viewer">
          <X size={18} />
        </button>
      </div>
      {files.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onIndexChange((index - 1 + files.length) % files.length); }}
            className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
            aria-label="Previous screenshot"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onIndexChange((index + 1) % files.length); }}
            className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
            aria-label="Next screenshot"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}
      <div className="flex max-h-[85vh] max-w-[90vw] items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {uri && <img src={uri} alt={file.name} className="max-h-[85vh] max-w-full rounded object-contain" />}
      </div>
      {files.length > 1 && (
        <div role="status" aria-live="polite" className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
          {index + 1} / {files.length}
        </div>
      )}
    </div>
  );
}
