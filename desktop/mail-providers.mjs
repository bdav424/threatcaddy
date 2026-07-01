// desktop/mail-providers.mjs
//
// Plain-ESM copy of src/lib/mail-providers.ts for use in the Electron main process.
// Kept in sync with the TypeScript source manually — both files define the same
// MAIL_PROVIDERS table. The reason this copy exists: the TypeScript source
// can't be reliably imported by Node/Electron at runtime in a packaged build
// (no TypeScript compilation step in the main-process bundle), so we maintain
// this as a stable plain-JS peer. When you add/change a provider in mail-providers.ts,
// mirror the change here.

/** @typedef {'generic'|'proton'|'google'|'microsoft'} MailProviderId */
/** @typedef {'basic'|'oauth'} MailAuthMethod */

export const MAIL_PROVIDERS = {
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
    imap: { host: '127.0.0.1', port: 1143, secure: false },
    smtp: { host: '127.0.0.1', port: 1025, secure: false },
    localBridge: true,
    notes: 'Requires Proton Bridge (or hydroxide) running locally. Use the bridge-provided username and bridge password — NOT your Proton login. Trust the self-signed cert only on 127.0.0.1.',
  },

  google: {
    id: 'google',
    label: 'Gmail / Google Workspace',
    authMethods: ['oauth', 'basic'],
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
    oauth: {
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: ['https://mail.google.com/', 'https://www.googleapis.com/auth/calendar'],
      sendVia: 'smtp',
      clientKind: 'desktop-loopback-pkce',
    },
    notes: 'OAuth needs a Google Cloud "Desktop app" OAuth client ID. Basic needs an app password (requires 2-Step Verification).',
  },

  microsoft: {
    id: 'microsoft',
    label: 'Outlook / Microsoft 365',
    authMethods: ['oauth'],
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false },
    oauth: {
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      scopes: [
        'https://outlook.office365.com/IMAP.AccessAsUser.All',
        'https://outlook.office365.com/SMTP.Send',
        'https://graph.microsoft.com/Calendars.ReadWrite',
        'offline_access',
      ],
      sendVia: 'smtp',
      clientKind: 'desktop-loopback-pkce',
    },
    notes: 'OAuth only — register an app in Microsoft Entra (Azure). If SMTP AUTH is disabled on the mailbox, send via Microsoft Graph Mail.Send instead.',
  },
};

/** @param {MailProviderId} id */
export function getMailProvider(id) {
  return MAIL_PROVIDERS[id];
}

/** @param {MailProviderId} id @param {MailAuthMethod} method */
export function supportsAuth(id, method) {
  return MAIL_PROVIDERS[id].authMethods.includes(method);
}

/** @param {MailProviderId} id */
export function defaultAuthMethod(id) {
  return MAIL_PROVIDERS[id].authMethods[0];
}

export function listMailProviders() {
  return Object.values(MAIL_PROVIDERS);
}
