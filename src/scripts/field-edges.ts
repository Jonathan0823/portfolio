import type { FieldShape } from './pixel-math';

/** How far past a field's box (px) its canvas reaches, behind the content, for cursor heat. */
export const FIELD_BLEED = 200;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * The outline of a field. The footer's surface rolls low and its anchored edge fades
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
      fadeRows: 2.5,
      coverage: motion ? ease(clamp((viewportHeight - box.top) / box.height)) : 1,
    };
  return { runoff: true, coverage: motion ? 1 - ease(clamp(scrollY / (box.height * 1.4))) * 0.85 : 1 };
}
