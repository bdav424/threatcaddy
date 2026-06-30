// src/lib/assistant-llm-config.ts
//
// Separates ThreatCaddy AI (CaddyAI) from AssistantCaddy AI.
//
// CaddyAI keeps the existing llmDefaultProvider / llmDefaultModel (and the per-provider
// API-key pool). AssistantCaddy gets its own assistantLlm* fields. The API keys stay
// shared and keyed by provider, so the user enters each key once and either AI can use it.
//
// When settings.assistantLlmSeparate is false/undefined, AssistantCaddy transparently
// reuses CaddyAI's config — so nothing changes until the user opts into a separate model.

import type { Settings, LLMProvider } from '../types';

export interface ResolvedLLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  /** Only set for the 'local' provider. */
  endpoint?: string;
  systemPrompt?: string;
}

const DEFAULT_MODEL_PER_PROVIDER: Record<LLMProvider, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-5.4',
  gemini: 'gemini-2.5-pro',
  mistral: 'mistral-large-latest',
  local: '',
};

function apiKeyFor(provider: LLMProvider, s: Settings): string | undefined {
  switch (provider) {
    case 'anthropic': return s.llmAnthropicApiKey;
    case 'openai': return s.llmOpenAIApiKey;
    case 'gemini': return s.llmGeminiApiKey;
    case 'mistral': return s.llmMistralApiKey;
    case 'local': return s.assistantLlmLocalApiKey ?? s.llmLocalApiKey;
  }
}

/** ThreatCaddy AI (CaddyAI) — the existing baseline. Unchanged behavior. */
export function resolveCaddyAiConfig(s: Settings): ResolvedLLMConfig {
  const provider = (s.llmDefaultProvider ?? 'anthropic') as LLMProvider;
  return {
    provider,
    model: s.llmDefaultModel || s.llmLocalModelName || DEFAULT_MODEL_PER_PROVIDER[provider],
    apiKey: apiKeyFor(provider, s),
    endpoint: provider === 'local' ? s.llmLocalEndpoint : undefined,
    systemPrompt: s.llmSystemPrompt,
  };
}

/** AssistantCaddy AI — its own provider/model, or CaddyAI's when not separated. */
export function resolveAssistantLLMConfig(s: Settings): ResolvedLLMConfig {
  if (!s.assistantLlmSeparate) return resolveCaddyAiConfig(s);

  const provider = (s.assistantLlmDefaultProvider
    ?? s.llmDefaultProvider
    ?? 'anthropic') as LLMProvider;

  const model = s.assistantLlmDefaultModel
    || (provider === 'local'
      ? (s.assistantLlmLocalModelName || s.llmLocalModelName || '')
      : DEFAULT_MODEL_PER_PROVIDER[provider]);

  return {
    provider,
    model,
    apiKey: apiKeyFor(provider, s),
    endpoint: provider === 'local'
      ? (s.assistantLlmLocalEndpoint ?? s.llmLocalEndpoint)
      : provider === 'openai' && s.assistantLlmOpenAIBaseUrl?.trim()
        ? s.assistantLlmOpenAIBaseUrl.trim()
        : undefined,
    systemPrompt: s.assistantLlmSystemPrompt ?? s.llmSystemPrompt,
  };
}

/** True when AssistantCaddy is configured to run on its own model. */
export function assistantUsesSeparateAi(s: Settings): boolean {
  return s.assistantLlmSeparate === true;
}
