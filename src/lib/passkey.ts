// src/lib/passkey.ts
//
// WebAuthn passkey helpers for the desktop sync-auth flow.
// Renderer-only — no IPC needed for the WebAuthn ceremony itself.
// Works only in Electron (navigator.credentials exists in the Chromium renderer).

/** Returns true when the current environment supports WebAuthn. */
export function passkeySupported(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined';
}

/** Register a new passkey for userId/userName. Returns credentialId + publicKey. */
export async function registerPasskey(
  userId: string,
  userName: string,
): Promise<{ credentialId: string; publicKey: string }> {
  if (!passkeySupported()) throw new Error('WebAuthn not supported in this environment');

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const userIdBytes = new TextEncoder().encode(userId);

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp:                 { name: 'ThreatCaddy' },
      user:               { id: userIdBytes, name: userName, displayName: userName },
      pubKeyCredParams:   [
        { type: 'public-key', alg: -7  },  // ES256
        { type: 'public-key', alg: -257 }, // RS256 fallback
      ],
      authenticatorSelection: {
        userVerification: 'required',
        residentKey:      'preferred',
      },
      attestation: 'none',
      timeout:     60_000,
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error('Passkey registration was cancelled');

  const response = credential.response as AuthenticatorAttestationResponse;
  const pubKeyBytes = response.getPublicKey?.();
  if (!pubKeyBytes) throw new Error('Authenticator did not return a public key');

  const credentialId = bufferToBase64url(credential.rawId);
  const publicKey    = bufferToBase64url(pubKeyBytes);
  return { credentialId, publicKey };
}

/**
 * Verify an existing passkey.
 * Returns true on successful user-verification assertion.
 */
export async function verifyPasskey(credentialId: string): Promise<boolean> {
  if (!passkeySupported()) return false;

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const rawId = base64urlToBuffer(credentialId);

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ type: 'public-key', id: rawId.buffer as ArrayBuffer }],
      userVerification: 'required',
      timeout:          60_000,
    },
  })) as PublicKeyCredential | null;

  return assertion !== null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bufferToBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBuffer(s: string): Uint8Array {
  const base64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), '='));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
