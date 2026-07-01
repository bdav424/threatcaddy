import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateAssistantProviderExecutionGate,
  type AssistantProviderExplicitUserActionFact,
} from '../lib/assistant-provider-execution-gate';
import {
  classifyAssistantProviderReadiness,
  type AssistantProviderReadiness,
  type AssistantProviderRoute,
} from '../lib/assistant-provider-readiness';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
import {
  createRuntimeTrustedContractObject,
  isRuntimeTrustedContractObject,
  type RuntimeTrustedContractValue,
} from '../lib/runtime-trusted-contract-object';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function reference(overrides: Partial<ConnectorCredentialReference> = {}): ConnectorCredentialReference {
  return {
    schemaVersion: 1,
    kind: 'os-keychain',
    id: 'macos-login:threatcaddy/openai/assistant-provider',
    storageOwner: 'operating-system',
    providerId: 'openai',
    connectorId: 'assistant-provider-runtime',
    accountId: 'account-1',
    displayName: 'Assistant provider reference',
    createdAt: 1_800_000_000_000,
    ...overrides,
  };
}

function configuredReadiness(
  provider: AssistantProviderRoute = 'openai',
  overrides: Partial<ConnectorCredentialReference> = {},
): AssistantProviderReadiness {
  const credentialReference = reference({
    providerId: provider,
    ...(provider === 'local'
      ? {
          kind: 'local-bridge',
          id: 'local-bridge:llm/assistant-provider',
          storageOwner: 'local-bridge',
        }
      : {}),
    ...overrides,
  });
  const readiness = classifyAssistantProviderReadiness({
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
    caddyAiBaselineConfigured: true,
  });

  if (readiness.status !== 'configured') {
    throw new Error(`Expected configured readiness fixture, got ${readiness.status}: ${readiness.blockReasons.join(', ')}`);
  }
  return readiness;
}

function explicitAction(
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
  throw new TypeError('Assistant provider execution gate trusted fixtures cannot include callable values.');
}

function trustedRecord<T extends Record<string, unknown>>(value: T): T {
  return createRuntimeTrustedContractObject(
    Object.entries(value).map(([key, nested]) => [key, trustedValue(nested)] as const),
  ) as unknown as T;
}

function evaluateTrustedGate(input: Record<string, unknown>) {
  return evaluateAssistantProviderExecutionGate(
    trustedRecord(input) as Parameters<typeof evaluateAssistantProviderExecutionGate>[0],
  );
}

function expectNoSideEffects(): void {
  const fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
  const keySpy = vi.spyOn(Storage.prototype, 'key');
  const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
  const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
  const clearSpy = vi.spyOn(Storage.prototype, 'clear');

  evaluateTrustedGate({
    action: 'send_prompt',
    readiness: configuredReadiness(),
    explicitUserAction: explicitAction('send_prompt'),
    prompt: {
      messages: [{ role: 'user', content: 'Summarize this local fixture.' }],
    },
  });

  expect(fetchSpy).not.toHaveBeenCalled();
  expect(getItemSpy).not.toHaveBeenCalled();
  expect(keySpy).not.toHaveBeenCalled();
  expect(setItemSpy).not.toHaveBeenCalled();
  expect(removeItemSpy).not.toHaveBeenCalled();
  expect(clearSpy).not.toHaveBeenCalled();
}

describe('AssistantCaddy provider execution gate', () => {
  it('blocks CaddyAI baseline-only state instead of treating it as AssistantCaddy provider execution', () => {
    const decision = evaluateTrustedGate({
      action: 'send_prompt',
      readiness: classifyAssistantProviderReadiness({ caddyAiBaselineConfigured: true }),
      explicitUserAction: explicitAction('send_prompt'),
      prompt: {
        messages: [{ role: 'user', content: 'hello' }],
      },
      caddyAiBaselineConfigured: true,
    });

    expect(decision).toMatchObject({
      status: 'block',
      action: 'send_prompt',
      executable: false,
      sideEffects: 'none',
      blockReasons: expect.arrayContaining([
        'provider_not_configured',
        'caddyai_baseline_only',
        'provider_not_openai_compatible',
        'credential_reference_missing',
      ]),
      sideEffectBoundary: 'decision-only-no-fetch-no-socket-no-storage-no-llm',
    });
  });

  it('returns inert allow for an explicit disable action without requiring a provider call or credential', () => {
    const decision = evaluateTrustedGate({
      action: 'disable_provider',
      readiness: configuredReadiness(),
      explicitUserAction: explicitAction('disable_provider'),
    });

    expect(decision).toEqual({
      status: 'allow',
      action: 'disable_provider',
      executable: false,
      sideEffects: 'none',
      provider: 'openai',
      model: 'gpt-4.1',
      credentialReference: undefined,
      promptEstimateChars: undefined,
      allowReason: 'explicit_disable_local_metadata_only',
      blockReasons: [],
      credentialRejectReason: undefined,
      sideEffectBoundary: 'decision-only-no-fetch-no-socket-no-storage-no-llm',
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.blockReasons)).toBe(true);
  });

  it('keeps OpenAI-compatible provider actions behind explicit action and no-auto-call defaults', () => {
    const readiness = configuredReadiness();

    expect(evaluateTrustedGate({
      action: 'test_provider',
      readiness,
      explicitUserAction: explicitAction('test_provider'),
    })).toMatchObject({
      status: 'allow',
      allowReason: 'explicit_provider_test_plan_only',
      executable: false,
      sideEffects: 'none',
      blockReasons: [],
    });

    expect(evaluateTrustedGate({
      action: 'list_models',
      readiness,
    })).toMatchObject({
      status: 'block',
      blockReasons: expect.arrayContaining(['explicit_user_action_missing', 'no_auto_call_default']),
    });
  });

  it('fails closed for ready-shaped readiness missing provider or credential ownership facts', () => {
    const readiness = configuredReadiness();

    expect(evaluateTrustedGate({
      action: 'list_models',
      readiness: {
        ...readiness,
        provider: undefined,
      },
      explicitUserAction: explicitAction('list_models'),
    })).toMatchObject({
      status: 'block',
      blockReasons: expect.arrayContaining([
        'readiness_provider_unbound',
        'provider_not_openai_compatible',
      ]),
    });

    expect(evaluateTrustedGate({
      action: 'list_models',
      readiness: {
        ...readiness,
        credentialReference: undefined,
      },
      credentialReference: reference(),
      explicitUserAction: explicitAction('list_models'),
    })).toMatchObject({
      status: 'block',
      blockReasons: expect.arrayContaining(['readiness_credential_unbound']),
    });
  });

  it('fails closed when explicit action, prompt model, credential, and readiness ownership do not bind', () => {
    const readiness = configuredReadiness();

    const providerMismatch = evaluateTrustedGate({
      action: 'send_prompt',
      readiness,
      explicitUserAction: explicitAction('send_prompt', 'local'),
      prompt: {
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: 'hello' }],
      },
    });

    expect(providerMismatch).toMatchObject({
      status: 'block',
      blockReasons: expect.arrayContaining([
        'explicit_user_action_missing',
        'readiness_provider_mismatch',
      ]),
    });

    const modelMismatch = evaluateTrustedGate({
      action: 'send_prompt',
      readiness,
      explicitUserAction: {
        ...explicitAction('send_prompt'),
        model: 'gpt-4o-mini',
      },
      prompt: {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hello' }],
      },
    });

    expect(modelMismatch).toMatchObject({
      status: 'block',
      blockReasons: expect.arrayContaining(['readiness_model_mismatch']),
    });

    const credentialMismatch = evaluateTrustedGate({
      action: 'send_prompt',
      readiness,
      credentialReference: reference({
        id: 'macos-login:threatcaddy/local/assistant-provider',
        providerId: 'local',
      }),
      explicitUserAction: explicitAction('send_prompt'),
      prompt: {
        messages: [{ role: 'user', content: 'hello' }],
      },
    });

    expect(credentialMismatch).toMatchObject({
      status: 'block',
      blockReasons: expect.arrayContaining([
        'credential_reference_mismatch',
        'readiness_credential_mismatch',
      ]),
    });
  });

  it('allows explicit provider test plans from explicit-user-test-ready readiness without executing them', () => {
    const credentialReference = reference();
    const readiness = classifyAssistantProviderReadiness({
      provider: 'openai',
      model: 'gpt-4.1',
      credentialReference,
      explicitUserTestConsent: true,
      caddyAiBaselineConfigured: true,
    });

    expect(readiness.status).toBe('explicit-user-test-ready');

    expect(evaluateTrustedGate({
      action: 'test_provider',
      readiness,
      explicitUserAction: explicitAction('test_provider'),
    })).toMatchObject({
      status: 'allow',
      executable: false,
      sideEffects: 'none',
      credentialReference,
      allowReason: 'explicit_provider_test_plan_only',
      blockReasons: [],
    });
  });

  it('blocks non-OpenAI-compatible routes for future OpenAI-compatible execution actions', () => {
    const decision = evaluateTrustedGate({
      action: 'send_prompt',
      readiness: configuredReadiness('gemini'),
      explicitUserAction: explicitAction('send_prompt', 'gemini'),
      prompt: {
        messages: [{ role: 'user', content: 'hello' }],
      },
    });

    expect(decision).toMatchObject({
      status: 'block',
      provider: 'gemini',
      blockReasons: expect.arrayContaining(['provider_not_openai_compatible']),
    });
  });

  it('accepts local Ollama or localhost readiness metadata only when the local plan is already consented and allowed', () => {
    const readyDecision = evaluateTrustedGate({
      action: 'send_prompt',
      readiness: configuredReadiness('local'),
      explicitUserAction: explicitAction('send_prompt', 'local'),
      prompt: {
        messages: [{ role: 'user', content: 'Use the local provider fixture.' }],
      },
    });

    expect(readyDecision).toMatchObject({
      status: 'allow',
      allowReason: 'explicit_prompt_dispatch_ready',
      executable: false,
      sideEffects: 'none',
      blockReasons: [],
    });
    expect(readyDecision.provider).toBe('local');

    const blockedLocal = classifyAssistantProviderReadiness({
      provider: 'local',
      model: 'llama3.1',
      credentialReference: reference({
        kind: 'local-bridge',
        id: 'local-bridge:llm/assistant-provider',
        storageOwner: 'local-bridge',
        providerId: 'local',
      }),
      localEndpointCandidates: ['127.0.0.1:11434/v1'],
    });

    const blockedDecision = evaluateTrustedGate({
      action: 'send_prompt',
      readiness: blockedLocal,
      explicitUserAction: explicitAction('send_prompt', 'local'),
      prompt: {
        messages: [{ role: 'user', content: 'Use the local provider fixture.' }],
      },
    });

    expect(blockedDecision.blockReasons).toEqual(expect.arrayContaining([
      'provider_not_configured',
      'local_endpoint_not_allowed',
      'readiness_local_endpoint_unbound',
    ]));
  });

  it('fails closed for ready-shaped local readiness without bound allowed endpoint provenance', () => {
    const readiness = configuredReadiness('local');
    const decision = evaluateTrustedGate({
      action: 'send_prompt',
      readiness: {
        ...readiness,
        localBridgePlan: undefined,
      },
      explicitUserAction: explicitAction('send_prompt', 'local'),
      prompt: {
        messages: [{ role: 'user', content: 'Use the local provider fixture.' }],
      },
    });

    expect(decision).toMatchObject({
      status: 'block',
      provider: 'local',
      executable: false,
      sideEffects: 'none',
      blockReasons: expect.arrayContaining([
        'local_endpoint_not_allowed',
        'readiness_local_endpoint_unbound',
      ]),
    });
  });

  it('fails closed for forged allowed local readiness flags on an external endpoint', () => {
    const readiness = configuredReadiness('local');
    const decision = evaluateTrustedGate({
      action: 'send_prompt',
      readiness: {
        ...readiness,
        localBridgePlan: {
          ...readiness.localBridgePlan!,
          allowed: true,
          status: 'ready',
          acceptedCount: 1,
          rejectedCount: 0,
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
      },
      explicitUserAction: explicitAction('send_prompt', 'local'),
      prompt: {
        messages: [{ role: 'user', content: 'Use the local provider fixture.' }],
      },
    });

    expect(decision).toMatchObject({
      status: 'block',
      provider: 'local',
      executable: false,
      sideEffects: 'none',
      blockReasons: expect.arrayContaining([
        'local_endpoint_not_allowed',
        'readiness_local_endpoint_unbound',
      ]),
    });
  });

  it('fails closed when local readiness carries multiple accepted endpoints or unsafe provider/model metadata', () => {
    const readiness = configuredReadiness('local');
    const endpointDriftDecision = evaluateTrustedGate({
      action: 'send_prompt',
      readiness: {
        ...readiness,
        localBridgePlan: {
          ...readiness.localBridgePlan!,
          acceptedCount: 2,
          rejectedCount: 0,
          candidates: [
            ...readiness.localBridgePlan!.candidates,
            {
              input: 'http://127.0.0.1:11435/v1',
              normalizedEndpoint: 'http://127.0.0.1:11435/v1',
              host: '127.0.0.1',
              scope: 'loopback',
              accepted: true,
              probe: {
                method: 'GET',
                url: 'http://127.0.0.1:11435/health',
                timeoutMs: 2_000,
                allowed: true,
                consentRequired: false,
                sideEffectBoundary: 'plan-only-no-fetch-no-socket',
              },
              rejectionReasons: [],
            },
          ],
        },
      },
      explicitUserAction: explicitAction('send_prompt', 'local'),
      prompt: {
        messages: [{ role: 'user', content: 'Use the local provider fixture.' }],
      },
    });

    expect(endpointDriftDecision).toMatchObject({
      status: 'block',
      provider: 'local',
      executable: false,
      sideEffects: 'none',
      blockReasons: expect.arrayContaining([
        'local_endpoint_not_allowed',
        'readiness_local_endpoint_unbound',
      ]),
    });
    expect(endpointDriftDecision.localEndpoint).toBeUndefined();

    const unsafeModelDecision = evaluateTrustedGate({
      action: 'disable_provider',
      readiness: {
        ...configuredReadiness(),
        model: 'sk-synthetic-model-token' as never,
      },
      explicitUserAction: explicitAction('disable_provider'),
    });

    expect(unsafeModelDecision).toMatchObject({
      status: 'block',
      model: undefined,
      blockReasons: expect.arrayContaining(['readiness_model_mismatch']),
    });
    expect(JSON.stringify(unsafeModelDecision)).not.toContain('sk-synthetic-model-token');

    const unsafeProviderDecision = evaluateTrustedGate({
      action: 'disable_provider',
      readiness: {
        ...configuredReadiness(),
        provider: 'sk-provider-route' as never,
      },
      explicitUserAction: explicitAction('disable_provider'),
    });

    expect(unsafeProviderDecision).toMatchObject({
      status: 'block',
      provider: undefined,
      blockReasons: expect.arrayContaining(['readiness_provider_unbound']),
    });
    expect(JSON.stringify(unsafeProviderDecision)).not.toContain('sk-provider-route');
  });

  it('validates opaque credential references and rejects raw secret material without echoing it', () => {
    const decision = evaluateTrustedGate({
      action: 'send_prompt',
      readiness: configuredReadiness(),
      credentialReference: {
        ...reference(),
        accessToken: 'sk-synthetic-placeholder',
      },
      explicitUserAction: explicitAction('send_prompt'),
      prompt: {
        messages: [{ role: 'user', content: 'hello' }],
      },
    });

    expect(decision).toMatchObject({
      status: 'block',
      credentialReference: undefined,
      credentialRejectReason: 'secret_material_detected',
      blockReasons: expect.arrayContaining(['credential_reference_invalid']),
    });
    expect(JSON.stringify(decision)).not.toContain('sk-synthetic-placeholder');
  });

  it('blocks prompts that are absent or above the local prompt safety limit', () => {
    expect(evaluateTrustedGate({
      action: 'send_prompt',
      readiness: configuredReadiness(),
      explicitUserAction: explicitAction('send_prompt'),
    })).toMatchObject({
      status: 'block',
      blockReasons: expect.arrayContaining(['prompt_missing']),
    });

    const decision = evaluateTrustedGate({
      action: 'send_prompt',
      readiness: configuredReadiness(),
      explicitUserAction: explicitAction('send_prompt'),
      prompt: {
        maxChars: 128,
        messages: [{ role: 'user', content: 'x'.repeat(512) }],
      },
    });

    expect(decision.status).toBe('block');
    expect(decision.promptEstimateChars).toBeGreaterThan(128);
    expect(decision.blockReasons).toEqual(expect.arrayContaining(['prompt_too_large']));
  });

  it('rejects raw proxy and accessor roots before semantic reads or getter execution', () => {
    const trapCounts = {
      get: 0,
      ownKeys: 0,
      getOwnPropertyDescriptor: 0,
      getPrototypeOf: 0,
    };
    const proxyRoot = new Proxy({ action: 'disable_provider' }, {
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
    let getterCalls = 0;
    const accessorRoot = {};
    Object.defineProperty(accessorRoot, 'action', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 'disable_provider';
      },
    });

    expect(evaluateAssistantProviderExecutionGate(proxyRoot as never)).toMatchObject({
      status: 'block',
      action: 'unknown',
      executable: false,
      blockReasons: ['unknown_action'],
    });
    expect(evaluateAssistantProviderExecutionGate(accessorRoot as never)).toMatchObject({
      status: 'block',
      action: 'unknown',
      executable: false,
      blockReasons: ['unknown_action'],
    });
    expect(evaluateAssistantProviderExecutionGate({
      action: 'disable_provider',
    } as never)).toMatchObject({
      status: 'block',
      action: 'unknown',
      blockReasons: ['unknown_action'],
    });
    expect(trapCounts).toEqual({
      get: 0,
      ownKeys: 0,
      getOwnPropertyDescriptor: 0,
      getPrototypeOf: 0,
    });
    expect(getterCalls).toBe(0);
  });

  it('rejects trusted roots with unsafe requester fetch socket storage stream or live-action fields', () => {
    const decision = evaluateTrustedGate({
      action: 'send_prompt',
      readiness: configuredReadiness(),
      explicitUserAction: explicitAction('send_prompt'),
      prompt: {
        messages: [{ role: 'user', content: 'hello' }],
        fetchPlan: 'https://provider.example/v1/chat/completions',
      },
    });

    expect(decision).toMatchObject({
      status: 'block',
      action: 'unknown',
      executable: false,
      blockReasons: ['unknown_action'],
    });
    expect(JSON.stringify(decision)).not.toContain('provider.example');
  });

  it('performs no fetch, storage, socket, provider, browser, or LLM side effects', () => {
    expectNoSideEffects();
  });
});
