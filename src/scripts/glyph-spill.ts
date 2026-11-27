import { HEAT_PALETTE, fbm, hash } from './pixel-math';
import {
  BITMAPS,
  assignPixels,
  fittingCell,
  glyphCanvasLayout,
  isCompactHero,
  pickSourceColumns,
  sourceBucket,
  type GlyphCanvasLayout,
  type GlyphName,
} from './glyph-model';
import { FINE_POINTER_QUERY } from './motion';
import type { HeroField } from './hero-field';

const GLYPH_COLUMNS = 28;
const GLYPH_ROWS = 28;
const SHIMMER_INTERVAL_MS = 50;
const CYCLE_MS = 3500;
const CYCLE_AFTER_TOUCH_MS = 6000;
const NAMES: GlyphName[] = ['mail', 'git', 'linkedin'];
const DESKTOP = { rightMargin: 96, minTop: 64, gap: 40 };
const COMPACT = { rightMargin: 20, minTop: 60, gap: 16 };
/** how far the desktop logos shrink to stay beside the text, as a share of the field's cell */
const MIN_CELL_SHARE = 0.6;

interface Particle {
  targetColumn: number;
  targetRow: number;
  sourceRow: number;
  startedAt: number;
  delay: number;
  fadingOut: boolean;
  column: number;
  row: number;
  sourceIndex: number;
  fadeFromRow?: number;
  level?: number;
  /** the glyph row the drop leaves the field at: a hot spout above it, else the field's bottom edge */
  lavaFrom?: number;
  /** the glyph column of that spout; the drop drifts from it to its own column as it falls */
  lavaColumn?: number;
}
interface Source {
  column: number;
  row: number;
  bucket: number;
}

const SPILL_SPEED = 1.6;
/** molten drops ooze off the field, fall under gravity with a glowing streak, splat, and cool into place bottom-up */
const LAVA_GRAVITY = 150; // cells/s²
const LAVA_OOZE = 0.14; // s hanging at the field before letting go
const LAVA_COOL = 0.16; // s per heat level while cooling

/** where the spill's logos stand: its grid's box in section px, in cells of `cell` px */
export interface GlyphSlot {
  left: number;
  top: number;
  columns: number;
  rows: number;
  cell: number;
}

export interface GlyphSpill {
  /** lays the grid out for the hero as it is now, retracts a logo it showed by itself while compact, and says where it is */
  refit(): GlyphSlot;
  stop(): void;
}

export function mountGlyphSpill(canvas: HTMLCanvasElement, hero: HeroField, reduced = false): GlyphSpill {
  const ctx = canvas.getContext('2d')!;
  const section = canvas.closest('section') ?? canvas.parentElement!;
  const textBlocks = [...section.querySelectorAll<HTMLElement>('[data-glyph-text]')];
  const fineQuery = window.matchMedia(FINE_POINTER_QUERY);
  let particles: Particle[] = [];
  let sources: Source[] = [];
  let raf = 0,
    timer = 0,
    cycleTimer = 0,
    fallbackTime = 0,
    sizeKey = '';
  let onScreen = true;
  let current: GlyphName | null = null;
  let cycleIndex = -1;
  let layout: GlyphCanvasLayout;
  let cell = 10,
    fieldCell = 10;

  const canRun = () => onScreen && !document.hidden;
  const isCompact = () => isCompactHero(hero.field().cellSize);
  const autoShow = () => isCompact() || !fineQuery.matches;
  const autoCycle = () => autoShow() && !reduced;

  const measureText = (heroRect: DOMRect, blocks: HTMLElement[]) => {
    let right = 0,
      top = Infinity,
      bottom = 0;
    for (const block of blocks) {
      const box = block.getBoundingClientRect();
      top = Math.min(top, box.top - heroRect.top);
      bottom = Math.max(bottom, box.bottom - heroRect.top);
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        // screen-reader text takes no room, but its range would measure as if it did
        if (!node.textContent?.trim() || node.parentElement?.closest('.sr-only')) continue;
        range.selectNodeContents(node);
        right = Math.max(right, range.getBoundingClientRect().right - heroRect.left);
      }
    }
    return { right, top: Number.isFinite(top) ? top : 0, bottom };
  };

  const layoutCanvas = (): GlyphCanvasLayout => {
    const field = hero.field();
    fieldCell = field.cellSize;
    const compact = isCompact();
    const heroRect = section.getBoundingClientRect();
    const text = measureText(heroRect, compact ? textBlocks.slice(0, 1) : textBlocks);
    cell = compact
      ? fieldCell / 2
      : fittingCell({
          heroWidth: heroRect.width,
          cell: fieldCell,
          minCell: fieldCell * MIN_CELL_SHARE,
          columns: GLYPH_COLUMNS,
          textRight: text.right,
          ...DESKTOP,
        });
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
    canvas.style.left = layout.left + 'px';
    canvas.style.top = layout.top + 'px';
    canvas.style.width = layout.width + 'px';
    canvas.style.height = layout.height + 'px';
    canvas.classList.remove('hidden');
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
    const ratio = fieldCell / cell;
    const fallbackRow = 20 * ratio;
    const originField = layout.left / fieldCell;
    const lowestRows: number[] = [];
    for (let i = 0; i < GLYPH_COLUMNS; i++) {
      const fieldRow = field.lowestRow[Math.floor(originField + i / ratio)];
      lowestRows.push(usable && fieldRow !== undefined && fieldRow >= 0 ? (fieldRow + 1) * ratio - 1 : fallbackRow);
    }
    return pickSourceColumns(lowestRows).map((column) => {
      const fieldColumn = Math.floor(originField + column / ratio);
      return {
        column,
        row: lowestRows[column] + 1,
        bucket: usable ? sourceBucket(field.lowestRow[fieldColumn], field.lowestBucket[fieldColumn]) : 1,
      };
    });
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
      const pixelsBySource = assignPixels(
        BITMAPS[name],
        GLYPH_COLUMNS,
        layout.rows,
        sources.map((s) => s.column),
        layout.rising,
      );
      // where the field's bottom edge sits over each glyph column, in glyph rows
      const field = hero.field();
      const ratio = fieldCell / cell;
      const lavaEdge = Array.from({ length: GLYPH_COLUMNS }, (_, i) => {
        const fieldRow =
          field.cellSize === fieldCell ? field.lowestRow[Math.floor(layout.left / fieldCell + i / ratio)] : -1;
        return fieldRow !== undefined && fieldRow >= 0 ? ((fieldRow + 1) * fieldCell - layout.top) / cell - 1 : -1;
      });
      // spouts: the bottom of each orange/yellow run in the field, per glyph column, in glyph rows
      const fieldColumnOf = (i: number) => Math.floor(layout.left / fieldCell + i / ratio);
      const toGlyphRow = (fieldRow: number) => ((fieldRow + 1) * fieldCell - layout.top) / cell - 1;
      const spouts = Array.from({ length: GLYPH_COLUMNS }, (_, i) => {
        const found: number[] = [];
        const fc = fieldColumnOf(i);
        if (field.cellSize !== fieldCell || fc < 0 || fc >= field.columns) return found;
        for (let r = 0; r < field.rows; r++) {
          const hot = field.bucket[r * field.columns + fc] >= 4;
          const below = r + 1 < field.rows && field.bucket[(r + 1) * field.columns + fc] >= 4;
          if (hot && !below) found.push(toGlyphRow(r));
        }
        return found;
      });
      /** the nearest hot spout above a pixel: its column and row, searching outward a few columns */
      const spoutFor = (column: number, row: number): [number, number] | null => {
        for (let reach = 0; reach <= 6; reach++) {
          for (const c of reach ? [column - reach, column + reach] : [column]) {
            const rows = spouts[c]?.filter((r) => r < row - 1);
            if (rows?.length) return [c, Math.max(...rows)];
          }
        }
        return null;
      };
      pixelsBySource.forEach((pixels, sourceIndex) => {
        const source = sources[sourceIndex];
        pixels.forEach((pixel) => {
          particles.push({
            targetColumn: pixel.column,
            targetRow: pixel.row,
            ...(() => {
              const spout = spoutFor(pixel.column, pixel.row);
              return spout
                ? { lavaFrom: spout[1], lavaColumn: spout[0] }
                : { lavaFrom: lavaEdge[pixel.column], lavaColumn: pixel.column };
            })(),
            sourceRow: source.row,
            startedAt: reduced ? now - 1e6 : now,
            // the glyph fills from the bottom up, like a pouring mould
            delay:
              (pixel.row <= lavaEdge[pixel.column] ? 0 : 0.15 + (1 - pixel.row / layout.rows) * 0.6) +
              hash(pixel.column, pixel.row, 7) * 0.18,
            fadingOut: false,
            column: source.column,
            row: source.row - (layout.rising ? -1 : 1),
            sourceIndex,
          });
        });
      });
    }
    kick();
  };

  const loop = (now: number) => {
    raf = 0;
    if (!canRun()) return;
    if (!reduced) fallbackTime += 0.02;
    const fieldTime = hero.time() || fallbackTime;
    ctx.clearRect(0, 0, layout.width, layout.height);
    let moving = false;
    const draws: Array<{
      column: number;
      row: number;
      alpha: number;
      level: number;
      streak: number;
      falling: boolean;
    }> = [];
    particles = particles.filter((p) => {
      const elapsed = ((now - p.startedAt) / 1000) * SPILL_SPEED - p.delay;
      let alpha = 1,
        inMotion = false;
      let falling = false,
        heat = -1,
        streak = 0;
      if (!p.fadingOut) {
        if (elapsed < 0) return true;
        const from = Math.min(p.lavaFrom ?? -1, p.targetRow);
        // under the field the pixel drips from the field's edge; inside it, it melts out where it is
        const span = p.targetRow - from;
        const fall = Math.max(0, elapsed - LAVA_OOZE);
        const drop = 0.5 * LAVA_GRAVITY * fall * fall;
        const fallTime = Math.sqrt((2 * span) / LAVA_GRAVITY);
        p.column = p.targetColumn;
        falling = false;
        if (span <= 0) {
          p.row = p.targetRow;
          heat = 5 - Math.floor(Math.max(0, elapsed - LAVA_OOZE) / LAVA_COOL);
          inMotion = heat >= 0;
        } else if (drop < span) {
          // oozing out of the field, then falling with a streak that grows with speed
          p.row = from + (elapsed < LAVA_OOZE ? (elapsed / LAVA_OOZE) * 0.8 : 0.8 + drop);
          const t = Math.min(1, drop / span);
          p.column = (p.lavaColumn ?? p.targetColumn) + (p.targetColumn - (p.lavaColumn ?? p.targetColumn)) * t * t;
          falling = true;
          streak = Math.min(4, Math.round(LAVA_GRAVITY * fall * 0.035));
          heat = 5;
          inMotion = true;
        } else {
          const landed = fall - fallTime;
          // splat: a one-cell squash past the spot, then settle
          p.row = p.targetRow + (landed < 0.05 ? 1 : 0);
          heat = 5 - Math.floor(landed / LAVA_COOL);
          inMotion = heat >= 0;
        }
      } else if (elapsed > 0) {
        const progress = elapsed / 0.55;
        p.row = (p.fadeFromRow ?? p.row) + (fieldCell / cell) * 30 * progress * progress;
        // on the way out it re-melts and runs off, glowing
        heat = 4 - Math.floor(progress * 3);
        streak = Math.min(3, Math.round(progress * 6));
        alpha = Math.max(0, 1 - progress * 1.6);
        inMotion = true;
        if (alpha <= 0) return false;
      }
      if (inMotion) moving = true;
      const bucket = sources[p.sourceIndex] ? sources[p.sourceIndex].bucket : (p.level ?? 1);
      p.level = bucket;
      const level = Math.max(
        0,
        Math.min(
          5,
          bucket - (fbm(Math.round(p.column) * 0.3 - fieldTime * 0.9, Math.floor(p.row) * 0.3) < 0.45 ? 1 : 0),
        ),
      );
      draws.push({
        column: Math.round(p.column),
        row: Math.floor(p.row),
        alpha,
        level: heat >= 0 ? Math.max(level, heat) : level,
        streak,
        falling,
      });
      return true;
    });
    for (const d of draws) {
      // a molten streak trails behind a falling drop, cooling toward its tail
      for (let k = 1; k <= d.streak; k++) {
        ctx.globalAlpha = d.alpha * (1 - k / (d.streak + 1));
        ctx.fillStyle = HEAT_PALETTE[Math.max(0, Math.min(5, d.level - k))];
        ctx.fillRect(d.column * cell, (d.row - k) * cell, cell, cell);
      }
      ctx.fillStyle = HEAT_PALETTE[d.level];
      ctx.globalAlpha = d.alpha;
      ctx.fillRect(d.column * cell, d.row * cell, cell, cell);
    }
    ctx.globalAlpha = 1;
    if (moving) raf = requestAnimationFrame(loop);
    else if (particles.length && !reduced)
      timer = window.setTimeout(() => {
        timer = 0;
        kick();
      }, SHIMMER_INTERVAL_MS);
  };
  const kick = () => {
    if (timer) {
      clearTimeout(timer);
      timer = 0;
    }
    if (!raf && canRun()) raf = requestAnimationFrame(loop);
  };
  const halt = () => {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    raf = 0;
    timer = 0;
  };

  const stopCycle = () => {
    clearTimeout(cycleTimer);
    cycleTimer = 0;
  };
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
  const settleMode = () => {
    if (autoCycle()) armCycle(current ? CYCLE_MS : 300);
    else if (autoShow()) {
      if (!current) {
        cycleIndex = 0;
        current = NAMES[0];
      }
      spill(current);
    } else {
      stopCycle();
      if (current && !hovered) {
        current = null;
        spill(null);
      }
    }
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
    if (autoShow()) return;
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
    if (document.hidden) {
      halt();
      stopCycle();
    } else {
      kick();
      settleMode();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  const io =
    'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => {
          onScreen = entries[entries.length - 1].isIntersecting;
          if (onScreen) {
            kick();
            settleMode();
          } else {
            halt();
            stopCycle();
          }
        })
      : null;
  io?.observe(section);
  if (!io) settleMode();

  const removers: Array<() => void> = [];
  document.querySelectorAll<HTMLElement>('[data-glyph-for]').forEach((link) => {
    const name = link.dataset.glyphFor as GlyphName;
    if (!(name in BITMAPS)) return;
    const on = () => show(name);
    const events: Array<[string, () => void]> = [
      ['mouseenter', on],
      ['mouseleave', hide],
      ['focus', on],
      ['blur', hide],
      ['touchstart', on],
    ];
    events.forEach(([type, handler]) => link.addEventListener(type, handler, { passive: true }));
    removers.push(() => events.forEach(([type, handler]) => link.removeEventListener(type, handler)));
  });

  const stop = () => {
    removers.forEach((remove) => remove());
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', onResize);
    cancelAnimationFrame(resizeFrame);
    io?.disconnect();
    halt();
    stopCycle();
    particles = [];
    ctx.clearRect(0, 0, layout.width, layout.height);
    canvas.classList.add('hidden');
  };
  const refit = (): GlyphSlot => {
    const { left, top, rows } = layoutCanvas();
    settleMode();
    return { left, top, rows, columns: GLYPH_COLUMNS, cell };
  };
  return { refit, stop };
}
