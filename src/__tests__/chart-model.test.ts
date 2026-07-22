import { describe, expect, it } from 'vitest';
import { parseMarkdownTableRows, parseNumericCell, resolveChartModel } from '../lib/chart-model';

describe('chart-model resolution (CaddyLab Stage 5a — prove the model first)', () => {
  it('parses numeric cells, tolerating currency/percent/thousands formatting', () => {
    expect(parseNumericCell('1,234')).toBe(1234);
    expect(parseNumericCell('$42.5')).toBe(42.5);
    expect(parseNumericCell('87%')).toBe(87);
    expect(parseNumericCell('-3')).toBe(-3);
    expect(parseNumericCell('domain')).toBeNull();
    expect(parseNumericCell('')).toBeNull();
  });

  it('maps a category column + one numeric column into a single series', () => {
    const model = resolveChartModel([
      ['Severity', 'Count'],
      ['Critical', '3'],
      ['High', '7'],
      ['Medium', '12'],
    ]);
    expect(model.categoryColumnIndex).toBe(0);
    expect(model.numericColumnIndexes).toEqual([1]);
    expect(model.series).toHaveLength(1);
    expect(model.series[0]).toEqual({ name: 'Count', values: [3, 7, 12] });
    expect(model.categories).toEqual(['Critical', 'High', 'Medium']);
  });

  it('suggests pie for a single series across a few categories', () => {
    const model = resolveChartModel([
      ['Severity', 'Count'],
      ['Critical', '3'],
      ['High', '7'],
      ['Medium', '12'],
    ]);
    expect(model.type).toBe('pie');
    expect(model.suggestionReason).toMatch(/parts of a whole/i);
    // Pie plots only the one series; one color per slice.
    expect(model.colors).toHaveLength(3);
  });

  it('suggests a line chart for a single series over a time-like axis', () => {
    const model = resolveChartModel([
      ['Month', 'Incidents'],
      ['2026-01', '4'],
      ['2026-02', '9'],
      ['2026-03', '6'],
      ['2026-04', '11'],
    ]);
    expect(model.type).toBe('line');
    expect(model.suggestionReason).toMatch(/time-like|ordered/i);
  });

  it('suggests grouped bars for multiple numeric series across categories', () => {
    const model = resolveChartModel([
      ['Team', 'Open', 'Closed'],
      ['Alpha', '5', '20'],
      ['Bravo', '8', '15'],
    ]);
    expect(model.type).toBe('bar');
    expect(model.series.map((s) => s.name)).toEqual(['Open', 'Closed']);
    expect(model.series[0].values).toEqual([5, 8]);
    expect(model.colors).toHaveLength(2);
  });

  it('suggests scatter for two numeric columns with no label column', () => {
    const model = resolveChartModel([
      ['X', 'Y'],
      ['1', '10'],
      ['2', '14'],
      ['3', '9'],
    ]);
    expect(model.type).toBe('scatter');
    expect(model.categoryColumnIndex).toBeNull();
  });

  it('respects an analyst-forced type and records that the suggestion differed', () => {
    const model = resolveChartModel([
      ['Severity', 'Count'],
      ['Critical', '3'],
      ['High', '7'],
    ], { forcedType: 'bar' });
    expect(model.type).toBe('bar');
    expect(model.suggestionReason).toMatch(/Analyst chose bar/i);
  });

  it('draws series colors from the template palette before falling back', () => {
    const model = resolveChartModel([
      ['Team', 'Open', 'Closed'],
      ['Alpha', '5', '20'],
    ], { palette: [{ hex: '#1F4E79', usage: 'accent' }, { hex: '#C00000', usage: 'text' }] });
    expect(model.colors[0]).toBe('#1F4E79');
    expect(model.colors[1]).toBe('#C00000');
  });

  it('throws when a table has no numeric column to plot', () => {
    expect(() => resolveChartModel([
      ['Type', 'Value'],
      ['domain', 'evil.example'],
    ])).toThrow(/nothing to chart|no numeric/i);
  });

  it('extracts the first markdown table from a section body, unescaping pipes', () => {
    const rows = parseMarkdownTableRows([
      'Some intro text.',
      '',
      '| Severity | Count |',
      '| --- | --- |',
      '| Critical | 3 |',
      '| High | 7 |',
      '',
      'Trailing prose.',
    ].join('\n'));
    expect(rows).toEqual([
      ['Severity', 'Count'],
      ['Critical', '3'],
      ['High', '7'],
    ]);
  });

  it('returns null when a section has no markdown table', () => {
    expect(parseMarkdownTableRows('Just a paragraph with no table.')).toBeNull();
  });
});
