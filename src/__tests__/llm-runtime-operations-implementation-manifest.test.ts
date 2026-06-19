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
  evaluateLlmRuntimeInvocationImplementationBoundary,
  type LlmRuntimeInvocationImplementationDecision,
  type LlmRuntimeInvocationPlan,
  type LlmRuntimeInvocationTransportFacts,
} from '../lib/llm-runtime-invocation-implementation-boundary';
import {
  LLM_RUNTIME_OPERATIONS_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES,
  LLM_RUNTIME_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
  LLM_RUNTIME_OPERATIONS_IMPLEMENTATION_MANIFEST_REQUIRED_GATES,
  evaluateLlmRuntimeOperationsImplementationManifest,
} from '../lib/llm-runtime-operations-implementation-manifest';
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

function trustedContractObject<T>(entries: readonly RuntimeTrustedContractEntry[]): T {
  return createRuntimeTrustedContractObject(entries) as unknown as T;
}

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
  if (Array.isArray(value)) return Object.freeze(value.map((item) => trustedValue(item)));
  if (typeof value === 'object') {
    return trustedContractObject<RuntimeTrustedContractObject>(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        trustedValue(nested),
      ]),
    );
  }
  throw new TypeError('Trusted LLM operations manifest fixtures cannot include callable values.');
}

function manifestInput(
  sourceBoundaryValue?: unknown,
  proposedHighRiskWriteSet?: readonly unknown[] | null,
  extraEntries: readonly RuntimeTrustedContractEntry[] = [],
) {
  const entries: RuntimeTrustedContractEntry[] = [];
  if (sourceBoundaryValue !== undefined) {
    entries.push(['sourceBoundary', sourceBoundaryValue as RuntimeTrustedContractValue]);
  }
  if (proposedHighRiskWriteSet !== undefined) {
    entries.push(['proposedHighRiskWriteSet', trustedValue(proposedHighRiskWriteSet)]);
  }
  entries.push(...extraEntries);
  return trustedContractObject<Parameters<typeof evaluateLlmRuntimeOperationsImplementationManifest>[0]>(entries);
}

function trustedBoundaryVariant(
  boundary: Readonly<LlmRuntimeInvocationImplementationDecision>,
  overrides: Record<string, RuntimeTrustedContractValue>,
): LlmRuntimeInvocationImplementationDecision {
  return trustedContractObject<LlmRuntimeInvocationImplementationDecision>(
    Object.entries({ ...boundary, ...overrides }).map(([key, value]) => [
      key,
      value as RuntimeTrustedContractValue,
    ]),
  );
}

function credential(overrides: Partial<ConnectorCredentialReference> = {}): ConnectorCredentialReference {
  return {
    schemaVersion: 1,
    kind: 'local-bridge',
    id: 'local-bridge:assistantcaddy/llm-runtime',
    storageOwner: 'local-bridge',
    providerId: 'local',
    connectorId: 'llm-runtime',
    accountId: 'analyst-workstation',
    displayName: 'Local LLM runtime credential reference',
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
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
  return evaluateAssistantProviderExecutionGate(trustedValue(input) as AssistantProviderExecutionGateInput);
}

async function runtimeResult(input: AssistantProviderExecutionGateInput = gateInput()): Promise<AssistantProviderRuntimeResult> {
  return executeAssistantProviderRuntimeAction(
    trustedContractObject<Parameters<typeof executeAssistantProviderRuntimeAction>[0]>([
      ['gateInput', trustedValue(input)],
    ]),
  );
}

function makeTransportFacts(
  execution: AssistantProviderExecutionDecision,
  overrides: Partial<LlmRuntimeInvocationTransportFacts> = {},
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
  return {
    contract: 'llm-runtime-invocation-transport-facts-v1',
    provider: 'local',
    model: execution.model,
    action: execution.action,
    credentialReferenceId: execution.credentialReference.id,
    requestId: 'llm-request-001',
    localEndpoint: execution.localEndpoint,
    promptEstimateChars: execution.promptEstimateChars,
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
    transportIdentity: {
      ...facts.transportIdentity,
    },
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

async function sourceBoundary(): Promise<Readonly<LlmRuntimeInvocationImplementationDecision>> {
  void evaluateLlmRuntimeInvocationImplementationBoundary;
  void providerExecution;
  void runtimeResult;
  void makeTransportFacts;
  void makeInvocationPlan;
  return trustedContractObject<LlmRuntimeInvocationImplementationDecision>([
    ['status', 'blocked'],
    ['implementationBoundaryReady', true],
    ['reason', 'executable_llm_transport_contract_missing'],
    ['provider', 'local'],
    ['model', 'llama3.1'],
    ['action', 'send_prompt'],
    ['credentialReferenceId', 'local-bridge:assistantcaddy/llm-runtime'],
    ['requestId', 'llm-request-001'],
    ['localEndpoint', 'http://127.0.0.1:11434/v1'],
    ['transportIdentity', trustedContractObject([
      ['kind', 'future-reviewed-injected-llm-transport'],
      ['id', 'assistantcaddy-llm-runtime-transport'],
      ['version', '2026.06.12'],
      ['owner', 'assistantcaddy-llm-runtime'],
    ]) as RuntimeTrustedContractObject],
    ['promptRedaction', 'prompt-omitted'],
    ['canPrepareFutureLlmInvocation', true],
    ['executable', false],
    ['dispatchAllowed', false],
    ['willCallProvider', false],
    ['willCallLocalBridge', false],
    ['willFetch', false],
    ['willOpenSocket', false],
    ['willStream', false],
    ['willMutateStorage', false],
    [
      'sideEffectBoundary',
      'llm-runtime-invocation-implementation-boundary-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call',
    ],
  ]);
}

describe('LLM runtime operations implementation manifest', () => {
  it('converts a promoted invocation boundary into a frozen head-chat-only operations manifest', async () => {
    const boundary = await sourceBoundary();
    const decision = evaluateLlmRuntimeOperationsImplementationManifest(manifestInput(
      boundary,
      LLM_RUNTIME_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
    ));
    const serialized = JSON.stringify(decision);

    expect(decision).toMatchObject({
      status: 'implementation-manifest-ready',
      manifestReady: true,
      reason: 'implementation_manifest_ready',
      manifest: {
        schemaVersion: 1,
        contract: 'llm-runtime-operations-implementation-manifest-v1',
        manifestOwner: 'assistantcaddy-head-chat-llm-runtime',
        manifestId: 'assistantcaddy-head-chat-llm-runtime-operations-manifest',
        manifestVersion: '2026.06.12',
        implementationOwner: 'head-chat',
        implementationScope: 'llm-runtime-operations-implementation',
        sourceBoundaryContract: 'llm-runtime-invocation-implementation-boundary-v1',
        sourceBoundaryReason: 'executable_llm_transport_contract_missing',
        sourceBoundarySideEffectBoundary:
          'llm-runtime-invocation-implementation-boundary-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call',
        sourceProvider: 'local',
        sourceModel: 'llama3.1',
        sourceAction: 'send_prompt',
        sourceCredentialReferenceId: 'local-bridge:assistantcaddy/llm-runtime',
        sourceRequestId: 'llm-request-001',
        sourceLocalEndpoint: 'http://127.0.0.1:11434/v1',
        sourcePromptEstimateChars: boundary.promptEstimateChars,
        sourceTransportIdentity: {
          kind: 'future-reviewed-injected-llm-transport',
          id: 'assistantcaddy-llm-runtime-transport',
          version: '2026.06.12',
          owner: 'assistantcaddy-llm-runtime',
        },
        promptRedactionRequirement: 'prompt-omitted',
        bodyRedactionRequirement: 'body-omitted',
        headersRedactionRequirement: 'headers-omitted',
        promptPersistenceRequirement: 'no-prompt-persistence',
        networkRequirement: 'no-network-until-reviewed-transport-contract',
        storageRequirement: 'no-storage-until-reviewed-secret-and-prompt-store',
        streamingRequirement: 'no-streaming-until-reviewed-stream-contract',
        exactHighRiskWriteSet: LLM_RUNTIME_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
        blockedPathClasses: LLM_RUNTIME_OPERATIONS_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES,
        requiredPromotionGates: LLM_RUNTIME_OPERATIONS_IMPLEMENTATION_MANIFEST_REQUIRED_GATES,
        promotedFromInvocationBoundary: true,
        headChatReviewRequired: true,
        recoveryCheckpointRequired: true,
        rollbackPlanRequired: true,
        standalonePromotionHeadChatOnly: true,
        readyForImplementation: false,
        implementationMode: 'manifest-only',
      },
      canPrepareHeadChatLlmRuntimeOperationsImplementation: true,
      readyForLlmRuntimeOperationsImplementation: false,
      mayCallLlm: false,
      mayCallProvider: false,
      mayCallLocalBridge: false,
      mayFetch: false,
      mayOpenSocket: false,
      mayStream: false,
      mayPersistPrompt: false,
      mayReadStorage: false,
      mayWriteStorage: false,
      willGenerateArtifacts: false,
      willPromoteStandalone: false,
      sideEffects: 'none',
      implementationDirective: 'head-chat-owned-llm-runtime-operations-implementation-only',
      sideEffectBoundary:
        'llm-runtime-operations-implementation-manifest-no-llm-no-fetch-no-socket-no-stream-no-storage-no-prompt-persistence-no-provider-no-local-bridge-call-no-provider-sdk',
    });
    expect(decision.manifest.exactHighRiskWriteSet).toEqual(LLM_RUNTIME_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET);
    expect(decision.manifest.blockedPathClasses).toEqual([
      'generated-artifacts',
      'docs',
      'standalone',
      'package-files',
      'ui',
      'schema-storage-export-backup',
    ]);
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.manifest)).toBe(true);
    expect(Object.isFrozen(decision.manifest.exactHighRiskWriteSet)).toBe(true);
    expect(Object.isFrozen(decision.manifest.requiredPromotionGates)).toBe(true);
    expect(serialized).not.toContain('Summarize the selected investigation evidence');
    expect(serialized).not.toContain('Use concise CTI notes');
  });

  it('fails closed when the source boundary is missing, not ready, or forged executable', async () => {
    const boundary = await sourceBoundary();

    expect(evaluateLlmRuntimeOperationsImplementationManifest()).toMatchObject({
      status: 'blocked',
      reason: 'source_boundary_missing',
      canPrepareHeadChatLlmRuntimeOperationsImplementation: false,
    });

    expect(evaluateLlmRuntimeOperationsImplementationManifest(manifestInput(
      trustedBoundaryVariant(boundary, {
        implementationBoundaryReady: false,
        canPrepareFutureLlmInvocation: false,
      }),
    ))).toMatchObject({
      status: 'blocked',
      reason: 'source_boundary_not_ready',
      mayCallLlm: false,
    });

    expect(evaluateLlmRuntimeOperationsImplementationManifest(manifestInput(
      trustedBoundaryVariant(boundary, {
        executable: true,
      }),
    ))).toMatchObject({
      status: 'blocked',
      reason: 'forged_executable_claim',
      mayCallLlm: false,
      mayFetch: false,
      mayWriteStorage: false,
    });

    for (const forgedInput of [
      manifestInput(boundary, undefined, [['mayCallLlm', true]]),
      manifestInput(boundary, undefined, [['mayFetch', true]]),
      manifestInput(boundary, undefined, [['executable', true]]),
      manifestInput(boundary, undefined, [['dispatchAllowed', true]]),
      manifestInput(boundary, undefined, [['fetchPlan', 'https://provider.example/v1/chat/completions']]),
      manifestInput(boundary, undefined, [['socketPlan', 'wss://provider.example/stream']]),
      manifestInput(boundary, undefined, [['storageAdapter', 'indexed-db']]),
      manifestInput(boundary, undefined, [['liveAction', 'provider-call']]),
      manifestInput(trustedBoundaryVariant(boundary, { mayCallProvider: true })),
      manifestInput(trustedBoundaryVariant(boundary, { mayCallLocalBridge: true })),
      manifestInput(trustedBoundaryVariant(boundary, { mayStream: true })),
      manifestInput(trustedBoundaryVariant(boundary, { fetchPlan: 'https://provider.example/v1' })),
      manifestInput(trustedBoundaryVariant(boundary, { requester: 'local-bridge-call' })),
    ]) {
      expect(evaluateLlmRuntimeOperationsImplementationManifest(forgedInput)).toMatchObject({
        status: 'blocked',
        reason: 'forged_executable_claim',
        mayCallLlm: false,
        mayCallProvider: false,
        mayCallLocalBridge: false,
        mayFetch: false,
        mayStream: false,
      });
    }
  });

  it('requires exact provider, local endpoint, transport, and high-risk write-set provenance', async () => {
    const boundary = await sourceBoundary();

    expect(evaluateLlmRuntimeOperationsImplementationManifest(manifestInput(
      trustedBoundaryVariant(boundary, {
        sourceProvider: 'local',
      }),
    ))).toMatchObject({
      status: 'blocked',
      reason: 'source_boundary_invalid',
    });

    for (const mismatch of [
      manifestInput(trustedBoundaryVariant(boundary, { provider: 'anthropic' })),
      manifestInput(trustedBoundaryVariant(boundary, { localEndpoint: 'https://example.com/v1' })),
      manifestInput(trustedBoundaryVariant(boundary, { model: 'https://example.com/model' })),
      manifestInput(trustedBoundaryVariant(boundary, { requestId: '127.0.0.1:11434/v1' })),
      manifestInput(trustedBoundaryVariant(boundary, { requestId: 'mailto:user@example.test' })),
      manifestInput(trustedBoundaryVariant(boundary, { requestId: 'urn:provider:opaque' })),
      manifestInput(trustedBoundaryVariant(boundary, {
        transportIdentity: trustedContractObject([
          ['kind', 'future-reviewed-injected-llm-transport'],
          ['id', 'assistantcaddy-other-runtime-transport'],
          ['version', '2026.06.12'],
          ['owner', 'assistantcaddy-llm-runtime'],
        ]),
      })),
    ]) {
      expect(evaluateLlmRuntimeOperationsImplementationManifest(mismatch)).toMatchObject({
        status: 'blocked',
        reason: 'provider_provenance_invalid',
        canPrepareHeadChatLlmRuntimeOperationsImplementation: false,
      });
    }

    expect(evaluateLlmRuntimeOperationsImplementationManifest(manifestInput(boundary, [
        ...LLM_RUNTIME_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
        'docs/assistantcaddy-rollout-ledger-2026-06-05.md',
    ]))).toMatchObject({
      status: 'blocked',
      reason: 'future_write_set_invalid',
      willGenerateArtifacts: false,
      willPromoteStandalone: false,
    });

    expect(evaluateLlmRuntimeOperationsImplementationManifest(manifestInput(boundary, [
        ...LLM_RUNTIME_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
        'src/components/CaddyAssistant/CadEmailWorkspace.tsx',
    ]))).toMatchObject({
      status: 'blocked',
      reason: 'future_write_set_invalid',
    });

    expect(evaluateLlmRuntimeOperationsImplementationManifest(manifestInput(
      trustedBoundaryVariant(boundary, {
        localEndpoint: 'http://127.0.0.1:11434/v1?token=plain-secret',
      }),
    ))).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });

    expect(evaluateLlmRuntimeOperationsImplementationManifest(manifestInput(
      boundary,
      undefined,
      [['mayCallLlm', true]],
    ))).toMatchObject({
      status: 'blocked',
      reason: 'forged_executable_claim',
    });
  });

  it('blocks token-shaped identifiers and prompt/body/header echoes without network or storage effects', async () => {
    const boundary = await sourceBoundary();
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

    const tokenDecision = evaluateLlmRuntimeOperationsImplementationManifest(manifestInput(
      trustedBoundaryVariant(boundary, {
        credentialReferenceId: 'ghp_do_not_echo_manifest_token',
      }),
    ));
    const promptEchoDecision = evaluateLlmRuntimeOperationsImplementationManifest(manifestInput(
      trustedBoundaryVariant(boundary, {
        prompt: 'Summarize the selected investigation evidence.',
      }),
    ));
    const serialized = JSON.stringify([tokenDecision, promptEchoDecision]);

    expect(tokenDecision).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
      mayCallLlm: false,
      mayFetch: false,
      mayOpenSocket: false,
      mayPersistPrompt: false,
      mayWriteStorage: false,
    });
    expect(promptEchoDecision).toMatchObject({
      status: 'blocked',
      reason: 'prompt_body_header_echo_forbidden',
      mayCallLlm: false,
      mayFetch: false,
      mayOpenSocket: false,
      mayPersistPrompt: false,
      mayWriteStorage: false,
    });
    expect(serialized).not.toContain('do_not_echo');
    expect(serialized).not.toContain('manifest_token');
    expect(serialized).not.toContain('Summarize the selected investigation evidence');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(webSocketSpy).not.toHaveBeenCalled();
    expect(eventSourceSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });
});
