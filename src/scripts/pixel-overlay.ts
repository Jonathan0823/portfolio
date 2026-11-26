import { FEEDBACK_CELL } from './cursor-math';

export interface Overlay {
  ctx: CanvasRenderingContext2D;
  /** the grid cell the anchor point sits in; changes when `place` moves the overlay */
  cx: number;
  cy: number;
  /** fills grid cell (gx, gy), `w` cells wide */
  plot(gx: number, gy: number, color: string, w?: number): void;
  /** re-centres on a point, snapped to the page-wide feedback grid so every cell lines up with the click cell */
  place(x: number, y: number): void;
  remove(): void;
}

/** A square pixel-art canvas of `size` px centred on (x, y), above the page and below the pointer. */
export function createOverlay(x: number, y: number, size: number): Overlay {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;pointer-events:none;z-index:9997`;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const overlay: Overlay = {
    ctx,
    cx: 0,
    cy: 0,
    plot(gx, gy, color, w = 1) {
      ctx.fillStyle = color;
      ctx.fillRect(gx * FEEDBACK_CELL, gy * FEEDBACK_CELL, FEEDBACK_CELL * w, FEEDBACK_CELL * w);
    },
    place(px, py) {
      const left = Math.floor((px - size / 2) / FEEDBACK_CELL) * FEEDBACK_CELL,
        top = Math.floor((py - size / 2) / FEEDBACK_CELL) * FEEDBACK_CELL;
      canvas.style.transform = `translate(${left}px,${top}px)`;
      overlay.cx = Math.floor((px - left) / FEEDBACK_CELL);
      overlay.cy = Math.floor((py - top) / FEEDBACK_CELL);
    },
    remove: () => canvas.remove(),
  };
  overlay.place(x, y);
  return overlay;
}
