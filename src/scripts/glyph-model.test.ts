import { describe, expect, it } from 'vitest';
import {
  BITMAPS,
  SMALL_BITMAPS,
  assignPixels,
  glyphCanvasLayout,
  pickSourceColumns,
  pixelIcon,
  sourceBucket,
  WARM_BUCKET,
} from './glyph-model';

describe('pixelIcon', () => {
  it('merges each row into runs of cells', () => {
    expect(pixelIcon(['##.#', '....'], 8).d).toBe('M0 0h2v1h-2zM3 0h1v1h-1z');
  });

  it('fits the longer side to the size and keeps the aspect ratio', () => {
    const icon = pixelIcon(SMALL_BITMAPS.git, 14);
    expect(icon.viewBox).toBe('0 0 13 13');
    expect(icon.height).toBe(14);
    const wide = pixelIcon(['########', '########'], 16);
    expect([wide.width, wide.height]).toEqual([16, 4]);
  });

  it('covers every lit cell of a small bitmap', () => {
    for (const rows of Object.values(SMALL_BITMAPS)) {
      const lit = rows.join('').split('#').length - 1;
      const covered = [...pixelIcon(rows, 14).d.matchAll(/h(\d+)v/g)].reduce((n, m) => n + Number(m[1]), 0);
      expect(covered).toBe(lit);
    }
  });
});

describe('pickSourceColumns', () => {
  it('picks the highest local peaks first, at least 5 columns apart, at most 5', () => {
    const low = new Array(32).fill(14);
    low[4] = 20;
    low[10] = 30;
    low[12] = 25;
    low[20] = 22;
    low[27] = 18;
    const picks = pickSourceColumns(low);
    expect(picks[0]).toBe(10);
    expect(picks).not.toContain(12);
    expect(picks).toEqual(expect.arrayContaining([4, 20, 27]));
    for (let a = 0; a < picks.length; a++)
      for (let b = a + 1; b < picks.length; b++) expect(Math.abs(picks[a] - picks[b])).toBeGreaterThanOrEqual(5);
    expect(picks.length).toBeLessThanOrEqual(5);
  });

  it('falls back to the centre column when there is no interior candidate', () => {
    expect(pickSourceColumns([10, 10])).toEqual([1]);
  });
});

describe('assignPixels', () => {
  it('gives every lit glyph pixel to exactly one source, the nearest column', () => {
    const lit = (n: keyof typeof BITMAPS) => BITMAPS[n].rows.join('').split('#').length - 1;
    for (const name of ['mail', 'git', 'linkedin'] as const) {
      const g = BITMAPS[name];
      const per = assignPixels(g, 28, 36, [3, 16, 28]);
      expect(per.flat().length).toBe(lit(name) * g.scale * g.scale);
      per.forEach((list, k) =>
        list.forEach((p) => {
          const own = Math.abs(p.column - [3, 16, 28][k]);
          for (const sx of [3, 16, 28]) expect(own).toBeLessThanOrEqual(Math.abs(p.column - sx));
        }),
      );
    }
  });
});

describe('BITMAPS', () => {
  it('has well-formed rectangular bitmaps for every hero link, all at scale 1 and at most 28 wide', () => {
    expect(Object.keys(BITMAPS).sort()).toEqual(['git', 'linkedin', 'mail', 'resume']);
    for (const g of Object.values(BITMAPS)) {
      expect(g.scale).toBe(1);
      expect(g.rows[0].length).toBeLessThanOrEqual(28);
      expect(g.rows.length).toBeLessThanOrEqual(28);
      for (const row of g.rows) {
        expect(row).toMatch(/^[#.]+$/);
        expect(row.length).toBe(g.rows[0].length);
      }
    }
  });
  it('has a rectangular half-size version of every logo, at most 14 rows tall', () => {
    expect(Object.keys(SMALL_BITMAPS).sort()).toEqual(Object.keys(BITMAPS).sort());
    for (const rows of Object.values(SMALL_BITMAPS)) {
      expect(rows.length).toBeLessThanOrEqual(14);
      for (const row of rows) {
        expect(row).toMatch(/^[#.]+$/);
        expect(row.length).toBe(rows[0].length);
      }
    }
  });
});

describe('glyphCanvasLayout', () => {
  const base = { heroWidth: 1440, cell: 10, columns: 28, glyphRows: 28, rightMargin: 96, minTop: 64, gap: 40 };
  const text = { textRight: 900, textTop: 420, textBottom: 740, limitBottom: 900 };
  it('puts the icon box right of the text, bottom level with the text block, on the grid', () => {
    const l = glyphCanvasLayout({ ...base, ...text });
    expect(l).toMatchObject({
      originColumn: 106,
      left: 1060,
      top: 0,
      width: 280,
      height: 740,
      rows: 74,
      rising: false,
    });
    expect(l.left + l.width).toBeLessThanOrEqual(1440 - 96);
    expect(l.left % 10).toBe(0);
    expect(l.height % 10).toBe(0);
  });
  it('stays inside the viewport', () => {
    expect(glyphCanvasLayout({ ...base, ...text, limitBottom: 700 }).height).toBe(700);
  });
  it('moves above the headline when the text leaves no room on the right', () => {
    const l = glyphCanvasLayout({ ...base, ...text, textRight: 1200 });
    expect(l.height).toBe(380);
  });
  it('never goes off the left edge or above the nav', () => {
    const l = glyphCanvasLayout({ ...base, ...text, heroWidth: 100, textTop: 100, textRight: 1200, textBottom: 200 });
    expect(l.originColumn).toBe(0);
    expect(l.height).toBe(350);
  });
});

describe('glyphCanvasLayout on phones', () => {
  const base = {
    heroWidth: 390,
    cell: 4,
    columns: 28,
    glyphRows: 28,
    rightMargin: 20,
    minTop: 60,
    gap: 16,
    textRight: 230,
    textTop: 470,
    textBottom: 620,
    limitBottom: 800,
  };
  it('sits beside the headline, right aligned, on the 4 px grid, bottom level with the headline', () => {
    const l = glyphCanvasLayout(base);
    expect(l).toMatchObject({ left: 256, width: 112, height: 620, rising: false });
    expect(l.left + l.width).toBeLessThanOrEqual(390 - 20);
    expect(l.left).toBeGreaterThanOrEqual(230 + 16);
    expect(l.left % 4).toBe(0);
    expect(l.height % 4).toBe(0);
  });
  it('falls back to the band above the headline when it does not fit beside it', () => {
    expect(glyphCanvasLayout({ ...base, textRight: 300 }).height).toBe(452);
  });
});

describe('assignPixels order', () => {
  it('sends the highest rows first when rising', () => {
    const [list] = assignPixels(BITMAPS.mail, 28, 36, [14], true);
    expect(list[0].row).toBeLessThanOrEqual(list[list.length - 1].row);
  });
});

describe('sourceBucket', () => {
  it('takes the heat of the field column the lava hangs from', () => {
    expect(sourceBucket(12, 2)).toBe(2);
    expect(sourceBucket(0, 0)).toBe(0);
  });

  it('stays warm over a column without terrain, so a logo spilled during the ignite does not cool navy', () => {
    expect(sourceBucket(-1, 0)).toBe(WARM_BUCKET);
    expect(sourceBucket(undefined, 0)).toBe(WARM_BUCKET);
    expect(WARM_BUCKET).toBeGreaterThanOrEqual(3);
  });
});
