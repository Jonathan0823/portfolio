import type { FieldShape } from './pixel-math';

/** How far past a field's box (px) its canvas reaches, behind the content, for cursor heat. */
export const FIELD_BLEED = 200;
/** px under the top of the screen where a field is kept to its darkest layer: where the nav's links sit on it (Nav.astro) */
export const NAV_BAND = 60;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (t: number) => t * t * (3 - 2 * t);

/** the share of a top field's lava left once the page has scrolled `scrollY` px past a field `height` px tall */
export const lavaLeft = (scrollY: number, height: number) => 1 - ease(clamp(scrollY / (height * 1.4))) * 0.85;

/**
 * The outline of a field. The footer's surface rolls low and boils, its anchored edge fades
 * into the page; the other fields drip. With motion, top fields drain as you scroll away and the footer rises into view.
 */
export function fieldShape(
  kind: string,
  box: { top: number; height: number },
  scrollY: number,
  viewportHeight: number,
  motion: boolean,
): FieldShape {
  if (kind === 'foot')
    return {
      low: true,
      boil: true,
      fadeRows: 2.5,
      coverage: motion ? ease(clamp((viewportHeight - box.top) / box.height)) : 1,
    };
  return {
    runoff: true,
    // the nav stays put as the field scrolls under it; rows above the screen are darkened too, where nobody sees
    darkTop: NAV_BAND + Math.max(0, -box.top),
    coverage: motion ? lavaLeft(scrollY, box.height) : 1,
  };
}
