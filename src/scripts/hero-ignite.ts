// Hero ignite: the boot that follows the intro cover. The whole width starts falling at once, unevenly like something
// thick, with the hot rim leading and the cooler layers opening up behind it; the drips grow in as each column lands.
// It is drawn on its own overlay canvas from a scratch copy of the field stepped with the same shape, so its last frame
// equals the resting field and the overlay can be removed in the very paint where the real field (emptied meanwhile)
// comes back.
import { HEAT_PALETTE, noise, stepField, strataLevel, type Field, type FieldShape } from './pixel-math';
import type { HeroField } from './hero-field';
import { paintCell } from './field-paint';

/** the whole ignite, from the cover's end to the hand-off to the real field */
export const IGNITE_MS = 1900;
/** one column's fall */
const FALL_MS = 1250;
/** the last stretch always shows the resting field itself */
const REST_MS = 80;
/** the drips grow in this long after their column starts, over GROW_MS */
const LANDED_MS = 1100;
const GROW_MS = 300;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** ms before column x starts to fall: broad, uneven lobes, so some parts run a little ahead of others */
export function pourDelay(x: number): number {
  return 200 * noise(x * 0.07, 2) + 50 * noise(x * 0.23, 7);
}

/** rows column x has poured at `t` ms, of the `edge` rows its surface stands at: gathering speed, then easing in */
export function pourFront(x: number, t: number, edge: number): number {
  const p = t > IGNITE_MS - REST_MS ? 1 : clamp01((t - pourDelay(x)) / FALL_MS);
  return edge * p * p * (3 - 2 * p);
}

/** the least a cell `inward` rows behind the falling front shows: the resting rim's yellow, orange and red */
export const rimLevel = (inward: number) => (inward < 2.2 ? 5 : inward < 4.8 ? 4 : inward < 8 ? 3 : 0);

/** one frame of the pour; `t` is ms since the ignite started (negative while the cover is still lifting) */
function pour(ctx: CanvasRenderingContext2D, f: Field, t: number) {
  const { columns, rows, cellSize, bucket, alpha, surface } = f;
  if (t < 0) return;
  const cell = (x: number, y: number, level: number, opacity: number) => {
    ctx.fillStyle = HEAT_PALETTE[level];
    paintCell(ctx, x * cellSize, y * cellSize, cellSize, opacity);
  };
  const over = t > IGNITE_MS - REST_MS;
  for (let x = 0; x < columns; x++) {
    const edge = surface[x];
    const front = pourFront(x, t, edge);
    if (front <= 0) continue;
    const landed = over || front >= edge;
    for (let y = 0; y < (landed ? edge : front); y++) {
      const i = y * columns + x;
      if (landed) {
        if (bucket[i] >= 0) cell(x, y, bucket[i], alpha[i]);
        continue;
      }
      // the hot rim travels on the leading edge, blended in the same pattern as the layers
      const inward = front - y;
      const level = Math.max(strataLevel(x, y, front), rimLevel(inward + ((x + y) & 1 ? 0.7 : -0.7)));
      cell(x, y, level, Math.min(1, 0.35 + inward * 0.28));
    }
    const grown = over ? 1 : clamp01((t - pourDelay(x) - LANDED_MS) / GROW_MS);
    if (!grown) continue;
    for (let y = Math.max(0, Math.ceil(edge)); y < rows; y++) {
      const i = y * columns + x;
      if (bucket[i] >= 0) cell(x, y, bucket[i], alpha[i] * grown);
    }
  }
  ctx.globalAlpha = 1;
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
          alpha: new Float32Array(real.alpha.length),
          surface: new Float32Array(real.columns),
        };
      stepField(scratch, hero.time(), seed, 0.94, base);
      const c = hero.canvas;
      if (overlay.width !== c.width || overlay.height !== c.height) {
        overlay.width = c.width;
        overlay.height = c.height;
      }
      if (!ctx) return;
      const dpr = c.width / scratch.width;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, scratch.columns * scratch.cellSize, scratch.rows * scratch.cellSize);
      pour(ctx, scratch, t);
    },
    end() {
      overlay?.remove();
      overlay = null;
      ctx = null;
      scratch = null;
    },
  };
}
