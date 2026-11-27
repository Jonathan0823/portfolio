// The hero's default glyph: the time in Karawang as one row of pixel digits, HH:MM.
import type { Bitmap } from './glyph-model';

const TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** '/' separates a glyph's rows */
const rowsOf = (glyph: string) => glyph.split('/');
/** 5 x 10, strokes two cells wide */
const DIGITS = [
  '.###./##.##/##.##/##.##/##.##/##.##/##.##/##.##/##.##/.###.',
  '..##./.###./..##./..##./..##./..##./..##./..##./..##./#####',
  '.###./##.##/...##/...##/..##./.##../##.../##.../##.../#####',
  '####./...##/...##/...##/.###./...##/...##/...##/...##/####.',
  '##.##/##.##/##.##/##.##/#####/#####/...##/...##/...##/...##',
  '#####/##.../##.../##.../####./...##/...##/...##/...##/####.',
  '.###./##.../##.../##.../####./##.##/##.##/##.##/##.##/.###.',
  '#####/...##/...##/..##./..##./.##../.##../.##../.##../.##..',
  '.###./##.##/##.##/##.##/.###./##.##/##.##/##.##/##.##/.###.',
  '.###./##.##/##.##/##.##/##.##/.####/...##/...##/...##/.###.',
].map(rowsOf);
/** two 2 x 2 dots */
const COLON = rowsOf('../../##/##/../../##/##/../..');
const GAP = '.';

export interface ClockBitmap extends Bitmap {
  /** the "HH:MM" the rows spell */
  time: string;
  /** the first and last bitmap column of the colon */
  colon: [number, number];
}

export const clockTime = (date: Date): string => TIME_FORMAT.format(date);

export function clockBitmap(date: Date): ClockBitmap {
  const time = clockTime(date);
  const glyphs = [...time].map((char) => (char === ':' ? COLON : DIGITS[Number(char)]));
  const rows = glyphs[0].map((_, row) => glyphs.map((glyph) => glyph[row]).join(GAP));
  const start = glyphs.slice(0, time.indexOf(':')).reduce((width, glyph) => width + glyph[0].length + GAP.length, 0);
  return { scale: 1, rows, time, colon: [start, start + COLON[0].length - 1] };
}
