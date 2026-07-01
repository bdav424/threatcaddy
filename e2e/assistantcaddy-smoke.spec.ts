import { test, expect } from '@playwright/test';
import { goToApp, getSidebar } from './fixtures';

test.describe('AssistantCaddy rollout smoke', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
  });

  test('settings, assistant, email, and calendar surfaces are reachable', async ({ page }) => {
    const sidebar = getSidebar(page);

    await sidebar.getByRole('button', { name: /settings/i }).first().click();
    const settingsTablist = page.getByRole('tablist', { name: /settings/i });
    await expect(settingsTablist.getByRole('tab', { name: 'General' })).toBeVisible();
    await expect(settingsTablist.getByRole('tab', { name: 'Appearance' })).toBeVisible();
    await expect(settingsTablist.getByRole('tab', { name: 'AI' })).toBeVisible();
    await expect(settingsTablist.getByRole('tab', { name: 'Agents' })).toBeVisible();

    await settingsTablist.getByRole('tab', { name: 'Appearance' }).click();
    await expect(page.getByText('ThreatCaddy themes', { exact: true })).toBeVisible();
    await expect(page.getByText('Odysseus themes', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');

    await sidebar.getByRole('button', { name: 'AssistantCaddy' }).first().click();
    await expect(page.getByRole('heading', { name: 'AssistantCaddy', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Open EmailCaddy' }).click();
    await expect(page.getByRole('textbox', { name: 'Search EmailCaddy' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Compose/i })).toBeVisible();
    await expect(page.getByRole('separator', { name: 'Resize selected email pane' })).toBeVisible();
    await expect(page.locator('[data-email-selected-message-card="true"]')).toHaveCount(0);
    await expect(page.getByText('Message context', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Context' }).click();
    await expect(page.getByText('Message context', { exact: true })).toBeVisible();

    await sidebar.getByRole('button', { name: 'CalendarCaddy' }).first().click();
    await expect(page.getByRole('heading', { name: /CalendarCaddy/i })).toBeVisible();
    await expect(page.getByText(/Friday, June 5/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Select Friday, June 5, 2026/i })).toBeVisible();

    const nestedInteractiveCells = await page.locator('[data-calendar-month-cell][role="button"], [data-calendar-week-cell][role="button"]').count();
    expect(nestedInteractiveCells).toBe(0);
  });

  test('settings exposes ambient controls and AssistantCaddy AI setup without preflight network', async ({ page }) => {
    const sidebar = getSidebar(page);
    const unexpectedRequests: string[] = [];
    const providerProbePattern = /\/(?:api\/tags|models|health|chat\/completions)(?:[/?#]|$)|oauth|imap|smtp/i;
    const secretPattern = /(?:api[_-]?key|token|secret|password|authorization)=/i;
    page.on('request', (request) => {
      const url = request.url();
      const postData = request.postData() ?? '';
      const authorization = request.headers().authorization;
      if (providerProbePattern.test(url) || secretPattern.test(url) || secretPattern.test(postData) || authorization) {
        unexpectedRequests.push(url);
        return;
      }
      if (
        url.startsWith('http://127.0.0.1:')
        || url.startsWith('http://localhost:')
        || url.startsWith('data:')
        || url.startsWith('blob:')
      ) {
        return;
      }
      unexpectedRequests.push(url);
    });

    await sidebar.getByRole('button', { name: /settings/i }).first().click();
    const settingsTablist = page.getByRole('tablist', { name: /settings/i });

    await settingsTablist.getByRole('tab', { name: 'Appearance' }).click();
    await expect(page.getByText('Background animation')).toBeVisible();
    await expect(page.getByRole('button', { name: /Sparkles/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Use theme color' })).toBeVisible();
    await expect(page.getByLabel('Background effect hue')).toBeVisible();
    await expect(page.getByLabel('Background effect intensity')).toBeVisible();

    await settingsTablist.getByRole('tab', { name: 'AI' }).click();
    const aiSetup = page.getByRole('region', { name: 'AssistantCaddy AI setup' });
    await expect(aiSetup).toBeVisible();
    await expect(aiSetup.getByText('Existing CaddyAI route', { exact: true })).toBeVisible();
    await expect(aiSetup.getByText('OpenAI-compatible API', { exact: true })).toBeVisible();
    await expect(aiSetup.getByText('Local Ollama / localhost', { exact: true })).toBeVisible();
    await expect(aiSetup.getByText('Generic adapter placeholder', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Email provider onboarding' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Use OpenAI-compatible API' }).click();
    await page.getByRole('button', { name: 'Use local Ollama / localhost' }).click();
    await expect(aiSetup.getByText(/Provider checks stay explicit/i)).toBeVisible();
    await aiSetup.getByRole('button', { name: 'Open Integrations' }).first().click();
    await expect(page.getByRole('region', { name: 'Integrations source catalog' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Email integrations' })).toBeVisible();
    await expect(page.getByText('Generic IMAP / SMTP')).toBeVisible();
    expect(unexpectedRequests).toEqual([]);
  });

  test('keeps compact EmailCaddy workspace panel topbar controls visible without overlap', async ({ page }) => {
    const sidebar = getSidebar(page);

    await sidebar.getByRole('button', { name: 'AssistantCaddy' }).first().click();
    await page.getByRole('button', { name: 'Open EmailCaddy' }).click();
    await expect(page.getByRole('heading', { name: /EmailCaddy/i })).toBeVisible();
    await page.getByRole('button', { name: 'Context' }).click();
    await page.getByRole('button', { name: 'Pop out message context' }).click();
    const emailPanel = page.getByRole('dialog', { name: 'EmailCaddy message context panel' });
    await expect(emailPanel).toBeVisible();
    await emailPanel.evaluate((panel) => {
      (panel as HTMLElement).style.width = '320px';
      (panel as HTMLElement).style.height = '260px';
    });

    const titlebar = emailPanel.locator('[data-workspace-panel-header="true"]');
    await expect(titlebar).toBeVisible();
    await expect(emailPanel.getByRole('button', { name: 'Dock message context back into UI' })).toBeVisible();
    await expect(emailPanel.getByRole('button', { name: 'Minimize message context' })).toBeVisible();

    const boxes = await titlebar.locator('button:visible').evaluateAll((buttons) => buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    }).sort((a, b) => a.top - b.top || a.left - b.left));
    expect(boxes.length).toBeGreaterThanOrEqual(2);
    for (const box of boxes) {
      expect(box.width).toBeGreaterThanOrEqual(24);
      expect(box.height).toBeGreaterThanOrEqual(24);
    }
    for (let outer = 0; outer < boxes.length; outer += 1) {
      const first = boxes[outer];
      if (!first) continue;
      for (const second of boxes.slice(outer + 1)) {
        const verticallyOverlaps = first.bottom > second.top && second.bottom > first.top;
        const horizontallyOverlaps = first.right > second.left && second.right > first.left;
        expect(verticallyOverlaps && horizontallyOverlaps).toBe(false);
      }
    }
  });

  test('keeps AssistantCaddy workspace panels visible across non-Assistant navigation', async ({ page }) => {
    const sidebar = getSidebar(page);

    await sidebar.getByRole('button', { name: 'AssistantCaddy' }).first().click();
    await page.getByRole('button', { name: 'Open EmailCaddy' }).click();

    await page.getByRole('button', { name: 'Context' }).click();
    await page.getByRole('button', { name: 'Pop out message context' }).click();
    const panel = page.getByRole('dialog', { name: 'EmailCaddy message context panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');

    await sidebar.getByRole('button', { name: 'Dashboard' }).first().click();
    await expect(page.getByRole('heading', { name: 'Quick Links' })).toBeVisible();
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');

    await page.getByRole('button', { name: 'Minimize message context' }).click();
    await expect(page.getByRole('region', { name: 'Workspace panel dock' })).toBeVisible();
    await expect(page.locator('[data-workspace-panel-dock-chip="emailcaddy-message-context"]')).toBeVisible();

    await page.getByRole('button', { name: 'Restore message context panel from workspace dock' }).click();
    await expect(page.getByRole('heading', { name: 'Quick Links' })).toBeVisible();
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
  });

  test('lets the AssistantCaddy overview become a workspace-owned panel without agent side effects', async ({ page }) => {
    const sidebar = getSidebar(page);

    await sidebar.getByRole('button', { name: 'AssistantCaddy' }).first().click();
    await expect(page.getByRole('heading', { name: 'AssistantCaddy', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Pop out AssistantCaddy' }).click();
    const panel = page.getByRole('dialog', { name: 'AssistantCaddy panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByRole('button', { name: 'Open EmailCaddy' })).toBeVisible();
    await expect(page.locator('[data-workspace-panel="chat-workspace"]')).toHaveCount(0);
    await expect(page.locator('[data-workspace-panel="agentcaddy-workspace"]')).toHaveCount(0);

    await sidebar.getByRole('button', { name: 'Dashboard' }).first().click();
    await expect(page.getByRole('heading', { name: 'Quick Links' })).toBeVisible();
    await expect(panel).toBeHidden();

    await sidebar.getByRole('button', { name: 'Workspace' }).first().click();
    await expect(page.getByRole('region', { name: 'Workspace' })).toBeVisible();
    await expect(panel).toBeVisible();

    await panel.getByRole('button', { name: 'Minimize AssistantCaddy' }).click();
    await expect(page.locator('[data-workspace-panel-dock-chip="assistantcaddy-workspace"]')).toBeVisible();

    await page.getByRole('button', { name: 'Restore assistantcaddy panel from workspace dock' }).click();
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
  });
});
