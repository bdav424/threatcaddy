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

describe('IntegrationSourceDashboard', () => {
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
    for (const group of ['Email', 'Messaging', 'Threat Intelligence', 'Malware Analysis / Sandbox', 'SIEM / SOAR']) {
      expect(screen.getByRole('region', { name: `${group} integrations` })).toBeInTheDocument();
    }
    expect(screen.getByText('AbuseIPDB')).toBeInTheDocument();
    expect(screen.getByText('ServiceNow SecOps')).toBeInTheDocument();
    expect(screen.getByText(/^\d+ visible providers out of \d+ total\.$/)).toBeInTheDocument();

    const gmailCard = providerCard('Gmail / Google Workspace');
    const card = within(gmailCard);
    expect(gmailCard).toHaveAttribute('data-provider-passive-mode', 'catalog-reference-only');
    expect(gmailCard).toHaveAttribute('data-provider-source-status', 'design-only');
    expect(gmailCard).toHaveAttribute('data-provider-configuration-status', 'not-configured');
    expect(gmailCard).toHaveAttribute('data-provider-action-kind', 'route-descriptor');
    expect(gmailCard).toHaveAttribute('data-provider-action-status', 'gated');
    expect(gmailCard).toHaveAttribute('data-provider-action-enabled', 'false');
    expect(gmailCard).toHaveAttribute('data-provider-action-executable', 'false');
    expect(gmailCard).toHaveAttribute('data-provider-action-side-effects', 'none');
    expect(gmailCard).toHaveAttribute('data-provider-action-target-surface', 'assistantcaddy-route');
    expect(gmailCard).toHaveAttribute('data-provider-action-target-id', 'assistantcaddy-email-setup');
    expect(gmailCard).toHaveAttribute('data-provider-activation-blocked', 'true');
    expect(card.queryByText('Design only')).not.toBeInTheDocument();
    expect(card.queryByText('Not configured')).not.toBeInTheDocument();
    expect(card.queryByText('Gated')).not.toBeInTheDocument();
    expect(card.queryByText('Provider selection card')).not.toBeInTheDocument();
    expect(card.queryByText('Future OAuth onboarding placeholder')).not.toBeInTheDocument();
    expect(card.queryByText(/Passive catalog card/i)).not.toBeInTheDocument();

    fireEvent.click(card.getByRole('button', { name: 'Show Gmail / Google Workspace details' }));
    expect(card.getByText('Provider selection card')).toBeInTheDocument();
    expect(card.queryByText('Future OAuth onboarding placeholder')).not.toBeInTheDocument();
    expect(card.getByText(/Setup opens from its dedicated route/)).toBeInTheDocument();
    expect(card.getByText(/Dedicated setup route\./)).toBeInTheDocument();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('distinguishes built-in catalog and future-connector descriptors without executable actions', () => {
    render(<IntegrationSourceDashboard />);

    const slackCard = providerCard('Slack');
    const slack = within(slackCard);
    expect(slackCard).toHaveAttribute('data-provider-action-kind', 'disabled-descriptor');
    expect(slackCard).toHaveAttribute('data-provider-action-status', 'disabled');
    expect(slackCard).toHaveAttribute('data-provider-action-enabled', 'false');
    expect(slackCard).toHaveAttribute('data-provider-action-executable', 'false');
    expect(slackCard).toHaveAttribute('data-provider-action-target-surface', 'integration-template');
    expect(slackCard).toHaveAttribute('data-provider-action-target-id', 'slack');
    expect(slackCard).toHaveAttribute('data-provider-activation-blocked', 'true');
    expect(slack.queryByText('Disabled')).not.toBeInTheDocument();
    fireEvent.click(slack.getByRole('button', { name: 'Show Slack details' }));
    expect(slack.getByText(/Templates: slack-webhook-notify/)).toBeInTheDocument();
    expect(slack.getByText(/Built-in template metadata\./)).toBeInTheDocument();

    const teamsCard = providerCard('Microsoft Teams');
    const teams = within(teamsCard);
    expect(teamsCard).toHaveAttribute('data-provider-action-kind', 'disabled-descriptor');
    expect(teamsCard).toHaveAttribute('data-provider-action-status', 'disabled');
    expect(teamsCard).toHaveAttribute('data-provider-action-enabled', 'false');
    expect(teamsCard).toHaveAttribute('data-provider-action-executable', 'false');
    expect(teamsCard).toHaveAttribute('data-provider-action-target-surface', 'provider-catalog');
    expect(teamsCard).toHaveAttribute('data-provider-action-target-id', 'microsoft-teams');
    expect(teamsCard).toHaveAttribute('data-provider-activation-blocked', 'true');
    fireEvent.click(teams.getByRole('button', { name: 'Show Microsoft Teams details' }));
    expect(teams.getByText(/No setup action is available yet/)).toBeInTheDocument();
    expect(teams.getByText(/No setup action\./)).toBeInTheDocument();
  });

  it('opens the legacy integration settings window from compact provider rows', () => {
    const openLegacyTools = vi.fn();
    render(<IntegrationSourceDashboard onOpenLegacyTools={openLegacyTools} />);

    fireEvent.click(within(providerCard('Gmail / Google Workspace')).getByRole('button', {
      name: 'Open Gmail / Google Workspace integration settings',
    }));

    expect(openLegacyTools).toHaveBeenCalledTimes(1);
  });

  it('exposes the responsive stacked, two-column, and three-column grid shell', () => {
    render(<IntegrationSourceDashboard />);
    const grid = screen.getByTestId('integrations-dashboard-grid');
    expect(grid).toHaveAttribute('data-responsive-columns', 'stacked');
    expect(grid.className).toContain('space-y-4');
  });

  it('collapses and expands source groups without removing other groups', () => {
    render(<IntegrationSourceDashboard />);

    const emailRegion = screen.getByRole('region', { name: 'Email integrations' });
    expect(within(emailRegion).getByText('Gmail / Google Workspace')).toBeInTheDocument();

    fireEvent.click(within(emailRegion).getByRole('button', { name: 'Collapse Email integrations' }));
    expect(emailRegion).toHaveAttribute('data-integration-group-collapsed', 'true');
    expect(within(emailRegion).queryByText('Gmail / Google Workspace')).not.toBeInTheDocument();
    expect(screen.getByText('Slack')).toBeInTheDocument();

    fireEvent.click(within(emailRegion).getByRole('button', { name: 'Expand Email integrations' }));
    expect(emailRegion).toHaveAttribute('data-integration-group-collapsed', 'false');
    expect(within(emailRegion).getByText('Gmail / Google Workspace')).toBeInTheDocument();
  });

  it('uses ToolbarSelect-style filters and expands provider details', () => {
    render(<IntegrationSourceDashboard />);

    fireEvent.click(screen.getByRole('combobox', { name: 'Filter integration source type' }));
    fireEvent.click(screen.getByRole('option', { name: 'Messaging' }));

    expect(screen.queryByRole('region', { name: 'Email integrations' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Messaging integrations' })).toBeInTheDocument();
    expect(screen.getByText('Slack')).toBeInTheDocument();
    expect(screen.getByText(/^\d+ visible providers out of \d+ total\.$/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('combobox', { name: 'Filter integration status' }));
    fireEvent.click(screen.getByRole('option', { name: 'Built-in template' }));
    expect(screen.getByText('Slack')).toBeInTheDocument();
    expect(screen.queryByText('Microsoft Teams')).not.toBeInTheDocument();
    expect(screen.getByText(/^1 visible provider out of \d+ total\.$/)).toBeInTheDocument();

    const detailsButton = screen.getByRole('button', { name: 'Show Slack details' });
    fireEvent.click(detailsButton);

    const details = screen.getByText(/Templates: slack-webhook-notify/);
    const detailsPanel = details.closest('div');
    expect(detailsPanel).toBeInstanceOf(HTMLElement);
    expect(detailsButton).toHaveAttribute('aria-controls', (detailsPanel as HTMLElement).id);
    expect(screen.getByText(/Built-in template metadata\./)).toBeInTheDocument();
  });
});
