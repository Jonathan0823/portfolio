// The pointer's heat on the nav: the item nearest the pointer fills from the bottom, in the lava's own cells. It sloshes
// toward the side the pointer came from, and on the white bar (off the lava) it fills with ink instead, like the Contact button.
import { easeFactor, frameScale } from './timing';

/** how far from an item's box, in px, the pointer already holds it */
const ZONE = 10;
/** how far past an item's box the fill reaches */
const PAD = 3;
/** the canvas hangs this far below the nav so the fill is never cut */
const BLEED = 24;
/** the lava's purples: foam on the surface, the body, the deep layer; and the same three in ink */
const LAVA = ['#B8A9FF', '#7C5CFA', '#4338CA'];
const INK = ['#6B6B6B', '#2B2B2B', '#111111'];

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

/** The slosh a frame later. Taken in steps of one reference frame at most: one long step overshoots and grows. */
export function stepSlosh(position: number, velocity: number, scale: number): { position: number; velocity: number } {
  const steps = Math.ceil(scale);
  for (let i = 0; i < steps; i++) {
    const step = scale / steps;
    velocity += (-0.1 * position - 0.09 * velocity) * step;
    position += velocity * step;
  }
  return { position, velocity };
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
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = (k: number, scale: number) => (reduced ? 1 : easeFactor(k, scale));
  const nav = host.closest('nav');

  let target: HTMLElement | null = null,
    raf = 0,
    last = 0;
  /** per item: how full it is, and the slosh of its surface (position and velocity) */
  const fill = items.map(() => 0),
    slosh = items.map(() => 0),
    vel = items.map(() => 0),
    worded = new Set<HTMLElement>();

  /** the word turns white once the fill is behind it, and back as the fill drains */
  const setWord = (el: HTMLElement, on: boolean) => {
    if (on) {
      el.setAttribute('data-held', '');
      worded.add(el);
    } else {
      el.removeAttribute('data-held');
      worded.delete(el);
    }
  };

  const draw = (now: number) => {
    raf = 0;
    const scale = last ? frameScale(now - last) : 1;
    last = now;
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
    // the same cells the field is drawn in
    const size = window.innerWidth < 700 ? 8 : 10;
    const [foam, body, deep] = nav?.hasAttribute('data-on-field') ? LAVA : INK;
    const t = reduced ? 0 : now;

    let busy = !!target;
    items.forEach((el, i) => {
      const goal = el === target ? 1 : 0;
      fill[i] += (goal - fill[i]) * ease(goal ? 0.16 : 0.12, scale);
      if (Math.abs(goal - fill[i]) < 0.004) fill[i] = goal;
      if (reduced) slosh[i] = vel[i] = 0;
      ({ position: slosh[i], velocity: vel[i] } = stepSlosh(slosh[i], vel[i], scale));
      if (Math.abs(slosh[i]) < 0.01 && Math.abs(vel[i]) < 0.01) slosh[i] = vel[i] = 0;
      if (fill[i] > 0 || slosh[i]) busy = true;
      const isWorded = worded.has(el);
      if (!isWorded && goal && fill[i] > 0.4) setWord(el, true);
      else if (isWorded && fill[i] < 0.3) setWord(el, false);
      if (fill[i] <= 0) return;

      const r = el.getBoundingClientRect();
      const left = r.left - PAD,
        right = r.right + PAD,
        top = r.top - PAD,
        bottom = r.bottom + PAD;
      const surfaceBase = bottom - (bottom - top) * fill[i];
      ctx.globalAlpha = Math.min(1, fill[i] * 3);
      for (let c = Math.floor(left / size); c * size < right; c++) {
        const x = (c + 0.5) * size;
        if (x < left || x > right) continue;
        const along = (x - (left + right) / 2) / ((right - left) / 2);
        // the surface tilts with the slosh and ripples slowly
        const lift =
          slosh[i] * along * size * 1.5 + Math.sin(x * 0.3 - t / 190) * size * 0.28 * Math.min(1, fill[i] * 3);
        const surface = surfaceBase - lift;
        for (let row = Math.floor(Math.max(surface, top) / size); row * size < bottom; row++) {
          const y = (row + 0.5) * size;
          if (y < surface || y < top || y > bottom) continue;
          const depth = (y - surface) / size;
          ctx.fillStyle = depth < 1 ? foam : depth < 2.4 ? body : deep;
          ctx.fillRect(c * size - origin.left, row * size - origin.top, size, size);
        }
      }
    });
    ctx.globalAlpha = 1;
    if (busy && !reduced) raf = requestAnimationFrame(draw);
    else last = 0;
  };

  return {
    update(x, y, engaged) {
      const shown = engaged ? items.filter((el) => el.offsetParent !== null) : [];
      const next =
        shown[
          nearestBox(
            x,
            y,
            shown.map((el) => el.getBoundingClientRect()),
          )
        ] ?? null;
      const changed = next !== target;
      if (changed) {
        target = next;
        // the surface sloshes toward the side the pointer came from
        if (next) {
          const r = next.getBoundingClientRect();
          vel[items.indexOf(next)] += (x < r.left + r.width / 2 ? -1 : 1) * 0.42;
        }
      }
      const idle = fill.every((f) => f === 0) && !slosh.some(Boolean);
      // reduced motion draws once per change, not every frame
      if (!raf && (target || !idle) && (!reduced || changed)) raf = requestAnimationFrame(draw);
      return !!target;
    },
    destroy() {
      cancelAnimationFrame(raf);
      worded.forEach((el) => el.removeAttribute('data-held'));
      canvas.remove();
    },
  };
}
