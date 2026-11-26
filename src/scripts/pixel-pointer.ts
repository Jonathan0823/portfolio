import { HEAT_PALETTE } from './pixel-math';
import { POP_MS, approach, chargeScale, clampLevel, popScale, smoothstep } from './cursor-math';
import { INK, hasFieldLook, invertedColor, spriteFor, type PointerState } from './pointer-sprite';

/** css px per sprite cell: the 9x11 arrow is 18x22px */
const CELL = 2;
/** room around the tip for the biggest sprite (a charged shape, 1.8x) plus jitter */
const PAD = 40;
const CANVAS = 88;
/** shrink out plus grow in is about 120ms */
const SWAP_MS = 60;
const PRESS_SQUASH = 0.8;
/** crossfade to and from the inverted in-field look, ms */
const FIELD_MS = 150;
/** how fast the squash settles, ms */
const SQUASH_MS = 45;

export interface PixelPointer {
  /** locked 1:1 to the mouse: no easing, so it never lags behind the real pointer */
  move(x: number, y: number): void;
  setState(state: PointerState): void;
  setVisible(on: boolean): void;
  /** squash on press; releasing pops back with a small overshoot */
  press(down: boolean): void;
  /** 0..1 grows and heats the pointer; jitterX/Y shake it by whole px at full charge */
  setCharge(charge: number, jitterX?: number, jitterY?: number): void;
  /** the release pop without a preceding squash (a charged pointer snapping back) */
  pop(): void;
  /** inside a pixel field the arrow crossfades to an inverted look (ink fill, white outline); snaps under reduced motion */
  setInField(on: boolean): void;
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
  let down = false,
    squash = 1,
    popAt = -1,
    popFrom = 1;
  let charge = 0,
    jitterX = 0,
    jitterY = 0;
  let fieldTarget = 0,
    field = 0;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let raf = 0,
    last = 0;

  const draw = () => {
    ctx.clearRect(0, 0, CANVAS, CANVAS);
    if (grow < 0.1) return;
    const scale = smoothstep(grow) * squash * chargeScale(charge);
    const sprite = spriteFor(current, down);
    const inverted = hasFieldLook(current);
    // charge heats the whole fill through the palette; the outline keeps its colour
    const tint = charge > 0 ? HEAT_PALETTE[clampLevel(charge * 5)] : null;
    for (const c of sprite.cells) {
      const x0 = Math.round(PAD + (c.x - sprite.ax) * CELL * scale),
        y0 = Math.round(PAD + (c.y - sprite.ay) * CELL * scale);
      const x1 = Math.round(PAD + (c.x + 1 - sprite.ax) * CELL * scale),
        y1 = Math.round(PAD + (c.y + 1 - sprite.ay) * CELL * scale);
      const base = tint && c.color !== INK ? tint : c.color;
      const w = Math.max(1, x1 - x0),
        h = Math.max(1, y1 - y0);
      if (inverted && field > 0) {
        ctx.globalAlpha = 1 - field;
        ctx.fillStyle = base;
        ctx.fillRect(x0 + jitterX, y0 + jitterY, w, h);
        ctx.globalAlpha = field;
        ctx.fillStyle = invertedColor(c);
        ctx.fillRect(x0 + jitterX, y0 + jitterY, w, h);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = base;
        ctx.fillRect(x0 + jitterX, y0 + jitterY, w, h);
      }
    }
  };

  const squashTarget = () => (charge > 0 ? 1 : PRESS_SQUASH);
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
    field = approach(field, fieldTarget, reducedMotion.matches ? 1 : dt / FIELD_MS);
    if (down) squash += (squashTarget() - squash) * Math.min(1, dt / SQUASH_MS);
    else if (popAt >= 0) {
      popAt += dt;
      squash = popScale(popAt, popFrom);
      if (popAt >= POP_MS) popAt = -1;
    }
    draw();
    const settling = down ? Math.abs(squash - squashTarget()) > 0.01 : popAt >= 0;
    if (current !== wanted || grow < 1 || settling || field !== fieldTarget) raf = requestAnimationFrame(tick);
    else last = 0;
  };
  const wake = () => {
    if (!raf) raf = requestAnimationFrame(tick);
  };
  const startPop = () => {
    popAt = 0;
    popFrom = squash;
    wake();
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
    press(isDown) {
      if (down === isDown) return;
      down = isDown;
      if (isDown) popAt = -1;
      else popFrom = squash;
      if (isDown) wake();
      else startPop();
      // the pressed look (hotter fill) changes with `down`, so redraw now rather than waiting for the next tick
      draw();
    },
    setCharge(next, jx = 0, jy = 0) {
      if (next === charge && jx === jitterX && jy === jitterY) return;
      charge = next;
      jitterX = jx;
      jitterY = jy;
      draw();
    },
    pop: startPop,
    setInField(on) {
      fieldTarget = on ? 1 : 0;
      wake();
    },
    destroy() {
      cancelAnimationFrame(raf);
      canvas.remove();
    },
  };
}
