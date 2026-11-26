import { HEAT_PALETTE, hash } from './pixel-math';
import { prefersReducedMotion } from './motion';

const FLY_MS = 700;
const SPREAD_PX = 70;
const ICON_STAGGER_MS = 45;
const PIXEL_STAGGER_MS = 380;

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * When a Skills row scrolls into view, every lit pixel of its icons flies in on one canvas,
 * cooling through the heat palette to ink, then the static SVGs take over.
 * Rows are only hidden once JS runs, so without JS or with reduced motion the icons just show.
 * `onReady` fires when a row's icons have landed.
 */
export function mountSkillEntrance(rows: Iterable<HTMLElement>, onReady?: (row: HTMLElement) => void): void {
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        play(e.target as HTMLElement, onReady);
      }
    },
    { threshold: 0.3 },
  );
  for (const row of rows) {
    row.classList.add('skill-wait');
    io.observe(row);
  }
}

function play(row: HTMLElement, onReady?: (row: HTMLElement) => void) {
  const canvas = row.querySelector<HTMLCanvasElement>('[data-skill-canvas]');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) {
    row.classList.remove('skill-wait');
    return onReady?.(row);
  }
  const box = canvas.getBoundingClientRect();
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(box.width * dpr);
  canvas.height = Math.round(box.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const ink = getComputedStyle(row).getPropertyValue('--color-ink').trim() || '#111';

  const xs: number[] = [],
    ys: number[] = [],
    sizes: number[] = [],
    dx: number[] = [],
    dy: number[] = [],
    delay: number[] = [];
  row.querySelectorAll<SVGSVGElement>('svg[data-bits]').forEach((svg, t) => {
    const r = svg.getBoundingClientRect();
    const hex = svg.dataset.bits!;
    const grid = Math.sqrt(hex.length * 4);
    const cell = r.width / grid;
    for (let h = 0; h < hex.length; h++) {
      const v = parseInt(hex[h], 16);
      for (let b = 0; b < 4; b++) {
        if (!(v & (8 >> b))) continue;
        const i = h * 4 + b;
        xs.push(r.left - box.left + (i % grid) * cell);
        ys.push(r.top - box.top + Math.floor(i / grid) * cell);
        sizes.push(cell + 0.5);
        dx.push((hash(t, i, 1) - 0.5) * SPREAD_PX);
        dy.push((hash(i, t, 2) - 0.5) * SPREAD_PX);
        delay.push(t * ICON_STAGGER_MS + hash(t + i, 3, 3) * PIXEL_STAGGER_MS);
      }
    }
  });
  const end = Math.max(0, ...delay) + FLY_MS;
  const heat = HEAT_PALETTE.slice(-5).reverse();
  const start = performance.now();
  const frame = (now: number) => {
    const elapsed = now - start;
    ctx.clearRect(0, 0, box.width, box.height);
    for (let k = 0; k < xs.length; k++) {
      const t = Math.min(1, Math.max(0, (elapsed - delay[k]) / FLY_MS));
      if (t === 0) continue;
      const e = easeOut(t);
      ctx.fillStyle = t >= 1 ? ink : heat[Math.min(heat.length - 1, Math.floor(t * heat.length))];
      ctx.globalAlpha = Math.min(1, t * 3);
      ctx.fillRect(xs[k] + dx[k] * (1 - e), ys[k] + dy[k] * (1 - e), sizes[k], sizes[k]);
    }
    if (elapsed < end) return void requestAnimationFrame(frame);
    row.classList.remove('skill-wait');
    ctx.clearRect(0, 0, box.width, box.height);
    onReady?.(row);
  };
  requestAnimationFrame(frame);
}
