// Hero drip: after the ignite, lava gathers in a hot spot under the hero field, drops break off it, fall (stepped,
// cell-sized) onto the headline and BUILD its red period: each landing fills one band of a pixel square, bottom up.
// When it is full the period is shown as a slow blinking pixel caret. Drawn on its own overlay canvas; the hot spot
// itself is heat held in the real field. Skipped entirely under prefers-reduced-motion, which keeps the plain period.
import { HEAT_PALETTE } from './pixel-math';
import type { HeroField } from './hero-field';
import { holdHeat } from './heat-hold';

/** html class that hides the period (layout space kept) until the drip has built it; see Hero.astro */
export const DRIP_PENDING_CLASS = 'drip-pending';
/** class on the period once the caret has taken over; styled in global.css */
const CARET_CLASS = 'drip-caret';
const PERIOD_SELECTOR = 'h1 [data-drip-period]';

const DROP_GAP_MS = 170;
/** how long the hot spot gathers (and bulges down) before the first drop lets go */
const GATHER_MS = 300;
/** a drop oozing sideways along the underside moves one cell per this long */
const SLIDE_S = 0.06;
const HOT_RED = 0.66;
const HOT_ORANGE = 0.82;
const GRAVITY = 1900; // px/s²
const BEAD_S = 0.07;
const SPLASH_MS = 260;
const SQUASH_MS = 140;
const COOL_MS = 280;
const BLINK_MS = 500;
const CARET_DELAY_MS = 200;
const MIN_BANDS = 2;
const MAX_BANDS = 4;

export interface PeriodGrid {
  columns: number;
  bands: number;
}

/** the period's ink as a grid of field cells: how many columns wide and how many bands (rows) tall it fills */
export function periodGrid(inkWidth: number, inkHeight: number, cellSize: number): PeriodGrid {
  return {
    columns: Math.max(1, Math.round(inkWidth / cellSize)),
    bands: Math.max(MIN_BANDS, Math.min(MAX_BANDS, Math.round(inkHeight / cellSize))),
  };
}

export interface DropPlan {
  /** column of the period grid the drop falls on: the outer columns, alternating */
  column: number;
  /** band (from the bottom) this drop fills */
  band: number;
  /** when it lets go, ms on the caller's clock */
  start: number;
}

/** one drop per band, the lowest first, letting go DROP_GAP_MS apart once the hot spot has gathered */
export function planDrops(grid: PeriodGrid, now: number): DropPlan[] {
  return Array.from({ length: grid.bands }, (_, band) => ({
    column: band % 2 ? grid.columns - 1 : 0,
    band,
    start: now + GATHER_MS + band * DROP_GAP_MS,
  }));
}

/** palette level of a settled band `k` (0..1) through its cooling: yellow, orange, red; the accent colour after */
export function settleLevel(k: number): number {
  return 5 - Math.floor(Math.min(1, Math.max(0, k)) * 2.99);
}

/** ms from `now` until the caret may start, once the last drop landed at `lastLanded` */
export function caretDelay(now: number, lastLanded: number): number {
  return Math.max(0, COOL_MS + CARET_DELAY_MS - (now - lastLanded));
}

interface Drop extends DropPlan {
  landedAt: number;
  /** field column of the hot spot it hangs from, and the lowest hot row (the bulge) of that spot */
  source: number;
  bulgeRow: number;
  /** set when it lets go: the heat level of the hot cell it starts under, and the y of its first frame */
  level: number;
  fromY: number;
}
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
}
interface Ink {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Plays the drip; `onCaret` fires when the caret starts blinking. Returns a function that stops it and restores
 * the plain period. Without a period to build (or a measurable one) it only clears the pending class.
 */
export function mountHeroDrip(hero: HeroField, onCaret: () => void): () => void {
  const root = document.documentElement;
  const section = document.getElementById('top');
  const h1 = section?.querySelector<HTMLElement>('h1');
  const period = h1?.querySelector<HTMLElement>(PERIOD_SELECTOR);
  if (!section || !h1 || !period) {
    root.classList.remove(DRIP_PENDING_CLASS);
    onCaret();
    return () => {};
  }

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('data-drip', '');
  canvas.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:4';
  section.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  // not the period's own colour: it is transparent while the drip is pending
  const accent = getComputedStyle(root).getPropertyValue('--color-accent').trim() || HEAT_PALETTE[3];
  let raf = 0,
    blink = 0,
    caretTimer = 0,
    caret = false,
    caretLit = true,
    width = 0,
    height = 0,
    dpr = 1,
    grid: PeriodGrid = { columns: 1, bands: MIN_BANDS };
  let drops: Drop[] = [];
  let sparks: Spark[] = [];

  const fit = () => {
    const box = section.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    if (box.width === width && box.height === height && ratio === dpr) return;
    width = box.width;
    height = box.height;
    dpr = ratio;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  };

  /** where the period's ink sits inside the section, from the font metrics of a '.' (follows resize and breakpoints) */
  const measureInk = (): Ink | null => {
    const cs = getComputedStyle(h1);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = ctx.measureText('.');
    const range = document.createRange();
    range.selectNodeContents(period);
    const r = range.getClientRects()[0];
    if (!r) return null;
    const s = section.getBoundingClientRect();
    const baseline = r.top - s.top + m.fontBoundingBoxAscent;
    const x = r.left - s.left;
    return {
      left: x - m.actualBoundingBoxLeft,
      right: x + m.actualBoundingBoxRight,
      top: baseline - m.actualBoundingBoxAscent,
      bottom: baseline + m.actualBoundingBoxDescent,
    };
  };

  const startDrops = () => {
    const ink = measureInk();
    if (!ink) return;
    const field = hero.field();
    const cell = field.cellSize;
    grid = periodGrid(ink.right - ink.left, ink.bottom - ink.top, cell);
    const now = performance.now();
    const colOf = (px: number) => Math.min(field.columns - 1, Math.max(0, Math.floor(px / cell)));
    /** the column with terrain nearest to `x`: where lava can hang from */
    const nearest = (x: number) => {
      for (let r = 0; r < field.columns; r++)
        for (const c of r ? [x - r, x + r] : [x]) if (c >= 0 && c < field.columns && field.lowestRow[c] >= 0) return c;
      return x;
    };
    const spots = new Map<number, number>(); // source column -> when its last drop lets go
    for (const plan of planDrops(grid, now)) {
      const source = nearest(colOf(ink.left + (plan.column + 0.5) * ((ink.right - ink.left) / grid.columns)));
      const bottom = Math.max(0, field.lowestRow[source]);
      spots.set(source, Math.max(spots.get(source) ?? 0, plan.start));
      drops.push({ ...plan, landedAt: 0, source, bulgeRow: bottom + 2, level: 4, fromY: 0 });
    }
    // the hot spot glows red above and orange at its tip, and bulges two rows down while it gathers
    for (const [source, until] of spots) {
      for (let x = source - 1; x <= source + 1; x++) {
        const bottom = field.lowestRow[x];
        if (bottom < 0) continue;
        holdHeat({ x0: x, x1: x, y0: bottom - 3, y1: bottom - 1, level: HOT_RED, from: now, until: until + 260 });
        holdHeat({ x0: x, x1: x, y0: bottom, y1: bottom + 1, level: HOT_ORANGE, from: now + 60, until: until + 260 });
        if (x === source)
          holdHeat({
            x0: x,
            x1: x,
            y0: bottom + 2,
            y1: bottom + 2,
            level: HOT_ORANGE,
            from: now + 160,
            until: until + 260,
          });
      }
    }
  };

  const px = (x: number, y: number, size: number, color: string, alpha = 1) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(size)), Math.max(1, Math.round(size)));
  };

  const render = (now: number): boolean => {
    fit();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const ink = measureInk();
    if (!ink) return false;
    const field = hero.field();
    const cw = (ink.right - ink.left) / grid.columns;
    const bh = (ink.bottom - ink.top) / grid.bands;
    const step = Math.max(2, field.cellSize * 0.8);
    let busy = false;

    for (const d of drops) {
      const x = ink.left + d.column * cw;
      const bandTop = ink.bottom - (d.band + 1) * bh; // top of the band this drop fills
      if (d.landedAt) {
        // the caret has taken over the square: a band painted under it would keep it lit through the off phase
        if (caret) continue;
        // the settled band: white-hot, cooling to the accent; the neighbouring columns fill in with it
        const k = Math.min(1, (now - d.landedAt) / COOL_MS);
        if (k < 1) busy = true;
        ctx.globalAlpha = 1;
        ctx.fillStyle = k >= 1 ? accent : HEAT_PALETTE[Math.max(0, settleLevel(k))];
        ctx.fillRect(Math.round(ink.left), Math.round(bandTop), Math.round(ink.right - ink.left), Math.ceil(bh));
        // squash: a flattened blob wider than the band for the first moments
        const squash = 1 - Math.min(1, (now - d.landedAt) / SQUASH_MS);
        if (squash > 0) {
          ctx.fillStyle = HEAT_PALETTE[5];
          const w = squash * cw * 0.9;
          const y = Math.round(bandTop + bh * 0.4);
          const thick = Math.max(1, Math.round(bh * 0.6));
          ctx.fillRect(Math.round(ink.left - w), y, Math.round(w), thick);
          ctx.fillRect(Math.round(ink.right), y, Math.round(w), thick);
        }
        continue;
      }
      const t = (now - d.start) / 1000;
      busy = true;
      if (t < 0) continue;
      const cell = field.cellSize;
      if (!d.fromY) {
        // let go: start right under the lowest hot cell of the spot, in that cell's colour
        let y = Math.min(field.rows - 2, d.bulgeRow);
        while (y > 0 && field.bucket[y * field.columns + d.source] < 0) y--;
        d.level = Math.max(0, field.bucket[y * field.columns + d.source]);
        d.fromY = (y + 1) * cell;
      }
      const size = Math.max(cw, cell * 0.9);
      const tx = x + cw / 2;
      const sx = (d.source + 0.5) * cell;
      const slide = Math.abs(Math.floor(tx / cell) - d.source);
      const slideEnd = BEAD_S + slide * SLIDE_S;
      const color = HEAT_PALETTE[d.level];
      if (t < slideEnd) {
        // hanging at the hot cell, then creeping sideways along the underside to the period's column
        const along = Math.min(slide, Math.max(0, Math.floor((t - BEAD_S) / SLIDE_S) + 1));
        const cx = sx + Math.sign(tx - sx) * along * cell;
        px(cx - size / 2, d.fromY, size, color);
        if (along)
          px(cx - Math.sign(tx - sx) * cell - size / 2, d.fromY, size, HEAT_PALETTE[Math.max(0, d.level - 1)], 0.6);
        continue;
      }
      const fall = t - slideEnd;
      const cx = slide ? sx + (tx - sx) * Math.min(1, fall / 0.1) : tx;
      const y = d.fromY + Math.floor((0.5 * GRAVITY * fall * fall) / step) * step;
      if (y + size >= bandTop + bh * 0.2) {
        d.landedAt = now;
        for (let k = 0; k < 5; k++)
          sparks.push({
            x: ink.left + (k / 4) * (ink.right - ink.left),
            y: bandTop + bh * 0.3,
            vx: (k - 2) * 38 + (Math.random() - 0.5) * 30,
            vy: -(90 + Math.random() * 120),
            born: now,
          });
        continue;
      }
      px(cx - size / 2, y, size, color);
      for (let k = 1; k <= 3; k++)
        px(cx - size / 2, y - k * size, size, HEAT_PALETTE[Math.max(Math.min(d.level, 3), d.level - k)], 1 - k * 0.22);
    }

    sparks = sparks.filter((s) => now - s.born < SPLASH_MS);
    for (const s of sparks) {
      busy = true;
      const age = (now - s.born) / 1000;
      const x = s.x + s.vx * age;
      const y = s.y + s.vy * age + 0.5 * GRAVITY * 0.5 * age * age;
      px(
        x,
        y,
        Math.max(3, field.cellSize * 0.5),
        HEAT_PALETTE[Math.max(1, 5 - Math.floor(age / 0.1))],
        1 - age / (SPLASH_MS / 1000),
      );
    }

    if (drops.length && !caret && !caretTimer && drops.every((d) => d.landedAt)) {
      const last = Math.max(...drops.map((d) => d.landedAt));
      caretTimer = window.setTimeout(startCaret, caretDelay(now, last));
    }
    if (caret && caretLit) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = accent;
      ctx.fillRect(
        Math.round(ink.left),
        Math.round(ink.top),
        Math.round(ink.right - ink.left),
        Math.round(ink.bottom - ink.top),
      );
    }
    ctx.globalAlpha = 1;
    return busy;
  };

  const frame = (now: number) => {
    raf = 0;
    if (render(now)) raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  // the finished square hands over to the blinking caret; the real period stays hidden behind it
  const startCaret = () => {
    caret = true;
    caretLit = true;
    period.classList.add(CARET_CLASS);
    root.classList.remove(DRIP_PENDING_CLASS);
    blink = window.setInterval(() => {
      caretLit = !caretLit;
      if (!raf) render(performance.now());
    }, BLINK_MS);
    kick();
    onCaret();
  };

  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => kick()) : null;
  ro?.observe(section);
  ro?.observe(h1);
  startDrops();
  kick();

  return () => {
    cancelAnimationFrame(raf);
    clearInterval(blink);
    clearTimeout(caretTimer);
    ro?.disconnect();
    period.classList.remove(CARET_CLASS);
    root.classList.remove(DRIP_PENDING_CLASS);
    canvas.remove();
  };
}
