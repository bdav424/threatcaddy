import { normalizeLocalLlmEndpoint } from './local-llm-endpoint';

export type EndpointProbeStatus = 'idle' | 'probing' | 'ok' | 'error';

export interface EndpointProbe {
  endpoint: string;
  status: EndpointProbeStatus;
  message: string;
  models: string[];
  durationMs?: number;
}

export const ENDPOINT_CANDIDATES = [
  'http://127.0.0.1:11434/v1',
  'http://localhost:11434/v1',
  'http://127.0.0.1:11436/v1',
  'http://localhost:11436/v1',
  'http://127.0.0.1:8000/v1',
  'http://localhost:8000/v1',
];

export function uniqueEndpoints(currentEndpoint?: string, customEndpoint?: string): string[] {
  const endpoints = [currentEndpoint, customEndpoint, ...ENDPOINT_CANDIDATES]
    .map((ep) => normalizeLocalLlmEndpoint(ep))
    .filter(Boolean);
  return Array.from(new Set(endpoints));
}

export async function probeEndpoint(endpoint: string): Promise<EndpointProbe> {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(`${endpoint.replace(/\/+$/, '')}/models`, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const durationMs = Math.round(performance.now() - started);

    if (!response.ok) {
      return { endpoint, status: 'error', message: `HTTP ${response.status}`, models: [], durationMs };
    }

    const body = await response.json().catch(() => null) as {
      data?: Array<{ id?: string }>;
      models?: Array<{ name?: string; id?: string }>;
    } | null;

    const models = [
      ...(body?.data?.map((m) => m.id).filter(Boolean) ?? []),
      ...(body?.models?.map((m) => m.id ?? m.name).filter(Boolean) ?? []),
    ] as string[];

    return {
      endpoint,
      status: 'ok',
      message: models.length > 0 ? `${models.length} model${models.length === 1 ? '' : 's'} found` : 'Reachable, no models listed',
      models,
      durationMs,
    };
  } catch (error) {
    const durationMs = Math.round(performance.now() - started);
    const message = error instanceof DOMException && error.name === 'AbortError'
      ? 'Timed out after 2.5s'
      : error instanceof Error ? error.message : 'Fetch failed';
    return { endpoint, status: 'error', message, models: [], durationMs };
  } finally {
    window.clearTimeout(timeout);
  }
}
