// The Mould on touch, where there is nothing to hover: a small one beside the contact links that drops fill, cycling
// through mail, GitHub and LinkedIn by itself and lighting the button whose logo it holds. The drops fall down the
// page's right gutter, clear of the text, and run sideways into it.
import { BITMAPS, type GlyphName } from './glyph-model';
import { HEAT_PALETTE } from './pixel-math';
import { TIDE_SHOWN_CLASS } from './footer-tide';
import type { HeroField } from './hero-field';
import { createSectionCanvas, createTicker, type Next } from './hero-overlay';
import {
  CRAWL_MS,
  DROPS,
  FADE_IN_MS,
  FALL_GRAVITY,
  FIRST_DRIP_MS,
  GATHER_MS,
  HANG_MS,
  PAUSE_MS,
  SETTLE_MS,
  drawMould,
  glow,
  landingCell,
  msToBeat,
  shapeOf,
  spotAbove,
  type Cell,
} from './pour-mould';

/** the longer side of the small mould, at most */
const MOULD_PX = 84;
/** a full mould stands this long before the next logo takes its place */
export const HOLD_MS = 1800;
/** the last stretch of a drop's way: sideways out of the page gutter into the mould */
export const RUN_MS = 220;
/** a drop's centre keeps this far inside the section's edge, clear of all text */
const GUTTER_PX = 10;
const DROP_PX = 6;
/** a drop has drifted into the gutter this far above the headline */
const TURN_CLEAR_PX = 8;
/** the trail's cells lag the drop by these many seconds */
const TRAIL = [
  { lag: 0.06, level: 2, size: 3 },
  { lag: 0.03, level: 3, size: 4 },
  { lag: 0, level: 4, size: DROP_PX },
];

/** a drop's way, in section px: from under the lava into the gutter above the headline, down it, then sideways */
export interface GutterPath {
  fromX: number;
  fromY: number;
  gutter: number;
  headline: number;
  toX: number;
  toY: number;
}

export interface Dot {
  x: number;
  y: number;
  /** heat palette level */
  level: number;
  size: number;
}

/** what to draw `ms` after a drop let go; null once it has arrived */
export function gutterDots(path: GutterPath, ms: number): Dot[] | null {
  const { fromX, fromY, gutter, headline, toX, toY } = path;
  const falling = ms / 1000;
  const down = Math.sqrt((2 * Math.max(1, toY - fromY)) / FALL_GRAVITY);
  if (falling < down)
    return TRAIL.map(({ lag, level, size }) => {
      const s = Math.max(0, falling - lag);
      const y = fromY + 0.5 * FALL_GRAVITY * s * s;
      const k = Math.min(1, (y - fromY) / Math.max(1, headline - TURN_CLEAR_PX - fromY));
      return { x: fromX + (gutter - fromX) * k * (2 - k), y, level, size };
    });
  const run = ((falling - down) * 1000) / RUN_MS;
  return run >= 1 ? null : [{ x: gutter + (toX - gutter) * run, y: toY, level: 4, size: DROP_PX }];
}

/** mounts the small mould; the returned function removes it. `due` and `life` as for the fine pointer's mould */
export function mountHeroMouldTouch(hero: HeroField, due: Promise<void>, life: Promise<void>): () => void {
  const section = document.getElementById('top');
  const headline = section?.querySelector<HTMLElement>('h1');
  const links = [...(section?.querySelectorAll<HTMLElement>('[data-hero-links] a[data-glyph-for]') ?? [])];
  if (!section || !headline || links.length < 2) return () => {};

  const { canvas, ctx, clear } = createSectionCanvas(section, 'data-mould-touch');
  let ticker: ReturnType<typeof createTicker> | null = null;
  let resize: ResizeObserver | null = null;
  let gone = false,
    dripping = false;
  let which = 0,
    landed = 0,
    landedAt = 0,
    nextAt = Infinity,
    shownAt = -1;
  /** the drop on its way: the lava it gathered under and when (ticker clock) */
  let drop: { column: number; row: number; born: number } | null = null;

  const current = () => links[which % links.length];
  const light = (on: HTMLElement | null) =>
    links.forEach((link) => link.classList.toggle(TIDE_SHOWN_CLASS, link === on));
  /** a box in section px */
  const inSection = (el: Element) => {
    const s = section.getBoundingClientRect(),
      r = el.getBoundingClientRect();
    return { top: r.top - s.top, bottom: r.bottom - s.top };
  };

  const step = (clock: number): Next => {
    if (shownAt < 0) {
      shownAt = clock;
      light(current());
    }
    const age = clock - landedAt;
    if (landed >= DROPS && age > SETTLE_MS + HOLD_MS) {
      which++;
      landed = 0;
      shownAt = clock;
      nextAt = clock + FADE_IN_MS;
      light(current());
      return 0;
    }
    if (dripping && nextAt === Infinity) nextAt = clock + FIRST_DRIP_MS;

    const shape = shapeOf(BITMAPS[current().dataset.glyphFor as GlyphName].rows);
    const cell = Math.floor(MOULD_PX / Math.max(shape.width, shape.height));
    // in the free room right of the buttons under the first one, so it adds no height
    const width = section.clientWidth;
    const left = width - 2 * GUTTER_PX - shape.width * cell,
      top = Math.round((inSection(links[1]).top + inSection(links[links.length - 1]).bottom - shape.height * cell) / 2);
    const inset = cell > 3 ? 0.5 : 0.25;
    const paint = ([c, r]: Cell, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(left + c * cell + inset, top + r * cell + inset, cell - inset * 2, cell - inset * 2);
    };
    const square = ({ x, y, level, size }: Dot) => {
      ctx.fillStyle = HEAT_PALETTE[level];
      ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
    };
    const limit = shape.pour.length;
    clear();
    ctx.globalAlpha = Math.min(1, (clock - shownAt) / FADE_IN_MS);
    drawMould(shape, { limit, landed, age }, clock, paint);
    ctx.globalAlpha = 1;

    const field = hero.field();
    const headlineTop = inSection(headline).top;
    const gutter = width - GUTTER_PX;
    if (!drop && landed < DROPS && clock >= nextAt) {
      const spot = spotAbove(field, Math.floor(gutter / field.cellSize), headlineTop);
      if (spot) drop = { ...spot, born: clock };
      else nextAt = clock + PAUSE_MS;
    }
    if (drop) {
      const t = clock - drop.born;
      const from = { fromX: (drop.column + 0.5) * field.cellSize, fromY: (drop.row + 3) * field.cellSize };
      if (t < GATHER_MS + HANG_MS) {
        glow(drop.column, drop.row, t);
        if (t >= GATHER_MS) square({ x: from.fromX, y: from.fromY, level: 4, size: DROP_PX });
        return 0;
      }
      const target = landingCell(shape, limit, landed);
      const dots = gutterDots(
        {
          ...from,
          gutter,
          headline: headlineTop,
          toX: left + (target[0] + 0.5) * cell,
          toY: top + (target[1] + 0.5) * cell,
        },
        t - GATHER_MS - HANG_MS,
      );
      if (dots) dots.forEach(square);
      else {
        drop = null;
        landed++;
        landedAt = clock;
        nextAt = clock + PAUSE_MS;
      }
      return 0;
    }
    if (clock - shownAt < FADE_IN_MS || (landed && age < SETTLE_MS)) return 0;
    const beat = msToBeat(clock, CRAWL_MS);
    if (landed >= DROPS) return Math.min(beat, SETTLE_MS + HOLD_MS - age + 1);
    return nextAt > clock ? Math.min(beat, nextAt - clock) : beat;
  };

  void due.then(() => {
    if (gone) return;
    section.append(canvas);
    ticker = createTicker(section, step);
    if ('ResizeObserver' in window) {
      resize = new ResizeObserver(() => {
        drop = null;
        ticker?.wake();
      });
      resize.observe(section);
    }
    void life.then(() => {
      dripping = true;
      ticker?.wake();
    });
  });
  return () => {
    gone = true;
    ticker?.stop();
    resize?.disconnect();
    canvas.remove();
    light(null);
  };
}
