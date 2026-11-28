// Wave: a field's surface as a strip of water. A pointer just outside the surface presses it in, and moving along it
// pushes a wake; the dent runs out both ways as waves and settles. Pure: the mount (surface-waves.ts) steps it and reads
// it into the field's shape. Heights are in rows, counted away from the field's anchored edge, so a press is always
// negative: it pushes the hero's hanging edge up and the footer's surface down.

/** ms of one simulation step: the waves are tuned at about 143 steps a second, whatever the display's refresh rate */
export const WAVE_STEP_MS = 7;
/** rows the surface may move either way */
export const MAX_ROWS = 6;
/** how far outside the surface (rows) the pointer still presses it, and how far inside */
const REACH_OUT = 5;
const REACH_IN = 3;
/** columns either side of the pointer a press reaches */
const PRESS_SPAN = 3;
/** a still pointer presses a little; speed (px per ms) adds a wake */
const PRESS_REST = 0.035;
const PRESS_SPEED = 0.16;
const MAX_SPEED = 1.5;
/** how hard neighbours pull on each other, how hard the surface springs back to calm, and the damping per step */
const TENSION = 0.22;
const SPRING = 0.012;
const DAMPING = 0.982;
/** a crest rising this fast (rows per step) is a splash */
const SPLASH_SPEED = 0.55;
/** a crest this high, swinging back this fast, sheds a drop; then the columns around it rest this long */
const SHED_HEIGHT = 1.5;
const SHED_SPEED = 0.6;
const SHED_SPAN = 6;
const SHED_REST_MS = 1500;
/** degrees a mascot tilts per row of slope under it, at most MAX_TILT */
const TILT_PER_ROW = 6;
const MAX_TILT = 14;

export interface SurfaceWave {
  height: Float32Array;
  velocity: Float32Array;
  /** ms until which each column sheds no drop */
  restUntil: Float32Array;
}

export function createWave(columns: number): SurfaceWave {
  return {
    height: new Float32Array(columns),
    velocity: new Float32Array(columns),
    restUntil: new Float32Array(columns),
  };
}

/**
 * The pointer at `column`, `outside` rows past the surface (negative: inside the lava), moving at `speed` px per ms.
 * Pushes the surface in around it; too far either side of the surface, it does nothing.
 */
export function pressWave(wave: SurfaceWave, column: number, outside: number, speed: number): void {
  if (outside <= -REACH_IN || outside >= REACH_OUT) return;
  const close = 1 - Math.abs(outside - 1) / REACH_OUT;
  const push = (PRESS_REST + Math.min(MAX_SPEED, speed) * PRESS_SPEED) * close;
  const centre = Math.round(column);
  for (let dx = -PRESS_SPAN; dx <= PRESS_SPAN; dx++) {
    const x = centre + dx;
    if (x < 0 || x >= wave.height.length) continue;
    wave.velocity[x] -= push * (1 - Math.abs(dx) / (PRESS_SPAN + 1));
  }
}

/** one WAVE_STEP_MS step: each column is pulled toward its neighbours and back toward calm */
export function stepWave(wave: SurfaceWave): void {
  const { height, velocity } = wave;
  const n = height.length;
  for (let x = 0; x < n; x++) {
    const left = x > 0 ? height[x - 1] : height[x],
      right = x < n - 1 ? height[x + 1] : height[x];
    velocity[x] = (velocity[x] + TENSION * (left + right - 2 * height[x]) - SPRING * height[x]) * DAMPING;
  }
  for (let x = 0; x < n; x++) height[x] = Math.max(-MAX_ROWS, Math.min(MAX_ROWS, height[x] + velocity[x]));
}

/** true while any column still moves enough to see */
export function waveMoving(wave: SurfaceWave): boolean {
  for (let x = 0; x < wave.height.length; x++)
    if (Math.abs(wave.height[x]) > 0.02 || Math.abs(wave.velocity[x]) > 0.02) return true;
  return false;
}

/**
 * Columns where a crest swings back hard enough to shake a drop loose at `now` ms: the top of each such crest,
 * after which the columns around it rest for a while.
 */
export function shedColumns(wave: SurfaceWave, now: number): number[] {
  const { height, velocity, restUntil } = wave;
  const shed: number[] = [];
  for (let x = 1; x < height.length - 1; x++) {
    if (now < restUntil[x] || height[x] < SHED_HEIGHT || velocity[x] < SHED_SPEED) continue;
    if (velocity[x] < velocity[x - 1] || velocity[x] < velocity[x + 1]) continue;
    for (let k = Math.max(0, x - SHED_SPAN); k <= Math.min(height.length - 1, x + SHED_SPAN); k++)
      restUntil[k] = now + SHED_REST_MS;
    shed.push(x);
  }
  return shed;
}

export interface WaveUnder {
  /** whole rows the highest crest under the span stands above calm; never negative */
  lift: number;
  /** degrees, following the slope from the span's left end to its right */
  tilt: number;
  /** a crest under the span is rising fast */
  splash: boolean;
}

export const CALM: WaveUnder = { lift: 0, tilt: 0, splash: false };

/** how the wave stands under columns `from`..`to` (fractions allowed), e.g. under a mascot's feet */
export function waveUnder(wave: SurfaceWave, from: number, to: number): WaveUnder {
  const n = wave.height.length;
  const a = Math.max(0, Math.floor(from)),
    b = Math.min(n - 1, Math.ceil(to));
  if (b <= a) return CALM;
  let top = 0,
    splash = false;
  for (let x = a; x <= b; x++) {
    top = Math.max(top, wave.height[x]);
    if (wave.velocity[x] > SPLASH_SPEED) splash = true;
  }
  const slope = wave.height[b] - wave.height[a];
  return {
    lift: Math.floor(top * 2) / 2,
    tilt: Math.round(Math.max(-MAX_TILT, Math.min(MAX_TILT, slope * TILT_PER_ROW))),
    splash,
  };
}
