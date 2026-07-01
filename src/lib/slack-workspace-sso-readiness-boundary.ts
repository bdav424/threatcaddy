import { hasConnectorSecretMaterial, isSecretLikeFieldName } from './connector-credential-boundary';

export type SlackWorkspaceSsoReadinessStatus = 'ready' | 'blocked';

export type SlackWorkspaceSsoReadinessReason =
  | 'slack_workspace_sso_readiness_ready'
  | 'workspace_identity_missing'
  | 'workspace_identity_invalid'
  | 'workspace_identity_unreviewed'
  | 'identity_provider_invalid'
  | 'scope_intent_missing'
  | 'scope_intent_invalid'
  | 'scope_intent_unreviewed'
  | 'VENDOR_or_employer_branding_forbidden'
  | 'raw_secret_material'
  | 'runtime_shape_forbidden';

export type SlackWorkspaceIdentityProviderCategory =
  | 'microsoft'
  | 'google'
  | 'okta'
  | 'saml'
  | 'oidc'
  | 'workspace-managed';

export interface SlackWorkspaceSsoWorkspaceIdentity {
  contract: 'slack-workspace-sso-workspace-identity-v1';
  workspaceId: string;
  workspaceSlug: string;
  workspaceDisplayName: string;
  reviewState: 'reviewed';
  identityProviderCategory: SlackWorkspaceIdentityProviderCategory;
  providerNeutralLabel: string;
  workspaceIdentityReviewed: true;
}

export interface SlackWorkspaceNotificationScopeIntent {
  contract: 'slack-workspace-notification-scope-intent-v1';
  workspaceId: string;
  reviewState: 'reviewed';
  notificationIntent: 'ioc-alerts' | 'case-updates' | 'analyst-routing';
  scopeIds: readonly string[];
  scopeLabels: readonly string[];
  noAutoPost: true;
  notificationOnly: true;
  userConsentRequired: true;
  workspaceAdminReviewRequired: true;
}

export interface SlackWorkspaceSsoReadinessInput {
  workspaceIdentity?: unknown;
  notificationScopeIntent?: unknown;
}

export interface SlackWorkspaceSsoReadinessPlan {
  contract: 'slack-workspace-sso-readiness-plan-v1';
  workspaceId: string;
  workspaceSlug: string;
  workspaceDisplayName: string;
  identityProviderCategory: SlackWorkspaceIdentityProviderCategory;
  providerNeutralLabel: string;
  notificationIntent: SlackWorkspaceNotificationScopeIntent['notificationIntent'];
  scopeIds: readonly string[];
  scopeLabels: readonly string[];
  workspaceIdentityReviewed: true;
  notificationScopeIntentReviewed: true;
  noAutoPost: true;
  notificationOnly: true;
  userConsentRequired: true;
  workspaceAdminReviewRequired: true;
  executable: false;
  sideEffects: 'none';
  sideEffectBoundary: 'slack-workspace-sso-readiness-plan-only-no-oauth-no-api-no-webhook-no-storage-no-provider';
}

export interface SlackWorkspaceSsoReadinessDecision {
  status: SlackWorkspaceSsoReadinessStatus;
  ready: boolean;
  reason: SlackWorkspaceSsoReadinessReason;
  plan?: SlackWorkspaceSsoReadinessPlan;
  canPrepareFutureSlackWorkspaceSsoPlan: boolean;
  executable: false;
  sideEffects: 'none';
  willOpenOAuthWindow: false;
  willCallSlackApi: false;
  willCallWebhook: false;
  willFetch: false;
  willOpenSocket: false;
  willMutateStorage: false;
  willCollectCredential: false;
  sideEffectBoundary: 'slack-workspace-sso-readiness-boundary-plan-only-no-oauth-no-api-no-webhook-no-storage-no-provider';
}

const DECISION_BOUNDARY =
  'slack-workspace-sso-readiness-boundary-plan-only-no-oauth-no-api-no-webhook-no-storage-no-provider' as const;
const PLAN_BOUNDARY =
  'slack-workspace-sso-readiness-plan-only-no-oauth-no-api-no-webhook-no-storage-no-provider' as const;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,179}$/;
const SAFE_LABEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._:@/+()~-]{0,179}$/;
const WORKSPACE_KEYS = new Set([
  'contract',
  'identityProviderCategory',
  'providerNeutralLabel',
  'reviewState',
  'workspaceDisplayName',
  'workspaceId',
  'workspaceIdentityReviewed',
  'workspaceSlug',
]);
const SCOPE_KEYS = new Set([
  'contract',
  'noAutoPost',
  'notificationIntent',
  'notificationOnly',
  'reviewState',
  'scopeIds',
  'scopeLabels',
  'userConsentRequired',
  'workspaceAdminReviewRequired',
  'workspaceId',
]);
const PROVIDER_CATEGORIES = new Set<SlackWorkspaceIdentityProviderCategory>([
  'microsoft',
  'google',
  'okta',
  'saml',
  'oidc',
  'workspace-managed',
]);
const NOTIFICATION_INTENTS = new Set<SlackWorkspaceNotificationScopeIntent['notificationIntent']>([
  'ioc-alerts',
  'case-updates',
  'analyst-routing',
]);
const FORBIDDEN_RUNTIME_MARKERS = [
  'callback',
  'execute',
  'executable',
  'fetch',
  'liveaction',
  'requester',
  'socket',
  'storage',
  'webhook',
  'oauthredirect',
  'slackapi',
] as const;
const FORBIDDEN_BRAND_MARKERS = ['VENDOR', 'employer', 'corporate-sso', 'VENDOR-sso'] as const;
const PROVIDER_LABEL_MARKERS = ['google', 'microsoft', 'okta', 'saml', 'oidc'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function safeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!SAFE_ID_PATTERN.test(trimmed) || isSecretLikeFieldName(trimmed) || hasForbiddenBranding(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function safeLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!SAFE_LABEL_PATTERN.test(trimmed) || isSecretLikeFieldName(trimmed) || hasForbiddenBranding(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function safeProviderNeutralLabel(value: unknown): string | undefined {
  const label = safeLabel(value);
  if (!label) return undefined;
  const normalized = normalize(label);
  if (PROVIDER_LABEL_MARKERS.some((marker) => normalized.includes(normalize(marker)))) return undefined;
  return label;
}

function hasForbiddenBranding(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'string') {
    const normalized = normalize(value);
    return FORBIDDEN_BRAND_MARKERS.some((marker) => normalized.includes(normalize(marker)));
  }
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => hasForbiddenBranding(item, seen));
  return Object.entries(value).some(([key, nestedValue]) => (
    hasForbiddenBranding(key, seen) || hasForbiddenBranding(nestedValue, seen)
  ));
}

function hasForbiddenRuntimeShape(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'function') return true;
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => hasForbiddenRuntimeShape(item, seen));
  return Object.entries(value).some(([key, nestedValue]) => {
    const normalizedKey = normalize(key);
    return FORBIDDEN_RUNTIME_MARKERS.some((marker) => normalizedKey.includes(marker))
      || hasForbiddenRuntimeShape(nestedValue, seen);
  });
}

function safeStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > 12) return undefined;
  const values = value.map((item) => safeLabel(item));
  if (values.some((item) => item === undefined)) return undefined;
  return Object.freeze(values as string[]);
}

function parseWorkspace(
  value: unknown,
): { ok: true; value: SlackWorkspaceSsoWorkspaceIdentity } | { ok: false; reason: SlackWorkspaceSsoReadinessReason } {
  if (!isRecord(value) || !hasOnlyKeys(value, WORKSPACE_KEYS)) {
    return { ok: false, reason: 'workspace_identity_invalid' };
  }
  const workspaceId = safeIdentifier(value.workspaceId);
  const workspaceSlug = safeIdentifier(value.workspaceSlug);
  const workspaceDisplayName = safeLabel(value.workspaceDisplayName);
  const providerNeutralLabel = safeProviderNeutralLabel(value.providerNeutralLabel);
  const identityProviderCategory = PROVIDER_CATEGORIES.has(value.identityProviderCategory as SlackWorkspaceIdentityProviderCategory)
    ? value.identityProviderCategory as SlackWorkspaceIdentityProviderCategory
    : undefined;
  if (
    value.contract !== 'slack-workspace-sso-workspace-identity-v1'
    || !workspaceId
    || !workspaceSlug
    || !workspaceDisplayName
    || !identityProviderCategory
    || !providerNeutralLabel
    || value.workspaceIdentityReviewed !== true
  ) {
    return { ok: false, reason: 'workspace_identity_invalid' };
  }
  if (value.reviewState !== 'reviewed') return { ok: false, reason: 'workspace_identity_unreviewed' };
  return {
    ok: true,
    value: Object.freeze({
      contract: 'slack-workspace-sso-workspace-identity-v1',
      workspaceId,
      workspaceSlug,
      workspaceDisplayName,
      reviewState: 'reviewed',
      identityProviderCategory,
      providerNeutralLabel,
      workspaceIdentityReviewed: true,
    }),
  };
}

function parseScopeIntent(
  value: unknown,
): { ok: true; value: SlackWorkspaceNotificationScopeIntent } | { ok: false; reason: SlackWorkspaceSsoReadinessReason } {
  if (!isRecord(value) || !hasOnlyKeys(value, SCOPE_KEYS)) {
    return { ok: false, reason: 'scope_intent_invalid' };
  }
  const workspaceId = safeIdentifier(value.workspaceId);
  const scopeIds = safeStringArray(value.scopeIds);
  const scopeLabels = safeStringArray(value.scopeLabels);
  const notificationIntent = NOTIFICATION_INTENTS.has(value.notificationIntent as SlackWorkspaceNotificationScopeIntent['notificationIntent'])
    ? value.notificationIntent as SlackWorkspaceNotificationScopeIntent['notificationIntent']
    : undefined;
  if (
    value.contract !== 'slack-workspace-notification-scope-intent-v1'
    || !workspaceId
    || !notificationIntent
    || !scopeIds
	    || !scopeLabels
	    || scopeIds.length !== scopeLabels.length
	    || value.noAutoPost !== true
    || value.notificationOnly !== true
    || value.userConsentRequired !== true
    || value.workspaceAdminReviewRequired !== true
  ) {
    return { ok: false, reason: 'scope_intent_invalid' };
  }
  if (value.reviewState !== 'reviewed') return { ok: false, reason: 'scope_intent_unreviewed' };
  return {
    ok: true,
    value: Object.freeze({
      contract: 'slack-workspace-notification-scope-intent-v1',
      workspaceId,
      reviewState: 'reviewed',
      notificationIntent,
      scopeIds,
      scopeLabels,
      noAutoPost: true,
      notificationOnly: true,
      userConsentRequired: true,
      workspaceAdminReviewRequired: true,
    }),
  };
}

function blocked(reason: SlackWorkspaceSsoReadinessReason): Readonly<SlackWorkspaceSsoReadinessDecision> {
  return Object.freeze({
    status: 'blocked',
    ready: false,
    reason,
    canPrepareFutureSlackWorkspaceSsoPlan: false,
    executable: false,
    sideEffects: 'none',
    willOpenOAuthWindow: false,
    willCallSlackApi: false,
    willCallWebhook: false,
    willFetch: false,
    willOpenSocket: false,
    willMutateStorage: false,
    willCollectCredential: false,
    sideEffectBoundary: DECISION_BOUNDARY,
  });
}

export function evaluateSlackWorkspaceSsoReadinessBoundary(
  input: SlackWorkspaceSsoReadinessInput,
): Readonly<SlackWorkspaceSsoReadinessDecision> {
  if (hasConnectorSecretMaterial(input)) return blocked('raw_secret_material');
  if (hasForbiddenRuntimeShape(input)) return blocked('runtime_shape_forbidden');
  if (hasForbiddenBranding(input)) return blocked('VENDOR_or_employer_branding_forbidden');
  if (input.workspaceIdentity === undefined) return blocked('workspace_identity_missing');
  if (input.notificationScopeIntent === undefined) return blocked('scope_intent_missing');

  const workspace = parseWorkspace(input.workspaceIdentity);
  if (!workspace.ok) return blocked(workspace.reason);
  const scope = parseScopeIntent(input.notificationScopeIntent);
  if (!scope.ok) return blocked(scope.reason);
  if (scope.value.workspaceId !== workspace.value.workspaceId) return blocked('workspace_identity_invalid');

  const plan: SlackWorkspaceSsoReadinessPlan = Object.freeze({
    contract: 'slack-workspace-sso-readiness-plan-v1',
    workspaceId: workspace.value.workspaceId,
    workspaceSlug: workspace.value.workspaceSlug,
    workspaceDisplayName: workspace.value.workspaceDisplayName,
    identityProviderCategory: workspace.value.identityProviderCategory,
    providerNeutralLabel: workspace.value.providerNeutralLabel,
    notificationIntent: scope.value.notificationIntent,
    scopeIds: Object.freeze([...scope.value.scopeIds]),
    scopeLabels: Object.freeze([...scope.value.scopeLabels]),
    workspaceIdentityReviewed: true,
    notificationScopeIntentReviewed: true,
    noAutoPost: true,
    notificationOnly: true,
    userConsentRequired: true,
    workspaceAdminReviewRequired: true,
    executable: false,
    sideEffects: 'none',
    sideEffectBoundary: PLAN_BOUNDARY,
  });

  return Object.freeze({
    status: 'ready',
    ready: true,
    reason: 'slack_workspace_sso_readiness_ready',
    plan,
    canPrepareFutureSlackWorkspaceSsoPlan: true,
    executable: false,
    sideEffects: 'none',
    willOpenOAuthWindow: false,
    willCallSlackApi: false,
    willCallWebhook: false,
    willFetch: false,
    willOpenSocket: false,
    willMutateStorage: false,
    willCollectCredential: false,
    sideEffectBoundary: DECISION_BOUNDARY,
  });
}
