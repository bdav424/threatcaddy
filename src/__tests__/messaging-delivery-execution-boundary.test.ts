import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
import {
  bindMessagingAdapterDryRunResult,
  createMessagingAdapterDryRunHarnessInput,
  createMessagingAdapterDryRunResult,
  type MessagingAdapterDryRunResult,
  type MessagingAdapterDryRunHarnessMetadata,
} from '../lib/messaging-adapter-dry-run-harness';
import {
  createMessagingDeliveryAdapterPlan,
  createMessagingDeliveryAdapterPlanInput,
  type MessagingDeliveryAdapterCapabilityFacts,
  type MessagingDeliveryAdapterPlan,
  type MessagingDeliveryAdapterPlanInput,
  type MessagingDeliveryExplicitConsent,
} from '../lib/messaging-delivery-adapter-plan';
import {
  createMessagingDeliveryExecutionAdapterFacts,
  createMessagingDeliveryExecutionBoundaryInput,
  evaluateMessagingDeliveryExecutionBoundary as evaluateRawMessagingDeliveryExecutionBoundary,
  type MessagingDeliveryExecutionAdapterFacts,
  type MessagingDeliveryExecutionBoundaryInput,
} from '../lib/messaging-delivery-execution-boundary';
import type { MessagingExecutionGateInput, MessagingExecutionNoiseLimits } from '../lib/messaging-execution-gate';
import type { MessagingRuntimeReadinessInput } from '../lib/messaging-runtime-readiness';
import {
  createRuntimeTrustedContractObject,
  type RuntimeTrustedContractEntry,
  type RuntimeTrustedContractValue,
} from '../lib/runtime-trusted-contract-object';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const NOW = 1_800_000_000_000;

function trustedObject<T>(entries: readonly RuntimeTrustedContractEntry[]): T {
  return createRuntimeTrustedContractObject(entries) as unknown as T;
}

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

function trustedTarget(kind: string) {
  return trustedObject<MessagingDeliveryExecutionAdapterFacts['target']>([
    ['kind', kind],
    ['redaction', 'target-id-omitted'],
  ]);
}

function trustedDryRunSafeDetails(details: Record<string, unknown>): Record<string, unknown> {
  return trustedObject<Record<string, unknown>>(Object.entries(details).map(([key, value]) => (
    [key, value as RuntimeTrustedContractValue] satisfies RuntimeTrustedContractEntry
  )));
}

function trustedPlanCopy(
  plan: MessagingDeliveryAdapterPlan,
  overrides: Partial<MessagingDeliveryAdapterPlan> = {},
): MessagingDeliveryAdapterPlan {
  const merged = { ...plan, ...overrides };
  const entries: RuntimeTrustedContractEntry[] = [
    ['status', merged.status],
    ['planned', merged.planned],
    ['reason', merged.reason],
    ['action', merged.action],
    ['inert', merged.inert],
    ['executable', merged.executable],
    ['willPostMessage', merged.willPostMessage],
    ['willCallWebhook', merged.willCallWebhook],
    ['willStoreCredential', merged.willStoreCredential],
    ['sideEffectBoundary', merged.sideEffectBoundary],
  ];
  if (merged.connectorKind !== undefined) entries.push(['connectorKind', merged.connectorKind]);
  if (merged.eventScope !== undefined) entries.push(['eventScope', merged.eventScope]);
  if (merged.adapterId !== undefined) entries.push(['adapterId', merged.adapterId]);
  if (merged.runtimeOwner !== undefined) entries.push(['runtimeOwner', merged.runtimeOwner]);
  if (merged.target !== undefined) {
    entries.push(['target', trustedObject([
      ['kind', merged.target.kind],
      ['redaction', 'target-id-omitted'],
    ]) as unknown as RuntimeTrustedContractValue]);
  }
  if (merged.credentialReference !== undefined) {
    entries.push(['credentialReference', merged.credentialReference as unknown as RuntimeTrustedContractValue]);
  }
  if (merged.noiseLimits !== undefined) {
    entries.push(['noiseLimits', merged.noiseLimits as unknown as RuntimeTrustedContractValue]);
  }
  if (merged.planExpiresAt !== undefined) entries.push(['planExpiresAt', merged.planExpiresAt]);
  if (merged.gateReason !== undefined) entries.push(['gateReason', merged.gateReason]);
  if (merged.runtimeReason !== undefined) entries.push(['runtimeReason', merged.runtimeReason]);
  return trustedObject<MessagingDeliveryAdapterPlan>(entries);
}

function trustedHarnessCopy(
  harness: MessagingAdapterDryRunHarnessMetadata,
  overrides: Partial<MessagingAdapterDryRunHarnessMetadata> = {},
): MessagingAdapterDryRunHarnessMetadata {
  const merged = { ...harness, ...overrides };
  const entries: RuntimeTrustedContractEntry[] = [
    ['status', merged.status],
    ['accepted', merged.accepted],
    ['reason', merged.reason],
    ['executable', merged.executable],
    ['willPostMessage', merged.willPostMessage],
    ['willCallWebhook', merged.willCallWebhook],
    ['willStoreCredential', merged.willStoreCredential],
    ['sideEffectBoundary', merged.sideEffectBoundary],
  ];
  if (merged.adapterId !== undefined) entries.push(['adapterId', merged.adapterId]);
  if (merged.runtimeOwner !== undefined) entries.push(['runtimeOwner', merged.runtimeOwner]);
  if (merged.action !== undefined) entries.push(['action', merged.action]);
  if (merged.connectorKind !== undefined) entries.push(['connectorKind', merged.connectorKind]);
  if (merged.eventScope !== undefined) entries.push(['eventScope', merged.eventScope]);
  if (merged.credentialReference !== undefined) {
    entries.push(['credentialReference', merged.credentialReference as unknown as RuntimeTrustedContractValue]);
  }
  if (merged.target !== undefined) {
    entries.push(['target', trustedObject([
      ['kind', merged.target.kind],
      ['redaction', 'target-id-omitted'],
    ]) as unknown as RuntimeTrustedContractValue]);
  }
  if (merged.planExpiresAt !== undefined) entries.push(['planExpiresAt', merged.planExpiresAt]);
  for (const [key, value] of Object.entries(overrides)) {
    if (!entries.some(([entryKey]) => entryKey === key)) {
      entries.push([key, trustedFixtureValue(value)]);
    }
  }
  return trustedObject<MessagingAdapterDryRunHarnessMetadata>(entries);
}

function trustedDeliveryResult(entries: readonly RuntimeTrustedContractEntry[]): Record<string, unknown> {
  return trustedObject<Record<string, unknown>>(entries);
}

function makeExecutionBoundaryInput(
  overrides: MessagingDeliveryExecutionBoundaryInput = {},
): MessagingDeliveryExecutionBoundaryInput {
  if (Object.keys(overrides).some((key) => !['adapterFacts', 'deliveryResult', 'dryRunHarness', 'now', 'plan'].includes(key))) {
    return overrides;
  }
  const entries: RuntimeTrustedContractEntry[] = [];
  if ('plan' in overrides) entries.push(['plan', (overrides.plan ?? null) as unknown as RuntimeTrustedContractValue]);
  if ('dryRunHarness' in overrides) {
    entries.push(['dryRunHarness', (overrides.dryRunHarness ?? null) as unknown as RuntimeTrustedContractValue]);
  }
  if ('adapterFacts' in overrides) entries.push(['adapterFacts', overrides.adapterFacts as unknown as RuntimeTrustedContractValue]);
  if ('deliveryResult' in overrides) {
    entries.push(['deliveryResult', overrides.deliveryResult as unknown as RuntimeTrustedContractValue]);
  }
  if ('now' in overrides) entries.push(['now', overrides.now]);
  try {
    return createMessagingDeliveryExecutionBoundaryInput(entries);
  } catch {
    return overrides;
  }
}

function evaluateMessagingDeliveryExecutionBoundary(
  input: MessagingDeliveryExecutionBoundaryInput = {},
) {
  return evaluateRawMessagingDeliveryExecutionBoundary(makeExecutionBoundaryInput(input));
}

function makeCredentialReference(
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
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

function makeRuntimeInput(
  overrides: Partial<MessagingRuntimeReadinessInput> = {},
): MessagingRuntimeReadinessInput {
  return {
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
  };
}

function makeNoiseLimits(overrides: Partial<MessagingExecutionNoiseLimits> = {}): MessagingExecutionNoiseLimits {
  return {
    maxActionsPerHour: 1,
    maxRecipientsPerAction: 1,
    suppressDuplicateThreadReplies: true,
    requireExplicitCaseMentionForChannels: true,
    ...overrides,
  };
}

function makeGateInput(overrides: Partial<MessagingExecutionGateInput> = {}): MessagingExecutionGateInput {
  return {
    action: 'dry-run-notification',
    explicitActionConsent: true,
    runtime: makeRuntimeInput(),
    noiseLimits: makeNoiseLimits(),
    ...overrides,
  };
}

function makeAdapterCapabilities(
  overrides: Partial<MessagingDeliveryAdapterCapabilityFacts> = {},
): MessagingDeliveryAdapterCapabilityFacts {
  return {
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
  };
}

function makeConsent(
  overrides: Partial<MessagingDeliveryExplicitConsent> = {},
): MessagingDeliveryExplicitConsent {
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
    ? trustedDryRunSafeDetails(result.safeDetails)
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
  return createMessagingAdapterDryRunResult(entries);
}

function makeDryRunHarness(
  plan: MessagingDeliveryAdapterPlan = makePlan(),
  result: MessagingAdapterDryRunResult = makeDryRunResult(),
): Readonly<MessagingAdapterDryRunHarnessMetadata> {
  return bindMessagingAdapterDryRunResult(createMessagingAdapterDryRunHarnessInput([
    ['plan', plan as unknown as RuntimeTrustedContractValue],
    ['dryRunResult', result as unknown as RuntimeTrustedContractValue],
  ]));
}

function makeAdapterFacts(
  overrides: Partial<MessagingDeliveryExecutionAdapterFacts> = {},
): MessagingDeliveryExecutionAdapterFacts {
  const facts = {
    contract: 'messaging-delivery-execution-adapter-facts-v1',
    adapterId: 'slack-delivery-adapter',
    runtimeOwner: 'assistantcaddy-messaging-runtime',
    action: 'dry-run-notification',
    connectorKind: 'slack',
    eventScope: 'direct-mention',
    credentialReferenceId: 'vault:messaging/slack/case-alerts',
    target: {
      kind: 'slack-channel',
      redaction: 'target-id-omitted',
    },
    planExpiresAt: NOW + 60_000,
    noAutoPost: true,
    deliveryMode: 'dry-run-only',
    executable: false,
    willPostMessage: false,
    willCallWebhook: false,
    willStoreCredential: false,
    sideEffectBoundary: 'adapter-facts-only-no-fetch-no-webhook-no-slack-sdk-no-storage-no-send',
    ...overrides,
  };
  return createMessagingDeliveryExecutionAdapterFacts([
    ['contract', facts.contract],
    ['adapterId', facts.adapterId],
    ['runtimeOwner', facts.runtimeOwner],
    ['action', facts.action],
    ['connectorKind', facts.connectorKind],
    ['eventScope', facts.eventScope],
    ['credentialReferenceId', facts.credentialReferenceId],
    ['target', trustedTarget(facts.target.kind) as unknown as RuntimeTrustedContractValue],
    ['planExpiresAt', facts.planExpiresAt],
    ['noAutoPost', facts.noAutoPost],
    ['deliveryMode', facts.deliveryMode],
    ['executable', facts.executable],
    ['willPostMessage', facts.willPostMessage],
    ['willCallWebhook', facts.willCallWebhook],
    ['willStoreCredential', facts.willStoreCredential],
    ['sideEffectBoundary', facts.sideEffectBoundary],
  ]);
}

describe('messaging delivery execution boundary', () => {
  it('marks a future injected adapter bindable only after plan, dry-run harness, and adapter facts match', () => {
    const plan = makePlan();
    const decision = evaluateMessagingDeliveryExecutionBoundary({
      plan,
      dryRunHarness: makeDryRunHarness(plan),
      adapterFacts: makeAdapterFacts(),
    });
    const serialized = JSON.stringify(decision);

    expect(decision).toMatchObject({
      status: 'ready',
      ready: true,
      reason: 'delivery_execution_boundary_ready',
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
      canBindInjectedAdapter: true,
      deliveryMode: 'dry-run-only',
      executable: false,
      willPostMessage: false,
      willCallWebhook: false,
      willStoreCredential: false,
      sideEffectBoundary: 'pure-local-delivery-execution-boundary-no-fetch-no-webhook-no-slack-sdk-no-storage-no-send',
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.target)).toBe(true);
    expect(Object.isFrozen(decision.credentialReference)).toBe(true);
    expect(serialized).not.toContain('C01CASEALERTS');
    expect(serialized).not.toContain('dry-run-preview-1');
  });

  it('fails closed when the delivery plan is blocked or no longer inert', () => {
    expect(evaluateMessagingDeliveryExecutionBoundary({
      plan: makePlan({ gateInput: makeGateInput({ explicitActionConsent: false }) }),
      dryRunHarness: makeDryRunHarness(),
      adapterFacts: makeAdapterFacts(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'plan_not_planned',
      canBindInjectedAdapter: false,
      executable: false,
    });

    const plan = makePlan();
    expect(evaluateMessagingDeliveryExecutionBoundary({
      plan: { ...plan, willPostMessage: true } as never,
      dryRunHarness: makeDryRunHarness(plan),
      adapterFacts: makeAdapterFacts(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'delivery_shape_forbidden',
      willPostMessage: false,
    });
  });

  it('requires an accepted dry-run harness with matching owner, target, credential, and no-send boundary', () => {
    const plan = makePlan();
    expect(evaluateMessagingDeliveryExecutionBoundary({
      plan,
      dryRunHarness: makeDryRunHarness(plan, makeDryRunResult({ runtimeOwner: 'other-runtime' })),
      adapterFacts: makeAdapterFacts(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'dry_run_harness_blocked',
    });

    expect(evaluateMessagingDeliveryExecutionBoundary({
      plan,
      dryRunHarness: trustedHarnessCopy(makeDryRunHarness(plan), { adapterId: 'other-adapter' }),
      adapterFacts: makeAdapterFacts(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'dry_run_harness_mismatch',
    });

    expect(evaluateMessagingDeliveryExecutionBoundary({
      plan,
      dryRunHarness: trustedHarnessCopy(makeDryRunHarness(plan), { willCallWebhook: true } as never),
      adapterFacts: makeAdapterFacts(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'dry_run_harness_boundary_invalid',
      willCallWebhook: false,
    });

    expect(evaluateMessagingDeliveryExecutionBoundary({
      plan,
      dryRunHarness: trustedHarnessCopy(makeDryRunHarness(plan), {
        previewMetadata: 'unreviewed-metadata',
      } as never),
      adapterFacts: makeAdapterFacts(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'dry_run_harness_boundary_invalid',
      canBindInjectedAdapter: false,
      executable: false,
      willPostMessage: false,
      willCallWebhook: false,
    });
  });

  it('blocks forged adapter facts across owner, action, scope, credential, target, expiry, and side-effect flags', () => {
    const plan = makePlan();
    for (const mismatch of [
      { adapterId: 'other-adapter' },
      { runtimeOwner: 'other-runtime' },
      { action: 'disable-connector' },
      { connectorKind: 'generic-webhook', target: { kind: 'webhook-handle', redaction: 'target-id-omitted' } },
      { eventScope: 'webhook-alert' },
      { credentialReferenceId: 'vault:messaging/slack/other' },
      { target: { kind: 'slack-dm', redaction: 'target-id-omitted' } },
      { planExpiresAt: NOW + 120_000 },
    ] satisfies Partial<MessagingDeliveryExecutionAdapterFacts>[]) {
      expect(evaluateMessagingDeliveryExecutionBoundary({
        plan,
        dryRunHarness: makeDryRunHarness(plan),
        adapterFacts: makeAdapterFacts(mismatch),
      })).toMatchObject({
        status: 'blocked',
        reason: 'adapter_owner_mismatch',
        canBindInjectedAdapter: false,
      });
    }

    expect(evaluateMessagingDeliveryExecutionBoundary({
      plan,
      dryRunHarness: makeDryRunHarness(plan),
      adapterFacts: makeAdapterFacts({ willPostMessage: true } as never),
    })).toMatchObject({
      status: 'blocked',
      reason: 'adapter_facts_unreviewed',
      willPostMessage: false,
    });
  });

  it('requires connector-target compatibility before a delivery boundary can become ready', () => {
    const plan = {
      ...makePlan(),
      connectorKind: 'generic-webhook',
      target: {
        kind: 'slack-channel',
        redaction: 'target-id-omitted',
      },
    } as unknown as MessagingDeliveryAdapterPlan;
    const harness = {
      ...makeDryRunHarness(makePlan()),
      connectorKind: 'generic-webhook',
      target: {
        kind: 'slack-channel',
        redaction: 'target-id-omitted',
      },
    } as unknown as MessagingAdapterDryRunHarnessMetadata;
    const decision = evaluateMessagingDeliveryExecutionBoundary({
      plan,
      dryRunHarness: harness,
      adapterFacts: makeAdapterFacts({
        connectorKind: 'generic-webhook',
        target: {
          kind: 'slack-channel',
          redaction: 'target-id-omitted',
        },
      }),
    });

    expect(decision).toMatchObject({
      status: 'blocked',
      ready: false,
      reason: 'delivery_shape_forbidden',
      canBindInjectedAdapter: false,
      willPostMessage: false,
      willCallWebhook: false,
    });
  });

  it('rejects unredacted channel and webhook target material without echoing it', () => {
    const plan = makePlan();
    const decision = evaluateMessagingDeliveryExecutionBoundary({
      plan,
      dryRunHarness: makeDryRunHarness(plan),
      adapterFacts: {
        ...makeAdapterFacts(),
        target: {
          kind: 'slack-channel',
          redaction: 'target-id-omitted',
          channelId: 'C01DO-NOT-ECHO',
          webhookUrl: 'https://hooks.slack.com/services/T000/B000/do-not-echo',
        },
      },
    });
    const serialized = JSON.stringify(decision);

    expect(decision).toMatchObject({
      status: 'blocked',
      reason: 'delivery_shape_forbidden',
    });
    expect(serialized).not.toContain('C01DO-NOT-ECHO');
    expect(serialized).not.toContain('hooks.slack.com');
    expect(serialized).not.toContain('do-not-echo');
  });

  it('does not echo malformed plan expiry material on blocked decisions', () => {
    const malformedExpiry = 'C01DO-NOT-ECHO';
    const plan = {
      ...makePlan(),
      planExpiresAt: malformedExpiry,
    } as unknown as MessagingDeliveryAdapterPlan;
    const decision = evaluateMessagingDeliveryExecutionBoundary({
      plan,
      adapterFacts: makeAdapterFacts(),
    });
    const serialized = JSON.stringify(decision);

    expect(decision).toMatchObject({
      status: 'blocked',
      reason: 'delivery_shape_forbidden',
      canBindInjectedAdapter: false,
      executable: false,
    });
    expect(serialized).not.toContain(malformedExpiry);
  });

  it('redacts forged plan target material on blocked decisions', () => {
    const plan = {
      ...makePlan(),
      target: {
        kind: 'https://hooks.slack.com/services/T000/B000/do-not-echo',
        redaction: 'target-id-omitted',
      },
    } as unknown as MessagingDeliveryAdapterPlan;
    const decision = evaluateMessagingDeliveryExecutionBoundary({
      plan,
      dryRunHarness: makeDryRunHarness(makePlan()),
      adapterFacts: makeAdapterFacts(),
    });
    const serialized = JSON.stringify(decision);

    expect(decision.status).toBe('blocked');
    expect(decision.target).toBeUndefined();
    expect(serialized).not.toContain('hooks.slack.com');
    expect(serialized).not.toContain('do-not-echo');
  });

  it('rejects self-consistent forged runtime enums instead of deriving readiness from shape alone', () => {
    const plan = {
      ...makePlan(),
      connectorKind: 'teams',
      eventScope: 'incident-alert',
      target: {
        kind: 'case-room',
        redaction: 'target-id-omitted',
      },
    } as unknown as MessagingDeliveryAdapterPlan;
    const harness = {
      ...makeDryRunHarness(makePlan()),
      connectorKind: 'teams',
      eventScope: 'incident-alert',
      target: {
        kind: 'case-room',
        redaction: 'target-id-omitted',
      },
    } as unknown as MessagingAdapterDryRunHarnessMetadata;
    const adapterFacts = {
      ...makeAdapterFacts(),
      connectorKind: 'teams',
      eventScope: 'incident-alert',
      target: {
        kind: 'case-room',
        redaction: 'target-id-omitted',
      },
    } as unknown as MessagingDeliveryExecutionAdapterFacts;

    const decision = evaluateMessagingDeliveryExecutionBoundary({
      plan,
      dryRunHarness: harness,
      adapterFacts,
    });

    expect(decision.status).toBe('blocked');
    expect(decision.ready).toBe(false);
    expect(decision.reason).toBe('delivery_shape_forbidden');
    expect(decision.connectorKind).toBeUndefined();
    expect(decision.eventScope).toBeUndefined();
    expect(decision.target).toBeUndefined();
  });

  it('rejects caller-provided delivery result objects because this boundary never proves execution', () => {
    const plan = makePlan();
    expect(evaluateMessagingDeliveryExecutionBoundary({
      plan,
      dryRunHarness: makeDryRunHarness(plan),
      adapterFacts: makeAdapterFacts(),
      deliveryResult: trustedDeliveryResult([['adapterRunId', 'future-run-1']]),
    })).toMatchObject({
      status: 'blocked',
      reason: 'delivery_result_forbidden',
      canBindInjectedAdapter: false,
      executable: false,
    });

    expect(evaluateMessagingDeliveryExecutionBoundary({
      plan,
      dryRunHarness: makeDryRunHarness(plan),
      adapterFacts: makeAdapterFacts(),
      deliveryResult: trustedDeliveryResult([
        ['posted', true],
        ['willCallWebhook', true],
      ]),
    })).toMatchObject({
      status: 'blocked',
      reason: 'delivery_result_live_claim',
      willPostMessage: false,
      willCallWebhook: false,
    });
  });

  it('rejects executable-looking delivery roots, adapter fact residuals, and result fields without invoking them', () => {
    const plan = makePlan();
    const sendSpy = vi.fn();
    const callbackSpy = vi.fn();
    const requesterSpy = vi.fn();
    const planSendSpy = vi.fn();
    const harnessRequesterSpy = vi.fn();

    expect(evaluateMessagingDeliveryExecutionBoundary({
      plan,
      dryRunHarness: makeDryRunHarness(plan),
      adapterFacts: makeAdapterFacts(),
      liveAction: true,
      send: sendSpy,
    } as unknown as Parameters<typeof evaluateMessagingDeliveryExecutionBoundary>[0])).toMatchObject({
      status: 'blocked',
      reason: 'delivery_shape_forbidden',
      canBindInjectedAdapter: false,
      executable: false,
      willPostMessage: false,
      willCallWebhook: false,
    });
    expect(sendSpy).not.toHaveBeenCalled();

    expect(evaluateMessagingDeliveryExecutionBoundary({
      plan: {
        ...plan,
        send: planSendSpy,
      } as never,
      dryRunHarness: makeDryRunHarness(plan),
      adapterFacts: makeAdapterFacts(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'delivery_shape_forbidden',
      canBindInjectedAdapter: false,
      executable: false,
      willPostMessage: false,
      willCallWebhook: false,
    });
    expect(planSendSpy).not.toHaveBeenCalled();

    expect(evaluateMessagingDeliveryExecutionBoundary({
      plan,
      dryRunHarness: {
        ...makeDryRunHarness(plan),
        requester: {
          callback: harnessRequesterSpy,
        },
      } as never,
      adapterFacts: makeAdapterFacts(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'delivery_shape_forbidden',
      canBindInjectedAdapter: false,
      executable: false,
      willPostMessage: false,
      willCallWebhook: false,
    });
    expect(harnessRequesterSpy).not.toHaveBeenCalled();

    expect(evaluateMessagingDeliveryExecutionBoundary({
      plan,
      dryRunHarness: makeDryRunHarness(plan),
      adapterFacts: {
        ...makeAdapterFacts(),
        requester: {
          callback: callbackSpy,
        },
      },
    })).toMatchObject({
      status: 'blocked',
      reason: 'delivery_shape_forbidden',
      canBindInjectedAdapter: false,
      executable: false,
    });
    expect(callbackSpy).not.toHaveBeenCalled();

    expect(evaluateMessagingDeliveryExecutionBoundary({
      plan,
      dryRunHarness: makeDryRunHarness(plan),
      adapterFacts: makeAdapterFacts(),
      deliveryResult: trustedDeliveryResult([['delivered', true]]),
    })).toMatchObject({
      status: 'blocked',
      reason: 'delivery_result_live_claim',
      canBindInjectedAdapter: false,
      executable: false,
      willPostMessage: false,
      willCallWebhook: false,
    });
    expect(requesterSpy).not.toHaveBeenCalled();
  });

  it('rejects accessor and proxy-poisoned delivery inputs before invoking traps or callbacks', () => {
    const getterSpy = vi.fn(() => 'slack-delivery-adapter');
    const proxyGetSpy = vi.fn();
    const proxyOwnKeysSpy = vi.fn();
    const proxyGetOwnPropertyDescriptorSpy = vi.fn();
    const proxyGetPrototypeOfSpy = vi.fn();
    const plan = { ...makePlan() };
    Object.defineProperty(plan, 'adapterId', {
      enumerable: true,
      configurable: true,
      get: getterSpy,
    });
    const proxyValue = new Proxy({ request: vi.fn() }, {
      get(target, property, receiver) {
        proxyGetSpy(property);
        return Reflect.get(target, property, receiver);
      },
      ownKeys(target) {
        proxyOwnKeysSpy();
        return Reflect.ownKeys(target);
      },
      getOwnPropertyDescriptor(target, property) {
        proxyGetOwnPropertyDescriptorSpy(property);
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
      getPrototypeOf(target) {
        proxyGetPrototypeOfSpy();
        return Reflect.getPrototypeOf(target);
      },
    });

    expect(evaluateMessagingDeliveryExecutionBoundary({
      plan: plan as MessagingDeliveryAdapterPlan,
      dryRunHarness: makeDryRunHarness(makePlan()),
      adapterFacts: makeAdapterFacts(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'delivery_shape_forbidden',
      canBindInjectedAdapter: false,
    });

    expect(evaluateMessagingDeliveryExecutionBoundary({
      plan: makePlan(),
      dryRunHarness: makeDryRunHarness(makePlan()),
      adapterFacts: makeAdapterFacts(),
      requester: proxyValue,
    } as unknown as Parameters<typeof evaluateMessagingDeliveryExecutionBoundary>[0])).toMatchObject({
      status: 'blocked',
      reason: 'delivery_shape_forbidden',
      canBindInjectedAdapter: false,
    });

    expect(evaluateRawMessagingDeliveryExecutionBoundary(new Proxy({
      plan: makePlan(),
      dryRunHarness: makeDryRunHarness(makePlan()),
      adapterFacts: makeAdapterFacts(),
    }, {
      get(target, property, receiver) {
        proxyGetSpy(property);
        return Reflect.get(target, property, receiver);
      },
      ownKeys(target) {
        proxyOwnKeysSpy();
        return Reflect.ownKeys(target);
      },
      getOwnPropertyDescriptor(target, property) {
        proxyGetOwnPropertyDescriptorSpy(property);
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
      getPrototypeOf(target) {
        proxyGetPrototypeOfSpy();
        return Reflect.getPrototypeOf(target);
      },
    }) as unknown as Parameters<typeof evaluateRawMessagingDeliveryExecutionBoundary>[0])).toMatchObject({
      status: 'blocked',
      reason: 'delivery_shape_forbidden',
      canBindInjectedAdapter: false,
    });

    expect(evaluateMessagingDeliveryExecutionBoundary({
      plan: proxyValue as unknown as MessagingDeliveryAdapterPlan,
      dryRunHarness: makeDryRunHarness(makePlan()),
      adapterFacts: makeAdapterFacts(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'delivery_shape_forbidden',
      canBindInjectedAdapter: false,
    });

    expect(getterSpy).not.toHaveBeenCalled();
    expect(proxyGetSpy).not.toHaveBeenCalled();
    expect(proxyOwnKeysSpy).not.toHaveBeenCalled();
    expect(proxyGetOwnPropertyDescriptorSpy).not.toHaveBeenCalled();
    expect(proxyGetPrototypeOfSpy).not.toHaveBeenCalled();
  });

  it('blocks stale plan expiry even when plan, harness, and facts agree', () => {
    const plan = makePlan();
    const expiredPlan = trustedPlanCopy(plan, { planExpiresAt: NOW - 1 });
    const expiredHarness = trustedHarnessCopy(makeDryRunHarness(plan), { planExpiresAt: NOW - 1 });

    expect(evaluateMessagingDeliveryExecutionBoundary({
      plan: expiredPlan,
      dryRunHarness: expiredHarness,
      adapterFacts: makeAdapterFacts({ planExpiresAt: NOW - 1 }),
      now: NOW,
    })).toMatchObject({
      status: 'blocked',
      reason: 'plan_expired',
      canBindInjectedAdapter: false,
      executable: false,
    });
  });

  it('rejects non-http URL-shaped identifiers across adapter and credential provenance', () => {
    const plan = makePlan();
    for (const identifier of [
      'wss://example.invalid/socket',
      '//example.invalid/path',
      'ftp://example.invalid/file',
      'mailto:user@example.test',
      'urn:messaging:opaque',
      'localhost:11434/health',
      '127.0.0.1:11434/health',
      'api.mailprovider.test/oauth/token/do-not-echo',
    ]) {
      const decision = evaluateMessagingDeliveryExecutionBoundary({
        plan,
        dryRunHarness: makeDryRunHarness(plan),
        adapterFacts: makeAdapterFacts({ adapterId: identifier }),
      });
      const serialized = JSON.stringify(decision);

      expect(decision).toMatchObject({
        status: 'blocked',
        reason: 'identifier_unsafe',
        canBindInjectedAdapter: false,
      });
      expect(serialized).not.toContain(identifier);
      expect(serialized).not.toContain('do-not-echo');
    }

    const webhookHostDecision = evaluateMessagingDeliveryExecutionBoundary({
      plan,
      dryRunHarness: makeDryRunHarness(plan),
      adapterFacts: makeAdapterFacts({ adapterId: 'hooks.slack.com/services/T000/B000/do-not-echo' }),
    });
    const serializedWebhookHostDecision = JSON.stringify(webhookHostDecision);
    expect(webhookHostDecision.status).toBe('blocked');
    expect(serializedWebhookHostDecision).not.toContain('hooks.slack.com');
    expect(serializedWebhookHostDecision).not.toContain('do-not-echo');

    expect(evaluateMessagingDeliveryExecutionBoundary({
      plan,
      dryRunHarness: makeDryRunHarness(plan),
      adapterFacts: makeAdapterFacts({ credentialReferenceId: 'localhost:11434/credential' }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'identifier_unsafe',
      canBindInjectedAdapter: false,
    });
  });

  it('blocks token-shaped identifiers and does not call fetch, sockets, Slack/webhook APIs, or storage', () => {
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

    const plan = makePlan();
    const decision = evaluateMessagingDeliveryExecutionBoundary({
      plan,
      dryRunHarness: makeDryRunHarness(plan),
      adapterFacts: makeAdapterFacts({ adapterId: 'xoxb-do-not-keep-adapter-token' }),
    });
    const serialized = JSON.stringify(decision);

    expect(decision).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
      executable: false,
      willPostMessage: false,
      willCallWebhook: false,
      willStoreCredential: false,
    });
    expect(serialized).not.toContain('xoxb');
    expect(serialized).not.toContain('do-not-keep');
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
