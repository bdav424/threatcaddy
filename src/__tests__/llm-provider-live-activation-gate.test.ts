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

function providerModelReview(
  overrides: Partial<LlmProviderLiveProviderModelReviewFact> = {},
  extraEntries: readonly RuntimeTrustedContractEntry[] = [],
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
    ...extraEntries,
  ]);
}

function runtimeOwnership(
  overrides: Partial<LlmProviderLiveRuntimeOwnershipFact> = {},
  extraEntries: readonly RuntimeTrustedContractEntry[] = [],
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
    ...extraEntries,
  ]);
}

function endpointProvenance(
  overrides: Partial<LlmProviderLiveEndpointProvenanceFact> = {},
  extraEntries: readonly RuntimeTrustedContractEntry[] = [],
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
    ...extraEntries,
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

function credentialReference(
  overrides: Partial<ConnectorCredentialReference> = {},
  extraEntries: readonly RuntimeTrustedContractEntry[] = [],
): ConnectorCredentialReference {
  const value: ConnectorCredentialReference = {
    schemaVersion: overrides.schemaVersion ?? 1,
    kind: overrides.kind ?? 'local-bridge',
    id: overrides.id ?? 'local-bridge:assistantcaddy/llm-runtime',
    storageOwner: overrides.storageOwner ?? 'local-bridge',
    providerId: overrides.providerId ?? 'local',
    connectorId: overrides.connectorId ?? 'llm-runtime',
    accountId: overrides.accountId ?? 'analyst-workstation',
    displayName: overrides.displayName ?? 'Local LLM runtime credential reference',
    createdAt: overrides.createdAt ?? NOW - 10_000,
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
    ...extraEntries,
  ]);
}

function userApproval(
  overrides: Partial<LlmProviderLiveUserApprovalFact> = {},
): LlmProviderLiveUserApprovalFact {
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

function validInput(
  overrides: Partial<Parameters<typeof evaluateLlmProviderLiveActivationGate>[0]> = {},
) {
  const value = {
    providerModelReview: providerModelReview(),
    runtimeOwnership: runtimeOwnership(),
    endpointProvenance: endpointProvenance(),
    promptBudgetProof: promptBudgetProof(),
    credentialReference: credentialReference(),
    userApproval: userApproval(),
    noPromptPersistenceGuarantee: noPromptPersistenceGuarantee(),
    ...overrides,
  };
  return trustedContractObject<Parameters<typeof evaluateLlmProviderLiveActivationGate>[0]>([
    ['providerModelReview', value.providerModelReview as unknown as RuntimeTrustedContractObject],
    ['runtimeOwnership', value.runtimeOwnership as unknown as RuntimeTrustedContractObject],
    ['endpointProvenance', value.endpointProvenance as unknown as RuntimeTrustedContractObject],
    ['promptBudgetProof', value.promptBudgetProof as unknown as RuntimeTrustedContractObject],
    ['credentialReference', value.credentialReference as unknown as RuntimeTrustedContractObject],
    ['userApproval', value.userApproval as unknown as RuntimeTrustedContractObject],
    [
      'noPromptPersistenceGuarantee',
      value.noPromptPersistenceGuarantee as unknown as RuntimeTrustedContractObject,
    ],
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

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('LLM provider live activation gate', () => {
  it('rejects root and nested proxies or accessors before prototype, key, entry, or secret scans execute', () => {
    const rootProxy = proxyWithAllTraps();
    const proxyDecision = evaluateLlmProviderLiveActivationGate(
      rootProxy.proxy as Parameters<typeof evaluateLlmProviderLiveActivationGate>[0],
    );
    expect(proxyDecision).toMatchObject({
      status: 'blocked',
      blockers: [{ code: 'root_shape_invalid' }],
    });
    expect(rootProxy.traps).toEqual([]);

    const nestedProxy = proxyWithAllTraps();
    expect(() => trustedContractObject([
      ['providerModelReview', nestedProxy.proxy as unknown as RuntimeTrustedContractValue],
    ])).toThrow(TypeError);
    expect(nestedProxy.traps).toEqual([]);

    let rootAccessorCalls = 0;
    const rootAccessor = {};
    Object.defineProperty(rootAccessor, 'providerModelReview', {
      enumerable: true,
      get() {
        rootAccessorCalls += 1;
        return providerModelReview();
      },
    });
    const accessorDecision = evaluateLlmProviderLiveActivationGate(
      rootAccessor as Parameters<typeof evaluateLlmProviderLiveActivationGate>[0],
    );
    expect(accessorDecision).toMatchObject({
      status: 'blocked',
      blockers: [{ code: 'root_shape_invalid' }],
    });
    expect(rootAccessorCalls).toBe(0);

    let nestedAccessorCalls = 0;
    const nestedAccessor = {};
    Object.defineProperty(nestedAccessor, 'providerId', {
      enumerable: true,
      get() {
        nestedAccessorCalls += 1;
        return 'local';
      },
    });
    expect(() => trustedContractObject([
      ['providerModelReview', nestedAccessor as unknown as RuntimeTrustedContractValue],
    ])).toThrow(TypeError);
    expect(nestedAccessorCalls).toBe(0);
  });

  it('returns a frozen plan-only activation plan for reviewed LLM provider runtime evidence', () => {
    const decision = evaluateLlmProviderLiveActivationGate(validInput());
    const serialized = JSON.stringify(decision);

    expect(decision).toMatchObject({
      status: 'activation-ready',
      mayPrepareLiveActivation: true,
      executable: false,
      sideEffects: 'none',
      willCallLlm: false,
      willCallProvider: false,
      willFetch: false,
      willOpenSocket: false,
      willStream: false,
      willMutateStorage: false,
      willResolveCredentialSecrets: false,
      willPersistPrompt: false,
      requiresUserApprovalBeforeCall: true,
      activationPlan: {
        contract: 'llm-provider-live-activation-plan-v1',
        providerId: 'local',
        modelId: 'llama3.1',
        runtimeOwner: 'assistantcaddy-llm-provider-runtime',
        runtimeId: 'assistantcaddy-llm-runtime.v1',
        endpointId: 'local-bridge:127.0.0.1:11434/v1',
        acceptedEndpoint: 'http://127.0.0.1:11434/v1',
        promptBudgetId: 'assistantcaddy-llm-runtime:budget:local',
        estimatedPromptChars: 4_096,
        maxPromptChars: 20_000,
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
        sideEffects: 'none',
        willCallLlm: false,
        willCallProvider: false,
        willFetch: false,
        willOpenSocket: false,
        willStream: false,
        willPersistPrompt: false,
      },
      blockers: [],
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.blockers)).toBe(true);
    expect(Object.isFrozen(decision.activationPlan)).toBe(true);
    expect(Object.isFrozen(decision.activationPlan?.credentialReference)).toBe(true);
    expect(serialized).not.toContain('Summarize');
    expect(serialized).not.toContain('system prompt');
  });

  it('rejects raw secrets or token-shaped provider/model values anywhere without echoing them', () => {
    const secretValue = 'Bearer never-echo-this-secret';

    const secretDecision = evaluateLlmProviderLiveActivationGate(validInput({
      credentialReference: credentialReference({}, [['authorization', secretValue]]),
    }));
    expect(secretDecision).toMatchObject({
      status: 'blocked',
      mayPrepareLiveActivation: false,
      blockers: [{ code: 'raw_secret_material' }],
    });
    expect(JSON.stringify(secretDecision)).not.toContain(secretValue);

    const tokenModel = 'sk-syntheticmodeltoken';
    const tokenDecision = evaluateLlmProviderLiveActivationGate(validInput({
      providerModelReview: providerModelReview({
        modelId: tokenModel,
      }),
    }));
    expect(tokenDecision.status).toBe('blocked');
    expect(tokenDecision.blockers.map((item) => item.code)).toEqual(expect.arrayContaining([
      'raw_secret_material',
    ]));
    expect(JSON.stringify(tokenDecision)).not.toContain(tokenModel);

    const promptText = 'system prompt: do not echo analyst notes';
    const promptLabelDecision = evaluateLlmProviderLiveActivationGate(validInput({
      credentialReference: credentialReference({
        displayName: promptText,
      }),
    }));
    expect(promptLabelDecision).toMatchObject({
      status: 'blocked',
      blockers: expect.arrayContaining([
        expect.objectContaining({
          code: 'credential_reference_invalid',
          field: 'credentialReference.displayName',
        }),
      ]),
    });
    expect(JSON.stringify(promptLabelDecision)).not.toContain(promptText);
  });

  it('fails closed on root-level and nested callback/requester/fetch/socket/storage/executable/result/prompt/header/body/stream fields', () => {
    expect(evaluateLlmProviderLiveActivationGate({
      ...validInput(),
      requester: vi.fn(),
    } as unknown as Parameters<typeof evaluateLlmProviderLiveActivationGate>[0])).toMatchObject({
      status: 'blocked',
      blockers: [{ code: 'root_shape_invalid' }],
    });

    const inputValue = validInput();
    const unsafeTrustedRoot = evaluateLlmProviderLiveActivationGate(
      trustedContractObject<Parameters<typeof evaluateLlmProviderLiveActivationGate>[0] & Record<string, unknown>>([
        ['providerModelReview', inputValue.providerModelReview as unknown as RuntimeTrustedContractObject],
        ['runtimeOwnership', inputValue.runtimeOwnership as unknown as RuntimeTrustedContractObject],
        ['endpointProvenance', inputValue.endpointProvenance as unknown as RuntimeTrustedContractObject],
        ['promptBudgetProof', inputValue.promptBudgetProof as unknown as RuntimeTrustedContractObject],
        ['credentialReference', inputValue.credentialReference as unknown as RuntimeTrustedContractObject],
        ['userApproval', inputValue.userApproval as unknown as RuntimeTrustedContractObject],
        [
          'noPromptPersistenceGuarantee',
          inputValue.noPromptPersistenceGuarantee as unknown as RuntimeTrustedContractObject,
        ],
        ['requester', 'Bearer do-not-echo-root-requester-token'],
      ]),
    );
    expect(unsafeTrustedRoot).toMatchObject({
      status: 'blocked',
      blockers: [{ code: 'runtime_shape_forbidden' }],
    });
    expect(JSON.stringify(unsafeTrustedRoot)).not.toContain('do-not-echo');

    const unknownTrustedRoot = evaluateLlmProviderLiveActivationGate(
      trustedContractObject<Parameters<typeof evaluateLlmProviderLiveActivationGate>[0] & Record<string, unknown>>([
        ['providerModelReview', inputValue.providerModelReview as unknown as RuntimeTrustedContractObject],
        ['runtimeOwnership', inputValue.runtimeOwnership as unknown as RuntimeTrustedContractObject],
        ['endpointProvenance', inputValue.endpointProvenance as unknown as RuntimeTrustedContractObject],
        ['promptBudgetProof', inputValue.promptBudgetProof as unknown as RuntimeTrustedContractObject],
        ['credentialReference', inputValue.credentialReference as unknown as RuntimeTrustedContractObject],
        ['userApproval', inputValue.userApproval as unknown as RuntimeTrustedContractObject],
        [
          'noPromptPersistenceGuarantee',
          inputValue.noPromptPersistenceGuarantee as unknown as RuntimeTrustedContractObject,
        ],
        ['traceId', 'Bearer do-not-echo-root-trace-token'],
      ]),
    );
    expect(unknownTrustedRoot).toMatchObject({
      status: 'blocked',
      blockers: [{ code: 'root_shape_invalid' }],
    });
    expect(JSON.stringify(unknownTrustedRoot)).not.toContain('do-not-echo');

    expect(evaluateLlmProviderLiveActivationGate(validInput({
      runtimeOwnership: runtimeOwnership({}, [['fetcher', 'callback-forbidden']]),
    }))).toMatchObject({
      status: 'blocked',
      blockers: [{ code: 'runtime_shape_forbidden' }],
    });

    expect(evaluateLlmProviderLiveActivationGate(validInput({
      endpointProvenance: endpointProvenance({}, [
        ['result', trustedContractObject([['body', 'should not ride along']]) as RuntimeTrustedContractObject],
      ]),
    } as unknown as Parameters<typeof evaluateLlmProviderLiveActivationGate>[0]))).toMatchObject({
      status: 'blocked',
      blockers: [{ code: 'runtime_shape_forbidden' }],
    });

    expect(evaluateLlmProviderLiveActivationGate(validInput({
      endpointProvenance: endpointProvenance({
        acceptedEndpoints: Object.freeze(['http://127.0.0.1:11434/v1/chat?prompt=do-not-echo']) as readonly [string],
      }),
    }))).toMatchObject({
      status: 'blocked',
      blockers: [{ code: 'raw_secret_material' }],
    });

    expect(evaluateLlmProviderLiveActivationGate(validInput({
      endpointProvenance: endpointProvenance({
        acceptedEndpoints: Object.freeze(['http://127.0.0.1:11434/v1/request-body']) as readonly [string],
      }),
    }))).toMatchObject({
      status: 'blocked',
      blockers: [{ code: 'raw_secret_material' }],
    });
  });

  it('rejects multiple accepted endpoints and endpoint drift across reviewed facts', () => {
    expect(evaluateLlmProviderLiveActivationGate(validInput({
      endpointProvenance: endpointProvenance({
        acceptedEndpoints: Object.freeze([
          'http://127.0.0.1:11434/v1',
          'http://localhost:11434/v1',
        ]) as unknown as readonly [string],
      }),
    }))).toMatchObject({
      status: 'blocked',
      blockers: [{ code: 'multiple_accepted_endpoints' }],
    });

    const driftDecision = evaluateLlmProviderLiveActivationGate(validInput({
      runtimeOwnership: runtimeOwnership({
        endpointId: 'local-bridge:localhost:11434/v1',
      }),
      userApproval: userApproval({
        endpointId: 'local-bridge:localhost:11434/v1',
      }),
    }));
    expect(driftDecision.status).toBe('blocked');
    expect(driftDecision.blockers.map((item) => item.code)).toEqual(expect.arrayContaining([
      'endpoint_drift',
    ]));
  });

  it('blocks provider or endpoint evidence outside the runtime invocation loopback domain', () => {
    const remoteProviderDecision = evaluateLlmProviderLiveActivationGate(validInput({
      providerModelReview: providerModelReview({ providerId: 'openai' }),
      runtimeOwnership: runtimeOwnership({ providerId: 'openai' }),
      endpointProvenance: endpointProvenance({ providerId: 'openai' }),
      promptBudgetProof: promptBudgetProof({ providerId: 'openai' }),
      userApproval: userApproval({ providerId: 'openai' }),
      noPromptPersistenceGuarantee: noPromptPersistenceGuarantee({ providerId: 'openai' }),
    }));
    expect(remoteProviderDecision.status).toBe('blocked');
    expect(remoteProviderDecision.activationPlan).toBeUndefined();
    expect(remoteProviderDecision.blockers.map((item) => item.code)).toEqual(expect.arrayContaining([
      'provider_model_review_invalid',
      'runtime_ownership_invalid',
      'endpoint_provenance_invalid',
      'prompt_budget_invalid',
      'user_approval_invalid',
      'prompt_persistence_guarantee_invalid',
    ]));

    const remoteEndpointDecision = evaluateLlmProviderLiveActivationGate(validInput({
      endpointProvenance: endpointProvenance({
        acceptedEndpoints: trustedArray(['https://api.openai.example/v1']) as readonly [string],
      }),
    }));
    expect(remoteEndpointDecision).toMatchObject({
      status: 'blocked',
      blockers: [{ code: 'endpoint_provenance_invalid' }],
    });
    expect(remoteEndpointDecision.activationPlan).toBeUndefined();
  });

  it('requires explicit reviewed user approval, prompt budget proof, and no-prompt-persistence guarantees', () => {
    const missingApproval = evaluateLlmProviderLiveActivationGate(validInput({
      userApproval: undefined,
    }));
    expect(missingApproval).toMatchObject({
      status: 'blocked',
      blockers: [{ code: 'user_approval_missing' }],
    });

    const overBudget = evaluateLlmProviderLiveActivationGate(validInput({
      promptBudgetProof: promptBudgetProof({
        estimatedPromptChars: 20_001,
        maxPromptChars: 20_000,
      }),
    }));
    expect(overBudget).toMatchObject({
      status: 'blocked',
      blockers: [{ code: 'prompt_budget_exceeded' }],
    });

    const persistenceClaim = evaluateLlmProviderLiveActivationGate(validInput({
      noPromptPersistenceGuarantee: noPromptPersistenceGuarantee({
        promptPersistence: 'session' as never,
      }),
    }));
    expect(persistenceClaim).toMatchObject({
      status: 'blocked',
      blockers: [{ code: 'prompt_persistence_claim_forbidden' }],
    });
  });

  it('blocks model/credential/prompt-budget/runtime ownership mismatches and rebuilds accepted metadata', () => {
    const decision = evaluateLlmProviderLiveActivationGate(validInput({
      runtimeOwnership: runtimeOwnership({
        modelId: 'llama3.2',
        credentialReferenceId: 'local-bridge:assistantcaddy/other-runtime',
        promptBudgetId: 'assistantcaddy-llm-runtime:budget:other',
      }),
      promptBudgetProof: promptBudgetProof({
        promptBudgetId: 'different-budget',
      }),
      credentialReference: credentialReference({
        providerId: 'local',
        id: 'local-bridge:assistantcaddy/llm-runtime',
      }),
      noPromptPersistenceGuarantee: noPromptPersistenceGuarantee({
        runtimeId: 'other-runtime',
      }),
    }));

    expect(decision.status).toBe('blocked');
    expect(decision.activationPlan).toBeUndefined();
    expect(decision.blockers.map((item) => item.code)).toEqual(expect.arrayContaining([
      'model_mismatch',
      'credential_reference_mismatch',
      'prompt_budget_mismatch',
      'runtime_owner_mismatch',
    ]));
  });

  it('rejects unsafe colon-scheme provider identifiers while preserving reviewed opaque handles', () => {
    for (const modelId of ['mailto:user@example.test', 'urn:provider:opaque']) {
      const decision = evaluateLlmProviderLiveActivationGate(validInput({
        providerModelReview: providerModelReview({ modelId }),
        runtimeOwnership: runtimeOwnership({ modelId }),
        endpointProvenance: endpointProvenance({ modelId }),
        promptBudgetProof: promptBudgetProof({ modelId }),
        userApproval: userApproval({ modelId }),
        noPromptPersistenceGuarantee: noPromptPersistenceGuarantee({ modelId }),
      }));

      expect(decision.status).toBe('blocked');
      expect(decision.activationPlan).toBeUndefined();
      expect(decision.blockers.map((item) => item.code)).toEqual(expect.arrayContaining([
        'provider_model_review_invalid',
        'runtime_ownership_invalid',
        'endpoint_provenance_invalid',
        'prompt_budget_invalid',
        'user_approval_invalid',
        'prompt_persistence_guarantee_invalid',
      ]));
      expect(JSON.stringify(decision)).not.toContain(modelId);
    }

    expect(evaluateLlmProviderLiveActivationGate(validInput()).status).toBe('activation-ready');
  });

  it('keeps accepted plan metadata immutable after caller input mutation', () => {
    const input = validInput();
    const decision = evaluateLlmProviderLiveActivationGate(input);
    expect(() => {
      (input.providerModelReview as LlmProviderLiveProviderModelReviewFact).providerId = 'openai';
    }).toThrow(TypeError);
    expect(() => {
      (input.endpointProvenance as LlmProviderLiveEndpointProvenanceFact).acceptedEndpoints = Object.freeze([
        'https://api.openai.example/v1',
      ]) as readonly [string];
    }).toThrow(TypeError);
    expect(() => {
      (input.credentialReference as ConnectorCredentialReference).id = 'openai:keychain-reference';
    }).toThrow(TypeError);

    expect(decision.activationPlan).toMatchObject({
      providerId: 'local',
      acceptedEndpoint: 'http://127.0.0.1:11434/v1',
      credentialReference: {
        id: 'local-bridge:assistantcaddy/llm-runtime',
      },
    });
  });
});
