/** class on the guide's target while the hero hint points at it; styled in global.css */
export const GUIDE_TARGET_CLASS = 'cursor-guided';

let lit: Element | null = null;

/** Light up the element the hero hint wants the visitor to try; null clears it. The pointer itself stays a plain pointer. */
export function setCursorGuide(el: Element | null): void {
  if (el === lit) return;
  lit?.classList.remove(GUIDE_TARGET_CLASS);
  el?.classList.add(GUIDE_TARGET_CLASS);
  lit = el;
}
