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
    hostname === 'accounts.google.com' ||
    hostname === 'oauth2.googleapis.com' ||
    hostname === 'gmail.googleapis.com' ||
    hostname === 'calendar.googleapis.com' ||
    (hostname === 'www.googleapis.com' && /\/(?:gmail|calendar)\//i.test(pathname))
  ) {
    return 'google provider endpoint';
  }

  if (
    hostname === 'login.microsoftonline.com' ||
    hostname.endsWith('.login.microsoftonline.com') ||
    hostname === 'graph.microsoft.com' ||
    hostname === 'outlook.office.com' ||
    hostname === 'outlook.office365.com'
  ) {
    return 'microsoft provider endpoint';
  }

  if (
    hostname === 'proton.me' ||
    hostname.endsWith('.proton.me') ||
    hostname === 'protonmail.com' ||
    hostname.endsWith('.protonmail.com')
  ) {
    return 'proton provider endpoint';
  }

  if (
    hostname === 'slack.com' ||
    hostname.endsWith('.slack.com') ||
    hostname === 'api.slack.com' ||
    hostname === 'hooks.slack.com'
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
    if (!suspiciousRequest) return;

    if (scopedBoundaryReached) {
      scopedRequests.push(suspiciousRequest);
      return;
    }

    appLoadRequests.push(suspiciousRequest);
  });

  return {
    getAppLoadRequests: () => appLoadRequests,
    getScopedRequests: () => scopedRequests,
    markScopedBoundary: () => {
      scopedBoundaryReached = true;
    },
  };
}

async function expectNoSuspiciousRequests(suspiciousRequests: SuspiciousRequest[], phase: string) {
  expect(suspiciousRequests, `${phase} made provider/OAuth/local-bridge/webhook requests`).toEqual([]);
}

async function openSettingsTab(page: Page, tabName: 'AI' | 'Integrations') {
  const sidebar = getSidebar(page);
  await sidebar.getByRole('button', { name: /settings/i }).first().click();
  const settingsTablist = page.getByRole('tablist', { name: /settings/i });
  await settingsTablist.getByRole('tab', { name: tabName }).click();
}

test.describe('Connector claim no-live browser proof', () => {
  test('keeps onboarding connector surfaces passive until explicit connect or test actions', async ({ page }) => {
    const suspiciousRequestMonitor = monitorSuspiciousRequests(page);
    await goToApp(page);
    suspiciousRequestMonitor.markScopedBoundary();

    const appLoadRequests = suspiciousRequestMonitor.getAppLoadRequests();
    if (appLoadRequests.length > 0) {
      test.info().annotations.push({
        type: 'app-load-telemetry',
        description: JSON.stringify(appLoadRequests),
      });
      console.warn(
        `[connector-claims-no-live] Suspicious app-load requests before scoped onboarding boundary:\n${JSON.stringify(appLoadRequests, null, 2)}`,
      );
    }

    await expectNoSuspiciousRequests(suspiciousRequestMonitor.getScopedRequests(), 'post-load baseline');

    await test.step('Settings > Integrations presents catalog/design language without live connector claims', async () => {
      await openSettingsTab(page, 'Integrations');
      const catalog = page.getByRole('region', { name: 'Integrations source catalog' });

      await expect(catalog).toBeVisible();
      await expect(catalog).toHaveAttribute('data-integration-catalog-source', 'shared-local-catalog');
      await expect(catalog.getByText('Shared catalog only')).toBeVisible();
      await expect(catalog).toContainText('remain catalog-only until a connector slice adds consent');
      await expect(catalog).toContainText('intentionally passive');
      await expect(catalog).toContainText('No provider calls on render');

      const emailGroup = page.getByRole('region', { name: 'Email integrations' });
      await expect(emailGroup.getByText('Design only').first()).toBeVisible();
      await expect(emailGroup.getByText('Future OAuth onboarding placeholder').first()).toBeVisible();
      await expect(emailGroup.getByText('Not configured - no provider test run').first()).toBeVisible();

      await page.getByRole('combobox', { name: 'Filter integration source type' }).click();
      await page.getByRole('option', { name: 'Messaging' }).click();
      const messagingGroup = page.getByRole('region', { name: 'Messaging integrations' });
      await expect(messagingGroup).toBeVisible();
      await page.getByRole('button', { name: 'Show Slack details' }).click();
      await expect(catalog.getByText(/Template availability does not mean the provider is connected/)).toBeVisible();
      await expect(catalog.getByText(/does not collect credentials, contact providers, run connection tests, or enable live data flow/i)).toBeVisible();

      await expectNoSuspiciousRequests(suspiciousRequestMonitor.getScopedRequests(), 'Settings Integrations passive navigation');
    });

    await test.step('Settings > AI presents route-selection language without probing providers or localhost', async () => {
      await openSettingsTab(page, 'AI');
      const aiSetup = page.getByRole('region', { name: 'AssistantCaddy AI setup' });

      await expect(aiSetup).toBeVisible();
      await expect(aiSetup).toContainText('Provider checks stay explicit');
      await expect(aiSetup).toContainText('No provider call is made by this setup card');
      await expect(aiSetup).toContainText('Selection stores provider preference only. It does not validate keys or send prompts.');
      await expect(aiSetup).toContainText('No localhost discovery runs automatically');
      await expect(aiSetup).toContainText('No adapter, OAuth flow, credential field, discovery call, or provider request is enabled here.');
      await expect(aiSetup).toContainText('Email and calendar setup live under Integrations/route-specific setup, not AssistantCaddy AI.');

      await aiSetup.getByRole('button', { name: 'Use CaddyAI baseline' }).click();
      await aiSetup.getByRole('button', { name: 'Use OpenAI-compatible API' }).click();
      await aiSetup.getByRole('button', { name: 'Use local Ollama / localhost' }).click();

      await expectNoSuspiciousRequests(suspiciousRequestMonitor.getScopedRequests(), 'Settings AI passive route selection');
    });

    await test.step('AssistantCaddy setup routing opens owner surfaces without connector side effects', async () => {
      await navigateToView(page, 'AssistantCaddy');
      const setupRoutes = page.getByRole('region', { name: 'AssistantCaddy setup routes' });

      await expect(setupRoutes).toBeVisible();
      await expect(setupRoutes).toContainText('Setup routes: AI setup, EmailCaddy, CalendarCaddy, Integrations');
      await expect(setupRoutes).toContainText('does not connect, probe, or store credentials');

      await setupRoutes.getByRole('button', { name: 'Expand' }).click();
      await expect(setupRoutes).toContainText('AI setup lives in Settings');
      await expect(setupRoutes).toContainText('email and calendar setup stay in their Caddy surfaces');
      await expect(setupRoutes).toContainText('source catalog lives under Integrations');

      await setupRoutes.getByRole('button', { name: 'Open AI setup' }).click();
      await expect(page.getByRole('region', { name: 'AssistantCaddy AI setup' })).toBeVisible();
      await navigateToView(page, 'AssistantCaddy');

      await page.getByRole('region', { name: 'AssistantCaddy setup routes' }).getByRole('button', { name: 'Open email setup' }).click();
      await expect(page.getByRole('heading', { name: /EmailCaddy/i })).toBeVisible();
      await expect(page.getByText('No real email account is configured. This mailbox is demo/mock mirrored data until a provider or local bridge is staged.')).toBeVisible();
      await page.getByRole('button', { name: 'Set up EmailCaddy account' }).click();
      const setup = page.getByRole('region', { name: 'Email account setup' });
      await expect(setup).toBeVisible();
      await expect(setup).toContainText('will not store passwords or tokens, start OAuth, call provider APIs, sync mail, or send messages');
      await navigateToView(page, 'AssistantCaddy');

      await page.getByRole('region', { name: 'AssistantCaddy setup routes' }).getByRole('button', { name: 'Open source catalog' }).click();
      await expect(page.getByRole('region', { name: 'Integrations source catalog' })).toBeVisible();

      await expectNoSuspiciousRequests(suspiciousRequestMonitor.getScopedRequests(), 'AssistantCaddy setup routing');
    });

    await test.step('EmailCaddy setup selection stays local-staged and does not run connect/test actions', async () => {
      await navigateToView(page, 'EmailCaddy');
      await page.getByRole('button', { name: 'Set up EmailCaddy account' }).click();
      const setup = page.getByRole('region', { name: 'Email account setup' });

      await expect(setup).toBeVisible();
      await expect(setup).toContainText('will not store passwords or tokens, start OAuth, call provider APIs, sync mail, or send messages');
      await expect(setup).toContainText('Connection test has not run. The current mailbox data remains demo/mock mirrored content.');
      await expect(setup.getByText('Local only')).toBeVisible();
      await expect(setup.getByRole('button', { name: 'Run safe connection test' })).toBeVisible();
      await expect(setup.getByRole('button', { name: 'Save local setup state' })).toBeDisabled();

      for (const { label, setupPath } of [
        { label: 'Gmail / Google', setupPath: 'Google setup path' },
        { label: 'Outlook / Microsoft / Hotmail', setupPath: 'Microsoft setup path' },
        { label: 'Proton', setupPath: 'Proton setup path' },
        { label: 'Generic IMAP / SMTP', setupPath: 'IMAP setup path' },
        { label: 'Local mail bridge / manual proxy', setupPath: 'Bridge setup path' },
      ]) {
        await setup.getByRole('button', { name: label, exact: true }).click();
        await expect(setup).toContainText(setupPath);
        await expect(setup).toContainText('Connection test has not run. The current mailbox data remains demo/mock mirrored content.');
      }

      await expect(setup.getByRole('button', { name: 'Save local setup state' })).toBeDisabled();
      await expect(page.locator('[data-email-account-status="true"]').first()).toContainText('Demo mailbox only');
      await expectNoSuspiciousRequests(suspiciousRequestMonitor.getScopedRequests(), 'EmailCaddy passive setup selection');
    });
  });
});
