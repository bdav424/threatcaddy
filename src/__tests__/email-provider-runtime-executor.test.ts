import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
import {
  createEmailConnectionConsentContract,
  recordEmailConnectionTestPrerequisite,
  reviewEmailConnectionConsent,
  type EmailConnectionConsentContract,
} from '../lib/email-connection-policy';
import type { EmailProviderActionExplicitConsent, EmailProviderExecutionAction } from '../lib/email-provider-execution-gate';
import { evaluateEmailProviderExecutionGate } from '../lib/email-provider-execution-gate';
import {
  createEmailAccountConfig,
  markEmailAccountConnected,
  type EmailAccountConfig,
  type EmailProviderId,
} from '../lib/email-onboarding';
import {
  executeEmailProviderRuntimeAction as executeEmailProviderRuntimeActionRaw,
  type EmailProviderRuntimeExecutorAdapter,
  type EmailProviderRuntimeLocalTestTransport,
} from '../lib/email-provider-runtime-executor';
import {
  createRuntimeTrustedContractObject,
  type RuntimeTrustedContractObject,
  type RuntimeTrustedContractValue,
} from '../lib/runtime-trusted-contract-object';

const NOW = 1_700_000_000_000;

function makeAccount(
  providerId: EmailProviderId = 'google-gmail',
  overrides: Partial<EmailAccountConfig> = {},
): EmailAccountConfig {
  return {
    ...createEmailAccountConfig({
      id: `${providerId}-account`,
      providerId,
      address: 'analyst@example.test',
      credentialRef: providerId === 'google-gmail' || providerId === 'microsoft-outlook'
        ? { kind: 'oauth-token', id: `${providerId}-oauth-ref`, storedBy: 'external-provider' }
        : { kind: 'local-bridge', id: `${providerId}-bridge-ref`, storedBy: 'local-bridge' },
      now: NOW,
    }),
    status: 'pending',
    ...overrides,
  };
}

function reviewedContract(
  account: EmailAccountConfig,
  overrides: Partial<EmailConnectionConsentContract> = {},
): EmailConnectionConsentContract {
  return {
    ...reviewEmailConnectionConsent(
      createEmailConnectionConsentContract(account, NOW + 10),
      {
        allowRead: true,
        allowDraft: true,
        allowSend: false,
        reviewedAt: NOW + 20,
      },
    ),
    ...overrides,
  };
}

function passedContract(account: EmailAccountConfig): EmailConnectionConsentContract {
  const reviewed = reviewEmailConnectionConsent(
    createEmailConnectionConsentContract(account, NOW + 10),
    {
      allowRead: true,
      allowDraft: true,
      allowSend: true,
      reviewedAt: NOW + 20,
    },
  );
  return recordEmailConnectionTestPrerequisite(reviewed, {
    accountId: account.id,
    providerId: account.providerId,
    ok: true,
    status: 'connected',
    code: 'mock_connected',
    message: 'Mock connection test passed without contacting a provider.',
    testedAt: NOW + 30,
  });
}

function consent(
  action: EmailProviderExecutionAction,
  account: EmailAccountConfig,
  overrides: Partial<EmailProviderActionExplicitConsent> = {},
): EmailProviderActionExplicitConsent {
  return {
    action,
    accountId: account.id,
    providerId: account.providerId,
    granted: true,
    reviewedAt: NOW + 40,
    ...overrides,
  };
}

function providerCredentialReference(account: EmailAccountConfig): ConnectorCredentialReference {
  return {
    schemaVersion: 1,
    kind: 'provider-managed-oauth',
    id: `${account.providerId}-provider-oauth-reference`,
    storageOwner: 'external-provider',
    providerId: account.providerId,
    accountId: account.id,
    connectorId: 'email',
  };
}

function makeAdapter(
  account: EmailAccountConfig,
  overrides: Partial<EmailProviderRuntimeExecutorAdapter> = {},
): EmailProviderRuntimeExecutorAdapter {
  return {
    runtimeOwner: 'email-provider-runtime-adapter',
    accountId: account.id,
    providerId: account.providerId,
    credentialReferenceId: providerCredentialReference(account).id,
    supportedActions: ['start_oauth', 'test_connection', 'sync_mail', 'send_mail'],
    execute: vi.fn(() => ({
      ok: true,
      code: 'adapter-ok',
      message: 'Adapter handled safe request.',
      details: { messageCount: 2, provider: account.providerId },
    })),
    ...overrides,
  };
}

function makeLocalTestTransport(
  account: EmailAccountConfig,
  overrides: Partial<EmailProviderRuntimeLocalTestTransport> = {},
): EmailProviderRuntimeLocalTestTransport {
  return {
    contract: 'email-provider-local-test-transport-v1',
    runtimeOwner: 'email-provider-runtime-local-test-transport',
    accountId: account.id,
    providerId: account.providerId,
    credentialReferenceId: providerCredentialReference(account).id,
    supportedActions: ['start_oauth', 'test_connection', 'sync_mail', 'send_mail'],
    proofMode: 'auth-sync-send-binding',
    executable: false,
    willSend: false,
    willFetch: false,
    willOpenSocket: false,
    willMutateStorage: false,
    sideEffectBoundary: 'local-test-transport-no-provider-sdk-no-oauth-no-fetch-no-socket-no-storage-no-send',
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

function trustedRuntimeInput(value: Record<string, unknown>): Parameters<typeof executeEmailProviderRuntimeActionRaw>[0] {
  return trustedObject(value) as unknown as Parameters<typeof executeEmailProviderRuntimeActionRaw>[0];
}

function executeEmailProviderRuntimeAction(value: Record<string, unknown>) {
  return executeEmailProviderRuntimeActionRaw(trustedRuntimeInput(value));
}

function proxyTrapFixture(target: Record<string, unknown>) {
  const get = vi.fn((nestedTarget: Record<string, unknown>, property: string | symbol, receiver: unknown) => (
    Reflect.get(nestedTarget, property, receiver)
  ));
  const ownKeys = vi.fn((nestedTarget: Record<string, unknown>) => Reflect.ownKeys(nestedTarget));
  const getOwnPropertyDescriptor = vi.fn((nestedTarget: Record<string, unknown>, property: string | symbol) => (
    Reflect.getOwnPropertyDescriptor(nestedTarget, property)
  ));
  const getPrototypeOf = vi.fn((nestedTarget: Record<string, unknown>) => Reflect.getPrototypeOf(nestedTarget));
  const proxy = new Proxy(target, {
    get,
    ownKeys,
    getOwnPropertyDescriptor,
    getPrototypeOf,
  });
  return { proxy, get, ownKeys, getOwnPropertyDescriptor, getPrototypeOf };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('email provider runtime executor facade', () => {
  it('does not call the adapter when the existing execution gate blocks', async () => {
    const account = makeAccount('google-gmail');
    const adapter = makeAdapter(account);

    const result = await executeEmailProviderRuntimeAction({
      action: 'sync_mail',
      account,
      consentContract: reviewedContract(account, { readConsent: 'denied' }),
      explicitConsent: consent('sync_mail', account),
      connectorCredentialReference: providerCredentialReference(account),
      adapter,
    });

    expect(result).toMatchObject({
      status: 'blocked',
      executed: false,
      adapterCalled: false,
      reason: 'gate_blocked',
      gateReason: 'read_consent_not_granted',
      willSend: false,
    });
    expect(adapter.execute).not.toHaveBeenCalled();
  });

  it('blocks injected adapter execution after gate, identity, and credential ownership pass', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');
    const account = makeAccount('google-gmail');
    const credentialReference = providerCredentialReference(account);
    const adapter = makeAdapter(account);

    const result = await executeEmailProviderRuntimeAction({
      action: 'test_connection',
      account,
      consentContract: reviewedContract(account),
      explicitConsent: consent('test_connection', account),
      connectorCredentialReference: credentialReference,
      adapter,
      payload: { probeMode: 'manual-review' },
    });

    expect(result).toMatchObject({
      status: 'blocked',
      executed: false,
      adapterCalled: false,
      reason: 'adapter_execution_not_enabled',
      accountId: account.id,
      providerId: account.providerId,
      gateAllowed: true,
      credentialReference: {
        id: credentialReference.id,
        kind: 'provider-managed-oauth',
        storageOwner: 'external-provider',
        providerId: account.providerId,
        accountId: account.id,
      },
      willSend: false,
      sideEffectBoundary: 'adapter-injected-no-bundled-provider-client-no-secret-storage',
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.credentialReference)).toBe(true);
    expect(result.adapterResult).toBeUndefined();
    expect(adapter.execute).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('executes only the local test transport proof after readiness, consent, credential, and action binding pass', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');
    const account = makeAccount('google-gmail');
    const credentialReference = providerCredentialReference(account);
    const localTestTransport = makeLocalTestTransport(account);
    const adapter = makeAdapter(account);

    for (const action of ['test_connection', 'sync_mail'] as const) {
      const result = await executeEmailProviderRuntimeAction({
        action,
        account,
        consentContract: reviewedContract(account),
        explicitConsent: consent(action, account),
        connectorCredentialReference: credentialReference,
        localTestTransport,
        adapter,
        payload: { proofRequest: 'local-test-only' },
      });

      expect(result).toMatchObject({
        status: 'executed',
        executed: true,
        adapterCalled: false,
        reason: 'local_test_transport_completed',
        accountId: account.id,
        providerId: account.providerId,
        gateAllowed: true,
        willSend: false,
        adapterResult: {
          ok: true,
          code: `local-test-${action}-bound`,
          details: {
            action,
            provider: account.providerId,
            proof: 'auth-sync-send-binding',
            providerCalled: false,
            storageMutated: false,
            sendDispatched: false,
          },
        },
      });
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.adapterResult)).toBe(true);
      expect(Object.isFrozen(result.adapterResult?.details)).toBe(true);
    }

    const pending = makeAccount('microsoft-outlook', { sendPolicy: 'manual_confirm' });
    const sendAccount = markEmailAccountConnected(pending, NOW + 50);
    const sendCredentialReference = providerCredentialReference(sendAccount);
    const sendTransport = makeLocalTestTransport(sendAccount);
    const sendAdapter = makeAdapter(sendAccount);
    const sendResult = await executeEmailProviderRuntimeAction({
      action: 'send_mail',
      account: sendAccount,
      consentContract: passedContract(sendAccount),
      explicitConsent: consent('send_mail', sendAccount),
      connectorCredentialReference: sendCredentialReference,
      manualSendConfirmation: true,
      localTestTransport: sendTransport,
      adapter: sendAdapter,
      payload: {
        draftId: 'draft-1',
        reviewedBy: 'analyst',
      },
    });

    expect(sendResult).toMatchObject({
      status: 'executed',
      executed: true,
      adapterCalled: false,
      reason: 'local_test_transport_completed',
      gateAllowed: true,
      gateReason: 'allowed_inert_provider_action_plan',
      willSend: false,
      adapterResult: {
        ok: true,
        code: 'local-test-send_mail-bound',
        details: {
          action: 'send_mail',
          provider: 'microsoft-outlook',
          sendDispatched: false,
        },
      },
    });
    expect(adapter.execute).not.toHaveBeenCalled();
    expect(sendAdapter.execute).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('blocks before adapter inspection while injected execution is disabled', async () => {
    const account = makeAccount('google-gmail');
    const base = {
      action: 'sync_mail' as const,
      account,
      consentContract: reviewedContract(account),
      explicitConsent: consent('sync_mail', account),
      connectorCredentialReference: providerCredentialReference(account),
    };
    const missingOwnerAdapter = makeAdapter(account, {
      runtimeOwner: undefined as never,
    });
    const unsupportedAdapter = makeAdapter(account, {
      supportedActions: ['test_connection'],
    });

    await expect(executeEmailProviderRuntimeAction(base)).resolves.toMatchObject({
      status: 'blocked',
      reason: 'adapter_execution_not_enabled',
      adapterCalled: false,
    });

    await expect(executeEmailProviderRuntimeAction({
      ...base,
      adapter: missingOwnerAdapter,
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'adapter_execution_not_enabled',
      adapterCalled: false,
    });
    expect(missingOwnerAdapter.execute).not.toHaveBeenCalled();

    await expect(executeEmailProviderRuntimeAction({
      ...base,
      adapter: unsupportedAdapter,
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'adapter_execution_not_enabled',
      adapterCalled: false,
    });
    expect(unsupportedAdapter.execute).not.toHaveBeenCalled();

    const malformedSupportedActionsAdapter = makeAdapter(account, {
      supportedActions: ['sync_mail', 'drop-table'] as never,
    });
    await expect(executeEmailProviderRuntimeAction({
      ...base,
      adapter: malformedSupportedActionsAdapter,
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'adapter_execution_not_enabled',
      adapterCalled: false,
    });
    expect(malformedSupportedActionsAdapter.execute).not.toHaveBeenCalled();

    const malformedCredentialReferenceAdapter = makeAdapter(account, {
      credentialReferenceId: 'https://do-not-trust.example/reference',
    });
    await expect(executeEmailProviderRuntimeAction({
      ...base,
      adapter: malformedCredentialReferenceAdapter,
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'adapter_execution_not_enabled',
      adapterCalled: false,
    });
    expect(malformedCredentialReferenceAdapter.execute).not.toHaveBeenCalled();

    const nonFunctionExecuteAdapter = makeAdapter(account, {
      execute: 'not-a-function' as never,
    });
    await expect(executeEmailProviderRuntimeAction({
      ...base,
      adapter: nonFunctionExecuteAdapter,
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'adapter_execution_not_enabled',
      adapterCalled: false,
    });
  });

  it('rejects caller-provided gate decisions and adapters with mismatched action, account, provider, or credential identity', async () => {
    const gmail = makeAccount('google-gmail');
    const outlook = makeAccount('microsoft-outlook');
    const adapter = makeAdapter(gmail);
    const outlookGate = evaluateEmailProviderExecutionGate({
      action: 'sync_mail',
      account: outlook,
      consentContract: reviewedContract(outlook),
      explicitConsent: consent('sync_mail', outlook),
      connectorCredentialReference: providerCredentialReference(outlook),
    });

    await expect(executeEmailProviderRuntimeAction({
      action: 'sync_mail',
      account: gmail,
      consentContract: reviewedContract(gmail),
      explicitConsent: consent('sync_mail', gmail),
      connectorCredentialReference: providerCredentialReference(gmail),
      gateDecision: outlookGate,
      adapter,
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'gate_decision_invalid',
      adapterCalled: false,
    });
    expect(adapter.execute).not.toHaveBeenCalled();

    await expect(executeEmailProviderRuntimeAction({
      action: 'sync_mail',
      account: gmail,
      consentContract: reviewedContract(gmail),
      explicitConsent: consent('sync_mail', gmail),
      connectorCredentialReference: providerCredentialReference(gmail),
      gateDecision: {
        ...evaluateEmailProviderExecutionGate({
          action: 'sync_mail',
          account: gmail,
          consentContract: reviewedContract(gmail),
          explicitConsent: consent('sync_mail', gmail),
          connectorCredentialReference: providerCredentialReference(gmail),
        }),
        unexpected: 'field',
      } as never,
      adapter,
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'gate_decision_invalid',
      adapterCalled: false,
    });
    expect(adapter.execute).not.toHaveBeenCalled();

    const providerMismatchAdapter = makeAdapter(gmail, { providerId: 'microsoft-outlook' });
    await expect(executeEmailProviderRuntimeAction({
      action: 'sync_mail',
      account: gmail,
      consentContract: reviewedContract(gmail),
      explicitConsent: consent('sync_mail', gmail),
      connectorCredentialReference: providerCredentialReference(gmail),
      adapter: providerMismatchAdapter,
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'adapter_execution_not_enabled',
      adapterCalled: false,
    });
    expect(providerMismatchAdapter.execute).not.toHaveBeenCalled();

    const extraFieldAdapter = makeAdapter(gmail, { requestHeaders: { accept: 'application/json' } } as never);
    await expect(executeEmailProviderRuntimeAction({
      action: 'sync_mail',
      account: gmail,
      consentContract: reviewedContract(gmail),
      explicitConsent: consent('sync_mail', gmail),
      connectorCredentialReference: providerCredentialReference(gmail),
      adapter: extraFieldAdapter,
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'adapter_execution_not_enabled',
      adapterCalled: false,
    });
    expect(extraFieldAdapter.execute).not.toHaveBeenCalled();

    const credentialMismatchAdapter = makeAdapter(gmail, { credentialReferenceId: 'vault:other/email' });
    await expect(executeEmailProviderRuntimeAction({
      action: 'sync_mail',
      account: gmail,
      consentContract: reviewedContract(gmail),
      explicitConsent: consent('sync_mail', gmail),
      connectorCredentialReference: providerCredentialReference(gmail),
      adapter: credentialMismatchAdapter,
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'adapter_execution_not_enabled',
      adapterCalled: false,
    });
    expect(credentialMismatchAdapter.execute).not.toHaveBeenCalled();
  });

  it('rejects malformed or mismatched local test transport contracts without invoking the injected adapter', async () => {
    const account = makeAccount('google-gmail');
    const adapter = makeAdapter(account);
    const base = {
      action: 'sync_mail' as const,
      account,
      consentContract: reviewedContract(account),
      explicitConsent: consent('sync_mail', account),
      connectorCredentialReference: providerCredentialReference(account),
      adapter,
    };

    await expect(executeEmailProviderRuntimeAction({
      ...base,
      localTestTransport: makeLocalTestTransport(account, {
        accountId: 'other-account',
      }),
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'local_test_transport_identity_mismatch',
      adapterCalled: false,
    });

    await expect(executeEmailProviderRuntimeAction({
      ...base,
      localTestTransport: makeLocalTestTransport(account, {
        supportedActions: ['test_connection'],
      }),
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'local_test_transport_action_unsupported',
      adapterCalled: false,
    });

    await expect(executeEmailProviderRuntimeAction({
      ...base,
      localTestTransport: {
        ...makeLocalTestTransport(account),
        fetchPlan: 'https://mail.example.invalid/send',
      } as never,
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'local_test_transport_invalid',
      adapterCalled: false,
    });

    const secretResult = await executeEmailProviderRuntimeAction({
      ...base,
      localTestTransport: makeLocalTestTransport(account, {
        credentialReferenceId: 'sk-do-not-keep-provider-token',
      }),
    });
    expect(secretResult).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
      adapterCalled: false,
    });
    expect(JSON.stringify(secretResult)).not.toContain('sk-do-not-keep-provider-token');
    expect(adapter.execute).not.toHaveBeenCalled();
  });

  it('blocks raw secret material from payloads or adapter metadata and returns only redacted details', async () => {
    const account = makeAccount('google-gmail');
    const adapter = makeAdapter(account);

    const result = await executeEmailProviderRuntimeAction({
      action: 'test_connection',
      account,
      consentContract: reviewedContract(account),
      explicitConsent: consent('test_connection', account),
      connectorCredentialReference: providerCredentialReference(account),
      adapter,
      payload: {
        accessToken: 'sk-do-not-keep',
        notes: 'synthetic-token',
      },
    });

    const serialized = JSON.stringify(result).toLowerCase();
    expect(result).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
      adapterCalled: false,
    });
    expect(adapter.execute).not.toHaveBeenCalled();
    expect(serialized).not.toContain('sk-do-not-keep');
    expect(serialized).not.toContain('accesstoken');

    const secretAdapter = makeAdapter(account, { accessToken: 'sk-adapter-secret' } as never);
    const adapterResult = await executeEmailProviderRuntimeAction({
      action: 'test_connection',
      account,
      consentContract: reviewedContract(account),
      explicitConsent: consent('test_connection', account),
      connectorCredentialReference: providerCredentialReference(account),
      adapter: secretAdapter,
    });

    expect(adapterResult).toMatchObject({
      status: 'blocked',
      reason: 'adapter_execution_not_enabled',
      adapterCalled: false,
    });
    expect(secretAdapter.execute).not.toHaveBeenCalled();
    expect(JSON.stringify(adapterResult).toLowerCase()).not.toContain('sk-adapter-secret');
  });

  it('does not read adapter accessors or proxy traps while injected execution is disabled', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const account = makeAccount('google-gmail');
    const base = {
      action: 'test_connection' as const,
      account,
      consentContract: reviewedContract(account),
      explicitConsent: consent('test_connection', account),
      connectorCredentialReference: providerCredentialReference(account),
    };

    const adapterGetter = vi.fn(() => {
      fetchSpy('https://example.invalid/do-not-call-adapter-getter');
      return makeAdapter(account);
    });
    const accessorInput: Record<string, unknown> = { ...base };
    Object.defineProperty(accessorInput, 'adapter', {
      enumerable: true,
      get: adapterGetter,
    });

    const accessorResult = await executeEmailProviderRuntimeActionRaw(
      accessorInput as unknown as Parameters<typeof executeEmailProviderRuntimeActionRaw>[0],
    );
    expect(accessorResult).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
      adapterCalled: false,
    });
    expect(adapterGetter).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(JSON.stringify(accessorResult)).not.toContain('do-not-call-adapter-getter');

    const targetAdapter = makeAdapter(account);
    const traps = {
      get: vi.fn((target: Record<string, unknown>, property: string | symbol, receiver: unknown) => (
        Reflect.get(target, property, receiver)
      )),
      ownKeys: vi.fn((target: Record<string, unknown>) => Reflect.ownKeys(target)),
      getOwnPropertyDescriptor: vi.fn((target: Record<string, unknown>, property: string | symbol) => (
        Reflect.getOwnPropertyDescriptor(target, property)
      )),
      getPrototypeOf: vi.fn((target: Record<string, unknown>) => Reflect.getPrototypeOf(target)),
    };
    const proxiedAdapter = new Proxy(targetAdapter as unknown as Record<string, unknown>, traps);

    const proxyResult = await executeEmailProviderRuntimeActionRaw({
      ...base,
      adapter: proxiedAdapter as unknown as EmailProviderRuntimeExecutorAdapter,
    });
    expect(proxyResult).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
      adapterCalled: false,
    });
    expect(targetAdapter.execute).not.toHaveBeenCalled();
    expect(traps.get).not.toHaveBeenCalled();
    expect(traps.ownKeys).not.toHaveBeenCalled();
    expect(traps.getOwnPropertyDescriptor).not.toHaveBeenCalled();
    expect(traps.getPrototypeOf).not.toHaveBeenCalled();
  });

  it('rejects raw root and nested payload proxy or accessor inputs before trap execution', async () => {
    const account = makeAccount('google-gmail');
    const rawRoot = proxyTrapFixture({
      action: 'test_connection',
      account,
      consentContract: reviewedContract(account),
      explicitConsent: consent('test_connection', account),
      connectorCredentialReference: providerCredentialReference(account),
      payload: { proofRequest: 'local-test-only' },
    });

    await expect(executeEmailProviderRuntimeActionRaw(
      rawRoot.proxy as unknown as Parameters<typeof executeEmailProviderRuntimeActionRaw>[0],
    )).resolves.toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
      adapterCalled: false,
      action: 'start_oauth',
    });
    expect(rawRoot.get).not.toHaveBeenCalled();
    expect(rawRoot.ownKeys).not.toHaveBeenCalled();
    expect(rawRoot.getOwnPropertyDescriptor).not.toHaveBeenCalled();
    expect(rawRoot.getPrototypeOf).not.toHaveBeenCalled();

    const nestedPayload = proxyTrapFixture({ fetchPlan: 'https://example.invalid/do-not-touch' });
    await expect(executeEmailProviderRuntimeActionRaw({
      action: 'test_connection',
      account,
      consentContract: reviewedContract(account),
      explicitConsent: consent('test_connection', account),
      connectorCredentialReference: providerCredentialReference(account),
      payload: nestedPayload.proxy,
    } as unknown as Parameters<typeof executeEmailProviderRuntimeActionRaw>[0])).resolves.toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
      adapterCalled: false,
      action: 'start_oauth',
    });
    expect(nestedPayload.get).not.toHaveBeenCalled();
    expect(nestedPayload.ownKeys).not.toHaveBeenCalled();
    expect(nestedPayload.getOwnPropertyDescriptor).not.toHaveBeenCalled();
    expect(nestedPayload.getPrototypeOf).not.toHaveBeenCalled();

    const payloadGetter = vi.fn(() => ({ fetchPlan: 'https://example.invalid/do-not-touch' }));
    const accessorRoot: Record<string, unknown> = {
      action: 'test_connection',
      account,
      consentContract: reviewedContract(account),
      explicitConsent: consent('test_connection', account),
      connectorCredentialReference: providerCredentialReference(account),
    };
    Object.defineProperty(accessorRoot, 'payload', {
      enumerable: true,
      get: payloadGetter,
    });
    await expect(executeEmailProviderRuntimeActionRaw(
      accessorRoot as unknown as Parameters<typeof executeEmailProviderRuntimeActionRaw>[0],
    )).resolves.toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
      adapterCalled: false,
      action: 'start_oauth',
    });
    expect(payloadGetter).not.toHaveBeenCalled();
  });

  it('rejects callback, requester, fetch, socket, storage, live-action, and precomputed result fields before dispatch', async () => {
    const account = makeAccount('google-gmail');
    const adapter = makeAdapter(account);
    const base = {
      action: 'test_connection' as const,
      account,
      consentContract: reviewedContract(account),
      explicitConsent: consent('test_connection', account),
      connectorCredentialReference: providerCredentialReference(account),
      adapter,
    };

    for (const unsafeField of [
      { callback: vi.fn() },
      { requester: vi.fn() },
      { fetch: vi.fn() },
      { socket: { open: true } },
      { storage: { setItem: vi.fn() } },
      { liveAction: { providerSync: true } },
      { executable: true },
    ]) {
      await expect(executeEmailProviderRuntimeAction({
        ...base,
        ...unsafeField,
      })).resolves.toMatchObject({
        status: 'blocked',
        reason: 'runtime_shape_forbidden',
        adapterCalled: false,
      });
    }

    await expect(executeEmailProviderRuntimeAction({
      ...base,
      payload: { callback: vi.fn() },
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
      adapterCalled: false,
    });

    await expect(executeEmailProviderRuntimeAction({
      ...base,
      providerResult: { ok: true, providerPayload: 'do-not-echo-provider-payload' },
    })).resolves.toMatchObject({
      status: 'blocked',
      reason: 'result_payload_forbidden',
      adapterCalled: false,
    });

    expect(adapter.execute).not.toHaveBeenCalled();
  });

  it('fails closed for malformed root input before provider gate evaluation', async () => {
    await expect(executeEmailProviderRuntimeActionRaw(null as never)).resolves.toMatchObject({
      status: 'blocked',
      executed: false,
      adapterCalled: false,
      action: 'start_oauth',
      reason: 'runtime_shape_forbidden',
      gateAllowed: false,
      gateReason: 'no_account',
      willSend: false,
    });

    await expect(executeEmailProviderRuntimeActionRaw({
      action: 'sync_mail',
      account: null,
      callback: vi.fn(),
    } as never)).resolves.toMatchObject({
      status: 'blocked',
      executed: false,
      adapterCalled: false,
      action: 'start_oauth',
      reason: 'runtime_shape_forbidden',
      gateAllowed: false,
      gateReason: 'no_account',
      willSend: false,
    });
  });

  it('keeps injected adapter results unobserved while adapter execution is disabled', async () => {
    const account = makeAccount('google-gmail');
    const adapters = [
      makeAdapter(account, {
        execute: vi.fn(() => ({
          ok: true,
          code: 'adapter-ok',
          details: {
            accessToken: 'sk-result-secret',
            safeCount: 1,
          },
        })),
      }),
      makeAdapter(account, {
        execute: vi.fn(() => ({
          ok: true,
          code: 'adapter-ok',
          requestHeaders: { accept: 'application/json' },
        })),
      }),
      makeAdapter(account, {
        execute: vi.fn(() => ({
          ok: true,
          code: 'adapter-ok',
          details: {
            requestBody: 'provider payload: do-not-echo-payload',
          },
        })),
      }),
      makeAdapter(account, {
        execute: vi.fn(() => ({
          ok: true,
          code: 'ghp_do_not_echo_provider_result_token',
        })),
      }),
      makeAdapter(account, {
        execute: vi.fn(() => ({
          ok: true,
          code: 'adapter-ok',
          accountId: 'other-account',
        })),
      }),
      makeAdapter(account, {
        execute: vi.fn(() => ({
          ok: true,
          code: 'adapter-ok',
          action: 'sync_mail' as const,
        })),
      }),
      makeAdapter(account, {
        execute: vi.fn(() => ({
          ok: true,
          code: 'adapter-ok',
          providerId: 'microsoft-outlook' as const,
        })),
      }),
      makeAdapter(account, {
        execute: vi.fn(() => ({
          ok: true,
          code: 'adapter-ok',
          credentialReferenceId: 'vault:provider/google-gmail/other',
        })),
      }),
    ];

    for (const adapter of adapters) {
      const result = await executeEmailProviderRuntimeAction({
        action: 'test_connection',
        account,
        consentContract: reviewedContract(account),
        explicitConsent: consent('test_connection', account),
        connectorCredentialReference: providerCredentialReference(account),
        adapter,
      });

      expect(result).toMatchObject({
        status: 'blocked',
        reason: 'adapter_execution_not_enabled',
        adapterCalled: false,
      });
      expect(result.adapterResult).toBeUndefined();
      expect(adapter.execute).not.toHaveBeenCalled();
      expect(JSON.stringify(result).toLowerCase()).not.toMatch(/sk-result-secret|accesstoken|do-not-echo-payload|ghp_do_not_echo_provider_result_token/);
    }
  });

  it('does not call a throwing injected adapter while execution is disabled', async () => {
    const account = makeAccount('google-gmail');
    const adapter = makeAdapter(account, {
      execute: vi.fn(() => {
        throw new Error('Bearer do-not-echo-provider-error-token');
      }),
    });

    const result = await executeEmailProviderRuntimeAction({
      action: 'test_connection',
      account,
      consentContract: reviewedContract(account),
      explicitConsent: consent('test_connection', account),
      connectorCredentialReference: providerCredentialReference(account),
      adapter,
    });

    expect(result).toMatchObject({
      status: 'blocked',
      reason: 'adapter_execution_not_enabled',
      adapterCalled: false,
    });
    expect(result.adapterResult).toBeUndefined();
    expect(adapter.execute).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('do-not-echo-provider-error-token');
  });

  it('keeps send disabled by the current gate willSend=false boundary even after manual-send prerequisites pass', async () => {
    const pending = makeAccount('microsoft-outlook', { sendPolicy: 'manual_confirm' });
    const account = markEmailAccountConnected(pending, NOW + 50);
    const adapter = makeAdapter(account);

    const result = await executeEmailProviderRuntimeAction({
      action: 'send_mail',
      account,
      consentContract: passedContract(account),
      explicitConsent: consent('send_mail', account),
      connectorCredentialReference: providerCredentialReference(account),
      manualSendConfirmation: true,
      adapter,
      payload: {
        draftId: 'draft-1',
        reviewedBy: 'analyst',
      },
    });

    expect(result).toMatchObject({
      status: 'blocked',
      executed: false,
      adapterCalled: false,
      reason: 'send_disabled_by_current_gate',
      gateAllowed: true,
      gateReason: 'allowed_inert_provider_action_plan',
      willSend: false,
    });
    expect(adapter.execute).not.toHaveBeenCalled();
  });

  it('blocks injected OAuth-start adapter handoff until runtime activation allows injected execution', async () => {
    const account = makeAccount('google-gmail', {
      credentialRef: undefined,
      status: 'not_configured',
    });
    const adapter = makeAdapter(account, {
      credentialReferenceId: undefined,
      supportedActions: ['start_oauth'],
      execute: vi.fn(() => ({
        ok: true,
        code: 'oauth-plan-created',
        message: 'Adapter returned an external authorization URL placeholder.',
        details: {
          requiresExternalBrowser: true,
        },
      })),
    });

    const result = await executeEmailProviderRuntimeAction({
      action: 'start_oauth',
      account,
      explicitConsent: consent('start_oauth', account),
      adapter,
    });

    expect(result).toMatchObject({
      status: 'blocked',
      executed: false,
      adapterCalled: false,
      reason: 'adapter_execution_not_enabled',
      credentialReference: undefined,
      willSend: false,
    });
    expect(result.adapterResult).toBeUndefined();
    expect(adapter.execute).not.toHaveBeenCalled();
  });
});
