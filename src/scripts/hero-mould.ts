// The Mould on a fine pointer: the ghost of the GitHub logo where the contact links spill, with a "?" and a caption.
// Once the headline's period is built, a few drops gather under the lava and fill it part of the way; there it stays,
// unfinished. The first hover or focus of a contact link pours the real logo, and the mould leaves for good.
import { BITMAPS, isCompactHero, type GlyphName } from './glyph-model';
import { HEAT_PALETTE, hash } from './pixel-math';
import type { GlyphSlot, GlyphSpill } from './glyph-spill';
import type { HeroField } from './hero-field';
import { createSectionCanvas, createTicker, type Next, type Ticker } from './hero-overlay';
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

/** share of the mould filled at rest */
const FILL_SHARE = 0.34;
/** the "?" moves half a cell once per this long */
const BOB_MS = 1100;
/** the exit once a link is found, while the real spill is already pouring */
export const EXIT_MS = 600;
/** GitHub pours into this very shape, so its exit waits for the real pixels to arrive */
export const POUR_EXIT_MS = 1100;
/** the "?" is the first thing to go */
const QUESTION_EXIT_MS = 140;
/** each cell's own melt and fade */
const CELL_EXIT_MS = 220;
/** wait for the glyph spill, which mounts on idle */
const SPILL_WAIT_MS = 50;
const QUESTION = ['.####.', '##..##', '....##', '...##.', '..##..', '..##..', '......', '..##..'];
const QUESTION_ROW = 8;
const INK = '#111111';

/**
 * When a cell starts to go, ms into the exit. For GitHub, bottom up as the pour fills it; otherwise scattered, the
 * lower cells first.
 */
export function cellExitStart([c, r]: Cell, height: number, poured: boolean): number {
  const up = 1 - r / (height - 1);
  const order = poured ? 0.8 * up + 0.2 * hash(c, r) : 0.35 * up + 0.65 * hash(c, r);
  const from = poured ? POUR_EXIT_MS * 0.5 : QUESTION_EXIT_MS / 2;
  return from + order * ((poured ? POUR_EXIT_MS : EXIT_MS) - CELL_EXIT_MS - from);
}

export interface MouldOptions {
  /** resolves when the mould is due to appear */
  due: Promise<void>;
  /** resolves once the headline's period is built: the drops wait for it */
  life: Promise<void>;
  /** a contact link was hovered or focused: the visitor needs no more inviting */
  onFound(): void;
}

/** a drop in flight: the field cell it gathers under, when it began (ticker clock) and how long it has fallen */
interface Drop {
  column: number;
  row: number;
  born: number;
  fallen: number;
}

/** mounts the mould; the returned function removes it at once */
export function mountHeroMould(hero: HeroField, spill: () => GlyphSpill | null, options: MouldOptions): () => void {
  const section = document.getElementById('top');
  const row = section?.querySelector<HTMLElement>('[data-hero-links]');
  const glyphCanvas = section?.querySelector<HTMLCanvasElement>('canvas[data-glyph]');
  if (!section || !row || !glyphCanvas) return () => {};
  const links = [...row.querySelectorAll<HTMLElement>('a[data-glyph-for]')];

  const shape = shapeOf(BITMAPS.git.rows);
  const limit = Math.floor(shape.pour.length * FILL_SHARE);
  const { canvas, ctx, clear } = createSectionCanvas(section, 'data-mould');
  canvas.style.opacity = '0';
  canvas.style.transition = `opacity ${FADE_IN_MS}ms`;
  const caption = document.createElement('span');
  caption.className = 'pour-caption';
  caption.setAttribute('aria-hidden', 'true');
  caption.textContent = '↑ hover one to pour it';

  const events = new AbortController();
  let ticker: Ticker | null = null;
  let resize: ResizeObserver | null = null;
  let gone = false,
    /** on screen: the hero is wide enough and the first frame is drawn */
    showing = false,
    dripping = false,
    /** a link was found: the exit starts on the next step, and `leftAt` is its ticker clock */
    leaving = false,
    leftAt = -1,
    poured = false;
  /** where the spill's logos stand, from the spill that said so; null after a section or window resize */
  let slot: (GlyphSlot & { of: GlyphSpill }) | null = null;
  let drop: Drop | null = null;
  let landed = 0,
    landedAt = 0,
    nextAt = Infinity;

  /** the section or the window changed size: ask the spill again where it stands */
  const refit = () => {
    slot = null;
    drop = null;
    ticker?.wake();
  };

  const remove = () => {
    gone = true;
    events.abort();
    ticker?.stop();
    resize?.disconnect();
    window.removeEventListener('resize', refit);
    canvas.remove();
    caption.remove();
  };

  const found = (link: HTMLElement) => {
    events.abort();
    options.onFound();
    // nothing on show, so nothing to animate away
    if (!showing) return remove();
    leaving = true;
    poured = (link.dataset.glyphFor as GlyphName) === 'git';
    caption.style.transition = `opacity ${poured ? POUR_EXIT_MS : EXIT_MS}ms steps(6)`;
    caption.classList.remove('on');
    ticker?.wake();
  };

  const hide = () => {
    showing = false;
    slot = null;
    drop = null;
    clear();
    canvas.style.opacity = '0';
    caption.classList.remove('on');
  };

  const step = (clock: number, dt: number): Next => {
    const glyph = spill();
    if (!glyph) return SPILL_WAIT_MS;
    // the narrow hero's spill cycles by itself: the mould stays out of its way until the window widens
    if (isCompactHero(hero.field().cellSize)) {
      if (leaving) remove();
      else hide();
      return null;
    }
    if (slot?.of !== glyph) slot = { ...glyph.refit(), of: glyph };
    if (leaving && leftAt < 0) leftAt = clock;
    /** ms into the exit, or -1 */
    const out = leftAt < 0 ? -1 : clock - leftAt;
    const exitMs = poured ? POUR_EXIT_MS : EXIT_MS;
    if (out >= exitMs) {
      remove();
      return null;
    }
    if (dripping && nextAt === Infinity) nextAt = clock + FIRST_DRIP_MS;

    const { cell } = slot;
    // the mould's top-left cell, in section px: centred in the spill's grid, standing on its bottom edge
    const left = slot.left + Math.floor((slot.columns - shape.width) / 2) * cell,
      top = slot.top + (slot.rows - shape.height) * cell;
    const square = (x: number, y: number, color: string, inset = 1) => {
      ctx.fillStyle = color;
      ctx.fillRect(x + inset, y + inset, cell - inset * 2, cell - inset * 2);
    };
    /** a cell of the mould; on the way out each goes in its own turn, in stepped fades */
    const paint = (at: Cell, color: string) => {
      const k = out < 0 ? 0 : Math.max(0, (out - cellExitStart(at, shape.height, poured)) / CELL_EXIT_MS);
      if (k >= 1) return;
      ctx.globalAlpha = Math.ceil((1 - k) * 4) / 4;
      // GitHub fades in place; otherwise the cells drip away
      square(left + at[0] * cell, top + at[1] * cell + (poured ? 0 : Math.round(k * k * 6) * (cell / 2)), color);
      ctx.globalAlpha = 1;
    };
    clear();
    const age = clock - landedAt;
    drawMould(shape, { limit, landed, age }, clock, paint);
    const bob = Math.floor(clock / BOB_MS) % 2 ? 0 : 0.5;
    const asked = out < 0 ? 0 : out / QUESTION_EXIT_MS;
    if (asked < 1) {
      ctx.globalAlpha = Math.ceil((1 - asked) * 4) / 4;
      const column = (shape.width - QUESTION[0].length) / 2;
      QUESTION.forEach((line, r) =>
        [...line].forEach(
          (ch, c) =>
            ch === '#' && square(left + (column + c) * cell, top + (QUESTION_ROW + r + bob + asked) * cell, INK),
        ),
      );
      ctx.globalAlpha = 1;
    }
    if (!showing) {
      showing = true;
      glyphCanvas.before(canvas);
      row.append(caption);
      // the transition needs a styled starting point
      void getComputedStyle(canvas).opacity;
      canvas.style.opacity = '1';
      caption.classList.add('on');
    }

    // on the way out nothing new gathers; a drop still hanging is let go of (its glow fades by itself),
    // one already falling fades with the "?"
    if (drop && out >= 0 && (asked >= 1 || clock - drop.born < GATHER_MS + HANG_MS)) drop = null;
    const fieldCell = hero.field().cellSize;
    if (out < 0 && !drop && landed < DROPS && clock >= nextAt) {
      const spot = spotAbove(hero.field(), Math.floor((left + (shape.width / 2) * cell) / fieldCell), top);
      if (spot) drop = { ...spot, born: clock, fallen: 0 };
      else nextAt = clock + PAUSE_MS;
    }
    if (drop) {
      const t = clock - drop.born;
      const fromX = drop.column * fieldCell,
        fromY = (drop.row + 3) * fieldCell;
      if (t < GATHER_MS + HANG_MS) {
        glow(drop.column, drop.row, t);
        // the bead swells out under the bulge
        if (t >= GATHER_MS) square(fromX, fromY, HEAT_PALETTE[4]);
        return 0;
      }
      drop.fallen += dt / 1000;
      const target = landingCell(shape, limit, landed);
      const toX = left + target[0] * cell,
        toY = top + target[1] * cell;
      const fell = 0.5 * FALL_GRAVITY * drop.fallen ** 2;
      const k = Math.min(1, fell / (toY - fromY));
      if (k >= 1) {
        drop = null;
        landed++;
        landedAt = clock;
        nextAt = clock + PAUSE_MS;
        return 0;
      }
      ctx.globalAlpha = Math.max(0, 1 - asked);
      // drifts toward its place as it falls, trailing two cooling cells
      const x = fromX + (toX - fromX) * k * k,
        y = fromY + fell;
      square(x, y, HEAT_PALETTE[4]);
      if (fell > cell) square(x, y - cell, HEAT_PALETTE[3], 2);
      if (fell > cell * 2) square(x, y - cell * 2, HEAT_PALETTE[2], 3);
      ctx.globalAlpha = 1;
      return 0;
    }
    if (out >= 0 || (landed && age < SETTLE_MS)) return 0;
    // at rest only the dashes and the "?" move
    const beat = Math.min(msToBeat(clock, CRAWL_MS), msToBeat(clock, BOB_MS));
    return landed < DROPS && nextAt > clock ? Math.min(beat, nextAt - clock) : beat;
  };

  for (const link of links)
    for (const type of ['mouseenter', 'focus'])
      link.addEventListener(type, () => found(link), { signal: events.signal });

  void options.due.then(() => {
    if (gone) return;
    // found before it could appear (a pointer already resting there sends no event): it never does
    const already = links.find((link) => link.matches(':hover, :focus'));
    if (already) return found(already);
    ticker = createTicker(section, step);
    // the spill also depends on the window's height, which can change while the section keeps its own
    window.addEventListener('resize', refit);
    if ('ResizeObserver' in window) {
      resize = new ResizeObserver(refit);
      resize.observe(section);
    }
    void options.life.then(() => {
      dripping = true;
      ticker?.wake();
    });
  });
  return remove;
}
