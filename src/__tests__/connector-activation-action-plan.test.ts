import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mapConnectorActivationActionPlan,
  resolveConnectorActivationActionPlan,
  type ConnectorActivationActionPlan,
} from '../lib/connector-activation-action-plan';
import type { ConnectorActivationDecision } from '../lib/connector-activation-gate';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
import { getIntegrationCatalogProvider, getIntegrationCatalogProviders } from '../lib/integration-catalog';
import { resolveIntegrationNextActionPlan } from '../lib/integration-next-actions';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function provider(providerId: string) {
  const catalogProvider = getIntegrationCatalogProvider(providerId);
  if (!catalogProvider) throw new Error(`Missing provider fixture: ${providerId}`);
  return catalogProvider;
}

function credentialReference(
  providerId: string,
  connectorId = `${providerId}-runtime`,
): ConnectorCredentialReference {
  return {
    schemaVersion: 1,
    kind: 'os-keychain',
    id: `macos-login:threatcaddy/${providerId}/account-1`,
    storageOwner: 'operating-system',
    providerId,
    connectorId,
    accountId: 'account-1',
    displayName: `${providerId} reference`,
    createdAt: 1_700_000_000_000,
  };
}

function actionPlanFor(providerId: string): ConnectorActivationActionPlan {
  const catalogProvider = provider(providerId);
  const targetSurface = catalogProvider.nextAction?.targetSurface ?? 'provider-catalog';
  const targetId = catalogProvider.nextAction?.targetId ?? catalogProvider.id;
  const connectorId = `${providerId}-runtime`;

  return resolveConnectorActivationActionPlan({
    provider: catalogProvider,
    credentialReference: credentialReference(providerId, connectorId),
    consent: {
      granted: true,
      scope: 'activate-generic-connector',
      providerId,
      targetSurface,
      targetId,
      acknowledgedNoProviderCalls: true,
    },
    runtime: {
      owner: 'connector-runtime',
      providerId,
      connectorId,
      targetSurface,
      targetId,
    },
  });
}

describe('connector activation action plan', () => {
  it('maps every local catalog provider to an inert plan without network, storage, or credential side effects', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');

    const plans = getIntegrationCatalogProviders().map((catalogProvider) => actionPlanFor(catalogProvider.id));

    expect(plans.length).toBeGreaterThan(0);
    expect(plans.every((plan) => plan.enabled === false)).toBe(true);
    expect(plans.every((plan) => plan.executable === false)).toBe(true);
    expect(plans.every((plan) => plan.sideEffects === 'none')).toBe(true);
    expect(plans.every((plan) => plan.status === 'blocked' || plan.status === 'disabled' || plan.status === 'gated')).toBe(true);
    expect(plans.every((plan) => plan.blockers.some((blocker) => blocker.code === 'next_action_symbolic'))).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('keeps route-only setup guidance gated and non-navigating', () => {
    const plan = actionPlanFor('gmail-google');

    expect(plan).toMatchObject({
      providerId: 'gmail-google',
      actionKind: 'route-descriptor',
      status: 'gated',
      targetSurface: 'assistantcaddy-route',
      targetId: 'assistantcaddy-email-setup',
      enabled: false,
      executable: false,
      sideEffects: 'none',
      route: {
        surface: 'assistantcaddy-route',
        id: 'assistantcaddy-email-setup',
      },
    });
    expect(plan.gatedReason).toBe('This route is local setup guidance only and does not indicate a live provider connection.');
    expect(plan.disabledReason).toBe('Connector activation gate blocked this action plan. Catalog metadata alone is not executable readiness.');
    expect(plan.testPlan).toBeUndefined();
  });

  it('keeps built-in templates and future connector catalog cards disabled', () => {
    const slack = actionPlanFor('slack');
    const sentinel = actionPlanFor('microsoft-sentinel');

    expect(slack).toMatchObject({
      providerId: 'slack',
      actionKind: 'disabled-descriptor',
      status: 'disabled',
      targetSurface: 'integration-template',
      targetId: 'slack',
      enabled: false,
      executable: false,
      sideEffects: 'none',
    });
    expect(sentinel).toMatchObject({
      providerId: 'microsoft-sentinel',
      actionKind: 'disabled-descriptor',
      status: 'disabled',
      targetSurface: 'provider-catalog',
      targetId: 'microsoft-sentinel',
      enabled: false,
      executable: false,
      sideEffects: 'none',
    });
    expect(slack.route).toBeUndefined();
    expect(slack.testPlan).toBeUndefined();
    expect(sentinel.route).toBeUndefined();
    expect(sentinel.testPlan).toBeUndefined();
  });

  it('does not treat catalog metadata alone as readiness when activation facts are missing', () => {
    const plan = resolveConnectorActivationActionPlan({
      provider: provider('generic-webhook'),
    });

    expect(plan).toMatchObject({
      providerId: 'generic-webhook',
      status: 'disabled',
      actionKind: 'disabled-descriptor',
      enabled: false,
      executable: false,
      sideEffects: 'none',
      disabledReason: 'Connector activation gate blocked this action plan. Catalog metadata alone is not executable readiness.',
    });
    expect(plan.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'credential_reference_missing',
      'consent_missing',
      'runtime_owner_missing',
      'catalog_status_not_live',
      'next_action_symbolic',
    ]));
  });

  it('can describe a manual test-plan candidate from an activation-ready decision but keeps disabled metadata inert', () => {
    const catalogProvider = provider('generic-webhook');
    const nextActionPlan = resolveIntegrationNextActionPlan(catalogProvider);
    const readyDecision: ConnectorActivationDecision = {
      status: 'activation-ready',
      providerId: 'generic-webhook',
      providerName: 'Generic webhook',
      targetSurface: 'provider-catalog',
      targetId: 'generic-webhook',
      active: false,
      executable: false,
      sideEffects: 'none',
      credentialReference: credentialReference('generic-webhook', 'generic-webhook-runtime'),
      blockers: [],
    };

    const plan = mapConnectorActivationActionPlan({
      nextActionPlan,
      activationDecision: readyDecision,
    });

    expect(plan).toMatchObject({
      providerId: 'generic-webhook',
      actionKind: 'test-plan-descriptor',
      status: 'disabled',
      enabled: false,
      executable: false,
      sideEffects: 'none',
      testPlan: {
        connectorId: 'generic-webhook-runtime',
        providerId: 'generic-webhook',
        targetSurface: 'provider-catalog',
        targetId: 'generic-webhook',
      },
      blockers: [],
    });
    expect(plan.route).toBeUndefined();
    expect(plan.disabledReason).toBe('Connector work is not implemented in this build. This card remains catalog metadata only.');
  });

  it('blocks ready-shaped mapper input when the activation provider belongs to another nextAction plan', () => {
    const nextActionPlan = resolveIntegrationNextActionPlan(provider('generic-webhook'));
    const readyDecision: ConnectorActivationDecision = {
      status: 'activation-ready',
      providerId: 'microsoft-sentinel',
      providerName: 'Microsoft Sentinel',
      targetSurface: 'provider-catalog',
      targetId: 'microsoft-sentinel',
      active: false,
      executable: false,
      sideEffects: 'none',
      credentialReference: credentialReference('microsoft-sentinel', 'microsoft-sentinel-runtime'),
      blockers: [],
    };

    const plan = mapConnectorActivationActionPlan({
      nextActionPlan,
      activationDecision: readyDecision,
    });

    expect(plan).toMatchObject({
      providerId: 'microsoft-sentinel',
      actionKind: 'disabled-descriptor',
      status: 'blocked',
      targetSurface: 'provider-catalog',
      targetId: 'microsoft-sentinel',
      enabled: false,
      executable: false,
      sideEffects: 'none',
      disabledReason:
        'Connector activation action plan ownership mismatch. nextActionPlan and activationDecision must describe the same provider and target before readiness can be accepted.',
    });
    expect(plan.testPlan).toBeUndefined();
    expect(plan.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'action_plan_ownership_mismatch',
        field: 'providerId',
      }),
      expect.objectContaining({
        code: 'action_plan_ownership_mismatch',
        field: 'targetId',
      }),
    ]));
  });

  it('blocks ready-shaped mapper input when the provider matches but the target does not', () => {
    const nextActionPlan = resolveIntegrationNextActionPlan(provider('generic-webhook'));
    const readyDecision: ConnectorActivationDecision = {
      status: 'activation-ready',
      providerId: 'generic-webhook',
      providerName: 'Generic webhook',
      targetSurface: 'integration-template',
      targetId: 'slack',
      active: false,
      executable: false,
      sideEffects: 'none',
      credentialReference: credentialReference('generic-webhook', 'generic-webhook-runtime'),
      blockers: [],
    };

    const plan = mapConnectorActivationActionPlan({
      nextActionPlan,
      activationDecision: readyDecision,
    });

    expect(plan).toMatchObject({
      providerId: 'generic-webhook',
      actionKind: 'disabled-descriptor',
      status: 'blocked',
      targetSurface: 'integration-template',
      targetId: 'slack',
      enabled: false,
      executable: false,
      sideEffects: 'none',
    });
    expect(plan.testPlan).toBeUndefined();
    expect(plan.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'action_plan_ownership_mismatch',
        field: 'targetSurface',
      }),
      expect.objectContaining({
        code: 'action_plan_ownership_mismatch',
        field: 'targetId',
      }),
    ]));
  });

  it('fails closed for malformed nextAction targets', () => {
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

    const plan = resolveConnectorActivationActionPlan({
      provider: mutatedProvider,
      credentialReference: credentialReference('generic-webhook', 'generic-webhook-runtime'),
      consent: {
        granted: true,
        scope: 'activate-generic-connector',
        providerId: 'generic-webhook',
        targetSurface: 'provider-catalog',
        targetId: 'javascript:alert(1)',
        acknowledgedNoProviderCalls: true,
      },
      runtime: {
        owner: 'connector-runtime',
        providerId: 'generic-webhook',
        connectorId: 'generic-webhook-runtime',
        targetSurface: 'provider-catalog',
        targetId: 'javascript:alert(1)',
      },
    });

    expect(plan).toMatchObject({
      status: 'blocked',
      actionKind: 'disabled-descriptor',
      targetSurface: 'provider-catalog',
      targetId: 'javascript:alert(1)',
      enabled: false,
      executable: false,
      sideEffects: 'none',
    });
    expect(plan.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'next_action_rejected',
      'next_action_target_unknown',
      'next_action_symbolic',
    ]));
  });
});
