import { describe, expect, it, vi } from 'vitest';
import { getIntegrationCatalogProvider, getIntegrationCatalogProviders } from '../lib/integration-catalog';
import {
  isKnownIntegrationNextActionTarget,
  resolveIntegrationNextActionPlan,
} from '../lib/integration-next-actions';
import type { IntegrationCatalogProvider } from '../types/integration-types';

function providerWithAction(
  providerId: string,
  nextAction: IntegrationCatalogProvider['nextAction'],
): IntegrationCatalogProvider {
  const provider = getIntegrationCatalogProvider(providerId);
  if (!provider) throw new Error(`Missing test provider: ${providerId}`);
  return { ...provider, nextAction };
}

describe('integration next action resolver', () => {
  it('resolves every local catalog nextAction into a non-executing plan without side effects', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const plans = getIntegrationCatalogProviders().map((provider) => resolveIntegrationNextActionPlan(provider));

    expect(plans.length).toBeGreaterThan(0);
    expect(plans.every((plan) => plan.status !== 'rejected')).toBe(true);
    expect(plans.every((plan) => plan.executable === false)).toBe(true);
    expect(plans.every((plan) => plan.sideEffects === 'none')).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
  });

  it('preserves gated reasons for local route-only setup references', () => {
    const gmail = getIntegrationCatalogProvider('gmail-google');
    expect(gmail?.nextAction).toBeDefined();

    const plan = resolveIntegrationNextActionPlan(gmail!);

    expect(plan).toMatchObject({
      providerId: 'gmail-google',
      actionKind: 'route-only',
      planKind: 'assistantcaddy-route-reference',
      targetSurface: 'assistantcaddy-route',
      targetId: 'assistantcaddy-email-setup',
      status: 'gated',
      gatedReason: gmail?.nextAction?.gatedReason,
      executable: false,
      sideEffects: 'none',
    });
    expect(plan.disabledReason).toBeUndefined();
  });

  it('preserves disabled reasons for built-in template metadata references', () => {
    const slack = getIntegrationCatalogProvider('slack');
    expect(slack?.nextAction).toBeDefined();

    const plan = resolveIntegrationNextActionPlan(slack!);

    expect(plan).toMatchObject({
      providerId: 'slack',
      actionKind: 'builtin-template',
      planKind: 'integration-template-reference',
      targetSurface: 'integration-template',
      targetId: 'slack',
      status: 'disabled',
      disabledReason: slack?.nextAction?.disabledReason,
      executable: false,
      sideEffects: 'none',
    });
    expect(plan.gatedReason).toBeUndefined();
  });

  it('preserves disabled reasons for future connector metadata references', () => {
    const sentinel = getIntegrationCatalogProvider('microsoft-sentinel');
    expect(sentinel?.nextAction).toBeDefined();

    const plan = resolveIntegrationNextActionPlan(sentinel!);

    expect(plan).toMatchObject({
      providerId: 'microsoft-sentinel',
      actionKind: 'future-connector',
      planKind: 'provider-catalog-reference',
      targetSurface: 'provider-catalog',
      targetId: 'microsoft-sentinel',
      status: 'disabled',
      disabledReason: sentinel?.nextAction?.disabledReason,
      executable: false,
      sideEffects: 'none',
    });
    expect(plan.gatedReason).toBeUndefined();
  });

  it('rejects unknown target ids fail-closed', () => {
    const mutated = providerWithAction('virustotal', {
      kind: 'builtin-template',
      label: 'Review mutated template',
      targetSurface: 'integration-template',
      targetId: 'javascript:alert(1)',
      disabledReason: 'Preserve this disabled reason.',
    });

    expect(isKnownIntegrationNextActionTarget('integration-template', 'javascript:alert(1)')).toBe(false);

    const plan = resolveIntegrationNextActionPlan(mutated);

    expect(plan).toMatchObject({
      providerId: 'virustotal',
      actionKind: 'builtin-template',
      targetSurface: 'integration-template',
      targetId: 'javascript:alert(1)',
      planKind: 'rejected',
      status: 'rejected',
      disabledReason: 'Preserve this disabled reason.',
      executable: false,
      sideEffects: 'none',
    });
    expect(plan.rejectedReason).toContain('Unknown nextAction target id');
  });

  it('rejects kind and surface mismatches fail-closed', () => {
    const mutated = providerWithAction('gmail-google', {
      kind: 'route-only',
      label: 'Open mutated setup',
      targetSurface: 'provider-catalog',
      targetId: 'gmail-google',
      gatedReason: 'Preserve this gated reason.',
    });

    const plan = resolveIntegrationNextActionPlan(mutated);

    expect(plan).toMatchObject({
      providerId: 'gmail-google',
      actionKind: 'route-only',
      targetSurface: 'provider-catalog',
      targetId: 'gmail-google',
      planKind: 'rejected',
      status: 'rejected',
      gatedReason: 'Preserve this gated reason.',
      executable: false,
      sideEffects: 'none',
    });
    expect(plan.rejectedReason).toContain('must target assistantcaddy-route');
  });

  it('rejects missing disabled or gated boundary reasons fail-closed', () => {
    const builtinWithoutDisabledReason = providerWithAction('slack', {
      kind: 'builtin-template',
      label: 'Review Slack template',
      targetSurface: 'integration-template',
      targetId: 'slack',
    });
    const routeWithoutGatedReason = providerWithAction('gmail-google', {
      kind: 'route-only',
      label: 'Open Gmail setup',
      targetSurface: 'assistantcaddy-route',
      targetId: 'assistantcaddy-email-setup',
    });

    expect(resolveIntegrationNextActionPlan(builtinWithoutDisabledReason)).toMatchObject({
      providerId: 'slack',
      status: 'rejected',
      rejectedReason: 'builtin-template nextAction metadata must include a disabledReason.',
      executable: false,
    });
    expect(resolveIntegrationNextActionPlan(routeWithoutGatedReason)).toMatchObject({
      providerId: 'gmail-google',
      status: 'rejected',
      rejectedReason: 'Route-only nextAction metadata must include a gatedReason.',
      executable: false,
    });
  });
});
