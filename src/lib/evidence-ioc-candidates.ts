import Papa from 'papaparse';
import type { ConfidenceLevel, IOCType } from '../types';
import { extractIOCs } from './ioc-extractor';

export interface EvidenceTableIOCCandidate {
  type: IOCType;
  value: string;
  confidence: ConfidenceLevel;
  sourceTable: string;
  rowIndex: number;
  notes: string;
  row: Record<string, string>;
}

interface CandidateOptions {
  enabledTypes?: IOCType[];
  defaultConfidence?: ConfidenceLevel;
}

interface ParsedTable {
  title: string;
  headers: string[];
  rows: string[][];
}

export function extractEvidenceTableIOCCandidates(
  content: string,
  options: CandidateOptions = {},
): EvidenceTableIOCCandidate[] {
  const candidates: EvidenceTableIOCCandidate[] = [];
  const seen = new Set<string>();

  for (const table of extractTablesFromEvidenceContent(content)) {
    table.rows.forEach((row, rowIndex) => {
      const rowRecord = rowToRecord(table.headers, row);
      const rowText = [
        row.join('\t'),
        preferredContextValues(rowRecord).join('\n'),
      ].filter(Boolean).join('\n');
      const rowIOCs = extractIOCs(rowText, {
        enabledTypes: options.enabledTypes,
        defaultConfidence: confidenceFromRow(rowRecord) || options.defaultConfidence || 'medium',
      });

      for (const ioc of rowIOCs) {
        if (ioc.dismissed) continue;
        const key = `${ioc.type}:${ioc.value.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push({
          type: ioc.type,
          value: ioc.value,
          confidence: ioc.confidence,
          sourceTable: table.title,
          rowIndex: rowIndex + 1,
          row: rowRecord,
          notes: buildCandidateNotes(table.title, rowIndex + 1, rowRecord),
        });
      }
    });
  }

  return candidates;
}

export function renderEvidenceTableIOCCandidatesText(candidates: EvidenceTableIOCCandidate[]): string {
  return candidates.map((candidate) => [
    `${candidate.type}\t${candidate.value}\t${candidate.confidence}`,
    candidate.notes,
  ].join('\n')).join('\n\n');
}

function extractTablesFromEvidenceContent(content: string): ParsedTable[] {
  const body = getExtractedText(content);
  if (!body) return [];

  const sections = splitSheetSections(body);
  const candidates = sections.length > 0 ? sections : [{ title: 'Extracted Table', body }];
  return candidates
    .map((section) => parseTableSection(section.title, section.body))
    .filter((table): table is ParsedTable => table !== null);
}

function getExtractedText(content: string): string {
  const parts = content.split(/\n## Extracted Text\b/i);
  if (parts.length < 2) return '';
  return parts.slice(1).join('\n## Extracted Text').trim();
}

function splitSheetSections(body: string): Array<{ title: string; body: string }> {
  const matches = Array.from(body.matchAll(/^##\s+(.+)$/gm));
  if (matches.length === 0) return [];
  return matches.map((match, index) => {
    const start = (match.index || 0) + match[0].length;
    const end = matches[index + 1]?.index ?? body.length;
    return {
      title: match[1]?.trim() || `Table ${index + 1}`,
      body: body.slice(start, end).trim(),
    };
  });
}

function parseTableSection(title: string, body: string): ParsedTable | null {
  const lines = body
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() && !line.trim().startsWith('#'));
  if (lines.length < 2) return null;

  const delimiter = chooseDelimiter(lines);
  const parsed = Papa.parse<string[]>(lines.join('\n'), {
    delimiter,
    skipEmptyLines: 'greedy',
  });
  const rows = parsed.data
    .map((row) => row.map((cell) => String(cell ?? '').trim()))
    .filter((row) => row.length > 1 && row.some(Boolean));
  if (rows.length < 2) return null;

  const headers = normalizeHeaders(rows[0]);
  if (!looksLikeTable(headers, rows.slice(1))) return null;
  return { title, headers, rows: rows.slice(1) };
}

function chooseDelimiter(lines: string[]): ',' | '\t' {
  const tabLines = lines.filter((line) => line.includes('\t')).length;
  const commaLines = lines.filter((line) => countUnquotedCommas(line) > 0).length;
  return tabLines >= commaLines ? '\t' : ',';
}

function countUnquotedCommas(line: string): number {
  let quoted = false;
  let count = 0;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') index += 1;
      else quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) count += 1;
  }

  return count;
}

function normalizeHeaders(row: string[]): string[] {
  return row.map((header, index) => header.trim() || `Column ${index + 1}`);
}

function looksLikeTable(headers: string[], rows: string[][]): boolean {
  if (headers.length < 2 || rows.length === 0) return false;
  const populatedRows = rows.filter((row) => row.filter((cell) => cell.trim()).length >= 2);
  if (populatedRows.length === 0) return false;
  const headerText = headers.join(' ').toLowerCase();
  return /\b(ioc|indicator|ip|ipv4|ipv6|domain|url|hash|sha256|sha1|md5|email|cve|description|note|source|status|type)\b/.test(headerText)
    || populatedRows.length >= 3;
}

function rowToRecord(headers: string[], row: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((header, index) => {
    const value = row[index]?.trim();
    if (value) record[header] = value;
  });
  return record;
}

function confidenceFromRow(row: Record<string, string>): ConfidenceLevel | undefined {
  const value = Object.entries(row)
    .find(([key]) => /confidence|verdict|status/i.test(key))?.[1]
    ?.toLowerCase();
  if (!value) return undefined;
  if (/confirm|malicious|high/.test(value)) return 'high';
  if (/low|benign|unknown/.test(value)) return 'low';
  return 'medium';
}

function preferredContextValues(row: Record<string, string>): string[] {
  return Object.entries(row)
    .filter(([key]) => /desc|note|context|comment|source|status|type|id|actor|malware|campaign|first|last|confidence/i.test(key))
    .map(([key, value]) => `${key}: ${value}`)
    .slice(0, 10);
}

function buildCandidateNotes(table: string, rowIndex: number, row: Record<string, string>): string {
  const context = Object.entries(row)
    .filter(([, value]) => value.trim())
    .slice(0, 12)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
  return [
    `Auto-extracted from evidence table "${table}", row ${rowIndex}.`,
    context ? `Row context:\n${context}` : undefined,
  ].filter(Boolean).join('\n\n');
}
