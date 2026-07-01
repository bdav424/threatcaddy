// desktop/mail-bridge.mjs
//
// Real IMAP/SMTP transport for EmailCaddy, living in the Electron MAIN process so it is
// OUTSIDE the no-live-call scan and can hold OS-keychain credentials. The renderer never
// sees raw secrets — it holds only a credentialReferenceId.
//
// This is the injected adapter behind email-provider-runtime-executor.ts's
// EmailProviderRuntimeExecutorAdapter seam. The renderer sends
//   { action, credentialReferenceId, params } over IPC;
// this bridge resolves the secret and performs the action.
//
// Required deps (add to root package.json or a desktop package.json):
//   imapflow  nodemailer  mailparser
// (electron's safeStorage is built in)
//
// Register in desktop/main.mjs:
//   import { registerMailBridge } from './mail-bridge.mjs';
//   app.whenReady().then(() => { createWindow(); registerMailBridge(); });

import { ipcMain, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { runOAuthPopout } from './mail-oauth.mjs';

let mailDepsPromise;

async function getMailDeps() {
  mailDepsPromise ??= Promise.all([
    import('imapflow'),
    import('nodemailer'),
    import('mailparser'),
  ]).then(([imapflow, nodemailer, mailparser]) => ({
    ImapFlow: imapflow.ImapFlow,
    nodemailer: nodemailer.default ?? nodemailer,
    simpleParser: mailparser.simpleParser,
  }));
  return mailDepsPromise;
}

// --- credential store: encrypted-at-rest, keyed by a reference id the renderer holds ---
// The renderer only ever passes a credentialReferenceId. Raw host/user/password/token
// live here, encrypted with the OS keychain via Electron safeStorage.
const CRED_DIR = path.join(os.homedir(), '.threatcaddy', 'mail-credentials');

function credPath(ref) {
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(ref)) throw new Error('bad credentialReferenceId');
  return path.join(CRED_DIR, `${ref}.bin`);
}

function saveCredential(ref, cred) {
  fs.mkdirSync(CRED_DIR, { recursive: true, mode: 0o700 });
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS keychain unavailable');
  const enc = safeStorage.encryptString(JSON.stringify(cred));
  fs.writeFileSync(credPath(ref), enc, { mode: 0o600 });
}

function loadCredential(ref) {
  const enc = fs.readFileSync(credPath(ref));
  return JSON.parse(safeStorage.decryptString(enc));
  // cred shape: { kind:'imap-smtp', imap:{host,port,secure}, smtp:{host,port,secure},
  //               authMethod:'basic'|'oauth',
  //               auth:{ user, pass? } | { user, oauth:{ accessToken } }, from }
}

// --- transports ---
async function imapClient(cred) {
  const { ImapFlow } = await getMailDeps();
  const isOAuth = cred.authMethod === 'oauth' || cred.auth?.oauth;
  const auth = isOAuth
    ? { user: cred.auth.user, accessToken: cred.auth.oauth.accessToken }
    : { user: cred.auth.user, pass: cred.auth.pass };

  // Proton Bridge runs on loopback with a self-signed cert — only relax TLS there.
  const tls = cred.imap.host === '127.0.0.1'
    ? { rejectUnauthorized: false, servername: '127.0.0.1' }
    : undefined;

  return new ImapFlow({
    host: cred.imap.host,
    port: cred.imap.port ?? 993,
    secure: cred.imap.secure ?? true,
    auth,
    logger: false,
    ...(tls ? { tls } : {}),
  });
}

async function smtpTransport(cred) {
  const { nodemailer } = await getMailDeps();
  const isOAuth = cred.authMethod === 'oauth' || cred.auth?.oauth;
  const auth = isOAuth
    ? { type: 'OAuth2', user: cred.auth.user, accessToken: cred.auth.oauth.accessToken }
    : { user: cred.auth.user, pass: cred.auth.pass };

  const tls = cred.smtp.host === '127.0.0.1'
    ? { rejectUnauthorized: false, servername: '127.0.0.1' }
    : undefined;

  return nodemailer.createTransport({
    host: cred.smtp.host,
    port: cred.smtp.port ?? 587,
    secure: cred.smtp.secure ?? false,
    auth,
    ...(tls ? { tls } : {}),
  });
}

// --- actions ---
// PROBE: verify sign-in + read; NEVER sends. Satisfies "connection test ≠ send" rule.
async function probe(cred) {
  const c = await imapClient(cred);
  await c.connect();
  try {
    const lock = await c.getMailboxLock('INBOX');
    try {
      const status = await c.status('INBOX', { messages: true, unseen: true });
      let smtpOk = true;
      try { await (await smtpTransport(cred)).verify(); } catch { smtpOk = false; }
      return {
        status: 'executed', adapterCalled: true, willSend: false,
        reason: 'probe_read_ok', messages: status.messages, unseen: status.unseen, smtpOk,
      };
    } finally { lock.release(); }
  } finally { await c.logout(); }
}

async function listInbox(cred, { mailbox = 'INBOX', limit = 50 } = {}) {
  const c = await imapClient(cred);
  await c.connect();
  const out = [];
  try {
    const lock = await c.getMailboxLock(mailbox);
    try {
      const total = c.mailbox.exists;
      const from = Math.max(1, total - limit + 1);
      for await (const m of c.fetch(`${from}:*`, { envelope: true, flags: true, uid: true })) {
        out.push({
          uid: m.uid,
          subject: m.envelope?.subject ?? '',
          from: m.envelope?.from?.map((x) => x.address) ?? [],
          date: m.envelope?.date ?? null,
          seen: m.flags?.has('\\Seen') ?? false,
        });
      }
    } finally { lock.release(); }
  } finally { await c.logout(); }
  return { status: 'executed', adapterCalled: true, willSend: false, messages: out.reverse() };
}

async function fetchMessage(cred, { mailbox = 'INBOX', uid }) {
  const { simpleParser } = await getMailDeps();
  const c = await imapClient(cred);
  await c.connect();
  try {
    const lock = await c.getMailboxLock(mailbox);
    try {
      const msg = await c.fetchOne(uid, { source: true }, { uid: true });
      const parsed = await simpleParser(msg.source);
      return {
        status: 'executed', adapterCalled: true, willSend: false,
        message: {
          subject: parsed.subject, from: parsed.from?.text, to: parsed.to?.text,
          date: parsed.date, text: parsed.text, html: parsed.html || null,
          attachments: (parsed.attachments || []).map((a) => ({
            filename: a.filename, contentType: a.contentType, size: a.size,
          })),
        },
      };
    } finally { lock.release(); }
  } finally { await c.logout(); }
}

// SAVE DRAFT: IMAP APPEND to Drafts. No external send.
async function saveDraft(cred, { mailbox = 'Drafts', mime }) {
  const c = await imapClient(cred);
  await c.connect();
  try {
    const res = await c.append(mailbox, mime, ['\\Draft']);
    return { status: 'executed', adapterCalled: true, willSend: false, uid: res?.uid ?? null };
  } finally { await c.logout(); }
}

// SEND: the ONLY path that actually transmits. Requires confirmedSend:true — the renderer
// sets this only after the user clicks through the staged-send review step.
async function send(cred, { confirmedSend, message }) {
  if (confirmedSend !== true) {
    return { status: 'blocked', adapterCalled: false, willSend: false, reason: 'send_not_confirmed' };
  }
  const info = await (await smtpTransport(cred)).sendMail({
    from: message.from ?? cred.from,
    to: message.to, cc: message.cc, bcc: message.bcc,
    subject: message.subject, text: message.text, html: message.html,
    inReplyTo: message.inReplyTo, references: message.references,
  });
  return { status: 'executed', adapterCalled: true, willSend: true, messageId: info.messageId };
}

// --- IPC surface (namespaced channel names) ---
export function registerMailBridge() {
  ipcMain.handle('threatcaddy-mail:save-credential', (_e, { ref, cred }) => {
    saveCredential(ref, cred);
    return { ok: true };
  });

  ipcMain.handle('threatcaddy-mail:execute', async (_e, req) => {
    // req = { action, credentialReferenceId, params }
    const cred = loadCredential(req.credentialReferenceId);
    switch (req.action) {
      case 'probe':      return probe(cred);
      case 'list':       return listInbox(cred, req.params);
      case 'fetch':      return fetchMessage(cred, req.params);
      case 'save-draft': return saveDraft(cred, req.params);
      case 'send':       return send(cred, req.params);
      default:
        return { status: 'blocked', reason: 'unknown_action', adapterCalled: false, willSend: false };
    }
  });

  ipcMain.handle('threatcaddy-mail:start-oauth', async (_e, { providerId }) => {
    // Map EmailProviderId to MailProviderId ('google-gmail' → 'google', etc.)
    const providerMap = { 'google-gmail': 'google', 'microsoft-outlook': 'microsoft' };
    const mailProviderId = providerMap[providerId] ?? providerId;

    const tokens = await runOAuthPopout(mailProviderId);

    // Fetch user email from the provider (best-effort — not blocking)
    let email = null;
    try {
      if (mailProviderId === 'google') {
        const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        });
        const data = await resp.json();
        email = data.email ?? null;
      } else if (mailProviderId === 'microsoft') {
        const resp = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        });
        const data = await resp.json();
        email = data.mail ?? data.userPrincipalName ?? null;
      }
    } catch (_err) { /* email display name is optional */ }

    const credRefId = crypto.randomUUID().replace(/-/g, '');

    const OAUTH_ENDPOINTS = {
      google:    { imap: { host: 'imap.gmail.com',         port: 993, secure: true  }, smtp: { host: 'smtp.gmail.com',       port: 465, secure: true  } },
      microsoft: { imap: { host: 'outlook.office365.com',  port: 993, secure: true  }, smtp: { host: 'smtp.office365.com',   port: 587, secure: false } },
    };
    const ep = OAUTH_ENDPOINTS[mailProviderId] ?? OAUTH_ENDPOINTS.google;

    saveCredential(credRefId, {
      kind: 'imap-smtp',
      imap: ep.imap,
      smtp: ep.smtp,
      authMethod: 'oauth',
      auth: {
        user: email ?? '',
        oauth: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt },
      },
      from: email ?? '',
    });

    return { credRefId, email };
  });
}
