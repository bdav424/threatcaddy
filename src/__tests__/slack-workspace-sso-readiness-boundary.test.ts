import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateSlackWorkspaceSsoReadinessBoundary,
  type SlackWorkspaceNotificationScopeIntent,
  type SlackWorkspaceSsoWorkspaceIdentity,
} from '../lib/slack-workspace-sso-readiness-boundary';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function workspaceIdentity(
  overrides: Partial<SlackWorkspaceSsoWorkspaceIdentity> = {},
): SlackWorkspaceSsoWorkspaceIdentity {
  return {
    contract: 'slack-workspace-sso-workspace-identity-v1',
    workspaceId: 'T0123',
    workspaceSlug: 'analyst-workspace',
    workspaceDisplayName: 'Analyst Workspace',
    reviewState: 'reviewed',
    identityProviderCategory: 'microsoft',
    providerNeutralLabel: 'Workspace single sign-on',
    workspaceIdentityReviewed: true,
    ...overrides,
  };
}

function notificationScopeIntent(
  overrides: Partial<SlackWorkspaceNotificationScopeIntent> = {},
): SlackWorkspaceNotificationScopeIntent {
  return {
    contract: 'slack-workspace-notification-scope-intent-v1',
    workspaceId: 'T0123',
    reviewState: 'reviewed',
    notificationIntent: 'ioc-alerts',
    scopeIds: Object.freeze(['chat:write', 'incoming-webhook-intent']),
    scopeLabels: Object.freeze(['Post alerts after consent', 'Configure notification endpoint']),
    noAutoPost: true,
    notificationOnly: true,
    userConsentRequired: true,
    workspaceAdminReviewRequired: true,
    ...overrides,
  };
}

describe('slack workspace sso readiness boundary', () => {
  it('returns frozen provider-neutral SSO readiness metadata without executable behavior', () => {
    const decision = evaluateSlackWorkspaceSsoReadinessBoundary({
      workspaceIdentity: workspaceIdentity(),
      notificationScopeIntent: notificationScopeIntent(),
    });

    expect(decision).toMatchObject({
      status: 'ready',
      ready: true,
      reason: 'slack_workspace_sso_readiness_ready',
      plan: {
        contract: 'slack-workspace-sso-readiness-plan-v1',
        workspaceId: 'T0123',
        workspaceSlug: 'analyst-workspace',
        identityProviderCategory: 'microsoft',
        providerNeutralLabel: 'Workspace single sign-on',
        notificationIntent: 'ioc-alerts',
        noAutoPost: true,
        notificationOnly: true,
        executable: false,
        sideEffects: 'none',
      },
      canPrepareFutureSlackWorkspaceSsoPlan: true,
      executable: false,
      sideEffects: 'none',
      willOpenOAuthWindow: false,
      willCallSlackApi: false,
      willCallWebhook: false,
      willFetch: false,
      willOpenSocket: false,
      willMutateStorage: false,
      willCollectCredential: false,
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.plan)).toBe(true);
    expect(Object.isFrozen(decision.plan?.scopeIds)).toBe(true);
    expect(JSON.stringify(decision)).not.toMatch(/VENDOR/i);
  });

  it('fails closed on VENDOR or employer-specific SSO wording', () => {
    expect(evaluateSlackWorkspaceSsoReadinessBoundary({
      workspaceIdentity: workspaceIdentity({
        providerNeutralLabel: 'VENDOR SSO workspace sign-in',
      }),
      notificationScopeIntent: notificationScopeIntent(),
	    })).toMatchObject({
	      status: 'blocked',
	      reason: 'VENDOR_or_employer_branding_forbidden',
	      canPrepareFutureSlackWorkspaceSsoPlan: false,
	    });

	    for (const providerSpecificLabel of ['Google Workspace SSO', 'Okta sign-in', 'Microsoft Entra sign-in']) {
	      expect(evaluateSlackWorkspaceSsoReadinessBoundary({
	        workspaceIdentity: workspaceIdentity({
	          providerNeutralLabel: providerSpecificLabel,
	        }),
	        notificationScopeIntent: notificationScopeIntent(),
	      })).toMatchObject({
	        status: 'blocked',
	        reason: 'workspace_identity_invalid',
	        canPrepareFutureSlackWorkspaceSsoPlan: false,
	      });
	    }
	  });

  it('rejects Slack tokens, webhooks, OAuth codes, and runtime-shaped fields anywhere in input', () => {
    expect(evaluateSlackWorkspaceSsoReadinessBoundary({
      workspaceIdentity: {
        ...workspaceIdentity(),
        botToken: 'xoxb-123456789-secret',
      },
      notificationScopeIntent: notificationScopeIntent(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });

    const requester = vi.fn();
    expect(evaluateSlackWorkspaceSsoReadinessBoundary({
      workspaceIdentity: workspaceIdentity(),
      notificationScopeIntent: {
        ...notificationScopeIntent(),
        webhookUrl: 'https://hooks.slack.com/services/T000/B000/SECRET',
        requester,
      },
    })).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
      willCallWebhook: false,
    });
    expect(requester).not.toHaveBeenCalled();
  });

  it('requires reviewed workspace identity and notification intent before ready metadata', () => {
    expect(evaluateSlackWorkspaceSsoReadinessBoundary({
      notificationScopeIntent: notificationScopeIntent(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'workspace_identity_missing',
    });

    expect(evaluateSlackWorkspaceSsoReadinessBoundary({
      workspaceIdentity: workspaceIdentity({ reviewState: 'draft' as never }),
      notificationScopeIntent: notificationScopeIntent(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'workspace_identity_unreviewed',
    });

	    expect(evaluateSlackWorkspaceSsoReadinessBoundary({
	      workspaceIdentity: workspaceIdentity(),
	      notificationScopeIntent: notificationScopeIntent({ workspaceId: 'T999' }),
	    })).toMatchObject({
	      status: 'blocked',
	      reason: 'workspace_identity_invalid',
	    });

	    expect(evaluateSlackWorkspaceSsoReadinessBoundary({
	      workspaceIdentity: workspaceIdentity(),
	      notificationScopeIntent: notificationScopeIntent({
	        scopeIds: Object.freeze(['chat:write', 'incoming-webhook-intent']),
	        scopeLabels: Object.freeze(['Post alerts after consent']),
	      }),
	    })).toMatchObject({
	      status: 'blocked',
	      reason: 'scope_intent_invalid',
	    });
	  });
});
