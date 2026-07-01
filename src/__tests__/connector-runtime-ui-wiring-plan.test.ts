import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
import {
  selectConnectorRuntimeAdapterCapability,
  type ConnectorRuntimeAdapterCapabilityFact,
} from '../lib/connector-runtime-adapter-registry';
import {
  evaluateConnectorRuntimePersistenceGuard,
  type ConnectorRuntimePersistenceGuardInput,
  type ConnectorRuntimeNoPersistenceBoundary,
} from '../lib/connector-runtime-persistence-guard';
import {
  createConnectorRuntimeUiWiringPlan,
  type ConnectorRuntimeUiWiringPlanInput,
} from '../lib/connector-runtime-ui-wiring-plan';
import { createLocalBridgeDiscoveryPlan } from '../lib/local-bridge-discovery';
import { evaluateLocalBridgeProbeExecutionGate } from '../lib/local-bridge-probe-execution-gate';
import {
  createMessagingDeliveryAdapterPlan,
  createMessagingDeliveryAdapterPlanInput,
  type MessagingDeliveryAdapterCapabilityFacts,
  type MessagingDeliveryAdapterPlanInput,
  type MessagingDeliveryExplicitConsent,
} from '../lib/messaging-delivery-adapter-plan';
import type { MessagingExecutionGateInput, MessagingExecutionNoiseLimits } from '../lib/messaging-execution-gate';
import type { MessagingRuntimeReadinessInput } from '../lib/messaging-runtime-readiness';
import {
  createProviderAuthSessionAdapterPlan,
  type ProviderAuthSessionAdapterCapabilities,
  type ProviderAuthSessionAdapterExplicitConsent,
} from '../lib/provider-auth-session-adapter-plan';
import {
  createRuntimeTrustedContractObject,
  type RuntimeTrustedContractEntry,
  type RuntimeTrustedContractValue,
} from '../lib/runtime-trusted-contract-object';

const NOW = 1_800_000_000_000;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function trustedFixtureValue(value: unknown): RuntimeTrustedContractValue {
  if (
    value === null
    || value === undefined
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) return Object.freeze(value.map((item) => trustedFixtureValue(item)));
  if (typeof value === 'object') {
    return createRuntimeTrustedContractObject(Object.entries(value as Record<string, unknown>).map(([key, nested]) => (
      [key, trustedFixtureValue(nested)] satisfies RuntimeTrustedContractEntry
    )));
  }
  throw new TypeError('Unsupported trusted fixture value.');
}

function providerAuthPlanInput(value: Record<string, unknown>): Parameters<typeof createProviderAuthSessionAdapterPlan>[0] {
  return trustedFixtureValue(value) as unknown as Parameters<typeof createProviderAuthSessionAdapterPlan>[0];
}

function providerAdapterCapability(
  overrides: Partial<ConnectorRuntimeAdapterCapabilityFact> = {},
): ConnectorRuntimeAdapterCapabilityFact {
  return {
    schemaVersion: 1,
    factKind: 'connector-runtime-adapter-capability',
    adapterId: 'email-runtime-adapter',
    adapterVersion: '1.0.0',
    surface: 'email',
    providerId: 'generic-mail',
    actionId: 'mail.sync',
    sideEffectClass: 'provider-read',
    requiresCredentialHandle: true,
    requiresExplicitConsent: true,
    allowsLiveDelivery: false,
    reviewState: 'reviewed',
    reviewedAt: NOW - 10_000,
    expiresAt: NOW + 60_000,
    ...overrides,
  };
}

function authCapabilities(
  overrides: Partial<ProviderAuthSessionAdapterCapabilities> = {},
): ProviderAuthSessionAdapterCapabilities {
  return {
    schemaVersion: 1,
    providerId: 'generic-mail',
    surface: 'emailcaddy',
    supportsStartOAuth: true,
    supportsCompleteOAuth: true,
    supportsRefreshSession: true,
    supportsRevokeSession: true,
    supportsProviderAuthTest: true,
    executable: false,
    sideEffects: 'none',
    opensWindow: false,
    browserRedirects: false,
    ...overrides,
  };
}

function authConsent(
  overrides: Partial<ProviderAuthSessionAdapterExplicitConsent> = {},
): ProviderAuthSessionAdapterExplicitConsent {
  return {
    schemaVersion: 1,
    action: 'test_provider_auth',
    surface: 'emailcaddy',
    providerId: 'generic-mail',
    accountId: 'analyst@example.test',
    sessionHandleReferenceId: 'generic-mail-session-reference',
    granted: true,
    reviewed: true,
    issuedAt: NOW - 1_000,
    expiresAt: NOW + 60_000,
    ...overrides,
  };
}

function credentialReference(
  overrides: Partial<ConnectorCredentialReference> = {},
): ConnectorCredentialReference {
  return {
    schemaVersion: 1,
    kind: 'external-secret-store',
    id: 'vault:messaging/slack/case-alerts',
    storageOwner: 'external-secret-store',
    providerId: 'slack',
    connectorId: 'messaging',
    accountId: 'workspace-1',
    displayName: 'Slack case alert credential reference',
    createdAt: NOW - 100_000,
    ...overrides,
  };
}

function messagingRuntime(
  overrides: Partial<MessagingRuntimeReadinessInput> = {},
): MessagingRuntimeReadinessInput {
  return {
    connectorAvailable: true,
    connectorKind: 'slack',
    credentialReference: credentialReference(),
    eventScope: 'direct-mention',
    explicitUserTestRequested: true,
    policy: {
      connectorKind: 'slack',
      consent: {
        explicitUserConsent: true,
      },
      eventClasses: {
        'direct-mention': true,
        'one-to-one-dm': true,
        'group-dm': true,
        'thread-reply-after-user-post': true,
        'channel-follow-up': true,
        'webhook-alert': true,
      },
      slackNotificationPolicy: {
        directMentions: true,
        oneToOneDms: true,
        groupDms: true,
        threadRepliesAfterUserPosts: true,
        channelFollowUps: true,
        noiseControls: {
          quietHoursEnabled: true,
          batchChannelFollowUps: true,
          maxChannelFollowUpsPerHour: 3,
          suppressDuplicateThreadReplies: true,
          requireExplicitCaseMentionForChannels: true,
        },
      },
    },
    ...overrides,
  };
}

function messagingNoiseLimits(overrides: Partial<MessagingExecutionNoiseLimits> = {}): MessagingExecutionNoiseLimits {
  return {
    maxActionsPerHour: 1,
    maxRecipientsPerAction: 1,
    suppressDuplicateThreadReplies: true,
    requireExplicitCaseMentionForChannels: true,
    ...overrides,
  };
}

function messagingGateInput(overrides: Partial<MessagingExecutionGateInput> = {}): MessagingExecutionGateInput {
  return {
    action: 'dry-run-notification',
    explicitActionConsent: true,
    runtime: messagingRuntime(),
    noiseLimits: messagingNoiseLimits(),
    ...overrides,
  };
}

function messagingCapabilities(
  overrides: Partial<MessagingDeliveryAdapterCapabilityFacts> = {},
): MessagingDeliveryAdapterCapabilityFacts {
  return {
    contract: 'messaging-delivery-adapter-capabilities-v1',
    adapterId: 'slack-delivery-adapter',
    runtimeOwner: 'assistantcaddy-messaging-runtime',
    connectorKind: 'slack',
    supportedActions: ['dry-run-notification'],
    supportedEventScopes: ['direct-mention'],
    target: {
      kind: 'slack-channel',
      targetId: 'C01CASEALERTS',
      displayName: 'Case alerts',
    },
    credentialReference: {
      id: 'vault:messaging/slack/case-alerts',
      kind: 'external-secret-store',
      storageOwner: 'external-secret-store',
      providerId: 'slack',
      connectorId: 'messaging',
      accountId: 'workspace-1',
    },
    noAutoPost: true,
    liveDeliveryEnabled: false,
    issuedAt: NOW - 60_000,
    expiresAt: NOW + 60_000,
    ...overrides,
  };
}

function messagingConsent(overrides: Partial<MessagingDeliveryExplicitConsent> = {}): MessagingDeliveryExplicitConsent {
  return {
    granted: true,
    action: 'dry-run-notification',
    adapterId: 'slack-delivery-adapter',
    runtimeOwner: 'assistantcaddy-messaging-runtime',
    eventScope: 'direct-mention',
    targetKind: 'slack-channel',
    targetId: 'C01CASEALERTS',
    credentialReferenceId: 'vault:messaging/slack/case-alerts',
    acknowledgedSideEffects: 'dry-run-only',
    ...overrides,
  };
}

function messagingPlanInput(overrides: Partial<MessagingDeliveryAdapterPlanInput> = {}): MessagingDeliveryAdapterPlanInput {
  const input = {
    gateInput: messagingGateInput(),
    adapterCapabilities: messagingCapabilities(),
    explicitDeliveryConsent: messagingConsent(),
    runtimeOwner: 'assistantcaddy-messaging-runtime',
    now: NOW,
    ...overrides,
  };

  return createMessagingDeliveryAdapterPlanInput(Object.entries(input).map(([key, value]) => (
    [key, trustedFixtureValue(value)] satisfies RuntimeTrustedContractEntry
  )));
}

function noPersistenceBoundary(
  overrides: Partial<ConnectorRuntimeNoPersistenceBoundary> = {},
): ConnectorRuntimeNoPersistenceBoundary {
  return {
    mode: 'session-only',
    durableStorage: false,
    browserStorage: false,
    rawSecrets: false,
    network: false,
    providerCalls: false,
    schemaChange: false,
    backupRestore: false,
    importExport: false,
    syncState: false,
    ...overrides,
  };
}

function evaluateTrustedPersistenceGuard(
  input: ConnectorRuntimePersistenceGuardInput,
): ReturnType<typeof evaluateConnectorRuntimePersistenceGuard> {
  return evaluateConnectorRuntimePersistenceGuard(
    trustedFixtureValue(input) as unknown as ConnectorRuntimePersistenceGuardInput,
  );
}

function safeInput(overrides: Partial<ConnectorRuntimeUiWiringPlanInput> = {}): ConnectorRuntimeUiWiringPlanInput {
  const discoveryPlan = createLocalBridgeDiscoveryPlan({
    bridgeKind: 'llm',
    candidates: ['127.0.0.1:11434/v1'],
    consentGranted: true,
    defaultProbePath: '/health',
  });

  return {
    providerAdapterDecision: selectConnectorRuntimeAdapterCapability({
      capabilities: [providerAdapterCapability()],
      surface: 'email',
      providerId: 'generic-mail',
      actionId: 'mail.sync',
      now: NOW,
    }),
    providerAuthSessionPlan: createProviderAuthSessionAdapterPlan(providerAuthPlanInput({
      action: 'test_provider_auth',
      surface: 'emailcaddy',
      providerId: 'generic-mail',
      accountId: 'analyst@example.test',
      adapterCapabilities: authCapabilities(),
      explicitConsent: authConsent(),
      sessionHandleReference: {
        schemaVersion: 1,
        id: 'generic-mail-session-reference',
        providerId: 'generic-mail',
        surface: 'emailcaddy',
        accountId: 'analyst@example.test',
        createdAt: NOW - 2_000,
      },
      now: NOW,
    })),
    messagingAdapterPlan: createMessagingDeliveryAdapterPlan(messagingPlanInput()),
    localBridgeProbeDecision: evaluateLocalBridgeProbeExecutionGate({
      expectedBridgeKind: 'llm',
      discoveryPlan,
      explicitUserAction: {
        action: 'probe_local_bridge',
        bridgeKind: 'llm',
        granted: true,
        acknowledgedPlanOnly: true,
      },
    }),
    persistenceGuardDecision: evaluateTrustedPersistenceGuard({
      requestKind: 'no-persistence-session-only',
      providerId: 'generic-mail',
      connectorId: 'generic-mail-runtime',
      targetSurface: 'emailcaddy',
      stateLabel: 'session-runtime-state',
      proposedFields: ['selectedProviderId', 'setupStep'],
      migrationLabels: [],
      exportKeys: [],
      noPersistenceBoundary: noPersistenceBoundary(),
    }),
    ...overrides,
  };
}

function rowStatuses(input: ConnectorRuntimeUiWiringPlanInput = {}) {
  return createConnectorRuntimeUiWiringPlan(input).rows.map((row) => [row.id, row.status, row.reason]);
}

describe('connector runtime UI wiring plan', () => {
  it('maps safe planning decisions into frozen UI-ready rows without live-action claims', () => {
    const plan = createConnectorRuntimeUiWiringPlan(safeInput());

    expect(plan).toMatchObject({
      schemaVersion: 1,
      contract: 'connector-runtime-ui-wiring-plan-v1',
      executable: false,
      sideEffects: 'none',
      sideEffectBoundary: 'pure-local-ui-presentation-model-no-fetch-no-storage-no-provider-no-credentials-no-runtime-actions',
    });
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.rows)).toBe(true);
    expect(plan.rows.every((row) => Object.isFrozen(row))).toBe(true);
    expect(plan.rows.map((row) => row.id)).toEqual([
      'provider-adapter-selection',
      'provider-auth-session-plan',
      'messaging-delivery-dry-run',
      'local-bridge-manual-probe',
      'connector-runtime-persistence',
    ]);
    expect(plan.rows.every((row) => row.executable === false && row.sideEffects === 'none')).toBe(true);
    expect(plan.rows.map((row) => row.kind)).toEqual([
      'catalog-support',
      'configuration',
      'runtime-readiness',
      'runtime-readiness',
      'persistence',
    ]);
    expect(plan.rows.map((row) => row.status)).toEqual(['ready', 'ready', 'ready', 'ready', 'ready']);
    expect(JSON.stringify(plan)).not.toContain('C01CASEALERTS');
  });

  it('fails closed for missing or blocked input decisions', () => {
    expect(rowStatuses()).toEqual([
      ['provider-adapter-selection', 'blocked', 'Provider adapter selection decision is missing.'],
      ['provider-auth-session-plan', 'blocked', 'Provider auth/session adapter plan is missing.'],
      ['messaging-delivery-dry-run', 'blocked', 'Messaging delivery adapter plan is missing.'],
      ['local-bridge-manual-probe', 'blocked', 'Local bridge probe execution decision is missing.'],
      ['connector-runtime-persistence', 'blocked', 'Connector runtime persistence guard decision is missing.'],
    ]);

    const plan = createConnectorRuntimeUiWiringPlan(safeInput({
      messagingAdapterPlan: createMessagingDeliveryAdapterPlan(messagingPlanInput({
        gateInput: messagingGateInput({ action: 'post-message' }),
        adapterCapabilities: messagingCapabilities({ supportedActions: ['dry-run-notification', 'post-message'] }),
        explicitDeliveryConsent: messagingConsent({ action: 'post-message' }),
        runtimeOwner: 'assistantcaddy-messaging-runtime',
        now: NOW,
      })),
    }));

    expect(plan.rows.find((row) => row.id === 'messaging-delivery-dry-run')).toMatchObject({
      status: 'blocked',
      reason: 'live_delivery_disabled_by_no_auto_post_contract',
      executable: false,
      sideEffects: 'none',
    });
  });

  it('blocks owner-surface mismatches instead of presenting readiness on the wrong UI surface', () => {
    const plan = createConnectorRuntimeUiWiringPlan(safeInput({
      expectedOwnerSurface: 'assistantcaddy',
    }));

    expect(plan.rows.find((row) => row.id === 'provider-adapter-selection')).toMatchObject({
      ownerSurface: 'emailcaddy',
      status: 'blocked',
      reason: 'Provider adapter owner surface does not match the requested UI surface.',
    });
    expect(plan.rows.find((row) => row.id === 'messaging-delivery-dry-run')).toMatchObject({
      ownerSurface: 'messaging',
      status: 'blocked',
    });
  });

  it('redacts token-shaped identifiers and raw secret material without echoing them', () => {
    const tokenLike = 'sk-synthetic-placeholder';
    const plan = createConnectorRuntimeUiWiringPlan({
      providerAuthSessionPlan: createProviderAuthSessionAdapterPlan(providerAuthPlanInput({
        action: 'test_provider_auth',
        surface: 'emailcaddy',
        providerId: tokenLike,
        adapterCapabilities: authCapabilities(),
        explicitConsent: authConsent(),
        now: NOW,
      })),
      messagingAdapterPlan: {
        ...createMessagingDeliveryAdapterPlan(),
        connectorKind: tokenLike as ReturnType<typeof createMessagingDeliveryAdapterPlan>['connectorKind'],
      },
    });

    expect(plan.rows.every((row) => row.status === 'blocked')).toBe(true);
    expect(JSON.stringify(plan)).not.toContain(tokenLike);
    expect(JSON.stringify(plan)).not.toContain('Bearer');
  });

  it('blocks unsafe live/callable metadata across otherwise valid planning objects without echoing it', () => {
    const unsafeCases: Array<{
      label: string;
      input: ConnectorRuntimeUiWiringPlanInput;
      rowId: string;
      unsafeMarker: string;
    }> = [
      {
        label: 'provider callback',
        input: safeInput({
          providerAdapterDecision: {
            ...safeInput().providerAdapterDecision!,
            descriptor: {
              ...safeInput().providerAdapterDecision!.descriptor!,
              callback: 'do-not-render-provider-callback',
            } as never,
          },
        }),
        rowId: 'provider-adapter-selection',
        unsafeMarker: 'do-not-render-provider-callback',
      },
      {
        label: 'auth requester',
        input: safeInput({
          providerAuthSessionPlan: {
            ...safeInput().providerAuthSessionPlan!,
            requester: { id: 'do-not-render-auth-requester' },
          } as never,
        }),
        rowId: 'provider-auth-session-plan',
        unsafeMarker: 'do-not-render-auth-requester',
      },
      {
        label: 'messaging fetch',
        input: safeInput({
          messagingAdapterPlan: {
            ...safeInput().messagingAdapterPlan!,
            nested: { fetch: 'do-not-render-messaging-fetch' },
          } as never,
        }),
        rowId: 'messaging-delivery-dry-run',
        unsafeMarker: 'do-not-render-messaging-fetch',
      },
      {
        label: 'local socket',
        input: safeInput({
          localBridgeProbeDecision: {
            ...safeInput().localBridgeProbeDecision!,
            socketPlan: { host: 'do-not-render-local-socket' },
          } as never,
        }),
        rowId: 'local-bridge-manual-probe',
        unsafeMarker: 'do-not-render-local-socket',
      },
      {
        label: 'persistence storage',
        input: safeInput({
          persistenceGuardDecision: {
            ...safeInput().persistenceGuardDecision!,
            metadata: {
              ...safeInput().persistenceGuardDecision!.metadata,
              storageAdapter: 'do-not-render-persistence-storage',
            },
          } as never,
        }),
        rowId: 'connector-runtime-persistence',
        unsafeMarker: 'do-not-render-persistence-storage',
      },
      {
        label: 'top-level live action',
        input: {
          ...safeInput(),
          liveAction: 'do-not-render-top-level-live-action',
        } as never,
        rowId: 'provider-adapter-selection',
        unsafeMarker: 'do-not-render-top-level-live-action',
      },
    ];

    for (const { input, label, rowId, unsafeMarker } of unsafeCases) {
      const plan = createConnectorRuntimeUiWiringPlan(input);
      const row = plan.rows.find((candidate) => candidate.id === rowId);

      expect(row, label).toMatchObject({
        status: 'blocked',
        reason: expect.stringContaining('live runtime metadata'),
        executable: false,
        sideEffects: 'none',
      });
      expect(plan.rows.every((candidate) => candidate.status === 'blocked')).toBe(true);
      expect(JSON.stringify(plan)).not.toContain(unsafeMarker);
      expect(JSON.stringify(plan)).not.toContain('token=');
    }
  });

  it('keeps durable persistence disabled as a separate persistence row', () => {
    const plan = createConnectorRuntimeUiWiringPlan(safeInput({
      persistenceGuardDecision: evaluateTrustedPersistenceGuard({
        requestKind: 'persist-runtime-state',
        providerId: 'generic-mail',
        connectorId: 'generic-mail-runtime',
        targetSurface: 'emailcaddy',
        proposedFields: ['id', 'providerId'],
      }),
    }));

    expect(plan.rows.find((row) => row.id === 'connector-runtime-persistence')).toMatchObject({
      kind: 'persistence',
      ownerSurface: 'emailcaddy',
      status: 'blocked',
      reason: expect.stringContaining('durable_persistence_disabled'),
      executable: false,
      sideEffects: 'none',
    });
    expect(plan.rows.find((row) => row.id === 'provider-adapter-selection')).toMatchObject({
      kind: 'catalog-support',
      status: 'ready',
    });
  });

  it('does not use network, sockets, storage, or provider runtime behavior while building rows', () => {
    const fetchSpy = vi.fn();
    const websocketSpy = vi.fn();
    const indexedDbSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', websocketSpy);
    vi.stubGlobal('indexedDB', indexedDbSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');

    const plan = createConnectorRuntimeUiWiringPlan(safeInput());

    expect(plan.rows.length).toBe(5);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(websocketSpy).not.toHaveBeenCalled();
    expect(indexedDbSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });
});
