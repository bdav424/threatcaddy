export const LOCAL_PROMPT_CHAR_LIMIT = 200_000;
export const LOCAL_PROMPT_TARGET_CHARS = 160_000;
export const LOCAL_SYSTEM_PROMPT_CHAR_LIMIT = 32_000;
export const LOCAL_MESSAGE_CHAR_LIMIT = 24_000;
export const LOCAL_RECENT_MESSAGE_CHAR_LIMIT = 36_000;
export const LOCAL_TOOL_RESULT_CHAR_LIMIT = 12_000;
export const LOCAL_OVERFLOW_CHUNK_CHAR_LIMIT = 80_000;

interface PromptMessage {
  role: string;
  content: unknown;
}

interface PromptTool {
  name?: string;
  description?: string;
  input_schema?: unknown;
}

interface CompactOptions {
  systemPrompt?: string;
  tools?: unknown[];
  targetChars?: number;
  maxMessageChars?: number;
  maxRecentMessageChars?: number;
  maxToolResultChars?: number;
  preserveRecentMessages?: number;
  keepFirstMessages?: number;
}

interface ToolResultOptions {
  maxChars?: number;
  previewChars?: number;
  isError?: boolean;
}

export interface LocalOverflowChunk {
  index: number;
  messageCount: number;
  charCount: number;
  content: string;
}

export interface LocalOverflowChunkPlan<T extends PromptMessage> {
  retainedMessages: T[];
  chunks: LocalOverflowChunk[];
  estimatedChars: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeStringify(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function contentToPromptString(content: unknown): string {
  return typeof content === 'string' ? content : safeStringify(content);
}

function promptMessageToText(message: PromptMessage, index: number): string {
  return `Message ${index + 1} (${message.role}):\n${contentToPromptString(message.content)}`;
}

function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function truncateMiddle(text: string, maxChars: number, reason = 'local prompt budget'): string {
  if (text.length <= maxChars) return text;
  if (maxChars <= 160) return text.slice(0, Math.max(0, maxChars));

  const omitted = text.length - maxChars;
  const marker = `\n\n[... ${omitted.toLocaleString()} characters omitted for ${reason} ...]\n\n`;
  const remaining = Math.max(0, maxChars - marker.length);
  const head = Math.ceil(remaining * 0.58);
  const tail = Math.floor(remaining * 0.42);
  return `${text.slice(0, head)}${marker}${tail > 0 ? text.slice(-tail) : ''}`;
}

function describeJsonShape(text: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      return {
        json_type: 'array',
        length: parsed.length,
        first_item_keys: isRecord(parsed[0]) ? Object.keys(parsed[0]).slice(0, 20) : undefined,
      };
    }
    if (isRecord(parsed)) {
      return {
        json_type: 'object',
        keys: Object.keys(parsed).slice(0, 40),
      };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function parseJsonRecord(text: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(text) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function compactToolResultForModel(
  toolName: string,
  toolUseId: string,
  content: string,
  options: ToolResultOptions = {},
): string {
  const maxChars = options.maxChars ?? LOCAL_TOOL_RESULT_CHAR_LIMIT;
  if (content.length <= maxChars) return content;

  const previewChars = Math.min(options.previewChars ?? Math.floor(maxChars * 0.72), Math.max(500, maxChars - 1_000));
  const existingRef = parseJsonRecord(content);
  if (existingRef?.schema === 'caddyai.tool_result_ref.v1') {
    return JSON.stringify({
      ...existingRef,
      preview: truncateMiddle(String(existingRef.preview || ''), previewChars, 'cached tool-result preview'),
      preview_chars: previewChars,
      notice: 'The full tool output is retained in CaddyAI tool activity and assistant audit history. This cached preview was further compacted for the local prompt budget.',
    }, null, 2);
  }

  const ref = `tool_result_${toolUseId}_${hashText(`${toolName}:${toolUseId}:${content}`)}`;
  const compact = {
    schema: 'caddyai.tool_result_ref.v1',
    cached: true,
    tool_result_ref: ref,
    tool_name: toolName,
    tool_use_id: toolUseId,
    is_error: options.isError || undefined,
    original_chars: content.length,
    preview_chars: Math.min(content.length, previewChars),
    json_shape: describeJsonShape(content),
    preview: truncateMiddle(content, previewChars, 'cached tool-result preview'),
    notice: 'The full tool output is retained in CaddyAI tool activity and assistant audit history. The local model receives this compact preview to stay within the prompt limit; ask the analyst to inspect the cached result if exact omitted fields are required.',
  };

  return JSON.stringify(compact, null, 2);
}

function compactLargeBlock(block: unknown, options: Required<Pick<CompactOptions, 'maxMessageChars' | 'maxToolResultChars'>>): unknown {
  if (!isRecord(block)) return block;

  if (block.type === 'tool_result' && typeof block.content === 'string') {
    return {
      ...block,
      content: compactToolResultForModel(
        'unknown_tool',
        typeof block.tool_use_id === 'string' ? block.tool_use_id : 'unknown',
        block.content,
        { maxChars: options.maxToolResultChars, isError: block.is_error === true },
      ),
    };
  }

  if (block.type === 'text' && typeof block.text === 'string' && block.text.length > options.maxMessageChars) {
    return {
      ...block,
      text: truncateMiddle(block.text, options.maxMessageChars, 'local message budget'),
    };
  }

  if (isRecord(block.source) && typeof block.source.data === 'string' && block.source.data.length > 2_000) {
    return {
      ...block,
      source: {
        ...block.source,
        data: truncateMiddle(block.source.data, 1_000, 'local image payload budget'),
      },
    };
  }

  return block;
}

function compactContent(content: unknown, maxChars: number, maxToolResultChars: number): unknown {
  if (typeof content === 'string') {
    return truncateMiddle(content, maxChars, 'local message budget');
  }

  if (Array.isArray(content)) {
    return content.map(block => compactLargeBlock(block, { maxMessageChars: maxChars, maxToolResultChars }));
  }

  const serialized = safeStringify(content);
  if (serialized.length <= maxChars) return content;
  return truncateMiddle(serialized, maxChars, 'local message budget');
}

function normalizeLocalTools(tools?: unknown[]): unknown[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return (tools as PromptTool[]).map(t => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
}

export function compactSystemPromptForLocal(systemPrompt?: string, maxChars = LOCAL_SYSTEM_PROMPT_CHAR_LIMIT): string | undefined {
  if (!systemPrompt) return systemPrompt;
  return truncateMiddle(systemPrompt, maxChars, 'local system-prompt budget');
}

export function estimateLocalPromptChars(input: {
  model?: string;
  systemPrompt?: string;
  messages: PromptMessage[];
  tools?: unknown[];
}): number {
  const messages: { role: string; content: string }[] = [];
  if (input.systemPrompt) messages.push({ role: 'system', content: input.systemPrompt });
  for (const message of input.messages) {
    messages.push({ role: message.role, content: contentToPromptString(message.content) });
  }

  const body: Record<string, unknown> = {
    model: input.model || '',
    stream: true,
    messages,
  };
  const tools = normalizeLocalTools(input.tools);
  if (tools) body.tools = tools;
  return JSON.stringify(body).length;
}

export function buildLocalOverflowChunkPlan<T extends PromptMessage>(
  messages: T[],
  options: CompactOptions & { chunkChars?: number } = {},
): LocalOverflowChunkPlan<T> {
  const targetChars = options.targetChars ?? LOCAL_PROMPT_TARGET_CHARS;
  const maxMessageChars = options.maxMessageChars ?? LOCAL_MESSAGE_CHAR_LIMIT;
  const maxRecentMessageChars = options.maxRecentMessageChars ?? LOCAL_RECENT_MESSAGE_CHAR_LIMIT;
  const maxToolResultChars = options.maxToolResultChars ?? LOCAL_TOOL_RESULT_CHAR_LIMIT;
  const preserveRecentMessages = options.preserveRecentMessages ?? 6;
  const keepFirstMessages = options.keepFirstMessages ?? 1;
  const chunkChars = options.chunkChars ?? LOCAL_OVERFLOW_CHUNK_CHAR_LIMIT;

  const compacted = messages.map((message, index) => {
    const isRecent = index >= messages.length - preserveRecentMessages;
    return {
      ...message,
      content: compactContent(message.content, isRecent ? maxRecentMessageChars : maxMessageChars, maxToolResultChars),
    } as T;
  });

  const estimatedChars = estimateLocalPromptChars({
    systemPrompt: options.systemPrompt,
    messages: compacted,
    tools: options.tools,
  });
  if (estimatedChars <= targetChars) {
    return { retainedMessages: compacted, chunks: [], estimatedChars };
  }

  const firstCount = Math.min(keepFirstMessages, compacted.length);
  const recentCount = Math.min(preserveRecentMessages, Math.max(0, compacted.length - firstCount));
  const middleStart = firstCount;
  const middleEnd = Math.max(middleStart, compacted.length - recentCount);
  const overflowMessages = compacted.slice(middleStart, middleEnd);

  if (overflowMessages.length === 0) {
    return { retainedMessages: compacted, chunks: [], estimatedChars };
  }

  const chunks: LocalOverflowChunk[] = [];
  let currentParts: string[] = [];
  let currentChars = 0;
  let currentMessages = 0;

  const flush = () => {
    if (currentParts.length === 0) return;
    const content = currentParts.join('\n\n---\n\n');
    chunks.push({
      index: chunks.length + 1,
      messageCount: currentMessages,
      charCount: content.length,
      content,
    });
    currentParts = [];
    currentChars = 0;
    currentMessages = 0;
  };

  overflowMessages.forEach((message, offset) => {
    const serialized = promptMessageToText(message, middleStart + offset);
    if (currentParts.length > 0 && currentChars + serialized.length > chunkChars) {
      flush();
    }
    if (serialized.length > chunkChars) {
      let cursor = 0;
      while (cursor < serialized.length) {
        chunks.push({
          index: chunks.length + 1,
          messageCount: 1,
          charCount: Math.min(chunkChars, serialized.length - cursor),
          content: serialized.slice(cursor, cursor + chunkChars),
        });
        cursor += chunkChars;
      }
      return;
    }
    currentParts.push(serialized);
    currentChars += serialized.length;
    currentMessages += 1;
  });
  flush();

  const placeholder = {
    ...compacted[Math.max(0, firstCount - 1)],
    role: 'user',
    content: `[System: ${overflowMessages.length} older messages are being processed as ${chunks.length} local overflow chunk${chunks.length === 1 ? '' : 's'}. Chunk digests will be inserted here before the final answer. Full cached tool outputs remain available in CaddyAI tool activity and assistant audit history.]`,
  } as T;

  return {
    retainedMessages: [
      ...compacted.slice(0, firstCount),
      placeholder,
      ...compacted.slice(-recentCount),
    ],
    chunks,
    estimatedChars,
  };
}

export function applyLocalOverflowDigests<T extends PromptMessage>(
  retainedMessages: T[],
  digests: string[],
): T[] {
  if (digests.length === 0) return retainedMessages;
  const digestMessage = {
    role: 'user',
    content: [
      '[Local Overflow Context Digests]',
      'CaddyAI processed older overflow context in bounded local chunks before this final turn. Use these digests as prior context, preserve caveats, and cite cached tool-result refs when exact omitted fields are needed.',
      '',
      ...digests.map((digest, index) => `## Chunk ${index + 1}\n${digest.trim() || '(empty digest)'}`),
    ].join('\n'),
  } as T;

  const placeholderIndex = retainedMessages.findIndex(message =>
    typeof message.content === 'string' && message.content.includes('local overflow chunk')
  );
  if (placeholderIndex === -1) {
    return [digestMessage, ...retainedMessages];
  }
  return retainedMessages.map((message, index) => index === placeholderIndex ? digestMessage : message);
}

export function compactMessagesForLocal<T extends PromptMessage>(
  messages: T[],
  options: CompactOptions = {},
): T[] {
  const targetChars = options.targetChars ?? LOCAL_PROMPT_TARGET_CHARS;
  const maxMessageChars = options.maxMessageChars ?? LOCAL_MESSAGE_CHAR_LIMIT;
  const maxRecentMessageChars = options.maxRecentMessageChars ?? LOCAL_RECENT_MESSAGE_CHAR_LIMIT;
  const maxToolResultChars = options.maxToolResultChars ?? LOCAL_TOOL_RESULT_CHAR_LIMIT;
  const preserveRecentMessages = options.preserveRecentMessages ?? 6;
  const keepFirstMessages = options.keepFirstMessages ?? 1;

  let compacted = messages.map((message, index) => {
    const isRecent = index >= messages.length - preserveRecentMessages;
    return {
      ...message,
      content: compactContent(message.content, isRecent ? maxRecentMessageChars : maxMessageChars, maxToolResultChars),
    } as T;
  });

  const estimate = () => estimateLocalPromptChars({
    systemPrompt: options.systemPrompt,
    messages: compacted,
    tools: options.tools,
  });

  if (estimate() <= targetChars) return compacted;

  const recentCount = Math.min(preserveRecentMessages, Math.max(1, compacted.length - keepFirstMessages));
  const middleCount = compacted.length - keepFirstMessages - recentCount;
  if (middleCount > 0) {
    const omittedMessage: T = {
      ...compacted[Math.max(0, keepFirstMessages - 1)],
      role: 'user',
      content: `[System: ${middleCount} older messages omitted to keep the local LLM prompt under budget. CaddyAI keeps the full chat transcript in the thread.]`,
    } as T;
    compacted = [
      ...compacted.slice(0, keepFirstMessages),
      omittedMessage,
      ...compacted.slice(-recentCount),
    ];
  }

  if (estimate() <= targetChars) return compacted;

  const caps = [16_000, 10_000, 6_000, 3_500, 2_000];
  for (const cap of caps) {
    compacted = compacted.map((message, index) => {
      const isLast = index === compacted.length - 1;
      return {
        ...message,
        content: compactContent(
          message.content,
          isLast ? Math.max(cap, Math.min(maxRecentMessageChars, cap * 2)) : cap,
          Math.min(maxToolResultChars, Math.max(1_500, cap)),
        ),
      } as T;
    });
    if (estimate() <= targetChars) return compacted;
  }

  return compacted;
}
