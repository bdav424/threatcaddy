import { test, expect, type Page } from '@playwright/test';
import { goToApp, getSidebar } from './fixtures';

async function openIntegrations(page: Page) {
  const sidebar = getSidebar(page);
  await sidebar.getByRole('button', { name: /settings/i }).first().click();
  const settingsTablist = page.getByRole('tablist', { name: /settings/i });
  await settingsTablist.getByRole('tab', { name: 'Integrations' }).click();
  await expect(page.getByRole('region', { name: 'Integrations source catalog' })).toBeVisible();
}

async function dashboardColumnCount(page: Page) {
  return page.locator('[data-integrations-dashboard-grid="true"]').evaluate((grid) => {
    const columns = window.getComputedStyle(grid).gridTemplateColumns;
    return columns.split(' ').filter(Boolean).length;
  });
}

test.describe('Integrations source dashboard', () => {
  test('renders catalog-only provider cards, filters, details, and collapsed groups without provider preflight network', async ({ page }) => {
    await goToApp(page);

    const unexpectedRequests: string[] = [];
    const providerProbePattern = /\/(?:api\/tags|models|health|chat\/completions|oauth|imap|smtp)(?:[/?#]|$)|virustotal|censys|slack|microsoftonline|graph\.microsoft|gmail|googleapis|team-cymru|cymru|misp|opencti|hybrid-analysis|any\.run|splunk|sentinel/i;
    const secretPattern = /(?:api[_-]?key|token|secret|password|authorization)=/i;
    page.on('request', (request) => {
      const url = request.url();
      const postData = request.postData() ?? '';
      const authorization = request.headers().authorization;
      if (providerProbePattern.test(url) || secretPattern.test(url) || secretPattern.test(postData) || authorization) {
        unexpectedRequests.push(url);
      }
    });

    await openIntegrations(page);

    await expect(page.getByText('Shared catalog only')).toHaveCount(0);
    await expect(page.getByText('Runtime wiring preview')).toHaveCount(0);
    await expect(page.getByText('Review installed tools separately')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Available sources' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Installed(?:\s*\d+)?$/ })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /^Catalog(?:\s*\d+)?$/ })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /^History(?:\s*\d+)?$/ })).toHaveCount(1);
    for (const group of ['Email', 'Messaging', 'Threat Intelligence', 'Malware Analysis / Sandbox', 'SIEM / SOAR']) {
      await expect(page.getByRole('region', { name: `${group} integrations` })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'AbuseIPDB' })).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'ServiceNow SecOps' })).toHaveCount(1);

    const emailGroup = page.getByRole('region', { name: 'Email integrations' });
    await expect(emailGroup.getByRole('heading', { name: 'Gmail / Google Workspace' })).toHaveCount(1);

    await page.getByRole('combobox', { name: 'Filter integration source type' }).click();
    await page.getByRole('option', { name: 'Messaging' }).click();
    await expect(page.getByRole('region', { name: 'Messaging integrations' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Email integrations' })).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Filter integration status' }).click();
    await page.getByRole('option', { name: 'Built-in template' }).click();
    const messagingGroup = page.getByRole('region', { name: 'Messaging integrations' });
    await expect(page.getByRole('heading', { name: 'Slack' })).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Microsoft Teams' })).toHaveCount(0);
    await expect(messagingGroup.getByText('Incoming webhook channel notification')).toHaveCount(0);
    await expect(messagingGroup.getByText(/Built-in templates: slack-webhook-notify/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Show Slack details' }).click({ force: true });
    await expect(page.getByText(/Built-in templates: slack-webhook-notify/)).toHaveCount(1);
    await expect(page.getByText(/Built-in template metadata is available; no integration run starts here/)).toHaveCount(1);
    await page.getByRole('button', { name: 'Hide Slack details' }).click({ force: true });
    await expect(page.getByRole('button', { name: 'Open Slack integration settings' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Installed(?:\s*\d+)?$/ })).toBeVisible();

    await page.getByRole('combobox', { name: 'Filter integration status' }).click();
    await page.getByRole('option', { name: 'All statuses' }).click();
    await page.getByRole('combobox', { name: 'Filter integration source type' }).click();
    await page.getByRole('option', { name: 'Email' }).click();
    await expect(page.getByRole('region', { name: 'Email integrations' })).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Gmail / Google Workspace' })).toHaveCount(1);
    await emailGroup.getByRole('button', { name: 'Collapse Email integrations' }).click({ force: true });
    await expect(emailGroup).toHaveAttribute('data-integration-group-collapsed', 'true');
    await expect(emailGroup.getByText('Gmail / Google Workspace')).toHaveCount(0);
    await emailGroup.getByRole('button', { name: 'Expand Email integrations' }).click({ force: true });
    await expect(emailGroup.getByText('Gmail / Google Workspace')).toHaveCount(1);

    expect(unexpectedRequests).toEqual([]);
  });

  test('adapts from stacked to two and three responsive source columns', async ({ page }) => {
    await goToApp(page);
    await openIntegrations(page);

    await page.setViewportSize({ width: 900, height: 900 });
    await expect.poll(() => dashboardColumnCount(page)).toBe(1);

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect.poll(() => dashboardColumnCount(page)).toBe(2);

    await page.setViewportSize({ width: 1600, height: 900 });
    await expect.poll(() => dashboardColumnCount(page)).toBe(3);
  });
});
