/** extra px a solid square overlaps its neighbour, so fractional screen scaling leaves no hairline */
const OVERLAP = 0.5;

/** Paints one square of a pixel field, its top left at (x, y). Squares touch; `alpha` under 1 makes a soft edge. */
export function paintCell(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, alpha = 1): void {
  ctx.globalAlpha = alpha;
  // a see-through square must not overlap, or the seam would show darker
  const size = alpha < 1 ? cell : cell + OVERLAP;
  ctx.fillRect(x, y, size, size);
}
