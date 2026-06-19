import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLocalBridgeDiscoveryPlan,
  type LocalBridgeKind,
} from '../lib/local-bridge-discovery';
import {
  evaluateLocalBridgeProbeExecutionGate,
  type LocalBridgeInertManualProbePlan,
  type LocalBridgeProbeExecutionDecision,
} from '../lib/local-bridge-probe-execution-gate';
import {
  planLocalBridgeRequesterOwnership,
  type LocalBridgeRequesterCapabilityFact,
} from '../lib/local-bridge-requester-ownership';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';

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
    credentialPolicy: 'none',
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

function transportRequest(plan: LocalBridgeInertManualProbePlan = probePlan()) {
  return {
    method: plan.method,
    url: plan.url,
    timeoutMs: plan.timeoutMs,
  };
}

function validInput(overrides: Partial<Parameters<typeof planLocalBridgeRequesterOwnership>[0]> = {}) {
  const decision = gateDecision();
  const plan = probePlan(decision);
  return {
    gateDecision: decision,
    probePlan: plan,
    requesterCapability: requesterCapability(plan),
    transportRequest: transportRequest(plan),
    ownerSurface: 'assistantcaddy-local-bridge-setup',
    actionId: 'probe_local_bridge',
    capabilityId: 'local-bridge-requester.llm.health',
    now: 1_700_000_000_100,
    ...overrides,
  };
}

function blockerCodes(input: Parameters<typeof planLocalBridgeRequesterOwnership>[0]) {
  return planLocalBridgeRequesterOwnership(input).blockers.map((blocker) => blocker.code);
}

function serialized(value: unknown): string {
  return JSON.stringify(value);
}

describe('local bridge requester ownership contract', () => {
  it('binds exact reviewed requester ownership to an inert local bridge probe plan and returns safe metadata only', () => {
    const decision = planLocalBridgeRequesterOwnership(validInput());

    expect(decision.status).toBe('owned');
    expect(decision.owned).toBe(true);
    expect(decision.blockers).toEqual([]);
    expect(decision.sideEffectBoundary).toBe('ownership-metadata-only-no-fetch-no-socket-no-storage-no-provider-no-credentials');
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.blockers)).toBe(true);
    expect(Object.isFrozen(decision.descriptor)).toBe(true);
    expect(Object.isFrozen(decision.descriptor?.capability)).toBe(true);
    expect(Object.isFrozen(decision.descriptor?.owner)).toBe(true);
    expect(Object.isFrozen(decision.descriptor?.bridge)).toBe(true);

    expect(decision.descriptor).toEqual({
      schemaVersion: 1,
      descriptorKind: 'local-bridge-requester-ownership',
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
        method: 'GET',
        url: 'http://127.0.0.1:11434/health',
        timeoutMs: 2_000,
      },
      executable: false,
      dispatchAllowed: false,
      sideEffects: 'none',
      sideEffectBoundary: 'ownership-metadata-only-no-fetch-no-socket-no-storage-no-provider-no-credentials',
    });
    expect(serialized(decision)).not.toContain('function');
    expect(serialized(decision)).not.toContain('token');
  });

  it('blocks accepted endpoint and requester endpoint mismatches', () => {
    const input = validInput();
    const plan = input.probePlan!;
    const changedPlan: LocalBridgeInertManualProbePlan = {
      ...plan,
      acceptedEndpoint: 'http://127.0.0.1:8766/v1',
      url: 'http://127.0.0.1:8766/health',
    };

    const decision = planLocalBridgeRequesterOwnership({
      ...input,
      probePlan: changedPlan,
      transportRequest: transportRequest(changedPlan),
    });

    expect(decision.status).toBe('blocked');
    expect(decision.descriptor).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'probe_plan_mismatch',
      'requester_capability_mismatch',
      'accepted_endpoint_mismatch',
    ]));
  });

  it('blocks method mismatches before requester dispatch metadata is returned', () => {
    const input = validInput();
    const decision = planLocalBridgeRequesterOwnership({
      ...input,
      transportRequest: {
        ...input.transportRequest!,
        method: 'POST',
      },
    });

    expect(decision.status).toBe('blocked');
    expect(decision.descriptor).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'transport_method_mismatch',
    ]));
  });

  it('blocks stale revoked unreviewed and expired requester capability facts', () => {
    expect(blockerCodes(validInput({
      requesterCapability: requesterCapability(probePlan(), { reviewState: 'draft' }),
    }))).toEqual(expect.arrayContaining(['requester_capability_not_reviewed']));
    expect(blockerCodes(validInput({
      requesterCapability: requesterCapability(probePlan(), { reviewState: 'stale' }),
    }))).toEqual(expect.arrayContaining(['requester_capability_stale']));
    expect(blockerCodes(validInput({
      requesterCapability: requesterCapability(probePlan(), { stale: true }),
    }))).toEqual(expect.arrayContaining(['requester_capability_stale']));
    expect(blockerCodes(validInput({
      requesterCapability: requesterCapability(probePlan(), { reviewState: 'revoked' }),
    }))).toEqual(expect.arrayContaining(['requester_capability_revoked']));
    expect(blockerCodes(validInput({
      requesterCapability: requesterCapability(probePlan(), { expiresAt: 1_700_000_000_000 }),
    }))).toEqual(expect.arrayContaining(['requester_capability_expired']));
  });

  it('blocks secret-bearing URLs headers and bodies without echoing secret-shaped values', () => {
    const input = validInput();
    const decision = planLocalBridgeRequesterOwnership({
      ...input,
      transportRequest: {
        ...input.transportRequest!,
        url: 'http://127.0.0.1:11434/health?token=synthetic-secret',
        headers: {
          Authorization: 'Bearer should-not-echo',
        },
        body: {
          accessToken: 'sk-bodyshouldneverecho',
        },
      },
    });

    expect(decision.status).toBe('blocked');
    expect(decision.descriptor).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'raw_secret_material',
      'transport_headers_forbidden',
      'transport_body_forbidden',
      'transport_url_mismatch',
    ]));
    expect(serialized(decision)).not.toContain('synthetic-secret');
    expect(serialized(decision)).not.toContain('should-not-echo');
    expect(serialized(decision)).not.toContain('sk-bodyshouldneverecho');
  });

  it('blocks forged allowed flags live execution claims and direct requester functions', () => {
    const input = validInput();
    const decision = planLocalBridgeRequesterOwnership({
      ...input,
      gateDecision: {
        ...input.gateDecision!,
        allowed: true,
        executed: true,
      } as unknown as LocalBridgeProbeExecutionDecision,
      transportRequest: {
        ...input.transportRequest!,
        allowed: true,
        executable: true,
        sideEffects: 'network',
      },
      directRequester: vi.fn(),
    });

    expect(decision.status).toBe('blocked');
    expect(decision.descriptor).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'transport_live_execution_claim',
      'direct_requester_forbidden',
    ]));
  });

  it('blocks schemeless URL ambiguity and token-shaped identifiers without echoing them', () => {
    const input = validInput();
    const plan = input.probePlan!;
    const schemelessPlan = {
      ...plan,
      acceptedEndpoint: '127.0.0.1:11434/v1',
      url: '127.0.0.1:11434/health',
    } as unknown as LocalBridgeInertManualProbePlan;
    const decision = planLocalBridgeRequesterOwnership({
      ...input,
      probePlan: schemelessPlan,
      requesterCapability: requesterCapability(plan, {
        capabilityId: 'sk-capabilityshouldneverecho',
      }),
      capabilityId: 'sk-requestshouldneverecho',
      transportRequest: {
        method: 'GET',
        url: '127.0.0.1:11434/health',
        timeoutMs: 2_000,
      },
    });

    expect(decision.status).toBe('blocked');
    expect(decision.descriptor).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'schemeless_url_ambiguous',
      'identifier_invalid',
      'raw_secret_material',
    ]));
    expect(serialized(decision)).not.toContain('sk-capabilityshouldneverecho');
    expect(serialized(decision)).not.toContain('sk-requestshouldneverecho');
  });

  it('binds optional opaque credential reference metadata when the requester policy requires it', () => {
    const input = validInput();
    const plan = input.probePlan!;
    const decision = planLocalBridgeRequesterOwnership({
      ...input,
      requesterCapability: requesterCapability(plan, {
        credentialPolicy: 'opaque-reference-required',
        credentialReferenceId: 'local-bridge:assistantcaddy/llm',
      }),
      credentialReference: credential(),
    });

    expect(decision.status).toBe('owned');
    expect(decision.descriptor?.credentialReference).toEqual({
      schemaVersion: 1,
      kind: 'local-bridge',
      id: 'local-bridge:assistantcaddy/llm',
      storageOwner: 'local-bridge',
      providerId: 'local-llm',
      connectorId: 'local-bridge-llm',
      accountId: 'account-1',
    });

    expect(blockerCodes({
      ...input,
      requesterCapability: requesterCapability(plan, {
        credentialPolicy: 'opaque-reference-required',
        credentialReferenceId: 'local-bridge:assistantcaddy/llm',
      }),
      credentialReference: credential({ id: 'local-bridge:other/llm' }),
    })).toEqual(expect.arrayContaining(['credential_reference_mismatch']));
  });

  it('performs no fetch websocket xhr storage indexedDB or requester side effects while planning ownership', () => {
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

    planLocalBridgeRequesterOwnership(validInput());
    planLocalBridgeRequesterOwnership(validInput({
      requesterCapability: requesterCapability(probePlan(), { reviewState: 'draft' }),
      directRequester: requesterSpy,
    }));

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
