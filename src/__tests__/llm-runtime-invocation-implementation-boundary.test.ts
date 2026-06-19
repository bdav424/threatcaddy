import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
import {
  evaluateAssistantProviderExecutionGate,
  type AssistantProviderExecutionDecision,
  type AssistantProviderExecutionGateInput,
} from '../lib/assistant-provider-execution-gate';
import { classifyAssistantProviderReadiness } from '../lib/assistant-provider-readiness';
import {
  executeAssistantProviderRuntimeAction,
  type AssistantProviderRuntimeResult,
} from '../lib/assistant-provider-runtime-executor';
import {
  evaluateLlmProviderLiveActivationGate,
  type LlmProviderLiveActivationDecision,
} from '../lib/llm-provider-live-activation-gate';
import {
  executeLlmRuntimeInvocationInjectedTestDoubleTransport,
  evaluateLlmRuntimeInvocationImplementationBoundary,
  type LlmRuntimeInvocationImplementationInput,
  type LlmRuntimeInvocationInjectedTransportExecutionInput,
  type LlmRuntimeInvocationInjectedTestDoubleTransport,
  type LlmRuntimeInvocationPlan,
  type LlmRuntimeInvocationTransportFacts,
} from '../lib/llm-runtime-invocation-implementation-boundary';
import {
  createRuntimeTrustedContractObject,
  type RuntimeTrustedContractEntry,
  type RuntimeTrustedContractObject,
  type RuntimeTrustedContractValue,
} from '../lib/runtime-trusted-contract-object';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const NOW = 1_800_000_000_000;
const PROVIDER_EXECUTION_BOUNDARY = 'decision-only-no-fetch-no-socket-no-storage-no-llm' as const;
const RUNTIME_BOUNDARY = 'fail-closed-runtime-facade-no-fetch-no-socket-no-storage-no-llm' as const;
const FACTS_BOUNDARY =
  'llm-transport-facts-only-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call' as const;
const PLAN_BOUNDARY =
  'llm-invocation-plan-only-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call' as const;
const INJECTED_REQUEST_BOUNDARY =
  'llm-runtime-invocation-injected-test-double-request-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call' as const;
const INJECTED_TRANSPORT_BOUNDARY =
  'llm-runtime-invocation-injected-test-double-transport-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call' as const;
const INJECTED_DECISION_BOUNDARY =
  'llm-runtime-invocation-injected-test-double-boundary-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call' as const;

function trustedContractObject<T>(entries: readonly RuntimeTrustedContractEntry[]): T {
  return createRuntimeTrustedContractObject(entries) as unknown as T;
}

function trustedArray<T extends RuntimeTrustedContractValue>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function asTrustedObject(value: unknown): RuntimeTrustedContractObject {
  return value as RuntimeTrustedContractObject;
}

function trustedValue(value: unknown): RuntimeTrustedContractValue {
  return value as RuntimeTrustedContractValue;
}

function trustedRuntimeValue(value: unknown): RuntimeTrustedContractValue {
  if (
    value === null
    || value === undefined
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) return Object.freeze(value.map((item) => trustedRuntimeValue(item)));
  if (typeof value === 'object') {
    return createRuntimeTrustedContractObject(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        trustedRuntimeValue(nested),
      ] as const),
    );
  }
  throw new TypeError('Trusted runtime invocation fixtures cannot include callable values.');
}

function trustCredentialReference(reference: ConnectorCredentialReference): ConnectorCredentialReference {
  return trustedContractObject<ConnectorCredentialReference>([
    ['schemaVersion', reference.schemaVersion],
    ['kind', reference.kind],
    ['id', reference.id],
    ['storageOwner', reference.storageOwner],
    ['providerId', reference.providerId],
    ['connectorId', reference.connectorId],
    ['accountId', reference.accountId],
    ['displayName', reference.displayName],
    ['createdAt', reference.createdAt],
  ]);
}

function credential(overrides: Partial<ConnectorCredentialReference> = {}): ConnectorCredentialReference {
  const value: ConnectorCredentialReference = {
    schemaVersion: overrides.schemaVersion ?? 1,
    kind: overrides.kind ?? 'local-bridge',
    id: overrides.id ?? 'local-bridge:assistantcaddy/llm-runtime',
    storageOwner: overrides.storageOwner ?? 'local-bridge',
    providerId: overrides.providerId ?? 'local',
    connectorId: overrides.connectorId ?? 'llm-runtime',
    accountId: overrides.accountId ?? 'analyst-workstation',
    displayName: overrides.displayName ?? 'Local LLM runtime credential reference',
    createdAt: overrides.createdAt ?? 1_700_000_000_000,
  };
  return trustCredentialReference(value);
}

function gateInput(overrides: Partial<AssistantProviderExecutionGateInput> = {}): AssistantProviderExecutionGateInput {
  const reference = credential();
  const readiness = classifyAssistantProviderReadiness({
    provider: 'local',
    model: 'llama3.1',
    credentialReference: reference,
    explicitUserTestConsent: true,
    localEndpointCandidates: ['http://127.0.0.1:11434/v1'],
    explicitUserTestResult: {
      status: 'passed',
      route: 'local',
      model: 'llama3.1',
      credentialReferenceId: reference.id,
      testedAt: NOW,
      localEndpoint: 'http://127.0.0.1:11434/v1',
    },
  });

  return {
    action: 'send_prompt',
    readiness,
    credentialReference: reference,
    explicitUserAction: {
      granted: true,
      action: 'send_prompt',
      provider: 'local',
      model: 'llama3.1',
      acknowledgedNoAutoCall: true,
    },
    prompt: {
      model: 'llama3.1',
      systemPrompt: 'Use concise CTI notes.',
      messages: [
        { role: 'user', content: 'Summarize the selected investigation evidence.' },
      ],
      maxChars: 200_000,
    },
    ...overrides,
  };
}

function providerExecution(input: AssistantProviderExecutionGateInput = gateInput()): AssistantProviderExecutionDecision {
  return trustProviderExecution(evaluateAssistantProviderExecutionGate(
    trustedRuntimeValue(input) as AssistantProviderExecutionGateInput,
  ));
}

async function runtimeResult(input: AssistantProviderExecutionGateInput = gateInput()): Promise<AssistantProviderRuntimeResult> {
  return trustRuntimeResult(await executeAssistantProviderRuntimeAction(
    trustedContractObject<Parameters<typeof executeAssistantProviderRuntimeAction>[0]>([
      ['gateInput', trustedRuntimeValue(input)],
    ]),
  ));
}

function trustProviderExecution(
  decision: AssistantProviderExecutionDecision,
  overrides: Partial<AssistantProviderExecutionDecision> = {},
  extraEntries: readonly RuntimeTrustedContractEntry[] = [],
): AssistantProviderExecutionDecision {
  const value = { ...decision, ...overrides };
  const entries: RuntimeTrustedContractEntry[] = [
    ['status', value.status],
    ['action', value.action],
    ['executable', value.executable],
    ['sideEffects', value.sideEffects],
    ['provider', value.provider],
    ['model', value.model],
    ['localEndpoint', value.localEndpoint],
    ['credentialReference', value.credentialReference ? asTrustedObject(trustCredentialReference(value.credentialReference)) : undefined],
    ['promptEstimateChars', value.promptEstimateChars],
    ['allowReason', value.allowReason],
    ['blockReasons', trustedArray((value.blockReasons ?? []) as readonly RuntimeTrustedContractValue[])],
    ['credentialRejectReason', value.credentialRejectReason],
    ['sideEffectBoundary', value.sideEffectBoundary],
    ...extraEntries,
  ];
  return trustedContractObject<AssistantProviderExecutionDecision>(entries);
}

function trustRuntimeResult(
  result: AssistantProviderRuntimeResult,
  overrides: Partial<AssistantProviderRuntimeResult> = {},
  extraEntries: readonly RuntimeTrustedContractEntry[] = [],
): AssistantProviderRuntimeResult {
  const value = { ...result, ...overrides };
  const entries: RuntimeTrustedContractEntry[] = [
    ['status', value.status],
    ['executed', value.executed],
    ['action', value.action],
    ['provider', value.provider],
    ['model', value.model],
    ['localEndpoint', value.localEndpoint],
    ['credentialReferenceId', value.credentialReferenceId],
    ['promptEstimateChars', value.promptEstimateChars],
    ['blockReasons', trustedArray((value.blockReasons ?? []) as readonly RuntimeTrustedContractValue[])],
    ['gateBlockReasons', trustedArray((value.gateBlockReasons ?? []) as readonly RuntimeTrustedContractValue[])],
    ['safeDetail', value.safeDetail],
    ['sideEffectBoundary', value.sideEffectBoundary],
    ...extraEntries,
  ];
  return trustedContractObject<AssistantProviderRuntimeResult>(entries);
}

function implementationInput(
  input: LlmRuntimeInvocationImplementationInput,
): LlmRuntimeInvocationImplementationInput {
  const entries: RuntimeTrustedContractEntry[] = [];
  for (const key of [
    'liveActivation',
    'providerExecution',
    'runtimeResult',
    'transportFacts',
    'invocationPlan',
    'transport',
    'transportResult',
  ] as const) {
    if (key in input) entries.push([key, trustedValue(input[key])]);
  }
  return trustedContractObject<LlmRuntimeInvocationImplementationInput>(entries);
}

function injectedExecutionInput(
  input: LlmRuntimeInvocationInjectedTransportExecutionInput,
): LlmRuntimeInvocationInjectedTransportExecutionInput {
  const entries: RuntimeTrustedContractEntry[] = [];
  for (const key of [
    'liveActivation',
    'providerExecution',
    'runtimeResult',
    'transportFacts',
    'invocationPlan',
    'injectedTransport',
    'executeInjectedTestDouble',
  ] as const) {
    if (key in input) entries.push([key, trustedValue(input[key])]);
  }
  return trustedContractObject<LlmRuntimeInvocationInjectedTransportExecutionInput>(entries);
}

function makeTransportIdentity(
  overrides: Partial<LlmRuntimeInvocationTransportFacts['transportIdentity']> = {},
): LlmRuntimeInvocationTransportFacts['transportIdentity'] {
  const value = {
    kind: 'future-reviewed-injected-llm-transport',
    id: 'assistantcaddy-llm-runtime-transport',
    version: '2026.06.12',
    owner: 'assistantcaddy-llm-runtime',
    ...overrides,
  } as const;
  return trustedContractObject<LlmRuntimeInvocationTransportFacts['transportIdentity']>([
    ['kind', value.kind],
    ['id', value.id],
    ['version', value.version],
    ['owner', value.owner],
  ]);
}

function makeTransportFacts(
  execution: AssistantProviderExecutionDecision,
  overrides: Partial<LlmRuntimeInvocationTransportFacts> = {},
  extraEntries: readonly RuntimeTrustedContractEntry[] = [],
): LlmRuntimeInvocationTransportFacts {
  if (
    execution.provider !== 'local'
    || execution.action !== 'send_prompt'
    || !execution.model
    || !execution.credentialReference
    || !execution.localEndpoint
  ) {
    throw new Error('test execution decision is not the expected local prompt decision');
  }
  const value = {
    contract: 'llm-runtime-invocation-transport-facts-v1',
    provider: 'local',
    model: execution.model,
    action: execution.action,
    credentialReferenceId: execution.credentialReference.id,
    requestId: 'llm-request-001',
    localEndpoint: execution.localEndpoint,
    promptEstimateChars: execution.promptEstimateChars,
    transportIdentity: makeTransportIdentity(),
    promptRedaction: 'prompt-omitted',
    bodyRedaction: 'body-omitted',
    headersRedaction: 'headers-omitted',
    streamingSupported: false,
    executable: false,
    dispatchAllowed: false,
    willCallProvider: false,
    willCallLocalBridge: false,
    willFetch: false,
    willOpenSocket: false,
    willStream: false,
    willMutateStorage: false,
    sideEffectBoundary: FACTS_BOUNDARY,
    ...overrides,
  };
  const entries: RuntimeTrustedContractEntry[] = [
    ['contract', value.contract],
    ['provider', value.provider],
    ['model', trustedValue(value.model)],
    ['action', value.action],
    ['credentialReferenceId', trustedValue(value.credentialReferenceId)],
    ['requestId', trustedValue(value.requestId)],
    ['localEndpoint', value.localEndpoint],
    ['promptEstimateChars', value.promptEstimateChars],
    ['transportIdentity', asTrustedObject(value.transportIdentity)],
    ['promptRedaction', value.promptRedaction],
    ['bodyRedaction', value.bodyRedaction],
    ['headersRedaction', value.headersRedaction],
    ['streamingSupported', value.streamingSupported],
    ['executable', value.executable],
    ['dispatchAllowed', value.dispatchAllowed],
    ['willCallProvider', value.willCallProvider],
    ['willCallLocalBridge', value.willCallLocalBridge],
    ['willFetch', value.willFetch],
    ['willOpenSocket', value.willOpenSocket],
    ['willStream', value.willStream],
    ['willMutateStorage', value.willMutateStorage],
    ['sideEffectBoundary', value.sideEffectBoundary],
    ...extraEntries,
  ];
  return trustedContractObject<LlmRuntimeInvocationTransportFacts>(entries);
}

function makeInvocationPlan(
  facts: LlmRuntimeInvocationTransportFacts,
  overrides: Partial<LlmRuntimeInvocationPlan> = {},
  extraEntries: readonly RuntimeTrustedContractEntry[] = [],
): LlmRuntimeInvocationPlan {
  const value = {
    contract: 'llm-runtime-invocation-plan-v1',
    provider: facts.provider,
    model: facts.model,
    action: facts.action,
    credentialReferenceId: facts.credentialReferenceId,
    requestId: facts.requestId,
    localEndpoint: facts.localEndpoint,
    promptEstimateChars: facts.promptEstimateChars,
    transportIdentity: makeTransportIdentity(facts.transportIdentity),
    acceptedProviderExecutionBoundary: PROVIDER_EXECUTION_BOUNDARY,
    acceptedRuntimeBoundary: RUNTIME_BOUNDARY,
    promptRedaction: 'prompt-omitted',
    acknowledgedNoPromptEcho: true,
    acknowledgedNoBodyEcho: true,
    acknowledgedNoHeaderEcho: true,
    acknowledgedNoCredentialMaterial: true,
    acknowledgedNoNetwork: true,
    acknowledgedNoStorage: true,
    acknowledgedNoStreaming: true,
    executable: false,
    dispatchAllowed: false,
    sideEffectBoundary: PLAN_BOUNDARY,
    ...overrides,
  };
  const entries: RuntimeTrustedContractEntry[] = [
    ['contract', value.contract],
    ['provider', value.provider],
    ['model', trustedValue(value.model)],
    ['action', value.action],
    ['credentialReferenceId', trustedValue(value.credentialReferenceId)],
    ['requestId', trustedValue(value.requestId)],
    ['localEndpoint', value.localEndpoint],
    ['promptEstimateChars', value.promptEstimateChars],
    ['transportIdentity', asTrustedObject(value.transportIdentity)],
    ['acceptedProviderExecutionBoundary', value.acceptedProviderExecutionBoundary],
    ['acceptedRuntimeBoundary', value.acceptedRuntimeBoundary],
    ['promptRedaction', value.promptRedaction],
    ['acknowledgedNoPromptEcho', value.acknowledgedNoPromptEcho],
    ['acknowledgedNoBodyEcho', value.acknowledgedNoBodyEcho],
    ['acknowledgedNoHeaderEcho', value.acknowledgedNoHeaderEcho],
    ['acknowledgedNoCredentialMaterial', value.acknowledgedNoCredentialMaterial],
    ['acknowledgedNoNetwork', value.acknowledgedNoNetwork],
    ['acknowledgedNoStorage', value.acknowledgedNoStorage],
    ['acknowledgedNoStreaming', value.acknowledgedNoStreaming],
    ['executable', value.executable],
    ['dispatchAllowed', value.dispatchAllowed],
    ['sideEffectBoundary', value.sideEffectBoundary],
    ...extraEntries,
  ];
  return trustedContractObject<LlmRuntimeInvocationPlan>(entries);
}

function makeInjectedTransport(
  facts: LlmRuntimeInvocationTransportFacts,
  overrides: Partial<LlmRuntimeInvocationInjectedTestDoubleTransport> = {},
  extraEntries: readonly RuntimeTrustedContractEntry[] = [],
): LlmRuntimeInvocationInjectedTestDoubleTransport {
  const value = {
    contract: 'llm-runtime-invocation-injected-test-double-transport-v1-reviewed',
    kind: 'injected-test-double-only',
    provider: facts.provider,
    model: facts.model,
    action: facts.action,
    credentialReferenceId: facts.credentialReferenceId,
    requestId: facts.requestId,
    localEndpoint: facts.localEndpoint,
    promptEstimateChars: facts.promptEstimateChars,
    transportIdentity: makeTransportIdentity(facts.transportIdentity),
    promptRedaction: 'prompt-omitted',
    bodyRedaction: 'body-omitted',
    headersRedaction: 'headers-omitted',
    injectedTestDoubleOnly: true,
    injectedTestDoubleExecutable: false,
    dispatchAllowed: false,
    liveProviderDispatchAllowed: false,
    willCallProvider: false,
    willCallLocalBridge: false,
    willFetch: false,
    willOpenSocket: false,
    willStream: false,
    willMutateStorage: false,
    sideEffectBoundary: INJECTED_TRANSPORT_BOUNDARY,
    ...overrides,
  };
  const entries: RuntimeTrustedContractEntry[] = [
    ['contract', value.contract],
    ['kind', value.kind],
    ['provider', value.provider],
    ['model', trustedValue(value.model)],
    ['action', value.action],
    ['credentialReferenceId', trustedValue(value.credentialReferenceId)],
    ['requestId', trustedValue(value.requestId)],
    ['localEndpoint', value.localEndpoint],
    ['promptEstimateChars', value.promptEstimateChars],
    ['transportIdentity', asTrustedObject(value.transportIdentity)],
    ['promptRedaction', value.promptRedaction],
    ['bodyRedaction', value.bodyRedaction],
    ['headersRedaction', value.headersRedaction],
    ['injectedTestDoubleOnly', value.injectedTestDoubleOnly],
    ['injectedTestDoubleExecutable', value.injectedTestDoubleExecutable],
    ['dispatchAllowed', value.dispatchAllowed],
    ['liveProviderDispatchAllowed', value.liveProviderDispatchAllowed],
    ['willCallProvider', value.willCallProvider],
    ['willCallLocalBridge', value.willCallLocalBridge],
    ['willFetch', value.willFetch],
    ['willOpenSocket', value.willOpenSocket],
    ['willStream', value.willStream],
    ['willMutateStorage', value.willMutateStorage],
    ['sideEffectBoundary', value.sideEffectBoundary],
    ...extraEntries,
  ];
  return trustedContractObject<LlmRuntimeInvocationInjectedTestDoubleTransport>(entries);
}

function liveActivationDecision(
  execution: AssistantProviderExecutionDecision,
  overrides: {
    providerId?: 'local' | 'openai';
    modelId?: string;
    credentialReferenceId?: string;
    acceptedEndpoint?: string;
    estimatedPromptChars?: number;
    maxPromptChars?: number;
  } = {},
): Readonly<LlmProviderLiveActivationDecision> {
  if (
    execution.provider !== 'local'
    || execution.action !== 'send_prompt'
    || !execution.model
    || !execution.credentialReference
    || !execution.localEndpoint
    || execution.promptEstimateChars === undefined
  ) {
    throw new Error('test execution decision is not the expected local prompt decision');
  }
  const providerId = overrides.providerId ?? execution.provider;
  const modelId = overrides.modelId ?? execution.model;
  const credentialReferenceId = overrides.credentialReferenceId ?? execution.credentialReference.id;
  const acceptedEndpoint = overrides.acceptedEndpoint ?? execution.localEndpoint;
  const estimatedPromptChars = overrides.estimatedPromptChars ?? execution.promptEstimateChars;
  const maxPromptChars = overrides.maxPromptChars ?? Math.max(estimatedPromptChars, 20_000);
  const endpointId = 'local-bridge:127.0.0.1:11434/v1';
  const promptBudgetId = 'assistantcaddy-llm-runtime:budget:local';
  const providerModelReview = trustedContractObject([
    ['contract', 'llm-provider-live-provider-model-review-v1'],
    ['reviewState', 'reviewed'],
    ['providerId', providerId],
    ['modelId', modelId],
    ['providerModelReviewed', true],
  ]);
  const runtimeOwnership = trustedContractObject([
    ['contract', 'llm-provider-live-runtime-ownership-v1'],
    ['reviewState', 'reviewed'],
    ['runtimeOwner', 'assistantcaddy-llm-provider-runtime'],
    ['runtimeId', 'assistantcaddy-llm-runtime.v1'],
    ['providerId', providerId],
    ['modelId', modelId],
    ['credentialReferenceId', credentialReferenceId],
    ['endpointId', endpointId],
    ['promptBudgetId', promptBudgetId],
    ['noPromptPersistence', true],
    ['noStreamingBeforeReviewedTransport', true],
    ['runtimeOwnershipReviewed', true],
  ]);
  const endpointProvenance = trustedContractObject([
    ['contract', 'llm-provider-live-endpoint-provenance-v1'],
    ['reviewState', 'reviewed'],
    ['providerId', providerId],
    ['modelId', modelId],
    ['endpointId', endpointId],
    ['acceptedEndpoints', trustedArray([acceptedEndpoint])],
    ['endpointProvenanceReviewed', true],
  ]);
  const promptBudgetProof = trustedContractObject([
    ['contract', 'llm-provider-live-prompt-budget-proof-v1'],
    ['reviewState', 'reviewed'],
    ['providerId', providerId],
    ['modelId', modelId],
    ['promptBudgetId', promptBudgetId],
    ['estimatedPromptChars', estimatedPromptChars],
    ['maxPromptChars', maxPromptChars],
    ['promptBudgetReviewed', true],
    ['promptOmitted', true],
  ]);
  const userApproval = trustedContractObject([
    ['contract', 'llm-provider-live-user-approval-v1'],
    ['reviewState', 'reviewed'],
    ['providerId', providerId],
    ['modelId', modelId],
    ['credentialReferenceId', credentialReferenceId],
    ['endpointId', endpointId],
    ['promptBudgetId', promptBudgetId],
    ['approvedAction', 'llm_provider_call'],
    ['explicitUserApprovalGranted', true],
    ['noAutoCallAcknowledged', true],
    ['approvalReviewed', true],
  ]);
  const noPromptPersistenceGuarantee = trustedContractObject([
    ['contract', 'llm-provider-live-no-prompt-persistence-v1'],
    ['reviewState', 'reviewed'],
    ['providerId', providerId],
    ['modelId', modelId],
    ['runtimeId', 'assistantcaddy-llm-runtime.v1'],
    ['promptPersistence', 'none'],
    ['willPersistPrompt', false],
    ['willLogPrompt', false],
    ['willStoreConversation', false],
    ['noPromptPersistenceReviewed', true],
  ]);
  return evaluateLlmProviderLiveActivationGate(trustedContractObject<Parameters<typeof evaluateLlmProviderLiveActivationGate>[0]>([
    ['providerModelReview', asTrustedObject(providerModelReview)],
    ['runtimeOwnership', asTrustedObject(runtimeOwnership)],
    ['endpointProvenance', asTrustedObject(endpointProvenance)],
    ['promptBudgetProof', asTrustedObject(promptBudgetProof)],
    ['credentialReference', asTrustedObject(credential({
      id: credentialReferenceId,
      providerId,
    }))],
    ['userApproval', asTrustedObject(userApproval)],
    ['noPromptPersistenceGuarantee', asTrustedObject(noPromptPersistenceGuarantee)],
  ]));
}

function trustLiveActivationDecision(
  decision: Readonly<LlmProviderLiveActivationDecision>,
  extraEntries: readonly RuntimeTrustedContractEntry[] = [],
): LlmProviderLiveActivationDecision {
  const entries: RuntimeTrustedContractEntry[] = [
    ['status', decision.status],
    ['mayPrepareLiveActivation', decision.mayPrepareLiveActivation],
    ['activationPlan', decision.activationPlan ? asTrustedObject(decision.activationPlan) : undefined],
    ['blockers', trustedValue(decision.blockers)],
    ['executable', decision.executable],
    ['sideEffects', decision.sideEffects],
    ['willCallLlm', decision.willCallLlm],
    ['willCallProvider', decision.willCallProvider],
    ['willFetch', decision.willFetch],
    ['willOpenSocket', decision.willOpenSocket],
    ['willStream', decision.willStream],
    ['willMutateStorage', decision.willMutateStorage],
    ['willResolveCredentialSecrets', decision.willResolveCredentialSecrets],
    ['willPersistPrompt', decision.willPersistPrompt],
    ['requiresUserApprovalBeforeCall', decision.requiresUserApprovalBeforeCall],
    ['sideEffectBoundary', decision.sideEffectBoundary],
    ...extraEntries,
  ];
  return trustedContractObject<LlmProviderLiveActivationDecision>(entries);
}

function blockedLiveActivationDecision(): LlmProviderLiveActivationDecision {
  const blocker = trustedContractObject([
    ['code', 'user_approval_missing'],
    ['detail', 'Synthetic blocked activation decision.'],
  ]);
  return trustedContractObject<LlmProviderLiveActivationDecision>([
    ['status', 'blocked'],
    ['mayPrepareLiveActivation', false],
    ['activationPlan', undefined],
    ['blockers', trustedArray([asTrustedObject(blocker)])],
    ['executable', false],
    ['sideEffects', 'none'],
    ['willCallLlm', false],
    ['willCallProvider', false],
    ['willFetch', false],
    ['willOpenSocket', false],
    ['willStream', false],
    ['willMutateStorage', false],
    ['willResolveCredentialSecrets', false],
    ['willPersistPrompt', false],
    ['requiresUserApprovalBeforeCall', true],
    ['sideEffectBoundary', 'pure-local-llm-provider-live-activation-gate-no-llm-no-fetch-no-socket-no-stream-no-storage-no-prompt-persistence-no-provider-call'],
  ]);
}

function proxyWithAllTraps() {
  const traps: string[] = [];
  const target = function trustedContractProxyTarget() {
    return undefined;
  };
  const handler: ProxyHandler<typeof target> = {
    getPrototypeOf(value) {
      traps.push('getPrototypeOf');
      return Reflect.getPrototypeOf(value);
    },
    setPrototypeOf(value, prototype) {
      traps.push('setPrototypeOf');
      return Reflect.setPrototypeOf(value, prototype);
    },
    isExtensible(value) {
      traps.push('isExtensible');
      return Reflect.isExtensible(value);
    },
    preventExtensions(value) {
      traps.push('preventExtensions');
      return Reflect.preventExtensions(value);
    },
    getOwnPropertyDescriptor(value, property) {
      traps.push(`getOwnPropertyDescriptor:${String(property)}`);
      return Reflect.getOwnPropertyDescriptor(value, property);
    },
    defineProperty(value, property, descriptor) {
      traps.push(`defineProperty:${String(property)}`);
      return Reflect.defineProperty(value, property, descriptor);
    },
    has(value, property) {
      traps.push(`has:${String(property)}`);
      return Reflect.has(value, property);
    },
    get(value, property, receiver) {
      traps.push(`get:${String(property)}`);
      return Reflect.get(value, property, receiver);
    },
    set(value, property, newValue, receiver) {
      traps.push(`set:${String(property)}`);
      return Reflect.set(value, property, newValue, receiver);
    },
    deleteProperty(value, property) {
      traps.push(`deleteProperty:${String(property)}`);
      return Reflect.deleteProperty(value, property);
    },
    ownKeys(value) {
      traps.push('ownKeys');
      return Reflect.ownKeys(value);
    },
    apply(value, thisArg, argumentsList) {
      traps.push('apply');
      return Reflect.apply(value, thisArg, argumentsList);
    },
    construct(value, argumentsList, newTarget) {
      traps.push('construct');
      return Reflect.construct(value, argumentsList, newTarget);
    },
  };
  return { proxy: new Proxy(target, handler), traps };
}

describe('LLM runtime invocation implementation boundary', () => {
  it('rejects root and nested proxies or accessors before prototype, key, entry, or secret scans execute', async () => {
    const runtimeRootProxy = proxyWithAllTraps();
    const runtimeDecision = evaluateLlmRuntimeInvocationImplementationBoundary(
      runtimeRootProxy.proxy as LlmRuntimeInvocationImplementationInput,
    );
    expect(runtimeDecision).toMatchObject({
      status: 'blocked',
      reason: 'transport_shape_forbidden',
    });
    expect(runtimeRootProxy.traps).toEqual([]);

    const injectedRootProxy = proxyWithAllTraps();
    const injectedDecision = await executeLlmRuntimeInvocationInjectedTestDoubleTransport(
      injectedRootProxy.proxy as LlmRuntimeInvocationInjectedTransportExecutionInput,
    );
    expect(injectedDecision).toMatchObject({
      status: 'blocked',
      reason: 'input_shape_invalid',
    });
    expect(injectedRootProxy.traps).toEqual([]);

    const nestedProxy = proxyWithAllTraps();
    expect(() => trustedContractObject([
      ['transportFacts', nestedProxy.proxy as unknown as RuntimeTrustedContractValue],
    ])).toThrow(TypeError);
    expect(nestedProxy.traps).toEqual([]);

    let rootAccessorCalls = 0;
    const rootAccessor = {};
    Object.defineProperty(rootAccessor, 'providerExecution', {
      enumerable: true,
      get() {
        rootAccessorCalls += 1;
        return providerExecution();
      },
    });
    expect(evaluateLlmRuntimeInvocationImplementationBoundary(
      rootAccessor as LlmRuntimeInvocationImplementationInput,
    )).toMatchObject({
      status: 'blocked',
      reason: 'transport_shape_forbidden',
    });
    expect(rootAccessorCalls).toBe(0);

    let nestedAccessorCalls = 0;
    const nestedAccessor = {};
    Object.defineProperty(nestedAccessor, 'model', {
      enumerable: true,
      get() {
        nestedAccessorCalls += 1;
        return 'llama3.1';
      },
    });
    expect(() => trustedContractObject([
      ['transportFacts', nestedAccessor as unknown as RuntimeTrustedContractValue],
    ])).toThrow(TypeError);
    expect(nestedAccessorCalls).toBe(0);
  });

  it('validates assistant/provider runtime provenance but remains fail-closed without an executable transport contract', async () => {
    const input = gateInput();
    const execution = providerExecution(input);
    const runtime = await runtimeResult(input);
    const facts = makeTransportFacts(execution);
    const plan = makeInvocationPlan(facts);
    const liveActivation = liveActivationDecision(execution);

    const decision = evaluateLlmRuntimeInvocationImplementationBoundary(implementationInput({
      liveActivation,
      providerExecution: execution,
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: plan,
    }));
    const serialized = JSON.stringify(decision);

    expect(execution.status).toBe('allow');
    expect(runtime).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['assistant_provider_gate_not_executable'],
      sideEffectBoundary: RUNTIME_BOUNDARY,
    });
    expect(decision).toMatchObject({
      status: 'blocked',
      implementationBoundaryReady: true,
      reason: 'executable_llm_transport_contract_missing',
      provider: 'local',
      model: 'llama3.1',
      action: 'send_prompt',
      credentialReferenceId: 'local-bridge:assistantcaddy/llm-runtime',
      requestId: 'llm-request-001',
      localEndpoint: 'http://127.0.0.1:11434/v1',
      promptEstimateChars: execution.promptEstimateChars,
      transportIdentity: {
        kind: 'future-reviewed-injected-llm-transport',
        id: 'assistantcaddy-llm-runtime-transport',
        version: '2026.06.12',
        owner: 'assistantcaddy-llm-runtime',
      },
      promptRedaction: 'prompt-omitted',
      canPrepareFutureLlmInvocation: true,
      executable: false,
      dispatchAllowed: false,
      willCallProvider: false,
      willCallLocalBridge: false,
      willFetch: false,
      willOpenSocket: false,
      willStream: false,
      willMutateStorage: false,
      sideEffectBoundary: 'llm-runtime-invocation-implementation-boundary-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call',
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.transportIdentity)).toBe(true);
    expect(serialized).not.toContain('Summarize the selected investigation evidence');
    expect(serialized).not.toContain('Use concise CTI notes');
  });

  it('requires exact live activation evidence bound to the runtime invocation facts', async () => {
    const input = gateInput();
    const execution = providerExecution(input);
    const runtime = await runtimeResult(input);
    const facts = makeTransportFacts(execution);
    const plan = makeInvocationPlan(facts);
    const liveActivation = liveActivationDecision(execution);

    expect(evaluateLlmRuntimeInvocationImplementationBoundary(implementationInput({
      providerExecution: execution,
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: plan,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'live_activation_missing',
      canPrepareFutureLlmInvocation: false,
      executable: false,
    });

    expect(evaluateLlmRuntimeInvocationImplementationBoundary(implementationInput({
      liveActivation: blockedLiveActivationDecision(),
      providerExecution: execution,
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: plan,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'live_activation_not_ready',
      canPrepareFutureLlmInvocation: false,
    });

    expect(evaluateLlmRuntimeInvocationImplementationBoundary(implementationInput({
      liveActivation: trustLiveActivationDecision(liveActivation, [['execute', 'callback-forbidden']]) as never,
      providerExecution: execution,
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: plan,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'live_activation_invalid',
      canPrepareFutureLlmInvocation: false,
      willCallProvider: false,
      willFetch: false,
    });

    for (const mismatchedActivation of [
      liveActivationDecision(execution, { modelId: 'other-model' }),
      liveActivationDecision(execution, { acceptedEndpoint: 'http://127.0.0.1:11435/v1' }),
      liveActivationDecision(execution, {
        estimatedPromptChars: (execution.promptEstimateChars ?? 0) + 1,
        maxPromptChars: 200_000,
      }),
    ]) {
      expect(mismatchedActivation.status).toBe('activation-ready');
      expect(evaluateLlmRuntimeInvocationImplementationBoundary(implementationInput({
        liveActivation: mismatchedActivation,
        providerExecution: execution,
        runtimeResult: runtime,
        transportFacts: facts,
        invocationPlan: plan,
      }))).toMatchObject({
        status: 'blocked',
        reason: 'live_activation_binding_mismatch',
        canPrepareFutureLlmInvocation: false,
        willCallProvider: false,
      });
    }
  });

  it('fails closed when provider execution or runtime evidence is missing, blocked, or forged', async () => {
    const input = gateInput();
    const execution = providerExecution(input);
    const runtime = await runtimeResult(input);
    const facts = makeTransportFacts(execution);
    const plan = makeInvocationPlan(facts);

    expect(evaluateLlmRuntimeInvocationImplementationBoundary(implementationInput({
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: plan,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'provider_execution_missing',
      canPrepareFutureLlmInvocation: false,
    });

    const blockedExecution = providerExecution(gateInput({
      explicitUserAction: undefined,
    }));
    expect(evaluateLlmRuntimeInvocationImplementationBoundary(implementationInput({
      providerExecution: blockedExecution,
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: plan,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'provider_execution_not_ready',
    });

    expect(evaluateLlmRuntimeInvocationImplementationBoundary(implementationInput({
      providerExecution: trustProviderExecution(execution, { executable: true as false }),
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: plan,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'provider_execution_invalid',
      executable: false,
    });

    expect(evaluateLlmRuntimeInvocationImplementationBoundary(implementationInput({
      providerExecution: execution,
      runtimeResult: trustRuntimeResult(runtime, { executed: true as false }),
      transportFacts: facts,
      invocationPlan: plan,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'runtime_result_invalid',
    });
  });

  it('requires exact provider, model, request, prompt budget, local endpoint, and transport identity provenance', async () => {
    const input = gateInput();
    const execution = providerExecution(input);
    const runtime = await runtimeResult(input);
    const facts = makeTransportFacts(execution);

    for (const mismatch of [
      { model: 'other-model' },
      { credentialReferenceId: 'local-bridge:assistantcaddy/other' },
      { promptEstimateChars: (execution.promptEstimateChars ?? 0) + 1 },
      { localEndpoint: 'http://127.0.0.1:11435/v1' },
    ] satisfies Partial<LlmRuntimeInvocationTransportFacts>[]) {
      const decision = evaluateLlmRuntimeInvocationImplementationBoundary(implementationInput({
        providerExecution: execution,
        runtimeResult: runtime,
        transportFacts: makeTransportFacts(execution, mismatch),
        invocationPlan: makeInvocationPlan(makeTransportFacts(execution, mismatch)),
      }));
      expect(decision).toMatchObject({
        status: 'blocked',
        reason: 'provider_owner_mismatch',
        canPrepareFutureLlmInvocation: false,
        executable: false,
        willCallProvider: false,
      });
    }

    expect(evaluateLlmRuntimeInvocationImplementationBoundary(implementationInput({
      providerExecution: execution,
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: makeInvocationPlan(facts, {
        requestId: 'other-request',
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'transport_identity_mismatch',
      canPrepareFutureLlmInvocation: false,
    });

    for (const requestId of ['mailto:user@example.test', 'urn:provider:opaque']) {
      const decision = evaluateLlmRuntimeInvocationImplementationBoundary(implementationInput({
        providerExecution: execution,
        runtimeResult: runtime,
        transportFacts: makeTransportFacts(execution, { requestId }),
        invocationPlan: makeInvocationPlan(facts),
      }));
      expect(decision).toMatchObject({
        status: 'blocked',
        reason: 'transport_facts_invalid',
        canPrepareFutureLlmInvocation: false,
        willCallProvider: false,
        willStream: false,
      });
      expect(JSON.stringify(decision)).not.toContain(requestId);
    }
  });

  it('rejects real transport shapes and result objects without calling them', async () => {
    const input = gateInput();
    const execution = providerExecution(input);
    const runtime = await runtimeResult(input);
    const facts = makeTransportFacts(execution);
    const plan = makeInvocationPlan(facts);
    const transport = {
      execute: vi.fn(),
    };

    expect(evaluateLlmRuntimeInvocationImplementationBoundary({
      providerExecution: execution,
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: plan,
      transport,
    })).toMatchObject({
      status: 'blocked',
      reason: 'transport_shape_forbidden',
      willCallProvider: false,
      willCallLocalBridge: false,
    });
    expect(transport.execute).not.toHaveBeenCalled();

    expect(evaluateLlmRuntimeInvocationImplementationBoundary(implementationInput({
      providerExecution: execution,
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: plan,
      transportResult: trustedContractObject([['requestId', 'future-run-1']]),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'transport_result_forbidden',
    });

    expect(evaluateLlmRuntimeInvocationImplementationBoundary(implementationInput({
      providerExecution: execution,
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: plan,
      transportResult: trustedContractObject([
        ['providerCalled', true],
        ['streamed', true],
      ]),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'transport_result_live_claim',
      willCallProvider: false,
      willStream: false,
    });

    expect(evaluateLlmRuntimeInvocationImplementationBoundary({
      providerExecution: execution,
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: plan,
      fetch: vi.fn(),
      requester: vi.fn(),
      storage: { setItem: vi.fn() },
      liveAction: true,
    } as unknown as Parameters<typeof evaluateLlmRuntimeInvocationImplementationBoundary>[0])).toMatchObject({
      status: 'blocked',
      reason: 'transport_shape_forbidden',
      willCallProvider: false,
      willFetch: false,
    });

    const unsafeTrustedRoot = evaluateLlmRuntimeInvocationImplementationBoundary(
      trustedContractObject<LlmRuntimeInvocationImplementationInput & Record<string, unknown>>([
        ['providerExecution', asTrustedObject(execution)],
        ['runtimeResult', asTrustedObject(runtime)],
        ['transportFacts', asTrustedObject(facts)],
        ['invocationPlan', asTrustedObject(plan)],
        ['fetch', 'Bearer do-not-echo-root-fetch-token'],
      ]),
    );
    expect(unsafeTrustedRoot).toMatchObject({
      status: 'blocked',
      reason: 'transport_shape_forbidden',
      willCallProvider: false,
      willFetch: false,
    });
    expect(JSON.stringify(unsafeTrustedRoot)).not.toContain('do-not-echo');

    const unknownTrustedRoot = evaluateLlmRuntimeInvocationImplementationBoundary(
      trustedContractObject<LlmRuntimeInvocationImplementationInput & Record<string, unknown>>([
        ['providerExecution', asTrustedObject(execution)],
        ['runtimeResult', asTrustedObject(runtime)],
        ['transportFacts', asTrustedObject(facts)],
        ['invocationPlan', asTrustedObject(plan)],
        ['traceId', 'Bearer do-not-echo-root-trace-token'],
      ]),
    );
    expect(unknownTrustedRoot).toMatchObject({
      status: 'blocked',
      reason: 'transport_shape_forbidden',
      willCallProvider: false,
      willFetch: false,
    });
    expect(JSON.stringify(unknownTrustedRoot)).not.toContain('do-not-echo');

    expect(evaluateLlmRuntimeInvocationImplementationBoundary(implementationInput({
      providerExecution: execution,
      runtimeResult: runtime,
      transportFacts: makeTransportFacts(execution, {
        model: trustedContractObject([['nested', 'llama3.1']]) as unknown as string,
      }),
      invocationPlan: plan,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'transport_facts_invalid',
      willCallProvider: false,
    });

    expect(evaluateLlmRuntimeInvocationImplementationBoundary(implementationInput({
      providerExecution: execution,
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: makeInvocationPlan(facts, {
        requestId: ' ',
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'invocation_plan_invalid',
      willCallProvider: false,
    });
  });

  it('rejects secret-bearing provider execution fields and runtime result adapter/live-claim metadata', async () => {
    const input = gateInput();
    const execution = providerExecution(input);
    const runtime = await runtimeResult(input);
    const facts = makeTransportFacts(execution);
    const plan = makeInvocationPlan(facts);

    const secretExecutionDecision = evaluateLlmRuntimeInvocationImplementationBoundary(implementationInput({
      providerExecution: trustProviderExecution(execution, { model: 'sk-secret-provider-model' }),
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: plan,
    }));

    expect(secretExecutionDecision).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
      willCallProvider: false,
      willFetch: false,
    });
    expect(JSON.stringify(secretExecutionDecision)).not.toContain('sk-secret-provider-model');

    expect(evaluateLlmRuntimeInvocationImplementationBoundary(implementationInput({
      providerExecution: execution,
      runtimeResult: trustRuntimeResult(runtime, {}, [
        ['adapterMetadata', trustedContractObject([['adapterId', 'reviewed-runtime-adapter']])],
      ]),
      transportFacts: facts,
      invocationPlan: plan,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'runtime_result_invalid',
      willCallProvider: false,
    });

    expect(evaluateLlmRuntimeInvocationImplementationBoundary(implementationInput({
      providerExecution: execution,
      runtimeResult: trustRuntimeResult(runtime, {}, [['willCallProvider', true]]),
      transportFacts: facts,
      invocationPlan: plan,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'runtime_result_invalid',
      willCallProvider: false,
      willStream: false,
    });
  });

  it('blocks prompt, body, header, and credential echoes without network, provider, streaming, or storage calls', async () => {
    const fetchSpy = vi.fn();
    const webSocketSpy = vi.fn();
    const eventSourceSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', webSocketSpy);
    vi.stubGlobal('EventSource', eventSourceSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');
    const input = gateInput();
    const execution = providerExecution(input);
    const runtime = await runtimeResult(input);
    const facts = makeTransportFacts(execution);

    const promptEcho = evaluateLlmRuntimeInvocationImplementationBoundary(implementationInput({
      providerExecution: execution,
      runtimeResult: runtime,
      transportFacts: makeTransportFacts(execution, {}, [['prompt', 'do not echo this analyst prompt']]),
      invocationPlan: makeInvocationPlan(facts),
    }));
    expect(promptEcho).toMatchObject({
      status: 'blocked',
      reason: 'prompt_or_payload_echo_forbidden',
      executable: false,
      willCallProvider: false,
      willStream: false,
    });

    expect(evaluateLlmRuntimeInvocationImplementationBoundary(implementationInput({
      providerExecution: execution,
      runtimeResult: trustRuntimeResult(runtime, { safeDetail: 'prompt: Summarize the selected investigation evidence.' }),
      transportFacts: facts,
      invocationPlan: makeInvocationPlan(facts),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'prompt_or_payload_echo_forbidden',
      willCallProvider: false,
      willStream: false,
    });

    const rawSecret = evaluateLlmRuntimeInvocationImplementationBoundary(implementationInput({
      providerExecution: execution,
      runtimeResult: runtime,
      transportFacts: makeTransportFacts(execution, {
        requestId: 'sk-do-not-keep-llm-token',
      }),
      invocationPlan: makeInvocationPlan(facts),
    }));
    const serialized = JSON.stringify(rawSecret);

    expect(rawSecret).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
      willCallProvider: false,
      willFetch: false,
      willOpenSocket: false,
      willMutateStorage: false,
    });
    expect(serialized).not.toContain('do-not-keep');
    expect(serialized).not.toContain('llm-token');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(webSocketSpy).not.toHaveBeenCalled();
    expect(eventSourceSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('validates the reviewed injected transport contract and builds a redacted request without executing it', async () => {
    const fetchSpy = vi.fn();
    const webSocketSpy = vi.fn();
    const eventSourceSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', webSocketSpy);
    vi.stubGlobal('EventSource', eventSourceSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');
    const input = gateInput();
    const execution = providerExecution(input);
    const runtime = await runtimeResult(input);
    const facts = makeTransportFacts(execution);
    const plan = makeInvocationPlan(facts);
    const liveActivation = liveActivationDecision(execution);
    const execute = vi.fn();

    const decision = await executeLlmRuntimeInvocationInjectedTestDoubleTransport(injectedExecutionInput({
      liveActivation,
      providerExecution: execution,
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: plan,
      injectedTransport: makeInjectedTransport(facts),
    }));
    const serialized = JSON.stringify(decision);

    expect(execute).not.toHaveBeenCalled();
    expect(decision).toMatchObject({
      status: 'blocked',
      reason: 'injected_transport_execution_disabled',
      provider: 'local',
      model: 'llama3.1',
      action: 'send_prompt',
      credentialReferenceId: 'local-bridge:assistantcaddy/llm-runtime',
      requestId: 'llm-request-001',
      promptRedaction: 'prompt-omitted',
      injectedTestDoubleExecuted: false,
      executable: false,
      dispatchAllowed: false,
      liveProviderDispatchAllowed: false,
      willCallProvider: false,
      willCallLocalBridge: false,
      willFetch: false,
      willOpenSocket: false,
      willStream: false,
      willMutateStorage: false,
      sideEffectBoundary: INJECTED_DECISION_BOUNDARY,
      request: {
        contract: 'llm-runtime-invocation-injected-test-double-request-v1',
        requestId: 'llm-request-001',
        promptRedaction: 'prompt-omitted',
        injectedTestDoubleExecutable: false,
        sideEffectBoundary: INJECTED_REQUEST_BOUNDARY,
      },
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.request)).toBe(true);
    expect(decision.safeResult).toBeUndefined();
    expect(serialized).not.toContain('Summarize the selected investigation evidence');
    expect(serialized).not.toContain('Use concise CTI notes');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(webSocketSpy).not.toHaveBeenCalled();
    expect(eventSourceSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('blocks explicitly enabled injected test-double execution and never calls caller callbacks', async () => {
    const fetchSpy = vi.fn();
    const webSocketSpy = vi.fn();
    const eventSourceSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', webSocketSpy);
    vi.stubGlobal('EventSource', eventSourceSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');
    const input = gateInput();
    const execution = providerExecution(input);
    const runtime = await runtimeResult(input);
    const facts = makeTransportFacts(execution);
    const plan = makeInvocationPlan(facts);
    const liveActivation = liveActivationDecision(execution);
    const execute = vi.fn(() => ({
      safeText: 'prompt: this callback must not run',
      liveAction: true,
    }));

    const decision = await executeLlmRuntimeInvocationInjectedTestDoubleTransport(injectedExecutionInput({
      liveActivation,
      providerExecution: execution,
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: plan,
      injectedTransport: makeInjectedTransport(facts),
      executeInjectedTestDouble: true,
    }));
    const serialized = JSON.stringify(decision);

    expect(execute).not.toHaveBeenCalled();
    expect(decision).toMatchObject({
      status: 'blocked',
      reason: 'injected_transport_execution_disabled',
      provider: 'local',
      model: 'llama3.1',
      action: 'send_prompt',
      credentialReferenceId: 'local-bridge:assistantcaddy/llm-runtime',
      requestId: 'llm-request-001',
      promptRedaction: 'prompt-omitted',
      injectedTestDoubleExecuted: false,
      executable: false,
      dispatchAllowed: false,
      liveProviderDispatchAllowed: false,
      willCallProvider: false,
      willCallLocalBridge: false,
      willFetch: false,
      willOpenSocket: false,
      willStream: false,
      willMutateStorage: false,
      sideEffectBoundary: INJECTED_DECISION_BOUNDARY,
      request: {
        contract: 'llm-runtime-invocation-injected-test-double-request-v1',
        requestId: 'llm-request-001',
        promptRedaction: 'prompt-omitted',
        injectedTestDoubleExecutable: false,
        sideEffectBoundary: INJECTED_REQUEST_BOUNDARY,
      },
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.request)).toBe(true);
    expect(decision.safeResult).toBeUndefined();
    expect(serialized).not.toContain('Summarize the selected investigation evidence');
    expect(serialized).not.toContain('Use concise CTI notes');

    const callbackDecision = await executeLlmRuntimeInvocationInjectedTestDoubleTransport(injectedExecutionInput({
      liveActivation,
      providerExecution: execution,
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: plan,
      injectedTransport: makeInjectedTransport(facts, {}, [['execute', 'callback-forbidden']]) as never,
      executeInjectedTestDouble: true,
    }));
    expect(callbackDecision).toMatchObject({
      status: 'blocked',
      reason: 'injected_transport_callback_forbidden',
      safeResult: undefined,
      injectedTestDoubleExecuted: false,
      willCallProvider: false,
      willMutateStorage: false,
    });
    expect(execute).not.toHaveBeenCalled();
    expect(JSON.stringify(callbackDecision)).not.toContain('this callback must not run');

    const rawCallbackDecision = await executeLlmRuntimeInvocationInjectedTestDoubleTransport({
      liveActivation,
      providerExecution: execution,
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: plan,
      injectedTransport: {
        execute,
      },
      executeInjectedTestDouble: true,
    } as unknown as LlmRuntimeInvocationInjectedTransportExecutionInput);
    expect(rawCallbackDecision).toMatchObject({
      status: 'blocked',
      reason: 'input_shape_invalid',
      injectedTestDoubleExecuted: false,
    });
    expect(execute).not.toHaveBeenCalled();

    const unsafeInjectedRoot = await executeLlmRuntimeInvocationInjectedTestDoubleTransport(
      trustedContractObject<LlmRuntimeInvocationInjectedTransportExecutionInput & Record<string, unknown>>([
        ['liveActivation', asTrustedObject(liveActivation)],
        ['providerExecution', asTrustedObject(execution)],
        ['runtimeResult', asTrustedObject(runtime)],
        ['transportFacts', asTrustedObject(facts)],
        ['invocationPlan', asTrustedObject(plan)],
        ['injectedTransport', asTrustedObject(makeInjectedTransport(facts))],
        ['requester', 'Bearer do-not-echo-injected-requester-token'],
      ]),
    );
    expect(unsafeInjectedRoot).toMatchObject({
      status: 'blocked',
      reason: 'input_shape_invalid',
      injectedTestDoubleExecuted: false,
      willCallProvider: false,
      willFetch: false,
    });
    expect(JSON.stringify(unsafeInjectedRoot)).not.toContain('do-not-echo');

    const unknownInjectedRoot = await executeLlmRuntimeInvocationInjectedTestDoubleTransport(
      trustedContractObject<LlmRuntimeInvocationInjectedTransportExecutionInput & Record<string, unknown>>([
        ['liveActivation', asTrustedObject(liveActivation)],
        ['providerExecution', asTrustedObject(execution)],
        ['runtimeResult', asTrustedObject(runtime)],
        ['transportFacts', asTrustedObject(facts)],
        ['invocationPlan', asTrustedObject(plan)],
        ['injectedTransport', asTrustedObject(makeInjectedTransport(facts))],
        ['traceId', 'Bearer do-not-echo-injected-trace-token'],
      ]),
    );
    expect(unknownInjectedRoot).toMatchObject({
      status: 'blocked',
      reason: 'input_shape_invalid',
      injectedTestDoubleExecuted: false,
      willCallProvider: false,
      willFetch: false,
    });
    expect(JSON.stringify(unknownInjectedRoot)).not.toContain('do-not-echo');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(webSocketSpy).not.toHaveBeenCalled();
    expect(eventSourceSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('rejects missing, unsafe, or mismatched injected transports without executing them', async () => {
    const input = gateInput();
    const execution = providerExecution(input);
    const runtime = await runtimeResult(input);
    const facts = makeTransportFacts(execution);
    const plan = makeInvocationPlan(facts);
    const liveActivation = liveActivationDecision(execution);
    const execute = vi.fn();

    expect(await executeLlmRuntimeInvocationInjectedTestDoubleTransport(injectedExecutionInput({
      liveActivation,
      providerExecution: execution,
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: plan,
      executeInjectedTestDouble: true,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'injected_transport_missing',
      injectedTestDoubleExecuted: false,
    });

    expect(await executeLlmRuntimeInvocationInjectedTestDoubleTransport(injectedExecutionInput({
      liveActivation,
      providerExecution: execution,
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: plan,
      injectedTransport: makeInjectedTransport(facts, {
        requestId: 'other-request',
      }),
      executeInjectedTestDouble: true,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'injected_transport_provenance_mismatch',
      injectedTestDoubleExecuted: false,
    });

    expect(await executeLlmRuntimeInvocationInjectedTestDoubleTransport(injectedExecutionInput({
      liveActivation,
      providerExecution: execution,
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: plan,
      injectedTransport: makeInjectedTransport(facts, {}, [
        ['requester', 'callback-forbidden'],
        ['storage', 'storage-forbidden'],
      ]) as never,
      executeInjectedTestDouble: true,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'injected_transport_callback_forbidden',
      injectedTestDoubleExecuted: false,
      willFetch: false,
      willMutateStorage: false,
    });

    for (const [field, value] of [
      ['fetchPlan', 'https://provider.example/v1/chat/completions'],
      ['socketPlan', 'wss://provider.example/stream'],
      ['storageAdapter', 'localStorage'],
      ['liveAction', true],
      ['streamHandler', 'on-token'],
      ['localBridgeRequester', 'caller-channel'],
      ['httpClient', 'post'],
    ] as const) {
      const decision = await executeLlmRuntimeInvocationInjectedTestDoubleTransport(injectedExecutionInput({
        liveActivation,
        providerExecution: execution,
        runtimeResult: runtime,
        transportFacts: facts,
        invocationPlan: plan,
        injectedTransport: makeInjectedTransport(facts, {}, [[field, value]]) as never,
        executeInjectedTestDouble: true,
      }));
      expect(decision).toMatchObject({
        status: 'blocked',
        reason: 'injected_transport_callback_forbidden',
        injectedTestDoubleExecuted: false,
        safeResult: undefined,
        willCallProvider: false,
        willFetch: false,
        willOpenSocket: false,
        willStream: false,
        willMutateStorage: false,
      });
      expect(JSON.stringify(decision)).not.toContain(String(value));
    }

    expect(await executeLlmRuntimeInvocationInjectedTestDoubleTransport(injectedExecutionInput({
      liveActivation,
      providerExecution: execution,
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: plan,
      injectedTransport: makeInjectedTransport(facts, {
        model: 'sk-secret-test-double-model',
      }),
      executeInjectedTestDouble: true,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
      injectedTestDoubleExecuted: false,
      willFetch: false,
    });

    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects poisoned injected callbacks without invoking prompt, secret, or live-claim result paths', async () => {
    const input = gateInput();
    const execution = providerExecution(input);
    const runtime = await runtimeResult(input);
    const facts = makeTransportFacts(execution);
    const plan = makeInvocationPlan(facts);
    const liveActivation = liveActivationDecision(execution);

    const promptEchoExecute = vi.fn(() => ({
      safeText: 'prompt: Summarize the selected investigation evidence.',
    }));
    const promptEchoDecision = await executeLlmRuntimeInvocationInjectedTestDoubleTransport(injectedExecutionInput({
      liveActivation,
      providerExecution: execution,
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: plan,
      injectedTransport: makeInjectedTransport(facts, {}, [['execute', 'callback-forbidden']]) as never,
      executeInjectedTestDouble: true,
    }));
    expect(promptEchoDecision).toMatchObject({
      status: 'blocked',
      reason: 'injected_transport_callback_forbidden',
      safeResult: undefined,
      injectedTestDoubleExecuted: false,
    });
    expect(JSON.stringify(promptEchoDecision)).not.toContain('Summarize the selected investigation evidence');
    expect(promptEchoExecute).not.toHaveBeenCalled();

    const secretExecute = vi.fn(() => ({
      safeText: 'sk-do-not-return-raw-provider-token',
    }));
    const secretDecision = await executeLlmRuntimeInvocationInjectedTestDoubleTransport(injectedExecutionInput({
      liveActivation,
      providerExecution: execution,
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: plan,
      injectedTransport: makeInjectedTransport(facts, {}, [['execute', 'callback-forbidden']]) as never,
      executeInjectedTestDouble: true,
    }));
    expect(secretDecision).toMatchObject({
      status: 'blocked',
      reason: 'injected_transport_callback_forbidden',
      safeResult: undefined,
      injectedTestDoubleExecuted: false,
    });
    expect(JSON.stringify(secretDecision)).not.toContain('do-not-return');
    expect(secretExecute).not.toHaveBeenCalled();

    const liveClaimExecute = vi.fn(() => ({
      dispatchAllowed: true,
      liveAction: true,
      storageMutated: true,
    }));
    const liveClaimDecision = await executeLlmRuntimeInvocationInjectedTestDoubleTransport(injectedExecutionInput({
      liveActivation,
      providerExecution: execution,
      runtimeResult: runtime,
      transportFacts: facts,
      invocationPlan: plan,
      injectedTransport: makeInjectedTransport(facts, {}, [['execute', 'callback-forbidden']]) as never,
      executeInjectedTestDouble: true,
    }));
    expect(liveClaimDecision).toMatchObject({
      status: 'blocked',
      reason: 'injected_transport_callback_forbidden',
      safeResult: undefined,
      injectedTestDoubleExecuted: false,
      willCallProvider: false,
      willMutateStorage: false,
    });
    expect(liveClaimExecute).not.toHaveBeenCalled();
  });
});
