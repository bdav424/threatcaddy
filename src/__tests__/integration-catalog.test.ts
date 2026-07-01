import { describe, expect, it, vi } from 'vitest';
import {
  getDefaultSlackNotificationPolicy,
  getIntegrationCatalogProvider,
  getIntegrationCatalogProviders,
  getIntegrationSourceCatalogGroups,
  sanitizeSlackNotificationPolicy,
} from '../lib/integration-catalog';

const expectedGroups = [
  'Email',
  'Messaging',
  'Threat Intelligence',
  'Malware Analysis / Sandbox',
  'SIEM / SOAR',
];

const expectedProviders = [
  'Slack',
  'Microsoft Teams',
  'Discord',
  'Mattermost',
  'Generic webhook',
  'Team Cymru / Pure Signal / Scout',
  'MISP',
  'OpenCTI',
  'VirusTotal',
  'AbuseIPDB',
  'GreyNoise',
  'Shodan',
  'Censys',
  'AlienVault OTX',
  'Recorded Future',
  'Flashpoint',
  'Anomali ThreatStream',
  'ThreatConnect',
  'ThreatQuotient',
  'Cyware',
  'urlscan.io',
  'URLhaus / MalwareBazaar',
  'Generic TAXII / STIX',
  'Hybrid Analysis',
  'ANY.RUN',
  'Joe Sandbox',
  'Intezer',
  'CAPE / Cuckoo',
  'Microsoft Sentinel',
  'Splunk',
  'Elastic',
  'Google SecOps / Chronicle',
  'QRadar',
  'Cortex XSOAR',
  'TheHive / Cortex',
  'Shuffle',
  'Tines',
  'Torq',
  'ServiceNow SecOps',
];

describe('integration source catalog', () => {
  it('exposes the grouped source catalog needed by onboarding', () => {
    const groups = getIntegrationSourceCatalogGroups();

    expect(groups.map((group) => group.label)).toEqual(expectedGroups);
    for (const group of groups) {
      expect(group.providers.length).toBeGreaterThan(0);
      expect(group.providers.every((provider) => provider.groupId === group.id)).toBe(true);
      expect(group.providers.every((provider) => provider.configurationStatus === 'not-configured')).toBe(true);
    }
  });

  it('includes the requested messaging, threat-intel, malware, and SIEM/SOAR providers', () => {
    const providerNames = getIntegrationCatalogProviders().map((provider) => provider.name);

    for (const providerName of expectedProviders) {
      expect(providerNames).toContain(providerName);
    }
  });

  it('keeps Team Cymru Pure Signal Scout discoverable under expected aliases', () => {
    const cymru = getIntegrationCatalogProvider('team-cymru-pure-signal-scout');

    expect(cymru).toMatchObject({
      name: 'Team Cymru / Pure Signal / Scout',
      status: 'catalog-only',
      configurationStatus: 'not-configured',
    });
    expect(cymru?.aliases).toEqual(expect.arrayContaining(['Team Cymru', 'Pure Signal', 'Scout']));
    expect(cymru?.tags).toEqual(expect.arrayContaining(['cymru', 'netflow', 'asn']));
  });

  it('marks existing built-in templates separately from catalog-only providers', () => {
    expect(getIntegrationCatalogProvider('virustotal')).toMatchObject({
      status: 'builtin-template',
      nextAction: {
        kind: 'builtin-template',
        targetSurface: 'integration-template',
        targetId: 'virustotal',
      },
      builtinTemplateIds: ['vt-ip-lookup', 'vt-domain-lookup', 'vt-hash-lookup'],
      configurationStatus: 'not-configured',
    });
    expect(getIntegrationCatalogProvider('censys')).toMatchObject({
      status: 'builtin-template',
      nextAction: {
        kind: 'builtin-template',
        targetSurface: 'integration-template',
        targetId: 'censys',
      },
      builtinTemplateIds: ['censys-host-lookup'],
    });
    expect(getIntegrationCatalogProvider('recorded-future')).toMatchObject({
      status: 'catalog-only',
      nextAction: {
        kind: 'future-connector',
        targetSurface: 'provider-catalog',
        targetId: 'recorded-future',
      },
      builtinTemplateIds: undefined,
      configurationStatus: 'not-configured',
    });
  });

  it('describes provider-card next actions without implying a live connection', () => {
    expect(getIntegrationCatalogProvider('gmail-google')).toMatchObject({
      status: 'design-only',
      configurationStatus: 'not-configured',
      nextAction: {
        kind: 'route-only',
        label: 'Open Gmail / Google Workspace setup route',
        targetSurface: 'assistantcaddy-route',
        targetId: 'assistantcaddy-email-setup',
        gatedReason: 'This route is local setup guidance only and does not indicate a live provider connection.',
      },
    });

    expect(getIntegrationCatalogProvider('slack')).toMatchObject({
      status: 'builtin-template',
      configurationStatus: 'not-configured',
      nextAction: {
        kind: 'builtin-template',
        label: 'Review Slack built-in notification template',
        targetSurface: 'integration-template',
        targetId: 'slack',
        disabledReason:
          'This metadata points to built-in template availability only. It does not configure credentials or prove a live provider connection.',
      },
    });

    expect(getIntegrationCatalogProvider('microsoft-sentinel')).toMatchObject({
      status: 'catalog-only',
      configurationStatus: 'not-configured',
      nextAction: {
        kind: 'future-connector',
        label: 'Track future Microsoft Sentinel connector work',
        targetSurface: 'provider-catalog',
        targetId: 'microsoft-sentinel',
        disabledReason: 'Connector work is not implemented in this build. This card remains catalog metadata only.',
      },
    });
  });

  it('defines Slack notification policy defaults without enabling high-noise surfaces', () => {
    const policy = getDefaultSlackNotificationPolicy();
    const slack = getIntegrationCatalogProvider('slack');

    expect(slack).toMatchObject({
      status: 'builtin-template',
      builtinTemplateIds: ['slack-webhook-notify'],
      configurationStatus: 'not-configured',
    });
    expect(slack?.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'incoming-webhook-channel-notification', status: 'supported' }),
      expect.objectContaining({ id: 'direct-mentions-policy', status: 'design-only' }),
      expect.objectContaining({ id: 'one-to-one-dm-policy', status: 'design-only' }),
      expect.objectContaining({ id: 'group-dm-policy', status: 'design-only' }),
      expect.objectContaining({ id: 'thread-replies-after-user-posts-policy', status: 'design-only' }),
      expect.objectContaining({ id: 'channel-follow-up-noise-controls', status: 'design-only' }),
    ]));
    expect(policy).toEqual({
      directMentions: true,
      oneToOneDms: false,
      groupDms: false,
      threadRepliesAfterUserPosts: true,
      channelFollowUps: false,
      noiseControls: {
        quietHoursEnabled: true,
        batchChannelFollowUps: true,
        maxChannelFollowUpsPerHour: 3,
        suppressDuplicateThreadReplies: true,
        requireExplicitCaseMentionForChannels: true,
      },
    });
  });

  it('sanitizes malformed Slack notification policy input back to conservative defaults', () => {
    const inheritedNoisyPolicy = Object.create({
      oneToOneDms: true,
      groupDms: true,
      channelFollowUps: true,
      noiseControls: {
        maxChannelFollowUpsPerHour: 99,
      },
    }) as Record<string, unknown>;
    inheritedNoisyPolicy.directMentions = 'false';
    inheritedNoisyPolicy.threadRepliesAfterUserPosts = 1;
    inheritedNoisyPolicy.noiseControls = {
      quietHoursEnabled: 'false',
      batchChannelFollowUps: 0,
      maxChannelFollowUpsPerHour: '99',
      suppressDuplicateThreadReplies: null,
      requireExplicitCaseMentionForChannels: 'yes',
    };

    expect(sanitizeSlackNotificationPolicy(null)).toEqual(getDefaultSlackNotificationPolicy());
    expect(sanitizeSlackNotificationPolicy([])).toEqual(getDefaultSlackNotificationPolicy());
    expect(sanitizeSlackNotificationPolicy(inheritedNoisyPolicy)).toEqual(getDefaultSlackNotificationPolicy());
  });

  it('allows explicit Slack noisy-surface opt-ins while clamping channel follow-up volume', () => {
    expect(sanitizeSlackNotificationPolicy({
      directMentions: false,
      oneToOneDms: true,
      groupDms: true,
      threadRepliesAfterUserPosts: false,
      channelFollowUps: true,
      noiseControls: {
        quietHoursEnabled: false,
        batchChannelFollowUps: false,
        maxChannelFollowUpsPerHour: 99.8,
        suppressDuplicateThreadReplies: false,
        requireExplicitCaseMentionForChannels: false,
      },
    })).toEqual({
      directMentions: false,
      oneToOneDms: true,
      groupDms: true,
      threadRepliesAfterUserPosts: false,
      channelFollowUps: true,
      noiseControls: {
        quietHoursEnabled: false,
        batchChannelFollowUps: false,
        maxChannelFollowUpsPerHour: 6,
        suppressDuplicateThreadReplies: false,
        requireExplicitCaseMentionForChannels: false,
      },
    });

    expect(sanitizeSlackNotificationPolicy({
      channelFollowUps: true,
      noiseControls: { maxChannelFollowUpsPerHour: -20 },
    }).noiseControls.maxChannelFollowUpsPerHour).toBe(0);
  });

  it('returns isolated Slack policy copies that cannot mutate default metadata', () => {
    const policy = sanitizeSlackNotificationPolicy({
      noiseControls: { maxChannelFollowUpsPerHour: 1 },
    });

    policy.oneToOneDms = true;
    policy.noiseControls.maxChannelFollowUpsPerHour = 99;

    expect(getDefaultSlackNotificationPolicy()).toEqual({
      directMentions: true,
      oneToOneDms: false,
      groupDms: false,
      threadRepliesAfterUserPosts: true,
      channelFollowUps: false,
      noiseControls: {
        quietHoursEnabled: true,
        batchChannelFollowUps: true,
        maxChannelFollowUpsPerHour: 3,
        suppressDuplicateThreadReplies: true,
        requireExplicitCaseMentionForChannels: true,
      },
    });
  });

  it('returns isolated provider action metadata copies on each catalog read', () => {
    const gmail = getIntegrationCatalogProvider('gmail-google');
    expect(gmail?.nextAction).toBeDefined();

    if (gmail?.nextAction) {
      gmail.nextAction.label = 'Mutated setup label';
      gmail.nextAction.targetId = 'mutated-target';
    }

    expect(getIntegrationCatalogProvider('gmail-google')).toMatchObject({
      nextAction: {
        label: 'Open Gmail / Google Workspace setup route',
        targetId: 'assistantcaddy-email-setup',
      },
    });
  });

  it('does not perform network, localStorage, or secret side effects when reading design catalog metadata', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const groups = getIntegrationSourceCatalogGroups();
    const policy = sanitizeSlackNotificationPolicy({
      channelFollowUps: true,
      token: 'xoxb-do-not-keep',
      webhookUrl: 'https://hooks.slack.com/services/do-not-keep',
      noiseControls: {
        maxChannelFollowUpsPerHour: 4,
        password: 'do-not-keep',
      },
    });
    const serialized = JSON.stringify({ groups, policy }).toLowerCase();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(serialized).not.toContain('api_key');
    expect(serialized).not.toContain('apikey');
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('secret');

    fetchSpy.mockRestore();
    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
  });
});
