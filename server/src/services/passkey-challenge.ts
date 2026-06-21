/**
 * In-memory challenge store for the two-step WebAuthn ceremony.
 * Per-user for registration (keyed by userId), per-session for auth (keyed by nanoid sessionId).
 * TTL 5 minutes. Single-process only — a Redis adapter would be needed for clustered deployments.
 */

interface ChallengeEntry {
  challenge: string;
  userId?: string;
  expiresAt: number;
}

const store = new Map<string, ChallengeEntry>();
const TTL_MS = 5 * 60 * 1000;

// Prune expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now > v.expiresAt) store.delete(k);
  }
}, 60_000);

export function storeChallenge(key: string, challenge: string, userId?: string) {
  store.set(key, { challenge, userId, expiresAt: Date.now() + TTL_MS });
}

/** Retrieve and delete the challenge (one-shot). Returns null if missing or expired. */
export function consumeChallenge(key: string): ChallengeEntry | null {
  const entry = store.get(key);
  if (!entry) return null;
  store.delete(key);
  if (Date.now() > entry.expiresAt) return null;
  return entry;
}
