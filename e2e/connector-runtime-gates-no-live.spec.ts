import { test, expect, type Locator, type Page, type Request } from '@playwright/test';
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
const SECRET_HEADER_PATTERN =
  /^(?:authorization|proxy-authorization|x-api-key|x-api-token|api-key|apikey|access-token|refresh-token)$/i;
const SECRET_MARKER_PATTERN =
  /(?:api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|id[_-]?token|password|passwd|secret|authorization)\s*[:=]/i;
const SECRET_QUERY_PATTERN =
  /[?&](?:api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|id[_-]?token|password|passwd|secret|authorization)=/i;
const OAUTH_OR_CONNECT_PATH_PATTERN =
  /\/(?:oauth|oauth2|authorize|token|connect|callback)(?:[/?#]|$)/i;
const WEBHOOK_PATH_PATTERN = /\/(?:webhooks?)(?:[/?#]|$)/i;
const LOCAL_BRIDGE_PATH_PATTERN =
  /\/(?:v1\/(?:models|chat\/completions)|api\/tags|health|skills|execute|api\/caddy-agents|api\/email|api\/calendar|imap|smtp)(?:[/?#]|$)/i;
const SAME_ORIGIN_EXECUTION_PATH_PATTERN =
  /\/api\/(?:auth|oauth|connectors?|integrations?|providers?|email|calendar|slack|webhooks?|llm|chat|models|caddy-agents?|agent-hosts?|local-bridge)(?:[/?#]|$)/i;

function providerReason(parsedUrl: URL): string | null {
  const hostname = parsedUrl.hostname.toLowerCase();
  const pathname = parsedUrl.pathname.toLowerCase();

  if (
    hostname === 'accounts.google.com'
    || hostname === 'oauth2.googleapis.com'
    || hostname === 'gmail.googleapis.com'
    || hostname === 'calendar.googleapis.com'
    || hostname === 'generativelanguage.googleapis.com'
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
    hostname === 'api.openai.com'
    || hostname === 'api.anthropic.com'
    || hostname === 'api.groq.com'
    || hostname === 'api.mistral.ai'
    || hostname === 'api.cohere.ai'
    || hostname === 'api.together.xyz'
    || hostname === 'api.perplexity.ai'
    || hostname.endsWith('.openai.azure.com')
  ) {
    return 'llm provider endpoint';
  }

  if (
    /(?:team-?cymru|virustotal|censys|misp|opencti|hybrid-?analysis|any\.run|joesandbox|splunk|sentinel|recorded-?future|flashpoint|discord|mattermost)/i
      .test(hostname)
  ) {
    return 'integration provider endpoint';
  }

  return null;
}

function isViteModuleRequest(parsedUrl: URL, isAppOrigin: boolean): boolean {
  if (!isAppOrigin) return false;

  return (
    parsedUrl.pathname.startsWith('/src/')
    || parsedUrl.pathname.startsWith('/@vite/')
    || parsedUrl.pathname.startsWith('/@fs/')
    || parsedUrl.pathname.startsWith('/node_modules/')
    || /\.(?:ts|tsx|js|jsx|css|map|json|svg|png|jpg|jpeg|webp|ico|woff2?)$/i.test(parsedUrl.pathname)
  );
}

function classifyRequestTarget(input: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string | null;
}): SuspiciousRequest | null {
  const { method, url, headers = {}, body = '' } = input;
  const reasons: string[] = [];

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    reasons.push('unparseable request URL');
    return { method, url, reasons };
  }

  const isHttpRequest = parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  const isAppOrigin = APP_ORIGINS.has(parsedUrl.origin);
  const isLoopback = LOOPBACK_HOSTS.has(parsedUrl.hostname.toLowerCase());
  const isLocalBridgePort = LOCAL_BRIDGE_PORTS.has(parsedUrl.port);
  const requestTarget = `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  const provider = providerReason(parsedUrl);
  const modulePathOnly = isViteModuleRequest(parsedUrl, isAppOrigin);

  if (Object.keys(headers).some((headerName) => SECRET_HEADER_PATTERN.test(headerName))) {
    reasons.push('secret-bearing or authorization header present');
  }
  if (SECRET_QUERY_PATTERN.test(url)) reasons.push('secret-bearing URL parameter');
  if (SECRET_MARKER_PATTERN.test(body ?? '')) reasons.push('secret marker in request body');
  if (provider) reasons.push(provider);

  if (!modulePathOnly && OAUTH_OR_CONNECT_PATH_PATTERN.test(requestTarget)) {
    reasons.push('oauth/connect path');
  }
  if (
    !modulePathOnly
    && (WEBHOOK_PATH_PATTERN.test(requestTarget) || /(?:^|[.-])webhook(?:[.-]|$)/i.test(parsedUrl.hostname))
  ) {
    reasons.push('webhook endpoint');
  }
  if (isLoopback && (isLocalBridgePort || (!modulePathOnly && LOCAL_BRIDGE_PATH_PATTERN.test(requestTarget)))) {
    reasons.push('local bridge or local service probe');
  }
  if (isAppOrigin && !modulePathOnly && SAME_ORIGIN_EXECUTION_PATH_PATTERN.test(requestTarget)) {
    reasons.push('same-origin connector or LLM execution endpoint');
  }
  if (isHttpRequest && !isAppOrigin && !isLoopback) {
    reasons.push('external network request');
  }

  return reasons.length > 0 ? { method, url, reasons } : null;
}

function classifyRequest(request: Request): SuspiciousRequest | null {
  return classifyRequestTarget({
    method: request.method(),
    url: request.url(),
    headers: request.headers(),
    body: request.postData(),
  });
}

function monitorSuspiciousRequests(page: Page): SuspiciousRequestMonitor {
  const appLoadRequests: SuspiciousRequest[] = [];
  const scopedRequests: SuspiciousRequest[] = [];
  let scopedBoundaryReached = false;

  const recordSuspiciousRequest = (suspiciousRequest: SuspiciousRequest | null) => {
    if (!suspiciousRequest) return;

    if (scopedBoundaryReached) {
      scopedRequests.push(suspiciousRequest);
      return;
    }

    appLoadRequests.push(suspiciousRequest);
  };

  page.on('request', (request) => recordSuspiciousRequest(classifyRequest(request)));
  page.on('websocket', (websocket) => recordSuspiciousRequest(classifyRequestTarget({
    method: 'WEBSOCKET',
    url: websocket.url(),
  })));

  return {
    getAppLoadRequests: () => appLoadRequests,
    getScopedRequests: () => scopedRequests,
    markScopedBoundary: () => {
      scopedBoundaryReached = true;
    },
  };
}

async function expectNoSuspiciousRequests(page: Page, suspiciousRequests: SuspiciousRequest[], phase: string) {
  await page.waitForTimeout(250);
  expect(suspiciousRequests, `${phase} made provider/OAuth/local-bridge/Slack/webhook/LLM/secret-bearing requests`).toEqual([]);
}

async function openSettingsTab(page: Page, tabName: 'AI' | 'Integrations') {
  const sidebar = getSidebar(page);
  await sidebar.getByRole('button', { name: /settings/i }).first().click();
  const settingsTablist = page.getByRole('tablist', { name: /settings/i });
  await settingsTablist.getByRole('tab', { name: tabName }).click();
}

async function markScopedBoundaryAfterAppLoad(page: Page, monitor: SuspiciousRequestMonitor) {
  await goToApp(page);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(500);
  monitor.markScopedBoundary();

  const appLoadRequests = monitor.getAppLoadRequests();
  if (appLoadRequests.length > 0) {
    test.info().annotations.push({
      type: 'app-load-telemetry',
      description: JSON.stringify(appLoadRequests),
    });
    console.warn(
      `[connector-runtime-gates-no-live] Suspicious app-load requests before scoped runtime-gate boundary:\n${JSON.stringify(appLoadRequests, null, 2)}`,
    );
  }
}

async function expectVisibleRuntimeDescriptorsAreInert(page: Page) {
  const descriptors = page.locator([
    '[data-runtime-gate-descriptor]',
    '[data-connector-runtime-gate]',
    '[data-connector-action-plan]',
    '[data-executable]',
    '[data-side-effects]',
  ].join(', '));
  const count = await descriptors.count();

  for (let index = 0; index < count; index += 1) {
    const descriptor = descriptors.nth(index);
    if (!await descriptor.isVisible().catch(() => false)) continue;

    await expect(descriptor, 'runtime gate descriptors must not be marked executable').not.toHaveAttribute('data-executable', 'true');
    const sideEffects = await descriptor.getAttribute('data-side-effects');
    if (sideEffects !== null) {
      expect(sideEffects, 'runtime gate descriptor side effects must remain inert').toBe('none');
    }
  }

  const bodyText = await page.locator('body').innerText();
  const runtimeLanguageVisible =
    /(?:runtime gate|execution gate|activation gate|action plan descriptor|test-plan descriptor|route descriptor|disabled descriptor|decision-only|side effects)/i
      .test(bodyText);

  if (!runtimeLanguageVisible) return;

  expect(
    bodyText,
    'visible runtime-gate language must preserve inert/non-executing boundary copy',
  ).toMatch(/(?:executable:\s*false|side effects?:\s*none|decision-only|does not|not connect|no provider|disabled|blocked|gated|no-auto-call|no-auto-post)/i);
}

async function expectProviderActionCardIsInert(providerCard: Locator, label: string) {
  await expect(providerCard, `${label} provider action card should be visible`).toBeVisible();
  await expect(providerCard, `${label} provider action must remain non-executable`).toHaveAttribute(
    'data-provider-action-executable',
    'false',
  );
  await expect(providerCard, `${label} provider action must have no side effects`).toHaveAttribute(
    'data-provider-action-side-effects',
    'none',
  );
}

test.describe('Connector runtime gates no-live browser proof', () => {
  test('keeps setup and runtime-gate descriptors inert during passive inspection', async ({ page }) => {
    const suspiciousRequestMonitor = monitorSuspiciousRequests(page);
    await markScopedBoundaryAfterAppLoad(page, suspiciousRequestMonitor);
    await expectNoSuspiciousRequests(page, suspiciousRequestMonitor.getScopedRequests(), 'post-load runtime-gate baseline');

    await test.step('Settings > AI setup exposes provider runtime boundaries without probing providers or localhost', async () => {
      await openSettingsTab(page, 'AI');
      const aiSetup = page.getByRole('region', { name: 'AssistantCaddy AI setup' });

      await expect(aiSetup).toBeVisible();
      await expect(aiSetup).toContainText('The execution-gate preview below is inert and separate from the explicit Local LLM runtime controls later on this tab.');
      await expect(aiSetup).toContainText('No provider call is made by this setup card');
      await expect(aiSetup).toContainText('Selection stores provider preference only. It does not validate keys or send prompts.');
      await expect(aiSetup).toContainText('No localhost discovery runs automatically');
      await expect(aiSetup).toContainText('No adapter, OAuth flow, credential field, discovery call, or provider request is enabled here.');
      await expect(page.getByRole('button', { name: /Test Connection/i }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /Fetch Models/i }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /Discover Skills/i }).first()).toBeVisible();

      const assistantGate = page.getByRole('region', { name: 'Assistant provider execution gate' });
      await expect(assistantGate).toBeVisible();
      await expect(assistantGate).toContainText('These descriptors do not test providers, list models, send prompts, fetch provider APIs, probe local endpoints, or store API keys.');
      await expect(assistantGate).toContainText('decision-only-no-fetch-no-socket-no-storage-no-llm');
      for (const label of ['Test provider (inert)', 'List models (inert)', 'Send prompt (inert)']) {
        await expect(assistantGate.getByRole('button', { name: label, exact: true })).toBeDisabled();
      }

      await expectVisibleRuntimeDescriptorsAreInert(page);
      await expectNoSuspiciousRequests(page, suspiciousRequestMonitor.getScopedRequests(), 'Settings AI setup inspection');
    });

    await test.step('Settings > Integrations source dashboard keeps activation descriptors catalog-only', async () => {
      await openSettingsTab(page, 'Integrations');
      const catalog = page.getByRole('region', { name: 'Integrations source catalog' });

      await expect(catalog).toBeVisible();
      await expect(catalog).toHaveAttribute('data-integration-catalog-source', 'shared-local-catalog');
      await expect(catalog.getByText('Shared catalog only')).toBeVisible();
      await expect(catalog).toContainText('remain catalog-only until a connector slice adds consent');
      await expect(catalog).toContainText('This view is intentionally passive');
      await expect(catalog).toContainText('does not connect providers, install tools, test credentials, or expose live connector actions');
      await expect(catalog).toContainText('No provider calls on render');

      await expectProviderActionCardIsInert(
        catalog.locator('[data-integration-provider-card="true"]').first(),
        'initial visible integration',
      );

      await page.getByRole('combobox', { name: 'Filter integration source type' }).click();
      await page.getByRole('option', { name: 'Messaging' }).click();
      await expect(page.getByRole('region', { name: 'Messaging integrations' })).toBeVisible();
      const slackCard = catalog.locator('[data-integration-provider-card="true"]').filter({ hasText: 'Slack' }).first();
      await expectProviderActionCardIsInert(slackCard, 'Slack messaging integration');
      await page.getByRole('button', { name: 'Show Slack details' }).click();
      await expect(catalog.getByText(/Template availability does not mean the provider is connected/)).toBeVisible();
      await expect(catalog.getByText(/does not collect credentials, contact providers, run connection tests, or enable live data flow/i)).toBeVisible();

      await expectVisibleRuntimeDescriptorsAreInert(page);
      await expectNoSuspiciousRequests(page, suspiciousRequestMonitor.getScopedRequests(), 'Settings Integrations runtime catalog inspection');
    });

    await test.step('AssistantCaddy setup routes navigate to owners without connector side effects', async () => {
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

      await page.getByRole('region', { name: 'AssistantCaddy setup routes' }).getByRole('button', { name: 'Open source catalog' }).click();
      await expect(page.getByRole('region', { name: 'Integrations source catalog' })).toBeVisible();
      await navigateToView(page, 'AssistantCaddy');

      await page.getByRole('region', { name: 'AssistantCaddy setup routes' }).getByRole('button', { name: 'Open email setup' }).click();
      await expect(page.getByRole('heading', { name: /EmailCaddy/i })).toBeVisible();
      await expect(page.getByText('No real email account is configured. This mailbox is demo/mock mirrored data until a provider or local bridge is staged.')).toBeVisible();

      await expectVisibleRuntimeDescriptorsAreInert(page);
      await expectNoSuspiciousRequests(page, suspiciousRequestMonitor.getScopedRequests(), 'AssistantCaddy setup route inspection');
    });

    await test.step('EmailCaddy setup surface displays future-provider gates without running test, send, OAuth, or bridge actions', async () => {
      await navigateToView(page, 'EmailCaddy');
      await page.getByRole('button', { name: 'Set up EmailCaddy account' }).click();
      const setup = page.getByRole('region', { name: 'Email account setup' });

      await expect(setup).toBeVisible();
      await expect(setup).toContainText('will not store passwords or tokens, start OAuth, call provider APIs, sync mail, or send messages');
      await expect(setup).toContainText('Local setup checklist has not been reviewed. Provider test, live sync, bridge probe, and send remain blocked by the execution gate.');
      await expect(setup.getByText('Local only')).toBeVisible();
      await expect(setup.getByRole('button', { name: 'Review local setup checklist' })).toBeVisible();
      await expect(setup.getByRole('button', { name: 'Save checklist state' })).toBeDisabled();

      const emailExecutionGate = setup.getByRole('region', { name: 'Email provider execution gate' });
      await expect(emailExecutionGate).toBeVisible();
      await expect(emailExecutionGate).toContainText('These decisions come from the local email execution gate');
      await expect(emailExecutionGate).toContainText('Live controls stay disabled or plan-only here');
      await expect(emailExecutionGate).toContainText('No provider fetch, OAuth, sync, send, storage, or bridge probe.');
      for (const label of ['OAuth start', 'Provider connection test', 'Mail sync', 'Provider send']) {
        await expect(emailExecutionGate.getByRole('button', { name: new RegExp(`^${label} action .* by EmailCaddy execution gate$`) })).toBeDisabled();
      }

      for (const label of [
        'Gmail / Google',
        'Outlook / Microsoft / Hotmail',
        'Proton',
        'Generic IMAP / SMTP',
        'Local mail bridge / manual proxy',
      ]) {
        await expect(setup.getByRole('button', { name: label, exact: true })).toBeVisible();
      }

      await expectVisibleRuntimeDescriptorsAreInert(page);
      await expectNoSuspiciousRequests(page, suspiciousRequestMonitor.getScopedRequests(), 'EmailCaddy setup surface passive inspection');
    });
  });
});
