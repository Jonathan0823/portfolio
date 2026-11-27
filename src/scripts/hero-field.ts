import { HEAT_PALETTE, createField, stepField, type Field, type FieldShape } from './pixel-math';
import { decayFactor } from './timing';
import { paintCell } from './field-paint';

export interface HeroField {
  canvas: HTMLCanvasElement;
  field(): Field;
  time(): number;
  /** the field's noise seed, for anything that has to match its colours */
  seed: number;
  rect(): DOMRect;
  flipped: boolean;
  markDirty(): void;
  resize(): void;
  setReduced(reduced: boolean): void;
  destroy(): void;
}

const SEED = 1.3;
const STEP_MS = 50;
const MIN_FRAME_MS = 1000 / 60 - 2;
const TIME_STEP = 0.02;
const HEAT_DECAY = 0.965;
const MAX_ELAPSED_MS = 200;

export function mountHeroField(
  host: HTMLElement,
  reduced: boolean,
  options: {
    seed?: number;
    flipped?: boolean;
    /** the outline for this frame; `motion` is false under reduced motion */
    shape?: (motion: boolean) => FieldShape;
    /** px the canvas reaches past the host, behind the content; heat shows there */
    bleed?: number;
  } = {},
): HeroField {
  const seed = options.seed ?? SEED;
  const flipped = !!options.flipped;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('data-px', 'field');
  canvas.style.cssText = `display:block;width:100%;height:100%;pointer-events:none${flipped ? ';transform:scaleY(-1)' : ''}`;
  const bleed = options.bleed ?? 0;
  if (bleed) {
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    canvas.style.cssText += `;position:absolute;left:0;${flipped ? 'bottom' : 'top'}:0;height:calc(100% + ${bleed}px);z-index:-1`;
  }
  host.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;
  let field = createField(1, 1);
  let t = 0,
    last = 0,
    raf = 0,
    dirty = true,
    visible = true;
  const wants = () => visible && !document.hidden && (dirty || !reduced || field.hottest > 0.01);

  const paint = (elapsed: number) => {
    dirty = false;
    const steps = Math.min(Math.max(elapsed, 0), MAX_ELAPSED_MS) / STEP_MS;
    if (!reduced) t += TIME_STEP * steps;
    stepField(field, t, seed, 1, decayFactor(HEAT_DECAY, steps), options.shape?.(!reduced) ?? {});
    const { columns, rows, cellSize, bucket } = field;
    ctx.clearRect(0, 0, columns * cellSize, rows * cellSize);
    for (let k = 0; k < HEAT_PALETTE.length; k++) {
      ctx.fillStyle = HEAT_PALETTE[k];
      for (let i = 0; i < columns * rows; i++) {
        if (bucket[i] === k) paintCell(ctx, (i % columns) * cellSize, Math.floor(i / columns) * cellSize, cellSize);
      }
    }
  };

  const frame = (now: number) => {
    raf = 0;
    if (!wants()) return;
    if (!last || now - last >= MIN_FRAME_MS) {
      const elapsed = last ? now - last : STEP_MS;
      last = now;
      paint(elapsed);
    }
    if (wants()) raf = requestAnimationFrame(frame);
  };
  const schedule = () => {
    if (!raf && wants()) raf = requestAnimationFrame(frame);
  };

  const resize = () => {
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round((h + bleed) * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    field = createField(w, h, bleed);
    dirty = true;
    schedule();
  };

  const io =
    'IntersectionObserver' in window
      ? new IntersectionObserver((es) => {
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
    seed,
    // the host box, not the canvas: the bleed is not part of the field the cursor enters
    rect: () => host.getBoundingClientRect(),
    flipped,
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
