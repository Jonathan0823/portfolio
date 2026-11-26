// Footer tide: hovering a closing button raises the footer field as a solid wave; as it drains it leaves
// that button's pixel logo standing where the wave reached. Switching buttons submerges the old logo
// completely before the new one is uncovered; leaving washes the logo back down. Mirrors the hero's lava
// spill (which pours down from above) by rising from below.
import { BITMAPS, SMALL_BITMAPS, type GlyphName } from './glyph-model';
import { FINE_POINTER_QUERY, prefersReducedMotion } from './motion';
import type { HeroField } from './hero-field';

/** read by the footer field's shape each step: extra rows over its horizon per column, plus the overlays */
export const tideSwell = {
  rows: new Float32Array(0),
  /** crest heat per column, drawn just under the surface; rewritten every frame so it never lingers */
  crest: new Float32Array(0),
  /** the logo's heat per cell, drawn only where the water has uncovered it; rewritten every frame */
  stamp: new Float32Array(0),
  /** how far below the surface the water is solid: follows the wave's level */
  flood: 0,
};
export const FOOT_BLEED = 320;

/** ms for a full rise / a full drain; a partial move takes its share. The rise eases out, the drain eases in and out */
const RISE_MS = 340;
const EBB_MS = 720;
/** the crest's glow fades over this long once the water stops rising */
const CREST_FADE_MS = 220;
/** rows of water over the top of the logo at full height, and cells of margin either side of it */
const OVER_TOP = 4;
const SIDE_MARGIN = 3;
/** heat the logo is held at once it has cooled (a calm field colour), and when first left behind (hot) */
const LOGO_COOL = 0.46;
const LOGO_HOT = 0.92;
const COOL_MS = 280;
const CREST_HEAT = 0.85;
/** how long the pointer may be between buttons before it counts as leaving them */
const LEAVE_GRACE_MS = 160;
/** rows the wave's top keeps clear below the closing headline */
const HEAD_CLEAR = 3;
const LOGOS: GlyphName[] = ['mail', 'git', 'linkedin', 'resume'];
/** touch: how long each logo stands before the next tide, and the first one's delay once the footer shows */
const CYCLE_MS = 4000;
const CYCLE_FIRST_MS = 600;
/** class on the closing button whose logo is on show while cycling; styled in global.css */
export const TIDE_SHOWN_CLASS = 'tide-shown';

interface Placed {
  cells: Array<[number, number]>;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** mounts the tide for the current pointer type; the returned function removes it again */
export function mountFooterTide(foot: HeroField): () => void {
  const buttons = [...document.querySelectorAll<HTMLAnchorElement>('#contact a[data-pixel-btn]')];
  const nameFor = (a: HTMLAnchorElement): GlyphName =>
    a.href.startsWith('mailto:')
      ? 'mail'
      : /github/.test(a.href)
        ? 'git'
        : /linkedin/.test(a.href)
          ? 'linkedin'
          : 'resume';

  let level = 0, // water height, 0 (calm) .. 1 (logo submerged)
    goal = 0,
    raf = 0;
  // the current move: level eases from `from` to `goal` over `duration`, starting at `start`
  let from = 0,
    start = 0,
    duration = 0,
    crestAt = -Infinity; // last time the water was rising
  /** shownAt: when the drain finished uncovering it; it stays hot until then, then cools */
  let logo: (Placed & { shownAt: number }) | null = null;
  /** the logo the next submersion leaves behind; null means "leave nothing" */
  let wanted: GlyphName | null = null;
  let swapPending = false;

  // touch: the buttons stack across the full width, so the logo stands centred above the field, in a stage made
  // for it under the buttons. The wave stops just under the buttons instead of under the headline
  const stacked = !window.matchMedia(FINE_POINTER_QUERY).matches;
  const overTop = stacked ? 2 : OVER_TOP;
  const skyGap = stacked ? 1 : 4;
  // half-size logos on touch, so the closing screen still fits a phone
  const rowsOf = (name: GlyphName) => (stacked ? SMALL_BITMAPS[name] : BITMAPS[name].rows);

  const head = (to: number, now: number) => {
    if (to === goal && duration) return;
    from = level;
    goal = to;
    start = now;
    duration = Math.abs(to - from) * (to > from ? RISE_MS : EBB_MS);
  };
  const easeOut = (t: number) => 1 - (1 - t) ** 3;
  const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

  /** highest row the wave may reach: a few rows under the closing headline's bottom edge (touch: the buttons') */
  const ceiling = (): number => {
    const field = foot.field();
    const above = stacked
      ? Math.max(...buttons.map((b) => b.getBoundingClientRect().bottom))
      : document.querySelector('#contact h2')?.getBoundingClientRect().bottom;
    if (above === undefined || !Number.isFinite(above)) return field.rows - 1;
    const gap = foot.rect().bottom - above;
    return Math.max(0, Math.min(field.rows - 1, Math.floor(gap / field.cellSize) - (stacked ? 1 : HEAD_CLEAR)));
  };
  /** the lowest row a logo may stand on: a little clear of the field's highest skyline */
  const skyline = () => Math.round(foot.field().hostRows * 0.92) + skyGap;

  // place a logo right of the buttons (touch: centred), standing just above the field's skyline
  const place = (name: GlyphName): Placed => {
    const field = foot.field();
    const rect = foot.rect();
    const bitmap = rowsOf(name);
    const h = bitmap.length,
      w = bitmap[0].length;
    const buttonsRight = Math.max(...buttons.map((b) => b.getBoundingClientRect().right)) - rect.left;
    const centerPx = stacked
      ? rect.width / 2
      : Math.min(rect.width - 96 - (w * field.cellSize) / 2, Math.max(buttonsRight + 200, rect.width * 0.8));
    const left = Math.round(centerPx / field.cellSize - w / 2);
    // a few rows clear of the field's highest skyline, so the logo stands apart instead of merging into it
    // lowered when needed so the wave that covers it (overTop rows above) still stays under the headline
    const bottom = Math.max(0, Math.min(field.rows - h - overTop - 1, skyline(), ceiling() - overTop - h + 1));
    const cells: Array<[number, number]> = [];
    bitmap.forEach((row, i) =>
      [...row].forEach((c, j) => {
        if (c === '#') cells.push([left + j, bottom + (h - 1 - i)]);
      }),
    );
    return { cells, left, right: left + w - 1, top: bottom + h - 1, bottom };
  };

  const frame = (now: number) => {
    raf = 0;
    const field = foot.field();
    const cells = field.columns * field.rows;
    if (tideSwell.rows.length !== field.columns) {
      tideSwell.rows = new Float32Array(field.columns);
      tideSwell.crest = new Float32Array(field.columns);
    }
    if (tideSwell.stamp.length !== cells) tideSwell.stamp = new Float32Array(cells);

    // a fixed-length eased move, so the drain visibly falls instead of dropping and then crawling
    const t = duration ? Math.min(1, Math.max(0, (now - start) / duration)) : 1;
    const rising = goal > from;
    level = from + (goal - from) * (rising ? easeOut(t) : easeInOut(t));
    if (t < 1 && rising) crestAt = now;
    if (t >= 1) duration = 0;
    if (swapPending && level >= goal && goal === 1) {
      // fully under: swap the logo out of sight, then drain
      logo = wanted ? { ...place(wanted), shownAt: Infinity } : null;
      swapPending = false;
      head(0, now);
    }

    // one fixed wave for every button: flat over the widest and tallest logo, with soft shoulders. Its shape
    // never depends on which logo is showing or pending, so hopping between buttons only moves the level
    const extent = LOGOS.map(place);
    const left = Math.min(...extent.map((s) => s.left)) - SIDE_MARGIN;
    const right = Math.max(...extent.map((s) => s.right)) + SIDE_MARGIN;
    const top = Math.min(Math.max(...extent.map((s) => s.top)) + overTop, ceiling());
    const shoulder = (right - left) * 0.35;
    // the crest glows while the water rises and fades shortly after; it is never written into the field's heat
    const glow = CREST_HEAT * Math.max(0, 1 - (now - crestAt) / CREST_FADE_MS);
    // when the logo stands lower than the field's highest skyline (a short window), the calm field dips under it so
    // the whole logo shows instead of half of it sinking into the field. Faded out as the water rises over it
    const dip = logo ? Math.min(0, logo.bottom - 2 - (field.horizonRow + field.hostRows * 0.22)) : 0;
    const dipShoulder = logo ? (logo.right - logo.left) * 0.35 : 1;
    for (let x = 0; x < field.columns; x++) {
      const out = x < left ? left - x : x > right ? x - right : 0;
      const falloff = out ? Math.exp(-((out / shoulder) ** 2)) : 1;
      // a little chop along the crest so it reads as water, not a bump
      const chop = Math.sin(x * 0.7 + now * 0.012) * 1.2 * level;
      const wave = Math.max(0, ((top - field.horizonRow) * falloff + chop) * level);
      const beside = logo ? (x < logo.left - 1 ? logo.left - 1 - x : x > logo.right + 1 ? x - logo.right - 1 : 0) : 0;
      tideSwell.rows[x] = wave + dip * Math.exp(-((beside / dipShoulder) ** 2)) * (1 - level);
      tideSwell.crest[x] = level > 0.05 && falloff > 0.2 ? glow * falloff : 0;
    }

    tideSwell.flood = level;
    tideSwell.stamp.fill(0);
    if (logo) {
      if (level === 0 && logo.shownAt === Infinity) logo.shownAt = now;
      const cool = Math.min(1, Math.max(0, (now - logo.shownAt) / COOL_MS));
      const heat = LOGO_HOT + (LOGO_COOL - LOGO_HOT) * cool * cool * (3 - 2 * cool);
      // the field draws it only above the surface, so it is uncovered as the water drains past it. A one-cell
      // clearing around it (negative) keeps the field's loose top pixels out of it, so it doesn't merge in
      for (let y = Math.max(0, logo.bottom - 1); y <= Math.min(field.rows - 1, logo.top + 1); y++)
        for (let x = Math.max(0, logo.left - 1); x <= Math.min(field.columns - 1, logo.right + 1); x++)
          tideSwell.stamp[y * field.columns + x] = -1;
      for (const [x, y] of logo.cells)
        if (x >= 0 && x < field.columns && y >= 0 && y < field.rows) tideSwell.stamp[y * field.columns + x] = heat;
    }
    foot.markDirty();
    const settled = level === 0 && goal === 0 && !duration;
    const cooling = !!logo && now - logo.shownAt < COOL_MS;
    if (!settled || cooling || glow > 0) raf = requestAnimationFrame(frame);
    // at rest the rows hold only the dip under the logo (the wave is at level 0), so they stay as they are
    else tideSwell.crest.fill(0);
  };
  const run = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  let leaveTimer = 0;
  const submerge = (next: GlyphName | null) => {
    clearTimeout(leaveTimer);
    if (prefersReducedMotion()) {
      // no wave: the logo simply appears in its calm colours, or goes
      logo = next ? { ...place(next), shownAt: -Infinity } : null;
      swapPending = false;
      level = goal = from = duration = 0;
      run();
      return;
    }
    wanted = next;
    swapPending = true;
    head(1, performance.now());
    run();
  };
  // everything this mount adds to the page, so it can be undone when the pointer type changes
  const events = new AbortController();
  const { signal } = events;
  const host = document.querySelector<HTMLElement>('[data-pixel-field="foot"]');
  let stopCycle = () => {};
  if (stacked && host) {
    // grow the gap between the buttons and the field until the tallest logo and its wave fit under the buttons
    const tallest = Math.max(...LOGOS.map((n) => rowsOf(n).length));
    const stage = () => {
      const short = skyline() + tallest - 1 + overTop - ceiling();
      const margin = parseFloat(host.style.marginTop) || 0;
      host.style.marginTop = `${Math.max(0, margin + short * foot.field().cellSize)}px`;
    };
    stage();
    addEventListener('resize', stage, { signal });
    stopCycle = cycle(host, buttons, nameFor, submerge, signal);
  } else if (!stacked) {
    for (const button of buttons) {
      const name = nameFor(button);
      button.addEventListener('mouseenter', () => submerge(name), { signal });
      button.addEventListener('focus', () => submerge(name), { signal });
      // crossing the gap between two buttons shouldn't count as leaving: wait a beat before washing away
      const leave = () => {
        clearTimeout(leaveTimer);
        leaveTimer = window.setTimeout(() => submerge(null), LEAVE_GRACE_MS);
      };
      button.addEventListener('mouseleave', leave, { signal });
      button.addEventListener('blur', leave, { signal });
    }
  }
  return () => {
    events.abort();
    stopCycle();
    clearTimeout(leaveTimer);
    cancelAnimationFrame(raf);
    buttons.forEach((b) => b.classList.remove(TIDE_SHOWN_CLASS));
    if (host) host.style.marginTop = '';
    tideSwell.rows.fill(0);
    tideSwell.crest.fill(0);
    tideSwell.stamp.fill(0);
    tideSwell.flood = 0;
    foot.markDirty();
  };
}

/** touch has no hover, and a tap opens the link: cycle the logos on a timer while the footer is on screen */
function cycle(
  host: HTMLElement,
  buttons: HTMLAnchorElement[],
  nameFor: (a: HTMLAnchorElement) => GlyphName,
  submerge: (next: GlyphName | null) => void,
  signal: AbortSignal,
): () => void {
  if (!buttons.length) return () => {};
  let index = -1,
    timer = 0,
    visible = false;
  const show = () => {
    index = (index + 1) % buttons.length;
    buttons.forEach((b, i) => b.classList.toggle(TIDE_SHOWN_CLASS, i === index));
    submerge(nameFor(buttons[index]));
  };
  if (prefersReducedMotion()) {
    // no cycling: the first logo just stands there
    show();
    return () => {};
  }
  const arm = () => {
    clearTimeout(timer);
    timer = 0;
    if (!visible || document.hidden) return;
    timer = window.setTimeout(
      () => {
        show();
        arm();
      },
      index < 0 ? CYCLE_FIRST_MS : CYCLE_MS,
    );
  };
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    arm();
  });
  io.observe(host);
  document.addEventListener('visibilitychange', arm, { signal });
  return () => {
    io.disconnect();
    clearTimeout(timer);
  };
}
