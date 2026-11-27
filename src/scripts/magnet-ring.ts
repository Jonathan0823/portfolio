import { HEAT_PALETTE, hash } from './pixel-math';
import { levelForValue } from './blob-shape';
import { MAGNET_ZONE, idleRing, ringValue, stepRing, type RingShape } from './cursor-ring';
import { frameScale } from './timing';

const MAX_CELL = 10;
const CANVAS_SIZE = 400;
const CANVAS_CELLS = CANVAS_SIZE / MAX_CELL;

const visibleMagnets = () =>
  [...document.querySelectorAll<HTMLElement>('[data-cursor-magnet]')].filter((el) => el.offsetParent !== null);

/** The nearest [data-cursor-magnet] whose edge is within MAGNET_ZONE of the pointer. */
function nearestMagnet(x: number, y: number): { el: HTMLElement; rect: DOMRect } | null {
  let best: { el: HTMLElement; rect: DOMRect } | null = null,
    bestD = Infinity;
  for (const el of visibleMagnets()) {
    const rect = (el.querySelector('svg') ?? el).getBoundingClientRect();
    if (rect.bottom < y - 200 || rect.top > y + 200) continue;
    const d = Math.hypot(rect.left + rect.width / 2 - x, rect.top + rect.height / 2 - y);
    if (d - rect.width / 2 >= MAGNET_ZONE || d >= bestD) continue;
    best = { el, rect };
    bestD = d;
  }
  return best;
}

export interface MagnetRing {
  /** the pointer is at (x, y); `engaged` is false when it is outside the page or over something with its own cursor shape */
  update(x: number, y: number, engaged: boolean): void;
  destroy(): void;
}

/**
 * Near a logo the pointer is joined by a pixel ring drawn behind it, and the logo colours in. The pointer itself is
 * not pulled: the ring grows from the pointer, settles round the logo and folds back when the pointer leaves.
 * It lives on its own canvas behind the content, so text and logos stay readable above it.
 */
export function mountMagnetRing(): MagnetRing {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = `position:fixed;left:0;top:0;width:${CANVAS_SIZE}px;height:${CANVAS_SIZE}px;pointer-events:none;z-index:-1`;
  canvas.width = CANVAS_SIZE * dpr;
  canvas.height = CANVAS_SIZE * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  document.body.insertBefore(canvas, document.body.firstChild);

  const ring = idleRing();
  let magnet: HTMLElement | null = null;
  let px = 0,
    py = 0,
    engaged = false;
  let clock = 0,
    last = 0,
    raf = 0;

  const setMagnet = (next: HTMLElement | null) => {
    if (next === magnet) return;
    magnet?.removeAttribute('data-magnet-on');
    next?.setAttribute('data-magnet-on', '');
    magnet = next;
  };

  const frame = (now: number) => {
    raf = 0;
    if (document.hidden) return;
    const scale = last ? frameScale(now - last) : 1;
    last = now;
    const near = engaged ? nearestMagnet(px, py) : null;
    setMagnet(near?.el ?? null);
    clock += 0.12 * scale;
    const cell = window.innerWidth < 700 ? 8 : MAX_CELL;
    // the ring draws at half-cell resolution so it reads round
    const sub = cell / 2;
    let goal: RingShape | null = null;
    if (near) {
      const r = near.rect;
      const breathe = (Math.sin(clock * 0.55) + 1) / 2;
      const cx = r.left + r.width / 2,
        cy = r.top + r.height / 2;
      const lean = (v: number) => Math.max(-1, Math.min(1, v / (r.width * 0.45)));
      const outer = (r.width / 2 / sub) * 1.12 + 1.4 + breathe * 1.6;
      goal = {
        x: cx / sub + lean(px - cx) * 1.6,
        y: cy / sub + lean(py - cy) * 1.6,
        outer,
        inner: outer - 1.2,
        gap: 0.32,
      };
    }
    // with no goal the ring folds back into a point at the pointer, so the hand-off back to nothing is invisible
    stepRing(ring, goal, { x: px / sub, y: py / sub, radius: 0.5 }, scale);
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    if (ring.active) {
      // the canvas follows the ring, snapped to whole cells so the pixels stay on one grid
      const originX = Math.floor((ring.x * sub) / cell) - CANVAS_CELLS / 2,
        originY = Math.floor((ring.y * sub) / cell) - CANVAS_CELLS / 2;
      canvas.style.transform = `translate(${originX * cell}px,${originY * cell}px)`;
      ctx.globalAlpha = ring.mix;
      const pulse = (clock * 0.35) % (Math.PI * 2);
      const flicker = Math.floor(clock * 2);
      const reach = Math.ceil(ring.outer + 1);
      for (let y = Math.floor(ring.y - reach); y <= ring.y + reach; y++) {
        for (let x = Math.floor(ring.x - reach); x <= ring.x + reach; x++) {
          const value = ringValue(ring, x + 0.5 - ring.x, y + 0.5 - ring.y, pulse);
          if (value === null) continue;
          ctx.fillStyle = HEAT_PALETTE[levelForValue(value, hash(x >> 1, y >> 1, flicker) * 2 - 1)];
          ctx.fillRect(x * sub - originX * cell, y * sub - originY * cell, sub, sub);
        }
      }
      ctx.globalAlpha = 1;
    }
    if (near || ring.active) raf = requestAnimationFrame(frame);
    else last = 0;
  };
  const wake = () => {
    if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
  };

  return {
    update(x, y, isEngaged) {
      px = x;
      py = y;
      engaged = isEngaged;
      wake();
    },
    destroy() {
      cancelAnimationFrame(raf);
      setMagnet(null);
      canvas.remove();
    },
  };
}
