import { HEAT_PALETTE, fbm, hash } from './pixel-math';
import { BITMAPS, assignPixels, glyphCanvasLayout, pickSourceColumns, type GlyphCanvasLayout, type GlyphName } from './glyph-model';
import { FINE_POINTER_QUERY } from './motion';
import type { HeroField } from './hero-field';

const GLYPH_COLUMNS = 28;
const GLYPH_ROWS = 28; // tallest icon, in cells
const SHIMMER_INTERVAL_MS = 50;
const CYCLE_MS = 3500;
const CYCLE_AFTER_TOUCH_MS = 6000;
const NAMES: GlyphName[] = ['mail', 'git', 'linkedin'];
/** Desktop: hero side padding (md:px-24), nav clearance, gap between text and icon. Compact: px-5 and the mobile nav. */
const DESKTOP = { rightMargin: 96, minTop: 64, gap: 40 };
const COMPACT = { rightMargin: 20, minTop: 60, gap: 16 };

interface Particle {
  targetColumn: number;
  targetRow: number;
  sourceColumn: number;
  sourceRow: number;
  /** length of the vertical leg of the path, then of the whole path */
  verticalLength: number;
  pathLength: number;
  startedAt: number;
  delay: number;
  fadingOut: boolean;
  column: number;
  row: number;
  sourceIndex: number;
  fadeFromRow?: number;
  level?: number;
  /** +1 when the particle falls into place, -1 when it rises; fading out continues that way */
  lift: number;
}
interface Source {
  column: number;
  row: number;
  /** palette bucket of the field cell the particles rise from */
  bucket: number;
}

/**
 * Glyph spill: pixels leave the hero field and form the icon of a hero link.
 * Desktop: pixels fall from the field to an icon level with the headline block, shown while a link is
 * hovered or focused. Compact screens and touch devices: the icon is drawn at half the field's cell
 * size in the paper beside the headline, pixels still fall from the field, and the icons cycle while
 * the hero is on screen. Under reduced
 * motion the icon appears at once and nothing cycles. Returns a function that removes the listeners.
 */
export function mountGlyphSpill(canvas: HTMLCanvasElement, hero: HeroField, reduced = false): () => void {
  const ctx = canvas.getContext('2d')!;
  const section = canvas.closest('section') ?? canvas.parentElement!;
  const textBlocks = [...section.querySelectorAll<HTMLElement>('[data-glyph-text]')];
  const fineQuery = window.matchMedia(FINE_POINTER_QUERY);
  let particles: Particle[] = [];
  let sources: Source[] = [];
  let raf = 0, timer = 0, cycleTimer = 0, fallbackTime = 0, sizeKey = '';
  let onScreen = true;
  let current: GlyphName | null = null;
  let cycleIndex = -1;
  let layout: GlyphCanvasLayout;
  /** icon pixel size, and the field's cell size (the icon uses half of it on phones) */
  let cell = 10, fieldCell = 10;
  let overField = false;

  const canRun = () => onScreen && !document.hidden;
  const isCompact = () => hero.field().cellSize < 10;
  /** Phones, small windows and touch screens have no hover, so the icons show on their own. */
  const autoShow = () => isCompact() || !fineQuery.matches;
  const autoCycle = () => autoShow() && !reduced;

  /** Extent of the headline block's text (not its boxes) relative to the hero. */
  const measureText = (heroRect: DOMRect, blocks: HTMLElement[]) => {
    let right = 0, top = Infinity, bottom = 0;
    for (const block of blocks) {
      const box = block.getBoundingClientRect();
      top = Math.min(top, box.top - heroRect.top);
      bottom = Math.max(bottom, box.bottom - heroRect.top);
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue;
        range.selectNodeContents(node);
        right = Math.max(right, range.getBoundingClientRect().right - heroRect.left);
      }
    }
    return { right, top: Number.isFinite(top) ? top : 0, bottom };
  };

  /** Computes the layout from the measured elements and places the canvas. */
  const layoutCanvas = (): GlyphCanvasLayout => {
    const field = hero.field();
    fieldCell = field.cellSize;
    const compact = isCompact();
    cell = compact ? fieldCell / 2 : fieldCell;
    const heroRect = section.getBoundingClientRect();
    // On phones the icon sits beside the headline only; the lines below it span the full width.
    const text = measureText(heroRect, compact ? textBlocks.slice(0, 1) : textBlocks);
    layout = glyphCanvasLayout({
      heroWidth: heroRect.width,
      cell,
      columns: GLYPH_COLUMNS,
      glyphRows: GLYPH_ROWS,
      ...(compact ? COMPACT : DESKTOP),
      textRight: text.right,
      textTop: text.top,
      textBottom: text.bottom,
      limitBottom: Math.min(heroRect.height, window.innerHeight) - 2 * fieldCell,
    });
    overField = layout.height - GLYPH_ROWS * cell < field.height;
    canvas.style.left = layout.left + 'px';
    canvas.style.top = layout.top + 'px';
    canvas.style.width = layout.width + 'px';
    canvas.style.height = layout.height + 'px';
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const key = [layout.width, layout.height, ratio].join('x');
    if (key !== sizeKey) {
      sizeKey = key;
      canvas.width = layout.width * ratio;
      canvas.height = layout.height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    return layout;
  };
  layoutCanvas();

  const pickSources = (): Source[] => {
    const field = hero.field();
    const usable = field.cellSize === fieldCell;
    const ratio = fieldCell / cell; // icon pixels per field cell
    const fallbackRow = 20 * ratio;
    const originField = layout.left / fieldCell;
    const lowestRows: number[] = [];
    for (let i = 0; i < GLYPH_COLUMNS; i++) {
      const fieldRow = field.lowestRow[Math.floor(originField + i / ratio)];
      lowestRows.push(usable && fieldRow !== undefined && fieldRow >= 0 ? (fieldRow + 1) * ratio - 1 : fallbackRow);
    }
    return pickSourceColumns(lowestRows).map((column) => ({
      column,
      row: lowestRows[column] + 1, // canvas rows are the field's rows: it starts at the hero's top
      bucket: usable ? field.lowestBucket[Math.floor(originField + column / ratio)] : 1,
    }));
  };

  const spill = (name: GlyphName | null) => {
    layoutCanvas();
    const now = performance.now();
    if (reduced) particles = [];
    for (const particle of particles) {
      if (!particle.fadingOut) {
        particle.fadingOut = true;
        particle.startedAt = now;
        particle.fadeFromRow = particle.row;
        particle.delay = hash(particle.targetColumn, particle.targetRow) * 0.12;
      }
    }
    if (name) {
      sources = pickSources();
      const pixelsBySource = assignPixels(BITMAPS[name], GLYPH_COLUMNS, layout.rows, sources.map((s) => s.column), layout.rising);
      pixelsBySource.forEach((pixels, sourceIndex) => {
        const source = sources[sourceIndex];
        pixels.forEach((pixel, order) => {
          const verticalLength = Math.abs(pixel.row - source.row);
          particles.push({
            targetColumn: pixel.column,
            targetRow: pixel.row,
            sourceColumn: source.column,
            sourceRow: source.row,
            verticalLength,
            pathLength: verticalLength + Math.abs(pixel.column - source.column),
            startedAt: reduced ? now - 1e6 : now,
            delay: (order / pixels.length) * 0.9 + sourceIndex * 0.03,
            fadingOut: false,
            column: source.column,
            row: source.row - (layout.rising ? -1 : 1),
            sourceIndex,
            lift: layout.rising ? -1 : 1,
          });
        });
      });
    }
    kick();
  };

  /** Position along a particle's path after travelling `distance` cells: toward the target row, then sideways. */
  const positionAt = (p: Particle, distance: number): [number, number] =>
    distance < p.verticalLength
      ? [p.sourceColumn, p.sourceRow + Math.sign(p.targetRow - p.sourceRow) * distance]
      : [
          p.sourceColumn + Math.sign(p.targetColumn - p.sourceColumn) * Math.min(Math.abs(p.targetColumn - p.sourceColumn), distance - p.verticalLength),
          p.targetRow,
        ];

  const loop = (now: number) => {
    raf = 0;
    if (!canRun()) return;
    if (!reduced) fallbackTime += 0.02;
    const fieldTime = hero.time() || fallbackTime;
    ctx.clearRect(0, 0, layout.width, layout.height);
    let moving = false;
    const draws: Array<{ column: number; row: number; alpha: number; level: number; trail: [number, number] | null }> = [];
    particles = particles.filter((p) => {
      const elapsed = (now - p.startedAt) / 1000 - p.delay;
      let alpha = 1, inMotion = false, trailPos: [number, number] | null = null;
      if (!p.fadingOut) {
        if (elapsed < 0) return true;
        const distance = Math.min(p.pathLength, (fieldCell / cell) * (26 * elapsed + 30 * elapsed * elapsed));
        const [column, row] = positionAt(p, distance);
        p.column = column;
        p.row = row;
        inMotion = distance < p.pathLength;
        if (inMotion) trailPos = positionAt(p, Math.max(0, distance - 1.2));
      } else if (elapsed > 0) {
        const progress = elapsed / 0.55;
        p.row = (p.fadeFromRow ?? p.row) + p.lift * (fieldCell / cell) * 30 * progress * progress;
        alpha = Math.max(0, 1 - progress * 1.6);
        inMotion = true;
        if (alpha <= 0) return false;
      }
      if (inMotion) moving = true;
      const bucket = sources[p.sourceIndex] ? sources[p.sourceIndex].bucket : (p.level ?? 1);
      p.level = bucket;
      const level = Math.max(0, Math.min(5, bucket - (fbm(Math.round(p.column) * 0.3 - fieldTime * 0.9, Math.floor(p.row) * 0.3) < 0.45 ? 1 : 0)));
      draws.push({ column: Math.round(p.column), row: Math.floor(p.row), alpha, level, trail: trailPos });
      return true;
    });
    if (overField) {
      // Over the field the icon needs a paper outline, one pixel wide, to stay readable.
      ctx.fillStyle = '#ffffff';
      for (const d of draws) {
        ctx.globalAlpha = d.alpha;
        ctx.fillRect((d.column - 1) * cell, (d.row - 1) * cell, cell * 3, cell * 3);
      }
    }
    for (const d of draws) {
      ctx.fillStyle = HEAT_PALETTE[d.level];
      if (d.trail) {
        ctx.globalAlpha = d.alpha * 0.5;
        ctx.fillRect(Math.round(d.trail[0]) * cell + 1, Math.floor(d.trail[1]) * cell + 1, cell - 1, cell - 1);
      }
      ctx.globalAlpha = d.alpha;
      ctx.fillRect(d.column * cell + 1, d.row * cell + 1, cell - 1, cell - 1);
    }
    ctx.globalAlpha = 1;
    if (moving) raf = requestAnimationFrame(loop);
    // Settled particles still shimmer with the field, at a slow rate (not under reduced motion); with none left the loop ends.
    else if (particles.length && !reduced) timer = window.setTimeout(() => { timer = 0; kick(); }, SHIMMER_INTERVAL_MS);
  };
  const kick = () => {
    if (timer) { clearTimeout(timer); timer = 0; }
    if (!raf && canRun()) raf = requestAnimationFrame(loop);
  };
  const halt = () => {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    raf = 0;
    timer = 0;
  };

  // Showing an icon: by hover/focus/touch, or by the cycle on compact and touch screens.
  const stopCycle = () => { clearTimeout(cycleTimer); cycleTimer = 0; };
  const armCycle = (delay: number) => {
    stopCycle();
    if (!autoCycle() || !canRun()) return;
    cycleTimer = window.setTimeout(() => {
      cycleTimer = 0;
      cycleIndex = (cycleIndex + 1) % NAMES.length;
      current = NAMES[cycleIndex];
      spill(current);
      armCycle(CYCLE_MS);
    }, delay);
  };
  /** Starts whatever the screen calls for: the cycle, a static icon, or nothing. */
  const settleMode = () => {
    if (autoCycle()) armCycle(current ? CYCLE_MS : 300);
    else if (autoShow()) { if (!current) { cycleIndex = 0; current = NAMES[0]; } spill(current); }
    else { stopCycle(); if (current && !hovered) { current = null; spill(null); } }
  };
  let hovered: GlyphName | null = null;

  const show = (name: GlyphName) => {
    hovered = name;
    current = name;
    cycleIndex = NAMES.indexOf(name);
    spill(name);
    if (autoCycle()) armCycle(CYCLE_AFTER_TOUCH_MS);
  };
  const hide = () => {
    hovered = null;
    if (autoShow()) return; // compact and touch screens keep their icon
    current = null;
    spill(null);
  };

  let resizeFrame = 0;
  const onResize = () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      layoutCanvas();
      if (current) spill(current);
      settleMode();
    });
  };
  window.addEventListener('resize', onResize);
  const onVisibility = () => {
    if (document.hidden) { halt(); stopCycle(); }
    else { kick(); settleMode(); }
  };
  document.addEventListener('visibilitychange', onVisibility);
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        onScreen = entries[entries.length - 1].isIntersecting;
        if (onScreen) { kick(); settleMode(); }
        else { halt(); stopCycle(); }
      })
    : null;
  io?.observe(section);
  if (!io) settleMode();

  const removers: Array<() => void> = [];
  document.querySelectorAll<HTMLElement>('[data-glyph-for]').forEach((link) => {
    const name = link.dataset.glyphFor as GlyphName;
    if (!(name in BITMAPS)) return;
    const on = () => show(name);
    const events: Array<[string, () => void]> = [['mouseenter', on], ['mouseleave', hide], ['focus', on], ['blur', hide], ['touchstart', on]];
    events.forEach(([type, handler]) => link.addEventListener(type, handler, { passive: true }));
    removers.push(() => events.forEach(([type, handler]) => link.removeEventListener(type, handler)));
  });

  return () => {
    removers.forEach((remove) => remove());
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', onResize);
    cancelAnimationFrame(resizeFrame);
    io?.disconnect();
    halt();
    stopCycle();
    particles = [];
    ctx.clearRect(0, 0, layout.width, layout.height);
  };
}
