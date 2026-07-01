import { hasConnectorSecretMaterial } from './connector-credential-boundary';
import type { ProviderAdapterDryRunHarnessMetadata } from './provider-adapter-dry-run-harness';
import type { ProviderAuthSessionAdapterAction } from './provider-auth-session-adapter-plan';
import {
  createRuntimeTrustedContractObject,
  isRuntimeTrustedContractObject,
  type RuntimeTrustedContractEntry,
  type RuntimeTrustedContractObject,
} from './runtime-trusted-contract-object';

export type ProviderAdapterExecutionBoundaryStatus = 'allow' | 'block';

export type ProviderAdapterExecutionBoundaryReason =
  | 'provider_adapter_execution_boundary_ready'
  | 'input_shape_forbidden'
  | 'unsafe_input_field'
  | 'raw_secret_material'
  | 'dry_run_missing'
  | 'dry_run_not_accepted'
  | 'dry_run_boundary_invalid'
  | 'dry_run_owner_missing'
  | 'caller_facts_missing'
  | 'caller_facts_invalid'
  | 'caller_boundary_unacknowledged'
  | 'adapter_claim_missing'
  | 'adapter_claim_invalid'
  | 'adapter_action_unsupported'
  | 'adapter_executable_claim_blocked'
  | 'provider_transport_execution_not_enabled'
  | 'owner_mismatch'
  | 'credential_reference_mismatch'
  | 'consent_mismatch'
  | 'identifier_unsafe';

export interface ProviderAdapterExecutionCallerFacts {
  schemaVersion: 1;
  factKind: 'provider-adapter-execution-caller-facts';
  providerId: string;
  connectorId: string;
  accountId?: string;
  surface: string;
  targetSurface: string;
  actionId: string;
  adapterId: string;
  adapterVersion: string;
  credentialReferenceId: string;
  consentGrantId: string;
  dryRunId?: string;
  authAction?: ProviderAuthSessionAdapterAction;
  credentialSessionStatus: 'session-ready';
  mayUseCredentialHandle: true;
  explicitConsentStatus: 'allow';
  explicitConsentAllowed: true;
  reviewed: true;
  acknowledgedDryRunBoundary: true;
  acknowledgedNoCredentialResolution: true;
  acknowledgedNoProviderCall: true;
}

export interface ProviderAdapterExecutionAdapterClaim {
  schemaVersion: 1;
  claimKind: 'injected-provider-adapter-execution-claim';
  runtimeOwner: 'provider-adapter-execution-boundary';
  adapterId: string;
  adapterVersion: string;
  providerId: string;
  connectorId: string;
  accountId?: string;
  surface: string;
  targetSurface: string;
  credentialReferenceId: string;
  supportedActionIds: readonly string[];
  executable: false;
  willCallProvider: false;
  willResolveCredential: false;
  willOpenWindow: false;
  sideEffects: 'none';
  sideEffectBoundary: 'injected-provider-adapter-claim-no-fetch-no-storage-no-provider-sdk-no-oauth-no-window-no-secret-resolution';
}

export interface ProviderAdapterExecutionBoundaryInput {
  dryRun?: unknown;
  callerFacts?: unknown;
  adapterClaim?: unknown;
  payload?: unknown;
}

export interface ProviderAdapterExecutionBoundaryDecision {
  status: ProviderAdapterExecutionBoundaryStatus;
  allowed: boolean;
  reason: ProviderAdapterExecutionBoundaryReason;
  blockReasons: readonly ProviderAdapterExecutionBoundaryReason[];
  dryRunId?: string;
  adapter?: {
    id: string;
    version: string;
  };
  owner?: {
    surface: string;
    targetSurface: string;
    providerId: string;
    connectorId: string;
    actionId: string;
    accountId?: string;
  };
  credentialReference?: {
    id: string;
    kind?: string;
    storageOwner?: string;
    providerId?: string;
    connectorId?: string;
    accountId?: string;
  };
  authAction?: ProviderAuthSessionAdapterAction;
  consentGrantId?: string;
  mayInvokeInjectedAdapter: boolean;
  adapterCalled: false;
  executable: false;
  willCallProvider: false;
  willResolveCredential: false;
  willOpenWindow: false;
  sideEffects: 'none';
  sideEffectBoundary: 'provider-adapter-execution-boundary-decision-only-no-fetch-no-socket-no-storage-no-provider-sdk-no-oauth-no-window-no-secret-resolution-no-adapter-call';
}

const DRY_RUN_BOUNDARY =
  'provider-adapter-dry-run-harness-no-fetch-no-socket-no-storage-no-provider-sdk-no-oauth-no-window-no-secret-resolution' as const;

const ADAPTER_CLAIM_BOUNDARY =
  'injected-provider-adapter-claim-no-fetch-no-storage-no-provider-sdk-no-oauth-no-window-no-secret-resolution' as const;

const EXECUTION_BOUNDARY =
  'provider-adapter-execution-boundary-decision-only-no-fetch-no-socket-no-storage-no-provider-sdk-no-oauth-no-window-no-secret-resolution-no-adapter-call' as const;

const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{1,179}$/;
const TOKEN_OR_URL_PATTERN =
  /(?:https?:\/\/|wss?:\/\/|(?:^|[/:@])hooks\.slack(?:-gov)?\.com\/services\/|(?:^|[/:@])(?:api|auth|oauth|login|graph|mail|smtp|imap|accounts|webhook|hooks)\.[a-z0-9.-]+\.[a-z]{2,}\/|xox[abprs]-|bearer\s+[a-z0-9._~+/=-]{8,}|(?:api|app|bot|client|refresh|access)[_-]?(?:key|token|secret)[=:]\s*\S+|-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----)/i;
const VAULT_CREDENTIAL_REFERENCE_PATTERN = /^vault:[A-Za-z0-9][A-Za-z0-9._:@/+~-]{1,179}$/;
const URL_LIKE_IDENTIFIER_PATTERNS = [
  /^[a-z][a-z0-9+.-]*:/i,
  /^\/\//,
  /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|\[?::1\]?)(?::\d+)?\//i,
  /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?\/\S+/,
] as const;

const SUPPORTED_AUTH_ACTIONS = new Set<ProviderAuthSessionAdapterAction>([
  'start_oauth',
  'complete_oauth',
  'refresh_session',
  'revoke_session',
  'test_provider_auth',
]);

const INPUT_KEYS = new Set([
  'dryRun',
  'callerFacts',
  'adapterClaim',
  'payload',
]);

const CALLER_FACT_KEYS = new Set([
  'schemaVersion',
  'factKind',
  'providerId',
  'connectorId',
  'accountId',
  'surface',
  'targetSurface',
  'actionId',
  'adapterId',
  'adapterVersion',
  'credentialReferenceId',
  'consentGrantId',
  'dryRunId',
  'authAction',
  'credentialSessionStatus',
  'mayUseCredentialHandle',
  'explicitConsentStatus',
  'explicitConsentAllowed',
  'reviewed',
  'acknowledgedDryRunBoundary',
  'acknowledgedNoCredentialResolution',
  'acknowledgedNoProviderCall',
]);

const ADAPTER_CLAIM_KEYS = new Set([
  'schemaVersion',
  'claimKind',
  'runtimeOwner',
  'adapterId',
  'adapterVersion',
  'providerId',
  'connectorId',
  'accountId',
  'surface',
  'targetSurface',
  'credentialReferenceId',
  'supportedActionIds',
  'executable',
  'willCallProvider',
  'willResolveCredential',
  'willOpenWindow',
  'sideEffects',
  'sideEffectBoundary',
]);

const DRY_RUN_KEYS = new Set([
  'status',
  'accepted',
  'reason',
  'dryRunId',
  'adapter',
  'owner',
  'credentialReference',
  'authAction',
  'consentGrantId',
  'executable',
  'willCallProvider',
  'willResolveCredential',
  'willOpenWindow',
  'sideEffects',
  'sideEffectBoundary',
]);

const DRY_RUN_ADAPTER_KEYS = new Set(['id', 'version']);
const DRY_RUN_OWNER_KEYS = new Set([
  'surface',
  'targetSurface',
  'providerId',
  'connectorId',
  'actionId',
  'accountId',
]);
const DRY_RUN_CREDENTIAL_REFERENCE_KEYS = new Set([
  'id',
  'kind',
  'storageOwner',
  'providerId',
  'connectorId',
  'accountId',
]);

const UNSAFE_INPUT_FIELD_PATTERNS = [
  /adapter/i,
  /body/i,
  /callback/i,
  /content/i,
  /execute/i,
  /executable/i,
  /fetch/i,
  /headers?/i,
  /httpclient/i,
  /indexeddb/i,
  /invoke/i,
  /liveaction/i,
  /liveexecution/i,
  /localstorage/i,
  /oauth/i,
  /onresult/i,
  /prompt/i,
  /provider/i,
  /providerclient/i,
  /providerresult/i,
  /request/i,
  /requester/i,
  /response/i,
  /send/i,
  /socket/i,
  /storage/i,
  /sync/i,
  /transport/i,
  /websocket/i,
  /xhr/i,
] as const;

const EXECUTABLE_TRUE_FIELD_PATTERNS = [
  /adapter/i,
  /execute/i,
  /executable/i,
  /fetch/i,
  /invoke/i,
  /live/i,
  /may/i,
  /oauth/i,
  /provider/i,
  /send/i,
  /socket/i,
  /storage/i,
  /sync/i,
  /transport/i,
  /will/i,
] as const;

function trustedContractObject<T>(
  entries: readonly (readonly [key: string, value: unknown])[],
): RuntimeTrustedContractObject & Readonly<T> {
  return createRuntimeTrustedContractObject(
    entries as readonly RuntimeTrustedContractEntry[],
  ) as RuntimeTrustedContractObject & Readonly<T>;
}

function isTrustedRecord(value: unknown): value is Record<string, unknown> {
  return isRuntimeTrustedContractObject(value);
}

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function safeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!SAFE_ID_PATTERN.test(trimmed) || TOKEN_OR_URL_PATTERN.test(trimmed)) return undefined;
  if (!VAULT_CREDENTIAL_REFERENCE_PATTERN.test(trimmed) && URL_LIKE_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return undefined;
  }
  return trimmed;
}

function unsafeIdentifier(value: unknown): boolean {
  return value !== undefined && safeIdentifier(value) === undefined;
}

function safeAuthAction(value: unknown): ProviderAuthSessionAdapterAction | undefined {
  return typeof value === 'string' && SUPPORTED_AUTH_ACTIONS.has(value as ProviderAuthSessionAdapterAction)
    ? value as ProviderAuthSessionAdapterAction
    : undefined;
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function unsafeInputFieldName(key: string): boolean {
  const normalized = normalizedKey(key);
  return UNSAFE_INPUT_FIELD_PATTERNS.some((pattern) => pattern.test(normalized));
}

function executableTrueClaim(key: string, value: unknown): boolean {
  if (value !== true) return false;
  const normalized = normalizedKey(key);
  return EXECUTABLE_TRUE_FIELD_PATTERNS.some((pattern) => pattern.test(normalized));
}

function objectHasUnsafeInputField(value: Record<string, unknown>, allowedKeys: ReadonlySet<string>): boolean {
  return Object.keys(value).some((key) => !allowedKeys.has(key) && unsafeInputFieldName(key));
}

function valueHasUnsafeInputField(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'function') return true;
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) return value.some((item) => valueHasUnsafeInputField(item, seen));
  if (value instanceof Map) {
    for (const [key, nestedValue] of value.entries()) {
      if (typeof key === 'string' && (unsafeInputFieldName(key) || executableTrueClaim(key, nestedValue))) {
        return true;
      }
      if (valueHasUnsafeInputField(nestedValue, seen)) return true;
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nestedValue of value.values()) {
      if (valueHasUnsafeInputField(nestedValue, seen)) return true;
    }
    return false;
  }

  return Object.entries(value).some(([key, nestedValue]) => (
    unsafeInputFieldName(key)
    || executableTrueClaim(key, nestedValue)
    || valueHasUnsafeInputField(nestedValue, seen)
  ));
}

function parseCallerFacts(value: unknown): ProviderAdapterExecutionCallerFacts | undefined {
  if (!isTrustedRecord(value) || !hasOnlyKeys(value, CALLER_FACT_KEYS)) return undefined;

  const providerId = safeIdentifier(value.providerId);
  const connectorId = safeIdentifier(value.connectorId);
  const accountId = safeIdentifier(value.accountId);
  const surface = safeIdentifier(value.surface);
  const targetSurface = safeIdentifier(value.targetSurface);
  const actionId = safeIdentifier(value.actionId);
  const adapterId = safeIdentifier(value.adapterId);
  const adapterVersion = safeIdentifier(value.adapterVersion);
  const credentialReferenceId = safeIdentifier(value.credentialReferenceId);
  const consentGrantId = safeIdentifier(value.consentGrantId);
  const dryRunId = safeIdentifier(value.dryRunId);
  const authAction = safeAuthAction(value.authAction);

  if (
    value.schemaVersion !== 1
    || value.factKind !== 'provider-adapter-execution-caller-facts'
    || !providerId
    || !connectorId
    || !surface
    || !targetSurface
    || !actionId
    || !adapterId
    || !adapterVersion
    || !credentialReferenceId
    || !consentGrantId
  ) {
    return undefined;
  }
  if (value.accountId !== undefined && !accountId) return undefined;
  if (value.dryRunId !== undefined && !dryRunId) return undefined;
  if (value.authAction !== undefined && !authAction) return undefined;

  return trustedContractObject<ProviderAdapterExecutionCallerFacts>([
    ['schemaVersion', 1],
    ['factKind', 'provider-adapter-execution-caller-facts'],
    ['providerId', providerId],
    ['connectorId', connectorId],
    ['accountId', accountId],
    ['surface', surface],
    ['targetSurface', targetSurface],
    ['actionId', actionId],
    ['adapterId', adapterId],
    ['adapterVersion', adapterVersion],
    ['credentialReferenceId', credentialReferenceId],
    ['consentGrantId', consentGrantId],
    ['dryRunId', dryRunId],
    ['authAction', authAction],
    ['credentialSessionStatus', value.credentialSessionStatus],
    ['mayUseCredentialHandle', value.mayUseCredentialHandle],
    ['explicitConsentStatus', value.explicitConsentStatus],
    ['explicitConsentAllowed', value.explicitConsentAllowed],
    ['reviewed', value.reviewed],
    ['acknowledgedDryRunBoundary', value.acknowledgedDryRunBoundary],
    ['acknowledgedNoCredentialResolution', value.acknowledgedNoCredentialResolution],
    ['acknowledgedNoProviderCall', value.acknowledgedNoProviderCall],
  ]);
}

function parseAdapterClaim(value: unknown): ProviderAdapterExecutionAdapterClaim | undefined {
  if (!isTrustedRecord(value) || !hasOnlyKeys(value, ADAPTER_CLAIM_KEYS)) return undefined;

  const providerId = safeIdentifier(value.providerId);
  const connectorId = safeIdentifier(value.connectorId);
  const accountId = safeIdentifier(value.accountId);
  const surface = safeIdentifier(value.surface);
  const targetSurface = safeIdentifier(value.targetSurface);
  const adapterId = safeIdentifier(value.adapterId);
  const adapterVersion = safeIdentifier(value.adapterVersion);
  const credentialReferenceId = safeIdentifier(value.credentialReferenceId);
  const supportedActionIds = Array.isArray(value.supportedActionIds)
    ? value.supportedActionIds.map(safeIdentifier)
    : [];

  if (
    value.schemaVersion !== 1
    || value.claimKind !== 'injected-provider-adapter-execution-claim'
    || value.runtimeOwner !== 'provider-adapter-execution-boundary'
    || !providerId
    || !connectorId
    || !surface
    || !targetSurface
    || !adapterId
    || !adapterVersion
    || !credentialReferenceId
    || supportedActionIds.length === 0
    || supportedActionIds.some((actionId) => !actionId)
    || value.sideEffectBoundary !== ADAPTER_CLAIM_BOUNDARY
  ) {
    return undefined;
  }
  if (value.accountId !== undefined && !accountId) return undefined;

  return trustedContractObject<ProviderAdapterExecutionAdapterClaim>([
    ['schemaVersion', 1],
    ['claimKind', 'injected-provider-adapter-execution-claim'],
    ['runtimeOwner', 'provider-adapter-execution-boundary'],
    ['adapterId', adapterId],
    ['adapterVersion', adapterVersion],
    ['providerId', providerId],
    ['connectorId', connectorId],
    ['accountId', accountId],
    ['surface', surface],
    ['targetSurface', targetSurface],
    ['credentialReferenceId', credentialReferenceId],
    ['supportedActionIds', supportedActionIds as string[]],
    ['executable', value.executable],
    ['willCallProvider', value.willCallProvider],
    ['willResolveCredential', value.willResolveCredential],
    ['willOpenWindow', value.willOpenWindow],
    ['sideEffects', value.sideEffects],
    ['sideEffectBoundary', ADAPTER_CLAIM_BOUNDARY],
  ]);
}

function dryRunBoundaryIsValid(dryRun: ProviderAdapterDryRunHarnessMetadata): boolean {
  return dryRun.status === 'accepted'
    && dryRun.accepted === true
    && dryRun.reason === 'dry_run_harness_accepted'
    && dryRun.executable === false
    && dryRun.willCallProvider === false
    && dryRun.willResolveCredential === false
    && dryRun.willOpenWindow === false
    && dryRun.sideEffects === 'none'
    && dryRun.sideEffectBoundary === DRY_RUN_BOUNDARY
    && dryRun.adapter !== undefined
    && dryRun.owner !== undefined
    && dryRun.credentialReference !== undefined
    && dryRun.consentGrantId !== undefined;
}

function dryRunShapeIsExact(value: unknown): value is ProviderAdapterDryRunHarnessMetadata {
  if (!isTrustedRecord(value) || !hasOnlyKeys(value, DRY_RUN_KEYS)) return false;
  const adapter = value.adapter;
  const owner = value.owner;
  const credentialReference = value.credentialReference;
  return (adapter === undefined || (isTrustedRecord(adapter) && hasOnlyKeys(adapter, DRY_RUN_ADAPTER_KEYS)))
    && (owner === undefined || (isTrustedRecord(owner) && hasOnlyKeys(owner, DRY_RUN_OWNER_KEYS)))
    && (
      credentialReference === undefined
      || (
        isTrustedRecord(credentialReference)
        && hasOnlyKeys(credentialReference, DRY_RUN_CREDENTIAL_REFERENCE_KEYS)
      )
    );
}

function adapterClaimBoundaryIsValid(claim: ProviderAdapterExecutionAdapterClaim): boolean {
  return claim.executable === false
    && claim.willCallProvider === false
    && claim.willResolveCredential === false
    && claim.willOpenWindow === false
    && claim.sideEffects === 'none'
    && claim.sideEffectBoundary === ADAPTER_CLAIM_BOUNDARY;
}

function callerFactsAreAcknowledged(facts: ProviderAdapterExecutionCallerFacts): boolean {
  return facts.credentialSessionStatus === 'session-ready'
    && facts.mayUseCredentialHandle === true
    && facts.explicitConsentStatus === 'allow'
    && facts.explicitConsentAllowed === true
    && facts.reviewed === true
    && facts.acknowledgedDryRunBoundary === true
    && facts.acknowledgedNoCredentialResolution === true
    && facts.acknowledgedNoProviderCall === true;
}

function identifiersAreSafe(
  dryRun: ProviderAdapterDryRunHarnessMetadata,
  callerFacts?: ProviderAdapterExecutionCallerFacts,
  adapterClaim?: ProviderAdapterExecutionAdapterClaim,
): boolean {
  return ![
    dryRun.dryRunId,
    dryRun.adapter?.id,
    dryRun.adapter?.version,
    dryRun.owner?.surface,
    dryRun.owner?.targetSurface,
    dryRun.owner?.providerId,
    dryRun.owner?.connectorId,
    dryRun.owner?.actionId,
    dryRun.owner?.accountId,
    dryRun.credentialReference?.id,
    dryRun.credentialReference?.kind,
    dryRun.credentialReference?.storageOwner,
    dryRun.credentialReference?.providerId,
    dryRun.credentialReference?.connectorId,
    dryRun.credentialReference?.accountId,
    dryRun.consentGrantId,
    callerFacts?.dryRunId,
    callerFacts?.adapterId,
    callerFacts?.adapterVersion,
    callerFacts?.providerId,
    callerFacts?.connectorId,
    callerFacts?.accountId,
    callerFacts?.surface,
    callerFacts?.targetSurface,
    callerFacts?.actionId,
    callerFacts?.credentialReferenceId,
    callerFacts?.consentGrantId,
    adapterClaim?.adapterId,
    adapterClaim?.adapterVersion,
    adapterClaim?.providerId,
    adapterClaim?.connectorId,
    adapterClaim?.accountId,
    adapterClaim?.surface,
    adapterClaim?.targetSurface,
    adapterClaim?.credentialReferenceId,
    ...(adapterClaim?.supportedActionIds ?? []),
  ].some(unsafeIdentifier);
}

function ownershipMatches(
  dryRun: ProviderAdapterDryRunHarnessMetadata,
  callerFacts: ProviderAdapterExecutionCallerFacts,
  adapterClaim: ProviderAdapterExecutionAdapterClaim,
): boolean {
  const owner = dryRun.owner;
  const adapter = dryRun.adapter;
  if (!owner || !adapter) return false;
  if (owner.accountId === undefined) return false;

  return callerFacts.providerId === owner.providerId
    && callerFacts.connectorId === owner.connectorId
    && callerFacts.surface === owner.surface
    && callerFacts.targetSurface === owner.targetSurface
    && callerFacts.actionId === owner.actionId
    && callerFacts.adapterId === adapter.id
    && callerFacts.adapterVersion === adapter.version
    && adapterClaim.providerId === owner.providerId
    && adapterClaim.connectorId === owner.connectorId
    && adapterClaim.surface === owner.surface
    && adapterClaim.targetSurface === owner.targetSurface
    && adapterClaim.adapterId === adapter.id
    && adapterClaim.adapterVersion === adapter.version
    && callerFacts.accountId === owner.accountId
    && adapterClaim.accountId === owner.accountId;
}

function credentialMatches(
  dryRun: ProviderAdapterDryRunHarnessMetadata,
  callerFacts: ProviderAdapterExecutionCallerFacts,
  adapterClaim: ProviderAdapterExecutionAdapterClaim,
): boolean {
  const credential = dryRun.credentialReference;
  if (!credential) return false;
  if (
    credential.providerId === undefined
    || credential.connectorId === undefined
    || credential.accountId === undefined
  ) {
    return false;
  }

  return callerFacts.credentialReferenceId === credential.id
    && adapterClaim.credentialReferenceId === credential.id
    && credential.providerId === dryRun.owner?.providerId
    && credential.connectorId === dryRun.owner?.connectorId
    && credential.accountId === dryRun.owner?.accountId;
}

function consentMatches(
  dryRun: ProviderAdapterDryRunHarnessMetadata,
  callerFacts: ProviderAdapterExecutionCallerFacts,
): boolean {
  return dryRun.consentGrantId !== undefined
    && callerFacts.consentGrantId === dryRun.consentGrantId;
}

function buildDecision(
  reason: ProviderAdapterExecutionBoundaryReason,
  dryRun?: ProviderAdapterDryRunHarnessMetadata,
  extraBlockReasons: ProviderAdapterExecutionBoundaryReason[] = [],
): Readonly<ProviderAdapterExecutionBoundaryDecision> {
  const accepted = reason === 'provider_adapter_execution_boundary_ready';
  const owner = dryRun?.owner
    ? trustedContractObject<NonNullable<ProviderAdapterExecutionBoundaryDecision['owner']>>([
        ['surface', safeIdentifier(dryRun.owner.surface) ?? 'redacted-unsafe-surface'],
        ['targetSurface', safeIdentifier(dryRun.owner.targetSurface) ?? 'redacted-unsafe-target-surface'],
        ['providerId', safeIdentifier(dryRun.owner.providerId) ?? 'redacted-unsafe-provider'],
        ['connectorId', safeIdentifier(dryRun.owner.connectorId) ?? 'redacted-unsafe-connector'],
        ['actionId', safeIdentifier(dryRun.owner.actionId) ?? 'redacted-unsafe-action'],
        ['accountId', safeIdentifier(dryRun.owner.accountId)],
      ])
    : undefined;
  const credentialReference = dryRun?.credentialReference
    ? trustedContractObject<NonNullable<ProviderAdapterExecutionBoundaryDecision['credentialReference']>>([
        ['id', safeIdentifier(dryRun.credentialReference.id) ?? 'redacted-unsafe-credential-reference'],
        ['kind', safeIdentifier(dryRun.credentialReference.kind)],
        ['storageOwner', safeIdentifier(dryRun.credentialReference.storageOwner)],
        ['providerId', safeIdentifier(dryRun.credentialReference.providerId)],
        ['connectorId', safeIdentifier(dryRun.credentialReference.connectorId)],
        ['accountId', safeIdentifier(dryRun.credentialReference.accountId)],
      ])
    : undefined;

  return trustedContractObject<ProviderAdapterExecutionBoundaryDecision>([
    ['status', accepted ? 'allow' : 'block'],
    ['allowed', accepted],
    ['reason', reason],
    ['blockReasons', accepted ? [] : [reason, ...extraBlockReasons]],
    ['dryRunId', safeIdentifier(dryRun?.dryRunId)],
    [
      'adapter',
      dryRun?.adapter
        ? trustedContractObject<NonNullable<ProviderAdapterExecutionBoundaryDecision['adapter']>>([
            ['id', safeIdentifier(dryRun.adapter.id) ?? 'redacted-unsafe-adapter'],
            ['version', safeIdentifier(dryRun.adapter.version) ?? 'redacted-unsafe-version'],
          ])
        : undefined,
    ],
    ['owner', owner],
    ['credentialReference', credentialReference],
    ['authAction', safeAuthAction(dryRun?.authAction)],
    ['consentGrantId', safeIdentifier(dryRun?.consentGrantId)],
    ['mayInvokeInjectedAdapter', false],
    ['adapterCalled', false],
    ['executable', false],
    ['willCallProvider', false],
    ['willResolveCredential', false],
    ['willOpenWindow', false],
    ['sideEffects', 'none'],
    ['sideEffectBoundary', EXECUTION_BOUNDARY],
  ]);
}

export function evaluateProviderAdapterExecutionBoundary(
  input: ProviderAdapterExecutionBoundaryInput = {},
): Readonly<ProviderAdapterExecutionBoundaryDecision> {
  if (!isTrustedRecord(input)) return buildDecision('input_shape_forbidden');
  if (objectHasUnsafeInputField(input, INPUT_KEYS)) {
    return buildDecision('unsafe_input_field');
  }
  if (!hasOnlyKeys(input, INPUT_KEYS)) return buildDecision('input_shape_forbidden');
  if (hasConnectorSecretMaterial(input)) return buildDecision('raw_secret_material');
  if (valueHasUnsafeInputField(input.payload)) return buildDecision('unsafe_input_field');

  const dryRun = input.dryRun as ProviderAdapterDryRunHarnessMetadata | undefined;
  if (!dryRun) return buildDecision('dry_run_missing');
  if (!isTrustedRecord(dryRun)) return buildDecision('dry_run_not_accepted');
  if (!dryRunShapeIsExact(dryRun)) return buildDecision('dry_run_boundary_invalid');
  if (dryRun.status !== 'accepted' || dryRun.accepted !== true) return buildDecision('dry_run_not_accepted', dryRun);
  if (!dryRun.owner || !dryRun.adapter || !dryRun.credentialReference) return buildDecision('dry_run_owner_missing', dryRun);
  if (!dryRunBoundaryIsValid(dryRun)) return buildDecision('dry_run_boundary_invalid', dryRun);

  const callerFacts = parseCallerFacts(input.callerFacts);
  if (!input.callerFacts) return buildDecision('caller_facts_missing', dryRun);
  if (!callerFacts) return buildDecision('caller_facts_invalid', dryRun);
  if (!callerFactsAreAcknowledged(callerFacts)) return buildDecision('caller_boundary_unacknowledged', dryRun);

  const adapterClaim = parseAdapterClaim(input.adapterClaim);
  if (!input.adapterClaim) return buildDecision('adapter_claim_missing', dryRun);
  if (!adapterClaim) return buildDecision('adapter_claim_invalid', dryRun);
  if (!adapterClaimBoundaryIsValid(adapterClaim)) return buildDecision('adapter_executable_claim_blocked', dryRun);

  if (!identifiersAreSafe(dryRun, callerFacts, adapterClaim)) return buildDecision('identifier_unsafe', dryRun);
  if (!ownershipMatches(dryRun, callerFacts, adapterClaim)) return buildDecision('owner_mismatch', dryRun);
  if (!credentialMatches(dryRun, callerFacts, adapterClaim)) return buildDecision('credential_reference_mismatch', dryRun);
  if (!consentMatches(dryRun, callerFacts)) return buildDecision('consent_mismatch', dryRun);
  if (!adapterClaim.supportedActionIds.includes(callerFacts.actionId)) {
    return buildDecision('adapter_action_unsupported', dryRun);
  }
  if (callerFacts.dryRunId !== undefined && dryRun.dryRunId !== callerFacts.dryRunId) {
    return buildDecision('owner_mismatch', dryRun);
  }
  if (callerFacts.authAction !== undefined && dryRun.authAction !== callerFacts.authAction) {
    return buildDecision('owner_mismatch', dryRun);
  }

  return buildDecision('provider_transport_execution_not_enabled', dryRun);
}
