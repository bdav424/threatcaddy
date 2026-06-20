import { useEffect, useId, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  Filter,
  FlaskConical,
  GitBranch,
  Mail,
  MessageSquare,
  Play,
  Search,
  Server,
  Shield,
  Sparkles,
  Settings2,
  Workflow,
} from 'lucide-react';
import { Modal } from '../Common/Modal';
import { ToolbarSelect } from '../Common/ToolbarSelect';
import {
  resolveConnectorActivationActionPlan,
  type ConnectorActivationActionPlan,
} from '../../lib/connector-activation-action-plan';
import { createConnectorRuntimeUiWiringPlan } from '../../lib/connector-runtime-ui-wiring-plan';
import { getIntegrationSourceCatalogGroups } from '../../lib/integration-catalog';
import type {
  IntegrationCatalogCapability,
  IntegrationCatalogConfigurationStatus,
  IntegrationCatalogGroupId,
  IntegrationCatalogProviderStatus,
} from '../../types/integration-types';

type SourceGroupId = IntegrationCatalogGroupId;
type SourceStatusLabel = 'Built-in template' | 'Catalog only' | 'Design only';
type ProviderStatus = 'Not configured' | SourceStatusLabel;

export interface IntegrationSourceProvider {
  id: string;
  name: string;
  aliases: string[];
  sourceStatus: IntegrationCatalogProviderStatus;
  sourceStatusLabel: SourceStatusLabel;
  configurationStatus: IntegrationCatalogConfigurationStatus;
  configurationStatusLabel: 'Not configured';
  capabilities: IntegrationCatalogCapability[];
  tags: string[];
  builtinTemplateIds: string[];
  summary: string;
  details: string;
  actionPlan: ConnectorActivationActionPlan;
}

export interface IntegrationSourceGroup {
  id: SourceGroupId;
  title: string;
  description: string;
  icon: typeof Mail;
  providers: IntegrationSourceProvider[];
}

const STATUS_OPTIONS: Array<{ value: ProviderStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'Not configured', label: 'Not configured' },
  { value: 'Built-in template', label: 'Built-in template' },
  { value: 'Catalog only', label: 'Catalog only' },
  { value: 'Design only', label: 'Design only' },
];

const GROUP_OPTIONS: Array<{ value: SourceGroupId | 'all'; label: string }> = [
  { value: 'all', label: 'All source types' },
  { value: 'email', label: 'Email' },
  { value: 'messaging', label: 'Messaging' },
  { value: 'threat-intelligence', label: 'Threat Intelligence' },
  { value: 'malware-analysis-sandbox', label: 'Malware Analysis / Sandbox' },
  { value: 'siem-soar', label: 'SIEM / SOAR' },
];

const GROUP_ICON_BY_ID: Record<SourceGroupId, typeof Mail> = {
  email: Mail,
  messaging: MessageSquare,
  'threat-intelligence': Shield,
  'malware-analysis-sandbox': FlaskConical,
  'siem-soar': Server,
};

const SOURCE_STATUS_LABELS: Record<IntegrationCatalogProviderStatus, SourceStatusLabel> = {
  'builtin-template': 'Built-in template',
  'catalog-only': 'Catalog only',
  'design-only': 'Design only',
};

const CONFIGURATION_STATUS_LABELS: Record<IntegrationCatalogConfigurationStatus, 'Not configured'> = {
  'not-configured': 'Not configured',
};

const INTEGRATIONS_RUNTIME_UI_WIRING_PLAN = createConnectorRuntimeUiWiringPlan({
  expectedOwnerSurface: 'integrations',
});

function buildProviderDetails(provider: {
  aliases?: string[];
  builtinTemplateIds?: string[];
  capabilitySummary: string;
}, actionPlan: ConnectorActivationActionPlan): string {
  const detailParts = [
    provider.builtinTemplateIds?.length
      ? `Templates: ${provider.builtinTemplateIds.join(', ')}.`
      : undefined,
    provider.aliases?.length ? `Aliases: ${provider.aliases.join(', ')}.` : undefined,
    actionPlan.actionKind === 'route-descriptor'
      ? 'Setup opens from its dedicated route.'
      : undefined,
    actionPlan.targetSurface === 'provider-catalog'
      ? 'No setup action is available yet.'
      : undefined,
  ];
  return detailParts.filter(Boolean).join(' ') || provider.capabilitySummary;
}

function buildIntegrationSourceGroups(): IntegrationSourceGroup[] {
  return getIntegrationSourceCatalogGroups().map((group) => ({
    id: group.id,
    title: group.label,
    description: group.description,
    icon: GROUP_ICON_BY_ID[group.id],
    providers: group.providers.map((provider) => {
      const actionPlan = resolveConnectorActivationActionPlan({ provider });
      return {
        id: provider.id,
        name: provider.name,
        aliases: provider.aliases ?? [],
        sourceStatus: provider.status,
        sourceStatusLabel: SOURCE_STATUS_LABELS[provider.status],
        configurationStatus: provider.configurationStatus,
        configurationStatusLabel: CONFIGURATION_STATUS_LABELS[provider.configurationStatus],
        capabilities: provider.capabilities,
        tags: provider.tags,
        builtinTemplateIds: provider.builtinTemplateIds ?? [],
        summary: provider.capabilitySummary,
        details: buildProviderDetails(provider, actionPlan),
        actionPlan,
      };
    }).sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

function actionGuidanceLabel(actionPlan: ConnectorActivationActionPlan): string {
  if (actionPlan.actionKind === 'route-descriptor') return 'Catalog route guidance';
  if (actionPlan.actionKind === 'test-plan-descriptor' || actionPlan.targetSurface === 'provider-catalog') {
    return 'Future connector test plan';
  }
  if (actionPlan.targetSurface === 'integration-template') return 'Catalog template guidance';
  return 'Disabled action descriptor';
}

function actionGuidanceText(actionPlan: ConnectorActivationActionPlan): string {
  if (actionPlan.actionKind === 'route-descriptor') {
    return 'Dedicated setup route.';
  }
  if (actionPlan.actionKind === 'test-plan-descriptor') {
    return 'Manual test metadata.';
  }
  if (actionPlan.targetSurface === 'integration-template') {
    return 'Built-in template metadata.';
  }
  if (actionPlan.targetSurface === 'provider-catalog') {
    return 'No setup action.';
  }
  return 'No action.';
}

function actionTargetLabel(actionPlan: ConnectorActivationActionPlan): string {
  if (!actionPlan.targetId) return 'No target';
  return `${actionPlan.targetSurface}:${actionPlan.targetId}`;
}

function actionGateLabel(actionPlan: ConnectorActivationActionPlan): string {
  if (actionPlan.blockers.length > 0) return 'Activation blocked by local gate';
  return 'Activation facts present, descriptor remains inert';
}

function SlackConnectorWorkflowModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [workspace, setWorkspace] = useState('team-incident-response');
  const [targetKind, setTargetKind] = useState<'channel' | 'dm' | 'thread'>('channel');
  const [action, setAction] = useState('start with notifications');
  const [stage, setStage] = useState<'discover' | 'prepare' | 'handoff'>('discover');

  useEffect(() => {
    if (!open) return;
    setWorkspace('team-incident-response');
    setTargetKind('channel');
    setAction('start with notifications');
    setStage('discover');
  }, [open]);

  const scopeLabel =
    targetKind === 'channel' ? 'Slack channel' : targetKind === 'dm' ? 'direct message' : 'thread reply';
  const currentStep = stage === 'discover' ? 1 : stage === 'prepare' ? 2 : 3;
  const readinessState = workspace.trim() ? 'Ready to stage' : 'Select a workspace to continue';

  return (
    <Modal open={open} onClose={onClose} title="Slack workflow starter" wide extraWide>
      <div className="space-y-5 text-sm text-text-primary">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { step: 1, title: 'Start', detail: 'Open from the Slack catalog card or menu.' },
            { step: 2, title: 'Prepare', detail: 'Choose workspace, target, and action scope.' },
            { step: 3, title: 'Hand off', detail: 'Pass the staged plan into the existing Slack readiness path.' },
          ].map((item) => (
            <div
              key={item.step}
              className={`rounded-xl border p-3 transition-colors ${
                currentStep >= item.step
                  ? 'border-accent/40 bg-bg-active/50'
                  : 'border-border-subtle bg-bg-primary/50'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-current/20 text-[11px]">
                  {item.step}
                </span>
                {item.title}
              </div>
              <p className="mt-2 text-xs leading-5 text-text-secondary">{item.detail}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4 rounded-xl border border-border-subtle bg-bg-primary/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-text-primary">Slack startup workflow</h4>
                <p className="mt-1 text-xs leading-5 text-text-tertiary">
                  Reuse the existing Slack foundations to start a staged workflow from menus without executing any live connector action.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[11px] font-medium text-emerald-300">
                <BadgeCheck size={12} />
                Inert by default
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-text-secondary">Workspace</span>
                <input
                  value={workspace}
                  onChange={(event) => setWorkspace(event.target.value)}
                  className="h-9 w-full rounded-[10px] border border-border-subtle bg-bg-primary/80 px-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-accent/50"
                  placeholder="team-incident-response"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-text-secondary">Action</span>
                <input
                  value={action}
                  onChange={(event) => setAction(event.target.value)}
                  className="h-9 w-full rounded-[10px] border border-border-subtle bg-bg-primary/80 px-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-accent/50"
                  placeholder="start with notifications"
                />
              </label>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              {[
                { value: 'channel', label: 'Channel' },
                { value: 'dm', label: 'DM' },
                { value: 'thread', label: 'Thread' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTargetKind(option.value as typeof targetKind)}
                  className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                    targetKind === option.value
                      ? 'border-accent/50 bg-bg-active text-text-primary'
                      : 'border-border-subtle bg-bg-primary/60 text-text-secondary hover:border-border-medium hover:text-text-primary'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare size={14} className="text-accent" />
                    {option.label}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-text-tertiary">
                    Stage a {option.label.toLowerCase()} delivery path.
                  </p>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStage('discover')}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  stage === 'discover'
                    ? 'border-accent/50 bg-bg-active text-text-primary'
                    : 'border-border-subtle bg-bg-primary/60 text-text-secondary hover:text-text-primary'
                }`}
              >
                <Sparkles size={12} />
                Discover
              </button>
              <button
                type="button"
                onClick={() => setStage('prepare')}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  stage === 'prepare'
                    ? 'border-accent/50 bg-bg-active text-text-primary'
                    : 'border-border-subtle bg-bg-primary/60 text-text-secondary hover:text-text-primary'
                }`}
              >
                <Play size={12} />
                Prepare
              </button>
              <button
                type="button"
                onClick={() => setStage('handoff')}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  stage === 'handoff'
                    ? 'border-accent/50 bg-bg-active text-text-primary'
                    : 'border-border-subtle bg-bg-primary/60 text-text-secondary hover:text-text-primary'
                }`}
              >
                <ArrowRight size={12} />
                Hand off
              </button>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-border-subtle bg-bg-primary/70 p-4">
            <div className="rounded-xl border border-border-subtle bg-bg-raised/70 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                <GitBranch size={13} className="text-accent" />
                GitHub reference shape
              </div>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-text-secondary">
                <li>Login or connect entry point</li>
                <li>Account or workspace selection</li>
                <li>Scope and consent staging</li>
                <li>Error and reconnect affordances</li>
              </ul>
            </div>

            <div className="rounded-xl border border-border-subtle bg-bg-raised/70 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                <Workflow size={13} className="text-accent" />
                Staged plan
              </div>
              <dl className="mt-3 space-y-2 text-xs leading-5">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-text-tertiary">Workspace</dt>
                  <dd className="text-right text-text-primary">{workspace || 'Not selected'}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-text-tertiary">Target</dt>
                  <dd className="text-right text-text-primary">{scopeLabel}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-text-tertiary">Action</dt>
                  <dd className="text-right text-text-primary">{action}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-text-tertiary">Readiness</dt>
                  <dd className="text-right text-emerald-300">{readinessState}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-border-subtle bg-bg-primary/80 p-3 text-xs leading-5 text-text-secondary">
              <div className="flex items-center gap-2 font-semibold text-text-primary">
                <BadgeCheck size={13} className="text-emerald-300" />
                Handoff path
              </div>
              <p className="mt-2">
                The workflow does not execute a live Slack action. It prepares the workspace, target family, and intent so the existing Slack readiness and activation layers can take over.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ProviderCard({
  provider,
  onOpenSettings,
  onOpenSlackWorkflow,
}: {
  provider: IntegrationSourceProvider;
  onOpenSettings?: () => void;
  onOpenSlackWorkflow?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cardTitleId = useId();
  const summaryId = useId();
  const statusId = useId();
  const actionStateId = useId();
  const detailsId = useId();
  const describedBy = [summaryId, statusId, actionStateId, expanded ? detailsId : null].filter(Boolean).join(' ');
  const actionPlan = provider.actionPlan;
  const actionBlocked = actionPlan.blockers.length > 0;
  const visibleCapabilities = provider.capabilities.filter((capability) => !/placeholder/i.test(capability.label));

  return (
    <article
      className="rounded-md border border-border-subtle bg-bg-raised px-3 py-2 transition-colors hover:border-accent/35 hover:bg-bg-hover"
      aria-labelledby={cardTitleId}
      aria-describedby={describedBy}
      data-integration-provider-card="true"
      data-provider-passive-mode="catalog-reference-only"
      data-provider-source-status={provider.sourceStatus}
      data-provider-configuration-status={provider.configurationStatus}
      data-provider-action-kind={actionPlan.actionKind}
      data-provider-action-status={actionPlan.status}
      data-provider-action-enabled={String(actionPlan.enabled)}
      data-provider-action-executable={String(actionPlan.executable)}
      data-provider-action-side-effects={actionPlan.sideEffects}
      data-provider-action-target-surface={actionPlan.targetSurface}
      data-provider-action-target-id={actionPlan.targetId}
      data-provider-activation-blocked={actionBlocked ? 'true' : 'false'}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h4 id={cardTitleId} className="truncate text-sm font-medium leading-5 text-text-primary">
            {provider.name}
          </h4>
          <p id={summaryId} className="sr-only">{provider.summary}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {provider.id === 'slack' && onOpenSlackWorkflow && (
            <button
              type="button"
              onClick={onOpenSlackWorkflow}
              className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
              aria-label="Start Slack workflow"
            >
              <Play size={12} />
            </button>
          )}
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
              aria-label={`Open ${provider.name} integration settings`}
            >
              <Settings2 size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
            aria-expanded={expanded}
            aria-controls={detailsId}
            aria-label={`${expanded ? 'Hide' : 'Show'} ${provider.name} details`}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      </div>

      <div id={statusId} className="sr-only">
        {provider.configurationStatusLabel} - no provider test run. No credential check or live provider probe ran here.
      </div>
      <div id={actionStateId} className="sr-only" data-provider-action-state-panel="true">
        {actionGuidanceLabel(actionPlan)}. {actionGateLabel(actionPlan)}. No live action. Target {actionTargetLabel(actionPlan)}.
        Runtime executable={String(actionPlan.executable)}, sideEffects={actionPlan.sideEffects}.
      </div>

      {expanded && (
        <div
          id={detailsId}
          className="mt-2 border-t border-border-subtle pt-2 text-xs leading-5 text-text-secondary"
        >
          <p>{provider.details}</p>
          {provider.id === 'slack' && onOpenSlackWorkflow && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onOpenSlackWorkflow}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/15"
              >
                <Play size={12} />
                Start Slack workflow
              </button>
              <span className="text-[11px] text-text-tertiary">
                Opens the staged Slack startup modal with workspace, target, and handoff steps.
              </span>
            </div>
          )}
          {visibleCapabilities.length > 0 && (
            <ul className="mt-2 grid gap-1 text-[11px] leading-4 text-text-tertiary" aria-label={`${provider.name} capabilities`}>
              {visibleCapabilities.map((capability) => (
                <li key={capability.id} data-capability-status={capability.status}>
                  {capability.label}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] leading-4 text-text-tertiary">{actionGuidanceText(actionPlan)}</p>
        </div>
      )}
    </article>
  );
}

interface IntegrationSourceDashboardProps {
  onOpenLegacyTools?: () => void;
}

export function IntegrationSourceDashboard({ onOpenLegacyTools }: IntegrationSourceDashboardProps) {
  const [groupFilter, setGroupFilter] = useState<SourceGroupId | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ProviderStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<SourceGroupId>>(() => new Set());
  const [showSlackWorkflow, setShowSlackWorkflow] = useState(false);
  const passiveNoticeId = useId();
  const summaryId = useId();
  const sourceGroups = useMemo(() => buildIntegrationSourceGroups(), []);

  const visibleGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sourceGroups
      .filter((group) => groupFilter === 'all' || group.id === groupFilter)
      .map((group) => ({
        ...group,
        providers: group.providers.filter((provider) => {
          const matchesStatus =
            statusFilter === 'all' ||
            provider.sourceStatusLabel === statusFilter ||
            provider.configurationStatusLabel === statusFilter;
          const haystack = [
            provider.name,
            provider.aliases.join(' '),
            provider.sourceStatusLabel,
            provider.configurationStatusLabel,
            provider.summary,
            provider.details,
            provider.tags.join(' '),
            provider.builtinTemplateIds.join(' '),
            provider.capabilities.map((capability) => `${capability.label} ${capability.status} ${capability.note ?? ''}`).join(' '),
          ].join(' ').toLowerCase();
          return matchesStatus && (!normalizedQuery || haystack.includes(normalizedQuery));
        }),
      }))
      .filter((group) => group.providers.length > 0 || !normalizedQuery);
  }, [groupFilter, query, sourceGroups, statusFilter]);

  const toggleGroup = (groupId: SourceGroupId) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const providerCount = sourceGroups.reduce((count, group) => count + group.providers.length, 0);
  const visibleProviderCount = visibleGroups.reduce((count, group) => count + group.providers.length, 0);

  return (
    <section
      className="space-y-5"
      aria-label="Integrations source catalog"
      aria-describedby={`${passiveNoticeId} ${summaryId}`}
      data-integration-catalog-source="shared-local-catalog"
      data-connector-runtime-ui-wiring="integrations"
      data-connector-runtime-ui-contract={INTEGRATIONS_RUNTIME_UI_WIRING_PLAN.contract}
      data-connector-runtime-ui-executable={String(INTEGRATIONS_RUNTIME_UI_WIRING_PLAN.executable)}
      data-connector-runtime-ui-side-effects={INTEGRATIONS_RUNTIME_UI_WIRING_PLAN.sideEffects}
    >
      <p id={passiveNoticeId} className="sr-only">
        This view is passive. Opening Settings does not connect providers, install tools, test credentials, or expose live connector actions.
      </p>
      <div className="sr-only" data-connector-runtime-ui-hidden-summary="true">
        Connector runtime UI wiring rows are catalog guidance only. Missing adapter, auth, dry-run delivery, local bridge, and persistence facts remain blocked here; this dashboard does not run setup, provider tests, webhooks, local probes, storage, import, or export.
        <span> Runtime wiring status rows: </span>
        <span>
          {INTEGRATIONS_RUNTIME_UI_WIRING_PLAN.rows.map((row) => (
            <span
              key={row.id}
              data-connector-runtime-ui-row={row.id}
              data-connector-runtime-ui-status={row.status}
              data-connector-runtime-ui-owner-surface={row.ownerSurface}
              data-connector-runtime-ui-executable={String(row.executable)}
              data-connector-runtime-ui-side-effects={row.sideEffects}
            >
              {row.label}: {row.status}. {row.kind}. {row.reason}
            </span>
          ))}
        </span>
        <span>Boundary: {INTEGRATIONS_RUNTIME_UI_WIRING_PLAN.sideEffectBoundary}</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Integrations</h3>
        </div>
      </div>

      <section
        className="rounded-lg border border-border-subtle bg-bg-raised/40 p-4"
        aria-label="Slack workflow starter"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <h4 className="text-sm font-semibold text-text-primary">Slack workflow starter</h4>
            <p className="mt-1 text-xs leading-5 text-text-secondary">
              Slack workflow startup lives in Integrations. Start here, stage workspace and target selection, then hand off into the existing readiness path without sending anything automatically.
            </p>
            <p className="mt-2 text-[11px] leading-5 text-text-muted">
              Path: Messaging &gt; Slack. Targets: channel, DM, thread. Mode: staged only.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setGroupFilter('messaging');
                setShowSlackWorkflow(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/15"
            >
              <Play size={12} />
              Open Slack workflow
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_210px_190px]">
        <label className="relative block">
          <span className="sr-only">Search integration providers</span>
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-describedby={passiveNoticeId}
            placeholder="Search providers, aliases, or catalog capabilities"
            className="h-8 w-full rounded-[10px] border border-border-subtle bg-bg-primary/80 ps-9 pe-3 text-[11px] font-medium text-text-primary outline-none transition-colors placeholder:text-text-tertiary hover:border-border-medium focus:border-accent/50"
          />
        </label>
        <ToolbarSelect
          value={groupFilter}
          options={GROUP_OPTIONS}
          onChange={setGroupFilter}
          ariaLabel="Filter integration source type"
          leadingIcon={<Filter size={13} className="shrink-0 text-accent" />}
          buttonDataProps={{ 'data-integrations-toolbar-select': 'source-type' }}
        />
        <ToolbarSelect
          value={statusFilter}
          options={STATUS_OPTIONS}
          onChange={setStatusFilter}
          ariaLabel="Filter integration status"
          leadingIcon={<Filter size={13} className="shrink-0 text-accent" />}
          buttonDataProps={{ 'data-integrations-toolbar-select': 'status' }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-secondary">
        <span id={summaryId} aria-live="polite">
          {visibleProviderCount} visible {pluralize(visibleProviderCount, 'provider', 'providers')} out of {providerCount} total.
        </span>
        {onOpenLegacyTools && (
          <button
            type="button"
            onClick={onOpenLegacyTools}
            aria-describedby={passiveNoticeId}
            className="rounded-md border border-border-subtle bg-bg-primary/70 px-3 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-accent/40 hover:text-text-primary"
          >
            Installed integrations
          </button>
        )}
      </div>

      <div
        className="space-y-4"
        data-testid="integrations-dashboard-grid"
        data-integrations-dashboard-grid="true"
        data-responsive-columns="grid"
      >
        {visibleGroups.map((group) => {
          const Icon = group.icon;
          const collapsed = collapsedGroups.has(group.id);
          return (
            <section
              key={group.id}
              className="min-w-0 border-t border-border-subtle pt-3 first:border-t-0 first:pt-0"
              aria-label={`${group.title} integrations`}
              data-integration-source-group={group.id}
              data-integration-group-collapsed={collapsed ? 'true' : 'false'}
            >
              <div className="flex items-start gap-3">
                <Icon size={16} className="mt-0.5 shrink-0 text-text-tertiary" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-text-primary">{group.title}</h3>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      aria-expanded={!collapsed}
                      aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${group.title} integrations`}
                      className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
                    >
                      {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-text-secondary">{group.description}</p>
                </div>
              </div>

              {!collapsed && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {group.providers.length === 0 ? (
                    <p className="text-xs text-text-secondary md:col-span-2 xl:col-span-3">
                      No providers match the current filter.
                    </p>
                  ) : (
                    group.providers.map((provider) => (
                      <ProviderCard
                        key={provider.id}
                        provider={provider}
                        onOpenSettings={onOpenLegacyTools}
                        onOpenSlackWorkflow={provider.id === 'slack' ? () => setShowSlackWorkflow(true) : undefined}
                      />
                    ))
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <SlackConnectorWorkflowModal open={showSlackWorkflow} onClose={() => setShowSlackWorkflow(false)} />
    </section>
  );
}
