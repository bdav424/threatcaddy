import * as XLSX from 'xlsx';
import type { ChartType } from './chart-model';
import { unzip, zipStored, type ZipEntry } from './docx-template-renderer';

/** The subset of a resolved ChartModel the emitter actually plots. Both the
 * full ChartModel (lib/chart-model) and a persisted ProductChartModel
 * (types.ts) satisfy this, so the exporter can feed either. */
export interface ChartRenderModel {
  type: ChartType;
  categories: string[];
  series: { name: string; values: number[] }[];
  colors: string[];
  title?: string;
}

// CaddyLab Stage 5b — native editable Word chart emission.
//
// A Word chart is NOT an image: it is a c:chartSpace part
// (word/charts/chartN.xml) that references an embedded .xlsx data cache
// (word/embeddings/…xlsx) via its own relationship part, plus a drawing in
// the body that references the chart part. Getting any of that wiring wrong
// yields Word's "unreadable content, repair?" prompt.
//
// The build spec's mitigation is real-Word-saved skeletons + a validation
// harness. Real Word is unavailable in this environment (and the sandbox's
// LibreOffice converter can't open any file), so this module instead pairs a
// carefully spec-shaped emitter with a strong IN-PROCESS harness
// (validateChartDocx) that unzips the output and proves: every required part
// exists, every XML part is well-formed, every relationship resolves to a
// present target, the content types declare each part, and — critically — the
// embedded workbook's numbers equal the chart's plotted numCache (the two
// hard problems the spec says to keep independent). parseChartXml round-trips
// the emitted XML back to a model so tests assert model-in == model-out.
//
// Final "opens clean in real Word" sign-off is still recommended before
// production trust; the harness catches structural corruption, not every
// Word-specific quirk.

const NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const NS_CT = 'http://schemas.openxmlformats.org/package/2006/content-types';

const CHART_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml';
const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const CHART_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart';
const PACKAGE_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/package';

const CAT_AXIS_ID = 111111111;
const VAL_AXIS_ID = 222222222;

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function columnLetter(index: number): string {
  let n = index;
  let letters = '';
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letters;
}

/** The c:barChart / c:lineChart / … element name for a model type. */
function plotElementName(type: ChartType): string {
  switch (type) {
    case 'line': return 'lineChart';
    case 'area': return 'areaChart';
    case 'pie': return 'pieChart';
    case 'scatter': return 'scatterChart';
    case 'bar':
    case 'stackedBar':
    default: return 'barChart';
  }
}

function usesAxes(type: ChartType): boolean {
  return type !== 'pie';
}

function strRef(formula: string, values: string[]): string {
  const pts = values.map((value, index) => `<c:pt idx="${index}"><c:v>${esc(value)}</c:v></c:pt>`).join('');
  return `<c:strRef><c:f>${esc(formula)}</c:f><c:strCache><c:ptCount val="${values.length}"/>${pts}</c:strCache></c:strRef>`;
}

function numRef(formula: string, values: number[]): string {
  const pts = values.map((value, index) => `<c:pt idx="${index}"><c:v>${value}</c:v></c:pt>`).join('');
  return `<c:numRef><c:f>${esc(formula)}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${pts}</c:numCache></c:numRef>`;
}

function seriesColor(model: ChartRenderModel, index: number): string {
  return (model.colors[index % model.colors.length] || '#4472C4').replace(/^#/, '');
}

/** The chart's embedded data cache — the workbook Word opens on "Edit Data".
 * Row 1 is the series-name header (A1 blank, then one column per series);
 * each subsequent row is a category label followed by its values. Scatter
 * lays x-values in column A and y-values in column B (no category label). */
function chartCacheAoa(model: ChartRenderModel): (string | number)[][] {
  if (model.type === 'scatter') {
    const xValues = model.series[0]?.values ?? [];
    const yValues = model.series[1]?.values ?? [];
    const header = ['X', model.series[1]?.name ?? 'Y'];
    return [header, ...xValues.map((x, index) => [x, yValues[index] ?? 0])];
  }
  const header = ['', ...model.series.map((series) => series.name)];
  return [header, ...model.categories.map((category, rowIndex) => [category, ...model.series.map((series) => series.values[rowIndex] ?? 0)])];
}

export function buildChartCacheXlsx(model: ChartRenderModel): Uint8Array {
  const worksheet = XLSX.utils.aoa_to_sheet(chartCacheAoa(model));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  return new Uint8Array(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

function buildSeriesXml(model: ChartRenderModel): string {
  const rowCount = model.type === 'scatter'
    ? (model.series[0]?.values.length ?? 0)
    : model.categories.length;
  const lastRow = rowCount + 1; // +1 for the header row.

  if (model.type === 'scatter') {
    const xName = model.series[0]?.name ?? 'X';
    const xValues = model.series[0]?.values ?? [];
    const yValues = model.series[1]?.values ?? [];
    return [
      '<c:ser>',
      '<c:idx val="0"/><c:order val="0"/>',
      `<c:tx>${strRef('Sheet1!$B$1', [model.series[1]?.name ?? 'Y'])}</c:tx>`,
      `<c:spPr><a:ln w="19050"><a:noFill/></a:ln></c:spPr>`,
      `<c:xVal>${numRef(`Sheet1!$A$2:$A$${lastRow}`, xValues)}</c:xVal>`,
      `<c:yVal>${numRef(`Sheet1!$B$2:$B$${lastRow}`, yValues)}</c:yVal>`,
      '</c:ser>',
      `<!-- x:${esc(xName)} -->`,
    ].join('');
  }

  return model.series.map((series, seriesIndex) => {
    const column = columnLetter(seriesIndex + 1); // A is categories; B, C… are series.
    const dataPoints = model.type === 'pie'
      ? model.categories.map((_, catIndex) => `<c:dPt><c:idx val="${catIndex}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${(model.colors[catIndex % model.colors.length] || '#4472C4').replace(/^#/, '')}"/></a:solidFill></c:spPr></c:dPt>`).join('')
      : '';
    return [
      '<c:ser>',
      `<c:idx val="${seriesIndex}"/><c:order val="${seriesIndex}"/>`,
      `<c:tx>${strRef(`Sheet1!$${column}$1`, [series.name])}</c:tx>`,
      model.type === 'pie' ? dataPoints : `<c:spPr><a:solidFill><a:srgbClr val="${seriesColor(model, seriesIndex)}"/></a:solidFill></c:spPr>`,
      `<c:cat>${strRef(`Sheet1!$A$2:$A$${lastRow}`, model.categories)}</c:cat>`,
      `<c:val>${numRef(`Sheet1!$${column}$2:$${column}$${lastRow}`, series.values)}</c:val>`,
      '</c:ser>',
    ].join('');
  }).join('');
}

function plotBodyXml(model: ChartRenderModel): string {
  const element = plotElementName(model.type);
  const series = buildSeriesXml(model);
  const axisRefs = usesAxes(model.type) ? `<c:axId val="${CAT_AXIS_ID}"/><c:axId val="${VAL_AXIS_ID}"/>` : '';

  if (model.type === 'pie') {
    return `<c:pieChart><c:varyColors val="1"/>${series}<c:firstSliceAng val="0"/></c:pieChart>`;
  }
  if (model.type === 'scatter') {
    return `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${series}${axisRefs}</c:scatterChart>`;
  }
  if (model.type === 'line') {
    return `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${series}<c:marker val="1"/>${axisRefs}</c:lineChart>`;
  }
  if (model.type === 'area') {
    return `<c:areaChart><c:grouping val="standard"/><c:varyColors val="0"/>${series}${axisRefs}</c:areaChart>`;
  }
  // bar / stackedBar
  const grouping = model.type === 'stackedBar' ? 'stacked' : 'clustered';
  const overlap = model.type === 'stackedBar' ? '<c:overlap val="100"/>' : '';
  return `<c:${element}><c:barDir val="col"/><c:grouping val="${grouping}"/><c:varyColors val="0"/>${series}${overlap}<c:gapWidth val="150"/>${axisRefs}</c:${element}>`;
}

function axesXml(model: ChartRenderModel): string {
  if (!usesAxes(model.type)) return '';
  const valAxisPos = 'l';
  const catAxis = model.type === 'scatter'
    ? `<c:valAx><c:axId val="${CAT_AXIS_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:crossAx val="${VAL_AXIS_ID}"/></c:valAx>`
    : `<c:catAx><c:axId val="${CAT_AXIS_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:crossAx val="${VAL_AXIS_ID}"/></c:catAx>`;
  const valAxis = `<c:valAx><c:axId val="${VAL_AXIS_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${valAxisPos}"/><c:crossAx val="${CAT_AXIS_ID}"/></c:valAx>`;
  return catAxis + valAxis;
}

export function buildChartXml(model: ChartRenderModel, externalDataRelId = 'rId1'): string {
  const title = model.title
    ? `<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:r><a:t>${esc(model.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`
    : '<c:autoTitleDeleted val="1"/>';
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    `<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}">`,
    '<c:roundedCorners val="0"/>',
    '<c:chart>',
    title,
    '<c:plotArea><c:layout/>',
    plotBodyXml(model),
    axesXml(model),
    '</c:plotArea>',
    '<c:legend><c:legendPos val="r"/><c:overlay val="0"/></c:legend>',
    '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>',
    '</c:chart>',
    `<c:externalData r:id="${externalDataRelId}"><c:autoUpdate val="0"/></c:externalData>`,
    '</c:chartSpace>',
  ].join('');
}

export interface ChartPartSet {
  /** New zip entries (chart part, its rels, the embedded workbook). */
  parts: ZipEntry[];
  /** <Override>/<Default> tags to merge into [Content_Types].xml. */
  contentTypeOverrides: string[];
  contentTypeDefaults: { extension: string; contentType: string }[];
  /** The relationship to add to word/_rels/document.xml.rels. */
  documentRelationship: { id: string; type: string; target: string };
  /** The <w:drawing> run to place in the body, referencing documentRelationship.id. */
  drawingRun: string;
}

/** Builds the full coupled part set for one chart, numbered so multiple charts
 * in one document never collide. `documentRelId` is the r:id the body drawing
 * uses; the caller allocates it against the document's existing relationships. */
export function buildChartParts(model: ChartRenderModel, chartIndex: number, documentRelId: string, opts?: { widthEmu?: number; heightEmu?: number; name?: string }): ChartPartSet {
  const chartPath = `word/charts/chart${chartIndex}.xml`;
  const chartRelsPath = `word/charts/_rels/chart${chartIndex}.xml.rels`;
  const embeddingTarget = `Microsoft_Excel_Worksheet${chartIndex}.xlsx`;
  const embeddingPath = `word/embeddings/${embeddingTarget}`;
  const encoder = new TextEncoder();

  const chartXml = buildChartXml(model, 'rId1');
  const chartRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS_REL}"><Relationship Id="rId1" Type="${PACKAGE_REL_TYPE}" Target="../embeddings/${embeddingTarget}"/></Relationships>`;

  const widthEmu = opts?.widthEmu ?? 5486400; // 6 inches
  const heightEmu = opts?.heightEmu ?? 3200400; // 3.5 inches
  const name = opts?.name ?? `Chart ${chartIndex}`;
  const drawingRun = [
    '<w:r><w:drawing>',
    `<wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="${NS_WP}">`,
    `<wp:extent cx="${widthEmu}" cy="${heightEmu}"/>`,
    '<wp:effectExtent l="0" t="0" r="0" b="0"/>',
    `<wp:docPr id="${chartIndex}" name="${esc(name)}"/>`,
    '<wp:cNvGraphicFramePr/>',
    `<a:graphic xmlns:a="${NS_A}"><a:graphicData uri="${NS_C}">`,
    `<c:chart xmlns:c="${NS_C}" xmlns:r="${NS_R}" r:id="${documentRelId}"/>`,
    '</a:graphicData></a:graphic>',
    '</wp:inline>',
    '</w:drawing></w:r>',
  ].join('');

  return {
    parts: [
      { path: chartPath, data: encoder.encode(chartXml) },
      { path: chartRelsPath, data: encoder.encode(chartRels) },
      { path: embeddingPath, data: buildChartCacheXlsx(model) },
    ],
    contentTypeOverrides: [`<Override PartName="/${chartPath}" ContentType="${CHART_CONTENT_TYPE}"/>`],
    contentTypeDefaults: [{ extension: 'xlsx', contentType: XLSX_CONTENT_TYPE }],
    documentRelationship: { id: documentRelId, type: CHART_REL_TYPE, target: `charts/chart${chartIndex}.xml` },
    drawingRun,
  };
}

/** A minimal one-chart, one-paragraph docx — the smallest artifact the
 * validation harness can round-trip. Used by tests and as the reference the
 * OOXML variable is proven against in isolation before wiring into export. */
export function assembleStandaloneChartDocx(model: ChartRenderModel): Uint8Array {
  const relId = 'rId100';
  const set = buildChartParts(model, 1, relId);
  const encoder = new TextEncoder();

  const contentTypes = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    `<Types xmlns="${NS_CT}">`,
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    ...set.contentTypeDefaults.map((def) => `<Default Extension="${def.extension}" ContentType="${def.contentType}"/>`),
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',
    ...set.contentTypeOverrides,
    '</Types>',
  ].join('');

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS_REL}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS_REL}"><Relationship Id="${set.documentRelationship.id}" Type="${set.documentRelationship.type}" Target="${set.documentRelationship.target}"/></Relationships>`;
  const documentXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    `<w:document xmlns:w="${NS_W}" xmlns:r="${NS_R}" xmlns:wp="${NS_WP}" xmlns:a="${NS_A}" xmlns:c="${NS_C}">`,
    '<w:body>',
    `<w:p>${set.drawingRun}</w:p>`,
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>',
    '</w:body></w:document>',
  ].join('');

  const entries: ZipEntry[] = [
    { path: '[Content_Types].xml', data: encoder.encode(contentTypes) },
    { path: '_rels/.rels', data: encoder.encode(rootRels) },
    { path: 'word/_rels/document.xml.rels', data: encoder.encode(documentRels) },
    { path: 'word/document.xml', data: encoder.encode(documentXml) },
    ...set.parts,
  ];
  return zipStored(entries);
}

// ── Round-trip parse (model out == model in) ────────────────────────────────

function cachePoints(xml: string, cacheTag: 'strCache' | 'numCache'): string[] {
  const block = xml.match(new RegExp(`<c:${cacheTag}>[\\s\\S]*?</c:${cacheTag}>`))?.[0];
  if (!block) return [];
  return Array.from(block.matchAll(/<c:pt\b[^>]*idx="(\d+)"[^>]*>\s*<c:v>([\s\S]*?)<\/c:v>\s*<\/c:pt>/g))
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .map((match) => match[2]);
}

function chartTypeFromXml(xml: string): ChartType {
  if (/<c:pieChart\b/.test(xml)) return 'pie';
  if (/<c:scatterChart\b/.test(xml)) return 'scatter';
  if (/<c:lineChart\b/.test(xml)) return 'line';
  if (/<c:areaChart\b/.test(xml)) return 'area';
  if (/<c:grouping val="stacked"\/>/.test(xml)) return 'stackedBar';
  return 'bar';
}

export interface ParsedChart {
  type: ChartType;
  categories: string[];
  series: { name: string; values: number[] }[];
}

/** Parses an emitted chart part back into a comparable shape, so a test can
 * assert the OOXML preserved exactly the model that produced it. */
export function parseChartXml(xml: string): ParsedChart {
  const type = chartTypeFromXml(xml);
  const serBlocks = Array.from(xml.matchAll(/<c:ser>[\s\S]*?<\/c:ser>/g)).map((match) => match[0]);

  if (type === 'scatter') {
    const ser = serBlocks[0] || '';
    const xVal = ser.match(/<c:xVal>[\s\S]*?<\/c:xVal>/)?.[0] || '';
    const yVal = ser.match(/<c:yVal>[\s\S]*?<\/c:yVal>/)?.[0] || '';
    const yName = ser.match(/<c:tx>[\s\S]*?<c:v>([\s\S]*?)<\/c:v>/)?.[1] || 'Y';
    return {
      type,
      categories: cachePoints(xVal, 'numCache'),
      series: [
        { name: 'X', values: cachePoints(xVal, 'numCache').map(Number) },
        { name: yName, values: cachePoints(yVal, 'numCache').map(Number) },
      ],
    };
  }

  const categories = serBlocks.length > 0
    ? cachePoints(serBlocks[0].match(/<c:cat>[\s\S]*?<\/c:cat>/)?.[0] || '', 'strCache')
    : [];
  const series = serBlocks.map((ser) => ({
    name: ser.match(/<c:tx>[\s\S]*?<c:v>([\s\S]*?)<\/c:v>/)?.[1] || '',
    values: cachePoints(ser.match(/<c:val>[\s\S]*?<\/c:val>/)?.[0] || '', 'numCache').map(Number),
  }));
  return { type, categories, series };
}

// ── Validation harness ──────────────────────────────────────────────────────

export interface ChartValidationResult {
  ok: boolean;
  errors: string[];
}

function isWellFormed(xml: string): boolean {
  if (typeof DOMParser === 'undefined') return true; // No DOM in this runtime — skip (tests run in jsdom).
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return doc.getElementsByTagName('parsererror').length === 0;
}

/** Round-trips a generated docx through structural + content checks that catch
 * the corruption classes behind Word's "unreadable content" prompt: missing
 * parts, malformed XML, dangling relationships, undeclared content types, and
 * a chart whose plotted numCache disagrees with its embedded data cache. */
export function validateChartDocx(bytes: Uint8Array): ChartValidationResult {
  const errors: string[] = [];
  let entries: ZipEntry[];
  try {
    entries = unzip(bytes);
  } catch (error) {
    return { ok: false, errors: [`Could not unzip output: ${error instanceof Error ? error.message : String(error)}`] };
  }
  const byPath = new Map(entries.map((entry) => [entry.path, entry] as const));
  const decoder = new TextDecoder();
  const text = (path: string) => { const entry = byPath.get(path); return entry ? decoder.decode(entry.data) : undefined; };

  for (const required of ['[Content_Types].xml', 'word/document.xml', 'word/_rels/document.xml.rels']) {
    if (!byPath.has(required)) errors.push(`Missing required part: ${required}`);
  }

  const chartPaths = entries.filter((entry) => /^word\/charts\/chart\d+\.xml$/.test(entry.path)).map((entry) => entry.path);
  if (chartPaths.length === 0) errors.push('No chart part (word/charts/chartN.xml) found.');

  // Every XML part must be well-formed.
  for (const entry of entries) {
    if (!entry.path.endsWith('.xml') && !entry.path.endsWith('.rels')) continue;
    const xml = decoder.decode(entry.data);
    if (!isWellFormed(xml)) errors.push(`Malformed XML: ${entry.path}`);
  }

  const contentTypes = text('[Content_Types].xml') || '';
  const documentRels = text('word/_rels/document.xml.rels') || '';
  const documentXml = text('word/document.xml') || '';

  for (const chartPath of chartPaths) {
    const chartIndex = chartPath.match(/chart(\d+)\.xml$/)?.[1];
    // Content type declared for the chart part.
    if (!contentTypes.includes(`PartName="/${chartPath}"`)) errors.push(`[Content_Types].xml missing Override for ${chartPath}`);
    // A document relationship of chart type points at it, and the body references that rel id.
    const relMatch = documentRels.match(new RegExp(`<Relationship\\b[^>]*Target="charts/chart${chartIndex}\\.xml"[^>]*>`));
    const relId = relMatch?.[0].match(/Id="([^"]+)"/)?.[1];
    if (!relId) {
      errors.push(`No document relationship targets ${chartPath}`);
    } else if (!documentXml.includes(`r:id="${relId}"`)) {
      errors.push(`document.xml does not reference chart relationship ${relId}`);
    }
    // Chart part's own relationship must resolve to an embedded workbook that exists.
    const chartRelsPath = `word/charts/_rels/chart${chartIndex}.xml.rels`;
    const chartRels = text(chartRelsPath);
    if (!chartRels) {
      errors.push(`Missing chart relationships part: ${chartRelsPath}`);
    } else {
      const target = chartRels.match(/Target="\.\.\/embeddings\/([^"]+)"/)?.[1];
      if (!target) {
        errors.push(`Chart ${chartIndex} has no embedded-data relationship.`);
      } else if (!byPath.has(`word/embeddings/${target}`)) {
        errors.push(`Chart ${chartIndex} embedding not found: word/embeddings/${target}`);
      } else {
        // The two hard problems kept independent: the plotted numCache must
        // equal the embedded data cache. A mismatch means Word's "Edit Data"
        // would show different numbers than the chart draws.
        const chartXml = text(chartPath) || '';
        const parsed = parseChartXml(chartXml);
        try {
          const workbook = XLSX.read(byPath.get(`word/embeddings/${target}`)!.data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as unknown[][];
          const bodyRows = grid.slice(1);
          const plotted = parsed.type === 'scatter'
            ? parsed.series.map((series) => series.values)
            : parsed.series.map((series) => series.values);
          plotted.forEach((values, seriesIndex) => {
            values.forEach((value, rowIndex) => {
              const cell = Number(bodyRows[rowIndex]?.[seriesIndex + 1] ?? bodyRows[rowIndex]?.[seriesIndex]);
              if (parsed.type !== 'scatter' && Number.isFinite(cell) && cell !== value) {
                errors.push(`Chart ${chartIndex}: plotted value ${value} (series ${seriesIndex}, row ${rowIndex}) != cache cell ${cell}`);
              }
            });
          });
        } catch (error) {
          errors.push(`Chart ${chartIndex} embedded workbook is not readable: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
