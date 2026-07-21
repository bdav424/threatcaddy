import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseXlsxWorkbook, rowsToMarkdownTable } from '../lib/xlsx-import';

function buildWorkbookBytes(sheets: { name: string; rows: (string | number)[][] }[]): Uint8Array {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  }
  const output = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Uint8Array(output);
}

describe('xlsx read as a data source (CaddyLab Stage 4)', () => {
  it('parses every non-empty sheet into a string grid, dropping fully blank rows', () => {
    const bytes = buildWorkbookBytes([
      {
        name: 'Indicators',
        rows: [
          ['Type', 'Value', 'Confidence'],
          ['domain', 'evil.example', 'High'],
          ['', '', ''],
          ['ip', '198.51.100.7', 'Medium'],
        ],
      },
      { name: 'Empty', rows: [] },
    ]);

    const sheets = parseXlsxWorkbook(bytes);

    expect(sheets).toHaveLength(1); // the fully-empty sheet is dropped
    expect(sheets[0].name).toBe('Indicators');
    expect(sheets[0].rows).toEqual([
      ['Type', 'Value', 'Confidence'],
      ['domain', 'evil.example', 'High'],
      ['ip', '198.51.100.7', 'Medium'],
    ]);
  });

  it('keeps multiple sheets separate so the wand can offer a sheet picker', () => {
    const bytes = buildWorkbookBytes([
      { name: 'Q1', rows: [['Month', 'Count'], ['Jan', '3']] },
      { name: 'Q2', rows: [['Month', 'Count'], ['Apr', '5']] },
    ]);

    const sheets = parseXlsxWorkbook(bytes);

    expect(sheets.map((sheet) => sheet.name)).toEqual(['Q1', 'Q2']);
  });

  it('renders a row grid as a markdown table, padding ragged rows and escaping pipes', () => {
    const table = rowsToMarkdownTable([
      ['Type', 'Value'],
      ['domain', 'evil|example.com'],
      ['ip'],
    ]);

    expect(table).toBe([
      '| Type | Value |',
      '| --- | --- |',
      '| domain | evil\\|example.com |',
      '| ip |  |',
    ].join('\n'));
  });

  it('returns an empty string for no rows', () => {
    expect(rowsToMarkdownTable([])).toBe('');
  });
});
