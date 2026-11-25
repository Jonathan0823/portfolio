import { HEAT_PALETTE, fbm, hash } from './pixel-math';
import { BITMAPS, assignPixels, pickSourceColumns, type GlyphName } from './glyph-model';
import type { HeroField } from './hero-field';

const CELL = 10; // cell size in CSS px
const GLYPH_COLUMNS = 32;
const GLYPH_ROWS = 38;
const RISE_ROWS = 12; // how far above the field's lowest row a particle starts
const GLYPH_WIDTH = GLYPH_COLUMNS * CELL;
const SHIMMER_INTERVAL_MS = 50;

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
}
interface Source {
  column: number;
  row: number;
  /** palette bucket of the field cell the particles rise from */
  bucket: number;
}

/**
 * Glyph spill: hovering a hero link makes pixels rise from the hero field and form its icon.
 * Desktop only. The loop runs only while particles are moving or settled on screen, the tab is
 * visible and the canvas is on screen. Returns a function that removes the listeners.
 */
export function mountGlyphSpill(canvas: HTMLCanvasElement, hero: HeroField): () => void {
  const ctx = canvas.getContext('2d')!;
  let particles: Particle[] = [];
  let sources: Source[] = [];
  let raf = 0, timer = 0, fallbackTime = 0, pixelRatio = 0;
  let onScreen = true;

  const canRun = () => onScreen && !document.hidden;

  const ensureSize = () => {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    if (ratio === pixelRatio) return;
    pixelRatio = ratio;
    canvas.width = GLYPH_COLUMNS * CELL * pixelRatio;
    canvas.height = GLYPH_ROWS * CELL * pixelRatio;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  };

  /** Column of the hero field where the canvas starts; also snaps the canvas to the field grid. */
  const snapOriginColumn = () => {
    const field = hero.field();
    const originColumn = Math.max(0, Math.floor((field.width - 96 - GLYPH_WIDTH) / CELL));
    canvas.style.left = originColumn * CELL + 'px';
    return originColumn;
  };

  const pickSources = (): Source[] => {
    const field = hero.field(), originColumn = snapOriginColumn();
    const usable = field.cellSize === CELL;
    const lowestRows: number[] = [];
    for (let i = 0; i < GLYPH_COLUMNS; i++) {
      const fieldRow = field.lowestRow[originColumn + i];
      lowestRows.push(usable && fieldRow !== undefined ? Math.max(fieldRow, 14) : 20);
    }
    return pickSourceColumns(lowestRows).map((column) => ({
      column,
      row: lowestRows[column] - RISE_ROWS + 1,
      bucket: usable ? field.lowestBucket[originColumn + column] : 1,
    }));
  };

  const spill = (name: GlyphName | null) => {
    if (!canvas.offsetParent) return; // hidden below the desktop breakpoint
    ensureSize();
    const now = performance.now();
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
      const pixelsBySource = assignPixels(BITMAPS[name], GLYPH_COLUMNS, GLYPH_ROWS, sources.map((s) => s.column));
      pixelsBySource.forEach((pixels, sourceIndex) => {
        const source = sources[sourceIndex];
        pixels.forEach((pixel, order) => {
          const verticalLength = Math.max(0, pixel.row - source.row);
          particles.push({
            targetColumn: pixel.column,
            targetRow: pixel.row,
            sourceColumn: source.column,
            sourceRow: source.row,
            verticalLength,
            pathLength: verticalLength + Math.abs(pixel.column - source.column),
            startedAt: now,
            delay: order * 0.018 + sourceIndex * 0.03,
            fadingOut: false,
            column: source.column,
            row: source.row - 1,
            sourceIndex,
          });
        });
      });
    }
    kick();
  };

  /** Position along a particle's path after travelling `distance` cells: down, then sideways. */
  const positionAt = (p: Particle, distance: number): [number, number] =>
    distance < p.verticalLength
      ? [p.sourceColumn, p.sourceRow + distance]
      : [
          p.sourceColumn + Math.sign(p.targetColumn - p.sourceColumn) * Math.min(Math.abs(p.targetColumn - p.sourceColumn), distance - p.verticalLength),
          Math.max(p.sourceRow, p.targetRow),
        ];

  const loop = (now: number) => {
    raf = 0;
    if (!canRun()) return;
    fallbackTime += 0.02;
    const fieldTime = hero.time() || fallbackTime;
    ctx.clearRect(0, 0, GLYPH_COLUMNS * CELL, GLYPH_ROWS * CELL);
    let moving = false;
    particles = particles.filter((p) => {
      const elapsed = (now - p.startedAt) / 1000 - p.delay;
      let alpha = 1, inMotion = false, trailPos: [number, number] | null = null;
      if (!p.fadingOut) {
        if (elapsed < 0) return true;
        const distance = Math.min(p.pathLength, 26 * elapsed + 30 * elapsed * elapsed);
        const [column, row] = positionAt(p, distance);
        p.column = column;
        p.row = row;
        inMotion = distance < p.pathLength;
        if (inMotion) trailPos = positionAt(p, Math.max(0, distance - 1.2));
      } else if (elapsed > 0) {
        const progress = elapsed / 0.55;
        p.row = (p.fadeFromRow ?? p.row) + 30 * progress * progress;
        alpha = Math.max(0, 1 - progress * 1.6);
        inMotion = true;
        if (alpha <= 0) return false;
      }
      if (inMotion) moving = true;
      const bucket = sources[p.sourceIndex] ? sources[p.sourceIndex].bucket : (p.level ?? 1);
      p.level = bucket;
      const level = Math.max(0, Math.min(5, bucket - (fbm(Math.round(p.column) * 0.3 - fieldTime * 0.9, Math.floor(p.row) * 0.3) < 0.45 ? 1 : 0)));
      ctx.fillStyle = HEAT_PALETTE[level];
      if (trailPos) {
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillRect(Math.round(trailPos[0]) * CELL + 1, Math.floor(trailPos[1]) * CELL + 1, CELL - 1, CELL - 1);
      }
      ctx.globalAlpha = alpha;
      ctx.fillRect(Math.round(p.column) * CELL + 1, Math.floor(p.row) * CELL + 1, CELL - 1, CELL - 1);
      return true;
    });
    ctx.globalAlpha = 1;
    if (moving) raf = requestAnimationFrame(loop);
    // Settled particles still shimmer with the field, at a slow rate; with none left the loop ends.
    else if (particles.length) timer = window.setTimeout(() => { timer = 0; kick(); }, SHIMMER_INTERVAL_MS);
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
  const onVisibility = () => (document.hidden ? halt() : kick());
  document.addEventListener('visibilitychange', onVisibility);
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        onScreen = entries[entries.length - 1].isIntersecting;
        if (onScreen) kick();
        else halt();
      })
    : null;
  io?.observe(canvas);

  const removers: Array<() => void> = [];
  document.querySelectorAll<HTMLElement>('[data-glyph-for]').forEach((link) => {
    const name = link.dataset.glyphFor as GlyphName;
    if (!(name in BITMAPS)) return;
    const show = () => spill(name), hide = () => spill(null);
    link.addEventListener('mouseenter', show);
    link.addEventListener('mouseleave', hide);
    link.addEventListener('focus', show);
    link.addEventListener('blur', hide);
    removers.push(() => {
      link.removeEventListener('mouseenter', show);
      link.removeEventListener('mouseleave', hide);
      link.removeEventListener('focus', show);
      link.removeEventListener('blur', hide);
    });
  });

  return () => {
    removers.forEach((remove) => remove());
    document.removeEventListener('visibilitychange', onVisibility);
    io?.disconnect();
    halt();
    particles = [];
    ctx.clearRect(0, 0, GLYPH_COLUMNS * CELL, GLYPH_ROWS * CELL);
  };
}
