// Frame-rate independence helpers. No DOM access here.

/** One frame at 60 fps, the rate the original easing constants were tuned for. */
export const REFERENCE_FRAME_MS = 1000 / 60;
const MAX_ELAPSED_MS = 100;

/** Elapsed time as a multiple of one 60 fps frame; clamped so a stalled tab cannot cause a jump. */
export function frameScale(elapsedMs: number): number {
  if (!(elapsedMs > 0)) return 0;
  return Math.min(elapsedMs, MAX_ELAPSED_MS) / REFERENCE_FRAME_MS;
}

/** Easing factor k per 60 fps frame, rescaled to `scale` frames. */
export function easeFactor(k: number, scale: number): number {
  return 1 - Math.pow(1 - k, scale);
}

/** Per-frame decay multiplier (for example 0.94) rescaled to `scale` frames. */
export function decayFactor(perFrame: number, scale: number): number {
  return Math.pow(perFrame, scale);
}

export interface Velocity {
  x: number;
  y: number;
}

/**
 * Eases the smoothed velocity toward the latest step (both in px per 60 fps frame).
 * When the step opposes the smoothed velocity, the smoothing restarts from the step so the
 * velocity never passes through zero on a reversal.
 */
export function smoothVelocity(smooth: Velocity, step: Velocity, k: number, scale: number): Velocity {
  const opposes = smooth.x * step.x + smooth.y * step.y < 0;
  if (opposes && Math.hypot(step.x, step.y) > 1) return { x: step.x, y: step.y };
  const e = easeFactor(k, scale);
  return { x: smooth.x + (step.x - smooth.x) * e, y: smooth.y + (step.y - smooth.y) * e };
}
