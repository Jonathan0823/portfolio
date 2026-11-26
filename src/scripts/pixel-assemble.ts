import { HEAT_PALETTE } from './pixel-math';
import { cellDelays, cellsPath, coverLevel, SPREAD, type Side } from './pixel-wipe';
import { createCells, flightProgress, NONE, retarget, type Cells } from './pixel-wave';

export { NONE };
const CELL = 14;

export function createAssembler(layers: HTMLElement[], canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  let cells: Cells | null = null;
  let columns = 0,
    rows = 0,
    width = 0,
    height = 0;
  let raf = 0;
  let done: (() => void) | undefined;

  const measure = () => {
    const w = layers[0].offsetWidth,
      h = layers[0].offsetHeight;
    if (cells && w === width && h === height) return;
    width = w;
    height = h;
    columns = Math.ceil(w / CELL);
    rows = Math.ceil(h / CELL);
    cells = createCells(columns * rows);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const draw = (now: number) => {
    const state = cells!;
    const masks = layers.map(() => new Uint8Array(columns * rows));
    let flying = false;
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < columns * rows; i++) {
      const p = flightProgress(state, i, now);
      if (p < 1) flying = true;
      if (p > 0 && p < 1) {
        ctx.fillStyle = HEAT_PALETTE[coverLevel((state.to[i] === NONE ? 1 - p : p) * 0.8)];
        ctx.fillRect((i % columns) * CELL, Math.floor(i / columns) * CELL, CELL + 0.5, CELL + 0.5);
        continue;
      }
      const layer = p >= 1 ? state.to[i] : state.from[i];
      if (layer !== NONE) masks[layer][i] = 1;
    }
    layers.forEach((el, k) => (el.style.clipPath = `path('${cellsPath(masks[k], columns, CELL)}')`));
    return flying;
  };

  const frame = () => {
    raf = 0;
    if (draw(performance.now())) {
      raf = requestAnimationFrame(frame);
      return;
    }
    const finished = done;
    done = undefined;
    finished?.();
  };

  return {
    show(layer: number, side: Side, duration: number, onDone?: () => void) {
      measure();
      const now = performance.now();
      const waits = cellDelays(columns, rows, side).map((d) => d * duration);
      retarget(cells!, layer, waits, now, (1 - SPREAD) * duration);
      done = onDone;
      cancelAnimationFrame(raf);
      draw(now);
      raf = requestAnimationFrame(frame);
    },
    reset() {
      cancelAnimationFrame(raf);
      raf = 0;
      done = undefined;
      cells = null;
      ctx.clearRect(0, 0, width, height);
      layers.forEach((el) => (el.style.clipPath = ''));
    },
  };
}
