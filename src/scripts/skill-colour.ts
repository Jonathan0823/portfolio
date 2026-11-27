// Skills colour discovery. The brand colour of each icon wipes in left to right (see .skill-hot in Skills.astro).
// Fine pointer: a sweep once a row has entered, then colour spreading from the pointer.
// Touch: the viewport's centre line acts as the pointer, and a tap lights a tile for good.
import { FINE_POINTER_QUERY, prefersReducedMotion } from './motion';
import { HEAT_PALETTE, hash } from './pixel-math';

const STEPS = 6;
const RADIUS_PX = 180;
/** the touch band's half-width, as a share of the viewport height */
const BAND = 0.3;
const SWEEP_STAGGER_MS = 60;
const SWEEP_HOLD_MS = 600;
/** matches the transition on .skill-hot */
const WIPE_MS = 320;

const BURST_CELL = 4;
const BURST_COUNT = 12;
const BURST_STEP_MS = 60;
const BURST_STEPS = 5;

/** How much of a tile is coloured at `distance`: 1 at the centre, 0 past `radius`, in `steps` pixel steps. */
export function revealFraction(distance: number, radius: number, steps: number): number {
  if (distance >= radius) return 0;
  return Math.ceil((1 - Math.max(0, distance) / radius) * steps) / steps;
}

/** The clip-path that shows the left `fraction` of the colour layer; '' hands control back to the stylesheet. */
export function insetClip(fraction: number): string {
  if (fraction <= 0) return '';
  const right = (1 - Math.min(1, fraction)) * 100;
  return `inset(0 ${+right.toFixed(1)}% 0 0)`;
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A tile under the pointer is fully coloured; the others fade with the distance to their centre. */
export function pointerFraction(x: number, y: number, box: Box, radius = RADIUS_PX, steps = STEPS): number {
  if (x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height) return 1;
  const distance = Math.hypot(x - (box.left + box.width / 2), y - (box.top + box.height / 2));
  return revealFraction(distance, radius, steps);
}

/** Touch: colour peaks where a tile's centre crosses the middle of the viewport. */
export function bandFraction(centreY: number, viewportHeight: number, steps = STEPS): number {
  return revealFraction(Math.abs(centreY - viewportHeight / 2), viewportHeight * BAND, steps);
}

export interface SweepSchedule {
  /** per-tile transition delays: the colour runs in left to right, then drains right to left */
  fill: number[];
  drain: number[];
  /** when the drain starts, and when the whole sweep is over */
  drainAt: number;
  endAt: number;
}

export function sweepSchedule(
  count: number,
  stagger = SWEEP_STAGGER_MS,
  hold = SWEEP_HOLD_MS,
  wipe = WIPE_MS,
): SweepSchedule {
  const last = Math.max(0, count - 1) * stagger;
  const drainAt = last + wipe + hold;
  return {
    fill: Array.from({ length: count }, (_, i) => i * stagger),
    drain: Array.from({ length: count }, (_, i) => (count - 1 - i) * stagger),
    drainAt,
    endAt: drainAt + last + wipe,
  };
}

/** Where burst cell `i` of `count` sits at `step`, in cells from the tile's centre: rings that move outward. */
export function burstCell(i: number, count: number, step: number): { dx: number; dy: number } {
  const angle = ((i + hash(i, count) * 0.6) / count) * Math.PI * 2;
  const radius = 3 + step * 3;
  return { dx: Math.round(Math.cos(angle) * radius), dy: Math.round(Math.sin(angle) * radius) };
}

/** A tile whose row has not played its entrance yet stays ink: colour only wipes in once the icons have landed. */
export function isWaiting(tile: { closest(selector: string): unknown }): boolean {
  return tile.closest('.skill-wait') !== null;
}

export interface SkillColour {
  /** colour a row's tiles once, as its entrance ends; only on a fine pointer */
  sweep(row: HTMLElement): void;
  stop(): void;
}

function rafThrottle(run: () => void) {
  let raf = 0;
  const queue = () => {
    if (!raf)
      raf = requestAnimationFrame(() => {
        raf = 0;
        run();
      });
  };
  queue.cancel = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  return queue;
}

export function mountSkillColour(section: HTMLElement): SkillColour {
  const fine = window.matchMedia(FINE_POINTER_QUERY).matches;
  const reduced = prefersReducedMotion();
  const tiles = [...section.querySelectorAll<HTMLElement>('.skill-tile')];
  const hotOf = (tile: HTMLElement) => tile.querySelector<SVGGElement>('.skill-hot')!;
  // tiles a sweep is animating: the painters leave them alone
  const sweeping = new WeakSet<HTMLElement>();
  const swept = new WeakSet<HTMLElement>();
  const timers = new Set<number>();
  const cleanups: Array<() => void> = [];

  const paint = (fractionOf: (tile: HTMLElement, box: DOMRect) => number) => {
    for (const tile of tiles) {
      if (sweeping.has(tile) || isWaiting(tile)) continue;
      // a lit tile is held by the stylesheet
      const fraction = tile.hasAttribute('data-lit') ? 0 : fractionOf(tile, tile.getBoundingClientRect());
      hotOf(tile).style.clipPath = insetClip(fraction);
    }
  };
  let queue: ReturnType<typeof rafThrottle> = rafThrottle(() => {});

  if (fine && !reduced) {
    let pointer: { x: number; y: number } | null = null;
    queue = rafThrottle(() =>
      paint((tile, box) => {
        if (!pointer) return 0;
        // the cursor magnet's lock is a full colour too
        return tile.hasAttribute('data-magnet-on') ? 1 : pointerFraction(pointer.x, pointer.y, box);
      }),
    );
    const move = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY };
      queue();
    };
    const leave = () => {
      pointer = null;
      queue();
    };
    section.addEventListener('pointermove', move);
    section.addEventListener('pointerleave', leave);
    cleanups.push(() => {
      section.removeEventListener('pointermove', move);
      section.removeEventListener('pointerleave', leave);
    });
  }

  if (!fine) {
    if (!reduced) {
      let near = false;
      queue = rafThrottle(() => {
        if (near) paint((_, box) => bandFraction(box.top + box.height / 2, window.innerHeight));
      });
      const io = new IntersectionObserver((entries) => {
        near = entries[entries.length - 1].isIntersecting;
        if (near) queue();
      });
      io.observe(section);
      window.addEventListener('scroll', queue, { passive: true });
      window.addEventListener('resize', queue);
      cleanups.push(() => {
        io.disconnect();
        window.removeEventListener('scroll', queue);
        window.removeEventListener('resize', queue);
      });
    }
    const bursts = createBursts();
    cleanups.push(bursts.stop);
    const tap = (e: MouseEvent) => {
      const tile = (e.target as Element).closest<HTMLElement>('.skill-tile');
      if (!tile) return;
      const lit = tile.toggleAttribute('data-lit');
      queue();
      if (lit && !reduced) bursts.fire(tile);
    };
    section.addEventListener('click', tap);
    cleanups.push(() => section.removeEventListener('click', tap));
  }

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };

  return {
    sweep(row) {
      // touch: the row has just landed, so let the band wipe its colour in now
      if (!fine) return queue();
      if (reduced || swept.has(row)) return;
      swept.add(row);
      const rowTiles = [...row.querySelectorAll<HTMLElement>('.skill-tile')];
      const plan = sweepSchedule(rowTiles.length);
      rowTiles.forEach((tile, i) => {
        sweeping.add(tile);
        const hot = hotOf(tile);
        hot.style.transitionDelay = plan.fill[i] + 'ms';
        hot.style.clipPath = insetClip(1);
      });
      later(() => {
        rowTiles.forEach((tile, i) => {
          const hot = hotOf(tile);
          hot.style.transitionDelay = plan.drain[i] + 'ms';
          hot.style.clipPath = '';
        });
      }, plan.drainAt);
      later(() => {
        for (const tile of rowTiles) {
          hotOf(tile).style.transitionDelay = '';
          sweeping.delete(tile);
        }
        queue();
      }, plan.endAt);
    },
    stop() {
      cleanups.forEach((fn) => fn());
      queue.cancel();
      timers.forEach(clearTimeout);
      for (const tile of tiles) {
        hotOf(tile).style.clipPath = '';
        hotOf(tile).style.transitionDelay = '';
        sweeping.delete(tile);
      }
    },
  };
}

interface Burst {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  start: number;
}

/**
 * A ring of heat-palette cells flies out of a tapped tile. Bursts draw on their own overlay per row:
 * the entrance clears the whole row canvas every frame, as the bursts do theirs.
 */
function createBursts() {
  const bursts = new Set<Burst>();
  const overlays = new Map<HTMLCanvasElement, HTMLCanvasElement>();
  let frame = 0;

  const draw = (now: number) => {
    frame = 0;
    const done = [...bursts].filter((b) => (now - b.start) / BURST_STEP_MS >= BURST_STEPS);
    for (const b of bursts) {
      b.ctx.save();
      b.ctx.setTransform(1, 0, 0, 1, 0, 0);
      b.ctx.clearRect(0, 0, b.canvas.width, b.canvas.height);
      b.ctx.restore();
    }
    done.forEach((b) => bursts.delete(b));
    for (const b of bursts) {
      const step = Math.floor((now - b.start) / BURST_STEP_MS);
      b.ctx.fillStyle = HEAT_PALETTE[5 - step];
      for (let i = 0; i < BURST_COUNT; i++) {
        const { dx, dy } = burstCell(i, BURST_COUNT, step);
        b.ctx.fillRect(b.x + dx * BURST_CELL, b.y + dy * BURST_CELL, BURST_CELL, BURST_CELL);
      }
    }
    if (bursts.size) frame = requestAnimationFrame(draw);
  };

  const overlayOf = (base: HTMLCanvasElement) => {
    let overlay = overlays.get(base);
    if (!overlay) {
      overlay = base.cloneNode() as HTMLCanvasElement;
      overlay.removeAttribute('data-skill-canvas');
      base.after(overlay);
      overlays.set(base, overlay);
    }
    return overlay;
  };

  return {
    fire(tile: HTMLElement) {
      const base = tile.closest('[data-skill-row]')?.querySelector<HTMLCanvasElement>('[data-skill-canvas]');
      const icon = tile.querySelector('svg');
      if (!base || !icon) return;
      const canvas = overlayOf(base);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(2, devicePixelRatio || 1);
      const width = Math.round(box.width * dpr);
      const height = Math.round(box.height * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const at = icon.getBoundingClientRect();
      const snap = (v: number) => Math.round(v / BURST_CELL) * BURST_CELL;
      bursts.add({
        canvas,
        ctx,
        x: snap(at.left + at.width / 2 - box.left),
        y: snap(at.top + at.height / 2 - box.top),
        start: performance.now(),
      });
      if (!frame) frame = requestAnimationFrame(draw);
    },
    stop() {
      cancelAnimationFrame(frame);
      frame = 0;
      bursts.clear();
      overlays.forEach((overlay) => overlay.remove());
      overlays.clear();
    },
  };
}
