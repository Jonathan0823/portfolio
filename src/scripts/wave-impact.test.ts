import { describe, expect, it } from 'vitest';
import { IMPACT_FROM, waveSpeed, farthestCorner, type ShockwaveDetail } from './cursor-math';
import { WAVE_STEP_MS, createWave, hitWave, shedColumns, stepWave, waveUnder } from './surface-wave';
import { planBlast, type BlastSurface } from './wave-impact';

const W = 1400,
  H = 900;
const blastAt = (x: number, y: number, charge: number): ShockwaveDetail => ({
  x,
  y,
  charge,
  speed: waveSpeed(farthestCorner(x, y, W, H)),
});
const COLUMNS = 175;
const hero: BlastSurface = {
  left: 0,
  cell: 8,
  edge: 0,
  flipped: false,
  rows: new Float32Array(COLUMNS).fill(12),
  columns: COLUMNS,
};
const foot: BlastSurface = {
  left: 0,
  cell: 8,
  edge: H,
  flipped: true,
  rows: new Float32Array(COLUMNS).fill(10),
  columns: COLUMNS,
};

/** plays a blast on a surface; what the water did: whether it shed a drop, and its fastest rising crest */
function play(blast: ShockwaveDetail, surface: BlastSurface) {
  const hits = planBlast(blast, surface, W, H);
  const wave = createWave(surface.columns);
  let next = 0,
    shed = 0,
    splash = false;
  for (let t = 0; t < 2500; t += WAVE_STEP_MS) {
    while (next < hits.length && hits[next].atMs <= t) hitWave(wave, hits[next].column, hits[next++].push);
    stepWave(wave);
    shed += shedColumns(wave, t).length;
    splash ||= waveUnder(wave, 0, surface.columns - 1).splash;
  }
  return { shed, splash, hits };
}

describe('blast plan', () => {
  it('does nothing below the impact threshold', () => {
    expect(planBlast(blastAt(700, 100, IMPACT_FROM), hero, W, H)).toEqual([]);
  });

  it('reaches columns as the front does, nearest first', () => {
    const hits = planBlast(blastAt(100, 100, 1), hero, W, H);
    expect(hits).toHaveLength(COLUMNS);
    expect(hits[0].column).toBeLessThan(hits.at(-1)!.column);
    for (let i = 1; i < hits.length; i++) expect(hits[i].atMs).toBeGreaterThanOrEqual(hits[i - 1].atMs);
    expect(hits[0].push).toBeGreaterThan(hits.at(-1)!.push);
  });

  it('hits a column when the front, at constant speed, gets there', () => {
    const blast = blastAt(0, 0, 1);
    const hit = planBlast(blast, hero, W, H).find((h) => h.column === 0)!;
    const distance = Math.hypot(4, 12 * 8);
    expect(hit.atMs).toBeCloseTo((distance / blast.speed) * 1000, 5);
  });

  it('leaves out columns off screen', () => {
    const shifted = { ...hero, left: -600 };
    expect(planBlast(blastAt(700, 100, 1), shifted, W, H).every((h) => h.column >= 75)).toBe(true);
    const below = { ...hero, edge: H + 50 };
    expect(planBlast(blastAt(700, 100, 1), below, W, H)).toEqual([]);
  });

  it('measures the flipped footer up from its bottom edge', () => {
    const hits = planBlast(blastAt(700, H - 80 - 4, 1), foot, W, H);
    // the epicentre sits just above the surface (y = 900 - 80): the nearest column is the middle one
    expect(hits[0].column).toBeGreaterThan(80);
    expect(hits[0].column).toBeLessThan(95);
  });

  it('is stronger with more charge', () => {
    const push = (c: number) => planBlast(blastAt(700, 100, c), hero, W, H)[0].push;
    expect(push(1)).toBeGreaterThan(push(0.7));
    expect(push(0.7)).toBeGreaterThan(push(0.5));
  });
});

describe('blast on the water', () => {
  it('a full charge near the hero edge shakes drops loose; a mid charge does not', () => {
    expect(play(blastAt(700, 60, 1), hero).shed).toBeGreaterThan(0);
    expect(play(blastAt(700, 60, 0.6), hero).shed).toBe(0);
  });

  it('a full charge near the footer splashes it; a mid charge does not', () => {
    expect(play(blastAt(700, H - 160, 1), foot).splash).toBe(true);
    expect(play(blastAt(700, H - 160, 0.6), foot).splash).toBe(false);
  });

  it('settles', () => {
    const { hits } = play(blastAt(700, 60, 1), hero);
    const wave = createWave(COLUMNS);
    for (const h of hits) hitWave(wave, h.column, h.push);
    for (let i = 0; i < 3000; i++) stepWave(wave);
    expect(Math.max(...wave.height.map(Math.abs))).toBeLessThan(0.05);
  });
});
