export const LOCAL_CODEX_BRIDGE_API_KEY = 'codex-local-dev';

const LOCAL_CODEX_BRIDGE_PORT = '11434';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export function isLoopbackCodexBridgeEndpoint(endpoint?: string): boolean {
  const rawEndpoint = endpoint?.trim().replace(/\/+$/, '');
  if (!rawEndpoint) return false;

  try {
    const url = new URL(rawEndpoint);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

    const port = url.port || (url.protocol === 'https:' ? '443' : '80');
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    return LOOPBACK_HOSTS.has(url.hostname.toLowerCase()) &&
      port === LOCAL_CODEX_BRIDGE_PORT &&
      (pathname === '/' || pathname === '/v1');
  } catch {
    return false;
  }
}

export function resolveLocalLLMApiKey(apiKey?: string, endpoint?: string): string | undefined {
  const trimmed = apiKey?.trim();
  if (trimmed && trimmed !== 'local') return trimmed;
  if (isLoopbackCodexBridgeEndpoint(endpoint)) return LOCAL_CODEX_BRIDGE_API_KEY;
  return trimmed || undefined;
}

export function getLocalLLMAuthHeaders(apiKey?: string, endpoint?: string): Record<string, string> {
  const effectiveApiKey = resolveLocalLLMApiKey(apiKey, endpoint);
  return effectiveApiKey ? { Authorization: `Bearer ${effectiveApiKey}` } : {};
}
