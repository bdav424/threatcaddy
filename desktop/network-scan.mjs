// desktop/network-scan.mjs
//
// ARP-table + ICMP-ping + TCP-probe subnet scanner for the NetworkMap panel.
// Runs in the Electron MAIN process — no network transport via the renderer.
// Uses only child_process.execFile and Node.js built-ins (net, dns, os).
// Never calls fetch/WebSocket.
//
// Air-gap note: scans the local subnet only. Zero outbound internet calls.

import { ipcMain, BrowserWindow } from 'electron';
import { execFile } from 'node:child_process';
import net from 'node:net';
import dns from 'node:dns/promises';
import os from 'node:os';
import crypto from 'node:crypto';

// ── OUI vendor table (top-50 prefixes, normalised to lower-case XX:XX:XX) ───

const OUI_TABLE = {
  '00:50:56': 'VMware',
  '00:0c:29': 'VMware',
  '00:1c:14': 'VMware',
  '00:05:69': 'VMware',
  'ac:de:48': 'Apple',
  '00:1a:11': 'Google',
  'f4:f5:d8': 'Google',
  '94:eb:2c': 'Google',
  '00:1b:63': 'Apple',
  '00:25:00': 'Apple',
  'b8:27:eb': 'Raspberry Pi',
  'dc:a6:32': 'Raspberry Pi',
  'e4:5f:01': 'Raspberry Pi',
  '00:e0:4c': 'Realtek',
  '00:1a:2b': 'Intel',
  '00:23:14': 'Intel',
  '8c:8d:28': 'Intel',
  'a4:c3:f0': 'Intel',
  'fc:f8:ae': 'Intel',
  '00:1b:21': 'Intel',
  '00:50:ba': 'D-Link',
  '00:1c:f0': 'D-Link',
  '1c:7e:e5': 'D-Link',
  'c8:be:19': 'D-Link',
  '00:90:f5': 'TP-Link',
  '50:c7:bf': 'TP-Link',
  '98:da:c4': 'TP-Link',
  'e8:48:b8': 'TP-Link',
  '00:0f:66': 'Cisco',
  '00:1a:a2': 'Cisco',
  '00:18:73': 'Cisco',
  'a0:f3:c1': 'Cisco',
  '00:25:84': 'Cisco',
  '00:60:08': 'HP',
  '3c:d9:2b': 'HP',
  'a0:d3:c1': 'HP',
  '10:60:4b': 'HP',
  '00:0a:f7': 'HP',
  '00:1e:4a': 'Dell',
  '18:03:73': 'Dell',
  'b8:ca:3a': 'Dell',
  'f0:1f:af': 'Dell',
  '00:16:3e': 'Xen',
  '52:54:00': 'QEMU/KVM',
  '00:80:41': 'Synology',
  '00:11:32': 'Synology',
  '00:b0:d0': 'Western Digital',
  '00:14:ee': 'Western Digital',
  '00:90:a9': 'Western Digital',
};

function lookupOui(mac) {
  if (!mac) return undefined;
  const prefix = mac.toLowerCase().replace(/-/g, ':').slice(0, 8);
  return OUI_TABLE[prefix];
}

// ── ARP cache parsers ────────────────────────────────────────────────────────

function parseArpLinux(output) {
  const hosts = [];
  for (const line of output.split('\n')) {
    const m = line.match(/^(\S+)\s+\((\d+\.\d+\.\d+\.\d+)\)\s+at\s+([0-9a-fA-F:]+)/);
    if (m) hosts.push({ hostname: m[1] === '?' ? null : m[1], ip: m[2], mac: m[3] });
  }
  return hosts;
}

function parseArpWindows(output) {
  const hosts = [];
  for (const line of output.split('\n')) {
    const m = line.match(/\s+(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F-]+)\s+(dynamic|static)/i);
    if (m) hosts.push({ hostname: null, ip: m[1], mac: m[2].replace(/-/g, ':') });
  }
  return hosts;
}

function runArp() {
  return new Promise((resolve) => {
    const args = ['-a'];
    const bin = process.platform === 'win32' ? 'arp' : '/usr/sbin/arp';
    execFile(bin, args, { timeout: 8000 }, (err, stdout) => {
      if (err) { resolve([]); return; }
      const hosts = process.platform === 'win32'
        ? parseArpWindows(stdout)
        : parseArpLinux(stdout); // darwin format matches linux
      resolve(hosts);
    });
  });
}

// ── ICMP ping ────────────────────────────────────────────────────────────────

function pingHost(ip) {
  return new Promise((resolve) => {
    let bin, args;
    if (process.platform === 'win32') {
      bin = 'ping'; args = ['-n', '1', '-w', '500', ip];
    } else if (process.platform === 'darwin') {
      bin = '/sbin/ping'; args = ['-c', '1', '-W', '500', ip];
    } else {
      bin = '/bin/ping'; args = ['-c', '1', '-W', '1', ip];
    }
    execFile(bin, args, { timeout: 3000 }, (err) => resolve({ ip, alive: !err }));
  });
}

// ── TCP port probe ───────────────────────────────────────────────────────────

const PROBE_PORTS = [22, 80, 443, 445, 3389, 8080];
const TCP_TIMEOUT_MS = 600;

function probeTcpPort(ip, port) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (open) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve({ port, open });
    };
    sock.setTimeout(TCP_TIMEOUT_MS);
    sock.once('connect', () => finish(true));
    sock.once('timeout', () => finish(false));
    sock.once('error', () => finish(false));
    sock.connect(port, ip);
  });
}

async function probeOpenPorts(ip) {
  const results = await Promise.all(PROBE_PORTS.map((p) => probeTcpPort(ip, p)));
  return results.filter((r) => r.open).map((r) => r.port);
}

// ── Reverse DNS ──────────────────────────────────────────────────────────────

async function reverseLookup(ip) {
  try {
    const names = await dns.reverse(ip);
    return names[0] ?? null;
  } catch {
    return null;
  }
}

// ── Subnet helpers ───────────────────────────────────────────────────────────

function getLocalSubnets() {
  const prefixes = new Set();
  const ifaces = os.networkInterfaces();
  for (const iface of Object.values(ifaces)) {
    for (const addr of iface) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      const parts = addr.address.split('.');
      prefixes.add(parts.slice(0, 3).join('.'));
    }
  }
  return [...prefixes];
}

function subnetToIps(subnet) {
  // Accept "192.168.1.0/24" (CIDR) or "192.168.1" (prefix) or null/undefined
  if (!subnet) return getLocalSubnets().flatMap((p) => expandPrefix(p));
  const cidr = subnet.match(/^(\d+\.\d+\.\d+)\.\d+\/24$/) || subnet.match(/^(\d+\.\d+\.\d+)\/24$/);
  if (cidr) return expandPrefix(cidr[1]);
  const prefix = subnet.match(/^(\d+\.\d+\.\d+)$/);
  if (prefix) return expandPrefix(prefix[1]);
  return getLocalSubnets().flatMap((p) => expandPrefix(p));
}

function expandPrefix(prefix) {
  const ips = [];
  for (let i = 1; i <= 254; i++) ips.push(`${prefix}.${i}`);
  return ips;
}

function detectSubnet() {
  const prefixes = getLocalSubnets();
  return prefixes.length > 0 ? `${prefixes[0]}.0/24` : '192.168.1.0/24';
}

// ── Full streaming scan ──────────────────────────────────────────────────────

function sendToRenderer(channel, data) {
  const [win] = BrowserWindow.getAllWindows();
  if (win && !win.isDestroyed()) win.webContents.send(channel, data);
}

async function runStreamingScan(investigationId, subnet, scanJobId) {
  const allIps = subnetToIps(subnet).slice(0, 512);
  const arpHosts = await runArp();
  const arpMap = new Map(arpHosts.map((h) => [h.ip, h]));

  const CONCURRENCY = 24;
  const now = () => new Date().toISOString();
  let deviceCount = 0;

  // Phase 1: ping + ARP merge (fast discovery)
  const pingResults = [];
  for (let i = 0; i < allIps.length; i += CONCURRENCY) {
    const batch = allIps.slice(i, i + CONCURRENCY);
    const batchRes = await Promise.all(batch.map(pingHost));
    pingResults.push(...batchRes);
  }

  // Phase 2: enrich each live host and emit device-found events
  const liveHosts = pingResults.filter((r) => r.alive || arpMap.has(r.ip));

  for (const { ip, alive } of liveHosts) {
    const arp = arpMap.get(ip);
    const [openPorts, hostname] = await Promise.all([
      probeOpenPorts(ip),
      arp?.hostname ? Promise.resolve(arp.hostname) : reverseLookup(ip),
    ]);

    const mac = arp?.mac ?? undefined;
    const vendor = lookupOui(mac);
    const deviceId = crypto.randomUUID();
    const ts = now();

    deviceCount++;

    sendToRenderer('netmap:device-found', {
      scanJobId,
      investigationId,
      device: {
        id: deviceId,
        investigationId,
        scanJobId,
        ip,
        mac,
        hostname: hostname ?? undefined,
        vendor,
        openPorts: openPorts.length > 0 ? openPorts : undefined,
        status: alive ? 'online' : 'offline',
        firstSeen: ts,
        lastSeen: ts,
        addedToInvestigation: false,
      },
    });
  }

  return deviceCount;
}

// ── Batch scan (kept for NetMapWorkspace backward compatibility) ─────────────

async function runFullScan() {
  const arpHosts = await runArp();
  const arpMap = new Map(arpHosts.map((h) => [h.ip, h]));
  const allIps = getLocalSubnets().flatMap((p) => expandPrefix(p)).slice(0, 512);
  const CONCURRENCY = 32;
  const results = [];
  for (let i = 0; i < allIps.length; i += CONCURRENCY) {
    const batch = allIps.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(pingHost));
    results.push(...batchResults);
  }
  const hosts = [];
  for (const { ip, alive } of results) {
    if (!alive && !arpMap.has(ip)) continue;
    const arp = arpMap.get(ip);
    hosts.push({
      ip,
      mac: arp?.mac ?? null,
      hostname: arp?.hostname ?? null,
      alive,
      source: arp ? (alive ? 'arp+ping' : 'arp') : 'ping',
      scannedAt: Date.now(),
    });
  }
  hosts.sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    const toNum = (ip) => ip.split('.').reduce((acc, o) => (acc << 8) + parseInt(o, 10), 0);
    return toNum(a.ip) - toNum(b.ip);
  });
  return hosts;
}

// ── IPC registration ─────────────────────────────────────────────────────────

export function registerNetworkScanBridge() {
  let scanInProgress = false;

  // ── New streaming API (NetworkMapPanel) ────────────────────────────────────

  ipcMain.handle('netmap:start-scan', async (_event, { investigationId, subnet } = {}) => {
    if (scanInProgress) return { ok: false, error: 'Scan already in progress' };
    scanInProgress = true;

    const scanJobId = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    // Kick off async — renderer listens for device-found + scan-complete events
    (async () => {
      try {
        const deviceCount = await runStreamingScan(investigationId, subnet, scanJobId);
        sendToRenderer('netmap:scan-complete', {
          scanJobId,
          investigationId,
          completedAt: new Date().toISOString(),
          deviceCount,
        });
      } catch (err) {
        sendToRenderer('netmap:scan-complete', {
          scanJobId,
          investigationId,
          completedAt: new Date().toISOString(),
          deviceCount: 0,
          errorMessage: err.message,
        });
      } finally {
        scanInProgress = false;
      }
    })();

    return { ok: true, scanJobId, startedAt, subnet: subnet || detectSubnet() };
  });

  ipcMain.handle('netmap:detect-subnet', async () => {
    return { subnet: detectSubnet() };
  });

  // ── Legacy batch API (NetMapWorkspace) ─────────────────────────────────────

  ipcMain.handle('netmap:scan', async () => {
    if (scanInProgress) return { ok: false, error: 'Scan already in progress' };
    scanInProgress = true;
    try {
      const hosts = await runFullScan();
      return { ok: true, hosts };
    } catch (err) {
      return { ok: false, error: err.message, hosts: [] };
    } finally {
      scanInProgress = false;
    }
  });

  ipcMain.handle('netmap:arp-only', async () => {
    try {
      const hosts = await runArp();
      return {
        ok: true,
        hosts: hosts.map((h) => ({ ...h, alive: null, source: 'arp', scannedAt: Date.now() })),
      };
    } catch (err) {
      return { ok: false, error: err.message, hosts: [] };
    }
  });

  ipcMain.handle('netmap:ping', async (_event, { ip }) => {
    if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
      return { ok: false, error: 'Invalid IP address' };
    }
    const result = await pingHost(ip);
    return { ok: true, ...result };
  });
}
