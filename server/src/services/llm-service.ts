import type { LLMChatRequest } from '../types.js';

export interface LLMUsageData {
  inputTokens: number;
  outputTokens: number;
}

interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone: (stopReason: string, contentBlocks?: unknown[], usage?: LLMUsageData) => void;
  onError: (error: string) => void;
}

const RASTER_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/avif',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function getAnthropicImageData(block: unknown): { mimeType: string; data: string } | null {
  if (!isRecord(block) || block.type !== 'image' || !isRecord(block.source)) return null;
  const mimeType = String(block.source.media_type || '').trim().toLowerCase();
  const data = String(block.source.data || '').trim();
  if (!RASTER_IMAGE_MIME_TYPES.has(mimeType) || !data) return null;
  return { mimeType, data };
}

function convertMessagesForOpenAI(
  messages: LLMChatRequest['messages'],
  systemPrompt?: string,
): Array<Record<string, unknown>> {
  const converted: Array<Record<string, unknown>> = systemPrompt
    ? [{ role: 'system', content: systemPrompt }]
    : [];

  for (const message of messages) {
    if (!Array.isArray(message.content)) {
      converted.push({ role: message.role, content: message.content });
      continue;
    }

    if (message.role === 'assistant') {
      let textContent = '';
      const toolCalls: Array<Record<string, unknown>> = [];
      for (const block of message.content) {
        if (isRecord(block) && block.type === 'text' && typeof block.text === 'string') {
          textContent += block.text;
        } else if (isRecord(block) && block.type === 'tool_use') {
          toolCalls.push({
            id: String(block.id || ''),
            type: 'function',
            function: {
              name: String(block.name || ''),
              arguments: JSON.stringify(block.input || {}),
            },
          });
        }
      }
      const next: Record<string, unknown> = { role: 'assistant', content: textContent || null };
      if (toolCalls.length > 0) next.tool_calls = toolCalls;
      converted.push(next);
      continue;
    }

    if (message.role === 'user') {
      const parts: Array<Record<string, unknown>> = [];
      let hasImage = false;
      for (const block of message.content) {
        if (isRecord(block) && block.type === 'text' && typeof block.text === 'string' && block.text) {
          parts.push({ type: 'text', text: block.text });
          continue;
        }
        const image = getAnthropicImageData(block);
        if (image) {
          hasImage = true;
          parts.push({
            type: 'image_url',
            image_url: { url: `data:${image.mimeType};base64,${image.data}` },
          });
          continue;
        }
        if (isRecord(block) && block.type === 'tool_result') {
          converted.push({
            role: 'tool',
            tool_call_id: String(block.tool_use_id || ''),
            content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? ''),
          });
        }
      }
      if (parts.length > 0) {
        converted.push({
          role: 'user',
          content: hasImage ? parts : parts.map(part => String(part.text || '')).join(''),
        });
      }
      continue;
    }

    converted.push({ role: message.role, content: JSON.stringify(message.content) });
  }

  return converted;
}

function convertMessagesForGemini(messages: LLMChatRequest['messages']) {
  return messages.map(message => {
    const parts: Array<Record<string, unknown>> = [];
    if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (isRecord(block) && block.type === 'text' && typeof block.text === 'string') {
          parts.push({ text: block.text });
          continue;
        }
        const image = getAnthropicImageData(block);
        if (image) {
          parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
          continue;
        }
        if (isRecord(block) && block.type === 'tool_use') {
          parts.push({ functionCall: { name: String(block.name || ''), args: block.input || {} } });
          continue;
        }
        if (isRecord(block) && block.type === 'tool_result') {
          parts.push({
            functionResponse: {
              name: String(block.tool_use_id || ''),
              response: { result: block.content ?? '' },
            },
          });
        }
      }
    } else {
      parts.push({ text: message.content });
    }

    return {
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: parts.length > 0 ? parts : [{ text: '' }],
    };
  });
}

function getApiKey(provider: string): string {
  switch (provider) {
    case 'anthropic': return process.env.ANTHROPIC_API_KEY || '';
    case 'openai': return process.env.OPENAI_API_KEY || '';
    case 'gemini': return process.env.GEMINI_API_KEY || '';
    case 'mistral': return process.env.MISTRAL_API_KEY || '';
    case 'local': return process.env.LOCAL_LLM_API_KEY || process.env.CODEX_API_TOKEN || '';
    default: return '';
  }
}

function normalizeOpenAICompatibleBase(rawEndpoint: string): string {
  const trimmed = rawEndpoint.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed.endsWith('/v1')) return trimmed;
  if (trimmed.endsWith('/v1/chat/completions')) return trimmed.slice(0, -'/chat/completions'.length);
  if (trimmed.endsWith('/chat/completions')) return trimmed.slice(0, -'/chat/completions'.length);
  return `${trimmed}/v1`;
}

function getLocalEndpoint(): string {
  return normalizeOpenAICompatibleBase(
    process.env.LOCAL_LLM_ENDPOINT
      || process.env.THREATCADDY_LOCAL_LLM_ENDPOINT
      || process.env.CODEX_API_ENDPOINT
      || ''
  );
}

function getLocalModels(): string[] {
  const configured = process.env.LOCAL_LLM_MODEL || process.env.THREATCADDY_LOCAL_LLM_MODEL || process.env.CODEX_API_SERVED_MODEL_NAME;
  if (configured) return [configured];
  return ['gpt-5.4'];
}

async function streamAnthropic(req: LLMChatRequest, cb: StreamCallbacks, signal: AbortSignal) {
  const apiKey = getApiKey('anthropic');
  if (!apiKey) { cb.onError('ANTHROPIC_API_KEY not configured'); return; }

  const body: Record<string, unknown> = {
    model: req.model,
    max_tokens: 4096,
    messages: req.messages,
    stream: true,
  };
  if (req.systemPrompt) body.system = req.systemPrompt;
  if (req.tools && req.tools.length > 0) body.tools = req.tools;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    cb.onError(`Anthropic API error ${resp.status}: ${errText}`);
    return;
  }

  const reader = resp.body?.getReader();
  if (!reader) { cb.onError('No response body'); return; }
  const decoder = new TextDecoder();
  let buffer = '';
  let stopReason = 'end_turn';
  const contentBlocks: unknown[] = [];
  let currentBlockIndex = -1;
  const usage: LLMUsageData = { inputTokens: 0, outputTokens: 0 };

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
        const event = JSON.parse(data);
        if (event.type === 'message_start' && event.message?.usage) {
          usage.inputTokens = event.message.usage.input_tokens || 0;
        }
        if (event.type === 'content_block_start') {
          currentBlockIndex = event.index;
          const block = event.content_block;
          if (block.type === 'text') contentBlocks[currentBlockIndex] = { type: 'text', text: '' };
          else if (block.type === 'tool_use') contentBlocks[currentBlockIndex] = { type: 'tool_use', id: block.id, name: block.name, input: '' };
        }
        if (event.type === 'content_block_delta') {
          const block = contentBlocks[event.index] as Record<string, unknown> | undefined;
          if (event.delta?.type === 'text_delta' && event.delta.text) {
            if (block) (block as { text: string }).text += event.delta.text;
            cb.onChunk(event.delta.text);
          } else if (event.delta?.type === 'input_json_delta' && event.delta.partial_json) {
            if (block) (block as { input: string }).input += event.delta.partial_json;
          }
        }
        if (event.type === 'content_block_stop') {
          const block = contentBlocks[event.index] as Record<string, unknown> | undefined;
          if (block && block.type === 'tool_use' && typeof block.input === 'string') {
            try { block.input = JSON.parse(block.input as string); } catch { block.input = {}; }
          }
        }
        if (event.type === 'message_delta') {
          if (event.delta?.stop_reason) stopReason = event.delta.stop_reason;
          if (event.usage?.output_tokens) usage.outputTokens = event.usage.output_tokens;
        }
      } catch { /* skip malformed JSON */ }
    }
  }

  cb.onDone(stopReason, contentBlocks, usage.inputTokens > 0 ? usage : undefined);
}

async function streamOpenAI(req: LLMChatRequest, cb: StreamCallbacks, signal: AbortSignal) {
  const apiKey = getApiKey('openai');
  if (!apiKey) { cb.onError('OPENAI_API_KEY not configured'); return; }

  const messages = convertMessagesForOpenAI(req.messages, req.systemPrompt);

  const body: Record<string, unknown> = {
    model: req.model,
    messages,
    stream: true,
    max_tokens: 4096,
  };
  if (req.tools && req.tools.length > 0) body.tools = req.tools;

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    cb.onError(`OpenAI API error ${resp.status}: ${errText}`);
    return;
  }

  const reader = resp.body?.getReader();
  if (!reader) { cb.onError('No response body'); return; }
  const decoder = new TextDecoder();
  let buffer = '';
  let textContent = '';
  let stopReason = 'end_turn';
  const toolCallAccum: Record<number, { id: string; name: string; arguments: string }> = {};

  const finish = () => {
    const contentBlocks: unknown[] = [];
    if (textContent) contentBlocks.push({ type: 'text', text: textContent });
    for (const toolCall of Object.values(toolCallAccum)) {
      let parsedArguments: Record<string, unknown> = {};
      try {
        parsedArguments = JSON.parse(toolCall.arguments || '{}') as Record<string, unknown>;
      } catch {
        parsedArguments = {};
      }
      contentBlocks.push({
        type: 'tool_use',
        id: toolCall.id || `srv_openai_tc_${Date.now()}_${contentBlocks.length}`,
        name: toolCall.name,
        input: parsedArguments,
      });
    }
    cb.onDone(Object.keys(toolCallAccum).length > 0 ? 'tool_use' : stopReason, contentBlocks);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') { finish(); return; }
      try {
        const event = JSON.parse(data);
        const choice = event.choices?.[0];
        const delta = choice?.delta;
        if (delta?.content) {
          textContent += delta.content;
          cb.onChunk(delta.content);
        }
        if (Array.isArray(delta?.tool_calls)) {
          for (const toolCall of delta.tool_calls) {
            const index = toolCall.index ?? 0;
            if (!toolCallAccum[index]) toolCallAccum[index] = { id: '', name: '', arguments: '' };
            if (toolCall.id) toolCallAccum[index].id = toolCall.id;
            if (toolCall.function?.name) toolCallAccum[index].name = toolCall.function.name;
            if (toolCall.function?.arguments) toolCallAccum[index].arguments += toolCall.function.arguments;
          }
        }
        if (choice?.finish_reason) {
          stopReason = choice.finish_reason === 'tool_calls' ? 'tool_use' : choice.finish_reason === 'stop' ? 'end_turn' : choice.finish_reason;
        }
      } catch { /* skip */ }
    }
  }

  finish();
}

async function streamLocal(req: LLMChatRequest, cb: StreamCallbacks, signal: AbortSignal) {
  const endpoint = getLocalEndpoint();
  if (!endpoint) {
    cb.onError('LOCAL_LLM_ENDPOINT or CODEX_API_ENDPOINT not configured');
    return;
  }

  const messages = req.systemPrompt
    ? [{ role: 'system', content: req.systemPrompt }, ...req.messages]
    : req.messages;

  const body: Record<string, unknown> = {
    model: req.model,
    messages,
    stream: true,
    max_tokens: 4096,
  };
  if (req.tools && req.tools.length > 0) body.tools = req.tools;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const apiKey = getApiKey('local');
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const resp = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    cb.onError(`Local LLM API error ${resp.status}: ${errText}`);
    return;
  }

  const reader = resp.body?.getReader();
  if (!reader) { cb.onError('No response body'); return; }
  const decoder = new TextDecoder();
  let buffer = '';
  const contentBlocks: unknown[] = [];
  let textContent = '';
  let stopReason = 'end_turn';
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
      if (data === '[DONE]') break;
      try {
        const event = JSON.parse(data);
        const choice = event.choices?.[0];
        const delta = choice?.delta;
        if (delta?.content) {
          textContent += delta.content;
          cb.onChunk(delta.content);
        }
        if (Array.isArray(delta?.tool_calls)) {
          for (const toolCall of delta.tool_calls) {
            const index = toolCall.index ?? 0;
            if (!toolCallAccum[index]) toolCallAccum[index] = { id: '', name: '', arguments: '' };
            if (toolCall.id) toolCallAccum[index].id = toolCall.id;
            if (toolCall.function?.name) toolCallAccum[index].name = toolCall.function.name;
            if (toolCall.function?.arguments) toolCallAccum[index].arguments += toolCall.function.arguments;
          }
        }
        if (choice?.finish_reason) {
          stopReason = choice.finish_reason === 'tool_calls' ? 'tool_use' : choice.finish_reason === 'stop' ? 'end_turn' : choice.finish_reason;
        }
      } catch { /* skip */ }
    }
  }

  if (textContent) contentBlocks.push({ type: 'text', text: textContent });
  for (const toolCall of Object.values(toolCallAccum)) {
    let parsedArguments: Record<string, unknown> = {};
    try {
      parsedArguments = JSON.parse(toolCall.arguments || '{}') as Record<string, unknown>;
    } catch {
      parsedArguments = {};
    }
    contentBlocks.push({
      type: 'tool_use',
      id: toolCall.id || `srv_local_tc_${Date.now()}_${contentBlocks.length}`,
      name: toolCall.name,
      input: parsedArguments,
    });
  }

  cb.onDone(Object.keys(toolCallAccum).length > 0 ? 'tool_use' : stopReason, contentBlocks);
}

async function streamGemini(req: LLMChatRequest, cb: StreamCallbacks, signal: AbortSignal) {
  const apiKey = getApiKey('gemini');
  if (!apiKey) { cb.onError('GEMINI_API_KEY not configured'); return; }

  const contents = convertMessagesForGemini(req.messages);

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { maxOutputTokens: 4096 },
  };
  if (req.systemPrompt) {
    body.systemInstruction = { parts: [{ text: req.systemPrompt }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${req.model}:streamGenerateContent?key=${apiKey}&alt=sse`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    cb.onError(`Gemini API error ${resp.status}: ${errText}`);
    return;
  }

  const reader = resp.body?.getReader();
  if (!reader) { cb.onError('No response body'); return; }
  const decoder = new TextDecoder();
  let buffer = '';
  const contentBlocks: unknown[] = [];
  let stopReason = 'end_turn';
  let usage: LLMUsageData | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      try {
        const event = JSON.parse(data);
        const candidate = event.candidates?.[0];
        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.text) {
              cb.onChunk(part.text);
              let textBlock = contentBlocks.find((block) => isRecord(block) && block.type === 'text') as { type: 'text'; text: string } | undefined;
              if (!textBlock) {
                textBlock = { type: 'text', text: '' };
                contentBlocks.push(textBlock);
              }
              textBlock.text += part.text;
            }
            if (part.functionCall) {
              contentBlocks.push({
                type: 'tool_use',
                id: `srv_gemini_tc_${Date.now()}_${contentBlocks.length}`,
                name: part.functionCall.name,
                input: part.functionCall.args || {},
              });
            }
          }
        }
        if (candidate?.finishReason) {
          if (candidate.finishReason === 'STOP') stopReason = 'end_turn';
          else if (candidate.finishReason === 'MAX_TOKENS') stopReason = 'max_tokens';
          else stopReason = candidate.finishReason;
        }
        if (event.usageMetadata) {
          usage = {
            inputTokens: event.usageMetadata.promptTokenCount || 0,
            outputTokens: event.usageMetadata.candidatesTokenCount || 0,
          };
        }
      } catch { /* skip */ }
    }
  }

  const hasToolUse = contentBlocks.some((block) => isRecord(block) && block.type === 'tool_use');
  cb.onDone(hasToolUse && stopReason !== 'max_tokens' ? 'tool_use' : stopReason, contentBlocks, usage);
}

async function streamMistral(req: LLMChatRequest, cb: StreamCallbacks, signal: AbortSignal) {
  const apiKey = getApiKey('mistral');
  if (!apiKey) { cb.onError('MISTRAL_API_KEY not configured'); return; }

  const messages = req.systemPrompt
    ? [{ role: 'system', content: req.systemPrompt }, ...req.messages]
    : req.messages;

  const resp = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: req.model,
      messages,
      stream: true,
      max_tokens: 4096,
    }),
    signal,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    cb.onError(`Mistral API error ${resp.status}: ${errText}`);
    return;
  }

  const reader = resp.body?.getReader();
  if (!reader) { cb.onError('No response body'); return; }
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') { cb.onDone('end_turn', [], undefined); return; }
      try {
        const event = JSON.parse(data);
        const delta = event.choices?.[0]?.delta;
        if (delta?.content) cb.onChunk(delta.content);
      } catch { /* skip */ }
    }
  }

  cb.onDone('end_turn', [], undefined);
}

export async function streamLLM(
  req: LLMChatRequest,
  callbacks: StreamCallbacks,
  signal: AbortSignal
): Promise<void> {
  const provider = req.provider;

  switch (provider) {
    case 'anthropic':
      return streamAnthropic(req, callbacks, signal);
    case 'openai':
      return streamOpenAI(req, callbacks, signal);
    case 'gemini':
      return streamGemini(req, callbacks, signal);
    case 'mistral':
      return streamMistral(req, callbacks, signal);
    case 'local':
      return streamLocal(req, callbacks, signal);
    default:
      callbacks.onError(`Unsupported provider: ${provider}`);
  }
}

export function getAvailableProviders(): Array<{ provider: string; models: string[] }> {
  const providers: Array<{ provider: string; models: string[] }> = [];

  if (process.env.ANTHROPIC_API_KEY) {
    providers.push({
      provider: 'anthropic',
      models: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414'],
    });
  }
  if (process.env.OPENAI_API_KEY) {
    providers.push({
      provider: 'openai',
      models: ['gpt-5.4', 'gpt-5.4-pro', 'gpt-5.2', 'gpt-5-mini', 'o3', 'o4-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'],
    });
  }
  if (process.env.GEMINI_API_KEY) {
    providers.push({
      provider: 'gemini',
      models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite'],
    });
  }
  if (process.env.MISTRAL_API_KEY) {
    providers.push({
      provider: 'mistral',
      models: ['mistral-large-latest', 'mistral-small-latest'],
    });
  }
  if (getLocalEndpoint()) {
    providers.push({
      provider: 'local',
      models: getLocalModels(),
    });
  }

  return providers;
}
