import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  LocalBridgeRequesterInvocationImplementationDecision,
} from '../lib/local-bridge-requester-invocation-implementation-boundary';
import {
  LOCAL_BRIDGE_USER_EXECUTION_OPERATIONS_IMPLEMENTATION_CHECKPOINT_REQUIREMENTS,
  LOCAL_BRIDGE_USER_EXECUTION_OPERATIONS_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES,
  LOCAL_BRIDGE_USER_EXECUTION_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
  LOCAL_BRIDGE_USER_EXECUTION_OPERATIONS_IMPLEMENTATION_ROLLBACK_REQUIREMENTS,
  evaluateLocalBridgeUserExecutionOperationsImplementationManifest,
} from '../lib/local-bridge-user-execution-operations-implementation-manifest';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const INVOCATION_BOUNDARY =
  'pure-local-requester-invocation-implementation-boundary-no-callback-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-requester-call' as const;

function invocationBoundary(
  overrides: Partial<LocalBridgeRequesterInvocationImplementationDecision> = {},
): LocalBridgeRequesterInvocationImplementationDecision {
  return Object.freeze({
    status: 'ready',
    ready: true,
    reason: 'requester_invocation_boundary_ready',
    capability: Object.freeze({
      id: 'local-bridge-requester.llm.health',
      requesterId: 'browser-injected-local-bridge-requester',
      requesterVersion: '1.0.0',
    }),
    owner: Object.freeze({
      ownerSurface: 'assistantcaddy-local-bridge-setup',
      actionId: 'probe_local_bridge',
    }),
    bridge: Object.freeze({
      bridgeKind: 'llm',
      acceptedEndpoint: 'http://127.0.0.1:11434/v1',
    }),
    transport: Object.freeze({
      method: 'GET',
      url: 'http://127.0.0.1:11434/health',
      timeoutMs: 2_000,
    }),
    credentialReferenceId: 'local-bridge:assistantcaddy/llm',
    dryRunResultId: 'dry-run-result-001',
    requesterImplementationId: 'assistantcaddy-local-bridge-requester-package',
    requesterPackageVersion: '2026.06.12',
    canPrepareFutureRequesterInvocation: true,
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
  });
}

describe('local bridge user execution operations implementation manifest', () => {
  it('converts a reviewed invocation boundary into a frozen head-chat-only operations manifest', () => {
    const decision = evaluateLocalBridgeUserExecutionOperationsImplementationManifest({
      invocationBoundary: invocationBoundary(),
      proposedHighRiskWriteSet: LOCAL_BRIDGE_USER_EXECUTION_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
      checkpointRequirements: LOCAL_BRIDGE_USER_EXECUTION_OPERATIONS_IMPLEMENTATION_CHECKPOINT_REQUIREMENTS,
      rollbackRequirements: LOCAL_BRIDGE_USER_EXECUTION_OPERATIONS_IMPLEMENTATION_ROLLBACK_REQUIREMENTS,
    });

    expect(decision).toMatchObject({
      status: 'operations-manifest-ready',
      manifestReady: true,
      reason: 'operations_manifest_ready',
      manifest: {
        schemaVersion: 1,
        contract: 'local-bridge-user-execution-operations-implementation-manifest-v1',
        manifestOwner: 'assistantcaddy-head-chat-local-bridge-user-execution',
        manifestId: 'assistantcaddy-head-chat-local-bridge-user-execution-operations-manifest',
        manifestVersion: '2026.06.12',
        integrationOwner: 'head-chat',
        integrationScope: 'local-bridge-user-execution-operations-implementation',
        sourceInvocationBoundaryContract: 'local-bridge-requester-invocation-implementation-boundary-v1',
        sourceInvocationBoundaryDirective: 'decision-only-no-requester-call-no-fetch-no-socket-no-storage',
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
        highRiskWriteSet: LOCAL_BRIDGE_USER_EXECUTION_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
        blockedPathClasses: LOCAL_BRIDGE_USER_EXECUTION_OPERATIONS_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES,
        checkpointRequirements: LOCAL_BRIDGE_USER_EXECUTION_OPERATIONS_IMPLEMENTATION_CHECKPOINT_REQUIREMENTS,
        rollbackRequirements: LOCAL_BRIDGE_USER_EXECUTION_OPERATIONS_IMPLEMENTATION_ROLLBACK_REQUIREMENTS,
        promotedFromInvocationBoundary: true,
        headChatReviewRequired: true,
        readyForImplementation: false,
        implementationMode: 'manifest-only',
      },
      canPrepareHeadChatLocalBridgeUserExecutionImplementation: true,
      readyForLocalBridgeUserExecution: false,
      mayInvokeRequester: false,
      mayProbeLocalBridge: false,
      mayCallLocalBridge: false,
      mayCallProvider: false,
      mayUseFetch: false,
      mayOpenSocket: false,
      mayReadStorage: false,
      mayWriteStorage: false,
      willGenerateArtifacts: false,
      willPromoteStandalone: false,
      willMutateSchema: false,
      sideEffects: 'none',
      checkpointDirective: 'checkpoint-required-before-head-chat-implementation',
      rollbackDirective: 'rollback-plan-required-before-head-chat-implementation',
      implementationDirective: 'head-chat-owned-local-bridge-user-execution-implementation-only',
      sideEffectBoundary:
        'local-bridge-user-execution-operations-implementation-manifest-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-requester-call-no-schema-no-export-no-standalone',
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.manifest)).toBe(true);
    expect(Object.isFrozen(decision.manifest.highRiskWriteSet)).toBe(true);
  });

  it('fails closed when the invocation boundary is missing, blocked, or forged to claim live execution', () => {
    expect(evaluateLocalBridgeUserExecutionOperationsImplementationManifest()).toMatchObject({
      status: 'blocked',
      reason: 'invocation_boundary_missing',
      canPrepareHeadChatLocalBridgeUserExecutionImplementation: false,
      mayInvokeRequester: false,
    });

    expect(evaluateLocalBridgeUserExecutionOperationsImplementationManifest({
      invocationBoundary: invocationBoundary({
        status: 'blocked',
        ready: false,
        reason: 'execution_boundary_not_ready',
        canPrepareFutureRequesterInvocation: false,
      }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'invocation_boundary_not_ready',
    });

    expect(evaluateLocalBridgeUserExecutionOperationsImplementationManifest({
      invocationBoundary: {
        ...invocationBoundary(),
        willInvokeRequester: true,
        requesterCallable: true,
      } as never,
    })).toMatchObject({
      status: 'blocked',
      reason: 'invocation_boundary_invalid',
      mayInvokeRequester: false,
      mayProbeLocalBridge: false,
    });

    const requester = vi.fn();
    const fetcher = vi.fn();
    for (const forgedInput of [
      { invocationBoundary: invocationBoundary(), requester },
      { invocationBoundary: invocationBoundary(), fetch: fetcher },
      { invocationBoundary: invocationBoundary(), socket: vi.fn() },
    ]) {
      expect(evaluateLocalBridgeUserExecutionOperationsImplementationManifest(forgedInput as never)).toMatchObject({
        status: 'blocked',
        reason: 'invocation_boundary_invalid',
        mayInvokeRequester: false,
        mayUseFetch: false,
        mayOpenSocket: false,
      });
    }
    expect(requester).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('validates requester ownership, loopback endpoint provenance, write set, checkpoint, and rollback facts', () => {
    expect(evaluateLocalBridgeUserExecutionOperationsImplementationManifest({
      invocationBoundary: {
        ...invocationBoundary(),
        capability: {
          ...invocationBoundary().capability!,
          requesterId: 'requester id with spaces',
        },
      } as never,
    })).toMatchObject({
      status: 'blocked',
      reason: 'requester_owner_invalid',
    });

    expect(evaluateLocalBridgeUserExecutionOperationsImplementationManifest({
      invocationBoundary: {
        ...invocationBoundary(),
        bridge: {
          bridgeKind: 'llm',
          acceptedEndpoint: 'https://bridge.example.invalid/v1',
        },
        transport: {
          method: 'GET',
          url: 'https://bridge.example.invalid/health',
          timeoutMs: 2_000,
        },
      } as never,
    })).toMatchObject({
      status: 'blocked',
      reason: 'endpoint_provenance_invalid',
    });

    expect(evaluateLocalBridgeUserExecutionOperationsImplementationManifest({
      invocationBoundary: {
        ...invocationBoundary(),
        transport: {
          method: 'GET',
          url: 'http://127.0.0.1:11434/admin',
          timeoutMs: 2_000,
        },
      } as never,
    })).toMatchObject({
      status: 'blocked',
      reason: 'endpoint_provenance_invalid',
    });

    expect(evaluateLocalBridgeUserExecutionOperationsImplementationManifest({
      invocationBoundary: {
        ...invocationBoundary(),
        adapterMetadata: {
          requesterCallable: true,
        },
      } as never,
    })).toMatchObject({
      status: 'blocked',
      reason: 'invocation_boundary_invalid',
    });

    expect(evaluateLocalBridgeUserExecutionOperationsImplementationManifest({
      invocationBoundary: invocationBoundary(),
      proposedHighRiskWriteSet: [
        ...LOCAL_BRIDGE_USER_EXECUTION_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
        'docs/local-bridge-rollout.md',
      ],
    })).toMatchObject({
      status: 'blocked',
      reason: 'high_risk_write_set_invalid',
      willGenerateArtifacts: false,
      willPromoteStandalone: false,
    });

    expect(evaluateLocalBridgeUserExecutionOperationsImplementationManifest({
      invocationBoundary: invocationBoundary(),
      checkpointRequirements: [
        'source-sanity',
        'typescript-noemit',
      ],
    })).toMatchObject({
      status: 'blocked',
      reason: 'checkpoint_requirements_invalid',
    });

    expect(evaluateLocalBridgeUserExecutionOperationsImplementationManifest({
      invocationBoundary: invocationBoundary(),
      rollbackRequirements: [
        'head-chat-owned-revert-plan',
        'checkpoint-restore-path',
      ],
    })).toMatchObject({
      status: 'blocked',
      reason: 'rollback_requirements_invalid',
    });
  });

  it('blocks token-shaped identifiers and secret fields without fetch, socket, storage, or requester side effects', () => {
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
    const requester = vi.fn();

    const tokenDecision = evaluateLocalBridgeUserExecutionOperationsImplementationManifest({
      invocationBoundary: {
        ...invocationBoundary(),
        requesterImplementationId: 'sk-do-not-keep-local-bridge-token',
        requester,
      } as never,
    });
    const secretFieldDecision = evaluateLocalBridgeUserExecutionOperationsImplementationManifest({
      invocationBoundary: {
        ...invocationBoundary(),
        accessToken: 'Bearer do-not-echo-local-bridge-token',
      } as never,
    });
    const serialized = `${JSON.stringify(tokenDecision)} ${JSON.stringify(secretFieldDecision)}`;

    expect(tokenDecision).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
      mayInvokeRequester: false,
      mayProbeLocalBridge: false,
      mayCallLocalBridge: false,
      mayReadStorage: false,
      mayWriteStorage: false,
    });
    expect(secretFieldDecision).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });
    expect(serialized).not.toContain('do-not-keep');
    expect(serialized).not.toContain('do-not-echo');
    expect(requester).not.toHaveBeenCalled();
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
