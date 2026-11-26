import { describe, expect, it } from 'vitest';
import { HEAT_PALETTE } from './pixel-math';
import { INK, pointerStateFor, spriteFor } from './pointer-sprite';

describe('pointerStateFor', () => {
  it('uses the named shape for [data-cursor] targets', () => {
    expect(pointerStateFor('eye', true)).toBe('eye');
    expect(pointerStateFor('minus', false)).toBe('minus');
  });
  it('heats the arrow over other clickable things and ignores unknown names', () => {
    expect(pointerStateFor(undefined, true)).toBe('hot');
    expect(pointerStateFor('toString', true)).toBe('hot');
    expect(pointerStateFor(undefined, false)).toBe('arrow');
  });
});

describe('spriteFor', () => {
  it('puts the arrow tip on the hotspot', () => {
    const arrow = spriteFor('arrow');
    expect([arrow.ax, arrow.ay]).toEqual([0, 0]);
    expect(arrow.cells.find((c) => c.x === 0 && c.y === 0)?.ink).toBe(true);
    expect(Math.min(...arrow.cells.map((c) => c.x))).toBe(0);
    expect(Math.min(...arrow.cells.map((c) => c.y))).toBe(0);
  });
  it('outlines the plain arrow dark and the hot one in the palette', () => {
    expect(spriteFor('arrow').cells.some((c) => c.color === INK)).toBe(true);
    const hot = spriteFor('hot');
    expect(hot.cells.every((c) => (HEAT_PALETTE as readonly string[]).includes(c.color))).toBe(true);
  });
  it('runs the pressed fill hotter without touching the outline', () => {
    const calm = spriteFor('arrow'),
      pressed = spriteFor('arrow', true);
    expect(pressed.cells).toHaveLength(calm.cells.length);
    expect(pressed.cells.find((c) => !c.ink)!.color).not.toBe(calm.cells.find((c) => !c.ink)!.color);
    expect(pressed.cells.find((c) => c.ink)!.color).toBe(INK);
  });
  it('centres named shapes on the pointer', () => {
    const eye = spriteFor('eye');
    expect([eye.ax, eye.ay]).toEqual([5.5, 5.5]);
    expect(eye.cells.every((c) => c.x >= 0 && c.x < 11 && c.y >= 0 && c.y < 11)).toBe(true);
  });
  it('caches', () => {
    expect(spriteFor('plus')).toBe(spriteFor('plus'));
  });
});
