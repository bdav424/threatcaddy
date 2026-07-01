import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateMessagingRuntimeReadiness,
  type MessagingRuntimeReadinessInput,
} from '../lib/messaging-runtime-readiness';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
import type { MessagingConnectorEventClass } from '../lib/messaging-connector-policy';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function makeConnectorCredentialReference(
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

function makeInput(
  overrides: Partial<MessagingRuntimeReadinessInput> = {},
): MessagingRuntimeReadinessInput {
  return {
    connectorAvailable: true,
    connectorKind: 'slack',
    credentialReference: makeConnectorCredentialReference(),
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

describe('messaging runtime readiness contract', () => {
  it('classifies a scoped explicit user test as ready without enabling auto-post behavior', () => {
    const decision = evaluateMessagingRuntimeReadiness(makeInput());

    expect(decision).toMatchObject({
      status: 'explicit-user-test-ready',
      readyForExplicitUserTest: true,
      reason: 'explicit_user_test_ready',
      connectorKind: 'slack',
      eventScope: 'direct-mention',
      credentialReference: makeConnectorCredentialReference(),
      noAutoPost: true,
      sideEffectBoundary: 'pure-local-no-fetch-no-webhook-no-slack-api-no-storage-no-send',
    });
  });

  it('classifies valid scoped notification metadata as no-auto-post safe when no manual test is requested', () => {
    const decision = evaluateMessagingRuntimeReadiness(makeInput({
      explicitUserTestRequested: false,
      eventScope: 'webhook-alert',
      connectorKind: 'generic-webhook',
      policy: {
        connectorKind: 'generic-webhook',
        consent: { explicitUserConsent: true },
        webhook: {
          credentialRef: {
            id: 'vault:messaging:generic-webhook:case-alerts',
            kind: 'external-secret-store',
            displayName: 'Generic webhook credential reference',
          },
        },
        eventClasses: { 'webhook-alert': true },
      },
      credentialReference: undefined,
    }));

    expect(decision).toMatchObject({
      status: 'no-auto-post-safe',
      readyForExplicitUserTest: false,
      reason: 'no_auto_post_safe',
      connectorKind: 'generic-webhook',
      eventScope: 'webhook-alert',
      noAutoPost: true,
    });
    expect(JSON.stringify(decision)).not.toContain('hooks.slack.com');
  });

  it('classifies unavailable connectors separately from blocked configuration', () => {
    expect(evaluateMessagingRuntimeReadiness(makeInput({ connectorAvailable: false }))).toMatchObject({
      status: 'unavailable',
      reason: 'connector_unavailable',
      readyForExplicitUserTest: false,
    });

    expect(evaluateMessagingRuntimeReadiness(makeInput({ connectorKind: 'unknown' as never }))).toMatchObject({
      status: 'unavailable',
      reason: 'unsupported_connector_kind',
    });
  });

  it('fails closed for missing consent, missing credentials, raw webhook URLs, and attempted posting privileges', () => {
    expect(evaluateMessagingRuntimeReadiness(makeInput({
      policy: {
        consent: { explicitUserConsent: false },
        eventClasses: { 'direct-mention': true },
      },
    }))).toMatchObject({
      status: 'blocked',
      reason: 'missing_explicit_user_consent',
    });

    expect(evaluateMessagingRuntimeReadiness(makeInput({
      credentialReference: undefined,
      policy: {
        consent: { explicitUserConsent: true },
        eventClasses: { 'direct-mention': true },
      },
    }))).toMatchObject({
      status: 'blocked',
      reason: 'missing_credential_reference',
    });

    const rawSecretDecision = evaluateMessagingRuntimeReadiness(makeInput({
      policy: {
        consent: { explicitUserConsent: true },
        webhook: {
          webhookUrl: 'https://hooks.slack.com/services/T000/B000/do-not-keep',
        },
        eventClasses: { 'direct-mention': true },
      },
    }));
    expect(rawSecretDecision).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });
    expect(JSON.stringify(rawSecretDecision)).not.toContain('hooks.slack.com');

    expect(evaluateMessagingRuntimeReadiness(makeInput({
      policy: {
        consent: {
          explicitUserConsent: true,
          canPostMessages: true,
        },
        eventClasses: { 'direct-mention': true },
      },
    }))).toMatchObject({
      status: 'blocked',
      reason: 'posting_or_webhook_execution_enabled',
    });
  });

  it('rejects invalid shared credential references without preserving secret-like values', () => {
    const decision = evaluateMessagingRuntimeReadiness(makeInput({
      credentialReference: {
        ...makeConnectorCredentialReference(),
        id: 'xoxb-synthetic-placeholder',
      },
    }));

    expect(decision).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });
    expect(JSON.stringify(decision)).not.toContain('xoxb-synthetic-placeholder');

    const malformedDecision = evaluateMessagingRuntimeReadiness(makeInput({
      credentialReference: {
        ...makeConnectorCredentialReference(),
        schemaVersion: 2,
      },
    }));

    expect(malformedDecision).toMatchObject({
      status: 'blocked',
      reason: 'invalid_connector_credential_reference',
      connectorCredentialRejectReason: 'invalid_schema_version',
    });
  });

  it('keeps direct mentions, DMs, group DMs, thread replies, and channel follow-ups distinguishable', () => {
    const eventScopes: MessagingConnectorEventClass[] = [
      'direct-mention',
      'one-to-one-dm',
      'group-dm',
      'thread-reply-after-user-post',
      'channel-follow-up',
    ];

    for (const eventScope of eventScopes) {
      expect(evaluateMessagingRuntimeReadiness(makeInput({ eventScope }))).toMatchObject({
        status: 'explicit-user-test-ready',
        eventScope,
      });
    }

    expect(evaluateMessagingRuntimeReadiness(makeInput({
      eventScope: ['direct-mention', 'one-to-one-dm'],
    }))).toMatchObject({
      status: 'blocked',
      reason: 'ambiguous_event_scope',
    });

    expect(evaluateMessagingRuntimeReadiness(makeInput({
      eventScope: undefined,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'missing_event_scope',
    });
  });

  it('blocks channel follow-ups when noise controls permit broad channel flooding', () => {
    const decision = evaluateMessagingRuntimeReadiness(makeInput({
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
    }));

    expect(decision).toMatchObject({
      status: 'blocked',
      reason: 'channel_follow_up_policy_overbroad',
      eventScope: 'channel-follow-up',
    });
  });

  it('does not fetch, touch storage, call webhooks, or preserve token-bearing input while evaluating readiness', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');

    const decision = evaluateMessagingRuntimeReadiness(makeInput({
      policy: {
        consent: { explicitUserConsent: true },
        webhook: {
          webhookUrl: 'https://hooks.slack.com/services/T000/B000/do-not-keep',
        },
        eventClasses: { 'webhook-alert': true },
      },
      eventScope: 'webhook-alert',
    }));
    const serialized = JSON.stringify(decision).toLowerCase();

    expect(decision).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(serialized).not.toContain('hooks.slack.com');
    expect(serialized).not.toContain('do-not-keep');
  });
});
