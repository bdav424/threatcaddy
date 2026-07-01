import { describe, expect, it } from 'vitest';
import { getLocalLlmHealthUrl, normalizeLocalLlmEndpoint } from '../lib/local-llm-endpoint';

describe('local LLM endpoint helpers', () => {
  it('fills in the Codex bridge port and /v1 for bare loopback endpoints', () => {
    expect(normalizeLocalLlmEndpoint('127.0.0.1')).toBe('http://127.0.0.1:11434/v1');
    expect(normalizeLocalLlmEndpoint('http://localhost')).toBe('http://localhost:11434/v1');
  });

  it('keeps explicit ports and paths intact', () => {
    expect(normalizeLocalLlmEndpoint('http://127.0.0.1:11436/v1')).toBe('http://127.0.0.1:11436/v1');
    expect(normalizeLocalLlmEndpoint('https://example.com/openai')).toBe('https://example.com/openai');
  });

  it('derives the health URL from the normalized endpoint', () => {
    expect(getLocalLlmHealthUrl('127.0.0.1')).toBe('http://127.0.0.1:11434/health');
  });
});
