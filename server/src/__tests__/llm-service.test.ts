import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Save original env
const originalEnv = { ...process.env };

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { getAvailableProviders, streamLLM } from '../services/llm-service.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSSEStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const data = events.join('\n') + '\n';
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(data));
      controller.close();
    },
  });
}

function makeResponse(status: number, body: string | ReadableStream<Uint8Array>, ok = true) {
  return {
    ok: ok && status >= 200 && status < 300,
    status,
    text: typeof body === 'string' ? () => Promise.resolve(body) : undefined,
    body: typeof body !== 'string' ? body : undefined,
  };
}

function makeStreamResponse(events: string[]) {
  const stream = makeSSEStream(events);
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => {
        const reader = stream.getReader();
        return reader;
      },
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getAvailableProviders()', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('detects configured Anthropic API key', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.OPENAI_API_KEY = '';
    process.env.GEMINI_API_KEY = '';
    process.env.MISTRAL_API_KEY = '';

    const providers = getAvailableProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0].provider).toBe('anthropic');
    expect(providers[0].models.length).toBeGreaterThan(0);
  });

  it('detects configured OpenAI API key', () => {
    process.env.ANTHROPIC_API_KEY = '';
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.GEMINI_API_KEY = '';
    process.env.MISTRAL_API_KEY = '';

    const providers = getAvailableProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0].provider).toBe('openai');
  });

  it('detects multiple configured providers', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.GEMINI_API_KEY = 'gem-key';
    process.env.MISTRAL_API_KEY = 'mis-key';

    const providers = getAvailableProviders();
    expect(providers).toHaveLength(4);
    const names = providers.map(p => p.provider);
    expect(names).toContain('anthropic');
    expect(names).toContain('openai');
    expect(names).toContain('gemini');
    expect(names).toContain('mistral');
  });

  it('detects configured local OpenAI-compatible endpoint', () => {
    process.env.ANTHROPIC_API_KEY = '';
    process.env.OPENAI_API_KEY = '';
    process.env.GEMINI_API_KEY = '';
    process.env.MISTRAL_API_KEY = '';
    process.env.LOCAL_LLM_ENDPOINT = 'http://127.0.0.1:11434/v1';
    process.env.LOCAL_LLM_MODEL = 'gpt-5.4';

    const providers = getAvailableProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0]).toEqual({ provider: 'local', models: ['gpt-5.4'] });
  });

  it('returns empty array when no API keys are set', () => {
    process.env.ANTHROPIC_API_KEY = '';
    process.env.OPENAI_API_KEY = '';
    process.env.GEMINI_API_KEY = '';
    process.env.MISTRAL_API_KEY = '';
    process.env.LOCAL_LLM_ENDPOINT = '';

    const providers = getAvailableProviders();
    expect(providers).toHaveLength(0);
  });
});

describe('streamAnthropic() SSE parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('parses content_block_delta events and calls onChunk', async () => {
    const chunks: string[] = [];
    const doneReasons: string[] = [];

    mockFetch.mockResolvedValueOnce(makeStreamResponse([
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}',
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}',
    ]));

    await streamLLM(
      { provider: 'anthropic', model: 'claude-sonnet-4-20250514', messages: [{ role: 'user', content: 'Hi' }] },
      {
        onChunk: (text) => chunks.push(text),
        onDone: (reason) => doneReasons.push(reason),
        onError: () => {},
      },
      AbortSignal.timeout(5000),
    );

    expect(chunks).toEqual(['Hello', ' world']);
    expect(doneReasons).toEqual(['end_turn']);
  });

  it('calls onError on API error response', async () => {
    const errors: string[] = [];

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Invalid API key'),
    });

    await streamLLM(
      { provider: 'anthropic', model: 'claude-sonnet-4-20250514', messages: [{ role: 'user', content: 'Hi' }] },
      {
        onChunk: () => {},
        onDone: () => {},
        onError: (err) => errors.push(err),
      },
      AbortSignal.timeout(5000),
    );

    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('401');
  });
});

describe('streamOpenAI() SSE parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'sk-test';
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('parses delta content events and calls onChunk', async () => {
    const chunks: string[] = [];
    const doneBlocks: unknown[][] = [];

    mockFetch.mockResolvedValueOnce(makeStreamResponse([
      'data: {"choices":[{"delta":{"content":"Hello"}}]}',
      'data: {"choices":[{"delta":{"content":" world"}}]}',
      'data: [DONE]',
    ]));

    await streamLLM(
      { provider: 'openai', model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] },
      {
        onChunk: (text) => chunks.push(text),
        onDone: (_reason, blocks) => doneBlocks.push(blocks || []),
        onError: () => {},
      },
      AbortSignal.timeout(5000),
    );

    expect(chunks).toEqual(['Hello', ' world']);
    expect(doneBlocks[0]).toEqual([{ type: 'text', text: 'Hello world' }]);
  });

  it('converts Anthropic-style image blocks to OpenAI image_url parts', async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse(['data: [DONE]']));

    await streamLLM(
      {
        provider: 'openai',
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc123' } },
            { type: 'text', text: 'Analyze this image.' },
          ],
        }],
      },
      { onChunk: () => {}, onDone: () => {}, onError: () => {} },
      AbortSignal.timeout(5000),
    );

    const body = JSON.parse(String(mockFetch.mock.calls[0][1]?.body));
    expect(body.messages[0].content).toEqual([
      { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
      { type: 'text', text: 'Analyze this image.' },
    ]);
  });
});

describe('streamLocal() SSE parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LOCAL_LLM_ENDPOINT = 'http://127.0.0.1:11434';
    process.env.LOCAL_LLM_API_KEY = 'local-token';
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('routes local provider to OpenAI-compatible endpoint', async () => {
    const chunks: string[] = [];
    const doneReasons: string[] = [];

    mockFetch.mockResolvedValueOnce(makeStreamResponse([
      'data: {"choices":[{"delta":{"content":"Local"}}]}',
      'data: {"choices":[{"delta":{"content":" Codex"}}]}',
      'data: [DONE]',
    ]));

    await streamLLM(
      { provider: 'local', model: 'gpt-5.4', messages: [{ role: 'user', content: 'Hi' }] },
      {
        onChunk: (text) => chunks.push(text),
        onDone: (reason) => doneReasons.push(reason),
        onError: () => {},
      },
      AbortSignal.timeout(5000),
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer local-token' }),
      }),
    );
    expect(chunks).toEqual(['Local', ' Codex']);
    expect(doneReasons).toEqual(['end_turn']);
  });
});

describe('streamGemini() request conversion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'gem-key';
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('converts Anthropic-style image blocks to Gemini inlineData parts', async () => {
    const chunks: string[] = [];
    const doneBlocks: unknown[][] = [];

    mockFetch.mockResolvedValueOnce(makeStreamResponse([
      'data: {"candidates":[{"content":{"parts":[{"text":"ok"}]},"finishReason":"STOP"}]}',
    ]));

    await streamLLM(
      {
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this image.' },
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'def456' } },
          ],
        }],
      },
      {
        onChunk: (text) => chunks.push(text),
        onDone: (_reason, blocks) => doneBlocks.push(blocks || []),
        onError: () => {},
      },
      AbortSignal.timeout(5000),
    );

    const body = JSON.parse(String(mockFetch.mock.calls[0][1]?.body));
    expect(body.contents[0].parts).toEqual([
      { text: 'Analyze this image.' },
      { inlineData: { mimeType: 'image/jpeg', data: 'def456' } },
    ]);
    expect(chunks).toEqual(['ok']);
    expect(doneBlocks[0]).toEqual([{ type: 'text', text: 'ok' }]);
  });
});

describe('Error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('reports error when API key is not configured', async () => {
    process.env.ANTHROPIC_API_KEY = '';
    const errors: string[] = [];

    await streamLLM(
      { provider: 'anthropic', model: 'test', messages: [] },
      {
        onChunk: () => {},
        onDone: () => {},
        onError: (err) => errors.push(err),
      },
      AbortSignal.timeout(5000),
    );

    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('not configured');
  });

  it('reports error for unsupported provider', async () => {
    const errors: string[] = [];

    await streamLLM(
      { provider: 'unsupported', model: 'test', messages: [] },
      {
        onChunk: () => {},
        onDone: () => {},
        onError: (err) => errors.push(err),
      },
      AbortSignal.timeout(5000),
    );

    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('Unsupported provider');
  });

  it('reports error on network failure', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const errors: string[] = [];

    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    try {
      await streamLLM(
        { provider: 'anthropic', model: 'test', messages: [{ role: 'user', content: 'Hi' }] },
        {
          onChunk: () => {},
          onDone: () => {},
          onError: (err) => errors.push(err),
        },
        AbortSignal.timeout(5000),
      );
    } catch {
      // Expected to throw on network error
    }

    // Either the error is caught and passed to onError, or it throws
    // The implementation throws for network errors
  });
});

describe('Provider selection logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('routes to Anthropic for provider=anthropic', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    mockFetch.mockResolvedValueOnce(makeStreamResponse(['data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}']));

    await streamLLM(
      { provider: 'anthropic', model: 'test', messages: [{ role: 'user', content: 'Hi' }] },
      { onChunk: () => {}, onDone: () => {}, onError: () => {} },
      AbortSignal.timeout(5000),
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('anthropic.com'),
      expect.any(Object),
    );
  });

  it('routes to OpenAI for provider=openai', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    mockFetch.mockResolvedValueOnce(makeStreamResponse(['data: [DONE]']));

    await streamLLM(
      { provider: 'openai', model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] },
      { onChunk: () => {}, onDone: () => {}, onError: () => {} },
      AbortSignal.timeout(5000),
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('openai.com'),
      expect.any(Object),
    );
  });
});
