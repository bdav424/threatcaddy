import { useState, useEffect, useCallback } from 'react';
import type { Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { applyColorScheme } from '../lib/theme-schemes';
import { normalizeLocalLlmEndpoint } from '../lib/local-llm-endpoint';
import { sanitizeEmailAccounts } from '../lib/email-onboarding';
import i18n, { RTL_LANGS } from '../i18n';

const SETTINGS_KEY = 'threatcaddy-settings';

function applyLocalDevLlmDefaults(settings: Settings): Settings {
  if (typeof window === 'undefined') return settings;
  const localDevPorts = new Set(['4174', '4175', '4179']);
  if (window.location.hostname !== '127.0.0.1' || !localDevPorts.has(window.location.port)) return settings;
  if (settings.llmLocalEndpoint || settings.llmLocalModelName || settings.llmDefaultProvider) return settings;

  return {
    ...settings,
    llmDefaultProvider: 'local',
    llmDefaultModel: 'gpt-5.4',
    llmLocalEndpoint: 'http://127.0.0.1:11435/v1',
    llmLocalApiKey: 'codex-local-dev',
    llmLocalModelName: 'gpt-5.4',
  };
}

function migrateSettings(raw: Record<string, unknown>): Record<string, unknown> {
  if (typeof raw.llmLocalEndpoint === 'string') {
    const normalized = normalizeLocalLlmEndpoint(raw.llmLocalEndpoint);
    raw.llmLocalEndpoint = normalized || undefined;
  }
  // Migrate flat tiIocSubtypes array → per-type map
  if (Array.isArray(raw.tiIocSubtypes)) {
    const flat = raw.tiIocSubtypes as string[];
    if (flat.length > 0) {
      // Assign all old subtypes to every IOC type so user data isn't lost
      const allTypes = ['ipv4','ipv6','domain','url','email','md5','sha1','sha256','cve','mitre-attack','yara-rule','sigma-rule','file-path'];
      const perType: Record<string, string[]> = {};
      for (const t of allTypes) perType[t] = [...flat];
      raw.tiIocSubtypes = perType;
    } else {
      raw.tiIocSubtypes = undefined;
    }
  }
  // Migrate flat tiRelationshipTypes array → empty map (old format was just labels)
  if (Array.isArray(raw.tiRelationshipTypes)) {
    raw.tiRelationshipTypes = undefined;
  }
  // Migrate legacy External Backup signed URL fields → backupDestinations array
  if (raw.externalBackupWriteUrl && typeof raw.externalBackupWriteUrl === 'string' && !raw.backupDestinations) {
    raw.backupDestinations = [{
      id: 'migrated-external-backup',
      provider: 'external-backup',
      label: (raw.externalBackupLabel as string) || 'External Backup',
      url: raw.externalBackupWriteUrl as string,
      enabled: true,
    }];
  }
  if (!raw.llmRoutingMode) {
    raw.llmRoutingMode = 'auto';
  }
  if ('emailAccounts' in raw) {
    raw.emailAccounts = sanitizeEmailAccounts(raw.emailAccounts);
  }
  return raw;
}

function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const raw = migrateSettings(JSON.parse(stored));
      return applyLocalDevLlmDefaults({ ...DEFAULT_SETTINGS, ...raw } as Settings);
    }
  } catch {
    // ignore
  }
  return applyLocalDevLlmDefaults(DEFAULT_SETTINGS);
}

/** Read the current settings snapshot from localStorage without creating React state. */
export function loadStoredSettings(): Settings {
  return loadSettings();
}

/** Merge updates into the stored settings. Does NOT trigger any React re-renders. */
export function patchStoredSettings(updates: Partial<Settings>): void {
  try {
    const current = loadSettings();
    const next = { ...current, ...updates };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

/** Reads and persists user settings from localStorage. Returns the current settings object and an update function. */
export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>(loadSettings);
  const isDesktopShell = typeof window !== 'undefined' && !!window.threatcaddyDesktop?.isDesktop;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('tc-desktop-shell', isDesktopShell);
    document.body.classList.toggle('tc-desktop-shell-body', isDesktopShell);
    if (settings.theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      document.body.classList.add('text-gray-100');
      document.body.classList.remove('text-gray-900');
      if (isDesktopShell) {
        document.body.classList.remove('bg-gray-950', 'bg-white');
      } else {
        document.body.classList.add('bg-gray-950');
        document.body.classList.remove('bg-white');
      }
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      document.body.classList.remove('text-gray-100');
      document.body.classList.add('text-gray-900');
      if (isDesktopShell) {
        document.body.classList.remove('bg-gray-950', 'bg-white');
      } else {
        document.body.classList.remove('bg-gray-950');
        document.body.classList.add('bg-white');
      }
    }
  }, [isDesktopShell, settings.theme]);

  // Apply color scheme whenever theme or scheme changes
  useEffect(() => {
    const selectedCustomTheme = settings.customAppearanceThemes?.find((theme) => theme.id === settings.colorScheme);
    const resolvedFontFamily = settings.appearanceFontFamily || selectedCustomTheme?.fontFamily;
    const resolvedFontTargets = settings.appearanceFontTargets ?? selectedCustomTheme?.fontTargets ?? {};
    applyColorScheme(
      settings.colorScheme ?? 'indigo',
      settings.theme,
      settings.customAppearanceThemes,
      resolvedFontFamily,
      settings.appearanceFontScale,
    );
    const root = document.documentElement;
    root.style.setProperty('--tc-font-family-headings', resolvedFontTargets.headings || resolvedFontFamily || 'var(--tc-font-family)');
    root.style.setProperty('--tc-font-family-body', resolvedFontTargets.body || resolvedFontFamily || 'var(--tc-font-family)');
    root.style.setProperty('--tc-font-family-controls', resolvedFontTargets.controls || resolvedFontFamily || 'var(--tc-font-family)');
    root.style.setProperty('--tc-font-family-navigation', resolvedFontTargets.navigation || resolvedFontFamily || 'var(--tc-font-family)');
    root.style.setProperty('--tc-font-family-code', resolvedFontTargets.code || 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace');
  }, [settings.colorScheme, settings.theme, settings.customAppearanceThemes, settings.appearanceFontFamily, settings.appearanceFontScale, settings.appearanceFontTargets]);

  // Apply language and text direction
  useEffect(() => {
    const lang = settings.language ?? 'en';
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
    document.documentElement.dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr';
  }, [settings.language]);

  // Apply glass styling only to bordered panels, not the app shell or background image.
  useEffect(() => {
    const root = document.documentElement;
    const frostedPanels = settings.frostedPanels ?? false;
    // Frost is toggle-only: always apply a preset when enabled, no user-adjustable sliders.
    const effectiveTransparency = frostedPanels ? 30 : 0;
    const effectiveBlur = frostedPanels ? 14 : 0;
    const ratio = 1 - effectiveTransparency / 100;
    const panelOpacity = (base: number) => Math.max(0, base * ratio).toFixed(1);
    const enabled = effectiveTransparency > 0 || effectiveBlur > 0;

    root.classList.toggle('has-panel-glass', enabled);
    root.classList.remove('has-window-glass', 'has-window-blur');
    root.style.setProperty('--tc-panel-glass-surface', `color-mix(in srgb, var(--color-bg-surface) ${panelOpacity(100)}%, transparent)`);
    root.style.setProperty('--tc-panel-glass-surface-80', `color-mix(in srgb, var(--color-bg-surface) ${panelOpacity(80)}%, transparent)`);
    root.style.setProperty('--tc-panel-glass-surface-50', `color-mix(in srgb, var(--color-bg-surface) ${panelOpacity(50)}%, transparent)`);
    root.style.setProperty('--tc-panel-glass-surface-40', `color-mix(in srgb, var(--color-bg-surface) ${panelOpacity(40)}%, transparent)`);
    root.style.setProperty('--tc-panel-glass-surface-30', `color-mix(in srgb, var(--color-bg-surface) ${panelOpacity(30)}%, transparent)`);
    root.style.setProperty('--tc-panel-glass-raised', `color-mix(in srgb, var(--color-bg-raised) ${panelOpacity(100)}%, transparent)`);
    root.style.setProperty('--tc-panel-glass-raised-60', `color-mix(in srgb, var(--color-bg-raised) ${panelOpacity(60)}%, transparent)`);
    root.style.setProperty('--tc-panel-glass-raised-50', `color-mix(in srgb, var(--color-bg-raised) ${panelOpacity(50)}%, transparent)`);
    root.style.setProperty('--tc-panel-glass-raised-40', `color-mix(in srgb, var(--color-bg-raised) ${panelOpacity(40)}%, transparent)`);
    root.style.setProperty('--tc-panel-glass-active', `color-mix(in srgb, var(--color-bg-active) ${panelOpacity(100)}%, transparent)`);
    root.style.setProperty('--tc-panel-glass-active-50', `color-mix(in srgb, var(--color-bg-active) ${panelOpacity(50)}%, transparent)`);
    root.style.setProperty('--tc-panel-glass-active-30', `color-mix(in srgb, var(--color-bg-active) ${panelOpacity(30)}%, transparent)`);
    root.style.setProperty('--tc-panel-glass-sidebar', `color-mix(in srgb, var(--color-bg-surface) ${panelOpacity(100)}%, transparent)`);
    root.style.setProperty('--tc-panel-glass-border', `color-mix(in srgb, var(--color-border-medium) ${Math.max(22, 100 - effectiveTransparency * 0.45).toFixed(1)}%, transparent)`);
    root.style.setProperty('--tc-panel-glass-blur', `${effectiveBlur}px`);
    root.style.setProperty('--tc-window-ambient-opacity', '0');
    root.style.setProperty('--tc-window-frost-strength', '0');
    root.style.setProperty('--tc-window-blur', '0px');

    if (isDesktopShell) {
      void window.threatcaddyDesktop?.setWindowGlass({ transparency: 0, blur: 0 }).catch(() => {
        // The desktop wrapper may still be starting up; keep the web UI responsive regardless.
      });
    }
  }, [isDesktopShell, settings.frostedPanels]);

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setSettingsState((prev) => {
      const next = {
        ...prev,
        ...updates,
        emailAccounts: updates.emailAccounts
          ? sanitizeEmailAccounts(updates.emailAccounts)
          : prev.emailAccounts,
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  }, [settings.theme, updateSettings]);

  return { settings, updateSettings, toggleTheme };
}
