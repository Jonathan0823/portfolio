import type { FieldShape } from './pixel-math';

/** How far past a field's box (px) its canvas reaches, behind the content, for embers and cursor heat. */
export const FIELD_BLEED = 200;
/** Rows an ember falls before it has faded out. */
export const EMBER_REACH = 10;
export const MAX_EMBERS = 400;

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * The outline of a field. Its edge wanders as a skyline; the footer's edge also dithers
 * into the page. With motion, top fields drain as you scroll away and the footer rises into view.
 */
export function fieldShape(
  kind: string,
  box: { top: number; height: number },
  scrollY: number,
  viewportHeight: number,
  motion: boolean,
): FieldShape {
  if (kind === 'foot')
    return {
      skyline: 0.22,
      fadeEdge: 0.35,
      coverage: motion ? ease(clamp((viewportHeight - box.top) / box.height)) : 1,
    };
  return { skyline: 0.22, coverage: motion ? 1 - ease(clamp(scrollY / (box.height * 1.4))) * 0.85 : 1 };
}

export interface Ember {
  x: number;
  y: number;
  /** row it dropped from */
  y0: number;
  vx: number;
  vy: number;
  level: number;
  life: number;
}

/**
 * Chance per step that a column drops an ember: a rare drip at rest, more from hot (orange/yellow)
 * columns, a burst while scrolling, and sparks where the cursor has heated the column.
 */
export function emberRate(level: number, columnHeat: number, scrolledPx: number): number {
  const rest = (0.0012 + Math.min(1, scrolledPx / 60) * 0.03) * (level >= 3 ? 1.6 : 0.4);
  return rest + (columnHeat > 0.5 ? 0.06 * columnHeat : 0);
}

export function spawnEmber(x: number, row: number, level: number, random = Math.random): Ember {
  return {
    x,
    y: row,
    y0: row,
    vx: (random() - 0.5) * 0.12,
    vy: 0.1 + random() * 0.15,
    level: Math.max(3, level),
    life: 1,
  };
}

/** Opacity: fades with age and with distance fallen, so embers melt into the page near the field. */
export function emberAlpha(e: Ember): number {
  return e.life * Math.max(0, 1 - (e.y - e.y0) / EMBER_REACH);
}

/**
 * Move embers `steps` field steps. One about to land on content slides toward the nearer
 * free side and fades faster. Returns the embers still alive and inside the field.
 */
export function stepEmbers(
  embers: Ember[],
  steps: number,
  blocked: (x: number, y: number) => boolean,
  columns: number,
  rows: number,
): Ember[] {
  for (const e of embers) {
    if (blocked(e.x, e.y + 1)) {
      if (Math.abs(e.vx) < 0.2) {
        let left = 0,
          right = 0;
        while (blocked(e.x - left, e.y + 1) && left < 60) left++;
        while (blocked(e.x + right, e.y + 1) && right < 60) right++;
        e.vx = left < right ? -0.45 : 0.45;
      }
      e.x += e.vx * steps;
      e.life -= 0.02 * steps;
    } else {
      if (Math.abs(e.vx) > 0.2) e.vx *= 0.3;
      e.x += e.vx * steps;
      e.y += e.vy * steps;
      e.life -= 0.012 * steps;
    }
  }
  return embers.filter((e) => emberAlpha(e) > 0.04 && e.y < rows && e.x >= 0 && e.x < columns - 0.5).slice(-MAX_EMBERS);
}
