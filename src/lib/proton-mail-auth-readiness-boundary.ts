import { isSecretLikeFieldName } from './connector-credential-boundary';

export type ProtonMailAuthReadinessBoundaryStatus = 'ready' | 'blocked';

export type ProtonMailAuthReadinessBoundaryReason =
  | 'proton_mail_auth_readiness_ready'
  | 'raw_secret_material'
  | 'runtime_shape_forbidden'
  | 'capability_fact_missing'
  | 'capability_fact_invalid'
  | 'capability_fact_unreviewed'
  | 'local_bridge_fact_missing'
  | 'local_bridge_fact_invalid'
  | 'local_bridge_fact_unreviewed'
  | 'manual_setup_evidence_missing'
  | 'manual_setup_evidence_invalid'
  | 'manual_setup_evidence_unreviewed'
  | 'oauth_parity_claim_forbidden'
  | 'provider_identity_mismatch';

export type ProtonMailCapabilityMode =
  | 'reviewed-proton-bridge'
  | 'reviewed-manual-local-bridge';

export type ProtonMailAuthModel = 'bridge-assisted' | 'manual-local-bridge';

export type ProtonMailLocalBridgeKind = 'proton-bridge-app' | 'manual-local-proxy';

export interface ProtonMailAuthCapabilityFact {
  contract: 'proton-mail-auth-capability-fact-v1';
  providerId: 'proton-bridge';
  providerFamily: 'proton';
  readinessOwner: 'proton-mail-auth-readiness-boundary';
  capabilityMode: ProtonMailCapabilityMode;
  reviewState: 'reviewed';
  authModel: ProtonMailAuthModel;
  setupMode: 'requires-reviewed-local-bridge-prerequisites';
  webLoginParity: false;
  credentialsManagedOutsideThreatCaddy: true;
  localBridgeReferenceOnly: true;
  notesReviewed: true;
}

export interface ProtonMailLocalBridgeFact {
  contract: 'proton-mail-local-bridge-fact-v1';
  providerId: 'proton-bridge';
  capabilityMode: ProtonMailCapabilityMode;
  reviewState: 'reviewed';
  localBridgeKind: ProtonMailLocalBridgeKind;
  bridgeManagedOutsideThreatCaddy: true;
  loopbackOnly: true;
  localBridgeReferenceOnly: true;
  secretMaterialStoredOutsideThreatCaddy: true;
  manualSetupEvidenceId: string;
}

export interface ProtonMailManualSetupEvidence {
  contract: 'proton-mail-manual-setup-evidence-v1';
  providerId: 'proton-bridge';
  capabilityMode: ProtonMailCapabilityMode;
  reviewState: 'reviewed';
  evidenceProfile: 'reviewed-proton-bridge-prerequisites' | 'reviewed-manual-local-bridge-prerequisites';
  localCredentialsManagedOutsideThreatCaddy: true;
  localBridgeReferenceReviewed: true;
  manualAnalystConfirmation: true;
  oauthParityRejected: true;
  noBrowserCredentialEntry: true;
  noProviderExecutionClaim: true;
  evidenceId: string;
}

export interface ProtonMailAuthReadinessPlan {
  contract: 'proton-mail-auth-readiness-plan-v1';
  providerId: 'proton-bridge';
  providerFamily: 'proton';
  readinessOwner: 'proton-mail-auth-readiness-boundary';
  capabilityMode: ProtonMailCapabilityMode;
  authModel: ProtonMailAuthModel;
  setupMode: 'requires-reviewed-local-bridge-prerequisites';
  localBridgeKind: ProtonMailLocalBridgeKind;
  localBridgeReferenceOnly: true;
  credentialsManagedOutsideThreatCaddy: true;
  webLoginParity: false;
  manualSetupEvidenceId: string;
  manualSetupEvidenceProfile: ProtonMailManualSetupEvidence['evidenceProfile'];
  reviewedCapabilityMode: true;
  executable: false;
  sideEffects: 'none';
  sideEffectBoundary: 'metadata-only-no-fetch-no-socket-no-storage-no-provider-no-credentials';
}

export interface ProtonMailAuthReadinessBoundaryInput {
  capabilityFact?: unknown;
  localBridgeFact?: unknown;
  manualSetupEvidence?: unknown;
}

export interface ProtonMailAuthReadinessBoundaryDecision {
  status: ProtonMailAuthReadinessBoundaryStatus;
  ready: boolean;
  reason: ProtonMailAuthReadinessBoundaryReason;
  plan?: ProtonMailAuthReadinessPlan;
  canPrepareFutureProtonMailReadinessPlan: boolean;
  executable: false;
  sideEffects: 'none';
  willFetch: false;
  willOpenSocket: false;
  willMutateStorage: false;
  willCollectCredential: false;
  willCallProvider: false;
  willProbeBridge: false;
  webLoginParity: false;
  sideEffectBoundary: 'proton-mail-auth-readiness-boundary-metadata-only-no-fetch-no-socket-no-storage-no-provider-no-credentials';
}

const FACT_BOUNDARY = 'metadata-only-no-fetch-no-socket-no-storage-no-provider-no-credentials' as const;
const DECISION_BOUNDARY =
  'proton-mail-auth-readiness-boundary-metadata-only-no-fetch-no-socket-no-storage-no-provider-no-credentials' as const;
const MAX_IDENTIFIER_LENGTH = 180;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,179}$/;
const TOKEN_VALUE_PATTERNS = [
  /^xox[a-z0-9]*-[a-z0-9-]{8,}$/i,
  /^gh[pousr]_[a-z0-9_]{8,}$/i,
  /^github_pat_[a-z0-9_]{8,}$/i,
  /^(?:AKIA|ASIA)[a-z0-9]{8,}$/i,
  /^(?:sk|pk|rk)-[a-z0-9_-]{8,}$/i,
  /^eyj[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}$/i,
  /bearer\s+[a-z0-9._~+/=-]{8,}/i,
  /basic\s+[a-z0-9._~+/=-]{8,}/i,
  /(?:api|app|bot|client|refresh|access|session|id)[_-]?(?:key|token|secret)\s*[:=]\s*\S+/i,
  /(?:auth|oauth|authorization)[\s_-]?(?:code|token)\s*[:=]\s*\S+/i,
  /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/i,
] as const;
const SECRET_FIELD_MARKERS = [
  'accesstoken',
  'authcode',
  'authorization',
  'bearer',
  'bridgepassword',
  'clientsecret',
  'idtoken',
  'mailboxpassword',
  'password',
  'refreshtoken',
  'secret',
  'session',
  'token',
  'apppassword',
] as const;
const FORBIDDEN_RUNTIME_FIELD_MARKERS = [
  'callback',
  'execute',
  'executable',
  'eventsource',
  'fetch',
  'indexeddb',
  'liveaction',
  'livecall',
  'liveexecution',
  'localstorage',
  'probe',
  'requester',
  'socket',
  'storage',
  'websocket',
] as const;
const ROOT_KEYS = new Set(['capabilityFact', 'localBridgeFact', 'manualSetupEvidence']);
const CAPABILITY_FACT_KEYS = new Set([
  'authModel',
  'capabilityMode',
  'contract',
  'credentialsManagedOutsideThreatCaddy',
  'localBridgeReferenceOnly',
  'notesReviewed',
  'providerFamily',
  'providerId',
  'readinessOwner',
  'reviewState',
  'setupMode',
  'webLoginParity',
]);
const LOCAL_BRIDGE_FACT_KEYS = new Set([
  'bridgeManagedOutsideThreatCaddy',
  'capabilityMode',
  'contract',
  'localBridgeKind',
  'localBridgeReferenceOnly',
  'loopbackOnly',
  'manualSetupEvidenceId',
  'providerId',
  'reviewState',
  'secretMaterialStoredOutsideThreatCaddy',
]);
const MANUAL_SETUP_EVIDENCE_KEYS = new Set([
  'capabilityMode',
  'contract',
  'evidenceId',
  'evidenceProfile',
  'localBridgeReferenceReviewed',
  'localCredentialsManagedOutsideThreatCaddy',
  'manualAnalystConfirmation',
  'noBrowserCredentialEntry',
  'noProviderExecutionClaim',
  'oauthParityRejected',
  'providerId',
  'reviewState',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function stringLooksSecretBearing(value: string): boolean {
  return TOKEN_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function safeIdentifier(value: unknown): string | undefined {
  const normalized = normalizedString(value);
  if (!normalized) return undefined;
  if (
    normalized.length > MAX_IDENTIFIER_LENGTH
    || !SAFE_ID_PATTERN.test(normalized)
    || isSecretLikeFieldName(normalized)
    || stringLooksSecretBearing(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function normalizeMarker(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function valueHasSecretLikeMaterial(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'string') return stringLooksSecretBearing(value);
  if (value === null || value === undefined) return false;
  if (typeof value === 'function') return true;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) return value.some((item) => valueHasSecretLikeMaterial(item, seen));
  if (value instanceof Map) {
    for (const [key, nestedValue] of value.entries()) {
      if (valueHasSecretLikeMaterial(key, seen) || valueHasSecretLikeMaterial(nestedValue, seen)) return true;
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nestedValue of value.values()) {
      if (valueHasSecretLikeMaterial(nestedValue, seen)) return true;
    }
    return false;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (valueHasSecretLikeMaterial(key, seen) || valueHasSecretLikeMaterial(nestedValue, seen)) return true;
  }
  return false;
}

function hasUnexpectedSecretLikeFieldNames(input: ProtonMailAuthReadinessBoundaryInput): boolean {
  const rootHasUnexpectedSecretKey = Object.keys(input).some((key) => (
    !ROOT_KEYS.has(key) && SECRET_FIELD_MARKERS.some((marker) => normalizeMarker(key).includes(marker))
  ));
  if (rootHasUnexpectedSecretKey) return true;

  const nestedChecks: Array<[unknown, ReadonlySet<string>]> = [
    [input.capabilityFact, CAPABILITY_FACT_KEYS],
    [input.localBridgeFact, LOCAL_BRIDGE_FACT_KEYS],
    [input.manualSetupEvidence, MANUAL_SETUP_EVIDENCE_KEYS],
  ];

  return nestedChecks.some(([value, allowed]) => (
    isRecord(value)
    && Object.keys(value).some((key) => (
      !allowed.has(key) && SECRET_FIELD_MARKERS.some((marker) => normalizeMarker(key).includes(marker))
    ))
  ));
}

function hasForbiddenRuntimeFields(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'function') return true;
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) return value.some((item) => hasForbiddenRuntimeFields(item, seen));
  if (value instanceof Map) {
    for (const [key, nestedValue] of value.entries()) {
      if (typeof key === 'string' && FORBIDDEN_RUNTIME_FIELD_MARKERS.some((marker) => normalizeMarker(key).includes(marker))) {
        return true;
      }
      if (hasForbiddenRuntimeFields(nestedValue, seen)) return true;
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nestedValue of value.values()) {
      if (hasForbiddenRuntimeFields(nestedValue, seen)) return true;
    }
    return false;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = normalizeMarker(key);
    if (FORBIDDEN_RUNTIME_FIELD_MARKERS.some((marker) => normalizedKey.includes(marker))) return true;
    if (hasForbiddenRuntimeFields(nestedValue, seen)) return true;
  }
  return false;
}

function safeCapabilityMode(value: unknown): ProtonMailCapabilityMode | undefined {
  return value === 'reviewed-proton-bridge' || value === 'reviewed-manual-local-bridge'
    ? value
    : undefined;
}

function safeAuthModel(value: unknown): ProtonMailAuthModel | undefined {
  return value === 'bridge-assisted' || value === 'manual-local-bridge'
    ? value
    : undefined;
}

function safeLocalBridgeKind(value: unknown): ProtonMailLocalBridgeKind | undefined {
  return value === 'proton-bridge-app' || value === 'manual-local-proxy'
    ? value
    : undefined;
}

function expectedAuthModel(mode: ProtonMailCapabilityMode): ProtonMailAuthModel {
  return mode === 'reviewed-proton-bridge' ? 'bridge-assisted' : 'manual-local-bridge';
}

function expectedBridgeKind(mode: ProtonMailCapabilityMode): ProtonMailLocalBridgeKind {
  return mode === 'reviewed-proton-bridge' ? 'proton-bridge-app' : 'manual-local-proxy';
}

function expectedEvidenceProfile(
  mode: ProtonMailCapabilityMode,
): ProtonMailManualSetupEvidence['evidenceProfile'] {
  return mode === 'reviewed-proton-bridge'
    ? 'reviewed-proton-bridge-prerequisites'
    : 'reviewed-manual-local-bridge-prerequisites';
}

function parseCapabilityFact(
  value: unknown,
): { ok: true; value: ProtonMailAuthCapabilityFact } | { ok: false; reason: ProtonMailAuthReadinessBoundaryReason } {
  if (!isRecord(value) || !hasOnlyKeys(value, CAPABILITY_FACT_KEYS)) {
    return { ok: false, reason: 'capability_fact_invalid' };
  }
  const capabilityMode = safeCapabilityMode(value.capabilityMode);
  const authModel = safeAuthModel(value.authModel);
  if (
    value.contract !== 'proton-mail-auth-capability-fact-v1'
    || value.providerId !== 'proton-bridge'
    || value.providerFamily !== 'proton'
    || value.readinessOwner !== 'proton-mail-auth-readiness-boundary'
    || !capabilityMode
    || !authModel
  ) {
    return { ok: false, reason: 'capability_fact_invalid' };
  }
  if (value.reviewState !== 'reviewed') return { ok: false, reason: 'capability_fact_unreviewed' };
  if (
    value.setupMode !== 'requires-reviewed-local-bridge-prerequisites'
    || value.webLoginParity !== false
  ) {
    return { ok: false, reason: 'oauth_parity_claim_forbidden' };
  }
  if (
    authModel !== expectedAuthModel(capabilityMode)
    || value.credentialsManagedOutsideThreatCaddy !== true
    || value.localBridgeReferenceOnly !== true
    || value.notesReviewed !== true
  ) {
    return { ok: false, reason: 'capability_fact_invalid' };
  }

  return {
    ok: true,
    value: Object.freeze({
      contract: 'proton-mail-auth-capability-fact-v1',
      providerId: 'proton-bridge',
      providerFamily: 'proton',
      readinessOwner: 'proton-mail-auth-readiness-boundary',
      capabilityMode,
      reviewState: 'reviewed',
      authModel,
      setupMode: 'requires-reviewed-local-bridge-prerequisites',
      webLoginParity: false,
      credentialsManagedOutsideThreatCaddy: true,
      localBridgeReferenceOnly: true,
      notesReviewed: true,
    }),
  };
}

function parseLocalBridgeFact(
  value: unknown,
): { ok: true; value: ProtonMailLocalBridgeFact } | { ok: false; reason: ProtonMailAuthReadinessBoundaryReason } {
  if (!isRecord(value) || !hasOnlyKeys(value, LOCAL_BRIDGE_FACT_KEYS)) {
    return { ok: false, reason: 'local_bridge_fact_invalid' };
  }
  const capabilityMode = safeCapabilityMode(value.capabilityMode);
  const localBridgeKind = safeLocalBridgeKind(value.localBridgeKind);
  const manualSetupEvidenceId = safeIdentifier(value.manualSetupEvidenceId);
  if (
    value.contract !== 'proton-mail-local-bridge-fact-v1'
    || value.providerId !== 'proton-bridge'
    || !capabilityMode
    || !localBridgeKind
    || !manualSetupEvidenceId
  ) {
    return { ok: false, reason: 'local_bridge_fact_invalid' };
  }
  if (value.reviewState !== 'reviewed') return { ok: false, reason: 'local_bridge_fact_unreviewed' };
  if (
    localBridgeKind !== expectedBridgeKind(capabilityMode)
    || value.bridgeManagedOutsideThreatCaddy !== true
    || value.loopbackOnly !== true
    || value.localBridgeReferenceOnly !== true
    || value.secretMaterialStoredOutsideThreatCaddy !== true
  ) {
    return { ok: false, reason: 'local_bridge_fact_invalid' };
  }

  return {
    ok: true,
    value: Object.freeze({
      contract: 'proton-mail-local-bridge-fact-v1',
      providerId: 'proton-bridge',
      capabilityMode,
      reviewState: 'reviewed',
      localBridgeKind,
      bridgeManagedOutsideThreatCaddy: true,
      loopbackOnly: true,
      localBridgeReferenceOnly: true,
      secretMaterialStoredOutsideThreatCaddy: true,
      manualSetupEvidenceId,
    }),
  };
}

function parseManualSetupEvidence(
  value: unknown,
): { ok: true; value: ProtonMailManualSetupEvidence } | { ok: false; reason: ProtonMailAuthReadinessBoundaryReason } {
  if (!isRecord(value) || !hasOnlyKeys(value, MANUAL_SETUP_EVIDENCE_KEYS)) {
    return { ok: false, reason: 'manual_setup_evidence_invalid' };
  }
  const capabilityMode = safeCapabilityMode(value.capabilityMode);
  const evidenceId = safeIdentifier(value.evidenceId);
  const evidenceProfile = value.evidenceProfile === 'reviewed-proton-bridge-prerequisites'
    || value.evidenceProfile === 'reviewed-manual-local-bridge-prerequisites'
    ? value.evidenceProfile
    : undefined;
  if (
    value.contract !== 'proton-mail-manual-setup-evidence-v1'
    || value.providerId !== 'proton-bridge'
    || !capabilityMode
    || !evidenceProfile
    || !evidenceId
  ) {
    return { ok: false, reason: 'manual_setup_evidence_invalid' };
  }
  if (value.reviewState !== 'reviewed') return { ok: false, reason: 'manual_setup_evidence_unreviewed' };
  if (
    evidenceProfile !== expectedEvidenceProfile(capabilityMode)
    || value.localCredentialsManagedOutsideThreatCaddy !== true
    || value.localBridgeReferenceReviewed !== true
    || value.manualAnalystConfirmation !== true
    || value.oauthParityRejected !== true
    || value.noBrowserCredentialEntry !== true
    || value.noProviderExecutionClaim !== true
  ) {
    return value.oauthParityRejected !== true
      ? { ok: false, reason: 'oauth_parity_claim_forbidden' }
      : { ok: false, reason: 'manual_setup_evidence_invalid' };
  }

  return {
    ok: true,
    value: Object.freeze({
      contract: 'proton-mail-manual-setup-evidence-v1',
      providerId: 'proton-bridge',
      capabilityMode,
      reviewState: 'reviewed',
      evidenceProfile,
      localCredentialsManagedOutsideThreatCaddy: true,
      localBridgeReferenceReviewed: true,
      manualAnalystConfirmation: true,
      oauthParityRejected: true,
      noBrowserCredentialEntry: true,
      noProviderExecutionClaim: true,
      evidenceId,
    }),
  };
}

function freezeDecision(
  reason: ProtonMailAuthReadinessBoundaryReason,
  plan?: ProtonMailAuthReadinessPlan,
): Readonly<ProtonMailAuthReadinessBoundaryDecision> {
  const ready = reason === 'proton_mail_auth_readiness_ready' && plan !== undefined;
  return Object.freeze({
    status: ready ? 'ready' : 'blocked',
    ready,
    reason,
    ...(plan ? { plan: Object.freeze(plan) } : {}),
    canPrepareFutureProtonMailReadinessPlan: ready,
    executable: false,
    sideEffects: 'none',
    willFetch: false,
    willOpenSocket: false,
    willMutateStorage: false,
    willCollectCredential: false,
    willCallProvider: false,
    willProbeBridge: false,
    webLoginParity: false,
    sideEffectBoundary: DECISION_BOUNDARY,
  });
}

export function evaluateProtonMailAuthReadinessBoundary(
  input: ProtonMailAuthReadinessBoundaryInput = {},
): Readonly<ProtonMailAuthReadinessBoundaryDecision> {
  if (!isRecord(input) || !hasOnlyKeys(input, ROOT_KEYS) || hasForbiddenRuntimeFields(input)) {
    return freezeDecision('runtime_shape_forbidden');
  }
  if (valueHasSecretLikeMaterial(input) || hasUnexpectedSecretLikeFieldNames(input)) {
    return freezeDecision('raw_secret_material');
  }
  if (!input.capabilityFact) return freezeDecision('capability_fact_missing');
  if (!input.localBridgeFact) return freezeDecision('local_bridge_fact_missing');
  if (!input.manualSetupEvidence) return freezeDecision('manual_setup_evidence_missing');

  const capability = parseCapabilityFact(input.capabilityFact);
  if (!capability.ok) return freezeDecision(capability.reason);
  const localBridge = parseLocalBridgeFact(input.localBridgeFact);
  if (!localBridge.ok) return freezeDecision(localBridge.reason);
  const manualEvidence = parseManualSetupEvidence(input.manualSetupEvidence);
  if (!manualEvidence.ok) return freezeDecision(manualEvidence.reason);

  if (
    capability.value.providerId !== localBridge.value.providerId
    || capability.value.providerId !== manualEvidence.value.providerId
    || capability.value.capabilityMode !== localBridge.value.capabilityMode
    || capability.value.capabilityMode !== manualEvidence.value.capabilityMode
    || localBridge.value.manualSetupEvidenceId !== manualEvidence.value.evidenceId
  ) {
    return freezeDecision('provider_identity_mismatch');
  }

  return freezeDecision('proton_mail_auth_readiness_ready', Object.freeze({
    contract: 'proton-mail-auth-readiness-plan-v1',
    providerId: 'proton-bridge',
    providerFamily: 'proton',
    readinessOwner: 'proton-mail-auth-readiness-boundary',
    capabilityMode: capability.value.capabilityMode,
    authModel: capability.value.authModel,
    setupMode: 'requires-reviewed-local-bridge-prerequisites',
    localBridgeKind: localBridge.value.localBridgeKind,
    localBridgeReferenceOnly: true,
    credentialsManagedOutsideThreatCaddy: true,
    webLoginParity: false,
    manualSetupEvidenceId: manualEvidence.value.evidenceId,
    manualSetupEvidenceProfile: manualEvidence.value.evidenceProfile,
    reviewedCapabilityMode: true,
    executable: false,
    sideEffects: 'none',
    sideEffectBoundary: FACT_BOUNDARY,
  }));
}
