// Heat held in the hero field for a while: a hot spot that glows red or orange where lava gathers.
// Re-applied every paint (heat decays), so it stays lit until it expires, then fades out.
import type { Field } from './pixel-math';

interface Hold {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  level: number;
  from: number;
  until: number;
  /** ms before `until` over which the held heat fades out */
  fade: number;
}
const holds: Hold[] = [];
const FADE_MS = 250;

/** inclusive cell box; `level` is a heat 0..1 (about 0.66 reads red, 0.82 orange) */
export function holdHeat(hold: Omit<Hold, 'fade'> & { fade?: number }): void {
  holds.push({ fade: FADE_MS, ...hold });
}

/** the heat a hold gives at `now`: its level, fading over its last `fade` ms; 0 before it starts or after it ends */
export function heldLevel(hold: Pick<Hold, 'level' | 'from' | 'until' | 'fade'>, now: number): number {
  if (now < hold.from || now >= hold.until) return 0;
  return hold.level * Math.min(1, (hold.until - now) / hold.fade);
}

export function applyHolds(field: Field, now: number): void {
  const { columns, rows, heat } = field;
  for (let k = holds.length - 1; k >= 0; k--) {
    const hold = holds[k];
    if (now >= hold.until) {
      holds.splice(k, 1);
      continue;
    }
    const v = heldLevel(hold, now);
    if (!v) continue;
    for (let y = Math.max(0, hold.y0); y <= Math.min(rows - 1, hold.y1); y++)
      for (let x = Math.max(0, hold.x0); x <= Math.min(columns - 1, hold.x1); x++) {
        const i = y * columns + x;
        if (heat[i] < v) heat[i] = v;
      }
  }
}
