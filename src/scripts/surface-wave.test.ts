import { describe, expect, it } from 'vitest';
import {
  CALM,
  MAX_ROWS,
  createWave,
  pressWave,
  shedColumns,
  sloshWave,
  stepWave,
  tapWave,
  waveMoving,
  waveUnder,
  type SurfaceWave,
} from './surface-wave';

const run = (wave: SurfaceWave, steps: number) => {
  for (let i = 0; i < steps; i++) stepWave(wave);
};

describe('surface wave', () => {
  it('stays calm with nothing pressing it', () => {
    const wave = createWave(40);
    run(wave, 100);
    expect(waveMoving(wave)).toBe(false);
    expect([...wave.height].every((h) => h === 0)).toBe(true);
  });

  it('presses the surface in near the pointer only', () => {
    const wave = createWave(40);
    pressWave(wave, 20, 1, 0.5);
    run(wave, 3);
    expect(wave.height[20]).toBeLessThan(0);
    expect(wave.height[35]).toBe(0);
  });

  it('ignores a pointer far outside the surface or deep inside it', () => {
    const wave = createWave(40);
    pressWave(wave, 20, 8, 1);
    pressWave(wave, 20, -4, 1);
    expect(waveMoving(wave)).toBe(false);
  });

  it('presses harder for a moving pointer than a still one', () => {
    const still = createWave(40),
      moving = createWave(40);
    pressWave(still, 20, 1, 0);
    pressWave(moving, 20, 1, 1);
    expect(moving.velocity[20]).toBeLessThan(still.velocity[20]);
  });

  it('runs out both ways from the dent, then settles', () => {
    const wave = createWave(60);
    for (let i = 0; i < 10; i++) {
      pressWave(wave, 30, 1, 1);
      stepWave(wave);
    }
    run(wave, 25);
    expect(Math.abs(wave.height[15])).toBeGreaterThan(0.01);
    expect(Math.abs(wave.height[45])).toBeGreaterThan(0.01);
    run(wave, 2000);
    expect(waveMoving(wave)).toBe(false);
  });

  it('never moves the surface further than MAX_ROWS', () => {
    const wave = createWave(40);
    for (let i = 0; i < 200; i++) {
      pressWave(wave, 20, 1, 5);
      stepWave(wave);
      for (const h of wave.height) expect(Math.abs(h)).toBeLessThanOrEqual(MAX_ROWS);
    }
  });
});

describe('tapWave', () => {
  it('drops into the water near the tap only', () => {
    const wave = createWave(40);
    expect(tapWave(wave, 20, 2)).toBe(true);
    run(wave, 3);
    expect(wave.height[20]).toBeLessThan(0);
    expect(wave.height[35]).toBe(0);
  });

  it('misses a tap far from the surface, or off the field', () => {
    const wave = createWave(40);
    expect(tapWave(wave, 20, 12)).toBe(false);
    expect(tapWave(wave, 20, -6)).toBe(false);
    expect(tapWave(wave, 60, 0)).toBe(false);
    expect(waveMoving(wave)).toBe(false);
  });
});

describe('sloshWave', () => {
  it('moves the whole surface the way it is pushed, unevenly', () => {
    const wave = createWave(60);
    sloshWave(wave, 0.5, 0);
    expect([...wave.velocity].every((v) => v > 0)).toBe(true);
    expect(new Set([...wave.velocity].map((v) => v.toFixed(3))).size).toBeGreaterThan(1);
  });

  it('caps a hard jolt and settles afterwards', () => {
    const wave = createWave(60);
    sloshWave(wave, -50, 1);
    for (const v of wave.velocity) expect(v).toBeGreaterThanOrEqual(-0.8);
    run(wave, 3000);
    expect(waveMoving(wave)).toBe(false);
  });
});

describe('shedColumns', () => {
  const swinging = () => {
    const wave = createWave(30);
    wave.height[15] = 2;
    wave.velocity.set([0.5, 0.9, 0.5], 14);
    return wave;
  };

  it('sheds a drop at the top of a crest swinging back hard', () => {
    expect(shedColumns(swinging(), 0)).toEqual([15]);
  });

  it('then rests the columns around it', () => {
    const wave = swinging();
    shedColumns(wave, 0);
    expect(shedColumns(wave, 100)).toEqual([]);
    expect(shedColumns(wave, 5000)).toEqual([15]);
  });

  it('leaves a low or slow crest alone', () => {
    const low = swinging();
    low.height[15] = 1;
    const slow = swinging();
    slow.velocity[15] = 0.3;
    expect(shedColumns(low, 0)).toEqual([]);
    expect(shedColumns(slow, 0)).toEqual([]);
  });
});

describe('waveUnder', () => {
  it('is calm over calm water and over an empty span', () => {
    expect(waveUnder(createWave(20), 4, 8)).toEqual(CALM);
    expect(waveUnder(createWave(20), 30, 34)).toEqual(CALM);
  });

  it('lifts by the highest crest in half rows, never sinking into a trough', () => {
    const wave = createWave(20);
    wave.height.set([0.4, 1.8, 0.2], 5);
    expect(waveUnder(wave, 4, 8).lift).toBe(1.5);
    wave.height.fill(-3);
    expect(waveUnder(wave, 4, 8).lift).toBe(0);
  });

  it('tilts with the slope and splashes on a fast-rising crest', () => {
    const wave = createWave(20);
    wave.height[8] = 1;
    expect(waveUnder(wave, 4, 8).tilt).toBeGreaterThan(0);
    wave.height[8] = 0;
    wave.height[4] = 1;
    expect(waveUnder(wave, 4, 8).tilt).toBeLessThan(0);
    wave.velocity[6] = 0.8;
    expect(waveUnder(wave, 4, 8).splash).toBe(true);
  });
});
