/** Hand-drawn pixel marks for skills that have no usable simple-icons logo. '.' is empty; every other char maps to a palette colour. */
export interface PixelArt {
  rows: readonly string[];
  palette: Readonly<Record<string, string>>;
}

export const PIXEL_ART = {
  // pi.dev mark, traced from the official logo
  pi: {
    rows: ['SSS.', 'B.S.', 'BB.Y', 'B..Y'],
    palette: { S: '#f09082', B: '#4d9abf', Y: '#f1be58' },
  },
  // SQL Server mark, traced from the official logo
  sqlserver: {
    rows: [
      '....DDDDDDDD....',
      '..DDDDDDDDDDDD..',
      'DDDDDDDDDDDDDDDD',
      'LDDDDDDDDDDDDDDD',
      'LLDDDDDDDDDDDDDD',
      'LLLLLDDDDDDDDDDD',
      'LLLLLLLLPP..DDDD',
      'LLLLLLLLPP....DD',
      'LLLLLLLLLPDD....',
      '.LLLLLLLLPDDDDD.',
      '...LLLLLLPDDDDDD',
      '......LLLLDDDDDD',
      'LL....DDDDDDDDPP',
      'LLLLLLDDDDDDLPPP',
      'LLLLLLLLLLLLLPPP',
      'LLLLLLLLLLLLPPPP',
      'LLLLLLLLLLLLLPPP',
      'LLLLLLLLLLLLLLPP',
      '..LLLLLLLLLLLL..',
      '....LLLLLLLL....',
    ],
    palette: { D: '#1a69d4', L: '#3aa6ee', P: '#a9c9fd' },
  },
} as const satisfies Record<string, PixelArt>;

export type PixelArtName = keyof typeof PIXEL_ART;
export const PIXEL_ART_NAMES = Object.keys(PIXEL_ART) as [PixelArtName, ...PixelArtName[]];
