import { PALETTE, createField, stepField, type Field } from './pixel-math';

export interface HeroField {
  canvas: HTMLCanvasElement;
  field(): Field;
  /** animation time, shared with the other effects; stays 0 under reduced motion */
  time(): number;
  /** bounding box in viewport coordinates */
  rect(): DOMRect;
  markDirty(): void;
  resize(): void;
  setReduced(reduced: boolean): void;
  destroy(): void;
}

const SEED = 1.3;
const FRAME_MS = 50; // about 20 fps, like the original design

/**
 * Mounts the hero pixel field into a fixed-size host element. The host keeps its size
 * before this runs, so nothing shifts. The loop only runs while the canvas is on screen
 * and the tab is visible; under reduced motion it draws one static frame.
 */
export function mountHeroField(host: HTMLElement, reduced: boolean): HeroField {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('data-px', 'field');
  canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none';
  host.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;
  let field = createField(1, 1);
  let t = 0, last = 0, raf = 0, dirty = true, visible = true;

  const wants = () => visible && !document.hidden && (dirty || !reduced || field.hot > 0.01);

  const paint = () => {
    dirty = false;
    if (!reduced) t += 0.02;
    stepField(field, t, SEED);
    ctx.clearRect(0, 0, field.w, field.h);
    const { C, R, cs, bucket } = field;
    for (let k = 0; k < PALETTE.length; k++) {
      ctx.fillStyle = PALETTE[k];
      for (let i = 0; i < C * R; i++) {
        if (bucket[i] === k) ctx.fillRect((i % C) * cs + 1, Math.floor(i / C) * cs + 1, cs - 1, cs - 1);
      }
    }
  };

  const frame = (now: number) => {
    raf = 0;
    if (!wants()) return;
    if (dirty || now - last >= FRAME_MS) {
      last = now;
      paint();
    }
    if (wants()) raf = requestAnimationFrame(frame);
  };
  const schedule = () => {
    if (!raf && wants()) raf = requestAnimationFrame(frame);
  };

  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    field = createField(w, h);
    dirty = true;
    schedule();
  };

  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver(es => {
        visible = es[es.length - 1].isIntersecting;
        schedule();
      })
    : null;
  io?.observe(canvas);
  const ro = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
  ro?.observe(host);
  const onVisibility = () => schedule();
  document.addEventListener('visibilitychange', onVisibility);
  resize();

  return {
    canvas,
    field: () => field,
    time: () => t,
    rect: () => canvas.getBoundingClientRect(),
    markDirty() {
      dirty = true;
      schedule();
    },
    resize,
    setReduced(r) {
      reduced = r;
      if (r) t = 0;
      dirty = true;
      schedule();
    },
    destroy() {
      cancelAnimationFrame(raf);
      raf = 0;
      io?.disconnect();
      ro?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.remove();
    },
  };
}
