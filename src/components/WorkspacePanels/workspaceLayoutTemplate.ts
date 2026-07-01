import type {
  WorkspacePanelGeometry,
  WorkspacePanelMode,
  WorkspacePanelState,
} from './workspace-panel-context';

const WORKSPACE_LAYOUT_TEMPLATE_KIND = 'threatcaddy.workspace-layout-template';
const WORKSPACE_LAYOUT_TEMPLATE_VERSION = 1;
export const MAX_WORKSPACE_LAYOUT_TEMPLATE_BYTES = 128_000;
const MAX_TEMPLATE_PANELS = 64;
const MIN_TEMPLATE_WIDTH = 240;
const MIN_TEMPLATE_HEIGHT = 180;
const MAX_TEMPLATE_WIDTH = 3200;
const MAX_TEMPLATE_HEIGHT = 2400;
const MAX_TEMPLATE_POSITION = 5000;
const MAX_TEMPLATE_NAME_LENGTH = 64;
const TEMPLATE_KEYS = new Set(['kind', 'version', 'name', 'exportedAt', 'panels']);
const TEMPLATE_PANEL_KEYS = new Set(['id', 'mode', 'restoreMode', 'geometry']);
const TEMPLATE_GEOMETRY_KEYS = new Set(['x', 'y', 'width', 'height']);

export interface WorkspaceLayoutTemplatePanel {
  id: string;
  mode: WorkspacePanelMode;
  restoreMode: Exclude<WorkspacePanelMode, 'minimized'>;
  geometry: WorkspacePanelGeometry;
}

export interface WorkspaceLayoutTemplate {
  kind: typeof WORKSPACE_LAYOUT_TEMPLATE_KIND;
  version: typeof WORKSPACE_LAYOUT_TEMPLATE_VERSION;
  name?: string;
  exportedAt: string;
  panels: WorkspaceLayoutTemplatePanel[];
}

export interface WorkspaceLayoutTemplateParseResult {
  ok: boolean;
  template?: WorkspaceLayoutTemplate;
  error?: string;
}

export function createWorkspaceLayoutTemplate(
  panels: WorkspacePanelState[],
  options: { name?: string } = {},
): WorkspaceLayoutTemplate {
  const name = sanitizeWorkspaceLayoutName(options.name);
  const template: WorkspaceLayoutTemplate = {
    kind: WORKSPACE_LAYOUT_TEMPLATE_KIND,
    version: WORKSPACE_LAYOUT_TEMPLATE_VERSION,
    exportedAt: new Date().toISOString(),
    panels: panels
      .slice()
      .sort((left, right) => left.zIndex - right.zIndex || left.id.localeCompare(right.id))
      .map((panel) => ({
        id: panel.id,
        mode: panel.mode,
        restoreMode: panel.restoreMode,
        geometry: sanitizeWorkspaceLayoutGeometry(panel.geometry),
      })),
  };

  if (name) {
    template.name = name;
  }

  return template;
}

export function serializeWorkspaceLayoutTemplate(template: WorkspaceLayoutTemplate) {
  return `${JSON.stringify(template, null, 2)}\n`;
}

export function parseWorkspaceLayoutTemplate(
  raw: string,
  allowedPanelIds: ReadonlySet<string>,
): WorkspaceLayoutTemplateParseResult {
  if (!raw || raw.length > MAX_WORKSPACE_LAYOUT_TEMPLATE_BYTES) {
    return { ok: false, error: 'Workspace layout template is empty or too large.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Workspace layout template is not valid JSON.' };
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: 'Workspace layout template must be a JSON object.' };
  }

  if (!hasOnlyKeys(parsed, TEMPLATE_KEYS)) {
    return { ok: false, error: 'Workspace layout template contains unsupported metadata.' };
  }

  if (parsed.kind !== WORKSPACE_LAYOUT_TEMPLATE_KIND || parsed.version !== WORKSPACE_LAYOUT_TEMPLATE_VERSION) {
    return { ok: false, error: 'Workspace layout template has an unsupported kind or version.' };
  }

  const name = typeof parsed.name === 'string'
    ? sanitizeWorkspaceLayoutName(parsed.name)
    : undefined;
  if ('name' in parsed && !name) {
    return { ok: false, error: 'Workspace layout template contains an invalid name.' };
  }

  if ('exportedAt' in parsed && typeof parsed.exportedAt !== 'string') {
    return { ok: false, error: 'Workspace layout template contains an invalid export timestamp.' };
  }

  if (!Array.isArray(parsed.panels) || parsed.panels.length === 0 || parsed.panels.length > MAX_TEMPLATE_PANELS) {
    return { ok: false, error: 'Workspace layout template has an invalid panel list.' };
  }

  const seenPanelIds = new Set<string>();
  const panels: WorkspaceLayoutTemplatePanel[] = [];

  for (const entry of parsed.panels) {
    if (!isRecord(entry)) {
      return { ok: false, error: 'Workspace layout template contains an invalid panel entry.' };
    }

    if (!hasOnlyKeys(entry, TEMPLATE_PANEL_KEYS)) {
      return { ok: false, error: 'Workspace layout template contains unsupported panel metadata.' };
    }

    if (typeof entry.id !== 'string' || !allowedPanelIds.has(entry.id) || seenPanelIds.has(entry.id)) {
      return { ok: false, error: 'Workspace layout template contains an unknown or duplicate panel id.' };
    }

    if (!isWorkspacePanelMode(entry.mode)) {
      return { ok: false, error: 'Workspace layout template contains an invalid panel mode.' };
    }

    if (!isRestoreMode(entry.restoreMode)) {
      return { ok: false, error: 'Workspace layout template contains an invalid restore mode.' };
    }

    const geometry = parseGeometry(entry.geometry);
    if (!geometry) {
      return { ok: false, error: 'Workspace layout template contains invalid panel geometry.' };
    }

    seenPanelIds.add(entry.id);
    panels.push({
      id: entry.id,
      mode: entry.mode,
      restoreMode: entry.restoreMode,
      geometry,
    });
  }

  return {
    ok: true,
    template: {
      kind: WORKSPACE_LAYOUT_TEMPLATE_KIND,
      version: WORKSPACE_LAYOUT_TEMPLATE_VERSION,
      ...(name ? { name } : {}),
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt.slice(0, 64) : new Date(0).toISOString(),
      panels,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: ReadonlySet<string>) {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isWorkspacePanelMode(value: unknown): value is WorkspacePanelMode {
  return value === 'docked' || value === 'floating' || value === 'minimized';
}

function isRestoreMode(value: unknown): value is Exclude<WorkspacePanelMode, 'minimized'> {
  return value === 'docked' || value === 'floating';
}

function parseGeometry(value: unknown): WorkspacePanelGeometry | null {
  if (!isRecord(value)) return null;
  if (!hasOnlyKeys(value, TEMPLATE_GEOMETRY_KEYS)) return null;

  const { x, y, width, height } = value;
  if (
    typeof x !== 'number'
    || typeof y !== 'number'
    || typeof width !== 'number'
    || typeof height !== 'number'
    || !Number.isFinite(x)
    || !Number.isFinite(y)
    || !Number.isFinite(width)
    || !Number.isFinite(height)
  ) {
    return null;
  }

  return sanitizeWorkspaceLayoutGeometry({
    x,
    y,
    width,
    height,
  });
}

function sanitizeWorkspaceLayoutGeometry(geometry: WorkspacePanelGeometry): WorkspacePanelGeometry {
  return {
    x: clampLayoutNumber(Math.round(geometry.x), 0, MAX_TEMPLATE_POSITION),
    y: clampLayoutNumber(Math.round(geometry.y), 0, MAX_TEMPLATE_POSITION),
    width: clampLayoutNumber(Math.round(geometry.width), MIN_TEMPLATE_WIDTH, MAX_TEMPLATE_WIDTH),
    height: clampLayoutNumber(Math.round(geometry.height), MIN_TEMPLATE_HEIGHT, MAX_TEMPLATE_HEIGHT),
  };
}

function clampLayoutNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function sanitizeWorkspaceLayoutName(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, MAX_TEMPLATE_NAME_LENGTH);
}
