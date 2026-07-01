import { expect, type Locator, type Page, test } from '@playwright/test';
import { goToApp } from './fixtures';

type SnapZone = 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

test.describe('Workspace snapped panel shared seams', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 2200, height: 1900 });
    await goToApp(page);
  });

  test('free-drags a panel across open workspace canvas without requiring a grid square', async ({ page }) => {
    await openWorkspacePanel(page, 'Open Tasks in Workspace', 'Tasks panel', 'Tasks');
    const tasksPanel = page.getByRole('dialog', { name: 'Tasks panel' });
    const before = await elementRect(tasksPanel);
    const canvas = await workspaceCanvasRect(page);
    const header = tasksPanel.locator('[data-workspace-panel-header="true"]');
    const headerBox = await header.boundingBox();
    if (!headerBox) throw new Error('Tasks panel header was not measurable for free drag.');

    await page.mouse.move(headerBox.x + 24, headerBox.y + headerBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvas.left + canvas.width * 0.42, canvas.top + canvas.height * 0.48, { steps: 14 });
    await expect(page.locator('[data-workspace-snap-preview]')).toHaveCount(0);
    await expect(page.locator('[data-workspace-join-cue]')).toHaveCount(0);
    await expect(tasksPanel).toHaveAttribute('data-workspace-panel-chrome', 'floating');
    await page.mouse.up();

    const after = await elementRect(tasksPanel);
    expect(Math.abs(after.left - before.left) + Math.abs(after.top - before.top)).toBeGreaterThan(40);
    await expect(tasksPanel).toHaveAttribute('data-workspace-panel-chrome', 'floating');
    await expect.poll(() => tasksPanel.getAttribute('data-workspace-panel-affixed')).toBeNull();
    await expect.poll(() => tasksPanel.getAttribute('data-workspace-panel-snap-grid')).toBeNull();
    await expectPanelInsideWorkspaceCanvas(page, tasksPanel);
  });

  test('shows workspace-edge join cue while dragging and snaps only on release', async ({ page }) => {
    await openWorkspacePanel(page, 'Open Notes in Workspace', 'Notes panel', 'Notes');
    const notesPanel = page.getByRole('dialog', { name: 'Notes panel' });
    const header = notesPanel.locator('[data-workspace-panel-header="true"]');
    const headerBox = await header.boundingBox();
    if (!headerBox) throw new Error('Notes panel header was not measurable for edge join cue drag.');
    const target = await snapTarget(page, 'right');

    await page.mouse.move(headerBox.x + 24, headerBox.y + headerBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 14 });
    await expect(page.locator('[data-workspace-snap-preview="right"]')).toBeVisible();
    await expect(page.locator('[data-workspace-join-cue-kind="workspace-edge"][data-workspace-join-cue-side="right"]').first()).toBeVisible();
    await expect(notesPanel).toHaveAttribute('data-workspace-panel-chrome', 'floating');
    await expect.poll(() => notesPanel.getAttribute('data-workspace-panel-affixed')).toBeNull();
    await page.mouse.up();

    await expect(notesPanel).toHaveAttribute('data-workspace-panel-chrome', 'snapped');
    await expect(notesPanel).toHaveAttribute('data-workspace-panel-affixed', 'true');
    await expect(notesPanel).toHaveAttribute('data-workspace-panel-snap-zone', 'right');
    await expect(page.locator('[data-workspace-join-cue]')).toHaveCount(0);
  });

  test('shows neighbor seam cue before connecting adjacent panels', async ({ page }) => {
    await openWorkspacePanel(page, 'Open Notes in Workspace', 'Notes panel', 'Notes');
    const notesPanel = page.getByRole('dialog', { name: 'Notes panel' });
    await snapPanel(page, notesPanel, 'top-left');

    await openWorkspacePanel(page, 'Open Tasks in Workspace', 'Tasks panel', 'Tasks');
    const tasksPanel = page.getByRole('dialog', { name: 'Tasks panel' });
    const header = tasksPanel.locator('[data-workspace-panel-header="true"]');
    const headerBox = await header.boundingBox();
    if (!headerBox) throw new Error('Tasks panel header was not measurable for neighbor seam drag.');
    const notesBox = await notesPanel.boundingBox();
    if (!notesBox) throw new Error('Notes panel was not measurable for neighbor seam drag.');
    const target = {
      x: notesBox.x + notesBox.width + 18,
      y: Math.min(notesBox.y + Math.max(36, notesBox.height * 0.25), notesBox.y + notesBox.height - 24),
    };

    await page.mouse.move(headerBox.x + 24, headerBox.y + headerBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 14 });
    await expect(page.locator('[data-workspace-join-cue-kind="neighbor-seam"]').first()).toBeVisible();
    await expect(tasksPanel).toHaveAttribute('data-workspace-panel-chrome', 'floating');
    await expect.poll(() => tasksPanel.getAttribute('data-workspace-panel-affixed')).toBeNull();
    await page.mouse.up();

    await expect(tasksPanel).toHaveAttribute('data-workspace-panel-chrome', 'snapped');
    await expect(tasksPanel).toHaveAttribute('data-workspace-panel-affixed', 'true');
    await expect(tasksPanel).toHaveAttribute('data-workspace-panel-attached-left', 'true');
    await expect(notesPanel).toHaveAttribute('data-workspace-panel-attached-right', 'true');
    await expect(page.locator('[data-workspace-join-cue]')).toHaveCount(0);
  });

  test('clamps a Tasks free drag above the canvas without connecting to the top bar', async ({ page }) => {
    await openWorkspacePanel(page, 'Open Tasks in Workspace', 'Tasks panel', 'Tasks');
    const tasksPanel = page.getByRole('dialog', { name: 'Tasks panel' });
    const canvas = await workspaceCanvasRect(page);
    const header = tasksPanel.locator('[data-workspace-panel-header="true"]');
    const headerBox = await header.boundingBox();
    if (!headerBox) throw new Error('Tasks panel header was not measurable for boundary clamp drag.');

    await page.mouse.move(headerBox.x + 24, headerBox.y + headerBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvas.left + canvas.width / 2, canvas.top - 80, { steps: 14 });
    await expect(page.locator('[data-workspace-snap-preview]')).toHaveCount(0);
    await expect(page.locator('[data-workspace-join-cue]')).toHaveCount(0);
    await page.mouse.up();

    await expect(tasksPanel).toHaveAttribute('data-workspace-panel-chrome', 'floating');
    await expect.poll(() => tasksPanel.getAttribute('data-workspace-panel-affixed')).toBeNull();
    await expect.poll(() => tasksPanel.getAttribute('data-workspace-panel-snap-zone')).toBeNull();
    await expect(tasksPanel).not.toHaveAttribute('data-workspace-panel-attached-top', 'true');
    await expectPanelInsideWorkspaceCanvas(page, tasksPanel);
  });

  test('resizes left and right snapped tiles through their shared vertical seam', async ({ page }) => {
    await openWorkspacePanel(page, 'Open Notes in Workspace', 'Notes panel', 'Notes');
    await openWorkspacePanel(page, 'Open Tasks in Workspace', 'Tasks panel', 'Tasks');

    const notesPanel = page.getByRole('dialog', { name: 'Notes panel' });
    const tasksPanel = page.getByRole('dialog', { name: 'Tasks panel' });
    await snapPanel(page, notesPanel, 'top-left');
    await snapPanelToRightOfPanel(page, tasksPanel, notesPanel);

    await expect(notesPanel).toHaveAttribute('data-workspace-panel-chrome', 'snapped');
    await expect(tasksPanel).toHaveAttribute('data-workspace-panel-chrome', 'snapped');
    await expect(notesPanel).toHaveAttribute('data-workspace-panel-affixed', 'true');
    await expect(tasksPanel).toHaveAttribute('data-workspace-panel-affixed', 'true');
    await expect(notesPanel).toHaveAttribute('data-workspace-panel-attached-right', 'true');
    await expect(tasksPanel).toHaveAttribute('data-workspace-panel-attached-left', 'true');
    await expect(tasksPanel.locator('[data-resize-seam-indicator="left"]')).toHaveCount(0);
    await expectContiguousVerticalSeam(notesPanel, tasksPanel);

    const beforeNotes = await elementRect(notesPanel);
    const beforeTasks = await elementRect(tasksPanel);
    await hoverResizeHandle(tasksPanel, 'Resize Tasks panel from left');
    await expect(tasksPanel).toHaveAttribute('data-workspace-panel-shared-seam', 'left');
    await expect(tasksPanel.locator('[data-resize-seam-indicator="left"]')).toBeVisible();
    await dragResizeHandle(page, tasksPanel, 'Resize Tasks panel from left', 500, 0);

    const afterNotes = await elementRect(notesPanel);
    const afterTasks = await elementRect(tasksPanel);
    const expectedTransfer = Math.max(30, Math.min(80, beforeTasks.width - 300) - 10);
    expect(afterNotes.width).toBeGreaterThan(beforeNotes.width + expectedTransfer);
    expect(afterTasks.width).toBeLessThan(beforeTasks.width - expectedTransfer);
    expect(afterNotes.width).toBeGreaterThanOrEqual(320);
    expect(afterTasks.width).toBeGreaterThanOrEqual(300);
    await expectContiguousVerticalSeam(notesPanel, tasksPanel);

    await expectControlInsidePanel(tasksPanel, tasksPanel.locator('[data-task-new-button="true"]'));
    await expect(tasksPanel.getByRole('button', { name: 'Return Tasks to main workspace' })).toBeVisible();
    await expect(tasksPanel.getByRole('button', { name: 'Minimize Tasks' })).toBeVisible();
    await expect(tasksPanel.getByRole('button', { name: 'Close Tasks workspace panel' })).toBeVisible();

    const snappedZIndexes = await Promise.all([
      notesPanel.getAttribute('data-workspace-panel-z-index'),
      tasksPanel.getAttribute('data-workspace-panel-z-index'),
    ]);
    await openWorkspacePanel(page, 'Open Activity in Workspace', 'Activity panel', 'Activity');
    const activityPanel = page.getByRole('dialog', { name: 'Activity panel' });
    await expect(activityPanel).toHaveAttribute('data-workspace-panel-chrome', 'floating');
    const activityZIndex = Number(await activityPanel.getAttribute('data-workspace-panel-z-index'));
    expect(activityZIndex).toBeGreaterThan(Math.max(...snappedZIndexes.map((value) => Number(value))));
    await expect.poll(() => panelChromeStyle(page, 'Activity panel')).toMatchObject({
      rounded: true,
      shadowed: true,
    });

    expect(Number(await notesPanel.getAttribute('data-workspace-panel-z-index'))).toBeLessThan(activityZIndex);
    expect(Number(await tasksPanel.getAttribute('data-workspace-panel-z-index'))).toBeLessThan(activityZIndex);
  });

  test('adapts the outer curve when a small tile attaches to a longer side', async ({ page }) => {
    await openWorkspacePanel(page, 'Open Notes in Workspace', 'Notes panel', 'Notes');
    const notesPanel = page.getByRole('dialog', { name: 'Notes panel' });
    await snapPanel(page, notesPanel, 'left');
    const compactNotes = await elementRect(notesPanel);
    await dragResizeHandle(page, notesPanel, 'Resize Notes panel from bottom', 0, 280);
    const tallerNotes = await elementRect(notesPanel);
    expect(tallerNotes.height).toBeGreaterThan(compactNotes.height + 100);

    await openWorkspacePanel(page, 'Open Tasks in Workspace', 'Tasks panel', 'Tasks');
    const tasksPanel = page.getByRole('dialog', { name: 'Tasks panel' });
    await snapPanelToRightOfPanel(page, tasksPanel, notesPanel);

    await expect(notesPanel).toHaveAttribute('data-workspace-panel-attached-right', 'true');
    await expect(notesPanel).toHaveAttribute('data-workspace-panel-rounded-corners', /bottom-right/);
    await expect(notesPanel).not.toHaveAttribute('data-workspace-panel-rounded-corners', /top-right/);
    await expect(tasksPanel).toHaveAttribute('data-workspace-panel-attached-left', 'true');
    await expect(tasksPanel.locator('[data-resize-seam-indicator="left"]')).toHaveCount(0);

    const notesStyle = await mosaicChromeStyle(notesPanel);
    const tasksStyle = await mosaicChromeStyle(tasksPanel);
    expect(notesStyle.topRightRadius).toBe(0);
    expect(notesStyle.bottomRightRadius).toBeGreaterThanOrEqual(6);
    expect(notesStyle.borderRightTransparent).toBe(false);
    expect(tasksStyle.borderLeftTransparent).toBe(false);
    await expect(notesPanel.locator('[data-workspace-panel-merge-mask="right"]')).toBeVisible();
    await expect(tasksPanel.locator('[data-workspace-panel-merge-mask="left"]')).toBeVisible();
    await expectContiguousVerticalSeam(notesPanel, tasksPanel);

    await hoverResizeHandle(tasksPanel, 'Resize Tasks panel from left');
    await expect(tasksPanel).toHaveAttribute('data-workspace-panel-shared-seam', 'left');
    await expect(tasksPanel.locator('[data-resize-seam-indicator="left"]')).toBeVisible();
  });

  test('keeps large-grid snapped tiles inside the workspace canvas', async ({ page }) => {
    await page.setViewportSize({ width: 2600, height: 3600 });
    await goToApp(page);

    await openWorkspacePanel(page, 'Open Notes in Workspace', 'Notes panel', 'Notes');
    const notesPanel = page.getByRole('dialog', { name: 'Notes panel' });
    await ensureWorkspaceVisible(page);
    await expect(notesPanel).toHaveAttribute('data-workspace-snap-grid-options', /3x3/);
    const canvas = await workspaceCanvasRect(page);
    const notesHeaderBox = await notesPanel.locator('[data-workspace-panel-header="true"]').boundingBox();
    if (!notesHeaderBox) throw new Error('Notes panel header was not measurable for large-grid snap drag.');
    await page.mouse.move(notesHeaderBox.x + 18, notesHeaderBox.y + notesHeaderBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvas.right - 100, canvas.top + canvas.height * 0.5, { steps: 12 });
    await expect(page.locator('[data-workspace-snap-preview]').first()).toBeVisible();
    await page.mouse.up();

    await expect(notesPanel).toHaveAttribute('data-workspace-panel-chrome', 'snapped');
    await expect(notesPanel).toHaveAttribute('data-workspace-panel-affixed', 'true');
    await expect(notesPanel).toHaveAttribute('data-workspace-panel-snap-grid', /^(3x2|3x3|4x1|4x2|4x4)$/);
    await expect(notesPanel).toHaveAttribute('data-workspace-panel-grid-cell', /^(3x2|3x3|4x1|4x2|4x4):\d+,\d+$/);
    await expectPanelInsideWorkspaceCanvas(page, notesPanel);
  });

  test('resizes top and bottom snapped tiles through their shared horizontal seam', async ({ page }) => {
    await openWorkspacePanel(page, 'Open Notes in Workspace', 'Notes panel', 'Notes');
    await openWorkspacePanel(page, 'Open Tasks in Workspace', 'Tasks panel', 'Tasks');

    const notesPanel = page.getByRole('dialog', { name: 'Notes panel' });
    const tasksPanel = page.getByRole('dialog', { name: 'Tasks panel' });
    await snapPanel(page, notesPanel, 'top-left');
    await snapPanelBelowPanel(page, tasksPanel, notesPanel);

    await expect(notesPanel).toHaveAttribute('data-workspace-panel-attached-bottom', 'true');
    await expect(tasksPanel).toHaveAttribute('data-workspace-panel-attached-top', 'true');
    await expectContiguousHorizontalSeam(notesPanel, tasksPanel);

    const beforeNotes = await elementRect(notesPanel);
    const beforeTasks = await elementRect(tasksPanel);
    await hoverResizeHandle(tasksPanel, 'Resize Tasks panel from top');
    await expect(tasksPanel).toHaveAttribute('data-workspace-panel-shared-seam', 'top');
    await expect(tasksPanel.locator('[data-resize-seam-indicator="top"]')).toBeVisible();
    await dragResizeHandle(page, tasksPanel, 'Resize Tasks panel from top', 0, 500);

    const expandedNotes = await elementRect(notesPanel);
    const compressedTasks = await elementRect(tasksPanel);
    expect(expandedNotes.height).toBeGreaterThan(beforeNotes.height + 30);
    expect(compressedTasks.height).toBeLessThan(beforeTasks.height - 30);
    expect(expandedNotes.height).toBeGreaterThanOrEqual(240);
    expect(compressedTasks.height).toBeGreaterThanOrEqual(240);
    await expectContiguousHorizontalSeam(notesPanel, tasksPanel);
    await expectControlInsidePanel(tasksPanel, tasksPanel.locator('[data-task-new-button="true"]'));
    await expect(tasksPanel.getByRole('button', { name: 'Return Tasks to main workspace' })).toBeVisible();
    await expect(tasksPanel.getByRole('button', { name: 'Minimize Tasks' })).toBeVisible();
    await expect(tasksPanel.getByRole('button', { name: 'Close Tasks workspace panel' })).toBeVisible();

    await hoverResizeHandle(tasksPanel, 'Resize Tasks panel from top');
    await dragResizeHandle(page, tasksPanel, 'Resize Tasks panel from top', 0, -120);
    const contractedNotes = await elementRect(notesPanel);
    const expandedTasks = await elementRect(tasksPanel);
    expect(contractedNotes.height).toBeLessThan(expandedNotes.height - 40);
    expect(expandedTasks.height).toBeGreaterThan(compressedTasks.height + 40);
    await expectContiguousHorizontalSeam(notesPanel, tasksPanel);

    await expectControlInsidePanel(notesPanel, notesPanel.locator('[data-note-new-button="true"]'));
    await expect(notesPanel.getByRole('button', { name: 'Return Notes to main workspace' })).toBeVisible();
    await expect(notesPanel.getByRole('button', { name: 'Minimize Notes' })).toBeVisible();
    await expect(notesPanel.getByRole('button', { name: 'Close Notes workspace panel' })).toBeVisible();
  });

  test('resizes an exposed snapped-panel corner with a bent corner indicator', async ({ page }) => {
    await openWorkspacePanel(page, 'Open Notes in Workspace', 'Notes panel', 'Notes');
    const notesPanel = page.getByRole('dialog', { name: 'Notes panel' });
    await snapPanel(page, notesPanel, 'top-left');

    const beforeNotes = await elementRect(notesPanel);
    await hoverResizeHandle(notesPanel, 'Resize Notes panel from bottom right');
    await expect(notesPanel).toHaveAttribute('data-workspace-panel-active-resize', 'bottom-right');
    await expect(notesPanel.locator('[data-resize-indicator="bottom-right"]')).toBeVisible();
    await dragResizeHandle(page, notesPanel, 'Resize Notes panel from bottom right', 80, 70);

    const afterNotes = await elementRect(notesPanel);
    expect(afterNotes.width).toBeGreaterThan(beforeNotes.width + 40);
    expect(afterNotes.height).toBeGreaterThan(beforeNotes.height + 30);
    await expectPanelInsideWorkspaceCanvas(page, notesPanel);
  });
});

async function openWorkspacePanel(page: Page, actionName: string, panelName: string, navLabel: string) {
  const action = page.getByRole('button', { name: actionName });
  if (await action.count() > 0) {
    await action.click();
  } else {
    await ensureWorkspaceVisible(page);
    await dragSidebarPanelIntoWorkspace(page, navLabel);
  }
  const panel = page.getByRole('dialog', { name: panelName });
  if (!await panel.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await ensureWorkspaceVisible(page);
    await dragSidebarPanelIntoWorkspace(page, navLabel);
  }
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-workspace-panel-state', 'floating');
  return panel;
}

async function ensureWorkspaceVisible(page: Page) {
  const workspace = page.locator('[data-app-workspace-home="true"]');
  if (!await workspace.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'Workspace', exact: true }).click();
  }
  await expect(workspace).toBeVisible();
}

async function dragSidebarPanelIntoWorkspace(page: Page, navLabel: string) {
  const workspace = page.locator('[data-app-workspace-home="true"]');
  await expect(workspace).toBeVisible();
  const transfer = await page.evaluateHandle('new DataTransfer()');
  const navItem = page.locator('nav[aria-label="Views"] [role="button"]').filter({ hasText: navLabel }).first();
  await expect(navItem).toBeVisible();
  await navItem.dispatchEvent('dragstart', { dataTransfer: transfer });
  await workspace.dispatchEvent('dragover', { dataTransfer: transfer, clientX: 650, clientY: 260 });
  await expect(workspace).toHaveAttribute('data-workspace-drop-state', 'valid');
  await workspace.dispatchEvent('drop', { dataTransfer: transfer, clientX: 650, clientY: 260 });
  await transfer.dispose();
}

async function snapPanel(page: Page, panel: Locator, zone: SnapZone) {
  const header = panel.locator('[data-workspace-panel-header="true"]');
  const headerBox = await header.boundingBox();
  if (!headerBox) throw new Error(`Panel header was not measurable for ${zone} snap drag.`);
  const target = await snapTarget(page, zone);

  await page.mouse.move(headerBox.x + 18, headerBox.y + headerBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 12 });
  const exactPreview = page.locator(`[data-workspace-snap-preview="${zone}"]`);
  if (!await exactPreview.isVisible({ timeout: 750 }).catch(() => false)) {
    await expect(page.locator('[data-workspace-snap-preview]').first()).toBeVisible();
  }
  await page.mouse.up();
  await expect(panel).toHaveAttribute('data-workspace-panel-chrome', 'snapped');
  await expect(panel).toHaveAttribute('data-workspace-panel-snap-zone', zone);
  await expectPanelInsideWorkspaceCanvas(page, panel);
}

async function snapPanelToRightOfPanel(page: Page, panel: Locator, anchorPanel: Locator) {
  const header = panel.locator('[data-workspace-panel-header="true"]');
  const headerBox = await header.boundingBox();
  if (!headerBox) throw new Error('Panel header was not measurable for adjacent seam snap drag.');
  const anchorBox = await anchorPanel.boundingBox();
  if (!anchorBox) throw new Error('Anchor panel was not measurable for adjacent seam snap drag.');
  const target = {
    x: anchorBox.x + anchorBox.width + 18,
    y: Math.min(anchorBox.y + Math.max(36, anchorBox.height * 0.25), anchorBox.y + anchorBox.height - 24),
  };

  await page.mouse.move(headerBox.x + 18, headerBox.y + headerBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 12 });
  await expect(page.locator('[data-workspace-join-cue-kind="neighbor-seam"][data-workspace-join-cue-side="left"]').first()).toBeVisible();
  await page.mouse.up();
  await expect(panel).toHaveAttribute('data-workspace-panel-chrome', 'snapped');
  await expect(panel).toHaveAttribute('data-workspace-panel-attached-left', 'true');
  await expect(anchorPanel).toHaveAttribute('data-workspace-panel-attached-right', 'true');
  await expectPanelInsideWorkspaceCanvas(page, panel);
}

async function snapPanelBelowPanel(page: Page, panel: Locator, anchorPanel: Locator) {
  const header = panel.locator('[data-workspace-panel-header="true"]');
  const headerBox = await header.boundingBox();
  if (!headerBox) throw new Error('Panel header was not measurable for vertical seam snap drag.');
  const anchorBox = await anchorPanel.boundingBox();
  if (!anchorBox) throw new Error('Anchor panel was not measurable for vertical seam snap drag.');
  const target = {
    x: anchorBox.x + anchorBox.width / 2,
    y: anchorBox.y + anchorBox.height + 2,
  };

  await page.mouse.move(headerBox.x + 18, headerBox.y + headerBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 12 });
  await expect(page.locator('[data-workspace-join-cue-kind="neighbor-seam"][data-workspace-join-cue-side="top"]').first()).toBeVisible();
  await page.mouse.up();
  await expect(panel).toHaveAttribute('data-workspace-panel-chrome', 'snapped');
  await expect(panel).toHaveAttribute('data-workspace-panel-attached-top', 'true');
  await expect(anchorPanel).toHaveAttribute('data-workspace-panel-attached-bottom', 'true');
  await expectPanelInsideWorkspaceCanvas(page, panel);
}

async function snapTarget(page: Page, zone: SnapZone) {
  const safe = await page.evaluate(() => {
    const explicitCanvases = visibleWorkspaceRects('[data-workspace-mosaic-canvas="true"]');
    const canvases = explicitCanvases.length > 0 ? explicitCanvases : visibleWorkspaceRects(
      '[data-app-workspace-home="true"], [data-app-workspace-pane="active"], [data-assistantcaddy-shell-pane="active"]',
    );
    if (canvases.length > 0) {
      const left = Math.min(...canvases.map((rect) => rect.left));
      const top = Math.min(...canvases.map((rect) => rect.top));
      const right = Math.max(...canvases.map((rect) => rect.right));
      const bottom = Math.max(...canvases.map((rect) => rect.bottom));
      return { left, top, right, bottom, width: right - left, height: bottom - top };
    }

    let left = 8;
    let top = 8;
    const sidebar = document.querySelector('.app-window-sidebar');
    if (sidebar instanceof HTMLElement) {
      const rect = sidebar.getBoundingClientRect();
      if (rect.width > 0 && rect.right > 0 && rect.right < window.innerWidth * 0.65) {
        left = Math.max(left, rect.right + 8);
      }
    }

    const titlebar = document.querySelector('[data-tour="header"]');
    if (titlebar instanceof HTMLElement) {
      const rect = titlebar.getBoundingClientRect();
      if (rect.height > 0 && rect.bottom > 0 && rect.bottom < window.innerHeight * 0.35) {
        top = Math.max(top, rect.bottom + 8);
      }
    }

    const right = Math.max(left + 320, window.innerWidth - 8);
    const bottom = Math.max(top + 320, window.innerHeight - 8);
    return { left, top, right, bottom, width: right - left, height: bottom - top };

    function visibleWorkspaceRects(selector: string) {
      return Array.from(document.querySelectorAll<HTMLElement>(selector)).flatMap((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width >= 320 && rect.height >= 240 && rect.bottom > 0 && rect.right > 0 ? [rect] : [];
      });
    }
  });

  if (zone === 'left') return { x: safe.left + 4, y: safe.top + safe.height / 2 };
  if (zone === 'right') return { x: safe.right - 4, y: safe.top + safe.height / 2 };
  if (zone === 'top') return { x: safe.left + safe.width / 2, y: safe.top + 4 };
  if (zone === 'bottom') return { x: safe.left + safe.width / 2, y: safe.bottom - 4 };
  if (zone === 'top-left') return { x: safe.left + 4, y: safe.top + 4 };
  if (zone === 'top-right') return { x: safe.right - 4, y: safe.top + 4 };
  if (zone === 'bottom-left') return { x: safe.left + 4, y: safe.bottom - 4 };
  return { x: safe.right - 4, y: safe.bottom - 4 };
}

async function hoverResizeHandle(panel: Locator, label: string) {
  const handle = panel.getByRole('button', { name: label, exact: true });
  await expect(handle).toBeVisible();
  await handle.hover();
}

async function dragResizeHandle(page: Page, panel: Locator, label: string, dx: number, dy: number) {
  const handle = panel.getByRole('button', { name: label, exact: true });
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error(`Resize handle "${label}" was not measurable.`);
  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: 10 });
  await page.mouse.up();
}

async function elementRect(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Expected element to have a measurable bounding box.');
  return {
    left: box.x,
    top: box.y,
    right: box.x + box.width,
    bottom: box.y + box.height,
    width: box.width,
    height: box.height,
  };
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

async function expectContiguousVerticalSeam(leftPanel: Locator, rightPanel: Locator) {
  const left = await elementRect(leftPanel);
  const right = await elementRect(rightPanel);
  expect(left.right).toBeLessThanOrEqual(right.left + 3);
  expect(Math.abs(left.right - right.left)).toBeLessThanOrEqual(4);
}

async function expectContiguousHorizontalSeam(topPanel: Locator, bottomPanel: Locator) {
  const top = await elementRect(topPanel);
  const bottom = await elementRect(bottomPanel);
  expect(top.bottom).toBeLessThanOrEqual(bottom.top + 3);
  expect(Math.abs(top.bottom - bottom.top)).toBeLessThanOrEqual(4);
}

async function expectPanelInsideWorkspaceCanvas(page: Page, panel: Locator) {
  const panelBox = await elementRect(panel);
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
    return { left, top, right, bottom };

    function visibleWorkspaceRects(selector: string) {
      return Array.from(document.querySelectorAll<HTMLElement>(selector)).flatMap((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width >= 320 && rect.height >= 240 && rect.bottom > 0 && rect.right > 0 ? [rect] : [];
      });
    }
  });
  expect(canvas).not.toBeNull();
  expect(panelBox.left).toBeGreaterThanOrEqual(canvas!.left - 2);
  expect(panelBox.top).toBeGreaterThanOrEqual(canvas!.top - 2);
  expect(panelBox.right).toBeLessThanOrEqual(canvas!.right + 2);
  expect(panelBox.bottom).toBeLessThanOrEqual(canvas!.bottom + 2);
}

async function expectControlInsidePanel(panel: Locator, control: Locator) {
  await expect(control).toBeVisible();
  const panelBox = await elementRect(panel);
  const controlBox = await elementRect(control);
  expect(controlBox.left).toBeGreaterThanOrEqual(panelBox.left - 1);
  expect(controlBox.right).toBeLessThanOrEqual(panelBox.right + 1);
  expect(controlBox.top).toBeGreaterThanOrEqual(panelBox.top - 1);
  expect(controlBox.bottom).toBeLessThanOrEqual(panelBox.bottom + 1);
}

async function panelChromeStyle(page: Page, panelName: string) {
  return page.evaluate((name) => {
    const panel = document.querySelector(`[role="dialog"][aria-label="${name}"]`);
    if (!(panel instanceof HTMLElement)) return { rounded: false, shadowed: false };
    const style = window.getComputedStyle(panel);
    return {
      rounded: Number.parseFloat(style.borderTopLeftRadius) >= 14,
      shadowed: style.boxShadow !== 'none',
    };
  }, panelName);
}

async function mosaicChromeStyle(panel: Locator) {
  return panel.evaluate((panelElement) => {
    const style = window.getComputedStyle(panelElement);
    return {
      topRightRadius: Number.parseFloat(style.borderTopRightRadius),
      bottomRightRadius: Number.parseFloat(style.borderBottomRightRadius),
      borderLeftTransparent: style.borderLeftColor === 'rgba(0, 0, 0, 0)' || style.borderLeftColor === 'transparent',
      borderRightTransparent: style.borderRightColor === 'rgba(0, 0, 0, 0)' || style.borderRightColor === 'transparent',
    };
  });
}
