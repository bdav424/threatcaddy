// src/components/VirtualCaddy/VirtualCaddyPanel.tsx
//
// Drop-zone and job-list panel for the VM sandbox → IOC ingest pipeline.
// Pairs with VirtualCaddyWorkspace (file-watcher viewer) under the same nav view.
//
// Air-gap invariant: no fetch/WebSocket/exec calls are made here.

import { useState, useEffect, useRef } from 'react';
import { liveQuery } from 'dexie';
import {
  Shield, UploadCloud, CheckCircle, Loader2, AlertTriangle,
  Clock, WifiOff, FileSearch,
} from 'lucide-react';
import { getVirtualCaddyBridge, isDesktopBridge } from '../../lib/bridges';
import {
  getInvestigationVirtualJobs,
  createVirtualCaddyJob,
  registerVirtualCaddyRendererHandlers,
} from '../../lib/virtual-bridge';
import { useInvestigation } from '../../contexts/InvestigationContext';
import { cn } from '../../lib/utils';
import type { VirtualCaddyJob } from '../../types';

// ── Status helpers ────────────────────────────────────────────────────────────

function statusBadgeClass(status: VirtualCaddyJob['status']): string {
  switch (status) {
    case 'queued':   return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    case 'running':  return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    case 'complete': return 'text-green-400 bg-green-500/10 border-green-500/20';
    case 'error':    return 'text-red-400 bg-red-500/10 border-red-500/20';
  }
}

function StatusIcon({ status }: { status: VirtualCaddyJob['status'] }) {
  switch (status) {
    case 'queued':   return <Clock size={11} />;
    case 'running':  return <Loader2 size={11} className="animate-spin" />;
    case 'complete': return <CheckCircle size={11} />;
    case 'error':    return <AlertTriangle size={11} />;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VirtualCaddyPanel() {
  const { selectedFolderId } = useInvestigation();
  const bridge = getVirtualCaddyBridge();
  const isDesktop = isDesktopBridge();

  const [isDragging, setIsDragging] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const subRef = useRef<{ unsubscribe: () => void } | null>(null);
  const [jobs, setJobs] = useState<VirtualCaddyJob[]>([]);

  // Reactive job list from Dexie
  useEffect(() => {
    if (!selectedFolderId) { setJobs([]); return; }
    const sub = liveQuery(() => getInvestigationVirtualJobs(selectedFolderId)).subscribe({
      next: (result) => setJobs(result),
      error: () => setJobs([]),
    });
    return () => sub.unsubscribe();
  }, [selectedFolderId]);

  // Register IPC listeners on mount — unsub on unmount
  useEffect(() => {
    if (!bridge || !selectedFolderId) return;
    const sub = registerVirtualCaddyRendererHandlers();
    subRef.current = sub;
    return () => sub.unsubscribe();
  }, [bridge, selectedFolderId]);

  // Forward CaddyAI enrichment trigger to the active chat input
  useEffect(() => {
    const handler = (ev: Event) => {
      const { prompt } = (ev as CustomEvent<{ prompt: string }>).detail;
      window.dispatchEvent(new CustomEvent('caddyai:prefill-prompt', { detail: { prompt } }));
    };
    window.addEventListener('virtualcaddy:enrich-iocs', handler);
    return () => window.removeEventListener('virtualcaddy:enrich-iocs', handler);
  }, []);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setSubmitError(null);
    if (!bridge || !selectedFolderId) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    for (const file of droppedFiles) {
      // Electron exposes the local filesystem path on the File object
      const filePath = (file as File & { path?: string }).path;
      if (!filePath) {
        setSubmitError('File path unavailable — VirtualCaddy static analysis requires the desktop app');
        return;
      }
      const jobId = await createVirtualCaddyJob(selectedFolderId, file.name, '');
      const result = await bridge.submitJob({ jobId, investigationId: selectedFolderId, filePath });
      if (!result.ok) {
        setSubmitError(result.error ?? 'Failed to submit file');
      }
    }
  };

  // ── Not in desktop ──────────────────────────────────────────────────────────
  if (!isDesktop || !bridge) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <FileSearch size={48} className="text-text-muted opacity-40" />
        <div>
          <p className="text-sm font-semibold text-text-primary">VirtualCaddy requires the desktop app</p>
          <p className="mt-1 max-w-sm text-xs text-text-secondary">
            Air-gapped static analysis is only available in the ThreatCaddy desktop app.
          </p>
        </div>
      </div>
    );
  }

  // ── Main view ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border-subtle/50 bg-bg-primary/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-accent shrink-0" />
          <span className="text-sm font-semibold text-text-primary">Static Analysis</span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-green-500/20 bg-green-500/8 px-2 py-0.5 text-[10px] font-semibold text-green-400">
            <WifiOff size={10} />
            Air-gapped · no network
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-text-secondary">
          Drop samples for offline SHA-256 hashing, string extraction, and IOC pattern matching. Results auto-ingest as IOCs, Notes, and Timeline events.
        </p>
      </div>

      {/* Drop zone */}
      <div className="shrink-0 p-4">
        <div
          role="region"
          aria-label="Drop zone for malware sample files"
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors select-none',
            isDragging
              ? 'border-accent/60 bg-accent/8'
              : 'border-border-subtle/60 bg-bg-raised/30 hover:border-border-medium/60 hover:bg-bg-raised/50',
          )}
        >
          <UploadCloud
            size={32}
            className={cn('transition-colors', isDragging ? 'text-accent' : 'text-text-muted opacity-40')}
          />
          <div className="text-center">
            <p className="text-[12px] font-semibold text-text-primary">Drop samples here</p>
            <p className="mt-0.5 text-[11px] text-text-muted">
              Any file type — executables, documents, archives
            </p>
          </div>
        </div>
        {submitError && (
          <div className="mt-2 flex items-center gap-1.5 rounded-[8px] border border-red-500/20 bg-red-500/8 px-2.5 py-1.5 text-[11px] text-red-400">
            <AlertTriangle size={11} />
            {submitError}
          </div>
        )}
      </div>

      {/* Job list */}
      <div className="flex flex-1 flex-col overflow-hidden border-t border-border-subtle/40">
        <div className="shrink-0 border-b border-border-subtle/30 px-4 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            Analysis jobs{jobs && jobs.length > 0 ? ` (${jobs.length})` : ''}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {!jobs || jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
              <FileSearch size={28} className="text-text-muted opacity-25" />
              <p className="text-[11px] text-text-muted">No analysis jobs yet — drop a file to begin</p>
            </div>
          ) : (
            <ul>
              {jobs.map((job) => (
                <li
                  key={job.id}
                  className="flex items-start gap-3 border-b border-border-subtle/30 px-4 py-3 last:border-0"
                >
                  <div className="mt-0.5 shrink-0">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                        statusBadgeClass(job.status),
                      )}
                    >
                      <StatusIcon status={job.status} />
                      {job.status}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-text-primary">{job.filename}</p>
                    {job.fileHash && (
                      <p className="mt-0.5 truncate font-mono text-[10px] text-text-muted">
                        {job.fileHash}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-text-muted">
                      <span>{new Date(job.submittedAt).toLocaleString()}</span>
                      {job.status === 'complete' && (
                        <span className="text-green-400">
                          {job.extractedIocCount} IOC{job.extractedIocCount === 1 ? '' : 's'} extracted
                        </span>
                      )}
                    </div>
                    {job.status === 'error' && job.errorMessage && (
                      <p className="mt-0.5 truncate text-[10px] text-red-400">{job.errorMessage}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
