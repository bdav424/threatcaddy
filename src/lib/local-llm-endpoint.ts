const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost']);

export function normalizeLocalLlmEndpoint(value?: string): string {
  const trimmed = value?.trim() || '';
  if (!trimmed) return '';

  const withScheme = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

  try {
    const url = new URL(withScheme);
    const isLoopback = LOOPBACK_HOSTS.has(url.hostname);

    if (isLoopback && !url.port) {
      url.port = '11434';
    }

    if (isLoopback && (!url.pathname || url.pathname === '/')) {
      url.pathname = '/v1';
    }

    return url.toString().replace(/\/+$/, '');
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

export function getLocalLlmHealthUrl(value?: string): string {
  const normalized = normalizeLocalLlmEndpoint(value);
  if (!normalized) return '';
  return normalized.replace(/\/v1\/?$/, '').replace(/\/+$/, '') + '/health';
}
