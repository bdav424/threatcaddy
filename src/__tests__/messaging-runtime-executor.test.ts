import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
import {
  executeMessagingRuntimeAction as executeMessagingRuntimeActionRaw,
  type MessagingRuntimeExecutionAdapter,
} from '../lib/messaging-runtime-executor';
import type { MessagingExecutionGateInput, MessagingExecutionNoiseLimits } from '../lib/messaging-execution-gate';
import type { MessagingRuntimeReadinessInput } from '../lib/messaging-runtime-readiness';
import {
  createRuntimeTrustedContractObject,
  type RuntimeTrustedContractObject,
  type RuntimeTrustedContractValue,
} from '../lib/runtime-trusted-contract-object';

const NOW = 1_800_000_000_000;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

function makeRuntimeActivationPlan(overrides: {
  decision?: Record<string, unknown>;
  plan?: Record<string, unknown>;
  target?: Record<string, unknown>;
  credentialReference?: Record<string, unknown>;
  consentWindow?: Record<string, unknown>;
  runtimeBinding?: Record<string, unknown>;
} = {}) {
  const plan = {
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
      ...overrides.target,
    },
    credentialReference: {
      id: 'vault:messaging/slack/case-alerts',
      kind: 'external-secret-store',
      storageOwner: 'external-secret-store',
      providerId: 'slack',
      connectorId: 'messaging',
      accountId: 'workspace-1',
      ...overrides.credentialReference,
    },
    consentWindow: {
      issuedAt: NOW - 1_000,
      expiresAt: NOW + 60_000,
      ...overrides.consentWindow,
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
      ...overrides.runtimeBinding,
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
    ...overrides.plan,
  };

  return {
    status: 'ready',
    ready: true,
    reason: 'slack_runtime_activation_plan_ready',
    plan,
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
    ...overrides.decision,
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
  if (Array.isArray(value)) return value.map((entry) => trustedValue(entry));
  if (typeof value === 'function') return 'function-redacted';
  if (typeof value === 'object') {
    return createRuntimeTrustedContractObject(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, trustedValue(nested)] as const),
    );
  }
  return undefined;
}

function trustedObject<T extends Record<string, unknown>>(value: T): RuntimeTrustedContractObject {
  return trustedValue(value) as RuntimeTrustedContractObject;
}

function trustedRuntimeInput(value: Record<string, unknown>): Parameters<typeof executeMessagingRuntimeActionRaw>[0] {
  return trustedObject(value) as unknown as Parameters<typeof executeMessagingRuntimeActionRaw>[0];
}

function executeMessagingRuntimeAction(value: Record<string, unknown>) {
  return executeMessagingRuntimeActionRaw(trustedRuntimeInput(value));
}

function callableAdapter(fields: Record<string, unknown>): MessagingRuntimeExecutionAdapter {
  void fields;
  return trustedObject({
    adapterCallableBoundary: 'source-gated-no-callable-adapter-facade',
  }) as unknown as MessagingRuntimeExecutionAdapter;
}

function fakeLocalTestAdapter(
  overrides: Partial<MessagingRuntimeExecutionAdapter> = {},
): MessagingRuntimeExecutionAdapter {
  return trustedObject({
    adapterKind: 'fake-local-test-delivery-adapter',
    adapterId: 'slack-delivery-adapter',
    runtimeOwner: 'assistantcaddy-messaging-runtime',
    adapterImplementationId: 'slack-adapter-package-boundary',
    adapterVersion: '2026-06-12.1',
    deliveryMode: 'fake-local-test-only',
    resultMode: 'metadata-only',
    sideEffects: 'none',
    sideEffectBoundary: 'adapter-injected-no-fetch-no-sdk-no-webhook-no-storage-by-facade',
    ...overrides,
  }) as unknown as MessagingRuntimeExecutionAdapter;
}

describe('messaging runtime executor facade', () => {
  it('executes a fake local test delivery adapter as metadata without live side effects or payload echo', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const result = await executeMessagingRuntimeAction({
      gateInput: makeGateInput(),
      runtimeActivationPlan: makeRuntimeActivationPlan(),
      now: NOW,
      adapter: fakeLocalTestAdapter(),
      expectation: {
        connectorKind: 'slack',
        eventScope: 'channel-follow-up',
        credentialReference: {
          id: 'vault:messaging/slack/case-alerts',
          kind: 'external-secret-store',
          storageOwner: 'external-secret-store',
          providerId: 'slack',
          connectorId: 'messaging',
          accountId: 'workspace-1',
        },
      },
      payload: { previewText: 'Case opened for local fake delivery' },
    });

    expect(result).toMatchObject({
      status: 'executed',
      reason: 'executed',
      action: 'dry-run-notification',
      gateReason: 'dry_run_notification_allowed',
      connectorKind: 'slack',
      eventScope: 'channel-follow-up',
      target: {
        kind: 'workspace-channel',
        runtimeTargetKind: 'slack-channel',
        redaction: 'target-id-omitted',
        workspaceId: 'workspace-1',
      },
      adapterRunId: 'slack-delivery-adapter.fake-local.1799999999000',
      safeDetails: {
        adapterImplementationId: 'slack-adapter-package-boundary',
        adapterVersion: '2026-06-12.1',
        deliveryMode: 'fake-local-test-only',
        noLiveDelivery: true,
        payloadEcho: false,
        resultMode: 'metadata-only',
        targetRedaction: 'target-id-omitted',
      },
      sideEffectBoundary: 'adapter-injected-no-fetch-no-sdk-no-webhook-no-storage-by-facade',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('Case opened');
    expect(JSON.stringify(result)).not.toContain('xoxb');
  });

  it('blocks callable-looking dry-run adapters after the execution gate and ownership checks pass', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const dryRunNotification = vi.fn().mockResolvedValue({
      adapterRunId: 'dry-run-1',
      safeDetails: {
        rendered: true,
        channel: 'case-alerts',
        nested: { unsafe: 'omitted' },
      },
    });
    const adapter = callableAdapter({ dryRunNotification });

    const result = await executeMessagingRuntimeAction({
      gateInput: makeGateInput(),
      runtimeActivationPlan: makeRuntimeActivationPlan(),
      now: NOW,
      adapter,
      expectation: {
        connectorKind: 'slack',
        eventScope: 'channel-follow-up',
        credentialReference: {
          id: 'vault:messaging/slack/case-alerts',
          kind: 'external-secret-store',
          storageOwner: 'external-secret-store',
          providerId: 'slack',
          connectorId: 'messaging',
          accountId: 'workspace-1',
        },
      },
      payload: { previewText: 'Case opened' },
    });

    expect(result).toMatchObject({
      status: 'blocked',
      reason: 'adapter_execution_not_enabled',
      action: 'dry-run-notification',
      gateReason: 'dry_run_notification_allowed',
      connectorKind: 'slack',
      eventScope: 'channel-follow-up',
      target: {
        kind: 'workspace-channel',
        runtimeTargetKind: 'slack-channel',
        redaction: 'target-id-omitted',
        workspaceId: 'workspace-1',
      },
      credentialReference: {
        id: 'vault:messaging/slack/case-alerts',
        kind: 'external-secret-store',
        storageOwner: 'external-secret-store',
        providerId: 'slack',
        connectorId: 'messaging',
        accountId: 'workspace-1',
      },
      sideEffectBoundary: 'adapter-injected-no-fetch-no-sdk-no-webhook-no-storage-by-facade',
    });
    expect(result.adapterRunId).toBeUndefined();
    expect(result.safeDetails).toBeUndefined();
    expect(dryRunNotification).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('xoxb');
  });

  it('rejects secret-like adapter run identifiers without echoing them', async () => {
    const dryRunNotification = vi.fn().mockResolvedValue({
      adapterRunId: 'xoxb-do-not-keep',
      safeDetails: {
        rendered: true,
      },
    });

    const result = await executeMessagingRuntimeAction({
      gateInput: makeGateInput(),
      runtimeActivationPlan: makeRuntimeActivationPlan(),
      now: NOW,
      adapter: callableAdapter({ dryRunNotification }),
      expectation: {
        connectorKind: 'slack',
        eventScope: 'channel-follow-up',
        credentialReference: {
          id: 'vault:messaging/slack/case-alerts',
          kind: 'external-secret-store',
          storageOwner: 'external-secret-store',
          providerId: 'slack',
          connectorId: 'messaging',
          accountId: 'workspace-1',
        },
      },
    });

    expect(result.status).toBe('blocked');
    expect(result.reason).toBe('adapter_execution_not_enabled');
    expect(result.adapterRunId).toBeUndefined();
    expect(dryRunNotification).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('xoxb');
  });

  it('blocks disable and revoke callable adapters without invoking methods', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const disableConnector = vi.fn().mockResolvedValue({
      action: 'disable-connector',
      connectorKind: 'slack',
      eventScope: 'channel-follow-up',
      credentialReferenceId: 'vault:messaging/slack/case-alerts',
      adapterRunId: 'disable-run-1',
      safeDetails: { disabled: true },
    });
    const revokeCredentialReference = vi.fn().mockResolvedValue({
      action: 'revoke-credential-reference',
      connectorKind: 'slack',
      eventScope: 'channel-follow-up',
      credentialReferenceId: 'vault:messaging/slack/case-alerts',
      adapterRunId: 'revoke-run-1',
      safeDetails: { revoked: true },
    });
    const adapter = callableAdapter({
      dryRunNotification: vi.fn(),
      disableConnector,
      revokeCredentialReference,
    });

    const disableResult = await executeMessagingRuntimeAction({
      gateInput: makeGateInput({ action: 'disable-connector' }),
      adapter,
    });
    const revokeResult = await executeMessagingRuntimeAction({
      gateInput: makeGateInput({ action: 'revoke-credential-reference' }),
      adapter,
    });

    expect(disableResult).toMatchObject({
      status: 'blocked',
      reason: 'adapter_execution_not_enabled',
      action: 'disable-connector',
    });
    expect(revokeResult).toMatchObject({
      status: 'blocked',
      reason: 'adapter_execution_not_enabled',
      action: 'revoke-credential-reference',
    });
    expect(disableResult.adapterRunId).toBeUndefined();
    expect(revokeResult.adapterRunId).toBeUndefined();
    expect(disableConnector).not.toHaveBeenCalled();
    expect(revokeCredentialReference).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('does not call the adapter when the existing gate blocks live delivery actions', async () => {
    for (const action of ['post-message', 'post-thread-reply', 'webhook-delivery'] as const) {
      const adapter = {
        dryRunNotification: vi.fn(),
        disableConnector: vi.fn(),
        revokeCredentialReference: vi.fn(),
      };

      const result = await executeMessagingRuntimeAction({
        gateInput: makeGateInput({ action }),
        adapter: callableAdapter(adapter),
      });

      expect(result).toMatchObject({
        status: 'blocked',
        reason: 'live_delivery_disabled_by_no_auto_post_contract',
        action,
        gateReason: 'live_delivery_disabled_by_no_auto_post_contract',
      });
      expect(adapter.dryRunNotification).not.toHaveBeenCalled();
      expect(adapter.disableConnector).not.toHaveBeenCalled();
      expect(adapter.revokeCredentialReference).not.toHaveBeenCalled();
    }
  });

  it('blocks allowed actions when the injected adapter or requested adapter method is missing', async () => {
    await expect(executeMessagingRuntimeAction({
      gateInput: makeGateInput(),
      runtimeActivationPlan: makeRuntimeActivationPlan(),
      now: NOW,
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'missing_adapter',
      action: 'dry-run-notification',
    });

    await expect(executeMessagingRuntimeAction({
      gateInput: makeGateInput({ action: 'disable-connector' }),
      adapter: callableAdapter({ dryRunNotification: vi.fn() }),
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'adapter_execution_not_enabled',
      action: 'disable-connector',
    });

    await expect(executeMessagingRuntimeAction({
      gateInput: makeGateInput(),
      runtimeActivationPlan: makeRuntimeActivationPlan(),
      now: NOW,
      adapter: trustedObject({
        adapterCallableBoundary: 'source-gated-no-callable-adapter-facade',
        webhookUrl: 'https://hooks.slack.com/services/T000/B000/do-not-keep',
      }) as unknown as MessagingRuntimeExecutionAdapter,
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'adapter_shape_invalid',
      action: 'dry-run-notification',
    });
  });

  it('blocks connector kind, event scope, and credential ownership mismatches before adapter execution', async () => {
    const dryRunNotification = vi.fn();
    const adapter = callableAdapter({ dryRunNotification });

    await expect(executeMessagingRuntimeAction({
      gateInput: makeGateInput(),
      adapter,
      expectation: { connectorKind: 'generic-webhook' },
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'connector_kind_mismatch',
    });

    await expect(executeMessagingRuntimeAction({
      gateInput: makeGateInput(),
      adapter,
      expectation: { eventScope: 'webhook-alert' },
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'event_scope_mismatch',
    });

    await expect(executeMessagingRuntimeAction({
      gateInput: makeGateInput(),
      adapter,
      expectation: {
        credentialReference: { id: 'vault:messaging/slack/other' },
      },
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'credential_reference_mismatch',
    });

    await expect(executeMessagingRuntimeAction({
      gateInput: makeGateInput(),
      adapter,
      expectation: {
        credentialReference: { providerId: 'generic-webhook' },
      },
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'credential_ownership_mismatch',
    });

    expect(dryRunNotification).not.toHaveBeenCalled();
  });

  it('requires the dry-run runtime activation plan to match target, consent, credential, and invocation provenance', async () => {
    const dryRunNotification = vi.fn();
    const adapter = callableAdapter({ dryRunNotification });

    await expect(executeMessagingRuntimeAction({
      gateInput: makeGateInput(),
      adapter,
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'runtime_activation_plan_missing',
    });

    await expect(executeMessagingRuntimeAction({
      gateInput: makeGateInput(),
      runtimeActivationPlan: makeRuntimeActivationPlan({
        decision: { executable: true },
      }),
      now: NOW,
      adapter,
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'runtime_activation_plan_invalid',
    });

    await expect(executeMessagingRuntimeAction({
      gateInput: makeGateInput(),
      runtimeActivationPlan: makeRuntimeActivationPlan({
        plan: { workspaceId: 'workspace-2' },
        credentialReference: { accountId: 'workspace-2' },
      }),
      now: NOW,
      adapter,
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'runtime_activation_plan_mismatch',
      target: {
        kind: 'workspace-channel',
        runtimeTargetKind: 'slack-channel',
        redaction: 'target-id-omitted',
        workspaceId: 'workspace-2',
      },
    });

    await expect(executeMessagingRuntimeAction({
      gateInput: makeGateInput(),
      runtimeActivationPlan: makeRuntimeActivationPlan({
        runtimeBinding: {
          invocationMode: 'callback',
        },
      }),
      now: NOW,
      adapter,
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'runtime_activation_plan_invalid',
    });

    expect(dryRunNotification).not.toHaveBeenCalled();
  });

  it('fails closed for forged allow decisions without runtime context and for forged live-delivery allow decisions', async () => {
    const dryRunNotification = vi.fn();
    const adapter = callableAdapter({ dryRunNotification });

    await expect(executeMessagingRuntimeAction({
      gateDecision: {
        decision: 'allow',
        action: 'dry-run-notification',
        reason: 'dry_run_notification_allowed',
        inert: true,
        executesProviderCall: false,
        noAutoPost: true,
        eventScope: 'channel-follow-up',
        sideEffectBoundary: 'pure-local-no-fetch-no-webhook-no-slack-api-no-storage-no-send',
      },
      adapter,
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'gate_decision_missing_context',
      action: 'unsupported',
      gateReason: 'unsupported_action',
      connectorKind: undefined,
      eventScope: undefined,
    });

    await expect(executeMessagingRuntimeAction({
      gateDecision: {
        decision: 'allow',
        action: 'post-message',
        reason: 'dry_run_notification_allowed',
        inert: true,
        executesProviderCall: false,
        noAutoPost: true,
        eventScope: 'channel-follow-up',
        sideEffectBoundary: 'pure-local-no-fetch-no-webhook-no-slack-api-no-storage-no-send',
      },
      gateInput: makeGateInput(),
      adapter,
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'gate_decision_invalid',
      action: 'dry-run-notification',
    });

    await expect(executeMessagingRuntimeAction({
      gateDecision: {
        decision: 'allow',
        action: 'disable-connector',
        reason: 'manual_control_allowed',
        inert: true,
        executesProviderCall: false,
        noAutoPost: true,
        runtimeStatus: 'explicit-user-test-ready',
        runtimeReason: 'explicit_user_test_ready',
        eventScope: 'channel-follow-up',
        sideEffectBoundary: 'pure-local-no-fetch-no-webhook-no-slack-api-no-storage-no-send',
      },
      gateInput: makeGateInput(),
      adapter,
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'gate_decision_invalid',
      action: 'dry-run-notification',
    });

    expect(dryRunNotification).not.toHaveBeenCalled();
  });

  it('rejects unsafe callback, requester, fetch, socket, storage, and live-action fields before adapter handoff', async () => {
    for (const unsafeInput of [
      {
        gateInput: makeGateInput(),
        runtimeActivationPlan: makeRuntimeActivationPlan(),
        now: NOW,
        payload: { callback: vi.fn() },
      },
      {
        gateInput: makeGateInput(),
        runtimeActivationPlan: makeRuntimeActivationPlan(),
        now: NOW,
        payload: { requester: { host: '127.0.0.1' } },
      },
      {
        gateInput: makeGateInput(),
        runtimeActivationPlan: makeRuntimeActivationPlan(),
        now: NOW,
        payload: { fetchPlan: { method: 'POST' } },
      },
      {
        gateInput: makeGateInput(),
        runtimeActivationPlan: makeRuntimeActivationPlan(),
        now: NOW,
        payload: { socketPlan: { host: '127.0.0.1' } },
      },
      {
        gateInput: makeGateInput(),
        runtimeActivationPlan: makeRuntimeActivationPlan(),
        now: NOW,
        payload: { storageAdapter: { kind: 'localStorage' } },
      },
      {
        gateInput: makeGateInput(),
        runtimeActivationPlan: makeRuntimeActivationPlan(),
        now: NOW,
        payload: { liveAction: 'post-now' },
      },
      {
        gateInput: makeGateInput(),
        gateDecision: {
          decision: 'allow',
          action: 'dry-run-notification',
          reason: 'dry_run_notification_allowed',
          inert: true,
          executesProviderCall: false,
          noAutoPost: true,
          runtimeStatus: 'explicit-user-test-ready',
          runtimeReason: 'explicit_user_test_ready',
          eventScope: 'channel-follow-up',
          sideEffectBoundary: 'pure-local-no-fetch-no-webhook-no-slack-api-no-storage-no-send',
          willCallWebhook: true,
        },
        runtimeActivationPlan: makeRuntimeActivationPlan(),
        now: NOW,
      },
    ]) {
      const dryRunNotification = vi.fn();
      const adapter = callableAdapter({ dryRunNotification });
      const result = await executeMessagingRuntimeAction({
        ...unsafeInput,
        adapter,
      } as never);

      expect(result).toMatchObject({
        status: 'blocked',
        reason: 'unsafe_runtime_shape',
      });
      expect(dryRunNotification).not.toHaveBeenCalled();
    }
  });

  it('rejects unsafe or accessor-poisoned executor roots before reading gate inputs or adapters', async () => {
    const gateInputGetter = vi.fn(() => makeGateInput());
    const adapterCallback = vi.fn();
    const unsafeRoot: Record<string, unknown> = {
      adapter: { dryRunNotification: adapterCallback },
      callback: 'blocked',
    };
    Object.defineProperty(unsafeRoot, 'gateInput', {
      enumerable: true,
      get: gateInputGetter,
    });

    const unsafeRootResult = await executeMessagingRuntimeActionRaw(unsafeRoot as never);

    expect(unsafeRootResult).toMatchObject({
      status: 'blocked',
      reason: 'unsafe_runtime_shape',
      action: 'unsupported',
    });
    expect(gateInputGetter).not.toHaveBeenCalled();
    expect(adapterCallback).not.toHaveBeenCalled();

    const exactShapeGateGetter = vi.fn(() => makeGateInput());
    const exactShapeRoot: Record<string, unknown> = {
      adapter: { dryRunNotification: adapterCallback },
      runtimeActivationPlan: makeRuntimeActivationPlan(),
      now: NOW,
    };
    Object.defineProperty(exactShapeRoot, 'gateInput', {
      enumerable: true,
      get: exactShapeGateGetter,
    });

    const exactShapeResult = await executeMessagingRuntimeActionRaw(exactShapeRoot as never);

    expect(exactShapeResult).toMatchObject({
      status: 'blocked',
      reason: 'unsafe_runtime_shape',
      action: 'unsupported',
    });
    expect(exactShapeGateGetter).not.toHaveBeenCalled();
    expect(adapterCallback).not.toHaveBeenCalled();
  });

  it('rejects root and nested adapter proxies without executing proxy traps', async () => {
    const rootTrapCounters = {
      get: vi.fn(),
      getOwnPropertyDescriptor: vi.fn(),
      getPrototypeOf: vi.fn(),
      ownKeys: vi.fn(),
    };
    const rootProxy = new Proxy({
      gateInput: makeGateInput(),
      runtimeActivationPlan: makeRuntimeActivationPlan(),
      now: NOW,
      adapter: fakeLocalTestAdapter(),
    }, {
      get(target, property, receiver) {
        rootTrapCounters.get(property);
        return Reflect.get(target, property, receiver);
      },
      getOwnPropertyDescriptor(target, property) {
        rootTrapCounters.getOwnPropertyDescriptor(property);
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
      getPrototypeOf(target) {
        rootTrapCounters.getPrototypeOf();
        return Reflect.getPrototypeOf(target);
      },
      ownKeys(target) {
        rootTrapCounters.ownKeys();
        return Reflect.ownKeys(target);
      },
    });

    const rootResult = await executeMessagingRuntimeActionRaw(rootProxy as never);

    expect(rootResult).toMatchObject({
      status: 'blocked',
      reason: 'unsafe_runtime_shape',
      action: 'unsupported',
    });
    expect(rootTrapCounters.get).not.toHaveBeenCalled();
    expect(rootTrapCounters.getOwnPropertyDescriptor).not.toHaveBeenCalled();
    expect(rootTrapCounters.getPrototypeOf).not.toHaveBeenCalled();
    expect(rootTrapCounters.ownKeys).not.toHaveBeenCalled();

    const adapterTrapCounters = {
      get: vi.fn(),
      getOwnPropertyDescriptor: vi.fn(),
      getPrototypeOf: vi.fn(),
      ownKeys: vi.fn(),
    };
    const adapterProxy = new Proxy({
      adapterKind: 'fake-local-test-delivery-adapter',
      adapterId: 'slack-delivery-adapter',
    }, {
      get(target, property, receiver) {
        adapterTrapCounters.get(property);
        return Reflect.get(target, property, receiver);
      },
      getOwnPropertyDescriptor(target, property) {
        adapterTrapCounters.getOwnPropertyDescriptor(property);
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
      getPrototypeOf(target) {
        adapterTrapCounters.getPrototypeOf();
        return Reflect.getPrototypeOf(target);
      },
      ownKeys(target) {
        adapterTrapCounters.ownKeys();
        return Reflect.ownKeys(target);
      },
    });

    const adapterResult = await executeMessagingRuntimeActionRaw({
      gateInput: makeGateInput(),
      runtimeActivationPlan: makeRuntimeActivationPlan(),
      now: NOW,
      adapter: adapterProxy,
    } as never);

    expect(adapterResult).toMatchObject({
      status: 'blocked',
      reason: 'unsafe_runtime_shape',
      action: 'unsupported',
    });
    expect(adapterTrapCounters.get).not.toHaveBeenCalled();
    expect(adapterTrapCounters.getOwnPropertyDescriptor).not.toHaveBeenCalled();
    expect(adapterTrapCounters.getPrototypeOf).not.toHaveBeenCalled();
    expect(adapterTrapCounters.ownKeys).not.toHaveBeenCalled();
  });

  it('rejects nested gate-input accessors before gate evaluation or adapter handoff', async () => {
    const actionGetter = vi.fn(() => 'dry-run-notification');
    const adapterCallback = vi.fn();
    const gateInput = {
      explicitActionConsent: true,
      runtime: makeRuntimeInput(),
      noiseLimits: makeNoiseLimits(),
    };
    Object.defineProperty(gateInput, 'action', {
      enumerable: true,
      get: actionGetter,
    });

    const result = await executeMessagingRuntimeActionRaw({
      gateInput: gateInput as unknown as MessagingExecutionGateInput,
      runtimeActivationPlan: makeRuntimeActivationPlan(),
      now: NOW,
      adapter: callableAdapter({ dryRunNotification: adapterCallback }),
    } as never);

    expect(result).toMatchObject({
      status: 'blocked',
      reason: 'unsafe_runtime_shape',
      action: 'unsupported',
    });
    expect(actionGetter).not.toHaveBeenCalled();
    expect(adapterCallback).not.toHaveBeenCalled();
  });

  it('rejects adapter accessors before reading adapter methods', async () => {
    const adapterGetter = vi.fn(() => vi.fn());
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const adapter = {};
    Object.defineProperty(adapter, 'dryRunNotification', {
      enumerable: true,
      get() {
        fetchSpy('adapter-getter-side-effect');
        return adapterGetter();
      },
    });

    const result = await executeMessagingRuntimeActionRaw({
      gateInput: makeGateInput(),
      runtimeActivationPlan: makeRuntimeActivationPlan(),
      now: NOW,
      adapter: adapter as MessagingRuntimeExecutionAdapter,
    } as never);

    expect(result).toMatchObject({
      status: 'blocked',
      reason: 'unsafe_runtime_shape',
      action: 'unsupported',
    });
    expect(adapterGetter).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('adapter-getter-side-effect');
  });

  it('rejects allowed-field object and function poisoning before adapter handoff', async () => {
    const functionPoisonedAdapterCallback = vi.fn();
    const functionPoisonedAdapter = callableAdapter({ dryRunNotification: functionPoisonedAdapterCallback });
    const functionPoisonedResult = await executeMessagingRuntimeActionRaw({
      gateInput: makeGateInput(),
      runtimeActivationPlan: makeRuntimeActivationPlan(),
      now: NOW,
      adapter: functionPoisonedAdapter,
      expectation: {
        connectorKind: vi.fn() as never,
      },
    } as never);

    expect(functionPoisonedResult).toMatchObject({
      status: 'blocked',
      reason: 'unsafe_runtime_shape',
    });
    expect(functionPoisonedAdapterCallback).not.toHaveBeenCalled();

    const objectPoisonedAdapterCallback = vi.fn();
    const objectPoisonedAdapter = callableAdapter({ dryRunNotification: objectPoisonedAdapterCallback });
    const objectPoisonedResult = await executeMessagingRuntimeAction({
      gateInput: makeGateInput(),
      runtimeActivationPlan: makeRuntimeActivationPlan({
        consentWindow: {
          expiresAt: { value: NOW + 60_000 },
        },
      }),
      now: NOW,
      adapter: objectPoisonedAdapter,
    });

    expect(objectPoisonedResult).toMatchObject({
      status: 'blocked',
      reason: 'runtime_activation_plan_invalid',
    });
    expect(objectPoisonedAdapterCallback).not.toHaveBeenCalled();
  });

  it('does not invoke callable-looking live delivery fields when the executable contract is missing or mismatched', async () => {
    const forgedPostMessage = vi.fn();
    const forgedWebhookDelivery = vi.fn();
    const allowedAdapterMethod = vi.fn();

    const missingContractResult = await executeMessagingRuntimeAction({
      gateInput: makeGateInput({ action: 'post-message' }),
      adapter: {
        dryRunNotification: allowedAdapterMethod,
        postMessage: forgedPostMessage,
      } as unknown as MessagingRuntimeExecutionAdapter,
    });

    expect(missingContractResult).toMatchObject({
      status: 'blocked',
      reason: 'live_delivery_disabled_by_no_auto_post_contract',
      action: 'post-message',
    });
    expect(allowedAdapterMethod).not.toHaveBeenCalled();
    expect(forgedPostMessage).not.toHaveBeenCalled();

    const mismatchedContractResult = await executeMessagingRuntimeAction({
      gateInput: makeGateInput({ action: 'webhook-delivery' }),
      runtimeActivationPlan: makeRuntimeActivationPlan({
        decision: { executable: true, willCallWebhook: true },
        runtimeBinding: { sourceAction: 'webhook-delivery' },
      }),
      adapter: {
        dryRunNotification: allowedAdapterMethod,
        webhookDelivery: forgedWebhookDelivery,
      } as unknown as MessagingRuntimeExecutionAdapter,
    });

    expect(mismatchedContractResult).toMatchObject({
      status: 'blocked',
      reason: 'live_delivery_disabled_by_no_auto_post_contract',
      action: 'webhook-delivery',
    });
    expect(allowedAdapterMethod).not.toHaveBeenCalled();
    expect(forgedWebhookDelivery).not.toHaveBeenCalled();
  });

  it('blocks fake local test delivery metadata when adapter binding is missing, mismatched, or live-shaped', async () => {
    await expect(executeMessagingRuntimeAction({
      gateInput: makeGateInput(),
      runtimeActivationPlan: makeRuntimeActivationPlan(),
      now: NOW,
      adapter: fakeLocalTestAdapter({ adapterVersion: undefined }),
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'adapter_execution_not_enabled',
      action: 'dry-run-notification',
    });

    await expect(executeMessagingRuntimeAction({
      gateInput: makeGateInput(),
      runtimeActivationPlan: makeRuntimeActivationPlan(),
      now: NOW,
      adapter: fakeLocalTestAdapter({ adapterId: 'other-slack-delivery-adapter' }),
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'adapter_execution_not_enabled',
      action: 'dry-run-notification',
    });

    await expect(executeMessagingRuntimeAction({
      gateInput: makeGateInput(),
      runtimeActivationPlan: makeRuntimeActivationPlan(),
      now: NOW,
      adapter: {
        ...fakeLocalTestAdapter(),
        webhookUrl: 'https://hooks.slack.com/services/T000/B000/do-not-keep',
      } as unknown as MessagingRuntimeExecutionAdapter,
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'adapter_shape_invalid',
      action: 'dry-run-notification',
    });
  });

  it('blocks raw secret payloads and gate-blocked inputs without preserving secret material or calling adapters', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const dryRunNotification = vi.fn();
    const adapter = callableAdapter({ dryRunNotification });

    const secretResult = await executeMessagingRuntimeAction({
      gateInput: makeGateInput(),
      adapter,
      payload: {
        webhookUrl: 'https://hooks.slack.com/services/T000/B000/do-not-keep',
        token: 'xoxb-do-not-keep',
      },
    });

    expect(secretResult).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });
    expect(JSON.stringify(secretResult)).not.toContain('hooks.slack.com');
    expect(JSON.stringify(secretResult)).not.toContain('xoxb');

    const gateBlockedResult = await executeMessagingRuntimeAction({
      gateInput: makeGateInput({ explicitActionConsent: false }),
      adapter,
    });

    expect(gateBlockedResult).toMatchObject({
      status: 'blocked',
      reason: 'gate_blocked',
      gateReason: 'missing_explicit_action_consent',
    });
    expect(dryRunNotification).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not invoke failing callable-looking adapters or expose their secret-looking errors', async () => {
    const dryRunNotification = vi.fn().mockRejectedValue(new Error('adapter received xoxb-do-not-keep'));
    const adapter = callableAdapter({ dryRunNotification });

    const result = await executeMessagingRuntimeAction({
      gateInput: makeGateInput(),
      runtimeActivationPlan: makeRuntimeActivationPlan(),
      now: NOW,
      adapter,
    });

    expect(result).toMatchObject({
      status: 'blocked',
      reason: 'adapter_execution_not_enabled',
    });
    expect(dryRunNotification).not.toHaveBeenCalled();
    expect(result.safeDetails).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('xoxb-do-not-keep');
  });

  it('does not invoke callbacks that would return live, mismatched, or out-of-shape adapter results', async () => {
    const execution = makeGateInput();
    const liveClaimCallback = vi.fn().mockResolvedValue({
      action: 'dry-run-notification',
      connectorKind: 'slack',
      eventScope: 'channel-follow-up',
      credentialReferenceId: 'vault:messaging/slack/case-alerts',
      posted: true,
    });

    await expect(executeMessagingRuntimeAction({
      gateInput: execution,
      runtimeActivationPlan: makeRuntimeActivationPlan(),
      now: NOW,
      adapter: callableAdapter({ dryRunNotification: liveClaimCallback }),
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'adapter_execution_not_enabled',
    });
    expect(liveClaimCallback).not.toHaveBeenCalled();

    const mismatchCallback = vi.fn().mockResolvedValue({
      action: 'dry-run-notification',
      connectorKind: 'generic-webhook',
      eventScope: 'channel-follow-up',
      credentialReferenceId: 'vault:messaging/slack/case-alerts',
    });

    await expect(executeMessagingRuntimeAction({
      gateInput: execution,
      runtimeActivationPlan: makeRuntimeActivationPlan(),
      now: NOW,
      adapter: callableAdapter({ dryRunNotification: mismatchCallback }),
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'adapter_execution_not_enabled',
    });
    expect(mismatchCallback).not.toHaveBeenCalled();

    const outOfShapeCallback = vi.fn().mockResolvedValue({
      action: 'dry-run-notification',
      connectorKind: 'slack',
      eventScope: 'channel-follow-up',
      credentialReferenceId: 'vault:messaging/slack/case-alerts',
      safeDetails: { rendered: true },
      unexpectedField: 'not allowed',
    });

    await expect(executeMessagingRuntimeAction({
      gateInput: execution,
      runtimeActivationPlan: makeRuntimeActivationPlan(),
      now: NOW,
      adapter: callableAdapter({ dryRunNotification: outOfShapeCallback }),
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'adapter_execution_not_enabled',
    });
    expect(outOfShapeCallback).not.toHaveBeenCalled();

    const liveFlagCallback = vi.fn().mockResolvedValue({
      action: 'dry-run-notification',
      connectorKind: 'slack',
      eventScope: 'channel-follow-up',
      credentialReferenceId: 'vault:messaging/slack/case-alerts',
      willCallWebhook: false,
    });

    await expect(executeMessagingRuntimeAction({
      gateInput: execution,
      runtimeActivationPlan: makeRuntimeActivationPlan(),
      now: NOW,
      adapter: callableAdapter({ dryRunNotification: liveFlagCallback }),
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'adapter_execution_not_enabled',
    });
    expect(liveFlagCallback).not.toHaveBeenCalled();
  });

  it('does not invoke callbacks that would return secret-bearing adapter results or payload echo metadata', async () => {
    for (const unsafeResult of [
      {
        action: 'dry-run-notification',
        connectorKind: 'slack',
        eventScope: 'channel-follow-up',
        credentialReferenceId: 'vault:messaging/slack/case-alerts',
        safeDetails: { signingSecret: 'api_secret=synthetic-value' },
      },
      {
        action: 'dry-run-notification',
        connectorKind: 'slack',
        eventScope: 'channel-follow-up',
        credentialReferenceId: 'vault:messaging/slack/case-alerts',
        safeDetails: { webhookUrl: 'https://hooks.slack.com/services/T000/B000/do-not-echo' },
      },
    ]) {
      const dryRunNotification = vi.fn().mockResolvedValue(unsafeResult);
      const result = await executeMessagingRuntimeAction({
        gateInput: makeGateInput(),
        runtimeActivationPlan: makeRuntimeActivationPlan(),
        now: NOW,
        adapter: callableAdapter({ dryRunNotification }),
      });
      const serialized = JSON.stringify(result);

      expect(result).toMatchObject({
        status: 'blocked',
        reason: 'adapter_execution_not_enabled',
      });
      expect(dryRunNotification).not.toHaveBeenCalled();
      expect(serialized).not.toContain('synthetic');
      expect(serialized).not.toContain('hooks.slack.com');
      expect(serialized).not.toContain('do-not-echo');
    }

    const payloadEchoCallback = vi.fn().mockResolvedValue({
      action: 'dry-run-notification',
      connectorKind: 'slack',
      eventScope: 'channel-follow-up',
      credentialReferenceId: 'vault:messaging/slack/case-alerts',
      safeDetails: { payload: 'Case opened' },
    });
    await expect(executeMessagingRuntimeAction({
      gateInput: makeGateInput(),
      runtimeActivationPlan: makeRuntimeActivationPlan(),
      now: NOW,
      adapter: callableAdapter({ dryRunNotification: payloadEchoCallback }),
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'adapter_execution_not_enabled',
    });
    expect(payloadEchoCallback).not.toHaveBeenCalled();
  });

  it('does not invoke callbacks that would return URL-like or oversized safeDetails strings', async () => {
    const dryRunNotification = vi.fn().mockResolvedValue({
      action: 'dry-run-notification',
      connectorKind: 'slack',
      eventScope: 'channel-follow-up',
      credentialReferenceId: 'vault:messaging/slack/case-alerts',
      adapterRunId: 'dry-run-2',
      safeDetails: {
        preview: 'allowed summary',
        endpoint: 'wss://example.invalid/socket',
        oversized: 'x'.repeat(500),
        nested: { unsafe: true },
      },
    });
    const adapter = callableAdapter({ dryRunNotification });

    const result = await executeMessagingRuntimeAction({
      gateInput: makeGateInput(),
      runtimeActivationPlan: makeRuntimeActivationPlan(),
      now: NOW,
      adapter,
    });
    const serialized = JSON.stringify(result);

    expect(result).toMatchObject({
      status: 'blocked',
      reason: 'adapter_execution_not_enabled',
    });
    expect(dryRunNotification).not.toHaveBeenCalled();
    expect(result.adapterRunId).toBeUndefined();
    expect(result.safeDetails).toBeUndefined();
    expect(serialized).not.toContain('wss://');
    expect(serialized).not.toContain('x'.repeat(200));
  });
});
