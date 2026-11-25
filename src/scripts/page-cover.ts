// The pixel cover used for the first-visit intro and for moving between pages.
// The inline script in BaseLayout decides, before first paint, whether a page arrives covered
// (html.px-covered paints a flat night-colour layer via CSS); this module dissolves that layer
// and plays the cover when leaving through an internal link.
import { HEAT_PALETTE } from './pixel-math';
import { cellDelays, cellProgress, coverLevel, radialDelays } from './pixel-wipe';
import { prefersReducedMotion } from './motion';

const COVER_MS = 420;
const REVEAL_MS = { intro: 900, arrive: 560 };
export const ARRIVE_KEY = 'px-arrive';

const cellSize = () => (window.innerWidth < 700 ? 16 : 24);

function makeCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:101;pointer-events:none';
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  document.body.appendChild(canvas);
  const size = cellSize();
  return { canvas, ctx, size, columns: Math.ceil(window.innerWidth / size), rows: Math.ceil(window.innerHeight / size) };
}

/**
 * Plays one wipe. `covering` true: cells land hot from the delays' start and cool to night.
 * false: cells heat back up and vanish. Resolves when every cell is done.
 */
function play(delays: (columns: number, rows: number) => Float32Array, duration: number, covering: boolean, keep: boolean): Promise<void> {
  return new Promise((resolve) => {
    const { canvas, ctx, size, columns, rows } = makeCanvas();
    const order = delays(columns, rows);
    let start = 0;
    const frame = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / duration);
      ctx.clearRect(0, 0, columns * size, rows * size);
      for (let i = 0; i < columns * rows; i++) {
        const p = cellProgress(t, order[i]);
        const shown = covering ? p : 1 - p; // how much of the cell is there
        if (shown <= 0.01) continue;
        const inset = ((1 - shown) * size) / 2;
        ctx.fillStyle = HEAT_PALETTE[coverLevel(covering ? p : 1 - p)];
        ctx.fillRect((i % columns) * size + inset, Math.floor(i / columns) * size + inset, size - inset * 2 - 1, size - inset * 2 - 1);
      }
      if (t < 1) requestAnimationFrame(frame);
      else {
        if (!keep) canvas.remove();
        resolve();
      }
    };
    requestAnimationFrame(frame);
  });
}

/** Dissolves the arrival cover, if the page arrived covered. */
export function reveal(): void {
  const root = document.documentElement;
  if (!root.classList.contains('px-covered')) return;
  const intro = root.dataset.cover === 'intro';
  // The canvas starts fully drawn in night, so removing the CSS layer underneath shows nothing.
  const done = play((c, r) => cellDelays(c, r, intro ? 'bottom' : 'top'), intro ? REVEAL_MS.intro : REVEAL_MS.arrive, false, false);
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('px-covered')));
  void done;
}

/** Covers the screen from (x, y), then resolves; the cover stays up until the page unloads. */
export function coverFrom(x: number, y: number): Promise<void> {
  return play((c, r) => radialDelays(c, r, x / cellSize(), y / cellSize()), COVER_MS, true, true);
}

/** Internal links to another page play the cover before navigating; the next page arrives covered. */
export function interceptLinks(): void {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = (e.target as Element | null)?.closest?.('a');
    if (!link || link.target || link.hasAttribute('download') || prefersReducedMotion()) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname) return;
    e.preventDefault();
    try {
      sessionStorage.setItem(ARRIVE_KEY, '1');
    } catch {
      /* storage blocked: the next page simply arrives uncovered */
    }
    void coverFrom(e.clientX || window.innerWidth / 2, e.clientY || window.innerHeight / 2).then(() => location.assign(url.href));
  });
  // Coming back through the back/forward cache restores the covered page: clear it.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    document.querySelectorAll('canvas[style*="z-index:101"]').forEach((c) => c.remove());
    document.documentElement.classList.remove('px-covered');
  });
}
