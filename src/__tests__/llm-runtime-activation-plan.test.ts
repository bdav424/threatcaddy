import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
import {
  evaluateLlmProviderLiveActivationGate,
  type LlmProviderLiveEndpointProvenanceFact,
  type LlmProviderLiveNoPromptPersistenceGuaranteeFact,
  type LlmProviderLivePromptBudgetProofFact,
  type LlmProviderLiveProviderModelReviewFact,
  type LlmProviderLiveRuntimeOwnershipFact,
  type LlmProviderLiveUserApprovalFact,
} from '../lib/llm-provider-live-activation-gate';
import {
  evaluateLlmRuntimeActivationPlan,
  type LlmRuntimeActivationPlanInput,
} from '../lib/llm-runtime-activation-plan';
import type { LlmRuntimeInvocationImplementationDecision } from '../lib/llm-runtime-invocation-implementation-boundary';
import {
  createRuntimeTrustedContractObject,
  type RuntimeTrustedContractEntry,
  type RuntimeTrustedContractObject,
  type RuntimeTrustedContractValue,
} from '../lib/runtime-trusted-contract-object';

const NOW = 1_800_000_000_000;

function trustedContractObject<T>(entries: readonly RuntimeTrustedContractEntry[]): T {
  return createRuntimeTrustedContractObject(entries) as unknown as T;
}

function trustedArray<T extends RuntimeTrustedContractValue>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function cloneTrustedObject<T extends Record<string, unknown>>(
  value: T,
  overrides: Record<string, RuntimeTrustedContractValue> = {},
): T {
  return trustedContractObject<T>(
    Object.entries({ ...value, ...overrides }).map(([key, entryValue]) => [
      key,
      entryValue as RuntimeTrustedContractValue,
    ]),
  );
}

function providerModelReview(
  overrides: Partial<LlmProviderLiveProviderModelReviewFact> = {},
): LlmProviderLiveProviderModelReviewFact {
  const value = {
    contract: 'llm-provider-live-provider-model-review-v1',
    reviewState: 'reviewed',
    providerId: 'local',
    modelId: 'llama3.1',
    providerModelReviewed: true,
    ...overrides,
  };
  return trustedContractObject<LlmProviderLiveProviderModelReviewFact>([
    ['contract', value.contract],
    ['reviewState', value.reviewState],
    ['providerId', value.providerId],
    ['modelId', value.modelId],
    ['providerModelReviewed', value.providerModelReviewed],
  ]);
}

function runtimeOwnership(
  overrides: Partial<LlmProviderLiveRuntimeOwnershipFact> = {},
): LlmProviderLiveRuntimeOwnershipFact {
  const value = {
    contract: 'llm-provider-live-runtime-ownership-v1',
    reviewState: 'reviewed',
    runtimeOwner: 'assistantcaddy-llm-provider-runtime',
    runtimeId: 'assistantcaddy-llm-runtime.v1',
    providerId: 'local',
    modelId: 'llama3.1',
    credentialReferenceId: 'local-bridge:assistantcaddy/llm-runtime',
    endpointId: 'local-bridge:127.0.0.1:11434/v1',
    promptBudgetId: 'assistantcaddy-llm-runtime:budget:local',
    noPromptPersistence: true,
    noStreamingBeforeReviewedTransport: true,
    runtimeOwnershipReviewed: true,
    ...overrides,
  };
  return trustedContractObject<LlmProviderLiveRuntimeOwnershipFact>([
    ['contract', value.contract],
    ['reviewState', value.reviewState],
    ['runtimeOwner', value.runtimeOwner],
    ['runtimeId', value.runtimeId],
    ['providerId', value.providerId],
    ['modelId', value.modelId],
    ['credentialReferenceId', value.credentialReferenceId],
    ['endpointId', value.endpointId],
    ['promptBudgetId', value.promptBudgetId],
    ['noPromptPersistence', value.noPromptPersistence],
    ['noStreamingBeforeReviewedTransport', value.noStreamingBeforeReviewedTransport],
    ['runtimeOwnershipReviewed', value.runtimeOwnershipReviewed],
  ]);
}

function endpointProvenance(
  overrides: Partial<LlmProviderLiveEndpointProvenanceFact> = {},
): LlmProviderLiveEndpointProvenanceFact {
  const value = {
    contract: 'llm-provider-live-endpoint-provenance-v1',
    reviewState: 'reviewed',
    providerId: 'local',
    modelId: 'llama3.1',
    endpointId: 'local-bridge:127.0.0.1:11434/v1',
    acceptedEndpoints: trustedArray(['http://127.0.0.1:11434/v1']) as readonly [string],
    endpointProvenanceReviewed: true,
    ...overrides,
  };
  return trustedContractObject<LlmProviderLiveEndpointProvenanceFact>([
    ['contract', value.contract],
    ['reviewState', value.reviewState],
    ['providerId', value.providerId],
    ['modelId', value.modelId],
    ['endpointId', value.endpointId],
    ['acceptedEndpoints', value.acceptedEndpoints],
    ['endpointProvenanceReviewed', value.endpointProvenanceReviewed],
  ]);
}

function promptBudgetProof(
  overrides: Partial<LlmProviderLivePromptBudgetProofFact> = {},
): LlmProviderLivePromptBudgetProofFact {
  const value = {
    contract: 'llm-provider-live-prompt-budget-proof-v1',
    reviewState: 'reviewed',
    providerId: 'local',
    modelId: 'llama3.1',
    promptBudgetId: 'assistantcaddy-llm-runtime:budget:local',
    estimatedPromptChars: 4_096,
    maxPromptChars: 20_000,
    promptBudgetReviewed: true,
    promptOmitted: true,
    ...overrides,
  };
  return trustedContractObject<LlmProviderLivePromptBudgetProofFact>([
    ['contract', value.contract],
    ['reviewState', value.reviewState],
    ['providerId', value.providerId],
    ['modelId', value.modelId],
    ['promptBudgetId', value.promptBudgetId],
    ['estimatedPromptChars', value.estimatedPromptChars],
    ['maxPromptChars', value.maxPromptChars],
    ['promptBudgetReviewed', value.promptBudgetReviewed],
    ['promptOmitted', value.promptOmitted],
  ]);
}

function credentialReference(overrides: Partial<ConnectorCredentialReference> = {}): ConnectorCredentialReference {
  const value = {
    schemaVersion: 1,
    kind: 'local-bridge',
    id: 'local-bridge:assistantcaddy/llm-runtime',
    storageOwner: 'local-bridge',
    providerId: 'local',
    connectorId: 'llm-runtime',
    accountId: 'analyst-workstation',
    displayName: 'Local LLM runtime reference',
    createdAt: NOW - 10_000,
    ...overrides,
  };
  return trustedContractObject<ConnectorCredentialReference>([
    ['schemaVersion', value.schemaVersion],
    ['kind', value.kind],
    ['id', value.id],
    ['storageOwner', value.storageOwner],
    ['providerId', value.providerId],
    ['connectorId', value.connectorId],
    ['accountId', value.accountId],
    ['displayName', value.displayName],
    ['createdAt', value.createdAt],
  ]);
}

function userApproval(overrides: Partial<LlmProviderLiveUserApprovalFact> = {}): LlmProviderLiveUserApprovalFact {
  const value = {
    contract: 'llm-provider-live-user-approval-v1',
    reviewState: 'reviewed',
    providerId: 'local',
    modelId: 'llama3.1',
    credentialReferenceId: 'local-bridge:assistantcaddy/llm-runtime',
    endpointId: 'local-bridge:127.0.0.1:11434/v1',
    promptBudgetId: 'assistantcaddy-llm-runtime:budget:local',
    approvedAction: 'llm_provider_call',
    explicitUserApprovalGranted: true,
    noAutoCallAcknowledged: true,
    approvalReviewed: true,
    ...overrides,
  };
  return trustedContractObject<LlmProviderLiveUserApprovalFact>([
    ['contract', value.contract],
    ['reviewState', value.reviewState],
    ['providerId', value.providerId],
    ['modelId', value.modelId],
    ['credentialReferenceId', value.credentialReferenceId],
    ['endpointId', value.endpointId],
    ['promptBudgetId', value.promptBudgetId],
    ['approvedAction', value.approvedAction],
    ['explicitUserApprovalGranted', value.explicitUserApprovalGranted],
    ['noAutoCallAcknowledged', value.noAutoCallAcknowledged],
    ['approvalReviewed', value.approvalReviewed],
  ]);
}

function noPromptPersistenceGuarantee(
  overrides: Partial<LlmProviderLiveNoPromptPersistenceGuaranteeFact> = {},
): LlmProviderLiveNoPromptPersistenceGuaranteeFact {
  const value = {
    contract: 'llm-provider-live-no-prompt-persistence-v1',
    reviewState: 'reviewed',
    providerId: 'local',
    modelId: 'llama3.1',
    runtimeId: 'assistantcaddy-llm-runtime.v1',
    promptPersistence: 'none',
    willPersistPrompt: false,
    willLogPrompt: false,
    willStoreConversation: false,
    noPromptPersistenceReviewed: true,
    ...overrides,
  };
  return trustedContractObject<LlmProviderLiveNoPromptPersistenceGuaranteeFact>([
    ['contract', value.contract],
    ['reviewState', value.reviewState],
    ['providerId', value.providerId],
    ['modelId', value.modelId],
    ['runtimeId', value.runtimeId],
    ['promptPersistence', value.promptPersistence],
    ['willPersistPrompt', value.willPersistPrompt],
    ['willLogPrompt', value.willLogPrompt],
    ['willStoreConversation', value.willStoreConversation],
    ['noPromptPersistenceReviewed', value.noPromptPersistenceReviewed],
  ]);
}

function runtimeBoundary(
  overrides: Partial<LlmRuntimeInvocationImplementationDecision> = {},
): LlmRuntimeInvocationImplementationDecision {
  const value = {
    status: 'blocked',
    implementationBoundaryReady: true,
    reason: 'executable_llm_transport_contract_missing',
    provider: 'local',
    model: 'llama3.1',
    action: 'send_prompt',
    credentialReferenceId: 'local-bridge:assistantcaddy/llm-runtime',
    requestId: 'llm-request-001',
    localEndpoint: 'http://127.0.0.1:11434/v1',
    promptEstimateChars: 4_096,
    transportIdentity: trustedContractObject([
      ['kind', 'future-reviewed-injected-llm-transport'],
      ['id', 'assistantcaddy-llm-runtime-transport'],
      ['version', '2026.06.12'],
      ['owner', 'assistantcaddy-llm-runtime'],
    ]),
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
    sideEffectBoundary:
      'llm-runtime-invocation-implementation-boundary-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call',
    ...overrides,
  };
  return trustedContractObject<LlmRuntimeInvocationImplementationDecision>(
    Object.entries(value).map(([key, entryValue]) => [key, entryValue as RuntimeTrustedContractValue]),
  );
}

function reviewedFacts(
  overrides: Partial<LlmRuntimeActivationPlanInput> = {},
): LlmRuntimeActivationPlanInput {
  const facts = {
    providerModelReview: providerModelReview(),
    runtimeOwnership: runtimeOwnership(),
    endpointProvenance: endpointProvenance(),
    promptBudgetProof: promptBudgetProof(),
    credentialReference: credentialReference(),
    userApproval: userApproval(),
    noPromptPersistenceGuarantee: noPromptPersistenceGuarantee(),
  };
  const trustedFacts = trustedContractObject<Parameters<typeof evaluateLlmProviderLiveActivationGate>[0]>([
    ['providerModelReview', facts.providerModelReview as unknown as RuntimeTrustedContractObject],
    ['runtimeOwnership', facts.runtimeOwnership as unknown as RuntimeTrustedContractObject],
    ['endpointProvenance', facts.endpointProvenance as unknown as RuntimeTrustedContractObject],
    ['promptBudgetProof', facts.promptBudgetProof as unknown as RuntimeTrustedContractObject],
    ['credentialReference', facts.credentialReference as unknown as RuntimeTrustedContractObject],
    ['userApproval', facts.userApproval as unknown as RuntimeTrustedContractObject],
    ['noPromptPersistenceGuarantee', facts.noPromptPersistenceGuarantee as unknown as RuntimeTrustedContractObject],
  ]);
  const providerActivation = evaluateLlmProviderLiveActivationGate(trustedFacts);
  const value = {
    ...facts,
    providerActivation,
    runtimeBoundary: runtimeBoundary(),
    ...overrides,
  };
  return trustedContractObject<LlmRuntimeActivationPlanInput>([
    ['providerModelReview', value.providerModelReview as unknown as RuntimeTrustedContractObject],
    ['runtimeOwnership', value.runtimeOwnership as unknown as RuntimeTrustedContractObject],
    ['endpointProvenance', value.endpointProvenance as unknown as RuntimeTrustedContractObject],
    ['promptBudgetProof', value.promptBudgetProof as unknown as RuntimeTrustedContractObject],
    ['credentialReference', value.credentialReference as unknown as RuntimeTrustedContractObject],
    ['userApproval', value.userApproval as unknown as RuntimeTrustedContractObject],
    ['noPromptPersistenceGuarantee', value.noPromptPersistenceGuarantee as unknown as RuntimeTrustedContractObject],
    ['providerActivation', value.providerActivation as unknown as RuntimeTrustedContractObject],
    ['runtimeBoundary', value.runtimeBoundary as unknown as RuntimeTrustedContractObject],
  ]);
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('LLM runtime activation plan', () => {
  it('binds reviewed provider activation metadata to the runtime boundary without becoming executable', () => {
    const decision = evaluateLlmRuntimeActivationPlan(reviewedFacts());
    const serialized = JSON.stringify(decision);

    expect(decision).toMatchObject({
      status: 'implementation-plan-ready',
      ready: true,
      reason: 'implementation_plan_ready',
      requiresUserApprovalBeforeCall: true,
      executable: false,
      dispatchAllowed: false,
      sideEffects: 'none',
      willCallLlm: false,
      willCallProvider: false,
      willCallLocalBridge: false,
      willFetch: false,
      willOpenSocket: false,
      willStream: false,
      willMutateStorage: false,
      willPersistPrompt: false,
      implementationPlan: {
        contract: 'llm-runtime-activation-implementation-plan-v1',
        providerId: 'local',
        modelId: 'llama3.1',
        runtimeOwner: 'assistantcaddy-llm-provider-runtime',
        runtimeId: 'assistantcaddy-llm-runtime.v1',
        credentialReferenceId: 'local-bridge:assistantcaddy/llm-runtime',
        endpointId: 'local-bridge:127.0.0.1:11434/v1',
        acceptedEndpoint: 'http://127.0.0.1:11434/v1',
        promptBudgetId: 'assistantcaddy-llm-runtime:budget:local',
        estimatedPromptChars: 4_096,
        maxPromptChars: 20_000,
        requestId: 'llm-request-001',
        acceptedProviderActivationContract: 'llm-provider-live-activation-plan-v1',
        acceptedRuntimeBoundaryContract: 'llm-runtime-invocation-implementation-boundary-v1',
        acceptedRuntimeBoundaryReason: 'executable_llm_transport_contract_missing',
        providerModelReviewed: true,
        runtimeOwnershipReviewed: true,
        endpointProvenanceReviewed: true,
        promptBudgetReviewed: true,
        userApprovalReviewed: true,
        noPromptPersistenceReviewed: true,
        promptOmitted: true,
        promptPersistence: 'none',
        requiresUserApprovalBeforeCall: true,
        executable: false,
        dispatchAllowed: false,
        sideEffects: 'none',
        willCallLlm: false,
        willCallProvider: false,
        willCallLocalBridge: false,
        willFetch: false,
        willOpenSocket: false,
        willStream: false,
        willMutateStorage: false,
        willPersistPrompt: false,
      },
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.implementationPlan)).toBe(true);
    expect(Object.isFrozen(decision.implementationPlan?.credentialReference)).toBe(true);
    expect(Object.isFrozen(decision.implementationPlan?.transportIdentity)).toBe(true);
    expect(serialized).not.toContain('system prompt');
    expect(serialized).not.toContain('Summarize');
  });

  it('requires reviewed activation facts and a ready-shaped provider activation plan', () => {
    expect(evaluateLlmRuntimeActivationPlan(trustedContractObject<LlmRuntimeActivationPlanInput>([
      ['providerActivation', reviewedFacts().providerActivation as unknown as RuntimeTrustedContractObject],
      ['runtimeBoundary', runtimeBoundary() as unknown as RuntimeTrustedContractObject],
    ]))).toMatchObject({
      status: 'blocked',
      reason: 'reviewed_activation_facts_missing',
    });

    expect(evaluateLlmRuntimeActivationPlan(reviewedFacts({
      providerActivation: cloneTrustedObject(reviewedFacts().providerActivation! as unknown as Record<string, unknown>, {
        status: 'blocked',
        mayPrepareLiveActivation: false,
      }) as never,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'provider_activation_not_ready',
    });
  });

  it('revalidates provider, model, credential, endpoint, and prompt-budget ownership locally', () => {
    expect(evaluateLlmRuntimeActivationPlan(reviewedFacts({
      runtimeBoundary: runtimeBoundary({
        model: 'gpt-5.4',
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'provider_model_mismatch',
    });

    expect(evaluateLlmRuntimeActivationPlan(reviewedFacts({
      runtimeBoundary: runtimeBoundary({
        credentialReferenceId: 'local-bridge:other-reference',
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'credential_reference_mismatch',
    });

    expect(evaluateLlmRuntimeActivationPlan(reviewedFacts({
      runtimeBoundary: runtimeBoundary({
        localEndpoint: 'http://localhost:11434/v1',
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'endpoint_drift_detected',
    });

    expect(evaluateLlmRuntimeActivationPlan(reviewedFacts({
      runtimeBoundary: runtimeBoundary({
        promptEstimateChars: 4_097,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'prompt_budget_mismatch',
    });
  });

  it('rejects multiple endpoints, token-bearing values, and prompt/body/header/result payloads', () => {
    const multipleEndpointFacts = {
      providerModelReview: providerModelReview(),
      runtimeOwnership: runtimeOwnership(),
      endpointProvenance: endpointProvenance({
        acceptedEndpoints: Object.freeze([
          'http://127.0.0.1:11434/v1',
          'http://localhost:11434/v1',
        ]) as unknown as readonly [string],
      }),
      promptBudgetProof: promptBudgetProof(),
      credentialReference: credentialReference(),
      userApproval: userApproval(),
      noPromptPersistenceGuarantee: noPromptPersistenceGuarantee(),
    };
    const multipleEndpointInput = trustedContractObject<Parameters<typeof evaluateLlmProviderLiveActivationGate>[0]>([
      ['providerModelReview', multipleEndpointFacts.providerModelReview as unknown as RuntimeTrustedContractObject],
      ['runtimeOwnership', multipleEndpointFacts.runtimeOwnership as unknown as RuntimeTrustedContractObject],
      ['endpointProvenance', multipleEndpointFacts.endpointProvenance as unknown as RuntimeTrustedContractObject],
      ['promptBudgetProof', multipleEndpointFacts.promptBudgetProof as unknown as RuntimeTrustedContractObject],
      ['credentialReference', multipleEndpointFacts.credentialReference as unknown as RuntimeTrustedContractObject],
      ['userApproval', multipleEndpointFacts.userApproval as unknown as RuntimeTrustedContractObject],
      [
        'noPromptPersistenceGuarantee',
        multipleEndpointFacts.noPromptPersistenceGuarantee as unknown as RuntimeTrustedContractObject,
      ],
    ]);
    expect(evaluateLlmRuntimeActivationPlan(reviewedFacts({
      ...multipleEndpointFacts,
      providerActivation: evaluateLlmProviderLiveActivationGate(multipleEndpointInput),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'reviewed_activation_facts_invalid',
    });

    const tokenModel = 'sk-runtimeplanmodeltoken';
    expect(evaluateLlmRuntimeActivationPlan(reviewedFacts({
      providerModelReview: providerModelReview({
        modelId: tokenModel,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });

    expect(evaluateLlmRuntimeActivationPlan(trustedContractObject([
      ...Object.entries(reviewedFacts()).map(([key, value]) => [key, value as RuntimeTrustedContractValue] as const),
      ['result', trustedContractObject([
        ['headers', trustedContractObject([['authorization', 'Bearer test-secret-token']])],
      ]) as RuntimeTrustedContractObject],
    ]) as never)).toMatchObject({
      status: 'blocked',
      reason: 'prompt_or_payload_echo_forbidden',
    });

    expect(evaluateLlmRuntimeActivationPlan(trustedContractObject([
      ...Object.entries(reviewedFacts()).map(([key, value]) => [key, value as RuntimeTrustedContractValue] as const),
      ['prompt', 'system prompt: do not echo analyst text'],
    ]) as never)).toMatchObject({
      status: 'blocked',
      reason: 'prompt_or_payload_echo_forbidden',
    });
  });

  it('rejects callbacks, requesters, fetch/socket/storage/live-action/stream fields, prompt persistence, and forged executable claims', () => {
    expect(evaluateLlmRuntimeActivationPlan(trustedContractObject([
      ...Object.entries(reviewedFacts()).map(([key, value]) => [key, value as RuntimeTrustedContractValue] as const),
      ['requester', 'disabled'],
    ]) as never)).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
    });

    expect(evaluateLlmRuntimeActivationPlan(reviewedFacts({
      runtimeBoundary: cloneTrustedObject(runtimeBoundary() as unknown as Record<string, unknown>, {
        stream: trustedContractObject([['onDelta', 'disabled']]) as unknown as RuntimeTrustedContractValue,
      }) as never,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
    });

    expect(evaluateLlmRuntimeActivationPlan(reviewedFacts({
      noPromptPersistenceGuarantee: noPromptPersistenceGuarantee({
        willPersistPrompt: true as never,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'prompt_persistence_claim_forbidden',
    });

    expect(evaluateLlmRuntimeActivationPlan(reviewedFacts({
      runtimeBoundary: cloneTrustedObject(runtimeBoundary() as unknown as Record<string, unknown>, {
        executable: true,
      }) as never,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'forged_executable_claim',
    });
  });

  it('rejects proxy and accessor roots before trap or getter execution', () => {
    const trap = vi.fn();
    const proxy = new Proxy({}, {
      getPrototypeOf: trap,
      ownKeys: trap,
      getOwnPropertyDescriptor: trap,
      get: trap,
      has: trap,
    });

    const accessor = {};
    Object.defineProperty(accessor, 'providerActivation', {
      enumerable: true,
      get: trap,
    });

    expect(evaluateLlmRuntimeActivationPlan(proxy as never)).toMatchObject({
      status: 'blocked',
      reason: 'input_shape_invalid',
    });
    expect(evaluateLlmRuntimeActivationPlan(accessor as never)).toMatchObject({
      status: 'blocked',
      reason: 'input_shape_invalid',
    });
    expect(trap).not.toHaveBeenCalled();
  });

  it('reconstructs frozen output instead of returning caller-owned activation or boundary objects', () => {
    const input = reviewedFacts();
    const decision = evaluateLlmRuntimeActivationPlan(input);

    expect(decision.implementationPlan).toMatchObject({
      providerId: 'local',
      acceptedEndpoint: 'http://127.0.0.1:11434/v1',
      requestId: 'llm-request-001',
    });
    expect(Object.isFrozen(input.providerModelReview)).toBe(true);
    expect(Object.isFrozen(input.endpointProvenance)).toBe(true);
    expect(Object.isFrozen(input.runtimeBoundary)).toBe(true);
  });
});
