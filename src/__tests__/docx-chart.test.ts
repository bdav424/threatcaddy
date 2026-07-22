import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  assembleStandaloneChartDocx,
  buildChartCacheXlsx,
  buildChartXml,
  parseChartXml,
  validateChartDocx,
} from '../lib/docx-chart';
import { resolveChartModel } from '../lib/chart-model';
import { buildStructuralDocxBytes, unzip, zipStored } from '../lib/docx-template-renderer';
import type { ProductBaselineStructuralMap } from '../types';

function barModel() {
  return resolveChartModel([
    ['Severity', 'Count'],
    ['Critical', '3'],
    ['High', '7'],
    ['Medium', '12'],
    ['Low', '5'],
  ], { forcedType: 'bar' });
}

describe('native Word chart emission (CaddyLab Stage 5b)', () => {
  it('emits a chartSpace whose plotted numCache round-trips back to the source model (bar)', () => {
    const model = barModel();
    const parsed = parseChartXml(buildChartXml(model));
    expect(parsed.type).toBe('bar');
    expect(parsed.categories).toEqual(['Critical', 'High', 'Medium', 'Low']);
    expect(parsed.series).toEqual([{ name: 'Count', values: [3, 7, 12, 5] }]);
  });

  it('round-trips a multi-series stacked bar', () => {
    const model = resolveChartModel([
      ['Team', 'Open', 'Closed'],
      ['Alpha', '5', '20'],
      ['Bravo', '8', '15'],
    ], { forcedType: 'stackedBar' });
    const xml = buildChartXml(model);
    expect(xml).toContain('<c:grouping val="stacked"/>');
    expect(xml).toContain('<c:overlap val="100"/>');
    const parsed = parseChartXml(xml);
    expect(parsed.type).toBe('stackedBar');
    expect(parsed.series.map((s) => s.name)).toEqual(['Open', 'Closed']);
    expect(parsed.series[0].values).toEqual([5, 8]);
    expect(parsed.series[1].values).toEqual([20, 15]);
  });

  it('round-trips a line chart over a time-like axis', () => {
    const model = resolveChartModel([
      ['Month', 'Incidents'],
      ['2026-01', '4'],
      ['2026-02', '9'],
      ['2026-03', '6'],
    ]);
    const xml = buildChartXml(model);
    expect(xml).toContain('<c:lineChart>');
    const parsed = parseChartXml(xml);
    expect(parsed.type).toBe('line');
    expect(parsed.series[0].values).toEqual([4, 9, 6]);
  });

  it('emits per-slice colored data points for a pie', () => {
    const model = barModel();
    const pie = resolveChartModel([
      ['Severity', 'Count'],
      ['Critical', '3'],
      ['High', '7'],
      ['Medium', '12'],
    ], { forcedType: 'pie' });
    const xml = buildChartXml(pie);
    expect(xml).toContain('<c:pieChart>');
    expect((xml.match(/<c:dPt>/g) || []).length).toBe(3);
    expect(parseChartXml(xml).type).toBe('pie');
    // sanity: bar model still distinct
    expect(parseChartXml(buildChartXml(model)).type).toBe('bar');
  });

  it('lays scatter x/y values into xVal and yVal numeric references', () => {
    const model = resolveChartModel([
      ['X', 'Y'],
      ['1', '10'],
      ['2', '14'],
      ['3', '9'],
    ]);
    const xml = buildChartXml(model);
    expect(xml).toContain('<c:scatterChart>');
    expect(xml).toContain('<c:xVal>');
    expect(xml).toContain('<c:yVal>');
    const parsed = parseChartXml(xml);
    expect(parsed.type).toBe('scatter');
    expect(parsed.series[0].values).toEqual([1, 2, 3]);
    expect(parsed.series[1].values).toEqual([10, 14, 9]);
  });

  it('builds an embedded data-cache workbook whose cells match the model', () => {
    const model = barModel();
    const workbook = XLSX.read(buildChartCacheXlsx(model), { type: 'array' });
    const grid = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: true }) as unknown[][];
    expect(grid[0]).toEqual(['', 'Count']);
    expect(grid[1]).toEqual(['Critical', 3]);
    expect(grid[4]).toEqual(['Low', 5]);
  });
});

describe('chart validation harness (CaddyLab Stage 5b)', () => {
  it('passes a well-formed standalone chart docx with all parts wired', () => {
    const result = validateChartDocx(assembleStandaloneChartDocx(barModel()));
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('passes standalone docx for every chart family', () => {
    const grids: Record<string, string[][]> = {
      bar: [['A', 'V'], ['x', '1'], ['y', '2']],
      line: [['Month', 'V'], ['2026-01', '1'], ['2026-02', '2']],
      pie: [['A', 'V'], ['x', '1'], ['y', '2'], ['z', '3']],
    };
    for (const [type, grid] of Object.entries(grids)) {
      const model = resolveChartModel(grid, { forcedType: type as 'bar' });
      const result = validateChartDocx(assembleStandaloneChartDocx(model));
      expect(result.errors, `${type} errors`).toEqual([]);
    }
  });

  it('flags a missing embedded workbook (dangling chart relationship)', () => {
    const docx = assembleStandaloneChartDocx(barModel());
    const entries = unzip(docx).filter((entry) => !entry.path.startsWith('word/embeddings/'));
    // Re-zip without the embedding using the same stored-zip path the emitter uses.
    const broken = zipStored(entries);
    const result = validateChartDocx(broken);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/embedding not found/i);
  });

  it('flags a chart whose plotted value disagrees with its embedded cache', () => {
    const docx = assembleStandaloneChartDocx(barModel());
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const entries = unzip(docx).map((entry) => {
      if (entry.path === 'word/charts/chart1.xml') {
        // Corrupt one plotted value so it no longer matches the cache workbook.
        const xml = decoder.decode(entry.data).replace('<c:v>3</c:v>', '<c:v>999</c:v>');
        return { path: entry.path, data: encoder.encode(xml) };
      }
      return entry;
    });
    const result = validateChartDocx(zipStored(entries));
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/!= cache cell/i);
  });
});

describe('chart injection into a template (CaddyLab Stage 5b wiring)', () => {
  function templateWithSection() {
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` +
      `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Findings</w:t></w:r></w:p>` +
      `<w:p><w:r><w:t>Old findings text.</w:t></w:r></w:p>` +
      `<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body></w:document>`;
    return zipStored([
      { path: '[Content_Types].xml', data: new TextEncoder().encode('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>') },
      { path: '_rels/.rels', data: new TextEncoder().encode('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>') },
      { path: 'word/_rels/document.xml.rels', data: new TextEncoder().encode('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>') },
      { path: 'word/document.xml', data: new TextEncoder().encode(documentXml) },
    ]);
  }

  const structuralMap: ProductBaselineStructuralMap = {
    schemaVersion: 1,
    sections: [{ key: 'findings', heading: 'Findings', level: 1, order: 0, hasTable: false, paragraphCount: 1 }],
    palette: [],
    figures: [],
    tableCount: 0,
    figurePlaceholderCount: 0,
  };

  it('replaces a [[chart:key]] token in section content with a native chart, and the output validates', () => {
    const model = barModel();
    const markdown = '## Findings\n\nHere is the breakdown.\n\n[[chart:findings]]';
    const output = buildStructuralDocxBytes(templateWithSection(), markdown, structuralMap, [], [{ key: 'findings', model }]);

    const result = validateChartDocx(output);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);

    const entries = unzip(output);
    const documentXml = new TextDecoder().decode(entries.find((e) => e.path === 'word/document.xml')!.data);
    expect(documentXml).toContain('<c:chart');
    expect(documentXml).not.toContain('[[chart:findings]]'); // token consumed
    expect(documentXml).toContain('Here is the breakdown.'); // surrounding text kept
    expect(entries.some((e) => e.path === 'word/charts/chart1.xml')).toBe(true);
    expect(entries.some((e) => /^word\/embeddings\/.*\.xlsx$/.test(e.path))).toBe(true);
  });
});
