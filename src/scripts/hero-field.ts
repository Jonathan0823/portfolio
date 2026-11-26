import { HEAT_PALETTE, createField, stepField, type Field, type FieldShape } from './pixel-math';
import { emberAlpha, emberRate, spawnEmber, stepEmbers, type Ember } from './field-edges';
import { decayFactor } from './timing';

export interface HeroField {
  canvas: HTMLCanvasElement;
  field(): Field;
  time(): number;
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
const CONTENT_SELECTOR = 'h1,h2,h3,p,li,a,button,summary,label';

export function mountHeroField(
  host: HTMLElement,
  reduced: boolean,
  options: {
    seed?: number;
    flipped?: boolean;
    /** the outline for this frame; `motion` is false under reduced motion */
    shape?: (motion: boolean) => FieldShape;
    /** px the canvas reaches past the host, behind the content; embers fall there */
    bleed?: number;
    /** whether sparks may fly off the field this frame; defaults to yes */
    embers?: () => boolean;
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
  let embers: Ember[] = [],
    lastScrollY = scrollY;
  // cells under content (text lines, buttons), which embers steer around
  let blocked = new Uint8Array(0);
  const isBlocked = (x: number, y: number) =>
    y >= 0 &&
    y < field.rows &&
    x >= 0 &&
    x < field.columns &&
    blocked[Math.floor(y) * field.columns + Math.round(x)] === 1;
  const mapContent = () => {
    if (!bleed) return;
    const { columns, rows, cellSize } = field;
    blocked = new Uint8Array(columns * rows);
    const box = canvas.getBoundingClientRect();
    const mark = (r: DOMRect) => {
      if (!r.width || r.bottom < box.top || r.top > box.bottom) return;
      const top = flipped ? box.bottom - r.bottom : r.top - box.top,
        bottom = flipped ? box.bottom - r.top : r.bottom - box.top;
      const y0 = Math.max(0, Math.floor(top / cellSize) - 1),
        y1 = Math.min(rows - 1, Math.floor(bottom / cellSize) + 1);
      const x0 = Math.max(0, Math.floor((r.left - box.left) / cellSize) - 1),
        x1 = Math.min(columns - 1, Math.floor((r.right - box.left) / cellSize) + 1);
      for (let y = y0; y <= y1; y++) blocked.fill(1, y * columns + x0, y * columns + x1 + 1);
    };
    const range = document.createRange();
    for (const el of document.querySelectorAll<HTMLElement>(CONTENT_SELECTOR)) {
      if (el.closest('nav,[data-pixel-field]')) continue;
      if (el.matches('a[data-pixel-btn],button')) mark(el.getBoundingClientRect());
      else {
        range.selectNodeContents(el);
        for (const r of range.getClientRects()) mark(r);
      }
    }
  };

  const shedEmbers = (steps: number) => {
    const scrolled = Math.abs(scrollY - lastScrollY);
    lastScrollY = scrollY;
    const { columns, rows, heat, lowestRow, lowestBucket } = field;
    const cursorHeat = field.hottest > 0.3;
    for (let x = 0; x < columns; x++) {
      if (lowestRow[x] < 0) continue;
      let columnHeat = 0;
      if (cursorHeat) for (let y = 0; y < rows; y++) columnHeat = Math.max(columnHeat, heat[y * columns + x]);
      if (Math.random() < emberRate(lowestBucket[x], columnHeat, scrolled) * steps)
        embers.push(spawnEmber(x, lowestRow[x], lowestBucket[x]));
    }
    embers = stepEmbers(embers, steps, isBlocked, columns, rows);
  };

  const wants = () => visible && !document.hidden && (dirty || !reduced || field.hottest > 0.01);

  const paint = (elapsed: number) => {
    dirty = false;
    const steps = Math.min(Math.max(elapsed, 0), MAX_ELAPSED_MS) / STEP_MS;
    if (!reduced) t += TIME_STEP * steps;
    stepField(field, t, seed, 1, decayFactor(HEAT_DECAY, steps), options.shape?.(!reduced) ?? {});
    if (bleed && !reduced && (options.embers?.() ?? true)) shedEmbers(steps);
    else embers = [];
    const { columns, rows, cellSize, bucket } = field;
    ctx.clearRect(0, 0, columns * cellSize, rows * cellSize);
    for (const e of embers) {
      const cx = Math.round(e.x),
        cy = Math.floor(e.y),
        i = cy * columns + cx;
      if (cy <= field.lowestRow[cx] || bucket[i] >= 0 || blocked[i]) continue;
      ctx.globalAlpha = emberAlpha(e);
      ctx.fillStyle = HEAT_PALETTE[e.level];
      ctx.fillRect(cx * cellSize + 1, cy * cellSize + 1, cellSize - 1, cellSize - 1);
    }
    ctx.globalAlpha = 1;
    for (let k = 0; k < HEAT_PALETTE.length; k++) {
      ctx.fillStyle = HEAT_PALETTE[k];
      for (let i = 0; i < columns * rows; i++) {
        if (bucket[i] === k)
          ctx.fillRect(
            (i % columns) * cellSize + 1,
            Math.floor(i / columns) * cellSize + 1,
            cellSize - 1,
            cellSize - 1,
          );
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
    embers = [];
    mapContent();
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
  // content moving (fonts, layout) changes what embers avoid
  let remap = 0;
  const contentRo =
    bleed && 'ResizeObserver' in window
      ? new ResizeObserver(() => {
          cancelAnimationFrame(remap);
          remap = requestAnimationFrame(mapContent);
        })
      : null;
  contentRo?.observe(document.body);
  const onVisibility = () => schedule();
  document.addEventListener('visibilitychange', onVisibility);
  resize();

  return {
    canvas,
    field: () => field,
    time: () => t,
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
      contentRo?.disconnect();
      cancelAnimationFrame(remap);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.remove();
    },
  };
}
