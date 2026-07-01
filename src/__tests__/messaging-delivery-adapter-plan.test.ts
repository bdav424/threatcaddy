import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
import {
  createMessagingDeliveryAdapterPlan,
  createMessagingDeliveryAdapterPlanInput,
  type MessagingDeliveryAdapterCapabilityFacts,
  type MessagingDeliveryAdapterPlanInput,
  type MessagingDeliveryExplicitConsent,
} from '../lib/messaging-delivery-adapter-plan';
import {
  evaluateMessagingExecutionGate,
  type MessagingExecutionGateInput,
  type MessagingExecutionNoiseLimits,
} from '../lib/messaging-execution-gate';
import type { MessagingRuntimeReadinessInput } from '../lib/messaging-runtime-readiness';
import {
  createRuntimeTrustedContractObject,
  isRuntimeTrustedContractObject,
  type RuntimeTrustedContractEntry,
  type RuntimeTrustedContractValue,
} from '../lib/runtime-trusted-contract-object';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const NOW = 1_800_000_000_000;

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
  if (isRuntimeTrustedContractObject(value)) return value;
  if (typeof value === 'object') {
    return createRuntimeTrustedContractObject(Object.entries(value as Record<string, unknown>).map(([key, nested]) => (
      [key, trustedFixtureValue(nested)] satisfies RuntimeTrustedContractEntry
    )));
  }
  throw new TypeError('Unsupported trusted fixture value.');
}

function trustedFixtureObject<T>(value: Record<string, unknown>): T {
  return trustedFixtureValue(value) as unknown as T;
}

function makeCredentialReference(
  overrides: Partial<ConnectorCredentialReference> = {},
): ConnectorCredentialReference {
  return trustedFixtureObject<ConnectorCredentialReference>({
    schemaVersion: 1,
    kind: 'external-secret-store',
    id: 'vault:messaging/slack/case-alerts',
    storageOwner: 'external-secret-store',
    providerId: 'slack',
    connectorId: 'messaging',
    accountId: 'workspace-1',
    displayName: 'Slack case alert credential reference',
    createdAt: 1_700_000_000_000,
    ...overrides,
  });
}

function makeRuntimeInput(
  overrides: Partial<MessagingRuntimeReadinessInput> = {},
): MessagingRuntimeReadinessInput {
  return trustedFixtureObject<MessagingRuntimeReadinessInput>({
    connectorAvailable: true,
    connectorKind: 'slack',
    credentialReference: makeCredentialReference(),
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
  });
}

function makeNoiseLimits(overrides: Partial<MessagingExecutionNoiseLimits> = {}): MessagingExecutionNoiseLimits {
  return trustedFixtureObject<MessagingExecutionNoiseLimits>({
    maxActionsPerHour: 1,
    maxRecipientsPerAction: 1,
    suppressDuplicateThreadReplies: true,
    requireExplicitCaseMentionForChannels: true,
    ...overrides,
  });
}

function makeGateInput(overrides: Partial<MessagingExecutionGateInput> = {}): MessagingExecutionGateInput {
  return trustedFixtureObject<MessagingExecutionGateInput>({
    action: 'dry-run-notification',
    explicitActionConsent: true,
    runtime: makeRuntimeInput(),
    noiseLimits: makeNoiseLimits(),
    ...overrides,
  });
}

function makeAdapterCapabilities(
  overrides: Partial<MessagingDeliveryAdapterCapabilityFacts> = {},
): MessagingDeliveryAdapterCapabilityFacts {
  return trustedFixtureObject<MessagingDeliveryAdapterCapabilityFacts>({
    contract: 'messaging-delivery-adapter-capabilities-v1',
    adapterId: 'slack-delivery-adapter',
    runtimeOwner: 'assistantcaddy-messaging-runtime',
    connectorKind: 'slack',
    supportedActions: ['dry-run-notification'],
    supportedEventScopes: ['direct-mention', 'channel-follow-up'],
    target: {
      kind: 'slack-channel',
      targetId: 'C01CASEALERTS',
      displayName: 'Sensitive target display',
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
  });
}

function makeConsent(
  overrides: Partial<MessagingDeliveryExplicitConsent> = {},
): MessagingDeliveryExplicitConsent {
  return trustedFixtureObject<MessagingDeliveryExplicitConsent>({
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
  });
}

function makePlanInput(overrides: Partial<MessagingDeliveryAdapterPlanInput> = {}): MessagingDeliveryAdapterPlanInput {
  const input = {
    gateInput: makeGateInput(),
    adapterCapabilities: makeAdapterCapabilities(),
    explicitDeliveryConsent: makeConsent(),
    runtimeOwner: 'assistantcaddy-messaging-runtime',
    now: NOW,
    ...overrides,
  };
  return createMessagingDeliveryAdapterPlanInput(Object.entries(input).map(([key, value]) => (
    [key, trustedFixtureValue(value)] satisfies RuntimeTrustedContractEntry
  )));
}

function proxyWithAllTraps() {
  const traps: string[] = [];
  const target = { marker: 'poisoned' };
  const proxy = new Proxy(target, {
    get(value, property, receiver) {
      traps.push(`get:${String(property)}`);
      return Reflect.get(value, property, receiver);
    },
    ownKeys(value) {
      traps.push('ownKeys');
      return Reflect.ownKeys(value);
    },
    getOwnPropertyDescriptor(value, property) {
      traps.push(`getOwnPropertyDescriptor:${String(property)}`);
      return Reflect.getOwnPropertyDescriptor(value, property);
    },
    getPrototypeOf(value) {
      traps.push('getPrototypeOf');
      return Reflect.getPrototypeOf(value);
    },
  });
  return { proxy, traps };
}

describe('messaging delivery adapter plan contract', () => {
  it('rejects untrusted root and nested poisoned planner inputs without invoking traps or getters', () => {
    const rootProxy = proxyWithAllTraps();
    expect(createMessagingDeliveryAdapterPlan(rootProxy.proxy as unknown as MessagingDeliveryAdapterPlanInput)).toMatchObject({
      status: 'blocked',
      reason: 'gate_input_missing',
    });
    expect(rootProxy.traps).toEqual([]);

    let rootGetterCalls = 0;
    const rootAccessor = {};
    Object.defineProperty(rootAccessor, 'gateInput', {
      enumerable: true,
      get() {
        rootGetterCalls += 1;
        return makeGateInput();
      },
    });
    expect(createMessagingDeliveryAdapterPlan(rootAccessor as MessagingDeliveryAdapterPlanInput)).toMatchObject({
      status: 'blocked',
      reason: 'gate_input_missing',
    });
    expect(rootGetterCalls).toBe(0);

    const nestedProxy = proxyWithAllTraps();
    expect(() => createMessagingDeliveryAdapterPlanInput([
      ['gateInput', nestedProxy.proxy] as unknown as RuntimeTrustedContractEntry,
    ])).toThrow(TypeError);
    expect(nestedProxy.traps).toEqual([]);

    let nestedGetterCalls = 0;
    const nestedAccessor = {};
    Object.defineProperty(nestedAccessor, 'action', {
      enumerable: true,
      get() {
        nestedGetterCalls += 1;
        return 'dry-run-notification';
      },
    });
    expect(() => createMessagingDeliveryAdapterPlanInput([
      ['gateInput', nestedAccessor] as unknown as RuntimeTrustedContractEntry,
    ])).toThrow(TypeError);
    expect(nestedGetterCalls).toBe(0);
  });

  it('creates an inert dry-run delivery plan with safe metadata only', () => {
    const plan = createMessagingDeliveryAdapterPlan(makePlanInput());
    const serialized = JSON.stringify(plan);

    expect(plan).toMatchObject({
      status: 'planned',
      planned: true,
      reason: 'adapter_dry_run_plan_ready',
      action: 'dry-run-notification',
      connectorKind: 'slack',
      eventScope: 'direct-mention',
      adapterId: 'slack-delivery-adapter',
      runtimeOwner: 'assistantcaddy-messaging-runtime',
      target: {
        kind: 'slack-channel',
        redaction: 'target-id-omitted',
      },
      credentialReference: {
        id: 'vault:messaging/slack/case-alerts',
        kind: 'external-secret-store',
        storageOwner: 'external-secret-store',
        providerId: 'slack',
        connectorId: 'messaging',
        accountId: 'workspace-1',
      },
      noiseLimits: {
        maxActionsPerHour: 1,
        maxRecipientsPerAction: 1,
        suppressDuplicateThreadReplies: true,
        requireExplicitCaseMentionForChannels: true,
      },
      inert: true,
      executable: false,
      willPostMessage: false,
      willCallWebhook: false,
      willStoreCredential: false,
      sideEffectBoundary: 'pure-local-delivery-plan-no-fetch-no-webhook-no-slack-api-no-storage-no-send',
    });
    expect(isRuntimeTrustedContractObject(plan)).toBe(true);
    expect(isRuntimeTrustedContractObject(plan.target)).toBe(true);
    expect(isRuntimeTrustedContractObject(plan.credentialReference)).toBe(true);
    expect(isRuntimeTrustedContractObject(plan.noiseLimits)).toBe(true);
    expect(serialized).not.toContain('C01CASEALERTS');
    expect(serialized).not.toContain('Sensitive target display');
  });

  it('blocks live delivery actions under the existing no-auto-post execution gate', () => {
    for (const action of ['post-message', 'post-thread-reply', 'webhook-delivery'] as const) {
      const plan = createMessagingDeliveryAdapterPlan(makePlanInput({
        gateInput: makeGateInput({ action }),
        adapterCapabilities: makeAdapterCapabilities({
          supportedActions: ['dry-run-notification', action],
        }),
        explicitDeliveryConsent: makeConsent({ action }),
      }));

      expect(plan).toMatchObject({
        status: 'blocked',
        planned: false,
        reason: 'live_delivery_disabled_by_no_auto_post_contract',
        action,
        executable: false,
        willPostMessage: false,
        willCallWebhook: false,
      });
    }
  });

  it('blocks forged live allow decisions even when a caller supplies matching capability facts', () => {
    const gateInput = makeGateInput({ action: 'post-message' });
    const forgedGateDecision = {
      ...evaluateMessagingExecutionGate(gateInput),
      decision: 'allow',
      reason: 'dry_run_notification_allowed',
      action: 'post-message',
    } as never;

    const plan = createMessagingDeliveryAdapterPlan(makePlanInput({
      gateInput,
      gateDecision: forgedGateDecision,
      adapterCapabilities: makeAdapterCapabilities({
        supportedActions: ['dry-run-notification', 'post-message'],
      }),
      explicitDeliveryConsent: makeConsent({ action: 'post-message' }),
    }));

    expect(plan).toMatchObject({
      status: 'blocked',
      reason: 'gate_decision_forged_or_stale',
      action: 'post-message',
      executable: false,
    });
  });

  it('blocks forged no-auto-post controls before producing a delivery plan', () => {
    const gateInput = makeGateInput();
    const forgedGateDecision = {
      ...evaluateMessagingExecutionGate(gateInput),
      noAutoPost: false,
    } as never;

    expect(createMessagingDeliveryAdapterPlan(makePlanInput({
      gateInput,
      gateDecision: forgedGateDecision,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'gate_decision_forged_or_stale',
    });
  });

  it('blocks credential and consent mismatches without exposing target metadata', () => {
    const credentialMismatch = createMessagingDeliveryAdapterPlan(makePlanInput({
      adapterCapabilities: makeAdapterCapabilities({
        credentialReference: {
          id: 'vault:messaging/slack/other',
          kind: 'external-secret-store',
          storageOwner: 'external-secret-store',
        },
      }),
    }));

    expect(credentialMismatch).toMatchObject({
      status: 'blocked',
      reason: 'adapter_credential_reference_mismatch',
    });

    const consentMismatch = createMessagingDeliveryAdapterPlan(makePlanInput({
      explicitDeliveryConsent: makeConsent({ targetId: 'C01OTHER' }),
    }));

    expect(consentMismatch).toMatchObject({
      status: 'blocked',
      reason: 'delivery_consent_mismatch',
    });
    expect(JSON.stringify(consentMismatch)).not.toContain('C01CASEALERTS');
  });

  it('blocks token-shaped webhook and channel identifiers', () => {
    const tokenChannel = createMessagingDeliveryAdapterPlan(makePlanInput({
      adapterCapabilities: makeAdapterCapabilities({
        target: {
          kind: 'slack-channel',
          targetId: 'xoxb-do-not-keep-channel-token',
        },
      }),
      explicitDeliveryConsent: makeConsent({ targetId: 'xoxb-do-not-keep-channel-token' }),
    }));

    expect(tokenChannel).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });
    expect(JSON.stringify(tokenChannel)).not.toContain('xoxb-do-not-keep');

    const webhookUrl = createMessagingDeliveryAdapterPlan(makePlanInput({
      gateInput: makeGateInput({
        runtime: makeRuntimeInput({
          connectorKind: 'generic-webhook',
          eventScope: 'webhook-alert',
          policy: {
            connectorKind: 'generic-webhook',
            consent: { explicitUserConsent: true },
            eventClasses: { 'webhook-alert': true },
            webhook: {
              credentialRef: {
                id: 'vault:messaging:generic-webhook:case-alerts',
                kind: 'external-secret-store',
                displayName: 'Generic webhook credential reference',
              },
            },
          },
          credentialReference: undefined,
        }),
      }),
      adapterCapabilities: makeAdapterCapabilities({
        connectorKind: 'generic-webhook',
        supportedEventScopes: ['webhook-alert'],
        target: {
          kind: 'webhook-handle',
          targetId: 'https://hooks.slack.com/services/T000/B000/do-not-keep',
        },
        credentialReference: {
          id: 'vault:messaging:generic-webhook:case-alerts',
          kind: 'external-secret-store',
        },
      }),
      explicitDeliveryConsent: makeConsent({
        eventScope: 'webhook-alert',
        targetKind: 'webhook-handle',
        targetId: 'https://hooks.slack.com/services/T000/B000/do-not-keep',
        credentialReferenceId: 'vault:messaging:generic-webhook:case-alerts',
      }),
    }));

    expect(webhookUrl).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });
    expect(JSON.stringify(webhookUrl)).not.toContain('hooks.slack.com');
    expect(JSON.stringify(webhookUrl)).not.toContain('do-not-keep');
  });

  it('blocks URL-shaped adapter and target identifiers without echoing them', () => {
    const adapterIdUrl = createMessagingDeliveryAdapterPlan(makePlanInput({
      adapterCapabilities: makeAdapterCapabilities({
        adapterId: 'wss://localhost:4000/adapter',
      }),
      explicitDeliveryConsent: makeConsent({ adapterId: 'wss://localhost:4000/adapter' }),
    }));
    const serializedAdapterIdUrl = JSON.stringify(adapterIdUrl);

    expect(adapterIdUrl).toMatchObject({
      status: 'blocked',
      reason: 'adapter_contract_unreviewed',
    });
    expect(serializedAdapterIdUrl).not.toContain('wss://');
    expect(serializedAdapterIdUrl).not.toContain('localhost:4000');

    for (const targetId of [
      'wss://localhost:4000/target',
      '//localhost/target',
      'ftp://example.invalid/target',
      'localhost:4000/target',
      '127.0.0.1:4000/target',
      'example.invalid/webhook/target',
    ]) {
      const plan = createMessagingDeliveryAdapterPlan(makePlanInput({
        adapterCapabilities: makeAdapterCapabilities({
          target: {
            kind: 'slack-channel',
            targetId,
          },
        }),
        explicitDeliveryConsent: makeConsent({ targetId }),
      }));
      const serialized = JSON.stringify(plan);

      expect(plan).toMatchObject({
        status: 'blocked',
        reason: 'target_identity_unsafe',
      });
      expect(serialized).not.toContain('wss://');
      expect(serialized).not.toContain('//localhost');
      expect(serialized).not.toContain('ftp://');
      expect(serialized).not.toContain('localhost:4000');
      expect(serialized).not.toContain('127.0.0.1');
      expect(serialized).not.toContain('example.invalid');
    }
  });

  it('blocks adapter/runtime owner and connector-kind mismatches', () => {
    expect(createMessagingDeliveryAdapterPlan(makePlanInput({
      runtimeOwner: 'other-runtime-owner',
    }))).toMatchObject({
      status: 'blocked',
      reason: 'adapter_runtime_owner_mismatch',
    });

    expect(createMessagingDeliveryAdapterPlan(makePlanInput({
      runtimeOwner: undefined,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'adapter_runtime_owner_mismatch',
    });

    expect(createMessagingDeliveryAdapterPlan(makePlanInput({
      adapterCapabilities: makeAdapterCapabilities({
        connectorKind: 'generic-webhook',
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'adapter_connector_kind_mismatch',
    });
  });

  it('blocks stale capability facts and overbroad noise limit facts', () => {
    expect(createMessagingDeliveryAdapterPlan(makePlanInput({
      adapterCapabilities: makeAdapterCapabilities({
        issuedAt: NOW - 20 * 60 * 1000,
        expiresAt: NOW + 60_000,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'adapter_capability_stale',
    });

    expect(createMessagingDeliveryAdapterPlan(makePlanInput({
      gateInput: makeGateInput({
        noiseLimits: makeNoiseLimits({ maxRecipientsPerAction: 6 }),
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'gate_blocked',
      gateReason: 'noise_limit_overbroad',
    });
  });

  it('does not fetch, touch storage, call webhooks, or preserve external webhook URLs while planning', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');

    const plan = createMessagingDeliveryAdapterPlan(makePlanInput({
      adapterCapabilities: makeAdapterCapabilities({
        target: {
          kind: 'slack-channel',
          targetId: 'C01CASEALERTS',
          displayName: 'https://hooks.slack.com/services/T000/B000/do-not-keep',
        },
      }),
    }));
    const serialized = JSON.stringify(plan);

    expect(plan).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
      inert: true,
      executable: false,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(serialized).not.toContain('hooks.slack.com');
    expect(serialized).not.toContain('do-not-keep');
    expect(serialized).not.toContain('C01CASEALERTS');
  });
});
