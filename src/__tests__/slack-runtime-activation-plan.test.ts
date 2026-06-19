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
  createMessagingAdapterInvocationFacts,
  createMessagingAdapterInvocationImplementationInput,
  evaluateMessagingAdapterInvocationImplementationBoundary,
  type MessagingAdapterInvocationFacts,
} from '../lib/messaging-adapter-invocation-implementation-boundary';
import {
  createMessagingDeliveryExecutionAdapterFacts,
  createMessagingDeliveryExecutionBoundaryInput,
  evaluateMessagingDeliveryExecutionBoundary,
  type MessagingDeliveryExecutionAdapterFacts,
} from '../lib/messaging-delivery-execution-boundary';
import type { MessagingExecutionGateInput, MessagingExecutionNoiseLimits } from '../lib/messaging-execution-gate';
import type { MessagingRuntimeReadinessInput } from '../lib/messaging-runtime-readiness';
import {
  createRuntimeTrustedContractObject,
  type RuntimeTrustedContractEntry,
  type RuntimeTrustedContractValue,
} from '../lib/runtime-trusted-contract-object';
import {
  evaluateSlackLiveDeliveryActivationGate,
  type SlackLiveDeliveryIntent,
  type SlackLiveDeliveryNoisePolicy,
  type SlackLiveDeliveryReviewedConsent,
  type SlackLiveDeliveryReviewedTarget,
} from '../lib/slack-live-delivery-activation-gate';
import { evaluateSlackRuntimeActivationPlan } from '../lib/slack-runtime-activation-plan';

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

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function credentialReference(
  overrides: Partial<ConnectorCredentialReference> = {},
): ConnectorCredentialReference {
  return {
    schemaVersion: 1,
    kind: 'external-secret-store',
    id: 'vault:messaging/slack/workspace-1',
    storageOwner: 'external-secret-store',
    providerId: 'slack',
    connectorId: 'messaging',
    accountId: 'workspace-1',
    displayName: 'Slack workspace credential reference',
    createdAt: NOW - 10_000,
    ...overrides,
  };
}

function reviewedTarget(
  overrides: Partial<SlackLiveDeliveryReviewedTarget> = {},
): SlackLiveDeliveryReviewedTarget {
  return {
    contract: 'slack-live-delivery-reviewed-target-v1',
    connectorKind: 'slack',
    workspaceId: 'workspace-1',
    workspaceLabel: 'Analyst Workspace',
    targetKind: 'workspace-channel',
    eventScope: 'channel-follow-up',
    targetId: 'channel-case-alerts',
    targetLabel: 'Case alerts',
    targetProvenance: 'reviewed-workspace-target',
    reviewState: 'reviewed',
    targetReviewed: true,
    ...overrides,
  };
}

function reviewedConsent(
  overrides: Partial<SlackLiveDeliveryReviewedConsent> = {},
): SlackLiveDeliveryReviewedConsent {
  return {
    contract: 'slack-live-delivery-reviewed-consent-v1',
    connectorKind: 'slack',
    workspaceId: 'workspace-1',
    targetId: 'channel-case-alerts',
    eventScope: 'channel-follow-up',
    messageClass: 'ioc-alert',
    explicitUserConsent: true,
    granted: true,
    reviewed: true,
    noAutoPost: true,
    requiresUserApprovalBeforePost: true,
    issuedAt: NOW - 1_000,
    expiresAt: NOW + 60_000,
    ...overrides,
  };
}

function noisePolicy(
  overrides: Partial<SlackLiveDeliveryNoisePolicy> = {},
): SlackLiveDeliveryNoisePolicy {
  return {
    contract: 'slack-live-delivery-noise-policy-v1',
    connectorKind: 'slack',
    eventScope: 'channel-follow-up',
    reviewState: 'reviewed',
    rateLimitReviewed: true,
    quietHoursReviewed: true,
    maxDeliveriesPerHour: 3,
    maxRecipientsPerDelivery: 1,
    suppressDuplicateThreadReplies: true,
    requireExplicitCaseMentionForChannels: true,
    noBurstDelivery: true,
    ...overrides,
  };
}

function deliveryIntent(
  overrides: Partial<SlackLiveDeliveryIntent> = {},
): SlackLiveDeliveryIntent {
  return {
    contract: 'slack-live-delivery-intent-v1',
    connectorKind: 'slack',
    workspaceId: 'workspace-1',
    targetId: 'channel-case-alerts',
    eventScope: 'channel-follow-up',
    messageClass: 'ioc-alert',
    actionIntent: 'post-message',
    reviewed: true,
    notificationOnly: true,
    noAutoPost: true,
    requiresUserApprovalBeforePost: true,
    ...overrides,
  };
}

function makeRuntimeInput(
  overrides: Partial<MessagingRuntimeReadinessInput> = {},
): MessagingRuntimeReadinessInput {
  return {
    connectorAvailable: true,
    connectorKind: 'slack',
    credentialReference: credentialReference({
      id: 'vault:messaging/slack/workspace-1',
      accountId: 'workspace-1',
    }),
    eventScope: 'channel-follow-up',
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
    supportedEventScopes: ['channel-follow-up'],
    target: {
      kind: 'slack-channel',
      targetId: 'C01CASEALERTS',
      displayName: 'Sensitive target display',
    },
    credentialReference: {
      id: 'vault:messaging/slack/workspace-1',
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
    eventScope: 'channel-follow-up',
    targetKind: 'slack-channel',
    targetId: 'C01CASEALERTS',
    credentialReferenceId: 'vault:messaging/slack/workspace-1',
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
    eventScope: 'channel-follow-up',
    credentialReferenceId: 'vault:messaging/slack/workspace-1',
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
    ? trustedObject<Record<string, unknown>>(Object.entries(result.safeDetails).map(([key, value]) => (
        [key, value as RuntimeTrustedContractValue] satisfies RuntimeTrustedContractEntry
      )))
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

function makeExecutionAdapterFacts(
  overrides: Partial<MessagingDeliveryExecutionAdapterFacts> = {},
): MessagingDeliveryExecutionAdapterFacts {
  const facts = {
    contract: 'messaging-delivery-execution-adapter-facts-v1',
    adapterId: 'slack-delivery-adapter',
    runtimeOwner: 'assistantcaddy-messaging-runtime',
    action: 'dry-run-notification',
    connectorKind: 'slack',
    eventScope: 'channel-follow-up',
    credentialReferenceId: 'vault:messaging/slack/workspace-1',
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

function makeInvocationFacts(
  overrides: Partial<MessagingAdapterInvocationFacts> = {},
): MessagingAdapterInvocationFacts {
  const facts = {
    contract: 'messaging-adapter-invocation-implementation-facts-v1',
    adapterId: 'slack-delivery-adapter',
    runtimeOwner: 'assistantcaddy-messaging-runtime',
    action: 'dry-run-notification',
    connectorKind: 'slack',
    eventScope: 'channel-follow-up',
    credentialReferenceId: 'vault:messaging/slack/workspace-1',
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

function makeDryRunHarness(
  plan: MessagingDeliveryAdapterPlan = makePlan(),
  result: MessagingAdapterDryRunResult = makeDryRunResult(),
) {
  return bindMessagingAdapterDryRunResult(createMessagingAdapterDryRunHarnessInput([
    ['plan', plan as unknown as RuntimeTrustedContractValue],
    ['dryRunResult', result as unknown as RuntimeTrustedContractValue],
  ]));
}

function makeExecutionBoundary(
  plan: MessagingDeliveryAdapterPlan = makePlan(),
  dryRunHarness: ReturnType<typeof makeDryRunHarness> = makeDryRunHarness(plan),
) {
  return evaluateMessagingDeliveryExecutionBoundary(createMessagingDeliveryExecutionBoundaryInput([
    ['plan', plan as unknown as RuntimeTrustedContractValue],
    ['dryRunHarness', dryRunHarness as unknown as RuntimeTrustedContractValue],
    ['adapterFacts', makeExecutionAdapterFacts() as unknown as RuntimeTrustedContractValue],
  ]));
}

function readyActivationGate() {
  return evaluateSlackLiveDeliveryActivationGate(trustedObject<Record<string, unknown>>([
    ['reviewedTarget', trustedFixtureValue(reviewedTarget())],
    ['reviewedConsent', trustedFixtureValue(reviewedConsent())],
    ['credentialReference', trustedFixtureValue(credentialReference())],
    ['noisePolicy', trustedFixtureValue(noisePolicy())],
    ['deliveryIntent', trustedFixtureValue(deliveryIntent())],
    ['now', NOW],
  ]));
}

function readyInvocationBoundary() {
  const plan = makePlan();
  const dryRunHarness = makeDryRunHarness(plan);
  return evaluateMessagingAdapterInvocationImplementationBoundary(createMessagingAdapterInvocationImplementationInput([
    ['executionBoundary', makeExecutionBoundary(plan, dryRunHarness) as unknown as RuntimeTrustedContractValue],
    ['dryRunHarness', dryRunHarness as unknown as RuntimeTrustedContractValue],
    ['adapterFacts', makeInvocationFacts() as unknown as RuntimeTrustedContractValue],
  ]));
}

describe('slack runtime activation plan binding', () => {
  it('returns a frozen non-executable runtime activation plan after revalidating the reviewed activation plan and runtime boundary', () => {
    const decision = evaluateSlackRuntimeActivationPlan({
      activationGate: readyActivationGate(),
      invocationBoundary: readyInvocationBoundary(),
      now: NOW,
    });

    expect(decision).toEqual({
      status: 'ready',
      ready: true,
      reason: 'slack_runtime_activation_plan_ready',
      plan: {
        contract: 'slack-runtime-activation-plan-v1',
        connectorKind: 'slack',
        workspaceId: 'workspace-1',
        notificationScope: 'channel-follow-up',
        messageClass: 'ioc-alert',
        actionIntent: 'post-message',
        target: {
          kind: 'workspace-channel',
          runtimeTargetKind: 'slack-channel',
          id: 'channel-case-alerts',
          label: 'Case alerts',
        },
        credentialReference: {
          id: 'vault:messaging/slack/workspace-1',
          kind: 'external-secret-store',
          storageOwner: 'external-secret-store',
          providerId: 'slack',
          connectorId: 'messaging',
          accountId: 'workspace-1',
        },
        consentWindow: {
          issuedAt: NOW - 1_000,
          expiresAt: NOW + 60_000,
        },
        runtimeBinding: {
          adapterId: 'slack-delivery-adapter',
          runtimeOwner: 'assistantcaddy-messaging-runtime',
          sourceAction: 'dry-run-notification',
          adapterImplementationId: 'slack-adapter-package-boundary',
          adapterVersion: '2026-06-12.1',
          invocationMode: 'decision-only',
          targetRedaction: 'target-id-omitted',
          runtimePlanExpiresAt: NOW + 60_000,
        },
        reviewedTarget: true,
        reviewedConsent: true,
        reviewedNoisePolicy: true,
        reviewedDeliveryIntent: true,
        noAutoPost: true,
        notificationOnly: true,
        requiresUserApprovalBeforePost: true,
        requiresExplicitSendApproval: true,
        executable: false,
        sideEffects: 'none',
        sideEffectBoundary: 'slack-runtime-activation-plan-only-no-slack-api-no-webhook-no-fetch-no-socket-no-storage-no-send',
      },
      canPrepareFutureSlackRuntimeActivation: true,
      executable: false,
      sideEffects: 'none',
      requiresExplicitSendApproval: true,
      willCallSlackApi: false,
      willCallWebhook: false,
      willFetch: false,
      willOpenSocket: false,
      willMutateStorage: false,
      willStoreCredential: false,
      willPostMessage: false,
      willPostThreadReply: false,
      sideEffectBoundary: 'slack-runtime-activation-plan-binding-no-slack-api-no-webhook-no-fetch-no-socket-no-storage-no-send',
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.plan)).toBe(true);
    expect(Object.isFrozen(decision.plan?.target)).toBe(true);
    expect(Object.isFrozen(decision.plan?.credentialReference)).toBe(true);
    expect(Object.isFrozen(decision.plan?.runtimeBinding)).toBe(true);
  });

  it('supports reviewed generic-webhook activation metadata only as a non-executable explicit-send plan', () => {
    const activationGate = {
      ...readyActivationGate(),
      plan: {
        ...readyActivationGate().plan!,
        connectorKind: 'generic-webhook' as const,
        workspaceId: undefined,
        target: {
          kind: 'webhook-reference' as const,
          id: 'webhook-reference-case-alerts',
          label: 'Case alert webhook reference',
        },
        eventScope: 'webhook-alert' as const,
        messageClass: 'analyst-routing' as const,
        actionIntent: 'webhook-delivery' as const,
        credentialReference: {
          id: 'macos-login:messaging/generic-webhook/workspace-1',
          kind: 'os-keychain' as const,
          storageOwner: 'operating-system' as const,
          providerId: 'generic-webhook' as const,
          connectorId: 'messaging',
          accountId: 'webhook-profile-1',
        },
      },
    };
    const invocationBoundary = {
      ...readyInvocationBoundary(),
      connectorKind: 'generic-webhook' as const,
      eventScope: 'webhook-alert' as const,
      credentialReference: {
        id: 'macos-login:messaging/generic-webhook/workspace-1',
        kind: 'os-keychain',
        storageOwner: 'operating-system',
        providerId: 'generic-webhook',
        connectorId: 'messaging',
        accountId: 'webhook-profile-1',
      },
      target: {
        kind: 'webhook-handle' as const,
        redaction: 'target-id-omitted' as const,
      },
    };

    const decision = evaluateSlackRuntimeActivationPlan({
      activationGate,
      invocationBoundary,
      now: NOW,
    });

    expect(decision).toMatchObject({
      status: 'ready',
      reason: 'slack_runtime_activation_plan_ready',
      plan: {
        connectorKind: 'generic-webhook',
        workspaceId: undefined,
        notificationScope: 'webhook-alert',
        messageClass: 'analyst-routing',
        actionIntent: 'webhook-delivery',
        target: {
          kind: 'webhook-reference',
          runtimeTargetKind: 'webhook-handle',
          id: 'webhook-reference-case-alerts',
        },
        credentialReference: {
          id: 'macos-login:messaging/generic-webhook/workspace-1',
          kind: 'os-keychain',
          storageOwner: 'operating-system',
          providerId: 'generic-webhook',
        },
        requiresExplicitSendApproval: true,
        executable: false,
      },
      willCallWebhook: false,
      willPostMessage: false,
    });
  });

  it('revalidates local target and credential ownership instead of trusting serialized ready metadata', () => {
    expect(evaluateSlackRuntimeActivationPlan({
      activationGate: readyActivationGate(),
      invocationBoundary: {
        ...readyInvocationBoundary(),
        target: {
          kind: 'slack-dm',
          redaction: 'target-id-omitted',
        },
      },
      now: NOW,
    })).toMatchObject({
      status: 'blocked',
      reason: 'target_binding_invalid',
      executable: false,
      willPostMessage: false,
    });

    expect(evaluateSlackRuntimeActivationPlan({
      activationGate: readyActivationGate(),
      invocationBoundary: {
        ...readyInvocationBoundary(),
        credentialReference: {
          ...readyInvocationBoundary().credentialReference!,
          id: 'vault:messaging/slack/other',
        },
      },
      now: NOW,
    })).toMatchObject({
      status: 'blocked',
      reason: 'credential_reference_mismatch',
      willCallWebhook: false,
    });
  });

  it('fails closed for forged executable claims and missing explicit final-send approval posture', () => {
    expect(evaluateSlackRuntimeActivationPlan({
      activationGate: {
        ...readyActivationGate(),
        plan: {
          ...readyActivationGate().plan!,
          executable: true,
        },
      },
      invocationBoundary: readyInvocationBoundary(),
      now: NOW,
    })).toMatchObject({
      status: 'blocked',
      reason: 'activation_gate_invalid',
      executable: false,
    });

    expect(evaluateSlackRuntimeActivationPlan({
      activationGate: {
        ...readyActivationGate(),
        plan: {
          ...readyActivationGate().plan!,
          requiresUserApprovalBeforePost: false,
        },
      },
      invocationBoundary: readyInvocationBoundary(),
      now: NOW,
    })).toMatchObject({
      status: 'blocked',
      reason: 'requires_explicit_send_approval',
      willPostThreadReply: false,
    });
  });

  it('fails closed at exact consent and runtime-plan expiry boundaries', () => {
    const activationExpiresAt = NOW + 30_000;
    const activationGate = {
      ...readyActivationGate(),
      plan: {
        ...readyActivationGate().plan!,
        consentWindow: {
          issuedAt: NOW - 1_000,
          expiresAt: activationExpiresAt,
        },
      },
    };

    expect(evaluateSlackRuntimeActivationPlan({
      activationGate,
      invocationBoundary: readyInvocationBoundary(),
      now: activationExpiresAt,
    })).toMatchObject({
      status: 'blocked',
      reason: 'consent_window_invalid',
      executable: false,
      willPostMessage: false,
    });

    const runtimePlanExpiresAt = NOW + 45_000;
    expect(evaluateSlackRuntimeActivationPlan({
      activationGate: readyActivationGate(),
      invocationBoundary: {
        ...readyInvocationBoundary(),
        planExpiresAt: runtimePlanExpiresAt,
      },
      now: runtimePlanExpiresAt,
    })).toMatchObject({
      status: 'blocked',
      reason: 'consent_window_invalid',
      willCallWebhook: false,
    });
  });

  it('rejects secret-bearing or employer-branded target metadata without enabling any delivery call path', () => {
    const secretDecision = evaluateSlackRuntimeActivationPlan({
      activationGate: {
        ...readyActivationGate(),
        plan: {
          ...readyActivationGate().plan!,
          target: {
            ...readyActivationGate().plan!.target,
            label: 'https://hooks.slack.com/services/T000/B000/do-not-keep',
          },
        },
      },
      invocationBoundary: readyInvocationBoundary(),
      now: NOW,
    });

    expect(secretDecision).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
      executable: false,
      willCallSlackApi: false,
      willCallWebhook: false,
    });
    expect(JSON.stringify(secretDecision)).not.toContain('hooks.slack.com');

    const brandedDecision = evaluateSlackRuntimeActivationPlan({
      activationGate: {
        ...readyActivationGate(),
        plan: {
          ...readyActivationGate().plan!,
          target: {
            ...readyActivationGate().plan!.target,
            label: 'VENDOR SOC alerts',
          },
        },
      },
      invocationBoundary: readyInvocationBoundary(),
      now: NOW,
    });

    expect(brandedDecision).toMatchObject({
      status: 'blocked',
      reason: 'VENDOR_or_employer_branding_forbidden',
      willPostMessage: false,
    });
  });
});
