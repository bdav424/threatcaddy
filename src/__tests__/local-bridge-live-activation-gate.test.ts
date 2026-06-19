import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateLocalBridgeLiveActivationGate,
  type LocalBridgeLiveActivationFacts,
  type LocalBridgeLiveActivationTransportRequest,
} from '../lib/local-bridge-live-activation-gate';
import type { LocalBridgeRequesterExecutionBoundaryDecision } from '../lib/local-bridge-requester-execution-boundary';
import {
  evaluateLocalBridgeRequesterInvocationImplementationBoundary,
  type LocalBridgeRequesterInvocationExecutableContract,
  type LocalBridgeRequesterInvocationFacts,
  type LocalBridgeRequesterInvocationImplementationDecision,
} from '../lib/local-bridge-requester-invocation-implementation-boundary';
import {
  createRuntimeTrustedContractObject,
  type RuntimeTrustedContractValue,
} from '../lib/runtime-trusted-contract-object';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const EXECUTION_BOUNDARY =
  'requester-execution-boundary-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-callback' as const;
const INVOCATION_BOUNDARY =
  'pure-local-requester-invocation-implementation-boundary-no-callback-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-requester-call' as const;
const REQUESTER_FACTS_BOUNDARY =
  'requester-invocation-facts-only-no-callback-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-requester-call' as const;
const EXECUTABLE_CONTRACT_BOUNDARY =
  'reviewed-injected-local-bridge-requester-executable-contract-no-callback-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-requester-call' as const;
const REQUESTER_INVOCATION_BOUNDARY =
  'local-bridge-requester-execution-boundary-prepares-decision-only-invocation-no-requester-call' as const;
const FACTS_BOUNDARY =
  'local-bridge-live-activation-facts-only-no-requester-call-no-fetch-no-socket-no-storage-no-provider-no-credentials' as const;

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
  if (typeof value === 'object') return trustedRecord(value as Record<string, unknown>) as RuntimeTrustedContractValue;
  throw new TypeError('Test trusted contract fixtures cannot include callable values.');
}

function trustedRecord<T extends Record<string, unknown>>(value: T): T {
  return createRuntimeTrustedContractObject(
    Object.entries(value).map(([key, nested]) => [key, trustedValue(nested)] as const),
  ) as unknown as T;
}

function makeExecutionBoundary(
  overrides: Partial<LocalBridgeRequesterExecutionBoundaryDecision> = {},
): LocalBridgeRequesterExecutionBoundaryDecision {
  return trustedRecord({
    status: 'eligible',
    eligible: true,
    metadata: {
      schemaVersion: 1,
      metadataKind: 'local-bridge-requester-execution-boundary',
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
      transport: {
        method: 'GET',
        url: 'http://127.0.0.1:11434/health',
        timeoutMs: 2_000,
      },
      credentialReferenceId: 'local-bridge:assistantcaddy/llm',
      dryRunResultId: 'dry-run-result-001',
      requesterFactReviewState: 'reviewed',
      executionEligible: true,
      canPrepareFutureRequesterInvocation: true,
      invocationMode: 'decision-only',
      requesterCallable: false,
      willInvokeRequester: false,
      willProbeLocalBridge: false,
      willCallProvider: false,
      willMutateStorage: false,
      willStoreCredential: false,
      dispatchAllowed: false,
      executable: false,
      sideEffects: 'none',
      requesterInvocationBoundary: REQUESTER_INVOCATION_BOUNDARY,
      sideEffectBoundary: EXECUTION_BOUNDARY,
    },
    blockers: [],
    sideEffectBoundary: EXECUTION_BOUNDARY,
    ...overrides,
  }) as unknown as LocalBridgeRequesterExecutionBoundaryDecision;
}

function makeRequesterFacts(
  overrides: Partial<LocalBridgeRequesterInvocationFacts> = {},
): LocalBridgeRequesterInvocationFacts {
  return trustedRecord({
    contract: 'local-bridge-requester-invocation-implementation-facts-v1',
    capabilityId: 'local-bridge-requester.llm.health',
    requesterId: 'browser-injected-local-bridge-requester',
    requesterVersion: '1.0.0',
    ownerSurface: 'assistantcaddy-local-bridge-setup',
    actionId: 'probe_local_bridge',
    bridgeKind: 'llm',
    acceptedEndpoint: 'http://127.0.0.1:11434/v1',
    method: 'GET',
    url: 'http://127.0.0.1:11434/health',
    timeoutMs: 2_000,
    credentialReferenceId: 'local-bridge:assistantcaddy/llm',
    dryRunResultId: 'dry-run-result-001',
    requesterImplementationId: 'assistantcaddy-local-bridge-requester-package',
    requesterPackageVersion: '2026.06.12',
    reviewState: 'reviewed',
    invocationMode: 'decision-only',
    executable: false,
    requesterCallable: false,
    willInvokeRequester: false,
    willProbeLocalBridge: false,
    willCallProvider: false,
    willMutateStorage: false,
    willStoreCredential: false,
    sideEffectBoundary: REQUESTER_FACTS_BOUNDARY,
    ...overrides,
  }) as unknown as LocalBridgeRequesterInvocationFacts;
}

function makeRequesterExecutableContract(
  overrides: Partial<LocalBridgeRequesterInvocationExecutableContract> = {},
): LocalBridgeRequesterInvocationExecutableContract {
  return trustedRecord({
    contract: 'local-bridge-requester-invocation-executable-contract-v1',
    contractKind: 'reviewed-injected-local-bridge-requester-executable-contract',
    capabilityId: 'local-bridge-requester.llm.health',
    requesterId: 'browser-injected-local-bridge-requester',
    requesterVersion: '1.0.0',
    ownerSurface: 'assistantcaddy-local-bridge-setup',
    actionId: 'probe_local_bridge',
    bridgeKind: 'llm',
    acceptedEndpoint: 'http://127.0.0.1:11434/v1',
    method: 'GET',
    url: 'http://127.0.0.1:11434/health',
    timeoutMs: 2_000,
    credentialReferenceId: 'local-bridge:assistantcaddy/llm',
    dryRunResultId: 'dry-run-result-001',
    requesterImplementationId: 'assistantcaddy-local-bridge-requester-package',
    requesterPackageVersion: '2026.06.12',
    requesterContractId: 'assistantcaddy-local-bridge-requester-contract',
    requesterContractVersion: '2026.06.12.1',
    reviewState: 'reviewed',
    injectionMode: 'explicit-reviewed-injected-requester',
    resultRedaction: 'result-body-omitted',
    headersRedaction: 'headers-omitted',
    bodyRedaction: 'body-omitted',
    supportsExecution: true,
    requiresExplicitUserApprovalBeforeRequest: true,
    executable: false,
    requesterCallable: false,
    dispatchAllowed: false,
    willInvokeRequester: false,
    willProbeLocalBridge: false,
    willCallProvider: false,
    willMutateStorage: false,
    willStoreCredential: false,
    sideEffects: 'none',
    sideEffectBoundary: EXECUTABLE_CONTRACT_BOUNDARY,
    ...overrides,
  }) as unknown as LocalBridgeRequesterInvocationExecutableContract;
}

type PreparedExecutableContract =
  NonNullable<LocalBridgeRequesterInvocationImplementationDecision['executableContract']>;

function makePreparedExecutableContract(
  overrides: Partial<PreparedExecutableContract> = {},
): PreparedExecutableContract {
  return trustedRecord({
    contract: 'local-bridge-requester-invocation-prepared-executable-contract-v1',
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
    transport: {
      method: 'GET',
      url: 'http://127.0.0.1:11434/health',
      timeoutMs: 2_000,
    },
    credentialReferenceId: 'local-bridge:assistantcaddy/llm',
    dryRunResultId: 'dry-run-result-001',
    requesterImplementationId: 'assistantcaddy-local-bridge-requester-package',
    requesterPackageVersion: '2026.06.12',
    requesterContractId: 'assistantcaddy-local-bridge-requester-contract',
    requesterContractVersion: '2026.06.12.1',
    injectionMode: 'explicit-reviewed-injected-requester',
    resultRedaction: 'result-body-omitted',
    headersRedaction: 'headers-omitted',
    bodyRedaction: 'body-omitted',
    supportsExecution: true,
    requiresExplicitUserApprovalBeforeRequest: true,
    dispatchAllowed: false,
    executable: false,
    requesterCallable: false,
    willInvokeRequester: false,
    willProbeLocalBridge: false,
    willCallProvider: false,
    willMutateStorage: false,
    willStoreCredential: false,
    sideEffects: 'none',
    sideEffectBoundary: EXECUTABLE_CONTRACT_BOUNDARY,
    ...overrides,
  }) as unknown as PreparedExecutableContract;
}

function makeInvocationBoundary(
  overrides: Partial<LocalBridgeRequesterInvocationImplementationDecision> = {},
): LocalBridgeRequesterInvocationImplementationDecision {
  return trustedRecord({
    status: 'ready',
    ready: true,
    reason: 'requester_invocation_boundary_ready',
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
    transport: {
      method: 'GET',
      url: 'http://127.0.0.1:11434/health',
      timeoutMs: 2_000,
    },
    credentialReferenceId: 'local-bridge:assistantcaddy/llm',
    dryRunResultId: 'dry-run-result-001',
    requesterImplementationId: 'assistantcaddy-local-bridge-requester-package',
    requesterPackageVersion: '2026.06.12',
    canPrepareFutureRequesterInvocation: true,
    executableContract: makePreparedExecutableContract(),
    invocationMode: 'decision-only',
    executable: false,
    requesterCallable: false,
    willInvokeRequester: false,
    willProbeLocalBridge: false,
    willCallProvider: false,
    willMutateStorage: false,
    willStoreCredential: false,
    sideEffectBoundary: INVOCATION_BOUNDARY,
    ...overrides,
  }) as unknown as LocalBridgeRequesterInvocationImplementationDecision;
}

function makeActivationFacts(
  overrides: Partial<LocalBridgeLiveActivationFacts> = {},
): LocalBridgeLiveActivationFacts {
  return trustedRecord({
    contract: 'local-bridge-live-activation-facts-v1',
    capabilityId: 'local-bridge-requester.llm.health',
    requesterId: 'browser-injected-local-bridge-requester',
    requesterVersion: '1.0.0',
    ownerSurface: 'assistantcaddy-local-bridge-setup',
    actionId: 'probe_local_bridge',
    bridgeKind: 'llm',
    reviewedAcceptedEndpoints: ['http://127.0.0.1:11434/v1'],
    operationKind: 'probe-local-bridge-health-read',
    credentialReferenceId: 'local-bridge:assistantcaddy/llm',
    dryRunResultId: 'dry-run-result-001',
    requesterImplementationId: 'assistantcaddy-local-bridge-requester-package',
    requesterPackageVersion: '2026.06.12',
    reviewState: 'reviewed',
    userApproval: {
      scope: 'activate-reviewed-local-bridge-requester',
      granted: true,
      acknowledgedPlanOnly: true,
    },
    executable: false,
    requesterCallable: false,
    dispatchAllowed: false,
    willInvokeRequester: false,
    willProbeLocalBridge: false,
    willCallProvider: false,
    willMutateStorage: false,
    willStoreCredential: false,
    sideEffects: 'none',
    sideEffectBoundary: FACTS_BOUNDARY,
    ...overrides,
  }) as unknown as LocalBridgeLiveActivationFacts;
}

function makeTransportRequest(
  overrides: Partial<LocalBridgeLiveActivationTransportRequest> = {},
): LocalBridgeLiveActivationTransportRequest {
  return trustedRecord({
    method: 'GET',
    url: 'http://127.0.0.1:11434/health',
    timeoutMs: 2_000,
    ...overrides,
  }) as unknown as LocalBridgeLiveActivationTransportRequest;
}

function validInput(
  overrides: Partial<Parameters<typeof evaluateLocalBridgeLiveActivationGate>[0]> = {},
) {
  return trustedRecord({
    executionBoundary: makeExecutionBoundary(),
    invocationBoundary: makeInvocationBoundary(),
    activationFacts: makeActivationFacts(),
    transportRequest: makeTransportRequest(),
    ...overrides,
  });
}

function trappedObject(traps: string[]): Record<string, unknown> {
  return new Proxy(Object.create(null) as Record<string, unknown>, {
    defineProperty() {
      traps.push('defineProperty');
      return false;
    },
    deleteProperty() {
      traps.push('deleteProperty');
      return false;
    },
    get(_target, property) {
      traps.push(`get:${String(property)}`);
      return undefined;
    },
    getOwnPropertyDescriptor() {
      traps.push('getOwnPropertyDescriptor');
      return undefined;
    },
    getPrototypeOf() {
      traps.push('getPrototypeOf');
      return null;
    },
    has() {
      traps.push('has');
      return false;
    },
    isExtensible() {
      traps.push('isExtensible');
      return true;
    },
    ownKeys() {
      traps.push('ownKeys');
      return [];
    },
    preventExtensions() {
      traps.push('preventExtensions');
      return false;
    },
    set() {
      traps.push('set');
      return false;
    },
    setPrototypeOf() {
      traps.push('setPrototypeOf');
      return false;
    },
  });
}

describe('local bridge live activation gate', () => {
  it('returns a frozen plan-only activation plan after exact reviewed loopback and requester facts match', () => {
    const decision = evaluateLocalBridgeLiveActivationGate(validInput());

    expect(decision).toMatchObject({
      status: 'ready',
      ready: true,
      reason: 'live_activation_gate_ready',
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
      sideEffectBoundary: 'local-bridge-live-activation-gate-plan-only-no-requester-call-no-fetch-no-socket-no-storage-no-provider-no-credentials',
      plan: {
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
        requiresUserApprovalBeforeRequest: true,
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
    expect(JSON.stringify(decision)).not.toContain('headers');
    expect(JSON.stringify(decision)).not.toContain('body');
  });

  it('accepts the requester invocation boundary output only when its prepared executable contract is bound', () => {
    const executionBoundary = makeExecutionBoundary();
    const invocationBoundary = evaluateLocalBridgeRequesterInvocationImplementationBoundary(trustedRecord({
      executionBoundary,
      requesterFacts: makeRequesterFacts(),
      executableContract: makeRequesterExecutableContract(),
    }));

    expect(invocationBoundary).toMatchObject({
      status: 'ready',
      reason: 'requester_invocation_boundary_ready',
      executableContract: {
        contract: 'local-bridge-requester-invocation-prepared-executable-contract-v1',
        resultRedaction: 'result-body-omitted',
        sideEffects: 'none',
        sideEffectBoundary: EXECUTABLE_CONTRACT_BOUNDARY,
      },
      willInvokeRequester: false,
      willProbeLocalBridge: false,
    });

    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      executionBoundary,
      invocationBoundary,
    }))).toMatchObject({
      status: 'ready',
      reason: 'live_activation_gate_ready',
      plan: {
        requesterImplementationId: 'assistantcaddy-local-bridge-requester-package',
        requesterPackageVersion: '2026.06.12',
      },
      willInvokeRequester: false,
      willProbeLocalBridge: false,
    });
  });

  it('fails closed when the invocation prepared executable contract is missing, malformed, or drifted', () => {
    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      invocationBoundary: makeInvocationBoundary({
        executableContract: undefined,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'invocation_executable_contract_missing',
      ready: false,
      requesterCallable: false,
    });

    const callback = vi.fn();
    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      invocationBoundary: makeInvocationBoundary({
        executableContract: {
          ...makePreparedExecutableContract(),
          callback: 'callback-placeholder',
        } as unknown as PreparedExecutableContract,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'invocation_executable_contract_invalid',
      willInvokeRequester: false,
      willProbeLocalBridge: false,
    });
    expect(callback).not.toHaveBeenCalled();

    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      invocationBoundary: makeInvocationBoundary({
        executableContract: makePreparedExecutableContract({
          willProbeLocalBridge: true as unknown as false,
        }),
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'invocation_executable_contract_invalid',
      willProbeLocalBridge: false,
    });

    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      invocationBoundary: makeInvocationBoundary({
        executableContract: makePreparedExecutableContract({
          requesterPackageVersion: '2026.06.13',
        }),
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'invocation_executable_contract_mismatch',
    });
  });

  it('fails closed for endpoint drift, multiple reviewed endpoints, and missing dry-run proof', () => {
    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      activationFacts: makeActivationFacts({
        reviewedAcceptedEndpoints: [
          'http://127.0.0.1:11434/v1',
          'http://127.0.0.1:8766/v1',
        ],
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'endpoint_count_invalid',
      ready: false,
    });

    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      activationFacts: makeActivationFacts({
        reviewedAcceptedEndpoints: ['http://127.0.0.1:8766/v1'],
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'endpoint_drift_detected',
    });

    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      executionBoundary: (() => {
        const base = makeExecutionBoundary();
        return makeExecutionBoundary({
          metadata: Object.freeze({
            ...base.metadata!,
            transport: Object.freeze({
              ...base.metadata!.transport,
              url: 'http://127.0.0.1:8766/health',
            }),
          }) as never,
        });
      })(),
      invocationBoundary: makeInvocationBoundary({
        transport: Object.freeze({
          method: 'GET',
          url: 'http://127.0.0.1:8766/health',
          timeoutMs: 2_000,
        }),
        executableContract: makePreparedExecutableContract({
          transport: Object.freeze({
            method: 'GET',
            url: 'http://127.0.0.1:8766/health',
            timeoutMs: 2_000,
          }),
        }),
      }),
      transportRequest: makeTransportRequest({
        url: 'http://127.0.0.1:8766/health',
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'execution_boundary_invalid',
    });

    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      executionBoundary: (() => {
        const base = makeExecutionBoundary();
        return makeExecutionBoundary({
          metadata: Object.freeze({
            ...base.metadata!,
            dryRunResultId: undefined,
          }) as never,
        });
      })(),
      invocationBoundary: makeInvocationBoundary({
        dryRunResultId: undefined,
        executableContract: makePreparedExecutableContract({
          dryRunResultId: undefined,
        }),
      }),
      activationFacts: makeActivationFacts({
        dryRunResultId: undefined,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'dry_run_proof_missing',
    });
  });

  it('fails closed for ungranted approval, invalid approval scope, and operation drift', () => {
    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      activationFacts: makeActivationFacts({
        userApproval: {
          scope: 'activate-reviewed-local-bridge-requester',
          granted: false,
          acknowledgedPlanOnly: true,
        },
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'user_approval_not_granted',
    });

    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      activationFacts: makeActivationFacts({
        userApproval: {
          scope: 'activate-something-else',
          granted: true,
          acknowledgedPlanOnly: true,
        } as never,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'user_approval_invalid',
    });

    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      activationFacts: makeActivationFacts({
        operationKind: 'write-local-bridge' as never,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'operation_kind_invalid',
    });
  });

  it('rejects untrusted root and nested proxy or accessor inputs before traps or getters execute', () => {
    const rootTraps: string[] = [];
    const nestedTraps: string[] = [];
    const getter = vi.fn();
    const accessorRoot = {};
    Object.defineProperty(accessorRoot, 'executionBoundary', {
      enumerable: true,
      get: getter,
    });

    expect(evaluateLocalBridgeLiveActivationGate(trappedObject(rootTraps) as never))
      .toMatchObject({ status: 'blocked', reason: 'activation_facts_invalid' });
    expect(evaluateLocalBridgeLiveActivationGate({
      executionBoundary: trappedObject(nestedTraps),
    } as never)).toMatchObject({ status: 'blocked', reason: 'activation_facts_invalid' });
    expect(evaluateLocalBridgeLiveActivationGate(accessorRoot as never))
      .toMatchObject({ status: 'blocked', reason: 'activation_facts_invalid' });

    expect(rootTraps).toEqual([]);
    expect(nestedTraps).toEqual([]);
    expect(getter).not.toHaveBeenCalled();
  });

  it('rejects scheme-shaped generic identifiers while preserving local-bridge credential references', () => {
    const validDecision = evaluateLocalBridgeLiveActivationGate(validInput());

    expect(validDecision.status).toBe('ready');
    expect(validDecision.plan?.credentialReferenceId).toBe('local-bridge:assistantcaddy/llm');

    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      executionBoundary: makeExecutionBoundary({
        metadata: {
          ...makeExecutionBoundary().metadata!,
          capability: {
            ...makeExecutionBoundary().metadata!.capability,
            id: 'mailto:user@example.test',
          },
          dryRunResultId: 'urn:provider:opaque',
        } as never,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'execution_boundary_invalid',
    });

    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      invocationBoundary: makeInvocationBoundary({
        requesterImplementationId: 'mailto:user@example.test',
        requesterPackageVersion: 'urn:provider:opaque',
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'invocation_boundary_invalid',
    });

    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      invocationBoundary: makeInvocationBoundary({
        executableContract: makePreparedExecutableContract({
          requesterContractId: 'mailto:user@example.test',
          requesterContractVersion: 'urn:provider:opaque',
        }),
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'invocation_executable_contract_invalid',
    });

    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      activationFacts: makeActivationFacts({
        capabilityId: 'mailto:user@example.test',
        requesterImplementationId: 'urn:provider:opaque',
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'activation_facts_invalid',
    });
  });

  it('rejects forbidden live requester, transport, result, and header/body-shaped request input without side effects', () => {
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

    const requester = { request: vi.fn() };
    const transportSend = vi.fn();

    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      requester: 'requester-placeholder' as never,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'direct_requester_forbidden',
    });

    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      transport: 'transport-placeholder' as never,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'live_transport_forbidden',
    });

    expect(evaluateLocalBridgeLiveActivationGate({
      ...validInput(),
      requester,
      transport: { send: transportSend },
    } as never)).toMatchObject({
      status: 'blocked',
      reason: 'activation_facts_invalid',
    });

    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      fetchClient: 'forbidden-live-fetch-placeholder',
    } as never))).toMatchObject({
      status: 'blocked',
      reason: 'activation_facts_invalid',
      requesterCallable: false,
      willInvokeRequester: false,
    });

    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      requesterResult: { executed: true },
    }))).toMatchObject({
      status: 'blocked',
      reason: 'live_result_forbidden',
    });

    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      transportRequest: {
        ...makeTransportRequest(),
        headers: {},
      } as never,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'transport_request_invalid',
    });

    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      transportRequest: {
        ...makeTransportRequest(),
        body: { ping: true },
      } as never,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'transport_request_invalid',
    });

    expect(requester.request).not.toHaveBeenCalled();
    expect(transportSend).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(webSocketSpy).not.toHaveBeenCalled();
    expect(eventSourceSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('rejects secret-bearing urls and token-like values anywhere in caller input', () => {
    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      transportRequest: {
        method: 'GET',
        url: 'http://127.0.0.1:11434/health?token=abc123secret',
        timeoutMs: 2_000,
      },
    }))).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });

    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      activationFacts: makeActivationFacts({
        requesterImplementationId: 'sk-live-secret-value',
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });

    expect(evaluateLocalBridgeLiveActivationGate(validInput({
      transportRequest: {
        ...makeTransportRequest(),
        headers: {
          authorization: 'Bearer test-secret-token',
        },
      } as never,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });
  });
});
