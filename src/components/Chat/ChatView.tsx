import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Plus, Trash2, MessageSquare, Share2, Pencil, FileText, Key, Puzzle, Shield, ArrowLeft, Square, RefreshCw, Eye, Play, Check, X, FolderPlus, ChevronRight, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AgentHost, ChatThread, ChatMessage, LLMProvider, Settings, ToolUseBlock, ToolCallRecord } from '../../types';
import { ClsSelect } from '../Common/ClsSelect';
import { ClsBadge } from '../Common/ClsBadge';
import { ConfirmDialog } from '../Common/ConfirmDialog';
import { ChatMessageBubble } from './ChatMessage';
import { AgentCycleSummaryCard } from '../Agent/AgentCycleSummaryCard';
import { ChatInput } from './ChatInput';
import { FortuneIntBar } from './FortuneIntBar';
import { useLLM } from '../../hooks/useLLM';
import { DEFAULT_MODEL_PER_PROVIDER } from '../../lib/models';
import { cn, formatDate } from '../../lib/utils';
import { nanoid } from 'nanoid';
import { TOOL_DEFINITIONS, buildSystemPrompt, executeTool, isWriteTool, fetchViaExtensionBridge } from '../../lib/llm-tools';
import { getToolDefinitionsForScope } from '../../lib/tool-scopes';
import { executeHostSkill, fetchHostSkills, getHostToolDefinitions } from '../../lib/agent-hosts';
import {
  CTI_CENSYS_TOOL,
  CTI_FLASHPOINT_COMMUNITIES_TOOL,
  CTI_VIRUSTOTAL_BUNDLE_TOOL,
  CTI_VIRUSTOTAL_SEARCH_COLLECTION_TOOL,
  CTI_VIRUSTOTAL_SEARCH_TOOL,
  CTI_VIRUSTOTAL_TOOL,
  DEFAULT_CTI_SOURCE_TEMPLATES,
  getCtiTemplate,
  normalizeCtiSourceRunResult,
  parseCtiSlashCommand,
  parseCtiTemplatePatchJson,
  parseCtiTemplateJson,
  planCtiSourceRequests,
  renderCtiRunMarkdown,
  renderCtiEvidenceMarkdown,
} from '../../lib/cti-source-formatting';
import { generateChatTitle } from '../../lib/chat-utils';
import { truncateConversation, summarizeConversation, MAX_CONTEXT_MESSAGES } from '../../lib/chat-utils';
import { db } from '../../db';
import { useChatLoops } from '../../hooks/useChatLoops';
import { hasLoopsForThread } from '../../lib/chat-loop';
import { resolveMentions } from '../../lib/chat-mentions';
import { createCheckpoint, restoreCheckpoint } from '../../lib/checkpoints';
import { useCustomSlashCommands, interpolateTemplate } from '../../hooks/useCustomSlashCommands';
import { useToast } from '../../contexts/ToastContext';
import { supportsVision, describeImage } from '../../lib/image-ocr';
import { isFortuneIntCommand } from '../../lib/fortuneint';
import { resolveRoutingMode } from '../../lib/llm-router';
import type { ChatAttachment } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { useInvestigation } from '../../contexts/InvestigationContext';
import type { CtiEvidence, CtiSourceId, CtiSourceTemplate } from '../../types';

/** Strip tool call JSON from streaming content (local LLMs output tool calls as text). */
// Regexes hoisted to module scope — compiled once, not per render frame
const RE_COMPLETE_TAG = new RegExp('<(?:tool_call|function_call)>[\\s\\S]*?</(?:tool_call|function_call)>', 'gi');
const RE_OPEN_TAG = new RegExp('<(?:tool_call|function_call)>[\\s\\S]*$', 'i');
const RE_COMPLETE_JSON = new RegExp('```json\\s*\\n?\\s*\\{\\s*"name"\\s*:[\\s\\S]*?```', 'gi');
const RE_PARTIAL_JSON = new RegExp('```json\\s*\\n?\\s*\\{\\s*"name"\\s*:[\\s\\S]*$', 'i');

function cleanStreamingContent(text: string): string {
  let cleaned = text.replace(RE_COMPLETE_TAG, '').replace(RE_COMPLETE_JSON, '');
  const openMatch = cleaned.match(RE_OPEN_TAG);
  if (openMatch?.index !== undefined) cleaned = cleaned.slice(0, openMatch.index);
  const jsonMatch = cleaned.match(RE_PARTIAL_JSON);
  if (jsonMatch?.index !== undefined) cleaned = cleaned.slice(0, jsonMatch.index);
  return cleaned.trim();
}

interface ChatViewProps {
  threads: ChatThread[];
  onCreateThread: (partial?: Partial<ChatThread>) => Promise<ChatThread>;
  onUpdateThread: (id: string, updates: Partial<ChatThread>) => void;
  onAddMessage: (threadId: string, message: ChatMessage) => Promise<void>;
  onTrashThread: (id: string) => void;
  onShareThread?: (thread: ChatThread) => void;
  settings: Settings;
  onUpdateSettings?: (updates: Partial<Settings>) => void;
  onEntitiesChanged?: () => void;
  onNavigateToEntity?: (type: string, id: string) => void;
  onOpenSettings?: (tab?: string) => void;
  fortuneIntMode?: boolean;
  onActivateFortuneInt?: () => void;
  fortuneIntOpenRequest?: number;
  pendingDraft?: ChatPendingDraft | null;
  onPendingDraftConsumed?: (id: string) => void;
}

const LOCAL_MAX_CONTEXT_MESSAGES = 12;

interface ChatPendingDraft {
  id: string;
  threadId: string;
  text: string;
  attachments?: ChatAttachment[];
}

function summarizeToolCalls(toolCalls: ToolCallRecord[]): string {
  if (toolCalls.length === 0) {
    return 'Done. I did not receive a separate written summary for this step.';
  }

  const lines = toolCalls.map((tc) => {
    const title = typeof tc.input.title === 'string' ? tc.input.title : undefined;
    const iocCount = Array.isArray(tc.input.iocs) ? tc.input.iocs.length : undefined;

    if (tc.isError) {
      return `- \`${tc.name}\` failed.`;
    }

    switch (tc.name) {
      case 'create_note':
        return title ? `- Created note **${title}**.` : '- Created a note.';
      case 'update_note':
        return title ? `- Updated note **${title}**.` : '- Updated a note.';
      case 'create_task':
        return title ? `- Created task **${title}**.` : '- Created a task.';
      case 'update_task':
        return title ? `- Updated task **${title}**.` : '- Updated a task.';
      case 'create_timeline_event':
        return title ? `- Created timeline event **${title}**.` : '- Created a timeline event.';
      case 'update_timeline_event':
        return title ? `- Updated timeline event **${title}**.` : '- Updated a timeline event.';
      case 'create_ioc':
        return '- Created an IOC.';
      case 'update_ioc':
        return '- Updated an IOC.';
      case 'bulk_create_iocs':
        return typeof iocCount === 'number'
          ? `- Processed ${iocCount} IOC${iocCount === 1 ? '' : 's'}.`
          : '- Processed multiple IOCs.';
      case 'link_entities':
        return '- Linked related entities.';
      case 'generate_report':
        return '- Generated a report.';
      default:
        return `- Ran \`${tc.name}\` successfully.`;
    }
  });

  const failed = toolCalls.filter((tc) => tc.isError).length;
  const intro = failed > 0
    ? 'I completed the requested actions, but some tool calls failed:'
    : 'I completed the requested actions:';

  return `${intro}\n\n${lines.join('\n')}`;
}

function parseCtiFormatCommand(text: string): { source: CtiSourceId; instruction: string } | null {
  const match = text.match(/^\/cti-format\s+(virustotal|censys|flashpoint)\s+([\s\S]+)$/i);
  if (!match) return null;
  return { source: match[1].toLowerCase() as CtiSourceId, instruction: match[2].trim() };
}

function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

function sampleCtiEvidence(source: CtiSourceId): CtiEvidence {
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
      caveats: ['Sample preview only; real evidence is rendered from Agent Host results.'],
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
      caveats: ['Sample preview only; real evidence is rendered from Agent Host results.'],
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
    caveats: ['Sample preview only; real evidence is rendered from Agent Host results.'],
    recommendedPivots: ['Corroborate actor and victim claims before creating final assessment language.'],
    warnings: [],
    raw: { preview: true },
  };
}

export function ChatView({
  threads,
  onCreateThread,
  onUpdateThread,
  onAddMessage,
  onTrashThread,
  onShareThread,
  settings,
  onUpdateSettings,
  onEntitiesChanged,
  onNavigateToEntity,
  onOpenSettings,
  fortuneIntMode = false,
  onActivateFortuneInt,
  fortuneIntOpenRequest,
  pendingDraft,
  onPendingDraftConsumed,
}: ChatViewProps) {
  const { selectedChatThreadId: selectedThreadId, setSelectedChatThreadId: onSelectThread } = useNavigation();
  const { selectedFolderId, folders } = useInvestigation();
  const { extensionAvailable, streamingContent, isStreaming, error, toolActivity, sendAgentRequest, abort } = useLLM();
  const { t } = useTranslation('chat');
  const { addToast } = useToast();
  const { serverUrl } = useAuth();
  const serverConnected = !!serverUrl;
  const effectiveRoute = resolveRoutingMode(settings.llmRoutingMode, extensionAvailable, serverConnected);
  const configuredLocalEndpoint = settings.llmLocalEndpoint?.trim() || '';
  const configuredLocalModel = settings.llmLocalModelName?.trim() || '';
  const hasLocalLLM = !!configuredLocalEndpoint;
  const canChat = extensionAvailable || serverConnected || hasLocalLLM;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [threadSourceFilter, setThreadSourceFilter] = useState<'all' | 'human' | 'agent' | 'meeting'>('all');
  const [expandedChatFolders, setExpandedChatFolders] = useState<Set<string>>(new Set());
  const [showNewChatFolder, setShowNewChatFolder] = useState(false);
  const [newChatFolderName, setNewChatFolderName] = useState('');
  const [renamingChatFolderId, setRenamingChatFolderId] = useState<string | null>(null);
  const [renamingChatFolderValue, setRenamingChatFolderValue] = useState('');

  const filteredThreads = useMemo(() => threadSourceFilter === 'all'
    ? threads
    : threads.filter(t => {
        if (t.isFolder) return true; // folders always visible
        if (threadSourceFilter === 'human') return !t.source || t.source === 'user';
        if (threadSourceFilter === 'agent') return t.source === 'agent';
        if (threadSourceFilter === 'meeting') return t.source === 'agent-meeting';
        return true;
      }), [threads, threadSourceFilter]);
  const [errorHasSettingsLink, setErrorHasSettingsLink] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('caddyai-onboarded');
  });

  const dismissOnboarding = useCallback(() => {
    localStorage.setItem('caddyai-onboarded', '1');
    setShowOnboarding(false);
  }, []);
  const [trashConfirmId, setTrashConfirmId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  const activeThread = threads.find((t) => t.id === selectedThreadId);
  const effectiveFolderId = activeThread?.folderId || selectedFolderId;
  const effectiveFolder = useMemo(
    () => effectiveFolderId ? folders.find((folder) => folder.id === effectiveFolderId) : undefined,
    [effectiveFolderId, folders],
  );
  const { loops: activeLoops, startLoop, stopAllForThread } = useChatLoops(activeThread?.id);
  const { commands: customCommands } = useCustomSlashCommands();

  // ── Image attachments ──────────────────────────────────────────────
  const [pendingImages, setPendingImages] = useState<ChatAttachment[]>([]);

  const handleImageAttach = useCallback(async (files: File[]) => {
    const attachments: ChatAttachment[] = [];
    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      attachments.push({ type: 'image', data: base64, mimeType: file.type, name: file.name });
    }
    setPendingImages(prev => [...prev, ...attachments]);
  }, []);

  // ── YOLO mode — auto-approve all write tools without prompting (persisted in settings)
  const yoloMode = settings.caddyAiYoloMode ?? false;
  const setYoloMode = useCallback((val: boolean) => {
    onUpdateSettings({ caddyAiYoloMode: val });
  }, [onUpdateSettings]);
  // Track which thread is streaming so we don't show stale content on thread switch
  const streamingThreadRef = useRef<string | undefined>(undefined);
  const yoloModeRef = useRef(false);
  useEffect(() => { yoloModeRef.current = yoloMode; }, [yoloMode]);

  // ── Write tool approval flow (state declared early so handleSend can reference it)
  const [pendingApproval, setPendingApproval] = useState<{
    toolName: string;
    input: Record<string, unknown>;
    threadId: string;
    resolve: (approved: boolean) => void;
  } | null>(null);
  const [pendingCtiTemplateSuggestion, setPendingCtiTemplateSuggestion] = useState<{
    source: CtiSourceId;
    template: CtiSourceTemplate;
    beforePreview: string;
    afterPreview: string;
  } | null>(null);

  // Memoize system prompt — only rebuild when folder context changes
  const systemPromptRef = useRef<string>('');
  const systemPromptKeyRef = useRef<string>('');
  useEffect(() => {
    const provider = activeThread?.provider ?? 'anthropic';
    const key = `${effectiveFolder?.id ?? ''}:${effectiveFolder?.updatedAt ?? ''}:${settings.llmSystemPrompt ?? ''}:${provider}`;
    if (key === systemPromptKeyRef.current) return;
    systemPromptKeyRef.current = key;
    buildSystemPrompt(effectiveFolder, settings.llmSystemPrompt, provider).then((prompt) => {
      systemPromptRef.current = prompt;
    });
  }, [effectiveFolder, settings.llmSystemPrompt, activeThread?.provider]);

  // Auto-select first non-folder thread when none selected (or stale selection)
  useEffect(() => {
    if (threads.length > 0 && (!selectedThreadId || !threads.some(t => t.id === selectedThreadId))) {
      const first = threads.find(t => !t.isFolder);
      if (first) onSelectThread(first.id);
    }
  }, [selectedThreadId, threads, onSelectThread]);

  // Scroll to bottom on new messages or streaming content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.messages?.length, streamingContent, toolActivity.length]);

  // Show LLM errors
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (error) setLocalError(error);
  }, [error]);

  // Compute which providers have API keys configured (must be before handleNewChat)
  const configuredProviders = useMemo(() => {
    const providers = new Set<string>();
    if (settings.llmAnthropicApiKey?.trim()) providers.add('anthropic');
    if (settings.llmOpenAIApiKey?.trim()) providers.add('openai');
    if (settings.llmGeminiApiKey?.trim()) providers.add('gemini');
    if (settings.llmMistralApiKey?.trim()) providers.add('mistral');
    if (configuredLocalEndpoint && configuredLocalModel) providers.add('local');
    return providers;
  }, [settings.llmAnthropicApiKey, settings.llmOpenAIApiKey, settings.llmGeminiApiKey, settings.llmMistralApiKey, configuredLocalEndpoint, configuredLocalModel]);

  const getDefaultThreadConfig = useCallback(() => {
    let defaultModel = settings.llmDefaultModel || 'claude-sonnet-4-6';
    let defaultProvider: LLMProvider = (settings.llmDefaultProvider as LLMProvider) || 'anthropic';

    if (configuredProviders.size > 0 && !configuredProviders.has(defaultProvider)) {
      const first = configuredProviders.values().next().value!;
      defaultProvider = first as LLMProvider;
      defaultModel = DEFAULT_MODEL_PER_PROVIDER[defaultProvider] || settings.llmLocalModelName || defaultModel;
    }

    return { model: defaultModel, provider: defaultProvider };
  }, [configuredProviders, settings.llmDefaultModel, settings.llmDefaultProvider, settings.llmLocalModelName]);

  const findReusableEmptyThread = useCallback(() => threads.find(t =>
    !t.trashed && !t.isFolder && t.messages.length === 0 &&
    t.id !== selectedThreadId &&
    (selectedFolderId ? t.folderId === selectedFolderId : true) &&
    t.source !== 'agent' && t.source !== 'agent-meeting'
  ), [threads, selectedThreadId, selectedFolderId]);

  const ensureChatThread = useCallback(async () => {
    const existingEmpty = findReusableEmptyThread();
    if (existingEmpty) {
      onSelectThread(existingEmpty.id);
      return existingEmpty;
    }

    const { model, provider } = getDefaultThreadConfig();
    const thread = await onCreateThread({
      model,
      provider,
      folderId: selectedFolderId,
    });
    onSelectThread(thread.id);
    return thread;
  }, [findReusableEmptyThread, getDefaultThreadConfig, onCreateThread, onSelectThread, selectedFolderId]);

  const handleNewChat = useCallback(async () => {
    try {
      await ensureChatThread();
    } catch (err) {
      console.error('Failed to create chat thread:', err);
      setLocalError(t('view.errorCreateThread'));
    }
  }, [ensureChatThread, t]);

  const getApiKeyForProvider = useCallback((provider: LLMProvider, s: Settings): string | undefined => {
    switch (provider) {
      case 'anthropic': return s.llmAnthropicApiKey?.trim();
      case 'openai': return s.llmOpenAIApiKey?.trim();
      case 'gemini': return s.llmGeminiApiKey?.trim();
      case 'mistral': return s.llmMistralApiKey?.trim();
      case 'local': return s.llmLocalApiKey?.trim() || 'local';
      default: return undefined;
    }
  }, []);

  const getProviderLabel = useCallback((provider: LLMProvider): string => {
    switch (provider) {
      case 'anthropic': return 'Anthropic';
      case 'openai': return 'OpenAI';
      case 'gemini': return 'Google Gemini';
      case 'mistral': return 'Mistral';
      case 'local': return 'Local LLM';
      default: return provider;
    }
  }, []);

  const handleSend = useCallback(async (text: string, overrideImages?: ChatAttachment[]) => {
    if (!activeThread) return;
    setLocalError(null);
    setErrorHasSettingsLink(false);
    const ctiSlashCommand = parseCtiSlashCommand(text);
    if (isFortuneIntCommand(text)) {
      onActivateFortuneInt?.();
      return;
    }

    let provider = activeThread.provider;
    let model = activeThread.model;
    const useServerProxy = effectiveRoute === 'server' && serverConnected;
    const localEndpoint = configuredLocalEndpoint;
    const localModel = configuredLocalModel;

    // Validate API key (skip when routing through server — server has its own keys)
    if (!useServerProxy && !ctiSlashCommand) {
      if (!configuredProviders.has(provider)) {
        const fallbackProvider = configuredProviders.values().next().value as LLMProvider | undefined;
        if (fallbackProvider) {
          provider = fallbackProvider;
          model = DEFAULT_MODEL_PER_PROVIDER[fallbackProvider] || settings.llmLocalModelName || model;
          onUpdateThread(activeThread.id, { provider, model });
        }
      }
      if (provider === 'local' && (!localEndpoint || !localModel)) {
        const fallbackProvider = [...configuredProviders].find(p => p !== 'local') as LLMProvider | undefined;
        if (fallbackProvider) {
          provider = fallbackProvider;
          model = DEFAULT_MODEL_PER_PROVIDER[fallbackProvider] || model;
          onUpdateThread(activeThread.id, { provider, model });
        } else {
          setLocalError(t('view.errorNoLocalEndpoint'));
          setErrorHasSettingsLink(true);
          return;
        }
      }
      let apiKey = getApiKeyForProvider(provider, settings);
      if (!apiKey && provider !== 'local' && localEndpoint && localModel) {
        provider = 'local';
        model = localModel;
        apiKey = getApiKeyForProvider(provider, settings);
        onUpdateThread(activeThread.id, { provider, model });
      }
      if (!apiKey) {
        setLocalError(t('view.errorNoApiKey', { provider: getProviderLabel(provider) }));
        setErrorHasSettingsLink(true);
        return;
      }
    }
    const apiKey = useServerProxy ? 'server-proxy' : getApiKeyForProvider(provider, settings);

    // Hard token budget cap — prevent sending when over budget
    if (!ctiSlashCommand && settings.llmTokenBudget && threadTokenTotalRef.current > settings.llmTokenBudget) {
      setLocalError(t('view.errorOverBudget', `Token budget exceeded (${threadTokenTotalRef.current.toLocaleString()} / ${settings.llmTokenBudget.toLocaleString()}). Start a new thread or increase the budget in Settings > AI.`));
      return;
    }

    // Resolve @-mentions: replace tokens with labels for display, inject entity data for LLM
    const { displayText: mentionDisplayText, contextBlock: mentionContext } = await resolveMentions(text);

    // Capture and clear pending images
    const images = overrideImages && overrideImages.length > 0
      ? overrideImages
      : pendingImages.length > 0 ? [...pendingImages] : undefined;
    if (!overrideImages && images) setPendingImages([]);

    // Add user message (with readable @-mention labels)
    const userMsg: ChatMessage = {
      id: nanoid(),
      role: 'user',
      content: mentionDisplayText,
      attachments: images,
      createdAt: Date.now(),
    };
    await onAddMessage(activeThread.id, userMsg);

    const ctiFormatCommand = parseCtiFormatCommand(text);

    if (ctiFormatCommand) {
      const currentTemplate = getCtiTemplate(ctiFormatCommand.source, settings.ctiSourceFormatTemplates);
      const sampleEvidence = sampleCtiEvidence(ctiFormatCommand.source);
      const beforePreview = renderCtiEvidenceMarkdown(sampleEvidence, currentTemplate);

      sendAgentRequest(
        {
          provider,
          model,
          messages: [{
            role: 'user',
            content: [
              'Propose a CTI source display template update.',
              'Return only one JSON patch object, not the full template.',
              'Allowed patch keys: label, description, sections, hiddenSections, showRawJson, caveatMode, pivotMode.',
              'Do not include id, version, source, active, hostTool, evidence values, raw JSON, caveats, warnings, status, verdict, counts, observable, source name, tool names, inputs, or recommended pivots.',
              'Section field keys must come from the current template; you may change labels, order, required, fallback, and format.',
              `Source: ${ctiFormatCommand.source}`,
              `Instruction: ${ctiFormatCommand.instruction}`,
              `Current template JSON:\n${JSON.stringify(currentTemplate, null, 2)}`,
            ].join('\n\n'),
          }],
          apiKey: apiKey!,
          systemPrompt: 'You propose approval-gated display-template JSON patches for ThreatCaddy CTI evidence. Never alter evidence, raw vendor data, caveats, status, verdicts, counts, source identity, tool results, or inputs. Output a JSON patch object only.',
          tools: [],
          endpoint: provider === 'local' ? localEndpoint : undefined,
          useServerProxy: effectiveRoute === 'server',
        },
        async () => ({ result: JSON.stringify({ error: 'Template suggestion requests cannot call tools.' }), isError: true }),
        async ({ content }) => {
          const json = extractJsonObject(content);
          const parsed = json ? parseCtiTemplatePatchJson(json, currentTemplate, ctiFormatCommand.source) : { issues: ['The LLM did not return a JSON template patch object.'] };
          if (!parsed.template || parsed.issues.length > 0) {
            await onAddMessage(activeThread.id, {
              id: nanoid(),
              role: 'assistant',
              content: `I could not create a safe CTI format suggestion.\n\n${parsed.issues.map(issue => `- ${issue}`).join('\n')}`,
              model,
              createdAt: Date.now(),
            });
            return;
          }

          const proposed = {
            ...parsed.template,
            source: ctiFormatCommand.source,
            active: parsed.template.active,
            suggestedBy: 'llm' as const,
          };
          const reparsed = parseCtiTemplateJson(JSON.stringify(proposed));
          if (!reparsed.template || reparsed.issues.length > 0) {
            await onAddMessage(activeThread.id, {
              id: nanoid(),
              role: 'assistant',
              content: `I rejected the CTI format suggestion because it failed validation.\n\n${reparsed.issues.map(issue => `- ${issue}`).join('\n')}`,
              model,
              createdAt: Date.now(),
            });
            return;
          }

          const afterPreview = renderCtiEvidenceMarkdown(sampleEvidence, reparsed.template);
          setPendingCtiTemplateSuggestion({
            source: ctiFormatCommand.source,
            template: reparsed.template,
            beforePreview,
            afterPreview,
          });
          await onAddMessage(activeThread.id, {
            id: nanoid(),
            role: 'assistant',
            content: [
              `## Proposed CTI format update: ${DEFAULT_CTI_SOURCE_TEMPLATES[ctiFormatCommand.source].label}`,
              '',
              'This is a display-template suggestion only. It has not been saved, and it cannot change evidence values.',
              '',
              '### Before',
              beforePreview,
              '',
              '### After',
              afterPreview,
              '',
              'Use the approval dialog to save or discard this template.',
            ].join('\n'),
            model,
            createdAt: Date.now(),
          });
        },
      );
      return;
    }

    const SLASH_TRANSFORMS: Record<string, (arg: string) => string> = {
      '/search':   (q) => `Search my notes for: ${q}`,
      '/note':     (t) => `Create a note titled "${t}"`,
      '/task':     (t) => `Create a task: ${t}`,
      '/iocs':     (t) => `Extract IOCs from the following text:\n${t}`,
      '/summary':  ()  => `Give me a summary of this investigation`,
      '/timeline': ()  => `List the timeline events in this investigation`,
      '/report':   ()  => `Generate a comprehensive investigation report. Analyze all notes, tasks, IOCs, and timeline events, then use the generate_report tool to create a structured report note.`,
      '/triage':   (t) => `Auto-triage the following alert/email. Extract all IOCs, create them as standalone IOCs using bulk_create_iocs, create relevant timeline events, and provide a triage summary:\n\n${t}`,
      '/graph':    ()  => `Analyze the entity relationship graph for this investigation. Identify the most connected entities, any isolated nodes, and interesting clusters or patterns.`,
      '/link':     (t) => `Search across all entities for "${t}" and suggest which ones should be linked together. Then use the link_entities tool to create the cross-references.`,
    };

    const slashMatch = text.match(/^(\/[a-z0-9_-]+)\s*([\s\S]*)$/i);
    let llmText = text + mentionContext;
    if (slashMatch) {
      const [, cmd, arg] = slashMatch;
      const transform = SLASH_TRANSFORMS[cmd.toLowerCase()];
      if (transform) {
        llmText = transform(arg.trim());
      } else {
        // Check custom slash commands
        const cmdName = cmd.slice(1).toLowerCase();
        const custom = customCommands.find(c => c.name === cmdName);
        if (custom) {
          llmText = interpolateTemplate(custom.template, arg.trim());
        }
      }
    }

    if (ctiSlashCommand && !ctiSlashCommand.target) {
      const assistantMsg: ChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: 'Please provide an IOC, VT query, or infrastructure target, for example `/vt 8.8.8.8`, `/vt-hunt bad.example`, `/vt-search engines:"akira"`, `/censys 8.8.8.8`, or `/all 8.8.8.8`.',
        createdAt: Date.now(),
      };
      await onAddMessage(activeThread.id, assistantMsg);
      return;
    }

    let settingsForTools = settings;
    let hostTools = getHostToolDefinitions(settingsForTools);
    let llmHostTools = getHostToolDefinitions(settingsForTools, { llmSafeNames: true });
    if (settings.agentHosts?.some(h => h.enabled)) {
      const refreshedHosts = await Promise.all((settings.agentHosts || []).map(async (host) => {
        if (!host.enabled) return host;
        try {
          const skills = await fetchHostSkills(host);
          return { ...host, skills, skillsFetchedAt: Date.now() };
        } catch {
          return host;
        }
      }));
      settingsForTools = { ...settings, agentHosts: refreshedHosts };
      hostTools = getHostToolDefinitions(settingsForTools);
      llmHostTools = getHostToolDefinitions(settingsForTools, { llmSafeNames: true });
      onUpdateSettings?.({ agentHosts: refreshedHosts });
    }

    const requiredCtiToolNames = ctiSlashCommand
      ? ctiSlashCommand.source === 'virustotal'
        ? ctiSlashCommand.command === '/vt-search'
          ? [CTI_VIRUSTOTAL_SEARCH_COLLECTION_TOOL, CTI_VIRUSTOTAL_SEARCH_TOOL]
          : ctiSlashCommand.command === '/vt-hunt'
            ? [CTI_VIRUSTOTAL_BUNDLE_TOOL, CTI_VIRUSTOTAL_TOOL]
            : [CTI_VIRUSTOTAL_TOOL]
        : ctiSlashCommand.source === 'censys'
          ? [CTI_CENSYS_TOOL]
          : ctiSlashCommand.source === 'flashpoint'
            ? [CTI_FLASHPOINT_COMMUNITIES_TOOL]
            : [CTI_VIRUSTOTAL_TOOL, CTI_CENSYS_TOOL, CTI_FLASHPOINT_COMMUNITIES_TOOL]
      : [];
    if (ctiSlashCommand && !requiredCtiToolNames.some(name => hostTools.some(t => t.name === name))) {
      const localCtiHost: AgentHost = {
        id: 'local-cti',
        name: 'cti',
        displayName: 'CTI Agent Host',
        url: 'http://127.0.0.1:8766',
        apiKey: 'codex-local-dev',
        enabled: true,
        skills: [],
      };
      try {
        const skills = await fetchHostSkills(localCtiHost);
        const transientHost = { ...localCtiHost, skills, skillsFetchedAt: Date.now() };
        settingsForTools = { ...settingsForTools, agentHosts: [...(settingsForTools.agentHosts || []), transientHost] };
        hostTools = getHostToolDefinitions(settingsForTools);
        llmHostTools = getHostToolDefinitions(settingsForTools, { llmSafeNames: true });
      } catch {
        // The deterministic CTI slash path below will report that no Agent Host tools are reachable.
      }
    }

    if (ctiSlashCommand) {
      const plan = planCtiSourceRequests(ctiSlashCommand, hostTools.map(t => t.name));
      if (plan.validationErrors.length > 0) {
        await onAddMessage(activeThread.id, {
          id: nanoid(),
          role: 'assistant',
          content: plan.validationErrors.map(issue => `- ${issue}`).join('\n'),
          createdAt: Date.now(),
        });
        return;
      }

      const results = await Promise.all(plan.planned.map(async (item) => {
        try {
          const result = await executeHostSkill(item.tool, item.input, settingsForTools);
          return normalizeCtiSourceRunResult(item, result);
        } catch (err) {
          return normalizeCtiSourceRunResult(item, JSON.stringify({ error: (err as Error).message || String(err) }));
        }
      }));

      const assistantMsg: ChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: renderCtiRunMarkdown(ctiSlashCommand.target, results, plan.skipped, settings.ctiSourceFormatTemplates),
        createdAt: Date.now(),
      };
      await onAddMessage(activeThread.id, assistantMsg);
      return;
    }

    // Intercept /fetch <url> — fetch directly without LLM
    const fetchMatch = text.match(/^\/fetch\s+(https?:\/\/\S+)$/i);
    if (fetchMatch) {
      const url = fetchMatch[1];
      try {
        const result = await fetchViaExtensionBridge(url);
        if (result.success) {
          const title = result.title || new URL(url).hostname;
          const now = Date.now();
          await db.notes.add({
            id: nanoid(),
            title,
            content: result.content || '',
            folderId: effectiveFolderId || undefined,
            tags: [],
            pinned: false,
            archived: false,
            trashed: false,
            createdAt: now,
            updatedAt: now,
          });
          const confirmMsg: ChatMessage = {
            id: nanoid(),
            role: 'assistant',
            content: `Created note **${title}** from ${url}`,
            createdAt: Date.now(),
          };
          await onAddMessage(activeThread.id, confirmMsg);
          onEntitiesChanged?.();
        } else {
          const errorMsg: ChatMessage = {
            id: nanoid(),
            role: 'assistant',
            content: `Failed to fetch URL: ${result.error || 'Unknown error'}`,
            createdAt: Date.now(),
          };
          await onAddMessage(activeThread.id, errorMsg);
        }
      } catch (err) {
        const errorMsg: ChatMessage = {
          id: nanoid(),
          role: 'assistant',
          content: `Failed to fetch URL: ${(err as Error).message || String(err)}`,
          createdAt: Date.now(),
        };
        await onAddMessage(activeThread.id, errorMsg);
      }
      return;
    }

    // Intercept /loop <interval> <prompt> — start a background scheduling loop
    const loopMatch = text.match(/^\/loop\s+(\d+[smh])\s+([\s\S]+)$/i);
    if (loopMatch) {
      const [, intervalStr, prompt] = loopMatch;
      const { id: loopId, formattedInterval } = startLoop({
        threadId: activeThread.id,
        prompt,
        intervalStr,
        model,
        provider,
        apiKey: apiKey!,
        systemPrompt: systemPromptRef.current || await buildSystemPrompt(effectiveFolder, settings.llmSystemPrompt, provider),
        endpoint: provider === 'local' ? localEndpoint : undefined,
        onMessage: onAddMessage,
      });
      const confirmMsg: ChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: `Started background loop \`${loopId}\`. Running every ${formattedInterval}:\n\n> ${prompt}\n\nUse \`/stoploop\` to stop.`,
        createdAt: Date.now(),
      };
      await onAddMessage(activeThread.id, confirmMsg);
      return;
    }

    // Intercept /stoploop — stop all loops for this thread
    if (text.match(/^\/stoploop$/i)) {
      const count = stopAllForThread(activeThread.id);
      const confirmMsg: ChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: count > 0
          ? `Stopped ${count} background loop${count > 1 ? 's' : ''}.`
          : 'No active loops to stop.',
        createdAt: Date.now(),
      };
      await onAddMessage(activeThread.id, confirmMsg);
      return;
    }

    // Use memoized system prompt — only rebuilt when folder context changes
    const systemPrompt = systemPromptRef.current || await buildSystemPrompt(effectiveFolder, settings.llmSystemPrompt, provider);

    // Build text-only messages for truncation, then overlay multimodal content
    const allMessages = [...activeThread.messages, userMsg];
    const textMessages = allMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m === userMsg ? llmText : m.content,
    }));

    // Truncate conversation to fit context window (use cached summary if available)
    const configuredMaxMessages = settings.llmMaxContextMessages || MAX_CONTEXT_MESSAGES;
    const maxMessages = provider === 'local'
      ? Math.min(configuredMaxMessages, LOCAL_MAX_CONTEXT_MESSAGES)
      : configuredMaxMessages;
    const truncatedTextMessages = truncateConversation(textMessages, maxMessages, activeThread.contextSummary);

    // Trigger async summarization of truncated messages for future use
    if (textMessages.length > maxMessages && !activeThread.contextSummary) {
      const truncatedPortion = textMessages.slice(2, -(maxMessages - 2));
      summarizeConversation(truncatedPortion, provider, model, apiKey!, provider === 'local' ? localEndpoint : undefined)
        .then((summary) => {
          if (summary) onUpdateThread(activeThread.id, { contextSummary: summary });
        })
        .catch(() => { /* ignore summarization failures */ });
    }

    // Build final messages with multimodal content blocks for images
    const isVisionCapable = supportsVision(provider);
    const conversationMessagesPromises = truncatedTextMessages.map(async (m) => {
      const original = allMessages.find(om => om.content === m.content || (om === userMsg && m.content === llmText));
      if (original?.attachments && original.attachments.length > 0) {
        if (isVisionCapable) {
          const blocks = [
            ...original.attachments.map(att => ({
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: att.mimeType, data: att.data },
            })),
            { type: 'text' as const, text: m.content },
          ];
          return { role: m.role, content: blocks };
        }
        // Fallback: describe images as text for non-vision providers
        const descriptions = await Promise.all(
          original.attachments.map(att => describeImage(att.data, att.mimeType, att.name))
        );
        return { role: m.role, content: m.content + '\n\n' + descriptions.join('\n') };
      }
      return m;
    });
    const conversationMessages = await Promise.all(conversationMessagesPromises);

    // Track whether any write tools were used
    let usedWriteTool = false;

    // In plan mode, filter out write tools so the LLM can only read/analyze
    const currentMode = activeThread.mode || 'act';
    const investigationTools = getToolDefinitionsForScope('investigation', TOOL_DEFINITIONS);
    const allTools = llmHostTools.length > 0 ? [...investigationTools, ...llmHostTools] : investigationTools;
    const tools = currentMode === 'plan'
      ? allTools.filter(t => !isWriteTool(t.name))
      : allTools;

    const ctiHostToolNames = llmHostTools
      .map(t => t.name)
      .filter(name => name.startsWith('host__cti__'))
      .sort();
    const ctiHostPrompt = ctiHostToolNames.length > 0
      ? `\n\nLocal CTI Agent Host tools are available for ephemeral vendor lookups without creating IOCs. Use exact tool names when needed: ${ctiHostToolNames.map(name => `\`${name}\``).join(', ')}. Prefer safe source-specific tools such as Flashpoint forum posts/reports/indicators, VirusTotal IOC reports, and Censys host/certificate lookups over raw request tools.`
      : '';

    // In plan mode, append instructions to the system prompt
    const finalSystemPrompt = currentMode === 'plan'
      ? systemPrompt + ctiHostPrompt + '\n\nYou are in PLAN MODE. Do NOT create, update, or modify any entities. Instead, describe what you WOULD do: list the tools you would call, what data you would create, and what your analysis plan is. Present this as a structured plan the analyst can review before switching to Act mode.'
      : systemPrompt + ctiHostPrompt;

    // Track which thread is streaming
    streamingThreadRef.current = activeThread.id;

    // Send with agentic loop
    sendAgentRequest(
      {
        provider,
        model,
        messages: conversationMessages,
        apiKey: apiKey!,
        systemPrompt: finalSystemPrompt,
        tools,
        endpoint: provider === 'local' ? localEndpoint : undefined,
        useServerProxy: effectiveRoute === 'server',
      },
      async (toolUse: ToolUseBlock) => {
        // Approval gate for write tools in Act mode (skip if yolo mode)
        if (isWriteTool(toolUse.name) && !yoloModeRef.current) {
          const threadAtRequest = activeThread.id;
          const approved = await new Promise<boolean>((resolve) => {
            setPendingApproval({
              toolName: toolUse.name,
              input: toolUse.input as Record<string, unknown>,
              threadId: threadAtRequest,
              resolve,
            });
          });

          if (!approved) {
            return {
              result: JSON.stringify({ error: 'Tool execution rejected by analyst' }),
              isError: true,
            };
          }
        }

        const result = await executeTool(toolUse, effectiveFolderId, undefined, 'investigation');
        if (isWriteTool(toolUse.name) && !result.isError) {
          usedWriteTool = true;
        }
        return result;
      },
      async ({ content, toolCalls, usage }) => {
        const msgId = nanoid();
        const trimmedContent = content.trim();
        const assistantContent = trimmedContent || summarizeToolCalls(toolCalls);
        const assistantMsg: ChatMessage = {
          id: msgId,
          role: 'assistant',
          content: assistantContent,
          model,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          tokenCount: usage,
          createdAt: Date.now(),
        };
        await onAddMessage(activeThread.id, assistantMsg);

        // Create checkpoint for write tool actions (enables undo)
        if (usedWriteTool && toolCalls.length > 0) {
          createCheckpoint(activeThread.id, msgId, toolCalls).catch(() => { /* ignore checkpoint failures */ });
        }

        // Trigger entity reload if any write tools were used
        if (usedWriteTool && onEntitiesChanged) {
          onEntitiesChanged();
        }

        // Auto-generate a contextual title after first exchange
        if (activeThread.messages.length <= 1 && assistantContent) {
          const titleApiKey = getApiKeyForProvider(provider, settings);
          if (titleApiKey) {
            const titleEndpoint = provider === 'local' ? localEndpoint : undefined;
            generateChatTitle(text, assistantContent, provider, model, titleApiKey, titleEndpoint)
              .then((title) => {
                if (title) onUpdateThread(activeThread.id, { title });
              })
              .catch(() => { /* ignore title generation failures */ });
          }
        }
      }
    );
  }, [activeThread, settings, effectiveFolder, effectiveFolderId, pendingImages, sendAgentRequest, onAddMessage, onUpdateThread, onEntitiesChanged, getApiKeyForProvider, getProviderLabel, startLoop, stopAllForThread, effectiveRoute, serverConnected, configuredLocalEndpoint, configuredLocalModel]);

  const consumedDraftIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!pendingDraft || consumedDraftIdsRef.current.has(pendingDraft.id)) return;
    if (!activeThread || activeThread.id !== pendingDraft.threadId) return;
    consumedDraftIdsRef.current.add(pendingDraft.id);
    onPendingDraftConsumed?.(pendingDraft.id);
    void handleSend(pendingDraft.text, pendingDraft.attachments);
  }, [activeThread, handleSend, onPendingDraftConsumed, pendingDraft]);

  const handleModelChange = useCallback((model: string, provider: LLMProvider) => {
    if (activeThread) {
      onUpdateThread(activeThread.id, { model, provider });
    }
  }, [activeThread, onUpdateThread]);

  const handleExportAsNote = useCallback(async () => {
    if (!activeThread || activeThread.messages.length === 0) return;
    let content = `# Chat: ${activeThread.title}\n\n`;
    content += `*Exported on ${new Date().toLocaleDateString()} — Model: ${activeThread.model}*\n\n---\n\n`;
    for (const msg of activeThread.messages) {
      const label = msg.role === 'user' ? '**You:**' : '**CaddyAI:**';
      content += `${label}\n\n${msg.content}\n\n`;
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls) {
          content += `> Tool: \`${tc.name}\` — ${tc.isError ? 'Error' : 'Success'}\n\n`;
        }
      }
      content += '---\n\n';
    }
    const noteId = nanoid();
    const now = Date.now();
    await db.notes.add({
      id: noteId,
      title: `Chat Export: ${activeThread.title}`,
      content,
      folderId: effectiveFolderId || undefined,
      tags: ['chat-export'],
      pinned: false,
      archived: false,
      trashed: false,
      createdAt: now,
      updatedAt: now,
    });
    onEntitiesChanged?.();
    // Navigate to the newly created note — delay slightly to let the notes list reload
    setTimeout(() => onNavigateToEntity?.('note', noteId), 100);
  }, [activeThread, effectiveFolderId, onEntitiesChanged, onNavigateToEntity]);

  const handleSuggestionClick = useCallback((text: string) => {
    handleSend(text);
  }, [handleSend]);

  // ── Write tool approval handlers ────────────────────────────────────
  const handleApprove = useCallback(() => {
    pendingApproval?.resolve(true);
    setPendingApproval(null);
  }, [pendingApproval]);

  const handleReject = useCallback(() => {
    pendingApproval?.resolve(false);
    setPendingApproval(null);
  }, [pendingApproval]);

  const handleApproveCtiTemplate = useCallback(() => {
    if (!pendingCtiTemplateSuggestion || !onUpdateSettings) return;
    const approvedTemplate: CtiSourceTemplate = {
      ...pendingCtiTemplateSuggestion.template,
      version: (pendingCtiTemplateSuggestion.template.version || 1) + 1,
      suggestedBy: pendingCtiTemplateSuggestion.template.suggestedBy || 'llm',
      approvedAt: Date.now(),
      approvedBy: settings.displayName || 'Analyst',
    };
    onUpdateSettings({
      ctiSourceFormatTemplates: {
        ...(settings.ctiSourceFormatTemplates || {}),
        [pendingCtiTemplateSuggestion.source]: approvedTemplate,
      },
    });
    setPendingCtiTemplateSuggestion(null);
    addToast('success', `Saved ${DEFAULT_CTI_SOURCE_TEMPLATES[approvedTemplate.source].label} CTI format.`);
  }, [addToast, onUpdateSettings, pendingCtiTemplateSuggestion, settings.ctiSourceFormatTemplates, settings.displayName]);

  const handleRejectCtiTemplate = useCallback(() => {
    setPendingCtiTemplateSuggestion(null);
  }, []);

  const renderEmptyState = (title: string, subtitle: string) => (
    <div className="h-full overflow-y-auto px-4 py-6">
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center gap-4 text-center text-text-muted">
        <div className="text-center text-text-muted">
          <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium text-text-primary">{title}</p>
          <p className="mx-auto mt-1 max-w-2xl text-sm">{subtitle}</p>
          {effectiveFolder && (
            <p className="mt-2 text-xs text-purple/70">
              {t('view.emptyFolderContext', { name: effectiveFolder.name })}
            </p>
          )}
          {!canChat && (
            <p className="mx-auto mt-4 max-w-xl rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-400">
              {t('view.extensionRequired')}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  // Clear pending approval when thread changes (prevents ghost from trashed threads)
  useEffect(() => {
    if (pendingApproval) {
      pendingApproval.resolve(false);
      setPendingApproval(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThreadId]);

  // ── Plan/Act mode ──────────────────────────────────────────────────
  const threadMode = activeThread?.mode || 'act';

  const toggleMode = useCallback(() => {
    if (!activeThread) return;
    const newMode = threadMode === 'act' ? 'plan' : 'act';
    onUpdateThread(activeThread.id, { mode: newMode });
    addToast('success', newMode === 'plan' ? t('view.switchedToPlan') : t('view.switchedToAct'));

    // When switching from Plan to Act, if the last assistant message exists,
    // prompt the user to execute the plan
    if (newMode === 'act' && activeThread.messages.length > 0) {
      const lastMsg = activeThread.messages[activeThread.messages.length - 1];
      if (lastMsg.role === 'assistant' && lastMsg.content.length > 100) {
        // Auto-send a prompt to execute the plan
        const executeMsg: ChatMessage = {
          id: nanoid(),
          role: 'assistant',
          content: t('view.switchedToActMessage'),
          createdAt: Date.now(),
        };
        onAddMessage(activeThread.id, executeMsg);
      }
    }
  }, [activeThread, threadMode, onUpdateThread, addToast, onAddMessage]);

  // ── Thread token totals ─────────────────────────────────────────────
  const threadTokenTotal = useMemo(() => {
    if (!activeThread) return 0;
    return activeThread.messages.reduce((sum, m) => {
      if (m.tokenCount) return sum + m.tokenCount.input + m.tokenCount.output;
      return sum;
    }, 0);
  }, [activeThread]);

  const threadTokenTotalRef = useRef(threadTokenTotal);
  threadTokenTotalRef.current = threadTokenTotal;

  // ── Session rewind ──────────────────────────────────────────────────
  const [rewindConfirmIndex, setRewindConfirmIndex] = useState<number | null>(null);

  const handleRewindConfirmed = useCallback(async () => {
    if (!activeThread || rewindConfirmIndex === null) return;
    const trimmedMessages = activeThread.messages.slice(0, rewindConfirmIndex + 1);
    onUpdateThread(activeThread.id, { messages: trimmedMessages });
    setRewindConfirmIndex(null);
  }, [activeThread, rewindConfirmIndex, onUpdateThread]);

  // ── Checkpoint restore ──────────────────────────────────────────────
  const [checkpointMessageIds, setCheckpointMessageIds] = useState<Set<string>>(new Set());
  const [restoreConfirmMsgId, setRestoreConfirmMsgId] = useState<string | null>(null);

  // Load checkpoint message IDs for the active thread
  useEffect(() => {
    if (!activeThread || !db.checkpoints) return;
    db.checkpoints.where('threadId').equals(activeThread.id).toArray().then((cps) => {
      setCheckpointMessageIds(new Set(cps.filter(cp => !cp.restored).map(cp => cp.messageId)));
    });
  }, [activeThread?.id, activeThread?.messages?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRestoreCheckpointConfirmed = useCallback(async () => {
    if (!restoreConfirmMsgId) return;
    const cps = await db.checkpoints.where('messageId').equals(restoreConfirmMsgId).toArray();
    const cp = cps.find(c => !c.restored);
    if (!cp) return;

    const restored = await restoreCheckpoint(cp.id);
    if (restored) {
      setCheckpointMessageIds(prev => {
        const next = new Set(prev);
        next.delete(restoreConfirmMsgId);
        return next;
      });
      onEntitiesChanged?.();
      addToast('success', t('view.restoredCheckpoint', { count: cp.snapshot.length }));
    }
    setRestoreConfirmMsgId(null);
  }, [restoreConfirmMsgId, onEntitiesChanged, addToast]);

  // ── Session branching ──────────────────────────────────────────────
  const handleRegenerate = useCallback(async () => {
    if (!activeThread || activeThread.messages.length < 2) return;
    // Find last user message
    let lastUserIdx = -1;
    for (let i = activeThread.messages.length - 1; i >= 0; i--) {
      if (activeThread.messages[i].role === 'user') { lastUserIdx = i; break; }
    }
    if (lastUserIdx === -1) return;
    const userText = activeThread.messages[lastUserIdx].content;
    // Remove all messages after (and including) the last user message
    const trimmed = activeThread.messages.slice(0, lastUserIdx);
    await onUpdateThread(activeThread.id, { messages: trimmed });
    // Re-send the user message
    handleSend(userText);
  }, [activeThread, onUpdateThread, handleSend]);

  const handleBranchFromHere = useCallback(async (messageIndex: number) => {
    if (!activeThread) return;
    const branchedMessages = activeThread.messages.slice(0, messageIndex + 1);
    const branched = await onCreateThread({
      title: `Branch: ${activeThread.title}`,
      messages: branchedMessages,
      model: activeThread.model,
      provider: activeThread.provider,
      folderId: activeThread.folderId,
      tags: [...activeThread.tags],
      clsLevel: activeThread.clsLevel,
    });
    // Add a system message to the new branch so it's clear what happened
    const branchNotice: ChatMessage = {
      id: nanoid(),
      role: 'assistant',
      content: `Branched from **${activeThread.title}** at message ${messageIndex + 1} of ${activeThread.messages.length}. You can continue this conversation independently.`,
      createdAt: Date.now(),
    };
    await onAddMessage(branched.id, branchNotice);
    onSelectThread(branched.id);
    addToast('success', t('view.branchedAt', { index: messageIndex + 1 }));
  }, [activeThread, onCreateThread, onSelectThread, onAddMessage, addToast]);

  return (
    <div className="relative flex flex-1 overflow-hidden">
      {/* Thread list — hidden on mobile when a thread is selected */}
      {!fortuneIntMode && (
        <div className={cn(
          'w-56 border-r border-border-subtle flex flex-col shrink-0',
          activeThread ? 'hidden md:flex' : 'w-full md:w-56'
        )}>
        <div className="p-2 border-b border-border-subtle flex gap-1">
          <button
            onClick={handleNewChat}
            disabled={!canChat}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-purple text-white text-xs font-medium hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
            title={canChat ? t('view.startChatTitle') : t('view.extensionOrServerRequired')}
          >
            <Plus size={14} />
            {t('view.newChat')}
          </button>
          <button
            onClick={() => setShowNewChatFolder(!showNewChatFolder)}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            title={t('view.newFolder')}
          >
            <FolderPlus size={14} />
          </button>
        </div>
        {showNewChatFolder && (
          <div className="px-2 py-1.5 border-b border-border-subtle flex gap-1">
            <input
              autoFocus
              className="flex-1 bg-surface-raised border border-border-default rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-blue"
              placeholder={t('view.folderNamePlaceholder')}
              value={newChatFolderName}
              onChange={e => setNewChatFolderName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newChatFolderName.trim()) {
                  onCreateThread({ title: newChatFolderName.trim(), isFolder: true, folderId: selectedFolderId, messages: [], tags: ['chat-folder'] } as Partial<ChatThread>);
                  setNewChatFolderName('');
                  setShowNewChatFolder(false);
                } else if (e.key === 'Escape') {
                  setShowNewChatFolder(false);
                }
              }}
            />
            <button
              onClick={() => {
                if (newChatFolderName.trim()) {
                  onCreateThread({ title: newChatFolderName.trim(), isFolder: true, folderId: selectedFolderId, messages: [], tags: ['chat-folder'] } as Partial<ChatThread>);
                  setNewChatFolderName('');
                  setShowNewChatFolder(false);
                }
              }}
              disabled={!newChatFolderName.trim()}
              className="text-xs px-2 py-1 rounded bg-accent-blue text-white disabled:opacity-40"
            >
              {t('common:create')}
            </button>
          </div>
        )}
        {/* Thread source filter */}
        <div className="flex gap-1 px-3 py-1.5 border-b border-border-subtle" role="tablist" aria-label={t('view.filterThreadsAria')}>
          {(['all', 'human', 'agent', 'meeting'] as const).map(f => (
            <button
              key={f}
              role="tab"
              aria-selected={threadSourceFilter === f}
              onClick={() => setThreadSourceFilter(f)}
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded capitalize transition-colors',
                threadSourceFilter === f
                  ? 'bg-surface-raised text-text-primary font-medium'
                  : 'text-text-muted hover:text-text-secondary',
              )}
            >
              {t(`view.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredThreads.length === 0 ? (
            <div className="p-4 text-center text-text-muted text-xs">
              {threads.length === 0 ? t('view.noThreadsYet') : t('view.noFilteredThreads', { filter: threadSourceFilter })}
            </div>
          ) : (() => {
            // Separate folders and top-level threads, then build ordered list
            const chatFolders = filteredThreads.filter(t => t.isFolder);
            const topLevel = filteredThreads.filter(t => !t.isFolder && !t.parentThreadId);
            const childOf = (fId: string) => filteredThreads.filter(t => !t.isFolder && t.parentThreadId === fId);

            const renderThread = (thread: ChatThread, indented = false) => (
              <div
                key={thread.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectThread(thread.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSelectThread(thread.id); }}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', thread.id)}
                className={cn(
                  'group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors border-b border-border-subtle',
                  indented && 'ps-7',
                  selectedThreadId === thread.id
                    ? 'bg-bg-active text-text-primary'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                )}
              >
                <MessageSquare size={14} className="shrink-0 text-text-muted" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 text-xs font-medium truncate">
                    {thread.title}
                    {thread.source === 'agent' && (
                      <span className="shrink-0 text-[8px] px-1 py-px rounded bg-accent-blue/10 text-accent-blue font-normal">{t('view.badgeAgent')}</span>
                    )}
                    {thread.source === 'agent-meeting' && (
                      <span className="shrink-0 text-[8px] px-1 py-px rounded bg-purple/10 text-purple font-normal">{t('view.badgeMeeting')}</span>
                    )}
                    {hasLoopsForThread(thread.id) && (
                      <RefreshCw size={10} className="shrink-0 text-purple animate-spin" style={{ animationDuration: '3s' }} />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-text-muted font-mono">
                    <span>{formatDate(thread.updatedAt)}</span>
                    {thread.clsLevel && <ClsBadge level={thread.clsLevel} />}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setTrashConfirmId(thread.id); }}
                  className="opacity-40 group-hover:opacity-100 group-focus-within:opacity-100 p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-red-400 transition-all shrink-0"
                  title={t('view.deleteThread')}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );

            return (
              <>
                {/* Chat folders */}
                {chatFolders.map(folder => {
                  const children = childOf(folder.id);
                  const expanded = expandedChatFolders.has(folder.id);
                  return (
                    <div key={folder.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={expandedChatFolders.has(folder.id)}
                        className={cn(
                          'group flex items-center gap-1.5 px-3 py-2 cursor-pointer transition-colors border-b border-border-subtle',
                          'text-text-secondary hover:bg-bg-hover',
                        )}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const next = new Set(expandedChatFolders); if (next.has(folder.id)) next.delete(folder.id); else next.add(folder.id); setExpandedChatFolders(next); } }}
                        onClick={() => {
                          const next = new Set(expandedChatFolders);
                          if (next.has(folder.id)) next.delete(folder.id); else next.add(folder.id);
                          setExpandedChatFolders(next);
                        }}
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-1', 'ring-accent-blue'); }}
                        onDragLeave={(e) => { e.currentTarget.classList.remove('ring-1', 'ring-accent-blue'); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('ring-1', 'ring-accent-blue');
                          const draggedId = e.dataTransfer.getData('text/plain');
                          if (draggedId && draggedId !== folder.id) {
                            onUpdateThread(draggedId, { parentThreadId: folder.id });
                          }
                        }}
                      >
                        {expanded ? <ChevronDown size={12} className="text-accent-blue shrink-0" /> : <ChevronRight size={12} className="text-accent-amber shrink-0" />}
                        <span className="text-sm">📁</span>
                        {renamingChatFolderId === folder.id ? (
                          <input
                            autoFocus
                            className="flex-1 text-xs font-medium bg-surface-raised border border-accent-blue rounded px-1 py-0.5 text-text-primary outline-none"
                            value={renamingChatFolderValue}
                            onClick={e => e.stopPropagation()}
                            onChange={e => setRenamingChatFolderValue(e.target.value)}
                            onKeyDown={e => {
                              e.stopPropagation();
                              if (e.key === 'Enter' && renamingChatFolderValue.trim()) {
                                onUpdateThread(folder.id, { title: renamingChatFolderValue.trim() });
                                setRenamingChatFolderId(null);
                              } else if (e.key === 'Escape') setRenamingChatFolderId(null);
                            }}
                            onBlur={() => {
                              if (renamingChatFolderValue.trim() && renamingChatFolderValue.trim() !== folder.title) {
                                onUpdateThread(folder.id, { title: renamingChatFolderValue.trim() });
                              }
                              setRenamingChatFolderId(null);
                            }}
                          />
                        ) : (<>
                          <span className="flex-1 text-xs font-medium truncate">{folder.title}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setRenamingChatFolderId(folder.id); setRenamingChatFolderValue(folder.title); }}
                            className="text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all shrink-0"
                            title={t('view.renameFolder')}
                            aria-label={t('view.renameFolderAria', { name: folder.title })}
                          >
                            <Pencil size={10} />
                          </button>
                        </>)}
                        <span className="text-[9px] text-text-muted">{children.length}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setTrashConfirmId(folder.id); }}
                          className="opacity-40 group-hover:opacity-100 group-focus-within:opacity-100 p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-red-400 transition-all shrink-0"
                          title={t('view.deleteFolder')}
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                      {expanded && children.map(t => renderThread(t, true))}
                    </div>
                  );
                })}
                {/* Top-level threads (no folder) */}
                {topLevel.map(t => renderThread(t))}
              </>
            );
          })()}
        </div>
        </div>
      )}

      {/* Chat area — hidden on mobile when no thread selected */}
      <div
        className={cn(
          'flex-1 flex flex-col min-w-0',
          !fortuneIntMode && !activeThread && 'hidden md:flex',
        )}
      >
        {fortuneIntMode ? (
          <FortuneIntBar
            folderName={effectiveFolder?.name}
            openRequest={fortuneIntOpenRequest}
            fullScreen
          />
        ) : activeThread ? (
          <>
            {/* Header toolbar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border-subtle shrink-0">
              {/* Mobile back button */}
              <button
                onClick={() => onSelectThread('')}
                className="md:hidden p-1.5 -ms-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label={t('view.backToThreads')}
              >
                <ArrowLeft size={18} />
              </button>
              {editingTitle ? (
                <input
                  ref={titleInputRef}
                  value={editingTitleValue}
                  onChange={(e) => setEditingTitleValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const trimmed = editingTitleValue.trim();
                      if (trimmed) onUpdateThread(activeThread.id, { title: trimmed });
                      setEditingTitle(false);
                    } else if (e.key === 'Escape') {
                      setEditingTitle(false);
                    }
                  }}
                  onBlur={() => {
                    const trimmed = editingTitleValue.trim();
                    if (trimmed) onUpdateThread(activeThread.id, { title: trimmed });
                    setEditingTitle(false);
                  }}
                  className="flex-1 min-w-0 bg-bg-raised border border-border-subtle rounded px-2 py-1 text-sm font-medium text-text-primary focus:outline-none focus:border-purple"
                  aria-label={t('view.threadTitleAria')}
                />
              ) : (
                <button
                  onClick={() => {
                    setEditingTitleValue(activeThread.title);
                    setEditingTitle(true);
                    setTimeout(() => titleInputRef.current?.select(), 0);
                  }}
                  className="flex items-center gap-1.5 min-w-0 group"
                  title={t('view.clickToRename')}
                >
                  <span className="text-sm font-medium text-text-primary truncate">{activeThread.title}</span>
                  <Pencil size={12} className="shrink-0 text-text-muted opacity-40 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity" />
                </button>
              )}
              <div className="flex items-center gap-1 ms-auto shrink-0">
                <button
                  onClick={toggleMode}
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors me-1',
                    threadMode === 'plan'
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                  )}
                  title={threadMode === 'plan' ? t('view.planModeTitle') : t('view.actModeTitle')}
                >
                  {threadMode === 'plan' ? <Eye size={10} /> : <Play size={10} />}
                  {threadMode === 'plan' ? t('view.planMode') : t('view.actMode')}
                </button>
                <button
                  onClick={() => setYoloMode(!yoloMode)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors me-1',
                    yoloMode
                      ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                      : 'bg-surface-raised border-border-subtle text-text-muted hover:text-text-secondary'
                  )}
                  title={yoloMode ? t('view.yoloOnTitle') : t('view.yoloOffTitle')}
                >
                  <Shield size={10} />
                  {yoloMode ? t('view.yoloLabel') : t('view.safeLabel')}
                </button>
                {threadTokenTotal > 0 && (
                  <span className={cn(
                    'text-[10px] font-mono px-1.5 py-0.5 rounded border me-1',
                    settings.llmTokenBudget && threadTokenTotal > settings.llmTokenBudget
                      ? 'text-red-400 bg-red-500/10 border-red-500/20'
                      : settings.llmTokenBudget && threadTokenTotal > settings.llmTokenBudget * 0.8
                      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                      : 'text-text-muted bg-bg-deep border-border-subtle'
                  )} title={settings.llmTokenBudget ? t('view.tokenTotalBudget', { total: threadTokenTotal.toLocaleString(), budget: settings.llmTokenBudget.toLocaleString() }) : t('view.tokenTotal', { total: threadTokenTotal.toLocaleString() })}>
                    {threadTokenTotal >= 1000 ? `${(threadTokenTotal / 1000).toFixed(1)}k` : threadTokenTotal} {t('view.tokSuffix')}
                  </span>
                )}
                {activeLoops.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple/10 border border-purple/20 text-[10px] text-purple me-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple animate-pulse" />
                    {t('view.loopCount', { count: activeLoops.length })}
                    <button
                      onClick={() => stopAllForThread(activeThread.id)}
                      className="ms-0.5 hover:text-red-400 transition-colors"
                      title={t('view.stopAllLoops')}
                    >
                      <Square size={10} />
                    </button>
                  </div>
                )}
                <ClsSelect
                  value={activeThread.clsLevel}
                  onChange={(clsLevel) => onUpdateThread(activeThread.id, { clsLevel })}
                  clsLevels={settings?.tiClsLevels}
                />
                {activeThread.messages.length > 0 && (
                  <button
                    onClick={handleExportAsNote}
                    className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                    title={t('view.exportAsNote')}
                  >
                    <FileText size={14} />
                  </button>
                )}
                {onShareThread && activeThread.messages.length > 0 && (
                  <button
                    onClick={() => onShareThread(activeThread)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                    title={t('view.shareChat')}
                  >
                    <Share2 size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Messages — virtualized for performance on long threads */}
            <div className="flex-1 overflow-hidden" aria-live="polite">
              {activeThread.messages.length === 0 && !isStreaming ? (
                renderEmptyState(
                  t('view.emptyTitle'),
                  t('view.emptySubtitle'),
                )
              ) : (
              <Virtuoso
                data={activeThread.messages}
                followOutput="smooth"
                className="h-full"
                itemContent={(idx, msg) => (
                  <div className="px-4">
                    <ChatMessageBubble
                      key={msg.id}
                      role={msg.role}
                      content={msg.content}
                      attachments={msg.attachments}
                      toolCalls={msg.toolCalls}
                      onEntityClick={onNavigateToEntity}
                      onSuggestionClick={handleSuggestionClick}
                      isLastAssistant={msg.role === 'assistant' && idx === activeThread.messages.length - 1}
                      messageIndex={idx}
                      onBranchFromHere={handleBranchFromHere}
                      onRewindToHere={setRewindConfirmIndex}
                      tokenCount={msg.tokenCount}
                      messageId={msg.id}
                      onRestoreCheckpoint={setRestoreConfirmMsgId}
                      hasCheckpoint={checkpointMessageIds.has(msg.id)}
                      onRegenerate={msg.role === 'assistant' ? handleRegenerate : undefined}
                    />
                    {msg.agentCycleSummary && (
                      <AgentCycleSummaryCard summary={msg.agentCycleSummary} />
                    )}
                  </div>
                )}
                components={{
                  Footer: () => (
                    <div className="px-4 pb-2">
                      {isStreaming && streamingContent && streamingThreadRef.current === selectedThreadId && (
                        <ChatMessageBubble role="assistant" content={cleanStreamingContent(streamingContent)} isStreaming />
                      )}
                      {/* Tool activity indicators during streaming */}
                      {isStreaming && toolActivity.length > 0 && streamingThreadRef.current === selectedThreadId && (
                        <div className="ms-2 mb-2 space-y-1">
                          {toolActivity.filter(ta => ta.status !== 'running').length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {toolActivity.filter(ta => ta.status !== 'running').map((ta) => (
                                <span
                                  key={ta.id}
                                  className={cn(
                                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono',
                                    ta.status === 'error' ? 'text-red-400' : 'text-emerald-400/70'
                                  )}
                                >
                                  {ta.status === 'error' ? '✗' : '✓'} {ta.name}
                                </span>
                              ))}
                            </div>
                          )}
                          {toolActivity.filter(ta => ta.status === 'running').map((ta) => (
                            <span
                              key={ta.id}
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-mono border border-purple/30 text-purple bg-purple/10 animate-pulse"
                            >
                              {t('view.toolRunning', { name: ta.name })}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Write tool approval card */}
                      {pendingApproval && pendingApproval.threadId === selectedThreadId && (
                        <div className="mx-auto max-w-md my-3 rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
                          <div className="px-4 py-2.5 border-b border-amber-500/20 flex items-center gap-2">
                            <Shield size={14} className="text-amber-400" />
                            <span className="text-xs font-medium text-amber-400">{t('view.approvalTitle')}</span>
                          </div>
                          <div className="px-4 py-2.5 space-y-1.5">
                            <div className="text-xs">
                              <span className="font-mono font-medium text-purple">{pendingApproval.toolName}</span>
                            </div>
                            <pre className="text-[10px] font-mono text-text-secondary bg-bg-deep rounded p-2 max-h-32 overflow-y-auto whitespace-pre-wrap">
                              {JSON.stringify(pendingApproval.input, null, 2)}
                            </pre>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={handleApprove}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 transition-colors"
                              >
                                <Check size={12} /> {t('view.approve')}
                              </button>
                              <button
                                onClick={handleReject}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-colors"
                              >
                                <X size={12} /> {t('view.reject')}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      {localError && (
                        <div className="mx-auto max-w-md my-3 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                          {errorHasSettingsLink && onOpenSettings ? (
                            <span>
                              {localError.replace(/Settings \u2192 AI\/LLM\.?/, '')}{' '}
                              <button
                                onClick={() => onOpenSettings('ai')}
                                className="underline hover:text-red-300 font-medium"
                              >
                                {t('view.settingsAiLlm')}
                              </button>
                            </span>
                          ) : (
                            localError
                          )}
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  ),
                }}
              />
              )}
            </div>

            {/* YOLO mode persistent warning */}
            {yoloMode && (
              <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-red-500/10 border-t border-red-500/20 text-red-400 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <Shield size={11} className="shrink-0" />
                  {t('view.yoloWarning')}
                </span>
                <button
                  onClick={() => setYoloMode(false)}
                  className="text-red-400/60 hover:text-red-400 transition-colors shrink-0"
                  title={t('view.yoloOffTitle')}
                >
                  <X size={11} />
                </button>
              </div>
            )}

            {/* Input */}
          <ChatInput
              onSend={handleSend}
              onStop={abort}
              isStreaming={isStreaming}
              extensionAvailable={extensionAvailable || serverConnected}
              model={activeThread.model}
              onModelChange={handleModelChange}
              localModelName={configuredLocalModel}
              configuredProviders={configuredProviders}
              onOpenSettings={onOpenSettings ? () => onOpenSettings('ai') : undefined}
              folderId={effectiveFolderId}
              customCommands={customCommands.map(c => ({ command: `/${c.name}`, description: c.description }))}
              onImageAttach={handleImageAttach}
              attachedImages={pendingImages.map(a => ({ name: a.name || 'Image' }))}
              onClearImages={() => setPendingImages([])}
            />
          </>
        ) : (
          renderEmptyState(
            t('view.caddyAI'),
            threads.length > 0
              ? t('view.selectThread')
              : t('view.emptySubtitle'),
          )
        )}
      </div>

      <ConfirmDialog
        open={trashConfirmId !== null}
        onClose={() => setTrashConfirmId(null)}
        onConfirm={() => {
          if (trashConfirmId) {
            // If deleting a folder, move children to top level first
            const folder = threads.find(t => t.id === trashConfirmId && t.isFolder);
            if (folder) {
              threads.filter(t => t.parentThreadId === folder.id).forEach(t => onUpdateThread(t.id, { parentThreadId: undefined }));
            }
            onTrashThread(trashConfirmId);
          }
          setTrashConfirmId(null);
        }}
        title={t('view.deleteThreadDialog')}
        message={threads.find(th => th.id === trashConfirmId)?.isFolder ? t('view.deleteFolderMessage') : t('view.deleteThreadMessage')}
        confirmLabel={t('common:delete')}
        danger
      />

      <ConfirmDialog
        open={rewindConfirmIndex !== null}
        onClose={() => setRewindConfirmIndex(null)}
        onConfirm={handleRewindConfirmed}
        title={t('view.rewindDialog')}
        message={t('view.rewindMessage', { count: activeThread ? activeThread.messages.length - (rewindConfirmIndex ?? 0) - 1 : 0 })}
        confirmLabel={t('view.rewindLabel')}
        danger
      />

      <ConfirmDialog
        open={restoreConfirmMsgId !== null}
        onClose={() => setRestoreConfirmMsgId(null)}
        onConfirm={handleRestoreCheckpointConfirmed}
        title={t('view.restoreDialog')}
        message={t('view.restoreMessage')}
        confirmLabel={t('view.restoreLabel')}
        danger
      />

      <ConfirmDialog
        open={pendingCtiTemplateSuggestion !== null}
        onClose={handleRejectCtiTemplate}
        onConfirm={handleApproveCtiTemplate}
        title="Approve CTI format update?"
        message={pendingCtiTemplateSuggestion
          ? `Save the proposed ${DEFAULT_CTI_SOURCE_TEMPLATES[pendingCtiTemplateSuggestion.source].label} display template? The preview is in the chat response and evidence values are not changed.`
          : ''}
        confirmLabel="Save template"
        secondaryAction={handleRejectCtiTemplate}
        secondaryLabel="Discard"
      />

      {/* First-use onboarding overlay */}
      {showOnboarding && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-xl">
          <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl shadow-2xl p-6 max-w-md mx-4 w-full">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{t('view.onboardingTitle')}</h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Key size={16} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{t('view.onboardingStep1Title')}</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{t('view.onboardingStep1Desc')} (<a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Anthropic</a>, <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">OpenAI</a>, <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google Gemini</a>, <a href="https://console.mistral.ai/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Mistral</a>)</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Puzzle size={16} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{t('view.onboardingStep2Title')}</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{t('view.onboardingStep2Desc')} (<a href="https://chromewebstore.google.com/detail/threatcaddy-%E2%80%94-quick-captu/lakelgngpkkaeinfdlnmifookbeeffbh" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Chrome Web Store</a>)</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Shield size={16} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{t('view.onboardingStep3Title')}</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{t('view.onboardingStep3Desc')}</p>
                </div>
              </div>
            </div>
            <button
              onClick={dismissOnboarding}
              className="w-full mt-5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {t('view.onboardingDismiss')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
