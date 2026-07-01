import { test, expect, type Locator, type Page } from '@playwright/test';
import { createInvestigation, createQuickNote, goToApp, navigateToView, openNewTaskForm } from './fixtures';

async function shrinkPanelToMinimum(page: Page, panel: Locator, panelName: string) {
  const resizeHandle = panel.getByRole('button', { name: `Resize ${panelName} from bottom right` });
  const handleBox = await resizeHandle.boundingBox();
  expect(handleBox).not.toBeNull();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x - 900, handleBox!.y - 700, { steps: 10 });
  await page.mouse.up();

  await expect(panel).toHaveAttribute('data-panel-compact', 'true');
  const minimums = await panel.evaluate((element) => ({
    width: Number(element.getAttribute('data-workspace-panel-min-width')),
    height: Number(element.getAttribute('data-workspace-panel-min-height')),
  }));
  const panelBox = await panel.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.width).toBeGreaterThanOrEqual(minimums.width - 1);
  expect(panelBox!.height).toBeGreaterThanOrEqual(minimums.height - 1);
  expect(panelBox!.width).toBeLessThanOrEqual(minimums.width + 2);
  expect(panelBox!.height).toBeLessThanOrEqual(minimums.height + 2);
}

async function expectHeaderControlsDoNotOverlap(panel: Locator) {
  const issues = await panel.locator('[data-workspace-panel-header="true"]').evaluate((header) => {
    const visibleControlRects = Array.from(header.querySelectorAll<HTMLElement>('button,[role="button"]'))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== 'hidden'
          && style.display !== 'none'
          && rect.width > 0
          && rect.height > 0;
      })
      .map((element) => ({
        label: element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName,
        rect: element.getBoundingClientRect(),
      }));
    const headerRect = header.getBoundingClientRect();
    const failures: string[] = [];

    for (const control of visibleControlRects) {
      if (
        control.rect.left < headerRect.left - 1
        || control.rect.right > headerRect.right + 1
        || control.rect.top < headerRect.top - 1
        || control.rect.bottom > headerRect.bottom + 1
      ) {
        failures.push(`${control.label} extends outside header`);
      }
    }

    for (let i = 0; i < visibleControlRects.length; i += 1) {
      for (let j = i + 1; j < visibleControlRects.length; j += 1) {
        const a = visibleControlRects[i].rect;
        const b = visibleControlRects[j].rect;
        const overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        if (overlapX > 1 && overlapY > 1) {
          failures.push(`${visibleControlRects[i].label} overlaps ${visibleControlRects[j].label}`);
        }
      }
    }

    return failures;
  });

  expect(issues).toEqual([]);
}

async function dragSidebarItemIntoWorkspace(page: Page, label: string, clientX = 650, clientY = 260) {
  const workspace = page.getByRole('region', { name: 'Workspace', exact: true });
  await expect(workspace).toBeVisible();
  const transfer = await page.evaluateHandle('new DataTransfer()');
  const navItem = page.locator('nav[aria-label="Views"] [role="button"]').filter({ hasText: label }).first();
  await expect(navItem).toHaveAttribute('title', `${label}: drag into Workspace`);
  await navItem.dispatchEvent('dragstart', { dataTransfer: transfer });
  await workspace.dispatchEvent('dragover', { dataTransfer: transfer, clientX, clientY });
  await expect(workspace).toHaveAttribute('data-workspace-drop-state', 'valid');
  await workspace.dispatchEvent('drop', { dataTransfer: transfer, clientX, clientY });
  await transfer.dispose();
}

async function openSidebarItemInWorkspace(page: Page, label: string, panelName: string) {
  await navigateToView(page, 'Workspace');
  await dragSidebarItemIntoWorkspace(page, label);
  const panel = page.getByRole('dialog', { name: panelName });
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
  return panel;
}

async function dragAssistantSurfaceToWorkspaceNav(page: Page, sourceSelector: string) {
  const transfer = await page.evaluateHandle('new DataTransfer()');
  const source = page.locator(sourceSelector).first();
  await expect(source).toBeVisible();
  await source.dispatchEvent('dragstart', { dataTransfer: transfer });
  const workspaceNav = page.locator('nav[aria-label="Views"] [role="button"][aria-label="Workspace"]').first();
  await workspaceNav.dispatchEvent('dragover', { dataTransfer: transfer });
  await workspaceNav.dispatchEvent('drop', { dataTransfer: transfer });
  await transfer.dispose();
}

async function expectPanelHidesOnNotesRouteAndReturnsToWorkspace(page: Page, panel: Locator) {
  await navigateToView(page, 'Notes');
  await expect(page.getByRole('button', { name: 'Create blank note' })).toBeVisible();
  await expect(panel).toBeHidden();

  await navigateToView(page, 'Workspace');
  await expect(page.getByRole('region', { name: 'Workspace' })).toBeVisible();
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
}

async function restoreMinimizedPanelFromInlineRollup(page: Page, restoreLabel: string) {
  await expect(page.getByRole('region', { name: 'Workspace panel dock' })).toHaveCount(0);
  const restoreButton = page.getByRole('button', { name: restoreLabel });
  await expect(restoreButton).toBeVisible();
  await restoreButton.click();
}

test.describe('Workspace panel rollout smoke', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
  });

  test('keeps the Dashboard workspace panel isolated from non-Workspace navigation', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Quick Links' })).toBeVisible();

    await page.getByRole('button', { name: 'Pop out Dashboard' }).click();
    const panel = page.getByRole('dialog', { name: 'Dashboard panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByRole('heading', { name: 'Quick Links' })).toBeVisible();

    await navigateToView(page, 'Workspace');
    await expect(page.getByRole('region', { name: 'Workspace' })).toBeVisible();
    await expect(page.locator('[data-app-workspace-pane="active"]')).toHaveCount(1);
    await expect(page.locator('[data-assistantcaddy-shell-pane="active"]')).toHaveCount(0);
    await expect(page.locator('[data-workspace-panel="chat-workspace"]')).toHaveCount(0);
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');

    await panel.getByRole('button', { name: 'Minimize Dashboard' }).click();
    await restoreMinimizedPanelFromInlineRollup(page, 'Restore Dashboard panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByRole('heading', { name: 'Quick Links' })).toBeVisible();

    await expectPanelHidesOnNotesRouteAndReturnsToWorkspace(page, panel);

    await panel.getByRole('button', { name: 'Minimize Dashboard' }).click();
    await restoreMinimizedPanelFromInlineRollup(page, 'Restore Dashboard panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByRole('heading', { name: 'Quick Links' })).toBeVisible();
  });

  test('hides Workspace-owned floating panels on non-Workspace routes', async ({ page }) => {
    await createInvestigation(page, 'Workspace Panel Route Isolation Case');
    await navigateToView(page, 'Workspace');
    await dragSidebarItemIntoWorkspace(page, 'Notes', 650, 240);

    const notesPanel = page.locator('[data-workspace-panel="notes-workspace"][data-workspace-panel-state="floating"]');
    await expect(notesPanel).toBeVisible();

    await navigateToView(page, 'Timeline');
    await expect(page.getByRole('button', { name: 'Pop out Timeline' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Timeline panel' })).toHaveCount(0);
    await expect(notesPanel).toBeHidden();

    await navigateToView(page, 'Workspace');
    await expect(notesPanel).toBeVisible();
  });

  test('shows unclipped adjacent resize indicators on floating panel edges', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Quick Links' })).toBeVisible();

    await page.getByRole('button', { name: 'Pop out Dashboard' }).click();
    const panel = page.getByRole('dialog', { name: 'Dashboard panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');

    const rightHandle = panel.getByRole('button', { name: 'Resize Dashboard panel from right' });
    const rightHandleBox = await rightHandle.boundingBox();
    expect(rightHandleBox?.width ?? 0).toBeGreaterThanOrEqual(18);
    await rightHandle.hover();
    await expect(panel).toHaveAttribute('data-workspace-panel-active-resize', 'right');
    await expect(panel.locator('[data-resize-indicator="right"]')).toBeVisible();
    await expect(panel).toHaveCSS('overflow', 'visible');
    await expect.poll(async () => {
      return page.evaluate(`(() => {
        const panelElement = document.querySelector('[role="dialog"][aria-label="Dashboard panel"]');
        const indicator = document.querySelector('[data-resize-indicator="right"]');
        if (!panelElement || !indicator) return false;
        const gap = indicator.getBoundingClientRect().left - panelElement.getBoundingClientRect().right;
        return gap > 0 && gap <= 5;
      })()`);
    }).toBe(true);
    await expect.poll(async () => {
      return page.evaluate(`(() => {
        const panelElement = document.querySelector('[role="dialog"][aria-label="Dashboard panel"]');
        const indicator = document.querySelector('[data-resize-indicator="right"]');
        if (!panelElement || !indicator) return false;
        const panelRect = panelElement.getBoundingClientRect();
        const indicatorRect = indicator.getBoundingClientRect();
        const indicatorStyle = window.getComputedStyle(indicator);
        const gap = indicatorRect.left - panelRect.right;
        return (
          indicatorRect.width >= 3
          && gap > 0
          && gap <= 5
          && indicatorStyle.backgroundColor !== 'transparent'
          && indicatorStyle.backgroundColor !== 'rgba(0, 0, 0, 0)'
        );
      })()`);
    }).toBe(true);

    const cornerHandle = panel.getByRole('button', { name: 'Resize Dashboard panel from top left' });
    const cornerHandleBox = await cornerHandle.boundingBox();
    expect(cornerHandleBox?.width ?? 0).toBeGreaterThanOrEqual(30);
    expect(cornerHandleBox?.height ?? 0).toBeGreaterThanOrEqual(30);
    await cornerHandle.hover();
    await expect(panel).toHaveAttribute('data-workspace-panel-active-resize', 'top-left');
    await expect(panel.locator('[data-resize-indicator="top-left"]')).toBeVisible();
    await expect.poll(async () => {
      return page.evaluate(`(() => {
        const panelElement = document.querySelector('[role="dialog"][aria-label="Dashboard panel"]');
        const indicator = document.querySelector('[data-resize-indicator="top-left"]');
        if (!panelElement || !indicator) return false;
        const panelRect = panelElement.getBoundingClientRect();
        const indicatorRect = indicator.getBoundingClientRect();
        return indicatorRect.left < panelRect.left && indicatorRect.top < panelRect.top;
      })()`);
    }).toBe(true);
    await expect.poll(async () => {
      return page.evaluate(`(() => {
        const panelElement = document.querySelector('[role="dialog"][aria-label="Dashboard panel"]');
        const indicator = document.querySelector('[data-resize-indicator="top-left"]');
        if (!panelElement || !indicator) return false;
        const panelRect = panelElement.getBoundingClientRect();
        const indicatorRect = indicator.getBoundingClientRect();
        const indicatorStyle = window.getComputedStyle(indicator);
        const borderLeftWidth = Number.parseFloat(indicatorStyle.borderLeftWidth);
        const borderTopWidth = Number.parseFloat(indicatorStyle.borderTopWidth);
        const leftGap = panelRect.left - (indicatorRect.left + borderLeftWidth);
        const topGap = panelRect.top - (indicatorRect.top + borderTopWidth);
        return (
          borderLeftWidth >= 3
          && borderTopWidth >= 3
          && leftGap > 0
          && leftGap <= 6
          && topGap > 0
          && topGap <= 6
          && indicatorStyle.borderLeftColor !== 'transparent'
          && indicatorStyle.borderLeftColor !== 'rgba(0, 0, 0, 0)'
        );
      })()`);
    }).toBe(true);
  });

  test('renders edge-snapped panels as docked mosaic tiles while keeping resize and restore controls', async ({ page }) => {
    await page.setViewportSize({ width: 2200, height: 1500 });
    await goToApp(page);
    await expect(page.getByRole('heading', { name: 'Quick Links' })).toBeVisible();

    await page.getByRole('button', { name: 'Pop out Dashboard' }).click();
    const panel = page.getByRole('dialog', { name: 'Dashboard panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel).toHaveAttribute('data-workspace-panel-chrome', 'floating');

    const header = panel.locator('[data-workspace-panel-header="true"]');
    const headerBox = await header.boundingBox();
    if (!headerBox) throw new Error('Dashboard panel header was not measurable for snap drag.');

    await page.mouse.move(headerBox.x + 16, headerBox.y + headerBox.height / 2);
    await page.mouse.down();
    const rightSnapTarget = await workspaceGridTarget(page, { insetX: 4, insetY: 0.5 });
    await page.mouse.move(rightSnapTarget.x, rightSnapTarget.y, { steps: 12 });
    await expect(page.locator('[data-workspace-snap-preview="right"]')).toBeVisible();
    await page.mouse.up();

    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel).toHaveAttribute('data-workspace-panel-chrome', 'snapped');
    await expect(panel).toHaveAttribute('data-workspace-panel-snap-zone', 'right');
    const snappedZIndex = Number(await panel.getAttribute('data-workspace-panel-z-index'));
    await expect(page.locator('[data-workspace-panel="dashboard-workspace"][data-workspace-panel-state="floating-source"]')).toHaveAttribute('data-workspace-panel-source-hidden', 'true');
    await expect(panel.getByRole('button', { name: 'Resize Dashboard panel from bottom right' })).toBeVisible();
    await expect.poll(async () => {
      return page.evaluate(`(() => {
        const panelElement = document.querySelector('[role="dialog"][aria-label="Dashboard panel"]');
        if (!panelElement) return false;
        const style = window.getComputedStyle(panelElement);
        return Number.parseFloat(style.borderTopLeftRadius) <= 8 && !style.boxShadow.includes('24px') && !style.boxShadow.includes('36px');
      })()`);
    }).toBe(true);

    await navigateToView(page, 'Workspace');
    await dragSidebarItemIntoWorkspace(page, 'Tasks');
    const tasksPanel = page.getByRole('dialog', { name: 'Tasks panel' });
    await expect(tasksPanel).toBeVisible();
    await expect(tasksPanel).toHaveAttribute('data-workspace-panel-chrome', 'floating');
    await expect(tasksPanel).toHaveAttribute('data-workspace-snap-grid-options', /2x1/);
    await expectTitlebarControlsInsideHeader(tasksPanel);
    const tasksZIndex = Number(await tasksPanel.getAttribute('data-workspace-panel-z-index'));
    expect(tasksZIndex).toBeGreaterThan(snappedZIndex);

    const tasksHeader = tasksPanel.locator('[data-workspace-panel-header="true"]');
    const tasksHeaderBox = await tasksHeader.boundingBox();
    if (!tasksHeaderBox) throw new Error('Tasks panel header was not measurable for occupied snap drag.');

    await page.mouse.move(tasksHeaderBox.x + 16, tasksHeaderBox.y + tasksHeaderBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(rightSnapTarget.x, rightSnapTarget.y, { steps: 12 });
    await expect(page.locator('[data-workspace-snap-preview="right"]')).toHaveCount(0);
    await page.mouse.up();
    await expect(tasksPanel).toHaveAttribute('data-workspace-panel-chrome', 'floating');
    await expect(tasksPanel).not.toHaveAttribute('data-workspace-panel-snap-zone', /.+/);

    await panel.getByRole('button', { name: 'Minimize Dashboard' }).click();
    const minimizedDashboard = page.locator('[data-workspace-panel="dashboard-workspace"][data-workspace-panel-state="minimized"]');
    await expect(minimizedDashboard).toBeVisible();
    await expect(page.locator('[data-workspace-panel-dock-chip="dashboard-workspace"]')).toHaveCount(0);
    await minimizedDashboard.getByRole('button', { name: 'Restore Dashboard panel' }).click();
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-chrome', 'snapped');
    await expect(panel).toHaveAttribute('data-workspace-panel-snap-zone', 'right');
  });

  test('renders minimized workspace panels as compact inline rollups without bottom dock chips', async ({ page }) => {
    const dashboardPanel = await openSidebarItemInWorkspace(page, 'Dashboard', 'Dashboard panel');

    await dashboardPanel.getByRole('button', { name: 'Minimize Dashboard' }).click();
    const minimizedDashboard = page.locator('[data-workspace-panel="dashboard-workspace"][data-workspace-panel-state="minimized"]');
    await expect(minimizedDashboard).toBeVisible();
    await expect(minimizedDashboard).toHaveAttribute('data-workspace-panel-rollup', 'true');
    await expect(page.locator('[data-workspace-panel-dock-chip="dashboard-workspace"]')).toHaveCount(0);

    const tasksPanel = await openSidebarItemInWorkspace(page, 'Tasks', 'Tasks panel');
    await tasksPanel.getByRole('button', { name: 'Minimize Tasks' }).click();
    const minimizedTasks = page.locator('[data-workspace-panel="tasks-workspace"][data-workspace-panel-state="minimized"]');
    await expect(minimizedTasks).toBeVisible();
    await expect(minimizedTasks).toHaveAttribute('data-workspace-panel-rollup', 'true');
    await expect(page.locator('[data-workspace-panel-dock-chip="tasks-workspace"]')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Workspace panel dock' })).toHaveCount(0);

    await minimizedDashboard.getByRole('button', { name: 'Restore Dashboard panel' }).click();
    await expect(page.getByRole('dialog', { name: 'Dashboard panel' })).toBeVisible();
    await minimizedTasks.getByRole('button', { name: 'Restore Tasks panel' }).click();
    await expect(page.getByRole('dialog', { name: 'Tasks panel' })).toBeVisible();
  });

  test('closes Notes and Tasks workspace panels without dock/source placeholders and reopens normal routes', async ({ page }) => {
    const checks = [
      {
        label: 'Notes',
        panelName: 'Notes panel',
        closeLabel: 'Close Notes workspace panel',
        minimizeLabel: 'Minimize Notes',
        panelId: 'notes-workspace',
        restoreLabel: 'Restore Notes panel',
        routeCheck: () => page.getByRole('button', { name: 'Create blank note' }),
      },
      {
        label: 'Tasks',
        panelName: 'Tasks panel',
        closeLabel: 'Close Tasks workspace panel',
        minimizeLabel: 'Minimize Tasks',
        panelId: 'tasks-workspace',
        restoreLabel: 'Restore Tasks panel',
        routeCheck: () => page.getByRole('button', { name: 'New task' }),
      },
    ];

    for (const check of checks) {
      const panel = await openSidebarItemInWorkspace(page, check.label, check.panelName);
      await panel.getByRole('button', { name: check.closeLabel }).click();
      await expect(page.getByRole('dialog', { name: check.panelName })).toHaveCount(0);
      await expect(page.locator(`[data-workspace-panel="${check.panelId}"][data-workspace-panel-state="floating-source"]`)).toHaveCount(0);
      await expect(page.locator(`[data-workspace-panel-dock-chip="${check.panelId}"]`)).toHaveCount(0);
      await navigateToView(page, check.label as 'Notes' | 'Tasks');
      await expect(check.routeCheck()).toBeVisible();
      await expect(page.getByRole('dialog', { name: check.panelName })).toHaveCount(0);

      await navigateToView(page, 'Workspace');
      const minimizedPanel = await openSidebarItemInWorkspace(page, check.label, check.panelName);
      await minimizedPanel.getByRole('button', { name: check.minimizeLabel }).click();
      const minimizedRollup = page.locator(`[data-workspace-panel="${check.panelId}"][data-workspace-panel-state="minimized"]`);
      await expect(minimizedRollup).toBeVisible();
      await expect(minimizedRollup).toHaveAttribute('data-workspace-panel-rollup', 'true');
      await expect(page.locator(`[data-workspace-panel-dock-chip="${check.panelId}"]`)).toHaveCount(0);
      await minimizedRollup.getByRole('button', { name: check.restoreLabel }).click();
      await expect(page.getByRole('dialog', { name: check.panelName })).toBeVisible();
      await page.getByRole('dialog', { name: check.panelName }).getByRole('button', { name: check.closeLabel }).click();
    }
  });

  test('closes EmailCaddy and CalendarCaddy workspace panels without dock/source placeholders and reopens normal routes', async ({ page }) => {
    const checks = [
      {
        label: 'EmailCaddy',
        panelName: 'EmailCaddy panel',
        closeLabel: 'Close EmailCaddy workspace panel',
        minimizeLabel: 'Minimize EmailCaddy',
        panelId: 'emailcaddy-workspace',
        restoreLabel: 'Restore EmailCaddy panel',
        routeCheck: () => page.getByRole('button', { name: 'Compose' }),
      },
      {
        label: 'CalendarCaddy',
        panelName: 'CalendarCaddy panel',
        closeLabel: 'Close CalendarCaddy workspace panel',
        minimizeLabel: 'Minimize CalendarCaddy',
        panelId: 'calendarcaddy-workspace',
        restoreLabel: 'Restore CalendarCaddy panel',
        routeCheck: () => page.getByRole('button', { name: 'New event' }),
      },
    ];

    for (const check of checks) {
      const panel = await openSidebarItemInWorkspace(page, check.label, check.panelName);
      await panel.getByRole('button', { name: check.closeLabel }).click();
      await expect(page.getByRole('dialog', { name: check.panelName })).toHaveCount(0);
      await expect(page.locator(`[data-workspace-panel="${check.panelId}"][data-workspace-panel-state="floating-source"]`)).toHaveCount(0);
      await expect(page.locator(`[data-workspace-panel-dock-chip="${check.panelId}"]`)).toHaveCount(0);

      await page.locator(`nav[aria-label="Views"] [role="button"][aria-label="${check.label}"]`).first().click();
      await expect(check.routeCheck()).toBeVisible();
      await expect(page.getByRole('dialog', { name: check.panelName })).toHaveCount(0);

      await navigateToView(page, 'Workspace');
      const minimizedPanel = await openSidebarItemInWorkspace(page, check.label, check.panelName);
      await minimizedPanel.getByRole('button', { name: check.minimizeLabel }).click();
      const minimizedRollup = page.locator(`[data-workspace-panel="${check.panelId}"][data-workspace-panel-state="minimized"]`);
      await expect(minimizedRollup).toBeVisible();
      await expect(minimizedRollup).toHaveAttribute('data-workspace-panel-rollup', 'true');
      await expect(page.locator(`[data-workspace-panel-dock-chip="${check.panelId}"]`)).toHaveCount(0);
      await minimizedRollup.getByRole('button', { name: check.restoreLabel }).click();
      await expect(page.getByRole('dialog', { name: check.panelName })).toBeVisible();
      await page.getByRole('dialog', { name: check.panelName }).getByRole('button', { name: check.closeLabel }).click();
    }
  });

  test('recovers a floating panel header to the reachable top edge', async ({ page }) => {
    const panel = await openSidebarItemInWorkspace(page, 'Dashboard', 'Dashboard panel');
    const header = panel.locator('[data-workspace-panel-header="true"]');
    const headerBox = await header.boundingBox();
    if (!headerBox) throw new Error('Dashboard panel header was not measurable for top-clamp drag.');

    await page.mouse.move(headerBox.x + 28, headerBox.y + headerBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(headerBox.x + 28, -240, { steps: 14 });
    await page.mouse.up();

    const reachableTop = await page.locator('[data-tour="header"]').evaluate((element) => {
      return element.getBoundingClientRect().bottom + 8;
    });
    await expect.poll(async () => {
      const nextHeaderBox = await header.boundingBox();
      return nextHeaderBox?.y ?? -1;
    }).toBeGreaterThanOrEqual(reachableTop - 1);
  });

  test('raises the last clicked floating popout above earlier floating panels', async ({ page }) => {
    const dashboardPanel = await openSidebarItemInWorkspace(page, 'Dashboard', 'Dashboard panel');
    const tasksPanel = await openSidebarItemInWorkspace(page, 'Tasks', 'Tasks panel');

    const dashboardInitialZ = Number(await dashboardPanel.getAttribute('data-workspace-panel-z-index'));
    const tasksInitialZ = Number(await tasksPanel.getAttribute('data-workspace-panel-z-index'));
    expect(tasksInitialZ).toBeGreaterThan(dashboardInitialZ);

    const dashboardHeader = dashboardPanel.locator('[data-workspace-panel-header="true"]');
    const dashboardHeaderBox = await dashboardHeader.boundingBox();
    if (!dashboardHeaderBox) throw new Error('Dashboard panel header was not measurable for focus click.');
    await page.mouse.click(dashboardHeaderBox.x + 28, dashboardHeaderBox.y + dashboardHeaderBox.height / 2);

    await expect.poll(async () => Number(await dashboardPanel.getAttribute('data-workspace-panel-z-index'))).toBeGreaterThan(tasksInitialZ);
  });

  test('raises clicked Notes, Tasks, EmailCaddy, and CalendarCaddy workspace panels to front', async ({ page }) => {
    const notesPanel = await openSidebarItemInWorkspace(page, 'Notes', 'Notes panel');
    const tasksPanel = await openSidebarItemInWorkspace(page, 'Tasks', 'Tasks panel');
    const tasksInitialZ = Number(await tasksPanel.getAttribute('data-workspace-panel-z-index'));

    const notesHeader = notesPanel.locator('[data-workspace-panel-header="true"]');
    const notesHeaderBox = await notesHeader.boundingBox();
    if (!notesHeaderBox) throw new Error('Notes panel header was not measurable for focus click.');
    await page.mouse.click(notesHeaderBox.x + 28, notesHeaderBox.y + notesHeaderBox.height / 2);
    await expect.poll(async () => Number(await notesPanel.getAttribute('data-workspace-panel-z-index'))).toBeGreaterThan(tasksInitialZ);

    await notesPanel.getByRole('button', { name: 'Close Notes workspace panel' }).click();
    await tasksPanel.getByRole('button', { name: 'Close Tasks workspace panel' }).click();

    const emailPanel = await openSidebarItemInWorkspace(page, 'EmailCaddy', 'EmailCaddy panel');
    const calendarPanel = await openSidebarItemInWorkspace(page, 'CalendarCaddy', 'CalendarCaddy panel');
    const calendarInitialZ = Number(await calendarPanel.getAttribute('data-workspace-panel-z-index'));

    const emailBox = await emailPanel.boundingBox();
    const calendarBox = await calendarPanel.boundingBox();
    if (!emailBox || !calendarBox) throw new Error('EmailCaddy and CalendarCaddy panels were not measurable for focus click.');
    const visibleEmailX = Math.min(emailBox.x + emailBox.width - 18, calendarBox.x + calendarBox.width + 24);
    await page.mouse.click(visibleEmailX, emailBox.y + emailBox.height / 2);
    await expect.poll(async () => Number(await emailPanel.getAttribute('data-workspace-panel-z-index'))).toBeGreaterThan(calendarInitialZ);
  });

  test('exposes responsive workspace grid cells at small viewport', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await navigateToView(page, 'Workspace');
    await dragSidebarItemIntoWorkspace(page, 'Tasks');
    const smallTasksPanel = page.getByRole('dialog', { name: 'Tasks panel' });
    await expect(smallTasksPanel).toBeVisible();
    const smallOptions = await workspaceGridOptions(smallTasksPanel);
    expect(smallOptions).toContain('1x1');
    expect(smallOptions).not.toContain('3x2');
    expect(smallOptions).not.toContain('4x4');
    await expectTitlebarControlsInsideHeader(smallTasksPanel);
  });

  test('exposes responsive workspace grid cells at large viewport and blocks reserved occupied cells', async ({ page }) => {
    await page.setViewportSize({ width: 2200, height: 1500 });
    await navigateToView(page, 'Workspace');
    await dragSidebarItemIntoWorkspace(page, 'Notes');
    const notesPanel = page.getByRole('dialog', { name: 'Notes panel' });
    await expect(notesPanel).toBeVisible();
    const largeOptions = await workspaceGridOptions(notesPanel);
    expect(largeOptions).toEqual(expect.arrayContaining(['3x2', '3x3', '4x2', '4x1', '4x4']));
    await expectTitlebarControlsInsideHeader(notesPanel);

    const gridTarget = await workspaceGridTarget(page, { insetX: 100, insetY: 0.5 });
    const notesHeaderBox = await notesPanel.locator('[data-workspace-panel-header="true"]').boundingBox();
    if (!notesHeaderBox) throw new Error('Notes panel header was not measurable for smart grid drag.');
    await page.mouse.move(notesHeaderBox.x + 16, notesHeaderBox.y + notesHeaderBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(gridTarget.x, gridTarget.y, { steps: 12 });
    await expect(page.locator('[data-workspace-snap-preview]').first()).toBeVisible();
    await page.mouse.up();

    await expect(notesPanel).toHaveAttribute('data-workspace-panel-chrome', 'snapped');
    const occupiedGridCell = await notesPanel.getAttribute('data-workspace-panel-grid-cell');
    expect(occupiedGridCell).toMatch(/^(3x2|3x3|4x1|4x2|4x4):\d+,\d+$/);
    const [occupiedGrid, occupiedCell] = occupiedGridCell!.split(':');
    await expect(notesPanel).toHaveAttribute('data-workspace-panel-snap-grid', occupiedGrid);
    await expect(notesPanel).toHaveAttribute('data-workspace-panel-grid-span', '1x1');

    await notesPanel.getByRole('button', { name: 'Minimize Notes' }).click();
    const minimizedNotes = page.locator('[data-workspace-panel="notes-workspace"][data-workspace-panel-state="minimized"]');
    await expect(minimizedNotes).toHaveAttribute('data-workspace-panel-affixed', 'reserved');
    await expect(minimizedNotes).toHaveAttribute('data-workspace-panel-grid-cell', occupiedGridCell!);

    await dragSidebarItemIntoWorkspace(page, 'Tasks');
    const tasksPanel = page.getByRole('dialog', { name: 'Tasks panel' });
    await expect(tasksPanel).toBeVisible();
    const tasksHeaderBox = await tasksPanel.locator('[data-workspace-panel-header="true"]').boundingBox();
    if (!tasksHeaderBox) throw new Error('Tasks panel header was not measurable for occupied smart grid drag.');
    await page.mouse.move(tasksHeaderBox.x + 16, tasksHeaderBox.y + tasksHeaderBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(gridTarget.x, gridTarget.y, { steps: 12 });
    await expect(page.locator(`[data-workspace-snap-grid="${occupiedGrid}"][data-workspace-snap-cell="${occupiedCell}"]`)).toHaveCount(0);
    await page.mouse.up();
    await expect(tasksPanel).toHaveAttribute('data-workspace-panel-chrome', 'snapped');
    await expect(tasksPanel).toHaveAttribute('data-workspace-panel-affixed', 'true');
    await expect(tasksPanel).not.toHaveAttribute('data-workspace-panel-grid-cell', occupiedGridCell!);
    await expectTitlebarControlsInsideHeader(tasksPanel);
  });

  test('drags the Dashboard sidebar item into Workspace as a floating panel', async ({ page }) => {
    const blockedSideEffectRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (
        /127\.0\.0\.1:(8766|11434)/.test(url)
        || /localhost:(8766|11434)/.test(url)
        || /\/skills(?:\?|$)/.test(url)
        || /\/execute(?:\?|$)/.test(url)
        || /\/api\/caddy-agents(?:\/|\?|$)/.test(url)
      ) {
        blockedSideEffectRequests.push(url);
      }
    });

    await navigateToView(page, 'Workspace');
    const workspace = page.getByRole('region', { name: 'Workspace' });
    await expect(workspace).toBeVisible();

    const expandedTransfer = await page.evaluateHandle('new DataTransfer()');
    const dashboardNav = page.locator('nav[aria-label="Views"] [role="button"][aria-label="Dashboard"]').first();
    await dashboardNav.dispatchEvent('dragstart', { dataTransfer: expandedTransfer });
    await workspace.dispatchEvent('dragover', { dataTransfer: expandedTransfer, clientX: 650, clientY: 240 });
    await expect(workspace).toHaveAttribute('data-workspace-drop-state', 'valid');
    await workspace.dispatchEvent('drop', { dataTransfer: expandedTransfer, clientX: 650, clientY: 240 });
    await expandedTransfer.dispose();

    const panel = page.getByRole('dialog', { name: 'Dashboard panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByRole('heading', { name: 'Quick Links' })).toBeVisible();
    await expect(page.locator('[data-workspace-panel="chat-workspace"]')).toHaveCount(0);
    await expect(page.locator('[data-workspace-panel="agentcaddy-workspace"]')).toHaveCount(0);

    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();

    const collapsedTransfer = await page.evaluateHandle('new DataTransfer()');
    await page.locator('nav[aria-label="Main navigation"]').getByRole('button', { name: 'Dashboard', exact: true }).dispatchEvent('dragstart', {
      dataTransfer: collapsedTransfer,
    });
    await workspace.dispatchEvent('dragover', { dataTransfer: collapsedTransfer, clientX: 720, clientY: 280 });
    await expect(workspace).toHaveAttribute('data-workspace-drop-state', 'valid');
    await workspace.dispatchEvent('drop', { dataTransfer: collapsedTransfer, clientX: 720, clientY: 280 });
    await collapsedTransfer.dispose();

    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(page.getByRole('dialog', { name: 'Dashboard panel' })).toHaveCount(1);
    await expect(page.getByRole('region', { name: 'Workspace' })).toBeVisible();
    expect(blockedSideEffectRequests).toEqual([]);
  });

  test('uses hover text instead of a side-menu arrow button for Dashboard workspace launch', async ({ page }) => {
    const blockedSideEffectRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (
        /127\.0\.0\.1:(8766|11434)/.test(url)
        || /localhost:(8766|11434)/.test(url)
        || /\/skills(?:\?|$)/.test(url)
        || /\/execute(?:\?|$)/.test(url)
        || /\/api\/caddy-agents(?:\/|\?|$)/.test(url)
      ) {
        blockedSideEffectRequests.push(url);
      }
    });

    await expect(page.getByRole('button', { name: 'Open Dashboard in Workspace' })).toHaveCount(0);
    await openSidebarItemInWorkspace(page, 'Dashboard', 'Dashboard panel');

    await expect(page.getByRole('region', { name: 'Workspace' })).toBeVisible();
    const panel = page.getByRole('dialog', { name: 'Dashboard panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByRole('heading', { name: 'Quick Links' })).toBeVisible();
    await expect(page.locator('[data-workspace-panel="chat-workspace"]')).toHaveCount(0);
    await expect(page.locator('[data-workspace-panel="agentcaddy-workspace"]')).toHaveCount(0);
    expect(blockedSideEffectRequests).toEqual([]);
  });

  test('saves and reloads a named workspace layout from the icon-only workspace bar', async ({ page }) => {
    await navigateToView(page, 'Workspace');
    await expect(page.getByRole('region', { name: 'Workspace' })).toBeVisible();
    const investigationSelect = page.getByRole('combobox', { name: 'Active workspace investigation' });
    await expect(investigationSelect).toBeVisible();
    await expect(investigationSelect).toContainText('No investigation selected');
    await expect(investigationSelect).toHaveAttribute('data-toolbar-select-control', 'true');
    await expect(investigationSelect).toHaveAttribute('data-workspace-investigation-select', 'true');
    await expect(page.getByRole('button', { name: 'Workspace investigation layer' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open CaddyShack' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open Investigations' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Update selected workspace layout' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import workspace layout template' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export workspace layout template' })).toBeVisible();
    await expect(page.getByLabel('Workspace layout name')).toHaveCount(0);
    const layoutSelect = page.getByRole('combobox', { name: 'Layouts' });
    await expect(layoutSelect).toBeVisible();
    await expect(layoutSelect).toContainText('Default');
    await expect(layoutSelect).toHaveAttribute('data-toolbar-select-control', 'true');
    await expect(layoutSelect).toHaveAttribute('data-workspace-layout-select', 'true');
    await layoutSelect.click();
    await expect(page.getByRole('listbox', { name: 'Layouts options' })).toHaveAttribute('data-toolbar-select-listbox', 'true');
    await expect(page.getByRole('option', { name: 'Default' })).toHaveAttribute('data-toolbar-select-option-active', 'true');
    await expect(page.getByRole('option', { name: 'Add layout' })).toBeVisible();
    await layoutSelect.click();
    await expect(page.getByText('Save layout')).toHaveCount(0);
    await expect(page.getByText('Import layout')).toHaveCount(0);

    const panel = await openSidebarItemInWorkspace(page, 'Dashboard', 'Dashboard panel');

    await layoutSelect.click();
    await page.getByRole('option', { name: 'Add layout' }).click();
    await expect(page.getByRole('status')).toContainText(/Added Layout \d+\./);

    await panel.getByRole('button', { name: 'Minimize Dashboard' }).click();
    await expect(page.getByRole('button', { name: 'Restore Dashboard panel' })).toBeVisible();

    await page.getByRole('button', { name: 'Load selected workspace layout' }).click();
    await expect(page.getByRole('status')).toContainText(/Loaded Layout \d+ with 1 panels\./);
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
  });

  test('uses one top-row investigation dropdown across selected and no-selected Workspace states', async ({ page }) => {
    await createInvestigation(page, 'Workspace Header Alpha');
    await createInvestigation(page, 'Workspace Header Beta');
    await navigateToView(page, 'Workspace');

    const header = page.locator('[data-workspace-investigation-layer="true"]');
    await expect(header).toHaveCount(1);
    await expect(page.locator('[data-workspace-layout-template-controls="true"]')).toHaveCount(1);
    await expect(page.locator('[data-workspace-tlp-footer="true"]')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Show all' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Workspace investigation layer' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open CaddyShack' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open Investigations' })).toHaveCount(0);

    const investigationSelect = page.getByRole('combobox', { name: 'Active workspace investigation' });
    await expect(investigationSelect).toBeVisible();
    await expect(investigationSelect).toContainText('Workspace Header Beta');
    await expect(investigationSelect).toHaveAttribute('data-toolbar-select-control', 'true');
    await expect(investigationSelect).toHaveAttribute('data-workspace-investigation-select', 'true');
    await investigationSelect.click();
    await expect(page.getByRole('listbox', { name: 'Active workspace investigation options' })).toHaveAttribute('data-toolbar-select-listbox', 'true');
    await expect(page.getByRole('option', { name: 'Workspace Header Beta' })).toHaveAttribute('data-toolbar-select-option-active', 'true');
    await page.keyboard.press('Escape');

    await investigationSelect.click();
    await page.getByRole('option', { name: 'Workspace Header Alpha' }).click();
    await expect(investigationSelect).toContainText('Workspace Header Alpha');
    await expect(page.getByRole('button', { name: 'Show all' })).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('Workspace investigation context switched.');

    await investigationSelect.click();
    await page.getByRole('option', { name: 'No investigation selected' }).click();
    await expect(investigationSelect).toContainText('No investigation selected');
    await expect(page.getByRole('button', { name: 'Show all' })).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('Workspace investigation context cleared.');
  });

  test('rejects malformed workspace layout imports without changing the current panel', async ({ page }) => {
    const panel = await openSidebarItemInWorkspace(page, 'Dashboard', 'Dashboard panel');

    const malformedLayout = JSON.stringify({
      kind: 'threatcaddy.workspace-layout-template',
      version: 1,
      notes: [{ title: 'should not import' }],
      panels: [{
        id: 'dashboard-workspace',
        mode: 'minimized',
        restoreMode: 'floating',
        geometry: { x: 1, y: 1, width: 500, height: 400 },
      }],
    });

    await page.getByLabel('Workspace layout template file').setInputFiles({
      name: 'malformed-layout.json',
      mimeType: 'application/json',
      buffer: Buffer.from(malformedLayout),
    });

    await expect(page.getByRole('status')).toContainText('Workspace layout template contains unsupported metadata.');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(page.locator('[data-workspace-panel="chat-workspace"]')).toHaveCount(0);
    await expect(page.locator('[data-workspace-panel="agentcaddy-workspace"]')).toHaveCount(0);
  });

  test('drags the EmailCaddy sidebar item into Workspace as a passive floating panel', async ({ page }) => {
    const blockedSideEffectRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (
        /127\.0\.0\.1:(8766|11434)/.test(url)
        || /localhost:(8766|11434)/.test(url)
        || /\/skills(?:\?|$)/.test(url)
        || /\/execute(?:\?|$)/.test(url)
        || /\/api\/caddy-agents(?:\/|\?|$)/.test(url)
        || /\/api\/email(?:\/|\?|$)/.test(url)
        || /\/api\/calendar(?:\/|\?|$)/.test(url)
      ) {
        blockedSideEffectRequests.push(url);
      }
    });

    await navigateToView(page, 'Workspace');
    const workspace = page.getByRole('region', { name: 'Workspace' });
    await expect(workspace).toBeVisible();

    const transfer = await page.evaluateHandle('new DataTransfer()');
    const emailNav = page.locator('nav[aria-label="Views"] [role="button"][aria-label="EmailCaddy"]').first();
    await emailNav.dispatchEvent('dragstart', { dataTransfer: transfer });
    await workspace.dispatchEvent('dragover', { dataTransfer: transfer, clientX: 720, clientY: 260 });
    await expect(workspace).toHaveAttribute('data-workspace-drop-state', 'valid');
    await workspace.dispatchEvent('drop', { dataTransfer: transfer, clientX: 720, clientY: 260 });
    await transfer.dispose();

    const panel = page.getByRole('dialog', { name: 'EmailCaddy panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByRole('button', { name: 'Compose' })).toBeVisible();
    await expect(page.locator('[data-workspace-panel="chat-workspace"]')).toHaveCount(0);
    await expect(page.locator('[data-workspace-panel="agentcaddy-workspace"]')).toHaveCount(0);
    expect(blockedSideEffectRequests).toEqual([]);
  });

  test('opens EmailCaddy in Workspace from sidebar drag without side-effect calls', async ({ page }) => {
    const blockedSideEffectRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (
        /127\.0\.0\.1:(8766|11434)/.test(url)
        || /localhost:(8766|11434)/.test(url)
        || /\/skills(?:\?|$)/.test(url)
        || /\/execute(?:\?|$)/.test(url)
        || /\/api\/caddy-agents(?:\/|\?|$)/.test(url)
        || /\/api\/email(?:\/|\?|$)/.test(url)
        || /\/api\/calendar(?:\/|\?|$)/.test(url)
      ) {
        blockedSideEffectRequests.push(url);
      }
    });

    await expect(page.getByRole('button', { name: 'Open EmailCaddy in Workspace' })).toHaveCount(0);
    await openSidebarItemInWorkspace(page, 'EmailCaddy', 'EmailCaddy panel');

    const panel = page.getByRole('dialog', { name: 'EmailCaddy panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel).toHaveAttribute('data-panel-compact', 'true');
    await expect(panel.locator('[data-email-compact-panel="true"]')).toBeVisible();
    await expect(panel.locator('[data-email-route-header="true"]')).toHaveCount(0);
    await expect(panel.locator('[data-email-message-context-card="true"]')).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Compose' })).toBeVisible();
    await expect(panel.getByRole('textbox', { name: 'Search EmailCaddy' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Ask CaddyAI about email search' })).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Reply', exact: true })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Context' })).toBeDisabled();
    await expect(panel.getByRole('separator', { name: 'Resize selected email pane' })).toHaveCount(0);
    await expect(panel.locator('[data-email-mail-surface="true"]')).toHaveAttribute('data-email-lower-pane-active', 'false');
    await expect(panel.locator('[data-email-lower-pane="true"]')).toHaveCount(0);
    await expect(page.locator('[data-workspace-panel="chat-workspace"]')).toHaveCount(0);
    await expect(page.locator('[data-workspace-panel="agentcaddy-workspace"]')).toHaveCount(0);
    expect(blockedSideEffectRequests).toEqual([]);
  });

  test('stages EmailCaddy account setup locally without provider side effects', async ({ page }) => {
    const blockedSideEffectRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (
        /accounts\.google\.com|login\.microsoftonline\.com|graph\.microsoft\.com|proton\.me|imap|smtp/i.test(url)
        || /127\.0\.0\.1:(8766|11434)/.test(url)
        || /localhost:(8766|11434)/.test(url)
        || /\/oauth(?:\/|\?|$)/.test(url)
        || /\/api\/email(?:\/|\?|$)/.test(url)
        || /\/api\/calendar(?:\/|\?|$)/.test(url)
      ) {
        blockedSideEffectRequests.push(url);
      }
    });

    await openSidebarItemInWorkspace(page, 'EmailCaddy', 'EmailCaddy panel');
    const panel = page.getByRole('dialog', { name: 'EmailCaddy panel' });
    await expect(panel.locator('[data-email-account-empty-state="true"]')).toContainText('No real email account is configured');

    await panel.getByRole('button', { name: 'Set up EmailCaddy account' }).click();
    const setup = panel.getByRole('region', { name: 'Email account setup' });
    await expect(setup).toBeVisible();
    await expect(setup).toContainText('Gmail / Google');
    await expect(setup).toContainText('Outlook / Microsoft / Hotmail');
    await expect(setup).toContainText('Proton');
    await expect(setup).toContainText('Generic IMAP / SMTP');
    await expect(setup).toContainText('Local mail bridge / manual proxy');

    await setup.getByRole('button', { name: 'Generic IMAP / SMTP' }).click();
    await expect(setup).toContainText('does not collect passwords');
    await setup.getByRole('button', { name: 'Run safe connection test' }).click();
    await expect(setup).toContainText('No provider, OAuth, IMAP, SMTP, bridge, or send request was made');
    await setup.getByRole('button', { name: 'Save local setup state' }).click();
    await expect(setup).toContainText('setup is staged locally for this session');
    await setup.getByRole('button', { name: 'Close email account setup' }).click();
    await expect(panel.locator('[data-email-account-status="true"]')).toContainText('Local setup staged');

    await panel.getByRole('button', { name: 'Open Follow-up: did we answer every onboarding question?' }).click();
    const readerPanel = page.getByRole('dialog', { name: 'EmailCaddy message reader panel' });
    await expect(readerPanel).toBeVisible();
    await readerPanel.getByRole('button', { name: 'Reply', exact: true }).click();
    const draftPanel = page.getByRole('dialog', { name: 'EmailCaddy draft panel' });
    await expect(draftPanel).toBeVisible();
    await expect(draftPanel.getByRole('textbox', { name: 'EmailCaddy draft subject' })).toBeVisible();
    await expect(draftPanel).toContainText('editable before any platform send');
    await expect(blockedSideEffectRequests).toEqual([]);
  });

  for (const item of [
    {
      label: 'EmailCaddy',
      route: 'EmailCaddy' as const,
      sourceSelector: '[data-email-workspace-drag-source="true"]',
      title: 'Drag EmailCaddy into Workspace',
      panelName: 'EmailCaddy panel',
      panelCheckSelector: null,
      buttonName: 'Compose',
    },
    {
      label: 'CalendarCaddy',
      route: 'CalendarCaddy' as const,
      sourceSelector: '[data-calendar-workspace-drag-source="true"]',
      title: 'Drag CalendarCaddy into Workspace',
      panelName: 'CalendarCaddy panel',
      panelCheckSelector: '[data-calendar-compact-titlebar="true"]',
      buttonName: null,
    },
  ]) {
  test(`drags ${item.label} app surface into Workspace without side-effect calls`, async ({ page }) => {
    const blockedSideEffectRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (
        /127\.0\.0\.1:(8766|11434)/.test(url)
        || /localhost:(8766|11434)/.test(url)
        || /\/skills(?:\?|$)/.test(url)
        || /\/execute(?:\?|$)/.test(url)
        || /\/api\/caddy-agents(?:\/|\?|$)/.test(url)
        || /\/api\/email(?:\/|\?|$)/.test(url)
        || /\/api\/calendar(?:\/|\?|$)/.test(url)
      ) {
        blockedSideEffectRequests.push(url);
      }
    });

    await navigateToView(page, item.route);
    await expect(page.locator(item.sourceSelector)).toHaveAttribute('title', item.title);
    await dragAssistantSurfaceToWorkspaceNav(page, item.sourceSelector);
    await expect(page.getByRole('region', { name: 'Workspace' })).toBeVisible();
    const panel = page.getByRole('dialog', { name: item.panelName });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    if (item.buttonName) {
      await expect(panel.getByRole('button', { name: item.buttonName })).toBeVisible();
    }
    if (item.panelCheckSelector) {
      await expect(panel.locator(item.panelCheckSelector)).toBeVisible();
    }
    if (item.label === 'CalendarCaddy') {
      await expect(panel).toHaveAttribute('data-panel-compact', 'true');
      await expect(panel.getByRole('button', { name: 'Select Friday, June 5, 2026' })).toBeVisible();
      await expect(panel.getByRole('textbox', { name: 'Ask CalendarCaddy' })).toHaveCount(0);
    }
    await expect(page.locator('[data-workspace-panel="chat-workspace"]')).toHaveCount(0);
    await expect(page.locator('[data-workspace-panel="agentcaddy-workspace"]')).toHaveCount(0);
    expect(blockedSideEffectRequests).toEqual([]);
  });
  }

  test('smart-minimizes EmailCaddy chrome when its workspace panel shrinks', async ({ page }) => {
    const blockedSideEffectRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (
        /127\.0\.0\.1:(8766|11434)/.test(url)
        || /localhost:(8766|11434)/.test(url)
        || /\/skills(?:\?|$)/.test(url)
        || /\/execute(?:\?|$)/.test(url)
        || /\/api\/caddy-agents(?:\/|\?|$)/.test(url)
        || /\/api\/email(?:\/|\?|$)/.test(url)
        || /\/api\/calendar(?:\/|\?|$)/.test(url)
      ) {
        blockedSideEffectRequests.push(url);
      }
    });

    await openSidebarItemInWorkspace(page, 'EmailCaddy', 'EmailCaddy panel');

    const panel = page.getByRole('dialog', { name: 'EmailCaddy panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel).toHaveAttribute('data-panel-compact', 'true');
    await expect(panel.locator('[data-email-compact-panel="true"]')).toBeVisible();
    await expect(panel.locator('[data-email-route-header="true"]')).toHaveCount(0);
    await expect(panel.locator('[data-email-message-context-card="true"]')).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Compose' })).toBeVisible();
    await expect(panel.getByRole('textbox', { name: 'Search EmailCaddy' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Ask CaddyAI about email search' })).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Reply', exact: true })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Context' })).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Return EmailCaddy to main workspace' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Minimize EmailCaddy' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Close EmailCaddy workspace panel' })).toBeVisible();
    await expect(panel.locator('[data-email-mail-surface="true"]')).toHaveAttribute('data-email-lower-pane-active', 'false');
    await expect(panel.locator('[data-email-thread-list-pane="true"]')).toBeVisible();
    await expect(panel.locator('[data-email-reader-pane="true"]')).toHaveCount(0);
    await expect(panel.locator('[data-email-lower-pane="true"]')).toHaveCount(0);
    await expect(panel.getByRole('separator', { name: 'Resize selected email pane' })).toHaveCount(0);
    await expect(panel.getByText('Select a thread to open the reader and draft view.')).toHaveCount(0);

    const compactSearch = panel.getByRole('textbox', { name: 'Search EmailCaddy' });
    await compactSearch.fill('reply');
    await compactSearch.press('Enter');
    await expect(panel.locator('[data-email-assistant-preview="true"]')).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Ask CaddyAI about email search' })).toBeEnabled();
    await panel.getByRole('button', { name: 'Ask CaddyAI about email search' }).click();
    await expect(panel.locator('[data-email-assistant-preview="true"]')).toContainText('Reply shaping preview');
    await compactSearch.fill('');

    const resizeHandle = panel.getByRole('button', { name: 'Resize EmailCaddy panel from bottom right' });
    const handleBox = await resizeHandle.boundingBox();
    expect(handleBox).not.toBeNull();
    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox!.x - 250, handleBox!.y - 150, { steps: 8 });
    await page.mouse.up();

    await expect(panel).toHaveAttribute('data-panel-compact', 'true');
    await expect(panel.locator('[data-email-compact-panel="true"]')).toBeVisible();
    await expect(panel.locator('[data-email-route-header="true"]')).toHaveCount(0);
    await expect(panel.locator('[data-email-message-context-card="true"]')).toHaveCount(0);
    await expect(panel.getByRole('separator', { name: 'Resize selected email pane' })).toHaveCount(0);
    await expect(panel.locator('[data-email-mail-surface="true"]')).toHaveAttribute('data-email-lower-pane-active', 'false');
    await expect(panel.locator('[data-email-thread-list-pane="true"]')).toBeVisible();
    await expect(panel.locator('[data-email-lower-pane="true"]')).toHaveCount(0);
    const emptyThreadListBox = await panel.locator('[data-email-thread-list-pane="true"]').boundingBox();
    expect(emptyThreadListBox).not.toBeNull();
    expect(emptyThreadListBox!.height).toBeGreaterThan(180);

    await panel.getByRole('button', { name: 'Open Follow-up: did we answer every onboarding question?' }).click();
    await expect(panel.getByRole('button', { name: 'Reply', exact: true })).toHaveCount(0);
    await expect(panel.getByRole('separator', { name: 'Resize selected email pane' })).toHaveCount(0);
    await expect(panel.locator('[data-email-lower-pane="true"]')).toHaveCount(0);
    await expect(panel.locator('[data-email-mail-surface="true"]')).toHaveAttribute('data-email-lower-pane-active', 'false');
    await expect(panel.locator('[data-email-thread-list-pane="true"]')).toBeVisible();
    await expect(panel.locator('[data-email-reader-pane="true"]')).toHaveCount(0);
    const readerPanel = page.getByRole('dialog', { name: 'EmailCaddy message reader panel' });
    await expect(readerPanel).toBeVisible();
    await expect(readerPanel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(readerPanel.getByRole('button', { name: 'Reply', exact: true })).toBeVisible();
    await expect(readerPanel.getByRole('button', { name: 'Reply all' })).toBeVisible();
    await expect(readerPanel.getByRole('button', { name: 'Forward' })).toBeVisible();
    await expect(readerPanel.getByRole('button', { name: 'Context' })).toBeVisible();
    const threadListBox = await panel.locator('[data-email-thread-list-pane="true"]').boundingBox();
    const readerBox = await readerPanel.locator('[data-email-reader-pane="true"]').boundingBox();
    expect(threadListBox).not.toBeNull();
    expect(readerBox).not.toBeNull();
    expect(threadListBox!.height).toBeGreaterThan(180);
    expect(readerBox!.height).toBeGreaterThan(60);
    await expect(panel.locator('[data-email-selected-message-card="true"]')).toHaveCount(0);
    await panel.getByRole('button', { name: 'Open Follow-up: did we answer every onboarding question?' }).click({ button: 'right' });
    const rowMenu = page.getByRole('menu', { name: 'Email row actions' });
    await expect(rowMenu).toBeVisible();
    await expect(rowMenu).toHaveAttribute('data-themed-context-menu', 'toolbar-select');
    await expect(rowMenu.getByRole('menuitem', { name: 'Open reader' })).toBeVisible();
    await expect(rowMenu.getByRole('menuitem', { name: 'Reply', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(rowMenu).toHaveCount(0);
    await readerPanel.getByRole('button', { name: 'Reply', exact: true }).click();
    const draftPanel = page.getByRole('dialog', { name: 'EmailCaddy draft panel' });
    await expect(draftPanel).toBeVisible();
    await expect(draftPanel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.locator('[data-email-mail-surface="true"]')).toHaveAttribute('data-email-lower-pane-active', 'false');
    await expect(panel.locator('[data-email-lower-pane="true"]')).toHaveCount(0);
    const draftSubject = draftPanel.getByRole('textbox', { name: 'EmailCaddy draft subject' });
    await expect(draftSubject).toBeVisible();
    await draftSubject.fill('Compact EmailCaddy smoke subject');
    await expect(draftSubject).toHaveValue('Compact EmailCaddy smoke subject');
    await expect(panel.getByRole('textbox', { name: 'Search EmailCaddy' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Compose' })).toBeVisible();
    await expect(panel.getByRole('combobox', { name: 'Select bulk action' })).toHaveCount(0);
    await expect(draftPanel.getByRole('button', { name: 'Context' })).toBeVisible();
    await expect(panel.locator('[data-email-thread-list-pane="true"]')).toBeVisible();
    await expect(readerPanel).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Sanitize' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Stage send review' })).toHaveCount(0);
    await expect(page.locator('[data-workspace-panel="chat-workspace"]')).toHaveCount(0);
    await expect(page.locator('[data-workspace-panel="agentcaddy-workspace"]')).toHaveCount(0);
    expect(blockedSideEffectRequests).toEqual([]);
  });

  test('opens CalendarCaddy in Workspace from sidebar drag without side-effect calls', async ({ page }) => {
    const blockedSideEffectRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (
        /127\.0\.0\.1:(8766|11434)/.test(url)
        || /localhost:(8766|11434)/.test(url)
        || /\/skills(?:\?|$)/.test(url)
        || /\/execute(?:\?|$)/.test(url)
        || /\/api\/caddy-agents(?:\/|\?|$)/.test(url)
        || /\/api\/email(?:\/|\?|$)/.test(url)
        || /\/api\/calendar(?:\/|\?|$)/.test(url)
      ) {
        blockedSideEffectRequests.push(url);
      }
    });

    await expect(page.getByRole('button', { name: 'Open CalendarCaddy in Workspace' })).toHaveCount(0);
    await openSidebarItemInWorkspace(page, 'CalendarCaddy', 'CalendarCaddy panel');

    await expect(page.getByRole('region', { name: 'Workspace' })).toBeVisible();
    await expect(page.locator('[data-assistantcaddy-shell-pane="active"]')).toHaveCount(0);
    const panel = page.getByRole('dialog', { name: 'CalendarCaddy panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel).toHaveAttribute('data-panel-compact', 'true');
    await expect(panel.locator('[data-calendar-compact-panel="true"]')).toBeVisible();
    await expect(panel.locator('[data-calendar-compact-titlebar="true"]')).toBeVisible();
    await expect(panel.locator('[data-calendar-compact-selected-date="true"]')).toContainText('Friday, June 5, 2026');
    await expect(panel.getByRole('status')).toHaveClass(/sr-only/);
    await expect(panel.getByRole('button', { name: 'Current calendar period' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Select Friday, June 5, 2026' })).toBeVisible();
    await expect(panel.getByRole('textbox', { name: 'Ask CalendarCaddy' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'New event' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Pop out selected agenda' })).toHaveCount(0);
    await expect(panel.getByRole('region', { name: 'CalendarCaddy selected agenda' })).toHaveCount(0);
    await expect(panel.locator('[data-workspace-panel-primary-action="true"]')).toHaveAttribute(
      'data-workspace-panel-primary-action-text-visible',
      'false',
    );
    await expect(page.locator('[data-workspace-panel="chat-workspace"]')).toHaveCount(0);
    await expect(page.locator('[data-workspace-panel="agentcaddy-workspace"]')).toHaveCount(0);
    expect(blockedSideEffectRequests).toEqual([]);
  });

  test('keeps compact CalendarCaddy usable across resize, minimize, dock, close, and snap', async ({ page }) => {
    const blockedSideEffectRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (
        /127\.0\.0\.1:(8766|11434)/.test(url)
        || /localhost:(8766|11434)/.test(url)
        || /\/skills(?:\?|$)/.test(url)
        || /\/execute(?:\?|$)/.test(url)
        || /\/api\/caddy-agents(?:\/|\?|$)/.test(url)
        || /\/api\/email(?:\/|\?|$)/.test(url)
        || /\/api\/calendar(?:\/|\?|$)/.test(url)
      ) {
        blockedSideEffectRequests.push(url);
      }
    });

    await openSidebarItemInWorkspace(page, 'CalendarCaddy', 'CalendarCaddy panel');

    await expect(page.getByRole('region', { name: 'Workspace' })).toBeVisible();
    await expect(page.locator('[data-assistantcaddy-shell-pane="active"]')).toHaveCount(0);
    const panel = page.getByRole('dialog', { name: 'CalendarCaddy panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel).toHaveAttribute('data-panel-compact', 'true');
    await expect(panel.locator('[data-calendar-compact-titlebar="true"]')).toBeVisible();
    await expect(panel.locator('[data-calendar-compact-selected-date="true"]')).toContainText('Friday, June 5, 2026');
    await expect(panel.getByRole('status')).toHaveClass(/sr-only/);
    const initialBox = await panel.boundingBox();
    expect(initialBox).not.toBeNull();
    expect(initialBox!.width).toBeLessThanOrEqual(760);
    expect(initialBox!.height).toBeLessThanOrEqual(520);
    await expect(panel.getByRole('button', { name: 'Current calendar period' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Select Friday, June 5, 2026' })).toBeVisible();
    await expect(panel.getByRole('textbox', { name: 'Ask CalendarCaddy' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'New event' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Pop out selected agenda' })).toHaveCount(0);
    await expect(panel.getByRole('region', { name: 'CalendarCaddy selected agenda' })).toHaveCount(0);
    await expect(panel.locator('[data-workspace-panel-primary-action="true"]')).toHaveAttribute(
      'data-workspace-panel-primary-action-text-visible',
      'false',
    );

    await panel.getByRole('button', { name: 'Minimize CalendarCaddy' }).click();
    await expect(page.locator('[data-workspace-panel="calendarcaddy-workspace"][data-workspace-panel-state="minimized"]')).toBeVisible();
    await page.getByRole('button', { name: 'Restore CalendarCaddy panel' }).click();
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByRole('button', { name: 'Select Friday, June 5, 2026' })).toBeVisible();

    await panel.locator('[data-workspace-panel-primary-action="true"]').click();
    const dockedPanel = page.locator('[data-workspace-panel="calendarcaddy-workspace"][data-workspace-panel-state="docked"]');
    await expect(dockedPanel).toBeVisible();
    await dockedPanel.getByRole('button', { name: 'Pop out CalendarCaddy' }).click();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');

    const resizeHandle = panel.getByRole('button', { name: 'Resize CalendarCaddy panel from bottom right' });
    const handleBox = await resizeHandle.boundingBox();
    expect(handleBox).not.toBeNull();
    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox!.x - 180, handleBox!.y - 140, { steps: 8 });
    await page.mouse.up();

    await expect(panel).toHaveAttribute('data-panel-compact', 'true');
    await expect(panel.locator('[data-calendar-compact-panel="true"]')).toBeVisible();
    await expect(panel.locator('[data-calendar-compact-titlebar="true"]')).toBeVisible();
    const compactBox = await panel.boundingBox();
    expect(compactBox).not.toBeNull();
    expect(compactBox!.width).toBeLessThanOrEqual(620);
    expect(compactBox!.height).toBeLessThanOrEqual(390);
    await expect(panel.locator('h2.sr-only')).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Today' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Current calendar period' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'month' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Select Friday, June 5, 2026' })).toBeVisible();
    await expect(panel.getByRole('textbox', { name: 'Ask CalendarCaddy' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'New event' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Calendar settings' })).toHaveCount(0);
    await expect(panel.locator('[data-calendar-compact-stamp-strip="true"]')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Use Focus work stamp' })).toBeVisible();
    await expect(panel.getByRole('region', { name: 'CalendarCaddy selected agenda' })).toHaveCount(0);

    const headerBox = await panel.locator('[data-workspace-panel-header="true"]').boundingBox();
    expect(headerBox).not.toBeNull();
    const snapTarget = await workspaceGridTarget(page, { insetX: 4, insetY: 0.5 });
    await page.mouse.move(headerBox!.x + 16, headerBox!.y + headerBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(snapTarget.x, snapTarget.y, { steps: 10 });
    await expect(page.locator('[data-workspace-snap-preview="right"]')).toBeVisible();
    await page.mouse.up();
    await expect(panel).toHaveAttribute('data-workspace-panel-chrome', 'snapped');
    await expect(panel).toHaveAttribute('data-workspace-panel-snap-zone', 'right');
    await expect(panel.getByRole('button', { name: 'Select Friday, June 5, 2026' })).toBeVisible();

    await panel.getByRole('button', { name: 'Close CalendarCaddy workspace panel' }).click();
    await expect(panel).toHaveCount(0);
    await expect(page.locator('[data-workspace-panel="chat-workspace"]')).toHaveCount(0);
    await expect(page.locator('[data-workspace-panel="agentcaddy-workspace"]')).toHaveCount(0);
    expect(blockedSideEffectRequests).toEqual([]);
  });

  test('drags lower-risk sidebar items into Workspace as floating panels', async ({ page }) => {
    const blockedSideEffectRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (
        /127\.0\.0\.1:(8766|11434)/.test(url)
        || /localhost:(8766|11434)/.test(url)
        || /\/skills(?:\?|$)/.test(url)
        || /\/execute(?:\?|$)/.test(url)
        || /\/api\/caddy-agents(?:\/|\?|$)/.test(url)
      ) {
        blockedSideEffectRequests.push(url);
      }
    });

    await createInvestigation(page, 'Workspace Drag Panel Case');
    await navigateToView(page, 'Workspace');
    const workspace = page.getByRole('region', { name: 'Workspace' });
    await expect(workspace).toBeVisible();

    const viewsNav = page.locator('nav[aria-label="Views"]');
    const launchChecks = [
      { label: 'Activity', dialogName: 'Activity panel', panelId: 'activity-workspace', headingName: 'Activity Log' },
      { label: 'Products', dialogName: 'Products panel', panelId: 'products-workspace', headingName: 'Products' },
      { label: 'Notes', dialogName: 'Notes panel', panelId: 'notes-workspace', buttonName: 'Create blank note' },
      { label: 'Tasks', dialogName: 'Tasks panel', panelId: 'tasks-workspace', buttonName: 'New task' },
    ];

    for (const [index, launch] of launchChecks.entries()) {
      const transfer = await page.evaluateHandle('new DataTransfer()');
      const navItem = viewsNav.locator(`[role="button"][aria-label="${launch.label}"]`).first();
      await navItem.dispatchEvent('dragstart', { dataTransfer: transfer });
      await workspace.dispatchEvent('dragover', {
        dataTransfer: transfer,
        clientX: 620 + index * 36,
        clientY: 220 + index * 28,
      });
      await expect(workspace).toHaveAttribute('data-workspace-drop-state', 'valid');
      await workspace.dispatchEvent('drop', {
        dataTransfer: transfer,
        clientX: 620 + index * 36,
        clientY: 220 + index * 28,
      });
      await transfer.dispose();

      const panel = page.getByRole('dialog', { name: launch.dialogName });
      await expect(panel).toBeVisible();
      await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
      if ('headingName' in launch) {
        await expect(panel.getByRole('heading', { name: launch.headingName, exact: true })).toBeVisible();
      }
      if ('buttonName' in launch) {
        await expect(panel.getByRole('button', { name: launch.buttonName, exact: true })).toBeVisible();
      }
      await expect(page.locator(`[data-workspace-panel="${launch.panelId}"][data-workspace-panel-state="floating"]`)).toHaveCount(1);
    }

    await expect(page.locator('[data-workspace-panel="chat-workspace"]')).toHaveCount(0);
    await expect(page.locator('[data-workspace-panel="agentcaddy-workspace"]')).toHaveCount(0);
    expect(blockedSideEffectRequests).toEqual([]);
  });

  test('keeps floating source placeholders compact after a panel is dragged into Workspace', async ({ page }) => {
    await createInvestigation(page, 'Workspace Compact Source Slot Case');
    await navigateToView(page, 'Workspace');
    const workspace = page.getByRole('region', { name: 'Workspace' });
    await expect(workspace).toBeVisible();

    const transfer = await page.evaluateHandle('new DataTransfer()');
    const viewsNav = page.locator('nav[aria-label="Views"]');
    await viewsNav.locator('[role="button"][aria-label="Tasks"]').first().dispatchEvent('dragstart', { dataTransfer: transfer });
    await workspace.dispatchEvent('dragover', { dataTransfer: transfer, clientX: 700, clientY: 260 });
    await expect(workspace).toHaveAttribute('data-workspace-drop-state', 'valid');
    await workspace.dispatchEvent('drop', { dataTransfer: transfer, clientX: 700, clientY: 260 });
    await transfer.dispose();

    const tasksPanel = page.getByRole('dialog', { name: 'Tasks panel' });
    await expect(tasksPanel).toBeVisible();

    const tasksSourceSlot = page.locator('[data-workspace-panel="tasks-workspace"][data-workspace-panel-state="floating-source"]');
    await expect(tasksSourceSlot).toHaveAttribute('data-workspace-panel-source-compact', 'true');
    await expect(tasksSourceSlot.getByText('This pane is popped out in the workspace.')).toHaveCount(0);
    await expect(tasksSourceSlot.getByRole('button', { name: 'Return Tasks to main workspace from source slot' })).toBeVisible();
    const tasksSourceBox = await tasksSourceSlot.boundingBox();
    expect(tasksSourceBox).not.toBeNull();
    expect(tasksSourceBox!.width).toBeLessThanOrEqual(240);
    expect(tasksSourceBox!.height).toBeLessThanOrEqual(48);
  });

  test('smart-minimizes Notes and Tasks toolbar chrome when their panels shrink', async ({ page }) => {
    const blockedSideEffectRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (
        /127\.0\.0\.1:(8766|11434)/.test(url)
        || /localhost:(8766|11434)/.test(url)
        || /\/skills(?:\?|$)/.test(url)
        || /\/execute(?:\?|$)/.test(url)
        || /\/api\/caddy-agents(?:\/|\?|$)/.test(url)
      ) {
        blockedSideEffectRequests.push(url);
      }
    });

    await createInvestigation(page, 'Workspace Compact Panel Case');
    await navigateToView(page, 'Tasks');
    await openNewTaskForm(page);
    const createTaskDialog = page.getByRole('dialog', { name: 'Create Task' });
    const compactTaskTitle = 'Compact workspace task with a long title that needs hover text and two-line wrapping';
    await createTaskDialog.getByLabel('Title').fill(compactTaskTitle);
    const checklistInput = createTaskDialog.getByPlaceholder('Add checklist item...');
    await checklistInput.fill('Confirm the task list remains readable in a compact workspace tile');
    await checklistInput.press('Enter');
    await checklistInput.fill('Keep sub-items visible until the checklist is toggled closed');
    await checklistInput.press('Enter');
    await createTaskDialog.getByRole('button', { name: 'Create Task' }).click();
    await expect(page.getByText(compactTaskTitle)).toBeVisible({ timeout: 5_000 });

    await navigateToView(page, 'Workspace');
    const workspace = page.getByRole('region', { name: 'Workspace' });
    await expect(workspace).toBeVisible();

    const viewsNav = page.locator('nav[aria-label="Views"]');

    const openFromSidebar = async (label: 'Notes' | 'Tasks', clientX: number, clientY: number) => {
      const transfer = await page.evaluateHandle('new DataTransfer()');
      await viewsNav.locator(`[role="button"][aria-label="${label}"]`).first().dispatchEvent('dragstart', { dataTransfer: transfer });
      await workspace.dispatchEvent('dragover', { dataTransfer: transfer, clientX, clientY });
      await expect(workspace).toHaveAttribute('data-workspace-drop-state', 'valid');
      await workspace.dispatchEvent('drop', { dataTransfer: transfer, clientX, clientY });
      await transfer.dispose();
    };

    const shrinkFromBottomRight = async (panelName: string, deltaX: number, deltaY: number) => {
      const panel = page.getByRole('dialog', { name: panelName });
      const resizeHandle = panel.getByRole('button', { name: `Resize ${panelName} from bottom right` });
      const handleBox = await resizeHandle.boundingBox();
      expect(handleBox).not.toBeNull();
      await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
      await page.mouse.down();
      await page.mouse.move(handleBox!.x + deltaX, handleBox!.y + deltaY, { steps: 8 });
      await page.mouse.up();
      return panel;
    };

    await openFromSidebar('Notes', 650, 240);
    const notesPanel = page.getByRole('dialog', { name: 'Notes panel' });
    await expect(notesPanel).toBeVisible();
    await expect(notesPanel).toHaveAttribute('data-workspace-panel-state', 'floating');
    const notesInitialBox = await notesPanel.boundingBox();
    expect(notesInitialBox).not.toBeNull();
    expect(notesInitialBox!.width).toBeLessThanOrEqual(580);
    expect(notesInitialBox!.height).toBeLessThanOrEqual(400);

    await shrinkFromBottomRight('Notes panel', -300, -200);
    await expect(notesPanel).toHaveAttribute('data-panel-compact', 'true');
    await expect(notesPanel.locator('[data-note-titlebar-controls="true"]')).toBeVisible();
    await expect(notesPanel.locator('[data-note-toolbar="true"]')).toBeHidden();
    await expect(notesPanel.locator('[data-note-new-button="true"]')).toBeVisible();
    await expect(notesPanel.locator('[data-note-new-button-label="true"]')).toHaveCount(0);
    await expect(notesPanel.locator('[data-note-toolbar-title="true"]')).toBeHidden();
    await expect(notesPanel.locator('[data-note-template-button="true"]')).toHaveCount(0);
    await notesPanel.locator('[data-note-new-button="true"]').click();
    await expect(notesPanel.locator('[data-note-compact-editor="true"]')).toBeVisible();
    await expect(notesPanel.locator('[data-note-compact-title="true"]')).toBeVisible();
    await expect(notesPanel.locator('[data-note-compact-body="true"]')).toBeVisible();
    await expect(notesPanel.getByRole('button', { name: 'Edit mode' })).toHaveCount(0);
    await expect(notesPanel.getByRole('button', { name: 'Split mode' })).toHaveCount(0);
    await expect(notesPanel.getByRole('button', { name: 'Preview mode' })).toHaveCount(0);
    await expect(notesPanel.getByText('No investigation')).toHaveCount(0);
    await expect(notesPanel.getByText(/words, .* chars/)).toHaveCount(0);
    await expect(notesPanel.getByText('Created')).toHaveCount(0);
    await expect(notesPanel.getByText('Modified')).toHaveCount(0);
    await notesPanel.locator('[data-note-compact-title="true"]').fill('Compact workspace note');
    await notesPanel.locator('[data-note-compact-body="true"]').fill('Compact workspace body');
    await notesPanel.locator('[data-note-sort-button="true"]').click();
    await expect(notesPanel.locator('[data-note-sort-menu="true"]')).toBeVisible();
    const notesCompactBox = await notesPanel.boundingBox();
    expect(notesCompactBox).not.toBeNull();
    expect(notesCompactBox!.width).toBeLessThanOrEqual(350);
    expect(notesCompactBox!.height).toBeLessThanOrEqual(280);

    await openFromSidebar('Tasks', 700, 260);
    const tasksPanel = page.getByRole('dialog', { name: 'Tasks panel' });
    await expect(tasksPanel).toBeVisible();
    await expect(tasksPanel).toHaveAttribute('data-workspace-panel-state', 'floating');
    const tasksInitialBox = await tasksPanel.boundingBox();
    expect(tasksInitialBox).not.toBeNull();
    expect(tasksInitialBox!.width).toBeLessThanOrEqual(380);
    expect(tasksInitialBox!.height).toBeLessThanOrEqual(360);
    const tasksSourceSlot = page.locator('[data-workspace-panel="tasks-workspace"][data-workspace-panel-state="floating-source"]');
    await expect(tasksSourceSlot).toHaveAttribute('data-workspace-panel-source-compact', 'true');
    await expect(tasksSourceSlot.getByText('This pane is popped out in the workspace.')).toHaveCount(0);
    await expect(tasksSourceSlot.getByRole('button', { name: 'Return Tasks to main workspace from source slot' })).toBeVisible();
    const tasksSourceBox = await tasksSourceSlot.boundingBox();
    expect(tasksSourceBox).not.toBeNull();
    expect(tasksSourceBox!.width).toBeLessThanOrEqual(240);
    expect(tasksSourceBox!.height).toBeLessThanOrEqual(48);

    await shrinkFromBottomRight('Tasks panel', -220, -180);
    await expect(tasksPanel).toHaveAttribute('data-panel-compact', 'true');
    await expect(tasksPanel.locator('[data-task-titlebar-controls="true"]')).toBeVisible();
    await expect(tasksPanel.locator('[data-task-toolbar="true"]')).toBeHidden();
    await expect(tasksPanel.locator('[data-task-new-button="true"]')).toBeVisible();
    await expect(tasksPanel.locator('[data-task-new-button-label="true"]')).toHaveCount(0);
    await expect(tasksPanel.locator('[data-task-toolbar-title="true"]')).toBeHidden();
    await expect(tasksPanel.locator('[data-task-toolbar-filters="true"]')).toBeHidden();
    await expect(tasksPanel.locator('[data-workspace-panel-primary-action="true"]')).toHaveAttribute('data-workspace-panel-primary-action-text-visible', 'false');
    await expect(tasksPanel.locator('[data-task-compact-list="true"]')).toBeVisible();
    await expect(tasksPanel.locator('[data-task-compact-list="true"]')).toHaveCSS('overflow-y', 'auto');
    await expect(tasksPanel.locator(`[title="${compactTaskTitle}"]`).first()).toBeVisible();
    await expect(tasksPanel.locator('[data-task-checklist="true"]')).toBeVisible();
    await expect(tasksPanel.locator('[data-task-checklist-item="true"]')).toHaveCount(2);
    await tasksPanel.locator('[data-task-checklist-toggle="true"]').click();
    await expect(tasksPanel.locator('[data-task-checklist="true"]')).toHaveCount(0);
    await tasksPanel.locator('[data-task-checklist-toggle="true"]').click();
    await expect(tasksPanel.locator('[data-task-checklist="true"]')).toBeVisible();
    await tasksPanel.locator('[data-task-content="true"]').click({ position: { x: 6, y: 6 } });
    await expect(tasksPanel.locator('[data-task-checklist="true"]')).toBeVisible();
    const tasksCompactBox = await tasksPanel.boundingBox();
    expect(tasksCompactBox).not.toBeNull();
    expect(tasksCompactBox!.width).toBeLessThanOrEqual(330);
    expect(tasksCompactBox!.height).toBeLessThanOrEqual(280);
    const emptyHeaderPoint = await tasksPanel.locator('[data-workspace-panel-header="true"]').evaluate((header) => {
      const rect = header.getBoundingClientRect();
      const blockers = Array.from(header.querySelectorAll<HTMLElement>('button, [data-workspace-panel-no-drag="true"]'))
        .map((element) => element.getBoundingClientRect());
      const y = rect.top + rect.height / 2;
      for (let x = rect.left + 40; x <= rect.right - 40; x += 8) {
        const blocked = blockers.some((blocker) => x >= blocker.left - 2 && x <= blocker.right + 2 && y >= blocker.top - 2 && y <= blocker.bottom + 2);
        if (!blocked) return { x, y };
      }
      return null;
    });
    expect(emptyHeaderPoint).not.toBeNull();
    await page.mouse.move(emptyHeaderPoint!.x, emptyHeaderPoint!.y);
    await page.mouse.down();
    await page.mouse.move(emptyHeaderPoint!.x + 34, emptyHeaderPoint!.y + 18, { steps: 6 });
    await page.mouse.up();
    const tasksDraggedBox = await tasksPanel.boundingBox();
    expect(tasksDraggedBox).not.toBeNull();
    const dragDelta = Math.abs(tasksDraggedBox!.x - tasksCompactBox!.x) + Math.abs(tasksDraggedBox!.y - tasksCompactBox!.y);
    expect(dragDelta).toBeGreaterThan(20);

    await expect(page.locator('[data-workspace-panel="chat-workspace"]')).toHaveCount(0);
    await expect(page.locator('[data-workspace-panel="agentcaddy-workspace"]')).toHaveCount(0);
    expect(blockedSideEffectRequests).toEqual([]);
  });

  test('switches existing notes from the compact Notes history selector', async ({ page }) => {
    const blockedSideEffectRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (
        /127\.0\.0\.1:(8766|11434)/.test(url)
        || /localhost:(8766|11434)/.test(url)
        || /\/skills(?:\?|$)/.test(url)
        || /\/execute(?:\?|$)/.test(url)
        || /\/api\/caddy-agents(?:\/|\?|$)/.test(url)
      ) {
        blockedSideEffectRequests.push(url);
      }
    });

    await createInvestigation(page, 'Compact Notes History Case');
    await navigateToView(page, 'Notes');
    await createQuickNote(page);
    await page.getByPlaceholder('Note title...').fill('Older compact note');
    await page.getByPlaceholder('Start writing in markdown...').or(page.locator('textarea[aria-label="Note content editor"]')).first().fill('Older compact body');
    await page.waitForTimeout(700);
    await createQuickNote(page);
    await page.getByPlaceholder('Note title...').fill('Current compact note');
    await page.getByPlaceholder('Start writing in markdown...').or(page.locator('textarea[aria-label="Note content editor"]')).first().fill('Current compact body');
    await page.waitForTimeout(700);

    await navigateToView(page, 'Workspace');
    await dragSidebarItemIntoWorkspace(page, 'Notes', 650, 240);
    const panel = page.getByRole('dialog', { name: 'Notes panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-panel-compact', 'true');
    const historySelect = panel.getByLabel('Select existing note');
    await expect(historySelect).toBeVisible();
    await expect(panel.locator('[data-note-toolbar="true"]')).toBeHidden();
    await historySelect.selectOption({ label: 'Current compact note' });
    await expect(panel.locator('[data-note-compact-title="true"]')).toHaveValue('Current compact note');

    const olderOption = historySelect.locator('option').filter({ hasNotText: 'Current compact note' }).first();
    await expect(olderOption).toHaveCount(1);
    const olderOptionLabel = await olderOption.textContent();
    const olderOptionValue = await olderOption.getAttribute('value');
    expect(olderOptionValue).toBeTruthy();

    await historySelect.selectOption(olderOptionValue!);

    await expect(panel.locator('[data-note-compact-title="true"]')).toHaveValue(olderOptionLabel?.trim() || 'Untitled Note');
    await expect(page.locator('[data-workspace-panel="chat-workspace"]')).toHaveCount(0);
    await expect(page.locator('[data-workspace-panel="agentcaddy-workspace"]')).toHaveCount(0);
    expect(blockedSideEffectRequests).toEqual([]);
  });

  test('returns from compact Notes edit/create to the selector after apply', async ({ page }) => {
    const blockedSideEffectRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (
        /127\.0\.0\.1:(8766|11434)/.test(url)
        || /localhost:(8766|11434)/.test(url)
        || /\/skills(?:\?|$)/.test(url)
        || /\/execute(?:\?|$)/.test(url)
        || /\/api\/caddy-agents(?:\/|\?|$)/.test(url)
      ) {
        blockedSideEffectRequests.push(url);
      }
    });

    await createInvestigation(page, 'Compact Notes Apply Back Case');
    await navigateToView(page, 'Notes');
    await createQuickNote(page);
    await page.getByPlaceholder('Note title...').fill('Existing apply-back compact note');
    await page.getByPlaceholder('Start writing in markdown...').or(page.locator('textarea[aria-label="Note content editor"]')).first().fill('Existing apply-back compact body');
    await page.waitForTimeout(700);

    await navigateToView(page, 'Workspace');
    await dragSidebarItemIntoWorkspace(page, 'Notes', 650, 240);
    const panel = page.getByRole('dialog', { name: 'Notes panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-panel-compact', 'true');

    await panel.getByLabel('Select existing note').selectOption({ label: 'Existing apply-back compact note' });
    await expect(panel.locator('[data-note-compact-editor="true"]')).toBeVisible();
    await panel.locator('[data-note-compact-title="true"]').fill('Edited apply-back compact note');
    await panel.locator('[data-note-compact-body="true"]').fill('Edited apply-back compact body');
    await panel.locator('[data-note-compact-apply-back="true"]').click();

    await expect(panel.locator('[data-note-compact-editor="true"]')).toHaveCount(0);
    await expect(panel.locator('[data-note-history-select="true"]')).toBeVisible();
    await expect(panel.getByRole('button', { name: /Edited apply-back compact note/ })).toBeVisible({ timeout: 5_000 });

    await panel.getByLabel('Select existing note').selectOption({ label: 'Edited apply-back compact note' });
    await expect(panel.locator('[data-note-compact-title="true"]')).toHaveValue('Edited apply-back compact note');
    await expect(panel.locator('[data-note-compact-body="true"]')).toHaveValue('Edited apply-back compact body');
    await panel.locator('[data-note-compact-apply-back="true"] svg').click();

    await expect(panel.locator('[data-note-compact-editor="true"]')).toHaveCount(0);
    await panel.locator('[data-note-new-button="true"] svg').click();
    await expect(panel.locator('[data-note-compact-editor="true"]')).toBeVisible();
    await panel.locator('[data-note-compact-title="true"]').fill('Apply back compact note');
    await panel.locator('[data-note-compact-body="true"]').fill('Apply back compact body');
    await panel.locator('[data-note-compact-apply-back="true"] svg').click();

    await expect(panel.locator('[data-note-compact-editor="true"]')).toHaveCount(0);
    await expect(panel.locator('[data-note-history-select="true"]')).toBeVisible();
    await expect(panel.getByRole('button', { name: /Apply back compact note/ })).toBeVisible({ timeout: 5_000 });

    await panel.getByLabel('Select existing note').selectOption({ label: 'Apply back compact note' });
    await expect(panel.locator('[data-note-compact-title="true"]')).toHaveValue('Apply back compact note');
    await expect(panel.locator('[data-note-compact-body="true"]')).toHaveValue('Apply back compact body');
    expect(blockedSideEffectRequests).toEqual([]);
  });

  test('shrinks audited workspace panels to compact button-safe chrome without topbar overlap', async ({ page }) => {
    test.setTimeout(90_000);
    const blockedSideEffectRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (
        /127\.0\.0\.1:(8766|11434)/.test(url)
        || /localhost:(8766|11434)/.test(url)
        || /\/skills(?:\?|$)/.test(url)
        || /\/execute(?:\?|$)/.test(url)
        || /\/api\/caddy-agents(?:\/|\?|$)/.test(url)
      ) {
        blockedSideEffectRequests.push(url);
      }
    });

    await page.evaluate(() => localStorage.setItem('caddyai-onboarded', '1'));
    await createInvestigation(page, 'Workspace Compact Audit Panels Case');

    const panelChecks = [
      { view: 'Products', panelName: 'Products panel', popOut: 'Pop out Products', returnLabel: 'Return Products to main workspace', minimize: 'Minimize Products', close: 'Close Products workspace panel' },
      { view: 'Evidence', panelName: 'Evidence panel', popOut: 'Pop out Evidence', returnLabel: 'Return Evidence to main workspace', minimize: 'Minimize Evidence', close: 'Close Evidence workspace panel' },
      { view: 'Timeline', panelName: 'Timeline panel', popOut: 'Pop out Timeline', returnLabel: 'Return Timeline to main workspace', minimize: 'Minimize Timeline', close: 'Close Timeline workspace panel' },
      { view: 'Whiteboards', panelName: 'Whiteboards panel', popOut: 'Pop out Whiteboards', returnLabel: 'Return Whiteboards to main workspace', minimize: 'Minimize Whiteboards', close: 'Close Whiteboards workspace panel' },
      { view: 'IOCs', panelName: 'IOCs panel', popOut: 'Pop out IOCs', returnLabel: 'Return IOCs to main workspace', minimize: 'Minimize IOCs', close: 'Close IOCs workspace panel' },
      { view: 'Graph', panelName: 'Graph panel', popOut: 'Pop out Graph', returnLabel: 'Return Graph to main workspace', minimize: 'Minimize Graph', close: 'Close Graph workspace panel' },
      { view: 'Team Feed', panelName: 'CaddyShack panel', popOut: 'Pop out CaddyShack', returnLabel: 'Return CaddyShack to main workspace', minimize: 'Minimize CaddyShack', close: 'Close CaddyShack workspace panel' },
      { view: 'CaddyShack', panelName: 'CaddyShack workbench panel', popOut: 'Pop out CaddyShack workbench', returnLabel: 'Return CaddyShack workbench to main workspace', minimize: 'Minimize CaddyShack workbench', close: 'Close CaddyShack workbench workspace panel' },
      { view: 'AgentCaddy', panelName: 'AgentCaddy panel', popOut: 'Pop out AgentCaddy', returnLabel: 'Return AgentCaddy to main workspace', minimize: 'Minimize AgentCaddy', close: 'Close AgentCaddy workspace panel' },
      { view: 'CaddyAI', panelName: 'CaddyAI panel', popOut: 'Pop out CaddyAI', returnLabel: 'Return CaddyAI to main workspace', minimize: 'Minimize CaddyAI', close: 'Close CaddyAI workspace panel' },
    ] as const;

    for (const check of panelChecks) {
      await navigateToView(page, check.view);
      if (check.view === 'Team Feed') {
        const gotItButton = page.getByRole('button', { name: 'Got it' });
        await gotItButton.click({ timeout: 5_000 }).catch(() => undefined);
      }
      await page.getByRole('button', { name: check.popOut, exact: true }).click();
      const panel = page.getByRole('dialog', { name: check.panelName, exact: true });
      await expect(panel).toBeVisible();
      await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');

      await shrinkPanelToMinimum(page, panel, check.panelName);
      await expect(panel.getByRole('button', { name: check.returnLabel, exact: true })).toBeVisible();
      await expect(panel.getByRole('button', { name: check.minimize, exact: true })).toBeVisible();
      await expect(panel.getByRole('button', { name: check.close, exact: true })).toBeVisible();
      await expect(panel.locator('[data-workspace-panel-primary-action="true"]')).toHaveAttribute(
        'data-workspace-panel-primary-action-text-visible',
        'false',
      );
      await expect.poll(async () => panel.locator('[data-workspace-panel-header="true"]').evaluate((header) => {
        return Array.from(header.querySelectorAll<HTMLElement>('span'))
          .filter((element) => element.textContent?.trim() === 'Dock')
          .some((element) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 0
              && rect.height > 0
              && style.visibility !== 'hidden'
              && style.display !== 'none';
          });
      })).toBe(false);
      await expectHeaderControlsDoNotOverlap(panel);

      await panel.getByRole('button', { name: check.close, exact: true }).click();
      await expect(panel).toHaveCount(0);
    }

    expect(blockedSideEffectRequests).toEqual([]);
  });

  test('keeps the Activity workspace panel isolated from non-Workspace navigation', async ({ page }) => {
    await createInvestigation(page, 'Activity Panel Case');
    await navigateToView(page, 'Activity');

    await expect(page.getByRole('heading', { name: 'Activity Log' })).toBeVisible();
    await page.getByRole('button', { name: 'Pop out Activity' }).click();

    const panel = page.getByRole('dialog', { name: 'Activity panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByRole('heading', { name: 'Activity Log' })).toBeVisible();
    await expect(panel.getByRole('textbox', { name: 'Search activity log' })).toBeVisible();

    await expectPanelHidesOnNotesRouteAndReturnsToWorkspace(page, panel);

    await panel.getByRole('button', { name: 'Minimize Activity' }).click();
    await restoreMinimizedPanelFromInlineRollup(page, 'Restore Activity panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByRole('heading', { name: 'Activity Log' })).toBeVisible();
  });

  test('keeps the Products workspace panel isolated from non-Workspace navigation', async ({ page }) => {
    await createInvestigation(page, 'Products Panel Case');
    await navigateToView(page, 'Products');

    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Pop out Products' }).click();

    const panel = page.getByRole('dialog', { name: 'Products panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByRole('heading', { name: 'Products', exact: true })).toBeVisible();
    await expect(panel.getByRole('textbox', { name: 'Search products' })).toBeVisible();

    await panel.getByRole('button', { name: 'Baselines' }).click();
    const baselinesDialog = page.getByRole('dialog', { name: 'Product Baselines' });
    await expect(baselinesDialog).toBeVisible();
    await baselinesDialog.getByRole('button', { name: 'Close' }).click();
    await expect(baselinesDialog).not.toBeVisible();
    await expect.poll(async () => page.evaluate('document.body.style.overflow')).not.toBe('hidden');

    await expectPanelHidesOnNotesRouteAndReturnsToWorkspace(page, panel);

    await panel.getByRole('button', { name: 'Minimize Products' }).click();
    await restoreMinimizedPanelFromInlineRollup(page, 'Restore Products panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByRole('heading', { name: 'Products', exact: true })).toBeVisible();
  });

  test('keeps the Notes panel usable and preserves pending editor text across minimize and restore', async ({ page }) => {
    await createInvestigation(page, 'Notes Panel Case');
    await navigateToView(page, 'Notes');
    await createQuickNote(page);

    const titleInput = page.getByPlaceholder('Note title...');
    await expect(titleInput).toBeVisible({ timeout: 5_000 });
    await titleInput.fill('Notes panel smoke note');
    await page.waitForTimeout(700);

    const editor = page.getByPlaceholder('Start writing in markdown...').or(
      page.locator('textarea[aria-label="Note content editor"]'),
    ).first();
    await editor.fill('Initial Notes panel content');

    await page.getByRole('button', { name: 'Pop out Notes' }).click();

    const panel = page.getByRole('dialog', { name: 'Notes panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByRole('button', { name: 'Create blank note' })).toBeVisible();

    const panelEditor = panel.getByPlaceholder('Start writing in markdown...').or(
      panel.locator('textarea[aria-label="Note content editor"]'),
    ).first();
    await expect(panelEditor).toHaveValue('Initial Notes panel content', { timeout: 5_000 });

    await panelEditor.fill('Unsaved Notes panel content survives minimize');
    await panel.getByRole('button', { name: 'Minimize Notes' }).click();

    await restoreMinimizedPanelFromInlineRollup(page, 'Restore Notes panel');

    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    const restoredHistorySelect = panel.locator('[data-note-history-select="true"]');
    await expect(restoredHistorySelect).toBeVisible();
    await restoredHistorySelect.selectOption({ label: 'Notes panel smoke note' });
    await expect(panel.locator('[data-note-compact-body="true"]')).toHaveValue('Unsaved Notes panel content survives minimize', { timeout: 5_000 });

    await navigateToView(page, 'Products');
    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible();
    await expect(panel).toBeHidden();

    await navigateToView(page, 'Workspace');
    await expect(panel).toBeVisible();
    const historySelect = panel.locator('[data-note-history-select="true"]');
    await expect(historySelect).toBeVisible();
    await historySelect.selectOption({ label: 'Notes panel smoke note' });
    await expect(panel.locator('[data-note-compact-body="true"]')).toHaveValue('Unsaved Notes panel content survives minimize', { timeout: 5_000 });
  });

  test('keeps the Tasks workspace panel isolated from non-Workspace navigation', async ({ page }) => {
    await createInvestigation(page, 'Tasks Panel Case');
    await navigateToView(page, 'Tasks');
    await expect(page.getByRole('button', { name: 'New task' })).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Pop out Tasks' }).click();
    const panel = page.getByRole('dialog', { name: 'Tasks panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByRole('button', { name: 'New task' })).toBeVisible();

    await expectPanelHidesOnNotesRouteAndReturnsToWorkspace(page, panel);

    await panel.getByRole('button', { name: 'Minimize Tasks' }).click();
    await restoreMinimizedPanelFromInlineRollup(page, 'Restore Tasks panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByRole('button', { name: 'New task' })).toBeVisible();
  });

  test('keeps the Evidence workspace panel isolated from non-Workspace navigation', async ({ page }) => {
    await createInvestigation(page, 'Evidence Panel Case');
    await navigateToView(page, 'Evidence');

    await expect(page.getByRole('heading', { name: 'Evidence', exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('No evidence yet')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import' })).toBeVisible();

    await page.getByRole('button', { name: 'Pop out Evidence' }).click();
    const panel = page.getByRole('dialog', { name: 'Evidence panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByText('No evidence yet')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Import' })).toBeVisible();

    await expectPanelHidesOnNotesRouteAndReturnsToWorkspace(page, panel);

    await panel.getByRole('button', { name: 'Minimize Evidence' }).click();
    await restoreMinimizedPanelFromInlineRollup(page, 'Restore Evidence panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByText('No evidence yet')).toBeVisible();
  });

  test('keeps the Timeline workspace panel isolated from non-Workspace navigation', async ({ page }) => {
    await createInvestigation(page, 'Timeline Panel Case');
    await navigateToView(page, 'Timeline');

    await expect(page.getByText('No timeline events yet').first()).toBeVisible();
    await expect(page.getByPlaceholder('Search events...')).toBeVisible();

    await page.getByRole('button', { name: 'Pop out Timeline' }).click();
    const panel = page.getByRole('dialog', { name: 'Timeline panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByText('No timeline events yet').first()).toBeVisible();
    await expect(panel.getByPlaceholder('Search events...')).toBeVisible();

    await expectPanelHidesOnNotesRouteAndReturnsToWorkspace(page, panel);

    await panel.getByRole('button', { name: 'Minimize Timeline' }).click();
    await restoreMinimizedPanelFromInlineRollup(page, 'Restore Timeline panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByText('No timeline events yet').first()).toBeVisible();
  });

  test('keeps the Graph workspace panel isolated from non-Workspace navigation', async ({ page }) => {
    await createInvestigation(page, 'Graph Panel Case');
    await navigateToView(page, 'Graph');

    await expect(page.getByText('Entity Graph')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByPlaceholder('Search nodes...')).toBeVisible();
    await expect(page.getByText('No entities to display')).toBeVisible();

    await page.getByRole('button', { name: 'Pop out Graph' }).click();
    const panel = page.getByRole('dialog', { name: 'Graph panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByText('Entity Graph')).toBeVisible();
    await expect(panel.getByPlaceholder('Search nodes...')).toBeVisible();
    await expect(panel.getByText('No entities to display')).toBeVisible();

    await expectPanelHidesOnNotesRouteAndReturnsToWorkspace(page, panel);
    await expect(panel.getByText('Entity Graph')).toBeVisible();

    await panel.getByRole('button', { name: 'Minimize Graph' }).click();
    await restoreMinimizedPanelFromInlineRollup(page, 'Restore Graph panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByText('Entity Graph')).toBeVisible();
  });

  test('keeps the Whiteboards panel alive and preserves pending title saves across minimize and restore', async ({ page }) => {
    await createInvestigation(page, 'Whiteboards Panel Case');
    await navigateToView(page, 'Whiteboards');

    await expect(page.getByRole('heading', { name: 'Whiteboards' })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'New', exact: true }).click();

    const titleInput = page.getByPlaceholder('Whiteboard name');
    await expect(titleInput).toBeVisible({ timeout: 10_000 });
    await titleInput.fill('Whiteboards panel smoke board');

    await page.getByRole('button', { name: 'Pop out Whiteboards' }).click();
    const panel = page.getByRole('dialog', { name: 'Whiteboards panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByPlaceholder('Whiteboard name')).toHaveValue('Whiteboards panel smoke board');

    await panel.getByRole('button', { name: 'Minimize Whiteboards' }).click();
    await restoreMinimizedPanelFromInlineRollup(page, 'Restore Whiteboards panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByPlaceholder('Whiteboard name')).toHaveValue('Whiteboards panel smoke board', { timeout: 5_000 });

    await expectPanelHidesOnNotesRouteAndReturnsToWorkspace(page, panel);
    await expect(panel).toBeVisible();
    await expect(panel.getByPlaceholder('Whiteboard name')).toHaveValue('Whiteboards panel smoke board');
  });

  test('keeps the CaddyShack workspace panel isolated from non-Workspace navigation while disconnected', async ({ page }) => {
    await navigateToView(page, 'Team Feed');

    const gotItButton = page.getByRole('button', { name: 'Got it' });
    if (await gotItButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await gotItButton.click();
    }

    await expect(page.getByText('Connect to a team server to use Team Feed.')).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Pop out CaddyShack' }).click();
    const panel = page.getByRole('dialog', { name: 'CaddyShack panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByText('Connect to a team server to use Team Feed.')).toBeVisible();

    await expectPanelHidesOnNotesRouteAndReturnsToWorkspace(page, panel);

    await panel.getByRole('button', { name: 'Minimize CaddyShack' }).click();
    await restoreMinimizedPanelFromInlineRollup(page, 'Restore CaddyShack panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByText('Connect to a team server to use Team Feed.')).toBeVisible();
  });

  test('keeps the IOCs workspace panel isolated from non-Workspace navigation', async ({ page }) => {
    await navigateToView(page, 'IOCs');

    await expect(page.getByText('No IOCs yet')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: 'New IOC' }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Pop out IOCs' }).click();
    const panel = page.getByRole('dialog', { name: 'IOCs panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByText('No IOCs yet')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'New IOC' }).first()).toBeVisible();

    await expectPanelHidesOnNotesRouteAndReturnsToWorkspace(page, panel);

    await panel.getByRole('button', { name: 'Minimize IOCs' }).click();
    await restoreMinimizedPanelFromInlineRollup(page, 'Restore IOCs panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByText('No IOCs yet')).toBeVisible();
  });

  test('keeps the CaddyShack workbench workspace panel isolated from non-Workspace navigation', async ({ page }) => {
    await navigateToView(page, 'CaddyShack');

    await expect(page.getByText('CaddyShack workbench').first()).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Pop out CaddyShack workbench' }).click();
    const panel = page.getByRole('dialog', { name: 'CaddyShack workbench panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');

    await panel.getByRole('button', { name: 'Open request form' }).first().click();
    const researchQuestion = panel.getByRole('textbox', { name: 'Research question' });
    await expect(researchQuestion).toBeVisible();
    await researchQuestion.fill('Workbench panel smoke draft');
    await expect(panel.getByRole('textbox', { name: 'Research question' })).toHaveValue('Workbench panel smoke draft');

    await expectPanelHidesOnNotesRouteAndReturnsToWorkspace(page, panel);
    await expect(panel.getByRole('textbox', { name: 'Research question' })).toHaveValue('Workbench panel smoke draft');

    await panel.getByRole('button', { name: 'Minimize CaddyShack workbench' }).click();
    await restoreMinimizedPanelFromInlineRollup(page, 'Restore CaddyShack workbench panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByText('CaddyShack workbench').first()).toBeVisible();
  });

  test('keeps the AgentCaddy workspace panel isolated from non-Workspace navigation without running agents', async ({ page }) => {
    const blockedSideEffectRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (
        /127\.0\.0\.1:(8766|11434)/.test(url)
        || /localhost:(8766|11434)/.test(url)
        || /\/skills(?:\?|$)/.test(url)
        || /\/execute(?:\?|$)/.test(url)
        || /\/api\/caddy-agents(?:\/|\?|$)/.test(url)
      ) {
        blockedSideEffectRequests.push(url);
      }
    });

    await navigateToView(page, 'AgentCaddy');

    await expect(page.getByRole('heading', { name: 'AgentCaddy', exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Get started with AgentCaddy')).toBeVisible();
    await expect(page.getByText('No active agents')).toBeVisible();

    await page.getByRole('button', { name: 'Pop out AgentCaddy' }).click();
    const panel = page.getByRole('dialog', { name: 'AgentCaddy panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByText('Get started with AgentCaddy')).toBeVisible();
    await expect(panel.getByText('No active agents')).toBeVisible();

    await expectPanelHidesOnNotesRouteAndReturnsToWorkspace(page, panel);
    await expect(panel.getByText('No active agents')).toBeVisible();

    await panel.getByRole('button', { name: 'Minimize AgentCaddy' }).click();
    await restoreMinimizedPanelFromInlineRollup(page, 'Restore AgentCaddy panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    await expect(panel.getByText('No active agents')).toBeVisible();
    expect(blockedSideEffectRequests).toEqual([]);
  });

  test('keeps the CaddyAI workspace panel isolated from non-Workspace navigation without sending LLM requests', async ({ page }) => {
    const blockedSideEffectRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (
        /127\.0\.0\.1:(8766|11434)/.test(url)
        || /localhost:(8766|11434)/.test(url)
        || /\/skills(?:\?|$)/.test(url)
        || /\/execute(?:\?|$)/.test(url)
        || /\/api\/caddy-agents(?:\/|\?|$)/.test(url)
      ) {
        blockedSideEffectRequests.push(url);
      }
    });

    await page.evaluate(() => {
      const target = globalThis as unknown as {
        __tcLlmRequestCount?: number;
        __tcLlmAbortCount?: number;
        __tcOriginalPostMessage?: (...args: unknown[]) => void;
        postMessage: (...args: unknown[]) => void;
      };
      target.__tcLlmRequestCount = 0;
      target.__tcLlmAbortCount = 0;
      if (!target.__tcOriginalPostMessage) {
        target.__tcOriginalPostMessage = target.postMessage.bind(target);
        target.postMessage = (message: unknown, ...args: unknown[]) => {
          if (typeof message === 'object' && message !== null && 'type' in message) {
            const messageType = (message as { type?: unknown }).type;
            if (messageType === 'TC_LLM_REQUEST') {
              target.__tcLlmRequestCount = (target.__tcLlmRequestCount ?? 0) + 1;
            }
            if (messageType === 'TC_LLM_ABORT') {
              target.__tcLlmAbortCount = (target.__tcLlmAbortCount ?? 0) + 1;
            }
          }
          return target.__tcOriginalPostMessage?.(message, ...args);
        };
      }
    });

    await page.evaluate(() => localStorage.setItem('caddyai-onboarded', '1'));
    await navigateToView(page, 'CaddyAI');

    await expect(page.getByText('CaddyAI').first()).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Pop out CaddyAI' }).click();
    const panel = page.getByRole('dialog', { name: 'CaddyAI panel' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
    const [headerBox, panelBox] = await Promise.all([
      page.locator('[data-tour="header"]').boundingBox(),
      panel.boundingBox(),
    ]);
    expect(panelBox).not.toBeNull();
    expect(headerBox).not.toBeNull();
    expect(panelBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);

    await expectPanelHidesOnNotesRouteAndReturnsToWorkspace(page, panel);

    await panel.getByRole('button', { name: 'Minimize CaddyAI' }).click();
    await restoreMinimizedPanelFromInlineRollup(page, 'Restore CaddyAI panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');

    await expect.poll(
      () => page.evaluate(() => (globalThis as { __tcLlmRequestCount?: number }).__tcLlmRequestCount ?? 0),
    ).toBe(0);
    await expect.poll(
      () => page.evaluate(() => (globalThis as { __tcLlmAbortCount?: number }).__tcLlmAbortCount ?? 0),
    ).toBe(0);
    expect(blockedSideEffectRequests).toEqual([]);
  });
});

async function workspaceGridOptions(panel: Locator) {
  const raw = await panel.getAttribute('data-workspace-snap-grid-options');
  return (raw ?? '').split(/\s+/).filter(Boolean);
}

async function workspaceGridTarget(page: Page, {
  insetX,
  insetY,
}: {
  insetX: number;
  insetY: number;
}) {
  return page.evaluate(({ insetX: targetInsetX, insetY: targetInsetY }) => {
    const explicitCanvases = visibleWorkspaceRects('[data-workspace-mosaic-canvas="true"]');
    const canvases = explicitCanvases.length > 0 ? explicitCanvases : visibleWorkspaceRects(
      '[data-app-workspace-home="true"], [data-app-workspace-pane="active"], [data-assistantcaddy-shell-pane="active"]',
    );
    function visibleWorkspaceRects(selector: string) {
      return Array.from(document.querySelectorAll<HTMLElement>(selector)).flatMap((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width >= 320 && rect.height >= 240 && rect.bottom > 0 && rect.right > 0 ? [rect] : [];
      });
    }
    if (canvases.length > 0) {
      const top = Math.min(...canvases.map((rect) => rect.top));
      const right = Math.max(...canvases.map((rect) => rect.right));
      const bottom = Math.max(...canvases.map((rect) => rect.bottom));
      return {
        x: right - targetInsetX,
        y: top + (bottom - top) * targetInsetY,
      };
    }

    return {
      x: window.innerWidth - targetInsetX,
      y: window.innerHeight * targetInsetY,
    };
  }, { insetX, insetY });
}

async function expectTitlebarControlsInsideHeader(panel: Locator) {
  await expect.poll(async () => panel.evaluate((panelElement) => {
    const header = panelElement.querySelector('[data-workspace-panel-header="true"]');
    if (!(header instanceof HTMLElement)) return false;
    const headerRect = header.getBoundingClientRect();
    const controls = Array.from(header.querySelectorAll<HTMLElement>('button, [role="button"]'))
      .filter((control) => {
        const rect = control.getBoundingClientRect();
        const style = window.getComputedStyle(control);
        return rect.width > 0
          && rect.height > 0
          && style.visibility !== 'hidden'
          && style.display !== 'none';
      });

    if (controls.length === 0) return false;

    const controlsInsideHeader = controls.every((control) => {
      const rect = control.getBoundingClientRect();
      return rect.left >= headerRect.left - 1
        && rect.right <= headerRect.right + 1
        && rect.top >= headerRect.top - 1
        && rect.bottom <= headerRect.bottom + 1;
    });
    if (!controlsInsideHeader) return false;

    return controls.every((control, index) => {
      const rect = control.getBoundingClientRect();
      return controls.slice(index + 1).every((nextControl) => {
        const nextRect = nextControl.getBoundingClientRect();
        const xOverlap = Math.max(0, Math.min(rect.right, nextRect.right) - Math.max(rect.left, nextRect.left));
        const yOverlap = Math.max(0, Math.min(rect.bottom, nextRect.bottom) - Math.max(rect.top, nextRect.top));
        return xOverlap * yOverlap <= 1;
      });
    });
  })).toBe(true);
}
