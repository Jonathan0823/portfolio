import type { HeroField } from './hero-field';

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
