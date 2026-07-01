import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
import type {
  ProviderLiveActivationAccountIntentFact,
  ProviderLiveActivationActionScopeFact,
  ProviderLiveActivationConsentSessionFact,
  ProviderLiveActivationProviderIdentityFact,
  ProviderLiveActivationRuntimeOwnershipFact,
} from '../lib/provider-live-activation-gate';
import { evaluateProviderLiveActivationGate } from '../lib/provider-live-activation-gate';
import {
  createProviderRuntimeActivationPlan,
  type ProviderRuntimeActivationActionBinding,
  type ProviderRuntimeActivationOwnerReview,
} from '../lib/provider-runtime-activation-plan';
import {
  createRuntimeTrustedContractObject,
  type RuntimeTrustedContractEntry,
  type RuntimeTrustedContractObject,
  type RuntimeTrustedContractValue,
} from '../lib/runtime-trusted-contract-object';

const NOW = 1_800_000_000_000;

function trustedValue(value: unknown): RuntimeTrustedContractValue {
  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(trustedValue);
  if (typeof value === 'object') return trustedObject(value as Record<string, unknown>);
  throw new TypeError('Trusted provider fixture cannot include executable values.');
}
function trustedObject(value: Record<string, unknown>): RuntimeTrustedContractObject {
  return createRuntimeTrustedContractObject(
    Object.entries(value).map(([k, v]) => [k, trustedValue(v)] as RuntimeTrustedContractEntry),
  );
}

function providerIdentity(
  overrides: Partial<ProviderLiveActivationProviderIdentityFact> = {},
): ProviderLiveActivationProviderIdentityFact {
  return {
    contract: 'provider-live-identity-v1',
    reviewState: 'reviewed',
    providerId: 'google-gmail',
    providerLabel: 'Google Gmail',
    runtimeOwner: 'provider-runtime-adapter',
    providerIdentityReviewed: true,
    ...overrides,
  };
}

function accountIntent(
  overrides: Partial<ProviderLiveActivationAccountIntentFact> = {},
): ProviderLiveActivationAccountIntentFact {
  return {
    contract: 'provider-live-account-intent-v1',
    reviewState: 'reviewed',
    providerId: 'google-gmail',
    accountId: 'analyst@example.test',
    credentialReferenceId: 'provider-oauth:google-gmail-analyst-ref',
    accountIntentReviewed: true,
    ...overrides,
  };
}

function actionScope(
  overrides: Partial<ProviderLiveActivationActionScopeFact> = {},
): ProviderLiveActivationActionScopeFact {
  return {
    contract: 'provider-live-action-scope-v1',
    reviewState: 'reviewed',
    providerId: 'google-gmail',
    accountId: 'analyst@example.test',
    credentialReferenceId: 'provider-oauth:google-gmail-analyst-ref',
    scopeId: 'google-gmail:auth-sync-send',
    actions: Object.freeze(['provider_auth', 'provider_sync', 'provider_send']),
    sendRequiresExplicitUserApproval: true,
    actionScopeReviewed: true,
    ...overrides,
  };
}

function credentialReference(
  overrides: Partial<ConnectorCredentialReference> = {},
): ConnectorCredentialReference {
  return {
    schemaVersion: 1,
    kind: 'provider-managed-oauth',
    id: 'provider-oauth:google-gmail-analyst-ref',
    storageOwner: 'external-provider',
    providerId: 'google-gmail',
    connectorId: 'provider-runtime-adapter',
    accountId: 'analyst@example.test',
    displayName: 'Reviewed Gmail OAuth reference',
    createdAt: NOW - 10_000,
    ...overrides,
  };
}

function consentSession(
  overrides: Partial<ProviderLiveActivationConsentSessionFact> = {},
): ProviderLiveActivationConsentSessionFact {
  return {
    contract: 'provider-live-consent-session-v1',
    reviewState: 'reviewed',
    providerId: 'google-gmail',
    accountId: 'analyst@example.test',
    credentialReferenceId: 'provider-oauth:google-gmail-analyst-ref',
    scopeId: 'google-gmail:auth-sync-send',
    userConsentGranted: true,
    sessionFresh: true,
    issuedAt: NOW - 20_000,
    reviewedAt: NOW - 10_000,
    expiresAt: NOW + 60_000,
    ...overrides,
  };
}

function runtimeOwnership(
  overrides: Partial<ProviderLiveActivationRuntimeOwnershipFact> = {},
): ProviderLiveActivationRuntimeOwnershipFact {
  return {
    contract: 'provider-live-runtime-ownership-v1',
    reviewState: 'reviewed',
    runtimeOwner: 'provider-runtime-adapter',
    runtimeId: 'provider-runtime-adapter.v1',
    providerId: 'google-gmail',
    accountId: 'analyst@example.test',
    credentialReferenceId: 'provider-oauth:google-gmail-analyst-ref',
    scopeId: 'google-gmail:auth-sync-send',
    supportedActions: Object.freeze(['provider_auth', 'provider_sync', 'provider_send']),
    noSendWithoutUserApproval: true,
    runtimeOwnershipReviewed: true,
    ...overrides,
  };
}

function liveActivationDecision(overrides: Record<string, unknown> = {}) {
  return {
    ...evaluateProviderLiveActivationGate(
      trustedObject({
        providerIdentity: providerIdentity(),
        accountIntent: accountIntent(),
        actionScope: actionScope(),
        credentialReference: credentialReference(),
        consentSession: consentSession(),
        runtimeOwnership: runtimeOwnership(),
        now: NOW,
      }) as unknown as Parameters<typeof evaluateProviderLiveActivationGate>[0],
    ),
    ...overrides,
  };
}

function runtimeOwnerReview(
  overrides: Partial<ProviderRuntimeActivationOwnerReview> = {},
): ProviderRuntimeActivationOwnerReview {
  return {
    contract: 'provider-runtime-activation-owner-review-v1',
    reviewState: 'reviewed',
    runtimeOwner: 'provider-runtime-adapter',
    runtimeId: 'provider-runtime-adapter.v1',
    providerId: 'google-gmail',
    connectorId: 'provider-runtime-adapter',
    accountId: 'analyst@example.test',
    credentialReferenceId: 'provider-oauth:google-gmail-analyst-ref',
    supportedActions: Object.freeze(['provider_auth', 'provider_sync', 'provider_send']),
    noAutoSend: true,
    runtimeOwnerReviewed: true,
    ...overrides,
  };
}

function actionBinding(
  overrides: Partial<ProviderRuntimeActivationActionBinding> = {},
): ProviderRuntimeActivationActionBinding {
  return {
    contract: 'provider-runtime-activation-action-binding-v1',
    reviewState: 'reviewed',
    providerId: 'google-gmail',
    connectorId: 'provider-runtime-adapter',
    runtimeId: 'provider-runtime-adapter.v1',
    accountId: 'analyst@example.test',
    credentialReferenceId: 'provider-oauth:google-gmail-analyst-ref',
    action: 'provider_sync',
    requiresUserApprovalBeforeSend: true,
    noAutoSend: true,
    actionBindingReviewed: true,
    ...overrides,
  };
}

function readyInput() {
  return {
    liveActivationDecision: liveActivationDecision(),
    runtimeOwnerReview: runtimeOwnerReview(),
    actionBinding: actionBinding(),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('provider runtime activation plan', () => {
  it('returns a frozen non-executable implementation plan for a ready live activation plan plus reviewed runtime bindings', () => {
    const decision = createProviderRuntimeActivationPlan(readyInput());

    expect(decision).toMatchObject({
      status: 'runtime-activation-plan-ready',
      ready: true,
      reason: 'provider_runtime_activation_plan_ready',
      canPrepareFutureProviderRuntimeActivation: true,
      readyForInjectedAdapterExecution: false,
      requiresSeparateApprovalGateForInjectedAdapter: true,
      executable: false,
      sideEffects: 'none',
      plan: {
        contract: 'provider-runtime-activation-implementation-plan-v1',
        providerId: 'google-gmail',
        providerLabel: 'Google Gmail',
        connectorId: 'provider-runtime-adapter',
        runtimeOwner: 'provider-runtime-adapter',
        runtimeId: 'provider-runtime-adapter.v1',
        accountId: 'analyst@example.test',
        scopeId: 'google-gmail:auth-sync-send',
        action: 'provider_sync',
        approvedActionSet: ['provider_auth', 'provider_sync', 'provider_send'],
        sendCapableActionSet: true,
        requiresUserApprovalBeforeSend: true,
        noAutoSend: true,
        requiresSeparateApprovalGateForInjectedAdapter: true,
        injectedAdapterExecutionStillBlocked: true,
        executable: false,
        sideEffects: 'none',
      },
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.plan)).toBe(true);
    expect(Object.isFrozen(decision.plan?.credentialReference)).toBe(true);
    expect(Object.isFrozen(decision.plan?.approvedActionSet)).toBe(true);
  });

  it('rejects raw tokens and secret-bearing input without echoing them', () => {
    const secretValue = 'Bearer never-echo-this-token';
    const decision = createProviderRuntimeActivationPlan({
      ...readyInput(),
      runtimeOwnerReview: {
        ...runtimeOwnerReview(),
        note: secretValue,
      },
    } as unknown as Parameters<typeof createProviderRuntimeActivationPlan>[0]);

    expect(decision).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });
    expect(JSON.stringify(decision)).not.toContain(secretValue);
  });

  it('fails closed on adapter, result, callback, fetch, socket, storage, and executable claims anywhere in input', () => {
    expect(createProviderRuntimeActivationPlan({
      ...readyInput(),
      adapter: { execute: vi.fn() },
    })).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
    });

    expect(createProviderRuntimeActivationPlan({
      ...readyInput(),
      providerResult: { ok: true, message: 'should not be accepted' },
    })).toMatchObject({
      status: 'blocked',
      reason: 'result_payload_forbidden',
    });

    expect(createProviderRuntimeActivationPlan({
      ...readyInput(),
      runtimeOwnerReview: {
        ...runtimeOwnerReview(),
        fetcher: vi.fn(),
      },
    } as unknown as Parameters<typeof createProviderRuntimeActivationPlan>[0])).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
    });
  });

  it('rejects blocked or forged live activation decisions instead of trusting serialized ready/executable claims', () => {
    expect(createProviderRuntimeActivationPlan({
      ...readyInput(),
      liveActivationDecision: {
        ...liveActivationDecision(),
        status: 'blocked',
        mayPrepareLiveActivation: false,
      },
    })).toMatchObject({
      status: 'blocked',
      reason: 'live_activation_plan_not_ready',
    });

    expect(createProviderRuntimeActivationPlan({
      ...readyInput(),
      liveActivationDecision: {
        ...liveActivationDecision(),
        activationPlan: {
          ...liveActivationDecision().activationPlan,
          extraField: 'forged',
        },
      },
    } as unknown as Parameters<typeof createProviderRuntimeActivationPlan>[0])).toMatchObject({
      status: 'blocked',
      reason: 'live_activation_decision_invalid',
    });
  });

  it('revalidates provider, account, connector, runtime, credential, and action ownership locally', () => {
    expect(createProviderRuntimeActivationPlan({
      ...readyInput(),
      runtimeOwnerReview: runtimeOwnerReview({ providerId: 'microsoft-outlook' }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'provider_mismatch',
    });

    expect(createProviderRuntimeActivationPlan({
      ...readyInput(),
      runtimeOwnerReview: runtimeOwnerReview({ accountId: 'other@example.test' }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'account_mismatch',
    });

    expect(createProviderRuntimeActivationPlan({
      ...readyInput(),
      runtimeOwnerReview: runtimeOwnerReview({ connectorId: 'other-runtime' }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'connector_mismatch',
    });

    expect(createProviderRuntimeActivationPlan({
      ...readyInput(),
      actionBinding: actionBinding({ runtimeId: 'other-runtime-id' }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'runtime_id_mismatch',
    });

    expect(createProviderRuntimeActivationPlan({
      ...readyInput(),
      actionBinding: actionBinding({ credentialReferenceId: 'other-reference' }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'credential_reference_mismatch',
    });

    expect(createProviderRuntimeActivationPlan({
      ...readyInput(),
      actionBinding: actionBinding({ action: 'provider_auth' }),
      runtimeOwnerReview: runtimeOwnerReview({
        supportedActions: Object.freeze(['provider_sync']),
      }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'action_not_allowed',
    });
  });

  it('requires explicit no-auto-send posture and send approval even for future runtime binding plans', () => {
    expect(createProviderRuntimeActivationPlan({
      ...readyInput(),
      actionBinding: actionBinding({
        action: 'provider_send',
        requiresUserApprovalBeforeSend: false as never,
      }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'action_binding_invalid',
    });

    expect(createProviderRuntimeActivationPlan({
      ...readyInput(),
      runtimeOwnerReview: runtimeOwnerReview({
        noAutoSend: false as never,
      }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'runtime_owner_review_invalid',
    });

    expect(createProviderRuntimeActivationPlan({
      ...readyInput(),
      liveActivationDecision: liveActivationDecision({
        activationPlan: {
          ...liveActivationDecision().activationPlan,
          requiresUserApprovalBeforeSend: false,
        },
      }),
      actionBinding: actionBinding({ action: 'provider_send' }),
    } as unknown as Parameters<typeof createProviderRuntimeActivationPlan>[0])).toMatchObject({
      status: 'blocked',
      reason: 'live_activation_decision_invalid',
    });
  });
});
