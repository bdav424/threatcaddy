import { expect, type Locator, type Page, test } from '@playwright/test';
import { createInvestigation, goToApp, navigateToView } from './fixtures';

const launchChecks = [
  { label: 'Notes', panelName: 'Notes panel', panelId: 'notes-workspace', controlName: 'Create blank note' },
  { label: 'Tasks', panelName: 'Tasks panel', panelId: 'tasks-workspace', controlName: 'New task' },
  { label: 'EmailCaddy', panelName: 'EmailCaddy panel', panelId: 'emailcaddy-workspace', controlName: 'Compose' },
  { label: 'CalendarCaddy', panelName: 'CalendarCaddy panel', panelId: 'calendarcaddy-workspace', selector: '[data-calendar-compact-titlebar="true"]' },
  { label: 'Evidence', panelName: 'Evidence panel', panelId: 'evidence-workspace' },
  { label: 'Timeline', panelName: 'Timeline panel', panelId: 'timeline-workspace' },
] as const;

type LaunchCheck = typeof launchChecks[number];

const snapChecks = launchChecks.filter((launch) => (
  launch.label === 'Notes'
  || launch.label === 'Tasks'
  || launch.label === 'EmailCaddy'
  || launch.label === 'CalendarCaddy'
));

const stickChecks = [
  { first: 'Notes', second: 'EmailCaddy' },
  { first: 'Notes', second: 'Tasks' },
  { first: 'Tasks', second: 'Evidence' },
  { first: 'EmailCaddy', second: 'CalendarCaddy' },
  { first: 'Tasks', second: 'Timeline' },
] as const satisfies ReadonlyArray<{ first: LaunchCheck['label']; second: LaunchCheck['label'] }>;

test.use({ serviceWorkers: 'block' });

test.describe('Workspace launch free placement', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 2200, height: 1900 });
    await goToApp(page);
  });

  for (const [index, launch] of launchChecks.entries()) {
    test(`places ${launch.label} freely like Notes without snap prompts`, async ({ page }) => {
      const blockedSideEffectRequests = captureBlockedSideEffectRequests(page);
      await createInvestigation(page, `Workspace Launch Free Placement ${launch.label}`);
      await navigateToView(page, 'Workspace');
      const canvas = await workspaceCanvasRect(page);
      const dropPoint = {
        x: canvas.left + Math.min(canvas.width - 280, 420 + index * 32),
        y: canvas.top + Math.min(canvas.height - 220, 220 + index * 18),
      };
      await dragSidebarItemIntoWorkspace(page, launch.label, dropPoint.x, dropPoint.y);
      await expect(page.locator('[data-workspace-snap-preview]')).toHaveCount(0);
      await expect(page.locator('[data-workspace-join-cue]')).toHaveCount(0);

      const panel = page.getByRole('dialog', { name: launch.panelName });
      await expect(panel).toBeVisible();
      await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
      await expect(panel).toHaveAttribute('data-workspace-panel-chrome', 'floating');
      await expect.poll(() => panel.getAttribute('data-workspace-panel-affixed')).toBeNull();
      await expect.poll(() => panel.getAttribute('data-workspace-panel-snap-grid')).toBeNull();
      await expect.poll(() => panel.getAttribute('data-workspace-panel-snap-zone')).toBeNull();
      await expect(page.locator(`[data-workspace-panel="${launch.panelId}"][data-workspace-panel-state="floating"]`)).toHaveCount(1);
      await expectPanelInsideWorkspaceCanvas(page, panel);

      if ('controlName' in launch && typeof launch.controlName === 'string') {
        await expect(panel.getByRole('button', { name: launch.controlName, exact: true })).toBeVisible();
      }
      if ('selector' in launch && typeof launch.selector === 'string') {
        await expect(panel.locator(launch.selector)).toBeVisible();
      }

      expect(blockedSideEffectRequests).toEqual([]);
    });
  }

  for (const launch of snapChecks) {
    for (const zone of ['right', 'top-left'] as const) {
      test(`snaps ${launch.label} to the ${zone} border after free launch`, async ({ page }) => {
        await createInvestigation(page, `Workspace Border Snap ${launch.label} ${zone}`);
        await navigateToView(page, 'Workspace');
        await freeLaunchAndSnapPanel(page, launch, zone);
      });
    }
  }

  for (const launch of snapChecks) {
    test(`snaps ${launch.label} to the right border at compact desktop width`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await goToApp(page);
      await createInvestigation(page, `Workspace Compact Border Snap ${launch.label}`);
      await navigateToView(page, 'Workspace');
      await freeLaunchAndSnapPanel(page, launch, 'right');
    });
  }

  for (const stick of stickChecks) {
    test(`sticks ${stick.second} to the nearest ${stick.first} seam without broad top allocation`, async ({ page }) => {
      await createInvestigation(page, `Workspace Click Stick ${stick.first} ${stick.second}`);
      await navigateToView(page, 'Workspace');
      await launchAndStickSecondPanel(page, launchByLabel(stick.first), launchByLabel(stick.second));
    });
  }
});

function captureBlockedSideEffectRequests(page: Page) {
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
  return blockedSideEffectRequests;
}

async function dragSidebarItemIntoWorkspace(page: Page, label: string, clientX: number, clientY: number) {
  const workspace = page.locator('[data-app-workspace-home="true"]');
  await expect(workspace).toBeVisible();
  const transfer = await page.evaluateHandle('new DataTransfer()');
  const navItem = page.locator('nav[aria-label="Views"] [role="button"]').filter({ hasText: label }).first();
  await expect(navItem).toHaveAttribute('title', `${label}: drag into Workspace`);
  await navItem.dispatchEvent('dragstart', { dataTransfer: transfer });
  await workspace.dispatchEvent('dragover', { dataTransfer: transfer, clientX, clientY });
  await expect(workspace).toHaveAttribute('data-workspace-drop-state', 'valid');
  await expect(page.locator('[data-workspace-snap-preview]')).toHaveCount(0);
  await expect(page.locator('[data-workspace-join-cue]')).toHaveCount(0);
  await workspace.dispatchEvent('drop', { dataTransfer: transfer, clientX, clientY });
  await transfer.dispose();
}

async function freeLaunchAndSnapPanel(page: Page, launch: LaunchCheck, zone: 'right' | 'top-left') {
  const canvas = await workspaceCanvasRect(page);
  await dragSidebarItemIntoWorkspace(page, launch.label, canvas.left + 360, canvas.top + 260);

  const panel = page.getByRole('dialog', { name: launch.panelName });
  await expect(panel).toHaveAttribute('data-workspace-panel-chrome', 'floating');
  await expect.poll(() => panel.getAttribute('data-workspace-panel-affixed')).toBeNull();
  await expect(page.getByRole('dialog')).toHaveCount(1);

  const header = panel.locator('[data-workspace-panel-header="true"]');
  const headerBox = await header.boundingBox();
  if (!headerBox) throw new Error(`${launch.label} panel header was not measurable for post-launch snap.`);
  const target = await snapTarget(page, zone);

  await page.mouse.move(headerBox.x + 24, headerBox.y + headerBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(headerBox.x + 140, headerBox.y + headerBox.height / 2, { steps: 4 });
  await page.mouse.move(target.x, target.y, { steps: 16 });
  const exactPreview = page.locator(`[data-workspace-snap-preview="${zone}"]`);
  if (!await exactPreview.isVisible({ timeout: 750 }).catch(() => false)) {
    await expect(page.locator('[data-workspace-snap-preview]').first()).toBeVisible();
  }
  const exactJoinCue = page.locator(`[data-workspace-join-cue-kind="workspace-edge"][data-workspace-join-cue-side="${joinCueSideForZone(zone)}"]`).first();
  if (!await exactJoinCue.isVisible({ timeout: 750 }).catch(() => false)) {
    await expect(page.locator('[data-workspace-join-cue]').first()).toBeVisible();
  }
  await expect(panel).toHaveAttribute('data-workspace-panel-chrome', 'floating');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.mouse.up();

  await expect(panel).toHaveAttribute('data-workspace-panel-chrome', 'snapped');
  await expect(panel).toHaveAttribute('data-workspace-panel-affixed', 'true');
  await expect(panel).toHaveAttribute('data-workspace-panel-snap-zone', zone);
  await expectPanelInsideWorkspaceCanvas(page, panel);
}

async function launchAndStickSecondPanel(page: Page, firstLaunch: LaunchCheck, secondLaunch: LaunchCheck) {
  const canvas = await workspaceCanvasRect(page);
  await dragSidebarItemIntoWorkspace(page, firstLaunch.label, canvas.left + 360, canvas.top + 260);
  const firstPanel = page.getByRole('dialog', { name: firstLaunch.panelName });
  await snapPanelToZone(page, firstPanel, 'top-left');
  await expect(firstPanel).toHaveAttribute('data-workspace-panel-chrome', 'snapped');
  await expect(firstPanel).toHaveAttribute('data-workspace-panel-affixed', 'true');

  const firstBox = await firstPanel.boundingBox();
  if (!firstBox) throw new Error(`${firstLaunch.label} snapped panel was not measurable.`);
  const secondDropX = Math.min(canvas.right - 260, Math.max(canvas.left + 420, firstBox.x + firstBox.width + 320));
  const secondDropY = Math.min(canvas.bottom - 220, Math.max(canvas.top + 260, firstBox.y + 180));
  await dragSidebarItemIntoWorkspace(page, secondLaunch.label, secondDropX, secondDropY);

  const secondPanel = page.getByRole('dialog', { name: secondLaunch.panelName });
  await expect(secondPanel).toBeVisible();
  await expect(secondPanel).toHaveAttribute('data-workspace-panel-chrome', 'floating');
  await expect(page.getByRole('dialog')).toHaveCount(2);

  const secondHeader = secondPanel.locator('[data-workspace-panel-header="true"]');
  const secondHeaderBox = await secondHeader.boundingBox();
  if (!secondHeaderBox) throw new Error(`${secondLaunch.label} panel header was not measurable for stick drag.`);
  const target = {
    x: firstBox.x + firstBox.width + 18,
    y: Math.min(firstBox.y + Math.max(36, firstBox.height * 0.25), firstBox.y + firstBox.height - 24),
  };

  await page.mouse.move(secondHeaderBox.x + 24, secondHeaderBox.y + secondHeaderBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(secondHeaderBox.x + 140, secondHeaderBox.y + secondHeaderBox.height / 2, { steps: 4 });
  await page.mouse.move(target.x, target.y, { steps: 16 });

  const preview = page.locator('[data-workspace-snap-preview]').first();
  await expect(preview).toBeVisible();
  const previewBox = await preview.boundingBox();
  expect(previewBox).not.toBeNull();
  expect(Math.abs(previewBox!.x - (firstBox.x + firstBox.width))).toBeLessThanOrEqual(4);
  expect(previewBox!.height).toBeLessThan(canvas.height / 2);
  await expect(page.locator('[data-workspace-join-cue-kind="neighbor-seam"][data-workspace-join-cue-side="left"]').first()).toBeVisible();
  await page.mouse.up();

  await expect(secondPanel).toHaveAttribute('data-workspace-panel-chrome', 'snapped');
  await expect(secondPanel).toHaveAttribute('data-workspace-panel-affixed', 'true');
  await expect(secondPanel).toHaveAttribute('data-workspace-panel-attached-left', 'true');
  await expect(firstPanel).toHaveAttribute('data-workspace-panel-attached-right', 'true');
  await expectPanelInsideWorkspaceCanvas(page, secondPanel);
  await expectContiguousVerticalSeam(firstPanel, secondPanel);
}

async function snapPanelToZone(page: Page, panel: Locator, zone: 'right' | 'top-left') {
  const header = panel.locator('[data-workspace-panel-header="true"]');
  const headerBox = await header.boundingBox();
  if (!headerBox) throw new Error('Panel header was not measurable for snap.');
  const target = await snapTarget(page, zone);

  await page.mouse.move(headerBox.x + 24, headerBox.y + headerBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(headerBox.x + 140, headerBox.y + headerBox.height / 2, { steps: 4 });
  await page.mouse.move(target.x, target.y, { steps: 16 });
  await expect(page.locator('[data-workspace-snap-preview]').first()).toBeVisible();
  await page.mouse.up();
}

async function workspaceCanvasRect(page: Page) {
  const canvas = await page.evaluate(() => {
    const explicitCanvases = visibleWorkspaceRects('[data-workspace-mosaic-canvas="true"]');
    const canvases = explicitCanvases.length > 0 ? explicitCanvases : visibleWorkspaceRects(
      '[data-app-workspace-home="true"], [data-app-workspace-pane="active"], [data-assistantcaddy-shell-pane="active"]',
    );
    if (canvases.length === 0) return null;
    const left = Math.min(...canvases.map((rect) => rect.left));
    const top = Math.min(...canvases.map((rect) => rect.top));
    const right = Math.max(...canvases.map((rect) => rect.right));
    const bottom = Math.max(...canvases.map((rect) => rect.bottom));
    return { left, top, right, bottom, width: right - left, height: bottom - top };

    function visibleWorkspaceRects(selector: string) {
      return Array.from(document.querySelectorAll<HTMLElement>(selector)).flatMap((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width >= 320 && rect.height >= 240 && rect.bottom > 0 && rect.right > 0 ? [rect] : [];
      });
    }
  });

  if (!canvas) throw new Error('Expected workspace canvas to be measurable.');
  return canvas;
}

async function snapTarget(page: Page, zone: 'right' | 'top-left') {
  const safe = await workspaceCanvasRect(page);
  if (zone === 'top-left') return { x: safe.left + 4, y: safe.top + 4 };
  if (zone === 'right') return { x: safe.right - 4, y: safe.top + safe.height / 2 };
  return { x: safe.right - 4, y: safe.top + safe.height / 2 };
}

function joinCueSideForZone(zone: 'right' | 'top-left') {
  return zone === 'right' ? 'right' : 'top';
}

function launchByLabel(label: LaunchCheck['label']) {
  const launch = launchChecks.find((candidate) => candidate.label === label);
  if (!launch) throw new Error(`Unknown workspace launch target: ${label}`);
  return launch;
}

async function expectPanelInsideWorkspaceCanvas(page: Page, panel: Locator) {
  const panelBox = await panel.boundingBox();
  const canvas = await workspaceCanvasRect(page);
  expect(panelBox).not.toBeNull();
  expect(panelBox!.x).toBeGreaterThanOrEqual(canvas.left - 2);
  expect(panelBox!.y).toBeGreaterThanOrEqual(canvas.top - 2);
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(canvas.right + 2);
  expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(canvas.bottom + 2);
}

async function expectContiguousVerticalSeam(leftPanel: Locator, rightPanel: Locator) {
  const leftBox = await leftPanel.boundingBox();
  const rightBox = await rightPanel.boundingBox();
  expect(leftBox).not.toBeNull();
  expect(rightBox).not.toBeNull();
  expect(Math.abs((leftBox!.x + leftBox!.width) - rightBox!.x)).toBeLessThanOrEqual(4);
  const overlap = Math.max(
    0,
    Math.min(leftBox!.y + leftBox!.height, rightBox!.y + rightBox!.height) - Math.max(leftBox!.y, rightBox!.y),
  );
  expect(overlap).toBeGreaterThan(24);
}
