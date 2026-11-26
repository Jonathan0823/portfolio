// Footer wordmark: EGUIN rises out of the footer field's skyline as part of the field itself. The letters are field
// cells one step hotter than their surroundings, merged with the body, left-aligned to the page gutter. They appear in
// an ordered reveal (letter by letter, left to right, each cell popping in hot yellow and cooling to its resting colour) each
// time 30% of the footer field is scrolled into view, sink back into the field (right to left, top cells first) when it scrolls out, and dissolve out and back in around a closing button's logo (hover on a fine pointer, the cycle
// on touch). Reduced motion shows the word static. Driven from the field's shape callback every paint, through the
// `mold` of the shape.
import type { FieldShape } from './pixel-math';
import type { HeroField } from './hero-field';
import { tideSwell } from './footer-tide';
import { FINE_POINTER_QUERY } from './motion';

/** 4-5 wide x 5 tall, drawn at 2 cells per pixel: 10 rows tall with 2-cell strokes */
const LETTERS: Record<string, string[]> = {
  E: ['####', '#...', '###.', '#...', '####'],
  G: ['.###', '#...', '#.##', '#..#', '.###'],
  U: ['#..#', '#..#', '#..#', '#..#', '.##.'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
};
/** phones: 6-7 wide x 7 tall, 1-cell strokes (about two thirds of a 390px screen) */
const SMALL_LETTERS: Record<string, string[]> = {
  E: ['######', '#.....', '#.....', '#####.', '#.....', '#.....', '######'],
  G: ['.#####', '#.....', '#.....', '#..###', '#....#', '#....#', '.####.'],
  U: ['#....#', '#....#', '#....#', '#....#', '#....#', '#....#', '.####.'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  N: ['#....#', '##...#', '#.#..#', '#..#.#', '#...##', '#....#', '#....#'],
};
const WORD = [...'EGUIN'];
const SIZES = {
  large: { letters: LETTERS, scale: 2, rows: 10, gap: 2, clearFrom: 3 },
  small: { letters: SMALL_LETTERS, scale: 1, rows: 7, gap: 1, clearFrom: 2 },
};
/** the footer must show this share of itself (capped to what fits the screen) before the word is revealed */
const SEEN_SHARE = 0.3;
/** cells pop in column by column over under this long, then each cools over COOL_MS */
const DISSOLVE_MS = 700;
const COOL_MS = 300;
/** stagger per letter-glyph column (ms): about 22 columns across the large word, 32 across the small one */
const COLUMN_MS = { large: 30, small: 20 };
const FULL_MS = DISSOLVE_MS + COOL_MS;
/** sinking back top-first: the top row lags the bottom row's delay by this much, blended in over SINK_BLEND_MS */
const SINK_LAG_MS = 120;
const SINK_BLEND_MS = 150;
/** dissolving out (sinking) runs this much faster than in: the clock's ~850ms span takes about 500ms */
const OUT_RATE = 1.7;
/** the word waits this long after the tide has drained away before it dissolves back in */
const RETURN_MS = 200;
/** a frame longer than this (a background tab) counts as this long */
const MAX_DT_MS = 100;
/** terrain above this many cells over the word's base, inside its span, is cleared so the upper letters stand free */
const CLEAR_MARGIN = 4;
const NARROW_QUERY = '(min-width: 768px)';

export type Ink = Array<[column: number, height: number, delay: number]>;

export interface Wordmark {
  /** letter cells: column, height above the base, and the cell's own dissolve delay (ms) */
  ink: Ink;
  /** the letter cells as column * 1000 + height, to tell them from terrain */
  inkSet: Set<number>;
  /** each word column's earliest cell delay */
  colDelay: Map<number, number>;
  /** first and last column of the word */
  x0: number;
  x1: number;
  /** rows the word stands tall, and the lowest row cleared of terrain above its base */
  height: number;
  clearFrom: number;
}

/** reveal delay (ms) of a cell at `col` glyph columns from the word's first column (fractional inside a scaled stroke) */
export function revealDelay(col: number, small: boolean): number {
  return col * COLUMN_MS[small ? 'small' : 'large'];
}

/** the word in field cells, its first column at `left` */
export function layoutWordmark(left: number, small: boolean): Wordmark {
  const { letters, scale, rows, gap, clearFrom } = SIZES[small ? 'small' : 'large'];
  const ink: Ink = [];
  let x = left;
  let cols = 0;
  for (const ch of WORD) {
    const glyph = letters[ch];
    glyph.forEach((row, r) =>
      [...row].forEach((c, j) => {
        if (c !== '#') return;
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) {
            const cx = x + j * scale + dx;
            const k = (glyph.length - 1 - r) * scale + dy;
            ink.push([cx, k, revealDelay(cols + (j * scale + dx) / scale, small)]);
          }
      }),
    );
    x += glyph[0].length * scale + gap;
    cols += glyph[0].length + gap / scale;
  }
  const colDelay = new Map<number, number>();
  for (const [cx, , delay] of ink) colDelay.set(cx, Math.min(colDelay.get(cx) ?? Infinity, delay));
  return {
    ink,
    inkSet: new Set(ink.map(([cx, k]) => cx * 1000 + k)),
    colDelay,
    x0: left,
    x1: x - gap - 1,
    height: rows,
    clearFrom,
  };
}

/** rows the field's surface has dropped at `coverage` (1 = at rest), by the same scaling stepField applies to the horizon */
export function coverageDrop(horizonRow: number, coverage: number): number {
  return Math.round(horizonRow * (1 - Math.max(0, Math.min(1, coverage))));
}

/** the word's dissolve clock (0 = gone .. FULL_MS = fully in) after `dt` ms; no motion jumps to either end */
export function advanceClock(clock: number, dt: number, want: boolean, motion: boolean): number {
  if (!motion) return want ? FULL_MS : 0;
  if (want) return Math.min(FULL_MS, clock + dt);
  return Math.max(0, Math.min(clock, DISSOLVE_MS + SINK_LAG_MS) - dt * OUT_RATE);
}

/** the clock value at which a cell appears: its delay, plus (as `sink` blends 0..1) a lag growing with height, so a sink drops the top cells first */
export function cellThreshold(delay: number, k: number, height: number, sink: number): number {
  return delay + sink * SINK_LAG_MS * (k / Math.max(1, height - 1));
}

/** the sink blend (0 = revealing order, 1 = sinking order) after `dt` ms heading for `want` */
export function advanceSink(sink: number, dt: number, want: boolean): number {
  return Math.min(1, Math.max(0, sink + (want ? -dt : dt) / SINK_BLEND_MS));
}

/** palette level 5 / 4 of a cell popping in `age` ms ago while dissolving in; 0 once it has cooled to its resting colour */
export function popLevel(age: number, dissolvingIn: boolean): number {
  if (!dissolvingIn || age >= COOL_MS) return 0;
  return age < COOL_MS * 0.4 ? 5 : age < COOL_MS * 0.75 ? 4 : 0;
}

/** ms until the entrance reveal has finished (Infinity while the footer has not been scrolled to); 0 without motion */
export function wordmarkRevealWait(): number {
  if (!inView || !revealAt) return Infinity;
  return Math.max(0, revealAt + FULL_MS - performance.now());
}

/** whether the footer is currently scrolled far enough into view for the word to stand */
export const wordmarkInView = () => inView;

/** called whenever the word is wanted up (true) or down (false); returns an unsubscribe */
export function onWordmarkView(cb: (inView: boolean) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

interface Layout extends Wordmark {
  key: string;
  base: number;
  /** field rows where the body is certain to be present under the word */
  found: number;
}

let inView = false;
let revealAt = 0;
let watching = false;
const listeners = new Set<(inView: boolean) => void>();
const setInView = (next: boolean) => {
  if (next === inView) return;
  inView = next;
  if (next) revealAt = performance.now();
  listeners.forEach((cb) => cb(next));
};
let clock = 0;
let sink = 0;
let lastNow = 0;
let busyUntil = 0;
let mold = new Int8Array(0);
let layout: Layout | null = null;

const tideBusy = () => {
  for (let i = 0; i < tideSwell.rows.length; i++) if (tideSwell.rows[i] > 0.05) return true;
  for (let i = 0; i < tideSwell.stamp.length; i++) if (tideSwell.stamp[i] !== 0) return true;
  return false;
};

/** phones and touch screens get the small word, as does any narrow window */
const isSmall = () => !window.matchMedia(NARROW_QUERY).matches || !window.matchMedia(FINE_POINTER_QUERY).matches;

function place(foot: HeroField, small: boolean): Layout {
  const f = foot.field();
  const { columns, hostRows, cellSize } = f;
  const heading = document.querySelector('#contact h2');
  const gutter = heading ? heading.getBoundingClientRect().left - foot.rect().left : 96;
  const left = Math.max(1, Math.round(gutter / cellSize));
  const key = [columns, hostRows, cellSize, left, f.horizonRow, small].join('x');
  if (layout?.key === key) return layout;
  const word = layoutWordmark(left, small);
  layout = {
    ...word,
    key,
    // standing a little under the field's usual surface, but never so high that the letters leave the footer's height
    base: Math.max(0, Math.min(f.horizonRow + 1, hostRows - word.height)),
    found: Math.max(0, Math.floor(hostRows * 0.46) - 1),
  };
  return layout;
}

/** called from the footer field's shape callback every paint */
export function footWordmarkShape(foot: HeroField | undefined, motion: boolean, coverage = 1): FieldShape {
  if (!foot) return {};
  const small = isSmall();
  const field = foot.field();
  const now = performance.now();

  if (!motion && !inView) {
    setInView(true);
    revealAt = -FULL_MS;
  }
  if (motion && !watching) {
    const host = foot.canvas.parentElement;
    if (host && 'IntersectionObserver' in window) {
      watching = true;
      // most of the field in view; capped so a field taller than the screen can still trigger
      const need = Math.min(SEEN_SHARE, (innerHeight * 0.9) / Math.max(1, host.clientHeight));
      // the extra threshold below `need` guarantees a callback after a slow exit that skipped past it
      const io = new IntersectionObserver(
        ([entry]) => {
          const ratio = entry.isIntersecting ? entry.intersectionRatio : 0;
          if (ratio >= need - 0.02) setInView(true);
          else if (ratio < need - 0.005) setInView(false);
          foot.markDirty();
        },
        { threshold: [0, need * 0.8, need, 1] },
      );
      io.observe(host);
    } else setInView(true);
  }

  // while a closing button's logo is on show (or being washed in or out) the word dissolves out
  if (tideBusy()) busyUntil = now + RETURN_MS;
  const want = inView && now >= busyUntil;
  const dt = lastNow ? Math.min(MAX_DT_MS, now - lastNow) : 16;
  lastNow = now;
  clock = advanceClock(clock, dt, want, motion);
  sink = motion ? advanceSink(sink, dt, want) : 0;
  if (clock <= 0) return {};
  if (motion && (!want || clock < FULL_MS)) foot.markDirty();

  const { columns, rows } = field;
  const lay = place(foot, small);
  // the whole word rides the field's surface down as the footer scrolls out; cells below the bottom are not drawn
  const drop = coverageDrop(field.horizonRow, coverage);
  const base = lay.base - drop;
  const found = Math.max(0, lay.found - drop);
  if (mold.length !== columns * rows) mold = new Int8Array(columns * rows);
  mold.fill(0);
  // the body is certain to reach the ground under the word, so letters never hover over a dip in the terrain
  for (let x = lay.x0; x <= Math.min(columns - 1, lay.x1); x++)
    for (let y = found; y < base; y++) mold[y * columns + x] = 2;
  // a light clearing: terrain standing above the word's lowest rows, inside the word's own span only, dissolves with it
  for (let x = Math.max(0, lay.x0 - 1); x <= Math.min(columns - 1, lay.x1 + 1); x++)
    for (let k = lay.clearFrom; k < lay.height + CLEAR_MARGIN; k++) {
      const y = base + k;
      const cd = lay.colDelay.get(Math.min(lay.x1, Math.max(lay.x0, x))) ?? 0;
      if (y >= 0 && y < rows && !lay.inkSet.has(x * 1000 + k) && cd <= clock) mold[y * columns + x] = -1;
    }
  for (const [x, k, delay] of lay.ink) {
    const y = base + k;
    if (y < 0) continue;
    const at = cellThreshold(delay, k, lay.height, sink);
    if (x >= columns || y >= rows || at > clock) continue;
    // popping in: white-hot yellow, then one step down at a time, then the resting (one step hotter) colour
    const hot = popLevel(clock - at, want);
    mold[y * columns + x] = hot ? 10 + hot : 1;
  }
  return { mold };
}
