// Hero ignite: the boot that follows the intro cover. The field starts as a cold, dim skyline; a spark falls in,
// flashes where it lands, and heat floods outward with a ragged front, each cell cooling from white-hot to its
// resting colour. It is drawn on its own overlay canvas from a scratch copy of the field stepped with the same
// shape, so its last frame equals the resting field and the overlay can be removed in the very paint where the
// real field (emptied meanwhile) comes back.
import { HEAT_PALETTE, hash, noise, stepField, type Field, type FieldShape } from './pixel-math';
import type { HeroField } from './hero-field';

/** the whole ignite, from the cover's end to the hand-off to the real field */
export const IGNITE_MS = 1900;
/** the spark lands (and flashes) this long in */
const SPARK_MS = 380;
const FLASH_MS = 140;
const BLOB_MS = 260;
/** each cell cools from white-hot to its resting colour over this long after the front reaches it */
const COOL_MS = 520;
/** the first share of the cooling stays at white-hot yellow / orange */
const WHITE_SHARE = 0.2;
/** the front reaches its last cell this long before the end */
const TAIL_MS = 120;
/** field cells smaller than this are phone cells */
const COMPACT_CELL = 10;
/** compact heroes light up below the fixed header pills: roughly this many px from the top */
const HEADER_CLEAR_PX = 80;

/** overlay opacities: full, dim (cold field) and flash */
const ALPHAS = [1, 0.5, 0.75];
const COLD = 1;
const FLASHING = 2;
const LEVELS = HEAT_PALETTE.length;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (v: number) => 1 - (1 - v) ** 3;

/** from a hot level down to the resting one, in whole palette steps; `k` runs 0..1 */
export function coolLevel(from: number, to: number, k: number): number {
  return Math.round(from + (to - from) * easeOut(clamp01(k)));
}

/** where the spark lands: left of centre on a desktop, centred and below the header pills on a phone */
export function igniteOrigin(columns: number, horizonRow: number, cellSize: number): { x: number; y: number } {
  const compact = cellSize < COMPACT_CELL;
  const y = compact
    ? Math.min(
        Math.floor(horizonRow * 0.8),
        Math.max(Math.floor(horizonRow * 0.45), Math.ceil(HEADER_CLEAR_PX / cellSize)),
      )
    : Math.floor(horizonRow * 0.45);
  return { x: Math.floor(columns * (compact ? 0.5 : 0.3)), y };
}

/** when (ms since the ignite started) the front reaches a cell `distance` away, `maxDistance` being the farthest */
export function igniteArrival(distance: number, maxDistance: number): number {
  const spread = IGNITE_MS - SPARK_MS - COOL_MS - TAIL_MS;
  return SPARK_MS + spread * clamp01(distance / maxDistance) ** 0.9;
}

/** palette level of a cell `sinceArrival` ms after the front reached it; `coin` (0..1) picks yellow or orange at first */
export function igniteLevel(sinceArrival: number, resting: number, coin: number): number {
  const age = sinceArrival / COOL_MS;
  if (age < WHITE_SHARE) return coin > 0.5 ? 5 : 4;
  return coolLevel(5, resting, (age - WHITE_SHARE) / (1 - WHITE_SHARE));
}

interface Bins {
  /** cells to plot per [alpha][level], as x, y pairs */
  lists: number[][];
}
const bins: Bins = { lists: Array.from({ length: ALPHAS.length * LEVELS }, () => []) };
const plot = (x: number, y: number, level: number, alpha = 0) => bins.lists[alpha * LEVELS + level].push(x, y);

function flush(ctx: CanvasRenderingContext2D, f: Field) {
  const { columns, rows, cellSize } = f;
  for (let a = 0; a < ALPHAS.length; a++)
    for (let level = 0; level < LEVELS; level++) {
      const list = bins.lists[a * LEVELS + level];
      if (!list.length) continue;
      ctx.globalAlpha = ALPHAS[a];
      ctx.fillStyle = HEAT_PALETTE[level];
      for (let i = 0; i < list.length; i += 2) {
        const x = list[i],
          y = list[i + 1];
        if (x < 0 || y < 0 || x >= columns || y >= rows) continue;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
      list.length = 0;
    }
  ctx.globalAlpha = 1;
}

/** one frame of the ignite into the bins; `t` is ms since it started (negative while the cover is still lifting) */
function layOut(f: Field, t: number) {
  const { columns, rows, hostRows } = f;
  const { x: sx, y: sy } = igniteOrigin(columns, f.horizonRow, f.cellSize);
  const maxD = Math.hypot(Math.max(sx, columns - sx), Math.max(sy, hostRows * 0.75)) + 10;
  const flash = t >= SPARK_MS && t < SPARK_MS + FLASH_MS;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < columns; x++) {
      const resting = f.bucket[y * columns + x];
      if (resting < 0) continue;
      const d = Math.hypot(x - sx, y - sy) + (noise(x * 0.18, y * 0.18 + 3) - 0.5) * 16 + (hash(x, y, 9) - 0.5) * 5;
      const arrive = igniteArrival(d, maxD);
      // before the front arrives only the body of each column is drawn, cold
      const core = y <= f.lowestRow[x] * 0.55;
      if (t < arrive) {
        if (flash && core) plot(x, y, 3, FLASHING);
        else if (core) plot(x, y, 0, COLD);
        continue;
      }
      plot(x, y, igniteLevel(t - arrive, resting, hash(x, y, 4)));
    }
  if (t >= 0 && t < SPARK_MS) {
    // the spark falls in from the top edge
    const fy = Math.floor(sy * (t / SPARK_MS) ** 2);
    plot(sx, fy, 5);
    plot(sx, fy - 1, 4);
    plot(sx, fy - 2, 3);
  } else if (t >= SPARK_MS && t < SPARK_MS + BLOB_MS) {
    // a hot blob where it landed
    const r = Math.ceil(((t - SPARK_MS) / BLOB_MS) * 4) + 1;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) plot(sx + dx, sy + dy, 5);
  }
}

export interface Ignite {
  /** draws the frame at `t` ms since the ignite started (negative: the waiting state before the spark) */
  draw(hero: HeroField, base: FieldShape, t: number): void;
  end(): void;
}

/** an ignite for one field; `seed` must be the field's own so its last frame equals the resting field */
export function createIgnite(seed: number): Ignite {
  let overlay: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let scratch: Field | null = null;
  return {
    draw(hero, base, t) {
      const real = hero.field();
      if (!overlay) {
        overlay = document.createElement('canvas');
        overlay.setAttribute('aria-hidden', 'true');
        overlay.setAttribute('data-ignite', '');
        overlay.style.cssText = hero.canvas.style.cssText;
        hero.canvas.after(overlay);
        ctx = overlay.getContext('2d');
      }
      if (!scratch || scratch.columns !== real.columns || scratch.rows !== real.rows)
        scratch = {
          ...real,
          heat: new Float32Array(real.heat.length),
          bucket: new Int8Array(real.bucket.length),
          lowestRow: new Int16Array(real.columns),
          lowestBucket: new Int8Array(real.columns),
        };
      stepField(scratch, hero.time(), seed, 1, 0.94, base);
      const c = hero.canvas;
      if (overlay.width !== c.width || overlay.height !== c.height) {
        overlay.width = c.width;
        overlay.height = c.height;
      }
      if (!ctx) return;
      const dpr = c.width / scratch.width;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, scratch.columns * scratch.cellSize, scratch.rows * scratch.cellSize);
      layOut(scratch, t);
      flush(ctx, scratch);
    },
    end() {
      overlay?.remove();
      overlay = null;
      ctx = null;
      scratch = null;
    },
  };
}
