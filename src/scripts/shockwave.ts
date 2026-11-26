import { HEAT_PALETTE, hash } from './pixel-math';
import { FEEDBACK_CELL, clampLevel, shockwaveShape } from './cursor-math';
import { createOverlay } from './pixel-overlay';

/**
 * The click shockwave: a pixel ring with spokes that shoot ahead of it and snap back, on the 4px feedback grid.
 * A tap is charge 0; a held release passes its charge. Nothing persists: the canvas removes itself when it ends.
 */
export function spawnShockwave(x: number, y: number, strong: boolean, charge = 0): void {
  const shape = shockwaveShape(charge, strong);
  const size = (Math.ceil(shape.maxR) + 10) * 2 * FEEDBACK_CELL;
  const overlay = createOverlay(x, y, size);
  const { ctx, cx, cy, plot } = overlay;
  // the seed makes each click's dither different but repeatable per position
  const seed = Math.floor(x * 7 + y * 13);
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / shape.durationMs);
    ctx.clearRect(0, 0, size, size);
    const out = 1 - (1 - t) ** 3;
    const radius = shape.maxR * out;
    const thick = shape.thickness * (1 - t * 0.45);
    const reach = Math.ceil(radius + thick + 1);
    // the ring thins out as it ages
    const keep = 1 - t * t * 0.9;
    for (let gy = -reach; gy <= reach; gy++) {
      for (let gx = -reach; gx <= reach; gx++) {
        const d = Math.hypot(gx, gy);
        if (Math.abs(d - radius) > thick / 2 || hash(gx, gy, seed) > keep) continue;
        // hot at the leading edge, cooling behind it and with age
        const u = (d - (radius - thick / 2)) / thick;
        plot(cx + gx, cy + gy, HEAT_PALETTE[clampLevel(1 + u * 4 - t * 1.2)]);
      }
    }
    const ts = t / 0.6;
    if (ts < 1) {
      const head = shape.spokeReach * (1 - (1 - ts) * (1 - ts));
      const tail = head - shape.spokeLength * (1 - ts * ts);
      for (let i = 0; i < shape.spokes; i++) {
        const angle = (i / shape.spokes) * Math.PI * 2;
        for (let dist = Math.max(0, tail); dist <= head; dist += 0.5) {
          plot(
            cx + Math.round(Math.cos(angle) * dist),
            cy + Math.round(Math.sin(angle) * dist),
            HEAT_PALETTE[dist > head - 1 ? 5 : 4],
          );
        }
      }
    }
    if (shape.full && t < 0.25) {
      for (let gy = -2; gy <= 2; gy++) {
        for (let gx = -2; gx <= 2; gx++) {
          plot(cx + gx, cy + gy, Math.abs(gx) < 2 && Math.abs(gy) < 2 ? '#FFFFFF' : HEAT_PALETTE[5]);
        }
      }
    }
    if (t < 1) requestAnimationFrame(step);
    else overlay.remove();
  };
  requestAnimationFrame(step);
}
