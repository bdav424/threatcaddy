import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
import {
  createRuntimeTrustedContractObject,
  isRuntimeTrustedContractObject,
  type RuntimeTrustedContractObject,
  type RuntimeTrustedContractValue,
} from '../lib/runtime-trusted-contract-object';
import {
  evaluateSlackLiveDeliveryActivationGate,
  type SlackLiveDeliveryIntent,
  type SlackLiveDeliveryNoisePolicy,
  type SlackLiveDeliveryReviewedConsent,
  type SlackLiveDeliveryReviewedTarget,
} from '../lib/slack-live-delivery-activation-gate';

const NOW = 1_800_000_000_000;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
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
  if (isRuntimeTrustedContractObject(value)) return value;
  if (isPlainRecord(value)) return trusted(value);
  throw new TypeError('Test fixture contains an unsupported trusted contract value.');
}

function trusted<T extends Record<string, unknown>>(value: T): RuntimeTrustedContractObject & T {
  return createRuntimeTrustedContractObject(
    Object.entries(value).map(([key, nested]) => [key, trustedValue(nested)] as const),
  ) as RuntimeTrustedContractObject & T;
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

function readyInput(overrides: Record<string, unknown> = {}) {
  return trusted({
    reviewedTarget: reviewedTarget(),
    reviewedConsent: reviewedConsent(),
    credentialReference: credentialReference(),
    noisePolicy: noisePolicy(),
    deliveryIntent: deliveryIntent(),
    now: NOW,
    ...overrides,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('slack live delivery activation gate', () => {
  it('returns a frozen plan-only activation plan with explicit user approval required before any future post', () => {
    const decision = evaluateSlackLiveDeliveryActivationGate(readyInput());

    expect(decision).toEqual({
      status: 'ready',
      ready: true,
      reason: 'slack_live_delivery_activation_gate_ready',
      blockers: [],
      plan: {
        contract: 'slack-live-delivery-activation-plan-v1',
        connectorKind: 'slack',
        workspaceId: 'workspace-1',
        target: {
          kind: 'workspace-channel',
          id: 'channel-case-alerts',
          label: 'Case alerts',
        },
        eventScope: 'channel-follow-up',
        messageClass: 'ioc-alert',
        actionIntent: 'post-message',
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
        noisePolicy: {
          maxDeliveriesPerHour: 3,
          maxRecipientsPerDelivery: 1,
          suppressDuplicateThreadReplies: true,
          requireExplicitCaseMentionForChannels: true,
          noBurstDelivery: true,
        },
        reviewedTarget: true,
        reviewedConsent: true,
        reviewedNoisePolicy: true,
        reviewedDeliveryIntent: true,
        noAutoPost: true,
        notificationOnly: true,
        requiresUserApprovalBeforePost: true,
        executable: false,
        sideEffects: 'none',
        sideEffectBoundary: 'slack-live-delivery-activation-plan-only-no-slack-api-no-webhook-no-fetch-no-socket-no-storage-no-send',
      },
      canPrepareFutureSlackLiveDeliveryActivation: true,
      executable: false,
      sideEffects: 'none',
      requiresUserApprovalBeforePost: true,
      willCallSlackApi: false,
      willCallWebhook: false,
      willFetch: false,
      willOpenSocket: false,
      willMutateStorage: false,
      willStoreCredential: false,
      willOpenOAuthWindow: false,
      willPostMessage: false,
      willPostThreadReply: false,
      sideEffectBoundary: 'slack-live-delivery-activation-gate-plan-only-no-slack-api-no-webhook-no-fetch-no-socket-no-storage-no-send',
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.blockers)).toBe(true);
    expect(Object.isFrozen(decision.plan)).toBe(true);
    expect(Object.isFrozen(decision.plan?.target)).toBe(true);
    expect(Object.isFrozen(decision.plan?.credentialReference)).toBe(true);
    expect(JSON.stringify(decision)).not.toMatch(/VENDOR|employer/i);
  });

  it('rejects raw proxy and accessor inputs before scanner or traversal execution', () => {
    const getter = vi.fn(() => reviewedTarget());
    const accessorInput: Record<string, unknown> = {
      reviewedConsent: reviewedConsent(),
    };
    Object.defineProperty(accessorInput, 'reviewedTarget', {
      enumerable: true,
      get: getter,
    });
    const traps = {
      get: vi.fn((proxyTarget: Record<string, unknown>, property: string | symbol, receiver: unknown) => (
        Reflect.get(proxyTarget, property, receiver)
      )),
      ownKeys: vi.fn((proxyTarget: Record<string, unknown>) => Reflect.ownKeys(proxyTarget)),
      getOwnPropertyDescriptor: vi.fn((proxyTarget: Record<string, unknown>, property: string | symbol) => (
        Reflect.getOwnPropertyDescriptor(proxyTarget, property)
      )),
      getPrototypeOf: vi.fn((proxyTarget: Record<string, unknown>) => Reflect.getPrototypeOf(proxyTarget)),
    };
    const proxiedInput = new Proxy({
      reviewedTarget: reviewedTarget(),
      reviewedConsent: reviewedConsent(),
    }, traps);

    expect(evaluateSlackLiveDeliveryActivationGate(accessorInput)).toMatchObject({
      status: 'blocked',
      reason: 'invalid_root_shape',
      willFetch: false,
      willCallSlackApi: false,
      willCallWebhook: false,
    });
    expect(evaluateSlackLiveDeliveryActivationGate(proxiedInput)).toMatchObject({
      status: 'blocked',
      reason: 'invalid_root_shape',
    });
    expect(getter).not.toHaveBeenCalled();
    expect(traps.get).not.toHaveBeenCalled();
    expect(traps.ownKeys).not.toHaveBeenCalled();
    expect(traps.getOwnPropertyDescriptor).not.toHaveBeenCalled();
    expect(traps.getPrototypeOf).not.toHaveBeenCalled();
  });

  it('supports reviewed DM, thread, and webhook scopes only when the connector kind and action intent match the exact scope', () => {
    const threadDecision = evaluateSlackLiveDeliveryActivationGate(readyInput({
      reviewedTarget: reviewedTarget({
        targetKind: 'thread-reply',
        eventScope: 'thread-reply-after-user-post',
        targetId: 'thread-case-alerts',
        targetLabel: 'Case alert thread',
        threadRootId: 'thread-root-1',
      }),
      reviewedConsent: reviewedConsent({
        targetId: 'thread-case-alerts',
        eventScope: 'thread-reply-after-user-post',
        messageClass: 'case-update',
      }),
      credentialReference: credentialReference(),
      noisePolicy: noisePolicy({
        eventScope: 'thread-reply-after-user-post',
      }),
      deliveryIntent: deliveryIntent({
        targetId: 'thread-case-alerts',
        eventScope: 'thread-reply-after-user-post',
        messageClass: 'case-update',
        actionIntent: 'post-thread-reply',
      }),
      now: NOW,
    }));

    const webhookDecision = evaluateSlackLiveDeliveryActivationGate(readyInput({
      reviewedTarget: reviewedTarget({
        connectorKind: 'generic-webhook',
        workspaceId: undefined,
        workspaceLabel: undefined,
        targetKind: 'webhook-reference',
        eventScope: 'webhook-alert',
        targetId: 'webhook-reference-case-alerts',
        targetLabel: 'Case alert webhook reference',
        targetProvenance: 'reviewed-webhook-reference',
      }),
      reviewedConsent: reviewedConsent({
        connectorKind: 'generic-webhook',
        workspaceId: undefined,
        targetId: 'webhook-reference-case-alerts',
        eventScope: 'webhook-alert',
        messageClass: 'analyst-routing',
      }),
      credentialReference: credentialReference({
        kind: 'os-keychain',
        storageOwner: 'operating-system',
        id: 'macos-login:messaging/generic-webhook/workspace-1',
        providerId: 'generic-webhook',
      }),
      noisePolicy: noisePolicy({
        connectorKind: 'generic-webhook',
        eventScope: 'webhook-alert',
        requireExplicitCaseMentionForChannels: false,
      }),
      deliveryIntent: deliveryIntent({
        connectorKind: 'generic-webhook',
        workspaceId: undefined,
        targetId: 'webhook-reference-case-alerts',
        eventScope: 'webhook-alert',
        messageClass: 'analyst-routing',
        actionIntent: 'webhook-delivery',
      }),
      now: NOW,
    }));

    expect(threadDecision).toMatchObject({
      status: 'ready',
      plan: {
        actionIntent: 'post-thread-reply',
        target: {
          kind: 'thread-reply',
          threadRootId: 'thread-root-1',
        },
      },
    });
    expect(webhookDecision).toMatchObject({
      status: 'ready',
      plan: {
        connectorKind: 'generic-webhook',
        actionIntent: 'webhook-delivery',
        target: {
          kind: 'webhook-reference',
        },
      },
    });
  });

  it('rejects Slack tokens, webhook URLs, bearer headers, OAuth codes, and secret-shaped values anywhere in input', () => {
    for (const malicious of [
      { botToken: 'xoxb-123456789-secret' },
      { signingSecret: 'api_secret=synthetic-value' },
      { webhookUrl: 'https://hooks.slack.com/services/T000/B000/SECRET' },
      { authorization: 'Bearer synthetic-secret' },
      { oauthCode: 'oauth_code=synthetic-value' },
    ]) {
      const decision = evaluateSlackLiveDeliveryActivationGate(readyInput({
        reviewedConsent: {
          ...reviewedConsent(),
          ...malicious,
        },
      }));

      expect(decision).toMatchObject({
        status: 'blocked',
        reason: 'raw_secret_material',
        canPrepareFutureSlackLiveDeliveryActivation: false,
      });
      expect(JSON.stringify(decision)).not.toContain('synthetic');
    }
  });

  it('rejects non-http URL-shaped reviewed metadata while preserving opaque credential handles', () => {
    for (const identifier of [
      'wss://example.invalid/socket',
      '//example.invalid/path',
      'ftp://example.invalid/file',
      'mailto:user@example.test',
      'urn:messaging:opaque',
      'localhost:11434/health',
      '127.0.0.1:11434/health',
      'api.slack.com/methods/chat.postMessage',
    ]) {
      const targetDecision = evaluateSlackLiveDeliveryActivationGate(readyInput({
        reviewedTarget: reviewedTarget({ targetId: identifier }),
      }));
      const intentDecision = evaluateSlackLiveDeliveryActivationGate(readyInput({
        deliveryIntent: deliveryIntent({ targetId: identifier }),
      }));
      const labelDecision = evaluateSlackLiveDeliveryActivationGate(readyInput({
        reviewedTarget: reviewedTarget({ targetLabel: identifier }),
      }));

      expect(targetDecision).toMatchObject({ status: 'blocked', reason: 'target_invalid' });
      expect(intentDecision).toMatchObject({ status: 'blocked', reason: 'delivery_intent_invalid' });
      expect(labelDecision).toMatchObject({ status: 'blocked', reason: 'target_invalid' });
      expect(JSON.stringify(targetDecision)).not.toContain(identifier);
      expect(JSON.stringify(intentDecision)).not.toContain(identifier);
      expect(JSON.stringify(labelDecision)).not.toContain(identifier);
    }

    const opaqueCredentialDecision = evaluateSlackLiveDeliveryActivationGate(readyInput({
      reviewedTarget: reviewedTarget({
        connectorKind: 'generic-webhook',
        workspaceId: undefined,
        workspaceLabel: undefined,
        targetKind: 'webhook-reference',
        eventScope: 'webhook-alert',
        targetId: 'webhook-reference-case-alerts',
        targetLabel: 'Case alert webhook reference',
        targetProvenance: 'reviewed-webhook-reference',
      }),
      reviewedConsent: reviewedConsent({
        connectorKind: 'generic-webhook',
        workspaceId: undefined,
        targetId: 'webhook-reference-case-alerts',
        eventScope: 'webhook-alert',
      }),
      credentialReference: credentialReference({
        kind: 'os-keychain',
        storageOwner: 'operating-system',
        id: 'macos-login:messaging/generic-webhook/workspace-1',
        providerId: 'generic-webhook',
        accountId: undefined,
      }),
      noisePolicy: noisePolicy({
        connectorKind: 'generic-webhook',
        eventScope: 'webhook-alert',
      }),
      deliveryIntent: deliveryIntent({
        connectorKind: 'generic-webhook',
        workspaceId: undefined,
        targetId: 'webhook-reference-case-alerts',
        eventScope: 'webhook-alert',
        actionIntent: 'webhook-delivery',
      }),
    }));

    expect(opaqueCredentialDecision).toMatchObject({
      status: 'ready',
      ready: true,
      executable: false,
      willCallWebhook: false,
    });
  });

  it('rejects callback, requester, fetch, socket, storage, executable, and live-action fields anywhere in caller input', () => {
    for (const extraField of [
      { callback: { url: 'https://example.test/callback' } },
      { requester: { host: '127.0.0.1' } },
      { fetchPlan: { method: 'POST' } },
      { socketPlan: { host: '127.0.0.1', port: 443 } },
      { storageAdapter: { kind: 'localStorage' } },
      { executable: true },
      { liveAction: 'post-now' },
    ]) {
      expect(evaluateSlackLiveDeliveryActivationGate(readyInput({
        deliveryIntent: {
          ...deliveryIntent(),
          ...extraField,
        },
      }))).toMatchObject({
        status: 'blocked',
        reason: 'runtime_shape_forbidden',
        willFetch: false,
        willOpenSocket: false,
        willMutateStorage: false,
      });
    }
  });

  it('fails closed on VENDOR or employer-branded returned metadata and on reviewed binding drift', () => {
    expect(evaluateSlackLiveDeliveryActivationGate(readyInput({
      reviewedTarget: reviewedTarget({
        workspaceLabel: 'VENDOR SOC Workspace',
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'VENDOR_or_employer_branding_forbidden',
    });

    expect(evaluateSlackLiveDeliveryActivationGate(readyInput({
      reviewedConsent: reviewedConsent({
        targetId: 'other-target',
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'delivery_intent_binding_invalid',
    });

    expect(evaluateSlackLiveDeliveryActivationGate(readyInput({
      credentialReference: credentialReference({
        accountId: 'other-workspace',
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'credential_reference_owner_invalid',
    });
  });

  it('requires reviewed target, consent, credential reference, noise policy, and no-auto-post delivery intent before returning ready metadata', () => {
    expect(evaluateSlackLiveDeliveryActivationGate(trusted({
      reviewedConsent: reviewedConsent(),
      credentialReference: credentialReference(),
      noisePolicy: noisePolicy(),
      deliveryIntent: deliveryIntent(),
      now: NOW,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'target_missing',
    });

    expect(evaluateSlackLiveDeliveryActivationGate(readyInput({
      reviewedTarget: reviewedTarget({
        reviewState: 'draft' as never,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'target_unreviewed',
    });

    expect(evaluateSlackLiveDeliveryActivationGate(readyInput({
      reviewedConsent: reviewedConsent({
        expiresAt: NOW,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'consent_expired',
    });

    expect(evaluateSlackLiveDeliveryActivationGate(readyInput({
      reviewedConsent: reviewedConsent({
        issuedAt: NOW + 1_000,
        expiresAt: NOW + 60_000,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'consent_invalid',
    });

    expect(evaluateSlackLiveDeliveryActivationGate(readyInput({
      reviewedConsent: reviewedConsent({
        issuedAt: NOW + 60_000,
        expiresAt: NOW + 1_000,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'consent_invalid',
    });

    expect(evaluateSlackLiveDeliveryActivationGate(readyInput({
      deliveryIntent: deliveryIntent({
        noAutoPost: false,
      } as unknown as Partial<SlackLiveDeliveryIntent>),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'delivery_intent_invalid',
    });
  });
});
