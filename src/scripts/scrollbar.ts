// Whether a press is on a scrollbar: a drag to scroll, which must not start a charge or a hold.

/** how far in from the edge an overlay scrollbar reaches, px */
const OVERLAY_REACH = 16;

export function onScrollbar(
  e: { target: EventTarget | null; clientX: number; clientY: number },
  root: Element = document.documentElement,
): boolean {
  // a classic scrollbar takes up room, so a press on it lands outside the content box
  if (e.clientX >= root.clientWidth || e.clientY >= root.clientHeight) return true;
  // an overlay scrollbar takes none: the press is on the root itself, just inside the edge
  if (e.target === root)
    return e.clientX >= root.clientWidth - OVERLAY_REACH || e.clientY >= root.clientHeight - OVERLAY_REACH;
  // a sideways scroller is only ever the target itself on its scrollbar or the thin padding beside it
  const el = e.target as Element | null;
  return !!el?.matches?.('[data-scroller]') && el.scrollWidth > el.clientWidth;
}
