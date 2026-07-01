import { describe, expect, it } from 'vitest';
import {
  compactMessagesForLocal,
  compactSystemPromptForLocal,
  compactToolResultForModel,
  estimateLocalPromptChars,
  LOCAL_PROMPT_TARGET_CHARS,
} from '../lib/llm-prompt-budget';

describe('llm prompt budget helpers', () => {
  it('turns oversized tool results into compact cache references', () => {
    const rawResult = JSON.stringify({
      data: Array.from({ length: 1_000 }, (_, index) => ({
        id: `ioc-${index}`,
        value: 'A'.repeat(80),
      })),
    });

    const compacted = compactToolResultForModel('host__cti__virustotal_ioc_bundle', 'tool-1', rawResult, {
      maxChars: 2_000,
    });

    expect(compacted.length).toBeLessThan(rawResult.length);
    const parsed = JSON.parse(compacted) as Record<string, unknown>;
    expect(parsed.schema).toBe('caddyai.tool_result_ref.v1');
    expect(parsed.cached).toBe(true);
    expect(parsed.tool_name).toBe('host__cti__virustotal_ioc_bundle');
    expect(parsed.original_chars).toBe(rawResult.length);
    expect(String(parsed.preview)).toContain('characters omitted');
  });

  it('preserves tool_use blocks while compacting tool_result blocks', () => {
    const messages = compactMessagesForLocal(
      [
        { role: 'user', content: 'Investigate this IOC' },
        {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'tool-1', name: 'search_notes', input: { query: 'ioc' } }],
        },
        {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: 'tool-1',
            content: 'X'.repeat(20_000),
          }],
        },
      ],
      { targetChars: 8_000, maxToolResultChars: 1_500 },
    );

    const assistantContent = messages[1].content as Record<string, unknown>[];
    const resultContent = messages[2].content as Record<string, unknown>[];
    expect(assistantContent[0]).toMatchObject({ type: 'tool_use', id: 'tool-1', name: 'search_notes' });
    expect(String(resultContent[0].content)).toContain('caddyai.tool_result_ref.v1');
    expect(String(resultContent[0].content).length).toBeLessThan(20_000);
  });

  it('omits older middle messages when the local prompt budget is tight', () => {
    const messages = Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `message-${index} ${'A'.repeat(3_000)}`,
    }));

    const compacted = compactMessagesForLocal(messages, {
      targetChars: 10_000,
      maxMessageChars: 2_000,
      maxRecentMessageChars: 2_000,
      preserveRecentMessages: 3,
    });

    expect(compacted[0].content).toContain('message-0');
    expect(compacted.some(message => String(message.content).includes('older messages omitted'))).toBe(true);
    expect(compacted.at(-1)?.content).toContain('message-11');
    expect(estimateLocalPromptChars({ messages: compacted })).toBeLessThanOrEqual(LOCAL_PROMPT_TARGET_CHARS);
  });

  it('caps long local system prompts', () => {
    const compacted = compactSystemPromptForLocal(`system ${'S'.repeat(80_000)}`, 8_000);
    expect(compacted?.length).toBeLessThanOrEqual(8_000);
    expect(compacted).toContain('local system-prompt budget');
  });
});
