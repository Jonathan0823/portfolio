import { smoothstep } from './cursor-math';
import { spriteFor, type PointerState } from './pointer-sprite';

/** css px per sprite cell: the 9x11 arrow is 18x22px */
const CELL = 2;
/** room around the tip for the biggest sprite plus jitter */
const PAD = 40;
const CANVAS = 88;
/** shrink out plus grow in is about 120ms */
const SWAP_MS = 60;

export interface PixelPointer {
  /** locked 1:1 to the mouse: no easing, so it never lags behind the real pointer */
  move(x: number, y: number): void;
  setState(state: PointerState): void;
  setVisible(on: boolean): void;
  destroy(): void;
}

/** One small canvas that follows the mouse and draws the pointer sprite, re-drawn only when something about it changes. */
export function createPixelPointer(): PixelPointer {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = CANVAS * dpr;
  canvas.height = CANVAS * dpr;
  canvas.style.cssText = `position:fixed;left:0;top:0;width:${CANVAS}px;height:${CANVAS}px;pointer-events:none;z-index:9998;opacity:0;image-rendering:pixelated;transition:opacity 80ms linear`;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // the state on screen trails the wanted one: it shrinks out, swaps, and grows back in
  let current: PointerState = 'arrow',
    wanted: PointerState = 'arrow',
    grow = 1;
  let raf = 0,
    last = 0;

  const draw = () => {
    ctx.clearRect(0, 0, CANVAS, CANVAS);
    if (grow < 0.1) return;
    const scale = smoothstep(grow);
    const sprite = spriteFor(current);
    for (const c of sprite.cells) {
      const x0 = Math.round(PAD + (c.x - sprite.ax) * CELL * scale),
        y0 = Math.round(PAD + (c.y - sprite.ay) * CELL * scale);
      const x1 = Math.round(PAD + (c.x + 1 - sprite.ax) * CELL * scale),
        y1 = Math.round(PAD + (c.y + 1 - sprite.ay) * CELL * scale);
      ctx.fillStyle = c.color;
      ctx.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
    }
  };

  const tick = (now: number) => {
    raf = 0;
    const dt = last ? Math.min(50, now - last) : 16;
    last = now;
    if (current !== wanted) {
      grow -= dt / SWAP_MS;
      if (grow <= 0) {
        grow = 0;
        current = wanted;
      }
    } else if (grow < 1) grow = Math.min(1, grow + dt / SWAP_MS);
    draw();
    if (current !== wanted || grow < 1) raf = requestAnimationFrame(tick);
    else last = 0;
  };
  const wake = () => {
    if (!raf) raf = requestAnimationFrame(tick);
  };

  draw();
  return {
    move(x, y) {
      canvas.style.transform = `translate(${Math.round(x) - PAD}px,${Math.round(y) - PAD}px)`;
    },
    setState(state) {
      if (state === wanted) return;
      wanted = state;
      wake();
    },
    setVisible(on) {
      canvas.style.opacity = on ? '1' : '0';
    },
    destroy() {
      cancelAnimationFrame(raf);
      canvas.remove();
    },
  };
}
