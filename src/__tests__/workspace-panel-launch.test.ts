import { describe, expect, it, vi } from 'vitest';
import {
  ACTIVITY_WORKSPACE_PANEL_ID,
  DASHBOARD_WORKSPACE_PANEL_ID,
  EVIDENCE_WORKSPACE_PANEL_ID,
  NOTES_WORKSPACE_PANEL_ID,
  PRODUCTS_WORKSPACE_PANEL_ID,
  TASKS_WORKSPACE_PANEL_ID,
  TIMELINE_WORKSPACE_PANEL_ID,
  WORKSPACE_PANEL_DRAG_TYPE,
  createWorkspacePanelDragPayload,
  getWorkspacePanelDragDescriptor,
  hasExternalFileDragType,
  hasWorkspacePanelDragType,
  parseWorkspacePanelDragPayload,
} from '../components/WorkspacePanels/workspacePanelLaunch';
import {
  ASSISTANTCADDY_WORKSPACE_PANEL_ID,
  CALENDARCADDY_WORKSPACE_PANEL_ID,
  EMAILCADDY_WORKSPACE_PANEL_ID,
  createAssistantWorkspacePanelDragPayload,
  getAssistantWorkspacePanelDragDescriptor,
  parseAssistantWorkspacePanelDragPayload,
} from '../components/CaddyAssistant/workspacePanelRegistrations';

describe('workspace panel launch drag payloads', () => {
  it.each([
    ['dashboard', DASHBOARD_WORKSPACE_PANEL_ID, 'Dashboard'],
    ['activity', ACTIVITY_WORKSPACE_PANEL_ID, 'Activity'],
    ['products', PRODUCTS_WORKSPACE_PANEL_ID, 'Products'],
    ['notes', NOTES_WORKSPACE_PANEL_ID, 'Notes'],
    ['tasks', TASKS_WORKSPACE_PANEL_ID, 'Tasks'],
    ['evidence', EVIDENCE_WORKSPACE_PANEL_ID, 'Evidence'],
    ['timeline', TIMELINE_WORKSPACE_PANEL_ID, 'Timeline'],
  ] as const)('round trips the %s descriptor through the sidebar drag payload', (view, panelId, title) => {
    const descriptor = parseWorkspacePanelDragPayload(createWorkspacePanelDragPayload(view));
    expect(descriptor).toMatchObject({
      view,
      panelId,
      title,
    });
  });

  it('round trips workspace menu drag payloads through the same allowlist', () => {
    const descriptor = parseWorkspacePanelDragPayload(createWorkspacePanelDragPayload('dashboard', 'menu'));
    expect(descriptor).toMatchObject({
      view: 'dashboard',
      panelId: DASHBOARD_WORKSPACE_PANEL_ID,
      title: 'Dashboard',
    });
  });

  it.each([
    ['overview', ASSISTANTCADDY_WORKSPACE_PANEL_ID, 'AssistantCaddy'],
    ['email', EMAILCADDY_WORKSPACE_PANEL_ID, 'EmailCaddy'],
    ['calendar', CALENDARCADDY_WORKSPACE_PANEL_ID, 'CalendarCaddy'],
  ] as const)('round trips the AssistantCaddy %s descriptor through its drag payload', (view, panelId, title) => {
    const descriptor = parseAssistantWorkspacePanelDragPayload(createAssistantWorkspacePanelDragPayload(view));
    expect(descriptor).toMatchObject({
      panelId,
      title,
    });
  });

  it.each([
    ['invalid JSON', '{'],
    ['empty payload', ''],
    ['wrong kind', JSON.stringify({ kind: 'other', version: 1, source: 'sidebar', view: 'dashboard', panelId: DASHBOARD_WORKSPACE_PANEL_ID })],
    ['wrong version', JSON.stringify({ kind: 'threatcaddy.workspace-panel-launch', version: 2, source: 'sidebar', view: 'dashboard', panelId: DASHBOARD_WORKSPACE_PANEL_ID })],
    ['wrong source', JSON.stringify({ kind: 'threatcaddy.workspace-panel-launch', version: 1, source: 'external', view: 'dashboard', panelId: DASHBOARD_WORKSPACE_PANEL_ID })],
    ['unknown view', JSON.stringify({ kind: 'threatcaddy.workspace-panel-launch', version: 1, source: 'sidebar', view: 'chat', panelId: 'chat-workspace' })],
    ['mismatched panel id', JSON.stringify({ kind: 'threatcaddy.workspace-panel-launch', version: 1, source: 'sidebar', view: 'dashboard', panelId: 'chat-workspace' })],
    ['attempted AgentCaddy launch', JSON.stringify({ kind: 'threatcaddy.workspace-panel-launch', version: 1, source: 'sidebar', view: 'agentcaddy', panelId: 'agentcaddy-workspace' })],
    ['attempted EmailCaddy launch', JSON.stringify({ kind: 'threatcaddy.workspace-panel-launch', version: 1, source: 'sidebar', view: 'cademail', panelId: 'emailcaddy-workspace' })],
    ['attempted CalendarCaddy launch', JSON.stringify({ kind: 'threatcaddy.workspace-panel-launch', version: 1, source: 'sidebar', view: 'calendarcaddy', panelId: 'calendarcaddy-workspace' })],
  ])('rejects %s', (_label, raw) => {
    expect(parseWorkspacePanelDragPayload(raw)).toBeNull();
  });

  it('requires the custom drag MIME type before reading a payload', () => {
    const dataTransfer = {
      types: ['text/plain'],
      getData: vi.fn(() => createWorkspacePanelDragPayload('dashboard')),
    } as unknown as DataTransfer;

    expect(hasWorkspacePanelDragType(dataTransfer.types)).toBe(false);
    expect(getWorkspacePanelDragDescriptor(dataTransfer)).toBeNull();
    expect(dataTransfer.getData).not.toHaveBeenCalled();
  });

  it('requires the custom MIME type before reading an AssistantCaddy payload', () => {
    const dataTransfer = {
      types: ['text/plain'],
      getData: vi.fn(() => createAssistantWorkspacePanelDragPayload('email')),
    } as unknown as DataTransfer;

    expect(getAssistantWorkspacePanelDragDescriptor(dataTransfer)).toBeNull();
    expect(dataTransfer.getData).not.toHaveBeenCalled();
  });

  it.each([
    ['wrong kind', JSON.stringify({ kind: 'other', version: 1, source: 'sidebar', view: 'email', panelId: EMAILCADDY_WORKSPACE_PANEL_ID })],
    ['wrong source', JSON.stringify({ kind: 'threatcaddy.assistant-workspace-panel-launch', version: 1, source: 'external', view: 'email', panelId: EMAILCADDY_WORKSPACE_PANEL_ID })],
    ['attempted AgentCaddy launch', JSON.stringify({ kind: 'threatcaddy.assistant-workspace-panel-launch', version: 1, source: 'sidebar', view: 'agent', panelId: 'agentcaddy-workspace' })],
    ['attempted CaddyAI launch', JSON.stringify({ kind: 'threatcaddy.assistant-workspace-panel-launch', version: 1, source: 'sidebar', view: 'chat', panelId: 'chat-workspace' })],
    ['mismatched EmailCaddy panel id', JSON.stringify({ kind: 'threatcaddy.assistant-workspace-panel-launch', version: 1, source: 'sidebar', view: 'email', panelId: 'chat-workspace' })],
  ])('rejects AssistantCaddy %s', (_label, raw) => {
    expect(parseAssistantWorkspacePanelDragPayload(raw)).toBeNull();
  });

  it('detects the custom workspace drag type and external file conflicts', () => {
    expect(hasWorkspacePanelDragType([WORKSPACE_PANEL_DRAG_TYPE, 'text/plain'])).toBe(true);
    expect(hasExternalFileDragType([WORKSPACE_PANEL_DRAG_TYPE, 'Files'])).toBe(true);
    expect(hasExternalFileDragType([WORKSPACE_PANEL_DRAG_TYPE, 'text/plain'])).toBe(false);
  });
});
