// src/lib/bridges.ts
//
// Canonical interface definitions for the desktop IPC adapters exposed via preload.mjs.
// Both the Electron preload (window.threatcaddyMail / window.threatcaddyCalendar) and a
// future server-side adapter must satisfy these interfaces. The renderer holds only
// credentialReferenceIds — raw secrets never cross this boundary.

import type { CalendarEvent, SlackDmThread, VirtualFile, VirtualFileEvent, NetworkHost } from '../types';

// ─── Mail Bridge ───────────────────────────────────────────────────────────────

export interface MailBridge {
  saveCredential(ref: string, cred: unknown): Promise<{ ok: boolean }>;
  execute(action: string, credentialReferenceId: string, params?: Record<string, unknown>): Promise<unknown>;
  startOAuth(providerId: string): Promise<{ credRefId: string; email: string | null }>;
}

// ─── Calendar Bridge ───────────────────────────────────────────────────────────

export interface CalendarBridge {
  pull(accountId: string, range: { timeMinISO: string; timeMaxISO: string }): Promise<CalendarEvent[]>;
  create(accountId: string, event: CalendarEvent): Promise<{ remoteId: string; etag?: string }>;
  update(accountId: string, event: CalendarEvent): Promise<{ remoteId: string; etag?: string }>;
  remove(accountId: string, remoteId: string): Promise<{ ok: boolean }>;
}

export interface DesktopCalendarBridge extends CalendarBridge {
  startOAuth(providerId: string): Promise<{ credRefId: string; email: string | null }>;
  registerAccount(account: unknown): Promise<unknown>;
}

// ─── Resolvers ────────────────────────────────────────────────────────────────

type MailBridgeGlobal = typeof globalThis & { threatcaddyMail?: MailBridge };
type CalendarBridgeGlobal = typeof globalThis & {
  threatcaddyCalendar?: DesktopCalendarBridge;
  threatcaddy?: { calendar?: DesktopCalendarBridge };
};

export function getMailBridge(): MailBridge | null {
  return (globalThis as MailBridgeGlobal).threatcaddyMail ?? null;
}

export function getCalendarBridge(): DesktopCalendarBridge | null {
  const global = globalThis as CalendarBridgeGlobal;
  return global.threatcaddyCalendar ?? global.threatcaddy?.calendar ?? null;
}

// ─── Slack Bridge ──────────────────────────────────────────────────────────────

export interface SlackBridge {
  startOAuth(): Promise<{ credRefId: string; workspaceName: string; userName: string; userId: string }>;
  pullDMs(credRefId: string, sinceTs?: string): Promise<SlackDmThread[]>;
  revoke(credRefId: string): Promise<{ ok: boolean }>;
}

type SlackBridgeGlobal = typeof globalThis & { threatcaddySlack?: SlackBridge };

export function getSlackBridge(): SlackBridge | null {
  return (globalThis as SlackBridgeGlobal).threatcaddySlack ?? null;
}

export function isDesktopBridge(): boolean {
  return Boolean((globalThis as { threatcaddyDesktop?: { isDesktop?: boolean } }).threatcaddyDesktop?.isDesktop);
}

// ─── Virtual Bridge ────────────────────────────────────────────────────────────
// One-way ingest: renderer reads files from a desktop-watched directory.
// No network calls are ever made during file operations (air-gap constraint).

export interface VirtualBridge {
  setWatchDir(dirPath: string): Promise<{ ok: boolean; error?: string }>;
  getWatchDir(): Promise<{ dirPath: string | null }>;
  listFiles(): Promise<{ files: VirtualFile[]; error?: string }>;
  readFile(relativePath: string): Promise<{ ok: boolean; content?: string; encoding?: 'utf8' | 'base64'; error?: string }>;
  stopWatch(): Promise<{ ok: boolean }>;
  getStatus(): Promise<{ watching: boolean; dirPath: string | null; error: string | null }>;
  onFileChanged(callback: (event: VirtualFileEvent) => void): () => void;
  onWatchError(callback: (event: { error: string }) => void): () => void;
}

type VirtualBridgeGlobal = typeof globalThis & { threatcaddyVirtual?: VirtualBridge };

export function getVirtualBridge(): VirtualBridge | null {
  return (globalThis as VirtualBridgeGlobal).threatcaddyVirtual ?? null;
}

// ─── VirtualCaddy Ingest Bridge ───────────────────────────────────────────────
// Submits files for air-gapped static analysis. The desktop process (vm-ingest.mjs)
// computes the hash and extracts IOCs; results are pushed back via IPC events.

export interface VirtualCaddyJobCompletePayload {
  jobId: string;
  investigationId: string;
  filename: string;
  fileHash: string;
  iocs: Array<{ type: string; value: string }>;
  notes: string[];
  rawResultPath: string;
  completedAt: string;
}

export interface VirtualCaddyJobStatusPayload {
  jobId: string;
  status: string;
}

export interface VirtualCaddyJobErrorPayload {
  jobId: string;
  investigationId: string;
  error: string;
}

export interface VirtualCaddyIngestBridge {
  submitJob(params: { jobId: string; investigationId: string; filePath: string }): Promise<{ ok: boolean; error?: string }>;
  getIngestDir(): Promise<{ ingestDir: string }>;
  setIngestDir(dirPath: string): Promise<{ ok: boolean; ingestDir?: string; error?: string }>;
  getJobsStatus(): Promise<{ activeJobs: string[] }>;
  onJobComplete(callback: (payload: VirtualCaddyJobCompletePayload) => void): () => void;
  onJobStatus(callback: (payload: VirtualCaddyJobStatusPayload) => void): () => void;
  onJobError(callback: (payload: VirtualCaddyJobErrorPayload) => void): () => void;
  onFileDetected(callback: (payload: { filePath: string; filename: string }) => void): () => void;
  onWatchError(callback: (payload: { error: string }) => void): () => void;
}

type VirtualCaddyIngestBridgeGlobal = typeof globalThis & { threatcaddyVirtualCaddy?: VirtualCaddyIngestBridge };

export function getVirtualCaddyBridge(): VirtualCaddyIngestBridge | null {
  return (globalThis as VirtualCaddyIngestBridgeGlobal).threatcaddyVirtualCaddy ?? null;
}

// ─── VM Sandbox Bridge ─────────────────────────────────────────────────────────
// Orchestrates a VirtualBox VM to detonate a submitted sample. Network mode is always
// host-only (isolated or simulated-internet) — there is no channel here that requests
// real internet egress for the detonation VM. See desktop/vm-sandbox.mjs.

export type DetonationNetworkMode = 'isolated' | 'simulated-internet';

export interface VmSandboxVmListing {
  name: string;
  uuid: string;
}

export interface VmSandboxSnapshotListing {
  name: string;
  uuid: string | null;
}

export interface VmSandboxSubmitParams {
  vmName: string;
  snapshotName: string;
  hostOnlyAdapter: string;
  networkMode: DetonationNetworkMode;
  filePath: string;
  credentialReferenceId: string;
  timeoutMs?: number;
}

export interface VmSandboxJobStatusPayload {
  jobId: string;
  state: string;
  error?: string;
  networkMode?: DetonationNetworkMode;
  timeoutMs?: number;
}

export interface VmSandboxJobCompletePayload {
  jobId: string;
  outputDir: string;
  report: {
    jobId: string;
    vmName: string;
    snapshotName: string;
    networkMode: DetonationNetworkMode;
    hostOnlyAdapter: string;
    filename: string;
    startedAt: string;
    completedAt: string;
    timedOut: boolean;
    guestExecOk: boolean;
    guestExecOutput?: { stdout: string; stderr: string };
  };
}

export interface VmSandboxJobErrorPayload {
  jobId: string;
  error: string;
  recovered: boolean;
  outputDir?: string;
}

export interface VmSandboxBridge {
  listVms(): Promise<{ ok: boolean; vms?: VmSandboxVmListing[]; error?: string }>;
  listSnapshots(vmName: string): Promise<{ ok: boolean; snapshots?: VmSandboxSnapshotListing[]; error?: string }>;
  listNetworkAdapters(): Promise<{ ok: boolean; adapters?: string[]; error?: string }>;
  saveGuestCredential(username: string, password: string): Promise<{ ok: boolean; credentialReferenceId?: string; error?: string }>;
  submitDetonation(params: VmSandboxSubmitParams): Promise<{ ok: boolean; jobId?: string; error?: string }>;
  onJobStatus(callback: (payload: VmSandboxJobStatusPayload) => void): () => void;
  onJobComplete(callback: (payload: VmSandboxJobCompletePayload) => void): () => void;
  onJobError(callback: (payload: VmSandboxJobErrorPayload) => void): () => void;
}

type VmSandboxBridgeGlobal = typeof globalThis & { threatcaddyVmSandbox?: VmSandboxBridge };

export function getVmSandboxBridge(): VmSandboxBridge | null {
  return (globalThis as VmSandboxBridgeGlobal).threatcaddyVmSandbox ?? null;
}

// ─── Netmap Bridge ─────────────────────────────────────────────────────────────
// ARP/ping subnet scan — desktop only. No internet-routable probes; local /24 only.

export interface NetmapDeviceFoundPayload {
  scanJobId: string;
  investigationId: string;
  device: {
    id: string;
    investigationId: string;
    scanJobId: string;
    ip: string;
    mac?: string;
    hostname?: string;
    vendor?: string;
    openPorts?: number[];
    status: 'online' | 'offline' | 'unknown';
    firstSeen: string;
    lastSeen: string;
    addedToInvestigation: boolean;
  };
}

export interface NetmapScanCompletePayload {
  scanJobId: string;
  investigationId: string;
  completedAt: string;
  deviceCount: number;
  errorMessage?: string;
}

export interface NetmapBridge {
  // Legacy batch (NetMapWorkspace)
  scan(): Promise<{ ok: boolean; hosts: NetworkHost[]; error?: string }>;
  arpOnly(): Promise<{ ok: boolean; hosts: NetworkHost[]; error?: string }>;
  ping(ip: string): Promise<{ ok: boolean; ip: string; alive: boolean; error?: string }>;
  // Streaming (NetworkMapPanel)
  startScan(params: { investigationId?: string; subnet?: string }): Promise<{ ok: boolean; scanJobId: string; startedAt: string; subnet: string; error?: string }>;
  detectSubnet(): Promise<{ subnet: string }>;
  onDeviceFound(callback: (payload: NetmapDeviceFoundPayload) => void): () => void;
  onScanComplete(callback: (payload: NetmapScanCompletePayload) => void): () => void;
}

type NetmapBridgeGlobal = typeof globalThis & { threatcaddyNetmap?: NetmapBridge };

export function getNetmapBridge(): NetmapBridge | null {
  return (globalThis as NetmapBridgeGlobal).threatcaddyNetmap ?? null;
}
