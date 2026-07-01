import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  executeAssistantProviderRuntimeAction,
  executeLocalBridgeProbeRuntimePlan,
  type AssistantProviderRuntimeFakeStreamAdapter,
  type LocalBridgeProbeInjectedRequesterContract,
  type LocalBridgeProbeRequester,
} from '../lib/assistant-provider-runtime-executor';
import {
  evaluateAssistantProviderExecutionGate,
  type AssistantProviderExecutionDecision,
  type AssistantProviderExecutionGateInput,
  type AssistantProviderExplicitUserActionFact,
} from '../lib/assistant-provider-execution-gate';
import {
  classifyAssistantProviderReadiness,
  type AssistantProviderReadiness,
  type AssistantProviderRoute,
} from '../lib/assistant-provider-readiness';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
import {
  createLocalBridgeDiscoveryPlan,
  type LocalBridgeDiscoveryPlan,
  type LocalBridgeKind,
} from '../lib/local-bridge-discovery';
import {
  evaluateLocalBridgeProbeExecutionGate,
  type LocalBridgeProbeExplicitUserActionFact,
} from '../lib/local-bridge-probe-execution-gate';
import {
  evaluateLlmProviderLiveActivationGate,
  type LlmProviderLiveActivationDecision,
  type LlmProviderLiveEndpointProvenanceFact,
  type LlmProviderLiveNoPromptPersistenceGuaranteeFact,
  type LlmProviderLivePromptBudgetProofFact,
  type LlmProviderLiveProviderModelReviewFact,
  type LlmProviderLiveRuntimeOwnershipFact,
  type LlmProviderLiveUserApprovalFact,
} from '../lib/llm-provider-live-activation-gate';
import {
  evaluateLlmRuntimeActivationPlan,
  type LlmRuntimeActivationPlanDecision,
} from '../lib/llm-runtime-activation-plan';
import {
  evaluateLlmRuntimeInvocationImplementationBoundary,
  type LlmRuntimeInvocationImplementationDecision,
  type LlmRuntimeInvocationPlan,
  type LlmRuntimeInvocationTransportFacts,
} from '../lib/llm-runtime-invocation-implementation-boundary';
import {
  createRuntimeTrustedContractObject,
  isRuntimeTrustedContractObject,
  type RuntimeTrustedContractValue,
} from '../lib/runtime-trusted-contract-object';
import { sendViaFakeProvider } from '../lib/llm-router';

const PROVIDER_EXECUTION_BOUNDARY = 'decision-only-no-fetch-no-socket-no-storage-no-llm' as const;
const RUNTIME_BOUNDARY = 'fail-closed-runtime-facade-no-fetch-no-socket-no-storage-no-llm' as const;
const FACTS_BOUNDARY =
  'llm-transport-facts-only-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call' as const;
const PLAN_BOUNDARY =
  'llm-invocation-plan-only-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call' as const;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function trustedValue(value: unknown): RuntimeTrustedContractValue {
  if (
    value === null
    || value === undefined
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => trustedValue(item));
  if (isRuntimeTrustedContractObject(value)) return value;
  if (typeof value === 'object') return trustedRecord(value as Record<string, unknown>) as RuntimeTrustedContractValue;
  throw new TypeError('Trusted runtime executor fixtures cannot include callable values.');
}

function trustedRecord<T extends Record<string, unknown>>(value: T): T {
  return createRuntimeTrustedContractObject(
    Object.entries(value).map(([key, nested]) => [key, trustedValue(nested)] as const),
  ) as unknown as T;
}

function trustedAssistantRuntimeInput(
  value: Record<string, unknown>,
): Parameters<typeof executeAssistantProviderRuntimeAction>[0] {
  return trustedRecord(value) as unknown as Parameters<typeof executeAssistantProviderRuntimeAction>[0];
}

function trustedExecutionGateInput(
  value: AssistantProviderExecutionGateInput,
): AssistantProviderExecutionGateInput {
  return trustedRecord(value as unknown as Record<string, unknown>) as unknown as AssistantProviderExecutionGateInput;
}

function trustedLocalBridgeRuntimeInput(
  value: Record<string, unknown>,
): Parameters<typeof executeLocalBridgeProbeRuntimePlan>[0] {
  return trustedRecord(value) as unknown as Parameters<typeof executeLocalBridgeProbeRuntimePlan>[0];
}

function reference(overrides: Partial<ConnectorCredentialReference> = {}): ConnectorCredentialReference {
  return {
    schemaVersion: 1,
    kind: 'os-keychain',
    id: 'macos-login:threatcaddy/openai/assistant-provider-runtime',
    storageOwner: 'operating-system',
    providerId: 'openai',
    connectorId: 'assistant-provider-runtime',
    accountId: 'account-1',
    displayName: 'Assistant provider runtime reference',
    createdAt: 1_800_000_000_000,
    ...overrides,
  };
}

function readiness(provider: AssistantProviderRoute = 'openai'): AssistantProviderReadiness {
  const credentialReference = reference({
    providerId: provider,
    ...(provider === 'local'
      ? {
          kind: 'local-bridge',
          id: 'local-bridge:llm/assistant-provider-runtime',
          storageOwner: 'local-bridge',
        }
      : {}),
  });
  const result = classifyAssistantProviderReadiness({
    provider,
    model: provider === 'local' ? 'llama3.1' : 'gpt-4.1',
    credentialReference,
    localEndpointCandidates: provider === 'local' ? ['127.0.0.1:11434/v1'] : undefined,
    explicitUserTestConsent: true,
    explicitUserTestResult: {
      status: 'passed',
      route: provider,
      model: provider === 'local' ? 'llama3.1' : 'gpt-4.1',
      credentialReferenceId: credentialReference.id,
      localEndpoint: provider === 'local' ? 'http://127.0.0.1:11434/v1' : undefined,
      testedAt: 1_800_000_010_000,
    },
  });

  if (result.status !== 'configured') {
    throw new Error(`Expected configured readiness fixture, got ${result.status}: ${result.blockReasons.join(', ')}`);
  }
  return result;
}

function explicitProviderAction(
  action: AssistantProviderExplicitUserActionFact['action'],
  provider: AssistantProviderRoute = 'openai',
): AssistantProviderExplicitUserActionFact {
  return {
    granted: true,
    action,
    provider,
    acknowledgedNoAutoCall: true,
  };
}

function localProviderGateInput(): AssistantProviderExecutionGateInput {
  return {
    action: 'send_prompt',
    readiness: readiness('local'),
    explicitUserAction: {
      ...explicitProviderAction('send_prompt', 'local'),
      model: 'llama3.1',
    },
    prompt: {
      model: 'llama3.1',
      systemPrompt: 'Use concise CTI notes.',
      messages: [
        { role: 'user', content: 'Summarize the selected investigation evidence.' },
      ],
      maxChars: 200_000,
    },
  };
}

function providerModelReview(
  decision: AssistantProviderExecutionDecision,
): LlmProviderLiveProviderModelReviewFact {
  return {
    contract: 'llm-provider-live-provider-model-review-v1',
    reviewState: 'reviewed',
    providerId: decision.provider!,
    modelId: decision.model!,
    providerModelReviewed: true,
  };
}

function runtimeOwnership(
  decision: AssistantProviderExecutionDecision,
): LlmProviderLiveRuntimeOwnershipFact {
  return {
    contract: 'llm-provider-live-runtime-ownership-v1',
    reviewState: 'reviewed',
    runtimeOwner: 'assistantcaddy-llm-provider-runtime',
    runtimeId: 'assistantcaddy-llm-runtime.v1',
    providerId: decision.provider!,
    modelId: decision.model!,
    credentialReferenceId: decision.credentialReference!.id,
    endpointId: 'local-bridge:127.0.0.1:11434/v1',
    promptBudgetId: 'assistantcaddy-llm-runtime:budget:local',
    noPromptPersistence: true,
    noStreamingBeforeReviewedTransport: true,
    runtimeOwnershipReviewed: true,
  };
}

function endpointProvenance(
  decision: AssistantProviderExecutionDecision,
): LlmProviderLiveEndpointProvenanceFact {
  return {
    contract: 'llm-provider-live-endpoint-provenance-v1',
    reviewState: 'reviewed',
    providerId: decision.provider!,
    modelId: decision.model!,
    endpointId: 'local-bridge:127.0.0.1:11434/v1',
    acceptedEndpoints: Object.freeze([decision.localEndpoint!]) as readonly [string],
    endpointProvenanceReviewed: true,
  };
}

function promptBudgetProof(
  decision: AssistantProviderExecutionDecision,
): LlmProviderLivePromptBudgetProofFact {
  return {
    contract: 'llm-provider-live-prompt-budget-proof-v1',
    reviewState: 'reviewed',
    providerId: decision.provider!,
    modelId: decision.model!,
    promptBudgetId: 'assistantcaddy-llm-runtime:budget:local',
    estimatedPromptChars: decision.promptEstimateChars!,
    maxPromptChars: 200_000,
    promptBudgetReviewed: true,
    promptOmitted: true,
  };
}

function userApproval(
  decision: AssistantProviderExecutionDecision,
): LlmProviderLiveUserApprovalFact {
  return {
    contract: 'llm-provider-live-user-approval-v1',
    reviewState: 'reviewed',
    providerId: decision.provider!,
    modelId: decision.model!,
    credentialReferenceId: decision.credentialReference!.id,
    endpointId: 'local-bridge:127.0.0.1:11434/v1',
    promptBudgetId: 'assistantcaddy-llm-runtime:budget:local',
    approvedAction: 'llm_provider_call',
    explicitUserApprovalGranted: true,
    noAutoCallAcknowledged: true,
    approvalReviewed: true,
  };
}

function noPromptPersistenceGuarantee(
  decision: AssistantProviderExecutionDecision,
): LlmProviderLiveNoPromptPersistenceGuaranteeFact {
  return {
    contract: 'llm-provider-live-no-prompt-persistence-v1',
    reviewState: 'reviewed',
    providerId: decision.provider!,
    modelId: decision.model!,
    runtimeId: 'assistantcaddy-llm-runtime.v1',
    promptPersistence: 'none',
    willPersistPrompt: false,
    willLogPrompt: false,
    willStoreConversation: false,
    noPromptPersistenceReviewed: true,
  };
}

function makeTransportFacts(
  decision: AssistantProviderExecutionDecision,
  overrides: Partial<LlmRuntimeInvocationTransportFacts> = {},
): LlmRuntimeInvocationTransportFacts {
  return {
    contract: 'llm-runtime-invocation-transport-facts-v1',
    provider: decision.provider as 'local',
    model: decision.model!,
    action: 'send_prompt',
    credentialReferenceId: decision.credentialReference!.id,
    requestId: 'llm-request-001',
    localEndpoint: decision.localEndpoint,
    promptEstimateChars: decision.promptEstimateChars,
    transportIdentity: {
      kind: 'future-reviewed-injected-llm-transport',
      id: 'assistantcaddy-llm-runtime-transport',
      version: '2026.06.12',
      owner: 'assistantcaddy-llm-runtime',
    },
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
}

function makeInvocationPlan(
  facts: LlmRuntimeInvocationTransportFacts,
  overrides: Partial<LlmRuntimeInvocationPlan> = {},
): LlmRuntimeInvocationPlan {
  return {
    contract: 'llm-runtime-invocation-plan-v1',
    provider: facts.provider,
    model: facts.model,
    action: facts.action,
    credentialReferenceId: facts.credentialReferenceId,
    requestId: facts.requestId,
    localEndpoint: facts.localEndpoint,
    promptEstimateChars: facts.promptEstimateChars,
    transportIdentity: { ...facts.transportIdentity },
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
}

async function llmRuntimeProvenanceFixture(): Promise<{
  gateInput: AssistantProviderExecutionGateInput;
  providerActivation: Readonly<LlmProviderLiveActivationDecision>;
  runtimeActivationPlan: Readonly<LlmRuntimeActivationPlanDecision>;
  invocationBoundary: Readonly<LlmRuntimeInvocationImplementationDecision>;
}> {
  const gateInput = trustedExecutionGateInput(localProviderGateInput());
  const providerExecution = trustedRecord(evaluateAssistantProviderExecutionGate(gateInput) as unknown as Record<string, unknown>) as unknown as AssistantProviderExecutionDecision;
  const runtimeResult = trustedRecord(await executeAssistantProviderRuntimeAction(
    trustedAssistantRuntimeInput({ gateInput }),
  ) as unknown as Record<string, unknown>);
  const transportFacts = makeTransportFacts(providerExecution);
  const invocationPlan = makeInvocationPlan(transportFacts);
  const activationFacts = trustedRecord({
    providerModelReview: providerModelReview(providerExecution),
    runtimeOwnership: runtimeOwnership(providerExecution),
    endpointProvenance: endpointProvenance(providerExecution),
    promptBudgetProof: promptBudgetProof(providerExecution),
    credentialReference: providerExecution.credentialReference!,
    userApproval: userApproval(providerExecution),
    noPromptPersistenceGuarantee: noPromptPersistenceGuarantee(providerExecution),
  } as unknown as Record<string, unknown>) as unknown as {
    providerModelReview: LlmProviderLiveProviderModelReviewFact;
    runtimeOwnership: LlmProviderLiveRuntimeOwnershipFact;
    endpointProvenance: LlmProviderLiveEndpointProvenanceFact;
    promptBudgetProof: LlmProviderLivePromptBudgetProofFact;
    credentialReference: ConnectorCredentialReference;
    userApproval: LlmProviderLiveUserApprovalFact;
    noPromptPersistenceGuarantee: LlmProviderLiveNoPromptPersistenceGuaranteeFact;
  };
  const providerActivation = evaluateLlmProviderLiveActivationGate(activationFacts);
  const invocationInput = trustedRecord({
    liveActivation: providerActivation,
    providerExecution,
    runtimeResult,
    transportFacts: trustedRecord(transportFacts as unknown as Record<string, unknown>),
    invocationPlan: trustedRecord(invocationPlan as unknown as Record<string, unknown>),
  } as unknown as Record<string, unknown>) as unknown as Parameters<typeof evaluateLlmRuntimeInvocationImplementationBoundary>[0];
  const invocationBoundary = evaluateLlmRuntimeInvocationImplementationBoundary(invocationInput);
  const runtimeActivationPlan = evaluateLlmRuntimeActivationPlan(trustedRecord({
    ...activationFacts,
    providerActivation,
    runtimeBoundary: invocationBoundary,
  } as unknown as Record<string, unknown>));

  return {
    gateInput,
    providerActivation,
    runtimeActivationPlan,
    invocationBoundary,
  };
}

function fakeStreamAdapter(
  invocationBoundary: Readonly<LlmRuntimeInvocationImplementationDecision>,
  overrides: Partial<AssistantProviderRuntimeFakeStreamAdapter> = {},
): AssistantProviderRuntimeFakeStreamAdapter {
  return {
    contract: 'assistant-provider-runtime-fake-stream-adapter-v1-reviewed',
    adapterKind: 'deterministic-local-fake-llm',
    provider: 'local',
    model: invocationBoundary.model!,
    requestId: invocationBoundary.requestId!,
    localEndpoint: invocationBoundary.localEndpoint!,
    transportIdentity: invocationBoundary.transportIdentity!,
    promptRedaction: 'prompt-omitted',
    bodyRedaction: 'body-omitted',
    headersRedaction: 'headers-omitted',
    deterministicOutput: true,
    supportsAbortSignal: true,
    injectedTestDoubleOnly: true,
    dispatchAllowed: false,
    liveProviderDispatchAllowed: false,
    willCallProvider: false,
    willCallLocalBridge: false,
    willFetch: false,
    willOpenSocket: false,
    willStream: false,
    willMutateStorage: false,
    sideEffectBoundary: 'assistant-provider-runtime-fake-stream-adapter-no-fetch-no-socket-no-storage-no-provider-no-local-bridge-no-secret',
    ...overrides,
  };
}

function readyPlan(
  bridgeKind: LocalBridgeKind = 'llm',
  candidates: readonly string[] = ['127.0.0.1:11434/v1'],
): LocalBridgeDiscoveryPlan {
  return createLocalBridgeDiscoveryPlan({
    bridgeKind,
    candidates,
    consentGranted: true,
    defaultProbePath: '/health',
  });
}

function explicitProbeAction(
  bridgeKind: LocalBridgeKind = 'llm',
  overrides: Partial<LocalBridgeProbeExplicitUserActionFact> = {},
): LocalBridgeProbeExplicitUserActionFact {
  return {
    action: 'probe_local_bridge',
    bridgeKind,
    granted: true,
    acknowledgedPlanOnly: true,
    ...overrides,
  };
}

function probeGateInput(plan: LocalBridgeDiscoveryPlan) {
  return {
    expectedBridgeKind: plan.bridgeKind,
    discoveryPlan: plan,
    explicitUserAction: explicitProbeAction(plan.bridgeKind),
  };
}

function allowedProbePlan(plan: LocalBridgeDiscoveryPlan) {
  const decision = evaluateLocalBridgeProbeExecutionGate(probeGateInput(plan));
  if (!decision.probePlan) throw new Error(`Expected allowed probe fixture, got ${decision.blockReasons.join(', ')}`);
  return decision.probePlan;
}

function reviewedRequesterContract(
  probePlan: ReturnType<typeof allowedProbePlan>,
  requester: LocalBridgeProbeRequester = vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    elapsedMs: 12.9,
  })),
  overrides: Partial<LocalBridgeProbeInjectedRequesterContract> = {},
): LocalBridgeProbeInjectedRequesterContract {
  return {
    contract: 'local-bridge-probe-runtime-injected-requester-v1-reviewed',
    injectionMode: 'explicit-reviewed-injected-requester',
    requesterKind: 'local-bridge-loopback-health-probe',
    acceptedEndpoint: probePlan.acceptedEndpoint,
    method: probePlan.method,
    url: probePlan.url,
    timeoutMs: probePlan.timeoutMs,
    request: requester,
    allowsHeaders: false,
    allowsBody: false,
    allowsCredentials: false,
    allowsProviderCall: false,
    allowsStorageMutation: false,
    sideEffectBoundary: 'runtime-facade-reviewed-injected-requester-loopback-probe-only-no-direct-fetch-no-socket-no-storage-no-provider-no-credentials',
    ...overrides,
  };
}

describe('Assistant provider runtime executor facade', () => {
  it('rejects untrusted proxy and accessor Assistant provider roots without executing traps or getters', async () => {
    const trapCounts = {
      get: 0,
      ownKeys: 0,
      getOwnPropertyDescriptor: 0,
      getPrototypeOf: 0,
    };
    const proxyRoot = new Proxy({ gateInput: localProviderGateInput() }, {
      get(target, key, receiver) {
        trapCounts.get += 1;
        return Reflect.get(target, key, receiver);
      },
      ownKeys(target) {
        trapCounts.ownKeys += 1;
        return Reflect.ownKeys(target);
      },
      getOwnPropertyDescriptor(target, key) {
        trapCounts.getOwnPropertyDescriptor += 1;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
      getPrototypeOf(target) {
        trapCounts.getPrototypeOf += 1;
        return Reflect.getPrototypeOf(target);
      },
    });

    const proxyResult = await executeAssistantProviderRuntimeAction(proxyRoot as never);

    expect(proxyResult).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['assistant_provider_runtime_input_shape_forbidden'],
    });
    expect(trapCounts).toEqual({
      get: 0,
      ownKeys: 0,
      getOwnPropertyDescriptor: 0,
      getPrototypeOf: 0,
    });

    let getterCalls = 0;
    const accessorRoot = {};
    Object.defineProperty(accessorRoot, 'gateInput', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return localProviderGateInput();
      },
    });

    const accessorResult = await executeAssistantProviderRuntimeAction(accessorRoot as never);

    expect(accessorResult).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['assistant_provider_runtime_input_shape_forbidden'],
    });
    expect(getterCalls).toBe(0);
  });

  it('rejects untrusted proxy and accessor local bridge roots without executing traps or getters', async () => {
    const plan = readyPlan();
    const trapCounts = {
      get: 0,
      ownKeys: 0,
      getOwnPropertyDescriptor: 0,
      getPrototypeOf: 0,
    };
    const proxyRoot = new Proxy({ gateInput: probeGateInput(plan), probePlan: allowedProbePlan(plan) }, {
      get(target, key, receiver) {
        trapCounts.get += 1;
        return Reflect.get(target, key, receiver);
      },
      ownKeys(target) {
        trapCounts.ownKeys += 1;
        return Reflect.ownKeys(target);
      },
      getOwnPropertyDescriptor(target, key) {
        trapCounts.getOwnPropertyDescriptor += 1;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
      getPrototypeOf(target) {
        trapCounts.getPrototypeOf += 1;
        return Reflect.getPrototypeOf(target);
      },
    });

    const proxyResult = await executeLocalBridgeProbeRuntimePlan(proxyRoot as never);

    expect(proxyResult).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['local_bridge_runtime_input_shape_forbidden'],
    });
    expect(trapCounts).toEqual({
      get: 0,
      ownKeys: 0,
      getOwnPropertyDescriptor: 0,
      getPrototypeOf: 0,
    });

    let getterCalls = 0;
    const accessorRoot = {};
    Object.defineProperty(accessorRoot, 'gateInput', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return probeGateInput(plan);
      },
    });

    const accessorResult = await executeLocalBridgeProbeRuntimePlan(accessorRoot as never);

    expect(accessorResult).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['local_bridge_runtime_input_shape_forbidden'],
    });
    expect(getterCalls).toBe(0);
  });

  it('keeps allowed Assistant provider actions blocked while the gate remains plan-only executable false', async () => {
    const adapter = {
      contract: 'assistant-provider-runtime-adapter-v1-reviewed' as const,
      execute: vi.fn(),
    };
    const decision = evaluateAssistantProviderExecutionGate(trustedExecutionGateInput({
      action: 'send_prompt',
      readiness: readiness(),
      explicitUserAction: explicitProviderAction('send_prompt'),
      prompt: {
        messages: [{ role: 'user', content: 'Summarize this fixture.' }],
      },
    }));

    expect(decision).toMatchObject({
      status: 'allow',
      executable: false,
      blockReasons: [],
    });

    const result = await executeAssistantProviderRuntimeAction(trustedAssistantRuntimeInput({
      gateInput: {
        action: 'send_prompt',
        readiness: readiness(),
        explicitUserAction: explicitProviderAction('send_prompt'),
        prompt: {
          messages: [{ role: 'user', content: 'Summarize this fixture.' }],
        },
      },
    }));

    expect(result).toMatchObject({
      status: 'block',
      executed: false,
      action: 'send_prompt',
      provider: 'openai',
      model: 'gpt-4.1',
      blockReasons: ['assistant_provider_gate_not_executable'],
      gateBlockReasons: [],
      sideEffectBoundary: 'fail-closed-runtime-facade-no-fetch-no-socket-no-storage-no-llm',
    });
    expect(adapter.execute).not.toHaveBeenCalled();
  });

  it('accepts reviewed LLM runtime provenance as inert metadata while keeping provider dispatch disabled', async () => {
    const {
      gateInput,
      providerActivation,
      runtimeActivationPlan,
      invocationBoundary,
    } = await llmRuntimeProvenanceFixture();
    const adapter = {
      contract: 'assistant-provider-runtime-adapter-v1-reviewed' as const,
      execute: vi.fn(),
    };

    const result = await executeAssistantProviderRuntimeAction(trustedAssistantRuntimeInput({
      gateInput,
      providerActivation,
      invocationBoundary,
    }));
    const serialized = JSON.stringify(result);

    expect(result).toMatchObject({
      status: 'block',
      executed: false,
      action: 'send_prompt',
      provider: 'local',
      model: 'llama3.1',
      localEndpoint: 'http://127.0.0.1:11434/v1',
      credentialReferenceId: 'local-bridge:llm/assistant-provider-runtime',
      blockReasons: ['assistant_provider_gate_not_executable'],
      gateBlockReasons: [],
      sideEffectBoundary: 'fail-closed-runtime-facade-no-fetch-no-socket-no-storage-no-llm',
    });
    expect(providerActivation.status).toBe('activation-ready');
    expect(runtimeActivationPlan).toMatchObject({
      status: 'implementation-plan-ready',
      reason: 'implementation_plan_ready',
    });
    expect(invocationBoundary.implementationBoundaryReady).toBe(true);
    expect(adapter.execute).not.toHaveBeenCalled();
    expect(serialized).not.toContain('Summarize the selected investigation evidence');
    expect(serialized).not.toContain('Use concise CTI notes');
  });

  it('executes only the reviewed fake local LLM runtime path and returns redacted chunk metadata', async () => {
    const {
      gateInput,
      providerActivation,
      runtimeActivationPlan,
      invocationBoundary,
    } = await llmRuntimeProvenanceFixture();
    const fetchSpy = vi.fn();
    const webSocketSpy = vi.fn();
    const eventSourceSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', webSocketSpy);
    vi.stubGlobal('EventSource', eventSourceSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');

    const result = await executeAssistantProviderRuntimeAction(trustedAssistantRuntimeInput({
      gateInput,
      fakeAdapter: fakeStreamAdapter(invocationBoundary),
      providerActivation,
      runtimeActivationPlan,
      invocationBoundary,
    }));
    const serialized = JSON.stringify(result);

    expect(result).toMatchObject({
      status: 'fake_executed',
      executed: true,
      action: 'send_prompt',
      provider: 'local',
      model: 'llama3.1',
      localEndpoint: 'http://127.0.0.1:11434/v1',
      credentialReferenceId: 'local-bridge:llm/assistant-provider-runtime',
      blockReasons: [],
      gateBlockReasons: [],
      promptRedaction: 'prompt-omitted',
      bodyRedaction: 'body-omitted',
      headersRedaction: 'headers-omitted',
      cancellationContract: 'abort-signal-before-or-between-fake-chunks',
      sideEffectBoundary: 'fake-local-runtime-facade-no-fetch-no-socket-no-storage-no-provider-no-local-bridge-no-secret',
    });
    expect(result.fakeStreamChunks?.join('')).toBe(
      'ThreatCaddy fake LLM runtime accepted redacted local metadata without provider transport.',
    );
    expect(serialized).not.toContain('Summarize the selected investigation evidence');
    expect(serialized).not.toContain('Use concise CTI notes');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(webSocketSpy).not.toHaveBeenCalled();
    expect(eventSourceSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();

    const mismatched = await executeAssistantProviderRuntimeAction(trustedAssistantRuntimeInput({
      gateInput,
      fakeAdapter: fakeStreamAdapter(invocationBoundary, { requestId: 'other-request' }),
      providerActivation,
      runtimeActivationPlan,
      invocationBoundary,
    }));

    expect(mismatched).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['assistant_provider_runtime_provenance_mismatch'],
    });
  });

  it('rejects fake local LLM runtime execution when any required evidence link is missing', async () => {
    const {
      gateInput,
      providerActivation,
      runtimeActivationPlan,
      invocationBoundary,
    } = await llmRuntimeProvenanceFixture();
    const fetchSpy = vi.fn();
    const webSocketSpy = vi.fn();
    const eventSourceSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', webSocketSpy);
    vi.stubGlobal('EventSource', eventSourceSpy);

    const baseInput: Record<string, unknown> = {
      gateInput,
      fakeAdapter: fakeStreamAdapter(invocationBoundary),
      providerActivation,
      runtimeActivationPlan,
      invocationBoundary,
    };
    const cases: ReadonlyArray<{
      field: keyof typeof baseInput;
      expectedBlockReason: string;
    }> = [
      {
        field: 'providerActivation',
        expectedBlockReason: 'assistant_provider_runtime_provenance_missing',
      },
      {
        field: 'runtimeActivationPlan',
        expectedBlockReason: 'assistant_provider_runtime_provenance_missing',
      },
      {
        field: 'invocationBoundary',
        expectedBlockReason: 'assistant_provider_runtime_provenance_missing',
      },
      {
        field: 'fakeAdapter',
        expectedBlockReason: 'assistant_provider_gate_not_executable',
      },
    ];

    for (const { field, expectedBlockReason } of cases) {
      const input = { ...baseInput };
      delete input[field];

      const result = await executeAssistantProviderRuntimeAction(trustedAssistantRuntimeInput(input));

      expect(result).toMatchObject({
        status: 'block',
        executed: false,
        blockReasons: [expectedBlockReason],
        sideEffectBoundary: 'fail-closed-runtime-facade-no-fetch-no-socket-no-storage-no-llm',
      });
      expect(result.fakeStreamChunks).toBeUndefined();
      expect(JSON.stringify(result)).not.toContain('Summarize the selected investigation evidence');
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(webSocketSpy).not.toHaveBeenCalled();
    expect(eventSourceSpy).not.toHaveBeenCalled();
  });

  it('streams and cancels deterministic fake router output without provider transport or prompt echo', async () => {
    const fetchSpy = vi.fn();
    const webSocketSpy = vi.fn();
    const eventSourceSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', webSocketSpy);
    vi.stubGlobal('EventSource', eventSourceSpy);
    const chunks: string[] = [];
    const done = vi.fn();
    const error = vi.fn();

    const requestId = sendViaFakeProvider({
      provider: 'fake',
      model: 'fixture-model',
      messages: [{ role: 'user', content: 'Summarize sensitive local notes without echoing them.' }],
      systemPrompt: 'Never echo this test system prompt.',
      tools: [{ name: 'search_notes', description: 'Search notes', input_schema: { type: 'object' } }],
    }, {
      onChunk: (chunk) => chunks.push(chunk),
      onDone: done,
      onError: error,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(requestId).toBeTruthy();
    expect(chunks.join('')).toBe('ThreatCaddy fake LLM runtime streamed redacted metadata for fake/fixture-model.');
    expect(done).toHaveBeenCalledWith(
      'end_turn',
      [expect.objectContaining({
        type: 'text',
        redaction: 'prompt-body-header-omitted',
        sideEffectBoundary: 'fake-llm-router-no-fetch-no-socket-no-storage-no-provider-no-local-bridge-no-secret',
      })],
      { input: 0, output: 79 },
    );
    expect(JSON.stringify(done.mock.calls)).not.toContain('Summarize sensitive local notes');
    expect(JSON.stringify(done.mock.calls)).not.toContain('Never echo this test system prompt');
    expect(error).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(webSocketSpy).not.toHaveBeenCalled();
    expect(eventSourceSpy).not.toHaveBeenCalled();

    const abortController = new AbortController();
    const abortedDone = vi.fn();
    const abortedChunks: string[] = [];
    sendViaFakeProvider({
      provider: 'fake',
      model: 'fixture-model',
      messages: [{ role: 'user', content: 'cancel me' }],
    }, {
      onChunk: (chunk) => {
        abortedChunks.push(chunk);
        abortController.abort();
      },
      onDone: abortedDone,
      onError: error,
    }, abortController.signal);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(abortedChunks).toEqual(['ThreatCaddy fake LLM runtime ']);
    expect(abortedDone).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();

    sendViaFakeProvider({
      provider: 'fake',
      model: 'fixture-model',
      messages: [{ role: 'user', content: 'Bearer do-not-use-this-secret-token' }],
    }, {
      onChunk: (chunk) => chunks.push(chunk),
      onDone: done,
      onError: error,
    });
    expect(error).toHaveBeenLastCalledWith('Fake LLM runtime rejected secret-bearing input');
  });

  it('rejects forged provider/runtime claims and caller-provided runtime results before adapter handoff', async () => {
    const {
      gateInput,
      providerActivation,
      runtimeActivationPlan,
      invocationBoundary,
    } = await llmRuntimeProvenanceFixture();
    const adapter = {
      contract: 'assistant-provider-runtime-adapter-v1-reviewed' as const,
      execute: vi.fn(),
    };

    const forgedRuntimeResult = await executeAssistantProviderRuntimeAction(trustedAssistantRuntimeInput({
      gateInput,
      runtimeResult: {
        status: 'executed',
        executed: true,
        providerCalled: true,
      },
    }));

    expect(forgedRuntimeResult).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: expect.arrayContaining([
        'assistant_provider_runtime_result_forbidden',
        'assistant_provider_runtime_live_claim_forbidden',
      ]),
    });
    expect(adapter.execute).not.toHaveBeenCalled();

    const forgedStream = await executeAssistantProviderRuntimeAction(trustedAssistantRuntimeInput({
      gateInput,
      providerActivation,
      runtimeActivationPlan: {
        ...runtimeActivationPlan,
        implementationPlan: {
          ...runtimeActivationPlan.implementationPlan!,
          willStream: true,
        },
      } as never,
      invocationBoundary,
    }));

    expect(forgedStream).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: expect.arrayContaining([
        'assistant_provider_runtime_live_claim_forbidden',
        'assistant_provider_runtime_provenance_invalid',
      ]),
    });
    expect(adapter.execute).not.toHaveBeenCalled();

    const endpointDrift = await executeAssistantProviderRuntimeAction(trustedAssistantRuntimeInput({
      gateInput,
      providerActivation,
      runtimeActivationPlan: {
        ...runtimeActivationPlan,
        implementationPlan: {
          ...runtimeActivationPlan.implementationPlan!,
          acceptedEndpoint: 'http://127.0.0.1:8766/v1',
        },
      } as never,
      invocationBoundary,
    }));

    expect(endpointDrift).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: expect.arrayContaining(['assistant_provider_runtime_provenance_mismatch']),
    });
    expect(adapter.execute).not.toHaveBeenCalled();
  });

  it('rejects allowed-field object/function poisoning before any callable handoff', async () => {
    const {
      gateInput,
      providerActivation,
      runtimeActivationPlan,
      invocationBoundary,
    } = await llmRuntimeProvenanceFixture();
    const hiddenCallable = vi.fn();
    const adapter = {
      contract: 'assistant-provider-runtime-adapter-v1-reviewed' as const,
      execute: vi.fn(),
    };

    const poisonedProviderActivation = await executeAssistantProviderRuntimeAction({
      gateInput,
      adapter,
      providerActivation: {
        ...providerActivation,
        activationPlan: {
          ...providerActivation.activationPlan!,
          sideEffectBoundary: {
            value: 'plan-only-no-llm-no-fetch-no-socket-no-stream-no-storage-no-prompt-persistence-no-provider-call',
            execute: hiddenCallable,
          },
        },
      } as never,
      runtimeActivationPlan,
      invocationBoundary,
    });

    expect(poisonedProviderActivation).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['assistant_provider_runtime_input_shape_forbidden'],
    });
    expect(hiddenCallable).not.toHaveBeenCalled();
    expect(adapter.execute).not.toHaveBeenCalled();

    const poisonedInvocationBoundary = await executeAssistantProviderRuntimeAction({
      gateInput,
      adapter,
      providerActivation,
      runtimeActivationPlan,
      invocationBoundary: {
        ...invocationBoundary,
        transportIdentity: {
          ...invocationBoundary.transportIdentity!,
          owner: {
            value: 'assistantcaddy-llm-runtime',
            onResult: hiddenCallable,
          },
        },
      } as never,
    });

    expect(poisonedInvocationBoundary).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['assistant_provider_runtime_input_shape_forbidden'],
    });
    expect(hiddenCallable).not.toHaveBeenCalled();
    expect(adapter.execute).not.toHaveBeenCalled();
  });

  it('blocks mismatched adapter contracts without calling the adapter while runtime execution is source-gated', async () => {
    const {
      gateInput,
      providerActivation,
      runtimeActivationPlan,
      invocationBoundary,
    } = await llmRuntimeProvenanceFixture();
    const execute = vi.fn();

    const result = await executeAssistantProviderRuntimeAction({
      gateInput,
      adapter: {
        contract: 'assistant-provider-runtime-adapter-v2-unreviewed',
        execute,
      } as never,
      providerActivation,
      runtimeActivationPlan,
      invocationBoundary,
    });

    expect(result).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: expect.arrayContaining([
        'assistant_provider_runtime_input_shape_forbidden',
      ]),
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects prompt/header/body leakage, token-bearing metadata, and unsafe runtime hooks', async () => {
    const {
      gateInput,
      providerActivation,
      runtimeActivationPlan,
      invocationBoundary,
    } = await llmRuntimeProvenanceFixture();
    const adapter = {
      contract: 'assistant-provider-runtime-adapter-v1-reviewed' as const,
      execute: vi.fn(),
    };

    const promptLeak = await executeAssistantProviderRuntimeAction(trustedAssistantRuntimeInput({
      gateInput,
      providerActivation: {
        ...providerActivation,
        activationPlan: {
          ...providerActivation.activationPlan!,
          acceptedEndpoint: 'http://127.0.0.1:11434/v1?prompt=Summarize-this',
        },
      } as never,
      runtimeActivationPlan,
      invocationBoundary,
    }));
    const promptLeakSerialized = JSON.stringify(promptLeak);

    expect(promptLeak).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: expect.arrayContaining([
        'assistant_provider_runtime_prompt_or_payload_echo_forbidden',
        'assistant_provider_runtime_provenance_invalid',
      ]),
    });
    expect(promptLeakSerialized).not.toContain('Summarize-this');
    expect(adapter.execute).not.toHaveBeenCalled();

    const secretEndpoint = await executeAssistantProviderRuntimeAction(trustedAssistantRuntimeInput({
      gateInput,
      providerActivation: {
        ...providerActivation,
        activationPlan: {
          ...providerActivation.activationPlan!,
          acceptedEndpoint: 'http://127.0.0.1:11434/v1?api_key=synthetic-secret',
        },
      } as never,
    }));
    const secretSerialized = JSON.stringify(secretEndpoint);

    expect(secretEndpoint).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: expect.arrayContaining([
        'assistant_provider_runtime_secret_material',
        'assistant_provider_runtime_provenance_invalid',
      ]),
    });
    expect(secretSerialized).not.toContain('synthetic-secret');
    expect(adapter.execute).not.toHaveBeenCalled();

    const rootFetch = vi.fn();
    const unsafeRoot = await executeAssistantProviderRuntimeAction({
      gateInput,
      fetch: rootFetch,
    } as never);

    expect(unsafeRoot).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['assistant_provider_runtime_input_shape_forbidden'],
    });
    expect(rootFetch).not.toHaveBeenCalled();

    const unsafeNestedRuntimeField = await executeAssistantProviderRuntimeAction(trustedAssistantRuntimeInput({
      gateInput,
      providerActivation: {
        ...providerActivation,
        activationPlan: {
          ...providerActivation.activationPlan!,
          httpClient: 'https://provider.example/v1/chat/completions',
        },
      } as never,
      runtimeActivationPlan,
      invocationBoundary,
    }));
    expect(unsafeNestedRuntimeField).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: expect.arrayContaining([
        'assistant_provider_runtime_input_shape_forbidden',
        'assistant_provider_runtime_provenance_invalid',
      ]),
    });
    expect(JSON.stringify(unsafeNestedRuntimeField)).not.toContain('provider.example');
    expect(adapter.execute).not.toHaveBeenCalled();

    const urlShapedInvocationId = await executeAssistantProviderRuntimeAction(trustedAssistantRuntimeInput({
      gateInput,
      providerActivation,
      runtimeActivationPlan,
      invocationBoundary: {
        ...invocationBoundary,
        requestId: '127.0.0.1:11434/v1',
      } as never,
    }));
    expect(urlShapedInvocationId).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: expect.arrayContaining(['assistant_provider_runtime_provenance_invalid']),
    });
    expect(adapter.execute).not.toHaveBeenCalled();

    for (const requestId of ['mailto:user@example.test', 'urn:provider:opaque']) {
      const schemeShapedInvocationId = await executeAssistantProviderRuntimeAction(trustedAssistantRuntimeInput({
        gateInput,
        providerActivation,
        runtimeActivationPlan,
        invocationBoundary: {
          ...invocationBoundary,
          requestId,
        } as never,
      }));
      expect(schemeShapedInvocationId).toMatchObject({
        status: 'block',
        executed: false,
        blockReasons: expect.arrayContaining(['assistant_provider_runtime_provenance_invalid']),
      });
      expect(JSON.stringify(schemeShapedInvocationId)).not.toContain(requestId);
    }
  });

  it('returns a safe block when the Assistant provider gate rejects ownership drift', async () => {
    const result = await executeAssistantProviderRuntimeAction(trustedAssistantRuntimeInput({
      gateInput: {
        action: 'send_prompt',
        readiness: readiness(),
        credentialReference: reference({
          id: 'macos-login:threatcaddy/local/assistant-provider-runtime',
          providerId: 'local',
        }),
        explicitUserAction: explicitProviderAction('send_prompt'),
        prompt: {
          messages: [{ role: 'user', content: 'hello' }],
        },
      },
    }));

    expect(result).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['assistant_provider_gate_blocked'],
      gateBlockReasons: expect.arrayContaining([
        'credential_reference_mismatch',
        'readiness_credential_mismatch',
      ]),
    });
  });

  it('rejects raw secret material before any Assistant provider adapter handoff without echoing it', async () => {
    const adapter = {
      contract: 'assistant-provider-runtime-adapter-v1-reviewed' as const,
      execute: vi.fn(),
    };

    const result = await executeAssistantProviderRuntimeAction(trustedAssistantRuntimeInput({
      gateInput: {
        action: 'send_prompt',
        readiness: readiness(),
        explicitUserAction: explicitProviderAction('send_prompt'),
        prompt: {
          messages: [{ role: 'user', content: 'Bearer synthetic-secret-token' }],
        },
      },
    }));

    expect(result).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['raw_secret_material'],
    });
    expect(adapter.execute).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('synthetic-secret-token');
  });

  it('keeps local bridge probe requester execution plan-only even with an exact valid-looking requester contract', async () => {
    const fetchSpy = vi.fn();
    const websocketSpy = vi.fn();
    const eventSourceSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', websocketSpy);
    vi.stubGlobal('EventSource', eventSourceSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');
    const plan = readyPlan();
    const probePlan = allowedProbePlan(plan);
    const requester: LocalBridgeProbeRequester = vi.fn(async (request) => ({
      ok: true,
      status: request.method === 'GET' ? 200 : 405,
      statusText: 'OK',
      elapsedMs: 12.9,
    }));
    const requesterContract = reviewedRequesterContract(probePlan, requester);

    const result = await executeLocalBridgeProbeRuntimePlan({
      gateInput: probeGateInput(plan),
      probePlan,
      requester: requesterContract,
    });

    expect(result).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['local_bridge_runtime_input_shape_forbidden'],
      safeDetail: 'local bridge runtime input failed exact validation before requester handoff',
    });
    expect(requester).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(websocketSpy).not.toHaveBeenCalled();
    expect(eventSourceSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('keeps local bridge probe execution plan-only when the requester is missing', async () => {
    const plan = readyPlan();

    await expect(executeLocalBridgeProbeRuntimePlan(trustedLocalBridgeRuntimeInput({
      gateInput: probeGateInput(plan),
      probePlan: allowedProbePlan(plan),
    }))).resolves.toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['local_bridge_requester_execution_disabled'],
      gateBlockReasons: [],
      safeDetail: 'local bridge requester execution remains plan-only until a non-forgeable callable boundary exists',
    });
  });

  it('blocks unsafe local bridge runtime root fields and malformed requester claims', async () => {
    const plan = readyPlan();
    const probePlan = allowedProbePlan(plan);
    const requester = vi.fn();
    const fetchClaim = vi.fn();

    const unsafeRoot = await executeLocalBridgeProbeRuntimePlan({
      gateInput: probeGateInput(plan),
      probePlan,
      requester,
      fetch: fetchClaim,
    } as never);

    expect(unsafeRoot).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['local_bridge_runtime_input_shape_forbidden'],
    });
    expect(requester).not.toHaveBeenCalled();
    expect(fetchClaim).not.toHaveBeenCalled();

    const malformedRequester = await executeLocalBridgeProbeRuntimePlan({
      gateInput: probeGateInput(plan),
      probePlan,
      requester: {
        callback: 'http://127.0.0.1:11434/callback',
      },
    } as never);

    expect(malformedRequester).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['local_bridge_runtime_input_shape_forbidden'],
    });

    const driftedRequester = vi.fn();
    const requesterDrift = await executeLocalBridgeProbeRuntimePlan({
      gateInput: probeGateInput(plan),
      probePlan,
      requester: reviewedRequesterContract(probePlan, driftedRequester, {
        url: 'http://127.0.0.1:11434/other-health',
      }),
    });

    expect(requesterDrift).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['local_bridge_runtime_input_shape_forbidden'],
      safeDetail: 'local bridge runtime input failed exact validation before requester handoff',
    });
    expect(driftedRequester).not.toHaveBeenCalled();

    const secretContractRequester = vi.fn();
    const secretRequester = await executeLocalBridgeProbeRuntimePlan({
      gateInput: probeGateInput(plan),
      probePlan,
      requester: reviewedRequesterContract(probePlan, secretContractRequester, {
        acceptedEndpoint: 'http://127.0.0.1:11434/v1?api_key=synthetic-secret',
      }),
    });

    expect(secretRequester).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['local_bridge_runtime_input_shape_forbidden'],
    });
    expect(secretContractRequester).not.toHaveBeenCalled();
    expect(JSON.stringify(secretRequester)).not.toContain('synthetic-secret');
  });

  it('blocks changed local bridge probe plans before requester handoff', async () => {
    const plan = readyPlan();
    const requester = vi.fn();
    const probePlan = allowedProbePlan(plan);

    const result = await executeLocalBridgeProbeRuntimePlan(trustedLocalBridgeRuntimeInput({
      gateInput: probeGateInput(plan),
      probePlan: {
        ...probePlan,
        url: 'http://127.0.0.1:8766/health',
      },
    }));

    expect(result).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['local_bridge_probe_plan_mismatch'],
    });
    expect(requester).not.toHaveBeenCalled();

    const shapeMismatch = await executeLocalBridgeProbeRuntimePlan(trustedLocalBridgeRuntimeInput({
      gateInput: probeGateInput(plan),
      probePlan: {
        ...probePlan,
        callbackUrl: 'http://127.0.0.1:11434/callback',
      } as never,
    }));

    expect(shapeMismatch).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['local_bridge_probe_plan_mismatch'],
    });
    expect(requester).not.toHaveBeenCalled();

    const unsafeAcceptedPlan = await executeLocalBridgeProbeRuntimePlan(trustedLocalBridgeRuntimeInput({
      gateInput: probeGateInput(plan),
      probePlan: {
        ...probePlan,
        acceptedEndpoint: 'https://example.com/v1',
        url: 'https://example.com/health?token=synthetic-secret',
      } as never,
    }));
    const unsafeAcceptedPlanSerialized = JSON.stringify(unsafeAcceptedPlan);

    expect(unsafeAcceptedPlan).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['local_bridge_probe_plan_mismatch'],
      safeDetail: 'probe plan must remain exact, loopback-only, inert, and free of secret-bearing URLs',
    });
    expect(unsafeAcceptedPlanSerialized).not.toContain('example.com');
    expect(unsafeAcceptedPlanSerialized).not.toContain('synthetic-secret');
    expect(requester).not.toHaveBeenCalled();

    const unsafeExecutionFlags = await executeLocalBridgeProbeRuntimePlan(trustedLocalBridgeRuntimeInput({
      gateInput: probeGateInput(plan),
      probePlan: {
        ...probePlan,
        executable: true,
        sideEffects: 'network',
      } as never,
    }));

    expect(unsafeExecutionFlags).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['local_bridge_probe_plan_mismatch'],
    });
    expect(requester).not.toHaveBeenCalled();
  });

  it('blocks unsafe local bridge transport overrides before requester handoff', async () => {
    const plan = readyPlan();
    const requester = vi.fn();
    const probePlan = allowedProbePlan(plan);

    const result = await executeLocalBridgeProbeRuntimePlan(trustedLocalBridgeRuntimeInput({
      gateInput: probeGateInput(plan),
      probePlan,
      transportRequest: {
        method: 'POST',
        url: 'http://127.0.0.1:11434/health?api_key=synthetic-secret',
        timeoutMs: 2_001,
        headers: { authorization: 'Bearer synthetic-secret' },
        body: 'payload',
        credentials: 'include',
      } as never,
    }));

    expect(result).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['raw_secret_material'],
    });
    expect(requester).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('synthetic-secret');

    const endpointMismatch = await executeLocalBridgeProbeRuntimePlan(trustedLocalBridgeRuntimeInput({
      gateInput: probeGateInput(plan),
      probePlan,
      transportRequest: {
        method: 'GET',
        url: 'http://127.0.0.1:8766/health',
        timeoutMs: 2_000,
      },
    }));

    expect(endpointMismatch).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: expect.arrayContaining([
        'local_bridge_transport_url_not_allowed',
        'local_bridge_transport_request_mismatch',
      ]),
    });
    expect(requester).not.toHaveBeenCalled();

    const extraFieldMismatch = await executeLocalBridgeProbeRuntimePlan(trustedLocalBridgeRuntimeInput({
      gateInput: probeGateInput(plan),
      probePlan,
      transportRequest: {
        method: 'GET',
        url: 'http://127.0.0.1:11434/health',
        timeoutMs: 2_000,
        requestId: 'probe-1',
      } as never,
    }));

    expect(extraFieldMismatch).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['local_bridge_transport_request_mismatch'],
    });
    expect(requester).not.toHaveBeenCalled();
  });

  it('blocks forged discovery plans and does not invoke requester functions that would leak secret-like material', async () => {
    const forged = readyPlan();
    const requester = vi.fn();
    const forgedProbePlan = allowedProbePlan(forged);

    const gateBlocked = await executeLocalBridgeProbeRuntimePlan(trustedLocalBridgeRuntimeInput({
      gateInput: {
        expectedBridgeKind: 'llm',
        discoveryPlan: {
          ...forged,
          candidates: [
            {
              input: 'https://example.com/v1',
              normalizedEndpoint: 'https://example.com/v1',
              host: 'example.com',
              accepted: true,
              probe: {
                method: 'GET',
                url: 'https://example.com/health',
                timeoutMs: 2_000,
                allowed: true,
                consentRequired: false,
                sideEffectBoundary: 'plan-only-no-fetch-no-socket',
              },
              rejectionReasons: [],
            },
          ],
        },
        explicitUserAction: explicitProbeAction('llm'),
      },
      probePlan: forgedProbePlan,
    }));

    expect(gateBlocked).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['local_bridge_probe_gate_blocked'],
      gateBlockReasons: expect.arrayContaining(['accepted_endpoint_revalidation_failed']),
    });
    expect(requester).not.toHaveBeenCalled();

    const plan = readyPlan();
    const probePlan = allowedProbePlan(plan);
    const leakingRequester: LocalBridgeProbeRequester = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'token=synthetic-secret',
    }));

    const secretResponse = await executeLocalBridgeProbeRuntimePlan({
      gateInput: probeGateInput(plan),
      probePlan,
      requester: reviewedRequesterContract(probePlan, leakingRequester),
    });

    expect(secretResponse).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['local_bridge_runtime_input_shape_forbidden'],
      safeDetail: 'local bridge runtime input failed exact validation before requester handoff',
    });
    expect(leakingRequester).not.toHaveBeenCalled();
    expect(JSON.stringify(secretResponse)).not.toContain('synthetic-secret');

    const rawLeakingRequester: LocalBridgeProbeRequester = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: `${'x'.repeat(90)} bearer synthetic-secret-after-truncation`,
      headers: {
        authorization: 'Bearer synthetic-header-secret',
      },
      body: 'provider response body must not be accepted',
    } as never));

    const rawSecretResponse = await executeLocalBridgeProbeRuntimePlan({
      gateInput: probeGateInput(plan),
      probePlan,
      requester: reviewedRequesterContract(probePlan, rawLeakingRequester),
    });

    expect(rawSecretResponse).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['local_bridge_runtime_input_shape_forbidden'],
    });
    expect(rawLeakingRequester).not.toHaveBeenCalled();
    expect(JSON.stringify(rawSecretResponse)).not.toContain('synthetic-secret-after-truncation');
    expect(JSON.stringify(rawSecretResponse)).not.toContain('synthetic-header-secret');
    expect(JSON.stringify(rawSecretResponse)).not.toContain('provider response body');
  });

  it('does not invoke requester functions that would throw or return malformed probe responses', async () => {
    const plan = readyPlan();
    const probePlan = allowedProbePlan(plan);
    const throwingRequester: LocalBridgeProbeRequester = vi.fn(async () => {
      throw new Error('Bearer synthetic-secret-token');
    });

    const failed = await executeLocalBridgeProbeRuntimePlan({
      gateInput: probeGateInput(plan),
      probePlan,
      requester: reviewedRequesterContract(probePlan, throwingRequester),
    });

    expect(failed).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['local_bridge_runtime_input_shape_forbidden'],
      safeDetail: 'local bridge runtime input failed exact validation before requester handoff',
    });
    expect(throwingRequester).not.toHaveBeenCalled();
    expect(JSON.stringify(failed)).not.toContain('synthetic-secret-token');

    const malformedRequester: LocalBridgeProbeRequester = vi.fn(async () => 'ok' as never);
    const malformed = await executeLocalBridgeProbeRuntimePlan({
      gateInput: probeGateInput(plan),
      probePlan,
      requester: reviewedRequesterContract(probePlan, malformedRequester),
    });

    expect(malformed).toMatchObject({
      status: 'block',
      executed: false,
      blockReasons: ['local_bridge_runtime_input_shape_forbidden'],
    });
    expect(malformedRequester).not.toHaveBeenCalled();
  });
});
