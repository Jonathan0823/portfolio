// Glyph bitmaps and source/pixel assignment for the spill effect. Pure, no DOM.

export interface Bitmap {
  scale: number;
  rows: string[];
}

export const BITMAPS = {
  mail: { scale: 2, rows: ['################', '##............##', '#.#..........#.#', '#..#........#..#', '#...#......#...#', '#....#....#....#', '#.....#..#.....#', '#......##......#', '#..............#', '#..............#', '################'] },
  git: { scale: 1, rows: ['........######........', '.....############.....', '....##############....', '...################...', '..##################..', '.####...#....#...####.', '.####............####.', '.####............####.', '####..............####', '####..............####', '####..............####', '####..............####', '####..............####', '#####............#####', '.####............####.', '.##.###........######.', '.###.####....########.', '..###.##......######..', '...##.........#####...', '....####......####....', '.....###......###.....', '......................'] },
  cv: { scale: 2, rows: ['...########.....', '...#......##....', '...#......#.#...', '...#.###..####..', '...#.........#..', '...#.#######.#..', '...#.........#..', '...#.#######.#..', '...#.........#..', '...#.#####...#..', '...###########..'] },
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

/** Splits the lit pixels of a glyph (centred, bottom aligned) between sources, nearest column first. */
export function assignPixels(glyph: Bitmap, columns: number, rows: number, sourceColumns: number[]): TargetPixel[][] {
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
    pixels.sort((a, b) => b.row - a.row || Math.abs(a.column - sourceColumns[source]) - Math.abs(b.column - sourceColumns[source])),
  );
  return bySource;
}
