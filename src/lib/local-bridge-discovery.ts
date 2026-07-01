export type LocalBridgeKind = 'llm' | 'mail' | 'agent-host' | 'generic';

export type LocalBridgeHostScope =
  | 'loopback'
  | 'private-ipv4'
  | 'link-local-ipv4'
  | 'unique-local-ipv6'
  | 'link-local-ipv6'
  | 'local-hostname';

export type LocalBridgeDiscoveryRejectionReason =
  | 'empty_candidate'
  | 'invalid_url'
  | 'unsupported_scheme'
  | 'missing_host'
  | 'external_or_public_host'
  | 'authority_credentials'
  | 'secret_query_param'
  | 'url_fragment'
  | 'candidate_limit_exceeded';

export interface LocalBridgeDiscoveryRequest {
  candidates: readonly string[];
  bridgeKind?: LocalBridgeKind;
  consentGranted?: boolean;
  defaultScheme?: 'http' | 'https';
  defaultProbePath?: string;
  timeoutMs?: number;
  maxCandidates?: number;
}

export interface LocalBridgeProbePlan {
  method: 'GET';
  url: string;
  timeoutMs: number;
  allowed: boolean;
  consentRequired: boolean;
  sideEffectBoundary: 'plan-only-no-fetch-no-socket';
}

export interface LocalBridgeCandidatePlan {
  input: string;
  normalizedEndpoint?: string;
  host?: string;
  scope?: LocalBridgeHostScope;
  accepted: boolean;
  probe: LocalBridgeProbePlan | null;
  rejectionReasons: LocalBridgeDiscoveryRejectionReason[];
}

export interface LocalBridgeDiscoveryPlan {
  bridgeKind: LocalBridgeKind;
  allowed: boolean;
  consentGranted: boolean;
  consentRequired: boolean;
  status: 'ready' | 'blocked_consent_required' | 'blocked_no_valid_candidates';
  candidates: LocalBridgeCandidatePlan[];
  acceptedCount: number;
  rejectedCount: number;
  sideEffectBoundary: 'plan-only-no-fetch-no-socket-no-storage';
}

const DEFAULT_MAX_CANDIDATES = 24;
const DEFAULT_TIMEOUT_MS = 2_000;
const LOCAL_HOSTNAME_SUFFIXES = ['.localhost', '.local'] as const;
const SECRET_QUERY_PARAM_MARKERS = [
  'accesstoken',
  'apitoken',
  'apikey',
  'appkey',
  'authorization',
  'authcode',
  'bearer',
  'clientsecret',
  'credential',
  'jwt',
  'key',
  'password',
  'passwd',
  'pwd',
  'refreshtoken',
  'secret',
  'session',
  'sig',
  'signature',
  'token',
] as const;
const SECRET_QUERY_VALUE_PATTERNS = [
  /\bbearer\s+[a-z0-9._~+/-]{8,}/i,
  /\bbasic\s+[a-z0-9+/=]{8,}/i,
  /\b(?:oauth|api[-_\s]?key|token|secret)[=:]\s*[a-z0-9._~+/-]{8,}/i,
  /\b(?:sk|pk|rk|gh[pousr]|xox[baprs])[-_][a-z0-9._~+/-]{8,}/i,
  /\beyj[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}/i,
] as const;

function normalizeProbePath(value?: string): string {
  const trimmed = value?.trim() || '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function normalizeCandidateUrl(candidate: string, defaultScheme: 'http' | 'https'): URL | null {
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `${defaultScheme}://${trimmed}`;

  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}

function classifyIpv4(host: string): LocalBridgeHostScope | null {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return null;

  const octets = match.slice(1).map((part) => Number(part));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null;

  const [first, second] = octets;
  if (first === 127) return 'loopback';
  if (first === 10) return 'private-ipv4';
  if (first === 172 && second >= 16 && second <= 31) return 'private-ipv4';
  if (first === 192 && second === 168) return 'private-ipv4';
  if (first === 169 && second === 254) return 'link-local-ipv4';
  return null;
}

function classifyIpv6(host: string): LocalBridgeHostScope | null {
  const unbracketed = host.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  if (!unbracketed.includes(':')) return null;
  if (unbracketed === '::1' || unbracketed === '0:0:0:0:0:0:0:1') return 'loopback';

  const firstHextetText = unbracketed.split(':', 1)[0];
  const firstHextet = Number.parseInt(firstHextetText || '0', 16);
  if (!Number.isFinite(firstHextet)) return null;
  if ((firstHextet & 0xfe00) === 0xfc00) return 'unique-local-ipv6';
  if ((firstHextet & 0xffc0) === 0xfe80) return 'link-local-ipv6';
  return null;
}

function classifyLocalHostname(host: string): LocalBridgeHostScope | null {
  const normalizedHost = host.toLowerCase().replace(/\.$/, '');
  if (normalizedHost === 'localhost') return 'loopback';
  if (LOCAL_HOSTNAME_SUFFIXES.some((suffix) => normalizedHost.endsWith(suffix))) return 'local-hostname';
  return null;
}

function classifyAllowedHost(host: string): LocalBridgeHostScope | null {
  const normalizedHost = host.toLowerCase().replace(/\.$/, '');
  return classifyIpv4(normalizedHost) ?? classifyIpv6(normalizedHost) ?? classifyLocalHostname(normalizedHost);
}

function normalizedQueryKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function hasSecretQueryValue(value: string): boolean {
  return SECRET_QUERY_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function hasSecretLookingRawCandidate(candidate: string): boolean {
  const normalized = normalizedQueryKey(candidate);
  return SECRET_QUERY_PARAM_MARKERS.some((marker) => normalized.includes(marker)) || hasSecretQueryValue(candidate);
}

function hasSecretQueryParam(url: URL): boolean {
  for (const [key, value] of url.searchParams.entries()) {
    const normalized = normalizedQueryKey(key);
    if (SECRET_QUERY_PARAM_MARKERS.some((marker) => normalized === marker || normalized.includes(marker))) {
      return true;
    }
    if (hasSecretQueryValue(value)) return true;
  }
  return false;
}

function normalizedEndpoint(url: URL): string {
  const copy = new URL(url.toString());
  copy.username = '';
  copy.password = '';
  copy.search = '';
  copy.hash = '';
  if (!copy.pathname) copy.pathname = '/';
  return copy.toString();
}

function redactedUrlInput(url: URL): string {
  const copy = new URL(url.toString());
  copy.username = '';
  copy.password = '';
  copy.search = '';
  copy.hash = '';
  return copy.toString();
}

function redactedRawInput(candidate: string): string {
  const [withoutFragment] = candidate.split('#', 1);
  const queryStart = withoutFragment.indexOf('?');
  return queryStart >= 0 ? `${withoutFragment.slice(0, queryStart)}?[redacted]` : '[redacted-url]';
}

function safeRejectedInput(candidate: string, defaultScheme: 'http' | 'https'): string {
  const url = normalizeCandidateUrl(candidate.trim(), defaultScheme);
  if (url) return redactedUrlInput(url);
  return redactedRawInput(candidate);
}

function probeUrlFor(endpoint: string, defaultProbePath: string): string {
  const url = new URL(endpoint);
  url.pathname = defaultProbePath;
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function createLocalBridgeDiscoveryPlan(request: LocalBridgeDiscoveryRequest): LocalBridgeDiscoveryPlan {
  const bridgeKind = request.bridgeKind ?? 'generic';
  const defaultScheme = request.defaultScheme ?? 'http';
  const defaultProbePath = normalizeProbePath(request.defaultProbePath);
  const rawTimeoutMs = request.timeoutMs;
  const rawMaxCandidates = request.maxCandidates;
  const timeoutMs = typeof rawTimeoutMs === 'number' && Number.isFinite(rawTimeoutMs) && rawTimeoutMs > 0
    ? Math.trunc(rawTimeoutMs)
    : DEFAULT_TIMEOUT_MS;
  const maxCandidates = typeof rawMaxCandidates === 'number' && Number.isFinite(rawMaxCandidates) && rawMaxCandidates > 0
    ? Math.trunc(rawMaxCandidates)
    : DEFAULT_MAX_CANDIDATES;
  const consentGranted = request.consentGranted === true;
  const candidatePlans: LocalBridgeCandidatePlan[] = [];

  request.candidates.slice(0, maxCandidates).forEach((candidate) => {
    const trimmed = candidate.trim();
    const rejectionReasons: LocalBridgeDiscoveryRejectionReason[] = [];

    if (!trimmed) {
      candidatePlans.push({
        input: candidate,
        accepted: false,
        probe: null,
        rejectionReasons: ['empty_candidate'],
      });
      return;
    }

    const url = normalizeCandidateUrl(trimmed, defaultScheme);
    if (!url) {
      candidatePlans.push({
        input: hasSecretLookingRawCandidate(candidate) ? redactedRawInput(candidate) : candidate,
        accepted: false,
        probe: null,
        rejectionReasons: ['invalid_url'],
      });
      return;
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') rejectionReasons.push('unsupported_scheme');
    if (!url.hostname) rejectionReasons.push('missing_host');
    if (url.username || url.password) rejectionReasons.push('authority_credentials');
    if (hasSecretQueryParam(url)) rejectionReasons.push('secret_query_param');
    if (url.hash) rejectionReasons.push('url_fragment');

    const scope = url.hostname ? classifyAllowedHost(url.hostname) : null;
    if (!scope && url.hostname) rejectionReasons.push('external_or_public_host');

    const accepted = rejectionReasons.length === 0;
    const endpoint = accepted ? normalizedEndpoint(url) : undefined;
    const input = rejectionReasons.some((reason) => (
      reason === 'authority_credentials' || reason === 'secret_query_param' || reason === 'url_fragment'
    ))
      ? safeRejectedInput(candidate, defaultScheme)
      : candidate;
    candidatePlans.push({
      input,
      normalizedEndpoint: endpoint,
      host: url.hostname || undefined,
      scope: scope ?? undefined,
      accepted,
      probe: endpoint
        ? {
            method: 'GET',
            url: probeUrlFor(endpoint, defaultProbePath),
            timeoutMs,
            allowed: consentGranted,
            consentRequired: !consentGranted,
            sideEffectBoundary: 'plan-only-no-fetch-no-socket',
          }
        : null,
      rejectionReasons,
    });
  });

  if (request.candidates.length > maxCandidates) {
    request.candidates.slice(maxCandidates).forEach((candidate) => {
      const url = normalizeCandidateUrl(candidate.trim(), defaultScheme);
      const input = url && (
        url.username || url.password || hasSecretQueryParam(url) || url.hash
      )
        ? safeRejectedInput(candidate, defaultScheme)
        : hasSecretLookingRawCandidate(candidate)
          ? redactedRawInput(candidate)
        : candidate;
      candidatePlans.push({
        input,
        accepted: false,
        probe: null,
        rejectionReasons: ['candidate_limit_exceeded'],
      });
    });
  }

  const acceptedCount = candidatePlans.filter((candidate) => candidate.accepted).length;
  const rejectedCount = candidatePlans.length - acceptedCount;
  const allowed = consentGranted && acceptedCount > 0;
  const status = acceptedCount === 0
    ? 'blocked_no_valid_candidates'
    : allowed
      ? 'ready'
      : 'blocked_consent_required';

  return {
    bridgeKind,
    allowed,
    consentGranted,
    consentRequired: !consentGranted,
    status,
    candidates: candidatePlans,
    acceptedCount,
    rejectedCount,
    sideEffectBoundary: 'plan-only-no-fetch-no-socket-no-storage',
  };
}
