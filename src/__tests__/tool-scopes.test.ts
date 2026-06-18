import { describe, it, expect } from 'vitest';
import { TOOL_DEFINITIONS } from '../lib/llm-tool-defs';
import {
  toolScope, isToolInScope, getToolDefinitionsForScope, ADMIN_TOOL_NAMES,
} from '../lib/tool-scopes';

describe('strict tool scoping', () => {
  it('every existing tool is investigation-scoped (CaddyAI baseline unchanged)', () => {
    const inv = getToolDefinitionsForScope('investigation', TOOL_DEFINITIONS);
    expect(inv.length).toBe(TOOL_DEFINITIONS.length);
  });

  it('CaddyAI is offered no admin tools', () => {
    const inv = getToolDefinitionsForScope('investigation', TOOL_DEFINITIONS);
    expect(inv.some((t) => ADMIN_TOOL_NAMES.has(t.name))).toBe(false);
  });

  it('admin names resolve to admin and are blocked from investigation', () => {
    expect(toolScope('send_email')).toBe('admin');
    expect(isToolInScope('send_email', 'investigation')).toBe(false);
    expect(isToolInScope('send_email', 'admin')).toBe(true);
  });

  it('investigation names are blocked from the admin assistant', () => {
    expect(toolScope('create_ioc')).toBe('investigation');
    expect(isToolInScope('create_ioc', 'admin')).toBe(false);
  });
});
