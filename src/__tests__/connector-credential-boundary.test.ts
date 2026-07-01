import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONNECTOR_CREDENTIAL_BOUNDARY_GUIDANCE,
  CIRCULAR_CONNECTOR_CREDENTIAL_VALUE,
  REDACTED_CONNECTOR_CREDENTIAL,
  classifyConnectorCredentialForExport,
  hasConnectorSecretMaterial,
  isSecretLikeFieldName,
  redactConnectorSecretMaterial,
  sanitizeConnectorCredentialReference,
  validateConnectorCredentialReference,
  type ConnectorCredentialReference,
} from '../lib/connector-credential-boundary';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function makeReference(overrides: Partial<ConnectorCredentialReference> = {}): ConnectorCredentialReference {
  return {
    schemaVersion: 1,
    kind: 'os-keychain',
    id: 'macos-login:threatcaddy/google-gmail/account-1',
    storageOwner: 'operating-system',
    providerId: 'google-gmail',
    connectorId: 'email',
    accountId: 'account-1',
    displayName: 'macOS Keychain reference',
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe('connector credential boundary contract', () => {
  it('accepts only opaque credential references for approved storage owners', () => {
    const references: ConnectorCredentialReference[] = [
      makeReference(),
      makeReference({
        kind: 'local-bridge',
        id: 'local-bridge:mail/account-1',
        storageOwner: 'local-bridge',
      }),
      makeReference({
        kind: 'external-secret-store',
        id: 'vault:path/to/reference',
        storageOwner: 'external-secret-store',
      }),
      makeReference({
        kind: 'provider-managed-oauth',
        id: 'provider-oauth:google/account-1',
        storageOwner: 'external-provider',
      }),
    ];

    for (const reference of references) {
      const validation = validateConnectorCredentialReference(reference);
      expect(validation).toEqual({ ok: true, reference });
      expect(sanitizeConnectorCredentialReference(reference)).toEqual(reference);
      expect(hasConnectorSecretMaterial(reference)).toBe(false);
    }
  });

  it('fails closed for unsupported shapes and storage-owner mismatches', () => {
    expect(validateConnectorCredentialReference(null)).toMatchObject({ ok: false, reason: 'not_object' });
    expect(validateConnectorCredentialReference({ ...makeReference(), schemaVersion: 2 })).toMatchObject({
      ok: false,
      reason: 'invalid_schema_version',
      field: 'schemaVersion',
    });
    expect(validateConnectorCredentialReference({ ...makeReference(), kind: 'browser-local-storage' })).toMatchObject({
      ok: false,
      reason: 'invalid_kind',
      field: 'kind',
    });
    expect(validateConnectorCredentialReference({
      ...makeReference({ kind: 'local-bridge' }),
      storageOwner: 'external-provider',
    })).toMatchObject({
      ok: false,
      reason: 'storage_owner_mismatch',
      field: 'storageOwner',
    });
    expect(validateConnectorCredentialReference({ ...makeReference(), notes: 'extra metadata' })).toMatchObject({
      ok: false,
      reason: 'unsupported_field',
      field: 'notes',
    });
  });

  it('rejects raw secret-like fields instead of treating them as references', () => {
    const rawSecretCarrier = {
      ...makeReference(),
      accessToken: '[fixture secret-like value]',
    };

    expect(isSecretLikeFieldName('accessToken')).toBe(true);
    expect(hasConnectorSecretMaterial(rawSecretCarrier)).toBe(true);
    expect(validateConnectorCredentialReference(rawSecretCarrier)).toMatchObject({
      ok: false,
      reason: 'secret_material_detected',
      field: 'accessToken',
    });
    expect(sanitizeConnectorCredentialReference(rawSecretCarrier)).toBeNull();
  });

  it('rejects identifiers and labels that look like secret material', () => {
    expect(validateConnectorCredentialReference({
      ...makeReference(),
      id: 'refresh-token-reference',
    })).toMatchObject({
      ok: false,
      reason: 'invalid_identifier',
      field: 'id',
    });

    expect(validateConnectorCredentialReference({
      ...makeReference(),
      displayName: 'authorization code: fixture',
    })).toMatchObject({
      ok: false,
      reason: 'secret_material_detected',
      field: 'displayName',
    });
  });

  it('rejects common synthetic token-prefix shapes in every identifier field', () => {
    const identifierCases: Array<[keyof Pick<ConnectorCredentialReference, 'id' | 'providerId' | 'connectorId' | 'accountId'>, string]> = [
      ['id', 'xoxb-synthetic-placeholder'],
      ['providerId', 'ghp_syntheticplaceholder'],
      ['connectorId', 'github_pat_synthetic_placeholder'],
      ['accountId', 'AKIA12345678SYNTHETIC'],
      ['id', 'ASIA12345678SYNTHETIC'],
      ['providerId', 'sk-synthetic-placeholder'],
    ];

    for (const [field, value] of identifierCases) {
      expect(validateConnectorCredentialReference({
        ...makeReference(),
        [field]: value,
      })).toMatchObject({
        ok: false,
        reason: 'invalid_identifier',
        field,
      });
    }
  });

  it('rejects URL-shaped, local endpoint, host-path, and colon-only scheme identifiers', () => {
    const unsafeIdentifierCases: Array<[keyof Pick<ConnectorCredentialReference, 'id' | 'providerId' | 'connectorId' | 'accountId'>, string]> = [
      ['id', 'ftp://example.invalid/path'],
      ['id', 'localhost:4000/path'],
      ['id', '127.0.0.1:4000/path'],
      ['id', 'example.invalid/provider/path'],
      ['providerId', 'mailto:user@example.test'],
      ['connectorId', 'urn:provider:opaque'],
      ['accountId', 'hooks.slack.com/services/T000/B000/fixture'],
      ['providerId', 'provider-oauth:google/account-1'],
      ['connectorId', 'vault:path/to/connector'],
      ['accountId', 'local-bridge:account-1'],
    ];

    for (const [field, value] of unsafeIdentifierCases) {
      expect(validateConnectorCredentialReference({
        ...makeReference(),
        [field]: value,
      })).toMatchObject({
        ok: false,
        reason: 'invalid_identifier',
        field,
      });
    }

    expect(validateConnectorCredentialReference(makeReference({ id: 'vault:path/to/reference' }))).toEqual({
      ok: true,
      reference: makeReference({ id: 'vault:path/to/reference' }),
    });
    expect(validateConnectorCredentialReference(makeReference({
      kind: 'provider-managed-oauth',
      id: 'provider-oauth:google/account-1',
      storageOwner: 'external-provider',
    }))).toEqual({
      ok: true,
      reference: makeReference({
        kind: 'provider-managed-oauth',
        id: 'provider-oauth:google/account-1',
        storageOwner: 'external-provider',
      }),
    });
  });

  it('redacts secret-like fields without JSON serialization and preserves safe references', () => {
    const circular: Record<string, unknown> = {
      accountId: 'account-1',
      credentialRef: makeReference(),
      nested: {
        password: '[fixture secret-like value]',
        providerId: 'google-gmail',
      },
      aliases: ['mailbox', 'local-reference'],
    };
    circular.self = circular;

    expect(() => hasConnectorSecretMaterial(circular)).not.toThrow();
    expect(hasConnectorSecretMaterial(circular)).toBe(true);

    const redacted = redactConnectorSecretMaterial(circular) as Record<string, unknown>;
    expect(redacted.credentialRef).toEqual(makeReference());
    expect(redacted.nested).toMatchObject({
      password: REDACTED_CONNECTOR_CREDENTIAL,
      providerId: 'google-gmail',
    });
    expect(redacted.self).toBe(CIRCULAR_CONNECTOR_CREDENTIAL_VALUE);
  });

  it('fails closed on accessor descriptors and trapped proxy inputs without secret echo', () => {
    const getter = vi.fn(() => '[fixture secret-like value]');
    const accessorReference: Record<string, unknown> = {
      ...makeReference(),
    };
    Object.defineProperty(accessorReference, 'displayName', {
      enumerable: true,
      get: getter,
    });

    expect(validateConnectorCredentialReference(accessorReference)).toMatchObject({
      ok: false,
      reason: 'not_object',
    });
    expect(hasConnectorSecretMaterial(accessorReference)).toBe(true);
    expect(redactConnectorSecretMaterial(accessorReference)).toBe(REDACTED_CONNECTOR_CREDENTIAL);
    expect(classifyConnectorCredentialForExport(accessorReference)).toEqual({
      decision: 'block',
      reason: 'raw_secret_material',
    });
    expect(getter).not.toHaveBeenCalled();

    const trapped = new Proxy(makeReference() as unknown as Record<string, unknown>, {
      get() {
        throw new Error('proxy get trap should not be needed for credential validation');
      },
      ownKeys() {
        throw new Error('proxy ownKeys trap rejected');
      },
      getOwnPropertyDescriptor() {
        throw new Error('proxy descriptor trap rejected');
      },
      getPrototypeOf() {
        throw new Error('proxy prototype trap rejected');
      },
    });

    expect(validateConnectorCredentialReference(trapped)).toMatchObject({
      ok: false,
      reason: 'not_object',
    });
    expect(sanitizeConnectorCredentialReference(trapped)).toBeNull();
    expect(classifyConnectorCredentialForExport(trapped)).toEqual({
      decision: 'block',
      reason: 'raw_secret_material',
    });
  });

  it('blocks export for raw or malformed credential material and allows valid references', () => {
    expect(classifyConnectorCredentialForExport(makeReference())).toEqual({
      decision: 'allow-reference',
      reference: makeReference(),
    });

    expect(classifyConnectorCredentialForExport({
      providerId: 'google-gmail',
      password: '[fixture secret-like value]',
    })).toEqual({
      decision: 'block',
      reason: 'raw_secret_material',
    });

    expect(classifyConnectorCredentialForExport({ ...makeReference(), note: 'not in the reference contract' })).toEqual({
      decision: 'block',
      reason: 'unsupported_field',
    });
  });

  it('documents log/export blocking guidance and performs no network or browser storage writes', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');

    expect(CONNECTOR_CREDENTIAL_BOUNDARY_GUIDANCE.export).toContain('Block raw secret material');
    expect(CONNECTOR_CREDENTIAL_BOUNDARY_GUIDANCE.logging).toContain('redactConnectorSecretMaterial');
    expect(CONNECTOR_CREDENTIAL_BOUNDARY_GUIDANCE.validation).toContain('Fail closed');

    validateConnectorCredentialReference(makeReference());
    hasConnectorSecretMaterial({ credentialRef: makeReference() });
    redactConnectorSecretMaterial({ credentialRef: makeReference() });
    classifyConnectorCredentialForExport(makeReference());

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });
});
