import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { snapshotSettingsForBackup, classifySettingKey } from '../lib/backup-settings';
import {
  buildSettingsRestorePlan,
  computeSettingsRestore,
} from '../lib/backup-settings-merge';
import { buildFullBackupPayload } from '../lib/backup-data';
import { encryptBackup, decryptBackup } from '../lib/backup-crypto';
import type { Settings } from '../types';

const SETTINGS_KEY = 'threatcaddy-settings';

function setStoredSettings(partial: Record<string, unknown>) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(partial));
}

describe('backup settings — field classification & key gating (DECISION 1 & 4)', () => {
  beforeEach(() => localStorage.clear());

  it('classifies keys, appearance, and model config into the right buckets', () => {
    expect(classifySettingKey('llmAnthropicApiKey')).toBe('apiKey');
    expect(classifySettingKey('llmLocalApiKey')).toBe('apiKey');
    expect(classifySettingKey('colorScheme')).toBe('theme');
    expect(classifySettingKey('bgEffectPattern')).toBe('theme');
    expect(classifySettingKey('customAppearanceThemes')).toBe('theme');
    expect(classifySettingKey('llmDefaultModel')).toBe('ai');
    expect(classifySettingKey('assistantLlmDefaultProvider')).toBe('ai');
    expect(classifySettingKey('defaultView')).toBe('general');
  });

  it('includes API keys only when explicitly opted in', () => {
    setStoredSettings({
      llmAnthropicApiKey: 'sk-ant-secret',
      llmLocalApiKey: 'local-secret',
      llmDefaultModel: 'claude',
      colorScheme: 'emerald',
      defaultView: 'dashboard',
    });

    const withKeys = snapshotSettingsForBackup(true);
    expect(withKeys.apiKeys).toEqual({ llmAnthropicApiKey: 'sk-ant-secret', llmLocalApiKey: 'local-secret' });
    expect(withKeys.ai).toMatchObject({ llmDefaultModel: 'claude' });
    expect(withKeys.theme).toMatchObject({ colorScheme: 'emerald' });
    // Keys must never leak into the non-secret buckets.
    expect(JSON.stringify(withKeys.general)).not.toContain('secret');
    expect(JSON.stringify(withKeys.ai)).not.toContain('secret');
    expect(JSON.stringify(withKeys.theme)).not.toContain('secret');
  });

  it('excludes API keys entirely on the plaintext path', () => {
    setStoredSettings({ llmAnthropicApiKey: 'sk-ant-secret', llmDefaultModel: 'claude' });
    const plain = snapshotSettingsForBackup(false);
    expect(plain.apiKeys).toBeUndefined();
    expect(JSON.stringify(plain)).not.toContain('secret');
  });
});

describe('backup payload — keys never leave the machine to shared destinations (DECISION 4)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await db.notes.clear();
  });

  it('buildFullBackupPayload defaults includeApiKeys to false (cloud/team safe)', async () => {
    setStoredSettings({ llmAnthropicApiKey: 'sk-ant-secret', llmDefaultModel: 'claude' });
    const payload = await buildFullBackupPayload('all');
    expect(payload.settings).toBeDefined();
    expect(payload.settings?.apiKeys).toBeUndefined();
    expect(JSON.stringify(payload.settings)).not.toContain('secret');
  });

  it('a cloud/team payload stays key-free even after it is encrypted', async () => {
    setStoredSettings({ llmAnthropicApiKey: 'sk-ant-secret' });
    const payload = await buildFullBackupPayload('all'); // shared-destination default
    const blob = await encryptBackup('team-password', payload);
    const restored = await decryptBackup('team-password', blob);
    expect(restored.settings?.apiKeys).toBeUndefined();
  });

  it('the local encrypted export round-trips keys when opted in', async () => {
    setStoredSettings({ llmAnthropicApiKey: 'sk-ant-secret', llmOpenAIApiKey: 'sk-oai-secret' });
    const payload = await buildFullBackupPayload('all', undefined, { includeApiKeys: true });
    const blob = await encryptBackup('laptop-password', payload);
    const restored = await decryptBackup('laptop-password', blob);
    expect(restored.settings?.apiKeys).toEqual({
      llmAnthropicApiKey: 'sk-ant-secret',
      llmOpenAIApiKey: 'sk-oai-secret',
    });
  });
});

describe('settings restore merge (DECISION 2 & 3)', () => {
  const local = {
    defaultView: 'dashboard',
    llmDefaultModel: 'local-model',
    llmVerbosity: 'concise',
    colorScheme: 'indigo',
    customAppearanceThemes: [{ id: 'local-1', name: 'My Theme', swatch: '#111', dark: {}, light: {}, createdAt: 1, updatedAt: 1 }],
  } as unknown as Settings;

  const block = {
    v: 1 as const,
    general: { defaultView: 'notes', displayName: 'Analyst' },
    ai: { llmDefaultModel: 'cloud-model', llmVerbosity: 'detailed' },
    theme: {
      colorScheme: 'emerald',
      customAppearanceThemes: [
        { id: 'local-1', name: 'My Theme (dupe)', swatch: '#222', dark: {}, light: {}, createdAt: 2, updatedAt: 2 },
        { id: 'backup-9', name: 'Backup Look', swatch: '#333', dark: {}, light: {}, createdAt: 3, updatedAt: 3 },
      ],
    },
    apiKeys: { llmAnthropicApiKey: 'sk-ant-backup' },
  };

  it('merge fills blank local fields with no prompt, keeps set fields (local wins) by default', () => {
    const { patch } = computeSettingsRestore(block, local, 'merge');
    // displayName was blank locally -> filled from backup.
    expect(patch.displayName).toBe('Analyst');
    // defaultView & llmDefaultModel conflict -> local wins (not in patch).
    expect(patch.defaultView).toBeUndefined();
    expect(patch.llmDefaultModel).toBeUndefined();
  });

  it('merge takes the backup value on a conflict only when the section is opted in', () => {
    const { patch } = computeSettingsRestore(block, local, 'merge', { ai: true });
    expect(patch.llmDefaultModel).toBe('cloud-model'); // ai section opted in
    expect(patch.defaultView).toBeUndefined();          // general still local-wins
  });

  it('replace takes non-secret settings wholesale but never overwrites the active theme', () => {
    const { patch } = computeSettingsRestore(block, local, 'replace');
    expect(patch.defaultView).toBe('notes');
    expect(patch.llmDefaultModel).toBe('cloud-model');
    // colorScheme is an active appearance field — NOT overwritten even in replace.
    expect(patch.colorScheme).toBeUndefined();
  });

  it('theme is additive across all modes: unions saved themes by id, never removes local ones', () => {
    for (const mode of ['keep', 'merge', 'replace'] as const) {
      const { patch, addedThemes } = computeSettingsRestore(block, local, mode);
      expect(addedThemes).toBe(1); // only backup-9 is new; local-1 dupe is skipped
      const themes = patch.customAppearanceThemes as { id: string }[];
      expect(themes.map((t) => t.id)).toEqual(['local-1', 'backup-9']);
    }
  });

  it('keys are applied only when present and approved; a keyless backup never touches local keys', () => {
    // Backup with keys, keep mode -> keys not applied.
    expect(computeSettingsRestore(block, local, 'keep').patch.llmAnthropicApiKey).toBeUndefined();
    // Backup with keys, merge, local key blank -> filled.
    const filled = computeSettingsRestore(block, local, 'merge');
    expect(filled.patch.llmAnthropicApiKey).toBe('sk-ant-backup');
    expect(filled.appliedKeyProviders).toContain('Anthropic');
    // A backup that carries NO apiKeys block -> local keys untouched.
    const noKeys = computeSettingsRestore({ ...block, apiKeys: undefined }, local, 'merge');
    expect(noKeys.patch.llmAnthropicApiKey).toBeUndefined();
  });

  it('the plan names the key providers and new themes for the prompt UI', () => {
    const localWithKey = { ...local, llmAnthropicApiKey: 'existing' } as unknown as Settings;
    const plan = buildSettingsRestorePlan(block, localWithKey);
    expect(plan.apiKeyProviders).toContain('Anthropic');
    expect(plan.apiKeyConflicts).toContain('Anthropic'); // local already has one
    expect(plan.newThemeNames).toEqual(['Backup Look']);
  });
});
