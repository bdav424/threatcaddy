export type EmailProviderId =
  | 'google-gmail'
  | 'microsoft-outlook'
  | 'proton-bridge'
  | 'generic-imap-smtp'
  | 'manual-local-bridge';

export type EmailAccountStatus =
  | 'not_configured'
  | 'pending'
  | 'connected'
  | 'failed'
  | 'revoked'
  | 'design_only/mock_only';

export type EmailCredentialReferenceKind = 'oauth-token' | 'local-bridge' | 'external-secret';

export interface EmailCredentialReference {
  kind: EmailCredentialReferenceKind;
  id: string;
  label?: string;
  storedBy: 'external-provider' | 'local-bridge' | 'secret-store';
}

export interface EmailProviderCapabilities {
  canReadMail: boolean;
  canSearchMail: boolean;
  canDraft: boolean;
  canSend: boolean;
  canListFolders: boolean;
  canReadAttachments: boolean;
  requiresOAuth: boolean;
  requiresLocalBridge: boolean;
  supportsMockOnly: boolean;
  sendEnabledByDefault: false;
}

export interface EmailProviderMetadata {
  id: EmailProviderId;
  label: string;
  family: 'google' | 'microsoft' | 'proton' | 'imap-smtp' | 'manual-proxy';
  authModel: 'oauth' | 'bridge-assisted' | 'manual-local-bridge';
  setupMode: 'needs-provider-oauth' | 'needs-local-bridge' | 'manual-local-proxy' | 'design-only';
  capabilities: EmailProviderCapabilities;
  statusWhenNoCredentialStore: EmailAccountStatus;
  notes: string[];
}

export interface EmailAccountConfig {
  schemaVersion: 1;
  id: string;
  providerId: EmailProviderId;
  label: string;
  address?: string;
  status: EmailAccountStatus;
  credentialRef?: EmailCredentialReference;
  sendPolicy: 'disabled' | 'draft_only' | 'manual_confirm';
  lastTestedAt?: number;
  lastError?: string;
  revokedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface EmailConnectionTestResult {
  accountId: string;
  providerId: EmailProviderId;
  ok: boolean;
  status: EmailAccountStatus;
  code:
    | 'mock_connected'
    | 'not_configured'
    | 'revoked'
    | 'needs_local_bridge'
    | 'needs_provider_oauth'
    | 'design_only'
    | 'missing_credential_reference'
    | 'local_bridge_unavailable';
  message: string;
  testedAt: number;
}

export interface EmailConnectionTestOptions {
  now?: number;
  localBridgeAvailable?: boolean;
  allowMockConnected?: boolean;
}

const MAX_STRING = 500;
const MAX_ACCOUNT_ID_LENGTH = 160;
const MAX_DATE_TIMESTAMP = 8_640_000_000_000_000;
const EMAIL_ACCOUNT_SCHEMA_VERSION = 1;
const REDACTED_EMAIL_ERROR = 'Connection test failed. Sensitive error details were removed.';
const SECRET_MATERIAL_MARKERS = [
  'password',
  'accesstoken',
  'refreshtoken',
  'clientsecret',
  'apikey',
  'apitoken',
  'apppassword',
  'privatekey',
  'smtppassword',
  'imappassword',
] as const;

const VALID_STATUSES = new Set<EmailAccountStatus>([
  'not_configured',
  'pending',
  'connected',
  'failed',
  'revoked',
  'design_only/mock_only',
]);

const VALID_PROVIDERS = new Set<EmailProviderId>([
  'google-gmail',
  'microsoft-outlook',
  'proton-bridge',
  'generic-imap-smtp',
  'manual-local-bridge',
]);

const VALID_CREDENTIAL_KINDS = new Set<EmailCredentialReferenceKind>([
  'oauth-token',
  'local-bridge',
  'external-secret',
]);

export const EMAIL_PROVIDER_METADATA: Record<EmailProviderId, EmailProviderMetadata> = {
  'google-gmail': {
    id: 'google-gmail',
    label: 'Google Gmail',
    family: 'google',
    authModel: 'oauth',
    setupMode: 'needs-provider-oauth',
    capabilities: {
      canReadMail: true,
      canSearchMail: true,
      canDraft: true,
      canSend: true,
      canListFolders: true,
      canReadAttachments: true,
      requiresOAuth: true,
      requiresLocalBridge: false,
      supportsMockOnly: true,
      sendEnabledByDefault: false,
    },
    statusWhenNoCredentialStore: 'pending',
    notes: [
      'Requires a future OAuth consent flow and external token storage before real connection.',
      'No OAuth token is stored in ThreatCaddy settings.',
    ],
  },
  'microsoft-outlook': {
    id: 'microsoft-outlook',
    label: 'Microsoft Outlook / Hotmail',
    family: 'microsoft',
    authModel: 'oauth',
    setupMode: 'needs-provider-oauth',
    capabilities: {
      canReadMail: true,
      canSearchMail: true,
      canDraft: true,
      canSend: true,
      canListFolders: true,
      canReadAttachments: true,
      requiresOAuth: true,
      requiresLocalBridge: false,
      supportsMockOnly: true,
      sendEnabledByDefault: false,
    },
    statusWhenNoCredentialStore: 'pending',
    notes: [
      'Requires a future Microsoft OAuth consent flow and external token storage before real connection.',
      'Hotmail accounts use the same Microsoft-family onboarding contract.',
    ],
  },
  'proton-bridge': {
    id: 'proton-bridge',
    label: 'Proton Mail via Bridge',
    family: 'proton',
    authModel: 'bridge-assisted',
    setupMode: 'needs-local-bridge',
    capabilities: {
      canReadMail: true,
      canSearchMail: false,
      canDraft: true,
      canSend: true,
      canListFolders: true,
      canReadAttachments: true,
      requiresOAuth: false,
      requiresLocalBridge: true,
      supportsMockOnly: true,
      sendEnabledByDefault: false,
    },
    statusWhenNoCredentialStore: 'pending',
    notes: [
      'Requires Proton Bridge or an equivalent local proxy managed outside browser localStorage.',
      'ThreatCaddy stores only a local bridge reference, not the Proton password or bridge secret.',
    ],
  },
  'generic-imap-smtp': {
    id: 'generic-imap-smtp',
    label: 'Generic IMAP/SMTP',
    family: 'imap-smtp',
    authModel: 'manual-local-bridge',
    setupMode: 'needs-local-bridge',
    capabilities: {
      canReadMail: true,
      canSearchMail: false,
      canDraft: true,
      canSend: true,
      canListFolders: true,
      canReadAttachments: true,
      requiresOAuth: false,
      requiresLocalBridge: true,
      supportsMockOnly: true,
      sendEnabledByDefault: false,
    },
    statusWhenNoCredentialStore: 'pending',
    notes: [
      'Browser code must not open IMAP/SMTP sockets or store mailbox passwords.',
      'Use a future local bridge or external secret store for credentials.',
    ],
  },
  'manual-local-bridge': {
    id: 'manual-local-bridge',
    label: 'Manual local bridge / proxy',
    family: 'manual-proxy',
    authModel: 'manual-local-bridge',
    setupMode: 'manual-local-proxy',
    capabilities: {
      canReadMail: true,
      canSearchMail: true,
      canDraft: true,
      canSend: true,
      canListFolders: true,
      canReadAttachments: true,
      requiresOAuth: false,
      requiresLocalBridge: true,
      supportsMockOnly: true,
      sendEnabledByDefault: false,
    },
    statusWhenNoCredentialStore: 'pending',
    notes: [
      'A user-managed local proxy can prove connectivity without exposing credentials to localStorage.',
      'Direct send remains disabled until a later explicit approval and send policy slice.',
    ],
  },
};

export const EMAIL_PROVIDER_LIST = Object.values(EMAIL_PROVIDER_METADATA);

function safeString(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.slice(0, MAX_STRING).trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeSecretScanString(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function containsSecretMaterialMarker(value: string): boolean {
  const normalized = normalizeSecretScanString(value);
  return SECRET_MATERIAL_MARKERS.some((marker) => normalized.includes(marker));
}

function sanitizeAccountIdentifier(value: unknown): string | undefined {
  const id = safeString(value).slice(0, MAX_ACCOUNT_ID_LENGTH);
  if (!id) return undefined;
  if (containsSecretMaterialMarker(id)) return undefined;
  if (!/^[A-Za-z0-9._:@/+~-]+$/.test(id)) return undefined;
  return id;
}

function sanitizeDisplayLabel(value: unknown, fallback?: string): string | undefined {
  const label = safeString(value);
  if (!label || containsSecretMaterialMarker(label)) return fallback;
  return label;
}

function sanitizeTimestamp(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return fallback;
  if (value < 0 || value > MAX_DATE_TIMESTAMP) return fallback;
  return value;
}

function sanitizeOptionalTimestamp(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return undefined;
  if (value < 0 || value > MAX_DATE_TIMESTAMP) return undefined;
  return value;
}

function isCredentialReferenceStorageValid(
  kind: EmailCredentialReferenceKind,
  storedBy: EmailCredentialReference['storedBy'],
): boolean {
  if (kind === 'oauth-token') {
    return storedBy === 'external-provider' || storedBy === 'secret-store';
  }
  if (kind === 'local-bridge') {
    return storedBy === 'local-bridge';
  }
  return storedBy === 'secret-store';
}

function sanitizeCredentialReference(value: unknown): EmailCredentialReference | undefined {
  if (!isRecord(value)) return undefined;
  const kind = safeString(value.kind) as EmailCredentialReferenceKind;
  if (!VALID_CREDENTIAL_KINDS.has(kind)) return undefined;
  const id = sanitizeAccountIdentifier(value.id);
  if (!id) return undefined;
  const storedBy = safeString(value.storedBy);
  if (!['external-provider', 'local-bridge', 'secret-store'].includes(storedBy)) return undefined;
  if (!isCredentialReferenceStorageValid(kind, storedBy as EmailCredentialReference['storedBy'])) return undefined;
  return {
    kind,
    id,
    label: sanitizeDisplayLabel(value.label),
    storedBy: storedBy as EmailCredentialReference['storedBy'],
  };
}

export function sanitizeEmailAccount(raw: unknown): EmailAccountConfig | null {
  if (!isRecord(raw)) return null;
  const providerId = safeString(raw.providerId) as EmailProviderId;
  if (!VALID_PROVIDERS.has(providerId)) return null;
  const now = Date.now();
  const id = sanitizeAccountIdentifier(raw.id);
  if (!id) return null;
  const rawStatus = safeString(raw.status) as EmailAccountStatus;
  const status = VALID_STATUSES.has(rawStatus) ? rawStatus : 'not_configured';
  const sendPolicy = safeString(raw.sendPolicy);
  const createdAt = sanitizeTimestamp(raw.createdAt, now);
  const updatedAt = Math.max(createdAt, sanitizeTimestamp(raw.updatedAt, now));
  const lastTestedAt = sanitizeOptionalTimestamp(raw.lastTestedAt);
  const revokedAt = sanitizeOptionalTimestamp(raw.revokedAt);

  return {
    schemaVersion: EMAIL_ACCOUNT_SCHEMA_VERSION,
    id,
    providerId,
    label: sanitizeDisplayLabel(raw.label, EMAIL_PROVIDER_METADATA[providerId].label) || EMAIL_PROVIDER_METADATA[providerId].label,
    address: sanitizeDisplayLabel(raw.address),
    status,
    credentialRef: sanitizeCredentialReference(raw.credentialRef),
    sendPolicy: sendPolicy === 'manual_confirm' || sendPolicy === 'disabled' ? sendPolicy : 'draft_only',
    lastTestedAt,
    lastError: containsSecretMaterialMarker(safeString(raw.lastError))
      ? REDACTED_EMAIL_ERROR
      : safeString(raw.lastError) || undefined,
    revokedAt,
    createdAt,
    updatedAt,
  };
}

export function sanitizeEmailAccounts(raw: unknown): EmailAccountConfig[] {
  if (!Array.isArray(raw)) return [];
  const deduped = new Map<string, EmailAccountConfig>();
  for (const item of raw) {
    const account = sanitizeEmailAccount(item);
    if (!account) continue;
    const existing = deduped.get(account.id);
    if (
      !existing
      || account.updatedAt > existing.updatedAt
      || (account.updatedAt === existing.updatedAt && account.createdAt >= existing.createdAt)
    ) {
      deduped.set(account.id, account);
    }
  }
  return Array.from(deduped.values());
}

export function createEmailAccountConfig(input: {
  id: string;
  providerId: EmailProviderId;
  label?: string;
  address?: string;
  credentialRef?: EmailCredentialReference;
  now?: number;
}): EmailAccountConfig {
  const now = input.now ?? Date.now();
  const provider = EMAIL_PROVIDER_METADATA[input.providerId];
  const account = sanitizeEmailAccount({
    schemaVersion: EMAIL_ACCOUNT_SCHEMA_VERSION,
    id: input.id,
    providerId: input.providerId,
    label: input.label ?? provider.label,
    address: input.address,
    status: input.credentialRef ? 'pending' : provider.statusWhenNoCredentialStore,
    credentialRef: sanitizeCredentialReference(input.credentialRef),
    sendPolicy: 'draft_only',
    createdAt: now,
    updatedAt: now,
  });
  if (!account) {
    throw new Error('Invalid email account metadata');
  }
  return account;
}

export function markEmailAccountPending(account: EmailAccountConfig, now = Date.now()): EmailAccountConfig {
  return { ...account, status: 'pending', lastError: undefined, updatedAt: now };
}

export function markEmailAccountConnected(account: EmailAccountConfig, now = Date.now()): EmailAccountConfig {
  return { ...account, status: 'connected', lastError: undefined, lastTestedAt: now, updatedAt: now };
}

export function markEmailAccountFailed(account: EmailAccountConfig, error: string, now = Date.now()): EmailAccountConfig {
  return { ...account, status: 'failed', lastError: safeString(error, 'Connection test failed'), lastTestedAt: now, updatedAt: now };
}

export function markEmailAccountRevoked(account: EmailAccountConfig, now = Date.now()): EmailAccountConfig {
  return {
    ...account,
    status: 'revoked',
    credentialRef: undefined,
    lastError: undefined,
    revokedAt: now,
    updatedAt: now,
  };
}

export function hasStoredEmailSecretMaterial(value: unknown): boolean {
  const seen = new WeakSet<object>();
  const pending: unknown[] = [value];

  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current === 'string') {
      if (containsSecretMaterialMarker(current)) return true;
      continue;
    }
    if (current === null || typeof current !== 'object') continue;
    if (seen.has(current)) continue;
    seen.add(current);

    if (current instanceof Map) {
      for (const [key, nested] of current.entries()) {
        pending.push(key, nested);
      }
      continue;
    }

    if (current instanceof Set) {
      for (const nested of current.values()) {
        pending.push(nested);
      }
      continue;
    }

    for (const [key, nested] of Object.entries(current)) {
      if (containsSecretMaterialMarker(key)) return true;
      pending.push(nested);
    }
  }

  return false;
}

export async function testEmailAccountConnection(
  account: EmailAccountConfig,
  options: EmailConnectionTestOptions = {},
): Promise<EmailConnectionTestResult> {
  const testedAt = options.now ?? Date.now();
  const provider = EMAIL_PROVIDER_METADATA[account.providerId];

  if (account.status === 'revoked') {
    return {
      accountId: account.id,
      providerId: account.providerId,
      ok: false,
      status: 'revoked',
      code: 'revoked',
      message: 'Connection test blocked because this account has been revoked.',
      testedAt,
    };
  }

  if (account.status === 'not_configured') {
    return {
      accountId: account.id,
      providerId: account.providerId,
      ok: false,
      status: 'not_configured',
      code: 'not_configured',
      message: 'Connection test blocked because no provider setup has been configured.',
      testedAt,
    };
  }

  if (account.status === 'design_only/mock_only' && !options.allowMockConnected) {
    return {
      accountId: account.id,
      providerId: account.providerId,
      ok: false,
      status: 'design_only/mock_only',
      code: 'design_only',
      message: 'This provider is present for design/mock planning only and does not perform live connection tests.',
      testedAt,
    };
  }

  if (options.allowMockConnected && provider.capabilities.supportsMockOnly) {
    return {
      accountId: account.id,
      providerId: account.providerId,
      ok: true,
      status: 'connected',
      code: 'mock_connected',
      message: 'Mock connection test passed without contacting a provider.',
      testedAt,
    };
  }

  if (!account.credentialRef) {
    return {
      accountId: account.id,
      providerId: account.providerId,
      ok: false,
      status: 'failed',
      code: provider.capabilities.requiresLocalBridge ? 'needs_local_bridge' : 'needs_provider_oauth',
      message: provider.capabilities.requiresLocalBridge
        ? 'Connection test requires a local bridge or external secret reference. No mailbox secret was stored in ThreatCaddy.'
        : 'Connection test requires a future OAuth token reference. No OAuth secret was stored in ThreatCaddy.',
      testedAt,
    };
  }

  if (provider.capabilities.requiresLocalBridge && !options.localBridgeAvailable) {
    return {
      accountId: account.id,
      providerId: account.providerId,
      ok: false,
      status: 'failed',
      code: 'local_bridge_unavailable',
      message: 'Local bridge/proxy is not available, so ThreatCaddy did not attempt IMAP/SMTP or provider network access.',
      testedAt,
    };
  }

  return {
    accountId: account.id,
    providerId: account.providerId,
    ok: false,
    status: 'failed',
    code: 'missing_credential_reference',
    message: 'A live connector is not implemented in this slice. Store only external credential references until an approved bridge exists.',
    testedAt,
  };
}

export function applyConnectionTestResult(account: EmailAccountConfig, result: EmailConnectionTestResult): EmailAccountConfig {
  if (result.ok) return markEmailAccountConnected(account, result.testedAt);
  if (result.status === 'revoked') return markEmailAccountRevoked(account, result.testedAt);
  if (result.status === 'not_configured') return { ...account, status: 'not_configured', lastTestedAt: result.testedAt, updatedAt: result.testedAt };
  return markEmailAccountFailed(account, result.message, result.testedAt);
}
