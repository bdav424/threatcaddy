import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { SettingsPanel } from '../components/Settings/SettingsPanel';
import { DEFAULT_SETTINGS } from '../types';
import type { Settings } from '../types';
import { DEFAULT_DARK_THEME_COLORS } from '../lib/theme-schemes';

// Mock contexts
vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn(), toasts: [], removeToast: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ connected: false, user: null, serverUrl: null }),
}));

// Mock child components that have complex dependencies
vi.mock('../components/Settings/ExportImport', () => ({
  ExportImport: () => <div data-testid="export-import">ExportImport</div>,
}));
vi.mock('../components/Settings/ThreatIntelConfig', () => ({
  ThreatIntelConfig: () => <div data-testid="threat-intel-config">ThreatIntelConfig</div>,
}));
vi.mock('../components/Settings/CloudBackup', () => ({
  CloudBackup: () => <div data-testid="cloud-backup">CloudBackup</div>,
}));
vi.mock('../components/Settings/KeyboardShortcuts', () => ({
  KeyboardShortcuts: () => <div data-testid="keyboard-shortcuts">KeyboardShortcuts</div>,
}));
vi.mock('../components/Encryption/EncryptionSettings', () => ({
  EncryptionSettings: () => <div data-testid="encryption-settings">EncryptionSettings</div>,
}));
vi.mock('../components/Integrations/IntegrationPanel', () => ({
  IntegrationPanel: () => <div data-testid="integration-panel">IntegrationPanel</div>,
}));
vi.mock('../components/Settings/ServerBackup', () => ({
  ServerBackup: () => <div data-testid="server-backup">ServerBackup</div>,
}));

const defaultProps = {
  settings: { ...DEFAULT_SETTINGS } as Settings,
  onUpdateSettings: vi.fn(),
  notes: [],
  onImportComplete: vi.fn(),
};

function clickTab(label: string) {
  fireEvent.click(screen.getByRole('tab', { name: new RegExp(label, 'i') }));
}

function restoreEyeDropper() {
  delete (window as Window & { EyeDropper?: unknown }).EyeDropper;
}

function openAppearanceCustomize() {
  clickTab('Appearance');
  fireEvent.click(screen.getByRole('button', { name: /^Customize$/i }));
}

function lastSettingsUpdate(onUpdateSettings: ReturnType<typeof vi.fn>) {
  const lastCall = onUpdateSettings.mock.calls[onUpdateSettings.mock.calls.length - 1];
  expect(lastCall).toBeTruthy();
  return lastCall[0] as Partial<Settings>;
}

function colorEditor() {
  const editor = document.querySelector('[data-appearance-color-editor="true"]');
  expect(editor).toBeTruthy();
  return within(editor as HTMLElement);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  restoreEyeDropper();
});

describe('SettingsPanel', () => {
  it('renders Settings heading', () => {
    render(<SettingsPanel {...defaultProps} />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('keeps Settings navigation as compact top tabs', () => {
    render(<SettingsPanel {...defaultProps} />);
    const tablist = screen.getByRole('tablist', { name: /settings/i });
    expect(within(tablist).getByRole('tab', { name: /^General$/i })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: /^Appearance$/i })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: /^AI$/i })).toBeInTheDocument();
    expect(screen.queryByText('Workspace, identity, and notification defaults.')).not.toBeInTheDocument();
  });

  it('renders Display Preferences section on General tab', () => {
    render(<SettingsPanel {...defaultProps} />);
    expect(screen.getByText('Display Preferences')).toBeInTheDocument();
  });

  it('renders Anthropic API Key input on AI tab', () => {
    render(<SettingsPanel {...defaultProps} />);
    clickTab('AI');
    expect(screen.getByText('Anthropic API Key')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('sk-ant-...')).toBeInTheDocument();
  });

  it('renders OpenAI API Key input on AI tab', () => {
    render(<SettingsPanel {...defaultProps} />);
    clickTab('AI');
    expect(screen.getByText('OpenAI API Key')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('sk-...')).toBeInTheDocument();
  });

  it('renders Google Gemini API Key input on AI tab', () => {
    render(<SettingsPanel {...defaultProps} />);
    clickTab('AI');
    expect(screen.getByText('Google Gemini API Key')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('AIza...')).toBeInTheDocument();
  });

  it('renders Mistral API Key input on AI tab', () => {
    render(<SettingsPanel {...defaultProps} />);
    clickTab('AI');
    expect(screen.getByText('Mistral API Key')).toBeInTheDocument();
  });

  it('fires onChange for Anthropic API key', () => {
    const onUpdateSettings = vi.fn();
    render(<SettingsPanel {...defaultProps} onUpdateSettings={onUpdateSettings} />);
    clickTab('AI');
    const input = screen.getByPlaceholderText('sk-ant-...');
    fireEvent.change(input, { target: { value: 'sk-ant-test123' } });
    expect(onUpdateSettings).toHaveBeenCalledWith({ llmAnthropicApiKey: 'sk-ant-test123' });
  });

  it('fires onChange for OpenAI API key', () => {
    const onUpdateSettings = vi.fn();
    render(<SettingsPanel {...defaultProps} onUpdateSettings={onUpdateSettings} />);
    clickTab('AI');
    const input = screen.getByPlaceholderText('sk-...');
    fireEvent.change(input, { target: { value: 'sk-openai-test' } });
    expect(onUpdateSettings).toHaveBeenCalledWith({ llmOpenAIApiKey: 'sk-openai-test' });
  });

  it('renders Local LLM section on AI tab', () => {
    render(<SettingsPanel {...defaultProps} />);
    clickTab('AI');
    expect(screen.getByText('Local LLM (Ollama / LM Studio / vLLM)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('http://localhost:11434/v1')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('llama3.1, qwen2.5, mistral-nemo, etc.')).toBeInTheDocument();
  });

  it('renders Default Model selector on AI tab', () => {
    render(<SettingsPanel {...defaultProps} />);
    clickTab('AI');
    expect(screen.getByText('Default Model')).toBeInTheDocument();
  });

  it('shows "API key saved" when Anthropic key is set', () => {
    const settings = { ...DEFAULT_SETTINGS, llmAnthropicApiKey: 'sk-test' } as Settings;
    render(<SettingsPanel {...defaultProps} settings={settings} />);
    clickTab('AI');
    expect(screen.getByText('API key saved')).toBeInTheDocument();
  });

  it('shows "API key saved" when Gemini key is set', () => {
    const settings = { ...DEFAULT_SETTINGS, llmGeminiApiKey: 'AIza-test' } as Settings;
    render(<SettingsPanel {...defaultProps} settings={settings} />);
    clickTab('AI');
    expect(screen.getByText('API key saved')).toBeInTheDocument();
  });

  it('hides "API key saved" when no keys are set on AI tab', () => {
    render(<SettingsPanel {...defaultProps} />);
    clickTab('AI');
    expect(screen.queryByText('API key saved')).not.toBeInTheDocument();
  });

  it('renders Data tab components', () => {
    render(<SettingsPanel {...defaultProps} />);
    clickTab('Data');
    expect(screen.getByTestId('export-import')).toBeInTheDocument();
    expect(screen.getByTestId('encryption-settings')).toBeInTheDocument();
    expect(screen.getByTestId('cloud-backup')).toBeInTheDocument();
  });

  it('renders Threat Intel tab components', () => {
    render(<SettingsPanel {...defaultProps} />);
    clickTab('Intel');
    expect(screen.getByTestId('threat-intel-config')).toBeInTheDocument();
  });

  it('renders Integrations tab components', () => {
    render(<SettingsPanel {...defaultProps} />);
    clickTab('Integrations');
    expect(screen.getByRole('region', { name: 'Integrations source catalog' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Email integrations' })).toBeInTheDocument();
    expect(screen.getByTestId('integration-panel')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review installed tools separately' })).not.toBeInTheDocument();
  });

  it('renders Shortcuts tab components', () => {
    render(<SettingsPanel {...defaultProps} />);
    clickTab('Shortcuts');
    expect(screen.getByTestId('keyboard-shortcuts')).toBeInTheDocument();
  });

  it('updates sidebar accent style from Appearance tab', () => {
    const onUpdateSettings = vi.fn();
    render(<SettingsPanel {...defaultProps} onUpdateSettings={onUpdateSettings} />);
    clickTab('Appearance');
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    fireEvent.click(screen.getByRole('button', { name: /Color Chips/i }));
    expect(onUpdateSettings).toHaveBeenCalledWith({ sidebarAccentStyle: 'color-chips' });
  });

  it('shows separate ThreatCaddy and Odysseus theme sections on Appearance tab', () => {
    render(<SettingsPanel {...defaultProps} />);
    clickTab('Appearance');
    expect(screen.getByText('ThreatCaddy themes')).toBeInTheDocument();
    expect(screen.getByText('Odysseus themes')).toBeInTheDocument();
  });

  it('applies the preferred mode and visual defaults when choosing an Odysseus theme', () => {
    const onUpdateSettings = vi.fn();
    render(<SettingsPanel {...defaultProps} onUpdateSettings={onUpdateSettings} />);
    clickTab('Appearance');
    fireEvent.click(screen.getByRole('button', { name: /Original/i }));
    expect(onUpdateSettings).toHaveBeenCalledWith({
      colorScheme: 'odysseus-dark',
      theme: 'dark',
      bgEffectPattern: 'none',
      bgEffectColor: undefined,
      bgEffectIntensity: 100,
      bgEffectSize: 100,
      frostedPanels: false,
    });
  });

  it('applies Odysseus prebaked background pairings where defined', () => {
    const onUpdateSettings = vi.fn();
    render(<SettingsPanel {...defaultProps} onUpdateSettings={onUpdateSettings} />);
    clickTab('Appearance');
    fireEvent.click(screen.getByRole('button', { name: /Midnight/i }));
    expect(onUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({
      colorScheme: 'odysseus-midnight',
      theme: 'dark',
      bgEffectPattern: 'rain',
      bgEffectColor: '#ffffff',
      bgEffectIntensity: 50,
      frostedPanels: false,
    }));
    fireEvent.click(screen.getByRole('button', { name: /Terminal/i }));
    expect(onUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({
      colorScheme: 'odysseus-terminal',
      bgEffectPattern: 'perlin-flow',
      bgEffectColor: '#00ff41',
      bgEffectIntensity: 80,
    }));
    fireEvent.click(screen.getByRole('button', { name: /Cute/i }));
    expect(onUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({
      colorScheme: 'odysseus-cute',
      theme: 'light',
      bgEffectPattern: 'sparkles',
      bgEffectColor: '#ff8cb8',
    }));
  });

  it('swaps background animation from the bubble picker without changing the theme', () => {
    const onUpdateSettings = vi.fn();
    render(<SettingsPanel {...defaultProps} onUpdateSettings={onUpdateSettings} />);
    clickTab('Appearance');
    fireEvent.click(screen.getByRole('button', { name: /^Sparkles/i }));
    expect(onUpdateSettings).toHaveBeenCalledWith({
      bgEffectPattern: 'sparkles',
      bgEffectColor: '#f472b6',
    });
  });

  it('falls back to live preview color sampling when EyeDropper is unavailable', () => {
    const onUpdateSettings = vi.fn();
    restoreEyeDropper();
    render(<SettingsPanel {...defaultProps} onUpdateSettings={onUpdateSettings} />);
    openAppearanceCustomize();

    fireEvent.click(screen.getByRole('button', { name: /^Background$/i }));

    const previewPickerButton = screen.getByRole('button', { name: /Pick color from live preview/i });
    expect(previewPickerButton).toBeEnabled();
    fireEvent.click(previewPickerButton);
    expect(screen.getByText('Click a preview part to sample its color.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Warning signal$/i }));
    const sampledColor = DEFAULT_DARK_THEME_COLORS['--color-accent-amber'];
    expect(screen.getByLabelText('Background hex color')).toHaveValue(sampledColor);
    expect(onUpdateSettings).not.toHaveBeenCalled();

    fireEvent.click(colorEditor().getByRole('button', { name: 'Apply' }));

    const update = lastSettingsUpdate(onUpdateSettings);
    const theme = update.customAppearanceThemes?.[0];
    expect(theme?.dark['--color-bg-deep']).toBe(sampledColor);
    expect(theme?.dark['--color-accent']).not.toBe(sampledColor);
    expect(theme?.dark['--color-bg-surface']).not.toBe(sampledColor);
  });

  it('falls back to live preview color sampling when EyeDropper is present but unavailable', () => {
    const onUpdateSettings = vi.fn();
    Object.defineProperty(window, 'EyeDropper', {
      configurable: true,
      value: undefined,
    });
    render(<SettingsPanel {...defaultProps} onUpdateSettings={onUpdateSettings} />);
    openAppearanceCustomize();

    fireEvent.click(screen.getByRole('button', { name: /^Background$/i }));

    const previewPickerButton = screen.getByRole('button', { name: /Pick color from live preview/i });
    expect(previewPickerButton).toBeEnabled();
    fireEvent.click(previewPickerButton);
    expect(screen.getByText('Click a preview part to sample its color.')).toBeInTheDocument();
    expect(onUpdateSettings).not.toHaveBeenCalled();
  });

  it('uses supported EyeDropper results only for the active picker key', async () => {
    const onUpdateSettings = vi.fn();
    const open = vi.fn().mockResolvedValue({ sRGBHex: '#112233' });
    class MockEyeDropper {
      open = open;
    }
    Object.defineProperty(window, 'EyeDropper', {
      configurable: true,
      value: MockEyeDropper,
    });
    render(<SettingsPanel {...defaultProps} onUpdateSettings={onUpdateSettings} />);
    openAppearanceCustomize();

    fireEvent.click(screen.getByRole('button', { name: /^Accent$/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick color from screen' }));

    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByLabelText('Accent hex color')).toHaveValue('#112233'));

    fireEvent.click(colorEditor().getByRole('button', { name: 'Apply' }));

    const update = lastSettingsUpdate(onUpdateSettings);
    const theme = update.customAppearanceThemes?.[0];
    expect(theme?.dark['--color-accent']).toBe('#112233');
    expect(theme?.dark['--color-bg-deep']).not.toBe('#112233');
    expect(theme?.dark['--color-bg-surface']).not.toBe('#112233');
  });

  it('ignores stale EyeDropper results after the user changes picker target', async () => {
    const onUpdateSettings = vi.fn();
    let resolveDropper: (value: { sRGBHex: string }) => void = () => undefined;
    const open = vi.fn(() => new Promise<{ sRGBHex: string }>((resolve) => {
      resolveDropper = resolve;
    }));
    class MockEyeDropper {
      open = open;
    }
    Object.defineProperty(window, 'EyeDropper', {
      configurable: true,
      value: MockEyeDropper,
    });
    render(<SettingsPanel {...defaultProps} onUpdateSettings={onUpdateSettings} />);
    openAppearanceCustomize();

    fireEvent.click(screen.getByRole('button', { name: /^Accent$/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick color from screen' }));
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /^Background$/i }));
    resolveDropper({ sRGBHex: '#112233' });

    await waitFor(() => expect(screen.getByLabelText('Background hex color')).not.toHaveValue('#112233'));
    fireEvent.change(screen.getByLabelText('Background hex color'), { target: { value: '#334455' } });
    fireEvent.click(colorEditor().getByRole('button', { name: 'Apply' }));

    const update = lastSettingsUpdate(onUpdateSettings);
    const theme = update.customAppearanceThemes?.[0];
    expect(theme?.dark['--color-bg-deep']).toBe('#334455');
    expect(theme?.dark['--color-accent']).not.toBe('#112233');
    expect(theme?.dark['--color-bg-deep']).not.toBe('#112233');
  });

  it('keeps a palette picker bound to its opened mode and color key', () => {
    const onUpdateSettings = vi.fn();
    render(<SettingsPanel {...defaultProps} onUpdateSettings={onUpdateSettings} />);
    openAppearanceCustomize();

    fireEvent.click(screen.getByRole('button', { name: /^Background$/i }));
    fireEvent.change(screen.getByLabelText('Background hex color'), { target: { value: '#223344' } });
    fireEvent.click(screen.getByRole('button', { name: /^light$/i }));
    fireEvent.click(colorEditor().getByRole('button', { name: 'Apply' }));

    const update = lastSettingsUpdate(onUpdateSettings);
    const theme = update.customAppearanceThemes?.[0];
    expect(theme?.dark['--color-bg-deep']).toBe('#223344');
    expect(theme?.light['--color-bg-deep']).not.toBe('#223344');
    expect(theme?.dark['--color-bg-surface']).not.toBe('#223344');
  });

  it('keeps Color Harmony accent edits local until generation', () => {
    const onUpdateSettings = vi.fn();
    render(<SettingsPanel {...defaultProps} onUpdateSettings={onUpdateSettings} />);
    openAppearanceCustomize();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Color Harmony accent color' }));
    fireEvent.change(screen.getByLabelText('Color Harmony accent hex color'), { target: { value: '#123abc' } });
    fireEvent.click(colorEditor().getByRole('button', { name: 'Apply' }));

    expect(screen.getByLabelText('Color Harmony accent color')).toHaveValue('#123abc');
    expect(onUpdateSettings).not.toHaveBeenCalled();
  });

  it('updates only the background effect color override from the effect picker', () => {
    const onUpdateSettings = vi.fn();
    render(<SettingsPanel {...defaultProps} onUpdateSettings={onUpdateSettings} />);
    clickTab('Appearance');

    fireEvent.click(screen.getByRole('button', { name: 'Edit effect color' }));
    fireEvent.change(screen.getByLabelText('Background effect color hex color'), { target: { value: '#abcdef' } });
    fireEvent.click(colorEditor().getByRole('button', { name: 'Apply' }));

    expect(lastSettingsUpdate(onUpdateSettings)).toEqual({ bgEffectColor: '#abcdef' });
  });

  it('derives background effect colors from the active theme and exposes hue controls', () => {
    const onUpdateSettings = vi.fn();
    const settings = {
      ...DEFAULT_SETTINGS,
      bgEffectPattern: 'sparkles',
      bgEffectColor: '#336699',
    } as Settings;
    render(<SettingsPanel {...defaultProps} settings={settings} onUpdateSettings={onUpdateSettings} />);
    clickTab('Appearance');

    fireEvent.click(screen.getByRole('button', { name: 'Use theme color' }));
    expect(onUpdateSettings).toHaveBeenCalledWith({ bgEffectColor: DEFAULT_DARK_THEME_COLORS['--color-accent-pink'] });

    fireEvent.change(screen.getByLabelText('Background effect hue'), { target: { value: '120' } });
    expect(lastSettingsUpdate(onUpdateSettings).bgEffectColor).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('sanitizes invalid background effect settings before rendering color controls', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      bgEffectPattern: 'url(https://example.invalid/probe)' as Settings['bgEffectPattern'],
      bgEffectColor: 'url(https://example.invalid/color)' as Settings['bgEffectColor'],
    } as Settings;
    render(<SettingsPanel {...defaultProps} settings={settings} />);
    clickTab('Appearance');

    expect(screen.getByRole('button', { name: /^Solid/i })).toHaveClass('border-accent');
    expect(screen.getByLabelText('Effect color')).toHaveValue(DEFAULT_DARK_THEME_COLORS['--color-text-primary']);
  });

  it('keeps visible color picker controls enabled and labelled', () => {
    render(<SettingsPanel {...defaultProps} />);
    clickTab('Appearance');

    expect(screen.getByRole('button', { name: 'Edit effect color' })).toBeEnabled();
    expect(screen.getByLabelText('Effect color')).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /^Customize$/i }));
    expect(screen.getByRole('button', { name: 'Edit Color Harmony accent color' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /^Background$/i }));
    expect(screen.getByRole('button', { name: /Pick color from live preview|Pick color from screen/i })).toBeEnabled();
  });

  it('keeps AssistantCaddy AI setup separate from email/calendar provider setup and routes to Integrations', () => {
    const onUpdateSettings = vi.fn();
    const fetchSpy = vi.fn();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const storageSetSpy = vi.spyOn(Storage.prototype, 'setItem');
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsPanel {...defaultProps} onUpdateSettings={onUpdateSettings} />);
    clickTab('AI');

    const aiRegion = within(screen.getByRole('region', { name: 'AssistantCaddy AI setup' }));
    expect(aiRegion.getByText('Existing CaddyAI route')).toBeInTheDocument();
    expect(aiRegion.getByText('OpenAI-compatible API')).toBeInTheDocument();
    expect(aiRegion.getByText('Local Ollama / localhost')).toBeInTheDocument();
    expect(aiRegion.getByText('Generic adapter placeholder')).toBeInTheDocument();
    expect(aiRegion.getAllByText('Not configured').length).toBeGreaterThanOrEqual(3);
    expect(aiRegion.getByText('Email and calendar setup live under Integrations/route-specific setup, not AssistantCaddy AI.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Email provider onboarding' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Calendar provider onboarding' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Email integrations' })).not.toBeInTheDocument();
    expect(screen.queryByText('Gmail / Google')).not.toBeInTheDocument();
    expect(aiRegion.queryByRole('button', { name: 'Open email setup' })).not.toBeInTheDocument();
    expect(aiRegion.queryByRole('button', { name: 'Open calendar setup' })).not.toBeInTheDocument();

    expect(onUpdateSettings).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storageSetSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    fireEvent.click(aiRegion.getAllByRole('button', { name: 'Open Integrations' })[0]);
    expect(screen.getByRole('region', { name: 'Integrations source catalog' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Email integrations' })).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storageSetSpy).not.toHaveBeenCalled();
  });

  it('shows AssistantCaddy provider execution gate status as inert blocked guidance', () => {
    const onUpdateSettings = vi.fn();
    const fetchSpy = vi.fn();
    const storageGetSpy = vi.spyOn(Storage.prototype, 'getItem');
    const storageKeySpy = vi.spyOn(Storage.prototype, 'key');
    const storageSetSpy = vi.spyOn(Storage.prototype, 'setItem');
    const storageRemoveSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const storageClearSpy = vi.spyOn(Storage.prototype, 'clear');
    const settings = {
      ...DEFAULT_SETTINGS,
      llmDefaultProvider: 'openai',
      llmDefaultModel: 'gpt-4.1',
      llmOpenAIApiKey: 'sk-synthetic-placeholder',
    } as Settings;
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsPanel {...defaultProps} settings={settings} onUpdateSettings={onUpdateSettings} />);
    clickTab('AI');

    const gateRegion = within(screen.getByRole('region', { name: 'Assistant provider execution gate' }));
    expect(gateRegion.getByText('Execution gate preview')).toBeInTheDocument();
    expect(gateRegion.getByText(/These descriptors do not test providers, list models, send prompts, fetch provider APIs, probe local endpoints, or store API keys/i)).toBeInTheDocument();
    expect(gateRegion.getByText(/Test Connection and Fetch Models controls below are explicit Local LLM runtime controls outside this gate/i)).toBeInTheDocument();
    expect(gateRegion.getAllByText('Blocked')).toHaveLength(3);
    expect(gateRegion.getAllByText('No opaque credential reference exists; raw API-key settings are not used by this gate.')).toHaveLength(3);
    expect(gateRegion.getAllByText('Default is no auto-call, no provider call, and no local probe.')).toHaveLength(3);
    expect(gateRegion.queryByRole('button', { name: 'Test Connection' })).not.toBeInTheDocument();
    expect(gateRegion.queryByRole('button', { name: 'Fetch Models' })).not.toBeInTheDocument();
    expect(gateRegion.queryByText('API key saved')).not.toBeInTheDocument();

    const runtimePreview = within(screen.getByRole('region', { name: 'AssistantCaddy runtime UI wiring preview' }));
    expect(runtimePreview.getByText('Runtime wiring preview')).toBeInTheDocument();
    expect(runtimePreview.getByText(/Dry-run\/readiness rows from the connector runtime UI wiring contract/i)).toBeInTheDocument();
    expect(runtimePreview.getByText(/does not test providers, list models, send prompts, probe local endpoints, persist state, or store credentials/i)).toBeInTheDocument();
    const runtimeRegion = screen.getByRole('region', { name: 'AssistantCaddy runtime UI wiring preview' });
    expect(runtimeRegion).toHaveAttribute('data-connector-runtime-ui-wiring', 'assistantcaddy');
    expect(runtimeRegion).toHaveAttribute('data-connector-runtime-ui-contract', 'connector-runtime-ui-wiring-plan-v1');
    expect(runtimeRegion).toHaveAttribute('data-connector-runtime-ui-executable', 'false');
    expect(runtimeRegion).toHaveAttribute('data-connector-runtime-ui-side-effects', 'none');
    for (const rowId of ['provider-auth-session-plan', 'local-bridge-manual-probe', 'connector-runtime-persistence']) {
      const row = runtimeRegion.querySelector(`[data-connector-runtime-ui-row="${rowId}"]`);
      expect(row).toBeInstanceOf(HTMLElement);
      expect(row).toHaveAttribute('data-connector-runtime-ui-status', 'blocked');
      expect(row).toHaveAttribute('data-connector-runtime-ui-executable', 'false');
      expect(row).toHaveAttribute('data-connector-runtime-ui-side-effects', 'none');
    }
    expect(runtimePreview.queryByRole('button', { name: 'Test Connection' })).not.toBeInTheDocument();
    expect(runtimePreview.queryByRole('button', { name: 'Fetch Models' })).not.toBeInTheDocument();

    const keySettings = within(screen.getByRole('region', { name: 'Legacy LLM API key settings' }));
    expect(keySettings.getByText(/outside the Assistant provider execution gate/i)).toBeInTheDocument();
    expect(keySettings.getByText(/do not create opaque credential references or execution readiness/i)).toBeInTheDocument();

    const localRuntime = within(screen.getByRole('region', { name: 'Explicit Local LLM runtime controls' }));
    expect(localRuntime.getByRole('button', { name: 'Test Connection' })).toBeInTheDocument();
    expect(localRuntime.getByRole('button', { name: 'Fetch Models' })).toBeInTheDocument();
    expect(localRuntime.getByText(/outside the inert Assistant provider execution gate/i)).toBeInTheDocument();

    const inertActions = [
      gateRegion.getByRole('button', { name: 'Test provider (inert)' }),
      gateRegion.getByRole('button', { name: 'List models (inert)' }),
      gateRegion.getByRole('button', { name: 'Send prompt (inert)' }),
    ];
    inertActions.forEach((button) => {
      expect(button).toBeDisabled();
      fireEvent.click(button);
    });

    expect(onUpdateSettings).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storageGetSpy).not.toHaveBeenCalled();
    expect(storageKeySpy).not.toHaveBeenCalled();
    expect(storageSetSpy).not.toHaveBeenCalled();
    expect(storageRemoveSpy).not.toHaveBeenCalled();
    expect(storageClearSpy).not.toHaveBeenCalled();
  });

  it('keeps local AssistantCaddy execution gate preview from probing local endpoints', () => {
    const fetchSpy = vi.fn();
    const storageGetSpy = vi.spyOn(Storage.prototype, 'getItem');
    const storageKeySpy = vi.spyOn(Storage.prototype, 'key');
    const storageSetSpy = vi.spyOn(Storage.prototype, 'setItem');
    const storageRemoveSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const storageClearSpy = vi.spyOn(Storage.prototype, 'clear');
    const settings = {
      ...DEFAULT_SETTINGS,
      llmDefaultProvider: 'local',
      llmDefaultModel: 'llama3.1',
      llmLocalEndpoint: 'http://127.0.0.1:11434/v1',
      llmLocalModelName: 'llama3.1',
    } as Settings;
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsPanel {...defaultProps} settings={settings} />);
    clickTab('AI');

    const gateRegion = within(screen.getByRole('region', { name: 'Assistant provider execution gate' }));
    expect(gateRegion.getAllByText('Local endpoint remains plan-only; no local probe was run.').length).toBeGreaterThan(0);
    expect(gateRegion.getAllByText('decision-only-no-fetch-no-socket-no-storage-no-llm')).toHaveLength(3);
    expect(gateRegion.queryByRole('button', { name: 'Test Connection' })).not.toBeInTheDocument();
    expect(gateRegion.queryByRole('button', { name: 'Fetch Models' })).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storageGetSpy).not.toHaveBeenCalled();
    expect(storageKeySpy).not.toHaveBeenCalled();
    expect(storageSetSpy).not.toHaveBeenCalled();
    expect(storageRemoveSpy).not.toHaveBeenCalled();
    expect(storageClearSpy).not.toHaveBeenCalled();
  });

  it('selects AssistantCaddy backing providers without probing provider endpoints', () => {
    const onUpdateSettings = vi.fn();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsPanel {...defaultProps} onUpdateSettings={onUpdateSettings} />);
    clickTab('AI');

    fireEvent.click(screen.getByRole('button', { name: 'Use OpenAI-compatible API' }));
    expect(lastSettingsUpdate(onUpdateSettings)).toEqual({
      llmDefaultProvider: 'openai',
      llmDefaultModel: 'gpt-4.1',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Use local Ollama / localhost' }));
    expect(lastSettingsUpdate(onUpdateSettings)).toEqual({ llmDefaultProvider: 'local' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps explicit Local LLM runtime fetch behavior outside the inert Assistant provider gate', async () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      llmLocalEndpoint: 'http://127.0.0.1:11434/v1',
      llmLocalModelName: 'llama3.1',
      llmDefaultProvider: 'local',
      llmDefaultModel: 'llama3.1',
    } as Settings;
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => 'local bridge refused test',
    });
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsPanel {...defaultProps} settings={settings} />);
    clickTab('AI');

    const aiRegion = within(screen.getByRole('region', { name: 'AssistantCaddy AI setup' }));
    const gateRegion = within(screen.getByRole('region', { name: 'Assistant provider execution gate' }));
    const localRuntime = within(screen.getByRole('region', { name: 'Explicit Local LLM runtime controls' }));
    expect(aiRegion.getByText('Local-only')).toBeInTheDocument();
    expect(localRuntime.getByText(/may contact the configured local endpoint only when clicked/i)).toBeInTheDocument();
    expect(gateRegion.queryByRole('button', { name: 'Test Connection' })).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    fireEvent.click(localRuntime.getByRole('button', { name: 'Test Connection' }));

    await waitFor(() => expect(aiRegion.getByText('Failed')).toBeInTheDocument());
    expect(fetchSpy).toHaveBeenCalled();
  });
});
