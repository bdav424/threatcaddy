/**
 * STIX 2.1 bundle export — lightweight layer for StandaloneIOC objects.
 *
 * For the full IOCEntry-based export (with relationships, reports, identity
 * SDOs, etc.) see stix-export.ts.  This module targets the simpler
 * StandaloneIOC shape used in the IOC list.
 */

import type { TLPLevel } from './tlp';

// --- Standard TLP marking-definition IDs (STIX 2.1 spec) ---------------

export const TLP_MARKING_DEFS: Record<TLPLevel, string> = {
  'TLP:CLEAR':        'marking-definition--613f2e26-407d-48c7-9eca-b8e91df99dc9',
  'TLP:GREEN':        'marking-definition--34098fce-860f-48ae-8e50-ebd3cc5e41da',
  'TLP:AMBER':        'marking-definition--f88d31f6-486f-44da-b317-01333bde0b82',
  'TLP:AMBER+STRICT': 'marking-definition--939a9414-2ddd-4d32-a254-099d340a1628',
  'TLP:RED':          'marking-definition--5e57c739-391a-4eb3-b6be-7d15ca92d5ed',
} as const;

// --- Types ----------------------------------------------------------------

export interface STIXBundle {
  type: 'bundle';
  id: string;        // "bundle--<uuid>"
  objects: STIXObject[];
}

export interface STIXIndicator {
  type: 'indicator';
  spec_version: '2.1';
  id: string;        // "indicator--<uuid>"
  created: string;   // ISO 8601
  modified: string;
  name: string;
  description?: string;
  pattern: string;   // STIX pattern: "[ipv4-addr:value = '1.2.3.4']"
  pattern_type: 'stix' | 'yara' | 'sigma';
  valid_from: string;
  labels: string[];
  object_marking_refs: string[];
  [key: string]: unknown;
}

// Generic base type for all SDOs in the bundle
export interface STIXObject {
  type: string;
  spec_version: '2.1';
  id: string;
  [key: string]: unknown;
}

// --- Internal UUID helper -------------------------------------------------

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function deterministicUUID(namespace: string, value: string): string {
  const segments = [0, 1, 2, 3].map((n) =>
    fnv1a(`${namespace}:${value}:${n}`).toString(16).padStart(8, '0'),
  );
  const hex = segments.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// --- STIX pattern builders ------------------------------------------------

/**
 * Maps a ThreatCaddy IOC type + value to a STIX 2.1 indicator pattern string.
 * Returns an empty string for types that cannot be expressed as an indicator
 * pattern (e.g. CVE — those become Vulnerability SDOs in the full exporter).
 */
export function iocToSTIXPattern(ioc: { type: string; value: string }): string {
  const v = ioc.value.replace(/'/g, "\\'");
  switch (ioc.type) {
    case 'ipv4':        return `[ipv4-addr:value = '${v}']`;
    case 'ipv6':        return `[ipv6-addr:value = '${v}']`;
    case 'domain':      return `[domain-name:value = '${v}']`;
    case 'url':         return `[url:value = '${v}']`;
    case 'email':       return `[email-addr:value = '${v}']`;
    case 'file-path':   return `[file:name = '${v}']`;
    case 'md5':         return `[file:hashes.'MD5' = '${v}']`;
    case 'sha1':        return `[file:hashes.'SHA-1' = '${v}']`;
    case 'sha256':      return `[file:hashes.'SHA-256' = '${v}']`;
    case 'mitre-attack':
      return `[attack-pattern:external_references[*].external_id = '${v}']`;
    case 'yara-rule':   return ioc.value; // raw pattern
    case 'sigma-rule':  return ioc.value;
    case 'cve':         return ''; // not an indicator pattern
    default:            return '';
  }
}

function patternTypeFor(iocType: string): 'stix' | 'yara' | 'sigma' {
  if (iocType === 'yara-rule') return 'yara';
  if (iocType === 'sigma-rule') return 'sigma';
  return 'stix';
}

// --- TLP marking-definition SDOs -----------------------------------------

function makeTLPMarkingDef(level: TLPLevel): STIXObject {
  const tlpName = level.replace('TLP:', '').toLowerCase();
  return {
    type: 'marking-definition',
    spec_version: '2.1',
    id: TLP_MARKING_DEFS[level],
    created: '2022-10-01T00:00:00.000Z',
    definition_type: 'tlp',
    name: level,
    definition: { tlp: tlpName },
  };
}

// --- Main export ----------------------------------------------------------

/**
 * Build a STIX 2.1 bundle from a list of standalone IOCs.
 *
 * - Applies `investigationTlp` as the default marking when an IOC has no
 *   individual clsLevel.
 * - IOC-level TLP (clsLevel) overrides the investigation-level TLP when it
 *   is more restrictive.
 * - CVEs are skipped (they require Vulnerability SDOs; use the full exporter).
 */
export function exportSTIX21Bundle(
  iocs: Array<{
    id: string;
    type: string;
    value: string;
    tags: string[];
    tlp?: TLPLevel;
    createdAt: Date;
  }>,
  investigationTlp: TLPLevel,
): STIXBundle {
  const now = new Date().toISOString();
  const usedMarkingLevels = new Set<TLPLevel>();
  const objects: STIXObject[] = [];

  for (const ioc of iocs) {
    const pattern = iocToSTIXPattern(ioc);
    if (!pattern) continue; // CVEs, unknowns — skip

    // Resolve effective TLP: take the more restrictive of investigation vs ioc
    const effectiveTlp: TLPLevel = ioc.tlp
      ? tlpMerge(investigationTlp, ioc.tlp)
      : investigationTlp;
    usedMarkingLevels.add(effectiveTlp);

    const indicatorId = `indicator--${deterministicUUID('indicator', `${ioc.type}:${ioc.value}`)}`;
    const validFrom = ioc.createdAt instanceof Date
      ? ioc.createdAt.toISOString()
      : new Date(ioc.createdAt).toISOString();

    const indicator: STIXIndicator = {
      type: 'indicator',
      spec_version: '2.1',
      id: indicatorId,
      created: validFrom,
      modified: now,
      name: ioc.value.length > 80 ? `${ioc.value.slice(0, 77)}...` : ioc.value,
      pattern,
      pattern_type: patternTypeFor(ioc.type),
      valid_from: validFrom,
      labels: ioc.tags.length > 0 ? ioc.tags : ['malicious-activity'],
      indicator_types: ['malicious-activity'],
      object_marking_refs: [TLP_MARKING_DEFS[effectiveTlp]],
    };

    objects.push(indicator);
  }

  // Prepend referenced marking-definition SDOs
  const markingDefs: STIXObject[] = Array.from(usedMarkingLevels).map(
    makeTLPMarkingDef,
  );

  const bundleId = `bundle--${deterministicUUID('bundle', now + investigationTlp)}`;

  return {
    type: 'bundle',
    id: bundleId,
    objects: [...markingDefs, ...objects],
  };
}

// Helper re-exported so callers don't need to import tlp.ts separately
function tlpMerge(a: TLPLevel, b: TLPLevel): TLPLevel {
  const ORDER: TLPLevel[] = [
    'TLP:CLEAR',
    'TLP:GREEN',
    'TLP:AMBER',
    'TLP:AMBER+STRICT',
    'TLP:RED',
  ];
  return ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b;
}
