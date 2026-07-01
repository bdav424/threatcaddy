import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
import {
  bindMessagingAdapterDryRunResult,
  createMessagingAdapterDryRunHarnessInput,
  createMessagingAdapterDryRunResult,
  type MessagingAdapterDryRunResult,
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
  createMessagingAdapterInvocationExecutableContract,
  createMessagingAdapterInvocationFacts,
  createMessagingAdapterInvocationImplementationInput,
  evaluateMessagingAdapterInvocationImplementationBoundary as evaluateRawMessagingAdapterInvocationImplementationBoundary,
  type MessagingAdapterInvocationExecutableContract,
  type MessagingAdapterInvocationFacts,
  type MessagingAdapterInvocationImplementationInput,
} from '../lib/messaging-adapter-invocation-implementation-boundary';
import {
  createMessagingDeliveryExecutionAdapterFacts,
  createMessagingDeliveryExecutionBoundaryInput,
  evaluateMessagingDeliveryExecutionBoundary as evaluateRawMessagingDeliveryExecutionBoundary,
  type MessagingDeliveryExecutionAdapterFacts,
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

function trustedTarget<TTarget extends { kind: string; redaction: 'target-id-omitted' }>(kind: string): TTarget {
  return trustedObject<TTarget>([
    ['kind', kind],
    ['redaction', 'target-id-omitted'],
  ]);
}

function trustedSafeDetails(details: Record<string, unknown>): Record<string, unknown> {
  return trustedObject<Record<string, unknown>>(Object.entries(details).map(([key, value]) => (
    [key, value as RuntimeTrustedContractValue] satisfies RuntimeTrustedContractEntry
  )));
}

function makeDeliveryExecutionInput(entries: {
  plan?: MessagingDeliveryAdapterPlan | null;
  dryRunHarness?: ReturnType<typeof bindMessagingAdapterDryRunResult> | null;
  adapterFacts?: MessagingDeliveryExecutionAdapterFacts;
}) {
  const trustedEntries: RuntimeTrustedContractEntry[] = [];
  if ('plan' in entries) trustedEntries.push(['plan', (entries.plan ?? null) as unknown as RuntimeTrustedContractValue]);
  if ('dryRunHarness' in entries) {
    trustedEntries.push(['dryRunHarness', (entries.dryRunHarness ?? null) as unknown as RuntimeTrustedContractValue]);
  }
  if ('adapterFacts' in entries) {
    trustedEntries.push(['adapterFacts', entries.adapterFacts as unknown as RuntimeTrustedContractValue]);
  }
  return createMessagingDeliveryExecutionBoundaryInput(trustedEntries);
}

function makeInvocationInput(
  input: MessagingAdapterInvocationImplementationInput = {},
): MessagingAdapterInvocationImplementationInput {
  if (Object.keys(input).some((key) => ![
    'adapter',
    'adapterFacts',
    'adapterResult',
    'dryRunHarness',
    'executionBoundary',
    'now',
  ].includes(key))) {
    return input;
  }
  const entries: RuntimeTrustedContractEntry[] = [];
  if ('executionBoundary' in input) {
    entries.push(['executionBoundary', (input.executionBoundary ?? null) as unknown as RuntimeTrustedContractValue]);
  }
  if ('dryRunHarness' in input) {
    entries.push(['dryRunHarness', (input.dryRunHarness ?? null) as unknown as RuntimeTrustedContractValue]);
  } else if ('executionBoundary' in input && input.executionBoundary !== null) {
    entries.push(['dryRunHarness', makeDryRunHarness() as unknown as RuntimeTrustedContractValue]);
  }
  if ('adapterFacts' in input) entries.push(['adapterFacts', input.adapterFacts as unknown as RuntimeTrustedContractValue]);
  if ('adapter' in input) entries.push(['adapter', input.adapter as unknown as RuntimeTrustedContractValue]);
  if ('adapterResult' in input) entries.push(['adapterResult', input.adapterResult as unknown as RuntimeTrustedContractValue]);
  if ('now' in input) entries.push(['now', input.now]);
  try {
    return createMessagingAdapterInvocationImplementationInput(entries);
  } catch {
    return input;
  }
}

function evaluateMessagingAdapterInvocationImplementationBoundary(
  input: MessagingAdapterInvocationImplementationInput = {},
) {
  return evaluateRawMessagingAdapterInvocationImplementationBoundary(makeInvocationInput(input));
}

function trustedExecutionBoundaryCopy(
  execution: ReturnType<typeof makeExecutionBoundary>,
  overrides: Partial<ReturnType<typeof makeExecutionBoundary>> = {},
): ReturnType<typeof makeExecutionBoundary> {
  const merged = { ...execution, ...overrides };
  const entries: RuntimeTrustedContractEntry[] = [
    ['status', merged.status],
    ['ready', merged.ready],
    ['reason', merged.reason],
    ['canBindInjectedAdapter', merged.canBindInjectedAdapter],
    ['deliveryMode', merged.deliveryMode],
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
  if (merged.target !== undefined) entries.push(['target', merged.target as unknown as RuntimeTrustedContractValue]);
  if (merged.planExpiresAt !== undefined) entries.push(['planExpiresAt', merged.planExpiresAt]);
  return trustedObject<ReturnType<typeof makeExecutionBoundary>>(entries);
}

function trustedAdapterResult(entries: readonly RuntimeTrustedContractEntry[]): Record<string, unknown> {
  return trustedObject<Record<string, unknown>>(entries);
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
  const safeDetails = result.safeDetails ? trustedSafeDetails(result.safeDetails) : undefined;
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

function makeExecutionAdapterFacts(
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
    ['target', trustedTarget<MessagingDeliveryExecutionAdapterFacts['target']>(facts.target.kind) as unknown as RuntimeTrustedContractValue],
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

function makeDryRunHarness(
  plan: MessagingDeliveryAdapterPlan = makePlan(),
  result: MessagingAdapterDryRunResult = makeDryRunResult(),
) {
  return bindMessagingAdapterDryRunResult(createMessagingAdapterDryRunHarnessInput([
    ['plan', plan as unknown as RuntimeTrustedContractValue],
    ['dryRunResult', result as unknown as RuntimeTrustedContractValue],
  ]));
}

function trustedDryRunHarnessCopy(
  harness: ReturnType<typeof makeDryRunHarness>,
  overrides: Record<string, RuntimeTrustedContractValue> = {},
) {
  const merged = { ...harness, ...overrides };
  const entries: RuntimeTrustedContractEntry[] = [
    ['status', merged.status],
    ['accepted', merged.accepted],
    ['reason', merged.reason],
    ['adapterId', merged.adapterId],
    ['runtimeOwner', merged.runtimeOwner],
    ['action', merged.action],
    ['connectorKind', merged.connectorKind],
    ['eventScope', merged.eventScope],
    ['credentialReference', merged.credentialReference as unknown as RuntimeTrustedContractValue],
    ['target', merged.target as unknown as RuntimeTrustedContractValue],
    ['planExpiresAt', merged.planExpiresAt],
    ['executable', merged.executable],
    ['willPostMessage', merged.willPostMessage],
    ['willCallWebhook', merged.willCallWebhook],
    ['willStoreCredential', merged.willStoreCredential],
    ['sideEffectBoundary', merged.sideEffectBoundary],
  ];
  for (const [key, value] of Object.entries(overrides)) {
    if (!entries.some(([entryKey]) => entryKey === key)) {
      entries.push([key, value]);
    }
  }
  return createRuntimeTrustedContractObject(entries) as unknown as ReturnType<typeof makeDryRunHarness>;
}

function makeExecutionBoundary(plan: MessagingDeliveryAdapterPlan = makePlan()) {
  return evaluateRawMessagingDeliveryExecutionBoundary(makeDeliveryExecutionInput({
    plan,
    dryRunHarness: makeDryRunHarness(plan),
    adapterFacts: makeExecutionAdapterFacts(),
  }));
}

function makeInvocationFacts(
  overrides: Partial<MessagingAdapterInvocationFacts> = {},
): MessagingAdapterInvocationFacts {
  const facts = {
    contract: 'messaging-adapter-invocation-implementation-facts-v1',
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
    adapterImplementationId: 'slack-adapter-package-boundary',
    adapterVersion: '2026-06-12.1',
    noAutoPost: true,
    invocationMode: 'decision-only',
    executable: false,
    adapterCallable: false,
    willInvokeAdapter: false,
    willPostMessage: false,
    willCallWebhook: false,
    willStoreCredential: false,
    sideEffectBoundary: 'adapter-invocation-facts-only-no-callback-no-fetch-no-webhook-no-slack-sdk-no-storage-no-send',
    ...overrides,
  };
  return createMessagingAdapterInvocationFacts([
    ['contract', facts.contract],
    ['adapterId', facts.adapterId],
    ['runtimeOwner', facts.runtimeOwner],
    ['action', facts.action],
    ['connectorKind', facts.connectorKind],
    ['eventScope', facts.eventScope],
    ['credentialReferenceId', facts.credentialReferenceId],
    ['target', trustedTarget<MessagingAdapterInvocationFacts['target']>(facts.target.kind) as unknown as RuntimeTrustedContractValue],
    ['planExpiresAt', facts.planExpiresAt],
    ['adapterImplementationId', facts.adapterImplementationId],
    ['adapterVersion', facts.adapterVersion],
    ['noAutoPost', facts.noAutoPost],
    ['invocationMode', facts.invocationMode],
    ['executable', facts.executable],
    ['adapterCallable', facts.adapterCallable],
    ['willInvokeAdapter', facts.willInvokeAdapter],
    ['willPostMessage', facts.willPostMessage],
    ['willCallWebhook', facts.willCallWebhook],
    ['willStoreCredential', facts.willStoreCredential],
    ['sideEffectBoundary', facts.sideEffectBoundary],
  ]);
}

function makeExecutableContract(
  overrides: Partial<MessagingAdapterInvocationExecutableContract> = {},
): MessagingAdapterInvocationExecutableContract {
  const contract = {
    contract: 'messaging-adapter-invocation-executable-contract-v1',
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
    adapterImplementationId: 'slack-adapter-package-boundary',
    adapterVersion: '2026-06-12.1',
    reviewed: true,
    noAutoPost: true,
    invocationMode: 'reviewed-injected-adapter-contract',
    targetBinding: 'execution-boundary-redacted-target',
    provenanceBinding: 'execution-boundary-and-adapter-facts',
    resultRedaction: 'safe-result-metadata-only',
    executable: false,
    adapterCallable: false,
    importsSlackSdk: false,
    willInvokeAdapter: false,
    willPostMessage: false,
    willCallWebhook: false,
    willFetch: false,
    willOpenSocket: false,
    willMutateStorage: false,
    willResolveCredential: false,
    willReadStorage: false,
    willWriteStorage: false,
    willStoreCredential: false,
    sideEffectBoundary: 'reviewed-injected-adapter-executable-contract-no-callback-no-requester-no-fetch-no-socket-no-storage-no-slack-sdk-no-webhook-url-no-send',
    ...overrides,
  };
  return createMessagingAdapterInvocationExecutableContract([
    ['contract', contract.contract],
    ['adapterId', contract.adapterId],
    ['runtimeOwner', contract.runtimeOwner],
    ['action', contract.action],
    ['connectorKind', contract.connectorKind],
    ['eventScope', contract.eventScope],
    ['credentialReferenceId', contract.credentialReferenceId],
    ['target', trustedTarget<MessagingAdapterInvocationExecutableContract['target']>(contract.target.kind) as unknown as RuntimeTrustedContractValue],
    ['planExpiresAt', contract.planExpiresAt],
    ['adapterImplementationId', contract.adapterImplementationId],
    ['adapterVersion', contract.adapterVersion],
    ['reviewed', contract.reviewed],
    ['noAutoPost', contract.noAutoPost],
    ['invocationMode', contract.invocationMode],
    ['targetBinding', contract.targetBinding],
    ['provenanceBinding', contract.provenanceBinding],
    ['resultRedaction', contract.resultRedaction],
    ['executable', contract.executable],
    ['adapterCallable', contract.adapterCallable],
    ['importsSlackSdk', contract.importsSlackSdk],
    ['willInvokeAdapter', contract.willInvokeAdapter],
    ['willPostMessage', contract.willPostMessage],
    ['willCallWebhook', contract.willCallWebhook],
    ['willFetch', contract.willFetch],
    ['willOpenSocket', contract.willOpenSocket],
    ['willMutateStorage', contract.willMutateStorage],
    ['willResolveCredential', contract.willResolveCredential],
    ['willReadStorage', contract.willReadStorage],
    ['willWriteStorage', contract.willWriteStorage],
    ['willStoreCredential', contract.willStoreCredential],
    ['sideEffectBoundary', contract.sideEffectBoundary],
  ]);
}

describe('messaging adapter invocation implementation boundary', () => {
  it('prepares only frozen redacted metadata after the promoted execution boundary is ready', () => {
    const decision = evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary: makeExecutionBoundary(),
      adapterFacts: makeInvocationFacts(),
    });
    const serialized = JSON.stringify(decision);

    expect(decision).toMatchObject({
      status: 'ready',
      ready: true,
      reason: 'adapter_invocation_boundary_ready',
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
      adapterImplementationId: 'slack-adapter-package-boundary',
      adapterVersion: '2026-06-12.1',
      canPrepareFutureAdapterInvocation: true,
      invocationMode: 'decision-only',
      executable: false,
      adapterCallable: false,
      willInvokeAdapter: false,
      willPostMessage: false,
      willCallWebhook: false,
      willStoreCredential: false,
      sideEffectBoundary: 'pure-local-adapter-invocation-implementation-boundary-no-callback-no-fetch-no-webhook-no-slack-sdk-no-storage-no-send',
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.target)).toBe(true);
    expect(Object.isFrozen(decision.credentialReference)).toBe(true);
    expect(serialized).not.toContain('C01CASEALERTS');
    expect(serialized).not.toContain('dry-run-preview-1');
  });

  it('accepts an exact reviewed no-call injected adapter contract without emitting downstream-incompatible keys', () => {
    const decision = evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary: makeExecutionBoundary(),
      adapterFacts: makeInvocationFacts(),
      adapter: makeExecutableContract(),
    });
    const serialized = JSON.stringify(decision);

    expect(decision).toMatchObject({
      status: 'ready',
      reason: 'adapter_invocation_boundary_ready',
      executable: false,
      adapterCallable: false,
      willInvokeAdapter: false,
      willPostMessage: false,
      willCallWebhook: false,
      willStoreCredential: false,
    });
    expect((decision as { executableContract?: unknown }).executableContract).toBeUndefined();
    expect(serialized).not.toContain('C01CASEALERTS');
    expect(serialized).not.toContain('dry-run-preview-1');
  });

  it('requires accepted dry-run harness metadata to match execution and invocation facts exactly', () => {
    const executionBoundary = makeExecutionBoundary();
    const adapterFacts = makeInvocationFacts();

    expect(evaluateRawMessagingAdapterInvocationImplementationBoundary(
      createMessagingAdapterInvocationImplementationInput([
        ['executionBoundary', executionBoundary as unknown as RuntimeTrustedContractValue],
        ['adapterFacts', adapterFacts as unknown as RuntimeTrustedContractValue],
        ['now', NOW],
      ]),
    )).toMatchObject({
      status: 'blocked',
      reason: 'dry_run_harness_missing',
      executable: false,
      willInvokeAdapter: false,
    });

    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary,
      dryRunHarness: makeDryRunHarness(
        makePlan(),
        makeDryRunResult({ willPostMessage: true } as unknown as Partial<MessagingAdapterDryRunResult>),
      ),
      adapterFacts,
      adapter: makeExecutableContract(),
      now: NOW,
    })).toMatchObject({
      status: 'blocked',
      reason: 'dry_run_harness_blocked',
      executable: false,
      willInvokeAdapter: false,
      willPostMessage: false,
    });

    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary,
      dryRunHarness: trustedDryRunHarnessCopy(makeDryRunHarness(), {
        adapterId: 'other-delivery-adapter',
      }),
      adapterFacts,
      adapter: makeExecutableContract(),
      now: NOW,
    })).toMatchObject({
      status: 'blocked',
      reason: 'dry_run_harness_mismatch',
      executable: false,
      willInvokeAdapter: false,
    });
  });

  it('rejects forged dry-run harness transport fields and callable-looking values without invoking them', () => {
    const requesterSpy = vi.fn();
    const executionBoundary = makeExecutionBoundary();
    const adapterFacts = makeInvocationFacts();
    const forgedTrustedHarness = trustedDryRunHarnessCopy(makeDryRunHarness(), {
      requester: 'metadata-only-requester',
    });

    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary,
      dryRunHarness: forgedTrustedHarness,
      adapterFacts,
      adapter: makeExecutableContract(),
      now: NOW,
    })).toMatchObject({
      status: 'blocked',
      reason: 'dry_run_harness_boundary_invalid',
      executable: false,
      willInvokeAdapter: false,
    });

    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary,
      dryRunHarness: {
        ...makeDryRunHarness(),
        requester: requesterSpy,
      } as never,
      adapterFacts,
      adapter: makeExecutableContract(),
      now: NOW,
    })).toMatchObject({
      status: 'blocked',
      reason: 'adapter_shape_forbidden',
      executable: false,
      willInvokeAdapter: false,
    });
    expect(requesterSpy).not.toHaveBeenCalled();
  });

  it('fails closed when the promoted execution boundary is missing, blocked, or forged', () => {
    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      adapterFacts: makeInvocationFacts(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'execution_boundary_missing',
      canPrepareFutureAdapterInvocation: false,
      executable: false,
    });

    const missingBoundarySendSpy = vi.fn();
    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      adapterFacts: makeInvocationFacts(),
      adapter: {
        send: missingBoundarySendSpy,
      },
    })).toMatchObject({
      status: 'blocked',
      reason: 'adapter_shape_forbidden',
      willInvokeAdapter: false,
    });
    expect(missingBoundarySendSpy).not.toHaveBeenCalled();

    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary: makeExecutionBoundary(makePlan({ gateInput: makeGateInput({ explicitActionConsent: false }) })),
      adapterFacts: makeInvocationFacts(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'execution_boundary_not_ready',
    });

    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary: {
        ...makeExecutionBoundary(),
        canBindInjectedAdapter: true,
        willCallWebhook: true,
      } as never,
      adapterFacts: makeInvocationFacts(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'adapter_shape_forbidden',
      willCallWebhook: false,
    });

    const forgedExecutionSendSpy = vi.fn();
    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary: {
        ...makeExecutionBoundary(),
        send: forgedExecutionSendSpy,
      } as never,
      adapterFacts: makeInvocationFacts(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'adapter_shape_forbidden',
      willInvokeAdapter: false,
      willPostMessage: false,
      willCallWebhook: false,
    });
    expect(forgedExecutionSendSpy).not.toHaveBeenCalled();

    const forgedExecutionCallbackSpy = vi.fn();
    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary: {
        ...makeExecutionBoundary(),
        requester: {
          callback: forgedExecutionCallbackSpy,
        },
      } as never,
      adapterFacts: makeInvocationFacts(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'adapter_shape_forbidden',
      willInvokeAdapter: false,
      willPostMessage: false,
      willCallWebhook: false,
    });
    expect(forgedExecutionCallbackSpy).not.toHaveBeenCalled();

    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary: {
        ...makeExecutionBoundary(),
        action: 'post-message',
      } as never,
      adapterFacts: makeInvocationFacts({
        action: 'post-message',
      }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'adapter_shape_forbidden',
      willPostMessage: false,
    });

    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary: {
        ...makeExecutionBoundary(),
        connectorKind: 'generic-webhook',
        target: {
          kind: 'slack-channel',
          redaction: 'target-id-omitted',
        },
      } as never,
      adapterFacts: makeInvocationFacts({
        connectorKind: 'generic-webhook',
      }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'adapter_shape_forbidden',
      willCallWebhook: false,
    });

    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary: makeExecutionBoundary(),
      adapterFacts: makeInvocationFacts(),
      send: vi.fn(),
      webhookUrl: 'https://hooks.slack.com/services/T000/B000/unsafe',
      liveAction: true,
    } as unknown as Parameters<typeof evaluateMessagingAdapterInvocationImplementationBoundary>[0])).toMatchObject({
      status: 'blocked',
      reason: 'adapter_shape_forbidden',
      willPostMessage: false,
      willCallWebhook: false,
    });
  });

  it('requires exact adapter facts and matching owner, action, target, credential, and expiry provenance', () => {
    const executionBoundary = makeExecutionBoundary();
    const ownerMismatchSendSpy = vi.fn();

    for (const mismatch of [
      { adapterId: 'other-adapter' },
      { runtimeOwner: 'other-runtime' },
      { action: 'disable-connector' },
      { connectorKind: 'generic-webhook', target: { kind: 'webhook-handle', redaction: 'target-id-omitted' } },
      { eventScope: 'webhook-alert' },
      { credentialReferenceId: 'vault:messaging/slack/other' },
      { target: { kind: 'slack-dm', redaction: 'target-id-omitted' } },
      { planExpiresAt: NOW + 120_000 },
    ] satisfies Partial<MessagingAdapterInvocationFacts>[]) {
      expect(evaluateMessagingAdapterInvocationImplementationBoundary({
        executionBoundary,
        adapterFacts: makeInvocationFacts(mismatch),
      })).toMatchObject({
        status: 'blocked',
        reason: 'adapter_owner_mismatch',
        canPrepareFutureAdapterInvocation: false,
      });
    }

    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary,
      adapterFacts: makeInvocationFacts({ runtimeOwner: 'other-runtime' }),
      adapter: {
        ...makeExecutableContract(),
        send: ownerMismatchSendSpy,
      },
    })).toMatchObject({
      status: 'blocked',
      reason: 'adapter_shape_forbidden',
      canPrepareFutureAdapterInvocation: false,
      willInvokeAdapter: false,
    });
    expect(ownerMismatchSendSpy).not.toHaveBeenCalled();

    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary,
      adapterFacts: {
        ...makeInvocationFacts(),
        callbackUrl: 'https://example.invalid/callback',
      },
    })).toMatchObject({
      status: 'blocked',
      reason: 'adapter_shape_forbidden',
    });

    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary,
      adapterFacts: makeInvocationFacts({
        adapterId: 42 as unknown as string,
      }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'adapter_facts_unreviewed',
      adapterCallable: false,
    });
  });

  it('rejects real adapter shapes and any result object instead of invoking or trusting them', () => {
    const executionBoundary = makeExecutionBoundary();
    const adapter = {
      adapterId: 'slack-delivery-adapter',
      send: vi.fn(),
    };

    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary,
      adapterFacts: makeInvocationFacts(),
      adapter,
    })).toMatchObject({
      status: 'blocked',
      reason: 'adapter_shape_forbidden',
      adapterCallable: false,
      willInvokeAdapter: false,
    });
    expect(adapter.send).not.toHaveBeenCalled();

    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary,
      adapterFacts: makeInvocationFacts(),
      adapter: {
        ...makeExecutableContract(),
        'live-action': false,
      },
    })).toMatchObject({
      status: 'blocked',
      reason: 'adapter_shape_forbidden',
      willInvokeAdapter: false,
    });

    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary,
      adapterFacts: makeInvocationFacts(),
      adapter: {
        ...makeExecutableContract(),
        requester: {
          callback: vi.fn(),
        },
      },
    })).toMatchObject({
      status: 'blocked',
      reason: 'adapter_shape_forbidden',
      willInvokeAdapter: false,
    });

    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary,
      adapterFacts: makeInvocationFacts(),
      adapter: {
        ...makeExecutableContract(),
        willFetch: true,
      },
    })).toMatchObject({
      status: 'blocked',
      reason: 'adapter_shape_forbidden',
      willCallWebhook: false,
    });

    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary,
      adapterFacts: makeInvocationFacts(),
      adapter: {
        ...makeExecutableContract(),
        adapterVersion: vi.fn() as unknown as string,
      },
    })).toMatchObject({
      status: 'blocked',
      reason: 'adapter_shape_forbidden',
      adapterCallable: false,
    });

    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary,
      adapterFacts: makeInvocationFacts(),
      adapter: makeExecutableContract({
        target: {
          kind: 'slack-dm',
          redaction: 'target-id-omitted',
        },
      }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'adapter_contract_owner_mismatch',
      canPrepareFutureAdapterInvocation: false,
    });

    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary,
      adapterFacts: makeInvocationFacts(),
      adapterResult: trustedAdapterResult([['adapterRunId', 'future-run-1']]),
    })).toMatchObject({
      status: 'blocked',
      reason: 'adapter_result_forbidden',
    });

    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary,
      adapterFacts: makeInvocationFacts(),
      adapterResult: trustedAdapterResult([
        ['nested', trustedAdapterResult([
          ['posted', true],
          ['willCallWebhook', true],
        ]) as unknown as RuntimeTrustedContractValue],
      ]),
    })).toMatchObject({
      status: 'blocked',
      reason: 'adapter_result_live_claim',
      willCallWebhook: false,
    });

    const resultRequesterSpy = vi.fn();
    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary,
      adapterFacts: makeInvocationFacts(),
      adapterResult: trustedAdapterResult([['willCallWebhook', true]]),
    })).toMatchObject({
      status: 'blocked',
      reason: 'adapter_result_live_claim',
      willInvokeAdapter: false,
      willCallWebhook: false,
    });
    expect(resultRequesterSpy).not.toHaveBeenCalled();

    const unsafeResult = evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary,
      adapterFacts: makeInvocationFacts(),
      adapterResult: trustedAdapterResult([
        ['callbackUrl', 'https://hooks.slack.com/services/T000/B000/do-not-echo'],
      ]),
    });
    const serializedUnsafeResult = JSON.stringify(unsafeResult);
    expect(unsafeResult).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
      willInvokeAdapter: false,
    });
    expect(serializedUnsafeResult).not.toContain('hooks.slack.com');
    expect(serializedUnsafeResult).not.toContain('do-not-echo');
  });

  it('rejects accessor and proxy-poisoned invocation inputs before invoking traps or callbacks', () => {
    const getterSpy = vi.fn(() => 'slack-delivery-adapter');
    const proxyGetSpy = vi.fn();
    const proxyOwnKeysSpy = vi.fn();
    const proxyGetOwnPropertyDescriptorSpy = vi.fn();
    const proxyGetPrototypeOfSpy = vi.fn();
    const executionBoundary = { ...makeExecutionBoundary() };
    Object.defineProperty(executionBoundary, 'adapterId', {
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

    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary: executionBoundary as ReturnType<typeof makeExecutionBoundary>,
      adapterFacts: makeInvocationFacts(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'adapter_shape_forbidden',
      canPrepareFutureAdapterInvocation: false,
    });

    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary: makeExecutionBoundary(),
      adapterFacts: makeInvocationFacts(),
      transport: proxyValue,
    } as unknown as Parameters<typeof evaluateMessagingAdapterInvocationImplementationBoundary>[0])).toMatchObject({
      status: 'blocked',
      reason: 'adapter_shape_forbidden',
      canPrepareFutureAdapterInvocation: false,
    });

    expect(evaluateRawMessagingAdapterInvocationImplementationBoundary(new Proxy({
      executionBoundary: makeExecutionBoundary(),
      adapterFacts: makeInvocationFacts(),
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
    }) as unknown as Parameters<typeof evaluateRawMessagingAdapterInvocationImplementationBoundary>[0])).toMatchObject({
      status: 'blocked',
      reason: 'adapter_shape_forbidden',
      canPrepareFutureAdapterInvocation: false,
    });

    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary: proxyValue as unknown as ReturnType<typeof makeExecutionBoundary>,
      adapterFacts: makeInvocationFacts(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'adapter_shape_forbidden',
      canPrepareFutureAdapterInvocation: false,
    });

    expect(getterSpy).not.toHaveBeenCalled();
    expect(proxyGetSpy).not.toHaveBeenCalled();
    expect(proxyOwnKeysSpy).not.toHaveBeenCalled();
    expect(proxyGetOwnPropertyDescriptorSpy).not.toHaveBeenCalled();
    expect(proxyGetPrototypeOfSpy).not.toHaveBeenCalled();
  });

  it('blocks stale execution, adapter facts, and executable contracts even when provenance matches', () => {
    const executionBoundary = trustedExecutionBoundaryCopy(makeExecutionBoundary(), { planExpiresAt: NOW - 1 });
    const adapterFacts = makeInvocationFacts({ planExpiresAt: NOW - 1 });

    expect(evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary,
      adapterFacts,
      adapter: makeExecutableContract({ planExpiresAt: NOW - 1 }),
      now: NOW,
    })).toMatchObject({
      status: 'blocked',
      reason: 'execution_boundary_expired',
      canPrepareFutureAdapterInvocation: false,
      executable: false,
      willInvokeAdapter: false,
    });
  });

  it('rejects non-http URL-shaped identifiers in invocation facts and executable contracts', () => {
    const executionBoundary = makeExecutionBoundary();
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
      const decision = evaluateMessagingAdapterInvocationImplementationBoundary({
        executionBoundary,
        adapterFacts: makeInvocationFacts({ adapterImplementationId: identifier }),
      });
      const serialized = JSON.stringify(decision);

      expect(decision).toMatchObject({
        status: 'blocked',
        reason: 'adapter_facts_unreviewed',
        canPrepareFutureAdapterInvocation: false,
      });
      expect(serialized).not.toContain(identifier);
      expect(serialized).not.toContain('do-not-echo');
    }

    const webhookHostDecision = evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary,
      adapterFacts: makeInvocationFacts(),
      adapter: makeExecutableContract({ adapterImplementationId: 'hooks.slack.com/services/T000/B000/do-not-echo' }),
    });
    const serializedWebhookHostDecision = JSON.stringify(webhookHostDecision);
    expect(webhookHostDecision.status).toBe('blocked');
    expect(serializedWebhookHostDecision).not.toContain('hooks.slack.com');
    expect(serializedWebhookHostDecision).not.toContain('do-not-echo');
  });

  it('blocks token-shaped or unredacted target material without fetch, socket, webhook, Slack SDK, or storage calls', () => {
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

    const decision = evaluateMessagingAdapterInvocationImplementationBoundary({
      executionBoundary: makeExecutionBoundary(),
      adapterFacts: {
        ...makeInvocationFacts(),
        adapterImplementationId: 'xoxb-do-not-keep-adapter-token',
        target: {
          kind: 'slack-channel',
          redaction: 'target-id-omitted',
          webhookUrl: 'https://hooks.slack.com/services/T000/B000/do-not-echo',
        },
      },
    });
    const serialized = JSON.stringify(decision);

    expect(decision).toMatchObject({
      status: 'blocked',
      reason: 'adapter_shape_forbidden',
      executable: false,
      adapterCallable: false,
      willInvokeAdapter: false,
      willPostMessage: false,
      willCallWebhook: false,
      willStoreCredential: false,
    });
    expect(serialized).not.toContain('xoxb');
    expect(serialized).not.toContain('do-not-keep');
    expect(serialized).not.toContain('hooks.slack.com');
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
