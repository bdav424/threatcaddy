import { nanoid } from 'nanoid';
import { db } from '../db';

export const ENRICHMENT_CACHE_DEFAULT_TTL_HOURS = 24;

export function buildEnrichmentCacheKey(templateId: string, iocType: string, iocValue: string): string {
  return `${templateId}:${iocType}:${iocValue.toLowerCase().trim()}`;
}

/** Returns cached result or null if absent or expired. Prunes expired entry on miss. */
export async function getFromEnrichmentCache(cacheKey: string): Promise<unknown | null> {
  const entry = await db.enrichmentCache.where('cacheKey').equals(cacheKey).first();
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    await db.enrichmentCache.delete(entry.id);
    return null;
  }
  return entry.result;
}

/** Upserts a cache entry for the given template+IOC key. */
export async function setInEnrichmentCache(
  templateId: string,
  iocType: string,
  iocValue: string,
  result: unknown,
  ttlHours = ENRICHMENT_CACHE_DEFAULT_TTL_HOURS,
): Promise<void> {
  const cacheKey = buildEnrichmentCacheKey(templateId, iocType, iocValue);
  const now = Date.now();
  const existing = await db.enrichmentCache.where('cacheKey').equals(cacheKey).first();
  if (existing) {
    await db.enrichmentCache.update(existing.id, {
      result,
      ttlHours,
      expiresAt: now + ttlHours * 3_600_000,
      createdAt: now,
    });
    return;
  }
  await db.enrichmentCache.add({
    id: nanoid(),
    cacheKey,
    templateId,
    iocType,
    iocValue: iocValue.toLowerCase().trim(),
    result,
    ttlHours,
    expiresAt: now + ttlHours * 3_600_000,
    createdAt: now,
  });
}

/** Deletes all entries whose expiresAt is in the past. Returns the count removed. */
export async function pruneExpiredEnrichmentCache(): Promise<number> {
  const expired = await db.enrichmentCache.where('expiresAt').below(Date.now()).toArray();
  if (expired.length === 0) return 0;
  await db.enrichmentCache.bulkDelete(expired.map((e) => e.id));
  return expired.length;
}

/** Returns all non-expired cache entries for a given template. */
export async function listEnrichmentCacheByTemplate(templateId: string): Promise<{ iocValue: string; expiresAt: number }[]> {
  const now = Date.now();
  const entries = await db.enrichmentCache.where('templateId').equals(templateId).toArray();
  return entries
    .filter((e) => e.expiresAt > now)
    .map((e) => ({ iocValue: e.iocValue, expiresAt: e.expiresAt }));
}

/** Clears all cache entries (useful in settings / debug). */
export async function clearEnrichmentCache(): Promise<void> {
  await db.enrichmentCache.clear();
}
