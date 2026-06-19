import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateLocalBridgeRuntimeActivationPlan,
} from '../lib/local-bridge-runtime-activation-plan';
import type {
  LocalBridgeLiveActivationGateDecision,
  LocalBridgeLiveActivationPlan,
} from '../lib/local-bridge-live-activation-gate';
import type {
  LocalBridgeRequesterExecutionBoundaryDecision,
  LocalBridgeRequesterExecutionBoundaryMetadata,
} from '../lib/local-bridge-requester-execution-boundary';
import {
  createRuntimeTrustedContractObject,
  type RuntimeTrustedContractEntry,
  type RuntimeTrustedContractValue,
} from '../lib/runtime-trusted-contract-object';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const LIVE_ACTIVATION_BOUNDARY =
  'local-bridge-live-activation-gate-plan-only-no-requester-call-no-fetch-no-socket-no-storage-no-provider-no-credentials' as const;
const EXECUTION_BOUNDARY =
  'requester-execution-boundary-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-callback' as const;

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
  if (Array.isArray(value)) {
    return Object.freeze(value.map((nestedValue) => trustedValue(nestedValue)));
  }
  if (typeof value === 'object') {
    return trustedRecord(value as Record<string, unknown>) as RuntimeTrustedContractValue;
  }
  throw new TypeError('Trusted local bridge runtime activation fixtures cannot include executable values.');
}

function trustedRecord<T extends Record<string, unknown>>(value: T): T {
  const entries: RuntimeTrustedContractEntry[] = Object.entries(value).map(([key, nestedValue]) => [
    key,
    trustedValue(nestedValue),
  ]);
  return createRuntimeTrustedContractObject(entries) as unknown as T;
}

function makeExecutionBoundary(
  overrides: Partial<LocalBridgeRequesterExecutionBoundaryDecision> = {},
): LocalBridgeRequesterExecutionBoundaryDecision {
  const decision: LocalBridgeRequesterExecutionBoundaryDecision = {
    status: 'eligible',
    eligible: true,
    metadata: trustedRecord({
      schemaVersion: 1,
      metadataKind: 'local-bridge-requester-execution-boundary',
      capability: trustedRecord({
        id: 'local-bridge-requester.llm.health',
        requesterId: 'browser-injected-local-bridge-requester',
        requesterVersion: '1.0.0',
      }),
      owner: trustedRecord({
        ownerSurface: 'assistantcaddy-local-bridge-setup',
        actionId: 'probe_local_bridge',
      }),
      bridge: trustedRecord({
        bridgeKind: 'llm',
        acceptedEndpoint: 'http://127.0.0.1:11434/v1',
      }),
      transport: trustedRecord({
        method: 'GET',
        url: 'http://127.0.0.1:11434/health',
        timeoutMs: 2_000,
      }),
      credentialReferenceId: 'local-bridge:assistantcaddy/llm',
      dryRunResultId: 'dry-run-result-001',
      requesterFactReviewState: 'reviewed',
      executionEligible: true,
      willInvokeRequester: false,
      willProbeLocalBridge: false,
      willCallProvider: false,
      willMutateStorage: false,
      dispatchAllowed: false,
      executable: false,
      sideEffects: 'none',
      sideEffectBoundary: EXECUTION_BOUNDARY,
    } as const) as unknown as LocalBridgeRequesterExecutionBoundaryMetadata,
    blockers: Object.freeze([]),
    sideEffectBoundary: EXECUTION_BOUNDARY,
    ...overrides,
  };
  return trustedRecord(decision as unknown as Record<string, unknown>) as unknown as LocalBridgeRequesterExecutionBoundaryDecision;
}

function makeLiveActivationDecision(
  overrides: Partial<LocalBridgeLiveActivationGateDecision> = {},
): LocalBridgeLiveActivationGateDecision {
  const decision: LocalBridgeLiveActivationGateDecision = {
    status: 'ready',
    ready: true,
    reason: 'live_activation_gate_ready',
    plan: trustedRecord({
      capability: trustedRecord({
        id: 'local-bridge-requester.llm.health',
        requesterId: 'browser-injected-local-bridge-requester',
        requesterVersion: '1.0.0',
      }),
      owner: trustedRecord({
        ownerSurface: 'assistantcaddy-local-bridge-setup',
        actionId: 'probe_local_bridge',
      }),
      bridge: trustedRecord({
        bridgeKind: 'llm',
        acceptedEndpoint: 'http://127.0.0.1:11434/v1',
      }),
      operation: trustedRecord({
        kind: 'probe-local-bridge-health-read',
        method: 'GET',
        url: 'http://127.0.0.1:11434/health',
        timeoutMs: 2_000,
      }),
      credentialReferenceId: 'local-bridge:assistantcaddy/llm',
      dryRunResultId: 'dry-run-result-001',
      requesterImplementationId: 'assistantcaddy-local-bridge-requester-package',
      requesterPackageVersion: '2026.06.12',
      requiresUserApprovalBeforeRequest: true,
      executable: false,
      requesterCallable: false,
      dispatchAllowed: false,
      willInvokeRequester: false,
      willProbeLocalBridge: false,
      willCallProvider: false,
      willMutateStorage: false,
      willStoreCredential: false,
      sideEffects: 'none',
      sideEffectBoundary: LIVE_ACTIVATION_BOUNDARY,
    } as const) as unknown as LocalBridgeLiveActivationPlan,
    requiresUserApprovalBeforeRequest: true,
    executable: false,
    requesterCallable: false,
    dispatchAllowed: false,
    willInvokeRequester: false,
    willProbeLocalBridge: false,
    willCallProvider: false,
    willMutateStorage: false,
    willStoreCredential: false,
    sideEffects: 'none',
    sideEffectBoundary: LIVE_ACTIVATION_BOUNDARY,
    ...overrides,
  };
  return trustedRecord(decision as unknown as Record<string, unknown>) as unknown as LocalBridgeLiveActivationGateDecision;
}

function validInput(
  overrides: Partial<Parameters<typeof evaluateLocalBridgeRuntimeActivationPlan>[0]> = {},
) {
  return trustedRecord({
    liveActivationDecision: makeLiveActivationDecision(),
    executionBoundary: makeExecutionBoundary(),
    ...overrides,
  });
}

describe('local bridge runtime activation plan', () => {
  it('returns a frozen non-executable implementation plan only after live activation and requester execution metadata bind exactly', () => {
    const decision = evaluateLocalBridgeRuntimeActivationPlan(validInput());

    expect(decision).toMatchObject({
      status: 'ready',
      ready: true,
      reason: 'local_bridge_runtime_activation_plan_ready',
      canPrepareFutureLocalBridgeRuntimeActivation: true,
      requiresUserApprovalBeforeRequest: true,
      requiresExplicitRequesterInjection: true,
      executable: false,
      requesterCallable: false,
      dispatchAllowed: false,
      willInvokeRequester: false,
      willProbeLocalBridge: false,
      willCallProvider: false,
      willMutateStorage: false,
      willStoreCredential: false,
      sideEffects: 'none',
      sideEffectBoundary: 'local-bridge-runtime-activation-plan-only-no-requester-call-no-fetch-no-socket-no-storage-no-provider-no-credentials',
      plan: {
        contract: 'local-bridge-runtime-activation-plan-v1',
        acceptedLiveActivationBoundary: LIVE_ACTIVATION_BOUNDARY,
        acceptedExecutionBoundary: EXECUTION_BOUNDARY,
        capability: {
          id: 'local-bridge-requester.llm.health',
          requesterId: 'browser-injected-local-bridge-requester',
          requesterVersion: '1.0.0',
        },
        owner: {
          ownerSurface: 'assistantcaddy-local-bridge-setup',
          actionId: 'probe_local_bridge',
        },
        bridge: {
          bridgeKind: 'llm',
          acceptedEndpoint: 'http://127.0.0.1:11434/v1',
        },
        operation: {
          kind: 'probe-local-bridge-health-read',
          method: 'GET',
          url: 'http://127.0.0.1:11434/health',
          timeoutMs: 2_000,
        },
        credentialReferenceId: 'local-bridge:assistantcaddy/llm',
        dryRunResultId: 'dry-run-result-001',
        requesterImplementationId: 'assistantcaddy-local-bridge-requester-package',
        requesterPackageVersion: '2026.06.12',
        reviewedRequesterOwner: true,
        requiresUserApprovalBeforeRequest: true,
        requiresExplicitRequesterInjection: true,
        executable: false,
        requesterCallable: false,
        dispatchAllowed: false,
        sideEffects: 'none',
      },
    });

    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.plan)).toBe(true);
    expect(Object.isFrozen(decision.plan?.capability)).toBe(true);
    expect(Object.isFrozen(decision.plan?.owner)).toBe(true);
    expect(Object.isFrozen(decision.plan?.bridge)).toBe(true);
    expect(Object.isFrozen(decision.plan?.operation)).toBe(true);
  });

  it('rejects untrusted plain, proxy, and accessor roots before caller traps or getters execute', () => {
    const getterSpy = vi.fn();
    const accessorRoot = Object.defineProperty({}, 'liveActivationDecision', {
      enumerable: true,
      get: getterSpy,
    });
    const trapSpy = vi.fn();
    const proxyRoot = new Proxy({}, {
      get() {
        trapSpy('get');
        return undefined;
      },
      getOwnPropertyDescriptor() {
        trapSpy('getOwnPropertyDescriptor');
        return undefined;
      },
      getPrototypeOf() {
        trapSpy('getPrototypeOf');
        return Object.prototype;
      },
      has() {
        trapSpy('has');
        return false;
      },
      ownKeys() {
        trapSpy('ownKeys');
        return [];
      },
    });

    expect(evaluateLocalBridgeRuntimeActivationPlan({})).toMatchObject({
      status: 'blocked',
      reason: 'invalid_root_shape',
    });
    expect(evaluateLocalBridgeRuntimeActivationPlan(accessorRoot as never)).toMatchObject({
      status: 'blocked',
      reason: 'invalid_root_shape',
    });
    expect(evaluateLocalBridgeRuntimeActivationPlan(proxyRoot as never)).toMatchObject({
      status: 'blocked',
      reason: 'invalid_root_shape',
    });
    expect(getterSpy).not.toHaveBeenCalled();
    expect(trapSpy).not.toHaveBeenCalled();
  });

  it('fails closed when live activation is missing, blocked, or missing explicit approval guarantees', () => {
    expect(evaluateLocalBridgeRuntimeActivationPlan(trustedRecord({
      executionBoundary: makeExecutionBoundary(),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'live_activation_missing',
    });

    expect(evaluateLocalBridgeRuntimeActivationPlan(validInput({
      liveActivationDecision: makeLiveActivationDecision({
        status: 'blocked',
        ready: false,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'live_activation_not_ready',
    });

    expect(evaluateLocalBridgeRuntimeActivationPlan(validInput({
      liveActivationDecision: makeLiveActivationDecision(({
        requiresUserApprovalBeforeRequest: false,
        plan: trustedRecord({
          ...makeLiveActivationDecision().plan!,
          requiresUserApprovalBeforeRequest: false,
        }) as never,
      }) as never),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'user_approval_invalid',
    });
  });

  it('fails closed for endpoint count drift, non-loopback endpoints, and endpoint mismatches', () => {
    expect(evaluateLocalBridgeRuntimeActivationPlan(validInput({
      liveActivationDecision: {
        ...makeLiveActivationDecision(),
        plan: {
          ...makeLiveActivationDecision().plan!,
          acceptedEndpoints: [
            'http://127.0.0.1:11434/v1',
            'http://127.0.0.1:8766/v1',
          ],
        },
      } as never,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'endpoint_count_invalid',
    });

    expect(evaluateLocalBridgeRuntimeActivationPlan(validInput({
      liveActivationDecision: makeLiveActivationDecision({
        plan: trustedRecord({
          ...makeLiveActivationDecision().plan!,
          bridge: trustedRecord({
            ...makeLiveActivationDecision().plan!.bridge,
            acceptedEndpoint: 'https://bridge.example.invalid/v1',
          }),
        }) as never,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'endpoint_provenance_invalid',
    });

    expect(evaluateLocalBridgeRuntimeActivationPlan(validInput({
      liveActivationDecision: makeLiveActivationDecision({
        plan: trustedRecord({
          ...makeLiveActivationDecision().plan!,
          bridge: trustedRecord({
            ...makeLiveActivationDecision().plan!.bridge,
            acceptedEndpoint: 'http://127.0.0.1:8766/v1',
          }),
          operation: trustedRecord({
            ...makeLiveActivationDecision().plan!.operation,
            url: 'http://127.0.0.1:8766/health',
          }),
        }) as never,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'endpoint_drift_detected',
    });
  });

  it('fails closed for requester-owner or transport binding mismatches and invalid probe intent', () => {
    expect(evaluateLocalBridgeRuntimeActivationPlan(validInput({
      executionBoundary: makeExecutionBoundary({
        metadata: trustedRecord({
          ...makeExecutionBoundary().metadata!,
          owner: trustedRecord({
            ...makeExecutionBoundary().metadata!.owner,
            ownerSurface: 'different-owner',
          }),
        }) as never,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'requester_owner_invalid',
    });

    expect(evaluateLocalBridgeRuntimeActivationPlan(validInput({
      executionBoundary: makeExecutionBoundary({
        metadata: trustedRecord({
          ...makeExecutionBoundary().metadata!,
          transport: trustedRecord({
            ...makeExecutionBoundary().metadata!.transport,
            timeoutMs: 3_000,
          }),
        }) as never,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'transport_binding_invalid',
    });

    expect(evaluateLocalBridgeRuntimeActivationPlan(validInput({
      liveActivationDecision: makeLiveActivationDecision({
        plan: trustedRecord({
          ...makeLiveActivationDecision().plan!,
          operation: trustedRecord({
            ...makeLiveActivationDecision().plan!.operation,
            kind: 'other-probe-intent',
          }),
        }) as never,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'operation_intent_invalid',
    });
  });

  it('rejects forbidden requester and transport entry points plus secret-bearing request shapes without side effects', () => {
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

    expect(evaluateLocalBridgeRuntimeActivationPlan(validInput({
      requester: 'forbidden-requester-shape',
    }))).toMatchObject({
      status: 'blocked',
      reason: 'requester_injection_forbidden',
    });

    expect(evaluateLocalBridgeRuntimeActivationPlan(validInput({
      transport: trustedRecord({ send: 'disabled' }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'transport_shape_forbidden',
    });

    expect(evaluateLocalBridgeRuntimeActivationPlan(validInput({
      requesterResult: trustedRecord({ executed: true }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'runtime_result_forbidden',
    });

    expect(evaluateLocalBridgeRuntimeActivationPlan(validInput({
      liveActivationDecision: makeLiveActivationDecision({
        plan: trustedRecord({
          ...makeLiveActivationDecision().plan!,
          credentialReferenceId: 'Bearer synthetic-secret-token',
        }) as never,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });

    expect(evaluateLocalBridgeRuntimeActivationPlan(validInput({
      transportRequest: trustedRecord({
        headers: trustedRecord({
          authorization: 'Bearer synthetic-secret-token',
        }),
      }),
    } as never))).toMatchObject({
      status: 'blocked',
      reason: 'transport_shape_forbidden',
    });

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
