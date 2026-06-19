import {
  LOCAL_PROMPT_CHAR_LIMIT,
  estimateLocalPromptChars,
} from './llm-prompt-budget';
import {
  createLocalBridgeDiscoveryPlan,
} from './local-bridge-discovery';
import {
  validateConnectorCredentialReference,
  type ConnectorCredentialReference,
  type ConnectorCredentialReferenceRejectReason,
} from './connector-credential-boundary';
import { isRuntimeTrustedContractObject } from './runtime-trusted-contract-object';
import type {
  AssistantProviderReadiness,
  AssistantProviderRoute,
} from './assistant-provider-readiness';

export type AssistantProviderAction =
  | 'send_prompt'
  | 'test_provider'
  | 'list_models'
  | 'disable_provider';

export type AssistantProviderExecutionDecisionStatus = 'allow' | 'block';

export type AssistantProviderExecutionBlockReason =
  | 'unknown_action'
  | 'readiness_missing'
  | 'caddyai_baseline_only'
  | 'provider_not_configured'
  | 'provider_not_openai_compatible'
  | 'local_endpoint_not_allowed'
  | 'readiness_provider_unbound'
  | 'readiness_provider_mismatch'
  | 'readiness_model_mismatch'
  | 'readiness_credential_unbound'
  | 'readiness_credential_mismatch'
  | 'readiness_local_endpoint_unbound'
  | 'credential_reference_missing'
  | 'credential_reference_invalid'
  | 'credential_reference_mismatch'
  | 'explicit_user_action_missing'
  | 'prompt_missing'
  | 'prompt_too_large'
  | 'no_auto_call_default';

export type AssistantProviderExecutionAllowReason =
  | 'explicit_disable_local_metadata_only'
  | 'explicit_provider_test_plan_only'
  | 'explicit_model_list_plan_only'
  | 'explicit_prompt_dispatch_ready';

export interface AssistantProviderExplicitUserActionFact {
  granted: boolean;
  action: AssistantProviderAction;
  provider?: AssistantProviderRoute;
  model?: string;
  acknowledgedNoAutoCall: boolean;
}

export interface AssistantProviderPromptMessage {
  role: string;
  content: unknown;
}

export interface AssistantProviderExecutionGateInput {
  action?: AssistantProviderAction | string;
  readiness?: AssistantProviderReadiness;
  credentialReference?: unknown;
  explicitUserAction?: AssistantProviderExplicitUserActionFact;
  prompt?: {
    model?: string;
    systemPrompt?: string;
    messages?: readonly AssistantProviderPromptMessage[];
    tools?: readonly unknown[];
    maxChars?: number;
  };
  caddyAiBaselineConfigured?: boolean;
}

export interface AssistantProviderExecutionDecision {
  status: AssistantProviderExecutionDecisionStatus;
  action: AssistantProviderAction | 'unknown';
  executable: false;
  sideEffects: 'none';
  provider?: AssistantProviderRoute;
  model?: string;
  localEndpoint?: string;
  credentialReference?: ConnectorCredentialReference;
  promptEstimateChars?: number;
  allowReason?: AssistantProviderExecutionAllowReason;
  blockReasons: readonly AssistantProviderExecutionBlockReason[];
  credentialRejectReason?: ConnectorCredentialReferenceRejectReason;
  sideEffectBoundary: 'decision-only-no-fetch-no-socket-no-storage-no-llm';
}

const OPENAI_COMPATIBLE_ROUTES = new Set<AssistantProviderRoute>(['openai', 'local']);
const SUPPORTED_PROVIDER_ROUTES = new Set<AssistantProviderRoute>([
  'anthropic',
  'openai',
  'gemini',
  'mistral',
  'local',
]);
const ACTIONS_REQUIRING_OPENAI_COMPATIBLE_PROVIDER = new Set<AssistantProviderAction>([
  'send_prompt',
  'test_provider',
  'list_models',
]);
const READINESS_BOUNDARY = 'metadata-only-no-fetch-no-socket-no-storage-no-llm' as const;
const LOCAL_PLAN_BOUNDARY = 'plan-only-no-fetch-no-socket-no-storage' as const;
const MAX_IDENTIFIER_LENGTH = 180;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,179}$/;
const EXECUTION_GATE_INPUT_KEYS = new Set([
  'action',
  'caddyAiBaselineConfigured',
  'credentialReference',
  'explicitUserAction',
  'prompt',
  'readiness',
]);
const SECRET_VALUE_PATTERNS = [
  /^xox[a-z0-9]*-[a-z0-9-]{8,}$/i,
  /^gh[pousr]_[a-z0-9_]{8,}$/i,
  /^github_pat_[a-z0-9_]{8,}$/i,
  /^(?:AKIA|ASIA)[a-z0-9]{8,}$/i,
  /^(?:sk|pk|rk)-[a-z0-9_-]{8,}$/i,
  /^eyj[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}$/i,
  /bearer\s+[a-z0-9._~+/=-]{8,}/i,
  /basic\s+[a-z0-9._~+/=-]{8,}/i,
  /(?:api|app|bot|client|refresh|access|session)[_-]?(?:key|token|secret)\s*[:=]\s*\S+/i,
  /(?:oauth|authorization)[\s_-]?code\s*[:=]\s*\S+/i,
  /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/i,
] as const;
const UNSAFE_FIELD_MARKERS = [
  'browserstorage',
  'callback',
  'dexie',
  'eventsource',
  'fetch',
  'indexeddb',
  'liveaction',
  'llmcall',
  'localstorage',
  'requester',
  'sessionstorage',
  'socket',
  'storageadapter',
  'stream',
  'websocket',
] as const;

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function stringLooksSecretBearing(value: string): boolean {
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function hasOnlyAllowedKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function valueHasUnsafeExecutionHook(value: unknown, seen = new WeakSet<object>(), currentKey?: string): boolean {
  const normalizedKey = currentKey ? normalizeKey(currentKey) : '';
  if (normalizedKey && UNSAFE_FIELD_MARKERS.some((marker) => normalizedKey.includes(marker))) {
    return true;
  }
  if (typeof value === 'function') return true;
  if (value === null || value === undefined || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) return value.some((item) => valueHasUnsafeExecutionHook(item, seen));
  return Object.entries(value).some(([key, nestedValue]) => valueHasUnsafeExecutionHook(nestedValue, seen, key));
}

function safeIdentifier(value: unknown): string | undefined {
  const normalized = normalizedString(value);
  if (!normalized) return undefined;
  if (
    normalized.length > MAX_IDENTIFIER_LENGTH
    || !SAFE_ID_PATTERN.test(normalized)
    || stringLooksSecretBearing(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function safeProviderRoute(value: unknown): AssistantProviderRoute | undefined {
  return SUPPORTED_PROVIDER_ROUTES.has(value as AssistantProviderRoute)
    ? value as AssistantProviderRoute
    : undefined;
}

function safeReadinessStatus(value: unknown): AssistantProviderReadiness['status'] | undefined {
  return value === 'configured'
    || value === 'blocked'
    || value === 'explicit-user-test-ready'
    || value === 'unavailable'
    ? value
    : undefined;
}

function normalizeAction(value: unknown): AssistantProviderAction | 'unknown' {
  if (
    value === 'send_prompt'
    || value === 'test_provider'
    || value === 'list_models'
    || value === 'disable_provider'
  ) {
    return value;
  }
  return 'unknown';
}

function hasExplicitUserAction(
  fact: AssistantProviderExecutionGateInput['explicitUserAction'],
  action: AssistantProviderAction,
  provider?: AssistantProviderRoute,
): boolean {
  return fact?.granted === true
    && fact.action === action
    && fact.acknowledgedNoAutoCall === true
    && (!provider || fact.provider === provider);
}

function acceptedLocalEndpoint(readiness: AssistantProviderReadiness): string | undefined {
  if (readiness.sideEffectBoundary !== READINESS_BOUNDARY) return undefined;
  const plan = readiness.localBridgePlan;
  if (
    !plan
    || plan.bridgeKind !== 'llm'
    || plan.allowed !== true
    || plan.consentGranted !== true
    || plan.consentRequired !== false
    || plan.status !== 'ready'
    || plan.sideEffectBoundary !== LOCAL_PLAN_BOUNDARY
    || !Number.isSafeInteger(plan.acceptedCount)
    || !Number.isSafeInteger(plan.rejectedCount)
    || plan.acceptedCount !== 1
  ) {
    return undefined;
  }

  const acceptedCandidates = plan.candidates.filter((candidate) => (
    candidate.accepted
    && candidate.probe?.allowed === true
    && candidate.probe.consentRequired === false
    && candidate.probe.sideEffectBoundary === 'plan-only-no-fetch-no-socket'
    && typeof candidate.normalizedEndpoint === 'string'
    && candidate.normalizedEndpoint.trim()
  ));
  if (acceptedCandidates.length !== 1) return undefined;

  const claimedEndpoint = acceptedCandidates[0]?.normalizedEndpoint;
  if (!claimedEndpoint) return undefined;

  const endpointPlan = createLocalBridgeDiscoveryPlan({
    bridgeKind: 'llm',
    candidates: [claimedEndpoint],
    consentGranted: true,
    defaultProbePath: '/health',
    maxCandidates: 1,
  });

  const acceptedEndpoint = endpointPlan.candidates[0];
  return endpointPlan.allowed
    && endpointPlan.consentRequired === false
    && endpointPlan.status === 'ready'
    && endpointPlan.acceptedCount === 1
    && endpointPlan.rejectedCount === 0
    && acceptedEndpoint?.accepted === true
    && acceptedEndpoint.normalizedEndpoint === claimedEndpoint
    ? claimedEndpoint
    : undefined;
}

function estimatePrompt(input: AssistantProviderExecutionGateInput): number | undefined {
  const messages = input.prompt?.messages;
  if (!messages || messages.length === 0) return undefined;

  return estimateLocalPromptChars({
    model: safeIdentifier(input.prompt?.model) ?? safeIdentifier(input.readiness?.model),
    systemPrompt: input.prompt?.systemPrompt,
    messages: messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    tools: input.prompt?.tools ? [...input.prompt.tools] : undefined,
  });
}

function allowReasonFor(action: AssistantProviderAction): AssistantProviderExecutionAllowReason {
  if (action === 'disable_provider') return 'explicit_disable_local_metadata_only';
  if (action === 'test_provider') return 'explicit_provider_test_plan_only';
  if (action === 'list_models') return 'explicit_model_list_plan_only';
  return 'explicit_prompt_dispatch_ready';
}

function actionRequiresProviderReadiness(action: AssistantProviderAction | 'unknown'): action is AssistantProviderAction {
  return action !== 'unknown'
    && action !== 'disable_provider'
    && ACTIONS_REQUIRING_OPENAI_COMPATIBLE_PROVIDER.has(action);
}

function inputShapeForbiddenDecision(): AssistantProviderExecutionDecision {
  return Object.freeze({
    status: 'block',
    action: 'unknown',
    executable: false,
    sideEffects: 'none',
    provider: undefined,
    model: undefined,
    credentialReference: undefined,
    promptEstimateChars: undefined,
    allowReason: undefined,
    blockReasons: Object.freeze(['unknown_action'] satisfies AssistantProviderExecutionBlockReason[]),
    credentialRejectReason: undefined,
    sideEffectBoundary: 'decision-only-no-fetch-no-socket-no-storage-no-llm',
  });
}

function bindReadinessOwnership(input: {
  action: AssistantProviderAction | 'unknown';
  readiness?: AssistantProviderReadiness;
  credentialReference?: ConnectorCredentialReference;
  explicitUserAction?: AssistantProviderExplicitUserActionFact;
  promptModel?: string;
}): AssistantProviderExecutionBlockReason[] {
  const { action, readiness, credentialReference, explicitUserAction, promptModel } = input;
  const blockers: AssistantProviderExecutionBlockReason[] = [];
  if (!actionRequiresProviderReadiness(action) || !readiness) return blockers;
  const readinessProvider = safeProviderRoute(readiness.provider);
  const readinessModel = safeIdentifier(readiness.model);

  if (!readinessProvider || !explicitUserAction?.provider) {
    blockers.push('readiness_provider_unbound');
  } else if (readinessProvider !== explicitUserAction.provider) {
    blockers.push('readiness_provider_mismatch');
  }

  const expectedModel = explicitUserAction?.model ?? promptModel;
  if (readiness.model !== undefined && !readinessModel) {
    blockers.push('readiness_model_mismatch');
  } else if (expectedModel && readinessModel !== expectedModel) {
    blockers.push('readiness_model_mismatch');
  }

  const readinessCredentialValidation = validateConnectorCredentialReference(readiness.credentialReference);
  if (!readinessCredentialValidation.ok || !credentialReference) {
    blockers.push('readiness_credential_unbound');
  } else {
    const readinessCredential = readinessCredentialValidation.reference;
    if (
      readinessCredential.id !== credentialReference.id
      || readinessCredential.providerId !== credentialReference.providerId
      || (readinessProvider && readinessCredential.providerId !== readinessProvider)
    ) {
      blockers.push('readiness_credential_mismatch');
    }
  }

  if (readinessProvider === 'local' && !acceptedLocalEndpoint(readiness)) {
    blockers.push('readiness_local_endpoint_unbound');
  }

  return blockers;
}

export function evaluateAssistantProviderExecutionGate(
  input: AssistantProviderExecutionGateInput,
): AssistantProviderExecutionDecision {
  const rawInput = input as unknown;
  if (
    !isRuntimeTrustedContractObject(rawInput)
    || valueHasUnsafeExecutionHook(rawInput)
    || !hasOnlyAllowedKeys(rawInput, EXECUTION_GATE_INPUT_KEYS)
  ) {
    return inputShapeForbiddenDecision();
  }

  const action = normalizeAction(input.action);
  const readiness = input.readiness;
  const provider = safeProviderRoute(readiness?.provider);
  const model = safeIdentifier(readiness?.model);
  const readinessStatus = safeReadinessStatus(readiness?.status);
  const localEndpoint = provider === 'local' && readiness ? acceptedLocalEndpoint(readiness) : undefined;
  const caddyAiBaselineConfigured = input.caddyAiBaselineConfigured === true || readiness?.caddyAiBaselineConfigured === true;
  const blockReasons: AssistantProviderExecutionBlockReason[] = [];
  let credentialReference: ConnectorCredentialReference | undefined;
  let credentialRejectReason: ConnectorCredentialReferenceRejectReason | undefined;
  let promptEstimateChars: number | undefined;

  if (action === 'unknown') blockReasons.push('unknown_action');
  if (readiness) {
    if (readiness.sideEffectBoundary !== READINESS_BOUNDARY || !Array.isArray(readiness.blockReasons) || !readinessStatus) {
      blockReasons.push('provider_not_configured');
    }
    if (readiness.provider !== undefined && !provider) {
      blockReasons.push('readiness_provider_unbound');
    }
    if (readiness.model !== undefined && !model) {
      blockReasons.push('readiness_model_mismatch');
    }
  }

  const userActionGranted = action !== 'unknown' && hasExplicitUserAction(input.explicitUserAction, action, provider);

  const credentialInput = input.credentialReference ?? readiness?.credentialReference;
  if (action !== 'disable_provider') {
    if (credentialInput === undefined) {
      blockReasons.push('credential_reference_missing');
    } else {
      const credentialValidation = validateConnectorCredentialReference(credentialInput);
      if (credentialValidation.ok) {
        credentialReference = credentialValidation.reference;
        if (readiness?.credentialReference?.id && credentialReference.id !== readiness.credentialReference.id) {
          blockReasons.push('credential_reference_mismatch');
        }
        if (provider && credentialReference.providerId && credentialReference.providerId !== provider) {
          blockReasons.push('credential_reference_mismatch');
        }
      } else {
        credentialRejectReason = credentialValidation.reason;
        blockReasons.push('credential_reference_invalid');
      }
    }
  }

  if (!readiness) {
    blockReasons.push('readiness_missing');
  } else {
    const readinessAllowsAction = readinessStatus === 'configured'
      || (action === 'test_provider' && readinessStatus === 'explicit-user-test-ready');
    if (!readinessAllowsAction) blockReasons.push('provider_not_configured');
    if (!provider && caddyAiBaselineConfigured) blockReasons.push('caddyai_baseline_only');
    if (
      actionRequiresProviderReadiness(action)
      && (!provider || !OPENAI_COMPATIBLE_ROUTES.has(provider))
    ) {
      blockReasons.push('provider_not_openai_compatible');
    }
    if (provider === 'local' && !localEndpoint) {
      blockReasons.push('local_endpoint_not_allowed');
    }
    blockReasons.push(...bindReadinessOwnership({
      action,
      readiness,
      credentialReference,
      explicitUserAction: input.explicitUserAction,
      promptModel: input.prompt?.model,
    }));
  }

  if (action !== 'unknown' && !userActionGranted) {
    blockReasons.push('explicit_user_action_missing');
    blockReasons.push('no_auto_call_default');
  }

  if (action === 'send_prompt') {
    promptEstimateChars = estimatePrompt(input);
    if (promptEstimateChars === undefined) {
      blockReasons.push('prompt_missing');
    } else if (promptEstimateChars > (input.prompt?.maxChars ?? LOCAL_PROMPT_CHAR_LIMIT)) {
      blockReasons.push('prompt_too_large');
    }
  }

  const uniqueBlockReasons = Object.freeze([...new Set(blockReasons)]);
  const status: AssistantProviderExecutionDecisionStatus = uniqueBlockReasons.length === 0 ? 'allow' : 'block';

  return Object.freeze({
    status,
    action,
    executable: false,
    sideEffects: 'none',
    provider,
    model,
    ...(localEndpoint ? { localEndpoint } : {}),
    credentialReference,
    promptEstimateChars,
    allowReason: status === 'allow' ? allowReasonFor(action as AssistantProviderAction) : undefined,
    blockReasons: uniqueBlockReasons,
    credentialRejectReason,
    sideEffectBoundary: 'decision-only-no-fetch-no-socket-no-storage-no-llm',
  });
}
