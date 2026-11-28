// The Wave's input on touch, where nothing hovers: a tap near a surface drops into the water there, and the page
// sloshes the water when its scrolling speeds up or slows down. Steady scrolling leaves it calm; a fling that lands
// at the bottom splashes the footer up.
import { sloshWave, tapWave } from './surface-wave';
import { pointOnField, type MountWaveInput } from './surface-waves';
import type { HeroField } from './hero-field';

/** the scroll speed (px per ms) eases toward each frame's this much, so finger jitter does not slosh */
const SPEED_EASE = 0.5;
/** a change in scroll speed under this (px per ms, per frame) is ignored */
const SLOSH_MIN = 0.15;
/** rows per step of slosh for each px per ms the scroll speed changes */
const SLOSH_GAIN = 0.12;
/** ms after the last scroll event the input keeps watching the speed settle */
const SETTLE_MS = 200;

export const touchInput: MountWaveInput = (wake) => {
  let taps: Array<{ x: number; y: number }> = [];
  let lastY = window.scrollY,
    lastTime = 0,
    speed = 0,
    scrolledAt = -Infinity;
  /** this frame's taps and slosh, given to each field on its first step of the frame */
  let jolt = 0,
    phase = 0,
    frameTaps: Array<{ x: number; y: number }> = [],
    frameId = 0;
  const given = new Map<HeroField, number>();

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    taps.push({ x: e.clientX, y: e.clientY });
    wake();
  };
  const onScroll = () => {
    scrolledAt = performance.now();
    wake();
  };
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });

  return {
    frame(now) {
      const elapsed = lastTime ? now - lastTime : 16;
      lastTime = now;
      const raw = (window.scrollY - lastY) / Math.max(1, elapsed);
      lastY = window.scrollY;
      const eased = speed + (raw - speed) * SPEED_EASE;
      const change = eased - speed;
      speed = eased;
      jolt = Math.abs(change) > SLOSH_MIN ? change : 0;
      phase = now / 300;
      frameTaps = taps;
      taps = [];
      frameId++;
    },
    step(field, wave) {
      if ((!jolt && !frameTaps.length) || given.get(field) === frameId) return;
      given.set(field, frameId);
      const rect = field.rect();
      // the water moves against the page's change of speed: a page speeding up leaves it behind, one stopping
      // throws it on; rows count away from each field's anchored edge, so the flipped footer takes it the other way
      if (jolt && rect.bottom > 0 && rect.top < window.innerHeight)
        sloshWave(wave, (field.flipped ? -1 : 1) * jolt * SLOSH_GAIN, phase);
      for (const tap of frameTaps) {
        const { column, outside } = pointOnField(field, tap.x, tap.y);
        tapWave(wave, column, outside);
      }
    },
    busy(now) {
      if (now - scrolledAt < SETTLE_MS || Math.abs(speed) > 0.05) return true;
      lastTime = 0;
      speed = 0;
      return false;
    },
    stop() {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', onScroll);
    },
  };
};
