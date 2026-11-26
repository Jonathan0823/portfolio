import { HEAT_PALETTE, hash } from './pixel-math';
import { FEEDBACK_CELL, chargeAt, clampLevel, moteRadius } from './cursor-math';
import { createOverlay } from './pixel-overlay';
import type { PixelPointer } from './pixel-pointer';

/** half-size in cells of the canvas the motes and halo live on */
const REACH_CELLS = 18;
const MOTES = 10;
/** the scatter on cancel, ms */
const DEFLATE_MS = 150;
/** where the arrow's visual centre sits from its tip, in feedback cells, at full charge: the halo's centre */
const HALO_X = 3;
const HALO_Y = 5;

export interface ChargeResult {
  /** ms the button was held */
  held: number;
  /** 0..1 at the moment of release; 0 when cancelled */
  charge: number;
  /** a text selection began or the pointer left the window: the release must do nothing */
  cancelled: boolean;
}

export interface Charger {
  /** ends the charge; a tap (held under TAP_MS) comes back with charge 0, which fires a plain shockwave */
  release(): ChargeResult;
  /** deflate the pointer and scatter the motes; the eventual release does nothing */
  cancel(): void;
  /** drop everything this instant */
  dispose(): void;
}

interface Mote {
  /** which way it comes in from, relative to the pointer */
  angle: number;
  /** 0 = just spawned, 1 = arrived */
  progress: number;
  speed: number;
  seen: boolean;
  /** last drawn offset from the pointer in cells, so a cancel can scatter from where it was */
  ox: number;
  oy: number;
}

/**
 * Hold-to-charge, drawn around the pointer: it grows and heats through the palette, motes are pulled in,
 * and at full charge it jitters and pulses. `at` reads the live pointer every frame, so moving while held
 * drags the whole charge along: motes are stored relative to the pointer and trail in toward wherever it is now.
 */
export function startCharge(pointer: PixelPointer, at: () => { x: number; y: number }): Charger {
  const start = performance.now();
  const size = REACH_CELLS * 2 * FEEDBACK_CELL;
  const first = at();
  const overlay = createOverlay(first.x, first.y, size);
  const { ctx, plot } = overlay;
  let serial = 0;
  const motes: Mote[] = Array.from({ length: MOTES }, (_, i) => ({
    angle: hash(i, 1, 11) * Math.PI * 2,
    progress: hash(i, 2, 11),
    speed: 0.7 + hash(i, 3, 11) * 0.6,
    seen: false,
    ox: 0,
    oy: 0,
  }));
  let raf = 0,
    last = start,
    charge = 0,
    state: 'live' | 'deflate' | 'dead' = 'live',
    cancelAt = 0,
    cancelFrom = 0,
    jitterAt = 0,
    jitterX = 0,
    jitterY = 0;

  const end = () => {
    state = 'dead';
    cancelAnimationFrame(raf);
    overlay.remove();
    pointer.setCharge(0);
  };

  const step = (now: number) => {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const p = at();
    overlay.place(p.x, p.y);
    const { cx, cy } = overlay;
    ctx.clearRect(0, 0, size, size);
    if (state === 'live') {
      charge = chargeAt(now - start);
      if (charge >= 1 && now - jitterAt > 45) {
        // whole-pixel jitter every few frames reads as a shudder, not a blur
        jitterAt = now;
        jitterX = Math.round(hash(now, 1, 21) * 2 - 1);
        jitterY = Math.round(hash(now, 2, 21) * 2 - 1);
      }
      pointer.setCharge(charge, charge >= 1 ? jitterX : 0, charge >= 1 ? jitterY : 0);
      if (charge > 0) {
        const active = 6 + Math.round(4 * charge);
        for (let i = 0; i < active; i++) {
          const m = motes[i];
          m.progress += dt * m.speed * (0.6 + 2.4 * charge);
          if (m.progress >= 1) {
            m.progress -= 1;
            m.angle = hash(i, ++serial, 12) * Math.PI * 2;
          }
          const r = moteRadius(m.progress);
          m.ox = Math.cos(m.angle) * r;
          m.oy = Math.sin(m.angle) * r;
          m.seen = true;
          plot(
            cx + Math.round(m.ox),
            cy + Math.round(m.oy),
            HEAT_PALETTE[clampLevel(1 + charge * 3 + m.progress * 1.5)],
          );
        }
        if (charge >= 1) {
          // maxed: a dotted one-cell halo pulses in and out around the arrow
          const pulse = Math.sin((now - start) / 90) * 0.5 + 0.5;
          const radius = 6 + Math.round(pulse);
          for (let gy = -radius - 1; gy <= radius + 1; gy++) {
            for (let gx = -radius - 1; gx <= radius + 1; gx++) {
              if (Math.abs(Math.hypot(gx, gy) - radius) > 0.5 || (gx + gy) % 2 !== 0) continue;
              plot(cx + HALO_X + gx, cy + HALO_Y + gy, HEAT_PALETTE[pulse > 0.5 ? 5 : 4]);
            }
          }
        }
      }
    } else if (state === 'deflate') {
      const u = Math.min(1, (now - cancelAt) / DEFLATE_MS);
      pointer.setCharge(cancelFrom * (1 - u));
      // motes scatter outward from where they were, and fade
      ctx.globalAlpha = 1 - u;
      for (const m of motes) {
        if (!m.seen) continue;
        const k = 1 + u * 2.5;
        plot(
          cx + Math.round(m.ox * k + Math.cos(m.angle) * u * 6),
          cy + Math.round(m.oy * k + Math.sin(m.angle) * u * 6),
          HEAT_PALETTE[2],
        );
      }
      ctx.globalAlpha = 1;
      if (u >= 1) return end();
    }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);

  return {
    release() {
      const now = performance.now();
      const held = now - start;
      const cancelled = state !== 'live';
      const result: ChargeResult = { held, charge: cancelled ? 0 : chargeAt(held), cancelled };
      // a charged pointer snaps back to normal size with the pop overshoot
      if (!cancelled && result.charge > 0) pointer.pop();
      end();
      return result;
    },
    cancel() {
      if (state !== 'live') return;
      state = 'deflate';
      cancelAt = performance.now();
      cancelFrom = charge;
    },
    dispose: end,
  };
}
