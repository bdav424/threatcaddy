import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONNECTOR_EXPLICIT_CONSENT_SIDE_EFFECT_BOUNDARY,
  SUPPORTED_CONNECTOR_EXPLICIT_CONSENT_ACTION_FAMILIES,
  evaluateConnectorExplicitConsent,
  type ConnectorExplicitConsentActionFamily,
  type ConnectorExplicitConsentGrant,
  type ConnectorExplicitConsentRequirement,
  type ConnectorExplicitConsentSideEffectClass,
} from '../lib/connector-explicit-consent';

const NOW = 1_800_000_000_000;

function requirement(
  overrides: Partial<ConnectorExplicitConsentRequirement> = {},
): ConnectorExplicitConsentRequirement {
  return {
    actionId: 'email.sync.case-123',
    actionFamily: 'email',
    actionKind: 'sync_mail',
    targetSurface: 'EmailCaddy',
    sideEffectClass: 'email-read',
    owner: {
      providerId: 'google-gmail',
      connectorId: 'email',
      accountId: 'account-1',
      workspaceId: 'workspace-1',
      credentialReferenceId: 'provider-oauth:account-1',
    },
    ...overrides,
  };
}

function grant(
  overrides: Partial<ConnectorExplicitConsentGrant> = {},
): ConnectorExplicitConsentGrant {
  return {
    schemaVersion: 1,
    grantId: 'grant:email.sync.case-123',
    actionId: 'email.sync.case-123',
    actionFamily: 'email',
    actionKind: 'sync_mail',
    targetSurface: 'EmailCaddy',
    owner: {
      providerId: 'google-gmail',
      connectorId: 'email',
      accountId: 'account-1',
      workspaceId: 'workspace-1',
      credentialReferenceId: 'provider-oauth:account-1',
    },
    grantState: 'granted',
    reviewState: 'reviewed',
    issuedAt: NOW - 1_000,
    expiresAt: NOW + 60_000,
    reviewedAt: NOW - 500,
    sideEffectAcknowledgement: {
      sideEffectClass: 'email-read',
      acknowledged: true,
      acknowledgedAt: NOW - 500,
    },
    ...overrides,
  };
}

function installNoSideEffectSpies(): {
  fetchSpy: ReturnType<typeof vi.fn>;
  getItemSpy: ReturnType<typeof vi.spyOn>;
  keySpy: ReturnType<typeof vi.spyOn>;
  setItemSpy: ReturnType<typeof vi.spyOn>;
  removeItemSpy: ReturnType<typeof vi.spyOn>;
  clearSpy: ReturnType<typeof vi.spyOn>;
} {
  const fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  return {
    fetchSpy,
    getItemSpy: vi.spyOn(Storage.prototype, 'getItem'),
    keySpy: vi.spyOn(Storage.prototype, 'key'),
    setItemSpy: vi.spyOn(Storage.prototype, 'setItem'),
    removeItemSpy: vi.spyOn(Storage.prototype, 'removeItem'),
    clearSpy: vi.spyOn(Storage.prototype, 'clear'),
  };
}

function expectNoSideEffects(spies: ReturnType<typeof installNoSideEffectSpies>): void {
  expect(spies.fetchSpy).not.toHaveBeenCalled();
  expect(spies.getItemSpy).not.toHaveBeenCalled();
  expect(spies.keySpy).not.toHaveBeenCalled();
  expect(spies.setItemSpy).not.toHaveBeenCalled();
  expect(spies.removeItemSpy).not.toHaveBeenCalled();
  expect(spies.clearSpy).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('connector explicit consent grant contract', () => {
  it('allows a matching reviewed grant as an immutable local decision without side effects', () => {
    const spies = installNoSideEffectSpies();

    const decision = evaluateConnectorExplicitConsent({
      requirement: requirement(),
      grant: grant(),
      now: NOW,
    });

    expect(decision).toEqual({
      status: 'allow',
      allowed: true,
      executable: false,
      actionId: 'email.sync.case-123',
      actionFamily: 'email',
      actionKind: 'sync_mail',
      targetSurface: 'EmailCaddy',
      owner: {
        providerId: 'google-gmail',
        connectorId: 'email',
        accountId: 'account-1',
        workspaceId: 'workspace-1',
        credentialReferenceId: 'provider-oauth:account-1',
      },
      grantId: 'grant:email.sync.case-123',
      sideEffectClass: 'email-read',
      allowReason: 'explicit_consent_grant_valid',
      blockReasons: [],
      sideEffectBoundary: CONNECTOR_EXPLICIT_CONSENT_SIDE_EFFECT_BOUNDARY,
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.blockReasons)).toBe(true);
    expect(Object.isFrozen(decision.owner)).toBe(true);
    expectNoSideEffects(spies);
  });

  it('supports the expected connector action families without enabling execution', () => {
    const cases: Array<{
      family: ConnectorExplicitConsentActionFamily;
      sideEffectClass: ConnectorExplicitConsentSideEffectClass;
      actionKind: string;
      targetSurface: string;
    }> = [
      {
        family: 'email',
        sideEffectClass: 'email-send',
        actionKind: 'send_mail',
        targetSurface: 'EmailCaddy',
      },
      {
        family: 'messaging',
        sideEffectClass: 'messaging-post',
        actionKind: 'post-message',
        targetSurface: 'Integrations',
      },
      {
        family: 'local-bridge',
        sideEffectClass: 'local-bridge-probe',
        actionKind: 'probe_local_bridge',
        targetSurface: 'Settings',
      },
      {
        family: 'assistant-llm',
        sideEffectClass: 'assistant-llm-call',
        actionKind: 'send_prompt',
        targetSurface: 'AssistantCaddy',
      },
      {
        family: 'integration',
        sideEffectClass: 'integration-action',
        actionKind: 'run_integration_action',
        targetSurface: 'Integrations',
      },
    ];

    expect(SUPPORTED_CONNECTOR_EXPLICIT_CONSENT_ACTION_FAMILIES).toEqual([
      'email',
      'messaging',
      'local-bridge',
      'assistant-llm',
      'integration',
    ]);

    for (const testCase of cases) {
      const actionId = `${testCase.family}.action.case-123`;
      const expected = requirement({
        actionId,
        actionFamily: testCase.family,
        actionKind: testCase.actionKind,
        targetSurface: testCase.targetSurface,
        sideEffectClass: testCase.sideEffectClass,
      });
      const decision = evaluateConnectorExplicitConsent({
        requirement: expected,
        grant: grant({
          grantId: `grant:${actionId}`,
          actionId,
          actionFamily: testCase.family,
          actionKind: testCase.actionKind,
          targetSurface: testCase.targetSurface,
          sideEffectAcknowledgement: {
            sideEffectClass: testCase.sideEffectClass,
            acknowledged: true,
          },
        }),
        now: NOW,
      });

      expect(decision).toMatchObject({
        status: 'allow',
        allowed: true,
        executable: false,
        actionFamily: testCase.family,
        sideEffectClass: testCase.sideEffectClass,
        sideEffectBoundary: CONNECTOR_EXPLICIT_CONSENT_SIDE_EFFECT_BOUNDARY,
      });
    }
  });

  it('blocks a missing grant and unsupported action families fail closed', () => {
    expect(evaluateConnectorExplicitConsent({
      requirement: requirement(),
      now: NOW,
    })).toMatchObject({
      status: 'block',
      allowed: false,
      blockReasons: ['missing_grant'],
    });

    expect(evaluateConnectorExplicitConsent({
      requirement: requirement({
        actionFamily: 'calendar' as never,
      }),
      grant: grant(),
      now: NOW,
    })).toMatchObject({
      status: 'block',
      allowed: false,
      blockReasons: expect.arrayContaining(['unsupported_action_family', 'action_mismatch']),
    });
  });

  it('blocks action, target surface, and owner mismatches', () => {
    expect(evaluateConnectorExplicitConsent({
      requirement: requirement({ actionKind: 'send_mail' }),
      grant: grant(),
      now: NOW,
    })).toMatchObject({
      status: 'block',
      blockReasons: expect.arrayContaining(['action_mismatch']),
    });

    expect(evaluateConnectorExplicitConsent({
      requirement: requirement({ targetSurface: 'Settings' }),
      grant: grant(),
      now: NOW,
    })).toMatchObject({
      status: 'block',
      blockReasons: expect.arrayContaining(['target_surface_mismatch']),
    });

    expect(evaluateConnectorExplicitConsent({
      requirement: requirement({
        owner: {
          providerId: 'microsoft-outlook',
          connectorId: 'email',
          accountId: 'account-1',
        },
      }),
      grant: grant(),
      now: NOW,
    })).toMatchObject({
      status: 'block',
      blockReasons: expect.arrayContaining(['owner_mismatch']),
    });
  });

  it('rejects scheme-shaped generic owner identifiers while preserving credential-reference handles', () => {
    const allowedCredentialReferenceDecision = evaluateConnectorExplicitConsent({
      requirement: requirement({
        owner: {
          providerId: 'google-gmail',
          connectorId: 'email',
          accountId: 'account-1',
          credentialReferenceId: 'vault:path/to/google/account-1',
        },
      }),
      grant: grant({
        owner: {
          providerId: 'google-gmail',
          connectorId: 'email',
          accountId: 'account-1',
          credentialReferenceId: 'vault:path/to/google/account-1',
        },
      }),
      now: NOW,
    });

    expect(allowedCredentialReferenceDecision).toMatchObject({
      status: 'allow',
      allowed: true,
      owner: {
        credentialReferenceId: 'vault:path/to/google/account-1',
      },
    });

    for (const [field, value] of [
      ['providerId', 'provider-oauth:google/account-1'],
      ['connectorId', 'vault:path/to/connector'],
      ['accountId', 'local-bridge:account-1'],
      ['workspaceId', 'mailto:workspace@example.test'],
      ['providerId', 'localhost:4000/path'],
      ['connectorId', '127.0.0.1:4000/path'],
    ] as const) {
      const decision = evaluateConnectorExplicitConsent({
        requirement: requirement(),
        grant: grant({
          owner: {
            providerId: 'google-gmail',
            connectorId: 'email',
            accountId: 'account-1',
            workspaceId: 'workspace-1',
            credentialReferenceId: 'provider-oauth:account-1',
            [field]: value,
          },
        }),
        now: NOW,
      });
      const output = JSON.stringify(decision);

      expect(decision).toMatchObject({
        status: 'block',
        allowed: false,
        blockReasons: ['invalid_grant_shape'],
      });
      expect(output).not.toContain(value);
      expect(output).not.toContain('localhost');
      expect(output).not.toContain('127.0.0.1');
    }
  });

  it('blocks unreviewed, pending, revoked, expired, and not-yet-valid grants', () => {
    expect(evaluateConnectorExplicitConsent({
      requirement: requirement(),
      grant: grant({ reviewState: 'unreviewed', reviewedAt: undefined }),
      now: NOW,
    })).toMatchObject({
      status: 'block',
      blockReasons: expect.arrayContaining(['not_reviewed']),
    });

    expect(evaluateConnectorExplicitConsent({
      requirement: requirement(),
      grant: grant({ grantState: 'pending' }),
      now: NOW,
    })).toMatchObject({
      status: 'block',
      blockReasons: expect.arrayContaining(['not_granted']),
    });

    expect(evaluateConnectorExplicitConsent({
      requirement: requirement(),
      grant: grant({ grantState: 'revoked', revokedAt: NOW - 100 }),
      now: NOW,
    })).toMatchObject({
      status: 'block',
      blockReasons: expect.arrayContaining(['revoked']),
    });

    expect(evaluateConnectorExplicitConsent({
      requirement: requirement(),
      grant: grant({ expiresAt: NOW }),
      now: NOW,
    })).toMatchObject({
      status: 'block',
      blockReasons: expect.arrayContaining(['expired']),
    });

    expect(evaluateConnectorExplicitConsent({
      requirement: requirement(),
      grant: grant({ notBefore: NOW + 1_000 }),
      now: NOW,
    })).toMatchObject({
      status: 'block',
      blockReasons: expect.arrayContaining(['not_yet_valid']),
    });
  });

  it('blocks missing or mismatched side-effect acknowledgement', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured out to omit it from the rest
    const { sideEffectAcknowledgement: _sideEffectAcknowledgement, ...withoutAcknowledgement } = grant();

    expect(evaluateConnectorExplicitConsent({
      requirement: requirement(),
      grant: withoutAcknowledgement,
      now: NOW,
    })).toMatchObject({
      status: 'block',
      blockReasons: expect.arrayContaining(['missing_side_effect_acknowledgement']),
    });

    expect(evaluateConnectorExplicitConsent({
      requirement: requirement({ sideEffectClass: 'email-send' }),
      grant: grant(),
      now: NOW,
    })).toMatchObject({
      status: 'block',
      blockReasons: expect.arrayContaining(['side_effect_acknowledgement_mismatch']),
    });
  });

  it('rejects otherwise valid grants carrying unsafe live-action fields without invoking them', () => {
    const spies = installNoSideEffectSpies();

    for (const field of ['fetch', 'requester', 'socket', 'storage', 'callback', 'liveAction'] as const) {
      const supplied = vi.fn();
      const decision = evaluateConnectorExplicitConsent({
        requirement: requirement(),
        grant: {
          ...grant(),
          [field]: supplied,
        },
        now: NOW,
      });
      const output = JSON.stringify(decision);

      expect(decision).toMatchObject({
        status: 'block',
        allowed: false,
        blockReasons: ['invalid_grant_shape'],
      });
      expect(decision.allowReason).toBeUndefined();
      expect(decision.grantId).toBeUndefined();
      expect(supplied).not.toHaveBeenCalled();
      expect(output).not.toContain('invalid_grant_should_not_echo');
    }

    expect(evaluateConnectorExplicitConsent({
      requirement: requirement(),
      grant: {
        ...grant(),
        localStorage: { key: 'do-not-touch' },
      },
      now: NOW,
    })).toMatchObject({
      status: 'block',
      allowed: false,
      blockReasons: ['invalid_grant_shape'],
    });
    expect(evaluateConnectorExplicitConsent({
      requirement: requirement(),
      grant: {
        ...grant(),
        providerApiClient: { request: vi.fn() },
      },
      now: NOW,
    })).toMatchObject({
      status: 'block',
      allowed: false,
      blockReasons: ['invalid_grant_shape'],
    });
    expect(evaluateConnectorExplicitConsent({
      requirement: requirement(),
      grant: {
        ...grant(),
        owner: {
          ...grant().owner,
          requester: vi.fn(),
        },
      },
      now: NOW,
    })).toMatchObject({
      status: 'block',
      allowed: false,
      blockReasons: ['invalid_grant_shape'],
    });
    expect(evaluateConnectorExplicitConsent({
      requirement: requirement(),
      grant: {
        ...grant(),
        sideEffectAcknowledgement: {
          ...grant().sideEffectAcknowledgement,
          callback: vi.fn(),
        },
      },
      now: NOW,
    })).toMatchObject({
      status: 'block',
      allowed: false,
      blockReasons: ['invalid_grant_shape'],
    });

    expectNoSideEffects(spies);
  });

  it('blocks invalid grant shapes instead of inferring consent', () => {
    expect(evaluateConnectorExplicitConsent({
      requirement: requirement(),
      grant: {
        ...grant(),
        schemaVersion: 2,
      },
      now: NOW,
    })).toMatchObject({
      status: 'block',
      blockReasons: ['invalid_grant_shape'],
    });

    expect(evaluateConnectorExplicitConsent({
      requirement: requirement(),
      grant: {
        ...grant(),
        owner: { providerId: 'google gmail' },
      },
      now: NOW,
    })).toMatchObject({
      status: 'block',
      blockReasons: ['invalid_grant_shape'],
    });
  });

  it('blocks secret-like material anywhere in untrusted inputs before accepting a grant', () => {
    const tokenBearingGrant = {
      ...grant(),
      nested: {
        accessToken: 'sk-syntheticconnectorsecret',
      },
    };

    expect(evaluateConnectorExplicitConsent({
      requirement: requirement(),
      grant: tokenBearingGrant,
      now: NOW,
    })).toMatchObject({
      status: 'block',
      blockReasons: ['secret_material_detected'],
    });

    const tokenBearingRequirement = requirement({
      actionId: 'sk-syntheticconnectorsecret',
      owner: {
        providerId: 'google-gmail',
        connectorId: 'email',
        accountId: 'account-1',
        workspaceId: 'workspace-1',
        credentialReferenceId: 'Bearer synthetic-token-value',
      },
    });
    const requirementDecision = evaluateConnectorExplicitConsent({
      requirement: tokenBearingRequirement,
      grant: grant(),
      now: NOW,
    });
    expect(requirementDecision).toMatchObject({
      status: 'block',
      actionId: '[redacted]',
      actionKind: '[redacted]',
      targetSurface: '[redacted]',
      sideEffectClass: 'metadata-only',
      blockReasons: ['secret_material_detected'],
    });
    expect(requirementDecision.owner).toBeUndefined();
    expect(JSON.stringify(requirementDecision)).not.toContain('sk-syntheticconnectorsecret');
    expect(JSON.stringify(requirementDecision)).not.toContain('Bearer synthetic-token-value');

    expect(evaluateConnectorExplicitConsent({
      requirement: requirement(),
      grant: grant(),
      additionalUntrustedInputs: [
        new Map([
          ['authorization', 'Bearer synthetic-token-value'],
        ]),
      ],
      now: NOW,
    })).toMatchObject({
      status: 'block',
      blockReasons: ['secret_material_detected'],
    });
  });
});
