import { whenIdle } from './motion';
import { HEAT_PALETTE, hash } from './pixel-math';
import { cellDelays, cellProgress, entrySide, type Side } from './pixel-wipe';
import { REFERENCE_FRAME_MS, frameScale } from './timing';

const CELL = 5;
const DURATION_MS = 300;
const INK = '#111111';
const DARK_SETTLE = HEAT_PALETTE[1];
const HOT = [HEAT_PALETTE[2], HEAT_PALETTE[3], HEAT_PALETTE[4], HEAT_PALETTE[5]];

function setup(button: HTMLElement, reduced: boolean) {
  const dark = button.dataset.pixelBtn === 'dark';
  const settle = dark ? DARK_SETTLE : INK;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;border-radius:inherit;';
  button.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let columns = 0, rows = 0, delays = cellDelays(0, 0, 'left');
  let side: Side = 'left';
  let t = 0, target = 0, raf = 0, last = 0;

  const draw = () => {
    const scale = canvas.width / Math.max(1, button.clientWidth);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const i = y * columns + x;
        const p = cellProgress(t, delays[i]);
        if (p <= 0) continue;
        ctx.fillStyle = p >= 1 ? settle : HOT[Math.floor(hash(x, y, 9) * HOT.length)];
        ctx.fillRect(Math.floor(x * CELL * scale), Math.floor(y * CELL * scale), Math.ceil(CELL * scale), Math.ceil(CELL * scale));
      }
    }
  };
  const fillAll = () => {
    ctx.fillStyle = settle;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };
  const render = () => (t >= 1 ? fillAll() : t <= 0 ? ctx.clearRect(0, 0, canvas.width, canvas.height) : draw());

  const layout = () => {
    const w = button.clientWidth, h = button.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    columns = Math.ceil(w / CELL);
    rows = Math.ceil(h / CELL);
    delays = cellDelays(columns, rows, side);
    render();
  };

  const frame = (now: number) => {
    raf = 0;
    const dt = last ? frameScale(now - last) * REFERENCE_FRAME_MS : 0;
    last = now;
    const step = dt / DURATION_MS;
    t = target > t ? Math.min(target, t + step) : Math.max(target, t - step);
    render();
    if (t !== target) raf = requestAnimationFrame(frame);
    else last = 0;
  };
  const go = (to: number) => {
    target = to;
    if (reduced) {
      t = to;
      render();
    } else if (!raf) raf = requestAnimationFrame(frame);
  };

  button.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'touch') return;
    const r = button.getBoundingClientRect();
    const next = entrySide(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
    if (next !== side && t <= 0) {
      side = next;
      delays = cellDelays(columns, rows, side);
    }
    button.setAttribute('data-pixel-on', '');
    go(1);
  });
  button.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return;
    if (!button.matches(':focus-visible')) button.removeAttribute('data-pixel-on');
    if (!button.matches(':focus-visible')) go(0);
  });
  button.addEventListener('focus', () => {
    if (!button.matches(':focus-visible')) return;
    button.setAttribute('data-pixel-on', '');
    go(1);
  });
  button.addEventListener('blur', () => {
    if (button.matches(':hover')) return;
    button.removeAttribute('data-pixel-on');
    go(0);
  });

  new ResizeObserver(layout).observe(button);
  layout();
}

function init() {
  if (!matchMedia('(hover: hover)').matches) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll<HTMLElement>('[data-pixel-btn]').forEach((b) => setup(b, reduced));
}
whenIdle(init);
