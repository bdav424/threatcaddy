import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { IntegrationSourceDashboard } from '../components/Integrations/IntegrationSourceDashboard';

function providerCard(providerName: string): HTMLElement {
  const card = screen.getByRole('heading', { name: providerName }).closest('[data-integration-provider-card="true"]');
  if (!(card instanceof HTMLElement)) {
    throw new Error(`Provider card not found for ${providerName}`);
  }
  return card;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('IntegrationSourceDashboard', { timeout: 20000 }, () => {
  it('renders the shared local catalog source groups, provider status cards, capabilities, and no side effects', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');

    render(<IntegrationSourceDashboard />);

    const dashboard = screen.getByRole('region', { name: 'Integrations source catalog' });
    expect(dashboard).toHaveAttribute('data-integration-catalog-source', 'shared-local-catalog');
    expect(dashboard).toHaveAttribute('data-connector-runtime-ui-wiring', 'integrations');
    expect(dashboard).toHaveAttribute('data-connector-runtime-ui-contract', 'connector-runtime-ui-wiring-plan-v1');
    expect(dashboard).toHaveAttribute('data-connector-runtime-ui-executable', 'false');
    expect(dashboard).toHaveAttribute('data-connector-runtime-ui-side-effects', 'none');
    expect(dashboard).toHaveAccessibleDescription(
      expect.stringContaining('This view is passive. Opening Settings does not connect providers, install tools, test credentials, or expose live connector actions.'),
    );
    expect(screen.queryByRole('region', { name: 'Integrations runtime UI wiring preview' })).not.toBeInTheDocument();
    expect(screen.queryByText('Shared catalog only')).not.toBeInTheDocument();
    expect(screen.queryByText('Runtime wiring preview')).not.toBeInTheDocument();
    expect(screen.getByText(/Connector runtime UI wiring rows are catalog guidance only/i)).toBeInTheDocument();
    for (const rowId of [
      'provider-adapter-selection',
      'provider-auth-session-plan',
      'messaging-delivery-dry-run',
      'local-bridge-manual-probe',
      'connector-runtime-persistence',
    ]) {
      const row = dashboard.querySelector(`[data-connector-runtime-ui-row="${rowId}"]`);
      expect(row).toBeInstanceOf(HTMLElement);
      expect(row).toHaveAttribute('data-connector-runtime-ui-status', 'blocked');
      expect(row).toHaveAttribute('data-connector-runtime-ui-executable', 'false');
      expect(row).toHaveAttribute('data-connector-runtime-ui-side-effects', 'none');
    }
    expect(within(dashboard).getByText(/does not run setup, provider tests, webhooks, local probes, storage, import, or export/i)).toBeInTheDocument();
    for (const group of ['Threat Intelligence', 'Malware Analysis / Sandbox', 'SIEM / SOAR']) {
      expect(screen.getByRole('region', { name: `${group} integrations` })).toBeInTheDocument();
    }
    expect(screen.queryByRole('region', { name: 'Email integrations' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Messaging integrations' })).not.toBeInTheDocument();
    expect(screen.getByText('AbuseIPDB')).toBeInTheDocument();
    expect(screen.getByText('ServiceNow SecOps')).toBeInTheDocument();
    expect(screen.getByText(/^\d+ visible providers out of \d+ total\.$/)).toBeInTheDocument();

    const abuseipdbCard = providerCard('AbuseIPDB');
    const card = within(abuseipdbCard);
    expect(abuseipdbCard).toHaveAttribute('data-provider-passive-mode', 'catalog-reference-only');
    expect(abuseipdbCard).toHaveAttribute('data-provider-source-status', 'builtin-template');
    expect(abuseipdbCard).toHaveAttribute('data-provider-configuration-status', 'not-configured');
    expect(abuseipdbCard).toHaveAttribute('data-provider-action-kind', 'disabled-descriptor');
    expect(abuseipdbCard).toHaveAttribute('data-provider-action-status', 'disabled');
    expect(abuseipdbCard).toHaveAttribute('data-provider-action-enabled', 'false');
    expect(abuseipdbCard).toHaveAttribute('data-provider-action-executable', 'false');
    expect(abuseipdbCard).toHaveAttribute('data-provider-action-side-effects', 'none');
    expect(abuseipdbCard).toHaveAttribute('data-provider-action-target-surface', 'integration-template');
    expect(abuseipdbCard).toHaveAttribute('data-provider-action-target-id', 'abuseipdb');
    expect(abuseipdbCard).toHaveAttribute('data-provider-activation-blocked', 'true');
    expect(card.queryByText('Built-in template')).not.toBeInTheDocument();
    expect(card.queryByText('Not configured')).not.toBeInTheDocument();
    expect(card.queryByText('Disabled')).not.toBeInTheDocument();

    fireEvent.click(card.getByRole('button', { name: 'Show AbuseIPDB details' }));
    expect(card.getByText(/Templates: abuseipdb-check/)).toBeInTheDocument();
    expect(card.getByText(/Built-in template metadata\./)).toBeInTheDocument();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('distinguishes built-in catalog and future-connector descriptors without executable actions', () => {
    render(<IntegrationSourceDashboard />);

    const abuseipdbCard2 = providerCard('AbuseIPDB');
    const abuseipdb2 = within(abuseipdbCard2);
    expect(abuseipdbCard2).toHaveAttribute('data-provider-action-kind', 'disabled-descriptor');
    expect(abuseipdbCard2).toHaveAttribute('data-provider-action-status', 'disabled');
    expect(abuseipdbCard2).toHaveAttribute('data-provider-action-enabled', 'false');
    expect(abuseipdbCard2).toHaveAttribute('data-provider-action-executable', 'false');
    expect(abuseipdbCard2).toHaveAttribute('data-provider-action-target-surface', 'integration-template');
    expect(abuseipdbCard2).toHaveAttribute('data-provider-action-target-id', 'abuseipdb');
    expect(abuseipdbCard2).toHaveAttribute('data-provider-activation-blocked', 'true');
    expect(abuseipdb2.queryByText('Disabled')).not.toBeInTheDocument();
    fireEvent.click(abuseipdb2.getByRole('button', { name: 'Show AbuseIPDB details' }));
    expect(abuseipdb2.getByText(/Templates: abuseipdb-check/)).toBeInTheDocument();
    expect(abuseipdb2.getByText(/Built-in template metadata\./)).toBeInTheDocument();

    const mispCard = providerCard('MISP');
    const misp = within(mispCard);
    expect(mispCard).toHaveAttribute('data-provider-action-kind', 'disabled-descriptor');
    expect(mispCard).toHaveAttribute('data-provider-action-status', 'disabled');
    expect(mispCard).toHaveAttribute('data-provider-action-enabled', 'false');
    expect(mispCard).toHaveAttribute('data-provider-action-executable', 'false');
    expect(mispCard).toHaveAttribute('data-provider-action-target-surface', 'provider-catalog');
    expect(mispCard).toHaveAttribute('data-provider-action-target-id', 'misp');
    expect(mispCard).toHaveAttribute('data-provider-activation-blocked', 'true');
    fireEvent.click(misp.getByRole('button', { name: 'Show MISP details' }));
    expect(misp.getByText(/No setup action is available yet/)).toBeInTheDocument();
    expect(misp.getByText(/No setup action\./)).toBeInTheDocument();
  });

  it('opens the legacy integration settings window from compact provider rows', () => {
    const openLegacyTools = vi.fn();
    render(<IntegrationSourceDashboard onOpenLegacyTools={openLegacyTools} />);

    fireEvent.click(within(providerCard('AbuseIPDB')).getByRole('button', {
      name: 'Open AbuseIPDB integration settings',
    }));

    expect(openLegacyTools).toHaveBeenCalledTimes(1);
  });

  it('exposes the responsive stacked, two-column, and three-column grid shell', () => {
    render(<IntegrationSourceDashboard />);
    const grid = screen.getByTestId('integrations-dashboard-grid');
    expect(grid).toHaveAttribute('data-responsive-columns', 'grid');
    expect(grid.className).toContain('space-y-4');
  });

  it('collapses and expands source groups without removing other groups', () => {
    render(<IntegrationSourceDashboard />);

    const threatIntelRegion = screen.getByRole('region', { name: 'Threat Intelligence integrations' });
    expect(within(threatIntelRegion).getByText('AbuseIPDB')).toBeInTheDocument();

    fireEvent.click(within(threatIntelRegion).getByRole('button', { name: 'Collapse Threat Intelligence integrations' }));
    expect(threatIntelRegion).toHaveAttribute('data-integration-group-collapsed', 'true');
    expect(within(threatIntelRegion).queryByText('AbuseIPDB')).not.toBeInTheDocument();
    expect(screen.getByText('ServiceNow SecOps')).toBeInTheDocument();

    fireEvent.click(within(threatIntelRegion).getByRole('button', { name: 'Expand Threat Intelligence integrations' }));
    expect(threatIntelRegion).toHaveAttribute('data-integration-group-collapsed', 'false');
    expect(within(threatIntelRegion).getByText('AbuseIPDB')).toBeInTheDocument();
  });

  it('uses ToolbarSelect-style filters and expands provider details', () => {
    render(<IntegrationSourceDashboard />);

    fireEvent.click(screen.getByRole('combobox', { name: 'Filter integration source type' }));
    fireEvent.click(screen.getByRole('option', { name: 'Threat Intelligence' }));

    expect(screen.queryByRole('region', { name: 'Email integrations' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Messaging integrations' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Threat Intelligence integrations' })).toBeInTheDocument();
    expect(screen.getByText('AbuseIPDB')).toBeInTheDocument();
    expect(screen.getByText(/^\d+ visible providers out of \d+ total\.$/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('combobox', { name: 'Filter integration status' }));
    fireEvent.click(screen.getByRole('option', { name: 'Built-in template' }));
    expect(screen.getByText('AbuseIPDB')).toBeInTheDocument();
    expect(screen.queryByText('MISP')).not.toBeInTheDocument();
    expect(screen.getByText(/^\d+ visible providers out of \d+ total\.$/)).toBeInTheDocument();

    const detailsButton = screen.getByRole('button', { name: 'Show AbuseIPDB details' });
    fireEvent.click(detailsButton);

    const details = screen.getByText(/Templates: abuseipdb-check/);
    const detailsPanel = details.closest('div');
    expect(detailsPanel).toBeInstanceOf(HTMLElement);
    expect(detailsButton).toHaveAttribute('aria-controls', (detailsPanel as HTMLElement).id);
    expect(screen.getByText(/Built-in template metadata\./)).toBeInTheDocument();
  });
});
