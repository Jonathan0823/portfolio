// Glyph bitmaps and source/pixel assignment for the spill effect. Pure, no DOM.

export interface Bitmap {
  scale: number;
  rows: string[];
}

/** All hero link icons are drawn 1 cell per pixel, at most 28 x 28 cells. */
export const BITMAPS = {
  mail: { scale: 1, rows: ['############################', '############################', '.##########################.', '..########################..', '#..######################..#', '##..####################..##', '###..##################..###', '####..################..####', '#####..##############..#####', '######..############..######', '#######..##########..#######', '########..########..########', '############################', '############################', '############################', '############################', '############################', '############################', '############################', '############################'] },
  git: { scale: 1, rows: ['..........######..........', '.......############.......', '.....################.....', '....##################....', '...####################...', '..####..##########..####..', '..####...##....##...####..', '.#####..............#####.', '.#####..............#####.', '.#####...............####.', '#####................#####', '#####................#####', '#####................#####', '#####................#####', '#####................#####', '#####................#####', '.#####..............#####.', '.######............######.', '.###.#####......#########.', '..###.####......########..', '..###..###......#######...', '...###..........#######...', '....######......######....', '.....#####......####......', '.......###......##........'] },
  linkedin: { scale: 1, rows: ['####............', '####............', '####............', '####............', '................', '................', '####..##########', '####..##########', '####..##########', '####..####..####', '####..####..####', '####..####..####', '####..####..####', '####..####..####', '####..####..####', '####..####..####'] },
} satisfies Record<string, Bitmap>;

export type GlyphName = keyof typeof BITMAPS;

/** Columns the glyph pixels rise from: the highest local peaks, up to 5, at least 5 columns apart. */
export function pickSourceColumns(lowestRows: number[]): number[] {
  const columnCount = lowestRows.length;
  const peaks: number[] = [];
  for (let column = 1; column < columnCount - 1; column++) {
    let isPeak = true;
    for (let offset = -2; offset <= 2; offset++) {
      const neighbour = lowestRows[column + offset];
      if (offset && neighbour !== undefined && neighbour > lowestRows[column]) isPeak = false;
    }
    if (isPeak) peaks.push(column);
  }
  peaks.sort((a, b) => lowestRows[b] - lowestRows[a]);
  const picked: number[] = [];
  for (const column of peaks) {
    if (picked.length < 5 && picked.every((other) => Math.abs(other - column) >= 5)) picked.push(column);
  }
  if (!picked.length) picked.push(Math.floor(columnCount / 2));
  return picked;
}

export interface TargetPixel {
  column: number;
  row: number;
}

/**
 * Splits the lit pixels of a glyph (centred, bottom aligned) between sources, nearest column first.
 * Pixels are ordered by travel: lowest rows first, or highest rows first when `rising`.
 */
export function assignPixels(glyph: Bitmap, columns: number, rows: number, sourceColumns: number[], rising = false): TargetPixel[][] {
  const scale = glyph.scale;
  const height = glyph.rows.length * scale, width = glyph.rows[0].length * scale;
  const top = rows - height, left = Math.floor((columns - width) / 2);
  const bySource: TargetPixel[][] = sourceColumns.map(() => []);
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      if (glyph.rows[Math.floor(j / scale)][Math.floor(i / scale)] !== '#') continue;
      const column = left + i, row = top + j;
      let nearest = 0;
      sourceColumns.forEach((sourceColumn, source) => {
        if (Math.abs(sourceColumn - column) < Math.abs(sourceColumns[nearest] - column)) nearest = source;
      });
      bySource[nearest].push({ column, row });
    }
  }
  bySource.forEach((pixels, source) =>
    pixels.sort((a, b) => (rising ? a.row - b.row : b.row - a.row) || Math.abs(a.column - sourceColumns[source]) - Math.abs(b.column - sourceColumns[source])),
  );
  return bySource;
}

export interface GlyphCanvasLayout {
  /** icon-pixel column the canvas starts at */
  originColumn: number;
  /** CSS px, all multiples of the icon pixel size so the icon sits on the field's grid */
  left: number;
  top: number;
  width: number;
  height: number;
  /** canvas height in icon pixels; the canvas starts at the top of the hero */
  rows: number;
  /** true when the pixels travel up into the icon, false when they fall down into it */
  rising: boolean;
}

export interface LayoutInput {
  /** width of the hero, CSS px */
  heroWidth: number;
  /** icon pixel size: the field's cell on desktop, half of it on phones (still grid-aligned) */
  cell: number;
  /** icon width in icon pixels */
  columns: number;
  /** tallest icon, in icon pixels */
  glyphRows: number;
  rightMargin: number;
  /** nothing is placed above this y (the nav bar) */
  minTop: number;
  /** extent of the text the icon sits beside, relative to the hero */
  textRight: number;
  textTop: number;
  textBottom: number;
  limitBottom: number;
  gap: number;
}

/**
 * The icon box sits right of the text, right aligned with the page padding, its bottom level with
 * the bottom of the text (or the viewport, whichever is higher). On phones the text is just the
 * headline, so the icon sits in clear paper beside it. If the text leaves no room on the right, the
 * box moves above the text instead. All y values are relative to the hero. The canvas spans from
 * the hero's top, so pixels fall from the field down to the icon.
 */
export function glyphCanvasLayout(o: LayoutInput): GlyphCanvasLayout {
  const width = o.columns * o.cell;
  const originColumn = Math.max(0, Math.floor((o.heroWidth - o.rightMargin - width) / o.cell));
  const fitsBeside = originColumn * o.cell >= o.textRight + o.gap;
  let bottom = Math.min(o.textBottom, o.limitBottom);
  if (!fitsBeside) bottom = Math.min(bottom, o.textTop - o.gap);
  bottom = Math.max(bottom, Math.ceil(o.minTop / o.cell + o.glyphRows) * o.cell);
  const rows = Math.max(o.glyphRows, Math.floor(bottom / o.cell));
  return { originColumn, left: originColumn * o.cell, top: 0, width, height: rows * o.cell, rows, rising: false };
}
