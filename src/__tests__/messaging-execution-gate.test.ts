import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateMessagingExecutionGate,
  type MessagingExecutionGateInput,
  type MessagingExecutionNoiseLimits,
} from '../lib/messaging-execution-gate';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
import type { MessagingRuntimeReadinessInput } from '../lib/messaging-runtime-readiness';

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

describe('messaging execution gate', () => {
  it('allows only inert dry-run notification decisions after runtime readiness, consent, scope, credential, and noise checks pass', () => {
    const decision = evaluateMessagingExecutionGate(makeGateInput());

    expect(decision).toMatchObject({
      decision: 'allow',
      action: 'dry-run-notification',
      reason: 'dry_run_notification_allowed',
      inert: true,
      executesProviderCall: false,
      noAutoPost: true,
      runtimeStatus: 'explicit-user-test-ready',
      runtimeReason: 'explicit_user_test_ready',
      eventScope: 'direct-mention',
      sideEffectBoundary: 'pure-local-no-fetch-no-webhook-no-slack-api-no-storage-no-send',
    });
  });

  it('keeps post, thread reply, and webhook delivery actions blocked under the no-auto-post contract', () => {
    for (const action of ['post-message', 'post-thread-reply', 'webhook-delivery'] as const) {
      expect(evaluateMessagingExecutionGate(makeGateInput({ action }))).toMatchObject({
        decision: 'block',
        action,
        reason: 'live_delivery_disabled_by_no_auto_post_contract',
        inert: true,
        executesProviderCall: false,
        noAutoPost: true,
      });
    }
  });

  it('allows disable and revoke as inert manual-control decisions only after the same prerequisites pass', () => {
    for (const action of ['disable-connector', 'revoke-credential-reference'] as const) {
      expect(evaluateMessagingExecutionGate(makeGateInput({ action }))).toMatchObject({
        decision: 'allow',
        action,
        reason: 'manual_control_allowed',
        inert: true,
        executesProviderCall: false,
      });
    }
  });

  it('blocks missing action consent, unsupported actions, and runtime-readiness failures', () => {
    expect(evaluateMessagingExecutionGate(makeGateInput({
      explicitActionConsent: false,
    }))).toMatchObject({
      decision: 'block',
      reason: 'missing_explicit_action_consent',
    });

    expect(evaluateMessagingExecutionGate(makeGateInput({
      action: 'send-everywhere' as never,
    }))).toMatchObject({
      decision: 'block',
      action: 'unsupported',
      reason: 'unsupported_action',
    });

    expect(evaluateMessagingExecutionGate(makeGateInput({
      runtime: makeRuntimeInput({
        policy: {
          consent: { explicitUserConsent: false },
          eventClasses: { 'direct-mention': true },
        },
      }),
    }))).toMatchObject({
      decision: 'block',
      reason: 'runtime_not_ready',
      runtimeStatus: 'blocked',
      runtimeReason: 'missing_explicit_user_consent',
    });
  });

  it('requires event scope, credential reference, and constrained noise limits', () => {
    expect(evaluateMessagingExecutionGate(makeGateInput({
      runtime: makeRuntimeInput({ eventScope: undefined }),
    }))).toMatchObject({
      decision: 'block',
      reason: 'missing_event_scope',
    });

    expect(evaluateMessagingExecutionGate(makeGateInput({
      runtime: makeRuntimeInput({
        credentialReference: undefined,
        policy: {
          consent: { explicitUserConsent: true },
          eventClasses: { 'direct-mention': true },
        },
      }),
    }))).toMatchObject({
      decision: 'block',
      reason: 'missing_credential_reference',
    });

    expect(evaluateMessagingExecutionGate(makeGateInput({
      noiseLimits: null,
    }))).toMatchObject({
      decision: 'block',
      reason: 'missing_noise_limits',
    });

    expect(evaluateMessagingExecutionGate(makeGateInput({
      noiseLimits: makeNoiseLimits({ maxActionsPerHour: 4 }),
    }))).toMatchObject({
      decision: 'block',
      reason: 'noise_limit_overbroad',
    });
  });

  it('preserves channel-follow-up noise boundaries from runtime readiness and execution limits', () => {
    expect(evaluateMessagingExecutionGate(makeGateInput({
      runtime: makeRuntimeInput({ eventScope: 'channel-follow-up' }),
      noiseLimits: makeNoiseLimits({ requireExplicitCaseMentionForChannels: false }),
    }))).toMatchObject({
      decision: 'block',
      reason: 'noise_limit_overbroad',
      eventScope: 'channel-follow-up',
    });

    expect(evaluateMessagingExecutionGate(makeGateInput({
      runtime: makeRuntimeInput({
        eventScope: 'channel-follow-up',
        policy: {
          consent: { explicitUserConsent: true },
          eventClasses: { 'channel-follow-up': true },
          slackNotificationPolicy: {
            channelFollowUps: true,
            noiseControls: {
              quietHoursEnabled: false,
              batchChannelFollowUps: false,
              maxChannelFollowUpsPerHour: 6,
              suppressDuplicateThreadReplies: false,
              requireExplicitCaseMentionForChannels: false,
            },
          },
        },
      }),
    }))).toMatchObject({
      decision: 'block',
      reason: 'noise_limit_overbroad',
      runtimeReason: 'channel_follow_up_policy_overbroad',
      eventScope: 'channel-follow-up',
    });
  });

  it('does not fetch, touch storage, execute webhooks, or preserve token-bearing payloads while evaluating the gate', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');

    const decision = evaluateMessagingExecutionGate(makeGateInput({
      action: 'webhook-delivery',
      actionPayload: {
        webhookUrl: 'https://hooks.slack.com/services/T000/B000/do-not-keep',
        token: 'xoxb-do-not-keep',
      },
    }));
    const serialized = JSON.stringify(decision).toLowerCase();

    expect(decision).toMatchObject({
      decision: 'block',
      reason: 'raw_secret_material',
      inert: true,
      executesProviderCall: false,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(serialized).not.toContain('hooks.slack.com');
    expect(serialized).not.toContain('xoxb');
    expect(serialized).not.toContain('do-not-keep');
  });
});
