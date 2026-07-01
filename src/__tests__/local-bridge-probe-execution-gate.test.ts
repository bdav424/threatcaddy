import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateLocalBridgeProbeExecutionGate,
  type LocalBridgeProbeExplicitUserActionFact,
} from '../lib/local-bridge-probe-execution-gate';
import {
  createLocalBridgeDiscoveryPlan,
  type LocalBridgeDiscoveryPlan,
  type LocalBridgeKind,
} from '../lib/local-bridge-discovery';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function explicitAction(
  bridgeKind: LocalBridgeKind = 'llm',
  overrides: Partial<LocalBridgeProbeExplicitUserActionFact> = {},
): LocalBridgeProbeExplicitUserActionFact {
  return {
    action: 'probe_local_bridge',
    bridgeKind,
    granted: true,
    acknowledgedPlanOnly: true,
    ...overrides,
  };
}

function readyPlan(
  bridgeKind: LocalBridgeKind = 'llm',
  candidates: readonly string[] = ['127.0.0.1:11434/v1'],
): LocalBridgeDiscoveryPlan {
  return createLocalBridgeDiscoveryPlan({
    bridgeKind,
    candidates,
    consentGranted: true,
    defaultProbePath: '/health',
  });
}

function decisionFor(plan: LocalBridgeDiscoveryPlan) {
  return evaluateLocalBridgeProbeExecutionGate({
    expectedBridgeKind: plan.bridgeKind,
    discoveryPlan: plan,
    explicitUserAction: explicitAction(plan.bridgeKind),
  });
}

describe('local bridge probe execution gate', () => {
  it('allows only an inert manual probe plan for a revalidated ready discovery endpoint', () => {
    const decision = decisionFor(readyPlan());

    expect(decision).toEqual({
      status: 'allow',
      executable: false,
      sideEffects: 'none',
      bridgeKind: 'llm',
      acceptedEndpoint: 'http://127.0.0.1:11434/v1',
      allowReason: 'explicit_manual_probe_plan_ready',
      probePlan: {
        bridgeKind: 'llm',
        acceptedEndpoint: 'http://127.0.0.1:11434/v1',
        method: 'GET',
        url: 'http://127.0.0.1:11434/health',
        timeoutMs: 2_000,
        executable: false,
        sideEffects: 'none',
        sideEffectBoundary: 'plan-only-no-fetch-no-socket',
      },
      blockReasons: [],
      sideEffectBoundary: 'decision-only-no-fetch-no-socket-no-storage-no-provider-no-credentials',
    });
  });

  it('accepts a ready HTTPS plan whose original schemeless input used discovery defaults', () => {
    const plan = createLocalBridgeDiscoveryPlan({
      bridgeKind: 'agent-host',
      candidates: ['127.0.0.1:8766/bridge'],
      consentGranted: true,
      defaultScheme: 'https',
      defaultProbePath: '/health',
    });

    expect(decisionFor(plan)).toMatchObject({
      status: 'allow',
      bridgeKind: 'agent-host',
      acceptedEndpoint: 'https://127.0.0.1:8766/bridge',
      executable: false,
      sideEffects: 'none',
      probePlan: expect.objectContaining({
        url: 'https://127.0.0.1:8766/health',
        executable: false,
        sideEffects: 'none',
      }),
    });
  });

  it('requires explicit user probe action, consent, expected kind, and plan-only acknowledgement', () => {
    expect(evaluateLocalBridgeProbeExecutionGate({
      discoveryPlan: readyPlan(),
    })).toMatchObject({
      status: 'block',
      executable: false,
      sideEffects: 'none',
      probePlan: undefined,
      blockReasons: expect.arrayContaining([
        'missing_expected_bridge_kind',
        'missing_explicit_probe_action',
      ]),
    });

    expect(evaluateLocalBridgeProbeExecutionGate({
      expectedBridgeKind: 'mail',
      discoveryPlan: readyPlan('mail'),
      explicitUserAction: explicitAction('llm', {
        action: 'connect_local_bridge',
        granted: false,
        acknowledgedPlanOnly: false,
      }),
    })).toMatchObject({
      status: 'block',
      probePlan: undefined,
      blockReasons: expect.arrayContaining([
        'explicit_probe_action_mismatch',
        'explicit_probe_bridge_kind_mismatch',
        'explicit_probe_consent_not_granted',
        'explicit_probe_plan_boundary_not_acknowledged',
      ]),
    });
  });

  it('blocks wrong bridge kinds and discovery plans that are not ready with consent', () => {
    const missingConsentPlan = createLocalBridgeDiscoveryPlan({
      bridgeKind: 'llm',
      candidates: ['127.0.0.1:11434/v1'],
      consentGranted: false,
      defaultProbePath: '/health',
    });

    expect(evaluateLocalBridgeProbeExecutionGate({
      expectedBridgeKind: 'mail',
      discoveryPlan: readyPlan('llm'),
      explicitUserAction: explicitAction('mail'),
    })).toMatchObject({
      status: 'block',
      probePlan: undefined,
      blockReasons: expect.arrayContaining(['discovery_bridge_kind_mismatch']),
    });

    expect(evaluateLocalBridgeProbeExecutionGate({
      expectedBridgeKind: 'llm',
      discoveryPlan: missingConsentPlan,
      explicitUserAction: explicitAction('llm'),
    })).toMatchObject({
      status: 'block',
      probePlan: undefined,
      blockReasons: expect.arrayContaining([
        'discovery_not_ready',
        'discovery_not_allowed',
        'accepted_probe_not_allowed',
      ]),
    });
  });

  it('blocks ready-shaped discovery plans that have no accepted endpoint or probe', () => {
    const plan = readyPlan();

    expect(evaluateLocalBridgeProbeExecutionGate({
      expectedBridgeKind: 'llm',
      discoveryPlan: {
        ...plan,
        candidates: [],
      },
      explicitUserAction: explicitAction('llm'),
    })).toMatchObject({
      status: 'block',
      probePlan: undefined,
      blockReasons: expect.arrayContaining(['accepted_endpoint_missing']),
    });

    expect(evaluateLocalBridgeProbeExecutionGate({
      expectedBridgeKind: 'llm',
      discoveryPlan: {
        ...plan,
        candidates: [
          {
            ...plan.candidates[0],
            probe: null,
          },
        ],
      },
      explicitUserAction: explicitAction('llm'),
    })).toMatchObject({
      status: 'block',
      probePlan: undefined,
      blockReasons: expect.arrayContaining(['accepted_probe_missing']),
    });
  });

  it('fails closed for forged allowed public endpoint flags', () => {
    const plan = readyPlan();
    const decision = evaluateLocalBridgeProbeExecutionGate({
      expectedBridgeKind: 'llm',
      discoveryPlan: {
        ...plan,
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
      explicitUserAction: explicitAction('llm'),
    });

    expect(decision).toMatchObject({
      status: 'block',
      executable: false,
      sideEffects: 'none',
      probePlan: undefined,
      blockReasons: expect.arrayContaining(['accepted_endpoint_revalidation_failed']),
    });
  });

  it('fails closed when raw input and accepted probe endpoint bind to different local endpoints', () => {
    const plan = readyPlan();
    const decision = evaluateLocalBridgeProbeExecutionGate({
      expectedBridgeKind: 'llm',
      discoveryPlan: {
        ...plan,
        candidates: [
          {
            ...plan.candidates[0],
            input: '127.0.0.1:8766/v1',
            normalizedEndpoint: 'http://127.0.0.1:11434/v1',
            host: '127.0.0.1',
            accepted: true,
            probe: {
              method: 'GET',
              url: 'http://127.0.0.1:11434/health',
              timeoutMs: 2_000,
              allowed: true,
              consentRequired: false,
              sideEffectBoundary: 'plan-only-no-fetch-no-socket',
            },
            rejectionReasons: [],
          },
        ],
      },
      explicitUserAction: explicitAction('llm'),
    });

    expect(decision).toMatchObject({
      status: 'block',
      executable: false,
      sideEffects: 'none',
      probePlan: undefined,
      blockReasons: expect.arrayContaining(['accepted_endpoint_revalidation_failed']),
    });
  });

  it('blocks forged secret-bearing URLs, authority credentials, and fragments without echoing secrets', () => {
    const base = readyPlan();
    const secretCases: LocalBridgeDiscoveryPlan[] = [
      {
        ...base,
        candidates: [{
          ...base.candidates[0],
          input: 'http://127.0.0.1:11434/v1?token=synthetic-secret',
        }],
      },
      {
        ...base,
        candidates: [{
          ...base.candidates[0],
          normalizedEndpoint: 'http://user:synthetic-secret@127.0.0.1:11434/v1',
        }],
      },
      {
        ...base,
        candidates: [{
          ...base.candidates[0],
          normalizedEndpoint: 'http://127.0.0.1:11434/v1#synthetic-secret',
        }],
      },
      {
        ...base,
        candidates: [{
          ...base.candidates[0],
          probe: {
            ...base.candidates[0].probe!,
            url: 'http://127.0.0.1:11434/health?api_key=synthetic-secret',
          },
        }],
      },
    ];

    secretCases.forEach((plan) => {
      const decision = decisionFor(plan);
      expect(decision).toMatchObject({
        status: 'block',
        probePlan: undefined,
        blockReasons: expect.arrayContaining(['accepted_endpoint_revalidation_failed']),
      });
      expect(JSON.stringify(decision)).not.toContain('synthetic-secret');
    });
  });

  it('blocks accepted probes whose method, allowed flags, or boundary are forged', () => {
    const plan = readyPlan();
    const decision = evaluateLocalBridgeProbeExecutionGate({
      expectedBridgeKind: 'llm',
      discoveryPlan: {
        ...plan,
        candidates: [{
          ...plan.candidates[0],
          probe: {
            ...plan.candidates[0].probe!,
            allowed: false,
            consentRequired: true,
            method: 'POST' as 'GET',
            sideEffectBoundary: 'executes-network-call' as 'plan-only-no-fetch-no-socket',
          },
        }],
      },
      explicitUserAction: explicitAction('llm'),
    });

    expect(decision).toMatchObject({
      status: 'block',
      probePlan: undefined,
      blockReasons: expect.arrayContaining([
        'accepted_probe_not_allowed',
        'accepted_probe_boundary_mismatch',
      ]),
    });
  });

  it('rejects unsafe callback requester fetch socket storage and live-action fields without invocation', () => {
    const requester = vi.fn();
    const fetcher = vi.fn();
    const socket = vi.fn();
    const liveAction = vi.fn();
    const plan = readyPlan();

    const poisonedRoot = evaluateLocalBridgeProbeExecutionGate({
      expectedBridgeKind: 'llm',
      discoveryPlan: plan,
      explicitUserAction: explicitAction('llm'),
      requester,
    } as never);
    const poisonedAction = evaluateLocalBridgeProbeExecutionGate({
      expectedBridgeKind: 'llm',
      discoveryPlan: plan,
      explicitUserAction: {
        ...explicitAction('llm'),
        fetch: fetcher,
        socket,
        storageAdapter: { liveAction },
      } as never,
    });

    expect(poisonedRoot).toMatchObject({
      status: 'block',
      executable: false,
      probePlan: undefined,
      blockReasons: ['input_shape_forbidden'],
    });
    expect(poisonedAction).toMatchObject({
      status: 'block',
      executable: false,
      probePlan: undefined,
      blockReasons: expect.arrayContaining(['input_shape_forbidden']),
    });
    expect(requester).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    expect(socket).not.toHaveBeenCalled();
    expect(liveAction).not.toHaveBeenCalled();
  });

  it('performs no fetch, WebSocket, storage, provider, credential, or local bridge side effects', () => {
    const fetchSpy = vi.fn();
    const websocketSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', websocketSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');

    const decision = decisionFor(readyPlan('agent-host', ['127.0.0.1:8766']));

    expect(decision).toMatchObject({
      status: 'allow',
      executable: false,
      sideEffects: 'none',
      bridgeKind: 'agent-host',
      probePlan: expect.objectContaining({
        executable: false,
        sideEffects: 'none',
      }),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(websocketSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });
});
