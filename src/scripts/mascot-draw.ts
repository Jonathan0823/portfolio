// Draws a footer mascot or a bit of lava on the mascots' canvas. The canvas stands on the footer field's own grid: x grows
// right from the host's left edge, and heights are counted up from the host's bottom, so a half cell is a whole number
// of px. The lava hides whatever is below its surface, which is how a sinking mascot goes under.
import type { Pose } from './mascot-motion';
import type { Drawn } from './mascot-particles';
import type { MascotSprite, Rect } from './mascot-sprites';

export interface View {
  /** px per field cell */
  cell: number;
  /** the row the word stands on (after the footer's lava has dropped), and the lava's depth against its feet, in rows */
  base: number;
  wade: number;
  /** px height of the canvas */
  height: number;
}

/** px above the host's bottom to a sprite's lowest point */
const feetPx = (v: View, pose: Pose) => v.base * v.cell + (pose.F * v.cell) / 2;
/** px above the host's bottom to the lava's surface against the letters' feet */
const lavaPx = (v: View) => (v.base + v.wade + 1) * v.cell;

/** one mascot, its feet at `pose`; `blink` closes Clawd's eyes */
export function drawMascot(
  ctx: CanvasRenderingContext2D,
  sprite: MascotSprite,
  pose: Pose,
  v: View,
  blink: boolean,
): void {
  const unit = v.cell / 2;
  const bottom = v.height - feetPx(v, pose);
  const surface = v.height - lavaPx(v);
  if (surface <= 0) return;
  ctx.save();
  // everything under the lava's surface is hidden
  ctx.beginPath();
  ctx.rect(0, 0, ctx.canvas.width, surface);
  ctx.clip();
  ctx.translate(pose.P * unit + (sprite.width * unit) / 2, bottom);
  if (pose.tilt) ctx.rotate((pose.tilt * Math.PI) / 180);
  ctx.scale(pose.sx, pose.sy);
  const fill = (r: Rect) => {
    ctx.fillStyle = r.color;
    ctx.fillRect(r.x * unit - (sprite.width * unit) / 2, (r.y - sprite.height) * unit, r.w * unit, r.h * unit);
  };
  sprite.body.forEach(fill);
  (sprite.legs[pose.leg] ?? []).forEach(fill);
  if (blink) [...sprite.lids, ...sprite.squint].forEach(fill);
  else sprite.eyes.forEach(fill);
  ctx.restore();
}

/** a particle: one field cell scaled about its middle */
export function drawParticle(ctx: CanvasRenderingContext2D, d: Drawn, v: View): void {
  const px = d.size * v.cell;
  ctx.globalAlpha = d.alpha;
  ctx.fillStyle = d.color;
  ctx.fillRect(d.x * v.cell + (v.cell - px) / 2, v.height - (d.y + 1) * v.cell + (v.cell - px) / 2, px, px);
  ctx.globalAlpha = 1;
}

/** whether the point (px from the canvas's left, px from its top) is on a mascot with its feet at `pose`, give or take `slop` px */
export function hits(sprite: MascotSprite, pose: Pose, v: View, x: number, y: number, slop: number): boolean {
  const unit = v.cell / 2;
  const bottom = v.height - feetPx(v, pose);
  const left = pose.P * unit;
  return (
    x >= left - slop &&
    x <= left + sprite.width * unit + slop &&
    y >= bottom - sprite.height * unit - slop &&
    y <= bottom + slop
  );
}
