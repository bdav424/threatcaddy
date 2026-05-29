import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from '../types';
import {
  executeHostSkill,
  fromLLMSafeHostToolName,
  getHostToolDefinitions,
  isHostOrLocalToolName,
  toLLMSafeHostToolName,
} from '../lib/agent-hosts';

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  agentHosts: [
    {
      id: 'cti-host',
      name: 'cti',
      displayName: 'CTI Agent Host',
      url: 'http://127.0.0.1:8766',
      enabled: true,
      skills: [
        {
          name: 'flashpoint_forum_posts',
          description: 'Search Flashpoint forum posts.',
          actionClass: 'enrich',
          parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        },
        {
          name: 'flashpoint_request',
          description: 'Raw Flashpoint request.',
          actionClass: 'fetch',
          parameters: { type: 'object', properties: {}, required: [] },
        },
        {
          name: 'virustotal_ioc_bundle',
          description: 'Read-only VirusTotal report and relationship pivots.',
          actionClass: 'enrich',
          parameters: { type: 'object', properties: { ioc: { type: 'string' } }, required: ['ioc'] },
        },
        {
          name: 'virustotal_request',
          description: 'Raw VirusTotal request.',
          actionClass: 'fetch',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      ],
    },
  ],
};

describe('Agent Host tool definitions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('can expose LLM-safe aliases for host tools', () => {
    const tools = getHostToolDefinitions(settings, { llmSafeNames: true });

    expect(tools.map(t => t.name)).toContain('host__cti__flashpoint_forum_posts');
    expect(tools.map(t => t.name)).toContain('host__cti__virustotal_ioc_bundle');
  });

  it('keeps raw request skills hidden from CaddyAI tool definitions', () => {
    const tools = getHostToolDefinitions(settings, { llmSafeNames: true });

    expect(tools.map(t => t.name)).not.toContain('host__cti__flashpoint_request');
    expect(tools.map(t => t.name)).not.toContain('host__cti__virustotal_request');
  });

  it('round-trips between canonical and LLM-safe names', () => {
    const canonical = 'host:cti:flashpoint_forum_posts';
    const alias = toLLMSafeHostToolName(canonical);

    expect(alias).toBe('host__cti__flashpoint_forum_posts');
    expect(fromLLMSafeHostToolName(alias)).toBe(canonical);
  });

  it('recognizes canonical and LLM-safe host/local tool names', () => {
    expect(isHostOrLocalToolName('host:cti:flashpoint_forum_posts')).toBe(true);
    expect(isHostOrLocalToolName('host__cti__flashpoint_forum_posts')).toBe(true);
    expect(isHostOrLocalToolName('local:demo')).toBe(true);
    expect(isHostOrLocalToolName('local__demo')).toBe(true);
    expect(isHostOrLocalToolName('search_notes')).toBe(false);
  });

  it('executes LLM-safe aliases through the canonical Agent Host skill', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await executeHostSkill('host__cti__flashpoint_forum_posts', { query: 'akira' }, settings);

    expect(JSON.parse(result)).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8766/execute',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ skill: 'flashpoint_forum_posts', parameters: { query: 'akira' } }),
      }),
    );
  });
});
