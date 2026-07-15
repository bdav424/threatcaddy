export type DetonationNetworkMode = 'isolated' | 'simulated-internet';

export interface VmListing {
  name: string;
  uuid: string;
}

export interface SnapshotListing {
  name: string;
  uuid: string | null;
}

export function isSafeVmOrSnapshotName(name: unknown): boolean;
export function sanitizeGuestFilename(originalName: string): string;

export function buildListVmsArgs(): string[];
export function buildListSnapshotsArgs(vmName: string): string[];
export function buildNetworkModeArgs(vmName: string, hostOnlyAdapter: string): string[];
export function buildRestoreSnapshotArgs(vmName: string, snapshotName: string): string[];
export function buildStartVmArgs(vmName: string): string[];
export function buildPoweroffArgs(vmName: string): string[];
export function buildScreenshotArgs(vmName: string, outputPath: string): string[];
export function buildCopyToGuestArgs(vmName: string, hostPath: string, guestPath: string, username: string, passwordFilePath: string): string[];
export function buildGuestRunArgs(vmName: string, guestPath: string, username: string, passwordFilePath: string, timeoutMs: number): string[];
export function buildGuestSamplePath(platform: 'windows' | 'posix', sanitizedFilename: string): string;

export function parseListVmsOutput(stdout: string): VmListing[];
export function parseSnapshotListOutput(stdout: string): SnapshotListing[];
export function parseHostOnlyInterfacesOutput(stdout: string): string[];

export const DETONATION_STATES: {
  QUEUED: 'queued';
  RESTORING_PRE: 'restoring-pre';
  CONFIGURING_NETWORK: 'configuring-network';
  STARTING: 'starting';
  COPYING_IN: 'copying-in';
  RUNNING: 'running';
  TIMED_OUT: 'timed-out';
  POWERING_OFF: 'powering-off';
  RESTORING_POST: 'restoring-post';
  PACKAGING: 'packaging';
  COMPLETE: 'complete';
  ERROR: 'error';
};

export type DetonationState = typeof DETONATION_STATES[keyof typeof DETONATION_STATES];

export interface DetonationHistoryEntry {
  state: DetonationState;
  at: number;
  error?: string;
  [key: string]: unknown;
}

export class DetonationJobStateMachine {
  constructor(jobId: string);
  jobId: string;
  state: DetonationState;
  history: DetonationHistoryEntry[];
  error: string | null;
  readonly hasAttemptedFinalRestore: boolean;
  transition(next: DetonationState, meta?: Record<string, unknown>): DetonationState;
  isTerminal(): boolean;
}
