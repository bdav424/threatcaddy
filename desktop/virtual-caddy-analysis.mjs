// desktop/virtual-caddy-analysis.mjs
//
// Pure, Electron-free static analysis engine for VirtualCaddy: SHA-256 hashing,
// printable-string extraction, and regex-based IOC pattern matching. Split out
// of vm-ingest.mjs so it can be unit tested without an Electron runtime (fs/
// path/crypto are the only dependencies, all available in plain Node).
//
// Air-gap constraint: no fetch, no WebSocket, no child_process.exec/execFile —
// the file is never parsed as anything other than raw bytes, and never run.

import fs from 'node:fs';
import crypto from 'node:crypto';

// ── IOC extraction patterns ────────────────────────────────────────────────
// Air-gapped static analysis: no network, only regex over printable strings.

export const IOC_PATTERNS = [
  { type: 'ipv4',   regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g },
  { type: 'domain', regex: /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:com|net|org|io|gov|edu|mil|biz|info|co|uk|de|fr|ru|cn|jp|br|au|nl|se|no|fi|dk|ch|at|be|es|pt|it|pl|cz|hu|ro|bg|gr|hr|sk|si|lt|lv|ee|is|nz|za|in|sg|hk|tw|kr|ar|mx|cl|pe|ve|ua|by|kz|uz|tm|tj|kg|am|ge|az|md|mn|th|vn|ph|my|id|bd|pk|lk|np|mm|kh|la|eg|sa|ae|qa|kw|bh|jo|il|lb|tr|ir|iq|sy|ly|tn|dz|ma|et|ke|ng|gh|tz|ug|zm|zw|sn|ci|cm|cd|mg|ml|bf|tg|bj|gn|ne|td|rw|bi|dj|er|so|sd|ss|mr|gw|sl|lr|gm|gq|cf|cg|ga|st|cv|km|sc|mu|mz|mw|sz|ls|na|bw|ao|bv|gl|pm|yt|re|ws|to|fj|pg|sb|vu|nc|pf|gu|as|mp|fm|pw|mh|ki|nr|tv|ck|nu|wf|tk|ax|ad|mc|sm|va|li|lu|mt|cy|im|je|gg|fo|gi|jm|bb|lc|vc|ag|gd|dm|tt|ky|bm|tc|bs|pr|vg|vi|us|ca|mx)\b/gi },
  { type: 'url',    regex: /https?:\/\/[^\s"'<>()[\]{}|\\^`]+/gi },
  { type: 'email',  regex: /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g },
  { type: 'md5',    regex: /\b[a-fA-F0-9]{32}\b/g },
  { type: 'sha1',   regex: /\b[a-fA-F0-9]{40}\b/g },
  { type: 'sha256', regex: /\b[a-fA-F0-9]{64}\b/g },
  { type: 'cve',    regex: /\bCVE-\d{4}-\d{4,}\b/gi },
];

// Filter out obviously non-IOC hex strings (all-same-char, sequential, etc.)
export function looksLikeRealHash(value) {
  if (/^(.)\1+$/.test(value)) return false;
  const unique = new Set(value.toLowerCase()).size;
  return unique > 4;
}

// Extract printable ASCII strings of length >= 6 from a buffer
export function extractPrintableStrings(buffer, minLen = 6) {
  const strings = [];
  let current = '';
  for (let i = 0; i < buffer.length; i++) {
    const ch = buffer[i];
    if (ch >= 0x20 && ch <= 0x7e) {
      current += String.fromCharCode(ch);
    } else {
      if (current.length >= minLen) strings.push(current);
      current = '';
    }
  }
  if (current.length >= minLen) strings.push(current);
  return strings;
}

// Run all IOC patterns against the joined string corpus, dedup by value+type
export function extractIOCs(corpus) {
  const seen = new Set();
  const iocs = [];

  for (const { type, regex } of IOC_PATTERNS) {
    const matches = corpus.match(regex) ?? [];
    for (const raw of matches) {
      const value = raw.trim();
      if (!value) continue;

      // Filter out hash false-positives
      if ((type === 'md5' || type === 'sha1' || type === 'sha256') && !looksLikeRealHash(value)) continue;

      // Exclude private/loopback IPs
      if (type === 'ipv4') {
        if (/^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(value)) continue;
      }

      const key = `${type}:${value.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      iocs.push({ type, value });
    }
  }
  return iocs;
}

// ── Core analysis ──────────────────────────────────────────────────────────

export function computeSha256(filePath) {
  const hash = crypto.createHash('sha256');
  const buf = fs.readFileSync(filePath);
  hash.update(buf);
  return { hash: hash.digest('hex'), buffer: buf };
}

export function analyzeFile(filePath) {
  const { hash, buffer } = computeSha256(filePath);
  const strings = extractPrintableStrings(buffer);
  const corpus = strings.join('\n');
  const iocs = extractIOCs(corpus);
  const notes = [];

  if (iocs.length > 0) {
    notes.push(`Static analysis found ${iocs.length} potential IOC${iocs.length === 1 ? '' : 's'}.`);
  } else {
    notes.push('Static string scan found no IOC patterns.');
  }

  notes.push(`File hash (SHA-256): ${hash}`);
  notes.push(`Unique printable strings: ${strings.length}`);

  return { hash, iocs, notes, stringCount: strings.length };
}
