import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
import {
  bindMessagingAdapterDryRunResult,
  createMessagingAdapterDryRunHarnessInput,
  createMessagingAdapterDryRunResult,
  type MessagingAdapterDryRunResult,
  type MessagingAdapterDryRunHarnessInput,
} from '../lib/messaging-adapter-dry-run-harness';
import {
  createMessagingDeliveryAdapterPlan,
  createMessagingDeliveryAdapterPlanInput,
  type MessagingDeliveryAdapterCapabilityFacts,
  type MessagingDeliveryAdapterPlan,
  type MessagingDeliveryAdapterPlanInput,
  type MessagingDeliveryExplicitConsent,
} from '../lib/messaging-delivery-adapter-plan';
import type { MessagingExecutionGateInput, MessagingExecutionNoiseLimits } from '../lib/messaging-execution-gate';
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

function makePlan(overrides: Partial<MessagingDeliveryAdapterPlanInput> = {}): MessagingDeliveryAdapterPlan {
  return createMessagingDeliveryAdapterPlan(makePlanInput(overrides));
}

function makeHarnessInput(input: MessagingAdapterDryRunHarnessInput): MessagingAdapterDryRunHarnessInput {
  return createMessagingAdapterDryRunHarnessInput(Object.entries(input).map(([key, value]) => (
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

function makeDryRunResult(
  overrides: Partial<MessagingAdapterDryRunResult> = {},
): MessagingAdapterDryRunResult {
  const result = {
    contract: 'messaging-adapter-dry-run-result-v1',
    adapterId: 'slack-delivery-adapter',
    runtimeOwner: 'assistantcaddy-messaging-runtime',
    action: 'dry-run-notification',
    connectorKind: 'slack',
    eventScope: 'direct-mention',
    credentialReferenceId: 'vault:messaging/slack/case-alerts',
    targetKind: 'slack-channel',
    planExpiresAt: NOW + 60_000,
    noAutoPost: true,
    executable: false,
    willPostMessage: false,
    willCallWebhook: false,
    willStoreCredential: false,
    adapterRunId: 'dry-run-preview-1',
    safeDetails: {
      rendered: true,
      previewOnly: true,
    },
    ...overrides,
  };
  const safeDetails = result.safeDetails
    ? isRuntimeTrustedContractObject(result.safeDetails)
      ? result.safeDetails
      : createRuntimeTrustedContractObject(Object.entries(result.safeDetails).map(([key, value]) => (
          [key, value as RuntimeTrustedContractValue] satisfies RuntimeTrustedContractEntry
        ))) as unknown as Record<string, unknown>
    : undefined;
  const entries: RuntimeTrustedContractEntry[] = [
    ['contract', result.contract],
    ['adapterId', result.adapterId],
    ['runtimeOwner', result.runtimeOwner],
    ['action', result.action],
    ['connectorKind', result.connectorKind],
    ['eventScope', result.eventScope],
    ['credentialReferenceId', result.credentialReferenceId],
    ['targetKind', result.targetKind],
    ['planExpiresAt', result.planExpiresAt],
    ['noAutoPost', result.noAutoPost],
    ['executable', result.executable],
    ['willPostMessage', result.willPostMessage],
    ['willCallWebhook', result.willCallWebhook],
    ['willStoreCredential', result.willStoreCredential],
  ];
  if (result.adapterRunId !== undefined) entries.push(['adapterRunId', result.adapterRunId]);
  if (result.dryRunId !== undefined) entries.push(['dryRunId', result.dryRunId]);
  if (result.messageId !== undefined) entries.push(['messageId', result.messageId]);
  if (safeDetails !== undefined) entries.push(['safeDetails', safeDetails as unknown as RuntimeTrustedContractValue]);
  for (const [key, value] of Object.entries(overrides)) {
    if (!entries.some(([entryKey]) => entryKey === key)) {
      entries.push([key, value as unknown as RuntimeTrustedContractValue]);
    }
  }
  return createMessagingAdapterDryRunResult(entries);
}

describe('messaging adapter dry-run harness contract', () => {
  it('rejects untrusted root and nested poisoned harness inputs without invoking traps or getters', () => {
    const rootProxy = proxyWithAllTraps();
    expect(bindMessagingAdapterDryRunResult(rootProxy.proxy as unknown as MessagingAdapterDryRunHarnessInput)).toMatchObject({
      status: 'blocked',
      reason: 'plan_missing',
    });
    expect(rootProxy.traps).toEqual([]);

    let rootGetterCalls = 0;
    const rootAccessor = {};
    Object.defineProperty(rootAccessor, 'plan', {
      enumerable: true,
      get() {
        rootGetterCalls += 1;
        return makePlan();
      },
    });
    expect(bindMessagingAdapterDryRunResult(rootAccessor as MessagingAdapterDryRunHarnessInput)).toMatchObject({
      status: 'blocked',
      reason: 'plan_missing',
    });
    expect(rootGetterCalls).toBe(0);

    const nestedProxy = proxyWithAllTraps();
    expect(() => createMessagingAdapterDryRunHarnessInput([
      ['plan', nestedProxy.proxy] as unknown as RuntimeTrustedContractEntry,
    ])).toThrow(TypeError);
    expect(nestedProxy.traps).toEqual([]);

    let nestedGetterCalls = 0;
    const nestedAccessor = {};
    Object.defineProperty(nestedAccessor, 'status', {
      enumerable: true,
      get() {
        nestedGetterCalls += 1;
        return 'planned';
      },
    });
    expect(() => createMessagingAdapterDryRunHarnessInput([
      ['plan', nestedAccessor] as unknown as RuntimeTrustedContractEntry,
    ])).toThrow(TypeError);
    expect(nestedGetterCalls).toBe(0);
  });

  it('accepts a caller-provided dry-run result only when plan ownership matches exactly', () => {
    const metadata = bindMessagingAdapterDryRunResult(makeHarnessInput({
      plan: makePlan(),
      dryRunResult: makeDryRunResult(),
    }));
    const serialized = JSON.stringify(metadata);

    expect(metadata).toMatchObject({
      status: 'accepted',
      accepted: true,
      reason: 'dry_run_result_accepted',
      adapterId: 'slack-delivery-adapter',
      runtimeOwner: 'assistantcaddy-messaging-runtime',
      action: 'dry-run-notification',
      connectorKind: 'slack',
      eventScope: 'direct-mention',
      credentialReference: {
        id: 'vault:messaging/slack/case-alerts',
        kind: 'external-secret-store',
        storageOwner: 'external-secret-store',
        providerId: 'slack',
        connectorId: 'messaging',
        accountId: 'workspace-1',
      },
      target: {
        kind: 'slack-channel',
        redaction: 'target-id-omitted',
      },
      planExpiresAt: NOW + 60_000,
      executable: false,
      willPostMessage: false,
      willCallWebhook: false,
      willStoreCredential: false,
      sideEffectBoundary: 'pure-local-dry-run-harness-no-fetch-no-webhook-no-slack-sdk-no-storage-no-send',
    });
    expect(Object.isFrozen(metadata)).toBe(true);
    expect(isRuntimeTrustedContractObject(metadata)).toBe(true);
    expect(isRuntimeTrustedContractObject(metadata.credentialReference)).toBe(true);
    expect(isRuntimeTrustedContractObject(metadata.target)).toBe(true);
    expect(serialized).not.toContain('C01CASEALERTS');
    expect(serialized).not.toContain('dry-run-preview-1');
  });

  it('rejects trusted dry-run results carrying unsafe transport or live-action fields', () => {
    for (const unsafeField of [
      { fetchPlan: 'metadata-only-fetch-plan' },
      { requester: 'injected-requester' },
      { socketPlan: 'metadata-only-socket-plan' },
      { storageAdapter: 'metadata-only-storage-adapter' },
      { liveAction: 'dry-run-only-live-action' },
    ] as Record<string, unknown>[]) {
      const metadata = bindMessagingAdapterDryRunResult(makeHarnessInput({
        plan: makePlan(),
        dryRunResult: makeDryRunResult(unsafeField as Partial<MessagingAdapterDryRunResult>),
      }));

      expect(metadata).toMatchObject({
        status: 'blocked',
        accepted: false,
        reason: 'result_contract_unreviewed',
        executable: false,
        willPostMessage: false,
        willCallWebhook: false,
        willStoreCredential: false,
      });
    }
  });

  it('rejects blocked or non-inert plans before accepting adapter-owned dry-run results', () => {
    const blockedPlan = makePlan({
      gateInput: makeGateInput({ explicitActionConsent: false }),
    });

    expect(bindMessagingAdapterDryRunResult(makeHarnessInput({
      plan: blockedPlan,
      dryRunResult: makeDryRunResult(),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'plan_not_planned',
      executable: false,
      willPostMessage: false,
      willCallWebhook: false,
      willStoreCredential: false,
    });

    expect(bindMessagingAdapterDryRunResult(makeHarnessInput({
      plan: { ...makePlan(), willPostMessage: true } as never,
      dryRunResult: makeDryRunResult(),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'plan_not_inert',
    });
  });

  it('projects target metadata explicitly even when a typed plan carries forged target fields', () => {
    const plan = makePlan();
    const forgedPlan = {
      ...plan,
      target: {
        ...plan.target,
        targetId: 'C01CASEALERTS',
        displayName: 'https://hooks.slack.com/services/T000/B000/do-not-keep',
        webhookUrl: 'https://hooks.slack.com/services/T000/B000/do-not-keep',
        botToken: 'xoxb-do-not-keep-target-token',
      },
    } as never;

    const metadata = bindMessagingAdapterDryRunResult(makeHarnessInput({
      plan: forgedPlan,
      dryRunResult: makeDryRunResult(),
    }));
    const serialized = JSON.stringify(metadata);

    expect(metadata).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
      executable: false,
      willPostMessage: false,
      willCallWebhook: false,
      willStoreCredential: false,
    });
    expect(Object.isFrozen(metadata)).toBe(true);
    expect(serialized).not.toContain('C01CASEALERTS');
    expect(serialized).not.toContain('displayName');
    expect(serialized).not.toContain('webhookUrl');
    expect(serialized).not.toContain('botToken');
    expect(serialized).not.toContain('hooks.slack.com');
    expect(serialized).not.toContain('xoxb');
    expect(serialized).not.toContain('do-not-keep');
  });

  it('blocks result ownership mismatches across owner, action, scope, credential, target, and expiry facts', () => {
    for (const mismatch of [
      { runtimeOwner: 'other-runtime-owner' },
      { action: 'disable-connector' },
      { connectorKind: 'generic-webhook' },
      { eventScope: 'webhook-alert' },
      { credentialReferenceId: 'vault:messaging/slack/other' },
      { targetKind: 'slack-dm' },
      { planExpiresAt: NOW + 120_000 },
    ] satisfies Partial<MessagingAdapterDryRunResult>[]) {
      expect(bindMessagingAdapterDryRunResult(makeHarnessInput({
        plan: makePlan(),
        dryRunResult: makeDryRunResult(mismatch),
      }))).toMatchObject({
        status: 'blocked',
        reason: 'result_owner_mismatch',
      });
    }
  });

  it('blocks forged live delivery flags without treating adapter success claims as evidence', () => {
    for (const forgedResult of [
      { executable: true },
      { willPostMessage: true },
      { willCallWebhook: true },
      { willStoreCredential: true },
      { delivered: true },
      { sent: true },
      { posted: true },
      { calledWebhook: true },
    ] as Record<string, unknown>[]) {
      expect(bindMessagingAdapterDryRunResult(makeHarnessInput({
        plan: makePlan(),
        dryRunResult: makeDryRunResult(forgedResult as Partial<MessagingAdapterDryRunResult>),
      }))).toMatchObject({
        status: 'blocked',
        reason: 'result_live_delivery_forged',
        executable: false,
        willPostMessage: false,
        willCallWebhook: false,
        willStoreCredential: false,
      });
    }
  });

  it('blocks token-shaped adapter run and message identifiers without echoing them', () => {
    for (const tokenField of [
      { adapterRunId: 'xoxb-do-not-keep-run-id' },
      { dryRunId: 'Bearer do-not-keep-dry-run-token' },
      { messageId: 'https://hooks.slack.com/services/T000/B000/do-not-keep-message' },
    ] satisfies Partial<MessagingAdapterDryRunResult>[]) {
      const metadata = bindMessagingAdapterDryRunResult(makeHarnessInput({
        plan: makePlan(),
        dryRunResult: makeDryRunResult(tokenField),
      }));
      const serialized = JSON.stringify(metadata);

      expect(metadata).toMatchObject({
        status: 'blocked',
        reason: 'result_identifier_unsafe',
      });
      expect(serialized).not.toContain('xoxb');
      expect(serialized).not.toContain('Bearer');
      expect(serialized).not.toContain('hooks.slack.com');
      expect(serialized).not.toContain('do-not-keep');
    }
  });

  it('blocks URL-shaped plan and result provenance identifiers without echoing them', () => {
    for (const unsafeResultField of [
      { adapterId: 'wss://localhost:4000/adapter' },
      { runtimeOwner: '//localhost/runtime-owner' },
      { adapterRunId: 'ftp://example.invalid/run' },
      { dryRunId: 'localhost:4000/dry-run' },
      { messageId: '127.0.0.1:4000/message' },
      { messageId: 'example.invalid/webhook/message' },
    ] satisfies Partial<MessagingAdapterDryRunResult>[]) {
      const metadata = bindMessagingAdapterDryRunResult(makeHarnessInput({
        plan: makePlan(),
        dryRunResult: makeDryRunResult(unsafeResultField),
      }));
      const serialized = JSON.stringify(metadata);

      expect(metadata).toMatchObject({
        status: 'blocked',
        reason: 'result_identifier_unsafe',
      });
      expect(serialized).not.toContain('wss://');
      expect(serialized).not.toContain('//localhost');
      expect(serialized).not.toContain('ftp://');
      expect(serialized).not.toContain('localhost:4000');
      expect(serialized).not.toContain('127.0.0.1');
      expect(serialized).not.toContain('example.invalid');
    }

    const forgedPlan = {
      ...makePlan(),
      adapterId: 'wss://localhost:4000/adapter',
    } as MessagingDeliveryAdapterPlan;
    const forgedPlanMetadata = bindMessagingAdapterDryRunResult(makeHarnessInput({
      plan: forgedPlan,
      dryRunResult: makeDryRunResult({ adapterId: 'wss://localhost:4000/adapter' }),
    }));
    const serializedForgedPlan = JSON.stringify(forgedPlanMetadata);

    expect(forgedPlanMetadata).toMatchObject({
      status: 'blocked',
      reason: 'result_identifier_unsafe',
    });
    expect(serializedForgedPlan).not.toContain('wss://');
    expect(serializedForgedPlan).not.toContain('localhost:4000');
  });

  it('does not echo forged target fields from caller-provided plan metadata', () => {
    const metadata = bindMessagingAdapterDryRunResult(makeHarnessInput({
      plan: {
        ...makePlan(),
        target: {
          kind: 'slack-channel',
          redaction: 'target-id-omitted',
          targetId: 'C01DO-NOT-ECHO',
          displayName: 'https://hooks.slack.com/services/T000/B000/do-not-echo',
        },
      } as unknown as MessagingDeliveryAdapterPlan,
      dryRunResult: makeDryRunResult(),
    }));
    const serialized = JSON.stringify(metadata);

    expect(metadata).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });
    expect(serialized).not.toContain('C01DO-NOT-ECHO');
    expect(serialized).not.toContain('hooks.slack.com');
    expect(serialized).not.toContain('do-not-echo');
  });

  it('prevents webhook URL echoes and raw secret material from adapter result details', () => {
    const metadata = bindMessagingAdapterDryRunResult(makeHarnessInput({
      plan: makePlan(),
      dryRunResult: makeDryRunResult({
        safeDetails: {
          previewWebhookUrl: 'https://hooks.slack.com/services/T000/B000/do-not-keep',
        },
      }),
    }));
    const serialized = JSON.stringify(metadata);

    expect(metadata).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
      executable: false,
      willPostMessage: false,
      willCallWebhook: false,
      willStoreCredential: false,
    });
    expect(serialized).not.toContain('hooks.slack.com');
    expect(serialized).not.toContain('do-not-keep');
  });

  it('does not call fetch, socket APIs, webhooks, or storage while binding a dry-run result', () => {
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

    const metadata = bindMessagingAdapterDryRunResult(makeHarnessInput({
      plan: makePlan(),
      dryRunResult: makeDryRunResult(),
    }));

    expect(metadata).toMatchObject({
      status: 'accepted',
      executable: false,
      willPostMessage: false,
      willCallWebhook: false,
      willStoreCredential: false,
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
