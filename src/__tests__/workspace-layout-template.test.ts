import { describe, expect, it } from 'vitest';
import type { WorkspacePanelState } from '../components/WorkspacePanels/WorkspacePanelProvider';
import {
  createWorkspaceLayoutTemplate,
  MAX_WORKSPACE_LAYOUT_TEMPLATE_BYTES,
  parseWorkspaceLayoutTemplate,
  serializeWorkspaceLayoutTemplate,
} from '../components/WorkspacePanels/workspaceLayoutTemplate';

const allowedPanelIds = new Set(['dashboard-workspace', 'notes-workspace']);

function panel(overrides: Partial<WorkspacePanelState>): WorkspacePanelState {
  return {
    id: 'dashboard-workspace',
    title: 'Dashboard',
    mode: 'floating',
    restoreMode: 'floating',
    geometry: { x: 120, y: 80, width: 900, height: 620 },
    zIndex: 130,
    placement: { kind: 'free' },
    ...overrides,
  };
}

describe('workspace layout templates', () => {
  it('serializes only panel layout state', () => {
    const template = createWorkspaceLayoutTemplate([
      panel({ id: 'dashboard-workspace', zIndex: 140 }),
      panel({
        id: 'notes-workspace',
        title: 'Notes',
        mode: 'minimized',
        restoreMode: 'floating',
        geometry: { x: 240, y: 96, width: 980, height: 660 },
        zIndex: 141,
      }),
    ]);

    expect(template).toMatchObject({
      kind: 'threatcaddy.workspace-layout-template',
      version: 1,
    });
    expect(template.panels).toHaveLength(2);
    expect(Object.keys(template).sort()).toEqual(['exportedAt', 'kind', 'panels', 'version']);
    expect(template.panels[0]).toEqual({
      id: 'dashboard-workspace',
      mode: 'floating',
      restoreMode: 'floating',
      geometry: { x: 120, y: 80, width: 900, height: 620 },
    });

    const raw = serializeWorkspaceLayoutTemplate(template);
    expect(raw).not.toContain('"notes":');
    expect(raw).not.toContain('"tasks":');
    expect(raw).not.toContain('"folders":');
    expect(raw).not.toContain('"chatThreads":');
    expect(raw).not.toContain('"messages":');
    expect(raw).not.toContain('"toolInput":');
    expect(raw).not.toContain('"apiKey":');
    expect(raw).not.toContain('"content":');
    expect(raw).not.toContain('"imageData":');
    expect(raw).not.toContain('"placement":');
    expect(raw).not.toContain('"affixed":');
  });

  it('drops investigation and content fields cast onto panel state before serialization', () => {
    const template = createWorkspaceLayoutTemplate([
      {
        ...panel({
          id: 'notes-workspace',
          title: 'Case Alpha Notes',
          geometry: { x: 240, y: 96, width: 980, height: 660 },
        }),
        selectedFolderId: 'case-alpha',
        folderId: 'case-alpha',
        clsLevel: 'TLP:RED',
        description: 'Sensitive investigation description',
        content: 'sensitive note body sentinel',
        messages: [{ role: 'user', content: 'prompt sentinel' }],
        notes: [{ title: 'sensitive note title' }],
        tasks: [{ title: 'sensitive task title' }],
      } as WorkspacePanelState,
    ], { name: 'Sensitive case layout' });

    expect(template.panels).toEqual([{
      id: 'notes-workspace',
      mode: 'floating',
      restoreMode: 'floating',
      geometry: { x: 240, y: 96, width: 980, height: 660 },
    }]);

    const raw = serializeWorkspaceLayoutTemplate(template);
    expect(raw).not.toContain('case-alpha');
    expect(raw).not.toContain('Case Alpha Notes');
    expect(raw).not.toContain('TLP:RED');
    expect(raw).not.toContain('Sensitive investigation description');
    expect(raw).not.toContain('sensitive note body sentinel');
    expect(raw).not.toContain('prompt sentinel');
    expect(raw).not.toContain('sensitive note title');
    expect(raw).not.toContain('sensitive task title');
  });

  it('round trips a named valid template with an allowlisted panel id', () => {
    const template = createWorkspaceLayoutTemplate([panel({})], { name: '  Analyst triage   layout  ' });
    const parsed = parseWorkspaceLayoutTemplate(serializeWorkspaceLayoutTemplate(template), allowedPanelIds);

    expect(parsed.ok).toBe(true);
    expect(parsed.template?.name).toBe('Analyst triage layout');
    expect(parsed.template?.panels).toEqual(template.panels);
  });

  it.each([
    ['invalid json', '{'],
    ['non-object root', '[]'],
    ['wrong kind', JSON.stringify({ kind: 'other', version: 1, panels: [] })],
    ['wrong version', JSON.stringify({ kind: 'threatcaddy.workspace-layout-template', version: 2, panels: [] })],
    ['empty panels', JSON.stringify({ kind: 'threatcaddy.workspace-layout-template', version: 1, panels: [] })],
    ['too many panels', JSON.stringify({ kind: 'threatcaddy.workspace-layout-template', version: 1, panels: Array.from({ length: 65 }, (_, index) => ({ id: `panel-${index}`, mode: 'floating', restoreMode: 'floating', geometry: { x: 1, y: 1, width: 500, height: 400 } })) })],
    ['unsupported root key', JSON.stringify({ kind: 'threatcaddy.workspace-layout-template', version: 1, notes: [], panels: [{ id: 'dashboard-workspace', mode: 'floating', restoreMode: 'floating', geometry: { x: 1, y: 1, width: 500, height: 400 } }] })],
    ['invalid name', JSON.stringify({ kind: 'threatcaddy.workspace-layout-template', version: 1, name: '   ', panels: [{ id: 'dashboard-workspace', mode: 'floating', restoreMode: 'floating', geometry: { x: 1, y: 1, width: 500, height: 400 } }] })],
    ['invalid exportedAt', JSON.stringify({ kind: 'threatcaddy.workspace-layout-template', version: 1, exportedAt: 123, panels: [{ id: 'dashboard-workspace', mode: 'floating', restoreMode: 'floating', geometry: { x: 1, y: 1, width: 500, height: 400 } }] })],
    ['non-record panel', JSON.stringify({ kind: 'threatcaddy.workspace-layout-template', version: 1, panels: ['dashboard-workspace'] })],
    ['unknown panel', JSON.stringify({ kind: 'threatcaddy.workspace-layout-template', version: 1, panels: [{ id: 'agentcaddy-workspace', mode: 'floating', restoreMode: 'floating', geometry: { x: 1, y: 1, width: 500, height: 400 } }] })],
    ['protected chat panel', JSON.stringify({ kind: 'threatcaddy.workspace-layout-template', version: 1, panels: [{ id: 'chat-workspace', mode: 'floating', restoreMode: 'floating', geometry: { x: 1, y: 1, width: 500, height: 400 } }] })],
    ['duplicate panel', JSON.stringify({ kind: 'threatcaddy.workspace-layout-template', version: 1, panels: [{ id: 'dashboard-workspace', mode: 'floating', restoreMode: 'floating', geometry: { x: 1, y: 1, width: 500, height: 400 } }, { id: 'dashboard-workspace', mode: 'docked', restoreMode: 'docked', geometry: { x: 1, y: 1, width: 500, height: 400 } }] })],
    ['unsupported panel key', JSON.stringify({ kind: 'threatcaddy.workspace-layout-template', version: 1, panels: [{ id: 'dashboard-workspace', mode: 'floating', restoreMode: 'floating', zIndex: 999, geometry: { x: 1, y: 1, width: 500, height: 400 } }] })],
    ['invalid mode', JSON.stringify({ kind: 'threatcaddy.workspace-layout-template', version: 1, panels: [{ id: 'dashboard-workspace', mode: 'external', restoreMode: 'floating', geometry: { x: 1, y: 1, width: 500, height: 400 } }] })],
    ['invalid restore mode', JSON.stringify({ kind: 'threatcaddy.workspace-layout-template', version: 1, panels: [{ id: 'dashboard-workspace', mode: 'minimized', restoreMode: 'minimized', geometry: { x: 1, y: 1, width: 500, height: 400 } }] })],
    ['invalid geometry', JSON.stringify({ kind: 'threatcaddy.workspace-layout-template', version: 1, panels: [{ id: 'dashboard-workspace', mode: 'floating', restoreMode: 'floating', geometry: { x: 'left', y: 1, width: 500, height: 400 } }] })],
    ['non-finite geometry', JSON.stringify({ kind: 'threatcaddy.workspace-layout-template', version: 1, panels: [{ id: 'dashboard-workspace', mode: 'floating', restoreMode: 'floating', geometry: { x: 1, y: 1, width: Number.NaN, height: 400 } }] })],
    ['unsupported geometry key', JSON.stringify({ kind: 'threatcaddy.workspace-layout-template', version: 1, panels: [{ id: 'dashboard-workspace', mode: 'floating', restoreMode: 'floating', geometry: { x: 1, y: 1, width: 500, height: 400, content: 'leak' } }] })],
    ['prototype pollution key', '{"kind":"threatcaddy.workspace-layout-template","version":1,"__proto__":{"polluted":true},"panels":[{"id":"dashboard-workspace","mode":"floating","restoreMode":"floating","geometry":{"x":1,"y":1,"width":500,"height":400}}]}'],
    ['too large', ' '.repeat(MAX_WORKSPACE_LAYOUT_TEMPLATE_BYTES + 1)],
  ])('rejects %s', (_label, raw) => {
    expect(parseWorkspaceLayoutTemplate(raw, allowedPanelIds).ok).toBe(false);
  });

  it.each([
    'selectedFolderId',
    'folderId',
    'clsLevel',
    'description',
    'content',
    'messages',
    'notes',
    'tasks',
  ])('rejects sensitive root metadata key %s', (key) => {
    const raw = JSON.stringify({
      kind: 'threatcaddy.workspace-layout-template',
      version: 1,
      [key]: key === 'messages' || key === 'notes' || key === 'tasks' ? [] : 'sensitive sentinel',
      panels: [{
        id: 'dashboard-workspace',
        mode: 'floating',
        restoreMode: 'floating',
        geometry: { x: 1, y: 1, width: 500, height: 400 },
      }],
    });

    expect(parseWorkspaceLayoutTemplate(raw, allowedPanelIds).ok).toBe(false);
  });

  it.each([
    'selectedFolderId',
    'folderId',
    'clsLevel',
    'description',
    'content',
    'messages',
    'notes',
    'tasks',
  ])('rejects sensitive panel metadata key %s', (key) => {
    const raw = JSON.stringify({
      kind: 'threatcaddy.workspace-layout-template',
      version: 1,
      panels: [{
        id: 'dashboard-workspace',
        mode: 'floating',
        restoreMode: 'floating',
        geometry: { x: 1, y: 1, width: 500, height: 400 },
        [key]: key === 'messages' || key === 'notes' || key === 'tasks' ? [] : 'sensitive sentinel',
      }],
    });

    expect(parseWorkspaceLayoutTemplate(raw, allowedPanelIds).ok).toBe(false);
  });

  it('clamps geometry to bounded numeric values', () => {
    const raw = JSON.stringify({
      kind: 'threatcaddy.workspace-layout-template',
      version: 1,
      exportedAt: '2026-06-07T00:00:00.000Z',
      panels: [{
        id: 'dashboard-workspace',
        mode: 'floating',
        restoreMode: 'floating',
        geometry: { x: -20, y: 999_999, width: 1, height: 999_999 },
      }],
    });

    const parsed = parseWorkspaceLayoutTemplate(raw, allowedPanelIds);
    expect(parsed.ok).toBe(true);
    expect(parsed.template?.panels[0]?.geometry).toEqual({
      x: 0,
      y: 5000,
      width: 240,
      height: 2400,
    });
  });
});
