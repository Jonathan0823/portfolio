// The pointer's heat on the nav: near an item a blob of heat flows from the pointer onto the item and takes its
// shape. Between items its front edge runs ahead of the back, thinning in the middle; once landed it cools from yellow
// to red and its edge bubbles. Letting go, it breaks into cells and gathers back into the pointer.
import { HEAT_PALETTE, hash } from './pixel-math';
import { easeFactor, frameScale } from './timing';

/** how far from an item's box, in px, the heat already flows to it */
const ZONE = 24;
/** how far past an item's box the settled heat reaches */
const PAD = 5;
/** the radius of the loose blob at the pointer */
const BLOB = 30;
const SETTLED_CORNER = 8;
/** how long after landing the heat stays yellow, then orange, before it rests red */
const YELLOW_MS = 110;
const ORANGE_MS = 260;
/** the canvas hangs this far below the nav so the heat is never cut */
const BLEED = 24;

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function distanceToBox(x: number, y: number, b: Box): number {
  return Math.hypot(Math.max(b.left - x, 0, x - b.left - b.width), Math.max(b.top - y, 0, y - b.top - b.height));
}

/** The index of the box nearest the pointer within the zone, or -1. */
export function nearestBox(x: number, y: number, boxes: readonly Box[], zone = ZONE): number {
  let best = -1,
    bestDistance = zone;
  boxes.forEach((box, i) => {
    const d = distanceToBox(x, y, box);
    if (d < bestDistance) {
      best = i;
      bestDistance = d;
    }
  });
  return best;
}

export function roundedDistance(x: number, y: number, b: Box, radius: number): number {
  const r = Math.min(radius, b.width / 2, b.height / 2);
  const dx = Math.abs(x - b.left - b.width / 2) - (b.width / 2 - r),
    dy = Math.abs(y - b.top - b.height / 2) - (b.height / 2 - r);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
}

/** Eases a box toward its goal, the edge on the side it is heading for running ahead of the other. */
export function stretchToward(shape: Box, goal: Box, scale: number): void {
  const rightward = goal.left + goal.width / 2 > shape.left + shape.width / 2;
  const lead = easeFactor(0.5, scale),
    lag = easeFactor(0.16, scale),
    slow = easeFactor(0.28, scale);
  const left = shape.left + (goal.left - shape.left) * (rightward ? lag : lead);
  const right = shape.left + shape.width;
  shape.width = right + (goal.left + goal.width - right) * (rightward ? lead : lag) - left;
  shape.left = left;
  shape.top += (goal.top - shape.top) * slow;
  shape.height += (goal.height - shape.height) * slow;
}

export interface NavMagnet {
  /** the pointer is at (x, y); true while a nav item holds it */
  update(x: number, y: number, engaged: boolean): boolean;
  destroy(): void;
}

export function mountNavMagnet(): NavMagnet {
  const items = [...document.querySelectorAll<HTMLElement>('[data-nav-magnet]')];
  const host = items[0]?.parentElement?.closest<HTMLElement>('nav > div');
  if (!host) return { update: () => false, destroy() {} };
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  // above the bar's background, under the words
  canvas.style.cssText = `position:absolute;left:0;top:0;width:100%;height:calc(100% + ${BLEED}px);pointer-events:none;z-index:-10`;
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  let px = 0,
    py = 0,
    target: HTMLElement | null = null,
    worded: HTMLElement | null = null,
    /** the heat's shape in viewport px; null while there is none */
    shape: Box | null = null,
    corner = BLOB,
    mix = 0,
    landedAt = 0,
    raf = 0,
    last = 0;

  const loose = (): Box => ({ left: px - BLOB, top: py - BLOB, width: 2 * BLOB, height: 2 * BLOB });
  /** the item whose word is drawn white, once the heat is behind it */
  const word = (next: HTMLElement | null) => {
    if (next === worded) return;
    worded?.removeAttribute('data-held');
    next?.setAttribute('data-held', '');
    worded = next;
  };

  const draw = (now: number) => {
    raf = 0;
    const scale = last ? frameScale(now - last) : 1;
    last = now;
    shape ??= loose();
    const rect = target?.getBoundingClientRect();
    const goal: Box = rect
      ? { left: rect.left - PAD, top: rect.top - PAD, width: rect.width + 2 * PAD, height: rect.height + 2 * PAD }
      : loose();
    stretchToward(shape, goal, scale);
    corner += ((rect ? SETTLED_CORNER : BLOB) - corner) * easeFactor(0.28, scale);
    mix += ((rect ? 1 : 0) - mix) * easeFactor(0.2, scale);

    const origin = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(origin.width * dpr),
      height = Math.round(origin.height * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    // cleared in backing pixels: the CSS height is fractional, and clearing by it leaves the last row half painted
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!rect && mix < 0.03) {
      shape = null;
      mix = 0;
      last = 0;
      return;
    }

    const arrived = !!rect && Math.abs(shape.left + shape.width / 2 - goal.left - goal.width / 2) < goal.width / 4;
    if (arrived) {
      landedAt ||= now;
      word(target);
    }
    const age = landedAt ? now - landedAt : 0;
    const core = !landedAt || age < YELLOW_MS ? 5 : age < ORANGE_MS ? 4 : 3;
    const stretch = rect ? Math.min(1, Math.max(0, shape.width / goal.width - 1)) : 0;
    // the same cells the field is drawn in
    const size = window.innerWidth < 700 ? 8 : 10;
    const flicker = Math.floor(now / 140);
    const reach = size * 2;
    for (let r = Math.floor((shape.top - reach) / size); r * size < shape.top + shape.height + reach; r++) {
      for (let c = Math.floor((shape.left - reach) / size); c * size < shape.left + shape.width + reach; c++) {
        const x = (c + 0.5) * size,
          y = (r + 0.5) * size;
        // a thin neck while it is pulled out, and a slow bubbling edge
        const along = Math.min(1, Math.max(0, (x - shape.left) / shape.width));
        const d =
          roundedDistance(x, y, shape, corner) +
          stretch * Math.sin(along * Math.PI) * shape.height * 0.35 +
          Math.sin(x * 0.11 + now / 190) * Math.sin(y * 0.17 - now / 260) * size * 0.7 +
          (hash(c, r, flicker) - 0.5) * size;
        // leaving, the shape breaks into scattered cells
        if (d > size || hash(c, r) > mix * 1.15) continue;
        // the core under the word, then the blob's rim and a faint fringe
        ctx.fillStyle = HEAT_PALETTE[d < 0 ? core : Math.max(core, d < size / 2 ? 4 : 5)];
        ctx.globalAlpha = Math.min(1, mix * 1.4) * (d < size / 2 ? 1 : 0.55);
        ctx.fillRect(c * size - origin.left, r * size - origin.top, size, size);
      }
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(draw);
  };

  return {
    update(x, y, engaged) {
      px = x;
      py = y;
      const shown = engaged ? items.filter((el) => el.offsetParent !== null) : [];
      const index = nearestBox(
        x,
        y,
        shown.map((el) => el.getBoundingClientRect()),
      );
      const next = shown[index] ?? null;
      if (next !== target) {
        target = next;
        landedAt = 0;
        word(null);
      }
      if (!raf && (target || shape)) raf = requestAnimationFrame(draw);
      return !!target;
    },
    destroy() {
      cancelAnimationFrame(raf);
      word(null);
      canvas.remove();
    },
  };
}
