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
export function pickSourceColumns(low: number[]): number[] {
  const cols = low.length;
  const cand: number[] = [];
  for (let i = 1; i < cols - 1; i++) {
    let ok = true;
    for (let d = -2; d <= 2; d++) if (d && low[i + d] !== undefined && low[i + d] > low[i]) ok = false;
    if (ok) cand.push(i);
  }
  cand.sort((p, q) => low[q] - low[p]);
  const pick: number[] = [];
  for (const i of cand) if (pick.length < 5 && pick.every(j => Math.abs(j - i) >= 5)) pick.push(i);
  if (!pick.length) pick.push(Math.floor(cols / 2));
  return pick;
}

export interface TargetPixel {
  ti: number;
  tj: number;
}

/** Splits the lit pixels of a glyph (centred, bottom aligned) between sources, nearest column first. */
export function assignPixels(glyph: Bitmap, cols: number, rows: number, sourceXs: number[]): TargetPixel[][] {
  const P = glyph.scale, h = glyph.rows.length * P, w = glyph.rows[0].length * P;
  const top = rows - h, left = Math.floor((cols - w) / 2);
  const per: TargetPixel[][] = sourceXs.map(() => []);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (glyph.rows[Math.floor(j / P)][Math.floor(i / P)] !== '#') continue;
      const ti = left + i, tj = top + j;
      let bi = 0;
      sourceXs.forEach((sx, k) => { if (Math.abs(sx - ti) < Math.abs(sourceXs[bi] - ti)) bi = k; });
      per[bi].push({ ti, tj });
    }
  }
  per.forEach((list, k) => list.sort((p, q) => q.tj - p.tj || Math.abs(p.ti - sourceXs[k]) - Math.abs(q.ti - sourceXs[k])));
  return per;
}
