import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
import type {
  EmailProviderExecutionAction,
  EmailProviderExecutionGateDecision,
} from '../lib/email-provider-execution-gate';
import {
  PROVIDER_AUTH_SYNC_SEND_OPERATIONS_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES,
  PROVIDER_AUTH_SYNC_SEND_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
  PROVIDER_AUTH_SYNC_SEND_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER,
  evaluateProviderAuthSyncSendOperationsImplementationManifest as evaluateRawProviderAuthSyncSendOperationsImplementationManifest,
  type ProviderAuthSyncSendOperationsImplementationManifestInput,
  type ProviderAuthSyncSendOperation,
  type ProviderAuthSyncSendOperationPlan,
} from '../lib/provider-auth-sync-send-operations-implementation-manifest';
import {
  createRuntimeTrustedContractObject,
  type RuntimeTrustedContractEntry,
  type RuntimeTrustedContractValue,
} from '../lib/runtime-trusted-contract-object';

const ACCOUNT_ID = 'google-gmail-account';
const PROVIDER_ID = 'google-gmail' as const;
type TrustedManifestInput = ProviderAuthSyncSendOperationsImplementationManifestInput;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

function trustedFixtureValue(value: unknown): RuntimeTrustedContractValue {
  if (
    value === null
    || value === undefined
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => trustedFixtureValue(item)));
  }
  if (typeof value === 'object') {
    return createRuntimeTrustedContractObject(Object.entries(value as Record<string, unknown>).map(([key, nested]) => (
      [key, trustedFixtureValue(nested)] satisfies RuntimeTrustedContractEntry
    )));
  }
  throw new TypeError('Unsupported provider manifest trusted fixture value.');
}

function trustedManifestInput(input: TrustedManifestInput): TrustedManifestInput {
  try {
    return createRuntimeTrustedContractObject(Object.entries(input).map(([key, value]) => (
      [key, trustedFixtureValue(value)] satisfies RuntimeTrustedContractEntry
    ))) as unknown as TrustedManifestInput;
  } catch {
    return input;
  }
}

function evaluateProviderAuthSyncSendOperationsImplementationManifest(
  input: TrustedManifestInput,
) {
  return evaluateRawProviderAuthSyncSendOperationsImplementationManifest(trustedManifestInput(input));
}

function credentialReference(
  overrides: Partial<ConnectorCredentialReference> = {},
): ConnectorCredentialReference {
  return {
    schemaVersion: 1,
    kind: 'provider-managed-oauth',
    id: 'google-gmail-provider-oauth-reference',
    storageOwner: 'external-provider',
    providerId: PROVIDER_ID,
    accountId: ACCOUNT_ID,
    connectorId: 'email',
    ...overrides,
  };
}

function actionForOperation(operation: ProviderAuthSyncSendOperation): EmailProviderExecutionAction {
  switch (operation) {
    case 'auth':
      return 'start_oauth';
    case 'test_connection':
      return 'test_connection';
    case 'sync_mail':
      return 'sync_mail';
    case 'send_mail':
      return 'send_mail';
  }
}

function gateDecision(
  operation: ProviderAuthSyncSendOperation,
  overrides: Partial<EmailProviderExecutionGateDecision> = {},
): EmailProviderExecutionGateDecision {
  return {
    status: 'allow',
    allowed: true,
    action: actionForOperation(operation),
    reason: 'allowed_inert_provider_action_plan',
    accountId: ACCOUNT_ID,
    providerId: PROVIDER_ID,
    credentialReference: operation === 'auth' ? undefined : credentialReference(),
    willSend: false,
    sideEffectBoundary: 'inert-local-plan-no-fetch-no-oauth-no-sync-no-send-no-storage',
    ...overrides,
  };
}

function operationPlan(
  overrides: Partial<ProviderAuthSyncSendOperationPlan> = {},
): ProviderAuthSyncSendOperationPlan[] {
  return PROVIDER_AUTH_SYNC_SEND_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER.map((operation) => ({
    operation,
    action: actionForOperation(operation),
    gateDecision: gateDecision(operation),
    checkpointRequired: true,
    rollbackRequired: true,
    ...overrides,
  }));
}

function readyInput() {
  return {
    accountId: ACCOUNT_ID,
    providerId: PROVIDER_ID,
    credentialReference: credentialReference(),
    operationPlan: operationPlan(),
    futureWriteSet: PROVIDER_AUTH_SYNC_SEND_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
  };
}

describe('provider auth/sync/send operations implementation manifest', () => {
  it('creates a frozen head-chat-only manifest from inert gate provenance and exact future write set', () => {
    const decision = evaluateProviderAuthSyncSendOperationsImplementationManifest(readyInput());

    expect(decision).toMatchObject({
      status: 'implementation-manifest-ready',
      manifestReady: true,
      reason: 'implementation_manifest_ready',
      manifest: {
        schemaVersion: 1,
        contract: 'provider-auth-sync-send-operations-implementation-manifest-v1',
        manifestOwner: 'assistantcaddy-head-chat-provider-auth-sync-send',
        manifestId: 'assistantcaddy-head-chat-provider-auth-sync-send-manifest',
        manifestVersion: '2026.06.12',
        integrationOwner: 'head-chat',
        integrationScope: 'provider-auth-sync-send-implementation',
        providerId: PROVIDER_ID,
        accountId: ACCOUNT_ID,
        credentialReference: {
          id: 'google-gmail-provider-oauth-reference',
          kind: 'provider-managed-oauth',
          storageOwner: 'external-provider',
          providerId: PROVIDER_ID,
          accountId: ACCOUNT_ID,
          connectorId: 'email',
        },
        operations: PROVIDER_AUTH_SYNC_SEND_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER,
        operationOrder: PROVIDER_AUTH_SYNC_SEND_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER,
        highRiskWriteSet: PROVIDER_AUTH_SYNC_SEND_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
        blockedPathClasses: PROVIDER_AUTH_SYNC_SEND_OPERATIONS_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES,
        checkpointRequired: true,
        rollbackRequired: true,
        headChatReviewRequired: true,
        readyForImplementation: false,
        implementationMode: 'manifest-only',
      },
      canPrepareHeadChatProviderImplementation: true,
      readyForProviderAuthSyncSendImplementation: false,
      mayOpenOAuthWindow: false,
      mayCallProviderSdk: false,
      mayFetch: false,
      mayOpenSocket: false,
      mayStoreCredential: false,
      maySyncMail: false,
      maySendMail: false,
      mayModifySchema: false,
      mayExportOrBackup: false,
      willPromoteStandalone: false,
      sideEffects: 'none',
      sideEffectBoundary:
        'provider-auth-sync-send-implementation-manifest-no-provider-no-network-no-storage-no-oauth-no-sync-no-send',
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.manifest)).toBe(true);
    expect(Object.isFrozen(decision.manifest.credentialReference)).toBe(true);
    expect(Object.isFrozen(decision.manifest.operations)).toBe(true);
    expect(Object.isFrozen(decision.manifest.highRiskWriteSet)).toBe(true);
  });

  it('fails closed for missing plans, reordered operations, mutable gates, and forged executable claims', () => {
    expect(evaluateProviderAuthSyncSendOperationsImplementationManifest({
      ...readyInput(),
      operationPlan: undefined,
    })).toMatchObject({
      status: 'blocked',
      reason: 'operation_plan_missing',
      canPrepareHeadChatProviderImplementation: false,
    });

    expect(evaluateProviderAuthSyncSendOperationsImplementationManifest({
      ...readyInput(),
      operationPlan: [...operationPlan()].reverse(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'operation_order_invalid',
      maySyncMail: false,
      maySendMail: false,
    });

    expect(evaluateProviderAuthSyncSendOperationsImplementationManifest({
      ...readyInput(),
      operationPlan: operationPlan({
        gateDecision: gateDecision('sync_mail', {
          status: 'block',
          allowed: false,
          reason: 'send_policy_blocked',
        }),
      }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'operation_plan_invalid',
    });

    expect(evaluateProviderAuthSyncSendOperationsImplementationManifest({
      ...readyInput(),
      operationPlan: [{
        ...operationPlan()[0],
        gateDecision: {
          ...operationPlan()[0].gateDecision,
          willSend: true,
        } as never,
      }],
    })).toMatchObject({
      status: 'blocked',
      reason: 'forged_executable_claim',
    });

    expect(evaluateProviderAuthSyncSendOperationsImplementationManifest({
      ...readyInput(),
      operationPlan: operationPlan().map((entry) => entry.operation === 'sync_mail'
        ? {
          ...entry,
          gateDecision: gateDecision('sync_mail', {
            credentialReference: credentialReference({ id: 'other-credential-reference' }),
          }),
        }
        : entry),
    })).toMatchObject({
      status: 'blocked',
      reason: 'operation_plan_invalid',
    });

    expect(evaluateProviderAuthSyncSendOperationsImplementationManifest({
      ...readyInput(),
      operationPlan: operationPlan().map((entry, index) => index === 0
        ? {
          ...entry,
          providerClient: 'live-provider-sdk',
        } as never
        : entry),
    })).toMatchObject({
      status: 'blocked',
      reason: 'operation_plan_invalid',
    });
  });

  it('binds credentials to the declared account and provider without echoing token-shaped identifiers', () => {
    expect(evaluateProviderAuthSyncSendOperationsImplementationManifest({
      ...readyInput(),
      credentialReference: credentialReference({ accountId: 'other-account' }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'credential_owner_invalid',
    });

    const tokenDecision = evaluateProviderAuthSyncSendOperationsImplementationManifest({
      ...readyInput(),
      accountId: 'ghp_do_not_echo_this_provider_manifest_token',
    });
    const serialized = JSON.stringify(tokenDecision);

    expect(tokenDecision).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });
    expect(serialized).not.toContain('ghp_do_not_echo_this_provider_manifest_token');
    expect(serialized).not.toContain('google-gmail-provider-oauth-reference');

    for (const unsafeIdentifier of [
      'ftp://example.invalid/path',
      'localhost:4000/path',
      '127.0.0.1:4000/path',
      'example.invalid/provider/path',
      'mailto:user@example.test',
      'urn:provider:opaque',
    ]) {
      const unsafeDecision = evaluateProviderAuthSyncSendOperationsImplementationManifest({
        ...readyInput(),
        accountId: unsafeIdentifier,
      });
      const unsafeSerialized = JSON.stringify(unsafeDecision);

      expect(unsafeDecision).toMatchObject({
        status: 'blocked',
        reason: 'operation_plan_invalid',
      });
      expect(unsafeSerialized).not.toContain(unsafeIdentifier);
      expect(unsafeSerialized).not.toContain('example.invalid');
      expect(unsafeSerialized).not.toContain('localhost');
      expect(unsafeSerialized).not.toContain('urn:provider');
    }
  });

  it('rejects mismatched gate credentials and extra live callback metadata', () => {
    expect(evaluateProviderAuthSyncSendOperationsImplementationManifest({
      ...readyInput(),
      operationPlan: operationPlan({
        gateDecision: gateDecision('sync_mail', {
          credentialReference: credentialReference({ id: 'other-provider-credential-reference' }),
        }),
      }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'operation_plan_invalid',
    });

    expect(evaluateProviderAuthSyncSendOperationsImplementationManifest({
      ...readyInput(),
      operationPlan: [{
        ...operationPlan()[0],
        gateDecision: {
          ...operationPlan()[0].gateDecision,
          oauthCallback: vi.fn(),
        } as never,
      }],
    })).toMatchObject({
      status: 'blocked',
      reason: 'operation_plan_invalid',
    });
  });

  it('rejects forbidden write paths while preserving no-provider/no-network/no-storage invariants', () => {
    const fetchSpy = vi.fn();
    const openSpy = vi.fn();
    const websocketSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('open', openSpy);
    vi.stubGlobal('WebSocket', websocketSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');

    const decision = evaluateProviderAuthSyncSendOperationsImplementationManifest({
      ...readyInput(),
      futureWriteSet: [
        ...PROVIDER_AUTH_SYNC_SEND_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
        'src/components/CaddyAssistant/CadEmailWorkspace.tsx',
      ],
    });

    expect(decision).toMatchObject({
      status: 'blocked',
      reason: 'future_write_set_invalid',
      mayOpenOAuthWindow: false,
      mayCallProviderSdk: false,
      mayFetch: false,
      mayOpenSocket: false,
      mayStoreCredential: false,
      mayModifySchema: false,
      mayExportOrBackup: false,
      willPromoteStandalone: false,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
    expect(websocketSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });
});
