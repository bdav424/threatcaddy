import type { ConnectorRuntimeAdapterSelectionDecision } from './connector-runtime-adapter-registry';
import type { ConnectorRuntimePersistenceGuardDecision } from './connector-runtime-persistence-guard';
import type { LocalBridgeProbeExecutionDecision } from './local-bridge-probe-execution-gate';
import type { MessagingDeliveryAdapterPlan } from './messaging-delivery-adapter-plan';
import type { ProviderAuthSessionAdapterPlanDecision } from './provider-auth-session-adapter-plan';

export type ConnectorRuntimeUiOwnerSurface = 'emailcaddy' | 'assistantcaddy' | 'messaging' | 'integrations';
export type ConnectorRuntimeUiWiringRowStatus = 'ready' | 'blocked';
export type ConnectorRuntimeUiWiringRowKind =
  | 'catalog-support'
  | 'configuration'
  | 'runtime-readiness'
  | 'persistence';

export type ConnectorRuntimeUiWiringRowId =
  | 'provider-adapter-selection'
  | 'provider-auth-session-plan'
  | 'messaging-delivery-dry-run'
  | 'local-bridge-manual-probe'
  | 'connector-runtime-persistence';

export interface ConnectorRuntimeUiWiringPlanInput {
  expectedOwnerSurface?: ConnectorRuntimeUiOwnerSurface;
  providerAdapterDecision?: ConnectorRuntimeAdapterSelectionDecision | null;
  messagingAdapterPlan?: MessagingDeliveryAdapterPlan | null;
  localBridgeProbeDecision?: LocalBridgeProbeExecutionDecision | null;
  providerAuthSessionPlan?: ProviderAuthSessionAdapterPlanDecision | null;
  persistenceGuardDecision?: ConnectorRuntimePersistenceGuardDecision | null;
}

export interface ConnectorRuntimeUiWiringStatusRow {
  id: ConnectorRuntimeUiWiringRowId;
  label: string;
  kind: ConnectorRuntimeUiWiringRowKind;
  ownerSurface: ConnectorRuntimeUiOwnerSurface;
  status: ConnectorRuntimeUiWiringRowStatus;
  reason: string;
  providerId?: string;
  connectorKind?: string;
  executable: false;
  sideEffects: 'none';
}

export interface ConnectorRuntimeUiWiringPlan {
  schemaVersion: 1;
  contract: 'connector-runtime-ui-wiring-plan-v1';
  rows: readonly ConnectorRuntimeUiWiringStatusRow[];
  executable: false;
  sideEffects: 'none';
  sideEffectBoundary: 'pure-local-ui-presentation-model-no-fetch-no-storage-no-provider-no-credentials-no-runtime-actions';
}

const SIDE_EFFECT_BOUNDARY =
  'pure-local-ui-presentation-model-no-fetch-no-storage-no-provider-no-credentials-no-runtime-actions' as const;

const TOKEN_SHAPED_IDENTIFIER_PATTERNS = [
  /^xox[a-z0-9]*-[a-z0-9-]{8,}$/i,
  /^ghp_[a-z0-9_]{8,}$/i,
  /^github_pat_[a-z0-9_]{8,}$/i,
  /^(?:AKIA|ASIA)[a-z0-9]{8,}$/i,
  /^sk-[a-z0-9_-]{8,}$/i,
  /^ya29\.[a-z0-9._-]{8,}$/i,
  /^eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/,
  /bearer\s+[a-z0-9._~+/=-]{8,}/i,
  /(?:api|app|client|refresh|access)[_-]?(?:key|token|secret)\s*[:=]\s*\S+/i,
  /(?:oauth|authorization)[\s_-]?code\s*[:=]\s*\S+/i,
  /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
] as const;

const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9._:@/+~-]{1,180}$/;
const SECRET_FIELD_NAME_PATTERN = /^(?:apiKey|api_key|token|accessToken|access_token|refreshToken|refresh_token|secret|clientSecret|client_secret|password|authorization|oauthCode|oauth_code)$/i;
const UNSAFE_RUNTIME_EXACT_KEYS = new Set([
  'callback',
  'callbacks',
  'eventsource',
  'execute',
  'executor',
  'fetch',
  'fetcher',
  'fetchplan',
  'httpclient',
  'indexeddb',
  'invoke',
  'invoker',
  'liveaction',
  'liveactions',
  'onresult',
  'requester',
  'requestercallback',
  'send',
  'sender',
  'socket',
  'socketplan',
  'storage',
  'storageadapter',
  'webhookclient',
  'websocket',
  'xmlhttprequest',
  'xhr',
]);

function looksTokenShaped(value: string): boolean {
  return TOKEN_SHAPED_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(value));
}

function safeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!SAFE_IDENTIFIER_PATTERN.test(trimmed)) return undefined;
  if (looksTokenShaped(trimmed)) return undefined;
  return trimmed;
}

function hasRawSecretMaterial(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'string') return looksTokenShaped(value);
  if (typeof value !== 'object' || value === null) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => hasRawSecretMaterial(item, seen));

  return Object.entries(value as Record<string, unknown>).some(([key, entry]) => {
    if (SECRET_FIELD_NAME_PATTERN.test(key) && typeof entry === 'string' && entry.trim()) return true;
    return hasRawSecretMaterial(entry, seen);
  });
}

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function keyHasUnsafeRuntimeMarker(key: string): boolean {
  const normalized = normalizedKey(key);
  return UNSAFE_RUNTIME_EXACT_KEYS.has(normalized)
    || normalized.endsWith('callback')
    || normalized.endsWith('requester')
    || normalized.endsWith('client');
}

function hasUnsafeRuntimeShape(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'function') return true;
  if (typeof value !== 'object' || value === null) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => hasUnsafeRuntimeShape(item, seen));

  return Object.entries(value as Record<string, unknown>).some(([key, entry]) => (
    keyHasUnsafeRuntimeMarker(key) || hasUnsafeRuntimeShape(entry, seen)
  ));
}

function ownerSurfaceFromAdapter(
  decision: ConnectorRuntimeAdapterSelectionDecision | null | undefined,
): ConnectorRuntimeUiOwnerSurface {
  const surface = decision?.descriptor?.capability.surface;
  if (surface === 'email') return 'emailcaddy';
  if (surface === 'assistant') return 'assistantcaddy';
  if (surface === 'messaging') return 'messaging';
  return 'integrations';
}

function ownerSurfaceFromAuth(
  decision: ProviderAuthSessionAdapterPlanDecision | null | undefined,
): ConnectorRuntimeUiOwnerSurface {
  if (decision?.surface === 'emailcaddy') return 'emailcaddy';
  if (decision?.surface === 'assistantcaddy') return 'assistantcaddy';
  return 'integrations';
}

function ownerSurfaceFromPersistence(
  decision: ConnectorRuntimePersistenceGuardDecision | null | undefined,
): ConnectorRuntimeUiOwnerSurface {
  const targetSurface = decision?.metadata.targetSurface;
  if (targetSurface === 'emailcaddy' || targetSurface === 'email') return 'emailcaddy';
  if (targetSurface === 'assistantcaddy' || targetSurface === 'assistant') return 'assistantcaddy';
  if (targetSurface === 'messaging') return 'messaging';
  return 'integrations';
}

function ownerMismatch(
  ownerSurface: ConnectorRuntimeUiOwnerSurface,
  expectedOwnerSurface?: ConnectorRuntimeUiOwnerSurface,
): boolean {
  return expectedOwnerSurface !== undefined && expectedOwnerSurface !== ownerSurface;
}

function frozenRow(row: ConnectorRuntimeUiWiringStatusRow): ConnectorRuntimeUiWiringStatusRow {
  return Object.freeze(row);
}

function blockedRow(
  id: ConnectorRuntimeUiWiringRowId,
  label: string,
  kind: ConnectorRuntimeUiWiringRowKind,
  ownerSurface: ConnectorRuntimeUiOwnerSurface,
  reason: string,
): ConnectorRuntimeUiWiringStatusRow {
  return frozenRow({
    id,
    label,
    kind,
    ownerSurface,
    status: 'blocked',
    reason,
    executable: false,
    sideEffects: 'none',
  });
}

function readyRow(
  id: ConnectorRuntimeUiWiringRowId,
  label: string,
  kind: ConnectorRuntimeUiWiringRowKind,
  ownerSurface: ConnectorRuntimeUiOwnerSurface,
  reason: string,
  safeFacts: Pick<ConnectorRuntimeUiWiringStatusRow, 'providerId' | 'connectorKind'> = {},
): ConnectorRuntimeUiWiringStatusRow {
  return frozenRow({
    id,
    label,
    kind,
    ownerSurface,
    status: 'ready',
    reason,
    ...safeFacts,
    executable: false,
    sideEffects: 'none',
  });
}

function unsafeExecutableClaim(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.executable === true
    || record.sideEffects !== undefined && record.sideEffects !== 'none'
    || record.willPostMessage === true
    || record.willCallWebhook === true
    || record.willStoreCredential === true
    || record.executesProviderCall === true
    || record.mayPersistRuntimeState === true
    || record.mayCreateDexieSchema === true
    || record.mayBackupOrExportRuntimeState === true
    || record.mayImportOrRestoreRuntimeState === true
    || record.maySyncRuntimeState === true;
}

function providerAdapterRow(input: ConnectorRuntimeUiWiringPlanInput): ConnectorRuntimeUiWiringStatusRow {
  const decision = input.providerAdapterDecision;
  const ownerSurface = ownerSurfaceFromAdapter(decision);
  if (!decision) {
    return blockedRow('provider-adapter-selection', 'Provider adapter support', 'catalog-support', ownerSurface, 'Provider adapter selection decision is missing.');
  }
  if (hasRawSecretMaterial(decision) || unsafeExecutableClaim(decision) || hasUnsafeRuntimeShape(decision)) {
    return blockedRow('provider-adapter-selection', 'Provider adapter support', 'catalog-support', ownerSurface, 'Provider adapter decision was redacted because it included secret material, executable claims, or live runtime metadata.');
  }
  if (ownerMismatch(ownerSurface, input.expectedOwnerSurface)) {
    return blockedRow('provider-adapter-selection', 'Provider adapter support', 'catalog-support', ownerSurface, 'Provider adapter owner surface does not match the requested UI surface.');
  }
  if (decision.status !== 'selected' || decision.selected !== true || !decision.descriptor) {
    return blockedRow('provider-adapter-selection', 'Provider adapter support', 'catalog-support', ownerSurface, decision.blockers.map((blocker) => blocker.code).join(', ') || 'Provider adapter selection is blocked.');
  }
  const providerId = safeIdentifier(decision.descriptor.capability.providerId);
  if (!providerId) {
    return blockedRow('provider-adapter-selection', 'Provider adapter support', 'catalog-support', ownerSurface, 'Provider adapter identifier was redacted because it looked unsafe.');
  }
  return readyRow('provider-adapter-selection', 'Provider adapter support', 'catalog-support', ownerSurface, 'Reviewed adapter metadata is available; this is support metadata only.', { providerId });
}

function authSessionRow(input: ConnectorRuntimeUiWiringPlanInput): ConnectorRuntimeUiWiringStatusRow {
  const decision = input.providerAuthSessionPlan;
  const ownerSurface = ownerSurfaceFromAuth(decision);
  if (!decision) {
    return blockedRow('provider-auth-session-plan', 'Provider auth/session setup', 'configuration', ownerSurface, 'Provider auth/session adapter plan is missing.');
  }
  if (hasRawSecretMaterial(decision) || unsafeExecutableClaim(decision) || hasUnsafeRuntimeShape(decision)) {
    return blockedRow('provider-auth-session-plan', 'Provider auth/session setup', 'configuration', ownerSurface, 'Provider auth/session plan was redacted because it included secret material, executable claims, or live runtime metadata.');
  }
  if (ownerMismatch(ownerSurface, input.expectedOwnerSurface)) {
    return blockedRow('provider-auth-session-plan', 'Provider auth/session setup', 'configuration', ownerSurface, 'Provider auth/session owner surface does not match the requested UI surface.');
  }
  const providerId = safeIdentifier(decision.providerId);
  if (decision.providerId !== undefined && !providerId) {
    return blockedRow('provider-auth-session-plan', 'Provider auth/session setup', 'configuration', ownerSurface, 'Provider auth/session identifier was redacted because it looked unsafe.');
  }
  if (decision.status !== 'allow') {
    return blockedRow('provider-auth-session-plan', 'Provider auth/session setup', 'configuration', ownerSurface, decision.blockReasons.join(', ') || 'Provider auth/session setup is blocked.');
  }
  return readyRow('provider-auth-session-plan', 'Provider auth/session setup', 'configuration', ownerSurface, 'Inert auth/session plan is ready; it does not open OAuth, mutate sessions, or test providers.', { providerId });
}

function messagingRow(input: ConnectorRuntimeUiWiringPlanInput): ConnectorRuntimeUiWiringStatusRow {
  const plan = input.messagingAdapterPlan;
  const ownerSurface: ConnectorRuntimeUiOwnerSurface = 'messaging';
  if (!plan) {
    return blockedRow('messaging-delivery-dry-run', 'Messaging dry-run delivery', 'runtime-readiness', ownerSurface, 'Messaging delivery adapter plan is missing.');
  }
  if (hasRawSecretMaterial(plan) || unsafeExecutableClaim(plan) || hasUnsafeRuntimeShape(plan)) {
    return blockedRow('messaging-delivery-dry-run', 'Messaging dry-run delivery', 'runtime-readiness', ownerSurface, 'Messaging adapter plan was redacted because it included secret material, executable claims, or live runtime metadata.');
  }
  if (ownerMismatch(ownerSurface, input.expectedOwnerSurface)) {
    return blockedRow('messaging-delivery-dry-run', 'Messaging dry-run delivery', 'runtime-readiness', ownerSurface, 'Messaging owner surface does not match the requested UI surface.');
  }
  const connectorKind = safeIdentifier(plan.connectorKind);
  if (plan.connectorKind !== undefined && !connectorKind) {
    return blockedRow('messaging-delivery-dry-run', 'Messaging dry-run delivery', 'runtime-readiness', ownerSurface, 'Messaging connector identifier was redacted because it looked unsafe.');
  }
  if (plan.status !== 'planned' || plan.planned !== true) {
    return blockedRow('messaging-delivery-dry-run', 'Messaging dry-run delivery', 'runtime-readiness', ownerSurface, plan.reason || 'Messaging dry-run delivery plan is blocked.');
  }
  return readyRow('messaging-delivery-dry-run', 'Messaging dry-run delivery', 'runtime-readiness', ownerSurface, 'Dry-run messaging plan is ready; target ids remain omitted and no post/webhook action is executable.', { connectorKind });
}

function localBridgeRow(input: ConnectorRuntimeUiWiringPlanInput): ConnectorRuntimeUiWiringStatusRow {
  const decision = input.localBridgeProbeDecision;
  const ownerSurface: ConnectorRuntimeUiOwnerSurface = 'integrations';
  if (!decision) {
    return blockedRow('local-bridge-manual-probe', 'Local bridge manual probe', 'runtime-readiness', ownerSurface, 'Local bridge probe execution decision is missing.');
  }
  if (hasRawSecretMaterial(decision) || unsafeExecutableClaim(decision) || hasUnsafeRuntimeShape(decision)) {
    return blockedRow('local-bridge-manual-probe', 'Local bridge manual probe', 'runtime-readiness', ownerSurface, 'Local bridge probe decision was redacted because it included secret material, executable claims, or live runtime metadata.');
  }
  if (ownerMismatch(ownerSurface, input.expectedOwnerSurface)) {
    return blockedRow('local-bridge-manual-probe', 'Local bridge manual probe', 'runtime-readiness', ownerSurface, 'Local bridge owner surface does not match the requested UI surface.');
  }
  const connectorKind = safeIdentifier(decision.bridgeKind);
  if (decision.bridgeKind !== undefined && !connectorKind) {
    return blockedRow('local-bridge-manual-probe', 'Local bridge manual probe', 'runtime-readiness', ownerSurface, 'Local bridge identifier was redacted because it looked unsafe.');
  }
  if (decision.status !== 'allow') {
    return blockedRow('local-bridge-manual-probe', 'Local bridge manual probe', 'runtime-readiness', ownerSurface, decision.blockReasons.join(', ') || 'Local bridge manual probe is blocked.');
  }
  return readyRow('local-bridge-manual-probe', 'Local bridge manual probe', 'runtime-readiness', ownerSurface, 'Manual local bridge probe plan is ready; this view model does not fetch or open sockets.', { connectorKind });
}

function persistenceRow(input: ConnectorRuntimeUiWiringPlanInput): ConnectorRuntimeUiWiringStatusRow {
  const decision = input.persistenceGuardDecision;
  const ownerSurface = ownerSurfaceFromPersistence(decision);
  if (!decision) {
    return blockedRow('connector-runtime-persistence', 'Connector runtime persistence', 'persistence', ownerSurface, 'Connector runtime persistence guard decision is missing.');
  }
  if (hasRawSecretMaterial(decision) || unsafeExecutableClaim(decision) || hasUnsafeRuntimeShape(decision)) {
    return blockedRow('connector-runtime-persistence', 'Connector runtime persistence', 'persistence', ownerSurface, 'Persistence guard decision was redacted because it included secret material, executable claims, or live runtime metadata.');
  }
  if (ownerMismatch(ownerSurface, input.expectedOwnerSurface)) {
    return blockedRow('connector-runtime-persistence', 'Connector runtime persistence', 'persistence', ownerSurface, 'Persistence owner surface does not match the requested UI surface.');
  }
  const providerId = safeIdentifier(decision.metadata.providerId);
  if (decision.metadata.providerId !== undefined && !providerId) {
    return blockedRow('connector-runtime-persistence', 'Connector runtime persistence', 'persistence', ownerSurface, 'Persistence metadata identifier was redacted because it looked unsafe.');
  }
  if (decision.status !== 'allow-session-only') {
    return blockedRow('connector-runtime-persistence', 'Connector runtime persistence', 'persistence', ownerSurface, decision.blockers.map((blocker) => blocker.code).join(', ') || 'Connector runtime persistence is disabled.');
  }
  return readyRow('connector-runtime-persistence', 'Connector runtime persistence', 'persistence', ownerSurface, 'Session-only runtime state is allowed; durable storage, export, import, sync, and schema changes remain disabled.', { providerId });
}

export function createConnectorRuntimeUiWiringPlan(
  input: ConnectorRuntimeUiWiringPlanInput = {},
): ConnectorRuntimeUiWiringPlan {
  const rawSecretMaterial = hasRawSecretMaterial(input);
  const unsafeRuntimeShape = hasUnsafeRuntimeShape(input);
  const rows = [
    providerAdapterRow(input),
    authSessionRow(input),
    messagingRow(input),
    localBridgeRow(input),
    persistenceRow(input),
  ].map((row) => {
    if (!rawSecretMaterial) return row;
    return blockedRow(row.id, row.label, row.kind, row.ownerSurface, 'Connector runtime UI wiring input was redacted because it included raw secret material.');
  }).map((row) => {
    if (!unsafeRuntimeShape) return row;
    return blockedRow(row.id, row.label, row.kind, row.ownerSurface, 'Connector runtime UI wiring input was redacted because it included live runtime metadata.');
  });

  return Object.freeze({
    schemaVersion: 1,
    contract: 'connector-runtime-ui-wiring-plan-v1',
    rows: Object.freeze(rows),
    executable: false,
    sideEffects: 'none',
    sideEffectBoundary: SIDE_EFFECT_BOUNDARY,
  });
}
