// src/components/NetMap/NetworkMapPanel.tsx
//
// Streaming LAN discovery panel — scan controls + live device list.
// Devices arrive via IPC events as the scan runs; Dexie liveQuery keeps the
// list reactive across rerenders. Each device can be added as an IOC or a
// pivot-graph node with one click.
//
// Desktop-only: shows a graceful fallback in the web build.

import { useState, useEffect, useRef, useCallback } from 'react';
import { liveQuery } from 'dexie';
import {
  Network, RefreshCw, Loader2, CheckCircle, AlertTriangle,
  WifiOff, Shield, Plus,
} from 'lucide-react';
import { db } from '../../db';
import { getNetmapBridge, isDesktopBridge } from '../../lib/bridges';
import {
  registerNetmapRendererHandlers,
  createNetmapScanJob,
  getNetmapScanJobs,
} from '../../lib/netmap-bridge';
import { useInvestigation } from '../../contexts/InvestigationContext';
import { cn } from '../../lib/utils';
import { nanoid } from 'nanoid';
import type { NetworkDevice, NetworkScanJob, StandaloneIOC } from '../../types';

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: NetworkDevice['status'] }) {
  if (status === 'online') {
    return (
      <span className="inline-flex items-center gap-1 text-green-400">
        <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
        <span className="text-[10px] font-medium">online</span>
      </span>
    );
  }
  if (status === 'offline') {
    return (
      <span className="inline-flex items-center gap-1 text-text-muted">
        <WifiOff size={10} />
        <span className="text-[10px]">offline</span>
      </span>
    );
  }
  return <span className="text-[10px] text-text-muted">—</span>;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function NetworkMapPanel() {
  const { selectedFolderId } = useInvestigation();
  const bridge = getNetmapBridge();
  const isDesktop = isDesktopBridge();

  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [scanJobs, setScanJobs] = useState<NetworkScanJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [subnet, setSubnet] = useState('');
  const subRef = useRef<{ unsubscribe: () => void } | null>(null);

  // Auto-detect local subnet on mount
  useEffect(() => {
    if (!bridge) return;
    bridge.detectSubnet().then((r) => setSubnet(r.subnet)).catch(() => {});
  }, [bridge]);

  // Reactive device list from Dexie
  useEffect(() => {
    if (!selectedFolderId) { setDevices([]); return; }
    const query = selectedJobId
      ? () => db.networkDevices.where('scanJobId').equals(selectedJobId).sortBy('ip')
      : () => db.networkDevices.where('investigationId').equals(selectedFolderId).sortBy('ip');
    const sub = liveQuery(query).subscribe({
      next: (result) => setDevices(result),
      error: () => setDevices([]),
    });
    return () => sub.unsubscribe();
  }, [selectedFolderId, selectedJobId]);

  // Reactive scan job list from Dexie
  useEffect(() => {
    if (!selectedFolderId) { setScanJobs([]); return; }
    const sub = liveQuery(() => getNetmapScanJobs(selectedFolderId)).subscribe({
      next: (jobs) => setScanJobs(jobs),
      error: () => setScanJobs([]),
    });
    return () => sub.unsubscribe();
  }, [selectedFolderId]);

  // Register IPC listeners — unsub on unmount
  useEffect(() => {
    if (!bridge || !selectedFolderId) return;
    const sub = registerNetmapRendererHandlers(
      undefined,
      (payload) => {
        if (payload.errorMessage) setScanError(payload.errorMessage);
        setIsScanning(false);
      },
    );
    subRef.current = sub;
    return () => sub.unsubscribe();
  }, [bridge, selectedFolderId]);

  const handleStartScan = useCallback(async () => {
    if (!bridge || !selectedFolderId || isScanning) return;
    setScanError(null);
    setIsScanning(true);

    try {
      const result = await bridge.startScan({ investigationId: selectedFolderId, subnet: subnet || undefined });
      if (!result.ok) {
        setScanError(result.error ?? 'Failed to start scan');
        setIsScanning(false);
        return;
      }
      await createNetmapScanJob(selectedFolderId, result.scanJobId, result.subnet, result.startedAt);
      setSelectedJobId(result.scanJobId);
    } catch (err) {
      setScanError(String(err));
      setIsScanning(false);
    }
  }, [bridge, selectedFolderId, isScanning, subnet]);

  const handleAddAsIOC = useCallback(async (device: NetworkDevice) => {
    if (!selectedFolderId) return;
    const now = Date.now();
    const ioc: StandaloneIOC = {
      id: nanoid(),
      type: 'ipv4',
      value: device.ip,
      confidence: 'low',
      folderId: selectedFolderId,
      tags: ['netmap', `scan:${device.scanJobId}`],
      trashed: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.standaloneIOCs.add(ioc);
    await db.networkDevices.update(device.id, { addedToInvestigation: true });
  }, [selectedFolderId]);

  const handleAddToGraph = useCallback(async (device: NetworkDevice) => {
    if (!selectedFolderId) return;
    // Dispatch a CaddyAI prefill so the user can confirm the graph node creation.
    // Direct graph writes require the llm-tools executor which is only safe to call
    // from the chat layer; we trigger it via prefill instead.
    window.dispatchEvent(new CustomEvent('caddyai:prefill-prompt', {
      detail: { prompt: `add_pivot_graph_node for IP ${device.ip}${device.hostname ? ` (${device.hostname})` : ''} from network scan in investigation ${selectedFolderId}` },
    }));
    await db.networkDevices.update(device.id, { addedToInvestigation: true });
  }, [selectedFolderId]);

  // ── Not in desktop ──────────────────────────────────────────────────────────
  if (!isDesktop || !bridge) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <Network size={48} className="text-text-muted opacity-40" />
        <div>
          <p className="text-sm font-semibold text-text-primary">Network Map requires the desktop app</p>
          <p className="mt-1 max-w-sm text-xs text-text-secondary">
            LAN device discovery is only available in the ThreatCaddy desktop app.
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
          <Network size={16} className="text-accent shrink-0" />
          <span className="text-sm font-semibold text-text-primary">Network Map</span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/8 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
            <Shield size={10} />
            LAN only · no internet
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-text-secondary">
          Discover devices on the local network. Add discovered hosts as IOCs or pivot-graph nodes with one click.
        </p>
      </div>

      {/* Scan controls */}
      <div className="shrink-0 border-b border-border-subtle/40 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={subnet}
            onChange={(e) => setSubnet(e.target.value)}
            placeholder="192.168.1.0/24 (auto)"
            className="w-48 rounded-[8px] border border-border-subtle bg-bg-primary/70 px-2.5 py-1.5 text-[11px] text-text-primary placeholder:text-text-muted focus:border-accent/40 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleStartScan}
            disabled={isScanning || !selectedFolderId}
            className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-accent/25 bg-accent/10 px-3 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isScanning ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {isScanning ? 'Scanning…' : 'Scan Network'}
          </button>

          {scanJobs.length > 0 && (
            <select
              value={selectedJobId ?? ''}
              onChange={(e) => setSelectedJobId(e.target.value || null)}
              className="rounded-[8px] border border-border-subtle bg-bg-primary/70 px-2 py-1.5 text-[11px] text-text-primary focus:border-accent/40 focus:outline-none"
            >
              <option value="">All scans</option>
              {scanJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {new Date(job.startedAt).toLocaleString()} — {job.subnet}
                  {job.status === 'running' ? ' (running)' : ` (${job.deviceCount} devices)`}
                </option>
              ))}
            </select>
          )}
        </div>

        {scanError && (
          <div className="mt-2 flex items-center gap-1.5 rounded-[8px] border border-red-500/20 bg-red-500/8 px-2.5 py-1.5 text-[11px] text-red-400">
            <AlertTriangle size={11} />
            {scanError}
          </div>
        )}
      </div>

      {/* Device list */}
      <div className="flex-1 overflow-auto">
        {devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <Network size={28} className="text-text-muted opacity-30" />
            <p className="text-[12px] text-text-muted">
              {isScanning
                ? 'Scan in progress — devices will appear here as they are found'
                : 'No scan yet — click Scan Network to discover LAN devices'}
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-border-subtle/50 bg-bg-primary/40">
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Status</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">IP</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Hostname</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">MAC</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Vendor</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Ports</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Last Seen</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr
                  key={device.id}
                  className={cn(
                    'border-b border-border-subtle/30 transition-colors hover:bg-bg-hover',
                    device.addedToInvestigation && 'opacity-50',
                  )}
                >
                  <td className="px-3 py-2"><StatusBadge status={device.status} /></td>
                  <td className="px-3 py-2 font-mono text-text-primary">{device.ip}</td>
                  <td className="px-3 py-2 text-text-secondary truncate max-w-[120px]">{device.hostname ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-text-muted">{device.mac ?? '—'}</td>
                  <td className="px-3 py-2 text-text-secondary">{device.vendor ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-text-muted">
                    {device.openPorts && device.openPorts.length > 0
                      ? device.openPorts.join(', ')
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-text-muted">
                    {new Date(device.lastSeen).toLocaleTimeString()}
                  </td>
                  <td className="px-3 py-2">
                    {device.addedToInvestigation ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-green-400">
                        <CheckCircle size={10} />
                        added
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleAddAsIOC(device)}
                          title="Add as IOC"
                          className="inline-flex items-center gap-0.5 rounded-[6px] border border-border-subtle bg-bg-primary/70 px-1.5 py-0.5 text-[10px] text-text-muted transition-colors hover:border-accent/40 hover:text-accent"
                        >
                          <Plus size={9} />
                          IOC
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddToGraph(device)}
                          title="Add to graph"
                          className="inline-flex items-center gap-0.5 rounded-[6px] border border-border-subtle bg-bg-primary/70 px-1.5 py-0.5 text-[10px] text-text-muted transition-colors hover:border-purple/40 hover:text-purple"
                        >
                          <Network size={9} />
                          Graph
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Status bar */}
      {devices.length > 0 && (
        <div className="shrink-0 border-t border-border-subtle/30 px-4 py-1.5 text-[10px] text-text-muted">
          {devices.length} device{devices.length !== 1 ? 's' : ''}
          {devices.filter(d => d.status === 'online').length > 0 && (
            <> · {devices.filter(d => d.status === 'online').length} online</>
          )}
          {isScanning && <> · <Loader2 size={9} className="inline animate-spin" /> scanning…</>}
        </div>
      )}
    </div>
  );
}
