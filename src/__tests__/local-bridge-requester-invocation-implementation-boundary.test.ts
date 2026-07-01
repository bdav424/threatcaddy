import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateLocalBridgeRequesterInvocationImplementationBoundary,
  type LocalBridgeRequesterInvocationExecutableContract,
  type LocalBridgeRequesterInvocationFacts,
} from '../lib/local-bridge-requester-invocation-implementation-boundary';
import type { LocalBridgeRequesterExecutionBoundaryDecision } from '../lib/local-bridge-requester-execution-boundary';
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
const FACTS_BOUNDARY =
  'requester-invocation-facts-only-no-callback-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-requester-call' as const;
const EXECUTABLE_CONTRACT_BOUNDARY =
  'reviewed-injected-local-bridge-requester-executable-contract-no-callback-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-requester-call' as const;

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
      willInvokeRequester: false,
      willProbeLocalBridge: false,
      willCallProvider: false,
      willMutateStorage: false,
      dispatchAllowed: false,
      executable: false,
      sideEffects: 'none',
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
    sideEffectBoundary: FACTS_BOUNDARY,
    ...overrides,
  }) as unknown as LocalBridgeRequesterInvocationFacts;
}

function makeExecutableContract(
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

function validInput(
  overrides: Partial<Parameters<typeof evaluateLocalBridgeRequesterInvocationImplementationBoundary>[0]> = {},
) {
  return trustedRecord({
    executionBoundary: makeExecutionBoundary(),
    requesterFacts: makeRequesterFacts(),
    executableContract: makeExecutableContract(),
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

describe('local bridge requester invocation implementation boundary', () => {
  it('prepares frozen metadata and a redacted executable contract only after exact requester execution provenance is ready', () => {
    const decision = evaluateLocalBridgeRequesterInvocationImplementationBoundary(validInput());
    const serialized = JSON.stringify(decision);

    expect(decision).toMatchObject({
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
      executableContract: {
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
      },
      invocationMode: 'decision-only',
      executable: false,
      requesterCallable: false,
      willInvokeRequester: false,
      willProbeLocalBridge: false,
      willCallProvider: false,
      willMutateStorage: false,
      willStoreCredential: false,
      sideEffectBoundary: 'pure-local-requester-invocation-implementation-boundary-no-callback-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-requester-call',
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.capability)).toBe(true);
    expect(Object.isFrozen(decision.owner)).toBe(true);
    expect(Object.isFrozen(decision.bridge)).toBe(true);
    expect(Object.isFrozen(decision.transport)).toBe(true);
    expect(Object.isFrozen(decision.executableContract)).toBe(true);
    expect(Object.isFrozen(decision.executableContract?.capability)).toBe(true);
    expect(Object.isFrozen(decision.executableContract?.owner)).toBe(true);
    expect(Object.isFrozen(decision.executableContract?.bridge)).toBe(true);
    expect(Object.isFrozen(decision.executableContract?.transport)).toBe(true);
    expect(serialized).toContain('result-body-omitted');
    expect(serialized).not.toContain('raw-local-bridge-result');
    expect(serialized).not.toContain('request-headers');
  });

  it('requires an exact reviewed injected requester contract before readiness', () => {
    expect(evaluateLocalBridgeRequesterInvocationImplementationBoundary(validInput({
      executableContract: undefined,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'requester_executable_contract_missing',
      canPrepareFutureRequesterInvocation: false,
      executable: false,
    });

    expect(evaluateLocalBridgeRequesterInvocationImplementationBoundary(validInput({
      executableContract: makeExecutableContract({
        reviewState: 'draft',
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'requester_executable_contract_unreviewed',
      requesterCallable: false,
      willInvokeRequester: false,
    });

    expect(evaluateLocalBridgeRequesterInvocationImplementationBoundary(validInput({
      executableContract: makeExecutableContract({
        dryRunResultId: 'dry-run-result-other',
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'requester_executable_contract_mismatch',
      canPrepareFutureRequesterInvocation: false,
    });

    const callback = vi.fn();
    expect(evaluateLocalBridgeRequesterInvocationImplementationBoundary(validInput({
      executableContract: {
        ...makeExecutableContract(),
        callback: 'callback-placeholder',
      },
    }))).toMatchObject({
      status: 'blocked',
      reason: 'requester_executable_contract_invalid',
      requesterCallable: false,
      willInvokeRequester: false,
    });
    expect(callback).not.toHaveBeenCalled();

    expect(evaluateLocalBridgeRequesterInvocationImplementationBoundary(validInput({
      executableContract: {
        ...makeExecutableContract(),
        willProbeLocalBridge: true,
      } as unknown as LocalBridgeRequesterInvocationExecutableContract,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'requester_executable_contract_invalid',
      willProbeLocalBridge: false,
    });

    expect(evaluateLocalBridgeRequesterInvocationImplementationBoundary(validInput({
      executableContract: makeExecutableContract({
        requesterId: { nested: 'browser-injected-local-bridge-requester' } as unknown as string,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'requester_executable_contract_invalid',
      requesterCallable: false,
    });
  });

  it('fails closed when the execution boundary is missing, blocked, forged, or mismatched', () => {
    expect(evaluateLocalBridgeRequesterInvocationImplementationBoundary(validInput({
      executionBoundary: undefined,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'execution_boundary_missing',
      canPrepareFutureRequesterInvocation: false,
      executable: false,
    });

    expect(evaluateLocalBridgeRequesterInvocationImplementationBoundary(validInput({
      executionBoundary: makeExecutionBoundary({
        status: 'blocked',
        eligible: false,
        blockers: [{
          code: 'dry_run_decision_missing',
          detail: 'dry-run evidence missing',
        }],
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'execution_boundary_not_ready',
    });

    expect(evaluateLocalBridgeRequesterInvocationImplementationBoundary(validInput({
      executionBoundary: {
        ...makeExecutionBoundary(),
        metadata: {
          ...makeExecutionBoundary().metadata,
          willInvokeRequester: true,
        },
      } as never,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'execution_boundary_invalid',
      willInvokeRequester: false,
    });

    expect(evaluateLocalBridgeRequesterInvocationImplementationBoundary(validInput({
      executionBoundary: {
        ...makeExecutionBoundary(),
        metadata: {
          metadataKind: 'local-bridge-requester-execution-boundary',
          executionEligible: true,
        },
      } as never,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'execution_boundary_invalid',
      canPrepareFutureRequesterInvocation: false,
      willInvokeRequester: false,
    });

    expect(evaluateLocalBridgeRequesterInvocationImplementationBoundary(validInput({
      requesterFacts: makeRequesterFacts({
        requesterId: 'different-requester',
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'requester_owner_mismatch',
      canPrepareFutureRequesterInvocation: false,
    });
  });

  it('rejects scheme-shaped generic identifiers while preserving local-bridge credential handles', () => {
    const validDecision = evaluateLocalBridgeRequesterInvocationImplementationBoundary(validInput());

    expect(validDecision.status).toBe('ready');
    expect(validDecision.credentialReferenceId).toBe('local-bridge:assistantcaddy/llm');
    expect(validDecision.executableContract?.credentialReferenceId).toBe('local-bridge:assistantcaddy/llm');

    const executionSchemeDecision = evaluateLocalBridgeRequesterInvocationImplementationBoundary(validInput({
      executionBoundary: makeExecutionBoundary({
        metadata: {
          ...makeExecutionBoundary().metadata,
          capability: {
            ...makeExecutionBoundary().metadata!.capability,
            id: 'mailto:user@example.test',
          },
          dryRunResultId: 'urn:provider:opaque',
        } as never,
      }),
    }));

    expect(executionSchemeDecision).toMatchObject({
      status: 'blocked',
      reason: 'execution_boundary_invalid',
      canPrepareFutureRequesterInvocation: false,
    });
    expect(JSON.stringify(executionSchemeDecision)).not.toContain('mailto:user@example.test');
    expect(JSON.stringify(executionSchemeDecision)).not.toContain('urn:provider:opaque');

    const factsSchemeDecision = evaluateLocalBridgeRequesterInvocationImplementationBoundary(validInput({
      requesterFacts: makeRequesterFacts({
        requesterId: 'mailto:user@example.test',
        requesterImplementationId: 'urn:provider:opaque',
      }),
    }));

    expect(factsSchemeDecision).toMatchObject({
      status: 'blocked',
      reason: 'requester_facts_unreviewed',
      canPrepareFutureRequesterInvocation: false,
    });
    expect(JSON.stringify(factsSchemeDecision)).not.toContain('mailto:user@example.test');
    expect(JSON.stringify(factsSchemeDecision)).not.toContain('urn:provider:opaque');

    const contractSchemeDecision = evaluateLocalBridgeRequesterInvocationImplementationBoundary(validInput({
      executableContract: makeExecutableContract({
        requesterContractId: 'mailto:user@example.test',
        requesterContractVersion: 'api.example.test/path',
      }),
    }));

    expect(contractSchemeDecision).toMatchObject({
      status: 'blocked',
      reason: 'requester_executable_contract_invalid',
      canPrepareFutureRequesterInvocation: false,
    });
    expect(JSON.stringify(contractSchemeDecision)).not.toContain('mailto:user@example.test');
    expect(JSON.stringify(contractSchemeDecision)).not.toContain('api.example.test/path');

    const credentialSchemeDecision = evaluateLocalBridgeRequesterInvocationImplementationBoundary(validInput({
      requesterFacts: makeRequesterFacts({
        credentialReferenceId: 'urn:provider:opaque',
      }),
      executableContract: makeExecutableContract({
        credentialReferenceId: 'urn:provider:opaque',
      }),
    }));

    expect(credentialSchemeDecision).toMatchObject({
      status: 'blocked',
      reason: 'requester_facts_unreviewed',
      canPrepareFutureRequesterInvocation: false,
    });
    expect(JSON.stringify(credentialSchemeDecision)).not.toContain('urn:provider:opaque');
  });

  it('rejects real requester shapes and any result object without invoking them', () => {
    const requester = {
      requesterId: 'browser-injected-local-bridge-requester',
      request: vi.fn(),
    };

    expect(evaluateLocalBridgeRequesterInvocationImplementationBoundary({
      executionBoundary: makeExecutionBoundary(),
      requesterFacts: makeRequesterFacts(),
      executableContract: makeExecutableContract(),
      requester,
    })).toMatchObject({
      status: 'blocked',
      reason: 'requester_shape_forbidden',
      requesterCallable: false,
      willInvokeRequester: false,
    });
    expect(requester.request).not.toHaveBeenCalled();

    const trustedRequester = evaluateLocalBridgeRequesterInvocationImplementationBoundary(validInput({
      requester: 'Bearer do-not-echo-local-bridge-requester-secret' as never,
    }));
    expect(trustedRequester).toMatchObject({
      status: 'blocked',
      reason: 'requester_shape_forbidden',
      capability: undefined,
      requesterCallable: false,
      willInvokeRequester: false,
    });
    expect(JSON.stringify(trustedRequester)).not.toContain('do-not-echo-local-bridge-requester-secret');

    expect(evaluateLocalBridgeRequesterInvocationImplementationBoundary(validInput({
      requesterResult: { dryRunResultId: 'future-run-1' },
    }))).toMatchObject({
      status: 'blocked',
      reason: 'requester_result_forbidden',
    });

    expect(evaluateLocalBridgeRequesterInvocationImplementationBoundary(validInput({
      requesterResult: { nested: { requesterCalled: true, willProbeLocalBridge: true } },
    }))).toMatchObject({
      status: 'blocked',
      reason: 'requester_result_live_claim',
      willProbeLocalBridge: false,
    });

    const callback = vi.fn();
    expect(evaluateLocalBridgeRequesterInvocationImplementationBoundary({
      executionBoundary: makeExecutionBoundary(),
      requesterFacts: makeRequesterFacts(),
      executableContract: makeExecutableContract(),
      callback,
      fetch: callback,
      socket: { connect: callback },
      storage: { setItem: callback },
      provider: { call: callback },
      liveAction: 'probe_local_bridge',
    } as unknown as Parameters<typeof evaluateLocalBridgeRequesterInvocationImplementationBoundary>[0])).toMatchObject({
      status: 'blocked',
      reason: 'requester_shape_forbidden',
      requesterCallable: false,
      willInvokeRequester: false,
    });
    expect(callback).not.toHaveBeenCalled();

    expect(evaluateLocalBridgeRequesterInvocationImplementationBoundary(validInput({
      fetchClient: 'forbidden-live-fetch-placeholder',
    } as never))).toMatchObject({
      status: 'blocked',
      reason: 'requester_shape_forbidden',
      requesterCallable: false,
      willInvokeRequester: false,
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

    expect(evaluateLocalBridgeRequesterInvocationImplementationBoundary(trappedObject(rootTraps) as never))
      .toMatchObject({ status: 'blocked', reason: 'requester_shape_forbidden' });
    expect(evaluateLocalBridgeRequesterInvocationImplementationBoundary({
      executionBoundary: trappedObject(nestedTraps),
    } as never)).toMatchObject({ status: 'blocked', reason: 'requester_shape_forbidden' });
    expect(evaluateLocalBridgeRequesterInvocationImplementationBoundary(accessorRoot as never))
      .toMatchObject({ status: 'blocked', reason: 'requester_shape_forbidden' });

    expect(rootTraps).toEqual([]);
    expect(nestedTraps).toEqual([]);
    expect(getter).not.toHaveBeenCalled();
  });

  it('blocks non-loopback endpoints, token-shaped identifiers, and storage/network side effects', () => {
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

    expect(evaluateLocalBridgeRequesterInvocationImplementationBoundary(validInput())).toMatchObject({
      status: 'ready',
      reason: 'requester_invocation_boundary_ready',
      willInvokeRequester: false,
      willProbeLocalBridge: false,
      willCallProvider: false,
      willMutateStorage: false,
      willStoreCredential: false,
    });

    const nonLocal = evaluateLocalBridgeRequesterInvocationImplementationBoundary(validInput({
      requesterFacts: makeRequesterFacts({
        acceptedEndpoint: 'https://bridge.example.invalid/v1',
        url: 'https://bridge.example.invalid/health',
      }),
    }));
    expect(nonLocal).toMatchObject({
      status: 'blocked',
      reason: 'requester_facts_unreviewed',
      executable: false,
    });

    const secret = evaluateLocalBridgeRequesterInvocationImplementationBoundary(validInput({
      requesterFacts: makeRequesterFacts({
        requesterImplementationId: 'sk-do-not-keep-local-bridge-token',
        url: 'http://127.0.0.1:11434/health?token=do-not-echo',
      }),
    }));
    const serialized = JSON.stringify(secret);

    expect(secret).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
      requesterCallable: false,
      willInvokeRequester: false,
      willProbeLocalBridge: false,
      willStoreCredential: false,
    });
    expect(serialized).not.toContain('do-not-keep');
    expect(serialized).not.toContain('do-not-echo');
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
