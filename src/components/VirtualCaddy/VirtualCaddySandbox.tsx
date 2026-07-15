// src/components/VirtualCaddy/VirtualCaddySandbox.tsx
//
// VM Sandbox (Phase 2) — configures and triggers a VirtualBox VM detonation via
// desktop/vm-sandbox.mjs. This UI deliberately offers only two network modes
// (isolated, simulated-internet) and never presents a real-internet-egress option —
// see the scope notes at the top of desktop/vm-sandbox.mjs for why.
//
// Guest login credentials are saved through the bridge (OS-keychain-encrypted in the
// main process via safeStorage) — this component only ever holds the opaque
// credentialReferenceId it gets back, never the raw password after saving it.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield, ShieldAlert, UploadCloud, Loader2, AlertTriangle, CheckCircle,
  WifiOff, Clock, Play, Lock,
} from 'lucide-react';
import { getVmSandboxBridge, isDesktopBridge } from '../../lib/bridges';
import type { DetonationNetworkMode, VmSandboxVmListing, VmSandboxSnapshotListing } from '../../lib/bridges';
import { cn } from '../../lib/utils';

const CRED_REF_STORAGE_PREFIX = 'threatcaddy-vmsandbox-cred-';

interface JobEntry {
  jobId: string;
  state: string;
  error?: string;
  outputDir?: string;
  filename: string;
}

export function VirtualCaddySandbox() {
  const bridge = getVmSandboxBridge();
  const isDesktop = isDesktopBridge();

  const [vms, setVms] = useState<VmSandboxVmListing[]>([]);
  const [snapshots, setSnapshots] = useState<VmSandboxSnapshotListing[]>([]);
  const [adapters, setAdapters] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [vmName, setVmName] = useState('');
  const [snapshotName, setSnapshotName] = useState('');
  const [hostOnlyAdapter, setHostOnlyAdapter] = useState('');
  const [networkMode, setNetworkMode] = useState<DetonationNetworkMode>('isolated');
  const [timeoutSeconds, setTimeoutSeconds] = useState(180);

  const [guestUsername, setGuestUsername] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [credentialReferenceId, setCredentialReferenceId] = useState<string | null>(null);
  const [savingCredential, setSavingCredential] = useState(false);

  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobEntry[]>([]);

  // Load VM list on mount
  useEffect(() => {
    if (!bridge) return;
    bridge.listVms().then((r) => {
      if (r.ok) setVms(r.vms ?? []);
      else setLoadError(r.error ?? 'Could not list VMs');
    });
    bridge.listNetworkAdapters().then((r) => {
      if (r.ok) setAdapters(r.adapters ?? []);
    });
  }, [bridge]);

  // Load snapshots + restore a saved credential reference whenever the selected VM changes
  useEffect(() => {
    if (!bridge || !vmName) { setSnapshots([]); return; }
    setSnapshotName('');
    bridge.listSnapshots(vmName).then((r) => {
      if (r.ok) setSnapshots(r.snapshots ?? []);
    });
    const savedRef = localStorage.getItem(CRED_REF_STORAGE_PREFIX + vmName);
    setCredentialReferenceId(savedRef);
  }, [bridge, vmName]);

  // Job status events
  useEffect(() => {
    if (!bridge) return;
    const unsubStatus = bridge.onJobStatus((payload) => {
      setJobs((prev) => {
        const existing = prev.find((j) => j.jobId === payload.jobId);
        if (!existing) return prev;
        return prev.map((j) => (j.jobId === payload.jobId ? { ...j, state: payload.state, error: payload.error } : j));
      });
    });
    const unsubComplete = bridge.onJobComplete((payload) => {
      setJobs((prev) => prev.map((j) => (j.jobId === payload.jobId ? { ...j, state: 'complete', outputDir: payload.outputDir } : j)));
    });
    const unsubError = bridge.onJobError((payload) => {
      setJobs((prev) => prev.map((j) => (j.jobId === payload.jobId ? { ...j, state: payload.recovered ? 'complete' : 'error', error: payload.error, outputDir: payload.outputDir } : j)));
    });
    return () => { unsubStatus(); unsubComplete(); unsubError(); };
  }, [bridge]);

  const handleSaveCredential = async () => {
    if (!bridge || !guestUsername || !guestPassword) return;
    setSavingCredential(true);
    try {
      const result = await bridge.saveGuestCredential(guestUsername, guestPassword);
      if (result.ok && result.credentialReferenceId) {
        setCredentialReferenceId(result.credentialReferenceId);
        if (vmName) localStorage.setItem(CRED_REF_STORAGE_PREFIX + vmName, result.credentialReferenceId);
        setGuestPassword(''); // never keep the raw password in component state longer than needed
      } else {
        setSubmitError(result.error ?? 'Could not save credential');
      }
    } finally {
      setSavingCredential(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setSubmitError(null);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const path = (file as File & { path?: string }).path;
    if (!path) {
      setSubmitError('File path unavailable — VM Sandbox requires the desktop app');
      return;
    }
    setFilePath(path);
    setFileName(file.name);
  }, []);

  const canDetonate = useMemo(
    () => !!(bridge && vmName && snapshotName && hostOnlyAdapter && filePath && credentialReferenceId),
    [bridge, vmName, snapshotName, hostOnlyAdapter, filePath, credentialReferenceId],
  );

  const handleDetonate = async () => {
    if (!bridge || !canDetonate || !filePath || !fileName || !credentialReferenceId) return;
    setSubmitError(null);
    const result = await bridge.submitDetonation({
      vmName, snapshotName, hostOnlyAdapter, networkMode, filePath, credentialReferenceId,
      timeoutMs: timeoutSeconds * 1000,
    });
    if (result.ok && result.jobId) {
      setJobs((prev) => [{ jobId: result.jobId!, state: 'queued', filename: fileName }, ...prev]);
      setFilePath(null);
      setFileName(null);
    } else {
      setSubmitError(result.error ?? 'Could not submit detonation');
    }
  };

  if (!isDesktop || !bridge) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <Shield size={48} className="text-text-muted opacity-40" />
        <div>
          <p className="text-sm font-semibold text-text-primary">VM Sandbox requires the desktop app</p>
          <p className="mt-1 max-w-sm text-xs text-text-secondary">
            VM orchestration is only available in the ThreatCaddy desktop app, with VirtualBox (VBoxManage on PATH) installed.
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
          <Shield size={16} className="text-accent shrink-0" />
          <span className="text-sm font-semibold text-text-primary">VM Sandbox</span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-green-500/20 bg-green-500/8 px-2 py-0.5 text-[10px] font-semibold text-green-400">
            <WifiOff size={10} />
            Host-only network only
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-text-secondary">
          Detonates a sample inside a VirtualBox VM you configure: restores a clean snapshot, runs the sample under a hard timeout, captures screenshots, and always restores the snapshot again afterward — success, timeout, or error.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Unmissable network-safety statement */}
        <div className="flex items-start gap-2 rounded-[10px] border border-amber-500/25 bg-amber-500/8 p-3 text-[11px] text-amber-200">
          <ShieldAlert size={14} className="mt-0.5 shrink-0 text-amber-400" />
          <div>
            <p className="font-semibold">This VM never gets real internet access.</p>
            <p className="mt-0.5 text-amber-200/80">
              Both network modes below configure a host-only VirtualBox adapter only — never NAT or bridged. &quot;Simulated internet&quot; means you&apos;ve pointed something like INetSim at that adapter to fake responses; it does not mean real egress.
            </p>
          </div>
        </div>

        {loadError && (
          <div className="flex items-center gap-1.5 rounded-[8px] border border-red-500/20 bg-red-500/8 px-2.5 py-1.5 text-[11px] text-red-400">
            <AlertTriangle size={11} />
            {loadError}
          </div>
        )}

        {/* VM / snapshot / network configuration */}
        <section aria-label="Sandbox configuration" className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="vmsandbox-vm-select" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Virtual Machine</label>
            <select
              id="vmsandbox-vm-select"
              aria-label="Virtual Machine"
              value={vmName}
              onChange={(e) => setVmName(e.target.value)}
              className="mt-1 w-full rounded-[8px] border border-border-subtle bg-bg-primary/70 px-2.5 py-1.5 text-[12px] text-text-primary focus:border-accent/40 focus:outline-none"
            >
              <option value="">Select a VM…</option>
              {vms.map((vm) => <option key={vm.uuid} value={vm.name}>{vm.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="vmsandbox-snapshot-select" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Clean Snapshot</label>
            <select
              id="vmsandbox-snapshot-select"
              aria-label="Clean Snapshot"
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              disabled={!vmName}
              className="mt-1 w-full rounded-[8px] border border-border-subtle bg-bg-primary/70 px-2.5 py-1.5 text-[12px] text-text-primary focus:border-accent/40 focus:outline-none disabled:opacity-40"
            >
              <option value="">{vmName ? 'Select a snapshot…' : 'Select a VM first'}</option>
              {snapshots.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="vmsandbox-adapter-select" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Host-only Adapter</label>
            <select
              id="vmsandbox-adapter-select"
              aria-label="Host-only Adapter"
              value={hostOnlyAdapter}
              onChange={(e) => setHostOnlyAdapter(e.target.value)}
              className="mt-1 w-full rounded-[8px] border border-border-subtle bg-bg-primary/70 px-2.5 py-1.5 text-[12px] text-text-primary focus:border-accent/40 focus:outline-none"
            >
              <option value="">Select an adapter…</option>
              {adapters.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="vmsandbox-timeout-input" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Timeout (seconds)</label>
            <input
              id="vmsandbox-timeout-input"
              type="number"
              min={5}
              max={600}
              value={timeoutSeconds}
              onChange={(e) => setTimeoutSeconds(Math.min(600, Math.max(5, Number(e.target.value) || 180)))}
              className="mt-1 w-full rounded-[8px] border border-border-subtle bg-bg-primary/70 px-2.5 py-1.5 text-[12px] text-text-primary focus:border-accent/40 focus:outline-none"
            />
          </div>
        </section>

        {/* Network mode */}
        <section aria-label="Network mode">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Network Mode</span>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {([
              { value: 'isolated' as const, label: 'Fully isolated', desc: 'No responder on the host-only adapter — the sample gets no network responses at all.' },
              { value: 'simulated-internet' as const, label: 'Simulated internet', desc: 'You’ve set up INetSim/FakeNet on this host-only adapter to fake DNS/HTTP responses.' },
            ]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setNetworkMode(opt.value)}
                className={cn(
                  'rounded-[10px] border p-2.5 text-left transition-colors',
                  networkMode === opt.value ? 'border-accent bg-accent/10' : 'border-border-subtle/60 bg-bg-raised/30 hover:border-border-medium/60',
                )}
              >
                <span className="text-[12px] font-semibold text-text-primary">{opt.label}</span>
                <p className="mt-0.5 text-[10px] leading-4 text-text-secondary">{opt.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Guest credentials */}
        <section aria-label="Guest login credentials" className="rounded-[10px] border border-border-subtle/60 bg-bg-raised/30 p-3">
          <div className="flex items-center gap-1.5">
            <Lock size={12} className="text-text-muted" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Guest Login</span>
            {credentialReferenceId && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-green-500/20 bg-green-500/8 px-2 py-0.5 text-[10px] font-semibold text-green-400">
                <CheckCircle size={10} /> Saved
              </span>
            )}
          </div>
          <p className="mt-1 text-[10px] text-text-secondary">
            Stored OS-keychain-encrypted in the desktop app — never in plaintext, never sent anywhere else.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input
              type="text"
              placeholder="Guest username"
              value={guestUsername}
              onChange={(e) => setGuestUsername(e.target.value)}
              autoComplete="off"
              className="rounded-[8px] border border-border-subtle bg-bg-primary/70 px-2.5 py-1.5 text-[12px] text-text-primary placeholder:text-text-muted focus:border-accent/40 focus:outline-none"
            />
            <input
              type="password"
              placeholder="Guest password"
              value={guestPassword}
              onChange={(e) => setGuestPassword(e.target.value)}
              autoComplete="off"
              className="rounded-[8px] border border-border-subtle bg-bg-primary/70 px-2.5 py-1.5 text-[12px] text-text-primary placeholder:text-text-muted focus:border-accent/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSaveCredential}
              disabled={!guestUsername || !guestPassword || savingCredential}
              className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[8px] border border-accent/25 bg-accent/10 px-3 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {savingCredential ? <Loader2 size={12} className="animate-spin" /> : null}
              Save
            </button>
          </div>
        </section>

        {/* Sample drop zone */}
        <section aria-label="Sample to detonate">
          <div
            role="region"
            aria-label="Drop zone for a sample to detonate"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors select-none',
              isDragging ? 'border-accent/60 bg-accent/8' : 'border-border-subtle/60 bg-bg-raised/30 hover:border-border-medium/60',
            )}
          >
            <UploadCloud size={28} className={cn('transition-colors', isDragging ? 'text-accent' : 'text-text-muted opacity-40')} />
            {fileName ? (
              <p className="text-[12px] font-semibold text-text-primary">{fileName}</p>
            ) : (
              <p className="text-[12px] text-text-muted">Drop a sample here</p>
            )}
          </div>
        </section>

        {submitError && (
          <div className="flex items-center gap-1.5 rounded-[8px] border border-red-500/20 bg-red-500/8 px-2.5 py-1.5 text-[11px] text-red-400">
            <AlertTriangle size={11} />
            {submitError}
          </div>
        )}

        <button
          type="button"
          onClick={handleDetonate}
          disabled={!canDetonate}
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] border border-accent/25 bg-accent/10 text-[12px] font-semibold text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Play size={13} />
          Detonate
        </button>

        {/* Job list */}
        {jobs.length > 0 && (
          <section aria-label="Detonation jobs">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Jobs</h4>
            <ul className="space-y-1.5">
              {jobs.map((job) => (
                <li key={job.jobId} className="flex items-center gap-2 rounded-[8px] border border-border-subtle/50 bg-bg-raised/30 px-2.5 py-1.5 text-[11px]">
                  {job.state === 'complete' ? (
                    <CheckCircle size={12} className="shrink-0 text-green-400" />
                  ) : job.state === 'error' ? (
                    <AlertTriangle size={12} className="shrink-0 text-red-400" />
                  ) : (
                    <Loader2 size={12} className="shrink-0 animate-spin text-text-muted" />
                  )}
                  <span className="truncate font-medium text-text-primary">{job.filename}</span>
                  <span className="ml-auto shrink-0 text-text-muted">{job.state}</span>
                  {job.state !== 'complete' && job.state !== 'error' && <Clock size={11} className="shrink-0 text-text-muted" />}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-text-muted">
              Completed jobs write screenshots and report.json into your File Watch directory (or ~/ThreatCaddy/VirtualCaddy/detonation if none is configured) — open Detonation Review to see them.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
