import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  selectConnectorRuntimeAdapterCapability,
  type ConnectorRuntimeAdapterCapabilityFact,
} from '../lib/connector-runtime-adapter-registry';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function capability(
  overrides: Partial<ConnectorRuntimeAdapterCapabilityFact> = {},
): ConnectorRuntimeAdapterCapabilityFact {
  return {
    schemaVersion: 1,
    factKind: 'connector-runtime-adapter-capability',
    adapterId: 'email-runtime-adapter',
    adapterVersion: '1.0.0',
    surface: 'email',
    providerId: 'generic-mail',
    actionId: 'mail.sync',
    sideEffectClass: 'provider-read',
    requiresCredentialHandle: true,
    requiresExplicitConsent: true,
    allowsLiveDelivery: false,
    reviewState: 'reviewed',
    reviewedAt: 1_700_000_000_000,
    expiresAt: 1_800_000_000_000,
    ...overrides,
  };
}

function validInput(overrides: Partial<Parameters<typeof selectConnectorRuntimeAdapterCapability>[0]> = {}) {
  return {
    capabilities: [capability()],
    surface: 'email',
    providerId: 'generic-mail',
    actionId: 'mail.sync',
    now: 1_700_000_000_100,
    ...overrides,
  };
}

function blockerCodes(input: Parameters<typeof selectConnectorRuntimeAdapterCapability>[0]) {
  return selectConnectorRuntimeAdapterCapability(input).blockers.map((blocker) => blocker.code);
}

function serialized(value: unknown): string {
  return JSON.stringify(value);
}

describe('connector runtime adapter registry', () => {
  it('selects one reviewed adapter capability and returns frozen safe metadata only', () => {
    const decision = selectConnectorRuntimeAdapterCapability(validInput());

    expect(decision.status).toBe('selected');
    expect(decision.selected).toBe(true);
    expect(decision.blockers).toEqual([]);
    expect(decision.sideEffectBoundary).toBe('metadata-only-no-fetch-no-socket-no-storage-no-provider-sdk-no-provider-action');
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.blockers)).toBe(true);
    expect(Object.isFrozen(decision.descriptor)).toBe(true);
    expect(Object.isFrozen(decision.descriptor?.adapter)).toBe(true);
    expect(Object.isFrozen(decision.descriptor?.capability)).toBe(true);
    expect(Object.isFrozen(decision.descriptor?.review)).toBe(true);

    expect(decision.descriptor).toEqual({
      schemaVersion: 1,
      descriptorKind: 'connector-runtime-adapter-selection',
      adapter: {
        id: 'email-runtime-adapter',
        version: '1.0.0',
      },
      capability: {
        surface: 'email',
        providerId: 'generic-mail',
        actionId: 'mail.sync',
        sideEffectClass: 'provider-read',
        requiresCredentialHandle: true,
        requiresExplicitConsent: true,
        allowsLiveDelivery: false,
      },
      review: {
        reviewState: 'reviewed',
        reviewedAt: 1_700_000_000_000,
        expiresAt: 1_800_000_000_000,
      },
      executable: false,
      sideEffectBoundary: 'metadata-only-no-fetch-no-socket-no-storage-no-provider-sdk-no-provider-action',
    });
    expect(serialized(decision)).not.toContain('execute');
    expect(serialized(decision)).not.toContain('token');
  });

  it('fails closed when capability facts are missing or mismatched to the request', () => {
    expect(blockerCodes(validInput({ capabilities: [] }))).toEqual(expect.arrayContaining([
      'capability_facts_missing',
    ]));

    const decision = selectConnectorRuntimeAdapterCapability(validInput({
      providerId: 'generic-calendar',
    }));

    expect(decision.status).toBe('blocked');
    expect(decision.selected).toBe(false);
    expect(decision.descriptor).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'capability_mismatch',
    ]));
  });

  it('blocks stale, unreviewed, revoked, and expired matching capabilities', () => {
    expect(blockerCodes(validInput({
      capabilities: [capability({ reviewState: 'draft' })],
    }))).toEqual(expect.arrayContaining(['capability_not_reviewed']));
    expect(blockerCodes(validInput({
      capabilities: [capability({ reviewState: 'stale' })],
    }))).toEqual(expect.arrayContaining(['capability_stale']));
    expect(blockerCodes(validInput({
      capabilities: [capability({ stale: true })],
    }))).toEqual(expect.arrayContaining(['capability_stale']));
    expect(blockerCodes(validInput({
      capabilities: [capability({ reviewState: 'revoked' })],
    }))).toEqual(expect.arrayContaining(['capability_revoked']));
    expect(blockerCodes(validInput({
      capabilities: [capability({ reviewState: 'expired' })],
    }))).toEqual(expect.arrayContaining(['capability_expired']));
    expect(blockerCodes(validInput({
      capabilities: [capability({ expiresAt: 1_700_000_000_000 })],
    }))).toEqual(expect.arrayContaining(['capability_expired']));
  });

  it('blocks ambiguous duplicate capabilities for the same surface provider and action', () => {
    const decision = selectConnectorRuntimeAdapterCapability(validInput({
      capabilities: [
        capability({ adapterVersion: '1.0.0' }),
        capability({ adapterVersion: '1.0.1' }),
      ],
    }));

    expect(decision.status).toBe('blocked');
    expect(decision.descriptor).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'ambiguous_duplicate_capabilities',
    ]));
  });

  it('requires explicit live-delivery facts for provider live side effects', () => {
    const missingLiveFact = selectConnectorRuntimeAdapterCapability(validInput({
      capabilities: [capability({
        actionId: 'mail.send',
        sideEffectClass: 'provider-live-delivery',
        allowsLiveDelivery: true,
      })],
      actionId: 'mail.send',
    }));

    expect(missingLiveFact.status).toBe('blocked');
    expect(missingLiveFact.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'live_delivery_capability_missing',
    ]));

    const reviewedLiveFact = selectConnectorRuntimeAdapterCapability(validInput({
      capabilities: [capability({
        actionId: 'mail.send',
        sideEffectClass: 'provider-live-delivery',
        requiresCredentialHandle: true,
        requiresExplicitConsent: true,
        allowsLiveDelivery: true,
        liveDeliveryCapability: {
          capabilityKind: 'explicit-live-delivery-capability',
          reviewed: true,
          sideEffectClass: 'provider-live-delivery',
          requiresCredentialHandle: true,
          requiresExplicitConsent: true,
        },
      })],
      actionId: 'mail.send',
    }));

    expect(reviewedLiveFact.status).toBe('selected');
    expect(reviewedLiveFact.descriptor?.capability.allowsLiveDelivery).toBe(true);
    expect(reviewedLiveFact.descriptor?.executable).toBe(false);
  });

  it('rejects secret-like identifiers and never echoes token-shaped values', () => {
    const decision = selectConnectorRuntimeAdapterCapability(validInput({
      capabilities: [capability({
        adapterId: 'sk-thisshouldneverecho',
        adapterVersion: '1.0.0',
      })],
      adapterId: 'sk-requestfiltershouldneverecho',
    }));

    expect(decision.status).toBe('blocked');
    expect(decision.descriptor).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'raw_secret_material',
      'identifier_invalid',
    ]));
    expect(serialized(decision)).not.toContain('sk-thisshouldneverecho');
    expect(serialized(decision)).not.toContain('sk-requestfiltershouldneverecho');
  });

  it('performs no fetch, websocket, browser storage, IndexedDB, or provider side effects while selecting', () => {
    const fetchSpy = vi.fn();
    const webSocketSpy = vi.fn();
    const indexedDbSpy = vi.fn();
    const xhrSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', webSocketSpy);
    vi.stubGlobal('indexedDB', indexedDbSpy);
    vi.stubGlobal('XMLHttpRequest', xhrSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');

    selectConnectorRuntimeAdapterCapability(validInput());
    selectConnectorRuntimeAdapterCapability(validInput({
      capabilities: [capability({ reviewState: 'draft' })],
    }));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(webSocketSpy).not.toHaveBeenCalled();
    expect(indexedDbSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });
});
