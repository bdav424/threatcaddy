// CaddyLab Stage 5a — chart-model resolution + type suggestion.
//
// The build spec is emphatic that the two hard problems of native Word charts
// are independent and must be separated: (1) chart *content correctness*
// (which columns become which series, which chart type, which colors) and
// (2) OOXML *validity* (Word opens it without a repair prompt). This module is
// problem (1) ONLY — pure, deterministic, fully unit-testable, and it emits no
// OOXML. Proving the model here (and previewing it) means every later
// OOXML-emission bug is provably an XML problem, not a data-mapping one.
//
// Nothing in here fabricates chart XML; it resolves a tabular grid (from a
// typed markdown table or an inserted xlsx sheet, Stage 4) into a ChartModel
// the analyst confirms before any docx is generated.

export type ChartType = 'bar' | 'stackedBar' | 'line' | 'area' | 'pie' | 'scatter';

export interface ChartSeries {
  name: string;
  values: number[];
}

export interface ChartModel {
  type: ChartType;
  /** Category-axis labels (x). For scatter, the numeric x-values as strings. */
  categories: string[];
  series: ChartSeries[];
  /** One hex color per series (per category for pie), '#rrggbb'. */
  colors: string[];
  title?: string;
  categoryColumnIndex: number | null;
  numericColumnIndexes: number[];
  /** Human-readable "why this type" — surfaced as the report-scoped
   * suggestion ("this data suits a bar chart"). */
  suggestionReason: string;
}

export interface ChartTypeOption {
  type: ChartType;
  label: string;
}

/** The bounded skeleton library the OOXML stage (5b) will mirror — bar, line,
 * pie, scatter, stacked, area (the common OOXML chart families). */
export const CHART_TYPES: ChartTypeOption[] = [
  { type: 'bar', label: 'Bar (grouped)' },
  { type: 'stackedBar', label: 'Bar (stacked)' },
  { type: 'line', label: 'Line' },
  { type: 'area', label: 'Area' },
  { type: 'pie', label: 'Pie' },
  { type: 'scatter', label: 'Scatter' },
];

// Brand-neutral fallback categorical palette (used only when the template's
// own sampled palette has too few distinct colors to cover the series count).
const FALLBACK_PALETTE = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47', '#264478', '#9E480E'];

export interface ResolveChartOptions {
  palette?: { hex: string; usage?: string }[];
  title?: string;
  forcedType?: ChartType;
}

/** Pulls the first GitHub-style markdown table out of a block of text into a
 * header+rows grid, so a section's typed or xlsx-inserted table can be fed
 * straight back to resolveChartModel. Returns null when there's no table. */
export function parseMarkdownTableRows(text: string): string[][] | null {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const isRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
  const isSeparator = (line: string) => /^\s*\|?[\s:|-]*-{2,}[\s:|-]*\|?\s*$/.test(line) && line.includes('-');
  const splitRow = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.replace(/\\\|/g, '|').trim());

  for (let index = 0; index < lines.length - 1; index += 1) {
    if (isRow(lines[index]) && isSeparator(lines[index + 1])) {
      const rows: string[][] = [splitRow(lines[index])];
      let cursor = index + 2;
      while (cursor < lines.length && isRow(lines[cursor])) {
        rows.push(splitRow(lines[cursor]));
        cursor += 1;
      }
      return rows;
    }
  }
  return null;
}

export function parseNumericCell(value: string): number | null {
  if (value == null) return null;
  const cleaned = value.replace(/[$,%\s]/g, '').replace(/,/g, '');
  if (cleaned === '' || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function columnIsNumeric(bodyRows: string[][], columnIndex: number): boolean {
  let filled = 0;
  let numeric = 0;
  for (const row of bodyRows) {
    const cell = (row[columnIndex] ?? '').trim();
    if (cell === '') continue;
    filled += 1;
    if (parseNumericCell(cell) !== null) numeric += 1;
  }
  return filled > 0 && numeric / filled >= 0.6;
}

/** Sequential/time-like category axis → line/area reads better than bars.
 * Matches years, YYYY-MM, month names, Q1..Q4, or a strictly increasing
 * run of integers (1,2,3… or 2019,2020,2021…). */
function categoriesLookOrdered(categories: string[]): boolean {
  if (categories.length < 2) return false;
  const monthOrQuarter = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|q[1-4]|\d{4}(-\d{2})?)/i;
  const allDateLike = categories.every((category) => monthOrQuarter.test(category.trim()));
  if (allDateLike) return true;
  const asNumbers = categories.map((category) => parseNumericCell(category.trim()));
  if (asNumbers.every((value) => value !== null)) {
    for (let i = 1; i < asNumbers.length; i += 1) {
      if ((asNumbers[i] as number) <= (asNumbers[i - 1] as number)) return false;
    }
    return true;
  }
  return false;
}

function suggestChartType(
  categoryColumnIndex: number | null,
  categories: string[],
  seriesCount: number,
): { type: ChartType; reason: string } {
  if (categoryColumnIndex === null && seriesCount === 2) {
    return { type: 'scatter', reason: 'Two numeric columns with no label column — plotted as X/Y points on a scatter chart.' };
  }
  if (seriesCount >= 2) {
    return { type: 'bar', reason: `Multiple numeric series (${seriesCount}) compared across categories — shown as grouped bars.` };
  }
  if (categoriesLookOrdered(categories)) {
    return { type: 'line', reason: 'A single series over an ordered / time-like axis — shown as a line.' };
  }
  if (categories.length > 0 && categories.length <= 6) {
    return { type: 'pie', reason: `A single series across ${categories.length} categories — shown as parts of a whole (pie).` };
  }
  return { type: 'bar', reason: 'A single series across categories — shown as bars.' };
}

function assignColors(count: number, palette?: { hex: string; usage?: string }[]): string[] {
  const fromTemplate = (palette ?? [])
    .map((color) => color.hex)
    .filter((hex) => /^#[0-9a-f]{6}$/i.test(hex));
  const distinct = Array.from(new Set([...fromTemplate, ...FALLBACK_PALETTE]));
  return Array.from({ length: count }, (_, index) => distinct[index % distinct.length]);
}

/** Resolves a header+rows grid into a chart model. Throws only when there is
 * no numeric data to plot — the caller surfaces that as "this table has
 * nothing chartable" rather than guessing. */
export function resolveChartModel(rows: string[][], options: ResolveChartOptions = {}): ChartModel {
  const cleanRows = rows.filter((row) => row.some((cell) => (cell ?? '').trim() !== ''));
  if (cleanRows.length < 2) {
    throw new Error('Need a header row plus at least one data row to build a chart.');
  }
  const header = cleanRows[0];
  const body = cleanRows.slice(1);
  const columnCount = Math.max(...cleanRows.map((row) => row.length));

  const numericColumnIndexes: number[] = [];
  for (let column = 0; column < columnCount; column += 1) {
    if (columnIsNumeric(body, column)) numericColumnIndexes.push(column);
  }
  if (numericColumnIndexes.length === 0) {
    throw new Error('No numeric columns found — this table has nothing to chart.');
  }

  let categoryColumnIndex: number | null = null;
  for (let column = 0; column < columnCount; column += 1) {
    if (!numericColumnIndexes.includes(column)) { categoryColumnIndex = column; break; }
  }

  const categories = categoryColumnIndex !== null
    ? body.map((row) => (row[categoryColumnIndex as number] ?? '').trim())
    : body.map((_, index) => String(index + 1));

  const series: ChartSeries[] = numericColumnIndexes.map((column) => ({
    name: (header[column] ?? `Series ${column + 1}`).trim() || `Series ${column + 1}`,
    values: body.map((row) => parseNumericCell((row[column] ?? '').trim()) ?? 0),
  }));

  const suggestion = suggestChartType(categoryColumnIndex, categories, series.length);
  const type = options.forcedType ?? suggestion.type;
  // Pie only ever plots one series, and colors vary per slice, not per series.
  const colorCount = type === 'pie' ? categories.length : series.length;

  return {
    type,
    categories,
    series: type === 'pie' ? series.slice(0, 1) : series,
    colors: assignColors(colorCount, options.palette),
    title: options.title,
    categoryColumnIndex,
    numericColumnIndexes,
    suggestionReason: options.forcedType && options.forcedType !== suggestion.type
      ? `Analyst chose ${options.forcedType}. Suggested: ${suggestion.reason}`
      : suggestion.reason,
  };
}
