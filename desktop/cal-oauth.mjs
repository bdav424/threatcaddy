// desktop/cal-oauth.mjs
//
// PKCE loopback OAuth for Google Calendar and Microsoft Graph Calendar.
// Mirrors mail-oauth.mjs but uses calendar-specific scopes and a separate
// CLIENT ID env var path (falls back to the mail client IDs if unset — safe
// when the same Google/Azure app registration covers both mail and calendar).
//
// Env vars (set in desktop/.env.desktop — never commit real values):
//   TC_GOOGLE_CALENDAR_CLIENT_ID   (defaults to TC_GOOGLE_CLIENT_ID)
//   TC_MICROSOFT_CALENDAR_CLIENT_ID (defaults to TC_MICROSOFT_CLIENT_ID)

import { BrowserWindow } from 'electron';
import http from 'node:http';
import crypto from 'node:crypto';

const ENDPOINTS = {
  google: {
    authUrl:  'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes:   ['https://www.googleapis.com/auth/calendar', 'openid', 'email'],
  },
  microsoft: {
    authUrl:  'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes:   ['https://graph.microsoft.com/Calendars.ReadWrite', 'openid', 'email', 'offline_access'],
  },
};

const CLIENT_IDS = {
  google:    process.env.TC_GOOGLE_CALENDAR_CLIENT_ID    ?? process.env.TC_GOOGLE_CLIENT_ID,
  microsoft: process.env.TC_MICROSOFT_CALENDAR_CLIENT_ID ?? process.env.TC_MICROSOFT_CLIENT_ID,
};

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makePkce() {
  const verifier  = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function startLoopbackServer() {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port        = server.address().port;
      const redirectUri = `http://127.0.0.1:${port}/cb`;
      let resolveCode;
      const codePromise = new Promise((res) => { resolveCode = res; });
      server.on('request', (req, res) => {
        const url = new URL(req.url, redirectUri);
        if (url.pathname === '/cb') {
          const code  = url.searchParams.get('code');
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
 * Fetch email address from provider userinfo endpoint using a fresh access token.
 * Returns null on any failure (email is best-effort).
 */
async function fetchUserEmail(providerId, accessToken) {
  try {
    const url   = providerId === 'google'
      ? 'https://www.googleapis.com/oauth2/v3/userinfo'
      : 'https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName';
    const resp  = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!resp.ok) return null;
    const data  = await resp.json();
    return providerId === 'google'
      ? (data.email ?? null)
      : (data.mail ?? data.userPrincipalName ?? null);
  } catch {
    return null;
  }
}

/**
 * Open the OAuth consent popout and return tokens + email.
 * Stores nothing — caller (main.mjs calendar:start-oauth) stores via safeStorage.
 */
export async function runCalendarOAuthPopout(providerId) {
  const ep = ENDPOINTS[providerId];
  if (!ep) throw new Error(`Unknown calendar provider: ${providerId}`);

  const clientId = CLIENT_IDS[providerId];
  if (!clientId) {
    throw new Error(
      `No OAuth client ID configured for calendar "${providerId}". ` +
      'Set TC_GOOGLE_CALENDAR_CLIENT_ID or TC_MICROSOFT_CALENDAR_CLIENT_ID in desktop/.env.desktop.',
    );
  }

  const { redirectUri, waitForCode } = await startLoopbackServer();
  const { verifier, challenge }      = makePkce();
  const state                        = b64url(crypto.randomBytes(16));

  const auth = new URL(ep.authUrl);
  auth.searchParams.set('client_id',             clientId);
  auth.searchParams.set('response_type',         'code');
  auth.searchParams.set('redirect_uri',          redirectUri);
  auth.searchParams.set('scope',                 ep.scopes.join(' '));
  auth.searchParams.set('code_challenge',        challenge);
  auth.searchParams.set('code_challenge_method', 'S256');
  auth.searchParams.set('state',                 state);
  if (providerId === 'google') {
    auth.searchParams.set('access_type', 'offline');
    auth.searchParams.set('prompt',      'consent');
  }

  const win = new BrowserWindow({
    width: 480, height: 680,
    title: 'Connect calendar — ThreatCaddy',
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  await win.loadURL(auth.toString());

  const { code, error } = await waitForCode();
  win.close();
  if (error || !code) throw new Error(`Calendar OAuth failed: ${error ?? 'no code returned'}`);

  const body = new URLSearchParams({
    client_id:     clientId,
    grant_type:    'authorization_code',
    code,
    redirect_uri:  redirectUri,
    code_verifier: verifier,
  });

  const resp = await fetch(ep.tokenUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!resp.ok) throw new Error(`Calendar token exchange failed: ${resp.status} ${await resp.text()}`);
  const tok = await resp.json();

  const accessToken  = tok.access_token;
  const refreshToken = tok.refresh_token ?? null;
  const expiresAt    = Date.now() + (tok.expires_in ?? 3600) * 1000;
  const email        = await fetchUserEmail(providerId, accessToken);

  return { accessToken, refreshToken, expiresAt, email, clientId };
}

/**
 * Refresh an expired Google Calendar access token.
 * Microsoft Graph tokens are always re-fetched via getGraphToken() in mail-calendar-sync.mjs.
 */
export async function refreshCalendarToken(providerId, { clientId, refreshToken }) {
  const ep = ENDPOINTS[providerId];
  if (!ep) throw new Error(`Unknown calendar provider: ${providerId}`);

  const resolvedClientId = clientId ?? CLIENT_IDS[providerId];
  if (!resolvedClientId) throw new Error(`No OAuth client ID configured for calendar "${providerId}"`);

  const body = new URLSearchParams({
    client_id:     resolvedClientId,
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
  });

  const resp = await fetch(ep.tokenUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!resp.ok) throw new Error(`Calendar token refresh failed: ${resp.status} ${await resp.text()}`);
  const tok = await resp.json();

  return {
    accessToken:  tok.access_token,
    refreshToken: tok.refresh_token ?? refreshToken,
    expiresAt:    Date.now() + (tok.expires_in ?? 3600) * 1000,
  };
}
