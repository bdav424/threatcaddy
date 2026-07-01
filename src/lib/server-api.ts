import type { Post, Notification, InvestigationMember, SyncDevice } from '../types';
import type { ActivityEntry } from '../components/CaddyShack/ActivityCard';

// ─── Sync Device Key ─────────────────────────────────────────────

const DEVICE_KEY_LS = 'tc-sync-device-key';
const DEVICE_NAME_LS = 'tc-sync-device-name';

let _deviceKey: string | null = null;

function generateDeviceKey(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function deriveDefaultDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android Device';
  if (/Macintosh|Mac OS/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Linux/i.test(ua)) return 'Linux Device';
  return 'Browser';
}

export function getOrCreateDeviceKey(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY_LS);
    if (existing) return existing;
    const key = generateDeviceKey();
    localStorage.setItem(DEVICE_KEY_LS, key);
    return key;
  } catch {
    return generateDeviceKey();
  }
}

export function getDeviceName(): string {
  try {
    return localStorage.getItem(DEVICE_NAME_LS) || deriveDefaultDeviceName();
  } catch {
    return deriveDefaultDeviceName();
  }
}

export function setDeviceName(name: string) {
  try { localStorage.setItem(DEVICE_NAME_LS, name); } catch { /* ignore */ }
}

export function initDeviceKey() {
  _deviceKey = getOrCreateDeviceKey();
}

export interface AuditLogEntry {
  id: string;
  type: string;
  actor?: { id: string; displayName: string; avatarUrl?: string };
  target?: { type: string; id: string; title: string };
  folderId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
import i18n from '../i18n';

type GetTokenFn = () => Promise<string | null>;
type InvalidateTokenFn = () => void;

let _getToken: GetTokenFn = async () => null;
let _invalidateToken: InvalidateTokenFn = () => {};
let _serverUrl: string | null = null;

// ─── API Response Types ──────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface InvestigationListItem {
  folderId: string;
  role: string;
  joinedAt: string;
  folder: {
    name: string;
    status: string;
    color: string;
    icon: string;
    description: string;
    clsLevel: string | null;
    papLevel: string | null;
    tags: string[];
    createdAt: string;
    updatedAt: string;
  };
  entityCounts: {
    notes: number;
    tasks: number;
    iocs: number;
    events: number;
    whiteboards: number;
    chats: number;
  };
  memberCount: number;
}

export interface UserListItem {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  active?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface LLMConfig {
  providers: Array<{ id: string; name: string; models: Array<{ id: string; name: string }> }>;
}

export interface SyncPullResult {
  changes: Array<Record<string, unknown> & { table: string; op: 'put' | 'delete'; id: string }>;
  serverTimestamp: string;
}

// Snapshot returns entity arrays keyed by table name
export interface SyncSnapshotResult {
  [table: string]: unknown[];
}

/**
 * Translate a server error response using i18n error codes.
 * Falls back to the raw English `error` field when no translation exists.
 */
export function localizeServerError(response: { error: string; code?: string }): string {
  if (response.code) {
    const key = `serverError.${response.code}`;
    const translated = i18n.t(key, { ns: 'common', defaultValue: '' });
    if (translated) return translated;
  }
  return response.error;
}

export function configureServerApi(
  serverUrl: string | null,
  getToken: GetTokenFn,
  invalidateToken?: InvalidateTokenFn,
) {
  _serverUrl = serverUrl;
  _getToken = getToken;
  _invalidateToken = invalidateToken || (() => {});
}

/** Extract an error message from a failed API response, falling back to the provided default. */
async function apiError(resp: Response, fallback: string): Promise<Error> {
  try {
    const body = await resp.json();
    return new Error(body.error || body.message || fallback);
  } catch {
    return new Error(fallback);
  }
}

async function apiFetch(path: string, opts: RequestInit = {}, _retry = false): Promise<Response> {
  if (!_serverUrl) throw new Error('Not connected to server');

  const token = await _getToken();
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (_deviceKey) {
    headers['X-Device-Key'] = _deviceKey;
  }

  if (!(opts.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  // Apply a 30s timeout to non-streaming requests that don't already carry a signal
  let timeoutController: AbortController | undefined;
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
  if (!opts.signal) {
    timeoutController = new AbortController();
    timeoutTimer = setTimeout(() => timeoutController!.abort(), 30_000);
  }
  const resp = await fetch(`${_serverUrl}${path}`, {
    ...opts,
    headers,
    signal: opts.signal ?? timeoutController?.signal,
  });
  clearTimeout(timeoutTimer);

  // On 401, invalidate the cached token so getAccessToken triggers a refresh,
  // then retry the request once with the fresh token.
  if (resp.status === 401 && !_retry) {
    _invalidateToken();
    const freshToken = await _getToken();
    if (freshToken) {
      return apiFetch(path, opts, true);
    }
  }

  return resp;
}

// ─── Auth ───────────────────────────────────────────────────────

export async function fetchMe(): Promise<UserProfile> {
  const resp = await apiFetch('/api/auth/me');
  if (!resp.ok) throw new Error('Failed to fetch profile');
  return resp.json();
}

export async function updateProfile(updates: { displayName?: string; avatarUrl?: string }): Promise<{ ok: true }> {
  const resp = await apiFetch('/api/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  if (!resp.ok) throw await apiError(resp, 'Failed to update profile');
  return resp.json();
}

export async function changePassword(oldPassword: string, newPassword: string) {
  const resp = await apiFetch('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword }),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || 'Failed to change password');
  }
}

// ─── Server Info ────────────────────────────────────────────────

export async function fetchServerInfo(): Promise<{ serverName: string }> {
  const resp = await apiFetch('/api/server/info');
  if (!resp.ok) throw new Error('Failed to fetch server info');
  return resp.json();
}

// ─── Sync ───────────────────────────────────────────────────────

export interface SyncChange {
  table: string;
  op: 'put' | 'delete';
  entityId: string;
  data?: Record<string, unknown>;
  clientVersion?: number;
}

export interface SyncResult {
  table?: string;
  entityId: string;
  status: 'accepted' | 'conflict' | 'rejected';
  serverVersion?: number;
  serverData?: Record<string, unknown>;
}

export class SyncEnrollmentError extends Error {
  readonly code = 'SYNC_ENROLLMENT_REQUIRED' as const;
  readonly enrollmentStatus: string;
  constructor(enrollmentStatus: string) {
    super('SYNC_ENROLLMENT_REQUIRED');
    this.name = 'SyncEnrollmentError';
    this.enrollmentStatus = enrollmentStatus;
  }
}

async function throwIfEnrollmentRequired(resp: Response) {
  if (resp.status === 403) {
    const body = await resp.json().catch(() => ({})) as { code?: string; enrollmentStatus?: string };
    if (body.code === 'SYNC_ENROLLMENT_REQUIRED') {
      throw new SyncEnrollmentError(body.enrollmentStatus ?? 'unknown');
    }
  }
}

export async function syncPush(changes: SyncChange[]): Promise<{ results: SyncResult[] }> {
  const resp = await apiFetch('/api/sync/push', {
    method: 'POST',
    body: JSON.stringify({ changes }),
  });
  await throwIfEnrollmentRequired(resp);
  if (!resp.ok) throw await apiError(resp, 'Sync push failed');
  return resp.json();
}

export async function syncPull(since: string, folderId?: string): Promise<SyncPullResult> {
  const params = new URLSearchParams({ since });
  if (folderId) params.set('folderId', folderId);
  const resp = await apiFetch(`/api/sync/pull?${params}`);
  await throwIfEnrollmentRequired(resp);
  if (!resp.ok) throw new Error('Sync pull failed');
  return resp.json();
}

export async function syncSnapshot(folderId: string): Promise<SyncSnapshotResult> {
  const resp = await apiFetch(`/api/sync/snapshot/${folderId}`);
  await throwIfEnrollmentRequired(resp);
  if (!resp.ok) throw new Error('Sync snapshot failed');
  return resp.json();
}

// ─── Sync Device Enrollment ──────────────────────────────────────

export async function registerSyncDevice(deviceKey: string, deviceName: string): Promise<{ status: 'approved' | 'pending'; deviceId: string }> {
  const resp = await apiFetch('/api/sync/devices/register', {
    method: 'POST',
    body: JSON.stringify({ deviceKey, deviceName }),
  });
  if (!resp.ok) throw await apiError(resp, 'Failed to register device');
  return resp.json();
}

export async function fetchSyncDevices(): Promise<{ devices: SyncDevice[] }> {
  const resp = await apiFetch('/api/sync/devices');
  if (!resp.ok) throw new Error('Failed to fetch devices');
  return resp.json();
}

export async function revokeSyncDevice(deviceId: string): Promise<void> {
  const resp = await apiFetch(`/api/sync/devices/${deviceId}`, { method: 'DELETE' });
  if (!resp.ok) throw await apiError(resp, 'Failed to revoke device');
}

export async function renameSyncDevice(deviceId: string, deviceName: string): Promise<void> {
  const resp = await apiFetch(`/api/sync/devices/${deviceId}`, {
    method: 'PATCH',
    body: JSON.stringify({ deviceName }),
  });
  if (!resp.ok) throw await apiError(resp, 'Failed to rename device');
}

export async function generatePairingCode(): Promise<{ pairingCode: string; qrDataUrl: string; expiresAt: string }> {
  const resp = await apiFetch('/api/sync/devices/pair/generate', { method: 'POST' });
  if (!resp.ok) throw await apiError(resp, 'Failed to generate pairing code');
  return resp.json();
}

export async function completePairing(pairingCode: string, deviceKey: string, deviceName: string): Promise<{ enrolled: boolean; deviceId: string }> {
  const resp = await apiFetch('/api/sync/devices/pair/complete', {
    method: 'POST',
    body: JSON.stringify({ pairingCode, deviceKey, deviceName }),
  });
  if (!resp.ok) throw await apiError(resp, 'Pairing failed');
  return resp.json();
}

// ─── Investigations ─────────────────────────────────────────────

export async function fetchInvestigations(): Promise<{ data: InvestigationListItem[]; total: number; limit: number; offset: number }> {
  const resp = await apiFetch('/api/investigations');
  if (!resp.ok) throw new Error('Failed to fetch investigations');
  return resp.json();
}

export async function fetchInvestigationMembers(folderId: string): Promise<InvestigationMember[]> {
  const resp = await apiFetch(`/api/investigations/${folderId}/members`);
  if (!resp.ok) {
    if (resp.status === 403) throw new Error('not_synced');
    throw new Error('Failed to fetch members');
  }
  return resp.json();
}

export async function addInvestigationMember(folderId: string, userId: string, role = 'editor') {
  const resp = await apiFetch(`/api/investigations/${folderId}/members`, {
    method: 'POST',
    body: JSON.stringify({ userId, role }),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || 'Failed to add member');
  }
}

export async function inviteByEmail(folderId: string, email: string, role = 'editor') {
  const resp = await apiFetch(`/api/investigations/${folderId}/invite`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || 'Failed to invite');
  }
}

export async function removeInvestigationMember(folderId: string, userId: string) {
  const resp = await apiFetch(`/api/investigations/${folderId}/members/${userId}`, {
    method: 'DELETE',
  });
  if (!resp.ok) throw await apiError(resp, 'Failed to remove member');
}

export async function updateMemberRole(folderId: string, userId: string, role: string) {
  const resp = await apiFetch(`/api/investigations/${folderId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
  if (!resp.ok) throw await apiError(resp, 'Failed to update role');
}

// ─── CaddyShack Posts ────────────────────────────────────────────

export async function createPost(data: {
  content: string;
  attachments?: Array<{ id: string; url: string; type: string; mimeType: string; filename: string; size?: number; thumbnailUrl?: string; alt?: string }>;
  mentions?: string[];
  folderId?: string | null;
  parentId?: string | null;
  replyToId?: string | null;
  clsLevel?: string | null;
}): Promise<Post> {
  const resp = await apiFetch('/api/caddyshack/posts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!resp.ok) throw await apiError(resp, 'Failed to create post');
  return resp.json();
}

export async function fetchPost(postId: string): Promise<Post> {
  const resp = await apiFetch(`/api/caddyshack/posts/${postId}`);
  if (!resp.ok) throw new Error('Failed to fetch post');
  return resp.json();
}

export async function editPost(postId: string, updates: { content?: string; pinned?: boolean }) {
  const resp = await apiFetch(`/api/caddyshack/posts/${postId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  if (!resp.ok) throw await apiError(resp, 'Failed to edit post');
}

export async function deletePost(postId: string) {
  const resp = await apiFetch(`/api/caddyshack/posts/${postId}`, { method: 'DELETE' });
  if (!resp.ok) throw await apiError(resp, 'Failed to delete post');
}

export async function addReaction(postId: string, emoji: string) {
  const resp = await apiFetch(`/api/caddyshack/posts/${postId}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ emoji }),
  });
  if (!resp.ok) throw new Error('Failed to add reaction');
}

export async function removeReaction(postId: string, emoji: string) {
  const resp = await apiFetch(`/api/caddyshack/posts/${postId}/reactions/${encodeURIComponent(emoji)}`, {
    method: 'DELETE',
  });
  if (!resp.ok) throw new Error('Failed to remove reaction');
}

// ─── Files ──────────────────────────────────────────────────────

export async function uploadFile(file: File, folderId?: string): Promise<{
  id: string;
  url: string;
  thumbnailUrl: string | null;
  mimeType: string;
  size: number;
  filename: string;
}> {
  const formData = new FormData();
  formData.append('file', file);
  if (folderId) formData.append('folderId', folderId);

  const resp = await apiFetch('/api/files/upload', {
    method: 'POST',
    body: formData,
    headers: {}, // Let browser set content-type for FormData
  });
  if (!resp.ok) throw await apiError(resp, 'Failed to upload file');
  return resp.json();
}

export function getFileUrl(fileId: string): string {
  return _serverUrl ? `${_serverUrl}/api/files/${fileId}` : '';
}

// ─── LLM ────────────────────────────────────────────────────────

export async function fetchLLMConfig(): Promise<LLMConfig> {
  const resp = await apiFetch('/api/llm/config');
  if (!resp.ok) throw new Error('Failed to fetch LLM config');
  return resp.json();
}

export async function streamLLMChat(
  data: { provider: string; model: string; messages: unknown[]; systemPrompt?: string; tools?: unknown[] },
  onChunk: (text: string) => void,
  onDone: (stopReason: string, contentBlocks?: unknown[], usage?: { input: number; output: number }) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
) {
  const token = await _getToken();
  const resp = await fetch(`${_serverUrl}/api/llm/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
    signal,
  });

  if (!resp.ok) {
    const err = await resp.text();
    onError(err);
    return;
  }

  const reader = resp.body?.getReader();
  if (!reader) { onError('No response body'); return; }
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      try {
        const event = JSON.parse(data);
        if (typeof event !== 'object' || event === null || typeof event.type !== 'string') continue;
        if (event.type === 'chunk' && typeof event.content === 'string') onChunk(event.content);
        else if (event.type === 'done') onDone(event.stopReason ?? 'end_turn', event.contentBlocks ?? [], event.usage);
        else if (event.type === 'error' && event.error) onError(String(event.error));
      } catch (e) { console.warn('Failed to parse SSE event:', e); }
    }
  }
}

// ─── Audit ──────────────────────────────────────────────────────

export async function fetchAuditLog(opts: { folderId?: string; userId?: string; since?: string; category?: string; limit?: number }): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams();
  if (opts.folderId) params.set('folderId', opts.folderId);
  if (opts.userId) params.set('userId', opts.userId);
  if (opts.since) params.set('since', opts.since);
  if (opts.category) params.set('category', opts.category);
  if (opts.limit) params.set('limit', String(opts.limit));
  const resp = await apiFetch(`/api/audit?${params}`);
  if (!resp.ok) throw new Error('Failed to fetch audit log');
  return resp.json();
}

// ─── Notifications ──────────────────────────────────────────────

export async function fetchNotifications(unread = false, limit = 50): Promise<Notification[]> {
  const params = new URLSearchParams();
  if (unread) params.set('unread', 'true');
  params.set('limit', String(limit));
  const resp = await apiFetch(`/api/notifications?${params}`);
  if (!resp.ok) throw new Error('Failed to fetch notifications');
  return resp.json();
}

export async function markNotificationRead(id: string) {
  const resp = await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
  if (!resp.ok) throw await apiError(resp, 'Failed to mark notification as read');
}

export async function markAllNotificationsRead() {
  const resp = await apiFetch('/api/notifications/mark-all-read', { method: 'POST' });
  if (!resp.ok) throw await apiError(resp, 'Failed to mark notifications as read');
}

// ─── Users ──────────────────────────────────────────────────────

export async function searchUsers(query: string): Promise<UserListItem[]> {
  const resp = await apiFetch(`/api/users?search=${encodeURIComponent(query)}`);
  if (!resp.ok) throw new Error('Failed to search users');
  return resp.json();
}

export async function fetchAllUsers(): Promise<{ data: UserListItem[]; total: number; limit: number; offset: number }> {
  const resp = await apiFetch('/api/users');
  if (!resp.ok) throw new Error('Failed to fetch users');
  return resp.json();
}

export async function fetchUserProfile(userId: string): Promise<UserProfile> {
  const resp = await apiFetch(`/api/users/${userId}`);
  if (!resp.ok) throw new Error('Failed to fetch user');
  return resp.json();
}

export async function fetchUserFeed(userId: string): Promise<Post[]> {
  const resp = await apiFetch(`/api/users/${userId}/feed`);
  if (!resp.ok) throw new Error('Failed to fetch user feed');
  return resp.json();
}

export async function fetchUserLikes(userId: string): Promise<Post[]> {
  const resp = await apiFetch(`/api/users/${userId}/likes`);
  if (!resp.ok) throw new Error('Failed to fetch user likes');
  return resp.json();
}

export async function fetchUserActivity(userId: string): Promise<ActivityEntry[]> {
  const resp = await apiFetch(`/api/users/${userId}/activity`);
  if (!resp.ok) throw new Error('Failed to fetch user activity');
  return resp.json();
}

// ─── Backups ─────────────────────────────────────────────────────

export interface BackupMeta {
  id: string;
  name: string;
  type: 'full' | 'differential';
  scope: 'all' | 'investigation' | 'entity';
  scopeId: string | null;
  entityCount: number;
  sizeBytes: number;
  parentBackupId: string | null;
  createdAt: string;
}

export async function createBackup(
  metadata: {
    name: string;
    type: string;
    scope: string;
    scopeId?: string;
    entityCount: number;
    parentBackupId?: string;
  },
  encryptedBlob: Blob,
): Promise<BackupMeta> {
  const formData = new FormData();
  formData.append('metadata', JSON.stringify(metadata));
  formData.append('blob', encryptedBlob, 'backup.enc');

  const resp = await apiFetch('/api/backups', {
    method: 'POST',
    body: formData,
    headers: {},
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Failed to create backup' }));
    throw new Error(err.error || 'Failed to create backup');
  }
  return resp.json();
}

export async function listBackups(): Promise<{ backups: BackupMeta[] }> {
  const resp = await apiFetch('/api/backups');
  if (!resp.ok) throw new Error('Failed to list backups');
  return resp.json();
}

export async function downloadBackup(id: string): Promise<Blob> {
  const resp = await apiFetch(`/api/backups/${id}`);
  if (!resp.ok) throw new Error('Failed to download backup');
  return resp.blob();
}

export async function deleteBackup(id: string): Promise<void> {
  const resp = await apiFetch(`/api/backups/${id}`, { method: 'DELETE' });
  if (!resp.ok) throw new Error('Failed to delete backup');
}

// ─── Integration Templates (Team Sharing) ────────────────────────

export async function shareIntegrationTemplate(template: unknown): Promise<void> {
  const resp = await apiFetch('/api/integrations/templates', {
    method: 'POST',
    body: JSON.stringify(template),
  });
  if (!resp.ok) throw new Error('Failed to share template');
}

export async function fetchTeamTemplates(): Promise<unknown[]> {
  const resp = await apiFetch('/api/integrations/templates');
  if (!resp.ok) throw new Error('Failed to fetch team templates');
  return resp.json();
}

export async function deleteTeamTemplate(id: string): Promise<void> {
  const resp = await apiFetch(`/api/integrations/templates/${id}`, { method: 'DELETE' });
  if (!resp.ok) throw new Error('Failed to delete template');
}

// ─── Saved Searches (Team Sharing) ────────────────────────────────

export interface ServerSavedSearch {
  id: string;
  userId: string;
  name: string;
  query: string;
  filters: Record<string, unknown>;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function fetchSavedSearches(): Promise<{ searches: ServerSavedSearch[] }> {
  const resp = await apiFetch('/api/saved-searches');
  if (!resp.ok) throw new Error('Failed to fetch saved searches');
  return resp.json();
}

export async function createSavedSearch(data: {
  name: string;
  query: string;
  filters?: Record<string, unknown>;
  isShared?: boolean;
}): Promise<{ search: ServerSavedSearch }> {
  const resp = await apiFetch('/api/saved-searches', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!resp.ok) throw new Error('Failed to create saved search');
  return resp.json();
}

export async function updateSavedSearch(id: string, data: {
  name: string;
  query: string;
  filters?: Record<string, unknown>;
  isShared?: boolean;
}): Promise<{ search: ServerSavedSearch }> {
  const resp = await apiFetch(`/api/saved-searches/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!resp.ok) throw new Error('Failed to update saved search');
  return resp.json();
}

export async function deleteSavedSearch(id: string): Promise<void> {
  const resp = await apiFetch(`/api/saved-searches/${id}`, { method: 'DELETE' });
  if (!resp.ok) throw new Error('Failed to delete saved search');
}
