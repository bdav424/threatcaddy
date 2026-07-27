/**
 * Settings serialization for backups.
 *
 * Settings live in localStorage (not IndexedDB), so this is a separate path
 * from the table dump in backup-data.ts. Two security rules, per the build
 * spec, are enforced HERE so every backup surface inherits them:
 *
 *  1. API keys are pulled into their own `apiKeys` bucket and are included
 *     ONLY when the caller explicitly opts in (`includeApiKeys: true`) — which
 *     only the local encrypted-file export does. Cloud/team-server backups and
 *     any plaintext export omit keys entirely.
 *  2. The block is versioned (`v: 1`) so a future nested-encryption scheme can
 *     bump the version without breaking older backups.
 */

import { loadStoredSettings } from '../hooks/useSettings';
import type { Settings } from '../types';

export interface BackupSettingsBlock {
  v: 1;
  general?: Record<string, unknown>;
  theme?: Record<string, unknown>;
  ai?: Record<string, unknown>;
  /** Present only on the local encrypted export (see includeApiKeys). */
  apiKeys?: Record<string, string>;
}

/** The exhaustive set of secret Settings fields. Anything here is treated as a
 * credential: bucketed into `apiKeys`, gated behind the encrypted export, and
 * never written to a cloud/team backup. Keep this list complete — a key that
 * isn't listed would leak into the plaintext `general`/`ai` buckets. */
export const API_KEY_FIELDS: readonly (keyof Settings)[] = [
  'llmAnthropicApiKey',
  'llmOpenAIApiKey',
  'llmGeminiApiKey',
  'llmMistralApiKey',
  'llmLocalApiKey',
  'assistantLlmLocalApiKey',
] as const;

const API_KEY_FIELD_SET = new Set<string>(API_KEY_FIELDS as readonly string[]);

/** Appearance / theme-option fields. These stay plaintext (non-secret) and,
 * on restore, are treated additively so a restore never changes the machine's
 * active look (see backup-settings-merge). */
function isThemeField(key: string): boolean {
  return (
    key === 'theme' ||
    key === 'colorScheme' ||
    key === 'frostedPanels' ||
    key === 'glassStyle' ||
    key === 'panelTransparency' ||
    key === 'sidebarAccentStyle' ||
    key === 'customAppearanceThemes' ||
    /^appearance/.test(key) ||
    /^windowGlass/.test(key) ||
    /^bg(Image|Effect|Glow|Particle)/.test(key) ||
    /^rgb/.test(key)
  );
}

/** Model/endpoint/behavior config (non-secret — the keys themselves are pulled
 * out separately). */
function isAiField(key: string): boolean {
  if (API_KEY_FIELD_SET.has(key)) return false;
  return /^llm/.test(key) || /^assistantLlm/.test(key) || /^agentSupervisor/.test(key);
}

export type SettingsSection = 'general' | 'theme' | 'ai';

export function classifySettingKey(key: string): SettingsSection | 'apiKey' {
  if (API_KEY_FIELD_SET.has(key)) return 'apiKey';
  if (isThemeField(key)) return 'theme';
  if (isAiField(key)) return 'ai';
  return 'general';
}

/** Builds the settings block for a backup. `includeApiKeys` MUST be false for
 * any surface whose output leaves the machine to a shared destination. */
export function snapshotSettingsForBackup(includeApiKeys: boolean): BackupSettingsBlock {
  const settings = loadStoredSettings() as unknown as Record<string, unknown>;
  const general: Record<string, unknown> = {};
  const theme: Record<string, unknown> = {};
  const ai: Record<string, unknown> = {};
  const apiKeys: Record<string, string> = {};

  for (const [key, value] of Object.entries(settings)) {
    if (value === undefined) continue;
    const section = classifySettingKey(key);
    if (section === 'apiKey') {
      // Only carry non-empty keys, and only when explicitly opted in.
      if (includeApiKeys && typeof value === 'string' && value.trim() !== '') apiKeys[key] = value;
      continue;
    }
    if (section === 'theme') theme[key] = value;
    else if (section === 'ai') ai[key] = value;
    else general[key] = value;
  }

  const block: BackupSettingsBlock = { v: 1 };
  if (Object.keys(general).length > 0) block.general = general;
  if (Object.keys(theme).length > 0) block.theme = theme;
  if (Object.keys(ai).length > 0) block.ai = ai;
  if (includeApiKeys && Object.keys(apiKeys).length > 0) block.apiKeys = apiKeys;
  return block;
}
