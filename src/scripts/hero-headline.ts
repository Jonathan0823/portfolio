// The hero headline as separate letters: where the browser put each one and where its ink starts, so mascots can stand
// on them and a canvas can draw them in the very same place.
import { newSpring, type Spring } from './letter-spring';

export interface Glyph {
  ch: string;
  x: number;
  w: number;
  baseline: number;
  fs: number;
  font: string;
  color: string;
  /** the line it is on, from 0 at the top */
  line: number;
  /** y of the top of its ink */
  top: number;
}
export type Letter = Glyph & Spring;

export interface Headline {
  letters: Letter[];
  /** the letters of each line, left to right */
  lines: Letter[][];
}

/** the lowest alpha counted as ink */
const INK = 100;

/** y of the first row of ink in an RGBA bitmap w pixels wide whose first row is at y0 (both in css px), or null */
export function inkTop(rgba: Uint8ClampedArray, w: number, y0: number, dpr: number): number | null {
  for (let py = 0; py < rgba.length / 4 / w; py++)
    for (let px = 0; px < w; px++) if (rgba[(py * w + px) * 4 + 3] > INK) return y0 + py / dpr;
  return null;
}

/** numbers each letter's line by its baseline (within 8px is the same line) and returns the lines, left to right */
export function groupLines(letters: Letter[]): Letter[][] {
  const key = (l: Letter) => Math.round(l.baseline / 8);
  const keys = [...new Set(letters.map(key))].sort((a, b) => a - b);
  letters.forEach((l) => (l.line = keys.indexOf(key(l))));
  return keys.map((_, i) => letters.filter((l) => l.line === i).sort((a, b) => a.x - b.x));
}

/** measures the headline's letters relative to `origin`; the screen-reader-only text is left out */
export function measureHeadline(h1: HTMLElement, origin: DOMRect, dpr: number): Headline {
  const raster = document.createElement('canvas');
  raster.width = Math.round(origin.width * dpr);
  raster.height = Math.round(origin.height * dpr);
  const ctx = raster.getContext('2d', { willReadFrequently: true })!;
  ctx.scale(dpr, dpr);
  const letters: Letter[] = [];
  const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = (n as Text).parentElement!;
    if (el.closest('.sr-only')) continue;
    const st = getComputedStyle(el);
    const font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
    ctx.font = font;
    const text = (n as Text).data;
    for (let i = 0; i < text.length; i++) {
      if (!text[i].trim()) continue;
      const range = document.createRange();
      range.setStart(n, i);
      range.setEnd(n, i + 1);
      const rect = range.getClientRects()[0];
      if (!rect) continue;
      const baseline = rect.top - origin.top + ctx.measureText(text[i]).fontBoundingBoxAscent;
      letters.push({
        ch: text[i],
        x: rect.left - origin.left,
        w: rect.width,
        baseline,
        fs: parseFloat(st.fontSize),
        font,
        color: st.color,
        line: 0,
        top: baseline,
        ...newSpring(),
      });
    }
  }
  const lines = groupLines(letters);
  // each letter drawn alone, so a neighbour's descender is not mistaken for its top
  for (const l of letters) {
    ctx.clearRect(0, 0, origin.width, origin.height);
    ctx.font = l.font;
    ctx.fillStyle = '#000';
    ctx.fillText(l.ch, l.x, l.baseline);
    const y0 = Math.max(0, Math.floor((l.baseline - l.fs) * dpr));
    const x0 = Math.max(0, Math.floor(l.x * dpr));
    const w = Math.max(1, Math.min(raster.width - x0, Math.ceil(l.w * dpr)));
    const top = inkTop(ctx.getImageData(x0, y0, w, Math.ceil(l.fs * 1.4 * dpr)).data, w, y0 / dpr, dpr);
    if (top !== null) l.top = top;
  }
  return { letters, lines };
}
