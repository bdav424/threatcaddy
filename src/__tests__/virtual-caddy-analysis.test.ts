import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analyzeFile,
  extractIOCs,
  extractPrintableStrings,
  looksLikeRealHash,
  computeSha256,
} from '../../desktop/virtual-caddy-analysis.mjs';

// VirtualCaddy's static-analysis engine (desktop/vm-ingest.mjs) never executes,
// parses, or interprets a submitted file — it only hashes it and regex-scans its
// printable strings (see the air-gap comment block at the top of that file). These
// tests exercise that engine directly against fixture files that are either
// genuinely inert or deliberately "look harmful" (decoy IOCs on RFC 5737
// documentation ranges, the industry-standard EICAR antivirus test string) without
// containing any real malicious content — safe to check in and safe to feed
// through this file-never-runs code path.

const FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'virtualcaddy');
const fixture = (name: string) => path.join(FIXTURES_DIR, name);

describe('VirtualCaddy static analysis — inert file', () => {
  it('finds zero IOCs in a plain shift-notes file', () => {
    const result = analyzeFile(fixture('inert-shift-notes.txt'));
    expect(result.iocs).toEqual([]);
    expect(result.notes).toContain('Static string scan found no IOC patterns.');
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('VirtualCaddy static analysis — decoy C2 report (harmful-looking, fictional)', () => {
  const result = analyzeFile(fixture('decoy-c2-report.txt'));
  const byType = (type: string) => result.iocs.filter((i) => i.type === type).map((i) => i.value);

  it('extracts the public-looking decoy IPs', () => {
    expect(byType('ipv4')).toEqual(expect.arrayContaining(['203.0.113.77', '198.51.100.23', '192.0.2.10', '203.0.113.99']));
  });

  it('excludes private/loopback IPs even though they appear in the same file', () => {
    const ips = byType('ipv4');
    expect(ips).not.toContain('10.0.0.5');
    expect(ips).not.toContain('192.168.1.42');
    expect(ips).not.toContain('172.16.5.9');
    expect(ips).not.toContain('127.0.0.1');
  });

  it('extracts decoy domains and the phishing URL', () => {
    expect(byType('domain')).toEqual(expect.arrayContaining(['evil-example.net', 'totally-not-malware.example.com']));
    expect(byType('url')).toEqual(expect.arrayContaining(['http://192.0.2.10/update/stage2.bin']));
  });

  it('extracts the fictional attacker email and CVE reference', () => {
    expect(byType('email')).toContain('fake.actor@example.com');
    expect(byType('cve')).toContain('CVE-2021-44228');
  });

  it('extracts the well-formed decoy hashes but rejects the repeated-char junk hex', () => {
    expect(byType('md5')).toContain('9a56c15009b513412e5568ac26278557');
    expect(byType('sha1')).toContain('63f206e790ea056f521e2fa2f40689d6c2b705f4');
    expect(byType('sha256')).toContain('db1b77ffea252adcf1e0fa19602a44b12dd90a64cc749c3c5e65eb36ae052199');
    expect(byType('md5')).not.toContain('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('reports a stable SHA-256 hash of the fixture itself', () => {
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.notes[0]).toMatch(/found \d+ potential IOCs?\./);
  });
});

describe('VirtualCaddy static analysis — binary file with embedded strings', () => {
  it('pulls the decoy domain out of a mostly-non-printable binary blob, like `strings` would', () => {
    const result = analyzeFile(fixture('decoy-binary-blob.bin'));
    expect(result.iocs.map((i) => i.value)).toContain('fake-binary-c2.example.org');
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('VirtualCaddy static analysis — EICAR test string (harmless, AV-recognized)', () => {
  it('hashes the file and finds no IOC patterns (EICAR contains no IPs/domains/hashes)', () => {
    const result = analyzeFile(fixture('eicar-test-string.txt'));
    expect(result.iocs).toEqual([]);
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.stringCount).toBeGreaterThan(0);
  });
});

describe('looksLikeRealHash', () => {
  it('rejects an all-repeated-character string', () => {
    expect(looksLikeRealHash('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')).toBe(false);
  });

  it('accepts a hash with enough unique characters', () => {
    expect(looksLikeRealHash('9e107d9d372bb6826bd81d3542a419d6')).toBe(true);
  });
});

describe('extractPrintableStrings', () => {
  it('splits on non-printable bytes and drops short fragments', () => {
    const buf = Buffer.from([0x00, ...Buffer.from('hello-world'), 0x00, 0x01, ...Buffer.from('hi'), 0x00]);
    const strings = extractPrintableStrings(buf, 6);
    expect(strings).toEqual(['hello-world']);
  });
});

describe('extractIOCs', () => {
  it('dedupes repeated IOCs of the same type and value', () => {
    const corpus = '203.0.113.5 seen twice: 203.0.113.5';
    const iocs = extractIOCs(corpus);
    expect(iocs.filter((i) => i.value === '203.0.113.5')).toHaveLength(1);
  });
});

describe('computeSha256', () => {
  it('matches a hash computed independently for the same fixture', () => {
    const { hash } = computeSha256(fixture('inert-shift-notes.txt'));
    const again = computeSha256(fixture('inert-shift-notes.txt'));
    expect(hash).toBe(again.hash);
  });
});
