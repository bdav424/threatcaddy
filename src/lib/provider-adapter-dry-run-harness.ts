import { hasConnectorSecretMaterial } from './connector-credential-boundary';
import type { ConnectorExplicitConsentDecision } from './connector-explicit-consent';
import type { ConnectorRuntimeAdapterSelectionDecision } from './connector-runtime-adapter-registry';
import type { ConnectorRuntimeCredentialSessionDecision } from './connector-runtime-credential-session';
import type { ProviderAuthSessionAdapterPlanDecision } from './provider-auth-session-adapter-plan';
import {
  createRuntimeTrustedContractObject,
  isRuntimeTrustedContractObject,
  type RuntimeTrustedContractEntry,
  type RuntimeTrustedContractObject,
} from './runtime-trusted-contract-object';

export type ProviderAdapterDryRunHarnessStatus = 'accepted' | 'blocked';

export type ProviderAdapterDryRunHarnessReason =
  | 'dry_run_harness_accepted'
  | 'input_shape_forbidden'
  | 'unsafe_input_field'
  | 'adapter_selection_missing'
  | 'adapter_selection_blocked'
  | 'credential_session_missing'
  | 'credential_session_blocked'
  | 'explicit_consent_missing'
  | 'explicit_consent_blocked'
  | 'auth_session_plan_missing'
  | 'auth_session_plan_blocked'
  | 'owner_mismatch'
  | 'boundary_not_inert'
  | 'identifier_unsafe'
  | 'raw_secret_material';

export interface ProviderAdapterDryRunHarnessInput {
  adapterSelection?: ConnectorRuntimeAdapterSelectionDecision | null;
  credentialSession?: ConnectorRuntimeCredentialSessionDecision | null;
  explicitConsent?: ConnectorExplicitConsentDecision | null;
  authSessionPlan?: ProviderAuthSessionAdapterPlanDecision | null;
  dryRunId?: string;
}

export interface ProviderAdapterDryRunHarnessMetadata {
  status: ProviderAdapterDryRunHarnessStatus;
  accepted: boolean;
  reason: ProviderAdapterDryRunHarnessReason;
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
    kind: string;
    storageOwner?: string;
    providerId?: string;
    connectorId?: string;
    accountId?: string;
  };
  authAction?: string;
  consentGrantId?: string;
  executable: false;
  willCallProvider: false;
  willResolveCredential: false;
  willOpenWindow: false;
  sideEffects: 'none';
  sideEffectBoundary: 'provider-adapter-dry-run-harness-no-fetch-no-socket-no-storage-no-provider-sdk-no-oauth-no-window-no-secret-resolution';
}

type TrustedProviderAdapterDryRunHarnessInput =
  ProviderAdapterDryRunHarnessInput & RuntimeTrustedContractObject;

function trustedContractObject<T>(entries: RuntimeTrustedContractEntry[]): RuntimeTrustedContractObject & Readonly<T> {
  return createRuntimeTrustedContractObject(entries) as RuntimeTrustedContractObject & Readonly<T>;
}

const SIDE_EFFECT_BOUNDARY =
  'provider-adapter-dry-run-harness-no-fetch-no-socket-no-storage-no-provider-sdk-no-oauth-no-window-no-secret-resolution' as const;

const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{1,179}$/;
const TOKEN_OR_URL_PATTERN =
  /(?:^(?!vault:)[a-z][a-z0-9+.-]*:[^/]|[a-z][a-z0-9+.-]*:\/\/|^(?:localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)(?::\d{2,5})?(?:\/|$)|^[a-z0-9.-]+\.[a-z]{2,}(?::\d{2,5})?\/\S+|(?:^|[/:@])hooks\.slack(?:-gov)?\.com\/services\/|(?:^|[/:@])(?:api|auth|oauth|login|graph|mail|smtp|imap|accounts|webhook|hooks)\.[a-z0-9.-]+\.[a-z]{2,}\/|xox[abprs]-|bearer\s+[a-z0-9._~+/=-]{8,}|(?:api|app|bot|client|refresh|access)[_-]?(?:key|token|secret)[=:]\s*\S+|-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----)/i;
const VAULT_CREDENTIAL_REFERENCE_PATTERN = /^vault:[A-Za-z0-9][A-Za-z0-9._:@/+~-]{1,179}$/;
const URL_LIKE_IDENTIFIER_PATTERNS = [
  /^[a-z][a-z0-9+.-]*:/i,
  /^\/\//,
  /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|\[?::1\]?)(?::\d+)?\//i,
  /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?\/\S+/,
] as const;

const INPUT_KEYS = new Set([
  'adapterSelection',
  'credentialSession',
  'explicitConsent',
  'authSessionPlan',
  'dryRunId',
]);

const UNSAFE_INPUT_FIELD_PATTERNS = [
  /adapter/i,
  /callback/i,
  /credential/i,
  /execute/i,
  /executable/i,
  /fetch/i,
  /httpclient/i,
  /indexeddb/i,
  /invoke/i,
  /liveaction/i,
  /liveexecution/i,
  /localstorage/i,
  /oauth/i,
  /onresult/i,
  /provider/i,
  /request/i,
  /requester/i,
  /response/i,
  /secret/i,
  /socket/i,
  /storage/i,
  /token/i,
  /transport/i,
  /websocket/i,
  /xhr/i,
] as const;

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function unsafeInputFieldName(key: string): boolean {
  const normalized = normalizedKey(key);
  return UNSAFE_INPUT_FIELD_PATTERNS.some((pattern) => pattern.test(normalized));
}

function objectHasUnsafeInputField(value: Record<string, unknown>, allowedKeys: ReadonlySet<string>): boolean {
  return Object.keys(value).some((key) => !allowedKeys.has(key) && unsafeInputFieldName(key));
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

function fail(
  reason: ProviderAdapterDryRunHarnessReason,
  input?: TrustedProviderAdapterDryRunHarnessInput,
): Readonly<ProviderAdapterDryRunHarnessMetadata> {
  return freezeMetadata(reason, input);
}

function adapterBoundaryIsInert(decision: ConnectorRuntimeAdapterSelectionDecision): boolean {
  return decision.status === 'selected'
    && decision.selected === true
    && decision.blockers.length === 0
    && decision.sideEffectBoundary === 'metadata-only-no-fetch-no-socket-no-storage-no-provider-sdk-no-provider-action'
    && decision.descriptor?.executable === false
    && decision.descriptor.sideEffectBoundary === 'metadata-only-no-fetch-no-socket-no-storage-no-provider-sdk-no-provider-action';
}

function credentialBoundaryIsInert(decision: ConnectorRuntimeCredentialSessionDecision): boolean {
  return decision.status === 'session-ready'
    && decision.mayUseCredentialHandle === true
    && decision.blockers.length === 0
    && decision.sideEffectBoundary === 'plan-only-no-fetch-no-indexeddb-no-localstorage-no-provider-api-no-secret-resolution'
    && decision.descriptor?.executable === false
    && decision.descriptor.sideEffects === 'none'
    && decision.descriptor.storageDirective === 'do-not-store-or-resolve-secret-material';
}

function consentBoundaryIsInert(decision: ConnectorExplicitConsentDecision): boolean {
  return decision.status === 'allow'
    && decision.allowed === true
    && decision.executable === false
    && decision.blockReasons.length === 0
    && decision.sideEffectBoundary === 'pure-local-consent-decision-no-fetch-no-storage-no-socket-no-oauth-no-provider-no-webhook-no-slack-no-llm';
}

function authPlanBoundaryIsInert(decision: ProviderAuthSessionAdapterPlanDecision): boolean {
  const capabilities = decision.adapterCapabilities;
  return decision.status === 'allow'
    && decision.executable === false
    && decision.sideEffects === 'none'
    && decision.blockReasons.length === 0
    && decision.sideEffectBoundary === 'pure-local-provider-auth-session-plan-no-fetch-no-storage-no-oauth-no-session-mutation-no-window-open'
    && capabilities !== undefined
    && capabilities.providerId === decision.providerId
    && capabilities.executable === false
    && capabilities.sideEffects === 'none'
    && capabilities.opensWindow === false
    && capabilities.browserRedirects === false;
}

function ownersMatch(input: ProviderAdapterDryRunHarnessInput): boolean {
  const adapter = input.adapterSelection?.descriptor;
  const session = input.credentialSession?.descriptor;
  const consent = input.explicitConsent;
  const auth = input.authSessionPlan;
  if (!adapter || !session || !consent || !auth) return false;

  const providerId = adapter.capability.providerId;
  const actionId = adapter.capability.actionId;
  const targetSurface = adapter.capability.surface;
  const credential = session.credentialHandle;
  return session.providerId === providerId
    && (credential.providerId === undefined || credential.providerId === providerId)
    && (credential.connectorId === undefined || credential.connectorId === session.connectorId)
    && (credential.accountId === undefined || session.accountId === undefined || credential.accountId === session.accountId)
    && session.action.actionId === actionId
    && session.action.targetSurface === targetSurface
    && consent.owner?.providerId === providerId
    && consent.owner?.connectorId === session.connectorId
    && (session.accountId === undefined || consent.owner?.accountId === session.accountId)
    && consent.owner?.credentialReferenceId === session.credentialHandle.id
    && consent.actionId === actionId
    && consent.targetSurface === targetSurface
    && auth.providerId === providerId
    && (auth.accountId === undefined || session.accountId === undefined || auth.accountId === session.accountId)
    && (auth.credentialReference?.providerId === undefined || auth.credentialReference.providerId === providerId)
    && (auth.credentialReference?.connectorId === undefined || auth.credentialReference.connectorId === session.connectorId)
    && (
      auth.credentialReference?.accountId === undefined
      || session.accountId === undefined
      || auth.credentialReference.accountId === session.accountId
    )
    && auth.credentialReference?.id === session.credentialHandle.id;
}

function identifiersAreSafe(input: ProviderAdapterDryRunHarnessInput): boolean {
  const adapter = input.adapterSelection?.descriptor;
  const session = input.credentialSession?.descriptor;
  const consent = input.explicitConsent;
  const auth = input.authSessionPlan;
  return ![
    input.dryRunId,
    adapter?.adapter.id,
    adapter?.adapter.version,
    adapter?.capability.providerId,
    adapter?.capability.actionId,
    adapter?.capability.surface,
    session?.providerId,
    session?.connectorId,
    session?.accountId,
    session?.credentialHandle.id,
    consent?.grantId,
    auth?.providerId,
    auth?.accountId,
  ].some(unsafeIdentifier);
}

function freezeMetadata(
  reason: ProviderAdapterDryRunHarnessReason,
  input?: TrustedProviderAdapterDryRunHarnessInput,
): Readonly<ProviderAdapterDryRunHarnessMetadata> {
  const adapter = input?.adapterSelection?.descriptor;
  const session = input?.credentialSession?.descriptor;
  const consent = input?.explicitConsent;
  const auth = input?.authSessionPlan;
  const credentialReference = session?.credentialHandle
    ? trustedContractObject<NonNullable<ProviderAdapterDryRunHarnessMetadata['credentialReference']>>([
        ['id', safeIdentifier(session.credentialHandle.id) ?? 'redacted-unsafe-credential-reference'],
        ['kind', safeIdentifier(session.credentialHandle.kind) ?? 'redacted-unsafe-kind'],
        ['storageOwner', safeIdentifier(session.credentialHandle.storageOwner)],
        ['providerId', safeIdentifier(session.credentialHandle.providerId)],
        ['connectorId', safeIdentifier(session.credentialHandle.connectorId)],
        ['accountId', safeIdentifier(session.credentialHandle.accountId)],
      ])
    : undefined;
  const owner = adapter && session
    ? trustedContractObject<NonNullable<ProviderAdapterDryRunHarnessMetadata['owner']>>([
        ['surface', safeIdentifier(adapter.capability.surface) ?? 'redacted-unsafe-surface'],
        ['targetSurface', safeIdentifier(session.action.targetSurface) ?? 'redacted-unsafe-target-surface'],
        ['providerId', safeIdentifier(adapter.capability.providerId) ?? 'redacted-unsafe-provider'],
        ['connectorId', safeIdentifier(session.connectorId) ?? 'redacted-unsafe-connector'],
        ['actionId', safeIdentifier(adapter.capability.actionId) ?? 'redacted-unsafe-action'],
        ['accountId', safeIdentifier(session.accountId)],
      ])
    : undefined;
  const entries: RuntimeTrustedContractEntry[] = [
    ['status', reason === 'dry_run_harness_accepted' ? 'accepted' : 'blocked'],
    ['accepted', reason === 'dry_run_harness_accepted'],
    ['reason', reason],
    ['dryRunId', safeIdentifier(input?.dryRunId)],
    [
      'adapter',
      adapter
        ? trustedContractObject<NonNullable<ProviderAdapterDryRunHarnessMetadata['adapter']>>([
            ['id', safeIdentifier(adapter.adapter.id) ?? 'redacted-unsafe-adapter'],
            ['version', safeIdentifier(adapter.adapter.version) ?? 'redacted-unsafe-version'],
          ])
        : undefined,
    ],
    ['owner', owner],
    ['credentialReference', credentialReference],
    ['authAction', auth?.action],
    ['consentGrantId', safeIdentifier(consent?.grantId)],
    ['executable', false],
    ['willCallProvider', false],
    ['willResolveCredential', false],
    ['willOpenWindow', false],
    ['sideEffects', 'none'],
    ['sideEffectBoundary', SIDE_EFFECT_BOUNDARY],
  ];

  return trustedContractObject<ProviderAdapterDryRunHarnessMetadata>(entries);
}

export function bindProviderAdapterDryRunHarness(
  input: ProviderAdapterDryRunHarnessInput = {},
): Readonly<ProviderAdapterDryRunHarnessMetadata> {
  if (!isRuntimeTrustedContractObject(input)) return fail('input_shape_forbidden');
  const trustedInput = input as TrustedProviderAdapterDryRunHarnessInput;

  if (objectHasUnsafeInputField(trustedInput, INPUT_KEYS)) return fail('unsafe_input_field', trustedInput);
  if (!hasOnlyKeys(trustedInput, INPUT_KEYS)) return fail('input_shape_forbidden', trustedInput);
  if (hasConnectorSecretMaterial(trustedInput)) return fail('raw_secret_material', trustedInput);
  if (!trustedInput.adapterSelection) return fail('adapter_selection_missing', trustedInput);
  if (!trustedInput.credentialSession) return fail('credential_session_missing', trustedInput);
  if (!trustedInput.explicitConsent) return fail('explicit_consent_missing', trustedInput);
  if (!trustedInput.authSessionPlan) return fail('auth_session_plan_missing', trustedInput);

  if (!isRuntimeTrustedContractObject(trustedInput.adapterSelection)) {
    return fail('adapter_selection_blocked', trustedInput);
  }
  if (!isRuntimeTrustedContractObject(trustedInput.credentialSession)) {
    return fail('credential_session_blocked', trustedInput);
  }
  if (!isRuntimeTrustedContractObject(trustedInput.explicitConsent)) {
    return fail('explicit_consent_blocked', trustedInput);
  }
  if (!isRuntimeTrustedContractObject(trustedInput.authSessionPlan)) {
    return fail('auth_session_plan_blocked', trustedInput);
  }

  if (trustedInput.adapterSelection.status !== 'selected' || !trustedInput.adapterSelection.selected) {
    return fail('adapter_selection_blocked', trustedInput);
  }
  if (
    trustedInput.credentialSession.status !== 'session-ready'
    || !trustedInput.credentialSession.mayUseCredentialHandle
  ) {
    return fail('credential_session_blocked', trustedInput);
  }
  if (trustedInput.explicitConsent.status !== 'allow' || !trustedInput.explicitConsent.allowed) {
    return fail('explicit_consent_blocked', trustedInput);
  }
  if (trustedInput.authSessionPlan.status !== 'allow') {
    return fail('auth_session_plan_blocked', trustedInput);
  }

  if (
    !adapterBoundaryIsInert(trustedInput.adapterSelection)
    || !credentialBoundaryIsInert(trustedInput.credentialSession)
    || !consentBoundaryIsInert(trustedInput.explicitConsent)
    || !authPlanBoundaryIsInert(trustedInput.authSessionPlan)
  ) {
    return fail('boundary_not_inert', trustedInput);
  }
  if (!ownersMatch(trustedInput)) return fail('owner_mismatch', trustedInput);
  if (!identifiersAreSafe(trustedInput)) return fail('identifier_unsafe', trustedInput);

  return freezeMetadata('dry_run_harness_accepted', trustedInput);
}
