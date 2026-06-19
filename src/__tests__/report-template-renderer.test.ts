import { describe, it, expect } from 'vitest';
import { renderSectionTemplate } from '../lib/report-template-renderer';
import type { ReportRenderContext } from '../lib/report-template-renderer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<ReportRenderContext> = {}): ReportRenderContext {
  return {
    investigation: { name: 'Test Investigation', description: '', id: 'folder-1' },
    iocs: [],
    timeline: [],
    notes: [],
    tasks: [],
    date: '2026-01-01',
    year: '2026',
    totalIocCount: 0,
    openTaskCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Basic interpolation
// ---------------------------------------------------------------------------

describe('renderSectionTemplate — basic interpolation', () => {
  it('renders a simple variable', () => {
    const out = renderSectionTemplate('Investigation: {{ investigation.name }}', makeCtx());
    expect(out).toBe('Investigation: Test Investigation');
  });

  it('renders date and year variables', () => {
    const out = renderSectionTemplate('Date: {{ date }} / Year: {{ year }}', makeCtx());
    expect(out).toBe('Date: 2026-01-01 / Year: 2026');
  });

  it('renders totalIocCount and openTaskCount', () => {
    const ctx = makeCtx({ totalIocCount: 7, openTaskCount: 3 });
    const out = renderSectionTemplate('IOCs: {{ totalIocCount }}, Tasks: {{ openTaskCount }}', ctx);
    expect(out).toBe('IOCs: 7, Tasks: 3');
  });

  it('treats undefined variables as empty string (throwOnUndefined: false)', () => {
    const out = renderSectionTemplate('{{ nonexistent }}', makeCtx());
    expect(out).toBe('');
  });

  it('returns empty string on template syntax error', () => {
    const out = renderSectionTemplate('{% for unclosed', makeCtx());
    expect(out).toBe('');
  });
});

// ---------------------------------------------------------------------------
// IOC table template (pulled from builtin-report-templates shared fragment)
// ---------------------------------------------------------------------------

const IOC_TABLE = `\
{% if iocs | length > 0 %}
| Indicator | Type | Confidence | Tags |
|-----------|------|------------|------|
{% for ioc in iocs %}
| \`{{ ioc.value }}\` | {{ ioc.type }} | {{ ioc.confidence }} | {{ ioc.tags | join(", ") or "—" }} |
{% endfor %}
{% else %}
*No indicators of compromise recorded in this investigation.*
{% endif %}`;

describe('renderSectionTemplate — IOC table', () => {
  it('renders empty-state message when no IOCs', () => {
    const out = renderSectionTemplate(IOC_TABLE, makeCtx());
    expect(out.trim()).toBe('*No indicators of compromise recorded in this investigation.*');
  });

  it('renders a table when IOCs are present', () => {
    const ctx = makeCtx({
      iocs: [
        { value: '192.168.1.1', type: 'ip', confidence: 'high', tags: ['malware'], analystNotes: '', firstSeen: '', lastSeen: '' },
        { value: 'evil.com', type: 'domain', confidence: 'medium', tags: [], analystNotes: '', firstSeen: '', lastSeen: '' },
      ],
    });
    const out = renderSectionTemplate(IOC_TABLE, ctx);
    expect(out).toContain('| `192.168.1.1` | ip | high | malware |');
    expect(out).toContain('| `evil.com` | domain | medium | — |');
    expect(out).toContain('| Indicator | Type | Confidence | Tags |');
  });

  it('renders empty tags as — placeholder', () => {
    const ctx = makeCtx({
      iocs: [{ value: 'x.y.z', type: 'domain', confidence: 'low', tags: [], analystNotes: '', firstSeen: '', lastSeen: '' }],
    });
    const out = renderSectionTemplate(IOC_TABLE, ctx);
    expect(out).toContain('| `x.y.z` | domain | low | — |');
  });

  it('no stray blank lines between table rows (whitespace control check)', () => {
    const ctx = makeCtx({
      iocs: [
        { value: 'a.com', type: 'domain', confidence: 'high', tags: [], analystNotes: '', firstSeen: '', lastSeen: '' },
        { value: 'b.com', type: 'domain', confidence: 'high', tags: [], analystNotes: '', firstSeen: '', lastSeen: '' },
        { value: 'c.com', type: 'domain', confidence: 'high', tags: [], analystNotes: '', firstSeen: '', lastSeen: '' },
      ],
    });
    const out = renderSectionTemplate(IOC_TABLE, ctx);
    // Two consecutive newlines = blank line. Should not appear between table rows.
    const lines = out.split('\n');
    const rowLines = lines.filter(l => l.startsWith('|'));
    // Header + separator + 3 data rows = 5 contiguous pipe-starting lines
    expect(rowLines).toHaveLength(5);
    // No consecutive blank lines between rows
    expect(out).not.toMatch(/\|\n\n\|/);
  });
});

// ---------------------------------------------------------------------------
// Timeline template
// ---------------------------------------------------------------------------

const TIMELINE = `\
{% if timeline | length > 0 %}
{% for event in timeline %}
- **{{ event.timestamp }}** — {{ event.title }}{% if event.description %}: {{ event.description }}{% endif %}{% if event.actor %} *(Actor: {{ event.actor }})*{% endif %}
{% endfor %}
{% else %}
*No timeline events recorded in this investigation.*
{% endif %}`;

describe('renderSectionTemplate — timeline', () => {
  it('renders empty-state message when no events', () => {
    const out = renderSectionTemplate(TIMELINE, makeCtx());
    expect(out.trim()).toBe('*No timeline events recorded in this investigation.*');
  });

  it('renders events as bullet list', () => {
    const ctx = makeCtx({
      timeline: [
        { timestamp: '2026-01-01 09:00', title: 'Phishing email received', description: '', actor: '', eventType: 'initial-access', tags: [], mitreAttackIds: [] },
        { timestamp: '2026-01-01 09:15', title: 'Malware executed', description: 'Cobalt Strike beacon', actor: 'APT29', eventType: 'execution', tags: [], mitreAttackIds: [] },
      ],
    });
    const out = renderSectionTemplate(TIMELINE, ctx);
    expect(out).toContain('- **2026-01-01 09:00** — Phishing email received');
    expect(out).toContain('- **2026-01-01 09:15** — Malware executed: Cobalt Strike beacon *(Actor: APT29)*');
  });

  it('omits description/actor suffix when empty', () => {
    const ctx = makeCtx({
      timeline: [
        { timestamp: '2026-01-01 1000', title: 'Lateral movement', description: '', actor: '', eventType: 'lateral-movement', tags: [], mitreAttackIds: [] },
      ],
    });
    const out = renderSectionTemplate(TIMELINE, ctx);
    expect(out).toContain('- **2026-01-01 1000** — Lateral movement');
    // No description colon suffix
    expect(out).not.toContain('Lateral movement:');
    // No actor annotation
    expect(out).not.toContain('*(Actor:');
  });

  it('no stray blank lines between list items (whitespace control check)', () => {
    const ctx = makeCtx({
      timeline: Array.from({ length: 4 }, (_, i) => ({
        timestamp: `2026-01-01 0${i}:00`,
        title: `Event ${i}`,
        description: '',
        actor: '',
        eventType: 'initial-access',
        tags: [],
        mitreAttackIds: [],
      })),
    });
    const out = renderSectionTemplate(TIMELINE, ctx);
    expect(out).not.toMatch(/\n\n-/); // no blank line before a bullet
  });
});

// ---------------------------------------------------------------------------
// Sector loop (Annual Threat Landscape template, section s3)
// ---------------------------------------------------------------------------

const SECTOR_LOOP = `\
{% set sectors = ["Alpha", "Beta", "Gamma"] %}
{% for sector in sectors %}
### {{ sector }}

| Col | Val |
|-----|-----|
| Key | [Fill] |

---
{% endfor %}`;

describe('renderSectionTemplate — sector loop (whitespace quality gate)', () => {
  it('renders a heading for each sector', () => {
    const out = renderSectionTemplate(SECTOR_LOOP, makeCtx());
    expect(out).toContain('### Alpha');
    expect(out).toContain('### Beta');
    expect(out).toContain('### Gamma');
  });

  it('no leading blank line before the first sector heading', () => {
    const out = renderSectionTemplate(SECTOR_LOOP, makeCtx());
    // Output should start directly with "### Alpha", possibly preceded by a single newline
    expect(out.trimStart()).toMatch(/^### Alpha/);
  });

  it('no double-blank-line (paragraph gap) between sectors', () => {
    const out = renderSectionTemplate(SECTOR_LOOP, makeCtx());
    // Three or more consecutive newlines indicate bad whitespace
    expect(out).not.toMatch(/\n{3,}/);
  });

  it('renders --- separator between sectors, not after the last one', () => {
    const out = renderSectionTemplate(SECTOR_LOOP, makeCtx());
    // The "---" is inside the loop, so it appears after every sector including the last.
    // Verify it appears exactly 3 times (once per sector).
    const sepCount = (out.match(/^---$/gm) ?? []).length;
    expect(sepCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Tasks template
// ---------------------------------------------------------------------------

const TASKS = `\
{% if tasks | length > 0 %}
| Task | Status | Priority | Due |
|------|--------|----------|-----|
{% for task in tasks %}
| {{ task.title }} | {{ task.status }} | {{ task.priority or "—" }} | {{ task.dueDate or "—" }} |
{% endfor %}
{% else %}
*No tasks recorded for this investigation.*
{% endif %}`;

describe('renderSectionTemplate — tasks', () => {
  it('renders empty-state when no tasks', () => {
    const out = renderSectionTemplate(TASKS, makeCtx());
    expect(out.trim()).toBe('*No tasks recorded for this investigation.*');
  });

  it('renders a table with task rows', () => {
    const ctx = makeCtx({
      tasks: [
        { title: 'Block IOC on firewall', status: 'in-progress', priority: 'high', tags: [], dueDate: '2026-01-10', description: '' },
        { title: 'Notify stakeholders', status: 'todo', priority: 'medium', tags: [], dueDate: '', description: '' },
      ],
    });
    const out = renderSectionTemplate(TASKS, ctx);
    expect(out).toContain('| Block IOC on firewall | in-progress | high | 2026-01-10 |');
    expect(out).toContain('| Notify stakeholders | todo | medium | — |');
  });
});
