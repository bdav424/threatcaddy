import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalBridgeDiscoveryPlan, type LocalBridgeKind } from '../lib/local-bridge-discovery';
import {
  evaluateLocalBridgeProbeExecutionGate,
  type LocalBridgeInertManualProbePlan,
  type LocalBridgeProbeExecutionDecision,
} from '../lib/local-bridge-probe-execution-gate';
import {
  bindLocalBridgeDryRunTransportHarness,
  type LocalBridgeDryRunTransportHarnessDecision,
  type LocalBridgeDryRunTransportResultInput,
} from '../lib/local-bridge-dry-run-transport-harness';
import {
  planLocalBridgeRequesterOwnership,
  type LocalBridgeRequesterCapabilityFact,
  type LocalBridgeRequesterOwnershipDecision,
} from '../lib/local-bridge-requester-ownership';
import {
  evaluateLocalBridgeRequesterExecutionBoundary,
  type LocalBridgeInjectedRequesterExecutionFact,
} from '../lib/local-bridge-requester-execution-boundary';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
import {
  createRuntimeTrustedContractObject,
  type RuntimeTrustedContractValue,
} from '../lib/runtime-trusted-contract-object';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function gateDecision(bridgeKind: LocalBridgeKind = 'llm'): LocalBridgeProbeExecutionDecision {
  const discoveryPlan = createLocalBridgeDiscoveryPlan({
    bridgeKind,
    candidates: ['127.0.0.1:11434/v1'],
    consentGranted: true,
    defaultProbePath: '/health',
  });

  return evaluateLocalBridgeProbeExecutionGate({
    expectedBridgeKind: bridgeKind,
    discoveryPlan,
    explicitUserAction: {
      action: 'probe_local_bridge',
      bridgeKind,
      granted: true,
      acknowledgedPlanOnly: true,
    },
  });
}

function probePlan(decision: LocalBridgeProbeExecutionDecision = gateDecision()): LocalBridgeInertManualProbePlan {
  if (!decision.probePlan) throw new Error('test gate decision did not produce an inert probe plan');
  return decision.probePlan;
}

function requesterCapability(
  plan: LocalBridgeInertManualProbePlan = probePlan(),
  overrides: Partial<LocalBridgeRequesterCapabilityFact> = {},
): LocalBridgeRequesterCapabilityFact {
  return {
    schemaVersion: 1,
    factKind: 'local-bridge-requester-capability',
    capabilityId: 'local-bridge-requester.llm.health',
    requesterId: 'browser-injected-local-bridge-requester',
    requesterVersion: '1.0.0',
    reviewState: 'reviewed',
    ownerSurface: 'assistantcaddy-local-bridge-setup',
    actionId: 'probe_local_bridge',
    bridgeKind: plan.bridgeKind,
    acceptedEndpoint: plan.acceptedEndpoint,
    method: plan.method,
    url: plan.url,
    maxTimeoutMs: plan.timeoutMs,
    credentialPolicy: 'opaque-reference-optional',
    credentialReferenceId: 'local-bridge:assistantcaddy/llm',
    allowsDirectProbe: false,
    allowsLiveExecution: false,
    reviewedAt: 1_700_000_000_000,
    expiresAt: 1_800_000_000_000,
    ...overrides,
  };
}

function credential(overrides: Partial<ConnectorCredentialReference> = {}): ConnectorCredentialReference {
  return {
    schemaVersion: 1,
    kind: 'local-bridge',
    id: 'local-bridge:assistantcaddy/llm',
    storageOwner: 'local-bridge',
    providerId: 'local-llm',
    connectorId: 'local-bridge-llm',
    accountId: 'account-1',
    ...overrides,
  };
}

function ownershipDecision(
  overrides: Partial<Parameters<typeof planLocalBridgeRequesterOwnership>[0]> = {},
): LocalBridgeRequesterOwnershipDecision {
  const gate = gateDecision();
  const plan = probePlan(gate);
  return planLocalBridgeRequesterOwnership({
    gateDecision: gate,
    probePlan: plan,
    requesterCapability: requesterCapability(plan),
    transportRequest: {
      method: plan.method,
      url: plan.url,
      timeoutMs: plan.timeoutMs,
    },
    ownerSurface: 'assistantcaddy-local-bridge-setup',
    actionId: 'probe_local_bridge',
    capabilityId: 'local-bridge-requester.llm.health',
    credentialReference: credential(),
    now: 1_700_000_000_100,
    ...overrides,
  });
}

function dryRunResult(
  ownership: LocalBridgeRequesterOwnershipDecision = ownershipDecision(),
  overrides: Partial<LocalBridgeDryRunTransportResultInput> = {},
): LocalBridgeDryRunTransportResultInput {
  const descriptor = ownership.descriptor;
  if (!descriptor) throw new Error('test ownership decision did not produce a descriptor');
  return {
    resultKind: 'local-bridge-dry-run-transport-result',
    dryRun: true,
    capabilityId: descriptor.capability.id,
    requesterId: descriptor.capability.requesterId,
    requesterVersion: descriptor.capability.requesterVersion,
    ownerSurface: descriptor.owner.ownerSurface,
    actionId: descriptor.owner.actionId,
    bridgeKind: descriptor.bridge.bridgeKind,
    acceptedEndpoint: descriptor.bridge.acceptedEndpoint,
    method: descriptor.bridge.method,
    url: descriptor.bridge.url,
    timeoutMs: descriptor.bridge.timeoutMs,
    credentialReferenceId: descriptor.credentialReference?.id,
    dispatchAllowed: false,
    executable: false,
    sideEffects: 'none',
    sideEffectBoundary: 'dry-run-only-no-dispatch',
    resultId: 'dry-run-result-001',
    ...overrides,
  };
}

function dryRunDecision(
  ownership: LocalBridgeRequesterOwnershipDecision = ownershipDecision(),
  result: LocalBridgeDryRunTransportResultInput = dryRunResult(ownership),
): LocalBridgeDryRunTransportHarnessDecision {
  return bindLocalBridgeDryRunTransportHarness(
    trustedRecord({
      ownershipDecision: trustedRecord(ownership as unknown as Record<string, unknown>),
      dryRunResult: trustedRecord(result as unknown as Record<string, unknown>),
    }) as unknown as Parameters<typeof bindLocalBridgeDryRunTransportHarness>[0],
  );
}

function requesterFact(
  dryRun: LocalBridgeDryRunTransportHarnessDecision = dryRunDecision(),
  overrides: Partial<LocalBridgeInjectedRequesterExecutionFact> = {},
): LocalBridgeInjectedRequesterExecutionFact {
  const metadata = dryRun.metadata;
  if (!metadata) throw new Error('test dry-run decision did not produce metadata');
  return {
    schemaVersion: 1,
    factKind: 'local-bridge-injected-requester-execution',
    capabilityId: metadata.capability.id,
    requesterId: metadata.capability.requesterId,
    requesterVersion: metadata.capability.requesterVersion,
    reviewState: 'reviewed',
    ownerSurface: metadata.owner.ownerSurface,
    actionId: metadata.owner.actionId,
    bridgeKind: metadata.bridge.bridgeKind,
    acceptedEndpoint: metadata.bridge.acceptedEndpoint,
    method: metadata.transport.method,
    url: metadata.transport.url,
    timeoutMs: metadata.transport.timeoutMs,
    credentialReferenceId: metadata.credentialReferenceId,
    supportsExecution: true,
    executable: false,
    dispatchAllowed: false,
    sideEffects: 'none',
    sideEffectBoundary: 'requester-execution-metadata-only-no-fetch-no-socket-no-storage-no-provider-no-credentials',
    reviewedAt: 1_700_000_000_000,
    expiresAt: 1_800_000_000_000,
    ...overrides,
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
  if (typeof value === 'object') return trustedRecord(value as Record<string, unknown>) as RuntimeTrustedContractValue;
  throw new TypeError('Test trusted contract fixtures cannot include callable values.');
}

function trustedRecord<T extends Record<string, unknown>>(value: T): T {
  return createRuntimeTrustedContractObject(
    Object.entries(value).map(([key, nested]) => [key, trustedValue(nested)] as const),
  ) as unknown as T;
}

function validInput(overrides: Partial<Parameters<typeof evaluateLocalBridgeRequesterExecutionBoundary>[0]> = {}) {
  const ownership = ownershipDecision();
  const dryRun = dryRunDecision(ownership);
  return trustedRecord({
    ownershipDecision: ownership,
    dryRunTransportDecision: dryRun,
    requesterExecutionFact: requesterFact(dryRun),
    now: 1_700_000_000_100,
    ...overrides,
  });
}

function serialized(value: unknown): string {
  return JSON.stringify(value);
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

describe('local bridge requester execution boundary', () => {
  it('returns frozen eligible metadata without invoking the future requester', () => {
    const decision = evaluateLocalBridgeRequesterExecutionBoundary(validInput());

    expect(decision.status).toBe('eligible');
    expect(decision.eligible).toBe(true);
    expect(decision.blockers).toEqual([]);
    expect(decision.sideEffectBoundary).toBe('requester-execution-boundary-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-callback');
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.blockers)).toBe(true);
    expect(Object.isFrozen(decision.metadata)).toBe(true);
    expect(Object.isFrozen(decision.metadata?.capability)).toBe(true);
    expect(Object.isFrozen(decision.metadata?.owner)).toBe(true);
    expect(Object.isFrozen(decision.metadata?.bridge)).toBe(true);
    expect(Object.isFrozen(decision.metadata?.transport)).toBe(true);

    expect(decision.metadata).toMatchObject({
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
      requesterInvocationBoundary:
        'local-bridge-requester-execution-boundary-prepares-decision-only-invocation-no-requester-call',
    });
  });

  it('blocks missing or blocked ownership and dry-run prerequisites', () => {
    expect(evaluateLocalBridgeRequesterExecutionBoundary(validInput({
      ownershipDecision: null,
    })).blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'ownership_decision_missing',
    ]));

    const blockedOwnership = ownershipDecision({
      requesterCapability: requesterCapability(probePlan(), { reviewState: 'revoked' }),
    });
    const goodOwnership = ownershipDecision();
    const goodDryRun = dryRunDecision(goodOwnership);
    const decision = evaluateLocalBridgeRequesterExecutionBoundary(validInput({
      ownershipDecision: blockedOwnership,
      dryRunTransportDecision: goodDryRun,
      requesterExecutionFact: requesterFact(goodDryRun),
    }));

    expect(decision.status).toBe('blocked');
    expect(decision.metadata).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'ownership_decision_blocked',
      'ownership_descriptor_missing',
    ]));

    expect(evaluateLocalBridgeRequesterExecutionBoundary(validInput({
      dryRunTransportDecision: bindLocalBridgeDryRunTransportHarness({
        ownershipDecision: goodOwnership,
        dryRunResult: dryRunResult(goodOwnership, { executed: true }),
      }),
    })).blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'dry_run_decision_blocked',
      'dry_run_metadata_missing',
    ]));

    expect(evaluateLocalBridgeRequesterExecutionBoundary(validInput({
      dryRunTransportDecision: {
        status: 'accepted',
        accepted: true,
      } as never,
    })).blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'dry_run_boundary_mismatch',
    ]));
  });

  it('blocks owner capability bridge transport and credential mismatches', () => {
    const input = validInput();
    const fact = requesterFact(input.dryRunTransportDecision!, {
      ownerSurface: 'emailcaddy-local-bridge-setup',
      capabilityId: 'local-bridge-requester.other',
      acceptedEndpoint: 'http://127.0.0.1:8766/v1',
      url: 'http://127.0.0.1:8766/health',
      timeoutMs: 3_000,
      credentialReferenceId: 'local-bridge:other/llm',
    });
    const decision = evaluateLocalBridgeRequesterExecutionBoundary(trustedRecord({
      ...input,
      requesterExecutionFact: fact,
    }));

    expect(decision.status).toBe('blocked');
    expect(decision.metadata).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'owner_mismatch',
      'capability_mismatch',
      'bridge_mismatch',
      'transport_mismatch',
      'credential_reference_mismatch',
    ]));

    const forgedOwnership = {
      ...input.ownershipDecision!,
      descriptor: {
        ...input.ownershipDecision!.descriptor!,
        credentialReference: credential({ storageOwner: 'external-provider' as never }),
      },
    } as typeof input.ownershipDecision;
    expect(evaluateLocalBridgeRequesterExecutionBoundary(trustedRecord({
      ...input,
      ownershipDecision: forgedOwnership,
    })).blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'ownership_boundary_mismatch',
    ]));
  });

  it('blocks each independently matchable requester fact identity field', () => {
    const cases: Array<{
      field: keyof LocalBridgeInjectedRequesterExecutionFact;
      value: LocalBridgeInjectedRequesterExecutionFact[keyof LocalBridgeInjectedRequesterExecutionFact];
      code: string;
    }> = [
      { field: 'ownerSurface', value: 'emailcaddy-local-bridge-setup', code: 'owner_mismatch' },
      { field: 'actionId', value: 'probe_other_bridge', code: 'token_shaped_identifier' },
      { field: 'capabilityId', value: 'local-bridge-requester.other', code: 'capability_mismatch' },
      { field: 'requesterId', value: 'other-requester', code: 'capability_mismatch' },
      { field: 'requesterVersion', value: '2.0.0', code: 'capability_mismatch' },
      { field: 'bridgeKind', value: 'cti-agent', code: 'bridge_mismatch' },
      { field: 'acceptedEndpoint', value: 'http://127.0.0.1:8766/v1', code: 'bridge_mismatch' },
      { field: 'url', value: 'http://127.0.0.1:8766/health', code: 'transport_mismatch' },
      { field: 'timeoutMs', value: 3_000, code: 'transport_mismatch' },
      { field: 'credentialReferenceId', value: 'local-bridge:other/llm', code: 'credential_reference_mismatch' },
    ];

    for (const testCase of cases) {
      const input = validInput();
      const fact = requesterFact(input.dryRunTransportDecision!, {
        [testCase.field]: testCase.value,
      });
      const decision = evaluateLocalBridgeRequesterExecutionBoundary(trustedRecord({
        ...input,
        requesterExecutionFact: fact,
      }));

      expect(decision.status, testCase.field).toBe('blocked');
      expect(decision.metadata, testCase.field).toBeUndefined();
      expect(decision.blockers.map((blocker) => blocker.code), testCase.field)
        .toEqual(expect.arrayContaining([testCase.code]));
    }
  });

  it('blocks stale revoked unreviewed and expired requester facts', () => {
    for (const [reviewState, expectedCode] of [
      ['draft', 'requester_fact_not_reviewed'],
      ['stale', 'requester_fact_stale'],
      ['revoked', 'requester_fact_revoked'],
      ['expired', 'requester_fact_expired'],
    ] as const) {
      const input = validInput();
      expect(evaluateLocalBridgeRequesterExecutionBoundary(trustedRecord({
        ...input,
        requesterExecutionFact: requesterFact(input.dryRunTransportDecision!, { reviewState }),
      })).blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([expectedCode]));
    }

    const input = validInput();
    expect(evaluateLocalBridgeRequesterExecutionBoundary(trustedRecord({
      ...input,
      requesterExecutionFact: requesterFact(input.dryRunTransportDecision!, {
        stale: true,
        expiresAt: 1_700_000_000_000,
      }),
      now: 1_700_000_000_100,
    })).blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'requester_fact_stale',
      'requester_fact_expired',
    ]));

    expect(evaluateLocalBridgeRequesterExecutionBoundary(trustedRecord({
      ...input,
      requesterExecutionFact: requesterFact(input.dryRunTransportDecision!, {
        expiresAt: Date.now() - 1_000,
      }),
      now: 1,
    })).blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'requester_fact_expired',
    ]));
  });

  it('blocks forged live execution flags direct requester callbacks and requester results', () => {
    const requesterSpy = vi.fn();
    const decision = evaluateLocalBridgeRequesterExecutionBoundary(validInput({
      requesterExecutionFact: {
        ...requesterFact(),
        executed: true,
        liveExecution: true,
        fetchAllowed: true,
      } as unknown as LocalBridgeInjectedRequesterExecutionFact,
      requesterResult: { status: 'ok' },
    }));
    const untrustedCallbackDecision = evaluateLocalBridgeRequesterExecutionBoundary({
      ...validInput(),
      directRequester: requesterSpy,
    } as never);
    const trustedForbiddenFieldDecision = evaluateLocalBridgeRequesterExecutionBoundary(validInput({
      directRequester: 'future-requester-callback-placeholder' as never,
    }));

    expect(decision.status).toBe('blocked');
    expect(decision.metadata).toBeUndefined();
    expect(untrustedCallbackDecision.status).toBe('blocked');
    expect(trustedForbiddenFieldDecision.status).toBe('blocked');
    expect(requesterSpy).not.toHaveBeenCalled();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'forged_live_execution_flag',
      'requester_result_forbidden',
    ]));
    expect(untrustedCallbackDecision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'invalid_input_shape',
    ]));
    expect(trustedForbiddenFieldDecision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'direct_requester_forbidden',
    ]));

    const earlyDirectRequesterDecision = evaluateLocalBridgeRequesterExecutionBoundary(trustedRecord({
      directRequester: 'Bearer do-not-echo-direct-requester-secret' as never,
    }));
    expect(earlyDirectRequesterDecision.status).toBe('blocked');
    expect(earlyDirectRequesterDecision.metadata).toBeUndefined();
    expect(earlyDirectRequesterDecision.blockers.map((blocker) => blocker.code)).toEqual([
      'direct_requester_forbidden',
    ]);
    expect(serialized(earlyDirectRequesterDecision)).not.toContain('do-not-echo-direct-requester-secret');
  });

  it('blocks root-level requester callback fetch socket storage and live-action fields', () => {
    const callbackSpy = vi.fn();
    const decision = evaluateLocalBridgeRequesterExecutionBoundary({
      ...validInput(),
      requester: callbackSpy,
      callback: callbackSpy,
      fetch: callbackSpy,
      socket: { connect: callbackSpy },
      storage: { setItem: callbackSpy },
      liveAction: { executable: true },
    } as never);

    expect(decision.status).toBe('blocked');
    expect(decision.metadata).toBeUndefined();
    expect(callbackSpy).not.toHaveBeenCalled();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'invalid_input_shape',
    ]));
  });

  it('prioritizes trusted unsafe root fields before exact-key requester execution reads', () => {
    const decision = evaluateLocalBridgeRequesterExecutionBoundary(validInput({
      fetchClient: 'forbidden-live-fetch-placeholder',
    } as never));

    expect(decision.status).toBe('blocked');
    expect(decision.metadata).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code).slice(0, 2)).toEqual([
      'unsafe_input_field',
      'input_extra_field',
    ]);
  });

  it('rejects untrusted root and nested proxy or accessor inputs before traps or getters execute', () => {
    const rootTraps: string[] = [];
    const nestedTraps: string[] = [];
    const getter = vi.fn();
    const accessorRoot = {};
    Object.defineProperty(accessorRoot, 'ownershipDecision', {
      enumerable: true,
      get: getter,
    });

    expect(evaluateLocalBridgeRequesterExecutionBoundary(trappedObject(rootTraps) as never)
      .blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
        'invalid_input_shape',
      ]));
    expect(evaluateLocalBridgeRequesterExecutionBoundary({
      ownershipDecision: trappedObject(nestedTraps),
    } as never).blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'invalid_input_shape',
    ]));
    expect(evaluateLocalBridgeRequesterExecutionBoundary(accessorRoot as never)
      .blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
        'invalid_input_shape',
      ]));

    expect(rootTraps).toEqual([]);
    expect(nestedTraps).toEqual([]);
    expect(getter).not.toHaveBeenCalled();
  });

  it('blocks token-shaped identifiers and secret-bearing URLs without echoing them', () => {
    const input = validInput();
    const secretUrl = 'http://user:synthetic-url-secret@127.0.0.1:11434/health?token=secret#fragment';
    const decision = evaluateLocalBridgeRequesterExecutionBoundary(trustedRecord({
      ...input,
      requesterExecutionFact: requesterFact(input.dryRunTransportDecision!, {
        capabilityId: 'sk-capabilityshouldneverecho',
        url: secretUrl,
      }),
      requesterResult: { accessToken: 'sk-resultshouldneverecho' },
    }));

    expect(decision.status).toBe('blocked');
    expect(decision.metadata).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'token_shaped_identifier',
      'secret_bearing_url',
      'raw_secret_material',
      'requester_result_forbidden',
    ]));
    expect(serialized(decision)).not.toContain('sk-capabilityshouldneverecho');
    expect(serialized(decision)).not.toContain('synthetic-url-secret');
    expect(serialized(decision)).not.toContain('sk-resultshouldneverecho');

    expect(evaluateLocalBridgeRequesterExecutionBoundary(trustedRecord({
      ...input,
      requesterExecutionFact: requesterFact(input.dryRunTransportDecision!, {
        url: '127.0.0.1:11434/health',
      }),
    })).blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'schemeless_url_ambiguous',
    ]));

    expect(evaluateLocalBridgeRequesterExecutionBoundary(trustedRecord({
      ...input,
      requesterExecutionFact: requesterFact(input.dryRunTransportDecision!, {
        acceptedEndpoint: 'mailto:bridge@example.invalid',
        url: 'urn:local-bridge:health',
      }),
    })).blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'schemeless_url_ambiguous',
    ]));
  });

  it('rejects scheme-shaped generic identifiers while preserving local-bridge credential references', () => {
    const input = validInput();
    const validDecision = evaluateLocalBridgeRequesterExecutionBoundary(input);

    expect(validDecision.status).toBe('eligible');
    expect(validDecision.metadata?.credentialReferenceId).toBe('local-bridge:assistantcaddy/llm');

    const factIdentifierDecision = evaluateLocalBridgeRequesterExecutionBoundary(trustedRecord({
      ...input,
      requesterExecutionFact: requesterFact(input.dryRunTransportDecision!, {
        capabilityId: 'mailto:user@example.test',
        requesterId: 'urn:provider:opaque',
      }),
    }));

    expect(factIdentifierDecision.status).toBe('blocked');
    expect(factIdentifierDecision.metadata).toBeUndefined();
    expect(factIdentifierDecision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'token_shaped_identifier',
    ]));
    expect(serialized(factIdentifierDecision)).not.toContain('mailto:user@example.test');
    expect(serialized(factIdentifierDecision)).not.toContain('urn:provider:opaque');

    const forgedDryRun = {
      ...input.dryRunTransportDecision!,
      metadata: {
        ...input.dryRunTransportDecision!.metadata!,
        capability: {
          ...input.dryRunTransportDecision!.metadata!.capability,
          id: 'mailto:user@example.test',
        },
        resultId: 'urn:provider:opaque',
      },
    } as typeof input.dryRunTransportDecision;

    const dryRunIdentifierDecision = evaluateLocalBridgeRequesterExecutionBoundary(trustedRecord({
      ...input,
      dryRunTransportDecision: forgedDryRun,
      requesterExecutionFact: requesterFact(input.dryRunTransportDecision!),
    }));

    expect(dryRunIdentifierDecision.status).toBe('blocked');
    expect(dryRunIdentifierDecision.metadata).toBeUndefined();
    expect(dryRunIdentifierDecision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'dry_run_boundary_mismatch',
    ]));
  });

  it('blocks endpoint drift even when forged ownership dry-run and requester facts agree with each other', () => {
    const input = validInput();
    const driftedUrl = 'http://127.0.0.1:8766/health';
    const forgedOwnership = {
      ...input.ownershipDecision!,
      descriptor: {
        ...input.ownershipDecision!.descriptor!,
        bridge: {
          ...input.ownershipDecision!.descriptor!.bridge,
          url: driftedUrl,
        },
      },
    } as typeof input.ownershipDecision;
    const forgedDryRun = {
      ...input.dryRunTransportDecision!,
      metadata: {
        ...input.dryRunTransportDecision!.metadata!,
        transport: {
          ...input.dryRunTransportDecision!.metadata!.transport,
          url: driftedUrl,
        },
      },
    } as typeof input.dryRunTransportDecision;

    const decision = evaluateLocalBridgeRequesterExecutionBoundary(trustedRecord({
      ...input,
      ownershipDecision: forgedOwnership,
      dryRunTransportDecision: forgedDryRun,
      requesterExecutionFact: requesterFact(forgedDryRun!),
    }));

    expect(decision.status).toBe('blocked');
    expect(decision.metadata).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'ownership_boundary_mismatch',
      'dry_run_boundary_mismatch',
      'endpoint_binding_mismatch',
    ]));
    expect(serialized(decision)).not.toContain('8766/health');
  });

  it('blocks non-local requester endpoints even when forged facts match each other', () => {
    const input = validInput();
    const forgedFact = requesterFact(input.dryRunTransportDecision!, {
      acceptedEndpoint: 'https://example.test/v1',
      url: 'https://example.test/health',
    });
    const forgedDryRun = {
      ...input.dryRunTransportDecision!,
      metadata: {
        ...input.dryRunTransportDecision!.metadata!,
        bridge: {
          ...input.dryRunTransportDecision!.metadata!.bridge,
          acceptedEndpoint: 'https://example.test/v1',
        },
        transport: {
          ...input.dryRunTransportDecision!.metadata!.transport,
          url: 'https://example.test/health',
        },
      },
    } as typeof input.dryRunTransportDecision;

    const decision = evaluateLocalBridgeRequesterExecutionBoundary(trustedRecord({
      ...input,
      dryRunTransportDecision: forgedDryRun,
      requesterExecutionFact: forgedFact,
    }));

    expect(decision.status).toBe('blocked');
    expect(decision.metadata).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'bridge_mismatch',
      'transport_mismatch',
      'non_local_endpoint',
    ]));
    expect(serialized(decision)).not.toContain('example.test');
  });

  it('blocks requester facts with callback or transport-capable extra fields', () => {
    const decision = evaluateLocalBridgeRequesterExecutionBoundary(validInput({
      requesterExecutionFact: {
        ...requesterFact(),
        callback: 'callback-placeholder',
        fetch: 'fetch-placeholder',
        socket: 'socket-placeholder',
      },
    }));

    expect(decision.status).toBe('blocked');
    expect(decision.metadata).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'requester_fact_extra_field',
    ]));
  });

  it('blocks allowed-field object and function poisoning without callable invocation', () => {
    const poison = vi.fn();
    const input = validInput();
    const poisonedOwnership = {
      ...input.ownershipDecision!,
      descriptor: {
        ...input.ownershipDecision!.descriptor!,
        capability: {
          ...input.ownershipDecision!.descriptor!.capability,
          requesterId: { nested: 'browser-injected-local-bridge-requester' },
        },
      },
    } as never;
    const poisonedDryRun = {
      ...input.dryRunTransportDecision!,
      metadata: {
        ...input.dryRunTransportDecision!.metadata!,
        owner: { nested: 'assistantcaddy-local-bridge-setup' },
      },
    } as never;
    const poisonedFact = {
      ...requesterFact(input.dryRunTransportDecision!),
      timeoutMs: { value: 2_000 },
    } as never;

    const decision = evaluateLocalBridgeRequesterExecutionBoundary(trustedRecord({
      ...input,
      ownershipDecision: poisonedOwnership,
      dryRunTransportDecision: poisonedDryRun,
      requesterExecutionFact: poisonedFact,
    }));
    const functionPoisonDecision = evaluateLocalBridgeRequesterExecutionBoundary({
      ...validInput(),
      requesterExecutionFact: {
        ...requesterFact(input.dryRunTransportDecision!),
        timeoutMs: { valueOf: poison },
      },
    } as never);

    expect(decision.status).toBe('blocked');
    expect(decision.metadata).toBeUndefined();
    expect(functionPoisonDecision.status).toBe('blocked');
    expect(poison).not.toHaveBeenCalled();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'ownership_boundary_mismatch',
      'dry_run_boundary_mismatch',
      'requester_fact_invalid',
    ]));
    expect(functionPoisonDecision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'invalid_input_shape',
    ]));
  });

  it('blocks unsafe upstream dry-run metadata and live-claiming requester results without echoing payloads', () => {
    const input = validInput();
    const decision = evaluateLocalBridgeRequesterExecutionBoundary(trustedRecord({
      ...input,
      dryRunTransportDecision: {
        ...input.dryRunTransportDecision!,
        metadata: {
          ...input.dryRunTransportDecision!.metadata!,
          fetch: 'fetch-placeholder',
          requesterResult: { status: 'ok' },
        },
      } as never,
      requesterResult: {
        executed: true,
        responseText: 'bearer synthetic-result-token',
      },
    }));

    expect(decision.status).toBe('blocked');
    expect(decision.metadata).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'dry_run_boundary_mismatch',
      'requester_result_forbidden',
      'forged_live_execution_flag',
      'raw_secret_material',
    ]));
    expect(serialized(decision)).not.toContain('synthetic-result-token');
    expect(serialized(decision)).not.toContain('responseText');
  });

  it('performs no fetch socket storage credential provider or requester side effects', () => {
    const fetchSpy = vi.fn();
    const webSocketSpy = vi.fn();
    const eventSourceSpy = vi.fn();
    const xhrSpy = vi.fn();
    const indexedDbSpy = vi.fn();
    const requesterSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', webSocketSpy);
    vi.stubGlobal('EventSource', eventSourceSpy);
    vi.stubGlobal('XMLHttpRequest', xhrSpy);
    vi.stubGlobal('indexedDB', indexedDbSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');

    evaluateLocalBridgeRequesterExecutionBoundary(validInput());
    evaluateLocalBridgeRequesterExecutionBoundary({
      ...validInput(),
      directRequester: requesterSpy,
      requesterResult: { status: 'not-accepted' },
    } as never);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(webSocketSpy).not.toHaveBeenCalled();
    expect(eventSourceSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
    expect(indexedDbSpy).not.toHaveBeenCalled();
    expect(requesterSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });
});
