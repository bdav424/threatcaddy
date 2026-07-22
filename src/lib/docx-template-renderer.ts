import { inflateRaw } from 'pako';
import type {
  Note,
  NoteTemplate,
  ProductBaselineAsset,
  ProductBaselineFigure,
  ProductBaselinePaletteColor,
  ProductBaselineSection,
  ProductBaselineStructuralMap,
  ProductChart,
  ProductFigureUpload,
} from '../types';
import { buildChartParts } from './docx-chart';

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const VENDOR_SANS_FONT = 'Aptos';
const HEADER_FONT_SIZE = '21'; // 10.5 pt in OOXML half-points.
const BODY_FONT_SIZE = '19'; // 9.5 pt in OOXML half-points.
const FOOTNOTE_TEXT_SIZE = '13'; // 6.5 pt in OOXML half-points.

export interface ZipEntry {
  path: string;
  data: Uint8Array;
}

interface MarkdownBlock {
  type: 'heading' | 'paragraph' | 'table' | 'bullet';
  level?: number;
  text?: string;
  rows?: string[][];
}

interface BodyElement {
  type: 'p' | 'tbl' | 'sectPr' | 'other';
  xml: string;
  text: string;
  style?: string;
}

interface ProductContentModel {
  title: string;
  classification: string;
  date: string;
  executiveSummary: string[];
  recentActivity: string[];
  assessment: string[];
  recommendations: string[];
  sources: string[];
  timelineRows?: string[][];
  iocRows?: string[][];
}

export interface DocxTemplateProfile {
  paragraphCount: number;
  tableCount: number;
  tableStyles: string[];
  headerReferenceCount: number;
  footerReferenceCount: number;
  anchors: {
    classification: boolean;
    date: boolean;
    executiveSummary: boolean;
    recentActivity: boolean;
    timeline: boolean;
    digitalIdentifiers: boolean;
    recommendations: boolean;
  };
}

export function hasDocxTemplateAsset(template: NoteTemplate | undefined): boolean {
  return Boolean(getDocxTemplateAsset(template));
}

export function buildTemplateBackedDocxBlob(product: Note, baseline: NoteTemplate | undefined): Blob | null {
  const asset = getDocxTemplateAsset(baseline);
  if (!asset?.data) return null;
  const templateBytes = base64ToBytes(asset.data);
  const docxBytes = buildTemplateBackedDocxBytes(
    templateBytes,
    product.content,
    baseline?.productBaseline?.productType,
    baseline?.productBaseline?.structuralMap,
    product.productFigures,
    product.productCharts,
  );
  const buffer = new ArrayBuffer(docxBytes.byteLength);
  new Uint8Array(buffer).set(docxBytes);
  return new Blob([buffer], { type: DOCX_MIME_TYPE });
}

export function buildTemplateBackedDocxBytes(
  templateBytes: Uint8Array,
  markdown: string,
  productType?: string,
  structuralMap?: ProductBaselineStructuralMap,
  figureUploads?: ProductFigureUpload[],
  charts?: ProductChart[],
): Uint8Array {
  // A derived structural map (any uploaded docx, Stage 1) takes priority over
  // the older hardcoded intel-note anchor list — it's the generalized version
  // of the same "clone the original paragraph's formatting, swap its text"
  // technique, just driven by data instead of one fixed heading set.
  if (structuralMap && structuralMap.sections.length > 0) {
    return buildStructuralDocxBytes(templateBytes, markdown, structuralMap, figureUploads, charts);
  }

  const entries = unzip(templateBytes);
  const documentEntry = entries.find((entry) => entry.path === 'word/document.xml');
  if (!documentEntry) throw new Error('Template DOCX is missing word/document.xml.');

  const originalDocumentXml = decodeUtf8(documentEntry.data);
  const hasFootnotesPart = entries.some((entry) => entry.path === 'word/footnotes.xml');
  const intelNoteRender = productType === 'intel-note'
    ? replaceIntelNoteDocumentBody(originalDocumentXml, markdown, hasFootnotesPart)
    : undefined;
  const nextDocumentXml = intelNoteRender?.documentXml || replaceDocumentBody(originalDocumentXml, markdown);
  const nextEntries = entries.map((entry) => entry.path === 'word/document.xml'
    ? { ...entry, data: encodeUtf8(nextDocumentXml) }
    : entry.path === 'word/footnotes.xml' && intelNoteRender?.footnotesXml
      ? { ...entry, data: encodeUtf8(intelNoteRender.footnotesXml) }
    : entry);
  return zipStored(nextEntries);
}

export function extractDocxTemplateProfile(templateBytes: Uint8Array): DocxTemplateProfile {
  const entries = unzip(templateBytes);
  const documentEntry = entries.find((entry) => entry.path === 'word/document.xml');
  if (!documentEntry) throw new Error('Template DOCX is missing word/document.xml.');
  return extractDocxTemplateProfileFromXml(decodeUtf8(documentEntry.data));
}

// ── Template derivation (CaddyLab docx round-trip, Stage 1) ───────────────────
// Walks an uploaded docx's real body structure into a generic, reusable map —
// heading-delimited sections in document order, plus a sampled color palette —
// instead of the fixed intel-note anchor list below. buildStructuralDocxBytes
// then fills that map back out against the SAME stored template bytes, so any
// uploaded report shape gets a faithful round-trip, not just the one hardcoded
// productType this renderer originally supported.

const HEADING_STYLE_PATTERN = /^(Heading([1-9])|Title)$/i;

function headingLevelFromStyle(style: string | undefined): number | undefined {
  if (!style) return undefined;
  const match = style.match(HEADING_STYLE_PATTERN);
  if (!match) return undefined;
  return match[1].toLowerCase() === 'title' ? 1 : Number.parseInt(match[2], 10);
}

// ── Smart formatting fallback ───────────────────────────────────────────────
// Plenty of real-world reports never use Word's named Heading/Title styles —
// headers are just "bigger and/or bolder than body text," applied by hand or
// by whatever authoring tool exported the doc. When no named-style headings
// exist anywhere in the document, fall back to inferring the heading
// hierarchy from each paragraph's own run formatting (point size, bold,
// color) instead of refusing to derive a template at all. Named styles still
// win whenever they're present — they're the more reliable signal.

interface RunFormatting {
  /** Font size in half-points (OOXML's w:sz unit) — e.g. 24 = 12pt. */
  size?: number;
  bold: boolean;
  /** Non-black explicit run color, if set — a secondary "this is styled
   * differently from body text" signal alongside size/bold. */
  color?: string;
  centered: boolean;
}

/** Reads the formatting of a paragraph's first run that actually carries
 * text (skipping empty bookmark/field runs), plus the paragraph's own
 * alignment — the same signal a human eye uses to spot "this looks like a
 * heading" without relying on the paragraph's style name at all. */
function extractDominantRunFormatting(paragraphXml: string): RunFormatting {
  const centered = /<w:jc\s+w:val="(?:center|centre)"/i.test(paragraphXml);
  for (const run of paragraphXml.matchAll(/<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g)) {
    const runXml = run[0];
    const textMatch = runXml.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/);
    if (!textMatch || !unescapeXml(textMatch[1]).trim()) continue;
    const rPr = runXml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] || '';
    const sizeMatch = rPr.match(/<w:sz\s+w:val="(\d+)"/);
    const bold = /<w:b\s*\/>|<w:b\s+w:val="(?:1|true|on)"/i.test(rPr) && !/<w:b\s+w:val="(?:0|false|off)"/i.test(rPr);
    const colorMatch = rPr.match(/<w:color\s+w:val="([0-9A-Fa-f]{6})"/i);
    return {
      size: sizeMatch ? Number.parseInt(sizeMatch[1], 10) : undefined,
      bold,
      color: colorMatch && colorMatch[1].toUpperCase() !== '000000' ? colorMatch[1].toUpperCase() : undefined,
      centered,
    };
  }
  return { bold: false, centered };
}

/** A table/image immediately before or after a paragraph is what makes a
 * centered-bold line a caption ("Table 1: ...", "Figure 2: ...") rather than
 * a genuine section heading, even when it shares a heading candidate's
 * size/weight — captions on graphics are exactly that shape in most house
 * styles (see extractFigures' equivalent style-based check). */
function isAdjacentToGraphic(elements: BodyElement[], index: number): boolean {
  const isGraphic = (element: BodyElement | undefined) =>
    Boolean(element) && (element!.type === 'tbl' || (element!.type === 'p' && /<w:drawing\b/.test(element!.xml)));
  return isGraphic(elements[index - 1]) || isGraphic(elements[index + 1]);
}

interface HeadingContext {
  useFormattingFallback: boolean;
  bodySize?: number;
  levelBySignature: Map<number, number>;
  formattingByIndex: Map<number, RunFormatting>;
}

/** Decides, once per document, whether section detection can rely on named
 * Heading/Title styles or needs to fall back to formatting. In fallback mode,
 * ranks the distinct point sizes used by heading-candidate paragraphs
 * (larger than body text, or same size but bold+colored) largest-first into
 * levels 1..N — mirroring how a reader would read a house style's own
 * hierarchy (e.g. 12pt bold headers > 10pt bold subheaders > 9.5pt body). */
function buildHeadingContext(elements: BodyElement[]): HeadingContext {
  const hasStyleHeadings = elements.some((element) =>
    element.type === 'p' && element.text.trim() && headingLevelFromStyle(element.style) !== undefined);
  if (hasStyleHeadings) {
    return { useFormattingFallback: false, levelBySignature: new Map(), formattingByIndex: new Map() };
  }

  // Body size is picked by total character count per size, not paragraph
  // count — a report's headings/subheadings/captions are usually short
  // phrases, so a document with a handful of long body paragraphs and many
  // short headings would otherwise have its heading size win a per-paragraph
  // vote despite reading, to a human, as obviously the smaller/rarer text.
  const formattingByIndex = new Map<number, RunFormatting>();
  const charCountBySize = new Map<number, number>();
  elements.forEach((element, index) => {
    if (element.type !== 'p' || !element.text.trim()) return;
    const formatting = extractDominantRunFormatting(element.xml);
    formattingByIndex.set(index, formatting);
    if (formatting.size !== undefined) {
      charCountBySize.set(formatting.size, (charCountBySize.get(formatting.size) || 0) + element.text.trim().length);
    }
  });
  let bodySize = 0;
  let bodySizeCharCount = -1;
  for (const [size, charCount] of charCountBySize) {
    if (charCount > bodySizeCharCount) { bodySize = size; bodySizeCharCount = charCount; }
  }

  const candidateSizes: number[] = [];
  elements.forEach((_element, index) => {
    const formatting = formattingByIndex.get(index);
    if (!formatting || formatting.size === undefined) return;
    const passesFormatting = formatting.size > bodySize || (formatting.size === bodySize && formatting.bold && Boolean(formatting.color));
    if (!passesFormatting) return;
    if (formatting.centered && isAdjacentToGraphic(elements, index)) return; // graphic caption, not a section heading
    candidateSizes.push(formatting.size);
  });
  const distinctSizesDesc = Array.from(new Set(candidateSizes)).sort((a, b) => b - a);
  const levelBySignature = new Map(distinctSizesDesc.map((size, index) => [size, Math.min(index + 1, 6)]));

  return { useFormattingFallback: distinctSizesDesc.length > 0, bodySize, levelBySignature, formattingByIndex };
}

/** The single heading-level lookup every section-tracking pass (derivation,
 * figure/section attribution, fill-time span splitting) goes through, so
 * named-style detection and the formatting fallback never disagree about
 * which paragraph is a heading. */
function headingLevelForElement(element: BodyElement, index: number, elements: BodyElement[], ctx: HeadingContext): number | undefined {
  if (!ctx.useFormattingFallback) return element.type === 'p' ? headingLevelFromStyle(element.style) : undefined;
  if (element.type !== 'p' || !element.text.trim()) return undefined;
  const formatting = ctx.formattingByIndex.get(index) ?? extractDominantRunFormatting(element.xml);
  if (formatting.size === undefined) return undefined;
  const bodySize = ctx.bodySize ?? 0;
  const passesFormatting = formatting.size > bodySize || (formatting.size === bodySize && formatting.bold && Boolean(formatting.color));
  if (!passesFormatting) return undefined;
  if (formatting.centered && isAdjacentToGraphic(elements, index)) return undefined;
  return ctx.levelBySignature.get(formatting.size);
}

/** Same "centered + bold, sitting right next to a table/image" shape
 * `buildHeadingContext` uses to exclude graphic captions from the heading
 * hierarchy — reused directly by extractFigures so a caption gets picked up
 * even in documents that DO have named heading styles (so the two detectors
 * don't have to agree on which mode they're in). */
function isLikelyGraphicCaption(element: BodyElement | undefined): boolean {
  if (!element || element.type !== 'p' || !element.text.trim()) return false;
  const formatting = extractDominantRunFormatting(element.xml);
  return formatting.centered && formatting.bold;
}

export function deriveDocxTemplate(templateBytes: Uint8Array): ProductBaselineStructuralMap {
  const entries = unzip(templateBytes);
  const documentEntry = entries.find((entry) => entry.path === 'word/document.xml');
  if (!documentEntry) throw new Error('Template DOCX is missing word/document.xml.');
  const documentXml = decodeUtf8(documentEntry.data);
  const bodyStart = documentXml.indexOf('<w:body>');
  const bodyEnd = documentXml.indexOf('</w:body>');
  if (bodyStart === -1 || bodyEnd === -1 || bodyEnd <= bodyStart) {
    throw new Error('Template DOCX has an unsupported document body structure.');
  }
  const elements = parseBodyElements(documentXml.slice(bodyStart + '<w:body>'.length, bodyEnd));
  const headingCtx = buildHeadingContext(elements);

  const sections: ProductBaselineSection[] = [];
  const usedKeys = new Set<string>();
  let currentTableCount = 0;
  let currentParagraphCount = 0;
  let pendingSection: ProductBaselineSection | null = null;

  const closeSection = () => {
    if (!pendingSection) return;
    pendingSection.hasTable = currentTableCount > 0;
    pendingSection.paragraphCount = currentParagraphCount;
    sections.push(pendingSection);
  };

  elements.forEach((element, index) => {
    const level = headingLevelForElement(element, index, elements, headingCtx);
    if (level !== undefined && element.text.trim()) {
      closeSection();
      currentTableCount = 0;
      currentParagraphCount = 0;
      pendingSection = {
        key: uniqueSlug(element.text, usedKeys),
        heading: element.text.trim(),
        level,
        style: element.style,
        order: sections.length,
        hasTable: false,
        paragraphCount: 0,
      };
      return;
    }
    if (!pendingSection) return;
    if (element.type === 'tbl') currentTableCount += 1;
    else if (element.type === 'p') currentParagraphCount += 1;
  });
  closeSection();

  const themeEntry = entries.find((entry) => entry.path === 'word/theme/theme1.xml');
  const palette = extractPalette(documentXml, themeEntry ? decodeUtf8(themeEntry.data) : undefined);
  const tableCount = elements.filter((element) => element.type === 'tbl').length;
  const figures = extractFigures(elements, sections, headingCtx);

  return {
    schemaVersion: 1,
    sections,
    palette,
    figures,
    tableCount,
    figurePlaceholderCount: figures.length,
  };
}

/** Walks the same element list `deriveDocxTemplate` already produced (so
 * heading-tracking stays a single source of truth) and pulls out each real
 * embedded image (`<w:drawing>` with an `<a:blip r:embed>`) into a figure
 * spec: which section it falls under, its captured size, and the caption
 * paragraph immediately after it, if the template has one (named "Caption"
 * style, or the same centered+bold shape the formatting fallback treats as a
 * graphic header). Non-image drawings (text boxes, shapes without a blip)
 * are left alone — nothing for the upload workflow to attach a replacement
 * image to. */
function extractFigures(elements: BodyElement[], sections: ProductBaselineSection[], headingCtx: HeadingContext): ProductBaselineFigure[] {
  const figures: ProductBaselineFigure[] = [];
  const usedKeys = new Set<string>();
  let sectionCursor = 0;
  let currentSectionKey: string | undefined;

  elements.forEach((element, index) => {
    const level = headingLevelForElement(element, index, elements, headingCtx);
    if (level !== undefined && element.text.trim()) {
      currentSectionKey = sections[sectionCursor]?.key;
      sectionCursor += 1;
      return;
    }
    if (element.type !== 'p') return;

    for (const drawingXml of element.xml.matchAll(/<w:drawing\b[\s\S]*?<\/w:drawing>/g)) {
      const relationshipId = drawingXml[0].match(/<a:blip\b[^>]*\br:embed="([^"]+)"/)?.[1];
      if (!relationshipId) continue;
      const extentMatch = drawingXml[0].match(/<wp:extent\s+cx="(\d+)"\s+cy="(\d+)"/);
      const nextElement = elements[index + 1];
      const namedCaption = nextElement?.type === 'p' && /caption/i.test(nextElement.style || '');
      const caption = (namedCaption || isLikelyGraphicCaption(nextElement))
        ? nextElement!.text.trim() || undefined
        : undefined;
      figures.push({
        key: uniqueSlug(caption || `figure-${figures.length + 1}`, usedKeys),
        order: figures.length,
        sectionKey: currentSectionKey,
        caption,
        widthEmu: extentMatch ? Number.parseInt(extentMatch[1], 10) : 0,
        heightEmu: extentMatch ? Number.parseInt(extentMatch[2], 10) : 0,
        relationshipId,
      });
    }
  });

  return figures;
}

function uniqueSlug(text: string, used: Set<string>): string {
  const base = text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
  let key = base;
  let suffix = 2;
  while (used.has(key)) {
    key = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(key);
  return key;
}

function extractPalette(documentXml: string, themeXml: string | undefined): ProductBaselinePaletteColor[] {
  const counts = new Map<string, { usage: ProductBaselinePaletteColor['usage']; count: number }>();
  const tally = (hex: string, usage: ProductBaselinePaletteColor['usage']) => {
    const normalized = hex.toUpperCase();
    const existing = counts.get(normalized);
    if (existing) existing.count += 1;
    else counts.set(normalized, { usage, count: 1 });
  };

  for (const match of documentXml.matchAll(/<w:shd\b[^>]*w:fill="([0-9A-Fa-f]{6})"/g)) tally(match[1], 'table-header');
  for (const match of documentXml.matchAll(/<w:color\b[^>]*w:val="([0-9A-Fa-f]{6})"/g)) tally(match[1], 'text');
  if (themeXml) {
    const schemeMatch = themeXml.match(/<a:clrScheme[\s\S]*?<\/a:clrScheme>/);
    if (schemeMatch) {
      for (const match of schemeMatch[0].matchAll(/<a:srgbClr\s+val="([0-9A-Fa-f]{6})"/g)) tally(match[1], 'theme');
    }
  }

  return Array.from(counts.entries())
    .map(([hex, { usage, count }]) => ({ hex: `#${hex}`, usage, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
}

// ── Generic structural fill — Stage 1's other half ─────────────────────────
// Fills a template docx section-by-section against its OWN derived map: the
// analyst's markdown is split at its own headings, each markdown section is
// matched to the closest-named structural-map section, and only matched
// sections' body content is replaced — every unmatched section keeps its
// original template content untouched. That's the actual "faithful" promise:
// a 10-section report where only 6 sections got new content doesn't lose the
// other 4, unlike the whole-body-replace fallback below.

interface MarkdownSection {
  heading: string;
  level: number;
  blocks: MarkdownBlock[];
}

function groupMarkdownIntoSections(markdown: string): MarkdownSection[] {
  const blocks = parseMarkdown(markdown);
  const sections: MarkdownSection[] = [];
  let current: MarkdownSection | null = null;
  for (const block of blocks) {
    if (block.type === 'heading') {
      current = { heading: (block.text || '').trim(), level: block.level || 1, blocks: [] };
      sections.push(current);
      continue;
    }
    if (!current) continue;
    current.blocks.push(block);
  }
  return sections;
}

function normalizeHeadingText(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function matchStructuralSection(
  markdownHeading: string,
  candidates: ProductBaselineSection[],
  claimed: Set<string>,
): ProductBaselineSection | undefined {
  const normalized = normalizeHeadingText(markdownHeading);
  const unclaimed = candidates.filter((section) => !claimed.has(section.key));
  const exact = unclaimed.find((section) => normalizeHeadingText(section.heading) === normalized);
  if (exact) return exact;
  return unclaimed.find((section) => {
    const sectionNormalized = normalizeHeadingText(section.heading);
    return sectionNormalized.includes(normalized) || normalized.includes(sectionNormalized);
  });
}

/** Splits the parsed body into (content before the first heading, then one
 * span per heading running up to the next heading paragraph). Matches
 * deriveDocxTemplate's own heading detection so structuralMap.sections[i]
 * lines up with the i-th span here, by order — both walk the same original
 * document.xml in the same pass order. */
function splitBodyIntoSpans(elements: BodyElement[]): { preamble: BodyElement[]; spans: BodyElement[][] } {
  const preamble: BodyElement[] = [];
  const spans: BodyElement[][] = [];
  const headingCtx = buildHeadingContext(elements);
  let current: BodyElement[] | null = null;
  elements.forEach((element, index) => {
    const level = headingLevelForElement(element, index, elements, headingCtx);
    if (level !== undefined && element.text.trim()) {
      current = [element];
      spans.push(current);
      return;
    }
    if (element.type === 'sectPr') return;
    (current || preamble).push(element);
  });
  return { preamble, spans };
}

// ── Figures — placeholder emission + upload-to-format (CaddyLab Stage 3) ───
// A figure's <w:drawing> frame (size, position) is template-owned formatting,
// same as a table's tblPr — so it's handled the same way the rest of this
// file treats "faithful": never fabricated, always the source docx's own
// frame with only the payload swapped. Two payload states:
//   - no upload yet: the drawing is replaced with a `[Figure: pending]` text
//     run so a fresh generation never carries a photo from someone else's
//     source report.
//   - uploaded: the drawing's frame is left byte-identical; only its
//     `r:embed` is repointed at a new relationship/media part carrying the
//     analyst's image, so it inherits the template's size/position for free
//     ("auto-formats" per the build spec — nothing about the frame changes).

const IMAGE_RELATIONSHIP_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
const MIME_TO_EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

function extensionForMimeType(mimeType: string): string {
  return MIME_TO_EXTENSION[mimeType.toLowerCase()] || mimeType.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'png';
}

function figureRelationshipId(paragraphXml: string): string | undefined {
  return paragraphXml.match(/<a:blip\b[^>]*\br:embed="([^"]+)"/)?.[1];
}

function isFigureParagraph(element: BodyElement, figuresByRelId: Map<string, ProductBaselineFigure>): boolean {
  if (element.type !== 'p') return false;
  const relationshipId = figureRelationshipId(element.xml);
  return Boolean(relationshipId && figuresByRelId.has(relationshipId));
}

function placeholderFigureParagraph(paragraphXml: string, figure: ProductBaselineFigure): string {
  const pPr = paragraphXml.match(/<w:pPr[\s\S]*?<\/w:pPr>/)?.[0] || '';
  const label = figure.caption ? `[Figure: pending — ${figure.caption}]` : '[Figure: pending]';
  return `<w:p>${pPr}<w:r>${runProperties({ size: BODY_FONT_SIZE })}<w:t xml:space="preserve">${escapeXml(label)}</w:t></w:r></w:p>`;
}

/** Adds a media part + relationship for each uploaded figure and returns the
 * old→new relationship-id mapping the body pass uses to repoint each
 * drawing's blip. Everything else about the zip (document.xml itself,
 * unrelated media/rels) passes through unmodified. */
function prepareFigureUploads(
  entries: ZipEntry[],
  figures: ProductBaselineFigure[],
  uploadsByKey: Map<string, ProductFigureUpload>,
): { entries: ZipEntry[]; relIdRemap: Map<string, string> } {
  const relIdRemap = new Map<string, string>();
  const targets = figures.filter((figure) => uploadsByKey.has(figure.key));
  if (targets.length === 0) return { entries, relIdRemap };

  const relsPath = 'word/_rels/document.xml.rels';
  const relsEntry = entries.find((entry) => entry.path === relsPath);
  const relsXml = relsEntry ? decodeUtf8(relsEntry.data) : (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
  );
  const existingIds = Array.from(relsXml.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"/g)).map((match) => match[1]);
  let nextIdNumber = 1 + Math.max(0, ...existingIds.map((id) => Number.parseInt(id.replace(/^rId/, ''), 10) || 0));

  const contentTypesPath = '[Content_Types].xml';
  const contentTypesEntry = entries.find((entry) => entry.path === contentTypesPath);
  let contentTypesXml = contentTypesEntry ? decodeUtf8(contentTypesEntry.data) : (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
  );
  const declaredExtensions = new Set(
    Array.from(contentTypesXml.matchAll(/<Default\s+Extension="([^"]+)"/g)).map((match) => match[1].toLowerCase()),
  );

  const newMediaEntries: ZipEntry[] = [];
  const newRelationshipTags: string[] = [];

  for (const figure of targets) {
    const upload = uploadsByKey.get(figure.key)!;
    const extension = extensionForMimeType(upload.mimeType);
    const mediaTarget = `media/figure-${figure.key}.${extension}`;
    newMediaEntries.push({ path: `word/${mediaTarget}`, data: base64ToBytes(upload.data) });

    const relId = `rId${nextIdNumber}`;
    nextIdNumber += 1;
    newRelationshipTags.push(`<Relationship Id="${relId}" Type="${IMAGE_RELATIONSHIP_TYPE}" Target="${mediaTarget}"/>`);
    relIdRemap.set(figure.key, relId);

    if (!declaredExtensions.has(extension)) {
      declaredExtensions.add(extension);
      contentTypesXml = contentTypesXml.replace(
        '</Types>',
        `<Default Extension="${extension}" ContentType="${upload.mimeType || `image/${extension}`}"/></Types>`,
      );
    }
  }

  const nextRelsXml = relsXml.replace('</Relationships>', `${newRelationshipTags.join('')}</Relationships>`);
  const nextEntries = entries
    .filter((entry) => entry.path !== relsPath && entry.path !== contentTypesPath)
    .concat(
      { path: relsPath, data: encodeUtf8(nextRelsXml) },
      { path: contentTypesPath, data: encodeUtf8(contentTypesXml) },
      newMediaEntries,
    );

  return { entries: nextEntries, relIdRemap };
}

/** Applies the pending-placeholder / uploaded-image treatment to one body
 * element. A no-op for anything that isn't a tracked figure paragraph. */
function transformFigureParagraph(
  element: BodyElement,
  figuresByRelId: Map<string, ProductBaselineFigure>,
  uploadsByKey: Map<string, ProductFigureUpload>,
  relIdRemap: Map<string, string>,
): BodyElement {
  if (element.type !== 'p') return element;
  const relationshipId = figureRelationshipId(element.xml);
  const figure = relationshipId ? figuresByRelId.get(relationshipId) : undefined;
  if (!figure || !relationshipId) return element;
  if (uploadsByKey.has(figure.key)) {
    const newRelId = relIdRemap.get(figure.key);
    if (!newRelId) return element;
    return { ...element, xml: element.xml.replace(`r:embed="${relationshipId}"`, `r:embed="${newRelId}"`) };
  }
  return { ...element, xml: placeholderFigureParagraph(element.xml, figure) };
}

// ── Native Word charts — token injection (CaddyLab Stage 5b) ────────────────
// A `[[chart:key]]` paragraph in a section's content marks where a native
// editable Word chart goes. This adds the chart's coupled parts (chartSpace,
// its rels, the embedded .xlsx data cache — all built + validated in
// docx-chart.ts, proven in isolation first) to the zip, allocates a document
// relationship above whatever the template already uses (so figures + charts
// never collide on an rId), and returns the body drawing run each token is
// replaced with. Same "add media + rels + content types, then swap the body
// reference" shape as the figure upload path above.

const CHART_TOKEN_PATTERN = /^\[\[chart:(.+)\]\]$/;

function prepareChartParts(entries: ZipEntry[], charts: ProductChart[]): { entries: ZipEntry[]; runByKey: Map<string, string> } {
  const runByKey = new Map<string, string>();
  if (charts.length === 0) return { entries, runByKey };

  const relsPath = 'word/_rels/document.xml.rels';
  const relsXml = entries.find((entry) => entry.path === relsPath)
    ? decodeUtf8(entries.find((entry) => entry.path === relsPath)!.data)
    : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  const existingIds = Array.from(relsXml.matchAll(/\bId="([^"]+)"/g)).map((match) => match[1]);
  let nextIdNumber = 1 + Math.max(0, ...existingIds.map((id) => Number.parseInt(id.replace(/^rId/, ''), 10) || 0));

  const contentTypesPath = '[Content_Types].xml';
  const contentTypesXml = entries.find((entry) => entry.path === contentTypesPath)
    ? decodeUtf8(entries.find((entry) => entry.path === contentTypesPath)!.data)
    : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>';
  const declaredExtensions = new Set(Array.from(contentTypesXml.matchAll(/<Default\s+Extension="([^"]+)"/g)).map((match) => match[1].toLowerCase()));
  const declaredOverrides = new Set(Array.from(contentTypesXml.matchAll(/<Override\s+PartName="([^"]+)"/g)).map((match) => match[1]));

  let nextChartIndex = 1 + Math.max(0, ...entries.map((entry) => Number.parseInt(entry.path.match(/^word\/charts\/chart(\d+)\.xml$/)?.[1] || '0', 10)));

  const newParts: ZipEntry[] = [];
  const newRelTags: string[] = [];
  let overridesToAdd = '';
  let defaultsToAdd = '';

  for (const chart of charts) {
    const chartIndex = nextChartIndex;
    nextChartIndex += 1;
    const docRelId = `rId${nextIdNumber}`;
    nextIdNumber += 1;
    const set = buildChartParts(chart.model, chartIndex, docRelId);
    newParts.push(...set.parts);
    newRelTags.push(`<Relationship Id="${set.documentRelationship.id}" Type="${set.documentRelationship.type}" Target="${set.documentRelationship.target}"/>`);
    for (const override of set.contentTypeOverrides) {
      const partName = override.match(/PartName="([^"]+)"/)?.[1];
      if (partName && !declaredOverrides.has(partName)) { declaredOverrides.add(partName); overridesToAdd += override; }
    }
    for (const def of set.contentTypeDefaults) {
      if (!declaredExtensions.has(def.extension.toLowerCase())) { declaredExtensions.add(def.extension.toLowerCase()); defaultsToAdd += `<Default Extension="${def.extension}" ContentType="${def.contentType}"/>`; }
    }
    runByKey.set(chart.key, set.drawingRun);
  }

  const nextRelsXml = relsXml.replace('</Relationships>', `${newRelTags.join('')}</Relationships>`);
  const nextContentTypesXml = contentTypesXml.replace('</Types>', `${defaultsToAdd}${overridesToAdd}</Types>`);
  const nextEntries = entries
    .filter((entry) => entry.path !== relsPath && entry.path !== contentTypesPath)
    .concat(
      { path: relsPath, data: encodeUtf8(nextRelsXml) },
      { path: contentTypesPath, data: encodeUtf8(nextContentTypesXml) },
      newParts,
    );
  return { entries: nextEntries, runByKey };
}

export function buildStructuralDocxBytes(
  templateBytes: Uint8Array,
  markdown: string,
  structuralMap: ProductBaselineStructuralMap,
  figureUploads?: ProductFigureUpload[],
  charts?: ProductChart[],
): Uint8Array {
  const uploadsByKey = new Map((figureUploads ?? []).map((upload) => [upload.key, upload] as const));
  const figuresByRelId = new Map(structuralMap.figures.map((figure) => [figure.relationshipId, figure] as const));
  const figurePrep = prepareFigureUploads(unzip(templateBytes), structuralMap.figures, uploadsByKey);
  const chartPrep = prepareChartParts(figurePrep.entries, charts ?? []);
  const entries = chartPrep.entries;
  const relIdRemap = figurePrep.relIdRemap;
  const chartRunByKey = chartPrep.runByKey;
  const withFigureFill = (element: BodyElement) => transformFigureParagraph(element, figuresByRelId, uploadsByKey, relIdRemap);

  const documentEntry = entries.find((entry) => entry.path === 'word/document.xml');
  if (!documentEntry) throw new Error('Template DOCX is missing word/document.xml.');
  const documentXml = decodeUtf8(documentEntry.data);
  const bodyStart = documentXml.indexOf('<w:body>');
  const bodyEnd = documentXml.indexOf('</w:body>');
  if (bodyStart === -1 || bodyEnd === -1 || bodyEnd <= bodyStart) {
    throw new Error('Template DOCX has an unsupported document body structure.');
  }
  const bodyInnerStart = bodyStart + '<w:body>'.length;
  const existingBody = documentXml.slice(bodyInnerStart, bodyEnd);
  const elements = parseBodyElements(existingBody);
  const sectPr = elements.find((element) => element.type === 'sectPr')?.xml ||
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>';
  const defaultTablePr = extractTableProperties(existingBody);
  const { preamble, spans } = splitBodyIntoSpans(elements);
  // Stage 4: any freshly-rendered table (analyst text, timeline/IOC autofill,
  // or an attached xlsx sheet) shades its header row from the template's own
  // sampled palette — "tables and charts draw from this palette" per spec —
  // rather than staying unstyled just because the content is new.
  const headerFillHex = structuralMap.palette.find((color) => color.usage === 'table-header')?.hex.replace(/^#/, '');

  const markdownSections = groupMarkdownIntoSections(markdown);
  const claimed = new Set<string>();
  const contentBySectionKey = new Map<string, MarkdownSection>();
  for (const mdSection of markdownSections) {
    const match = matchStructuralSection(mdSection.heading, structuralMap.sections, claimed);
    if (!match) continue;
    claimed.add(match.key);
    contentBySectionKey.set(match.key, mdSection);
  }

  const next: string[] = preamble.map((element) => withFigureFill(element).xml);
  spans.forEach((span, index) => {
    const structuralSection = structuralMap.sections[index];
    const mdSection = structuralSection ? contentBySectionKey.get(structuralSection.key) : undefined;
    if (!mdSection) {
      // Unmatched — carry the original span through verbatim (heading + body),
      // except any figure it holds still gets pending/upload treatment: every
      // generation is a fresh product, never a copy of the source report's photos.
      next.push(...span.map((element) => withFigureFill(element).xml));
      return;
    }

    const [headingElement, ...bodyElements] = span;
    next.push(headingElement.xml); // Heading text/style stays exactly as authored in the template.

    const paragraphTemplate = bodyElements.find((element) => element.type === 'p' && !isFigureParagraph(element, figuresByRelId));
    const tableTemplate = bodyElements.find((element) => element.type === 'tbl');
    const tablePr = tableTemplate ? (extractTableProperties(tableTemplate.xml) || defaultTablePr) : defaultTablePr;
    const tableWidths = tableTemplate ? extractTableGridWidths(tableTemplate.xml) : undefined;

    for (const block of mdSection.blocks) {
      const chartKey = (block.type === 'paragraph' && (block.text || '').trim().match(CHART_TOKEN_PATTERN)?.[1]) || undefined;
      if (chartKey && chartRunByKey.has(chartKey)) {
        next.push(`<w:p>${chartRunByKey.get(chartKey)}</w:p>`);
      } else if (block.type === 'table') {
        next.push(renderTable(block.rows || [], tablePr, tableWidths, headerFillHex));
      } else if (block.type === 'bullet') {
        next.push(renderParagraphFromTemplate(paragraphTemplate, block.text || '', true));
      } else {
        next.push(renderParagraphFromTemplate(paragraphTemplate, block.text || ''));
      }
    }

    // The block-fill above replaces this section's body wholesale, so any
    // figure that lived in it would otherwise silently vanish — carry it
    // back through (pending placeholder, or the analyst's uploaded image).
    for (const bodyElement of bodyElements) {
      if (!isFigureParagraph(bodyElement, figuresByRelId)) continue;
      next.push(withFigureFill(bodyElement).xml);
    }
  });

  const replacementBody = `${next.join('')}${sectPr}`;
  const nextDocumentXml = `${documentXml.slice(0, bodyInnerStart)}${replacementBody}${documentXml.slice(bodyEnd)}`;
  const nextEntries = entries.map((entry) => entry.path === 'word/document.xml'
    ? { ...entry, data: encodeUtf8(nextDocumentXml) }
    : entry);
  return zipStored(nextEntries);
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function getDocxTemplateAsset(template: NoteTemplate | undefined): ProductBaselineAsset | undefined {
  return template?.productBaseline?.assets?.find((asset) =>
    asset.role === 'docx-template' &&
    (asset.mimeType === DOCX_MIME_TYPE || asset.name.toLowerCase().endsWith('.docx')) &&
    Boolean(asset.data)
  );
}

function replaceDocumentBody(documentXml: string, markdown: string): string {
  const bodyStart = documentXml.indexOf('<w:body>');
  const bodyEnd = documentXml.indexOf('</w:body>');
  if (bodyStart === -1 || bodyEnd === -1 || bodyEnd <= bodyStart) {
    throw new Error('Template DOCX has an unsupported document body structure.');
  }
  const bodyInnerStart = bodyStart + '<w:body>'.length;
  const existingBody = documentXml.slice(bodyInnerStart, bodyEnd);
  const sectPrMatch = existingBody.match(/<w:sectPr[\s\S]*<\/w:sectPr>\s*$/);
  const sectPr = sectPrMatch?.[0] || '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>';
  const tablePr = extractTableProperties(existingBody);
  const replacementBody = `${renderMarkdownBlocks(markdown, tablePr)}${sectPr}`;
  return `${documentXml.slice(0, bodyInnerStart)}${replacementBody}${documentXml.slice(bodyEnd)}`;
}

function replaceIntelNoteDocumentBody(
  documentXml: string,
  markdown: string,
  useFootnotes: boolean,
): { documentXml: string; footnotesXml?: string } {
  const bodyStart = documentXml.indexOf('<w:body>');
  const bodyEnd = documentXml.indexOf('</w:body>');
  if (bodyStart === -1 || bodyEnd === -1 || bodyEnd <= bodyStart) {
    throw new Error('Template DOCX has an unsupported document body structure.');
  }

  const bodyInnerStart = bodyStart + '<w:body>'.length;
  const existingBody = documentXml.slice(bodyInnerStart, bodyEnd);
  const elements = parseBodyElements(existingBody);
  const model = parseProductContent(markdown);
  const sectPr = elements.find((element) => element.type === 'sectPr')?.xml ||
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>';

  const classificationTemplate = findParagraph(elements, (element) => /classification:/i.test(element.text)) || firstParagraph(elements);
  const dateTemplate = findParagraph(elements, (element) => /^date:/i.test(element.text)) || classificationTemplate;
  const blankTemplate = findParagraph(elements, (element) => !element.text.trim()) || classificationTemplate;
  const executiveHeading = findParagraph(elements, (element) => isHeadingText(element.text, 'Executive Summary'));
  const recentHeading = findParagraph(elements, (element) => isHeadingText(element.text, 'Recent Activity'));
  const timelineHeading = findParagraph(elements, (element) => /timeline/i.test(element.text));
  const threatActorHeading = findParagraph(elements, (element) => /Threat Actor Attribution|Key Details/i.test(element.text));
  const digitalHeading = findParagraph(elements, (element) => /Digital Identifiers|Relevant Threat Intelligence|Supporting Evidence/i.test(element.text));
  const recommendationHeading = findParagraph(elements, (element) => /Recommendations|Recommended Actions/i.test(element.text));
  const sourceHeadingTemplate = timelineHeading || recentHeading || executiveHeading;
  const bulletTemplate = findParagraph(elements, (element) => /^List/i.test(element.style || ''));

  const timelineTable = findTableAfter(elements, timelineHeading) || firstTable(elements);
  const iocTable = findTableAfter(elements, digitalHeading) || findTableWithHeader(elements, /IOC|Type|Value|Description/i) || firstTable(elements);
  const timelineCaption = findParagraph(elements, (element) => /Table\s+\d+:\s*Timeline/i.test(element.text));
  const iocCaption = findParagraph(elements, (element) => /Table\s+\d+:.*(Digital|Identifier|Evidence|IOC)/i.test(element.text));
  const tablePr = extractTableProperties(existingBody);
  const sourceFootnoteIds = useFootnotes ? model.sources.map((_source, index) => index + 1) : [];

  const next: string[] = [];
  if (classificationTemplate) next.push(replaceParagraphText(classificationTemplate.xml, model.classification ? `Classification: ${model.classification}` : 'Classification: TLP:AMBER'));
  if (dateTemplate) next.push(replaceParagraphText(dateTemplate.xml, model.date ? `Date: ${model.date}` : `Date: ${new Date().toISOString().slice(0, 10)}`));
  if (blankTemplate) next.push(blankTemplate.xml);

  if (executiveHeading) next.push(replaceParagraphText(executiveHeading.xml, 'Executive Summary'));
  model.executiveSummary.forEach((paragraph, index) => {
    next.push(renderParagraphFromTemplate(
      classificationTemplate,
      paragraph,
      false,
      index === 0 ? sourceFootnoteIds : [],
    ));
  });

  if (model.recentActivity.length > 0 && recentHeading) {
    next.push(replaceParagraphText(recentHeading.xml, 'Recent Activity'));
    for (const paragraph of model.recentActivity) next.push(renderParagraphFromTemplate(classificationTemplate, paragraph));
  }

  if (model.timelineRows && model.timelineRows.length > 1 && timelineHeading) {
    next.push(replaceParagraphText(timelineHeading.xml, 'Timeline of Significant Events'));
    if (timelineCaption) next.push(replaceParagraphText(timelineCaption.xml, 'Table 1: Timeline of Significant Events'));
    next.push(renderTable(
      model.timelineRows,
      extractTableProperties(timelineTable?.xml || '') || tablePr,
      extractTableGridWidths(timelineTable?.xml || ''),
    ));
  }

  if (model.assessment.length > 0 && threatActorHeading) {
    next.push(replaceParagraphText(threatActorHeading.xml, threatActorHeading.text || 'Threat Actor Attribution'));
    for (const paragraph of model.assessment) next.push(renderParagraphFromTemplate(classificationTemplate, paragraph));
  }

  if (model.iocRows && model.iocRows.length > 1 && digitalHeading) {
    next.push(replaceParagraphText(digitalHeading.xml, digitalHeading.text || 'Digital Identifiers'));
    if (iocCaption) next.push(replaceParagraphText(iocCaption.xml, iocCaption.text || 'Table 2: Actionable Digital Identifiers'));
    next.push(renderTable(
      toIntelNoteIocRows(model.iocRows),
      extractTableProperties(iocTable?.xml || '') || tablePr,
      extractTableGridWidths(iocTable?.xml || ''),
    ));
  }

  if (model.recommendations.length > 0 && recommendationHeading) {
    next.push(replaceParagraphText(recommendationHeading.xml, recommendationHeading.text || 'Recommendations'));
    for (const item of model.recommendations) next.push(renderParagraphFromTemplate(bulletTemplate || classificationTemplate, item, true));
  }

  if (!useFootnotes && model.sources.length > 0 && sourceHeadingTemplate) {
    next.push(replaceParagraphText(sourceHeadingTemplate.xml, 'Sources'));
    for (const source of model.sources) next.push(renderParagraphFromTemplate(bulletTemplate || classificationTemplate, source, true));
  }

  const replacementBody = `${next.join('')}${sectPr}`;
  return {
    documentXml: `${documentXml.slice(0, bodyInnerStart)}${replacementBody}${documentXml.slice(bodyEnd)}`,
    footnotesXml: useFootnotes && model.sources.length > 0 ? renderSourceFootnotesXml(model.sources) : undefined,
  };
}

function extractDocxTemplateProfileFromXml(documentXml: string): DocxTemplateProfile {
  const bodyStart = documentXml.indexOf('<w:body>');
  const bodyEnd = documentXml.indexOf('</w:body>');
  if (bodyStart === -1 || bodyEnd === -1 || bodyEnd <= bodyStart) {
    throw new Error('Template DOCX has an unsupported document body structure.');
  }
  const body = documentXml.slice(bodyStart + '<w:body>'.length, bodyEnd);
  const elements = parseBodyElements(body);
  const text = elements.map((element) => element.text).join('\n');
  return {
    paragraphCount: elements.filter((element) => element.type === 'p').length,
    tableCount: elements.filter((element) => element.type === 'tbl').length,
    tableStyles: Array.from(new Set(elements
      .filter((element) => element.type === 'tbl')
      .map((element) => element.xml.match(/<w:tblStyle[^>]*w:val="([^"]+)"/)?.[1])
      .filter((value): value is string => Boolean(value)))),
    headerReferenceCount: Array.from(documentXml.matchAll(/<w:headerReference\b/g)).length,
    footerReferenceCount: Array.from(documentXml.matchAll(/<w:footerReference\b/g)).length,
    anchors: {
      classification: /classification:/i.test(text),
      date: /^date:/im.test(text),
      executiveSummary: /Executive Summary/i.test(text),
      recentActivity: /Recent Activity/i.test(text),
      timeline: /Timeline of Significant Events|Timeline/i.test(text),
      digitalIdentifiers: /Digital Identifiers|Relevant Threat Intelligence|Supporting Evidence|IOC/i.test(text),
      recommendations: /Recommendations|Recommended Actions/i.test(text),
    },
  };
}

function extractTableProperties(bodyXml: string): string {
  const tablePr = bodyXml.match(/<w:tblPr[\s\S]*?<\/w:tblPr>/)?.[0];
  if (tablePr) return tablePr;
  return [
    '<w:tblPr>',
    '<w:tblStyle w:val="TableGrid"/>',
    '<w:tblW w:w="0" w:type="auto"/>',
    '<w:tblBorders>',
    '<w:top w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>',
    '<w:left w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>',
    '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>',
    '<w:right w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>',
    '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>',
    '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>',
    '</w:tblBorders>',
    '</w:tblPr>',
  ].join('');
}

function extractTableGridWidths(tableXml: string): number[] | undefined {
  const matches = Array.from(tableXml.matchAll(/<w:gridCol[^>]*w:w="(\d+)"/g))
    .map((match) => Number.parseInt(match[1], 10))
    .filter((value) => Number.isFinite(value) && value > 0);
  return matches.length > 0 ? matches : undefined;
}

function parseBodyElements(bodyXml: string): BodyElement[] {
  const matches = bodyXml.match(/<w:p[\s\S]*?<\/w:p>|<w:tbl[\s\S]*?<\/w:tbl>|<w:sectPr[\s\S]*?<\/w:sectPr>|<w:[A-Za-z0-9]+[^>]*\/>/g) || [];
  return matches.map((xml): BodyElement => {
    if (xml.startsWith('<w:p')) return { type: 'p', xml, text: extractText(xml), style: extractParagraphStyle(xml) };
    if (xml.startsWith('<w:tbl')) return { type: 'tbl', xml, text: extractText(xml) };
    if (xml.startsWith('<w:sectPr')) return { type: 'sectPr', xml, text: '' };
    return { type: 'other', xml, text: extractText(xml) };
  });
}

function extractText(xml: string): string {
  return Array.from(xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g))
    .map((match) => unescapeXml(match[1]))
    .join('')
    .trim();
}

function extractParagraphStyle(xml: string): string | undefined {
  return xml.match(/<w:pStyle[^>]*w:val="([^"]+)"/)?.[1];
}

function firstParagraph(elements: BodyElement[]): BodyElement | undefined {
  return elements.find((element) => element.type === 'p');
}

function firstTable(elements: BodyElement[]): BodyElement | undefined {
  return elements.find((element) => element.type === 'tbl');
}

function findParagraph(elements: BodyElement[], predicate: (element: BodyElement) => boolean): BodyElement | undefined {
  return elements.find((element) => element.type === 'p' && predicate(element));
}

function findTableAfter(elements: BodyElement[], anchor: BodyElement | undefined): BodyElement | undefined {
  if (!anchor) return undefined;
  const start = elements.indexOf(anchor);
  if (start === -1) return undefined;
  return elements.slice(start + 1).find((element) => element.type === 'tbl');
}

function findTableWithHeader(elements: BodyElement[], pattern: RegExp): BodyElement | undefined {
  return elements.find((element) => element.type === 'tbl' && pattern.test(element.text));
}

function isHeadingText(value: string, expected: string): boolean {
  return value.trim().toLowerCase() === expected.toLowerCase();
}

function replaceParagraphText(paragraphXml: string, text: string, trailingRuns = ''): string {
  const pPr = paragraphXml.match(/<w:pPr[\s\S]*?<\/w:pPr>/)?.[0] || '';
  const style = extractParagraphStyle(paragraphXml);
  const heading = isGeneratedHeadingStyle(style);
  return `<w:p>${pPr}<w:r>${runProperties({
    size: heading ? HEADER_FONT_SIZE : BODY_FONT_SIZE,
    bold: heading,
  })}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>${trailingRuns}</w:p>`;
}

function renderParagraphFromTemplate(
  template: BodyElement | undefined,
  text: string,
  forceBullet = false,
  footnoteIds: number[] = [],
): string {
  if (!template) return renderParagraph(text, undefined, forceBullet);
  const bullet = forceBullet || /^List/i.test(template.style || '');
  return replaceParagraphText(template.xml, bullet ? text : text, renderFootnoteReferenceRuns(footnoteIds));
}

function parseProductContent(markdown: string): ProductContentModel {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const model: ProductContentModel = {
    title: '',
    classification: '',
    date: '',
    executiveSummary: [],
    recentActivity: [],
    assessment: [],
    recommendations: [],
    sources: [],
  };
  let section = '';
  let index = 0;

  while (index < lines.length) {
    const raw = lines[index];
    const line = raw.trim();
    if (!line) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const text = stripMarkdownInline(heading[2]);
      if (heading[1].length === 1 && !model.title) model.title = text;
      section = normalizeSectionName(text);
      index += 1;
      continue;
    }

    const keyValue = line.match(/^\*\*([^:*]+):\*\*\s*(.+)$/);
    if (keyValue) {
      const key = keyValue[1].trim().toLowerCase();
      const value = stripMarkdownInline(keyValue[2]);
      if (key === 'classification') model.classification = value;
      if (key === 'date') model.date = value;
      index += 1;
      continue;
    }

    if (isTableLine(line) && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const rows: string[][] = [splitTableRow(line)];
      index += 2;
      while (index < lines.length && isTableLine(lines[index].trim())) {
        rows.push(splitTableRow(lines[index].trim()));
        index += 1;
      }
      if (section.includes('timeline')) model.timelineRows = rows;
      else if (section.includes('identifier') || section.includes('ioc') || section.includes('indicator')) model.iocRows = rows;
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    const value = stripMarkdownInline(bullet ? bullet[1] : line);
    if (section.includes('executive')) model.executiveSummary.push(value);
    else if (section.includes('recent')) model.recentActivity.push(value);
    else if (section.includes('assessment') || section.includes('attribution') || section.includes('actor')) model.assessment.push(value);
    else if (section.includes('recommend')) model.recommendations.push(value);
    else if (section.includes('source')) model.sources.push(value);
    index += 1;
  }

  if (model.executiveSummary.length === 0 && model.title) {
    model.executiveSummary.push(model.title);
  }
  return model;
}

function normalizeSectionName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function toIntelNoteIocRows(rows: string[][]): string[][] {
  const [header, ...body] = rows;
  const normalizedHeader = header.map((cell) => cell.toLowerCase());
  const typeIndex = findHeaderIndex(normalizedHeader, /type/);
  const valueIndex = findHeaderIndex(normalizedHeader, /value|indicator|ioc/);
  const descriptionIndex = findHeaderIndex(normalizedHeader, /description|context/);
  const lastSeenIndex = findHeaderIndex(normalizedHeader, /last seen|date/);
  const confidenceIndex = findHeaderIndex(normalizedHeader, /confidence|conf/);
  return [
    ['Type', 'Last Seen', 'Description', 'Confidence'],
    ...body.map((row) => {
      const value = cellAt(row, valueIndex) || cellAt(row, 1) || cellAt(row, 0);
      const description = cellAt(row, descriptionIndex) || value;
      return [
        uppercaseCell(cellAt(row, typeIndex) || 'indicator'),
        cellAt(row, lastSeenIndex) || 'not live validated',
        value && description && description !== value ? `${value} - ${description}` : description || value,
        cellAt(row, confidenceIndex) || 'medium',
      ];
    }),
  ];
}

function findHeaderIndex(headers: string[], pattern: RegExp): number {
  return headers.findIndex((header) => pattern.test(header));
}

function cellAt(row: string[], index: number): string {
  return index >= 0 ? row[index] || '' : '';
}

function uppercaseCell(value: string): string {
  return value.trim().toUpperCase();
}

function renderMarkdownBlocks(markdown: string, tablePr: string): string {
  const blocks = parseMarkdown(markdown);
  return blocks.map((block) => {
    if (block.type === 'heading') return renderParagraph(block.text || '', headingStyle(block.level || 1));
    if (block.type === 'table') return renderTable(block.rows || [], tablePr);
    if (block.type === 'bullet') return renderParagraph(block.text || '', undefined, true);
    return renderParagraph(block.text || '');
  }).join('');
}

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    const text = paragraph.join(' ').trim();
    if (text) blocks.push({ type: 'paragraph', text });
    paragraph = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) {
      flushParagraph();
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({ type: 'heading', level: heading[1].length, text: stripMarkdownInline(heading[2]) });
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      blocks.push({ type: 'bullet', text: stripMarkdownInline(bullet[1]) });
      continue;
    }
    if (isTableLine(line) && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      flushParagraph();
      const rows: string[][] = [splitTableRow(line)];
      index += 2;
      while (index < lines.length && isTableLine(lines[index].trim())) {
        rows.push(splitTableRow(lines[index].trim()));
        index += 1;
      }
      index -= 1;
      blocks.push({ type: 'table', rows });
      continue;
    }
    paragraph.push(stripMarkdownInline(line));
  }

  flushParagraph();
  return blocks;
}

function renderParagraph(text: string, style?: string, bullet = false): string {
  const styleXml = style ? `<w:pStyle w:val="${style}"/>` : '';
  const heading = isGeneratedHeadingStyle(style);
  const runPr = runProperties({
    size: heading ? HEADER_FONT_SIZE : BODY_FONT_SIZE,
    bold: heading,
  });
  const bulletRun = bullet ? `<w:r>${runPr}<w:t xml:space="preserve">- </w:t></w:r>` : '';
  return [
    '<w:p>',
    `<w:pPr>${styleXml}</w:pPr>`,
    bulletRun,
    '<w:r>',
    runPr,
    `<w:t xml:space="preserve">${escapeXml(text)}</w:t>`,
    '</w:r>',
    '</w:p>',
  ].join('');
}

function renderTable(rows: string[][], tablePr: string, preferredWidths?: number[], headerFillHex?: string): string {
  if (rows.length === 0) return '';
  const columnCount = Math.max(...rows.map((row) => row.length));
  const widths = normalizeTableWidths(rows, columnCount, preferredWidths);
  const grid = widths.map((width) => `<w:gridCol w:w="${width}"/>`).join('');
  const renderedRows = rows.map((row, rowIndex) => {
    const cells = Array.from({ length: columnCount }, (_, index) => row[index] || '')
      .map((cell, index) => renderCell(cell, rowIndex === 0, widths[index], headerFillHex))
      .join('');
    return `<w:tr>${cells}</w:tr>`;
  }).join('');
  return `<w:tbl>${tablePr}<w:tblGrid>${grid}</w:tblGrid>${renderedRows}</w:tbl>`;
}

function normalizeTableWidths(rows: string[][], columnCount: number, preferredWidths?: number[]): number[] {
  const header = rows[0]?.map((cell) => cell.toLowerCase()) || [];
  if (
    columnCount === 4 &&
    header.some((cell) => /type/.test(cell)) &&
    header.some((cell) => /last seen|date/.test(cell)) &&
    header.some((cell) => /description/.test(cell)) &&
    header.some((cell) => /confidence/.test(cell))
  ) {
    return [1000, 1600, 4760, 2000];
  }
  if (preferredWidths && preferredWidths.length === columnCount) return preferredWidths;
  const gridWidth = Math.max(1200, Math.floor(9360 / Math.max(columnCount, 1)));
  return Array.from({ length: columnCount }, () => gridWidth);
}

function renderCell(text: string, header: boolean, width: number, headerFillHex?: string): string {
  const runPr = runProperties({
    size: header ? HEADER_FONT_SIZE : BODY_FONT_SIZE,
    bold: header,
  });
  const verticalAlign = header ? '' : '<w:vAlign w:val="top"/>';
  const shading = header && headerFillHex ? `<w:shd w:val="clear" w:fill="${headerFillHex}"/>` : '';
  return [
    '<w:tc>',
    `<w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:tcMar><w:top w:w="${header ? 80 : 70}" w:type="dxa"/><w:start w:w="120" w:type="dxa"/><w:bottom w:w="${header ? 80 : 70}" w:type="dxa"/><w:end w:w="120" w:type="dxa"/></w:tcMar>${verticalAlign}${shading}</w:tcPr>`,
    '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r>',
    runPr,
    `<w:t xml:space="preserve">${escapeXml(stripMarkdownInline(text))}</w:t>`,
    '</w:r></w:p>',
    '</w:tc>',
  ].join('');
}

function runProperties(options: { size: string; bold?: boolean; vertAlign?: 'subscript' | 'superscript' }): string {
  return [
    '<w:rPr>',
    `<w:rFonts w:ascii="${VENDOR_SANS_FONT}" w:hAnsi="${VENDOR_SANS_FONT}" w:eastAsia="${VENDOR_SANS_FONT}" w:cs="${VENDOR_SANS_FONT}"/>`,
    options.bold ? '<w:b/>' : '',
    `<w:sz w:val="${options.size}"/>`,
    `<w:szCs w:val="${options.size}"/>`,
    options.vertAlign ? `<w:vertAlign w:val="${options.vertAlign}"/>` : '',
    '</w:rPr>',
  ].join('');
}

// Footnote reference marks are superscript (standard Word footnote behavior),
// not subscript. Two distinct sizes per the house style: the in-paragraph
// citation marker rides at regular body size (9.5pt), and the note entry's
// own number stays at that body size too — deliberately LARGER than the
// 6.5pt footnote note text after it, so the number reads clearly above the
// smaller citation text.
const FOOTNOTE_MARK_SIZE = BODY_FONT_SIZE; // 9.5pt — the superscript number, in-paragraph and in the note entry.

function renderFootnoteReferenceRuns(ids: number[]): string {
  return ids.map((id, index) => [
    index > 0 ? [
      '<w:r>',
      runProperties({ size: FOOTNOTE_MARK_SIZE, vertAlign: 'superscript' }),
      '<w:t xml:space="preserve">,</w:t>',
      '</w:r>',
    ].join('') : '',
    '<w:r>',
    runProperties({ size: FOOTNOTE_MARK_SIZE, vertAlign: 'superscript' }),
    `<w:footnoteReference w:id="${id}"/>`,
    '</w:r>',
  ].join('')).join('');
}

function renderSourceFootnotesXml(sources: string[]): string {
  const sourceNotes = sources.map((source, index) => [
    `<w:footnote w:id="${index + 1}">`,
    '<w:p>',
    '<w:pPr><w:pStyle w:val="FootnoteText"/></w:pPr>',
    '<w:r>',
    runProperties({ size: FOOTNOTE_MARK_SIZE, vertAlign: 'superscript' }),
    '<w:footnoteRef/>',
    '</w:r>',
    '<w:r>',
    runProperties({ size: FOOTNOTE_TEXT_SIZE }),
    `<w:t xml:space="preserve"> ${escapeXml(normalizeSourceFootnoteText(source))}</w:t>`,
    '</w:r>',
    '</w:p>',
    '</w:footnote>',
  ].join('')).join('');

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
    '<w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>',
    '<w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>',
    sourceNotes,
    '</w:footnotes>',
  ].join('');
}

function normalizeSourceFootnoteText(source: string): string {
  return source.replace(/\s+/g, ' ').trim();
}

function isGeneratedHeadingStyle(style?: string): boolean {
  return Boolean(style && /heading|title/i.test(style));
}

function headingStyle(level: number): string {
  if (level <= 1) return 'Title';
  if (level === 2) return 'Heading1';
  return 'Heading2';
}

function isTableLine(line: string): boolean {
  return line.startsWith('|') && line.endsWith('|') && line.includes('|');
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line: string): string[] {
  return line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function stripMarkdownInline(value: string): string {
  return value
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

export function unzip(bytes: Uint8Array): ZipEntry[] {
  const view = dataView(bytes);
  const eocdOffset = findEndOfCentralDirectory(view);
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  let centralOffset = view.getUint32(eocdOffset + 16, true);
  const entries: ZipEntry[] = [];

  for (let index = 0; index < totalEntries; index += 1) {
    if (view.getUint32(centralOffset, true) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error('Template DOCX central directory is malformed.');
    }
    const method = view.getUint16(centralOffset + 10, true);
    const compressedSize = view.getUint32(centralOffset + 20, true);
    const nameLength = view.getUint16(centralOffset + 28, true);
    const extraLength = view.getUint16(centralOffset + 30, true);
    const commentLength = view.getUint16(centralOffset + 32, true);
    const localOffset = view.getUint32(centralOffset + 42, true);
    const path = decodeUtf8(bytes.slice(centralOffset + 46, centralOffset + 46 + nameLength));
    const data = readLocalEntry(bytes, localOffset, compressedSize, method);
    entries.push({ path, data });
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function readLocalEntry(bytes: Uint8Array, offset: number, compressedSize: number, method: number): Uint8Array {
  const view = dataView(bytes);
  if (view.getUint32(offset, true) !== LOCAL_FILE_SIGNATURE) {
    throw new Error('Template DOCX local file entry is malformed.');
  }
  const nameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const dataStart = offset + 30 + nameLength + extraLength;
  const compressed = bytes.slice(dataStart, dataStart + compressedSize);
  if (method === 0) return compressed;
  if (method === 8) return inflateRaw(compressed);
  throw new Error(`Unsupported DOCX compression method: ${method}`);
}

export function zipStored(files: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encodeUtf8(file.path);
    const data = file.data;
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, LOCAL_FILE_SIGNATURE, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    local.set(name, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, CENTRAL_DIRECTORY_SIGNATURE, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centralParts.push(central);

    offset += local.length + data.length;
  }

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, EOCD_SIGNATURE, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return concatUint8Arrays([...localParts, ...centralParts, end]);
}

function findEndOfCentralDirectory(view: DataView): number {
  const minOffset = Math.max(0, view.byteLength - 0xffff - 22);
  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset;
  }
  throw new Error('Template DOCX is missing an end-of-central-directory record.');
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function encodeUtf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function decodeUtf8(value: Uint8Array): string {
  return new TextDecoder().decode(value);
}

function dataView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function concatUint8Arrays(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function unescapeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

const CRC32_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  return value >>> 0;
});

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
