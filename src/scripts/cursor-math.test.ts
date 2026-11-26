import { describe, expect, it } from 'vitest';
import {
  CHARGE_MS,
  IMPACT_FROM,
  KICK_CAP,
  MIN_WAVE_SPEED,
  MOTE_FROM,
  POP_MS,
  TAP_MS,
  approach,
  arrivalMs,
  chargeAt,
  chargeScale,
  clampLevel,
  farthestCorner,
  fieldRingHeat,
  fieldRingRadius,
  impactRamp,
  impactStrength,
  kickFalloff,
  moteRadius,
  popScale,
  ringRadius,
  shockwaveShape,
  springValue,
  waveSpeed,
} from './cursor-math';

describe('chargeAt', () => {
  it('is nothing through the tap window', () => {
    expect(chargeAt(0)).toBe(0);
    expect(chargeAt(TAP_MS)).toBe(0);
  });
  it('is full at about 1.25s and stays there', () => {
    expect(chargeAt(TAP_MS + CHARGE_MS)).toBe(1);
    expect(chargeAt(10_000)).toBe(1);
  });
  it('eases out: past half after the first third of the climb', () => {
    expect(chargeAt(TAP_MS + CHARGE_MS / 3)).toBeGreaterThan(0.5);
    expect(chargeAt(TAP_MS + CHARGE_MS * 0.9)).toBeGreaterThan(chargeAt(TAP_MS + CHARGE_MS * 0.5));
  });
  it('grows the pointer to about 1.8x', () => {
    expect(chargeScale(0)).toBe(1);
    expect(chargeScale(1)).toBeCloseTo(1.8);
  });
});

describe('impact', () => {
  it('does nothing up to the threshold, then ramps to 1', () => {
    expect(impactRamp(IMPACT_FROM)).toBe(0);
    expect(impactRamp(0)).toBe(0);
    expect(impactRamp(1)).toBe(1);
    expect(impactRamp(0.675)).toBeCloseTo(0.5);
  });
  it('is inert below the threshold and strongest at full charge', () => {
    expect(impactStrength(0.3)).toEqual({ ramp: 0, kick: 0, rotate: 0, shake: 0, flash: false });
    const mid = impactStrength(0.6),
      full = impactStrength(1);
    expect(mid.kick).toBeGreaterThan(0);
    expect(full.kick).toBeGreaterThan(mid.kick);
    expect(full.shake).toBeGreaterThan(mid.shake);
    expect(full.rotate).toBeGreaterThan(mid.rotate);
  });
  it('flashes only near full charge', () => {
    expect(impactStrength(0.7).flash).toBe(false);
    expect(impactStrength(0.85).flash).toBe(true);
  });
  it('caps how much content gets kicked', () => {
    expect(KICK_CAP).toBe(150);
  });
});

describe('the front', () => {
  it('measures to the farthest corner', () => {
    expect(farthestCorner(0, 0, 300, 400)).toBe(500);
    expect(farthestCorner(300, 400, 300, 400)).toBe(500);
    expect(farthestCorner(150, 200, 300, 400)).toBe(250);
  });
  it('never crosses slower than the minimum, and speeds up for far corners', () => {
    expect(waveSpeed(500)).toBe(MIN_WAVE_SPEED);
    expect(waveSpeed(3000)).toBeGreaterThan(MIN_WAVE_SPEED);
    expect(arrivalMs(3000, waveSpeed(3000))).toBeCloseTo(700);
  });
  it('grows linearly with time', () => {
    expect(ringRadius(0, 2000)).toBe(0);
    expect(ringRadius(500, 2000)).toBe(1000);
    expect(ringRadius(-5, 2000)).toBe(0);
  });
  it('reaches content at distance / speed', () => {
    expect(arrivalMs(900, 1800)).toBe(500);
  });
  it('kicks near content hardest but never leaves far content still', () => {
    expect(kickFalloff(0, 1000)).toBe(1);
    expect(kickFalloff(500, 1000)).toBeLessThan(kickFalloff(100, 1000));
    expect(kickFalloff(5000, 1000)).toBe(0.25);
  });
});

describe('springValue', () => {
  it('starts displaced, overshoots, and settles', () => {
    expect(springValue(0)).toBe(1);
    expect(springValue(0.5)).toBeLessThan(0);
    expect(Math.abs(springValue(1))).toBeLessThan(0.01);
  });
});

describe('popScale', () => {
  it('overshoots past 1 on the way back from a squash, then lands on 1', () => {
    expect(popScale(0, 0.8)).toBeCloseTo(0.8);
    expect(popScale(POP_MS / 2, 0.8)).toBeCloseTo(1.1);
    expect(popScale(POP_MS, 0.8)).toBe(1);
    expect(popScale(POP_MS * 3, 0.8)).toBe(1);
  });
});

describe('shockwaveShape', () => {
  it('is 60% on empty page', () => {
    expect(shockwaveShape(0, false).maxR).toBeCloseTo(shockwaveShape(0, true).maxR * 0.6);
  });
  it('grows with charge and adds spokes', () => {
    const tap = shockwaveShape(0, true),
      full = shockwaveShape(1, true);
    expect(full.maxR).toBeGreaterThan(tap.maxR);
    expect(full.durationMs).toBeGreaterThan(tap.durationMs);
    expect(full.spokes).toBe(16);
    expect(tap.full).toBe(false);
    expect(full.full).toBe(true);
    expect(shockwaveShape(0, false).spokes).toBe(4);
  });
});

describe('hero field ring', () => {
  it('expands fast then slows, and a bigger click reaches further', () => {
    const half = fieldRingRadius(true, 0, 0, 0.5),
      end = fieldRingRadius(true, 0, 0, 1);
    expect(half).toBeGreaterThan(end / 2);
    expect(fieldRingRadius(true, 1, 1, 1)).toBeGreaterThan(end);
    expect(fieldRingRadius(false, 0, 0, 1)).toBeLessThan(end);
  });
  it('heats only cells on the ring, and fades as it ages', () => {
    expect(fieldRingHeat(10, 4, true, 0)).toBe(0);
    expect(fieldRingHeat(4, 4, true, 0)).toBe(1);
    expect(fieldRingHeat(4, 4, true, 1)).toBeLessThan(1);
    expect(fieldRingHeat(4, 4, false, 0)).toBeLessThan(1);
  });
});

describe('motes', () => {
  it('start at the spawn radius and arrive at the pointer', () => {
    expect(moteRadius(0)).toBe(MOTE_FROM);
    expect(moteRadius(1)).toBe(0);
    expect(moteRadius(0.5)).toBeGreaterThan(0);
  });
});

describe('clampLevel', () => {
  it('rounds into the palette', () => {
    expect(clampLevel(-3)).toBe(0);
    expect(clampLevel(2.6)).toBe(3);
    expect(clampLevel(9)).toBe(5);
  });
});

describe('approach', () => {
  it('steps toward the target without overshooting', () => {
    expect(approach(0, 1, 0.25)).toBe(0.25);
    expect(approach(1, 0, 0.25)).toBe(0.75);
    expect(approach(0.9, 1, 0.25)).toBe(1);
    expect(approach(0.1, 0, 1)).toBe(0);
  });
});
