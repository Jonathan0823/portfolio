// The part of a click's field blast that reaches past the field's canvas, which would otherwise be sliced flat there.
// A short-lived layer behind the content carries on the same cells. It covers only what is on screen and in reach,
// draws only cells the field cannot, and is gone once they have cooled; a blast that stays inside creates nothing.
import { HEAT_PALETTE, heatFade, heatTone } from './pixel-math';
import { paintCell } from './field-paint';
import { gridLayer } from './grid-layer';
import { decayFactor } from './timing';
import type { HeroField } from './hero-field';

/** the field's own decay per STEP_MS, so both halves of the blast cool together */
const HEAT_DECAY = 0.965;
const STEP_MS = 50;
/** repaint at about 20fps, the field's own step: plenty for a fading ring */
const PAINT_MS = 48;
/** a strip the ring has not lit by now never will be: its life is under 600ms */
const UNLIT_MS = 1000;

export interface SpillBox {
  c0: number;
  c1: number;
  r0: number;
  r1: number;
}

/**
 * The strips of cells a blast of `reach` cells around (column, row) can touch that the field canvas (rows 0 up to
 * `canvasRows`) cannot show: one under row 0 and one past the canvas, within the field's columns and the rows on
 * screen. Empty when the blast needs no help.
 */
export function spillStrips(
  column: number,
  row: number,
  reach: number,
  columns: number,
  canvasRows: number,
  screen: { from: number; to: number },
): SpillBox[] {
  const c0 = Math.max(0, Math.floor(column - reach)),
    c1 = Math.min(columns, Math.ceil(column + reach)),
    r0 = Math.max(screen.from, Math.floor(row - reach)),
    r1 = Math.min(screen.to, Math.ceil(row + reach));
  return [
    { c0, c1, r0, r1: Math.min(r1, 0) },
    { c0, c1, r0: Math.max(r0, canvasRows), r1 },
  ].filter((box) => box.c0 < box.c1 && box.r0 < box.r1);
}

export interface Spill {
  /** the rows the strips span, for the caller's loop */
  r0: number;
  r1: number;
  /** holds heat in a cell; ignored unless one of the strips has it */
  add(column: number, row: number, heat: number): void;
}

/** one strip's canvas: it paints itself until its cells have cooled, then goes */
function createStrip(hero: HeroField, box: SpillBox): (column: number, row: number, heat: number) => void {
  const field = hero.field();
  const rect = hero.rect();
  const cell = field.cellSize;
  const { c0, c1, r0, r1 } = box;
  const width = c1 - c0,
    height = r1 - r0;
  const heat = new Float32Array(width * height);
  const level = new Int8Array(width * height);

  // one canvas pixel per CSS pixel: flat squares need no retina sharpness
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('data-px', 'spill');
  canvas.width = width * cell;
  const top = hero.flipped ? rect.bottom - r1 * cell : rect.top + r0 * cell;
  const pageTop = top + window.scrollY;
  // never past the end of the page, which would make it scroll further
  const tall = Math.min(height * cell, document.documentElement.scrollHeight - pageTop);
  canvas.height = tall;
  canvas.style.cssText = `position:absolute;left:${rect.left + window.scrollX + c0 * cell}px;top:${pageTop}px;width:${width * cell}px;height:${tall}px;pointer-events:none;image-rendering:pixelated;z-index:-1`;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  const grid = gridLayer(canvas);
  grid.fit(cell);

  const born = performance.now();
  let last = born,
    stamped = false;
  const paint = (now: number) => {
    if (now - last >= PAINT_MS) {
      const decay = decayFactor(HEAT_DECAY, (now - last) / STEP_MS);
      last = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let hottest = 0;
      for (let i = 0; i < heat.length; i++) {
        const h = (heat[i] *= decay);
        level[i] = h < 0.3 ? -1 : heatTone(h);
        // cells under 0.3 are no longer drawn, so only warmer ones keep the strip alive
        if (h >= 0.3) hottest = h;
      }
      // colour by colour: switching the fill style cell by cell is what a slow device would feel
      for (let k = 0; k < HEAT_PALETTE.length; k++) {
        ctx.fillStyle = HEAT_PALETTE[k];
        for (let i = 0; i < level.length; i++) {
          if (level[i] !== k) continue;
          const column = i % width,
            row = Math.floor(i / width);
          const y = (hero.flipped ? height - 1 - row : row) * cell;
          paintCell(ctx, column * cell, y, cell, heatFade(heat[i]));
        }
      }
      if (!hottest && (stamped || now - born > UNLIT_MS)) {
        grid.remove();
        return canvas.remove();
      }
    }
    requestAnimationFrame(paint);
  };
  requestAnimationFrame(paint);

  return (column, row, held) => {
    if (column < c0 || column >= c1 || row < r0 || row >= r1) return;
    const i = (row - r0) * width + (column - c0);
    heat[i] = Math.max(heat[i], held);
    stamped = true;
  };
}

export function createSpill(hero: HeroField, x: number, y: number, reach: number): Spill | null {
  const field = hero.field();
  const rect = hero.rect();
  const cell = field.cellSize;
  const canvasRows = Math.floor(hero.canvas.clientHeight / cell);
  const toRow = (py: number) => (hero.flipped ? rect.bottom - py : py - rect.top) / cell;
  const edges = [toRow(0), toRow(window.innerHeight)];
  const boxes = spillStrips((x - rect.left) / cell, toRow(y), reach, field.columns, canvasRows, {
    from: Math.floor(Math.min(...edges)),
    to: Math.ceil(Math.max(...edges)),
  });
  if (!boxes.length) return null;
  const strips = boxes.map((box) => createStrip(hero, box));
  return {
    r0: boxes[0].r0,
    r1: boxes[boxes.length - 1].r1,
    add: (column, row, heat) => strips.forEach((add) => add(column, row, heat)),
  };
}
