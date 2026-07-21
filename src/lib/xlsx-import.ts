import * as XLSX from 'xlsx';

// CaddyLab Stage 4 — xlsx read as a data source for tables. Client-side only
// (SheetJS reads the workbook in-memory), matching CaddyLab's no-server
// charter. Each sheet becomes a plain string grid; the wand pours a chosen
// sheet into a section as a markdown table, which the existing structural
// docx fill (buildStructuralDocxBytes) already knows how to render.

export interface XlsxSheet {
  name: string;
  rows: string[][];
}

export function parseXlsxWorkbook(bytes: Uint8Array): XlsxSheet[] {
  const workbook = XLSX.read(bytes, { type: 'array' });
  return workbook.SheetNames
    .map((name): XlsxSheet => {
      const sheet = workbook.Sheets[name];
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as unknown[][];
      const rows = raw
        .map((row) => row.map((cell) => (cell == null ? '' : String(cell).trim())))
        .filter((row) => row.some((cell) => cell !== ''));
      return { name, rows };
    })
    .filter((sheet) => sheet.rows.length > 0);
}

export function rowsToMarkdownTable(rows: string[][]): string {
  if (rows.length === 0) return '';
  const columnCount = Math.max(...rows.map((row) => row.length));
  const pad = (row: string[]) => Array.from(
    { length: columnCount },
    (_, index) => (row[index] || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' '),
  );
  const [header, ...body] = rows;
  return [
    `| ${pad(header).join(' | ')} |`,
    `| ${pad(header).map(() => '---').join(' | ')} |`,
    ...body.map((row) => `| ${pad(row).join(' | ')} |`),
  ].join('\n');
}
