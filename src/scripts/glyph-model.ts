export interface Bitmap {
  scale: number;
  rows: string[];
}

/** the width of the hero's glyph grid, in cells */
export const GLYPH_COLUMNS = 28;

export const BITMAPS = {
  mail: {
    scale: 1,
    rows: [
      '############################',
      '############################',
      '.##########################.',
      '..########################..',
      '#..######################..#',
      '##..####################..##',
      '###..##################..###',
      '####..################..####',
      '#####..##############..#####',
      '######..############..######',
      '#######..##########..#######',
      '########..########..########',
      '############################',
      '############################',
      '############################',
      '############################',
      '############################',
      '############################',
      '############################',
      '############################',
    ],
  },
  // the résumé: a page with a folded corner and text lines
  resume: {
    scale: 1,
    rows: [
      '###############.......',
      '###############.......',
      '################......',
      '#################.....',
      '##################....',
      '###################...',
      '####################..',
      '######################',
      '######################',
      '######################',
      '####..............####',
      '####..............####',
      '######################',
      '######################',
      '######################',
      '####..............####',
      '####..............####',
      '######################',
      '######################',
      '######################',
      '####..........########',
      '####..........########',
      '######################',
      '######################',
      '######################',
      '######################',
      '######################',
      '######################',
    ],
  },
  git: {
    scale: 1,
    rows: [
      '..........######..........',
      '.......############.......',
      '.....################.....',
      '....##################....',
      '...####################...',
      '..####..##########..####..',
      '..####...##....##...####..',
      '.#####..............#####.',
      '.#####..............#####.',
      '.#####...............####.',
      '#####................#####',
      '#####................#####',
      '#####................#####',
      '#####................#####',
      '#####................#####',
      '#####................#####',
      '.#####..............#####.',
      '.######............######.',
      '.###.#####......#########.',
      '..###.####......########..',
      '..###..###......#######...',
      '...###..........#######...',
      '....######......######....',
      '.....#####......####......',
      '.......###......##........',
    ],
  },
  linkedin: {
    scale: 1,
    rows: [
      '####............',
      '####............',
      '####............',
      '####............',
      '................',
      '................',
      '####..##########',
      '####..##########',
      '####..##########',
      '####..####..####',
      '####..####..####',
      '####..####..####',
      '####..####..####',
      '####..####..####',
      '####..####..####',
      '####..####..####',
    ],
  },
} satisfies Record<string, Bitmap>;

export type GlyphName = keyof typeof BITMAPS;

/** half-size logos for small screens (the footer tide on phones): BITMAPS halved, GitHub's ears redrawn */
export const SMALL_BITMAPS: Record<GlyphName, string[]> = {
  mail: [
    '##############',
    '.############.',
    '#.##########.#',
    '##.########.##',
    '###.######.###',
    '####.####.####',
    '##############',
    '##############',
    '##############',
    '##############',
  ],
  git: [
    '.#.........#.',
    '.##.#####.##.',
    '.###########.',
    '.##.......##.',
    '###.......###',
    '###.......###',
    '###.......###',
    '###.......###',
    '###.......###',
    '.####...####.',
    '.##.#...####.',
    '..###...###..',
    '....#...#....',
  ],
  linkedin: ['##......', '##......', '........', '##.#####', '##.#####', '##.##.##', '##.##.##', '##.##.##'],
  resume: [
    '########...',
    '########...',
    '#########..',
    '###########',
    '###########',
    '##.......##',
    '###########',
    '###########',
    '###########',
    '###########',
    '##.....####',
    '###########',
    '###########',
    '###########',
  ],
};

export interface PixelIcon {
  viewBox: string;
  width: number;
  height: number;
  /** one path of 1-unit cells, merged into horizontal runs */
  d: string;
}

/** A bitmap as one inline-SVG path, scaled so its longer side is `size` px. */
export function pixelIcon(rows: string[], size: number): PixelIcon {
  const w = Math.max(...rows.map((row) => row.length));
  const h = rows.length;
  const scale = size / Math.max(w, h);
  let d = '';
  rows.forEach((row, y) => {
    for (const run of row.matchAll(/#+/g)) d += `M${run.index} ${y}h${run[0].length}v1h-${run[0].length}z`;
  });
  return { viewBox: `0 0 ${w} ${h}`, width: Math.round(w * scale), height: Math.round(h * scale), d };
}

/** heat bucket of a spill whose field column holds no lava right now (the ignite holds the field empty) */
export const WARM_BUCKET = 4;

/** the heat a spill takes from its field column; a column without terrain gives a warm one, not the coldest */
export function sourceBucket(lowestRow: number | undefined, lowestBucket: number): number {
  return lowestRow === undefined || lowestRow < 0 ? WARM_BUCKET : lowestBucket;
}

/** the narrow hero's smaller field cells: the spill shows its logos by itself there */
export const isCompactHero = (fieldCellSize: number): boolean => fieldCellSize < 10;

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

export function assignPixels(
  glyph: Bitmap,
  columns: number,
  rows: number,
  sourceColumns: number[],
  rising = false,
): TargetPixel[][] {
  const scale = glyph.scale;
  const height = glyph.rows.length * scale,
    width = glyph.rows[0].length * scale;
  const top = rows - height,
    left = Math.floor((columns - width) / 2);
  const bySource: TargetPixel[][] = sourceColumns.map(() => []);
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      if (glyph.rows[Math.floor(j / scale)][Math.floor(i / scale)] !== '#') continue;
      const column = left + i,
        row = top + j;
      let nearest = 0;
      sourceColumns.forEach((sourceColumn, source) => {
        if (Math.abs(sourceColumn - column) < Math.abs(sourceColumns[nearest] - column)) nearest = source;
      });
      bySource[nearest].push({ column, row });
    }
  }
  bySource.forEach((pixels, source) =>
    pixels.sort(
      (a, b) =>
        (rising ? a.row - b.row : b.row - a.row) ||
        Math.abs(a.column - sourceColumns[source]) - Math.abs(b.column - sourceColumns[source]),
    ),
  );
  return bySource;
}

export interface GlyphCanvasLayout {
  originColumn: number;
  left: number;
  top: number;
  width: number;
  height: number;
  rows: number;
  rising: boolean;
}

export interface LayoutInput {
  heroWidth: number;
  cell: number;
  columns: number;
  glyphRows: number;
  rightMargin: number;
  minTop: number;
  textRight: number;
  textTop: number;
  textBottom: number;
  limitBottom: number;
  gap: number;
}

/** the largest whole cell, from `cell` down to `minCell`, whose grid fits right of the text; `cell` if none does */
export function fittingCell(
  o: Pick<LayoutInput, 'heroWidth' | 'cell' | 'columns' | 'rightMargin' | 'textRight' | 'gap'> & { minCell: number },
): number {
  for (let cell = o.cell; cell >= o.minCell; cell--)
    if (Math.floor((o.heroWidth - o.rightMargin - o.columns * cell) / cell) * cell >= o.textRight + o.gap) return cell;
  return o.cell;
}

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

export interface BesideLinksInput {
  heroWidth: number;
  /** the stacked pill buttons' box, in section px */
  linksRight: number;
  linksTop: number;
  linksBottom: number;
  columns: number;
  /** how many rows the bitmap on show has */
  bitmapRows: number;
  rightMargin: number;
  gap: number;
  minCell: number;
  maxCell: number;
  /** the section width at and under which nothing is shown */
  hiddenWidth: number;
}

/**
 * The grid right of the stacked links, flush with the right margin, the bitmap centred on them; null where it has no
 * room
 */
export function besideLinksLayout(o: BesideLinksInput): GlyphCanvasLayout | null {
  const edge = o.heroWidth - o.rightMargin;
  const cell = Math.min(o.maxCell, Math.floor((edge - o.linksRight - o.gap) / o.columns));
  if (o.heroWidth <= o.hiddenWidth || cell < o.minCell) return null;
  const width = o.columns * cell;
  const left = edge - width;
  const bottom = Math.round((o.linksTop + o.linksBottom + o.bitmapRows * cell) / 2);
  // whole rows, ending at the bitmap's bottom edge
  const rows = Math.floor(bottom / cell);
  return {
    originColumn: Math.floor(left / cell),
    left,
    top: bottom - rows * cell,
    width,
    height: rows * cell,
    rows,
    rising: false,
  };
}
