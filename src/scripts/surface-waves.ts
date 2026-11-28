// Wave, mounted: the hero's and the footer's surfaces move like water. This is the thin driver: it steps each field's
// wave model (surface-wave.ts), lets inputs (a hovering mouse, or taps and scrolling on touch) push the water, shakes
// drops loose from the hero's hanging edge, and hands both to the field's shape each frame. It runs only while
// something moves.
import type { HeroField } from './hero-field';
import type { FieldShape } from './pixel-math';
import { FALL_MS, placeDrop, type LooseDrop, type PlacedDrop } from './loose-drops';
import {
  CALM,
  WAVE_STEP_MS,
  createWave,
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
/** steps a single frame may catch up on (a dropped 30 fps frame), so a stalled tab does not slosh the water all at once */
const MAX_STEPS = 8;

export interface SurfaceWaves {
  /** the wave and loose drops for this field's shape this frame */
  shape(field: HeroField): Pick<FieldShape, 'wave' | 'loose'>;
  /** how the field's water stands under columns from..to */
  under(field: HeroField, from: number, to: number): WaveUnder;
  stop(): void;
}

/** What pushes the water. The driver calls it every frame while the water moves or it is busy. */
export interface WaveInput {
  /** once a frame, before the steps */
  frame?(now: number): void;
  /** before each step, for each field */
  step?(field: HeroField, wave: SurfaceWave): void;
  /** keeps the driver running on calm water, e.g. while the pointer rests on a surface */
  busy?(now: number): boolean;
  stop(): void;
}

/** an input, mounted with the driver's wake (call it when there is something new to push with) */
export type MountWaveInput = (wake: () => void) => WaveInput;

/** several inputs as one: each gets every call, and the driver stays busy while any of them is */
export function combineInputs(...mounts: MountWaveInput[]): MountWaveInput {
  return (wake) => {
    const inputs = mounts.map((mount) => mount(wake));
    return {
      frame(now) {
        for (const input of inputs) input.frame?.(now);
      },
      step(field, wave) {
        for (const input of inputs) input.step?.(field, wave);
      },
      busy(now) {
        // every input sees the call, even after one already says busy: busy() may also settle its own state
        let busy = false;
        for (const input of inputs) busy = (input.busy?.(now) ?? false) || busy;
        return busy;
      },
      stop() {
        for (const input of inputs) input.stop();
      },
    };
  };
}

/** a viewport point against a field: its column, and how many rows it is outside the surface there (negative: inside) */
export function pointOnField(field: HeroField, x: number, y: number): { column: number; outside: number } {
  const f = field.field();
  const rect = field.rect();
  const column = (x - rect.left) / f.cellSize;
  // rows count away from the anchored edge: down from the hero's top, up from the flipped footer's bottom
  const row = (field.flipped ? rect.bottom - y : y - rect.top) / f.cellSize;
  const at = Math.max(0, Math.min(f.columns - 1, Math.round(column)));
  return { column, outside: row - f.surface[at] };
}

interface Surface {
  wave: SurfaceWave;
  loose: LooseDrop[];
}

/** mounts waves on these fields, moved by `mountInput` */
export function mountSurfaceWaves(fields: HeroField[], mountInput: MountWaveInput): SurfaceWaves {
  const surfaces = new Map<HeroField, Surface>(fields.map((f) => [f, { wave: createWave(0), loose: [] }]));
  let raf = 0,
    last = 0,
    carry = 0;

  /** the wave for the field's current width: a resize starts it calm */
  const fit = (field: HeroField, s: Surface) => {
    const columns = field.field().columns;
    if (s.wave.height.length !== columns) s.wave = createWave(columns);
    return s.wave;
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
    input.frame?.(now);
    carry += last ? now - last : WAVE_STEP_MS;
    last = now;
    const steps = Math.min(MAX_STEPS, Math.floor(carry / WAVE_STEP_MS));
    carry = steps === MAX_STEPS ? 0 : carry - steps * WAVE_STEP_MS;
    let busy = input.busy?.(now) ?? false;
    for (const [field, s] of surfaces) {
      const wave = fit(field, s);
      for (let i = 0; i < steps; i++) {
        input.step?.(field, wave);
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

  const input = mountInput(wake);

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
      input.stop();
    },
  };
}
