import { describe, expect, it, vi } from 'vitest';
import { combineInputs, type WaveInput } from './surface-waves';
import { createWave } from './surface-wave';
import type { HeroField } from './hero-field';

const fake = (busy: boolean): WaveInput => ({ frame: vi.fn(), step: vi.fn(), busy: vi.fn(() => busy), stop: vi.fn() });

describe('combined wave inputs', () => {
  it('gives every input each call', () => {
    const a = fake(false),
      b = fake(false);
    const input = combineInputs(
      () => a,
      () => b,
    )(() => {});
    const wave = createWave(4);
    input.frame?.(10);
    input.step?.({} as HeroField, wave);
    input.stop();
    for (const x of [a, b]) {
      expect(x.frame).toHaveBeenCalledWith(10);
      expect(x.step).toHaveBeenCalledOnce();
      expect(x.stop).toHaveBeenCalledOnce();
    }
  });

  it('is busy while any input is, and still asks the rest', () => {
    const a = fake(true),
      b = fake(false);
    const input = combineInputs(
      () => a,
      () => b,
    )(() => {});
    expect(input.busy?.(0)).toBe(true);
    expect(b.busy).toHaveBeenCalledOnce();
    expect(combineInputs(() => fake(false))(() => {}).busy?.(0)).toBe(false);
  });

  it('hands each input the same wake', () => {
    const wake = vi.fn();
    const seen: Array<() => void> = [];
    combineInputs(
      (w) => (seen.push(w), fake(false)),
      (w) => (seen.push(w), fake(false)),
    )(wake);
    expect(seen).toEqual([wake, wake]);
  });
});
