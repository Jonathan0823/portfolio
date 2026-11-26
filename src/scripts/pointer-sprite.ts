import { HEAT_PALETTE, hash } from './pixel-math';
import { levelForValue } from './blob-shape';
import { isShapeName, shapeCells, type ShapeName } from './cursor-shapes';

/** the plain arrow's outline, so it stays readable over any page colour */
export const INK = '#111111';
const WHITE = '#ffffff';

/** 'X' is outline, 'o' fill; the tip is the top-left X, which is the hotspot */
const ARROW = [
  'X........',
  'XX.......',
  'XoX......',
  'XooX.....',
  'XoooX....',
  'XooooX...',
  'XoooooX..',
  'XooXooX..',
  'XoX.XoX..',
  'XX..XoX..',
  'X....XX..',
];

/** the plain arrow, the hot-coloured one over anything clickable, or a named shape for [data-cursor] targets */
export type PointerState = 'arrow' | 'hot' | ShapeName;

export interface SpriteCell {
  x: number;
  y: number;
  color: string;
  /** outline cells keep their colour when the pointer heats up */
  ink: boolean;
}
export interface Sprite {
  cells: SpriteCell[];
  /** the sprite cell that sits on the pointer's exact position */
  ax: number;
  ay: number;
}

/** A [data-cursor] name wins; any other clickable thing gets the hot arrow. */
export function pointerStateFor(named: string | undefined, clickable: boolean): PointerState {
  if (isShapeName(named)) return named;
  return clickable ? 'hot' : 'arrow';
}

const cache = new Map<string, Sprite>();

/** The sprite for a state. `heated` is the pressed look: the fill runs a step hotter. */
export function spriteFor(state: PointerState, heated = false): Sprite {
  const key = state + (heated ? '!' : '');
  const cached = cache.get(key);
  if (cached) return cached;
  let sprite: Sprite;
  if (state === 'arrow' || state === 'hot') {
    const plain = state === 'arrow';
    const ink = plain ? INK : HEAT_PALETTE[5];
    const fill = heated ? HEAT_PALETTE[plain ? 4 : 5] : plain ? WHITE : HEAT_PALETTE[3];
    const cells: SpriteCell[] = [];
    ARROW.forEach((line, y) => {
      for (let x = 0; x < line.length; x++) {
        if (line[x] !== '.') cells.push({ x, y, color: line[x] === 'X' ? ink : fill, ink: line[x] === 'X' });
      }
    });
    // the tip is the hotspot
    sprite = { cells, ax: 0, ay: 0 };
  } else {
    // a named shape is centred on the pointer; its cells cool toward the edge like the field's heat
    sprite = {
      cells: shapeCells(state).map((c) => ({
        x: c.dx + 5,
        y: c.dy + 5,
        color: HEAT_PALETTE[levelForValue(1 - c.distance * 0.55 + (heated ? 0.3 : 0), hash(c.dx, c.dy, 5) * 0.6 - 0.3)],
        ink: false,
      })),
      ax: 5.5,
      ay: 5.5,
    };
  }
  cache.set(key, sprite);
  return sprite;
}
