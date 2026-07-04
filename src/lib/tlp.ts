/**
 * TLP (Traffic Light Protocol) share-gating helpers.
 * These are pure functions — no DB access, no side effects.
 *
 * Note: ThreatCaddy's internal classification system uses the same TLP level
 * strings (stored as clsLevel on entities). This module provides the CTI
 * interop layer: share-gating logic, level merging, and human descriptions.
 */

export type TLPLevel =
  | 'TLP:CLEAR'
  | 'TLP:GREEN'
  | 'TLP:AMBER'
  | 'TLP:AMBER+STRICT'
  | 'TLP:RED';

/** Ordered from least to most restrictive. */
const TLP_ORDER: TLPLevel[] = [
  'TLP:CLEAR',
  'TLP:GREEN',
  'TLP:AMBER',
  'TLP:AMBER+STRICT',
  'TLP:RED',
];

function tlpIndex(level: TLPLevel): number {
  return TLP_ORDER.indexOf(level);
}

/**
 * Returns true when sharing `source`-marked content to a `destination`
 * community is permitted under TLP rules.
 *
 * TLP sharing matrix:
 *  CLEAR      → anyone (public)
 *  GREEN      → any organization in the community (not public)
 *  AMBER      → recipients and their organizations only
 *  AMBER+STRICT → named recipients only (no forwarding to org)
 *  RED        → present recipients only — no sharing permitted
 */
export function tlpPermitsShare(source: TLPLevel, destination: TLPLevel): boolean {
  // RED: never shareable beyond the room it was shared in
  if (source === 'TLP:RED') return false;
  // AMBER+STRICT: only to the named recipient (destination must be at least as
  // restrictive as source for any automated export to be safe)
  if (source === 'TLP:AMBER+STRICT') return false;
  // AMBER: can share within recipient's organization but not broadly
  // For export purposes treat as requiring explicit confirmation (not blocked
  // outright). Return true here so callers can distinguish AMBER from RED.
  // Callers that need the warn-but-allow behavior check source directly.
  return tlpIndex(source) <= tlpIndex(destination);
}

/**
 * Returns the more restrictive of two TLP levels.
 * Used when merging markings from multiple sources (e.g. an IOC inside a
 * TLP:AMBER investigation must inherit at least TLP:AMBER).
 */
export function tlpMerge(a: TLPLevel, b: TLPLevel): TLPLevel {
  return tlpIndex(a) >= tlpIndex(b) ? a : b;
}

/**
 * Returns a short human-readable share constraint for display in toasts and
 * confirmation dialogs.
 */
export function tlpShareDescription(level: TLPLevel): string {
  switch (level) {
    case 'TLP:CLEAR':
      return 'Unrestricted — may be shared publicly.';
    case 'TLP:GREEN':
      return 'Community only — do not release publicly.';
    case 'TLP:AMBER':
      return 'Limited sharing — recipients and their organizations only. Export requires confirmation.';
    case 'TLP:AMBER+STRICT':
      return 'Strict — named recipients only. Export is blocked.';
    case 'TLP:RED':
      return 'Not shareable — present recipients only. Export is blocked.';
  }
}

/**
 * Returns the TLP level badge color (hex) for use in inline style attributes.
 */
export function tlpColor(level: TLPLevel): string {
  switch (level) {
    case 'TLP:CLEAR':        return '#ffffff';
    case 'TLP:GREEN':        return '#22c55e';
    case 'TLP:AMBER':        return '#f59e0b';
    case 'TLP:AMBER+STRICT': return '#f59e0b';
    case 'TLP:RED':          return '#ef4444';
  }
}

/**
 * Coerces an arbitrary clsLevel string to a TLPLevel if it matches, or
 * returns undefined for non-TLP / custom classification levels.
 */
export function asTLPLevel(level: string | undefined): TLPLevel | undefined {
  if (!level) return undefined;
  return TLP_ORDER.includes(level as TLPLevel) ? (level as TLPLevel) : undefined;
}
