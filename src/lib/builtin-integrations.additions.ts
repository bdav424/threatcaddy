// src/lib/builtin-integrations.additions.ts
//
// New live threat-intel connectors that ride the EXISTING integration-executor path
// (same system VirusTotal / Shodan / AbuseIPDB already use). Declarative templates only —
// no new code path, no new dependencies.
//
// Endpoints verified against current official docs (2026-06):
//   urlscan.io search:  GET https://urlscan.io/api/v1/search/?q=...   (API-Key header optional; raises quota)
//   AlienVault OTX:      GET https://otx.alienvault.com/api/v1/indicators/{type}/{value}/general
//                        (X-OTX-API-KEY header; public data works without a key)
//
// Wired into BUILTIN_INTEGRATIONS via src/lib/builtin-integrations.ts spread.

import type { IntegrationTemplate } from '../types/integration-types';

export const ADDITIONAL_BUILTIN_INTEGRATIONS: IntegrationTemplate[] = [
  // ── urlscan.io URL/domain reputation (search) ────────────────────────
  {
    id: 'urlscan-search',
    schemaVersion: '1.0',
    version: '1.0.0',
    name: 'urlscan.io Lookup',
    description: 'Search urlscan.io for prior scans of a domain or URL and surface the latest verdict.',
    author: 'ThreatCaddy',
    icon: 'search',
    color: '#3b82f6',
    category: 'enrichment',
    tags: ['urlscan', 'url', 'domain', 'reputation', 'enrichment'],
    source: 'builtin',
    createdAt: 0,
    updatedAt: 0,
    triggers: [
      { type: 'manual', iocTypes: ['domain', 'url'] },
    ],
    configSchema: [
      {
        key: 'apiKey',
        label: 'urlscan.io API key (optional)',
        description: 'Optional. Raises rate limits and unlocks more fields. Search works without a key at a low quota.',
        type: 'password',
        required: false,
        secret: true,
      },
    ],
    steps: [
      {
        id: 'fetch-urlscan',
        type: 'http',
        label: 'Search urlscan.io',
        method: 'GET',
        url: 'https://urlscan.io/api/v1/search/?q={{ioc.value}}&size=1',
        headers: { 'API-Key': '{{config.apiKey}}' },
        responseType: 'json',
        retry: { maxRetries: 2, retryOn: [429, 500, 502, 503], backoffMs: 2000 },
      },
      {
        id: 'transform-urlscan',
        type: 'transform',
        label: 'Extract latest verdict',
        input: '{{steps.fetch-urlscan.response.data}}',
        operations: [
          { op: 'extract', path: 'total', as: 'total' },
          { op: 'extract', path: 'results.0.page.domain', as: 'domain' },
          { op: 'extract', path: 'results.0.task.url', as: 'scannedUrl' },
          { op: 'extract', path: 'results.0.verdicts.overall.malicious', as: 'malicious' },
          { op: 'extract', path: 'results.0.verdicts.overall.score', as: 'score' },
          { op: 'extract', path: 'results.0.result', as: 'resultApi' },
        ],
      },
    ],
    outputs: [
      {
        type: 'update-ioc',
        template: {
          id: '{{ioc.id}}',
          enrichment: { urlscan: {
            provider: 'urlscan.io',
            priorScans: '{{steps.transform-urlscan.total}}',
            domain: '{{steps.transform-urlscan.domain}}',
            lastScannedUrl: '{{steps.transform-urlscan.scannedUrl}}',
            malicious: '{{steps.transform-urlscan.malicious}}',
            score: '{{steps.transform-urlscan.score}}',
            resultApi: '{{steps.transform-urlscan.resultApi}}',
          }},
        },
      },
      {
        type: 'update-ioc',
        condition: '{{steps.transform-urlscan.malicious}} == true',
        template: { id: '{{ioc.id}}', iocStatus: 'malicious', confidence: 'medium' },
      },
      {
        type: 'display',
        template: {
          title: 'urlscan.io: {{ioc.value}}',
          summary: 'Prior scans: {{steps.transform-urlscan.total}} | Malicious: {{steps.transform-urlscan.malicious}} | Score: {{steps.transform-urlscan.score}}',
        },
      },
    ],
    rateLimit: { maxPerHour: 60, maxPerDay: 1000 },
    requiredDomains: ['urlscan.io'],
  },

  // ── AlienVault OTX — IPv4 ────────────────────────────────────────────
  {
    id: 'otx-ip-lookup',
    schemaVersion: '1.0',
    version: '1.0.0',
    name: 'AlienVault OTX IP',
    description: 'Look up an IPv4 address in AlienVault OTX and surface related pulses and reputation.',
    author: 'ThreatCaddy',
    icon: 'globe',
    color: '#22c55e',
    category: 'enrichment',
    tags: ['otx', 'alienvault', 'ip', 'reputation', 'enrichment'],
    source: 'builtin',
    createdAt: 0,
    updatedAt: 0,
    triggers: [{ type: 'manual', iocTypes: ['ipv4'] }],
    configSchema: [
      {
        key: 'apiKey',
        label: 'OTX API key (X-OTX-API-KEY)',
        description: 'Optional for public indicator data; recommended for full access and higher limits.',
        type: 'password',
        required: false,
        secret: true,
      },
    ],
    steps: [
      {
        id: 'fetch-otx',
        type: 'http',
        label: 'Fetch OTX IPv4 general',
        method: 'GET',
        url: 'https://otx.alienvault.com/api/v1/indicators/IPv4/{{ioc.value}}/general',
        headers: { 'X-OTX-API-KEY': '{{config.apiKey}}' },
        responseType: 'json',
        retry: { maxRetries: 2, retryOn: [429, 500, 502, 503], backoffMs: 2000 },
      },
      {
        id: 'transform-otx',
        type: 'transform',
        label: 'Extract OTX summary',
        input: '{{steps.fetch-otx.response.data}}',
        operations: [
          { op: 'extract', path: 'pulse_info.count', as: 'pulseCount' },
          { op: 'extract', path: 'reputation', as: 'reputation' },
          { op: 'extract', path: 'asn', as: 'asn' },
          { op: 'extract', path: 'country_name', as: 'country' },
        ],
      },
    ],
    outputs: [
      {
        type: 'update-ioc',
        template: {
          id: '{{ioc.id}}',
          enrichment: { otx: {
            provider: 'AlienVault OTX',
            observableType: 'ip',
            pulseCount: '{{steps.transform-otx.pulseCount}}',
            reputation: '{{steps.transform-otx.reputation}}',
            asn: '{{steps.transform-otx.asn}}',
            country: '{{steps.transform-otx.country}}',
          }},
        },
      },
      {
        type: 'update-ioc',
        condition: '{{steps.transform-otx.pulseCount}} > 0',
        template: { id: '{{ioc.id}}', iocStatus: 'suspicious', confidence: 'medium' },
      },
      {
        type: 'display',
        template: {
          title: 'OTX: {{ioc.value}}',
          summary: 'Pulses: {{steps.transform-otx.pulseCount}} | ASN: {{steps.transform-otx.asn}} | Country: {{steps.transform-otx.country}}',
        },
      },
    ],
    rateLimit: { maxPerHour: 120, maxPerDay: 2000 },
    requiredDomains: ['otx.alienvault.com'],
  },

  // ── AlienVault OTX — domain ──────────────────────────────────────────
  {
    id: 'otx-domain-lookup',
    schemaVersion: '1.0',
    version: '1.0.0',
    name: 'AlienVault OTX Domain',
    description: 'Look up a domain in AlienVault OTX and surface related pulses.',
    author: 'ThreatCaddy',
    icon: 'globe',
    color: '#22c55e',
    category: 'enrichment',
    tags: ['otx', 'alienvault', 'domain', 'enrichment'],
    source: 'builtin',
    createdAt: 0,
    updatedAt: 0,
    triggers: [{ type: 'manual', iocTypes: ['domain'] }],
    configSchema: [
      {
        key: 'apiKey',
        label: 'OTX API key (X-OTX-API-KEY)',
        description: 'Optional for public indicator data; recommended for full access and higher limits.',
        type: 'password',
        required: false,
        secret: true,
      },
    ],
    steps: [
      {
        id: 'fetch-otx',
        type: 'http',
        label: 'Fetch OTX domain general',
        method: 'GET',
        url: 'https://otx.alienvault.com/api/v1/indicators/domain/{{ioc.value}}/general',
        headers: { 'X-OTX-API-KEY': '{{config.apiKey}}' },
        responseType: 'json',
        retry: { maxRetries: 2, retryOn: [429, 500, 502, 503], backoffMs: 2000 },
      },
      {
        id: 'transform-otx',
        type: 'transform',
        label: 'Extract OTX summary',
        input: '{{steps.fetch-otx.response.data}}',
        operations: [
          { op: 'extract', path: 'pulse_info.count', as: 'pulseCount' },
          { op: 'extract', path: 'type_title', as: 'typeTitle' },
        ],
      },
    ],
    outputs: [
      {
        type: 'update-ioc',
        template: {
          id: '{{ioc.id}}',
          enrichment: { otx: {
            provider: 'AlienVault OTX',
            observableType: 'domain',
            pulseCount: '{{steps.transform-otx.pulseCount}}',
          }},
        },
      },
      {
        type: 'update-ioc',
        condition: '{{steps.transform-otx.pulseCount}} > 0',
        template: { id: '{{ioc.id}}', iocStatus: 'suspicious', confidence: 'medium' },
      },
      {
        type: 'display',
        template: {
          title: 'OTX: {{ioc.value}}',
          summary: 'Pulses: {{steps.transform-otx.pulseCount}}',
        },
      },
    ],
    rateLimit: { maxPerHour: 120, maxPerDay: 2000 },
    requiredDomains: ['otx.alienvault.com'],
  },

  // ── AlienVault OTX — file hash ───────────────────────────────────────
  {
    id: 'otx-hash-lookup',
    schemaVersion: '1.0',
    version: '1.0.0',
    name: 'AlienVault OTX Hash',
    description: 'Look up a file hash in AlienVault OTX and surface related pulses.',
    author: 'ThreatCaddy',
    icon: 'file-digit',
    color: '#22c55e',
    category: 'enrichment',
    tags: ['otx', 'alienvault', 'hash', 'malware', 'enrichment'],
    source: 'builtin',
    createdAt: 0,
    updatedAt: 0,
    triggers: [{ type: 'manual', iocTypes: ['md5', 'sha1', 'sha256'] }],
    configSchema: [
      {
        key: 'apiKey',
        label: 'OTX API key (X-OTX-API-KEY)',
        description: 'Optional for public indicator data; recommended for full access and higher limits.',
        type: 'password',
        required: false,
        secret: true,
      },
    ],
    steps: [
      {
        id: 'fetch-otx',
        type: 'http',
        label: 'Fetch OTX file general',
        method: 'GET',
        url: 'https://otx.alienvault.com/api/v1/indicators/file/{{ioc.value}}/general',
        headers: { 'X-OTX-API-KEY': '{{config.apiKey}}' },
        responseType: 'json',
        retry: { maxRetries: 2, retryOn: [429, 500, 502, 503], backoffMs: 2000 },
      },
      {
        id: 'transform-otx',
        type: 'transform',
        label: 'Extract OTX summary',
        input: '{{steps.fetch-otx.response.data}}',
        operations: [
          { op: 'extract', path: 'pulse_info.count', as: 'pulseCount' },
        ],
      },
    ],
    outputs: [
      {
        type: 'update-ioc',
        template: {
          id: '{{ioc.id}}',
          enrichment: { otx: {
            provider: 'AlienVault OTX',
            observableType: 'file',
            pulseCount: '{{steps.transform-otx.pulseCount}}',
          }},
        },
      },
      {
        type: 'update-ioc',
        condition: '{{steps.transform-otx.pulseCount}} > 0',
        template: { id: '{{ioc.id}}', iocStatus: 'malicious', confidence: 'medium' },
      },
      {
        type: 'display',
        template: {
          title: 'OTX: {{ioc.value}}',
          summary: 'Pulses: {{steps.transform-otx.pulseCount}}',
        },
      },
    ],
    rateLimit: { maxPerHour: 120, maxPerDay: 2000 },
    requiredDomains: ['otx.alienvault.com'],
  },
];
