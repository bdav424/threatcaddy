// src/components/NetMap/NetMapWorkspace.tsx
//
// Local subnet network map — ARP cache + ICMP ping scan.
// Desktop only: the scan runs in main process (network-scan.mjs) via IPC.
// Renders a host table; shows graceful "Desktop app required" in web builds.

import { useState, useCallback } from 'react';
import { Network, RefreshCw, AlertTriangle, Wifi, WifiOff, Search, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { getNetmapBridge, isDesktopBridge } from '../../lib/bridges';
import type { NetworkHost } from '../../types';
import { cn } from '../../lib/utils';

function formatMac(mac: string | null): string {
  return mac ?? '—';
}

function formatHostname(hostname: string | null): string {
  return hostname ?? '—';
}

function ipToNum(ip: string): number {
  return ip.split('.').reduce((acc, o) => (acc << 8) + parseInt(o, 10), 0) >>> 0;
}

export function NetMapWorkspace() {
  const bridge = getNetmapBridge();
  const isDesktop = isDesktopBridge();

  const [hosts, setHosts] = useState<NetworkHost[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastScanAt, setLastScanAt] = useState<number | null>(null);
  const [scanMode, setScanMode] = useState<'full' | 'arp'>('arp');
  const [filter, setFilter] = useState('');
  const [pingTarget, setPingTarget] = useState('');
  const [pingResult, setPingResult] = useState<{ ip: string; alive: boolean } | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  const runScan = useCallback(async (mode: 'full' | 'arp') => {
    if (!bridge || isScanning) return;
    setIsScanning(true);
    setScanError(null);
    const result = mode === 'arp' ? await bridge.arpOnly() : await bridge.scan();
    if (result.ok) {
      setHosts(result.hosts ?? []);
      setLastScanAt(Date.now());
    } else {
      setScanError(result.error ?? 'Scan failed');
    }
    setIsScanning(false);
  }, [bridge, isScanning]);

  const runPing = useCallback(async () => {
    if (!bridge || !pingTarget.trim() || isPinging) return;
    setIsPinging(true);
    setPingResult(null);
    const result = await bridge.ping(pingTarget.trim());
    if (result.ok) setPingResult({ ip: result.ip, alive: result.alive });
    setIsPinging(false);
  }, [bridge, pingTarget, isPinging]);

  const filtered = hosts.filter((h) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return h.ip.includes(q) || (h.hostname ?? '').toLowerCase().includes(q) || (h.mac ?? '').toLowerCase().includes(q);
  });

  if (!isDesktop || !bridge) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <Network size={48} className="text-text-muted opacity-40" />
        <div>
          <p className="text-sm font-semibold text-text-primary">Network Map requires the desktop app</p>
          <p className="mt-1 max-w-sm text-xs text-text-secondary">
            Subnet ARP/ping scanning uses native OS tools and is only available in the ThreatCaddy desktop app.
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
          <Network size={16} className="text-accent shrink-0" />
          <span className="text-sm font-semibold text-text-primary">Network Map</span>
          {lastScanAt && (
            <span className="ml-1 text-[10px] text-text-muted">
              Last scan: {new Date(lastScanAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-text-secondary">
          Discover hosts on local subnets using the OS ARP cache and ICMP ping. Desktop only — no internet probes.
        </p>
      </div>

      {/* Toolbar */}
      <div className="shrink-0 border-b border-border-subtle/40 bg-bg-primary/40 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Scan mode toggle */}
          <div className="flex items-center rounded-[8px] border border-border-subtle bg-bg-primary/70 p-0.5">
            <button
              type="button"
              onClick={() => setScanMode('arp')}
              className={cn(
                'rounded-[6px] px-2.5 py-1 text-[11px] font-semibold transition-colors',
                scanMode === 'arp' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-primary',
              )}
            >
              ARP only
            </button>
            <button
              type="button"
              onClick={() => setScanMode('full')}
              className={cn(
                'rounded-[6px] px-2.5 py-1 text-[11px] font-semibold transition-colors',
                scanMode === 'full' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-primary',
              )}
            >
              ARP + Ping
            </button>
          </div>

          <button
            type="button"
            onClick={() => runScan(scanMode)}
            disabled={isScanning}
            className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-accent/25 bg-accent/10 px-3 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isScanning ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {isScanning ? 'Scanning…' : 'Scan'}
          </button>

          {/* Filter */}
          <div className="flex items-center gap-1.5 rounded-[8px] border border-border-subtle bg-bg-primary/70 px-2.5 py-1.5">
            <Search size={11} className="shrink-0 text-text-muted" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter IP, hostname, MAC…"
              className="w-40 bg-transparent text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none"
            />
          </div>

          {/* Single ping */}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={pingTarget}
              onChange={(e) => setPingTarget(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runPing(); }}
              placeholder="Ping IP…"
              className="w-28 rounded-[8px] border border-border-subtle bg-bg-primary/70 px-2.5 py-1.5 text-[11px] text-text-primary placeholder:text-text-muted focus:border-accent/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={runPing}
              disabled={!pingTarget.trim() || isPinging}
              className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-border-subtle bg-bg-primary/70 px-2.5 text-[11px] text-text-muted transition-colors hover:border-border-medium hover:text-text-primary disabled:opacity-40"
            >
              {isPinging ? <Loader2 size={11} className="animate-spin" /> : <Wifi size={11} />}
            </button>
            {pingResult && (
              <span className={cn('flex items-center gap-1 text-[11px] font-semibold', pingResult.alive ? 'text-green-400' : 'text-red-400')}>
                {pingResult.alive ? <CheckCircle size={11} /> : <XCircle size={11} />}
                {pingResult.ip} {pingResult.alive ? 'alive' : 'unreachable'}
              </span>
            )}
          </div>
        </div>

        {scanError && (
          <div className="mt-2 flex items-center gap-1.5 rounded-[8px] border border-red-500/20 bg-red-500/8 px-2.5 py-1.5 text-[11px] text-red-400">
            <AlertTriangle size={11} />
            {scanError}
          </div>
        )}
      </div>

      {/* Host table */}
      <div className="flex-1 overflow-auto">
        {hosts.length === 0 && !isScanning ? (
          <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <Network size={28} className="text-text-muted opacity-30" />
            <p className="text-[12px] text-text-muted">Run a scan to discover hosts on the local subnet</p>
            <p className="text-[11px] text-text-muted opacity-60">
              ARP only reads the OS cache (instant). ARP + Ping sends ICMP probes to all /24 addresses.
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-border-subtle/50 bg-bg-primary/40">
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Status</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">IP Address</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Hostname</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">MAC Address</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Source</th>
              </tr>
            </thead>
            <tbody>
              {filtered
                .slice()
                .sort((a, b) => ipToNum(a.ip) - ipToNum(b.ip))
                .map((host) => (
                  <tr
                    key={host.ip}
                    className="border-b border-border-subtle/30 transition-colors hover:bg-bg-hover"
                  >
                    <td className="px-4 py-2">
                      {host.alive === true ? (
                        <span className="inline-flex items-center gap-1 text-green-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                          <span className="text-[10px]">alive</span>
                        </span>
                      ) : host.alive === false ? (
                        <span className="inline-flex items-center gap-1 text-text-muted">
                          <WifiOff size={10} />
                          <span className="text-[10px]">down</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-text-primary">{host.ip}</td>
                    <td className="px-4 py-2 text-text-secondary">{formatHostname(host.hostname)}</td>
                    <td className="px-4 py-2 font-mono text-text-secondary">{formatMac(host.mac)}</td>
                    <td className="px-4 py-2">
                      <span className={cn(
                        'rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider',
                        host.source === 'arp+ping' ? 'bg-accent/10 text-accent' :
                        host.source === 'ping' ? 'bg-green-500/10 text-green-400' :
                        'bg-border-subtle/40 text-text-muted',
                      )}>
                        {host.source}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {isScanning && hosts.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 p-10">
            <Loader2 size={24} className="animate-spin text-accent" />
            <p className="text-[12px] text-text-muted">
              {scanMode === 'full' ? 'Scanning subnet (ARP + ICMP ping)…' : 'Reading ARP cache…'}
            </p>
            {scanMode === 'full' && (
              <p className="text-[11px] text-text-muted opacity-60">Full ping sweep may take 30–60 seconds</p>
            )}
          </div>
        )}
      </div>

      {/* Status bar */}
      {hosts.length > 0 && (
        <div className="shrink-0 border-t border-border-subtle/30 px-4 py-1.5 text-[10px] text-text-muted">
          {filtered.length} of {hosts.length} host{hosts.length !== 1 ? 's' : ''} shown
          {hosts.filter((h) => h.alive === true).length > 0 && (
            <> · {hosts.filter((h) => h.alive === true).length} alive</>
          )}
        </div>
      )}
    </div>
  );
}
