import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateProtonMailAuthReadinessBoundary,
  type ProtonMailAuthCapabilityFact,
  type ProtonMailLocalBridgeFact,
  type ProtonMailManualSetupEvidence,
} from '../lib/proton-mail-auth-readiness-boundary';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function capabilityFact(
  overrides: Partial<ProtonMailAuthCapabilityFact> = {},
): ProtonMailAuthCapabilityFact {
  return {
    contract: 'proton-mail-auth-capability-fact-v1',
    providerId: 'proton-bridge',
    providerFamily: 'proton',
    readinessOwner: 'proton-mail-auth-readiness-boundary',
    capabilityMode: 'reviewed-proton-bridge',
    reviewState: 'reviewed',
    authModel: 'bridge-assisted',
    setupMode: 'requires-reviewed-local-bridge-prerequisites',
    webLoginParity: false,
    credentialsManagedOutsideThreatCaddy: true,
    localBridgeReferenceOnly: true,
    notesReviewed: true,
    ...overrides,
  };
}

function localBridgeFact(
  overrides: Partial<ProtonMailLocalBridgeFact> = {},
): ProtonMailLocalBridgeFact {
  return {
    contract: 'proton-mail-local-bridge-fact-v1',
    providerId: 'proton-bridge',
    capabilityMode: 'reviewed-proton-bridge',
    reviewState: 'reviewed',
    localBridgeKind: 'proton-bridge-app',
    bridgeManagedOutsideThreatCaddy: true,
    loopbackOnly: true,
    localBridgeReferenceOnly: true,
    secretMaterialStoredOutsideThreatCaddy: true,
    manualSetupEvidenceId: 'proton-manual-evidence-1',
    ...overrides,
  };
}

function manualSetupEvidence(
  overrides: Partial<ProtonMailManualSetupEvidence> = {},
): ProtonMailManualSetupEvidence {
  return {
    contract: 'proton-mail-manual-setup-evidence-v1',
    providerId: 'proton-bridge',
    capabilityMode: 'reviewed-proton-bridge',
    reviewState: 'reviewed',
    evidenceProfile: 'reviewed-proton-bridge-prerequisites',
    localCredentialsManagedOutsideThreatCaddy: true,
    localBridgeReferenceReviewed: true,
    manualAnalystConfirmation: true,
    oauthParityRejected: true,
    noBrowserCredentialEntry: true,
    noProviderExecutionClaim: true,
    evidenceId: 'proton-manual-evidence-1',
    ...overrides,
  };
}

describe('proton mail auth readiness boundary', () => {
  it('returns frozen plan-only metadata for a reviewed Proton Bridge capability', () => {
    const decision = evaluateProtonMailAuthReadinessBoundary({
      capabilityFact: capabilityFact(),
      localBridgeFact: localBridgeFact(),
      manualSetupEvidence: manualSetupEvidence(),
    });

    expect(decision).toMatchObject({
      status: 'ready',
      ready: true,
      reason: 'proton_mail_auth_readiness_ready',
      plan: {
        contract: 'proton-mail-auth-readiness-plan-v1',
        providerId: 'proton-bridge',
        providerFamily: 'proton',
        readinessOwner: 'proton-mail-auth-readiness-boundary',
        capabilityMode: 'reviewed-proton-bridge',
        authModel: 'bridge-assisted',
        setupMode: 'requires-reviewed-local-bridge-prerequisites',
        localBridgeKind: 'proton-bridge-app',
        localBridgeReferenceOnly: true,
        credentialsManagedOutsideThreatCaddy: true,
        webLoginParity: false,
        manualSetupEvidenceId: 'proton-manual-evidence-1',
        manualSetupEvidenceProfile: 'reviewed-proton-bridge-prerequisites',
        reviewedCapabilityMode: true,
        executable: false,
        sideEffects: 'none',
        sideEffectBoundary: 'metadata-only-no-fetch-no-socket-no-storage-no-provider-no-credentials',
      },
      canPrepareFutureProtonMailReadinessPlan: true,
      executable: false,
      sideEffects: 'none',
      willFetch: false,
      willOpenSocket: false,
      willMutateStorage: false,
      willCollectCredential: false,
      willCallProvider: false,
      willProbeBridge: false,
      webLoginParity: false,
      sideEffectBoundary: 'proton-mail-auth-readiness-boundary-metadata-only-no-fetch-no-socket-no-storage-no-provider-no-credentials',
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.plan)).toBe(true);
  });

  it('distinguishes a reviewed manual local bridge profile from Proton Bridge mode', () => {
    const decision = evaluateProtonMailAuthReadinessBoundary({
      capabilityFact: capabilityFact({
        capabilityMode: 'reviewed-manual-local-bridge',
        authModel: 'manual-local-bridge',
      }),
      localBridgeFact: localBridgeFact({
        capabilityMode: 'reviewed-manual-local-bridge',
        localBridgeKind: 'manual-local-proxy',
        manualSetupEvidenceId: 'manual-proxy-evidence-1',
      }),
      manualSetupEvidence: manualSetupEvidence({
        capabilityMode: 'reviewed-manual-local-bridge',
        evidenceProfile: 'reviewed-manual-local-bridge-prerequisites',
        evidenceId: 'manual-proxy-evidence-1',
      }),
    });

    expect(decision).toMatchObject({
      status: 'ready',
      reason: 'proton_mail_auth_readiness_ready',
      plan: {
        capabilityMode: 'reviewed-manual-local-bridge',
        authModel: 'manual-local-bridge',
        localBridgeKind: 'manual-local-proxy',
        manualSetupEvidenceProfile: 'reviewed-manual-local-bridge-prerequisites',
        executable: false,
        sideEffects: 'none',
      },
    });
  });

  it('fails closed when OAuth-like parity or mismatched provider/mode claims are supplied', () => {
    expect(evaluateProtonMailAuthReadinessBoundary({
      capabilityFact: {
        ...capabilityFact(),
        webLoginParity: true,
      } as never,
      localBridgeFact: localBridgeFact(),
      manualSetupEvidence: manualSetupEvidence(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'oauth_parity_claim_forbidden',
      canPrepareFutureProtonMailReadinessPlan: false,
    });

    expect(evaluateProtonMailAuthReadinessBoundary({
      capabilityFact: capabilityFact(),
      localBridgeFact: localBridgeFact({
        capabilityMode: 'reviewed-manual-local-bridge',
        localBridgeKind: 'manual-local-proxy',
      }),
      manualSetupEvidence: manualSetupEvidence(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'provider_identity_mismatch',
    });
  });

  it('rejects runtime-shaped fields, callback/requester execution claims, and functions', () => {
    const result = evaluateProtonMailAuthReadinessBoundary({
      capabilityFact: {
        ...capabilityFact(),
        callbackUrl: 'http://127.0.0.1:8766/callback',
      } as never,
      localBridgeFact: localBridgeFact(),
      manualSetupEvidence: manualSetupEvidence(),
    });

    expect(result).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
      executable: false,
      willFetch: false,
      willOpenSocket: false,
      willMutateStorage: false,
      willProbeBridge: false,
    });

    expect(evaluateProtonMailAuthReadinessBoundary({
      capabilityFact: capabilityFact(),
      localBridgeFact: localBridgeFact(),
      manualSetupEvidence: {
        ...manualSetupEvidence(),
        requester: {
          execute: () => undefined,
        },
      } as never,
    })).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
    });
  });

  it('rejects Proton secrets, OAuth tokens, passwords, and bearer material without network or storage side effects', () => {
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

    const decision = evaluateProtonMailAuthReadinessBoundary({
      capabilityFact: capabilityFact(),
      localBridgeFact: {
        ...localBridgeFact(),
        bridgePassword: 'synthetic-bridge-password',
      } as never,
      manualSetupEvidence: {
        ...manualSetupEvidence(),
        bearerHeader: 'Bearer synthetic-secret-token',
      } as never,
    });
    const serialized = JSON.stringify(decision);

    expect(decision).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
      executable: false,
      willFetch: false,
      willOpenSocket: false,
      willMutateStorage: false,
      willCollectCredential: false,
      willCallProvider: false,
      willProbeBridge: false,
    });
    expect(serialized).not.toContain('synthetic-bridge-password');
    expect(serialized).not.toContain('synthetic-secret-token');
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
