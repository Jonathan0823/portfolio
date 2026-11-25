// Hover preview for the project list: a window that trails the pointer and shows the
// project's screenshot. Each time it shows a project, the picture arrives through a pixel
// dissolve in heat colours; when the pointer leaves, pixels land over it before it hides.
// Fine pointers only, and not under reduced motion (the expanded row shows the same picture).
import { HEAT_PALETTE } from './pixel-math';
import { cellDelays, cellProgress, coverLevel, type Side } from './pixel-wipe';
import { canRunTrail } from './motion';
import { easeFactor, frameScale } from './timing';

const CELL = 14; // px
const REVEAL_MS = 420;
const HIDE_MS = 240;
const GAP = 28; // px between the pointer and the window

const peek = document.querySelector<HTMLElement>('[data-peek]');
const list = document.getElementById('projects');

if (peek && list && canRunTrail()) {
  const canvas = peek.querySelector<HTMLCanvasElement>('[data-peek-px]')!;
  const ctx = canvas.getContext('2d')!;
  const items = new Map([...peek.querySelectorAll<HTMLElement>('[data-peek-item]')].map((el) => [el.dataset.peekItem!, el]));
  let current: string | null = null;
  let x = 0, y = 0, targetX = 0, targetY = 0, lastY = 0;
  let raf = 0, last = 0;
  let wipe: { start: number; delays: Float32Array; columns: number; rows: number; covering: boolean } | null = null;

  const sizeCanvas = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(peek.offsetWidth * dpr);
    canvas.height = Math.round(peek.offsetHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const startWipe = (covering: boolean, side: Side) => {
    const columns = Math.ceil(peek.offsetWidth / CELL), rows = Math.ceil(peek.offsetHeight / CELL);
    wipe = { start: 0, delays: cellDelays(columns, rows, side), columns, rows, covering };
  };

  const frame = (now: number) => {
    raf = 0;
    const scale = last ? frameScale(now - last) : 1;
    last = now;
    const follow = easeFactor(0.2, scale);
    x += (targetX - x) * follow;
    y += (targetY - y) * follow;
    // Sit to the right of the pointer; flip to the left near the right edge.
    const width = peek.offsetWidth;
    const left = x + GAP + width > window.innerWidth - 16 ? x - GAP - width : x + GAP;
    peek.style.transform = `translate(${left}px, ${y - peek.offsetHeight / 2}px)`;

    let busy = Math.abs(targetX - x) + Math.abs(targetY - y) > 0.3;
    if (wipe) {
      if (!wipe.start) wipe.start = now;
      const t = Math.min(1, (now - wipe.start) / (wipe.covering ? HIDE_MS : REVEAL_MS));
      ctx.clearRect(0, 0, peek.offsetWidth, peek.offsetHeight);
      for (let i = 0; i < wipe.columns * wipe.rows; i++) {
        const p = cellProgress(t, wipe.delays[i]);
        const shown = wipe.covering ? p : 1 - p;
        if (shown <= 0.01) continue;
        ctx.fillStyle = HEAT_PALETTE[coverLevel(wipe.covering ? p : 1 - p)];
        ctx.fillRect((i % wipe.columns) * CELL, Math.floor(i / wipe.columns) * CELL, CELL - 1, CELL - 1);
      }
      if (t >= 1) {
        if (wipe.covering) {
          peek.style.opacity = '0';
          peek.classList.add('hidden');
          ctx.clearRect(0, 0, peek.offsetWidth, peek.offsetHeight);
        }
        wipe = null;
      } else busy = true;
    }
    if (busy && current !== null) raf = requestAnimationFrame(frame);
    else if (busy && wipe) raf = requestAnimationFrame(frame);
  };
  const wake = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  const show = (id: string, fromAbove: boolean) => {
    if (id === current) return;
    const wasHidden = current === null && !wipe;
    current = id;
    items.forEach((el, key) => (el.hidden = key !== id));
    peek.classList.remove('hidden');
    peek.style.opacity = '1';
    if (wasHidden) {
      x = targetX;
      y = targetY;
      sizeCanvas();
    }
    startWipe(false, fromAbove ? 'top' : 'bottom');
    wake();
  };
  const hide = () => {
    if (current === null) return;
    current = null;
    startWipe(true, 'left');
    wake();
  };

  let pointerIn = false, scrollRaf = 0;
  const evaluate = (target: Element | null, clientY: number) => {
    const row = target?.closest<HTMLElement>('[data-project]');
    // An open row already shows its picture; the summary part of a row is what previews.
    const onSummary = row && target?.closest('[data-cursor="eye"]');
    if (row && onSummary && !row.querySelector('[data-detail]:not([data-collapsed])')) show(row.dataset.project!, clientY >= lastY);
    else hide();
    lastY = clientY;
    wake();
  };
  list.addEventListener('pointermove', (e) => {
    pointerIn = true;
    targetX = e.clientX;
    targetY = e.clientY;
    evaluate(e.target as Element, e.clientY);
  });
  list.addEventListener('pointerleave', () => {
    pointerIn = false;
    hide();
  });
  // Scrolling moves rows under a still pointer: look again at what is under it.
  window.addEventListener('scroll', () => {
    if (!pointerIn || scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      evaluate(document.elementFromPoint(targetX, targetY), targetY);
    });
  }, { passive: true });
}
