// Wave, under a charged blast: when the front crosses a surface, each column it reaches is shoved back into the lava,
// so the blast rolls along the surface. Pure: this plans the hits, the blast input (wave-blast.ts) applies them.
import { arrivalMs, farthestCorner, impactStrength, kickFalloff, type ShockwaveDetail } from './cursor-math';

/**
 * velocity (rows per step) a column takes from a full-charge front at its strongest. Tuned so a full charge a few
 * hundred px from a surface sheds hero drops and splashes the footer, and a charge of 0.6 does neither.
 */
export const BLAST_PUSH = 1.1;

export interface BlastSurface {
  /** viewport x of column 0's left edge, and px per column */
  left: number;
  cell: number;
  /** viewport y of the anchored edge (the hero's top, the flipped footer's bottom) */
  edge: number;
  flipped: boolean;
  /** surface rows per column, counted from the anchored edge */
  rows: ArrayLike<number>;
  columns: number;
}

export interface BlastHit {
  column: number;
  /** ms after the release the front reaches the column */
  atMs: number;
  /** rows per step shoved into the lava */
  push: number;
}

/**
 * The hits a blast makes on one surface, nearest the epicentre first. A column the front reaches off screen is left
 * out: the viewport is all the front crosses. Nothing below the impact threshold.
 */
export function planBlast(blast: ShockwaveDetail, surface: BlastSurface, width: number, height: number): BlastHit[] {
  const { ramp } = impactStrength(blast.charge);
  if (ramp <= 0) return [];
  const farthest = farthestCorner(blast.x, blast.y, width, height);
  const hits: BlastHit[] = [];
  for (let column = 0; column < surface.columns; column++) {
    const x = surface.left + (column + 0.5) * surface.cell;
    const y = surface.edge + (surface.flipped ? -1 : 1) * surface.rows[column] * surface.cell;
    if (x < 0 || x > width || y < 0 || y > height) continue;
    const distance = Math.hypot(x - blast.x, y - blast.y);
    hits.push({
      column,
      atMs: arrivalMs(distance, blast.speed),
      push: BLAST_PUSH * ramp * kickFalloff(distance, farthest),
    });
  }
  return hits.sort((a, b) => a.atMs - b.atMs);
}
