/**
 * ATT&CK Navigator layer export — format v4.5 (Navigator ≥4.9).
 *
 * This module provides a standalone export function that works from any
 * technique list (e.g. standalone MITRE-ATT&CK IOCs, search results).
 * For timeline-event-based export use buildNavigatorLayer() in mitre-attack.ts.
 */

// --- Types -----------------------------------------------------------

export interface NavigatorLayer {
  name: string;
  versions: { attack: string; navigator: string; layer: string };
  domain: string; // "enterprise-attack"
  description: string;
  techniques: NavigatorTechnique[];
  gradient: { colors: string[]; minValue: number; maxValue: number };
  legendItems: { label: string; color: string }[];
}

export interface NavigatorTechnique {
  techniqueID: string;   // "T1059.001"
  tactic?: string;       // "execution"  (omit for parent techniques)
  color: string;
  comment: string;
  enabled: boolean;
  score: number;
  metadata: { name: string; value: string }[];
}

// --- Gradient helpers -------------------------------------------------

/** Map a 0-1 ratio to a hex color between #e8f5e9 (light) and #b71c1c (dark red). */
function scoreColor(score: number, maxScore: number): string {
  if (maxScore === 0 || score === 0) return '';
  // White → orange → red
  const ratio = Math.min(score / maxScore, 1);
  const r = 255;
  const g = Math.round(255 * (1 - ratio * 0.8));
  const b = Math.round(255 * (1 - ratio));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// --- Main export function ---------------------------------------------

/**
 * Build a Navigator-compatible layer JSON object from a flat technique list.
 *
 * Each entry in `techniques` represents one observed or attributed technique.
 * Duplicate techniqueIDs are deduplicated by picking the highest score and
 * concatenating comments.
 *
 * @param investigationName Used as the layer name and in the description.
 * @param techniques        Array of technique records (may contain duplicates).
 */
export function exportATTACKNavigatorLayer(
  investigationName: string,
  techniques: Array<{
    id: string;
    tactic?: string;
    comment?: string;
    score?: number;
  }>,
): NavigatorLayer {
  // Deduplicate: key = techniqueID + (tactic|'')
  const map = new Map<string, { score: number; comments: string[]; tactic?: string }>();

  for (const t of techniques) {
    const key = `${t.id}||${t.tactic ?? ''}`;
    const existing = map.get(key);
    const score = t.score ?? 1;
    if (existing) {
      existing.score = Math.max(existing.score, score);
      if (t.comment && !existing.comments.includes(t.comment)) {
        existing.comments.push(t.comment);
      }
    } else {
      map.set(key, {
        score,
        comments: t.comment ? [t.comment] : [],
        tactic: t.tactic,
      });
    }
  }

  const maxScore = Math.max(1, ...Array.from(map.values()).map((v) => v.score));

  const layerTechniques: NavigatorTechnique[] = Array.from(map.entries()).map(
    ([key, val]) => {
      const [techniqueID] = key.split('||');
      return {
        techniqueID,
        tactic: val.tactic,
        color: scoreColor(val.score, maxScore),
        comment: val.comments.join('; '),
        enabled: true,
        score: val.score,
        metadata: val.tactic ? [{ name: 'tactic', value: val.tactic }] : [],
      };
    },
  );

  return {
    name: investigationName,
    versions: { attack: '14', navigator: '4.9.5', layer: '4.5' },
    domain: 'enterprise-attack',
    description: `Exported from ThreatCaddy investigation: ${investigationName}`,
    techniques: layerTechniques,
    gradient: {
      colors: ['#ffffff', '#ff6666'],
      minValue: 0,
      maxValue: maxScore,
    },
    legendItems: [
      { label: 'Low frequency', color: '#ffdddd' },
      { label: 'High frequency', color: '#ff6666' },
    ],
  };
}
