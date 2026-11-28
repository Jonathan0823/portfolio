import type { HeroField } from './hero-field';
import { fieldRingHeat, fieldRingRadius } from './cursor-math';
import { createSpill } from './blast-spill';

/** The field nearest to a page y that is on screen (or within 200px of it), with its rect. */
export function pickField(fields: HeroField[], y: number): { field: HeroField; rect: DOMRect } | null {
  let best: { field: HeroField; rect: DOMRect } | null = null,
    bestDistance = Infinity;
  for (const field of fields) {
    const rect = field.rect();
    if (!rect.width || rect.bottom < -200 || rect.top > window.innerHeight + 200) continue;
    const distance = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
    if (distance < bestDistance) {
      best = { field, rect };
      bestDistance = distance;
    }
  }
  return best;
}

const inside = (rect: DOMRect, x: number, y: number) =>
  x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

/** true when a viewport point is inside the rect of the field nearest to it */
export function pointInField(fields: HeroField[], x: number, y: number): boolean {
  const picked = pickField(fields, y);
  return !!picked && inside(picked.rect, x, y);
}

/**
 * A click inside a field sends a ring of heat out through it; the field's own decay fades it, so nothing is cleaned up.
 * `charge` and `impact` (the page-impact ramp) make it bigger.
 */
export function injectFieldRing(
  fields: HeroField[],
  x: number,
  y: number,
  strong: boolean,
  charge: number,
  impact: number,
): void {
  const picked = pickField(fields, y);
  if (!picked || !inside(picked.rect, x, y)) return;
  const { field: hero, rect } = picked;
  const duration = 380 + 200 * charge;
  const start = performance.now();
  // what the ring reaches past the field's canvas carries on in a layer of its own
  const spill = createSpill(hero, x, y, fieldRingRadius(strong, charge, impact, 1) + 2);
  const stamp = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const field = hero.field();
    const column = (x - rect.left) / field.cellSize;
    const row = (hero.flipped ? rect.bottom - y : y - rect.top) / field.cellSize;
    const radius = fieldRingRadius(strong, charge, impact, t);
    const reach = Math.ceil(radius + 2);
    const first = Math.max(Math.min(0, spill?.r0 ?? 0), Math.floor(row - reach)),
      last = Math.min(Math.max(field.rows, spill?.r1 ?? 0), row + reach);
    for (let r = first; r < last; r++) {
      for (let c = Math.max(0, Math.floor(column - reach)); c < Math.min(field.columns, column + reach); c++) {
        const heat = fieldRingHeat(Math.hypot(c + 0.5 - column, r + 0.5 - row), radius, strong, t);
        if (heat === 0) continue;
        spill?.add(c, r, heat);
        if (r < 0 || r >= field.rows) continue;
        const index = r * field.columns + c;
        field.heat[index] = Math.max(field.heat[index], heat);
      }
    }
    hero.markDirty();
    if (t < 1) requestAnimationFrame(stamp);
  };
  requestAnimationFrame(stamp);
}
