import { test, expect, type Page, type Request } from '@playwright/test';
import { getSidebar, goToApp, navigateToView } from './fixtures';

type SuspiciousRequest = {
  method: string;
  url: string;
  reasons: string[];
};

type SuspiciousRequestMonitor = {
  getAppLoadRequests: () => SuspiciousRequest[];
  getScopedRequests: () => SuspiciousRequest[];
  markScopedBoundary: () => void;
};

const APP_ORIGINS = new Set([
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]);

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const LOCAL_BRIDGE_PORTS = new Set(['11434', '8766']);
const SECRET_MARKER_PATTERN =
  /(?:api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|id[_-]?token|password|passwd|secret|authorization)\s*[:=]/i;
const SECRET_QUERY_PATTERN =
  /[?&](?:api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|id[_-]?token|password|passwd|secret|authorization)=/i;
const OAUTH_OR_CONNECT_PATH_PATTERN =
  /\/(?:oauth|oauth2|authorize|token|connect|callback)(?:[/?#]|$)/i;
const WEBHOOK_PATH_PATTERN = /\/(?:webhooks?)(?:[/?#]|$)/i;
const LOCAL_BRIDGE_PATH_PATTERN =
  /\/(?:v1\/(?:models|chat\/completions)|api\/tags|health|skills|execute|api\/caddy-agents|api\/email|api\/calendar|imap|smtp)(?:[/?#]|$)/i;

function providerReason(parsedUrl: URL): string | null {
  const hostname = parsedUrl.hostname.toLowerCase();
  const pathname = parsedUrl.pathname.toLowerCase();

  if (
    hostname === 'accounts.google.com'
    || hostname === 'oauth2.googleapis.com'
    || hostname === 'gmail.googleapis.com'
    || hostname === 'calendar.googleapis.com'
    || (hostname === 'www.googleapis.com' && /\/(?:gmail|calendar)\//i.test(pathname))
  ) {
    return 'google provider endpoint';
  }

  if (
    hostname === 'login.microsoftonline.com'
    || hostname.endsWith('.login.microsoftonline.com')
    || hostname === 'graph.microsoft.com'
    || hostname === 'outlook.office.com'
    || hostname === 'outlook.office365.com'
  ) {
    return 'microsoft provider endpoint';
  }

  if (
    hostname === 'proton.me'
    || hostname.endsWith('.proton.me')
    || hostname === 'protonmail.com'
    || hostname.endsWith('.protonmail.com')
  ) {
    return 'proton provider endpoint';
  }

  if (
    hostname === 'slack.com'
    || hostname.endsWith('.slack.com')
    || hostname === 'api.slack.com'
    || hostname === 'hooks.slack.com'
  ) {
    return 'slack provider endpoint';
  }

  if (
    /(?:team-?cymru|virustotal|censys|misp|opencti|hybrid-?analysis|any\.run|joesandbox|splunk|sentinel|recorded-?future|flashpoint|discord|mattermost)/i
      .test(hostname)
  ) {
    return 'integration provider endpoint';
  }

  return null;
}

function classifyRequest(request: Request): SuspiciousRequest | null {
  const url = request.url();
  const reasons: string[] = [];

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    reasons.push('unparseable request URL');
    return { method: request.method(), url, reasons };
  }

  const postData = request.postData() ?? '';
  const authorization = request.headers().authorization;
  const isHttpRequest = parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  const isAppOrigin = APP_ORIGINS.has(parsedUrl.origin);
  const isLoopback = LOOPBACK_HOSTS.has(parsedUrl.hostname.toLowerCase());
  const isLocalBridgePort = LOCAL_BRIDGE_PORTS.has(parsedUrl.port);
  const requestTarget = `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  const provider = providerReason(parsedUrl);

  if (authorization) reasons.push('authorization header present');
  if (SECRET_QUERY_PATTERN.test(url)) reasons.push('secret-bearing URL parameter');
  if (SECRET_MARKER_PATTERN.test(postData)) reasons.push('secret marker in request body');
  if (provider) reasons.push(provider);
  if (OAUTH_OR_CONNECT_PATH_PATTERN.test(requestTarget)) reasons.push('oauth/connect path');
  if (WEBHOOK_PATH_PATTERN.test(requestTarget) || /(?:^|[.-])webhook(?:[.-]|$)/i.test(parsedUrl.hostname)) {
    reasons.push('webhook endpoint');
  }
  if (isLoopback && (isLocalBridgePort || LOCAL_BRIDGE_PATH_PATTERN.test(requestTarget))) {
    reasons.push('local bridge or local service probe');
  }
  if (isHttpRequest && !isAppOrigin && !isLoopback) {
    reasons.push('external network request');
  }

  return reasons.length > 0 ? { method: request.method(), url, reasons } : null;
}

function monitorSuspiciousRequests(page: Page): SuspiciousRequestMonitor {
  const appLoadRequests: SuspiciousRequest[] = [];
  const scopedRequests: SuspiciousRequest[] = [];
  let scopedBoundaryReached = false;

  page.on('request', (request) => {
    const suspiciousRequest = classifyRequest(request);
    if (suspiciousRequest) {
      if (scopedBoundaryReached) {
        scopedRequests.push(suspiciousRequest);
        return;
      }
      appLoadRequests.push(suspiciousRequest);
    }
  });

  return {
    getAppLoadRequests: () => appLoadRequests,
    getScopedRequests: () => scopedRequests,
    markScopedBoundary: () => {
      scopedBoundaryReached = true;
    },
  };
}

function reportAppLoadTelemetryIfObserved(appLoadRequests: SuspiciousRequest[]) {
  if (appLoadRequests.length === 0) return;
  console.warn(
    `[onboarding-no-network] Suspicious app-load requests observed before the scoped onboarding monitor boundary:\n${JSON.stringify(appLoadRequests, null, 2)}`,
  );
}

async function expectNoSuspiciousRequests(page: Page, suspiciousRequests: SuspiciousRequest[], phase: string) {
  await page.waitForTimeout(250);
  expect(suspiciousRequests, `${phase} made suspicious onboarding requests`).toEqual([]);
}

async function openSettingsTab(page: Page, tabName: 'AI' | 'Integrations') {
  const sidebar = getSidebar(page);
  await sidebar.getByRole('button', { name: /settings/i }).first().click();
  const settingsTablist = page.getByRole('tablist', { name: /settings/i });
  await settingsTablist.getByRole('tab', { name: tabName }).click();
}

test.describe('Onboarding no-network proof', () => {
  test('keeps AI, Integrations, and EmailCaddy setup selection passive until explicit test or connect actions', async ({ page }) => {
    const suspiciousRequestMonitor = monitorSuspiciousRequests(page);
    await goToApp(page);
    suspiciousRequestMonitor.markScopedBoundary();
    const appLoadRequests = suspiciousRequestMonitor.getAppLoadRequests();
    if (appLoadRequests.length > 0) {
      test.info().annotations.push({
        type: 'app-load-telemetry',
        description: JSON.stringify(appLoadRequests),
      });
      reportAppLoadTelemetryIfObserved(appLoadRequests);
    }
    await expectNoSuspiciousRequests(page, suspiciousRequestMonitor.getScopedRequests(), 'post-load onboarding baseline');

    await test.step('Settings AI setup route selection is passive', async () => {
      await openSettingsTab(page, 'AI');
      const aiSetup = page.getByRole('region', { name: 'AssistantCaddy AI setup' });
      await expect(aiSetup).toBeVisible();

      await aiSetup.getByRole('button', { name: 'Use CaddyAI baseline' }).click();
      await aiSetup.getByRole('button', { name: 'Use OpenAI-compatible API' }).click();
      await aiSetup.getByRole('button', { name: 'Use local Ollama / localhost' }).click();

      await expect(aiSetup.getByText(/Provider checks stay explicit/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Test Connection/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Fetch Models/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Discover Skills/i })).toBeVisible();
      await expectNoSuspiciousRequests(page, suspiciousRequestMonitor.getScopedRequests(), 'Settings AI setup selection');
    });

    await test.step('Settings Integrations source catalog selection is passive', async () => {
      await openSettingsTab(page, 'Integrations');
      const catalog = page.getByRole('region', { name: 'Integrations source catalog' });
      await expect(catalog).toBeVisible();
      await expect(catalog).toHaveAttribute('data-integration-catalog-source', 'shared-local-catalog');
      await expect(catalog.getByText('Shared catalog only')).toBeVisible();

      await page.getByRole('combobox', { name: 'Filter integration source type' }).click();
      await page.getByRole('option', { name: 'Messaging' }).click();
      await expect(page.getByRole('region', { name: 'Messaging integrations' })).toBeVisible();
      await page.getByRole('button', { name: 'Show Slack details' }).click();
      await expect(catalog.getByRole('button', { name: 'Hide Slack details' })).toBeVisible();

      await page.getByRole('combobox', { name: 'Filter integration source type' }).click();
      await page.getByRole('option', { name: 'Threat Intelligence' }).click();
      await expect(page.getByRole('region', { name: 'Threat Intelligence integrations' })).toBeVisible();
      await page.getByRole('button', { name: 'Show Team Cymru / Pure Signal / Scout details' }).click();
      await expect(catalog.getByRole('button', { name: 'Hide Team Cymru / Pure Signal / Scout details' })).toBeVisible();

      await page.getByRole('combobox', { name: 'Filter integration status' }).click();
      await page.getByRole('option', { name: 'Catalog only' }).click();
      await expect(catalog.getByText('Catalog only').first()).toBeVisible();
      await expectNoSuspiciousRequests(page, suspiciousRequestMonitor.getScopedRequests(), 'Integrations catalog selection');
    });

    await test.step('EmailCaddy account setup option selection and safe local controls stay request-free', async () => {
      await navigateToView(page, 'EmailCaddy');
      await expect(page.getByRole('heading', { name: /EmailCaddy/i })).toBeVisible();

      await page.getByRole('button', { name: 'Set up EmailCaddy account' }).click();
      const setup = page.getByRole('region', { name: 'Email account setup' });
      await expect(setup).toBeVisible();
      await expect(setup).toContainText('will not store passwords or tokens');
      const safeConnectionTestButton = setup.getByRole('button', { name: 'Run safe connection test' });
      const saveLocalSetupButton = setup.getByRole('button', { name: 'Save local setup state' });

      for (const { label, setupPath } of [
        { label: 'Gmail / Google', setupPath: 'Google setup path' },
        { label: 'Outlook / Microsoft / Hotmail', setupPath: 'Microsoft setup path' },
        { label: 'Proton', setupPath: 'Proton setup path' },
        { label: 'Generic IMAP / SMTP', setupPath: 'IMAP setup path' },
        { label: 'Local mail bridge / manual proxy', setupPath: 'Bridge setup path' },
      ]) {
        await setup.getByRole('button', { name: label, exact: true }).click();
        await expect(setup).toContainText(setupPath);
        await expectNoSuspiciousRequests(page, suspiciousRequestMonitor.getScopedRequests(), `EmailCaddy ${label} setup selection`);
      }

      await expect(safeConnectionTestButton).toBeVisible();
      await expect(saveLocalSetupButton).toBeDisabled();
      await safeConnectionTestButton.click();
      await expect(setup).toContainText('No provider, OAuth, IMAP, SMTP, bridge, or send request was made');
      await expect(saveLocalSetupButton).toBeEnabled();
      await expectNoSuspiciousRequests(page, suspiciousRequestMonitor.getScopedRequests(), 'EmailCaddy safe local connection test');

      await saveLocalSetupButton.click();
      await expect(setup).toContainText('setup is staged locally for this session');
      await expect(page.locator('[data-email-account-status="true"]').first()).toContainText('Local setup staged');
      await expectNoSuspiciousRequests(page, suspiciousRequestMonitor.getScopedRequests(), 'EmailCaddy local setup save');
    });
  });
});
