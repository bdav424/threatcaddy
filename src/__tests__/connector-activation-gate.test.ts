import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resolveConnectorActivationGate,
  type ConnectorActivationConsentFact,
  type ConnectorRuntimeOwnershipFact,
} from '../lib/connector-activation-gate';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
import { getIntegrationCatalogProvider, getIntegrationCatalogProviders } from '../lib/integration-catalog';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function provider(providerId: string) {
  const catalogProvider = getIntegrationCatalogProvider(providerId);
  if (!catalogProvider) throw new Error(`Missing provider fixture: ${providerId}`);
  return catalogProvider;
}

function credentialReference(overrides: Partial<ConnectorCredentialReference> = {}): ConnectorCredentialReference {
  return {
    schemaVersion: 1,
    kind: 'os-keychain',
    id: 'macos-login:threatcaddy/generic-webhook/account-1',
    storageOwner: 'operating-system',
    providerId: 'generic-webhook',
    connectorId: 'generic-webhook-runtime',
    accountId: 'account-1',
    displayName: 'Generic webhook reference',
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

function consent(overrides: Partial<ConnectorActivationConsentFact> = {}): ConnectorActivationConsentFact {
  return {
    granted: true,
    scope: 'activate-generic-connector',
    providerId: 'generic-webhook',
    targetSurface: 'provider-catalog',
    targetId: 'generic-webhook',
    acknowledgedNoProviderCalls: true,
    ...overrides,
  };
}

function runtime(overrides: Partial<ConnectorRuntimeOwnershipFact> = {}): ConnectorRuntimeOwnershipFact {
  return {
    owner: 'connector-runtime',
    providerId: 'generic-webhook',
    connectorId: 'generic-webhook-runtime',
    targetSurface: 'provider-catalog',
    targetId: 'generic-webhook',
    ...overrides,
  };
}

function blockerCodes(input: Parameters<typeof resolveConnectorActivationGate>[0]) {
  return resolveConnectorActivationGate(input).blockers.map((blocker) => blocker.code);
}

describe('connector activation gate', () => {
  it('keeps every current catalog provider blocked, inert, and free of network or storage side effects', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');

    const decisions = getIntegrationCatalogProviders().map((catalogProvider) => {
      const targetSurface = catalogProvider.nextAction?.targetSurface ?? 'provider-catalog';
      const targetId = catalogProvider.nextAction?.targetId ?? catalogProvider.id;
      return resolveConnectorActivationGate({
        provider: catalogProvider,
        credentialReference: credentialReference({
          id: `macos-login:threatcaddy/${catalogProvider.id}/account-1`,
          providerId: catalogProvider.id,
          connectorId: `${catalogProvider.id}-runtime`,
        }),
        consent: consent({ providerId: catalogProvider.id, targetSurface, targetId }),
        runtime: runtime({
          providerId: catalogProvider.id,
          connectorId: `${catalogProvider.id}-runtime`,
          targetSurface,
          targetId,
        }),
      });
    });

    expect(decisions.length).toBeGreaterThan(0);
    expect(decisions.every((decision) => decision.status === 'blocked')).toBe(true);
    expect(decisions.every((decision) => decision.active === false)).toBe(true);
    expect(decisions.every((decision) => decision.executable === false)).toBe(true);
    expect(decisions.every((decision) => decision.sideEffects === 'none')).toBe(true);
    expect(decisions.every((decision) => decision.blockers.some((blocker) => blocker.code === 'next_action_symbolic'))).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('blocks generic catalog support even when credential, consent, and runtime-shaped facts are present', () => {
    const decision = resolveConnectorActivationGate({
      provider: provider('generic-webhook'),
      credentialReference: credentialReference(),
      consent: consent(),
      runtime: runtime(),
    });

    expect(decision).toMatchObject({
      status: 'blocked',
      providerId: 'generic-webhook',
      targetSurface: 'provider-catalog',
      targetId: 'generic-webhook',
      active: false,
      executable: false,
      sideEffects: 'none',
    });
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'catalog_status_not_live',
      'next_action_symbolic',
    ]));
  });

  it('blocks route-only setup guidance and built-in template references as symbolic nextActions', () => {
    expect(blockerCodes({
      provider: provider('gmail-google'),
      credentialReference: credentialReference({
        id: 'macos-login:threatcaddy/gmail-google/account-1',
        providerId: 'gmail-google',
        connectorId: 'gmail-runtime',
      }),
      consent: consent({
        providerId: 'gmail-google',
        targetSurface: 'assistantcaddy-route',
        targetId: 'assistantcaddy-email-setup',
      }),
      runtime: runtime({
        providerId: 'gmail-google',
        connectorId: 'gmail-runtime',
        targetSurface: 'assistantcaddy-route',
        targetId: 'assistantcaddy-email-setup',
      }),
    })).toEqual(expect.arrayContaining(['catalog_status_not_live', 'next_action_symbolic']));

    expect(blockerCodes({
      provider: provider('virustotal'),
      credentialReference: credentialReference({
        id: 'macos-login:threatcaddy/virustotal/account-1',
        providerId: 'virustotal',
        connectorId: 'virustotal-runtime',
      }),
      consent: consent({
        providerId: 'virustotal',
        targetSurface: 'integration-template',
        targetId: 'virustotal',
      }),
      runtime: runtime({
        providerId: 'virustotal',
        connectorId: 'virustotal-runtime',
        targetSurface: 'integration-template',
        targetId: 'virustotal',
      }),
    })).toEqual(expect.arrayContaining(['catalog_status_not_live', 'next_action_symbolic']));
  });

  it('fails closed for unsafe credentials, missing consent, and missing runtime ownership', () => {
    const decision = resolveConnectorActivationGate({
      provider: provider('generic-webhook'),
      credentialReference: {
        ...credentialReference(),
        accessToken: '[fixture secret-like value]',
      },
    });

    expect(decision.status).toBe('blocked');
    expect(decision.credentialReference).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'credential_reference_invalid',
      'consent_missing',
      'runtime_owner_missing',
    ]));
  });

  it('fails closed for provider, consent, credential, and runtime ownership mismatches', () => {
    const decision = resolveConnectorActivationGate({
      provider: provider('generic-webhook'),
      credentialReference: credentialReference({
        providerId: 'slack',
        connectorId: 'slack-runtime',
      }),
      consent: consent({
        providerId: 'slack',
        targetSurface: 'integration-template',
        targetId: 'slack',
        acknowledgedNoProviderCalls: false,
      }),
      runtime: runtime({
        providerId: 'slack',
        connectorId: 'different-runtime',
        targetSurface: 'integration-template',
        targetId: 'slack',
      }),
    });

    expect(decision.status).toBe('blocked');
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'credential_provider_mismatch',
      'consent_provider_mismatch',
      'consent_target_mismatch',
      'consent_no_provider_calls_not_acknowledged',
      'runtime_provider_mismatch',
      'runtime_target_mismatch',
      'credential_connector_mismatch',
    ]));
  });

  it('fails closed when nextAction target ids are unknown', () => {
    const mutatedProvider = {
      ...provider('generic-webhook'),
      nextAction: {
        kind: 'future-connector',
        label: 'Track unknown connector',
        targetSurface: 'provider-catalog',
        targetId: 'javascript:alert(1)',
        disabledReason: 'fixture disabled reason',
      },
    } as const;

    const decision = resolveConnectorActivationGate({
      provider: mutatedProvider,
      credentialReference: credentialReference(),
      consent: consent({ targetId: 'javascript:alert(1)' }),
      runtime: runtime({ targetId: 'javascript:alert(1)' }),
    });

    expect(decision).toMatchObject({
      status: 'blocked',
      targetSurface: 'provider-catalog',
      targetId: 'javascript:alert(1)',
      active: false,
      executable: false,
    });
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'next_action_rejected',
      'next_action_target_unknown',
      'next_action_symbolic',
    ]));
  });
});
