import { HEAT_PALETTE } from './palette';

/** Pixel icons for the stats row. Each frame is rows of palette keys; '.' is empty. Frames alternate to animate. */
const COLORS: Record<string, string> = {
  r: HEAT_PALETTE[3],
  o: HEAT_PALETTE[4],
  y: HEAT_PALETTE[5],
  v: HEAT_PALETTE[2],
  k: HEAT_PALETTE[0],
};

export interface StatIconArt {
  width: number;
  height: number;
  frames: readonly (readonly string[])[];
  /** seconds for one loop through the frames */
  loop: number;
}

export const STAT_ICONS = {
  // a streak: a flame whose tip leans left, then right
  fire: {
    loop: 0.9,
    frames: [
      [
        '....r.......',
        '....rr......',
        '...rrr...r..',
        '...rrrr..rr.',
        '..rrorrrrrr.',
        '..rrooorrrr.',
        '.rrooooorrrr',
        '.rroooyoorrr',
        '.rrooyyyoorr',
        '.rrooyyyyorr',
        '.rrooyyyyorr',
        '..rroyyyyor.',
        '..rrrooooor.',
        '...rrrrrrr..',
      ],
      [
        '.......r....',
        '......rr....',
        '..r...rrr...',
        '.rr..rrrr...',
        '.rrrrrrorr..',
        '.rrrroooorr.',
        'rrrroooooorr',
        'rrroyyyooorr',
        'rroyyyyooorr',
        'rroyyyyyoorr',
        'rroyyyyyoorr',
        '.royyyyyorr.',
        '.rooooooorr.',
        '..rrrrrrrr..',
      ],
    ],
  },
  // the busiest day: a bolt that flashes
  bolt: {
    loop: 1.2,
    frames: [
      [
        '.......yyyy.',
        '......yyyy..',
        '.....yyyy...',
        '....yyyy....',
        '...yyyyyyyy.',
        '...oooyyyy..',
        '......yyy...',
        '.....yyy....',
        '....yyo.....',
        '...yyo......',
        '...yo.......',
        '..yo........',
        '..o.........',
      ],
      [
        '.......oooo.',
        '......oooo..',
        '.....oooo...',
        '....oooo....',
        '...oooooooo.',
        '...rrrooor..',
        '......ooo...',
        '.....ooo....',
        '....oor.....',
        '...oor......',
        '...or.......',
        '..or........',
        '..r.........',
      ],
    ],
  },
  // years of writing code: a prompt with a blinking cursor
  prompt: {
    loop: 1.1,
    frames: [
      ['vv.......', '.vv......', '..vv.....', '...vv....', '..vv.....', '.vv..yyyy', 'vv...yyyy'],
      ['vv.......', '.vv......', '..vv.....', '...vv....', '..vv.....', '.vv......', 'vv.......'],
    ],
  },
} satisfies Record<string, Omit<StatIconArt, 'width' | 'height'>>;

export type StatIconName = keyof typeof STAT_ICONS;

/** The icon's size in cells and each frame as a list of filled cells with their colour. */
export function statIcon(name: StatIconName): StatIconArt & { cells: { x: number; y: number; fill: string }[][] } {
  const { frames, loop } = STAT_ICONS[name];
  const width = frames[0][0].length,
    height = frames[0].length;
  const cells = frames.map((rows) => {
    if (rows.length !== height || rows.some((r) => r.length !== width))
      throw new Error(`stat icon "${name}" has frames of different sizes`);
    return rows.flatMap((row, y) =>
      [...row].flatMap((ch, x) => {
        if (ch === '.') return [];
        const fill = COLORS[ch];
        if (!fill) throw new Error(`stat icon "${name}" uses unknown colour "${ch}"`);
        return [{ x, y, fill }];
      }),
    );
  });
  return { width, height, frames, loop, cells };
}
