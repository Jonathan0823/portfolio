import { Resvg } from '@resvg/resvg-js';
import * as simpleIcons from 'simple-icons';
import { PIXEL_ART } from './skill-art';
import type { Skill } from './schemas';

/** Every skill icon is drawn on a GRID×GRID pixel grid. */
export const GRID = 24;
/** Accent used when a brand colour is too dark to read against the ink base. */
export const FALLBACK_COLOR = '#7c5cfa';
/** Alpha cut-offs tried in turn: thin line-art logos fall apart at the first, so it steps down while that reconnects them. */
const ALPHA_THRESHOLDS = [110, 70, 35];
const RECONNECT_GAIN = 4;

type SimpleIcon = { slug: string; hex: string; path: string };
let iconsBySlug: Map<string, SimpleIcon> | undefined;
function simpleIcon(slug: string): SimpleIcon {
  iconsBySlug ??= new Map(
    (Object.values(simpleIcons) as SimpleIcon[]).filter((i) => i && typeof i.slug === 'string').map((i) => [i.slug, i]),
  );
  const icon = iconsBySlug.get(slug);
  if (!icon) throw new Error(`unknown simple-icons slug "${slug}"`);
  return icon;
}

// 5-row pixel font for monograms; widths vary so W reads as W
const FONT: Record<string, readonly string[]> = {
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  P: ['###', '#.#', '###', '#..', '#..'],
  Q: ['###', '#.#', '#.#', '###', '..#'],
  S: ['###', '#..', '###', '..#', '###'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
};

/** Letters drawn as large as fit, centred, inside a 1px frame so they read as a tile. */
export function monogram(text: string): boolean[] {
  const glyphs = [...text].map((ch) => {
    const g = FONT[ch];
    if (!g) throw new Error(`monogram has no glyph for "${ch}"`);
    return g;
  });
  const on = new Array<boolean>(GRID * GRID).fill(false);
  const raw = glyphs.reduce((w, g) => w + g[0].length + 1, -1);
  const scale = Math.max(1, Math.min(3, Math.floor((GRID - 6) / raw)));
  const x0 = Math.floor((GRID - raw * scale) / 2),
    y0 = Math.floor((GRID - 5 * scale) / 2);
  let cursor = 0;
  for (const g of glyphs) {
    g.forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (c !== '#') return;
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) on[(y0 + y * scale + dy) * GRID + x0 + (cursor + x) * scale + dx] = true;
      }),
    );
    cursor += g[0].length + 1;
  }
  for (let i = 0; i < GRID; i++) on[i] = on[(GRID - 1) * GRID + i] = on[i * GRID] = on[i * GRID + GRID - 1] = true;
  return on;
}

/** Pixel art scaled up by a whole number and centred. Each cell holds its palette key, or '' when empty. */
export function artCells(rows: readonly string[]): string[] {
  const h = rows.length,
    w = rows[0].length;
  const scale = Math.floor((GRID - 4) / Math.max(w, h));
  const x0 = Math.floor((GRID - w * scale) / 2),
    y0 = Math.floor((GRID - h * scale) / 2);
  const out = new Array<string>(GRID * GRID).fill('');
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) out[(y0 + y * scale + dy) * GRID + x0 + x * scale + dx] = ch;
    }),
  );
  return out;
}

/** Number of 4-connected groups of lit cells. */
export function countPieces(lit: readonly boolean[]): number {
  const seen = new Uint8Array(GRID * GRID);
  let pieces = 0;
  for (let i = 0; i < lit.length; i++) {
    if (!lit[i] || seen[i]) continue;
    pieces++;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      const x = c % GRID;
      for (const n of [x > 0 ? c - 1 : -1, x < GRID - 1 ? c + 1 : -1, c - GRID, c + GRID]) {
        if (n < 0 || n >= lit.length || seen[n] || !lit[n]) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
  }
  return pieces;
}

/**
 * A 24×24 SVG path rasterised onto the grid. Starts at a crisp cut-off and lowers it only while
 * that joins up RECONNECT_GAIN or more broken pieces, so thin strokes survive and solid logos stay sharp.
 */
export function rasterize(path: string): boolean[] {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${path}"/></svg>`;
  const px = new Resvg(svg, { fitTo: { mode: 'width', value: GRID } }).render().pixels;
  const at = (t: number) => Array.from({ length: GRID * GRID }, (_, i) => px[i * 4 + 3] > t);
  let lit = at(ALPHA_THRESHOLDS[0]),
    pieces = countPieces(lit);
  for (const t of ALPHA_THRESHOLDS.slice(1)) {
    const next = at(t),
      nextPieces = countPieces(next);
    if (pieces - nextPieces < RECONNECT_GAIN) break;
    lit = next;
    pieces = nextPieces;
  }
  return lit;
}

/** Lit cells merged into horizontal runs, so a whole icon is one SVG path. */
export function runsPath(lit: readonly boolean[], width = GRID): string {
  let d = '';
  for (let y = 0; y < lit.length / width; y++)
    for (let x = 0; x < width; x++) {
      if (!lit[y * width + x]) continue;
      let w = 1;
      while (x + w < width && lit[y * width + x + w]) w++;
      d += `M${x} ${y}h${w}v1h-${w}z`;
      x += w - 1;
    }
  return d;
}

/** Lit cells packed 4 per hex digit, for the client-side entrance. */
export function encodeBits(lit: readonly boolean[]): string {
  let hex = '';
  for (let i = 0; i < lit.length; i += 4)
    hex += ((+!!lit[i] << 3) | (+!!lit[i + 1] << 2) | (+!!lit[i + 2] << 1) | +!!lit[i + 3]).toString(16);
  return hex;
}

export function decodeBits(hex: string): boolean[] {
  return [...hex].flatMap((h) => {
    const v = parseInt(h, 16);
    return [8, 4, 2, 1].map((b) => (v & b) !== 0);
  });
}

function readable(hex: string): boolean {
  const n = parseInt(hex, 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) >= 60;
}

export interface SkillIcon {
  /** the whole icon in ink, as horizontal runs */
  base: string;
  /** the colour layer revealed on hover: one path per colour */
  layers: { color: string; d: string }[];
  /** lit cells, hex-packed */
  bits: string;
}

export function skillIcon(skill: Pick<Skill, 'icon' | 'mono' | 'art'>): SkillIcon {
  if (skill.art) {
    const art = PIXEL_ART[skill.art];
    const cells = artCells(art.rows);
    const lit = cells.map(Boolean);
    return {
      base: runsPath(lit),
      layers: Object.entries(art.palette).map(([key, color]) => ({ color, d: runsPath(cells.map((c) => c === key)) })),
      bits: encodeBits(lit),
    };
  }
  const brand = skill.icon ? simpleIcon(skill.icon) : null;
  const lit = brand ? rasterize(brand.path) : monogram(skill.mono ?? '');
  const base = runsPath(lit);
  const color = brand && readable(brand.hex) ? `#${brand.hex}` : FALLBACK_COLOR;
  return { base, layers: [{ color, d: base }], bits: encodeBits(lit) };
}
