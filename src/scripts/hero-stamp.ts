import type { HeroField } from './hero-field';
import { blobGeometry, blobValue, shortestTurn } from './blob-shape';
import { fieldRingHeat, fieldRingRadius } from './cursor-math';
import { frameScale, smoothVelocity } from './timing';
import { hash } from './pixel-math';

/** blob radius in field cells: the pointer stamps heat as a soft disc this big while it is inside the hero */
const STAMP_RADIUS = 5;
/** the stamp stays fairly rigid: it stretches a little at speed and turns in 45° steps */
const STRETCH_SPEED = 32;
const MAX_STRETCH = 0.5;
const TURN_STEP = Math.PI / 4;

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

export interface HeroStamper {
  /** the pointer moved to (x, y) at `time` ms; stamps heat along the way if it is inside a field */
  move(x: number, y: number, time: number): void;
  /** the pointer left the page: forget the last position so re-entry does not draw a line across */
  reset(): void;
}

/**
 * The pointer's only mark on the page: while it is inside a hero field it stamps heat there, as a blob that
 * stretches and turns with the pointer's speed and heading. Outside the field it leaves nothing behind.
 */
export function createHeroStamper(fields: HeroField[]): HeroStamper {
  let hasLast = false,
    lastX = 0,
    lastY = 0,
    lastTime = 0;
  let smoothDx = 0,
    smoothDy = 0,
    speed = 0,
    heading = 0;
  return {
    reset() {
      hasLast = false;
      speed = smoothDx = smoothDy = 0;
    },
    move(x, y, time) {
      const picked = pickField(fields, y);
      const prevX = hasLast ? lastX : x,
        prevY = hasLast ? lastY : y;
      const scale = hasLast ? frameScale(time - lastTime) : 1;
      hasLast = true;
      lastX = x;
      lastY = y;
      lastTime = time;
      if (!picked || !inside(picked.rect, x, y)) {
        speed = 0;
        return;
      }
      const { field: hero, rect } = picked;
      const field = hero.field();
      const dx = x - prevX,
        dy = y - prevY;
      const perFrame = scale > 0 ? 1 / scale : 0;
      const smooth = smoothVelocity({ x: smoothDx, y: smoothDy }, { x: dx * perFrame, y: dy * perFrame }, 0.18, scale);
      smoothDx = smooth.x;
      smoothDy = smooth.y;
      const smoothSpeed = Math.hypot(smoothDx, smoothDy);
      speed += (smoothSpeed - speed) * 0.4;
      if (smoothSpeed > 0.6) heading += shortestTurn(heading, Math.atan2(smoothDy, smoothDx)) * 0.3;
      const stretch = Math.min(speed / STRETCH_SPEED, 1) * MAX_STRETCH;
      const facing = Math.round(heading / TURN_STEP) * TURN_STEP;
      const shaped = blobGeometry(STAMP_RADIUS, stretch);
      const reach = Math.ceil(shaped.longRadius + shaped.shift) + 1;
      const flicker = Math.floor(time / 80);
      // sample every half cell so a fast flick leaves an unbroken stroke
      const steps = Math.max(1, Math.min(32, Math.ceil(Math.hypot(dx, dy) / (field.cellSize * 0.5))));
      for (let step = 1; step <= steps; step++) {
        const column = (prevX + (dx * step) / steps - rect.left) / field.cellSize;
        const pointY = prevY + (dy * step) / steps;
        // the footer's field is flipped: its rows count up from the bottom
        const row = (hero.flipped ? rect.bottom - pointY : pointY - rect.top) / field.cellSize;
        for (let r = Math.max(0, Math.floor(row - reach)); r < Math.min(field.rows, row + reach); r++) {
          for (let c = Math.max(0, Math.floor(column - reach)); c < Math.min(field.columns, column + reach); c++) {
            const value = blobValue(c + 0.5 - column, (r + 0.5 - row) * (hero.flipped ? -1 : 1), facing, shaped);
            if (value === null) continue;
            const index = r * field.columns + c;
            const jitter = (hash(c, r, flicker) * 2 - 1) * 0.06;
            field.heat[index] = Math.max(field.heat[index], 0.3 + value * 0.75 + jitter);
          }
        }
      }
      hero.markDirty();
    },
  };
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
  const stamp = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const field = hero.field();
    const column = (x - rect.left) / field.cellSize;
    const row = (hero.flipped ? rect.bottom - y : y - rect.top) / field.cellSize;
    const radius = fieldRingRadius(strong, charge, impact, t);
    const reach = Math.ceil(radius + 2);
    for (let r = Math.max(0, Math.floor(row - reach)); r < Math.min(field.rows, row + reach); r++) {
      for (let c = Math.max(0, Math.floor(column - reach)); c < Math.min(field.columns, column + reach); c++) {
        const heat = fieldRingHeat(Math.hypot(c + 0.5 - column, r + 0.5 - row), radius, strong, t);
        if (heat === 0) continue;
        const index = r * field.columns + c;
        field.heat[index] = Math.max(field.heat[index], heat);
      }
    }
    hero.markDirty();
    if (t < 1) requestAnimationFrame(stamp);
  };
  requestAnimationFrame(stamp);
}
