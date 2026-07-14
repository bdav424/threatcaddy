export interface ExtractedIOC {
  type: 'ipv4' | 'domain' | 'url' | 'email' | 'md5' | 'sha1' | 'sha256' | 'cve';
  value: string;
}

export interface AnalyzeFileResult {
  hash: string;
  iocs: ExtractedIOC[];
  notes: string[];
  stringCount: number;
}

export const IOC_PATTERNS: Array<{ type: ExtractedIOC['type']; regex: RegExp }>;
export function looksLikeRealHash(value: string): boolean;
export function extractPrintableStrings(buffer: Buffer, minLen?: number): string[];
export function extractIOCs(corpus: string): ExtractedIOC[];
export function computeSha256(filePath: string): { hash: string; buffer: Buffer };
export function analyzeFile(filePath: string): AnalyzeFileResult;
