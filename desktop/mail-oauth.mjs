// desktop/mail-oauth.mjs
//
// OAuth "mini popout" for Gmail / Microsoft 365. Runs in the Electron MAIN process.
// Composes with desktop/mail-bridge.mjs (imapflow / nodemailer / safeStorage).
//
// Flow: open a small Electron BrowserWindow at the provider's authUrl with a loopback
// redirect (http://127.0.0.1:<random>/cb) + PKCE → user signs in in the popout → we
// capture ?code → exchange at tokenUrl → return { accessToken, refreshToken, expiresAt }.
// Store the result with saveCredential() in mail-bridge.mjs, setting authMethod:'oauth'.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// SETUP (one-time, per provider — never commit these values to the repo):
//
//   Google:
//     1. console.cloud.google.com → APIs & Services → Library → enable "Gmail API"
//     2. Credentials → Create → OAuth client ID → "Desktop app"
//     3. Copy the Client ID below (Google Desktop clients use PKCE; no secret needed)
//
//   Microsoft:
//     1. portal.azure.com → Microsoft Entra → App registrations → New registration
//     2. "Accounts in any organizational directory and personal Microsoft accounts"
//     3. Platform: Mobile and desktop → add redirect http://localhost (loopback)
//     4. API permissions → delegated: IMAP.AccessAsUser.All, SMTP.Send, offline_access
//     5. Copy the Application (client) ID below
//
//   Store them in a local untracked config file or env vars — never hardcode in the repo.
// ─────────────────────────────────────────────────────────────────────────────────────

import { BrowserWindow } from 'electron';
import http from 'node:http';
import crypto from 'node:crypto';
import { getMailProvider } from './mail-providers.mjs';

// Dev override: set in desktop/.env.desktop (gitignored) to use a different client ID locally
// without rebuilding. desktop/.env.desktop example:
//   TC_GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
//   TC_MICROSOFT_CLIENT_ID=<your-azure-app-client-id>
//
// Packaged-build default: a Google OAuth "Desktop app" client ID is a public identifier, not a
// secret — this client type has no client secret and relies on PKCE (see runOAuthPopout below),
// so baking it into the shipped binary is the normal, documented pattern for desktop OAuth clients
// (same reasoning electron apps and CLIs use). The env var above still takes precedence in dev.
// See docs/handoff/DESKTOP-PACKAGING-PLAN.md for the decision record.
const BAKED_IN_OAUTH_CLIENT_IDS = {
  google: '399738137685-fg92p2mlem7c86akb9pdjb1v554lbe45.apps.googleusercontent.com',
};

const OAUTH_CLIENT_IDS = {
  ...BAKED_IN_OAUTH_CLIENT_IDS,
  ...(process.env.TC_GOOGLE_CLIENT_ID    ? { google:    process.env.TC_GOOGLE_CLIENT_ID    } : {}),
  ...(process.env.TC_MICROSOFT_CLIENT_ID ? { microsoft: process.env.TC_MICROSOFT_CLIENT_ID } : {}),
};

// --- PKCE helpers ---
function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makePkce() {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

// --- loopback redirect server: returns { redirectUri, waitForCode() } ---
function startLoopbackServer() {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const redirectUri = `http://127.0.0.1:${port}/cb`;
      let resolveCode;
      const codePromise = new Promise((res) => { resolveCode = res; });
      server.on('request', (req, res) => {
        const url = new URL(req.url, redirectUri);
        if (url.pathname === '/cb') {
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body style="font-family:sans-serif;padding:2em">You can close this window and return to ThreatCaddy.</body></html>');
          resolveCode({ code, error });
          setTimeout(() => server.close(), 500);
        } else {
          res.writeHead(404); res.end();
        }
      });
      resolve({ redirectUri, waitForCode: () => codePromise });
    });
  });
}

/**
 * Open the OAuth consent popout and return tokens.
 * clientId defaults to the preset in OAUTH_CLIENT_IDS above; pass explicitly to override.
 */
export async function runOAuthPopout(providerId, { clientId, clientSecret } = {}) {
  const preset = getMailProvider(providerId);
  if (!preset?.oauth) throw new Error(`Provider ${providerId} has no OAuth config`);

  const resolvedClientId = clientId ?? OAUTH_CLIENT_IDS[providerId];
  if (!resolvedClientId) {
    throw new Error(
      `No OAuth client ID configured for "${providerId}". ` +
      'See the SETUP section in desktop/mail-oauth.mjs.',
    );
  }

  const { authUrl, tokenUrl, scopes } = preset.oauth;
  const { redirectUri, waitForCode } = await startLoopbackServer();
  const { verifier, challenge } = makePkce();
  const state = b64url(crypto.randomBytes(16));

  const auth = new URL(authUrl);
  auth.searchParams.set('client_id', resolvedClientId);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('redirect_uri', redirectUri);
  auth.searchParams.set('scope', scopes.join(' '));
  auth.searchParams.set('code_challenge', challenge);
  auth.searchParams.set('code_challenge_method', 'S256');
  auth.searchParams.set('state', state);
  auth.searchParams.set('access_type', 'offline'); // Google: request a refresh token
  auth.searchParams.set('prompt', 'consent');

  const win = new BrowserWindow({
    width: 480, height: 680, title: 'Connect mailbox — ThreatCaddy',
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  await win.loadURL(auth.toString());

  const { code, error } = await waitForCode();
  win.close();
  if (error || !code) throw new Error(`OAuth failed: ${error ?? 'no code returned'}`);

  // Exchange code → tokens
  const body = new URLSearchParams({
    client_id: resolvedClientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  if (clientSecret) body.set('client_secret', clientSecret);

  const resp = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!resp.ok) throw new Error(`Token exchange failed: ${resp.status} ${await resp.text()}`);
  const tok = await resp.json();
  return {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token ?? null,
    expiresAt: Date.now() + (tok.expires_in ?? 3600) * 1000,
    scope: tok.scope ?? null,
  };
}

/**
 * Refresh an expired access token. Call before each IMAP/SMTP op when Date.now() > expiresAt.
 */
export async function refreshAccessToken(providerId, { clientId, clientSecret, refreshToken }) {
  const preset = getMailProvider(providerId);
  if (!preset?.oauth) throw new Error(`Provider ${providerId} has no OAuth config`);

  const resolvedClientId = clientId ?? OAUTH_CLIENT_IDS[providerId];
  if (!resolvedClientId) {
    throw new Error(`No OAuth client ID configured for "${providerId}".`);
  }

  const body = new URLSearchParams({
    client_id: resolvedClientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  if (clientSecret) body.set('client_secret', clientSecret);

  const resp = await fetch(preset.oauth.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!resp.ok) throw new Error(`Token refresh failed: ${resp.status} ${await resp.text()}`);
  const tok = await resp.json();
  return {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token ?? refreshToken, // some providers don't re-issue
    expiresAt: Date.now() + (tok.expires_in ?? 3600) * 1000,
  };
}

// --- Usage in mail-bridge.mjs when authMethod === 'oauth' ---
//
//   imapflow auth:   { user: cred.auth.user, accessToken: cred.auth.oauth.accessToken }
//   nodemailer auth: { type: 'OAuth2', user: cred.auth.user, accessToken: ... }
//
//   Microsoft send fallback: if SMTP XOAUTH2 returns "SmtpClientAuthentication is disabled",
//   POST to https://graph.microsoft.com/v1.0/me/sendMail with Authorization: Bearer <token>.
