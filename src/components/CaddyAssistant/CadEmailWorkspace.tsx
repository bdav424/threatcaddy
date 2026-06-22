import { memo, useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import {
  Check,
  CornerUpLeft,
  FilePenLine,
  Forward,
  Mail,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { ToolbarSelect, type ToolbarSelectOption } from '../Common/ToolbarSelect';
import { WorkspacePanel, useWorkspacePanelHeaderAccessory } from '../WorkspacePanels/WorkspacePanel';
import { WorkspacePanelDock } from '../WorkspacePanels/WorkspacePanelDock';
import {
  WorkspacePanelProvider,
  type WorkspacePanelGeometry,
} from '../WorkspacePanels/WorkspacePanelProvider';
import { readWorkspaceCanvasRect } from '../WorkspacePanels/workspaceGrid';
import { useWorkspacePanel } from '../WorkspacePanels/useWorkspacePanels';
import {
  EMAILCADDY_DRAFT_PANEL_ID,
  EMAILCADDY_MESSAGE_READER_PANEL_ID,
  EMAILCADDY_WORKSPACE_PANEL_ID,
  emailCaddyPanelRegistrations,
} from './workspacePanelRegistrations';
import {
  EMAIL_PROVIDER_METADATA,
  EMAIL_PROVIDER_LIST,
  type EmailProviderId,
} from '../../lib/email-onboarding';
import { cn } from '../../lib/utils';
import { getMailBridge, isDesktopBridge } from '../../lib/bridges';
import { useEmailAccounts } from '../../hooks/useEmailAccounts';

type ThreadTone = 'rose' | 'green' | 'purple' | 'amber' | 'sky';
type SelectionMode = 'manual' | 'all' | 'unread' | 'attachments' | 'meetings';
type BulkAction = 'mark-read' | 'delete' | 'clear';
type DraftMode = 'compose' | 'reply' | 'reply-all' | 'forward';
type DraftSensitivity = 'normal' | 'sensitive' | 'external-review';
type DraftClassification = 'public-safe' | 'internal' | 'restricted';
type DraftAudienceDepth = 'quick' | 'leadership' | 'analyst';

interface EmailAccount {
  id: string;
  label: string;
}

interface ConfiguredEmailAccount {
  id: string;
  providerId: EmailProviderId;
  label: string;
  status: 'local-checklist-reviewed' | 'local-test-transport-proofed';
  proofCode?: string;
}

interface EmailThread {
  id: string;
  accountId: string;
  senderLabel: string;
  fromAddress?: string;
  toRecipients?: string[];
  ccRecipients?: string[];
  senderColor: string;
  subject: string;
  preview: string;
  receivedAt: string;
  unread?: boolean;
  hasAttachment?: boolean;
  tone: ThreadTone;
  body: string[];
  asks: string[];
  draft: string[];
  pinned?: boolean;
}

interface EmailDraft {
  mode: DraftMode;
  sourceThreadId: string | null;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  attachments: string[];
  sensitivity: DraftSensitivity;
  classification: DraftClassification;
  audienceDepth: DraftAudienceDepth;
  sanitized: boolean;
  status: 'editing' | 'saved' | 'queued';
}

interface AssistantPreview {
  title: string;
  summary: string;
  bullets: string[];
}

interface EmailRowMenuState {
  threadId: string;
  x: number;
  y: number;
}

const accounts: EmailAccount[] = [
  { id: 'all', label: 'All (default)' },
  { id: 'work', label: 'ThreatCaddy Work' },
  { id: 'research', label: 'Research' },
  { id: 'family', label: 'Family' },
  { id: 'personal', label: 'Personal' },
  { id: 'proton', label: 'Proton Mail' },
];

// --- Live inbox mapping (mail-bridge.mjs â†’ EmailThread) ---
// The bridge returns plain message records over IPC; map them onto the UI's EmailThread
// shape. Bodies are fetched lazily when a thread is opened (see the reader effect).
interface LiveListMessage { uid: number; subject?: string; from?: string[]; date?: string | null; seen?: boolean }
interface LiveFetchMessage {
  subject?: string; from?: string; to?: string; date?: string | null;
  text?: string; html?: string | null;
  attachments?: Array<{ filename?: string; contentType?: string; size?: number }>;
}

const LIVE_TONES: ThreadTone[] = ['sky', 'green', 'purple', 'amber', 'rose'];
const LIVE_COLORS = ['#7ec4ff', '#7fd694', '#d28cff', '#f4bf61', '#df6f79'];

// Deterministic accent so the same sender keeps a stable colour/tone across reloads.
function liveAccent(seed: string): { tone: ThreadTone; color: string } {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const idx = h % LIVE_TONES.length;
  return { tone: LIVE_TONES[idx], color: LIVE_COLORS[idx] };
}

function formatLiveDate(date?: string | null): string {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function mapLiveMessageToThread(accountId: string, accountLabel: string, m: LiveListMessage): EmailThread {
  const fromAddr = m.from?.[0] ?? '';
  const accent = liveAccent(fromAddr || accountId);
  return {
    id: `live:${accountId}:${m.uid}`,
    accountId,
    senderLabel: fromAddr || accountLabel,
    fromAddress: fromAddr || undefined,
    senderColor: accent.color,
    subject: m.subject || '(no subject)',
    preview: '',
    receivedAt: formatLiveDate(m.date),
    unread: m.seen === false,
    tone: accent.tone,
    body: [],
    asks: [],
    draft: [],
  };
}



const mailboxViews = ['INBOX', 'Needs reply', 'Meetings'];
const categoryViews = ['All', 'Flagged', 'Attachments'];
const selectionModes: Array<{ id: SelectionMode; label: string }> = [
  { id: 'manual', label: 'Manual select' },
  { id: 'all', label: 'All visible' },
  { id: 'unread', label: 'Unread only' },
  { id: 'attachments', label: 'Attachments' },
  { id: 'meetings', label: 'Meetings' },
];
const bulkActions: Array<{ id: BulkAction; label: string }> = [
  { id: 'mark-read', label: 'Mark read' },
  { id: 'delete', label: 'Delete selected' },
  { id: 'clear', label: 'Clear selection' },
];
const sensitivityOptions: Array<{ id: DraftSensitivity; label: string }> = [
  { id: 'normal', label: 'Normal' },
  { id: 'sensitive', label: 'Sensitive' },
  { id: 'external-review', label: 'External review' },
];
const classificationOptions: Array<{ id: DraftClassification; label: string }> = [
  { id: 'public-safe', label: 'Public-safe draft' },
  { id: 'internal', label: 'Internal' },
  { id: 'restricted', label: 'Restricted' },
];
const audienceDepthOptions: Array<{ id: DraftAudienceDepth; label: string }> = [
  { id: 'quick', label: 'Quick answer' },
  { id: 'leadership', label: 'Leadership brief' },
  { id: 'analyst', label: 'Analyst detail' },
];

const COMPACT_READER_PANEL_WIDTH = 420;
const COMPACT_READER_PANEL_HEIGHT = 460;
const COMPACT_READER_PANEL_MIN_WIDTH = 340;
const COMPACT_READER_PANEL_MIN_HEIGHT = 300;
const COMPACT_READER_PANEL_MARGIN = 16;
const COMPACT_DRAFT_PANEL_WIDTH = 560;
const COMPACT_DRAFT_PANEL_HEIGHT = 560;
const COMPACT_DRAFT_PANEL_MIN_WIDTH = 360;
const COMPACT_DRAFT_PANEL_MIN_HEIGHT = 360;

const threads: EmailThread[] = [
  {
    id: 'thread-1',
    accountId: 'work',
    senderLabel: 'ThreatCaddy Work',
    fromAddress: 'briefing-desk@example.com',
    toRecipients: ['analyst@threatcaddy.local'],
    ccRecipients: ['leadership-review@example.com'],
    senderColor: '#df6f79',
    subject: 'Threat brief needs a cleaner external summary',
    preview:
      'Tighten the summary, confirm what still needs sanitization, and call out the three points leadership should lead with.',
    receivedAt: 'Jun 4, 03:40 PM',
    unread: true,
    tone: 'rose',
    body: [
      'Need a cleaner version of the threat brief before tomorrowâ€™s external sync.',
      'Please tighten the summary, confirm what still needs sanitization, and give me the three points leadership should lead with.',
      'If there is anything that should remain internal, say that directly instead of assuming context.',
    ],
    asks: [
      'Tighten the summary into leadership-ready language.',
      'Confirm what still needs sanitization before any external sharing.',
      'Provide three leading talking points.',
    ],
    draft: [
      'Here is the shortened leadership-facing version.',
      'The main brief is ready for review, but the appendix still needs one sanitization pass before it becomes external-safe.',
      'I would lead with the actor change, the customer impact, and the recommended next action on the call.',
    ],
    pinned: true,
  },
  {
    id: 'thread-2',
    accountId: 'research',
    senderLabel: 'Research Desk',
    fromAddress: 'research-desk@example.com',
    toRecipients: ['analyst@threatcaddy.local'],
    senderColor: '#8bcf86',
    subject: 'Follow-up: did we answer every onboarding question?',
    preview:
      'The reply is close, but I want to make sure the retention question and realistic timeline ask are both covered.',
    receivedAt: 'Jun 4, 01:56 PM',
    tone: 'green',
    body: [
      'The draft is close.',
      'Before anything goes out, confirm we answered the retention question and the realistic onboarding timeline ask.',
      'If either one is too sensitive, defer it directly instead of sounding vague.',
    ],
    asks: [
      'Confirm the retention question is answered or explicitly deferred.',
      'Confirm the onboarding timeline is answered or explicitly deferred.',
    ],
    draft: [
      'The timeline ask is covered in the current draft.',
      'The retention point still needs either a short answer or a direct defer note before the reply is complete.',
      'My recommendation is to add the defer note rather than imply that the draft is already final.',
    ],
  },
  {
    id: 'thread-3',
    accountId: 'proton',
    senderLabel: 'Proton Mail',
    fromAddress: 'security@proton.example',
    toRecipients: ['analyst@threatcaddy.local'],
    senderColor: '#cc84ea',
    subject: 'Security alert',
    preview:
      'Review requested after a new login challenge and confirm whether the message should stay informational or become a task.',
    receivedAt: 'Jun 4, 12:58 PM',
    unread: true,
    tone: 'purple',
    body: [
      'A new sign-in challenge was triggered for the Proton mailbox.',
      'The alert looks informational, but it should still be reviewed against the dayâ€™s other account notices.',
      'If the pattern repeats, convert it into a tracked follow-up rather than letting it live only in the inbox.',
    ],
    asks: [
      'Confirm whether the alert is informational only.',
      'Escalate to a task if the pattern repeats.',
    ],
    draft: [
      'I reviewed the sign-in alert and it currently reads like an informational notice rather than a confirmed issue.',
      'If the same pattern repeats, I would convert it into a tracked task and compare it against the rest of the account activity.',
    ],
  },
  {
    id: 'thread-4',
    accountId: 'work',
    senderLabel: 'Zoom',
    fromAddress: 'no-reply@zoom.example',
    toRecipients: ['analyst@threatcaddy.local'],
    ccRecipients: ['partner-architect@example.com'],
    senderColor: '#e4a17b',
    subject: 'Partner architecture review invite attached',
    preview:
      'Join details are attached, but the invite body still does not explain the decisions expected on the call.',
    receivedAt: 'Jun 4, 11:27 AM',
    hasAttachment: true,
    tone: 'amber',
    body: [
      'You have been invited to Partner architecture review.',
      'The invite includes the meeting link and participant list, but it does not clearly explain the intended decisions for the session.',
      'Treat this as a meeting that needs prep context before it is considered ready.',
    ],
    asks: [
      'Review the invite for missing prep context.',
      'Keep the meeting link framed as an external handoff.',
    ],
    draft: [
      'Thanks for the invite. Before the meeting, could you confirm the intended decision points and whether there are any pre-read materials we should review?',
      'We have the join details, but the body does not yet explain the expected outcomes from the session.',
    ],
    pinned: true,
  },
  {
    id: 'thread-5',
    accountId: 'family',
    senderLabel: 'Family Calendar',
    fromAddress: 'calendar@example-family.test',
    toRecipients: ['analyst@threatcaddy.local'],
    senderColor: '#9dca6e',
    subject: 'School pickup moved by thirty minutes',
    preview:
      'The calendar hold shifted and may now overlap with the late afternoon work review block.',
    receivedAt: 'Jun 4, 10:51 AM',
    tone: 'green',
    body: [
      'School pickup moved by thirty minutes.',
      'That change may overlap with the late afternoon work review block, so the calendar needs an explicit conflict choice instead of a silent overwrite.',
    ],
    asks: ['Review the overlap against the existing work hold.'],
    draft: [
      'The family hold moved by thirty minutes and now overlaps with the later work review block.',
      'I recommend making that tradeoff explicit in CalendarCaddy rather than assuming the work block should simply absorb it.',
    ],
  },
  {
    id: 'thread-6',
    accountId: 'research',
    senderLabel: 'Threat intel feed',
    fromAddress: 'briefing-feed@example.com',
    toRecipients: ['analyst@threatcaddy.local'],
    senderColor: '#63b4ee',
    subject: 'Daily brief pack is ready for review',
    preview:
      'Three items are already grouped for the morning brief, but one draft still needs a safety pass before it leaves review.',
    receivedAt: 'Jun 4, 10:07 AM',
    tone: 'sky',
    body: [
      'The daily brief pack is ready for review.',
      'Three items are already grouped for the morning brief, but one draft still needs a safety pass before it can leave review.',
    ],
    asks: ['Review the daily brief grouping.', 'Sanitize the one draft that is still in review.'],
    draft: [
      'The brief grouping is ready.',
      'One draft still needs a sanitization pass before it should be treated as send-ready.',
    ],
  },
];

function toneDotClass(tone: ThreadTone) {
  switch (tone) {
    case 'rose':
      return 'bg-[#df8f81]';
    case 'green':
      return 'bg-[#8fd86f]';
    case 'purple':
      return 'bg-[#d57dc2]';
    case 'amber':
      return 'bg-[#e6a27c]';
    case 'sky':
      return 'bg-[#71d1e6]';
    default:
      return 'bg-[#d8c4c4]';
  }
}

function resolvePreview(value: string): AssistantPreview | null {
  const query = value.toLowerCase();

  if (query.includes('sanitize')) {
    return {
      title: 'Sanitization preview',
      summary:
        'EmailCaddy would strip sensitive identifiers, simplify internal shorthand, and leave only the context that is safe for the recipient.',
      bullets: [
        'Replace tenant names, internal tooling labels, and investigation shorthand.',
        'Keep any unresolved sensitive answer as an explicit defer instead of implying completeness.',
      ],
    };
  }

  if (query.includes('forget') || query.includes('miss')) {
    return {
      title: 'Coverage check',
      summary:
        'EmailCaddy would compare the selected thread against its draft and point out what still has no clear answer.',
      bullets: [
        'Trace each direct question into a matching reply line.',
        'Flag anything that should be deferred explicitly instead of being left vague.',
      ],
    };
  }

  if (query.includes('draft') || query.includes('reply')) {
    return {
      title: 'Reply shaping preview',
      summary:
        'EmailCaddy would turn the selected thread into a short, direct response that mirrors the sender priorities before any safety pass.',
      bullets: [
        'Lead with the answered asks, not background context.',
        'Keep blocked items as pending review rather than hiding them in a long paragraph.',
      ],
    };
  }

  return null;
}

function addressFromLabel(label: string) {
  return `${label.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/(^\.|\.$)/g, '') || 'sender'}@example.com`;
}

function prefixSubject(subject: string, prefix: 'Re:' | 'Fwd:') {
  const trimmed = subject.trim();
  if (prefix === 'Re:' && /^re\s*:/i.test(trimmed)) return trimmed;
  if (prefix === 'Fwd:' && /^fwd?\s*:/i.test(trimmed)) return trimmed;
  return `${prefix} ${trimmed || '(no subject)'}`;
}

function quotedThreadBody(thread: EmailThread) {
  return thread.body.map((line) => `> ${line}`).join('\n');
}

function buildReplyAllCc(thread: EmailThread) {
  const myAddress = 'analyst@threatcaddy.local';
  const fromAddress = thread.fromAddress || addressFromLabel(thread.senderLabel);
  const recipients = [...(thread.toRecipients || []), ...(thread.ccRecipients || [])];
  return Array.from(
    new Set(
      recipients
        .map((address) => address.trim())
        .filter(Boolean)
        .filter((address) => address.toLowerCase() !== myAddress)
        .filter((address) => address.toLowerCase() !== fromAddress.toLowerCase()),
    ),
  ).join(', ');
}

function isEditableKeyTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;

  const tagName = element.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    element.isContentEditable ||
    Boolean(element.closest('[contenteditable="true"], [data-email-draft-field="true"]'))
  );
}

function inferDraftControls(thread: EmailThread | null, mode: DraftMode) {
  const text = `${thread?.subject || ''} ${thread?.preview || ''} ${(thread?.body || []).join(' ')}`.toLowerCase();
  const mentionsExternal = /external|partner|customer|proton|security/.test(text);
  const mentionsInternal = /internal|investigation|tenant|retention|architecture/.test(text);

  return {
    sensitivity: mentionsExternal ? 'external-review' as DraftSensitivity : mentionsInternal ? 'sensitive' as DraftSensitivity : 'normal' as DraftSensitivity,
    classification: mentionsInternal ? 'restricted' as DraftClassification : mentionsExternal ? 'internal' as DraftClassification : 'public-safe' as DraftClassification,
    audienceDepth: /leadership|summary|brief/.test(text)
      ? 'leadership' as DraftAudienceDepth
      : mode === 'forward'
        ? 'analyst' as DraftAudienceDepth
        : 'quick' as DraftAudienceDepth,
  };
}

function createDraftForThread(thread: EmailThread, mode: DraftMode): EmailDraft {
  const fromAddress = thread.fromAddress || addressFromLabel(thread.senderLabel);
  const isForward = mode === 'forward';
  const replyBody = `${thread.draft.join('\n\n')}\n\n--- Original message ---\nOn ${thread.receivedAt}, ${thread.senderLabel} wrote:\n${quotedThreadBody(thread)}`;
  const forwardBody = `\n\n---------- Forwarded message ----------\nFrom: ${thread.senderLabel} <${fromAddress}>\nDate: ${thread.receivedAt}\nSubject: ${thread.subject}\n\n${thread.body.join('\n\n')}`;
  const inferredControls = inferDraftControls(thread, mode);

  return {
    mode,
    sourceThreadId: thread.id,
    to: isForward ? '' : fromAddress,
    cc: mode === 'reply-all' ? buildReplyAllCc(thread) : '',
    bcc: '',
    subject: prefixSubject(thread.subject, isForward ? 'Fwd:' : 'Re:'),
    body: isForward ? forwardBody : replyBody,
    attachments: thread.hasAttachment && isForward ? ['Original attachment reference retained externally'] : [],
    ...inferredControls,
    sanitized: false,
    status: 'editing',
  };
}

function createBlankDraft(accountId: string): EmailDraft {
  const accountLabel = accounts.find((account) => account.id === accountId)?.label || 'selected account';
  return {
    mode: 'compose',
    sourceThreadId: null,
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    body: `\n\n--\nDrafting from ${accountLabel}`,
    attachments: [],
    sensitivity: 'normal',
    classification: 'internal',
    audienceDepth: 'quick',
    sanitized: false,
    status: 'editing',
  };
}

function draftModeLabel(mode: DraftMode) {
  switch (mode) {
    case 'compose':
      return 'New message';
    case 'reply':
      return 'Reply';
    case 'reply-all':
      return 'Reply all';
    case 'forward':
      return 'Forward';
    default:
      return 'Draft';
  }
}

function clampNumber(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function getCompactReaderPanelGeometry(
  emailPanelGeometry: WorkspacePanelGeometry,
  currentReaderGeometry: WorkspacePanelGeometry,
): WorkspacePanelGeometry {
  const canvas = readWorkspaceCanvasRect();
  const maxWidth = Math.max(
    COMPACT_READER_PANEL_MIN_WIDTH,
    Math.min(COMPACT_READER_PANEL_WIDTH, canvas.width - COMPACT_READER_PANEL_MARGIN * 2),
  );
  const maxHeight = Math.max(
    COMPACT_READER_PANEL_MIN_HEIGHT,
    Math.min(COMPACT_READER_PANEL_HEIGHT, canvas.height - COMPACT_READER_PANEL_MARGIN * 2),
  );
  const width = Math.round(clampNumber(currentReaderGeometry.width, COMPACT_READER_PANEL_MIN_WIDTH, maxWidth));
  const height = Math.round(clampNumber(currentReaderGeometry.height, COMPACT_READER_PANEL_MIN_HEIGHT, maxHeight));
  const x = Math.round(canvas.x + canvas.width - width - COMPACT_READER_PANEL_MARGIN);
  const y = Math.round(clampNumber(
    emailPanelGeometry.y,
    canvas.y + COMPACT_READER_PANEL_MARGIN,
    canvas.y + canvas.height - height - COMPACT_READER_PANEL_MARGIN,
  ));

  return { x, y, width, height };
}

function getCompactDraftPanelGeometry(
  emailPanelGeometry: WorkspacePanelGeometry,
  currentDraftGeometry: WorkspacePanelGeometry,
): WorkspacePanelGeometry {
  const canvas = readWorkspaceCanvasRect();
  const maxWidth = Math.max(
    COMPACT_DRAFT_PANEL_MIN_WIDTH,
    Math.min(COMPACT_DRAFT_PANEL_WIDTH, canvas.width - COMPACT_READER_PANEL_MARGIN * 2),
  );
  const maxHeight = Math.max(
    COMPACT_DRAFT_PANEL_MIN_HEIGHT,
    Math.min(COMPACT_DRAFT_PANEL_HEIGHT, canvas.height - COMPACT_READER_PANEL_MARGIN * 2),
  );
  const width = Math.round(clampNumber(currentDraftGeometry.width, COMPACT_DRAFT_PANEL_MIN_WIDTH, maxWidth));
  const height = Math.round(clampNumber(currentDraftGeometry.height, COMPACT_DRAFT_PANEL_MIN_HEIGHT, maxHeight));
  const x = Math.round(clampNumber(
    emailPanelGeometry.x + emailPanelGeometry.width + COMPACT_READER_PANEL_MARGIN,
    canvas.x + COMPACT_READER_PANEL_MARGIN,
    canvas.x + canvas.width - width - COMPACT_READER_PANEL_MARGIN,
  ));
  const y = Math.round(clampNumber(
    emailPanelGeometry.y + 28,
    canvas.y + COMPACT_READER_PANEL_MARGIN,
    canvas.y + canvas.height - height - COMPACT_READER_PANEL_MARGIN,
  ));

  return { x, y, width, height };
}

export function EmailCaddyWorkspace() {
  return (
    <WorkspacePanelProvider initialPanels={emailCaddyPanelRegistrations}>
      <EmailCaddyWorkspaceContent />
      <WorkspacePanelDock />
    </WorkspacePanelProvider>
  );
}

export const EmailCaddyWorkspaceContent = memo(function EmailCaddyWorkspaceContent({
  compactPanel = false,
  onWorkspaceOwnPanel,
  onWorkspacePanelDragStart,
}: {
  compactPanel?: boolean;
  onWorkspaceOwnPanel?: (panelId: string) => void;
  onWorkspacePanelDragStart?: (event: DragEvent<HTMLElement>) => void;
} = {}) {
  const [threadItems, setThreadItems] = useState<EmailThread[]>(threads);
  const [accountFilter, setAccountFilter] = useState('all');
  const [mailboxView, setMailboxView] = useState(mailboxViews[0]);
  const [categoryView, setCategoryView] = useState(categoryViews[0]);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('manual');
  const [bulkAction, setBulkAction] = useState<BulkAction>('mark-read');
  const [query, setQuery] = useState('');
  const [assistantPreview, setAssistantPreview] = useState<AssistantPreview | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>([]);
  const [readThreadIds, setReadThreadIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [contextRequested, setContextRequested] = useState(false);
  const [rowMenu, setRowMenu] = useState<EmailRowMenuState | null>(null);
  const [accountSetupOpen, setAccountSetupOpen] = useState(false);
const [configuredAccounts] = useState<ConfiguredEmailAccount[]>([]);
const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [addAccountProviderId, setAddAccountProviderId] = useState<EmailProviderId>('google-gmail');
  const [addAccountImapHost, setAddAccountImapHost] = useState('');
  const [addAccountImapPort, setAddAccountImapPort] = useState('993');
  const [addAccountUser, setAddAccountUser] = useState('');
  const [addAccountPass, setAddAccountPass] = useState('');
  const [addAccountConnecting, setAddAccountConnecting] = useState(false);
  const [addAccountError, setAddAccountError] = useState<string | null>(null);
  const { accounts: emailAccounts, addAccount: addEmailAccount, updateAccount: updateEmailAccount, revokeAccount: revokeEmailAccount } = useEmailAccounts();
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const emailPanel = useWorkspacePanel(EMAILCADDY_WORKSPACE_PANEL_ID);
  const contextPanel = useWorkspacePanel('emailcaddy-message-context');
  const readerPanel = useWorkspacePanel(EMAILCADDY_MESSAGE_READER_PANEL_ID);
  const draftPanel = useWorkspacePanel(EMAILCADDY_DRAFT_PANEL_ID);
  const handleContextPanelModeChange = useCallback((mode: Parameters<typeof contextPanel.setMode>[0]) => {
    if (mode === 'floating' || mode === 'minimized') {
      onWorkspaceOwnPanel?.(contextPanel.panel.id);
    }
    contextPanel.setMode(mode);
  }, [contextPanel, onWorkspaceOwnPanel]);
  const handleReaderPanelModeChange = useCallback((mode: Parameters<typeof readerPanel.setMode>[0]) => {
    if (mode === 'floating' || mode === 'minimized') {
      onWorkspaceOwnPanel?.(readerPanel.panel.id);
    }
    readerPanel.setMode(mode);
  }, [onWorkspaceOwnPanel, readerPanel]);
  const handleDraftPanelModeChange = useCallback((mode: Parameters<typeof draftPanel.setMode>[0]) => {
    if (mode === 'floating' || mode === 'minimized') {
      onWorkspaceOwnPanel?.(draftPanel.panel.id);
    }
    draftPanel.setMode(mode === 'docked' && compactPanel ? 'floating' : mode);
  }, [compactPanel, draftPanel, onWorkspaceOwnPanel]);

  const readThreadIdSet = useMemo(() => new Set(readThreadIds), [readThreadIds]);
  const selectedThreadIdSet = useMemo(() => new Set(selectedThreadIds), [selectedThreadIds]);
  const isThreadUnread = (thread: EmailThread) => Boolean(thread.unread) && !readThreadIdSet.has(thread.id);

  const filteredThreads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return threadItems.filter((thread) => {
      if (accountFilter !== 'all' && thread.accountId !== accountFilter) {
        return false;
      }
      if (mailboxView === 'Meetings' && !thread.subject.toLowerCase().includes('invite')) {
        return false;
      }
      if (mailboxView === 'Needs reply' && thread.asks.length === 0) {
        return false;
      }
      if (categoryView === 'Attachments' && !thread.hasAttachment) {
        return false;
      }
      if (categoryView === 'Flagged' && !isThreadUnread(thread)) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      return [thread.subject, thread.preview, thread.senderLabel].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      );
    });
  }, [accountFilter, categoryView, mailboxView, query, readThreadIdSet, threadItems]);

  const mailboxCounts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const scopedThreads = threadItems.filter((thread) => {
      if (accountFilter !== 'all' && thread.accountId !== accountFilter) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      return [thread.subject, thread.preview, thread.senderLabel].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      );
    });

    return {
      INBOX: scopedThreads.length,
      'Needs reply': scopedThreads.filter((thread) => thread.asks.length > 0).length,
      Meetings: scopedThreads.filter((thread) => thread.subject.toLowerCase().includes('invite')).length,
    };
  }, [accountFilter, query, threadItems]);

  const groupedThreads = useMemo(
    () => [
      { id: 'pinned', label: 'Pinned', items: filteredThreads.filter((thread) => thread.pinned) },
      { id: 'today', label: 'Today', items: filteredThreads.filter((thread) => !thread.pinned) },
    ].filter((group) => group.items.length > 0),
    [filteredThreads],
  );

  const visibleUnreadCount = useMemo(
    () => filteredThreads.filter((thread) => isThreadUnread(thread)).length,
    [filteredThreads, readThreadIdSet],
  );

  const selectedThread = useMemo(
    () => filteredThreads.find((thread) => thread.id === selectedThreadId) ?? null,
    [filteredThreads, selectedThreadId],
  );

  const draftSourceThread = useMemo(
    () => draft?.sourceThreadId
      ? threadItems.find((thread) => thread.id === draft.sourceThreadId) ?? null
      : null,
    [draft?.sourceThreadId, threadItems],
  );
  const contextThread = selectedThread ?? draftSourceThread;

  // Stable key over connected, credentialed accounts so the live-inbox effect doesn't
  // re-run on every render (emailAccounts is re-sanitized to a fresh array each render).
  const liveAccountsKey = useMemo(
    () => emailAccounts
      .filter((account) => account.status === 'connected' && account.credentialRef?.id)
      .map((account) => `${account.id}:${account.credentialRef?.id}`)
      .join('|'),
    [emailAccounts],
  );

  // Last mile: when the desktop bridge + a connected account exist, replace the demo
  // mirror with the real INBOX listing from mail-bridge.mjs. Web/standalone (no bridge)
  // or no connected account keeps the demo mirror.
  useEffect(() => {
    const bridge = getMailBridge();
    if (!bridge?.execute) return;
    const connected = emailAccounts.filter(
      (account) => account.status === 'connected' && account.credentialRef?.id,
    );
    if (connected.length === 0) {
      setThreadItems(threads);
      return;
    }
    let cancelled = false;
    (async () => {
      const collected: EmailThread[] = [];
      for (const account of connected) {
        try {
          const res = (await bridge.execute('list', account.credentialRef!.id, {
            mailbox: 'INBOX',
            limit: 50,
          })) as { messages?: LiveListMessage[] } | undefined;
          for (const m of res?.messages ?? []) {
            collected.push(mapLiveMessageToThread(account.id, account.label, m));
          }
        } catch {
          // One account failing must not wipe the others; skip it.
        }
      }
      if (!cancelled && collected.length > 0) setThreadItems(collected);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on liveAccountsKey
  }, [liveAccountsKey]);

  // Lazily fetch the real message body when a live thread is opened in the reader.
  useEffect(() => {
    if (!selectedThread || !selectedThread.id.startsWith('live:')) return;
    if (selectedThread.body.length > 0) return;
    const bridge = getMailBridge();
    const account = emailAccounts.find((a) => a.id === selectedThread.accountId);
    const credId = account?.credentialRef?.id;
    if (!bridge?.execute || !credId) return;
    const uid = Number(selectedThread.id.split(':')[2]);
    if (!Number.isFinite(uid)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = (await bridge.execute('fetch', credId, { mailbox: 'INBOX', uid })) as
          { message?: LiveFetchMessage } | undefined;
        const msg = res?.message;
        if (cancelled || !msg) return;
        const text = (msg.text ?? '').trim();
        const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
        setThreadItems((prev) => prev.map((t) => (t.id === selectedThread.id
          ? {
              ...t,
              body: paragraphs.length ? paragraphs : [text || '(No text content in this message.)'],
              preview: t.preview || text.slice(0, 140),
              hasAttachment: (msg.attachments?.length ?? 0) > 0,
              toRecipients: msg.to ? [msg.to] : t.toRecipients,
            }
          : t)));
      } catch {
        // Leave the body empty; reopening the thread retries the fetch.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the opened thread id
  }, [selectedThread?.id]);
  const rowMenuThread = useMemo(
    () => rowMenu ? threadItems.find((thread) => thread.id === rowMenu.threadId) ?? null : null,
    [rowMenu, threadItems],
  );

const hasConfiguredAccount = configuredAccounts.length > 0;
  const proofedAccountCount = configuredAccounts.filter((account) => account.status === 'local-test-transport-proofed').length;
  const accountConnectionSummary = hasConfiguredAccount
    ? `${configuredAccounts.length} local account${configuredAccounts.length === 1 ? '' : 's'} staged${proofedAccountCount > 0 ? `; ${proofedAccountCount} local proof${proofedAccountCount === 1 ? '' : 's'} passed` : ''}. Live sync is still disabled.`
    : 'No live account connected. EmailCaddy is showing demo/mock mirrored mail only.';

  const draftAttachmentChips = useMemo(() => {
    if (!draft) return [];
    if (draft.attachments.length > 0) return draft.attachments;
    return draftSourceThread?.hasAttachment ? ['Source attachment available externally'] : [];
  }, [draft, draftSourceThread]);

  const selectedCount = useMemo(
    () => filteredThreads.filter((thread) => selectedThreadIdSet.has(thread.id)).length,
    [filteredThreads, selectedThreadIdSet],
  );

  const allVisibleSelected = filteredThreads.length > 0 && selectedCount === filteredThreads.length;
  const someVisibleSelected = selectedCount > 0 && selectedCount < filteredThreads.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  useEffect(() => {
    if (filteredThreads.length === 0) {
      setSelectedThreadId(null);
      setDraft((current) => current?.mode === 'compose' ? current : null);
      return;
    }

    if (selectedThreadId && !filteredThreads.some((thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(null);
    }
  }, [filteredThreads, selectedThreadId]);

  useEffect(() => {
    setContextRequested(false);
  }, [selectedThreadId]);

  useEffect(() => {
    const visibleIds = new Set(filteredThreads.map((thread) => thread.id));

    setSelectedThreadIds((current) => {
      if (selectionMode === 'manual') {
        return current.filter((threadId) => visibleIds.has(threadId));
      }

      return filteredThreads
        .filter((thread) => {
          switch (selectionMode) {
            case 'all':
              return true;
            case 'unread':
              return isThreadUnread(thread);
            case 'attachments':
              return Boolean(thread.hasAttachment);
            case 'meetings':
              return thread.subject.toLowerCase().includes('invite');
            default:
              return false;
          }
        })
        .map((thread) => thread.id);
    });
  }, [filteredThreads, readThreadIdSet, selectionMode]);

  const handleQueryKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
  };

  const handleAssistantPreviewRequest = useCallback(() => {
    setAssistantPreview(query.trim() ? resolvePreview(query) : null);
  }, [query]);

  const handleOpenThread = useCallback((thread: EmailThread) => {
    setSelectedThreadId(thread.id);
    setReadThreadIds((current) => Array.from(new Set([...current, thread.id])));
    setRowMenu(null);

    if (compactPanel) {
      readerPanel.setGeometry(getCompactReaderPanelGeometry(emailPanel.panel.geometry, readerPanel.panel.geometry));
      handleReaderPanelModeChange('floating');
      readerPanel.focus();
    }
  }, [compactPanel, emailPanel.panel.geometry, handleReaderPanelModeChange, readerPanel]);

  const handleThreadContextMenu = useCallback((event: MouseEvent<HTMLElement>, thread: EmailThread) => {
    if (!compactPanel) {
      return;
    }

    event.preventDefault();
    setSelectedThreadId(thread.id);
    setReadThreadIds((current) => Array.from(new Set([...current, thread.id])));
    setRowMenu({
      threadId: thread.id,
      x: event.clientX,
      y: event.clientY,
    });
  }, [compactPanel]);

  const handleThreadSelectionToggle = (threadId: string) => {
    setSelectionMode('manual');
    setSelectedThreadIds((current) =>
      current.includes(threadId) ? current.filter((id) => id !== threadId) : [...current, threadId],
    );
  };

  const handleSelectAllVisible = () => {
    setSelectionMode('manual');
    setSelectedThreadIds((current) => {
      const currentIds = new Set(current);

      if (allVisibleSelected) {
        return current.filter((threadId) => !filteredThreads.some((thread) => thread.id === threadId));
      }

      filteredThreads.forEach((thread) => currentIds.add(thread.id));
      return Array.from(currentIds);
    });
  };

  const handleMarkSelectedRead = () => {
    if (selectedThreadIds.length === 0) {
      return;
    }

    setReadThreadIds((current) => Array.from(new Set([...current, ...selectedThreadIds])));
  };

  const handleClearSelection = () => {
    setSelectionMode('manual');
    setSelectedThreadIds([]);
  };

  const handleDeleteSelected = () => {
    const visibleSelectedIds = filteredThreads
      .filter((thread) => selectedThreadIdSet.has(thread.id))
      .map((thread) => thread.id);

    if (visibleSelectedIds.length === 0) {
      return;
    }

    const selectedIds = new Set(visibleSelectedIds);

    setThreadItems((current) => current.filter((thread) => !selectedIds.has(thread.id)));
    setReadThreadIds((current) => current.filter((threadId) => !selectedIds.has(threadId)));
    setSelectedThreadIds([]);
    setSelectionMode('manual');
    setSelectedThreadId((current) => current && selectedIds.has(current) ? null : current);
    setDraft((current) => current?.sourceThreadId && selectedIds.has(current.sourceThreadId) ? null : current);
    setDraftNotice(
      `${visibleSelectedIds.length} selected email${visibleSelectedIds.length === 1 ? '' : 's'} removed from this prototype inbox.`,
    );
  };

  const handleApplyBulkAction = () => {
    switch (bulkAction) {
      case 'mark-read':
        handleMarkSelectedRead();
        break;
      case 'delete':
        handleDeleteSelected();
        break;
      case 'clear':
        handleClearSelection();
        break;
      default:
        break;
    }
  };

  const handleStartDraft = useCallback((mode: DraftMode, thread: EmailThread | null = selectedThread) => {
    const nextDraft = mode === 'compose' || !thread
      ? createBlankDraft(accountFilter)
      : createDraftForThread(thread, mode);

    setDraft(nextDraft);
    setRowMenu(null);
    setShowCc(Boolean(nextDraft.cc));
    setShowBcc(false);
    setDraftNotice(null);

    if (compactPanel) {
      draftPanel.setGeometry(getCompactDraftPanelGeometry(emailPanel.panel.geometry, draftPanel.panel.geometry));
      handleDraftPanelModeChange('floating');
      draftPanel.focus();
    }
  }, [accountFilter, compactPanel, draftPanel, emailPanel.panel.geometry, handleDraftPanelModeChange, selectedThread]);

  const handleOpenContext = useCallback((thread: EmailThread | null = null) => {
    if (thread) {
      setSelectedThreadId(thread.id);
      setReadThreadIds((current) => Array.from(new Set([...current, thread.id])));
    }
    setContextRequested(true);
    setRowMenu(null);
    if (compactPanel) {
      handleContextPanelModeChange('floating');
      contextPanel.focus();
      return;
    }

    handleContextPanelModeChange('docked');
  }, [compactPanel, contextPanel, handleContextPanelModeChange]);

  const handleCloseDraft = useCallback(() => {
    if (!draft) return;

    if (draft.status !== 'saved' && draft.status !== 'queued') {
      const shouldSave = window.confirm('Save this unsent email as a draft before closing?');
      setDraftNotice(shouldSave
        ? 'Draft saved locally in EmailCaddy before closing. Provider sync is not wired in this prototype.'
        : 'Draft closed without saving.');
    } else {
      setDraftNotice(null);
    }

    setDraft(null);
    setShowCc(false);
    setShowBcc(false);
    setContextRequested(false);
    if (compactPanel) {
      handleDraftPanelModeChange('docked');
    }
  }, [compactPanel, draft, handleDraftPanelModeChange]);

  const handleDraftFieldChange = (field: keyof Pick<EmailDraft, 'to' | 'cc' | 'bcc' | 'subject' | 'body'>, value: string) => {
    setDraft((current) => current ? { ...current, [field]: value, status: 'editing' } : current);
  };

  const handleDraftMetaChange = (
    field: keyof Pick<EmailDraft, 'sensitivity' | 'classification' | 'audienceDepth'>,
    value: EmailDraft[typeof field],
  ) => {
    setDraft((current) => current ? { ...current, [field]: value, status: 'editing' } : current);
  };

  const handleAssistantDraft = () => {
    setContextRequested(true);
    setDraft((current) => {
      if (!current) return current;

      const suggestedBody = draftSourceThread
        ? draftSourceThread.draft.join('\n\n')
        : 'Draft outline:\n\n- State the request.\n- Answer only what is ready.\n- Defer anything that needs review.';
      const alreadyIncluded = current.body.includes(suggestedBody.split('\n')[0]);
      const nextBody = alreadyIncluded ? current.body : `${suggestedBody}\n\n${current.body}`.trim();

      return { ...current, body: nextBody, status: 'editing' };
    });
    setDraftNotice('AI staged editable draft text only. It did not send email or contact a provider.');
  };

  const handleSanitizeDraft = () => {
    setDraft((current) => {
      if (!current) return current;
      const body = current.body.includes('[Sanitized]')
        ? current.body
        : `[Sanitized]\n${current.body.replace(/\binternal\b/gi, 'sensitive').replace(/\binvestigation\b/gi, 'review')}`;
      return { ...current, body, sanitized: true, status: 'editing' };
    });
    setDraftNotice('Sanitization pass applied. Review the wording before using platform send.');
  };

  const handleExtractAsks = () => {
    setContextRequested(true);
    const asks = draftSourceThread?.asks || selectedThread?.asks || [];
    setDraftNotice(
      asks.length > 0
        ? `Ask extraction: ${asks.join(' | ')}`
        : 'Ask extraction: no direct asks found in the selected message.',
    );
  };

  const handleCoverageCheck = () => {
    setContextRequested(true);
    const askCount = draftSourceThread?.asks.length || selectedThread?.asks.length || 0;
    setDraftNotice(
      askCount > 0
        ? `Coverage check: ${askCount} extracted ask${askCount === 1 ? '' : 's'} found. Confirm each is answered or explicitly deferred.`
        : 'Coverage check: no extracted asks were found for this draft.',
    );
  };

  const handleSaveDraft = () => {
    setDraft((current) => current ? { ...current, status: 'saved' } : current);
    setDraftNotice('Draft saved locally in EmailCaddy. Provider sync is not wired in this prototype.');
  };

  const handleQueuePlatformSend = () => {
    setDraft((current) => current ? { ...current, status: 'queued' } : current);
    setDraftNotice('Staged for provider send review. CaddyAI did not send this email; no provider send connector is active.');
  };

  const handleCloseTransientUi = () => {
    setAssistantPreview(null);
    setDraftNotice(null);
    setRowMenu(null);
    setAccountSetupOpen(false);
    setAddAccountOpen(false);
    setShowCc((current) => draft?.cc ? current : false);
    setShowBcc((current) => draft?.bcc ? current : false);
  };

  const handleOpenAddAccount = useCallback(() => {
    setAddAccountOpen(true);
    setAddAccountError(null);
    setAddAccountConnecting(false);
    setAddAccountUser('');
    setAddAccountPass('');
    setAddAccountImapHost('');
    setAddAccountImapPort('993');
    setDraftNotice(null);
  }, []);

  const handleConnectOAuthAccount = useCallback(async (providerId: EmailProviderId) => {
    const bridge = getMailBridge();
    if (!bridge?.startOAuth) {
      setAddAccountError('OAuth sign-in requires the ThreatCaddy desktop app.');
      return;
    }
    setAddAccountConnecting(true);
    setAddAccountError(null);
    try {
      const { credRefId, email } = await bridge.startOAuth(providerId);
      const now = Date.now();
      const account = addEmailAccount({
        id: `emailcaddy-${providerId}-${now}`,
        providerId,
        label: email ?? EMAIL_PROVIDER_METADATA[providerId].label,
        address: email ?? undefined,
        now,
      });
      updateEmailAccount(account.id, {
        status: 'connected',
        credentialRef: { kind: 'oauth-token', id: credRefId, storedBy: 'secret-store' },
      });
      setAddAccountOpen(false);
    } catch (err) {
      setAddAccountError(err instanceof Error ? err.message : 'OAuth sign-in failed.');
    } finally {
      setAddAccountConnecting(false);
    }
  }, [addEmailAccount, updateEmailAccount]);

  const handleConnectImapAccount = useCallback(async (providerId: EmailProviderId) => {
    const bridge = getMailBridge();
    if (!bridge) {
      setAddAccountError('ThreatCaddy desktop app is required to save credentials.');
      return;
    }
    setAddAccountConnecting(true);
    setAddAccountError(null);
    try {
      const isProton = providerId === 'proton-bridge';
      const now = Date.now();
      const credRefId = `imap-${providerId}-${now}-${Math.random().toString(36).slice(2, 10)}`;
      const cred = {
        kind: 'imap-smtp',
        imap: isProton ? { host: '127.0.0.1', port: 1143, secure: false } : { host: addAccountImapHost.trim(), port: parseInt(addAccountImapPort, 10) || 993, secure: true },
        smtp: isProton ? { host: '127.0.0.1', port: 1025, secure: false } : { host: addAccountImapHost.trim(), port: 587, secure: false },
        authMethod: 'basic',
        auth: { user: addAccountUser.trim(), pass: addAccountPass },
        from: addAccountUser.trim(),
      };
      await bridge.saveCredential(credRefId, cred);
      try {
        await bridge.execute('probe', credRefId, {});
      } catch { /* probe failure doesn't block saving the account */ }
      const account = addEmailAccount({
        id: credRefId,
        providerId,
        label: addAccountUser.trim() || EMAIL_PROVIDER_METADATA[providerId].label,
        address: addAccountUser.trim() || undefined,
        now,
      });
      updateEmailAccount(account.id, {
        status: 'connected',
        credentialRef: { kind: 'local-bridge', id: credRefId, storedBy: 'local-bridge' },
      });
      setAddAccountPass('');
      setAddAccountOpen(false);
    } catch (err) {
      setAddAccountError(err instanceof Error ? err.message : 'Failed to connect account.');
    } finally {
      setAddAccountConnecting(false);
    }
  }, [addAccountImapHost, addAccountImapPort, addAccountPass, addAccountUser, addEmailAccount, updateEmailAccount]);

  const mailboxViewOptions = useMemo<Array<ToolbarSelectOption<string>>>(
    () => mailboxViews.map((view) => ({
      value: view,
      label: `${view} (${mailboxCounts[view as keyof typeof mailboxCounts]})`,
    })),
    [mailboxCounts],
  );

  const accountOptions = useMemo<Array<ToolbarSelectOption<string>>>(
    () => accounts.map((account) => ({ value: account.id, label: account.label })),
    [],
  );

  const categoryOptions = useMemo<Array<ToolbarSelectOption<string>>>(
    () => categoryViews.map((category) => ({ value: category, label: category })),
    [],
  );

  const selectionModeOptions = useMemo<Array<ToolbarSelectOption<SelectionMode>>>(
    () => selectionModes.map((mode) => ({ value: mode.id, label: mode.label })),
    [],
  );

  const bulkActionOptions = useMemo<Array<ToolbarSelectOption<BulkAction>>>(
    () => bulkActions.map((action) => ({ value: action.id, label: action.label })),
    [],
  );

  const contextPanelContent = (
    <div
      className="min-w-0 rounded-[12px] border border-border-subtle/25 bg-bg-primary/55 p-3"
      data-email-message-context-card="true"
    >
      <div className="text-[10px] font-semibold uppercase text-text-muted">
        Message context
      </div>
      <div className="mt-2.5 space-y-2.5 text-[13px] leading-6 text-text-secondary">
        {contextThread ? (
          contextThread.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))
        ) : (
          <p>No source thread is attached to this draft yet.</p>
        )}
      </div>

      {contextThread && (
        <div className="mt-4 border-t border-border-subtle/35 pt-3">
          <div className="text-[10px] font-semibold uppercase text-text-muted">
            Extracted asks
          </div>
          <ul className="mt-2 space-y-2 text-[13px] leading-5 text-text-secondary">
            {contextThread.asks.map((ask) => (
              <li key={ask} className="flex gap-2">
                <span className="mt-[8px] h-1.5 w-1.5 rounded-full bg-accent" />
                <span>{ask}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );


  const addAccountPanel = (
    <section
      className={cn(
        'shrink-0 border-b border-accent/15 bg-accent/5',
        compactPanel ? 'px-2 py-2' : 'px-3 py-3',
      )}
      data-email-add-account-panel="true"
      aria-label="Add email account"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-2.5 text-[10px] font-semibold uppercase text-accent">
              <Plus size={12} />
              Add account
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-[12px] leading-5 text-text-secondary">
            Connect an email account. Credentials are stored in the OS keychain â€” no secrets are saved in the app or browser.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddAccountOpen(false)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border-subtle bg-bg-primary/70 text-text-secondary transition-colors hover:border-border-medium hover:bg-bg-hover hover:text-text-primary"
          aria-label="Close add account panel"
        >
          <X size={12} />
        </button>
      </div>

      {emailAccounts.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            Connected accounts
          </div>
          {emailAccounts.map((account) => (
            <div key={account.id} className="flex items-center gap-2 rounded-[9px] border border-border-subtle bg-bg-primary/70 px-2.5 py-1.5">
              <span
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  account.status === 'connected' ? 'bg-green-400' : account.status === 'pending' ? 'bg-yellow-400' : 'bg-red-400',
                )}
                aria-label={`Status: ${account.status}`}
              />
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-text-primary">
                {account.address || account.label}
              </span>
              <span className="shrink-0 rounded-full border border-border-subtle bg-bg-primary/60 px-1.5 py-0.5 text-[10px] text-text-muted">
                {account.status}
              </span>
              <button
                type="button"
                onClick={() => revokeEmailAccount(account.id)}
                className="shrink-0 rounded-md p-1 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
                aria-label={`Remove ${account.label}`}
                title={`Remove ${account.label}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={cn('mt-3 grid gap-3', compactPanel ? 'grid-cols-1' : 'lg:grid-cols-[220px_minmax(0,1fr)]')}>
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Provider</div>
          <div className="grid gap-1.5">
            {EMAIL_PROVIDER_LIST.filter((p) => p.id !== 'manual-local-bridge').map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => { setAddAccountProviderId(provider.id); setAddAccountError(null); }}
                aria-pressed={provider.id === addAccountProviderId}
                className={cn(
                  'min-h-8 rounded-[9px] border px-2.5 py-1.5 text-left text-[11px] font-semibold transition-colors',
                  provider.id === addAccountProviderId
                    ? 'border-accent/30 bg-accent/10 text-accent'
                    : 'border-border-subtle bg-bg-primary/70 text-text-secondary hover:border-border-medium hover:bg-bg-hover hover:text-text-primary',
                )}
              >
                {EMAIL_PROVIDER_METADATA[provider.id].label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-[12px] border border-border-subtle/35 bg-bg-primary/60 p-3">
          {(addAccountProviderId === 'google-gmail' || addAccountProviderId === 'microsoft-outlook') ? (
            isDesktopBridge() ? (
              <div className="space-y-3">
                <p className="text-[12px] leading-5 text-text-secondary">
                  {addAccountProviderId === 'google-gmail'
                    ? 'Sign in with your Google account to connect Gmail. A browser window will open for the sign-in flow.'
                    : 'Sign in with your Microsoft account to connect Outlook. A browser window will open for the sign-in flow.'}
                </p>
                {addAccountError && (
                  <p className="rounded-[9px] border border-red-500/25 bg-red-500/8 px-2.5 py-1.5 text-[11px] text-red-400">
                    {addAccountError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => { void handleConnectOAuthAccount(addAccountProviderId); }}
                  disabled={addAccountConnecting}
                  className="inline-flex h-8 items-center gap-2 rounded-[10px] border border-accent/25 bg-accent/10 px-3 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {addAccountConnecting ? <RefreshCw size={13} className="animate-spin" /> : <Mail size={13} />}
                  {addAccountConnecting ? 'Signing inâ€¦' : addAccountProviderId === 'google-gmail' ? 'Sign in with Google' : 'Sign in with Microsoft'}
                </button>
              </div>
            ) : (
              <div className="rounded-[9px] border border-border-subtle bg-bg-primary/70 p-3 text-[12px] leading-5 text-text-secondary">
                <p className="font-semibold text-text-primary">Desktop app required</p>
                <p className="mt-1">
                  {addAccountProviderId === 'google-gmail' ? 'Gmail' : 'Outlook'} OAuth sign-in requires the ThreatCaddy desktop app. Open ThreatCaddy in the desktop app to connect this account.
                </p>
              </div>
            )
          ) : (
            <div className="space-y-3">
              {addAccountProviderId === 'proton-bridge' && (
                <p className="text-[12px] leading-5 text-text-secondary">
                  Proton Bridge must be running locally on port 1143. Use the bridge-provided username and password â€” not your Proton login credentials.
                </p>
              )}
              {addAccountProviderId === 'generic-imap-smtp' && (
                <p className="text-[12px] leading-5 text-text-secondary">
                  Enter your IMAP server details. Credentials are encrypted and stored in the OS keychain â€” they are never saved in the app.
                </p>
              )}
              {addAccountProviderId === 'generic-imap-smtp' && (
                <div className="grid gap-2">
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase text-text-muted">IMAP host</span>
                    <input
                      type="text"
                      value={addAccountImapHost}
                      onChange={(e) => setAddAccountImapHost(e.target.value)}
                      placeholder="imap.example.com"
                      className="h-8 w-full rounded-[9px] border border-border-subtle bg-bg-primary/80 px-2.5 text-[12px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/50"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase text-text-muted">IMAP port</span>
                    <input
                      type="number"
                      value={addAccountImapPort}
                      onChange={(e) => setAddAccountImapPort(e.target.value)}
                      placeholder="993"
                      className="h-8 w-full rounded-[9px] border border-border-subtle bg-bg-primary/80 px-2.5 text-[12px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/50"
                    />
                  </label>
                </div>
              )}
              <div className="grid gap-2">
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase text-text-muted">Username / email</span>
                  <input
                    type="email"
                    value={addAccountUser}
                    onChange={(e) => setAddAccountUser(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="h-8 w-full rounded-[9px] border border-border-subtle bg-bg-primary/80 px-2.5 text-[12px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/50"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase text-text-muted">
                    {addAccountProviderId === 'proton-bridge' ? 'Bridge password' : 'Password / app password'}
                  </span>
                  <input
                    type="password"
                    value={addAccountPass}
                    onChange={(e) => setAddAccountPass(e.target.value)}
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                    autoComplete="current-password"
                    className="h-8 w-full rounded-[9px] border border-border-subtle bg-bg-primary/80 px-2.5 text-[12px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/50"
                  />
                </label>
              </div>
              {addAccountError && (
                <p className="rounded-[9px] border border-red-500/25 bg-red-500/8 px-2.5 py-1.5 text-[11px] text-red-400">
                  {addAccountError}
                </p>
              )}
              {!getMailBridge() && (
                <p className="rounded-[9px] border border-border-subtle bg-bg-primary/70 px-2.5 py-1.5 text-[11px] text-text-muted">
                  Desktop app required to securely save credentials and test the connection.
                </p>
              )}
              <button
                type="button"
                onClick={() => { void handleConnectImapAccount(addAccountProviderId); }}
                disabled={
                  addAccountConnecting ||
                  !addAccountUser.trim() ||
                  !addAccountPass.trim() ||
                  (addAccountProviderId === 'generic-imap-smtp' && !addAccountImapHost.trim())
                }
                className="inline-flex h-8 items-center gap-2 rounded-[10px] border border-accent/25 bg-accent/10 px-3 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {addAccountConnecting ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                {addAccountConnecting ? 'Connectingâ€¦' : 'Connect account'}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );

  const compactTitlebarControls = useMemo(() => {
    if (!compactPanel) return null;

    return (
      <div
        className="flex min-w-0 flex-1 items-center justify-between gap-1.5"
        data-email-compact-titlebar="true"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-[11px] font-semibold text-text-primary">
            EmailCaddy
          </span>
          <span
            className="hidden shrink-0 rounded-full border border-accent/20 bg-accent/8 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-accent sm:inline-flex"
            aria-label={`${visibleUnreadCount} unread emails`}
          >
            {visibleUnreadCount} unread
          </span>
          <span
            className="hidden shrink-0 rounded-full border border-border-subtle bg-bg-primary/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-text-muted lg:inline-flex"
            data-email-account-titlebar-status="true"
          >
            {proofedAccountCount > 0 ? 'Local proof passed' : hasConfiguredAccount ? 'Local checklist staged' : 'Demo mailbox only'}
          </span>
        </div>
        <div
          className="flex min-w-[88px] max-w-[138px] flex-1 items-center gap-1 rounded-[8px] border border-border-subtle bg-bg-primary/70 px-1.5"
          data-email-compact-search="true"
        >
          <Search size={11} className="shrink-0 text-text-muted" aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={(event) => {
              const nextValue = event.target.value;
              setQuery(nextValue);
              if (!nextValue.trim()) {
                setAssistantPreview(null);
              }
            }}
            onKeyDown={handleQueryKeyDown}
            placeholder="Search"
            aria-label="Search EmailCaddy"
            className="h-6 min-w-0 flex-1 bg-transparent text-[10px] font-medium text-text-primary outline-none placeholder:text-text-muted"
          />
          <button
            type="button"
            onClick={handleAssistantPreviewRequest}
            disabled={!query.trim()}
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/8 text-accent transition-colors hover:bg-accent/14 disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-bg-primary/60 disabled:text-text-muted"
            aria-label="Ask CaddyAI about email search"
            title="Ask CaddyAI"
          >
            <Sparkles size={10} />
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleOpenAddAccount}
            className="inline-flex h-6 items-center gap-1 rounded-[8px] border border-accent/25 bg-accent/8 px-2 text-[10px] font-semibold text-accent transition-colors hover:bg-accent/14"
            aria-label="Set up EmailCaddy account"
            title={accountConnectionSummary}
          >
            <ShieldCheck size={12} />
            <span>Setup</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAddAccount}
            className="inline-flex h-6 items-center gap-1 rounded-[8px] border border-border-subtle bg-bg-raised/70 px-2 text-[10px] font-semibold text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover"
            aria-label="Add email account"
            title="Add email account"
          >
            <Plus size={12} />
            <span>Add</span>
          </button>
          <button
            type="button"
            onClick={() => handleStartDraft('compose')}
            className="inline-flex h-6 items-center gap-1 rounded-[8px] border border-border-subtle bg-bg-raised/70 px-2 text-[10px] font-semibold text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover"
            aria-label="Compose"
            title="Compose"
          >
            <Plus size={12} />
            <span>Compose</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenContext()}
            disabled={!contextThread && !draft}
            className="inline-flex h-6 items-center gap-1 rounded-[8px] border border-accent/25 bg-accent/8 px-2 text-[10px] font-semibold text-accent transition-colors hover:bg-accent/14"
            aria-label="Context"
            title={contextThread ? 'Open message context' : 'Open draft context'}
          >
            <Mail size={12} />
            <span>Context</span>
          </button>
        </div>
      </div>
    );
  }, [accountConnectionSummary, compactPanel, contextThread, draft, handleAssistantPreviewRequest, handleOpenAddAccount, handleOpenContext, handleQueryKeyDown, handleStartDraft, hasConfiguredAccount, proofedAccountCount, query, visibleUnreadCount]);
  const compactTitlebarAccessory = useMemo(
    () => compactTitlebarControls ? { content: compactTitlebarControls, replaceTitle: true } : null,
    [compactTitlebarControls],
  );
  const compactControlsInTitlebar = useWorkspacePanelHeaderAccessory(compactTitlebarAccessory);
  const showEmailRouteHeader = !compactPanel || !compactControlsInTitlebar;
  const lowerPaneActive = Boolean((!compactPanel && selectedThread) || (!compactPanel && draft) || (!compactPanel && contextRequested && contextThread));
  const renderLowerPane = lowerPaneActive;
  const mailSurfaceRowsClass = compactPanel
    ? lowerPaneActive
      ? 'grid-rows-[minmax(0,1fr)_8px_minmax(0,0.9fr)]'
      : 'grid-rows-[minmax(0,1fr)]'
    : lowerPaneActive
      ? 'grid-rows-[minmax(0,1.15fr)_10px_minmax(252px,0.9fr)]'
      : 'grid-rows-[minmax(0,1fr)]';

  useEffect(() => {
    const handleWorkspaceKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCloseTransientUi();
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && !isEditableKeyTarget(event.target)) {
        if (selectedCount > 0) {
          event.preventDefault();
          handleDeleteSelected();
        }
      }
    };

    window.addEventListener('keydown', handleWorkspaceKeyDown);
    return () => window.removeEventListener('keydown', handleWorkspaceKeyDown);
  });

  return (
    <section
      className={cn(
        'flex min-h-0 min-w-0 flex-1 w-full flex-col overflow-hidden text-text-primary',
        compactPanel
          ? 'bg-transparent p-0 shadow-none'
          : 'rounded-[20px] bg-bg-raised/90 p-2.5 shadow-[0_20px_56px_rgba(15,23,42,0.14)] backdrop-blur-sm',
      )}
      data-assistant-workspace="emailcaddy"
      data-email-compact-panel={compactPanel ? 'true' : 'false'}
    >
      {showEmailRouteHeader && (
      <div
        className={cn(
          'shrink-0 flex flex-wrap items-center justify-between gap-3 px-1 pb-1.5',
          compactPanel && 'pb-1',
        )}
        data-email-route-header="true"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div
            className={cn(
              'inline-flex items-center gap-3 rounded-[12px]',
              onWorkspacePanelDragStart && 'cursor-grab px-1 py-0.5 transition-colors hover:bg-bg-hover/70 active:cursor-grabbing',
            )}
            draggable={Boolean(onWorkspacePanelDragStart)}
            onDragStart={onWorkspacePanelDragStart}
            title={onWorkspacePanelDragStart ? 'Drag EmailCaddy into Workspace' : undefined}
            data-email-workspace-drag-source={onWorkspacePanelDragStart ? 'true' : undefined}
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-[11px] border border-accent/20 shadow-[0_8px_20px_rgba(15,23,42,0.14)]"
              style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-hover))' }}
            >
              <Mail size={16} strokeWidth={2.1} className="text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[19px] font-semibold">
                <span className="text-accent">Email</span>
                <span className="text-text-primary">Caddy</span>
              </h2>
              <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Unified inbox</p>
            </div>
          </div>
          <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-white">
            {visibleUnreadCount} unread
          </span>
          <span className="text-[12px] font-medium text-text-secondary">
            {filteredThreads.length} visible of {threadItems.length}
          </span>
          <span
            className="rounded-full border border-border-subtle bg-bg-primary/70 px-2.5 py-1 text-[11px] font-medium text-text-secondary"
            data-email-account-status="true"
          >
            {proofedAccountCount > 0 ? 'Local proof passed' : hasConfiguredAccount ? 'Local checklist staged' : 'Demo mailbox only'}
          </span>
        </div>

        {!compactPanel && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleOpenAddAccount}
              className="flex h-8 items-center gap-2 rounded-[10px] border border-accent/25 bg-accent/10 px-2.5 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/15"
              aria-label={hasConfiguredAccount ? 'Manage EmailCaddy accounts' : 'Set up EmailCaddy account'}
              title={accountConnectionSummary}
            >
              <ShieldCheck size={14} />
              {hasConfiguredAccount ? 'Accounts' : 'Set up account'}
            </button>
            <button
              type="button"
              onClick={handleOpenAddAccount}
              className="flex h-8 items-center gap-2 rounded-[10px] border border-border-subtle bg-bg-primary/75 px-2.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-border-medium hover:bg-bg-hover hover:text-text-primary"
              aria-label="Add email account"
            >
              <Plus size={14} />
              Add account
            </button>
            <button
              type="button"
              className="flex h-8 items-center gap-2 rounded-[10px] border border-border-subtle bg-bg-primary/75 px-2.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-border-medium hover:bg-bg-hover hover:text-text-primary"
              aria-label="Refresh email list"
              title="Refreshes the local demo/mock list only. Live provider sync is not active."
            >
              <RefreshCw size={14} />
              Demo refresh
            </button>
            <button
              type="button"
              onClick={() => handleStartDraft('compose')}
              className="flex h-8 items-center gap-2 rounded-[10px] border border-border-subtle bg-bg-primary/75 px-2.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-border-medium hover:bg-bg-hover hover:text-text-primary"
            >
              <Plus size={14} />
              Compose
            </button>
          </div>
        )}
      </div>
      )}

      <div className={cn(
        'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
        showEmailRouteHeader && 'mt-1',
        compactPanel && compactControlsInTitlebar
          ? 'rounded-none border-0 bg-transparent'
          : 'rounded-[16px] border border-border-subtle/20 bg-bg-primary/45',
      )}>
        {!compactPanel && (
        <div className="shrink-0 border-b border-border-subtle/35 px-2.5 py-2.5">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-[11px] border border-border-subtle/70 bg-bg-primary/80 px-3 py-2">
                <Search size={15} className="shrink-0 text-text-muted" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setQuery(nextValue);
                    if (!nextValue.trim()) {
                      setAssistantPreview(null);
                    }
                  }}
                  onKeyDown={handleQueryKeyDown}
                  placeholder="Search threads or ask what still needs an answer..."
                  aria-label="Search EmailCaddy"
                  className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-text-primary outline-none placeholder:text-text-muted"
                />
                <button
                  type="button"
                  onClick={handleAssistantPreviewRequest}
                  disabled={!query.trim()}
                  className="inline-flex h-6 shrink-0 items-center rounded-full border border-accent/15 bg-accent/8 px-2.5 text-[10px] font-semibold text-accent transition-colors hover:bg-accent/12 disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-bg-primary/70 disabled:text-text-muted"
                >
                  AI
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ToolbarSelect
                  value={mailboxView}
                  options={mailboxViewOptions}
                  onChange={setMailboxView}
                  ariaLabel="Select mailbox view"
                  className="min-w-[112px]"
                />

                <ToolbarSelect
                  value={accountFilter}
                  options={accountOptions}
                  onChange={setAccountFilter}
                  ariaLabel="Select email account"
                  className="min-w-[132px]"
                />

                <button
                  type="button"
                  onClick={handleOpenAddAccount}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-accent/20 bg-accent/8 px-2.5 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/14"
                  aria-label="Manage EmailCaddy account setup"
                  title={accountConnectionSummary}
                >
                  <ShieldCheck size={13} />
                  Manage setup
                </button>

                <ToolbarSelect
                  value={categoryView}
                  options={categoryOptions}
                  onChange={setCategoryView}
                  ariaLabel="Select email focus"
                  className="min-w-[100px]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <ToolbarSelect
                value={selectionMode}
                options={selectionModeOptions}
                onChange={setSelectionMode}
                ariaLabel="Select bulk selection type"
                className="min-w-[124px]"
              />

              <ToolbarSelect
                value={bulkAction}
                options={bulkActionOptions}
                onChange={setBulkAction}
                ariaLabel="Select bulk action"
                className="min-w-[124px]"
              />

              <button
                type="button"
                onClick={handleApplyBulkAction}
                disabled={selectedCount === 0}
                className="flex h-8 items-center gap-1.5 rounded-[10px] border border-border-subtle bg-bg-primary/80 px-3 text-[11px] font-medium text-text-secondary transition-colors hover:border-border-medium hover:bg-bg-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-45"
              >
                {bulkAction === 'delete' ? <Trash2 size={13} /> : <Check size={13} />}
                Apply
              </button>

              <span className="ml-auto inline-flex h-8 items-center rounded-full border border-border-subtle bg-bg-primary/70 px-3 text-[11px] font-medium text-text-secondary">
                {selectedCount} selected Â· Delete outside draft removes
              </span>
            </div>
          </div>
        </div>
        )}

        {emailAccounts.length === 0 && !addAccountOpen && !accountSetupOpen && (
          <div
            className={cn(
              'shrink-0 border-b border-accent/15 bg-accent/5 text-text-secondary',
              compactPanel ? 'px-2 py-2 text-[11px] leading-4' : 'px-3 py-2.5 text-[12px] leading-5',
            )}
            data-email-account-empty-state="true"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                No email account connected. Add an account to sync your inbox.
              </span>
              <button
                type="button"
                onClick={handleOpenAddAccount}
                className="inline-flex h-7 items-center gap-1.5 rounded-[9px] border border-accent/25 bg-accent/10 px-2.5 text-[10px] font-semibold text-accent transition-colors hover:bg-accent/15"
              >
                <Plus size={12} />
                Add email account
              </button>
            </div>
          </div>
        )}

        {emailAccounts.length > 0 && !accountSetupOpen && (
          <div
            className={cn(
              'shrink-0 border-b border-accent/15 bg-accent/5 text-text-secondary',
              compactPanel ? 'px-2 py-2 text-[11px] leading-4' : 'px-3 py-2.5 text-[12px] leading-5',
            )}
            data-email-account-status="true"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {emailAccounts.length} account{emailAccounts.length === 1 ? '' : 's'} connected.
                {' '}Live sync activates once the desktop app is running.
              </span>
              <button
                type="button"
                onClick={handleOpenAddAccount}
                className="inline-flex h-7 items-center gap-1.5 rounded-[9px] border border-accent/25 bg-accent/10 px-2.5 text-[10px] font-semibold text-accent transition-colors hover:bg-accent/15"
                aria-label="Add another email account"
              >
                <Plus size={12} />
                Add account
              </button>
            </div>
          </div>
        )}

        {addAccountOpen && addAccountPanel}

        {assistantPreview && (
          <div
            className={cn(
              'shrink-0 border-b border-border-subtle/35',
              compactPanel ? 'px-2 py-1.5' : 'px-2.5 py-2.5',
            )}
            data-email-assistant-preview="true"
          >
            <div className="flex flex-wrap items-start gap-2.5">
              <div className={compactPanel ? 'min-w-[120px]' : 'min-w-[172px]'}>
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                  <Sparkles size={12} />
                  EmailCaddy assist
                </div>
                <h3 className={cn('mt-1 font-semibold text-text-primary', compactPanel ? 'text-[12px]' : 'text-[14px]')}>
                  {assistantPreview.title}
                </h3>
              </div>
              <p className={cn('flex-1 text-text-secondary', compactPanel ? 'text-[11px] leading-4' : 'text-[12px] leading-5')}>
                {assistantPreview.summary}
              </p>
            </div>
            <ul className={cn('mt-2 flex flex-wrap gap-x-4 gap-y-1 text-text-secondary', compactPanel ? 'text-[11px] leading-4' : 'text-[12px] leading-5')}>
              {assistantPreview.bullets.map((bullet) => (
                <li key={bullet} className="flex min-w-[220px] gap-2">
                  <span className="mt-[8px] h-1.5 w-1.5 rounded-full bg-accent" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {draftNotice && !lowerPaneActive && (
          <div
            className="shrink-0 border-b border-accent/15 bg-accent/5 px-3 py-2 text-[12px] leading-5 text-text-secondary"
            data-email-inline-notice="true"
          >
            {draftNotice}
          </div>
        )}

        <div
          className={cn(
            'grid min-h-0 min-w-0 flex-1 overflow-hidden',
            mailSurfaceRowsClass,
          )}
          data-email-mail-surface="true"
          data-email-lower-pane-active={renderLowerPane ? 'true' : 'false'}
        >
          <section
            className="min-h-0 min-w-0 flex flex-col overflow-hidden"
            data-email-thread-list-pane="true"
          >
            <div className="shrink-0 grid grid-cols-[28px_minmax(126px,0.34fr)_minmax(0,1fr)_78px] items-center gap-2.5 border-b border-border-subtle/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allVisibleSelected}
                onChange={handleSelectAllVisible}
                aria-label="Select all visible emails"
                className="h-4 w-4 rounded border-border-medium bg-transparent text-accent focus:ring-accent"
              />
              <span>Sender</span>
              <span>Subject</span>
              <span className="text-right">Time</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {filteredThreads.length > 0 ? (
                <div>
                  {groupedThreads.map((group) => (
                    <div key={group.id}>
                      <div className="sticky top-0 z-10 flex items-center justify-between border-y border-border-subtle/20 bg-bg-primary/95 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted backdrop-blur-sm">
                        <span>{group.label}</span>
                        <span>{group.items.length}</span>
                      </div>

                      <div className="divide-y divide-border-subtle/30">
                        {group.items.map((thread) => {
                          const isSelected = selectedThreadId === thread.id;
                          const isChecked = selectedThreadIdSet.has(thread.id);
                          const unread = isThreadUnread(thread);

                          return (
                            <div
                              key={thread.id}
                              className={cn(
                                'grid grid-cols-[28px_minmax(0,1fr)] items-center gap-2.5 px-3 py-2 transition-colors',
                                isSelected ? 'bg-accent/8' : 'hover:bg-bg-hover/55',
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleThreadSelectionToggle(thread.id)}
                                aria-label={`Select ${thread.subject}`}
                                className="h-4 w-4 rounded border-border-medium bg-transparent text-accent focus:ring-accent"
                              />

                              <button
                                type="button"
                                onClick={() => handleOpenThread(thread)}
                                onContextMenu={(event) => handleThreadContextMenu(event, thread)}
                                aria-label={`Open ${thread.subject}`}
                                className="grid min-w-0 grid-cols-[minmax(126px,0.34fr)_minmax(0,1fr)_78px] items-center gap-2.5 overflow-hidden text-left"
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <span
                                    className={cn(
                                      'h-2 w-2 shrink-0 rounded-full',
                                      unread ? toneDotClass(thread.tone) : 'bg-border-medium',
                                    )}
                                  />
                                  <span
                                    className={cn(
                                      'truncate text-[12px]',
                                      unread ? 'font-semibold text-text-primary' : 'font-medium text-text-secondary',
                                    )}
                                  >
                                    {thread.senderLabel}
                                  </span>
                                </div>

                                <div className="min-w-0 overflow-hidden">
                                  <div className="truncate text-[12px] leading-5 text-text-primary">
                                    <span className={cn(unread ? 'font-semibold' : 'font-medium')}>{thread.subject}</span>
                                    <span className="font-normal text-text-muted"> - {thread.preview}</span>
                                  </div>
                                </div>

                                <div className="flex min-w-0 items-center justify-end gap-1.5 overflow-hidden text-[10px] font-medium text-text-muted">
                                  {thread.hasAttachment && <Paperclip size={12} className="shrink-0" />}
                                  <span className="truncate text-right">{thread.receivedAt}</span>
                                </div>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-10 text-center text-[13px] text-text-secondary">
                  No mirrored threads match this account and search view yet.
                </div>
              )}
            </div>
          </section>

          {compactPanel && rowMenu && rowMenuThread && (
            <div
              role="menu"
              aria-label="Email row actions"
              className="fixed z-[260] min-w-[172px] overflow-hidden rounded-[10px] border border-border-medium bg-bg-raised/98 p-1 text-[11px] shadow-[8px_12px_24px_rgba(0,0,0,0.32)] backdrop-blur-xl"
              style={{ left: rowMenu.x, top: rowMenu.y }}
              data-email-row-menu="true"
              data-themed-context-menu="toolbar-select"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => handleOpenThread(rowMenuThread)}
                className="flex min-h-8 w-full items-center gap-2 rounded-[8px] px-3 py-1.5 text-left text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
              >
                <Mail size={13} />
                Open reader
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleStartDraft('reply', rowMenuThread)}
                className="flex min-h-8 w-full items-center gap-2 rounded-[8px] px-3 py-1.5 text-left text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
              >
                <CornerUpLeft size={13} />
                Reply
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleStartDraft('reply-all', rowMenuThread)}
                className="flex min-h-8 w-full items-center gap-2 rounded-[8px] px-3 py-1.5 text-left text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
              >
                <Users size={13} />
                Reply all
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleStartDraft('forward', rowMenuThread)}
                className="flex min-h-8 w-full items-center gap-2 rounded-[8px] px-3 py-1.5 text-left text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
              >
                <Forward size={13} />
                Forward
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleOpenContext(rowMenuThread)}
                className="flex min-h-8 w-full items-center gap-2 rounded-[8px] px-3 py-1.5 text-left text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
              >
                <Mail size={13} />
                Context
              </button>
            </div>
          )}

          {renderLowerPane && (
          <>
            <div
              role="separator"
              aria-label="Resize selected email pane"
              aria-orientation="horizontal"
              tabIndex={0}
              className="group flex cursor-row-resize items-center justify-center border-y border-border-subtle/20 bg-bg-primary/55"
            >
              <span className="h-1 w-24 rounded-full bg-border-medium/80 transition-colors group-hover:bg-accent/70 group-focus:bg-accent/70" />
            </div>

          <article
            className="min-h-0 min-w-0 overflow-hidden border-t border-border-subtle/25 bg-bg-primary/55"
            data-email-lower-pane="true"
          >
            {selectedThread || draft ? (
              <>
                <div className="shrink-0 border-b border-border-subtle/30 px-3.5 py-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2.5">
                    {selectedThread && !draft && (
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                          Selected message
                        </div>
                        <h3 className="mt-1.5 text-[16px] font-semibold leading-6 text-text-primary">
                          {selectedThread.subject}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-text-secondary">
                          <span className="inline-flex h-7 min-w-0 items-center rounded-full border border-border-subtle bg-bg-primary/70 px-2.5">
                            <span className="truncate">{selectedThread.senderLabel}</span>
                          </span>
                          <span className="inline-flex h-7 items-center rounded-full border border-border-subtle bg-bg-primary/70 px-2.5">
                            {selectedThread.receivedAt}
                          </span>
                        </div>
                      </div>
                    )}

                    {draft && (
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                          Compose draft
                        </div>
                        <h3 className="mt-1.5 text-[16px] font-semibold leading-6 text-text-primary">
                          {draft.subject || 'New EmailCaddy message'}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-text-secondary">
                          <span className="inline-flex h-7 items-center rounded-full border border-accent/20 bg-accent/10 px-2.5 font-semibold text-accent">
                            Editable local draft
                          </span>
                          <span className="inline-flex h-7 items-center rounded-full border border-border-subtle bg-bg-primary/70 px-2.5">
                            Human-confirmed provider send only
                          </span>
                        </div>
                      </div>
                    )}

                    {selectedThread && (
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartDraft('reply', selectedThread)}
                          className="flex h-8 items-center gap-1.5 rounded-[10px] border border-border-subtle bg-bg-primary/80 px-3 text-[11px] font-semibold text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover"
                        >
                          <CornerUpLeft size={13} />
                          Reply
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartDraft('reply-all', selectedThread)}
                          className="flex h-8 items-center gap-1.5 rounded-[10px] border border-border-subtle bg-bg-primary/80 px-3 text-[11px] font-semibold text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover"
                        >
                          <Users size={13} />
                          Reply all
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartDraft('forward', selectedThread)}
                          className="flex h-8 items-center gap-1.5 rounded-[10px] border border-border-subtle bg-bg-primary/80 px-3 text-[11px] font-semibold text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover"
                        >
                          <Forward size={13} />
                          Forward
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenContext()}
                          className="flex h-8 items-center gap-1.5 rounded-[10px] border border-border-subtle bg-bg-primary/80 px-3 text-[11px] font-semibold text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover"
                        >
                          <Mail size={13} />
                          Context
                        </button>
                      </div>
                    )}
                    {!compactPanel && draft && (
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={handleSanitizeDraft}
                          className="flex h-8 items-center gap-1.5 rounded-[10px] border border-accent/20 bg-accent/10 px-3 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/15"
                        >
                          <ShieldCheck size={13} />
                          Sanitize
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveDraft}
                          className="flex h-8 items-center gap-1.5 rounded-[10px] border border-border-subtle bg-bg-primary/80 px-3 text-[11px] font-semibold text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover"
                        >
                          <FilePenLine size={13} />
                          Save draft
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenContext()}
                          className="flex h-8 items-center gap-1.5 rounded-[10px] border border-border-subtle bg-bg-primary/80 px-3 text-[11px] font-semibold text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover"
                        >
                          <Mail size={13} />
                          Context
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {(selectedThread || draft || contextRequested || (draftNotice && !draft)) && (
                <div className="min-h-0 overflow-y-auto overscroll-contain px-3.5 py-3">
                  <div className={cn(
                    'grid min-w-0 gap-3',
                    compactPanel ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1.08fr)_minmax(272px,0.92fr)]',
                  )}>
                    {!compactPanel && contextRequested && (
                      <WorkspacePanel
                        id="emailcaddy-message-context"
                        title="Context"
                        mode={contextPanel.panel.mode}
                        geometry={contextPanel.panel.geometry}
                        zIndex={contextPanel.panel.zIndex}
                        onPanelFocus={contextPanel.focus}
                        onRestore={contextPanel.restore}
                        onModeChange={handleContextPanelModeChange}
                        onGeometryChange={contextPanel.setGeometry}
                        floatingAriaLabel="EmailCaddy message context panel"
                        resizeLabelBase="message context"
                        popOutLabel="Pop out message context"
                        dockLabel="Dock message context back into UI"
                        minimizeLabel="Minimize message context"
                        closeLabel="Close message context workspace panel"
                        restoreLabel="Restore message context panel"
                        placeholderClassName={compactPanel ? 'hidden' : undefined}
                      >
                        {contextPanelContent}
                      </WorkspacePanel>
                    )}

                    {selectedThread && !draft && (
                      <div
                        className="min-w-0 rounded-[14px] border border-border-subtle/35 bg-bg-primary/60 p-3"
                        data-email-reader-pane="true"
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                          Message body
                        </div>
                        <div className="mt-2 space-y-2.5 text-[12px] leading-5 text-text-secondary">
                          {selectedThread.body.map((paragraph) => (
                            <p key={paragraph}>{paragraph}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {draft && (
                    <aside className="min-w-0 rounded-[14px] border border-border-subtle/35 bg-bg-primary/60 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                            EmailCaddy draft
                          </div>
                          <p className="mt-1 text-[12px] leading-5 text-text-secondary">
                            {`${draftModeLabel(draft.mode)} Â· editable before any platform send.`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {draft.status && (
                            <span className="rounded-full border border-border-subtle bg-bg-primary/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                              {draft.status}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={handleCloseDraft}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border-subtle bg-bg-primary/70 text-text-secondary transition-colors hover:border-border-medium hover:bg-bg-hover hover:text-text-primary"
                            aria-label="Close EmailCaddy draft"
                            title="Close EmailCaddy draft"
                          >
                            <X size={12} />
                          </button>
                          <Sparkles size={15} className="mt-0.5 shrink-0 text-accent" />
                        </div>
                      </div>

                        <div className="mt-3 space-y-2.5">
                          <label className="block">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">To</span>
                            <input
                              type="text"
                              value={draft.to}
                              onChange={(event) => handleDraftFieldChange('to', event.target.value)}
                              aria-label="EmailCaddy draft to"
                              placeholder="recipient@example.com"
                              className="mt-1 h-8 w-full rounded-[10px] border border-border-subtle bg-bg-primary/80 px-2.5 text-[12px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/50"
                            />
                          </label>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setShowCc((current) => !current)}
                              className={cn(
                                'h-7 rounded-full border px-2.5 text-[10px] font-semibold transition-colors',
                                showCc || draft.cc
                                  ? 'border-accent/20 bg-accent/10 text-accent'
                                  : 'border-border-subtle bg-bg-primary/70 text-text-secondary hover:text-text-primary',
                              )}
                            >
                              CC
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowBcc((current) => !current)}
                              className={cn(
                                'h-7 rounded-full border px-2.5 text-[10px] font-semibold transition-colors',
                                showBcc || draft.bcc
                                  ? 'border-accent/20 bg-accent/10 text-accent'
                                  : 'border-border-subtle bg-bg-primary/70 text-text-secondary hover:text-text-primary',
                              )}
                            >
                              BCC
                            </button>
                            <span className="text-[11px] text-text-muted">
                              AI may draft. ThreatCaddy platform must confirm sending.
                            </span>
                          </div>

                          {(showCc || draft.cc) && (
                            <label className="block">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Cc</span>
                              <input
                                type="text"
                                value={draft.cc}
                                onChange={(event) => handleDraftFieldChange('cc', event.target.value)}
                                aria-label="EmailCaddy draft cc"
                                placeholder="copy@example.com"
                                className="mt-1 h-8 w-full rounded-[10px] border border-border-subtle bg-bg-primary/80 px-2.5 text-[12px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/50"
                              />
                            </label>
                          )}

                          {(showBcc || draft.bcc) && (
                            <label className="block">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Bcc</span>
                              <input
                                type="text"
                                value={draft.bcc}
                                onChange={(event) => handleDraftFieldChange('bcc', event.target.value)}
                                aria-label="EmailCaddy draft bcc"
                                placeholder="blind-copy@example.com"
                                className="mt-1 h-8 w-full rounded-[10px] border border-border-subtle bg-bg-primary/80 px-2.5 text-[12px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/50"
                              />
                            </label>
                          )}

                          <label className="block">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Subject</span>
                            <input
                              type="text"
                              value={draft.subject}
                              onChange={(event) => handleDraftFieldChange('subject', event.target.value)}
                              aria-label="EmailCaddy draft subject"
                              placeholder="Subject"
                              className="mt-1 h-8 w-full rounded-[10px] border border-border-subtle bg-bg-primary/80 px-2.5 text-[12px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/50"
                            />
                          </label>

                          <label className="block">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Body</span>
                            <textarea
                              value={draft.body}
                              onChange={(event) => handleDraftFieldChange('body', event.target.value)}
                              aria-label="EmailCaddy draft body"
                              placeholder="Write the message..."
                              className="mt-1 min-h-[154px] w-full resize-y rounded-[12px] border border-border-subtle bg-bg-primary/80 px-3 py-2.5 text-[12px] leading-5 text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/50"
                            />
                          </label>

                          <div className="grid gap-2 sm:grid-cols-3">
                            <label className="block">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Sensitivity</span>
                              <select
                                value={draft.sensitivity}
                                onChange={(event) => handleDraftMetaChange('sensitivity', event.target.value as DraftSensitivity)}
                                aria-label="EmailCaddy draft sensitivity"
                                className="mt-1 h-8 w-full rounded-[10px] border border-border-subtle bg-bg-primary/80 px-2.5 text-[12px] text-text-primary outline-none transition-colors focus:border-accent/50"
                              >
                                {sensitivityOptions.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="block">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Classification</span>
                              <select
                                value={draft.classification}
                                onChange={(event) => handleDraftMetaChange('classification', event.target.value as DraftClassification)}
                                aria-label="EmailCaddy draft classification"
                                className="mt-1 h-8 w-full rounded-[10px] border border-border-subtle bg-bg-primary/80 px-2.5 text-[12px] text-text-primary outline-none transition-colors focus:border-accent/50"
                              >
                                {classificationOptions.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="block">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Audience</span>
                              <select
                                value={draft.audienceDepth}
                                onChange={(event) => handleDraftMetaChange('audienceDepth', event.target.value as DraftAudienceDepth)}
                                aria-label="EmailCaddy draft audience depth"
                                className="mt-1 h-8 w-full rounded-[10px] border border-border-subtle bg-bg-primary/80 px-2.5 text-[12px] text-text-primary outline-none transition-colors focus:border-accent/50"
                              >
                                {audienceDepthOptions.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>

                          {draftSourceThread && contextRequested && (
                            <div className="rounded-[12px] border border-border-subtle bg-bg-primary/70 p-2.5">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                                Quoted context
                              </div>
                              <div className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap text-[11px] leading-5 text-text-secondary">
                                {quotedThreadBody(draftSourceThread)}
                              </div>
                            </div>
                          )}

                          {draftAttachmentChips.length > 0 && (
                            <div className="rounded-[12px] border border-border-subtle bg-bg-primary/70 p-2.5">
                              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                                <Paperclip size={12} />
                                External attachments
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {draftAttachmentChips.map((attachment) => (
                                  <span key={attachment} className="rounded-full border border-border-subtle bg-bg-raised/70 px-2 py-1 text-[11px] text-text-secondary">
                                    {attachment}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {draftNotice && (
                            <div className="rounded-[12px] border border-accent/15 bg-accent/5 px-3 py-2 text-[12px] leading-5 text-text-secondary">
                              {draftNotice}
                            </div>
                          )}

                          {!compactPanel && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={handleAssistantDraft}
                                className="flex h-8 items-center gap-1.5 rounded-[10px] border border-border-subtle bg-bg-primary/80 px-3 text-[11px] font-semibold text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover"
                              >
                                <Sparkles size={13} />
                                Draft assist
                              </button>
                              <button
                                type="button"
                                onClick={handleSanitizeDraft}
                                className="flex h-8 items-center gap-1.5 rounded-[10px] border border-accent/20 bg-accent/10 px-3 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/15"
                              >
                                <ShieldCheck size={13} />
                                Sanitize
                              </button>
                              <button
                                type="button"
                                onClick={handleCoverageCheck}
                                className="flex h-8 items-center gap-1.5 rounded-[10px] border border-border-subtle bg-bg-primary/80 px-3 text-[11px] font-semibold text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover"
                              >
                                <Check size={13} />
                                What am I forgetting?
                              </button>
                              <button
                                type="button"
                                onClick={handleExtractAsks}
                                className="flex h-8 items-center gap-1.5 rounded-[10px] border border-border-subtle bg-bg-primary/80 px-3 text-[11px] font-semibold text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover"
                              >
                                <Sparkles size={13} />
                                Extract asks
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveDraft}
                                className="flex h-8 items-center gap-1.5 rounded-[10px] border border-border-subtle bg-bg-primary/80 px-3 text-[11px] font-semibold text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover"
                              >
                                <FilePenLine size={13} />
                                Save draft
                              </button>
                              <button
                                type="button"
                                onClick={handleQueuePlatformSend}
                                className="ml-auto flex h-8 items-center gap-1.5 rounded-[10px] border border-accent/25 bg-accent/12 px-3 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/18"
                                title="Queues the draft for user-confirmed platform send. CaddyAI does not send email."
                              >
                                <Send size={13} />
                                Stage send review
                              </button>
                            </div>
                          )}
                        </div>
                      {!compactPanel && (
                        <div className="mt-4 rounded-[12px] border border-accent/12 bg-accent/5 p-3 text-[12px] leading-5 text-text-secondary">
                          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                            <ShieldCheck size={12} />
                            Safety notes
                          </div>
                          <p className="mt-2">
                            Run sanitization before anything external, then use the coverage check to confirm that every direct ask is answered or explicitly deferred.
                          </p>
                        </div>
                      )}
                    </aside>
                    )}
                  </div>
                  {draftNotice && !draft && (
                    <div className="mt-3 rounded-[12px] border border-accent/15 bg-accent/5 px-3 py-2 text-[12px] leading-5 text-text-secondary">
                      {draftNotice}
                    </div>
                  )}
                </div>
                )}
              </>
            ) : (
              <div className="flex h-full items-center justify-center px-6 py-16 text-center text-[13px] text-text-secondary">
                Select a thread to open the reader and draft view.
              </div>
            )}
          </article>
          </>
          )}
        </div>

        {compactPanel && selectedThread && readerPanel.panel.mode !== 'docked' && (
          <WorkspacePanel
            id={EMAILCADDY_MESSAGE_READER_PANEL_ID}
            title="message reader"
            mode={readerPanel.panel.mode}
            geometry={readerPanel.panel.geometry}
            zIndex={readerPanel.panel.zIndex}
            onPanelFocus={readerPanel.focus}
            onRestore={readerPanel.restore}
            onModeChange={handleReaderPanelModeChange}
            onGeometryChange={readerPanel.setGeometry}
            floatingAriaLabel="EmailCaddy message reader panel"
            resizeLabelBase="message reader"
            popOutLabel="Pop out message reader"
            dockLabel="Dock message reader back into UI"
            minimizeLabel="Minimize message reader"
            closeLabel="Close message reader workspace panel"
            restoreLabel="Restore message reader panel"
            placeholderClassName="hidden"
          >
            <article
              className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[14px] border border-border-subtle/35 bg-bg-primary/70"
              data-email-reader-pane="true"
            >
              <div className="shrink-0 border-b border-border-subtle/30 px-3.5 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                  Selected message
                </div>
                <h3 className="mt-1.5 text-[15px] font-semibold leading-6 text-text-primary">
                  {selectedThread.subject}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-text-secondary">
                  <span className="inline-flex h-7 min-w-0 items-center rounded-full border border-border-subtle bg-bg-primary/70 px-2.5">
                    <span className="truncate">{selectedThread.senderLabel}</span>
                  </span>
                  <span className="inline-flex h-7 items-center rounded-full border border-border-subtle bg-bg-primary/70 px-2.5">
                    {selectedThread.receivedAt}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleStartDraft('reply', selectedThread)}
                    className="flex h-8 items-center gap-1.5 rounded-[10px] border border-border-subtle bg-bg-primary/80 px-3 text-[11px] font-semibold text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover"
                  >
                    <CornerUpLeft size={13} />
                    Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartDraft('reply-all', selectedThread)}
                    className="flex h-8 items-center gap-1.5 rounded-[10px] border border-border-subtle bg-bg-primary/80 px-3 text-[11px] font-semibold text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover"
                  >
                    <Users size={13} />
                    Reply all
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartDraft('forward', selectedThread)}
                    className="flex h-8 items-center gap-1.5 rounded-[10px] border border-border-subtle bg-bg-primary/80 px-3 text-[11px] font-semibold text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover"
                  >
                    <Forward size={13} />
                    Forward
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenContext()}
                    className="flex h-8 items-center gap-1.5 rounded-[10px] border border-border-subtle bg-bg-primary/80 px-3 text-[11px] font-semibold text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover"
                  >
                    <Mail size={13} />
                    Context
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 py-3">
                <div className="space-y-2.5 text-[12px] leading-5 text-text-secondary">
                  {selectedThread.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </div>
            </article>
          </WorkspacePanel>
        )}

        {compactPanel && draft && draftPanel.panel.mode !== 'docked' && (
          <WorkspacePanel
            id={EMAILCADDY_DRAFT_PANEL_ID}
            title="draft"
            mode={draftPanel.panel.mode}
            geometry={draftPanel.panel.geometry}
            zIndex={draftPanel.panel.zIndex}
            onPanelFocus={draftPanel.focus}
            onRestore={draftPanel.restore}
            onModeChange={handleDraftPanelModeChange}
            onGeometryChange={draftPanel.setGeometry}
            floatingAriaLabel="EmailCaddy draft panel"
            resizeLabelBase="EmailCaddy draft"
            popOutLabel="Pop out EmailCaddy draft"
            dockLabel="Dock EmailCaddy draft back into UI"
            minimizeLabel="Minimize EmailCaddy draft"
            closeLabel="Close EmailCaddy draft"
            restoreLabel="Restore EmailCaddy draft panel"
            placeholderClassName="hidden"
            preserveChildrenWhenMinimized
            minWidth={COMPACT_DRAFT_PANEL_MIN_WIDTH}
            minHeight={COMPACT_DRAFT_PANEL_MIN_HEIGHT}
            onClose={handleCloseDraft}
          >
            <aside
              className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[14px] border border-border-subtle/35 bg-bg-primary/75"
              data-email-draft-panel="true"
            >
              <div className="shrink-0 border-b border-border-subtle/30 px-3.5 py-3">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                      EmailCaddy draft
                    </div>
                    <h3 className="mt-1.5 truncate text-[15px] font-semibold leading-6 text-text-primary">
                      {draft.subject || 'New EmailCaddy message'}
                    </h3>
                    <p className="mt-1 text-[11px] leading-4 text-text-secondary">
                      {`${draftModeLabel(draft.mode)} Â· editable before any platform send.`}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      className="inline-flex h-7 items-center gap-1.5 rounded-[9px] border border-border-subtle bg-bg-primary/80 px-2.5 text-[10px] font-semibold text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover"
                    >
                      <FilePenLine size={12} />
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenContext()}
                      className="inline-flex h-7 items-center gap-1.5 rounded-[9px] border border-border-subtle bg-bg-primary/80 px-2.5 text-[10px] font-semibold text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover"
                    >
                      <Mail size={12} />
                      Context
                    </button>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 py-3">
                <div className="space-y-2.5">
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">To</span>
                    <input
                      type="text"
                      value={draft.to}
                      onChange={(event) => handleDraftFieldChange('to', event.target.value)}
                      aria-label="EmailCaddy draft to"
                      placeholder="recipient@example.com"
                      className="mt-1 h-8 w-full rounded-[10px] border border-border-subtle bg-bg-primary/80 px-2.5 text-[12px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/50"
                    />
                  </label>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowCc((current) => !current)}
                      className={cn(
                        'h-7 rounded-full border px-2.5 text-[10px] font-semibold transition-colors',
                        showCc || draft.cc
                          ? 'border-accent/20 bg-accent/10 text-accent'
                          : 'border-border-subtle bg-bg-primary/70 text-text-secondary hover:text-text-primary',
                      )}
                    >
                      CC
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBcc((current) => !current)}
                      className={cn(
                        'h-7 rounded-full border px-2.5 text-[10px] font-semibold transition-colors',
                        showBcc || draft.bcc
                          ? 'border-accent/20 bg-accent/10 text-accent'
                          : 'border-border-subtle bg-bg-primary/70 text-text-secondary hover:text-text-primary',
                      )}
                    >
                      BCC
                    </button>
                    <span className="text-[11px] text-text-muted">
                      Provider send still requires user confirmation.
                    </span>
                  </div>

                  {(showCc || draft.cc) && (
                    <label className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Cc</span>
                      <input
                        type="text"
                        value={draft.cc}
                        onChange={(event) => handleDraftFieldChange('cc', event.target.value)}
                        aria-label="EmailCaddy draft cc"
                        placeholder="copy@example.com"
                        className="mt-1 h-8 w-full rounded-[10px] border border-border-subtle bg-bg-primary/80 px-2.5 text-[12px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/50"
                      />
                    </label>
                  )}

                  {(showBcc || draft.bcc) && (
                    <label className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Bcc</span>
                      <input
                        type="text"
                        value={draft.bcc}
                        onChange={(event) => handleDraftFieldChange('bcc', event.target.value)}
                        aria-label="EmailCaddy draft bcc"
                        placeholder="blind-copy@example.com"
                        className="mt-1 h-8 w-full rounded-[10px] border border-border-subtle bg-bg-primary/80 px-2.5 text-[12px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/50"
                      />
                    </label>
                  )}

                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Subject</span>
                    <input
                      type="text"
                      value={draft.subject}
                      onChange={(event) => handleDraftFieldChange('subject', event.target.value)}
                      aria-label="EmailCaddy draft subject"
                      placeholder="Subject"
                      className="mt-1 h-8 w-full rounded-[10px] border border-border-subtle bg-bg-primary/80 px-2.5 text-[12px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/50"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Body</span>
                    <textarea
                      value={draft.body}
                      onChange={(event) => handleDraftFieldChange('body', event.target.value)}
                      aria-label="EmailCaddy draft body"
                      placeholder="Write the message..."
                      className="mt-1 min-h-[220px] w-full resize-y rounded-[12px] border border-border-subtle bg-bg-primary/80 px-3 py-2.5 text-[12px] leading-5 text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/50"
                    />
                  </label>

                  {draftSourceThread && contextRequested && (
                    <div className="rounded-[12px] border border-border-subtle bg-bg-primary/70 p-2.5">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                        Quoted context
                      </div>
                      <div className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap text-[11px] leading-5 text-text-secondary">
                        {quotedThreadBody(draftSourceThread)}
                      </div>
                    </div>
                  )}

                  {draftAttachmentChips.length > 0 && (
                    <div className="rounded-[12px] border border-border-subtle bg-bg-primary/70 p-2.5">
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                        <Paperclip size={12} />
                        External attachments
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {draftAttachmentChips.map((attachment) => (
                          <span key={attachment} className="rounded-full border border-border-subtle bg-bg-raised/70 px-2 py-1 text-[11px] text-text-secondary">
                            {attachment}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {draftNotice && (
                    <div className="rounded-[12px] border border-accent/15 bg-accent/5 px-3 py-2 text-[12px] leading-5 text-text-secondary">
                      {draftNotice}
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </WorkspacePanel>
        )}

        {compactPanel && contextRequested && contextPanel.panel.mode !== 'docked' && (
          <WorkspacePanel
            id="emailcaddy-message-context"
            title="Context"
            mode={contextPanel.panel.mode}
            geometry={contextPanel.panel.geometry}
            zIndex={contextPanel.panel.zIndex}
            onPanelFocus={contextPanel.focus}
            onRestore={contextPanel.restore}
            onModeChange={handleContextPanelModeChange}
            onGeometryChange={contextPanel.setGeometry}
            floatingAriaLabel="EmailCaddy message context panel"
            resizeLabelBase="message context"
            popOutLabel="Pop out message context"
            dockLabel="Dock message context back into UI"
            minimizeLabel="Minimize message context"
            closeLabel="Close message context workspace panel"
            restoreLabel="Restore message context panel"
            placeholderClassName="hidden"
          >
            {contextPanelContent}
          </WorkspacePanel>
        )}
      </div>
    </section>
  );
});

export const CadEmailWorkspace = EmailCaddyWorkspace;
