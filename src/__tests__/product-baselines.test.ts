import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import type { ToolUseBlock } from '../types';
import { executeTool } from '../lib/llm-tools';
import { exportJSON, importJSON } from '../lib/export';
import {
  buildBaselineFromDocumentText,
  buildDerivedBaselineFromDocx,
  createProductFromSections,
  importProductBaselinePackage,
  normalizeProductRenderContextInput,
  PRODUCT_BASELINE_PACKAGE_SCHEMA,
  PRODUCT_BASELINE_TAG,
  PRODUCT_NOTE_TAG,
  renderJinjaTemplate,
  serializeProductBaselinePackage,
  stageSectionContent,
  suggestSectionMapping,
} from '../lib/product-baselines';

function makeToolUse(name: string, input: Record<string, unknown> = {}): ToolUseBlock {
  return { type: 'tool_use', id: `tool-${name}`, name, input };
}


describe('product baselines', () => {
  beforeEach(async () => {
    await db.notes.clear();
    await db.tasks.clear();
    await db.folders.clear();
    await db.noteTemplates.clear();
    await db.standaloneIOCs.clear();
    await db.timelineEvents.clear();
    await db.evidenceItems.clear();
  });

  it('renders a safe Jinja-compatible loop and conditional', () => {
    const rendered = renderJinjaTemplate(
      `{% if findings %}{% for finding in findings %}- {{ finding.title }}: {{ finding.summary }}\n{% endfor %}{% endif %}`,
      { findings: [{ title: 'One', summary: 'Alpha' }, { title: 'Two', summary: 'Beta' }] },
    );

    expect(rendered).toContain('- One: Alpha');
    expect(rendered).toContain('- Two: Beta');
  });

  it('keeps loop-generated table rows and bullets on separate lines', () => {
    const rendered = renderJinjaTemplate(
      [
        '| Type | Value |',
        '| --- | --- |',
        '{% for ioc in iocs %}',
        '| {{ ioc.type }} | {{ ioc.value }} |',
        '{% endfor %}',
        '',
        '{% for source in sources %}',
        '- {{ source.title }}',
        '{% endfor %}',
      ].join('\n'),
      {
        iocs: [
          { type: 'domain', value: 'timetrakr.cloud' },
          { type: 'url', value: 'https://timetrakr.cloud/sp.ps1' },
        ],
        sources: [
          { title: 'Symantec Threat Hunter Team' },
          { title: 'BleepingComputer' },
        ],
      },
    );

    expect(rendered).toContain('| domain | timetrakr.cloud |\n| url | https://timetrakr.cloud/sp.ps1 |');
    expect(rendered).toContain('- Symantec Threat Hunter Team\n- BleepingComputer');
  });

  it('normalizes daily-country fixture context into baseline variables', () => {
    const context = normalizeProductRenderContextInput({
      title: 'Seedworm Intrusion Activity Targeting South Korean Electronics Sector',
      date: '25 May 2026',
      country: 'South Korea',
      sources: [{ marker: '1', name: 'Symantec Threat Hunter Team', url: 'https://example.test/report' }],
      iocs: [{ type: 'domain', value: 'timetrakr.cloud', description: 'PowerShell retrieval domain' }],
    });

    const rendered = renderJinjaTemplate(
      '{{ generatedDate }}\n{{ executiveSummary }}\n{% for ioc in iocs %}{{ ioc.type }} {{ ioc.value }} {{ ioc.context }} {{ ioc.lastSeen }} {{ ioc.confidence }}{% endfor %}\n{% for source in sources %}{{ source.marker }} {{ source.title }}{% endfor %}',
      context,
    );

    expect(rendered).toContain('25 May 2026');
    expect(rendered).toContain('affecting South Korea');
    expect(rendered).toContain('domain timetrakr.cloud PowerShell retrieval domain not live validated Medium');
    expect(rendered).toContain('1 Symantec Threat Hunter Team');
  });

  it('does not ship INTEL product baselines as baked-in app code', async () => {
    const { result } = await executeTool(makeToolUse('list_product_baselines'));
    const parsed = JSON.parse(result);

    expect(parsed.count).toBe(0);
    expect(parsed.baselines.some((baseline: { id: string }) => baseline.id === 'pb-analysis-report')).toBe(false);
  });

  it('imports a product baseline package as an artifact-backed template', async () => {
    const imported = await importProductBaselinePackage(JSON.stringify({
      schemaVersion: PRODUCT_BASELINE_PACKAGE_SCHEMA,
      kind: 'product-baseline',
      baseline: {
        id: 'daily-country-intel-note',
        name: 'Daily Country Intel Note',
        content: '# {{ title }}\n\n## Executive Summary\n\n{{ executiveSummary }}',
        tags: ['daily-country'],
        productBaseline: {
          schemaVersion: 1,
          kind: 'markdown',
          productType: 'intel-note',
          renderer: 'markdown',
          visualFidelity: 'structural',
          sourceDocuments: [
            { name: 'INTEL_Intel_Note_Trifleck_Blockstar.docx', type: 'docx', role: 'intel-note-word-template-sample' },
          ],
          testFixtures: [
            { name: 'INTEL_Intel_Note_Seedworm_South_Korea.docx', type: 'docx', role: 'daily-country-render-test-fixture' },
          ],
          layoutNotes: ['Preserve INTEL Intel Note first-page header and restricted footer.'],
          sourceNoteRules: ['Use Source and Conf. fields for evidence provenance where present.'],
        },
      },
    }), 'daily-country-intel-note.tc-product-baseline.json');

    expect(imported.tags).toContain(PRODUCT_BASELINE_TAG);
    expect(imported.productBaseline?.productType).toBe('intel-note');
    expect(imported.productBaseline?.sourceDocuments?.[0]?.name).toContain('Trifleck');
    expect(imported.productBaseline?.testFixtures?.[0]?.name).toContain('Seedworm');

    const { result } = await executeTool(makeToolUse('list_product_baselines'));
    const parsed = JSON.parse(result);
    expect(parsed.count).toBe(1);
    expect(parsed.baselines[0].productBaseline.visualFidelity).toBe('structural');
    expect(parsed.baselines[0].productBaseline.sourceDocuments[0]).toContain('Trifleck');
    expect(parsed.baselines[0].productBaseline.testFixtures[0]).toContain('Seedworm');
    expect(serializeProductBaselinePackage(imported)).toContain(PRODUCT_BASELINE_PACKAGE_SCHEMA);
  });

  it('round-trips baseline authority and render fixtures through backup export/import', async () => {
    const docxTemplateData = 'A'.repeat(600_000);
    const imported = await importProductBaselinePackage(JSON.stringify({
      schemaVersion: PRODUCT_BASELINE_PACKAGE_SCHEMA,
      kind: 'product-baseline',
      baseline: {
        id: 'intel-note-with-fixtures',
        name: 'Intel Note With Fixtures',
        content: '# {{ title }}',
        productBaseline: {
          schemaVersion: 1,
          kind: 'markdown',
          productType: 'intel-note',
          renderer: 'markdown',
          visualFidelity: 'structural',
          sourceDocuments: [
            { name: 'INTEL_Intel_Note_Trifleck_Blockstar.docx', type: 'docx', role: 'intel-note-word-template-sample' },
          ],
          testFixtures: [
            { name: 'INTEL_Intel_Note_Seedworm_South_Korea.docx', type: 'docx', role: 'daily-country-render-output' },
            { name: 'South Korea INTEL_intel_note_context.json', type: 'json', role: 'daily-country-content-context' },
          ],
          assets: [
            { name: 'INTEL_Intel_Note_Trifleck_Blockstar.docx', role: 'docx-template', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: docxTemplateData },
          ],
        },
      },
    }), 'intel-note-with-fixtures.tc-product-baseline.json');

    const backup = await exportJSON();
    await db.noteTemplates.clear();
    await importJSON(backup);

    const restored = await db.noteTemplates.get(imported.id);
    expect(restored?.productBaseline?.sourceDocuments?.[0]?.name).toContain('Trifleck');
    expect(restored?.productBaseline?.testFixtures?.[0]?.role).toBe('daily-country-render-output');
    expect(restored?.productBaseline?.testFixtures?.[1]?.type).toBe('json');
    expect(restored?.productBaseline?.assets?.[0]?.data?.length).toBe(docxTemplateData.length);
  });

  it('creates and renders a custom product baseline as a product note', async () => {
    await db.folders.add({ id: 'f1', name: 'Weaponized Clipboard', order: 0, createdAt: Date.now(), clsLevel: 'TLP:AMBER' });
    await db.notes.add({
      id: 'source-1',
      title: 'Source Finding',
      content: 'The actor used clipboard content to stage follow-on activity.',
      folderId: 'f1',
      tags: [],
      pinned: false,
      archived: false,
      trashed: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const created = await executeTool(makeToolUse('create_product_baseline', {
      name: 'Test Product Baseline',
      content: '# {{ title }}\n\n{{ executiveSummary }}\n\n{% for source in sources %}- {{ source.title }}\n{% endfor %}',
      tags: ['test'],
    }));
    const createdParsed = JSON.parse(created.result);
    expect(createdParsed.success).toBe(true);

    const storedBaseline = await db.noteTemplates.get(createdParsed.id);
    expect(storedBaseline?.tags).toContain(PRODUCT_BASELINE_TAG);

    const rendered = await executeTool(makeToolUse('render_product_baseline', {
      baselineId: createdParsed.id,
      title: 'Clipboard Product',
      context: { executiveSummary: 'Executive summary text.' },
    }), 'f1');
    const renderedParsed = JSON.parse(rendered.result);
    expect(renderedParsed.success).toBe(true);

    const product = await db.notes.get(renderedParsed.id);
    expect(product?.title).toBe('Clipboard Product');
    expect(product?.tags).toContain(PRODUCT_NOTE_TAG);
    expect(product?.content).toContain('Executive summary text.');
    expect(product?.content).toContain('Source Finding');
  });

  it('builds a markdown baseline from PDF/DOCX-extracted text, with the source file recorded as provenance', () => {
    const built = buildBaselineFromDocumentText(
      'Executive Summary\n\nThe actor established persistence via a scheduled task.',
      'Q3 Incident Report.pdf',
      'pdf',
    );

    expect(built.name).toBe('Q3 Incident Report');
    expect(built.content).toContain('scheduled task');
    expect(built.category).toBe('Product Baseline');
    expect(built.tags).toContain(PRODUCT_BASELINE_TAG);
    expect(built.productBaseline?.kind).toBe('markdown');
    expect(built.productBaseline?.renderer).toBe('markdown');
    expect(built.productBaseline?.sourceDocuments?.[0]).toMatchObject({
      name: 'Q3 Incident Report.pdf',
      type: 'pdf',
    });
  });

  it('rejects building a baseline from empty extracted text', () => {
    expect(() => buildBaselineFromDocumentText('   ', 'empty.docx', 'docx')).toThrow(/no readable text/i);
  });
});

describe('CaddyLab Stage 2 — section wand', () => {
  beforeEach(async () => {
    await db.notes.clear();
    await db.folders.clear();
  });

  it('maps common report headings to known investigation-data fields', () => {
    expect(suggestSectionMapping('Timeline of Significant Events')?.contextKey).toBe('timelineEvents');
    expect(suggestSectionMapping('Digital Identifiers')?.contextKey).toBe('iocs');
    expect(suggestSectionMapping('Sources')?.contextKey).toBe('sources');
    expect(suggestSectionMapping('Recommendations')?.contextKey).toBe('recommendations');
    expect(suggestSectionMapping('Executive Summary')?.contextKey).toBe('executiveSummary');
    expect(suggestSectionMapping('Notable Incidents')).toBeUndefined();
    expect(suggestSectionMapping('Appendix')).toBeUndefined();
  });

  it('stages real timeline/IOC/source data as rendered markdown, and treats placeholder text as empty', () => {
    const timelineMapping = suggestSectionMapping('Timeline');
    const staged = stageSectionContent(timelineMapping, {
      timelineEvents: [
        { date: '2026-02-01', title: 'Initial access', eventType: 'intrusion', description: 'Phishing email opened' },
      ],
    });
    expect(staged).toContain('| Date | Event | Type |');
    expect(staged).toContain('Initial access');
    expect(staged).toContain('Phishing email opened');

    const execMapping = suggestSectionMapping('Executive Summary');
    expect(stageSectionContent(execMapping, { executiveSummary: 'Draft executive summary pending analyst review.' })).toBe('');
    expect(stageSectionContent(execMapping, { executiveSummary: 'A real analyst-written summary.' })).toBe('A real analyst-written summary.');

    expect(stageSectionContent(undefined, { executiveSummary: 'anything' })).toBe('');
  });

  it('stages IOC and source data as markdown tables/lists', () => {
    const iocStaged = stageSectionContent(suggestSectionMapping('Indicators'), {
      iocs: [{ type: 'domain', value: 'evil.example', context: 'C2', confidence: 'High' }],
    });
    expect(iocStaged).toContain('| Type | Value | Context | Confidence |');
    expect(iocStaged).toContain('evil.example');

    const sourcesStaged = stageSectionContent(suggestSectionMapping('Sources'), {
      sources: [{ title: 'Vendor Report A' }, { title: 'Vendor Report B' }],
    });
    expect(sourcesStaged).toBe('- Vendor Report A\n- Vendor Report B');
  });

  it('assembles wand sections into a product note tagged the same way the AI render path tags one', async () => {
    await db.folders.add({ id: 'f-wand', name: 'Wand Test Investigation', order: 0, createdAt: Date.now(), clsLevel: 'TLP:AMBER' });
    const folder = (await db.folders.get('f-wand'))!;
    const baseline = {
      id: 'baseline-wand', name: 'Wand Baseline', content: '', category: 'Product Baseline',
      source: 'user' as const, createdAt: Date.now(), updatedAt: Date.now(),
    };

    const product = await createProductFromSections(folder, baseline, [
      { heading: 'Executive Summary', content: 'Real analyst-written summary.' },
      { heading: 'Appendix', content: '' },
    ], 'Wand Test Product');

    expect(product.title).toBe('Wand Test Product');
    expect(product.folderId).toBe('f-wand');
    expect(product.tags).toContain(PRODUCT_NOTE_TAG);
    expect(product.tags).toContain('baseline:baseline-wand');
    expect(product.content).toContain('## Executive Summary');
    expect(product.content).toContain('Real analyst-written summary.');
    expect(product.content).toContain('## Appendix');
    expect(product.content).toContain('_No content provided for this section._');

    const stored = await db.notes.get(product.id);
    expect(stored?.title).toBe('Wand Test Product');
  });

  it('preserves structuralMap through normalization so the Fill Sections wand can find it (regression)', () => {
    const structuralMap = {
      schemaVersion: 1 as const,
      sections: [
        { key: 'executive-summary', heading: 'Executive Summary', level: 1, order: 0, hasTable: false, paragraphCount: 1 },
        { key: 'timeline', heading: 'Timeline', level: 1, order: 1, hasTable: true, paragraphCount: 0 },
      ],
      palette: [{ hex: '1F4E79', usage: 'accent' as const, count: 3 }],
      figures: [],
      tableCount: 1,
      figurePlaceholderCount: 0,
    };

    const built = buildDerivedBaselineFromDocx('wand-test.docx', 'ZmFrZS1kb2N4LWJ5dGVz', structuralMap);

    expect(built.productBaseline?.structuralMap).toEqual(structuralMap);
  });
});
