import { describe, expect, it, vi } from 'vitest';
import {
  getDefaultMessagingConnectorSafetyPolicy,
  hasMessagingSecretMaterial,
  sanitizeMessagingConnectorSafetyPolicy,
} from '../lib/messaging-connector-policy';

describe('messaging connector safety policy', () => {
  it('defaults to explicit-consent-required notification metadata with no auto-post behavior', () => {
    const policy = getDefaultMessagingConnectorSafetyPolicy();

    expect(policy.consent).toEqual({
      explicitUserConsent: false,
      consentScope: 'none',
      canPostMessages: false,
      canExecuteWebhooks: false,
    });
    expect(policy.webhook).toEqual({
      requiresCredentialReference: true,
      credentialRef: undefined,
      plaintextWebhookUrlAllowed: false,
      rejectedSecretFields: [],
    });
    expect(Object.values(policy.eventClasses)).toHaveLength(6);
    expect(Object.values(policy.eventClasses).every((eventPolicy) => eventPolicy.supported)).toBe(true);
    expect(Object.values(policy.eventClasses).every((eventPolicy) => eventPolicy.allowed === false)).toBe(true);
    expect(Object.values(policy.eventClasses).every((eventPolicy) => eventPolicy.autoPost === false)).toBe(true);
    expect(Object.values(policy.eventClasses).every((eventPolicy) => eventPolicy.requiresExplicitConsent === true)).toBe(true);
  });

  it('requires explicit user consent and Slack policy opt-ins before allowing noisy event classes', () => {
    const noConsentPolicy = sanitizeMessagingConnectorSafetyPolicy({
      consent: { explicitUserConsent: false },
      eventClasses: {
        'direct-mention': true,
        'one-to-one-dm': true,
        'group-dm': true,
        'thread-reply-after-user-post': true,
        'channel-follow-up': true,
        'webhook-alert': true,
      },
      slackNotificationPolicy: {
        oneToOneDms: true,
        groupDms: true,
        channelFollowUps: true,
      },
    });

    expect(Object.values(noConsentPolicy.eventClasses).every((eventPolicy) => eventPolicy.allowed === false)).toBe(true);

    const consentedPolicy = sanitizeMessagingConnectorSafetyPolicy({
      consent: { explicitUserConsent: true },
      eventClasses: {
        'direct-mention': true,
        'one-to-one-dm': true,
        'group-dm': true,
        'thread-reply-after-user-post': true,
        'channel-follow-up': true,
        'webhook-alert': true,
      },
      slackNotificationPolicy: {
        oneToOneDms: true,
        groupDms: true,
        channelFollowUps: true,
        noiseControls: { maxChannelFollowUpsPerHour: 99 },
      },
    });

    expect(consentedPolicy.consent).toMatchObject({
      explicitUserConsent: true,
      consentScope: 'notifications-only',
      canPostMessages: false,
      canExecuteWebhooks: false,
    });
    expect(consentedPolicy.eventClasses['direct-mention'].allowed).toBe(true);
    expect(consentedPolicy.eventClasses['one-to-one-dm'].allowed).toBe(true);
    expect(consentedPolicy.eventClasses['group-dm'].allowed).toBe(true);
    expect(consentedPolicy.eventClasses['thread-reply-after-user-post'].allowed).toBe(true);
    expect(consentedPolicy.eventClasses['channel-follow-up'].allowed).toBe(true);
    expect(consentedPolicy.eventClasses['webhook-alert'].allowed).toBe(true);
    expect(Object.values(consentedPolicy.eventClasses).every((eventPolicy) => eventPolicy.autoPost === false)).toBe(true);
    expect(consentedPolicy.slackNotificationPolicy.noiseControls.maxChannelFollowUpsPerHour).toBe(6);
  });

  it('accepts only opaque webhook credential references and rejects plaintext URLs or tokens', () => {
    const policy = sanitizeMessagingConnectorSafetyPolicy({
      connectorKind: 'generic-webhook',
      webhook: {
        credentialRef: {
          id: 'vault:case-notify-webhook',
          kind: 'user-managed-vault',
          displayName: 'Case notification webhook',
        },
        webhookUrl: 'https://hooks.slack.com/services/T000/B000/secret',
        token: 'xoxb-do-not-keep',
      },
    });

    expect(policy.connectorKind).toBe('generic-webhook');
    expect(policy.webhook.credentialRef).toEqual({
      id: 'vault:case-notify-webhook',
      kind: 'user-managed-vault',
      displayName: 'Case notification webhook',
    });
    expect(policy.webhook.plaintextWebhookUrlAllowed).toBe(false);
    expect(policy.webhook.rejectedSecretFields).toEqual(expect.arrayContaining([
      'webhook.token',
      'webhook.webhookUrl',
    ]));
    expect(JSON.stringify(policy)).not.toContain('https://hooks.slack.com');
    expect(JSON.stringify(policy)).not.toContain('xoxb-do-not-keep');
  });

  it('drops credential references that contain secret-looking values', () => {
    const policy = sanitizeMessagingConnectorSafetyPolicy({
      webhook: {
        credentialRef: {
          id: 'https://hooks.slack.com/services/T000/B000/secret',
          kind: 'external-secret-store',
          displayName: 'https://hooks.slack.com/services/T000/B000/secret',
        },
      },
    });

    expect(policy.webhook.credentialRef).toBeUndefined();
    expect(policy.webhook.rejectedSecretFields).toEqual(expect.arrayContaining([
      'webhook.credentialRef.displayName',
      'webhook.credentialRef.id',
    ]));
    expect(JSON.stringify(policy)).not.toContain('hooks.slack.com/services');
  });

  it('detects secret material through circular objects, maps, and sets without serializing input', () => {
    const circularSecretCarrier: Record<string, unknown> = { id: 'connector-1' };
    circularSecretCarrier.self = circularSecretCarrier;
    circularSecretCarrier.map = new Map<unknown, unknown>([
      ['nested', new Set(['safe-reference', 'Bearer secret-token'])],
    ]);

    expect(() => hasMessagingSecretMaterial(circularSecretCarrier)).not.toThrow();
    expect(hasMessagingSecretMaterial(circularSecretCarrier)).toBe(true);
  });

  it('does not fetch, write storage, or preserve secret values while sanitizing local policy metadata', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const policy = sanitizeMessagingConnectorSafetyPolicy({
      consent: { explicitUserConsent: true },
      eventClasses: { 'direct-mention': true },
      webhook: {
        credentialRef: { id: 'secret-store:notify-webhook', kind: 'external-secret-store' },
        webhookUrl: 'https://hooks.slack.com/services/T000/B000/secret',
      },
      slackNotificationPolicy: {
        directMentions: true,
        token: 'xoxp-do-not-keep',
      },
    });
    const serialized = JSON.stringify(policy).toLowerCase();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(serialized).not.toContain('hooks.slack.com');
    expect(serialized).not.toContain('xoxp-do-not-keep');
    expect(serialized).not.toContain('do-not-keep');

    fetchSpy.mockRestore();
    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
  });
});
