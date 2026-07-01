import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalBridgeDiscoveryPlan, type LocalBridgeKind } from '../lib/local-bridge-discovery';
import {
  evaluateLocalBridgeProbeExecutionGate,
  type LocalBridgeInertManualProbePlan,
  type LocalBridgeProbeExecutionDecision,
} from '../lib/local-bridge-probe-execution-gate';
import {
  planLocalBridgeRequesterOwnership,
  type LocalBridgeRequesterCapabilityFact,
  type LocalBridgeRequesterOwnershipDecision,
} from '../lib/local-bridge-requester-ownership';
import {
  bindLocalBridgeDryRunTransportHarness,
  type LocalBridgeDryRunTransportResultInput,
} from '../lib/local-bridge-dry-run-transport-harness';
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
  throw new TypeError('Dry-run harness trusted fixtures cannot include callable values.');
}

function trustedRecord<T extends Record<string, unknown>>(value: T): T {
  return createRuntimeTrustedContractObject(
    Object.entries(value).map(([key, nested]) => [key, trustedValue(nested)] as const),
  ) as unknown as T;
}

function trustedHarnessInput(
  ownership: LocalBridgeRequesterOwnershipDecision | null | undefined,
  result: LocalBridgeDryRunTransportResultInput | null | undefined,
) {
  return trustedRecord({
    ownershipDecision: ownership === null || ownership === undefined ? ownership : trustedRecord(ownership as unknown as Record<string, unknown>),
    dryRunResult: result === null || result === undefined ? result : trustedRecord(result as unknown as Record<string, unknown>),
  });
}

function bindHarness(
  ownership: LocalBridgeRequesterOwnershipDecision | null | undefined,
  result: LocalBridgeDryRunTransportResultInput | null | undefined,
) {
  return bindLocalBridgeDryRunTransportHarness(
    trustedHarnessInput(ownership, result) as Parameters<typeof bindLocalBridgeDryRunTransportHarness>[0],
  );
}

function blockerCodes(
  ownership: LocalBridgeRequesterOwnershipDecision,
  result: LocalBridgeDryRunTransportResultInput,
) {
  return bindHarness(ownership, result).blockers.map((blocker) => blocker.code);
}

function serialized(value: unknown): string {
  return JSON.stringify(value);
}

describe('local bridge dry-run transport harness contract', () => {
  it('binds owned requester metadata to frozen safe dry-run transport metadata only', () => {
    const ownership = ownershipDecision();
    const decision = bindHarness(ownership, dryRunResult(ownership));

    expect(decision.status).toBe('accepted');
    expect(decision.accepted).toBe(true);
    expect(decision.blockers).toEqual([]);
    expect(decision.sideEffectBoundary).toBe('dry-run-transport-metadata-only-no-fetch-no-socket-no-storage-no-provider-no-credentials');
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.blockers)).toBe(true);
    expect(Object.isFrozen(decision.metadata)).toBe(true);
    expect(Object.isFrozen(decision.metadata?.capability)).toBe(true);
    expect(Object.isFrozen(decision.metadata?.owner)).toBe(true);
    expect(Object.isFrozen(decision.metadata?.bridge)).toBe(true);
    expect(Object.isFrozen(decision.metadata?.transport)).toBe(true);

    expect(decision.metadata).toEqual({
      schemaVersion: 1,
      metadataKind: 'local-bridge-dry-run-transport',
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
      resultId: 'dry-run-result-001',
      dispatchAllowed: false,
      executable: false,
      sideEffects: 'none',
      sideEffectBoundary: 'dry-run-transport-metadata-only-no-fetch-no-socket-no-storage-no-provider-no-credentials',
    });
    expect(serialized(decision)).not.toContain('headers');
    expect(serialized(decision)).not.toContain('body');
    expect(serialized(decision)).not.toContain('result text');
  });

  it('rejects blocked ownership decisions', () => {
    const blockedOwnership = ownershipDecision({
      requesterCapability: requesterCapability(probePlan(), { reviewState: 'revoked' }),
    });
    const owned = ownershipDecision();
    const decision = bindHarness(blockedOwnership, dryRunResult(owned));

    expect(decision.status).toBe('blocked');
    expect(decision.metadata).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'ownership_decision_blocked',
      'ownership_descriptor_missing',
    ]));
  });

  it('rejects owner capability endpoint method and timeout mismatches', () => {
    const ownership = ownershipDecision();
    const result = dryRunResult(ownership, {
      ownerSurface: 'emailcaddy-local-bridge-setup',
      capabilityId: 'local-bridge-requester.other',
      acceptedEndpoint: 'http://127.0.0.1:8766/v1',
      method: 'POST',
      url: 'http://127.0.0.1:8766/health',
      timeoutMs: 3_000,
    });

    expect(blockerCodes(ownership, result)).toEqual(expect.arrayContaining([
      'owner_mismatch',
      'capability_mismatch',
      'bridge_mismatch',
      'transport_method_mismatch',
      'transport_url_mismatch',
      'transport_timeout_mismatch',
    ]));
  });

  it('rejects forged executed live probe and dispatch flags', () => {
    const ownership = ownershipDecision();
    const decision = bindHarness(
      ownership,
      dryRunResult(ownership, {
        dispatchAllowed: true,
        executable: true,
        sideEffects: 'network',
        executed: true,
        probed: true,
        live: true,
        liveExecution: true,
        probeAllowed: true,
      }),
    );

    expect(decision.status).toBe('blocked');
    expect(decision.metadata).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'dispatch_boundary_mismatch',
      'forged_live_execution_flag',
    ]));
  });

  it('rejects token-shaped result identifiers without echoing them', () => {
    const ownership = ownershipDecision();
    const decision = bindHarness(
      ownership,
      dryRunResult(ownership, {
        resultId: 'sk-resultshouldneverecho',
        runId: 'github_pat_resultshouldneverecho',
      }),
    );

    expect(decision.status).toBe('blocked');
    expect(decision.metadata).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'token_shaped_identifier',
    ]));
    expect(serialized(decision)).not.toContain('sk-resultshouldneverecho');
    expect(serialized(decision)).not.toContain('github_pat_resultshouldneverecho');
  });

  it('rejects scheme-shaped generic identifiers while preserving local-bridge credential handles', () => {
    const ownership = ownershipDecision();
    const validDecision = bindHarness(ownership, dryRunResult(ownership));

    expect(validDecision.status).toBe('accepted');
    expect(validDecision.metadata?.credentialReferenceId).toBe('local-bridge:assistantcaddy/llm');

    const schemeDecision = bindHarness(
      ownership,
      dryRunResult(ownership, {
        capabilityId: 'mailto:user@example.test',
        requesterId: 'urn:provider:opaque',
        resultId: 'api.example.test/path',
      }),
    );

    expect(schemeDecision.status).toBe('blocked');
    expect(schemeDecision.metadata).toBeUndefined();
    expect(schemeDecision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'token_shaped_identifier',
    ]));
    expect(serialized(schemeDecision)).not.toContain('mailto:user@example.test');
    expect(serialized(schemeDecision)).not.toContain('urn:provider:opaque');
    expect(serialized(schemeDecision)).not.toContain('api.example.test/path');

    const credentialSchemeDecision = bindHarness(
      ownership,
      dryRunResult(ownership, {
        credentialReferenceId: 'urn:provider:opaque',
      }),
    );

    expect(credentialSchemeDecision.status).toBe('blocked');
    expect(credentialSchemeDecision.metadata).toBeUndefined();
    expect(credentialSchemeDecision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'token_shaped_identifier',
      'credential_reference_mismatch',
    ]));
    expect(serialized(credentialSchemeDecision)).not.toContain('urn:provider:opaque');
  });

  it('rejects schemeless and secret-bearing URLs body headers and text without echoing raw material', () => {
    const ownership = ownershipDecision();
    const secretHeader = 'Bearer should-not-echo';
    const secretBody = 'sk-bodyshouldneverecho';
    const secretText = 'api_token=secrettextshouldneverecho';
    const decision = bindHarness(
      ownership,
      dryRunResult(ownership, {
        url: 'http://user:synthetic-url-secret@127.0.0.1:11434/health?token=secret#fragment',
        headers: { Authorization: secretHeader },
        body: { accessToken: secretBody },
        responseText: secretText,
      }),
    );

    expect(decision.status).toBe('blocked');
    expect(decision.metadata).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'secret_bearing_url',
      'headers_forbidden',
      'body_forbidden',
      'raw_secret_material',
    ]));
    expect(serialized(decision)).not.toContain('synthetic-url-secret');
    expect(serialized(decision)).not.toContain(secretHeader);
    expect(serialized(decision)).not.toContain(secretBody);
    expect(serialized(decision)).not.toContain(secretText);

    expect(blockerCodes(ownership, dryRunResult(ownership, { url: '127.0.0.1:11434/health' }))).toEqual(expect.arrayContaining([
      'schemeless_url_ambiguous',
    ]));
  });

  it('rejects credential reference mismatches and direct requester functions', () => {
    const ownership = ownershipDecision();
    const decision = bindHarness(
      ownership,
      dryRunResult(ownership, {
        credentialReferenceId: 'local-bridge:other/llm',
        directRequester: 'direct-requester-placeholder',
      }),
    );

    expect(decision.status).toBe('blocked');
    expect(decision.metadata).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'credential_reference_mismatch',
      'direct_requester_forbidden',
    ]));
  });

  it('rejects unsupported callback requester fetch socket storage and live-action fields without invocation', () => {
    const ownership = ownershipDecision();
    const requester = vi.fn();

    const poisonedRoot = bindLocalBridgeDryRunTransportHarness({
      ownershipDecision: ownership,
      dryRunResult: dryRunResult(ownership),
      requester,
    } as never);
    const poisonedResult = bindHarness(
      ownership,
      dryRunResult(ownership, {
        callback: 'blocked-callback',
        fetch: 'blocked-fetch',
        socket: 'blocked-socket',
        storageAdapter: { liveAction: 'blocked-live-action' },
      } as never),
    );

    expect(poisonedRoot.status).toBe('blocked');
    expect(poisonedRoot.metadata).toBeUndefined();
    expect(poisonedRoot.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'input_shape_forbidden',
    ]));
    expect(poisonedResult.status).toBe('blocked');
    expect(poisonedResult.metadata).toBeUndefined();
    expect(poisonedResult.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'dry_run_result_invalid',
      'input_shape_forbidden',
    ]));
    expect(requester).not.toHaveBeenCalled();
  });

  it('rejects raw proxy and accessor roots or nested results without executing traps or getters', () => {
    const ownership = ownershipDecision();
    const rootTrapLog: string[] = [];
    const nestedTrapLog: string[] = [];
    const rootGetter = vi.fn();
    const nestedGetter = vi.fn();
    const rootProxy = new Proxy({}, {
      get() {
        rootTrapLog.push('get');
        return undefined;
      },
      ownKeys() {
        rootTrapLog.push('ownKeys');
        return [];
      },
      getOwnPropertyDescriptor() {
        rootTrapLog.push('getOwnPropertyDescriptor');
        return undefined;
      },
      getPrototypeOf() {
        rootTrapLog.push('getPrototypeOf');
        return null;
      },
    });
    const nestedProxy = new Proxy({}, {
      get() {
        nestedTrapLog.push('get');
        return undefined;
      },
      ownKeys() {
        nestedTrapLog.push('ownKeys');
        return [];
      },
      getOwnPropertyDescriptor() {
        nestedTrapLog.push('getOwnPropertyDescriptor');
        return undefined;
      },
      getPrototypeOf() {
        nestedTrapLog.push('getPrototypeOf');
        return null;
      },
    });
    const accessorRoot = {};
    Object.defineProperty(accessorRoot, 'dryRunResult', {
      enumerable: true,
      get: rootGetter,
    });
    const accessorNested = {};
    Object.defineProperty(accessorNested, 'resultKind', {
      enumerable: true,
      get: nestedGetter,
    });

    expect(bindLocalBridgeDryRunTransportHarness(rootProxy as never)).toMatchObject({
      status: 'blocked',
      accepted: false,
    });
    expect(bindLocalBridgeDryRunTransportHarness(accessorRoot as never)).toMatchObject({
      status: 'blocked',
      accepted: false,
    });
    expect(bindLocalBridgeDryRunTransportHarness({
      ownershipDecision: trustedRecord(ownership as unknown as Record<string, unknown>),
      dryRunResult: nestedProxy,
    } as never)).toMatchObject({
      status: 'blocked',
      accepted: false,
    });
    expect(bindLocalBridgeDryRunTransportHarness({
      ownershipDecision: trustedRecord(ownership as unknown as Record<string, unknown>),
      dryRunResult: accessorNested,
    } as never)).toMatchObject({
      status: 'blocked',
      accepted: false,
    });

    expect(rootTrapLog).toEqual([]);
    expect(nestedTrapLog).toEqual([]);
    expect(rootGetter).not.toHaveBeenCalled();
    expect(nestedGetter).not.toHaveBeenCalled();
  });

  it('performs no fetch socket storage credential provider or requester side effects', () => {
    const fetchSpy = vi.fn();
    const webSocketSpy = vi.fn();
    const xhrSpy = vi.fn();
    const indexedDbSpy = vi.fn();
    const requesterSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', webSocketSpy);
    vi.stubGlobal('XMLHttpRequest', xhrSpy);
    vi.stubGlobal('indexedDB', indexedDbSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');

    const ownership = ownershipDecision();
    bindHarness(ownership, dryRunResult(ownership));
    bindHarness(ownership, dryRunResult(ownership, { directRequester: 'requester-placeholder' }));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(webSocketSpy).not.toHaveBeenCalled();
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
