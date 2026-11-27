/** the faint line along each cell's top and left edge: it tints a square and vanishes on the white page */
const LINE = 'rgba(255, 255, 255, 0.3)';

export interface GridLayer {
  /** lays the layer over the canvas again, at this cell size */
  fit(cell: number): void;
  remove(): void;
}

/**
 * A faint grid over a pixel canvas, as one static layer laid out by the browser, so no frame draws anything extra.
 * It takes the canvas's own styles, so it follows its size, place and flip. The canvas must be in the document and
 * its cells must start at its top left.
 */
export function gridLayer(canvas: HTMLCanvasElement): GridLayer {
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.setAttribute('data-px', 'grid');
  canvas.parentElement!.appendChild(layer);
  return {
    fit(cell) {
      const stops = `${LINE} 0 1px, transparent 1px ${cell}px`;
      layer.style.cssText = `${canvas.style.cssText};background-image:repeating-linear-gradient(to right, ${stops}),repeating-linear-gradient(to bottom, ${stops})`;
    },
    remove: () => layer.remove(),
  };
}
