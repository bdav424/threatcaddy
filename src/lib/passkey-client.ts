/**
 * Browser-side passkey helpers wrapping @simplewebauthn/browser.
 * All functions throw on error so callers can catch and show messages.
 */

import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';

export { browserSupportsWebAuthn };

export interface PasskeyInfo {
  id: string;
  name: string;
  deviceType: string | null;
  createdAt: string;
}

interface RegisterResult {
  id: string;
  name: string;
}

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; displayName: string; role: string; avatarUrl: string | null };
}

export async function registerPasskey(
  serverUrl: string,
  accessToken: string,
  name?: string,
): Promise<RegisterResult> {
  // Step 1: Get registration options
  const beginResp = await fetch(`${serverUrl}/api/passkeys/register/begin`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!beginResp.ok) {
    const err = await beginResp.json();
    throw new Error(err.error ?? 'Failed to start passkey registration');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = await beginResp.json();

  // Step 2: Browser WebAuthn prompt
  const credential = await startRegistration({ optionsJSON: options });

  // Step 3: Verify and save
  const finishResp = await fetch(`${serverUrl}/api/passkeys/register/finish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ response: credential, name }),
  });
  if (!finishResp.ok) {
    const err = await finishResp.json();
    throw new Error(err.error ?? 'Failed to verify passkey registration');
  }
  return finishResp.json();
}

export async function authenticateWithPasskey(
  serverUrl: string,
  email?: string,
): Promise<AuthResult> {
  // Step 1: Get authentication options
  const beginResp = await fetch(`${serverUrl}/api/passkeys/auth/begin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!beginResp.ok) {
    const err = await beginResp.json();
    throw new Error(err.error ?? 'Failed to start passkey authentication');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { options, sessionId }: { options: any; sessionId: string } = await beginResp.json();

  // Step 2: Browser WebAuthn prompt
  const credential = await startAuthentication({ optionsJSON: options });

  // Step 3: Verify and get tokens
  const finishResp = await fetch(`${serverUrl}/api/passkeys/auth/finish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response: credential, sessionId }),
  });
  if (!finishResp.ok) {
    const err = await finishResp.json();
    throw new Error(err.error ?? 'Passkey authentication failed');
  }
  return finishResp.json();
}

export async function listPasskeys(serverUrl: string, accessToken: string): Promise<PasskeyInfo[]> {
  const resp = await fetch(`${serverUrl}/api/passkeys`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) throw new Error('Failed to fetch passkeys');
  return resp.json();
}

export async function deletePasskey(serverUrl: string, accessToken: string, id: string): Promise<void> {
  const resp = await fetch(`${serverUrl}/api/passkeys/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error ?? 'Failed to delete passkey');
  }
}
