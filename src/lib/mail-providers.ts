// src/lib/mail-providers.ts
//
// One account flow, three providers. Each provider is a preset: host/port + which auth
// methods are allowed + (for OAuth) the endpoints and scopes. "All emails at once" = iterate
// this table, not three code paths.
//
// Auth matrix verified against current provider docs (June 2026):
//   • Generic IMAP/SMTP — username/password (basic).
//   • Proton           — username/password via the local Proton Bridge / hydroxide (127.0.0.1).
//   • Google/Gmail     — BOTH: app password (basic, needs 2-Step Verification) OR OAuth (XOAUTH2).
//   • Microsoft 365    — OAuth ONLY. Basic auth for IMAP died 2023; SMTP AUTH + app passwords
//                        were fully retired by Apr 30 2026. Do not offer username/password.
//
// The actual transport (imapflow / nodemailer / Graph) runs in the Electron main process —
// see desktop/mail-bridge.mjs (basic) and desktop/mail-oauth.mjs (OAuth) — never the browser.

export type MailProviderId = 'generic' | 'proton' | 'google' | 'microsoft';
export type MailAuthMethod = 'basic' | 'oauth';

export interface MailServerEndpoint {
  host: string;
  port: number;
  /** true = implicit TLS (e.g. 993/465); false = STARTTLS upgrade (e.g. 587). */
  secure: boolean;
}

export interface MailOAuthConfig {
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** How sending works once authed: SMTP (XOAUTH2) or the provider HTTP API. */
  sendVia: 'smtp' | 'graph';
  /** OAuth client type to register: desktop apps use a loopback (127.0.0.1) redirect + PKCE. */
  clientKind: 'desktop-loopback-pkce';
}

export interface MailProviderPreset {
  id: MailProviderId;
  label: string;
  /** Allowed methods, in preferred order. */
  authMethods: MailAuthMethod[];
  /** 'user' for generic, where the user supplies host/port. */
  imap: MailServerEndpoint | 'user';
  smtp: MailServerEndpoint | 'user';
  oauth?: MailOAuthConfig;
  /** localhost bridge providers self-sign their cert; only trust on loopback. */
  localBridge?: boolean;
  notes: string;
}

export const MAIL_PROVIDERS: Record<MailProviderId, MailProviderPreset> = {
  generic: {
    id: 'generic',
    label: 'Generic IMAP / SMTP',
    authMethods: ['basic'],
    imap: 'user',
    smtp: 'user',
    notes: 'Enter host, port, TLS, username, and password (or app password). Works with any IMAP/SMTP server.',
  },

  proton: {
    id: 'proton',
    label: 'Proton Mail (Bridge)',
    authMethods: ['basic'],
    imap: { host: '127.0.0.1', port: 1143, secure: false }, // STARTTLS, bridge cert
    smtp: { host: '127.0.0.1', port: 1025, secure: false }, // STARTTLS, bridge cert
    localBridge: true,
    notes: 'Requires Proton Bridge (or hydroxide) running locally. Use the bridge-provided username and bridge password — NOT your Proton login. Trust the self-signed cert only on 127.0.0.1.',
  },

  google: {
    id: 'google',
    label: 'Gmail / Google Workspace',
    authMethods: ['oauth', 'basic'], // OAuth preferred; app password also works with 2FA on
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
    oauth: {
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: ['https://mail.google.com/'],
      sendVia: 'smtp', // Gmail SMTP accepts XOAUTH2
      clientKind: 'desktop-loopback-pkce',
    },
    notes: 'OAuth needs a Google Cloud "Desktop app" OAuth client ID. Basic needs an app password (requires 2-Step Verification).',
  },

  microsoft: {
    id: 'microsoft',
    label: 'Outlook / Microsoft 365',
    authMethods: ['oauth'], // basic auth retired 2023 (IMAP) / Apr 2026 (SMTP) — OAuth only
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false }, // STARTTLS
    oauth: {
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      scopes: [
        'https://outlook.office365.com/IMAP.AccessAsUser.All',
        'https://outlook.office365.com/SMTP.Send',
        'offline_access',
      ],
      // Many consumer Outlook.com mailboxes have SMTP AUTH disabled server-side; if XOAUTH2
      // SMTP returns "SmtpClientAuthentication is disabled", fall back to Graph Mail.Send.
      sendVia: 'smtp',
      clientKind: 'desktop-loopback-pkce',
    },
    notes: 'OAuth only — register an app in Microsoft Entra (Azure). If SMTP AUTH is disabled on the mailbox, send via Microsoft Graph Mail.Send instead.',
  },
};

export function getMailProvider(id: MailProviderId): MailProviderPreset {
  return MAIL_PROVIDERS[id];
}

export function supportsAuth(id: MailProviderId, method: MailAuthMethod): boolean {
  return MAIL_PROVIDERS[id].authMethods.includes(method);
}

/** Preferred auth method for a provider (first in its list). */
export function defaultAuthMethod(id: MailProviderId): MailAuthMethod {
  return MAIL_PROVIDERS[id].authMethods[0];
}

export function listMailProviders(): MailProviderPreset[] {
  return Object.values(MAIL_PROVIDERS);
}
