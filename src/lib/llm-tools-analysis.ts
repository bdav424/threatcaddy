import { db } from '../db';
import { extractIOCs } from './ioc-extractor';
import { buildGraphData } from './graph-data';
import { postMessageOrigin } from './utils';

interface FetchUrlResult {
  success: boolean;
  title?: string;
  content?: string;
  error?: string;
}

interface StoredAuthState {
  serverUrl?: string;
  accessToken?: string;
}

const FETCH_CONTENT_LIMIT = 12000;
const FETCH_HTML_LIMIT = 50000;

export async function executeAnalyzeGraph(input: Record<string, unknown>, folderId?: string): Promise<string> {
  if (!folderId) {
    return JSON.stringify({ error: 'No investigation selected.' });
  }

  const [notes, tasks, events] = await Promise.all([
    db.notes.where('folderId').equals(folderId).and(n => !n.trashed).toArray(),
    db.tasks.where('folderId').equals(folderId).and(t => !t.trashed).toArray(),
    db.timelineEvents.where('folderId').equals(folderId).and(e => !e.trashed).toArray(),
  ]);

  const graph = buildGraphData(notes, tasks, events);

  // Compute degree for each node
  const degree = new Map<string, number>();
  for (const node of graph.nodes) degree.set(node.id, 0);
  for (const edge of graph.edges) {
    degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
  }

  // Top connected nodes
  const topNodes = [...degree.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, deg]) => {
      const node = graph.nodes.find(n => n.id === id);
      return { id, label: node?.label || id, type: node?.type, connections: deg };
    });

  // Node type breakdown
  const typeBreakdown: Record<string, number> = {};
  for (const node of graph.nodes) {
    typeBreakdown[node.type] = (typeBreakdown[node.type] || 0) + 1;
  }

  // Edge type breakdown
  const edgeBreakdown: Record<string, number> = {};
  for (const edge of graph.edges) {
    edgeBreakdown[edge.type] = (edgeBreakdown[edge.type] || 0) + 1;
  }

  // Isolated nodes (no connections)
  const isolated = graph.nodes.filter(n => (degree.get(n.id) || 0) === 0).length;

  // BFS shortest path if requested
  let path: { found: boolean; path?: string[]; length?: number } | undefined;
  if (input.pathFrom && input.pathTo) {
    const from = String(input.pathFrom);
    const to = String(input.pathTo);
    path = bfsPath(graph, from, to);
  }

  return JSON.stringify({
    totalNodes: graph.nodes.length,
    totalEdges: graph.edges.length,
    nodesByType: typeBreakdown,
    edgesByType: edgeBreakdown,
    isolatedNodes: isolated,
    topConnected: topNodes,
    ...(path ? { shortestPath: path } : {}),
  });
}

function bfsPath(graph: { nodes: { id: string; label: string }[]; edges: { source: string; target: string }[] }, from: string, to: string) {
  const adj = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, []);
    if (!adj.has(edge.target)) adj.set(edge.target, []);
    adj.get(edge.source)!.push(edge.target); // eslint-disable-line @typescript-eslint/no-non-null-assertion
    adj.get(edge.target)!.push(edge.source); // eslint-disable-line @typescript-eslint/no-non-null-assertion
  }

  const visited = new Set<string>();
  const queue: { node: string; path: string[] }[] = [{ node: from, path: [from] }];
  visited.add(from);

  while (queue.length > 0) {
    const current = queue.shift()!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    if (current.node === to) {
      const labels = current.path.map(id => {
        const n = graph.nodes.find(node => node.id === id);
        return n ? `${n.label} (${id})` : id;
      });
      return { found: true, path: labels, length: current.path.length - 1 };
    }
    for (const neighbor of adj.get(current.node) || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ node: neighbor, path: [...current.path, neighbor] });
      }
    }
  }
  return { found: false };
}

export function executeExtractIOCs(input: Record<string, unknown>): string {
  const text = String(input.text || '');
  if (!text) return JSON.stringify({ error: 'text is required' });

  const iocs = extractIOCs(text);
  const grouped: Record<string, string[]> = {};
  for (const ioc of iocs) {
    if (!grouped[ioc.type]) grouped[ioc.type] = [];
    grouped[ioc.type].push(ioc.value);
  }

  return JSON.stringify({ totalFound: iocs.length, byType: grouped });
}

function formatFetchContent(content: string): string {
  if (content.length > FETCH_CONTENT_LIMIT) {
    return content.substring(0, FETCH_CONTENT_LIMIT) + '\n\n...(truncated to fit context window)';
  }
  return content;
}

function htmlToText(html: string, fallbackUrl: string): { title: string; content: string } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  for (const selector of ['script', 'style', 'noscript', 'svg']) {
    doc.querySelectorAll(selector).forEach((node) => node.remove());
  }

  const title = (doc.querySelector('title')?.textContent || new URL(fallbackUrl).hostname).trim();
  let text = (doc.body?.textContent || doc.documentElement?.textContent || '').replace(/\r/g, '\n');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n[ \t]+/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  if (text.length > FETCH_HTML_LIMIT) {
    text = text.substring(0, FETCH_HTML_LIMIT) + '\n\n...(truncated)';
  }

  return { title, content: text };
}

function normalizeFetchedDocument(payload: unknown, fallbackUrl: string, contentType = ''): { title: string; content: string } {
  if (typeof payload === 'string') {
    if (contentType.includes('html') || /^\s*</.test(payload)) {
      return htmlToText(payload, fallbackUrl);
    }
    return { title: new URL(fallbackUrl).hostname, content: payload.trim() };
  }

  return {
    title: new URL(fallbackUrl).hostname,
    content: JSON.stringify(payload, null, 2),
  };
}

function readStoredAuthState(): StoredAuthState | null {
  try {
    const stored = localStorage.getItem('threatcaddy-auth');
    if (!stored) return null;
    const parsed = JSON.parse(stored) as StoredAuthState;
    if (!parsed?.serverUrl || !parsed?.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function fetchViaExtensionBridge(url: string): Promise<FetchUrlResult> {
  const requestId = Math.random().toString(36).slice(2);
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve({ success: false, error: 'Extension bridge timed out. Make sure the ThreatCaddy extension is installed and the page has been reloaded after installation.' });
    }, 20000);

    function handler(event: MessageEvent) {
      if (event.source !== window || !event.data) return;
      if (event.data.type !== 'TC_FETCH_URL_RESULT') return;
      if (event.data.requestId !== requestId) return;
      window.removeEventListener('message', handler);
      clearTimeout(timeout);
      resolve({
        success: !!event.data.success,
        title: event.data.title,
        content: event.data.content,
        error: event.data.error,
      });
    }

    window.addEventListener('message', handler);
    window.postMessage({ type: 'TC_FETCH_URL', requestId, url }, postMessageOrigin());
  });
}

async function fetchViaServerProxy(url: string): Promise<FetchUrlResult> {
  const auth = readStoredAuthState();
  if (!auth?.serverUrl || !auth.accessToken) {
    return { success: false, error: 'No authenticated team server connection is available for article fetch fallback.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${auth.serverUrl}/api/proxy-fetch`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.accessToken}`,
      },
      body: JSON.stringify({
        url,
        method: 'GET',
        headers: { Accept: 'text/html,application/xhtml+xml,*/*' },
        body: null,
        requiredDomains: [new URL(url).hostname],
      }),
    });
    const result = await response.json().catch(() => ({})) as {
      error?: string;
      data?: unknown;
      headers?: Record<string, string>;
      status?: number;
      statusText?: string;
    };
    if (!response.ok) {
      return { success: false, error: result.error || `Server proxy error: ${response.status}` };
    }

    const normalized = normalizeFetchedDocument(result.data, url, result.headers?.['content-type'] || '');
    return { success: true, title: normalized.title, content: normalized.content };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message === 'The operation was aborted.'
        ? 'Team server proxy timed out while fetching the article.'
        : `Team server proxy failed: ${message}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchViaLocalProxy(url: string): Promise<FetchUrlResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('http://127.0.0.1:8767/api/proxy-fetch', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        method: 'GET',
        headers: { Accept: 'text/html,application/xhtml+xml,*/*' },
        body: null,
        requiredDomains: [new URL(url).hostname],
      }),
    });
    const result = await response.json().catch(() => ({})) as {
      error?: string;
      data?: unknown;
      headers?: Record<string, string>;
    };
    if (!response.ok) {
      return { success: false, error: result.error || `Local proxy error: ${response.status}` };
    }

    const normalized = normalizeFetchedDocument(result.data, url, result.headers?.['content-type'] || '');
    return { success: true, title: normalized.title, content: normalized.content };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message === 'The operation was aborted.'
        ? 'Local proxy timed out while fetching the article.'
        : `Local proxy failed: ${message}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchDirectly(url: string): Promise<FetchUrlResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'text/html,application/xhtml+xml,*/*' },
      redirect: 'follow',
    });
    if (!response.ok) {
      return { success: false, error: `Direct browser fetch failed with HTTP ${response.status} ${response.statusText}` };
    }

    const payload = await response.text();
    const normalized = normalizeFetchedDocument(payload, url, response.headers.get('content-type') || '');
    return { success: true, title: normalized.title, content: normalized.content };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message === 'The operation was aborted.'
        ? 'Direct browser fetch timed out while fetching the article.'
        : `Direct browser fetch failed: ${message}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function executeFetchUrl(input: Record<string, unknown>): Promise<string> {
  const url = String(input.url || '');
  if (!url) return JSON.stringify({ error: 'url is required' });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return JSON.stringify({ error: 'Invalid URL' });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return JSON.stringify({ error: 'Only http and https URLs are supported' });
  }

  const attempts: Array<{ name: string; result: FetchUrlResult }> = [
    { name: 'extension bridge', result: await fetchViaExtensionBridge(url) },
  ];

  if (!attempts[0].result.success) {
    attempts.push({ name: 'team server proxy', result: await fetchViaServerProxy(url) });
  }
  if (!attempts[attempts.length - 1].result.success) {
    attempts.push({ name: 'local standalone proxy', result: await fetchViaLocalProxy(url) });
  }
  if (!attempts[attempts.length - 1].result.success) {
    attempts.push({ name: 'direct browser fetch', result: await fetchDirectly(url) });
  }

  const success = attempts.find((attempt) => attempt.result.success);
  if (success) {
    return JSON.stringify({
      title: success.result.title || '',
      content: formatFetchContent(success.result.content || ''),
      url,
      fetchSource: success.name,
    });
  }

  return JSON.stringify({
    error: attempts
      .map((attempt) => `${attempt.name}: ${attempt.result.error || 'failed'}`)
      .join(' | '),
  });
}
