import { describe, it, expect } from 'vitest';
import { resolveAssistantLLMConfig, resolveCaddyAiConfig } from '../lib/assistant-llm-config';
import type { Settings } from '../types';

const base = {
  llmDefaultProvider: 'anthropic', llmDefaultModel: 'claude-sonnet-4-6',
  llmAnthropicApiKey: 'a', llmOpenAIApiKey: 'o',
} as unknown as Settings;

describe('assistant/caddyai split', () => {
  it('shares CaddyAI when not separated', () => {
    expect(resolveAssistantLLMConfig(base).model).toBe('claude-sonnet-4-6');
  });
  it('uses its own model when separated, without touching CaddyAI', () => {
    const s = { ...base, assistantLlmSeparate: true,
      assistantLlmDefaultProvider: 'openai', assistantLlmDefaultModel: 'gpt-5.4' } as Settings;
    expect(resolveAssistantLLMConfig(s).model).toBe('gpt-5.4');
    expect(resolveAssistantLLMConfig(s).provider).toBe('openai');
    expect(resolveCaddyAiConfig(s).model).toBe('claude-sonnet-4-6');
  });
});
