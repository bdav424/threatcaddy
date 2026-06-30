// Renderer-side wrapper for the WireGuard/Headscale IPC bridge.
// All calls go through contextBridge → main process → Headscale API.
// No network calls, no secrets, no external URLs here.

export interface WgStatus {
  configured: boolean;
  connected: boolean;
  serverUrl?: string;
  machineCount: number;
  error?: string;
}

export interface WgPeer {
  id: string;
  name: string;
  user: string;
  ipAddresses: string[];
  online: boolean;
  lastSeen: string | null;
  os: string;
}

export interface WgRoute {
  id: string;
  machine: WgPeer | null;
  prefix: string;
  advertised: boolean;
  enabled: boolean;
  isPrimary: boolean;
}

type WgBridge = {
  getStatus: () => Promise<WgStatus>;
  listPeers: () => Promise<{ ok: boolean; peers: WgPeer[]; error?: string }>;
  registerMachine: (machineKey: string, user: string) => Promise<{ ok: boolean; machine?: WgPeer | null; error?: string }>;
  getRoutes: () => Promise<{ ok: boolean; routes: WgRoute[]; error?: string }>;
};

function bridge(): WgBridge {
  return (window as unknown as { threatcaddyWireGuard: WgBridge }).threatcaddyWireGuard;
}

export function isWireGuardAvailable(): boolean {
  return typeof window !== 'undefined' && 'threatcaddyWireGuard' in window;
}

export function wgGetStatus(): Promise<WgStatus> {
  return bridge().getStatus();
}

export function wgListPeers(): Promise<{ ok: boolean; peers: WgPeer[]; error?: string }> {
  return bridge().listPeers();
}

export function wgRegisterMachine(
  machineKey: string,
  user: string,
): Promise<{ ok: boolean; machine?: WgPeer | null; error?: string }> {
  return bridge().registerMachine(machineKey, user);
}

export function wgGetRoutes(): Promise<{ ok: boolean; routes: WgRoute[]; error?: string }> {
  return bridge().getRoutes();
}
