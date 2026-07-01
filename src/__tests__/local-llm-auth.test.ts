import { describe, expect, it } from 'vitest';
import {
  getLocalLLMAuthHeaders,
  isLoopbackCodexBridgeEndpoint,
  LOCAL_CODEX_BRIDGE_API_KEY,
  resolveLocalLLMApiKey,
} from '../lib/local-llm-auth';

describe('local LLM auth helpers', () => {
  it('recognizes loopback Codex bridge endpoints', () => {
    expect(isLoopbackCodexBridgeEndpoint('http://127.0.0.1:11434/v1')).toBe(true);
    expect(isLoopbackCodexBridgeEndpoint('http://localhost:11434/v1/')).toBe(true);
    expect(isLoopbackCodexBridgeEndpoint('http://127.0.0.1:11434')).toBe(true);
  });

  it('does not treat arbitrary endpoints as the local Codex bridge', () => {
    expect(isLoopbackCodexBridgeEndpoint('http://127.0.0.1:8000/v1')).toBe(false);
    expect(isLoopbackCodexBridgeEndpoint('https://api.openai.com/v1')).toBe(false);
    expect(isLoopbackCodexBridgeEndpoint('not a url')).toBe(false);
  });

  it('uses the Codex bridge token when the local key is blank or placeholder', () => {
    expect(resolveLocalLLMApiKey(undefined, 'http://127.0.0.1:11434/v1')).toBe(LOCAL_CODEX_BRIDGE_API_KEY);
    expect(resolveLocalLLMApiKey('', 'http://127.0.0.1:11434/v1')).toBe(LOCAL_CODEX_BRIDGE_API_KEY);
    expect(resolveLocalLLMApiKey('local', 'http://localhost:11434/v1')).toBe(LOCAL_CODEX_BRIDGE_API_KEY);
  });

  it('preserves explicit custom keys', () => {
    expect(resolveLocalLLMApiKey('custom-token', 'http://127.0.0.1:11434/v1')).toBe('custom-token');
  });

  it('only emits auth headers when an effective key exists', () => {
    expect(getLocalLLMAuthHeaders(undefined, 'http://127.0.0.1:11434/v1')).toEqual({
      Authorization: `Bearer ${LOCAL_CODEX_BRIDGE_API_KEY}`,
    });
    expect(getLocalLLMAuthHeaders(undefined, 'http://127.0.0.1:8000/v1')).toEqual({});
  });
});
