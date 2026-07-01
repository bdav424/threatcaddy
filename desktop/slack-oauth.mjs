// desktop/slack-oauth.mjs
//
// Loopback OAuth for Slack (user token flow, not bot).
// Tokens never leave the main process — renderer receives only { credRefId, workspaceName, userName }.
//
// Env vars (set in desktop/.env.desktop — never commit real values):
//   TC_SLACK_CLIENT_ID      — from api.slack.com/apps → Basic Information
//   TC_SLACK_CLIENT_SECRET  — same
//
// Slack app requirements:
//   OAuth & Permissions → Redirect URLs → add http://127.0.0.1  (any port is accepted on loopback)
//   OAuth & Permissions → User Token Scopes → im:read, im:history, users:read

import { BrowserWindow } from 'electron';
import http from 'node:http';
import crypto from 'node:crypto';

const AUTH_URL   = 'https://slack.com/oauth/v2/authorize';
const TOKEN_URL  = 'https://slack.com/api/oauth.v2.access';
const USER_SCOPE = 'im:read,im:history,users:read';

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
          res.end('<html><body style="font-family:sans-serif;padding:2em">Slack connected — you can close this window and return to ThreatCaddy.</body></html>');
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
 * Run the Slack OAuth consent popout.
 * Returns { userToken, workspaceName, userName, userId, teamId }.
 */
export async function runSlackOAuthPopout() {
  const clientId     = process.env.TC_SLACK_CLIENT_ID;
  const clientSecret = process.env.TC_SLACK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Slack OAuth not configured. Set TC_SLACK_CLIENT_ID and TC_SLACK_CLIENT_SECRET in desktop/.env.desktop.',
    );
  }

  const { redirectUri, waitForCode } = await startLoopbackServer();
  const state = crypto.randomBytes(16).toString('hex');

  const authParams = new URLSearchParams({
    client_id:    clientId,
    user_scope:   USER_SCOPE,
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
  });

  const authWindow = new BrowserWindow({
    width:  520,
    height: 720,
    title:  'Connect Slack — ThreatCaddy',
    show:   false,
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      sandbox:          true,
    },
  });
  authWindow.once('ready-to-show', () => authWindow.show());
  await authWindow.loadURL(`${AUTH_URL}?${authParams.toString()}`);

  const { code, error } = await waitForCode();
  if (!authWindow.isDestroyed()) authWindow.close();

  if (error || !code) throw new Error(`Slack OAuth denied: ${error ?? 'no code'}`);

  // Exchange code for user token
  const tokenResp = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      code,
      redirect_uri:  redirectUri,
    }).toString(),
  });
  const tokenData = await tokenResp.json();

  if (!tokenData.ok) throw new Error(`Slack token exchange failed: ${tokenData.error}`);

  const userToken = tokenData.authed_user?.access_token;
  if (!userToken) throw new Error('Slack OAuth: no user token in response');

  // Resolve display name
  let userName = tokenData.authed_user?.id ?? 'Unknown';
  try {
    const meResp = await fetch(
      `https://slack.com/api/users.info?user=${encodeURIComponent(tokenData.authed_user.id)}`,
      { headers: { Authorization: `Bearer ${userToken}` } },
    );
    const meData = await meResp.json();
    if (meData.ok) userName = meData.user?.real_name ?? meData.user?.name ?? userName;
  } catch { /* best-effort */ }

  return {
    userToken,
    userId:        tokenData.authed_user?.id ?? '',
    teamId:        tokenData.team?.id ?? '',
    workspaceName: tokenData.team?.name ?? 'Slack Workspace',
    userName,
  };
}
