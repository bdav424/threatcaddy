/**
 * LLM request routing — routes requests to either the extension bridge or
 * the team server proxy based on the configured routing mode.
 */
import { nanoid } from 'nanoid';
import { postMessageOrigin } from './utils';
import { streamLLMChat } from './server-api';
import {
  compactMessagesForLocal,
  compactSystemPromptForLocal,
  estimateLocalPromptChars,
  LOCAL_PROMPT_CHAR_LIMIT,
} from './llm-prompt-budget';
import { getLocalLLMAuthHeaders } from './local-llm-auth';

export type LLMRoutingMode = 'extension' | 'server' | 'auto';

export interface LLMRouteRequest {
  provider: string;
  model: string;
  messages: unknown[];
  apiKey?: string;
  systemPrompt?: string;
  tools?: unknown[];
  endpoint?: string;
}

export interface LLMRouteCallbacks {
  onChunk: (content: string) => void;
  onDone: (stopReason: string, contentBlocks: unknown[], usage?: { input: number; output: number }) => void;
  onError: (error: string) => void;
}

function compactLocalRouteRequest(request: LLMRouteRequest): LLMRouteRequest {
  if (request.provider !== 'local') return request;
  const systemPrompt = compactSystemPromptForLocal(request.systemPrompt);
  return {
    ...request,
    systemPrompt,
    messages: compactMessagesForLocal((request.messages as { role: string; content: unknown }[]) || [], {
      systemPrompt,
      tools: request.tools,
    }),
  };
}

/**
 * Determine the effective routing mode based on settings and availability.
 */
/**
 * Send an LLM request directly to a local endpoint (no extension needed).
 * Uses OpenAI-compatible /chat/completions format with SSE streaming.
 */
export function sendDirectToLocal(
  request: LLMRouteRequest,
  callbacks: LLMRouteCallbacks,
  signal?: AbortSignal,
): string {
  const requestId = nanoid();
  if (!request.endpoint?.trim()) {
    callbacks.onError('No Local LLM endpoint configured. Add one in Settings > AI/LLM.');
    return requestId;
  }
  const rawEndpoint = request.endpoint.trim().replace(/\/+$/, '');
  // Validate endpoint is a safe http/https URL before using it
  let parsedEndpoint: URL;
  try {
    parsedEndpoint = new URL(rawEndpoint);
  } catch {
    callbacks.onError('Invalid local endpoint URL');
    return requestId;
  }
  if (parsedEndpoint.protocol !== 'http:' && parsedEndpoint.protocol !== 'https:') {
    callbacks.onError('Local endpoint must use http or https');
    return requestId;
  }
  const base = rawEndpoint;
  const url = `${base}/chat/completions`;
  const systemPrompt = compactSystemPromptForLocal(request.systemPrompt);
  let localMessages = compactMessagesForLocal((request.messages as { role: string; content: unknown }[]) || [], {
    systemPrompt,
    tools: request.tools,
  });
  let estimatedPromptChars = estimateLocalPromptChars({
    model: request.model,
    systemPrompt,
    messages: localMessages,
    tools: request.tools,
  });

  if (estimatedPromptChars > LOCAL_PROMPT_CHAR_LIMIT) {
    localMessages = compactMessagesForLocal(localMessages, {
      systemPrompt,
      tools: request.tools,
      targetChars: 120_000,
      maxMessageChars: 12_000,
      maxRecentMessageChars: 16_000,
      maxToolResultChars: 6_000,
      preserveRecentMessages: 4,
    });
    estimatedPromptChars = estimateLocalPromptChars({
      model: request.model,
      systemPrompt,
      messages: localMessages,
      tools: request.tools,
    });
  }

  if (estimatedPromptChars > LOCAL_PROMPT_CHAR_LIMIT) {
    callbacks.onError(`Local LLM prompt is still too large after CaddyAI compacted cached tool results (${estimatedPromptChars.toLocaleString()} estimated characters; local limit ${LOCAL_PROMPT_CHAR_LIMIT.toLocaleString()}). Start a fresh chat, reduce attached context, or temporarily disable broad tool access for this turn.`);
    return requestId;
  }

  // Build OpenAI-compatible messages
  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  for (const m of localMessages) {
    if (typeof m.content === 'string') messages.push({ role: m.role, content: m.content });
    else messages.push({ role: m.role, content: JSON.stringify(m.content) });
  }

  const body: Record<string, unknown> = { model: request.model, stream: true, messages };
  if (request.tools && (request.tools as unknown[]).length > 0) {
    body.tools = (request.tools as { name: string; description: string; input_schema: unknown }[]).map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }));
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getLocalLLMAuthHeaders(request.apiKey, rawEndpoint),
  };

  (async () => {
    try {
      const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        if (resp.status === 401) {
          callbacks.onError(`Local LLM 401: Unauthorized. Check the Local LLM API key in Settings > AI/LLM matches the token required by the local bridge. ${text}`);
          return;
        }
        if (resp.status === 404) {
          callbacks.onError(`Local LLM 404: ${text}. This usually means the endpoint is not an OpenAI-compatible /v1 chat endpoint, or an Agent Host URL was entered as the Local LLM endpoint.`);
          return;
        }
        if (resp.status === 400 && /prompt|context|token|limit|exceed/i.test(text)) {
          callbacks.onError(`Local LLM 400: the local model rejected the prompt after CaddyAI compaction (${estimatedPromptChars.toLocaleString()} estimated characters). Try a fresh chat or a narrower tool/profile selection. Raw response: ${text}`);
          return;
        }
        callbacks.onError(`Local LLM ${resp.status}: ${text}`);
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) { callbacks.onError('No response body'); return; }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let stopReason: string | null = null;
      const toolCallAccum: Record<number, { id: string; name: string; arguments: string }> = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const choice = parsed.choices?.[0];
            if (!choice) continue;

            // Stream text chunks
            const content = choice.delta?.content;
            if (content) { fullText += content; callbacks.onChunk(content); }

            // Accumulate tool_calls across deltas
            if (choice.delta?.tool_calls) {
              for (const tc of choice.delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCallAccum[idx]) toolCallAccum[idx] = { id: '', name: '', arguments: '' };
                if (tc.id) toolCallAccum[idx].id = tc.id;
                if (tc.function?.name) toolCallAccum[idx].name = tc.function.name;
                if (tc.function?.arguments) toolCallAccum[idx].arguments += tc.function.arguments;
              }
            }

            if (choice.finish_reason) stopReason = choice.finish_reason;
          } catch { /* skip malformed SSE */ }
        }
      }

      // Build content blocks
      const contentBlocks: unknown[] = [];
      const toolEntries = Object.values(toolCallAccum);

      // Add tool_use blocks from structured tool_calls
      if (toolEntries.length > 0) {
        if (fullText) contentBlocks.push({ type: 'text', text: fullText });
        for (const tc of toolEntries) {
          let parsedArgs = {};
          try { parsedArgs = JSON.parse(tc.arguments); } catch { /* empty */ }
          contentBlocks.push({ type: 'tool_use', id: tc.id || `tc_${Date.now()}`, name: tc.name, input: parsedArgs });
        }
      } else if (fullText) {
        const toolNames = ((request.tools || []) as { name: string }[]).map(t => t.name);
        const jsonBlocks = parseLocalContentBlocksFromText(fullText, toolNames);
        if (jsonBlocks.length > 0) {
          contentBlocks.push(...jsonBlocks);
          if (jsonBlocks.some((b) => b.type === 'tool_use')) {
            stopReason = 'tool_calls';
          }
        } else {
        // Fallback: parse tool calls from text output (for models that don't support function calling)
        const textCalls = parseTextToolCalls(fullText, toolNames);
        if (textCalls.length > 0) {
          // Strip tool_call tags from displayed text
          const cleanText = fullText
            .replace(/<(?:tool_call|function_call)>\s*[\s\S]*?\s*<\/(?:tool_call|function_call)>/gi, '')
            .replace(/```json\s*\n?\s*\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:[\s\S]*?\}\s*\n?\s*```/gi, '')
            .trim();
          if (cleanText) contentBlocks.push({ type: 'text', text: cleanText });
          for (const tc of textCalls) {
            contentBlocks.push(tc);
          }
          stopReason = 'tool_calls';
        } else {
          contentBlocks.push({ type: 'text', text: fullText });
        }
        }
      }

      const normalizedStop = stopReason === 'tool_calls' ? 'tool_use'
        : stopReason === 'stop' ? 'end_turn'
        : stopReason || 'end_turn';

      callbacks.onDone(normalizedStop, contentBlocks);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      callbacks.onError((err as Error).message || 'Local LLM request failed');
    }
  })();

  return requestId;
}

/** Parse tool calls from text output for local LLMs that don't support structured function calling. */
export function parseLocalContentBlocksFromText(
  text: string,
  toolNames: string[],
): ({ type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> })[] {
  const parsed = parseJsonish(text);
  const blocks = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.contentBlocks) ? parsed.contentBlocks
      : isRecord(parsed) && Array.isArray(parsed.content) ? parsed.content
        : null;
  if (!blocks) return [];

  const allowedTools = new Set(toolNames);
  const contentBlocks: ({ type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> })[] = [];
  let toolIndex = 0;
  for (const block of blocks) {
    if (!isRecord(block)) continue;
    if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
      contentBlocks.push({ type: 'text', text: block.text });
      continue;
    }
    if (block.type !== 'tool_use' || typeof block.name !== 'string') continue;
    if (allowedTools.size > 0 && !allowedTools.has(block.name)) continue;
    contentBlocks.push({
      type: 'tool_use',
      id: typeof block.id === 'string' && block.id ? block.id : `dtc_json_${Date.now()}_${toolIndex++}`,
      name: block.name,
      input: isRecord(block.input) ? block.input : {},
    });
  }

  return contentBlocks;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonish(text: string): unknown {
  const candidates = jsonCandidates(text);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (typeof parsed === 'string') {
        try { return JSON.parse(parsed) as unknown; } catch { return parsed; }
      }
      return parsed;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function jsonCandidates(text: string): string[] {
  const trimmed = text.trim();
  const candidates = [trimmed];
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) candidates.push(fenced[1].trim());
  const firstArray = trimmed.indexOf('[');
  const lastArray = trimmed.lastIndexOf(']');
  if (firstArray !== -1 && lastArray > firstArray) {
    candidates.push(trimmed.slice(firstArray, lastArray + 1));
  }
  const firstObject = trimmed.indexOf('{');
  const lastObject = trimmed.lastIndexOf('}');
  if (firstObject !== -1 && lastObject > firstObject) {
    candidates.push(trimmed.slice(firstObject, lastObject + 1));
  }
  return Array.from(new Set(candidates));
}

function parseTextToolCalls(text: string, toolNames: string[]): { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }[] {
  const calls: { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }[] = [];
  const nameSet = new Set(toolNames);
  let idx = 0;

  // Pattern 1: <tool_call>JSON</tool_call>
  const tagPattern = /<(?:tool_call|function_call)>\s*([\s\S]*?)\s*<\/(?:tool_call|function_call)>/gi;
  let match;
  while ((match = tagPattern.exec(text)) !== null) {
    try {
      const obj = JSON.parse(match[1]);
      const name = obj.name || obj.function;
      const args = obj.arguments || obj.parameters || obj.input || {};
      if (name && nameSet.has(name)) {
        calls.push({ type: 'tool_use', id: `dtc_${Date.now()}_${idx++}`, name, input: typeof args === 'string' ? JSON.parse(args) : args });
      }
    } catch { /* skip */ }
  }
  if (calls.length > 0) return calls;

  // Pattern 2: ```json blocks
  const jsonPattern = /```(?:json)?\s*\n?([\s\S]*?)\n?```/gi;
  while ((match = jsonPattern.exec(text)) !== null) {
    try {
      const obj = JSON.parse(match[1]);
      const name = obj.name || obj.function;
      const args = obj.arguments || obj.parameters || obj.input || {};
      if (name && nameSet.has(name)) {
        calls.push({ type: 'tool_use', id: `dtc_${Date.now()}_${idx++}`, name, input: typeof args === 'string' ? JSON.parse(args) : args });
      }
    } catch { /* skip */ }
  }
  return calls;
}

export function resolveRoutingMode(
  mode: LLMRoutingMode | undefined,
  extensionAvailable: boolean,
  serverConnected: boolean,
): 'extension' | 'server' {
  if (mode === 'server') return serverConnected ? 'server' : 'extension';
  if (mode === 'extension') return extensionAvailable ? 'extension' : (serverConnected ? 'server' : 'extension');
  // auto: prefer server when connected, fallback to extension
  if (serverConnected) return 'server';
  return 'extension';
}

/**
 * Send an LLM request via the extension bridge (postMessage protocol).
 */
export function sendViaExtension(
  request: LLMRouteRequest,
  callbacks: LLMRouteCallbacks,
  signal?: AbortSignal,
): string {
  const requestId = nanoid();
  const routeRequest = compactLocalRouteRequest(request);

  function handler(event: MessageEvent) {
    if (event.source !== window || !event.data) return;
    if (event.data.requestId !== requestId) return;

    if (event.data.type === 'TC_LLM_CHUNK') {
      callbacks.onChunk(event.data.content);
    } else if (event.data.type === 'TC_LLM_DONE') {
      window.removeEventListener('message', handler);
      callbacks.onDone(
        event.data.stopReason || 'end_turn',
        event.data.contentBlocks || [],
        event.data.usage ? { input: event.data.usage.input || 0, output: event.data.usage.output || 0 } : undefined,
      );
    } else if (event.data.type === 'TC_LLM_ERROR') {
      window.removeEventListener('message', handler);
      callbacks.onError(event.data.error);
    }
  }

  window.addEventListener('message', handler);

  if (signal) {
    signal.addEventListener('abort', () => {
      window.removeEventListener('message', handler);
      window.postMessage({ type: 'TC_LLM_ABORT', requestId }, postMessageOrigin());
    }, { once: true });
  }

  window.postMessage({
    type: 'TC_LLM_REQUEST',
    requestId,
    payload: {
      provider: routeRequest.provider,
      model: routeRequest.model,
      messages: routeRequest.messages,
      apiKey: routeRequest.apiKey,
      systemPrompt: routeRequest.systemPrompt,
      tools: routeRequest.tools,
      endpoint: routeRequest.endpoint,
    },
  }, postMessageOrigin());

  return requestId;
}

/**
 * Send an LLM request via the team server proxy (SSE).
 * The server uses its own API keys, so the client doesn't send them.
 */
export function sendViaServer(
  request: LLMRouteRequest,
  callbacks: LLMRouteCallbacks,
  signal?: AbortSignal,
): string {
  const requestId = nanoid();
  const routeRequest = compactLocalRouteRequest(request);

  // Accumulate text content to build contentBlocks on done
  let accumulatedText = '';

  streamLLMChat(
    {
      provider: routeRequest.provider,
      model: routeRequest.model,
      messages: routeRequest.messages as { role: string; content: string }[],
      systemPrompt: routeRequest.systemPrompt,
      tools: routeRequest.tools,
    },
    (text) => {
      accumulatedText += text;
      callbacks.onChunk(text);
    },
    (stopReason, contentBlocks, usage) => {
      // If server sends contentBlocks, use them; otherwise synthesize from accumulated text
      const blocks = contentBlocks && contentBlocks.length > 0
        ? contentBlocks
        : accumulatedText ? [{ type: 'text', text: accumulatedText }] : [];
      callbacks.onDone(stopReason, blocks, usage);
    },
    (error) => callbacks.onError(error),
    signal,
  );

  return requestId;
}
