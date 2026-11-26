import type { HeroField } from './hero-field';
import { TAP_MS, impactRamp } from './cursor-math';
import { isShapeName } from './cursor-shapes';
import { startCharge, type Charger } from './charger';
import { createHeroStamper, injectFieldRing, pointInField } from './hero-stamp';
import { mountMagnetRing } from './magnet-ring';
import { pageImpact } from './page-impact';
import { createPixelPointer } from './pixel-pointer';
import { pointerStateFor } from './pointer-sprite';
import { spawnShockwave } from './shockwave';

/** on <html> while the pixel pointer is drawn; global.css hides the native cursor under it, except over text fields */
const DRAWN_CLASS = 'has-pixel-pointer';
const CLICKABLE = 'a,button,summary,[data-cursor]';
/** things that get the full-strength shockwave; a click on empty page gets ~60% */
const STRONG = 'a,button,summary,[data-cursor],[data-cursor-magnet],[data-pixel-btn]';
/** clicks here are not ours: the graph marks its own pointer, and text fields need their caret and selection */
const OWN_POINTER = '[data-cursor-hide],input,textarea,select,[contenteditable]';
const TEXT_FIELD = 'input,textarea,select,[contenteditable]';

/**
 * The site's only cursor, for a hovering mouse without reduced motion: a small pixel arrow locked 1:1 to the pointer
 * that becomes the hot arrow or a named shape over clickable things, a ring around logos, a shockwave on click,
 * and a hold-to-charge that can hit the whole page. Its one mark on the page is heat in the hero fields.
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
  let charger: Charger | null = null,
    chargeStrong = false;
  let scrollRaf = 0;

  const syncVisible = () => pointer.setVisible(inside && !overOwnPointer && !overTextField);
  const syncMagnets = () => magnets.update(x, y, inside && !overShape);

  const evaluate = (target: Element | null) => {
    overOwnPointer = !!target?.closest('[data-cursor-hide]');
    overTextField = !!target?.closest(TEXT_FIELD);
    const named = target?.closest<HTMLElement>('[data-cursor]')?.dataset.cursor;
    overShape = isShapeName(named);
    pointer.setState(pointerStateFor(named, !!target?.closest(CLICKABLE)));
    pointer.setInField(pointInField(fields, x, y));
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
    pointer.setInField(false);
    // leaving the window cancels a charge: the release would land somewhere we cannot see
    charger?.cancel();
    stamper.reset();
    syncVisible();
    syncMagnets();
  };
  const onOut = (e: MouseEvent) => {
    if (!e.relatedTarget) onLeave();
  };
  const onVisibility = () => {
    if (!document.hidden) return;
    charger?.dispose();
    charger = null;
    onLeave();
  };

  const onDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    charger?.dispose();
    charger = null;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest(OWN_POINTER)) return;
    pointer.press(true);
    chargeStrong = !!target?.closest(STRONG);
    // the charge reads the live pointer each frame, so moving while holding drags it along
    charger = startCharge(pointer, () => ({ x, y }));
  };
  const onUp = (e: MouseEvent) => {
    if (e.button !== 0) return;
    pointer.press(false);
    if (!charger) return;
    const result = charger.release();
    charger = null;
    if (result.cancelled) return;
    // the explosion fires where the button was released, not where it was pressed
    const at = { x: e.clientX, y: e.clientY };
    const charge = result.held < TAP_MS ? 0 : result.charge;
    spawnShockwave(at.x, at.y, chargeStrong, charge);
    injectFieldRing(fields, at.x, at.y, chargeStrong, charge, impactRamp(charge));
    pageImpact(at.x, at.y, charge);
  };
  // a drag that starts selecting text is a selection, not a charge
  const onSelection = () => {
    if (charger && !window.getSelection()?.isCollapsed) charger.cancel();
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);
  document.addEventListener('selectionchange', onSelection);
  window.addEventListener('scroll', onScroll, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);
  document.addEventListener('mouseout', onOut);
  window.addEventListener('blur', onLeave);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mousedown', onDown);
    window.removeEventListener('mouseup', onUp);
    document.removeEventListener('selectionchange', onSelection);
    window.removeEventListener('scroll', onScroll);
    cancelAnimationFrame(scrollRaf);
    document.documentElement.removeEventListener('mouseleave', onLeave);
    document.removeEventListener('mouseout', onOut);
    window.removeEventListener('blur', onLeave);
    document.removeEventListener('visibilitychange', onVisibility);
    charger?.dispose();
    document.documentElement.classList.remove(DRAWN_CLASS);
    pointer.destroy();
    magnets.destroy();
  };
}
