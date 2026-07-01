import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateConnectorSecretStoragePreflightBoundary,
  type ConnectorSecretLeakagePolicy,
  type ConnectorSecretRedactionPolicy,
  type ConnectorSecretReferenceMetadata,
  type ConnectorSecretRotationPolicy,
  type ConnectorSecretStorageOwnerSurface,
} from '../lib/connector-secret-storage-preflight-boundary';
import {
  createRuntimeTrustedContractObject,
  type RuntimeTrustedContractValue,
} from '../lib/runtime-trusted-contract-object';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function ownerSurface(
  overrides: Partial<ConnectorSecretStorageOwnerSurface> = {},
): ConnectorSecretStorageOwnerSurface {
  return {
    contract: 'connector-secret-storage-owner-surface-v1',
    ownerSurface: 'connector-auth-settings',
    providerId: 'google-mail',
    connectorId: 'gmail-oauth',
    accountId: 'analyst@example.test',
    reviewState: 'reviewed',
    ownerReviewed: true,
    ...overrides,
  };
}

function secretReference(
  overrides: Partial<ConnectorSecretReferenceMetadata> = {},
): ConnectorSecretReferenceMetadata {
  return {
    contract: 'connector-secret-reference-metadata-v1',
    providerId: 'google-mail',
    connectorId: 'gmail-oauth',
    accountId: 'analyst@example.test',
    credentialReferenceId: 'credref:google-mail/analyst',
    referenceKind: 'provider-managed-oauth',
    rawSecretPresent: false,
    referenceReviewed: true,
    ...overrides,
  };
}

function redactionPolicy(
  overrides: Partial<ConnectorSecretRedactionPolicy> = {},
): ConnectorSecretRedactionPolicy {
  return {
    contract: 'connector-secret-redaction-policy-v1',
    redactionPolicyId: 'redaction-policy-001',
    reviewState: 'reviewed',
    redactAtRest: true,
    redactInLogs: true,
    redactInExport: true,
    noPlaintextEcho: true,
    ...overrides,
  };
}

function rotationPolicy(
  overrides: Partial<ConnectorSecretRotationPolicy> = {},
): ConnectorSecretRotationPolicy {
  return {
    contract: 'connector-secret-rotation-policy-v1',
    rotationPolicyId: 'rotation-policy-001',
    reviewState: 'reviewed',
    rotationReviewed: true,
    revocationReviewed: true,
    supportsRotation: true,
    supportsRevocation: true,
    ...overrides,
  };
}

function leakagePolicy(
  overrides: Partial<ConnectorSecretLeakagePolicy> = {},
): ConnectorSecretLeakagePolicy {
  return {
    contract: 'connector-secret-leakage-policy-v1',
    leakagePolicyId: 'leakage-policy-001',
    reviewState: 'reviewed',
    noExportLeakage: true,
    noBackupLeakage: true,
    noImportPlaintext: true,
    noSchemaRawSecretFields: true,
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
  if (Array.isArray(value)) return value.map((item) => trustedValue(item));
  if (typeof value === 'object') return trustedRecord(value as Record<string, unknown>) as RuntimeTrustedContractValue;
  throw new TypeError('Trusted preflight fixtures cannot include callable values.');
}

function trustedRecord<T extends Record<string, unknown>>(value: T): T {
  return createRuntimeTrustedContractObject(
    Object.entries(value).map(([key, nested]) => [key, trustedValue(nested)] as const),
  ) as unknown as T;
}

function readyInput(overrides: Record<string, unknown> = {}) {
  return trustedRecord({
    ownerSurface: ownerSurface(),
    secretReference: secretReference(),
    redactionPolicy: redactionPolicy(),
    rotationPolicy: rotationPolicy(),
    leakagePolicy: leakagePolicy(),
    ...overrides,
  });
}

describe('connector secret storage preflight boundary', () => {
  it('returns frozen preflight metadata for reference-shaped credentials only', () => {
    const decision = evaluateConnectorSecretStoragePreflightBoundary(readyInput());

    expect(decision).toMatchObject({
      status: 'ready',
      ready: true,
      reason: 'connector_secret_storage_preflight_ready',
      plan: {
        contract: 'connector-secret-storage-preflight-plan-v1',
        ownerSurface: 'connector-auth-settings',
        providerId: 'google-mail',
        connectorId: 'gmail-oauth',
        accountId: 'analyst@example.test',
        credentialReferenceId: 'credref:google-mail/analyst',
        referenceKind: 'provider-managed-oauth',
        ownerReviewed: true,
        providerAccountBindingReviewed: true,
        redactionReviewed: true,
        rotationReviewed: true,
        revocationReviewed: true,
        noRawSecretGuarantee: true,
        noExportLeakage: true,
        noBackupLeakage: true,
        executable: false,
        sideEffects: 'none',
      },
      canPrepareFutureSecretStoragePlan: true,
      mayStoreCredential: false,
      mayReadStorage: false,
      mayWriteStorage: false,
      mayExportSecret: false,
      mayBackupSecret: false,
      willUseLocalStorage: false,
      willUseSessionStorage: false,
      willUseIndexedDb: false,
      willUseKeychain: false,
      willFetch: false,
      willOpenSocket: false,
      willCallProvider: false,
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.plan)).toBe(true);
  });

  it('rejects scheme-shaped generic identifiers while preserving reviewed credential reference prefixes', () => {
    const validDecision = evaluateConnectorSecretStoragePreflightBoundary(readyInput({
      secretReference: secretReference({ credentialReferenceId: 'vault:path/to/connector/reference' }),
    }));

    expect(validDecision.status).toBe('ready');
    expect(validDecision.plan?.credentialReferenceId).toBe('vault:path/to/connector/reference');

    expect(evaluateConnectorSecretStoragePreflightBoundary(readyInput({
      ownerSurface: ownerSurface({ providerId: 'mailto:user@example.test' }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'owner_surface_invalid',
    });

    expect(evaluateConnectorSecretStoragePreflightBoundary(readyInput({
      redactionPolicy: redactionPolicy({ redactionPolicyId: 'urn:provider:opaque' }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'redaction_policy_invalid',
    });

    expect(evaluateConnectorSecretStoragePreflightBoundary(readyInput({
      secretReference: secretReference({ credentialReferenceId: 'mailto:user@example.test' }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'secret_reference_invalid',
    });
  });

  it('rejects untrusted proxy and accessor roots before traps or getters execute', () => {
    const getter = vi.fn(() => ownerSurface());
    const accessorRoot: Record<string, unknown> = {};
    Object.defineProperty(accessorRoot, 'ownerSurface', {
      enumerable: true,
      get: getter,
    });
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
    const proxyRoot = new Proxy({
      ownerSurface: ownerSurface(),
      secretReference: secretReference(),
    }, traps);

    expect(evaluateConnectorSecretStoragePreflightBoundary(accessorRoot as never)).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
    });
    expect(evaluateConnectorSecretStoragePreflightBoundary(proxyRoot as never)).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
    });
    expect(getter).not.toHaveBeenCalled();
    expect(traps.get).not.toHaveBeenCalled();
    expect(traps.ownKeys).not.toHaveBeenCalled();
    expect(traps.getOwnPropertyDescriptor).not.toHaveBeenCalled();
    expect(traps.getPrototypeOf).not.toHaveBeenCalled();
  });

  it('rejects raw secrets, tokens, API keys, and bearer headers anywhere in input', () => {
    expect(evaluateConnectorSecretStoragePreflightBoundary(readyInput({
      secretReference: {
        ...secretReference(),
        accessToken: 'ya29.secret-value',
      },
    }))).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
      mayStoreCredential: false,
    });

    expect(evaluateConnectorSecretStoragePreflightBoundary(readyInput({
      redactionPolicy: {
        ...redactionPolicy(),
        note: 'Authorization: Bearer abcdefghijklmnop',
      },
    }))).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });
  });

  it('rejects storage handles and live runtime fields without invoking callbacks', () => {
    const fetcher = vi.fn();
    expect(evaluateConnectorSecretStoragePreflightBoundary(readyInput({
      storageAdapter: {
        localStorageKey: 'connector-secret-cache',
      },
    }))).toMatchObject({
      status: 'blocked',
      reason: 'storage_shape_forbidden',
      willUseLocalStorage: false,
    });

    expect(evaluateConnectorSecretStoragePreflightBoundary({
      ...readyInput(),
      ownerSurface: {
        ...ownerSurface(),
        fetch: fetcher,
      },
    })).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
      willFetch: false,
    });
    expect(fetcher).not.toHaveBeenCalled();

    expect(evaluateConnectorSecretStoragePreflightBoundary({
      ...readyInput(),
      redirectNow: true,
    } as unknown as Parameters<typeof evaluateConnectorSecretStoragePreflightBoundary>[0])).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
      executable: false,
    });
  });

  it('rejects allowed-field object and function poisoning without invoking supplied values', () => {
    const credentialReferenceId = vi.fn();
    const noPlaintextEcho = vi.fn();

    expect(evaluateConnectorSecretStoragePreflightBoundary({
      ...readyInput(),
      secretReference: {
        ...secretReference(),
        credentialReferenceId,
      },
    })).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
      mayStoreCredential: false,
    });

    expect(evaluateConnectorSecretStoragePreflightBoundary({
      ...readyInput(),
      redactionPolicy: {
        ...redactionPolicy(),
        noPlaintextEcho,
      },
    })).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
      mayWriteStorage: false,
    });

    expect(evaluateConnectorSecretStoragePreflightBoundary({
      ...readyInput(),
      leakagePolicy: {
        ...leakagePolicy(),
        noExportLeakage: { valueOf: vi.fn(() => true) },
      },
    })).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
      mayExportSecret: false,
    });

    expect(credentialReferenceId).not.toHaveBeenCalled();
    expect(noPlaintextEcho).not.toHaveBeenCalled();
  });

  it('does not invoke storage adapters or secret resolvers when executable contract is missing or mismatched', () => {
    const storageAdapter = {
      open: vi.fn(),
      put: vi.fn(),
      get: vi.fn(),
    };
    const secretResolver = vi.fn();

    expect(evaluateConnectorSecretStoragePreflightBoundary({
      ...readyInput(),
      storageAdapter,
      secretResolver,
    } as unknown as Parameters<typeof evaluateConnectorSecretStoragePreflightBoundary>[0])).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
      mayReadStorage: false,
      mayWriteStorage: false,
      mayStoreCredential: false,
    });

    expect(evaluateConnectorSecretStoragePreflightBoundary(readyInput({
      ownerSurface: ownerSurface({ providerId: 'other-provider' }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'secret_reference_invalid',
      mayReadStorage: false,
      mayWriteStorage: false,
    });

    expect(storageAdapter.open).not.toHaveBeenCalled();
    expect(storageAdapter.put).not.toHaveBeenCalled();
    expect(storageAdapter.get).not.toHaveBeenCalled();
    expect(secretResolver).not.toHaveBeenCalled();
  });

  it('requires reviewed owner, reference binding, redaction, rotation, revocation, and leakage posture', () => {
    expect(evaluateConnectorSecretStoragePreflightBoundary(trustedRecord({
      secretReference: secretReference(),
      redactionPolicy: redactionPolicy(),
      rotationPolicy: rotationPolicy(),
      leakagePolicy: leakagePolicy(),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'owner_surface_missing',
    });

    expect(evaluateConnectorSecretStoragePreflightBoundary(readyInput({
      secretReference: secretReference({ accountId: 'other@example.test' }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'secret_reference_invalid',
    });

    expect(evaluateConnectorSecretStoragePreflightBoundary(readyInput({
      rotationPolicy: rotationPolicy({ supportsRevocation: false } as unknown as Partial<ConnectorSecretRotationPolicy>),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'rotation_policy_invalid',
    });

    expect(evaluateConnectorSecretStoragePreflightBoundary(readyInput({
      leakagePolicy: leakagePolicy({ noBackupLeakage: false } as unknown as Partial<ConnectorSecretLeakagePolicy>),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'leakage_policy_invalid',
    });
  });
});
