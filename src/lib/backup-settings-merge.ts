/**
 * Restore-time settings merge (build spec DECISION 2 & 3).
 *
 * A backup's settings never silently destroy local configuration. Three modes:
 *   - keep    : ignore the backup's settings entirely.
 *   - merge   : fill blank local fields from the backup with no prompt; on a
 *               genuine conflict LOCAL WINS unless the user opts to take the
 *               backup's value for that section.
 *   - replace : the backup's non-secret settings win wholesale.
 *
 * Two things are constant across ALL modes:
 *   - Theme is additive — the backup's saved appearance themes are unioned in
 *     (by id), and no active appearance field is ever overwritten. The look of
 *     the machine the user is sitting at never changes on restore.
 *   - API keys are applied only when the block actually carries them (i.e. it
 *     came from a decrypted encrypted export) AND the user approves. Absence is
 *     never an instruction: a keyless backup leaves local keys untouched.
 *
 * The pure planner/computer here has no localStorage side effects so it is
 * fully unit-testable; applySettingsRestore is the thin wrapper that writes.
 */

import { loadStoredSettings, patchStoredSettings } from '../hooks/useSettings';
import type { CustomAppearanceTheme, Settings } from '../types';
import { API_KEY_FIELDS, type BackupSettingsBlock } from './backup-settings';

export type SettingsRestoreMode = 'keep' | 'merge' | 'replace';

/** Per-section decisions used only in `merge` mode: true = take the backup's
 * value on a conflict, false/absent = keep local (the default). */
export interface SettingsRestoreDecisions {
  general?: boolean;
  ai?: boolean;
  apiKeys?: boolean;
}

export interface SettingsFieldChange {
  key: string;
  localValue: unknown;
  backupValue: unknown;
  /** 'fill' = local is empty so the backup value applies with no prompt.
   *  'conflict' = both set and differ (surface a diff before deciding). */
  kind: 'fill' | 'conflict';
}

export interface SettingsRestorePlan {
  hasSettings: boolean;
  general: SettingsFieldChange[];
  ai: SettingsFieldChange[];
  /** Provider display names the backup carries keys for (e.g. 'Anthropic'). */
  apiKeyProviders: string[];
  /** Which key providers already have a local value (a conflict, not a fill). */
  apiKeyConflicts: string[];
  /** Named appearance themes that would be added (not already present by id). */
  newThemeNames: string[];
}

const API_KEY_LABELS: Record<string, string> = {
  llmAnthropicApiKey: 'Anthropic',
  llmOpenAIApiKey: 'OpenAI',
  llmGeminiApiKey: 'Gemini',
  llmMistralApiKey: 'Mistral',
  llmLocalApiKey: 'Local endpoint',
  assistantLlmLocalApiKey: 'AssistantCaddy local endpoint',
};

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === '' ||
    (Array.isArray(value) && value.length === 0);
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

function diffSection(backup: Record<string, unknown> | undefined, local: Record<string, unknown>): SettingsFieldChange[] {
  const changes: SettingsFieldChange[] = [];
  if (!backup) return changes;
  for (const [key, backupValue] of Object.entries(backup)) {
    if (backupValue === undefined) continue;
    const localValue = local[key];
    if (isBlank(localValue) && !isBlank(backupValue)) {
      changes.push({ key, localValue, backupValue, kind: 'fill' });
    } else if (!sameValue(localValue, backupValue)) {
      changes.push({ key, localValue, backupValue, kind: 'conflict' });
    }
  }
  return changes;
}

/** Describes what a restore would change, so the UI can present per-section
 * prompts with real diffs and name the key providers a backup carries. */
export function buildSettingsRestorePlan(
  block: BackupSettingsBlock | undefined,
  localSettings: Settings,
): SettingsRestorePlan {
  const local = localSettings as unknown as Record<string, unknown>;
  if (!block) {
    return { hasSettings: false, general: [], ai: [], apiKeyProviders: [], apiKeyConflicts: [], newThemeNames: [] };
  }

  const apiKeys = block.apiKeys || {};
  const apiKeyProviders: string[] = [];
  const apiKeyConflicts: string[] = [];
  for (const field of API_KEY_FIELDS) {
    const value = apiKeys[field as string];
    if (typeof value !== 'string' || value.trim() === '') continue;
    apiKeyProviders.push(API_KEY_LABELS[field as string] || (field as string));
    if (!isBlank(local[field as string])) apiKeyConflicts.push(API_KEY_LABELS[field as string] || (field as string));
  }

  const localThemes = (localSettings.customAppearanceThemes || []) as CustomAppearanceTheme[];
  const localThemeIds = new Set(localThemes.map((t) => t.id));
  const backupThemes = ((block.theme?.customAppearanceThemes as CustomAppearanceTheme[] | undefined) || []);
  const newThemeNames = backupThemes.filter((t) => t && t.id && !localThemeIds.has(t.id)).map((t) => t.name);

  return {
    hasSettings: Boolean(block.general || block.theme || block.ai || block.apiKeys),
    general: diffSection(block.general, local),
    ai: diffSection(block.ai, local),
    apiKeyProviders,
    apiKeyConflicts,
    newThemeNames,
  };
}

export interface SettingsRestoreResult {
  patch: Partial<Settings>;
  appliedSections: string[];
  appliedKeyProviders: string[];
  addedThemes: number;
}

/** Computes the exact Settings patch a restore would write — pure, no side
 * effects. `keep` returns an empty patch (theme still unions additively). */
export function computeSettingsRestore(
  block: BackupSettingsBlock | undefined,
  localSettings: Settings,
  mode: SettingsRestoreMode,
  decisions: SettingsRestoreDecisions = {},
): SettingsRestoreResult {
  const patch: Record<string, unknown> = {};
  const appliedSections: string[] = [];
  const appliedKeyProviders: string[] = [];
  if (!block) return { patch, appliedSections, appliedKeyProviders, addedThemes: 0 };

  const local = localSettings as unknown as Record<string, unknown>;

  const applyNonSecretSection = (section: 'general' | 'ai', values: Record<string, unknown> | undefined) => {
    if (!values || mode === 'keep') return;
    let touched = false;
    for (const [key, backupValue] of Object.entries(values)) {
      if (backupValue === undefined) continue;
      const localValue = local[key];
      if (mode === 'replace') {
        patch[key] = backupValue; touched = true;
      } else if (isBlank(localValue) && !isBlank(backupValue)) {
        patch[key] = backupValue; touched = true; // blank-fill, no prompt
      } else if (!sameValue(localValue, backupValue) && decisions[section] === true) {
        patch[key] = backupValue; touched = true; // conflict, user chose backup
      }
    }
    if (touched) appliedSections.push(section);
  };

  applyNonSecretSection('general', block.general);
  applyNonSecretSection('ai', block.ai);

  // Theme — always additive, active look never overwritten (all modes).
  // Non-theme appearance fields blank-fill only; saved themes union by id.
  let addedThemes = 0;
  if (block.theme) {
    for (const [key, backupValue] of Object.entries(block.theme)) {
      if (key === 'customAppearanceThemes' || backupValue === undefined) continue;
      if (isBlank(local[key]) && !isBlank(backupValue)) patch[key] = backupValue;
    }
    const localThemes = (localSettings.customAppearanceThemes || []) as CustomAppearanceTheme[];
    const localThemeIds = new Set(localThemes.map((t) => t.id));
    const backupThemes = ((block.theme.customAppearanceThemes as CustomAppearanceTheme[] | undefined) || [])
      .filter((t) => t && t.id && !localThemeIds.has(t.id));
    if (backupThemes.length > 0) {
      patch.customAppearanceThemes = [...localThemes, ...backupThemes];
      addedThemes = backupThemes.length;
    }
  }

  // API keys — only if the block carries them (decrypted export) and approved.
  // keep: never. replace: take backup. merge: blank-fill always, overwrite only
  // if the user chose to take the backup's keys.
  if (block.apiKeys && mode !== 'keep') {
    const takeBackupKeys = mode === 'replace' || decisions.apiKeys === true;
    for (const field of API_KEY_FIELDS) {
      const backupValue = block.apiKeys[field as string];
      if (typeof backupValue !== 'string' || backupValue.trim() === '') continue;
      const localValue = local[field as string];
      if (isBlank(localValue) || takeBackupKeys) {
        patch[field as string] = backupValue;
        const label = API_KEY_LABELS[field as string] || (field as string);
        if (!appliedKeyProviders.includes(label)) appliedKeyProviders.push(label);
      }
    }
  }

  return { patch: patch as Partial<Settings>, appliedSections, appliedKeyProviders, addedThemes };
}

/** Applies a settings restore to localStorage. Reads the live local snapshot,
 * computes the patch, and writes it in one shot. Returns what was applied. */
export function applySettingsRestore(
  block: BackupSettingsBlock | undefined,
  mode: SettingsRestoreMode,
  decisions: SettingsRestoreDecisions = {},
): SettingsRestoreResult {
  const local = loadStoredSettings();
  const result = computeSettingsRestore(block, local, mode, decisions);
  if (Object.keys(result.patch).length > 0) patchStoredSettings(result.patch);
  return result;
}

export { API_KEY_LABELS };
