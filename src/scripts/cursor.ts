import type { HeroField } from './hero-field';
import { isShapeName } from './cursor-shapes';
import { createHeroStamper } from './hero-stamp';
import { mountMagnetRing } from './magnet-ring';
import { createPixelPointer } from './pixel-pointer';
import { pointerStateFor } from './pointer-sprite';

/** on <html> while the pixel pointer is drawn; global.css hides the native cursor under it, except over text fields */
const DRAWN_CLASS = 'has-pixel-pointer';
const CLICKABLE = 'a,button,summary,[data-cursor]';
const TEXT_FIELD = 'input,textarea,select,[contenteditable]';

/**
 * The site's only cursor, for a hovering mouse without reduced motion: a small pixel arrow locked 1:1 to the pointer
 * that becomes the hot arrow or a named shape over clickable things, and a ring around logos. Its one mark on the page is
 * heat in the hero fields.
 */
export function mountCursor(fields: HeroField[]): () => void {
  const pointer = createPixelPointer();
  const magnets = mountMagnetRing();
  const stamper = createHeroStamper(fields);

  let inside = false,
    x = 0,
    y = 0;
  let overOwnPointer = false,
    overTextField = false,
    overShape = false;
  let scrollRaf = 0;

  const syncVisible = () => pointer.setVisible(inside && !overOwnPointer && !overTextField);
  const syncMagnets = () => magnets.update(x, y, inside && !overShape);

  const evaluate = (target: Element | null) => {
    overOwnPointer = !!target?.closest('[data-cursor-hide]');
    overTextField = !!target?.closest(TEXT_FIELD);
    const named = target?.closest<HTMLElement>('[data-cursor]')?.dataset.cursor;
    overShape = isShapeName(named);
    pointer.setState(pointerStateFor(named, !!target?.closest(CLICKABLE)));
    syncVisible();
  };

  const onMove = (e: MouseEvent) => {
    x = e.clientX;
    y = e.clientY;
    // hide the native cursor only once ours is about to draw, so it is never missing
    document.documentElement.classList.add(DRAWN_CLASS);
    pointer.move(x, y);
    inside = true;
    evaluate(e.target instanceof Element ? e.target : null);
    stamper.move(x, y, e.timeStamp);
    syncMagnets();
  };
  // scrolling moves content under a still pointer, so what it is over changes without a mouse move
  const onScroll = () => {
    if (scrollRaf || !inside) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      if (!inside) return;
      evaluate(document.elementFromPoint(x, y));
      syncMagnets();
    });
  };
  const onLeave = () => {
    inside = false;
    stamper.reset();
    syncVisible();
    syncMagnets();
  };
  const onOut = (e: MouseEvent) => {
    if (!e.relatedTarget) onLeave();
  };
  const onVisibility = () => {
    if (document.hidden) onLeave();
  };

  document.addEventListener('mousemove', onMove);
  window.addEventListener('scroll', onScroll, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);
  document.addEventListener('mouseout', onOut);
  window.addEventListener('blur', onLeave);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    document.removeEventListener('mousemove', onMove);
    window.removeEventListener('scroll', onScroll);
    cancelAnimationFrame(scrollRaf);
    document.documentElement.removeEventListener('mouseleave', onLeave);
    document.removeEventListener('mouseout', onOut);
    window.removeEventListener('blur', onLeave);
    document.removeEventListener('visibilitychange', onVisibility);
    document.documentElement.classList.remove(DRAWN_CLASS);
    pointer.destroy();
    magnets.destroy();
  };
}
