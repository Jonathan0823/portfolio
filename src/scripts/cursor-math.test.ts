import { describe, expect, it } from 'vitest';
import {
  CHARGE_MS,
  MOTE_FROM,
  POP_MS,
  TAP_MS,
  chargeAt,
  chargeScale,
  clampLevel,
  fieldRingHeat,
  fieldRingRadius,
  moteRadius,
  popScale,
  shockwaveShape,
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
    const half = fieldRingRadius(true, 0, 0.5),
      end = fieldRingRadius(true, 0, 1);
    expect(half).toBeGreaterThan(end / 2);
    expect(fieldRingRadius(true, 1, 1)).toBeGreaterThan(end);
    expect(fieldRingRadius(false, 0, 1)).toBeLessThan(end);
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
