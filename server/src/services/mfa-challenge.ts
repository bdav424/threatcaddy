/**
 * MFA challenge tokens — short-lived (5 min), single-use JWTs issued after
 * the password check succeeds but before MFA verification completes.
 *
 * They carry only the userId and cannot be used to call any API.
 * The MFA verify endpoint trades one for full access/refresh tokens.
 */

import { SignJWT, jwtVerify } from 'jose';

const ALG = 'HS256';
const TTL_SECONDS = 5 * 60;

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET not set');
  return new TextEncoder().encode(s + ':mfa-challenge');
}

export async function signMfaChallenge(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, purpose: 'mfa-challenge' })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyMfaChallenge(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, getSecret());
  if (payload.purpose !== 'mfa-challenge' || !payload.sub) {
    throw new Error('Invalid MFA challenge token');
  }
  return payload.sub;
}
