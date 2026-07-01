import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classifyAssistantProviderReadiness,
  type AssistantProviderReadinessInput,
} from '../lib/assistant-provider-readiness';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function makeReference(overrides: Partial<ConnectorCredentialReference> = {}): ConnectorCredentialReference {
  return {
    schemaVersion: 1,
    kind: 'os-keychain',
    id: 'macos-login:threatcaddy/openai/helper-flow',
    storageOwner: 'operating-system',
    providerId: 'openai',
    connectorId: 'assistantcaddy-helper-flow',
    accountId: 'account-1',
    displayName: 'AssistantCaddy helper-flow reference',
    createdAt: 1_800_000_000_000,
    ...overrides,
  };
}

function expectNoSideEffects(input: AssistantProviderReadinessInput): void {
  const fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
  const keySpy = vi.spyOn(Storage.prototype, 'key');
  const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
  const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
  const clearSpy = vi.spyOn(Storage.prototype, 'clear');

  classifyAssistantProviderReadiness(input);

  expect(fetchSpy).not.toHaveBeenCalled();
  expect(getItemSpy).not.toHaveBeenCalled();
  expect(keySpy).not.toHaveBeenCalled();
  expect(setItemSpy).not.toHaveBeenCalled();
  expect(removeItemSpy).not.toHaveBeenCalled();
  expect(clearSpy).not.toHaveBeenCalled();
}

describe('AssistantCaddy provider readiness contract', () => {
  it('keeps an absent helper-flow route unavailable while preserving CaddyAI baseline state', () => {
    expect(classifyAssistantProviderReadiness({ caddyAiBaselineConfigured: true })).toEqual({
      status: 'unavailable',
      blockReasons: [],
      caddyAiBaselineConfigured: true,
      sideEffectBoundary: 'metadata-only-no-fetch-no-socket-no-storage-no-llm',
    });
  });

  it('marks a remote provider as ready only for an explicit user test after opaque credential validation', () => {
    const readiness = classifyAssistantProviderReadiness({
      provider: 'openai',
      model: 'gpt-4.1',
      credentialReference: makeReference(),
      explicitUserTestConsent: true,
      caddyAiBaselineConfigured: true,
    });

    expect(readiness).toMatchObject({
      status: 'explicit-user-test-ready',
      provider: 'openai',
      model: 'gpt-4.1',
      credentialReference: makeReference(),
      blockReasons: [],
      caddyAiBaselineConfigured: true,
      sideEffectBoundary: 'metadata-only-no-fetch-no-socket-no-storage-no-llm',
    });
  });

  it('classifies a matching passed explicit user test as configured', () => {
    const credentialReference = makeReference();
    const readiness = classifyAssistantProviderReadiness({
      provider: 'openai',
      model: 'gpt-4.1',
      credentialReference,
      explicitUserTestConsent: true,
      explicitUserTestResult: {
        status: 'passed',
        route: 'openai',
        model: 'gpt-4.1',
        credentialReferenceId: credentialReference.id,
        testedAt: 1_800_000_010_000,
      },
    });

    expect(readiness.status).toBe('configured');
    expect(readiness.blockReasons).toEqual([]);
  });

  it('blocks unsupported, incomplete, ambiguous, and failed provider states', () => {
    expect(classifyAssistantProviderReadiness({
      provider: 'vendor-code-assist',
      model: 'future-model',
      credentialReference: makeReference({ providerId: 'vendor-code-assist' }),
      explicitUserTestConsent: true,
    })).toMatchObject({
      status: 'blocked',
      blockReasons: ['unsupported_provider_route'],
    });

    expect(classifyAssistantProviderReadiness({
      provider: 'gemini',
      credentialReference: makeReference({ providerId: 'gemini' }),
      explicitUserTestConsent: true,
    })).toMatchObject({
      status: 'blocked',
      blockReasons: ['missing_model'],
    });

    const credentialReference = makeReference();
    expect(classifyAssistantProviderReadiness({
      provider: 'openai',
      model: 'gpt-4.1',
      credentialReference,
      explicitUserTestConsent: true,
      explicitUserTestResult: {
        status: 'passed',
        route: 'openai',
        model: 'gpt-4o-mini',
        credentialReferenceId: credentialReference.id,
        testedAt: 1_800_000_010_000,
      },
    })).toMatchObject({
      status: 'blocked',
      blockReasons: ['ambiguous_provider_state'],
    });

    expect(classifyAssistantProviderReadiness({
      provider: 'openai',
      model: 'gpt-4.1',
      credentialReference,
      explicitUserTestConsent: true,
      explicitUserTestResult: {
        status: 'failed',
        route: 'openai',
        model: 'gpt-4.1',
        credentialReferenceId: credentialReference.id,
        testedAt: 1_800_000_010_000,
      },
    })).toMatchObject({
      status: 'blocked',
      blockReasons: ['failed_explicit_user_test'],
    });
  });

  it('blocks raw secret material and missing credential references instead of treating CaddyAI keys as AssistantCaddy setup', () => {
    const readiness = classifyAssistantProviderReadiness({
      provider: 'openai',
      model: 'gpt-4.1',
      credentialReference: {
        schemaVersion: 1,
        kind: 'os-keychain',
        id: 'macos-login:threatcaddy/openai/helper-flow',
        storageOwner: 'operating-system',
        accessToken: 'sk-synthetic-placeholder',
      },
      explicitUserTestConsent: true,
      caddyAiBaselineConfigured: true,
    });

    expect(readiness).toMatchObject({
      status: 'blocked',
      blockReasons: expect.arrayContaining(['raw_secret_material', 'invalid_credential_reference']),
      credentialRejectReason: 'secret_material_detected',
      caddyAiBaselineConfigured: true,
    });
    expect(JSON.stringify(readiness)).not.toContain('sk-synthetic-placeholder');

    expect(classifyAssistantProviderReadiness({
      provider: 'openai',
      model: 'gpt-4.1',
      explicitUserTestConsent: true,
      caddyAiBaselineConfigured: true,
    })).toMatchObject({
      status: 'blocked',
      blockReasons: ['missing_credential_reference'],
      caddyAiBaselineConfigured: true,
    });
  });

  it('blocks local helper-flow probing until endpoint metadata is valid and explicit consent is present', () => {
    const credentialReference = makeReference({
      kind: 'local-bridge',
      id: 'local-bridge:llm/helper-flow',
      storageOwner: 'local-bridge',
      providerId: 'local',
    });
    const blocked = classifyAssistantProviderReadiness({
      provider: 'local',
      model: 'llama3.1',
      credentialReference,
      localEndpointCandidates: [
        'https://example.com/v1',
        'http://127.0.0.1:11434/v1?api_key=synthetic',
      ],
      explicitUserTestConsent: true,
    });

    expect(blocked).toMatchObject({
      status: 'blocked',
      blockReasons: expect.arrayContaining(['invalid_local_endpoint']),
      localBridgePlan: expect.objectContaining({
        status: 'blocked_no_valid_candidates',
        sideEffectBoundary: 'plan-only-no-fetch-no-socket-no-storage',
      }),
    });

    const consentBlocked = classifyAssistantProviderReadiness({
      provider: 'local',
      model: 'llama3.1',
      credentialReference,
      localEndpointCandidates: ['127.0.0.1:11434/v1'],
    });

    expect(consentBlocked).toMatchObject({
      status: 'blocked',
      blockReasons: ['missing_explicit_consent'],
      localBridgePlan: expect.objectContaining({
        allowed: false,
        consentRequired: true,
      }),
    });
    expect(consentBlocked.localBridgePlan?.candidates[0].probe).toMatchObject({
      allowed: false,
      sideEffectBoundary: 'plan-only-no-fetch-no-socket',
    });
  });

  it('marks a local helper-flow route as explicit-user-test-ready with consent but still performs no probe', () => {
    const credentialReference = makeReference({
      kind: 'local-bridge',
      id: 'local-bridge:llm/helper-flow',
      storageOwner: 'local-bridge',
      providerId: 'local',
    });
    const readiness = classifyAssistantProviderReadiness({
      provider: 'local',
      model: 'llama3.1',
      credentialReference,
      localEndpointCandidates: ['127.0.0.1:11434/v1'],
      explicitUserTestConsent: true,
    });

    expect(readiness).toMatchObject({
      status: 'explicit-user-test-ready',
      provider: 'local',
      model: 'llama3.1',
      blockReasons: [],
      localBridgePlan: expect.objectContaining({
        allowed: true,
        consentRequired: false,
        acceptedCount: 1,
      }),
    });
    expect(readiness.localBridgePlan?.candidates[0]).toMatchObject({
      normalizedEndpoint: 'http://127.0.0.1:11434/v1',
      probe: expect.objectContaining({
        url: 'http://127.0.0.1:11434/health',
        allowed: true,
        sideEffectBoundary: 'plan-only-no-fetch-no-socket',
      }),
    });
  });

  it('performs no fetch, storage, socket, model, OAuth, or credential side effects', () => {
    expectNoSideEffects({
      provider: 'local',
      model: 'llama3.1',
      credentialReference: makeReference({
        kind: 'local-bridge',
        id: 'local-bridge:llm/helper-flow',
        storageOwner: 'local-bridge',
        providerId: 'local',
      }),
      localEndpointCandidates: ['127.0.0.1:11434/v1'],
      explicitUserTestConsent: true,
    });
  });
});
