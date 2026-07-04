/**
 * IOC re-check diffing — compares a new enrichment snapshot against the prior
 * stored snapshot and surfaces what changed: score deltas, status changes,
 * and vendor detection changes.
 */

import Dexie from 'dexie';
import { nanoid } from 'nanoid';
import { db } from '../db';
import type { IOCRecheckDiff } from '../types';

// ── Snapshot extraction helpers ─────────────────────────────────────────────

type Snapshot = Record<string, unknown>;

/**
 * Try to extract a numeric "maliciousness score" from an enrichment snapshot.
 * VT uses `positives` (legacy API v2) or `malicious` (domain/hash v3 votes).
 * We prefer `positives`, fall back to `malicious`.
 */
function extractScore(snapshot: Snapshot): number | undefined {
  if (typeof snapshot.positives === 'number') return snapshot.positives;
  if (typeof snapshot.malicious === 'number') return snapshot.malicious;
  if (typeof snapshot.detections === 'number') return snapshot.detections;
  return undefined;
}

/**
 * Extract the set of vendor names that flagged the IOC as malicious.
 * Reads from `snapshot.scans` (VT hash/IP/domain object keyed by vendor).
 */
function extractVendorSet(snapshot: Snapshot): Set<string> {
  const vendors = new Set<string>();
  const scans = snapshot.scans;
  if (!scans || typeof scans !== 'object' || Array.isArray(scans)) return vendors;
  for (const [vendor, result] of Object.entries(scans as Record<string, unknown>)) {
    if (result && typeof result === 'object') {
      const r = result as Record<string, unknown>;
      if (r.detected === true || r.result === 'malicious' || r.category === 'malicious') {
        vendors.add(vendor);
      }
    }
  }
  return vendors;
}

// ── Diff computation ─────────────────────────────────────────────────────────

export interface RecheckDiffInput {
  iocId: string;
  priorEnrichment: Record<string, Array<Snapshot>> | undefined;
  newEnrichment: Record<string, Array<Snapshot>> | undefined;
  priorStatus: string | undefined;
  newStatus: string | undefined;
}

/**
 * Compute a diff between two enrichment states for the same IOC.
 * Returns null if there is no meaningful change (first enrichment, or no data).
 *
 * Called by persistIOCIntegrationUpdate when an existing IOC is being updated.
 */
export function computeIOCRecheckDiff(input: RecheckDiffInput): IOCRecheckDiff | null {
  const { iocId, priorEnrichment, newEnrichment, priorStatus, newStatus } = input;

  // Nothing to diff if there was no prior enrichment (first check)
  if (!priorEnrichment || Object.keys(priorEnrichment).length === 0) return null;
  if (!newEnrichment || Object.keys(newEnrichment).length === 0) return null;

  // For each provider in the new enrichment, compare with the prior snapshot
  let priorScore: number | undefined;
  let newScore: number | undefined;
  const priorVendors = new Set<string>();
  const newVendors = new Set<string>();

  for (const provider of Object.keys(newEnrichment)) {
    const newSnapshots = newEnrichment[provider];
    const priorSnapshots = priorEnrichment[provider];

    const newSnap = newSnapshots?.[0];
    const priorSnap = priorSnapshots?.[0];

    if (newSnap) {
      const s = extractScore(newSnap);
      if (s !== undefined) newScore = (newScore ?? 0) + s;
      for (const v of extractVendorSet(newSnap)) newVendors.add(v);
    }
    if (priorSnap) {
      const s = extractScore(priorSnap);
      if (s !== undefined) priorScore = (priorScore ?? 0) + s;
      for (const v of extractVendorSet(priorSnap)) priorVendors.add(v);
    }
  }

  const scoreDelta =
    newScore !== undefined && priorScore !== undefined
      ? newScore - priorScore
      : undefined;

  const statusChanged = Boolean(
    (priorStatus || newStatus) && priorStatus !== newStatus,
  );

  const newDetections = [...newVendors].filter((v) => !priorVendors.has(v));
  const resolvedDetections = [...priorVendors].filter((v) => !newVendors.has(v));

  // Skip trivial no-op diffs (scores identical, status unchanged, no vendor changes)
  const hasChange =
    statusChanged ||
    (scoreDelta !== undefined && scoreDelta !== 0) ||
    newDetections.length > 0 ||
    resolvedDetections.length > 0;

  if (!hasChange) return null;

  // Build human-readable summary
  const parts: string[] = [];
  if (scoreDelta !== undefined && scoreDelta !== 0) {
    const sign = scoreDelta > 0 ? '+' : '';
    parts.push(`Score: ${priorScore}→${newScore} (${sign}${scoreDelta})`);
  }
  if (statusChanged && newStatus) {
    parts.push(`Status: ${priorStatus || 'unset'}→${newStatus}`);
  }
  if (newDetections.length > 0) {
    parts.push(`${newDetections.length} new detection${newDetections.length === 1 ? '' : 's'}`);
  }
  if (resolvedDetections.length > 0) {
    parts.push(`${resolvedDetections.length} resolved`);
  }
  const summary = parts.join('. ') || 'Enrichment updated.';

  return {
    id: nanoid(),
    iocId,
    checkedAt: Date.now(),
    priorScore,
    newScore,
    scoreDelta,
    priorStatus,
    newStatus,
    statusChanged,
    newDetections,
    resolvedDetections,
    summary,
  };
}

/**
 * Persist an IOCRecheckDiff record to the iocRecheckDiffs table.
 * Silently ignores errors (diffing is best-effort; it must not block the main update).
 */
export async function saveRecheckDiff(diff: IOCRecheckDiff): Promise<void> {
  try {
    await db.iocRecheckDiffs.add(diff);
  } catch {
    // Non-fatal — diff write failure must not break enrichment flow
  }
}

/**
 * Retrieve the most recent recheck diff for a given IOC, if any.
 */
export async function getLatestRecheckDiff(iocId: string): Promise<IOCRecheckDiff | undefined> {
  const diffs = await db.iocRecheckDiffs
    .where('[iocId+checkedAt]')
    .between([iocId, Dexie.minKey], [iocId, Dexie.maxKey])
    .reverse()
    .limit(1)
    .toArray();
  return diffs[0];
}
