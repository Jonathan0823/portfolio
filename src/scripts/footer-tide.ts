// Footer tide: hovering a closing button raises the footer field as a solid wave; as it drains it leaves
// that button's pixel logo standing where the wave reached. Switching buttons submerges the old logo
// completely before the new one is uncovered; leaving washes the logo back down. Mirrors the hero's lava
// spill (which pours down from above) by rising from below.
import { BITMAPS, type GlyphName } from './glyph-model';
import { FINE_POINTER_QUERY, prefersReducedMotion } from './motion';
import type { HeroField } from './hero-field';

/** read by the footer field's shape each step: extra rows over its horizon per column, plus the overlays */
export const tideSwell = {
  rows: new Float32Array(0),
  /** crest heat per column, drawn just under the surface; rewritten every frame so it never lingers */
  crest: new Float32Array(0),
  /** the logo's heat per cell, drawn only where the water has uncovered it; rewritten every frame */
  stamp: new Float32Array(0),
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

interface Placed {
  cells: Array<[number, number]>;
  left: number;
  right: number;
  top: number;
}

export function mountFooterTide(foot: HeroField): void {
  if (!window.matchMedia(FINE_POINTER_QUERY).matches) return;
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

  const head = (to: number, now: number) => {
    if (to === goal && duration) return;
    from = level;
    goal = to;
    start = now;
    duration = Math.abs(to - from) * (to > from ? RISE_MS : EBB_MS);
  };
  const easeOut = (t: number) => 1 - (1 - t) ** 3;
  const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

  /** highest row the wave may reach: a few rows under the closing headline's bottom edge */
  const ceiling = (): number => {
    const heading = document.querySelector('#contact h2');
    const field = foot.field();
    if (!heading) return field.rows - 1;
    const gap = foot.rect().bottom - heading.getBoundingClientRect().bottom;
    return Math.max(0, Math.min(field.rows - 1, Math.floor(gap / field.cellSize) - HEAD_CLEAR));
  };

  // place a logo right of the buttons, standing just above the field's skyline
  const place = (name: GlyphName): Placed => {
    const field = foot.field();
    const rect = foot.rect();
    const bitmap = BITMAPS[name].rows;
    const h = bitmap.length,
      w = bitmap[0].length;
    const buttonsRight = Math.max(...buttons.map((b) => b.getBoundingClientRect().right)) - rect.left;
    const centerPx = Math.min(
      rect.width - 96 - (w * field.cellSize) / 2,
      Math.max(buttonsRight + 200, rect.width * 0.8),
    );
    const left = Math.round(centerPx / field.cellSize - w / 2);
    // a few rows clear of the field's highest skyline, so the logo stands apart instead of merging into it
    // lowered when needed so the wave that covers it (OVER_TOP rows above) still stays under the headline
    const bottom = Math.max(
      0,
      Math.min(field.rows - h - OVER_TOP - 1, Math.round(field.hostRows * 0.92) + 4, ceiling() - OVER_TOP - h + 1),
    );
    const cells: Array<[number, number]> = [];
    bitmap.forEach((row, i) =>
      [...row].forEach((c, j) => {
        if (c === '#') cells.push([left + j, bottom + (h - 1 - i)]);
      }),
    );
    return { cells, left, right: left + w - 1, top: bottom + h - 1 };
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
    const top = Math.min(Math.max(...extent.map((s) => s.top)) + OVER_TOP, ceiling());
    const shoulder = (right - left) * 0.35;
    // the crest glows while the water rises and fades shortly after; it is never written into the field's heat
    const glow = CREST_HEAT * Math.max(0, 1 - (now - crestAt) / CREST_FADE_MS);
    for (let x = 0; x < field.columns; x++) {
      const out = x < left ? left - x : x > right ? x - right : 0;
      const falloff = out ? Math.exp(-((out / shoulder) ** 2)) : 1;
      // a little chop along the crest so it reads as water, not a bump
      const chop = Math.sin(x * 0.7 + now * 0.012) * 1.2 * level;
      tideSwell.rows[x] = Math.max(0, ((top - field.horizonRow) * falloff + chop) * level);
      tideSwell.crest[x] = level > 0.05 && falloff > 0.2 ? glow * falloff : 0;
    }

    tideSwell.stamp.fill(0);
    if (logo) {
      if (level === 0 && logo.shownAt === Infinity) logo.shownAt = now;
      const cool = Math.min(1, Math.max(0, (now - logo.shownAt) / COOL_MS));
      const heat = LOGO_HOT + (LOGO_COOL - LOGO_HOT) * cool * cool * (3 - 2 * cool);
      // the field draws it only above the surface, so it is uncovered as the water drains past it
      for (const [x, y] of logo.cells)
        if (x >= 0 && x < field.columns && y >= 0 && y < field.rows) tideSwell.stamp[y * field.columns + x] = heat;
    }
    foot.markDirty();
    const settled = level === 0 && goal === 0 && !duration;
    const cooling = !!logo && now - logo.shownAt < COOL_MS;
    if (!settled || cooling || glow > 0) raf = requestAnimationFrame(frame);
    else {
      tideSwell.rows.fill(0);
      tideSwell.crest.fill(0);
    }
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
  for (const button of buttons) {
    const name = nameFor(button);
    button.addEventListener('mouseenter', () => submerge(name));
    button.addEventListener('focus', () => submerge(name));
    // crossing the gap between two buttons shouldn't count as leaving: wait a beat before washing away
    const leave = () => {
      clearTimeout(leaveTimer);
      leaveTimer = window.setTimeout(() => submerge(null), LEAVE_GRACE_MS);
    };
    button.addEventListener('mouseleave', leave);
    button.addEventListener('blur', leave);
  }
}
