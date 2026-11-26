
export interface Bitmap {
  scale: number;
  rows: string[];
}

export const BITMAPS = {
  mail: { scale: 1, rows: ['############################', '############################', '.##########################.', '..########################..', '#..######################..#', '##..####################..##', '###..##################..###', '####..################..####', '#####..##############..#####', '######..############..######', '#######..##########..#######', '########..########..########', '############################', '############################', '############################', '############################', '############################', '############################', '############################', '############################'] },
  git: { scale: 1, rows: ['..........######..........', '.......############.......', '.....################.....', '....##################....', '...####################...', '..####..##########..####..', '..####...##....##...####..', '.#####..............#####.', '.#####..............#####.', '.#####...............####.', '#####................#####', '#####................#####', '#####................#####', '#####................#####', '#####................#####', '#####................#####', '.#####..............#####.', '.######............######.', '.###.#####......#########.', '..###.####......########..', '..###..###......#######...', '...###..........#######...', '....######......######....', '.....#####......####......', '.......###......##........'] },
  linkedin: { scale: 1, rows: ['####............', '####............', '####............', '####............', '................', '................', '####..##########', '####..##########', '####..##########', '####..####..####', '####..####..####', '####..####..####', '####..####..####', '####..####..####', '####..####..####', '####..####..####'] },
} satisfies Record<string, Bitmap>;

export type GlyphName = keyof typeof BITMAPS;

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
