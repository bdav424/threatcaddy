import type {
  CatalogEntry,
  IntegrationCatalogCapability,
  IntegrationCatalogGroup,
  IntegrationCatalogGroupId,
  IntegrationCatalogProvider,
  IntegrationCatalogProviderNextAction,
  IntegrationCatalogProviderStatus,
  IntegrationTemplate,
  SlackNotificationPolicy,
} from '../types/integration-types';

const CATALOG_URL = 'https://raw.githubusercontent.com/peterhanily/threatcaddy-integrations/main/catalog.json';
const CACHE_KEY = 'threatcaddy-integration-catalog';
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

interface CachedCatalog {
  entries: CatalogEntry[];
  fetchedAt: number;
}

const EMAIL_GROUP_ID = 'email' satisfies IntegrationCatalogGroupId;
const MESSAGING_GROUP_ID = 'messaging' satisfies IntegrationCatalogGroupId;
const THREAT_INTEL_GROUP_ID = 'threat-intelligence' satisfies IntegrationCatalogGroupId;
const MALWARE_GROUP_ID = 'malware-analysis-sandbox' satisfies IntegrationCatalogGroupId;
const SIEM_SOAR_GROUP_ID = 'siem-soar' satisfies IntegrationCatalogGroupId;
const MIN_SLACK_CHANNEL_FOLLOW_UPS_PER_HOUR = 0;
const MAX_SLACK_CHANNEL_FOLLOW_UPS_PER_HOUR = 6;

const DEFAULT_SLACK_NOTIFICATION_POLICY: SlackNotificationPolicy = Object.freeze({
  directMentions: true,
  oneToOneDms: false,
  groupDms: false,
  threadRepliesAfterUserPosts: true,
  channelFollowUps: false,
  noiseControls: Object.freeze({
    quietHoursEnabled: true,
    batchChannelFollowUps: true,
    maxChannelFollowUpsPerHour: 3,
    suppressDuplicateThreadReplies: true,
    requireExplicitCaseMentionForChannels: true,
  }),
});

const ROUTE_ONLY_GATED_REASON =
  'This route is local setup guidance only and does not indicate a live provider connection.';

const BUILTIN_TEMPLATE_DISABLED_REASON =
  'This metadata points to built-in template availability only. It does not configure credentials or prove a live provider connection.';

const FUTURE_CONNECTOR_DISABLED_REASON =
  'Connector work is not implemented in this build. This card remains catalog metadata only.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ownValue(source: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(source, key) ? source[key] : undefined;
}

function ownBooleanOrDefault(source: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = ownValue(source, key);
  return typeof value === 'boolean' ? value : fallback;
}

function ownExplicitTrue(source: Record<string, unknown>, key: string): boolean {
  return ownValue(source, key) === true;
}

function clampSlackChannelFollowUpsPerHour(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_SLACK_NOTIFICATION_POLICY.noiseControls.maxChannelFollowUpsPerHour;
  }
  return Math.min(
    MAX_SLACK_CHANNEL_FOLLOW_UPS_PER_HOUR,
    Math.max(MIN_SLACK_CHANNEL_FOLLOW_UPS_PER_HOUR, Math.trunc(value)),
  );
}

export function sanitizeSlackNotificationPolicy(input?: unknown): SlackNotificationPolicy {
  const source = isRecord(input) ? input : {};
  const rawNoiseControls = ownValue(source, 'noiseControls');
  const noiseControls = isRecord(rawNoiseControls) ? rawNoiseControls : {};
  const defaultNoiseControls = DEFAULT_SLACK_NOTIFICATION_POLICY.noiseControls;

  return {
    directMentions: ownBooleanOrDefault(source, 'directMentions', DEFAULT_SLACK_NOTIFICATION_POLICY.directMentions),
    oneToOneDms: ownExplicitTrue(source, 'oneToOneDms'),
    groupDms: ownExplicitTrue(source, 'groupDms'),
    threadRepliesAfterUserPosts: ownBooleanOrDefault(
      source,
      'threadRepliesAfterUserPosts',
      DEFAULT_SLACK_NOTIFICATION_POLICY.threadRepliesAfterUserPosts,
    ),
    channelFollowUps: ownExplicitTrue(source, 'channelFollowUps'),
    noiseControls: {
      quietHoursEnabled: ownBooleanOrDefault(noiseControls, 'quietHoursEnabled', defaultNoiseControls.quietHoursEnabled),
      batchChannelFollowUps: ownBooleanOrDefault(
        noiseControls,
        'batchChannelFollowUps',
        defaultNoiseControls.batchChannelFollowUps,
      ),
      maxChannelFollowUpsPerHour: clampSlackChannelFollowUpsPerHour(ownValue(noiseControls, 'maxChannelFollowUpsPerHour')),
      suppressDuplicateThreadReplies: ownBooleanOrDefault(
        noiseControls,
        'suppressDuplicateThreadReplies',
        defaultNoiseControls.suppressDuplicateThreadReplies,
      ),
      requireExplicitCaseMentionForChannels: ownBooleanOrDefault(
        noiseControls,
        'requireExplicitCaseMentionForChannels',
        defaultNoiseControls.requireExplicitCaseMentionForChannels,
      ),
    },
  };
}

function routeOnlyNextAction(label: string, targetId: string): IntegrationCatalogProviderNextAction {
  return {
    kind: 'route-only',
    label,
    targetSurface: 'assistantcaddy-route',
    targetId,
    gatedReason: ROUTE_ONLY_GATED_REASON,
  };
}

function builtinTemplateNextAction(label: string, targetId: string): IntegrationCatalogProviderNextAction {
  return {
    kind: 'builtin-template',
    label,
    targetSurface: 'integration-template',
    targetId,
    disabledReason: BUILTIN_TEMPLATE_DISABLED_REASON,
  };
}

function futureConnectorNextAction(label: string, targetId: string): IntegrationCatalogProviderNextAction {
  return {
    kind: 'future-connector',
    label,
    targetSurface: 'provider-catalog',
    targetId,
    disabledReason: FUTURE_CONNECTOR_DISABLED_REASON,
  };
}

function provider({
  id,
  name,
  groupId,
  aliases,
  status = 'catalog-only',
  capabilitySummary,
  capabilities,
  nextAction,
  builtinTemplateIds,
  tags,
}: {
  id: string;
  name: string;
  groupId: IntegrationCatalogGroupId;
  aliases?: string[];
  status?: IntegrationCatalogProviderStatus;
  capabilitySummary: string;
  capabilities?: Array<string | IntegrationCatalogCapability>;
  nextAction?: IntegrationCatalogProviderNextAction;
  builtinTemplateIds?: string[];
  tags?: string[];
}): IntegrationCatalogProvider {
  const defaultCapabilityStatus = status === 'builtin-template' ? 'supported' : status;
  return {
    id,
    name,
    groupId,
    aliases,
    status,
    configurationStatus: 'not-configured',
    capabilitySummary,
    capabilities: (capabilities ?? [capabilitySummary]).map((capability) => {
      if (typeof capability !== 'string') return capability;
      return {
        id: capability.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        label: capability,
        status: defaultCapabilityStatus,
      };
    }),
    nextAction,
    builtinTemplateIds,
    tags: tags ?? [],
  };
}

export const INTEGRATION_SOURCE_CATALOG: ReadonlyArray<IntegrationCatalogGroup> = Object.freeze([
  {
    id: EMAIL_GROUP_ID,
    label: 'Email',
    description: 'Design-stage mailbox and email-delivery provider options. No credentials are stored by this catalog.',
    providers: [
      provider({
        id: 'gmail-google',
        name: 'Gmail / Google Workspace',
        groupId: EMAIL_GROUP_ID,
        status: 'design-only',
        capabilitySummary: 'Provider selection and future mailbox onboarding placeholder.',
        capabilities: ['Provider selection card', 'Future OAuth onboarding placeholder'],
        nextAction: routeOnlyNextAction('Open Gmail / Google Workspace setup route', 'assistantcaddy-email-setup'),
        tags: ['email', 'google', 'gmail'],
      }),
      provider({
        id: 'outlook-microsoft',
        name: 'Outlook / Microsoft 365',
        groupId: EMAIL_GROUP_ID,
        status: 'design-only',
        capabilitySummary: 'Provider selection and future mailbox onboarding placeholder.',
        capabilities: ['Provider selection card', 'Future OAuth onboarding placeholder'],
        nextAction: routeOnlyNextAction('Open Outlook / Microsoft 365 setup route', 'assistantcaddy-email-setup'),
        tags: ['email', 'microsoft', 'outlook'],
      }),
      provider({
        id: 'proton-mail',
        name: 'Proton Mail',
        groupId: EMAIL_GROUP_ID,
        status: 'design-only',
        capabilitySummary: 'Provider selection and future mailbox onboarding placeholder.',
        capabilities: ['Provider selection card', 'Future bridge/import onboarding placeholder'],
        nextAction: routeOnlyNextAction('Open Proton Mail setup route', 'assistantcaddy-email-setup'),
        tags: ['email', 'proton'],
      }),
      provider({
        id: 'generic-imap-smtp',
        name: 'Generic IMAP / SMTP',
        groupId: EMAIL_GROUP_ID,
        status: 'design-only',
        capabilitySummary: 'Generic mailbox configuration placeholder with no credential storage.',
        capabilities: ['Provider selection card', 'Future manual server settings placeholder'],
        nextAction: routeOnlyNextAction('Open generic IMAP / SMTP setup route', 'assistantcaddy-email-setup'),
        tags: ['email', 'imap', 'smtp'],
      }),
    ],
  },
  {
    id: MESSAGING_GROUP_ID,
    label: 'Messaging',
    description: 'Notification and collaboration surfaces. Slack policy is local design metadata only.',
    providers: [
      provider({
        id: 'slack',
        name: 'Slack',
        groupId: MESSAGING_GROUP_ID,
        status: 'builtin-template',
        capabilitySummary: 'Incoming webhook notification template exists; mention/DM/thread policy is design-only.',
        capabilities: [
          {
            id: 'incoming-webhook-channel-notification',
            label: 'Incoming webhook channel notification',
            status: 'supported',
            note: 'Backed by the built-in slack-webhook-notify template.',
          },
          { id: 'direct-mentions-policy', label: 'Direct mentions policy', status: 'design-only' },
          { id: 'one-to-one-dm-policy', label: 'One-to-one DM policy', status: 'design-only' },
          { id: 'group-dm-policy', label: 'Group DM policy', status: 'design-only' },
          { id: 'thread-replies-after-user-posts-policy', label: 'Thread replies after user posts policy', status: 'design-only' },
          { id: 'channel-follow-up-noise-controls', label: 'Channel follow-up noise controls', status: 'design-only' },
        ],
        nextAction: builtinTemplateNextAction('Review Slack built-in notification template', 'slack'),
        builtinTemplateIds: ['slack-webhook-notify'],
        tags: ['messaging', 'notification', 'slack', 'webhook'],
      }),
      provider({
        id: 'microsoft-teams',
        name: 'Microsoft Teams',
        groupId: MESSAGING_GROUP_ID,
        capabilitySummary: 'Catalog-only messaging provider for future notification templates.',
        nextAction: futureConnectorNextAction('Track future Microsoft Teams connector work', 'microsoft-teams'),
        tags: ['messaging', 'notification', 'microsoft'],
      }),
      provider({
        id: 'discord',
        name: 'Discord',
        groupId: MESSAGING_GROUP_ID,
        capabilitySummary: 'Catalog-only messaging provider for future notification templates.',
        nextAction: futureConnectorNextAction('Track future Discord connector work', 'discord'),
        tags: ['messaging', 'notification'],
      }),
      provider({
        id: 'mattermost',
        name: 'Mattermost',
        groupId: MESSAGING_GROUP_ID,
        capabilitySummary: 'Catalog-only messaging provider for future notification templates.',
        nextAction: futureConnectorNextAction('Track future Mattermost connector work', 'mattermost'),
        tags: ['messaging', 'notification'],
      }),
      provider({
        id: 'generic-webhook',
        name: 'Generic webhook',
        groupId: MESSAGING_GROUP_ID,
        capabilitySummary: 'Catalog-only outbound webhook option for future notification templates.',
        nextAction: futureConnectorNextAction('Track future generic webhook connector work', 'generic-webhook'),
        tags: ['messaging', 'notification', 'webhook'],
      }),
    ],
  },
  {
    id: THREAT_INTEL_GROUP_ID,
    label: 'Threat Intelligence',
    description: 'Threat intelligence enrichment, feeds, reputation, infrastructure, and sharing sources.',
    providers: [
      provider({
        id: 'team-cymru-pure-signal-scout',
        name: 'Team Cymru / Pure Signal / Scout',
        groupId: THREAT_INTEL_GROUP_ID,
        aliases: ['Team Cymru', 'Pure Signal', 'Scout'],
        capabilitySummary: 'Catalog-only Cymru enrichment and telemetry source placeholder.',
        nextAction: futureConnectorNextAction('Track future Team Cymru / Pure Signal / Scout connector work', 'team-cymru-pure-signal-scout'),
        tags: ['threat-intelligence', 'cymru', 'netflow', 'asn'],
      }),
      provider({ id: 'misp', name: 'MISP', groupId: THREAT_INTEL_GROUP_ID, capabilitySummary: 'Catalog-only MISP sharing and event source placeholder.', nextAction: futureConnectorNextAction('Track future MISP connector work', 'misp'), tags: ['threat-intelligence', 'sharing', 'misp'] }),
      provider({ id: 'opencti', name: 'OpenCTI', groupId: THREAT_INTEL_GROUP_ID, capabilitySummary: 'Catalog-only OpenCTI source placeholder.', nextAction: futureConnectorNextAction('Track future OpenCTI connector work', 'opencti'), tags: ['threat-intelligence', 'cti'] }),
      provider({ id: 'virustotal', name: 'VirusTotal', groupId: THREAT_INTEL_GROUP_ID, status: 'builtin-template', capabilitySummary: 'Built-in IOC enrichment templates exist for IP, domain, and hash lookups.', nextAction: builtinTemplateNextAction('Review VirusTotal built-in templates', 'virustotal'), builtinTemplateIds: ['vt-ip-lookup', 'vt-domain-lookup', 'vt-hash-lookup'], tags: ['threat-intelligence', 'reputation', 'virustotal'] }),
      provider({ id: 'abuseipdb', name: 'AbuseIPDB', groupId: THREAT_INTEL_GROUP_ID, status: 'builtin-template', capabilitySummary: 'Built-in IP abuse reputation template exists.', nextAction: builtinTemplateNextAction('Review AbuseIPDB built-in template', 'abuseipdb'), builtinTemplateIds: ['abuseipdb-check'], tags: ['threat-intelligence', 'abuseipdb', 'ip'] }),
      provider({ id: 'greynoise', name: 'GreyNoise', groupId: THREAT_INTEL_GROUP_ID, status: 'builtin-template', capabilitySummary: 'Built-in GreyNoise community IP context template exists.', nextAction: builtinTemplateNextAction('Review GreyNoise built-in template', 'greynoise'), builtinTemplateIds: ['greynoise-community'], tags: ['threat-intelligence', 'greynoise', 'ip'] }),
      provider({ id: 'shodan', name: 'Shodan', groupId: THREAT_INTEL_GROUP_ID, status: 'builtin-template', capabilitySummary: 'Built-in Shodan host and InternetDB templates exist.', nextAction: builtinTemplateNextAction('Review Shodan built-in templates', 'shodan'), builtinTemplateIds: ['shodan-host-info', 'shodan-internetdb'], tags: ['threat-intelligence', 'shodan', 'infrastructure'] }),
      provider({ id: 'censys', name: 'Censys', groupId: THREAT_INTEL_GROUP_ID, status: 'builtin-template', capabilitySummary: 'Built-in Censys host lookup template exists.', nextAction: builtinTemplateNextAction('Review Censys built-in template', 'censys'), builtinTemplateIds: ['censys-host-lookup'], tags: ['threat-intelligence', 'censys', 'infrastructure'] }),
      provider({ id: 'alienvault-otx', name: 'AlienVault OTX', groupId: THREAT_INTEL_GROUP_ID, status: 'builtin-template', capabilitySummary: 'Built-in OTX IP, domain, and hash pulse/reputation lookups.', nextAction: builtinTemplateNextAction('Review AlienVault OTX built-in templates', 'alienvault-otx'), builtinTemplateIds: ['otx-ip-lookup', 'otx-domain-lookup', 'otx-hash-lookup'], tags: ['threat-intelligence', 'otx'] }),
      provider({ id: 'recorded-future', name: 'Recorded Future', groupId: THREAT_INTEL_GROUP_ID, capabilitySummary: 'Catalog-only Recorded Future source placeholder.', nextAction: futureConnectorNextAction('Track future Recorded Future connector work', 'recorded-future'), tags: ['threat-intelligence', 'recorded-future'] }),
      provider({ id: 'flashpoint', name: 'Flashpoint', groupId: THREAT_INTEL_GROUP_ID, status: 'builtin-template', capabilitySummary: 'Built-in Flashpoint indicator lookup template exists.', nextAction: builtinTemplateNextAction('Review Flashpoint built-in template', 'flashpoint'), builtinTemplateIds: ['flashpoint-indicator-lookup'], tags: ['threat-intelligence', 'flashpoint'] }),
      provider({ id: 'anomali-threatstream', name: 'Anomali ThreatStream', groupId: THREAT_INTEL_GROUP_ID, capabilitySummary: 'Catalog-only ThreatStream source placeholder.', nextAction: futureConnectorNextAction('Track future Anomali ThreatStream connector work', 'anomali-threatstream'), tags: ['threat-intelligence', 'anomali'] }),
      provider({ id: 'threatconnect', name: 'ThreatConnect', groupId: THREAT_INTEL_GROUP_ID, capabilitySummary: 'Catalog-only ThreatConnect source placeholder.', nextAction: futureConnectorNextAction('Track future ThreatConnect connector work', 'threatconnect'), tags: ['threat-intelligence', 'threatconnect'] }),
      provider({ id: 'threatquotient', name: 'ThreatQuotient', groupId: THREAT_INTEL_GROUP_ID, capabilitySummary: 'Catalog-only ThreatQ source placeholder.', nextAction: futureConnectorNextAction('Track future ThreatQuotient connector work', 'threatquotient'), tags: ['threat-intelligence', 'threatquotient'] }),
      provider({ id: 'cyware', name: 'Cyware', groupId: THREAT_INTEL_GROUP_ID, capabilitySummary: 'Catalog-only Cyware source placeholder.', nextAction: futureConnectorNextAction('Track future Cyware connector work', 'cyware'), tags: ['threat-intelligence', 'cyware'] }),
      provider({ id: 'urlscan', name: 'urlscan.io', groupId: THREAT_INTEL_GROUP_ID, status: 'builtin-template', capabilitySummary: 'Built-in URL/domain reputation lookup via urlscan.io search.', nextAction: builtinTemplateNextAction('Review urlscan.io built-in template', 'urlscan'), builtinTemplateIds: ['urlscan-search'], tags: ['threat-intelligence', 'urlscan', 'url'] }),
      provider({ id: 'urlhaus-malwarebazaar', name: 'URLhaus / MalwareBazaar', groupId: THREAT_INTEL_GROUP_ID, status: 'builtin-template', capabilitySummary: 'Built-in URLhaus URL/domain and MalwareBazaar hash templates exist.', nextAction: builtinTemplateNextAction('Review URLhaus / MalwareBazaar built-in templates', 'urlhaus-malwarebazaar'), builtinTemplateIds: ['urlhaus-lookup', 'urlhaus-domain-lookup', 'malwarebazaar-lookup'], tags: ['threat-intelligence', 'abuse-ch', 'urlhaus', 'malwarebazaar'] }),
      provider({ id: 'generic-taxii-stix', name: 'Generic TAXII / STIX', groupId: THREAT_INTEL_GROUP_ID, capabilitySummary: 'Catalog-only standards-based TAXII/STIX source placeholder.', nextAction: futureConnectorNextAction('Track future generic TAXII / STIX connector work', 'generic-taxii-stix'), tags: ['threat-intelligence', 'taxii', 'stix'] }),
    ],
  },
  {
    id: MALWARE_GROUP_ID,
    label: 'Malware Analysis / Sandbox',
    description: 'Malware analysis and detonation providers. Entries are catalog-only unless a template is added later.',
    providers: [
      provider({ id: 'hybrid-analysis', name: 'Hybrid Analysis', groupId: MALWARE_GROUP_ID, capabilitySummary: 'Catalog-only sandbox lookup placeholder.', nextAction: futureConnectorNextAction('Track future Hybrid Analysis connector work', 'hybrid-analysis'), tags: ['malware', 'sandbox'] }),
      provider({ id: 'any-run', name: 'ANY.RUN', groupId: MALWARE_GROUP_ID, capabilitySummary: 'Catalog-only sandbox lookup placeholder.', nextAction: futureConnectorNextAction('Track future ANY.RUN connector work', 'any-run'), tags: ['malware', 'sandbox'] }),
      provider({ id: 'joe-sandbox', name: 'Joe Sandbox', groupId: MALWARE_GROUP_ID, capabilitySummary: 'Catalog-only sandbox lookup placeholder.', nextAction: futureConnectorNextAction('Track future Joe Sandbox connector work', 'joe-sandbox'), tags: ['malware', 'sandbox'] }),
      provider({ id: 'intezer', name: 'Intezer', groupId: MALWARE_GROUP_ID, capabilitySummary: 'Catalog-only malware analysis placeholder.', nextAction: futureConnectorNextAction('Track future Intezer connector work', 'intezer'), tags: ['malware', 'analysis'] }),
      provider({ id: 'cape-cuckoo', name: 'CAPE / Cuckoo', groupId: MALWARE_GROUP_ID, capabilitySummary: 'Catalog-only self-hosted sandbox placeholder.', nextAction: futureConnectorNextAction('Track future CAPE / Cuckoo connector work', 'cape-cuckoo'), tags: ['malware', 'sandbox', 'self-hosted'] }),
    ],
  },
  {
    id: SIEM_SOAR_GROUP_ID,
    label: 'SIEM / SOAR',
    description: 'SIEM and SOAR destinations for future alert, case, and playbook workflows.',
    providers: [
      provider({ id: 'microsoft-sentinel', name: 'Microsoft Sentinel', groupId: SIEM_SOAR_GROUP_ID, capabilitySummary: 'Catalog-only SIEM/SOAR destination placeholder.', nextAction: futureConnectorNextAction('Track future Microsoft Sentinel connector work', 'microsoft-sentinel'), tags: ['siem', 'soar', 'microsoft'] }),
      provider({ id: 'splunk', name: 'Splunk', groupId: SIEM_SOAR_GROUP_ID, capabilitySummary: 'Catalog-only SIEM destination placeholder.', nextAction: futureConnectorNextAction('Track future Splunk connector work', 'splunk'), tags: ['siem'] }),
      provider({ id: 'elastic', name: 'Elastic', groupId: SIEM_SOAR_GROUP_ID, capabilitySummary: 'Catalog-only SIEM destination placeholder.', nextAction: futureConnectorNextAction('Track future Elastic connector work', 'elastic'), tags: ['siem'] }),
      provider({ id: 'google-secops-chronicle', name: 'Google SecOps / Chronicle', groupId: SIEM_SOAR_GROUP_ID, aliases: ['Google SecOps', 'Chronicle'], capabilitySummary: 'Catalog-only SIEM destination placeholder.', nextAction: futureConnectorNextAction('Track future Google SecOps / Chronicle connector work', 'google-secops-chronicle'), tags: ['siem', 'google', 'chronicle'] }),
      provider({ id: 'qradar', name: 'QRadar', groupId: SIEM_SOAR_GROUP_ID, capabilitySummary: 'Catalog-only SIEM destination placeholder.', nextAction: futureConnectorNextAction('Track future QRadar connector work', 'qradar'), tags: ['siem'] }),
      provider({ id: 'cortex-xsoar', name: 'Cortex XSOAR', groupId: SIEM_SOAR_GROUP_ID, capabilitySummary: 'Catalog-only SOAR destination placeholder.', nextAction: futureConnectorNextAction('Track future Cortex XSOAR connector work', 'cortex-xsoar'), tags: ['soar'] }),
      provider({ id: 'thehive-cortex', name: 'TheHive / Cortex', groupId: SIEM_SOAR_GROUP_ID, capabilitySummary: 'Catalog-only case/SOAR destination placeholder.', nextAction: futureConnectorNextAction('Track future TheHive / Cortex connector work', 'thehive-cortex'), tags: ['soar', 'case-management'] }),
      provider({ id: 'shuffle', name: 'Shuffle', groupId: SIEM_SOAR_GROUP_ID, capabilitySummary: 'Catalog-only SOAR destination placeholder.', nextAction: futureConnectorNextAction('Track future Shuffle connector work', 'shuffle'), tags: ['soar'] }),
      provider({ id: 'tines', name: 'Tines', groupId: SIEM_SOAR_GROUP_ID, capabilitySummary: 'Catalog-only SOAR destination placeholder.', nextAction: futureConnectorNextAction('Track future Tines connector work', 'tines'), tags: ['soar'] }),
      provider({ id: 'torq', name: 'Torq', groupId: SIEM_SOAR_GROUP_ID, capabilitySummary: 'Catalog-only SOAR destination placeholder.', nextAction: futureConnectorNextAction('Track future Torq connector work', 'torq'), tags: ['soar'] }),
      provider({ id: 'servicenow-secops', name: 'ServiceNow SecOps', groupId: SIEM_SOAR_GROUP_ID, capabilitySummary: 'Catalog-only SecOps case destination placeholder.', nextAction: futureConnectorNextAction('Track future ServiceNow SecOps connector work', 'servicenow-secops'), tags: ['soar', 'case-management', 'servicenow'] }),
    ],
  },
]);

export function getIntegrationSourceCatalogGroups(): IntegrationCatalogGroup[] {
  return INTEGRATION_SOURCE_CATALOG.map((group) => ({
    ...group,
    providers: group.providers.map((entry) => ({
      ...entry,
      capabilities: entry.capabilities.map((capability) => ({ ...capability })),
      nextAction: entry.nextAction ? { ...entry.nextAction } : undefined,
    })),
  }));
}

export function getIntegrationCatalogProviders(): IntegrationCatalogProvider[] {
  return getIntegrationSourceCatalogGroups().flatMap((group) => group.providers);
}

export function getIntegrationCatalogProvider(id: string): IntegrationCatalogProvider | undefined {
  return getIntegrationCatalogProviders().find((entry) => entry.id === id);
}

export function getDefaultSlackNotificationPolicy(): SlackNotificationPolicy {
  return sanitizeSlackNotificationPolicy();
}

export function getCachedCatalog(): CatalogEntry[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedCatalog = JSON.parse(raw);
    if (Date.now() - cached.fetchedAt > CACHE_TTL) return null;
    return cached.entries;
  } catch {
    return null;
  }
}

export function clearCatalogCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

export async function fetchCatalog(): Promise<CatalogEntry[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const resp = await fetch(CATALOG_URL, { cache: 'no-cache', signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const entries: CatalogEntry[] = data.entries ?? [];

    // Cache in localStorage
    const cached: CachedCatalog = { entries, fetchedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));

    return entries;
  } catch {
    // On network error, return cached version or empty array
    const cached = getCachedCatalog();
    return cached ?? [];
  }
}

export async function fetchTemplate(entry: CatalogEntry): Promise<IntegrationTemplate> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  const resp = await fetch(entry.templateUrl, { signal: controller.signal }).finally(() => clearTimeout(timer));
  if (!resp.ok) throw new Error(`Failed to fetch template: HTTP ${resp.status}`);
  const body = await resp.text();

  // Verify SHA-256 integrity when the catalog entry declares a hash
  if (entry.sha256) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    if (hashHex !== entry.sha256.toLowerCase()) {
      throw new Error(
        `Template integrity check failed: expected SHA-256 ${entry.sha256}, got ${hashHex}`,
      );
    }
  }

  const template: IntegrationTemplate = JSON.parse(body);

  // Validate required fields
  if (!template.id || !template.name || !template.steps) {
    throw new Error('Invalid template: missing required fields (id, name, steps)');
  }

  return template;
}
