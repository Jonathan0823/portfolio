// The hover card's frame: a ring of square pixel cells on its outer edge. Colour marches around it while the card is
// shown; the cells build in and scatter out with the card. The pure choices are the exported functions; the painter
// below runs one rAF loop, only while the frame is visible.
import { HEAT_PALETTE, hash } from './pixel-math';
import type { Side } from './pixel-wipe';

export const CELL = 4;
/** steps a second the colour travels */
export const STEPS_PER_SECOND = 12;
const SEGMENTS = 3;
const SEGMENT_LEN = 9;

/** the ring of a cols × rows box, clockwise from the top-left corner */
export function perimeterCells(cols: number, rows: number): [number, number][] {
  if (cols < 1 || rows < 1) return [];
  const out: [number, number][] = [];
  for (let x = 0; x < cols; x++) out.push([x, 0]);
  for (let y = 1; y < rows; y++) out.push([cols - 1, y]);
  if (rows > 1) for (let x = cols - 2; x >= 0; x--) out.push([x, rows - 1]);
  if (cols > 1) for (let y = rows - 2; y >= 1; y--) out.push([0, y]);
  return out;
}

/** the heat level of ring cell i of n at a step: 0 is the ink base, 1..5 index HEAT_PALETTE (5 is a segment's head). A negative step travels the other way */
export function frameLevel(i: number, n: number, step: number): number {
  if (n < 1) return 0;
  const gap = n / SEGMENTS;
  const len = Math.min(SEGMENT_LEN, Math.floor(gap));
  for (let k = 0; k < SEGMENTS; k++) {
    const head = Math.round(k * gap) + step;
    const behind = (((step < 0 ? i - head : head - i) % n) + n) % n;
    if (behind < len) return Math.max(1, 5 - Math.floor((behind * 5) / len));
  }
  return 0;
}

/** when each ring cell builds in (0..0.9 of the window), in order along the side the card comes from */
export function buildDelays(cols: number, rows: number, side: Side): Float32Array {
  const cells = perimeterCells(cols, rows);
  const out = new Float32Array(cells.length);
  cells.forEach(([x, y], i) => {
    const u = cols > 1 ? x / (cols - 1) : 0;
    const v = rows > 1 ? y / (rows - 1) : 0;
    const along = side === 'left' ? u : side === 'right' ? 1 - u : side === 'top' ? v : 1 - v;
    out[i] = Math.min(0.9, Math.max(0, along * 0.75 + (hash(x, y, 7) - 0.5) * 0.3 + 0.08));
  });
  return out;
}

export type FramePhase = 'hidden' | 'build' | 'shown' | 'scatter';

/** whether a cell is drawn, t being 0..1 through its phase: it appears when t reaches its delay and leaves in the same order */
export function cellVisible(phase: FramePhase, t: number, delay: number): boolean {
  if (phase === 'hidden') return false;
  if (phase === 'shown') return true;
  if (phase === 'build') return t >= delay;
  return t < delay;
}

/** the way the colour travels for a card that comes from this side */
export const travelDir = (side: Side): 1 | -1 => (side === 'top' || side === 'left' ? 1 : -1);

export interface PeekFrame {
  /** the card builds in from a side */
  build(side: Side, ms: number): void;
  /** the card switched project: the frame stays and the colour flicks toward the new side */
  shift(side: Side): void;
  /** the card scatters */
  scatter(ms: number): void;
  /** true while the frame is built or building */
  active(): boolean;
}

export function mountPeekFrame(canvas: HTMLCanvasElement, reduced: boolean): PeekFrame {
  const ctx = canvas.getContext('2d')!;
  let phase: FramePhase = 'hidden';
  let start = 0;
  let duration = 1;
  let raf = 0;
  let cols = 0,
    rows = 0,
    width = 0,
    height = 0;
  let ring: [number, number][] = [];
  let delays: Float32Array = new Float32Array(0);
  let dir: 1 | -1 = 1;
  // the step count is kept as a base plus the time since it last changed direction, so a flick does not jump
  let base = 0;
  let baseAt = 0;
  let kick = 0;

  const measure = (side: Side) => {
    const w = canvas.offsetWidth,
      h = canvas.offsetHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w !== width || h !== height) {
      width = w;
      height = h;
      cols = Math.ceil(w / CELL);
      rows = Math.ceil(h / CELL);
      ring = perimeterCells(cols, rows);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    delays = buildDelays(cols, rows, side);
  };

  const stepAt = (now: number) =>
    reduced ? 0 : base + dir * Math.floor(((now - baseAt) * STEPS_PER_SECOND) / 1000) + kick;

  const draw = (now: number) => {
    ctx.clearRect(0, 0, width, height);
    const t = Math.min(1, Math.max(0, (now - start) / duration));
    const step = stepAt(now);
    for (let i = 0; i < ring.length; i++) {
      if (!cellVisible(phase, t, delays[i])) continue;
      ctx.fillStyle = HEAT_PALETTE[reduced ? 0 : frameLevel(i, ring.length, step)];
      ctx.fillRect(ring[i][0] * CELL, ring[i][1] * CELL, CELL, CELL);
    }
    return t;
  };

  const frame = (now: number) => {
    raf = 0;
    const t = draw(now);
    if (phase === 'build' && t >= 1) phase = 'shown';
    if (phase === 'scatter' && t >= 1) {
      phase = 'hidden';
      ctx.clearRect(0, 0, width, height);
      return;
    }
    if (reduced && phase === 'shown') return;
    raf = requestAnimationFrame(frame);
  };

  const run = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  };

  const turn = (side: Side, now: number) => {
    base = stepAt(now);
    baseAt = now;
    kick = 0;
    dir = travelDir(side);
  };

  return {
    build(side, ms) {
      const now = performance.now();
      measure(side);
      turn(side, now);
      phase = 'build';
      start = now;
      duration = ms;
      run();
    },
    shift(side) {
      const now = performance.now();
      turn(side, now);
      // a flick: the colour jumps a few cells the new way
      kick = dir * 4;
      if (phase === 'hidden') return;
      run();
    },
    scatter(ms) {
      if (phase === 'hidden') return;
      const now = performance.now();
      delays = buildDelays(cols, rows, 'left');
      phase = 'scatter';
      start = now;
      duration = ms;
      run();
    },
    active: () => phase === 'build' || phase === 'shown',
  };
}
