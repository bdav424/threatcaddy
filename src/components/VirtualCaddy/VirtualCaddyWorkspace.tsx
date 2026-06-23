// src/components/VirtualCaddy/VirtualCaddyWorkspace.tsx
//
// Read-only ingest panel for files written by a VM into a shared/watched directory.
// The desktop process (virtual-bridge.mjs) owns the fs.watch and fs.readFileSync;
// this renderer component only displays results and stages ingested content as Notes.
//
// Air-gap invariant: no fetch/WebSocket/exec calls are made here or in the bridge.

import { useState, useEffect, useCallback, useRef } from 'react';
import { Monitor, FolderOpen, RefreshCw, FileText, AlertTriangle, CheckCircle, WifiOff, Loader2, X, Download } from 'lucide-react';
import { getVirtualBridge, isDesktopBridge } from '../../lib/bridges';
import type { VirtualFile } from '../../types';
import { useInvestigation } from '../../contexts/InvestigationContext';
import { useNotes } from '../../hooks/useNotes';
import { cn } from '../../lib/utils';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(ms: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString();
}

export function VirtualCaddyWorkspace() {
  const { selectedFolderId } = useInvestigation();
  const { createNote } = useNotes(selectedFolderId);

  const bridge = getVirtualBridge();
  const isDesktop = isDesktopBridge();

  const [dirInput, setDirInput] = useState('');
  const [watchStatus, setWatchStatus] = useState<{ watching: boolean; dirPath: string | null; error: string | null }>({
    watching: false, dirPath: null, error: null,
  });
  const [files, setFiles] = useState<VirtualFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileEncoding, setFileEncoding] = useState<'utf8' | 'base64' | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [watchError, setWatchError] = useState<string | null>(null);
  const [ingestStatus, setIngestStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const cleanupRef = useRef<Array<() => void>>([]);

  const refreshFiles = useCallback(async () => {
    if (!bridge) return;
    setIsLoadingFiles(true);
    const result = await bridge.listFiles();
    setFiles(result.files ?? []);
    setIsLoadingFiles(false);
  }, [bridge]);

  const syncStatus = useCallback(async () => {
    if (!bridge) return;
    const status = await bridge.getStatus();
    setWatchStatus(status);
    if (status.dirPath) setDirInput(status.dirPath);
  }, [bridge]);

  // On mount: sync status + register event listeners
  useEffect(() => {
    if (!bridge) return;
    syncStatus();

    const unsubChange = bridge.onFileChanged(() => {
      refreshFiles();
    });
    const unsubError = bridge.onWatchError((ev: { error: string }) => {
      setWatchError(ev.error);
      setWatchStatus((prev) => ({ ...prev, watching: false, error: ev.error }));
    });

    cleanupRef.current = [unsubChange, unsubError];
    return () => { cleanupRef.current.forEach((fn) => fn()); };
  }, [bridge, syncStatus, refreshFiles]);

  // Load file list when watching starts
  useEffect(() => {
    if (watchStatus.watching) refreshFiles();
  }, [watchStatus.watching, refreshFiles]);

  const handleWatch = async () => {
    if (!bridge || !dirInput.trim()) return;
    setWatchError(null);
    const result = await bridge.setWatchDir(dirInput.trim());
    if (result.ok) {
      await syncStatus();
      await refreshFiles();
    } else {
      setWatchError(result.error ?? 'Failed to start watch');
    }
  };

  const handleStop = async () => {
    if (!bridge) return;
    await bridge.stopWatch();
    setFiles([]);
    setSelectedFile(null);
    setFileContent(null);
    await syncStatus();
  };

  const handleSelectFile = async (relativePath: string) => {
    if (!bridge) return;
    setSelectedFile(relativePath);
    setFileContent(null);
    setFileEncoding(null);
    setIsLoadingContent(true);
    const result = await bridge.readFile(relativePath);
    if (result.ok && result.content !== undefined) {
      setFileContent(result.content);
      setFileEncoding(result.encoding ?? 'utf8');
    } else {
      setFileContent(`[Error reading file: ${result.error ?? 'unknown'}]`);
      setFileEncoding('utf8');
    }
    setIsLoadingContent(false);
  };

  const handleIngest = async () => {
    if (!fileContent || !selectedFile) return;
    setIngestStatus('idle');
    try {
      const content = fileEncoding === 'base64'
        ? `[Binary file — base64 encoded]\n\n${fileContent}`
        : fileContent;
      await createNote({
        title: selectedFile,
        content: `# ${selectedFile}\n\n*Ingested from VirtualCaddy — air-gapped file read. No network activity.*\n\n\`\`\`\n${content}\n\`\`\``,
        tags: [],
      });
      setIngestStatus('ok');
      setTimeout(() => setIngestStatus('idle'), 2500);
    } catch {
      setIngestStatus('error');
      setTimeout(() => setIngestStatus('idle'), 2500);
    }
  };

  // Not in desktop app — show graceful degradation
  if (!isDesktop || !bridge) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <Monitor size={48} className="text-text-muted opacity-40" />
        <div>
          <p className="text-sm font-semibold text-text-primary">VirtualCaddy requires the desktop app</p>
          <p className="mt-1 max-w-sm text-xs text-text-secondary">
            File-watch ingest is only available in the ThreatCaddy desktop app. VM shared folder monitoring is not supported in the browser.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border-subtle/50 bg-bg-primary/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Monitor size={16} className="text-accent shrink-0" />
          <span className="text-sm font-semibold text-text-primary">VirtualCaddy</span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-green-500/20 bg-green-500/8 px-2 py-0.5 text-[10px] font-semibold text-green-400">
            <WifiOff size={10} />
            Air-gapped · no network
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-text-secondary">
          Monitor a directory for files written by a VM. Files are read locally — no network activity occurs during ingest.
        </p>
      </div>

      {/* Watch dir config */}
      <div className="shrink-0 border-b border-border-subtle/40 bg-bg-primary/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <FolderOpen size={13} className="shrink-0 text-text-muted" />
          <input
            type="text"
            value={dirInput}
            onChange={(e) => setDirInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleWatch(); }}
            placeholder="/path/to/vm-shared-folder"
            className="flex-1 rounded-[8px] border border-border-subtle bg-bg-primary/70 px-2.5 py-1.5 text-[12px] text-text-primary placeholder:text-text-muted focus:border-accent/40 focus:outline-none"
            aria-label="VM watch directory path"
          />
          {watchStatus.watching ? (
            <button
              type="button"
              onClick={handleStop}
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-red-500/25 bg-red-500/8 px-3 text-[11px] font-semibold text-red-400 transition-colors hover:bg-red-500/15"
              aria-label="Stop watching directory"
            >
              <X size={12} />
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={handleWatch}
              disabled={!dirInput.trim()}
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-accent/25 bg-accent/10 px-3 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Start watching directory"
            >
              <Monitor size={12} />
              Watch
            </button>
          )}
          {watchStatus.watching && (
            <button
              type="button"
              onClick={refreshFiles}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-border-subtle bg-bg-primary/70 text-text-muted transition-colors hover:border-border-medium hover:text-text-primary"
              aria-label="Refresh file list"
            >
              <RefreshCw size={12} className={isLoadingFiles ? 'animate-spin' : ''} />
            </button>
          )}
        </div>

        {watchError && (
          <div className="mt-2 flex items-center gap-1.5 rounded-[8px] border border-red-500/20 bg-red-500/8 px-2.5 py-1.5 text-[11px] text-red-400">
            <AlertTriangle size={11} />
            {watchError}
          </div>
        )}
        {watchStatus.watching && watchStatus.dirPath && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-text-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
            Watching: <span className="font-mono text-text-secondary">{watchStatus.dirPath}</span>
          </div>
        )}
      </div>

      {/* Content area: file list + viewer */}
      <div className="flex flex-1 overflow-hidden">
        {/* File list */}
        <div className="flex w-64 shrink-0 flex-col border-r border-border-subtle/40 overflow-hidden">
          <div className="shrink-0 border-b border-border-subtle/30 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
              Files {files.length > 0 && `(${files.length})`}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!watchStatus.watching && files.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
                <Monitor size={24} className="text-text-muted opacity-30" />
                <p className="text-[11px] text-text-muted">Configure a watch directory above to begin</p>
              </div>
            )}
            {watchStatus.watching && isLoadingFiles && files.length === 0 && (
              <div className="flex items-center justify-center gap-2 p-6">
                <Loader2 size={14} className="animate-spin text-text-muted" />
                <span className="text-[11px] text-text-muted">Loading…</span>
              </div>
            )}
            {files.map((file) => (
              <button
                key={file.relativePath}
                type="button"
                onClick={() => handleSelectFile(file.relativePath)}
                className={cn(
                  'flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-bg-hover',
                  selectedFile === file.relativePath && 'bg-accent/8 text-accent',
                )}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileText size={11} className="shrink-0" />
                  <span className="truncate text-[11px] font-medium">{file.name}</span>
                </div>
                <div className="flex gap-2 text-[10px] text-text-muted">
                  <span>{formatBytes(file.size)}</span>
                  <span>{formatTime(file.mtimeMs)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* File content viewer */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {!selectedFile ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-[12px] text-text-muted">Select a file to view its contents</p>
            </div>
          ) : (
            <>
              <div className="shrink-0 flex items-center justify-between border-b border-border-subtle/40 px-4 py-2">
                <span className="font-mono text-[12px] text-text-primary">{selectedFile}</span>
                <button
                  type="button"
                  onClick={handleIngest}
                  disabled={!fileContent || isLoadingContent}
                  className={cn(
                    'inline-flex h-7 items-center gap-1.5 rounded-[8px] border px-2.5 text-[11px] font-semibold transition-colors',
                    ingestStatus === 'ok'
                      ? 'border-green-500/25 bg-green-500/10 text-green-400'
                      : ingestStatus === 'error'
                      ? 'border-red-500/25 bg-red-500/8 text-red-400'
                      : 'border-accent/25 bg-accent/10 text-accent hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-40',
                  )}
                  aria-label={`Ingest ${selectedFile} as a note`}
                >
                  {ingestStatus === 'ok' ? (
                    <><CheckCircle size={11} />Ingested</>
                  ) : (
                    <><Download size={11} />Ingest as Note</>
                  )}
                </button>
              </div>
              <div className="flex-1 overflow-auto bg-bg-primary/30 p-4">
                {isLoadingContent ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={13} className="animate-spin text-text-muted" />
                    <span className="text-[12px] text-text-muted">Reading file…</span>
                  </div>
                ) : fileEncoding === 'base64' ? (
                  <div>
                    <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/8 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                      <AlertTriangle size={9} />
                      Binary file — shown as base64
                    </div>
                    <pre className="whitespace-pre-wrap break-all font-mono text-[11px] text-text-secondary">{fileContent}</pre>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap break-words font-mono text-[12px] text-text-primary">{fileContent}</pre>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
