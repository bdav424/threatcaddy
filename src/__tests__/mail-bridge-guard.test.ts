/**
 * Security regression: the confirmedSend: true guard in desktop/mail-bridge.mjs
 * must (a) exist as a strict boolean check, (b) return the correct blocked payload,
 * and (c) appear before any SMTP transport call in the send() function.
 *
 * These assertions run against source text because desktop/mail-bridge.mjs depends
 * on Electron and native IMAP/SMTP packages (imapflow, nodemailer) that are not
 * installed in the web-SPA workspace. The source-text approach catches accidental
 * guard removal or weakening just as a runtime test would, at zero import overhead.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE = readFileSync(
  resolve(__dirname, '../../desktop/mail-bridge.mjs'),
  'utf8',
);
const LINES = SOURCE.split('\n');

describe('mail-bridge confirmedSend guard', () => {
  it('uses a strict boolean check (=== true, not truthy)', () => {
    expect(SOURCE).toContain('if (confirmedSend !== true)');
  });

  it('returns the expected blocked payload with adapterCalled: false', () => {
    expect(SOURCE).toContain(
      "return { status: 'blocked', adapterCalled: false, willSend: false, reason: 'send_not_confirmed' }",
    );
  });

  it('guard appears before any smtpTransport call in the send function', () => {
    // Scope search to the send() function body — smtpTransport(cred) also appears in probe().
    const sendFnStart = LINES.findIndex(l => /^async function send\(/.test(l));
    const guardIdx = LINES.findIndex((l, i) => i > sendFnStart && l.includes('if (confirmedSend !== true)'));
    const smtpIdx  = LINES.findIndex((l, i) => i > sendFnStart && l.includes('smtpTransport(cred)'));
    expect(sendFnStart, 'send() function must exist').toBeGreaterThan(0);
    expect(guardIdx,    'guard line must exist in send()').toBeGreaterThan(sendFnStart);
    expect(smtpIdx,     'smtpTransport(cred) call must exist in send()').toBeGreaterThan(sendFnStart);
    expect(guardIdx, 'guard must appear before smtpTransport call').toBeLessThan(smtpIdx);
  });

  it('send function signature accepts a confirmedSend parameter', () => {
    expect(SOURCE).toContain('{ confirmedSend, message }');
  });
});
