// Wave, mounted: the hero's and the footer's surfaces move like water under a hovering mouse. This is the thin driver:
// it tracks the pointer, steps each field's wave model (surface-wave.ts), shakes drops loose from the hero's hanging
// edge, and hands both to the field's shape each frame. It runs only while something moves.
import type { HeroField } from './hero-field';
import type { FieldShape } from './pixel-math';
import { FALL_MS, placeDrop, type LooseDrop, type PlacedDrop } from './loose-drops';
import {
  CALM,
  WAVE_STEP_MS,
  createWave,
  pressWave,
  shedColumns,
  stepWave,
  waveMoving,
  waveUnder,
  type SurfaceWave,
  type WaveUnder,
} from './surface-wave';

/** rows a shaken drop falls, and the share of the hero's rows it never passes (the runoff's floor, above the headline) */
const SHED_FALL = 10;
const FLOOR_SHARE = 0.84;
/** the pointer's speed eases toward each move's speed this much, and fades by this per frame once moves stop */
const SPEED_EASE = 0.35;
const SPEED_FADE = 0.8;
/** ms without a move before the speed starts fading; moves further apart than MOVE_GAP_MS give no speed */
const STILL_MS = 60;
const MOVE_GAP_MS = 100;
/** steps a single frame may catch up on, so a stalled tab does not slosh the water all at once */
const MAX_STEPS = 4;

export interface SurfaceWaves {
  /** the wave and loose drops for this field's shape this frame */
  shape(field: HeroField): Pick<FieldShape, 'wave' | 'loose'>;
  /** how the field's water stands under columns from..to */
  under(field: HeroField, from: number, to: number): WaveUnder;
  stop(): void;
}

interface Surface {
  wave: SurfaceWave;
  loose: LooseDrop[];
}

/** mounts waves on these fields; for a hovering mouse only, as the pointer is what moves them */
export function mountSurfaceWaves(fields: HeroField[]): SurfaceWaves {
  const surfaces = new Map<HeroField, Surface>(fields.map((f) => [f, { wave: createWave(0), loose: [] }]));
  const pointer = { x: 0, y: 0, inside: false, speed: 0, time: 0 };
  let raf = 0,
    last = 0,
    carry = 0;

  /** the wave for the field's current width: a resize starts it calm */
  const fit = (field: HeroField, s: Surface) => {
    const columns = field.field().columns;
    if (s.wave.height.length !== columns) s.wave = createWave(columns);
    return s.wave;
  };

  const press = (field: HeroField, wave: SurfaceWave) => {
    const f = field.field();
    const rect = field.rect();
    const column = (pointer.x - rect.left) / f.cellSize;
    if (column < -f.columns || column > 2 * f.columns) return;
    // rows count away from the anchored edge: down from the hero's top, up from the flipped footer's bottom
    const row = (field.flipped ? rect.bottom - pointer.y : pointer.y - rect.top) / f.cellSize;
    const at = Math.max(0, Math.min(f.columns - 1, Math.round(column)));
    pressWave(wave, column, row - f.surface[at], pointer.speed);
  };

  /** the hero's edge hangs down: a crest swinging back hard drops a bead of lava */
  const shed = (field: HeroField, s: Surface, now: number) => {
    const f = field.field();
    const floor = Math.floor(f.hostRows * FLOOR_SHARE);
    for (const x of shedColumns(s.wave, now)) {
      const from = Math.floor(Math.min(f.surface[x], f.surface[x + 1]));
      const to = Math.min(from + SHED_FALL, floor);
      if (to > from) s.loose.push({ column: x, from, to, born: now });
    }
  };

  const frame = (now: number) => {
    raf = 0;
    if (now - pointer.time > STILL_MS) pointer.speed *= SPEED_FADE;
    carry += last ? now - last : WAVE_STEP_MS;
    last = now;
    const steps = Math.min(MAX_STEPS, Math.floor(carry / WAVE_STEP_MS));
    carry = steps === MAX_STEPS ? 0 : carry - steps * WAVE_STEP_MS;
    let busy = false;
    for (const [field, s] of surfaces) {
      const wave = fit(field, s);
      for (let i = 0; i < steps; i++) {
        if (pointer.inside) press(field, wave);
        stepWave(wave);
      }
      if (!field.flipped) shed(field, s, now);
      s.loose = s.loose.filter((d) => now - d.born < FALL_MS);
      busy ||= waveMoving(wave) || s.loose.length > 0;
    }
    if (busy) raf = requestAnimationFrame(frame);
    else last = carry = 0;
  };
  const wake = () => {
    if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const gap = e.timeStamp - pointer.time;
    if (pointer.inside && gap > 0 && gap < MOVE_GAP_MS) {
      const speed = Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) / gap;
      pointer.speed += (speed - pointer.speed) * SPEED_EASE;
    }
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.time = e.timeStamp;
    pointer.inside = true;
    wake();
  };
  const onLeave = () => {
    pointer.inside = false;
    pointer.speed = 0;
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);
  window.addEventListener('blur', onLeave);

  return {
    shape(field) {
      const s = surfaces.get(field);
      if (!s) return {};
      const now = performance.now();
      const loose = s.loose.map((d) => placeDrop(d, now)).filter((d): d is PlacedDrop => d !== null);
      return { wave: fit(field, s).height, loose };
    },
    under(field, from, to) {
      const s = surfaces.get(field);
      return s ? waveUnder(fit(field, s), from, to) : CALM;
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('blur', onLeave);
    },
  };
}
