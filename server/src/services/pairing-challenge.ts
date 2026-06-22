/**
 * In-memory store for short-lived sync device pairing codes.
 * Keyed by sha256(pairingCode). TTL 10 minutes.
 * Single-process only — a Redis adapter would be needed for clustered deployments.
 */

interface PairingEntry {
  userId: string;
  expiresAt: number;
}

const store = new Map<string, PairingEntry>();
const TTL_MS = 10 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now > v.expiresAt) store.delete(k);
  }
}, 60_000);

export function storePairingCode(codeHash: string, userId: string) {
  store.set(codeHash, { userId, expiresAt: Date.now() + TTL_MS });
}

/** Retrieve and delete (one-shot). Returns null if missing, expired, or wrong user. */
export function consumePairingCode(codeHash: string, userId: string): boolean {
  const entry = store.get(codeHash);
  if (!entry) return false;
  store.delete(codeHash);
  if (Date.now() > entry.expiresAt) return false;
  if (entry.userId !== userId) return false;
  return true;
}
