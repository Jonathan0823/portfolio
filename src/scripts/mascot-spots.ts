// Where a footer mascot can stand on the wordmark, and the routes between those places. Pure geometry in half field cells
// (one cell is two): a position `P` is the half-cell column of the sprite's left edge, a floor `F` its feet's height
// above the word's base row. No DOM, no clock.
import type { MascotSprite } from './mascot-sprites';

export interface Step {
  P: number;
  F: number;
  kind: 'walk' | 'hop';
}

/** a stand must be at least this high: the tops of the letters, not the strokes the lava laps over inside them */
const MIN_FLOOR = 8;
/** a walk climbs or drops at most this much per half cell */
const MAX_WALK_RISE = 2;
/** half cells kept between two mascots, and the farthest a route reaches */
const SPACING = 2;
const MAX_REACH = 48;
const MAX_COST = 60;
/** heat counted as burning, and how many burning cells it takes to notice */
const HOT = 0.5;
const MIN_HOT_CELLS = 3;
/** the share of the time a walker picks somewhere it can walk to over somewhere it must hop to */
const WALK_PREFERENCE = 0.65;

/** the letters' top edge per field column, in half cells above the base (0 where no letter stands) */
export function topsOf(ink: ReadonlyArray<readonly [column: number, height: number, delay: number]>, columns: number) {
  const tops = new Int16Array(columns);
  for (const [x, k] of ink) if (x >= 0 && x < columns) tops[x] = Math.max(tops[x], 2 * (k + 1));
  return tops;
}

const topAt = (tops: Int16Array, half: number) => {
  const c = Math.floor(half / 2);
  return c >= 0 && c < tops.length ? tops[c] : 0;
};

/**
 * The floor height a sprite at `P` rests on, or -1 where it cannot stand: its feet must all be on letter tops (a pair of
 * feet needs one on the edge, the other may hang over a notch) and no part of its body may be inside a letter.
 */
export function standFloor(sprite: MascotSprite, tops: Int16Array, P: number): number {
  let floor = 0;
  for (const group of sprite.feet) for (const u of group) floor = Math.max(floor, topAt(tops, P + u));
  if (floor < MIN_FLOOR) return -1;
  for (const group of sprite.feet) if (!group.some((u) => topAt(tops, P + u) === floor)) return -1;
  for (let u = 0; u < sprite.width; u++) if (topAt(tops, P + u) > floor + sprite.low[u]) return -1;
  return floor;
}

/** the lowest floor that keeps the whole sprite clear above the letters at `P`: what a hop must clear in flight */
export function clearFloor(sprite: MascotSprite, tops: Int16Array, P: number): number {
  let floor = 0;
  for (let u = 0; u < sprite.width; u++) floor = Math.max(floor, topAt(tops, P + u) - sprite.low[u]);
  return floor;
}

/** every position along the word where the sprite can stand, with the floor it rests on there */
export function standingSpots(sprite: MascotSprite, tops: Int16Array, x0: number, x1: number): Map<number, number> {
  const spots = new Map<number, number>();
  for (let P = x0 * 2 - sprite.width; P <= (x1 + 1) * 2; P++) {
    const floor = standFloor(sprite, tops, P);
    if (floor > 0) spots.set(P, floor);
  }
  return spots;
}

/** first and last column of each letter, from where the ink runs unbroken */
export function letterSpans(tops: Int16Array, x0: number, x1: number): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = [];
  let open = -1;
  for (let x = x0; x <= x1 + 1; x++) {
    const lit = x <= x1 && tops[x] > 0;
    if (lit && open < 0) open = x;
    if (!lit && open >= 0) {
      spans.push({ start: open, end: x - 1 });
      open = -1;
    }
  }
  return spans;
}

/** do two sprites at `a` (width `aw`) and `b` (width `bw`) stand too close to share the word */
export function crowds(a: number, aw: number, b: number, bw: number): boolean {
  return a < b + bw + SPACING && b < a + aw + SPACING;
}

/** the standing spot whose sprite is centred nearest `centre` (half cells), skipping those `avoid` rules out; null if none */
export function nearestSpot(
  spots: ReadonlyMap<number, number>,
  sprite: MascotSprite,
  centre: number,
  avoid?: (P: number) => boolean,
): number | null {
  let best: number | null = null;
  for (const P of spots.keys()) {
    if (avoid?.(P)) continue;
    if (best === null || Math.abs(P + sprite.width / 2 - centre) < Math.abs(best + sprite.width / 2 - centre)) best = P;
  }
  return best;
}

/**
 * Where loose heat (a pointer's trail, a spark) burns near a sprite: the mean column, in half cells, of the cells at
 * least `HOT` hot within `reach` cells either side and `above` rows over its feet, or null when too few burn to matter.
 * `heat` is the field's, row by row from the bottom; `row` is the row of the sprite's feet.
 */
export function heatNear(
  heat: ArrayLike<number>,
  columns: number,
  rows: number,
  region: { left: number; right: number; row: number },
  reach: number,
  above: number,
): number | null {
  const c0 = Math.max(0, Math.floor(region.left / 2) - reach);
  const c1 = Math.min(columns - 1, Math.ceil(region.right / 2) + reach);
  const r0 = Math.max(0, region.row - 1);
  const r1 = Math.min(rows - 1, region.row + above);
  let sum = 0;
  let count = 0;
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++)
      if (heat[r * columns + c] >= HOT) {
        sum += c;
        count++;
      }
  return count > MIN_HOT_CELLS ? (sum / count) * 2 + 1 : null;
}

export interface RouteRequest {
  spots: ReadonlyMap<number, number>;
  /** where the sprite stands now, which must be one of the spots */
  from: number;
  /** spots another mascot is too close to */
  blocked?: (P: number) => boolean;
  /** restricts where the route may end */
  ends?: (P: number) => boolean;
  rng: () => number;
}

/**
 * A walk or a string of hops to somewhere else along the word. Walkers take single steps where the floor is nearly
 * level and hop gaps; hoppers hop. Cheapest routes first (a walker avoids hopping), null when nowhere is reachable.
 */
export function planRoute(sprite: MascotSprite, req: RouteRequest): Step[] | null {
  const { spots, from, blocked, ends, rng } = req;
  const { walks, hopMin, hopMax, hopCost } = sprite.gait;
  const nodes = [...spots.keys()].filter((P) => P === from || !blocked?.(P));
  const cost = new Map<number, number>([[from, 0]]);
  const prev = new Map<number, number>();
  const done = new Set<number>();
  for (;;) {
    let cur = NaN;
    let best = Infinity;
    for (const [P, c] of cost)
      if (!done.has(P) && c < best) {
        best = c;
        cur = P;
      }
    if (best === Infinity) break;
    done.add(cur);
    const here = spots.get(cur)!;
    for (const P of nodes) {
      if (done.has(P)) continue;
      const dist = Math.abs(P - cur);
      let step = Infinity;
      if (walks && dist === 1 && Math.abs(spots.get(P)! - here) <= MAX_WALK_RISE) step = 1;
      else if (dist >= hopMin && dist <= hopMax) step = hopCost;
      if (best + step < (cost.get(P) ?? Infinity)) {
        cost.set(P, best + step);
        prev.set(P, cur);
      }
    }
  }
  const minAway = walks ? 3 : 7;
  const far = [...cost.keys()].filter(
    (P) =>
      Math.abs(P - from) >= minAway &&
      Math.abs(P - from) <= MAX_REACH &&
      cost.get(P)! <= MAX_COST &&
      (!ends || ends(P)),
  );
  if (!far.length) return null;
  const walked = far.filter((P) => cost.get(P) === Math.abs(P - from));
  const pool = walks && walked.length && rng() < WALK_PREFERENCE ? walked : far;
  let P = pool[Math.floor(rng() * pool.length)];
  const path: Step[] = [];
  while (P !== from) {
    const before = prev.get(P)!;
    path.unshift({ P, F: spots.get(P)!, kind: walks && Math.abs(P - before) === 1 ? 'walk' : 'hop' });
    P = before;
  }
  return path;
}
