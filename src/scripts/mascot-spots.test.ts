import { describe, expect, it } from 'vitest';
import { layoutWordmark } from './footer-wordmark';
import {
  clearFloor,
  crowds,
  heatNear,
  letterSpans,
  nearestSpot,
  planRoute,
  standFloor,
  standingSpots,
  topsOf,
} from './mascot-spots';
import { CLAWD, PI } from './mascot-sprites';

const word = layoutWordmark(4, false);
const tops = topsOf(word.ink, word.x1 + 4);
const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length];
};

describe('topsOf', () => {
  it('takes the highest cell of each column, in half cells', () => {
    expect(Math.max(...tops)).toBe(20);
    expect(tops[word.x0]).toBe(20);
    expect(tops[word.x1 + 2]).toBe(0);
  });
});

describe('standing spots', () => {
  for (const sprite of [CLAWD, PI]) {
    const spots = standingSpots(sprite, tops, word.x0, word.x1);

    it(`${sprite.name} has places to stand`, () => {
      expect(spots.size).toBeGreaterThan(4);
    });

    it(`never floats ${sprite.name}: a foot is on a letter top and no body is in the ink`, () => {
      for (const [P, F] of spots) {
        expect(F).toBeGreaterThanOrEqual(8);
        for (const group of sprite.feet) {
          expect(group.some((u) => tops[Math.floor((P + u) / 2)] === F)).toBe(true);
        }
        for (let u = 0; u < sprite.width; u++) {
          expect(tops[Math.floor((P + u) / 2)] ?? 0).toBeLessThanOrEqual(F + sprite.low[u]);
        }
      }
    });
  }

  it('rejects a spot over the gap between letters, in mid-air', () => {
    const gap = word.x0 + 8 + 1;
    expect(tops[gap]).toBe(0);
    expect(standFloor(PI, tops, gap * 2 - 3)).toBe(-1);
  });

  it('rejects a spot where the body would sit inside a taller letter', () => {
    // the E's spine is as tall as its bars, so a sprite whose feet are on the notch of the G hangs into the G's wall
    const spots = standingSpots(CLAWD, tops, word.x0, word.x1);
    for (const [P] of spots) expect(clearFloor(CLAWD, tops, P)).toBeLessThanOrEqual(spots.get(P)!);
  });

  it('keeps clear of the letters on a hop: the clearance is the lowest safe floor', () => {
    expect(clearFloor(PI, tops, word.x0 * 2)).toBe(20);
    expect(clearFloor(PI, tops, word.x1 * 2 + 40)).toBe(0);
  });
});

describe('letters and homes', () => {
  it('finds the five letters of EGUIN', () => {
    expect(letterSpans(tops, word.x0, word.x1)).toHaveLength(5);
  });

  it('picks the standing spot nearest a point, skipping ruled-out ones', () => {
    const spots = standingSpots(PI, tops, word.x0, word.x1);
    const spans = letterSpans(tops, word.x0, word.x1);
    const target = spans[3].start + spans[3].end + 1;
    const near = nearestSpot(spots, PI, target)!;
    expect(Math.abs(near + PI.width / 2 - target)).toBeLessThanOrEqual(2);
    const other = nearestSpot(spots, PI, target, (P) => P === near)!;
    expect(other).not.toBe(near);
  });

  it('crowds sprites that are within two half cells', () => {
    expect(crowds(0, 8, 9, 8)).toBe(true);
    expect(crowds(0, 8, 10, 8)).toBe(false);
    expect(crowds(20, 8, 0, 18)).toBe(false);
  });
});

describe('routes', () => {
  const spots = standingSpots(CLAWD, tops, word.x0, word.x1);
  const from = [...spots.keys()][0];

  it('walks a walker a half cell at a time where it can, and hops the gaps', () => {
    const path = planRoute(CLAWD, { spots, from, rng: seq(0.1) })!;
    expect(path.length).toBeGreaterThan(0);
    let at = from;
    for (const step of path) {
      expect(spots.get(step.P)).toBe(step.F);
      expect(step.kind).toBe(Math.abs(step.P - at) === 1 ? 'walk' : 'hop');
      at = step.P;
    }
  });

  it('only hops a hopper, and each hop is within its reach', () => {
    const piSpots = standingSpots(PI, tops, word.x0, word.x1);
    const start = [...piSpots.keys()][0];
    const path = planRoute(PI, { spots: piSpots, from: start, rng: seq(0.5) })!;
    let at = start;
    for (const step of path) {
      expect(step.kind).toBe('hop');
      expect(Math.abs(step.P - at)).toBeGreaterThanOrEqual(PI.gait.hopMin);
      expect(Math.abs(step.P - at)).toBeLessThanOrEqual(PI.gait.hopMax);
      at = step.P;
    }
  });

  it('keeps off places another mascot crowds and honours where it must end', () => {
    const piSpots = standingSpots(PI, tops, word.x0, word.x1);
    const start = [...piSpots.keys()][0];
    const path = planRoute(PI, {
      spots: piSpots,
      from: start,
      blocked: (P) => P < start + 20,
      ends: (P) => P > start,
      rng: Math.random,
    });
    for (const step of path ?? []) expect(step.P).toBeGreaterThanOrEqual(start + 20);
  });

  it('goes nowhere when nothing is reachable', () => {
    expect(planRoute(PI, { spots: new Map([[10, 8]]), from: 10, rng: Math.random })).toBeNull();
  });
});

describe('heatNear', () => {
  const columns = 20;
  const rows = 10;
  const heat = new Float32Array(columns * rows);
  const region = { left: 10, right: 18, row: 3 };

  it('is null while little burns', () => {
    expect(heatNear(heat, columns, rows, region, 3, 6)).toBeNull();
    heat[5 * columns + 8] = 0.9;
    expect(heatNear(heat, columns, rows, region, 3, 6)).toBeNull();
  });

  it('gives the mean column in half cells when enough burns near', () => {
    for (const c of [8, 9, 10, 11]) heat[5 * columns + c] = 0.9;
    expect(heatNear(heat, columns, rows, region, 3, 6)).toBeCloseTo(((8 + 9 + 10 + 11) / 4) * 2 + 1);
  });

  it('ignores heat below the feet or too high', () => {
    const cold = new Float32Array(columns * rows);
    for (const c of [8, 9, 10, 11]) cold[0 * columns + c] = cold[9 * columns + c] = 0.9;
    expect(heatNear(cold, columns, rows, region, 3, 4)).toBeNull();
  });
});
