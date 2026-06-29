import { useState, useCallback, useEffect } from 'react';
import { cn } from '../../lib/utils';
import DOMPurify from 'dompurify';
import { Github, Download, FlaskConical, Trash2, Bot, X, Shield, RefreshCw, RotateCcw, Plus, Pencil, Wrench, Loader2, CheckCircle2, AlertTriangle, LayoutGrid, Palette, Database, FileText, Link, Keyboard, Zap, Mail, MessageSquare, Video, Users, Hash, Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../../i18n';
import { useToast } from '../../contexts/ToastContext';
import type { CtiEvidence, CtiSourceId, Settings, Note, NoteTemplate, PlaybookTemplate, PlaybookStep, CustomSlashCommand } from '../../types';
import { useCustomSlashCommands } from '../../hooks/useCustomSlashCommands';
import { TemplateManager } from './TemplateManager';
import { PlaybookManager } from './PlaybookManager';
import { DEFAULT_SYSTEM_PROMPT } from '../../lib/llm-tools';
import {
  DEFAULT_CTI_SOURCE_TEMPLATES,
  getCtiTemplate,
  parseCtiTemplateJson,
  renderCtiEvidenceMarkdown,
} from '../../lib/cti-source-formatting';
import { DEFAULT_MODEL_PER_PROVIDER, MODELS, MODEL_PROVIDER_MAP } from '../../lib/models';
import { ExportImport } from './ExportImport';
import { useAgentProfiles } from '../../hooks/useAgentProfiles';
import { AgentProfileManager } from '../Agent/AgentProfileManager';
import { ThreatIntelConfig } from './ThreatIntelConfig';
import { CloudBackup } from './CloudBackup';
import { ServerBackup } from './ServerBackup';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { EncryptionSettings } from '../Encryption/EncryptionSettings';
import { ServerConnection } from './ServerConnection';
import { TotpManagement } from './TotpManagement';
import { PasskeyManagement } from './PasskeyManagement';
import { SyncDevicesPanel } from './SyncDevicesPanel';
import { SlackDmsPanel } from './SlackDmsPanel';
import { IntegrationPanel } from '../Integrations/IntegrationPanel';
import { AppearanceSettings } from './AppearanceSettings';
import { AgentHostsConfig } from './AgentHostsConfig';
import { SystemHygienePanel } from './SystemHygienePanel';
import { CredentialVault } from './CredentialVault';
import { SyncAuthSettings } from './SyncAuthSettings';
import { getLocalLlmHealthUrl, normalizeLocalLlmEndpoint } from '../../lib/local-llm-endpoint';
import { getInvestigationColorMode, setInvestigationColorMode, type InvestigationColorMode } from '../../lib/investigation-color-mode';

function SystemPromptEditor({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  const { t } = useTranslation('settings');
  const [expanded, setExpanded] = useState(false);
  const isCustom = !!value?.trim();
  const displayValue = value ?? DEFAULT_SYSTEM_PROMPT;

  return (
    <div className="border border-gray-700 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-gray-300 font-medium hover:text-gray-100 transition-colors text-start"
        >
          {t('ai.systemPrompt')} {expanded ? 'â–¾' : 'â–¸'}
        </button>
        <div className="flex items-center gap-2">
          {isCustom && (
            <span className="text-[10px] text-accent font-medium">{t('ai.systemPromptCustom')}</span>
          )}
          {isCustom && (
            <button
              onClick={() => onChange(undefined)}
              className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
              title={t('ai.systemPromptResetTitle')}
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <>
          <p className="text-[10px] text-gray-500">
            {t('ai.systemPromptHelp')}
          </p>
          <textarea
            value={displayValue}
            onChange={(e) => {
              const v = e.target.value;
              // If identical to default, clear custom override
              onChange(v.trim() === DEFAULT_SYSTEM_PROMPT.trim() ? undefined : v);
            }}
            rows={16}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent font-mono resize-y min-h-[200px]"
          />
        </>
      )}
    </div>
  );
}

interface SettingsPanelProps {
  settings: Settings;
  onUpdateSettings: (updates: Partial<Settings>) => void;
  notes: Note[];
  onImportComplete: () => void;
  sampleLoaded?: boolean;
  onLoadSample?: () => void;
  onDeleteSample?: () => void;
  onClose?: () => void;
  initialTab?: SettingsTab;
  templateProps?: {
    templates: NoteTemplate[];
    userTemplates: NoteTemplate[];
    categories: string[];
    onCreateTemplate: (data: Partial<NoteTemplate> & { name: string; content: string }) => Promise<NoteTemplate>;
    onUpdateTemplate: (id: string, updates: Partial<NoteTemplate>) => Promise<void>;
    onDeleteTemplate: (id: string) => Promise<void>;
    onDuplicateBuiltin: (builtinId: string) => Promise<NoteTemplate | null>;
  };
  playbookProps?: {
    playbooks: PlaybookTemplate[];
    userPlaybooks: PlaybookTemplate[];
    onCreatePlaybook: (data: Partial<PlaybookTemplate> & { name: string; steps: PlaybookStep[] }) => Promise<PlaybookTemplate>;
    onUpdatePlaybook: (id: string, updates: Partial<PlaybookTemplate>) => Promise<void>;
    onDeletePlaybook: (id: string) => Promise<void>;
  };
}

type SettingsTab = 'general' | 'appearance' | 'ai' | 'agents' | 'data' | 'templates' | 'intel' | 'integrations' | 'shortcuts' | 'system';

// â”€â”€ Custom Slash Commands Editor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AgentProfileSection() {
  const { profiles, userProfiles, builtinProfiles, createProfile, updateProfile, deleteProfile, duplicateBuiltin } = useAgentProfiles();
  return (
    <AgentProfileManager
      profiles={profiles}
      userProfiles={userProfiles}
      builtinProfiles={builtinProfiles}
      onCreateProfile={createProfile}
      onUpdateProfile={updateProfile}
      onDeleteProfile={deleteProfile}
      onDuplicateBuiltin={duplicateBuiltin}
    />
  );
}

function CustomSlashCommandsEditor() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const { t: tt } = useTranslation('toast');
  const { commands, createCommand, updateCommand, deleteCommand } = useCustomSlashCommands();
  const { addToast } = useToast();
  const [editing, setEditing] = useState<CustomSlashCommand | null>(null);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formTemplate, setFormTemplate] = useState('');

  const resetForm = () => { setFormName(''); setFormDesc(''); setFormTemplate(''); setEditing(null); setCreating(false); };

  const handleSave = async () => {
    const name = formName.replace(/^\//, '').trim();
    if (!name || !formTemplate.trim()) return;
    if (editing) {
      await updateCommand(editing.id, { name, description: formDesc, template: formTemplate });
      addToast('success', tt('settings.slashCommandUpdated', { name }));
    } else {
      await createCommand(name, formDesc, formTemplate);
      addToast('success', tt('settings.slashCommandCreated', { name }));
    }
    resetForm();
  };

  const startEdit = (cmd: CustomSlashCommand) => {
    setEditing(cmd);
    setCreating(true);
    setFormName(cmd.name);
    setFormDesc(cmd.description);
    setFormTemplate(cmd.template);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-1.5">
          <Wrench size={14} /> {t('ai.slashCommands')}
        </h3>
        {!creating && (
          <button onClick={() => setCreating(true)} className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover">
            <Plus size={12} /> {tc('add')}
          </button>
        )}
      </div>

      {commands.length === 0 && !creating && (
        <p className="text-xs text-gray-500">{t('ai.slashCommandsEmpty')}</p>
      )}

      {commands.map(cmd => (
        <div key={cmd.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-800/50 border border-gray-700/50">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-mono text-purple font-medium">/{cmd.name}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{cmd.description || t('ai.noDescription')}</div>
            <div className="text-[10px] text-gray-600 mt-0.5 truncate font-mono">{cmd.template.slice(0, 80)}</div>
          </div>
          <button onClick={() => startEdit(cmd)} aria-label={tc('edit')} className="p-1 text-gray-500 hover:text-gray-300"><Pencil size={12} /></button>
          <button onClick={async () => { await deleteCommand(cmd.id); addToast('success', tt('settings.slashCommandDeleted', { name: cmd.name })); }} aria-label={tc('delete')} className="p-1 text-gray-500 hover:text-red-400"><Trash2 size={12} /></button>
        </div>
      ))}

      {creating && (
        <div className="space-y-2 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
          <input
            type="text"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            placeholder={t('ai.commandNamePlaceholder')}
            className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-accent font-mono"
          />
          <input
            type="text"
            value={formDesc}
            onChange={e => setFormDesc(e.target.value)}
            placeholder={t('ai.commandDescPlaceholder')}
            className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-accent"
          />
          <textarea
            value={formTemplate}
            onChange={e => setFormTemplate(e.target.value)}
            placeholder={t('ai.commandTemplatePlaceholder')}
            rows={4}
            className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-accent resize-none font-mono"
          />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={!formName.trim() || !formTemplate.trim()} className="px-3 py-1.5 rounded bg-accent text-white text-xs font-medium hover:brightness-110 disabled:opacity-50">
              {editing ? tc('save') : tc('create')}
            </button>
            <button onClick={resetForm} className="px-3 py-1.5 rounded bg-gray-700 text-gray-300 text-xs hover:bg-gray-600">{tc('cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function sampleTemplateEvidence(source: CtiSourceId): CtiEvidence {
  if (source === 'virustotal') {
    return {
      source,
      sourceLabel: 'VirusTotal',
      sourceKey: source,
      sourceName: 'VirusTotal',
      observable: '8.8.8.8',
      status: 'ok',
      verdict: 'usable',
      highlights: ['analysisStats: 0 malicious, 0 suspicious, 56 harmless, 36 undetected', 'ownerContext: Google LLC'],
      sections: {
        objectId: '8.8.8.8',
        objectType: 'ip_address',
        analysisStats: '0 malicious, 0 suspicious, 56 harmless, 36 undetected',
        reputation: 539,
        ownerContext: 'Google LLC',
        tags: ['dns', 'resolver'],
      },
      fields: {
        objectId: '8.8.8.8',
        objectType: 'ip_address',
        analysisStats: '0 malicious, 0 suspicious, 56 harmless, 36 undetected',
        reputation: 539,
        ownerContext: 'Google LLC',
        tags: ['dns', 'resolver'],
      },
      caveats: ['Preview only; live evidence is rendered from Agent Host results.'],
      recommendedPivots: ['Review related resolutions and passive DNS.'],
      warnings: [],
      raw: { preview: true },
    };
  }
  if (source === 'censys') {
    return {
      source,
      sourceLabel: 'Censys',
      sourceKey: source,
      sourceName: 'Censys',
      observable: '8.8.8.8',
      status: 'ok',
      verdict: 'usable',
      highlights: ['servicesCount: 4', 'asContext: GOOGLE - Google LLC'],
      sections: {
        host: '8.8.8.8',
        apiMode: 'legacy',
        servicesCount: 4,
        asContext: 'GOOGLE - Google LLC',
        reverseDns: ['dns.google'],
        serviceSample: ['443/TCP HTTPS - 302 Moved', '53/UDP DNS'],
      },
      fields: {
        host: '8.8.8.8',
        apiMode: 'legacy',
        servicesCount: 4,
        asContext: 'GOOGLE - Google LLC',
        reverseDns: ['dns.google'],
        serviceSample: ['443/TCP HTTPS - 302 Moved', '53/UDP DNS'],
      },
      caveats: ['Preview only; live evidence is rendered from Agent Host results.'],
      recommendedPivots: ['Validate current exposure and certificate reuse.'],
      warnings: [],
      raw: { preview: true },
    };
  }
  return {
    source,
    sourceLabel: 'Flashpoint',
    sourceKey: source,
    sourceName: 'Flashpoint',
    observable: 'Handala Hack',
    status: 'ok',
    verdict: 'usable',
    highlights: ['returned: 11', 'sourceContext: Telegram | Handala Hack (3686754935)', 'latestPost: 2026-05-19T06:19:25Z'],
    sections: {
      queryWindow: 'author=Handala Hack; site=Telegram; now-48h to now',
      returned: '11 returned (=11 total)',
      sourceContext: 'Telegram | Handala Hack (3686754935) | https://t.me/CYBER_HANDALA',
      substantivePosts: [
        '2026-05-19T06:19:25Z - Handala Hack (3686754935)\nid=I708tzdkWIerCV-0yXD76g\nhttps://t.me/CYBER_HANDALA\nPFAP alleged leak with 639,000 documents.',
      ],
      emptyRows: 2,
      notableTerms: ['PFAP', '639,000', 'documents', 'leak'],
      latestPost: '2026-05-19T06:19:25Z - Handala Hack (3686754935)\nid=I708tzdkWIerCV-0yXD76g\nhttps://t.me/CYBER_HANDALA\nPFAP alleged leak with 639,000 documents.',
    },
    fields: {
      queryWindow: 'author=Handala Hack; site=Telegram; now-48h to now',
      returned: '11 returned (=11 total)',
      sourceContext: 'Telegram | Handala Hack (3686754935) | https://t.me/CYBER_HANDALA',
      substantivePosts: [
        '2026-05-19T06:19:25Z - Handala Hack (3686754935)\nid=I708tzdkWIerCV-0yXD76g\nhttps://t.me/CYBER_HANDALA\nPFAP alleged leak with 639,000 documents.',
      ],
      emptyRows: 2,
      notableTerms: ['PFAP', '639,000', 'documents', 'leak'],
      latestPost: '2026-05-19T06:19:25Z - Handala Hack (3686754935)\nid=I708tzdkWIerCV-0yXD76g\nhttps://t.me/CYBER_HANDALA\nPFAP alleged leak with 639,000 documents.',
    },
    caveats: ['Preview only.'],
    recommendedPivots: ['Corroborate actor and victim claims before creating final assessment language.'],
    warnings: [],
    raw: { preview: true },
  };
}

function CtiSourceTemplatesEditor({ settings, onUpdateSettings }: { settings: Settings; onUpdateSettings: (updates: Partial<Settings>) => void }) {
  const { addToast } = useToast();
  const sources: CtiSourceId[] = ['virustotal', 'censys', 'flashpoint'];
  const [editingSource, setEditingSource] = useState<CtiSourceId | null>(null);
  const [templateJson, setTemplateJson] = useState('');
  const [issues, setIssues] = useState<string[]>([]);

  const startEdit = (source: CtiSourceId) => {
    setEditingSource(source);
    setTemplateJson(JSON.stringify(getCtiTemplate(source, settings.ctiSourceFormatTemplates), null, 2));
    setIssues([]);
  };

  const saveTemplate = () => {
    if (!editingSource) return;
    const parsed = parseCtiTemplateJson(templateJson);
    if (!parsed.template || parsed.issues.length > 0) {
      setIssues(parsed.issues);
      return;
    }
    const template = {
      ...parsed.template,
      source: editingSource,
      active: parsed.template.active,
      suggestedBy: 'user' as const,
      approvedAt: Date.now(),
      approvedBy: settings.displayName || 'Analyst',
    };
    const reparsed = parseCtiTemplateJson(JSON.stringify(template));
    if (!reparsed.template || reparsed.issues.length > 0) {
      setIssues(reparsed.issues);
      return;
    }
    onUpdateSettings({
      ctiSourceFormatTemplates: {
        ...(settings.ctiSourceFormatTemplates || {}),
        [editingSource]: reparsed.template,
      },
    });
    setEditingSource(null);
    setIssues([]);
    addToast('success', `Saved ${DEFAULT_CTI_SOURCE_TEMPLATES[editingSource].label} CTI format.`);
  };

  const resetTemplate = (source: CtiSourceId) => {
    const next = { ...(settings.ctiSourceFormatTemplates || {}) };
    delete next[source];
    onUpdateSettings({ ctiSourceFormatTemplates: next });
    if (editingSource === source) setEditingSource(null);
    addToast('success', `Reset ${DEFAULT_CTI_SOURCE_TEMPLATES[source].label} CTI format.`);
  };

  const preview = editingSource
    ? renderCtiEvidenceMarkdown(sampleTemplateEvidence(editingSource), parseCtiTemplateJson(templateJson).template || getCtiTemplate(editingSource, settings.ctiSourceFormatTemplates))
    : '';

  return (
    <div className="border border-gray-700 rounded-lg p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Shield size={16} />
          CTI Source Formats
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Edit how normalized Agent Host evidence is displayed. Templates affect presentation only, not source facts.
        </p>
      </div>

      <div className="space-y-2">
        {sources.map(source => {
          const isCustom = !!settings.ctiSourceFormatTemplates?.[source];
          const template = getCtiTemplate(source, settings.ctiSourceFormatTemplates);
          return (
            <div key={source} className="rounded-lg border border-gray-700 bg-gray-800/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-gray-200 font-medium">{DEFAULT_CTI_SOURCE_TEMPLATES[source].label}</div>
                  <div className="text-[10px] text-gray-500">{isCustom ? 'Custom template' : 'Default template'} Â· {template.active ? 'Active' : 'Inactive'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit(source)} className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-200 hover:bg-gray-600">
                    Edit
                  </button>
                  <button onClick={() => resetTemplate(source)} disabled={!isCustom} className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-40">
                    Reset
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editingSource && (
        <div className="space-y-2 rounded-lg border border-accent-blue/30 bg-gray-900/60 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-gray-300">Editing {DEFAULT_CTI_SOURCE_TEMPLATES[editingSource].label}</div>
            <button onClick={() => setEditingSource(null)} className="text-gray-500 hover:text-gray-300"><X size={14} /></button>
          </div>
          <textarea
            value={templateJson}
            onChange={(e) => { setTemplateJson(e.target.value); setIssues([]); }}
            rows={12}
            className="w-full bg-gray-950 border border-gray-700 rounded px-2.5 py-2 text-xs text-gray-200 focus:outline-none focus:border-accent font-mono resize-y"
          />
          {issues.length > 0 && (
            <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
              {issues.map(issue => <div key={issue}>- {issue}</div>)}
            </div>
          )}
          <div className="rounded border border-gray-700 bg-gray-950 p-2">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Preview</div>
            <pre className="whitespace-pre-wrap text-xs text-gray-300 font-mono">{preview}</pre>
          </div>
          <div className="flex gap-2">
            <button onClick={saveTemplate} className="px-3 py-1.5 rounded bg-accent text-white text-xs font-medium hover:brightness-110">Save</button>
            <button onClick={() => setEditingSource(null)} className="px-3 py-1.5 rounded bg-gray-700 text-gray-300 text-xs hover:bg-gray-600">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

const TAB_META: Array<{
  key: SettingsTab;
  icon: typeof LayoutGrid;
  labelKey: string;
  defaultLabel: string;
  description: string;
  group: 'Workspace' | 'CaddyAI' | 'Admin';
}> = [
  { key: 'general', icon: LayoutGrid, labelKey: 'tabs.general', defaultLabel: 'General', description: 'Workspace, identity, and notification defaults.', group: 'Workspace' },
  { key: 'appearance', icon: Palette, labelKey: 'tabs.appearance', defaultLabel: 'Appearance', description: 'Theme, color harmony, and ambient background motion.', group: 'Workspace' },
  { key: 'ai', icon: Bot, labelKey: 'tabs.ai', defaultLabel: 'AI', description: 'Provider keys, routing, and CaddyAI defaults.', group: 'CaddyAI' },
  { key: 'agents', icon: Wrench, labelKey: 'tabs.agents', defaultLabel: 'Agents', description: 'Supervisor, hosts, and external skill runtimes.', group: 'Admin' },
  { key: 'data', icon: Database, labelKey: 'tabs.data', defaultLabel: 'Data', description: 'Backups, imports, and recovery surfaces.', group: 'Workspace' },
  { key: 'templates', icon: FileText, labelKey: 'tabs.templates', defaultLabel: 'Templates', description: 'Note and playbook templates for investigations.', group: 'Workspace' },
  { key: 'intel', icon: Shield, labelKey: 'tabs.intel', defaultLabel: 'Intel', description: 'Threat-intel extraction and CTI formatting controls.', group: 'CaddyAI' },
  { key: 'integrations', icon: Link, labelKey: 'tabs.integrations', defaultLabel: 'Integrations', description: 'Connect external services and provider sources.', group: 'CaddyAI' },
  { key: 'shortcuts', icon: Keyboard, labelKey: 'tabs.shortcuts', defaultLabel: 'Shortcuts', description: 'Keyboard affordances and operator speedups.', group: 'Workspace' },
  { key: 'system', icon: AlertTriangle, labelKey: 'tabs.system', defaultLabel: 'System', description: 'Backup, reset, and local hygiene controls.', group: 'Admin' },
];

type AssistantAISetupStatus = 'connected' | 'configured' | 'failed' | 'local-only' | 'not-configured';
type LocalLLMTestStatus = 'idle' | 'testing' | 'success' | 'error';

const assistantAIStatusMeta: Record<AssistantAISetupStatus, { label: string; className: string }> = {
  connected: { label: 'Connected', className: 'border-green-500/30 bg-green-500/10 text-green-300' },
  configured: { label: 'Configured', className: 'border-blue-500/30 bg-blue-500/10 text-blue-300' },
  failed: { label: 'Failed', className: 'border-red-500/30 bg-red-500/10 text-red-300' },
  'local-only': { label: 'Local-only', className: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
  'not-configured': { label: 'Not configured', className: 'border-gray-700 bg-gray-800/70 text-gray-400' },
};


type AssistantModelPreset = 'codex-high' | 'chatgpt-medium' | 'chatgpt-low' | 'ollama-low' | 'caddyai';

const ASSISTANT_MODEL_PRESETS: Array<{
  id: AssistantModelPreset;
  label: string;
  detail: string;
  provider: Settings['llmDefaultProvider'];
  model: string;
}> = [
  {
    id: 'codex-high',
    label: 'Codex / high',
    detail: 'OpenAI GPT-5.4 Pro for the heaviest assistant work.',
    provider: 'openai',
    model: 'gpt-5.4-pro',
  },
  {
    id: 'chatgpt-medium',
    label: 'ChatGPT / medium',
    detail: 'Balanced OpenAI GPT-5.4 for routine routing and drafting.',
    provider: 'openai',
    model: 'gpt-5.4',
  },
  {
    id: 'chatgpt-low',
    label: 'ChatGPT / low',
    detail: 'Lighter OpenAI GPT-4.1 Mini for cheaper everyday prompts.',
    provider: 'openai',
    model: 'gpt-4.1-mini',
  },
  {
    id: 'ollama-low',
    label: 'Ollama / local',
    detail: 'Use the local Ollama / localhost route when local is enough.',
    provider: 'local',
    model: 'llama3',
  },
];



function hasConfiguredLLMRoute(settings: Settings) {
  return Boolean(
    settings.llmAnthropicApiKey?.trim()
      || settings.llmOpenAIApiKey?.trim()
      || settings.llmGeminiApiKey?.trim()
      || settings.llmMistralApiKey?.trim()
      || (settings.llmLocalEndpoint?.trim() && settings.llmLocalModelName?.trim()),
  );
}

function getCurrentLLMProvider(settings: Settings): Settings['llmDefaultProvider'] {
  return settings.llmDefaultProvider
    || MODEL_PROVIDER_MAP[settings.llmDefaultModel || '']
    || 'anthropic';
}

function getAssistantProvider(s: Settings): Settings['llmDefaultProvider'] {
  if (!s.assistantLlmSeparate) return getCurrentLLMProvider(s);
  return s.assistantLlmDefaultProvider
    || MODEL_PROVIDER_MAP[s.assistantLlmDefaultModel || '']
    || getCurrentLLMProvider(s);
}

function getAssistantModel(s: Settings): string {
  if (!s.assistantLlmSeparate) {
    return s.llmDefaultModel || DEFAULT_MODEL_PER_PROVIDER[getCurrentLLMProvider(s) || 'anthropic'];
  }
  return s.assistantLlmDefaultModel
    || DEFAULT_MODEL_PER_PROVIDER[getAssistantProvider(s) || 'anthropic'];
}

function getAssistantModelPreset(settings: Settings): AssistantModelPreset {
  if (!settings.assistantLlmSeparate) return 'caddyai';
  const provider = getAssistantProvider(settings);
  const model = settings.assistantLlmDefaultModel || '';
  if (provider === 'local') return 'ollama-low';
  if (model === 'gpt-5.4-pro') return 'codex-high';
  if (model === 'gpt-4.1-mini') return 'chatgpt-low';
  return 'chatgpt-medium';
}

function StatusPill({ status }: { status: AssistantAISetupStatus }) {
  const meta = assistantAIStatusMeta[status];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function AssistantCaddyAISetup({
  settings,
  onUpdateSettings,
  localTestStatus,
  localTestError,
  onOpenIntegrations,
}: {
  settings: Settings;
  onUpdateSettings: (updates: Partial<Settings>) => void;
  localTestStatus: LocalLLMTestStatus;
  localTestError?: string;
  onOpenIntegrations: () => void;
}) {
  const currentProvider = getAssistantProvider(settings);
  const currentModel = getAssistantModel(settings);
  const hasAnyRoute = hasConfiguredLLMRoute(settings);
  const openAIConfigured = Boolean(settings.llmOpenAIApiKey?.trim());
  const localConfigured = Boolean(settings.llmLocalEndpoint?.trim() && settings.llmLocalModelName?.trim());
  const localStatus: AssistantAISetupStatus = localTestStatus === 'error'
    ? 'failed'
    : localTestStatus === 'success'
      ? 'connected'
      : localConfigured
        ? 'local-only'
        : 'not-configured';
  const activePreset = getAssistantModelPreset(settings);
  const routeSelection = !settings.assistantLlmSeparate
    ? 'caddyai'
    : currentProvider === 'openai'
      ? 'openai'
      : currentProvider === 'local'
        ? 'local'
        : 'openai';

  const selectCurrentCaddyAI = () => {
    // AssistantCaddy follows the ThreatCaddy AI (CaddyAI) baseline.
    onUpdateSettings({ assistantLlmSeparate: false });
  };

  const selectOpenAI = () => {
    onUpdateSettings({
      assistantLlmSeparate: true,
      assistantLlmDefaultProvider: 'openai',
      assistantLlmDefaultModel:
        settings.assistantLlmDefaultProvider === 'openai' && settings.assistantLlmDefaultModel
          ? settings.assistantLlmDefaultModel
          : DEFAULT_MODEL_PER_PROVIDER.openai,
    });
  };

  const selectLocal = () => {
    onUpdateSettings({
      assistantLlmSeparate: true,
      assistantLlmDefaultProvider: 'local',
      ...(settings.assistantLlmLocalModelName || settings.llmLocalModelName
        ? { assistantLlmDefaultModel: settings.assistantLlmLocalModelName || settings.llmLocalModelName }
        : {}),
    });
  };

  const selectPreset = (preset: AssistantModelPreset) => {
    const selection = ASSISTANT_MODEL_PRESETS.find((entry) => entry.id === preset);
    if (!selection) return;
    onUpdateSettings({
      assistantLlmSeparate: true,
      assistantLlmDefaultProvider: selection.provider,
      assistantLlmDefaultModel: selection.model,
    });
  };
  const labelClass = 'text-sm text-gray-400';
  const selectClass = 'bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-accent';

  return (
    <section className="space-y-3" aria-label="AssistantCaddy AI setup">
      <div>
        <div>
          <h4 className="text-sm font-semibold text-gray-200">AssistantCaddy AI setup</h4>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-500">
            Use the same settings-page structure as the main AI controls, but scoped to AssistantCaddy routing only. Runtime tests and provider probing stay in the explicit controls below.
          </p>
        </div>
      </div>
      <section
        className="space-y-3 rounded-lg border border-gray-800 bg-gray-900/25 p-3"
        aria-label="AssistantCaddy route selection"
      >
        <div>
          <h5 className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-300">Assistant route selection</h5>
          <p className="mt-1 text-[11px] leading-5 text-gray-500">
            Choose which existing route AssistantCaddy should use. This updates provider and model selection only.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-300">
          <input
            type="checkbox"
            checked={!settings.assistantLlmSeparate}
            onChange={(e) => onUpdateSettings({ assistantLlmSeparate: !e.target.checked })}
          />
          Use the same model as ThreatCaddy AI (CaddyAI)
        </label>
        {settings.assistantLlmSeparate && (
          <div className="flex items-center justify-between">
            <label className={labelClass}>AssistantCaddy model</label>
            <select
              value={settings.assistantLlmDefaultModel || currentModel || 'gpt-5.4'}
              onChange={(e) => {
                const model = e.target.value;
                const provider = (MODEL_PROVIDER_MAP[model]
                  || (model === settings.assistantLlmLocalModelName || model === settings.llmLocalModelName
                    ? 'local'
                    : 'anthropic')) as Settings['llmDefaultProvider'];
                onUpdateSettings({
                  assistantLlmSeparate: true,
                  assistantLlmDefaultModel: model,
                  assistantLlmDefaultProvider: provider,
                });
              }}
              className={selectClass}
            >
              {Array.from(new Set(MODELS.map((m) => m.group))).map((group) => (
                <optgroup key={group} label={group}>
                  {MODELS.filter((m) => m.group === group).map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </optgroup>
              ))}
              {settings.llmLocalModelName && (
                <optgroup label="Local">
                  <option value={settings.llmLocalModelName}>{settings.llmLocalModelName} (local)</option>
                </optgroup>
              )}
            </select>
          </div>
        )}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <label className={labelClass}>Assistant route</label>
            <select
              value={routeSelection}
              onChange={(event) => {
                const value = event.target.value;
                if (value === 'caddyai') {
                  selectCurrentCaddyAI();
                  return;
                }
                if (value === 'openai') {
                  selectOpenAI();
                  return;
                }
                if (value === 'local') {
                  selectLocal();
                  return;
                }
                onOpenIntegrations();
              }}
              aria-label="Assistant route"
              className={`${selectClass} mt-1 w-full`}
            >
              <option value="caddyai">Existing CaddyAI route</option>
              <option value="openai">OpenAI-compatible API</option>
              <option value="local">Local Ollama / localhost</option>
              <option value="generic">Generic adapter placeholder</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={hasAnyRoute ? 'configured' : 'not-configured'} />
            <StatusPill status={openAIConfigured ? 'configured' : 'not-configured'} />
            <StatusPill status={localStatus} />
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <label className={labelClass}>Current model</label>
            <div className="mt-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200">
              {currentModel || 'Not configured'}
            </div>
          </div>
          <div>
            <label className={labelClass}>Route notes</label>
            <div className="mt-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-400">
              {routeSelection === 'openai' && (openAIConfigured ? 'OpenAI-compatible key is present in existing settings.' : 'Add an API key below in the legacy route key settings block.')}
              {routeSelection === 'local' && (localConfigured ? 'Local endpoint and model are present in the explicit runtime controls block.' : 'Configure endpoint and model below in explicit runtime controls.')}
              {routeSelection === 'caddyai' && 'AssistantCaddy follows the existing CaddyAI baseline route.'}
            </div>
          </div>
        </div>
        {routeSelection === 'local' && localTestStatus === 'error' && localTestError && (
          <p className="text-[11px] text-red-300">{localTestError}</p>
        )}
      </section>
      <section className="space-y-3 rounded-lg border border-gray-800 bg-gray-900/25 p-3" aria-label="Assistant AI selector">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h5 className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-300">Assistant AI selector</h5>
            <p className="mt-1 max-w-3xl text-[11px] leading-5 text-gray-500">
              Keep the format lightweight. These buttons only switch the default AssistantCaddy provider and model tier.
            </p>
          </div>
          <span className="rounded-full border border-gray-700 bg-black/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
            {activePreset === 'caddyai' ? (currentModel || currentProvider || 'caddyai') : activePreset}
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {ASSISTANT_MODEL_PRESETS.map((preset) => {
            const selected = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                data-assistant-model-preset={preset.id}
                onClick={() => selectPreset(preset.id)}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${selected ? 'border-accent bg-accent/10' : 'border-gray-700 bg-gray-800/40 hover:border-gray-600 hover:bg-gray-800/60'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-100">{preset.label}</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-gray-500">
                      {preset.provider === 'local' ? 'Local route' : 'Cloud route'}
                    </div>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${selected ? 'border-accent/30 bg-accent/15 text-accent' : 'border-gray-700 bg-black/20 text-gray-400'}`}>
                    {selected ? 'Selected' : 'Set'}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-gray-400">{preset.detail}</p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-600">{preset.model}</p>
              </button>
            );
          })}
        </div>
      </section>
      <div className="flex flex-col gap-2 rounded-lg border border-gray-800 bg-gray-900/25 p-3 text-[11px] leading-5 text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <span>Email and calendar setup live under Integrations/route-specific setup, not AssistantCaddy AI.</span>
        <button
          type="button"
          onClick={onOpenIntegrations}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-700 px-2.5 py-1.5 text-[11px] font-semibold text-gray-300 transition-colors hover:border-gray-600 hover:text-gray-100"
        >
          Open Integrations
          <Link size={12} />
        </button>
      </div>
    </section>
  );
}

// â”€â”€â”€ Meeting Alerts Settings Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ANIMATION_OPTIONS: { value: NonNullable<Settings['alertAnimation']>; labelKey: string }[] = [
  { value: 'pulse', labelKey: 'animPulse' },
  { value: 'color-cycle', labelKey: 'animColorCycle' },
  { value: 'chasing-light', labelKey: 'animChasingLight' },
  { value: 'gradient-sweep', labelKey: 'animGradientSweep' },
  { value: 'wiggle', labelKey: 'animWiggle' },
  { value: 'strobe', labelKey: 'animStrobe' },
];

const COLOR_MODE_OPTIONS: { value: NonNullable<Settings['alertColorMode']>; labelKey: string }[] = [
  { value: 'theme', labelKey: 'colorTheme' },
  { value: 'monochrome', labelKey: 'colorMonochrome' },
  { value: 'custom', labelKey: 'colorCustom' },
  { value: 'severity-tier', labelKey: 'colorSeverityTier' },
];

function MeetingAlertsSection({
  settings,
  onUpdateSettings,
}: {
  settings: Settings;
  onUpdateSettings: (patch: Partial<Settings>) => void;
}) {
  const { t: tA } = useTranslation('alerts');
  const [strobeExpanded, setStrobeExpanded] = useState(false);
  const selectClass = 'bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-accent';

  const enabled = settings.alertEnabled !== false;
  const animation = settings.alertAnimation ?? 'pulse';
  const colorMode = settings.alertColorMode ?? 'theme';
  const chime = settings.alertChime ?? false;
  const strobeOptIn = settings.strobeExplicitOptIn ?? false;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-300">{tA('settingsTitle')}</h3>

      {/* Enabled toggle */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-gray-300">{tA('settingsEnabled')}</span>
          <p className="text-xs text-gray-500">{tA('settingsEnabledDesc')}</p>
        </div>
        <button
          onClick={() => onUpdateSettings({ alertEnabled: !enabled })}
          className={`relative w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-accent' : 'bg-gray-700'}`}
          aria-pressed={enabled}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : ''}`} />
        </button>
      </div>

      {enabled && (
        <div className="space-y-3 pl-1">
          {/* Lead time */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-sm text-gray-300">{tA('settingsLeadTime')}</span>
              <p className="text-xs text-gray-500">{tA('settingsLeadTimeDesc')}</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={2}
                max={60}
                value={settings.alertLeadMinutes ?? 15}
                onChange={(e) => onUpdateSettings({ alertLeadMinutes: Math.max(2, Math.min(60, Number(e.target.value))) })}
                className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-200 text-center focus:outline-none focus:border-accent"
              />
              <span className="text-xs text-gray-500">min</span>
            </div>
          </div>

          {/* Animation */}
          <div className="space-y-1.5">
            <label className="text-sm text-gray-300">{tA('settingsAnimation')}</label>
            <select
              value={animation}
              onChange={(e) => onUpdateSettings({ alertAnimation: e.target.value as Settings['alertAnimation'] })}
              className={selectClass}
            >
              {ANIMATION_OPTIONS.filter((o) => o.value !== 'strobe').map((o) => (
                <option key={o.value} value={o.value}>{tA(o.labelKey)}</option>
              ))}
            </select>
          </div>

          {/* Color mode */}
          <div className="space-y-1.5">
            <label className="text-sm text-gray-300">{tA('settingsColorMode')}</label>
            <select
              value={colorMode}
              onChange={(e) => onUpdateSettings({ alertColorMode: e.target.value as Settings['alertColorMode'] })}
              className={selectClass}
            >
              {COLOR_MODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{tA(o.labelKey)}</option>
              ))}
            </select>
          </div>

          {colorMode === 'custom' && (
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-300 shrink-0">{tA('settingsCustomColor')}</label>
              <input
                type="color"
                value={settings.alertCustomColor ?? '#6366f1'}
                onChange={(e) => onUpdateSettings({ alertCustomColor: e.target.value })}
                className="w-10 h-8 rounded cursor-pointer border border-gray-700 bg-transparent"
              />
              <span className="text-xs text-gray-500 font-mono">{settings.alertCustomColor ?? '#6366f1'}</span>
            </div>
          )}

          {/* Chime */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-300">{tA('settingsChime')}</span>
              <p className="text-xs text-gray-500">{tA('settingsChimeDesc')}</p>
            </div>
            <button
              onClick={() => onUpdateSettings({ alertChime: !chime })}
              className={`relative w-9 h-5 rounded-full transition-colors ${chime ? 'bg-accent' : 'bg-gray-700'}`}
              aria-pressed={chime}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${chime ? 'translate-x-4' : ''}`} />
            </button>
          </div>

          {/* Strobe â€” gated behind explicit opt-in */}
          <div className="rounded-lg border border-amber-800/40 bg-amber-900/10 p-3 space-y-2">
            <button
              className="flex items-center gap-2 text-sm text-amber-400 font-medium w-full text-left"
              onClick={() => setStrobeExpanded((v) => !v)}
              aria-expanded={strobeExpanded}
            >
              <span>{tA('settingsStrobeSection')}</span>
              <span className="ml-auto text-xs">{strobeExpanded ? 'â–²' : 'â–¼'}</span>
            </button>
            {strobeExpanded && (
              <div className="space-y-2">
                <p className="text-xs text-amber-300/80">{tA('settingsStrobeWarning')}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">{tA('settingsStrobeOptIn')}</span>
                  <button
                    onClick={() => {
                      const newVal = !strobeOptIn;
                      onUpdateSettings({
                        strobeExplicitOptIn: newVal,
                        alertAnimation: newVal ? 'strobe' : (animation === 'strobe' ? 'pulse' : animation),
                      });
                    }}
                    className={`relative w-9 h-5 rounded-full transition-colors ${strobeOptIn ? 'bg-amber-500' : 'bg-gray-700'}`}
                    aria-pressed={strobeOptIn}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${strobeOptIn ? 'translate-x-4' : ''}`} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SettingsPanel({ settings, onUpdateSettings, notes, onImportComplete, sampleLoaded, onLoadSample, onDeleteSample, onClose, initialTab, templateProps, playbookProps }: SettingsPanelProps) {
  const { t } = useTranslation('settings');
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || 'general');
  const [assistantLocalTest, setAssistantLocalTest] = useState<{ status: LocalLLMTestStatus; error?: string }>({ status: 'idle' });
  const [invColorMode, setInvColorMode] = useState<InvestigationColorMode>(getInvestigationColorMode);

  const handleInvColorMode = (mode: InvestigationColorMode) => {
    setInvColorMode(mode);
    setInvestigationColorMode(mode);
  };
  const selectClass = 'bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-accent';
  const labelClass = 'text-sm text-gray-400';
  const topTabs = TAB_META;

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden" data-settings-shell="true">
      <div className="min-h-0 flex-1 overflow-y-auto" data-settings-scroll-region="true">
        <div className="mx-auto w-full max-w-5xl px-5 py-5 md:px-8 md:py-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-gray-100">{t('title')}</h2>
            {onClose && (
              <button onClick={onClose} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200" aria-label={t('closeSettings')} title={t('closeSettings')}>
                <X size={18} />
              </button>
            )}
          </div>

          <div
            className="mt-8 flex gap-6 overflow-x-auto border-b border-gray-800 no-scrollbar"
            role="tablist"
            aria-label={t('title')}
          >
            {topTabs.map((item) => {
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  role="tab"
                  aria-selected={active}
                  aria-controls={`settings-panel-${item.key}`}
                  id={`settings-tab-${item.key}`}
                  onClick={() => setActiveTab(item.key)}
                  title={item.description}
                  className={`shrink-0 border-b-2 px-0.5 pb-3 text-sm font-medium transition-colors ${
                    active
                      ? 'border-accent text-gray-100'
                      : 'border-transparent text-gray-400 hover:border-gray-700 hover:text-gray-200'
                  }`}
                >
                  {t(item.labelKey, { defaultValue: item.defaultLabel })}
                </button>
              );
            })}
          </div>

          <div className="py-8">

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="space-y-6" role="tabpanel" id="settings-panel-general" aria-labelledby="settings-tab-general">
          {/* Team Server */}
          <ServerConnection
            settings={settings}
            onUpdateSettings={onUpdateSettings}
          />

          {/* Security â€” TOTP / 2FA */}
          <TotpManagement />

          {/* Security â€” Passkeys */}
          <PasskeyManagement />

          {/* Security â€” Synced Devices */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">{t('general.syncedDevices')}</h3>
            <p className="text-xs text-gray-500">{t('general.syncedDevicesDesc')}</p>
            <SyncDevicesPanel />
          </div>

          {/* Security — Sync Auth MFA (desktop only; hidden in web/SPA mode) */}
          <SyncAuthSettings />

          {/* Security — Credential Vault (desktop only; hidden in web/SPA mode) */}
          <CredentialVault />

          {/* Identity */}
          {(() => {
            let teamName: string | undefined;
            try {
              const stored = JSON.parse(localStorage.getItem('threatcaddy-auth') || 'null');
              teamName = stored?.user?.displayName;
            } catch { /* ignore */ }
            return (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-300">{t('general.identity')}</h3>
                <div>
                  <label className="text-sm text-gray-400 block mb-2">{t('general.displayName')}</label>
                  {teamName ? (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm text-gray-200">{teamName}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">{t('general.fromTeamServer')}</span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={settings.displayName || ''}
                      onChange={(e) => onUpdateSettings({ displayName: e.target.value.trim() || undefined })}
                      placeholder={t('general.displayNamePlaceholder')}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent mb-2"
                    />
                  )}
                  <p className="text-[10px] text-gray-500">
                    {teamName
                      ? t('general.displayNameHelpTeam')
                      : t('general.displayNameHelp')}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Preferences */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-300">{t('general.preferences')}</h3>

            <div className="flex items-center justify-between">
              <label className={labelClass}>{t('general.editorMode')}</label>
              <select
                value={settings.editorMode}
                onChange={(e) => onUpdateSettings({ editorMode: e.target.value as Settings['editorMode'] })}
                className={selectClass}
              >
                <option value="edit">{t('general.editorMode.edit')}</option>
                <option value="split">{t('general.editorMode.split')}</option>
                <option value="preview">{t('general.editorMode.preview')}</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <label className={labelClass}>{t('general.taskView')}</label>
              <select
                value={settings.taskViewMode}
                onChange={(e) => onUpdateSettings({ taskViewMode: e.target.value as Settings['taskViewMode'] })}
                className={selectClass}
              >
                <option value="list">{t('general.taskView.list')}</option>
                <option value="kanban">{t('general.taskView.kanban')}</option>
              </select>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className={labelClass}>{t('general.language')}</label>
                <select
                  value={settings.language ?? 'en'}
                  onChange={(e) => onUpdateSettings({ language: e.target.value })}
                  className={selectClass}
                >
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>
                      {lang.nativeName}{lang.name !== lang.nativeName ? ` â€” ${lang.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] text-gray-500 text-end">{t('general.languageHelp')}</p>
            </div>
          </div>

          {/* Notifications */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">{t('general.notifications')}</h3>
            {(['mention', 'reply', 'reaction', 'invite', 'bot'] as const).map((key) => {
              const enabled = settings.notificationPrefs?.[key] !== false;
              return (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-300">{t(`general.notifications.${key}`)}</span>
                    <p className="text-xs text-gray-500">{t(`general.notifications.${key}Desc`)}</p>
                  </div>
                  <button
                    onClick={() => onUpdateSettings({ notificationPrefs: { ...settings.notificationPrefs, [key]: !enabled } })}
                    className={`relative w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-accent' : 'bg-gray-700'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : ''}`} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Notification accounts */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-300">Notification accounts</h3>
            <p className="text-xs text-gray-500">Connect accounts so AssistantCaddy can send alerts and reminders through your preferred channels.</p>
            {([
              { id: 'work-email', label: 'Work Email', Icon: Mail },
              { id: 'personal-email', label: 'Personal Email', Icon: Mail },
              { id: 'slack', label: 'Slack', Icon: MessageSquare },
              { id: 'zoom', label: 'Zoom', Icon: Video },
              { id: 'teams', label: 'Microsoft Teams', Icon: Users },
              { id: 'discord', label: 'Discord', Icon: Hash },
            ] as const).map(({ id, label, Icon }) => (
              <div key={id} className="flex items-center gap-3 py-2 border-b border-gray-800/60 last:border-0">
                <Icon size={15} className="shrink-0 text-gray-600" />
                <span className="flex-1 text-sm text-gray-500">{label}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium border border-gray-700 text-gray-600">Coming soon</span>
                <Bell size={14} className="text-gray-700 shrink-0" aria-hidden />
              </div>
            ))}
          </div>

          {/* Slack DM Alerts */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">{t('general.slackDms')}</h3>
            <p className="text-xs text-gray-500">{t('general.slackDmsDesc')}</p>
            <SlackDmsPanel settings={settings} onUpdateSettings={onUpdateSettings} />
          </div>

          {/* Slack Agent Alerts (outbound webhook) */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">{t('general.slackOutbound')}</h3>
            <p className="text-xs text-gray-500">{t('general.slackOutboundDesc')}</p>
            <input
              type="text"
              value={settings.slackOutboundWebhookUrl ?? ''}
              onChange={(e) => onUpdateSettings({ slackOutboundWebhookUrl: e.target.value || undefined })}
              placeholder={t('general.slackOutboundPlaceholder')}
              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent"
            />
          </div>

          {/* Meeting Alerts */}
          <MeetingAlertsSection settings={settings} onUpdateSettings={onUpdateSettings} />

          {/* Sample Data */}
          {(onLoadSample || onDeleteSample) && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-300">{t('general.sampleData')}</h3>
              <p className="text-xs text-gray-500">
                {t('general.sampleDataDesc')}
              </p>
              {sampleLoaded ? (
                <button
                  data-tour="load-sample"
                  onClick={onDeleteSample}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/15 text-red-400 hover:bg-red-600/25 text-sm font-medium transition-colors"
                >
                  <Trash2 size={16} />
                  {t('general.removeSample')}
                </button>
              ) : (
                <button
                  data-tour="load-sample"
                  onClick={onLoadSample}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/15 text-accent hover:bg-accent/25 text-sm font-medium transition-colors"
                >
                  <FlaskConical size={16} />
                  {t('general.loadSample')}
                </button>
              )}
            </div>
          )}

          {/* About */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-300">{t('general.about')}</h3>
            <p className="text-sm text-gray-400">
              {t('general.aboutDesc')}
            </p>
            <p className="text-xs text-gray-600">{t('general.aboutLocalFirst')}</p>
            <div className="flex items-center gap-4 pt-2">
              <a
                href="https://github.com/peterhanily/threatcaddy"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover transition-colors"
              >
                <Github size={16} />
                {t('general.github')}
              </a>
              {typeof __STANDALONE__ !== 'undefined' && __STANDALONE__ ? (
                <button
                  onClick={async () => {
                    try {
                      const dlController = new AbortController();
                      setTimeout(() => dlController.abort(), 30_000);
                      const resp = await fetch('https://threatcaddy.com/threatcaddy-standalone.html', { signal: dlController.signal });
                      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                      const blob = await resp.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'threatcaddy-standalone.html';
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch {
                      addToast('error', t('general.updateFailed'));
                    }
                  }}
                  className="flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover transition-colors"
                >
                  <RefreshCw size={16} />
                  {t('general.update')}
                </button>
              ) : (
                <a
                  href="./threatcaddy-standalone.html"
                  download
                  className="flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover transition-colors"
                >
                  <Download size={16} />
                  {t('general.downloadStandalone')}
                </a>
              )}
              <a
                href="https://threatcaddy.com/privacy.html"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover transition-colors"
              >
                <Shield size={16} />
                {t('general.privacy')}
              </a>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-gray-600 pt-3">
              <FlaskConical size={12} />
              <a
                href="https://caddylabs.io"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-400 transition-colors"
              >
                {t('general.caddylabsTagline')}
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Appearance Tab */}
      {activeTab === 'appearance' && (
        <div className="space-y-6" role="tabpanel" id="settings-panel-appearance" aria-labelledby="settings-tab-appearance">
          {/* Theme toggle â€” moved from General */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-300">{t('appearance.theme')}</h3>
            <div className="flex items-center justify-between">
              <label className={labelClass}>{t('appearance.mode')}</label>
              <select
                value={settings.theme}
                onChange={(e) => onUpdateSettings({ theme: e.target.value as 'dark' | 'light' })}
                className={selectClass}
              >
                <option value="dark">{t('appearance.dark')}</option>
                <option value="light">{t('appearance.light')}</option>
              </select>
            </div>
          </div>
          <AppearanceSettings settings={settings} onUpdateSettings={onUpdateSettings} />

          {/* Investigation card color mode */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">{t('investigationColorMode.label')}</h3>
            <div className="flex gap-2">
              {(['manual', 'tlp', 'combined'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleInvColorMode(mode)}
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-lg border transition-colors',
                    invColorMode === mode
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-border-subtle text-text-secondary hover:border-border-medium',
                  )}
                  title={t(`investigationColorMode.${mode}Desc`)}
                >
                  {t(`investigationColorMode.${mode}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Tab */}
      {activeTab === 'ai' && (
        <div className="space-y-6" role="tabpanel" id="settings-panel-ai" aria-labelledby="settings-tab-ai">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Bot size={16} />
              {t('ai.title')}
            </h3>

            <AssistantCaddyAISetup
              settings={settings}
              onUpdateSettings={onUpdateSettings}
              localTestStatus={assistantLocalTest.status}
              localTestError={assistantLocalTest.error}
              onOpenIntegrations={() => setActiveTab('integrations')}
            />

            <div className="space-y-3">
              <section
                className="space-y-3 rounded-lg border border-gray-800 bg-gray-900/25 p-3"
                aria-label="Legacy LLM API key settings"
                data-llm-api-key-settings="legacy-route-settings"
              >
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-300">Legacy route key settings</h4>
                  <p className="mt-1 text-[11px] leading-5 text-gray-500">
                    These raw key fields are existing CaddyAI route settings. They are outside the Assistant provider execution gate and do not create opaque credential references or execution readiness.
                  </p>
                </div>
                <div>
                  <label className={labelClass}>{t('ai.anthropicKey')}</label>
                  <input
                    type="password"
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    value={settings.llmAnthropicApiKey || ''}
                    onChange={(e) => onUpdateSettings({ llmAnthropicApiKey: e.target.value.trim() || undefined })}
                    placeholder="sk-ant-..."
                    className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className={labelClass}>{t('ai.openaiKey')}</label>
                  <input
                    type="password"
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    value={settings.llmOpenAIApiKey || ''}
                    onChange={(e) => onUpdateSettings({ llmOpenAIApiKey: e.target.value.trim() || undefined })}
                    placeholder="sk-..."
                    className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className={labelClass}>{t('ai.geminiKey')}</label>
                  <input
                    type="password"
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    value={settings.llmGeminiApiKey || ''}
                    onChange={(e) => onUpdateSettings({ llmGeminiApiKey: e.target.value.trim() || undefined })}
                    placeholder="AIza..."
                    className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className={labelClass}>{t('ai.mistralKey')}</label>
                  <input
                    type="password"
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    value={settings.llmMistralApiKey || ''}
                    onChange={(e) => onUpdateSettings({ llmMistralApiKey: e.target.value.trim() || undefined })}
                    placeholder={t('ai.mistralPlaceholder')}
                    className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent"
                  />
                </div>
              </section>

              <section
                className="space-y-3 rounded-lg border border-gray-800 bg-gray-900/25 p-3"
                aria-label="Explicit Local LLM runtime controls"
                data-local-llm-runtime-controls="explicit-fetch-controls"
              >
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-300">Explicit Local LLM runtime controls</h4>
                  <p className="mt-1 text-[11px] leading-5 text-gray-500">
                    These established local controls are outside the inert Assistant provider execution gate. Test Connection and Fetch Models may contact the configured local endpoint only when clicked.
                  </p>
                </div>
                <LocalLLMConfig
                  settings={settings}
                  onUpdateSettings={onUpdateSettings}
                  onTestStatusChange={(status, error) => setAssistantLocalTest({ status, error })}
                />
              </section>

              <div className="flex items-center justify-between">
                <label className={labelClass}>{t('ai.defaultModel')}</label>
                <select
                  value={settings.llmDefaultModel || 'claude-sonnet-4-6'}
                  onChange={(e) => {
                    const model = e.target.value;
                    const provider = MODEL_PROVIDER_MAP[model] || (model === settings.llmLocalModelName ? 'local' : 'anthropic');
                    onUpdateSettings({ llmDefaultModel: model, llmDefaultProvider: provider as Settings['llmDefaultProvider'] });
                  }}
                  className={selectClass}
                >
                  {Array.from(new Set(MODELS.map(m => m.group))).map(group => (
                    <optgroup key={group} label={group}>
                      {MODELS.filter(m => m.group === group).map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </optgroup>
                  ))}
                  {settings.llmLocalModelName && (
                    <optgroup label={t('ai.localGroup')}>
                      <option value={settings.llmLocalModelName}>{t('ai.localModelPrefix', { name: settings.llmLocalModelName })}</option>
                    </optgroup>
                  )}
                </select>
              </div>

              <div className="flex items-center justify-between">
                <label className={labelClass}>{t('ai.maxContextMessages')}</label>
                <input
                  type="number"
                  min={6}
                  max={200}
                  step={2}
                  value={settings.llmMaxContextMessages || 40}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 6) onUpdateSettings({ llmMaxContextMessages: val });
                  }}
                  className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-accent text-end"
                />
              </div>
              <p className="text-[10px] text-gray-600">
                {t('ai.maxContextHelp')}
              </p>

              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-400">{t('ai.tokenBudget')}</label>
                <input
                  type="number"
                  min={0}
                  step={10000}
                  value={settings.llmTokenBudget || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    onUpdateSettings({ llmTokenBudget: isNaN(val) || val <= 0 ? undefined : val });
                  }}
                  placeholder={t('ai.tokenBudgetPlaceholder')}
                  className="w-28 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-accent text-end"
                />
              </div>
              <p className="text-[10px] text-gray-600">
                {t('ai.tokenBudgetHelp')}
              </p>

              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-400">{t('ai.routing')}</label>
                <select
                  value={settings.llmRoutingMode || 'extension'}
                  onChange={(e) => onUpdateSettings({ llmRoutingMode: e.target.value as 'extension' | 'server' | 'auto' })}
                  className={selectClass}
                >
                  <option value="extension">{t('ai.routing.extension')}</option>
                  <option value="server">{t('ai.routing.server')}</option>
                  <option value="auto">{t('ai.routing.auto')}</option>
                </select>
              </div>
              <p className="text-[10px] text-gray-600">
                {t('ai.routingHelp')}
              </p>

              <SystemPromptEditor
                value={settings.llmSystemPrompt}
                onChange={(v) => onUpdateSettings({ llmSystemPrompt: v })}
              />

              <p className="text-[10px] text-gray-600">
                {t('ai.keysLocalNote')}
              </p>
              {(settings.llmAnthropicApiKey || settings.llmOpenAIApiKey || settings.llmGeminiApiKey || settings.llmMistralApiKey) && (
                <p className="text-[10px] text-accent-green font-medium">{t('ai.apiKeySaved')}</p>
              )}
            </div>
          </div>

          {/* Custom Slash Commands */}
          <CustomSlashCommandsEditor />

        </div>
      )}

      {/* Agents Tab */}
      {activeTab === 'agents' && (
        <div className="space-y-6" role="tabpanel" id="settings-panel-agents" aria-labelledby="settings-tab-agents">
          {/* Agent Profiles */}
          <AgentProfileSection />

          {/* Supervisor Agent */}
          <div className="border border-gray-700 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Bot size={16} />
              {t('agents.supervisor')}
            </h3>
            <p className="text-xs text-gray-500">
              {t('agents.supervisorDesc')}
            </p>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-300">{t('agents.enableSupervisor')}</span>
                <p className="text-[10px] text-gray-500">{t('agents.supervisorInterval', { minutes: settings.agentSupervisorIntervalMinutes || 30 })}</p>
              </div>
              <button
                onClick={() => onUpdateSettings({ agentSupervisorEnabled: !settings.agentSupervisorEnabled })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${settings.agentSupervisorEnabled ? 'bg-accent-blue' : 'bg-gray-600'}`}
                role="switch"
                aria-checked={!!settings.agentSupervisorEnabled}
                aria-label={t('agents.supervisorAriaLabel')}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${settings.agentSupervisorEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
              </button>
            </div>
            {settings.agentSupervisorEnabled && (
              <div className="space-y-2 mt-2">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-400 shrink-0">{t('agents.interval')}</label>
                  <input
                    type="range"
                    min={10}
                    max={120}
                    step={10}
                    value={settings.agentSupervisorIntervalMinutes || 30}
                    onChange={(e) => onUpdateSettings({ agentSupervisorIntervalMinutes: parseInt(e.target.value) })}
                    className="flex-1 h-1 accent-accent-blue"
                  />
                  <span className="text-xs text-gray-400 w-12 text-end">{settings.agentSupervisorIntervalMinutes || 30}m</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-400 shrink-0">{t('agents.supervisorRetention')}</label>
                  <input
                    type="range"
                    min={50}
                    max={500}
                    step={50}
                    value={settings.supervisorNoteRetention ?? 200}
                    onChange={(e) => onUpdateSettings({ supervisorNoteRetention: parseInt(e.target.value) })}
                    className="flex-1 h-1 accent-accent-blue"
                  />
                  <span className="text-xs text-gray-400 w-12 text-end">{settings.supervisorNoteRetention ?? 200}</span>
                </div>
              </div>
            )}
          </div>

          <CtiSourceTemplatesEditor settings={settings} onUpdateSettings={onUpdateSettings} />

          {/* External Agent Hosts */}
          <AgentHostsConfig settings={settings} onUpdateSettings={onUpdateSettings} />
        </div>
      )}

      {/* Data Tab */}
      {activeTab === 'data' && (
        <div className="space-y-6" role="tabpanel" id="settings-panel-data" aria-labelledby="settings-tab-data">
          <ExportImport notes={notes} onImportComplete={onImportComplete} />
          <EncryptionSettings />
          <CloudBackup />
          <ServerBackup />
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-6" role="tabpanel" id="settings-panel-templates" aria-labelledby="settings-tab-templates">
          {templateProps && <TemplateManager {...templateProps} />}
          {playbookProps && <PlaybookManager {...playbookProps} />}
        </div>
      )}

      {/* Threat Intel Tab */}
      {activeTab === 'intel' && (
        <div className="space-y-6" role="tabpanel" id="settings-panel-intel" aria-labelledby="settings-tab-intel">
          <ThreatIntelConfig />
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === 'integrations' && (
        <div className="space-y-6" role="tabpanel" id="settings-panel-integrations" aria-labelledby="settings-tab-integrations">
          <IntegrationPanel />
          {/* Whisper Live Transcription */}
          <WhisperSettingsSection settings={settings} onUpdateSettings={onUpdateSettings} />
          {/* Enrichment Cache TTL */}
          <div className="space-y-2 rounded-xl border border-border-subtle/40 bg-bg-primary/40 p-4">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">{t('integrations.cacheTitle')}</h3>
              <p className="text-xs text-text-secondary mt-0.5">{t('integrations.cacheDesc')}</p>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <label className="text-xs text-gray-400 shrink-0">{t('integrations.cacheTtl')}</label>
              <input
                type="range"
                min={0}
                max={168}
                step={1}
                value={settings.enrichmentCacheTtlHours ?? 24}
                onChange={(e) => onUpdateSettings({ enrichmentCacheTtlHours: parseInt(e.target.value) })}
                className="flex-1 accent-accent h-1.5"
                aria-label={t('integrations.cacheTtl')}
              />
              <span className="text-xs text-gray-400 w-16 text-end">
                {(settings.enrichmentCacheTtlHours ?? 24) === 0
                  ? t('integrations.cacheDisabled')
                  : t('integrations.cacheTtlValue', { hours: settings.enrichmentCacheTtlHours ?? 24 })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Shortcuts Tab */}
      {activeTab === 'shortcuts' && (
        <div className="space-y-6" role="tabpanel" id="settings-panel-shortcuts" aria-labelledby="settings-tab-shortcuts">
          <KeyboardShortcuts />
        </div>
      )}

      {/* System Tab */}
      {activeTab === 'system' && (
        <div className="space-y-6" role="tabpanel" id="settings-panel-system" aria-labelledby="settings-tab-system">
          <SystemHygienePanel
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            notes={notes}
            onImportComplete={onImportComplete}
          />
        </div>
      )}
          </div>
        </div>
      </div>
    </div>
  );
}

// â”€â”€ Local LLM Configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// ── Whisper Live Transcription Settings ────────────────────────────────────

interface WhisperSettingsSectionProps {
  settings: Settings;
  onUpdateSettings: (updates: Partial<Settings>) => void;
}

function WhisperSettingsSection({ settings, onUpdateSettings }: WhisperSettingsSectionProps) {
  const isDesktop = typeof window !== 'undefined' && !!window.threatcaddyNotes;
  const [endpoint, setEndpoint] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(isDesktop);

  useEffect(() => {
    if (!isDesktop) return;
    void (async () => {
      try {
        const url = await window.threatcaddyNotes!.getWhisperEndpoint();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (url) setEndpoint(url);
      } finally {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(false);
      }
    })();
  }, [isDesktop]);

  const handleSaveEndpoint = useCallback(async () => {
    if (!isDesktop) return;
    try {
      await window.threatcaddyNotes!.saveWhisperEndpoint(endpoint.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* ignore */ }
  }, [isDesktop, endpoint]);

  if (!isDesktop) return null;

  return (
    <div className="space-y-3 rounded-xl border border-border-subtle/40 bg-bg-primary/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Live Transcription (Whisper)</h3>
          <p className="text-xs text-text-secondary mt-0.5">
            Transcribe mic audio using a local Whisper server (e.g. whisper.cpp). Desktop-only. Audio never leaves your machine.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.whisperEnabled ?? false}
          onClick={() => onUpdateSettings({ whisperEnabled: !(settings.whisperEnabled ?? false) })}
          className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${settings.whisperEnabled ? 'bg-accent' : 'bg-gray-700'}`}
        >
          <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${settings.whisperEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>
      {settings.whisperEnabled && !loading && (
        <div className="flex items-center gap-2 pt-1">
          <input
            type="url"
            value={endpoint}
            onChange={(e) => { setEndpoint(e.target.value); setSaved(false); }}
            placeholder="http://localhost:9000"
            className="flex-1 rounded-lg border border-border-subtle bg-bg-surface px-3 py-1.5 text-sm text-text-primary placeholder-text-muted focus:border-accent/40 focus:outline-none"
          />
          <button
            onClick={handleSaveEndpoint}
            disabled={!endpoint.trim()}
            className="rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-40"
          >
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}

interface LocalLLMConfigProps {
  settings: Settings;
  onUpdateSettings: (updates: Partial<Settings>) => void;
  onTestStatusChange?: (status: LocalLLMTestStatus, error?: string) => void;
}

function LocalLLMConfig({ settings, onUpdateSettings, onTestStatusChange }: LocalLLMConfigProps) {
  const { t } = useTranslation('settings');
  const [fetchingModels, setFetchingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [fetchingSkills, setFetchingSkills] = useState(false);
  const [skillsError, setSkillsError] = useState('');
  const [showSkills, setShowSkills] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoverProbes, setDiscoverProbes] = useState<import('../../lib/local-endpoint-discovery').EndpointProbe[]>([]);

  const labelClass = 'text-xs text-gray-400 font-medium';
  const inputClass = 'w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent';
  const isStandaloneFile = typeof window !== 'undefined' && window.location.protocol === 'file:';

  const getBaseUrl = useCallback(() => {
    return normalizeLocalLlmEndpoint(settings.llmLocalEndpoint);
  }, [settings.llmLocalEndpoint]);

  const getBridgeHealthUrl = useCallback(() => {
    return getLocalLlmHealthUrl(settings.llmLocalEndpoint);
  }, [settings.llmLocalEndpoint]);

  const fetchModels = useCallback(async () => {
    setFetchingModels(true);
    setAvailableModels([]);
    try {
      const base = getBaseUrl();
      if (!base) throw new Error('No Local LLM endpoint configured');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (settings.llmLocalApiKey) headers['Authorization'] = `Bearer ${settings.llmLocalApiKey}`;

      // Try OpenAI-compatible /v1/models endpoint
      const modelsCtrl = new AbortController();
      const modelsTimer = setTimeout(() => modelsCtrl.abort(), 10_000);
      const resp = await fetch(`${base}/models`, { headers, signal: modelsCtrl.signal }).finally(() => clearTimeout(modelsTimer));
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      const models: string[] = [];
      if (Array.isArray(data.data)) {
        for (const m of data.data) {
          if (m.id && typeof m.id === 'string') models.push(m.id);
        }
      } else if (Array.isArray(data.models)) {
        // Ollama native /api/tags format
        for (const m of data.models) {
          if (m.name && typeof m.name === 'string') models.push(m.name);
        }
      }

      models.sort();
      setAvailableModels(models);

      // Auto-select first model if none set
      if (models.length > 0 && !settings.llmLocalModelName) {
        onUpdateSettings({ llmLocalModelName: models[0] });
      }
    } catch (err) {
      // Try Ollama's native API as fallback
      try {
        const normalizedEndpoint = getBaseUrl();
        if (!normalizedEndpoint) throw err;
        const ollamaBase = normalizedEndpoint.replace(/\/v1\/?$/, '').replace(/\/+$/, '');
        const tagsCtrl = new AbortController();
        const tagsTimer = setTimeout(() => tagsCtrl.abort(), 10_000);
        const resp = await fetch(`${ollamaBase}/api/tags`, { signal: tagsCtrl.signal }).finally(() => clearTimeout(tagsTimer));
        if (resp.ok) {
          const data = await resp.json();
          const models = (data.models || [])
            .map((m: { name?: string }) => m.name)
            .filter((n: unknown): n is string => typeof n === 'string')
            .sort();
          setAvailableModels(models);
          if (models.length > 0 && !settings.llmLocalModelName) {
            onUpdateSettings({ llmLocalModelName: models[0] });
          }
          setFetchingModels(false);
          return;
        }
      } catch { /* ignore fallback error */ }

      setAvailableModels([]);
      console.warn('Failed to fetch models:', err);
    } finally {
      setFetchingModels(false);
    }
  }, [getBaseUrl, settings.llmLocalApiKey, settings.llmLocalModelName, onUpdateSettings, settings.llmLocalEndpoint]);

  const testConnection = useCallback(async () => {
    setTestStatus('testing');
    setTestError('');
    onTestStatusChange?.('testing');
    try {
      const base = getBaseUrl();
      if (!base) throw new Error('No Local LLM endpoint configured');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (settings.llmLocalApiKey) headers['Authorization'] = `Bearer ${settings.llmLocalApiKey}`;

      // Some local services expose /health, including non-LLM agent hosts. Use
      // it only for optional metadata; a local LLM test must still complete a
      // chat/completions request to avoid false positives.
      try {
        const healthCtrl = new AbortController();
        const healthTimer = setTimeout(() => healthCtrl.abort(), 5_000);
        const healthResp = await fetch(getBridgeHealthUrl(), {
          headers,
          signal: healthCtrl.signal,
        }).finally(() => clearTimeout(healthTimer));
        if (healthResp.ok) {
          const health = await healthResp.json().catch(() => null) as { ok?: boolean; served_model_name?: string } | null;
          if (health?.served_model_name && settings.llmLocalModelName !== health.served_model_name) {
            onUpdateSettings({ llmLocalModelName: health.served_model_name });
          }
        }
      } catch {
        // Not every local LLM exposes /health; continue with chat/completions.
      }

      const model = settings.llmLocalModelName || 'test';
      const testCtrl = new AbortController();
      const testTimer = setTimeout(() => testCtrl.abort(), 15_000);
      const resp = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Say "hello" and nothing else.' }],
          max_tokens: 10,
          stream: false,
        }),
        signal: testCtrl.signal,
      }).finally(() => clearTimeout(testTimer));

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        if (resp.status === 401) {
          throw new Error('HTTP 401: Unauthorized. Check that the Local LLM API Key matches the token required by the local bridge.');
        }
        if (resp.status === 404) {
          throw new Error(`HTTP 404: ${text.substring(0, 200)}. This endpoint does not look like an OpenAI-compatible Local LLM /v1 endpoint. If this is the CTI Agent Host, put it under Agent Hosts instead.`);
        }
        throw new Error(`HTTP ${resp.status}: ${text.substring(0, 200)}`);
      }

      const data = await resp.json();
      if (data.choices?.[0]?.message?.content) {
        setTestStatus('success');
        onTestStatusChange?.('success');
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (err) {
      setTestStatus('error');
      const message = (err as Error).message || 'Connection failed';
      const displayMessage =
        message.includes('NetworkError') || message.includes('Failed to fetch')
          ? isStandaloneFile
            ? `${message}. Confirm the Local LLM endpoint is set to http://127.0.0.1:11434/v1 and the local Codex bridge is reachable at ${getBridgeHealthUrl()}.`
            : `${message}. Confirm ThreatCaddy is opened from http://127.0.0.1:5173 or http://localhost:5173 and the local Codex bridge is reachable at ${getBridgeHealthUrl()}.`
          : message;
      setTestError(displayMessage);
      onTestStatusChange?.('error', displayMessage);
    }
  }, [getBaseUrl, getBridgeHealthUrl, isStandaloneFile, settings.llmLocalApiKey, settings.llmLocalModelName, onUpdateSettings, onTestStatusChange]);

  return (
    <div className="border border-gray-700 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm text-gray-300 font-medium">{t('ai.localLlm')}</label>
        <div className="flex items-center gap-1.5">
          {testStatus === 'success' && <CheckCircle2 size={12} className="text-green-400" />}
          {testStatus === 'error' && <AlertTriangle size={12} className="text-red-400" />}
          <button
            onClick={testConnection}
            disabled={testStatus === 'testing'}
            className="text-[10px] text-accent-blue hover:underline disabled:opacity-50"
          >
            {testStatus === 'testing' ? t('ai.testing') : t('ai.testConnection')}
          </button>
        </div>
      </div>
      {testStatus === 'error' && testError && (
        <p className="text-[10px] text-red-400">{testError}</p>
      )}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelClass}>{t('ai.endpointUrl')}</label>
          <button
            type="button"
            onClick={async () => {
              if (!showDiscover) {
                setShowDiscover(true);
                setDiscovering(true);
                const { uniqueEndpoints, probeEndpoint } = await import('../../lib/local-endpoint-discovery');
                const endpoints = uniqueEndpoints(settings.llmLocalEndpoint);
                setDiscoverProbes(endpoints.map((ep) => ({ endpoint: ep, status: 'probing', message: 'Scanningâ€¦', models: [] })));
                const results = await Promise.all(endpoints.map(probeEndpoint));
                setDiscoverProbes(results);
                setDiscovering(false);
              } else {
                setShowDiscover(false);
              }
            }}
            className="flex items-center gap-1 text-[10px] text-accent-blue hover:underline"
          >
            <Zap size={10} />
            {showDiscover ? 'Hide' : 'Discover local models'}
          </button>
        </div>
        {showDiscover && (
          <div className="mb-2 rounded-lg border border-gray-700 overflow-hidden">
            {discoverProbes.map((probe) => (
              <div key={probe.endpoint} className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-700/50 last:border-b-0 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-gray-300">{probe.endpoint}</div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {discovering && probe.status === 'probing' ? 'Scanningâ€¦' : probe.message}
                    {probe.durationMs != null ? ` Â· ${probe.durationMs}ms` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={probe.status !== 'ok'}
                  onClick={() => {
                    onUpdateSettings({
                      llmLocalEndpoint: probe.endpoint,
                      llmDefaultProvider: 'local',
                      ...(probe.models[0] ? { llmLocalModelName: probe.models[0], llmDefaultModel: probe.models[0] } : {}),
                    });
                    setAvailableModels(probe.models);
                    setShowDiscover(false);
                    setTestStatus('idle');
                    onTestStatusChange?.('idle');
                  }}
                  className="shrink-0 rounded border border-gray-700 bg-gray-800 px-2 py-0.5 text-[10px] font-semibold text-gray-300 hover:border-accent-blue hover:text-accent-blue disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                >
                  {probe.status === 'ok' ? 'Use' : probe.status === 'probing' ? 'â€¦' : 'âœ—'}
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          type="text"
          value={settings.llmLocalEndpoint || ''}
          onChange={(e) => { onUpdateSettings({ llmLocalEndpoint: e.target.value || undefined }); setTestStatus('idle'); onTestStatusChange?.('idle'); }}
          onBlur={(e) => {
            const normalized = normalizeLocalLlmEndpoint(e.target.value);
            if (normalized !== (settings.llmLocalEndpoint || '')) {
              onUpdateSettings({ llmLocalEndpoint: normalized || undefined });
            }
          }}
          placeholder="http://localhost:11434/v1"
          className={inputClass}
        />
        <p className="text-[10px] text-gray-600 mt-0.5">{t('ai.endpointHelp')}</p>
      </div>
      <div>
        <label className={labelClass}>{t('ai.localApiKey')}</label>
        <input
          type="password"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          value={settings.llmLocalApiKey || ''}
          onChange={(e) => onUpdateSettings({ llmLocalApiKey: e.target.value.trim() || undefined })}
          placeholder={t('ai.localApiKeyPlaceholder')}
          className={inputClass}
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className={labelClass}>{t('ai.model')}</label>
          <button
            onClick={fetchModels}
            disabled={fetchingModels}
            className="flex items-center gap-1 text-[10px] text-accent-blue hover:underline disabled:opacity-50"
          >
            {fetchingModels ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            {fetchingModels ? t('ai.fetching') : t('ai.fetchModels')}
          </button>
        </div>
        {availableModels.length > 0 ? (
          <select
            value={settings.llmLocalModelName || ''}
            onChange={(e) => onUpdateSettings({ llmLocalModelName: e.target.value || undefined })}
            className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-accent"
          >
            <option value="">{t('ai.selectModel')}</option>
            {availableModels.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={settings.llmLocalModelName || ''}
            onChange={(e) => onUpdateSettings({ llmLocalModelName: e.target.value.trim() || undefined })}
            placeholder="llama3.1, qwen2.5, mistral-nemo, etc."
            className={inputClass}
          />
        )}
        {availableModels.length > 0 && (
          <p className="text-[10px] text-green-400/70 mt-0.5">{t('ai.modelsAvailable', { count: availableModels.length })}</p>
        )}
      </div>

      {/* Agent Skills Discovery */}
      <div className="border-t border-gray-700 pt-3 mt-1">
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-400 font-medium">{t('ai.agentSkills')}</label>
          <button
            onClick={async () => {
              setFetchingSkills(true);
              setSkillsError('');
              try {
                const { fetchHostSkills } = await import('../../lib/agent-hosts');
                const baseUrl = settings.llmLocalEndpoint!.replace(/\/+$/, '').replace(/\/v1\/?$/, '');
                const skills = await fetchHostSkills({
                  id: 'local', name: 'local', displayName: 'Local Agent',
                  url: baseUrl, apiKey: settings.llmLocalApiKey, enabled: true, skills: [],
                });
                onUpdateSettings({ llmLocalSkills: skills, llmLocalSkillsFetchedAt: Date.now() });
                setShowSkills(true);
              } catch (err) {
                setSkillsError((err as Error).message);
                // Don't clear existing skills on failure
              } finally {
                setFetchingSkills(false);
              }
            }}
            disabled={fetchingSkills || !settings.llmLocalEndpoint}
            className="flex items-center gap-1 text-[10px] text-accent-blue hover:underline disabled:opacity-50"
          >
            {fetchingSkills ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            {fetchingSkills ? t('ai.discovering') : t('ai.discoverSkills')}
          </button>
        </div>
        <p className="text-[10px] text-gray-600 mt-0.5" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(t('ai.skillsHelp'), { ALLOWED_TAGS: ['code'], ALLOWED_ATTR: [] }) }} />
        {skillsError && <p className="text-[10px] text-gray-500 mt-1">{t('ai.skillDiscoveryFailed', { error: skillsError.substring(0, 100) })}</p>}
        {(settings.llmLocalSkills || []).length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setShowSkills(!showSkills)}
              className="text-[10px] text-green-400/70 hover:text-green-400"
            >
              {t('ai.skillsAvailable', { count: settings.llmLocalSkills!.length })} {showSkills ? 'â–¾' : 'â–¸'}
            </button>
            {showSkills && (
              <div className="mt-1.5 space-y-1">
                {settings.llmLocalSkills!.map(skill => (
                  <div key={skill.name} className="flex items-start gap-2 py-1 border-b border-gray-800 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-gray-200">{skill.name}</span>
                        <span className={`text-[9px] px-1 rounded ${skill.actionClass === 'modify' ? 'text-amber-400' : skill.actionClass === 'read' ? 'text-green-400' : 'text-blue-400'} bg-gray-800`}>
                          {skill.actionClass || 'fetch'}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500">{skill.description}</p>
                    </div>
                    <span className="text-[9px] text-gray-600 font-mono shrink-0">local:{skill.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
